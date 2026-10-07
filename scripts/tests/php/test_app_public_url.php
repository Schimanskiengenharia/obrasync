<?php
// Infra — endereço público do sistema sem caminho fixo no código.
// app_public_url(): config.php (mail.app_url) manda; sem config, deriva da requisição
// (esquema + host + caminho antes de /api). Serve para /financeiro, /obrasync ou raiz.
require __DIR__ . '/harness.php';

// 1. Config presente: vale o config (sem barra final).
t_assert(app_public_url(['mail' => ['app_url' => 'https://schimanskiengenharia.com.br/obrasync/']]) === 'https://schimanskiengenharia.com.br/obrasync', 'config mail.app_url vence e perde a barra final');
t_assert(app_public_url(['app_url' => 'https://x.test/y']) === 'https://x.test/y', 'app_url no topo do config tambem e aceito');

// 2. Sem config: deriva da requisição.
$srv = ['HTTP_HOST' => 'schimanskiengenharia.com.br', 'HTTPS' => 'on', 'REQUEST_URI' => '/obrasync/api/request-password-reset?x=1'];
t_assert(app_public_url([], $srv) === 'https://schimanskiengenharia.com.br/obrasync', 'deriva /obrasync da URI da API');
$srv['REQUEST_URI'] = '/financeiro/api/clientes/3';
t_assert(app_public_url([], $srv) === 'https://schimanskiengenharia.com.br/financeiro', 'deriva /financeiro da URI antiga (mesmo codigo)');
$srv['REQUEST_URI'] = '/api/login';
t_assert(app_public_url([], $srv) === 'https://schimanskiengenharia.com.br', 'instalado na raiz: sem sufixo');
$srvHttp = ['HTTP_HOST' => 'localhost:8080', 'REQUEST_URI' => '/obrasync/api/x'];
t_assert(app_public_url([], $srvHttp) === 'http://localhost:8080/obrasync', 'sem HTTPS vira http');
$srvProxy = ['HTTP_HOST' => 'h.test', 'HTTP_X_FORWARDED_PROTO' => 'https', 'REQUEST_URI' => '/obrasync/api/x'];
t_assert(app_public_url([], $srvProxy) === 'https://h.test/obrasync', 'X-Forwarded-Proto https e respeitado');
t_assert(app_public_url([], ['REQUEST_URI' => '/obrasync/api/x']) === '', 'sem HTTP_HOST devolve vazio (caller decide)');

// 3. reset_url usa a base e o hash #reset=.
t_assert(reset_url(['mail' => ['app_url' => 'https://s.test/obrasync']], 'a b') === 'https://s.test/obrasync/#reset=a+b', 'reset_url = base + /#reset=token (urlencode)');

// 4. Guardas estáticas: nenhum caminho público fixo sobrou no código.
$php = (string) file_get_contents(__DIR__ . '/../../../api/index.php');
$js = (string) file_get_contents(__DIR__ . '/../../../app.js');
t_assert(!str_contains($php, 'schimanskiengenharia.com.br/financeiro'), 'index.php sem /financeiro fixo');
t_assert(!str_contains($js, 'schimanskiengenharia.com.br/financeiro') && !str_contains($js, 'schimanskiengenharia.com.br/obrasync'), 'app.js sem caminho publico fixo (usa appPublicBase)');
t_assert(substr_count($js, 'appPublicBase()') >= 4, 'os 4 pontos do front usam appPublicBase()');
$sample = require __DIR__ . '/../../../api/config.sample.php';
t_assert(($sample['mail']['app_url'] ?? '') === 'https://schimanskiengenharia.com.br/obrasync', 'config.sample aponta para /obrasync');

t_resumo('test_app_public_url');
