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

ALTER TABLE system_users
  ADD COLUMN IF NOT EXISTS blocked TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

ALTER TABLE system_users
  MODIFY COLUMN role ENUM('admin', 'financeiro', 'comercial', 'engenharia', 'gestor_obra', 'equipe_campo', 'cliente_obra', 'fornecedor_terceiro', 'consulta', 'gerente', 'operador', 'visualizador') NOT NULL DEFAULT 'financeiro';

-- Cria os usuários iniciais apenas se ainda não existirem: re-executar esta
-- migração nunca reativa, desbloqueia ou altera usuários reais de produção.
INSERT INTO system_users (username, fullName, password, role, status)
SELECT 'admin', 'Administrador', 'admin123', 'admin', 'Ativo'
WHERE NOT EXISTS (SELECT 1 FROM system_users WHERE username = 'admin');

INSERT INTO system_users (username, fullName, password, role, status)
SELECT 'alefschimanski', 'Alef Schimanski', 'Schimanski!@#', 'admin', 'Ativo'
WHERE NOT EXISTS (SELECT 1 FROM system_users WHERE username = 'alefschimanski');
