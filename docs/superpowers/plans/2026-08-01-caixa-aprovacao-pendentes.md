# Conciliação E3 — Aprovação em Movimentações de caixa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Movimento de extrato nasce Pendente; Aprovar (categoria+centro obrigatórios, obra opcional) cria a conta já liquidada com o vínculo/dedup da E1; lote com dados comuns; detector de similares; Dispensar/Reativar; retroativo manual para ~243.

**Architecture:** Decisão em funções puras (`cash_move_aprovar_plano`, `titulos_similares_classificar`); 3 handlers finos (`cash-move-aprovar`, `-aprovar-lote`, `-dispensar`); caronas mínimas (import nasce Pendente; vincular E1 confirma; fila E2 exclui Dispensado); front no `renderCrud` via `extraRowActions` + painel de lote (precedente `payableGroupsPanelHtml`). Zero ALTER de schema.

**Spec:** `docs/superpowers/specs/2026-08-01-caixa-aprovacao-pendentes-design.md`

## Global Constraints

- LF; `php -l` + `node --check`; suíte `bash scripts/tests/run-all.sh` (auto-descobre; esperado 21/21 ao fim).
- COLLATION: toda comparação nova é coluna×parâmetro ou numérica (nenhum JOIN texto×texto nesta frente).
- Commits locais pt sem acento + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; NUNCA push; nada de `.superpowers/`/`.claude/`.
- Front: R$ só `moneySpan`; texto dinâmico escapado; toast com severidade (nunca `alert()` novo); listeners via `addEventListener`; nunca `.catch(() => {})`.
- A migration retroativa é MUDANÇA DE DADO: arquivo entregue, execução SÓ pelo dono com backup — não entra em `ensure_*`.
- Fora de escopo: E4, permissões novas, mudanças no conciliar da prévia.

---

### Task 1: Funções puras + testes (TDD)

**Files:**
- Modify: `api/index.php` — inserir após `ofx_pendencias_ordenar` (bloco de puras do topo)
- Test: `scripts/tests/php/test_cash_aprovar_plano.php` (novo), `scripts/tests/php/test_titulos_similares.php` (novo)

**Interfaces:**
- Produces: `cash_move_aprovar_plano(array $movimento, array $payload): array` — `['acao'=>'recusar','motivo'=>...]` ou `['acao'=>'criar','motivo'=>null,'table','refTipo','titulo'=>[...],'movimentoUpdate'=>[...]]`; `titulos_similares_classificar(array $candidatos, $parteId): array` (acrescenta `suspeita: 'alta'|'media'`, alta primeiro). Task 2 executa o plano literalmente.

- [ ] **Step 1: Testes que falham** — criar `scripts/tests/php/test_cash_aprovar_plano.php`:

```php
<?php
// E3: decisão PURA da aprovação de movimento pendente — valida e monta o plano
// (título já liquidado + update do movimento). Obra é OPCIONAL por decisão do
// dono; categoria e centro são OBRIGATÓRIOS; Transferência não vira título.
require __DIR__ . '/harness.php';

$mov = ['id' => 42, 'status' => 'Pendente', 'type' => 'Saída', 'date' => '2026-07-07', 'amount' => 1880.09, 'bankAccount' => 'Sicoob'];
$ok = ['categoryId' => 3, 'costCenterId' => 2];

$r = cash_move_aprovar_plano(array_merge($mov, ['status' => 'Confirmado']), $ok);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'PENDENTE'), 'nao-pendente recusa');

$r = cash_move_aprovar_plano(array_merge($mov, ['type' => 'Transferência']), $ok);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'Dispensar'), 'transferencia orienta Dispensar');

$r = cash_move_aprovar_plano(array_merge($mov, ['type' => 'X']), $ok);
t_assert($r['acao'] === 'recusar', 'tipo desconhecido recusa');

$r = cash_move_aprovar_plano($mov, ['categoryId' => 3]);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'obrigat'), 'sem centro recusa');

$r = cash_move_aprovar_plano($mov, ['costCenterId' => 2]);
t_assert($r['acao'] === 'recusar', 'sem categoria recusa');

$r = cash_move_aprovar_plano(array_merge($mov, ['date' => '07/07/2026']), $ok);
t_assert($r['acao'] === 'recusar', 'data invalida recusa');

$r = cash_move_aprovar_plano($mov, $ok);
t_assert($r['acao'] === 'criar' && $r['table'] === 'accounts_payable' && $r['refTipo'] === 'CONTA_PAGAR', 'saida cria no pagar');
t_assert($r['titulo']['status'] === 'Pago' && $r['titulo']['paidDate'] === '2026-07-07', 'saida nasce Pago com a data do movimento');
t_assert($r['titulo']['document'] === 'MOV-42' && $r['titulo']['amount'] === 1880.09, 'document MOV-id e valor do movimento');
t_assert($r['titulo']['bankAccount'] === 'Sicoob' && $r['titulo']['dueDate'] === '2026-07-07', 'banco e vencimento herdados');
t_assert($r['titulo']['valor_original'] === null && $r['titulo']['juros_aplicado'] === null, 'sem juros inventado (v1.41.0 fica para edicao)');
t_assert($r['titulo']['projectId'] === null && $r['titulo']['supplierId'] === null, 'obra e fornecedor OPCIONAIS nascem vazios');
t_assert($r['movimentoUpdate']['status'] === 'Confirmado' && $r['movimentoUpdate']['categoryId'] === 3, 'movimento confirma com a mesma classificacao');

$r = cash_move_aprovar_plano(array_merge($mov, ['type' => 'Entrada']), array_merge($ok, ['projectId' => 7, 'parteId' => 9]));
t_assert($r['table'] === 'accounts_receivable' && $r['refTipo'] === 'CONTA_RECEBER', 'entrada cria no receber');
t_assert($r['titulo']['status'] === 'Recebido' && $r['titulo']['receivedDate'] === '2026-07-07', 'entrada nasce Recebido');
t_assert($r['titulo']['clientId'] === 9 && $r['titulo']['projectId'] === 7, 'parte vira clientId e obra vai junto');

foreach ([['status' => 'Confirmado'], ['type' => 'Transferência'], ['type' => 'X']] as $var) {
    $r = cash_move_aprovar_plano(array_merge($mov, $var), $ok);
    t_assert(!preg_match('/SELECT|INSERT|accounts_|cash_bank/i', (string) $r['motivo']), 'motivo nao vaza SQL/tabela');
}

t_resumo('test_cash_aprovar_plano');
```

