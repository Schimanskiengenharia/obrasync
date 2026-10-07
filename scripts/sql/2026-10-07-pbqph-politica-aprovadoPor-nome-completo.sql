-- PBQP-H E1-fix — padronização de aprovadoPor na Política da Qualidade.
-- MUDANÇA DE DADO: NÃO é executada pelo deploy nem pelo código. O dono roda no servidor,
-- com backup antes. 1 linha afetada (esperado).
--
-- Contexto (contagens de 2026-10-07): qualidade_politica id único, v1.0 Vigente, aprovadoPor
-- = "alef" (username digitado no campo livre antigo). A partir do E1-fix, o backend grava o
-- NOME COMPLETO do usuário da sessão ao tornar Vigente (mesma regra do PES). Este script
-- alinha o registro existente ao padrão novo.
--
-- 0) BACKUP (obrigatório antes):
--    mysqldump -u root -p financeiro qualidade_politica > /var/lib/financeiro/backups/qualidade_politica-pre-aprovadoPor-$(date +%Y%m%d-%H%M%S).sql
--
-- 1) CONFERIR o alvo (deve devolver 1 linha com aprovadoPor = 'alef'):
SELECT id, versao, status, aprovadoPor, dataAprovacao FROM qualidade_politica WHERE status = 'Vigente';
--    e o nome completo do usuário "alef" no cadastro (para colar abaixo se for diferente):
SELECT id, username, fullName FROM system_users WHERE username = 'alef';

-- 2) APLICAR (ajuste o nome se o fullName acima for diferente). Só mexe na linha Vigente
--    cujo aprovadoPor ainda é o username; dataAprovacao fica como está (2026-07-05).
-- UPDATE qualidade_politica
--    SET aprovadoPor = 'Alef Schimanski'
--  WHERE status = 'Vigente' AND aprovadoPor = 'alef';
-- (descomente as 3 linhas acima para executar; esperado: Rows matched: 1  Changed: 1)

-- 3) CONFERIR depois:
-- SELECT id, versao, status, aprovadoPor, dataAprovacao FROM qualidade_politica WHERE status = 'Vigente';

-- ROLLBACK (se precisar voltar):
-- UPDATE qualidade_politica SET aprovadoPor = 'alef' WHERE status = 'Vigente' AND aprovadoPor = 'Alef Schimanski';
-- ou restaurar o dump do passo 0:
--   mysql -u root -p financeiro < /var/lib/financeiro/backups/qualidade_politica-pre-aprovadoPor-<data>.sql
