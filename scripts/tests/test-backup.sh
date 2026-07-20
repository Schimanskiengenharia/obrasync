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
