# RDO HEIC — prévia real no navegador (v1.45.1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ao escolher uma foto `.heic`/`.heif` no RDO, a fila de pendentes mostra a imagem decodificada (junto do campo de legenda) em vez do quadro "Prévia indisponível"; o envio continua mandando o HEIC original ao servidor.

**Architecture:** decodificação client-side só para a prévia, via `heic2any` 0.0.4 (asm.js, MIT) vendorizada e carregada sob demanda; estado `previa` (`ok`/`gerando`/`falhou`) por item da fila `rdoFotosPendentes`; falha degrada para o quadro atual. Adendo na spec: `docs/superpowers/specs/2026-08-11-rdo-heic-upload-design.md`.

**Tech Stack:** JS puro (`app.js`), asset vendorizado em `assets/vendor/`, CSP existente (`script-src 'self'`, `img-src blob:`), suíte `scripts/tests/run-all.sh`.

## Global Constraints

- O upload NÃO muda: continua enviando o `p.file` original (HEIC) e o servidor converte (v1.45.0 intocada). MP4/vídeo segue vetado.
- CSP intocado — por isso heic2any **0.0.4 asm.js** (sem `unsafe-eval`); a lib carrega de `assets/vendor/` (self).
- Carregar a lib **só quando a primeira foto HEIC for escolhida** — nunca no bootstrap.
- Falha de decodificação nunca bloqueia envio nem lança para o usuário — `console.warn` + estado `falhou` (quadro atual).
- Release v1.45.1 · 2026-08-11; cache `?v=1816` em `index.html`; `APP_VERSION`/`APP_CHANGELOG` juntos.
- `bash scripts/tests/run-all.sh` verde antes de cada commit (static-checks só linta arquivos listados — o vendor min.js não entra).
- Sem teste JS novo: a lógica nova é DOM+async (script injection, objectURL, re-render) — o padrão da suíte é função pura extraída via vm, e aqui a única parte "pura" é um ternário. Validação real no roteiro de produção.

---

### Task 1: Vendorizar o heic2any

**Files:**
- Create: `assets/vendor/heic2any.min.js` (download) e `assets/vendor/heic2any-LICENSE.txt`

**Interfaces:**
- Produces: global `window.heic2any({blob, toType, quality}): Promise<Blob|Blob[]>` disponível após o script carregar.

- [ ] **Step 1: Baixar e conferir**

```bash
mkdir -p assets/vendor
curl -fsSL -o assets/vendor/heic2any.min.js "https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js"
curl -fsSL -o assets/vendor/heic2any-LICENSE.txt "https://unpkg.com/heic2any@0.0.4/LICENSE"
```

Conferir: arquivo > 500 KB, contém `heic2any`, e **não** depende de `eval(`/`new Function(` (CSP): `grep -c "heic2any" assets/vendor/heic2any.min.js` ≥ 1. Se o LICENSE der 404, criar o txt com a nota "heic2any 0.0.4 — MIT — https://github.com/alexcorvi/heic2any".

- [ ] **Step 2: Commit**

```bash
git add assets/vendor/heic2any.min.js assets/vendor/heic2any-LICENSE.txt
git commit -m "chore: vendoriza heic2any 0.0.4 (MIT, asm.js) para previa de HEIC no navegador"
```

---

### Task 2: Estado de prévia + decodificação no app.js

**Files:**
- Modify: `app.js` — handler `change` do `rdoFotoFile` (~3391), helpers antes de `rdoEhHeic` (~3506), branch da figure em `rdoRenderFotosPreview`

**Interfaces:**
- Consumes: `window.heic2any` (Task 1); fila `rdoFotosPendentes`; `rdoEhHeic(nome)`; `svgText()`.
- Produces: `rdoCarregarHeic2any(): Promise<void>`, `rdoGerarPreviaHeic(p): Promise<void>`; campo novo `p.previa: "ok"|"gerando"|"falhou"` em cada item da fila.

- [ ] **Step 1: Helpers de carregamento e decodificação**

Antes do comentário de `rdoEhHeic`, inserir:

```js
// Prévia real de HEIC no navegador: decodificador self-hosted (heic2any,
// asm.js — compatível com o CSP sem afrouxar script-src), carregado SÓ na
// primeira foto HEIC escolhida. O envio continua mandando o HEIC original.
let rdoHeic2anyPromise = null;
function rdoCarregarHeic2any() {
  if (window.heic2any) return Promise.resolve();
  if (!rdoHeic2anyPromise) {
    rdoHeic2anyPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "assets/vendor/heic2any.min.js";
      s.onload = resolve;
      s.onerror = () => { rdoHeic2anyPromise = null; s.remove(); reject(new Error("decodificador HEIC não carregou")); };
      document.head.appendChild(s);
    });
  }
  return rdoHeic2anyPromise;
}

async function rdoGerarPreviaHeic(p) {
  let novaUrl = null;
  try {
    await rdoCarregarHeic2any();
    const saida = await window.heic2any({ blob: p.file, toType: "image/jpeg", quality: 0.7 });
    novaUrl = URL.createObjectURL(Array.isArray(saida) ? saida[0] : saida);
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

- [ ] **Step 2: Handler do input marca o estado e dispara a decodificação**

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
git commit -m "feat: previa real de foto HEIC na fila do RDO - decodificacao no navegador com heic2any sob demanda"
```

