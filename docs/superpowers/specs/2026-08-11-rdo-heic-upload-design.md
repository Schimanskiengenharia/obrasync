# RDO — Upload de fotos HEIC com conversão no servidor

**Data:** 2026-08-11
**Status:** Design aprovado pelo usuário (brainstorming concluído)

## Contexto

O upload de fotos do Diário de Obra (RDO) aceita hoje JPG/JPEG, PNG e WEBP, validado em três camadas:

1. `accept="image/jpeg,image/png,image/webp"` no input (`app.js`, template do RDO);
2. `store_upload(...)` no backend exige extensão em `['jpg','jpeg','png','webp']` **e** confere o MIME real via `mime_content_type` (`handle_rdo_upload_foto`, `api/index.php`);
3. o download (`handle_rdo_foto_download`) só mapeia MIME desses formatos.

Fotos de iPhone nascem em HEIC. Quando o usuário escolhe pelo álbum do iOS, o aparelho converte sozinho para JPEG (porque o `accept` não inclui HEIC); mas um `.heic` transferido para o PC não pode ser enviado. Navegadores Chrome/Edge/Windows **não exibem HEIC** — aceitar o arquivo cru quebraria preview, tela do RDO e PDF.

## Decisões do usuário

- **Aceitar HEIC** no upload de fotos do RDO, com **conversão para JPEG no servidor** (escolha explícita sobre a alternativa de converter no navegador).
- **MP4/vídeo está FORA do escopo** — decisão explícita: "não colocar mp4, vídeo não... apenas imagens". Não aceitar vídeo em nenhuma camada.
- **Conversor: `heif-convert` via CLI** (pacote `libheif-examples`), no mesmo padrão do `pdftotext` das Cotações — sem extensão PHP nova, sem reiniciar o PHP-FPM. Sem o binário, o upload de `.heic` retorna **422 orientando a instalação**.
- Qualidade JPEG da conversão: **85**. O `.heic` original é **apagado** após conversão bem-sucedida (o registro da obra é o JPEG; não guardar os dois).

## Escopo

**Entra:** aceitar `.heic`/`.heif` no upload de fotos do RDO; converter no servidor; banco guarda o caminho do `.jpg` resultante.

**Não entra:** vídeo (MP4 etc.); conversão no cliente; preservar o `.heic` original; os demais uploads do sistema (RH, contrato, NF, logo — continuam como estão); migration (nenhuma — `obra_rdo_fotos` não muda).

## Arquitetura

### Fluxo

Usuário escolhe `.heic` → front envia o arquivo cru como hoje (uma requisição por foto, `rdo-foto-upload`) → backend detecta a extensão, valida assinatura binária, armazena, converte com `heif-convert -q 85`, apaga o `.heic` e grava no banco o caminho do `.jpg`. Daí em diante nada muda: tela, PDF individual, relatório semanal e download já servem JPEG.

### Backend (`api/index.php`)

A função compartilhada **`store_upload()` não é alterada** (outros módulos a usam). A mudança fica em `handle_rdo_upload_foto` + helpers novos:

- **Ramo HEIC** em `handle_rdo_upload_foto`: se a extensão do nome original for `heic`/`heif`:
  1. `rdo_heic_magic_ok($bytes)` — helper **puro**: confere a caixa `ftyp` (offset 4) e brand em `{heic, heix, hevc, hevx, heim, heis, hevm, hevs, mif1, msf1}` (offset 8). Motivo: `mime_content_type` com magic database antiga devolve `application/octet-stream` para HEIC legítimo e rejeitaria injustamente; a checagem própria substitui a lista de MIME.
  2. `store_upload($file, $dir, ['heic','heif'], [])` — lista de MIME **vazia** só nesse ramo (a validação de conteúdo é a assinatura + a própria conversão).
  3. `rdo_heic_para_jpeg($path)` converte e devolve o caminho `.jpg`, que vai para `obra_rdo_fotos.caminho`.
- **Ramo atual** (jpg/png/webp): chamada existente, intocada.
- **`rdo_heic_para_jpeg(string $path): string`**:
  - Localiza o binário via `rdo_heif_convert_bin()` (`command -v heif-convert`; fallback: `/usr/bin/heif-convert` e `/usr/local/bin/heif-convert`). Ausente → apaga o `.heic` armazenado e `fail(..., 422)` com a instrução: `sudo apt install libheif-examples` (padrão pdftotext/PhpSpreadsheet).
  - Executa `heif-convert -q 85 <in> <out>` com `escapeshellarg` nos dois caminhos.
  - **Multi-imagem** (burst/Live Photo): o `heif-convert` grava `nome-1.jpg`, `nome-2.jpg`... — usar o primeiro como resultado e apagar os extras. A resolução do nome final é helper puro (testável sem binário).
  - Falha de conversão (HEIC falso/corrompido, exit code ≠ 0 ou saída vazia) → apaga `.heic` e qualquer resto, `fail(..., 400)` "Arquivo HEIC inválido ou corrompido." Nada entra no banco.
  - Sucesso → apaga o `.heic`, `chmod 0640` no `.jpg`, retorna o caminho.
- Orientação EXIF: o libheif aplica as transformações (`irot`/`imir`) na decodificação — o JPEG sai na orientação correta, sem tratamento extra.

