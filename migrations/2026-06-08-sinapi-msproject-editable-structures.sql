-- Migração segura v1.6.0 - SINAPI, orçamentos de obras, MS Project e estruturas editáveis.
-- Execute no banco existente. Não rode schema.sql por cima de dados reais.

USE financeiro;

ALTER TABLE obra_cronograma_etapas ADD COLUMN IF NOT EXISTS workBudgetId BIGINT UNSIGNED NULL AFTER actualFinancialAmount;
ALTER TABLE obra_cronograma_etapas ADD COLUMN IF NOT EXISTS workBudgetItemId BIGINT UNSIGNED NULL AFTER workBudgetId;
ALTER TABLE obra_cronograma_etapas ADD COLUMN IF NOT EXISTS predecessorIds TEXT AFTER workBudgetItemId;
ALTER TABLE obra_cronograma_etapas ADD COLUMN IF NOT EXISTS durationDays INT NOT NULL DEFAULT 0 AFTER predecessorIds;
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS workBudgetId BIGINT UNSIGNED NULL AFTER budgetId;

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
  INDEX idx_etapa_padrao_tipo (workTypeId),
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
  INDEX idx_marco_padrao_tipo (workTypeId),
  INDEX idx_marco_padrao_etapa (standardStageId),
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
  INDEX idx_campo_tipo (workTypeId),
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
  INDEX idx_valor_project (projectId),
  INDEX idx_valor_campo (customFieldId),
  UNIQUE KEY uk_valor_project_campo (projectId, customFieldId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_referencias (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uf CHAR(2) NOT NULL,
  referenceMonth TINYINT UNSIGNED NOT NULL,
  referenceYear SMALLINT UNSIGNED NOT NULL,
  priceType ENUM('Onerado', 'Desonerado') NOT NULL DEFAULT 'Desonerado',
  source VARCHAR(120) NOT NULL DEFAULT 'SINAPI/CAIXA',
  importDate DATE NULL,
  importUserId BIGINT UNSIGNED NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sinapi_ref (uf, referenceMonth, referenceYear, priceType)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_insumos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sinapiReferenceId BIGINT UNSIGNED NOT NULL,
  code VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(40),
  unitPrice DECIMAL(15,4) NOT NULL DEFAULT 0,
  origin VARCHAR(80),
  category VARCHAR(120),
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_insumo_ref (sinapiReferenceId),
  INDEX idx_insumo_code (code),
  UNIQUE KEY uk_insumo_ref_code (sinapiReferenceId, code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_composicoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sinapiReferenceId BIGINT UNSIGNED NOT NULL,
  code VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(40),
  unitCost DECIMAL(15,4) NOT NULL DEFAULT 0,
  `type` VARCHAR(80),
  groupName VARCHAR(160),
  className VARCHAR(160),
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_composicao_ref (sinapiReferenceId),
  INDEX idx_composicao_code (code),
  UNIQUE KEY uk_composicao_ref_code (sinapiReferenceId, code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sinapi_composicao_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sinapiCompositionId BIGINT UNSIGNED NOT NULL,
  itemType ENUM('Insumo', 'Composição auxiliar') NOT NULL DEFAULT 'Insumo',
  itemCode VARCHAR(80),
  itemDescription TEXT,
  unit VARCHAR(40),
  coefficient DECIMAL(18,8) NOT NULL DEFAULT 0,
  unitPrice DECIMAL(15,4) NOT NULL DEFAULT 0,
  totalCost DECIMAL(15,4) NOT NULL DEFAULT 0,
  INDEX idx_comp_item_comp (sinapiCompositionId),
  UNIQUE KEY uk_comp_item (sinapiCompositionId, itemCode)
) ENGINE=InnoDB;

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
  priceType ENUM('Onerado', 'Desonerado') NOT NULL DEFAULT 'Desonerado',
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
  INDEX idx_orc_obra_project (projectId),
  INDEX idx_orc_obra_status (status),
  UNIQUE KEY uk_orc_obra_version (projectId, name, version)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orcamento_obra_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workBudgetId BIGINT UNSIGNED NOT NULL,
  projectId BIGINT UNSIGNED NULL,
  origin ENUM('SINAPI', 'Composição própria', 'Cotação manual', 'Item livre') NOT NULL DEFAULT 'Item livre',
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
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orc_item_budget (workBudgetId),
  INDEX idx_orc_item_project (projectId)
) ENGINE=InnoDB;

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
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cotacao_project (projectId),
  INDEX idx_cotacao_budget (workBudgetId)
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
  UNIQUE KEY uk_checklist_scope (name, workTypeId, standardStageId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS checklist_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  checklistId BIGINT UNSIGNED NOT NULL,
  description TEXT NOT NULL,
  `required` ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  sortOrder INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  INDEX idx_checklist_item (checklistId)
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
  UNIQUE KEY uk_regra_scope (`role`, module, workTypeId)
) ENGINE=InnoDB;

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES ('v1.6.0', '2026-06-08', 'SINAPI, orçamentos de obras, Microsoft Project e estruturas editáveis.', 'Base SINAPI, orçamentos por obra, itens, composições próprias, cotações, Curva ABC, exportação/importação MS Project e parametrizações pelo administrador.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);
