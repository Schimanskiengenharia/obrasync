-- Migração: leitura de planilhas reais (padrão AltoQi) nos módulos de IA de-para e
-- comparador. Aproveita as colunas ricas (Setor, Categoria, Tipo, Material Unit.,
-- M.O. Unit., Custo Direto Unit., BDI %) e adiciona o status 'divergente' (código
-- informado não bate com a descrição). Idempotente; também aplicada em runtime por
-- ia_ensure_planilha_rich_columns() no api/index.php.

USE financeiro;

ALTER TABLE ia_depara_itens
  ADD COLUMN IF NOT EXISTS setor VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS tipoOrigem VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS materialUnit DECIMAL(15,4) NULL,
  ADD COLUMN IF NOT EXISTS maoObraUnit DECIMAL(15,4) NULL,
  ADD COLUMN IF NOT EXISTS custoDiretoUnit DECIMAL(15,4) NULL,
  ADD COLUMN IF NOT EXISTS bdiPercent DECIMAL(7,2) NULL;

ALTER TABLE ia_depara_itens
  MODIFY COLUMN statusClassificacao ENUM('achou','revisar','divergente','cotacao_propria') NULL;

ALTER TABLE ia_compara_itens
  ADD COLUMN IF NOT EXISTS setor VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS tipoOrigem VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS materialUnit DECIMAL(15,4) NULL,
  ADD COLUMN IF NOT EXISTS maoObraUnit DECIMAL(15,4) NULL,
  ADD COLUMN IF NOT EXISTS custoDiretoUnit DECIMAL(15,4) NULL,
  ADD COLUMN IF NOT EXISTS bdiPercent DECIMAL(7,2) NULL;

ALTER TABLE ia_compara_itens
  MODIFY COLUMN statusClassificacao ENUM('achou','faltou_importar','divergente','cotacao_propria') NULL;
