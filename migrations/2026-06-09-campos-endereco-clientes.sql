-- Endereço estruturado no cadastro de clientes (número, complemento, bairro,
-- cidade, estado) para alimentar o snapshot de propostas/contratos com cidade
-- e estado. Migração segura/idempotente (MariaDB 10.5+).
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-campos-endereco-clientes.sql
--
-- Tabela real `clients` já possui name, document, zipCode (CEP), address
-- (logradouro), email, phone e status. Aqui acrescentamos apenas o que falta.

USE financeiro;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20) NULL AFTER address,
  ADD COLUMN IF NOT EXISTS complemento VARCHAR(100) NULL AFTER numero,
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(100) NULL AFTER complemento,
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100) NULL AFTER bairro,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(2) NULL AFTER cidade;
