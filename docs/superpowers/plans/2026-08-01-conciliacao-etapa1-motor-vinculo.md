# Conciliação Etapa 1 — Motor de vínculo tardio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vincular transação OFX já importada a título existente (baixando-o) SEM criar movimento, desvincular com decisão explícita, e eliminar a dupla contagem do custo realizado.

**Architecture:** Backend: função pura `ofx_vinculo_plano` (decisão) + 2 handlers transacionais (`ofx-vincular`/`ofx-desvincular`) que só executam o plano; fix do `handle_ofx_conciliar` (referência + herança + guarda CAIXA_MANUAL). Frontend: helper puro `saidasCaixaSemTitulo` no `realizedCost`. Zero migration.

**Tech Stack:** PHP 8 (`api/index.php` único), JS vanilla (`app.js`), testes via harness PHP e `vm` do Node.

**Spec:** `docs/superpowers/specs/2026-08-01-conciliacao-etapa1-motor-vinculo-design.md`

## Global Constraints

- LF; `php -l api/index.php` e `node --check app.js` antes de commitar; suíte `bash scripts/tests/run-all.sh` (auto-descobre testes novos).
- **COLLATION (regra da spec §5-B):** toda comparação SQL de fitid/texto é coluna × parâmetro bound; PROIBIDO JOIN texto×texto (se inevitável, `COLLATE utf8mb4_unicode_ci` explícito). A resolução transação→movimento usa `ofx_fitids.cashMoveId` (numérico).
- Commit local por task, mensagens em português sem acento + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. NUNCA `git push`. Nada de `.superpowers/`/`.claude/` no stage.
- Nunca tocar config/uploads/backups/banco. Erros novos: `fail()` com mensagem amigável (o E4 anexa o código de correlação sozinho em 500). Sem `.catch(() => {})`.
- Fora de escopo: tela (E2), criar conta (E3), detector (E4), vínculo com valor diferente, merge de movimentos manuais, `ofxImportId` (segue dormente — sem elo fitid→lote no schema).

---

### Task 1: Função pura `ofx_vinculo_plano` + teste PHP

**Files:**
- Modify: `api/index.php` — inserir logo APÓS a função `ensure_receivable_acrescimos_columns` (bloco de helpers puros do topo, antes do roteamento)
- Test: `scripts/tests/php/test_ofx_vinculo.php` (novo)

**Interfaces:**
- Consumes: `t_assert`/`t_resumo` do harness.
- Produces: `ofx_vinculo_plano(array $titulo, array $movimento, array $payload): array` devolvendo `['acao' => 'baixar'|'vincular'|'recusar', 'motivo' => ?string, 'status' => ?string, 'dateField' => ?string, 'herda' => array]`. A Task 2 chama exatamente esta assinatura.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/tests/php/test_ofx_vinculo.php`:

```php
<?php
// Conciliação E1: decisão PURA do vínculo tardio — testada contra o arquivo real.
// Contrato: lado coerente (Saída↔pagar, Entrada↔receber); valor IGUAL (2 casas);
// cancelado/já-vinculado/CAIXA_MANUAL recusam com motivo amigável; título já
// baixado vira 'vincular' (linkedOnly); herança projectId/categoria/centro =
// payload > título > vazio. Obra é OPCIONAL por decisão do dono.
require __DIR__ . '/harness.php';

$tituloAberto = ['status' => 'Aberto', 'amount' => 256991.45, 'ofxFitid' => null, 'referencia_tipo' => null, 'referencia_id' => null, 'projectId' => 7, 'categoryId' => 3, 'costCenterId' => null];
$movSaida = ['type' => 'Saída', 'amount' => 256991.45, 'date' => '2026-07-07'];
$movEntrada = ['type' => 'Entrada', 'amount' => 256991.45, 'date' => '2026-07-07'];

$r = ofx_vinculo_plano($tituloAberto, $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'baixar' && $r['status'] === 'Pago' && $r['dateField'] === 'paidDate', 'pagar aberto + saida -> baixar Pago/paidDate');

