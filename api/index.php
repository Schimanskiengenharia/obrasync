<?php
declare(strict_types=1);

// Fuso horário do PHP alinhado ao do servidor MySQL (Campo Grande/MS, UTC-4,
// sem horário de verão desde 2019). Sem isso, o PHP em UTC considerava as
// sessões recém-criadas pelo MySQL (-04) como expiradas há 4 horas.
date_default_timezone_set('America/Campo_Grande');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const CONFIG_PATH = '/etc/financeiro/config.php';
// Tempo máximo de inatividade da sessão: igual ao AUTH_TIMEOUT_MS do frontend (30 min).
const AUTH_IDLE_SECONDS = 1800;

$config = load_config();
$pdo = db($config);
$resources = resource_map();

// O roteamento HTTP abaixo só roda via web. No CLI (worker de importação SINAPI em
// scripts/sinapi_import_worker.php), este arquivo é incluído apenas pelas funções e
// pelas variáveis $config/$pdo/$resources já carregadas acima.
if (PHP_SAPI !== 'cli') {
try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $segments = route_segments();
    $resource = $segments[0] ?? 'bootstrap';
    $id = $segments[1] ?? null;

    if ($resource === 'login') {
        require_method($method, ['POST']);
        handle_login($pdo, read_json());
    }

    // Rotas públicas de redefinição de senha (não exigem token).
    if ($resource === 'request-password-reset') {
        require_method($method, ['POST']);
        handle_request_password_reset($pdo, $config, read_json());
    }
    if ($resource === 'reset-password') {
        require_method($method, ['POST']);
        handle_reset_password($pdo, read_json());
    }

    // Troca obrigatória: autentica pelo token no corpo (evita falha em PHP-CGI que remove Authorization).
    if ($resource === 'forced-change-password') {
        require_method($method, ['POST']);
        handle_forced_change_password($pdo, read_json());
    }

    // Toda rota além das acima exige sessão válida emitida pelo próprio login.
    $authUser = authenticate_request($pdo, $config);

    // Verificação de sessão usada pelos plugins (ex.: Estudo de Seletividade):
    // valida o token e devolve os dados básicos do usuário logado.
    if ($resource === 'check-session' || $resource === 'checkSession') {
        require_method($method, ['GET']);
        handle_check_session($pdo, $authUser);
    }

    $module = strtolower((string) ($_GET['module'] ?? ''));
    if (in_array($module, ['agenda', 'agenda_eventos', 'agenda-eventos'], true)) {
        authorize_request($pdo, $authUser, 'agenda', action_for_method($method));
        handle_agenda_module($pdo, $method, $_GET);
    }

    if ($resource === '' || $resource === 'bootstrap') {
        require_method($method, ['GET']);
        respond(['ok' => true, 'data' => bootstrap_data($pdo, $resources, $authUser)]);
    }

    if ($resource === 'logout') {
        require_method($method, ['POST']);
        handle_logout($pdo);
    }

    if ($resource === 'change-password') {
        require_method($method, ['POST']);
        handle_change_password($pdo, $authUser, read_json());
    }

    if ($resource === 'backup') {
        require_admin($authUser);
        handle_backup($pdo, $resources, $config, $method, $segments);
    }

    if ($resource === 'migrate') {
        require_admin($authUser);
        require_method($method, ['POST']);
        $payload = read_json();
        respond(['ok' => true, 'imported' => migrate_payload($pdo, $resources, $payload)]);
    }

    if ($resource === 'sinapi-upload') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'sinapiSettings', 'edit');
        handle_safe_file_upload($config, 'sinapi', ['csv','txt','xlsx'], ['text/plain','text/csv','application/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','application/octet-stream']);
    }

    if ($resource === 'sinapi-import') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'sinapiSettings', 'edit');
        handle_sinapi_import($pdo, $resources, $config);
    }

    // Importação SINAPI em background: recebe os 4 arquivos oficiais do CEF de uma vez,
    // registra o job e dispara o worker CLI (scripts/sinapi_import_worker.php). O
    // progresso é acompanhado por polling em sinapi-import-status.
    if ($resource === 'sinapi-import-async') {
        require_method($method, ['POST']);
        require_admin($authUser);
        handle_sinapi_import_async($pdo, $config, $authUser);
    }

    if ($resource === 'sinapi-import-status') {
        require_method($method, ['GET']);
        authorize_request($pdo, $authUser, 'sinapiSettings', 'view');
        handle_sinapi_import_status($pdo);
    }

    if ($resource === 'project-upload') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'projectSchedule', 'edit');
        handle_safe_file_upload($config, 'project', ['xml'], ['text/xml','application/xml','application/octet-stream']);
    }

    $key = normalize_resource($resource, $resources);
    if (!$key) {
        fail('Recurso não encontrado.', 404);
    }

    authorize_request($pdo, $authUser, $key, action_for_method($method));

    // Módulos novos criam as próprias tabelas sob demanda: dispensam migração manual.
    if ($key === 'viabilityAnalyses') {
        ensure_viability_table($pdo);
    }
    if ($key === 'plugins') {
        ensure_plugins_table($pdo);
    }
    if ($key === 'users' && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
        ensure_users_extra_columns($pdo);
    }

    if ($key === 'fiscalDocuments' && $id && isset($segments[2]) && $method === 'GET') {
        handle_fiscal_download($pdo, (int) $id, $segments[2]);
    }

    if ($key === 'fiscalDocuments' && $method === 'POST') {
        $record = save_fiscal_document($pdo, $resources[$key], $config, $id ? (int) $id : null);
        respond(['ok' => true, 'record' => $record], $id ? 200 : 201);
    }

    if ($method === 'GET') {
        respond(['ok' => true, 'data' => list_records($pdo, $resources[$key])]);
    }

    if ($method === 'POST') {
        $payload = read_json();
        if ($key === 'users') {
            $payload = sanitize_user_profile_fields($pdo, $payload, null, true);
        }
        $record = create_record($pdo, $resources[$key], $payload);
        // Automations auxiliares APÓS o INSERT: uma falha aqui não pode devolver 500
        // com o registro já gravado (registro "fantasma"). Mesmo padrão da agenda:
        // try/catch + error_log + seguir.
        if ($key === 'projects') {
            try {
                $record['automation'] = ensure_project_kanban_boards($pdo, (int) $record['id'], (string) ($record['name'] ?? 'Obra'));
            } catch (Throwable $error) {
                error_log('[ObraSync] Automação de kanban da obra falhou: ' . $error->getMessage());
            }
        }
        if ($key === 'purchaseOrders') {
            try {
                $record['automation'] = create_purchase_order_kanban_card($pdo, (int) $record['id']);
            } catch (Throwable $error) {
                error_log('[ObraSync] Automação de card do pedido de compra falhou: ' . $error->getMessage());
            }
        }
        if ($key === 'agendaEvents') {
            $record['automation'] = create_event_day_notification($pdo, $record);
        }
        respond(['ok' => true, 'record' => $record], 201);
    }

    if (!$id) {
        fail('Informe o id do registro.', 400);
    }

    if ($key === 'proposals' && ($method === 'PUT' || $method === 'PATCH')) {
        $payload = read_json();
        $newStatus = normalize_payload_aliases($payload)['status'] ?? null;

        if (!in_array($newStatus, ['Aprovada', 'Aprovado'], true)) {
            $record = update_record($pdo, $resources[$key], (int) $id, $payload);
            respond(['ok' => true, 'record' => $record]);
        }

        $pdo->beginTransaction();
        try {
            $record = update_record($pdo, $resources[$key], (int) $id, $payload);

            $stmt = $pdo->prepare('SELECT * FROM commercial_proposals WHERE id = ? LIMIT 1');
            $stmt->execute([(int) $id]);
            $proposal = $stmt->fetch();

            $projectName = !empty($proposal['description'])
                ? mb_substr((string) $proposal['description'], 0, 180)
                : 'Projeto - Proposta ' . $proposal['number'];

            $stmt = $pdo->prepare(
                'INSERT INTO projects (name, clientId, status, revenueContracted, commercialUserId, notes)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $projectName,
                $proposal['clientId'] ?: null,
                'Planejamento',
                $proposal['amount'],
                $proposal['commercialUserId'] ?: null,
                'Criado automaticamente a partir da proposta ' . $proposal['number'],
            ]);
            $projectId = (int) $pdo->lastInsertId();
            ensure_project_kanban_boards($pdo, $projectId, $projectName);

            if (empty($proposal['projectId'])) {
                $pdo->prepare('UPDATE commercial_proposals SET projectId = ? WHERE id = ?')
                    ->execute([$projectId, (int) $id]);
            }

            $stmt = $pdo->prepare(
                'INSERT INTO orcamentos_obras (projectId, clientId, name, version, budgetDate, status, totalPrice, notes)
                 VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)'
            );
            $stmt->execute([
                $projectId,
                $proposal['clientId'] ?: null,
                'Orçamento - ' . mb_substr($projectName, 0, 160),
                '1',
                'Aprovado',
                $proposal['amount'],
                'Gerado automaticamente da proposta ' . $proposal['number'],
            ]);
            $workBudgetId = (int) $pdo->lastInsertId();

            $stmt = $pdo->prepare('SELECT * FROM proposta_itens WHERE proposalId = ? ORDER BY itemNumber');
            $stmt->execute([(int) $id]);
            $items = $stmt->fetchAll();

            if ($items) {
                $insertItem = $pdo->prepare(
                    'INSERT INTO orcamento_obra_itens
                        (workBudgetId, projectId, origin, code, description, unit, quantity,
                         unitCost, totalCost, unitPrice, totalPrice, stageName)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                foreach ($items as $item) {
                    $insertItem->execute([
                        $workBudgetId,
                        $projectId,
                        'Item livre',
                        $item['code'] ?? null,
                        $item['description'],
                        $item['unit'] ?? null,
                        $item['quantity'],
                        $item['unitPrice'],
                        $item['totalPrice'],
                        $item['unitPrice'],
                        $item['totalPrice'],
                        $item['groupName'] ?? null,
                    ]);
                }
            }

            $pdo->prepare(
                'INSERT INTO eventos_automacao
                    (tipo_evento, entidade_origem_tipo, entidade_origem_id,
                     entidade_gerada_tipo, entidade_gerada_id, status)
                 VALUES (?, ?, ?, ?, ?, ?)'
            )->execute(['PROPOSTA_APROVADA', 'commercial_proposals', (int) $id, 'projects', $projectId, 'SUCESSO']);

            $pdo->commit();

            $updatedRecord = get_record($pdo, $resources[$key], (int) $id);
            respond(['ok' => true, 'record' => $updatedRecord, 'projectId' => $projectId, 'workBudgetId' => $workBudgetId]);

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            try {
                $pdo->prepare(
                    'INSERT INTO eventos_automacao
                        (tipo_evento, entidade_origem_tipo, entidade_origem_id, status, mensagem_erro)
                     VALUES (?, ?, ?, ?, ?)'
                )->execute(['PROPOSTA_APROVADA', 'commercial_proposals', (int) $id, 'ERRO', $e->getMessage()]);
            } catch (Throwable $_) {}
            fail('Erro ao aprovar proposta: ' . $e->getMessage(), 500);
        }
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        $payload = read_json();
        if ($key === 'users') {
            $payload = sanitize_user_profile_fields($pdo, $payload, (int) $id, false);
        }
        $record = update_record($pdo, $resources[$key], (int) $id, $payload);
        if ($key === 'users' && !empty($payload['password']) && !empty($payload['logoutOtherSessions'])) {
            // Troca de senha com "deslogar outras sessões": derruba todas as sessões
            // do usuário editado, EXCETO a do token desta requisição — invalidar a
            // sessão atual aqui quebraria a própria resposta e o logout ordenado
            // que o frontend faz na sequência.
            try {
                $currentTokenHash = hash('sha256', bearer_token());
                $pdo->prepare('DELETE FROM api_sessions WHERE userId = ? AND tokenHash != ?')
                    ->execute([(int) $id, $currentTokenHash]);
            } catch (Throwable $error) {
                error_log('[ObraSync] Falha ao encerrar outras sessões após troca de senha: ' . $error->getMessage());
            }
        }
        if ($key === 'agendaEvents') {
            $record['automation'] = create_event_day_notification($pdo, $record);
        }
        if ($key === 'kanbanCards' && kanban_card_is_done($pdo, $record)) {
            $record['completionPrompt'] = 'Card movido para Concluído. Deseja atualizar o status do item vinculado?';
        }
        respond(['ok' => true, 'record' => $record]);
    }

    if ($method === 'DELETE') {
        delete_record($pdo, $resources[$key], (int) $id);
        respond(['ok' => true]);
    }

    fail('Método não permitido.', 405);
} catch (Throwable $error) {
    fail($error->getMessage(), 500);
}
} // fim do if (PHP_SAPI !== 'cli') — roteamento web

function handle_agenda_module(PDO $pdo, string $method, array $query): never
{
    $action = strtolower(trim((string) ($query['action'] ?? '')));
    if ($action === '') {
        if ($method === 'GET') {
            $action = 'list';
        } elseif ($method === 'POST') {
            $action = 'create';
        } elseif ($method === 'PUT' || $method === 'PATCH') {
            $action = 'update';
        } elseif ($method === 'DELETE') {
            $action = 'delete';
        }
    }

    try {
        if ($action === 'list') {
            require_method($method, ['GET']);
            agenda_respond(true, agenda_list_events($pdo, $query));
        }

        if ($action === 'get') {
            require_method($method, ['GET']);
            $id = (int) ($query['id'] ?? 0);
            if ($id <= 0) {
                agenda_respond(false, [], 'Informe o id do evento.', 400);
            }
            agenda_respond(true, agenda_get_event($pdo, $id));
        }

        if ($action === 'create') {
            require_method($method, ['POST']);
            $record = agenda_create_event($pdo, read_json());
            agenda_respond(true, $record, 'Evento criado com sucesso.', 201);
        }

        if ($action === 'update') {
            require_method($method, ['PUT', 'PATCH', 'POST']);
            $id = (int) ($query['id'] ?? 0);
            $payload = read_json();
            if ($id <= 0) {
                $id = (int) ($payload['id'] ?? 0);
            }
            if ($id <= 0) {
                agenda_respond(false, [], 'Informe o id do evento.', 400);
            }
            $record = agenda_update_event($pdo, $id, $payload);
            agenda_respond(true, $record, 'Evento atualizado com sucesso.');
        }

        if ($action === 'delete') {
            require_method($method, ['DELETE', 'POST']);
            $id = (int) ($query['id'] ?? 0);
            if ($id <= 0) {
                agenda_respond(false, [], 'Informe o id do evento.', 400);
            }
            agenda_delete_event($pdo, $id);
            agenda_respond(true, [], 'Evento excluído com sucesso.');
        }

        agenda_respond(false, [], 'Ação da agenda inválida.', 400);
    } catch (Throwable $e) {
        agenda_respond(false, [], $e->getMessage(), 500);
    }
}

