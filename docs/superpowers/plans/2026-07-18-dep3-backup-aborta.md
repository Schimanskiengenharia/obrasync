# DEP3: Backup Obrigatório + Abort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `backup-pre-deploy.sh` passa a falhar de verdade (pipefail, validação, escrita atômica) e `deploy.php` aborta o deploy com 500 quando o backup é inválido — nada é publicado sem backup válido. Inclui 2 caronas aprovadas pela revisão final do NOVO-4.

**Architecture:** Task 1 reescreve o script bash (coleta de erros, exit 1 no fim); Task 2 torna o backup obrigatório no deploy.php (abort ANTES do git pull); Task 3 aplica as caronas (sentinelas de exit + stderr do git no log). Um commit por task.

**Tech Stack:** Bash (`set -u -o pipefail`, `gzip -t`, mv atômico), PHP puro.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-dep3-backup-aborta-design.md` — em dúvida, ela manda.
- **Somente** `backup-pre-deploy.sh` e `deploy.php` alterados. NUNCA tocar `/etc/financeiro/config.php`, uploads, backups reais, banco.
- Validações antes de cada commit: `bash -n backup-pre-deploy.sh` e/ou `php -l deploy.php` (conforme o arquivo tocado) + `git ls-files --eol <arquivo>` → deve conter `i/lf w/lf`.
- A invocação via sudoers NÃO muda (`/usr/bin/bash <script>`); só o conteúdo do script.
- Testes locais usam SEMPRE diretórios do scratchpad (`C:\Users\schim\AppData\Local\Temp\claude\C--Users-schim-Documents-Codex-2026-06-05-crie-um-sistema-web-financeiro-e\a25bec57-3858-42ea-8b35-af8bc522660c\scratchpad`) via env vars — nunca caminhos reais.
- Commits com as mensagens exatas de cada task. **Sem `git push`** (manual).
- Repo: raiz em `outputs\`.

---

### Task 1: Reescrever `backup-pre-deploy.sh`

**Files:**
- Modify: `backup-pre-deploy.sh` (reescrita completa — 67 linhas atuais)

**Interfaces:**
- Produces: contrato de exit code que a Task 2 consome — **exit 0 = backup completo e validado** (diretório final `${BACKUP_ROOT}/${STAMP}/` existe); **exit 1 = qualquer falha** (diretório parcial fica em `${BACKUP_ROOT}/.tmp-${STAMP}/` para diagnóstico). Env vars `CONFIG_FILE`/`BACKUP_ROOT`/`UPLOADS_DIR`/`KEEP` inalteradas.

- [ ] **Step 1: Substituir o conteúdo COMPLETO do arquivo por:**

```bash
#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Backup automático executado ANTES de cada deploy (chamado pelo deploy.php).
# Gera o dump compactado do banco + a cópia dos uploads em um diretório
# temporário (.tmp-<STAMP>) e, SÓ com tudo gerado e validado, renomeia
# atomicamente para /var/lib/financeiro/backups/pre-deploy/AAAAMMDD-HHMMSS/.
# Mantém apenas os ${KEEP} backups mais recentes.
#
# QUALQUER falha (credenciais ausentes, mysqldump, tar, arquivo vazio ou
# corrompido) termina com exit 1 listando TODOS os erros — o deploy.php
# ABORTA o deploy nesse caso. Dump e uploads são OBRIGATÓRIOS.
#
# Uso manual: bash backup-pre-deploy.sh
# Variáveis opcionais: CONFIG_FILE, BACKUP_ROOT, UPLOADS_DIR, KEEP
# ──────────────────────────────────────────────────────────────────────────────
set -u -o pipefail

CONFIG_FILE="${CONFIG_FILE:-/etc/financeiro/config.php}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/lib/financeiro/backups/pre-deploy}"
UPLOADS_DIR="${UPLOADS_DIR:-/var/lib/financeiro/uploads}"
KEEP="${KEEP:-10}"

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/${STAMP}"
TMP="${BACKUP_ROOT}/.tmp-${STAMP}"

ERRORS=()
erro() { ERRORS+=("$1"); echo "ERRO: $1"; }

