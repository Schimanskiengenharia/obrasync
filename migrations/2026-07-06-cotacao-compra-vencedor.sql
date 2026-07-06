-- F5.2 (cotação de compra item a item): marcação manual do fornecedor VENCEDOR
-- por item do Custo da Obra. Uma cotação vencedora por orcamento_item_id (o
-- backend desmarca os concorrentes ao marcar). O pedido de compra a partir do
-- vencedor é a F5.3.
-- Auto-cura equivalente: ensure_cotacao_import_tables (api/index.php).

ALTER TABLE cotacao_itens
  ADD COLUMN IF NOT EXISTS vencedor TINYINT(1) NOT NULL DEFAULT 0;
