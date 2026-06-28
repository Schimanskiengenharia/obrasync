-- Migração: de-para em lote da IA passa a ler TODAS as abas do Excel e usa o nome
-- da aba como grupo/categoria. Adiciona a coluna grupoAba em ia_depara_itens.
-- Idempotente; também aplicada em runtime por ensure_ia_depara_tables() (ALTER ...
-- ADD COLUMN IF NOT EXISTS) no api/index.php.

USE financeiro;

ALTER TABLE ia_depara_itens
  ADD COLUMN IF NOT EXISTS grupoAba VARCHAR(160) NULL AFTER jobId;