# Valida um .gz: existe, não-vazio e íntegro (gzip -t).
valida_gz() {
  local arquivo="$1" rotulo="$2"
  if [ ! -s "${arquivo}" ]; then
    erro "${rotulo}: arquivo ausente ou vazio (${arquivo})"
    return 1
  fi
  if ! gzip -t "${arquivo}" 2>/dev/null; then
    erro "${rotulo}: arquivo corrompido — gzip -t falhou (${arquivo})"
    return 1
  fi
  return 0
}

# Remove .tmp-* de falhas antigas (>7 dias) — best-effort.
find "${BACKUP_ROOT}" -maxdepth 1 -type d -name '.tmp-*' -mtime +7 -exec rm -rf {} + 2>/dev/null

if ! mkdir -p "${TMP}"; then
  echo "ERRO: sem permissão para criar ${TMP}"
  exit 1
fi

# Credenciais do banco extraídas do mesmo config usado pela API (db.host,
# db.database, db.user, db.password).
DB_INFO="$(CONFIG_FILE="${CONFIG_FILE}" php -r '
  $file = getenv("CONFIG_FILE");
  if (!is_file($file)) { exit(1); }
  $c  = require $file;
  $db = $c["db"] ?? [];
  echo ($db["host"] ?? "127.0.0.1"), "\t",
       ($db["database"] ?? ""), "\t",
       ($db["user"] ?? ""), "\t",
       ($db["password"] ?? "");
' 2>/dev/null)" || DB_INFO=""

IFS=$'\t' read -r DB_HOST DB_NAME DB_USER DB_PASS <<< "${DB_INFO}"

if [ -n "${DB_NAME:-}" ] && [ -n "${DB_USER:-}" ]; then
  if MYSQL_PWD="${DB_PASS:-}" mysqldump --single-transaction --quick --routines \
       -h "${DB_HOST:-127.0.0.1}" -u "${DB_USER}" "${DB_NAME}" 2>"${TMP}/mysqldump.err" \
       | gzip > "${TMP}/banco-${DB_NAME}.sql.gz"; then
    if valida_gz "${TMP}/banco-${DB_NAME}.sql.gz" "dump do banco"; then
      rm -f "${TMP}/mysqldump.err"
      echo "OK: dump do banco ${DB_NAME} gerado e validado"
    fi
  else
    erro "falha no mysqldump do banco ${DB_NAME} (veja ${TMP}/mysqldump.err)"
  fi
else
  erro "credenciais do banco não encontradas em ${CONFIG_FILE} — dump é OBRIGATÓRIO"
fi

if [ -d "${UPLOADS_DIR}" ]; then
  if tar -czf "${TMP}/uploads.tar.gz" -C "$(dirname "${UPLOADS_DIR}")" "$(basename "${UPLOADS_DIR}")" 2>"${TMP}/tar.err"; then
    if valida_gz "${TMP}/uploads.tar.gz" "uploads"; then
      rm -f "${TMP}/tar.err"
      echo "OK: uploads copiados e validados"
    fi
  else
    erro "falha ao compactar ${UPLOADS_DIR} (veja ${TMP}/tar.err)"
  fi
else
  erro "pasta de uploads ${UPLOADS_DIR} não existe — backup de uploads é OBRIGATÓRIO"
fi

if [ "${#ERRORS[@]}" -gt 0 ]; then
  echo "Backup pré-deploy FALHOU com ${#ERRORS[@]} erro(s):"
  printf ' - %s\n' "${ERRORS[@]}"
  echo "Artefatos parciais mantidos para diagnóstico em: ${TMP}"
  exit 1
fi

if ! mv "${TMP}" "${DEST}"; then
  echo "ERRO: falha ao renomear ${TMP} para ${DEST}"
  exit 1
fi

