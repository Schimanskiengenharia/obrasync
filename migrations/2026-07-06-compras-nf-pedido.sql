-- F5.3 (ciclo de compra): vínculo NOTA FISCAL ↔ PEDIDO DE COMPRA para a aba
-- "Compras da Obra". Ao registrar a compra: a NF nasce vinculada à obra
-- (projectId, que já existia), ao pedido (coluna nova) e à conta a pagar da
-- automação (payableId, que já existia). Auto-cura: ensure_fiscal_documents_table.

ALTER TABLE fiscal_documents
  ADD COLUMN IF NOT EXISTS purchaseOrderId BIGINT UNSIGNED NULL;
