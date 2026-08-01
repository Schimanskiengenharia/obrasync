<?php
// E2: guarda do vínculo — um movimento já reivindicado por OUTRO título vivo não
// pode ser vinculado de novo (o fluxo manual legado gravava referência sem fitid;
// caso real: movimento #4 → CONTA_PAGAR título 1). Referência órfã ou do próprio
// título é livre. CAIXA_MANUAL no movimento não é reivindicação de baixa.
require __DIR__ . '/harness.php';

$livre = ['referencia_tipo' => null, 'referencia_id' => null];
t_assert(ofx_movimento_livre($livre, null, 10, true) === null, 'sem referencia -> livre');

$manual = ['referencia_tipo' => 'CAIXA_MANUAL', 'referencia_id' => 3];
t_assert(ofx_movimento_livre($manual, null, 10, true) === null, 'CAIXA_MANUAL no movimento -> livre');

$claimPagar = ['referencia_tipo' => 'CONTA_PAGAR', 'referencia_id' => 1];
$m = ofx_movimento_livre($claimPagar, ['id' => 1, 'document' => 'NF-778'], 10, true);
t_assert(is_string($m) && str_contains($m, 'NF-778'), 'referencia viva de OUTRO titulo -> recusa citando o documento');

t_assert(ofx_movimento_livre($claimPagar, null, 10, true) === null, 'referencia orfa (titulo apagado) -> livre');

t_assert(ofx_movimento_livre($claimPagar, ['id' => 1, 'document' => 'NF-778'], 1, true) === null, 'proprio titulo (mesmo lado) -> livre (revincular idempotente)');

$m = ofx_movimento_livre($claimPagar, ['id' => 1, 'document' => 'NF-778'], 1, false);
t_assert(is_string($m), 'mesmo id mas lado RECEBER -> recusa (nao e o mesmo titulo)');

$claimReceber = ['referencia_tipo' => 'CONTA_RECEBER', 'referencia_id' => 9];
$m = ofx_movimento_livre($claimReceber, ['id' => 9, 'document' => 'MARCO-2'], 4, false);
t_assert(is_string($m) && str_contains($m, 'MARCO-2'), 'CONTA_RECEBER viva de outro titulo -> recusa');

t_assert(ofx_movimento_livre(['referencia_tipo' => 'CONTA_PAGAR', 'referencia_id' => 0], null, 10, true) === null, 'referencia_id 0 -> livre');

$m = ofx_movimento_livre($claimPagar, ['id' => 1], 10, true);
t_assert(is_string($m) && str_contains($m, '#1'), 'titulo sem document -> cita #id');

t_assert(!preg_match('/SELECT|UPDATE|accounts_|cash_bank/i', (string) ofx_movimento_livre($claimPagar, ['id' => 1, 'document' => 'X'], 10, true)), 'motivo nao vaza SQL/tabela');

t_resumo('test_ofx_movimento_livre');
