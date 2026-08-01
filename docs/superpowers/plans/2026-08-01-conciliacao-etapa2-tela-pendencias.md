# Conciliação Etapa 2 — Tela de pendências Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fila de 244 pendências ordenada por relevância, com vincular individual (obra opcional), vínculo em lote das altas e desfazer — sobre o motor endurecido (guarda do fluxo manual + UNIQUE no fitid).

**Architecture:** Backend: guarda pura `ofx_movimento_livre` no vincular; refactor do handler em `ofx_vincular_executar` (reusado pelo lote); `GET ofx-pendencias` com match SET-BASED (2 consultas numéricas) + confiança/bucket/ordenação em funções puras; migration UNIQUE. Front: aba "Pendências" na Conciliação com endpoint paginado próprio (fora do bootstrap).

**Tech Stack:** PHP 8 (`api/index.php`), JS vanilla (`app.js`), harness PHP sem banco.

**Spec:** `docs/superpowers/specs/2026-08-01-conciliacao-etapa2-tela-pendencias-design.md`

## Global Constraints

- LF; `php -l` + `node --check`; suíte `bash scripts/tests/run-all.sh` (auto-descobre).
- **COLLATION:** o ÚNICO JOIN texto×texto permitido é o da listagem de pendências, com `COLLATE utf8mb4_unicode_ci` explícito no lado `f.fitid`. Todo o resto: coluna×parâmetro ou JOIN numérico.
- Commit local por task, pt sem acento + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. NUNCA push. Nada de `.superpowers/`/`.claude/`.
- Front: R$ só via `moneySpan`; texto dinâmico via `escapeHtml`/`svgText`; nunca `alert()` novo (toast com severidade); nunca `.catch(() => {})`; IDs de DOM únicos; listeners via `addEventListener` (CSP).
- Fora de escopo: criar conta (E3), detector (E4), valor diferente, merge manual×OFX.

---

### Task 1: Endurecimento do motor — guarda + ORDER BY + UNIQUE (+ teste)

**Files:**
- Modify: `api/index.php` — função pura nova (após `ofx_vinculo_plano`); `handle_ofx_vincular` (guarda); `handle_ofx_desvincular` (ORDER BY); `ensure_ofx_tables` (UNIQUE guardado)
- Create: `migrations/2026-08-01-ofx-fitid-unique.sql`
- Test: `scripts/tests/php/test_ofx_movimento_livre.php`

**Interfaces:**
- Produces: `ofx_movimento_livre(array $movimento, ?array $tituloDaReferencia, int $recordId, bool $isPayable): ?string` (null = movimento livre; string = motivo de 409). Task 2 preserva a guarda no refactor.

- [ ] **Step 1: Teste que falha** — criar `scripts/tests/php/test_ofx_movimento_livre.php`:

```php
<?php
// E2: guarda do vínculo — um movimento já reivindicado por OUTRO título vivo não
// pode ser vinculado de novo (o fluxo manual legado gravava referência sem fitid;
// caso real: movimento #4 → CONTA_PAGAR título 1). Referência órfã ou do próprio
// título é livre. CAIXA_MANUAL no movimento não é reivindicação de baixa.
require __DIR__ . '/harness.php';

$livre = ['referencia_tipo' => null, 'referencia_id' => null];
t_assert(ofx_movimento_livre($livre, null, 10, true) === null, 'sem referencia -> livre');

$manual = ['referencia_tipo' => 'CAIXA_MANUAL', 'referencia_id' => 3];
t_assert(ofx_movimento_livre($manual, null, 10, true) === null, 'CAIXA_MANUAL no movimento -> livre');

$claimPagar = ['referencia_tipo' => 'CONTA_PAGAR', 'referencia_id' => 1];
$m = ofx_movimento_livre($claimPagar, ['id' => 1, 'document' => 'NF-778'], 10, true);
t_assert(is_string($m) && str_contains($m, 'NF-778'), 'referencia viva de OUTRO titulo -> recusa citando o documento');

t_assert(ofx_movimento_livre($claimPagar, null, 10, true) === null, 'referencia orfa (titulo apagado) -> livre');

t_assert(ofx_movimento_livre($claimPagar, ['id' => 1, 'document' => 'NF-778'], 1, true) === null, 'proprio titulo (mesmo lado) -> livre (revincular idempotente)');

$m = ofx_movimento_livre($claimPagar, ['id' => 1, 'document' => 'NF-778'], 1, false);
t_assert(is_string($m), 'mesmo id mas lado RECEBER -> recusa (nao e o mesmo titulo)');

$claimReceber = ['referencia_tipo' => 'CONTA_RECEBER', 'referencia_id' => 9];
$m = ofx_movimento_livre($claimReceber, ['id' => 9, 'document' => 'MARCO-2'], 4, false);
t_assert(is_string($m) && str_contains($m, 'MARCO-2'), 'CONTA_RECEBER viva de outro titulo -> recusa');

t_assert(ofx_movimento_livre(['referencia_tipo' => 'CONTA_PAGAR', 'referencia_id' => 0], null, 10, true) === null, 'referencia_id 0 -> livre');

$m = ofx_movimento_livre($claimPagar, ['id' => 1], 10, true);
t_assert(is_string($m) && str_contains($m, '#1'), 'titulo sem document -> cita #id');

t_assert(!preg_match('/SELECT|UPDATE|accounts_|cash_bank/i', (string) ofx_movimento_livre($claimPagar, ['id' => 1, 'document' => 'X'], 10, true)), 'motivo nao vaza SQL/tabela');

t_resumo('test_ofx_movimento_livre');
```

- [ ] **Step 2: RED** — `php scripts/tests/php/test_ofx_movimento_livre.php` → `Call to undefined function`.

- [ ] **Step 3: Implementar a pura** — em `api/index.php`, logo após o fechamento de `ofx_vinculo_plano`:

```php

// E2 — guarda do movimento: um movimento cuja referência aponta para OUTRO título
// vivo já representa uma baixa (fluxo manual legado gravava referência sem fitid).
// Pura: o handler busca o título da referência e ela decide. null = livre.
function ofx_movimento_livre(array $movimento, ?array $tituloDaReferencia, int $recordId, bool $isPayable): ?string
{
    $refTipo = (string) ($movimento['referencia_tipo'] ?? '');
    if (!in_array($refTipo, ['CONTA_PAGAR', 'CONTA_RECEBER'], true)) {
        return null; // sem referência de baixa (null/CAIXA_MANUAL): livre
    }
    $refId = (int) ($movimento['referencia_id'] ?? 0);
    if (!$refId || $tituloDaReferencia === null) {
        return null; // referência órfã: pode ser sobrescrita
    }
    if ($refId === $recordId && (($refTipo === 'CONTA_PAGAR') === $isPayable)) {
        return null; // o próprio título: revincular é inofensivo
    }
    $doc = trim((string) ($tituloDaReferencia['document'] ?? ''));
    return 'Esta transação já representa a baixa do título ' . ($doc !== '' ? $doc : ('#' . $refId))
        . ' — desfaça aquele vínculo antes de vincular outro.';
}
```

