-- Libera o módulo Notas Fiscais / Documentos Fiscais para perfis de obra.
-- Necessário para que a importação XML NFS-e apareça no módulo fiscalDocuments.

INSERT INTO role_permissions
  (`role`, module, canView, canCreate, canEdit, canDelete, canExport, canApprove, canAttach, status)
VALUES
  ('engenharia', 'fiscalDocuments', 'Sim', 'Sim', 'Sim', 'Não', 'Sim', 'Não', 'Sim', 'Ativo'),
  ('gestor_obra', 'fiscalDocuments', 'Sim', 'Sim', 'Sim', 'Não', 'Sim', 'Não', 'Sim', 'Ativo')
ON DUPLICATE KEY UPDATE
  canView = VALUES(canView),
  canCreate = VALUES(canCreate),
  canEdit = VALUES(canEdit),
  canExport = VALUES(canExport),
  canAttach = VALUES(canAttach),
  status = VALUES(status);
