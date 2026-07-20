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
