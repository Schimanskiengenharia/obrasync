-- Vínculo entre movimentações de caixa e contas a pagar, para evitar dupla
-- contagem no histórico do centro de custo. Migração segura/idempotente.
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-vinculo-caixa-conta-pagar.sql
--
-- Tabelas reais: `cash_bank_movements` (campos date, bankAccount, type,
-- categoryId, projectId, costCenterId, history, amount, originDocument, status)
-- e `accounts_payable`. Nenhuma das duas tinha colunas de referência cruzada.

USE financeiro;

ALTER TABLE cash_bank_movements
  ADD COLUMN IF NOT EXISTS referencia_tipo VARCHAR(30) NULL
    COMMENT 'Ex.: CONTA_PAGAR quando o caixa quita uma conta a pagar' AFTER status,
  ADD COLUMN IF NOT EXISTS referencia_id BIGINT UNSIGNED NULL
    COMMENT 'Id do registro referenciado (ex.: accounts_payable.id)' AFTER referencia_tipo;

ALTER TABLE cash_bank_movements
  ADD INDEX IF NOT EXISTS idx_cash_referencia (referencia_tipo, referencia_id);

ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS referencia_tipo VARCHAR(30) NULL
    COMMENT 'Ex.: CAIXA_MANUAL quando foi baixada por um lançamento de caixa' AFTER status,
  ADD COLUMN IF NOT EXISTS referencia_id BIGINT UNSIGNED NULL
    COMMENT 'Id do registro referenciado (ex.: cash_bank_movements.id)' AFTER referencia_tipo;

ALTER TABLE accounts_payable
  ADD INDEX IF NOT EXISTS idx_payable_referencia (referencia_tipo, referencia_id);
