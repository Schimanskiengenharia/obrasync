<?php
declare(strict_types=1);

/**
 * Cron de rotinas do ObraSync: expira propostas, cria alertas de vencimento
 * e consolida o DRE mensal. Disparado via CLI:
 *   php api/cron/jobs.php
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Disponível apenas via CLI.');
}

// Reaproveita config, conexão ($pdo) e helpers do api/index.php — o guard de
// PHP_SAPI lá pula o roteamento web (mesmo padrão do worker SINAPI). Antes este
// arquivo duplicava db()/resolve_table()/columns()/insert_dynamic() e a cópia
// divergiu: o "SHOW TABLES LIKE ?" preparado falha com 1064 no MariaDB quando
// EMULATE_PREPARES = false, derrubando todos os jobs na primeira consulta.
require __DIR__ . '/../index.php';

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

function expire_proposals(PDO $pdo): void
{
    $table = resolve_existing_table($pdo, ['commercial_proposals']);
    $columns = table_columns($pdo, $table);
    $validity = pick_column($columns, ['validade', 'validityDate', 'validity_date']);
    if (!$validity || !in_array('status', $columns, true)) return;
    $stmt = $pdo->prepare("UPDATE `$table` SET status = 'Expirada' WHERE status = 'Enviada' AND `$validity` IS NOT NULL AND `$validity` < CURDATE()");
    $stmt->execute();
}

function create_due_alerts(PDO $pdo): void
{
    $notificationTable = resolve_existing_table($pdo, ['obra_notificacoes']);
    foreach ([['accounts_receivable', 'CONTA_RECEBER'], ['accounts_payable', 'CONTA_PAGAR']] as [$tableName, $kind]) {
        $table = resolve_existing_table($pdo, [$tableName]);
        $cols = table_columns($pdo, $table);
        $due = pick_column($cols, ['data_vencimento', 'dueDate', 'due_date']);
        $status = pick_column($cols, ['status']);
        if (!$due || !$status) continue;
        $openStatuses = open_status_candidates($pdo, $table);
        $placeholders = implode(',', array_fill(0, count($openStatuses), '?'));
        $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE `$status` IN ($placeholders) AND `$due` = DATE_ADD(CURDATE(), INTERVAL 3 DAY)");
        $stmt->execute($openStatuses);
        foreach ($stmt->fetchAll() as $row) {
            if (notification_exists_today($pdo, $notificationTable, $kind, (int) $row['id'])) continue;
            $projectId = value_from($row, ['obra_id', 'projectId', 'project_id']);
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
    $dreTable = resolve_existing_table($pdo, ['dre_mensal', 'dre_gerencial', 'dre'], false);
    $entriesTable = resolve_existing_table($pdo, ['journal_entries', 'lancamentos_contabeis'], false);
    if (!$dreTable || !$entriesTable) return;
    $entryCols = table_columns($pdo, $entriesTable);
    $dateCol = pick_column($entryCols, ['competenceDate', 'competence_date', 'data_competencia', 'entryDate', 'entry_date']);
    $amountCol = pick_column($entryCols, ['amount', 'valor']);
    $projectCol = pick_column($entryCols, ['obra_id', 'projectId', 'project_id']);
    if (!$dateCol || !$amountCol) return;
    $start = (new DateTimeImmutable('first day of previous month'))->format('Y-m-d');
    $end = (new DateTimeImmutable('first day of this month'))->format('Y-m-d');
    if (dre_month_already_consolidated($pdo, $dreTable, $start)) return;
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

// Idempotência da consolidação: o cron pode rodar mais de uma vez no mês (ou
// diariamente) — sem esta verificação, a competência anterior era re-inserida
// a cada execução, duplicando o DRE.
function dre_month_already_consolidated(PDO $pdo, string $dreTable, string $monthStart): bool
{
    $cols = table_columns($pdo, $dreTable);
    if (in_array('competencia', $cols, true)) {
        $stmt = $pdo->prepare("SELECT 1 FROM `$dreTable` WHERE `competencia` = ? LIMIT 1");
        $stmt->execute([substr($monthStart, 0, 7)]);
        return (bool) $stmt->fetchColumn();
    }
    if ($dateCol = pick_column($cols, ['competenceDate', 'competence_date'])) {
        $stmt = $pdo->prepare("SELECT 1 FROM `$dreTable` WHERE `$dateCol` = ? LIMIT 1");
        $stmt->execute([$monthStart]);
        return (bool) $stmt->fetchColumn();
    }
    if (in_array('mes', $cols, true) && in_array('ano', $cols, true)) {
        $stmt = $pdo->prepare("SELECT 1 FROM `$dreTable` WHERE `mes` = ? AND `ano` = ? LIMIT 1");
        $stmt->execute([(int) substr($monthStart, 5, 2), (int) substr($monthStart, 0, 4)]);
        return (bool) $stmt->fetchColumn();
    }
    return false;
}

function notification_exists_today(PDO $pdo, string $table, string $kind, int $id): bool
{
    $cols = table_columns($pdo, $table);
    $type = pick_column($cols, ['tipo', 'type']);
    $link = pick_column($cols, ['generatedLink', 'generated_link']);
    $created = pick_column($cols, ['created_at', 'createdAt']);
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
    $description = value_from($row, ['descricao', 'description', 'document']) ?: ('#' . $row['id']);
    $due = value_from($row, ['data_vencimento', 'dueDate', 'due_date']) ?: '';
    return $label . ' vence em 3 dias: ' . $description . ' - ' . $due;
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
