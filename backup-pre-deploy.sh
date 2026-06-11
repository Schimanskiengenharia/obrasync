#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Backup automático executado ANTES de cada deploy (chamado pelo deploy.php).
# Salva um dump compactado do banco e uma cópia dos uploads em
# /var/lib/financeiro/backups/pre-deploy/AAAAMMDD-HHMMSS/ e mantém apenas os
# 10 backups mais recentes.
#
# Uso manual: bash backup-pre-deploy.sh
# Variáveis opcionais: CONFIG_FILE, BACKUP_ROOT, UPLOADS_DIR, KEEP
# ──────────────────────────────────────────────────────────────────────────────
set -u

CONFIG_FILE="${CONFIG_FILE:-/etc/financeiro/config.php}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/lib/financeiro/backups/pre-deploy}"
UPLOADS_DIR="${UPLOADS_DIR:-/var/lib/financeiro/uploads}"
KEEP="${KEEP:-10}"

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/${STAMP}"

if ! mkdir -p "${DEST}"; then
  echo "ERRO: sem permissão para criar ${DEST}"
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
       -h "${DB_HOST:-127.0.0.1}" -u "${DB_USER}" "${DB_NAME}" 2>"${DEST}/mysqldump.err" \
       | gzip > "${DEST}/banco-${DB_NAME}.sql.gz"; then
    rm -f "${DEST}/mysqldump.err"
    echo "OK: dump do banco ${DB_NAME} salvo em ${DEST}/banco-${DB_NAME}.sql.gz"
  else
    echo "ERRO: falha no mysqldump do banco ${DB_NAME} (veja ${DEST}/mysqldump.err)"
  fi
else
  echo "AVISO: credenciais do banco não encontradas em ${CONFIG_FILE}; dump ignorado"
fi

if [ -d "${UPLOADS_DIR}" ]; then
  if tar -czf "${DEST}/uploads.tar.gz" -C "$(dirname "${UPLOADS_DIR}")" "$(basename "${UPLOADS_DIR}")" 2>/dev/null; then
    echo "OK: uploads copiados para ${DEST}/uploads.tar.gz"
  else
    echo "ERRO: falha ao compactar ${UPLOADS_DIR}"
  fi
else
  echo "AVISO: pasta de uploads ${UPLOADS_DIR} não existe; cópia ignorada"
fi

# Mantém apenas os ${KEEP} backups mais recentes (pastas mais antigas são removidas).
ls -1dt "${BACKUP_ROOT}"/*/ 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -rf

echo "Backup pré-deploy concluído: ${DEST}"
