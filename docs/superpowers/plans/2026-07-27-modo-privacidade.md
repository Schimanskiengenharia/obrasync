# Modo Privacidade (ocultar valores financeiros) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão (topbar + dashboard) que borra todo montante em R$ na tela — cards, tabelas, gráficos, painéis, toasts e alertas — com estado persistido por navegador.

**Architecture:** Estado global `privacyMode` (localStorage `finconta.privacy`) → classe `privacy-mode` no `<body>` → CSS `filter: blur()` em elementos marcados com `money-blur`. Marcação nos pontos centrais (`kpi()`, `tableCell()`, helpers de gráfico) cobre quase tudo; helpers `moneySpan()` (HTML) e `maskMoneyText()` (texto puro: toasts, `<title>` SVG) cobrem o resto. Spec: `docs/superpowers/specs/2026-07-27-modo-privacidade-design.md`.

**Tech Stack:** SPA sem build — `app.js` (vanilla JS, template strings + innerHTML), `styles.css`, `index.html`. Sem framework de teste: o gate é `node --check app.js` + validação manual no servidor (não há banco local — ver memória do projeto).

## Global Constraints

- Repo é `outputs\` — todos os caminhos abaixo são relativos a ele. Editar mantendo **LF**.
- Frontend-only: **sem** mudanças em `api/index.php`, sem migration.
- Validação de sintaxe obrigatória após cada edição de `app.js`: `node --check app.js`.
- Cache busting a cada release: `APP_VERSION`/`APP_VERSION_DATE`/`APP_CHANGELOG` em `app.js` + `?v=` (2 lugares) em `index.html` (hoje `v1.35.0` / `?v=1799`).
- `git push` só quando o usuário pedir. Nunca incluir `.claude/settings.local.json`.
- Exportações (Excel/CSV), documentos de impressão (proposta, contrato, pedido, RDO) e atributos HTML **não** recebem marcação.
- Regra de escopo do borrão: **montantes em R$** ficam ilegíveis; percentuais, contagens e datas continuam visíveis.
- Ícones Tabler v2.47 self-hosted: `ti-eye` e `ti-eye-off` existem (conferido no changelog do projeto: nem todo nome existe na v2.47 — estes dois sim, são do conjunto clássico).
- Números de linha citados são da v1.35.0 (`f3585de`+specs); confirme com grep antes de editar se o arquivo tiver mudado.

---

## ETAPA 1 — Infra + Dashboard (Tasks 1–4, release v1.36.0)

### Task 1: Infra — estado, helpers, botão da topbar, CSS

**Files:**
- Modify: `app.js` (após `safeLocalSet`, ~linha 392; e bloco de listeners, ~linha 19431)
- Modify: `index.html` (topbar `.actions`, ~linha 129)
- Modify: `styles.css` (fim do arquivo)

**Interfaces:**
- Produces: `privacyMode` (boolean global), `moneySpan(value) → string HTML`, `maskMoneyText(text) → string`, `applyPrivacyMode()`, `togglePrivacyMode()`, classe CSS `money-blur`, botão `#privacyBtn`. Todas as tasks seguintes consomem estes nomes.

- [ ] **Step 1: Estado e helpers em `app.js`** — inserir logo após o fecha-chaves de `safeLocalSet` (~linha 392):

