-- Migração segura: adiciona campos opcionais de CEP/endereço sem apagar dados.
-- Execute no Debian:
-- mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-06-contact-fields.sql

USE financeiro;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS zipCode VARCHAR(20) NULL AFTER document;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address VARCHAR(255) NULL AFTER zipCode;

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS zipCode VARCHAR(20) NULL AFTER document;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address VARCHAR(255) NULL AFTER zipCode;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS zipCode VARCHAR(20) NULL AFTER address;

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS zipCode VARCHAR(20) NULL AFTER document;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS address VARCHAR(255) NULL AFTER zipCode;