function agenda_respond(bool $success, mixed $data = [], string $message = '', int $status = 200): never
{
    http_response_code($status);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function agenda_list_events(PDO $pdo, array $query): array
{
    $table = resolve_existing_table($pdo, ['agenda_eventos']);
    $sql = 'SELECT * FROM `' . $table . '` WHERE 1=1';
    $params = [];

    $obraId = agenda_query_value($query, ['obra_id', 'obraId', 'projectId', 'project_id']);
    if ($obraId !== null && $obraId !== '') {
        $sql .= ' AND `obra_id` = ?';
        $params[] = (int) $obraId;
    }

    $tipo = agenda_query_value($query, ['tipo', 'type']);
    if ($tipo !== null && $tipo !== '') {
        $sql .= ' AND `tipo` = ?';
        $params[] = (string) $tipo;
    }

    $periodStart = agenda_date_only(agenda_query_value($query, ['periodo_inicio', 'data_inicio', 'inicio', 'start', 'from']));
    $periodEnd = agenda_date_only(agenda_query_value($query, ['periodo_fim', 'data_fim', 'fim', 'end', 'to']));
    if ($periodStart && $periodEnd) {
        $sql .= ' AND `data_inicio` <= ? AND (NULLIF(`data_fim`, "") IS NULL OR `data_fim` >= ?)';
        $params[] = $periodEnd . ' 23:59:59';
        $params[] = $periodStart . ' 00:00:00';
    } elseif ($periodStart) {
        $sql .= ' AND (DATE(`data_inicio`) >= ? OR DATE(`data_fim`) >= ?)';
        $params[] = $periodStart;
        $params[] = $periodStart;
    } elseif ($periodEnd) {
        $sql .= ' AND (DATE(`data_inicio`) <= ? OR DATE(`data_fim`) <= ?)';
        $params[] = $periodEnd;
        $params[] = $periodEnd;
    }

    $sql .= ' ORDER BY `data_inicio` ASC, `id` ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function agenda_get_event(PDO $pdo, int $id): array
{
    $table = resolve_existing_table($pdo, ['agenda_eventos']);
    $stmt = $pdo->prepare('SELECT * FROM `' . $table . '` WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if (!$record) {
        agenda_respond(false, [], 'Evento não encontrado.', 404);
    }
    return $record;
}

function agenda_create_event(PDO $pdo, array $payload): array
{
    $table = resolve_existing_table($pdo, ['agenda_eventos']);
    $data = agenda_normalize_event_payload($payload, false);

    if (empty($data['titulo']) || empty($data['data_inicio'])) {
        agenda_respond(false, [], 'Informe título e data de início.', 400);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `' . $table . '`
            (`obra_id`, `cliente_id`, `usuario_id`, `titulo`, `descricao`, `tipo`,
             `data_inicio`, `data_fim`, `dia_todo`, `lembrete_minutos`, `status`,
             `created_at`, `updated_at`)
         VALUES
            (:obra_id, :cliente_id, :usuario_id, :titulo, :descricao, :tipo,
             :data_inicio, :data_fim, :dia_todo, :lembrete_minutos, :status,
             NOW(), NOW())'
    );
    $stmt->execute([
        ':obra_id' => $data['obra_id'],
        ':cliente_id' => $data['cliente_id'],
        ':usuario_id' => $data['usuario_id'],
        ':titulo' => $data['titulo'],
        ':descricao' => $data['descricao'],
        ':tipo' => $data['tipo'],
        ':data_inicio' => $data['data_inicio'],
        ':data_fim' => $data['data_fim'],
        ':dia_todo' => $data['dia_todo'],
        ':lembrete_minutos' => $data['lembrete_minutos'],
        ':status' => $data['status'],
    ]);

    return agenda_get_event($pdo, (int) $pdo->lastInsertId());
}

function agenda_update_event(PDO $pdo, int $id, array $payload): array
{
    $table = resolve_existing_table($pdo, ['agenda_eventos']);
    $data = agenda_normalize_event_payload($payload, true);
    if (!$data) {
        agenda_respond(false, [], 'Nenhum campo válido para atualizar.', 400);
    }

    $sets = [];
    $params = [];
    foreach ($data as $field => $value) {
        $sets[] = '`' . $field . '` = ?';
        $params[] = $value;
    }
    $sets[] = '`updated_at` = NOW()';
    $params[] = $id;

    $stmt = $pdo->prepare('UPDATE `' . $table . '` SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($params);

    return agenda_get_event($pdo, $id);
}

function agenda_delete_event(PDO $pdo, int $id): void
{
    $table = resolve_existing_table($pdo, ['agenda_eventos']);
    $stmt = $pdo->prepare('DELETE FROM `' . $table . '` WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        agenda_respond(false, [], 'Evento não encontrado.', 404);
    }
}

function agenda_normalize_event_payload(array $payload, bool $onlyProvided): array
{
    $map = [
        'obra_id' => ['obra_id', 'obraId', 'projectId', 'project_id'],
        'cliente_id' => ['cliente_id', 'clienteId', 'clientId', 'client_id'],
        'usuario_id' => ['usuario_id', 'usuarioId', 'userId', 'user_id'],
        'titulo' => ['titulo', 'title'],
        'descricao' => ['descricao', 'description'],
        'tipo' => ['tipo', 'type'],
        'data_inicio' => ['data_inicio', 'dataInicio', 'start', 'startAt', 'startsAt'],
        'data_fim' => ['data_fim', 'dataFim', 'end', 'endAt', 'endsAt'],
        'dia_todo' => ['dia_todo', 'diaTodo', 'allDay'],
        'lembrete_minutos' => ['lembrete_minutos', 'lembreteMinutos', 'reminderMinutes'],
        'status' => ['status'],
    ];

    $data = [];
    foreach ($map as $column => $aliases) {
        $present = false;
        $value = agenda_payload_value($payload, $aliases, $present);
        if (!$present && $onlyProvided) {
            continue;
        }
        $data[$column] = agenda_cast_event_value($column, $value);
    }

    if (!$onlyProvided) {
        if ($data['dia_todo'] === null) {
            $data['dia_todo'] = 0;
        }
        if ($data['lembrete_minutos'] === null) {
            $data['lembrete_minutos'] = 60;
        }
        if (empty($data['status'])) {
            $data['status'] = 'agendado';
        }
    }

    return $data;
}

function agenda_payload_value(array $payload, array $aliases, bool &$present): mixed
{
    foreach ($aliases as $alias) {
        if (array_key_exists($alias, $payload)) {
            $present = true;
            return $payload[$alias];
        }
    }
    $present = false;
    return null;
}

function agenda_cast_event_value(string $column, mixed $value): mixed
{
    if ($value === null) {
        return null;
    }

    if (in_array($column, ['obra_id', 'cliente_id', 'usuario_id', 'dia_todo', 'lembrete_minutos'], true)) {
        return $value === '' ? null : (int) $value;
    }

    if (in_array($column, ['data_inicio', 'data_fim'], true)) {
        return agenda_datetime_value($value);
    }

    $value = trim((string) $value);
    return $value === '' ? null : $value;
}

function agenda_datetime_value(mixed $value): ?string
{
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }
    $value = str_replace('T', ' ', $value);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        $value .= ' 00:00:00';
    }
    return $value;
}

function agenda_date_only(mixed $value): ?string
{
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }
    return substr($value, 0, 10);
}

function agenda_query_value(array $query, array $aliases): mixed
{
    foreach ($aliases as $alias) {
        if (array_key_exists($alias, $query)) {
            return $query[$alias];
        }
    }
    return null;
}

function load_config(): array
{
    $path = getenv('FINANCEIRO_CONFIG') ?: CONFIG_PATH;
    if (is_file($path)) {
        return require $path;
    }
    return require __DIR__ . '/config.sample.php';
}

// Ambiente da instalação: 'production' por padrão. Defina 'app_env' => 'local' em
// /etc/financeiro/config.php para habilitar dados de exemplo automáticos em desenvolvimento.
function app_env(): string
{
    static $env = null;
    if ($env === null) {
        $config = load_config();
        $env = strtolower(trim((string) ($config['app_env'] ?? 'production')));
    }
    return $env;
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

function route_segments(): array
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    $path = preg_replace('#^.*?/api/?#', '', $path);
    return array_values(array_filter(explode('/', trim((string) $path, '/'))));
}

function require_method(string $method, array $allowed): void
{
    if (!in_array($method, $allowed, true)) {
        fail('Método não permitido.', 405);
    }
}

function read_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail('JSON inválido.', 400);
    }
    return $data;
}

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function resource_map(): array
{
    return [
        'clients' => r('clients', ['clientes'], ['name','document','zipCode','address','email','phone','status'], ['document','name']),
        'suppliers' => r('suppliers', ['fornecedores'], ['name','document','zipCode','address','email','phone','status'], ['document','name']),
        'categories' => r('financial_categories', ['categorias'], ['name','type','chartAccountId','status'], ['name']),
        'costCenters' => r('cost_centers', ['centros-custo','centros_de_custo'], ['code','name','manager','status'], ['code','name']),
        'bankAccounts' => r('bank_accounts', ['contas-bancarias','contas_bancarias'], ['name','bank','agency','accountNumber','openingBalance','status'], ['name']),
        'projects' => r('projects', ['obras','projetos','obras-projetos'], ['name','clientId','address','zipCode','responsible','technicalResponsible','projectManagerId','commercialUserId','financialUserId','startDate','endForecast','completionDate','status','budgetForecast','revenueContracted','costForecast','realizedCost','notes'], ['name']),
        'workTypes' => r('obra_tipos', ['tipos-obras','tipos-de-obras'], ['name','description','status','sortOrder'], ['name']),
        'workStatuses' => r('obra_status', ['status-obras','status-de-obras'], ['name','description','color','sortOrder','status'], ['name']),
        'standardStages' => r('obra_etapas_padrao', ['etapas-padrao','etapas-padrão'], ['workTypeId','name','description','sortOrder','defaultPhysicalPercent','status'], ['workTypeId','name']),
        'standardMilestones' => r('obra_marcos_padrao', ['marcos-padrao','marcos-padrão'], ['workTypeId','standardStageId','name','defaultMessage','visibleToClient','sortOrder','status'], ['workTypeId','name']),
        'customFields' => r('obra_campos_personalizados', ['campos-personalizados-obras'], ['workTypeId','fieldName','fieldType','options','required','sortOrder','status'], ['workTypeId','fieldName']),
        'customFieldValues' => r('obra_valores_personalizados', ['valores-personalizados-obras'], ['projectId','customFieldId','value','status'], ['projectId','customFieldId']),
        'sinapiReferences' => r('sinapi_referencias', ['sinapi-referencias','base-sinapi'], ['uf','referenceMonth','referenceYear','priceType','source','defaultUf','locationName','issueDate','availableTypes','importDate','importUserId','status'], ['uf','referenceMonth','referenceYear','priceType']),
        'sinapiInputs' => r('sinapi_insumos', ['sinapi-insumos','insumos-sinapi'], ['sinapiReferenceId','referenceType','uf','classification','code','description','unit','priceOrigin','unitPrice','origin','category','status'], ['sinapiReferenceId','code']),
        'sinapiCompositions' => r('sinapi_composicoes', ['sinapi-composicoes','composicoes-sinapi'], ['sinapiReferenceId','referenceType','uf','code','description','unit','unitCost','percentAS','type','groupName','className','status'], ['sinapiReferenceId','code']),
        'sinapiCompositionItems' => r('sinapi_composicao_itens', ['sinapi-composicao-itens','itens-composicoes-sinapi'], ['sinapiReferenceId','sinapiCompositionId','compositionCode','itemType','itemCode','itemDescription','unit','coefficient','situation','unitPrice','totalCost'], ['sinapiCompositionId','itemCode']),
        'sinapiLabor' => r('sinapi_mao_de_obra', ['sinapi-mao-de-obra','mao-de-obra-sinapi'], ['sinapiReferenceId','referenceType','uf','groupName','compositionCode','description','unit','laborPercent'], ['sinapiReferenceId','referenceType','uf','compositionCode']),
        'sinapiFamilies' => r('sinapi_familias_coeficientes', ['sinapi-familias-coeficientes','familias-coeficientes-sinapi'], ['sinapiReferenceId','familyCode','inputCode','inputDescription','unit','category','uf','coefficient'], ['sinapiReferenceId','uf','familyCode','inputCode']),
        'sinapiMaintenances' => r('sinapi_manutencoes', ['sinapi-manutencoes','manutencoes-sinapi'], ['sinapiReferenceId','referenceCode','itemType','code','description','maintenanceType'], ['sinapiReferenceId','referenceCode','itemType','code','maintenanceType']),
        'sinapiSettings' => r('sinapi_configuracoes', ['sinapi-configuracoes','configuracoes-sinapi'], ['defaultUf','defaultReferenceMonth','defaultReferenceYear','defaultReferenceType','defaultBdiPercent','defaultItemMode','showSinapiCodeInProposal','showAnalyticalInProposal','showUnitPriceInProposal','showGlobalOnlyInProposal','status'], ['defaultUf','defaultReferenceMonth','defaultReferenceYear','defaultReferenceType']),
        'ownCompositions' => r('composicoes_proprias', ['composicoes-proprias','composições-próprias'], ['code','description','unit','estimatedCost','laborCost','materialCost','equipmentCost','thirdPartyCost','marginPercent','suggestedPrice','status'], ['code']),
        'workBudgets' => r('orcamentos_obras', ['orcamentos-obras','orçamentos-obras'], ['projectId','clientId','name','version','budgetDate','sinapiReferenceId','priceType','status','bdiPercent','chargesPercent','discountPercent','directCost','totalCost','totalPrice','notes','createdByUserId','commercialUserId'], ['projectId','name','version']),
        'workBudgetItems' => r('orcamento_obra_itens', ['itens-orcamentos-obras','itens-orçamentos-obras'], ['workBudgetId','projectId','origin','sinapiReferenceId','sinapiUf','sinapiReferenceType','code','description','unit','quantity','unitCost','totalCost','bdiPercent','unitPrice','totalPrice','stageName','costCenterId','categoryId','notes'], ['workBudgetId','code','description']),
        'quotes' => r('cotacoes', ['cotacoes','cotações'], ['supplierId','description','unit','quantity','unitValue','totalValue','quoteDate','validityDate','attachmentPath','projectId','workBudgetId','notes','status'], ['supplierId','description','quoteDate']),
        'fiscalDocuments' => r('fiscal_documents', ['notas-fiscais','documentos-fiscais-obra'], ['projectId','supplierId','documentNumber','issueDate','amount','type','status','payableId','receivableId','saleId','costCenterId','categoryId','pdfPath','xmlPath','notes'], ['documentNumber'], ['pdfPath','xmlPath']),
        'projectSchedule' => r('obra_cronograma_etapas', ['cronograma-fisico-financeiro','cronograma-obras','cronograma'], ['projectId','stageName','description','sortOrder','plannedStartDate','plannedEndDate','actualStartDate','actualEndDate','plannedPhysicalPercent','actualPhysicalPercent','plannedFinancialAmount','actualFinancialAmount','workBudgetId','workBudgetItemId','predecessorIds','durationDays','status','responsible','isMilestone','milestoneName','milestoneMessage','visibleToClient','notes'], ['projectId','stageName']),
        'projectMilestones' => r('obra_cronograma_marcos', ['marcos-obras','marcos-da-obra'], ['projectId','scheduleStepId','name','defaultMessage','visibleToClient','plannedDate','completedDate','status','notes'], ['projectId','name']),
        'projectNotifications' => r('obra_notificacoes', ['notificacoes-obras','notificacoes-da-obra'], ['projectId','scheduleStepId','milestoneId','recipient','phone','type','message','generatedLink','status','responsibleUserId'], ['generatedLink']),
        'projectTrackingLinks' => r('obra_links_acompanhamento', ['links-acompanhamento-obras','links-obras'], ['projectId','token','url','visibility','status','notes'], ['token']),
        'agendaEvents' => r('agenda_eventos', ['agenda-eventos','agenda'], ['obra_id','cliente_id','usuario_id','titulo','descricao','tipo','data_inicio','data_fim','dia_todo','lembrete_minutos','status'], ['titulo','data_inicio']),
        'kanbanBoards' => r('kanban_boards', ['kanban-boards','quadros-kanban'], ['obra_id','nome','tipo'], ['obra_id','nome','tipo']),
        'kanbanColumns' => r('kanban_colunas', ['kanban-colunas','colunas-kanban'], ['board_id','nome','ordem','cor','limite_cards'], ['board_id','nome']),
        'kanbanCards' => r('kanban_cards', ['kanban-cards','cards-kanban'], ['coluna_id','obra_id','titulo','descricao','responsavel_id','data_vencimento','prioridade','referencia_tipo','referencia_id','ordem'], ['referencia_tipo','referencia_id','titulo']),
        'purchaseOrders' => r('purchase_orders', ['pedidos-compra','pedidos-de-compra'], ['number','date','projectId','supplierId','costCenterId','categoryId','amount','expectedDate','status','notes'], ['number']),
        'technicalReports' => r('technical_reports', ['relatorios-tecnicos','relatórios-técnicos'], ['projectId','title','date','responsible','visibleToClient','status','notes'], ['projectId','title','date']),
        'products' => r('products', ['produtos'], ['name','sku','categoryId','costCenterId','projectId','cost','price','stock','status'], ['sku','name']),
        'services' => r('services', ['servicos','serviços'], ['name','categoryId','costCenterId','projectId','cost','price','status'], ['name']),
        'budgets' => r('budgets', ['orcamentos','orçamentos'], ['number','date','clientId','projectId','proposalId','costCenterId','createdByUserId','commercialUserId','description','amount','status'], ['number']),
        'proposalAreas' => r('proposal_areas', ['proposta-areas','areas-propostas'], ['name','description','status'], ['name']),
        'proposalActionTypes' => r('proposal_action_types', ['proposta-tipos','tipos-propostas'], ['areaId','name','description','status'], ['areaId','name']),
        'proposalServiceSubtypes' => r('proposal_service_subtypes', ['proposta-subtipos','subtipos-propostas'], ['actionTypeId','name','description','status'], ['actionTypeId','name']),
        'proposalModels' => r('proposal_models', ['modelos-propostas','modelos-de-propostas'], ['name','areaId','actionTypeId','subtypeId','proposalObject','scope','stages','deliverables','deadline','paymentTerms','includedItems','excludedItems','clientResponsibilities','companyResponsibilities','validityDays','generalConditions','acceptanceText','signatureText','printLayout','status'], ['name']),
        'proposals' => r('commercial_proposals', ['propostas'], ['number','date','clientId','projectId','budgetId','workBudgetId','serviceId','modelId','areaId','actionTypeId','subtypeId','origin','parentProposalId','createdByUserId','commercialUserId','description','amount','proposalBody','itemDisplayMode','paymentCondition','paymentTerms','executionDeadline','deadline','validityDate','technicalResponsible','commercialResponsible','commercialNotes','status'], ['number']),
        'proposalItems' => r('proposta_itens', ['proposta-itens','itens-proposta'], ['proposalId','workBudgetItemId','itemNumber','code','description','unit','quantity','unitPrice','totalPrice','groupName','visibleToClient','notes'], ['proposalId','itemNumber']),
        'proposalStatusHistory' => r('proposta_status_historico', ['proposta-status-historico','historico-status-proposta'], ['proposalId','date','userId','previousStatus','newStatus','notes'], ['proposalId','date','newStatus']),
        'proposalFiles' => r('proposta_arquivos', ['proposta-arquivos','arquivos-proposta'], ['proposalId','filePath','type','status','createdByUserId'], ['proposalId','filePath']),
        'proposalBudgetLinks' => r('proposta_orcamento_vinculos', ['proposta-orcamento-vinculos','vinculos-proposta-orcamento'], ['proposalId','workBudgetId','projectId','clientId','proposalModelId','responsibleUserId'], ['proposalId','workBudgetId']),
        'proposalVariables' => r('proposta_variaveis', ['proposta-variaveis','variaveis-proposta'], ['proposalId','variableName','variableValue'], ['proposalId','variableName']),
        'sales' => r('sales_contracts', ['vendas','contratos','vendas-contratos'], ['number','date','competenceDate','clientId','projectId','proposalId','costCenterId','description','amount','cost','status'], ['number']),
        'viabilityAnalyses' => r('viability_analyses', ['analises-viabilidade','análises-viabilidade'], ['projectId','proposalId','contractValue','estimatedCost','executionMonths','tmaPercent','grossMargin','marginPercent','estimatedProfit','paybackMonths','npv','irrPercent','autoVerdict','verdict','finalVerdict','verdictJustification','verdictHistory','risks','notes','analysisDate','responsibleUserId','status'], []),
        'plugins' => r('system_plugins', ['plugins'], ['name','url','icon','description','roles','sortOrder','status'], ['name']),
        'receivable' => r('accounts_receivable', ['contas-receber','contas_a_receber'], ['document','issueDate','dueDate','receivedDate','clientId','projectId','proposalId','categoryId','costCenterId','bankAccount','amount','status'], ['document']),
        'payable' => r('accounts_payable', ['contas-pagar','contas_a_pagar'], ['document','issueDate','dueDate','paidDate','supplierId','projectId','categoryId','costCenterId','bankAccount','amount','status'], ['document']),
        'cashMoves' => r('cash_bank_movements', ['movimentacoes-caixa','movimentacoes','movimentações'], ['date','bankAccount','type','categoryId','projectId','costCenterId','history','amount','originDocument','status'], ['originDocument']),
        'chartAccounts' => r('chart_accounts', ['plano-contas'], ['code','name','type','parentId','acceptsEntries','status'], ['code']),
        'journalEntries' => r('journal_entries', ['lancamentos-contabeis','lançamentos-contábeis'], ['entryDate','competenceDate','debitAccountId','creditAccountId','history','amount','projectId','costCenterId','originDocument'], ['originDocument']),
        'taxDocuments' => r('tax_documents', ['documentos-fiscais'], ['document','date','type','clientId','supplierId','projectId','amount','status'], ['document']),
        'taxes' => r('taxes', ['impostos'], ['name','competenceDate','baseAmount','rate','amount','projectId','status'], ['name','competenceDate']),
        'companySettings' => r('company_settings', ['dados-empresa'], ['name','document','zipCode','address','email','phone','city','status'], ['document','name']),
        'users' => r('system_users', ['usuarios','usuários'], ['username','fullName','email','password','role','status','blocked','mustChangePassword','cpf','data_nascimento','celular'], ['username'], ['password']),
        'permissions' => r('role_permissions', ['permissoes','permissões'], ['role','module','canView','canCreate','canEdit','canDelete','canExport','canApprove','canAttach','status'], ['role','module']),
        'systemVersion' => r('sistema_versoes', ['sistema-versoes','versoes-sistema'], ['versao','data_versao','descricao','alteracoes'], ['versao']),
        'reportModels' => r('modelos_relatorio', ['modelos-relatorios','modelos-relatórios'], ['name','workTypeId','serviceSubtypeId','body','variables','status'], ['name']),
        'documentTypes' => r('tipos_documento', ['tipos-documentos'], ['name','description','folder','visibleToClientDefault','status'], ['name']),
        'checklists' => r('checklists', ['checklists-obras'], ['name','workTypeId','standardStageId','required','allowsPhoto','allowsAttachment','status'], ['name','workTypeId','standardStageId']),
        'checklistItems' => r('checklist_itens', ['itens-checklists'], ['checklistId','description','required','sortOrder','status'], ['checklistId','description']),
        'measurementTypes' => r('tipos_medicao', ['tipos-medicao','tipos-medição'], ['name','description','unit','status'], ['name']),
        'paymentMethods' => r('formas_pagamento', ['formas-pagamento'], ['name','description','installments','status'], ['name']),
        'whatsappTemplates' => r('mensagens_padrao', ['mensagens-padrao','mensagens-padrão'], ['name','context','message','status'], ['name','context']),
        'visibilityRules' => r('regras_visualizacao', ['regras-visualizacao','regras-visualização'], ['role','module','workTypeId','rule','status'], ['role','module','workTypeId']),
        'preferences' => r('system_preferences', ['preferencias','preferências'], ['name','value','description','status'], ['name']),
    ];
}

