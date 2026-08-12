# RDO PDF por download (dompdf, v1.46.0) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Gerar PDF" do RDO baixa um arquivo `.pdf` real gerado no servidor (dompdf), com todos os blocos do documento e as fotos embutidas.

**Architecture:** ver spec `docs/superpowers/specs/2026-08-11-rdo-pdf-download-design.md`. Refactor `rdo_get_dados` compartilhado; builder HTML puro testado na suíte; handler embute logo/fotos como data URI; front baixa via fetch autenticado (molde `exportSinapiExcel`).

**Tech Stack:** PHP 8 + dompdf (composer), JS puro, suíte `scripts/tests/run-all.sh`.

## Global Constraints

- Sem migration; semanal e demais documentos CONTINUAM na impressão (v1.45.2); `aguardarImagensDoc` fica.
- Sem dompdf no servidor → 422: `Gerar PDF requer a biblioteca dompdf (composer require dompdf/dompdf). Veja CLAUDE.md.`
- Fotos no JSON do `rdo-get` seguem só `id`/`legenda` (caminho de disco não vaza).
- Nada de `.catch` vazio no front (guarda `test_privacy_coverage`); erro de download vira `showToast(..., {severity:"error"})`.
- Release v1.46.0 · 2026-08-11; cache `?v=1818`; suíte verde antes de cada commit; push autorizado ao final.

---

### Task 1: Refactor `rdo_get_dados` + helpers puros + builder do documento (TDD)

**Files:**
- Test (create): `scripts/tests/php/test_rdo_pdf_html.php`
- Modify: `api/index.php` — `handle_rdo_get` vira wrapper de `rdo_get_dados`; helpers/builder novos antes de `handle_rdo_upload_foto`

**Interfaces:**
- Produces: `rdo_get_dados(PDO $pdo, int $id): array`; `rdo_pdf_esc($v): string`; `rdo_pdf_cpf_fmt($cpf): string`; `rdo_pdf_data_br($v): string`; `rdo_pdf_documento_html(array $rdo, array $empresa, string $obraNome, array $fotos, ?string $logoDataUri): string` (fotos = `[['src'=>dataUri,'legenda'=>...]]`).

- [ ] Escrever `test_rdo_pdf_html.php` (harness da suíte): CPF (4 casos: máscara/vazio/curto/já-com-pontos), data BR (data pura, timestamp, lixo), esc; builder com RDO fixture → contém título, Nº, obra ESCAPADA (`<b>` vira `&lt;b&gt;`), atividades com `<br>`, `<img` com `data:image/jpeg` + legenda escapada, bloco de assinatura com CPF mascarado e `pendente` sem assinadoEm, logo presente/ausente conforme `$logoDataUri`. Rodar suíte → bloco novo FALHA (undefined function).
- [ ] Implementar: extrair o corpo de `handle_rdo_get` (linhas ~9489-9518) para `rdo_get_dados` (mesmas queries; `handle_rdo_get` responde `respond(['ok'=>true,'data'=>rdo_get_dados($pdo,$id)])`); helpers `rdo_pdf_esc`/`rdo_pdf_cpf_fmt`/`rdo_pdf_data_br` (espelhos dos helpers do front, datas pela STRING — M10); `rdo_pdf_documento_html` com CSS inline (DejaVu Sans; tabelas; figures `page-break-inside: avoid`, img `max-height:200pt`; blocos de assinatura Geral + disciplinas `atuouNoDia=1` com responsável — mesma regra de `rdoAssinaturasBlocosHtml` do front).
- [ ] `php -l` + suíte verde → commit `feat: builder puro do documento PDF do RDO + rdo_get_dados compartilhado, com teste proprio`.

---

### Task 2: Endpoint `rdo-pdf` (dompdf)

**Files:**
- Modify: `api/index.php` — rota após `rdo-foto` (GET) + `handle_rdo_pdf_download(PDO,$config,int $id)` após o builder

**Interfaces:**
- Consumes: Task 1 + `company_logo_dir($config)`, loader composer (`['/vendor/autoload.php','/../vendor/autoload.php']`), `fail`.
- Produces: `GET rdo-pdf?id=` → `application/pdf` attachment `RDO-<nº>-<data>.pdf`.

- [ ] Rota (auth `rdo`,`view`, molde do `rdo-foto`); handler: `rdo_get_dados` → loader composer → `class_exists('Dompdf\\Dompdf')` senão 422 → `memory_limit 1024M`/`set_time_limit(120)` → nome da obra (`projects.name`) e `company_settings` (try/catch, molde do export SINAPI) → logo png/jpg do disco como data URI (svg fora) → fotos (`SELECT caminho, legenda ... ORDER BY id`; jpg/png direto; webp via GD `imagecreatefromwebp`→jpeg quando disponível, senão embute como está; arquivo sumido = pulada) → `new Dompdf(['isRemoteEnabled'=>false])`, `loadHtml(...,'UTF-8')`, `setPaper('A4')`, `render()` → headers attachment + `echo` + `exit`.
- [ ] `php -l` + suíte verde → commit `feat: endpoint rdo-pdf - gera o PDF real do RDO no servidor com dompdf (422 orientando composer require)`.

---

### Task 3: Front baixa o arquivo + release v1.46.0

**Files:**
- Modify: `app.js` — `rdoGerarPdf` vira download (molde `exportSinapiExcel`: fetch autenticado → blob → `<a download>`; erro → `showToast` severity error; sucesso → toast); versão/changelog; `index.html` `?v=1818`; `CLAUDE.md`/`README.md` (bloco v1.46.0 + linhas de versão).

- [ ] Reescrever `rdoGerarPdf` (mantém o `rdo-get` para compor o nome `RDO-<nº>-<obra>-<data>.pdf` sanitizado); NÃO tocar em `printStandaloneDocument`/`aguardarImagensDoc`/semanal.
- [ ] Versões (v1.46.0, `?v=1818`, changelog em linguagem de usuário) + CLAUDE.md/README.
- [ ] `node --check` + suíte verde → commit `feat: Gerar PDF do RDO baixa arquivo real (v1.46.0)` → **push**.

---

## Validação em produção (após o push)

1. No servidor: `cd /var/www/financeiro && composer require dompdf/dompdf`.
2. Ctrl+Shift+R; conferir v1.46.0.
3. **Antes do composer require** (opcional): Gerar PDF → toast de erro citando o composer require (caminho 422).
4. Gerar PDF num RDO com fotos → arquivo `RDO-N-....pdf` aparece na barra de downloads; abrir: cabeçalho da empresa (logo se png/jpg), todos os blocos e TODAS as fotos com legenda.
5. Relatório semanal → continua abrindo a impressão, com fotos (fix v1.45.2).
6. RDO sem foto e RDO com foto webp → PDF sai sem erro.
