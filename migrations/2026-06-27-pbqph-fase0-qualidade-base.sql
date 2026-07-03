-- Migration: tabelas base do módulo Qualidade (PBQP-H) — "fase 0".
-- Data: 2026-06-27 (retroativa; criada na correção G4 da revisão geral de 2026-07-01)
--
-- Estas tabelas existiam APENAS via ensure_qualidade_tables() (api/index.php) — nenhuma
-- migration as criava. Com isso, rodar as migrations em sequência num banco NOVO abortava
-- em 2026-06-27-pbqph-fase1.sql, que faz ALTER TABLE em qualidade_fvm/qualidade_pes.
-- O nome "fase0" ordena alfabeticamente ANTES de "fase1" de propósito.
--
-- DDL transcrito de ensure_qualidade_tables() (estado pré-Fase 1: as colunas de
-- rastreabilidade da FVM e de anexo do PES são adicionadas pela fase1). Idempotente
-- (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS); em bancos existentes,
-- onde o ensure_* já criou tudo, é um no-op.

USE financeiro;

CREATE TABLE IF NOT EXISTS qualidade_politica (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conteudo TEXT NOT NULL,
  versao VARCHAR(20) NOT NULL DEFAULT '1.0',
  aprovadoPor VARCHAR(120) NULL,
  dataAprovacao DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Rascunho',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_pes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  servicoSiacId TINYINT UNSIGNED NOT NULL,
  servicoNome VARCHAR(200) NOT NULL,
  servicoGrupo VARCHAR(100) NOT NULL DEFAULT '',
  versao VARCHAR(20) NOT NULL DEFAULT '1.0',
  objetivo TEXT NULL,
  materiaisNecessarios TEXT NULL,
  equipamentosEpi TEXT NULL,
  procedimento LONGTEXT NULL,
  criteriosAceitacao TEXT NULL,
  normasReferencia VARCHAR(500) NULL,
  responsavelElaboracao VARCHAR(120) NULL,
  dataElaboracao DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Rascunho',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_pes_servico (servicoSiacId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_pqo (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  versao VARCHAR(20) NOT NULL DEFAULT '1.0',
  responsavelTecnico VARCHAR(120) NULL,
  crea VARCHAR(60) NULL,
  dataInicioPrevisto DATE NULL,
  dataFimPrevisto DATE NULL,
  escopo TEXT NULL,
  servicosControlados LONGTEXT NULL,
  materiaisControlados LONGTEXT NULL,
  metasQualidade TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Rascunho',
  dataAprovacao DATE NULL,
  aprovadoPor VARCHAR(120) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pqo_project (projectId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_fvs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pqoId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NOT NULL,
  etapaId BIGINT UNSIGNED NULL,
  pesId BIGINT UNSIGNED NULL,
  servicoSiacId TINYINT UNSIGNED NOT NULL,
  servicoNome VARCHAR(200) NOT NULL DEFAULT '',
  dataExecucao DATE NULL,
  localObra VARCHAR(200) NULL,
  responsavelExecucao VARCHAR(120) NULL,
  responsavelInspecao VARCHAR(120) NULL,
  itensVerificacao LONGTEXT NULL,
  resultado VARCHAR(30) NULL,
  observacoes TEXT NULL,
  acaoCorretiva TEXT NULL,
  dataInspecao DATE NULL,
  assinaturaExecutor VARCHAR(120) NULL,
  assinaturaInspetor VARCHAR(120) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pendente',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_fvs_project (projectId),
  KEY idx_fvs_etapa (etapaId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_fvm (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pqoId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NOT NULL,
  materialNome VARCHAR(200) NOT NULL,
  materialCodigo VARCHAR(80) NULL,
  fornecedor VARCHAR(200) NULL,
  notaFiscal VARCHAR(80) NULL,
  quantidade DECIMAL(14,3) NULL,
  unidade VARCHAR(40) NULL,
  dataRecebimento DATE NULL,
  responsavelRecebimento VARCHAR(120) NULL,
  itensVerificacao LONGTEXT NULL,
  resultado VARCHAR(30) NULL,
  observacoes TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pendente',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_fvm_project (projectId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_nc (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  pqoId BIGINT UNSIGNED NULL,
  numero VARCHAR(20) NOT NULL,
  origem VARCHAR(20) NOT NULL DEFAULT 'Manual',
  fvsId BIGINT UNSIGNED NULL,
  fvmId BIGINT UNSIGNED NULL,
  descricaoNC TEXT NOT NULL,
  servicoSiacId TINYINT UNSIGNED NULL,
  servicoNome VARCHAR(200) NULL,
  localObra VARCHAR(200) NULL,
  grau VARCHAR(20) NOT NULL DEFAULT 'Menor',
  responsavelDeteccao VARCHAR(120) NULL,
  dataDeteccao DATE NOT NULL,
  prazoAcao DATE NULL,
  acaoCorretiva TEXT NULL,
  responsavelAcao VARCHAR(120) NULL,
  dataAcao DATE NULL,
  verificacaoEficacia TEXT NULL,
  responsavelVerificacao VARCHAR(120) NULL,
  dataVerificacao DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Aberta',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_nc_numero (numero),
  KEY idx_nc_project (projectId),
  KEY idx_nc_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_treinamentos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  pqoId BIGINT UNSIGNED NULL,
  servicoSiacId TINYINT UNSIGNED NOT NULL,
  servicoNome VARCHAR(200) NULL,
  dataTreinamento DATE NOT NULL,
  instrutor VARCHAR(120) NULL,
  participantes TEXT NULL,
  conteudo TEXT NULL,
  cargaHoraria DECIMAL(5,1) NULL,
  observacoes TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_treino_project (projectId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qualidade_auditorias (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'Obra',
  dataAuditoria DATE NOT NULL,
  auditor VARCHAR(120) NULL,
  escopo TEXT NULL,
  checklistSiac LONGTEXT NULL,
  totalItens INT NOT NULL DEFAULT 0,
  itensConformes INT NOT NULL DEFAULT 0,
  ncsAbertas INT NOT NULL DEFAULT 0,
  resultado VARCHAR(30) NULL,
  relatorioTexto TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Agendada',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_audit_project (projectId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vínculo do cronograma com a qualidade (também via ensure_qualidade_tables):
-- etapa de serviço controlado fica bloqueada até a FVS ser aprovada.
ALTER TABLE obra_cronograma_etapas
  ADD COLUMN IF NOT EXISTS servicoSiacId TINYINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS fvsId BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS qualidadeBloqueada TINYINT(1) NOT NULL DEFAULT 0;
