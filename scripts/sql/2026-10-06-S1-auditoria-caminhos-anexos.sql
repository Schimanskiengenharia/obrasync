-- S1 — Auditoria (SOMENTE LEITURA) dos caminhos de anexo gravados no banco.
-- Objetivo: saber, ANTES do deploy, quantos arquivos ficariam FORA da base após o
-- confinamento dos downloads ao upload_dir (api/index.php: arquivo_confinado()).
--
-- Como rodar no servidor (nada é alterado; são só SELECTs):
--   mysql -u financeiro_app -p -h 127.0.0.1 financeiro < scripts/sql/2026-10-06-S1-auditoria-caminhos-anexos.sql
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

SET @base = '/var/lib/financeiro/uploads';

-- ─── 1. Detalhe: uma linha por caminho que NÃO está "ok" ───────────────────────
SELECT tabela, id, coluna, caminho, situacao
FROM (
    SELECT 'qualidade_pes' AS tabela, id, 'arquivoPdf' AS coluna, arquivoPdf AS caminho,
           CASE
             WHEN arquivoPdf IS NULL OR arquivoPdf = '' THEN 'vazio'
             WHEN arquivoPdf LIKE '%\\\\%' THEN 'barra_windows'
             WHEN arquivoPdf LIKE '%/../%' THEN 'traversal'
             WHEN arquivoPdf NOT LIKE '/%' THEN 'relativo'
             WHEN arquivoPdf NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
             ELSE 'ok' END AS situacao
      FROM qualidade_pes
    UNION ALL
    SELECT 'sales_contracts', id, 'proposta_assinada_path', proposta_assinada_path,
           CASE
             WHEN proposta_assinada_path IS NULL OR proposta_assinada_path = '' THEN 'vazio'
             WHEN proposta_assinada_path LIKE '%\\\\%' THEN 'barra_windows'
             WHEN proposta_assinada_path LIKE '%/../%' THEN 'traversal'
             WHEN proposta_assinada_path NOT LIKE '/%' THEN 'relativo'
             WHEN proposta_assinada_path NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
             ELSE 'ok' END
      FROM sales_contracts
    UNION ALL
    SELECT 'sales_contracts', id, 'contrato_gerado_path', contrato_gerado_path,
           CASE
             WHEN contrato_gerado_path IS NULL OR contrato_gerado_path = '' THEN 'vazio'
             WHEN contrato_gerado_path LIKE '%\\\\%' THEN 'barra_windows'
             WHEN contrato_gerado_path LIKE '%/../%' THEN 'traversal'
             WHEN contrato_gerado_path NOT LIKE '/%' THEN 'relativo'
             WHEN contrato_gerado_path NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
             ELSE 'ok' END
      FROM sales_contracts
    UNION ALL
    SELECT 'sales_contracts', id, 'contrato_assinado_path', contrato_assinado_path,
           CASE
             WHEN contrato_assinado_path IS NULL OR contrato_assinado_path = '' THEN 'vazio'
             WHEN contrato_assinado_path LIKE '%\\\\%' THEN 'barra_windows'
             WHEN contrato_assinado_path LIKE '%/../%' THEN 'traversal'
             WHEN contrato_assinado_path NOT LIKE '/%' THEN 'relativo'
             WHEN contrato_assinado_path NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
             ELSE 'ok' END
      FROM sales_contracts
    UNION ALL
    SELECT 'obra_rdo_fotos', id, 'caminho', caminho,
           CASE
             WHEN caminho IS NULL OR caminho = '' THEN 'vazio'
             WHEN caminho LIKE '%\\\\%' THEN 'barra_windows'
             WHEN caminho LIKE '%/../%' THEN 'traversal'
             WHEN caminho NOT LIKE '/%' THEN 'relativo'
             WHEN caminho NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
             ELSE 'ok' END
      FROM obra_rdo_fotos
    UNION ALL
    SELECT 'rh_documentos', id, 'arquivo_path', arquivo_path,
           CASE
             WHEN arquivo_path IS NULL OR arquivo_path = '' THEN 'vazio'
             WHEN arquivo_path LIKE '%\\\\%' THEN 'barra_windows'
             WHEN arquivo_path LIKE '%/../%' THEN 'traversal'
             WHEN arquivo_path NOT LIKE '/%' THEN 'relativo'
             WHEN arquivo_path NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
             ELSE 'ok' END
      FROM rh_documentos
    UNION ALL
    SELECT 'fiscal_documents', id, 'pdfPath', pdfPath,
           CASE
             WHEN pdfPath IS NULL OR pdfPath = '' THEN 'vazio'
             WHEN pdfPath LIKE '%\\\\%' THEN 'barra_windows'
             WHEN pdfPath LIKE '%/../%' THEN 'traversal'
             WHEN pdfPath NOT LIKE '/%' THEN 'relativo'
             WHEN pdfPath NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
             ELSE 'ok' END
      FROM fiscal_documents
    UNION ALL
    SELECT 'fiscal_documents', id, 'xmlPath', xmlPath,
           CASE
             WHEN xmlPath IS NULL OR xmlPath = '' THEN 'vazio'
             WHEN xmlPath LIKE '%\\\\%' THEN 'barra_windows'
             WHEN xmlPath LIKE '%/../%' THEN 'traversal'
             WHEN xmlPath NOT LIKE '/%' THEN 'relativo'
             WHEN xmlPath NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
             ELSE 'ok' END
      FROM fiscal_documents
    UNION ALL
    SELECT 'viabilidade_anexos', id, 'caminho', caminho,
           CASE
             WHEN caminho IS NULL OR caminho = '' THEN 'vazio'
             WHEN caminho LIKE '%\\\\%' THEN 'barra_windows'
             WHEN caminho LIKE '%/../%' THEN 'traversal'
             WHEN caminho NOT LIKE '/%' THEN 'relativo'
             WHEN caminho NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
             ELSE 'ok' END
      FROM viabilidade_anexos
    UNION ALL
    -- Cotações já eram confinadas a @base/cotacoes; entra só para completar o quadro.
    SELECT 'cotacao_fornecedor', id, 'arquivo_original', arquivo_original,
           CASE
             WHEN arquivo_original IS NULL OR arquivo_original = '' THEN 'vazio'
             WHEN arquivo_original LIKE '%\\\\%' THEN 'barra_windows'
             WHEN arquivo_original LIKE '%/../%' THEN 'traversal'
             WHEN arquivo_original NOT LIKE '/%' THEN 'relativo'
             WHEN arquivo_original NOT LIKE CONCAT(@base, '/cotacoes/%') THEN 'fora_da_base'
             ELSE 'ok' END
      FROM cotacao_fornecedor
) t
WHERE situacao NOT IN ('ok', 'vazio')
ORDER BY tabela, coluna, id;

