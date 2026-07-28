// Guarda das REGRAS do modo privacidade no app.js (Etapa 3).
//
// A distinção entre os três helpers é sutil e fácil de errar em código novo:
//   moneySpan(v)      → só em conteúdo HTML de TELA (injeta <span class="money-blur">)
//   maskMoneyText(t)  → texto puro: textContent, atributo HTML, <option>, título de SVG
//   asMoney(v)        → documento/export (PDF, impressão, Excel, texto gravado no banco)
//
// Usar moneySpan no lugar errado não quebra o build nem o lint — quebra a TELA
// (a tag aparece literal) ou vaza valor (o <span> some no textContent seguinte).
// Este teste trava exatamente esses erros.
const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "..", "..", "..", "app.js");
const src = fs.readFileSync(APP, "utf8");
const linhas = src.split("\n");

let ok = 0;
let falhas = 0;
function t_assert(nome, cond, detalhe) {
  if (cond) { ok++; return; }
  falhas++;
  console.error("  FALHA: " + nome + (detalhe ? "\n         " + detalhe : ""));
}

// ── 1. moneySpan nunca pode cair em contexto de texto puro ──────────────────
const proibidos = [
  [/\.textContent\s*=\s*[^;]*moneySpan\(/, "moneySpan atribuído a .textContent (a tag apareceria literal)"],
  [/(?:title|value|placeholder|alt|aria-label)\s*=\s*"[^"]*moneySpan\(/, "moneySpan dentro de atributo HTML"],
  [/(?:escapeHtml|svgText)\([^)]*moneySpan\(/, "moneySpan dentro de escapeHtml/svgText (a tag seria escapada)"],
  [/<option[^>]*>[^<]*moneySpan\(/, "moneySpan dentro de <option> (o parser descarta elementos filhos)"],
];
for (const [re, desc] of proibidos) {
  const achados = [];
  linhas.forEach((l, i) => { if (re.test(l)) achados.push(i + 1); });
  t_assert(desc, achados.length === 0, achados.length ? "linhas: " + achados.join(", ") : "");
}

// ── 2. Geradores de DOCUMENTO não podem usar moneySpan ──────────────────────
// PDF, impressão e texto gravado no banco mostram o valor sempre — borrar ali
// arruinaria o documento entregue ao cliente.
const documentos = [
  "proposalItemsHtml", "proposalInvestmentHtml", "proposalLicitacaoHtml",
  "proposalDisciplinasHtml", "proposalSinapiAnexoHtml", "proposalVariablesFor",
  "proposalItemsText", "groupedProposalItems", "contractPdfHtml",
  "buildContractObjeto", "openPurchaseOrderPrint", "savedProposalInternalHtml",
  "moneyToWords", "cotacaoImprimir",
];
for (const fn of documentos) {
  const ini = src.indexOf(`function ${fn}(`);
  if (ini < 0) { t_assert(`função ${fn} existe`, false, "não encontrada — renomeada?"); continue; }
  // Delimita pela próxima declaração de função no topo do arquivo (coluna 0).
  const resto = src.slice(ini + 1);
  const prox = resto.search(/\n(?:async )?function [A-Za-z_$]/);
  const corpo = prox < 0 ? resto : resto.slice(0, prox);
  t_assert(`${fn} (documento) não usa moneySpan`, !corpo.includes("moneySpan("));
}

// ── 3. Os helpers continuam existindo com a assinatura esperada ─────────────
t_assert("moneySpan definido", /function moneySpan\(/.test(src));
t_assert("maskMoneyText definido", /function maskMoneyText\(/.test(src));
t_assert("asMoney definido", /function asMoney\(/.test(src));
t_assert("moneySpan produz a classe money-blur", /function moneySpan\([^)]*\)\s*\{[^}]*money-blur/.test(src));

// ── 4. Nenhum `.catch` vazio voltou (regra do E2) ───────────────────────────
const catchVazio = [];
linhas.forEach((l, i) => {
  if (/\.catch\(\s*\(\s*[a-z_]*\s*\)\s*=>\s*\{\s*\}\s*\)/.test(l) && !l.trim().startsWith("//")) {
    catchVazio.push(i + 1);
  }
});
t_assert(
  "nenhum .catch vazio (use ignorarFalha/avisarFalha)",
  catchVazio.length === 0,
  catchVazio.length ? "linhas: " + catchVazio.join(", ") : ""
);

console.log(`test_privacy_coverage: ${ok}/${ok + falhas} ok`);
process.exit(falhas ? 1 : 0);
