# NOVO-3: Testes Mínimos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suíte mínima em `scripts/tests/` rodando 100% local (Git Bash, sem banco): funções REAIS do `api/index.php` via gate de 1 linha, regressão do bug v1.25.1, testes do backup e checagens estáticas, com runner agregador.

**Architecture:** Task 1 = gate + harness + 1º teste (prova o conceito); Task 2 = testes de header e drift; Task 3 = backup + estáticos + runner. Um commit por task.

**Tech Stack:** PHP CLI local, bash (Git Bash), mini-harness próprio (sem Composer/PHPUnit).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-19-novo3-testes-minimos-design.md`.
- **REGRA de dados:** testes JAMAIS leem `/etc/financeiro/config.php` nem conectam em banco algum; escrita só em diretórios temporários criados pelo teste; `test-backup.sh` SEMPRE passa `CONFIG_FILE`/`BACKUP_ROOT`/`UPLOADS_DIR` explícitos (nunca herda os defaults de produção).
- Única mudança em arquivo de produção: a linha do gate em `api/index.php:72`. O resto é arquivo novo em `scripts/tests/`.
- Validações por task: `php -l api/index.php` (Task 1), `bash -n` nos .sh novos, `git ls-files --eol` → `i/lf w/lf` em todo arquivo tocado/criado.
- Commits com as mensagens exatas. **Sem `git push`**.

---

### Task 1: Gate + harness + teste de preços

**Files:**
- Modify: `api/index.php:72` (1 linha)
- Create: `scripts/tests/php/harness.php`, `scripts/tests/php/test_ia_precos.php`

**Interfaces:**
- Produces: `t_assert(bool, string)`, `t_aprox(?float, ?float): bool` (no teste), `t_resumo(string)` — usados por todos os testes PHP; gate `OBRASYNC_TESTE_SEM_DB`.

- [ ] **Step 1: Gate em `api/index.php`**

Substituir:

```php
$pdo = db($config);
```

por:

```php
// Gate de teste (NOVO-3): com OBRASYNC_TESTE_SEM_DB definido, a suíte local
// carrega as funções REAIS sem conectar em banco NENHUM. Web/workers nunca
// definem a variável — comportamento idêntico ao de sempre.
$pdo = getenv('OBRASYNC_TESTE_SEM_DB') ? null : db($config);
```

- [ ] **Step 2: Criar `scripts/tests/php/harness.php`**

```php
<?php
// Harness da suíte mínima (NOVO-3): carrega o api/index.php REAL sem banco.
// FINANCEIRO_CONFIG aponta o sample para NUNCA ler o config de produção
// (regra: dados intocáveis); OBRASYNC_TESTE_SEM_DB pula o db().
declare(strict_types=1);
putenv('OBRASYNC_TESTE_SEM_DB=1');
putenv('FINANCEIRO_CONFIG=' . __DIR__ . '/../../../api/config.sample.php');
require_once __DIR__ . '/../../../api/index.php';
// O index.php desliga display_errors para a web; na suíte queremos ver tudo.
ini_set('display_errors', '1');
error_reporting(E_ALL);

$GLOBALS['t_total'] = 0;
$GLOBALS['t_falhas'] = 0;

function t_assert(bool $cond, string $msg): void
{
    $GLOBALS['t_total']++;
    if (!$cond) {
        $GLOBALS['t_falhas']++;
        echo "FALHOU: {$msg}\n";
    }
}

function t_resumo(string $arquivo): void
{
    $ok = $GLOBALS['t_total'] - $GLOBALS['t_falhas'];
    echo "{$arquivo}: {$ok}/{$GLOBALS['t_total']} ok\n";
    exit($GLOBALS['t_falhas'] > 0 ? 1 : 0);
}
```

- [ ] **Step 3: Criar `scripts/tests/php/test_ia_precos.php`**

```php
<?php
// ia_compara_calcula_precos é PURA e mexe com dinheiro: cada regra abaixo
// espelha o contrato documentado (tolerância 0,5% = igual; sem comparação
// fora de 'achou' ou com valores ausentes/zero; totais = qtd × unitário).
require __DIR__ . '/harness.php';

function t_aprox(?float $a, ?float $b): bool
{
    if ($a === null || $b === null) return $a === $b;
    return abs($a - $b) < 0.005;
}