E `scripts/tests/php/test_titulos_similares.php`:

```php
<?php
// E3/E4: classificação PURA da suspeita de duplicidade. Candidatos já chegam
// filtrados pelo SQL (valor exato + vencimento ±5d) — aqui só o grau: mesma
// parte (fornecedor/cliente) = ALTA; senão MÉDIA; alta primeiro.
require __DIR__ . '/harness.php';

$c1 = ['id' => 1, 'document' => 'NF-1', 'supplierId' => 5, 'clientId' => null];
$c2 = ['id' => 2, 'document' => 'NF-2', 'supplierId' => 8, 'clientId' => null];
$c3 = ['id' => 3, 'document' => 'REC-3', 'supplierId' => null, 'clientId' => 5];

$r = titulos_similares_classificar([$c2, $c1], 5);
t_assert($r[0]['id'] === 1 && $r[0]['suspeita'] === 'alta', 'mesma parte (fornecedor) = alta, e vem primeiro');
t_assert($r[1]['suspeita'] === 'media', 'parte diferente = media');

$r = titulos_similares_classificar([$c3], 5);
t_assert($r[0]['suspeita'] === 'alta', 'mesma parte (cliente) = alta');

$r = titulos_similares_classificar([$c1, $c2], null);
t_assert($r[0]['suspeita'] === 'media' && $r[1]['suspeita'] === 'media', 'sem parte informada tudo e media');

t_assert(titulos_similares_classificar([], 5) === [], 'vazio -> vazio');

$r = titulos_similares_classificar([$c1], '');
t_assert($r[0]['suspeita'] === 'media', 'parte vazia (string) nao vira alta');

t_resumo('test_titulos_similares');
```

- [ ] **Step 2: RED** — os dois testes falham com undefined function.

- [ ] **Step 3: Implementar** — em `api/index.php`, após `ofx_pendencias_ordenar`:

```php

// ── Conciliação E3: aprovação de movimento pendente ─────────────────────────
// Decisão PURA: valida movimento/payload e monta o plano (título JÁ LIQUIDADO +
// update do movimento). Obra é OPCIONAL (decisão do dono — despesa geral não tem
// obra); categoria e centro de custo são OBRIGATÓRIOS; Transferência não vira
// título (o caminho dela é Dispensar). valor_original/juros nascem NULOS — o
// banco não separa juros; editar depois ativa o fluxo da v1.41.0.
function cash_move_aprovar_plano(array $movimento, array $payload): array
{
    $recusa = static fn (string $motivo): array => ['acao' => 'recusar', 'motivo' => $motivo];
    if (($movimento['status'] ?? '') !== 'Pendente') {
        return $recusa('Só movimento PENDENTE pode ser aprovado — este já foi tratado.');
    }
    $tipo = (string) ($movimento['type'] ?? '');
    if ($tipo === 'Transferência') {
        return $recusa('Transferência entre contas não vira título — use Dispensar para tirá-la da fila.');
    }
    if ($tipo !== 'Entrada' && $tipo !== 'Saída') {
        return $recusa('Tipo de movimento desconhecido.');
    }
    $categoryId = (int) ($payload['categoryId'] ?? 0);
    $costCenterId = (int) ($payload['costCenterId'] ?? 0);
    if (!$categoryId || !$costCenterId) {
        return $recusa('Categoria financeira e centro de custo são obrigatórios para aprovar.');
    }
    $data = (string) ($movimento['date'] ?? '');
    $valor = round((float) ($movimento['amount'] ?? 0), 2);
    if ($valor <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
        return $recusa('Movimento sem data ou valor válidos.');
    }
    $isSaida = $tipo === 'Saída';
    $projectId = ($payload['projectId'] ?? '') !== '' && ($payload['projectId'] ?? null) !== null ? (int) $payload['projectId'] : null;
    $parteId = ($payload['parteId'] ?? '') !== '' && ($payload['parteId'] ?? null) !== null ? (int) $payload['parteId'] : null;
    $titulo = [
        'document' => 'MOV-' . (int) ($movimento['id'] ?? 0),
        'issueDate' => $data,
        'dueDate' => $data,
        ($isSaida ? 'paidDate' : 'receivedDate') => $data,
        'amount' => $valor,
        'status' => $isSaida ? 'Pago' : 'Recebido',
        'bankAccount' => (string) ($movimento['bankAccount'] ?? ''),
        'categoryId' => $categoryId,
        'costCenterId' => $costCenterId,
        'projectId' => $projectId,
        ($isSaida ? 'supplierId' : 'clientId') => $parteId,
        'valor_original' => null,
        'juros_aplicado' => null,
    ];
    return [
        'acao' => 'criar',
        'motivo' => null,
        'table' => $isSaida ? 'accounts_payable' : 'accounts_receivable',
        'refTipo' => $isSaida ? 'CONTA_PAGAR' : 'CONTA_RECEBER',
        'titulo' => $titulo,
        'movimentoUpdate' => ['categoryId' => $categoryId, 'costCenterId' => $costCenterId, 'projectId' => $projectId, 'status' => 'Confirmado'],
    ];
}

// E3/E4 — grau de suspeita de duplicidade (candidatos já filtrados no SQL por
// valor EXATO + vencimento ±5d): mesma parte = ALTA; senão MÉDIA; alta primeiro.
function titulos_similares_classificar(array $candidatos, $parteId): array
{
    $parte = ($parteId !== null && $parteId !== '' && (int) $parteId > 0) ? (int) $parteId : 0;
    $out = [];
    foreach ($candidatos as $c) {
        $mesmaParte = $parte > 0
            && ((int) ($c['supplierId'] ?? 0) === $parte || (int) ($c['clientId'] ?? 0) === $parte);
        $out[] = ['suspeita' => $mesmaParte ? 'alta' : 'media'] + $c;
    }
    usort($out, static function (array $a, array $b): int {
        if ($a['suspeita'] === $b['suspeita']) return 0;
        return $a['suspeita'] === 'alta' ? -1 : 1;
    });
    return $out;
}
```

