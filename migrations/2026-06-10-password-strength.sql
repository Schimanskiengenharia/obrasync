-- Requisitos de força de senha e fluxo de redefinição via email.

-- 1. Adiciona email e mustChangePassword em system_users
ALTER TABLE system_users
  ADD COLUMN IF NOT EXISTS email VARCHAR(160) NOT NULL DEFAULT '' AFTER fullName,
  ADD COLUMN IF NOT EXISTS mustChangePassword TINYINT(1) NOT NULL DEFAULT 0 AFTER blocked;

-- 2. Força todos os usuários existentes a redefinir a senha no próximo login
UPDATE system_users SET mustChangePassword = 1;

-- 3. Tabela de tokens de redefinição de senha (expiram em 2 h, uso único)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId     BIGINT UNSIGNED NOT NULL,
  tokenHash  CHAR(64)        NOT NULL,
  expiresAt  TIMESTAMP       NOT NULL,
  usedAt     TIMESTAMP       NULL DEFAULT NULL,
  createdAt  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_prt_token (tokenHash),
  KEY        idx_prt_user  (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
