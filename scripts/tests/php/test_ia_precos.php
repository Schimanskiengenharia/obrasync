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
