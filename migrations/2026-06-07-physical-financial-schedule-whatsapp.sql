-- Migração segura: cronograma físico-financeiro, marcos, links de acompanhamento e notificações WhatsApp manual.
-- Execute no Debian depois de fazer backup:
-- mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-07-physical-financial-schedule-whatsapp.sql

USE financeiro;

CREATE TABLE IF NOT EXISTS sistema_versoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  versao VARCHAR(40) NOT NULL UNIQUE,
  data_versao DATE NOT NULL,
  descricao TEXT,
  alteracoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS project_schedule (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  stage VARCHAR(180) NOT NULL,
  startDate DATE NULL,
  endForecast DATE NULL,
  completionDate DATE NULL,
  physicalProgress DECIMAL(9,4) NOT NULL DEFAULT 0,
  financialProgress DECIMAL(9,4) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'Planejado',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schedule_project (projectId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_cronograma_etapas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  stageName VARCHAR(180) NOT NULL,
  description TEXT,
  sortOrder INT NOT NULL DEFAULT 0,
  plannedStartDate DATE NULL,
  plannedEndDate DATE NULL,
  actualStartDate DATE NULL,
  actualEndDate DATE NULL,
  plannedPhysicalPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
  actualPhysicalPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
  plannedFinancialAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
  actualFinancialAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status ENUM('Não iniciada', 'Em andamento', 'Concluída', 'Atrasada', 'Pausada', 'Cancelada') NOT NULL DEFAULT 'Não iniciada',
  responsible VARCHAR(140),
  isMilestone ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  milestoneName VARCHAR(180),
  milestoneMessage TEXT,
  visibleToClient ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_obra_crono_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_obra_crono_project (projectId),
  INDEX idx_obra_crono_dates (plannedStartDate, plannedEndDate),
  INDEX idx_obra_crono_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_cronograma_marcos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  scheduleStepId BIGINT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  defaultMessage TEXT,
  visibleToClient ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  plannedDate DATE NULL,
  completedDate DATE NULL,
  status ENUM('Pendente', 'Concluído', 'Cancelado') NOT NULL DEFAULT 'Pendente',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_obra_marco_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_obra_marco_step FOREIGN KEY (scheduleStepId) REFERENCES obra_cronograma_etapas(id) ON DELETE SET NULL,
  INDEX idx_obra_marco_project (projectId),
  INDEX idx_obra_marco_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_links_acompanhamento (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  token VARCHAR(120) NOT NULL UNIQUE,
  url VARCHAR(500) NOT NULL,
  visibility ENUM('Interno', 'Cliente/Investidor') NOT NULL DEFAULT 'Interno',
  status ENUM('Ativo', 'Inativo') NOT NULL DEFAULT 'Ativo',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_obra_link_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_obra_link_project (projectId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obra_notificacoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  scheduleStepId BIGINT UNSIGNED NULL,
  milestoneId BIGINT UNSIGNED NULL,
  recipient VARCHAR(180) NOT NULL,
  phone VARCHAR(40),
  `type` ENUM('WhatsApp manual') NOT NULL DEFAULT 'WhatsApp manual',
  message TEXT,
  generatedLink TEXT,
  status ENUM('Preparado', 'Enviado manualmente', 'Cancelado') NOT NULL DEFAULT 'Preparado',
  responsibleUserId BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_obra_notif_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_obra_notif_step FOREIGN KEY (scheduleStepId) REFERENCES obra_cronograma_etapas(id) ON DELETE SET NULL,
  CONSTRAINT fk_obra_notif_marco FOREIGN KEY (milestoneId) REFERENCES obra_cronograma_marcos(id) ON DELETE SET NULL,
  CONSTRAINT fk_obra_notif_user FOREIGN KEY (responsibleUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  INDEX idx_obra_notif_project (projectId),
  INDEX idx_obra_notif_status (status)
) ENGINE=InnoDB;

INSERT INTO obra_cronograma_etapas (
  projectId, stageName, sortOrder, plannedStartDate, plannedEndDate, actualEndDate,
  plannedPhysicalPercent, actualPhysicalPercent, status, notes, createdAt, updatedAt
)
SELECT
  ps.projectId,
  ps.stage,
  ps.id,
  ps.startDate,
  ps.endForecast,
  ps.completionDate,
  ps.physicalProgress,
  ps.physicalProgress,
  CASE
    WHEN ps.status = 'Planejado' THEN 'Não iniciada'
    WHEN ps.status = 'Concluído' THEN 'Concluída'
    WHEN ps.status = 'Atrasado' THEN 'Atrasada'
    WHEN ps.status = 'Cancelado' THEN 'Cancelada'
    ELSE ps.status
  END,
  ps.notes,
  ps.createdAt,
  ps.updatedAt
FROM project_schedule ps
WHERE NOT EXISTS (
  SELECT 1
  FROM obra_cronograma_etapas novo
  WHERE novo.projectId = ps.projectId
    AND novo.stageName = ps.stage
);

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES
  ('v1.4.0', '2026-06-07', 'Cronograma físico-financeiro e WhatsApp manual.', 'Cronograma por obra, marcos, Gantt simplificado, histórico de notificações e responsividade reforçada.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);