// Planilha mais cara: 110 vs 100, qtd 2.
$r = ia_compara_calcula_precos(110.0, 100.0, 2.0, 'achou');
t_assert($r['precoMaisBaixo'] === 'sinapi', 'planilha cara => sinapi mais barata');
t_assert(t_aprox($r['diferencaValor'], 10.0), 'diferencaValor 10.00');
t_assert(t_aprox($r['diferencaPercent'], 10.0), 'diferencaPercent 10%');
t_assert(t_aprox($r['totalOrigem'], 220.0), 'totalOrigem 220');
t_assert(t_aprox($r['totalSinapi'], 200.0), 'totalSinapi 200');
t_assert(t_aprox($r['diferencaTotal'], 20.0), 'diferencaTotal 20');

// Planilha mais barata: 90 vs 100.
$r = ia_compara_calcula_precos(90.0, 100.0, null, 'achou');
t_assert($r['precoMaisBaixo'] === 'planilha', 'planilha barata');
t_assert(t_aprox($r['diferencaValor'], -10.0), 'diferencaValor -10');
t_assert($r['totalOrigem'] === null && $r['totalSinapi'] === null, 'sem qtd => sem totais');

// Dentro da tolerância de 0,5%: 100.4 vs 100 => igual (dif ainda calculada).
$r = ia_compara_calcula_precos(100.4, 100.0, 1.0, 'achou');
t_assert($r['precoMaisBaixo'] === 'igual', 'tolerancia 0,5% => igual');
t_assert(t_aprox($r['diferencaValor'], 0.4), 'dif 0.40 calculada mesmo no igual');

// Status diferente de achou: nunca compara, mas totalOrigem sai se houver qtd.
$r = ia_compara_calcula_precos(110.0, 100.0, 3.0, 'faltou_importar');
t_assert($r['precoMaisBaixo'] === 'sem_comparacao', 'nao-achou => sem_comparacao');
t_assert($r['diferencaValor'] === null, 'nao-achou => sem diferenca');
t_assert(t_aprox($r['totalOrigem'], 330.0), 'totalOrigem calculado mesmo sem match');

// Guardas de divisão por zero / ausências.
$r = ia_compara_calcula_precos(110.0, 0.0, 1.0, 'achou');
t_assert($r['precoMaisBaixo'] === 'sem_comparacao', 'match 0 => sem_comparacao');
$r = ia_compara_calcula_precos(null, 100.0, 2.0, 'achou');
t_assert($r['precoMaisBaixo'] === 'sem_comparacao' && $r['totalOrigem'] === null, 'planilha null => nada');

t_resumo('test_ia_precos');
```

- [ ] **Step 4: Rodar e validar**

Run: `php scripts/tests/php/test_ia_precos.php`
Expected: `test_ia_precos: 16/16 ok` e exit 0

Run: `php -l api/index.php`
Expected: `No syntax errors detected`

Run: `git ls-files --eol api/index.php` (após `git add` dos novos, também nos criados)
Expected: `i/lf	w/lf`

- [ ] **Step 5: Commit**

```bash
git add api/index.php scripts/tests/php/harness.php scripts/tests/php/test_ia_precos.php
git commit -m "test(suite): gate OBRASYNC_TESTE_SEM_DB + harness local + teste da matematica de precos do comparador (NOVO-3 etapa 1)"
```

---

### Task 2: Testes de header (regressão v1.25.1) e de schema drift

**Files:**
- Create: `scripts/tests/php/test_ia_depara_header.php`, `scripts/tests/php/test_log_schema_drift.php`

**Interfaces:**
- Consumes: `harness.php` (Task 1); funções reais `ia_depara_norm`, `ia_depara_map_header`, `log_schema_drift`.

- [ ] **Step 1: Criar `scripts/tests/php/test_ia_depara_header.php`**

```php
<?php
// Regressão do bug v1.25.1 (cabo a R$ 8.484 em vez de R$ 2,80): coluna de
// TOTAL casava como valor unitário por match "contém". O contrato atual é
// chave normalizada EXATA + "total*" sempre ignorado.
require __DIR__ . '/harness.php';

