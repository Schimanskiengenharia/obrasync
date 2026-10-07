<?php
// S4 — o token de sessão só entra por header (Authorization: Bearer ou X-Auth-Token);
// NUNCA pela query string (?token=), nem no download de NF (antigo fallback removido).
require __DIR__ . '/harness.php';

function limpar_ambiente(): void
{
    unset($_SERVER['HTTP_AUTHORIZATION'], $_SERVER['REDIRECT_HTTP_AUTHORIZATION'], $_SERVER['HTTP_X_AUTH_TOKEN']);
    $_GET = [];
    $_SERVER['REQUEST_METHOD'] = 'GET';
}

// 1. Authorization: Bearer
limpar_ambiente();
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer abc123';
t_assert(bearer_token() === 'abc123', 'Bearer no header e aceito');
limpar_ambiente();
$_SERVER['REDIRECT_HTTP_AUTHORIZATION'] = 'bearer XYZ';
t_assert(bearer_token() === 'XYZ', 'REDIRECT_HTTP_AUTHORIZATION (mod_rewrite) e aceito, case-insensitive');

// 2. X-Auth-Token
limpar_ambiente();
$_SERVER['HTTP_X_AUTH_TOKEN'] = ' tok-x ';
t_assert(bearer_token() === 'tok-x', 'X-Auth-Token e aceito (trim)');

// 3. ?token= na query NUNCA e aceito — inclusive no download de NF por GET.
limpar_ambiente();
$_GET['token'] = 'vazou';
$_SERVER['REQUEST_URI'] = '/obrasync/api/notas-fiscais/7/pdf';
$_SERVER['PATH_INFO'] = '/notas-fiscais/7/pdf';
$_GET['path'] = 'notas-fiscais/7/pdf';
t_assert(bearer_token() === '', '?token= na query do download de NF e ignorado');
limpar_ambiente();
$_GET['token'] = 'vazou';
$_GET['path'] = 'clientes';
t_assert(bearer_token() === '', '?token= na query de rota comum e ignorado');

// 4. Sem nada → vazio (authenticate_request responde 401).
limpar_ambiente();
t_assert(bearer_token() === '', 'sem header e sem query = vazio');

// 5. Guarda estática: o fallback nao volta.
$fonte = (string) file_get_contents(__DIR__ . '/../../../api/index.php');
$ini = strpos($fonte, 'function bearer_token(): string');
$fim = strpos($fonte, 'function authenticate_request', $ini);
$corpo = substr($fonte, $ini, $fim - $ini);
t_assert(!str_contains($corpo, "\$_GET['token']") && !str_contains($corpo, '$_GET["token"]'), 'bearer_token nao le $_GET[token]');
t_assert(!str_contains($corpo, 'route_segments('), 'bearer_token nao depende mais da rota');

t_resumo('test_bearer_token');
