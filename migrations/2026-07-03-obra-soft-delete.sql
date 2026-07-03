-- Migration: soft-delete de obras (correção G3 da revisão geral).
-- Excluir uma obra deixava cascatas apagarem registros vinculados — inclusive
-- fiscal_documents (nota fiscal, ON DELETE CASCADE da migration 2026-06-06).
-- A exclusão vira ARQUIVAMENTO: UPDATE projects SET deletedAt = NOW() e nada
-- vinculado é tocado. As FKs destrutivas viram RESTRICT como trava de fundo:
-- se algum código ainda tentar DELETE físico, o banco bloqueia em vez de
-- arrastar a nota fiscal junto.
--
-- Idempotente (ADD COLUMN/INDEX IF NOT EXISTS; o par DROP IF EXISTS + ADD das
-- FKs pode ser re-executado). Espelhada em runtime por ensure_project_soft_delete()
-- no api/index.php, que também converte FKs CASCADE com outros nomes.

USE financeiro;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deletedAt DATETIME NULL COMMENT 'Soft-delete (G3): NULL = obra ativa; preenchida = arquivada (nunca apagar fisicamente)',
  ADD COLUMN IF NOT EXISTS deletedBy BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS archivedReason VARCHAR(255) NULL;

ALTER TABLE projects ADD INDEX IF NOT EXISTS idx_projects_deleted (deletedAt);

-- Nota fiscal NUNCA mais é apagada por exclusão de obra.
ALTER TABLE fiscal_documents DROP FOREIGN KEY IF EXISTS fk_fiscal_project;
ALTER TABLE fiscal_documents ADD CONSTRAINT fk_fiscal_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE RESTRICT;

-- Orçamentos de obra idem (em bancos antigos a FK pode nem existir; o par
-- DROP IF EXISTS + ADD cria/normaliza para RESTRICT).
ALTER TABLE orcamentos_obras DROP FOREIGN KEY IF EXISTS fk_orc_obra_project;
ALTER TABLE orcamentos_obras ADD CONSTRAINT fk_orc_obra_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE RESTRICT;
