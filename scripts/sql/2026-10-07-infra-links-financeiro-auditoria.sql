-- Infra — mudança do caminho público /financeiro → /obrasync. SOMENTE LEITURA.
-- Conta os links gravados no banco que ainda apontam para o caminho antigo (dependem do 301).
-- Como rodar: mysql -u financeiro_app -p -h 127.0.0.1 financeiro < scripts/sql/2026-10-07-infra-links-financeiro-auditoria.sql
-- Comparações são coluna × literal (não texto × texto entre colunas): sem risco de collation mista;
-- os literais do UNION recebem COLLATE explícito mesmo assim.
SET NAMES utf8mb4;

SELECT k, v FROM (
  SELECT _utf8mb4'links_acompanhamento_total' COLLATE utf8mb4_unicode_ci AS k, COUNT(*) AS v FROM obra_links_acompanhamento
  UNION ALL SELECT _utf8mb4'links_acompanhamento_com_financeiro' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM obra_links_acompanhamento WHERE url LIKE '%schimanskiengenharia.com.br/financeiro%'
  UNION ALL SELECT _utf8mb4'links_acompanhamento_ativos_com_financeiro' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM obra_links_acompanhamento WHERE status = 'Ativo' AND url LIKE '%schimanskiengenharia.com.br/financeiro%'
  UNION ALL SELECT _utf8mb4'notificacoes_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM obra_notificacoes
  UNION ALL SELECT _utf8mb4'notificacoes_com_financeiro_na_mensagem' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM obra_notificacoes WHERE message LIKE '%schimanskiengenharia.com.br/financeiro%'
  UNION ALL SELECT _utf8mb4'notificacoes_com_financeiro_no_link' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM obra_notificacoes WHERE generatedLink LIKE '%schimanskiengenharia.com.br%2Ffinanceiro%' OR generatedLink LIKE '%schimanskiengenharia.com.br/financeiro%'
  UNION ALL SELECT _utf8mb4'notificacoes_enviadas_com_financeiro' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM obra_notificacoes WHERE status <> 'Preparado' AND (message LIKE '%schimanskiengenharia.com.br/financeiro%' OR generatedLink LIKE '%schimanskiengenharia.com.br%2Ffinanceiro%')
  UNION ALL SELECT _utf8mb4'plugins_com_financeiro' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM system_plugins WHERE url LIKE '%schimanskiengenharia.com.br/financeiro%'
) t;

-- Detalhe dos links de acompanhamento (candidatos ao UPDATE opcional, se o dono decidir):
SELECT id, projectId, status, url FROM obra_links_acompanhamento WHERE url LIKE '%schimanskiengenharia.com.br/financeiro%' ORDER BY id;
