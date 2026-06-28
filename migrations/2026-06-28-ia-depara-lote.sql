-- Migração: de-para em lote da IA (ObraSync). O usuário sobe um orçamento externo
-- (Excel/CSV); a IA classifica cada item contra a base SINAPI por busca semântica
-- (mesmo cosseno do action=buscarSemantica) em ACHOU / REVISAR / COTAÇÃO PRÓPRIA.
-- As tabelas também são criadas em runtime por ensure_ia_depara_tables() no
-- api/index.php (igual a ia_embeddings), então rodar isto é opcional.

USE financeiro;

-- Um lote por upload de planilha (histórico + progresso da classificação).
CREATE TABLE IF NOT EXISTS ia_depara_jobs (
  id VARCHAR(64) PRIMARY KEY,
  nomeArquivo VARCHAR(255) NULL,
  total INT UNSIGNED NOT NULL DEFAULT 0,
  processados INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('queued','running','done','error') NOT NULL DEFAULT 'queued',
  colunasJson TEXT NULL,                     -- colunas detectadas no cabeçalho
  errorMessage TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  startedAt TIMESTAMP NULL DEFAULT NULL,
  finishedAt TIMESTAMP NULL DEFAULT NULL,
  userId BIGINT UNSIGNED NULL,
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Uma linha da planilha do usuário + o resultado da classificação da IA.
CREATE TABLE IF NOT EXISTS ia_depara_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jobId VARCHAR(64) NOT NULL,
  linhaPlanilha INT UNSIGNED NULL,           -- nº da linha na planilha (1-based)
  -- dados crus lidos da planilha (NUNCA inventados; só o que está no arquivo):
  descricaoOrigem TEXT NOT NULL,
  codigoOrigem VARCHAR(80) NULL,
  quantidade DECIMAL(15,4) NULL,
  unidadeOrigem VARCHAR(40) NULL,
  valorOrigem DECIMAL(15,4) NULL,
  -- resultado da IA:
  statusClassificacao ENUM('achou','revisar','cotacao_propria') NULL,
  matchOrigem ENUM('composicao','insumo') NULL,
  matchId BIGINT UNSIGNED NULL,
  matchCode VARCHAR(80) NULL,
  matchDescription TEXT NULL,
  matchUnit VARCHAR(40) NULL,
  matchValor DECIMAL(15,4) NULL,
  similaridade DECIMAL(5,2) NULL,            -- 0-100 (cosseno do top1)
  top3Json TEXT NULL,                        -- top 3 candidatos para revisão
  aceito TINYINT NOT NULL DEFAULT 0,         -- usuário confirmou o match
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_depara_item_job FOREIGN KEY (jobId) REFERENCES ia_depara_jobs(id) ON DELETE CASCADE,
  KEY idx_job (jobId),
  KEY idx_job_status (jobId, statusClassificacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