- [ ] **Step 4: Ligar a guarda no `handle_ofx_vincular`** — logo APÓS o fetch de `$movimento` (e antes do fetch de `$titulo`), inserir:

```php
    // Guarda E2: movimento já reivindicado por outro título vivo (fluxo manual legado).
    $refTipoMov = (string) ($movimento['referencia_tipo'] ?? '');
    $tituloRef = null;
    if (in_array($refTipoMov, ['CONTA_PAGAR', 'CONTA_RECEBER'], true) && !empty($movimento['referencia_id'])) {
        $tabelaRef = $refTipoMov === 'CONTA_PAGAR' ? 'accounts_payable' : 'accounts_receivable';
        $stmt = $pdo->prepare("SELECT id, document FROM {$tabelaRef} WHERE id = ? LIMIT 1");
        $stmt->execute([(int) $movimento['referencia_id']]);
        $tituloRef = $stmt->fetch() ?: null;
    }
    $motivoOcupado = ofx_movimento_livre($movimento, $tituloRef, $recordId, $table === 'accounts_payable');
    if ($motivoOcupado !== null) {
        fail($motivoOcupado, 409);
    }
```

- [ ] **Step 5: ORDER BY determinístico no `handle_ofx_desvincular`** — trocar a consulta do lookup:

```php
// ANTES
$stmt = $pdo->prepare('SELECT id FROM cash_bank_movements WHERE referencia_tipo = ? AND referencia_id = ? LIMIT 1');
// DEPOIS (prefere o movimento do EXTRATO quando um manual e um OFX carregam a mesma referência)
$stmt = $pdo->prepare("SELECT id FROM cash_bank_movements WHERE referencia_tipo = ? AND referencia_id = ?
                        ORDER BY (originDocument LIKE 'OFX%') DESC, id DESC LIMIT 1");
```

- [ ] **Step 6: Migration + ensure** — criar `migrations/2026-08-01-ofx-fitid-unique.sql`:

```sql
-- E2: UNIQUE no vínculo OFX dos títulos — fecha a corrida de dois vínculos
-- simultâneos no mesmo FITID (TOCTOU do pré-check do ofx-vincular). UNIQUE aceita
-- múltiplos NULL: só valores preenchidos são únicos. O índice simples antigo
-- (idx_pay_fitid/idx_rec_fitid) permanece — migration só aditiva.
ALTER TABLE accounts_payable ADD UNIQUE INDEX IF NOT EXISTS uk_pay_fitid (ofxFitid);
ALTER TABLE accounts_receivable ADD UNIQUE INDEX IF NOT EXISTS uk_rec_fitid (ofxFitid);
```

E em `ensure_ofx_tables`, antes do `$done = true;`:

```php
    // UNIQUE no vínculo (E2) — checagem leve p/ não rodar DDL a cada request.
    try {
        $temUk = $pdo->query("SELECT 1 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts_payable'
              AND INDEX_NAME = 'uk_pay_fitid' LIMIT 1")->fetchColumn();
        if (!$temUk) {
            $pdo->exec('ALTER TABLE accounts_payable ADD UNIQUE INDEX IF NOT EXISTS uk_pay_fitid (ofxFitid)');
            $pdo->exec('ALTER TABLE accounts_receivable ADD UNIQUE INDEX IF NOT EXISTS uk_rec_fitid (ofxFitid)');
        }
    } catch (Throwable $error) {
        error_log('[ObraSync OFX] ensure UNIQUE ofxFitid: ' . $error->getMessage());
    }
```

- [ ] **Step 7: GREEN + suíte** — `php -l api/index.php && php scripts/tests/php/test_ofx_movimento_livre.php` → `10/10 ok`; `bash scripts/tests/run-all.sh` → `SUITE: 18/18 blocos ok`.

- [ ] **Step 8: Commit**

```bash
git add api/index.php migrations/2026-08-01-ofx-fitid-unique.sql scripts/tests/php/test_ofx_movimento_livre.php
git commit -m "feat(api): guarda do fluxo manual no vinculo OFX, desvincular deterministico e UNIQUE no fitid (E2)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend da fila — refactor `executar`, lote e `ofx-pendencias` (+ teste)

**Files:**
- Modify: `api/index.php` — rotas novas; refactor `handle_ofx_vincular`→`ofx_vincular_executar`; `ofx_find_matches` usa a confiança compartilhada; funções puras + 2 handlers novos
- Test: `scripts/tests/php/test_ofx_pendencias.php`

**Interfaces:**
- Produces: `ofx_match_confianca(int $daysDiff, bool $jaBaixado, bool $contaDiverge): int`; `ofx_pendencia_bucket(array $matches): string`; `ofx_pendencias_ordenar(array $rows): array`; `ofx_vincular_executar(PDO, array $authUser, array $args): array` (`['ok'=>true, 'recordId', 'table', 'status', 'linkedOnly', 'cashMoveId']` ou `['ok'=>false, 'status'=>4xx|500, 'motivo'=>string]`); `GET ofx-pendencias`; `POST ofx-vincular-lote`. A Task 3 consome os 3 endpoints.

- [ ] **Step 1: Teste que falha** — criar `scripts/tests/php/test_ofx_pendencias.php`:

```php
<?php
// E2: as puras da fila de pendências — confiança (mesma tabela de descontos da
// prévia), bucket de relevância e ordenação global (alta → média → sem; confiança
// e data desc dentro do bucket). A régua ≥85 é a MESMA do autoMatch da prévia.
require __DIR__ . '/harness.php';

