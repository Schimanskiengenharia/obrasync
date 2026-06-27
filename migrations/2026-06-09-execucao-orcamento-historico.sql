-- Histórico de alterações da quantidade realizada por item do orçamento de obra
-- (atualização manual ou via recebimento de pedido de compra).
-- A coluna orcamento_obra_itens.quantidade_realizada foi criada na migração
-- 2026-06-09-purchase-order-items.sql. Migração segura/idempotente.
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-execucao-orcamento-historico.sql

USE financeiro;

CREATE TABLE IF NOT EXISTS orcamento_item_execucao_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  quantidade_anterior DECIMAL(18,4) NOT NULL DEFAULT 0,
  quantidade_nova DECIMAL(18,4) NOT NULL DEFAULT 0,
  origem VARCHAR(30) DEFAULT 'manual' COMMENT 'manual | pedido_compra',
  motivo VARCHAR(255) NULL,
  usuario_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exec_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Garante a coluna mesmo se a migração anterior não tiver sido aplicada.
ALTER TABLE orcamento_obra_itens
  ADD COLUMN IF NOT EXISTS quantidade_realizada DECIMAL(18,4) NOT NULL DEFAULT 0;
