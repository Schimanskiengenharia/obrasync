# RDO aceita HEIC (conversão no servidor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o upload de fotos do RDO aceita `.heic`/`.heif` (fotos de iPhone) convertendo para JPEG no servidor via `heif-convert`; tela, PDF e relatório semanal seguem servindo JPEG sem nenhuma outra mudança.

**Architecture:** ramo novo dentro de `handle_rdo_upload_foto` (a `store_upload()` compartilhada NÃO muda): assinatura binária própria valida o HEIC → `store_upload` com lista de MIME vazia → helper `rdo_heic_para_jpeg` converte via CLI (`heif-convert -q 85`), apaga o original e devolve o caminho `.jpg` que vai ao banco. Sem migration. Spec: `docs/superpowers/specs/2026-08-11-rdo-heic-upload-design.md`.

**Tech Stack:** PHP 8 (arquivo único `api/index.php`), CLI `heif-convert` (pacote `libheif-examples` no servidor), SPA sem build (`app.js`/`styles.css`/`index.html`), suíte `scripts/tests/run-all.sh`.

## Global Constraints

- **MP4/vídeo VETADO pelo dono** — não aceitar vídeo em nenhuma camada (nem `accept`, nem backend).
- `store_upload()` (api/index.php:11069) é compartilhada por outros módulos — **não alterar**.
- **Sem migration** — `obra_rdo_fotos` não muda; o banco guarda o caminho do `.jpg` convertido.
- Qualidade JPEG fixa **85**; o `.heic` original é **apagado** após o processamento (sucesso ou falha).
- Binário ausente no servidor → `fail(..., 422)` com a mensagem exata: `Conversão HEIC indisponível no servidor — instale com: sudo apt install libheif-examples`.
- **Não usar `const` do PHP para os brands** — constantes no meio do `api/index.php` ficam indefinidas em runtime (roteamento inline dá `exit` antes; lição da v1.14.0). Usar array local na função.
- Após QUALQUER edição: `php -l api/index.php` e/ou `node --check app.js`; antes de cada commit: `bash scripts/tests/run-all.sh` (hoje 21/21... a suíte imprime "N/N blocos ok" — exigir todos verdes).
- Manter **LF** nos arquivos (repo Unix; cuidado com o VS Code/Windows convertendo para CRLF).
- Commit local a cada tarefa; **`git push` só quando o usuário pedir**.
- Cache busting na tarefa de front: `?v=1815` no `index.html` + `APP_VERSION = "v1.45.0"`.

---

### Task 1: Helpers puros do HEIC + teste (TDD)

**Files:**
- Test (create): `scripts/tests/php/test_rdo_heic.php`
- Modify: `api/index.php` — inserir os 3 helpers imediatamente ANTES de `function handle_rdo_upload_foto` (~linha 9764)

**Interfaces:**
- Consumes: `harness.php` da suíte (`t_assert(bool, string)`, `t_resumo(string)` — carrega o `api/index.php` real sem banco via `OBRASYNC_TESTE_SEM_DB`).
- Produces: `rdo_heic_magic_ok(string $bytes): bool`, `rdo_heif_convert_cmd(string $bin, string $in, string $out): string`, `rdo_heic_jpg_candidatos(string $out): array` — usados na Task 2.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/tests/php/test_rdo_heic.php`:

```php
<?php
// RDO aceita HEIC: helpers puros da validação e da conversão, testados contra
// o arquivo real. A assinatura substitui a lista de MIME do store_upload no
// ramo HEIC (magic database antiga devolve application/octet-stream para HEIC
// legítimo); a conversão em si só roda no servidor — aqui trava-se o puro.
require __DIR__ . '/harness.php';

function t_heic_bytes(string $brand): string
{
    return pack('N', 24) . 'ftyp' . $brand . pack('N', 0) . $brand;
}