t_assert(ofx_match_confianca(0, false, false) === 100, 'dia 0 -> 100');
t_assert(ofx_match_confianca(1, false, false) === 100, 'dia 1 -> 100 (desconto so acima de 1)');
t_assert(ofx_match_confianca(3, false, false) === 85, '3 dias -> 85');
t_assert(ofx_match_confianca(0, true, false) === 80, 'ja baixado -> -20');
t_assert(ofx_match_confianca(0, false, true) === 85, 'conta divergente -> -15');
t_assert(ofx_match_confianca(5, true, true) === 40, 'combinado 5d+baixado+diverge -> 40');
t_assert(ofx_match_confianca(30, true, true) === 0, 'piso zero');

t_assert(ofx_pendencia_bucket([]) === 'sem', 'sem matches -> sem');
t_assert(ofx_pendencia_bucket([['confidence' => 85]]) === 'alta', 'melhor >=85 -> alta');
t_assert(ofx_pendencia_bucket([['confidence' => 84]]) === 'media', 'melhor 84 -> media');

$rows = [
    ['fitid' => 'S', 'date' => '2026-07-30', 'bucket' => 'sem', 'matches' => []],
    ['fitid' => 'M', 'date' => '2026-07-10', 'bucket' => 'media', 'matches' => [['confidence' => 70]]],
    ['fitid' => 'A1', 'date' => '2026-07-01', 'bucket' => 'alta', 'matches' => [['confidence' => 90]]],
    ['fitid' => 'A2', 'date' => '2026-07-20', 'bucket' => 'alta', 'matches' => [['confidence' => 100]]],
];
$ordenado = array_column(ofx_pendencias_ordenar($rows), 'fitid');
t_assert($ordenado === ['A2', 'A1', 'M', 'S'], 'alta(conf desc) -> media -> sem');

$rows2 = [
    ['fitid' => 'B', 'date' => '2026-07-01', 'bucket' => 'alta', 'matches' => [['confidence' => 90]]],
    ['fitid' => 'C', 'date' => '2026-07-15', 'bucket' => 'alta', 'matches' => [['confidence' => 90]]],
];
t_assert(array_column(ofx_pendencias_ordenar($rows2), 'fitid') === ['C', 'B'], 'empate de confianca -> data mais recente primeiro');

t_resumo('test_ofx_pendencias');
```

- [ ] **Step 2: RED** — `php scripts/tests/php/test_ofx_pendencias.php` → undefined function.

- [ ] **Step 3: Puras** — após `ofx_movimento_livre`:

```php

// E2 — confiança do match (compartilhada entre a prévia e a fila de pendências):
// 100, −5/dia além do 1º, −20 título já baixado, −15 conta bancária divergente.
function ofx_match_confianca(int $daysDiff, bool $jaBaixado, bool $contaDiverge): int
{
    $confianca = 100;
    if ($daysDiff > 1) $confianca -= $daysDiff * 5;
    if ($jaBaixado) $confianca -= 20;
    if ($contaDiverge) $confianca -= 15;
    return max(0, $confianca);
}

// E2 — bucket de relevância da fila: alta (≥85, um clique — mesma régua do
// autoMatch da prévia), média (tem match abaixo), sem (exige criar título, E3).
function ofx_pendencia_bucket(array $matches): string
{
    if (!$matches) return 'sem';
    return ((int) ($matches[0]['confidence'] ?? 0)) >= 85 ? 'alta' : 'media';
}

// E2 — ordenação global da fila: a tela é FILA DE TRABALHO, não extrato
// cronológico (decisão do dono). Dentro do bucket: confiança desc, data desc.
function ofx_pendencias_ordenar(array $rows): array
{
    $peso = ['alta' => 0, 'media' => 1, 'sem' => 2];
    usort($rows, static function (array $a, array $b) use ($peso): int {
        $cmp = ($peso[$a['bucket']] ?? 9) <=> ($peso[$b['bucket']] ?? 9);
        if ($cmp !== 0) return $cmp;
        $cmp = ((int) ($b['matches'][0]['confidence'] ?? 0)) <=> ((int) ($a['matches'][0]['confidence'] ?? 0));
        if ($cmp !== 0) return $cmp;
        return strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? ''));
    });
    return $rows;
}
```

- [ ] **Step 4: `ofx_find_matches` passa a usar a confiança compartilhada** — substituir o bloco de cálculo dentro do foreach (as 4 linhas `$confidence = 100; if...`) por:

```php
        $confidence = ofx_match_confianca($daysDiff, $alreadyPaid,
            $bankName !== '' && !empty($row['bankAccount']) && $row['bankAccount'] !== $bankName);
