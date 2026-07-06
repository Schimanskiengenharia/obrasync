-- F3 (proposta multi-disciplina): descrição/escopo da disciplina no vínculo
-- proposta↔orçamento. O texto aparece como SEÇÃO no documento da proposta (título
-- da disciplina + descrição + valor) e alimenta o detalhamento do contrato.
-- Auto-cura equivalente: ensure_proposta_hierarquia (api/index.php).

ALTER TABLE proposta_orcamento_vinculos
  ADD COLUMN IF NOT EXISTS descricao TEXT NULL COMMENT 'Descrição/escopo da disciplina exibida como seção na proposta';