// rdo_heic_magic_ok — caixa ftyp no offset 4 + brand da família HEIF no offset 8
t_assert(rdo_heic_magic_ok(t_heic_bytes('heic')), 'brand heic aceito');
t_assert(rdo_heic_magic_ok(t_heic_bytes('heix')), 'brand heix aceito');
t_assert(rdo_heic_magic_ok(t_heic_bytes('mif1')), 'brand mif1 (heif generico) aceito');
t_assert(rdo_heic_magic_ok(t_heic_bytes('msf1')), 'brand msf1 aceito');
t_assert(rdo_heic_magic_ok(t_heic_bytes('HEIC')), 'brand maiusculo aceito (case-insensitive)');
t_assert(!rdo_heic_magic_ok(t_heic_bytes('isom')), 'mp4 (brand isom) recusado');
t_assert(!rdo_heic_magic_ok(t_heic_bytes('avif')), 'avif recusado');
t_assert(!rdo_heic_magic_ok("\xFF\xD8\xFF\xE0" . str_repeat("\x00", 20)), 'jpeg renomeado recusado');
t_assert(!rdo_heic_magic_ok(''), 'vazio recusado');
t_assert(!rdo_heic_magic_ok('curto'), 'arquivo curto recusado');
t_assert(!rdo_heic_magic_ok(str_repeat("\x00", 32)), 'binario aleatorio recusado');

// rdo_heif_convert_cmd — escapeshellarg nos 3 argumentos + qualidade fixa
$cmd = rdo_heif_convert_cmd('/usr/bin/heif-convert', "/tmp/a'b.heic", '/tmp/out.jpg');
t_assert(str_contains($cmd, escapeshellarg('/usr/bin/heif-convert')), 'binario escapado');
t_assert(str_contains($cmd, escapeshellarg("/tmp/a'b.heic")), 'entrada escapada');
t_assert(str_contains($cmd, escapeshellarg('/tmp/out.jpg')), 'saida escapada');
t_assert(str_contains($cmd, ' -q 85 '), 'qualidade 85 fixada');

// rdo_heic_jpg_candidatos — nome direto e primeiro da série multi-imagem
t_assert(rdo_heic_jpg_candidatos('/up/rdo/x.jpg') === ['/up/rdo/x.jpg', '/up/rdo/x-1.jpg'],
    'candidatos: nome pedido e -1.jpg do multi-imagem');

t_resumo('test_rdo_heic');
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `bash scripts/tests/run-all.sh`
Expected: bloco `test_rdo_heic.php` com FALHA (`Call to undefined function rdo_heic_magic_ok()`); os demais blocos verdes.

- [ ] **Step 3: Implementar os helpers**

Em `api/index.php`, logo ANTES de `function handle_rdo_upload_foto(...)` (~linha 9764):

```php
// ── RDO fotos HEIC: helpers puros ───────────────────────────────────────────
// A assinatura substitui a lista de MIME do store_upload no ramo HEIC: magic
// database antiga devolve application/octet-stream para HEIC legítimo e
// rejeitaria injustamente. Brands = família HEIF estática (array local de
// propósito — const no meio do arquivo fica indefinida em runtime, v1.14.0).
function rdo_heic_magic_ok(string $bytes): bool
{
    if (strlen($bytes) < 12 || substr($bytes, 4, 4) !== 'ftyp') {
        return false;
    }
    $brand = strtolower(substr($bytes, 8, 4));
    return in_array($brand, ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'], true);
}

function rdo_heif_convert_cmd(string $bin, string $in, string $out): string
{
    return escapeshellarg($bin) . ' -q 85 ' . escapeshellarg($in) . ' ' . escapeshellarg($out) . ' 2>&1';
}

// heif-convert grava nome-1.jpg (e -2, -3...) quando o HEIC tem várias imagens
// (burst/Live Photo): o resultado é o nome pedido OU o primeiro da série.
function rdo_heic_jpg_candidatos(string $out): array
{
    return [$out, dirname($out) . '/' . pathinfo($out, PATHINFO_FILENAME) . '-1.jpg'];
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `php -l api/index.php` e depois `bash scripts/tests/run-all.sh`
Expected: sem erro de sintaxe; `test_rdo_heic: 16/16 ok`; todos os blocos verdes.

- [ ] **Step 5: Commit**

```bash
git add api/index.php scripts/tests/php/test_rdo_heic.php
git commit -m "feat: helpers puros do RDO HEIC - assinatura ftyp, comando heif-convert e candidatos multi-imagem, com teste proprio"
```

---

### Task 2: Ramo HEIC no upload + conversão no servidor

**Files:**
- Modify: `api/index.php` — `handle_rdo_upload_foto` (~linha 9784, a linha do `store_upload`) + 2 funções novas logo após os helpers da Task 1

**Interfaces:**
- Consumes: `rdo_heic_magic_ok`, `rdo_heif_convert_cmd`, `rdo_heic_jpg_candidatos` (Task 1); `store_upload(array $file, string $dir, array $extensions, array $mimes): string` e `fail(string $msg, int $status): never` (existentes).
- Produces: `rdo_heif_convert_bin(): ?string`, `rdo_heic_para_jpeg(string $path): string` — usados só aqui; o caminho `.jpg` devolvido vai para `obra_rdo_fotos.caminho` (consumido sem mudança por download/PDF/semanal).

- [ ] **Step 1: Adicionar as funções de conversão**

Em `api/index.php`, logo após `rdo_heic_jpg_candidatos`:

```php
function rdo_heif_convert_bin(): ?string
{
    $which = trim((string) @shell_exec('command -v heif-convert 2>/dev/null'));
    if ($which !== '' && @is_executable($which)) {
        return $which;
    }
    foreach (['/usr/bin/heif-convert', '/usr/local/bin/heif-convert'] as $cand) {
        if (@is_executable($cand)) {
            return $cand;
        }
    }
    return null;
}

