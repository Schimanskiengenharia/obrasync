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
];
