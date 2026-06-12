-- Conciliação automática OFX × contas a pagar/receber (2026-06-12).
-- A API cria estas colunas sob demanda (ensure_ofx_tables em api/index.php);
-- este arquivo documenta o schema para instalações com usuário sem DDL.

ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS ofxFitid VARCHAR(100) NULL COMMENT 'FITID do OFX vinculado — evita dupla contagem',
  ADD COLUMN IF NOT EXISTS ofxImportId BIGINT UNSIGNED NULL COMMENT 'ID em ofx_imports',
  ADD INDEX IF NOT EXISTS idx_pay_fitid (ofxFitid);

ALTER TABLE accounts_receivable
  ADD COLUMN IF NOT EXISTS ofxFitid VARCHAR(100) NULL COMMENT 'FITID do OFX vinculado — evita dupla contagem',
  ADD COLUMN IF NOT EXISTS ofxImportId BIGINT UNSIGNED NULL COMMENT 'ID em ofx_imports',
  ADD INDEX IF NOT EXISTS idx_rec_fitid (ofxFitid);