$r = ofx_vinculo_plano($tituloAberto, $movEntrada, ['table' => 'accounts_receivable']);
t_assert($r['acao'] === 'baixar' && $r['status'] === 'Recebido' && $r['dateField'] === 'receivedDate', 'receber aberto + entrada -> baixar Recebido/receivedDate');

$r = ofx_vinculo_plano($tituloAberto, $movEntrada, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'ENTRADA'), 'entrada nao baixa conta a pagar');

$r = ofx_vinculo_plano($tituloAberto, $movSaida, ['table' => 'accounts_receivable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'SAÍDA'), 'saida nao baixa conta a receber');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['status' => 'Cancelado']), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'ancelado'), 'cancelado recusa');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['ofxFitid' => 'X1']), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'vinculado'), 'titulo ja vinculado recusa');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['referencia_tipo' => 'CAIXA_MANUAL', 'referencia_id' => 44]), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'manual'), 'CAIXA_MANUAL com id recusa (evita saida dupla)');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['referencia_tipo' => 'CAIXA_MANUAL', 'referencia_id' => null]), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'baixar', 'CAIXA_MANUAL sem id NAO recusa');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['amount' => 100.00]), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'difere'), 'valor diferente recusa (juros e etapa futura)');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['amount' => '256991.450']), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'baixar', 'igualdade em 2 casas nao e enganada por formato');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['status' => 'Pago']), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'vincular', 'ja baixado -> so vincular (linkedOnly)');

$r = ofx_vinculo_plano($tituloAberto, $movSaida, ['table' => 'accounts_payable', 'projectId' => 9]);
t_assert($r['herda']['projectId'] === 9, 'payload vence o titulo na heranca');

$r = ofx_vinculo_plano($tituloAberto, $movSaida, ['table' => 'accounts_payable']);
t_assert($r['herda']['projectId'] === 7 && $r['herda']['categoryId'] === 3, 'sem payload herda do titulo');
t_assert($r['herda']['costCenterId'] === null, 'ambos vazios -> null (obra/centro OPCIONAL)');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['projectId' => null]), $movSaida, ['table' => 'accounts_payable', 'projectId' => '']);
t_assert($r['herda']['projectId'] === null, 'payload vazio + titulo vazio -> null, sem inventar');

foreach ([['status' => 'Cancelado'], ['ofxFitid' => 'X'], ['amount' => 1], ['referencia_tipo' => 'CAIXA_MANUAL', 'referencia_id' => 1]] as $variacao) {
    $r = ofx_vinculo_plano(array_merge($tituloAberto, $variacao), $movSaida, ['table' => 'accounts_payable']);
    t_assert(!preg_match('/SELECT|UPDATE|accounts_|cash_bank/i', (string) $r['motivo']), 'motivo nao vaza SQL/tabela');
}

t_resumo('test_ofx_vinculo');
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `php scripts/tests/php/test_ofx_vinculo.php`
Expected: FAIL — `Call to undefined function ofx_vinculo_plano()`.

- [ ] **Step 3: Implementar a função**

Em `api/index.php`, logo após o fechamento de `ensure_receivable_acrescimos_columns`:

