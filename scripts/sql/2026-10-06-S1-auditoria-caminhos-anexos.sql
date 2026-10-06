-- S1 — Auditoria (SOMENTE LEITURA) dos caminhos de anexo gravados no banco.
-- Objetivo: saber, ANTES do deploy, quantos arquivos ficariam FORA da base após o
-- confinamento dos downloads ao upload_dir (api/index.php: arquivo_confinado()).
--
-- Como rodar no servidor (nada é alterado; são só SELECTs):
--   mysql -u financeiro_app -p -h 127.0.0.1 financeiro < scripts/sql/2026-10-06-S1-auditoria-caminhos-anexos.sql
--
-- COLLATION MISTA (regra da sessão): as tabelas antigas são utf8mb4_unicode_ci e
-- as novas utf8mb4_uca1400_ai_ci. Todo texto que entra num UNION (coluna de
-- caminho E os literais de tabela/coluna/situação) é convertido explicitamente
-- para utf8mb4_unicode_ci; a classificação (LIKE) roda na consulta externa sobre a
-- coluna JÁ convertida, e @base também recebe a mesma collation.
--
-- Ajuste @base se o upload_dir do /etc/financeiro/config.php for outro.
-- Situações:
--   ok             → absoluto, começa com @base/ e sem "/../" nem barra do Windows
--   vazio          → coluna NULL/'' (sem anexo; o download já responde 404, nada muda)
--   fora_da_base   → absoluto, mas fora de @base (diretório antigo?) → ficaria 403
--   relativo       → não começa com "/" (dependia do cwd do PHP) → ficaria 403/404
--   traversal      → contém "/../"                                   → ficaria 403
--   barra_windows  → contém "\"                                      → ficaria 403/404
-- A regra de confinamento usa realpath() (resolve symlink): um symlink dentro de
-- @base apontando para fora também seria recusado, e isso o SQL não enxerga.

SET NAMES utf8mb4;
SET @base = _utf8mb4'/var/lib/financeiro/uploads' COLLATE utf8mb4_unicode_ci;
SET @base_cot = CONCAT(@base, _utf8mb4'/cotacoes') COLLATE utf8mb4_unicode_ci;

