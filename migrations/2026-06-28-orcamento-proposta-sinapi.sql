-- Reestruturação do fluxo Orçamento → Proposta com base SINAPI (v1.15.0).
-- Migração SEGURA e idempotente (IF NOT EXISTS em tudo) — rode depois de backup:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-28-orcamento-proposta-sinapi.sql
--
-- Nomes reais confirmados no código (NÃO são os do rascunho):
--   * Itens da proposta: tabela `proposta_itens`, FK `proposalId` (camelCase).
--   * Vínculo proposta↔orçamento: tabela `proposta_orcamento_vinculos` (JÁ EXISTE) —
--     ESTENDIDA aqui com as colunas de grupo/BDI em vez de criar `proposta_orcamentos`
--     (evita duas tabelas de vínculo quase idênticas).
--   * Base SINAPI de composições: tabela `sinapi_composicoes`, colunas `code`/`description`/`unitCost`.

USE financeiro;

-- ─────────────────────────────────────────────────────────────────────────
-- MELHORIA 1 — Busca rápida na base SINAPI (índice de código para prefixo).
-- `description` já tem FULLTEXT (ft_composicao_description); `code` ganha BTREE.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE sinapi_composicoes ADD INDEX IF NOT EXISTS idx_comp_code (code);
ALTER TABLE sinapi_insumos     ADD INDEX IF NOT EXISTS idx_insumo_code (code);

-- ─────────────────────────────────────────────────────────────────────────
-- MELHORIA 3 — Proposta usa o orçamento como base de custo + BDI flexível.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE commercial_proposals
  ADD COLUMN IF NOT EXISTS bdi_geral DECIMAL(8,4) DEFAULT 0
    COMMENT 'BDI geral aplicado sobre todos os itens',
  ADD COLUMN IF NOT EXISTS bdi_tipo ENUM('percentual','valor_fixo','por_item','misto') DEFAULT 'percentual'
    COMMENT 'Tipo de BDI aplicado (A=percentual, B=por_item/grupo, C=valor manual, D=misto)',
  ADD COLUMN IF NOT EXISTS custo_total_orcamentos DECIMAL(15,2) DEFAULT 0
    COMMENT 'Soma dos custos dos orçamentos vinculados',
  ADD COLUMN IF NOT EXISTS valor_bdi_total DECIMAL(15,2) DEFAULT 0
    COMMENT 'Valor total do BDI aplicado',
  ADD COLUMN IF NOT EXISTS modo_licitacao ENUM('Não','Sim') NOT NULL DEFAULT 'Não'
    COMMENT 'Proposta para licitação: usa preços SINAPI como referência máxima';

ALTER TABLE proposta_itens
  ADD COLUMN IF NOT EXISTS custo_unitario DECIMAL(15,4) NULL
    COMMENT 'Custo real do item (base SINAPI ou orçamento)',
  ADD COLUMN IF NOT EXISTS bdi_item DECIMAL(8,4) NULL
    COMMENT 'BDI específico deste item, se diferente do geral',
  ADD COLUMN IF NOT EXISTS orcamento_item_id BIGINT UNSIGNED NULL
    COMMENT 'Item do orçamento técnico de origem (orcamento_obra_itens.id)',
  ADD COLUMN IF NOT EXISTS sinapi_id BIGINT UNSIGNED NULL
    COMMENT 'Composição SINAPI de origem (sinapi_composicoes.id)';

-- ─────────────────────────────────────────────────────────────────────────
-- MELHORIA 4 — Proposta com múltiplos orçamentos (grupos com BDI próprio).
-- Estende a tabela de vínculo já existente. O UNIQUE (proposalId, workBudgetId)
-- já permite vários orçamentos distintos na mesma proposta — mantido.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE proposta_orcamento_vinculos
  ADD COLUMN IF NOT EXISTS nome_grupo VARCHAR(200) NULL
    COMMENT 'Nome do grupo na proposta, ex: Cobertura Metálica',
  ADD COLUMN IF NOT EXISTS bdi_grupo DECIMAL(8,4) NULL
    COMMENT 'BDI específico deste grupo/orçamento (sobrepõe o geral)',
  ADD COLUMN IF NOT EXISTS custo_total DECIMAL(15,2) DEFAULT 0
    COMMENT 'Custo total do orçamento vinculado',
  ADD COLUMN IF NOT EXISTS valor_venda DECIMAL(15,2) DEFAULT 0
    COMMENT 'Valor de venda do grupo (custo + BDI)',
  ADD COLUMN IF NOT EXISTS ordem INT DEFAULT 0
    COMMENT 'Ordem de exibição na proposta';

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES ('v1.15.0', '2026-06-28', 'Fluxo Orçamento → Proposta com base SINAPI.',
  'Busca rápida SINAPI (índice de código + endpoint instantâneo), proposta usando o orçamento técnico como base de custo (custo_unitario/bdi_item por item), BDI flexível (percentual/por grupo/manual/misto) e proposta com múltiplos orçamentos vinculados com BDI ponderado e modo licitação.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);
