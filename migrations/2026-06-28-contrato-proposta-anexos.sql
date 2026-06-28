-- Contrato a partir da proposta + anexos assinados (v1.17.0).
-- Migração SEGURA e idempotente. Rode depois de backup:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-28-contrato-proposta-anexos.sql
--
-- `sales_contracts` JÁ tem `proposalId` (origem do contrato) — reaproveitado, NÃO criamos
-- proposta_id. Snapshot do cliente e campos de contrato/anexos não existiam: criados aqui.

USE financeiro;

ALTER TABLE sales_contracts
  ADD COLUMN IF NOT EXISTS numero_contrato VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS data_contrato DATE NULL,
  ADD COLUMN IF NOT EXISTS valor_contrato DECIMAL(14,2) NULL,
  ADD COLUMN IF NOT EXISTS objeto TEXT NULL COMMENT 'Objeto/escopo consolidado',
  ADD COLUMN IF NOT EXISTS status_contrato VARCHAR(30) NULL DEFAULT 'rascunho' COMMENT 'rascunho/gerado/assinado',
  ADD COLUMN IF NOT EXISTS proposta_assinada_path VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS contrato_gerado_path VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS contrato_assinado_path VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS email VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS endereco VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(2) NULL,
  ADD COLUMN IF NOT EXISTS cep VARCHAR(9) NULL;

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES ('v1.17.0', '2026-06-28', 'Contrato a partir da proposta + anexos assinados.',
  'Vínculo do contrato à proposta (proposalId), snapshot do cliente e dados do contrato (número, data, valor, objeto, status); geração do contrato a partir da proposta; PDF do contrato em template de 13 cláusulas; anexo de proposta assinada e contrato assinado.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);
