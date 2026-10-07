-- Migration: PBQP-H Nível B — E1 (pacote 7.5): histórico de versões do PQO.
-- Data: 2026-10-07. ADITIVA e idempotente (CREATE TABLE IF NOT EXISTS). Espelhada por
-- ensure_pqo_versoes_table() em api/index.php (auto-cura em produção).
--
-- Decisão do dono (opção a): o UNIQUE uk_pqo_project de qualidade_pqo fica INTACTO
-- (uma linha por obra = a versão vigente). Ao substituir a vigente (nova versão ou
-- saída de Vigente), o estado anterior inteiro é guardado aqui como snapshot JSON,
-- com quem/quando arquivou. Só o backend grava; o CRUD genérico recusa escrita.

USE financeiro;

CREATE TABLE IF NOT EXISTS qualidade_pqo_versoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pqoId BIGINT UNSIGNED NOT NULL,
  projectId BIGINT UNSIGNED NOT NULL,
  versao VARCHAR(20) NOT NULL DEFAULT '',
  statusAnterior VARCHAR(20) NOT NULL DEFAULT '',
  aprovadoPor VARCHAR(120) NULL,
  dataAprovacao DATE NULL,
  motivo VARCHAR(200) NULL,
  snapshotJson LONGTEXT NULL,
  arquivadoPor VARCHAR(120) NULL,
  arquivadoEm DATETIME NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pqo_versoes_pqo (pqoId),
  KEY idx_pqo_versoes_project (projectId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
