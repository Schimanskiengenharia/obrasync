-- Contas a pagar recorrentes (custos fixos / parcelamento) + quitação antecipada.
-- Migração segura e idempotente (MariaDB 10.5+): só adiciona colunas/índices.
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-contas-recorrentes.sql
--
-- Colunas reais já existentes em accounts_payable (não são alteradas):
--   document, issueDate, dueDate, paidDate, supplierId, projectId,
--   categoryId, costCenterId, bankAccount, amount, status.

USE financeiro;

ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS recorrencia_id VARCHAR(36) NULL
    COMMENT 'UUID do grupo de recorrência' AFTER status,
  ADD COLUMN IF NOT EXISTS parcela_numero INT NULL
    COMMENT 'Número da parcela ex: 1' AFTER recorrencia_id,
  ADD COLUMN IF NOT EXISTS parcela_total INT NULL
    COMMENT 'Total de parcelas ex: 12 (NULL = indeterminado)' AFTER parcela_numero,
  ADD COLUMN IF NOT EXISTS recorrencia_tipo
    ENUM('mensal','bimestral','trimestral','semestral','anual') NULL AFTER parcela_total,
  ADD COLUMN IF NOT EXISTS juros_aplicado DECIMAL(10,2) NULL
    COMMENT 'Valor de juros aplicado na quitação antecipada' AFTER recorrencia_tipo,
  ADD COLUMN IF NOT EXISTS valor_original DECIMAL(10,2) NULL
    COMMENT 'Valor original antes de juros ou desconto' AFTER juros_aplicado;

-- Agrupa rapidamente as parcelas de uma mesma recorrência.
ALTER TABLE accounts_payable
  ADD INDEX IF NOT EXISTS idx_recorrencia (recorrencia_id);

-- Log de automações do sistema (quitação antecipada, geração de parcelas etc.).
-- Já é consumido por log_automation_event() em api/index.php, mas não existia
-- no schema base — criado aqui para que os eventos passem a ser persistidos.
CREATE TABLE IF NOT EXISTS eventos_automacao (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipo_evento VARCHAR(60) NOT NULL,
  entidade_origem_tipo VARCHAR(60) NULL,
  entidade_origem_id BIGINT UNSIGNED NULL,
  entidade_gerada_tipo VARCHAR(60) NULL,
  entidade_gerada_id BIGINT UNSIGNED NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OK',
  mensagem_erro TEXT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_eventos_automacao_tipo (tipo_evento),
  INDEX idx_eventos_automacao_origem (entidade_origem_tipo, entidade_origem_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
