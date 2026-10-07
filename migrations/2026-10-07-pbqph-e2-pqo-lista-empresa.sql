-- Migration: PBQP-H Nível B — E2: lista da empresa por obra (executa / não executa).
-- Data: 2026-10-07. ADITIVA e idempotente (ADD COLUMN IF NOT EXISTS). Espelhada por
-- ensure_pqo_lista_empresa_column() em api/index.php (auto-cura em produção).
--
-- Guarda só as EXCEÇÕES ({servicosNaoExecuta:[ids SiAC], materiaisNaoExecuta:[ids da
-- biblioteca MATERIAIS_SIAC]}), então item novo na biblioteca nasce como executado.
-- É o denominador das metas do Nível B (40/50/25%, ceil) calculadas no front (qMetasNivelB);
-- a biblioteca de materiais é constante de código (app.js), como os 27 serviços.

USE financeiro;

ALTER TABLE qualidade_pqo
  ADD COLUMN IF NOT EXISTS listaEmpresaJson LONGTEXT NULL COMMENT 'E2: {servicosNaoExecuta:[ids], materiaisNaoExecuta:[ids]} — lista da empresa por obra';
