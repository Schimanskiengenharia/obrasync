-- Migração segura v1.8.0 - Importador SINAPI 04/2026 MS.
-- Execute no banco existente depois de backup. Não rode schema.sql por cima de dados reais.
--
-- RENOMEADA de 2026-06-08-sinapi-2026-04-ms-importer.sql na correção G4 (2026-07-03):
-- altera sinapi_referencias/orcamentos_obras, criadas por
-- 2026-06-08-sinapi-msproject-editable-structures.sql, que ordenava DEPOIS dela
-- alfabeticamente — num provisionamento só por migrations a sequência abortava aqui.
-- O conteúdo não mudou; o novo nome garante a ordem correta.

USE financeiro;

ALTER TABLE sinapi_referencias MODIFY priceType ENUM('Onerado', 'Desonerado', 'Sem desoneração', 'Com desoneração', 'Sem encargos sociais') NOT NULL DEFAULT 'Sem desoneração';
ALTER TABLE sinapi_referencias ADD COLUMN IF NOT EXISTS defaultUf CHAR(2) NULL AFTER source;
ALTER TABLE sinapi_referencias ADD COLUMN IF NOT EXISTS locationName VARCHAR(160) NULL AFTER defaultUf;
ALTER TABLE sinapi_referencias ADD COLUMN IF NOT EXISTS issueDate DATE NULL AFTER locationName;
ALTER TABLE sinapi_referencias ADD COLUMN IF NOT EXISTS availableTypes VARCHAR(255) NULL AFTER issueDate;

ALTER TABLE sinapi_insumos ADD COLUMN IF NOT EXISTS referenceType VARCHAR(40) NULL AFTER sinapiReferenceId;
ALTER TABLE sinapi_insumos ADD COLUMN IF NOT EXISTS uf CHAR(2) NULL AFTER referenceType;
ALTER TABLE sinapi_insumos ADD COLUMN IF NOT EXISTS classification VARCHAR(120) NULL AFTER uf;
ALTER TABLE sinapi_insumos ADD COLUMN IF NOT EXISTS priceOrigin VARCHAR(40) NULL AFTER unit;

ALTER TABLE sinapi_composicoes ADD COLUMN IF NOT EXISTS referenceType VARCHAR(40) NULL AFTER sinapiReferenceId;
ALTER TABLE sinapi_composicoes ADD COLUMN IF NOT EXISTS uf CHAR(2) NULL AFTER referenceType;
ALTER TABLE sinapi_composicoes ADD COLUMN IF NOT EXISTS percentAS DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER unitCost;

ALTER TABLE sinapi_composicao_itens MODIFY sinapiCompositionId BIGINT UNSIGNED NULL;
ALTER TABLE sinapi_composicao_itens ADD COLUMN IF NOT EXISTS sinapiReferenceId BIGINT UNSIGNED NULL AFTER id;
ALTER TABLE sinapi_composicao_itens ADD COLUMN IF NOT EXISTS compositionCode VARCHAR(80) NULL AFTER sinapiCompositionId;
ALTER TABLE sinapi_composicao_itens ADD COLUMN IF NOT EXISTS situation VARCHAR(80) NULL AFTER coefficient;
ALTER TABLE sinapi_composicao_itens ADD COLUMN IF NOT EXISTS createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER totalCost;
ALTER TABLE sinapi_composicao_itens ADD COLUMN IF NOT EXISTS updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER createdAt;

ALTER TABLE orcamentos_obras MODIFY priceType ENUM('Onerado', 'Desonerado', 'Sem desoneração', 'Com desoneração', 'Sem encargos sociais') NOT NULL DEFAULT 'Sem desoneração';
ALTER TABLE orcamento_obra_itens ADD COLUMN IF NOT EXISTS sinapiReferenceId BIGINT UNSIGNED NULL AFTER origin;
ALTER TABLE orcamento_obra_itens ADD COLUMN IF NOT EXISTS sinapiUf CHAR(2) NULL AFTER sinapiReferenceId;
ALTER TABLE orcamento_obra_itens ADD COLUMN IF NOT EXISTS sinapiReferenceType VARCHAR(80) NULL AFTER sinapiUf;

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
  INDEX idx_sinapi_labor_ref (sinapiReferenceId),
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
  INDEX idx_sinapi_family_ref (sinapiReferenceId),
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
  INDEX idx_sinapi_maint_ref (sinapiReferenceId),
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
VALUES ('v1.8.0', '2026-06-08', 'Importador SINAPI 04/2026 MS.', 'Referência padrão MS 04/2026, importador XLSX/CSV, mão de obra, famílias/coeficientes, manutenções, configuração SINAPI e integração com orçamento/proposta.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);
