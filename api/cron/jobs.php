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

// Cada job roda ISOLADO no seu próprio try/catch: uma falha (ex.: um INSERT que
// esbarra em sql_mode estrito) é logada e o cron segue para os próximos. Antes um
// único job quebrado abortava a cadeia inteira e purge/DRE nunca rodavam.
$jobs = [
    'mark_overdue_accounts' => static fn () => mark_overdue_accounts($pdo),
    'expire_proposals' => static fn () => expire_proposals($pdo),
    'create_due_alerts' => static fn () => create_due_alerts($pdo),
    'consolidate_monthly_dre' => static fn () => consolidate_monthly_dre($pdo),
    'purge_old_audit_data' => static fn () => purge_old_audit_data($pdo),
];
$failures = 0;
foreach ($jobs as $name => $job) {
    try {
        $job();
    } catch (Throwable $error) {
        $failures++;
        error_log('[ObraSync cron] job "' . $name . '" falhou: ' . $error->getMessage());
        echo '[' . date('c') . '] job "' . $name . '" falhou: ' . $error->getMessage() . "\n";
    }
}
echo '[' . date('c') . '] jobs concluídos' . ($failures ? " ({$failures} com falha)" : '') . "\n";
exit($failures ? 1 : 0);

// Alinha o STATUS gravado ao vencimento real: Aberto → Vencido quando dueDate já
// passou. Só mexe em 'Aberto' (Parcial/Pago/Recebido/Cancelado ficam como estão) e
// é idempotente — re-rodar não altera nada além do necessário. O guard de
// paidDate/receivedDate espelha o isOverdue do frontend: conta com baixa lançada
// mas status inconsistente não vira 'Vencido'. TIMEZONE: a data vem do PHP no fuso
// LOCAL (America/Campo_Grande, setado no topo do index.php) em vez de CURDATE() —
// o MySQL pode estar em UTC e viraria 'Vencido' a conta que vence HOJE a partir
// das ~20h locais (mesma raiz da correção M10-12). O isOverdue do frontend segue
// calculando em tempo real (reforço duplo); o job cobre o status persistido.
function mark_overdue_accounts(PDO $pdo): void
{
    $hoje = date('Y-m-d');
    foreach ([['accounts_payable', 'paidDate'], ['accounts_receivable', 'receivedDate']] as [$tableName, $settledDateCol]) {
        $table = resolve_existing_table($pdo, [$tableName], false);
        if (!$table) continue;
        $cols = table_columns($pdo, $table);
        if (!in_array('status', $cols, true) || !in_array('dueDate', $cols, true)) continue;
        $settledGuard = in_array($settledDateCol, $cols, true) ? " AND `$settledDateCol` IS NULL" : '';
        $stmt = $pdo->prepare("UPDATE `$table` SET status = 'Vencido' WHERE status = 'Aberto' AND dueDate < ?" . $settledGuard);
        $stmt->execute([$hoje]);
        echo '[' . date('c') . "] mark_overdue_accounts: {$table} → " . $stmt->rowCount() . " conta(s) marcada(s) como Vencido\n";
    }
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
    // Garante que o ENUM de `type` aceita 'ALERTA_VENCIMENTO' antes de inserir; em
    // sql_mode estrito um valor fora do enum abortaria o INSERT (auto-cura em produção).
    ensure_obra_notificacoes_alert_type($pdo);
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
            // obra_notificacoes.projectId é NOT NULL (FK para projects): conta sem obra
            // vinculada não gera notificação — apenas pula (não derruba o job).
            if (empty($projectId)) continue;
            // Colunas reais do schema (camelCase inglês): projectId, recipient (NOT NULL),
            // type (enum), message, generatedLink, status (enum). recipient não vem da
            // conta, então usa um remetente-placeholder claro; status usa valor válido do enum.
            insert_dynamic($pdo, $notificationTable, [
                'projectId' => $projectId,
                'recipient' => 'Alerta automático',
                'type' => 'ALERTA_VENCIMENTO',
                'message' => due_alert_message($kind, $row),
                'generatedLink' => $kind . ':' . $row['id'],
                'status' => 'Preparado',
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

// Expurgo de tabelas que crescem sem limite: audit_log ganha uma linha por
// mutação na API (retenção de 12 meses) e login_attempts uma por tentativa
// (o login já limpa a janela ativa; aqui remove sobras de períodos sem acesso).
function purge_old_audit_data(PDO $pdo): void
{
    if (resolve_existing_table($pdo, ['audit_log'], false)) {
        $pdo->exec('DELETE FROM audit_log WHERE createdAt < DATE_SUB(NOW(), INTERVAL 12 MONTH)');
    }
    if (resolve_existing_table($pdo, ['login_attempts'], false)) {
        $pdo->exec('DELETE FROM login_attempts WHERE createdAt < DATE_SUB(NOW(), INTERVAL 7 DAY)');
    }
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
