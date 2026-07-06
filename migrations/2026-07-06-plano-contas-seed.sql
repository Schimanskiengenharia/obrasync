-- Seed do plano de contas gerencial (engenharia/construção no Simples Nacional).
-- Só insere quando chart_accounts está COMPLETAMENTE vazia (não mexe em plano
-- já cadastrado pelo usuário). Idempotente: na segunda execução @plano_vazio = 0
-- e os INSERTs viram no-op. Auto-cura equivalente: ensure_default_chart_accounts
-- (api/index.php), chamada no bootstrap.
-- @plano_vazio é avaliada ANTES dos INSERTs porque as contas analíticas (2º
-- INSERT) precisam dos grupos (1º INSERT) já gravados para resolver o parentId.

SET @plano_vazio := (SELECT COUNT(*) = 0 FROM chart_accounts);

-- Grupos sintéticos (não recebem lançamentos)
INSERT INTO chart_accounts (code, name, `type`, parentId, acceptsEntries, status)
SELECT d.code, d.name, d.tipo, NULL, 'Não', 'Ativo'
FROM (
  SELECT '1' AS code, 'Receitas' AS name, 'Receita' AS tipo
  UNION ALL SELECT '2', 'Custos diretos', 'Despesa'
  UNION ALL SELECT '3', 'Despesas operacionais', 'Despesa'
  UNION ALL SELECT '4', 'Despesas financeiras e tributárias', 'Despesa'
  UNION ALL SELECT '5', 'Investimentos', 'Ativo'
) AS d
WHERE @plano_vazio;

-- Contas analíticas (recebem lançamentos), penduradas no grupo pelo código
INSERT INTO chart_accounts (code, name, `type`, parentId, acceptsEntries, status)
SELECT d.code, d.name, d.tipo, p.id, 'Sim', 'Ativo'
FROM (
  SELECT '1.1' AS code, 'Receita de serviços de engenharia' AS name, 'Receita' AS tipo, '1' AS parentCode
  UNION ALL SELECT '1.2', 'Receita de obras e instalações', 'Receita', '1'
  UNION ALL SELECT '1.3', 'Receita de energia solar', 'Receita', '1'
  UNION ALL SELECT '1.9', 'Outras receitas', 'Receita', '1'
  UNION ALL SELECT '2.1', 'Materiais aplicados em obra', 'Despesa', '2'
  UNION ALL SELECT '2.2', 'Mão de obra direta', 'Despesa', '2'
  UNION ALL SELECT '2.3', 'Serviços de terceiros em obra', 'Despesa', '2'
  UNION ALL SELECT '2.4', 'Equipamentos e locações de obra', 'Despesa', '2'
  UNION ALL SELECT '2.9', 'Outros custos diretos', 'Despesa', '2'
  UNION ALL SELECT '3.1', 'Despesas administrativas', 'Despesa', '3'
  UNION ALL SELECT '3.2', 'Despesas com pessoal (administrativo)', 'Despesa', '3'
  UNION ALL SELECT '3.3', 'Despesas comerciais e marketing', 'Despesa', '3'
  UNION ALL SELECT '3.4', 'Despesas com veículos e deslocamento', 'Despesa', '3'
  UNION ALL SELECT '3.9', 'Outras despesas operacionais', 'Despesa', '3'
  UNION ALL SELECT '4.1', 'Impostos e taxas (DAS, CREA)', 'Despesa', '4'
  UNION ALL SELECT '4.2', 'Tarifas e juros', 'Despesa', '4'
  UNION ALL SELECT '4.3', 'Empréstimos e financiamentos', 'Despesa', '4'
  UNION ALL SELECT '5.1', 'Imobilizado (equipamentos, veículos, móveis)', 'Ativo', '5'
) AS d
JOIN chart_accounts p ON p.code = d.parentCode
WHERE @plano_vazio;
