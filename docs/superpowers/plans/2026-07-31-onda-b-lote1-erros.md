# Onda B — Lote 1 (E3 + E4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erros 500 passam a exibir um código de correlação (UUID) presente também no `error_log` (E4), e o `saveForm` troca `alert()` por `showToast` com severidade, visível acima do modal (E3).

**Architecture:** Backend: dois helpers puros (`obra_error_ref`/`apply_error_ref`) no `api/index.php`, aplicados mecanicamente em `fail()`, nas 11 funções `*_respond` e nos `error_log` dos catches que respondem 500. Frontend: `toastConfig()` pura + `showToast()` retrocompatível pendurado no `dialog:modal` aberto; `saveForm` migra 11 `alert()`.

**Tech Stack:** PHP 8 (arquivo único `api/index.php`), JS vanilla (`app.js`), testes via harness PHP (`scripts/tests/php/harness.php` — carrega o index.php real com `OBRASYNC_TESTE_SEM_DB`) e via `vm` do Node (extração do bloco real do `app.js`).

**Spec:** `docs/superpowers/specs/2026-07-31-onda-b-lote1-erros-design.md`

## Global Constraints

- Line endings **LF** (repo Unix; cuidado com o VS Code no Windows).
- Antes de salvar: `php -l api/index.php` e `node --check app.js`.
- Working dir dos comandos: raiz do repo (`outputs\`). Suíte: `bash scripts/tests/run-all.sh` (descobre `scripts/tests/php/test_*.php` e `scripts/tests/js/test_*.js` sozinha — teste novo não exige editar o runner).
- Commit local a cada task; **NUNCA `git push`** (o dono pede quando quiser). Mensagens de commit em português **sem acento** (padrão do repo). Não incluir `.claude/settings.local.json`.
- Privacidade: `showToast` continua passando o texto por `maskMoneyText` (teste-guarda `test_privacy_coverage.js` vigia). Nunca `.catch(() => {})`.
- Nunca tocar em `/etc/financeiro/config.php`, uploads, backups ou banco.
- Fora de escopo: os ~265 `alert()` fora do `saveForm`, catálogo de mensagens (E8), log estruturado (E5), mensagens 4xx.

---

### Task 1: E4 — helpers puros + teste PHP

**Files:**
- Modify: `api/index.php` (bloco de constantes do topo, antes do primeiro `try` do roteamento — logo após `const IA_COMPARA_COMMIT_EVERY = 25;`)
- Test: `scripts/tests/php/test_error_ref.php` (novo)

**Interfaces:**
- Consumes: `scripts/tests/php/harness.php` (fornece `t_assert(bool, string)` / `t_resumo(string)` e carrega o `api/index.php` real).
- Produces: `obra_error_ref(): string` (UUID v4 memoizado por request) e `apply_error_ref(string $message, int $status): string` (anexa ` (código: <uuid>)` só quando `$status >= 500`). Tasks 2 e 3 usam exatamente esses nomes.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/tests/php/test_error_ref.php`:

```php
<?php
// E4: código de correlação de erro 500 — funções puras testadas contra o arquivo real.
// Contrato: 4xx nunca ganha código (mensagem já é acionável); >=500 anexa
// "(código: <uuid v4>)" e o MESMO uuid vale para o request inteiro (static),
// para a mensagem do usuário e o error_log apontarem para a mesma linha.
require __DIR__ . '/harness.php';

t_assert(apply_error_ref('Falhou.', 400) === 'Falhou.', '400 nao ganha codigo');
t_assert(apply_error_ref('Falhou.', 422) === 'Falhou.', '422 nao ganha codigo');
t_assert(apply_error_ref('Falhou.', 499) === 'Falhou.', '499 nao ganha codigo');

$m500 = apply_error_ref('Erro interno.', 500);
t_assert(str_starts_with($m500, 'Erro interno. (código: '), '500 anexa o codigo no fim');
$m503 = apply_error_ref('Fora do ar.', 503);
t_assert(str_contains($m503, '(código: '), '503 tambem anexa');

$ref = obra_error_ref();
t_assert(preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $ref) === 1,
    'obra_error_ref e UUID v4 minusculo');
t_assert(obra_error_ref() === $ref, 'mesmo request -> mesmo codigo');
t_assert(str_contains($m500, $ref) && str_contains($m503, $ref), 'mensagens usam o codigo do request');

t_resumo('test_error_ref');
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `php scripts/tests/php/test_error_ref.php`
Expected: FAIL — `Call to undefined function apply_error_ref()`. (Se o PHP local reclamar de mbstring, rode via `bash scripts/tests/run-all.sh` — o runner habilita a extensão.)

- [ ] **Step 3: Implementar os helpers**

Em `api/index.php`, logo após a linha `const IA_COMPARA_COMMIT_EVERY = 25;` (fim do bloco de constantes do comparador; qualquer ponto top-level antes do roteamento serve — funções são hoisted, mas o topo segue a convenção do arquivo):

```php

// E4 — código de correlação de erro. UM UUID v4 por request (static): a mensagem
// genérica do 500 e as linhas do error_log carregam o mesmo código, permitindo
// ligar a reclamação do usuário à linha exata do log. NUNCA aproveita id vindo
// do cliente (seria forjável e quebraria a correlação).
function obra_error_ref(): string
{
    static $ref = null;
    if ($ref === null) {
        $b = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0f) | 0x40); // versão 4
        $b[8] = chr((ord($b[8]) & 0x3f) | 0x80); // variant RFC 4122
        $ref = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }
    return $ref;
}