// Converte o .heic armazenado em .jpg definitivo. A conversão é o validador
// final: falhou = arquivo inválido, nada entra no banco. O original é apagado
// sempre — o registro da obra é o JPEG (decisão da spec, não guardar os dois).
function rdo_heic_para_jpeg(string $path): string
{
    $bin = rdo_heif_convert_bin();
    if ($bin === null) {
        @unlink($path);
        fail('Conversão HEIC indisponível no servidor — instale com: sudo apt install libheif-examples', 422);
    }
    $out = preg_replace('/\.(heic|heif)$/i', '', $path) . '.jpg';
    @shell_exec(rdo_heif_convert_cmd($bin, $path, $out));
    $final = null;
    foreach (rdo_heic_jpg_candidatos($out) as $cand) {
        if (is_file($cand) && filesize($cand) > 0) {
            $final = $cand;
            break;
        }
    }
    foreach (glob(dirname($out) . '/' . pathinfo($out, PATHINFO_FILENAME) . '-*.jpg') ?: [] as $extra) {
        if ($extra !== $final) {
            @unlink($extra);
        }
    }
    @unlink($path);
    if ($final === null) {
        fail('Arquivo HEIC inválido ou corrompido.', 400);
    }
    if ($final !== $out && @rename($final, $out)) {
        $final = $out;
    }
    @chmod($final, 0640);
    return $final;
}
```

- [ ] **Step 2: Ramificar o handler**

Em `handle_rdo_upload_foto`, substituir a linha única do `store_upload`:

```php
    $path = store_upload($_FILES['file'] ?? [], $dir, ['jpg', 'jpeg', 'png', 'webp'], ['image/jpeg', 'image/png', 'image/webp']);
```

por:

```php
    $ext = strtolower(pathinfo((string) ($_FILES['file']['name'] ?? ''), PATHINFO_EXTENSION));
    if (in_array($ext, ['heic', 'heif'], true)) {
        // Foto de iPhone: valida pela assinatura (não pelo MIME — ver
        // rdo_heic_magic_ok), armazena e converte para JPEG definitivo.
        $tmp = (string) ($_FILES['file']['tmp_name'] ?? '');
        $cabeca = ($tmp !== '' && is_readable($tmp)) ? (string) file_get_contents($tmp, false, null, 0, 32) : '';
        if (!rdo_heic_magic_ok($cabeca)) {
            fail('Conteúdo do arquivo não corresponde ao tipo permitido.', 400);
        }
        $path = store_upload($_FILES['file'] ?? [], $dir, ['heic', 'heif'], []);
        $path = rdo_heic_para_jpeg($path);
    } else {
        $path = store_upload($_FILES['file'] ?? [], $dir, ['jpg', 'jpeg', 'png', 'webp'], ['image/jpeg', 'image/png', 'image/webp']);
    }