---

### Task 3: Release v1.45.1 + docs

**Files:**
- Modify: `app.js` (linhas 96-98: versão/data/changelog), `index.html` (`?v=1815` → `?v=1816` nas 2 tags), `CLAUDE.md` (linha de versão + bloco v1.45.1), `README.md` (2 linhas de versão + `?v=` + subseção no histórico)

- [ ] **Step 1: Versões**

`app.js`: `APP_VERSION = "v1.45.1"`, `APP_VERSION_DATE = "2026-08-11"`, e novo primeiro item do `APP_CHANGELOG`:

```js
  "Diário de Obra — prévia real das fotos HEIC antes do envio: ao escolher fotos .heic/.heif, o quadro \"Prévia indisponível\" dá lugar à imagem de verdade — aparece \"Gerando prévia...\" por um instante e a foto é exibida junto do campo de legenda, como as JPG. O processamento acontece no próprio navegador, que baixa o decodificador uma única vez e só quando a primeira foto HEIC é escolhida; se o aparelho não conseguir decodificar, o quadro antigo volta e o envio continua funcionando normalmente (v1.45.1).",
```

`index.html`: `styles.css?v=1816` e `app.js?v=1816`.

- [ ] **Step 2: CLAUDE.md e README**

CLAUDE.md: `**Versão atual:** \`v1.45.1\` · 2026-08-11` e bloco novo acima do v1.45.0:

```markdown
> **v1.45.1 — RDO HEIC: prévia real no navegador:** a fila de pendentes decodifica o HEIC client-side só para a prévia (`rdoCarregarHeic2any` injeta `assets/vendor/heic2any.min.js` — 0.0.4, MIT, asm.js compatível com o CSP — SÓ na primeira foto HEIC; `rdoGerarPreviaHeic` troca `p.url` pelo JPEG quality 0.7, multi-imagem usa o 1º blob, revoga objectURLs, re-renderiza). Estado `previa` (`ok`/`gerando`/`falhou`) por item; falha degrada para o quadro "Prévia indisponível" e NUNCA bloqueia o envio (que segue mandando o HEIC original — v1.45.0 intocada). Adendo na spec 2026-08-11. Cache `?v=1816`.
```

README: `> Versão \`v1.45.1\` · 2026-08-11`, `**Versão atual:** \`v1.45.1\` (2026-08-11).`, `(hoje \`app.js?v=1816\`, \`styles.css?v=1816\`)` e, no Histórico de Versões, subseção acima da v1.45.0:

```markdown
### v1.45.1 — 2026-08-11 · RDO HEIC: prévia real antes do envio

A fila de fotos pendentes do RDO passa a mostrar a imagem decodificada das fotos HEIC (com "Gerando prévia..." durante o processamento), no lugar do quadro "Prévia indisponível". Decodificador `heic2any` (MIT) vendorizado em `assets/vendor/`, baixado uma única vez e só quando a primeira foto HEIC é escolhida; falha de decodificação volta ao quadro antigo sem afetar o envio.
```

- [ ] **Step 3: Verificar e commitar**

Run: `bash scripts/tests/run-all.sh`
Expected: todos os blocos verdes.

```bash
git add app.js index.html CLAUDE.md README.md
git commit -m "docs: registra v1.45.1 - previa real de HEIC no navegador, cache 1816"
```

---

## Validação em produção (após o push)

1. Pull no servidor (webhook) — **sem migration, sem apt install novo** (o `libheif-examples` da v1.45.0 continua sendo o único requisito, e é do envio, não da prévia).
2. Ctrl+Shift+R; conferir v1.45.1 em Configurações → Versão.
3. Escolher uma foto HEIC no RDO → aparece "Gerando prévia..." e em seguida a IMAGEM com o campo de legenda; conferir na aba Network que `heic2any.min.js` só baixou nesse momento.
4. Escolher JPG junto → prévia imediata como sempre.
5. Enviar as fotos → aparecem na tela do RDO (conversão do servidor, fluxo v1.45.0).
6. Remover uma HEIC da fila durante o "Gerando prévia..." → sem erro no console.
