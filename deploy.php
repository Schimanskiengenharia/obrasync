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

$appDir = '/var/www/financeiro';
$logDir = '/var/lib/financeiro';

// 1) Backup automático pré-deploy (dump do banco + uploads). Uma falha no backup
//    não bloqueia o deploy, mas fica registrada no log para conferência.
$backupScript = $appDir . '/backup-pre-deploy.sh';
$backupOutput = 'backup-pre-deploy.sh não encontrado; backup pulado';
if (is_file($backupScript)) {
    // /usr/bin/bash explícito: o sudoers exige match exato do comando; "bash" sem
    // caminho pode resolver para outro binário e não casar com a regra. O -n faz o
    // sudo falhar na hora em vez de aguardar senha sem TTY (travamento silencioso).
    $backupLines = [];
    $backupExit  = 0;
    exec('sudo -n -u alefschimanski /usr/bin/bash ' . escapeshellarg($backupScript) . ' 2>&1', $backupLines, $backupExit);
    $backupOutput = implode("\n", $backupLines);
    if ($backupExit !== 0) {
        $backupOutput = "[ALERTA] Backup pré-deploy FALHOU (exit {$backupExit}) — confira a regra do sudoers.\n" . $backupOutput;
    }
}

// 2) Atualização do código. Rodar git pull como alefschimanski (tem permissão no repositório).
$output = shell_exec('sudo -u alefschimanski git -C ' . escapeshellarg($appDir) . ' pull origin main 2>&1');

// 3) Verificação pós-deploy: os caminhos protegidos listados no .deployignore
//    (linhas iniciadas por "/") precisam continuar existindo após o pull.
$issues = [];
foreach (deploy_protected_paths($appDir . '/.deployignore') as $path) {
    if (!file_exists($path)) {
        $issues[] = $path;
    }
}

$logMsg = date('Y-m-d H:i:s') . " — Deploy:\n"
    . "[backup pré-deploy]\n" . trim((string) $backupOutput) . "\n"
    . "[git pull]\n" . trim((string) $output) . "\n"
    . ($issues
        ? "[ALERTA] Arquivos/pastas protegidos ausentes após o deploy:\n- " . implode("\n- ", $issues) . "\n"
        : "[verificação] Arquivos protegidos intactos.\n")
    . "---\n";
@file_put_contents("{$logDir}/deploy.log", $logMsg, FILE_APPEND);

if ($issues) {
    http_response_code(500);
    die('Deploy concluído com ALERTA — arquivos protegidos ausentes: ' . implode(', ', $issues));
}
echo 'Deploy OK';

// Lê o .deployignore e devolve os caminhos absolutos a verificar após o pull.
// Comentários (#), linhas vazias e padrões relativos (ex.: *.env) são ignorados
// aqui — padrões servem como documentação e são bloqueados pelo .gitignore.
function deploy_protected_paths(string $file): array
{
    $defaults = [
        '/etc/financeiro/config.php',
        '/var/lib/financeiro/backups',
        '/var/lib/financeiro/uploads',
    ];
    if (!is_file($file)) {
        return $defaults;
    }
    $paths = [];
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || $line[0] !== '/') {
            continue;
        }
        $paths[] = $line;
    }
    return $paths ?: $defaults;
}
