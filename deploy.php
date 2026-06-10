<?php
// Secret configurado no GitHub Webhook (Settings → Webhooks → Secret).
// No servidor, defina a variável de ambiente DEPLOY_SECRET ou coloque
// a chave em /etc/financeiro/config.php → 'deploy_secret'.
$configFile = '/etc/financeiro/config.php';
$config     = is_file($configFile) ? require $configFile : [];
$secret     = (string) ($config['deploy_secret'] ?? getenv('DEPLOY_SECRET') ?? '');

if ($secret === '') {
    http_response_code(500);
    die('deploy_secret não configurado em /etc/financeiro/config.php');
}

$payload   = (string) file_get_contents('php://input');
$signature = 'sha256=' . hash_hmac('sha256', $payload, $secret);

if (!hash_equals($signature, (string) ($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? ''))) {
    http_response_code(403);
    die('Assinatura invalida');
}

$data = json_decode($payload, true);
if (($data['ref'] ?? '') !== 'refs/heads/main') {
    echo 'Branch ignorado';
    exit;
}

// Rodar git pull como alefschimanski (tem permissão no repositório).
$output = shell_exec('sudo -u alefschimanski git -C /var/www/financeiro pull origin main 2>&1');
$logDir = '/var/lib/financeiro';
$logMsg = date('Y-m-d H:i:s') . " — Deploy:\n" . $output . "\n---\n";
@file_put_contents("{$logDir}/deploy.log", $logMsg, FILE_APPEND);
echo 'Deploy OK';
