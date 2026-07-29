// Trava as correções do card que nascia no board errado (2026-07-29).
//
// Sintoma: card criado para a obra 7 foi gravado na coluna 1, que pertence ao
// board da obra 6 — o card existia no banco mas não aparecia na tela da obra.
//
// Duas causas, ambas cobertas aqui:
//   1. rowLabel() — o <select> de FK não reconhecia o campo `nome` (português),
//      então as colunas apareciam como ID cru e não havia como escolher certo.
//   2. normalizeKanbanCard() — não validava se a obra do card bate com a obra do
//      board dono da coluna.
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

// ── Banco de teste: 2 obras, 2 boards, 2 colunas ────────────────────────────
const db = {
  projects: [{ id: 6, name: "Residencial Atacama" }, { id: 7, name: "Recurso Federal Asilo" }],
  kanbanBoards: [
    { id: 1, nome: "Kanban - Residencial Atacama", obra_id: 6 },
    { id: 2, nome: "Kanban - Recurso Federal Asilo", obra_id: 7 },
    { id: 9, nome: "Board sem obra", obra_id: null },
  ],
  kanbanColumns: [
    { id: 1, nome: "A fazer", board_id: 1 },
    { id: 5, nome: "A fazer", board_id: 2 },
    { id: 9, nome: "Solta", board_id: 9 },
  ],
};

const sandbox = {
  db, Number, String, Math, Date, Map,
  sameId: (a, b) => String(a ?? "") === String(b ?? ""),
  byId: (col, id) => (db[col] || []).find((r) => String(r.id) === String(id)) || null,
  selectedKanbanBoardId: "",
  kanbanOrdemAgora: () => Math.floor(Date.now() / 1000),
};
vm.createContext(sandbox);

// Extrai as funções REAIS do app.js (não cópias).
for (const marca of [
  "function rowLabel(row) {",
  "function kanbanBoardDaColuna(colunaId) {",
  "function normalizeKanbanCard(data) {",
  "function kanbanBoardsPorObra() {",
  "function kanbanCardsFiltrados() {",
]) {
  const ini = src.indexOf(marca);
  if (ini < 0) { console.error("FALHA: não achei no app.js: " + marca); process.exit(1); }
  // Vai até a linha que fecha a função na coluna 0.
  const fim = src.indexOf("\n}", ini) + 2;
  vm.runInContext(src.slice(ini, fim), sandbox);
}
sandbox.nameOf = (col, id) => sandbox.rowLabel(sandbox.byId(col, id));

// ── rowLabel: o defeito que originou tudo ───────────────────────────────────
t_assert("rowLabel usa `nome` (pt) — era o campo ignorado no select", sandbox.rowLabel({ id: 1, nome: "A fazer" }) === "A fazer");
t_assert("rowLabel ainda prefere `name` (en)", sandbox.rowLabel({ id: 1, name: "To do", nome: "A fazer" }) === "To do");
t_assert("rowLabel usa `titulo`", sandbox.rowLabel({ id: 1, titulo: "Meu card" }) === "Meu card");
t_assert("rowLabel de registro sem rótulo devolve vazio (não quebra)", sandbox.rowLabel({ id: 1 }) === "");
t_assert("rowLabel de null devolve vazio", sandbox.rowLabel(null) === "");

// ── kanbanBoardDaColuna ─────────────────────────────────────────────────────
t_assert("acha o board dono da coluna", sandbox.kanbanBoardDaColuna(5)?.id === 2);
t_assert("coluna inexistente devolve null", sandbox.kanbanBoardDaColuna(999) === null);

// ── Coerência: o cenário exato do bug ───────────────────────────────────────
// Card da obra 7 na coluna 1 (board 1, obra 6) — tem de ser BLOQUEADO.
let erro = sandbox.normalizeKanbanCard({ coluna_id: 1, obra_id: 7, titulo: "Compras Tomadas" });
t_assert("bloqueia card da obra 7 em coluna do board da obra 6", erro !== "");
t_assert("a mensagem nomeia as duas obras envolvidas",
  erro.includes("Recurso Federal Asilo") && erro.includes("Residencial Atacama"), erro);

