-- Migration: PBQP-H Fase 1 — consolidada (quick wins)
-- Data: 2026-06-27
-- Reúne TODAS as alterações da Fase 1. Idempotente (IF NOT EXISTS). Espelhada por
-- ensure_supplier_qualification_columns / ensure_fvm_rastreabilidade_columns /
-- ensure_pes_arquivo_columns no api/index.php (auto-cura em produção).
--
-- IMPORTANTE (nomes reais verificados): qualidade_fvm e qualidade_pes já são
-- camelCase. NÃO duplicamos colunas existentes: qualidade_fvm já tem `notaFiscal`
-- e `resultado` (Aprovado/Reprovado/Aprovado com ressalvas) — por isso NÃO criamos
-- numero_nota_fiscal nem resultado_inspecao. Colunas novas seguem o camelCase da tabela.

-- ── Quick Win 1: Qualificação de fornecedores ──────────────────────────────
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

-- ── Quick Win 2/3: Rastreabilidade de lote + vínculo com Pedido de Compra ──
-- (tabela real = qualidade_fvm, camelCase; notaFiscal e resultado já existem)
ALTER TABLE qualidade_fvm
  ADD COLUMN IF NOT EXISTS lote VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS fabricante VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS dataFabricacao DATE NULL,
  ADD COLUMN IF NOT EXISTS validade DATE NULL,
  ADD COLUMN IF NOT EXISTS localAplicacao VARCHAR(300) NULL COMMENT 'Ex: Bloco A - 2 pavimento - fachada norte',
  ADD COLUMN IF NOT EXISTS certificadoQualidade TINYINT(1) DEFAULT 0 COMMENT 'Certificado do produto recebido',
  ADD COLUMN IF NOT EXISTS purchaseOrderId BIGINT UNSIGNED NULL COMMENT 'Vínculo com purchase_orders.id';

-- ── Quick Win 4: Anexo PDF nos Procedimentos de Execução (PES) ─────────────
-- (tabela real = qualidade_pes, camelCase)
ALTER TABLE qualidade_pes
  ADD COLUMN IF NOT EXISTS arquivoPdf VARCHAR(500) NULL COMMENT 'Caminho do PDF do procedimento',
  ADD COLUMN IF NOT EXISTS arquivoNome VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS arquivoData TIMESTAMP NULL;