- [ ] **Step 4: GREEN** — `php -l api/index.php`; `test_cash_aprovar_plano: 19/19 ok`; `test_titulos_similares: 6/6 ok`; suíte `21/21`.

- [ ] **Step 5: Commit**

```bash
git add api/index.php scripts/tests/php/test_cash_aprovar_plano.php scripts/tests/php/test_titulos_similares.php
git commit -m "feat(api): decisao pura da aprovacao de movimento pendente e grau de similares (E3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Endpoints + caronas + migration retroativa

**Files:**
- Modify: `api/index.php` — SQL helper + 3 handlers (após `handle_ofx_pendencias`); rotas (após `ofx-pendencias`); caronas (import nasce Pendente; `ofx_vincular_executar` confirma o movimento; fila E2 exclui Dispensado)
- Create: `migrations/2026-08-01-caixa-pendente-retroativo.sql`

**Interfaces:**
- Consumes: `cash_move_aprovar_plano`, `titulos_similares_classificar`, `ofx_movimento_livre`, `insert_dynamic`, `financeiro_baixa_audit_details`.
- Produces: `POST cash-move-aprovar` `{cashMoveId, categoryId, costCenterId, projectId?, parteId?, forcar?}` → cria OU devolve `{similares, fitid, bankAccountId}` sem criar; `POST cash-move-aprovar-lote` `{itens:[ids], dados:{...}}` → `{criadas, suspeitas, falhas}`; `POST cash-move-dispensar` `{cashMoveId, reativar?}`.

- [ ] **Step 1: SQL helper + handlers** — após `handle_ofx_pendencias`:

```php
// E3 — candidatos a duplicata: valor EXATO + vencimento ±5 dias, sem extrato
// vinculado. O grau (alta/média) sai da pura titulos_similares_classificar.
function titulos_similares(PDO $pdo, string $table, float $valor, string $data): array
{
    $parteCol = $table === 'accounts_payable' ? 'supplierId' : 'clientId';
    $stmt = $pdo->prepare(
        "SELECT id, document, dueDate, status, amount, {$parteCol}
           FROM {$table}
          WHERE amount = ? AND status <> 'Cancelado' AND ofxFitid IS NULL
            AND ABS(DATEDIFF(dueDate, ?)) <= 5
          ORDER BY ABS(DATEDIFF(dueDate, ?)) ASC
          LIMIT 5"
    );
    $stmt->execute([number_format($valor, 2, '.', ''), $data, $data]);
    return $stmt->fetchAll() ?: [];
}

