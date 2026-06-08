<?php
declare(strict_types=1);

const CONFIG_PATH = '/etc/financeiro/config.php';

$config = require CONFIG_PATH;
$pdo = db($config);

try {
    expire_proposals($pdo);
    create_due_alerts($pdo);
    consolidate_monthly_dre($pdo);
    echo '[' . date('c') . "] jobs concluídos\n";
} catch (Throwable $error) {
    error_log('[ObraSync cron] ' . $error->getMessage());
    echo '[' . date('c') . '] erro: ' . $error->getMessage() . "\n";
    exit(1);
}

function db(array $config): PDO
{
    $db = $config['db'];
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $db['host'], $db['database'], $db['charset'] ?? 'utf8mb4');
    return new PDO($dsn, $db['user'], $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function expire_proposals(PDO $pdo): void
{
    $table = resolve_table($pdo, ['commercial_proposals']);
    $columns = columns($pdo, $table);
    $validity = pick($columns, ['validade', 'validityDate', 'validity_date']);
    if (!$validity || !in_array('status', $columns, true)) return;
    $stmt = $pdo->prepare("UPDATE `$table` SET status = 'Expirada' WHERE status = 'Enviada' AND `$validity` IS NOT NULL AND `$validity` < CURDATE()");
    $stmt->execute();
}

function create_due_alerts(PDO $pdo): void
{
    $notificationTable = resolve_table($pdo, ['obra_notificacoes']);
    foreach ([['accounts_receivable', 'CONTA_RECEBER'], ['accounts_payable', 'CONTA_PAGAR']] as [$tableName, $kind]) {
        $table = resolve_table($pdo, [$tableName]);
        $cols = columns($pdo, $table);
        $due = pick($cols, ['data_vencimento', 'dueDate', 'due_date']);
        $status = pick($cols, ['status']);
        if (!$due || !$status) continue;
        $openStatuses = open_status_candidates($pdo, $table);
        $placeholders = implode(',', array_fill(0, count($openStatuses), '?'));
        $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE `$status` IN ($placeholders) AND `$due` = DATE_ADD(CURDATE(), INTERVAL 3 DAY)");
        $stmt->execute($openStatuses);
        foreach ($stmt->fetchAll() as $row) {
            if (notification_exists_today($pdo, $notificationTable, $kind, (int) $row['id'])) continue;
            $projectId = value($row, ['obra_id', 'projectId', 'project_id']);
            insert_dynamic($pdo, $notificationTable, [
                'obra_id' => $projectId,
                'projectId' => $projectId,
                'project_id' => $projectId,
                'tipo' => 'ALERTA_VENCIMENTO',
                'type' => 'ALERTA_VENCIMENTO',
                'mensagem' => due_alert_message($kind, $row),
                'message' => due_alert_message($kind, $row),
                'generatedLink' => $kind . ':' . $row['id'],
                'generated_link' => $kind . ':' . $row['id'],
                'status' => 'Pendente',
            ]);
        }
    }
}

function consolidate_monthly_dre(PDO $pdo): void
{
    $dreTable = resolve_table($pdo, ['dre_mensal', 'dre_gerencial', 'dre'], false);
    $entriesTable = resolve_table($pdo, ['journal_entries', 'lancamentos_contabeis'], false);
    if (!$dreTable || !$entriesTable) return;
    $entryCols = columns($pdo, $entriesTable);
    $dateCol = pick($entryCols, ['competenceDate', 'competence_date', 'data_competencia', 'entryDate', 'entry_date']);
    $amountCol = pick($entryCols, ['amount', 'valor']);
    $projectCol = pick($entryCols, ['obra_id', 'projectId', 'project_id']);
    if (!$dateCol || !$amountCol) return;
    $start = (new DateTimeImmutable('first day of previous month'))->format('Y-m-d');
    $end = (new DateTimeImmutable('first day of this month'))->format('Y-m-d');
    $projectSelect = $projectCol ? "`$projectCol` AS obra_id" : 'NULL AS obra_id';
    $stmt = $pdo->prepare("SELECT $projectSelect, SUM(`$amountCol`) AS total FROM `$entriesTable` WHERE `$dateCol` >= ? AND `$dateCol` < ? GROUP BY obra_id WITH ROLLUP");
    $stmt->execute([$start, $end]);
    foreach ($stmt->fetchAll() as $row) {
        insert_dynamic($pdo, $dreTable, [
            'competencia' => substr($start, 0, 7),
            'competenceDate' => $start,
            'competence_date' => $start,
            'mes' => (int) substr($start, 5, 2),
            'ano' => (int) substr($start, 0, 4),
            'obra_id' => $row['obra_id'],
            'projectId' => $row['obra_id'],
            'project_id' => $row['obra_id'],
            'valor' => (float) $row['total'],
            'amount' => (float) $row['total'],
            'resultado' => (float) $row['total'],
            'status' => 'Consolidado',
        ]);
    }
}

function notification_exists_today(PDO $pdo, string $table, string $kind, int $id): bool
{
    $cols = columns($pdo, $table);
    $type = pick($cols, ['tipo', 'type']);
    $link = pick($cols, ['generatedLink', 'generated_link']);
    $created = pick($cols, ['created_at', 'createdAt']);
    if (!$type || !$link) return false;
    $sql = "SELECT id FROM `$table` WHERE `$type` = 'ALERTA_VENCIMENTO' AND `$link` = ?";
    if ($created) $sql .= " AND DATE(`$created`) = CURDATE()";
    $sql .= ' LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$kind . ':' . $id]);
    return (bool) $stmt->fetchColumn();
}

function due_alert_message(string $kind, array $row): string
{
    $label = $kind === 'CONTA_RECEBER' ? 'Conta a receber' : 'Conta a pagar';
    $description = value($row, ['descricao', 'description', 'document']) ?: ('#' . $row['id']);
    $due = value($row, ['data_vencimento', 'dueDate', 'due_date']) ?: '';
    return $label . ' vence em 3 dias: ' . $description . ' - ' . $due;
}

function resolve_table(PDO $pdo, array $candidates, bool $required = true): ?string
{
    foreach ($candidates as $table) {
        $stmt = $pdo->prepare('SHOW TABLES LIKE ?');
        $stmt->execute([$table]);
        if ($stmt->fetchColumn()) return $table;
    }
    if ($required) throw new RuntimeException('Tabela não encontrada: ' . implode(', ', $candidates));
    return null;
}

function columns(PDO $pdo, string $table): array
{
    static $cache = [];
    if (!isset($cache[$table])) {
        $stmt = $pdo->query('DESCRIBE `' . $table . '`');
        $cache[$table] = array_map(fn ($row) => $row['Field'], $stmt->fetchAll());
    }
    return $cache[$table];
}

function pick(array $columns, array $candidates): ?string
{
    foreach ($candidates as $candidate) {
        if (in_array($candidate, $columns, true)) return $candidate;
    }
    return null;
}

function value(array $row, array $candidates): mixed
{
    foreach ($candidates as $candidate) {
        if (array_key_exists($candidate, $row) && $row[$candidate] !== null && $row[$candidate] !== '') return $row[$candidate];
    }
    return null;
}

function open_status_candidates(PDO $pdo, string $table): array
{
    $stmt = $pdo->query('DESCRIBE `' . $table . '`');
    foreach ($stmt->fetchAll() as $column) {
        if (($column['Field'] ?? '') !== 'status') continue;
        $type = (string) ($column['Type'] ?? '');
        if (str_starts_with(strtolower($type), 'enum(')) {
            preg_match_all("/'((?:[^'\\\\]|\\\\.)*)'/", $type, $matches);
            $values = array_values(array_intersect(['aberta', 'Aberta', 'aberto', 'Aberto'], $matches[1] ?? []));
            return $values ?: [$matches[1][0] ?? 'aberta'];
        }
    }
    return ['aberta', 'Aberta', 'aberto', 'Aberto'];
}

function insert_dynamic(PDO $pdo, string $table, array $data): void
{
    $columns = columns($pdo, $table);
    $data = array_filter($data, fn ($field) => in_array($field, $columns, true), ARRAY_FILTER_USE_KEY);
    if (!$data) return;
    $fields = array_keys($data);
    $sql = 'INSERT INTO `' . $table . '` (`' . implode('`,`', $fields) . '`) VALUES (' . implode(',', array_fill(0, count($fields), '?')) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_values($data));
}
