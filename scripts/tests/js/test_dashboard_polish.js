// Primeiro teste do Dashboard — a tela mais usada do sistema não tinha nenhum.
//
// Cobre o polimento de 2026-07-29, exercitando as funções REAIS do app.js:
//   - kpiToneNumero: percentual chega ao kpi() como string formatada, então o tom
//     precisa vir do número original (margem negativa aparecia neutra).
//   - guarda do renderDashboard: é a primeira tela após o login; exceção ali
//     deixava a área de conteúdo em branco, que o usuário lê como "o sistema caiu".
//   - chartPanel: substitui o aria-label genérico dos gráficos pelo título real
//     (a mesma tela tinha dois "Gráfico de linha", indistinguíveis no leitor de tela).
//   - cabeçalhos de tabela com scope="col".
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

function extrair(marca, sandbox) {
  const ini = src.indexOf(marca);
  if (ini < 0) { console.error("FALHA: não achei no app.js: " + marca); process.exit(1); }
  const fim = src.indexOf("\n}", ini) + 2;
  vm.runInContext(src.slice(ini, fim), sandbox);
}

// ── kpiToneNumero ───────────────────────────────────────────────────────────
const s1 = { Number };
vm.createContext(s1);
extrair("function kpiToneNumero(n) {", s1);

t_assert("margem negativa vira 'negative'", s1.kpiToneNumero(-40) === "negative");
t_assert("margem positiva vira 'positive'", s1.kpiToneNumero(12.5) === "positive");
t_assert("zero fica sem tom", s1.kpiToneNumero(0) === "");
t_assert("string numérica também é classificada", s1.kpiToneNumero("-3") === "negative");
t_assert("valor não numérico não quebra nem inventa tom", s1.kpiToneNumero("—") === "");
t_assert("null não quebra", s1.kpiToneNumero(null) === "");
t_assert("Infinity não vira tom", s1.kpiToneNumero(Infinity) === "");

// ── Guarda do renderDashboard ───────────────────────────────────────────────
let html = "";
const s2 = {
  renderDashboardBody: () => { throw new Error("falha simulada no calculo"); },
  qs: () => ({ set innerHTML(v) { html = v; } }),
  escapeHtml: (x) => String(x),
  console: { error: () => {} },
};
vm.createContext(s2);
extrair("function renderDashboard() {", s2);

let propagou = false;
try { s2.renderDashboard(); } catch (_) { propagou = true; }
t_assert("exceção no corpo NÃO propaga (tela não fica em branco)", propagou === false);
t_assert("mostra mensagem ao usuário", /não foi possível/i.test(html), html.slice(0, 90));
t_assert("a mensagem inclui o motivo do erro", html.includes("falha simulada"));
t_assert("a mensagem orienta o que fazer", /recarregue/i.test(html));

// Caminho feliz: sem exceção, nada é escrito por cima do conteúdo.
html = "";
s2.renderDashboardBody = () => {};
s2.renderDashboard();
t_assert("sem erro, o guard não interfere", html === "");

// ── chartPanel: aria-label específico ───────────────────────────────────────
const s3 = { escapeHtml: (x) => String(x).replace(/"/g, "&quot;"), String };
vm.createContext(s3);
extrair("function chartPanel(title, subtitle, chart) {", s3);

const svgGenerico = '<svg viewBox="0 0 10 10" role="img" aria-label="Gráfico de linha"></svg>';
let saida = s3.chartPanel("Fluxo de caixa previsto x realizado", "sub", svgGenerico);
t_assert("título substitui o aria-label genérico",
  saida.includes('aria-label="Fluxo de caixa previsto x realizado"'), saida.slice(0, 140));
t_assert("o genérico não sobra", !saida.includes('aria-label="Gráfico de linha"'));

saida = s3.chartPanel("Resultado por obra", "sub",
  '<svg role="img" aria-label="Gráfico de barras"></svg>');
t_assert("funciona também para gráfico de barras", saida.includes('aria-label="Resultado por obra"'));

// Sem título, não quebra e mantém o que veio.
saida = s3.chartPanel("", "sub", svgGenerico);
t_assert("sem título, mantém o gráfico intacto", saida.includes('aria-label="Gráfico de linha"'));

// Gráfico sem aria-label nenhum passa incólume.
saida = s3.chartPanel("Titulo", "sub", "<div>tabela</div>");
t_assert("conteúdo sem aria-label passa sem alteração", saida.includes("<div>tabela</div>"));

// ── Acessibilidade da tabela ────────────────────────────────────────────────
t_assert("cabeçalhos de tabela usam scope=\"col\"",
  src.includes('<th scope="col">${labelFor(field)}</th>'));
t_assert("coluna de ações também tem scope", src.includes('<th scope="col">Ações</th>'));

// ── Regressão: o card de problema não pode ficar verde ──────────────────────
t_assert("\"Etapas atrasadas\" tem tom explícito (não herda o verde automático)",
  /\["Etapas atrasadas", metrics\.delayedStages, false, metrics\.delayedStages > 0 \? "negative"/.test(src));

console.log(`test_dashboard_polish: ${ok}/${ok + falhas} ok`);
process.exit(falhas ? 1 : 0);