// E3 — núcleo da aprovação (reusado pelo individual e pelo lote): decide pela
// pura, roda o detector (a menos de forcar), cria o título JÁ LIQUIDADO e
// confirma o movimento com a referência — o dedup da E1 no nascimento.
function cash_move_aprovar_executar(PDO $pdo, array $authUser, array $payload): array
{
    $cashMoveId = (int) ($payload['cashMoveId'] ?? 0);
    if (!$cashMoveId) {
        return ['ok' => false, 'status' => 400, 'motivo' => 'Informe o movimento.'];
    }
    $stmt = $pdo->prepare('SELECT * FROM cash_bank_movements WHERE id = ? LIMIT 1');
    $stmt->execute([$cashMoveId]);
    $movimento = $stmt->fetch();
    if (!$movimento) {
        return ['ok' => false, 'status' => 404, 'motivo' => 'Movimento não encontrado.'];
    }
    // Referência viva de título = já representado (guarda da E1; recordId 0 nunca é "o próprio").
    $refTipoMov = (string) ($movimento['referencia_tipo'] ?? '');
    $tituloRef = null;
    if (in_array($refTipoMov, ['CONTA_PAGAR', 'CONTA_RECEBER'], true) && !empty($movimento['referencia_id'])) {
        $tabelaRef = $refTipoMov === 'CONTA_PAGAR' ? 'accounts_payable' : 'accounts_receivable';
        $stmt = $pdo->prepare("SELECT id, document FROM {$tabelaRef} WHERE id = ? LIMIT 1");
        $stmt->execute([(int) $movimento['referencia_id']]);
        $tituloRef = $stmt->fetch() ?: null;
    }
    $ocupado = ofx_movimento_livre($movimento, $tituloRef, 0, true);
    if ($ocupado !== null) {
        return ['ok' => false, 'status' => 409, 'motivo' => $ocupado];
    }
    $plano = cash_move_aprovar_plano($movimento, $payload);
    if ($plano['acao'] === 'recusar') {
        return ['ok' => false, 'status' => 422, 'motivo' => $plano['motivo']];
    }
    // FITID do movimento (quando veio de OFX) — lookup numérico, collation-imune.
    $stmt = $pdo->prepare('SELECT fitid, bankAccountId FROM ofx_fitids WHERE cashMoveId = ? LIMIT 1');
    $stmt->execute([$cashMoveId]);
    $fitidRow = $stmt->fetch() ?: null;
    // Detector: similares e sem forcar -> devolve a lista SEM criar (nunca bloqueia).
    if (empty($payload['forcar'])) {
        $candidatos = titulos_similares($pdo, $plano['table'], (float) $plano['titulo']['amount'], (string) $movimento['date']);
        if ($candidatos) {
            $parteId = $payload['parteId'] ?? null;
            return ['ok' => true, 'criada' => false,
                'similares' => titulos_similares_classificar($candidatos, $parteId),
                'fitid' => $fitidRow['fitid'] ?? null,
                'bankAccountId' => isset($fitidRow['bankAccountId']) ? (int) $fitidRow['bankAccountId'] : null,
                'table' => $plano['table']];
        }
    }
    $pdo->beginTransaction();
    try {
        $titulo = $plano['titulo'];
        if (!empty($fitidRow['fitid'])) {
            $titulo['ofxFitid'] = $fitidRow['fitid'];
        }
        $tituloId = (int) insert_dynamic($pdo, $plano['table'], $titulo);
        $up = $plano['movimentoUpdate'];
        $pdo->prepare('UPDATE cash_bank_movements
                SET referencia_tipo = ?, referencia_id = ?, categoryId = ?, costCenterId = ?, projectId = ?, status = ?
              WHERE id = ?')
            ->execute([$plano['refTipo'], $tituloId, $up['categoryId'], $up['costCenterId'], $up['projectId'], $up['status'], $cashMoveId]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($error instanceof PDOException && (string) $error->getCode() === '23000') {
            return ['ok' => false, 'status' => 409, 'motivo' => 'Esta transação do extrato já está vinculada a um título.'];
        }
        error_log('[ObraSync OFX][ref ' . obra_error_ref() . '] Aprovação de movimento falhou: ' . $error->getMessage());
        return ['ok' => false, 'status' => 500, 'motivo' => 'Erro ao aprovar. Nada foi gravado — tente novamente.'];
    }
    server_audit($pdo, $authUser, 'update', 'cashMoves', $cashMoveId,
        'Aprovação: movimento #' . $cashMoveId . ' → conta ' . $titulo['document'] . ' (' . $plano['titulo']['status'] . ') · categoria ' . $up['categoryId'] . ' · centro ' . $up['costCenterId'] . ($up['projectId'] ? ' · obra ' . $up['projectId'] : ''));
    return ['ok' => true, 'criada' => true, 'tituloId' => $tituloId, 'table' => $plano['table'], 'document' => $titulo['document']];
}

function handle_cash_move_aprovar(PDO $pdo, array $authUser, array $payload): never
{
    ensure_ofx_tables($pdo);
    $r = cash_move_aprovar_executar($pdo, $authUser, $payload);
    if (empty($r['ok'])) {
        fail((string) $r['motivo'], (int) $r['status']);
    }
    unset($r['ok']);
    respond(['ok' => true, 'data' => $r, 'message' => !empty($r['criada'])
        ? 'Conta ' . $r['document'] . ' criada e movimento classificado.'
        : 'Há título(s) parecido(s) — escolha vincular, criar mesmo assim ou cancelar.']);
}

// E3 — lote: dados comuns + um lado só; suspeita NÃO cria (volta para tratamento
// individual); cada item na própria transação (falha não derruba o lote).
function handle_cash_move_aprovar_lote(PDO $pdo, array $authUser, array $payload): never
{
    ensure_ofx_tables($pdo);
    $itens = is_array($payload['itens'] ?? null) ? array_values(array_filter(array_map('intval', $payload['itens']))) : [];
    $dados = is_array($payload['dados'] ?? null) ? $payload['dados'] : [];
    if (!$itens) {
        fail('Selecione os movimentos a aprovar.', 400);
    }
    if (count($itens) > 50) {
        fail('Máximo de 50 aprovações por chamada — divida o restante na próxima.', 422);
    }
    // Um lado só: fornecedor e cliente não se misturam no mesmo lote.
    $ph = implode(',', array_fill(0, count($itens), '?'));
    $tipos = $pdo->prepare("SELECT DISTINCT `type` FROM cash_bank_movements WHERE id IN ({$ph})");
    $tipos->execute($itens);
    $lados = $tipos->fetchAll(PDO::FETCH_COLUMN);
    if (count($lados) !== 1 || !in_array($lados[0], ['Entrada', 'Saída'], true)) {
        fail('O lote deve conter movimentos de UM lado só (apenas Entradas ou apenas Saídas).', 422);
    }
    $criadas = 0;
    $suspeitas = [];
    $falhas = [];
    foreach ($itens as $id) {
        try {
            $r = cash_move_aprovar_executar($pdo, $authUser, [
                'cashMoveId' => $id,
                'categoryId' => $dados['categoryId'] ?? 0,
                'costCenterId' => $dados['costCenterId'] ?? 0,
                'projectId' => $dados['projectId'] ?? null,
                'parteId' => $dados['parteId'] ?? null,
            ]);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) { $pdo->rollBack(); }
            error_log('[ObraSync OFX][ref ' . obra_error_ref() . '] Lote de aprovação falhou num item: ' . $error->getMessage());
            $r = ['ok' => false, 'motivo' => 'Erro inesperado neste item — os demais seguiram.'];
        }
        if (!empty($r['ok']) && !empty($r['criada'])) {
            $criadas++;
        } elseif (!empty($r['ok']) && isset($r['similares'])) {
            $suspeitas[] = ['cashMoveId' => $id, 'similares' => $r['similares']];
        } else {
            $falhas[] = ['cashMoveId' => $id, 'motivo' => (string) ($r['motivo'] ?? 'Falha desconhecida.')];
        }
    }
    respond(['ok' => true, 'data' => ['criadas' => $criadas, 'suspeitas' => $suspeitas, 'falhas' => $falhas],
        'message' => $criadas . ' conta(s) criada(s)' . ($suspeitas ? ', ' . count($suspeitas) . ' com suspeita de duplicidade (trate individualmente)' : '') . ($falhas ? ', ' . count($falhas) . ' com aviso' : '') . '.']);
}

// E3 — dispensar/reativar: tira/devolve da fila SEM criar título. O movimento
// continua existindo e contando no saldo (o dinheiro se moveu de fato).
function handle_cash_move_dispensar(PDO $pdo, array $authUser, array $payload): never
{
    $cashMoveId = (int) ($payload['cashMoveId'] ?? 0);
    $reativar = !empty($payload['reativar']);
    if (!$cashMoveId) {
        fail('Informe o movimento.', 400);
    }
    $stmt = $pdo->prepare('SELECT id, status FROM cash_bank_movements WHERE id = ? LIMIT 1');
    $stmt->execute([$cashMoveId]);
    $movimento = $stmt->fetch();
    if (!$movimento) {
        fail('Movimento não encontrado.', 404);
    }
    $de = (string) $movimento['status'];
    $para = $reativar ? 'Pendente' : 'Dispensado';
    if ($reativar && $de !== 'Dispensado') {
        fail('Só movimento DISPENSADO pode ser reativado.', 422);
    }
    if (!$reativar && $de !== 'Pendente') {
        fail('Só movimento PENDENTE pode ser dispensado.', 422);
    }
    $pdo->prepare('UPDATE cash_bank_movements SET status = ? WHERE id = ?')->execute([$para, $cashMoveId]);
    server_audit($pdo, $authUser, 'update', 'cashMoves', $cashMoveId, 'status: ' . $de . '→' . $para . ' (fila de classificação)');
    respond(['ok' => true, 'data' => ['cashMoveId' => $cashMoveId, 'status' => $para],
        'message' => $reativar ? 'Movimento de volta à fila de pendentes.' : 'Movimento dispensado — fora da fila, segue no caixa.']);
}
```

- [ ] **Step 2: Rotas** — após o bloco `ofx-pendencias`:

```php
    if ($resource === 'cash-move-aprovar') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'cashMoves', 'edit');
        handle_cash_move_aprovar($pdo, $authUser, read_json());
    }
    if ($resource === 'cash-move-aprovar-lote') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'cashMoves', 'edit');
        handle_cash_move_aprovar_lote($pdo, $authUser, read_json());
    }
    if ($resource === 'cash-move-dispensar') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'cashMoves', 'edit');
        handle_cash_move_dispensar($pdo, $authUser, read_json());
    }
