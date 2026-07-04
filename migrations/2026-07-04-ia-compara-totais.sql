-- Migration: comparação por TOTAL no comparador IA (totalOrigem/totalSinapi/
-- diferencaTotal em ia_compara_itens). O resumo de economia/excesso passa a somar
-- a diferença por total (qtd × unitário) dos itens ACHOU — números realistas.
-- Idempotente; espelhada em runtime por ensure_ia_compara_tables() no api/index.php.
-- Lotes já analisados: o resumo tem fallback (diferencaValor × quantidade); para
-- preencher as colunas novas por item basta "Reanalisar" o lote (idempotente).

USE financeiro;

ALTER TABLE ia_compara_itens
  ADD COLUMN IF NOT EXISTS totalOrigem DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS totalSinapi DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS diferencaTotal DECIMAL(18,2) NULL;