```js
// ── Modo privacidade (ocultar valores financeiros) ──────────────────────────
// Borra todo montante em R$ na tela (cards, tabelas, gráficos, painéis, toasts).
// Estado por navegador (localStorage). Os valores continuam no DOM — é proteção
// contra olhares na tela (reunião/compartilhamento), não contra inspeção (spec).
let privacyMode = safeLocalGet("finconta.privacy") === "1";

// Contexto HTML visível: valor monetário borrável.
function moneySpan(value) {
  return `<span class="money-blur">${asMoney(value)}</span>`;
}

// Contextos de texto puro (toasts, <title> de SVG, confirm/alert): CSS não
// alcança — o montante vira "R$ •••" enquanto o modo está ativo. O \s do JS
// já casa o espaço não-quebrável (U+00A0) que o Intl usa em "R$ 1.234,56".
const MONEY_TEXT_RE = /R\$\s?[\d.][\d.,]*/g;
function maskMoneyText(text) {
  if (!privacyMode) return text;
  return String(text).replace(MONEY_TEXT_RE, "R$ •••");
}

// Sincroniza body + botão da topbar (o controle do dashboard renderiza no render()).
function applyPrivacyMode() {
  document.body.classList.toggle("privacy-mode", privacyMode);
  const btn = document.getElementById("privacyBtn");
  if (!btn) return;
  btn.classList.toggle("active", privacyMode);
  btn.innerHTML = `<i class="ti ${privacyMode ? "ti-eye-off" : "ti-eye"}"></i>`;
  const label = privacyMode ? "Mostrar valores" : "Ocultar valores";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.setAttribute("aria-pressed", privacyMode ? "true" : "false");
}

function togglePrivacyMode() {
  privacyMode = !privacyMode;
  safeLocalSet("finconta.privacy", privacyMode ? "1" : "0");
  applyPrivacyMode();
  render(); // gráficos e tooltips são gerados no render — precisam remontar
}
```

- [ ] **Step 2: Wiring no bloco de listeners** — logo após `qs("pdfBtn").addEventListener("click", () => window.print());` (~linha 19432), adicionar:

```js
qs("privacyBtn").addEventListener("click", togglePrivacyMode);
applyPrivacyMode(); // aplica o estado salvo já no boot (classe no body + ícone)
```

- [ ] **Step 3: Botão na topbar** — em `index.html`, dentro de `<div class="actions">` (~linha 129), antes de `<button id="seedBtn" ...>`:

```html
<button id="privacyBtn" class="icon-btn privacy-btn" type="button" title="Ocultar valores" aria-label="Ocultar valores" aria-pressed="false"><i class="ti ti-eye"></i></button>
```

- [ ] **Step 4: CSS** — fim de `styles.css`:

```css
/* ── Modo privacidade: borra montantes em R$ quando body.privacy-mode ──────── */
.privacy-mode .money-blur {
  filter: blur(7px);
  user-select: none;
}
/* Texto de SVG é menor e o viewBox escala — borrão proporcional. */
.privacy-mode svg text.money-blur { filter: blur(5px); }
/* Inputs de dinheiro: borrado até focar para editar. */
.privacy-mode input[data-format="money"]:not(:focus) { filter: blur(7px); }
/* Estado ATIVO inconfundível (spec: não pode parecer defeito). */
.privacy-btn.active,
.privacy-toggle.active {
  background: var(--teal);
  border-color: var(--teal);
  color: #fff;
}
```

- [ ] **Step 5: Verificar sintaxe**

Run: `node --check app.js`
Expected: sem saída (exit 0)

- [ ] **Step 6: Commit**

```bash
git add app.js index.html styles.css
git commit -m "feat: modo privacidade — infra (estado, helpers, botao topbar, CSS)"
```

### Task 2: Dashboard — cards, tabelas, painel Lucro x Caixa, alertas, execução + botão no dashboard

**Files:**
- Modify: `app.js` — `kpi()` (~4916), `tableCell()` (~7068), `lucroCaixaPanel()` (~4354-4366), `lucroCaixaAlerts()` (~4332), `dashboardAlerts()` (~4834-4835), `dashboardExecutionWidgets()` (~4696), `execTooltipHtml()` (~4793), `renderDashboard()` (~4531 e ~4557)

**Interfaces:**
- Consumes: `privacyMode`, `moneySpan()`, `togglePrivacyMode()`, classe `money-blur` (Task 1)
- Produces: botão `#dashPrivacyToggle` no dashboard; `tableCell()` passa a borrar TODA coluna de dinheiro do sistema (efeito global desejado)

