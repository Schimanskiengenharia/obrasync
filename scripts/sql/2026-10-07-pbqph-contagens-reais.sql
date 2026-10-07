-- PBQP-H Nível B — CONTAGENS REAIS (SOMENTE LEITURA) previstas na spec de implantação no
-- Condomínio Atacama (docs/superpowers/specs/2026-09-02-pbqph-nivel-b-implantacao-atacama-design.md)
-- e no diagnóstico §5/§3.1 (docs/revisao/2026-09-pbqph-nivel-b-diagnostico.md).
--
-- Como rodar no servidor (nada é alterado; são só SELECTs):
--   mysql -u financeiro_app -p -h 127.0.0.1 financeiro < scripts/sql/2026-10-07-pbqph-contagens-reais.sql
--
-- COLLATION MISTA: todo literal de texto que entra em UNION recebe COLLATE utf8mb4_unicode_ci;
-- os JOINs são por id numérico; não há comparação texto×texto entre colunas.
-- DATA: a regra do sistema é "data pelo PHP (America/Campo_Grande)". Este relatório é manual;
-- @hoje vem do relógio do servidor MariaDB só por conveniência — se o servidor estiver em UTC
-- e você rodar perto da meia-noite, troque pela data local: SET @hoje = '2026-10-07';

SET NAMES utf8mb4;
SET @hoje = CURRENT_DATE();

-- ─── 0. Pré-condições de esquema (gate fail-open do cronograma; colunas da Fase 1) ────────
-- Esperado: 3 linhas para obra_cronograma_etapas (servicoSiacId, fvsId, qualidadeBloqueada),
-- 7 para qualidade_fvm (lote…purchaseOrderId) e 3 para qualidade_pes (arquivoPdf…arquivoData).
SELECT TABLE_NAME AS tabela, COLUMN_NAME AS coluna
  FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND ((TABLE_NAME = 'obra_cronograma_etapas' AND COLUMN_NAME IN ('servicoSiacId','fvsId','qualidadeBloqueada'))
     OR (TABLE_NAME = 'qualidade_fvm' AND COLUMN_NAME IN ('lote','fabricante','dataFabricacao','validade','localAplicacao','certificadoQualidade','purchaseOrderId'))
     OR (TABLE_NAME = 'qualidade_pes' AND COLUMN_NAME IN ('arquivoPdf','arquivoNome','arquivoData','aprovadoPor','dataAprovacao')))
 ORDER BY tabela, coluna;

