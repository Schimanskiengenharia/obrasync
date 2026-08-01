// Fix da dupla contagem (Conciliação E1): saída de caixa com referencia
// CONTA_PAGAR é a MESMA saída da conta paga que o realizedCost já soma.
// Extrai o bloco REAL do app.js (signedCashAmount + saidasCaixaSemTitulo).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..", "..", "..", "app.js");
const src = fs.readFileSync(APP, "utf8");
const ini = src.indexOf("function signedCashAmount");
const fim = src.indexOf("// Janela do fluxo de caixa");
if (ini < 0 || fim < 0 || fim < ini) {
  console.error("test_dedup_caixa: FALHA — bloco signedCashAmount/saidasCaixaSemTitulo não encontrado");
  process.exit(1);
}

const sandbox = { normalizedText: (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() };
vm.createContext(sandbox);
vm.runInContext(src.slice(ini, fim), sandbox);
const calc = sandbox.saidasCaixaSemTitulo;

let ok = 0;
let falhas = 0;
function t_assert(nome, cond) {
  if (cond) { ok++; return; }
  falhas++;
  console.error("  FALHA: " + nome);
}

t_assert("função extraída existe", typeof calc === "function");
t_assert("lista vazia = 0", calc([]) === 0);
t_assert("undefined = 0", calc(undefined) === 0);
t_assert("saída solta conta", calc([{ type: "Saída", amount: 100 }]) === 100);
t_assert("saída com CONTA_PAGAR + id NÃO conta", calc([{ type: "Saída", amount: 100, referencia_tipo: "CONTA_PAGAR", referencia_id: 5 }]) === 0);
t_assert("saída com CONTA_PAGAR sem id conta", calc([{ type: "Saída", amount: 100, referencia_tipo: "CONTA_PAGAR" }]) === 100);
t_assert("entrada nunca entra", calc([{ type: "Entrada", amount: 999 }]) === 0);
t_assert("transferência nunca entra", calc([{ type: "Transferência", amount: 999 }]) === 0);
t_assert("CONTA_RECEBER em saída não filtra (só CONTA_PAGAR deduplica saída)", calc([{ type: "Saída", amount: 50, referencia_tipo: "CONTA_RECEBER", referencia_id: 1 }]) === 50);
t_assert("mistura soma só as saídas sem título", calc([
  { type: "Saída", amount: 100 },
  { type: "Saída", amount: 40, referencia_tipo: "CONTA_PAGAR", referencia_id: 2 },
  { type: "Entrada", amount: 70 },
  { type: "Saída", amount: 25 },
]) === 125);

console.log(`test_dedup_caixa: ${ok}/${ok + falhas} ok`);
process.exit(falhas ? 1 : 0);
