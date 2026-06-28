-- Hierarquia de proposta por disciplina + modelos reutilizáveis (v1.16.0).
-- Migração SEGURA e idempotente. Rode depois de backup:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-28-proposta-hierarquia-modelos.sql
--
-- IMPORTANTE: as tabelas `proposta_grupos`/`proposta_orcamentos`/`proposta_modelos` NÃO
-- existiam neste banco (specs anteriores rodaram em outro contexto). O vínculo real
-- proposta↔orçamento é `proposta_orcamento_vinculos`. Aqui: criamos `proposta_grupos`
-- (árvore de disciplinas) e `proposta_modelos`, e estendemos as tabelas reais.

USE financeiro;

-- ── PARTE 1 — árvore de grupos por disciplina (nível 1 = disciplina, nível 2 = subprojeto)
CREATE TABLE IF NOT EXISTS proposta_grupos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proposalId BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NULL COMMENT 'FK lógica p/ proposta_grupos.id (aninhamento)',
  nivel TINYINT NOT NULL DEFAULT 1,
  ordem INT NOT NULL DEFAULT 0,
  disciplina VARCHAR(60) NULL COMMENT 'Elétrico, Hidráulico, Civil, etc.',
  nome VARCHAR(200) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pg_proposal (proposalId),
  INDEX idx_pg_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cada orçamento vinculado cai sob um grupo/disciplina.
ALTER TABLE proposta_orcamento_vinculos
  ADD COLUMN IF NOT EXISTS grupo_id BIGINT UNSIGNED NULL COMMENT 'proposta_grupos.id (nível 2)',
  ADD COLUMN IF NOT EXISTS disciplina VARCHAR(60) NULL COMMENT 'Disciplina do grupo';

-- Item pode referenciar diretamente o grupo (senão herda do vínculo do orçamento).
ALTER TABLE proposta_itens
  ADD COLUMN IF NOT EXISTS grupo_id BIGINT UNSIGNED NULL COMMENT 'proposta_grupos.id';

-- ── PARTE 2 — modelos/templates de proposta reutilizáveis
CREATE TABLE IF NOT EXISTS proposta_modelos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  descricao TEXT NULL,
  disciplina VARCHAR(60) NULL,
  estrutura_json LONGTEXT NULL COMMENT 'Snapshot da árvore grupos/orçamentos/itens, sem cliente nem valores finais',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pm_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES ('v1.16.0', '2026-06-28', 'Hierarquia de proposta por disciplina + modelos reutilizáveis.',
  'proposta_grupos (árvore disciplina→subgrupo), grupo_id/disciplina nos vínculos e itens, proposta_modelos (estrutura_json) para salvar/clonar propostas, SINAPI no PDF + anexo de composições e export Excel da tabela SINAPI por obra.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);
