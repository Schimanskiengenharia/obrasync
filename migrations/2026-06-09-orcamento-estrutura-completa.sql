-- Estrutura profissional do orçamento de obra: etapas, tipo de custo, código
-- hierárquico, origem (SINAPI/composição própria) e ordem. Migração segura.
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-orcamento-estrutura-completa.sql
--
-- Tabela real orcamento_obra_itens já possui: workBudgetId, projectId, origin,
-- sinapiReferenceId, code, description, unit, quantity, unitCost, totalCost,
-- bdiPercent, unitPrice, totalPrice, stageName, costCenterId, categoryId, notes,
-- quantidade_realizada. Por isso NÃO recriamos cost_center_id (já é costCenterId).

USE financeiro;

ALTER TABLE orcamento_obra_itens
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) NULL
    COMMENT 'Código hierárquico ex: 1.1.001',
  ADD COLUMN IF NOT EXISTS tipo
    ENUM('material','mao_de_obra','equipamento','subempreiteiro','outros') DEFAULT 'material'
    COMMENT 'Tipo do custo do item',
  ADD COLUMN IF NOT EXISTS etapa_id BIGINT UNSIGNED NULL
    COMMENT 'Etapa do orçamento (orcamento_etapas.id)',
  ADD COLUMN IF NOT EXISTS sinapi_id BIGINT UNSIGNED NULL
    COMMENT 'Composição SINAPI de origem',
  ADD COLUMN IF NOT EXISTS composicao_propria_id BIGINT UNSIGNED NULL
    COMMENT 'Composição própria de origem',
  ADD COLUMN IF NOT EXISTS ordem INT DEFAULT 0
    COMMENT 'Ordem de exibição dentro da etapa';

CREATE TABLE IF NOT EXISTS orcamento_etapas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  orcamento_id BIGINT UNSIGNED NOT NULL,
  obra_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(200) NOT NULL,
  codigo VARCHAR(10) NULL COMMENT 'Ex: 1, 2, 3',
  ordem INT DEFAULT 0,
  bdi_especifico DECIMAL(5,2) NULL
    COMMENT 'BDI específico desta etapa — se nulo usa o BDI geral',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orcamento (orcamento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