```

(E remover a linha `'confidence' => max(0, $confidence),` trocando por `'confidence' => $confidence,` — o piso já vem da função.)

- [ ] **Step 5: Refactor `handle_ofx_vincular` → `ofx_vincular_executar`** — o corpo inteiro do handler (validações, guarda E2, plano, transação, audit) vira:

```php
// E2 — núcleo do vínculo, reusado pelo individual e pelo lote. NUNCA chama
// fail()/respond(): devolve ['ok'=>true, ...] ou ['ok'=>false,'status','motivo'].
function ofx_vincular_executar(PDO $pdo, array $authUser, array $args): array
```

Regras mecânicas do refactor: cada `fail($msg, $code)` vira `return ['ok' => false, 'status' => $code, 'motivo' => $msg];`; o catch da transação vira `return ['ok' => false, 'status' => 500, 'motivo' => 'Erro ao vincular. Nada foi gravado — tente novamente.'];` (mantendo o `error_log` com `[ref]`); o `respond` final vira `return ['ok' => true, 'recordId' => ..., 'table' => ..., 'status' => ..., 'linkedOnly' => ..., 'cashMoveId' => ...];` (mesmos campos de `data`). O `server_audit` continua DENTRO do executar (após o commit). O handler encolhe para:

```php
function handle_ofx_vincular(PDO $pdo, array $authUser, array $payload): never
{
    $r = ofx_vincular_executar($pdo, $authUser, $payload);
    if (empty($r['ok'])) {
        fail((string) $r['motivo'], (int) $r['status']);
    }
    $linkedOnly = !empty($r['linkedOnly']);
    unset($r['ok']);
    respond(['ok' => true, 'data' => $r, 'message' => $linkedOnly
        ? 'Extrato vinculado ao título já baixado.'
        : 'Título baixado e vinculado à transação do extrato.']);
}
```

- [ ] **Step 6: Handler do lote** — após `handle_ofx_vincular`:

```php
// E2 — vínculo em LOTE das altas: cada item na SUA transação (falha individual
// não derruba o lote — molde do envio de fotos do RDO). Lote é herança pura:
// obra/categoria/centro vêm SEMPRE do título; obra diferente = modal individual.
function handle_ofx_vincular_lote(PDO $pdo, array $authUser, array $payload): never
{
    $itens = is_array($payload['itens'] ?? null) ? $payload['itens'] : [];
    if (!$itens) {
        fail('Informe as transações a vincular.', 400);
    }
    if (count($itens) > 50) {
        fail('Máximo de 50 vínculos por chamada — divida o restante na próxima.', 422);
    }
    $vinculadas = 0;
    $falhas = [];
    foreach ($itens as $item) {
        if (!is_array($item)) {
            continue;
        }
        $r = ofx_vincular_executar($pdo, $authUser, [
            'fitid' => $item['fitid'] ?? '',
            'bankAccountId' => $item['bankAccountId'] ?? 0,
            'table' => $item['table'] ?? '',
            'recordId' => $item['recordId'] ?? 0,
        ]);
        if (!empty($r['ok'])) {
            $vinculadas++;
        } else {
            $falhas[] = ['fitid' => (string) ($item['fitid'] ?? ''), 'motivo' => (string) ($r['motivo'] ?? 'Falha desconhecida.')];
        }
    }
    respond(['ok' => true, 'data' => ['vinculadas' => $vinculadas, 'falhas' => $falhas],
        'message' => $vinculadas . ' vinculada(s)' . ($falhas ? ', ' . count($falhas) . ' com aviso' : '') . '.']);
}
```

- [ ] **Step 7: Handler das pendências** — após o lote:

```php
// E2 — a fila de trabalho: transações importadas SEM título e SEM referência viva
// no movimento (aprendido com o movimento #4: referência viva = já representada).
// Match SET-BASED (JOIN numérico por valor) + confiança em PHP; ordenação global
// por relevância ANTES da paginação. Nunca entra no bootstrap.
function handle_ofx_pendencias(PDO $pdo): never
{
    ensure_ofx_tables($pdo);
    $bankAccountId = (int) ($_GET['bankAccountId'] ?? 0);
    $de = trim((string) ($_GET['de'] ?? ''));
    $ate = trim((string) ($_GET['ate'] ?? ''));
    $lado = (string) ($_GET['lado'] ?? '');
    $limit = min(50, max(1, (int) ($_GET['limit'] ?? 20)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));

    $filtros = '';
    $params = [];
    if ($bankAccountId) { $filtros .= ' AND f.bankAccountId = ?'; $params[] = $bankAccountId; }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $de)) { $filtros .= ' AND m.`date` >= ?'; $params[] = $de; }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $ate)) { $filtros .= ' AND m.`date` <= ?'; $params[] = $ate; }
    if (in_array($lado, ['Entrada', 'Saída'], true)) { $filtros .= ' AND m.`type` = ?'; $params[] = $lado; }

    // Único JOIN texto×texto da frente — COLLATE explícito (regra E1 §5-B; o lado
    // f.fitid é uca1400, os títulos são unicode_ci; vira no-op após a padronização).
    $stmt = $pdo->prepare(
        "SELECT f.fitid, f.bankAccountId, m.id AS cashMoveId, m.`date`, m.`type`, m.amount,
                m.history, b.name AS bankAccountName
           FROM ofx_fitids f
           JOIN cash_bank_movements m ON m.id = f.cashMoveId
           JOIN bank_accounts b ON b.id = f.bankAccountId
          WHERE NOT EXISTS (SELECT 1 FROM accounts_payable p WHERE p.ofxFitid = f.fitid COLLATE utf8mb4_unicode_ci)
            AND NOT EXISTS (SELECT 1 FROM accounts_receivable r WHERE r.ofxFitid = f.fitid COLLATE utf8mb4_unicode_ci)
            AND NOT (m.referencia_tipo = 'CONTA_PAGAR' AND EXISTS (SELECT 1 FROM accounts_payable p2 WHERE p2.id = m.referencia_id))
            AND NOT (m.referencia_tipo = 'CONTA_RECEBER' AND EXISTS (SELECT 1 FROM accounts_receivable r2 WHERE r2.id = m.referencia_id))
            {$filtros}
          ORDER BY m.`date` DESC, m.id DESC
          LIMIT 2000"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    if (count($rows) === 2000) {
        error_log('[ObraSync OFX] pendencias no teto de 2000 linhas — refine os filtros ou aumente a paginacao.');
    }

    // Match set-based: uma consulta por lado, JOIN numérico por valor (sem collation).
    $matchesPorMove = [];
    foreach ([['Saída', 'accounts_payable', 'Pago'], ['Entrada', 'accounts_receivable', 'Recebido']] as [$tipo, $tabela, $settled]) {
        $ids = [];
        foreach ($rows as $row) {
            if ($row['type'] === $tipo) $ids[] = (int) $row['cashMoveId'];
        }
        if (!$ids) continue;
        foreach (array_chunk($ids, 500) as $chunk) {
            $ph = implode(',', array_fill(0, count($chunk), '?'));
            $q = $pdo->prepare(
                "SELECT m.id AS moveId, t.id, t.document, t.dueDate, t.amount, t.status, t.bankAccount,
                        ABS(DATEDIFF(t.dueDate, m.`date`)) AS daysDiff
                   FROM cash_bank_movements m
                   JOIN {$tabela} t ON t.amount = m.amount
                  WHERE m.id IN ({$ph})
                    AND t.status <> 'Cancelado'
                    AND t.ofxFitid IS NULL
                    AND ABS(DATEDIFF(t.dueDate, m.`date`)) <= 5"
            );
            $q->execute($chunk);
            foreach ($q->fetchAll() as $c) {
                $matchesPorMove[(int) $c['moveId']][] = ['table' => $tabela, 'settled' => $settled] + $c;
            }
        }
    }

    $buckets = ['alta' => 0, 'media' => 0, 'sem' => 0];
    foreach ($rows as $i => $row) {
        $candidatos = $matchesPorMove[(int) $row['cashMoveId']] ?? [];
        $matches = [];
        foreach ($candidatos as $c) {
            $jaBaixado = $c['status'] === $c['settled'];
            $matches[] = [
                'table' => $c['table'],
                'id' => (int) $c['id'],
                'document' => (string) $c['document'],
                'dueDate' => (string) $c['dueDate'],
                'amount' => (float) $c['amount'],
                'status' => (string) $c['status'],
                'alreadyPaid' => $jaBaixado,
                'bankAccount' => (string) ($c['bankAccount'] ?? ''),
                'confidence' => ofx_match_confianca((int) $c['daysDiff'], $jaBaixado,
                    !empty($c['bankAccount']) && $c['bankAccount'] !== $row['bankAccountName']),
                'daysDiff' => (int) $c['daysDiff'],
            ];
        }
        usort($matches, static fn ($a, $b) => $b['confidence'] <=> $a['confidence']);
        $matches = array_slice($matches, 0, 5);
        $rows[$i]['amount'] = (float) $row['amount'];
        $rows[$i]['matches'] = $matches;
        $rows[$i]['autoMatch'] = ($matches && $matches[0]['confidence'] >= 85) ? $matches[0] : null;
        $rows[$i]['bucket'] = ofx_pendencia_bucket($matches);
        $buckets[$rows[$i]['bucket']]++;
    }
    $rows = ofx_pendencias_ordenar($rows);
    respond(['ok' => true, 'data' => [
        'rows' => array_slice($rows, $offset, $limit),
        'total' => count($rows),
        'buckets' => $buckets,
        'offset' => $offset,
        'limit' => $limit,
    ]]);
}
```

- [ ] **Step 8: Rotas** — após o bloco `ofx-desvincular`:

```php
    if ($resource === 'ofx-vincular-lote') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'reconciliation', 'edit');
        handle_ofx_vincular_lote($pdo, $authUser, read_json());
    }
    if ($resource === 'ofx-pendencias') {
        require_method($method, ['GET']);
        authorize_request($pdo, $authUser, 'reconciliation', 'view');
        handle_ofx_pendencias($pdo);
    }