```

- [ ] **Step 3: Verificar sintaxe e suíte**

Run: `php -l api/index.php` e `bash scripts/tests/run-all.sh`
Expected: sem erro de sintaxe; todos os blocos verdes (a conversão real com binário só é testável no servidor — coberta no roteiro de validação ao final).

- [ ] **Step 4: Commit**

```bash
git add api/index.php
git commit -m "feat: upload de foto do RDO aceita HEIC - conversao para JPEG via heif-convert, 422 orientando instalacao quando ausente"
```

---

### Task 3: Front — accept ampliado, prévia indisponível e release v1.45.0

**Files:**
- Modify: `app.js` — linha do input (`~3275`), `rdoRenderFotosPreview` (~3501), helper novo antes dela, `APP_VERSION`/`APP_VERSION_DATE`/`APP_CHANGELOG` (linhas 96-98)
- Modify: `styles.css` — bloco `.rdo-foto*` (~linha 6016)
- Modify: `index.html` — `?v=1814` → `?v=1815` (linhas 17 e 364)

**Interfaces:**
- Consumes: `svgText()` (escape existente), fila `rdoFotosPendentes` (`{file, url, legenda}`).
- Produces: `rdoEhHeic(nome: string): boolean` (helper global do app.js); classe CSS `.rdo-foto-sem-previa`.

- [ ] **Step 1: Ampliar o accept do input**

Em `app.js` (~3275), trocar:

```js
      <input type="file" id="rdoFotoFile" accept="image/jpeg,image/png,image/webp" multiple>
```

por:

```js
      <input type="file" id="rdoFotoFile" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple>
