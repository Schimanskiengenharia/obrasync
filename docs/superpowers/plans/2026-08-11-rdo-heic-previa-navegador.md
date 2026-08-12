# RDO HEIC — prévia real pelo servidor (v1.45.1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Nota de revisão:** a versão anterior deste plano vendorizava `heic2any` (decodificação no navegador). Foi descartada ANTES de codificar: a lib usa `new Function` (embind) e o CSP `script-src 'self'` bloqueia. Decisão final do usuário: prévia gerada pelo servidor. Ver o adendo da spec `docs/superpowers/specs/2026-08-11-rdo-heic-upload-design.md`.

**Goal:** ao escolher uma foto `.heic`/`.heif` no RDO, a fila de pendentes mostra a imagem real (junto do campo de legenda) em vez do quadro "Prévia indisponível" — convertida pelo servidor, sem gravar nada até o "Enviar fotos".

**Architecture:** endpoint novo `POST rdo-foto-previa` reusa os helpers HEIC da v1.45.0 e devolve o JPEG efêmero no corpo da resposta (temporários sempre apagados); o front ganha estado `previa` (`ok`/`gerando`/`falhou`) por item da fila e busca a prévia com fetch autenticado. Falha degrada para o quadro atual. CSP intocado; envio real intocado.

**Tech Stack:** PHP 8 (`api/index.php`), `heif-convert` já exigido pela v1.45.0, JS puro (`app.js`), suíte `scripts/tests/run-all.sh`.

## Global Constraints

- O envio real NÃO muda (fluxo v1.45.0 intocado); MP4/vídeo segue vetado; CSP intocado.
- A prévia é **efêmera**: nada em `uploads/`, nada no banco; temporários do sistema apagados sempre (sucesso ou falha).
- Binário ausente → 422 com a mensagem exata da v1.45.0 (`Conversão HEIC indisponível no servidor — instale com: sudo apt install libheif-examples`); HEIC inválido → 400. Falha de prévia NUNCA bloqueia o envio.
- Sem teste novo: o endpoint só orquestra helpers já testados em `test_rdo_heic.php`; a lógica JS nova é DOM+async (fora do padrão vm da suíte). Validação no roteiro de produção.
- Release v1.45.1 · 2026-08-11; cache `?v=1816`; suíte verde antes de cada commit; LF; push só com pedido do usuário (já autorizado nesta frente).

---

### Task 1: Endpoint `rdo-foto-previa`

**Files:**
- Modify: `api/index.php` — rota após o bloco `rdo-foto-upload` (~linha 825) + handler após `rdo_heic_para_jpeg`

**Interfaces:**
- Consumes: `rdo_heic_magic_ok`, `rdo_heif_convert_bin`, `rdo_heif_convert_cmd`, `rdo_heic_jpg_candidatos` (v1.45.0, já testados); `authorize_request`, `require_method`, `fail`.
- Produces: `POST rdo-foto-previa` (multipart `file`) → resposta `image/jpeg` binária; `handle_rdo_previa_foto(): never`.

- [ ] **Step 1: Rota**

Após o bloco `if ($resource === 'rdo-foto-upload') { ... }`:

```php
    if ($resource === 'rdo-foto-previa') {
        require_method($method, ['POST']);
        authorize_request($pdo, $authUser, 'rdo', 'edit');
        handle_rdo_previa_foto();
    }
```

- [ ] **Step 2: Handler**

Após `rdo_heic_para_jpeg`:

```php
// Prévia efêmera de HEIC: converte e DEVOLVE o JPEG sem gravar nada (nem
// arquivo definitivo, nem banco) — a fila de pendentes usa isso para mostrar
// a imagem antes do "Enviar fotos". O envio real segue pelo rdo-foto-upload.
function handle_rdo_previa_foto(): never
{
    $file = $_FILES['file'] ?? [];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        fail('Falha ao receber arquivo.', 400);
    }
    $ext = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
    if (!in_array($ext, ['heic', 'heif'], true)) {
        fail('Tipo de arquivo não permitido.', 400);
    }
    $tmp = (string) ($file['tmp_name'] ?? '');
    $cabeca = ($tmp !== '' && is_readable($tmp)) ? (string) file_get_contents($tmp, false, null, 0, 32) : '';
    if (!rdo_heic_magic_ok($cabeca)) {
        fail('Conteúdo do arquivo não corresponde ao tipo permitido.', 400);
    }
    $bin = rdo_heif_convert_bin();
    if ($bin === null) {
        fail('Conversão HEIC indisponível no servidor — instale com: sudo apt install libheif-examples', 422);
    }
    $out = rtrim(sys_get_temp_dir(), '/') . '/rdo-previa-' . bin2hex(random_bytes(8)) . '.jpg';
    @shell_exec(rdo_heif_convert_cmd($bin, $tmp, $out));
    $conteudo = '';
    foreach (rdo_heic_jpg_candidatos($out) as $cand) {
        if (is_file($cand) && filesize($cand) > 0) {
            $conteudo = (string) file_get_contents($cand);
            break;
        }
    }
    foreach (glob(dirname($out) . '/' . pathinfo($out, PATHINFO_FILENAME) . '-*.jpg') ?: [] as $extra) {
        @unlink($extra);
    }
    @unlink($out);
    if ($conteudo === '') {
        fail('Arquivo HEIC inválido ou corrompido.', 400);
    }
    header_remove('Content-Type');
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . strlen($conteudo));
    echo $conteudo;
    exit;
}
```