```

- [ ] **Step 9: GREEN + suíte** — `php -l api/index.php && php scripts/tests/php/test_ofx_pendencias.php` → `12/12 ok`; `bash scripts/tests/run-all.sh` → `SUITE: 19/19 blocos ok`.

- [ ] **Step 10: Commit**

```bash
git add api/index.php scripts/tests/php/test_ofx_pendencias.php
git commit -m "feat(api): fila de pendencias OFX com match set-based e ordenacao por relevancia + vinculo em lote (E2)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Front — aba Pendências (lista, lote, modal com obra opcional, desfazer)

**Files:**
- Modify: `app.js` — `renderReconciliation` (abas) + bloco novo de funções da aba (inserir logo antes de `// ── Importação OFX ───` / `let ofxTransacoes`)
- Modify: `styles.css` — estilos da aba (após o bloco `.baixa-acrescimo-box`)

**Interfaces:**
- Consumes: `GET ofx-pendencias`, `POST ofx-vincular`, `POST ofx-vincular-lote`, `POST ofx-desvincular` (Task 2); helpers existentes `apiRequest`, `qs`, `showToast` (severidade), `moneySpan`, `escapeHtml`/`svgText`, `asDate`, `db.projects/categories/costCenters/bankAccounts/payable/receivable`, `sameId`, `canEditModule`.
- Produces: estado `ofxPend` + funções `carregarOfxPendencias`, `ofxPendBadgeConf`, `ofxPendLinhaHtml`, `abrirOfxVincular`, `confirmarOfxVincular`, `ofxVincularLoteSelecionadas`, `abrirOfxDesfazer`.

- [ ] **Step 1: Abas no `renderReconciliation`.** Logo após o `</section>` do `module-head` (que contém o botão `btnOfxOpen`), inserir a barra de abas, e embrulhar TODO o conteúdo atual restante (painel ofx + kpi grid + tabela resumo) num `<div id="reconResumoWrap" class="${reconTab === "pendencias" ? "hidden" : ""}">…</div>`, seguido do container novo:

```js
    <div class="recon-tabs">
      <button type="button" class="${reconTab === "pendencias" ? "secondary" : "primary"}" id="reconTabResumo">Resumo & Importação</button>
      <button type="button" class="${reconTab === "pendencias" ? "primary" : "secondary"}" id="reconTabPend">Pendências${ofxPend.total ? ` (${ofxPend.total})` : ""}</button>
    </div>
```

e, após o fechamento do `reconResumoWrap`:

```js
    <div id="reconPendWrap" class="${reconTab === "pendencias" ? "" : "hidden"}">${renderOfxPendencias()}</div>
    <dialog id="ofxPendDialog" class="ofx-pend-dialog"></dialog>
```

No fim do `renderReconciliation` (junto dos outros listeners):

```js
  qs("reconTabResumo")?.addEventListener("click", () => { reconTab = "resumo"; render(); });
  qs("reconTabPend")?.addEventListener("click", () => {
    reconTab = "pendencias";
    render();
    if (!ofxPend.rows.length && !ofxPend.carregando) carregarOfxPendencias(true);
  });
  bindOfxPendencias();
```

- [ ] **Step 2: Bloco novo de estado + funções** (inserir imediatamente ANTES do comentário `// ── Importação OFX ───`):

