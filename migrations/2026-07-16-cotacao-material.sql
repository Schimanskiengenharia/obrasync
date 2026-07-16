-- Cotações manuais por MATERIAL (Parte 1): a cotação é centrada no material
-- { obra, disciplina (cotacao_categorias), tipo de item (cotacao_tipos_item,
-- opcional), descrição, unidade, quantidade } e recebe N PROPOSTAS de
-- fornecedores do cadastro (suppliers) dentro dela.
-- REUSO (nada recriado): o cabeçalho é a tabela `cotacoes` (já tem projectId/
-- description/unit/quantity/status/notes) e cada proposta é uma linha de
-- `cotacao_itens` (já tem valor_unitario/marca/prazo_entrega/observacao/
-- vencedor/diferenca_percentual DECIMAL(12,2)).
-- Auto-cura equivalente: ensure_cotacao_material_columns (api/index.php).

-- Cabeçalho: disciplina e tipo de item da estrutura manual A1.
ALTER TABLE cotacoes
  ADD COLUMN IF NOT EXISTS categoriaId BIGINT UNSIGNED NULL
    COMMENT 'Disciplina (cotacao_categorias.id) — preenchida = cotação por material',
  ADD COLUMN IF NOT EXISTS tipoItemId BIGINT UNSIGNED NULL
    COMMENT 'Tipo de item (cotacao_tipos_item.id), opcional',
  ADD INDEX IF NOT EXISTS idx_cotacoes_categoria (categoriaId);

-- Proposta manual: vínculo à cotação de material e ao fornecedor do cadastro.
-- cotacao_id passa a aceitar NULL porque a proposta manual não tem cabeçalho de
-- arquivo importado (cotacao_fornecedor) — o fluxo de importação não muda: todas
-- as queries dele fazem JOIN cotacao_fornecedor via cotacao_id.
ALTER TABLE cotacao_itens
  ADD COLUMN IF NOT EXISTS material_cotacao_id BIGINT UNSIGNED NULL
    COMMENT 'Proposta manual: cotação por material (cotacoes.id)',
  ADD COLUMN IF NOT EXISTS fornecedor_id BIGINT UNSIGNED NULL
    COMMENT 'Proposta manual: fornecedor do cadastro (suppliers.id)',
  ADD INDEX IF NOT EXISTS idx_ci_material (material_cotacao_id);

ALTER TABLE cotacao_itens
  MODIFY cotacao_id BIGINT UNSIGNED NULL;

-- Regra das N cotações (configurável; padrão 3): só é possível CONCLUIR uma
-- cotação de material com >= N propostas de fornecedores DIFERENTES. Editável
-- em Configurações → Preferências do sistema.
INSERT INTO system_preferences (name, `value`, description)
SELECT 'minCotacoesPorMaterial', '3',
       'Mínimo de propostas de fornecedores DIFERENTES para concluir uma cotação por material (módulo Cotações de Fornecedores).'
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM system_preferences WHERE name = 'minCotacoesPorMaterial');
