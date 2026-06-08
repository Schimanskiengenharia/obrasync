<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const CONFIG_PATH = '/etc/financeiro/config.php';

$config = load_config();
$pdo = db($config);
$resources = resource_map();

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $segments = route_segments();
    $resource = $segments[0] ?? 'bootstrap';
    $id = $segments[1] ?? null;

    if ($resource === '' || $resource === 'bootstrap') {
        require_method($method, ['GET']);
        respond(['ok' => true, 'data' => bootstrap_data($pdo, $resources)]);
    }

    if ($resource === 'backup') {
        handle_backup($pdo, $resources, $config, $method, $segments);
    }

    if ($resource === 'login') {
        require_method($method, ['POST']);
        handle_login($pdo, read_json());
    }

    if ($resource === 'migrate') {
        require_method($method, ['POST']);
        $payload = read_json();
        respond(['ok' => true, 'imported' => migrate_payload($pdo, $resources, $payload)]);
    }

    if ($resource === 'sinapi-upload') {
        require_method($method, ['POST']);
        handle_safe_file_upload($config, 'sinapi', ['csv','txt','xlsx'], ['text/plain','text/csv','application/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','application/octet-stream']);
    }

    if ($resource === 'sinapi-import') {
        require_method($method, ['POST']);
        handle_sinapi_import($pdo, $resources, $config);
    }

    if ($resource === 'project-upload') {
        require_method($method, ['POST']);
        handle_safe_file_upload($config, 'project', ['xml'], ['text/xml','application/xml','application/octet-stream']);
    }

    $key = normalize_resource($resource, $resources);
    if (!$key) {
        fail('Recurso não encontrado.', 404);
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
        $record = create_record($pdo, $resources[$key], read_json());
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
        $record = update_record($pdo, $resources[$key], (int) $id, read_json());
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

function load_config(): array
{
    $path = getenv('FINANCEIRO_CONFIG') ?: CONFIG_PATH;
    if (is_file($path)) {
        return require $path;
    }
    return require __DIR__ . '/config.sample.php';
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
        'receivable' => r('accounts_receivable', ['contas-receber','contas_a_receber'], ['document','issueDate','dueDate','receivedDate','clientId','projectId','proposalId','categoryId','costCenterId','bankAccount','amount','status'], ['document']),
        'payable' => r('accounts_payable', ['contas-pagar','contas_a_pagar'], ['document','issueDate','dueDate','paidDate','supplierId','projectId','categoryId','costCenterId','bankAccount','amount','status'], ['document']),
        'cashMoves' => r('cash_bank_movements', ['movimentacoes-caixa','movimentacoes','movimentações'], ['date','bankAccount','type','categoryId','projectId','costCenterId','history','amount','originDocument','status'], ['originDocument']),
        'chartAccounts' => r('chart_accounts', ['plano-contas'], ['code','name','type','parentId','acceptsEntries','status'], ['code']),
        'journalEntries' => r('journal_entries', ['lancamentos-contabeis','lançamentos-contábeis'], ['entryDate','competenceDate','debitAccountId','creditAccountId','history','amount','projectId','costCenterId','originDocument'], ['originDocument']),
        'taxDocuments' => r('tax_documents', ['documentos-fiscais'], ['document','date','type','clientId','supplierId','projectId','amount','status'], ['document']),
        'taxes' => r('taxes', ['impostos'], ['name','competenceDate','baseAmount','rate','amount','projectId','status'], ['name','competenceDate']),
        'companySettings' => r('company_settings', ['dados-empresa'], ['name','document','zipCode','address','email','phone','city','status'], ['document','name']),
        'users' => r('system_users', ['usuarios','usuários'], ['username','fullName','password','role','status'], ['username'], ['password']),
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
            $clean[$field] = $field === 'password' && $value ? password_hash((string) $value, PASSWORD_DEFAULT) : $value;
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
    $sets = array_map(fn ($field) => "`$field` = ?", array_keys($data));
    $stmt = $pdo->prepare('UPDATE `' . $meta['table'] . '` SET ' . implode(',', $sets) . ' WHERE id = ?');
    $stmt->execute([...array_values($data), $id]);
    return get_record($pdo, $meta, $id);
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

function bootstrap_data(PDO $pdo, array $resources): array
{
    $data = [];
    foreach ($resources as $key => $meta) {
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
    respond(['ok' => true, 'user' => $user]);
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
