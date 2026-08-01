<?php
// E2: as puras da fila de pendências — confiança (mesma tabela de descontos da
// prévia), bucket de relevância e ordenação global (alta → média → sem; confiança
// e data desc dentro do bucket). A régua ≥85 é a MESMA do autoMatch da prévia.
require __DIR__ . '/harness.php';

t_assert(ofx_match_confianca(0, false, false) === 100, 'dia 0 -> 100');
t_assert(ofx_match_confianca(1, false, false) === 100, 'dia 1 -> 100 (desconto so acima de 1)');
t_assert(ofx_match_confianca(3, false, false) === 85, '3 dias -> 85');
t_assert(ofx_match_confianca(0, true, false) === 80, 'ja baixado -> -20');
t_assert(ofx_match_confianca(0, false, true) === 85, 'conta divergente -> -15');
t_assert(ofx_match_confianca(5, true, true) === 40, 'combinado 5d+baixado+diverge -> 40');
t_assert(ofx_match_confianca(30, true, true) === 0, 'piso zero');

t_assert(ofx_pendencia_bucket([]) === 'sem', 'sem matches -> sem');
t_assert(ofx_pendencia_bucket([['confidence' => 85]]) === 'alta', 'melhor >=85 -> alta');
t_assert(ofx_pendencia_bucket([['confidence' => 84]]) === 'media', 'melhor 84 -> media');

$rows = [
    ['fitid' => 'S', 'date' => '2026-07-30', 'bucket' => 'sem', 'matches' => []],
    ['fitid' => 'M', 'date' => '2026-07-10', 'bucket' => 'media', 'matches' => [['confidence' => 70]]],
    ['fitid' => 'A1', 'date' => '2026-07-01', 'bucket' => 'alta', 'matches' => [['confidence' => 90]]],
    ['fitid' => 'A2', 'date' => '2026-07-20', 'bucket' => 'alta', 'matches' => [['confidence' => 100]]],
];
$ordenado = array_column(ofx_pendencias_ordenar($rows), 'fitid');
t_assert($ordenado === ['A2', 'A1', 'M', 'S'], 'alta(conf desc) -> media -> sem');

$rows2 = [
    ['fitid' => 'B', 'date' => '2026-07-01', 'bucket' => 'alta', 'matches' => [['confidence' => 90]]],
    ['fitid' => 'C', 'date' => '2026-07-15', 'bucket' => 'alta', 'matches' => [['confidence' => 90]]],
];
t_assert(array_column(ofx_pendencias_ordenar($rows2), 'fitid') === ['C', 'B'], 'empate de confianca -> data mais recente primeiro');

t_resumo('test_ofx_pendencias');