-- ─── 1. Contagens gerais (diagnóstico §5, com os ajustes do §6.2/§6.3) ─────────────────────
SELECT k, v FROM (
  SELECT _utf8mb4'politica_vigente' COLLATE utf8mb4_unicode_ci AS k, COUNT(*) AS v FROM qualidade_politica WHERE status = 'Vigente'
  UNION ALL SELECT _utf8mb4'politica_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_politica
  UNION ALL SELECT _utf8mb4'pes_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_pes
  UNION ALL SELECT _utf8mb4'pes_vigentes' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_pes WHERE status = 'Vigente'
  UNION ALL SELECT _utf8mb4'pes_vigentes_servicos_distintos' COLLATE utf8mb4_unicode_ci, COUNT(DISTINCT servicoSiacId) FROM qualidade_pes WHERE status = 'Vigente'
  UNION ALL SELECT _utf8mb4'pes_vigentes_com_pdf' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_pes WHERE status = 'Vigente' AND COALESCE(arquivoPdf, '') <> ''
  UNION ALL SELECT _utf8mb4'pes_sem_pdf' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_pes WHERE COALESCE(arquivoPdf, '') = ''
  UNION ALL SELECT _utf8mb4'pes_obsoletos' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_pes WHERE status = 'Obsoleto'
  UNION ALL SELECT _utf8mb4'pqo_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_pqo
  UNION ALL SELECT _utf8mb4'pqo_vigentes' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_pqo WHERE status = 'Vigente'
  UNION ALL SELECT _utf8mb4'fvs_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_fvs
  UNION ALL SELECT _utf8mb4'fvs_aprovadas' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_fvs WHERE status = 'Aprovada'
  UNION ALL SELECT _utf8mb4'fvs_servicos_distintos_aprovados' COLLATE utf8mb4_unicode_ci, COUNT(DISTINCT servicoSiacId) FROM qualidade_fvs WHERE status = 'Aprovada'
  UNION ALL SELECT _utf8mb4'fvs_sem_etapa' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_fvs WHERE etapaId IS NULL
  UNION ALL SELECT _utf8mb4'fvm_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_fvm
  UNION ALL SELECT _utf8mb4'fvm_com_resultado' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_fvm WHERE COALESCE(resultado, '') <> ''
  UNION ALL SELECT _utf8mb4'fvm_materiais_distintos' COLLATE utf8mb4_unicode_ci, COUNT(DISTINCT LOWER(TRIM(materialNome))) FROM qualidade_fvm
  -- C7 rígido (§6.2): só conta FVM com lote E responsável preenchidos.
  UNION ALL SELECT _utf8mb4'fvm_materiais_distintos_com_lote_e_resp' COLLATE utf8mb4_unicode_ci, COUNT(DISTINCT LOWER(TRIM(materialNome))) FROM qualidade_fvm WHERE COALESCE(lote, '') <> '' AND COALESCE(responsavelRecebimento, '') <> ''
  UNION ALL SELECT _utf8mb4'fvm_sem_lote' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_fvm WHERE COALESCE(lote, '') = ''
  UNION ALL SELECT _utf8mb4'fvm_sem_responsavel' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_fvm WHERE COALESCE(responsavelRecebimento, '') = ''
  UNION ALL SELECT _utf8mb4'fvm_sem_fornecedor_texto' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_fvm WHERE COALESCE(fornecedor, '') = ''
  UNION ALL SELECT _utf8mb4'fvm_com_pedido_vinculado' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_fvm WHERE purchaseOrderId IS NOT NULL
  UNION ALL SELECT _utf8mb4'nc_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_nc
  UNION ALL SELECT _utf8mb4'nc_abertas' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_nc WHERE status <> 'Fechada'
  UNION ALL SELECT _utf8mb4'nc_vencidas' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_nc WHERE status <> 'Fechada' AND prazoAcao IS NOT NULL AND prazoAcao < @hoje
  -- C9: fluxo de NC em uso = fechada com ação corretiva e verificação de eficácia.
  UNION ALL SELECT _utf8mb4'nc_fechadas_com_acao_e_eficacia' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_nc WHERE status = 'Fechada' AND COALESCE(acaoCorretiva, '') <> '' AND COALESCE(verificacaoEficacia, '') <> ''
  UNION ALL SELECT _utf8mb4'treinamentos_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_treinamentos
  UNION ALL SELECT _utf8mb4'auditorias_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_auditorias
  -- C10: auditoria interna realizada no ano corrente.
  UNION ALL SELECT _utf8mb4'auditorias_realizadas_no_ano' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM qualidade_auditorias WHERE status IN ('Realizada', 'Relatorio emitido') AND YEAR(dataAuditoria) = YEAR(@hoje)
  -- C12: etapas com gate travado.
  UNION ALL SELECT _utf8mb4'etapas_bloqueadas_qualidade' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM obra_cronograma_etapas WHERE qualidadeBloqueada = 1
  -- Gate órfão (achado DELETE): etapa travada cuja FVS vinculada não existe mais.
  UNION ALL SELECT _utf8mb4'etapas_bloqueadas_sem_fvs_viva' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM obra_cronograma_etapas e LEFT JOIN qualidade_fvs f ON f.id = e.fvsId WHERE e.qualidadeBloqueada = 1 AND f.id IS NULL
  UNION ALL SELECT _utf8mb4'etapas_com_servico_siac' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM obra_cronograma_etapas WHERE servicoSiacId IS NOT NULL
  UNION ALL SELECT _utf8mb4'fornecedores_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM suppliers
  UNION ALL SELECT _utf8mb4'fornecedores_nao_avaliados' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM suppliers WHERE COALESCE(pbqph_nivel, 'nao_avaliado') = 'nao_avaliado'
  UNION ALL SELECT _utf8mb4'fornecedores_aprovados' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM suppliers WHERE pbqph_nivel = 'aprovado'
  -- E5: pedidos já Recebidos sem nenhuma FVM vinculada (dimensiona o aviso de recebimento sem FVM).
  UNION ALL SELECT _utf8mb4'pedidos_recebidos_sem_fvm' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM purchase_orders po WHERE po.status = 'Recebido' AND NOT EXISTS (SELECT 1 FROM qualidade_fvm m WHERE m.purchaseOrderId = po.id)
  UNION ALL SELECT _utf8mb4'pedidos_recebidos_total' COLLATE utf8mb4_unicode_ci, COUNT(*) FROM purchase_orders WHERE status = 'Recebido'
) t;

