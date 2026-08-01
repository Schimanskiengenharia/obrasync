<?php
// Conciliação E1: decisão PURA do vínculo tardio — testada contra o arquivo real.
// Contrato: lado coerente (Saída↔pagar, Entrada↔receber); valor IGUAL (2 casas);
// cancelado/já-vinculado/CAIXA_MANUAL recusam com motivo amigável; título já
// baixado vira 'vincular' (linkedOnly); herança projectId/categoria/centro =
// payload > título > vazio. Obra é OPCIONAL por decisão do dono.
require __DIR__ . '/harness.php';

$tituloAberto = ['status' => 'Aberto', 'amount' => 256991.45, 'ofxFitid' => null, 'referencia_tipo' => null, 'referencia_id' => null, 'projectId' => 7, 'categoryId' => 3, 'costCenterId' => null];
$movSaida = ['type' => 'Saída', 'amount' => 256991.45, 'date' => '2026-07-07'];
$movEntrada = ['type' => 'Entrada', 'amount' => 256991.45, 'date' => '2026-07-07'];

$r = ofx_vinculo_plano($tituloAberto, $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'baixar' && $r['status'] === 'Pago' && $r['dateField'] === 'paidDate', 'pagar aberto + saida -> baixar Pago/paidDate');

$r = ofx_vinculo_plano($tituloAberto, $movEntrada, ['table' => 'accounts_receivable']);
t_assert($r['acao'] === 'baixar' && $r['status'] === 'Recebido' && $r['dateField'] === 'receivedDate', 'receber aberto + entrada -> baixar Recebido/receivedDate');

$r = ofx_vinculo_plano($tituloAberto, $movEntrada, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'ENTRADA'), 'entrada nao baixa conta a pagar');

$r = ofx_vinculo_plano($tituloAberto, $movSaida, ['table' => 'accounts_receivable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'SAÍDA'), 'saida nao baixa conta a receber');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['status' => 'Cancelado']), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'ancelado'), 'cancelado recusa');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['ofxFitid' => 'X1']), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'vinculado'), 'titulo ja vinculado recusa');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['referencia_tipo' => 'CAIXA_MANUAL', 'referencia_id' => 44]), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'manual'), 'CAIXA_MANUAL com id recusa (evita saida dupla)');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['referencia_tipo' => 'CAIXA_MANUAL', 'referencia_id' => null]), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'baixar', 'CAIXA_MANUAL sem id NAO recusa');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['amount' => 100.00]), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'difere'), 'valor diferente recusa (juros e etapa futura)');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['amount' => '256991.450']), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'baixar', 'igualdade em 2 casas nao e enganada por formato');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['status' => 'Pago']), $movSaida, ['table' => 'accounts_payable']);
t_assert($r['acao'] === 'vincular', 'ja baixado -> so vincular (linkedOnly)');

$r = ofx_vinculo_plano($tituloAberto, $movSaida, ['table' => 'accounts_payable', 'projectId' => 9]);
t_assert($r['herda']['projectId'] === 9, 'payload vence o titulo na heranca');

$r = ofx_vinculo_plano($tituloAberto, $movSaida, ['table' => 'accounts_payable']);
t_assert($r['herda']['projectId'] === 7 && $r['herda']['categoryId'] === 3, 'sem payload herda do titulo');
t_assert($r['herda']['costCenterId'] === null, 'ambos vazios -> null (obra/centro OPCIONAL)');

$r = ofx_vinculo_plano(array_merge($tituloAberto, ['projectId' => null]), $movSaida, ['table' => 'accounts_payable', 'projectId' => '']);
t_assert($r['herda']['projectId'] === null, 'payload vazio + titulo vazio -> null, sem inventar');

foreach ([['status' => 'Cancelado'], ['ofxFitid' => 'X'], ['amount' => 1], ['referencia_tipo' => 'CAIXA_MANUAL', 'referencia_id' => 1]] as $variacao) {
    $r = ofx_vinculo_plano(array_merge($tituloAberto, $variacao), $movSaida, ['table' => 'accounts_payable']);
    t_assert(!preg_match('/SELECT|UPDATE|accounts_|cash_bank/i', (string) $r['motivo']), 'motivo nao vaza SQL/tabela');
}

t_resumo('test_ofx_vinculo');
