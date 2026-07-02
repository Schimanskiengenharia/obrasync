-- Amplia o ENUM de obra_notificacoes.type para aceitar 'ALERTA_VENCIMENTO', usado
-- pelos alertas automáticos de vencimento gerados pelo cron (api/cron/jobs.php ->
-- create_due_alerts). Sem isso, em sql_mode estrito o INSERT do alerta falhava com
-- valor fora do enum e abortava a cadeia de jobs do cron (purge/DRE nunca rodavam).
--
-- MODIFY reescreve o enum por completo, então re-executar é seguro (idempotente).
-- A mesma auto-cura roda em runtime via ensure_obra_notificacoes_alert_type() no
-- api/index.php. Compatível com o usuário financeiro_app (sem DROP/TRUNCATE).

ALTER TABLE obra_notificacoes
  MODIFY COLUMN `type` ENUM('WhatsApp manual', 'ALERTA_VENCIMENTO') NOT NULL DEFAULT 'WhatsApp manual';