-- ─── 2. Por obra: PQO, PES cobrindo o PQO, FVS, FVM, NC, treinamento, registro acumulado (C2–C14) ─
-- Uma linha por obra ativa que tenha PQO ou qualquer registro de qualidade.
SELECT p.id AS obra_id, p.name AS obra, p.status AS obra_status,
       (SELECT q.status FROM qualidade_pqo q WHERE q.projectId = p.id LIMIT 1) AS pqo_status,
       (SELECT q.versao FROM qualidade_pqo q WHERE q.projectId = p.id LIMIT 1) AS pqo_versao,
       (SELECT CHAR_LENGTH(q.servicosControlados) - CHAR_LENGTH(REPLACE(q.servicosControlados, ',', '')) + IF(COALESCE(q.servicosControlados, '[]') IN ('[]', ''), 0, 1)
          FROM qualidade_pqo q WHERE q.projectId = p.id LIMIT 1) AS pqo_servicos_aprox,   -- C3 (contagem por vírgulas do JSON; o front conta exato)
       (SELECT COUNT(*) FROM qualidade_fvs f WHERE f.projectId = p.id) AS fvs,
       (SELECT COUNT(*) FROM qualidade_fvs f WHERE f.projectId = p.id AND f.status = 'Aprovada') AS fvs_aprovadas,
       (SELECT COUNT(DISTINCT f.servicoSiacId) FROM qualidade_fvs f WHERE f.projectId = p.id AND f.status = 'Aprovada') AS servicos_com_fvs_aprovada,   -- C5
       (SELECT MIN(f.dataInspecao) FROM qualidade_fvs f WHERE f.projectId = p.id) AS primeira_fvs,                                                      -- C14 (meses de registro)
       (SELECT TIMESTAMPDIFF(MONTH, MIN(f.dataInspecao), @hoje) FROM qualidade_fvs f WHERE f.projectId = p.id) AS meses_de_registro,
       (SELECT COUNT(*) FROM qualidade_fvm m WHERE m.projectId = p.id) AS fvm,
       (SELECT COUNT(DISTINCT LOWER(TRIM(m.materialNome))) FROM qualidade_fvm m WHERE m.projectId = p.id AND COALESCE(m.resultado, '') <> '') AS materiais_com_registro, -- C7
       (SELECT COUNT(DISTINCT LOWER(TRIM(m.materialNome))) FROM qualidade_fvm m WHERE m.projectId = p.id AND COALESCE(m.lote, '') <> '' AND COALESCE(m.responsavelRecebimento, '') <> '') AS materiais_com_lote_e_resp,
       (SELECT COUNT(*) FROM qualidade_nc n WHERE n.projectId = p.id AND n.status <> 'Fechada') AS nc_abertas,
       (SELECT COUNT(*) FROM qualidade_nc n WHERE n.projectId = p.id AND n.status <> 'Fechada' AND n.prazoAcao IS NOT NULL AND n.prazoAcao < @hoje) AS nc_vencidas, -- C8
       (SELECT COUNT(DISTINCT t.servicoSiacId) FROM qualidade_treinamentos t WHERE t.projectId = p.id) AS servicos_com_treinamento,                     -- C11
       (SELECT COUNT(*) FROM obra_cronograma_etapas e WHERE e.projectId = p.id AND e.servicoSiacId IS NOT NULL) AS etapas_servico_controlado,
       (SELECT COUNT(*) FROM obra_cronograma_etapas e WHERE e.projectId = p.id AND e.servicoSiacId IS NOT NULL AND e.status = 'Em andamento') AS etapas_controladas_em_andamento, -- C13 (observáveis = em execução)
       (SELECT COUNT(*) FROM obra_cronograma_etapas e WHERE e.projectId = p.id AND e.qualidadeBloqueada = 1) AS etapas_bloqueadas                     -- C12
  FROM projects p
 WHERE p.deletedAt IS NULL
   AND (EXISTS (SELECT 1 FROM qualidade_pqo q WHERE q.projectId = p.id)
     OR EXISTS (SELECT 1 FROM qualidade_fvs f WHERE f.projectId = p.id)
     OR EXISTS (SELECT 1 FROM qualidade_fvm m WHERE m.projectId = p.id)
     OR EXISTS (SELECT 1 FROM qualidade_nc n WHERE n.projectId = p.id)
     OR EXISTS (SELECT 1 FROM obra_cronograma_etapas e WHERE e.projectId = p.id AND e.servicoSiacId IS NOT NULL))
 ORDER BY p.id;

