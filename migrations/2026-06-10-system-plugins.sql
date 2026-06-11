-- Menu Plugins: links para sistemas externos exibidos no menu lateral (nova aba),
-- geridos pelo administrador em Configurações > Plugins.
-- Observação: a API também cria esta tabela sob demanda (ensure_plugins_table) e
-- insere o exemplo "Portal do Cliente" quando a tabela está vazia, então esta
-- migração é opcional em instalações que já rodam a versão atual da API.

CREATE TABLE IF NOT EXISTS system_plugins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  url VARCHAR(500) NOT NULL,
  icon VARCHAR(40) NULL,
  description VARCHAR(300) NULL,
  roles VARCHAR(300) NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_plugins_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO system_plugins (name, url, icon, description, roles, sortOrder, status)
SELECT 'Portal do Cliente', 'https://schimanskiengenharia.com.br/portal', '🌐',
       'Acesso ao portal externo do cliente (URL configurável).', '', 1, 'Ativo'
WHERE NOT EXISTS (SELECT 1 FROM system_plugins);
