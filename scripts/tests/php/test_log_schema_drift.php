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
