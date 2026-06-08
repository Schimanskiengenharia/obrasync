-- Migração segura v1.7.0 - Gerador de proposta comercial a partir de orçamento de obra.
-- Execute no banco existente depois de backup. Não rode schema.sql por cima de dados reais.

USE financeiro;

ALTER TABLE proposal_models ADD COLUMN IF NOT EXISTS generalConditions TEXT AFTER validityDays;
ALTER TABLE proposal_models ADD COLUMN IF NOT EXISTS signatureText TEXT AFTER acceptanceText;
ALTER TABLE proposal_models ADD COLUMN IF NOT EXISTS printLayout VARCHAR(80) NOT NULL DEFAULT 'Padrão A4' AFTER signatureText;

ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS proposalBody LONGTEXT AFTER amount;
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS itemDisplayMode VARCHAR(80) NOT NULL DEFAULT 'Tabela resumida' AFTER proposalBody;
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS paymentCondition TEXT AFTER itemDisplayMode;
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS executionDeadline VARCHAR(120) AFTER paymentTerms;
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS technicalResponsible VARCHAR(160) AFTER validityDate;
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS commercialResponsible VARCHAR(160) AFTER technicalResponsible;
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS commercialNotes TEXT AFTER commercialResponsible;

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
  INDEX idx_prop_link_budget (workBudgetId),
  UNIQUE KEY uk_prop_budget_link (proposalId, workBudgetId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposta_variaveis (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proposalId BIGINT UNSIGNED NOT NULL,
  variableName VARCHAR(120) NOT NULL,
  variableValue TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_prop_var (proposalId, variableName)
) ENGINE=InnoDB;

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES ('v1.7.0', '2026-06-08', 'Gerador de proposta comercial a partir de orçamento de obra.', 'Seleção de modelo, variáveis dinâmicas, escopo gerado pelos itens, tabela de itens, rascunho/finalização, histórico de status e impressão/PDF A4 pelo navegador.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);