```

(Extensões inclusas porque o Windows frequentemente não registra o MIME de HEIC. Com HEIC no `accept`, o iOS PARA de converter sozinho e envia o HEIC cru — esperado: o servidor converte.)

- [ ] **Step 2: Helper + quadro de prévia no preview de pendentes**

Em `app.js`, imediatamente antes de `function rdoRenderFotosPreview()` (~3501):

```js
// Chrome/Edge não renderizam HEIC — o preview pendente mostra um quadro no
// lugar da <img>; a conversão para JPEG acontece no servidor, no envio.
function rdoEhHeic(nome) {
  return /\.(heic|heif)$/i.test(nome || "");
}
```

Dentro de `rdoRenderFotosPreview`, trocar o início da `<figure>`:

```js
      ${rdoFotosPendentes.map((p, i) => `<figure class="rdo-foto rdo-foto-pendente">
        <img src="${p.url}" alt="${svgText(p.file.name)}">
```

por:

```js
      ${rdoFotosPendentes.map((p, i) => `<figure class="rdo-foto rdo-foto-pendente">
        ${rdoEhHeic(p.file.name)
          ? `<div class="rdo-foto-sem-previa"><span>Prévia indisponível</span><small>${svgText(p.file.name)} — será convertida para JPEG no envio</small></div>`
          : `<img src="${p.url}" alt="${svgText(p.file.name)}">`}
```

(Legenda, Remover e o restante da figure ficam intocados; `p.url` continua criado/revogado como hoje.)

- [ ] **Step 3: CSS do quadro**

Em `styles.css`, logo após a linha `.rdo-foto-pendente .rdo-foto-legenda { ... }` (~6016):

```css
.rdo-foto-sem-previa { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 120px; padding: 8px; box-sizing: border-box; text-align: center; border-radius: 6px; background: var(--surface-hover, #f1f5f9); color: var(--muted, #667085); }
.rdo-foto-sem-previa small { font-size: 11px; word-break: break-word; }
```

(120px = mesma altura da `.rdo-foto img`; tokens com fallback seguem o padrão do dark theme v1.38.0.)

- [ ] **Step 4: Release v1.45.0**

Em `app.js` (linhas 96-97):

```js
const APP_VERSION = "v1.45.0";
const APP_VERSION_DATE = "2026-08-11";
```

E inserir como PRIMEIRO item do array `APP_CHANGELOG` (linha 98):

```js
  "Diário de Obra — fotos HEIC do iPhone: o RDO passa a aceitar fotos .heic/.heif enviadas direto do iPhone ou transferidas para o computador. O servidor converte para JPEG no envio — na tela, no PDF e no relatório semanal a foto aparece como sempre. Como o navegador não exibe HEIC, a foto pendente mostra um quadro \"Prévia indisponível\" até o envio; legenda e remoção funcionam igual. Se o conversor não estiver instalado no servidor, o envio avisa exatamente o que instalar, sem afetar as fotos JPG/PNG/WEBP. Vídeos (MP4) seguem não aceitos — o diário registra imagens (v1.45.0).",
```

Em `index.html`: linha 17 → `styles.css?v=1815`; linha 364 → `app.js?v=1815`.

- [ ] **Step 5: Verificar e commitar**

Run: `node --check app.js` e `bash scripts/tests/run-all.sh`
Expected: sem erro de sintaxe; todos os blocos verdes.

```bash
git add app.js styles.css index.html
git commit -m "feat: front do RDO aceita HEIC - accept ampliado, quadro de previa indisponivel e release v1.45.0"
```

---

### Task 4: Documentação (CLAUDE.md + README)

**Files:**
- Modify: `CLAUDE.md` — linha "**Versão atual:**" + bloco novo v1.45.0 logo abaixo dela
- Modify: `README.md` — versão no cabeçalho, se houver (conferir com `grep -n "v1.44" README.md`; atualizar cada ocorrência de versão/data para v1.45.0 · 2026-08-11)

**Interfaces:**
- Consumes: nomes reais das funções/arquivos das Tasks 1-3 (citados no texto abaixo).
- Produces: registro permanente da release para o próximo agente.

- [ ] **Step 1: Atualizar a linha de versão**

Em `CLAUDE.md`: `**Versão atual:** \`v1.44.0\` · 2026-08-02` → `**Versão atual:** \`v1.45.0\` · 2026-08-11`.

- [ ] **Step 2: Inserir o bloco da release (logo abaixo da linha de versão)**

```markdown
> **v1.45.0 — RDO aceita HEIC (conversão no servidor):** o upload de fotos do RDO aceita `.heic`/`.heif`. `handle_rdo_upload_foto` ganhou ramo próprio — assinatura binária (`rdo_heic_magic_ok`: caixa `ftyp` + brand da família HEIF; substitui a lista de MIME porque magic database antiga devolve `application/octet-stream` para HEIC legítimo) → `store_upload` com MIME vazio → `rdo_heic_para_jpeg` (CLI `heif-convert -q 85` localizado por `rdo_heif_convert_bin`; multi-imagem burst/Live Photo usa `nome-1.jpg` e apaga extras; original SEMPRE apagado; falha = 400 sem tocar o banco; binário ausente = 422 orientando `sudo apt install libheif-examples` — padrão pdftotext). **`store_upload()` compartilhada INTOCADA; sem migration.** Front: `accept` ampliado com HEIC (iOS passa a enviar o HEIC cru — esperado) + `rdoEhHeic()` + quadro `.rdo-foto-sem-previa` no preview (Chrome não renderiza HEIC). **MP4/vídeo VETADO pelo dono — não aceitar em nenhuma camada.** Teste novo `test_rdo_heic.php` (16). Deploy: `sudo apt install libheif-examples` manual via SSH (não passa pelo deploy.php — sem sudoers novo). Spec/plano: `docs/superpowers/specs/2026-08-11-rdo-heic-upload-design.md` e `docs/superpowers/plans/2026-08-11-rdo-heic-upload.md`. Cache `?v=1815`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: registra v1.45.0 - RDO aceita HEIC com conversao no servidor, MP4 vetado"
```

---

## Validação em produção (após o push, roteiro para o usuário)

1. Push (quando o usuário pedir) → no servidor `cd /var/www/financeiro && git stash && git pull origin main`. **Sem migration para rodar.** No navegador: Ctrl+Shift+R e conferir v1.45.0 no changelog.
2. **Caminho de erro primeiro** (antes de instalar o pacote): enviar um `.heic` num RDO → deve falhar com a mensagem "Conversão HEIC indisponível no servidor — instale com: sudo apt install libheif-examples", e a foto permanecer na fila com a legenda.
3. Instalar: `sudo apt install libheif-examples` e conferir com `heif-convert --version`.
4. Enviar um `.heic` real de iPhone → foto aparece na tela do RDO; conferir também no PDF individual e no relatório semanal; no servidor, `ls /var/lib/financeiro/uploads/rdo` deve mostrar o `.jpg` novo e NENHUM `.heic` remanescente.
5. Regressão: enviar um JPG normal → funciona como sempre.
6. Segurança: renomear um `.txt` para `.heic` e enviar → 400 ("Conteúdo do arquivo não corresponde ao tipo permitido." ou "Arquivo HEIC inválido ou corrompido."), nada gravado.
7. Se houver Live Photo/burst: enviar → deve aparecer UMA foto (primeiro quadro).
