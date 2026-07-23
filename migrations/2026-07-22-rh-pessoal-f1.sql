-- Módulo RH/Pessoal — Fase 1 (cadastro + documentos). Aditiva e idempotente.
CREATE TABLE IF NOT EXISTS rh_colaboradores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  cpf VARCHAR(14) NULL,
  tipo_vinculo ENUM('proprio','diarista','autonomo','empreiteira') NOT NULL DEFAULT 'proprio',
  fornecedor_id BIGINT UNSIGNED NULL,
  funcao VARCHAR(120) NULL,
  telefone VARCHAR(40) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  observacoes TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rh_colab_cpf (cpf),
  KEY idx_rh_colab_fornecedor (fornecedor_id),
  CONSTRAINT fk_rh_colab_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_tipos_documento (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(140) NOT NULL,
  exige_validade ENUM('Não','Sim') NOT NULL DEFAULT 'Sim',
  dias_alerta INT NOT NULL DEFAULT 30,
  descricao VARCHAR(255) NULL,
  ordem INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rh_tipo_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_documentos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  colaborador_id BIGINT UNSIGNED NOT NULL,
  tipo_documento_id BIGINT UNSIGNED NOT NULL,
  numero VARCHAR(80) NULL,
  data_emissao DATE NULL,
  data_validade DATE NULL,
  arquivo_path VARCHAR(500) NULL,
  arquivo_nome VARCHAR(255) NULL,
  observacoes TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_rh_doc_colab (colaborador_id),
  KEY idx_rh_doc_validade (data_validade),
  CONSTRAINT fk_rh_doc_colab FOREIGN KEY (colaborador_id) REFERENCES rh_colaboradores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_rh_doc_tipo FOREIGN KEY (tipo_documento_id) REFERENCES rh_tipos_documento(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed idempotente (linha a linha, por nome)
INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem)
SELECT 'ASO', 'Sim', 30, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_documento WHERE nome = 'ASO');
INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem)
SELECT 'Treinamento NR-10', 'Sim', 30, 2 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_documento WHERE nome = 'Treinamento NR-10');
INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem)
SELECT 'Treinamento NR-18', 'Sim', 30, 3 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_documento WHERE nome = 'Treinamento NR-18');
INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem)
SELECT 'Treinamento NR-35', 'Sim', 30, 4 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_documento WHERE nome = 'Treinamento NR-35');
INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem)
SELECT 'Contrato', 'Não', 30, 5 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_documento WHERE nome = 'Contrato');
