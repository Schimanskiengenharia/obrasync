-- Cotações manuais por MATERIAL (Parte 2): consolidado de vencedores por
-- EMPRESA + integração financeira. A conta a pagar é UMA por empresa vencedora
-- (soma dos materiais dela), gravada em accounts_payable (tabela existente, já
-- tem referencia_tipo/referencia_id) com referencia_tipo='COTACAO_MATERIAL'.
-- O vínculo por cotação fica nesta coluna nova (permite gerar outra conta só
-- para materiais novos concluídos depois, sem duplicar os já vinculados).
-- A NF entra pela fiscal_documents existente (payableId já existia) — sem
-- alteração de schema para a NF.
-- Auto-cura equivalente: ensure_cotacao_material_columns (api/index.php).

ALTER TABLE cotacoes
  ADD COLUMN IF NOT EXISTS conta_pagar_id BIGINT UNSIGNED NULL
    COMMENT 'P2: conta a pagar gerada do consolidado de vencedores (accounts_payable.id)';