// Card coerente passa.
erro = sandbox.normalizeKanbanCard({ coluna_id: 5, obra_id: 7, titulo: "ok" });
t_assert("card coerente (obra 7, coluna do board da obra 7) passa", erro === "");

// Sem obra informada: herda a do board da coluna.
const semObra = { coluna_id: 5, obra_id: "", titulo: "herda" };
erro = sandbox.normalizeKanbanCard(semObra);
t_assert("sem obra informada, herda a obra do board da coluna", erro === "" && String(semObra.obra_id) === "7");

// Board sem obra não pode bloquear card nenhum.
erro = sandbox.normalizeKanbanCard({ coluna_id: 9, obra_id: 7, titulo: "board sem obra" });
t_assert("board sem obra não bloqueia", erro === "");

// ── Defaults preservados ────────────────────────────────────────────────────
const novo = { coluna_id: 5, obra_id: 7, titulo: "defaults" };
sandbox.normalizeKanbanCard(novo);
t_assert("prioridade default 'media'", novo.prioridade === "media");
t_assert("ordem preenchida em segundos (cabe no INT)", Number.isInteger(novo.ordem) && novo.ordem > 0 && novo.ordem <= 2147483647);

// ── Visão consolidada: agrupamento por obra e filtros ───────────────────────
sandbox.kanbanFiltros = { obra: "", responsavel: "", prioridade: "" };
db.kanbanCards = [
  { id: 1, coluna_id: 1, titulo: "A", prioridade: "alta", responsavel_id: 10 },   // board 1, obra 6
  { id: 2, coluna_id: 5, titulo: "B", prioridade: "media", responsavel_id: 11 },  // board 2, obra 7
  { id: 3, coluna_id: 5, titulo: "C", prioridade: "alta", responsavel_id: 10 },   // board 2, obra 7
  { id: 4, coluna_id: 9, titulo: "D", prioridade: "baixa", responsavel_id: 11 },  // board 9, sem obra
];

const grupos = sandbox.kanbanBoardsPorObra();
t_assert("agrupa boards por obra", grupos.length === 3);
t_assert("grupo 'Sem obra vinculada' vai para o fim", grupos[grupos.length - 1][0] === "Sem obra vinculada");
t_assert("obras ficam em ordem alfabética",
  grupos[0][0] === "Recurso Federal Asilo" && grupos[1][0] === "Residencial Atacama",
  grupos.map((g) => g[0]).join(" | "));

t_assert("sem filtro, traz todos os cards", sandbox.kanbanCardsFiltrados().length === 4);

sandbox.kanbanFiltros = { obra: 7, responsavel: "", prioridade: "" };
t_assert("filtro por obra usa o board da coluna (não o campo do card)",
  sandbox.kanbanCardsFiltrados().map((c) => c.id).join(",") === "2,3");

sandbox.kanbanFiltros = { obra: "", responsavel: 10, prioridade: "" };
t_assert("filtro por responsável", sandbox.kanbanCardsFiltrados().map((c) => c.id).join(",") === "1,3");

sandbox.kanbanFiltros = { obra: "", responsavel: "", prioridade: "alta" };
t_assert("filtro por prioridade", sandbox.kanbanCardsFiltrados().map((c) => c.id).join(",") === "1,3");

sandbox.kanbanFiltros = { obra: 7, responsavel: 10, prioridade: "alta" };
t_assert("filtros combinam (E, não OU)", sandbox.kanbanCardsFiltrados().map((c) => c.id).join(",") === "3");

sandbox.kanbanFiltros = { obra: 6, responsavel: 11, prioridade: "" };
t_assert("combinação sem resultado devolve lista vazia", sandbox.kanbanCardsFiltrados().length === 0);

// Card cuja prioridade não foi gravada conta como "media" (default do schema).
db.kanbanCards.push({ id: 5, coluna_id: 1, titulo: "E", responsavel_id: 10 });
sandbox.kanbanFiltros = { obra: "", responsavel: "", prioridade: "media" };
t_assert("prioridade ausente é tratada como 'media'",
  sandbox.kanbanCardsFiltrados().map((c) => c.id).join(",") === "2,5");

console.log(`test_kanban_coerencia: ${ok}/${ok + falhas} ok`);
process.exit(falhas ? 1 : 0);
