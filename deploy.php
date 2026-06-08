<?php
$secret = 'OBRASYNC_DEPLOY_SECRET_2026';
$payload = file_get_contents('php://input');
$signature = 'sha256=' . hash_hmac('sha256', $payload, $secret);

if (!hash_equals($signature, $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '')) {
    http_response_code(403);
    die('Assinatura invalida');
}

$data = json_decode($payload, true);
if (($data['ref'] ?? '') !== 'refs/heads/main') {
    echo 'Branch ignorado';
    exit;
}

$output = shell_exec('cd /var/www/financeiro && git pull origin main 2>&1');
$log = date('Y-m-d H:i:s') . " — Deploy:\n" . $output . "\n---\n";
file_put_contents('/var/log/obrasync-deploy.log', $log, FILE_APPEND);
echo 'Deploy OK';