// Normalização remove marca monetária e pontuação sem deixar lixo.
t_assert(ia_depara_norm('Custo Direto Unit. (R$)') === 'custo direto unit', 'norm custo direto');
t_assert(ia_depara_norm('M.O. Unit. (R$)') === 'm o unit', 'norm m.o.');
t_assert(ia_depara_norm('BDI (%)') === 'bdi', 'norm bdi');

// Cabeçalho real AltoQi (v1.25.1): cada coluna no campo certo.
t_assert(ia_depara_map_header('Descrição') === 'descricao', 'descricao');
t_assert(ia_depara_map_header('Código') === 'codigo', 'codigo');
t_assert(ia_depara_map_header('Unidade') === 'unidade', 'unidade');
t_assert(ia_depara_map_header('Quantidade') === 'quantidade', 'quantidade');
t_assert(ia_depara_map_header('Material Unit. (R$)') === 'material', 'material unit');
t_assert(ia_depara_map_header('M.O. Unit. (R$)') === 'maoobra', 'maoobra unit');
t_assert(ia_depara_map_header('Custo Direto Unit. (R$)') === 'custodireto', 'custo direto');
t_assert(ia_depara_map_header('BDI (%)') === 'bdi', 'bdi');

// O CERNE do bug: colunas de TOTAL nunca viram valor unitário (nem nada).
t_assert(ia_depara_map_header('Total Material (R$)') === null, 'total material ignorado');
t_assert(ia_depara_map_header('Total M.O. (R$)') === null, 'total mo ignorado');
t_assert(ia_depara_map_header('Total (R$)') === null, 'total ignorado');

// "Item" é descrição FRACA (nº WBS) — mapeia, mas a preferência forte é testada
// pela função ia_depara_header_is_strong_desc.
t_assert(ia_depara_map_header('Item') === 'descricao', 'item vira descricao fraca');
t_assert(ia_depara_header_is_strong_desc('Descrição') === true, 'descricao e forte');
t_assert(ia_depara_header_is_strong_desc('Item') === false, 'item nao e forte');

t_resumo('test_ia_depara_header');
```

- [ ] **Step 2: Criar `scripts/tests/php/test_log_schema_drift.php`**

```php
<?php
// NOVO-2 testado contra a função REAL (não cópia): formato da linha, dedupe
// por assinatura tabela|colunas na mesma execução, e vazio não loga.
require __DIR__ . '/harness.php';

$logTmp = sys_get_temp_dir() . '/obrasync_drift_test_' . getmypid() . '.log';
@unlink($logTmp);
ini_set('error_log', $logTmp);

log_schema_drift('INSERT', 'tabela_a', []);
t_assert(!is_file($logTmp) || trim((string) file_get_contents($logTmp)) === '', 'vazio nao loga');

log_schema_drift('INSERT', 'tabela_a', ['colX', 'colY']);
log_schema_drift('UPDATE', 'tabela_a', ['colX', 'colY']); // mesma assinatura => dedupe
log_schema_drift('INSERT', 'tabela_b', ['colX']);

$linhas = array_values(array_filter(file($logTmp) ?: []));
t_assert(count($linhas) === 2, 'dedupe: 2 linhas (a 2ª chamada da mesma assinatura foi suprimida)');
t_assert(str_contains($linhas[0] ?? '', '[ObraSync schema-drift] INSERT em tabela_a: colunas descartadas: colX, colY'), 'formato exato da linha');
t_assert(str_contains($linhas[1] ?? '', 'tabela_b'), 'tabela diferente loga');