- [ ] **Step 3: Verificar e commitar**

Run: `php -l api/index.php` e `bash scripts/tests/run-all.sh`
Expected: sem erro de sintaxe; todos os blocos verdes.

```bash
git add api/index.php
git commit -m "feat: endpoint rdo-foto-previa - converte HEIC e devolve JPEG efemero para a fila de pendentes"
```

---

### Task 2: Estado de prévia no app.js

**Files:**
- Modify: `app.js` — handler `change` do `rdoFotoFile` (~3391), helper novo antes de `rdoEhHeic` (~3506), branch da figure em `rdoRenderFotosPreview`

**Interfaces:**
- Consumes: `POST rdo-foto-previa` (Task 1); `API_BASE`, `authHeaders()`, fila `rdoFotosPendentes`, `rdoEhHeic(nome)`, `svgText()`.
- Produces: `rdoGerarPreviaHeic(p): Promise<void>`; campo novo `p.previa: "ok"|"gerando"|"falhou"` em cada item da fila.

- [ ] **Step 1: Helper de prévia**

Antes do comentário de `rdoEhHeic`, inserir:

```js
// Prévia real de HEIC: o servidor converte e devolve um JPEG efêmero (nada é
// gravado até "Enviar fotos"). Falha degrada para o quadro "Prévia
// indisponível" — o envio segue normal de qualquer jeito.
async function rdoGerarPreviaHeic(p) {
  let novaUrl = null;
  try {
    const form = new FormData();
    form.append("file", p.file);
    const resp = await fetch(`${API_BASE}/rdo-foto-previa`, { method: "POST", headers: authHeaders(), body: form });
    if (resp.ok) novaUrl = URL.createObjectURL(await resp.blob());
  } catch (e) {
    console.warn("Prévia HEIC indisponível (o envio segue normal):", e);
  }
  if (!rdoFotosPendentes.includes(p)) {
    if (novaUrl) URL.revokeObjectURL(novaUrl);
    return;
  }
  if (novaUrl) {
    URL.revokeObjectURL(p.url);
    p.url = novaUrl;
    p.previa = "ok";
  } else {
    p.previa = "falhou";
  }
  rdoRenderFotosPreview();
}
```

- [ ] **Step 2: Handler do input marca o estado e dispara a prévia**

Trocar, no listener `change` do `rdoFotoFile`:

```js
    [...(e.target.files || [])].forEach((file) => rdoFotosPendentes.push({ file, url: URL.createObjectURL(file), legenda: "" }));
```

por:

```js
    [...(e.target.files || [])].forEach((file) => {
      const p = { file, url: URL.createObjectURL(file), legenda: "", previa: rdoEhHeic(file.name) ? "gerando" : "ok" };
      rdoFotosPendentes.push(p);
      if (p.previa === "gerando") rdoGerarPreviaHeic(p);
    });
```

- [ ] **Step 3: Figure com 3 estados**

Em `rdoRenderFotosPreview`, trocar o branch atual:

```js
        ${rdoEhHeic(p.file.name)
          ? `<div class="rdo-foto-sem-previa"><span>Prévia indisponível</span><small>${svgText(p.file.name)} — será convertida para JPEG no envio</small></div>`
          : `<img src="${p.url}" alt="${svgText(p.file.name)}">`}
```

por:

```js
        ${p.previa !== "ok"
          ? `<div class="rdo-foto-sem-previa"><span>${p.previa === "gerando" ? "Gerando prévia..." : "Prévia indisponível"}</span><small>${svgText(p.file.name)}${p.previa === "gerando" ? "" : " — será convertida para JPEG no envio"}</small></div>`
          : `<img src="${p.url}" alt="${svgText(p.file.name)}">`}
```

