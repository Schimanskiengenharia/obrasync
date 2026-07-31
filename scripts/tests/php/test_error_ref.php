<?php
// E4: código de correlação de erro 500 — funções puras testadas contra o arquivo real.
// Contrato: 4xx nunca ganha código (mensagem já é acionável); >=500 anexa
// "(código: <uuid v4>)" e o MESMO uuid vale para o request inteiro (static),
// para a mensagem do usuário e o error_log apontarem para a mesma linha.
require __DIR__ . '/harness.php';

t_assert(apply_error_ref('Falhou.', 400) === 'Falhou.', '400 nao ganha codigo');
t_assert(apply_error_ref('Falhou.', 422) === 'Falhou.', '422 nao ganha codigo');
t_assert(apply_error_ref('Falhou.', 499) === 'Falhou.', '499 nao ganha codigo');

$m500 = apply_error_ref('Erro interno.', 500);
t_assert(str_starts_with($m500, 'Erro interno. (código: '), '500 anexa o codigo no fim');
$m503 = apply_error_ref('Fora do ar.', 503);
t_assert(str_contains($m503, '(código: '), '503 tambem anexa');

$ref = obra_error_ref();
t_assert(preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $ref) === 1,
    'obra_error_ref e UUID v4 minusculo');
t_assert(obra_error_ref() === $ref, 'mesmo request -> mesmo codigo');
t_assert(str_contains($m500, $ref) && str_contains($m503, $ref), 'mensagens usam o codigo do request');

t_resumo('test_error_ref');
