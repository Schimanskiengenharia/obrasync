-- Migration: PBQP-H Fase 1 — Qualificação de fornecedores
-- Data: 2026-06-27
-- Adiciona campos de qualificação/certificação e avaliação de desempenho na
-- tabela suppliers. Espelhada por ensure_supplier_qualification_columns() no
-- api/index.php (auto-cura em produção). Colunas idempotentes (IF NOT EXISTS).
-- pbqph_nivel = STATUS de qualificação; pbqph_letra = nível A/B/C/D do PBQP-H.

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS pbqph_nivel ENUM('nao_avaliado','aprovado','em_avaliacao','suspenso','reprovado') DEFAULT 'nao_avaliado',
  ADD COLUMN IF NOT EXISTS pbqph_letra VARCHAR(2) NULL COMMENT 'Nível do PBQP-H: A/B/C/D',
  ADD COLUMN IF NOT EXISTS pbqph_validade DATE NULL,
  ADD COLUMN IF NOT EXISTS iso9001 TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iso9001_validade DATE NULL,
  ADD COLUMN IF NOT EXISTS datec TINYINT(1) DEFAULT 0 COMMENT 'Possui Documento de Avaliacao Tecnica SiNAT',
  ADD COLUMN IF NOT EXISTS datec_numero VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS abnt_marca TINYINT(1) DEFAULT 0 COMMENT 'Possui marca de conformidade ABNT',
  ADD COLUMN IF NOT EXISTS avaliacao_pontualidade TINYINT UNSIGNED NULL COMMENT 'Nota 1-5',
  ADD COLUMN IF NOT EXISTS avaliacao_qualidade TINYINT UNSIGNED NULL COMMENT 'Nota 1-5',
  ADD COLUMN IF NOT EXISTS avaliacao_preco TINYINT UNSIGNED NULL COMMENT 'Nota 1-5',
  ADD COLUMN IF NOT EXISTS avaliacao_data DATE NULL,
  ADD COLUMN IF NOT EXISTS avaliacao_responsavel VARCHAR(100) NULL;