-- ─── 2. Resumo: contagem por tabela/coluna/situação ────────────────────────────
SELECT tabela, coluna, situacao, COUNT(*) AS qtd
FROM (
    SELECT 'qualidade_pes' AS tabela, 'arquivoPdf' AS coluna,
           CASE WHEN arquivoPdf IS NULL OR arquivoPdf = '' THEN 'vazio'
                WHEN arquivoPdf LIKE '%\\\\%' THEN 'barra_windows'
                WHEN arquivoPdf LIKE '%/../%' THEN 'traversal'
                WHEN arquivoPdf NOT LIKE '/%' THEN 'relativo'
                WHEN arquivoPdf NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
                ELSE 'ok' END AS situacao
      FROM qualidade_pes
    UNION ALL
    SELECT 'sales_contracts', 'proposta_assinada_path',
           CASE WHEN proposta_assinada_path IS NULL OR proposta_assinada_path = '' THEN 'vazio'
                WHEN proposta_assinada_path LIKE '%\\\\%' THEN 'barra_windows'
                WHEN proposta_assinada_path LIKE '%/../%' THEN 'traversal'
                WHEN proposta_assinada_path NOT LIKE '/%' THEN 'relativo'
                WHEN proposta_assinada_path NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
                ELSE 'ok' END
      FROM sales_contracts
    UNION ALL
    SELECT 'sales_contracts', 'contrato_gerado_path',
           CASE WHEN contrato_gerado_path IS NULL OR contrato_gerado_path = '' THEN 'vazio'
                WHEN contrato_gerado_path LIKE '%\\\\%' THEN 'barra_windows'
                WHEN contrato_gerado_path LIKE '%/../%' THEN 'traversal'
                WHEN contrato_gerado_path NOT LIKE '/%' THEN 'relativo'
                WHEN contrato_gerado_path NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
                ELSE 'ok' END
      FROM sales_contracts
    UNION ALL
    SELECT 'sales_contracts', 'contrato_assinado_path',
           CASE WHEN contrato_assinado_path IS NULL OR contrato_assinado_path = '' THEN 'vazio'
                WHEN contrato_assinado_path LIKE '%\\\\%' THEN 'barra_windows'
                WHEN contrato_assinado_path LIKE '%/../%' THEN 'traversal'
                WHEN contrato_assinado_path NOT LIKE '/%' THEN 'relativo'
                WHEN contrato_assinado_path NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
                ELSE 'ok' END
      FROM sales_contracts
    UNION ALL
    SELECT 'obra_rdo_fotos', 'caminho',
           CASE WHEN caminho IS NULL OR caminho = '' THEN 'vazio'
                WHEN caminho LIKE '%\\\\%' THEN 'barra_windows'
                WHEN caminho LIKE '%/../%' THEN 'traversal'
                WHEN caminho NOT LIKE '/%' THEN 'relativo'
                WHEN caminho NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
                ELSE 'ok' END
      FROM obra_rdo_fotos
    UNION ALL
    SELECT 'rh_documentos', 'arquivo_path',
           CASE WHEN arquivo_path IS NULL OR arquivo_path = '' THEN 'vazio'
                WHEN arquivo_path LIKE '%\\\\%' THEN 'barra_windows'
                WHEN arquivo_path LIKE '%/../%' THEN 'traversal'
                WHEN arquivo_path NOT LIKE '/%' THEN 'relativo'
                WHEN arquivo_path NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
                ELSE 'ok' END
      FROM rh_documentos
    UNION ALL
    SELECT 'fiscal_documents', 'pdfPath',
           CASE WHEN pdfPath IS NULL OR pdfPath = '' THEN 'vazio'
                WHEN pdfPath LIKE '%\\\\%' THEN 'barra_windows'
                WHEN pdfPath LIKE '%/../%' THEN 'traversal'
                WHEN pdfPath NOT LIKE '/%' THEN 'relativo'
                WHEN pdfPath NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
                ELSE 'ok' END
      FROM fiscal_documents
    UNION ALL
    SELECT 'fiscal_documents', 'xmlPath',
           CASE WHEN xmlPath IS NULL OR xmlPath = '' THEN 'vazio'
                WHEN xmlPath LIKE '%\\\\%' THEN 'barra_windows'
                WHEN xmlPath LIKE '%/../%' THEN 'traversal'
                WHEN xmlPath NOT LIKE '/%' THEN 'relativo'
                WHEN xmlPath NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
                ELSE 'ok' END
      FROM fiscal_documents
    UNION ALL
    SELECT 'viabilidade_anexos', 'caminho',
           CASE WHEN caminho IS NULL OR caminho = '' THEN 'vazio'
                WHEN caminho LIKE '%\\\\%' THEN 'barra_windows'
                WHEN caminho LIKE '%/../%' THEN 'traversal'
                WHEN caminho NOT LIKE '/%' THEN 'relativo'
                WHEN caminho NOT LIKE CONCAT(@base, '/%') THEN 'fora_da_base'
                ELSE 'ok' END
      FROM viabilidade_anexos
    UNION ALL
    SELECT 'cotacao_fornecedor', 'arquivo_original',
           CASE WHEN arquivo_original IS NULL OR arquivo_original = '' THEN 'vazio'
                WHEN arquivo_original LIKE '%\\\\%' THEN 'barra_windows'
                WHEN arquivo_original LIKE '%/../%' THEN 'traversal'
                WHEN arquivo_original NOT LIKE '/%' THEN 'relativo'
                WHEN arquivo_original NOT LIKE CONCAT(@base, '/cotacoes/%') THEN 'fora_da_base'
                ELSE 'ok' END
      FROM cotacao_fornecedor
) t
GROUP BY tabela, coluna, situacao
ORDER BY tabela, coluna, situacao;

