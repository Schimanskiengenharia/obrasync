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

// ── E1-PQO: documento do PQO (vigente ou snapshot) e painel de histórico ───────
ctx.db.projects = [{ id: 7, name: "Condomínio Atacama" }];
ctx.db.qualidadePqoVersoes = [{ id: 1, pqoId: 3, versao: "1.0", statusAnterior: "Vigente", motivo: "Substituída pela v1.1", aprovadoPor: "RT", dataAprovacao: "2026-09-01", arquivadoPor: "Alef", arquivadoEm: "2026-10-07 10:00:00", snapshotJson: JSON.stringify({ projectId: 7, versao: "1.0", status: "Vigente", servicosControlados: "[4,5]", materiaisControlados: '[{"nome":"Cimento CP II","especificacao":"32","norma":"NBR 16697"}]' }) }];
ctx.byId = (col, id) => (ctx.db[col] || []).find((r) => String(r.id) === String(id));
ctx.sameId = (a, b) => String(a) === String(b);
ctx.escapeHtml = ctx.svgText;
ctx.qjson = (v, fb) => { try { return v ? JSON.parse(v) : fb; } catch { return fb; } };
ctx.servicoSiac = (id) => ({ 4: { nome: "Execução de fôrma" }, 5: { nome: "Montagem de armadura" } }[id]);
ctx.qPesVigente = (id) => (id === 4 ? { versao: "1.0" } : null);
vm.runInContext(extrairFuncao("qPqoPrintHtml") + "\n" + extrairFuncao("qPqoHistoricoHtml") + "\nthis.qPqoPrintHtml = qPqoPrintHtml; this.qPqoHistoricoHtml = qPqoHistoricoHtml;", ctx);

const pqo = { id: 3, projectId: 7, versao: "1.1", status: "Vigente", responsavelTecnico: "Eng. RT", crea: "123", servicosControlados: "[4,5]", materiaisControlados: '[{"nome":"Cimento CP II"}]', aprovadoPor: "Dir.", dataAprovacao: "2026-10-05" };
const hPqo = ctx.qPqoPrintHtml(pqo);
t_assert("PQO vigente: titulo com versao e obra", hPqo.includes("Plano da Qualidade da Obra — v1.1") && hPqo.includes("Obra: Condomínio Atacama"));
t_assert("PQO vigente: servicos com PES vigente marcado", hPqo.includes("4 — Execução de fôrma (PES v1.0)") && hPqo.includes("5 — Montagem de armadura (sem PES vigente)"));
t_assert("PQO vigente: sem carimbo de versao arquivada", !hPqo.includes("VERSÃO ARQUIVADA"));
const snap = ctx.qjson(ctx.db.qualidadePqoVersoes[0].snapshotJson, null);
const hSnap = ctx.qPqoPrintHtml(snap, { historico: ctx.db.qualidadePqoVersoes[0] });
t_assert("snapshot imprime a versao antiga com carimbo", hSnap.includes("— v1.0") && hSnap.includes("VERSÃO ARQUIVADA") && hSnap.includes("Substituída pela v1.1") && hSnap.includes("arquivada por Alef"));
t_assert("snapshot preserva materiais da epoca", hSnap.includes("Cimento CP II") && hSnap.includes("NBR 16697"));
const painel = ctx.qPqoHistoricoHtml([pqo]);
t_assert("painel de historico lista a versao com botao de impressao", painel.includes("Histórico de versões") && painel.includes('data-q-print-pqo-versao="1"') && painel.includes("v1.0 (Vigente)"));
t_assert("painel vazio sem historico", ctx.qPqoHistoricoHtml([{ id: 99, projectId: 7, versao: "1.0" }]) === "");
const iPqo = src.indexOf("function renderQualidadePqo()");
const corpoPqo = src.slice(iPqo, src.indexOf("\n}\n", iPqo));
t_assert("tela do PQO usa qPqoPrintHtml e inclui o historico", corpoPqo.includes("qualidadePrint(qPqoPrintHtml(pqo))") && corpoPqo.includes("${qPqoHistoricoHtml(rows)}"));

// ── E1-caronas: checklist com 9.1.x, versão da Política sem NaN, permissões ────
const ctx2 = {};
vm.createContext(ctx2);
const iCk = src.indexOf("const CHECKLIST_SIAC_NIVEL_B = [");
const fCk = src.indexOf("];", iCk) + 2;
vm.runInContext(src.slice(iCk, fCk) + "\nthis.CK = CHECKLIST_SIAC_NIVEL_B;", ctx2);
const clausulas = ctx2.CK.map((c) => c.clausula);
t_assert("checklist tem 9.1.1, 9.1.2 e 9.1.3", ["9.1.1", "9.1.2", "9.1.3"].every((c) => clausulas.includes(c)));
t_assert("9.1.x vem entre 8.7 e 9.2 (ordem das clausulas)", clausulas.indexOf("8.7") < clausulas.indexOf("9.1.1") && clausulas.indexOf("9.1.3") < clausulas.indexOf("9.2"));
t_assert("checklist sem clausula duplicada", new Set(clausulas).size === clausulas.length);
t_assert("26 clausulas no total", clausulas.length === 26);

vm.runInContext(extrairFuncao("qProximaVersao") + "\nthis.qProximaVersao = qProximaVersao;", ctx2);
t_assert("1.0 -> 1.1", ctx2.qProximaVersao("1.0") === "1.1");
t_assert("2.3 -> 2.4", ctx2.qProximaVersao("2.3") === "2.4");
t_assert("versao nao numerica: fallback 1 -> 1.1 (sem NaN)", ctx2.qProximaVersao("v2") === "1.1" && ctx2.qProximaVersao("") === "1.1" && ctx2.qProximaVersao(undefined) === "1.1");
t_assert("tela da Politica usa qProximaVersao", src.includes("qProximaVersao(vigente.versao)") && !src.includes("(parseFloat(vigente.versao) + 0.1)"));

const ctx3 = {};
vm.createContext(ctx3);
const iM = src.indexOf("const modules = [");
const fM = src.indexOf("const moduleLabels = Object.fromEntries(modules);");
vm.runInContext(src.slice(iM, fM) + "\nthis.r = roleModules; this.e = EDITABLE_BY_ROLE;", ctx3);
for (const papel of ["engenharia", "gestor_obra"]) {
  t_assert(papel + " ve qualidadePolitica e qualidadeAuditorias", ctx3.r[papel].includes("qualidadePolitica") && ctx3.r[papel].includes("qualidadeAuditorias"));
  t_assert(papel + " nao edita Politica/Auditorias", !ctx3.e[papel].includes("qualidadePolitica") && !ctx3.e[papel].includes("qualidadeAuditorias"));
}
for (const [papel, mods] of Object.entries(ctx3.e)) {
  if (papel === "gerente") continue;
  for (const m of mods) {
    if (m.startsWith("qualidade")) t_assert(`${papel}: edit em ${m} implica view (front)`, ctx3.r[papel].includes(m));
  }
}

console.log(`test_qualidade_front: ${ok}/${ok + falhas} ok`);
process.exit(falhas > 0 ? 1 : 0);
