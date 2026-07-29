// Trava a regressão do 500 do Kanban (2026-07-28).
//
// Causa raiz: `kanban_cards.ordem` é INT (máx 2.147.483.647) e o frontend gravava
// Date.now() — milissegundos, ~1,78 trilhão, 831x o limite. O INSERT estourava com
// SQLSTATE 22003 que, por estar fora da classe 23000, não era convertido em
// resposta amigável e virava o 500 genérico do catch global.
//
// O teste verifica o app.js REAL: que o helper existe, que produz segundos, e que
// nenhum ponto voltou a gravar `ordem` em milissegundos.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..", "..", "..", "app.js");
const src = fs.readFileSync(APP, "utf8");

let ok = 0;
let falhas = 0;
function t_assert(nome, cond, detalhe) {
  if (cond) { ok++; return; }
  falhas++;
  console.error("  FALHA: " + nome + (detalhe ? "\n         " + detalhe : ""));
}

const MAX_INT_MYSQL = 2147483647;

// ── 1. O helper existe e devolve segundos ───────────────────────────────────
const ini = src.indexOf("function kanbanOrdemAgora()");
t_assert("helper kanbanOrdemAgora() existe no app.js", ini >= 0);

if (ini >= 0) {
  const fim = src.indexOf("}", src.indexOf("{", ini)) + 1;
  const sandbox = { Math, Date };
  vm.createContext(sandbox);
  vm.runInContext(src.slice(ini, fim), sandbox);
  const ordem = sandbox.kanbanOrdemAgora();

  t_assert("devolve número inteiro", Number.isInteger(ordem));
  t_assert(
    "cabe na coluna INT do MySQL",
    ordem > 0 && ordem <= MAX_INT_MYSQL,
    `valor ${ordem} vs máximo ${MAX_INT_MYSQL}`
  );
  t_assert(
    "está na escala de SEGUNDOS (não milissegundos)",
    Math.abs(ordem - Math.floor(Date.now() / 1000)) <= 2,
    `valor ${ordem}; em ms seria ${Date.now()}`
  );
  // Margem real até o estouro: o timestamp Unix em segundos só passa do INT em
  // janeiro/2038. Se este teste falhar, chegou a hora de migrar a coluna p/ BIGINT.
  t_assert(
    "ainda há folga até o limite do INT (Y2038)",
    ordem < MAX_INT_MYSQL,
    "coluna `ordem` precisa virar BIGINT"
  );
}

// ── 2. Nenhum ponto grava `ordem` em milissegundos ──────────────────────────
const linhas = src.split("\n");
const suspeitas = [];
linhas.forEach((l, i) => {
  if (/\bordem\b\s*[:=][^;,\n]*Date\.now\(\)/.test(l) && !l.trim().startsWith("//")) {
    suspeitas.push(`${i + 1}: ${l.trim().slice(0, 90)}`);
  }
});
t_assert(
  "nenhuma atribuição de `ordem` usa Date.now() direto",
  suspeitas.length === 0,
  suspeitas.join("\n         ")
);

console.log(`test_kanban_ordem: ${ok}/${ok + falhas} ok`);
process.exit(falhas ? 1 : 0);
