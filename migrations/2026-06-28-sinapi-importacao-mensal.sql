-- Importacao mensal SINAPI dentro de Orcamento de Obra > Base SINAPI.
-- Idempotente: complementa as tabelas existentes sem recriar a base SINAPI.

USE financeiro;

ALTER TABLE sinapi_referencias
  ADD COLUMN IF NOT EXISTS isDefault TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defaultAt TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS importJobId VARCHAR(60) NULL;

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
  createdByUserId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  finishedAt TIMESTAMP NULL DEFAULT NULL,
  KEY idx_sinapi_job_status (status),
  KEY idx_sinapi_job_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE sinapi_import_jobs
  ADD COLUMN IF NOT EXISTS replaceExisting TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packagePreviewJson LONGTEXT NULL;

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

ALTER TABLE orcamento_obra_itens
  ADD COLUMN IF NOT EXISTS sinapiSnapshotJson LONGTEXT NULL;

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES ('v1.19.0', '2026-06-28', 'Importacao mensal SINAPI com pacote, previa e referencia padrao.',
  'Base SINAPI passa a receber pacote mensal XLSX com preview, historico por arquivo, reimportacao controlada, referencia padrao atual e snapshot SINAPI no item do orcamento.')
ON DUPLICATE KEY UPDATE alteracoes = VALUES(alteracoes);
