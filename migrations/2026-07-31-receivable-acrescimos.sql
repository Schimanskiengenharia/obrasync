-- Baixa com acréscimos (juros+multa) no CONTAS A RECEBER.
-- Espelha as colunas que accounts_payable já tem desde a recorrência (2026-06-09):
-- valor_original = valor do título ANTES do acréscimo (histórico, nunca sobrescrito);
-- juros_aplicado = acréscimo em R$ informado na baixa (o boleto já vem atualizado);
-- amount passa a ser valor_original + juros_aplicado (regra imposta no backend).
-- ADITIVA e idempotente. Auto-cura: ensure_receivable_acrescimos_columns (api/index.php).

ALTER TABLE accounts_receivable
  ADD COLUMN IF NOT EXISTS juros_aplicado DECIMAL(10,2) NULL COMMENT 'Acréscimo (juros+multa) aplicado na baixa',
  ADD COLUMN IF NOT EXISTS valor_original DECIMAL(10,2) NULL COMMENT 'Valor original do título antes do acréscimo';