```

- [ ] **Step 3: Caronas (3 edições de 1 linha):**
  1. `handle_ofx_import` — o INSERT muda `'Confirmado'` → `'Pendente'` (comente: "E3: importado nasce pendente de classificação").
  2. `ofx_vincular_executar` — o UPDATE do movimento ganha `status = 'Confirmado'` no SET (vinculou → sai da fila do Caixa).
  3. `handle_ofx_pendencias` — o WHERE ganha `AND m.status <> 'Dispensado'` (dispensado sai das duas filas).

- [ ] **Step 4: Migration retroativa** — criar `migrations/2026-08-01-caixa-pendente-retroativo.sql` com o SQL da spec §5 (comentário incluído). **Não** adicionar em nenhum `ensure_*`.

- [ ] **Step 5: Validar** — `php -l`; suíte `21/21`.

- [ ] **Step 6: Commit**

```bash
git add api/index.php migrations/2026-08-01-caixa-pendente-retroativo.sql
git commit -m "feat(api): aprovacao de movimento pendente com detector de similares, lote e dispensar (E3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Front — botões na linha, painel de lote, modal com 3 saídas

**Files:**
- Modify: `app.js` — `extraRowActions` (branch cashMoves); `renderCrud` (painel + binder, molde do payable); bloco novo de funções (antes de `// ── Conciliação E2: aba Pendências`); ajuste do texto "sem título" na E2
- Modify: `styles.css` — estilos do painel (após o bloco da E2)

**Interfaces:**
- Consumes: os 3 endpoints da Task 2 + `ofx-vincular` (E1) para a saída "Vincular ao encontrado".
- Produces: `cashPendentesPanelHtml(rows)`, `setupCashAprovacao()`, `abrirCashAprovar(id)`, `confirmarCashAprovar(id, forcar)`, `cashAprovarSimilares(id, resp)`, `cashAprovarLote()`, `cashDispensar(id, reativar)`.

- [ ] **Step 1: `extraRowActions`** — acrescentar o branch (antes do branch de `suppliers`):

```js
  if (actionKey === "cashMoves") {
    if (row.status === "Pendente") return `<button class="primary" type="button" data-cash-aprovar="${row.id}">Aprovar</button><button class="secondary" type="button" data-cash-dispensar="${row.id}">Dispensar</button>`;
    if (row.status === "Dispensado") return `<button class="secondary" type="button" data-cash-reativar="${row.id}">Reativar</button>`;
    return "";
  }
```

- [ ] **Step 2: `renderCrud`** — no template: `${key === "cashMoves" ? cashPendentesPanelHtml(rows) : ""}` (na linha seguinte ao painel do payable); no fim: `if (key === "cashMoves") setupCashAprovacao();`.

- [ ] **Step 3: Bloco de funções** (inserir antes de `// ── Conciliação E2: aba Pendências`):

