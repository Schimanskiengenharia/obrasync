// PBQP-H Nível B — front do módulo de qualidade (E1). Extrai funções puras do app.js
// real via vm e confere contratos de tela por inspeção da fonte.
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

// Extrai uma função de nível superior pelo nome (até a chave de fechamento na coluna 0).
function extrairFuncao(nome) {
  const i = src.indexOf("function " + nome + "(");
  if (i < 0) return null;
  const j = src.indexOf("\n}\n", i);
  return src.slice(i, j + 2);
}

// ── E1-PES: documento imprimível com bloco de aprovação ─────────────────────
const ctx = {
  db: { companySettings: [{ name: "Schimanski Engenharia" }] },
  svgText: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  asDate: (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : ""),
};
vm.createContext(ctx);
const fnPrint = extrairFuncao("qPesPrintHtml");
t_assert("qPesPrintHtml existe", !!fnPrint);
vm.runInContext(fnPrint + "\nthis.qPesPrintHtml = qPesPrintHtml;", ctx);

const html = ctx.qPesPrintHtml({
  servicoSiacId: 4, servicoNome: "Execução de fôrma", servicoGrupo: "Estrutura", versao: "1.0", status: "Vigente",
  objetivo: "Garantir fôrmas estanques", criteriosAceitacao: "Prumo ok\nEstanque\n", normasReferencia: "NBR 14931",
  responsavelElaboracao: "Eng. Ana", dataElaboracao: "2026-10-01", aprovadoPor: "Alef Schimanski", dataAprovacao: "2026-10-07", arquivoNome: "pes-forma.pdf",
});
t_assert("titulo com id, nome e versao", html.includes("PES 4 — Execução de fôrma — v1.0"));
t_assert("bloco Aprovado por / em vindo do registro", html.includes("Aprovado por:</strong> Alef Schimanski") && html.includes("em:</strong> 07/10/2026"));
t_assert("criterios viram lista numerada (itens da FVS)", html.includes("<ol><li>Prumo ok</li><li>Estanque</li></ol>"));
t_assert("PDF anexado citado", html.includes("PDF anexado: pes-forma.pdf"));
const htmlSem = ctx.qPesPrintHtml({ servicoSiacId: 1, servicoNome: "X", versao: "1.0", status: "Rascunho" });
t_assert("sem aprovacao mostra pendente, nao campo em branco para assinar a mao", htmlSem.includes("pendente (aprovação registrada ao tornar o PES Vigente)"));
const htmlXss = ctx.qPesPrintHtml({ servicoSiacId: 1, servicoNome: "<img src=x>", versao: "1", objetivo: "<script>", aprovadoPor: "<b>" });
t_assert("escape em nome, objetivo e aprovador", !htmlXss.includes("<img src=x>") && !htmlXss.includes("<script>") && !htmlXss.includes("<b>"));

// Tela do PES: sem input de aprovador (o backend preenche), com botao de impressao e colunas na lista.
const iPes = src.indexOf("function renderQualidadePes()");
const corpoPes = src.slice(iPes, src.indexOf("\n}\n", iPes));
t_assert("form do PES nao tem input para aprovadoPor", !/id="qPesAprovadoPor"|id="qPesDataAprovacao"/.test(corpoPes));
t_assert("form do PES mostra a aprovacao como texto", corpoPes.includes('id="qPesAprovacaoInfo"'));
t_assert("lista do PES mostra aprovadoPor e dataAprovacao", corpoPes.includes('"aprovadoPor", "dataAprovacao", "status"'));
t_assert("botao Exportar PDF por PES", corpoPes.includes("data-q-print-pes") && corpoPes.includes("qualidadePrint(qPesPrintHtml(pes))"));
t_assert("qSalvar do PES nao envia aprovadoPor", !/aprovadoPor:\s*qVal/.test(corpoPes));

console.log(`test_qualidade_front: ${ok}/${ok + falhas} ok`);
process.exit(falhas > 0 ? 1 : 0);