# Mantém apenas os ${KEEP} backups mais recentes (best-effort, não bloqueia).
ls -1dt "${BACKUP_ROOT}"/*/ 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -rf

echo "Backup pré-deploy concluído: ${DEST}"
```

- [ ] **Step 2: Validar sintaxe e line endings**

Run: `bash -n backup-pre-deploy.sh`
Expected: (sem saída — sintaxe ok)

Run: `git ls-files --eol backup-pre-deploy.sh`
Expected: contém `i/lf	w/lf`

- [ ] **Step 3: Teste local A — tudo falha (config e uploads inexistentes)**

```bash
SCRATCH="C:\Users\schim\AppData\Local\Temp\claude\C--Users-schim-Documents-Codex-2026-06-05-crie-um-sistema-web-financeiro-e\a25bec57-3858-42ea-8b35-af8bc522660c\scratchpad"
mkdir -p "$SCRATCH/bkroot"
CONFIG_FILE="$SCRATCH/nao-existe.php" BACKUP_ROOT="$SCRATCH/bkroot" UPLOADS_DIR="$SCRATCH/nao-existe-uploads" bash backup-pre-deploy.sh; echo "exit=$?"
```

Expected: saída contém `ERRO: credenciais do banco não encontradas`, `ERRO: pasta de uploads ... não existe`, `FALHOU com 2 erro(s)` e `exit=1`; existe um diretório `$SCRATCH/bkroot/.tmp-*` (parcial mantido) e NENHUM diretório final.

- [ ] **Step 4: Teste local B — uploads válidos, credenciais ausentes (falha parcial)**

```bash
SCRATCH="C:\Users\schim\AppData\Local\Temp\claude\C--Users-schim-Documents-Codex-2026-06-05-crie-um-sistema-web-financeiro-e\a25bec57-3858-42ea-8b35-af8bc522660c\scratchpad"
mkdir -p "$SCRATCH/uploads-fake" && echo "conteudo" > "$SCRATCH/uploads-fake/arq.txt"
CONFIG_FILE="$SCRATCH/nao-existe.php" BACKUP_ROOT="$SCRATCH/bkroot" UPLOADS_DIR="$SCRATCH/uploads-fake" bash backup-pre-deploy.sh; echo "exit=$?"
```

Expected: `OK: uploads copiados e validados` + `ERRO: credenciais...` + `FALHOU com 1 erro(s)` + `exit=1`; dentro do novo `.tmp-*` existe `uploads.tar.gz` válido (`gzip -t` passa) — prova que tar+validação funcionam; nenhum diretório final criado (atomicidade preservada na falha).

- [ ] **Step 5: Commit**

```bash
git add backup-pre-deploy.sh
git commit -m "fix(backup): pipefail + validacao gzip + escrita atomica - qualquer falha termina exit 1 listando erros (DEP3 etapa 1)"
```

---

### Task 2: `deploy.php` aborta sem backup válido

**Files:**
- Modify: `deploy.php:60-75` (bloco do backup)

**Interfaces:**
- Consumes: contrato de exit da Task 1 (0 = válido; ≠0 = abortar).
- Produces: `$backupExit`/`$backupOutput` seguem existindo; deploy aborta com 500 ANTES do `git pull` quando `$backupExit !== 0`.

- [ ] **Step 1: Substituir o bloco do backup (linhas 60-75) por:**

Substituir:

```php
// 1) Backup automático pré-deploy (dump do banco + uploads). Uma falha no backup
//    não bloqueia o deploy, mas fica registrada no log para conferência.
$backupScript = $appDir . '/backup-pre-deploy.sh';
$backupOutput = 'backup-pre-deploy.sh não encontrado; backup pulado';
if (is_file($backupScript)) {
    // /usr/bin/bash explícito: o sudoers exige match exato do comando; "bash" sem
    // caminho pode resolver para outro binário e não casar com a regra. O -n faz o
    // sudo falhar na hora em vez de aguardar senha sem TTY (travamento silencioso).
    $backupLines = [];
    $backupExit  = 0;
    exec('sudo -n -u alefschimanski /usr/bin/bash ' . escapeshellarg($backupScript) . ' 2>&1', $backupLines, $backupExit);
    $backupOutput = implode("\n", $backupLines);
    if ($backupExit !== 0) {
        $backupOutput = "[ALERTA] Backup pré-deploy FALHOU (exit {$backupExit}) — confira a regra do sudoers.\n" . $backupOutput;
    }
}
```

por:

```php
// 1) Backup automático pré-deploy (dump do banco + uploads) — OBRIGATÓRIO:
//    se o backup falhar (ou o script não existir), o deploy é ABORTADO antes
//    do git pull. Nada é publicado sem backup válido (DEP3).
$backupScript = $appDir . '/backup-pre-deploy.sh';
$backupLines  = [];
$backupExit   = 1;
$backupOutput = '';
if (!is_file($backupScript)) {
    $backupOutput = '[ERRO] backup-pre-deploy.sh não encontrado — backup é obrigatório';
} else {
    // /usr/bin/bash explícito: o sudoers exige match exato do comando; "bash" sem
    // caminho pode resolver para outro binário e não casar com a regra. O -n faz o
    // sudo falhar na hora em vez de aguardar senha sem TTY (travamento silencioso).
    exec('sudo -n -u alefschimanski /usr/bin/bash ' . escapeshellarg($backupScript) . ' 2>&1', $backupLines, $backupExit);
    $backupOutput = implode("\n", $backupLines);
    if ($backupExit !== 0) {
        $backupOutput = "[ERRO] Backup pré-deploy FALHOU (exit {$backupExit}) — deploy abortado.\n" . $backupOutput;
    }
}

if ($backupExit !== 0) {
    $abortMsg = date('Y-m-d H:i:s') . " — Deploy ABORTADO (backup pré-deploy inválido):\n"
        . ($lockNote !== '' ? $lockNote . "\n" : '')
        . trim((string) $backupOutput) . "\n---\n";
    @file_put_contents("{$logDir}/deploy.log", $abortMsg, FILE_APPEND);
    http_response_code(500);
    die("Deploy ABORTADO — backup pré-deploy falhou; confira {$logDir}/deploy.log");
}
```

(Observação: `$backupExit = 1` inicial já serve de sentinela — se o `exec`
não rodar, o deploy aborta em vez de seguir.)

- [ ] **Step 2: Validar sintaxe e line endings**

Run: `php -l deploy.php`
Expected: `No syntax errors detected`

Run: `git ls-files --eol deploy.php`
Expected: contém `i/lf	w/lf`

- [ ] **Step 3: Commit**

```bash
git add deploy.php
git commit -m "feat(deploy): backup pre-deploy obrigatorio - falha aborta o deploy com 500 antes do git pull (DEP3 etapa 2)"
```

---

### Task 3: Caronas do NOVO-4 (sentinelas + stderr do git no log)

**Files:**
- Modify: `deploy.php` — linhas do pull (`$pullExit  = 0;`), da verificação de commit (`$headExit  = 0;` e os dois `$commitNote` de erro)

**Interfaces:**
- Consumes: bloco de verificação de commit existente (NOVO-4 etapa 3).
- Produces: nada novo — mensagens de log mais ricas e sentinelas de exit.

- [ ] **Step 1: Sentinelas de exit (exec não rodou ⇒ falha, nunca sucesso)**

Trocar `$pullExit  = 0;` por `$pullExit  = -1;` (bloco do pull) e
`$headExit  = 0;` por `$headExit  = -1;` (bloco da verificação de commit).
(`$ancestorExit = 1;` já é sentinela seguro; `$backupExit = 1` foi feito na
Task 2.)

- [ ] **Step 2: Anexar stderr do git às mensagens de erro da verificação**

Trocar:

```php
            $commitFail = true;
            $commitNote = "[ERRO] git rev-parse HEAD falhou (exit {$headExit})";
```

por:

```php
            $commitFail = true;
            $commitNote = "[ERRO] git rev-parse HEAD falhou (exit {$headExit})"
                . ($headLines ? "\n" . implode("\n", $headLines) : '');
```

E trocar:

```php
                $commitFail = true;
                $commitNote = "[ERRO] HEAD ({$headSha}) não contém o commit do webhook ({$afterSha})";
```

por:

```php
                $commitFail = true;
                $commitNote = "[ERRO] HEAD ({$headSha}) não contém o commit do webhook ({$afterSha})"
                    . ($ancestorOut ? "\n" . implode("\n", $ancestorOut) : '');
```

- [ ] **Step 3: Validar sintaxe e line endings**

Run: `php -l deploy.php`
Expected: `No syntax errors detected`

Run: `git ls-files --eol deploy.php`
Expected: contém `i/lf	w/lf`

- [ ] **Step 4: Commit**

```bash
git add deploy.php
git commit -m "fix(deploy): sentinelas de exit nos exec + stderr do git nas mensagens de erro do log (caronas NOVO-4)"
```

---

## Após o plano

Validação no servidor (próximo push autorizado, valida DEP3 + NOVO-4
juntos): sucesso → `deploy.log` com `[lock] adquirido`, backup OK com
caminho final, `[git pull]`, `[commit] HEAD ... contém ...`, delivery 200.
Teste de falha (opcional, no servidor): `BACKUP_ROOT` temporariamente sem
permissão → delivery 500 "Deploy ABORTADO" e nada publicado.