function r(string $table, array $aliases, array $fields, array $unique, array $hidden = []): array
{
    return ['table' => $table, 'aliases' => $aliases, 'fields' => $fields, 'unique' => $unique, 'hidden' => $hidden];
}

function normalize_resource(string $resource, array $resources): ?string
{
    foreach ($resources as $key => $meta) {
        if ($resource === $key || in_array($resource, $meta['aliases'], true)) {
            return $key;
        }
    }
    return null;
}

function list_records(PDO $pdo, array $meta): array
{
    $where = [];
    $params = [];
    $columns = table_columns($pdo, $meta['table']);
    $query = normalize_payload_aliases($_GET);
    foreach ($meta['fields'] as $field) {
        if (!in_array($field, $columns, true)) {
            continue;
        }
        if (in_array($field, $meta['hidden'] ?? [], true)) {
            continue;
        }
        if (isset($query[$field]) && $query[$field] !== '') {
            $where[] = "`$field` = ?";
            $params[] = $query[$field];
        }
    }
    if (!empty($_GET['search'])) {
        $like = '%' . $_GET['search'] . '%';
        $searchable = array_filter($meta['fields'], fn ($field) => in_array($field, $columns, true) && !in_array($field, $meta['hidden'] ?? [], true) && preg_match('/name|document|description|history|notes|username|email|address/i', $field));
        if ($searchable) {
            $where[] = '(' . implode(' OR ', array_map(fn ($field) => "`$field` LIKE ?", $searchable)) . ')';
            foreach ($searchable as $_) {
                $params[] = $like;
            }
        }
    }
    if (!empty($_GET['start']) || !empty($_GET['end'])) {
        $dateField = first_existing($meta['fields'], ['date','issueDate','dueDate','entryDate','competenceDate','startDate','endForecast','completionDate','plannedStartDate','plannedEndDate','actualStartDate','actualEndDate','plannedDate','completedDate','expectedDate','validityDate','budgetDate','quoteDate','importDate','data_versao']);
        if ($dateField) {
            if (!empty($_GET['start'])) {
                $where[] = "`$dateField` >= ?";
                $params[] = $_GET['start'];
            }
            if (!empty($_GET['end'])) {
                $where[] = "`$dateField` <= ?";
                $params[] = $_GET['end'];
            }
        }
    }
    $sql = 'SELECT * FROM `' . $meta['table'] . '`';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY id DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return array_map(fn ($record) => sanitize_record($meta, $record), $stmt->fetchAll());
}

function first_existing(array $fields, array $candidates): ?string
{
    foreach ($candidates as $field) {
        if (in_array($field, $fields, true)) {
            return $field;
        }
    }
    return null;
}

function clean_payload(array $meta, array $payload): array
{
    $payload = normalize_payload_aliases($payload);
    $clean = [];
    foreach ($meta['fields'] as $field) {
        if (array_key_exists($field, $payload)) {
            $value = normalize_value($payload[$field]);
            if ($field === 'password' && $value) {
                $pwErr = validate_password_strength((string) $value);
                if ($pwErr) {
                    fail($pwErr, 400);
                }
                $clean[$field] = password_hash((string) $value, PASSWORD_DEFAULT);
            } else {
                $clean[$field] = $value;
            }
        }
    }
    return $clean;
}

function normalize_payload_aliases(array $payload): array
{
    $aliases = [
        'projectId' => ['project_id', 'obra_id', 'projeto_id'],
        'clientId' => ['client_id', 'cliente_id'],
        'supplierId' => ['supplier_id', 'fornecedor_id'],
        'categoryId' => ['category_id', 'categoria_id'],
        'costCenterId' => ['cost_center_id', 'centro_custo_id'],
        'proposalId' => ['proposal_id', 'proposta_id'],
        'budgetId' => ['budget_id', 'orcamento_id'],
        'serviceId' => ['service_id', 'servico_id'],
        'saleId' => ['sale_id', 'venda_id', 'contrato_id'],
        'payableId' => ['payable_id', 'conta_pagar_id'],
        'receivableId' => ['receivable_id', 'conta_receber_id'],
        'scheduleStepId' => ['schedule_step_id', 'etapa_id'],
        'milestoneId' => ['milestone_id', 'marco_id'],
        'responsibleUserId' => ['responsible_user_id', 'usuario_responsavel'],
        'obra_id' => ['projectId', 'project_id', 'obraId'],
        'cliente_id' => ['clientId', 'client_id', 'clienteId'],
        'usuario_id' => ['userId', 'user_id', 'usuarioId'],
        'data_inicio' => ['startDateTime', 'dataInicio'],
        'data_fim' => ['endDateTime', 'dataFim'],
        'dia_todo' => ['allDay', 'diaTodo'],
        'lembrete_minutos' => ['reminderMinutes', 'lembreteMinutos'],
        'board_id' => ['boardId'],
        'coluna_id' => ['columnId', 'colunaId'],
        'responsavel_id' => ['responsibleId', 'responsavelId'],
        'data_vencimento' => ['dueDate', 'dataVencimento'],
        'referencia_tipo' => ['referenceType', 'referenciaTipo'],
        'referencia_id' => ['referenceId', 'referenciaId'],
        'workTypeId' => ['work_type_id', 'tipo_obra_id'],
        'standardStageId' => ['standard_stage_id', 'etapa_padrao_id'],
        'customFieldId' => ['custom_field_id', 'campo_personalizado_id'],
        'sinapiReferenceId' => ['sinapi_reference_id', 'referencia_sinapi_id'],
        'sinapiCompositionId' => ['sinapi_composition_id', 'composicao_sinapi_id'],
        'referenceType' => ['tipo_referencia'],
        'classification' => ['classificacao'],
        'priceOrigin' => ['origem_preco'],
        'percentAS' => ['percentual_as'],
        'compositionCode' => ['codigo_composicao'],
        'referenceCode' => ['referencia'],
        'maintenanceType' => ['manutencao'],
        'familyCode' => ['codigo_familia'],
        'inputCode' => ['codigo_insumo'],
        'inputDescription' => ['descricao_insumo'],
        'laborPercent' => ['percentual_mao_de_obra'],
        'defaultUf' => ['uf_padrao'],
        'issueDate' => ['data_emissao'],
        'workBudgetId' => ['work_budget_id', 'orcamento_obra_id'],
        'workBudgetItemId' => ['work_budget_item_id', 'orcamento_item_id', 'item_orcamento_id'],
        'sinapiUf' => ['sinapi_uf', 'uf_sinapi'],
        'sinapiReferenceType' => ['sinapi_reference_type', 'tipo_referencia_sinapi'],
        'importUserId' => ['import_user_id', 'usuario_importacao'],
        'serviceSubtypeId' => ['service_subtype_id', 'subtipo_servico_id'],
        'checklistId' => ['checklist_id'],
        'proposalModelId' => ['proposal_model_id', 'modelo_proposta_id'],
        'userId' => ['user_id', 'usuario_id'],
    ];
    foreach ($aliases as $canonical => $names) {
        if (array_key_exists($canonical, $payload)) {
            continue;
        }
        foreach ($names as $alias) {
            if (array_key_exists($alias, $payload)) {
                $payload[$canonical] = $payload[$alias];
                break;
            }
        }
    }
    return $payload;
}

function normalize_value(mixed $value): mixed
{
    if (is_string($value)) {
        $value = trim($value);
        return $value === '' ? null : $value;
    }
    return $value;
}

function create_record(PDO $pdo, array $meta, array $payload): array
{
    $data = filter_data_by_columns($pdo, $meta, clean_payload($meta, $payload));
    if (!$data) {
        fail('Nenhum campo válido informado.', 400);
    }
    $columns = array_keys($data);
    $sql = 'INSERT INTO `' . $meta['table'] . '` (`' . implode('`,`', $columns) . '`) VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_values($data));
    return get_record($pdo, $meta, (int) $pdo->lastInsertId());
}