```js
// ── Conciliação E2: aba Pendências ──────────────────────────────────────────
// Fila de trabalho ORDENADA POR RELEVÂNCIA (alta → média → sem match) — decisão
// do dono: "a fila precisa me ajudar a trabalhar, não me fazer percorrer o
// extrato". Endpoint paginado próprio (nunca no bootstrap). Obra é OPCIONAL no
// vínculo; o lote é herança pura (obra diferente do título = modal individual).
let reconTab = "resumo";
let ofxPend = { rows: [], total: 0, buckets: { alta: 0, media: 0, sem: 0 }, offset: 0, limit: 20, filtros: { conta: "", de: "", ate: "", lado: "" }, carregando: false, selecionadas: new Set() };

async function carregarOfxPendencias(reset) {
  if (ofxPend.carregando) return;
  ofxPend.carregando = true;
  if (reset) { ofxPend.rows = []; ofxPend.offset = 0; ofxPend.selecionadas.clear(); }
  try {
    const f = ofxPend.filtros;
    const query = new URLSearchParams({ limit: String(ofxPend.limit), offset: String(ofxPend.offset) });
    if (f.conta) query.set("bankAccountId", f.conta);
    if (f.de) query.set("de", f.de);
    if (f.ate) query.set("ate", f.ate);
    if (f.lado) query.set("lado", f.lado);
    const payload = await apiRequest(`ofx-pendencias?${query.toString()}`);
    const data = payload.data || {};
    ofxPend.rows = ofxPend.offset ? ofxPend.rows.concat(data.rows || []) : (data.rows || []);
    ofxPend.total = Number(data.total || 0);
    ofxPend.buckets = data.buckets || { alta: 0, media: 0, sem: 0 };
  } catch (error) {
    showToast(`Não foi possível carregar as pendências: ${error.message}`, { severity: "error" });
  } finally {
    ofxPend.carregando = false;
    if (currentModule === "reconciliation") render();
  }
}

function ofxPendBadgeConf(confidence) {
  const cls = confidence >= 85 ? "ofx-badge-green" : confidence >= 60 ? "ofx-badge-yellow" : "ofx-badge-gray";
  return `<span class="ofx-badge ${cls}">${confidence}%</span>`;
}

function ofxPendLinhaHtml(row, index) {
  const melhor = row.matches?.[0];
  const sugestao = melhor
    ? `${svgText(melhor.document)} · venc. ${asDate(melhor.dueDate)} ${ofxPendBadgeConf(melhor.confidence)}${row.matches.length > 1 ? ` <small class="muted">+${row.matches.length - 1} alternativa(s)</small>` : ""}`
    : '<span class="muted">Sem título compatível — criar conta chega na Etapa 3</span>';
  const check = row.bucket === "alta"
    ? `<input type="checkbox" class="ofx-pend-check" data-idx="${index}" ${ofxPend.selecionadas.has(index) ? "checked" : ""}>`
    : "";
  const acoes = row.vinculada
    ? `<span class="ofx-badge ofx-badge-green">✔ vinculada</span> <button type="button" class="secondary ofx-pend-desfazer" data-idx="${index}">Desfazer</button>`
    : `<button type="button" class="primary ofx-pend-vincular" data-idx="${index}" ${row.matches?.length ? "" : "disabled title=\"Sem título compatível\""}>Vincular</button>`;
  return `<tr class="${row.vinculada ? "ofx-pend-ok" : ""}">
    <td>${check}</td>
    <td>${asDate(row.date)}</td>
    <td>${svgText(row.history || "")}<br><small class="muted">${svgText(row.bankAccountName || "")}</small></td>
    <td>${svgText(row.type)}</td>
    <td>${moneySpan(row.amount)}</td>
    <td>${sugestao}</td>
    <td>${acoes}</td>
  </tr>`;
}

function renderOfxPendencias() {
  const b = ofxPend.buckets;
  const contas = (db.bankAccounts || []).map((c) => `<option value="${Number(c.id) || svgText(c.id)}" ${sameId(c.id, ofxPend.filtros.conta) ? "selected" : ""}>${svgText(c.name)}</option>`).join("");
  const linhas = ofxPend.rows.map((row, i) => ofxPendLinhaHtml(row, i)).join("");
  const podeMais = ofxPend.rows.length < ofxPend.total;
  const selecionadas = ofxPend.selecionadas.size;
  return `
    <section class="ofx-pend-panel">
      <div class="ofx-pend-head">
        <span class="ofx-badge ofx-badge-green">⚡ ${b.alta} um clique</span>
        <span class="ofx-badge ofx-badge-yellow">🔍 ${b.media} para conferir</span>
        <span class="ofx-badge ofx-badge-gray">✍ ${b.sem} sem título</span>
        <span class="muted">${ofxPend.total} pendente(s) no filtro</span>
      </div>
      <div class="ofx-pend-filtros">
        <label>Conta<select id="ofxPendConta"><option value="">Todas</option>${contas}</select></label>
        <label>De<input type="date" id="ofxPendDe" value="${svgText(ofxPend.filtros.de)}"></label>
        <label>Até<input type="date" id="ofxPendAte" value="${svgText(ofxPend.filtros.ate)}"></label>
        <label>Lado<select id="ofxPendLado"><option value="">Ambos</option><option ${ofxPend.filtros.lado === "Entrada" ? "selected" : ""}>Entrada</option><option ${ofxPend.filtros.lado === "Saída" ? "selected" : ""}>Saída</option></select></label>
        <button type="button" class="secondary" id="ofxPendFiltrar">Filtrar</button>
        <button type="button" class="primary" id="ofxPendLote" ${selecionadas ? "" : "disabled"}>Vincular selecionadas (${selecionadas})</button>
      </div>
      ${ofxPend.carregando && !ofxPend.rows.length ? '<div class="empty">Carregando pendências…</div>' : ""}
      ${!ofxPend.carregando && !ofxPend.rows.length ? '<div class="empty">Nenhuma pendência no filtro — extrato conciliado. 🎉</div>' : ""}
      ${ofxPend.rows.length ? `<div class="table-wrap"><table class="ofx-pend-table">
        <thead><tr><th scope="col"></th><th scope="col">Data</th><th scope="col">Histórico</th><th scope="col">Tipo</th><th scope="col">Valor</th><th scope="col">Sugestão</th><th scope="col">Ações</th></tr></thead>
        <tbody>${linhas}</tbody></table></div>` : ""}
      ${podeMais ? `<button type="button" class="secondary" id="ofxPendMais">Carregar mais (${ofxPend.rows.length} de ${ofxPend.total})</button>` : ""}
    </section>`;
}

function bindOfxPendencias() {
  const wrap = qs("reconPendWrap");
  if (!wrap) return;
  qs("ofxPendFiltrar")?.addEventListener("click", () => {
    ofxPend.filtros = { conta: qs("ofxPendConta")?.value || "", de: qs("ofxPendDe")?.value || "", ate: qs("ofxPendAte")?.value || "", lado: qs("ofxPendLado")?.value || "" };
    carregarOfxPendencias(true);
  });
  qs("ofxPendMais")?.addEventListener("click", () => { ofxPend.offset = ofxPend.rows.length; carregarOfxPendencias(false); });
  qs("ofxPendLote")?.addEventListener("click", ofxVincularLoteSelecionadas);
  wrap.querySelectorAll(".ofx-pend-check").forEach((chk) => chk.addEventListener("change", () => {
    const idx = Number(chk.dataset.idx);
    if (chk.checked) ofxPend.selecionadas.add(idx); else ofxPend.selecionadas.delete(idx);
    render();
  }));
  wrap.querySelectorAll(".ofx-pend-vincular").forEach((btn) => btn.addEventListener("click", () => abrirOfxVincular(Number(btn.dataset.idx))));
  wrap.querySelectorAll(".ofx-pend-desfazer").forEach((btn) => btn.addEventListener("click", () => abrirOfxDesfazer(Number(btn.dataset.idx))));
}

function abrirOfxVincular(index) {
  const row = ofxPend.rows[index];
  if (!row) return;
  const dialog = qs("ofxPendDialog");
  const isSaida = row.type === "Saída";
  // Candidatos: matches do servidor + títulos ABERTOS do mesmo valor (mesmo lado).
  const colecao = isSaida ? (db.payable || []) : (db.receivable || []);
  const abertoStatus = isSaida ? "Pago" : "Recebido";
  const extras = colecao.filter((t) => Math.abs(Number(t.amount || 0) - Number(row.amount || 0)) < 0.005
    && t.status !== "Cancelado" && t.status !== abertoStatus && !t.ofxFitid
    && !(row.matches || []).some((m) => sameId(m.id, t.id)));
  const options = [
    ...(row.matches || []).map((m) => `<option value="${m.id}">${escapeHtml(`${m.document} · venc. ${asDate(m.dueDate)} · ${m.confidence}%${m.alreadyPaid ? " (já baixado)" : ""}`)}</option>`),
    ...extras.slice(0, 30).map((t) => `<option value="${t.id}">${escapeHtml(`${t.document || t.id} · venc. ${asDate(t.dueDate)} (mesmo valor)`)}</option>`),
  ].join("");
  const selects = (lista, id, rotulo) => `<label>${rotulo} <small class="muted">(opcional — herda do título se vazio)</small>
    <select id="${id}"><option value="">—</option>${(lista || []).map((r) => `<option value="${Number(r.id) || svgText(r.id)}">${svgText(r.name)}</option>`).join("")}</select></label>`;
  dialog.innerHTML = `
    <h3>Vincular transação ao título</h3>
    <p>${asDate(row.date)} · ${svgText(row.type)} · ${moneySpan(row.amount)}<br><small class="muted">${svgText(row.history || "")}</small></p>
    <label>Título ${isSaida ? "(contas a pagar)" : "(contas a receber)"}<select id="ofxVincTitulo">${options}</select></label>
    ${selects(db.projects, "ofxVincObra", "Obra/Projeto")}
    ${selects(db.categories, "ofxVincCategoria", "Categoria")}
    ${selects(db.costCenters, "ofxVincCentro", "Centro de custo")}
    <div class="row-actions">
      <button type="button" class="primary" id="ofxVincOk">Vincular</button>
      <button type="button" class="secondary" id="ofxVincCancelar">Cancelar</button>
    </div>`;
  dialog.querySelector("#ofxVincCancelar").addEventListener("click", () => dialog.close());
  dialog.querySelector("#ofxVincOk").addEventListener("click", () => confirmarOfxVincular(index));
  dialog.showModal();
}

async function confirmarOfxVincular(index) {
  const row = ofxPend.rows[index];
  const dialog = qs("ofxPendDialog");
  const tituloId = dialog.querySelector("#ofxVincTitulo")?.value;
  if (!tituloId) return showToast("Escolha o título a vincular.", { severity: "warning" });
  const body = {
    fitid: row.fitid,
    bankAccountId: Number(row.bankAccountId),
    table: row.type === "Saída" ? "accounts_payable" : "accounts_receivable",
    recordId: Number(tituloId),
  };
  const obra = dialog.querySelector("#ofxVincObra")?.value;
  const categoria = dialog.querySelector("#ofxVincCategoria")?.value;
  const centro = dialog.querySelector("#ofxVincCentro")?.value;
  if (obra) body.projectId = Number(obra);
  if (categoria) body.categoryId = Number(categoria);
  if (centro) body.costCenterId = Number(centro);
  try {
    const payload = await apiRequest("ofx-vincular", { method: "POST", body: JSON.stringify(body) });
    dialog.close();
    row.vinculada = true;
    row.vinculadaTable = body.table;
    row.vinculadaRecordId = body.recordId;
    ofxPend.selecionadas.delete(index);
    showToast(payload.message || "Vinculada.", { severity: "success" });
    if (serverMode) await refreshAndRender(); else render();
  } catch (error) {
    showToast(error.message, { severity: "warning" });
  }
}

async function ofxVincularLoteSelecionadas() {
  const indices = [...ofxPend.selecionadas];
  if (!indices.length) return;
  const itens = indices.map((i) => ofxPend.rows[i]).filter((r) => r && !r.vinculada && r.autoMatch).map((r) => ({
    fitid: r.fitid,
    bankAccountId: Number(r.bankAccountId),
    table: r.type === "Saída" ? "accounts_payable" : "accounts_receivable",
    recordId: Number(r.autoMatch.id),
  }));
  if (!itens.length) return showToast("Nenhuma selecionada com match de alta confiança.", { severity: "warning" });
  const btn = qs("ofxPendLote");
  if (btn) { btn.disabled = true; btn.textContent = "Vinculando…"; }
  try {
    // Fatia de 50 (limite do endpoint); os 244 de hoje cabem em 5 chamadas.
    let vinculadas = 0;
    const falhas = [];
    for (let i = 0; i < itens.length; i += 50) {
      const payload = await apiRequest("ofx-vincular-lote", { method: "POST", body: JSON.stringify({ itens: itens.slice(i, i + 50) }) });
      vinculadas += Number(payload.data?.vinculadas || 0);
      falhas.push(...(payload.data?.falhas || []));
    }
    showToast(`${vinculadas} vinculada(s)${falhas.length ? ` — ${falhas.length} com aviso` : ""}.`, { severity: falhas.length ? "warning" : "success" });
    if (falhas.length) console.warn("[OFX lote] avisos:", falhas);
    ofxPend.selecionadas.clear();
    await carregarOfxPendencias(true);
    if (serverMode) await refreshAndRender();
  } catch (error) {
    showToast(`Falha no lote: ${error.message}`, { severity: "error" });
  }
}

function abrirOfxDesfazer(index) {
  const row = ofxPend.rows[index];
  if (!row || !row.vinculada) return;
  const dialog = qs("ofxPendDialog");
  dialog.innerHTML = `
    <h3>Desfazer o vínculo</h3>
    <p>${asDate(row.date)} · ${moneySpan(row.amount)} — o movimento do extrato permanece; escolha o destino do título:</p>
    <div class="row-actions">
      <button type="button" class="primary" id="ofxDesfReabrir">Desfazer e REABRIR o título</button>
      <button type="button" class="secondary" id="ofxDesfManter">Desfazer e manter baixado</button>
      <button type="button" class="secondary" id="ofxDesfCancelar">Cancelar</button>
    </div>`;
  const executar = async (reabrir) => {
    try {
      const payload = await apiRequest("ofx-desvincular", { method: "POST", body: JSON.stringify({ table: row.vinculadaTable, recordId: row.vinculadaRecordId, reabrirTitulo: reabrir }) });
      dialog.close();
      row.vinculada = false;
      showToast(payload.message || "Vínculo desfeito.", { severity: "success" });
      await carregarOfxPendencias(true);
      if (serverMode) await refreshAndRender();
    } catch (error) {
      showToast(error.message, { severity: "warning" });
    }
  };
  dialog.querySelector("#ofxDesfReabrir").addEventListener("click", () => executar(true));
  dialog.querySelector("#ofxDesfManter").addEventListener("click", () => executar(false));
  dialog.querySelector("#ofxDesfCancelar").addEventListener("click", () => dialog.close());
  dialog.showModal();
}
```

