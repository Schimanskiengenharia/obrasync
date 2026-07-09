-- Migration: Categorias e tipos de item das cotações de fornecedores (Parte A1)
-- Data: 2026-07-08
-- Estrutura manual categoria → tipo de item usada pelo módulo de Cotações de
-- Fornecedores. Segue o padrão de obra_campos_personalizados (ordem/status/
-- createdAt + unique por pai+nome); os atributos customizados por tipo (A2)
-- virão numa tabela própria no molde fieldName/fieldType/options/required.
-- Espelhada por ensure_cotacao_categorias_tables() no api/index.php (auto-cura).

CREATE TABLE IF NOT EXISTS cotacao_categorias (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_cotcat_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cotacao_tipos_item (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  categoriaId BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(160) NOT NULL,
  unidadePadrao VARCHAR(20) NULL,
  ordem INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cottipo_categoria FOREIGN KEY (categoriaId) REFERENCES cotacao_categorias(id) ON DELETE CASCADE,
  UNIQUE KEY uk_cottipo_cat_nome (categoriaId, nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