-- ─── 3. PES vigentes por serviço (C4): id SiAC, versão, PDF anexado? ──────────────────────
SELECT servicoSiacId, servicoNome, versao, status,
       IF(COALESCE(arquivoPdf, '') <> '', 'sim', 'nao') AS pdf_anexado,
       responsavelElaboracao, dataElaboracao
  FROM qualidade_pes
 ORDER BY servicoSiacId, status, id;

-- ─── 4. Materiais já digitados na FVM (nomes distintos) — insumo para casar com a biblioteca da E2 ─
SELECT LOWER(TRIM(materialNome)) AS material_normalizado, COUNT(*) AS fvms, MIN(materialNome) AS exemplo_grafia
  FROM qualidade_fvm
 GROUP BY LOWER(TRIM(materialNome))
 ORDER BY fvms DESC, material_normalizado;

-- ─── 5. Materiais declarados no PQO (texto JSON cru) — para a mesma conferência de nomes ────
SELECT projectId, versao, status, materiaisControlados
  FROM qualidade_pqo
 ORDER BY projectId;

-- ─── 6. Auditorias internas: checklist gravado tem 9.1.x? (quantos itens o JSON carrega) ───
SELECT id, projectId, dataAuditoria, status, resultado, totalItens, itensConformes,
       IF(checklistSiac LIKE '%"9.1%', 'sim', 'nao') AS tem_9_1,
       CHAR_LENGTH(checklistSiac) - CHAR_LENGTH(REPLACE(checklistSiac, '"clausula"', '')) AS itens_no_json_x9   -- dividir por 9 (tamanho de "clausula")
  FROM qualidade_auditorias
 ORDER BY dataAuditoria DESC;

-- ─── 7. Política: versões gravadas (vigente única? versões numéricas? — fix do NaN) ────────
SELECT id, versao, status, aprovadoPor, dataAprovacao,
       IF(versao REGEXP '^[0-9]+(\\.[0-9]+)?$', 'numerica', 'NAO numerica -> NaN no front') AS formato_versao
  FROM qualidade_politica
 ORDER BY id;