- [ ] **Step 1: `kpi()`** — trocar a linha do return (~4919):

```js
return `<article class="kpi ${computedTone}"><span>${label}</span><strong class="${format ? "money-blur" : ""}">${format ? asMoney(value) : svgText(value)}</strong></article>`;
```

- [ ] **Step 2: `tableCell()`** — o embrulho vem DEPOIS do escape (formatCell é escapado para campos fora de `HTML_CELL_FIELDS` — embrulhar dentro de `formatCell` viraria texto literal). `exportExcel` exporta `outerHTML` da tabela: o Excel ignora o span e mostra o texto — sem regressão.

```js
function tableCell(field, row, moduleKey = "") {
  const content = formatCell(field, row[field], row, moduleKey);
  const cell = HTML_CELL_FIELDS.has(field) ? content : escapeHtml(content);
  // Modo privacidade: colunas de dinheiro borráveis (asMoney não gera HTML — seguro).
  return isMoneyField(field) ? `<span class="money-blur">${cell}</span>` : cell;
}
```

- [ ] **Step 3: `lucroCaixaPanel()`** — os 3 valores dos cards ganham a classe (linhas ~4356, ~4361, ~4366): em cada `<strong class="lc-value ...">`, acrescentar ` money-blur` à lista de classes. Exemplo do primeiro:

```js
<strong class="lc-value money-blur ${ind.lucroGerencial < 0 ? "lc-neg" : "lc-blue"}">${asMoney(ind.lucroGerencial)}</strong>
```

- [ ] **Step 4: `lucroCaixaAlerts()`** — linha ~4332, trocar `${asMoney(over.total)}` por `${moneySpan(over.total)}`:

```js
alerts.push(`<div class="alert alert-danger">${moneySpan(over.total)} em contas vencidas há mais de 30 dias.</div>`);
```

- [ ] **Step 5: `dashboardAlerts()`** — linhas ~4834-4835, trocar os dois `asMoney(...)` por `moneySpan(...)`:

```js
if (metrics.overduePayable > 0) alerts.push({ level: "danger", message: `${metrics.overduePayableCount} conta(s) a pagar vencida(s): ${moneySpan(metrics.overduePayable)} — pagamento da empresa em atraso.` });
if (metrics.overdueReceivable > 0) alerts.push({ level: "warning", message: `Inadimplência: ${metrics.overdueReceivableCount} conta(s) a receber vencida(s) (${moneySpan(metrics.overdueReceivable)}) — clientes em atraso.` });
```

- [ ] **Step 6: `dashboardExecutionWidgets()`** — linha ~4696:

```js
<span class="muted">${moneySpan(o.realizado)} realizado de ${moneySpan(o.previsto)} previsto</span>
```

- [ ] **Step 7: `execTooltipHtml()`** — tooltip HTML do gráfico de execução (~4798-4807): trocar os 4 `asMoney(...)` por `moneySpan(...)` (Previsto, Realizado, Estouro, Saldo). Exemplo:

```js
+ row("Previsto:", moneySpan(d.previsto))
+ row("Realizado:", moneySpan(d.realizado))
+ row("Estouro:", `${moneySpan(d.estouro)} ⚠️`, "exec-tt-bad")
```

(e no ramo sem estouro: `moneySpan(d.saldo)` na linha do Saldo.)

- [ ] **Step 8: Botão no dashboard** — em `renderDashboard()`, dentro de `<div class="dashboard-controls">` (~linha 4531), após o `</label>` do seletor de obra:

```html
<button id="dashPrivacyToggle" type="button" class="secondary privacy-toggle ${privacyMode ? "active" : ""}">
  <i class="ti ${privacyMode ? "ti-eye-off" : "ti-eye"}"></i> ${privacyMode ? "Valores ocultos" : "Ocultar valores"}
</button>
```