// Pura: anexa o código de correlação SÓ em erro de servidor (>= 500). 4xx é erro
// do usuário, acionável pela própria mensagem — código ali seria ruído.
function apply_error_ref(string $message, int $status): string
{
    if ($status < 500) {
        return $message;
    }
    return $message . ' (código: ' . obra_error_ref() . ')';
}
```

- [ ] **Step 4: Validar sintaxe e rodar o teste**

Run: `php -l api/index.php && php scripts/tests/php/test_error_ref.php`
Expected: `test_error_ref: 8/8 ok`

- [ ] **Step 5: Commit**

```bash
git add api/index.php scripts/tests/php/test_error_ref.php
git commit -m "feat(api): codigo de correlacao de erro 500 (E4) - helpers puros + teste

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: E4 — aplicar o código em `fail()` e nas 11 `*_respond`

**Files:**
- Modify: `api/index.php` — `fail()` e as 11 funções de resposta de módulo.

**Interfaces:**
- Consumes: `apply_error_ref(string, int): string` e `obra_error_ref(): string` (Task 1).
- Produces: toda resposta HTTP ≥500 do arquivo carrega ` (código: <uuid>)` na mensagem; `fail()` também devolve o campo JSON `errorRef` quando ≥500.

- [ ] **Step 1: Reescrever `fail()`**

Localizar (`grep -n "function fail(" api/index.php`) e substituir o corpo inteiro:

```php
function fail(string $message, int $status): never
{
    // E4: erro de servidor sai com o código de correlação na mensagem e no
    // campo errorRef (disponível para o front; hoje só a mensagem é exibida).
    $message = apply_error_ref($message, $status);
    $payload = ['ok' => false, 'error' => $message];
    if ($status >= 500) {
        $payload['errorRef'] = obra_error_ref();
    }
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
```

- [ ] **Step 2: Editar as 11 `*_respond` (1 linha cada)**

