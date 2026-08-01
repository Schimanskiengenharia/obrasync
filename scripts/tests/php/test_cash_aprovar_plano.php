<?php
// E3: decisão PURA da aprovação de movimento pendente — valida e monta o plano
// (título já liquidado + update do movimento). Obra é OPCIONAL por decisão do
// dono; categoria e centro são OBRIGATÓRIOS; Transferência não vira título.
require __DIR__ . '/harness.php';

$mov = ['id' => 42, 'status' => 'Pendente', 'type' => 'Saída', 'date' => '2026-07-07', 'amount' => 1880.09, 'bankAccount' => 'Sicoob'];
$ok = ['categoryId' => 3, 'costCenterId' => 2];

$r = cash_move_aprovar_plano(array_merge($mov, ['status' => 'Confirmado']), $ok);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'PENDENTE'), 'nao-pendente recusa');

$r = cash_move_aprovar_plano(array_merge($mov, ['type' => 'Transferência']), $ok);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'Dispensar'), 'transferencia orienta Dispensar');

$r = cash_move_aprovar_plano(array_merge($mov, ['type' => 'X']), $ok);
t_assert($r['acao'] === 'recusar', 'tipo desconhecido recusa');

$r = cash_move_aprovar_plano($mov, ['categoryId' => 3]);
t_assert($r['acao'] === 'recusar' && str_contains($r['motivo'], 'obrigat'), 'sem centro recusa');

$r = cash_move_aprovar_plano($mov, ['costCenterId' => 2]);
t_assert($r['acao'] === 'recusar', 'sem categoria recusa');

$r = cash_move_aprovar_plano(array_merge($mov, ['date' => '07/07/2026']), $ok);
t_assert($r['acao'] === 'recusar', 'data invalida recusa');

$r = cash_move_aprovar_plano($mov, $ok);
t_assert($r['acao'] === 'criar' && $r['table'] === 'accounts_payable' && $r['refTipo'] === 'CONTA_PAGAR', 'saida cria no pagar');
t_assert($r['titulo']['status'] === 'Pago' && $r['titulo']['paidDate'] === '2026-07-07', 'saida nasce Pago com a data do movimento');
t_assert($r['titulo']['document'] === 'MOV-42' && $r['titulo']['amount'] === 1880.09, 'document MOV-id e valor do movimento');
t_assert($r['titulo']['bankAccount'] === 'Sicoob' && $r['titulo']['dueDate'] === '2026-07-07', 'banco e vencimento herdados');
t_assert($r['titulo']['valor_original'] === null && $r['titulo']['juros_aplicado'] === null, 'sem juros inventado (v1.41.0 fica para edicao)');
t_assert($r['titulo']['projectId'] === null && $r['titulo']['supplierId'] === null, 'obra e fornecedor OPCIONAIS nascem vazios');
t_assert($r['movimentoUpdate']['status'] === 'Aprovado' && $r['movimentoUpdate']['categoryId'] === 3, 'movimento vira Aprovado com a mesma classificacao');

$r = cash_move_aprovar_plano(array_merge($mov, ['type' => 'Entrada']), array_merge($ok, ['projectId' => 7, 'parteId' => 9]));
t_assert($r['table'] === 'accounts_receivable' && $r['refTipo'] === 'CONTA_RECEBER', 'entrada cria no receber');
t_assert($r['titulo']['status'] === 'Recebido' && $r['titulo']['receivedDate'] === '2026-07-07', 'entrada nasce Recebido');
t_assert($r['titulo']['clientId'] === 9 && $r['titulo']['projectId'] === 7, 'parte vira clientId e obra vai junto');

foreach ([['status' => 'Confirmado'], ['type' => 'Transferência'], ['type' => 'X']] as $var) {
    $r = cash_move_aprovar_plano(array_merge($mov, $var), $ok);
    t_assert(!preg_match('/SELECT|INSERT|accounts_|cash_bank/i', (string) $r['motivo']), 'motivo nao vaza SQL/tabela');
}

t_resumo('test_cash_aprovar_plano');
