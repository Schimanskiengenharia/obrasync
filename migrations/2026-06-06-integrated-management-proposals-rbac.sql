-- Migração segura: evolução para gestão integrada de obras, propostas, permissões e versionamento.
-- Execute no Debian depois de fazer backup:
-- mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-06-integrated-management-proposals-rbac.sql

USE financeiro;

ALTER TABLE system_users
  MODIFY COLUMN role ENUM('admin', 'financeiro', 'comercial', 'engenharia', 'gestor_obra', 'equipe_campo', 'cliente_obra', 'fornecedor_terceiro', 'consulta') NOT NULL DEFAULT 'financeiro';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS technicalResponsible VARCHAR(140) NULL AFTER responsible;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS projectManagerId BIGINT UNSIGNED NULL AFTER technicalResponsible;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS commercialUserId BIGINT UNSIGNED NULL AFTER projectManagerId;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS financialUserId BIGINT UNSIGNED NULL AFTER commercialUserId;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completionDate DATE NULL AFTER endForecast;
ALTER TABLE projects MODIFY COLUMN status ENUM('Planejamento', 'Proposta enviada', 'Contratada', 'Em andamento', 'Pausada', 'Concluída', 'Cancelada') NOT NULL DEFAULT 'Planejamento';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS realizedCost DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER costForecast;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER createdAt;

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS proposalId BIGINT UNSIGNED NULL AFTER projectId;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS createdByUserId BIGINT UNSIGNED NULL AFTER costCenterId;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS commercialUserId BIGINT UNSIGNED NULL AFTER createdByUserId;

ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS proposalId BIGINT UNSIGNED NULL AFTER projectId;
ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS proposalId BIGINT UNSIGNED NULL AFTER projectId;

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
  CONSTRAINT fk_schedule_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_schedule_project (projectId),
  INDEX idx_schedule_dates (startDate, endForecast)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(80) NOT NULL UNIQUE,
  `date` DATE NOT NULL,
  projectId BIGINT UNSIGNED NULL,
  supplierId BIGINT UNSIGNED NULL,
  costCenterId BIGINT UNSIGNED NULL,
  categoryId BIGINT UNSIGNED NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  expectedDate DATE NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Solicitado',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchase_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchase_cost_center FOREIGN KEY (costCenterId) REFERENCES cost_centers(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchase_category FOREIGN KEY (categoryId) REFERENCES financial_categories(id) ON DELETE SET NULL,
  INDEX idx_purchase_project (projectId),
  INDEX idx_purchase_supplier (supplierId),
  INDEX idx_purchase_date (`date`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS technical_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projectId BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  `date` DATE NOT NULL,
  responsible VARCHAR(140),
  visibleToClient ENUM('Não', 'Sim') NOT NULL DEFAULT 'Não',
  status VARCHAR(50) NOT NULL DEFAULT 'Rascunho',
  notes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_technical_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_technical_project (projectId),
  INDEX idx_technical_date (`date`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposal_areas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposal_action_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  areaId BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_action_area FOREIGN KEY (areaId) REFERENCES proposal_areas(id) ON DELETE CASCADE,
  UNIQUE KEY uk_action_area_name (areaId, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposal_service_subtypes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actionTypeId BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subtype_action FOREIGN KEY (actionTypeId) REFERENCES proposal_action_types(id) ON DELETE CASCADE,
  UNIQUE KEY uk_subtype_action_name (actionTypeId, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposal_models (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  areaId BIGINT UNSIGNED NULL,
  actionTypeId BIGINT UNSIGNED NULL,
  subtypeId BIGINT UNSIGNED NULL,
  proposalObject TEXT,
  scope TEXT,
  stages TEXT,
  deliverables TEXT,
  deadline VARCHAR(120),
  paymentTerms TEXT,
  includedItems TEXT,
  excludedItems TEXT,
  clientResponsibilities TEXT,
  companyResponsibilities TEXT,
  validityDays INT UNSIGNED NOT NULL DEFAULT 15,
  acceptanceText TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_model_area FOREIGN KEY (areaId) REFERENCES proposal_areas(id) ON DELETE SET NULL,
  CONSTRAINT fk_model_action FOREIGN KEY (actionTypeId) REFERENCES proposal_action_types(id) ON DELETE SET NULL,
  CONSTRAINT fk_model_subtype FOREIGN KEY (subtypeId) REFERENCES proposal_service_subtypes(id) ON DELETE SET NULL,
  INDEX idx_model_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS commercial_proposals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(80) NOT NULL UNIQUE,
  `date` DATE NOT NULL,
  clientId BIGINT UNSIGNED NULL,
  projectId BIGINT UNSIGNED NULL,
  budgetId BIGINT UNSIGNED NULL,
  serviceId BIGINT UNSIGNED NULL,
  modelId BIGINT UNSIGNED NULL,
  areaId BIGINT UNSIGNED NULL,
  actionTypeId BIGINT UNSIGNED NULL,
  subtypeId BIGINT UNSIGNED NULL,
  origin VARCHAR(80) NOT NULL DEFAULT 'Nova demanda',
  parentProposalId BIGINT UNSIGNED NULL,
  createdByUserId BIGINT UNSIGNED NULL,
  commercialUserId BIGINT UNSIGNED NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  paymentTerms TEXT,
  deadline VARCHAR(120),
  validityDate DATE NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Rascunho',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_proposal_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_budget FOREIGN KEY (budgetId) REFERENCES budgets(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_service FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_model FOREIGN KEY (modelId) REFERENCES proposal_models(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_area FOREIGN KEY (areaId) REFERENCES proposal_areas(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_action FOREIGN KEY (actionTypeId) REFERENCES proposal_action_types(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_subtype FOREIGN KEY (subtypeId) REFERENCES proposal_service_subtypes(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_parent FOREIGN KEY (parentProposalId) REFERENCES commercial_proposals(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_creator FOREIGN KEY (createdByUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_proposal_commercial FOREIGN KEY (commercialUserId) REFERENCES system_users(id) ON DELETE SET NULL,
  INDEX idx_proposal_client (clientId),
  INDEX idx_proposal_project (projectId),
  INDEX idx_proposal_status (status),
  INDEX idx_proposal_commercial (commercialUserId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `role` VARCHAR(60) NOT NULL,
  module VARCHAR(100) NOT NULL,
  canView ENUM('Sim', 'Não') NOT NULL DEFAULT 'Sim',
  canCreate ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  canEdit ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  canDelete ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  canExport ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  canApprove ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  canAttach ENUM('Sim', 'Não') NOT NULL DEFAULT 'Não',
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_module (`role`, module)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sistema_versoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  versao VARCHAR(40) NOT NULL UNIQUE,
  data_versao DATE NOT NULL,
  descricao TEXT,
  alteracoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO sistema_versoes (versao, data_versao, descricao, alteracoes)
VALUES
  ('v1.3.0', '2026-06-06', 'Base integrada de gestão financeira, comercial e de obras.', 'Controle de versão, perfis preparados, obras como eixo central, dashboard consolidado e propostas comerciais por área/tipo/subtipo/modelo.')
ON DUPLICATE KEY UPDATE versao = VALUES(versao);

INSERT INTO role_permissions (`role`, module, canView, canCreate, canEdit, canDelete, canExport, canApprove, canAttach, status)
VALUES
  ('admin', '*', 'Sim', 'Sim', 'Sim', 'Sim', 'Sim', 'Sim', 'Sim', 'Ativo'),
  ('financeiro', 'financeiro', 'Sim', 'Sim', 'Sim', 'Não', 'Sim', 'Sim', 'Sim', 'Ativo'),
  ('comercial', 'propostas', 'Sim', 'Sim', 'Sim', 'Não', 'Sim', 'Não', 'Não', 'Ativo'),
  ('engenharia', 'obras', 'Sim', 'Não', 'Sim', 'Não', 'Sim', 'Não', 'Sim', 'Ativo')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_areas (name, description, status)
VALUES
  ('Engenharia Elétrica', 'Projetos, execução, laudos e consultoria elétrica.', 'Ativo'),
  ('Engenharia Civil', 'Projetos, execução, laudos e consultoria civil.', 'Ativo'),
  ('Arquitetura', 'Projetos arquitetônicos, interiores, regularização e acompanhamento.', 'Ativo'),
  ('Gestão de Obras', 'Planejamento, gestão, medição, relatórios e entrega.', 'Ativo'),
  ('Energia Solar Fotovoltaica', 'Projetos, execução, inspeções e consultoria solar.', 'Ativo')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_action_types (areaId, name, description, status)
SELECT id, 'Projetos', 'Projetos técnicos e documentos executivos.', 'Ativo' FROM proposal_areas WHERE name IN ('Engenharia Elétrica', 'Engenharia Civil', 'Arquitetura', 'Energia Solar Fotovoltaica')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_action_types (areaId, name, description, status)
SELECT id, 'Execução', 'Execução, reforma, instalação, adequação e manutenção.', 'Ativo' FROM proposal_areas WHERE name IN ('Engenharia Elétrica', 'Engenharia Civil', 'Energia Solar Fotovoltaica')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_action_types (areaId, name, description, status)
SELECT id, 'Laudos e relatórios', 'Laudos técnicos, inspeções, vistorias e relatórios.', 'Ativo' FROM proposal_areas WHERE name IN ('Engenharia Elétrica', 'Engenharia Civil', 'Arquitetura')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_action_types (areaId, name, description, status)
SELECT id, 'Gestão', 'Gestão de obra, fiscalização, medição e controle de fornecedores.', 'Ativo' FROM proposal_areas WHERE name = 'Gestão de Obras'
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_service_subtypes (actionTypeId, name, description, status)
SELECT pat.id, seed.name, seed.description, 'Ativo'
FROM proposal_action_types pat
JOIN proposal_areas pa ON pa.id = pat.areaId
JOIN (
  SELECT 'Engenharia Elétrica' area_name, 'Projetos' action_name, 'Instalações elétricas de baixa tensão' name, 'Projeto elétrico completo em baixa tensão.' description
  UNION ALL SELECT 'Engenharia Elétrica', 'Projetos', 'SPDA e aterramento', 'Projeto de proteção contra descargas atmosféricas e aterramento.'
  UNION ALL SELECT 'Engenharia Elétrica', 'Projetos', 'Padrão de entrada / agrupamento de medição', 'Projeto e regularização de padrão de entrada.'
  UNION ALL SELECT 'Engenharia Elétrica', 'Execução', 'Reforma elétrica', 'Adequação e modernização de instalações elétricas.'
  UNION ALL SELECT 'Engenharia Elétrica', 'Execução', 'Manutenção elétrica', 'Manutenção preventiva e corretiva.'
  UNION ALL SELECT 'Engenharia Elétrica', 'Laudos e relatórios', 'Laudo técnico elétrico', 'Laudo técnico com diagnóstico e recomendações.'
  UNION ALL SELECT 'Engenharia Civil', 'Projetos', 'Projeto estrutural', 'Projeto estrutural civil.'
  UNION ALL SELECT 'Engenharia Civil', 'Projetos', 'Projeto hidrossanitário', 'Projeto hidrossanitário e documentação técnica.'
  UNION ALL SELECT 'Engenharia Civil', 'Execução', 'Reforma', 'Execução de reforma civil.'
  UNION ALL SELECT 'Engenharia Civil', 'Laudos e relatórios', 'Relatório de medição', 'Relatório técnico de medição de obra.'
  UNION ALL SELECT 'Arquitetura', 'Projetos', 'Projeto arquitetônico', 'Projeto arquitetônico completo.'
  UNION ALL SELECT 'Arquitetura', 'Projetos', 'Projeto legal para prefeitura', 'Projeto legal para aprovação municipal.'
  UNION ALL SELECT 'Gestão de Obras', 'Gestão', 'Relatórios periódicos', 'Relatórios de acompanhamento físico e financeiro.'
  UNION ALL SELECT 'Gestão de Obras', 'Gestão', 'Controle de fornecedores', 'Gestão e controle de fornecedores vinculados à obra.'
  UNION ALL SELECT 'Energia Solar Fotovoltaica', 'Projetos', 'Sistema on-grid', 'Projeto fotovoltaico conectado à rede.'
  UNION ALL SELECT 'Energia Solar Fotovoltaica', 'Projetos', 'Grid zero', 'Solução com controle de exportação.'
  UNION ALL SELECT 'Energia Solar Fotovoltaica', 'Execução', 'Instalação comercial', 'Instalação fotovoltaica comercial.'
  UNION ALL SELECT 'Energia Solar Fotovoltaica', 'Execução', 'Retrofit', 'Retrofit e adequação de sistema fotovoltaico.'
) seed ON seed.area_name = pa.name AND seed.action_name = pat.name
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO proposal_models (
  name, areaId, actionTypeId, subtypeId, proposalObject, scope, stages, deliverables,
  deadline, paymentTerms, includedItems, excludedItems, clientResponsibilities,
  companyResponsibilities, validityDays, acceptanceText, status
)
SELECT
  'Projeto elétrico comercial',
  pa.id,
  pat.id,
  pst.id,
  'Elaboração de projeto elétrico comercial para {{nome_obra}}.',
  'Levantamento técnico, dimensionamento, diagramas, quadros, iluminação, tomadas e memorial descritivo.',
  '1. Levantamento; 2. Anteprojeto; 3. Projeto executivo; 4. Entrega técnica.',
  'Pranchas, memorial descritivo, lista de materiais e ART/RRT quando aplicável.',
  '30 dias',
  '40% na aprovação, 40% na entrega preliminar e 20% no aceite.',
  'Reuniões técnicas, arquivos PDF e revisão técnica.',
  'Taxas, execução da obra e aprovações externas não contratadas.',
  'Fornecer documentos, acesso ao local e informações de carga.',
  'Elaborar documentos técnicos e orientar ajustes necessários.',
  15,
  'Aceite eletrônico ou assinatura da proposta.',
  'Ativo'
FROM proposal_areas pa
JOIN proposal_action_types pat ON pat.areaId = pa.id AND pat.name = 'Projetos'
JOIN proposal_service_subtypes pst ON pst.actionTypeId = pat.id AND pst.name = 'Instalações elétricas de baixa tensão'
WHERE pa.name = 'Engenharia Elétrica'
  AND NOT EXISTS (SELECT 1 FROM proposal_models WHERE name = 'Projeto elétrico comercial');