-- ─── 1. Detalhe: uma linha por caminho que NÃO está "ok" ───────────────────────
SELECT c.tabela, c.id, c.coluna, c.caminho, c.situacao
FROM (
SELECT tabela, id, coluna, caminho,
       CASE
         WHEN caminho IS NULL OR caminho = _utf8mb4'' COLLATE utf8mb4_unicode_ci THEN _utf8mb4'vazio' COLLATE utf8mb4_unicode_ci
         WHEN caminho LIKE _utf8mb4'%\\\\%' COLLATE utf8mb4_unicode_ci            THEN _utf8mb4'barra_windows' COLLATE utf8mb4_unicode_ci
         WHEN caminho LIKE _utf8mb4'%/../%' COLLATE utf8mb4_unicode_ci            THEN _utf8mb4'traversal' COLLATE utf8mb4_unicode_ci
         WHEN caminho NOT LIKE _utf8mb4'/%' COLLATE utf8mb4_unicode_ci            THEN _utf8mb4'relativo' COLLATE utf8mb4_unicode_ci
         WHEN caminho NOT LIKE CONCAT(base_esperada, _utf8mb4'/%') COLLATE utf8mb4_unicode_ci THEN _utf8mb4'fora_da_base' COLLATE utf8mb4_unicode_ci
         ELSE _utf8mb4'ok' COLLATE utf8mb4_unicode_ci
       END AS situacao
FROM (
    SELECT _utf8mb4'qualidade_pes' COLLATE utf8mb4_unicode_ci AS tabela, id,
           _utf8mb4'arquivoPdf' COLLATE utf8mb4_unicode_ci AS coluna,
           CONVERT(arquivoPdf USING utf8mb4) COLLATE utf8mb4_unicode_ci AS caminho,
           CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci AS base_esperada
      FROM qualidade_pes
    UNION ALL
    SELECT _utf8mb4'sales_contracts' COLLATE utf8mb4_unicode_ci, id,
           _utf8mb4'proposta_assinada_path' COLLATE utf8mb4_unicode_ci,
           CONVERT(proposta_assinada_path USING utf8mb4) COLLATE utf8mb4_unicode_ci,
           CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
      FROM sales_contracts
    UNION ALL
    SELECT _utf8mb4'sales_contracts' COLLATE utf8mb4_unicode_ci, id,
           _utf8mb4'contrato_gerado_path' COLLATE utf8mb4_unicode_ci,
           CONVERT(contrato_gerado_path USING utf8mb4) COLLATE utf8mb4_unicode_ci,
           CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
      FROM sales_contracts
    UNION ALL
    SELECT _utf8mb4'sales_contracts' COLLATE utf8mb4_unicode_ci, id,
           _utf8mb4'contrato_assinado_path' COLLATE utf8mb4_unicode_ci,
           CONVERT(contrato_assinado_path USING utf8mb4) COLLATE utf8mb4_unicode_ci,
           CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
      FROM sales_contracts
    UNION ALL
    SELECT _utf8mb4'obra_rdo_fotos' COLLATE utf8mb4_unicode_ci, id,
           _utf8mb4'caminho' COLLATE utf8mb4_unicode_ci,
           CONVERT(caminho USING utf8mb4) COLLATE utf8mb4_unicode_ci,
           CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
      FROM obra_rdo_fotos
    UNION ALL
    SELECT _utf8mb4'rh_documentos' COLLATE utf8mb4_unicode_ci, id,
           _utf8mb4'arquivo_path' COLLATE utf8mb4_unicode_ci,
           CONVERT(arquivo_path USING utf8mb4) COLLATE utf8mb4_unicode_ci,
           CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
      FROM rh_documentos
    UNION ALL
    SELECT _utf8mb4'fiscal_documents' COLLATE utf8mb4_unicode_ci, id,
           _utf8mb4'pdfPath' COLLATE utf8mb4_unicode_ci,
           CONVERT(pdfPath USING utf8mb4) COLLATE utf8mb4_unicode_ci,
           CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
      FROM fiscal_documents
    UNION ALL
    SELECT _utf8mb4'fiscal_documents' COLLATE utf8mb4_unicode_ci, id,
           _utf8mb4'xmlPath' COLLATE utf8mb4_unicode_ci,
           CONVERT(xmlPath USING utf8mb4) COLLATE utf8mb4_unicode_ci,
           CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
      FROM fiscal_documents
    UNION ALL
    SELECT _utf8mb4'viabilidade_anexos' COLLATE utf8mb4_unicode_ci, id,
           _utf8mb4'caminho' COLLATE utf8mb4_unicode_ci,
           CONVERT(caminho USING utf8mb4) COLLATE utf8mb4_unicode_ci,
           CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
      FROM viabilidade_anexos
    UNION ALL
    -- Cotações já eram confinadas a @base/cotacoes; entra só para completar o quadro.
    SELECT _utf8mb4'cotacao_fornecedor' COLLATE utf8mb4_unicode_ci, id,
           _utf8mb4'arquivo_original' COLLATE utf8mb4_unicode_ci,
           CONVERT(arquivo_original USING utf8mb4) COLLATE utf8mb4_unicode_ci,
           CONVERT(@base_cot USING utf8mb4) COLLATE utf8mb4_unicode_ci
      FROM cotacao_fornecedor
) t
) c
WHERE c.situacao NOT IN (_utf8mb4'ok' COLLATE utf8mb4_unicode_ci, _utf8mb4'vazio' COLLATE utf8mb4_unicode_ci)
ORDER BY c.tabela, c.coluna, c.id;

