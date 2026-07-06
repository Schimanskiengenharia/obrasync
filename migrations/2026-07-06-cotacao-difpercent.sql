-- F4b: alarga cotacao_itens.diferenca_percentual DECIMAL(8,2) → DECIMAL(12,2).
-- Mesmo overflow SQLSTATE[22003] já corrigido no comparador IA (custo orçado ínfimo
-- gerava % em milhões e derrubava a comparação com 500). O cálculo no código também
-- ganhou clamp (IA_COMPARA_DIFPERCENT_MAX) e passou a comparar contra o CUSTO sem
-- BDI (orcamento_obra_itens.unitCost) em vez do preço de venda.
-- Auto-cura equivalente: ensure_cotacao_import_tables (api/index.php).

ALTER TABLE cotacao_itens
  MODIFY diferenca_percentual DECIMAL(12,2) NULL;
