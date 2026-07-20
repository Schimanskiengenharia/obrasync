#!/usr/bin/env bash
# Ponto de entrada da suíte mínima (NOVO-3). Exit != 0 se qualquer teste
# falhar — é o que o futuro hook pre-push (DEP1) vai chamar.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
TOTAL=0
FALHAS=0

# O api/index.php usa mb_* (92 chamadas); em PHP local sem php.ini o mbstring
# pode não carregar — habilita via flag só quando faltar (no servidor já vem).
PHP_ARGS=()
if ! php -m 2>/dev/null | grep -qi '^mbstring$'; then
  EXT_DIR="$(dirname "$(php -r 'echo PHP_BINARY;')")/ext"
  PHP_ARGS=(-d "extension_dir=${EXT_DIR}" -d extension=mbstring)
fi

rodar() {
  TOTAL=$((TOTAL + 1))
  echo "== $1"
  if ! "$@"; then FALHAS=$((FALHAS + 1)); fi
}

rodar bash "${DIR}/static-checks.sh"
for t in "${DIR}"/php/test_*.php; do
  rodar php ${PHP_ARGS[@]+"${PHP_ARGS[@]}"} "${t}"
done
rodar bash "${DIR}/test-backup.sh"

echo "----------------------------------------"
if [ "${FALHAS}" -gt 0 ]; then
  echo "SUITE: ${FALHAS}/${TOTAL} bloco(s) com falha"
  exit 1
fi
echo "SUITE: ${TOTAL}/${TOTAL} blocos ok"
