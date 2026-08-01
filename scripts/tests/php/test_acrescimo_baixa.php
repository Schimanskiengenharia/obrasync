<?php
// Baixa com acréscimos (juros+multa) — funções puras testadas contra o arquivo real.
//
// A REGRA ANTICASCATA é o coração: amount SEMPRE deriva de valor_original +
// juros_aplicado. valor_original é histórico — fixado na primeira baixa com
// acréscimo e NUNCA sobrescrito. Editar o acréscimo depois recalcula amount a
// partir do original (não do amount atual), senão o juros acumula a cada edição.
require __DIR__ . '/harness.php';

// ── aplicar_acrescimo_baixa ─────────────────────────────────────────────────

// Payload sem falar de acréscimo: intacto (fluxos antigos não mudam).
$r = aplicar_acrescimo_baixa(['amount' => 100.0], ['status' => 'Pago', 'amount' => 100.0]);
t_assert(!array_key_exists('juros_aplicado', $r) && $r['amount'] === 100.0, 'payload sem juros nao e tocado');

// Primeira baixa com acréscimo: original vem do amount ANTERIOR do título.
$before = ['amount' => 2204.46, 'valor_original' => null, 'juros_aplicado' => null];
$r = aplicar_acrescimo_baixa($before, ['status' => 'Pago', 'amount' => 2204.46, 'juros_aplicado' => 75.94]);
t_assert($r['valor_original'] === 2204.46, 'primeira baixa fixa valor_original = amount anterior');
t_assert($r['juros_aplicado'] === 75.94, 'primeira baixa guarda o acrescimo');
t_assert($r['amount'] === 2280.40, 'amount = original + acrescimo');

// ANTICASCATA: editar o acréscimo recalcula do ORIGINAL, não do amount atual.
$before2 = ['amount' => 2280.40, 'valor_original' => 2204.46, 'juros_aplicado' => 75.94];
$r = aplicar_acrescimo_baixa($before2, ['amount' => 2280.40, 'juros_aplicado' => 50.0]);
t_assert($r['amount'] === 2254.46, 'editar acrescimo recalcula a partir do original');
t_assert($r['valor_original'] === 2204.46, 'valor_original NUNCA e sobrescrito');

// Reeditar com o MESMO acréscimo não acumula (idempotente).
$before3 = ['amount' => 2254.46, 'valor_original' => 2204.46, 'juros_aplicado' => 50.0];
$r = aplicar_acrescimo_baixa($before3, ['amount' => 2254.46, 'juros_aplicado' => 50.0]);
t_assert($r['amount'] === 2254.46, 'reeditar com o mesmo acrescimo nao acumula');

// Zerar o acréscimo devolve o título ao original, preservando o histórico.
$r = aplicar_acrescimo_baixa($before3, ['amount' => 2254.46, 'juros_aplicado' => 0]);
t_assert($r['amount'] === 2204.46, 'zerar acrescimo devolve amount ao original');
t_assert($r['valor_original'] === 2204.46, 'zerar acrescimo preserva valor_original');

// Zero sem histórico: não é fluxo de acréscimo — amount do payload fica como veio.
$r = aplicar_acrescimo_baixa(['amount' => 300.0, 'valor_original' => null], ['amount' => 350.0, 'juros_aplicado' => 0]);
t_assert($r['amount'] === 350.0, 'juros 0 sem historico nao interfere no amount enviado');
t_assert(!array_key_exists('valor_original', $r) || $r['valor_original'] === null, 'juros 0 sem historico nao grava valor_original');

// Acréscimo negativo é tratado como zero (não existe "desconto" neste fluxo).
$r = aplicar_acrescimo_baixa($before3, ['amount' => 2254.46, 'juros_aplicado' => -10]);
t_assert($r['amount'] === 2204.46 && $r['juros_aplicado'] === 0.0, 'acrescimo negativo vira zero');

// Payload com valor_original forjado pelo cliente não vence o histórico do banco.
$r = aplicar_acrescimo_baixa($before2, ['amount' => 9999.0, 'valor_original' => 9999.0, 'juros_aplicado' => 50.0]);
t_assert($r['valor_original'] === 2204.46 && $r['amount'] === 2254.46, 'valor_original do banco vence o do payload');

// ── financeiro_baixa_audit_details ──────────────────────────────────────────

// Baixa completa: status + data + amount + juros aparecem no antes→depois.
$d = financeiro_baixa_audit_details(
    ['status' => 'Aberto', 'paidDate' => null, 'amount' => 2204.46, 'juros_aplicado' => null, 'valor_original' => null],
    ['status' => 'Pago', 'paidDate' => '2026-08-01', 'amount' => 2280.40, 'juros_aplicado' => 75.94, 'valor_original' => 2204.46],
    'paidDate'
);
t_assert(str_contains($d, 'status: Aberto→Pago'), 'diff registra status antes→depois');
t_assert(str_contains($d, 'paidDate: —→2026-08-01'), 'diff registra a data da baixa');
t_assert(str_contains($d, 'amount: 2.204,46→2.280,40'), 'diff registra o valor antes→depois');
t_assert(str_contains($d, 'juros_aplicado: —→75,94'), 'diff registra o acrescimo');
t_assert(str_contains($d, 'valor_original: —→2.204,46'), 'diff registra o original fixado');

// Sem mudança nos campos sensíveis: details vazio (audit segue só com quem/quando).
$mesmo = ['status' => 'Pago', 'receivedDate' => '2026-08-01', 'amount' => 500.0, 'juros_aplicado' => null, 'valor_original' => null];
t_assert(financeiro_baixa_audit_details($mesmo, $mesmo, 'receivedDate') === '', 'sem mudanca -> details vazio');

// Igualdade numérica não é enganada por formato ("50" vs "50.00").
$d = financeiro_baixa_audit_details(
    ['status' => 'Pago', 'paidDate' => '2026-08-01', 'amount' => 50.0, 'juros_aplicado' => null, 'valor_original' => null],
    ['status' => 'Pago', 'paidDate' => '2026-08-01', 'amount' => '50.00', 'juros_aplicado' => null, 'valor_original' => null],
    'paidDate'
);
t_assert($d === '', 'numero igual em formato diferente nao gera diff');

// Nenhum valor do diff escapa da máscara do lado do cliente: o details fica no
// audit_log (tela de auditoria), não em toast — mas não pode vazar SQL/técnica.
t_assert(!preg_match('/SELECT|UPDATE|INSERT|accounts_/i', $d ?: 'x'), 'details nao vaza SQL nem nome de tabela');

t_resumo('test_acrescimo_baixa');