```js
// ── Conciliação E3: aprovação de movimentos pendentes (tela de Caixa) ────────
// Movimento de extrato nasce Pendente; aprovar (categoria+centro obrigatórios,
// obra OPCIONAL) cria a conta JÁ LIQUIDADA com o vínculo/dedup da E1. Lote de um
// lado só (fornecedor×cliente não se misturam). Detector de similares antes de
// criar — nunca bloqueia: vincular ao encontrado / criar mesmo assim / cancelar.
function cashPendentesPanelHtml(rows) {
  const pendentes = rows.filter((r) => r.status === "Pendente");
  if (!pendentes.length) return "";
  const opt = (lista) => (lista || []).map((r) => `<option value="${Number(r.id) || svgText(r.id)}">${svgText(r.name)}</option>`).join("");
  return `
    <section class="cash-pend-panel">
      <header><h3>Pendentes de classificação (${pendentes.length})</h3>
        <p>Marque os movimentos, preencha os dados comuns UMA vez e aprove — cada conta nasce com seu próprio valor e data. Lote de um lado só (Entradas OU Saídas).</p></header>
      <div class="cash-pend-lista">
        ${pendentes.map((m) => `
          <label class="cash-pend-item">
            <input type="checkbox" class="cash-pend-check" data-id="${m.id}" data-tipo="${svgText(m.type)}">
            <span>${asDate(m.date)} · ${svgText(m.type)} · ${moneySpan(m.amount)} — ${svgText(m.history || m.originDocument || "")}</span>
          </label>`).join("")}
      </div>
      <div class="cash-pend-form">
        <label>Categoria *<select id="cashLoteCategoria"><option value="">—</option>${opt(db.categories)}</select></label>
        <label>Centro de custo *<select id="cashLoteCentro"><option value="">—</option>${opt(db.costCenters)}</select></label>
        <label>Fornecedor (Saídas)<select id="cashLoteFornecedor"><option value="">—</option>${opt(db.suppliers)}</select></label>
        <label>Cliente (Entradas)<select id="cashLoteCliente"><option value="">—</option>${opt(db.clients)}</select></label>
        <label>Obra <small class="muted">(opcional)</small><select id="cashLoteObra"><option value="">—</option>${opt(db.projects)}</select></label>
        <button type="button" class="primary" id="cashLoteAprovar">Aprovar selecionados</button>
      </div>
      <dialog id="cashAprovarDialog" class="cash-aprovar-dialog"></dialog>
    </section>`;
}

function setupCashAprovacao() {
  qs("content").querySelectorAll("[data-cash-aprovar]").forEach((b) => b.addEventListener("click", () => abrirCashAprovar(b.dataset.cashAprovar)));
  qs("content").querySelectorAll("[data-cash-dispensar]").forEach((b) => b.addEventListener("click", () => cashDispensar(b.dataset.cashDispensar, false)));
  qs("content").querySelectorAll("[data-cash-reativar]").forEach((b) => b.addEventListener("click", () => cashDispensar(b.dataset.cashReativar, true)));
  qs("cashLoteAprovar")?.addEventListener("click", cashAprovarLote);
}

function abrirCashAprovar(id) {
  const m = byId("cashMoves", id);
  const dialog = qs("cashAprovarDialog");
  if (!m || !dialog) return;
  const isSaida = m.type === "Saída";
  const opt = (lista) => (lista || []).map((r) => `<option value="${Number(r.id) || svgText(r.id)}">${svgText(r.name)}</option>`).join("");
  dialog.innerHTML = `
    <h3>Aprovar movimento — criar a conta</h3>
    <p>${asDate(m.date)} · ${svgText(m.type)} · ${moneySpan(m.amount)}<br><small class="muted">${svgText(m.history || "")}</small></p>
    <label>Categoria financeira *<select id="cashApCategoria"><option value="">—</option>${opt(db.categories)}</select></label>
    <label>Centro de custo *<select id="cashApCentro"><option value="">—</option>${opt(db.costCenters)}</select></label>
    <label>${isSaida ? "Fornecedor" : "Cliente"} <small class="muted">(opcional)</small><select id="cashApParte"><option value="">—</option>${opt(isSaida ? db.suppliers : db.clients)}</select></label>
    <label>Obra/Projeto <small class="muted">(opcional — despesa geral fica sem obra)</small><select id="cashApObra"><option value="">—</option>${opt(db.projects)}</select></label>
    <div class="row-actions">
      <button type="button" class="primary" id="cashApOk">Aprovar e criar a conta</button>
      <button type="button" class="secondary" id="cashApCancelar">Cancelar</button>
    </div>`;
  dialog.querySelector("#cashApCancelar").addEventListener("click", () => dialog.close());
  dialog.querySelector("#cashApOk").addEventListener("click", () => confirmarCashAprovar(id, false));
  dialog.showModal();
}

async function confirmarCashAprovar(id, forcar) {
  const dialog = qs("cashAprovarDialog");
  const body = {
    cashMoveId: Number(id),
    categoryId: Number(dialog.querySelector("#cashApCategoria")?.value || 0),
    costCenterId: Number(dialog.querySelector("#cashApCentro")?.value || 0),
    forcar: Boolean(forcar),
  };
  if (!body.categoryId || !body.costCenterId) return showToast("Categoria e centro de custo são obrigatórios.", { severity: "warning" });
  const parte = dialog.querySelector("#cashApParte")?.value;
  const obra = dialog.querySelector("#cashApObra")?.value;
  if (parte) body.parteId = Number(parte);
  if (obra) body.projectId = Number(obra);
  try {
    const payload = await apiRequest("cash-move-aprovar", { method: "POST", body: JSON.stringify(body) });
    if (payload.data?.criada) {
      dialog.close();
      showToast(payload.message || "Conta criada.", { severity: "success" });
      if (serverMode) await refreshAndRender(); else render();
      return;
    }
    cashAprovarSimilares(id, body, payload.data || {});
  } catch (error) {
    showToast(error.message, { severity: "warning" });
  }
}

function cashAprovarSimilares(id, body, data) {
  const dialog = qs("cashAprovarDialog");
  const similares = data.similares || [];
  const linhas = similares.map((s) => `<li>${s.suspeita === "alta" ? "🔴" : "🟡"} ${svgText(s.document)} · venc. ${asDate(s.dueDate)} · ${moneySpan(s.amount)} <small class="muted">(${svgText(s.status)})</small></li>`).join("");
  const podeVincular = Boolean(data.fitid) && similares.length;
  dialog.innerHTML = `
    <h3>Já existe título parecido</h3>
    <p>Mesmo valor e vencimento próximo — pode ser a MESMA conta lançada à mão:</p>
    <ul class="cash-similares">${linhas}</ul>
    <div class="row-actions">
      ${podeVincular ? '<button type="button" class="primary" id="cashSimVincular">Vincular ao primeiro da lista</button>' : ""}
      <button type="button" class="secondary" id="cashSimCriar">Criar mesmo assim</button>
      <button type="button" class="secondary" id="cashSimCancelar">Cancelar</button>
    </div>`;
  dialog.querySelector("#cashSimCancelar").addEventListener("click", () => dialog.close());
  dialog.querySelector("#cashSimCriar").addEventListener("click", () => { abrirCashAprovarComForcar(id, body); });
  if (podeVincular) {
    dialog.querySelector("#cashSimVincular").addEventListener("click", async () => {
      try {
        const payload = await apiRequest("ofx-vincular", { method: "POST", body: JSON.stringify({
          fitid: data.fitid, bankAccountId: Number(data.bankAccountId), table: data.table, recordId: Number(similares[0].id),
        }) });
        dialog.close();
        showToast(payload.message || "Vinculado ao título existente.", { severity: "success" });
        if (serverMode) await refreshAndRender(); else render();
      } catch (error) {
        showToast(error.message, { severity: "warning" });
      }
    });
  }
}

async function abrirCashAprovarComForcar(id, body) {
  const dialog = qs("cashAprovarDialog");
  try {
    const payload = await apiRequest("cash-move-aprovar", { method: "POST", body: JSON.stringify({ ...body, forcar: true }) });
    dialog.close();
    showToast(payload.message || "Conta criada.", { severity: "success" });
    if (serverMode) await refreshAndRender(); else render();
  } catch (error) {
    showToast(error.message, { severity: "warning" });
  }
}

async function cashAprovarLote() {
  const checks = [...qs("content").querySelectorAll(".cash-pend-check:checked")];
  if (!checks.length) return showToast("Marque ao menos um movimento pendente.", { severity: "warning" });
  const tipos = new Set(checks.map((c) => c.dataset.tipo));
  if (tipos.size > 1) return showToast("O lote deve ser de UM lado só — apenas Entradas ou apenas Saídas.", { severity: "warning" });
  const isSaida = tipos.has("Saída");
  const dados = {
    categoryId: Number(qs("cashLoteCategoria")?.value || 0),
    costCenterId: Number(qs("cashLoteCentro")?.value || 0),
  };
  if (!dados.categoryId || !dados.costCenterId) return showToast("Categoria e centro de custo são obrigatórios.", { severity: "warning" });
  const parte = isSaida ? qs("cashLoteFornecedor")?.value : qs("cashLoteCliente")?.value;
  const obra = qs("cashLoteObra")?.value;
  if (parte) dados.parteId = Number(parte);
  if (obra) dados.projectId = Number(obra);
  const ids = checks.map((c) => Number(c.dataset.id));
  const btn = qs("cashLoteAprovar");
  if (btn) { btn.disabled = true; btn.textContent = "Aprovando…"; }
  try {
    let criadas = 0;
    const suspeitas = [];
    const falhas = [];
    for (let i = 0; i < ids.length; i += 50) {
      const payload = await apiRequest("cash-move-aprovar-lote", { method: "POST", body: JSON.stringify({ itens: ids.slice(i, i + 50), dados }) });
      criadas += Number(payload.data?.criadas || 0);
      suspeitas.push(...(payload.data?.suspeitas || []));
      falhas.push(...(payload.data?.falhas || []));
    }
    const partes = [`${criadas} conta(s) criada(s)`];
    if (suspeitas.length) partes.push(`${suspeitas.length} com suspeita de duplicidade — trate uma a uma pelo botão Aprovar`);
    if (falhas.length) partes.push(`${falhas.length} com aviso`);
    showToast(partes.join(" · "), { severity: suspeitas.length || falhas.length ? "warning" : "success" });
    if (falhas.length) console.warn("[Caixa lote] avisos:", falhas);
    if (serverMode) await refreshAndRender(); else render();
  } catch (error) {
    showToast(`Falha no lote: ${error.message}`, { severity: "error" });
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Aprovar selecionados"; }
  }
}

async function cashDispensar(id, reativar) {
  try {
    const payload = await apiRequest("cash-move-dispensar", { method: "POST", body: JSON.stringify({ cashMoveId: Number(id), reativar: Boolean(reativar) }) });
    showToast(payload.message || "Ok.", { severity: "success" });
    if (serverMode) await refreshAndRender(); else render();
  } catch (error) {
    showToast(error.message, { severity: "warning" });
  }
}
```

