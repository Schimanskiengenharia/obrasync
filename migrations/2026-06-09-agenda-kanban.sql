CREATE TABLE IF NOT EXISTS agenda_eventos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id BIGINT UNSIGNED NULL,
  cliente_id BIGINT UNSIGNED NULL,
  usuario_id BIGINT UNSIGNED NULL,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT NULL,
  tipo ENUM('reuniao','visita','entrega','cobranca','outro') NOT NULL,
  data_inicio DATETIME NOT NULL,
  data_fim DATETIME NULL,
  dia_todo TINYINT(1) DEFAULT 0,
  lembrete_minutos INT DEFAULT 60,
  status ENUM('agendado','realizado','cancelado') DEFAULT 'agendado',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agenda_obra (obra_id),
  INDEX idx_agenda_cliente (cliente_id),
  INDEX idx_agenda_usuario (usuario_id),
  INDEX idx_agenda_periodo (data_inicio, data_fim),
  INDEX idx_agenda_tipo_status (tipo, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kanban_boards (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  obra_id BIGINT UNSIGNED NULL,
  nome VARCHAR(100) NOT NULL,
  tipo ENUM('obra','compras','geral') DEFAULT 'geral',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_kanban_boards_obra (obra_id),
  INDEX idx_kanban_boards_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kanban_colunas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  board_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(80) NOT NULL,
  ordem INT DEFAULT 0,
  cor VARCHAR(7) DEFAULT '#185FA5',
  limite_cards INT NULL,
  INDEX idx_kanban_colunas_board (board_id),
  CONSTRAINT fk_kanban_colunas_board FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kanban_cards (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  coluna_id BIGINT UNSIGNED NOT NULL,
  obra_id BIGINT UNSIGNED NULL,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT NULL,
  responsavel_id BIGINT UNSIGNED NULL,
  data_vencimento DATE NULL,
  prioridade ENUM('baixa','media','alta','urgente') DEFAULT 'media',
  referencia_tipo VARCHAR(30) NULL,
  referencia_id BIGINT UNSIGNED NULL,
  ordem INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_kanban_cards_coluna (coluna_id),
  INDEX idx_kanban_cards_obra (obra_id),
  INDEX idx_kanban_cards_vencimento (data_vencimento),
  INDEX idx_kanban_cards_referencia (referencia_tipo, referencia_id),
  CONSTRAINT fk_kanban_cards_coluna FOREIGN KEY (coluna_id) REFERENCES kanban_colunas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
