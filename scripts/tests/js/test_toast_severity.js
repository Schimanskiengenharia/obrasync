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
