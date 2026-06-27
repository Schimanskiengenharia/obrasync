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
// TTL absoluto da sessão: mesmo em uso contínuo, o token expira e exige novo login.
const AUTH_MAX_SESSION_SECONDS = 43200; // 12 h
// Proteção contra força bruta no login (janela deslizante).
const LOGIN_WINDOW_SECONDS = 900;   // 15 min
const LOGIN_MAX_PER_USER = 8;
const LOGIN_MAX_PER_IP = 20;
const RESET_WINDOW_SECONDS = 3600;  // 1 h
const RESET_MAX_PER_IP = 5;
// Recorte das tabelas SINAPI no bootstrap; a base completa é consultada sob demanda.
const SINAPI_BOOTSTRAP_LIMIT = 300;

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

    // Logo da empresa: rota pública (a logo não é sensível e precisa carregar em
    // <img src> de propostas/preview, que não enviam o header de autenticação).
    if (strtolower((string) ($_GET['module'] ?? '')) === 'companysettings'
        && strtolower((string) ($_GET['action'] ?? '')) === 'getlogo') {
        require_method($method, ['GET']);
        handle_company_logo_get($pdo, $config);
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

    // Busca pontual de um cliente por id, usada pelo preenchimento automático de
    // dados do cliente ao montar uma obra/projeto. Ex.: ?module=clients&action=get&id=5
    if (in_array($module, ['clients', 'cliente', 'clientes'], true)) {
        authorize_request($pdo, $authUser, 'clients', action_for_method($method));
        handle_clients_module($pdo, $method, $_GET);
    }

    // Contas a pagar recorrentes e quitação antecipada. Ex.:
    //   POST ?module=payable&action=create_recurrence
    //   POST ?module=payable&action=early_settlement
    //   GET  ?module=payable&action=group&recorrencia_id=...
    if (in_array($module, ['payable', 'accounts_payable', 'contas-pagar'], true)) {
        authorize_request($pdo, $authUser, 'payable', action_for_method($method));
        handle_payable_module($pdo, $method, $_GET, $authUser);
    }

    // Centros de custo via módulo explícito com ações list/get/create/update/delete.
    // O CRUD genérico (/centros-custo) continua funcionando; este endpoint expõe
    // as mesmas operações no padrão ?module=costCenters&action=...
    if (in_array($module, ['costcenters', 'cost_centers', 'centros-custo', 'centros_custo'], true)) {
        authorize_request($pdo, $authUser, 'costCenters', action_for_method($method));
        handle_cost_centers_module($pdo, $method, $_GET, $resources['costCenters'], $authUser);
    }

    // Movimentações de caixa vinculadas a contas a pagar (evita dupla contagem).
    //   POST ?module=cashMoves&action=create  (cria o caixa e baixa a conta a pagar)
    //   POST ?module=cashMoves&action=link    (vincula caixa e conta a pagar já existentes)
    if (in_array($module, ['cashmoves', 'cash_bank_movements', 'movimentacoes-caixa', 'caixa'], true)) {
        authorize_request($pdo, $authUser, 'cashMoves', action_for_method($method));
        handle_cash_moves_module($pdo, $method, $_GET, $authUser);
    }

    // Logo da empresa: upload/remoção (o getLogo público já foi tratado acima).
    if (in_array($module, ['companysettings', 'company_settings', 'dados-empresa'], true)) {
        authorize_request($pdo, $authUser, 'companySettings', 'edit');
        handle_company_settings_module($pdo, $method, $_GET, $config, $authUser);
    }

    // Itens detalhados do pedido de compra (list/create/update/delete/saveBulk).
    if (in_array($module, ['purchaseorderitems', 'purchase_order_items', 'itens-pedido-compra'], true)) {
        authorize_request($pdo, $authUser, 'purchaseOrders', action_for_method($method));
        handle_purchase_order_items_module($pdo, $method, $_GET, $authUser);
    }

    // Execução (realizado vs orçado) dos itens do orçamento de obra.
    if (in_array($module, ['workbudgetexecution', 'execucao-orcamento'], true)) {
        authorize_request($pdo, $authUser, 'workBudgets', action_for_method($method));
        handle_work_budget_execution_module($pdo, $method, $_GET, $authUser);
    }

    // Resumo de execução das obras para o Dashboard (previsto vs realizado).
    if (in_array($module, ['dashboardexecution', 'execucao-dashboard'], true)) {
        authorize_request($pdo, $authUser, 'dashboard', action_for_method($method));
        handle_dashboard_execution_module($pdo, $method, $_GET);
    }

    if ($resource === '' || $resource === 'bootstrap') {
        require_method($method, ['GET']);
        respond(['ok' => true, 'data' => bootstrap_data($pdo, $resources, $authUser)]);
    }

    if ($resource === 'logout') {
        require_method($method, ['POST']);
        server_audit($pdo, $authUser, 'logout', 'sistema');
        handle_logout($pdo);
    }

    // Log de auditoria real (server-side), visível só ao admin.
    if ($resource === 'audit-log') {
        require_method($method, ['GET']);
        require_admin($authUser);
        ensure_audit_log_table($pdo);
        $limit = isset($_GET['limit']) ? max(1, min(2000, (int) $_GET['limit'])) : 500;
        $stmt = $pdo->query('SELECT * FROM audit_log ORDER BY id DESC LIMIT ' . $limit);
        respond(['ok' => true, 'data' => $stmt->fetchAll()]);
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

    // Alterar a base SINAPI (upload e importação, síncrona ou em background) é
    // exclusivo do admin. Os demais perfis apenas consultam preços (sinapiInputs,
    // sinapiCompositions etc.) e o status da última importação.
    if ($resource === 'sinapi-upload') {
        require_method($method, ['POST']);
        require_admin($authUser);
        handle_safe_file_upload($config, 'sinapi', ['csv','txt','xlsx'], ['text/plain','text/csv','application/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','application/octet-stream']);
    }

    if ($resource === 'sinapi-import') {
        require_method($method, ['POST']);
        require_admin($authUser);
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

    // Redispara o worker de um job preso em queued (exec falhou) ou com erro,
    // reaproveitando os arquivos já salvos em uploads/sinapi.
    if ($resource === 'sinapi-reprocess-job') {
        require_method($method, ['POST']);
        require_admin($authUser);
        handle_sinapi_reprocess_job($pdo, $config, read_json(), $authUser);
    }

    if ($resource === 'project-upload') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'projectSchedule', 'edit');
        handle_safe_file_upload($config, 'project', ['xml'], ['text/xml','application/xml','application/octet-stream']);
    }

    // Estudos salvos do plugin de Seletividade: dados privados POR USUÁRIO
    // (todas as queries filtram por userId). A autorização exige apenas VER o
    // módulo de plugins — exigir 'edit' em plugins bloquearia os perfis comuns,
    // e aqui ninguém toca em dados de outros usuários.
    if ($resource === 'seletividade-estudos' || $resource === 'seletividadeEstudos') {
        authorize_request($pdo, $authUser, 'plugins', 'view');
        handle_seletividade_estudos($pdo, $authUser, $method, $id !== null ? (int) $id : null);
    }

    // Importação de extrato OFX (conciliação bancária, multi-banco):
    // preview faz o parse e marca duplicatas por FITID sem gravar nada;
    // import grava as transações selecionadas em cash_bank_movements e
    // registra os FITIDs; history lista as últimas importações.
    if ($resource === 'ofx-preview') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'reconciliation', 'edit');
        handle_ofx_preview($pdo);
    }
    if ($resource === 'ofx-import') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'reconciliation', 'edit');
        handle_ofx_import($pdo, $authUser, read_json());
    }
    if ($resource === 'ofx-conciliar') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'reconciliation', 'edit');
        handle_ofx_conciliar($pdo, $authUser, read_json());
    }
    if ($resource === 'ofx-history') {
        require_method($method, ['GET']);
        authorize_request($pdo, $authUser, 'reconciliation', 'view');
        handle_ofx_history($pdo);
    }

    // Importação de XML NFS-e padrão ABRASF (módulo de notas fiscais):
    // preview lê o XML (NF única ou lote da prefeitura), roteia emitida ×
    // recebida pelo CNPJ do prestador e marca duplicatas; import grava
    // fiscal_documents e cria as contas a receber/pagar correspondentes.
    if ($resource === 'nfse-preview') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'fiscalDocuments', 'edit');
        handle_nfse_preview($pdo, $config);
    }
    if ($resource === 'nfse-cadastrar-entidade' || $resource === 'nfseCadastrarEntidade') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'fiscalDocuments', 'edit');
        handle_nfse_create_entity_quick($pdo, $authUser, read_json());
    }
    if ($resource === 'nfse-import') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'fiscalDocuments', 'edit');
        handle_nfse_import($pdo, $config, $authUser, read_json());
    }

    // Diário de Obra (RDO) e as disciplinas por obra que ele consome. Workflow
    // próprio (1/obra/dia, assinaturas múltiplas, fotos privadas) — actions
    // dedicadas em vez do CRUD genérico.
    if ($resource === 'rdo-list') {
        require_method($method, ['GET']);
        authorize_request($pdo, $authUser, 'rdo', 'view');
        handle_rdo_list($pdo);
    }
    if ($resource === 'rdo-get') {
        require_method($method, ['GET']);
        authorize_request($pdo, $authUser, 'rdo', 'view');
        handle_rdo_get($pdo, (int) ($_GET['id'] ?? 0));
    }
    if ($resource === 'rdo-save') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'rdo', 'edit');
        handle_rdo_save($pdo, $authUser, read_json());
    }
    if ($resource === 'rdo-enviar-assinaturas') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'rdo', 'edit');
        handle_rdo_enviar_assinaturas($pdo, $authUser, read_json());
    }
    if ($resource === 'rdo-assinar') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'rdo', 'edit');
        handle_rdo_assinar($pdo, $authUser, read_json());
    }
    if ($resource === 'rdo-reabrir') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'rdo', 'edit');
        handle_rdo_reabrir($pdo, $authUser, read_json());
    }
    if ($resource === 'rdo-delete') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'rdo', 'delete');
        handle_rdo_delete($pdo, $authUser, (int) (read_json()['id'] ?? 0), $config);
    }
    if ($resource === 'rdo-foto-upload') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'rdo', 'edit');
        handle_rdo_upload_foto($pdo, $config, $authUser);
    }
    if ($resource === 'rdo-foto-delete') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'rdo', 'edit');
        handle_rdo_delete_foto($pdo, $authUser, (int) (read_json()['id'] ?? 0));
    }
    if ($resource === 'rdo-foto') {
        require_method($method, ['GET']);
        authorize_request($pdo, $authUser, 'rdo', 'view');
        handle_rdo_foto_download($pdo, (int) ($_GET['id'] ?? 0));
    }
    if ($resource === 'obra-disciplinas-list') {
        require_method($method, ['GET']);
        authorize_request($pdo, $authUser, 'rdo', 'view');
        handle_obra_disciplinas_list($pdo);
    }
    if ($resource === 'obra-disciplinas-save') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'rdo', 'edit');
        handle_obra_disciplinas_save($pdo, $authUser, read_json());
    }
    if ($resource === 'obra-disciplinas-delete') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'rdo', 'edit');
        handle_obra_disciplinas_delete($pdo, $authUser, (int) (read_json()['id'] ?? 0));
    }

    // Permissões por usuário (override do papel) — só admin gerencia.
    if ($resource === 'user-permissions-get') {
        require_method($method, ['GET']);
        require_admin($authUser);
        handle_user_permissions_get($pdo);
    }
    if ($resource === 'user-permissions-save') {
        require_method($method, ['POST']);
        require_admin($authUser);
        handle_user_permissions_save($pdo, $authUser, read_json());
    }
    if ($resource === 'user-permissions-reset') {
        require_method($method, ['POST']);
        require_admin($authUser);
        handle_user_permissions_reset($pdo, $authUser, read_json());
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
    if (str_starts_with($key, 'qualidade')) {
        ensure_qualidade_tables($pdo);
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

    // Qualidade PBQP-H: validação de integridade do SGQ, numeração automática da
    // NC e automações pós-gravação (NC por FVS/FVM reprovada, PES vigente único).
    if (str_starts_with($key, 'qualidade') && $method === 'POST') {
        $payload = read_json();
        qualidade_validar_payload($pdo, $key, $payload, null, $authUser);
        $record = $key === 'qualidadeNc'
            ? qualidade_criar_nc_registro($pdo, $resources[$key], $payload)
            : create_record($pdo, $resources[$key], $payload);
        try {
            $record = qualidade_pos_gravacao($pdo, $key, $record, null) ?? $record;
        } catch (Throwable $error) {
            error_log('[ObraSync] Automação de qualidade (create) falhou: ' . $error->getMessage());
        }
        server_audit($pdo, $authUser, 'create', $key, $record['id'] ?? null, (string) ($record['numero'] ?? ''));
        respond(['ok' => true, 'record' => $record], 201);
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
        server_audit($pdo, $authUser, 'create', $key, $record['id'] ?? null);
        respond(['ok' => true, 'record' => $record], 201);
    }

    if (!$id) {
        fail('Informe o id do registro.', 400);
    }

    // Etapa de serviço controlado PBQP-H: conclusão exige FVS aprovada e NCs fechadas.
    if ($key === 'projectSchedule' && ($method === 'PUT' || $method === 'PATCH')) {
        ensure_qualidade_tables($pdo);
        $payload = read_json();
        $bloqueio = qualidade_bloqueio_etapa($pdo, (int) $id, normalize_payload_aliases($payload));
        if ($bloqueio !== null) {
            fail($bloqueio, 422);
        }
        $record = update_record($pdo, $resources[$key], (int) $id, $payload);
        server_audit($pdo, $authUser, 'update', $key, $id);
        respond(['ok' => true, 'record' => $record]);
    }

    if (str_starts_with($key, 'qualidade') && ($method === 'PUT' || $method === 'PATCH')) {
        $payload = read_json();
        $previous = raw_record($pdo, $resources[$key], (int) $id);
        qualidade_validar_payload($pdo, $key, $payload, $previous, $authUser);
        $record = update_record($pdo, $resources[$key], (int) $id, $payload);
        try {
            $record = qualidade_pos_gravacao($pdo, $key, $record, $previous) ?? $record;
        } catch (Throwable $error) {
            error_log('[ObraSync] Automação de qualidade (update) falhou: ' . $error->getMessage());
        }
        server_audit($pdo, $authUser, 'update', $key, $id, (string) ($record['numero'] ?? ''));
        respond(['ok' => true, 'record' => $record]);
    }

    if ($key === 'proposals' && ($method === 'PUT' || $method === 'PATCH')) {
        $payload = read_json();
        $newStatus = normalize_payload_aliases($payload)['status'] ?? null;

        // A automação de aprovação (criar obra + orçamento) roda apenas na
        // TRANSIÇÃO para Aprovada: reeditar uma proposta já aprovada (o frontend
        // reenvia o registro inteiro, status incluso) duplicava obra e orçamento.
        $previousProposal = raw_record($pdo, $resources[$key], (int) $id);
        $alreadyApproved = in_array((string) ($previousProposal['status'] ?? ''), ['Aprovada', 'Aprovado'], true);

        if (!in_array($newStatus, ['Aprovada', 'Aprovado'], true) || $alreadyApproved) {
            $record = update_record($pdo, $resources[$key], (int) $id, $payload);
            server_audit($pdo, $authUser, 'update', $key, $id);
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

            server_audit($pdo, $authUser, 'update', $key, $id, 'Proposta aprovada — obra e orçamento gerados');
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
            error_log('[ObraSync API] Aprovação de proposta falhou: ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
            fail('Erro ao aprovar a proposta. As alterações foram desfeitas — tente novamente ou contate o administrador.', 500);
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
        server_audit($pdo, $authUser, 'update', $key, $id);
        respond(['ok' => true, 'record' => $record]);
    }

    if ($method === 'DELETE') {
        delete_record($pdo, $resources[$key], (int) $id);
        server_audit($pdo, $authUser, 'delete', $key, $id);
        respond(['ok' => true]);
    }

    fail('Método não permitido.', 405);
} catch (Throwable $error) {
    // Erros inesperados (PDO etc.) carregam SQL, nomes de tabela e caminhos:
    // o detalhe vai para o error_log; o cliente recebe mensagem genérica.
    error_log('[ObraSync API] ' . $error->getMessage() . ' em ' . $error->getFile() . ':' . $error->getLine());
    fail('Erro interno no servidor. Tente novamente ou contate o administrador.', 500);
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

        if ($action === 'feed') {
            require_method($method, ['GET']);
            agenda_respond(true, agenda_feed($pdo, $query));
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
        error_log('[ObraSync agenda] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
        agenda_respond(false, [], 'Erro interno ao processar a agenda. Tente novamente ou contate o administrador.', 500);
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

// Módulo de consulta de clientes. Hoje expõe a busca por id (action=get),
// usada pelo preenchimento automático ao montar uma obra/projeto. Retorna todos
// os campos do cliente no padrão { success, data, message }.
function handle_clients_module(PDO $pdo, string $method, array $query): never
{
    $action = strtolower(trim((string) ($query['action'] ?? '')));
    if ($action === '' && $method === 'GET') {
        $action = 'get';
    }

    try {
        if ($action === 'get') {
            require_method($method, ['GET']);
            $id = (int) ($query['id'] ?? 0);
            if ($id <= 0) {
                clients_module_respond(false, [], 'Informe o id do cliente.', 400);
            }
            $client = clients_get_by_id($pdo, $id);
            if ($client === null) {
                clients_module_respond(false, [], 'Cliente não encontrado.', 404);
            }
            clients_module_respond(true, $client);
        }

        clients_module_respond(false, [], 'Ação de clientes inválida.', 400);
    } catch (Throwable $e) {
        error_log('[ObraSync clients] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
        clients_module_respond(false, [], 'Erro interno ao buscar o cliente.', 500);
    }
}

function clients_module_respond(bool $success, mixed $data = [], string $message = '', int $status = 200): never
{
    http_response_code($status);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function clients_get_by_id(PDO $pdo, int $id): ?array
{
    $table = resolve_existing_table($pdo, ['clients']);
    $stmt = $pdo->prepare('SELECT * FROM `' . $table . '` WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    return $record ?: null;
}

// ─── Contas a pagar recorrentes + quitação antecipada ───────────────────────
// Teto de segurança para geração de parcelas; recorrência "indeterminada" gera
// um horizonte rolante padrão (não dá para gerar infinitas linhas).
const PAYABLE_RECURRENCE_MAX = 360;
const PAYABLE_RECURRENCE_INDETERMINADO = 24;

function handle_payable_module(PDO $pdo, string $method, array $query, array $authUser): never
{
    $action = strtolower(trim((string) ($query['action'] ?? '')));
    try {
        if ($action === 'create_recurrence') {
            require_method($method, ['POST']);
            payable_respond(true, payable_create_recurrence($pdo, read_json(), $authUser), 'Parcelas geradas com sucesso.', 201);
        }
        if ($action === 'early_settlement') {
            require_method($method, ['POST']);
            payable_respond(true, payable_early_settlement($pdo, read_json(), $authUser), 'Quitação antecipada registrada com sucesso.');
        }
        if ($action === 'update_scope') {
            require_method($method, ['POST']);
            payable_respond(true, payable_update_scope($pdo, read_json(), $authUser), 'Parcelas atualizadas.');
        }
        if ($action === 'cancel_recurrence') {
            require_method($method, ['POST']);
            payable_respond(true, payable_cancel_recurrence($pdo, read_json(), $authUser), 'Recorrência cancelada.');
        }
        if ($action === 'group') {
            require_method($method, ['GET']);
            $rid = trim((string) ($query['recorrencia_id'] ?? ''));
            if ($rid === '') {
                payable_respond(false, [], 'Informe o recorrencia_id.', 400);
            }
            payable_respond(true, payable_group_parcels($pdo, $rid));
        }
        payable_respond(false, [], 'Ação de contas a pagar inválida.', 400);
    } catch (Throwable $e) {
        error_log('[ObraSync payable] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
        payable_respond(false, [], 'Erro interno ao processar contas a pagar. Nada foi gravado.', 500);
    }
}

function payable_respond(bool $success, mixed $data = [], string $message = '', int $status = 200): never
{
    http_response_code($status);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function payable_user_id(array $authUser): ?int
{
    $id = (int) ($authUser['id'] ?? 0);
    return $id > 0 ? $id : null;
}

function payable_uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function payable_period_months(string $tipo): int
{
    return ['mensal' => 1, 'bimestral' => 2, 'trimestral' => 3, 'semestral' => 6, 'anual' => 12][$tipo] ?? 1;
}

// Soma meses preservando o dia do vencimento e clampando ao último dia do mês
// (ex.: vencimento dia 31 cai no dia 28/30 nos meses mais curtos).
function payable_add_months(string $isoDate, int $months): string
{
    $base = new DateTimeImmutable($isoDate);
    $day = (int) $base->format('d');
    $target = $base->modify('first day of this month')->modify('+' . $months . ' months');
    $lastDay = (int) $target->format('t');
    return $target->setDate((int) $target->format('Y'), (int) $target->format('m'), min($day, $lastDay))->format('Y-m-d');
}

function payable_group_parcels(PDO $pdo, string $rid): array
{
    $table = resolve_existing_table($pdo, ['accounts_payable']);
    $stmt = $pdo->prepare('SELECT * FROM `' . $table . '` WHERE recorrencia_id = ? ORDER BY parcela_numero ASC, dueDate ASC, id ASC');
    $stmt->execute([$rid]);
    return $stmt->fetchAll();
}

function payable_create_recurrence(PDO $pdo, array $payload, array $authUser): array
{
    $table = resolve_existing_table($pdo, ['accounts_payable']);
    $tipo = strtolower(trim((string) ($payload['recorrencia_tipo'] ?? 'mensal')));
    if (!in_array($tipo, ['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'], true)) {
        payable_respond(false, [], 'Tipo de recorrência inválido.', 400);
    }
    $descricao = trim((string) ($payload['descricao'] ?? $payload['document'] ?? ''));
    if ($descricao === '') {
        payable_respond(false, [], 'Informe a descrição/nome da conta.', 400);
    }
    $primeiraData = substr(trim((string) ($payload['primeira_data'] ?? $payload['dueDate'] ?? '')), 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $primeiraData)) {
        payable_respond(false, [], 'Data da primeira parcela inválida.', 400);
    }
    $indeterminado = empty($payload['parcelas']) || (int) $payload['parcelas'] <= 0;
    $total = $indeterminado ? PAYABLE_RECURRENCE_INDETERMINADO : min(PAYABLE_RECURRENCE_MAX, (int) $payload['parcelas']);
    $valorPrimeira = round((float) ($payload['valor_primeira'] ?? $payload['amount'] ?? 0), 2);
    $valorDemais = round((float) ($payload['valor_demais'] ?? $valorPrimeira), 2);
    if ($valorPrimeira <= 0 && $valorDemais <= 0) {
        payable_respond(false, [], 'Informe o valor das parcelas.', 400);
    }

    $months = payable_period_months($tipo);
    $rid = payable_uuid();
    $issueDate = substr(trim((string) ($payload['issueDate'] ?? $primeiraData)), 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $issueDate)) {
        $issueDate = $primeiraData;
    }
    $openStatus = open_status_for_table($pdo, $table);

    $created = [];
    $pdo->beginTransaction();
    try {
        for ($i = 1; $i <= $total; $i++) {
            $due = payable_add_months($primeiraData, $months * ($i - 1));
            $amount = $i === 1 ? $valorPrimeira : $valorDemais;
            $label = $indeterminado
                ? ($descricao . ' - Parcela ' . $i)
                : ($descricao . ' - Parcela ' . $i . '/' . $total);
            $created[] = insert_dynamic($pdo, $table, [
                'document' => mb_substr($label, 0, 80),
                'issueDate' => $issueDate,
                'dueDate' => $due,
                'supplierId' => normalize_value($payload['supplierId'] ?? null),
                'projectId' => normalize_value($payload['projectId'] ?? null),
                'categoryId' => normalize_value($payload['categoryId'] ?? null),
                'costCenterId' => normalize_value($payload['costCenterId'] ?? null),
                'bankAccount' => normalize_value($payload['bankAccount'] ?? null),
                'amount' => $amount,
                'status' => $openStatus,
                'recorrencia_id' => $rid,
                'parcela_numero' => $i,
                'parcela_total' => $indeterminado ? null : $total,
                'recorrencia_tipo' => $tipo,
            ]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    log_automation_event($pdo, 'CONTA_RECORRENTE_GERADA', 'accounts_payable', $created[0] ?? null, 'accounts_payable', null, 'OK',
        $descricao . ' — ' . count($created) . ' parcela(s) ' . $tipo . ($indeterminado ? ' (indeterminado)' : ''), payable_user_id($authUser));
    server_audit($pdo, $authUser, 'create', 'payable', $created[0] ?? null, 'Conta recorrente: ' . $descricao . ' (' . count($created) . ' parcelas)');

    return [
        'recorrencia_id' => $rid,
        'parcela_total' => $indeterminado ? null : $total,
        'indeterminado' => $indeterminado,
        'created' => count($created),
        'parcels' => payable_group_parcels($pdo, $rid),
    ];
}

function payable_early_settlement(PDO $pdo, array $payload, array $authUser): array
{
    $table = resolve_existing_table($pdo, ['accounts_payable']);
    $rid = trim((string) ($payload['recorrencia_id'] ?? ''));
    $ids = array_values(array_filter(array_map('intval', (array) ($payload['parcela_ids'] ?? [])), fn ($v) => $v > 0));
    $ids = array_values(array_unique($ids));
    if ($rid === '' || !$ids) {
        payable_respond(false, [], 'Selecione ao menos uma parcela para quitar.', 400);
    }
    $juros = round(max(0, (float) ($payload['juros'] ?? 0)), 2);
    $desconto = round(max(0, (float) ($payload['desconto'] ?? 0)), 2);
    $bankAccount = trim((string) ($payload['bankAccount'] ?? ''));
    $today = (new DateTimeImmutable('today'))->format('Y-m-d');

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare('SELECT * FROM `' . $table . '` WHERE recorrencia_id = ? AND id IN (' . $placeholders . ')');
    $stmt->execute([$rid, ...$ids]);
    $selected = array_filter($stmt->fetchAll(), fn ($p) => !in_array($p['status'], ['Pago', 'Cancelado'], true));
    if (!$selected) {
        payable_respond(false, [], 'As parcelas selecionadas já estão pagas ou canceladas.', 422);
    }

    $somaOriginal = round(array_sum(array_map(fn ($p) => (float) $p['amount'], $selected)), 2);
    $totalPago = max(0, round($somaOriginal + $juros - $desconto, 2));

    $pdo->beginTransaction();
    try {
        // 1) Baixa as parcelas selecionadas; juros rateado proporcionalmente ao valor.
        $settledIds = [];
        $jurosRestante = $juros;
        $n = count($selected);
        $k = 0;
        foreach ($selected as $p) {
            $k++;
            $jurosParcela = $somaOriginal <= 0 ? 0
                : ($k === $n ? $jurosRestante : round($juros * ((float) $p['amount'] / $somaOriginal), 2));
            $jurosRestante = round($jurosRestante - $jurosParcela, 2);
            update_dynamic($pdo, $table, (int) $p['id'], [
                'status' => 'Pago',
                'paidDate' => $today,
                'valor_original' => round((float) $p['amount'], 2),
                'juros_aplicado' => $jurosParcela,
                'bankAccount' => $bankAccount !== '' ? $bankAccount : ($p['bankAccount'] ?? null),
            ]);
            $settledIds[] = (int) $p['id'];
        }

        // 2) Cancela as parcelas futuras NÃO selecionadas do grupo (mantém as pagas).
        $stmt = $pdo->prepare('UPDATE `' . $table . '` SET status = \'Cancelado\' WHERE recorrencia_id = ? AND status NOT IN (\'Pago\', \'Cancelado\')');
        $stmt->execute([$rid]);
        $cancelled = $stmt->rowCount();

        // 3) Lança o valor total efetivamente pago no caixa/banco.
        if ($totalPago > 0) {
            $hist = 'Quitação antecipada — ' . count($settledIds) . ' parcela(s) [recorrência ' . $rid . ']'
                . ($juros > 0 ? ' +juros R$ ' . number_format($juros, 2, ',', '.') : '')
                . ($desconto > 0 ? ' -desconto R$ ' . number_format($desconto, 2, ',', '.') : '');
            $pdo->prepare(
                'INSERT INTO cash_bank_movements (`date`, bankAccount, `type`, history, amount, originDocument, status)
                 VALUES (?, ?, \'Saída\', ?, ?, ?, \'Confirmado\')'
            )->execute([$today, $bankAccount, $hist, $totalPago, mb_substr('QUIT:' . $rid, 0, 100)]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    log_automation_event($pdo, 'QUITACAO_ANTECIPADA', 'accounts_payable', $settledIds[0] ?? null, 'cash_bank_movements', null, 'OK',
        count($settledIds) . ' parcela(s); original R$ ' . number_format($somaOriginal, 2, ',', '.')
        . '; juros R$ ' . number_format($juros, 2, ',', '.')
        . '; desconto R$ ' . number_format($desconto, 2, ',', '.')
        . '; total R$ ' . number_format($totalPago, 2, ',', '.'), payable_user_id($authUser));
    server_audit($pdo, $authUser, 'update', 'payable', $settledIds[0] ?? null,
        'Quitação antecipada: ' . count($settledIds) . ' parcelas, total R$ ' . number_format($totalPago, 2, ',', '.'));

    return [
        'recorrencia_id' => $rid,
        'settled' => $settledIds,
        'cancelled' => $cancelled,
        'valor_original' => $somaOriginal,
        'juros' => $juros,
        'desconto' => $desconto,
        'total' => $totalPago,
        'parcels' => payable_group_parcels($pdo, $rid),
    ];
}

// Alteração em lote de parcelas de uma recorrência (não toca em parcelas pagas
// ou canceladas). scope: one | forward | all.
function payable_update_scope(PDO $pdo, array $payload, array $authUser): array
{
    $table = resolve_existing_table($pdo, ['accounts_payable']);
    $rid = trim((string) ($payload['recorrencia_id'] ?? ''));
    $scope = (string) ($payload['scope'] ?? 'all');
    $fromParcela = (int) ($payload['parcela_numero'] ?? 0);
    $parcelaId = (int) ($payload['parcela_id'] ?? 0);
    $fields = is_array($payload['fields'] ?? null) ? $payload['fields'] : [];
    if ($rid === '') {
        payable_respond(false, [], 'Informe o recorrencia_id.', 400);
    }

    $allowed = ['amount', 'supplierId', 'categoryId', 'costCenterId', 'projectId', 'bankAccount'];
    $data = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $fields)) {
            $data[$f] = normalize_value($fields[$f]);
        }
    }
    if (!$data) {
        payable_respond(false, [], 'Nenhum campo válido para atualizar.', 400);
    }

    $sql = 'SELECT id FROM `' . $table . '` WHERE recorrencia_id = ? AND status NOT IN (\'Pago\', \'Cancelado\')';
    $params = [$rid];
    if ($scope === 'one') {
        $sql .= ' AND id = ?';
        $params[] = $parcelaId;
    } elseif ($scope === 'forward') {
        $sql .= ' AND parcela_numero >= ?';
        $params[] = $fromParcela;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $ids = array_map('intval', array_column($stmt->fetchAll(), 'id'));

    $pdo->beginTransaction();
    try {
        foreach ($ids as $id) {
            update_dynamic($pdo, $table, $id, $data);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    server_audit($pdo, $authUser, 'update', 'payable', null, 'Recorrência ' . $rid . ': ' . count($ids) . ' parcela(s) [' . $scope . ']');
    return ['updated' => count($ids), 'ids' => $ids, 'parcels' => payable_group_parcels($pdo, $rid)];
}

function payable_cancel_recurrence(PDO $pdo, array $payload, array $authUser): array
{
    $table = resolve_existing_table($pdo, ['accounts_payable']);
    $rid = trim((string) ($payload['recorrencia_id'] ?? ''));
    if ($rid === '') {
        payable_respond(false, [], 'Informe o recorrencia_id.', 400);
    }
    $stmt = $pdo->prepare('UPDATE `' . $table . '` SET status = \'Cancelado\' WHERE recorrencia_id = ? AND status NOT IN (\'Pago\', \'Cancelado\')');
    $stmt->execute([$rid]);
    $count = $stmt->rowCount();

    log_automation_event($pdo, 'RECORRENCIA_CANCELADA', 'accounts_payable', null, null, null, 'OK',
        'Recorrência ' . $rid . ': ' . $count . ' parcela(s) futura(s) cancelada(s).', payable_user_id($authUser));
    server_audit($pdo, $authUser, 'update', 'payable', null, 'Recorrência ' . $rid . ' cancelada (' . $count . ' futuras).');
    return ['cancelled' => $count, 'parcels' => payable_group_parcels($pdo, $rid)];
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

// Feed consolidado da agenda: eventos manuais + lançamentos financeiros do
// período (contas a receber/pagar, marcos de obra e pedidos de compra),
// retornados em uma única chamada. Parâmetros: data_inicio, data_fim, obra_id.
function agenda_feed(PDO $pdo, array $query): array
{
    $start = agenda_date_only(agenda_query_value($query, ['data_inicio', 'periodo_inicio', 'inicio', 'start', 'from']));
    $end = agenda_date_only(agenda_query_value($query, ['data_fim', 'periodo_fim', 'fim', 'end', 'to']));
    $obraValue = agenda_query_value($query, ['obra_id', 'obraId', 'projectId', 'project_id']);
    $obraId = ($obraValue === null || $obraValue === '') ? null : (int) $obraValue;

    return [
        'eventos' => agenda_list_events($pdo, $query),
        'receber' => agenda_feed_financial(
            $pdo,
            ['accounts_receivable'],
            'SELECT id, document, issueDate, dueDate, receivedDate, clientId, projectId, amount, status',
            'dueDate',
            $start,
            $end,
            $obraId
        ),
        'pagar' => agenda_feed_financial(
            $pdo,
            ['accounts_payable'],
            'SELECT id, document, issueDate, dueDate, paidDate, supplierId, projectId, amount, status',
            'dueDate',
            $start,
            $end,
            $obraId
        ),
        'marcos' => agenda_feed_financial(
            $pdo,
            ['obra_cronograma_marcos'],
            'SELECT id, projectId, scheduleStepId, name, plannedDate, completedDate, status, notes',
            'plannedDate',
            $start,
            $end,
            $obraId
        ),
        'pedidos' => agenda_feed_financial(
            $pdo,
            ['purchase_orders'],
            'SELECT id, number, `date`, projectId, supplierId, amount, expectedDate, status',
            'expectedDate',
            $start,
            $end,
            $obraId
        ),
    ];
}

// Consulta genérica de um lançamento financeiro filtrado pela coluna de data do
// período e, opcionalmente, pela obra (projectId). Retorna [] se a tabela não existir.
function agenda_feed_financial(PDO $pdo, array $candidates, string $select, string $dateColumn, ?string $start, ?string $end, ?int $obraId): array
{
    $table = resolve_existing_table($pdo, $candidates, false);
    if ($table === null) {
        return [];
    }

    $sql = $select . ' FROM `' . $table . '` WHERE 1=1';
    $params = [];

    if ($start !== null) {
        $sql .= ' AND `' . $dateColumn . '` >= ?';
        $params[] = $start;
    }
    if ($end !== null) {
        $sql .= ' AND `' . $dateColumn . '` <= ?';
        $params[] = $end;
    }
    if ($obraId !== null) {
        $sql .= ' AND `projectId` = ?';
        $params[] = $obraId;
    }

    $sql .= ' ORDER BY `' . $dateColumn . '` ASC, `id` ASC';
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
        'clients' => r('clients', ['clientes'], ['name','document','zipCode','address','numero','complemento','bairro','cidade','estado','email','phone','status'], ['document','name']),
        'suppliers' => r('suppliers', ['fornecedores'], ['name','document','zipCode','address','numero','complemento','bairro','cidade','estado','email','phone','status'], ['document','name']),
        'categories' => r('financial_categories', ['categorias'], ['name','type','chartAccountId','status'], ['name']),
        'costCenters' => r('cost_centers', ['centros-custo','centros_de_custo'], ['code','name','manager','status','tipo','descricao_uso','exemplos'], ['code','name']),
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
        'workBudgetItems' => r('orcamento_obra_itens', ['itens-orcamentos-obras','itens-orçamentos-obras'], ['workBudgetId','projectId','origin','sinapiReferenceId','sinapiUf','sinapiReferenceType','code','description','unit','quantity','unitCost','totalCost','bdiPercent','unitPrice','totalPrice','stageName','costCenterId','categoryId','notes','quantidade_realizada','codigo','tipo','etapa_id','sinapi_id','composicao_propria_id','ordem'], ['workBudgetId','code','description']),
        'orcamentoEtapas' => r('orcamento_etapas', ['orcamento-etapas','etapas-orcamento'], ['orcamento_id','obra_id','nome','codigo','ordem','bdi_especifico'], ['orcamento_id','nome']),
        'quotes' => r('cotacoes', ['cotacoes','cotações'], ['supplierId','description','unit','quantity','unitValue','totalValue','quoteDate','validityDate','attachmentPath','projectId','workBudgetId','notes','status'], ['supplierId','description','quoteDate']),
        'fiscalDocuments' => r('fiscal_documents', ['notas-fiscais','documentos-fiscais-obra'], ['projectId','supplierId','documentNumber','issueDate','amount','type','status','payableId','receivableId','saleId','costCenterId','categoryId','pdfPath','xmlPath','notes'], ['documentNumber'], ['pdfPath','xmlPath']),
        'projectSchedule' => r('obra_cronograma_etapas', ['cronograma-fisico-financeiro','cronograma-obras','cronograma'], ['projectId','stageName','description','sortOrder','plannedStartDate','plannedEndDate','actualStartDate','actualEndDate','plannedPhysicalPercent','actualPhysicalPercent','plannedFinancialAmount','actualFinancialAmount','workBudgetId','workBudgetItemId','predecessorIds','durationDays','status','responsible','isMilestone','milestoneName','milestoneMessage','visibleToClient','notes','servicoSiacId'], ['projectId','stageName']),
        'projectMilestones' => r('obra_cronograma_marcos', ['marcos-obras','marcos-da-obra'], ['projectId','scheduleStepId','name','defaultMessage','visibleToClient','plannedDate','completedDate','status','notes'], ['projectId','name']),
        'projectNotifications' => r('obra_notificacoes', ['notificacoes-obras','notificacoes-da-obra'], ['projectId','scheduleStepId','milestoneId','recipient','phone','type','message','generatedLink','status','responsibleUserId'], ['generatedLink']),
        'projectTrackingLinks' => r('obra_links_acompanhamento', ['links-acompanhamento-obras','links-obras'], ['projectId','token','url','visibility','status','notes'], ['token']),
        'agendaEvents' => r('agenda_eventos', ['agenda-eventos','agenda'], ['obra_id','cliente_id','usuario_id','titulo','descricao','tipo','data_inicio','data_fim','dia_todo','lembrete_minutos','status'], ['titulo','data_inicio']),
        'kanbanBoards' => r('kanban_boards', ['kanban-boards','quadros-kanban'], ['obra_id','nome','tipo'], ['obra_id','nome','tipo']),
        'kanbanColumns' => r('kanban_colunas', ['kanban-colunas','colunas-kanban'], ['board_id','nome','ordem','cor','limite_cards'], ['board_id','nome']),
        'kanbanCards' => r('kanban_cards', ['kanban-cards','cards-kanban'], ['coluna_id','obra_id','titulo','descricao','responsavel_id','data_vencimento','prioridade','referencia_tipo','referencia_id','ordem'], ['referencia_tipo','referencia_id','titulo']),
        'purchaseOrders' => r('purchase_orders', ['pedidos-compra','pedidos-de-compra'], ['number','date','projectId','supplierId','costCenterId','categoryId','amount','expectedDate','status','notes','condicoes_pagamento','desconto'], ['number']),
        'technicalReports' => r('technical_reports', ['relatorios-tecnicos','relatórios-técnicos'], ['projectId','title','date','responsible','visibleToClient','status','notes'], ['projectId','title','date']),
        // Qualidade PBQP-H Nível B — tabelas criadas sob demanda por ensure_qualidade_tables().
        // Campos JSON (itensVerificacao, servicosControlados, checklistSiac) trafegam como string.
        'qualidadePolitica' => r('qualidade_politica', ['qualidade-politica','politica-qualidade'], ['conteudo','versao','aprovadoPor','dataAprovacao','status'], ['versao']),
        'qualidadePes' => r('qualidade_pes', ['qualidade-pes','procedimentos-execucao'], ['servicoSiacId','servicoNome','servicoGrupo','versao','objetivo','materiaisNecessarios','equipamentosEpi','procedimento','criteriosAceitacao','normasReferencia','responsavelElaboracao','dataElaboracao','status'], ['servicoSiacId','versao']),
        'qualidadePqo' => r('qualidade_pqo', ['qualidade-pqo','plano-qualidade-obra'], ['projectId','versao','responsavelTecnico','crea','dataInicioPrevisto','dataFimPrevisto','escopo','servicosControlados','materiaisControlados','metasQualidade','status','dataAprovacao','aprovadoPor'], ['projectId']),
        'qualidadeFvs' => r('qualidade_fvs', ['qualidade-fvs','fichas-verificacao-servico'], ['pqoId','projectId','etapaId','pesId','servicoSiacId','servicoNome','dataExecucao','localObra','responsavelExecucao','responsavelInspecao','itensVerificacao','resultado','observacoes','acaoCorretiva','dataInspecao','assinaturaExecutor','assinaturaInspetor','status'], ['projectId','servicoSiacId','dataExecucao','localObra']),
        'qualidadeFvm' => r('qualidade_fvm', ['qualidade-fvm','fichas-verificacao-material'], ['pqoId','projectId','materialNome','materialCodigo','fornecedor','notaFiscal','quantidade','unidade','dataRecebimento','responsavelRecebimento','itensVerificacao','resultado','observacoes','status'], ['projectId','materialNome','notaFiscal','dataRecebimento']),
        'qualidadeNc' => r('qualidade_nc', ['qualidade-nc','nao-conformidades'], ['projectId','pqoId','numero','origem','fvsId','fvmId','descricaoNC','servicoSiacId','servicoNome','localObra','grau','responsavelDeteccao','dataDeteccao','prazoAcao','acaoCorretiva','responsavelAcao','dataAcao','verificacaoEficacia','responsavelVerificacao','dataVerificacao','status'], ['numero']),
        'qualidadeTreinamentos' => r('qualidade_treinamentos', ['qualidade-treinamentos','treinamentos-qualidade'], ['projectId','pqoId','servicoSiacId','servicoNome','dataTreinamento','instrutor','participantes','conteudo','cargaHoraria','observacoes'], ['projectId','servicoSiacId','dataTreinamento']),
        'qualidadeAuditorias' => r('qualidade_auditorias', ['qualidade-auditorias','auditorias-internas'], ['projectId','tipo','dataAuditoria','auditor','escopo','checklistSiac','totalItens','itensConformes','ncsAbertas','resultado','relatorioTexto','status'], ['tipo','dataAuditoria','auditor']),
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
        'payable' => r('accounts_payable', ['contas-pagar','contas_a_pagar'], ['document','issueDate','dueDate','paidDate','supplierId','projectId','categoryId','costCenterId','bankAccount','amount','status','recorrencia_id','parcela_numero','parcela_total','recorrencia_tipo','juros_aplicado','valor_original','referencia_tipo','referencia_id'], ['document']),
        'cashMoves' => r('cash_bank_movements', ['movimentacoes-caixa','movimentacoes','movimentações'], ['date','bankAccount','type','categoryId','projectId','costCenterId','history','amount','originDocument','status','referencia_tipo','referencia_id'], ['originDocument']),
        'chartAccounts' => r('chart_accounts', ['plano-contas'], ['code','name','type','parentId','acceptsEntries','status'], ['code']),
        'journalEntries' => r('journal_entries', ['lancamentos-contabeis','lançamentos-contábeis'], ['entryDate','competenceDate','debitAccountId','creditAccountId','history','amount','projectId','costCenterId','originDocument'], ['originDocument']),
        'taxDocuments' => r('tax_documents', ['documentos-fiscais'], ['document','date','type','clientId','supplierId','projectId','amount','status'], ['document']),
        'taxes' => r('taxes', ['impostos'], ['name','competenceDate','baseAmount','rate','amount','projectId','status'], ['name','competenceDate']),
        'companySettings' => r('company_settings', ['dados-empresa'], ['name','document','zipCode','address','numero','complemento','bairro','city','estado','email','phone','website','instagram','whatsapp','logo_url','status'], ['document','name']),
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
        $searchable = array_filter($meta['fields'], fn ($field) => in_array($field, $columns, true) && !in_array($field, $meta['hidden'] ?? [], true) && preg_match('/name|document|description|history|notes|username|email|address|code|numero/i', $field));
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
    // Paginação opcional (?limit=&offset=): GETs sem limite continuam devolvendo
    // tudo por compatibilidade, mas consultas sob demanda (ex.: busca SINAPI)
    // podem restringir o volume. Teto de 5000 por requisição.
    $limit = isset($_GET['limit']) ? max(1, min(5000, (int) $_GET['limit'])) : 0;
    $offset = isset($_GET['offset']) ? max(0, (int) $_GET['offset']) : 0;
    if ($limit > 0) {
        $sql .= ' LIMIT ' . $limit . ($offset ? ' OFFSET ' . $offset : '');
    }
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
    $newId = (int) $pdo->lastInsertId();
    maybe_snapshot_client($pdo, $meta['table'], $newId, null);
    return get_record($pdo, $meta, $newId);
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
        // (Re)captura o snapshot do cliente em propostas/contratos quando o
        // cliente muda ou ainda não há snapshot — sem sobrescrever o original.
        maybe_snapshot_client($pdo, $meta['table'], $id, $before);
        $record = get_record($pdo, $meta, $id);
        if ($transactionalAutomation && status_changed_to($before, $record, ['Concluido', 'Concluido', 'Aprovado', 'Aprovada', 'Recebido'])) {
            if ($meta['table'] === 'obra_cronograma_marcos' && status_changed_to($before, $record, ['Concluido', 'Aprovado', 'Aprovada'])) {
                $record['automation'] = automate_approved_milestone($pdo, $id);
            }
            if ($meta['table'] === 'purchase_orders' && status_changed_to($before, $record, ['Aprovado', 'Aprovada'])) {
                $record['automation'] = automate_approved_purchase_order($pdo, $id);
            }
            if ($meta['table'] === 'purchase_orders' && status_changed_to($before, $record, ['Recebido'])) {
                $record['automation'] = automate_received_purchase_order($pdo, $id);
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
    if ($stmt->rowCount() === 0) {
        fail('Registro não encontrado.', 404);
    }
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

function bootstrap_data(PDO $pdo, array $resources, ?array $authUser = null, bool $full = false): array
{
    $role = (string) ($authUser['role'] ?? 'admin');
    // Tabelas sob demanda (plugins e qualidade) verificadas antes no
    // information_schema: na esmagadora maioria dos bootstraps elas já existem
    // e um SELECT leve evita re-executar 9 DDLs (CREATE IF NOT EXISTS + ALTER)
    // a cada login. Em caso de dúvida, o ensure_* roda como antes.
    try {
        if (!resolve_existing_table($pdo, ['system_plugins'], false)) {
            // Garante a tabela de plugins já no bootstrap: o menu lateral depende dela.
            ensure_plugins_table($pdo);
        }
    } catch (PDOException $error) {
        // Sem permissão de DDL: o bootstrap segue e devolve a lista vazia.
    }
    try {
        $qualidadeOk = resolve_existing_table($pdo, ['qualidade_auditorias'], false)
            && resolve_existing_table($pdo, ['obra_cronograma_etapas'], false)
            && in_array('servicoSiacId', table_columns($pdo, 'obra_cronograma_etapas'), true);
        if (!$qualidadeOk) {
            // Módulos PBQP-H populados já no primeiro acesso.
            ensure_qualidade_tables($pdo);
        }
    } catch (PDOException $error) {
        // Sem permissão de DDL: listas voltam vazias até as tabelas existirem.
    }
    try {
        // Colunas novas dos centros de custo (tipo/descricao_uso/exemplos) e o
        // seed dos centros padrão quando a tabela está vazia. Guardado por uma
        // checagem leve para não rodar DDL a cada bootstrap.
        if (resolve_existing_table($pdo, ['cost_centers'], false)) {
            if (!in_array('tipo', table_columns($pdo, 'cost_centers'), true)) {
                ensure_cost_center_columns($pdo);
            }
            ensure_default_cost_centers($pdo);
        }
        // Endereço estruturado no cadastro de clientes (cidade/estado p/ snapshot).
        if (resolve_existing_table($pdo, ['clients'], false)
            && !in_array('cidade', table_columns($pdo, 'clients'), true)) {
            ensure_client_address_columns($pdo);
        }
        if (resolve_existing_table($pdo, ['suppliers'], false)
            && !in_array('cidade', table_columns($pdo, 'suppliers'), true)) {
            ensure_supplier_address_columns($pdo);
        }
        if (resolve_existing_table($pdo, ['company_settings'], false)
            && !in_array('estado', table_columns($pdo, 'company_settings'), true)) {
            ensure_company_address_columns($pdo);
        }
        if (resolve_existing_table($pdo, ['company_settings'], false)
            && !in_array('logo_url', table_columns($pdo, 'company_settings'), true)) {
            ensure_company_logo_columns($pdo);
        }
        // Itens do pedido de compra + condições de pagamento/desconto.
        if (!resolve_existing_table($pdo, ['purchase_order_items'], false)
            || (resolve_existing_table($pdo, ['purchase_orders'], false) && !in_array('condicoes_pagamento', table_columns($pdo, 'purchase_orders'), true))) {
            ensure_purchase_order_items($pdo);
        }
        if (!resolve_existing_table($pdo, ['orcamento_item_execucao_log'], false)) {
            ensure_budget_execution_log($pdo);
        }
        // Estrutura de etapas/tipos do orçamento de obra.
        if (!resolve_existing_table($pdo, ['orcamento_etapas'], false)
            || (resolve_existing_table($pdo, ['orcamento_obra_itens'], false) && !in_array('etapa_id', table_columns($pdo, 'orcamento_obra_itens'), true))) {
            ensure_budget_structure($pdo);
        }
        // Colunas de referência cruzada caixa ↔ conta a pagar (anti dupla contagem).
        if (resolve_existing_table($pdo, ['cash_bank_movements'], false)
            && !in_array('referencia_tipo', table_columns($pdo, 'cash_bank_movements'), true)) {
            ensure_referencia_columns($pdo);
        }
        // Colunas de snapshot do cliente em propostas/contratos.
        if (resolve_existing_table($pdo, ['commercial_proposals'], false)
            && !in_array('cliente_nome', table_columns($pdo, 'commercial_proposals'), true)) {
            ensure_client_snapshot_columns($pdo);
        }
    } catch (PDOException $error) {
        // Sem permissão de DDL/escrita: o bootstrap segue normalmente.
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
            // Tabelas SINAPI são gigantes com a base oficial completa (o Analítico
            // passa de 100 mil linhas): o bootstrap leva só um recorte recente e a
            // base completa é consultada sob demanda via ?search=&limit= (módulo
            // Base SINAPI). Sem isso, o JSON do bootstrap inviabiliza o login.
            $limit = !$full && in_array($key, sinapi_heavy_resources(), true) ? ' LIMIT ' . SINAPI_BOOTSTRAP_LIMIT : '';
            $stmt = $pdo->query('SELECT * FROM `' . $meta['table'] . '` ORDER BY id DESC' . $limit);
            $data[$key] = array_map(fn ($record) => sanitize_record($meta, $record), $stmt->fetchAll());
        } catch (PDOException $error) {
            $data[$key] = [];
        }
    }
    // Overrides de permissão do usuário logado: o frontend gateia menu/edição
    // por cima do papel. Ausência de chave = herda do papel (igual à API).
    $data['userPermissions'] = user_effective_permissions($pdo, (int) ($authUser['id'] ?? 0));
    return $data;
}

function sinapi_heavy_resources(): array
{
    return ['sinapiInputs', 'sinapiCompositions', 'sinapiCompositionItems', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances'];
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

// Colunas novas dos centros de custo (idempotente). Mantém code/name/status,
// que já existem, e só acrescenta tipo/descricao_uso/exemplos.
// Colunas de snapshot do cliente em propostas e contratos (idempotente).
function ensure_client_snapshot_columns(PDO $pdo): void
{
    foreach (['commercial_proposals', 'sales_contracts'] as $table) {
        $pdo->exec(
            "ALTER TABLE `$table`
                ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(200) NULL,
                ADD COLUMN IF NOT EXISTS cliente_cpf_cnpj VARCHAR(20) NULL,
                ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(150) NULL,
                ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(20) NULL,
                ADD COLUMN IF NOT EXISTS cliente_endereco TEXT NULL,
                ADD COLUMN IF NOT EXISTS cliente_cidade VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS cliente_estado VARCHAR(2) NULL,
                ADD COLUMN IF NOT EXISTS cliente_cep VARCHAR(10) NULL"
        );
    }
}

// Colunas de endereço estruturado no cadastro de clientes (idempotente).
function ensure_client_address_columns(PDO $pdo): void
{
    $pdo->exec(
        "ALTER TABLE clients
            ADD COLUMN IF NOT EXISTS numero VARCHAR(20) NULL,
            ADD COLUMN IF NOT EXISTS complemento VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS bairro VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS cidade VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS estado VARCHAR(2) NULL"
    );
}

// Mesmo endereço estruturado para fornecedores.
function ensure_supplier_address_columns(PDO $pdo): void
{
    $pdo->exec(
        "ALTER TABLE suppliers
            ADD COLUMN IF NOT EXISTS numero VARCHAR(20) NULL,
            ADD COLUMN IF NOT EXISTS complemento VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS bairro VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS cidade VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS estado VARCHAR(2) NULL"
    );
}

// Dados da empresa: já possui `city` (cidade); acrescenta os demais campos.
function ensure_company_address_columns(PDO $pdo): void
{
    $pdo->exec(
        "ALTER TABLE company_settings
            ADD COLUMN IF NOT EXISTS numero VARCHAR(20) NULL,
            ADD COLUMN IF NOT EXISTS complemento VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS bairro VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS estado VARCHAR(2) NULL"
    );
}

// Logo, site, instagram e whatsapp da empresa (cabeçalho de propostas).
function ensure_company_logo_columns(PDO $pdo): void
{
    $pdo->exec(
        "ALTER TABLE company_settings
            ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NULL,
            ADD COLUMN IF NOT EXISTS website VARCHAR(200) NULL,
            ADD COLUMN IF NOT EXISTS instagram VARCHAR(200) NULL,
            ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20) NULL"
    );
}

// Itens detalhados do pedido de compra + condições/desconto + vínculo orçamento.
function ensure_purchase_order_items(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS purchase_order_items (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            purchase_order_id BIGINT UNSIGNED NOT NULL,
            descricao VARCHAR(300) NOT NULL,
            unidade VARCHAR(20) DEFAULT 'un',
            quantidade DECIMAL(10,3) NOT NULL DEFAULT 1,
            valor_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
            valor_total DECIMAL(16,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
            work_budget_item_id BIGINT UNSIGNED NULL,
            observacao VARCHAR(200) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pedido (purchase_order_id),
            INDEX idx_poi_budget_item (work_budget_item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $pdo->exec(
        "ALTER TABLE purchase_orders
            ADD COLUMN IF NOT EXISTS condicoes_pagamento VARCHAR(200) NULL,
            ADD COLUMN IF NOT EXISTS desconto DECIMAL(10,2) DEFAULT 0"
    );
    try {
        $pdo->exec("ALTER TABLE orcamento_obra_itens ADD COLUMN IF NOT EXISTS quantidade_realizada DECIMAL(18,4) NOT NULL DEFAULT 0");
    } catch (Throwable $error) {
        // Tabela de itens do orçamento pode não existir nesta instalação.
    }
}

// Histórico de alterações da quantidade realizada por item do orçamento.
function ensure_budget_execution_log(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS orcamento_item_execucao_log (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            item_id BIGINT UNSIGNED NOT NULL,
            quantidade_anterior DECIMAL(18,4) NOT NULL DEFAULT 0,
            quantidade_nova DECIMAL(18,4) NOT NULL DEFAULT 0,
            origem VARCHAR(30) DEFAULT 'manual',
            motivo VARCHAR(255) NULL,
            usuario_id BIGINT UNSIGNED NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_exec_item (item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    try {
        $pdo->exec("ALTER TABLE orcamento_obra_itens ADD COLUMN IF NOT EXISTS quantidade_realizada DECIMAL(18,4) NOT NULL DEFAULT 0");
    } catch (Throwable $error) {
        // segue
    }
}

// Estrutura profissional do orçamento: etapas + colunas (tipo, etapa, código…).
function ensure_budget_structure(PDO $pdo): void
{
    $pdo->exec(
        "ALTER TABLE orcamento_obra_itens
            ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) NULL,
            ADD COLUMN IF NOT EXISTS tipo ENUM('material','mao_de_obra','equipamento','subempreiteiro','outros') DEFAULT 'material',
            ADD COLUMN IF NOT EXISTS etapa_id BIGINT UNSIGNED NULL,
            ADD COLUMN IF NOT EXISTS sinapi_id BIGINT UNSIGNED NULL,
            ADD COLUMN IF NOT EXISTS composicao_propria_id BIGINT UNSIGNED NULL,
            ADD COLUMN IF NOT EXISTS ordem INT DEFAULT 0"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS orcamento_etapas (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            orcamento_id BIGINT UNSIGNED NOT NULL,
            obra_id BIGINT UNSIGNED NOT NULL,
            nome VARCHAR(200) NOT NULL,
            codigo VARCHAR(10) NULL,
            ordem INT DEFAULT 0,
            bdi_especifico DECIMAL(5,2) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_orcamento (orcamento_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

function log_budget_execution(PDO $pdo, int $itemId, float $anterior, float $nova, string $origem, ?string $motivo, ?int $userId): void
{
    try {
        if (!resolve_existing_table($pdo, ['orcamento_item_execucao_log'], false)) {
            return;
        }
        insert_dynamic($pdo, 'orcamento_item_execucao_log', [
            'item_id' => $itemId,
            'quantidade_anterior' => round($anterior, 4),
            'quantidade_nova' => round($nova, 4),
            'origem' => $origem,
            'motivo' => $motivo,
            'usuario_id' => $userId,
        ]);
    } catch (Throwable $error) {
        // log de histórico é best-effort
    }
}

// Monta o endereço completo do cliente (logradouro, número, complemento, bairro)
// para o snapshot de proposta/contrato.
function compose_client_address(array $client): string
{
    $logradouro = trim((string) ($client['address'] ?? ''));
    $numero = trim((string) ($client['numero'] ?? ''));
    $line1 = $logradouro;
    if ($numero !== '') {
        $line1 .= ($line1 !== '' ? ', ' : '') . $numero;
    }
    $parts = array_filter([
        $line1,
        trim((string) ($client['complemento'] ?? '')),
        trim((string) ($client['bairro'] ?? '')),
    ], static fn ($p) => $p !== '');
    return implode(' - ', $parts);
}

// Endereço completo da empresa para o cabeçalho de documentos (PDF de proposta):
// "Rua/logradouro, numero - complemento - bairro · cidade/UF · CEP". Campos
// vazios são ignorados. company_settings usa `city` para a cidade.
function compose_company_address(array $company): string
{
    $logradouro = trim((string) ($company['address'] ?? ''));
    $numero = trim((string) ($company['numero'] ?? ''));
    $line1 = $logradouro;
    if ($numero !== '') {
        $line1 .= ($line1 !== '' ? ', ' : '') . $numero;
    }
    $street = implode(' - ', array_filter([
        $line1,
        trim((string) ($company['complemento'] ?? '')),
        trim((string) ($company['bairro'] ?? '')),
    ], static fn ($p) => $p !== ''));

    $cidadeUf = implode('/', array_filter([
        trim((string) ($company['city'] ?? $company['cidade'] ?? '')),
        trim((string) ($company['estado'] ?? '')),
    ], static fn ($p) => $p !== ''));

    $cep = trim((string) ($company['zipCode'] ?? ''));
    $cepStr = $cep !== '' ? 'CEP ' . $cep : '';

    return implode(' · ', array_filter([$street, $cidadeUf, $cepStr], static fn ($p) => $p !== ''));
}

// Copia os dados ATUAIS do cliente para as colunas de snapshot da proposta/
// contrato. Só (re)captura na criação ($before === null), quando o cliente foi
// trocado, ou quando o snapshot ainda está vazio — assim o registro preserva os
// dados do momento em que foi criado mesmo que o cadastro do cliente mude depois.
function maybe_snapshot_client(PDO $pdo, string $table, int $id, ?array $before): void
{
    if (!in_array($table, ['commercial_proposals', 'sales_contracts'], true)) {
        return;
    }
    try {
        $cols = table_columns($pdo, $table);
        if (!in_array('cliente_nome', $cols, true) || !in_array('clientId', $cols, true)) {
            return;
        }
        $stmt = $pdo->prepare('SELECT clientId, cliente_nome FROM `' . $table . '` WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            return;
        }
        $clientId = (int) ($row['clientId'] ?? 0);
        if ($clientId <= 0) {
            return;
        }
        $clientChanged = $before !== null && (int) ($before['clientId'] ?? 0) !== $clientId;
        $snapshotEmpty = ($row['cliente_nome'] ?? '') === '' || $row['cliente_nome'] === null;
        if ($before !== null && !$clientChanged && !$snapshotEmpty) {
            return; // mantém o snapshot original
        }
        $client = clients_get_by_id($pdo, $clientId);
        if (!$client) {
            return;
        }
        $endereco = compose_client_address($client);
        update_dynamic($pdo, $table, $id, [
            'cliente_nome' => $client['name'] ?? null,
            'cliente_cpf_cnpj' => $client['document'] ?? null,
            'cliente_email' => $client['email'] ?? null,
            'cliente_telefone' => $client['phone'] ?? null,
            'cliente_endereco' => $endereco !== '' ? $endereco : ($client['address'] ?? null),
            'cliente_cidade' => $client['cidade'] ?? null,
            'cliente_estado' => $client['estado'] ?? null,
            'cliente_cep' => $client['zipCode'] ?? null,
        ]);
    } catch (Throwable $error) {
        error_log('[ObraSync snapshot] ' . $error->getMessage());
    }
}

function ensure_cost_center_columns(PDO $pdo): void
{
    $pdo->exec(
        "ALTER TABLE cost_centers
            ADD COLUMN IF NOT EXISTS tipo ENUM('operacional','administrativo','tecnico','financeiro') NOT NULL DEFAULT 'administrativo' AFTER name,
            ADD COLUMN IF NOT EXISTS descricao_uso TEXT NULL AFTER tipo,
            ADD COLUMN IF NOT EXISTS exemplos TEXT NULL AFTER descricao_uso"
    );
}

// Insere os centros de custo padrão apenas quando a tabela está vazia, para não
// duplicar nem sobrescrever dados de instalações existentes.
function ensure_default_cost_centers(PDO $pdo): void
{
    if ((int) $pdo->query('SELECT COUNT(*) FROM cost_centers')->fetchColumn() > 0) {
        return;
    }
    $defaults = [
        ['ADM-01', 'Administrativo Geral', 'administrativo', 'Despesas do escritório: aluguel, energia, água, internet, material de escritório'],
        ['ADM-02', 'Pessoal e RH', 'administrativo', 'Salários, pró-labore, INSS, FGTS, benefícios, rescisões'],
        ['ADM-03', 'Veículos e Transporte', 'administrativo', 'Combustível, manutenção, IPVA, seguro veicular, pedágios'],
        ['ADM-04', 'Equipamentos e Ferramentas', 'administrativo', 'Compra, aluguel e manutenção de equipamentos e ferramentas'],
        ['ADM-05', 'Marketing e Comercial', 'administrativo', 'Site, publicidade, materiais de divulgação, eventos'],
        ['ADM-06', 'Impostos e Taxas', 'financeiro', 'ISS, PIS, COFINS, IRPJ, CSLL, alvarás e licenças'],
        ['ADM-07', 'Contabilidade e Jurídico', 'administrativo', 'Honorários de contador, advogado e outros consultores'],
        ['ADM-08', 'TI e Sistemas', 'administrativo', 'ObraSync, softwares, domínio, hospedagem, suporte'],
        ['ADM-09', 'Capacitação e Treinamento', 'administrativo', 'Cursos, certificações, NRs, treinamentos da equipe'],
        ['ADM-10', 'Seguros', 'administrativo', 'Seguro obra, seguro empresa, ART/RRT'],
        ['TEC-01', 'Obras Civis', 'tecnico', 'Materiais e mão de obra de obras civis, subempreiteiros'],
        ['TEC-02', 'Instalações Elétricas', 'tecnico', 'Materiais elétricos, mão de obra eletricista, ART elétrica'],
        ['TEC-03', 'Instalações Hidráulicas', 'tecnico', 'Materiais hidráulicos, mão de obra encanador'],
        ['TEC-04', 'Cobertura e Telhado', 'tecnico', 'Telhas, estrutura metálica, mão de obra telhadista'],
        ['TEC-05', 'Ar Condicionado e Climatização', 'tecnico', 'Equipamentos, instalação e manutenção de ar condicionado'],
        ['TEC-06', 'Projetos e Consultoria', 'tecnico', 'Projetos arquitetônicos, estruturais, elétricos, hidráulicos'],
        ['TEC-07', 'Manutenção Predial', 'tecnico', 'Serviços de manutenção corretiva e preventiva'],
        ['FIN-01', 'Reserva de Capital', 'financeiro', 'Provisões, reservas, capital de giro'],
        ['FIN-02', 'Investimentos', 'financeiro', 'Compra de equipamentos de grande valor, veículos'],
        ['FIN-03', 'Encargos Financeiros', 'financeiro', 'Juros, tarifas bancárias, IOF, multas'],
    ];
    $stmt = $pdo->prepare('INSERT INTO cost_centers (code, name, tipo, descricao_uso, status) VALUES (?, ?, ?, ?, \'Ativo\')');
    foreach ($defaults as $row) {
        $stmt->execute($row);
    }
}

// Endpoint explícito de centros de custo (?module=costCenters&action=...).
// Reaproveita os helpers genéricos (list/create/update/delete) e acrescenta o
// get por id. Padrão de resposta { success, data, message }.
function handle_cost_centers_module(PDO $pdo, string $method, array $query, array $meta, array $authUser): never
{
    $action = strtolower(trim((string) ($query['action'] ?? '')));
    if ($action === '') {
        if ($method === 'GET') {
            $action = isset($query['id']) && $query['id'] !== '' ? 'get' : 'list';
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
            cost_centers_respond(true, list_records($pdo, $meta));
        }

        if ($action === 'get') {
            require_method($method, ['GET']);
            $id = (int) ($query['id'] ?? 0);
            if ($id <= 0) {
                cost_centers_respond(false, [], 'Informe o id do centro de custo.', 400);
            }
            cost_centers_respond(true, get_record($pdo, $meta, $id));
        }

        if ($action === 'create') {
            require_method($method, ['POST']);
            $record = create_record($pdo, $meta, read_json());
            server_audit($pdo, $authUser, 'create', 'costCenters', (int) ($record['id'] ?? 0), (string) ($record['name'] ?? ''));
            cost_centers_respond(true, $record, 'Centro de custo criado com sucesso.', 201);
        }

        if ($action === 'update') {
            require_method($method, ['PUT', 'PATCH', 'POST']);
            $payload = read_json();
            $id = (int) ($query['id'] ?? 0);
            if ($id <= 0) {
                $id = (int) ($payload['id'] ?? 0);
            }
            if ($id <= 0) {
                cost_centers_respond(false, [], 'Informe o id do centro de custo.', 400);
            }
            $record = update_record($pdo, $meta, $id, $payload);
            server_audit($pdo, $authUser, 'update', 'costCenters', $id, (string) ($record['name'] ?? ''));
            cost_centers_respond(true, $record, 'Centro de custo atualizado com sucesso.');
        }

        if ($action === 'delete') {
            require_method($method, ['DELETE', 'POST']);
            $id = (int) ($query['id'] ?? 0);
            if ($id <= 0) {
                cost_centers_respond(false, [], 'Informe o id do centro de custo.', 400);
            }
            delete_record($pdo, $meta, $id);
            server_audit($pdo, $authUser, 'delete', 'costCenters', $id, '');
            cost_centers_respond(true, [], 'Centro de custo excluído com sucesso.');
        }

        cost_centers_respond(false, [], 'Ação de centro de custo inválida.', 400);
    } catch (Throwable $e) {
        error_log('[ObraSync costCenters] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
        cost_centers_respond(false, [], 'Erro interno ao processar o centro de custo.', 500);
    }
}

function cost_centers_respond(bool $success, mixed $data = [], string $message = '', int $status = 200): never
{
    http_response_code($status);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ─── Vínculo caixa ↔ conta a pagar (anti dupla contagem) ────────────────────
function ensure_referencia_columns(PDO $pdo): void
{
    $pdo->exec(
        "ALTER TABLE cash_bank_movements
            ADD COLUMN IF NOT EXISTS referencia_tipo VARCHAR(30) NULL AFTER status,
            ADD COLUMN IF NOT EXISTS referencia_id BIGINT UNSIGNED NULL AFTER referencia_tipo"
    );
    $pdo->exec(
        "ALTER TABLE accounts_payable
            ADD COLUMN IF NOT EXISTS referencia_tipo VARCHAR(30) NULL AFTER status,
            ADD COLUMN IF NOT EXISTS referencia_id BIGINT UNSIGNED NULL AFTER referencia_tipo"
    );
}

function handle_cash_moves_module(PDO $pdo, string $method, array $query, array $authUser): never
{
    $action = strtolower(trim((string) ($query['action'] ?? '')));
    try {
        if ($action === 'create') {
            require_method($method, ['POST']);
            cash_moves_respond(true, cash_move_create_linked($pdo, read_json(), $authUser), 'Movimento de caixa registrado.', 201);
        }
        if ($action === 'link') {
            require_method($method, ['POST']);
            cash_moves_respond(true, cash_move_link($pdo, read_json(), $authUser), 'Lançamentos vinculados com sucesso.');
        }
        cash_moves_respond(false, [], 'Ação de caixa inválida.', 400);
    } catch (Throwable $e) {
        error_log('[ObraSync cashMoves] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
        cash_moves_respond(false, [], 'Erro interno ao processar o movimento de caixa. Nada foi gravado.', 500);
    }
}

function cash_moves_respond(bool $success, mixed $data = [], string $message = '', int $status = 200): never
{
    http_response_code($status);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Cria um movimento de caixa e, se vinculado a uma conta a pagar, baixa a conta
// e grava a referência cruzada nos dois lados — tudo em transação.
function cash_move_create_linked(PDO $pdo, array $payload, array $authUser): array
{
    $payableId = (int) ($payload['payableId'] ?? $payload['payable_id'] ?? 0);
    $date = substr(trim((string) ($payload['date'] ?? '')), 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        cash_moves_respond(false, [], 'Data inválida.', 400);
    }
    $tipo = (string) ($payload['type'] ?? '');
    $cashData = [
        'date' => $date,
        'bankAccount' => normalize_value($payload['bankAccount'] ?? ''),
        'type' => $payableId > 0 ? 'Saída' : (in_array($tipo, ['Entrada', 'Saída', 'Transferência'], true) ? $tipo : 'Saída'),
        'categoryId' => normalize_value($payload['categoryId'] ?? null),
        'projectId' => normalize_value($payload['projectId'] ?? null),
        'costCenterId' => normalize_value($payload['costCenterId'] ?? null),
        'history' => normalize_value($payload['history'] ?? ''),
        'amount' => round((float) ($payload['amount'] ?? 0), 2),
        'originDocument' => normalize_value($payload['originDocument'] ?? null),
        'status' => 'Confirmado',
    ];
    if ($payableId > 0) {
        $cashData['referencia_tipo'] = 'CONTA_PAGAR';
        $cashData['referencia_id'] = $payableId;
    }

    $pdo->beginTransaction();
    try {
        $cashId = insert_dynamic($pdo, 'cash_bank_movements', $cashData);
        if ($payableId > 0) {
            $stmt = $pdo->prepare('SELECT id, status, paidDate FROM accounts_payable WHERE id = ? LIMIT 1');
            $stmt->execute([$payableId]);
            $pay = $stmt->fetch();
            if ($pay && ($pay['status'] ?? '') !== 'Cancelado') {
                update_dynamic($pdo, 'accounts_payable', $payableId, [
                    'status' => 'Pago',
                    'paidDate' => !empty($pay['paidDate']) ? $pay['paidDate'] : $date,
                    'referencia_tipo' => 'CAIXA_MANUAL',
                    'referencia_id' => $cashId,
                ]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    log_automation_event($pdo, 'CAIXA_VINCULADO_CONTA_PAGAR', 'cash_bank_movements', $cashId, 'accounts_payable', $payableId ?: null, 'OK',
        $payableId ? ('Caixa manual baixou a conta a pagar #' . $payableId) : 'Movimento de caixa manual', payable_user_id($authUser));
    server_audit($pdo, $authUser, 'create', 'cashMoves', $cashId, $payableId ? ('Caixa vinculado à conta a pagar #' . $payableId) : 'Movimento de caixa');

    $stmt = $pdo->prepare('SELECT * FROM cash_bank_movements WHERE id = ? LIMIT 1');
    $stmt->execute([$cashId]);
    return ['cashMove' => $stmt->fetch() ?: [], 'payableId' => $payableId ?: null];
}

// Vincula um movimento de caixa e uma conta a pagar já existentes (botão
// "Marcar como vinculado"): grava a referência cruzada e baixa a conta.
function cash_move_link(PDO $pdo, array $payload, array $authUser): array
{
    $cashId = (int) ($payload['cashMoveId'] ?? $payload['cash_id'] ?? 0);
    $payableId = (int) ($payload['payableId'] ?? $payload['payable_id'] ?? 0);
    if ($cashId <= 0 || $payableId <= 0) {
        cash_moves_respond(false, [], 'Informe o movimento de caixa e a conta a pagar.', 400);
    }
    $stmt = $pdo->prepare('SELECT id, `date` FROM cash_bank_movements WHERE id = ? LIMIT 1');
    $stmt->execute([$cashId]);
    $cash = $stmt->fetch();
    $stmt = $pdo->prepare('SELECT id, status, paidDate FROM accounts_payable WHERE id = ? LIMIT 1');
    $stmt->execute([$payableId]);
    $pay = $stmt->fetch();
    if (!$cash || !$pay) {
        cash_moves_respond(false, [], 'Registro não encontrado.', 404);
    }

    $pdo->beginTransaction();
    try {
        update_dynamic($pdo, 'cash_bank_movements', $cashId, ['referencia_tipo' => 'CONTA_PAGAR', 'referencia_id' => $payableId]);
        update_dynamic($pdo, 'accounts_payable', $payableId, [
            'status' => ($pay['status'] ?? '') === 'Cancelado' ? $pay['status'] : 'Pago',
            'paidDate' => !empty($pay['paidDate']) ? $pay['paidDate'] : (string) ($cash['date'] ?? ''),
            'referencia_tipo' => 'CAIXA_MANUAL',
            'referencia_id' => $cashId,
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    log_automation_event($pdo, 'CAIXA_VINCULADO_CONTA_PAGAR', 'cash_bank_movements', $cashId, 'accounts_payable', $payableId, 'OK', 'Vínculo confirmado manualmente pelo usuário.', payable_user_id($authUser));
    server_audit($pdo, $authUser, 'update', 'cashMoves', $cashId, 'Vínculo caixa ↔ conta a pagar #' . $payableId);
    return ['cashMoveId' => $cashId, 'payableId' => $payableId];
}

// ─── Logo / identidade visual da empresa ────────────────────────────────────
function company_settings_respond(bool $success, mixed $data = [], string $message = '', int $status = 200): never
{
    http_response_code($status);
    echo json_encode(['success' => $success, 'data' => $data, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function company_logo_dir(array $config): string
{
    return rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/') . '/empresa';
}

function handle_company_settings_module(PDO $pdo, string $method, array $query, array $config, array $authUser): never
{
    $action = strtolower(trim((string) ($query['action'] ?? '')));
    try {
        if ($action === 'uploadlogo') {
            require_method($method, ['POST']);
            handle_company_logo_upload($pdo, $config, $authUser);
        }
        if ($action === 'removelogo') {
            require_method($method, ['POST', 'DELETE']);
            handle_company_logo_remove($pdo, $config, $authUser);
        }
        company_settings_respond(false, [], 'Ação de dados da empresa inválida.', 400);
    } catch (Throwable $e) {
        error_log('[ObraSync companySettings] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
        company_settings_respond(false, [], 'Erro ao processar a logo da empresa.', 500);
    }
}

function handle_company_logo_upload(PDO $pdo, array $config, array $authUser): never
{
    $file = $_FILES['logo'] ?? null;
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || empty($file['tmp_name'])) {
        company_settings_respond(false, [], 'Arquivo da logo não informado.', 400);
    }
    if ((int) ($file['size'] ?? 0) > 2 * 1024 * 1024) {
        company_settings_respond(false, [], 'Arquivo acima de 2MB. Reduza o tamanho da logo.', 413);
    }
    $ext = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
    if ($ext === 'jpeg') {
        $ext = 'jpg';
    }
    if (!in_array($ext, ['png', 'jpg', 'svg'], true)) {
        company_settings_respond(false, [], 'Tipo não permitido. Envie PNG, JPG ou SVG.', 415);
    }
    // Conteúdo conferido (png/jpg pelo mime; svg é XML/texto, validação leve).
    $mime = function_exists('mime_content_type') ? (mime_content_type($file['tmp_name']) ?: '') : '';
    if ($ext === 'png' && $mime !== '' && $mime !== 'image/png') {
        company_settings_respond(false, [], 'Conteúdo do arquivo não corresponde a um PNG.', 415);
    }
    if ($ext === 'jpg' && $mime !== '' && $mime !== 'image/jpeg') {
        company_settings_respond(false, [], 'Conteúdo do arquivo não corresponde a um JPG.', 415);
    }

    $dir = company_logo_dir($config);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        company_settings_respond(false, [], 'Não foi possível criar a pasta de upload.', 500);
    }
    // Substitui a logo anterior (qualquer extensão).
    foreach (['png', 'jpg', 'jpeg', 'svg'] as $old) {
        $previous = $dir . '/logo.' . $old;
        if (is_file($previous)) {
            @unlink($previous);
        }
    }
    $filename = 'logo.' . $ext;
    $target = $dir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $target)) {
        company_settings_respond(false, [], 'Não foi possível salvar a logo.', 500);
    }
    @chmod($target, 0644);

    $id = (int) ($pdo->query('SELECT id FROM company_settings ORDER BY id ASC LIMIT 1')->fetchColumn() ?: 0);
    if ($id > 0) {
        update_dynamic($pdo, 'company_settings', $id, ['logo_url' => $filename]);
    }
    server_audit($pdo, $authUser, 'update', 'companySettings', $id ?: null, 'Logo da empresa atualizada (' . $filename . ')');
    company_settings_respond(true, ['logo_url' => $filename], 'Logo enviada com sucesso.');
}

function handle_company_logo_remove(PDO $pdo, array $config, array $authUser): never
{
    $dir = company_logo_dir($config);
    foreach (['png', 'jpg', 'jpeg', 'svg'] as $old) {
        $previous = $dir . '/logo.' . $old;
        if (is_file($previous)) {
            @unlink($previous);
        }
    }
    $id = (int) ($pdo->query('SELECT id FROM company_settings ORDER BY id ASC LIMIT 1')->fetchColumn() ?: 0);
    if ($id > 0) {
        update_dynamic($pdo, 'company_settings', $id, ['logo_url' => null]);
    }
    server_audit($pdo, $authUser, 'update', 'companySettings', $id ?: null, 'Logo da empresa removida');
    company_settings_respond(true, [], 'Logo removida.');
}

// Pública: serve o arquivo da logo (binário) sem exigir autenticação.
function handle_company_logo_get(PDO $pdo, array $config): never
{
    $logo = '';
    try {
        $logo = (string) ($pdo->query("SELECT logo_url FROM company_settings WHERE logo_url IS NOT NULL AND logo_url <> '' ORDER BY id ASC LIMIT 1")->fetchColumn() ?: '');
    } catch (Throwable $e) {
        $logo = '';
    }
    $file = $logo !== '' ? company_logo_dir($config) . '/' . basename($logo) : '';
    if ($file === '' || !is_file($file)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Logo não encontrada.';
        exit;
    }
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $types = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'svg' => 'image/svg+xml'];
    header_remove('Content-Type');
    header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
    header('Cache-Control: no-cache, max-age=0, must-revalidate');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}

// ─── Itens detalhados do pedido de compra ───────────────────────────────────
function handle_purchase_order_items_module(PDO $pdo, string $method, array $query, array $authUser): never
{
    if (!resolve_existing_table($pdo, ['purchase_order_items'], false)) {
        ensure_purchase_order_items($pdo);
    }
    $action = strtolower(trim((string) ($query['action'] ?? '')));
    if ($action === '') {
        $action = match (true) {
            $method === 'GET' => 'list',
            $method === 'POST' => 'create',
            $method === 'PUT', $method === 'PATCH' => 'update',
            $method === 'DELETE' => 'delete',
            default => '',
        };
    }
    try {
        if ($action === 'list') {
            require_method($method, ['GET']);
            poi_respond(true, poi_list($pdo, (int) ($query['purchaseOrderId'] ?? $query['purchase_order_id'] ?? 0)));
        }
        if ($action === 'create') {
            require_method($method, ['POST']);
            poi_respond(true, poi_create($pdo, read_json()), 'Item adicionado.', 201);
        }
        if ($action === 'update') {
            require_method($method, ['PUT', 'PATCH', 'POST']);
            $payload = read_json();
            $id = (int) ($query['id'] ?? $payload['id'] ?? 0);
            if ($id <= 0) {
                poi_respond(false, [], 'Informe o id do item.', 400);
            }
            poi_respond(true, poi_update($pdo, $id, $payload), 'Item atualizado.');
        }
        if ($action === 'delete') {
            require_method($method, ['DELETE', 'POST']);
            $id = (int) ($query['id'] ?? 0);
            if ($id <= 0) {
                poi_respond(false, [], 'Informe o id do item.', 400);
            }
            poi_delete($pdo, $id);
            poi_respond(true, [], 'Item removido.');
        }
        if ($action === 'savebulk') {
            require_method($method, ['POST']);
            poi_respond(true, poi_save_bulk($pdo, read_json(), $authUser), 'Itens do pedido salvos.');
        }
        poi_respond(false, [], 'Ação de itens do pedido inválida.', 400);
    } catch (Throwable $e) {
        error_log('[ObraSync purchaseOrderItems] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
        poi_respond(false, [], 'Erro ao processar itens do pedido. Nada foi gravado.', 500);
    }
}

function poi_respond(bool $success, mixed $data = [], string $message = '', int $status = 200): never
{
    http_response_code($status);
    echo json_encode(['success' => $success, 'data' => $data, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function poi_list(PDO $pdo, int $poId): array
{
    if ($poId <= 0) {
        return [];
    }
    $stmt = $pdo->prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id ASC');
    $stmt->execute([$poId]);
    return $stmt->fetchAll();
}

// Monta os dados de um item, SEM valor_total (coluna gerada — não pode ser inserida).
function poi_item_data(array $payload): array
{
    $budgetItemId = $payload['work_budget_item_id'] ?? $payload['workBudgetItemId'] ?? null;
    $observacao = trim((string) ($payload['observacao'] ?? ''));
    return [
        'purchase_order_id' => (int) ($payload['purchase_order_id'] ?? $payload['purchaseOrderId'] ?? 0),
        'descricao' => mb_substr(trim((string) ($payload['descricao'] ?? '')), 0, 300),
        'unidade' => mb_substr((trim((string) ($payload['unidade'] ?? '')) ?: 'un'), 0, 20),
        'quantidade' => round((float) ($payload['quantidade'] ?? 1), 3),
        'valor_unitario' => round((float) ($payload['valor_unitario'] ?? 0), 2),
        'work_budget_item_id' => ($budgetItemId !== null && $budgetItemId !== '') ? (int) $budgetItemId : null,
        'observacao' => $observacao !== '' ? mb_substr($observacao, 0, 200) : null,
    ];
}

function poi_create(PDO $pdo, array $payload): array
{
    $data = poi_item_data($payload);
    if ($data['purchase_order_id'] <= 0 || $data['descricao'] === '') {
        poi_respond(false, [], 'Informe o pedido e a descrição do item.', 400);
    }
    $id = insert_dynamic($pdo, 'purchase_order_items', $data);
    poi_sync_order_total($pdo, $data['purchase_order_id']);
    $stmt = $pdo->prepare('SELECT * FROM purchase_order_items WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetch() ?: [];
}

function poi_update(PDO $pdo, int $id, array $payload): array
{
    $stmt = $pdo->prepare('SELECT purchase_order_id FROM purchase_order_items WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $poId = (int) ($stmt->fetchColumn() ?: 0);
    if ($poId <= 0) {
        poi_respond(false, [], 'Item não encontrado.', 404);
    }
    $data = poi_item_data($payload + ['purchase_order_id' => $poId]);
    unset($data['purchase_order_id']);
    update_dynamic($pdo, 'purchase_order_items', $id, $data);
    poi_sync_order_total($pdo, $poId);
    $stmt = $pdo->prepare('SELECT * FROM purchase_order_items WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetch() ?: [];
}

function poi_delete(PDO $pdo, int $id): void
{
    $stmt = $pdo->prepare('SELECT purchase_order_id FROM purchase_order_items WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $poId = (int) ($stmt->fetchColumn() ?: 0);
    $pdo->prepare('DELETE FROM purchase_order_items WHERE id = ?')->execute([$id]);
    if ($poId > 0) {
        poi_sync_order_total($pdo, $poId);
    }
}

function poi_save_bulk(PDO $pdo, array $payload, array $authUser): array
{
    $poId = (int) ($payload['purchaseOrderId'] ?? $payload['purchase_order_id'] ?? 0);
    if ($poId <= 0) {
        poi_respond(false, [], 'Informe o pedido de compra.', 400);
    }
    $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
    $desconto = round((float) ($payload['desconto'] ?? 0), 2);
    $condicoes = array_key_exists('condicoes_pagamento', $payload) ? mb_substr(trim((string) $payload['condicoes_pagamento']), 0, 200) : null;

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM purchase_order_items WHERE purchase_order_id = ?')->execute([$poId]);
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $data = poi_item_data($item + ['purchase_order_id' => $poId]);
            if ($data['descricao'] === '') {
                continue;
            }
            insert_dynamic($pdo, 'purchase_order_items', $data);
        }
        poi_sync_order_total($pdo, $poId, $desconto, $condicoes);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    server_audit($pdo, $authUser, 'update', 'purchaseOrders', $poId, 'Itens do pedido salvos (' . count($items) . ')');
    return poi_order_summary($pdo, $poId);
}

// Recalcula amount = soma(valor_total dos itens) − desconto e grava no pedido.
function poi_sync_order_total(PDO $pdo, int $poId, ?float $desconto = null, ?string $condicoes = null): void
{
    $stmt = $pdo->prepare('SELECT COALESCE(SUM(valor_total),0) FROM purchase_order_items WHERE purchase_order_id = ?');
    $stmt->execute([$poId]);
    $subtotal = (float) $stmt->fetchColumn();
    if ($desconto === null) {
        $stmt = $pdo->prepare('SELECT COALESCE(desconto,0) FROM purchase_orders WHERE id = ?');
        $stmt->execute([$poId]);
        $desconto = (float) $stmt->fetchColumn();
    }
    $total = max(0, round($subtotal - $desconto, 2));
    $fields = ['amount' => $total, 'desconto' => round($desconto, 2)];
    if ($condicoes !== null) {
        $fields['condicoes_pagamento'] = $condicoes;
    }
    update_dynamic($pdo, 'purchase_orders', $poId, $fields);
}

function poi_order_summary(PDO $pdo, int $poId): array
{
    $items = poi_list($pdo, $poId);
    $subtotal = array_sum(array_map(static fn ($i) => (float) ($i['valor_total'] ?? 0), $items));
    $stmt = $pdo->prepare('SELECT amount, desconto, condicoes_pagamento FROM purchase_orders WHERE id = ?');
    $stmt->execute([$poId]);
    $po = $stmt->fetch() ?: [];
    return [
        'items' => $items,
        'subtotal' => round($subtotal, 2),
        'desconto' => (float) ($po['desconto'] ?? 0),
        'total' => (float) ($po['amount'] ?? 0),
        'condicoes_pagamento' => $po['condicoes_pagamento'] ?? null,
    ];
}

// Ao RECEBER o pedido: soma a quantidade dos itens vinculados em quantidade_realizada.
function automate_received_purchase_order(PDO $pdo, int $poId): array
{
    if (!resolve_existing_table($pdo, ['purchase_order_items'], false) || !resolve_existing_table($pdo, ['orcamento_obra_itens'], false)) {
        return ['updated' => 0];
    }
    if (!in_array('quantidade_realizada', table_columns($pdo, 'orcamento_obra_itens'), true)) {
        return ['updated' => 0];
    }
    $stmt = $pdo->prepare('SELECT work_budget_item_id, quantidade FROM purchase_order_items WHERE purchase_order_id = ? AND work_budget_item_id IS NOT NULL');
    $stmt->execute([$poId]);
    $rows = $stmt->fetchAll();
    $updated = 0;
    $sel = $pdo->prepare('SELECT quantidade_realizada FROM orcamento_obra_itens WHERE id = ? LIMIT 1');
    $upd = $pdo->prepare('UPDATE orcamento_obra_itens SET quantidade_realizada = COALESCE(quantidade_realizada,0) + ? WHERE id = ?');
    foreach ($rows as $row) {
        $biId = (int) ($row['work_budget_item_id'] ?? 0);
        if ($biId <= 0) {
            continue;
        }
        $sel->execute([$biId]);
        $anterior = (float) ($sel->fetchColumn() ?: 0);
        $qtd = (float) $row['quantidade'];
        $upd->execute([$qtd, $biId]);
        log_budget_execution($pdo, $biId, $anterior, $anterior + $qtd, 'pedido_compra', 'Recebimento do pedido #' . $poId, null);
        $updated++;
    }
    log_automation_event($pdo, 'PEDIDO_RECEBIDO', 'purchase_orders', $poId, 'orcamento_obra_itens', null, 'OK', $updated . ' item(ns) do orçamento atualizados.', null);
    return ['updated' => $updated];
}

function handle_work_budget_execution_module(PDO $pdo, string $method, array $query, array $authUser): never
{
    if (!resolve_existing_table($pdo, ['orcamento_item_execucao_log'], false)) {
        ensure_budget_execution_log($pdo);
    }
    $action = strtolower(trim((string) ($query['action'] ?? '')));
    try {
        if ($action === 'history') {
            require_method($method, ['GET']);
            $itemId = (int) ($query['itemId'] ?? $query['item_id'] ?? 0);
            if ($itemId <= 0) {
                wbe_respond(true, []);
            }
            $stmt = $pdo->prepare('SELECT * FROM orcamento_item_execucao_log WHERE item_id = ? ORDER BY id DESC LIMIT 50');
            $stmt->execute([$itemId]);
            wbe_respond(true, $stmt->fetchAll());
        }
        if ($action === 'update') {
            require_method($method, ['POST', 'PUT', 'PATCH']);
            $payload = read_json();
            $itemId = (int) ($payload['itemId'] ?? $payload['item_id'] ?? $query['id'] ?? 0);
            if ($itemId <= 0) {
                wbe_respond(false, [], 'Informe o item do orçamento.', 400);
            }
            $nova = max(0, round((float) ($payload['quantidade_realizada'] ?? 0), 4));
            $motivo = mb_substr(trim((string) ($payload['motivo'] ?? '')), 0, 255);
            $stmt = $pdo->prepare('SELECT quantidade_realizada FROM orcamento_obra_itens WHERE id = ? LIMIT 1');
            $stmt->execute([$itemId]);
            $current = $stmt->fetch();
            if (!$current) {
                wbe_respond(false, [], 'Item do orçamento não encontrado.', 404);
            }
            $anterior = (float) ($current['quantidade_realizada'] ?? 0);
            update_dynamic($pdo, 'orcamento_obra_itens', $itemId, ['quantidade_realizada' => $nova]);
            log_budget_execution($pdo, $itemId, $anterior, $nova, 'manual', $motivo !== '' ? $motivo : null, payable_user_id($authUser));
            server_audit($pdo, $authUser, 'update', 'workBudgetItems', $itemId, 'Qtd. realizada: ' . $anterior . ' → ' . $nova);
            wbe_respond(true, ['itemId' => $itemId, 'quantidade_realizada' => $nova], 'Execução atualizada.');
        }
        wbe_respond(false, [], 'Ação de execução inválida.', 400);
    } catch (Throwable $e) {
        error_log('[ObraSync execucao] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
        wbe_respond(false, [], 'Erro ao atualizar a execução do orçamento.', 500);
    }
}

function wbe_respond(bool $success, mixed $data = [], string $message = '', int $status = 200): never
{
    http_response_code($status);
    echo json_encode(['success' => $success, 'data' => $data, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Resumo de execução das obras ativas para o Dashboard.
function handle_dashboard_execution_module(PDO $pdo, string $method, array $query): never
{
    require_method($method, ['GET']);
    try {
        $obras = [];
        $estouros = [];
        $totPrev = 0.0;
        $totReal = 0.0;
        $ready = resolve_existing_table($pdo, ['orcamento_obra_itens'], false)
            && in_array('quantidade_realizada', table_columns($pdo, 'orcamento_obra_itens'), true);
        if ($ready) {
            $sql = "SELECT p.id, p.name,
                        COALESCE(SUM(i.totalPrice),0) AS previsto,
                        COALESCE(SUM(i.quantidade_realizada * i.unitPrice),0) AS realizado,
                        COALESCE(SUM(CASE WHEN i.quantidade_realizada > i.quantity THEN 1 ELSE 0 END),0) AS itens_estouro
                    FROM projects p
                    JOIN orcamento_obra_itens i ON i.projectId = p.id
                    WHERE p.status = 'Em andamento'
                    GROUP BY p.id, p.name
                    ORDER BY p.name";
            foreach ($pdo->query($sql)->fetchAll() as $row) {
                $prev = (float) $row['previsto'];
                $real = (float) $row['realizado'];
                $totPrev += $prev;
                $totReal += $real;
                $obras[] = [
                    'id' => (int) $row['id'],
                    'name' => (string) $row['name'],
                    'previsto' => round($prev, 2),
                    'realizado' => round($real, 2),
                    'percentual' => $prev > 0 ? round($real / $prev * 100, 2) : 0,
                    'estouro' => round(max(0, $real - $prev), 2),
                    'itens_estouro' => (int) $row['itens_estouro'],
                ];
            }

            $estSql = "SELECT i.id, i.projectId, p.name AS obra, i.description, i.quantity, i.quantidade_realizada,
                          (i.quantidade_realizada / NULLIF(i.quantity,0)) * 100 AS percentual
                       FROM orcamento_obra_itens i
                       JOIN projects p ON p.id = i.projectId
                       WHERE p.status = 'Em andamento' AND i.quantidade_realizada > i.quantity
                       ORDER BY percentual DESC
                       LIMIT 200";
            foreach ($pdo->query($estSql)->fetchAll() as $row) {
                $estouros[] = [
                    'id' => (int) $row['id'],
                    'projectId' => (int) $row['projectId'],
                    'obra' => (string) $row['obra'],
                    'item' => (string) $row['description'],
                    'quantity' => (float) $row['quantity'],
                    'quantidade_realizada' => (float) $row['quantidade_realizada'],
                    'percentual' => round((float) $row['percentual'], 2),
                ];
            }
        }
        wbe_respond(true, [
            'obras' => $obras,
            'estouros' => $estouros,
            'totais' => [
                'previsto' => round($totPrev, 2),
                'realizado' => round($totReal, 2),
                'saldo' => round($totPrev - $totReal, 2),
                'percentual' => $totPrev > 0 ? round($totReal / $totPrev * 100, 2) : 0,
                'itens_estouro' => count($estouros),
            ],
        ]);
    } catch (Throwable $e) {
        error_log('[ObraSync dashboardExecution] ' . $e->getMessage());
        wbe_respond(false, [], 'Erro ao calcular a execução das obras.', 500);
    }
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

// ── Qualidade PBQP-H Nível B ─────────────────────────────────────────────────
// Os 27 serviços de execução controlados do SiAC (espelho de SERVICOS_SIAC no app.js).
function servicos_siac(): array
{
    return [
        1 => ['grupo' => 'Preliminares', 'nome' => 'Compactação de aterro'],
        2 => ['grupo' => 'Preliminares', 'nome' => 'Locação de obra'],
        3 => ['grupo' => 'Fundações', 'nome' => 'Execução de fundação'],
        4 => ['grupo' => 'Estrutura', 'nome' => 'Execução de fôrma'],
        5 => ['grupo' => 'Estrutura', 'nome' => 'Montagem de armadura'],
        6 => ['grupo' => 'Estrutura', 'nome' => 'Concretagem de peça estrutural'],
        7 => ['grupo' => 'Estrutura', 'nome' => 'Execução de alvenaria estrutural'],
        8 => ['grupo' => 'Vedações Verticais', 'nome' => 'Alvenaria não estrutural e divisória leve'],
        9 => ['grupo' => 'Vedações Verticais', 'nome' => 'Revestimento interno área seca'],
        10 => ['grupo' => 'Vedações Verticais', 'nome' => 'Revestimento interno área úmida'],
        11 => ['grupo' => 'Vedações Verticais', 'nome' => 'Revestimento externo'],
        12 => ['grupo' => 'Vedações Horizontais', 'nome' => 'Execução de contrapiso'],
        13 => ['grupo' => 'Vedações Horizontais', 'nome' => 'Revestimento piso interno área seca'],
        14 => ['grupo' => 'Vedações Horizontais', 'nome' => 'Revestimento piso interno área úmida'],
        15 => ['grupo' => 'Vedações Horizontais', 'nome' => 'Revestimento piso externo'],
        16 => ['grupo' => 'Vedações Horizontais', 'nome' => 'Execução de forro'],
        17 => ['grupo' => 'Vedações Horizontais', 'nome' => 'Execução de impermeabilização'],
        18 => ['grupo' => 'Vedações Horizontais', 'nome' => 'Cobertura em telhado (estrutura + telhamento)'],
        19 => ['grupo' => 'Esquadrias', 'nome' => 'Colocação de porta'],
        20 => ['grupo' => 'Esquadrias', 'nome' => 'Colocação de janela'],
        21 => ['grupo' => 'Esquadrias', 'nome' => 'Colocação de guarda-corpo'],
        22 => ['grupo' => 'Instalações', 'nome' => 'Instalação elétrica'],
        23 => ['grupo' => 'Instalações', 'nome' => 'Instalação hidrossanitária'],
        24 => ['grupo' => 'Instalações', 'nome' => 'Instalação de gás'],
        25 => ['grupo' => 'Instalações', 'nome' => 'Instalação de SPDA'],
        26 => ['grupo' => 'Acabamentos', 'nome' => 'Pintura interna'],
        27 => ['grupo' => 'Acabamentos', 'nome' => 'Pintura externa'],
    ];
}

// Tabelas do módulo de qualidade criadas sob demanda (padrão de viabilityAnalyses
// e plugins — dispensa migration manual). Campos de listas usam LONGTEXT com JSON
// serializado pelo frontend: o tipo JSON do MariaDB recusaria string vazia.
function ensure_qualidade_tables(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $charset = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $pdo->exec("CREATE TABLE IF NOT EXISTS qualidade_politica (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        conteudo TEXT NOT NULL,
        versao VARCHAR(20) NOT NULL DEFAULT '1.0',
        aprovadoPor VARCHAR(120) NULL,
        dataAprovacao DATE NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Rascunho',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
    ) {$charset}");
    $pdo->exec("CREATE TABLE IF NOT EXISTS qualidade_pes (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        servicoSiacId TINYINT UNSIGNED NOT NULL,
        servicoNome VARCHAR(200) NOT NULL,
        servicoGrupo VARCHAR(100) NOT NULL DEFAULT '',
        versao VARCHAR(20) NOT NULL DEFAULT '1.0',
        objetivo TEXT NULL,
        materiaisNecessarios TEXT NULL,
        equipamentosEpi TEXT NULL,
        procedimento LONGTEXT NULL,
        criteriosAceitacao TEXT NULL,
        normasReferencia VARCHAR(500) NULL,
        responsavelElaboracao VARCHAR(120) NULL,
        dataElaboracao DATE NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Rascunho',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_pes_servico (servicoSiacId)
    ) {$charset}");
    $pdo->exec("CREATE TABLE IF NOT EXISTS qualidade_pqo (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        projectId BIGINT UNSIGNED NOT NULL,
        versao VARCHAR(20) NOT NULL DEFAULT '1.0',
        responsavelTecnico VARCHAR(120) NULL,
        crea VARCHAR(60) NULL,
        dataInicioPrevisto DATE NULL,
        dataFimPrevisto DATE NULL,
        escopo TEXT NULL,
        servicosControlados LONGTEXT NULL,
        materiaisControlados LONGTEXT NULL,
        metasQualidade TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Rascunho',
        dataAprovacao DATE NULL,
        aprovadoPor VARCHAR(120) NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_pqo_project (projectId)
    ) {$charset}");
    $pdo->exec("CREATE TABLE IF NOT EXISTS qualidade_fvs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        pqoId BIGINT UNSIGNED NULL,
        projectId BIGINT UNSIGNED NOT NULL,
        etapaId BIGINT UNSIGNED NULL,
        pesId BIGINT UNSIGNED NULL,
        servicoSiacId TINYINT UNSIGNED NOT NULL,
        servicoNome VARCHAR(200) NOT NULL DEFAULT '',
        dataExecucao DATE NULL,
        localObra VARCHAR(200) NULL,
        responsavelExecucao VARCHAR(120) NULL,
        responsavelInspecao VARCHAR(120) NULL,
        itensVerificacao LONGTEXT NULL,
        resultado VARCHAR(30) NULL,
        observacoes TEXT NULL,
        acaoCorretiva TEXT NULL,
        dataInspecao DATE NULL,
        assinaturaExecutor VARCHAR(120) NULL,
        assinaturaInspetor VARCHAR(120) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pendente',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_fvs_project (projectId),
        KEY idx_fvs_etapa (etapaId)
    ) {$charset}");
    $pdo->exec("CREATE TABLE IF NOT EXISTS qualidade_fvm (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        pqoId BIGINT UNSIGNED NULL,
        projectId BIGINT UNSIGNED NOT NULL,
        materialNome VARCHAR(200) NOT NULL,
        materialCodigo VARCHAR(80) NULL,
        fornecedor VARCHAR(200) NULL,
        notaFiscal VARCHAR(80) NULL,
        quantidade DECIMAL(14,3) NULL,
        unidade VARCHAR(40) NULL,
        dataRecebimento DATE NULL,
        responsavelRecebimento VARCHAR(120) NULL,
        itensVerificacao LONGTEXT NULL,
        resultado VARCHAR(30) NULL,
        observacoes TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pendente',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_fvm_project (projectId)
    ) {$charset}");
    $pdo->exec("CREATE TABLE IF NOT EXISTS qualidade_nc (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        projectId BIGINT UNSIGNED NOT NULL,
        pqoId BIGINT UNSIGNED NULL,
        numero VARCHAR(20) NOT NULL,
        origem VARCHAR(20) NOT NULL DEFAULT 'Manual',
        fvsId BIGINT UNSIGNED NULL,
        fvmId BIGINT UNSIGNED NULL,
        descricaoNC TEXT NOT NULL,
        servicoSiacId TINYINT UNSIGNED NULL,
        servicoNome VARCHAR(200) NULL,
        localObra VARCHAR(200) NULL,
        grau VARCHAR(20) NOT NULL DEFAULT 'Menor',
        responsavelDeteccao VARCHAR(120) NULL,
        dataDeteccao DATE NOT NULL,
        prazoAcao DATE NULL,
        acaoCorretiva TEXT NULL,
        responsavelAcao VARCHAR(120) NULL,
        dataAcao DATE NULL,
        verificacaoEficacia TEXT NULL,
        responsavelVerificacao VARCHAR(120) NULL,
        dataVerificacao DATE NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Aberta',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_nc_numero (numero),
        KEY idx_nc_project (projectId),
        KEY idx_nc_status (status)
    ) {$charset}");
    $pdo->exec("CREATE TABLE IF NOT EXISTS qualidade_treinamentos (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        projectId BIGINT UNSIGNED NOT NULL,
        pqoId BIGINT UNSIGNED NULL,
        servicoSiacId TINYINT UNSIGNED NOT NULL,
        servicoNome VARCHAR(200) NULL,
        dataTreinamento DATE NOT NULL,
        instrutor VARCHAR(120) NULL,
        participantes TEXT NULL,
        conteudo TEXT NULL,
        cargaHoraria DECIMAL(5,1) NULL,
        observacoes TEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_treino_project (projectId)
    ) {$charset}");
    $pdo->exec("CREATE TABLE IF NOT EXISTS qualidade_auditorias (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        projectId BIGINT UNSIGNED NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'Obra',
        dataAuditoria DATE NOT NULL,
        auditor VARCHAR(120) NULL,
        escopo TEXT NULL,
        checklistSiac LONGTEXT NULL,
        totalItens INT NOT NULL DEFAULT 0,
        itensConformes INT NOT NULL DEFAULT 0,
        ncsAbertas INT NOT NULL DEFAULT 0,
        resultado VARCHAR(30) NULL,
        relatorioTexto TEXT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Agendada',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_audit_project (projectId)
    ) {$charset}");
    // Vínculo do cronograma com a qualidade: etapa de serviço controlado fica
    // bloqueada para conclusão até a FVS ser aprovada e as NCs fechadas.
    try {
        $pdo->exec('ALTER TABLE obra_cronograma_etapas
            ADD COLUMN IF NOT EXISTS servicoSiacId TINYINT UNSIGNED NULL,
            ADD COLUMN IF NOT EXISTS fvsId BIGINT UNSIGNED NULL,
            ADD COLUMN IF NOT EXISTS qualidadeBloqueada TINYINT(1) NOT NULL DEFAULT 0');
    } catch (Throwable $error) {
        // Sem permissão de DDL ou MariaDB antigo sem IF NOT EXISTS: segue sem o vínculo.
    }
    $done = true;
}

// Regras de integridade do SGQ aplicadas no SERVIDOR (não confiar só no frontend,
// inclusive por exigência de registros controlados do SiAC 7.5): FVS concluída
// exige assinaturas e itens; NC só fecha com ação corretiva + verificação de
// eficácia, e nunca pelo perfil operador.
function qualidade_validar_payload(PDO $pdo, string $key, array $payload, ?array $previous, array $authUser): void
{
    $merged = array_merge($previous ?? [], normalize_payload_aliases($payload));
    if ($key === 'qualidadeFvs') {
        $status = (string) ($merged['status'] ?? '');
        $resultado = (string) ($merged['resultado'] ?? '');
        if (in_array($status, ['Aprovada', 'Reprovada'], true) || $resultado !== '') {
            if (trim((string) ($merged['assinaturaExecutor'] ?? '')) === '' || trim((string) ($merged['assinaturaInspetor'] ?? '')) === '') {
                fail('As assinaturas do executor e do inspetor são obrigatórias para concluir a FVS.', 422);
            }
            $itensRaw = $merged['itensVerificacao'] ?? '[]';
            $itens = is_array($itensRaw) ? $itensRaw : (json_decode((string) $itensRaw, true) ?: []);
            if (!count($itens)) {
                fail('A FVS precisa dos itens de verificação gerados pelo PES vigente do serviço.', 422);
            }
            if ($resultado === 'Reprovado' && $status === 'Aprovada') {
                fail('FVS com resultado Reprovado não pode ficar com status Aprovada.', 422);
            }
            if (in_array($resultado, ['Aprovado', 'Aprovado com ressalvas'], true) && $status === 'Reprovada') {
                fail('FVS com resultado aprovado não pode ficar com status Reprovada.', 422);
            }
        }
    }
    if ($key === 'qualidadeNc' && (string) ($merged['status'] ?? '') === 'Fechada') {
        $jaFechada = $previous && ($previous['status'] ?? '') === 'Fechada';
        if (!$jaFechada) {
            if (($authUser['role'] ?? '') === 'operador') {
                fail('Operadores não podem fechar Não Conformidades — o fechamento exige gestor ou engenharia.', 403);
            }
            if (trim((string) ($merged['acaoCorretiva'] ?? '')) === '' || trim((string) ($merged['verificacaoEficacia'] ?? '')) === '') {
                fail('Para fechar a NC, informe a ação corretiva e a verificação de eficácia.', 422);
            }
        }
    }
}

// Criação de NC com retry: o sequencial NC-ANO-SEQ vem de MAX+1 e duas criações
// simultâneas podem colidir no UNIQUE — regenera o número e tenta de novo.
function qualidade_criar_nc_registro(PDO $pdo, array $meta, array $payload): array
{
    $numeroInformado = (string) (normalize_payload_aliases($payload)['numero'] ?? '');
    for ($attempt = 0; $attempt < 3; $attempt++) {
        if ($numeroInformado === '') {
            $payload['numero'] = qualidade_proximo_numero_nc($pdo);
        }
        try {
            return create_record($pdo, $meta, $payload);
        } catch (PDOException $error) {
            if ($numeroInformado === '' && (int) ($error->errorInfo[1] ?? 0) === 1062 && $attempt < 2) {
                continue;
            }
            throw $error;
        }
    }
    fail('Não foi possível gerar o número da NC. Tente novamente.', 500);
}

function qualidade_proximo_numero_nc(PDO $pdo): string
{
    $ano = date('Y');
    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING_INDEX(numero, '-', -1) AS UNSIGNED)) FROM qualidade_nc WHERE numero LIKE ?");
    $stmt->execute(["NC-{$ano}-%"]);
    $ultimo = (int) $stmt->fetchColumn();
    return 'NC-' . $ano . '-' . str_pad((string) ($ultimo + 1), 3, '0', STR_PAD_LEFT);
}

function criar_nc_automatica(PDO $pdo, int $projectId, ?int $pqoId, string $origem, ?int $fvsId, ?int $fvmId, string $descricao, ?int $servicoSiacId, ?string $servicoNome, ?string $localObra): string
{
    if ($servicoSiacId && !$servicoNome) {
        $servicoNome = servicos_siac()[$servicoSiacId]['nome'] ?? null;
    }
    // Retry contra corrida no sequencial (mesma proteção de qualidade_criar_nc_registro).
    $numero = '';
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $numero = qualidade_proximo_numero_nc($pdo);
        try {
            $pdo->prepare("INSERT INTO qualidade_nc
                    (projectId, pqoId, numero, origem, fvsId, fvmId, descricaoNC, servicoSiacId, servicoNome, localObra, grau, dataDeteccao, status)
                VALUES (?,?,?,?,?,?,?,?,?,?,'Menor',CURDATE(),'Aberta')")
                ->execute([$projectId, $pqoId, $numero, $origem, $fvsId, $fvmId, $descricao, $servicoSiacId, $servicoNome, $localObra]);
            break;
        } catch (PDOException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) === 1062 && $attempt < 2) {
                continue;
            }
            throw $error;
        }
    }
    if ($fvsId) {
        $stmt = $pdo->prepare('SELECT etapaId FROM qualidade_fvs WHERE id = ?');
        $stmt->execute([$fvsId]);
        $etapaId = (int) $stmt->fetchColumn();
        if ($etapaId) {
            $pdo->prepare('UPDATE obra_cronograma_etapas SET qualidadeBloqueada = 1 WHERE id = ?')->execute([$etapaId]);
        }
    }
    return $numero;
}

// Bloqueio de conclusão de etapa de serviço controlado: sem FVS aprovada (e sem
// NC aberta vinculada), a etapa não pode ser marcada como concluída.
function qualidade_bloqueio_etapa(PDO $pdo, int $etapaId, array $payload): ?string
{
    $concluindo = (($payload['status'] ?? '') === 'Concluída') || !empty($payload['actualEndDate']);
    if (!$concluindo) {
        return null;
    }
    try {
        $stmt = $pdo->prepare('SELECT servicoSiacId FROM obra_cronograma_etapas WHERE id = ?');
        $stmt->execute([$etapaId]);
        $servicoSiacId = $stmt->fetchColumn();
    } catch (PDOException $error) {
        return null; // colunas de qualidade ausentes (sem DDL): não bloqueia
    }
    if (!$servicoSiacId) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT id, status FROM qualidade_fvs WHERE etapaId = ? ORDER BY id DESC LIMIT 1');
    $stmt->execute([$etapaId]);
    $fvs = $stmt->fetch();
    if (!$fvs) {
        return 'Esta etapa é de serviço controlado PBQP-H e requer FVS preenchida e aprovada para ser concluída.';
    }
    if ($fvs['status'] !== 'Aprovada') {
        return 'A FVS desta etapa ainda não foi aprovada. Aprove a Ficha de Verificação de Serviço antes de concluir.';
    }
    $stmt = $pdo->prepare("SELECT numero FROM qualidade_nc WHERE fvsId = ? AND status <> 'Fechada' LIMIT 1");
    $stmt->execute([(int) $fvs['id']]);
    $numero = $stmt->fetchColumn();
    if ($numero) {
        return "A Não Conformidade {$numero} vinculada à FVS desta etapa está aberta. Resolva a NC antes de concluir.";
    }
    $pdo->prepare('UPDATE obra_cronograma_etapas SET qualidadeBloqueada = 0 WHERE id = ?')->execute([$etapaId]);
    return null;
}

// Automações após gravar registros de qualidade. Devolve o registro atualizado
// (ou null quando nada mudou) e anota em $record['automation'] o que foi feito.
function qualidade_pos_gravacao(PDO $pdo, string $key, array $record, ?array $previous): ?array
{
    $id = (int) ($record['id'] ?? 0);
    $notes = [];

    // Apenas um documento Vigente por vez (política da empresa e PES por serviço).
    if ($key === 'qualidadePolitica' && ($record['status'] ?? '') === 'Vigente') {
        $pdo->prepare("UPDATE qualidade_politica SET status = 'Obsoleto' WHERE id <> ? AND status = 'Vigente'")->execute([$id]);
    }
    if ($key === 'qualidadePes' && ($record['status'] ?? '') === 'Vigente') {
        $stmt = $pdo->prepare("UPDATE qualidade_pes SET status = 'Obsoleto' WHERE servicoSiacId = ? AND id <> ? AND status = 'Vigente'");
        $stmt->execute([(int) $record['servicoSiacId'], $id]);
        if ($stmt->rowCount() > 0) {
            $notes[] = 'Versões anteriores do PES deste serviço marcadas como obsoletas.';
        }
    }

    if ($key === 'qualidadeFvs') {
        $etapaId = (int) ($record['etapaId'] ?? 0);
        if ($etapaId) {
            // Marca a etapa como serviço controlado e guarda o vínculo da FVS.
            try {
                $pdo->prepare('UPDATE obra_cronograma_etapas SET fvsId = ?, servicoSiacId = COALESCE(servicoSiacId, ?) WHERE id = ?')
                    ->execute([$id, (int) $record['servicoSiacId'], $etapaId]);
            } catch (PDOException $error) {
                // Colunas de qualidade ausentes: segue sem vínculo de cronograma.
            }
        }
        $reprovada = ($record['resultado'] ?? '') === 'Reprovado' || ($record['status'] ?? '') === 'Reprovada';
        if ($reprovada) {
            $stmt = $pdo->prepare("SELECT numero FROM qualidade_nc WHERE fvsId = ? AND status <> 'Fechada' LIMIT 1");
            $stmt->execute([$id]);
            $existente = $stmt->fetchColumn();
            if (!$existente) {
                $numero = criar_nc_automatica($pdo, (int) $record['projectId'], (int) ($record['pqoId'] ?? 0) ?: null, 'FVS', $id, null,
                    'FVS reprovada: ' . ($record['servicoNome'] ?? '') . ' — ' . ($record['localObra'] ?? ''), (int) $record['servicoSiacId'], $record['servicoNome'] ?? null, $record['localObra'] ?? null);
                $notes[] = "Não Conformidade {$numero} criada automaticamente pela FVS reprovada.";
            } elseif ($etapaId) {
                $pdo->prepare('UPDATE obra_cronograma_etapas SET qualidadeBloqueada = 1 WHERE id = ?')->execute([$etapaId]);
            }
        } elseif (($record['status'] ?? '') === 'Aprovada' && $etapaId) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM qualidade_nc WHERE fvsId = ? AND status <> 'Fechada'");
            $stmt->execute([$id]);
            if ((int) $stmt->fetchColumn() === 0) {
                $pdo->prepare('UPDATE obra_cronograma_etapas SET qualidadeBloqueada = 0 WHERE id = ?')->execute([$etapaId]);
                $notes[] = 'Etapa do cronograma desbloqueada pela FVS aprovada.';
            }
        }
    }

    if ($key === 'qualidadeFvm') {
        $reprovada = ($record['resultado'] ?? '') === 'Reprovado' || ($record['status'] ?? '') === 'Reprovada';
        if ($reprovada) {
            $stmt = $pdo->prepare("SELECT numero FROM qualidade_nc WHERE fvmId = ? AND status <> 'Fechada' LIMIT 1");
            $stmt->execute([$id]);
            if (!$stmt->fetchColumn()) {
                $numero = criar_nc_automatica($pdo, (int) $record['projectId'], (int) ($record['pqoId'] ?? 0) ?: null, 'FVM', null, $id,
                    'FVM reprovada: ' . ($record['materialNome'] ?? '') . ' — NF ' . ($record['notaFiscal'] ?? ''), null, null, null);
                $notes[] = "Não Conformidade {$numero} criada automaticamente pela FVM reprovada.";
            }
        }
    }

    if ($key === 'qualidadeNc' && ($record['status'] ?? '') === 'Fechada' && !empty($record['fvsId'])) {
        $stmt = $pdo->prepare('SELECT etapaId, status FROM qualidade_fvs WHERE id = ?');
        $stmt->execute([(int) $record['fvsId']]);
        $fvs = $stmt->fetch();
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM qualidade_nc WHERE fvsId = ? AND status <> 'Fechada'");
        $stmt->execute([(int) $record['fvsId']]);
        if ($fvs && !empty($fvs['etapaId']) && $fvs['status'] === 'Aprovada' && (int) $stmt->fetchColumn() === 0) {
            $pdo->prepare('UPDATE obra_cronograma_etapas SET qualidadeBloqueada = 0 WHERE id = ?')->execute([(int) $fvs['etapaId']]);
            $notes[] = 'Etapa do cronograma desbloqueada com o fechamento da NC.';
        }
    }

    if ($key === 'qualidadeAuditorias') {
        $itens = json_decode((string) ($record['checklistSiac'] ?? '[]'), true) ?: [];
        $avaliados = array_filter($itens, static fn ($item) => in_array($item['resultado'] ?? '', ['Conforme', 'Não Conforme'], true));
        $conformes = array_filter($avaliados, static fn ($item) => ($item['resultado'] ?? '') === 'Conforme');
        $naoConformes = array_filter($avaliados, static fn ($item) => ($item['resultado'] ?? '') === 'Não Conforme');
        $percent = count($avaliados) ? (count($conformes) / count($avaliados)) * 100 : 0;
        $resultado = !count($avaliados) ? null : (count($naoConformes) === 0 ? 'Conforme' : ($percent >= 70 ? 'Conforme com Ressalvas' : 'Nao Conforme'));
        // NCs por item não conforme só na transição para Realizada (evita duplicar a cada edição).
        $virouRealizada = in_array($record['status'] ?? '', ['Realizada', 'Relatorio emitido'], true)
            && (!$previous || ($previous['status'] ?? 'Agendada') === 'Agendada');
        $ncsCriadas = 0;
        if ($virouRealizada && !empty($record['projectId'])) {
            foreach ($naoConformes as $item) {
                criar_nc_automatica($pdo, (int) $record['projectId'], null, 'Auditoria', null, null,
                    'Auditoria SiAC ' . ($record['dataAuditoria'] ?? '') . ' — cláusula ' . ($item['clausula'] ?? '') . ': ' . ($item['desc'] ?? '') . (!empty($item['observacao']) ? ' — ' . $item['observacao'] : ''),
                    null, null, null);
                $ncsCriadas++;
            }
            if ($ncsCriadas) {
                $notes[] = "{$ncsCriadas} NC(s) criada(s) automaticamente pelos itens não conformes da auditoria.";
            }
        }
        $pdo->prepare('UPDATE qualidade_auditorias SET totalItens = ?, itensConformes = ?, ncsAbertas = ncsAbertas + ?, resultado = ? WHERE id = ?')
            ->execute([count($avaliados), count($conformes), $ncsCriadas, $resultado, $id]);
        $record['totalItens'] = count($avaliados);
        $record['itensConformes'] = count($conformes);
        $record['resultado'] = $resultado;
    }

    if ($notes) {
        $record['automation'] = implode(' ', $notes);
        return $record;
    }
    return null;
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

// ── Estudos do plugin de Seletividade ────────────────────────────────────────
// Tabela criada sob demanda (padrão de viabilityAnalyses/plugins). O formulário
// inteiro viaja como JSON em dadosJson; calcJson guarda o último resultado só
// para histórico — ao carregar, o plugin recalcula do zero a partir dos campos.
function ensure_seletividade_table(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS seletividade_estudos (
            id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            userId    BIGINT UNSIGNED NOT NULL,
            nome      VARCHAR(200) NOT NULL COMMENT 'Nome do projeto/estudo',
            dadosJson LONGTEXT NOT NULL COMMENT 'Todos os campos do formulário em JSON',
            calcJson  LONGTEXT NULL COMMENT 'Resultado do último cálculo em JSON',
            updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_sel_user (userId),
            KEY idx_sel_nome (nome)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $done = true;
}

// CRUD dos estudos, sempre no escopo do usuário autenticado (userId em todo
// WHERE): um usuário não lista, lê, sobrescreve nem exclui estudo de outro.
function handle_seletividade_estudos(PDO $pdo, array $authUser, string $method, ?int $id): never
{
    ensure_seletividade_table($pdo);
    $userId = (int) $authUser['id'];

    if ($method === 'GET' && $id === null) {
        $stmt = $pdo->prepare(
            'SELECT id, nome, createdAt, updatedAt FROM seletividade_estudos
              WHERE userId = ? ORDER BY updatedAt DESC, createdAt DESC'
        );
        $stmt->execute([$userId]);
        respond(['ok' => true, 'success' => true, 'data' => $stmt->fetchAll()]);
    }

    if ($method === 'GET') {
        $stmt = $pdo->prepare('SELECT * FROM seletividade_estudos WHERE id = ? AND userId = ? LIMIT 1');
        $stmt->execute([$id, $userId]);
        $row = $stmt->fetch();
        if (!$row) {
            fail('Estudo não encontrado.', 404);
        }
        respond(['ok' => true, 'success' => true, 'data' => $row]);
    }

    if (in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
        $payload = read_json();
        $editId = $id ?? (int) ($payload['id'] ?? 0);
        $nome = mb_substr(trim((string) ($payload['nome'] ?? '')), 0, 200);
        $dadosJson = trim((string) ($payload['dadosJson'] ?? ''));
        $calcJson = trim((string) ($payload['calcJson'] ?? ''));
        if ($nome === '') {
            fail('Informe o nome do estudo.', 400);
        }
        if ($dadosJson === '' || json_decode($dadosJson) === null) {
            fail('Dados do formulário ausentes ou inválidos.', 400);
        }
        if ($calcJson !== '' && json_decode($calcJson) === null) {
            fail('Resultado do cálculo inválido.', 400);
        }

        if ($editId) {
            $check = $pdo->prepare('SELECT id FROM seletividade_estudos WHERE id = ? AND userId = ? LIMIT 1');
            $check->execute([$editId, $userId]);
            if (!$check->fetchColumn()) {
                fail('Estudo não encontrado.', 404);
            }
            $pdo->prepare(
                'UPDATE seletividade_estudos SET nome = ?, dadosJson = ?, calcJson = ?, updatedAt = NOW()
                  WHERE id = ? AND userId = ?'
            )->execute([$nome, $dadosJson, $calcJson !== '' ? $calcJson : null, $editId, $userId]);
            server_audit($pdo, $authUser, 'update', 'seletividadeEstudos', $editId, $nome);
            respond(['ok' => true, 'success' => true, 'data' => ['id' => $editId, 'nome' => $nome], 'message' => 'Estudo atualizado.']);
        }

        $pdo->prepare('INSERT INTO seletividade_estudos (userId, nome, dadosJson, calcJson) VALUES (?, ?, ?, ?)')
            ->execute([$userId, $nome, $dadosJson, $calcJson !== '' ? $calcJson : null]);
        $newId = (int) $pdo->lastInsertId();
        server_audit($pdo, $authUser, 'create', 'seletividadeEstudos', $newId, $nome);
        respond(['ok' => true, 'success' => true, 'data' => ['id' => $newId, 'nome' => $nome], 'message' => 'Estudo salvo.'], 201);
    }

    if ($method === 'DELETE') {
        if (!$id) {
            fail('Informe o id do estudo.', 400);
        }
        $stmt = $pdo->prepare('DELETE FROM seletividade_estudos WHERE id = ? AND userId = ?');
        $stmt->execute([$id, $userId]);
        if ($stmt->rowCount() === 0) {
            fail('Estudo não encontrado.', 404);
        }
        server_audit($pdo, $authUser, 'delete', 'seletividadeEstudos', $id);
        respond(['ok' => true, 'success' => true, 'message' => 'Estudo excluído.']);
    }

    fail('Método não permitido.', 405);
}

// ── Importação de extrato OFX ────────────────────────────────────────────────
// Tabelas de controle criadas sob demanda: ofx_fitids garante que cada FITID
// (id único da transação no banco emissor) entre uma única vez POR CONTA, e
// ofx_imports guarda o histórico de arquivos importados.
function ensure_ofx_tables(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS ofx_fitids (
            id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            fitid         VARCHAR(100)    NOT NULL,
            bankAccountId BIGINT UNSIGNED NOT NULL,
            cashMoveId    BIGINT UNSIGNED NULL COMMENT 'ID em cash_bank_movements',
            importedAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_fitid_account (fitid, bankAccountId),
            KEY idx_ofx_account (bankAccountId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS ofx_imports (
            id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            bankAccountId   BIGINT UNSIGNED NOT NULL,
            bankAccountName VARCHAR(140)    NOT NULL,
            fileName        VARCHAR(300)    NOT NULL,
            dateStart       DATE            NULL,
            dateEnd         DATE            NULL,
            totalRecords    INT             NOT NULL DEFAULT 0,
            imported        INT             NOT NULL DEFAULT 0,
            skipped         INT             NOT NULL DEFAULT 0,
            importedBy      BIGINT UNSIGNED NULL,
            importedAt      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_ofx_import_account (bankAccountId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    // Vínculo OFX nas contas a pagar/receber: ofxFitid evita dupla contagem
    // (a mesma transação do extrato baixando duas contas) e permite rastrear
    // qual linha do extrato quitou cada título. Sob demanda, sem migration
    // manual; sem permissão de DDL o match continua funcionando via try/catch.
    try {
        $pdo->exec('ALTER TABLE accounts_payable
            ADD COLUMN IF NOT EXISTS ofxFitid VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS ofxImportId BIGINT UNSIGNED NULL,
            ADD INDEX IF NOT EXISTS idx_pay_fitid (ofxFitid)');
        $pdo->exec('ALTER TABLE accounts_receivable
            ADD COLUMN IF NOT EXISTS ofxFitid VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS ofxImportId BIGINT UNSIGNED NULL,
            ADD INDEX IF NOT EXISTS idx_rec_fitid (ofxFitid)');
    } catch (Throwable $error) {
        error_log('[ObraSync OFX] ensure colunas de vínculo: ' . $error->getMessage());
    }
    // NFS-e: Obra/Projeto opcional em notas fiscais — um lote pode conter NFs de
    // obras diferentes ou sem obra. Torna projectId nullable só se ainda for
    // NOT NULL (idempotente, sem DDL desnecessário a cada boot).
    try {
        $nullable = $pdo->query(
            "SELECT IS_NULLABLE FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiscal_documents'
                AND COLUMN_NAME = 'projectId'"
        )->fetchColumn();
        if ($nullable === 'NO') {
            $pdo->exec('ALTER TABLE fiscal_documents MODIFY COLUMN projectId BIGINT UNSIGNED NULL');
        }
    } catch (Throwable $error) {
        error_log('[ObraSync NFS-e] ensure projectId nullable: ' . $error->getMessage());
    }
    $done = true;
}

// Para uma transação do extrato, busca contas a pagar (Saída) ou a receber
// (Entrada) compatíveis: mesmo valor, vencimento a até ±5 dias e sem OFX já
// vinculado. Confiança decresce com a distância da data, título já baixado
// manualmente e conta bancária divergente.
function ofx_find_matches(PDO $pdo, array $transaction, string $bankName): array
{
    $amount = number_format(abs((float) ($transaction['amount'] ?? 0)), 2, '.', '');
    $date = (string) ($transaction['date'] ?? '');
    $isEntrada = ($transaction['type'] ?? '') === 'Entrada';
    $table = $isEntrada ? 'accounts_receivable' : 'accounts_payable';
    $dateField = $isEntrada ? 'receivedDate' : 'paidDate';
    $settledStatus = $isEntrada ? 'Recebido' : 'Pago';

    try {
        $stmt = $pdo->prepare(
            "SELECT id, document, dueDate, {$dateField} AS settledDate, amount, status, bankAccount, ofxFitid
               FROM {$table}
              WHERE amount = ?
                AND status <> 'Cancelado'
                AND ofxFitid IS NULL
                AND ABS(DATEDIFF(dueDate, ?)) <= 5
              ORDER BY ABS(DATEDIFF(dueDate, ?)) ASC
              LIMIT 5"
        );
        $stmt->execute([$amount, $date, $date]);
        $rows = $stmt->fetchAll();
    } catch (PDOException $error) {
        // Colunas de vínculo ausentes (sem DDL): match indisponível, importação segue.
        return [];
    }

    $matches = [];
    foreach ($rows as $row) {
        $daysDiff = (int) abs((strtotime($date) - strtotime((string) $row['dueDate'])) / 86400);
        $alreadyPaid = $row['status'] === $settledStatus;
        $confidence = 100;
        if ($daysDiff > 1) $confidence -= $daysDiff * 5;
        if ($alreadyPaid) $confidence -= 20;
        if ($bankName !== '' && !empty($row['bankAccount']) && $row['bankAccount'] !== $bankName) $confidence -= 15;
        $matches[] = [
            'table' => $table,
            'id' => (int) $row['id'],
            'document' => (string) $row['document'],
            'dueDate' => (string) $row['dueDate'],
            'amount' => (float) $row['amount'],
            'status' => (string) $row['status'],
            'alreadyPaid' => $alreadyPaid,
            'bankAccount' => (string) ($row['bankAccount'] ?? ''),
            'confidence' => max(0, $confidence),
            'daysDiff' => $daysDiff,
        ];
    }
    usort($matches, static fn ($a, $b) => $b['confidence'] <=> $a['confidence']);
    return $matches;
}

// Concilia UMA transação do extrato com um título: baixa a conta (status +
// data de pagamento/recebimento), grava o vínculo ofxFitid, cria o movimento
// de caixa e registra o FITID. Título já baixado manualmente é apenas
// VINCULADO (status e data preservados) — o movimento de caixa entra do mesmo
// jeito, pois a linha do extrato é real.
function handle_ofx_conciliar(PDO $pdo, array $authUser, array $payload): never
{
    ensure_ofx_tables($pdo);
    $fitid = mb_substr(trim((string) ($payload['fitid'] ?? '')), 0, 100);
    $table = (string) ($payload['table'] ?? '');
    $recordId = (int) ($payload['recordId'] ?? 0);
    $bankAccountId = (int) ($payload['bankAccountId'] ?? 0);
    $date = trim((string) ($payload['date'] ?? ''));
    $amount = round(abs((float) ($payload['amount'] ?? 0)), 2);
    $type = ($payload['type'] ?? '') === 'Entrada' ? 'Entrada' : 'Saída';
    $memo = trim((string) ($payload['memo'] ?? ''));

    if ($fitid === '' || !$recordId || !$bankAccountId) {
        fail('Dados incompletos para conciliação.', 400);
    }
    if (!in_array($table, ['accounts_payable', 'accounts_receivable'], true)) {
        fail('Tabela inválida.', 400);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $amount <= 0) {
        fail('Data ou valor da transação inválidos.', 400);
    }

    $stmt = $pdo->prepare('SELECT id, name FROM bank_accounts WHERE id = ? LIMIT 1');
    $stmt->execute([$bankAccountId]);
    $account = $stmt->fetch();
    if (!$account) {
        fail('Conta bancária não encontrada.', 404);
    }
    $bankName = (string) $account['name'];

    // FITID já registrado nesta conta = transação já entrou (importada ou conciliada).
    $stmt = $pdo->prepare('SELECT id FROM ofx_fitids WHERE fitid = ? AND bankAccountId = ? LIMIT 1');
    $stmt->execute([$fitid, $bankAccountId]);
    if ($stmt->fetchColumn()) {
        fail('Esta transação do extrato já foi importada ou conciliada.', 409);
    }

    $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ? LIMIT 1");
    $stmt->execute([$recordId]);
    $record = $stmt->fetch();
    if (!$record) {
        fail('Título não encontrado.', 404);
    }
    if (($record['status'] ?? '') === 'Cancelado') {
        fail('Título cancelado não pode ser conciliado.', 422);
    }
    if (!empty($record['ofxFitid'])) {
        fail('Este título já está vinculado a outra transação do extrato.', 409);
    }

    $isPayable = $table === 'accounts_payable';
    $settledStatus = $isPayable ? 'Pago' : 'Recebido';
    $dateField = $isPayable ? 'paidDate' : 'receivedDate';
    $alreadySettled = ($record['status'] ?? '') === $settledStatus;

    $pdo->beginTransaction();
    try {
        if ($alreadySettled) {
            // Baixado manualmente antes: só vincula o extrato, sem mexer em status/data.
            $pdo->prepare("UPDATE {$table} SET ofxFitid = ?, bankAccount = COALESCE(NULLIF(bankAccount, ''), ?) WHERE id = ?")
                ->execute([$fitid, $bankName, $recordId]);
        } else {
            $pdo->prepare("UPDATE {$table} SET status = ?, {$dateField} = ?, ofxFitid = ?, bankAccount = COALESCE(NULLIF(bankAccount, ''), ?) WHERE id = ?")
                ->execute([$settledStatus, $date, $fitid, $bankName, $recordId]);
        }

        $pdo->prepare(
            "INSERT INTO cash_bank_movements (`date`, bankAccount, `type`, history, amount, originDocument, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Confirmado')"
        )->execute([
            $date, $bankName, $type,
            $memo !== '' ? $memo : ('Conciliação OFX — ' . $record['document']),
            $amount,
            mb_substr('OFX:' . $fitid, 0, 100),
        ]);
        $cashMoveId = (int) $pdo->lastInsertId();

        $pdo->prepare('INSERT IGNORE INTO ofx_fitids (fitid, bankAccountId, cashMoveId) VALUES (?, ?, ?)')
            ->execute([$fitid, $bankAccountId, $cashMoveId]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[ObraSync OFX] Conciliação falhou: ' . $error->getMessage());
        fail('Erro ao conciliar. Nada foi gravado — tente novamente.', 500);
    }

    server_audit($pdo, $authUser, 'update', 'reconciliation', $recordId,
        ($alreadySettled ? 'Vínculo OFX (já baixado): ' : 'Baixa por OFX: ') . $record['document'] . ' — FITID ' . $fitid);
    respond(['ok' => true, 'data' => [
        'recordId' => $recordId,
        'table' => $table,
        'status' => $alreadySettled ? (string) $record['status'] : $settledStatus,
        'linkedOnly' => $alreadySettled,
        'cashMoveId' => $cashMoveId,
    ], 'message' => $alreadySettled ? 'Extrato vinculado ao título já baixado.' : "Conciliado com sucesso — {$settledStatus}."]);
}

// OFX é um híbrido SGML/XML sem biblioteca nativa no PHP: detecta o dialeto e
// delega. Bancos brasileiros costumam exportar SGML 1.x em Windows-1252 — o
// conteúdo é convertido para UTF-8 antes do parse para não corromper acentos.
function parse_ofx(string $content): array
{
    $content = ltrim(str_replace(["\r\n", "\r"], "\n", $content), "\xEF\xBB\xBF");
    if (!mb_check_encoding($content, 'UTF-8')) {
        $content = mb_convert_encoding($content, 'UTF-8', 'Windows-1252');
    }
    $isXml = stripos($content, '<?xml') !== false;
    return $isXml ? parse_ofx_xml($content) : parse_ofx_sgml($content);
}

// Data OFX: YYYYMMDD[HHMMSS[.XXX][gmt]] → YYYY-MM-DD.
function ofx_date(string $raw): string
{
    $raw = trim($raw);
    if (preg_match('/^(\d{4})(\d{2})(\d{2})/', $raw, $m)) {
        return "{$m[1]}-{$m[2]}-{$m[3]}";
    }
    return date('Y-m-d');
}

// Valor OFX: o padrão usa ponto decimal, mas bancos BR exportam com vírgula.
// Se há vírgula, ela é o separador decimal e os pontos são de milhar.
function ofx_amount(string $raw): float
{
    $raw = trim($raw);
    if (str_contains($raw, ',')) {
        $raw = str_replace('.', '', $raw);
        $raw = str_replace(',', '.', $raw);
    }
    return is_numeric($raw) ? (float) $raw : 0.0;
}

// Normaliza uma transação crua (tags OFX) para o formato do ObraSync.
// O sinal do AMT é a fonte da verdade: negativo = Saída, positivo = Entrada
// (o TRNTYPE varia entre bancos e nem sempre é confiável).
function ofx_normalize_transaction(array $tags): ?array
{
    $fitid = trim((string) ($tags['FITID'] ?? ''));
    if ($fitid === '') {
        return null;
    }
    $amount = ofx_amount((string) ($tags['TRNAMT'] ?? $tags['AMT'] ?? '0'));
    return [
        'fitid' => mb_substr($fitid, 0, 100),
        'date' => ofx_date((string) ($tags['DTPOSTED'] ?? '')),
        'amount' => abs($amount),
        'type' => $amount < 0 ? 'Saída' : 'Entrada',
        'memo' => trim((string) ($tags['MEMO'] ?? $tags['NAME'] ?? '')),
        'checkNum' => trim((string) ($tags['CHECKNUM'] ?? '')),
    ];
}

function parse_ofx_sgml(string $content): array
{
    $transactions = [];
    $accountId = '';
    $bankId = '';

    preg_match_all('/<STMTTRN>(.*?)<\/STMTTRN>/si', $content, $blocks);
    if (!empty($blocks[1])) {
        foreach ($blocks[1] as $block) {
            $tags = [];
            preg_match_all('/<([A-Z0-9.]+)>\s*([^<\n]+)/i', $block, $matches, PREG_SET_ORDER);
            foreach ($matches as $match) {
                $tags[strtoupper($match[1])] = trim($match[2]);
            }
            $txn = ofx_normalize_transaction($tags);
            if ($txn) {
                $transactions[] = $txn;
            }
        }
    } else {
        // SGML 1.x sem fechamento de tags: cada tag em sua linha.
        $inTrn = false;
        $current = [];
        foreach (explode("\n", $content) as $line) {
            $line = trim($line);
            if (stripos($line, '<STMTTRN>') === 0) {
                $inTrn = true;
                $current = [];
                continue;
            }
            if (stripos($line, '</STMTTRN>') === 0) {
                $inTrn = false;
                $txn = ofx_normalize_transaction($current);
                if ($txn) {
                    $transactions[] = $txn;
                }
                continue;
            }
            if ($inTrn && preg_match('/^<([A-Z0-9.]+)>(.*)$/i', $line, $m)) {
                $current[strtoupper($m[1])] = trim($m[2]);
            }
        }
    }

    if (preg_match('/<ACCTID>\s*([^\s<]+)/i', $content, $m)) $accountId = $m[1];
    if (preg_match('/<BANKID>\s*([^\s<]+)/i', $content, $m)) $bankId = $m[1];

    return ['bankId' => $bankId, 'accountId' => $accountId, 'transactions' => $transactions];
}

function parse_ofx_xml(string $content): array
{
    $previous = libxml_use_internal_errors(true);
    $xml = simplexml_load_string($content);
    libxml_use_internal_errors($previous);
    if (!$xml) {
        return ['bankId' => '', 'accountId' => '', 'transactions' => []];
    }
    // Conta corrente; cartão de crédito (CCSTMTRS) como fallback.
    $stmt = $xml->BANKMSGSRSV1->STMTTRNRS->STMTRS
        ?? $xml->CREDITCARDMSGSRSV1->CCSTMTTRNRS->CCSTMTRS
        ?? null;
    if (!$stmt) {
        return ['bankId' => '', 'accountId' => '', 'transactions' => []];
    }
    $from = $stmt->BANKACCTFROM ?? $stmt->CCACCTFROM ?? null;
    $transactions = [];
    foreach ($stmt->BANKTRANLIST->STMTTRN ?? [] as $node) {
        $txn = ofx_normalize_transaction([
            'FITID' => (string) $node->FITID,
            'TRNAMT' => (string) $node->TRNAMT,
            'DTPOSTED' => (string) $node->DTPOSTED,
            'MEMO' => (string) ($node->MEMO ?? ''),
            'NAME' => (string) ($node->NAME ?? ''),
            'CHECKNUM' => (string) ($node->CHECKNUM ?? ''),
        ]);
        if ($txn) {
            $transactions[] = $txn;
        }
    }
    return [
        'bankId' => (string) ($from->BANKID ?? ''),
        'accountId' => (string) ($from->ACCTID ?? ''),
        'transactions' => $transactions,
    ];
}

// Prévia: parse + marcação de duplicatas por FITID. NÃO grava nada — a
// confirmação acontece em ofx-import com as transações que o usuário marcou.
function handle_ofx_preview(PDO $pdo): never
{
    ensure_ofx_tables($pdo);
    if (empty($_FILES['ofx']['tmp_name'])) {
        fail('Envie um arquivo OFX.', 400);
    }
    $file = $_FILES['ofx'];
    $extension = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
    if (!in_array($extension, ['ofx', 'qfx'], true)) {
        fail('Envie um arquivo .ofx ou .qfx exportado do internet banking.', 400);
    }
    if ((int) ($file['size'] ?? 0) > 10 * 1024 * 1024) {
        fail('Arquivo acima de 10 MB — não parece um extrato OFX.', 413);
    }
    $bankAccountId = (int) ($_POST['bankAccountId'] ?? 0);
    if (!$bankAccountId) {
        fail('Selecione a conta bancária.', 400);
    }
    $stmt = $pdo->prepare('SELECT id, name FROM bank_accounts WHERE id = ? LIMIT 1');
    $stmt->execute([$bankAccountId]);
    $account = $stmt->fetch();
    if (!$account) {
        fail('Conta bancária não encontrada.', 404);
    }

    $content = (string) file_get_contents($file['tmp_name']);
    if ($content === '' || (stripos($content, '<OFX') === false && stripos($content, 'OFXHEADER') === false)) {
        fail('O arquivo não parece ser um extrato OFX válido.', 400);
    }
    $parsed = parse_ofx($content);
    if (!$parsed['transactions']) {
        fail('Nenhuma transação encontrada no arquivo OFX.', 400);
    }

    // FITIDs já importados NESTA conta (em lotes — extratos grandes).
    $already = [];
    $fitids = array_column($parsed['transactions'], 'fitid');
    foreach (array_chunk($fitids, 500) as $chunk) {
        $placeholders = implode(',', array_fill(0, count($chunk), '?'));
        $stmt = $pdo->prepare("SELECT fitid FROM ofx_fitids WHERE bankAccountId = ? AND fitid IN ({$placeholders})");
        $stmt->execute([$bankAccountId, ...$chunk]);
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $fitid) {
            $already[$fitid] = true;
        }
    }
    $bankName = (string) $account['name'];
    $transactions = array_map(static function (array $txn) use ($already, $pdo, $bankName): array {
        $txn['duplicate'] = isset($already[$txn['fitid']]);
        // Sugestão de conciliação só para transações novas: contas a
        // pagar/receber com mesmo valor e vencimento próximo (±5 dias).
        $txn['matches'] = $txn['duplicate'] ? [] : ofx_find_matches($pdo, $txn, $bankName);
        $txn['autoMatch'] = (!$txn['duplicate'] && $txn['matches'] && $txn['matches'][0]['confidence'] >= 85)
            ? $txn['matches'][0]
            : null;
        return $txn;
    }, $parsed['transactions']);
    $newCount = count(array_filter($transactions, static fn ($t) => !$t['duplicate']));

    respond(['ok' => true, 'data' => [
        'account' => ['id' => (int) $account['id'], 'name' => (string) $account['name']],
        'bankId' => $parsed['bankId'],
        'accountId' => $parsed['accountId'],
        'transactions' => $transactions,
        'total' => count($transactions),
        'newCount' => $newCount,
        'skipCount' => count($transactions) - $newCount,
    ]]);
}

// Confirmação: grava as transações marcadas em cash_bank_movements (o campo
// bankAccount guarda o NOME da conta — convenção do módulo de caixa), registra
// cada FITID e loga a importação. O nome da conta vem do banco, não do payload.
function handle_ofx_import(PDO $pdo, array $authUser, array $payload): never
{
    ensure_ofx_tables($pdo);
    $bankAccountId = (int) ($payload['bankAccountId'] ?? 0);
    $fileName = mb_substr(trim((string) ($payload['fileName'] ?? 'extrato.ofx')), 0, 300);
    $transactions = is_array($payload['transactions'] ?? null) ? $payload['transactions'] : [];
    if (!$bankAccountId || !$transactions) {
        fail('Dados incompletos: conta bancária e transações são obrigatórios.', 400);
    }
    $stmt = $pdo->prepare('SELECT id, name FROM bank_accounts WHERE id = ? LIMIT 1');
    $stmt->execute([$bankAccountId]);
    $account = $stmt->fetch();
    if (!$account) {
        fail('Conta bancária não encontrada.', 404);
    }
    $accountName = (string) $account['name'];

    $imported = 0;
    $skipped = 0;
    $dateMin = null;
    $dateMax = null;

    $pdo->beginTransaction();
    try {
        $dupCheck = $pdo->prepare('SELECT id FROM ofx_fitids WHERE fitid = ? AND bankAccountId = ? LIMIT 1');
        $insertMove = $pdo->prepare(
            "INSERT INTO cash_bank_movements (`date`, bankAccount, `type`, history, amount, originDocument, status)
             VALUES (?, ?, ?, ?, ?, 'OFX', 'Confirmado')"
        );
        $insertFitid = $pdo->prepare('INSERT IGNORE INTO ofx_fitids (fitid, bankAccountId, cashMoveId) VALUES (?, ?, ?)');

        foreach ($transactions as $txn) {
            if (!is_array($txn)) {
                $skipped++;
                continue;
            }
            $fitid = mb_substr(trim((string) ($txn['fitid'] ?? '')), 0, 100);
            $date = trim((string) ($txn['date'] ?? ''));
            $amount = round(abs((float) ($txn['amount'] ?? 0)), 2);
            $type = ($txn['type'] ?? '') === 'Entrada' ? 'Entrada' : 'Saída';
            $memo = trim((string) ($txn['memo'] ?? ''));
            $import = (bool) ($txn['import'] ?? true);

            if ($fitid === '' || !$import || $amount <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                $skipped++;
                continue;
            }
            $dupCheck->execute([$fitid, $bankAccountId]);
            if ($dupCheck->fetchColumn()) {
                $skipped++;
                continue;
            }
            $insertMove->execute([$date, $accountName, $type, $memo !== '' ? $memo : 'Movimento importado do extrato OFX', $amount]);
            $insertFitid->execute([$fitid, $bankAccountId, (int) $pdo->lastInsertId()]);
            $imported++;
            if (!$dateMin || $date < $dateMin) $dateMin = $date;
            if (!$dateMax || $date > $dateMax) $dateMax = $date;
        }

        $pdo->prepare(
            'INSERT INTO ofx_imports
                (bankAccountId, bankAccountName, fileName, dateStart, dateEnd, totalRecords, imported, skipped, importedBy)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $bankAccountId, $accountName, $fileName, $dateMin, $dateMax,
            count($transactions), $imported, $skipped,
            (int) ($authUser['id'] ?? 0) ?: null,
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[ObraSync OFX] Importação falhou: ' . $error->getMessage());
        fail('Erro ao importar o extrato. Nada foi gravado — tente novamente.', 500);
    }

    server_audit($pdo, $authUser, 'import', 'reconciliation', $bankAccountId, "OFX {$fileName}: {$imported} importadas, {$skipped} ignoradas");
    respond(['ok' => true, 'data' => ['imported' => $imported, 'skipped' => $skipped],
        'message' => "{$imported} transações importadas, {$skipped} ignoradas."]);
}

function handle_ofx_history(PDO $pdo): never
{
    ensure_ofx_tables($pdo);
    $bankAccountId = (int) ($_GET['bankAccountId'] ?? 0);
    if ($bankAccountId) {
        $stmt = $pdo->prepare('SELECT * FROM ofx_imports WHERE bankAccountId = ? ORDER BY importedAt DESC LIMIT 50');
        $stmt->execute([$bankAccountId]);
    } else {
        $stmt = $pdo->query('SELECT * FROM ofx_imports ORDER BY importedAt DESC LIMIT 50');
    }
    respond(['ok' => true, 'data' => $stmt->fetchAll()]);
}

// ── Importação de NFS-e (padrão ABRASF) ──────────────────────────────────────

// CNPJ da empresa para rotear NF emitida × recebida. Fonte primária: Dados da
// Empresa (company_settings.document); ignora o placeholder do seed. Fallback:
// 'company_cnpj' no config e, por fim, o CNPJ conhecido da Schimanski.
function company_cnpj(PDO $pdo, array $config): string
{
    try {
        $document = (string) $pdo->query('SELECT document FROM company_settings ORDER BY id DESC LIMIT 1')->fetchColumn();
        $digits = preg_replace('/\D/', '', $document);
        if (strlen($digits) === 14 && $digits !== '00000000000100') {
            return $digits;
        }
    } catch (Throwable $error) {
        // tabela ausente: segue para os fallbacks
    }
    $fromConfig = preg_replace('/\D/', '', (string) ($config['company_cnpj'] ?? ''));
    return strlen($fromConfig) === 14 ? $fromConfig : '44930777000120';
}

// Parser NFS-e ABRASF (Campo Grande/MS e maioria das prefeituras). Aceita
// <ListaNotaFiscal>/<CompNfse> com várias NFs ou <Nfse> única; remove
// namespaces (variam por prefeitura e quebram o SimpleXML) antes do parse.
function parse_nfse_abrasf(string $xmlContent, string $cnpjEmpresa): array
{
    $xmlContent = ltrim($xmlContent, "\xEF\xBB\xBF");
    $xmlContent = preg_replace('/\sxmlns[^=]*="[^"]*"/i', '', $xmlContent);
    $xmlContent = preg_replace('/<(\/?)[A-Za-z0-9_]+:/', '<$1', $xmlContent);

    $previous = libxml_use_internal_errors(true);
    $xml = simplexml_load_string($xmlContent);
    libxml_use_internal_errors($previous);
    if (!$xml) {
        throw new RuntimeException('XML inválido ou mal-formado.');
    }

    $nfses = $xml->getName() === 'Nfse' ? [$xml] : ($xml->xpath('//Nfse') ?: []);
    if (!$nfses) {
        throw new RuntimeException('Nenhuma NFS-e encontrada no arquivo (estrutura ABRASF esperada: Nfse/InfNfse).');
    }

    $cnpjEmpresa = preg_replace('/\D/', '', $cnpjEmpresa);
    $result = [];
    foreach ($nfses as $nfse) {
        $inf = $nfse->InfNfse ?? null;
        if (!$inf) {
            continue;
        }
        $numero = trim((string) ($inf->Numero ?? ''));
        if ($numero === '') {
            continue;
        }
        $valores = $inf->Servico->Valores ?? null;
        $valorServicos = (float) ($valores->ValorServicos ?? 0);
        $cnpjPrestador = preg_replace('/\D/', '', (string) ($inf->PrestadorServico->IdentificacaoPrestador->Cnpj ?? ''));
        $tomadorId = $inf->TomadorServico->IdentificacaoTomador->CpfCnpj ?? null;
        $codigoVerificacao = trim((string) ($inf->CodigoVerificacao ?? ''));

        // Endereço/contato para permitir criar cliente/fornecedor na importação.
        $tomadorEndereco = $inf->TomadorServico->Endereco ?? null;
        $prestadorEndereco = $inf->PrestadorServico->Endereco ?? null;

        $result[] = [
            'numero' => $numero,
            'codigoVerificacao' => $codigoVerificacao,
            'dataEmissao' => substr((string) ($inf->DataEmissao ?? ''), 0, 10),
            'competencia' => substr((string) ($inf->Competencia ?? ''), 0, 10),
            'valorServicos' => $valorServicos,
            'valorLiquido' => (float) ($valores->ValorLiquidoNfse ?? 0) ?: $valorServicos,
            'valorIss' => (float) ($valores->ValorIss ?? 0),
            'issRetido' => (string) ($valores->IssRetido ?? '2') === '1',
            'discriminacao' => trim((string) ($inf->Servico->Discriminacao ?? '')),
            // CNPJ do prestador = empresa → NF emitida (a receber); senão, recebida (a pagar).
            'tipo' => $cnpjPrestador === $cnpjEmpresa ? 'emitida' : 'recebida',
            'documento' => 'NFS-e ' . $numero,
            'prestador' => [
                'cnpj' => $cnpjPrestador,
                'nome' => trim((string) ($inf->PrestadorServico->RazaoSocial ?? '')),
                'email' => trim((string) ($inf->PrestadorServico->Contato->Email ?? '')),
                'telefone' => trim((string) ($inf->PrestadorServico->Contato->Telefone ?? '')),
                'endereco' => trim((string) ($prestadorEndereco->Endereco ?? '')),
                'numero' => trim((string) ($prestadorEndereco->Numero ?? '')),
                'bairro' => trim((string) ($prestadorEndereco->Bairro ?? '')),
                'cidade' => trim((string) ($prestadorEndereco->Municipio ?? $prestadorEndereco->Cidade ?? $prestadorEndereco->CodigoMunicipio ?? '')),
                'uf' => strtoupper(trim((string) ($prestadorEndereco->Uf ?? $prestadorEndereco->UF ?? ''))),
                'cep' => preg_replace('/\D/', '', (string) ($prestadorEndereco->Cep ?? '')),
            ],
            'tomador' => [
                'cnpj' => $tomadorId ? preg_replace('/\D/', '', (string) ($tomadorId->Cnpj ?? '')) : '',
                'cpf' => $tomadorId ? preg_replace('/\D/', '', (string) ($tomadorId->Cpf ?? '')) : '',
                'nome' => trim((string) ($inf->TomadorServico->RazaoSocial ?? '')),
                'email' => trim((string) ($inf->TomadorServico->Contato->Email ?? '')),
                'telefone' => trim((string) ($inf->TomadorServico->Contato->Telefone ?? '')),
                'endereco' => trim((string) ($tomadorEndereco->Endereco ?? '')),
                'numero' => trim((string) ($tomadorEndereco->Numero ?? '')),
                'bairro' => trim((string) ($tomadorEndereco->Bairro ?? '')),
                'cidade' => trim((string) ($tomadorEndereco->Municipio ?? $tomadorEndereco->Cidade ?? $tomadorEndereco->CodigoMunicipio ?? '')),
                'uf' => strtoupper(trim((string) ($tomadorEndereco->Uf ?? $tomadorEndereco->UF ?? ''))),
                'cep' => preg_replace('/\D/', '', (string) ($tomadorEndereco->Cep ?? '')),
            ],
        ];
    }
    usort($result, static fn ($a, $b) => (int) $b['numero'] <=> (int) $a['numero']);
    return $result;
}

// Vincula a NF a um cliente (emitida → tomador) ou fornecedor (recebida →
// prestador) comparando só os dígitos do CPF/CNPJ com clients/suppliers.document.
function nfse_find_entity(PDO $pdo, string $documentDigits, string $table): array
{
    $digits = preg_replace('/\D/', '', $documentDigits);
    if ($digits === '' || !in_array($table, ['clients', 'suppliers'], true)) {
        return ['id' => null, 'nome' => null];
    }
    $clean = "REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(document, ''), '.', ''), '-', ''), '/', ''), ' ', '')";
    $stmt = $pdo->prepare("SELECT id, name FROM {$table} WHERE {$clean} = ? LIMIT 1");
    $stmt->execute([$digits]);
    $row = $stmt->fetch();
    return $row ? ['id' => (int) $row['id'], 'nome' => (string) $row['name']] : ['id' => null, 'nome' => null];
}

function nfse_format_document_digits(string $digits): string
{
    $digits = preg_replace('/\D/', '', $digits);
    if (strlen($digits) === 11) {
        return preg_replace('/(\d{3})(\d{3})(\d{3})(\d{2})/', '$1.$2.$3-$4', $digits);
    }
    if (strlen($digits) === 14) {
        return preg_replace('/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/', '$1.$2.$3/$4-$5', $digits);
    }
    return $digits;
}

function nfse_address_from_parts(array $parts): string
{
    return trim(implode(', ', array_filter([
        trim((string) ($parts['endereco'] ?? '')),
        trim((string) ($parts['numero'] ?? '')),
        trim((string) ($parts['bairro'] ?? '')),
        trim((string) ($parts['cidade'] ?? '')),
        strtoupper(trim((string) ($parts['uf'] ?? ''))),
    ], static fn ($part) => $part !== '')));
}

function handle_nfse_create_entity_quick(PDO $pdo, array $authUser, array $payload): never
{
    $table = trim((string) ($payload['table'] ?? ''));
    $nome = trim((string) ($payload['nome'] ?? $payload['name'] ?? ''));
    $documento = preg_replace('/\D/', '', (string) ($payload['documento'] ?? $payload['document'] ?? ''));

    if (!in_array($table, ['clients', 'suppliers'], true)) {
        fail('Tabela inválida.', 400);
    }
    if ($nome === '') {
        fail('Nome obrigatório.', 400);
    }
    if ($documento === '' || !in_array(strlen($documento), [11, 14], true)) {
        fail('CPF/CNPJ obrigatório ou inválido.', 400);
    }

    $existing = nfse_find_entity($pdo, $documento, $table);
    if ($existing['id']) {
        respond(['ok' => true, 'data' => [
            'id' => $existing['id'],
            'nomeFormatado' => $existing['nome'],
            'criado' => false,
        ], 'message' => 'Já cadastrado — vinculando.']);
    }

    $status = in_array((string) ($payload['status'] ?? ''), ['Ativo', 'Inativo'], true)
        ? (string) $payload['status']
        : 'Ativo';
    $address = nfse_address_from_parts($payload);
    $fields = [
        'name' => mb_substr($nome, 0, 160),
        'document' => nfse_format_document_digits($documento),
        'zipCode' => preg_replace('/\D/', '', (string) ($payload['cep'] ?? $payload['zipCode'] ?? '')) ?: null,
        'address' => $address !== '' ? mb_substr($address, 0, 255) : null,
        'email' => trim((string) ($payload['email'] ?? '')) ?: null,
        'phone' => preg_replace('/[^\d()+\- ]/', '', (string) ($payload['telefone'] ?? $payload['phone'] ?? '')) ?: null,
        'status' => $status,
    ];

    try {
        $newId = insert_dynamic($pdo, $table, $fields);
    } catch (Throwable $error) {
        error_log('[ObraSync NFS-e] Cadastro rápido falhou em ' . $table . ': ' . $error->getMessage());
        fail('Erro ao cadastrar. Nada foi gravado — tente novamente.', 500);
    }

    server_audit($pdo, $authUser, 'create', $table, $newId, 'Cadastro rápido NFS-e: ' . $nome);
    respond(['ok' => true, 'data' => [
        'id' => $newId,
        'nomeFormatado' => $nome,
        'criado' => true,
    ], 'message' => ($table === 'clients' ? 'Cliente' : 'Fornecedor') . ' cadastrado com sucesso.'], 201);
}

// Cria cliente (emitida → tomador) ou fornecedor (recebida → prestador) a partir
// dos dados do XML NFS-e e devolve o ID. Reconfere o documento antes de inserir
// para não duplicar quando duas NFs da mesma parte chegam no mesmo lote.
function nfse_create_entity(PDO $pdo, string $table, array $party): ?int
{
    if (!in_array($table, ['clients', 'suppliers'], true)) {
        return null;
    }
    $digits = preg_replace('/\D/', '', ($party['cnpj'] ?? '') ?: ($party['cpf'] ?? ''));
    $nome = trim((string) ($party['nome'] ?? ''));
    if ($digits === '' || $nome === '') {
        return null;
    }

    // Reconfere (corrida dentro do mesmo lote / cadastro recém-criado).
    $existing = nfse_find_entity($pdo, $digits, $table);
    if ($existing['id']) {
        return $existing['id'];
    }

    $docFormatado = nfse_format_document_digits($digits);
    $enderecoCompleto = nfse_address_from_parts($party);

    return insert_dynamic($pdo, $table, [
        'name' => mb_substr($nome, 0, 160),
        'document' => $docFormatado,
        'zipCode' => preg_replace('/\D/', '', (string) ($party['cep'] ?? '')) ?: null,
        'address' => $enderecoCompleto !== '' ? mb_substr($enderecoCompleto, 0, 255) : null,
        'email' => trim((string) ($party['email'] ?? '')) ?: null,
        'phone' => preg_replace('/[^\d()+\- ]/', '', (string) ($party['telefone'] ?? '')) ?: null,
        'status' => 'Ativo',
    ]);
}

// ── Diário de Obra (RDO) ────────────────────────────────────────────────────
// Cria as tabelas sob demanda (chamada no início de cada action de RDO/
// disciplinas). Idempotente: guarda estática + CREATE IF NOT EXISTS.
function ensure_rdo_tables(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS obra_disciplinas (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        projectId BIGINT UNSIGNED NOT NULL,
        nome VARCHAR(80) NOT NULL,
        responsavelUserId BIGINT UNSIGNED NULL,
        responsavelNome VARCHAR(120) NULL,
        status ENUM('Ativa','Inativa') NOT NULL DEFAULT 'Ativa',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_disc_project (projectId),
        UNIQUE KEY uk_disc_obra_nome (projectId, nome)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS obra_rdo (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        projectId BIGINT UNSIGNED NOT NULL,
        etapaId BIGINT UNSIGNED NULL,
        data DATE NOT NULL,
        numeroSequencial INT NULL,
        climaManha VARCHAR(40) NULL,
        climaTarde VARCHAR(40) NULL,
        climaNoite VARCHAR(40) NULL,
        condicaoTrabalho ENUM('Praticável','Parcialmente praticável','Impraticável') NULL DEFAULT 'Praticável',
        atividades LONGTEXT NULL,
        ocorrencias LONGTEXT NULL,
        observacoes LONGTEXT NULL,
        efetivo JSON NULL,
        equipamentos JSON NULL,
        responsavelGeralNome VARCHAR(120) NULL,
        responsavelGeralUserId BIGINT UNSIGNED NULL,
        createdByUserId BIGINT UNSIGNED NULL,
        status ENUM('Rascunho','Aguardando assinaturas','Finalizado') NOT NULL DEFAULT 'Rascunho',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_rdo_obra_dia (projectId, data),
        INDEX idx_rdo_project (projectId),
        INDEX idx_rdo_data (data),
        INDEX idx_rdo_etapa (etapaId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS obra_rdo_disciplinas (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        rdoId BIGINT UNSIGNED NOT NULL,
        disciplinaId BIGINT UNSIGNED NULL,
        disciplinaNome VARCHAR(80) NOT NULL,
        responsavelUserId BIGINT UNSIGNED NULL,
        responsavelNome VARCHAR(120) NULL,
        atuouNoDia TINYINT(1) NOT NULL DEFAULT 1,
        assinado TINYINT(1) NOT NULL DEFAULT 0,
        assinadoEm TIMESTAMP NULL DEFAULT NULL,
        assinadoPorUserId BIGINT UNSIGNED NULL,
        INDEX idx_rdodisc_rdo (rdoId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // 'evento' distingue assinatura de reabertura: na reabertura mantemos a
    // trilha histórica em vez de apagar (auditoria de documento).
    $pdo->exec("CREATE TABLE IF NOT EXISTS obra_rdo_assinaturas (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        rdoId BIGINT UNSIGNED NOT NULL,
        tipo ENUM('Geral','Disciplina') NOT NULL,
        disciplinaNome VARCHAR(80) NULL,
        assinanteNome VARCHAR(120) NULL,
        assinanteUserId BIGINT UNSIGNED NULL,
        evento ENUM('Assinatura','Reabertura') NOT NULL DEFAULT 'Assinatura',
        assinadoEm TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_rdoass_rdo (rdoId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS obra_rdo_fotos (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        rdoId BIGINT UNSIGNED NOT NULL,
        caminho VARCHAR(300) NOT NULL,
        legenda VARCHAR(200) NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_rdo_foto (rdoId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $done = true;
}

// Nome completo de um usuário (cache do responsável em disciplinas/RDO).
function rdo_user_fullname(PDO $pdo, ?int $userId): ?string
{
    if (!$userId) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT fullName FROM system_users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $name = $stmt->fetchColumn();
    return $name !== false ? (string) $name : null;
}

// Responsável da obra: prioriza projectManagerId (FK → system_users); cai no
// texto responsible/technicalResponsible se não houver gestor por ID.
function rdo_project_responsible(PDO $pdo, int $projectId): array
{
    $stmt = $pdo->prepare('SELECT projectManagerId, responsible, technicalResponsible FROM projects WHERE id = ? LIMIT 1');
    $stmt->execute([$projectId]);
    $p = $stmt->fetch() ?: [];
    $userId = (int) ($p['projectManagerId'] ?? 0) ?: null;
    $nome = $userId ? rdo_user_fullname($pdo, $userId) : null;
    if ($nome === null || $nome === '') {
        $nome = trim((string) ($p['responsible'] ?? '')) ?: (trim((string) ($p['technicalResponsible'] ?? '')) ?: null);
    }
    return ['userId' => $userId, 'nome' => $nome];
}

// Normaliza efetivo/equipamentos para string JSON (array) ou null.
function rdo_json_or_null($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        $value = is_array($decoded) ? $decoded : null;
    }
    if (!is_array($value) || !$value) {
        return null;
    }
    return json_encode(array_values($value), JSON_UNESCAPED_UNICODE);
}

// Copia as disciplinas ativas da obra para o RDO (uma vez, na criação).
function rdo_snapshot_disciplinas(PDO $pdo, int $rdoId, int $projectId): void
{
    $stmt = $pdo->prepare("SELECT id, nome, responsavelUserId, responsavelNome FROM obra_disciplinas WHERE projectId = ? AND status = 'Ativa' ORDER BY nome");
    $stmt->execute([$projectId]);
    $ins = $pdo->prepare('INSERT INTO obra_rdo_disciplinas (rdoId, disciplinaId, disciplinaNome, responsavelUserId, responsavelNome, atuouNoDia) VALUES (?, ?, ?, ?, ?, 0)');
    foreach ($stmt->fetchAll() as $d) {
        $ins->execute([$rdoId, $d['id'], $d['nome'], $d['responsavelUserId'], $d['responsavelNome']]);
    }
}

// Aplica marcação "atuou no dia"/responsável vindos do form; permite adicionar
// disciplina nova on-the-fly (linha sem id).
function rdo_aplicar_disciplinas(PDO $pdo, int $rdoId, array $disciplinas): void
{
    $upd = $pdo->prepare('UPDATE obra_rdo_disciplinas SET atuouNoDia = ?, responsavelUserId = ?, responsavelNome = ? WHERE id = ? AND rdoId = ?');
    $ins = $pdo->prepare('INSERT INTO obra_rdo_disciplinas (rdoId, disciplinaId, disciplinaNome, responsavelUserId, responsavelNome, atuouNoDia) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($disciplinas as $d) {
        if (!is_array($d)) {
            continue;
        }
        $atuou = !empty($d['atuouNoDia']) ? 1 : 0;
        $userId = (int) ($d['responsavelUserId'] ?? 0) ?: null;
        $nome = $userId ? rdo_user_fullname($pdo, $userId) : (trim((string) ($d['responsavelNome'] ?? '')) ?: null);
        $rowId = (int) ($d['id'] ?? 0);
        if ($rowId) {
            $upd->execute([$atuou, $userId, $nome, $rowId, $rdoId]);
        } else {
            $discNome = trim((string) ($d['disciplinaNome'] ?? ''));
            if ($discNome === '') {
                continue;
            }
            $ins->execute([$rdoId, (int) ($d['disciplinaId'] ?? 0) ?: null, mb_substr($discNome, 0, 80), $userId, $nome, $atuou]);
        }
    }
}

function handle_obra_disciplinas_list(PDO $pdo): never
{
    ensure_rdo_tables($pdo);
    $projectId = (int) ($_GET['projectId'] ?? 0);
    if (!$projectId) {
        fail('Informe a obra.', 400);
    }
    $stmt = $pdo->prepare('SELECT * FROM obra_disciplinas WHERE projectId = ? ORDER BY status, nome');
    $stmt->execute([$projectId]);
    respond(['ok' => true, 'data' => $stmt->fetchAll()]);
}

function handle_obra_disciplinas_save(PDO $pdo, array $authUser, array $payload): never
{
    ensure_rdo_tables($pdo);
    $projectId = (int) ($payload['projectId'] ?? 0);
    $nome = trim((string) ($payload['nome'] ?? ''));
    $id = (int) ($payload['id'] ?? 0) ?: null;
    if (!$projectId || $nome === '') {
        fail('Obra e nome da disciplina são obrigatórios.', 400);
    }
    $responsavelUserId = (int) ($payload['responsavelUserId'] ?? 0) ?: null;
    $responsavelNome = $responsavelUserId
        ? rdo_user_fullname($pdo, $responsavelUserId)
        : (trim((string) ($payload['responsavelNome'] ?? '')) ?: null);
    $status = in_array((string) ($payload['status'] ?? 'Ativa'), ['Ativa', 'Inativa'], true) ? (string) $payload['status'] : 'Ativa';
    $fields = [
        'projectId' => $projectId,
        'nome' => mb_substr($nome, 0, 80),
        'responsavelUserId' => $responsavelUserId,
        'responsavelNome' => $responsavelNome,
        'status' => $status,
    ];
    try {
        if ($id) {
            update_dynamic($pdo, 'obra_disciplinas', $id, $fields);
        } else {
            $id = insert_dynamic($pdo, 'obra_disciplinas', $fields);
        }
    } catch (Throwable $e) {
        fail('Já existe uma disciplina com esse nome nesta obra.', 409);
    }
    server_audit($pdo, $authUser, $id ? 'update' : 'create', 'obra_disciplinas', $id, 'Disciplina: ' . $nome);
    $stmt = $pdo->prepare('SELECT * FROM obra_disciplinas WHERE id = ?');
    $stmt->execute([$id]);
    respond(['ok' => true, 'data' => $stmt->fetch()]);
}

function handle_obra_disciplinas_delete(PDO $pdo, array $authUser, int $id): never
{
    ensure_rdo_tables($pdo);
    if (!$id) {
        fail('Disciplina inválida.', 400);
    }
    $pdo->prepare('DELETE FROM obra_disciplinas WHERE id = ?')->execute([$id]);
    server_audit($pdo, $authUser, 'delete', 'obra_disciplinas', $id, 'Disciplina removida');
    respond(['ok' => true]);
}

function handle_rdo_list(PDO $pdo): never
{
    ensure_rdo_tables($pdo);
    $projectId = (int) ($_GET['projectId'] ?? 0) ?: null;
    $de = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($_GET['de'] ?? '')) ? (string) $_GET['de'] : null;
    $ate = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($_GET['ate'] ?? '')) ? (string) $_GET['ate'] : null;
    $where = [];
    $args = [];
    if ($projectId) {
        $where[] = 'r.projectId = ?';
        $args[] = $projectId;
    }
    if ($de) {
        $where[] = 'r.data >= ?';
        $args[] = $de;
    }
    if ($ate) {
        $where[] = 'r.data <= ?';
        $args[] = $ate;
    }
    $sql = "SELECT r.*,
              (SELECT COUNT(*) FROM obra_rdo_disciplinas d WHERE d.rdoId = r.id AND d.atuouNoDia = 1) AS assinaturasObrig,
              (SELECT COUNT(*) FROM obra_rdo_disciplinas d WHERE d.rdoId = r.id AND d.atuouNoDia = 1 AND d.assinado = 1) AS assinaturasFeitas
            FROM obra_rdo r";
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY r.data DESC, r.id DESC LIMIT 500';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($args);
    respond(['ok' => true, 'data' => $stmt->fetchAll()]);
}

function handle_rdo_get(PDO $pdo, int $id): never
{
    ensure_rdo_tables($pdo);
    if (!$id) {
        fail('RDO inválido.', 400);
    }
    $stmt = $pdo->prepare('SELECT * FROM obra_rdo WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $rdo = $stmt->fetch();
    if (!$rdo) {
        fail('RDO não encontrado.', 404);
    }
    $rdo['efetivo'] = $rdo['efetivo'] ? (json_decode((string) $rdo['efetivo'], true) ?: []) : [];
    $rdo['equipamentos'] = $rdo['equipamentos'] ? (json_decode((string) $rdo['equipamentos'], true) ?: []) : [];
    $d = $pdo->prepare('SELECT * FROM obra_rdo_disciplinas WHERE rdoId = ? ORDER BY disciplinaNome');
    $d->execute([$id]);
    $rdo['disciplinas'] = $d->fetchAll();
    $a = $pdo->prepare('SELECT * FROM obra_rdo_assinaturas WHERE rdoId = ? ORDER BY assinadoEm');
    $a->execute([$id]);
    $rdo['assinaturas'] = $a->fetchAll();
    $f = $pdo->prepare('SELECT id, legenda FROM obra_rdo_fotos WHERE rdoId = ? ORDER BY id');
    $f->execute([$id]);
    $rdo['fotos'] = $f->fetchAll();
    respond(['ok' => true, 'data' => $rdo]);
}

function handle_rdo_save(PDO $pdo, array $authUser, array $payload): never
{
    ensure_rdo_tables($pdo);
    $id = (int) ($payload['id'] ?? 0) ?: null;
    $projectId = (int) ($payload['projectId'] ?? 0);
    $data = trim((string) ($payload['data'] ?? ''));
    if (!$projectId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
        fail('Obra e data são obrigatórias.', 400);
    }
    $dup = $pdo->prepare('SELECT id FROM obra_rdo WHERE projectId = ? AND data = ? LIMIT 1');
    $dup->execute([$projectId, $data]);
    $existingId = (int) ($dup->fetchColumn() ?: 0);
    if ($existingId && $existingId !== (int) $id) {
        respond(['ok' => false, 'error' => 'Já existe um RDO para esta obra nesta data. Abra o RDO existente para editar.', 'rdoId' => $existingId], 409);
    }

    $current = null;
    if ($id) {
        $cur = $pdo->prepare('SELECT * FROM obra_rdo WHERE id = ? LIMIT 1');
        $cur->execute([$id]);
        $current = $cur->fetch();
        if (!$current) {
            fail('RDO não encontrado.', 404);
        }
        if ($current['status'] === 'Finalizado') {
            fail('RDO finalizado — reabra para editar.', 409);
        }
    }

    if (!empty($payload['responsavelGeralUserId'])) {
        $respUserId = (int) $payload['responsavelGeralUserId'];
        $respNome = rdo_user_fullname($pdo, $respUserId);
    } elseif (!empty($payload['responsavelGeralNome'])) {
        $respUserId = null;
        $respNome = trim((string) $payload['responsavelGeralNome']);
    } elseif (!$id) {
        $resp = rdo_project_responsible($pdo, $projectId);
        $respUserId = $resp['userId'];
        $respNome = $resp['nome'];
    } else {
        $respUserId = (int) ($current['responsavelGeralUserId'] ?? 0) ?: null;
        $respNome = $current['responsavelGeralNome'] ?? null;
    }

    $condicoes = ['Praticável', 'Parcialmente praticável', 'Impraticável'];
    $fields = [
        'projectId' => $projectId,
        'etapaId' => (int) ($payload['etapaId'] ?? 0) ?: null,
        'data' => $data,
        'climaManha' => trim((string) ($payload['climaManha'] ?? '')) ?: null,
        'climaTarde' => trim((string) ($payload['climaTarde'] ?? '')) ?: null,
        'climaNoite' => trim((string) ($payload['climaNoite'] ?? '')) ?: null,
        'condicaoTrabalho' => in_array((string) ($payload['condicaoTrabalho'] ?? ''), $condicoes, true) ? (string) $payload['condicaoTrabalho'] : 'Praticável',
        'atividades' => trim((string) ($payload['atividades'] ?? '')) ?: null,
        'ocorrencias' => trim((string) ($payload['ocorrencias'] ?? '')) ?: null,
        'observacoes' => trim((string) ($payload['observacoes'] ?? '')) ?: null,
        'efetivo' => rdo_json_or_null($payload['efetivo'] ?? null),
        'equipamentos' => rdo_json_or_null($payload['equipamentos'] ?? null),
        'responsavelGeralUserId' => $respUserId,
        'responsavelGeralNome' => $respNome,
    ];

    $pdo->beginTransaction();
    try {
        if (!$id) {
            $numStmt = $pdo->prepare('SELECT COALESCE(MAX(numeroSequencial), 0) + 1 FROM obra_rdo WHERE projectId = ?');
            $numStmt->execute([$projectId]);
            $fields['numeroSequencial'] = (int) $numStmt->fetchColumn();
            $fields['createdByUserId'] = (int) ($authUser['id'] ?? 0) ?: null;
            $id = insert_dynamic($pdo, 'obra_rdo', $fields);
            rdo_snapshot_disciplinas($pdo, $id, $projectId);
        } else {
            update_dynamic($pdo, 'obra_rdo', $id, $fields);
        }
        if (is_array($payload['disciplinas'] ?? null)) {
            rdo_aplicar_disciplinas($pdo, $id, $payload['disciplinas']);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[ObraSync RDO] save: ' . $e->getMessage());
        fail('Erro ao salvar o RDO.', 500);
    }
    server_audit($pdo, $authUser, $current ? 'update' : 'create', 'obra_rdo', $id, 'RDO ' . $data);
    handle_rdo_get($pdo, $id);
}

function handle_rdo_enviar_assinaturas(PDO $pdo, array $authUser, array $payload): never
{
    ensure_rdo_tables($pdo);
    $id = (int) ($payload['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT * FROM obra_rdo WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $rdo = $stmt->fetch();
    if (!$rdo) {
        fail('RDO não encontrado.', 404);
    }
    if ($rdo['status'] === 'Finalizado') {
        fail('RDO já finalizado.', 409);
    }
    if (!$rdo['responsavelGeralUserId']) {
        fail('Defina o responsável geral (usuário com login) antes de enviar para assinaturas.', 422);
    }
    $d = $pdo->prepare('SELECT disciplinaNome FROM obra_rdo_disciplinas WHERE rdoId = ? AND atuouNoDia = 1 AND (responsavelUserId IS NULL OR responsavelUserId = 0)');
    $d->execute([$id]);
    $semResp = $d->fetchAll(PDO::FETCH_COLUMN);
    if ($semResp) {
        fail('Defina um responsável (com login) para: ' . implode(', ', $semResp), 422);
    }
    $tem = $pdo->prepare('SELECT COUNT(*) FROM obra_rdo_disciplinas WHERE rdoId = ? AND atuouNoDia = 1');
    $tem->execute([$id]);
    if ((int) $tem->fetchColumn() === 0) {
        fail('Marque ao menos uma disciplina que atuou no dia.', 422);
    }
    update_dynamic($pdo, 'obra_rdo', $id, ['status' => 'Aguardando assinaturas']);
    server_audit($pdo, $authUser, 'update', 'obra_rdo', $id, 'RDO enviado para assinaturas');
    handle_rdo_get($pdo, $id);
}

function handle_rdo_assinar(PDO $pdo, array $authUser, array $payload): never
{
    ensure_rdo_tables($pdo);
    $id = (int) ($payload['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT * FROM obra_rdo WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $rdo = $stmt->fetch();
    if (!$rdo) {
        fail('RDO não encontrado.', 404);
    }
    if ($rdo['status'] !== 'Aguardando assinaturas') {
        fail('O RDO precisa estar aguardando assinaturas.', 409);
    }
    $uid = (int) ($authUser['id'] ?? 0);
    $isAdmin = ($authUser['role'] ?? '') === 'admin';
    $assinou = [];
    $pdo->beginTransaction();
    try {
        if (((int) $rdo['responsavelGeralUserId'] === $uid || $isAdmin) && $rdo['responsavelGeralUserId']) {
            $jaGeral = $pdo->prepare("SELECT 1 FROM obra_rdo_assinaturas WHERE rdoId = ? AND tipo = 'Geral' AND evento = 'Assinatura' LIMIT 1");
            $jaGeral->execute([$id]);
            if (!$jaGeral->fetchColumn()) {
                $pdo->prepare("INSERT INTO obra_rdo_assinaturas (rdoId, tipo, assinanteNome, assinanteUserId, evento) VALUES (?, 'Geral', ?, ?, 'Assinatura')")
                    ->execute([$id, $rdo['responsavelGeralNome'], $rdo['responsavelGeralUserId']]);
                $assinou[] = 'Responsável geral';
            }
        }
        $sel = $pdo->prepare('SELECT * FROM obra_rdo_disciplinas WHERE rdoId = ? AND atuouNoDia = 1 AND assinado = 0 AND (responsavelUserId = ? OR 1 = ?)');
        $sel->execute([$id, $uid, $isAdmin ? 1 : 0]);
        $discs = $sel->fetchAll();
        $updD = $pdo->prepare('UPDATE obra_rdo_disciplinas SET assinado = 1, assinadoEm = NOW(), assinadoPorUserId = ? WHERE id = ?');
        $insA = $pdo->prepare("INSERT INTO obra_rdo_assinaturas (rdoId, tipo, disciplinaNome, assinanteNome, assinanteUserId, evento) VALUES (?, 'Disciplina', ?, ?, ?, 'Assinatura')");
        foreach ($discs as $disc) {
            $updD->execute([$uid, $disc['id']]);
            $insA->execute([$id, $disc['disciplinaNome'], $disc['responsavelNome'], $disc['responsavelUserId']]);
            $assinou[] = $disc['disciplinaNome'];
        }
        if (!$assinou) {
            $pdo->rollBack();
            fail('Você não é responsável por nenhuma assinatura pendente neste RDO.', 403);
        }
        $pend = $pdo->prepare('SELECT COUNT(*) FROM obra_rdo_disciplinas WHERE rdoId = ? AND atuouNoDia = 1 AND assinado = 0');
        $pend->execute([$id]);
        $discPend = (int) $pend->fetchColumn();
        $geralStmt = $pdo->prepare("SELECT 1 FROM obra_rdo_assinaturas WHERE rdoId = ? AND tipo = 'Geral' AND evento = 'Assinatura' LIMIT 1");
        $geralStmt->execute([$id]);
        $geralOk = (bool) $geralStmt->fetchColumn();
        if ($discPend === 0 && $geralOk) {
            update_dynamic($pdo, 'obra_rdo', $id, ['status' => 'Finalizado']);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[ObraSync RDO] assinar: ' . $e->getMessage());
        fail('Erro ao registrar assinatura.', 500);
    }
    server_audit($pdo, $authUser, 'update', 'obra_rdo', $id, 'Assinatura RDO: ' . implode(', ', $assinou));
    handle_rdo_get($pdo, $id);
}

function handle_rdo_reabrir(PDO $pdo, array $authUser, array $payload): never
{
    ensure_rdo_tables($pdo);
    $id = (int) ($payload['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT * FROM obra_rdo WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $rdo = $stmt->fetch();
    if (!$rdo) {
        fail('RDO não encontrado.', 404);
    }
    $uid = (int) ($authUser['id'] ?? 0);
    $isAdmin = ($authUser['role'] ?? '') === 'admin';
    if (!$isAdmin && (int) $rdo['responsavelGeralUserId'] !== $uid) {
        fail('Apenas o responsável geral ou o admin podem reabrir o RDO.', 403);
    }
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE obra_rdo_disciplinas SET assinado = 0, assinadoEm = NULL, assinadoPorUserId = NULL WHERE rdoId = ?')->execute([$id]);
        $pdo->prepare("INSERT INTO obra_rdo_assinaturas (rdoId, tipo, assinanteNome, assinanteUserId, evento) VALUES (?, 'Geral', ?, ?, 'Reabertura')")
            ->execute([$id, (string) ($authUser['fullName'] ?? $authUser['username'] ?? ''), $uid ?: null]);
        update_dynamic($pdo, 'obra_rdo', $id, ['status' => 'Rascunho']);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        fail('Erro ao reabrir o RDO.', 500);
    }
    server_audit($pdo, $authUser, 'update', 'obra_rdo', $id, 'RDO reaberto');
    handle_rdo_get($pdo, $id);
}

function handle_rdo_delete(PDO $pdo, array $authUser, int $id, array $config): never
{
    ensure_rdo_tables($pdo);
    if (!$id) {
        fail('RDO inválido.', 400);
    }
    $f = $pdo->prepare('SELECT caminho FROM obra_rdo_fotos WHERE rdoId = ?');
    $f->execute([$id]);
    foreach ($f->fetchAll(PDO::FETCH_COLUMN) as $caminho) {
        if (is_string($caminho) && is_file($caminho)) {
            @unlink($caminho);
        }
    }
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM obra_rdo_fotos WHERE rdoId = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM obra_rdo_disciplinas WHERE rdoId = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM obra_rdo_assinaturas WHERE rdoId = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM obra_rdo WHERE id = ?')->execute([$id]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        fail('Erro ao excluir o RDO.', 500);
    }
    server_audit($pdo, $authUser, 'delete', 'obra_rdo', $id, 'RDO excluído');
    respond(['ok' => true]);
}

function handle_rdo_upload_foto(PDO $pdo, array $config, array $authUser): never
{
    ensure_rdo_tables($pdo);
    $rdoId = (int) ($_POST['rdoId'] ?? 0);
    if (!$rdoId) {
        fail('RDO não informado.', 400);
    }
    $chk = $pdo->prepare('SELECT status FROM obra_rdo WHERE id = ? LIMIT 1');
    $chk->execute([$rdoId]);
    $status = $chk->fetchColumn();
    if ($status === false) {
        fail('RDO não encontrado.', 404);
    }
    if ($status === 'Finalizado') {
        fail('RDO finalizado — não aceita novas fotos.', 409);
    }
    $dir = rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/') . '/rdo';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    $path = store_upload($_FILES['file'] ?? [], $dir, ['jpg', 'jpeg', 'png', 'webp'], ['image/jpeg', 'image/png', 'image/webp']);
    $legenda = trim((string) ($_POST['legenda'] ?? '')) ?: null;
    $fotoId = insert_dynamic($pdo, 'obra_rdo_fotos', [
        'rdoId' => $rdoId,
        'caminho' => $path,
        'legenda' => $legenda ? mb_substr($legenda, 0, 200) : null,
    ]);
    server_audit($pdo, $authUser, 'create', 'obra_rdo_fotos', $fotoId, 'Foto RDO ' . $rdoId);
    respond(['ok' => true, 'data' => ['id' => $fotoId, 'legenda' => $legenda]]);
}

function handle_rdo_delete_foto(PDO $pdo, array $authUser, int $id): never
{
    ensure_rdo_tables($pdo);
    $stmt = $pdo->prepare('SELECT caminho FROM obra_rdo_fotos WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $caminho = $stmt->fetchColumn();
    if ($caminho === false) {
        fail('Foto não encontrada.', 404);
    }
    if (is_string($caminho) && is_file($caminho)) {
        @unlink($caminho);
    }
    $pdo->prepare('DELETE FROM obra_rdo_fotos WHERE id = ?')->execute([$id]);
    respond(['ok' => true]);
}

function handle_rdo_foto_download(PDO $pdo, int $id): never
{
    ensure_rdo_tables($pdo);
    $stmt = $pdo->prepare('SELECT caminho FROM obra_rdo_fotos WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $path = $stmt->fetchColumn();
    if ($path === false || !is_string($path) || !is_file($path)) {
        fail('Imagem não encontrada.', 404);
    }
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mime = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][$ext] ?? 'application/octet-stream';
    header_remove('Content-Type');
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

function handle_nfse_preview(PDO $pdo, array $config): never
{
    if (empty($_FILES['xml']['tmp_name'])) {
        fail('Envie um arquivo XML NFS-e.', 400);
    }
    $file = $_FILES['xml'];
    if (strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION)) !== 'xml') {
        fail('Envie o arquivo .xml exportado da prefeitura.', 400);
    }
    if ((int) ($file['size'] ?? 0) > 5 * 1024 * 1024) {
        fail('Arquivo acima de 5 MB — não parece um XML de NFS-e.', 413);
    }
    $content = (string) file_get_contents($file['tmp_name']);
    if ($content === '' || stripos($content, 'Nfse') === false) {
        fail('O arquivo não parece ser um XML de NFS-e (padrão ABRASF).', 400);
    }

    try {
        $nfses = parse_nfse_abrasf($content, company_cnpj($pdo, $config));
    } catch (RuntimeException $error) {
        fail($error->getMessage(), 400);
    }

    // Guarda o XML em uploads/notas-fiscais (DEPOIS de ler o conteúdo: o
    // store_upload move o arquivo temporário) para vincular como xmlPath.
    $uploadDir = rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/') . '/notas-fiscais';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0750, true);
    }
    $storedPath = store_upload($file, $uploadDir, ['xml'], ['text/xml', 'application/xml', 'application/octet-stream']);

    $dupCheck = $pdo->prepare('SELECT id FROM fiscal_documents WHERE documentNumber = ? LIMIT 1');
    $nfses = array_map(static function (array $nf) use ($pdo, $dupCheck): array {
        $party = $nf['tipo'] === 'emitida' ? $nf['tomador'] : $nf['prestador'];
        $doc = ($party['cnpj'] ?? '') ?: ($party['cpf'] ?? '');
        $entity = nfse_find_entity($pdo, $doc, $nf['tipo'] === 'emitida' ? 'clients' : 'suppliers');
        $nf['entityId'] = $entity['id'];
        $nf['entityNome'] = $entity['nome'] ?? ($party['nome'] ?: null);
        $dupCheck->execute([$nf['documento']]);
        $nf['jaImportada'] = (bool) $dupCheck->fetchColumn();
        return $nf;
    }, $nfses);

    respond(['ok' => true, 'data' => [
        'nfses' => $nfses,
        'total' => count($nfses),
        'emitidas' => count(array_filter($nfses, static fn ($n) => $n['tipo'] === 'emitida')),
        'recebidas' => count(array_filter($nfses, static fn ($n) => $n['tipo'] === 'recebida')),
        'valorTotal' => array_sum(array_column($nfses, 'valorLiquido')),
        'xmlFile' => basename($storedPath),
    ]]);
}

// Grava as NFs selecionadas: fiscal_documents (obra obrigatória — projectId é
// NOT NULL com FK) + conta a receber (emitida) ou a pagar (recebida), com
// referência cruzada nos dois sentidos. Tudo transacional.
function handle_nfse_import(PDO $pdo, array $config, array $authUser, array $payload): never
{
    $nfses = is_array($payload['nfses'] ?? null) ? $payload['nfses'] : [];
    // Obra/Projeto é opcional: um lote pode conter NFs de obras diferentes (cada
    // NF traz seu projectId) ou sem obra (projectId nulo). $defaultProject é só um
    // fallback caso ainda venha um id global no payload.
    $defaultProject = (int) ($payload['projectId'] ?? 0) ?: null;
    $criarEntidades = (bool) ($payload['criarEntidades'] ?? false);
    $xmlFile = basename(trim((string) ($payload['xmlFile'] ?? '')));
    if (!$nfses) {
        fail('Nenhuma NFS-e selecionada.', 400);
    }
    // Valida o projectId de cada NF contra projects (com cache) para não estourar
    // a FK; id inexistente vira null em vez de abortar a importação inteira.
    $projectCache = [];
    $resolveProject = static function (?int $id) use ($pdo, &$projectCache): ?int {
        if (!$id) {
            return null;
        }
        if (!array_key_exists($id, $projectCache)) {
            $stmt = $pdo->prepare('SELECT id FROM projects WHERE id = ? LIMIT 1');
            $stmt->execute([$id]);
            $projectCache[$id] = $stmt->fetchColumn() ? $id : null;
        }
        return $projectCache[$id];
    };
    $xmlPath = null;
    if ($xmlFile !== '' && preg_match('/^[A-Za-z0-9._-]+\.xml$/i', $xmlFile)) {
        $candidate = rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/') . '/notas-fiscais/' . $xmlFile;
        if (is_file($candidate)) {
            $xmlPath = $candidate;
        }
    }

    $importadas = 0;
    $duplicatas = 0;
    $criados = [];
    $pdo->beginTransaction();
    try {
        $dupCheck = $pdo->prepare('SELECT id FROM fiscal_documents WHERE documentNumber = ? LIMIT 1');
        foreach ($nfses as $nf) {
            if (!is_array($nf) || !($nf['importar'] ?? true)) {
                continue;
            }
            $numero = trim((string) ($nf['numero'] ?? ''));
            $dataEmissao = trim((string) ($nf['dataEmissao'] ?? ''));
            $valor = round((float) ($nf['valorLiquido'] ?? 0), 2);
            $emitida = ($nf['tipo'] ?? '') === 'emitida';
            $discriminacao = trim((string) ($nf['discriminacao'] ?? ''));
            $codigo = trim((string) ($nf['codigoVerificacao'] ?? ''));
            $entityId = (int) ($nf['entityId'] ?? 0) ?: null;
            $nfProjectId = $resolveProject(((int) ($nf['projectId'] ?? 0)) ?: $defaultProject);
            if ($numero === '' || $valor <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataEmissao)) {
                continue;
            }
            $documentNumber = 'NFS-e ' . $numero;
            $dupCheck->execute([$documentNumber]);
            if ($dupCheck->fetchColumn()) {
                $duplicatas++;
                continue;
            }

            // Cliente/fornecedor não cadastrado: cria a partir do XML quando o
            // usuário marcou a opção na prévia. Falha de criação não aborta a
            // importação — a NF entra sem vínculo (entityId nulo).
            if (!$entityId && $criarEntidades) {
                $table = $emitida ? 'clients' : 'suppliers';
                $party = is_array($nf[$emitida ? 'tomador' : 'prestador'] ?? null)
                    ? $nf[$emitida ? 'tomador' : 'prestador'] : [];
                try {
                    $novoId = nfse_create_entity($pdo, $table, $party);
                } catch (Throwable $error) {
                    error_log('[ObraSync NFS-e] Falha ao criar ' . $table . ': ' . $error->getMessage());
                    $novoId = null;
                }
                if ($novoId) {
                    $entityId = $novoId;
                    $criados[] = [
                        'id' => $novoId,
                        'nome' => trim((string) ($party['nome'] ?? '')),
                        'documento' => preg_replace('/\D/', '', ($party['cnpj'] ?? '') ?: ($party['cpf'] ?? '')),
                        'tipo' => $emitida ? 'cliente' : 'fornecedor',
                    ];
                }
            }

            $notes = trim(($codigo !== '' ? "Código de verificação: {$codigo}\n" : '') . $discriminacao);
            $fiscalId = insert_dynamic($pdo, 'fiscal_documents', [
                'projectId' => $nfProjectId,
                'supplierId' => $emitida ? null : $entityId,
                'documentNumber' => $documentNumber,
                'issueDate' => $dataEmissao,
                'amount' => $valor,
                'type' => 'Nota Fiscal de Serviço',
                'status' => 'Pendente',
                'xmlPath' => $xmlPath,
                'notes' => $notes !== '' ? mb_substr($notes, 0, 2000) : null,
            ]);

            // A importação não define vencimento: dueDate é NOT NULL, então
            // usamos a própria data de emissão como fallback. O usuário ajusta
            // o vencimento real depois, na conta a pagar/receber gerada.
            $vencimento = $dataEmissao;
            // insert_dynamic descarta colunas inexistentes (referencia_tipo/_id
            // dependem da migration de integração) — funciona nos dois cenários.
            if ($emitida) {
                $receivableId = insert_dynamic($pdo, 'accounts_receivable', [
                    'document' => $documentNumber,
                    'issueDate' => $dataEmissao,
                    'dueDate' => $vencimento,
                    'clientId' => $entityId,
                    'projectId' => $nfProjectId,
                    'amount' => $valor,
                    'status' => 'Aberto',
                    'referencia_tipo' => 'fiscal_document',
                    'referencia_id' => $fiscalId,
                ]);
                update_dynamic($pdo, 'fiscal_documents', $fiscalId, ['receivableId' => $receivableId]);
            } else {
                $payableId = insert_dynamic($pdo, 'accounts_payable', [
                    'document' => $documentNumber,
                    'issueDate' => $dataEmissao,
                    'dueDate' => $vencimento,
                    'supplierId' => $entityId,
                    'projectId' => $nfProjectId,
                    'amount' => $valor,
                    'status' => 'Aberto',
                    'referencia_tipo' => 'fiscal_document',
                    'referencia_id' => $fiscalId,
                ]);
                update_dynamic($pdo, 'fiscal_documents', $fiscalId, ['payableId' => $payableId]);
            }
            $importadas++;
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[ObraSync NFS-e] Importação falhou: ' . $error->getMessage());
        fail('Erro ao importar as NFS-e. Nada foi gravado — tente novamente.', 500);
    }

    $totalCriados = count($criados);
    server_audit($pdo, $authUser, 'import', 'fiscalDocuments', null, "NFS-e XML: {$importadas} importadas, {$duplicatas} duplicadas, {$totalCriados} cadastros criados");
    respond(['ok' => true, 'data' => ['importadas' => $importadas, 'duplicatas' => $duplicatas, 'criados' => $criados],
        'message' => "{$importadas} NFS-e importadas, {$duplicatas} já existiam."]);
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
    // Fallback ?token= RESTRITO ao download de notas fiscais aberto por
    // navegação direta (GET /fiscalDocuments/{id}/pdf|xml) — único caso em que
    // o navegador não envia headers. Nas demais rotas, aceitar o token na
    // query string o deixaria gravado nos access logs do Apache.
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
        $segments = route_segments();
        $isFiscalDownload = in_array($segments[0] ?? '', ['fiscalDocuments', 'notas-fiscais', 'documentos-fiscais-obra'], true)
            && isset($segments[1], $segments[2]);
        if ($isFiscalDownload) {
            return trim((string) ($_GET['token'] ?? ''));
        }
    }
    return '';
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
                TIMESTAMPDIFF(SECOND, s.createdAt, NOW()) AS ageSeconds,
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
    // TTL absoluto: um token roubado/mantido vivo não dura mais que 12 h.
    if ((int) $session['ageSeconds'] > AUTH_MAX_SESSION_SECONDS) {
        $pdo->prepare('DELETE FROM api_sessions WHERE id = ?')->execute([$session['sessionId']]);
        fail('Sessão expirada. Faça login novamente.', 401);
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

// Log de auditoria server-side: o logAudit() do frontend grava só no localStorage
// do navegador — aqui fica o registro real, compartilhado e não apagável pelo
// próprio usuário (módulo Log de Auditoria, visível ao admin).
function ensure_audit_log_table(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS audit_log (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            userId BIGINT UNSIGNED NULL,
            username VARCHAR(120) NOT NULL DEFAULT '',
            role VARCHAR(40) NOT NULL DEFAULT '',
            action VARCHAR(20) NOT NULL,
            module VARCHAR(60) NOT NULL DEFAULT '',
            recordId VARCHAR(40) NULL,
            details VARCHAR(400) NOT NULL DEFAULT '',
            ip VARCHAR(45) NOT NULL DEFAULT '',
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_audit_created (createdAt),
            KEY idx_audit_user (userId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $done = true;
}

// Nunca derruba a operação principal: auditoria falha em silêncio no error_log.
function server_audit(PDO $pdo, ?array $user, string $action, string $module, $recordId = null, string $details = ''): void
{
    try {
        ensure_audit_log_table($pdo);
        $pdo->prepare('INSERT INTO audit_log (userId, username, role, action, module, recordId, details, ip) VALUES (?,?,?,?,?,?,?,?)')
            ->execute([
                (int) ($user['id'] ?? 0) ?: null,
                (string) ($user['username'] ?? ''),
                (string) ($user['role'] ?? ''),
                $action,
                $module,
                $recordId !== null && $recordId !== '' ? (string) $recordId : null,
                function_exists('mb_substr') ? mb_substr($details, 0, 400) : substr($details, 0, 400),
                (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
            ]);
    } catch (Throwable $error) {
        error_log('[ObraSync] Falha no audit log: ' . $error->getMessage());
    }
}

// Tentativas de login/reset registradas para o rate limit (janela deslizante).
function ensure_login_attempts_table(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS login_attempts (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            context VARCHAR(20) NOT NULL DEFAULT 'login',
            username VARCHAR(190) NOT NULL DEFAULT '',
            ip VARCHAR(45) NOT NULL DEFAULT '',
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_attempt_user (context, username, createdAt),
            KEY idx_attempt_ip (context, ip, createdAt)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $done = true;
}

function count_recent_attempts(PDO $pdo, string $context, string $field, string $value, int $windowSeconds): int
{
    $column = $field === 'ip' ? 'ip' : 'username';
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM login_attempts WHERE context = ? AND `{$column}` = ? AND createdAt > (NOW() - INTERVAL {$windowSeconds} SECOND)");
    $stmt->execute([$context, $value]);
    return (int) $stmt->fetchColumn();
}

function register_attempt(PDO $pdo, string $context, string $username, string $ip): void
{
    $pdo->prepare('INSERT INTO login_attempts (context, username, ip) VALUES (?, ?, ?)')->execute([$context, $username, $ip]);
}

// Comparação de senha: hash sempre; o legado em texto plano (seeds com
// TROQUE_NO_PRIMEIRO_ACESSO) só vale quando a troca obrigatória está pendente —
// qualquer outro valor não-hash na coluna deixa de funcionar como senha.
function password_matches(string $stored, string $password, bool $allowLegacyPlain): bool
{
    if ($stored !== '' && password_verify($password, $stored)) {
        return true;
    }
    return $allowLegacyPlain && $stored !== '' && !str_starts_with($stored, '$') && hash_equals($stored, $password);
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
        'orcamentoEtapas' => 'workBudgets',
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

// ── Permissões por usuário (override do papel) ──────────────────────────────
// Camada acima de role_can: quando existe linha em user_permissions para
// (userId, module), ela vale; na AUSÊNCIA, herda do papel. Sem nenhuma linha,
// o comportamento é idêntico ao anterior.
function ensure_user_permissions_table(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_permissions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        userId BIGINT UNSIGNED NOT NULL,
        module VARCHAR(60) NOT NULL,
        canView TINYINT(1) NOT NULL DEFAULT 0,
        canCreate TINYINT(1) NOT NULL DEFAULT 0,
        canEdit TINYINT(1) NOT NULL DEFAULT 0,
        canDelete TINYINT(1) NOT NULL DEFAULT 0,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_userperm (userId, module),
        INDEX idx_userperm_user (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $done = true;
}

function user_can(PDO $pdo, ?array $user, string $module, string $action): bool
{
    if (!$user) {
        return false;
    }
    if ((string) ($user['role'] ?? '') === 'admin') {
        return true;
    }
    $userId = (int) ($user['id'] ?? 0);
    if ($userId > 0) {
        $column = ['view' => 'canView', 'create' => 'canCreate', 'edit' => 'canEdit', 'delete' => 'canDelete'][$action] ?? 'canEdit';
        try {
            ensure_user_permissions_table($pdo);
            $stmt = $pdo->prepare("SELECT `{$column}` AS allowed FROM user_permissions WHERE userId = ? AND module = ? LIMIT 1");
            $stmt->execute([$userId, $module]);
            $row = $stmt->fetch();
            if ($row) {
                return (int) $row['allowed'] === 1;
            }
        } catch (PDOException $error) {
            // Tabela ausente / sem DDL: herda do papel.
        }
    }
    return role_can($pdo, (string) ($user['role'] ?? ''), $module, $action);
}

// Mapa de overrides do usuário para o frontend (só os módulos com linha
// explícita; ausência = herda do papel). Vai no bootstrap.
function user_effective_permissions(PDO $pdo, int $userId): array
{
    if ($userId <= 0) {
        return [];
    }
    try {
        ensure_user_permissions_table($pdo);
        $stmt = $pdo->prepare('SELECT module, canView, canCreate, canEdit, canDelete FROM user_permissions WHERE userId = ?');
        $stmt->execute([$userId]);
        $map = [];
        foreach ($stmt->fetchAll() as $r) {
            $map[(string) $r['module']] = [
                'view' => (int) $r['canView'] === 1,
                'create' => (int) $r['canCreate'] === 1,
                'edit' => (int) $r['canEdit'] === 1,
                'delete' => (int) $r['canDelete'] === 1,
            ];
        }
        return $map;
    } catch (PDOException $error) {
        return [];
    }
}

function handle_user_permissions_get(PDO $pdo): never
{
    ensure_user_permissions_table($pdo);
    $userId = (int) ($_GET['userId'] ?? 0);
    if (!$userId) {
        fail('Usuário não informado.', 400);
    }
    $u = $pdo->prepare('SELECT role FROM system_users WHERE id = ? LIMIT 1');
    $u->execute([$userId]);
    $role = $u->fetchColumn();
    if ($role === false) {
        fail('Usuário não encontrado.', 404);
    }
    $stmt = $pdo->prepare('SELECT module, canView, canCreate, canEdit, canDelete FROM user_permissions WHERE userId = ?');
    $stmt->execute([$userId]);
    $overrides = [];
    foreach ($stmt->fetchAll() as $r) {
        $overrides[(string) $r['module']] = [
            'canView' => (int) $r['canView'] === 1,
            'canCreate' => (int) $r['canCreate'] === 1,
            'canEdit' => (int) $r['canEdit'] === 1,
            'canDelete' => (int) $r['canDelete'] === 1,
        ];
    }
    respond(['ok' => true, 'data' => ['role' => (string) $role, 'overrides' => $overrides]]);
}

function handle_user_permissions_save(PDO $pdo, array $authUser, array $payload): never
{
    ensure_user_permissions_table($pdo);
    $userId = (int) ($payload['userId'] ?? 0);
    if (!$userId) {
        fail('Usuário não informado.', 400);
    }
    $perms = is_array($payload['permissions'] ?? null) ? $payload['permissions'] : [];
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM user_permissions WHERE userId = ?')->execute([$userId]);
        $ins = $pdo->prepare('INSERT INTO user_permissions (userId, module, canView, canCreate, canEdit, canDelete) VALUES (?, ?, ?, ?, ?, ?)');
        foreach ($perms as $p) {
            if (!is_array($p)) {
                continue;
            }
            $module = trim((string) ($p['module'] ?? ''));
            if ($module === '') {
                continue;
            }
            $ins->execute([
                $userId,
                mb_substr($module, 0, 60),
                !empty($p['canView']) ? 1 : 0,
                !empty($p['canCreate']) ? 1 : 0,
                !empty($p['canEdit']) ? 1 : 0,
                !empty($p['canDelete']) ? 1 : 0,
            ]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[ObraSync] user_permissions save: ' . $error->getMessage());
        fail('Erro ao salvar permissões.', 500);
    }
    server_audit($pdo, $authUser, 'update', 'user_permissions', $userId, 'Permissões por usuário atualizadas');
    respond(['ok' => true]);
}

function handle_user_permissions_reset(PDO $pdo, array $authUser, array $payload): never
{
    ensure_user_permissions_table($pdo);
    $userId = (int) ($payload['userId'] ?? 0);
    if (!$userId) {
        fail('Usuário não informado.', 400);
    }
    $pdo->prepare('DELETE FROM user_permissions WHERE userId = ?')->execute([$userId]);
    server_audit($pdo, $authUser, 'update', 'user_permissions', $userId, 'Permissões restauradas ao papel');
    respond(['ok' => true]);
}

function authorize_request(PDO $pdo, ?array $user, string $module, string $action): void
{
    if (!$user) {
        fail('Não autenticado. Faça login para acessar a API.', 401);
    }
    if (!user_can($pdo, $user, permission_module_key($module), $action)) {
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
        'financeiro' => ['dashboard', 'clients', 'suppliers', 'categories', 'costCenters', 'bankAccounts', 'projects', 'projectSchedule', 'agenda', 'kanban', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'sinapiSettings', 'ownCompositions', 'quotes', 'abcCurve', 'viabilityAnalyses', 'fiscalDocuments', 'receivable', 'payable', 'cashMoves', 'cashFlow', 'reconciliation', 'proposals', 'sales', 'chartAccounts', 'journalEntries', 'dre', 'taxDocuments', 'taxes', 'reports', 'reportFinancial', 'reportClient', 'reportSupplier', 'reportCostCenter', 'reportProject', 'exports', 'systemVersion', 'plugins', 'qualidadeDashboard'],
        'comercial' => ['dashboard', 'clients', 'projects', 'projectSchedule', 'agenda', 'kanban', 'workBudgets', 'abcCurve', 'viabilityAnalyses', 'budgets', 'proposals', 'proposalModels', 'proposalAreas', 'proposalActionTypes', 'proposalServiceSubtypes', 'sales', 'reportClient', 'systemVersion', 'plugins'],
        'engenharia' => ['dashboard', 'rdo', 'projects', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'projectNotifications', 'projectTrackingLinks', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'ownCompositions', 'quotes', 'abcCurve', 'viabilityAnalyses', 'purchaseOrders', 'fiscalDocuments', 'technicalReports', 'projectReport', 'proposals', 'reportProject', 'systemVersion', 'plugins', 'qualidadeDashboard', 'qualidadePes', 'qualidadePqo', 'qualidadeFvs', 'qualidadeFvm', 'qualidadeNc', 'qualidadeTreinamentos'],
        'gestor_obra' => ['dashboard', 'rdo', 'projects', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'projectNotifications', 'projectTrackingLinks', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'ownCompositions', 'quotes', 'abcCurve', 'viabilityAnalyses', 'purchaseOrders', 'fiscalDocuments', 'technicalReports', 'projectReport', 'proposals', 'reportProject', 'systemVersion', 'plugins', 'qualidadeDashboard', 'qualidadePes', 'qualidadePqo', 'qualidadeFvs', 'qualidadeFvm', 'qualidadeNc', 'qualidadeTreinamentos'],
        'equipe_campo' => ['dashboard', 'projectReport', 'systemVersion', 'plugins'],
        'cliente_obra' => ['dashboard', 'projectReport', 'projectSchedule', 'technicalReports', 'systemVersion', 'plugins'],
        'fornecedor_terceiro' => ['dashboard', 'systemVersion', 'plugins'],
        'consulta' => ['dashboard', 'projectReport', 'cashFlow', 'dre', 'reports', 'reportFinancial', 'reportClient', 'reportSupplier', 'reportCostCenter', 'reportProject', 'exports', 'plugins', 'qualidadeDashboard'],
        'operador' => ['dashboard', 'rdo', 'clients', 'suppliers', 'products', 'services', 'categories', 'costCenters', 'bankAccounts', 'projects', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'ownCompositions', 'quotes', 'abcCurve', 'fiscalDocuments', 'receivable', 'payable', 'cashMoves', 'cashFlow', 'reconciliation', 'budgets', 'proposals', 'sales', 'purchaseOrders', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'projectReport', 'reports', 'reportFinancial', 'reportClient', 'reportSupplier', 'reportCostCenter', 'reportProject', 'myProfile', 'plugins'],
        'visualizador' => '*',
    ];
}

// Espelha editableByRole de canEditModule() do app.js (mutação por perfil sem linha em role_permissions).
function default_role_edit_modules(): array
{
    return [
        'financeiro' => ['fiscalDocuments', 'receivable', 'payable', 'cashMoves', 'cashFlow', 'reconciliation', 'categories', 'costCenters', 'bankAccounts', 'chartAccounts', 'journalEntries', 'taxDocuments', 'taxes', 'exports', 'projectSchedule', 'agenda', 'kanban', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'sinapiSettings', 'quotes', 'sales', 'viabilityAnalyses'],
        'comercial' => ['clients', 'budgets', 'proposals', 'agenda', 'kanban', 'viabilityAnalyses'],
        'engenharia' => ['rdo', 'projects', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'projectNotifications', 'projectTrackingLinks', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'ownCompositions', 'quotes', 'purchaseOrders', 'fiscalDocuments', 'technicalReports', 'qualidadePes', 'qualidadePqo', 'qualidadeFvs', 'qualidadeFvm', 'qualidadeNc', 'qualidadeTreinamentos'],
        'gestor_obra' => ['rdo', 'projects', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'projectNotifications', 'projectTrackingLinks', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'sinapiLabor', 'sinapiFamilies', 'sinapiMaintenances', 'ownCompositions', 'quotes', 'purchaseOrders', 'fiscalDocuments', 'technicalReports', 'qualidadePes', 'qualidadePqo', 'qualidadeFvs', 'qualidadeFvm', 'qualidadeNc', 'qualidadeTreinamentos'],
        'operador' => ['rdo', 'clients', 'suppliers', 'products', 'services', 'categories', 'costCenters', 'bankAccounts', 'projects', 'workBudgets', 'sinapiReferences', 'sinapiInputs', 'sinapiCompositions', 'ownCompositions', 'quotes', 'fiscalDocuments', 'receivable', 'payable', 'cashMoves', 'reconciliation', 'budgets', 'proposals', 'sales', 'purchaseOrders', 'projectSchedule', 'projectMilestones', 'agenda', 'kanban', 'qualidadeFvs', 'qualidadeFvm', 'qualidadeNc'],
    ];
}

function handle_login(PDO $pdo, array $payload): never
{
    $username = trim((string) ($payload['username'] ?? ''));
    $password = (string) ($payload['password'] ?? '');
    if ($username === '' || $password === '') {
        fail('Usuário e senha são obrigatórios.', 400);
    }

    // Rate limit: janela deslizante por usuário e por IP antes de qualquer consulta.
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    ensure_login_attempts_table($pdo);
    $pdo->prepare('DELETE FROM login_attempts WHERE createdAt < (NOW() - INTERVAL ' . RESET_WINDOW_SECONDS . ' SECOND)')->execute();
    if (count_recent_attempts($pdo, 'login', 'username', $username, LOGIN_WINDOW_SECONDS) >= LOGIN_MAX_PER_USER
        || count_recent_attempts($pdo, 'login', 'ip', $ip, LOGIN_WINDOW_SECONDS) >= LOGIN_MAX_PER_IP) {
        fail('Muitas tentativas de login. Aguarde 15 minutos e tente novamente.', 429);
    }

    $stmt = $pdo->prepare("SELECT * FROM system_users WHERE username = ? AND status = 'Ativo' LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    if (!$user) {
        register_attempt($pdo, 'login', $username, $ip);
        server_audit($pdo, null, 'login_failed', 'sistema', null, $username);
        fail('Usuário ou senha inválidos.', 401);
    }
    $stored = (string) ($user['password'] ?? '');
    $hashedOk = $stored !== '' && password_verify($password, $stored);
    $legacyPlain = !$hashedOk && password_matches($stored, $password, !empty($user['mustChangePassword']));
    $valid = $hashedOk || $legacyPlain;
    if (!$valid) {
        register_attempt($pdo, 'login', $username, $ip);
        server_audit($pdo, null, 'login_failed', 'sistema', null, $username);
        fail('Usuário ou senha inválidos.', 401);
    }
    // O aviso de bloqueio só depois da senha conferida: responder "bloqueado"
    // antes confirmava a um atacante que aquele username existe (enumeração).
    if (!empty($user['blocked'])) {
        server_audit($pdo, $user, 'login_failed', 'sistema', null, 'Login com senha correta em conta bloqueada');
        fail('Usuário bloqueado. Fale com o administrador.', 403);
    }
    $pdo->prepare("DELETE FROM login_attempts WHERE context = 'login' AND username = ?")->execute([$username]);
    server_audit($pdo, $user, 'login', 'sistema');
    if ($legacyPlain) {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $update = $pdo->prepare('UPDATE system_users SET password = ? WHERE id = ?');
        $update->execute([$hash, $user['id']]);
    }
    unset($user['password']);
    $user['mustChangePassword'] = !empty($user['mustChangePassword']);
    // A flag mustChangePassword só é zerada pela troca efetiva de senha: o admin pode
    // definir uma senha temporária forte e ainda exigir a troca no primeiro acesso.

    ensure_api_sessions_table($pdo);
    $pdo->prepare('DELETE FROM api_sessions WHERE lastActivity < (NOW() - INTERVAL ' . AUTH_IDLE_SECONDS . ' SECOND) OR createdAt < (NOW() - INTERVAL ' . AUTH_MAX_SESSION_SECONDS . ' SECOND)')->execute();
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

    // Rate limit por IP: evita disparo de e-mails em massa e sondagem da base.
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    ensure_login_attempts_table($pdo);
    $pdo->prepare('DELETE FROM login_attempts WHERE createdAt < (NOW() - INTERVAL ' . RESET_WINDOW_SECONDS . ' SECOND)')->execute();
    if (count_recent_attempts($pdo, 'reset', 'ip', $ip, RESET_WINDOW_SECONDS) >= RESET_MAX_PER_IP) {
        fail('Muitas solicitações de redefinição. Aguarde 1 hora e tente novamente.', 429);
    }
    register_attempt($pdo, 'reset', $email, $ip);

    $stmt = $pdo->prepare(
        "SELECT id, username, email FROM system_users
          WHERE email = ? AND status = 'Ativo' AND blocked = 0
          LIMIT 1"
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Resposta idêntica com ou sem cadastro: não confirma quais e-mails existem.
    $genericMessage = 'Se o e-mail estiver cadastrado, o link de redefinição foi enviado.';
    if (!$user) {
        respond(['ok' => true, 'message' => $genericMessage]);
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

    respond(['ok' => true, 'message' => $genericMessage]);
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
    $stmt = $pdo->prepare('SELECT password, mustChangePassword FROM system_users WHERE id = ? LIMIT 1');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    if (!$row) {
        fail('Usuário não encontrado.', 404);
    }
    // A senha atual precisa estar correta antes de qualquer outra validação.
    $stored = (string) ($row['password'] ?? '');
    if (!password_matches($stored, $currentPassword, !empty($row['mustChangePassword']))) {
        fail('Senha atual incorreta.', 400);
    }
    $pwErr = validate_password_strength($newPassword);
    if ($pwErr) {
        fail($pwErr, 400);
    }
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE system_users SET password = ?, mustChangePassword = 0 WHERE id = ?')
        ->execute([$hash, $user['id']]);
    // Troca de senha derruba as DEMAIS sessões do usuário (a atual continua válida) —
    // mesmo comportamento da troca obrigatória.
    try {
        $currentTokenHash = hash('sha256', bearer_token());
        $pdo->prepare('DELETE FROM api_sessions WHERE userId = ? AND tokenHash != ?')
            ->execute([(int) $user['id'], $currentTokenHash]);
    } catch (Throwable $error) {
        error_log('[ObraSync] Falha ao encerrar outras sessões após troca voluntária de senha: ' . $error->getMessage());
    }
    server_audit($pdo, $user, 'password', 'sistema', null, 'Troca voluntária de senha');
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
            'SELECT u.id, u.username, u.password, u.status, u.blocked, u.mustChangePassword
               FROM api_sessions s
               JOIN system_users u ON u.id = s.userId
              WHERE s.tokenHash = ?
              LIMIT 1'
        );
        $stmt->execute([hash('sha256', $token)]);
        $user = $stmt->fetch() ?: null;
    }
    if (!$user && $username !== '') {
        $stmt = $pdo->prepare('SELECT id, username, password, status, blocked, mustChangePassword FROM system_users WHERE username = ? LIMIT 1');
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
    if (!password_matches($stored, $currentPassword, !empty($user['mustChangePassword']))) {
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

    // Obra/projeto é opcional (projectId é NULL no schema e o lote de NFS-e pode
    // não ter obra). Exigir obra aqui impedia até a troca de status (ex.: marcar
    // como "Conferida") de notas sem obra vinculada.
    if (empty($data['documentNumber']) || empty($data['issueDate'])) {
        fail('Número da nota e data de emissão são obrigatórios.', 400);
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
    // Só o nome do arquivo na resposta: o caminho absoluto expõe a estrutura do servidor.
    respond(['ok' => true, 'file' => basename($path)]);
}

function handle_sinapi_import(PDO $pdo, array $resources, array $config): never
{
    if (empty($_FILES['file']['tmp_name'])) {
        fail('Arquivo SINAPI não informado.', 400);
    }
    // O caminho síncrono processa o arquivo inteiro dentro da requisição web:
    // arquivos grandes (ex.: Referência completa de 13 MB) estouram memória/tempo
    // do PHP-CGI — para esses, use a importação em background (Configuração SINAPI).
    if ((int) ($_FILES['file']['size'] ?? 0) > 4 * 1024 * 1024) {
        fail('Arquivo acima de 4 MB no importador síncrono. Use a "Importar Tabela SINAPI" em Configuração SINAPI (processamento em background).', 413);
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

    respond(['ok' => true, 'mode' => $mode, 'file' => basename($path), 'summary' => $summary, 'samples' => $samples]);
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

    spawn_sinapi_worker($pdo, $config, $jobId);

    server_audit($pdo, $authUser, 'import', 'sinapiSettings', $jobId, "Importação SINAPI UF {$uf} {$referenceMonth}/{$referenceYear}");
    respond(['ok' => true, 'jobId' => $jobId], 201);
}

// Dispara o worker CLI em background com verificações explícitas: pasta de logs
// gravável, binário PHP CLI resolvido por lista de candidatos (PHP_BINARY em
// CGI/FPM aponta para o SAPI web, não serve) e nohup para o worker não morrer
// junto com o request. Usada pela importação e pelo reprocessamento.
function spawn_sinapi_worker(PDO $pdo, array $config, string $jobId): void
{
    $worker = dirname(__DIR__) . '/scripts/sinapi_import_worker.php';
    if (!is_file($worker)) {
        fail('Worker não encontrado em scripts/sinapi_import_worker.php — confira o deploy.', 500);
    }

    // Logs do worker fora da pasta pública, ao lado de uploads/ e backups/.
    $logDir = dirname(rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/')) . '/sinapi_jobs';
    if (!is_dir($logDir) && !@mkdir($logDir, 0750, true)) {
        fail("Não foi possível criar a pasta de logs em {$logDir}. Verifique as permissões do usuário do Apache.", 500);
    }
    if (!is_writable($logDir)) {
        fail("Sem permissão de escrita em {$logDir} — o log do worker não poderia ser gravado.", 500);
    }

    $php = null;
    $candidates = [
        PHP_BINDIR . '/php',
        '/usr/bin/php',
        '/usr/local/bin/php',
        '/usr/bin/php8.4',
        '/usr/bin/php8.3',
        '/usr/bin/php8.2',
        '/usr/bin/php8.1',
        '/usr/bin/php8',
        trim((string) shell_exec('command -v php 2>/dev/null')),
    ];
    foreach ($candidates as $candidate) {
        if ($candidate !== null && $candidate !== '' && @is_executable($candidate)) {
            $php = $candidate;
            break;
        }
    }
    if (!$php) {
        fail('Binário PHP CLI não encontrado no servidor (procurado em ' . PHP_BINDIR . ', /usr/bin e /usr/local/bin). Instale o pacote php-cli.', 500);
    }

    $logFile = $logDir . '/' . preg_replace('/[^A-Za-z0-9_.-]/', '', $jobId) . '.log';
    exec(sprintf(
        'nohup %s %s --job %s >> %s 2>&1 &',
        escapeshellarg($php),
        escapeshellarg($worker),
        escapeshellarg($jobId),
        escapeshellarg($logFile)
    ));

    // A confirmação de que o worker subiu fica no polling de sinapi-import-status
    // (o frontend alerta após 30 s em queued): segurar a requisição aqui com sleep
    // bloqueava um worker FPM/CGI sem necessidade.
}

function handle_sinapi_reprocess_job(PDO $pdo, array $config, array $payload, array $authUser): never
{
    ensure_sinapi_import_jobs_table($pdo);
    $jobId = trim((string) ($payload['jobId'] ?? ''));
    if ($jobId === '') {
        fail('Informe o jobId.', 400);
    }
    $stmt = $pdo->prepare('SELECT * FROM sinapi_import_jobs WHERE id = ? LIMIT 1');
    $stmt->execute([$jobId]);
    $job = $stmt->fetch();
    if (!$job) {
        fail('Job não encontrado.', 404);
    }
    if ($job['status'] === 'running') {
        fail('Este job já está em processamento.', 409);
    }
    $files = (array) (json_decode((string) ($job['paramsJson'] ?? '{}'), true)['files'] ?? []);
    $missing = array_filter($files, static fn ($path) => !is_file((string) $path));
    if (!$files || $missing) {
        fail('Os arquivos deste job não estão mais no servidor. Envie os XLSX novamente em uma nova importação.', 410);
    }
    $pdo->prepare("UPDATE sinapi_import_jobs SET status = 'queued', currentStep = 'Aguardando reprocessamento', progress = 0, total = 0, errorMessage = NULL, finishedAt = NULL WHERE id = ?")
        ->execute([$jobId]);
    spawn_sinapi_worker($pdo, $config, $jobId);
    server_audit($pdo, $authUser, 'import', 'sinapiSettings', $jobId, 'Reprocessamento da importação SINAPI');
    respond(['ok' => true, 'jobId' => $jobId]);
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
    // Matching pela COMBINAÇÃO (AND) dos campos únicos presentes no registro:
    // testar cada campo isoladamente fazia um homônimo (mesmo nome, documento
    // diferente) ser tratado como o mesmo registro e sobrescrito na migração.
    $where = [];
    $params = [];
    foreach ($meta['unique'] as $field) {
        if (empty($row[$field])) {
            continue;
        }
        $where[] = '`' . $field . '` = ?';
        $params[] = $row[$field];
    }
    if (!$where) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT id FROM `' . $meta['table'] . '` WHERE ' . implode(' AND ', $where) . ' LIMIT 1');
    $stmt->execute($params);
    $id = $stmt->fetchColumn();
    return $id ? (int) $id : null;
}

function handle_backup(PDO $pdo, array $resources, array $config, string $method, array $segments): never
{
    $action = $segments[1] ?? 'export';
    if ($method === 'GET' && $action === 'export') {
        // Backup exporta TUDO — inclusive as tabelas SINAPI fora do bootstrap normal.
        $data = bootstrap_data($pdo, $resources, null, true);
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
