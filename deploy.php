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

// 0) Lock de deploy: serializa execuções concorrentes (dois pushes seguidos).
//    flock é liberado pelo SO quando o processo termina — sem lock órfão em
//    crash. Se o lock não puder ser criado, o deploy SEGUE sem serialização
//    (o lock nunca é motivo de deploy parar). Espera até 120s pelo anterior.
set_time_limit(300);
ignore_user_abort(true);
$lockNote   = '';
$lockHandle = @fopen("{$logDir}/deploy.lock", 'c');
if ($lockHandle === false) {
    $lockNote = '[AVISO] lock indisponível (deploy.lock não pôde ser aberto) — deploy segue SEM serialização';
} else {
    $lockAcquired = false;
    $lockDeadline = time() + 120;
    while (time() < $lockDeadline) {
        if (flock($lockHandle, LOCK_EX | LOCK_NB)) {
            $lockAcquired = true;
            break;
        }
        sleep(1);
    }
    if (!$lockAcquired) {
        $busyMsg = date('Y-m-d H:i:s') . " — Deploy NÃO executado: ocupado (timeout de 120s aguardando outro deploy)\n---\n";
        @file_put_contents("{$logDir}/deploy.log", $busyMsg, FILE_APPEND);
        http_response_code(503);
        die('Deploy ocupado — outro deploy em andamento; redispare o webhook em alguns minutos.');
    }
    $lockNote = '[lock] adquirido';
}

// 1) Backup automático pré-deploy (dump do banco + uploads) — OBRIGATÓRIO:
//    se o backup falhar (ou o script não existir), o deploy é ABORTADO antes
//    do git pull. Nada é publicado sem backup válido (DEP3).
$backupScript = $appDir . '/backup-pre-deploy.sh';
$backupLines  = [];
$backupExit   = 1;
$backupOutput = '';
if (!is_file($backupScript)) {
    $backupOutput = '[ERRO] backup-pre-deploy.sh não encontrado — backup é obrigatório';
} else {
    // /usr/bin/bash explícito: o sudoers exige match exato do comando; "bash" sem
    // caminho pode resolver para outro binário e não casar com a regra. O -n faz o
    // sudo falhar na hora em vez de aguardar senha sem TTY (travamento silencioso).
    exec('sudo -n -u alefschimanski /usr/bin/bash ' . escapeshellarg($backupScript) . ' 2>&1', $backupLines, $backupExit);
    $backupOutput = implode("\n", $backupLines);
    if ($backupExit !== 0) {
        $backupOutput = "[ERRO] Backup pré-deploy FALHOU (exit {$backupExit}) — deploy abortado.\n" . $backupOutput;
    }
}

if ($backupExit !== 0) {
    $abortMsg = date('Y-m-d H:i:s') . " — Deploy ABORTADO (backup pré-deploy inválido):\n"
        . ($lockNote !== '' ? $lockNote . "\n" : '')
        . trim((string) $backupOutput) . "\n---\n";
    @file_put_contents("{$logDir}/deploy.log", $abortMsg, FILE_APPEND);
    http_response_code(500);
    die("Deploy ABORTADO — backup pré-deploy falhou; confira {$logDir}/deploy.log");
}

// 2) Atualização do código. Rodar git pull como alefschimanski (tem permissão no repositório).
//    exec com exit code: pull falho NÃO pode terminar em "Deploy OK".
$pullLines = [];
$pullExit  = 0;
exec('sudo -u alefschimanski git -C ' . escapeshellarg($appDir) . ' pull origin main 2>&1', $pullLines, $pullExit);
$output = implode("\n", $pullLines);
if ($pullExit !== 0) {
    $output = "[ERRO] git pull FALHOU (exit {$pullExit})\n" . $output;
}

// 2b) Confirma que o commit anunciado pelo webhook está publicado: o SHA
//     "after" deve ser ancestral de (ou igual a) HEAD. Ancestral, não
//     igualdade: com dois pushes seguidos o primeiro pull já traz os dois
//     commits e HEAD legitimamente passa do "after" do primeiro webhook.
$commitNote = '';
$commitFail = false;
$afterSha   = (string) ($data['after'] ?? '');
if ($pullExit === 0) {
    if (!preg_match('/^[0-9a-f]{40}$/i', $afterSha)) {
        $commitNote = '[AVISO] payload sem SHA "after" válido — verificação de commit pulada';
    } else {
        $headLines = [];
        $headExit  = 0;
        exec('sudo -u alefschimanski git -C ' . escapeshellarg($appDir) . ' rev-parse HEAD 2>&1', $headLines, $headExit);
        $headSha = trim((string) ($headLines[0] ?? ''));
        if ($headExit !== 0) {
            $commitFail = true;
            $commitNote = "[ERRO] git rev-parse HEAD falhou (exit {$headExit})";
        } else {
            $ancestorOut  = [];
            $ancestorExit = 1;
            exec('sudo -u alefschimanski git -C ' . escapeshellarg($appDir) . ' merge-base --is-ancestor ' . escapeshellarg($afterSha) . ' HEAD 2>&1', $ancestorOut, $ancestorExit);
            if ($ancestorExit !== 0) {
                $commitFail = true;
                $commitNote = "[ERRO] HEAD ({$headSha}) não contém o commit do webhook ({$afterSha})";
            } else {
                $commitNote = "[commit] HEAD {$headSha} contém {$afterSha}";
            }
        }
    }
}

// 3) Verificação pós-deploy: os caminhos protegidos listados no .deployignore
//    (linhas iniciadas por "/") precisam continuar existindo após o pull.
$issues = [];
foreach (deploy_protected_paths($appDir . '/.deployignore') as $path) {
    if (!file_exists($path)) {
        $issues[] = $path;
    }
}

$logMsg = date('Y-m-d H:i:s') . " — Deploy:\n"
    . ($lockNote !== '' ? $lockNote . "\n" : '')
    . "[backup pré-deploy]\n" . trim((string) $backupOutput) . "\n"
    . "[git pull]\n" . trim((string) $output) . "\n"
    . ($commitNote !== '' ? $commitNote . "\n" : '')
    . ($issues
        ? "[ALERTA] Arquivos/pastas protegidos ausentes após o deploy:\n- " . implode("\n- ", $issues) . "\n"
        : "[verificação] Arquivos protegidos intactos.\n")
    . "---\n";
@file_put_contents("{$logDir}/deploy.log", $logMsg, FILE_APPEND);

if ($pullExit !== 0) {
    http_response_code(500);
    die("Deploy FALHOU — git pull retornou exit {$pullExit}; confira {$logDir}/deploy.log");
}
if ($commitFail) {
    http_response_code(500);
    die("Deploy FALHOU — commit do webhook não confirmado no working tree; confira {$logDir}/deploy.log");
}
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
