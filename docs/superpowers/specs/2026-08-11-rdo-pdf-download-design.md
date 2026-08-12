# RDO — "Gerar PDF" baixa arquivo real (dompdf no servidor)

**Data:** 2026-08-11
**Status:** Design aprovado pelo usuário (opção dompdf escolhida entre 3 apresentadas)

## Contexto e decisão

O botão "Gerar PDF" do RDO abria a tela de impressão do navegador (`window.print()`), exigindo
"Salvar como PDF" manual. Pedido do usuário: comportamento de **download de arquivo** (barra de
downloads do navegador), como qualquer download da internet. Bug correlato (fotos em branco na
impressão) já corrigido na v1.45.2 (corrida do print — `aguardarImagensDoc`).

**Decisão:** o servidor gera o PDF real com **dompdf** (composer, precedente PhpSpreadsheet) e
devolve `application/pdf` com `Content-Disposition: attachment`. Rejeitados: wkhtmltopdf
(instalação ~200 MB) e manter só a impressão (não atende o pedido).

## Escopo

**Entra:** endpoint `GET rdo-pdf?id=` (auth `rdo/view`); documento reconstruído em PHP com os
mesmos blocos do PDF atual (cabeçalho da empresa com logo, nº/condição/clima, efetivo,
equipamentos, textos, disciplinas, registro fotográfico com legendas, blocos de assinatura com
CPF); fotos e logo embutidas como data URI lidas do disco; front baixa via fetch autenticado
(molde `exportSinapiExcel`) e o botão deixa de abrir a impressão.

**Não entra:** relatório semanal (continua na impressão, agora com fotos corrigidas), demais
documentos (contrato/pedido/proposta), migration (nenhuma).

## Desenho

- **`rdo_get_dados(PDO,$id): array`** — extraído de `handle_rdo_get` (que passa a só responder
  JSON); reusado pelo PDF. Fotos no JSON seguem só `id/legenda` (caminho não vaza); o handler
  do PDF busca `caminho` à parte.
- **Helpers puros testáveis** (suíte): `rdo_pdf_esc` (htmlspecialchars), `rdo_pdf_cpf_fmt`
  (máscara 000.000.000-00, espelho do front), `rdo_pdf_data_br` (data/timestamp pela STRING,
  regra M10), **`rdo_pdf_documento_html($rdo,$empresa,$obraNome,$fotos,$logoDataUri)`** —
  monta o HTML completo do documento (CSS inline, fonte DejaVu Sans p/ acentos no dompdf).
- **`handle_rdo_pdf_download`**: dados → loader composer (`vendor/autoload.php` nos 2 caminhos)
  → sem `Dompdf\Dompdf` = **422** "Gerar PDF requer a biblioteca dompdf (composer require
  dompdf/dompdf)" → logo (png/jpg do `company_logo_dir`; svg fica de fora — dompdf não executa
  o formato com segurança/fidelidade) e fotos (jpg/png; webp convertida via GD quando
  disponível, senão embutida como está) → `render()` A4 → attachment `RDO-<nº>-<data>.pdf`.
  `memory_limit 1024M`/`set_time_limit 120` (precedente SINAPI).
- **Front**: `rdoGerarPdf` vira download autenticado (fetch → blob → `<a download>`); erro vira
  toast com severidade error (regra v1.40.0); o caminho de impressão do RDO individual morre,
  mas `aguardarImagensDoc`/`printStandaloneDocument` PERMANECEM (semanal e demais docs).
- Release **v1.46.0**, cache `?v=1818`. Deploy: `cd /var/www/financeiro && composer require
  dompdf/dompdf` (um comando, manual).
