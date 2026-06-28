-- Migration: Importação e comparação de cotações de fornecedores (PDF/Excel/CSV)
-- Data: 2026-06-27
-- Tabelas independentes da tabela `cotacoes` já existente (módulo quotes — cotação
-- avulsa). Espelhadas por ensure_cotacao_import_tables() no api/index.php (auto-cura).

CREATE TABLE IF NOT EXISTS cotacao_fornecedor (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id BIGINT UNSIGNED NULL,
  purchase_order_id BIGINT UNSIGNED NULL,
  fornecedor_id BIGINT UNSIGNED NULL,
  fornecedor_nome VARCHAR(200) NOT NULL COMMENT 'Nome mesmo que nao seja cadastrado',
  data_cotacao DATE NULL,
  validade_cotacao DATE NULL,
  arquivo_original VARCHAR(500) NULL COMMENT 'Caminho do PDF ou Excel original',
  arquivo_nome VARCHAR(200) NULL,
  arquivo_tipo VARCHAR(10) NULL COMMENT 'pdf, xlsx, xls, csv',
  status ENUM('importada','comparada','aprovada','reprovada') DEFAULT 'importada',
  score DECIMAL(5,2) NULL COMMENT 'Score geral da comparacao (% itens <= orcamento)',
  observacoes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cf_obra (obra_id),
  INDEX idx_cf_pedido (purchase_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cotacao_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cotacao_id BIGINT UNSIGNED NOT NULL,
  descricao VARCHAR(500) NOT NULL,
  unidade VARCHAR(20) NULL,
  quantidade DECIMAL(15,4) NULL,
  valor_unitario DECIMAL(15,4) NULL,
  valor_total DECIMAL(15,4) NULL,
  marca VARCHAR(100) NULL,
  prazo_entrega VARCHAR(100) NULL,
  observacao VARCHAR(300) NULL,
  orcamento_item_id BIGINT UNSIGNED NULL COMMENT 'Item do orcamento de obra vinculado',
  diferenca_percentual DECIMAL(8,2) NULL COMMENT 'Diferenca % em relacao ao orcamento',
  status_comparacao ENUM('nao_comparado','abaixo','igual','acima','muito_acima') DEFAULT 'nao_comparado',
  INDEX idx_cotacao (cotacao_id),
  INDEX idx_orcamento_item (orcamento_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