Localizar todas com `grep -n "_respond(bool" api/index.php` — são exatamente estas 11 (linhas pré-Task 1: `agenda_respond:1008`, `clients_module_respond:1050`, `payable_respond:1108`, `cotacao_respond:3457`, `cost_centers_respond:5279`, `viabilidade_respond:5625`, `cash_moves_respond:6038`, `company_settings_respond:6151`, `poi_respond:6343`, `wbe_respond:6563`, `sinapi_module_respond:12836`). Em cada uma, inserir a linha do E4 antes do `http_response_code($status);`. Exemplo (`agenda_respond`) — as outras 10 são idênticas, mudando só o nome:

```php
function agenda_respond(bool $success, mixed $data = [], string $message = '', int $status = 200): never
{
    $message = apply_error_ref($message, $status); // E4: 500 sai com código
    http_response_code($status);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
```

- [ ] **Step 3: Verificar a contagem e a sintaxe**

Run: `grep -c 'apply_error_ref($message, $status)' api/index.php && php -l api/index.php`
Expected: `12` (11 responds + fail; a definição da função não casa com o padrão) e sintaxe ok.

- [ ] **Step 4: Rodar a suíte**

Run: `bash scripts/tests/run-all.sh`
Expected: `SUITE: 13/13 blocos ok` (12 anteriores + test_error_ref).

- [ ] **Step 5: Commit**