E no bloco de listeners do `renderDashboard()` (~linha 4557, junto de `dashboardProject`):

```js
qs("dashPrivacyToggle")?.addEventListener("click", togglePrivacyMode);
```

(`togglePrivacyMode` chama `render()` — o rótulo/estado do botão do dashboard atualiza sozinho; o da topbar atualiza no `applyPrivacyMode`.)

- [ ] **Step 9: Verificar sintaxe**

Run: `node --check app.js`
Expected: exit 0

- [ ] **Step 10: Commit**

```bash
git add app.js
git commit -m "feat: modo privacidade — dashboard (cards, tabelas, lucro x caixa, alertas, execucao) e botao no dashboard"
```

### Task 3: Gráficos — rótulos monetários, eixos e tooltips SVG

**Files:**
- Modify: `app.js` — `lineChart()` (~5013, ~5019, ~5029), `groupedBarChart()` (~5065, ~5072-5073), `horizontalBarChart()` (~5094)

**Interfaces:**
- Consumes: `maskMoneyText()` (Task 1), classe `money-blur`
- Produces: nada novo — barras/linhas continuam visíveis (spec: proporções sim, absolutos não)

- [ ] **Step 1: `lineChart()`** — 3 mudanças:

Eixo Y (linha ~5013), acrescentar `money-blur` na classe do `<text>`:
```js
return `<line x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}" class="chart-grid-line"></line><text x="8" y="${gy + 4}" class="chart-axis money-blur">${abbreviateMoney(label)}</text>`;
```

Tooltip dos pontos (linha ~5019), mascarar o valor:
```js
const dots = series.map((item) => item.values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="${dotR}" fill="${item.color}"><title>${svgText(item.label)}: ${maskMoneyText(compactMoney(value))}</title></circle>`).join("")).join("");
```

Tooltip combinado das faixas (linha ~5029), mascarar ANTES de escapar:
```js
return `<rect x="${rx}" y="${pad.top}" width="${rw}" height="${height - pad.top - pad.bottom}" fill="transparent"><title>${svgText(maskMoneyText(columnTooltips[index]))}</title></rect>`;
```

- [ ] **Step 2: `groupedBarChart()`** — tooltip das barras (linha ~5065):

```js
return `<rect x="${bx}" y="${by}" width="${barWidth - 2}" height="${bh}" rx="3" fill="${item.color}"><title>${svgText(row.label)} - ${svgText(item.key)}: ${maskMoneyText(compactMoney(value))}</title></rect>`;
```

Eixo Y (linhas ~5072-5073), acrescentar `money-blur`:
```js
<text x="8" y="${pad.top + 8}" class="chart-axis money-blur">${compactMoney(max)}</text>
<text x="8" y="${zeroY - 4}" class="chart-axis money-blur">R$ 0</text>
```

- [ ] **Step 3: `horizontalBarChart()`** — valor à direita da barra (linha ~5094):

```js
<strong class="money-blur">${compactMoney(value)}</strong>
```

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check app.js`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: modo privacidade — graficos (eixos monetarios e tooltips)"
```

### Task 4: Release da Etapa 1 (v1.36.0) + validação

**Files:**
- Modify: `app.js` (linhas 22-24), `index.html` (linhas 17 e 363), `README.md` (cabeçalho), `CLAUDE.md` (cabeçalho)

- [ ] **Step 1: Versão e changelog** — em `app.js`:

```js
const APP_VERSION = "v1.36.0";
const APP_VERSION_DATE = "2026-07-27";
```

Nova primeira entrada em `APP_CHANGELOG`:

```js
"Modo privacidade (Etapa 1 — dashboard): novo botão de olho na topbar e no dashboard que ESMAECE (borrão ilegível) todos os montantes em R$ da tela — cards KPI, colunas de dinheiro de todas as tabelas, painel Lucro x Caixa, alertas, widgets de execução de obras e os números dos gráficos (eixos e tooltips; as barras/linhas continuam visíveis — proporções sim, valores não). Percentuais, contagens e datas permanecem legíveis. O estado fica salvo no navegador (volta como estava ao recarregar) e o botão ativo fica destacado com olho cortado para não confundir com defeito. Exportações e documentos de impressão não mudam. Telas além do dashboard entram nas Etapas 2 e 3 (v1.36.0).",
```

- [ ] **Step 2: Cache busting** — `index.html`: trocar `styles.css?v=1799` → `?v=1800` e `app.js?v=1799` → `?v=1800`.

- [ ] **Step 3: Cabeçalhos de docs** — `README.md` e `CLAUDE.md`: atualizar versão/data no cabeçalho (`v1.36.0` · 2026-07-27) mantendo o restante intacto.

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check app.js`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add app.js index.html README.md CLAUDE.md
git commit -m "release: v1.36.0 — modo privacidade etapa 1 (dashboard)"
```

- [ ] **Step 6: Validação do usuário no servidor** (após push autorizado + Ctrl+Shift+R):
  1. Botão de olho aparece na topbar e no dashboard; clicar em qualquer um alterna os dois (olho cortado + fundo teal quando ativo).
  2. Ativo: todos os cards em R$, o painel Lucro x Caixa, alertas com valores, "R$ X realizado de R$ Y previsto", números dos eixos dos gráficos e a tabela "Próximos vencimentos" ficam borrados e não selecionáveis; tooltips de gráfico mostram "R$ •••".
  3. Percentuais (margens, execução), contagens (propostas, etapas) e datas continuam legíveis; barras/linhas visíveis.
  4. Recarregar a página mantém o modo; desativar volta tudo ao normal.
  5. Excel do dashboard (botão Excel) abre com valores REAIS (sem markup estranho).

---

## ETAPA 2 — Toasts, mensagens nativas e inputs ad-hoc (Task 5, release v1.36.1)

### Task 5: Cobertura de texto puro e inputs fora do padrão

**Files:**
- Modify: `app.js` — `showToast()` (~19251), chamadas de `confirm`/`alert`/`prompt` com montantes, inputs ad-hoc (~10775, ~13804, ~14416, ~15617, ~16968)
- Modify: `styles.css` (1 seletor novo)

**Interfaces:**
- Consumes: `maskMoneyText()`, `privacyMode` (Task 1)
- Produces: classe `money-private` para inputs de dinheiro sem `data-format="money"`

- [ ] **Step 1: `showToast()`** — mascarar o texto (toast usa `textContent` — CSS não alcança parte do texto):

```js
toast.textContent = maskMoneyText(message);
```

- [ ] **Step 2: Mensagens nativas com montantes** — localizar com:

Run: `grep -n -E "(confirm|alert|prompt)\(" app.js | grep -E "asMoney|R\\$"`

Regra: mensagens INFORMATIVAS ganham `maskMoneyText(...)` em volta da string. Valores EDITÁVEIS (ex.: o default do `prompt` de reajuste de parcelas na ~linha 8523, que usa `formatMoneyInput`) ficam como estão — equivalem a um input focado; mascarar quebraria a edição. Documentar no commit quais sites foram mascarados.

- [ ] **Step 3: Inputs ad-hoc** — adicionar a classe `money-private` (NÃO usar `data-format="money"` nesses — o atributo liga formatação automática no blur, linha ~7610, e mudaria o comportamento de inputs que já têm handlers próprios):
  - `#biVu` (~10775 — é atribuição de `.value`; a classe vai no HTML do dialog correspondente)
  - `#anfValor` (~13804)
  - `#cnfValor` (~14416)
  - `.pg-item-price` (~15617)
  - `.po-i-vu` (~16968)

  Exemplo (anfValor): `<label>Valor da nota (R$)<input id="anfValor" class="money-private" inputmode="decimal" value="...">`

  E no `styles.css`, ampliar o seletor de inputs:

```css
.privacy-mode input.money-private:not(:focus) { filter: blur(7px); }
```

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check app.js`
Expected: exit 0

- [ ] **Step 5: Release v1.36.1** — bump `APP_VERSION`/`APP_VERSION_DATE`, entrada no `APP_CHANGELOG` (toasts e inputs cobertos), `?v=1801` nos 2 lugares do `index.html`, cabeçalhos README/CLAUDE.

- [ ] **Step 6: Commit**

```bash
git add app.js styles.css index.html README.md CLAUDE.md
git commit -m "release: v1.36.1 — modo privacidade etapa 2 (toasts, mensagens e inputs)"
```

- [ ] **Step 7: Validação do usuário** — no financeiro: salvar/pagar uma conta com o modo ativo → toast sem valor real; tabelas de contas a pagar/receber borradas; inputs de valor borrados até focar.

---

## ETAPA 3 — Varredura dos ~169 usos de `asMoney` (Task 6, release v1.36.2)

### Task 6: Cauda longa — DRE, fluxo de caixa, relatórios e painéis custom

**Files:**
- Modify: `app.js` (múltiplos pontos — guiado por grep)

**Interfaces:**
- Consumes: `moneySpan()`, `maskMoneyText()` (Task 1)

- [ ] **Step 1: Levantar todos os usos**

Run: `grep -n "asMoney(" app.js`

- [ ] **Step 2: Classificar e transformar cada uso** segundo estas regras:
  - **(a) Template de TELA visível** (innerHTML de módulo/painel/dialog/tooltip): `asMoney(x)` → `moneySpan(x)`. Já cobertos nas etapas 1-2: `kpi`, `tableCell`, gráficos, lucroCaixa*, dashboardAlerts, execução.
  - **(b) Geradores de DOCUMENTO/EXPORT** — NÃO tocar: `proposalDocumentHtml`, `contractPdfHtml`/`buildContractObjeto` (o objeto é DADO gravado, não tela), HTML de impressão de pedido de compra, documentos de RDO/relatório semanal, `exportExcel`/CSV/`exportSinapiExcel`, corpo de e-mail/link.
  - **(c) Atributos `title="..."` de elementos de tela** (tooltips nativos): `maskMoneyText(...)` em volta do texto do atributo.
  - **(d) Strings passadas a `showToast`** — já resolvido centralmente (Task 5); não duplicar máscara.
  - Em dúvida entre (a) e (b): perguntar "este HTML é impresso/baixado intencionalmente?" — se sim, (b).
- [ ] **Step 3: Cobrir também** `compactMoney(`/`abbreviateMoney(` remanescentes fora dos 3 helpers de gráfico (grep) e o helper `bars()` do DRE/relatórios, aplicando as mesmas regras.
- [ ] **Step 4: Verificar sintaxe**

Run: `node --check app.js`
Expected: exit 0

- [ ] **Step 5: Release v1.36.2** — bump versão/data, changelog ("cobertura completa — DRE, fluxo de caixa, relatórios..."), `?v=1802`, cabeçalhos README/CLAUDE.

- [ ] **Step 6: Commit**

```bash
git add app.js index.html README.md CLAUDE.md
git commit -m "release: v1.36.2 — modo privacidade etapa 3 (cobertura completa)"
```

- [ ] **Step 7: Validação do usuário, módulo a módulo** — com o modo ativo, percorrer: DRE, Fluxo de caixa, Relatórios (financeiro/cliente/fornecedor/centro de custo/obra), Custo da Obra, Propostas, Contas a pagar/receber, Caixa, Cotações, RH. Critério do spec: **nenhum montante em R$ legível em lugar nenhum da tela**. Contra-prova: gerar o PDF de uma proposta e um Excel — valores reais intactos.