### Frontend (`app.js` + `styles.css`)

- `accept` do input vira `image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif` (extensões inclusas porque o Windows frequentemente não registra o MIME de HEIC).
- **Preview de pendentes**: Chrome/Edge não renderizam HEIC em `<img>`. Para arquivo com extensão `.heic`/`.heif`, a figura mostra um quadro "Prévia indisponível — será convertida para JPEG no envio" com o nome do arquivo (classe CSS nova no molde de `.rdo-foto-pendente`); campo de legenda e botão Remover funcionam igual.
- Consequência esperada: com HEIC no `accept`, o iOS **para** de converter sozinho e envia o HEIC original — correto, o servidor converte.
- Cache busting: incrementar `?v=` em `index.html` e `APP_VERSION` em `app.js`.

### O que não muda

Banco (`obra_rdo_fotos` — **sem migration**), `handle_rdo_foto_download`, `handle_rdo_delete_foto`, PDF individual (`rdoDiaCorpoHtml`), relatório semanal, fluxo de envio foto a foto (falha individual não derruba o lote — o `.heic` que falhar permanece na fila com a legenda preservada, comportamento já existente).

## Tratamento de erros

| Situação | Resposta | Efeito |
|---|---|---|
| `heif-convert` ausente no servidor | 422 com instrução de instalação | `.heic` armazenado é removido; foto fica na fila do front |
| HEIC falso/corrompido (assinatura ou conversão falha) | 400 "Arquivo HEIC inválido ou corrompido." | arquivos removidos; nada no banco |
| Extensão fora da lista (ex.: `.mp4`) | 400 (comportamento atual do `store_upload`) | rejeitado |
| JPG/PNG/WEBP | fluxo atual intocado | — |

## Testes

- **`scripts/tests/php/test_rdo_heic.php`** (novo, entra no `run-all.sh`): helpers puros — assinatura binária com fixtures de bytes (HEIC válido por brand, `mif1`, arquivo aleatório, arquivo curto), montagem do comando com `escapeshellarg`, resolução do nome multi-imagem (`nome.jpg` vs `nome-1.jpg` + extras).
- `php -l api/index.php` e `node --check app.js` após cada edição.
- **Validação final no servidor** (local não tem banco): upload de HEIC real de iPhone, conferir foto na tela, no PDF e no relatório semanal; testar também o 422 antes do `apt install`.

## Deploy

1. **Antes de testar HEIC**: `sudo apt install libheif-examples` no servidor (comando manual via SSH — não passa pelo `deploy.php`, **não** precisa de regra nova no sudoers).
2. Push → webhook → pull normal. **Sem migration.**
3. Hard refresh (Ctrl+Shift+R) para o novo `?v=`.

Sem o passo 1, fotos JPG/PNG/WEBP continuam funcionando; só o `.heic` retorna o 422 orientando.

---

## Adendo 2026-08-11 — prévia real no navegador (aprovado após a v1.45.0)

Pedido do usuário: ver a **imagem de verdade** na fila de pendentes (junto do campo de legenda),
no lugar do quadro "Prévia indisponível".

**Histórico da decisão:** a opção A original (decodificar no navegador com `heic2any`) foi
aprovada e depois **bloqueada na verificação técnica**: a lib usa `new Function(...)` (cola
Emscripten/embind) e o CSP do sistema (`script-src 'self'`, endurecido na v1.12) bloqueia —
a prévia falharia sempre em produção. Afrouxar com `'unsafe-eval'` foi rejeitado (enfraquece a
proteção anti-XSS global); decodificador WASM + `'wasm-unsafe-eval'` foi oferecido e recusado.
**Decisão final do usuário: PRÉVIA PELO SERVIDOR.**

- **Endpoint novo `POST rdo-foto-previa`** (auth + `authorize_request('rdo','edit')`, molde do
  `rdo-foto-upload`): recebe o HEIC, valida assinatura (`rdo_heic_magic_ok`), converte com os
  MESMOS helpers da v1.45.0 (`rdo_heif_convert_bin`/`rdo_heif_convert_cmd`/
  `rdo_heic_jpg_candidatos`) em arquivo temporário do sistema e **devolve o JPEG no corpo da
  resposta SEM gravar nada** (nem uploads/, nem banco); temporários apagados sempre.
  Binário ausente → 422 (mesma mensagem); HEIC inválido → 400.
- **Front**: estado novo `previa` na fila `rdoFotosPendentes` — `"ok"` (mostra `<img>`),
  `"gerando"` (quadro "Gerando prévia..."), `"falhou"` (quadro "Prévia indisponível" — envio
  segue normal). `rdoGerarPreviaHeic(p)` faz `fetch` autenticado do endpoint (molde de
  `rdoCarregarFoto`), troca `p.url` pela objectURL do JPEG (revogando a antiga) e re-renderiza;
  foto removida da fila durante a geração → objectURL revogada, nada renderizado.
- Falha de rede/conversão **degrada** para o quadro atual — nunca bloqueia o envio.
- Custo aceito: a foto HEIC trafega 2× (prévia + envio real); prévia leva ~2-4 s.
- O envio real NÃO muda (v1.45.0 intocada); CSP intocado; sem biblioteca vendorizada; sem
  migration. Release v1.45.1, cache `?v=1816`.
