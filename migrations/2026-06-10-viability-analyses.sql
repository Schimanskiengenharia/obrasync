-- Módulo de Análise de Viabilidade: avaliação de custo x benefício por obra/projeto
-- com margem, payback simples, VPL, TIR e parecer (automático ou manual com justificativa).
-- Observação: a API também cria esta tabela sob demanda (ensure_viability_table), então
-- esta migração é opcional em instalações que já rodam a versão atual da API.

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