- [ ] **Step 4: Verificar e commitar**

Run: `node --check app.js` e `bash scripts/tests/run-all.sh`
Expected: sem erro de sintaxe; todos os blocos verdes.

```bash
git add app.js
git commit -m "feat: previa real de foto HEIC na fila do RDO - JPEG efemero gerado pelo servidor"
```

---

### Task 3: Release v1.45.1 + docs

**Files:**
- Modify: `app.js` (linhas 96-98), `index.html` (`?v=1815` → `?v=1816`), `CLAUDE.md` (linha de versão + bloco v1.45.1), `README.md` (2 linhas de versão + `?v=` + subseção no histórico)

- [ ] **Step 1: Versões**

`app.js`: `APP_VERSION = "v1.45.1"`, `APP_VERSION_DATE = "2026-08-11"`, novo primeiro item do `APP_CHANGELOG`:

```js
  "Diário de Obra — prévia real das fotos HEIC antes do envio: ao escolher fotos .heic/.heif, o quadro \"Prévia indisponível\" dá lugar à imagem de verdade — aparece \"Gerando prévia...\" por alguns segundos (o servidor converte a foto) e ela é exibida junto do campo de legenda, como as JPG. Nada é gravado no diário até você clicar em \"Enviar fotos\"; se a prévia falhar (sem rede, conversor ausente), o quadro antigo volta e o envio continua funcionando normalmente (v1.45.1).",
```

`index.html`: `styles.css?v=1816` e `app.js?v=1816`.

- [ ] **Step 2: CLAUDE.md e README**

CLAUDE.md: `**Versão atual:** \`v1.45.1\` · 2026-08-11` e bloco novo acima do v1.45.0:

```markdown
> **v1.45.1 — RDO HEIC: prévia real pelo servidor:** endpoint novo **`POST rdo-foto-previa`** (auth `rdo/edit`, molde do rdo-foto-upload) converte o HEIC com os helpers da v1.45.0 em temporário do sistema e devolve o **JPEG efêmero** no corpo — NADA gravado (uploads/banco); temporários sempre apagados; binário ausente = 422 (mesma mensagem), inválido = 400. Front: estado `previa` (`ok`/`gerando`/`falhou`) por item de `rdoFotosPendentes`; `rdoGerarPreviaHeic` (fetch autenticado, molde rdoCarregarFoto) troca `p.url` pelo JPEG e re-renderiza; falha degrada para o quadro "Prévia indisponível" sem bloquear o envio. Decisão registrada no adendo da spec: heic2any (client-side) foi DESCARTADA — usa `new Function` e o CSP `script-src 'self'` bloqueia; `'unsafe-eval'`/wasm recusados. CSP e fluxo de envio intocados; sem migration. Cache `?v=1816`.
```

README: `> Versão \`v1.45.1\` · 2026-08-11`, `**Versão atual:** \`v1.45.1\` (2026-08-11).`, `(hoje \`app.js?v=1816\`, \`styles.css?v=1816\`)` e subseção no Histórico acima da v1.45.0:

```markdown
### v1.45.1 — 2026-08-11 · RDO HEIC: prévia real antes do envio

A fila de fotos pendentes do RDO mostra a imagem real das fotos HEIC: "Gerando prévia..." por alguns segundos e a foto aparece junto do campo de legenda. A prévia é convertida pelo servidor (endpoint `rdo-foto-previa`) e é efêmera — nada é gravado até "Enviar fotos"; falha de prévia não afeta o envio. Sem mudança no CSP nem no fluxo de upload.
```

- [ ] **Step 3: Verificar e commitar**

Run: `bash scripts/tests/run-all.sh`
Expected: todos os blocos verdes.

```bash
git add app.js index.html CLAUDE.md README.md
git commit -m "docs: registra v1.45.1 - previa real de HEIC pelo servidor, cache 1816"
```

---

## Validação em produção (após o push)

1. Pull no servidor (webhook) — **sem migration; requisito continua sendo só o `libheif-examples` da v1.45.0**.
2. Ctrl+Shift+R; conferir v1.45.1 em Configurações → Versão.
3. Escolher uma foto HEIC no RDO → "Gerando prévia..." e em ~2-4 s a IMAGEM aparece com o campo de legenda.
4. Escolher JPG junto → prévia imediata como sempre.
5. Enviar as fotos → aparecem na tela do RDO (fluxo v1.45.0 intocado).
6. Remover uma HEIC da fila durante o "Gerando prévia..." → sem erro no console.
7. No servidor: `ls /tmp | grep rdo-previa` → vazio (temporários apagados).
