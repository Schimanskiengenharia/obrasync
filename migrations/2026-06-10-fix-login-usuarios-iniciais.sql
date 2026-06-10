-- Garante que os usuários iniciais existem no banco de produção.
-- Senhas em plaintext são aceitas pelo PHP e convertidas para bcrypt no primeiro login.

CREATE TABLE IF NOT EXISTS system_users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(64) NOT NULL UNIQUE,
  fullName    VARCHAR(128) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(32) NOT NULL DEFAULT 'admin',
  status      VARCHAR(16) NOT NULL DEFAULT 'Ativo',
  blocked     TINYINT(1) NOT NULL DEFAULT 0,
  createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_users (username, fullName, password, role, status)
VALUES
  ('admin',            'Administrador', 'admin123',       'admin', 'Ativo'),
  ('alefschimanski',   'Alef Schimanski', 'Schimanski!@#', 'admin', 'Ativo')
ON DUPLICATE KEY UPDATE
  status  = VALUES(status),
  blocked = 0;