- [ ] **Step 3: CSS** — em `styles.css`, após o bloco `.baixa-acrescimo-box`:

```css
/* Conciliação E2 — aba Pendências */
.recon-tabs {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.ofx-pend-head {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.ofx-pend-filtros {
  display: flex;
  gap: 10px;
  align-items: end;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.ofx-pend-table td {
  vertical-align: top;
}

.ofx-pend-ok td {
  opacity: 0.65;
}

.ofx-pend-dialog {
  min-width: min(480px, 92vw);
}

.ofx-pend-dialog label {
  display: block;
  margin: 10px 0;
}
```

- [ ] **Step 4: Validar** — `node --check app.js && bash scripts/tests/run-all.sh` → `SUITE: 19/19 blocos ok` (os guardas de privacidade têm de continuar verdes — todo R$ novo está em `moneySpan`, `textContent` nenhum com montante cru).

- [ ] **Step 5: Commit**

```bash
git add app.js styles.css
git commit -m "feat(ui): aba de pendencias da conciliacao - fila por relevancia, vinculo com obra opcional, lote e desfazer (E2)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Release v1.43.0

**Files:** `app.js` (versão/data/changelog), `index.html` (`?v=1812`→`1813`), `CLAUDE.md` (versão + bloco + linha de cache), `README.md` (header + entrada + versão + cache), `STATUS.md` (linha 3).

- [ ] **Step 1: `APP_CHANGELOG` (primeira posição):**

```js
  "Conciliação bancária — tela de Pendências (Etapa 2 de 4): a aba nova \"Pendências\" na Conciliação lista as transações do extrato que ainda não têm título vinculado, ORDENADAS POR RELEVÂNCIA — primeiro as de match exato (um clique), depois as de conferência, por último as sem título. Dá para vincular uma a uma (com escolha OPCIONAL de obra, categoria e centro de custo — é o que transforma o extrato em custo classificado por obra), vincular VÁRIAS de uma vez (as de alta confiança, com caixinha de seleção) e desfazer um vínculo errado escolhendo se o título reabre ou não. O motor ganhou proteções: transação cujo movimento já representa a baixa de outro título é recusada com aviso claro, e um índice único impede duas baixas no mesmo extrato até em cliques simultâneos (migration 2026-08-01-ofx-fitid-unique.sql). Filtros por conta, período e lado; paginação leve; tudo respeitando o modo privacidade (v1.43.0).",