@unlink($logTmp);
t_resumo('test_log_schema_drift');
```

- [ ] **Step 3: Rodar e validar**

Run: `php scripts/tests/php/test_ia_depara_header.php`
Expected: `test_ia_depara_header: 17/17 ok`, exit 0

Run: `php scripts/tests/php/test_log_schema_drift.php`
Expected: `test_log_schema_drift: 4/4 ok`, exit 0

- [ ] **Step 4: Commit**

```bash
git add scripts/tests/php/test_ia_depara_header.php scripts/tests/php/test_log_schema_drift.php
git commit -m "test(suite): regressao v1.25.1 do mapeamento de colunas + log de schema drift contra funcoes reais (NOVO-3 etapa 2)"
```

---

### Task 3: Teste do backup + checagens estáticas + runner

**Files:**
- Create: `scripts/tests/test-backup.sh`, `scripts/tests/static-checks.sh`, `scripts/tests/run-all.sh`

**Interfaces:**
- Consumes: contrato de exit do `backup-pre-deploy.sh` (DEP3) e os testes PHP das Tasks 1-2.
- Produces: `bash scripts/tests/run-all.sh` — ponto de entrada único (futuro hook DEP1).

- [ ] **Step 1: Criar `scripts/tests/test-backup.sh`**

```bash
#!/usr/bin/env bash
# Testa o backup-pre-deploy.sh em diretórios TEMPORÁRIOS (nunca os reais):
# (A) falha total; (B) falha parcial com uploads válidos; (C) caminho feliz
# com mysqldump FAKE — valida gzip -t, atomicidade (.tmp- -> final) e
# retenção KEEP=1. Regra de dados: CONFIG_FILE/BACKUP_ROOT/UPLOADS_DIR são
# SEMPRE passados explicitamente.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="${REPO}/backup-pre-deploy.sh"
T="$(mktemp -d)"
trap 'rm -rf "${T}"' EXIT
FALHAS=0
falha() { echo "FALHOU: $1"; FALHAS=$((FALHAS + 1)); }

# (A) Tudo falha: config e uploads inexistentes.
mkdir -p "${T}/bkA"
saida="$(CONFIG_FILE="${T}/nao.php" BACKUP_ROOT="${T}/bkA" UPLOADS_DIR="${T}/nao-up" bash "${SCRIPT}" 2>&1)"; rcA=$?
[ "${rcA}" -eq 1 ] || falha "A: exit deveria ser 1 (foi ${rcA})"
echo "${saida}" | grep -q 'credenciais do banco' || falha "A: sem erro de credenciais"
echo "${saida}" | grep -q 'uploads.*não existe' || falha "A: sem erro de uploads"
ls -d "${T}/bkA"/.tmp-* >/dev/null 2>&1 || falha "A: .tmp- de diagnóstico não ficou"
ls -d "${T}/bkA"/2* >/dev/null 2>&1 && falha "A: NÃO deveria existir diretório final"

# (B) Uploads válidos, credenciais ausentes: exit 1, mas tar validado no .tmp-.
mkdir -p "${T}/bkB" "${T}/up" && echo conteudo > "${T}/up/arq.txt"
saida="$(CONFIG_FILE="${T}/nao.php" BACKUP_ROOT="${T}/bkB" UPLOADS_DIR="${T}/up" bash "${SCRIPT}" 2>&1)"; rcB=$?
[ "${rcB}" -eq 1 ] || falha "B: exit deveria ser 1 (foi ${rcB})"
echo "${saida}" | grep -q 'OK: uploads copiados e validados' || falha "B: uploads deveriam validar"
tarB="$(ls "${T}/bkB"/.tmp-*/uploads.tar.gz 2>/dev/null | head -1)"
[ -n "${tarB}" ] && gzip -t "${tarB}" 2>/dev/null || falha "B: uploads.tar.gz ausente/corrompido"

# (C) Caminho feliz: config fake + mysqldump FAKE no PATH; retenção KEEP=1.
mkdir -p "${T}/bkC" "${T}/bin"
printf '%s\n' '#!/usr/bin/env bash' 'echo "-- dump fake para teste"' > "${T}/bin/mysqldump"
chmod +x "${T}/bin/mysqldump"
cat > "${T}/config.php" <<'EOF'
<?php
return ['db' => ['host' => '127.0.0.1', 'database' => 'teste_fake', 'user' => 'teste', 'password' => 'x']];
EOF
mkdir -p "${T}/bkC/20200101-000000" && touch -t 202001010000 "${T}/bkC/20200101-000000"
saida="$(PATH="${T}/bin:${PATH}" CONFIG_FILE="${T}/config.php" BACKUP_ROOT="${T}/bkC" UPLOADS_DIR="${T}/up" KEEP=1 bash "${SCRIPT}" 2>&1)"; rcC=$?
[ "${rcC}" -eq 0 ] || falha "C: exit deveria ser 0 (foi ${rcC}); saida: ${saida}"
echo "${saida}" | grep -q 'Backup pré-deploy concluído' || falha "C: sem mensagem de conclusão"
final="$(ls -d "${T}/bkC"/2*/ 2>/dev/null | grep -v 20200101 | head -1)"
[ -n "${final}" ] || falha "C: diretório final não criado"
gzip -t "${final}banco-teste_fake.sql.gz" 2>/dev/null || falha "C: dump fake ausente/corrompido"
ls -d "${T}/bkC"/.tmp-* >/dev/null 2>&1 && falha "C: .tmp- não deveria sobrar no sucesso"
[ -d "${T}/bkC/20200101-000000" ] && falha "C: retenção KEEP=1 não removeu o antigo"