```php

// ── Conciliação E1: vínculo TARDIO de transação OFX já importada ────────────
// Decisão PURA (testável sem banco): recebe título, movimento e payload e
// devolve o plano — baixar, só vincular (título já baixado) ou recusar com
// motivo amigável. O handler apenas executa o que o plano mandar. Obra/
// categoria/centro são OPCIONAIS: payload > título > vazio (fica vazio mesmo).
function ofx_vinculo_plano(array $titulo, array $movimento, array $payload): array
{
    $isPayable = ($payload['table'] ?? '') === 'accounts_payable';
    $settledStatus = $isPayable ? 'Pago' : 'Recebido';
    $recusa = static fn (string $motivo): array => ['acao' => 'recusar', 'motivo' => $motivo, 'status' => null, 'dateField' => null, 'herda' => []];

    if (($movimento['type'] ?? '') !== ($isPayable ? 'Saída' : 'Entrada')) {
        return $recusa($isPayable
            ? 'Transação de ENTRADA não pode baixar conta a pagar — use o lado a receber.'
            : 'Transação de SAÍDA não pode baixar conta a receber — use o lado a pagar.');
    }
    if (($titulo['status'] ?? '') === 'Cancelado') {
        return $recusa('Título cancelado não pode ser vinculado ao extrato.');
    }
    if (!empty($titulo['ofxFitid'])) {
        return $recusa('Este título já está vinculado a outra transação do extrato.');
    }
    if (($titulo['referencia_tipo'] ?? '') === 'CAIXA_MANUAL' && !empty($titulo['referencia_id'])) {
        return $recusa('Este título já tem um movimento de caixa manual vinculado — vincular o extrato registraria a mesma saída duas vezes. Desfaça o vínculo manual antes.');
    }
    if (round((float) ($titulo['amount'] ?? 0), 2) !== round((float) ($movimento['amount'] ?? 0), 2)) {
        return $recusa('O valor do título difere do valor da transação — o vínculo com diferença (juros/multa) chega numa próxima etapa.');
    }
    $herda = [];
    foreach (['projectId', 'categoryId', 'costCenterId'] as $campo) {
        $valor = $payload[$campo] ?? null;
        if ($valor === null || $valor === '') {
            $valor = $titulo[$campo] ?? null;
        }
        $herda[$campo] = ($valor === '' || $valor === null) ? null : $valor;
    }
    return [
        'acao' => ($titulo['status'] ?? '') === $settledStatus ? 'vincular' : 'baixar',
        'motivo' => null,
        'status' => $settledStatus,
        'dateField' => $isPayable ? 'paidDate' : 'receivedDate',
        'herda' => $herda,
    ];
}
```

- [ ] **Step 4: Validar**

Run: `php -l api/index.php && php scripts/tests/php/test_ofx_vinculo.php`
Expected: `test_ofx_vinculo: 19/19 ok`

- [ ] **Step 5: Commit**

```bash
git add api/index.php scripts/tests/php/test_ofx_vinculo.php
git commit -m "feat(api): plano puro do vinculo tardio OFX (conciliacao E1) + teste

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Endpoints `ofx-vincular` e `ofx-desvincular`

**Files:**
- Modify: `api/index.php` — rotas (logo após o bloco `ofx-conciliar`, ~linha 525-529) e handlers (logo após `handle_ofx_conciliar`).

**Interfaces:**
- Consumes: `ofx_vinculo_plano` (Task 1), `financeiro_baixa_audit_details` (v1.41.0), `ensure_ofx_tables`, `fail`/`respond`/`server_audit`.
- Produces: `POST ofx-vincular` e `POST ofx-desvincular` (contratos da spec §1-§2).

- [ ] **Step 1: Registrar as rotas**

Logo após o bloco `if ($resource === 'ofx-conciliar') {...}` (espelhando o padrão de `require_method` + `authorize_request` dele):

```php
    if ($resource === 'ofx-vincular') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'reconciliation', 'edit');
        handle_ofx_vincular($pdo, $authUser, read_json());
    }
    if ($resource === 'ofx-desvincular') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'reconciliation', 'edit');
        handle_ofx_desvincular($pdo, $authUser, read_json());
    }
