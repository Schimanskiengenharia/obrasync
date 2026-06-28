-- Migration: Módulo de Análise de Viabilidade por tipo de obra (checklist).
-- Data: 2026-06-27
-- Cria as tabelas de análises, grupos, itens e anexos. Espelhada por
-- ensure_viabilidade_tables() no api/index.php (auto-cura em produção).
-- Observação: este módulo é independente da tabela financeira `viability_analyses`
-- (módulo viabilityAnalyses: margem/payback/VPL/TIR) — não substitui nem altera aquela.

CREATE TABLE IF NOT EXISTS viabilidade_analises (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id BIGINT UNSIGNED NULL,
  proposta_id BIGINT UNSIGNED NULL,
  cliente_id BIGINT UNSIGNED NULL,
  tipo_obra VARCHAR(50) NOT NULL
    COMMENT 'energia_solar, obra_civil, eletrica, ar_condicionado, cobertura, hidraulica, manutencao, outro',
  nome VARCHAR(200) NOT NULL,
  status ENUM('em_andamento','aprovada','bloqueada','concluida') DEFAULT 'em_andamento',
  progresso_geral DECIMAL(5,2) DEFAULT 0,
  responsavel_id BIGINT UNSIGNED NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_obra (obra_id),
  INDEX idx_proposta (proposta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS viabilidade_grupos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analise_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(100) NOT NULL
    COMMENT 'Ex: Técnica, Financeira, Concessionária',
  tipo VARCHAR(50) NOT NULL
    COMMENT 'tecnica, financeira, legal, ambiental, concessionaria, operacional, mercado',
  obrigatorio TINYINT(1) DEFAULT 1
    COMMENT '1 = obrigatório bloqueia proposta, 0 = opcional',
  ordem INT DEFAULT 0,
  progresso DECIMAL(5,2) DEFAULT 0,
  INDEX idx_analise (analise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS viabilidade_itens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  grupo_id BIGINT UNSIGNED NOT NULL,
  analise_id BIGINT UNSIGNED NOT NULL,
  descricao VARCHAR(300) NOT NULL,
  status ENUM('nao_iniciado','em_andamento','aguardando_terceiro',
    'aprovado','reprovado') DEFAULT 'nao_iniciado',
  obrigatorio TINYINT(1) DEFAULT 1,
  responsavel VARCHAR(100) NULL,
  prazo DATE NULL
    COMMENT 'Prazo para itens aguardando terceiro',
  data_verificacao DATE NULL,
  observacao TEXT NULL,
  terceiro_nome VARCHAR(100) NULL
    COMMENT 'Ex: ENERGISA, Prefeitura, Condomínio',
  ordem INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_grupo (grupo_id),
  INDEX idx_analise (analise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS viabilidade_anexos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  nome_arquivo VARCHAR(200) NOT NULL,
  caminho VARCHAR(500) NOT NULL,
  tipo_arquivo VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
