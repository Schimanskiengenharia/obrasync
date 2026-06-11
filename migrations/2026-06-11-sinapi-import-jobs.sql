-- Importador SINAPI em background: tabela de jobs para o polling de progresso.
-- A API também cria a tabela sob demanda (ensure_sinapi_import_jobs_table), então
-- esta migration é opcional em instalações já atualizadas — fica como documentação
-- e para provisionamento manual.

CREATE TABLE IF NOT EXISTS sinapi_import_jobs (
  id VARCHAR(60) PRIMARY KEY,
  status VARCHAR(12) NOT NULL DEFAULT 'queued', -- queued | running | done | error
  currentStep VARCHAR(200) NOT NULL DEFAULT '',
  progress INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  uf VARCHAR(2) NOT NULL DEFAULT 'MS',
  referenceMonth INT NOT NULL DEFAULT 0,
  referenceYear INT NOT NULL DEFAULT 0,
  referenceType VARCHAR(40) NOT NULL DEFAULT '',
  paramsJson TEXT NULL,      -- caminhos dos arquivos enviados (fora da pasta pública)
  summaryJson TEXT NULL,     -- contadores created/updated/skipped por recurso
  errorMessage TEXT NULL,
  createdByUserId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  finishedAt TIMESTAMP NULL DEFAULT NULL,
  KEY idx_sinapi_job_status (status),
  KEY idx_sinapi_job_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