-- ─── 2. Resumo: contagem por tabela/coluna/situação ────────────────────────────
SELECT tabela, coluna, situacao, COUNT(*) AS qtd
FROM (
    SELECT tabela, coluna,
           CASE
             WHEN caminho IS NULL OR caminho = _utf8mb4'' COLLATE utf8mb4_unicode_ci THEN _utf8mb4'vazio' COLLATE utf8mb4_unicode_ci
             WHEN caminho LIKE _utf8mb4'%\\\\%' COLLATE utf8mb4_unicode_ci            THEN _utf8mb4'barra_windows' COLLATE utf8mb4_unicode_ci
             WHEN caminho LIKE _utf8mb4'%/../%' COLLATE utf8mb4_unicode_ci            THEN _utf8mb4'traversal' COLLATE utf8mb4_unicode_ci
             WHEN caminho NOT LIKE _utf8mb4'/%' COLLATE utf8mb4_unicode_ci            THEN _utf8mb4'relativo' COLLATE utf8mb4_unicode_ci
             WHEN caminho NOT LIKE CONCAT(base_esperada, _utf8mb4'/%') COLLATE utf8mb4_unicode_ci THEN _utf8mb4'fora_da_base' COLLATE utf8mb4_unicode_ci
             ELSE _utf8mb4'ok' COLLATE utf8mb4_unicode_ci
           END AS situacao
    FROM (
        SELECT _utf8mb4'qualidade_pes' COLLATE utf8mb4_unicode_ci AS tabela,
               _utf8mb4'arquivoPdf' COLLATE utf8mb4_unicode_ci AS coluna,
               CONVERT(arquivoPdf USING utf8mb4) COLLATE utf8mb4_unicode_ci AS caminho,
               CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci AS base_esperada
          FROM qualidade_pes
        UNION ALL
        SELECT _utf8mb4'sales_contracts' COLLATE utf8mb4_unicode_ci,
               _utf8mb4'proposta_assinada_path' COLLATE utf8mb4_unicode_ci,
               CONVERT(proposta_assinada_path USING utf8mb4) COLLATE utf8mb4_unicode_ci,
               CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM sales_contracts
        UNION ALL
        SELECT _utf8mb4'sales_contracts' COLLATE utf8mb4_unicode_ci,
               _utf8mb4'contrato_gerado_path' COLLATE utf8mb4_unicode_ci,
               CONVERT(contrato_gerado_path USING utf8mb4) COLLATE utf8mb4_unicode_ci,
               CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM sales_contracts
        UNION ALL
        SELECT _utf8mb4'sales_contracts' COLLATE utf8mb4_unicode_ci,
               _utf8mb4'contrato_assinado_path' COLLATE utf8mb4_unicode_ci,
               CONVERT(contrato_assinado_path USING utf8mb4) COLLATE utf8mb4_unicode_ci,
               CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM sales_contracts
        UNION ALL
        SELECT _utf8mb4'obra_rdo_fotos' COLLATE utf8mb4_unicode_ci,
               _utf8mb4'caminho' COLLATE utf8mb4_unicode_ci,
               CONVERT(caminho USING utf8mb4) COLLATE utf8mb4_unicode_ci,
               CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM obra_rdo_fotos
        UNION ALL
        SELECT _utf8mb4'rh_documentos' COLLATE utf8mb4_unicode_ci,
               _utf8mb4'arquivo_path' COLLATE utf8mb4_unicode_ci,
               CONVERT(arquivo_path USING utf8mb4) COLLATE utf8mb4_unicode_ci,
               CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM rh_documentos
        UNION ALL
        SELECT _utf8mb4'fiscal_documents' COLLATE utf8mb4_unicode_ci,
               _utf8mb4'pdfPath' COLLATE utf8mb4_unicode_ci,
               CONVERT(pdfPath USING utf8mb4) COLLATE utf8mb4_unicode_ci,
               CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM fiscal_documents
        UNION ALL
        SELECT _utf8mb4'fiscal_documents' COLLATE utf8mb4_unicode_ci,
               _utf8mb4'xmlPath' COLLATE utf8mb4_unicode_ci,
               CONVERT(xmlPath USING utf8mb4) COLLATE utf8mb4_unicode_ci,
               CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM fiscal_documents
        UNION ALL
        SELECT _utf8mb4'viabilidade_anexos' COLLATE utf8mb4_unicode_ci,
               _utf8mb4'caminho' COLLATE utf8mb4_unicode_ci,
               CONVERT(caminho USING utf8mb4) COLLATE utf8mb4_unicode_ci,
               CONVERT(@base USING utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM viabilidade_anexos
        UNION ALL
        SELECT _utf8mb4'cotacao_fornecedor' COLLATE utf8mb4_unicode_ci,
               _utf8mb4'arquivo_original' COLLATE utf8mb4_unicode_ci,
               CONVERT(arquivo_original USING utf8mb4) COLLATE utf8mb4_unicode_ci,
               CONVERT(@base_cot USING utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM cotacao_fornecedor
    ) u
) t
GROUP BY tabela, coluna, situacao
ORDER BY tabela, coluna, situacao;

-- ─── 3. Pais quebrados (S5 opção 1): anexos cujo registro-pai sumiu ou obra arquivada ─
-- Esses passariam a responder 403/404 no download (antes serviam o arquivo).
-- Todos os JOINs são por id numérico; só os literais de "caso" entram no UNION e
-- recebem COLLATE explícito. As comparações COALESCE(col,'') <> '' são coluna ×
-- literal (não texto × texto entre colunas) e não disparam o erro 1271.
SELECT _utf8mb4'obra_rdo_fotos sem obra_rdo' COLLATE utf8mb4_unicode_ci AS caso, COUNT(*) AS qtd
  FROM obra_rdo_fotos f LEFT JOIN obra_rdo r ON r.id = f.rdoId WHERE r.id IS NULL
UNION ALL
SELECT _utf8mb4'obra_rdo_fotos de obra arquivada' COLLATE utf8mb4_unicode_ci, COUNT(*)
  FROM obra_rdo_fotos f JOIN obra_rdo r ON r.id = f.rdoId JOIN projects p ON p.id = r.projectId
 WHERE p.deletedAt IS NOT NULL
UNION ALL
SELECT _utf8mb4'fiscal_documents (com anexo) de obra arquivada' COLLATE utf8mb4_unicode_ci, COUNT(*)
  FROM fiscal_documents d JOIN projects p ON p.id = d.projectId
 WHERE p.deletedAt IS NOT NULL AND (COALESCE(d.pdfPath, '') <> '' OR COALESCE(d.xmlPath, '') <> '')
UNION ALL
SELECT _utf8mb4'sales_contracts (com anexo) de obra arquivada' COLLATE utf8mb4_unicode_ci, COUNT(*)
  FROM sales_contracts s JOIN projects p ON p.id = s.projectId
 WHERE p.deletedAt IS NOT NULL
   AND (COALESCE(s.proposta_assinada_path, '') <> '' OR COALESCE(s.contrato_gerado_path, '') <> '' OR COALESCE(s.contrato_assinado_path, '') <> '')
UNION ALL
SELECT _utf8mb4'viabilidade_anexos sem item/analise' COLLATE utf8mb4_unicode_ci, COUNT(*)
  FROM viabilidade_anexos x LEFT JOIN viabilidade_itens i ON i.id = x.item_id LEFT JOIN viabilidade_analises a ON a.id = i.analise_id
 WHERE i.id IS NULL OR a.id IS NULL
UNION ALL
SELECT _utf8mb4'viabilidade_anexos de obra arquivada' COLLATE utf8mb4_unicode_ci, COUNT(*)
  FROM viabilidade_anexos x JOIN viabilidade_itens i ON i.id = x.item_id JOIN viabilidade_analises a ON a.id = i.analise_id JOIN projects p ON p.id = a.obra_id
 WHERE p.deletedAt IS NOT NULL
UNION ALL
SELECT _utf8mb4'rh_documentos sem colaborador' COLLATE utf8mb4_unicode_ci, COUNT(*)
  FROM rh_documentos d LEFT JOIN rh_colaboradores c ON c.id = d.colaborador_id WHERE c.id IS NULL;