-- ─── 3. Pais quebrados (S5 opção 1): anexos cujo registro-pai sumiu ou obra arquivada ─
-- Esses passariam a responder 403/404 no download (antes serviam o arquivo).
SELECT 'obra_rdo_fotos sem obra_rdo' AS caso, COUNT(*) AS qtd
  FROM obra_rdo_fotos f LEFT JOIN obra_rdo r ON r.id = f.rdoId WHERE r.id IS NULL
UNION ALL
SELECT 'obra_rdo_fotos de obra arquivada', COUNT(*)
  FROM obra_rdo_fotos f JOIN obra_rdo r ON r.id = f.rdoId JOIN projects p ON p.id = r.projectId
 WHERE p.deletedAt IS NOT NULL
UNION ALL
SELECT 'fiscal_documents (com anexo) de obra arquivada', COUNT(*)
  FROM fiscal_documents d JOIN projects p ON p.id = d.projectId
 WHERE p.deletedAt IS NOT NULL AND (COALESCE(d.pdfPath, '') <> '' OR COALESCE(d.xmlPath, '') <> '')
UNION ALL
SELECT 'sales_contracts (com anexo) de obra arquivada', COUNT(*)
  FROM sales_contracts s JOIN projects p ON p.id = s.projectId
 WHERE p.deletedAt IS NOT NULL
   AND (COALESCE(s.proposta_assinada_path, '') <> '' OR COALESCE(s.contrato_gerado_path, '') <> '' OR COALESCE(s.contrato_assinado_path, '') <> '')
UNION ALL
SELECT 'viabilidade_anexos sem item/analise', COUNT(*)
  FROM viabilidade_anexos x LEFT JOIN viabilidade_itens i ON i.id = x.item_id LEFT JOIN viabilidade_analises a ON a.id = i.analise_id
 WHERE i.id IS NULL OR a.id IS NULL
UNION ALL
SELECT 'viabilidade_anexos de obra arquivada', COUNT(*)
  FROM viabilidade_anexos x JOIN viabilidade_itens i ON i.id = x.item_id JOIN viabilidade_analises a ON a.id = i.analise_id JOIN projects p ON p.id = a.obra_id
 WHERE p.deletedAt IS NOT NULL
UNION ALL
SELECT 'rh_documentos sem colaborador', COUNT(*)
  FROM rh_documentos d LEFT JOIN rh_colaboradores c ON c.id = d.colaborador_id WHERE c.id IS NULL;
