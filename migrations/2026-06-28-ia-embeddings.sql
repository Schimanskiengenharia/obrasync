-- Migração: indexação IA da base SINAPI (embeddings) — ObraSync.
-- Execute no banco existente depois de backup. As tabelas também são criadas em
-- runtime por ensure_ia_tables() no api/index.php, então rodar isto é opcional.

USE financeiro;

-- Vetores (embeddings) das composições e insumos SINAPI para busca semântica.
CREATE TABLE IF NOT EXISTS ia_embeddings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  origem ENUM('composicao','insumo') NOT NULL,
  origemId BIGINT UNSIGNED NOT NULL,        -- id em sinapi_composicoes ou sinapi_insumos
  code VARCHAR(80) NULL,                     -- código SINAPI (referência)
  texto TEXT NOT NULL,                       -- texto embedado (descrição + unidade)
  embedding LONGTEXT NOT NULL,              -- vetor JSON (array de 384 floats)
  sinapiReferenceId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_origem (origem, origemId),
  KEY idx_origem (origem)
) ENGINE=InnoDB;

-- Job de progresso da indexação (um por vez; o Ollama processa sequencial).
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
) ENGINE=InnoDB;
