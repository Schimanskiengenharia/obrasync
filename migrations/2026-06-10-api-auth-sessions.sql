-- Sessões de autenticação da API (token Bearer emitido no login).
-- A API também cria esta tabela sob demanda; a migration garante o estado em atualizações controladas.

CREATE TABLE IF NOT EXISTS api_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  tokenHash CHAR(64) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastActivity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_api_sessions_token (tokenHash),
  KEY idx_api_sessions_user (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