function update_record(PDO $pdo, array $meta, int $id, array $payload): array
{
    $data = filter_data_by_columns($pdo, $meta, clean_payload($meta, $payload));
    if (!$data) {
        fail('Nenhum campo válido informado.', 400);
    }
    $before = raw_record($pdo, $meta, $id);
    $transactionalAutomation = in_array($meta['table'], ['obra_cronograma_marcos', 'purchase_orders'], true);
    if ($transactionalAutomation) {
        $pdo->beginTransaction();
    }
    try {
        $sets = array_map(fn ($field) => "`$field` = ?", array_keys($data));
        $stmt = $pdo->prepare('UPDATE `' . $meta['table'] . '` SET ' . implode(',', $sets) . ' WHERE id = ?');
        $stmt->execute([...array_values($data), $id]);
        $record = get_record($pdo, $meta, $id);
        if ($transactionalAutomation && status_changed_to($before, $record, ['Concluido', 'Concluido', 'Aprovado', 'Aprovada'])) {
            if ($meta['table'] === 'obra_cronograma_marcos') {
                $record['automation'] = automate_approved_milestone($pdo, $id);
            }
            if ($meta['table'] === 'purchase_orders' && status_changed_to($before, $record, ['Aprovado', 'Aprovada'])) {
                $record['automation'] = automate_approved_purchase_order($pdo, $id);
            }
        }
        if ($transactionalAutomation) {
            $pdo->commit();
        }
        return $record;
    } catch (Throwable $error) {
        if ($transactionalAutomation && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($meta['table'] === 'obra_cronograma_marcos') {
            log_automation_event($pdo, 'MARCO_APROVADO', 'MARCO', $id, null, null, 'ERRO', $error->getMessage(), null);
        }
        if ($meta['table'] === 'purchase_orders') {
            log_automation_event($pdo, 'PEDIDO_APROVADO', 'PEDIDO_COMPRA', $id, null, null, 'ERRO', $error->getMessage(), null);
        }
        throw $error;
    }
}

function delete_record(PDO $pdo, array $meta, int $id): void
{
    $stmt = $pdo->prepare('DELETE FROM `' . $meta['table'] . '` WHERE id = ?');
    $stmt->execute([$id]);
}

function get_record(PDO $pdo, array $meta, int $id): array
{
    $stmt = $pdo->prepare('SELECT * FROM `' . $meta['table'] . '` WHERE id = ?');
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if (!$record) {
        fail('Registro não encontrado.', 404);
    }
    return sanitize_record($meta, $record);
}

function table_columns(PDO $pdo, string $table): array
{
    static $cache = [];
    if (!isset($cache[$table])) {
        $stmt = $pdo->query('DESCRIBE `' . $table . '`');
        $cache[$table] = array_map(fn ($row) => $row['Field'], $stmt->fetchAll());
    }
    return $cache[$table];
}

function filter_data_by_columns(PDO $pdo, array $meta, array $data): array
{
    $columns = table_columns($pdo, $meta['table']);
    return array_filter($data, fn ($field) => in_array($field, $columns, true), ARRAY_FILTER_USE_KEY);
}

// Colunas cadastrais extras dos usuários (cpf/data_nascimento/celular), criadas
// sob demanda como as demais tabelas novas — dispensa migração manual em produção.
function ensure_users_extra_columns(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    try {
        $pdo->exec("ALTER TABLE system_users
            ADD COLUMN IF NOT EXISTS cpf VARCHAR(14) NULL,
            ADD COLUMN IF NOT EXISTS data_nascimento DATE NULL,
            ADD COLUMN IF NOT EXISTS celular VARCHAR(15) NULL");
        $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS uk_system_users_cpf ON system_users (cpf)');
    } catch (PDOException $error) {
        // Sem permissão de DDL: segue; filter_data_by_columns descarta os campos ausentes.
        error_log('[ObraSync] ensure_users_extra_columns: ' . $error->getMessage());
    }
    $done = true;
}

// Validação de CPF com dígitos verificadores (mesma regra do frontend).
function cpf_is_valid(string $digits): bool
{
    if (!preg_match('/^\d{11}$/', $digits) || preg_match('/^(\d)\1{10}$/', $digits)) {
        return false;
    }
    foreach ([10, 11] as $factor) {
        $sum = 0;
        for ($i = 0; $i < $factor - 1; $i++) {
            $sum += (int) $digits[$i] * ($factor - $i);
        }
        $rest = ($sum * 10) % 11;
        if ($rest === 10) {
            $rest = 0;
        }
        if ($rest !== (int) $digits[$factor - 1]) {
            return false;
        }
    }
    return true;
}

// Sanitiza e valida cpf/data_nascimento/celular do cadastro de usuários
// (dupla verificação: o frontend já valida, mas a API não confia nele).
// No POST os três campos são obrigatórios; no PUT são validados quando enviados
// com valor (toggles parciais, como bloquear usuário antigo sem CPF, seguem).
function sanitize_user_profile_fields(PDO $pdo, array $payload, ?int $id, bool $required): array
{
    $cpf = preg_replace('/\D/', '', (string) ($payload['cpf'] ?? ''));
    $nascimento = trim((string) ($payload['data_nascimento'] ?? ''));
    $celular = preg_replace('/\D/', '', (string) ($payload['celular'] ?? ''));

    if ($cpf !== '' || $required) {
        if (!cpf_is_valid($cpf)) {
            fail('CPF inválido. Confira os dígitos informados.', 422);
        }
        $stmt = $pdo->prepare('SELECT id FROM system_users WHERE cpf = ? AND id != ? LIMIT 1');
        $stmt->execute([$cpf, $id ?? 0]);
        if ($stmt->fetchColumn()) {
            fail('CPF já cadastrado para outro usuário.', 422);
        }
        $payload['cpf'] = $cpf;
    } else {
        unset($payload['cpf']);
    }

    if ($nascimento !== '' || $required) {
        $date = DateTime::createFromFormat('Y-m-d', $nascimento);
        $valid = $date && $date->format('Y-m-d') === $nascimento;
        if ($valid) {
            $today = new DateTime('today');
            $age = (int) $date->diff($today)->format('%y');
            $valid = $date <= $today && $age >= 16 && $age <= 100;
        }
        if (!$valid) {
            fail('Data de nascimento inválida (idade entre 16 e 100 anos, formato AAAA-MM-DD).', 422);
        }
        $payload['data_nascimento'] = $nascimento;
    } else {
        unset($payload['data_nascimento']);
    }

    if ($celular !== '' || $required) {
        $ddd = (int) substr($celular, 0, 2);
        if (strlen($celular) !== 11 || $ddd < 11 || $ddd > 99 || $celular[2] !== '9') {
            fail('Celular inválido. Use DDD + 9 dígitos, por exemplo (67) 99999-9999.', 422);
        }
        $payload['celular'] = $celular;
    } else {
        unset($payload['celular']);
    }

    return $payload;
}

function bootstrap_data(PDO $pdo, array $resources, ?array $authUser = null): array
{
    $role = (string) ($authUser['role'] ?? 'admin');
    // Garante a tabela de plugins já no bootstrap: o menu lateral depende dela.
    try {
        ensure_plugins_table($pdo);
    } catch (PDOException $error) {
        // Sem permissão de DDL: o bootstrap segue e devolve a lista vazia.
    }
    $data = [];
    foreach ($resources as $key => $meta) {
        if (!role_can($pdo, $role, permission_module_key($key), 'view')) {
            // Todos os perfis recebem a lista básica de usuários para exibir vínculos por nome.
            if ($key === 'users') {
                try {
                    $stmt = $pdo->query('SELECT id, username, fullName, role, status FROM system_users ORDER BY id DESC');
                    $data[$key] = $stmt->fetchAll();
                } catch (PDOException $error) {
                    $data[$key] = [];
                }
                continue;
            }
            $data[$key] = [];
            continue;
        }
        try {
            $stmt = $pdo->query('SELECT * FROM `' . $meta['table'] . '` ORDER BY id DESC');
            $data[$key] = array_map(fn ($record) => sanitize_record($meta, $record), $stmt->fetchAll());
        } catch (PDOException $error) {
            $data[$key] = [];
        }
    }
    return $data;
}

function sanitize_record(array $meta, array $record): array
{
    if ($meta['table'] === 'fiscal_documents') {
        $record['hasPdf'] = !empty($record['pdfPath']);
        $record['hasXml'] = !empty($record['xmlPath']);
    }
    foreach ($meta['hidden'] ?? [] as $field) {
        unset($record[$field]);
    }
    return $record;
}

function ensure_api_sessions_table(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS api_sessions (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            userId BIGINT UNSIGNED NOT NULL,
            tokenHash CHAR(64) NOT NULL,
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            lastActivity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_api_sessions_token (tokenHash),
            KEY idx_api_sessions_user (userId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    // Repara tabelas criadas por versões anteriores: sem as colunas/defaults
    // esperados, a sessão era gravada com data zero e descartada imediatamente
    // como "expirada" — deixando api_sessions sempre vazia ("Sessão inválida").
    try {
        $columns = [];
        foreach ($pdo->query('DESCRIBE api_sessions') as $column) {
            $columns[strtolower((string) $column['Field'])] = $column;
        }
        if (!isset($columns['userid'])) {
            $pdo->exec('ALTER TABLE api_sessions ADD COLUMN userId BIGINT UNSIGNED NOT NULL');
        }
        if (!isset($columns['tokenhash'])) {
            $pdo->exec('ALTER TABLE api_sessions ADD COLUMN tokenHash CHAR(64) NOT NULL');
        }
        if (!isset($columns['createdat'])) {
            $pdo->exec('ALTER TABLE api_sessions ADD COLUMN createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
        }
        if (!isset($columns['lastactivity'])) {
            $pdo->exec('ALTER TABLE api_sessions ADD COLUMN lastActivity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
        } else {
            $default = strtoupper((string) ($columns['lastactivity']['Default'] ?? ''));
            if (!str_contains($default, 'CURRENT_TIMESTAMP')) {
                $pdo->exec('ALTER TABLE api_sessions MODIFY COLUMN lastActivity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
            }
        }
    } catch (PDOException $error) {
        // Sem permissão de DDL: registra e segue — o INSERT do login define as
        // datas explicitamente e não depende dos defaults da tabela.
        error_log('[ObraSync auth] reparo da api_sessions falhou: ' . $error->getMessage());
    }
    $done = true;
}

function ensure_viability_table(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS viability_analyses (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            projectId BIGINT UNSIGNED NULL,
            proposalId BIGINT UNSIGNED NULL,
            contractValue DECIMAL(14,2) NOT NULL DEFAULT 0,
            estimatedCost DECIMAL(14,2) NOT NULL DEFAULT 0,
            executionMonths INT NOT NULL DEFAULT 0,
            tmaPercent DECIMAL(7,2) NOT NULL DEFAULT 0,
            grossMargin DECIMAL(14,2) NOT NULL DEFAULT 0,
            marginPercent DECIMAL(9,2) NOT NULL DEFAULT 0,
            estimatedProfit DECIMAL(14,2) NOT NULL DEFAULT 0,
            paybackMonths DECIMAL(7,1) NOT NULL DEFAULT 0,
            npv DECIMAL(14,2) NOT NULL DEFAULT 0,
            irrPercent DECIMAL(9,2) NULL,
            autoVerdict VARCHAR(30) NOT NULL DEFAULT '',
            verdict VARCHAR(30) NOT NULL DEFAULT 'Automático',
            finalVerdict VARCHAR(30) NOT NULL DEFAULT '',
            verdictJustification TEXT NULL,
            verdictHistory TEXT NULL,
            risks TEXT NULL,
            notes TEXT NULL,
            analysisDate DATE NULL,
            responsibleUserId BIGINT UNSIGNED NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'Em análise',
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_viability_project (projectId),
            KEY idx_viability_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $done = true;
}

// Plugins: links para sistemas externos exibidos no menu lateral, geridos pelo admin.
function ensure_plugins_table(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $tableExisted = (bool) $pdo->query("SHOW TABLES LIKE 'system_plugins'")->fetchColumn();
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS system_plugins (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            url VARCHAR(500) NOT NULL,
            icon VARCHAR(40) NULL,
            description VARCHAR(300) NULL,
            roles VARCHAR(300) NULL,
            sortOrder INT NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'Ativo',
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_plugins_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    // Exemplo "Portal do Cliente" SOMENTE em ambiente local (app_env = 'local' no
    // config) e apenas na criação da tabela: se o usuário excluir o exemplo, ele
    // não é recriado. Em produção a tabela nasce vazia, sem dado fictício algum.
    if (!$tableExisted && app_env() === 'local') {
        $pdo->prepare('INSERT INTO system_plugins (name, url, icon, description, roles, sortOrder, status) VALUES (?,?,?,?,?,?,?)')
            ->execute(['Portal do Cliente', 'https://schimanskiengenharia.com.br/portal', '🌐', 'Acesso ao portal externo do cliente (URL configurável).', '', 1, 'Ativo']);
    }
    $done = true;
}

function bearer_token(): string
{
    $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($header === '' && function_exists('apache_request_headers')) {
        $headers = array_change_key_case(apache_request_headers() ?: [], CASE_LOWER);
        $header = (string) ($headers['authorization'] ?? '');
    }
    if (preg_match('/^Bearer\s+(\S+)$/i', $header, $match)) {
        return $match[1];
    }
    $token = trim((string) ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? ''));
    if ($token !== '') {
        return $token;
    }
    // Fallback para downloads abertos por navegação direta (links de PDF/XML),
    // onde o navegador não envia headers personalizados.
    return trim((string) ($_GET['token'] ?? ''));
}

function authenticate_request(PDO $pdo, array $config): array
{
    $auth = $config['auth'] ?? [];
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!empty($auth['dev_bypass']) && in_array($remote, ['127.0.0.1', '::1'], true)) {
        // Atalho exclusivo de desenvolvimento local; nunca habilite em produção.
        return ['id' => 0, 'username' => 'dev', 'role' => 'admin'];
    }

    $token = bearer_token();
    if ($token === '') {
        fail('Não autenticado. Faça login para acessar a API.', 401);
    }
    ensure_api_sessions_table($pdo);
    // idleSeconds calculado pelo relógio do PRÓPRIO MySQL (TIMESTAMPDIFF x NOW()):
    // a expiração não depende do fuso do PHP — comparar strtotime() com time()
    // descartava sessões válidas quando PHP e MySQL estavam em fusos diferentes.
    $stmt = $pdo->prepare(
        'SELECT s.id AS sessionId, s.lastActivity,
                TIMESTAMPDIFF(SECOND, s.lastActivity, NOW()) AS idleSeconds,
                u.id, u.username, u.role, u.status, u.blocked
           FROM api_sessions s
           JOIN system_users u ON u.id = s.userId
          WHERE s.tokenHash = ?
          LIMIT 1'
    );
    $stmt->execute([hash('sha256', $token)]);
    $session = $stmt->fetch();
    if (!$session) {
        fail('Sessão inválida. Faça login novamente.', 401);
    }
    if ((int) $session['idleSeconds'] > AUTH_IDLE_SECONDS) {
        $pdo->prepare('DELETE FROM api_sessions WHERE id = ?')->execute([$session['sessionId']]);
        fail('Sessão expirada por inatividade. Faça login novamente.', 401);
    }
    if (($session['status'] ?? '') !== 'Ativo' || !empty($session['blocked'])) {
        fail('Usuário inativo ou bloqueado.', 403);
    }
    $pdo->prepare('UPDATE api_sessions SET lastActivity = CURRENT_TIMESTAMP WHERE id = ?')->execute([$session['sessionId']]);
    return [
        'id' => (int) $session['id'],
        'username' => (string) $session['username'],
        'role' => (string) ($session['role'] ?? ''),
    ];
}

// Confirma a sessão ativa e devolve o usuário logado (consumido pelos plugins).
function handle_check_session(PDO $pdo, array $user): never
{
    $stmt = $pdo->prepare('SELECT fullName, email FROM system_users WHERE id = ? LIMIT 1');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch() ?: [];
    respond([
        'ok' => true,
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'name' => (string) (($row['fullName'] ?? '') !== '' ? $row['fullName'] : $user['username']),
            'email' => (string) ($row['email'] ?? ''),
            'role' => $user['role'],
        ],
    ]);
}

function handle_logout(PDO $pdo): never
{
    $token = bearer_token();
    if ($token !== '') {
        ensure_api_sessions_table($pdo);
        $pdo->prepare('DELETE FROM api_sessions WHERE tokenHash = ?')->execute([hash('sha256', $token)]);
    }
    respond(['ok' => true]);
}

function action_for_method(string $method): string
{
    return match (strtoupper($method)) {
        'GET', 'HEAD' => 'view',
        'POST' => 'create',
        'PUT', 'PATCH' => 'edit',
        'DELETE' => 'delete',
        default => 'edit',
    };
}

// Sub-recursos herdam a permissão do módulo principal correspondente do frontend.
function permission_module_key(string $key): string
{
    return [
        'agendaEvents' => 'agenda',
        'kanbanBoards' => 'kanban',
        'kanbanColumns' => 'kanban',
        'kanbanCards' => 'kanban',
        'proposalItems' => 'proposals',
        'proposalFiles' => 'proposals',
        'proposalStatusHistory' => 'proposals',
        'proposalBudgetLinks' => 'proposals',
        'proposalVariables' => 'proposals',
        'workBudgetItems' => 'workBudgets',
        'sinapiCompositionItems' => 'sinapiCompositions',
        'checklistItems' => 'checklists',
        'customFieldValues' => 'customFields',
    ][$key] ?? $key;
}

function require_admin(?array $user): void
{
    if (!$user || ($user['role'] ?? '') !== 'admin') {
        fail('Apenas administradores podem executar esta operação.', 403);
    }
}

function authorize_request(PDO $pdo, ?array $user, string $module, string $action): void
{
    if (!$user) {
        fail('Não autenticado. Faça login para acessar a API.', 401);
    }
    if (!role_can($pdo, (string) ($user['role'] ?? ''), permission_module_key($module), $action)) {
        fail('Permissão negada para este módulo.', 403);
    }
}

function role_can(PDO $pdo, string $role, string $module, string $action): bool
{
    if ($role === 'admin') {
        return true;
    }
    if ($role === '') {
        return false;
    }
    $column = ['view' => 'canView', 'create' => 'canCreate', 'edit' => 'canEdit', 'delete' => 'canDelete'][$action] ?? 'canEdit';
    try {
        $stmt = $pdo->prepare("SELECT `{$column}` AS allowed FROM role_permissions WHERE `role` = ? AND module = ? AND status = 'Ativo' LIMIT 1");
        $stmt->execute([$role, $module]);
        $row = $stmt->fetch();
        if ($row) {
            return in_array((string) $row['allowed'], ['Sim', '1', 'true'], true);
        }
    } catch (PDOException $error) {
        // Tabela ausente em instalações antigas: usa os padrões abaixo.
    }
    if ($role === 'gerente') {
        return !in_array($module, ['users', 'permissions'], true);
    }
    if ($action === 'view') {
        $allowed = default_role_view_modules()[$role] ?? [];
        return $allowed === '*' || in_array($module, (array) $allowed, true);
    }
    $allowed = default_role_edit_modules()[$role] ?? [];
    return $allowed === '*' || in_array($module, (array) $allowed, true);
}

// Espelha roleModules do app.js (visualização por perfil quando não há linha em role_permissions).
function default_role_view_modules(): array
{
    return [
        'financeiro' => ['dashboard', 'clients', 'suppliers', 'categories', 'costCenters', 'bankAccounts', 'projects', 'projectSchedule', 'agenda', 'kanban', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'sinapiSettings', 'ownCompositions', 'quotes', 'abcCurve', 'viabilityAnalyses', 'fiscalDocuments', 'receivable', 'payable', 'cashMoves', 'cashFlow', 'reconciliation', 'proposals', 'sales', 'chartAccounts', 'journalEntries', 'dre', 'taxDocuments', 'taxes', 'reports', 'reportFinancial', 'reportClient', 'reportSupplier', 'reportCostCenter', 'reportProject', 'exports', 'systemVersion', 'plugins'],
        'comercial' => ['dashboard', 'clients', 'projects', 'projectSchedule', 'agenda', 'kanban', 'workBudgets', 'abcCurve', 'viabilityAnalyses', 'budgets', 'proposals', 'proposalModels', 'proposalAreas', 'proposalActionTypes', 'proposalServiceSubtypes', 'sales', 'reportClient', 'systemVersion', 'plugins'],
        'engenharia' => ['dashboard', 'projects', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'projectNotifications', 'projectTrackingLinks', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'ownCompositions', 'quotes', 'abcCurve', 'viabilityAnalyses', 'purchaseOrders', 'technicalReports', 'projectReport', 'proposals', 'reportProject', 'systemVersion', 'plugins'],
        'gestor_obra' => ['dashboard', 'projects', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'projectNotifications', 'projectTrackingLinks', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'ownCompositions', 'quotes', 'abcCurve', 'viabilityAnalyses', 'purchaseOrders', 'technicalReports', 'projectReport', 'proposals', 'reportProject', 'systemVersion', 'plugins'],
        'equipe_campo' => ['dashboard', 'projectReport', 'systemVersion', 'plugins'],
        'cliente_obra' => ['dashboard', 'projectReport', 'projectSchedule', 'technicalReports', 'systemVersion', 'plugins'],
        'fornecedor_terceiro' => ['dashboard', 'systemVersion', 'plugins'],
        'consulta' => ['dashboard', 'projectReport', 'cashFlow', 'dre', 'reports', 'reportFinancial', 'reportClient', 'reportSupplier', 'reportCostCenter', 'reportProject', 'exports', 'plugins'],
        'operador' => ['dashboard', 'clients', 'suppliers', 'products', 'services', 'categories', 'costCenters', 'bankAccounts', 'projects', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'ownCompositions', 'quotes', 'abcCurve', 'fiscalDocuments', 'receivable', 'payable', 'cashMoves', 'cashFlow', 'reconciliation', 'budgets', 'proposals', 'sales', 'purchaseOrders', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'projectReport', 'reports', 'reportFinancial', 'reportClient', 'reportSupplier', 'reportCostCenter', 'reportProject', 'myProfile', 'plugins'],
        'visualizador' => '*',
    ];
}

// Espelha editableByRole de canEditModule() do app.js (mutação por perfil sem linha em role_permissions).
function default_role_edit_modules(): array
{
    return [
        'financeiro' => ['fiscalDocuments', 'receivable', 'payable', 'cashMoves', 'cashFlow', 'reconciliation', 'categories', 'costCenters', 'bankAccounts', 'chartAccounts', 'journalEntries', 'taxDocuments', 'taxes', 'exports', 'projectSchedule', 'agenda', 'kanban', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'sinapiSettings', 'quotes', 'sales', 'viabilityAnalyses'],
        'comercial' => ['clients', 'budgets', 'proposals', 'agenda', 'kanban', 'viabilityAnalyses'],
        'engenharia' => ['projects', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'projectNotifications', 'projectTrackingLinks', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'ownCompositions', 'quotes', 'purchaseOrders', 'technicalReports'],
        'gestor_obra' => ['projects', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'projectNotifications', 'projectTrackingLinks', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'ownCompositions', 'quotes', 'purchaseOrders', 'technicalReports'],
        'operador' => ['clients', 'suppliers', 'products', 'services', 'categories', 'costCenters', 'bankAccounts', 'projects', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'ownCompositions', 'quotes', 'fiscalDocuments', 'receivable', 'payable', 'cashMoves', 'reconciliation', 'budgets', 'proposals', 'sales', 'purchaseOrders', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban'],
    ];
}

function handle_login(PDO $pdo, array $payload): never
{
    $username = trim((string) ($payload['username'] ?? ''));
    $password = (string) ($payload['password'] ?? '');
    if ($username === '' || $password === '') {
        fail('Usuário e senha são obrigatórios.', 400);
    }
    $stmt = $pdo->prepare("SELECT * FROM system_users WHERE username = ? AND status = 'Ativo' LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    if (!$user) {
        fail('Usuário ou senha inválidos.', 401);
    }
    if (!empty($user['blocked'])) {
        fail('Usuário bloqueado. Fale com o administrador.', 403);
    }
    $stored = (string) ($user['password'] ?? '');
    $valid = password_verify($password, $stored) || hash_equals($stored, $password);
    if (!$valid) {
        fail('Usuário ou senha inválidos.', 401);
    }
    if (hash_equals($stored, $password)) {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $update = $pdo->prepare('UPDATE system_users SET password = ? WHERE id = ?');
        $update->execute([$hash, $user['id']]);
    }
    unset($user['password']);
    $user['mustChangePassword'] = !empty($user['mustChangePassword']);
    // A flag mustChangePassword só é zerada pela troca efetiva de senha: o admin pode
    // definir uma senha temporária forte e ainda exigir a troca no primeiro acesso.

    ensure_api_sessions_table($pdo);
    $pdo->prepare('DELETE FROM api_sessions WHERE lastActivity < (NOW() - INTERVAL ' . AUTH_IDLE_SECONDS . ' SECOND)')->execute();
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    try {
        // Datas com NOW() explícito: não depende de DEFAULT nas colunas — tabelas
        // antigas sem default gravavam data zero e a sessão era descartada na hora.
        $pdo->prepare('INSERT INTO api_sessions (userId, tokenHash, createdAt, lastActivity) VALUES (?, ?, NOW(), NOW())')
            ->execute([$user['id'], $tokenHash]);
    } catch (PDOException $error) {
        error_log('[ObraSync] Falha no INSERT da sessão de login: ' . $error->getMessage());
        fail('Não foi possível criar a sessão de acesso. Contate o administrador.', 500);
    }
    // Confirma que a sessão foi gravada antes de devolver o token ao navegador.
    $check = $pdo->prepare('SELECT id FROM api_sessions WHERE tokenHash = ? LIMIT 1');
    $check->execute([$tokenHash]);
    if (!$check->fetchColumn()) {
        error_log('[ObraSync] INSERT da sessão de login não deu erro, mas a linha não foi encontrada.');
        fail('Não foi possível registrar a sessão de acesso. Contate o administrador.', 500);
    }

    respond(['ok' => true, 'user' => $user, 'token' => $token, 'idleTimeoutMs' => AUTH_IDLE_SECONDS * 1000]);
}

// ── Força e redefinição de senha ─────────────────────────────────────────────

function validate_password_strength(string $pw): ?string
{
    if (mb_strlen($pw) < 8)          return 'A senha deve ter pelo menos 8 caracteres.';
    if (!preg_match('/[A-Z]/', $pw)) return 'A senha deve conter pelo menos uma letra maiúscula.';
    if (!preg_match('/[a-z]/', $pw)) return 'A senha deve conter pelo menos uma letra minúscula.';
    if (!preg_match('/[0-9]/', $pw)) return 'A senha deve conter pelo menos um número.';
    if (!preg_match('/[\W_]/',  $pw)) return 'A senha deve conter pelo menos um caractere especial (!@#$%^&*).';
    return null;
}

function ensure_password_reset_table(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            userId    BIGINT UNSIGNED NOT NULL,
            tokenHash CHAR(64)        NOT NULL,
            expiresAt TIMESTAMP       NOT NULL,
            usedAt    TIMESTAMP       NULL DEFAULT NULL,
            createdAt TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_prt_token (tokenHash),
            KEY        idx_prt_user  (userId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $done = true;
}

function reset_url(array $config, string $token): string
{
    $base = rtrim((string) ($config['mail']['app_url'] ?? 'https://schimanskiengenharia.com.br/financeiro'), '/');
    return $base . '/#reset=' . urlencode($token);
}

function handle_request_password_reset(PDO $pdo, array $config, array $payload): never
{
    $email = trim((string) ($payload['email'] ?? ''));
    if ($email === '') {
        fail('Informe o e-mail cadastrado.', 400);
    }
    $stmt = $pdo->prepare(
        "SELECT id, username, email FROM system_users
          WHERE email = ? AND status = 'Ativo' AND blocked = 0
          LIMIT 1"
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        fail('E-mail não cadastrado. Verifique ou contate o administrador.', 404);
    }

    ensure_password_reset_table($pdo);
    $pdo->prepare('DELETE FROM password_reset_tokens WHERE userId = ?')->execute([$user['id']]);
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('INSERT INTO password_reset_tokens (userId, tokenHash, expiresAt) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR))')
        ->execute([$user['id'], hash('sha256', $token)]);
    $sent = send_reset_email($config, (string) $user['email'], (string) $user['username'], $token);
    if (!$sent && !empty($config['mail']['log_reset_url'])) {
        error_log('[ObraSync] Reset URL para ' . $user['username'] . ': ' . reset_url($config, $token));
    }

    respond(['ok' => true, 'message' => 'Link de redefinição enviado para o e-mail cadastrado.']);
}

function handle_reset_password(PDO $pdo, array $payload): never
{
    $token       = trim((string) ($payload['token'] ?? ''));
    $newPassword = (string) ($payload['newPassword'] ?? '');
    if ($token === '') {
        fail('Token de redefinição inválido.', 400);
    }
    $pwErr = validate_password_strength($newPassword);
    if ($pwErr) {
        fail($pwErr, 400);
    }
    ensure_password_reset_table($pdo);
    // Expiração avaliada pelo relógio do próprio MySQL (mesmo clock que gravou
    // expiresAt via DATE_ADD(NOW(), ...)): imune a diferenças de fuso com o PHP.
    $stmt = $pdo->prepare('SELECT id, userId, usedAt, (expiresAt < NOW()) AS expired FROM password_reset_tokens WHERE tokenHash = ? LIMIT 1');
    $stmt->execute([hash('sha256', $token)]);
    $row = $stmt->fetch();
    if (!$row || $row['usedAt'] !== null) {
        fail('Token inválido ou já utilizado. Solicite uma nova redefinição.', 400);
    }
    if (!empty($row['expired'])) {
        $pdo->prepare('DELETE FROM password_reset_tokens WHERE id = ?')->execute([$row['id']]);
        fail('Token expirado. Solicite uma nova redefinição de senha.', 400);
    }
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE system_users SET password = ?, mustChangePassword = 0 WHERE id = ?')
        ->execute([$hash, $row['userId']]);
    $pdo->prepare('UPDATE password_reset_tokens SET usedAt = NOW() WHERE id = ?')
        ->execute([$row['id']]);
    respond(['ok' => true, 'message' => 'Senha redefinida com sucesso. Faça login.']);
}

function handle_change_password(PDO $pdo, array $user, array $payload): never
{
    $currentPassword = (string) ($payload['currentPassword'] ?? '');
    $newPassword     = (string) ($payload['newPassword'] ?? '');
    if ($currentPassword === '') {
        fail('Informe a senha atual.', 400);
    }
    $stmt = $pdo->prepare('SELECT password FROM system_users WHERE id = ? LIMIT 1');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    if (!$row) {
        fail('Usuário não encontrado.', 404);
    }
    // A senha atual precisa estar correta antes de qualquer outra validação.
    $stored = (string) ($row['password'] ?? '');
    if (!password_verify($currentPassword, $stored) && !hash_equals($stored, $currentPassword)) {
        fail('Senha atual incorreta.', 400);
    }
    $pwErr = validate_password_strength($newPassword);
    if ($pwErr) {
        fail($pwErr, 400);
    }
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE system_users SET password = ?, mustChangePassword = 0 WHERE id = ?')
        ->execute([$hash, $user['id']]);
    respond(['ok' => true, 'message' => 'Senha alterada com sucesso.']);
}

// Endpoint para troca obrigatória de senha sem depender do header Authorization.
// Autentica pelo token de sessão enviado no corpo JSON (_token) ou pelos headers e,
// se a sessão não for localizada (header removido por Apache/PHP-CGI, sessão purgada),
// recai na identificação por usuário — a senha atual conferida abaixo prova a
// identidade com a mesma garantia do login, eliminando o erro "Sessão inválida".
function handle_forced_change_password(PDO $pdo, array $payload): never
{
    $token = trim((string) ($payload['_token'] ?? ''));
    if ($token === '') {
        $token = bearer_token();
    }
    $username        = trim((string) ($payload['username'] ?? ''));
    $currentPassword = (string) ($payload['currentPassword'] ?? '');
    $newPassword     = (string) ($payload['newPassword'] ?? '');

    if ($currentPassword === '') {
        fail('Informe a senha atual.', 400);
    }

    ensure_api_sessions_table($pdo);
    $user = null;
    if ($token !== '') {
        $stmt = $pdo->prepare(
            'SELECT u.id, u.username, u.password, u.status, u.blocked
               FROM api_sessions s
               JOIN system_users u ON u.id = s.userId
              WHERE s.tokenHash = ?
              LIMIT 1'
        );
        $stmt->execute([hash('sha256', $token)]);
        $user = $stmt->fetch() ?: null;
    }
    if (!$user && $username !== '') {
        $stmt = $pdo->prepare('SELECT id, username, password, status, blocked FROM system_users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch() ?: null;
    }
    if (!$user) {
        fail('Sessão inválida. Faça login novamente.', 401);
    }
    if (($user['status'] ?? '') !== 'Ativo' || !empty($user['blocked'])) {
        fail('Usuário inativo ou bloqueado.', 403);
    }

    // A senha atual precisa estar correta antes de qualquer outra validação.
    $stored = (string) ($user['password'] ?? '');
    if (!password_verify($currentPassword, $stored) && !hash_equals($stored, $currentPassword)) {
        fail('Senha atual incorreta.', 400);
    }

    $pwErr = validate_password_strength($newPassword);
    if ($pwErr) {
        fail($pwErr, 400);
    }

    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE system_users SET password = ?, mustChangePassword = 0 WHERE id = ?')
        ->execute([$hash, (int) $user['id']]);
    // Encerra todas as sessões do usuário: força novo login com a senha recém-definida.
    $pdo->prepare('DELETE FROM api_sessions WHERE userId = ?')->execute([(int) $user['id']]);
    respond(['ok' => true, 'message' => 'Senha atualizada com sucesso.']);
}


function send_reset_email(array $config, string $email, string $username, string $token): bool
{
    if ($email === '') {
        return false;
    }
    $mail     = $config['mail'] ?? [];
    $from     = (string) ($mail['from_email'] ?? 'noreply@schimanskiengenharia.com.br');
    $fromName = (string) ($mail['from_name'] ?? 'ObraSync');
    $url      = reset_url($config, $token);
    $subject  = 'Redefinição de senha — ObraSync';
    $safeUser = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
    $safeUrl  = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
    $text     = "Olá, {$username}!\n\nRecebemos uma solicitação de redefinição de senha para sua conta no ObraSync.\n\nClique no link abaixo (válido por 2 horas):\n{$url}\n\nSe não foi você, ignore este e-mail.";
    $html     = "<p>Olá, <strong>{$safeUser}</strong>!</p>"
              . "<p>Recebemos uma solicitação de redefinição de senha para sua conta no <strong>ObraSync</strong>.</p>"
              . "<p><a href=\"{$safeUrl}\" style=\"background:#185FA5;color:#fff;padding:10px 20px;border-radius:5px;text-decoration:none\">Redefinir minha senha</a></p>"
              . "<p style=\"color:#666;font-size:13px\">Link válido por 2 horas. Se não foi você, ignore este e-mail.</p>";

    $smtpHost = (string) ($mail['smtp_host'] ?? '');
    if ($smtpHost !== '') {
        return smtp_send_mail($mail, $from, $fromName, $email, $subject, $html, $text);
    }
    $headers = "From: {$fromName} <{$from}>\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8";
    return (bool) @mail($email, $subject, $html, $headers);
}

function smtp_send_mail(array $mail, string $from, string $fromName, string $to, string $subject, string $html, string $text): bool
{
    $host = (string) ($mail['smtp_host'] ?? '');
    $port = (int) ($mail['smtp_port'] ?? 587);
    $user = (string) ($mail['smtp_user'] ?? '');
    $pass = (string) ($mail['smtp_pass'] ?? '');
    $tls  = !empty($mail['smtp_tls']);

    $prefix  = ($port === 465) ? 'ssl://' : '';
    $context = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false]]);
    $fp      = @stream_socket_client("{$prefix}{$host}:{$port}", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
    if (!$fp) {
        return false;
    }
    stream_set_timeout($fp, 10);

    $read = static function () use ($fp): string {
        $buf = '';
        while ($line = fgets($fp, 512)) {
            $buf .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $buf;
    };
    $cmd = static function (string $c) use ($fp, $read): string {
        fwrite($fp, $c . "\r\n");
        return $read();
    };
    $ok = static function (string $resp, int $code): bool {
        return strncmp(ltrim($resp), (string) $code, 3) === 0;
    };

    if (!$ok($read(), 220)) {
        fclose($fp);
        return false;
    }
    $localhost = (string) (gethostname() ?: 'localhost');
    if (!$ok($cmd("EHLO {$localhost}"), 250)) {
        fclose($fp);
        return false;
    }
    if ($tls && $port !== 465) {
        if (!$ok($cmd('STARTTLS'), 220)) {
            fclose($fp);
            return false;
        }
        stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $cmd("EHLO {$localhost}");
    }
    if ($user !== '') {
        $cmd('AUTH LOGIN');
        $cmd(base64_encode($user));
        if (!$ok($cmd(base64_encode($pass)), 235)) {
            fclose($fp);
            return false;
        }
    }
    $cmd("MAIL FROM:<{$from}>");
    $cmd("RCPT TO:<{$to}>");
    $cmd('DATA');

    $boundary = bin2hex(random_bytes(8));
    $message  = "From: {$fromName} <{$from}>\r\n"
              . "To: <{$to}>\r\n"
              . "Subject: {$subject}\r\n"
              . "MIME-Version: 1.0\r\n"
              . "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n\r\n"
              . "--{$boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{$text}\r\n"
              . "--{$boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n{$html}\r\n"
              . "--{$boundary}--\r\n.\r\n";
    fwrite($fp, $message);
    $sent = $ok($read(), 250);
    $cmd('QUIT');
    fclose($fp);
    return $sent;
}

function save_fiscal_document(PDO $pdo, array $meta, array $config, ?int $id = null): array
{
    $payload = $_POST;
    $data = clean_payload($meta, $payload);
    unset($data['pdfPath'], $data['xmlPath']);

    if (empty($data['projectId']) || empty($data['documentNumber']) || empty($data['issueDate'])) {
        fail('Obra/projeto, número da nota e data de emissão são obrigatórios.', 400);
    }

    $uploadDir = rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/') . '/notas-fiscais';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0750, true);
    }

    if (!empty($_FILES['pdfFile']['tmp_name'])) {
        $data['pdfPath'] = store_upload($_FILES['pdfFile'], $uploadDir, ['pdf'], ['application/pdf']);
    }
    if (!empty($_FILES['xmlFile']['tmp_name'])) {
        $data['xmlPath'] = store_upload($_FILES['xmlFile'], $uploadDir, ['xml'], ['text/xml', 'application/xml', 'application/octet-stream']);
    }

    if ($id) {
        $existing = raw_record($pdo, $meta, $id);
        if (empty($data['pdfPath']) && !empty($existing['pdfPath'])) $data['pdfPath'] = $existing['pdfPath'];
        if (empty($data['xmlPath']) && !empty($existing['xmlPath'])) $data['xmlPath'] = $existing['xmlPath'];
        return update_record($pdo, $meta, $id, $data);
    }
    return create_record($pdo, $meta, $data);
}

function store_upload(array $file, string $dir, array $extensions, array $mimes): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        fail('Falha ao receber arquivo.', 400);
    }
    $original = $file['name'] ?? 'arquivo';
    $extension = strtolower(pathinfo($original, PATHINFO_EXTENSION));
    if (!in_array($extension, $extensions, true)) {
        fail('Tipo de arquivo não permitido.', 400);
    }
    $mime = mime_content_type($file['tmp_name']) ?: '';
    if ($mimes && !in_array($mime, $mimes, true)) {
        fail('Conteúdo do arquivo não corresponde ao tipo permitido.', 400);
    }
    $safeName = date('Ymd-His') . '-' . bin2hex(random_bytes(8)) . '.' . $extension;
    $target = rtrim($dir, '/') . '/' . $safeName;
    if (!move_uploaded_file($file['tmp_name'], $target)) {
        fail('Não foi possível salvar o arquivo.', 500);
    }
    chmod($target, 0640);
    return $target;
}

function handle_fiscal_download(PDO $pdo, int $id, string $kind): never
{
    $field = $kind === 'pdf' ? 'pdfPath' : ($kind === 'xml' ? 'xmlPath' : null);
    if (!$field) {
        fail('Arquivo inválido.', 404);
    }
    $stmt = $pdo->prepare("SELECT `$field`, documentNumber FROM fiscal_documents WHERE id = ?");
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if (!$record || empty($record[$field]) || !is_file($record[$field])) {
        fail('Arquivo não encontrado.', 404);
    }
    $path = $record[$field];
    header_remove('Content-Type');
    header('Content-Type: ' . ($kind === 'pdf' ? 'application/pdf' : 'application/xml'));
    header('Content-Disposition: inline; filename="' . basename($record['documentNumber'] . '.' . $kind) . '"');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

function handle_safe_file_upload(array $config, string $subdir, array $extensions, array $mimes): never
{
    if (empty($_FILES['file']['tmp_name'])) {
        fail('Arquivo não informado.', 400);
    }
    $uploadDir = rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/') . '/' . $subdir;
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0750, true);
    }
    $path = store_upload($_FILES['file'], $uploadDir, $extensions, $mimes);
    respond(['ok' => true, 'file' => $path]);
}

function handle_sinapi_import(PDO $pdo, array $resources, array $config): never
{
    if (empty($_FILES['file']['tmp_name'])) {
        fail('Arquivo SINAPI não informado.', 400);
    }
    $mode = ($_POST['mode'] ?? 'preview') === 'confirm' ? 'confirm' : 'preview';
    $fileType = (string) ($_POST['fileType'] ?? 'reference');
    $sheetName = trim((string) ($_POST['sheetName'] ?? ''));
    $uf = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', (string) ($_POST['uf'] ?? 'MS')), 0, 2)) ?: 'MS';
    $referenceMonth = max(1, min(12, (int) ($_POST['referenceMonth'] ?? 4)));
    $referenceYear = (int) ($_POST['referenceYear'] ?? 2026);
    $defaultReferenceType = (string) ($_POST['referenceType'] ?? 'Sem desoneração');

    $uploadDir = rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/') . '/sinapi';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0750, true);
    }
    $path = store_upload($_FILES['file'], $uploadDir, ['csv','txt','xlsx'], ['text/plain','text/csv','application/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','application/octet-stream']);
    $parsed = parse_sinapi_file($path, $fileType, $sheetName, $uf, $referenceMonth, $referenceYear, $defaultReferenceType);
    $summary = [];
    $samples = [];
    foreach ($parsed as $entry) {
        $key = $entry['resource'];
        $summary[$key] ??= ['total' => 0, 'created' => 0, 'updated' => 0, 'skipped' => 0];
        $summary[$key]['total']++;
        if (count($samples) < 8) {
            $samples[] = ['resource' => $key, 'data' => array_slice($entry['data'], 0, 8, true)];
        }
    }

    if ($mode === 'confirm') {
        $pdo->beginTransaction();
        try {
            foreach ($parsed as $entry) {
                $key = $entry['resource'];
                $priceType = $entry['priceType'] ?? $defaultReferenceType;
                $referenceId = ensure_sinapi_reference($pdo, $resources['sinapiReferences'], $uf, $referenceMonth, $referenceYear, $priceType, $entry['referenceType'] ?? $defaultReferenceType);
                $data = $entry['data'];
                if (in_array('sinapiReferenceId', $resources[$key]['fields'], true)) {
                    $data['sinapiReferenceId'] = $referenceId;
                }
                if ($key === 'sinapiCompositionItems' && empty($data['sinapiCompositionId']) && !empty($data['compositionCode'])) {
                    $data['sinapiCompositionId'] = find_sinapi_composition_id($pdo, $referenceId, (string) $data['compositionCode']);
                }
                $result = upsert_resource_record($pdo, $resources[$key], $data, $key);
                $summary[$key][$result]++;
            }
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }

    respond(['ok' => true, 'mode' => $mode, 'file' => $path, 'summary' => $summary, 'samples' => $samples]);
}

// Campos de upload aceitos pela importação em background e as abas que identificam
// cada planilha oficial do CEF (validação antes de aceitar o arquivo).
function sinapi_job_file_types(): array
{
    return [
        'referenceFile' => ['fileType' => 'reference', 'label' => 'Referência', 'sheets' => ['ISD', 'ICD', 'ISE', 'CSD', 'CCD', 'CSE']],
        'familiesFile' => ['fileType' => 'families', 'label' => 'Famílias e coeficientes', 'sheets' => ['Coeficientes']],
        'laborFile' => ['fileType' => 'labor', 'label' => 'Mão de obra', 'sheets' => ['SEM Desoneração', 'COM Desoneração']],
        'maintenanceFile' => ['fileType' => 'maintenance', 'label' => 'Manutenções', 'sheets' => ['Manutenções', 'Manutenção']],
    ];
}

function ensure_sinapi_import_jobs_table(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS sinapi_import_jobs (
            id VARCHAR(60) PRIMARY KEY,
            status VARCHAR(12) NOT NULL DEFAULT 'queued',
            currentStep VARCHAR(200) NOT NULL DEFAULT '',
            progress INT NOT NULL DEFAULT 0,
            total INT NOT NULL DEFAULT 0,
            uf VARCHAR(2) NOT NULL DEFAULT 'MS',
            referenceMonth INT NOT NULL DEFAULT 0,
            referenceYear INT NOT NULL DEFAULT 0,
            referenceType VARCHAR(40) NOT NULL DEFAULT '',
            paramsJson TEXT NULL,
            summaryJson TEXT NULL,
            errorMessage TEXT NULL,
            createdByUserId BIGINT UNSIGNED NULL,
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            finishedAt TIMESTAMP NULL DEFAULT NULL,
            KEY idx_sinapi_job_status (status),
            KEY idx_sinapi_job_created (createdAt)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $done = true;
}

function handle_sinapi_import_async(PDO $pdo, array $config, array $authUser): never
{
    set_time_limit(0); // só nesta action: uploads somados chegam a ~17 MB
    ensure_sinapi_import_jobs_table($pdo);

    // POST acima de post_max_size chega com $_POST e $_FILES vazios, sem erro
    // explícito do PHP — sem este aviso o usuário veria uma mensagem enganosa.
    if (empty($_FILES) && empty($_POST) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        fail(sprintf(
            'Upload excedeu o limite do PHP (post_max_size = %s). Confira o api/.user.ini no servidor ou envie os arquivos em importações separadas.',
            (string) ini_get('post_max_size')
        ), 413);
    }

    $uf = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', (string) ($_POST['uf'] ?? 'MS')), 0, 2)) ?: 'MS';
    $referenceMonth = max(1, min(12, (int) ($_POST['referenceMonth'] ?? date('n'))));
    $referenceYear = (int) ($_POST['referenceYear'] ?? date('Y'));
    $referenceType = (string) ($_POST['referenceType'] ?? 'Sem desoneração');

    expire_stale_sinapi_jobs($pdo);
    $running = $pdo->query("SELECT id FROM sinapi_import_jobs WHERE status IN ('queued','running') LIMIT 1")->fetchColumn();
    if ($running) {
        fail('Já existe uma importação SINAPI em andamento. Aguarde a conclusão antes de iniciar outra.', 409);
    }

    $uploadDir = rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/') . '/sinapi';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0750, true);
    }

    $files = [];
    foreach (sinapi_job_file_types() as $field => $info) {
        if (empty($_FILES[$field]['tmp_name'])) {
            continue;
        }
        $path = store_upload($_FILES[$field], $uploadDir, ['xlsx'], ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream']);
        $issue = sinapi_workbook_issue($path, $info['sheets']);
        if ($issue !== null) {
            @unlink($path);
            fail("Arquivo de {$info['label']} não parece ser a planilha SINAPI esperada ({$issue}).", 400);
        }
        $files[$field] = $path;
    }
    if (!$files) {
        fail('Envie ao menos um dos arquivos SINAPI (Referência, Famílias, Mão de Obra ou Manutenções).', 400);
    }

    $jobId = uniqid('sinapi_', true);
    $pdo->prepare('INSERT INTO sinapi_import_jobs (id, status, currentStep, uf, referenceMonth, referenceYear, referenceType, paramsJson, createdByUserId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            $jobId,
            'queued',
            'Aguardando o processamento em background',
            $uf,
            $referenceMonth,
            $referenceYear,
            $referenceType,
            json_encode(['files' => $files], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            (int) ($authUser['id'] ?? 0) ?: null,
        ]);

    // Logs do worker fora da pasta pública, ao lado de uploads/ e backups/.
    $logDir = dirname(rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/')) . '/sinapi_jobs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0750, true);
    }
    $worker = dirname(__DIR__) . '/scripts/sinapi_import_worker.php';
    if (!is_file($worker)) {
        fail('Worker não encontrado em scripts/sinapi_import_worker.php — confira o deploy.', 500);
    }
    // PHP_BINARY em CGI/FPM aponta para o binário do SAPI web; o worker precisa do CLI.
    $php = PHP_BINDIR . '/php';
    if (!is_file($php)) {
        $php = trim((string) shell_exec('command -v php 2>/dev/null')) ?: 'php';
    }
    $logFile = $logDir . '/' . preg_replace('/[^A-Za-z0-9_.-]/', '', $jobId) . '.log';
    exec(sprintf(
        '%s %s --job %s >> %s 2>&1 &',
        escapeshellarg($php),
        escapeshellarg($worker),
        escapeshellarg($jobId),
        escapeshellarg($logFile)
    ));

    respond(['ok' => true, 'jobId' => $jobId], 201);
}

// Jobs abandonados não podem bloquear novas importações nem deixar o polling do
// frontend girando para sempre: um "queued" que o worker nunca pegou (ex.: exec
// falhou) expira em 10 min; um "running" sem heartbeat (updatedAt) há mais de
// 2 horas é considerado morto.
function expire_stale_sinapi_jobs(PDO $pdo): void
{
    $pdo->exec(
        "UPDATE sinapi_import_jobs
            SET status = 'error',
                errorMessage = 'Job abandonado: o worker não iniciou ou parou de responder. Confira o log em /var/lib/financeiro/sinapi_jobs/.',
                finishedAt = NOW()
          WHERE (status = 'queued' AND updatedAt < DATE_SUB(NOW(), INTERVAL 10 MINUTE))
             OR (status = 'running' AND updatedAt < DATE_SUB(NOW(), INTERVAL 2 HOUR))"
    );
}

function handle_sinapi_import_status(PDO $pdo): never
{
    ensure_sinapi_import_jobs_table($pdo);
    expire_stale_sinapi_jobs($pdo);
    $jobId = trim((string) ($_GET['job'] ?? ''));
    if ($jobId !== '') {
        $stmt = $pdo->prepare('SELECT * FROM sinapi_import_jobs WHERE id = ? LIMIT 1');
        $stmt->execute([$jobId]);
    } else {
        $stmt = $pdo->query('SELECT * FROM sinapi_import_jobs ORDER BY createdAt DESC, id DESC LIMIT 1');
    }
    $job = $stmt->fetch();
    if (!$job) {
        respond(['ok' => true, 'job' => null]);
    }
    $job['summary'] = !empty($job['summaryJson']) ? json_decode((string) $job['summaryJson'], true) : null;
    unset($job['paramsJson'], $job['summaryJson']);
    respond(['ok' => true, 'job' => $job]);
}

// Confere se o XLSX contém ao menos uma das abas esperadas da planilha SINAPI,
// sem carregar os dados (lê só o xl/workbook.xml de dentro do zip).
function sinapi_workbook_issue(string $path, array $expectedSheets): ?string
{
    if (!class_exists('ZipArchive')) {
        return null; // sem php-zip a validação fica a cargo do worker
    }
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        return 'não foi possível abrir o XLSX';
    }
    $workbookXml = (string) $zip->getFromName('xl/workbook.xml');
    $zip->close();
    if ($workbookXml === '') {
        return 'arquivo sem planilhas — xl/workbook.xml ausente';
    }
    $names = [];
    if (preg_match_all('/<sheet[^>]*name="([^"]*)"/u', $workbookXml, $matches)) {
        $names = array_map(static fn ($name) => html_entity_decode($name, ENT_QUOTES | ENT_XML1, 'UTF-8'), $matches[1]);
    }
    foreach ($expectedSheets as $expected) {
        foreach ($names as $name) {
            if (str_contains(upper_text(trim($name)), upper_text($expected))) {
                return null;
            }
        }
    }
    return 'abas encontradas: ' . (implode(', ', array_slice($names, 0, 8)) ?: 'nenhuma') . '; esperava ' . implode(' / ', $expectedSheets);
}

function parse_sinapi_file(string $path, string $fileType, string $sheetName, string $uf, int $month, int $year, string $defaultReferenceType): array
{
    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if (in_array($extension, ['csv', 'txt'], true)) {
        if ($sheetName === '') {
            fail('Para CSV, informe qual aba foi exportada do Excel.', 400);
        }
        $sheets = [$sheetName => read_csv_matrix($path)];
    } else {
        $sheets = read_xlsx_sheets($path);
    }

    $records = [];
    if ($fileType === 'reference') {
        foreach (['ISD','ICD','ISE'] as $name) {
            if (isset($sheets[$name])) {
                $records = array_merge($records, parse_sinapi_inputs_sheet($sheets[$name], $name, $uf));
            }
        }
        foreach (['CSD','CCD','CSE'] as $name) {
            if (isset($sheets[$name])) {
                $records = array_merge($records, parse_sinapi_compositions_sheet($sheets[$name], $name, $uf));
            }
        }
        if (isset($sheets['Analítico'])) {
            $records = array_merge($records, parse_sinapi_analytic_sheet($sheets['Analítico'], $defaultReferenceType));
        }
        return $records;
    }
    if ($fileType === 'labor') {
        foreach ($sheets as $name => $rows) {
            if (stripos($name, 'Desoneração') !== false || stripos($name, 'Desoneracao') !== false) {
                $records = array_merge($records, parse_sinapi_labor_sheet($rows, $name, $uf));
            }
        }
        return $records;
    }
    if ($fileType === 'families') {
        foreach ($sheets as $name => $rows) {
            if (stripos($name, 'Coef') !== false || count($sheets) === 1) {
                $records = array_merge($records, parse_sinapi_families_sheet($rows, $uf, $defaultReferenceType));
            }
        }
        return $records;
    }
    foreach ($sheets as $name => $rows) {
        if (stripos($name, 'Manuten') !== false || count($sheets) === 1) {
            $records = array_merge($records, parse_sinapi_maintenances_sheet($rows, $defaultReferenceType));
        }
    }
    return $records;
}

function parse_sinapi_inputs_sheet(array $rows, string $sheet, string $uf): array
{
    $header = find_header_row($rows, ['Código do Insumo', 'Descrição do Insumo']);
    if ($header === null) return [];
    $headers = $rows[$header];
    $ufIndex = find_column_index($headers, $uf);
    if ($ufIndex === null) return [];
    $records = [];
    for ($i = $header + 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        $code = cell_at($row, 1);
        $description = cell_at($row, 2);
        if ($code === '' || $description === '') continue;
        $records[] = sinapi_entry('sinapiInputs', reference_price_type($sheet), $sheet, [
            'referenceType' => $sheet,
            'uf' => $uf,
            'classification' => cell_at($row, 0),
            'code' => $code,
            'description' => $description,
            'unit' => cell_at($row, 3),
            'priceOrigin' => cell_at($row, 4),
            'unitPrice' => decimal_value(cell_at($row, $ufIndex)),
            'origin' => 'SINAPI/CAIXA',
            'category' => cell_at($row, 0),
            'status' => 'Ativo',
        ]);
    }
    return $records;
}

function parse_sinapi_compositions_sheet(array $rows, string $sheet, string $uf): array
{
    $header = find_header_row($rows, ['Código da Composição', 'Custo']);
    if ($header === null) return [];
    $ufRow = $rows[$header - 1] ?? [];
    $ufIndex = find_column_index($ufRow, $uf);
    if ($ufIndex === null) return [];
    $records = [];
    for ($i = $header + 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        $code = cell_at($row, 1);
        $description = cell_at($row, 2);
        if ($code === '' || $description === '') continue;
        $records[] = sinapi_entry('sinapiCompositions', reference_price_type($sheet), $sheet, [
            'referenceType' => $sheet,
            'uf' => $uf,
            'groupName' => cell_at($row, 0),
            'code' => $code,
            'description' => $description,
            'unit' => cell_at($row, 3),
            'unitCost' => decimal_value(cell_at($row, $ufIndex)),
            'percentAS' => decimal_value(cell_at($row, $ufIndex + 1)),
            'type' => 'Composição',
            'className' => '',
            'status' => 'Ativo',
        ]);
    }
    return $records;
}

function parse_sinapi_analytic_sheet(array $rows, string $defaultReferenceType): array
{
    $header = find_header_row($rows, ['Código da Composição', 'Tipo Item', 'Coeficiente']);
    if ($header === null) return [];
    $records = [];
    for ($i = $header + 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        $itemType = cell_at($row, 2);
        $itemCode = cell_at($row, 3);
        if ($itemType === '' || $itemCode === '') continue;
        $records[] = sinapi_entry('sinapiCompositionItems', $defaultReferenceType, 'Analítico', [
            'compositionCode' => cell_at($row, 1),
            'itemType' => normalize_sinapi_item_type($itemType),
            'itemCode' => $itemCode,
            'itemDescription' => cell_at($row, 4),
            'unit' => cell_at($row, 5),
            'coefficient' => decimal_value(cell_at($row, 6)),
            'situation' => cell_at($row, 7),
            'unitPrice' => 0,
            'totalCost' => 0,
        ]);
    }
    return $records;
}

function parse_sinapi_labor_sheet(array $rows, string $sheet, string $uf): array
{
    $header = find_header_row($rows, ['Código da Composição', 'Descrição']);
    if ($header === null) return [];
    $ufIndex = find_column_index($rows[$header], $uf);
    if ($ufIndex === null) return [];
    $records = [];
    $priceType = reference_price_type($sheet);
    for ($i = $header + 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        $code = cell_at($row, 1);
        if ($code === '' || cell_at($row, 2) === '') continue;
        $records[] = sinapi_entry('sinapiLabor', $priceType, $sheet, [
            'referenceType' => stripos($sheet, 'COM') !== false ? 'com_desoneracao' : 'sem_desoneracao',
            'uf' => $uf,
            'groupName' => cell_at($row, 0),
            'compositionCode' => $code,
            'description' => cell_at($row, 2),
            'unit' => cell_at($row, 3),
            'laborPercent' => decimal_value(cell_at($row, $ufIndex)),
        ]);
    }
    return $records;
}

function parse_sinapi_families_sheet(array $rows, string $uf, string $defaultReferenceType): array
{
    $header = find_header_row($rows, ['Código da Família', 'Código do Insumo']);
    if ($header === null) return [];
    $ufIndex = find_column_index($rows[$header], $uf);
    if ($ufIndex === null) return [];
    $records = [];
    for ($i = $header + 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        if (cell_at($row, 0) === '' || cell_at($row, 1) === '') continue;
        $records[] = sinapi_entry('sinapiFamilies', $defaultReferenceType, 'Coeficientes', [
            'familyCode' => cell_at($row, 0),
            'inputCode' => cell_at($row, 1),
            'inputDescription' => cell_at($row, 2),
            'unit' => cell_at($row, 3),
            'category' => cell_at($row, 4),
            'uf' => $uf,
            'coefficient' => decimal_value(cell_at($row, $ufIndex)),
        ]);
    }
    return $records;
}

function parse_sinapi_maintenances_sheet(array $rows, string $defaultReferenceType): array
{
    $header = find_header_row($rows, ['Referência', 'Manutenção']);
    if ($header === null) return [];
    $records = [];
    for ($i = $header + 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        if (cell_at($row, 2) === '' || cell_at($row, 3) === '') continue;
        $records[] = sinapi_entry('sinapiMaintenances', $defaultReferenceType, 'Manutenções', [
            'referenceCode' => cell_at($row, 0),
            'itemType' => cell_at($row, 1),
            'code' => cell_at($row, 2),
            'description' => cell_at($row, 3),
            'maintenanceType' => cell_at($row, 4),
        ]);
    }
    return $records;
}

function sinapi_entry(string $resource, string $priceType, string $referenceType, array $data): array
{
    return ['resource' => $resource, 'priceType' => $priceType, 'referenceType' => $referenceType, 'data' => $data];
}

function read_csv_matrix(string $path): array
{
    $rows = [];
    $handle = fopen($path, 'rb');
    if (!$handle) return $rows;
    $first = fgets($handle) ?: '';
    $delimiter = substr_count($first, ';') >= substr_count($first, ',') ? ';' : ',';
    rewind($handle);
    while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
        $rows[] = array_map(fn ($value) => trim((string) $value), $row);
    }
    fclose($handle);
    return $rows;
}

function read_xlsx_sheets(string $path): array
{
    if (!class_exists('ZipArchive')) {
        fail('O servidor PHP não possui ZipArchive/php-zip. Instale php-zip ou exporte a aba do Excel para CSV.', 400);
    }
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        fail('Não foi possível abrir o arquivo XLSX.', 400);
    }
    $shared = xlsx_shared_strings($zip);
    $workbook = simplexml_load_string((string) $zip->getFromName('xl/workbook.xml'));
    $workbook->registerXPathNamespace('a', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
    $workbook->registerXPathNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships');
    $rels = simplexml_load_string((string) $zip->getFromName('xl/_rels/workbook.xml.rels'));
    $rels->registerXPathNamespace('rel', 'http://schemas.openxmlformats.org/package/2006/relationships');
    $relationMap = [];
    foreach ($rels->xpath('//rel:Relationship') as $rel) {
        $relationMap[(string) $rel['Id']] = (string) $rel['Target'];
    }
    $sheets = [];
    foreach ($workbook->xpath('//a:sheet') as $sheet) {
        $name = (string) $sheet['name'];
        $rid = (string) $sheet->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['id'];
        $target = $relationMap[$rid] ?? '';
        $sheetPath = str_starts_with($target, 'xl/') ? $target : 'xl/' . ltrim($target, '/');
        $xml = simplexml_load_string((string) $zip->getFromName($sheetPath));
        $xml->registerXPathNamespace('a', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $rows = [];
        foreach ($xml->xpath('//a:sheetData/a:row') as $rowNode) {
            $values = [];
            foreach ($rowNode->c as $cell) {
                $ref = (string) $cell['r'];
                $index = xlsx_column_index($ref);
                while (count($values) <= $index) {
                    $values[] = '';
                }
                $values[$index] = xlsx_cell_value($cell, $shared);
            }
            if (array_filter($values, fn ($value) => $value !== '')) {
                $rows[] = $values;
            }
        }
        $sheets[$name] = $rows;
    }
    $zip->close();
    return $sheets;
}

function xlsx_shared_strings($zip): array
{
    $xmlText = $zip->getFromName('xl/sharedStrings.xml');
    if ($xmlText === false) return [];
    $xml = simplexml_load_string((string) $xmlText);
    $xml->registerXPathNamespace('a', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
    $strings = [];
    foreach ($xml->xpath('//a:si') as $si) {
        $text = '';
        foreach ($si->xpath('.//a:t') as $t) {
            $text .= (string) $t;
        }
        $strings[] = trim($text);
    }
    return $strings;
}

function xlsx_cell_value($cell, array $shared): string
{
    $formula = isset($cell->f) ? (string) $cell->f : '';
    $value = isset($cell->v) ? (string) $cell->v : '';
    $type = (string) $cell['t'];
    if ($type === 's' && $value !== '') {
        $value = $shared[(int) $value] ?? '';
    } elseif ($type === 'inlineStr') {
        $parts = [];
        foreach ($cell->xpath('.//a:t') ?: [] as $text) {
            $parts[] = (string) $text;
        }
        $value = implode('', $parts);
    }
    if ($formula && ($value === '' || $value === '0') && preg_match('/,\s*([0-9]{3,})\s*\)\s*$/', $formula, $match)) {
        $value = $match[1];
    }
    return trim(str_replace(["\r", "\n"], ' ', $value));
}

function xlsx_column_index(string $cellRef): int
{
    preg_match('/^([A-Z]+)/', $cellRef, $match);
    $letters = $match[1] ?? 'A';
    $index = 0;
    foreach (str_split($letters) as $char) {
        $index = $index * 26 + ord($char) - 64;
    }
    return $index - 1;
}

function find_header_row(array $rows, array $needles): ?int
{
    foreach ($rows as $index => $row) {
        $line = lower_text(implode(' | ', $row));
        $ok = true;
        foreach ($needles as $needle) {
            if (!str_contains($line, lower_text($needle))) {
                $ok = false;
                break;
            }
        }
        if ($ok) return $index;
    }
    return null;
}

function find_column_index(array $row, string $name): ?int
{
    foreach ($row as $index => $value) {
        if (upper_text(trim((string) $value)) === upper_text($name)) {
            return $index;
        }
    }
    return null;
}

function cell_at(array $row, int $index): string
{
    return trim((string) ($row[$index] ?? ''));
}

function decimal_value(string $value): float
{
    $clean = trim(str_replace(['R$', ' ', "\xc2\xa0"], '', $value));
    if ($clean === '' || $clean === '-') return 0.0;
    if (str_contains($clean, ',') && str_contains($clean, '.')) {
        $clean = str_replace('.', '', $clean);
    }
    $clean = str_replace(',', '.', $clean);
    return is_numeric($clean) ? (float) $clean : 0.0;
}

function reference_price_type(string $value): string
{
    $text = lower_text($value);
    if (str_contains($text, 'icd') || str_contains($text, 'ccd') || str_contains($text, 'com des')) return 'Com desoneração';
    if (str_contains($text, 'ise') || str_contains($text, 'cse') || str_contains($text, 'sem encarg')) return 'Sem encargos sociais';
    return 'Sem desoneração';
}

function normalize_sinapi_item_type(string $value): string
{
    return str_contains(lower_text($value), 'compos') ? 'Composição auxiliar' : 'Insumo';
}

function lower_text(string $value): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
}

function upper_text(string $value): string
{
    return function_exists('mb_strtoupper') ? mb_strtoupper($value, 'UTF-8') : strtoupper($value);
}

function ensure_sinapi_reference(PDO $pdo, array $meta, string $uf, int $month, int $year, string $priceType, string $referenceType): int
{
    $stmt = $pdo->prepare('SELECT id FROM sinapi_referencias WHERE uf = ? AND referenceMonth = ? AND referenceYear = ? AND priceType = ? LIMIT 1');
    $stmt->execute([$uf, $month, $year, $priceType]);
    $id = $stmt->fetchColumn();
    if ($id) return (int) $id;
    $record = create_record($pdo, $meta, [
        'uf' => $uf,
        'referenceMonth' => $month,
        'referenceYear' => $year,
        'priceType' => $priceType,
        'source' => 'SINAPI/CAIXA',
        'defaultUf' => $uf,
        'locationName' => $uf === 'MS' ? 'Campo Grande/MS' : $uf,
        'issueDate' => '2026-05-12',
        'availableTypes' => 'Sem desoneração; Com desoneração; Sem encargos sociais',
        'importDate' => date('Y-m-d'),
        'status' => 'Ativo',
    ]);
    return (int) $record['id'];
}

function find_sinapi_composition_id(PDO $pdo, int $referenceId, string $code): ?int
{
    if ($code === '') return null;
    $stmt = $pdo->prepare('SELECT id FROM sinapi_composicoes WHERE sinapiReferenceId = ? AND code = ? LIMIT 1');
    $stmt->execute([$referenceId, $code]);
    $id = $stmt->fetchColumn();
    return $id ? (int) $id : null;
}

function upsert_resource_record(PDO $pdo, array $meta, array $data, string $key): string
{
    $data = filter_data_by_columns($pdo, $meta, clean_payload($meta, $data));
    if (!$data) return 'skipped';
    $id = find_existing_by_unique_fields($pdo, $meta, $data, $key);
    if ($id) {
        update_record($pdo, $meta, $id, $data);
        return 'updated';
    }
    create_record($pdo, $meta, $data);
    return 'created';
}

function find_existing_by_unique_fields(PDO $pdo, array $meta, array $data, string $key): ?int
{
    $unique = $meta['unique'];
    if ($key === 'sinapiCompositionItems' && empty($data['sinapiCompositionId'])) {
        $unique = ['sinapiReferenceId', 'compositionCode', 'itemCode'];
    }
    $where = [];
    $params = [];
    foreach ($unique as $field) {
        if (!array_key_exists($field, $data) || $data[$field] === null || $data[$field] === '') {
            return null;
        }
        $where[] = "`$field` = ?";
        $params[] = $data[$field];
    }
    $stmt = $pdo->prepare('SELECT id FROM `' . $meta['table'] . '` WHERE ' . implode(' AND ', $where) . ' LIMIT 1');
    $stmt->execute($params);
    $id = $stmt->fetchColumn();
    return $id ? (int) $id : null;
}

function raw_record(PDO $pdo, array $meta, int $id): array
{
    $stmt = $pdo->prepare('SELECT * FROM `' . $meta['table'] . '` WHERE id = ?');
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if (!$record) {
        fail('Registro não encontrado.', 404);
    }
    return $record;
}

function status_changed_to(array $before, array $after, array $targetStatuses): bool
{
    $previous = normalized_status((string) ($before['status'] ?? ''));
    $current = normalized_status((string) ($after['status'] ?? ''));
    if ($previous === $current) return false;
    $targets = array_map('normalized_status', $targetStatuses);
    return in_array($current, $targets, true);
}

function normalized_status(string $status): string
{
    $status = strtr($status, ['í' => 'i', 'Í' => 'i', 'ã' => 'a', 'Ã' => 'a', 'ç' => 'c', 'Ç' => 'c']);
    return strtolower(trim($status));
}

function automate_approved_milestone(PDO $pdo, int $milestoneId): array
{
    $milestoneTable = resolve_existing_table($pdo, ['obra_cronograma_marcos']);
    $receivableTable = resolve_existing_table($pdo, ['accounts_receivable']);
    $projectTable = resolve_existing_table($pdo, ['obras', 'projects']);
    $receivableColumns = table_columns($pdo, $receivableTable);
    $refTypeColumn = pick_column($receivableColumns, ['referencia_tipo', 'referenceType', 'reference_type']);
    $refIdColumn = pick_column($receivableColumns, ['referencia_id', 'referenceId', 'reference_id']);
    if (!$refTypeColumn || !$refIdColumn) {
        throw new RuntimeException('accounts_receivable sem colunas de referencia.');
    }
    $existing = find_by_reference($pdo, $receivableTable, $refTypeColumn, $refIdColumn, 'MARCO', $milestoneId);
    if ($existing) {
        update_dynamic($pdo, $milestoneTable, $milestoneId, [
            'conta_receber_id' => (int) $existing['id'],
            'receivableId' => (int) $existing['id'],
            'receivable_id' => (int) $existing['id'],
        ]);
        log_automation_event($pdo, 'MARCO_APROVADO', 'MARCO', $milestoneId, 'CONTA_RECEBER', (int) $existing['id'], 'PARCIAL', 'Conta a receber ja existia para este marco.', null);
        return ['created' => false, 'receivableId' => (int) $existing['id'], 'message' => 'Conta a receber ja existia para este marco.'];
    }
    $milestone = fetch_table_record($pdo, $milestoneTable, $milestoneId);
    $projectId = value_from($milestone, ['obra_id', 'projectId', 'project_id']);
    if (!$projectId) {
        throw new RuntimeException('Marco sem obra vinculada.');
    }
    $project = fetch_table_record($pdo, $projectTable, (int) $projectId);
    $percent = (float) (value_from($milestone, ['percentual', 'percentual_financeiro', 'plannedFinancialPercent', 'plannedPhysicalPercent', 'defaultPhysicalPercent']) ?? 0);
    if ($percent <= 0 && ($stepId = value_from($milestone, ['scheduleStepId', 'schedule_step_id', 'etapa_id']))) {
        $stepTable = resolve_existing_table($pdo, ['obra_cronograma_etapas'], false);
        if ($stepTable) {
            $step = fetch_table_record($pdo, $stepTable, (int) $stepId, false);
            $percent = (float) (value_from($step, ['percentual', 'plannedFinancialPercent', 'plannedPhysicalPercent', 'actualPhysicalPercent']) ?? 0);
        }
    }
    $contractValue = (float) (value_from($project, ['valor_contrato', 'revenueContracted', 'budgetForecast', 'valor_total']) ?? 0);
    $amount = round($contractValue * ($percent / 100), 2);
    $paymentDays = (int) (value_from($project, ['prazo_pagamento', 'paymentDeadlineDays', 'paymentTermDays']) ?? 30);
    if ($paymentDays <= 0) $paymentDays = 30;
    $clientId = value_from($project, ['cliente_id', 'clientId', 'client_id']);
    $costCenterId = value_from($project, ['centro_custo_id', 'costCenterId', 'cost_center_id']);
    $description = 'Medicao: ' . (value_from($milestone, ['nome', 'name', 'milestoneName']) ?? 'Marco da obra');
    $dueDate = date_add_days(date('Y-m-d'), $paymentDays);
    $receivableId = insert_dynamic($pdo, $receivableTable, [
        'obra_id' => $projectId,
        'projectId' => $projectId,
        'project_id' => $projectId,
        'cliente_id' => $clientId,
        'clientId' => $clientId,
        'client_id' => $clientId,
        'descricao' => $description,
        'description' => $description,
        'document' => 'MARCO-' . $milestoneId,
        'data_emissao' => date('Y-m-d'),
        'issueDate' => date('Y-m-d'),
        'issue_date' => date('Y-m-d'),
        'data_vencimento' => $dueDate,
        'dueDate' => $dueDate,
        'due_date' => $dueDate,
        'valor' => $amount,
        'amount' => $amount,
        'status' => open_status_for_table($pdo, $receivableTable),
        'centro_custo_id' => $costCenterId,
        'costCenterId' => $costCenterId,
        'cost_center_id' => $costCenterId,
        'referencia_tipo' => 'MARCO',
        'referenceType' => 'MARCO',
        'reference_type' => 'MARCO',
        'referencia_id' => $milestoneId,
        'referenceId' => $milestoneId,
        'reference_id' => $milestoneId,
    ]);
    update_dynamic($pdo, $milestoneTable, $milestoneId, [
        'conta_receber_id' => $receivableId,
        'receivableId' => $receivableId,
        'receivable_id' => $receivableId,
    ]);
    $agendaId = create_milestone_billing_event($pdo, $milestone, $project, $milestoneId, $dueDate);
    log_automation_event($pdo, 'MARCO_APROVADO', 'MARCO', $milestoneId, 'CONTA_RECEBER', $receivableId, 'SUCESSO', null, null);
    return ['created' => true, 'receivableId' => $receivableId, 'agendaEventId' => $agendaId];
}

function automate_approved_purchase_order(PDO $pdo, int $orderId): array
{
    $orderTable = resolve_existing_table($pdo, ['purchase_orders']);
    $payableTable = resolve_existing_table($pdo, ['accounts_payable']);
    $projectTable = resolve_existing_table($pdo, ['obras', 'projects'], false);
    $payableColumns = table_columns($pdo, $payableTable);
    $refTypeColumn = pick_column($payableColumns, ['referencia_tipo', 'referenceType', 'reference_type']);
    $refIdColumn = pick_column($payableColumns, ['referencia_id', 'referenceId', 'reference_id']);
    if (!$refTypeColumn || !$refIdColumn) {
        throw new RuntimeException('accounts_payable sem colunas de referencia.');
    }
    $existing = find_by_reference($pdo, $payableTable, $refTypeColumn, $refIdColumn, 'PEDIDO_COMPRA', $orderId);
    if ($existing) {
        update_dynamic($pdo, $orderTable, $orderId, [
            'conta_pagar_id' => (int) $existing['id'],
            'payableId' => (int) $existing['id'],
            'payable_id' => (int) $existing['id'],
        ]);
        log_automation_event($pdo, 'PEDIDO_APROVADO', 'PEDIDO_COMPRA', $orderId, 'CONTA_PAGAR', (int) $existing['id'], 'PARCIAL', 'Conta a pagar ja existia para este pedido.', null);
        return ['created' => false, 'payableId' => (int) $existing['id'], 'message' => 'Conta a pagar ja existia para este pedido.'];
    }
    $order = fetch_table_record($pdo, $orderTable, $orderId);
    $projectId = value_from($order, ['obra_id', 'projectId', 'project_id']);
    $project = ($projectTable && $projectId) ? fetch_table_record($pdo, $projectTable, (int) $projectId, false) : [];
    $paymentDays = (int) (value_from($order, ['prazo_pagamento', 'paymentDeadlineDays', 'paymentTermDays']) ?? 30);
    if ($paymentDays <= 0) $paymentDays = 30;
    $baseDate = value_from($order, ['data_entrega_prevista', 'expectedDate', 'expected_date']) ?: date('Y-m-d');
    $dueDate = date_add_days((string) $baseDate, $paymentDays);
    $supplierId = value_from($order, ['fornecedor_id', 'supplierId', 'supplier_id']);
    $costCenterId = value_from($order, ['centro_custo_id', 'costCenterId', 'cost_center_id']) ?: value_from($project, ['centro_custo_id', 'costCenterId', 'cost_center_id']);
    $description = 'Compra: ' . (value_from($order, ['descricao', 'description', 'notes', 'number']) ?? 'Pedido de compra');
    $amount = (float) (value_from($order, ['valor_total', 'amount', 'totalAmount', 'valor']) ?? 0);
    $payableId = insert_dynamic($pdo, $payableTable, [
        'obra_id' => $projectId,
        'projectId' => $projectId,
        'project_id' => $projectId,
        'fornecedor_id' => $supplierId,
        'supplierId' => $supplierId,
        'supplier_id' => $supplierId,
        'descricao' => $description,
        'description' => $description,
        'document' => value_from($order, ['number', 'numero']) ?: 'PC-' . $orderId,
        'data_emissao' => date('Y-m-d'),
        'issueDate' => date('Y-m-d'),
        'issue_date' => date('Y-m-d'),
        'data_vencimento' => $dueDate,
        'dueDate' => $dueDate,
        'due_date' => $dueDate,
        'valor' => $amount,
        'amount' => $amount,
        'status' => open_status_for_table($pdo, $payableTable),
        'centro_custo_id' => $costCenterId,
        'costCenterId' => $costCenterId,
        'cost_center_id' => $costCenterId,
        'referencia_tipo' => 'PEDIDO_COMPRA',
        'referenceType' => 'PEDIDO_COMPRA',
        'reference_type' => 'PEDIDO_COMPRA',
        'referencia_id' => $orderId,
        'referenceId' => $orderId,
        'reference_id' => $orderId,
    ]);
    update_dynamic($pdo, $orderTable, $orderId, [
        'conta_pagar_id' => $payableId,
        'payableId' => $payableId,
        'payable_id' => $payableId,
    ]);
    $cardId = create_purchase_order_kanban_card($pdo, $orderId);
    log_automation_event($pdo, 'PEDIDO_APROVADO', 'PEDIDO_COMPRA', $orderId, 'CONTA_PAGAR', $payableId, 'SUCESSO', null, null);
    return ['created' => true, 'payableId' => $payableId, 'kanbanCardId' => $cardId];
}

function ensure_project_kanban_boards(PDO $pdo, int $projectId, string $projectName): array
{
    if (!resolve_existing_table($pdo, ['kanban_boards'], false)) return [];
    $created = [];
    $created['obra'] = ensure_kanban_board($pdo, $projectId, 'Kanban - ' . mb_substr($projectName, 0, 80), 'obra');
    $created['compras'] = ensure_kanban_board($pdo, $projectId, 'Compras - ' . mb_substr($projectName, 0, 78), 'compras');
    return $created;
}

function ensure_kanban_board(PDO $pdo, ?int $projectId, string $name, string $type): int
{
    $boardTable = resolve_existing_table($pdo, ['kanban_boards']);
    $columnsTable = resolve_existing_table($pdo, ['kanban_colunas']);
    if ($projectId) {
        $stmt = $pdo->prepare('SELECT id FROM kanban_boards WHERE obra_id = ? AND tipo = ? LIMIT 1');
        $stmt->execute([$projectId, $type]);
    } else {
        $stmt = $pdo->prepare('SELECT id FROM kanban_boards WHERE obra_id IS NULL AND tipo = ? LIMIT 1');
        $stmt->execute([$type]);
    }
    $boardId = (int) ($stmt->fetchColumn() ?: 0);
    if (!$boardId) {
        $boardId = insert_dynamic($pdo, $boardTable, [
            'obra_id' => $projectId,
            'nome' => $name,
            'tipo' => $type,
        ]);
    }
    ensure_kanban_default_columns($pdo, $columnsTable, $boardId);
    return $boardId;
}

function ensure_kanban_default_columns(PDO $pdo, string $columnsTable, int $boardId): void
{
    $defaults = [
        ['A fazer', 10, '#185FA5'],
        ['Em andamento', 20, '#B8872D'],
        ['Aguardando aprovação', 30, '#7C3AED'],
        ['Concluído', 40, '#147A47'],
    ];
    foreach ($defaults as [$name, $order, $color]) {
        $stmt = $pdo->prepare('SELECT id FROM kanban_colunas WHERE board_id = ? AND nome = ? LIMIT 1');
        $stmt->execute([$boardId, $name]);
        if ($stmt->fetchColumn()) continue;
        insert_dynamic($pdo, $columnsTable, [
            'board_id' => $boardId,
            'nome' => $name,
            'ordem' => $order,
            'cor' => $color,
        ]);
    }
}

function create_purchase_order_kanban_card(PDO $pdo, int $orderId): ?int
{
    if (!resolve_existing_table($pdo, ['kanban_cards'], false)) return null;
    $orderTable = resolve_existing_table($pdo, ['purchase_orders'], false);
    if (!$orderTable) return null;
    $order = fetch_table_record($pdo, $orderTable, $orderId, false);
    if (!$order) return null;
    $existing = find_by_reference($pdo, 'kanban_cards', 'referencia_tipo', 'referencia_id', 'PEDIDO_COMPRA', $orderId);
    if ($existing) return (int) $existing['id'];
    $projectId = value_from($order, ['obra_id', 'projectId', 'project_id']);
    $boardId = ensure_kanban_board($pdo, $projectId ? (int) $projectId : null, $projectId ? 'Compras da obra' : 'Compras gerais', $projectId ? 'compras' : 'geral');
    $columnId = first_kanban_column_id($pdo, $boardId);
    if (!$columnId) return null;
    return insert_dynamic($pdo, 'kanban_cards', [
        'coluna_id' => $columnId,
        'obra_id' => $projectId,
        'titulo' => 'Pedido ' . (value_from($order, ['number', 'numero']) ?: '#' . $orderId),
        'descricao' => value_from($order, ['notes', 'descricao', 'description']) ?: 'Card criado automaticamente a partir do pedido de compra.',
        'data_vencimento' => value_from($order, ['expectedDate', 'expected_date', 'data_entrega_prevista']),
        'prioridade' => 'media',
        'referencia_tipo' => 'PEDIDO_COMPRA',
        'referencia_id' => $orderId,
        'ordem' => time(),
    ]);
}

function first_kanban_column_id(PDO $pdo, int $boardId): ?int
{
    $stmt = $pdo->prepare('SELECT id FROM kanban_colunas WHERE board_id = ? ORDER BY ordem, id LIMIT 1');
    $stmt->execute([$boardId]);
    $id = $stmt->fetchColumn();
    return $id ? (int) $id : null;
}

function create_milestone_billing_event(PDO $pdo, array $milestone, array $project, int $milestoneId, string $dueDate): ?int
{
    if (!resolve_existing_table($pdo, ['agenda_eventos'], false)) return null;
    $stmt = $pdo->prepare('SELECT id FROM agenda_eventos WHERE tipo = ? AND descricao LIKE ? LIMIT 1');
    $stmt->execute(['cobranca', '%MARCO-' . $milestoneId . '%']);
    $existingId = $stmt->fetchColumn();
    if ($existingId) return (int) $existingId;
    $projectId = value_from($milestone, ['obra_id', 'projectId', 'project_id']);
    $clientId = value_from($project, ['cliente_id', 'clientId', 'client_id']);
    $title = 'Cobrança: ' . (value_from($milestone, ['nome', 'name', 'milestoneName']) ?? 'Marco aprovado');
    $event = [
        'obra_id' => $projectId,
        'cliente_id' => $clientId,
        'titulo' => $title,
        'descricao' => 'MARCO-' . $milestoneId . ' - Evento automático de cobrança criado ao aprovar marco.',
        'tipo' => 'cobranca',
        'data_inicio' => $dueDate . ' 09:00:00',
        'data_fim' => $dueDate . ' 10:00:00',
        'dia_todo' => 0,
        'lembrete_minutos' => 1440,
        'status' => 'agendado',
    ];
    $eventId = insert_dynamic($pdo, 'agenda_eventos', $event);
    create_event_day_notification($pdo, array_merge(['id' => $eventId], $event));
    return $eventId;
}

function create_event_day_notification(PDO $pdo, array $event): ?int
{
    // Automação auxiliar executada APÓS o evento já estar salvo: uma falha aqui
    // não pode derrubar a requisição (o usuário receberia erro com o compromisso
    // gravado). Registra no error.log e segue.
    try {
        if (!resolve_existing_table($pdo, ['obra_notificacoes'], false)) return null;
        $projectId = value_from($event, ['obra_id', 'projectId', 'project_id']);
        if (!$projectId) return null;
        $eventId = (int) ($event['id'] ?? 0);
        $existing = find_by_reference($pdo, 'obra_notificacoes', 'generatedLink', 'projectId', 'agenda-evento-' . $eventId, (int) $projectId);
        if ($existing) return (int) $existing['id'];
        return insert_dynamic($pdo, 'obra_notificacoes', [
            'projectId' => $projectId,
            'recipient' => 'Equipe interna',
            'type' => 'WhatsApp manual',
            'message' => 'Evento de agenda hoje: ' . (value_from($event, ['titulo']) ?? 'Evento'),
            'generatedLink' => 'agenda-evento-' . $eventId,
            'status' => 'Preparado',
            'responsibleUserId' => value_from($event, ['usuario_id', 'userId', 'user_id']),
        ]);
    } catch (Throwable $error) {
        error_log('[ObraSync] Automação de notificação da agenda falhou: ' . $error->getMessage());
        return null;
    }
}

function kanban_card_is_done(PDO $pdo, array $card): bool
{
    $columnId = value_from($card, ['coluna_id', 'columnId', 'colunaId']);
    if (!$columnId || !resolve_existing_table($pdo, ['kanban_colunas'], false)) return false;
    $column = fetch_table_record($pdo, 'kanban_colunas', (int) $columnId, false);
    return normalized_status((string) ($column['nome'] ?? '')) === normalized_status('Concluído');
}

function resolve_existing_table(PDO $pdo, array $candidates, bool $required = true): ?string
{
    foreach ($candidates as $table) {
        // SHOW TABLES LIKE ? não aceita placeholder em prepared statements nativos
        // (EMULATE_PREPARES = false): o MariaDB responde 1064 "near '?' at line 1".
        // information_schema é um SELECT comum e aceita o parâmetro normalmente.
        $stmt = $pdo->prepare('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1');
        $stmt->execute([$table]);
        if ($stmt->fetchColumn()) return $table;
    }
    if ($required) {
        throw new RuntimeException('Tabela nao encontrada: ' . implode(', ', $candidates));
    }
    return null;
}

function pick_column(array $columns, array $candidates): ?string
{
    foreach ($candidates as $candidate) {
        if (in_array($candidate, $columns, true)) return $candidate;
    }
    return null;
}

function value_from(array $row, array $candidates): mixed
{
    foreach ($candidates as $candidate) {
        if (array_key_exists($candidate, $row) && $row[$candidate] !== null && $row[$candidate] !== '') {
            return $row[$candidate];
        }
    }
    return null;
}

function fetch_table_record(PDO $pdo, string $table, int $id, bool $required = true): array
{
    $stmt = $pdo->prepare('SELECT * FROM `' . $table . '` WHERE id = ?');
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if (!$record && $required) {
        throw new RuntimeException('Registro nao encontrado em ' . $table . ': ' . $id);
    }
    return $record ?: [];
}

function find_by_reference(PDO $pdo, string $table, string $refTypeColumn, string $refIdColumn, string $type, int $id): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM `' . $table . '` WHERE `' . $refTypeColumn . '` = ? AND `' . $refIdColumn . '` = ? LIMIT 1');
    $stmt->execute([$type, $id]);
    $record = $stmt->fetch();
    return $record ?: null;
}

function insert_dynamic(PDO $pdo, string $table, array $data): int
{
    $columns = table_columns($pdo, $table);
    $data = array_filter($data, fn ($field) => in_array($field, $columns, true), ARRAY_FILTER_USE_KEY);
    if (!$data) {
        throw new RuntimeException('Nenhuma coluna valida para inserir em ' . $table . '.');
    }
    $fields = array_keys($data);
    $sql = 'INSERT INTO `' . $table . '` (`' . implode('`,`', $fields) . '`) VALUES (' . implode(',', array_fill(0, count($fields), '?')) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_values($data));
    return (int) $pdo->lastInsertId();
}

function update_dynamic(PDO $pdo, string $table, int $id, array $data): void
{
    $columns = table_columns($pdo, $table);
    $data = array_filter($data, fn ($field) => in_array($field, $columns, true), ARRAY_FILTER_USE_KEY);
    if (!$data) return;
    $sets = array_map(fn ($field) => "`$field` = ?", array_keys($data));
    $stmt = $pdo->prepare('UPDATE `' . $table . '` SET ' . implode(',', $sets) . ' WHERE id = ?');
    $stmt->execute([...array_values($data), $id]);
}

function open_status_for_table(PDO $pdo, string $table): string
{
    $stmt = $pdo->query('DESCRIBE `' . $table . '`');
    foreach ($stmt->fetchAll() as $column) {
        if (($column['Field'] ?? '') !== 'status') continue;
        $type = (string) ($column['Type'] ?? '');
        if (str_starts_with(strtolower($type), 'enum(')) {
            preg_match_all("/'((?:[^'\\\\]|\\\\.)*)'/", $type, $matches);
            foreach (['aberta', 'Aberta', 'aberto', 'Aberto'] as $candidate) {
                if (in_array($candidate, $matches[1] ?? [], true)) return $candidate;
            }
        }
    }
    return 'Aberto';
}

function date_add_days(string $date, int $days): string
{
    return (new DateTimeImmutable($date))->modify('+' . $days . ' days')->format('Y-m-d');
}

function log_automation_event(PDO $pdo, string $type, ?string $originType, ?int $originId, ?string $generatedType, ?int $generatedId, string $status, ?string $message, ?int $userId): void
{
    try {
        $table = resolve_existing_table($pdo, ['eventos_automacao'], false);
        if (!$table) return;
        insert_dynamic($pdo, $table, [
            'tipo_evento' => $type,
            'entidade_origem_tipo' => $originType,
            'entidade_origem_id' => $originId,
            'entidade_gerada_tipo' => $generatedType,
            'entidade_gerada_id' => $generatedId,
            'status' => $status,
            'mensagem_erro' => $message,
            'usuario_id' => $userId,
        ]);
    } catch (Throwable) {
    }
}

function migrate_payload(PDO $pdo, array $resources, array $payload): array
{
    $summary = [];
    foreach ($resources as $key => $meta) {
        $rows = $payload[$key] ?? null;
        if (!is_array($rows)) {
            continue;
        }
        $summary[$key] = ['created' => 0, 'updated' => 0, 'skipped' => 0];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                $summary[$key]['skipped']++;
                continue;
            }
            $existingId = find_existing_id($pdo, $meta, $row);
            if ($existingId) {
                update_record($pdo, $meta, $existingId, $row);
                $summary[$key]['updated']++;
            } else {
                create_record($pdo, $meta, $row);
                $summary[$key]['created']++;
            }
        }
    }
    return $summary;
}

function find_existing_id(PDO $pdo, array $meta, array $row): ?int
{
    foreach ($meta['unique'] as $field) {
        if (empty($row[$field])) {
            continue;
        }
        $stmt = $pdo->prepare('SELECT id FROM `' . $meta['table'] . '` WHERE `' . $field . '` = ? LIMIT 1');
        $stmt->execute([$row[$field]]);
        $id = $stmt->fetchColumn();
        if ($id) {
            return (int) $id;
        }
    }
    return null;
}

function handle_backup(PDO $pdo, array $resources, array $config, string $method, array $segments): never
{
    $action = $segments[1] ?? 'export';
    if ($method === 'GET' && $action === 'export') {
        $data = bootstrap_data($pdo, $resources);
        $dir = rtrim($config['backup_dir'], '/');
        if (!is_dir($dir)) {
            mkdir($dir, 0750, true);
        }
        $file = $dir . '/backup-' . date('Ymd-His') . '.json';
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        respond(['ok' => true, 'file' => $file, 'data' => $data]);
    }
    if ($method === 'POST' && $action === 'import') {
        respond(['ok' => true, 'imported' => migrate_payload($pdo, $resources, read_json())]);
    }
    fail('Operação de backup inválida.', 400);
}