```

- [ ] **Step 2: bloco do CLAUDE.md** (acima do v1.42.0):

```markdown
> **v1.43.0 — Conciliação E2 (aba Pendências + lote + endurecimento):** aba nova na Conciliação (estado `reconTab`/`ofxPend` em app.js; endpoint **`GET ofx-pendencias`** paginado — NUNCA no bootstrap). **Pendente = fitid sem título E movimento sem referência VIVA** (aprendido com o movimento #4: referência viva = já representada — ele NÃO aparece na fila). Match **SET-BASED** (JOIN numérico `t.amount = m.amount` + `DATEDIFF<=5`, uma consulta por lado, chunks de 500) com confiança na pura compartilhada **`ofx_match_confianca()`** (a prévia usa a mesma — régua idêntica); **`ofx_pendencia_bucket()`** (≥85 alta/`media`/`sem`) e **`ofx_pendencias_ordenar()`** (alta→média→sem, confiança desc, data desc) ANTES da paginação — fila de trabalho, não extrato cronológico. **`POST ofx-vincular-lote`** (máx 50/chamada, cada item na própria transação, falha não derruba o lote; herança PURA — sem dims no payload). Refactor: **`ofx_vincular_executar()`** devolve `['ok'|status|motivo]` e é reusado pelo individual e pelo lote. **Guarda `ofx_movimento_livre()`**: movimento com referência viva de OUTRO título → 409 (órfã sobrescreve; o próprio título revincula). Desvincular com `ORDER BY (originDocument LIKE 'OFX%') DESC, id DESC`. **Migration `2026-08-01-ofx-fitid-unique.sql`** (UNIQUE em ofxFitid nos dois lados; ensure_ofx_tables cobre) — **RODAR no servidor**. O único JOIN texto×texto usa `COLLATE utf8mb4_unicode_ci` explícito (regra E1 §5-B). Testes `test_ofx_movimento_livre.php` (10) e `test_ofx_pendencias.php` (12); suíte 19/19. Cache `?v=1813`.
```

- [ ] **Step 3:** README (header linha 3 + entrada no Histórico no molde + versão atual + cache 1813), STATUS.md linha 3 (`v1.43.0` · 2026-08-01).

- [ ] **Step 4:** `php -l && node --check && bash scripts/tests/run-all.sh` → `SUITE: 19/19 blocos ok`.

- [ ] **Step 5: Commit**

```bash
git add app.js index.html README.md CLAUDE.md STATUS.md
git commit -m "chore: release v1.43.0 (conciliacao etapa 2 - aba de pendencias com lote)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Validação em produção (E1+E2 juntas, pela tela — roteiro do dono)

1. `git pull` do deploy + **rodar** `mysql -u root -p financeiro < migrations/2026-08-01-ofx-fitid-unique.sql`; Ctrl+Shift+R → v1.43.0.
2. Conciliação → aba **Pendências**: fila ordenada (um clique no topo), total ~244 e o **movimento #4 AUSENTE**.
3. Vincular UMA com match escolhendo obra no modal → título baixado com a data do movimento; dashboard por obra mostra o valor classificado.
4. Marcar 3-5 altas → "Vincular selecionadas" → resumo N vinculadas.
5. Desfazer uma com "REABRIR" → título Aberto, transação volta à fila.
6. `ofx-vincular` no fitid do movimento #4 (se de extrato) → 409 citando o título 1 (guarda).
7. Auditoria com antes→depois de cada passo.
