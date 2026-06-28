-- Endereço próprio da obra + toggle "mesmo endereço da empresa" (v1.15.5).
-- Migração SEGURA e idempotente. Rode depois de backup:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-28-obra-endereco-local.sql
--
-- A tabela `projects` JÁ possui `address` (logradouro da obra) e `zipCode` (CEP).
-- Por isso NÃO criamos obra_endereco/obra_cep — reaproveitamos as colunas reais e só
-- adicionamos o que falta (flag + bairro/cidade/estado, no mesmo padrão de clients/suppliers).

USE financeiro;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS usa_endereco_empresa TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '1 = usa endereço da empresa (company_settings); 0 = endereço próprio da obra',
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(2) NULL;

-- Não-regressão: obras que JÁ têm endereço próprio mantêm o comportamento anterior
-- (usavam o próprio address). Só as novas/sem endereço caem no default = empresa.
UPDATE projects SET usa_endereco_empresa = 0
  WHERE (usa_endereco_empresa = 1 OR usa_endereco_empresa IS NULL)
    AND address IS NOT NULL AND TRIM(address) <> '';

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES ('v1.15.5', '2026-06-28', 'Endereço próprio da obra com toggle mesmo-local-da-empresa.',
  'Toggle "A obra fica no mesmo endereço da empresa?" no cadastro de obra; quando NÃO, bloco de endereço próprio (CEP autofill) com bairro/cidade/estado; PDFs usam o endereço próprio quando usa_endereco_empresa=0.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);
