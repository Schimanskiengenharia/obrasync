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
