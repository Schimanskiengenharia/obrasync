-- Endereço estruturado (número, complemento, bairro, cidade, estado) também em
-- fornecedores e nos dados da empresa, no mesmo padrão dos clientes. Migração
-- segura/idempotente (MariaDB 10.5+).
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-campos-endereco-fornecedores-empresa.sql
--
-- Tabelas reais:
--   suppliers        já tem name, document, zipCode, address, email, phone, status
--   company_settings já tem name, document, zipCode, address, email, phone, city, status
-- Por isso company_settings NÃO recebe `cidade` — reaproveita a coluna `city`.

USE financeiro;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20) NULL AFTER address,
  ADD COLUMN IF NOT EXISTS complemento VARCHAR(100) NULL AFTER numero,
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(100) NULL AFTER complemento,
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100) NULL AFTER bairro,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(2) NULL AFTER cidade;

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20) NULL AFTER address,
  ADD COLUMN IF NOT EXISTS complemento VARCHAR(100) NULL AFTER numero,
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(100) NULL AFTER complemento,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(2) NULL AFTER city;
