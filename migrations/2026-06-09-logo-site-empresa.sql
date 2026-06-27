-- Logo, site e redes da empresa para o cabeçalho das propostas.
-- Migração segura/idempotente (MariaDB 10.5+).
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-logo-site-empresa.sql
--
-- Tabela real `company_settings` já tem name, document, zipCode, address,
-- numero, complemento, bairro, city, estado, email, phone, status.

USE financeiro;

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NULL
    COMMENT 'Arquivo da logo salvo no servidor (ex.: logo.png)',
  ADD COLUMN IF NOT EXISTS website VARCHAR(200) NULL
    COMMENT 'Site da empresa ex: www.schimanskiengenharia.com.br',
  ADD COLUMN IF NOT EXISTS instagram VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20) NULL
    COMMENT 'Número WhatsApp para contato ex: 5567999999999';
