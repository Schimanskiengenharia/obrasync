-- Snapshot dos dados do cliente no momento da criação da proposta/contrato.
-- Preserva os dados exatos usados no PDF mesmo que o cadastro do cliente mude
-- depois. Migração segura/idempotente (MariaDB 10.5+).
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-snapshot-cliente-proposta.sql
--
-- Tabelas reais: commercial_proposals (propostas) e sales_contracts (vendas/
-- contratos), ambas com a coluna clientId. A tabela `clients` real só tem
-- name, document, email, phone, zipCode e address — cidade/estado não existem
-- na origem, então essas colunas de snapshot ficam disponíveis mas vazias até
-- haver dado de origem (preenchidas se um dia o cadastro de clientes ganhar
-- cidade/estado).

USE financeiro;

ALTER TABLE commercial_proposals
  ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(200) NULL AFTER clientId,
  ADD COLUMN IF NOT EXISTS cliente_cpf_cnpj VARCHAR(20) NULL AFTER cliente_nome,
  ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(150) NULL AFTER cliente_cpf_cnpj,
  ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(20) NULL AFTER cliente_email,
  ADD COLUMN IF NOT EXISTS cliente_endereco TEXT NULL AFTER cliente_telefone,
  ADD COLUMN IF NOT EXISTS cliente_cidade VARCHAR(100) NULL AFTER cliente_endereco,
  ADD COLUMN IF NOT EXISTS cliente_estado VARCHAR(2) NULL AFTER cliente_cidade,
  ADD COLUMN IF NOT EXISTS cliente_cep VARCHAR(10) NULL AFTER cliente_estado;

ALTER TABLE sales_contracts
  ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(200) NULL AFTER clientId,
  ADD COLUMN IF NOT EXISTS cliente_cpf_cnpj VARCHAR(20) NULL AFTER cliente_nome,
  ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(150) NULL AFTER cliente_cpf_cnpj,
  ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(20) NULL AFTER cliente_email,
  ADD COLUMN IF NOT EXISTS cliente_endereco TEXT NULL AFTER cliente_telefone,
  ADD COLUMN IF NOT EXISTS cliente_cidade VARCHAR(100) NULL AFTER cliente_endereco,
  ADD COLUMN IF NOT EXISTS cliente_estado VARCHAR(2) NULL AFTER cliente_cidade,
  ADD COLUMN IF NOT EXISTS cliente_cep VARCHAR(10) NULL AFTER cliente_estado;
