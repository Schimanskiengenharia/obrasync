-- Migração: comparador de orçamento com IA (Fase A — análise/relatório) — ObraSync.
-- O usuário sobe uma planilha de orçamento; a IA casa cada item com a base SINAPI
-- (por código ou busca semântica) e COMPARA o preço da planilha com o da SINAPI.
-- Esta fase é só análise (não vira orçamento editável). As tabelas também são criadas
-- em runtime por ensure_ia_compara_tables() no api/index.php (rodar isto é opcional).

USE financeiro;

-- Um lote por upload de planilha (histórico + progresso da análise).
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

-- Uma linha da planilha + o match SINAPI + a comparação de preço.
CREATE TABLE IF NOT EXISTS ia_compara_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jobId VARCHAR(64) NOT NULL,
  linhaPlanilha INT UNSIGNED NULL,
  -- dados crus lidos da planilha (NUNCA inventados; só o que está no arquivo):
  descricaoOrigem TEXT NOT NULL,
  codigoOrigem VARCHAR(80) NULL,
  unidadeOrigem VARCHAR(40) NULL,
  quantidadeOrigem DECIMAL(18,4) NULL,
  valorUnitOrigem DECIMAL(15,4) NULL,
  -- match SINAPI:
  statusClassificacao ENUM('achou','faltou_importar','cotacao_propria') NULL,
  matchOrigem ENUM('composicao','insumo') NULL,
  matchId BIGINT UNSIGNED NULL,
  matchCode VARCHAR(80) NULL,
  matchDescription TEXT NULL,
  matchUnit VARCHAR(40) NULL,
  matchValor DECIMAL(15,4) NULL,
  similaridade DECIMAL(5,2) NULL,           -- 0-100 (cosseno do top1)
  -- comparação de preço (planilha × SINAPI):
  precoMaisBaixo ENUM('planilha','sinapi','igual','sem_comparacao') NULL,
  diferencaValor DECIMAL(15,4) NULL,        -- valorUnitOrigem - matchValor
  diferencaPercent DECIMAL(7,2) NULL,       -- (diferencaValor / matchValor) * 100
  aceito TINYINT NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_compara_item_job FOREIGN KEY (jobId) REFERENCES ia_compara_jobs(id) ON DELETE CASCADE,
  KEY idx_job (jobId),
  KEY idx_job_status (jobId, statusClassificacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
