-- Marcador de tipo de linha nas planilhas do de-para/comparador IA: 'item' (linha
-- com quantidade, valor ou código), 'secao' (título de bloco, ex.: "QUADROS DE
-- DISTRIBUIÇÃO") e 'subtotal' (linhas "Subtotal/Total ..."). Seções e subtotais
-- ficam gravados para exibição como separadores, mas não são classificados pela IA
-- nem viram itens no envio para o Orçamento de Obra (fix dos itens qtd=1/custo=0).
-- Linhas antigas ficam no default 'item'; o enviarParaOrcamento reaplica o critério
-- de classificação nesses lotes na hora do envio.
-- Auto-cura equivalente: ia_ensure_planilha_rich_columns (api/index.php).

ALTER TABLE ia_depara_itens
  ADD COLUMN IF NOT EXISTS tipoLinha ENUM('item','secao','subtotal') NOT NULL DEFAULT 'item';

ALTER TABLE ia_compara_itens
  ADD COLUMN IF NOT EXISTS tipoLinha ENUM('item','secao','subtotal') NOT NULL DEFAULT 'item';
