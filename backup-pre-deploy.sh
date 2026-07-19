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
