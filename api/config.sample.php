<?php
// Copie este arquivo para /etc/financeiro/config.php e ajuste as credenciais.
// Em produção, prefira manter este arquivo fora de /var/www/financeiro.
return [
    'db' => [
        'host' => '127.0.0.1',
        'database' => 'financeiro',
        'user' => 'financeiro_app',
        'password' => 'troque_esta_senha',
        'charset' => 'utf8mb4',
    ],
    'data_dir' => '/var/lib/financeiro',
    'backup_dir' => '/var/lib/financeiro/backups',
    'upload_dir' => '/var/lib/financeiro/uploads',
    'auth' => [
        // Bypass de autenticação SOMENTE para desenvolvimento local (requisições de 127.0.0.1/::1).
        // NUNCA habilite em produção.
        'dev_bypass' => false,
    ],
    // Secret do webhook GitHub (Settings → Webhooks → Secret). Gere com:
    // php -r "echo bin2hex(random_bytes(32));"
    'deploy_secret' => '',
    'mail' => [
        // Endereço de envio dos emails de redefinição de senha.
        'from_email' => 'noreply@schimanskiengenharia.com.br',
        'from_name'  => 'ObraSync',
        // URL pública do sistema (sem barra final) — usada no link do email.
        'app_url'    => 'https://schimanskiengenharia.com.br/financeiro',
        // Configurações SMTP. Deixe smtp_host vazio para usar php mail() com relay do servidor.
        'smtp_host'  => '',        // Ex.: 'smtp.gmail.com' ou 'smtp.sendgrid.net'
        'smtp_port'  => 587,       // 587 = STARTTLS  |  465 = SSL implícito
        'smtp_user'  => '',
        'smtp_pass'  => '',
        'smtp_tls'   => true,
        // true = registra a URL de reset em error_log() quando o email falha (útil em dev).
        'log_reset_url' => false,
    ],
];
