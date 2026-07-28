// Testa a captura global de erros JS (E1) do app.js.
//
// Estratégia: em vez de reescrever a lógica aqui (o teste passaria mesmo se o
// app.js quebrasse), extrai o BLOCO REAL do app.js e executa num contexto vm
// com stubs de console/document/showToast e o relógio sob controle — assim dá
// para verificar dedupe e cooldown sem esperar em tempo real.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..", "..", "..", "app.js");
const src = fs.readFileSync(APP, "utf8");
const ini = src.indexOf("const ERROR_TOAST_COOLDOWN_MS");
const fim = src.indexOf("// captura=true porque erro de carregamento");
if (ini < 0 || fim < 0) {
  console.error("test_error_handler: FALHA — bloco de captura de erros não encontrado no app.js");
  process.exit(1);
}

let agora = 1000000;
const toasts = [];
const avisos = [];
const sandbox = {
  APP_NAME: "ObraSync",
  Map,
  String,
  Date: { now: () => agora },
  document: { body: {} },
  showToast: (msg, dur) => toasts.push({ msg, dur }),
  console: { error: (...a) => avisos.push(a.join(" ")) },
};
vm.createContext(sandbox);
vm.runInContext(src.slice(ini, fim), sandbox);
const reportar = sandbox.reportGlobalError;

let ok = 0;
let falhas = 0;
function t_assert(nome, cond) {
  if (cond) { ok++; return; }
  falhas++;
  console.error("  FALHA: " + nome);
}

// Um erro novo avisa o usuário uma vez e sempre registra no console.
reportar("erro", "boom", "a.js:1");
t_assert("primeiro erro gera toast", toasts.length === 1);
t_assert("primeiro erro vai ao console", avisos.length === 1);

// Repetido dentro da janela: console sim, toast não (dedupe).
reportar("erro", "boom", "a.js:1");
t_assert("erro repetido não gera segundo toast", toasts.length === 1);
t_assert("erro repetido ainda vai ao console", avisos.length === 2);

// Erro diferente dentro do cooldown: segurado (rate limit).
reportar("erro", "outro problema", "b.js:9");
t_assert("erro novo dentro do cooldown não gera toast", toasts.length === 1);
t_assert("erro novo dentro do cooldown vai ao console", avisos.length === 3);

// Passado o cooldown, volta a avisar.
agora += 11 * 1000;
reportar("erro", "terceiro problema", "c.js:3");
t_assert("após o cooldown, erro novo gera toast", toasts.length === 2);

// Passada a janela de dedupe, o erro antigo volta a valer.
agora += 61 * 1000;
reportar("erro", "boom", "a.js:1");
t_assert("após a janela de dedupe, erro antigo volta a avisar", toasts.length === 3);

// Anti-loop: se o próprio showToast explodir, nada propaga.
sandbox.showToast = () => { throw new Error("toast quebrou"); };
agora += 61 * 1000;
let propagou = false;
try { reportar("erro", "falha dentro do handler", "d.js:1"); } catch (_) { propagou = true; }
t_assert("handler não propaga exceção do showToast", propagou === false);

// Erro antes do primeiro render: sem body, só console, sem quebrar.
sandbox.showToast = (msg, dur) => toasts.push({ msg, dur });
sandbox.document.body = null;
agora += 61 * 1000;
const antes = toasts.length;
let propagou2 = false;
try { reportar("erro", "erro pré-render", "e.js:1"); } catch (_) { propagou2 = true; }
t_assert("sem document.body não gera toast nem quebra", toasts.length === antes && !propagou2);

// O Map de assinaturas é podado — não cresce sem limite em sessão longa.
sandbox.document.body = {};
agora += 10 * 60 * 1000;
reportar("erro", "poda", "f.js:1");
t_assert("Map de assinaturas é podado", vm.runInContext("seenErrors.size", sandbox) <= 2);

console.log(`test_error_handler: ${ok}/${ok + falhas} ok`);
process.exit(falhas ? 1 : 0);
