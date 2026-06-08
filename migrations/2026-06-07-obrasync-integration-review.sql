-- Migração segura: registra a versão de consolidação ObraSync.
-- Não altera dados operacionais, credenciais, uploads ou backups.
-- Execute no Debian depois de fazer backup:
-- mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-07-obrasync-integration-review.sql

USE financeiro;

CREATE TABLE IF NOT EXISTS sistema_versoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  versao VARCHAR(40) NOT NULL UNIQUE,
  data_versao DATE NOT NULL,
  descricao TEXT,
  alteracoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES
  ('v1.5.0', '2026-06-07', 'ObraSync e revisão de integração geral.', 'Nome visual ObraSync, dashboard geral revisado, aliases de API e fluxo proposta-venda-conta a receber.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);
