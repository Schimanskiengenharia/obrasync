# NOVO-2: Log de Schema Drift — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `insert_dynamic`/`update_dynamic` deixam de descartar colunas em silêncio: helper `log_schema_drift` registra no `error_log` (com dedupe por requisição) toda coluna filtrada — sem mudar nenhum comportamento.

**Architecture:** Task única (helper + 2 pontos de chamada = uma unidade testável). O filtro de colunas NÃO muda (é barreira de segurança contra injeção via nome de coluna).

**Tech Stack:** PHP puro; teste CLI local da lógica do helper.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-novo2-schema-drift-design.md`.
- **Somente** `api/index.php` alterado; o filtro `array_filter(... in_array ...)` permanece byte a byte.
- Log SEMPRE antes do `throw`/early-return (drift total precisa ser registrado).
- `php -l api/index.php` passa; `git ls-files --eol api/index.php` → `i/lf w/lf`.
- Teste CLI no scratchpad (`C:\Users\schim\AppData\Local\Temp\claude\C--Users-schim-Documents-Codex-2026-06-05-crie-um-sistema-web-financeiro-e\a25bec57-3858-42ea-8b35-af8bc522660c\scratchpad`), nunca commitado.
- Commit único com a mensagem exata. **Sem `git push`**.

---

### Task 1: Helper + instrumentação das duas funções

**Files:**
- Modify: `api/index.php:14197-14219` (`insert_dynamic`/`update_dynamic`) + helper novo imediatamente antes de `insert_dynamic`

**Interfaces:**
- Produces: `log_schema_drift(string $op, string $table, array $dropped): void` — best-effort, dedupe por request, nunca lança.

- [ ] **Step 1: Inserir o helper imediatamente ANTES de `function insert_dynamic`**

```php
// Registra colunas descartadas pelo filtro de schema das gravações dinâmicas
// (drift real: migration não rodada, typo de campo, cópia que perde colunas).
// Best-effort com dedupe por requisição — nunca altera a gravação nem lança.
// O filtro em si é também a barreira contra injeção via nome de coluna
// (os nomes são interpolados no SQL) e NÃO deve ser afrouxado.
function log_schema_drift(string $op, string $table, array $dropped): void
{
    if (!$dropped) return;
    static $logged = [];
    $key = $table . '|' . implode(',', $dropped);
    if (isset($logged[$key])) return;
    $logged[$key] = true;
    error_log('[ObraSync schema-drift] ' . $op . ' em ' . $table . ': colunas descartadas: ' . implode(', ', $dropped));
}
```

- [ ] **Step 2: Instrumentar `insert_dynamic`**

Substituir:

```php
function insert_dynamic(PDO $pdo, string $table, array $data): int
{
    $columns = table_columns($pdo, $table);
    $data = array_filter($data, fn ($field) => in_array($field, $columns, true), ARRAY_FILTER_USE_KEY);
    if (!$data) {
```

por:

```php
function insert_dynamic(PDO $pdo, string $table, array $data): int
{
    $columns = table_columns($pdo, $table);
    $originalKeys = array_keys($data);
    $data = array_filter($data, fn ($field) => in_array($field, $columns, true), ARRAY_FILTER_USE_KEY);
    log_schema_drift('INSERT', $table, array_values(array_diff($originalKeys, array_keys($data))));
    if (!$data) {
```

- [ ] **Step 3: Instrumentar `update_dynamic`**

Substituir:

```php
function update_dynamic(PDO $pdo, string $table, int $id, array $data): void
{
    $columns = table_columns($pdo, $table);
    $data = array_filter($data, fn ($field) => in_array($field, $columns, true), ARRAY_FILTER_USE_KEY);
    if (!$data) return;
```

por:

```php
function update_dynamic(PDO $pdo, string $table, int $id, array $data): void
{
    $columns = table_columns($pdo, $table);
    $originalKeys = array_keys($data);
    $data = array_filter($data, fn ($field) => in_array($field, $columns, true), ARRAY_FILTER_USE_KEY);
    log_schema_drift('UPDATE', $table, array_values(array_diff($originalKeys, array_keys($data))));
    if (!$data) return;
```

- [ ] **Step 4: Teste CLI local do helper (scratchpad, não commitado)**

Criar `<scratchpad>/drift_test.php` com uma CÓPIA standalone do helper e:

```php
<?php // drift_test.php — valida formato, dedupe e passthrough vazio
ini_set('error_log', __DIR__ . '/drift_test.log');
@unlink(__DIR__ . '/drift_test.log');
// [colar aqui a função log_schema_drift idêntica ao Step 1]
log_schema_drift('INSERT', 'tabela_a', []);                    // nada
log_schema_drift('INSERT', 'tabela_a', ['colX', 'colY']);      // loga
log_schema_drift('UPDATE', 'tabela_a', ['colX', 'colY']);      // dedupe (mesma assinatura)
log_schema_drift('INSERT', 'tabela_b', ['colX']);              // loga
$lines = file(__DIR__ . '/drift_test.log');
echo 'linhas=' . count($lines) . "\n";
echo (str_contains($lines[0], '[ObraSync schema-drift] INSERT em tabela_a: colunas descartadas: colX, colY') ? 'FORMATO-OK' : 'FORMATO-ERRADO') . "\n";
```

Run: `php drift_test.php`
Expected: `linhas=2` e `FORMATO-OK` (vazio não loga; dedupe suprime a 2ª chamada da mesma assinatura; tabela_b loga).

- [ ] **Step 5: Validar sintaxe e line endings**

Run: `php -l api/index.php`
Expected: `No syntax errors detected`

Run: `git ls-files --eol api/index.php`
Expected: contém `i/lf	w/lf`

- [ ] **Step 6: Commit**

```bash
git add api/index.php
git commit -m "feat(api): log de schema drift no insert/update_dynamic - colunas descartadas deixam de ser silenciosas (NOVO-2)"
```

---

## Após o plano

Validação em produção é passiva: após o próximo push, linhas
`[ObraSync schema-drift]` no error_log do PHP do servidor são achados
reais (cada uma vira candidato a item de correção); ausência também é
resultado válido.
