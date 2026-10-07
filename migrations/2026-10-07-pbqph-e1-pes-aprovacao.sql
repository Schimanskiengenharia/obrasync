-- Migration: PBQP-H Nível B — E1 (pacote 7.5): aprovação do PES.
-- Data: 2026-10-07. ADITIVA e idempotente (ADD COLUMN IF NOT EXISTS). Espelhada por
-- ensure_pes_aprovacao_columns() em api/index.php (auto-cura em produção).
--
-- aprovadoPor/dataAprovacao são preenchidos SÓ pelo backend quando o PES passa a
-- Vigente (nome do usuário da sessão + data do PHP em America/Campo_Grande), no
-- mesmo padrão da assinatura do RDO; ficam fora dos campos graváveis do CRUD.
-- VARCHAR por consistência com qualidade_politica e qualidade_pqo.

USE financeiro;

ALTER TABLE qualidade_pes
  ADD COLUMN IF NOT EXISTS aprovadoPor VARCHAR(120) NULL COMMENT 'E1 (SiAC 7.5): quem tornou o PES Vigente — gravado pelo backend',
  ADD COLUMN IF NOT EXISTS dataAprovacao DATE NULL COMMENT 'E1: data da aprovacao, pelo PHP';