if [ "${FALHAS}" -gt 0 ]; then echo "test-backup: ${FALHAS} falha(s)"; exit 1; fi
echo "test-backup: ok (A falha-total, B falha-parcial, C sucesso+retenção)"
```

- [ ] **Step 2: Criar `scripts/tests/static-checks.sh`**

```bash
#!/usr/bin/env bash
# Checagens estáticas que antes eram manuais: sintaxe + line endings.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${REPO}"
FALHAS=0
falha() { echo "FALHOU: $1"; FALHAS=$((FALHAS + 1)); }

php -l api/index.php >/dev/null || falha "php -l api/index.php"
php -l deploy.php >/dev/null || falha "php -l deploy.php"
node --check app.js || falha "node --check app.js"
bash -n backup-pre-deploy.sh || falha "bash -n backup-pre-deploy.sh"
for f in api/index.php deploy.php app.js backup-pre-deploy.sh; do
  git ls-files --eol "$f" | grep -q 'w/lf' || falha "line endings de $f (esperado LF)"
done

if [ "${FALHAS}" -gt 0 ]; then echo "static-checks: ${FALHAS} falha(s)"; exit 1; fi
echo "static-checks: ok"
```

- [ ] **Step 3: Criar `scripts/tests/run-all.sh`**

```bash
#!/usr/bin/env bash
# Ponto de entrada da suíte mínima (NOVO-3). Exit != 0 se qualquer teste
# falhar — é o que o futuro hook pre-push (DEP1) vai chamar.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
TOTAL=0
FALHAS=0

rodar() {
  TOTAL=$((TOTAL + 1))
  echo "== $1"
  if ! "$@"; then FALHAS=$((FALHAS + 1)); fi
}

rodar bash "${DIR}/static-checks.sh"
for t in "${DIR}"/php/test_*.php; do
  rodar php "${t}"
done
rodar bash "${DIR}/test-backup.sh"

echo "----------------------------------------"
if [ "${FALHAS}" -gt 0 ]; then
  echo "SUITE: ${FALHAS}/${TOTAL} bloco(s) com falha"
  exit 1
fi
echo "SUITE: ${TOTAL}/${TOTAL} blocos ok"
```

- [ ] **Step 4: Rodar tudo + teste de sabotagem**

Run: `bash scripts/tests/run-all.sh`
Expected: todos os blocos ok, `SUITE: 5/5 blocos ok`, exit 0

Sabotagem (prova que a suíte detecta quebra): inverter temporariamente um
sinal em `ia_compara_calcula_precos` (ex.: `$valorPlanilha - $matchValor` →
`$matchValor - $valorPlanilha`), rodar `php scripts/tests/php/test_ia_precos.php`
→ Expected: FALHAS reportadas e exit 1. **Desfazer a sabotagem** (git
checkout -- api/index.php se necessário) e rodar de novo → verde.

Run: `bash -n scripts/tests/run-all.sh scripts/tests/static-checks.sh scripts/tests/test-backup.sh`
Expected: sem saída (sintaxe ok)

- [ ] **Step 5: Commit**

```bash
git add scripts/tests/test-backup.sh scripts/tests/static-checks.sh scripts/tests/run-all.sh
git commit -m "test(suite): teste do backup (falhas + sucesso com mysqldump fake + retencao) + checagens estaticas + runner (NOVO-3 etapa 3)"
```

---

## Após o plano

`bash scripts/tests/run-all.sh` vira parte do fluxo: rodar antes de commits
relevantes (e será chamado pelo hook do DEP1 quando existir). No servidor a
suíte também roda (php/node/bash presentes) — sempre sem tocar produção.