```

- [ ] **Step 2: Handler `handle_ofx_vincular`** (logo após `handle_ofx_conciliar`)

```php
// E1: vínculo TARDIO — a transação JÁ é movimento de caixa (ofx_fitids.cashMoveId);
// NUNCA cria outro. Título aberto é baixado com a DATA do movimento; já baixado é
// apenas vinculado. O movimento ganha a referência (dedup do custo realizado) e
// herda obra/categoria/centro do título quando o payload não informar.
// Collation: todas as comparações são coluna × parâmetro (imunes ao ERROR 1267).
function handle_ofx_vincular(PDO $pdo, array $authUser, array $payload): never
{
    ensure_ofx_tables($pdo);
    $fitid = mb_substr(trim((string) ($payload['fitid'] ?? '')), 0, 100);
    $bankAccountId = (int) ($payload['bankAccountId'] ?? 0);
    $table = (string) ($payload['table'] ?? '');
    $recordId = (int) ($payload['recordId'] ?? 0);
    if ($fitid === '' || !$bankAccountId || !$recordId) {
        fail('Dados incompletos para o vínculo.', 400);
    }
    if (!in_array($table, ['accounts_payable', 'accounts_receivable'], true)) {
        fail('Tabela inválida.', 400);
    }
    $stmt = $pdo->prepare('SELECT cashMoveId FROM ofx_fitids WHERE fitid = ? AND bankAccountId = ? LIMIT 1');
    $stmt->execute([$fitid, $bankAccountId]);
    $cashMoveId = (int) ($stmt->fetchColumn() ?: 0);
    if (!$cashMoveId) {
        fail('Transação não encontrada entre as importadas desta conta.', 404);
    }
    foreach (['accounts_payable', 'accounts_receivable'] as $t) {
        $stmt = $pdo->prepare("SELECT id FROM {$t} WHERE ofxFitid = ? LIMIT 1");
        $stmt->execute([$fitid]);
        if ($stmt->fetchColumn()) {
            fail('Esta transação do extrato já está vinculada a um título.', 409);
        }
    }
    $stmt = $pdo->prepare('SELECT * FROM cash_bank_movements WHERE id = ? LIMIT 1');
    $stmt->execute([$cashMoveId]);
    $movimento = $stmt->fetch();
    if (!$movimento) {
        fail('Movimento da transação não encontrado.', 404);
    }
    $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ? LIMIT 1");
    $stmt->execute([$recordId]);
    $titulo = $stmt->fetch();
    if (!$titulo) {
        fail('Título não encontrado.', 404);
    }
    $plano = ofx_vinculo_plano($titulo, $movimento, $payload);
    if ($plano['acao'] === 'recusar') {
        fail($plano['motivo'], 409);
    }
    $isPayable = $table === 'accounts_payable';
    $pdo->beginTransaction();
    try {
        if ($plano['acao'] === 'baixar') {
            $pdo->prepare("UPDATE {$table} SET status = ?, {$plano['dateField']} = ?, ofxFitid = ? WHERE id = ?")
                ->execute([$plano['status'], (string) $movimento['date'], $fitid, $recordId]);
        } else {
            $pdo->prepare("UPDATE {$table} SET ofxFitid = ? WHERE id = ?")
                ->execute([$fitid, $recordId]);
        }
        $pdo->prepare('UPDATE cash_bank_movements
                SET referencia_tipo = ?, referencia_id = ?,
                    projectId = COALESCE(?, projectId),
                    categoryId = COALESCE(?, categoryId),
                    costCenterId = COALESCE(?, costCenterId)
              WHERE id = ?')
            ->execute([
                $isPayable ? 'CONTA_PAGAR' : 'CONTA_RECEBER', $recordId,
                $plano['herda']['projectId'], $plano['herda']['categoryId'], $plano['herda']['costCenterId'],
                $cashMoveId,
            ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[ObraSync OFX][ref ' . obra_error_ref() . '] Vínculo tardio falhou: ' . $error->getMessage());
        fail('Erro ao vincular. Nada foi gravado — tente novamente.', 500);
    }
    $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ? LIMIT 1");
    $stmt->execute([$recordId]);
    $depois = $stmt->fetch() ?: [];
    $details = financeiro_baixa_audit_details($titulo, $depois, $isPayable ? 'paidDate' : 'receivedDate');
    server_audit($pdo, $authUser, 'update', $isPayable ? 'payable' : 'receivable', $recordId,
        trim(($details !== '' ? $details . ' · ' : '') . 'vínculo OFX FITID ' . $fitid . ' → movimento #' . $cashMoveId));
    respond(['ok' => true, 'data' => [
        'recordId' => $recordId,
        'table' => $table,
        'status' => (string) ($depois['status'] ?? ''),
        'linkedOnly' => $plano['acao'] === 'vincular',
        'cashMoveId' => $cashMoveId,
    ], 'message' => $plano['acao'] === 'vincular'
        ? 'Extrato vinculado ao título já baixado.'
        : 'Título baixado e vinculado à transação do extrato.']);
}

// E1: desfazer vínculo. O movimento NUNCA é apagado (a linha do extrato é fato
// bancário) e o FITID segue registrado (a transação não pode ser reimportada).
// Reabrir o título é decisão EXPLÍCITA do chamador — sem heurística no backend.
function handle_ofx_desvincular(PDO $pdo, array $authUser, array $payload): never
{
    ensure_ofx_tables($pdo);
    $table = (string) ($payload['table'] ?? '');
    $recordId = (int) ($payload['recordId'] ?? 0);
    $reabrir = !empty($payload['reabrirTitulo']);
    if (!in_array($table, ['accounts_payable', 'accounts_receivable'], true) || !$recordId) {
        fail('Dados incompletos para desvincular.', 400);
    }
    $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ? LIMIT 1");
    $stmt->execute([$recordId]);
    $titulo = $stmt->fetch();
    if (!$titulo) {
        fail('Título não encontrado.', 404);
    }
    $fitid = (string) ($titulo['ofxFitid'] ?? '');
    if ($fitid === '') {
        fail('Este título não tem vínculo com o extrato.', 422);
    }
    $stmt = $pdo->prepare('SELECT cashMoveId FROM ofx_fitids WHERE fitid = ? LIMIT 1');
    $stmt->execute([$fitid]);
    $cashMoveId = (int) ($stmt->fetchColumn() ?: 0);
    $isPayable = $table === 'accounts_payable';
    $settledStatus = $isPayable ? 'Pago' : 'Recebido';
    $dateField = $isPayable ? 'paidDate' : 'receivedDate';
    $pdo->beginTransaction();
    try {
        if ($reabrir && ($titulo['status'] ?? '') === $settledStatus) {
            $pdo->prepare("UPDATE {$table} SET ofxFitid = NULL, ofxImportId = NULL, status = 'Aberto', {$dateField} = NULL WHERE id = ?")
                ->execute([$recordId]);
        } else {
            $pdo->prepare("UPDATE {$table} SET ofxFitid = NULL, ofxImportId = NULL WHERE id = ?")
                ->execute([$recordId]);
        }
        if ($cashMoveId) {
            $pdo->prepare("UPDATE cash_bank_movements SET referencia_tipo = NULL, referencia_id = NULL
                            WHERE id = ? AND referencia_tipo IN ('CONTA_PAGAR', 'CONTA_RECEBER')")
                ->execute([$cashMoveId]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[ObraSync OFX][ref ' . obra_error_ref() . '] Desvincular falhou: ' . $error->getMessage());
        fail('Erro ao desvincular. Nada foi gravado — tente novamente.', 500);
    }
    $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ? LIMIT 1");
    $stmt->execute([$recordId]);
    $depois = $stmt->fetch() ?: [];
    $details = financeiro_baixa_audit_details($titulo, $depois, $dateField);
    server_audit($pdo, $authUser, 'update', $isPayable ? 'payable' : 'receivable', $recordId,
        trim(($details !== '' ? $details . ' · ' : '') . 'desvínculo OFX FITID ' . $fitid . ($cashMoveId ? ' (movimento #' . $cashMoveId . ' liberado)' : '')));
    respond(['ok' => true, 'data' => [
        'recordId' => $recordId,
        'table' => $table,
        'status' => (string) ($depois['status'] ?? ''),
        'cashMoveId' => $cashMoveId,
    ], 'message' => $reabrir ? 'Vínculo desfeito e título reaberto.' : 'Vínculo desfeito — título mantido como está.']);
}
```

- [ ] **Step 3: Validar**

Run: `php -l api/index.php && bash scripts/tests/run-all.sh`
Expected: sintaxe ok; `SUITE: 16/16 blocos ok` (15 + test_ofx_vinculo).

- [ ] **Step 4: Commit**

```bash
git add api/index.php
git commit -m "feat(api): endpoints ofx-vincular e ofx-desvincular - vinculo tardio sem criar movimento (E1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Fix do conciliar da prévia + fix da dupla contagem no front + teste JS

**Files:**
- Modify: `api/index.php` — `handle_ofx_conciliar` (guarda CAIXA_MANUAL + INSERT com referência/herança)
- Modify: `app.js` — helper `saidasCaixaSemTitulo` (logo após `function signedCashAmount`, ~linha 4199) + uso no `realizedCost` (~linha 4071)
- Test: `scripts/tests/js/test_dedup_caixa.js` (novo)

**Interfaces:**
- Consumes: `signedCashAmount(row)` (existente; Entrada=+, Transferência=0, resto=−).
- Produces: `saidasCaixaSemTitulo(moves): number` — âncoras de extração do teste: de `function signedCashAmount` até `// Janela do fluxo de caixa` (comentário que já segue o bloco).

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/tests/js/test_dedup_caixa.js`:

```js
// Fix da dupla contagem (Conciliação E1): saída de caixa com referencia
// CONTA_PAGAR é a MESMA saída da conta paga que o realizedCost já soma.
// Extrai o bloco REAL do app.js (signedCashAmount + saidasCaixaSemTitulo).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..", "..", "..", "app.js");
const src = fs.readFileSync(APP, "utf8");
const ini = src.indexOf("function signedCashAmount");
const fim = src.indexOf("// Janela do fluxo de caixa");
if (ini < 0 || fim < 0 || fim < ini) {
  console.error("test_dedup_caixa: FALHA — bloco signedCashAmount/saidasCaixaSemTitulo não encontrado");
  process.exit(1);
}

const sandbox = { normalizedText: (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() };
vm.createContext(sandbox);
vm.runInContext(src.slice(ini, fim), sandbox);
const calc = sandbox.saidasCaixaSemTitulo;

let ok = 0;
let falhas = 0;
function t_assert(nome, cond) {
  if (cond) { ok++; return; }
  falhas++;
  console.error("  FALHA: " + nome);
}

t_assert("função extraída existe", typeof calc === "function");
t_assert("lista vazia = 0", calc([]) === 0);
t_assert("undefined = 0", calc(undefined) === 0);
t_assert("saída solta conta", calc([{ type: "Saída", amount: 100 }]) === 100);
t_assert("saída com CONTA_PAGAR + id NÃO conta", calc([{ type: "Saída", amount: 100, referencia_tipo: "CONTA_PAGAR", referencia_id: 5 }]) === 0);
t_assert("saída com CONTA_PAGAR sem id conta", calc([{ type: "Saída", amount: 100, referencia_tipo: "CONTA_PAGAR" }]) === 100);
t_assert("entrada nunca entra", calc([{ type: "Entrada", amount: 999 }]) === 0);
t_assert("transferência nunca entra", calc([{ type: "Transferência", amount: 999 }]) === 0);
t_assert("CONTA_RECEBER em saída não filtra (só CONTA_PAGAR deduplica saída)", calc([{ type: "Saída", amount: 50, referencia_tipo: "CONTA_RECEBER", referencia_id: 1 }]) === 50);
t_assert("mistura soma só as saídas sem título", calc([
  { type: "Saída", amount: 100 },
  { type: "Saída", amount: 40, referencia_tipo: "CONTA_PAGAR", referencia_id: 2 },
  { type: "Entrada", amount: 70 },
  { type: "Saída", amount: 25 },
]) === 125);

console.log(`test_dedup_caixa: ${ok}/${ok + falhas} ok`);
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/tests/js/test_dedup_caixa.js`
Expected: FAIL — `função extraída existe` (saidasCaixaSemTitulo ainda não existe no bloco).

- [ ] **Step 3: Helper no app.js**

Inserir logo após o fechamento de `function signedCashAmount` (antes do comentário `// Janela do fluxo de caixa`):

```js

// Saídas de caixa SEM título vinculado (Conciliação E1): movimento com
// referencia CONTA_PAGAR é a MESMA saída da conta paga que o realizedCost já
// somou — contar os dois dobraria o custo realizado da obra.
function saidasCaixaSemTitulo(moves) {
  return Math.abs((moves || [])
    .filter((m) => signedCashAmount(m) < 0 && !(m.referencia_tipo === "CONTA_PAGAR" && m.referencia_id))
    .reduce((total, m) => total + signedCashAmount(m), 0));
}
```

E trocar a linha do `realizedCost` (~4071):

```js
// ANTES
const realizedCost = paidExpenses + Math.abs(moves.filter((row) => signedCashAmount(row) < 0).reduce((total, row) => total + signedCashAmount(row), 0));
// DEPOIS
const realizedCost = paidExpenses + saidasCaixaSemTitulo(moves);
```

- [ ] **Step 4: Fix do `handle_ofx_conciliar` (api/index.php)**

4a. Guarda CAIXA_MANUAL — logo após o bloco `if (!empty($record['ofxFitid'])) {...}` (~linha 7667):

```php
    if (($record['referencia_tipo'] ?? '') === 'CAIXA_MANUAL' && !empty($record['referencia_id'])) {
        fail('Este título já tem um movimento de caixa manual vinculado — conciliar criaria a mesma saída duas vezes no caixa. Desfaça o vínculo manual antes.', 409);
    }
```

4b. INSERT do movimento ganha referência + herança (substituir o INSERT em ~7687-7695):

```php
        $pdo->prepare(
            "INSERT INTO cash_bank_movements (`date`, bankAccount, `type`, history, amount, originDocument, status,
                                              referencia_tipo, referencia_id, projectId, categoryId, costCenterId)
             VALUES (?, ?, ?, ?, ?, ?, 'Confirmado', ?, ?, ?, ?, ?)"
        )->execute([
            $date, $bankName, $type,
            $memo !== '' ? $memo : ('Conciliação OFX — ' . $record['document']),
            $amount,
            mb_substr('OFX:' . $fitid, 0, 100),
            $isPayable ? 'CONTA_PAGAR' : 'CONTA_RECEBER',
            $recordId,
            $record['projectId'] ?? null,
            $record['categoryId'] ?? null,
            $record['costCenterId'] ?? null,
        ]);
```

(`$isPayable` já existe no escopo — declarado antes da transação, ~linha 7671.)

- [ ] **Step 5: Validar**

Run: `node --check app.js && php -l api/index.php && bash scripts/tests/run-all.sh`
Expected: `test_dedup_caixa: 10/10 ok`; `SUITE: 17/17 blocos ok`.

- [ ] **Step 6: Commit**

```bash
git add api/index.php app.js scripts/tests/js/test_dedup_caixa.js
git commit -m "fix(financeiro): dupla contagem do custo realizado + conciliar da previa grava referencia e heranca (E1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Release v1.42.0

**Files:**
- Modify: `app.js` (~96-98: APP_VERSION `v1.42.0`, APP_VERSION_DATE `2026-08-01`, entrada nova no TOPO do APP_CHANGELOG)
- Modify: `index.html` (`?v=1811` → `?v=1812` em styles.css E app.js; theme-init intacto)
- Modify: `CLAUDE.md` (Versão atual; bloco release acima do v1.41.0; linha de convenção do cache → 1812)
- Modify: `README.md` (entrada no topo do Histórico de Versões; Versão atual; linha de cache)
- Modify: `STATUS.md` (linha 3: `v1.42.0` · 2026-08-01)
- Modify: `docs/superpowers/specs/2026-07-31-orcamento-integridade-exclusao-design.md` (a linha de versão: `v1.42.0` → `a próxima livre no momento do release (v1.43.0+)` — esta release tomou a v1.42.0)

**Interfaces:** consome Tasks 1-3 commitadas.

- [ ] **Step 1: APP_CHANGELOG (primeira posição do array)**

```js
  "Conciliação bancária — motor de vínculo tardio (Etapa 1 de 4): agora existe caminho de volta para o extrato importado. A API ganhou o vínculo tardio: uma transação já importada pode baixar uma conta a pagar/receber existente (a data da baixa vem da transação; título já baixado é apenas vinculado, sem duplicar nada) e o desfazer com escolha explícita de reabrir ou não o título — o movimento do extrato nunca é apagado. Correção importante junto: o custo realizado da obra somava DUAS vezes a mesma saída quando uma conta paga tinha movimento de caixa do extrato vinculado — agora o cálculo ignora a saída de caixa que já está representada pela conta. A conciliação feita na prévia da importação também passou a gravar a referência e a herdar obra/categoria/centro de custo do título. A tela de pendências (Etapa 2) vem a seguir; por ora o motor está pronto e testado (v1.42.0).",
```

- [ ] **Step 2: Bloco do CLAUDE.md** (acima do v1.41.0)

```markdown
> **v1.42.0 — Conciliação E1 (motor de vínculo tardio + fix da dupla contagem):** endpoints novos **`POST ofx-vincular`** (transação JÁ importada baixa título existente SEM criar movimento — resolve pelo `ofx_fitids.cashMoveId`; título aberto = baixa com a data do movimento; já baixado = linkedOnly; movimento ganha `referencia_tipo='CONTA_PAGAR'|'CONTA_RECEBER'`+`referencia_id` e HERDA projectId/categoryId/costCenterId do título com payload opcional por cima — obra OPCIONAL) e **`POST ofx-desvincular`** (`reabrirTitulo` explícito; movimento nunca é apagado; FITID segue bloqueando reimportação). Decisão em função PURA **`ofx_vinculo_plano()`** (lado coerente, valor IGUAL em 2 casas — diferença/juros é etapa futura —, recusas amigáveis: cancelado, já vinculado, `CAIXA_MANUAL`); handler só executa. **Fix da dupla contagem (bug ativo):** `realizedCost` usa **`saidasCaixaSemTitulo()`** — saída com referencia CONTA_PAGAR não soma de novo (`test_dedup_caixa.js`). `handle_ofx_conciliar` (prévia) agora grava referência+herança no movimento e recusa título com CAIXA_MANUAL (409). **REGRA COLLATION (MariaDB 11.8 remapeia COLLATE declarado):** comparações de fitid SEMPRE coluna×parâmetro; JOIN texto×texto proibido sem `COLLATE utf8mb4_unicode_ci` até a padronização (frente própria). Sem migration. Testes novos `test_ofx_vinculo.php` (18) e `test_dedup_caixa.js` (10); suíte 17/17. Cache `?v=1812`.
```

- [ ] **Step 3: README** — entrada no topo do Histórico (molde das anteriores: intro + bullets + fecho), versão atual e linha de cache; **STATUS.md** linha 3; **spec da integridade** (linha de versão conforme Files acima).

- [ ] **Step 4: Suíte completa**

Run: `php -l api/index.php && node --check app.js && bash scripts/tests/run-all.sh`
Expected: `SUITE: 17/17 blocos ok`.

- [ ] **Step 5: Commit**

```bash
git add app.js index.html README.md CLAUDE.md STATUS.md docs/superpowers/specs/2026-07-31-orcamento-integridade-exclusao-design.md
git commit -m "chore: release v1.42.0 (conciliacao etapa 1 - motor de vinculo tardio e fix da dupla contagem)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Validação em produção (pós-push, roteiro do dono)

1. Ctrl+Shift+R → v1.42.0 em Configurações → Versões.
2. Vincular 1 transação de teste via API (curl autenticado — roteiro):
   `curl -s -X POST https://.../financeiro/api/ofx-vincular -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"fitid":"<um dos 244>","bankAccountId":<id>,"table":"accounts_payable","recordId":<titulo>}'`
   → título baixado com a data do movimento; movimento com referência e obra herdada (conferir via consulta).
3. `ofx-desvincular` no mesmo par com `"reabrirTitulo":true` → título Aberto de novo, movimento sem referência, audit com antes→depois.
4. Card "Custo realizado" do dashboard: sem mudança visível hoje (o único par era do lado receber) — o fix protege os vínculos novos.
