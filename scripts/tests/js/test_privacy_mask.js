// Testa maskMoneyText() — a máscara de montantes em contextos de TEXTO PURO
// (toasts, <title> de SVG), onde o CSS de borrão não alcança.
//
// Desde a Etapa 2 do modo privacidade, TODO toast do sistema passa por ela, então
// uma regressão aqui vaza valor na tela com o modo privacidade ligado.
//
// Mesma estratégia do test_error_handler: extrai o bloco real do app.js e executa
// num contexto vm, para o teste não passar caso o código de produção quebre.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..", "..", "..", "app.js");
const src = fs.readFileSync(APP, "utf8");
const ini = src.indexOf("const MONEY_TEXT_RE");
const fim = src.indexOf("// Sincroniza body + botão da topbar");
if (ini < 0 || fim < 0) {
  console.error("test_privacy_mask: FALHA — bloco de maskMoneyText não encontrado no app.js");
  process.exit(1);
}

const sandbox = { String, privacyMode: true };
vm.createContext(sandbox);
vm.runInContext(src.slice(ini, fim), sandbox);
const mascarar = sandbox.maskMoneyText;

let ok = 0;
let falhas = 0;
function t_assert(nome, cond) {
  if (cond) { ok++; return; }
  falhas++;
  console.error("  FALHA: " + nome);
}

// Formato do Intl pt-BR: separador de milhar, decimal com vírgula.
t_assert("mascara valor simples", mascarar("Total: R$ 1.234,56") === "Total: R$ •••");
t_assert("mascara valor sem espaço", mascarar("Total: R$1.234,56") === "Total: R$ •••");
t_assert("mascara valor inteiro", mascarar("Total: R$ 500") === "Total: R$ •••");
t_assert("mascara centavos isolados", mascarar("R$ 0,99 apenas") === "R$ ••• apenas");

// O Intl usa espaço não-quebrável (U+00A0) entre "R$" e o número.
t_assert("mascara com espaço não-quebrável (U+00A0)", mascarar("Valor: R$ 1.000,00") === "Valor: R$ •••");

// Vários montantes na mesma mensagem (flag /g).
t_assert(
  "mascara múltiplos montantes",
  mascarar("De R$ 100,00 para R$ 250,50") === "De R$ ••• para R$ •••"
);

// Caso real: o toast de geração de conta a pagar das cotações.
t_assert(
  "mascara toast real de conta gerada",
  mascarar("Conta a pagar gerada: COT-12 · R$ 4.310,00.") === "Conta a pagar gerada: COT-12 · R$ •••."
);

// O que NÃO pode ser tocado: percentuais, contagens e datas seguem legíveis.
t_assert("preserva percentual", mascarar("Margem de 12,5%") === "Margem de 12,5%");
t_assert("preserva contagem", mascarar("3 contas vencidas") === "3 contas vencidas");
t_assert("preserva data", mascarar("Vence em 28/07/2026") === "Vence em 28/07/2026");
t_assert("preserva texto sem montante", mascarar("Salvo com sucesso.") === "Salvo com sucesso.");

// Entrada não-string não pode quebrar (showToast recebe o que o chamador passar).
t_assert("tolera número", mascarar(42) === "42");

// Com o modo DESLIGADO nada é mascarado — e o retorno é o próprio valor recebido.
sandbox.privacyMode = false;
t_assert("modo desligado não mascara", mascarar("Total: R$ 1.234,56") === "Total: R$ 1.234,56");

console.log(`test_privacy_mask: ${ok}/${ok + falhas} ok`);
process.exit(falhas ? 1 : 0);
