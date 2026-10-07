<?php
// S6 — dev_bypass só com flag + app_env='local' + localhost; cada uso vai para o log.
require __DIR__ . '/harness.php';

$local = ['auth' => ['dev_bypass' => true], 'app_env' => 'local'];
$prod = ['auth' => ['dev_bypass' => true], 'app_env' => 'production'];
$semEnv = ['auth' => ['dev_bypass' => true]];
$flagOff = ['auth' => ['dev_bypass' => false], 'app_env' => 'local'];

t_assert(dev_bypass_permitido($local, '127.0.0.1') === true, 'flag + local + 127.0.0.1 = permitido');
t_assert(dev_bypass_permitido($local, '::1') === true, 'flag + local + ::1 = permitido');
t_assert(dev_bypass_permitido($local, '192.168.1.10') === false, 'flag + local + IP da rede = negado');
t_assert(dev_bypass_permitido($prod, '127.0.0.1') === false, 'flag em producao = negado mesmo de localhost');
t_assert(dev_bypass_permitido($semEnv, '127.0.0.1') === false, 'flag sem app_env (padrao production) = negado');
t_assert(dev_bypass_permitido($flagOff, '127.0.0.1') === false, 'flag desligada = negado');
t_assert(dev_bypass_permitido([], '127.0.0.1') === false, 'config vazio = negado');
t_assert(dev_bypass_permitido(['auth' => ['dev_bypass' => true], 'app_env' => ' LOCAL '], '127.0.0.1') === true, 'app_env tolera caixa/espacos');

// config.sample.php continua com a flag desligada e app_env production.
$sample = require __DIR__ . '/../../../api/config.sample.php';
t_assert(empty($sample['auth']['dev_bypass']), 'config.sample: dev_bypass desligado');
t_assert(($sample['app_env'] ?? '') === 'production', 'config.sample: app_env production');
t_assert(dev_bypass_permitido($sample, '127.0.0.1') === false, 'config.sample nunca permite o bypass');

// authenticate_request usa a decisao pura e registra o uso.
$fonte = (string) file_get_contents(__DIR__ . '/../../../api/index.php');
$ini = strpos($fonte, 'function authenticate_request(');
$corpo = substr($fonte, $ini, 900);
t_assert(str_contains($corpo, 'dev_bypass_permitido($config, $remote)'), 'authenticate_request decide pelo dev_bypass_permitido');
t_assert(str_contains($corpo, "error_log('[ObraSync auth] dev_bypass usado por '"), 'uso do bypass vai para o error_log');
t_assert(!preg_match('/\$auth\[.dev_bypass.\]/', $corpo), 'nao sobrou a checagem antiga so por flag+localhost');

t_resumo('test_dev_bypass');