```bash
git add api/index.php
git commit -m "feat(api): mensagens 500 exibem o codigo de correlacao (E4)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: E4 — `[ref <uuid>]` nos `error_log` dos catches de 500

**Files:**
- Modify: `api/index.php` — os `error_log` dos catches que respondem 500 (~22 pontos).

**Interfaces:**
- Consumes: `obra_error_ref(): string` (Task 1).
- Produces: linha de log no formato `[ObraSync <contexto>][ref <uuid>] <detalhe>` para todo 500 logado.

- [ ] **Step 1: Editar cada `error_log` de catch com resposta 500**

Transformação (padrão único — inserir `[ref ...]` colado ao prefixo):

```php
// ANTES
error_log('[ObraSync agenda] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
// DEPOIS
error_log('[ObraSync agenda][ref ' . obra_error_ref() . '] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
```

Lista dos pontos (localizar pelo texto do prefixo — linhas mudaram após as Tasks 1-2; **antes de editar, confirme que o catch termina numa resposta 500**; se algum não terminar, deixe como está):

1. `[ObraSync API] Aprovação de proposta falhou:` (aprovação de proposta)
2. `[ObraSync API] ` (catch global do roteamento REST)
3. `[ObraSync agenda] `
4. `[ObraSync clients] `
5. `[ObraSync payable] `
6. `[ObraSync cotacoes] `
7. `[ObraSync costCenters] `
8. `[ObraSync viabilidade] `
9. `[ObraSync cashMoves] `
10. `[ObraSync companySettings] `
11. `[ObraSync purchaseOrderItems] `
12. `[ObraSync execucao] `
13. `[ObraSync dashboardExecution] `
14. `[ObraSync OFX] Conciliação falhou:`
15. `[ObraSync OFX] Importação falhou:`
16. `[ObraSync NFS-e] Cadastro rápido falhou em `
17. `[ObraSync RDO] save:`
18. `[ObraSync RDO] assinar:`
19. `[ObraSync NFS-e] Importação falhou:`
20. `[ObraSync] user_permissions save:`
21. `[ObraSync] Falha no INSERT da sessão de login:`
22. `[ObraSync] INSERT da sessão de login não deu erro, mas a linha não foi encontrada.`

Os `error_log` informativos de automação (ex.: `Automação de qualidade (create) falhou`, `ensure_*`), que **não** respondem 500, ficam intactos.

- [ ] **Step 2: Verificar contagem e sintaxe**

Run: `grep -c "\[ref ' . obra_error_ref() . '\]" api/index.php && php -l api/index.php`
Expected: contagem = nº de pontos editados (esperado 22; se menor, justifique no commit qual site não respondia 500) e sintaxe ok.

- [ ] **Step 3: Rodar a suíte**

Run: `bash scripts/tests/run-all.sh`
Expected: `SUITE: 13/13 blocos ok`

- [ ] **Step 4: Commit**

```bash
git add api/index.php
git commit -m "feat(api): error_log dos catches de 500 carrega o [ref] do request (E4)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: E3 — `toastConfig` + `showToast` + CSS + teste JS

**Files:**
- Modify: `app.js:19712-19723` (bloco atual do `showToast`)
- Modify: `styles.css` (logo após o bloco `.app-toast`, linha ~681)
- Test: `scripts/tests/js/test_toast_severity.js` (novo)

**Interfaces:**
- Consumes: `maskMoneyText` (já existe no app.js e continua sendo aplicado).
- Produces: `toastConfig(severity) -> { classe, role, duracao }` (pura) e `showToast(message, opts)` com `opts` número (duração, compat) ou `{ severity: "info"|"success"|"warning"|"error", duration }`. Task 5 chama `showToast(msg, { severity: "warning"|"error" })`.
- Âncoras de extração do teste: o bloco vai de `function toastConfig` até `async function handleChangePassword` (função seguinte no arquivo).

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/tests/js/test_toast_severity.js`:

```js
// Testa o toast com severidade (E3) do app.js.
//
// Estratégia (molde do test_error_handler): extrai o BLOCO REAL do app.js
// (toastConfig + showToast) e executa num contexto vm com stubs de DOM —
// valida o mapa de severidade, a compat com o 2º argumento numérico e a
// escolha do host (modal aberto vs body) sem navegador.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..", "..", "..", "app.js");
const src = fs.readFileSync(APP, "utf8");
const ini = src.indexOf("function toastConfig");
const fim = src.indexOf("async function handleChangePassword");
if (ini < 0 || fim < 0 || fim < ini) {
  console.error("test_toast_severity: FALHA — bloco toastConfig/showToast não encontrado no app.js");
  process.exit(1);
}

let ok = 0;
let falhas = 0;
function t_assert(nome, cond) {
  if (cond) { ok++; return; }
  falhas++;
  console.error("  FALHA: " + nome);
}

function novoNo() {
  return {
    attrs: {}, handlers: {}, removido: false,
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(ev, fn) { this.handlers[ev] = fn; },
    remove() { this.removido = true; },
  };
}
const appended = [];
let modais = [];
let ultimaDuracao = null;
const bodyHost = { appendChild: (n) => appended.push({ host: "body", no: n }) };
const sandbox = {
  document: {
    getElementById: () => null,
    createElement: () => novoNo(),
    querySelectorAll: () => modais,
    body: bodyHost,
  },
  setTimeout: (fn, ms) => { ultimaDuracao = ms; return 0; },
  maskMoneyText: (t) => "MASCARADO:" + t,
};
vm.createContext(sandbox);
vm.runInContext(src.slice(ini, fim), sandbox);
const toastConfig = sandbox.toastConfig;
const showToast = sandbox.showToast;

// ── toastConfig: o contrato severidade → classe/role/duração ────────────────
t_assert("info sem classe extra", toastConfig("info").classe === "");
t_assert("info role status", toastConfig("info").role === "status");
t_assert("info 2s", toastConfig("info").duracao === 2000);
t_assert("success classe", toastConfig("success").classe === "toast-success");
t_assert("success role status", toastConfig("success").role === "status");
t_assert("warning classe", toastConfig("warning").classe === "toast-warning");
t_assert("warning role alert", toastConfig("warning").role === "alert");
t_assert("warning 4s", toastConfig("warning").duracao === 4000);
t_assert("error classe", toastConfig("error").classe === "toast-error");
t_assert("error role alert", toastConfig("error").role === "alert");
t_assert("error 6s", toastConfig("error").duracao === 6000);
t_assert("severidade desconhecida cai em info", toastConfig("xablau").duracao === 2000);
t_assert("sem severidade cai em info", toastConfig(undefined).role === "status");

// ── showToast: compat com a assinatura antiga (2º arg numérico) ─────────────
showToast("olá", 3500);
t_assert("2o arg numérico vira duração", ultimaDuracao === 3500);
t_assert("numérico = severidade info (classe base)", appended.at(-1).no.className === "app-toast");
t_assert("privacidade: texto passa por maskMoneyText", appended.at(-1).no.textContent === "MASCARADO:olá");

// ── showToast: objeto de opções ─────────────────────────────────────────────
showToast("cuidado", { severity: "warning" });
t_assert("warning aplica a classe", appended.at(-1).no.className === "app-toast toast-warning");
t_assert("warning usa a duração default 4s", ultimaDuracao === 4000);
t_assert("warning vira role alert", appended.at(-1).no.attrs.role === "alert");
showToast("explodiu", { severity: "error", duration: 9000 });
t_assert("duration explícita vence o default", ultimaDuracao === 9000);
t_assert("clique fecha o toast", (() => { const n = appended.at(-1).no; n.handlers.click(); return n.removido; })());

// ── showToast: host = último dialog:modal aberto, senão body ────────────────
t_assert("sem modal, host é o body", appended.every((a) => a.host === "body"));
const modalHost = { appendChild: null };
modalHost.appendChild = (n) => appended.push({ host: "modal", no: n });
modais = [{ appendChild: () => { throw new Error("pegou o primeiro, não o último"); } }, modalHost];
showToast("dentro do modal", { severity: "warning" });
t_assert("com modal aberto, host é o ÚLTIMO modal", appended.at(-1).host === "modal");
modais = [];

console.log(`test_toast_severity: ${ok}/${ok + falhas} ok`);
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/tests/js/test_toast_severity.js`
Expected: FAIL — `bloco toastConfig/showToast não encontrado no app.js` (exit 1).

- [ ] **Step 3: Implementar no app.js**

Substituir o bloco atual (`app.js:19712-19723` — de `function showToast(message, duration = 2000) {` até o `}` antes de `async function handleChangePassword`) por:

```js
// Severidade → classe/role/duração. Função PURA de propósito: é o contrato do
// toast e o teste (test_toast_severity) valida o mapa sem precisar de DOM real.
function toastConfig(severity) {
  const mapa = {
    info:    { classe: "",              role: "status", duracao: 2000 },
    success: { classe: "toast-success", role: "status", duracao: 2000 },
    warning: { classe: "toast-warning", role: "alert",  duracao: 4000 },
    error:   { classe: "toast-error",   role: "alert",  duracao: 6000 },
  };
  return mapa[severity] || mapa.info;
}

function showToast(message, opts = {}) {
  // 2º argumento numérico = duração (assinatura antiga; dezenas de chamadas).
  const o = typeof opts === "number" ? { duration: opts } : (opts || {});
  const cfg = toastConfig(o.severity);
  document.getElementById("appToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "appToast";
  toast.className = cfg.classe ? `app-toast ${cfg.classe}` : "app-toast";
  toast.setAttribute("role", cfg.role);
  // Texto puro: o CSS de privacidade não alcança um pedaço do textContent, então
  // o montante é substituído por "R$ •••" antes de chegar à tela.
  toast.textContent = maskMoneyText(message);
  // Aviso de 4-6s não pode virar estorvo: clicar fecha na hora.
  toast.addEventListener("click", () => toast.remove());
  // Dentro de showModal() o body fica ATRÁS do dialog no top layer — o toast é
  // pendurado no próprio modal aberto (o último, se houver pilha) para pintar
  // acima dele; position:fixed mantém o lugar na tela. Se o modal fechar antes
  // da duração, o toast morre junto — aceito.
  const host = [...document.querySelectorAll("dialog:modal")].at(-1) || document.body;
  host.appendChild(toast);
  setTimeout(() => toast.remove(), o.duration ?? cfg.duracao);
}
```

- [ ] **Step 4: CSS das severidades**

Em `styles.css`, logo após o fechamento do bloco `.app-toast` (linha ~681, antes do `@keyframes toast-in`):

```css
/* Severidade do toast (E3). A base verde é o visual histórico (info/success).
   Fundos sólidos fixos (não tokens): o texto é branco e o --red do tema dark
   (#f87171) é claro demais para fundo — o tom médio funciona nos dois temas. */
.app-toast.toast-warning {
  background: #b45309;
}

.app-toast.toast-error {
  background: #b42318;
}
```

- [ ] **Step 5: Validar sintaxe e rodar os testes**

Run: `node --check app.js && node scripts/tests/js/test_toast_severity.js && node scripts/tests/js/test_error_handler.js && node scripts/tests/js/test_privacy_coverage.js`
Expected: `test_toast_severity: 23/23 ok`; os outros dois seguem passando (o stub do error_handler recebe `(msg, dur)` e não afirma nada sobre `dur`).

- [ ] **Step 6: Commit**

```bash
git add app.js styles.css scripts/tests/js/test_toast_severity.js
git commit -m "feat(ui): showToast com severidade e visivel sobre modal (E3) + teste

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: E3 — `saveForm` troca os 11 `alert()` + carona no `reportGlobalError` + guarda

**Files:**
- Modify: `app.js` — corpo do `saveForm` (`async function saveForm`, linha ~8964) e `reportGlobalError` (linha ~34)
- Modify: `scripts/tests/js/test_toast_severity.js` (acrescentar as guardas no fim, antes do `console.log` final)

**Interfaces:**
- Consumes: `showToast(msg, { severity })` (Task 4).
- Produces: `saveForm` sem nenhum `alert(`; guarda automática que impede `alert(` de voltar ao `saveForm` e trava a severidade `error` no `reportGlobalError`.

- [ ] **Step 1: Acrescentar as guardas ao teste (e vê-las falhar)**

No fim de `scripts/tests/js/test_toast_severity.js`, antes do `console.log` final:

```js
// ── Guardas de regressão (E3 Fase 1) ────────────────────────────────────────
// saveForm nunca mais usa alert(): validação = warning, falha de gravação = error.
const sfIni = src.indexOf("async function saveForm");
const sfFim = src.indexOf("function validateCurrentForm");
t_assert("saveForm encontrado", sfIni >= 0 && sfFim > sfIni);
const saveFormCorpo = src.slice(sfIni, sfFim);
t_assert("saveForm não usa alert()", !/\balert\(/.test(saveFormCorpo));
t_assert("saveForm usa severidade warning", saveFormCorpo.includes('severity: "warning"'));
t_assert("saveForm usa severidade error na falha de gravar", saveFormCorpo.includes('severity: "error"'));
// O aviso de erro global (E1) usa a severidade error.
const rgIni = src.indexOf("function reportGlobalError");
const rgFim = src.indexOf("window.addEventListener", rgIni);
t_assert("reportGlobalError com severity error", src.slice(rgIni, rgFim).includes('severity: "error"'));
```

Run: `node scripts/tests/js/test_toast_severity.js`
Expected: FAIL nas 4 guardas novas (alert ainda presente; severidades ausentes).

- [ ] **Step 2: Editar o `saveForm` (11 trocas)**

As 10 validações viram `severity: "warning"` — trocas exatas (todas dentro de `async function saveForm`):

```js
// 1. if (!validation.ok) return alert(validation.message);
if (!validation.ok) return showToast(validation.message, { severity: "warning" });
// 2. if (kanbanError) return alert(kanbanError);
if (kanbanError) return showToast(kanbanError, { severity: "warning" });
// 3. if (viabilityError) return alert(viabilityError);
if (viabilityError) return showToast(viabilityError, { severity: "warning" });
// 4. if (!isValidPluginUrl(url)) return alert("Informe uma URL válida: ...");
if (!isValidPluginUrl(url)) return showToast("Informe uma URL válida: https://... ou caminho interno iniciando com / ou ./", { severity: "warning" });
// 5. if (firstError) return alert(firstError[1]);
if (firstError) return showToast(firstError[1], { severity: "warning" });
// 6. return alert("CPF já cadastrado para outro usuário.");
return showToast("CPF já cadastrado para outro usuário.", { severity: "warning" });
// 7. if (!pwdCheck.valid) return alert("Senha não atende aos critérios:\n• " + ...);
if (!pwdCheck.valid) return showToast("Senha não atende aos critérios:\n• " + pwdCheck.errors.join("\n• "), { severity: "warning" });
// 8. if (duplicate) return alert("Já existe um usuário com esse login.");
if (duplicate) return showToast("Já existe um usuário com esse login.", { severity: "warning" });
// 9. ... return alert("O administrador logado não pode remover o próprio perfil de administrador.");
if (sameId(editing.id, currentUser.id) && data.role !== "admin") return showToast("O administrador logado não pode remover o próprio perfil de administrador.", { severity: "warning" });
// 10. return alert("Mantenha ao menos um administrador ativo no sistema.");
return showToast("Mantenha ao menos um administrador ativo no sistema.", { severity: "warning" });
```

A falha de gravação (o catch, única com `severity: "error"`):

```js
// ANTES:  alert(`Não foi possível salvar: ${error.message}`);
// DEPOIS:
showToast(`Não foi possível salvar: ${error.message}`, { severity: "error" });
```

- [ ] **Step 3: Carona no `reportGlobalError` (E1)**

Dentro de `function reportGlobalError` (app.js:~34), trocar a chamada:

```js
// ANTES
showToast("Ocorreu um erro inesperado nesta tela. Se algo não carregou, recarregue a página (Ctrl+Shift+R).", 6000);
// DEPOIS (mesma duração — 6000 é o default de error)
showToast("Ocorreu um erro inesperado nesta tela. Se algo não carregou, recarregue a página (Ctrl+Shift+R).", { severity: "error" });
```

- [ ] **Step 4: Validar sintaxe e rodar os testes JS**

Run: `node --check app.js && node scripts/tests/js/test_toast_severity.js && node scripts/tests/js/test_error_handler.js`
Expected: `test_toast_severity: 28/28 ok`; `test_error_handler: 11/11 ok` (o stub aceita objeto no 2º argumento sem afirmar nada sobre ele).

- [ ] **Step 5: Commit**

```bash
git add app.js scripts/tests/js/test_toast_severity.js
git commit -m "feat(ui): saveForm troca alert() por toast com severidade (E3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Release v1.40.0 — versão, changelog, spec e suíte completa

**Files:**
- Modify: `app.js:96-98` (`APP_VERSION`, `APP_VERSION_DATE`, topo do `APP_CHANGELOG`)
- Modify: `index.html` (linhas 17 e 364: `?v=1809` → `?v=1810`; `theme-init.js?v=1722` fica)
- Modify: `README.md` (changelog), `CLAUDE.md` (cabeçalho), `STATUS.md` (linha de versão do topo)
- Modify: `docs/superpowers/specs/2026-07-31-onda-b-lote1-erros-design.md` (correção factual do `?v=`)

**Interfaces:**
- Consumes: tudo das Tasks 1-5 já commitado.
- Produces: release v1.40.0 pronta para push (quando o dono pedir).

- [ ] **Step 1: Versão e changelog no app.js**

```js
const APP_VERSION = "v1.40.0";
const APP_VERSION_DATE = "2026-07-31";
```

Nova entrada no TOPO do array `APP_CHANGELOG`:

```js
  "Mensagens de erro mais úteis (Onda B, lote 1): ao salvar um cadastro, os avisos deixaram de usar o pop-up do navegador e aparecem como aviso do próprio sistema — âmbar para dado faltando ou inválido, vermelho para falha de gravação — visível mesmo com o formulário aberto e fechável com um clique. E quando ocorrer um erro interno do servidor, a mensagem passa a trazer um código de suporte; o mesmo código fica gravado no log do servidor, então basta informar esse código para localizar a linha exata do problema, sem depender de horário ou de descrição do ocorrido (v1.40.0).",
```

- [ ] **Step 2: Cache busting no index.html**

Trocar `styles.css?v=1809` → `styles.css?v=1810` e `app.js?v=1809` → `app.js?v=1810`.

- [ ] **Step 3: Docs**

- `CLAUDE.md`: atualizar `**Versão atual:** \`v1.40.0\` · 2026-07-31` e acrescentar o bloco de release acima do da v1.39.1:

```markdown
> **v1.40.0 — Onda B Lote 1 (E3 toast com severidade + E4 código de correlação):** `showToast(message, opts)` aceita número (duração, compat) ou `{severity: info|success|warning|error, duration}`; mapa em **`toastConfig()`** (pura, testada); warning=4s/âmbar, error=6s/vermelho, `role=alert`; clique fecha; o toast é pendurado no **último `dialog:modal` aberto** (senão `body`) — filho do modal no top layer pinta ACIMA dele (antes ficava invisível atrás do `showModal()`). `saveForm` sem `alert()`: 10 validações = warning, catch de gravação = error (guarda em `test_toast_severity.js` impede regressão); `reportGlobalError` usa `{severity:"error"}`. **REGRA: em código novo, prefira `showToast` com severidade a `alert()`.** E4: **`obra_error_ref()`** (UUID v4 único por request, static) + **`apply_error_ref($message, $status)`** (pura; anexa `(código: <uuid>)` só em >=500) aplicados em `fail()` (+ campo `errorRef`) e nas 11 `*_respond`; os `error_log` dos catches de 500 logam `[ObraSync ctx][ref <uuid>]` — o código que o usuário reporta acha a linha do log via grep. 4xx não muda. Testes novos `test_error_ref.php` e `test_toast_severity.js`; suíte 14/14. Sem migration/schema. Cache: `?v=1810`.
```

- Atualizar também a linha de convenção do cache busting no `CLAUDE.md` (`hoje app.js?v=1810, styles.css?v=1810`).
- `README.md`: nova entrada de changelog no padrão do arquivo (mesma prosa do APP_CHANGELOG).
- `STATUS.md`: linha 3 → `> **Versão:** \`v1.40.0\` · 2026-07-31 · ...` (resto intacto).
- Spec `docs/superpowers/specs/2026-07-31-onda-b-lote1-erros-design.md`: corrigir `?v=\` 1802→1803` para `?v=\` 1809→1810` (a spec herdou número defasado do CLAUDE.md).

- [ ] **Step 4: Suíte completa**

Run: `php -l api/index.php && node --check app.js && bash scripts/tests/run-all.sh`
Expected: `SUITE: 14/14 blocos ok` (12 + test_error_ref + test_toast_severity).

- [ ] **Step 5: Commit**

```bash
git add app.js index.html README.md CLAUDE.md STATUS.md docs/superpowers/specs/2026-07-31-onda-b-lote1-erros-design.md
git commit -m "chore: release v1.40.0 (onda B lote 1 - E3 toast com severidade + E4 codigo de correlacao)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Validação em produção (pós-push, roteiro do dono)

1. Hard refresh (Ctrl+Shift+R) e conferir `v1.40.0` em Configurações → Versões.
2. Abrir um cadastro qualquer, salvar com campo obrigatório vazio → toast **âmbar acima do modal**; clicar fecha.
3. Salvar válido → gravação normal (toast não aparece; fluxo intacto).
4. E4: no próximo 500 real, conferir que a mensagem traz `(código: ...)` e que `grep <código> /var/lib/financeiro/logs/php-error.log` acha a linha. **Não** forçar 500 artificial.
