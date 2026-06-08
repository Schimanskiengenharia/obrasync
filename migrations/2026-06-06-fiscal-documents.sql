-- Migração segura: cria tabela de notas/documentos fiscais sem alterar dados existentes.
-- Execute no Debian:
-- mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-06-fiscal-documents.sql

USE financeiro;

CREATE TABLE IF NOT EXISTS fiscal_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  supplierId BIGINT UNSIGNED NULL,
  documentNumber VARCHAR(100) NOT NULL,
  issueDate DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  `type` ENUM('Nota Fiscal de Serviço', 'Nota Fiscal de Produto', 'Recibo', 'Comprovante', 'Outro') NOT NULL DEFAULT 'Nota Fiscal de Serviço',
  status ENUM('Pendente', 'Anexada', 'Conferida', 'Cancelada') NOT NULL DEFAULT 'Pendente',
  payableId BIGINT UNSIGNED NULL,
  receivableId BIGINT UNSIGNED NULL,
  saleId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  categoryId BIGINT UNSIGNED NULL,
  pdfPath VARCHAR(500) NULL,
  xmlPath VARCHAR(500) NULL,
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fiscal_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_fiscal_supplier FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_payable FOREIGN KEY (payableId) REFERENCES accounts_payable(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_receivable FOREIGN KEY (receivableId) REFERENCES accounts_receivable(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_sale FOREIGN KEY (saleId) REFERENCES sales_contracts(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_category FOREIGN KEY (categoryId) REFERENCES financial_categories(id) ON DELETE SET NULL,
  INDEX idx_fiscal_project (projectId),
  INDEX idx_fiscal_supplier (supplierId),
  INDEX idx_fiscal_issue (issueDate),
  INDEX idx_fiscal_status (status)
) ENGINE=InnoDB;
