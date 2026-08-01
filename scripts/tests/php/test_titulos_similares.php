<?php
// E3/E4: classificação PURA da suspeita de duplicidade. Candidatos já chegam
// filtrados pelo SQL (valor exato + vencimento ±5d) — aqui só o grau: mesma
// parte (fornecedor/cliente) = ALTA; senão MÉDIA; alta primeiro.
require __DIR__ . '/harness.php';

$c1 = ['id' => 1, 'document' => 'NF-1', 'supplierId' => 5, 'clientId' => null];
$c2 = ['id' => 2, 'document' => 'NF-2', 'supplierId' => 8, 'clientId' => null];
$c3 = ['id' => 3, 'document' => 'REC-3', 'supplierId' => null, 'clientId' => 5];

$r = titulos_similares_classificar([$c2, $c1], 5);
t_assert($r[0]['id'] === 1 && $r[0]['suspeita'] === 'alta', 'mesma parte (fornecedor) = alta, e vem primeiro');
t_assert($r[1]['suspeita'] === 'media', 'parte diferente = media');

$r = titulos_similares_classificar([$c3], 5);
t_assert($r[0]['suspeita'] === 'alta', 'mesma parte (cliente) = alta');

$r = titulos_similares_classificar([$c1, $c2], null);
t_assert($r[0]['suspeita'] === 'media' && $r[1]['suspeita'] === 'media', 'sem parte informada tudo e media');

t_assert(titulos_similares_classificar([], 5) === [], 'vazio -> vazio');

$r = titulos_similares_classificar([$c1], '');
t_assert($r[0]['suspeita'] === 'media', 'parte vazia (string) nao vira alta');

t_resumo('test_titulos_similares');