- [ ] **Step 4: E2 aponta para cá** — em `ofxPendLinhaHtml`, trocar o texto do bucket sem match:
`'<span class="muted">Sem título compatível — criar conta chega na Etapa 3</span>'` →
`'<span class="muted">Sem título compatível — classifique e crie em Movimentações de caixa (Aprovar)</span>'`.

- [ ] **Step 5: CSS** — após os estilos da E2 em `styles.css`:

```css
/* Conciliação E3 — painel de pendentes no Caixa */
.cash-pend-panel {
  border: 1px dashed rgba(148, 108, 32, 0.5);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 14px;
}

.cash-pend-lista {
  max-height: 260px;
  overflow-y: auto;
  display: grid;
  gap: 4px;
  margin: 10px 0;
}

.cash-pend-item {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 13px;
}

.cash-pend-form {
  display: flex;
  gap: 10px;
  align-items: end;
  flex-wrap: wrap;
}

.cash-similares {
  margin: 8px 0 12px 18px;
}

.cash-aprovar-dialog {
  min-width: min(480px, 92vw);
}

.cash-aprovar-dialog label {
  display: block;
  margin: 10px 0;
}
```

- [ ] **Step 6: Validar** — `node --check app.js`; suíte `21/21` (guardas de privacidade verdes).

