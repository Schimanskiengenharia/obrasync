-- Itens detalhados do pedido de compra + condições de pagamento/desconto +
-- vínculo com o item do orçamento da obra. Migração segura/idempotente.
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-purchase-order-items.sql
--
-- Tabelas reais: purchase_orders (number, date, projectId, supplierId,
-- costCenterId, categoryId, amount, expectedDate, status, notes) e
-- orcamento_obra_itens (itens do orçamento; coluna de quantidade = `quantity`).

USE financeiro;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  descricao VARCHAR(300) NOT NULL,
  unidade VARCHAR(20) DEFAULT 'un',
  quantidade DECIMAL(10,3) NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_total DECIMAL(16,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  work_budget_item_id BIGINT UNSIGNED NULL
    COMMENT 'Vínculo opcional ao item do orçamento (orcamento_obra_itens.id)',
  observacao VARCHAR(200) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pedido (purchase_order_id),
  INDEX idx_poi_budget_item (work_budget_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS condicoes_pagamento VARCHAR(200) NULL
    COMMENT 'Ex: 30 dias, À vista, 50% entrada + 50% entrega',
  ADD COLUMN IF NOT EXISTS desconto DECIMAL(10,2) DEFAULT 0;

-- Quantidade efetivamente recebida (alimentada ao "Receber" o pedido vinculado).
ALTER TABLE orcamento_obra_itens
  ADD COLUMN IF NOT EXISTS quantidade_realizada DECIMAL(18,4) NOT NULL DEFAULT 0;
