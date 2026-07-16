-- Schema MariaDB/MySQL para o sistema financeiro.
-- Os dados ficam no banco; arquivos/anexos/backups devem ficar fora de /var/www/financeiro.
--
-- Regenerado em 2026-07-03 (correção G4 da revisão geral): agora contém TODAS as
-- tabelas/colunas do estado atual do código — incluindo as que antes só existiam em
-- migrations/ ou nos ensure_* do api/index.php (qualidade_*, obra_rdo_*, ofx_*,
-- audit_log, login_attempts, user_permissions, viabilidade_*, cotacao_*, etc.).
-- Instalação nova = este arquivo + migrations/ em ordem alfabética (todas idempotentes).

CREATE DATABASE IF NOT EXISTS financeiro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE financeiro;

CREATE TABLE IF NOT EXISTS system_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  fullName VARCHAR(160) NOT NULL,
  email VARCHAR(160) NOT NULL DEFAULT '',
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'financeiro', 'comercial', 'engenharia', 'gestor_obra', 'equipe_campo', 'cliente_obra', 'fornecedor_terceiro', 'consulta', 'gerente', 'operador', 'visualizador') NOT NULL DEFAULT 'financeiro',
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  blocked TINYINT(1) NOT NULL DEFAULT 0,
  mustChangePassword TINYINT(1) NOT NULL DEFAULT 0,
  cpf VARCHAR(14) NULL,
  data_nascimento DATE NULL,
  celular VARCHAR(15) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_system_users_cpf (cpf)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  document VARCHAR(40),
  zipCode VARCHAR(20),
  address VARCHAR(255),
  email VARCHAR(160),
  phone VARCHAR(40),
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  numero VARCHAR(20) NULL,
  complemento VARCHAR(100) NULL,
  bairro VARCHAR(100) NULL,
  cidade VARCHAR(100) NULL,
  estado VARCHAR(2) NULL,
  INDEX idx_clients_name (name),
  INDEX idx_clients_document (document)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  document VARCHAR(40),
  zipCode VARCHAR(20),
  address VARCHAR(255),
  email VARCHAR(160),
  phone VARCHAR(40),
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  numero VARCHAR(20) NULL,
  complemento VARCHAR(100) NULL,
  bairro VARCHAR(100) NULL,
  cidade VARCHAR(100) NULL,
  estado VARCHAR(2) NULL,
  pbqph_nivel ENUM('nao_avaliado','aprovado','em_avaliacao','suspenso','reprovado') DEFAULT 'nao_avaliado',
  pbqph_letra VARCHAR(2) NULL COMMENT 'Nível do PBQP-H: A/B/C/D',
  pbqph_validade DATE NULL,
  iso9001 TINYINT(1) DEFAULT 0,
  iso9001_validade DATE NULL,
  datec TINYINT(1) DEFAULT 0 COMMENT 'Possui Documento de Avaliacao Tecnica SiNAT',
  datec_numero VARCHAR(50) NULL,
  abnt_marca TINYINT(1) DEFAULT 0 COMMENT 'Possui marca de conformidade ABNT',
  avaliacao_pontualidade TINYINT UNSIGNED NULL COMMENT 'Nota 1-5',
  avaliacao_qualidade TINYINT UNSIGNED NULL COMMENT 'Nota 1-5',
  avaliacao_preco TINYINT UNSIGNED NULL COMMENT 'Nota 1-5',
  avaliacao_data DATE NULL,
  avaliacao_responsavel VARCHAR(100) NULL,
  INDEX idx_suppliers_name (name),
  INDEX idx_suppliers_document (document)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cost_centers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40),
  name VARCHAR(140) NOT NULL,
  manager VARCHAR(140),
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  tipo ENUM('operacional','administrativo','tecnico','financeiro','fiscal_tributario') NOT NULL DEFAULT 'administrativo',
  descricao_uso TEXT NULL COMMENT 'O que deve ser lançado neste centro de custo',
  exemplos TEXT NULL COMMENT 'Exemplos de lançamentos para este centro',
  UNIQUE KEY uk_cost_centers_code (code),
  INDEX idx_cost_centers_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chart_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  `type` VARCHAR(60) NOT NULL,
  parentId BIGINT UNSIGNED NULL,
  acceptsEntries VARCHAR(10) NOT NULL DEFAULT 'Sim',
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  CONSTRAINT fk_chart_parent FOREIGN KEY (parentId) REFERENCES chart_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS financial_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  `type` ENUM('Receita', 'Despesa', 'Investimento') NOT NULL,
  chartAccountId BIGINT UNSIGNED NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  CONSTRAINT fk_category_chart FOREIGN KEY (chartAccountId) REFERENCES chart_accounts(id) ON DELETE SET NULL,
  INDEX idx_categories_type (`type`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  bank VARCHAR(120),
  agency VARCHAR(40),
  accountNumber VARCHAR(60),
  openingBalance DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  INDEX idx_bank_accounts_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  clientId BIGINT UNSIGNED NULL,
  address VARCHAR(255),
  zipCode VARCHAR(20),
  responsible VARCHAR(140),
  technicalResponsible VARCHAR(140),
  projectManagerId BIGINT UNSIGNED NULL,
  commercialUserId BIGINT UNSIGNED NULL,
  financialUserId BIGINT UNSIGNED NULL,
  startDate DATE NULL,
  endForecast DATE NULL,
  completionDate DATE NULL,
  status ENUM('Planejamento', 'Proposta enviada', 'Contratada', 'Em andamento', 'Pausada', 'Concluída', 'Cancelada') NOT NULL DEFAULT 'Planejamento',
  budgetForecast DECIMAL(15,2) NOT NULL DEFAULT 0,
  revenueContracted DECIMAL(15,2) NOT NULL DEFAULT 0,
  costForecast DECIMAL(15,2) NOT NULL DEFAULT 0,
  realizedCost DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  usa_endereco_empresa TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = usa endereço da empresa (company_settings); 0 = endereço próprio da obra',
  bairro VARCHAR(120) NULL,
  cidade VARCHAR(120) NULL,
  estado VARCHAR(2) NULL,
  deletedAt DATETIME NULL COMMENT 'Soft-delete (G3): NULL = obra ativa; preenchida = arquivada (nunca apagar fisicamente)',
  deletedBy BIGINT UNSIGNED NULL,
  archivedReason VARCHAR(255) NULL,
  CONSTRAINT fk_projects_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_projects_manager FOREIGN KEY (projectManagerId) REFERENCES system_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_projects_commercial_user FOREIGN KEY (commercialUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_projects_financial_user FOREIGN KEY (financialUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  INDEX idx_projects_client (clientId),
  INDEX idx_projects_status (status),
  INDEX idx_projects_deleted (deletedAt)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS project_schedule (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  stage VARCHAR(180) NOT NULL,
  startDate DATE NULL,
  endForecast DATE NULL,
  completionDate DATE NULL,
  physicalProgress DECIMAL(9,4) NOT NULL DEFAULT 0,
  financialProgress DECIMAL(9,4) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'Planejado',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_schedule_project (projectId),
  INDEX idx_schedule_dates (startDate, endForecast)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_cronograma_etapas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  stageName VARCHAR(180) NOT NULL,
  description TEXT,
  sortOrder INT NOT NULL DEFAULT 0,
  plannedStartDate DATE NULL,
  plannedEndDate DATE NULL,
  actualStartDate DATE NULL,
  actualEndDate DATE NULL,
  plannedPhysicalPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
  actualPhysicalPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
  plannedFinancialAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
  actualFinancialAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
  workBudgetId BIGINT UNSIGNED NULL,
  workBudgetItemId BIGINT UNSIGNED NULL,
  predecessorIds TEXT,
  durationDays INT NOT NULL DEFAULT 0,
  status ENUM('Não iniciada', 'Em andamento', 'Concluída', 'Atrasada', 'Pausada', 'Cancelada') NOT NULL DEFAULT 'Não iniciada',
  responsible VARCHAR(140),
  isMilestone ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  milestoneName VARCHAR(180),
  milestoneMessage TEXT,
  visibleToClient ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  servicoSiacId TINYINT UNSIGNED NULL,
  fvsId BIGINT UNSIGNED NULL,
  qualidadeBloqueada TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_obra_crono_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_obra_crono_project (projectId),
  INDEX idx_obra_crono_dates (plannedStartDate, plannedEndDate),
  INDEX idx_obra_crono_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_cronograma_marcos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  scheduleStepId BIGINT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  defaultMessage TEXT,
  visibleToClient ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  plannedDate DATE NULL,
  completedDate DATE NULL,
  status ENUM('Pendente', 'Concluído', 'Cancelado') NOT NULL DEFAULT 'Pendente',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_obra_marco_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_obra_marco_step FOREIGN KEY (scheduleStepId) REFERENCES obra_cronograma_etapas(id) ON DELETE SET NULL,
  INDEX idx_obra_marco_project (projectId),
  INDEX idx_obra_marco_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_links_acompanhamento (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  token VARCHAR(120) NOT NULL UNIQUE,
  url VARCHAR(500) NOT NULL,
  visibility ENUM('Interno', 'Cliente/Investidor') NOT NULL DEFAULT 'Interno',
  status ENUM('Ativo', 'Inativo') NOT NULL DEFAULT 'Ativo',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_obra_link_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_obra_link_project (projectId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_notificacoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  scheduleStepId BIGINT UNSIGNED NULL,
  milestoneId BIGINT UNSIGNED NULL,
  recipient VARCHAR(180) NOT NULL,
  phone VARCHAR(40),
  `type` ENUM('WhatsApp manual', 'ALERTA_VENCIMENTO') NOT NULL DEFAULT 'WhatsApp manual',
  message TEXT,
  generatedLink TEXT,
  status ENUM('Preparado', 'Enviado manualmente', 'Cancelado') NOT NULL DEFAULT 'Preparado',
  responsibleUserId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_obra_notif_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_obra_notif_step FOREIGN KEY (scheduleStepId) REFERENCES obra_cronograma_etapas(id) ON DELETE SET NULL,
  CONSTRAINT fk_obra_notif_marco FOREIGN KEY (milestoneId) REFERENCES obra_cronograma_marcos(id) ON DELETE SET NULL,
  CONSTRAINT fk_obra_notif_user FOREIGN KEY (responsibleUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  INDEX idx_obra_notif_project (projectId),
  INDEX idx_obra_notif_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS agenda_eventos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id BIGINT UNSIGNED NULL,
  cliente_id BIGINT UNSIGNED NULL,
  usuario_id BIGINT UNSIGNED NULL,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT NULL,
  tipo ENUM('reuniao','visita','vistoria','entrega','cobranca','projeto','obra','financeiro','comercial','prazo','outro') NOT NULL,
  data_inicio DATETIME NOT NULL,
  data_fim DATETIME NULL,
  dia_todo TINYINT(1) DEFAULT 0,
  lembrete_minutos INT DEFAULT 60,
  status ENUM('agendado','em_andamento','realizado','concluido','cancelado') DEFAULT 'agendado',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agenda_obra (obra_id),
  INDEX idx_agenda_cliente (cliente_id),
  INDEX idx_agenda_usuario (usuario_id),
  INDEX idx_agenda_periodo (data_inicio, data_fim),
  INDEX idx_agenda_tipo_status (tipo, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kanban_boards (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id BIGINT UNSIGNED NULL,
  nome VARCHAR(100) NOT NULL,
  tipo ENUM('obra','compras','geral') DEFAULT 'geral',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_kanban_boards_obra (obra_id),
  INDEX idx_kanban_boards_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kanban_colunas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  board_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(80) NOT NULL,
  ordem INT DEFAULT 0,
  cor VARCHAR(7) DEFAULT '#185FA5',
  limite_cards INT NULL,
  INDEX idx_kanban_colunas_board (board_id),
  CONSTRAINT fk_kanban_colunas_board FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kanban_cards (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  coluna_id BIGINT UNSIGNED NOT NULL,
  obra_id BIGINT UNSIGNED NULL,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT NULL,
  responsavel_id BIGINT UNSIGNED NULL,
  data_vencimento DATE NULL,
  prioridade ENUM('baixa','media','alta','urgente') DEFAULT 'media',
  referencia_tipo VARCHAR(30) NULL,
  referencia_id BIGINT UNSIGNED NULL,
  ordem INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_kanban_cards_coluna (coluna_id),
  INDEX idx_kanban_cards_obra (obra_id),
  INDEX idx_kanban_cards_vencimento (data_vencimento),
  INDEX idx_kanban_cards_referencia (referencia_tipo, referencia_id),
  CONSTRAINT fk_kanban_cards_coluna FOREIGN KEY (coluna_id) REFERENCES kanban_colunas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(80) NOT NULL UNIQUE,
  `date` DATE NOT NULL,
  projectId BIGINT UNSIGNED NULL,
  supplierId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  categoryId BIGINT UNSIGNED NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  expectedDate DATE NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Solicitado',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  condicoes_pagamento VARCHAR(200) NULL COMMENT 'Ex: 30 dias, À vista, 50% entrada + 50% entrega',
  desconto DECIMAL(10,2) DEFAULT 0,
  CONSTRAINT fk_purchase_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchase_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchase_category FOREIGN KEY (categoryId) REFERENCES financial_categories(id) ON DELETE SET NULL,
  INDEX idx_purchase_project (projectId),
  INDEX idx_purchase_supplier (supplierId),
  INDEX idx_purchase_date (`date`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS technical_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  `date` DATE NOT NULL,
  responsible VARCHAR(140),
  visibleToClient ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  status VARCHAR(50) NOT NULL DEFAULT 'Rascunho',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_technical_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_technical_project (projectId),
  INDEX idx_technical_date (`date`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  sku VARCHAR(80),
  categoryId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NULL,
  cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  stock DECIMAL(15,3) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  CONSTRAINT fk_products_category FOREIGN KEY (categoryId) REFERENCES financial_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  INDEX idx_products_sku (sku)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  categoryId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NULL,
  cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  CONSTRAINT fk_services_category FOREIGN KEY (categoryId) REFERENCES financial_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_services_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  CONSTRAINT fk_services_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS budgets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(60) NOT NULL UNIQUE,
  `date` DATE NOT NULL,
  clientId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NULL,
  proposalId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  createdByUserId BIGINT UNSIGNED NULL,
  commercialUserId BIGINT UNSIGNED NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Aberto',
  CONSTRAINT fk_budgets_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_budgets_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_budgets_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  CONSTRAINT fk_budgets_creator FOREIGN KEY (createdByUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_budgets_commercial FOREIGN KEY (commercialUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  INDEX idx_budgets_date (`date`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposal_areas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposal_action_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  areaId BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_action_area FOREIGN KEY (areaId) REFERENCES proposal_areas(id) ON DELETE CASCADE,
  UNIQUE KEY uk_action_area_name (areaId, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposal_service_subtypes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actionTypeId BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subtype_action FOREIGN KEY (actionTypeId) REFERENCES proposal_action_types(id) ON DELETE CASCADE,
  UNIQUE KEY uk_subtype_action_name (actionTypeId, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposal_models (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  areaId BIGINT UNSIGNED NULL,
  actionTypeId BIGINT UNSIGNED NULL,
  subtypeId BIGINT UNSIGNED NULL,
  proposalObject TEXT,
  scope TEXT,
  stages TEXT,
  deliverables TEXT,
  deadline VARCHAR(120),
  paymentTerms TEXT,
  includedItems TEXT,
  excludedItems TEXT,
  clientResponsibilities TEXT,
  companyResponsibilities TEXT,
  validityDays INT UNSIGNED NOT NULL DEFAULT 15,
  generalConditions TEXT,
  acceptanceText TEXT,
  signatureText TEXT,
  printLayout VARCHAR(80) NOT NULL DEFAULT 'Padrão A4',
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_model_area FOREIGN KEY (areaId) REFERENCES proposal_areas(id) ON DELETE SET NULL,
  CONSTRAINT fk_model_action FOREIGN KEY (actionTypeId) REFERENCES proposal_action_types(id) ON DELETE SET NULL,
  CONSTRAINT fk_model_subtype FOREIGN KEY (subtypeId) REFERENCES proposal_service_subtypes(id) ON DELETE SET NULL,
  INDEX idx_model_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS commercial_proposals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(80) NOT NULL UNIQUE,
  `date` DATE NOT NULL,
  clientId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NULL,
  budgetId BIGINT UNSIGNED NULL,
  workBudgetId BIGINT UNSIGNED NULL,
  serviceId BIGINT UNSIGNED NULL,
  modelId BIGINT UNSIGNED NULL,
  areaId BIGINT UNSIGNED NULL,
  actionTypeId BIGINT UNSIGNED NULL,
  subtypeId BIGINT UNSIGNED NULL,
  origin VARCHAR(80) NOT NULL DEFAULT 'Nova demanda',
  parentProposalId BIGINT UNSIGNED NULL,
  createdByUserId BIGINT UNSIGNED NULL,
  commercialUserId BIGINT UNSIGNED NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  proposalBody LONGTEXT,
  itemDisplayMode VARCHAR(80) NOT NULL DEFAULT 'Tabela resumida',
  paymentCondition TEXT,
  paymentTerms TEXT,
  executionDeadline VARCHAR(120),
  deadline VARCHAR(120),
  validityDate DATE NULL,
  technicalResponsible VARCHAR(160),
  commercialResponsible VARCHAR(160),
  commercialNotes TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'Rascunho',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  cliente_nome VARCHAR(200) NULL,
  cliente_cpf_cnpj VARCHAR(20) NULL,
  cliente_email VARCHAR(150) NULL,
  cliente_telefone VARCHAR(20) NULL,
  cliente_endereco TEXT NULL,
  cliente_cidade VARCHAR(100) NULL,
  cliente_estado VARCHAR(2) NULL,
  cliente_cep VARCHAR(10) NULL,
  bdi_geral DECIMAL(8,4) DEFAULT 0 COMMENT 'BDI geral aplicado sobre todos os itens',
  bdi_tipo ENUM('percentual','valor_fixo','por_item','misto') DEFAULT 'percentual' COMMENT 'Tipo de BDI aplicado (A=percentual, B=por_item/grupo, C=valor manual, D=misto)',
  custo_total_orcamentos DECIMAL(15,2) DEFAULT 0 COMMENT 'Soma dos custos dos orçamentos vinculados',
  valor_bdi_total DECIMAL(15,2) DEFAULT 0 COMMENT 'Valor total do BDI aplicado',
  modo_licitacao ENUM('Não','Sim') NOT NULL DEFAULT 'Não' COMMENT 'Proposta para licitação: usa preços SINAPI como referência máxima',
  CONSTRAINT fk_proposal_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_budget FOREIGN KEY (budgetId) REFERENCES budgets(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_service FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_model FOREIGN KEY (modelId) REFERENCES proposal_models(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_area FOREIGN KEY (areaId) REFERENCES proposal_areas(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_action FOREIGN KEY (actionTypeId) REFERENCES proposal_action_types(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_subtype FOREIGN KEY (subtypeId) REFERENCES proposal_service_subtypes(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_parent FOREIGN KEY (parentProposalId) REFERENCES commercial_proposals(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_creator FOREIGN KEY (createdByUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_commercial FOREIGN KEY (commercialUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  INDEX idx_proposal_client (clientId),
  INDEX idx_proposal_project (projectId),
  INDEX idx_proposal_status (status),
  INDEX idx_proposal_commercial (commercialUserId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposta_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proposalId BIGINT UNSIGNED NOT NULL,
  workBudgetItemId BIGINT UNSIGNED NULL,
  itemNumber INT NOT NULL DEFAULT 0,
  code VARCHAR(80),
  description TEXT NOT NULL,
  unit VARCHAR(40),
  quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  unitPrice DECIMAL(15,4) NOT NULL DEFAULT 0,
  totalPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
  groupName VARCHAR(180),
  visibleToClient ENUM('Não', 'Sim') NOT NULL DEFAULT 'Sim',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  custo_unitario DECIMAL(15,4) NULL COMMENT 'Custo real do item (base SINAPI ou orçamento)',
  bdi_item DECIMAL(8,4) NULL COMMENT 'BDI específico deste item, se diferente do geral',
  orcamento_item_id BIGINT UNSIGNED NULL COMMENT 'Item do orçamento técnico de origem (orcamento_obra_itens.id)',
  sinapi_id BIGINT UNSIGNED NULL COMMENT 'Composição SINAPI de origem (sinapi_composicoes.id)',
  grupo_id BIGINT UNSIGNED NULL COMMENT 'proposta_grupos.id',
  CONSTRAINT fk_prop_item_proposal FOREIGN KEY (proposalId) REFERENCES commercial_proposals(id) ON DELETE CASCADE,
  INDEX idx_prop_item_proposal (proposalId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposta_status_historico (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proposalId BIGINT UNSIGNED NOT NULL,
  `date` DATE NOT NULL,
  userId BIGINT UNSIGNED NULL,
  previousStatus VARCHAR(40),
  newStatus VARCHAR(40) NOT NULL,
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prop_hist_proposal FOREIGN KEY (proposalId) REFERENCES commercial_proposals(id) ON DELETE CASCADE,
  CONSTRAINT fk_prop_hist_user FOREIGN KEY (userId) REFERENCES system_users(id) ON DELETE SET NULL,
  INDEX idx_prop_hist_proposal (proposalId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposta_arquivos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proposalId BIGINT UNSIGNED NOT NULL,
  filePath VARCHAR(500) NOT NULL,
  `type` VARCHAR(60) NOT NULL DEFAULT 'PDF',
  status VARCHAR(40) NOT NULL DEFAULT 'Gerado',
  createdByUserId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prop_file_proposal FOREIGN KEY (proposalId) REFERENCES commercial_proposals(id) ON DELETE CASCADE,
  CONSTRAINT fk_prop_file_user FOREIGN KEY (createdByUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  INDEX idx_prop_file_proposal (proposalId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposta_orcamento_vinculos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proposalId BIGINT UNSIGNED NOT NULL,
  workBudgetId BIGINT UNSIGNED NOT NULL,
  projectId BIGINT UNSIGNED NULL,
  clientId BIGINT UNSIGNED NULL,
  proposalModelId BIGINT UNSIGNED NULL,
  responsibleUserId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  nome_grupo VARCHAR(200) NULL COMMENT 'Nome do grupo na proposta, ex: Cobertura Metálica',
  bdi_grupo DECIMAL(8,4) NULL COMMENT 'BDI específico deste grupo/orçamento (sobrepõe o geral)',
  custo_total DECIMAL(15,2) DEFAULT 0 COMMENT 'Custo total do orçamento vinculado',
  valor_venda DECIMAL(15,2) DEFAULT 0 COMMENT 'Valor de venda do grupo (custo + BDI)',
  ordem INT DEFAULT 0 COMMENT 'Ordem de exibição na proposta',
  grupo_id BIGINT UNSIGNED NULL COMMENT 'proposta_grupos.id (nível 2)',
  disciplina VARCHAR(60) NULL COMMENT 'Disciplina do grupo',
  descricao TEXT NULL COMMENT 'Descrição/escopo da disciplina exibida como seção na proposta',
  CONSTRAINT fk_prop_link_proposal FOREIGN KEY (proposalId) REFERENCES commercial_proposals(id) ON DELETE CASCADE,
  INDEX idx_prop_link_budget (workBudgetId),
  UNIQUE KEY uk_prop_budget_link (proposalId, workBudgetId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposta_variaveis (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proposalId BIGINT UNSIGNED NOT NULL,
  variableName VARCHAR(120) NOT NULL,
  variableValue TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prop_var_proposal FOREIGN KEY (proposalId) REFERENCES commercial_proposals(id) ON DELETE CASCADE,
  UNIQUE KEY uk_prop_var (proposalId, variableName)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales_contracts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(60) NOT NULL UNIQUE,
  `date` DATE NOT NULL,
  competenceDate DATE NULL,
  clientId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NULL,
  proposalId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Aberto',
  cliente_nome VARCHAR(200) NULL,
  cliente_cpf_cnpj VARCHAR(20) NULL,
  cliente_email VARCHAR(150) NULL,
  cliente_telefone VARCHAR(20) NULL,
  cliente_endereco TEXT NULL,
  cliente_cidade VARCHAR(100) NULL,
  cliente_estado VARCHAR(2) NULL,
  cliente_cep VARCHAR(10) NULL,
  numero_contrato VARCHAR(40) NULL,
  data_contrato DATE NULL,
  valor_contrato DECIMAL(14,2) NULL,
  objeto TEXT NULL COMMENT 'Objeto/escopo consolidado',
  status_contrato VARCHAR(30) NULL DEFAULT 'rascunho' COMMENT 'rascunho/gerado/assinado',
  proposta_assinada_path VARCHAR(255) NULL,
  contrato_gerado_path VARCHAR(255) NULL,
  contrato_assinado_path VARCHAR(255) NULL,
  cpf_cnpj VARCHAR(40) NULL,
  email VARCHAR(160) NULL,
  telefone VARCHAR(40) NULL,
  endereco VARCHAR(255) NULL,
  cidade VARCHAR(120) NULL,
  estado VARCHAR(2) NULL,
  cep VARCHAR(9) NULL,
  CONSTRAINT fk_sales_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_proposal FOREIGN KEY (proposalId) REFERENCES commercial_proposals(id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  INDEX idx_sales_date (`date`),
  INDEX idx_sales_project (projectId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accounts_receivable (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document VARCHAR(80) NOT NULL,
  issueDate DATE NULL,
  dueDate DATE NOT NULL,
  receivedDate DATE NULL,
  clientId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NULL,
  proposalId BIGINT UNSIGNED NULL,
  categoryId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  bankAccount VARCHAR(140),
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Aberto',
  ofxFitid VARCHAR(100) NULL COMMENT 'FITID do OFX vinculado — evita dupla contagem',
  ofxImportId BIGINT UNSIGNED NULL COMMENT 'ID em ofx_imports',
  referencia_tipo VARCHAR(30) NULL,
  referencia_id BIGINT UNSIGNED NULL,
  CONSTRAINT fk_receivable_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_receivable_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_receivable_proposal FOREIGN KEY (proposalId) REFERENCES commercial_proposals(id) ON DELETE SET NULL,
  CONSTRAINT fk_receivable_category FOREIGN KEY (categoryId) REFERENCES financial_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_receivable_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  INDEX idx_receivable_due_status (dueDate, status),
  INDEX idx_receivable_project (projectId),
  INDEX idx_receivable_client (clientId),
  INDEX idx_rec_fitid (ofxFitid)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accounts_payable (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document VARCHAR(80) NOT NULL,
  issueDate DATE NULL,
  dueDate DATE NOT NULL,
  paidDate DATE NULL,
  supplierId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NULL,
  categoryId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  bankAccount VARCHAR(140),
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Aberto',
  recorrencia_id VARCHAR(36) NULL COMMENT 'UUID do grupo de recorrência',
  parcela_numero INT NULL COMMENT 'Número da parcela ex: 1',
  parcela_total INT NULL COMMENT 'Total de parcelas ex: 12 (NULL = indeterminado)',
  recorrencia_tipo ENUM('mensal','bimestral','trimestral','semestral','anual') NULL,
  juros_aplicado DECIMAL(10,2) NULL COMMENT 'Valor de juros aplicado na quitação antecipada',
  valor_original DECIMAL(10,2) NULL COMMENT 'Valor original antes de juros ou desconto',
  referencia_tipo VARCHAR(30) NULL COMMENT 'Ex.: CAIXA_MANUAL quando foi baixada por um lançamento de caixa',
  referencia_id BIGINT UNSIGNED NULL COMMENT 'Id do registro referenciado (ex.: cash_bank_movements.id)',
  ofxFitid VARCHAR(100) NULL COMMENT 'FITID do OFX vinculado — evita dupla contagem',
  ofxImportId BIGINT UNSIGNED NULL COMMENT 'ID em ofx_imports',
  CONSTRAINT fk_payable_supplier FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_payable_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_payable_category FOREIGN KEY (categoryId) REFERENCES financial_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_payable_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  INDEX idx_payable_due_status (dueDate, status),
  INDEX idx_payable_project (projectId),
  INDEX idx_payable_supplier (supplierId),
  INDEX idx_recorrencia (recorrencia_id),
  INDEX idx_payable_referencia (referencia_tipo, referencia_id),
  INDEX idx_pay_fitid (ofxFitid)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fiscal_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NULL,
  -- opcional: lote de NFS-e pode ter obras diferentes ou nenhuma
  supplierId BIGINT UNSIGNED NULL,
  documentNumber VARCHAR(100) NOT NULL,
  issueDate DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  `type` ENUM('Nota Fiscal de Serviço', 'Nota Fiscal de Produto', 'Recibo', 'Comprovante', 'Outro') NOT NULL DEFAULT 'Nota Fiscal de Serviço',
  status ENUM('Pendente', 'Anexada', 'Conferida', 'Cancelada') NOT NULL DEFAULT 'Pendente',
  payableId BIGINT UNSIGNED NULL,
  receivableId BIGINT UNSIGNED NULL,
  saleId BIGINT UNSIGNED NULL,
  purchaseOrderId BIGINT UNSIGNED NULL COMMENT 'Pedido de compra da NF (aba Compras da Obra)',
  costCenterId BIGINT UNSIGNED NULL,
  categoryId BIGINT UNSIGNED NULL,
  pdfPath VARCHAR(500) NULL,
  xmlPath VARCHAR(500) NULL,
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fiscal_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_fiscal_supplier FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_payable FOREIGN KEY (payableId) REFERENCES accounts_payable(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_receivable FOREIGN KEY (receivableId) REFERENCES accounts_receivable(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_sale FOREIGN KEY (saleId) REFERENCES sales_contracts(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_category FOREIGN KEY (categoryId) REFERENCES financial_categories(id) ON DELETE SET NULL,
  INDEX idx_fiscal_project (projectId),
  INDEX idx_fiscal_supplier (supplierId),
  INDEX idx_fiscal_issue (issueDate),
  INDEX idx_fiscal_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cash_bank_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `date` DATE NOT NULL,
  bankAccount VARCHAR(140) NOT NULL,
  `type` ENUM('Entrada', 'Saída', 'Transferência') NOT NULL,
  categoryId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  history TEXT,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  originDocument VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'Confirmado',
  referencia_tipo VARCHAR(30) NULL COMMENT 'Ex.: CONTA_PAGAR quando o caixa quita uma conta a pagar',
  referencia_id BIGINT UNSIGNED NULL COMMENT 'Id do registro referenciado (ex.: accounts_payable.id)',
  CONSTRAINT fk_cash_category FOREIGN KEY (categoryId) REFERENCES financial_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_cash_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_cash_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  INDEX idx_cash_date (`date`),
  INDEX idx_cash_project (projectId),
  INDEX idx_cash_referencia (referencia_tipo, referencia_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entryDate DATE NOT NULL,
  competenceDate DATE NOT NULL,
  debitAccountId BIGINT UNSIGNED NULL,
  creditAccountId BIGINT UNSIGNED NULL,
  history TEXT,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  projectId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  originDocument VARCHAR(100),
  CONSTRAINT fk_journal_debit FOREIGN KEY (debitAccountId) REFERENCES chart_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_journal_credit FOREIGN KEY (creditAccountId) REFERENCES chart_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_journal_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_journal_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  INDEX idx_journal_competence (competenceDate)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tax_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document VARCHAR(100) NOT NULL,
  `date` DATE NOT NULL,
  `type` VARCHAR(60) NOT NULL,
  clientId BIGINT UNSIGNED NULL,
  supplierId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Emitido',
  CONSTRAINT fk_taxdoc_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_taxdoc_supplier FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_taxdoc_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS taxes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  competenceDate DATE NOT NULL,
  baseAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
  rate DECIMAL(9,4) NOT NULL DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  projectId BIGINT UNSIGNED NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Aberto',
  CONSTRAINT fk_taxes_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  INDEX idx_taxes_competence (competenceDate)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS company_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  document VARCHAR(40),
  zipCode VARCHAR(20),
  address VARCHAR(255),
  email VARCHAR(160),
  phone VARCHAR(40),
  city VARCHAR(140),
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  numero VARCHAR(20) NULL,
  complemento VARCHAR(100) NULL,
  bairro VARCHAR(100) NULL,
  estado VARCHAR(2) NULL,
  logo_url VARCHAR(500) NULL COMMENT 'Arquivo da logo salvo no servidor (ex.: logo.png)',
  website VARCHAR(200) NULL COMMENT 'Site da empresa ex: www.schimanskiengenharia.com.br',
  instagram VARCHAR(200) NULL,
  whatsapp VARCHAR(20) NULL COMMENT 'Número WhatsApp para contato ex: 5567999999999'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `role` VARCHAR(60) NOT NULL,
  module VARCHAR(100) NOT NULL,
  canView ENUM('Sim', 'Não') NOT NULL DEFAULT 'Sim',
  canCreate ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  canEdit ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  canDelete ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  canExport ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  canApprove ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  canAttach ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_module (`role`, module)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sistema_versoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  versao VARCHAR(40) NOT NULL UNIQUE,
  data_versao DATE NOT NULL,
  descricao TEXT,
  alteracoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS system_preferences (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  `value` TEXT,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_tipos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  sortOrder INT NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_obra_tipo_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_status (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  color VARCHAR(30),
  sortOrder INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_obra_status_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_etapas_padrao (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workTypeId BIGINT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  sortOrder INT NOT NULL DEFAULT 0,
  defaultPhysicalPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_etapa_padrao_tipo FOREIGN KEY (workTypeId) REFERENCES obra_tipos(id) ON DELETE SET NULL,
  UNIQUE KEY uk_etapa_tipo_name (workTypeId, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_marcos_padrao (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workTypeId BIGINT UNSIGNED NULL,
  standardStageId BIGINT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  defaultMessage TEXT,
  visibleToClient ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  sortOrder INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_marco_padrao_tipo FOREIGN KEY (workTypeId) REFERENCES obra_tipos(id) ON DELETE SET NULL,
  CONSTRAINT fk_marco_padrao_etapa FOREIGN KEY (standardStageId) REFERENCES obra_etapas_padrao(id) ON DELETE SET NULL,
  UNIQUE KEY uk_marco_tipo_name (workTypeId, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_campos_personalizados (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workTypeId BIGINT UNSIGNED NOT NULL,
  fieldName VARCHAR(160) NOT NULL,
  fieldType VARCHAR(40) NOT NULL DEFAULT 'Texto',
  `options` TEXT,
  `required` ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  sortOrder INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_campo_tipo FOREIGN KEY (workTypeId) REFERENCES obra_tipos(id) ON DELETE CASCADE,
  UNIQUE KEY uk_campo_tipo_name (workTypeId, fieldName)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_valores_personalizados (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  customFieldId BIGINT UNSIGNED NOT NULL,
  `value` TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_valor_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_valor_campo FOREIGN KEY (customFieldId) REFERENCES obra_campos_personalizados(id) ON DELETE CASCADE,
  UNIQUE KEY uk_valor_project_campo (projectId, customFieldId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_referencias (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uf CHAR(2) NOT NULL,
  referenceMonth TINYINT UNSIGNED NOT NULL,
  referenceYear SMALLINT UNSIGNED NOT NULL,
  priceType ENUM('Onerado', 'Desonerado', 'Sem desoneração', 'Com desoneração', 'Sem encargos sociais') NOT NULL DEFAULT 'Sem desoneração',
  source VARCHAR(120) NOT NULL DEFAULT 'SINAPI/CAIXA',
  defaultUf CHAR(2) NULL,
  locationName VARCHAR(160),
  issueDate DATE NULL,
  availableTypes VARCHAR(255),
  importDate DATE NULL,
  importUserId BIGINT UNSIGNED NULL,
  isDefault TINYINT(1) NOT NULL DEFAULT 0,
  defaultAt TIMESTAMP NULL DEFAULT NULL,
  importJobId VARCHAR(60) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sinapi_import_user FOREIGN KEY (importUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  UNIQUE KEY uk_sinapi_ref (uf, referenceMonth, referenceYear, priceType)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_insumos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sinapiReferenceId BIGINT UNSIGNED NOT NULL,
  referenceType VARCHAR(40),
  uf CHAR(2),
  classification VARCHAR(120),
  code VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(40),
  priceOrigin VARCHAR(40),
  unitPrice DECIMAL(15,4) NOT NULL DEFAULT 0,
  origin VARCHAR(80),
  category VARCHAR(120),
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_insumo_ref FOREIGN KEY (sinapiReferenceId) REFERENCES sinapi_referencias(id) ON DELETE CASCADE,
  UNIQUE KEY uk_insumo_ref_code (sinapiReferenceId, code),
  FULLTEXT KEY ft_insumo_description (description),
  INDEX idx_insumo_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_composicoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sinapiReferenceId BIGINT UNSIGNED NOT NULL,
  referenceType VARCHAR(40),
  uf CHAR(2),
  code VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(40),
  unitCost DECIMAL(15,4) NOT NULL DEFAULT 0,
  percentAS DECIMAL(12,6) NOT NULL DEFAULT 0,
  `type` VARCHAR(80),
  groupName VARCHAR(160),
  className VARCHAR(160),
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_composicao_ref FOREIGN KEY (sinapiReferenceId) REFERENCES sinapi_referencias(id) ON DELETE CASCADE,
  UNIQUE KEY uk_composicao_ref_code (sinapiReferenceId, code),
  FULLTEXT KEY ft_composicao_description (description),
  INDEX idx_comp_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_composicao_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sinapiReferenceId BIGINT UNSIGNED NULL,
  sinapiCompositionId BIGINT UNSIGNED NULL,
  compositionCode VARCHAR(80),
  itemType ENUM('Insumo', 'Composição auxiliar') NOT NULL DEFAULT 'Insumo',
  itemCode VARCHAR(80),
  itemDescription TEXT,
  unit VARCHAR(40),
  coefficient DECIMAL(18,8) NOT NULL DEFAULT 0,
  situation VARCHAR(80),
  unitPrice DECIMAL(15,4) NOT NULL DEFAULT 0,
  totalCost DECIMAL(15,4) NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_comp_item_ref FOREIGN KEY (sinapiReferenceId) REFERENCES sinapi_referencias(id) ON DELETE CASCADE,
  CONSTRAINT fk_comp_item_comp FOREIGN KEY (sinapiCompositionId) REFERENCES sinapi_composicoes(id) ON DELETE CASCADE,
  UNIQUE KEY uk_comp_item (sinapiCompositionId, itemCode),
  INDEX idx_comp_item_ref_code (sinapiReferenceId, compositionCode)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_mao_de_obra (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sinapiReferenceId BIGINT UNSIGNED NOT NULL,
  referenceType VARCHAR(40),
  uf CHAR(2) NOT NULL,
  groupName VARCHAR(160),
  compositionCode VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(40),
  laborPercent DECIMAL(12,6) NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sinapi_labor_ref FOREIGN KEY (sinapiReferenceId) REFERENCES sinapi_referencias(id) ON DELETE CASCADE,
  UNIQUE KEY uk_sinapi_labor (sinapiReferenceId, referenceType, uf, compositionCode)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_familias_coeficientes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sinapiReferenceId BIGINT UNSIGNED NOT NULL,
  familyCode VARCHAR(80) NOT NULL,
  inputCode VARCHAR(80) NOT NULL,
  inputDescription TEXT,
  unit VARCHAR(40),
  category VARCHAR(120),
  uf CHAR(2) NOT NULL,
  coefficient DECIMAL(18,8) NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sinapi_family_ref FOREIGN KEY (sinapiReferenceId) REFERENCES sinapi_referencias(id) ON DELETE CASCADE,
  UNIQUE KEY uk_sinapi_family (sinapiReferenceId, uf, familyCode, inputCode)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_manutencoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sinapiReferenceId BIGINT UNSIGNED NULL,
  referenceCode VARCHAR(80),
  itemType VARCHAR(60),
  code VARCHAR(80) NOT NULL,
  description TEXT,
  maintenanceType VARCHAR(160),
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sinapi_maint_ref FOREIGN KEY (sinapiReferenceId) REFERENCES sinapi_referencias(id) ON DELETE SET NULL,
  UNIQUE KEY uk_sinapi_maint (sinapiReferenceId, referenceCode, itemType, code, maintenanceType)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_configuracoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  defaultUf CHAR(2) NOT NULL DEFAULT 'MS',
  defaultReferenceMonth TINYINT UNSIGNED NOT NULL DEFAULT 4,
  defaultReferenceYear SMALLINT UNSIGNED NOT NULL DEFAULT 2026,
  defaultReferenceType VARCHAR(80) NOT NULL DEFAULT 'Sem desoneração',
  defaultBdiPercent DECIMAL(9,4) NOT NULL DEFAULT 25,
  defaultItemMode VARCHAR(40) NOT NULL DEFAULT 'Composições',
  showSinapiCodeInProposal ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  showAnalyticalInProposal ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  showUnitPriceInProposal ENUM('Não', 'Sim') NOT NULL DEFAULT 'Sim',
  showGlobalOnlyInProposal ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sinapi_config_default (defaultUf, defaultReferenceMonth, defaultReferenceYear, defaultReferenceType)
) ENGINE=InnoDB;

-- Indexação IA (embeddings da base SINAPI para busca semântica).
CREATE TABLE IF NOT EXISTS ia_embeddings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  origem ENUM('composicao','insumo') NOT NULL,
  origemId BIGINT UNSIGNED NOT NULL,
  code VARCHAR(80) NULL,
  texto TEXT NOT NULL,
  embedding LONGTEXT NOT NULL,
  sinapiReferenceId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_origem (origem, origemId),
  KEY idx_origem (origem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_index_jobs (
  id VARCHAR(64) PRIMARY KEY,
  status ENUM('queued','running','done','error') NOT NULL DEFAULT 'queued',
  total INT UNSIGNED NOT NULL DEFAULT 0,
  processados INT UNSIGNED NOT NULL DEFAULT 0,
  errorMessage TEXT NULL,
  startedAt TIMESTAMP NULL DEFAULT NULL,
  finishedAt TIMESTAMP NULL DEFAULT NULL,
  createdByUserId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- De-para em lote da IA: lotes (upload de planilha) + itens classificados.
CREATE TABLE IF NOT EXISTS ia_depara_jobs (
  id VARCHAR(64) PRIMARY KEY,
  nomeArquivo VARCHAR(255) NULL,
  total INT UNSIGNED NOT NULL DEFAULT 0,
  processados INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('queued','running','done','error') NOT NULL DEFAULT 'queued',
  colunasJson TEXT NULL,
  errorMessage TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  startedAt TIMESTAMP NULL DEFAULT NULL,
  finishedAt TIMESTAMP NULL DEFAULT NULL,
  userId BIGINT UNSIGNED NULL,
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_depara_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jobId VARCHAR(64) NOT NULL,
  grupoAba VARCHAR(160) NULL,
  linhaPlanilha INT UNSIGNED NULL,
  descricaoOrigem TEXT NOT NULL,
  codigoOrigem VARCHAR(80) NULL,
  quantidade DECIMAL(15,4) NULL,
  unidadeOrigem VARCHAR(40) NULL,
  valorOrigem DECIMAL(15,4) NULL,
  setor VARCHAR(160) NULL,
  categoria VARCHAR(160) NULL,
  tipoOrigem VARCHAR(120) NULL,
  materialUnit DECIMAL(15,4) NULL,
  maoObraUnit DECIMAL(15,4) NULL,
  custoDiretoUnit DECIMAL(15,4) NULL,
  bdiPercent DECIMAL(7,2) NULL,
  statusClassificacao ENUM('achou','revisar','divergente','cotacao_propria') NULL,
  matchOrigem ENUM('composicao','insumo') NULL,
  matchId BIGINT UNSIGNED NULL,
  matchCode VARCHAR(80) NULL,
  matchDescription TEXT NULL,
  matchUnit VARCHAR(40) NULL,
  matchValor DECIMAL(15,4) NULL,
  similaridade DECIMAL(5,2) NULL,
  top3Json TEXT NULL,
  aceito TINYINT NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_depara_item_job FOREIGN KEY (jobId) REFERENCES ia_depara_jobs(id) ON DELETE CASCADE,
  KEY idx_job (jobId),
  KEY idx_job_status (jobId, statusClassificacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comparador de orçamento da IA (Fase A): lotes + itens com comparação de preço.
CREATE TABLE IF NOT EXISTS ia_compara_jobs (
  id VARCHAR(64) PRIMARY KEY,
  nomeArquivo VARCHAR(255) NULL,
  total INT UNSIGNED NOT NULL DEFAULT 0,
  processados INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('queued','running','done','error') NOT NULL DEFAULT 'queued',
  colunasJson TEXT NULL,
  errorMessage TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  startedAt TIMESTAMP NULL DEFAULT NULL,
  finishedAt TIMESTAMP NULL DEFAULT NULL,
  userId BIGINT UNSIGNED NULL,
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_compara_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jobId VARCHAR(64) NOT NULL,
  linhaPlanilha INT UNSIGNED NULL,
  descricaoOrigem TEXT NOT NULL,
  codigoOrigem VARCHAR(80) NULL,
  unidadeOrigem VARCHAR(40) NULL,
  quantidadeOrigem DECIMAL(18,4) NULL,
  valorUnitOrigem DECIMAL(15,4) NULL,
  setor VARCHAR(160) NULL,
  categoria VARCHAR(160) NULL,
  tipoOrigem VARCHAR(120) NULL,
  materialUnit DECIMAL(15,4) NULL,
  maoObraUnit DECIMAL(15,4) NULL,
  custoDiretoUnit DECIMAL(15,4) NULL,
  bdiPercent DECIMAL(7,2) NULL,
  statusClassificacao ENUM('achou','faltou_importar','divergente','cotacao_propria') NULL,
  matchOrigem ENUM('composicao','insumo') NULL,
  matchId BIGINT UNSIGNED NULL,
  matchCode VARCHAR(80) NULL,
  matchDescription TEXT NULL,
  matchUnit VARCHAR(40) NULL,
  matchValor DECIMAL(15,4) NULL,
  similaridade DECIMAL(5,2) NULL,
  precoMaisBaixo ENUM('planilha','sinapi','igual','sem_comparacao') NULL,
  diferencaValor DECIMAL(15,4) NULL,
  diferencaPercent DECIMAL(12,2) NULL,
  totalOrigem DECIMAL(18,2) NULL,
  totalSinapi DECIMAL(18,2) NULL,
  diferencaTotal DECIMAL(18,2) NULL,
  aceito TINYINT NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_compara_item_job FOREIGN KEY (jobId) REFERENCES ia_compara_jobs(id) ON DELETE CASCADE,
  KEY idx_job (jobId),
  KEY idx_job_status (jobId, statusClassificacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sinapi_import_jobs (
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
  replaceExisting TINYINT(1) NOT NULL DEFAULT 0,
  packagePreviewJson LONGTEXT NULL,
  createdByUserId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  finishedAt TIMESTAMP NULL DEFAULT NULL,
  KEY idx_sinapi_job_status (status),
  KEY idx_sinapi_job_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sinapi_import_files (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jobId VARCHAR(60) NOT NULL,
  originalName VARCHAR(255) NOT NULL,
  storedPath VARCHAR(500) NOT NULL,
  fileType ENUM('reference','labor','families','maintenance','unknown') NOT NULL DEFAULT 'unknown',
  detectedUf CHAR(2) NULL,
  detectedMonth TINYINT UNSIGNED NULL,
  detectedYear SMALLINT UNSIGNED NULL,
  detectedPriceType VARCHAR(80) NULL,
  rowsFound INT NOT NULL DEFAULT 0,
  columnsJson LONGTEXT NULL,
  previewJson LONGTEXT NULL,
  alertsJson LONGTEXT NULL,
  status ENUM('aguardando','processando','concluido','erro') NOT NULL DEFAULT 'aguardando',
  errorMessage TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sinapi_import_files_job (jobId),
  INDEX idx_sinapi_import_files_type (fileType),
  INDEX idx_sinapi_import_files_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sinapi_import_errors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jobId VARCHAR(60) NOT NULL,
  fileName VARCHAR(255) NULL,
  fileType VARCHAR(40) NULL,
  rowNumber INT NULL,
  message TEXT NOT NULL,
  rawJson LONGTEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sinapi_import_errors_job (jobId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS composicoes_proprias (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(40),
  estimatedCost DECIMAL(15,2) NOT NULL DEFAULT 0,
  laborCost DECIMAL(15,2) NOT NULL DEFAULT 0,
  materialCost DECIMAL(15,2) NOT NULL DEFAULT 0,
  equipmentCost DECIMAL(15,2) NOT NULL DEFAULT 0,
  thirdPartyCost DECIMAL(15,2) NOT NULL DEFAULT 0,
  marginPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
  suggestedPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_composicao_propria_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orcamentos_obras (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  clientId BIGINT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  version VARCHAR(40) NOT NULL DEFAULT 'v1',
  budgetDate DATE NOT NULL,
  sinapiReferenceId BIGINT UNSIGNED NULL,
  priceType ENUM('Onerado', 'Desonerado', 'Sem desoneração', 'Com desoneração', 'Sem encargos sociais') NOT NULL DEFAULT 'Sem desoneração',
  status ENUM('Rascunho', 'Em análise', 'Aprovado', 'Recusado', 'Cancelado') NOT NULL DEFAULT 'Rascunho',
  bdiPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
  chargesPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
  discountPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
  directCost DECIMAL(15,2) NOT NULL DEFAULT 0,
  totalCost DECIMAL(15,2) NOT NULL DEFAULT 0,
  totalPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  createdByUserId BIGINT UNSIGNED NULL,
  commercialUserId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orc_obra_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orc_obra_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_orc_obra_ref FOREIGN KEY (sinapiReferenceId) REFERENCES sinapi_referencias(id) ON DELETE SET NULL,
  CONSTRAINT fk_orc_obra_creator FOREIGN KEY (createdByUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_orc_obra_commercial FOREIGN KEY (commercialUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  UNIQUE KEY uk_orc_obra_version (projectId, name, version),
  INDEX idx_orc_obra_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orcamento_obra_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workBudgetId BIGINT UNSIGNED NOT NULL,
  projectId BIGINT UNSIGNED NULL,
  origin ENUM('SINAPI', 'Composição própria', 'Cotação manual', 'Item livre') NOT NULL DEFAULT 'Item livre',
  sinapiReferenceId BIGINT UNSIGNED NULL,
  sinapiUf CHAR(2),
  sinapiReferenceType VARCHAR(80),
  code VARCHAR(80),
  description TEXT NOT NULL,
  unit VARCHAR(40),
  quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  unitCost DECIMAL(15,4) NOT NULL DEFAULT 0,
  totalCost DECIMAL(15,2) NOT NULL DEFAULT 0,
  bdiPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
  unitPrice DECIMAL(15,4) NOT NULL DEFAULT 0,
  totalPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
  stageName VARCHAR(180),
  costCenterId BIGINT UNSIGNED NULL,
  categoryId BIGINT UNSIGNED NULL,
  notes TEXT,
  sinapiSnapshotJson LONGTEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  quantidade_realizada DECIMAL(18,4) NOT NULL DEFAULT 0,
  codigo VARCHAR(20) NULL COMMENT 'Código hierárquico ex: 1.1.001',
  tipo ENUM('material','mao_de_obra','equipamento','subempreiteiro','outros') DEFAULT 'material' COMMENT 'Tipo do custo do item',
  etapa_id BIGINT UNSIGNED NULL COMMENT 'Etapa do orçamento (orcamento_etapas.id)',
  sinapi_id BIGINT UNSIGNED NULL COMMENT 'Composição SINAPI de origem',
  composicao_propria_id BIGINT UNSIGNED NULL COMMENT 'Composição própria de origem',
  ordem INT DEFAULT 0 COMMENT 'Ordem de exibição dentro da etapa',
  CONSTRAINT fk_orc_item_budget FOREIGN KEY (workBudgetId) REFERENCES orcamentos_obras(id) ON DELETE CASCADE,
  CONSTRAINT fk_orc_item_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_orc_item_sinapi_ref FOREIGN KEY (sinapiReferenceId) REFERENCES sinapi_referencias(id) ON DELETE SET NULL,
  CONSTRAINT fk_orc_item_cc FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  CONSTRAINT fk_orc_item_cat FOREIGN KEY (categoryId) REFERENCES financial_categories(id) ON DELETE SET NULL,
  INDEX idx_orc_item_budget (workBudgetId),
  INDEX idx_orc_item_project (projectId)
) ENGINE=InnoDB;

-- P1 (cotação por MATERIAL): quando categoriaId está preenchida, a linha é o
-- cabeçalho de uma cotação manual por material { obra, disciplina, tipo de item
-- opcional, material, unidade, quantidade } com status Em cotação/Concluída/
-- Cancelada; as propostas dos fornecedores ficam em cotacao_itens
-- (material_cotacao_id). Linhas antigas (CRUD genérico de cotações) seguem
-- convivendo na mesma tabela com categoriaId NULL.
CREATE TABLE IF NOT EXISTS cotacoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplierId BIGINT UNSIGNED NULL,
  description TEXT NOT NULL,
  unit VARCHAR(40),
  quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  unitValue DECIMAL(15,4) NOT NULL DEFAULT 0,
  totalValue DECIMAL(15,2) NOT NULL DEFAULT 0,
  quoteDate DATE NULL,
  validityDate DATE NULL,
  attachmentPath VARCHAR(500),
  projectId BIGINT UNSIGNED NULL,
  workBudgetId BIGINT UNSIGNED NULL,
  notes TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'Em cotação',
  categoriaId BIGINT UNSIGNED NULL COMMENT 'Disciplina (cotacao_categorias.id) — preenchida = cotação por material',
  tipoItemId BIGINT UNSIGNED NULL COMMENT 'Tipo de item (cotacao_tipos_item.id), opcional',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cotacao_supplier FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_cotacao_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_cotacao_budget FOREIGN KEY (workBudgetId) REFERENCES orcamentos_obras(id) ON DELETE SET NULL,
  INDEX idx_cotacao_project (projectId),
  INDEX idx_cotacao_budget (workBudgetId),
  INDEX idx_cotacoes_categoria (categoriaId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS modelos_relatorio (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  workTypeId BIGINT UNSIGNED NULL,
  serviceSubtypeId BIGINT UNSIGNED NULL,
  body TEXT,
  variables TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_modelo_rel_tipo FOREIGN KEY (workTypeId) REFERENCES obra_tipos(id) ON DELETE SET NULL,
  CONSTRAINT fk_modelo_rel_subtipo FOREIGN KEY (serviceSubtypeId) REFERENCES proposal_service_subtypes(id) ON DELETE SET NULL,
  UNIQUE KEY uk_modelo_rel_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tipos_documento (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  description TEXT,
  folder VARCHAR(120),
  visibleToClientDefault ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  UNIQUE KEY uk_tipo_documento_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS checklists (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  workTypeId BIGINT UNSIGNED NULL,
  standardStageId BIGINT UNSIGNED NULL,
  `required` ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  allowsPhoto ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  allowsAttachment ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_checklist_tipo FOREIGN KEY (workTypeId) REFERENCES obra_tipos(id) ON DELETE SET NULL,
  CONSTRAINT fk_checklist_etapa FOREIGN KEY (standardStageId) REFERENCES obra_etapas_padrao(id) ON DELETE SET NULL,
  UNIQUE KEY uk_checklist_scope (name, workTypeId, standardStageId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS checklist_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  checklistId BIGINT UNSIGNED NOT NULL,
  description TEXT NOT NULL,
  `required` ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  sortOrder INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  CONSTRAINT fk_checklist_item FOREIGN KEY (checklistId) REFERENCES checklists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tipos_medicao (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  description TEXT,
  unit VARCHAR(40),
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  UNIQUE KEY uk_tipo_medicao_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS formas_pagamento (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  description TEXT,
  installments INT NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  UNIQUE KEY uk_forma_pagamento_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mensagens_padrao (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  context VARCHAR(80) NOT NULL DEFAULT 'Obra',
  message TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  UNIQUE KEY uk_mensagem_context (name, context)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS regras_visualizacao (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `role` VARCHAR(60) NOT NULL,
  module VARCHAR(120) NOT NULL,
  workTypeId BIGINT UNSIGNED NULL,
  rule TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  CONSTRAINT fk_regra_tipo FOREIGN KEY (workTypeId) REFERENCES obra_tipos(id) ON DELETE SET NULL,
  UNIQUE KEY uk_regra_scope (`role`, module, workTypeId)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────────────────────
-- DADOS INICIAIS DE INSTALAÇÃO (executados apenas manualmente, no setup do zero).
-- O deploy automático e a API NUNCA executam este arquivo. Todos os INSERTs abaixo
-- são idempotentes e não alteram registros já existentes em produção.
-- ─────────────────────────────────────────────────────────────────────────────

-- Usuários iniciais: criados apenas se ainda não existirem (re-executar o schema
-- nunca reativa, desbloqueia ou altera usuários reais). Nenhuma senha real fica
-- versionada no repositório: o placeholder abaixo é a senha temporária do primeiro
-- login (o PHP aceita plaintext e converte para bcrypt) e mustChangePassword = 1
-- força a troca imediata. Em instalações novas, troque o placeholder antes de
-- executar ou faça o primeiro login imediatamente.
INSERT INTO system_users (username, fullName, password, role, status, blocked, mustChangePassword)
SELECT 'admin', 'Administrador', 'TROQUE_NO_PRIMEIRO_ACESSO', 'admin', 'Ativo', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM system_users WHERE username = 'admin');

INSERT INTO system_users (username, fullName, password, role, status, blocked, mustChangePassword)
SELECT 'alefschimanski', 'alefschimanski', 'TROQUE_NO_PRIMEIRO_ACESSO', 'admin', 'Ativo', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM system_users WHERE username = 'alefschimanski');

INSERT INTO sinapi_referencias (uf, referenceMonth, referenceYear, priceType, source, defaultUf, locationName, issueDate, availableTypes, importDate, status)
VALUES
  ('MS', 4, 2026, 'Sem desoneração', 'SINAPI/CAIXA', 'MS', 'Campo Grande/MS', '2026-05-12', 'Sem desoneração; Com desoneração; Sem encargos sociais', '2026-06-08', 'Ativo'),
  ('MS', 4, 2026, 'Com desoneração', 'SINAPI/CAIXA', 'MS', 'Campo Grande/MS', '2026-05-12', 'Sem desoneração; Com desoneração; Sem encargos sociais', '2026-06-08', 'Ativo'),
  ('MS', 4, 2026, 'Sem encargos sociais', 'SINAPI/CAIXA', 'MS', 'Campo Grande/MS', '2026-05-12', 'Sem desoneração; Com desoneração; Sem encargos sociais', '2026-06-08', 'Ativo')
ON DUPLICATE KEY UPDATE source = VALUES(source), status = VALUES(status);

INSERT INTO sinapi_configuracoes (defaultUf, defaultReferenceMonth, defaultReferenceYear, defaultReferenceType, defaultBdiPercent, defaultItemMode, showSinapiCodeInProposal, showAnalyticalInProposal, showUnitPriceInProposal, showGlobalOnlyInProposal, status)
VALUES ('MS', 4, 2026, 'Sem desoneração', 25, 'Composições', 'Não', 'Não', 'Sim', 'Não', 'Ativo')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES
  ('v1.3.0', '2026-06-06', 'Base integrada de gestão financeira, comercial e de obras.', 'Controle de versão, perfis preparados, obras como eixo central, dashboard consolidado e propostas comerciais por área/tipo/subtipo/modelo.'),
  ('v1.4.0', '2026-06-07', 'Cronograma físico-financeiro e WhatsApp manual.', 'Cronograma por obra, marcos, Gantt simplificado, histórico de notificações e responsividade reforçada.'),
  ('v1.5.0', '2026-06-07', 'ObraSync e revisão de integração geral.', 'Nome visual ObraSync, dashboard geral revisado, aliases de API e fluxo proposta-venda-conta a receber.'),
  ('v1.6.0', '2026-06-08', 'SINAPI, orçamentos de obras, Microsoft Project e estruturas editáveis.', 'Base SINAPI, orçamentos por obra, itens, composições próprias, cotações, Curva ABC, exportação/importação MS Project e parametrizações pelo administrador.'),
  ('v1.7.0', '2026-06-08', 'Gerador de proposta comercial a partir de orçamento de obra.', 'Seleção de modelo, variáveis dinâmicas, escopo gerado pelos itens, tabela de itens, rascunho/finalização, histórico de status e impressão/PDF A4 pelo navegador.'),
  ('v1.8.0', '2026-06-10', 'Importador SINAPI 04/2026 MS.', 'Referência padrão MS 04/2026, importador XLSX/CSV, mão de obra, famílias/coeficientes, manutenções, configuração SINAPI e integração com orçamento/proposta.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);

-- Permissões padrão: criadas apenas se ainda não existirem (não reativa linhas
-- desativadas pelo administrador em produção).
INSERT INTO role_permissions (`role`, module, canView, canCreate, canEdit, canDelete, canExport, canApprove, canAttach, status)
SELECT * FROM (
  SELECT 'admin' AS r, '*' AS m, 'Sim' AS v, 'Sim' AS c, 'Sim' AS e, 'Sim' AS d, 'Sim' AS x, 'Sim' AS a, 'Sim' AS t, 'Ativo' AS s
  UNION ALL SELECT 'financeiro', 'financeiro', 'Sim', 'Sim', 'Sim', 'Não', 'Sim', 'Sim', 'Sim', 'Ativo'
  UNION ALL SELECT 'comercial', 'propostas', 'Sim', 'Sim', 'Sim', 'Não', 'Sim', 'Não', 'Não', 'Ativo'
  UNION ALL SELECT 'engenharia', 'obras', 'Sim', 'Não', 'Sim', 'Não', 'Sim', 'Não', 'Sim', 'Ativo'
) defaults
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.`role` = defaults.r AND rp.module = defaults.m
);

INSERT INTO proposal_areas (name, description, status)
VALUES
  ('Engenharia Elétrica', 'Projetos, execução, laudos e consultoria elétrica.', 'Ativo'),
  ('Engenharia Civil', 'Projetos, execução, laudos e consultoria civil.', 'Ativo'),
  ('Arquitetura', 'Projetos arquitetônicos, interiores, regularização e acompanhamento.', 'Ativo'),
  ('Gestão de Obras', 'Planejamento, gestão, medição, relatórios e entrega.', 'Ativo'),
  ('Energia Solar Fotovoltaica', 'Projetos, execução, inspeções e consultoria solar.', 'Ativo')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_action_types (areaId, name, description, status)
SELECT id, 'Projetos', 'Projetos técnicos e documentos executivos.', 'Ativo' FROM proposal_areas WHERE name IN ('Engenharia Elétrica', 'Engenharia Civil', 'Arquitetura', 'Energia Solar Fotovoltaica')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_action_types (areaId, name, description, status)
SELECT id, 'Execução', 'Execução, reforma, instalação, adequação e manutenção.', 'Ativo' FROM proposal_areas WHERE name IN ('Engenharia Elétrica', 'Engenharia Civil', 'Energia Solar Fotovoltaica')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_action_types (areaId, name, description, status)
SELECT id, 'Laudos e relatórios', 'Laudos técnicos, inspeções, vistorias e relatórios.', 'Ativo' FROM proposal_areas WHERE name IN ('Engenharia Elétrica', 'Engenharia Civil', 'Arquitetura')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_action_types (areaId, name, description, status)
SELECT id, 'Gestão', 'Gestão de obra, fiscalização, medição e controle de fornecedores.', 'Ativo' FROM proposal_areas WHERE name = 'Gestão de Obras'
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_service_subtypes (actionTypeId, name, description, status)
SELECT pat.id, seed.name, seed.description, 'Ativo'
FROM proposal_action_types pat
JOIN proposal_areas pa ON pa.id = pat.areaId
JOIN (
  SELECT 'Engenharia Elétrica' area_name, 'Projetos' action_name, 'Instalações elétricas de baixa tensão' name, 'Projeto elétrico completo em baixa tensão.' description
  UNION ALL SELECT 'Engenharia Elétrica', 'Projetos', 'SPDA e aterramento', 'Projeto de proteção contra descargas atmosféricas e aterramento.'
  UNION ALL SELECT 'Engenharia Elétrica', 'Projetos', 'Padrão de entrada / agrupamento de medição', 'Projeto e regularização de padrão de entrada.'
  UNION ALL SELECT 'Engenharia Elétrica', 'Execução', 'Reforma elétrica', 'Adequação e modernização de instalações elétricas.'
  UNION ALL SELECT 'Engenharia Elétrica', 'Execução', 'Manutenção elétrica', 'Manutenção preventiva e corretiva.'
  UNION ALL SELECT 'Engenharia Elétrica', 'Laudos e relatórios', 'Laudo técnico elétrico', 'Laudo técnico com diagnóstico e recomendações.'
  UNION ALL SELECT 'Engenharia Civil', 'Projetos', 'Projeto estrutural', 'Projeto estrutural civil.'
  UNION ALL SELECT 'Engenharia Civil', 'Projetos', 'Projeto hidrossanitário', 'Projeto hidrossanitário e documentação técnica.'
  UNION ALL SELECT 'Engenharia Civil', 'Execução', 'Reforma', 'Execução de reforma civil.'
  UNION ALL SELECT 'Engenharia Civil', 'Laudos e relatórios', 'Relatório de medição', 'Relatório técnico de medição de obra.'
  UNION ALL SELECT 'Arquitetura', 'Projetos', 'Projeto arquitetônico', 'Projeto arquitetônico completo.'
  UNION ALL SELECT 'Arquitetura', 'Projetos', 'Projeto legal para prefeitura', 'Projeto legal para aprovação municipal.'
  UNION ALL SELECT 'Gestão de Obras', 'Gestão', 'Relatórios periódicos', 'Relatórios de acompanhamento físico e financeiro.'
  UNION ALL SELECT 'Gestão de Obras', 'Gestão', 'Controle de fornecedores', 'Gestão e controle de fornecedores vinculados à obra.'
  UNION ALL SELECT 'Energia Solar Fotovoltaica', 'Projetos', 'Sistema on-grid', 'Projeto fotovoltaico conectado à rede.'
  UNION ALL SELECT 'Energia Solar Fotovoltaica', 'Projetos', 'Grid zero', 'Solução com controle de exportação.'
  UNION ALL SELECT 'Energia Solar Fotovoltaica', 'Execução', 'Instalação comercial', 'Instalação fotovoltaica comercial.'
  UNION ALL SELECT 'Energia Solar Fotovoltaica', 'Execução', 'Retrofit', 'Retrofit e adequação de sistema fotovoltaico.'
) seed ON seed.area_name = pa.name AND seed.action_name = pat.name
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_models (
  name, areaId, actionTypeId, subtypeId, proposalObject, scope, stages, deliverables,
  deadline, paymentTerms, includedItems, excludedItems, clientResponsibilities,
  companyResponsibilities, validityDays, generalConditions, acceptanceText, signatureText, printLayout, status
)
SELECT
  'Projeto elétrico comercial',
  pa.id,
  pat.id,
  pst.id,
  'Elaboração de projeto elétrico comercial para {{nome_obra}}.',
  'Levantamento técnico, dimensionamento, diagramas, quadros, iluminação, tomadas e memorial descritivo.',
  '1. Levantamento; 2. Anteprojeto; 3. Projeto executivo; 4. Entrega técnica.',
  'Pranchas, memorial descritivo, lista de materiais e ART/RRT quando aplicável.',
  '30 dias',
  '40% na aprovação, 40% na entrega preliminar e 20% no aceite.',
  'Reuniões técnicas, arquivos PDF e revisão técnica.',
  'Taxas, execução da obra e aprovações externas não contratadas.',
  'Fornecer documentos, acesso ao local e informações de carga.',
  'Elaborar documentos técnicos e orientar ajustes necessários.',
  15,
  'Esta proposta considera as premissas técnicas informadas até a data de emissão. Alterações de escopo poderão gerar revisão comercial.',
  'Aceite eletrônico ou assinatura da proposta.',
  'Schimanski Engenharia\nResponsável técnico: {{responsavel_tecnico}}\nCREA/CAU: {{crea_cau}}',
  'Padrão A4',
  'Ativo'
FROM proposal_areas pa
JOIN proposal_action_types pat ON pat.areaId = pa.id AND pat.name = 'Projetos'
JOIN proposal_service_subtypes pst ON pst.actionTypeId = pat.id AND pst.name = 'Instalações elétricas de baixa tensão'
WHERE pa.name = 'Engenharia Elétrica'
  AND NOT EXISTS (SELECT 1 FROM proposal_models WHERE name = 'Projeto elétrico comercial');

-- Sessões de autenticação da API (token Bearer emitido no login).
CREATE TABLE IF NOT EXISTS api_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  tokenHash CHAR(64) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastActivity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_api_sessions_token (tokenHash),
  KEY idx_api_sessions_user (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tokens de redefinição de senha via email (expiram em 2 h, uso único).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId     BIGINT UNSIGNED NOT NULL,
  tokenHash  CHAR(64)        NOT NULL,
  expiresAt  TIMESTAMP       NOT NULL,
  usedAt     TIMESTAMP       NULL DEFAULT NULL,
  createdAt  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_prt_token (tokenHash),
  KEY idx_prt_user (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Análises de viabilidade por obra/projeto (margem, payback, VPL, TIR e parecer).
CREATE TABLE IF NOT EXISTS viability_analyses (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Menu Plugins: links para sistemas externos no menu lateral, geridos pelo admin.
CREATE TABLE IF NOT EXISTS system_plugins (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exemplo opcional de plugin (apenas em instalação nova, com a tabela vazia).
INSERT INTO system_plugins (name, url, icon, description, roles, sortOrder, status)
SELECT 'Portal do Cliente', 'https://schimanskiengenharia.com.br/portal', '🌐',
       'Acesso ao portal externo do cliente (URL configurável).', '', 1, 'Ativo'
WHERE NOT EXISTS (SELECT 1 FROM system_plugins);

-- ============================================================================
-- Tabelas criadas por migrations e/ou ensure_* (api/index.php) e que faltavam
-- aqui — incorporadas na regeneração do schema (correção G4, 2026-07-03).
-- Ordem respeita as dependências de FK.
-- ============================================================================

CREATE TABLE IF NOT EXISTS eventos_automacao (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipo_evento VARCHAR(60) NOT NULL,
  entidade_origem_tipo VARCHAR(60) NULL,
  entidade_origem_id BIGINT UNSIGNED NULL,
  entidade_gerada_tipo VARCHAR(60) NULL,
  entidade_gerada_id BIGINT UNSIGNED NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OK',
  mensagem_erro TEXT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_eventos_automacao_tipo (tipo_evento),
  INDEX idx_eventos_automacao_origem (entidade_origem_tipo, entidade_origem_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orcamento_item_execucao_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  quantidade_anterior DECIMAL(18,4) NOT NULL DEFAULT 0,
  quantidade_nova DECIMAL(18,4) NOT NULL DEFAULT 0,
  origem VARCHAR(30) DEFAULT 'manual' COMMENT 'manual | pedido_compra',
  motivo VARCHAR(255) NULL,
  usuario_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exec_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orcamento_etapas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  orcamento_id BIGINT UNSIGNED NOT NULL,
  obra_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(200) NOT NULL,
  codigo VARCHAR(10) NULL COMMENT 'Ex: 1, 2, 3',
  ordem INT DEFAULT 0,
  bdi_especifico DECIMAL(5,2) NULL
    COMMENT 'BDI específico desta etapa — se nulo usa o BDI geral',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orcamento (orcamento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  descricao VARCHAR(300) NOT NULL,
  unidade VARCHAR(20) DEFAULT 'un',
  quantidade DECIMAL(10,3) NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_total DECIMAL(16,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  work_budget_item_id BIGINT UNSIGNED NULL
    COMMENT 'Vínculo opcional ao item do orçamento (orcamento_obra_itens.id)',
  observacao VARCHAR(200) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pedido (purchase_order_id),
  INDEX idx_poi_budget_item (work_budget_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cotacao_fornecedor (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id BIGINT UNSIGNED NULL,
  purchase_order_id BIGINT UNSIGNED NULL,
  fornecedor_id BIGINT UNSIGNED NULL,
  fornecedor_nome VARCHAR(200) NOT NULL COMMENT 'Nome mesmo que nao seja cadastrado',
  data_cotacao DATE NULL,
  validade_cotacao DATE NULL,
  arquivo_original VARCHAR(500) NULL COMMENT 'Caminho do PDF ou Excel original',
  arquivo_nome VARCHAR(200) NULL,
  arquivo_tipo VARCHAR(10) NULL COMMENT 'pdf, xlsx, xls, csv',
  status ENUM('importada','comparada','aprovada','reprovada') DEFAULT 'importada',
  score DECIMAL(5,2) NULL COMMENT 'Score geral da comparacao (% itens <= orcamento)',
  observacoes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cf_obra (obra_id),
  INDEX idx_cf_pedido (purchase_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cada linha é (a) um item de cotação importada/de compra (cotacao_id →
-- cotacao_fornecedor) OU (b) uma PROPOSTA manual de fornecedor numa cotação por
-- material (material_cotacao_id → cotacoes + fornecedor_id → suppliers, com
-- cotacao_id NULL). Na proposta, diferenca_percentual é vs a proposta MAIS
-- BARATA do material (menor = 0%), com clamp.
CREATE TABLE IF NOT EXISTS cotacao_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cotacao_id BIGINT UNSIGNED NULL,
  descricao VARCHAR(500) NOT NULL,
  unidade VARCHAR(20) NULL,
  quantidade DECIMAL(15,4) NULL,
  valor_unitario DECIMAL(15,4) NULL,
  valor_total DECIMAL(15,4) NULL,
  marca VARCHAR(100) NULL,
  prazo_entrega VARCHAR(100) NULL,
  observacao VARCHAR(300) NULL,
  orcamento_item_id BIGINT UNSIGNED NULL COMMENT 'Item do orcamento de obra vinculado',
  diferenca_percentual DECIMAL(12,2) NULL COMMENT 'Diferenca % em relacao ao CUSTO orcado (sem BDI), com clamp',
  status_comparacao ENUM('nao_comparado','abaixo','igual','acima','muito_acima') DEFAULT 'nao_comparado',
  vencedor TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Fornecedor vencedor da cotacao de compra deste item',
  material_cotacao_id BIGINT UNSIGNED NULL COMMENT 'Proposta manual: cotacao por material (cotacoes.id)',
  fornecedor_id BIGINT UNSIGNED NULL COMMENT 'Proposta manual: fornecedor do cadastro (suppliers.id)',
  INDEX idx_cotacao (cotacao_id),
  INDEX idx_orcamento_item (orcamento_item_id),
  INDEX idx_ci_material (material_cotacao_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS qualidade_politica (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conteudo TEXT NOT NULL,
  versao VARCHAR(20) NOT NULL DEFAULT '1.0',
  aprovadoPor VARCHAR(120) NULL,
  dataAprovacao DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Rascunho',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_pes (
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
  arquivoPdf VARCHAR(500) NULL COMMENT 'Caminho do PDF do procedimento',
  arquivoNome VARCHAR(200) NULL,
  arquivoData TIMESTAMP NULL,
  KEY idx_pes_servico (servicoSiacId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_pqo (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_fvs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_fvm (
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
  lote VARCHAR(100) NULL,
  fabricante VARCHAR(200) NULL,
  dataFabricacao DATE NULL,
  validade DATE NULL,
  localAplicacao VARCHAR(300) NULL COMMENT 'Ex: Bloco A - 2 pavimento - fachada norte',
  certificadoQualidade TINYINT(1) DEFAULT 0 COMMENT 'Certificado do produto recebido',
  purchaseOrderId BIGINT UNSIGNED NULL COMMENT 'Vínculo com purchase_orders.id',
  KEY idx_fvm_project (projectId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_nc (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_treinamentos (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_auditorias (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS viabilidade_analises (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id BIGINT UNSIGNED NULL,
  proposta_id BIGINT UNSIGNED NULL,
  cliente_id BIGINT UNSIGNED NULL,
  tipo_obra VARCHAR(50) NOT NULL
    COMMENT 'energia_solar, obra_civil, eletrica, ar_condicionado, cobertura, hidraulica, manutencao, outro',
  nome VARCHAR(200) NOT NULL,
  status ENUM('em_andamento','aprovada','bloqueada','concluida') DEFAULT 'em_andamento',
  progresso_geral DECIMAL(5,2) DEFAULT 0,
  responsavel_id BIGINT UNSIGNED NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_obra (obra_id),
  INDEX idx_proposta (proposta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS viabilidade_grupos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analise_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(100) NOT NULL
    COMMENT 'Ex: Técnica, Financeira, Concessionária',
  tipo VARCHAR(50) NOT NULL
    COMMENT 'tecnica, financeira, legal, ambiental, concessionaria, operacional, mercado',
  obrigatorio TINYINT(1) DEFAULT 1
    COMMENT '1 = obrigatório bloqueia proposta, 0 = opcional',
  ordem INT DEFAULT 0,
  progresso DECIMAL(5,2) DEFAULT 0,
  INDEX idx_analise (analise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS viabilidade_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  grupo_id BIGINT UNSIGNED NOT NULL,
  analise_id BIGINT UNSIGNED NOT NULL,
  descricao VARCHAR(300) NOT NULL,
  status ENUM('nao_iniciado','em_andamento','aguardando_terceiro',
    'aprovado','reprovado') DEFAULT 'nao_iniciado',
  obrigatorio TINYINT(1) DEFAULT 1,
  responsavel VARCHAR(100) NULL,
  prazo DATE NULL
    COMMENT 'Prazo para itens aguardando terceiro',
  data_verificacao DATE NULL,
  observacao TEXT NULL,
  terceiro_nome VARCHAR(100) NULL
    COMMENT 'Ex: ENERGISA, Prefeitura, Condomínio',
  ordem INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_grupo (grupo_id),
  INDEX idx_analise (analise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS viabilidade_anexos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  nome_arquivo VARCHAR(200) NOT NULL,
  caminho VARCHAR(500) NOT NULL,
  tipo_arquivo VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS proposta_grupos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proposalId BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NULL COMMENT 'FK lógica p/ proposta_grupos.id (aninhamento)',
  nivel TINYINT NOT NULL DEFAULT 1,
  ordem INT NOT NULL DEFAULT 0,
  disciplina VARCHAR(60) NULL COMMENT 'Elétrico, Hidráulico, Civil, etc.',
  nome VARCHAR(200) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pg_proposal (proposalId),
  INDEX idx_pg_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS proposta_modelos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  descricao TEXT NULL,
  disciplina VARCHAR(60) NULL,
  estrutura_json LONGTEXT NULL COMMENT 'Snapshot da árvore grupos/orçamentos/itens, sem cliente nem valores finais',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pm_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seletividade_estudos (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId    BIGINT UNSIGNED NOT NULL,
  nome      VARCHAR(200) NOT NULL COMMENT 'Nome do projeto/estudo',
  dadosJson LONGTEXT NOT NULL COMMENT 'Todos os campos do formulário em JSON',
  calcJson  LONGTEXT NULL COMMENT 'Resultado do último cálculo em JSON',
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sel_user (userId),
  KEY idx_sel_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ofx_fitids (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fitid         VARCHAR(100)    NOT NULL,
  bankAccountId BIGINT UNSIGNED NOT NULL,
  cashMoveId    BIGINT UNSIGNED NULL COMMENT 'ID em cash_bank_movements',
  importedAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_fitid_account (fitid, bankAccountId),
  KEY idx_ofx_account (bankAccountId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ofx_imports (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS obra_disciplinas (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS obra_rdo (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS obra_rdo_disciplinas (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS obra_rdo_assinaturas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rdoId BIGINT UNSIGNED NOT NULL,
  tipo ENUM('Geral','Disciplina') NOT NULL,
  disciplinaNome VARCHAR(80) NULL,
  assinanteNome VARCHAR(120) NULL,
  assinanteUserId BIGINT UNSIGNED NULL,
  evento ENUM('Assinatura','Reabertura') NOT NULL DEFAULT 'Assinatura',
  assinadoEm TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rdoass_rdo (rdoId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS obra_rdo_fotos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rdoId BIGINT UNSIGNED NOT NULL,
  caminho VARCHAR(300) NOT NULL,
  legenda VARCHAR(200) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rdo_foto (rdoId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  context VARCHAR(20) NOT NULL DEFAULT 'login',
  username VARCHAR(190) NOT NULL DEFAULT '',
  ip VARCHAR(45) NOT NULL DEFAULT '',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attempt_user (context, username, createdAt),
  KEY idx_attempt_ip (context, ip, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