- [ ] **Step 7: Commit**

```bash
git add app.js styles.css
git commit -m "feat(ui): aprovacao de movimentos pendentes no caixa - linha, lote, similares e dispensar (E3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Release v1.44.0

**Files:** `app.js` (versão/data/changelog primeira posição), `index.html` (`?v=1813`→`1814`), `CLAUDE.md` (versão + bloco acima do v1.43.0 + linha de cache), `README.md` (header + entrada + bullet + cache), `STATUS.md` (linha 3).

- [ ] **Step 1: changelog** (primeira posição do `APP_CHANGELOG`):

```js
  "Caixa — aprovação de movimentos pendentes (Conciliação, etapa 3 de 4): os movimentos importados do extrato agora nascem PENDENTES de classificação e ganham botões próprios na tela de Movimentações: APROVAR abre a classificação (categoria e centro de custo obrigatórios; obra, fornecedor/cliente opcionais) e cria a conta a pagar/receber JÁ LIQUIDADA, com vínculo completo ao movimento — o custo realizado conta uma vez só. Painel de LOTE: marque vários movimentos do mesmo lado, preencha os dados comuns uma vez e aprove todos (dez tarifas do mês viram dez contas com um clique). Antes de criar, o sistema procura títulos parecidos (mesmo valor, vencimento próximo) e oferece: vincular ao existente, criar mesmo assim ou cancelar — no lote, as suspeitas são separadas para tratamento individual. DISPENSAR tira da fila o que não vira conta (transferências entre contas próprias) sem mexer no saldo — e é reversível. Migration retroativa opcional coloca os ~243 movimentos históricos na fila (2026-08-01-caixa-pendente-retroativo.sql, rodar com backup). O saldo de caixa NÃO muda: pendente é sobre classificação, não sobre existência do dinheiro (v1.44.0).",
```

- [ ] **Step 2: bloco do CLAUDE.md** (acima do v1.43.0):

```markdown
> **v1.44.0 — Conciliação E3 (aprovação de pendentes no Caixa — substitui a E3 original):** movimento OFX nasce **`status='Pendente'`** (VARCHAR, zero ALTER; `handle_ofx_import` mudou o literal); NADA no sistema filtra movimento por status — pendente CONTA no saldo (classificação ≠ existência). **`cash_move_aprovar_plano()`** (pura: Pendente+categoria*+centro* → plano do título `MOV-<id>` já liquidado, `valor_original`/`juros` NULOS, obra/parte OPCIONAIS; Transferência → orienta Dispensar) + **`cash_move_aprovar_executar()`** (guarda `ofx_movimento_livre` com recordId 0, detector ANTES de criar — similares sem `forcar` devolvem lista SEM criar —, transação única: `insert_dynamic` + UPDATE do movimento com referência/classificação/`Confirmado`; 23000→409). **`titulos_similares()`** (SQL: valor exato + `DATEDIFF<=5`, sem fitid) + **`titulos_similares_classificar()`** (pura: mesma parte=alta). Endpoints **`cash-move-aprovar`**, **`-aprovar-lote`** (máx 50, UM lado só, suspeitas separadas, item na própria transação) e **`-dispensar`** (Pendente↔Dispensado, reversível, auditado). Caronas: `ofx_vincular_executar` confirma o movimento (sai da fila); fila E2 exclui `Dispensado`; bucket "sem título" da E2 aponta para o Caixa. Front no `renderCrud` (molde payableGroupsPanel): `extraRowActions` cashMoves (Aprovar/Dispensar/Reativar), `cashPendentesPanelHtml` (lote), modal com 3 saídas (vincular usa `ofx-vincular` da E1). **Migration retroativa `2026-08-01-caixa-pendente-retroativo.sql` = MUDANÇA DE DADO — rodar SÓ com backup, esperado ≈243; NÃO entra em ensure_***. Testes `test_cash_aprovar_plano.php` (19) e `test_titulos_similares.php` (6); suíte 21/21. Cache `?v=1814`.
```

- [ ] **Step 3:** README (header + entrada no molde + bullet versão + cache), STATUS.md linha 3.

- [ ] **Step 4:** `php -l && node --check && bash scripts/tests/run-all.sh` → `SUITE: 21/21 blocos ok`.

- [ ] **Step 5: Commit**

```bash
git add app.js index.html README.md CLAUDE.md STATUS.md
git commit -m "chore: release v1.44.0 (conciliacao etapa 3 - aprovacao de movimentos pendentes no caixa)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Validação em produção (roteiro do dono — espelha a spec §8)

1. Deploy + **backup** + rodar `migrations/2026-08-01-caixa-pendente-retroativo.sql` → conferir ≈243 linhas afetadas; Ctrl+Shift+R → v1.44.0.
2. Caixa: painel "Pendentes de classificação (≈243)"; #4 e #150 FORA (status Confirmado).
3. Aprovar UMA tarifa (categoria+centro) → conta `MOV-<id>` Pago criada; movimento Confirmado com referência; custo realizado conta 1x.
4. LOTE: 5 tarifas iguais → classificar uma vez → 5 contas.
5. Aprovar movimento com título parecido → 3 saídas; "Vincular ao primeiro" → baixa via E1.
6. Dispensar uma transferência → sai das filas (Caixa e E2), saldo intacto; Reativar → volta.
7. Obra marcada numa aprovação → valor no dashboard por obra.
8. Auditoria com antes→depois em cada passo.
