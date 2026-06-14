const STORE_KEY = "finconta.v1";
const AUTH_KEY = "finconta.auth";
const AUTH_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_WARN_BEFORE_MS = 5 * 60 * 1000;
const API_BASE = (() => {
  const dir = location.pathname.replace(/\/[^/]*$/, '') || '/';
  return location.origin + dir + '/api';
})();
// Ambiente de execução: "file" (arquivo aberto direto), "local" (desenvolvimento) ou "production".
const APP_ENV = (() => {
  if (location.protocol === "file:") return "file";
  if (["localhost", "127.0.0.1", "::1"].includes(location.hostname)) return "local";
  return "production";
})();
// Bypass de login é recurso exclusivo de desenvolvimento: nunca vale em produção e,
// mesmo em desenvolvimento, só se aplica quando a API não está ativa (modo localStorage).
const AUTH_BYPASS_FOR_TESTS = APP_ENV !== "production";
if (APP_ENV === "production" && location.protocol === "http:") {
  location.replace(location.href.replace(/^http:/, "https:"));
}
const APP_NAME = "ObraSync";
const APP_VERSION = "v1.11.0";
const APP_VERSION_DATE = "2026-06-13";
const APP_CHANGELOG = [
  "Controle interno de versão e instruções de atualização segura.",
  "Perfis e permissões preparados por módulo e ação.",
  "Obras/projetos fortalecidos como eixo de vínculos comerciais, financeiros e técnicos.",
  "Módulo de propostas comerciais com área, tipo de atuação, subtipo e modelos editáveis.",
  "Cronograma físico-financeiro por obra, marcos, Gantt simplificado e WhatsApp manual.",
  "Responsividade reforçada para celular, tablet, notebook, desktop e telas grandes.",
  "Identidade visual ObraSync e revisão de integração entre obras, financeiro, comercial, contabilidade e API.",
  "Orçamentos de obras com base SINAPI, composições próprias, cotações, Curva ABC e integração inicial com Microsoft Project.",
  "Estruturas editáveis pelo administrador: tipos de obra, etapas padrão, campos personalizados, checklists, modelos e mensagens.",
  "Gerador de proposta comercial a partir de orçamento de obra, com modelo editável, variáveis dinâmicas, itens do orçamento e impressão/PDF A4.",
  "Importador SINAPI 04/2026 preparado para XLSX/CSV, UF padrão MS, manutenções, mão de obra, famílias/coeficientes e configuração de propostas SINAPI.",
  "Autenticação por token na API com autorização por rota e perfil, tratamento de respostas inválidas, blindagem do armazenamento local, validação de datas nos filtros e escape padrão de HTML no CRUD.",
  "Agenda e Kanban integrados às obras (v1.9.0).",
  "Importador SINAPI assíncrono via worker em fila (sinapi_import_jobs), com prévia e acompanhamento de progresso (v1.9.0).",
  "Módulo PBQP-H Nível B: PQO, PES, FVS, FVM, NC, Treinamentos, Auditoria e Dashboard, integrado ao cronograma (v1.9.0).",
  "Sistema de plugins (system_plugins) e plugin de Estudo de Seletividade com estudos salvos no banco e PDF técnico ABNT (v1.9.0).",
  "Análises de viabilidade (viability_analyses) com histórico de parecer (v1.9.0).",
  "Endurecimento de segurança: rate limit de login/reset, sem enumeração de e-mail, TTL absoluto de sessão (12 h), audit_log server-side, CSP/HSTS, tokens fora das URLs (v1.9.0).",
  "Conciliação bancária OFX multi-banco: parser, controle de duplicatas por FITID (ofx_imports/ofx_fitids), prévia, match automático por valor+data e baixa automática de contas a pagar/receber (v1.10.0).",
  "Importação de XML NFS-e (padrão ABRASF): leitura automática, prévia em lote, criação de Contas a Receber (emitidas) e a Pagar (recebidas) vinculadas à obra (v1.11.0).",
  "Criação automática de cliente/fornecedor a partir do XML NFS-e durante a importação, com dados de nome, CNPJ/CPF, endereço, e-mail e telefone (v1.11.0).",
];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
document.title = APP_NAME;

const modules = [
  ["dashboard", "Dashboard ObraSync"],
  ["clients", "Clientes"],
  ["suppliers", "Fornecedores"],
  ["products", "Produtos"],
  ["services", "Serviços"],
  ["categories", "Categorias financeiras"],
  ["costCenters", "Centros de custo"],
  ["bankAccounts", "Contas bancárias"],
  ["projects", "Obras/Projetos"],
  ["projectCosts", "Custos por obra"],
  ["projectRevenues", "Receitas por obra"],
  ["workBudgets", "Orçamentos de Obras"],
  ["workBudgetItems", "Itens do orçamento"],
  ["sinapiReferences", "Base SINAPI"],
  ["sinapiInputs", "Insumos SINAPI"],
  ["sinapiCompositions", "Composições SINAPI"],
  ["sinapiCompositionItems", "Itens das composições SINAPI"],
  ["sinapiLabor", "Mão de obra SINAPI"],
  ["sinapiFamilies", "Famílias e coeficientes"],
  ["sinapiMaintenances", "Manutenções SINAPI"],
  ["ownCompositions", "Composições Próprias"],
  ["quotes", "Cotações"],
  ["abcCurve", "Curva ABC"],
  ["fiscalDocuments", "Notas Fiscais / Documentos Fiscais"],
  ["rdo", "Diário de Obra (RDO)"],
  ["projectReport", "Relatório por obra"],
  ["qualidadeDashboard", "Dashboard Qualidade"],
  ["qualidadePolitica", "Política da Qualidade"],
  ["qualidadePes", "Procedimentos (PES)"],
  ["qualidadePqo", "Plano da Obra (PQO)"],
  ["qualidadeFvs", "Fichas de Serviço (FVS)"],
  ["qualidadeFvm", "Fichas de Material (FVM)"],
  ["qualidadeNc", "Não Conformidades (NC)"],
  ["qualidadeTreinamentos", "Treinamentos"],
  ["qualidadeAuditorias", "Auditorias Internas"],
  ["receivable", "Contas a receber"],
  ["payable", "Contas a pagar"],
  ["cashMoves", "Movimentações de caixa"],
  ["cashFlow", "Fluxo de caixa"],
  ["reconciliation", "Conciliação bancária"],
  ["budgets", "Orçamentos"],
  ["proposals", "Propostas"],
  ["proposalItems", "Itens da proposta"],
  ["proposalStatusHistory", "Histórico de status da proposta"],
  ["proposalFiles", "Arquivos da proposta"],
  ["proposalBudgetLinks", "Vínculos proposta-orçamento"],
  ["proposalVariables", "Variáveis da proposta"],
  ["proposalModels", "Modelos de propostas"],
  ["proposalAreas", "Áreas/Disciplinas"],
  ["proposalActionTypes", "Tipos de atuação"],
  ["proposalServiceSubtypes", "Subtipos/Serviços"],
  ["sales", "Vendas/Contratos"],
  ["viabilityAnalyses", "Análise de Viabilidade"],
  ["purchaseOrders", "Pedidos de compra"],
  ["projectSchedule", "Cronograma Físico-Financeiro"],
  ["projectMilestones", "Marcos da obra"],
  ["agenda", "Agenda"],
  ["kanban", "Kanban"],
  ["auditLog", "Log de Auditoria"],
  ["myProfile", "Meu Perfil"],
  ["projectNotifications", "Notificações da obra"],
  ["projectTrackingLinks", "Links de acompanhamento"],
  ["technicalReports", "Relatórios técnicos"],
  ["chartAccounts", "Plano de contas"],
  ["journalEntries", "Lançamentos contábeis"],
  ["dre", "DRE gerencial"],
  ["taxDocuments", "Documentos fiscais"],
  ["taxes", "Impostos"],
  ["reports", "Relatórios"],
  ["reportFinancial", "Relatório financeiro"],
  ["reportClient", "Relatório por cliente"],
  ["reportSupplier", "Relatório por fornecedor"],
  ["reportCostCenter", "Relatório por centro de custo"],
  ["reportProject", "Relatório por obra/projeto"],
  ["exports", "Exportações"],
  ["companySettings", "Dados da empresa"],
  ["users", "Usuários"],
  ["permissions", "Permissões"],
  ["systemVersion", "Versão do Sistema"],
  ["workTypes", "Tipos de obra"],
  ["workStatuses", "Status de obra"],
  ["standardStages", "Etapas padrão"],
  ["standardMilestones", "Marcos padrão"],
  ["customFields", "Campos personalizados"],
  ["customFieldValues", "Valores personalizados"],
  ["reportModels", "Modelos de relatório"],
  ["documentTypes", "Tipos de documento"],
  ["checklists", "Checklists"],
  ["checklistItems", "Itens de checklist"],
  ["measurementTypes", "Tipos de medição"],
  ["paymentMethods", "Formas de pagamento"],
  ["whatsappTemplates", "Mensagens padrão"],
  ["visibilityRules", "Regras de visualização"],
  ["sinapiSettings", "Configuração SINAPI"],
  ["plugins", "Plugins"],
  ["backupLocal", "Backup local"],
  ["preferences", "Preferências do sistema"],
  ["migration", "Migração para banco"],
];

// Navegação lateral organizada pelo fluxo de trabalho da empresa:
// Dashboard → Cadastros → Comercial → Viabilidade → Obras → Orçamento de Obra
// → Planejamento → Financeiro → Contabilidade → Relatórios → Configurações.
const sidebarSections = [
  { id: "dashboard", label: "Dashboard", icon: "D", module: "dashboard" },
  { id: "cadastros", label: "Cadastros", icon: "C", modules: ["clients", "suppliers", "products", "services", "categories", "costCenters", "bankAccounts"] },
  { id: "comercial", label: "Comercial", icon: "V", modules: ["budgets", "proposals", "proposalModels", "proposalAreas", "proposalActionTypes", "proposalServiceSubtypes", "sales"] },
  { id: "viabilidade", label: "Viabilidade", icon: "%", modules: ["viabilityAnalyses"] },
  { id: "obras", label: "Obras/Projetos", icon: "O", modules: ["projects", "projectCosts", "projectRevenues", "fiscalDocuments", "rdo", "projectNotifications", "projectTrackingLinks", "projectReport"] },
  { id: "qualidadePbqph", label: "Qualidade PBQP-H", icon: "✅", modules: ["qualidadeDashboard", "qualidadePolitica", "qualidadePes", "qualidadePqo", "qualidadeFvs", "qualidadeFvm", "qualidadeNc", "qualidadeTreinamentos", "qualidadeAuditorias"] },
  { id: "orcamentoObra", label: "Orçamento de Obra", icon: "Σ", modules: ["workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "ownCompositions", "quotes", "abcCurve", "purchaseOrders"] },
  { id: "planejamento", label: "Planejamento", icon: "P", modules: ["projectSchedule", "projectMilestones", "agenda", "kanban", "technicalReports"] },
  { id: "financeiro", label: "Financeiro", icon: "$", modules: ["receivable", "payable", "cashMoves", "cashFlow", "reconciliation"] },
  { id: "contabilidade", label: "Contabilidade Gerencial", icon: "L", modules: ["chartAccounts", "journalEntries", "dre", "taxDocuments", "taxes"] },
  { id: "relatorios", label: "Relatórios", icon: "R", modules: ["reports", "reportFinancial", "reportClient", "reportSupplier", "reportCostCenter", "reportProject", "exports"] },
  // Lançador de plugins: itens dinâmicos vindos de db.plugins, abertos em nova aba.
  { id: "pluginsLauncher", label: "Plugins", icon: "⚡", pluginLauncher: true },
  { id: "config", label: "Configurações", icon: "S", modules: ["companySettings", "users", "permissions", "systemVersion", "workTypes", "workStatuses", "standardStages", "standardMilestones", "customFields", "reportModels", "documentTypes", "checklists", "measurementTypes", "paymentMethods", "whatsappTemplates", "visibilityRules", "sinapiSettings", "plugins", "backupLocal", "preferences", "migration", "auditLog", "myProfile"] },
];

const roleLabels = {
  admin: "Administrador",
  financeiro: "Financeiro",
  comercial: "Comercial",
  engenharia: "Engenharia/Técnico/Gestor de obra",
  gestor_obra: "Gestor de obra",
  equipe_campo: "Equipe de campo",
  cliente_obra: "Cliente/Dono da obra",
  fornecedor_terceiro: "Fornecedor/Terceiro",
  consulta: "Consulta",
  gerente: "Gerente",
  operador: "Operador",
  visualizador: "Visualizador",
};

const roleModules = {
  admin: modules.map(([key]) => key),
  financeiro: [
    "dashboard", "clients", "suppliers", "categories", "costCenters", "bankAccounts", "projects", "projectSchedule", "agenda", "kanban",
    "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "sinapiSettings", "ownCompositions", "quotes", "abcCurve", "viabilityAnalyses",
    "fiscalDocuments", "receivable", "payable", "cashMoves", "cashFlow", "reconciliation",
    "proposals", "sales", "chartAccounts", "journalEntries", "dre", "taxDocuments", "taxes",
    "reports", "reportFinancial", "reportClient", "reportSupplier", "reportCostCenter", "reportProject", "exports", "systemVersion", "qualidadeDashboard",
  ],
  comercial: ["dashboard", "clients", "projects", "projectSchedule", "agenda", "kanban", "workBudgets", "abcCurve", "viabilityAnalyses", "budgets", "proposals", "proposalModels", "sales", "reportClient", "systemVersion"],
  engenharia: ["dashboard", "rdo", "projects", "projectSchedule", "projectMilestones", "agenda", "kanban", "projectNotifications", "projectTrackingLinks", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "ownCompositions", "quotes", "abcCurve", "viabilityAnalyses", "purchaseOrders", "fiscalDocuments", "technicalReports", "projectReport", "proposals", "reportProject", "systemVersion", "qualidadeDashboard", "qualidadePes", "qualidadePqo", "qualidadeFvs", "qualidadeFvm", "qualidadeNc", "qualidadeTreinamentos"],
  gestor_obra: ["dashboard", "rdo", "projects", "projectSchedule", "projectMilestones", "agenda", "kanban", "projectNotifications", "projectTrackingLinks", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "ownCompositions", "quotes", "abcCurve", "viabilityAnalyses", "purchaseOrders", "fiscalDocuments", "technicalReports", "projectReport", "proposals", "reportProject", "systemVersion", "qualidadeDashboard", "qualidadePes", "qualidadePqo", "qualidadeFvs", "qualidadeFvm", "qualidadeNc", "qualidadeTreinamentos"],
  equipe_campo: ["dashboard", "projectReport", "systemVersion"],
  cliente_obra: ["dashboard", "projectReport", "projectSchedule", "technicalReports", "systemVersion"],
  fornecedor_terceiro: ["dashboard", "systemVersion"],
  consulta: ["dashboard", "projectReport", "cashFlow", "dre", "reports", "reportFinancial", "reportClient", "reportSupplier", "reportCostCenter", "reportProject", "exports", "qualidadeDashboard"],
  gerente: modules.map(([key]) => key).filter((k) => !["users", "permissions"].includes(k)),
  operador: ["dashboard", "rdo", "clients", "suppliers", "products", "services", "categories", "costCenters", "bankAccounts", "projects", "projectCosts", "projectRevenues", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "ownCompositions", "quotes", "abcCurve", "fiscalDocuments", "receivable", "payable", "cashMoves", "cashFlow", "reconciliation", "budgets", "proposals", "sales", "purchaseOrders", "projectSchedule", "projectMilestones", "agenda", "kanban", "projectReport", "reports", "reportFinancial", "reportClient", "reportSupplier", "reportCostCenter", "reportProject", "myProfile", "qualidadeDashboard", "qualidadeFvs", "qualidadeFvm", "qualidadeNc"],
  visualizador: modules.map(([key]) => key),
};

// Mutação por papel (espelho de default_role_edit_modules no servidor). Fonte
// única, reusada por canEditModule e pelo cálculo do padrão na grade de
// permissões por usuário.
const EDITABLE_BY_ROLE = {
  financeiro: ["fiscalDocuments", "receivable", "payable", "cashMoves", "cashFlow", "reconciliation", "categories", "costCenters", "bankAccounts", "chartAccounts", "journalEntries", "taxDocuments", "taxes", "exports", "projectSchedule", "agenda", "kanban", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "sinapiSettings", "quotes", "sales", "viabilityAnalyses"],
  comercial: ["clients", "budgets", "proposals", "agenda", "kanban", "viabilityAnalyses"],
  engenharia: ["rdo", "projects", "projectSchedule", "projectMilestones", "agenda", "kanban", "projectNotifications", "projectTrackingLinks", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "ownCompositions", "quotes", "purchaseOrders", "fiscalDocuments", "technicalReports", "qualidadePes", "qualidadePqo", "qualidadeFvs", "qualidadeFvm", "qualidadeNc", "qualidadeTreinamentos"],
  gestor_obra: ["rdo", "projects", "projectSchedule", "projectMilestones", "agenda", "kanban", "projectNotifications", "projectTrackingLinks", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "ownCompositions", "quotes", "purchaseOrders", "fiscalDocuments", "technicalReports", "qualidadePes", "qualidadePqo", "qualidadeFvs", "qualidadeFvm", "qualidadeNc", "qualidadeTreinamentos"],
  gerente: modules.map(([k]) => k).filter((k) => !["users", "permissions"].includes(k)),
  operador: ["rdo", "clients", "suppliers", "products", "services", "categories", "costCenters", "bankAccounts", "projects", "projectCosts", "projectRevenues", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "ownCompositions", "quotes", "fiscalDocuments", "receivable", "payable", "cashMoves", "reconciliation", "budgets", "proposals", "sales", "purchaseOrders", "projectSchedule", "projectMilestones", "agenda", "kanban", "qualidadeFvs", "qualidadeFvm", "qualidadeNc"],
};

const moduleLabels = Object.fromEntries(modules);
const openNavGroups = new Set();

// Leitura/escrita tolerantes de localStorage (modo privado, quota ou armazenamento bloqueado).
function safeLocalGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem armazenamento disponível: o dado vale apenas para a sessão atual.
  }
}

// ── Tema (claro / escuro / automático) ──────────────────────────────────────
// O tema efetivo já foi aplicado pelo script inline do index.html antes do
// primeiro paint; aqui ficam a troca em tempo real e a persistência por usuário.

const THEME_KEY = "finconta.theme";
const themeMedia = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
let themePreference = document.documentElement.dataset.themePref || "auto";

function themeStorageKey() {
  return currentUser?.id ? `${THEME_KEY}.${currentUser.id}` : THEME_KEY;
}

function effectiveTheme(pref) {
  if (pref === "dark" || pref === "light") return pref;
  return themeMedia?.matches ? "dark" : "light";
}

function applyThemePreference(pref, persist = true) {
  themePreference = ["light", "dark", "auto"].includes(pref) ? pref : "auto";
  // Fade suave na troca de tema (o prefers-reduced-motion do CSS sobrepõe
  // esta transição inline com !important quando o usuário pede menos movimento).
  document.documentElement.style.transition = "background-color 0.35s ease, color 0.35s ease";
  document.documentElement.dataset.theme = effectiveTheme(themePreference);
  document.documentElement.dataset.themePref = themePreference;
  setTimeout(() => {
    document.documentElement.style.transition = "";
  }, 400);
  if (persist) {
    safeLocalSet(themeStorageKey(), themePreference);
    // Último tema usado: aplicado antes do login (script inline do index.html).
    safeLocalSet(THEME_KEY, themePreference);
  }
  syncThemeSwitches();
}

// Restaura a preferência salva do usuário logado (com fallback no último tema usado).
function loadUserThemePreference() {
  const saved = safeLocalGet(themeStorageKey()) || safeLocalGet(THEME_KEY) || "auto";
  applyThemePreference(saved, false);
}

function themeSwitchButtonsHtml() {
  const options = [
    ["light", "☀️", "Tema claro"],
    ["dark", "🌙", "Tema escuro"],
    ["auto", "💻", "Automático (segue o sistema operacional)"],
  ];
  return options.map(([value, icon, label]) => `
    <button type="button" class="theme-btn ${themePreference === value ? "active" : ""}" data-theme-pref="${value}"
      title="${label}" aria-label="${label}" aria-pressed="${themePreference === value}">${icon}</button>
  `).join("");
}

function syncThemeSwitches() {
  document.querySelectorAll(".theme-btn").forEach((button) => {
    const active = button.dataset.themePref === themePreference;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function wireThemeSwitch(rootEl) {
  rootEl.querySelectorAll("[data-theme-pref]").forEach((button) => {
    button.addEventListener("click", () => applyThemePreference(button.dataset.themePref));
  });
}

function setupThemeSwitch() {
  const host = document.getElementById("themeSwitch");
  if (host) {
    host.innerHTML = themeSwitchButtonsHtml();
    wireThemeSwitch(host);
  }
  // Modo automático: acompanha mudanças do tema do SO em tempo real.
  themeMedia?.addEventListener?.("change", () => {
    if (themePreference === "auto") applyThemePreference("auto", false);
  });
}

let sidebarCollapsed = safeLocalGet("finconta.sidebarCollapsed") === "true";
let serverMode = false;
let serverStatus = "Conectando ao servidor";
let authToken = null;
let dashboardViewMode = "general";
let dashboardProjectId = "";
let selectedWorkBudgetId = "";
let sinapiSearchTerm = "";
let sinapiSourceFilter = "all";
let sinapiUfFilter = "MS";
let sinapiTypeFilter = "all";
let sinapiLastImportHtml = "";
let sinapiJobPollTimer = null;
let sinapiJobPollSeq = 0; // invalida correntes de polling antigas após re-render
let sinapiSearchFetchTimer = null;
let sinapiSearchLastFetched = ""; // último termo já buscado no servidor (evita repetição)
let proposalGeneratorState = null;
let agendaViewMode = "month";
let agendaCursorDate = agendaSafeDateString(new Date());
let agendaProjectFilter = "";
let agendaTypeFilter = "";
let selectedKanbanBoardId = "";
let agendaNewDate = "";
let viabilityProjectFilter = "";
let viabilityStatusFilter = "";
let viabilityVerdictFilter = "";
let agendaEditingId = "";
let kanbanNewColumnId = "";
let favoritesDialogSelections = new Set();
let sessionWarnTimer = null;
let sessionWarnIntervalId = null;
let currentModuleTracked = "";

const apiResources = {
  clients: "clientes",
  suppliers: "fornecedores",
  products: "produtos",
  services: "servicos",
  categories: "categorias",
  costCenters: "centros-custo",
  bankAccounts: "contas-bancarias",
  projects: "obras",
  workBudgets: "orcamentos-obras",
  workBudgetItems: "itens-orcamentos-obras",
  sinapiReferences: "sinapi-referencias",
  sinapiInputs: "sinapi-insumos",
  sinapiCompositions: "sinapi-composicoes",
  sinapiCompositionItems: "sinapi-composicao-itens",
  sinapiLabor: "sinapi-mao-de-obra",
  sinapiFamilies: "sinapi-familias-coeficientes",
  sinapiMaintenances: "sinapi-manutencoes",
  sinapiSettings: "sinapi-configuracoes",
  qualidadePolitica: "qualidade-politica",
  qualidadePes: "qualidade-pes",
  qualidadePqo: "qualidade-pqo",
  qualidadeFvs: "qualidade-fvs",
  qualidadeFvm: "qualidade-fvm",
  qualidadeNc: "qualidade-nc",
  qualidadeTreinamentos: "qualidade-treinamentos",
  qualidadeAuditorias: "qualidade-auditorias",
  ownCompositions: "composicoes-proprias",
  quotes: "cotacoes",
  fiscalDocuments: "notas-fiscais",
  budgets: "orcamentos",
  proposals: "propostas",
  proposalItems: "proposta-itens",
  proposalStatusHistory: "proposta-status-historico",
  proposalFiles: "proposta-arquivos",
  proposalBudgetLinks: "proposta-orcamento-vinculos",
  proposalVariables: "proposta-variaveis",
  proposalModels: "modelos-propostas",
  proposalAreas: "proposta-areas",
  proposalActionTypes: "proposta-tipos",
  proposalServiceSubtypes: "proposta-subtipos",
  sales: "vendas",
  viabilityAnalyses: "analises-viabilidade",
  purchaseOrders: "pedidos-compra",
  projectSchedule: "cronograma-fisico-financeiro",
  projectMilestones: "marcos-obras",
  agendaEvents: "agenda-eventos",
  kanbanBoards: "kanban-boards",
  kanbanColumns: "kanban-colunas",
  kanbanCards: "kanban-cards",
  projectNotifications: "notificacoes-obras",
  projectTrackingLinks: "links-acompanhamento-obras",
  technicalReports: "relatorios-tecnicos",
  receivable: "contas-receber",
  payable: "contas-pagar",
  cashMoves: "movimentacoes-caixa",
  chartAccounts: "plano-contas",
  journalEntries: "lancamentos-contabeis",
  taxDocuments: "documentos-fiscais",
  taxes: "impostos",
  companySettings: "dados-empresa",
  users: "usuarios",
  permissions: "permissoes",
  systemVersion: "sistema-versoes",
  workTypes: "tipos-obras",
  workStatuses: "status-obras",
  standardStages: "etapas-padrao",
  standardMilestones: "marcos-padrao",
  customFields: "campos-personalizados-obras",
  customFieldValues: "valores-personalizados-obras",
  reportModels: "modelos-relatorios",
  documentTypes: "tipos-documentos",
  checklists: "checklists",
  checklistItems: "itens-checklists",
  measurementTypes: "tipos-medicao",
  paymentMethods: "formas-pagamento",
  whatsappTemplates: "mensagens-padrao",
  visibilityRules: "regras-visualizacao",
  plugins: "plugins",
  preferences: "preferencias",
};

const configs = {
  clients: {
    title: "Clientes",
    description: "Cadastro de clientes usado em orçamentos, vendas, contas a receber e filtros gerenciais.",
    fields: [
      ["name",     "Nome",       "text",   true],
      ["document", "CPF/CNPJ",   "text"],
      ["zipCode",  "CEP",        "text"],
      ["address",  "Endereço",   "text"],
      ["email",    "E-mail",     "email",  true],
      ["phone",    "Celular",    "text",   true],
      ["status",   "Status",     "select", ["Ativo", "Inativo"]],
    ],
  },
  suppliers: {
    title: "Fornecedores",
    description: "Cadastro de fornecedores para compras, contas a pagar, categorias e documentos de origem.",
    fields: [
      ["name",     "Nome",       "text",   true],
      ["document", "CPF/CNPJ",   "text"],
      ["zipCode",  "CEP",        "text"],
      ["address",  "Endereço",   "text"],
      ["email",    "E-mail",     "email",  true],
      ["phone",    "Celular",    "text",   true],
      ["status",   "Status",     "select", ["Ativo", "Inativo"]],
    ],
  },
  products: {
    title: "Produtos",
    description: "Controle de produtos, custo, preço de venda, estoque e lucro unitário.",
    fields: [
      ["name", "Produto", "text", true],
      ["sku", "SKU", "text"],
      ["categoryId", "Categoria", "category"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["projectId", "Obra/Projeto", "project"],
      ["cost", "Custo", "number"],
      ["price", "Preço", "number"],
      ["stock", "Estoque", "number"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  services: {
    title: "Serviços",
    description: "Cadastro de serviços com custo estimado, preço, margem e centro de custo.",
    fields: [
      ["name", "Serviço", "text", true],
      ["categoryId", "Categoria", "category"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["projectId", "Obra/Projeto", "project"],
      ["cost", "Custo", "number"],
      ["price", "Preço", "number"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  bankAccounts: {
    title: "Contas bancárias",
    description: "Cadastro de contas usadas no controle de saldo, caixa, bancos e conciliação OFX. Só nome e banco são obrigatórios — o saldo é calculado pelos extratos importados.",
    fields: [
      ["name", "Nome da conta", "text", true],
      ["bank", "Banco", "text", true],
      ["agency", "Agência (opcional)", "text"],
      ["accountNumber", "Número da conta (opcional)", "text"],
      ["openingBalance", "Saldo inicial (R$, opcional)", "number"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  projects: {
    title: "Obras/Projetos",
    description: "Cadastro de obras e projetos com cliente, prazos, orçamento, receita contratada e custo previsto.",
    fields: [
      ["name", "Nome da obra/projeto", "text", true],
      ["clientId", "Cliente vinculado", "client"],
      ["address", "Endereço", "text"],
      ["zipCode", "CEP", "text"],
      ["responsible", "Responsável", "text"],
      ["technicalResponsible", "Responsável técnico", "text"],
      ["projectManagerId", "Gestor da obra", "user"],
      ["commercialUserId", "Comercial responsável", "user"],
      ["financialUserId", "Financeiro responsável", "user"],
      ["startDate", "Data de início", "date"],
      ["endForecast", "Previsão de término", "date"],
      ["completionDate", "Data de conclusão", "date"],
      ["status", "Status", "select", ["Planejamento", "Proposta enviada", "Contratada", "Em andamento", "Pausada", "Concluída", "Cancelada"]],
      ["budgetForecast", "Orçamento previsto", "number"],
      ["revenueContracted", "Receita contratada", "number"],
      ["costForecast", "Custo previsto", "number"],
      ["realizedCost", "Custo realizado", "number"],
      ["notes", "Observações", "textarea"],
    ],
  },
  plugins: {
    title: "Plugin",
    description: "Sistemas externos exibidos no menu lateral e abertos em nova aba.",
    fields: [
      ["name", "Nome", "text", true],
      ["url", "URL (abre em nova aba)", "url", true],
      ["icon", "Ícone (emoji ou letra)", "text"],
      ["description", "Descrição curta", "text"],
      ["roles", "Perfis com acesso (separados por vírgula; vazio = todos)", "text"],
      ["sortOrder", "Ordem de exibição", "number"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  viabilityAnalyses: {
    title: "Análise de Viabilidade",
    description: "Avaliação de custo x benefício por obra/projeto com margem, payback, VPL, TIR e parecer automático.",
    fields: [
      ["projectId", "Obra/Projeto", "project", true],
      ["proposalId", "Proposta comercial (opcional)", "proposal"],
      ["contractValue", "Valor total do contrato/proposta", "number", true],
      ["estimatedCost", "Custo estimado total da obra", "number", true],
      ["executionMonths", "Prazo de execução (meses)", "number", true],
      ["tmaPercent", "TMA - Taxa mínima de atratividade (% a.a.)", "number"],
      ["analysisDate", "Data da análise", "date"],
      ["responsibleUserId", "Responsável pela análise", "user"],
      ["status", "Status", "select", ["Em análise", "Aprovada", "Reprovada", "Arquivada"]],
      ["verdict", "Parecer final", "select", ["Automático", "Viável", "Viável com ressalvas", "Inviável"]],
      ["verdictJustification", "Justificativa (obrigatória ao alterar o parecer manualmente)", "textarea"],
      ["risks", "Riscos identificados", "textarea"],
      ["notes", "Observações", "textarea"],
    ],
  },
  workBudgets: {
    title: "Orçamentos de Obras",
    description: "Orçamentos vinculados a obra/projeto, base SINAPI, BDI, encargos, desconto, custo e preço de venda.",
    fields: [
      ["projectId", "Obra/Projeto", "project", true],
      ["clientId", "Cliente", "client"],
      ["name", "Nome do orçamento", "text", true],
      ["version", "Versão", "text"],
      ["budgetDate", "Data do orçamento", "date", true],
      ["sinapiReferenceId", "Referência SINAPI", "sinapiReference"],
      ["priceType", "Tipo de preço", "select", ["Sem desoneração", "Com desoneração", "Sem encargos sociais", "Onerado", "Desonerado"]],
      ["status", "Status", "select", ["Rascunho", "Em análise", "Aprovado", "Recusado", "Cancelado"]],
      ["bdiPercent", "BDI %", "number"],
      ["chargesPercent", "Encargos %", "number"],
      ["discountPercent", "Desconto %", "number"],
      ["directCost", "Custo direto", "number"],
      ["totalCost", "Custo total", "number"],
      ["totalPrice", "Preço total", "number"],
      ["notes", "Observações", "textarea"],
    ],
  },
  workBudgetItems: {
    title: "Itens do orçamento",
    description: "Itens SINAPI, composições próprias, cotações manuais ou itens livres usados no orçamento de obra.",
    fields: [
      ["workBudgetId", "Orçamento de obra", "workBudget", true],
      ["projectId", "Obra/Projeto", "project"],
      ["origin", "Origem", "select", ["SINAPI", "Composição própria", "Cotação manual", "Item livre"]],
      ["sinapiReferenceId", "Referência SINAPI", "sinapiReference"],
      ["sinapiUf", "UF SINAPI", "text"],
      ["sinapiReferenceType", "Tipo referência SINAPI", "text"],
      ["code", "Código", "text"],
      ["description", "Descrição", "textarea", true],
      ["unit", "Unidade", "text"],
      ["quantity", "Quantidade", "number"],
      ["unitCost", "Custo unitário", "number"],
      ["totalCost", "Custo total", "number"],
      ["bdiPercent", "BDI %", "number"],
      ["unitPrice", "Preço unitário", "number"],
      ["totalPrice", "Preço total", "number"],
      ["stageName", "Etapa da obra", "text"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["categoryId", "Categoria financeira", "category"],
      ["notes", "Observações", "textarea"],
    ],
  },
  sinapiReferences: {
    title: "Base SINAPI",
    description: "Referências SINAPI/CAIXA por UF, mês/ano, tipo de referência e resumo de importação. Padrão inicial: MS 04/2026.",
    fields: [
      ["uf", "UF", "text", true],
      ["referenceMonth", "Mês de referência", "number", true],
      ["referenceYear", "Ano de referência", "number", true],
      ["priceType", "Tipo de referência", "select", ["Sem desoneração", "Com desoneração", "Sem encargos sociais", "Onerado", "Desonerado"]],
      ["source", "Fonte", "text"],
      ["defaultUf", "UF padrão", "text"],
      ["locationName", "Local de uso", "text"],
      ["issueDate", "Data de emissão", "date"],
      ["availableTypes", "Tipos disponíveis", "text"],
      ["importDate", "Data de importação", "date"],
      ["importUserId", "Usuário importação", "user"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  sinapiInputs: {
    title: "Insumos SINAPI",
    description: "Insumos importados da base SINAPI e consultados por código, descrição, unidade e categoria.",
    fields: [
      ["sinapiReferenceId", "Referência SINAPI", "sinapiReference", true],
      ["referenceType", "Tipo de referência", "text"],
      ["uf", "UF", "text"],
      ["classification", "Classificação", "text"],
      ["code", "Código", "text", true],
      ["description", "Descrição", "textarea", true],
      ["unit", "Unidade", "text"],
      ["priceOrigin", "Origem de preço", "text"],
      ["unitPrice", "Preço unitário", "number"],
      ["origin", "Origem", "text"],
      ["category", "Categoria", "text"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  sinapiCompositions: {
    title: "Composições SINAPI",
    description: "Composições sintéticas da base SINAPI com custo unitário, grupo, classe e status.",
    fields: [
      ["sinapiReferenceId", "Referência SINAPI", "sinapiReference", true],
      ["referenceType", "Tipo de referência", "text"],
      ["uf", "UF", "text"],
      ["code", "Código", "text", true],
      ["description", "Descrição", "textarea", true],
      ["unit", "Unidade", "text"],
      ["unitCost", "Custo unitário", "number"],
      ["percentAS", "%AS", "number"],
      ["type", "Tipo", "text"],
      ["groupName", "Grupo", "text"],
      ["className", "Classe", "text"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  sinapiCompositionItems: {
    title: "Itens das composições SINAPI",
    description: "Itens analíticos vinculados a composições SINAPI, incluindo insumos e composições auxiliares.",
    fields: [
      ["sinapiReferenceId", "Referência SINAPI", "sinapiReference"],
      ["sinapiCompositionId", "Composição SINAPI", "sinapiComposition"],
      ["compositionCode", "Código da composição", "text"],
      ["itemType", "Tipo do item", "select", ["Insumo", "Composição auxiliar"]],
      ["itemCode", "Código do item", "text"],
      ["itemDescription", "Descrição do item", "textarea"],
      ["unit", "Unidade", "text"],
      ["coefficient", "Coeficiente", "number"],
      ["situation", "Situação", "text"],
      ["unitPrice", "Preço unitário", "number"],
      ["totalCost", "Custo total", "number"],
    ],
  },
  sinapiLabor: {
    title: "Mão de obra SINAPI",
    description: "Percentual de mão de obra por composição e UF, importado das abas COM/SEM desoneração.",
    fields: [
      ["sinapiReferenceId", "Referência SINAPI", "sinapiReference", true],
      ["referenceType", "Tipo de referência", "text"],
      ["uf", "UF", "text"],
      ["groupName", "Grupo", "text"],
      ["compositionCode", "Código da composição", "text", true],
      ["description", "Descrição", "textarea", true],
      ["unit", "Unidade", "text"],
      ["laborPercent", "% mão de obra", "number"],
    ],
  },
  sinapiFamilies: {
    title: "Famílias e coeficientes",
    description: "Famílias de insumos, categoria e coeficiente por UF, preparadas para análises futuras de materiais e mão de obra.",
    fields: [
      ["sinapiReferenceId", "Referência SINAPI", "sinapiReference", true],
      ["familyCode", "Código da família", "text", true],
      ["inputCode", "Código do insumo", "text", true],
      ["inputDescription", "Descrição do insumo", "textarea"],
      ["unit", "Unidade", "text"],
      ["category", "Categoria", "text"],
      ["uf", "UF", "text"],
      ["coefficient", "Coeficiente", "number"],
    ],
  },
  sinapiMaintenances: {
    title: "Manutenções SINAPI",
    description: "Histórico de manutenções de insumos e composições da referência SINAPI.",
    fields: [
      ["sinapiReferenceId", "Referência SINAPI", "sinapiReference"],
      ["referenceCode", "Referência", "text"],
      ["itemType", "Tipo", "text"],
      ["code", "Código", "text", true],
      ["description", "Descrição", "textarea", true],
      ["maintenanceType", "Manutenção", "text"],
    ],
  },
  sinapiSettings: {
    title: "Configuração SINAPI",
    description: "Preferências editáveis para importação, orçamento e proposta comercial baseada em SINAPI.",
    fields: [
      ["defaultUf", "UF padrão", "text", true],
      ["defaultReferenceMonth", "Mês padrão", "number"],
      ["defaultReferenceYear", "Ano padrão", "number"],
      ["defaultReferenceType", "Tipo padrão", "select", ["Sem desoneração", "Com desoneração", "Sem encargos sociais"]],
      ["defaultBdiPercent", "BDI padrão %", "number"],
      ["defaultItemMode", "Usar por padrão", "select", ["Composições", "Insumos"]],
      ["showSinapiCodeInProposal", "Exibir código SINAPI na proposta", "select", ["Não", "Sim"]],
      ["showAnalyticalInProposal", "Exibir composições analíticas na proposta", "select", ["Não", "Sim"]],
      ["showUnitPriceInProposal", "Exibir preço unitário na proposta", "select", ["Sim", "Não"]],
      ["showGlobalOnlyInProposal", "Exibir apenas valor global", "select", ["Não", "Sim"]],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  ownCompositions: {
    title: "Composições Próprias",
    description: "Composições internas editáveis para serviços recorrentes da empresa.",
    fields: [
      ["code", "Código interno", "text", true],
      ["description", "Descrição", "textarea", true],
      ["unit", "Unidade", "text"],
      ["estimatedCost", "Custo estimado", "number"],
      ["laborCost", "Mão de obra", "number"],
      ["materialCost", "Material", "number"],
      ["equipmentCost", "Equipamentos", "number"],
      ["thirdPartyCost", "Terceiros", "number"],
      ["marginPercent", "Margem %", "number"],
      ["suggestedPrice", "Preço sugerido", "number"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  quotes: {
    title: "Cotações",
    description: "Cotações manuais por fornecedor, obra, orçamento e validade, preparadas para anexos fora da pasta pública.",
    fields: [
      ["supplierId", "Fornecedor", "supplier"],
      ["description", "Descrição", "textarea", true],
      ["unit", "Unidade", "text"],
      ["quantity", "Quantidade", "number"],
      ["unitValue", "Valor unitário", "number"],
      ["totalValue", "Valor total", "number"],
      ["quoteDate", "Data da cotação", "date"],
      ["validityDate", "Validade", "date"],
      ["attachmentPath", "Anexo", "text"],
      ["projectId", "Obra/Projeto", "project"],
      ["workBudgetId", "Orçamento de obra", "workBudget"],
      ["notes", "Observações", "textarea"],
      ["status", "Status", "select", ["Em cotação", "Aprovada", "Recusada", "Vencida"]],
    ],
  },
  fiscalDocuments: {
    title: "Notas Fiscais / Documentos Fiscais",
    description: "Notas fiscais, recibos, comprovantes e anexos fiscais vinculados a obras/projetos.",
    fields: [
      ["projectId", "Obra/Projeto", "project"],
      ["supplierId", "Fornecedor/prestador", "supplier"],
      ["documentNumber", "Número da nota fiscal", "text", true],
      ["issueDate", "Data de emissão", "date", true],
      ["amount", "Valor da nota", "money"],
      ["type", "Tipo", "select", ["Nota Fiscal de Serviço", "Nota Fiscal de Produto", "Recibo", "Comprovante", "Outro"]],
      ["status", "Status", "select", ["Pendente", "Anexada", "Conferida", "Cancelada"]],
      ["payableId", "Conta a pagar", "payable"],
      ["receivableId", "Conta a receber", "receivable"],
      ["saleId", "Venda/Contrato", "sale"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["categoryId", "Categoria financeira", "category"],
      ["pdfFile", "PDF da nota fiscal", "file-pdf"],
      ["xmlFile", "XML da nota fiscal", "file-xml"],
      ["notes", "Observações", "textarea"],
    ],
  },
  projectSchedule: {
    title: "Cronograma Físico-Financeiro",
    description: "Etapas, marcos, previsto x realizado, avanço físico, avanço financeiro e comunicação manual por WhatsApp.",
    fields: [
      ["projectId", "Obra/Projeto", "project", true],
      ["stageName", "Nome da etapa", "text", true],
      ["description", "Descrição", "textarea"],
      ["sortOrder", "Ordem", "number"],
      ["plannedStartDate", "Data prevista de início", "date"],
      ["plannedEndDate", "Data prevista de término", "date"],
      ["actualStartDate", "Data real de início", "date"],
      ["actualEndDate", "Data real de término", "date"],
      ["plannedPhysicalPercent", "Percentual físico previsto", "number"],
      ["actualPhysicalPercent", "Percentual físico realizado", "number"],
      ["plannedFinancialAmount", "Valor financeiro previsto", "number"],
      ["actualFinancialAmount", "Valor financeiro realizado", "number"],
      ["workBudgetId", "Orçamento de obra", "workBudget"],
      ["workBudgetItemId", "Item do orçamento", "workBudgetItem"],
      ["predecessorIds", "Dependências", "text"],
      ["durationDays", "Duração (dias)", "number"],
      ["status", "Status", "select", ["Não iniciada", "Em andamento", "Concluída", "Atrasada", "Pausada", "Cancelada"]],
      ["responsible", "Responsável", "text"],
      ["isMilestone", "É marco", "select", ["Não", "Sim"]],
      ["milestoneName", "Nome do marco", "text"],
      ["milestoneMessage", "Mensagem padrão do marco", "textarea"],
      ["visibleToClient", "Liberar para cliente/investidor", "select", ["Não", "Sim"]],
      ["notes", "Observações", "textarea"],
    ],
  },
  projectMilestones: {
    title: "Marcos da obra",
    description: "Marcos importantes vinculados ao cronograma da obra e preparados para comunicação com cliente/investidor.",
    fields: [
      ["projectId", "Obra/Projeto", "project", true],
      ["scheduleStepId", "Etapa do cronograma", "scheduleStep"],
      ["name", "Nome do marco", "text", true],
      ["defaultMessage", "Mensagem padrão", "textarea"],
      ["visibleToClient", "Liberar para cliente/investidor", "select", ["Não", "Sim"]],
      ["plannedDate", "Data prevista", "date"],
      ["completedDate", "Data concluída", "date"],
      ["status", "Status", "select", ["Pendente", "Concluído", "Cancelado"]],
      ["notes", "Observações", "textarea"],
    ],
  },
  agendaEvents: {
    title: "Evento da agenda",
    description: "Compromissos por obra, cliente, usuário e tipo.",
    fields: [
      ["obra_id", "Obra/Projeto", "project"],
      ["cliente_id", "Cliente", "client"],
      ["usuario_id", "Responsável", "user"],
      ["titulo", "Título", "text", true],
      ["descricao", "Descrição", "textarea"],
      ["tipo", "Tipo", "select", ["reuniao", "visita", "entrega", "cobranca", "outro"]],
      ["data_inicio", "Início", "datetime-local", true],
      ["data_fim", "Fim", "datetime-local"],
      ["dia_todo", "Dia todo", "select", ["0", "1"]],
      ["lembrete_minutos", "Lembrete em minutos", "number"],
      ["status", "Status", "select", ["agendado", "realizado", "cancelado"]],
    ],
  },
  kanbanCards: {
    title: "Card Kanban",
    description: "Tarefa do board com responsável, prazo e prioridade.",
    fields: [
      ["coluna_id", "Coluna", "kanbanColumn", true],
      ["obra_id", "Obra/Projeto", "project"],
      ["titulo", "Título", "text", true],
      ["descricao", "Descrição", "textarea"],
      ["responsavel_id", "Responsável", "user"],
      ["data_vencimento", "Prazo", "date"],
      ["prioridade", "Prioridade", "select", ["baixa", "media", "alta", "urgente"]],
      ["referencia_tipo", "Tipo de referência", "text"],
      ["referencia_id", "ID de referência", "number"],
      ["ordem", "Ordem", "number"],
    ],
  },
  projectNotifications: {
    title: "Notificações da obra",
    description: "Histórico de links e mensagens preparados para envio manual por WhatsApp.",
    fields: [
      ["projectId", "Obra/Projeto", "project", true],
      ["scheduleStepId", "Etapa do cronograma", "scheduleStep"],
      ["milestoneId", "Marco", "projectMilestone"],
      ["recipient", "Destinatário", "text", true],
      ["phone", "Telefone", "text"],
      ["type", "Tipo", "select", ["WhatsApp manual"]],
      ["message", "Mensagem", "textarea"],
      ["generatedLink", "Link gerado", "text"],
      ["status", "Status", "select", ["Preparado", "Enviado manualmente", "Cancelado"]],
      ["responsibleUserId", "Usuário responsável", "user"],
    ],
  },
  projectTrackingLinks: {
    title: "Links de acompanhamento",
    description: "Estrutura preparada para futuro portal seguro por token com visualização limitada ao cliente/investidor.",
    fields: [
      ["projectId", "Obra/Projeto", "project", true],
      ["token", "Token", "text"],
      ["url", "URL", "text"],
      ["visibility", "Visibilidade", "select", ["Interno", "Cliente/Investidor"]],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
      ["notes", "Observações", "textarea"],
    ],
  },
  purchaseOrders: {
    title: "Pedidos de compra",
    description: "Pedidos de compra vinculados à obra, fornecedor, centro de custo e categoria financeira.",
    fields: [
      ["number", "Número", "text", true],
      ["date", "Data", "date", true],
      ["projectId", "Obra/Projeto", "project"],
      ["supplierId", "Fornecedor", "supplier"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["categoryId", "Categoria", "category"],
      ["amount", "Valor", "number"],
      ["expectedDate", "Previsão de entrega", "date"],
      ["status", "Status", "select", ["Solicitado", "Aprovado", "Comprado", "Recebido", "Cancelado"]],
      ["notes", "Observações", "textarea"],
    ],
  },
  technicalReports: {
    title: "Relatórios técnicos",
    description: "Relatórios e documentos técnicos por obra, com marcação de visibilidade futura ao cliente.",
    fields: [
      ["projectId", "Obra/Projeto", "project", true],
      ["title", "Título", "text", true],
      ["date", "Data", "date", true],
      ["responsible", "Responsável técnico", "text"],
      ["visibleToClient", "Visível ao cliente", "select", ["Não", "Sim"]],
      ["status", "Status", "select", ["Rascunho", "Liberado interno", "Liberado ao cliente", "Arquivado"]],
      ["notes", "Observações", "textarea"],
    ],
  },
  budgets: {
    title: "Orçamentos",
    description: "Propostas comerciais ligadas a cliente, produtos, serviços, validade, status e centro de custo.",
    fields: [
      ["number", "Número", "text", true],
      ["date", "Data", "date", true],
      ["clientId", "Cliente", "client"],
      ["projectId", "Obra/Projeto", "project"],
      ["proposalId", "Proposta", "proposal"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["createdByUserId", "Criado por", "user"],
      ["commercialUserId", "Comercial responsável", "user"],
      ["description", "Descrição", "textarea"],
      ["amount", "Valor", "number"],
      ["status", "Status", "select", ["Aberto", "Aprovado", "Cancelado"]],
    ],
  },
  proposalAreas: {
    title: "Áreas/Disciplinas",
    description: "Primeiro nível da estrutura comercial: engenharia elétrica, civil, arquitetura, gestão de obras e outras áreas.",
    fields: [
      ["name", "Área/Disciplina", "text", true],
      ["description", "Descrição", "textarea"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  proposalActionTypes: {
    title: "Tipos de atuação",
    description: "Segundo nível da proposta: projetos, execução, laudos, consultoria, planejamento, gestão ou entrega.",
    fields: [
      ["areaId", "Área/Disciplina", "proposalArea", true],
      ["name", "Tipo de atuação", "text", true],
      ["description", "Descrição", "textarea"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  proposalServiceSubtypes: {
    title: "Subtipos/Serviços",
    description: "Terceiro nível da proposta: serviço específico que pode ter modelos comerciais vinculados.",
    fields: [
      ["actionTypeId", "Tipo de atuação", "proposalActionType", true],
      ["name", "Subtipo/Serviço", "text", true],
      ["description", "Descrição", "textarea"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  proposalModels: {
    title: "Modelos de propostas",
    description: "Modelos editáveis com escopo, etapas, entregáveis, condições e variáveis dinâmicas.",
    fields: [
      ["name", "Nome do modelo", "text", true],
      ["areaId", "Área/Disciplina", "proposalArea"],
      ["actionTypeId", "Tipo de atuação", "proposalActionType"],
      ["subtypeId", "Subtipo/Serviço", "proposalSubtype"],
      ["proposalObject", "Objeto da proposta", "textarea"],
      ["scope", "Escopo", "textarea"],
      ["stages", "Etapas", "textarea"],
      ["deliverables", "Entregáveis", "textarea"],
      ["deadline", "Prazo", "text"],
      ["paymentTerms", "Condições de pagamento", "textarea"],
      ["includedItems", "Itens inclusos", "textarea"],
      ["excludedItems", "Itens não inclusos", "textarea"],
      ["clientResponsibilities", "Responsabilidades do cliente", "textarea"],
      ["companyResponsibilities", "Responsabilidades da empresa", "textarea"],
      ["validityDays", "Validade da proposta (dias)", "number"],
      ["generalConditions", "Condições gerais", "textarea"],
      ["acceptanceText", "Aceite", "textarea"],
      ["signatureText", "Assinatura", "textarea"],
      ["printLayout", "Layout de impressão/PDF", "select", ["Padrão A4", "Resumido", "Detalhado"]],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  proposals: {
    title: "Propostas",
    description: "Propostas comerciais independentes ou vinculadas a orçamento, obra/projeto, serviço e modelo.",
    fields: [
      ["number", "Número", "text", true],
      ["date", "Data", "date", true],
      ["clientId", "Cliente", "client"],
      ["projectId", "Obra/Projeto", "project"],
      ["budgetId", "Orçamento", "budget"],
      ["workBudgetId", "Orçamento de obra", "workBudget"],
      ["serviceId", "Serviço", "service"],
      ["modelId", "Modelo de proposta", "proposalModel"],
      ["areaId", "Área/Disciplina", "proposalArea"],
      ["actionTypeId", "Tipo de atuação", "proposalActionType"],
      ["subtypeId", "Subtipo/Serviço", "proposalSubtype"],
      ["origin", "Origem da proposta", "select", ["Nova demanda", "Derivada de laudo", "Derivada de projeto", "Derivada de obra existente", "Adicional/serviço complementar", "Retrofit", "Manutenção", "Regularização", "Outro"]],
      ["parentProposalId", "Proposta anterior", "proposal"],
      ["createdByUserId", "Criada por", "user"],
      ["commercialUserId", "Comercial responsável", "user"],
      ["description", "Descrição", "textarea"],
      ["amount", "Valor total", "number"],
      ["proposalBody", "Corpo da proposta gerada", "textarea"],
      ["itemDisplayMode", "Exibição dos itens", "select", ["Proposta resumida", "Proposta por grupos/etapas", "Proposta detalhada", "Proposta técnica interna", "Tabela detalhada", "Tabela resumida", "Valor global", "Agrupado por etapa", "Agrupado por categoria", "Agrupado por centro de custo"]],
      ["paymentCondition", "Condição de pagamento", "textarea"],
      ["paymentTerms", "Condição de pagamento", "textarea"],
      ["executionDeadline", "Prazo de execução", "text"],
      ["deadline", "Prazo de entrega", "text"],
      ["validityDate", "Validade", "date"],
      ["technicalResponsible", "Responsável técnico", "text"],
      ["commercialResponsible", "Responsável comercial", "text"],
      ["commercialNotes", "Observações comerciais", "textarea"],
      ["status", "Status", "select", ["Rascunho", "Gerada", "Enviada", "Aprovada", "Recusada", "Vencida", "Cancelada", "Convertida"]],
    ],
  },
  sales: {
    title: "Vendas/Contratos",
    description: "Contratos e vendas com origem comercial, cliente, competência, faturamento e margem.",
    fields: [
      ["number", "Número", "text", true],
      ["date", "Data", "date", true],
      ["competenceDate", "Competência", "date"],
      ["clientId", "Cliente", "client"],
      ["projectId", "Obra/Projeto", "project"],
      ["proposalId", "Proposta", "proposal"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["description", "Descrição", "textarea"],
      ["amount", "Receita", "number"],
      ["cost", "Custo", "number"],
      ["status", "Status", "select", ["Aberto", "Aprovado", "Cancelado"]],
    ],
  },
  receivable: {
    title: "Contas a receber",
    description: "Títulos a receber com vencimento, recebimento, status, cliente, categoria e conta bancária.",
    fields: [
      ["document", "Documento", "text", true],
      ["issueDate", "Emissão", "date"],
      ["dueDate", "Vencimento", "date", true],
      ["receivedDate", "Recebimento", "date"],
      ["clientId", "Cliente", "client"],
      ["projectId", "Obra/Projeto", "project"],
      ["proposalId", "Proposta", "proposal"],
      ["categoryId", "Categoria", "category"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["bankAccount", "Conta banco", "text"],
      ["amount", "Valor", "number"],
      ["status", "Status", "select", ["Aberto", "Recebido", "Vencido", "Parcial", "Cancelado"]],
    ],
  },
  payable: {
    title: "Contas a pagar",
    description: "Títulos a pagar com fornecedor, vencimento, pagamento, categoria, centro de custo e banco.",
    fields: [
      ["document", "Documento", "text", true],
      ["issueDate", "Emissão", "date"],
      ["dueDate", "Vencimento", "date", true],
      ["paidDate", "Pagamento", "date"],
      ["supplierId", "Fornecedor", "supplier"],
      ["projectId", "Obra/Projeto", "project"],
      ["categoryId", "Categoria", "category"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["bankAccount", "Conta banco", "text"],
      ["amount", "Valor", "number"],
      ["status", "Status", "select", ["Aberto", "Pago", "Vencido", "Parcial", "Cancelado"]],
    ],
  },
  cashMoves: {
    title: "Movimentações de caixa e bancos",
    description: "Entradas, saídas e transferências para controle de fluxo de caixa e saldo bancário.",
    fields: [
      ["date", "Data", "date", true],
      ["bankAccount", "Conta banco", "text", true],
      ["type", "Tipo", "select", ["Entrada", "Saída", "Transferência"]],
      ["categoryId", "Categoria", "category"],
      ["projectId", "Obra/Projeto", "project"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["history", "Histórico", "textarea"],
      ["amount", "Valor", "number"],
      ["originDocument", "Documento de origem", "text"],
    ],
  },
  costCenters: {
    title: "Centro de custo",
    description: "Estrutura gerencial para apuração de resultado por área, unidade, projeto ou operação.",
    fields: [
      ["code", "Código", "text", true],
      ["name", "Nome", "text", true],
      ["manager", "Responsável", "text"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  categories: {
    title: "Categorias financeiras",
    description: "Classificação financeira separada da contabilidade para receitas, despesas e investimentos.",
    fields: [
      ["name", "Categoria", "text", true],
      ["type", "Tipo", "select", ["Receita", "Despesa", "Investimento"]],
      ["chartAccountId", "Conta contábil vinculada", "chartAccount"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  chartAccounts: {
    title: "Plano de contas contábil",
    description: "Plano contábil normalizado com contas sintéticas e analíticas para lançamentos por débito e crédito.",
    fields: [
      ["code", "Código", "text", true],
      ["name", "Conta", "text", true],
      ["type", "Natureza", "select", ["Ativo", "Passivo", "Patrimônio Líquido", "Receita", "Despesa"]],
      ["parentId", "Conta pai", "chartAccount"],
      ["acceptsEntries", "Recebe lançamentos", "select", ["Sim", "Não"]],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  journalEntries: {
    title: "Lançamentos contábeis",
    description: "Contabilidade separada do financeiro com competência, débito, crédito, histórico, valor e origem.",
    fields: [
      ["entryDate", "Data lançamento", "date", true],
      ["competenceDate", "Competência", "date", true],
      ["debitAccountId", "Conta débito", "chartAccount"],
      ["creditAccountId", "Conta crédito", "chartAccount"],
      ["history", "Histórico", "textarea"],
      ["amount", "Valor", "number"],
      ["projectId", "Obra/Projeto", "project"],
      ["costCenterId", "Centro de custo", "costCenter"],
      ["originDocument", "Documento de origem", "text"],
    ],
  },
  taxDocuments: {
    title: "Documentos fiscais",
    description: "Registro gerencial de documentos fiscais relacionados a clientes, fornecedores e lançamentos.",
    fields: [
      ["document", "Documento", "text", true],
      ["date", "Data", "date", true],
      ["type", "Tipo", "select", ["Nota fiscal", "Recibo", "Contrato", "Outro"]],
      ["clientId", "Cliente", "client"],
      ["supplierId", "Fornecedor", "supplier"],
      ["projectId", "Obra/Projeto", "project"],
      ["amount", "Valor", "number"],
      ["status", "Status", "select", ["Emitido", "Recebido", "Cancelado"]],
    ],
  },
  taxes: {
    title: "Impostos",
    description: "Controle gerencial de impostos por competência, base de cálculo, alíquota e status.",
    fields: [
      ["name", "Imposto", "text", true],
      ["competenceDate", "Competência", "date", true],
      ["baseAmount", "Base de cálculo", "number"],
      ["rate", "Alíquota %", "number"],
      ["amount", "Valor", "number"],
      ["projectId", "Obra/Projeto", "project"],
      ["status", "Status", "select", ["Aberto", "Pago", "Vencido", "Cancelado"]],
    ],
  },
  companySettings: {
    title: "Dados da empresa",
    description: "Dados cadastrais usados como referência local do sistema.",
    fields: [
      ["name", "Razão social", "text", true],
      ["document", "CNPJ", "text"],
      ["zipCode", "CEP", "text"],
      ["address", "Endereço", "text"],
      ["email", "E-mail", "email"],
      ["phone", "Telefone", "text"],
      ["city", "Cidade", "text"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  users: {
    title: "Usuários",
    description: "Cadastro de logins do sistema. Apenas administradores podem criar, alterar ou excluir usuários.",
    fields: [
      ["username", "Nome de usuário", "text", true],
      ["fullName", "Nome completo", "text", true],
      ["email", "E-mail", "email", true],
      ["cpf", "CPF", "text", true],
      ["data_nascimento", "Data de nascimento", "text", true],
      ["celular", "Celular", "text", true],
      ["password", "Senha", "password", true],
      ["role", "Perfil", "select", ["admin", "gerente", "financeiro", "comercial", "engenharia", "gestor_obra", "equipe_campo", "cliente_obra", "fornecedor_terceiro", "consulta", "operador", "visualizador"]],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  permissions: {
    title: "Permissões",
    description: "Estrutura preparada para RBAC por perfil, módulo e ação. A aplicação atual mantém regras compatíveis no frontend e backend.",
    fields: [
      ["role", "Perfil", "select", ["admin", "financeiro", "comercial", "engenharia", "gestor_obra", "equipe_campo", "cliente_obra", "fornecedor_terceiro", "consulta"]],
      ["module", "Módulo", "text", true],
      ["canView", "Visualizar", "select", ["Sim", "Não"]],
      ["canCreate", "Criar", "select", ["Sim", "Não"]],
      ["canEdit", "Editar", "select", ["Sim", "Não"]],
      ["canDelete", "Excluir", "select", ["Sim", "Não"]],
      ["canExport", "Exportar", "select", ["Sim", "Não"]],
      ["canApprove", "Aprovar", "select", ["Sim", "Não"]],
      ["canAttach", "Anexar arquivo", "select", ["Sim", "Não"]],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  systemVersion: {
    title: "Versão do Sistema",
    description: "Controle interno de versão, histórico de alterações e lembrete de backup antes de atualizar.",
    fields: [
      ["versao", "Versão", "text", true],
      ["data_versao", "Data da versão", "date", true],
      ["descricao", "Descrição", "textarea"],
      ["alteracoes", "Alterações", "textarea"],
    ],
  },
  workTypes: {
    title: "Tipos de obra",
    description: "Tipos editáveis para parametrizar campos, etapas, marcos, checklists e modelos por peculiaridade da obra.",
    fields: [
      ["name", "Tipo de obra", "text", true],
      ["description", "Descrição", "textarea"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
      ["sortOrder", "Ordem", "number"],
    ],
  },
  workStatuses: {
    title: "Status de obra",
    description: "Lista administrável de status para obras/projetos, sem apagar o histórico existente.",
    fields: [
      ["name", "Status", "text", true],
      ["description", "Descrição", "textarea"],
      ["color", "Cor", "text"],
      ["sortOrder", "Ordem", "number"],
      ["status", "Situação", "select", ["Ativo", "Inativo"]],
    ],
  },
  standardStages: {
    title: "Etapas padrão",
    description: "Modelos de etapas por tipo de obra para gerar cronogramas e orçamentos iniciais.",
    fields: [
      ["workTypeId", "Tipo de obra", "workType"],
      ["name", "Etapa padrão", "text", true],
      ["description", "Descrição", "textarea"],
      ["sortOrder", "Ordem", "number"],
      ["defaultPhysicalPercent", "Físico padrão %", "number"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  standardMilestones: {
    title: "Marcos padrão",
    description: "Marcos editáveis por tipo de obra e etapa, incluindo mensagens padrão ao cliente/investidor.",
    fields: [
      ["workTypeId", "Tipo de obra", "workType"],
      ["standardStageId", "Etapa padrão", "standardStage"],
      ["name", "Marco padrão", "text", true],
      ["defaultMessage", "Mensagem padrão", "textarea"],
      ["visibleToClient", "Liberar para cliente/investidor", "select", ["Não", "Sim"]],
      ["sortOrder", "Ordem", "number"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  customFields: {
    title: "Campos personalizados",
    description: "Campos extras por tipo de obra, como potência instalada, área construída, alvará, concessionária ou faseamento.",
    fields: [
      ["workTypeId", "Tipo de obra", "workType", true],
      ["fieldName", "Nome do campo", "text", true],
      ["fieldType", "Tipo do campo", "select", ["Texto", "Número", "Moeda", "Percentual", "Data", "Seleção", "Múltipla escolha", "Sim/Não", "Arquivo"]],
      ["options", "Opções", "textarea"],
      ["required", "Obrigatório", "select", ["Não", "Sim"]],
      ["sortOrder", "Ordem", "number"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  customFieldValues: {
    title: "Valores personalizados",
    description: "Valores preenchidos por obra para os campos personalizados configurados pelo administrador.",
    fields: [
      ["projectId", "Obra/Projeto", "project", true],
      ["customFieldId", "Campo personalizado", "customField", true],
      ["value", "Valor", "textarea"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  reportModels: {
    title: "Modelos de relatório",
    description: "Modelos editáveis de relatórios técnicos, medição, vistoria, entrega e eficiência energética.",
    fields: [
      ["name", "Nome do modelo", "text", true],
      ["workTypeId", "Tipo de obra", "workType"],
      ["serviceSubtypeId", "Subtipo/Serviço", "proposalSubtype"],
      ["body", "Modelo do relatório", "textarea"],
      ["variables", "Variáveis disponíveis", "textarea"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  documentTypes: {
    title: "Tipos de documento",
    description: "Tipos de documento e anexo previstos para obras, propostas, notas fiscais, relatórios e projetos.",
    fields: [
      ["name", "Tipo de documento", "text", true],
      ["description", "Descrição", "textarea"],
      ["folder", "Subpasta sugerida", "text"],
      ["visibleToClientDefault", "Visível ao cliente por padrão", "select", ["Não", "Sim"]],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  checklists: {
    title: "Checklists",
    description: "Checklists editáveis por tipo de obra e etapa, com foto/anexo previstos para uso futuro em campo.",
    fields: [
      ["name", "Checklist", "text", true],
      ["workTypeId", "Tipo de obra", "workType"],
      ["standardStageId", "Etapa vinculada", "standardStage"],
      ["required", "Obrigatório", "select", ["Não", "Sim"]],
      ["allowsPhoto", "Permite foto", "select", ["Não", "Sim"]],
      ["allowsAttachment", "Permite anexo", "select", ["Não", "Sim"]],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  checklistItems: {
    title: "Itens de checklist",
    description: "Itens detalhados de cada checklist editável.",
    fields: [
      ["checklistId", "Checklist", "checklist", true],
      ["description", "Item", "textarea", true],
      ["required", "Obrigatório", "select", ["Não", "Sim"]],
      ["sortOrder", "Ordem", "number"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  measurementTypes: {
    title: "Tipos de medição",
    description: "Tipos de medição física ou financeira usados em orçamento, cronograma e relatórios de obra.",
    fields: [
      ["name", "Tipo de medição", "text", true],
      ["description", "Descrição", "textarea"],
      ["unit", "Unidade", "text"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  paymentMethods: {
    title: "Formas de pagamento",
    description: "Formas de pagamento editáveis para propostas, orçamentos, vendas e financeiro.",
    fields: [
      ["name", "Forma de pagamento", "text", true],
      ["description", "Descrição", "textarea"],
      ["installments", "Parcelas padrão", "number"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  whatsappTemplates: {
    title: "Mensagens padrão",
    description: "Mensagens padrão editáveis para WhatsApp manual, marcos, cobrança, proposta e acompanhamento da obra.",
    fields: [
      ["name", "Nome da mensagem", "text", true],
      ["context", "Contexto", "select", ["Obra", "Marco", "Proposta", "Cobrança", "Relatório", "Outro"]],
      ["message", "Mensagem", "textarea"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  visibilityRules: {
    title: "Regras de visualização",
    description: "Estrutura preparada para regras futuras de visualização por perfil, módulo, tipo de obra e cliente.",
    fields: [
      ["role", "Perfil", "select", ["admin", "financeiro", "comercial", "engenharia", "gestor_obra", "equipe_campo", "cliente_obra", "fornecedor_terceiro", "consulta"]],
      ["module", "Módulo", "text", true],
      ["workTypeId", "Tipo de obra", "workType"],
      ["rule", "Regra", "textarea"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
  preferences: {
    title: "Preferências do sistema",
    description: "Preferências locais de operação para publicação simples em Apache e uso em navegador.",
    fields: [
      ["name", "Nome da preferência", "text", true],
      ["value", "Valor", "text"],
      ["description", "Descrição", "textarea"],
      ["status", "Status", "select", ["Ativo", "Inativo"]],
    ],
  },
};

const seed = {
  clients: [
    { id: "c1", name: "Alfa Comércio Ltda", document: "12.345.678/0001-90", email: "financeiro@alfa.com", phone: "(65) 3333-1000", status: "Ativo" },
    { id: "c2", name: "Clínica Horizonte", document: "23.456.789/0001-10", email: "adm@horizonte.com", phone: "(65) 3333-2000", status: "Ativo" },
  ],
  suppliers: [
    { id: "f1", name: "Norte Distribuidora", document: "34.567.890/0001-11", email: "cobranca@norte.com", phone: "(65) 3222-1500", status: "Ativo" },
    { id: "f2", name: "Tech Serviços", document: "45.678.901/0001-12", email: "contratos@tech.com", phone: "(65) 3222-1600", status: "Ativo" },
  ],
  costCenters: [
    { id: "cc1", code: "01", name: "Comercial", manager: "Marina", status: "Ativo" },
    { id: "cc2", code: "02", name: "Operações", manager: "Rafael", status: "Ativo" },
    { id: "cc3", code: "03", name: "Administrativo", manager: "Bianca", status: "Ativo" },
  ],
  chartAccounts: [
    { id: "pc1", code: "1.1.01", name: "Bancos conta movimento", type: "Ativo", parentId: "", acceptsEntries: "Sim", status: "Ativo" },
    { id: "pc2", code: "1.1.02", name: "Clientes", type: "Ativo", parentId: "", acceptsEntries: "Sim", status: "Ativo" },
    { id: "pc3", code: "2.1.01", name: "Fornecedores", type: "Passivo", parentId: "", acceptsEntries: "Sim", status: "Ativo" },
    { id: "pc4", code: "3.1.01", name: "Receita de produtos", type: "Receita", parentId: "", acceptsEntries: "Sim", status: "Ativo" },
    { id: "pc5", code: "3.1.02", name: "Receita de serviços", type: "Receita", parentId: "", acceptsEntries: "Sim", status: "Ativo" },
    { id: "pc6", code: "4.1.01", name: "Custo de mercadorias", type: "Despesa", parentId: "", acceptsEntries: "Sim", status: "Ativo" },
    { id: "pc7", code: "4.2.01", name: "Despesas administrativas", type: "Despesa", parentId: "", acceptsEntries: "Sim", status: "Ativo" },
  ],
  categories: [
    { id: "cat1", name: "Venda de produtos", type: "Receita", chartAccountId: "pc4", status: "Ativo" },
    { id: "cat2", name: "Venda de serviços", type: "Receita", chartAccountId: "pc5", status: "Ativo" },
    { id: "cat3", name: "Compra de mercadorias", type: "Despesa", chartAccountId: "pc6", status: "Ativo" },
    { id: "cat4", name: "Despesas administrativas", type: "Despesa", chartAccountId: "pc7", status: "Ativo" },
  ],
  products: [
    { id: "p1", name: "Licença software fiscal", sku: "SOF-001", categoryId: "cat1", costCenterId: "cc1", cost: 420, price: 980, stock: 24, status: "Ativo" },
    { id: "p2", name: "Kit automação PDV", sku: "PDV-010", categoryId: "cat1", costCenterId: "cc2", cost: 1450, price: 2380, stock: 8, status: "Ativo" },
  ],
  services: [
    { id: "s1", name: "Implantação contábil", categoryId: "cat2", costCenterId: "cc2", cost: 900, price: 2200, status: "Ativo" },
    { id: "s2", name: "Consultoria financeira mensal", categoryId: "cat2", costCenterId: "cc1", cost: 700, price: 1800, status: "Ativo" },
  ],
  bankAccounts: [
    { id: "ba1", name: "Banco Principal", bank: "Banco local", agency: "0001", accountNumber: "12345-6", openingBalance: 0, status: "Ativo" },
  ],
  projects: [
    { id: "ob1", name: "Residencial Primavera", clientId: "c1", address: "Av. Principal, 100", responsible: "Alef Schimanski", startDate: "2026-05-01", endForecast: "2026-09-30", status: "Em andamento", budgetForecast: 85000, revenueContracted: 128000, costForecast: 92000, notes: "Obra modelo para análise por projeto." },
    { id: "ob2", name: "Adequação Clínica Horizonte", clientId: "c2", address: "Rua das Flores, 250", responsible: "Rafael", startDate: "2026-06-01", endForecast: "2026-08-15", status: "Planejamento", budgetForecast: 42000, revenueContracted: 64000, costForecast: 39000, notes: "Projeto em fase de planejamento." },
  ],
  workTypes: [
    { id: "wt1", name: "Construção Civil", description: "Obras residenciais, comerciais, reformas e ampliações.", status: "Ativo", sortOrder: 1 },
    { id: "wt2", name: "Energia Solar Fotovoltaica", description: "Projetos, homologação, instalação e comissionamento solar.", status: "Ativo", sortOrder: 2 },
    { id: "wt3", name: "Subestação", description: "Projeto, aprovação, montagem, ensaios e energização.", status: "Ativo", sortOrder: 3 },
    { id: "wt4", name: "Reforma", description: "Reformas com faseamento, restrições de horário e ambientes ocupados.", status: "Ativo", sortOrder: 4 },
  ],
  workStatuses: [
    { id: "ws1", name: "Planejamento", description: "Obra em estudo ou orçamento.", color: "#2563eb", sortOrder: 1, status: "Ativo" },
    { id: "ws2", name: "Em andamento", description: "Obra em execução.", color: "#0f766e", sortOrder: 2, status: "Ativo" },
    { id: "ws3", name: "Concluída", description: "Obra finalizada.", color: "#147a47", sortOrder: 3, status: "Ativo" },
  ],
  standardStages: [
    { id: "stg1", workTypeId: "wt1", name: "Mobilização", description: "Preparação inicial da obra.", sortOrder: 1, defaultPhysicalPercent: 5, status: "Ativo" },
    { id: "stg2", workTypeId: "wt1", name: "Fundação", description: "Serviços de fundação.", sortOrder: 2, defaultPhysicalPercent: 15, status: "Ativo" },
    { id: "stg3", workTypeId: "wt2", name: "Projeto e homologação", description: "Projeto fotovoltaico e trâmite na concessionária.", sortOrder: 1, defaultPhysicalPercent: 25, status: "Ativo" },
    { id: "stg4", workTypeId: "wt2", name: "Instalação e comissionamento", description: "Montagem, testes e entrega.", sortOrder: 2, defaultPhysicalPercent: 75, status: "Ativo" },
  ],
  standardMilestones: [
    { id: "stm1", workTypeId: "wt1", standardStageId: "stg2", name: "Fundação concluída", defaultMessage: "Fundação concluída conforme cronograma.", visibleToClient: "Sim", sortOrder: 1, status: "Ativo" },
    { id: "stm2", workTypeId: "wt2", standardStageId: "stg4", name: "Sistema comissionado", defaultMessage: "Sistema fotovoltaico comissionado e pronto para entrega.", visibleToClient: "Sim", sortOrder: 1, status: "Ativo" },
  ],
  customFields: [
    { id: "cf1", workTypeId: "wt2", fieldName: "potência instalada", fieldType: "Número", options: "", required: "Sim", sortOrder: 1, status: "Ativo" },
    { id: "cf2", workTypeId: "wt2", fieldName: "modalidade", fieldType: "Seleção", options: "on-grid; off-grid; híbrido; grid zero", required: "Sim", sortOrder: 2, status: "Ativo" },
    { id: "cf3", workTypeId: "wt1", fieldName: "área construída", fieldType: "Número", options: "", required: "Não", sortOrder: 1, status: "Ativo" },
  ],
  customFieldValues: [],
  viabilityAnalyses: [],
  plugins: [
    { id: "pl1", name: "Portal do Cliente", url: "https://schimanskiengenharia.com.br/portal", icon: "🌐", description: "Acesso ao portal externo do cliente (URL configurável).", roles: "", sortOrder: 1, status: "Ativo" },
    { id: "pl2", name: "Estudo de Seletividade", url: "./plugins/seletividade/", icon: "⚡", description: "Coordenograma e ajustes de proteção (50/51) com curvas IEC e PDF.", roles: "", sortOrder: 2, status: "Ativo" },
  ],
  sinapiReferences: [
    { id: "sr1", uf: "MS", referenceMonth: 4, referenceYear: 2026, priceType: "Sem desoneração", source: "SINAPI/CAIXA", defaultUf: "MS", locationName: "Campo Grande/MS", issueDate: "2026-05-12", availableTypes: "Sem desoneração; Com desoneração; Sem encargos sociais", importDate: "2026-06-08", importUserId: "u1", status: "Ativo" },
    { id: "sr2", uf: "MS", referenceMonth: 4, referenceYear: 2026, priceType: "Com desoneração", source: "SINAPI/CAIXA", defaultUf: "MS", locationName: "Campo Grande/MS", issueDate: "2026-05-12", availableTypes: "Sem desoneração; Com desoneração; Sem encargos sociais", importDate: "2026-06-08", importUserId: "u1", status: "Ativo" },
    { id: "sr3", uf: "MS", referenceMonth: 4, referenceYear: 2026, priceType: "Sem encargos sociais", source: "SINAPI/CAIXA", defaultUf: "MS", locationName: "Campo Grande/MS", issueDate: "2026-05-12", availableTypes: "Sem desoneração; Com desoneração; Sem encargos sociais", importDate: "2026-06-08", importUserId: "u1", status: "Ativo" },
  ],
  sinapiInputs: [
    { id: "si1", sinapiReferenceId: "sr1", referenceType: "ISD", uf: "MS", classification: "Mão de obra", code: "00000001", description: "Ajudante de eletricista", unit: "h", priceOrigin: "CR", unitPrice: 22.5, origin: "SINAPI/CAIXA", category: "Mão de obra", status: "Ativo" },
  ],
  sinapiCompositions: [
    { id: "sc1", sinapiReferenceId: "sr1", referenceType: "CSD", uf: "MS", code: "CP-SINAPI-001", description: "Instalação de eletroduto PVC embutido", unit: "m", unitCost: 18.75, percentAS: 0, type: "Composição", groupName: "Instalações elétricas", className: "Baixa tensão", status: "Ativo" },
  ],
  sinapiCompositionItems: [],
  sinapiLabor: [],
  sinapiFamilies: [],
  sinapiMaintenances: [],
  sinapiSettings: [
    { id: "sinapiCfg1", defaultUf: "MS", defaultReferenceMonth: 4, defaultReferenceYear: 2026, defaultReferenceType: "Sem desoneração", defaultBdiPercent: 25, defaultItemMode: "Composições", showSinapiCodeInProposal: "Não", showAnalyticalInProposal: "Não", showUnitPriceInProposal: "Sim", showGlobalOnlyInProposal: "Não", status: "Ativo" },
  ],
  ownCompositions: [
    { id: "oc1", code: "CP-001", description: "Projeto elétrico comercial", unit: "un", estimatedCost: 1200, laborCost: 900, materialCost: 0, equipmentCost: 0, thirdPartyCost: 300, marginPercent: 45, suggestedPrice: 1740, status: "Ativo" },
    { id: "oc2", code: "CP-002", description: "Relatório técnico de vistoria", unit: "un", estimatedCost: 650, laborCost: 500, materialCost: 0, equipmentCost: 0, thirdPartyCost: 150, marginPercent: 40, suggestedPrice: 910, status: "Ativo" },
  ],
  workBudgets: [
    { id: "wb1", projectId: "ob1", clientId: "c1", name: "Orçamento base Residencial Primavera", version: "v1", budgetDate: "2026-06-07", sinapiReferenceId: "sr1", priceType: "Sem desoneração", status: "Rascunho", bdiPercent: 25, chargesPercent: 0, discountPercent: 0, directCost: 18750, totalCost: 18750, totalPrice: 23437.5, notes: "Orçamento exemplo integrado à obra.", createdByUserId: "u1", commercialUserId: "u1" },
  ],
  workBudgetItems: [
    { id: "wbi1", workBudgetId: "wb1", projectId: "ob1", origin: "SINAPI", sinapiReferenceId: "sr1", sinapiUf: "MS", sinapiReferenceType: "Sem desoneração", code: "CP-SINAPI-001", description: "Instalação de eletroduto PVC embutido", unit: "m", quantity: 500, unitCost: 18.75, totalCost: 9375, bdiPercent: 25, unitPrice: 23.44, totalPrice: 11718.75, stageName: "Instalações", costCenterId: "cc2", categoryId: "cat3", notes: "" },
    { id: "wbi2", workBudgetId: "wb1", projectId: "ob1", origin: "Composição própria", code: "CP-001", description: "Projeto elétrico comercial", unit: "un", quantity: 1, unitCost: 1200, totalCost: 1200, bdiPercent: 45, unitPrice: 1740, totalPrice: 1740, stageName: "Projeto executivo", costCenterId: "cc2", categoryId: "cat2", notes: "" },
  ],
  quotes: [
    { id: "qt1", supplierId: "f1", description: "Quadro de distribuição completo", unit: "un", quantity: 2, unitValue: 1850, totalValue: 3700, quoteDate: "2026-06-07", validityDate: "2026-06-22", attachmentPath: "/var/lib/financeiro/uploads/cotacoes/exemplo.pdf", projectId: "ob1", workBudgetId: "wb1", notes: "Cotação exemplo, anexo fora da pasta pública.", status: "Em cotação" },
  ],
  reportModels: [
    { id: "rm1", name: "Relatório de obra", workTypeId: "wt1", serviceSubtypeId: "", body: "Relatório de {{nome_obra}} em {{data}}. Avanço físico: {{percentual_fisico}}.", variables: "{{nome_cliente}}, {{nome_obra}}, {{data}}, {{percentual_fisico}}, {{fotos}}", status: "Ativo" },
  ],
  documentTypes: [
    { id: "dt1", name: "Nota fiscal", description: "Documento fiscal vinculado a obra, fornecedor ou conta.", folder: "notas-fiscais", visibleToClientDefault: "Não", status: "Ativo" },
    { id: "dt2", name: "Projeto técnico", description: "Arquivo técnico de projeto.", folder: "projetos", visibleToClientDefault: "Sim", status: "Ativo" },
  ],
  checklists: [
    { id: "chk1", name: "Checklist de entrega final", workTypeId: "wt1", standardStageId: "", required: "Sim", allowsPhoto: "Sim", allowsAttachment: "Sim", status: "Ativo" },
  ],
  checklistItems: [
    { id: "chki1", checklistId: "chk1", description: "Conferir documentação final da obra.", required: "Sim", sortOrder: 1, status: "Ativo" },
  ],
  measurementTypes: [
    { id: "mt1", name: "Medição física", description: "Percentual físico executado.", unit: "%", status: "Ativo" },
    { id: "mt2", name: "Medição financeira", description: "Valor financeiro executado.", unit: "R$", status: "Ativo" },
  ],
  paymentMethods: [
    { id: "pmtd1", name: "Entrada + parcelas", description: "Entrada e saldo parcelado conforme proposta.", installments: 3, status: "Ativo" },
  ],
  whatsappTemplates: [
    { id: "wtpl1", name: "Atualização de marco", context: "Marco", message: "Olá, {{nome_cliente}}. Atualização da obra {{nome_obra}}: {{nome_marco}}.", status: "Ativo" },
  ],
  visibilityRules: [
    { id: "vr1", role: "cliente_obra", module: "projectSchedule", workTypeId: "", rule: "Visualizar apenas etapas e documentos liberados ao cliente.", status: "Ativo" },
  ],
  fiscalDocuments: [],
  projectSchedule: [
    { id: "cr1", projectId: "ob1", stageName: "Projeto executivo", description: "Projeto e compatibilização técnica.", sortOrder: 1, plannedStartDate: "2026-05-01", plannedEndDate: "2026-05-30", actualStartDate: "2026-05-01", actualEndDate: "2026-05-28", plannedPhysicalPercent: 100, actualPhysicalPercent: 100, plannedFinancialAmount: 12000, actualFinancialAmount: 11800, status: "Concluída", responsible: "Alef Schimanski", isMilestone: "Sim", milestoneName: "Projeto executivo concluído", milestoneMessage: "Projeto executivo finalizado e liberado para a próxima etapa.", visibleToClient: "Sim", notes: "Etapa concluída." },
    { id: "cr2", projectId: "ob1", stageName: "Execução de infraestrutura", description: "Infraestrutura inicial da obra.", sortOrder: 2, plannedStartDate: "2026-06-01", plannedEndDate: "2026-07-15", actualStartDate: "2026-06-02", actualEndDate: "", plannedPhysicalPercent: 70, actualPhysicalPercent: 35, plannedFinancialAmount: 36000, actualFinancialAmount: 14800, status: "Em andamento", responsible: "Rafael", isMilestone: "Não", milestoneName: "", milestoneMessage: "", visibleToClient: "Não", notes: "Acompanhar compras pendentes." },
    { id: "cr3", projectId: "ob1", stageName: "Instalações elétricas iniciadas", description: "Início das instalações elétricas.", sortOrder: 3, plannedStartDate: "2026-07-16", plannedEndDate: "2026-08-20", actualStartDate: "", actualEndDate: "", plannedPhysicalPercent: 45, actualPhysicalPercent: 0, plannedFinancialAmount: 28000, actualFinancialAmount: 0, status: "Não iniciada", responsible: "Equipe técnica", isMilestone: "Sim", milestoneName: "Instalações elétricas iniciadas", milestoneMessage: "Início das instalações elétricas programado.", visibleToClient: "Sim", notes: "" },
  ],
  projectMilestones: [
    { id: "mk1", projectId: "ob1", scheduleStepId: "cr1", name: "Projeto executivo concluído", defaultMessage: "Projeto executivo concluído e liberado para execução.", visibleToClient: "Sim", plannedDate: "2026-05-30", completedDate: "2026-05-28", status: "Concluído", notes: "" },
    { id: "mk2", projectId: "ob1", scheduleStepId: "cr3", name: "Instalações elétricas iniciadas", defaultMessage: "Início das instalações elétricas.", visibleToClient: "Sim", plannedDate: "2026-07-16", completedDate: "", status: "Pendente", notes: "" },
  ],
  projectNotifications: [],
  projectTrackingLinks: [
    { id: "lk1", projectId: "ob1", token: "interno-ob1", url: "https://schimanskiengenharia.com.br/financeiro", visibility: "Cliente/Investidor", status: "Ativo", notes: "Link interno temporário até criação do portal do cliente." },
  ],
  purchaseOrders: [
    { id: "pcp1", number: "PC-2026-001", date: "2026-06-03", projectId: "ob1", supplierId: "f1", costCenterId: "cc2", categoryId: "cat3", amount: 4850, expectedDate: "2026-06-20", status: "Aprovado", notes: "Materiais elétricos para obra." },
  ],
  technicalReports: [
    { id: "rt1", projectId: "ob1", title: "Relatório de medição inicial", date: "2026-06-05", responsible: "Alef Schimanski", visibleToClient: "Não", status: "Liberado interno", notes: "Registro técnico de avanço físico." },
  ],
  budgets: [
    { id: "o1", number: "ORC-2026-001", date: "2026-06-01", clientId: "c1", projectId: "ob1", costCenterId: "cc1", description: "Software fiscal + consultoria", amount: 2780, status: "Aprovado" },
    { id: "o2", number: "ORC-2026-002", date: "2026-06-03", clientId: "c2", projectId: "ob2", costCenterId: "cc2", description: "Implantação contábil", amount: 2200, status: "Aberto" },
  ],
  proposalAreas: [
    { id: "pa1", name: "Engenharia Elétrica", description: "Projetos, execução, laudos e consultoria elétrica.", status: "Ativo" },
    { id: "pa2", name: "Engenharia Civil", description: "Projetos, execução, laudos e consultoria civil.", status: "Ativo" },
    { id: "pa3", name: "Arquitetura", description: "Projetos arquitetônicos, interiores, regularização e acompanhamento.", status: "Ativo" },
    { id: "pa4", name: "Gestão de Obras", description: "Planejamento, gestão, medição, relatórios e entrega.", status: "Ativo" },
    { id: "pa5", name: "Energia Solar Fotovoltaica", description: "Projetos, execução, inspeções e consultoria solar.", status: "Ativo" },
  ],
  proposalActionTypes: [
    { id: "pat1", areaId: "pa1", name: "Projetos", description: "Projetos técnicos de engenharia elétrica.", status: "Ativo" },
    { id: "pat2", areaId: "pa1", name: "Execução", description: "Execução, reforma, adequação e manutenção elétrica.", status: "Ativo" },
    { id: "pat3", areaId: "pa1", name: "Laudos e relatórios", description: "Laudos técnicos, relatórios e inspeções elétricas.", status: "Ativo" },
    { id: "pat4", areaId: "pa2", name: "Projetos", description: "Projetos civis e complementares.", status: "Ativo" },
    { id: "pat5", areaId: "pa2", name: "Execução", description: "Construções, reformas, ampliação e fiscalização.", status: "Ativo" },
    { id: "pat6", areaId: "pa3", name: "Projetos", description: "Arquitetônico, legal, executivo, interiores e regularização.", status: "Ativo" },
    { id: "pat7", areaId: "pa4", name: "Gestão", description: "Gestão, fiscalização, medição e relatórios periódicos.", status: "Ativo" },
    { id: "pat8", areaId: "pa5", name: "Projetos", description: "On-grid, off-grid, híbrido, grid zero e usina de solo.", status: "Ativo" },
    { id: "pat9", areaId: "pa5", name: "Execução", description: "Instalação, retrofit, adequação e manutenção solar.", status: "Ativo" },
  ],
  proposalServiceSubtypes: [
    { id: "ps1", actionTypeId: "pat1", name: "Instalações elétricas de baixa tensão", description: "Projeto elétrico completo para baixa tensão.", status: "Ativo" },
    { id: "ps2", actionTypeId: "pat1", name: "SPDA e aterramento", description: "Projeto de proteção contra descargas atmosféricas e aterramento.", status: "Ativo" },
    { id: "ps3", actionTypeId: "pat2", name: "Reforma elétrica", description: "Adequação e modernização de instalações.", status: "Ativo" },
    { id: "ps4", actionTypeId: "pat3", name: "Laudo técnico elétrico", description: "Análise técnica e emissão de laudo.", status: "Ativo" },
    { id: "ps5", actionTypeId: "pat4", name: "Projeto estrutural", description: "Projeto estrutural civil.", status: "Ativo" },
    { id: "ps6", actionTypeId: "pat5", name: "Reforma", description: "Execução de reforma civil.", status: "Ativo" },
    { id: "ps7", actionTypeId: "pat6", name: "Projeto arquitetônico", description: "Projeto arquitetônico completo.", status: "Ativo" },
    { id: "ps8", actionTypeId: "pat7", name: "Relatórios periódicos", description: "Relatórios de acompanhamento e medição.", status: "Ativo" },
    { id: "ps9", actionTypeId: "pat8", name: "Sistema on-grid", description: "Projeto de sistema fotovoltaico conectado à rede.", status: "Ativo" },
    { id: "ps10", actionTypeId: "pat9", name: "Instalação comercial", description: "Instalação fotovoltaica em unidade comercial.", status: "Ativo" },
  ],
  proposalModels: [
    {
      id: "pm1",
      name: "Projeto elétrico comercial",
      areaId: "pa1",
      actionTypeId: "pat1",
      subtypeId: "ps1",
      proposalObject: "Elaboração de projeto elétrico comercial para {{nome_obra}}.",
      scope: "Levantamento técnico, dimensionamento, diagramas, quadros, iluminação, tomadas e memorial descritivo.",
      stages: "1. Levantamento; 2. Anteprojeto; 3. Projeto executivo; 4. Entrega técnica.",
      deliverables: "Pranchas, memorial descritivo, lista de materiais e ART.",
      deadline: "30 dias",
      paymentTerms: "40% na aprovação, 40% na entrega preliminar e 20% no aceite.",
      includedItems: "Reuniões técnicas, arquivos PDF e revisão técnica.",
      excludedItems: "Taxas, execução da obra e aprovações externas não contratadas.",
      clientResponsibilities: "Fornecer documentos, acesso ao local e informações de carga.",
      companyResponsibilities: "Elaborar documentos técnicos e orientar ajustes necessários.",
      validityDays: 15,
      generalConditions: "Esta proposta considera as premissas técnicas informadas até a data de emissão. Alterações de escopo poderão gerar revisão comercial.",
      acceptanceText: "Aceite eletrônico ou assinatura da proposta.",
      signatureText: "Schimanski Engenharia\nResponsável técnico: {{responsavel_tecnico}}\nCREA/CAU: {{crea_cau}}",
      printLayout: "Padrão A4",
      status: "Ativo",
    },
  ],
  proposals: [
    { id: "prop1", number: "PROP-2026-001", date: "2026-06-01", clientId: "c1", projectId: "ob1", budgetId: "o1", serviceId: "s1", modelId: "pm1", areaId: "pa1", actionTypeId: "pat1", subtypeId: "ps1", origin: "Nova demanda", parentProposalId: "", createdByUserId: "u2", commercialUserId: "u2", description: "Projeto elétrico comercial completo.", amount: 2780, paymentTerms: "Entrada e saldo na entrega.", deadline: "30 dias", validityDate: "2026-06-16", status: "Aprovada" },
    { id: "prop2", number: "PROP-2026-002", date: "2026-06-03", clientId: "c2", projectId: "ob2", budgetId: "o2", serviceId: "s2", modelId: "", areaId: "pa4", actionTypeId: "pat7", subtypeId: "ps8", origin: "Derivada de obra existente", parentProposalId: "", createdByUserId: "u1", commercialUserId: "u1", description: "Relatórios periódicos de acompanhamento.", amount: 2200, paymentTerms: "Mensal.", deadline: "Sob demanda", validityDate: "2026-06-18", status: "Enviada" },
  ],
  proposalItems: [],
  proposalStatusHistory: [],
  proposalFiles: [],
  proposalBudgetLinks: [],
  proposalVariables: [],
  sales: [
    { id: "v1", number: "VEN-2026-001", date: "2026-06-02", competenceDate: "2026-06-01", clientId: "c1", projectId: "ob1", costCenterId: "cc1", description: "Contrato software e consultoria", amount: 2780, cost: 1120, status: "Aprovado" },
    { id: "v2", number: "VEN-2026-002", date: "2026-06-04", competenceDate: "2026-06-01", clientId: "c2", projectId: "ob2", costCenterId: "cc2", description: "Implantação contábil", amount: 2200, cost: 900, status: "Aprovado" },
  ],
  receivable: [
    { id: "r1", document: "NF-1001", issueDate: "2026-06-02", dueDate: "2026-06-10", receivedDate: "2026-06-04", clientId: "c1", projectId: "ob1", categoryId: "cat1", costCenterId: "cc1", bankAccount: "Banco Principal", amount: 2780, status: "Recebido" },
    { id: "r2", document: "NF-1002", issueDate: "2026-06-04", dueDate: "2026-06-20", receivedDate: "", clientId: "c2", projectId: "ob2", categoryId: "cat2", costCenterId: "cc2", bankAccount: "Banco Principal", amount: 2200, status: "Aberto" },
    { id: "r3", document: "NF-0998", issueDate: "2026-05-10", dueDate: "2026-05-25", receivedDate: "", clientId: "c1", projectId: "ob1", categoryId: "cat2", costCenterId: "cc1", bankAccount: "Banco Principal", amount: 1450, status: "Vencido" },
  ],
  payable: [
    { id: "pg1", document: "BOL-450", issueDate: "2026-06-01", dueDate: "2026-06-12", paidDate: "", supplierId: "f1", projectId: "ob1", categoryId: "cat3", costCenterId: "cc2", bankAccount: "Banco Principal", amount: 1650, status: "Aberto" },
    { id: "pg2", document: "NF-TEC-88", issueDate: "2026-06-01", dueDate: "2026-06-05", paidDate: "2026-06-05", supplierId: "f2", projectId: "ob2", categoryId: "cat4", costCenterId: "cc3", bankAccount: "Banco Principal", amount: 760, status: "Pago" },
  ],
  cashMoves: [
    { id: "m1", date: "2026-06-04", bankAccount: "Banco Principal", type: "Entrada", categoryId: "cat1", projectId: "ob1", costCenterId: "cc1", history: "Recebimento NF-1001", amount: 2780, originDocument: "NF-1001" },
    { id: "m2", date: "2026-06-05", bankAccount: "Banco Principal", type: "Saída", categoryId: "cat4", projectId: "ob2", costCenterId: "cc3", history: "Pagamento NF-TEC-88", amount: 760, originDocument: "NF-TEC-88" },
  ],
  journalEntries: [
    { id: "l1", entryDate: "2026-06-02", competenceDate: "2026-06-01", debitAccountId: "pc2", creditAccountId: "pc4", history: "Reconhecimento de receita NF-1001", amount: 2780, costCenterId: "cc1", originDocument: "NF-1001" },
    { id: "l2", entryDate: "2026-06-05", competenceDate: "2026-06-01", debitAccountId: "pc7", creditAccountId: "pc1", history: "Despesa administrativa NF-TEC-88", amount: 760, costCenterId: "cc3", originDocument: "NF-TEC-88" },
  ],
  taxDocuments: [
    { id: "df1", document: "NF-1001", date: "2026-06-02", type: "Nota fiscal", clientId: "c1", supplierId: "", amount: 2780, status: "Emitido" },
  ],
  taxes: [
    { id: "tx1", name: "ISS", competenceDate: "2026-06-01", baseAmount: 2780, rate: 5, amount: 139, status: "Aberto" },
  ],
  companySettings: [
    { id: "co1", name: "Schimanski Engenharia", document: "00.000.000/0001-00", email: "contato@empresa.com", phone: "(65) 3000-0000", city: "Cuiabá", status: "Ativo" },
  ],
  users: [
    { id: "u1", username: "admin", fullName: "Administrador", role: "admin", status: "Ativo" },
    { id: "u2", username: "alefschimanski", fullName: "alefschimanski", role: "admin", status: "Ativo" },
  ],
  permissions: [
    { id: "perm1", role: "admin", module: "*", canView: "Sim", canCreate: "Sim", canEdit: "Sim", canDelete: "Sim", canExport: "Sim", canApprove: "Sim", canAttach: "Sim", status: "Ativo" },
    { id: "perm2", role: "financeiro", module: "financeiro", canView: "Sim", canCreate: "Sim", canEdit: "Sim", canDelete: "Não", canExport: "Sim", canApprove: "Sim", canAttach: "Sim", status: "Ativo" },
    { id: "perm3", role: "comercial", module: "propostas", canView: "Sim", canCreate: "Sim", canEdit: "Sim", canDelete: "Não", canExport: "Sim", canApprove: "Não", canAttach: "Não", status: "Ativo" },
    { id: "perm4", role: "engenharia", module: "obras", canView: "Sim", canCreate: "Não", canEdit: "Sim", canDelete: "Não", canExport: "Sim", canApprove: "Não", canAttach: "Sim", status: "Ativo" },
  ],
  systemVersion: [
    { id: "ver1", versao: APP_VERSION, data_versao: APP_VERSION_DATE, descricao: "ObraSync: base integrada de gestão financeira, comercial e de obras.", alteracoes: APP_CHANGELOG.join("\n") },
  ],
  preferences: [
    { id: "pref1", name: "Moeda padrão", value: "BRL", description: "Moeda usada nos relatórios financeiros.", status: "Ativo" },
    { id: "pref2", name: "Publicação", value: "Apache", description: "Aplicação estática compatível com hospedagem em servidor Apache.", status: "Ativo" },
  ],
  agendaEvents: [],
  kanbanBoards: [
    { id: "kb-geral", obra_id: "", nome: "Board geral", tipo: "geral" },
  ],
  kanbanColumns: [
    { id: "kc-geral-1", board_id: "kb-geral", nome: "A fazer", ordem: 10, cor: "#185FA5" },
    { id: "kc-geral-2", board_id: "kb-geral", nome: "Em andamento", ordem: 20, cor: "#B8872D" },
    { id: "kc-geral-3", board_id: "kb-geral", nome: "Aguardando aprovação", ordem: 30, cor: "#7C3AED" },
    { id: "kc-geral-4", board_id: "kb-geral", nome: "Concluído", ordem: 40, cor: "#147A47" },
  ],
  kanbanCards: [],
};

let db = loadDb();
let currentModule = "dashboard";
let editing = null;
let currentUser = null;
let myPermissions = {}; // overrides de permissão do usuário logado (vêm do bootstrap)

function loadDb() {
  let loaded = null;
  try {
    const stored = localStorage.getItem(STORE_KEY);
    loaded = stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("Dados locais ilegíveis ou corrompidos; usando dados de exemplo.", error);
    loaded = null;
  }
  if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) {
    loaded = structuredClone(seed);
  }
  Object.keys(seed).forEach((key) => {
    if (!Array.isArray(loaded[key])) loaded[key] = structuredClone(seed[key]);
  });
  return loaded;
}

function saveDb() {
  if (serverMode) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch (error) {
    console.error("Não foi possível salvar os dados locais (quota ou armazenamento indisponível).", error);
  }
}

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}`, "X-Auth-Token": authToken } : {};
}

// Tratamento comum das respostas da API (apiRequest e fetchForm): parse do
// JSON, renovação única do token em 401 (outra aba pode ter refeito o login;
// retry = null quando a tentativa única já foi gasta) e conversão de erros
// HTTP em Error com status.
async function handleApiResponse(response, path, retry) {
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      console.error("Resposta não-JSON da API:", path, response.status, text.slice(0, 500));
      const error = new Error(`O servidor respondeu em formato inesperado (HTTP ${response.status}). Tente novamente ou contate o administrador.`);
      error.status = response.status;
      throw error;
    }
  }
  if (response.status === 401) {
    if (retry) {
      const staleToken = authToken;
      readAuthSession();
      if (authToken && authToken !== staleToken) {
        return retry();
      }
    }
    authToken = null;
    clearAuthSession();
    if (currentUser) showLogin(payload.error || "Sessão expirada. Faça login novamente.");
    const error = new Error(payload.error || "Não autenticado.");
    error.status = 401;
    throw error;
  }
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.error || `Erro HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function apiRequest(path, options = {}) {
  // Apache/PHP-CGI pode remover o header Authorization em DELETE/PUT/PATCH; o
  // X-Auth-Token (authHeaders) cobre esses casos. O antigo fallback ?token= na
  // query string foi removido: deixava o token de sessão nos access logs.
  let response;
  try {
    response = await fetch(`${API_BASE}/${path}`, {
      headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
      ...options,
    });
  } catch (networkError) {
    const error = new Error("Falha de conexão com o servidor. Verifique a rede e tente novamente.");
    error.cause = networkError;
    throw error;
  }
  const retry = options._retried ? null : () => apiRequest(path, { ...options, _retried: true });
  return handleApiResponse(response, path, retry);
}

// Wrapper para uploads multipart (FormData) — não pode usar apiRequest pois ele força JSON.
async function fetchForm(path, formData, _retried = false) {
  let response;
  try {
    response = await fetch(`${API_BASE}/${path}`, { method: "POST", headers: authHeaders(), body: formData });
  } catch (networkError) {
    const error = new Error("Falha de conexão com o servidor. Verifique a rede e tente novamente.");
    error.cause = networkError;
    throw error;
  }
  const retry = _retried ? null : () => fetchForm(path, formData, true);
  return handleApiResponse(response, path, retry);
}

async function loadServerData() {
  if (APP_ENV === "file") {
    serverMode = false;
    serverStatus = "Abra pelo Apache para usar a API PHP";
    return;
  }

  // O bootstrap é tratado com fetch direto para distinguir três casos sem
  // acionar os efeitos colaterais do apiRequest (limpar sessão, chamar showLogin).
  let response;
  try {
    response = await fetch(`${API_BASE}/bootstrap`, {
      headers: { "Content-Type": "application/json", ...authHeaders() },
    });
  } catch {
    // Falha de rede real: servidor fora do ar, CORS, timeout de conexão.
    serverMode = false;
    serverStatus = "API indisponível: falha de conexão";
    return;
  }

  let payload = {};
  try {
    const text = await response.text();
    if (text) payload = JSON.parse(text);
  } catch {
    // Resposta não-JSON (ex.: página de erro do Apache). Continua com payload vazio.
  }

  // Caso 1 — API ativa mas usuário não autenticado: 401 OU ok:false (independente
  // do status HTTP). O bootstrap só retorna ok:false por falha de autenticação.
  if (response.status === 401 || payload.ok === false) {
    serverMode = true;
    serverStatus = "Conectado ao servidor";
    return;
  }

  // Caso 2 — Erro real do servidor (5xx, 4xx que não é 401).
  if (!response.ok) {
    serverMode = false;
    serverStatus = `API indisponível: HTTP ${response.status}`;
    return;
  }

  // Caso 3 — Sucesso: carrega os dados no banco local.
  db = { ...structuredClone(seed), ...payload.data };
  Object.keys(seed).forEach((key) => {
    if (!Array.isArray(db[key])) db[key] = [];
  });
  myPermissions = payload.data.userPermissions || {};
  serverMode = true;
  serverStatus = "Conectado ao servidor";
}

async function refreshData() {
  if (!serverMode) return;
  const payload = await apiRequest("bootstrap");
  db = { ...structuredClone(seed), ...payload.data };
  Object.keys(seed).forEach((key) => {
    if (!Array.isArray(db[key])) db[key] = [];
  });
  myPermissions = payload.data.userPermissions || {};
}

async function refreshAndRender() {
  await refreshData();
  render();
}

// Módulos cuja gravação dispara automações no SERVIDOR que criam ou alteram
// registros em OUTRAS coleções (kanban da obra, NC automática, conta a receber
// de marco, bloqueio de etapa, obra gerada por proposta aprovada...). Só esses
// precisam refazer o bootstrap completo após salvar; o CRUD comum já aplica o
// registro retornado pela API no db local e apenas re-renderiza — sem baixar o
// banco inteiro a cada "Salvar".
const SERVER_AUTOMATION_KEYS = new Set([
  "projects", "purchaseOrders", "projectMilestones", "projectSchedule",
  "proposals", "agendaEvents", "kanbanCards",
  "qualidadePolitica", "qualidadePes", "qualidadePqo", "qualidadeFvs",
  "qualidadeFvm", "qualidadeNc", "qualidadeAuditorias",
]);

async function refreshAfterMutation(key) {
  if (serverMode && SERVER_AUTOMATION_KEYS.has(key)) {
    await refreshAndRender();
    return;
  }
  render();
}

function nowMs() {
  return Date.now();
}

function readAuthSession() {
  let raw = null;
  try {
    raw = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (!session?.userId || !session.lastActivity) return null;
    if (nowMs() - Number(session.lastActivity) > AUTH_TIMEOUT_MS) {
      clearAuthSession();
      return null;
    }
    authToken = session.token || authToken;
    return session;
  } catch {
    clearAuthSession();
    return null;
  }
}

function writeAuthSession(user) {
  const session = JSON.stringify({
    userId: user.id,
    user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, status: user.status, mustChangePassword: Number(user.mustChangePassword) ? 1 : 0 },
    token: authToken,
    lastActivity: nowMs(),
  });
  try {
    localStorage.setItem(AUTH_KEY, session);
    sessionStorage.setItem(AUTH_KEY, session);
  } catch {
    // Armazenamento indisponível (modo privado/quota): sessão vale só em memória.
  }
}

function touchAuthSession() {
  if (!currentUser) return;
  writeAuthSession(currentUser);
}

function clearAuthSession() {
  authToken = null;
  try {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
  } catch {
    // Armazenamento indisponível: nada a limpar.
  }
}

function handleUserActivity() {
  const session = readAuthSession();
  if (!currentUser || !session) return;
  touchAuthSession();
  if (!document.getElementById("sessionWarningDialog")?.open) {
    clearTimeout(sessionWarnTimer);
    scheduleSessionWarning();
  }
}

function enforceInactivityTimeout() {
  if (!currentUser) return;
  if (!readAuthSession()) {
    showLogin("Sessão expirada por inatividade.");
  }
}

function qs(id) {
  return document.getElementById(id);
}

function byId(collection, id) {
  return (db[collection] || []).find((item) => sameId(item.id, id));
}

function nameOf(collection, id) {
  const row = byId(collection, id);
  if (!row) return "";
  return row.name || row.nome || row.titulo || row.stageName || row.title || row.number || row.document || row.code || row.fieldName || row.description || "";
}

function asMoney(value) {
  return money.format(Number(value || 0));
}

function asDate(value) {
  return value ? dateFmt.format(new Date(`${value}T00:00:00Z`)) : "";
}

function isMoneyField(field) {
  return [
    "amount", "price", "cost", "total", "openingBalance", "baseAmount", "revenue", "expense", "result", "balance",
    "budgetForecast", "revenueContracted", "costForecast", "realizedCost", "plannedFinancialAmount", "actualFinancialAmount",
    "directCost", "totalCost", "totalPrice", "unitCost", "unitPrice", "estimatedCost", "laborCost", "materialCost",
    "equipmentCost", "thirdPartyCost", "suggestedPrice", "unitValue", "totalValue", "precoUnitario", "custoUnitario",
    "entradasPrevistas", "entradasRealizadas", "saidasPrevistas", "saidasRealizadas", "saldoFinal",
    "contractValue", "grossMargin", "estimatedProfit", "npv",
  ].includes(field);
}

function isPercentField(field) {
  return ["rate", "margin", "expectedMargin", "realizedMargin", "physicalProgress", "financialProgress", "plannedPhysicalPercent", "actualPhysicalPercent", "bdiPercent", "chargesPercent", "discountPercent", "marginPercent", "defaultPhysicalPercent", "individualPercent", "accumulatedPercent", "percentAS", "laborPercent", "defaultBdiPercent", "tmaPercent", "irrPercent"].includes(field);
}

function placeholderFor(field, label = "", key = "") {
  const lower = `${field} ${label}`.toLowerCase();
  if (field === "name" && lower.includes("cliente")) return "João da Silva";
  if (field === "name" && lower.includes("serv")) return "Projeto elétrico comercial";
  if (field === "email") return "joao@gmail.com";
  if (field === "phone" || field === "celular") return "(67) 99999-9999";
  if (field === "cpf") return "000.000.000-00";
  if (field === "data_nascimento") return "15/08/1990";
  if (field === "username") return "joao.silva";
  if (field === "fullName") return "João da Silva";
  if (field === "document" && ["clients", "suppliers", "companySettings"].includes(key)) return "123.456.789-12 ou 12.345.678/0001-99";
  if (field === "document") return "NF-1001, BOL-450 ou recibo";
  if (["zipCode", "postalCode", "cep"].includes(field)) return "79000-000";
  if (field === "name" && key === "bankAccounts") return "Banco do Brasil — Conta Principal";
  if (field === "bank") return "Banco do Brasil, Sicoob, Itaú";
  if (field === "agency") return "1234-5 (opcional)";
  if (field === "accountNumber") return "12345-6 (opcional)";
  if (field === "openingBalance") return "0,00 — opcional; o saldo vem do extrato OFX";
  if (isMoneyField(field)) return "R$ 1.000,00";
  if (isPercentField(field)) return "10,00%";
  if (field === "description") return "Projeto elétrico comercial com entrada de energia, quadros, tomadas, iluminação e memorial descritivo.";
  if (field === "fieldName") return "potência instalada";
  if (field === "options") return "on-grid; off-grid; híbrido; grid zero";
  if (field === "unit") return "m², un, m, h ou mês";
  if (field === "code") return "SINAPI-000001 ou CP-001";
  if (field === "version") return "v1";
  if (field === "uf" || field === "defaultUf") return "MS";
  if (field === "proposalObject") return "Prestação de serviços técnicos para {{tipo_servico}} em {{nome_obra}}.";
  if (field === "scope") return "Descreva o escopo técnico, limites de fornecimento e premissas comerciais.";
  if (field === "deliverables") return "Projeto executivo, memorial descritivo, ART/RRT e arquivos digitais.";
  if (field === "paymentTerms") return "40% na aprovação, 40% na entrega técnica e 20% no aceite final.";
  if (field === "deadline") return "30 dias";
  if (field === "stage") return "Projeto executivo";
  if (field === "stageName") return "Fundação";
  if (field === "milestoneName") return "Fundação concluída";
  if (field === "milestoneMessage" || field === "defaultMessage") return "Marco concluído conforme cronograma da obra.";
  if (field === "token") return "token-seguro-futuro";
  if (field === "url") return "https://schimanskiengenharia.com.br/financeiro";
  if (field === "notes") return "Observações importantes do cadastro.";
  if (field === "address") return "Rua, número, bairro e cidade";
  if (field === "responsible") return "Nome do responsável";
  if (field === "documentNumber") return "NF-000123";
  if (field === "number") return "VEN-2026-001";
  return "";
}

function maskPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => [a && `(${a}`, a?.length === 2 ? ") " : "", b, c && `-${c}`].join(""));
  }
  return digits.replace(/^(\d{0,2})(\d{0,5})(\d{0,4}).*/, (_, a, b, c) => [a && `(${a}`, a?.length === 2 ? ") " : "", b, c && `-${c}`].join(""));
}

function maskDocument(value) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, d) => [a, b && `.${b}`, c && `.${c}`, d && `-${d}`].join(""));
  }
  return digits.replace(/^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2}).*/, (_, a, b, c, d, e) => [a, b && `.${b}`, c && `.${c}`, d && `/${d}`, e && `-${e}`].join(""));
}

function maskCep(value) {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{0,5})(\d{0,3}).*/, (_, a, b) => [a, b && `-${b}`].join(""));
}

// CPF estrito (11 dígitos): 000.000.000-00 — diferente de maskDocument, que aceita CNPJ.
function maskCpf(value) {
  return onlyDigits(value).slice(0, 11).replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, d) => [a, b && `.${b}`, c && `.${c}`, d && `-${d}`].join(""));
}

// Data BR digitada: DD/MM/AAAA.
function maskData(value) {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{0,2})(\d{0,2})(\d{0,4}).*/, (_, a, b, c) => [a, b && `/${b}`, c && `/${c}`].join(""));
}

// DD/MM/AAAA → AAAA-MM-DD (formato do banco).
function dataBrToIso(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 8) return null;
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

// AAAA-MM-DD (ou datetime do banco) → DD/MM/AAAA para exibição no formulário.
function dataIsoToBr(value) {
  const iso = String(value || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "");
}

function validateDataNascimento(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 8) return { ok: false, msg: "Data incompleta — use DD/MM/AAAA." };
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
    return { ok: false, msg: "Data inválida." };
  }
  const today = new Date();
  if (date > today) return { ok: false, msg: "Data não pode ser futura." };
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  if (age < 16) return { ok: false, msg: "Idade mínima: 16 anos." };
  if (age > 100) return { ok: false, msg: "Data de nascimento inválida." };
  return { ok: true, msg: "" };
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

function validateCelular(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  return digits[2] === "9"; // celular começa com 9
}

function validateUsername(value) {
  return /^[a-z0-9.]{3,30}$/.test(String(value || "").trim());
}

function validateNome(value) {
  return String(value || "").trim().length >= 3;
}

// Feedback visual por campo (borda verde/vermelha + mensagem abaixo do input).
function setFieldState(input, isValid, message) {
  if (!input) return;
  const wrapper = input.closest("label") || input.parentElement;
  input.classList.remove("field-ok", "field-error");
  wrapper.querySelectorAll(".field-hint-error, .field-hint-ok").forEach((el) => el.remove());
  if (isValid === null) return; // neutro: sem feedback ainda
  input.classList.add(isValid ? "field-ok" : "field-error");
  if (message) {
    const hint = document.createElement("span");
    hint.className = isValid ? "field-hint-ok" : "field-hint-error";
    hint.textContent = message;
    wrapper.appendChild(hint);
  }
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatMoneyInput(value) {
  const number = Number(value || 0);
  if (!number) return "";
  return money.format(number);
}

function parseMoneyInput(value) {
  if (typeof value === "number") return value;
  const clean = String(value || "").replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(clean || 0);
}

function formatPercentInput(value) {
  const number = Number(value || 0);
  return number ? `${number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "";
}

function asPercent(value) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function parsePercentInput(value) {
  return Number(String(value || "").replace(/[^\d,-]/g, "").replace(",", ".") || 0);
}

function validateCpf(digits) {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  const calc = (factor) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i++) total += Number(digits[i]) * (factor - i);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(10) === Number(digits[9]) && calc(11) === Number(digits[10]);
}

function validateCnpj(digits) {
  if (!/^\d{14}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  const calc = (size) => {
    const weights = size === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function canEdit() {
  return canEditModule(currentModule);
}

function canEditModule(key = currentModule) {
  if (isAdmin()) return true;
  const permissionKey = { agendaEvents: "agenda", kanbanBoards: "kanban", kanbanColumns: "kanban", kanbanCards: "kanban" }[key] || key;
  const override = myPermissions[permissionKey];
  if (override) return !!override.edit;
  if (currentUser?.role === "visualizador") return false;
  return (EDITABLE_BY_ROLE[currentUser?.role] || []).includes(permissionKey);
}

function visibleRowsForModule(key, rows) {
  if (currentUser?.role === "comercial" && ["budgets", "proposals", "workBudgets"].includes(key)) {
    return rows.filter((row) => !row.createdByUserId || sameId(row.createdByUserId, currentUser.id) || sameId(row.commercialUserId, currentUser.id));
  }
  if (currentUser?.role === "cliente_obra" && key === "technicalReports") {
    return rows.filter((row) => row.visibleToClient === "Sim" || row.status === "Liberado ao cliente");
  }
  if (currentUser?.role === "cliente_obra" && key === "projectSchedule") {
    return rows.filter((row) => row.visibleToClient === "Sim");
  }
  return rows;
}

function visibleModules() {
  const allowed = roleModules[currentUser?.role] || [];
  return modules.filter(([key]) => {
    const override = myPermissions[key];
    if (override) return !!override.view;
    return allowed.includes(key);
  });
}

function canAccessModule(key) {
  return visibleModules().some(([moduleKey]) => moduleKey === key);
}

// Padrão do PAPEL (sem override) — base da grade de permissões por usuário.
function roleCanViewDefault(role, moduleKey) {
  if (role === "admin") return true;
  return (roleModules[role] || []).includes(moduleKey);
}

function roleCanEditDefault(role, moduleKey) {
  if (role === "admin") return true;
  if (role === "visualizador") return false;
  return (EDITABLE_BY_ROLE[role] || []).includes(moduleKey);
}

// ── Permissões por usuário (override do papel) — modal admin ─────────────────
let permUserState = { userId: null, role: "", overrides: {} };

async function abrirPermissoesUsuario(userId) {
  if (!isAdmin()) return;
  try {
    const r = await apiRequest(`user-permissions-get?userId=${userId}`, { method: "GET" });
    permUserState = { userId: Number(userId), role: r.data.role, overrides: r.data.overrides || {} };
    renderPermUserModal();
  } catch (e) {
    alert(`Erro ao carregar permissões: ${e.message}`);
  }
}

// Estado efetivo de um módulo: override explícito se houver, senão padrão do papel.
function permModuleState(moduleKey) {
  const ov = permUserState.overrides[moduleKey];
  if (ov) return { view: !!ov.canView, create: !!ov.canCreate, edit: !!ov.canEdit, del: !!ov.canDelete };
  const edit = roleCanEditDefault(permUserState.role, moduleKey);
  return { view: roleCanViewDefault(permUserState.role, moduleKey), create: edit, edit, del: edit };
}

function renderPermUserModal() {
  const user = byId("users", permUserState.userId);
  const nome = user ? (user.fullName || user.name || user.username) : `#${permUserState.userId}`;
  qs("permUserModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "permUserModal";
  overlay.className = "nfse-overlay";
  overlay.innerHTML = `
    <div class="nfse-box perm-box">
      <div class="nfse-head">
        <h3>Permissões — ${svgText(nome)} <small>(${svgText(roleLabels[permUserState.role] || permUserState.role)})</small></h3>
        <button class="nfse-close" type="button" id="permFechar" aria-label="Fechar">✕</button>
      </div>
      <p class="nfse-hint">Marque o que este usuário pode além (ou aquém) do papel. Linhas iguais ao padrão do papel não viram exceção. O admin sempre tem acesso total.</p>
      <div class="perm-table-wrap">
        <table class="perm-table">
          <thead><tr><th>Módulo</th><th>Ver</th><th>Criar</th><th>Editar</th><th>Excluir</th></tr></thead>
          <tbody>
            ${modules.map(([key, label]) => {
              const s = permModuleState(key);
              return `<tr data-perm-module="${key}">
                <td>${svgText(label)}</td>
                <td><input type="checkbox" class="perm-cb" data-col="view" ${s.view ? "checked" : ""}></td>
                <td><input type="checkbox" class="perm-cb" data-col="create" ${s.create ? "checked" : ""}></td>
                <td><input type="checkbox" class="perm-cb" data-col="edit" ${s.edit ? "checked" : ""}></td>
                <td><input type="checkbox" class="perm-cb" data-col="delete" ${s.del ? "checked" : ""}></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <div class="nfse-actions">
        <button class="secondary" type="button" id="permReset">Restaurar padrão do papel</button>
        <button class="primary" type="button" id="permSalvar">Salvar permissões</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  qs("permFechar")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  qs("permReset")?.addEventListener("click", permResetUsuario);
  qs("permSalvar")?.addEventListener("click", permSalvarUsuario);
}

async function permSalvarUsuario() {
  const role = permUserState.role;
  const permissions = [];
  qs("permUserModal")?.querySelectorAll("[data-perm-module]").forEach((row) => {
    const key = row.dataset.permModule;
    const get = (col) => row.querySelector(`.perm-cb[data-col="${col}"]`)?.checked || false;
    const cur = { view: get("view"), create: get("create"), edit: get("edit"), del: get("delete") };
    const editDef = roleCanEditDefault(role, key);
    const def = { view: roleCanViewDefault(role, key), create: editDef, edit: editDef, del: editDef };
    if (cur.view !== def.view || cur.create !== def.create || cur.edit !== def.edit || cur.del !== def.del) {
      permissions.push({ module: key, canView: cur.view, canCreate: cur.create, canEdit: cur.edit, canDelete: cur.del });
    }
  });
  try {
    await apiRequest("user-permissions-save", { method: "POST", body: JSON.stringify({ userId: permUserState.userId, permissions }) });
    showToast(`Permissões salvas — ${permissions.length} exceção${permissions.length === 1 ? "" : "ões"} ao papel.`);
    qs("permUserModal")?.remove();
    if (sameId(permUserState.userId, currentUser?.id)) await refreshData();
    render();
  } catch (e) {
    alert(`Erro ao salvar: ${e.message}`);
  }
}

async function permResetUsuario() {
  if (!confirm("Remover todas as exceções e voltar ao padrão do papel?")) return;
  try {
    await apiRequest("user-permissions-reset", { method: "POST", body: JSON.stringify({ userId: permUserState.userId }) });
    showToast("Permissões restauradas ao padrão do papel.");
    qs("permUserModal")?.remove();
    if (sameId(permUserState.userId, currentUser?.id)) await refreshData();
    render();
  } catch (e) {
    alert(`Erro ao restaurar: ${e.message}`);
  }
}

// Navegação lateral: accordion, recolhimento desktop e menu ocultável no mobile.
function setupNav() {
  qs("moduleNav").addEventListener("click", (event) => {
    const groupButton = event.target.closest("[data-nav-group]");
    if (groupButton) {
      const groupId = groupButton.dataset.navGroup;
      const open = !openNavGroups.has(groupId);
      if (open) openNavGroups.add(groupId);
      else openNavGroups.delete(groupId);
      // Alterna a classe no DOM existente (sem renderNav): a transição de
      // max-height do accordion só anima se o submenu não for recriado.
      const submenu = groupButton.closest(".nav-section")?.querySelector(".nav-submenu");
      if (submenu) {
        submenu.classList.toggle("open", open);
        groupButton.setAttribute("aria-expanded", String(open));
        const caret = groupButton.querySelector(".nav-caret");
        if (caret) caret.textContent = open ? "−" : "+";
      } else {
        renderNav();
      }
      return;
    }
    // Link de plugin: deixa o navegador abrir a nova aba e apenas fecha o menu no mobile.
    if (event.target.closest("a.nav-plugin")) {
      qs("appShell").classList.remove("sidebar-open");
      qs("sidebarBackdrop").classList.add("hidden");
      return;
    }
    const button = event.target.closest("button[data-module]");
    if (!button) return;
    currentModule = button.dataset.module;
    qs("appShell").classList.remove("sidebar-open");
    qs("sidebarBackdrop").classList.add("hidden");
    render();
  });
  qs("sidebarToggle").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setSidebarCollapsed(!sidebarCollapsed);
  });
  qs("mobileMenuBtn").addEventListener("click", () => {
    qs("appShell").classList.add("sidebar-open");
    qs("sidebarBackdrop").classList.remove("hidden");
  });
  qs("sidebarBackdrop").addEventListener("click", () => {
    qs("appShell").classList.remove("sidebar-open");
    qs("sidebarBackdrop").classList.add("hidden");
  });
}

function renderNav() {
  const allowed = new Set(visibleModules().map(([key]) => key));
  qs("moduleNav").innerHTML = sidebarSections.map((section) => {
    if (section.module) {
      if (!allowed.has(section.module)) return "";
      return navButton(section.module, section.label, section.icon);
    }
    if (section.pluginLauncher) {
      const items = activePlugins();
      if (!items.length) return "";
      const open = openNavGroups.has(section.id);
      return `
        <div class="nav-section">
          <button class="nav-section-toggle" type="button" data-nav-group="${section.id}" aria-expanded="${open}">
            <span class="nav-icon">${section.icon}</span>
            <span class="nav-label">${section.label}</span>
            <span class="nav-caret">${open ? "−" : "+"}</span>
          </button>
          <div class="nav-submenu ${open ? "open" : ""}">
            ${items.map((plugin) => `
              <a class="nav-link nav-plugin" href="${escapeHtml(plugin.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(plugin.description || plugin.name)}">
                <span class="nav-dot"></span>
                <span class="nav-label">${escapeHtml(plugin.icon ? `${plugin.icon} ${plugin.name}` : plugin.name)}</span>
                <span class="nav-caret">↗</span>
              </a>
            `).join("")}
          </div>
        </div>
      `;
    }
    const items = section.modules.filter((moduleKey) => allowed.has(moduleKey));
    if (!items.length) return "";
    const active = items.includes(currentModule);
    const open = openNavGroups.has(section.id);
    return `
      <div class="nav-section ${active ? "section-active" : ""}">
        <button class="nav-section-toggle" type="button" data-nav-group="${section.id}" aria-expanded="${open}">
          <span class="nav-icon">${section.icon}</span>
          <span class="nav-label">${section.label}</span>
          <span class="nav-caret">${open ? "−" : "+"}</span>
        </button>
        <div class="nav-submenu ${open ? "open" : ""}">
          ${items.map((moduleKey) => navButton(moduleKey, moduleLabels[moduleKey], "")).join("")}
        </div>
      </div>
    `;
  }).join("");
  updateShellState();
}

function navButton(moduleKey, label, icon) {
  return `
    <button class="nav-link ${moduleKey === currentModule ? "active" : ""}" type="button" data-module="${moduleKey}">
      ${icon ? `<span class="nav-icon">${icon}</span>` : '<span class="nav-dot"></span>'}
      <span class="nav-label">${label}</span>
    </button>
  `;
}

function setSidebarCollapsed(collapsed) {
  sidebarCollapsed = collapsed;
  safeLocalSet("finconta.sidebarCollapsed", String(sidebarCollapsed));
  if (sidebarCollapsed) {
    qs("appShell").classList.remove("sidebar-open");
    qs("sidebarBackdrop").classList.add("hidden");
  }
  applySidebarWidth();
  updateShellState();
}

function applySidebarWidth() {
  const isMobile = window.innerWidth <= 860;
  const w = isMobile ? 0 : (sidebarCollapsed ? 84 : 288);
  document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
  updateFavoritesPosition();
}

function updateFavoritesPosition() {
  const isMobile = window.innerWidth <= 860;
  const left = isMobile ? 0 : (sidebarCollapsed ? 84 : 288);
  const bar = document.getElementById("favoritesBar");
  const strip = document.getElementById("favTriggerStrip");
  if (bar) bar.style.left = `${left}px`;
  if (strip) strip.style.left = `${left}px`;
}

function updateShellState() {
  qs("appShell").classList.toggle("sidebar-collapsed", sidebarCollapsed);
  qs("sidebarToggle").textContent = sidebarCollapsed ? "›" : "‹";
  qs("sidebarToggle").setAttribute("aria-label", sidebarCollapsed ? "Expandir menu" : "Recolher menu");
  qs("sidebarToggle").setAttribute("aria-expanded", String(!sidebarCollapsed));
}

function populateFilters() {
  const selected = {
    filterClient: qs("filterClient").value,
    filterSupplier: qs("filterSupplier").value,
    filterCostCenter: qs("filterCostCenter").value,
    filterProject: qs("filterProject").value,
    filterCategory: qs("filterCategory").value,
  };
  fillSelect("filterClient", db.clients, "Todos");
  fillSelect("filterSupplier", db.suppliers, "Todos");
  fillSelect("filterCostCenter", db.costCenters, "Todos");
  fillSelect("filterProject", db.projects, "Todos");
  fillSelect("filterCategory", db.categories, "Todos");
  Object.entries(selected).forEach(([id, value]) => {
    if ([...qs(id).options].some((option) => option.value === value)) qs(id).value = value;
  });
}

function fillSelect(id, rows, allLabel) {
  qs(id).innerHTML = `<option value="">${escapeHtml(allLabel)}</option>` + rows.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join("");
}

// Aceita apenas datas reais no formato AAAA-MM-DD; qualquer outro valor é descartado.
function validDateInput(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? "" : value;
}

function getFilters() {
  let start = validDateInput(qs("filterStart")?.value);
  let end = validDateInput(qs("filterEnd")?.value);
  if (start && end && start > end) [start, end] = [end, start];
  return {
    start,
    end,
    clientId: qs("filterClient").value,
    supplierId: qs("filterSupplier").value,
    costCenterId: qs("filterCostCenter").value,
    projectId: qs("filterProject").value,
    projectStatus: qs("filterProjectStatus").value,
    status: qs("filterStatus").value,
    categoryId: qs("filterCategory").value,
  };
}

function recordDate(row) {
  return row.date || row.issueDate || row.dueDate || row.entryDate || row.competenceDate || "";
}

function recordDates(row) {
  return ["date", "issueDate", "dueDate", "receivedDate", "paidDate", "entryDate", "competenceDate", "startDate", "endForecast", "completionDate", "plannedStartDate", "plannedEndDate", "actualStartDate", "actualEndDate", "plannedDate", "completedDate", "expectedDate", "validityDate", "budgetDate", "quoteDate", "importDate", "data_versao"]
    .map((field) => row[field])
    .filter(Boolean);
}

function matchesDateRange(row, start, end) {
  if (!start && !end) return true;
  const dates = recordDates(row);
  if (!dates.length) return false;
  return dates.some((date) => {
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });
}

function applyFilters(rows, options = {}) {
  const filters = getFilters();
  return rows.filter((row) => {
    if (!matchesDateRange(row, filters.start, filters.end)) return false;
    for (const key of ["clientId", "supplierId", "costCenterId", "projectId", "status", "categoryId"]) {
      if (options.ignoreProject && key === "projectId") continue;
      if (filters[key] && row[key] && row[key] !== filters[key]) return false;
    }
    const rowProjectId = row.projectId || (Object.prototype.hasOwnProperty.call(row, "budgetForecast") ? row.id : "");
    if (!options.ignoreProject && filters.projectId && String(rowProjectId || "") !== String(filters.projectId)) return false;
    const linkedProjectStatus = row.projectId ? byId("projects", row.projectId)?.status : (Object.prototype.hasOwnProperty.call(row, "budgetForecast") ? row.status : "");
    if (filters.projectStatus && linkedProjectStatus && linkedProjectStatus !== filters.projectStatus) return false;
    return true;
  });
}

function render() {
  if (!currentUser) return;
  if (!canAccessModule(currentModule)) currentModule = "dashboard";
  if (currentModule !== currentModuleTracked) {
    logAccess(currentModule);
    currentModuleTracked = currentModule;
    // Animação de entrada ao trocar de módulo (não em re-renders de filtros/CRUD).
    const content = qs("content");
    if (content) {
      content.style.animation = "none";
      content.offsetHeight; // reflow para reiniciar o keyframe
      content.style.animation = "moduleIn 0.22s ease forwards";
    }
  }
  renderNav();
  renderFavoritesBar();
  populateFilters();
  document.querySelectorAll(".nav button").forEach((button) => button.classList.toggle("active", button.dataset.module === currentModule));
  qs("pageTitle").textContent = moduleLabels[currentModule] || "";
  qs("userBadge").textContent = `${currentUser.fullName || currentUser.username} - ${roleLabels[currentUser.role] || currentUser.role} - ${serverMode ? "Servidor" : "Local"}`;
  qs("seedBtn").classList.toggle("hidden", !isAdmin() || serverMode);
  if (currentModule === "dashboard") return renderDashboard();
  if (currentModule === "projectCosts") return renderProjectCosts();
  if (currentModule === "projectRevenues") return renderProjectRevenues();
  if (currentModule === "workBudgets") return renderWorkBudgets();
  if (currentModule === "viabilityAnalyses") return renderViability();
  if (currentModule === "plugins") return renderPlugins();
  if (currentModule === "preferences") return renderPreferences();
  if (currentModule === "sinapiReferences") return renderSinapiReferences();
  if (currentModule === "sinapiSettings") return renderSinapiSettingsModule();
  if (currentModule === "qualidadeDashboard") return renderQualidadeDashboard();
  if (currentModule === "qualidadePolitica") return renderQualidadePolitica();
  if (currentModule === "qualidadePes") return renderQualidadePes();
  if (currentModule === "qualidadePqo") return renderQualidadePqo();
  if (currentModule === "qualidadeFvs") return renderQualidadeFvs();
  if (currentModule === "qualidadeFvm") return renderQualidadeFvm();
  if (currentModule === "qualidadeNc") return renderQualidadeNc();
  if (currentModule === "qualidadeTreinamentos") return renderQualidadeTreinamentos();
  if (currentModule === "qualidadeAuditorias") return renderQualidadeAuditorias();
  if (currentModule === "abcCurve") return renderAbcCurve();
  if (currentModule === "projectSchedule") return renderProjectSchedule();
  if (currentModule === "rdo") return renderRdo();
  if (currentModule === "agenda") return renderAgenda();
  if (currentModule === "kanban") return renderKanban();
  if (currentModule === "auditLog") return renderAuditLog();
  if (currentModule === "myProfile") return renderMyProfile();
  if (currentModule === "projectReport") return renderProjectReport();
  if (currentModule === "cashFlow") return renderCashFlow();
  if (currentModule === "reconciliation") return renderReconciliation();
  if (currentModule === "dre") return renderDre();
  if (currentModule.startsWith("report") || currentModule === "reports") return renderReports(currentModule);
  if (currentModule === "exports") return renderExports();
  if (currentModule === "systemVersion") return renderSystemVersion();
  if (currentModule === "backupLocal") return renderBackupLocal();
  if (currentModule === "migration") return renderMigration();
  renderCrud(currentModule);
}

// ── Diário de Obra (RDO) ────────────────────────────────────────────────────
const rdoUI = { view: "list", filtroObra: "", filtroDe: "", filtroAte: "", lista: [], atual: null, discObra: { projectId: "", lista: [] } };
const RDO_CLIMA = ["", "Bom", "Nublado", "Chuvoso", "Chuva forte"];
const RDO_SITUACAO = ["Operando", "Parado", "Manutenção"];

function rdoCanEdit() {
  return canEditModule("rdo");
}

function rdoHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rdoUserOptions(selectedId) {
  const users = (db.users || []).filter((u) => String(u.status || "Ativo") !== "Inativo" && !u.blocked);
  return `<option value="">— selecione —</option>` + users.map((u) => {
    const nome = u.fullName || u.name || u.username || `#${u.id}`;
    return `<option value="${u.id}" ${sameId(u.id, selectedId) ? "selected" : ""}>${svgText(nome)}</option>`;
  }).join("");
}

function rdoObraOptions(selectedId) {
  return `<option value="">Selecione a obra…</option>` + (db.projects || []).map((p) =>
    `<option value="${p.id}" ${sameId(p.id, selectedId) ? "selected" : ""}>${svgText(p.name)}</option>`).join("");
}

function renderRdo() {
  if (rdoUI.view === "disciplinas") return renderRdoDisciplinas();
  if (rdoUI.view === "form") return renderRdoForm();
  return renderRdoLista();
}

function renderRdoLista() {
  const editable = rdoCanEdit();
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Diário de Obra (RDO)</h2>
        <p>Um RDO por obra por dia. O responsável geral e os responsáveis das disciplinas que atuaram assinam; quando todas as assinaturas são coletadas, o RDO é finalizado.</p>
      </div>
      <div class="row-actions">
        ${editable ? '<button class="secondary" type="button" id="rdoBtnDisc">🏗️ Disciplinas da obra</button>' : ""}
        ${editable ? '<button class="primary" type="button" id="rdoBtnNovo">+ Novo RDO</button>' : ""}
      </div>
    </section>
    <section class="schedule-toolbar">
      <label>Obra <select id="rdoFiltroObra">${rdoObraOptions(rdoUI.filtroObra)}</select></label>
      <label>De <input type="date" id="rdoFiltroDe" value="${svgText(rdoUI.filtroDe)}"></label>
      <label>Até <input type="date" id="rdoFiltroAte" value="${svgText(rdoUI.filtroAte)}"></label>
      <button class="secondary" type="button" id="rdoFiltrar">Filtrar</button>
    </section>
    <div id="rdoListaWrap"><div class="empty">Carregando…</div></div>
  `;
  qs("rdoBtnNovo")?.addEventListener("click", rdoAbrirNovo);
  qs("rdoBtnDisc")?.addEventListener("click", () => { rdoUI.view = "disciplinas"; rdoUI.discObra.projectId = rdoUI.filtroObra; render(); });
  qs("rdoFiltrar")?.addEventListener("click", () => {
    rdoUI.filtroObra = qs("rdoFiltroObra").value;
    rdoUI.filtroDe = qs("rdoFiltroDe").value;
    rdoUI.filtroAte = qs("rdoFiltroAte").value;
    rdoCarregarLista();
  });
  rdoCarregarLista();
}

async function rdoCarregarLista() {
  const wrap = qs("rdoListaWrap");
  if (!wrap) return;
  const params = new URLSearchParams();
  if (rdoUI.filtroObra) params.set("projectId", rdoUI.filtroObra);
  if (rdoUI.filtroDe) params.set("de", rdoUI.filtroDe);
  if (rdoUI.filtroAte) params.set("ate", rdoUI.filtroAte);
  try {
    const r = await apiRequest(`rdo-list?${params.toString()}`, { method: "GET" });
    rdoUI.lista = r.data || [];
    rdoRenderTabela();
  } catch (e) {
    wrap.innerHTML = `<div class="empty">Erro ao carregar: ${svgText(e.message)}</div>`;
  }
}

function rdoStatusBadge(status) {
  const map = { Rascunho: "ofx-badge-gray", "Aguardando assinaturas": "ofx-badge-yellow", Finalizado: "ofx-badge-green" };
  return `<span class="ofx-badge ${map[status] || ""}">${svgText(status || "—")}</span>`;
}

function rdoRenderTabela() {
  const wrap = qs("rdoListaWrap");
  if (!wrap) return;
  if (!rdoUI.lista.length) {
    wrap.innerHTML = `<div class="empty">Nenhum RDO encontrado.</div>`;
    return;
  }
  const editable = rdoCanEdit();
  wrap.innerHTML = `
    <section class="table-wrap"><table>
      <thead><tr><th>Nº</th><th>Data</th><th>Obra</th><th>Condição</th><th>Assinaturas</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>
        ${rdoUI.lista.map((r) => {
          const obrig = Number(r.assinaturasObrig || 0) + 1;
          const feitas = Number(r.assinaturasFeitas || 0) + (r.status === "Finalizado" ? 1 : 0);
          return `<tr>
            <td>${svgText(String(r.numeroSequencial || "—"))}</td>
            <td>${asDate(r.data)}</td>
            <td>${svgText(nameOf("projects", r.projectId) || "—")}</td>
            <td>${svgText(r.condicaoTrabalho || "—")}</td>
            <td>${feitas}/${obrig}</td>
            <td>${rdoStatusBadge(r.status)}</td>
            <td><div class="row-actions">
              <button class="secondary" type="button" data-rdo-abrir="${r.id}">Abrir</button>
              <button class="secondary" type="button" data-rdo-pdf="${r.id}">PDF</button>
              ${editable ? `<button class="danger" type="button" data-rdo-del="${r.id}">Excluir</button>` : ""}
            </div></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table></section>
  `;
  wrap.querySelectorAll("[data-rdo-abrir]").forEach((b) => b.addEventListener("click", () => rdoAbrir(Number(b.dataset.rdoAbrir))));
  wrap.querySelectorAll("[data-rdo-pdf]").forEach((b) => b.addEventListener("click", () => rdoGerarPdf(Number(b.dataset.rdoPdf))));
  wrap.querySelectorAll("[data-rdo-del]").forEach((b) => b.addEventListener("click", () => rdoExcluir(Number(b.dataset.rdoDel))));
}

function rdoNovoDraft(obraId) {
  return {
    id: null, projectId: obraId || "", etapaId: "", data: rdoHoje(),
    climaManha: "", climaTarde: "", climaNoite: "", condicaoTrabalho: "Praticável",
    atividades: "", ocorrencias: "", observacoes: "", efetivo: [], equipamentos: [],
    responsavelGeralUserId: "", responsavelGeralNome: "", status: "Rascunho",
    disciplinas: [], assinaturas: [], fotos: [], numeroSequencial: null,
  };
}

function rdoAbrirNovo() {
  const draft = rdoNovoDraft(rdoUI.filtroObra);
  if (draft.projectId) {
    const obra = byId("projects", draft.projectId);
    if (obra?.projectManagerId) {
      draft.responsavelGeralUserId = obra.projectManagerId;
      draft.responsavelGeralNome = nameOf("users", obra.projectManagerId) || obra.responsible || "";
    }
  }
  rdoUI.atual = draft;
  rdoUI.view = "form";
  render();
}

async function rdoAbrir(id) {
  try {
    const r = await apiRequest(`rdo-get?id=${id}`, { method: "GET" });
    rdoUI.atual = r.data;
    rdoUI.view = "form";
    render();
  } catch (e) {
    alert(`Erro ao abrir o RDO: ${e.message}`);
  }
}

function rdoVoltarLista() {
  rdoUI.view = "list";
  rdoUI.atual = null;
  render();
}

function rdoEfetivoRowHtml(item, disabled) {
  return `<tr class="rdo-efetivo-row">
    <td><input class="rdo-ef-funcao" value="${svgText(item.funcao || "")}" placeholder="Pedreiro" ${disabled}></td>
    <td><input class="rdo-ef-qtd" type="number" min="0" value="${svgText(String(item.quantidade ?? ""))}" ${disabled}></td>
    <td>${disabled ? "" : '<button class="danger" type="button" data-rdo-remrow>✕</button>'}</td>
  </tr>`;
}

function rdoEquipRowHtml(item, disabled) {
  return `<tr class="rdo-equip-row">
    <td><input class="rdo-eq-nome" value="${svgText(item.nome || "")}" placeholder="Betoneira" ${disabled}></td>
    <td><input class="rdo-eq-qtd" type="number" min="0" value="${svgText(String(item.quantidade ?? ""))}" ${disabled}></td>
    <td><select class="rdo-eq-sit" ${disabled}>${RDO_SITUACAO.map((s) => `<option ${s === (item.situacao || "Operando") ? "selected" : ""}>${s}</option>`).join("")}</select></td>
    <td>${disabled ? "" : '<button class="danger" type="button" data-rdo-remrow>✕</button>'}</td>
  </tr>`;
}

function rdoDiscRowHtml(disc, disabled) {
  return `<tr class="rdo-disc-row" data-disc-id="${disc.id || ""}" data-disc-disciplina-id="${disc.disciplinaId || ""}" data-disc-nome="${svgText(disc.disciplinaNome || "")}">
    <td><input type="checkbox" class="rdo-disc-atuou" ${disc.atuouNoDia ? "checked" : ""} ${disabled}></td>
    <td>${svgText(disc.disciplinaNome || "")}</td>
    <td><select class="rdo-disc-resp" ${disabled}>${rdoUserOptions(disc.responsavelUserId)}</select></td>
    <td>${disc.assinado ? "✅" : ""}</td>
  </tr>`;
}

function rdoAssinaturasPainelHtml(d) {
  if (d.status === "Rascunho") return "";
  const linhas = [];
  const geralAssinado = (d.assinaturas || []).some((a) => a.tipo === "Geral" && a.evento === "Assinatura");
  linhas.push({ label: `Responsável geral — ${d.responsavelGeralNome || "—"}`, assinado: geralAssinado || d.status === "Finalizado" });
  (d.disciplinas || []).filter((x) => Number(x.atuouNoDia) === 1).forEach((x) => {
    linhas.push({ label: `${x.disciplinaNome} — ${x.responsavelNome || "—"}`, assinado: !!Number(x.assinado) });
  });
  const uid = currentUser?.id;
  const admin = isAdmin();
  const minhaPendencia = (!geralAssinado && sameId(d.responsavelGeralUserId, uid))
    || (d.disciplinas || []).some((x) => Number(x.atuouNoDia) === 1 && !Number(x.assinado) && sameId(x.responsavelUserId, uid));
  const podeAssinar = d.status === "Aguardando assinaturas" && (minhaPendencia || admin);
  const podeReabrir = d.status !== "Rascunho" && (admin || sameId(d.responsavelGeralUserId, uid));
  return `<section class="panel rdo-assinaturas-panel">
    <h3>Assinaturas</h3>
    <ul class="rdo-assinaturas">
      ${linhas.map((l) => `<li>${l.assinado ? "✅" : "⏳"} ${svgText(l.label)}</li>`).join("")}
    </ul>
    <div class="row-actions">
      ${d.status === "Aguardando assinaturas" ? `<button class="primary" type="button" id="rdoBtnAssinar" ${podeAssinar ? "" : 'disabled title="Somente o responsável (ou admin) assina"'}>Assinar minhas pendências</button>` : ""}
      ${podeReabrir ? '<button class="secondary" type="button" id="rdoBtnReabrir">Reabrir (volta a rascunho)</button>' : ""}
    </div>
  </section>`;
}

function rdoFotosHtml(d) {
  if (!d.id) return '<p class="field-hint">Salve o rascunho para anexar fotos.</p>';
  const podeEditar = rdoCanEdit() && d.status !== "Finalizado";
  return `
    ${podeEditar ? `<div class="rdo-foto-upload">
      <input type="file" id="rdoFotoFile" accept="image/jpeg,image/png,image/webp">
      <input type="text" id="rdoFotoLegenda" placeholder="Legenda (opcional)" maxlength="200">
      <button class="secondary" type="button" id="rdoFotoEnviar">Enviar foto</button>
    </div>` : ""}
    <div class="rdo-fotos-grid" id="rdoFotosGrid">
      ${(d.fotos || []).map((f) => `<figure class="rdo-foto" data-foto-id="${f.id}">
        <img alt="${svgText(f.legenda || "Foto do RDO")}" data-foto-load="${f.id}">
        <figcaption>${svgText(f.legenda || "")}</figcaption>
        ${podeEditar ? `<button class="danger" type="button" data-foto-del="${f.id}">Remover</button>` : ""}
      </figure>`).join("") || '<p class="field-hint">Sem fotos.</p>'}
    </div>`;
}

function renderRdoForm() {
  const d = rdoUI.atual;
  if (!d) return rdoVoltarLista();
  const editable = rdoCanEdit();
  const locked = !editable || d.status === "Aguardando assinaturas" || d.status === "Finalizado";
  const dis = locked ? "disabled" : "";
  const etapas = (db.projectSchedule || []).filter((e) => sameId(e.projectId, d.projectId));
  const etapaSel = etapas.find((e) => sameId(e.id, d.etapaId));
  const titulo = d.id ? `RDO Nº ${d.numeroSequencial || ""} — ${asDate(d.data)}` : "Novo RDO";
  qs("content").innerHTML = `
    <section class="module-head">
      <div><h2>${svgText(titulo)}</h2><p>${rdoStatusBadge(d.status)} ${svgText(nameOf("projects", d.projectId) || "")}</p></div>
      <div class="row-actions"><button class="secondary" type="button" id="rdoBtnVoltar">← Voltar</button></div>
    </section>
    <section class="panel">
      <h3>Cabeçalho</h3>
      <div class="form-grid">
        <label>Obra (obrigatória)<select id="rdoFormObra" ${d.id ? "disabled" : dis}>${rdoObraOptions(d.projectId)}</select></label>
        <label>Data<input type="date" id="rdoFormData" value="${svgText(d.data)}" ${d.id ? "disabled" : dis}></label>
        <label>Etapa do cronograma (opcional)<select id="rdoFormEtapa" ${dis}><option value="">Sem vínculo</option>${etapas.map((e) => `<option value="${e.id}" ${sameId(e.id, d.etapaId) ? "selected" : ""}>${svgText(e.stageName)}</option>`).join("")}</select></label>
        <label>Responsável da etapa<input value="${svgText(etapaSel?.responsible || "—")}" disabled></label>
        <label>Responsável geral (assina/finaliza)<select id="rdoRespGeral" ${dis}>${rdoUserOptions(d.responsavelGeralUserId)}</select></label>
      </div>
      ${etapaSel?.servicoSiacId ? '<p class="field-hint">⚠️ Etapa é serviço controlado — a FVS será exigida na conclusão.</p>' : ""}
    </section>
    <section class="panel">
      <h3>Clima e condição</h3>
      <div class="form-grid">
        <label>Manhã<select id="rdoClimaManha" ${dis}>${RDO_CLIMA.map((c) => `<option ${c === d.climaManha ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        <label>Tarde<select id="rdoClimaTarde" ${dis}>${RDO_CLIMA.map((c) => `<option ${c === d.climaTarde ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        <label>Noite<select id="rdoClimaNoite" ${dis}>${RDO_CLIMA.map((c) => `<option ${c === d.climaNoite ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        <label>Condição de trabalho<select id="rdoCondicao" ${dis}>${["Praticável", "Parcialmente praticável", "Impraticável"].map((c) => `<option ${c === d.condicaoTrabalho ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      </div>
    </section>
    <section class="panel">
      <h3>Efetivo</h3>
      <table class="rdo-mini-table"><thead><tr><th>Função</th><th>Qtd</th><th></th></tr></thead>
        <tbody id="rdoEfetivoBody">${(d.efetivo || []).map((it) => rdoEfetivoRowHtml(it, dis)).join("")}</tbody></table>
      ${locked ? "" : '<button class="secondary" type="button" id="rdoAddEfetivo">+ Linha</button>'}
    </section>
    <section class="panel">
      <h3>Equipamentos</h3>
      <table class="rdo-mini-table"><thead><tr><th>Equipamento</th><th>Qtd</th><th>Situação</th><th></th></tr></thead>
        <tbody id="rdoEquipBody">${(d.equipamentos || []).map((it) => rdoEquipRowHtml(it, dis)).join("")}</tbody></table>
      ${locked ? "" : '<button class="secondary" type="button" id="rdoAddEquip">+ Linha</button>'}
    </section>
    <section class="panel">
      <h3>Registro do dia</h3>
      <div class="form-grid">
        <label class="full">Atividades executadas<textarea id="rdoAtividades" rows="3" ${dis}>${svgText(d.atividades || "")}</textarea></label>
        <label class="full">Ocorrências / paralisações<textarea id="rdoOcorrencias" rows="2" ${dis}>${svgText(d.ocorrencias || "")}</textarea></label>
        <label class="full">Observações<textarea id="rdoObservacoes" rows="2" ${dis}>${svgText(d.observacoes || "")}</textarea></label>
      </div>
    </section>
    <section class="panel">
      <h3>Disciplinas do dia</h3>
      ${d.id ? `<table class="rdo-mini-table"><thead><tr><th>Atuou</th><th>Disciplina</th><th>Responsável (login)</th><th>Assin.</th></tr></thead>
        <tbody id="rdoDiscBody">${(d.disciplinas || []).map((x) => rdoDiscRowHtml(x, dis)).join("") || '<tr><td colspan="4" class="field-hint">Nenhuma disciplina cadastrada para esta obra. Use "Disciplinas da obra" na lista.</td></tr>'}</tbody></table>
        ${locked ? "" : '<div class="rdo-add-disc"><input id="rdoNovaDiscNome" placeholder="Adicionar disciplina avulsa"><button class="secondary" type="button" id="rdoAddDisc">+ Disciplina</button></div>'}`
        : '<p class="field-hint">Salve o rascunho para carregar as disciplinas da obra e marcar quem atuou.</p>'}
    </section>
    <section class="panel">
      <h3>Fotos</h3>
      ${rdoFotosHtml(d)}
    </section>
    ${rdoAssinaturasPainelHtml(d)}
    <section class="panel rdo-form-actions">
      <div class="row-actions">
        ${!locked ? '<button class="primary" type="button" id="rdoBtnSalvar">Salvar rascunho</button>' : ""}
        ${!locked && d.id ? '<button class="primary" type="button" id="rdoBtnEnviar">Enviar para assinaturas</button>' : ""}
        ${d.id ? '<button class="secondary" type="button" id="rdoBtnPdf">Gerar PDF</button>' : ""}
      </div>
    </section>
  `;
  rdoWireForm(d, locked);
}

function rdoWireForm(d, locked) {
  qs("rdoBtnVoltar")?.addEventListener("click", rdoVoltarLista);
  qs("rdoFormObra")?.addEventListener("change", (e) => {
    d.projectId = e.target.value;
    const obra = byId("projects", d.projectId);
    if (obra?.projectManagerId && !d.responsavelGeralUserId) {
      d.responsavelGeralUserId = obra.projectManagerId;
    }
    render();
  });
  qs("rdoFormEtapa")?.addEventListener("change", (e) => { d.etapaId = e.target.value; render(); });
  qs("rdoAddEfetivo")?.addEventListener("click", () => qs("rdoEfetivoBody")?.insertAdjacentHTML("beforeend", rdoEfetivoRowHtml({}, "")));
  qs("rdoAddEquip")?.addEventListener("click", () => qs("rdoEquipBody")?.insertAdjacentHTML("beforeend", rdoEquipRowHtml({}, "")));
  qs("content").querySelectorAll("[data-rdo-remrow]").forEach((b) => b.addEventListener("click", () => b.closest("tr")?.remove()));
  qs("rdoAddDisc")?.addEventListener("click", () => {
    const nome = qs("rdoNovaDiscNome")?.value.trim();
    if (!nome) return;
    qs("rdoDiscBody")?.insertAdjacentHTML("beforeend", rdoDiscRowHtml({ disciplinaNome: nome, atuouNoDia: 1 }, ""));
    qs("rdoNovaDiscNome").value = "";
  });
  qs("rdoBtnSalvar")?.addEventListener("click", () => rdoSalvar(false));
  qs("rdoBtnEnviar")?.addEventListener("click", rdoEnviarAssinaturas);
  qs("rdoBtnPdf")?.addEventListener("click", () => rdoGerarPdf(d.id));
  qs("rdoBtnAssinar")?.addEventListener("click", rdoAssinar);
  qs("rdoBtnReabrir")?.addEventListener("click", rdoReabrir);
  qs("rdoFotoEnviar")?.addEventListener("click", rdoEnviarFoto);
  qs("content").querySelectorAll("[data-foto-del]").forEach((b) => b.addEventListener("click", () => rdoExcluirFoto(Number(b.dataset.fotoDel))));
  qs("content").querySelectorAll("[data-foto-load]").forEach((img) => rdoCarregarFoto(img, Number(img.dataset.fotoLoad)));
}

function rdoColetarForm() {
  const d = rdoUI.atual;
  const efetivo = [...document.querySelectorAll(".rdo-efetivo-row")].map((row) => ({
    funcao: row.querySelector(".rdo-ef-funcao")?.value.trim() || "",
    quantidade: Number(row.querySelector(".rdo-ef-qtd")?.value || 0),
  })).filter((x) => x.funcao || x.quantidade);
  const equipamentos = [...document.querySelectorAll(".rdo-equip-row")].map((row) => ({
    nome: row.querySelector(".rdo-eq-nome")?.value.trim() || "",
    quantidade: Number(row.querySelector(".rdo-eq-qtd")?.value || 0),
    situacao: row.querySelector(".rdo-eq-sit")?.value || "Operando",
  })).filter((x) => x.nome);
  const disciplinas = [...document.querySelectorAll(".rdo-disc-row")].map((row) => ({
    id: Number(row.dataset.discId) || null,
    disciplinaId: Number(row.dataset.discDisciplinaId) || null,
    disciplinaNome: row.dataset.discNome || "",
    atuouNoDia: row.querySelector(".rdo-disc-atuou")?.checked ? 1 : 0,
    responsavelUserId: Number(row.querySelector(".rdo-disc-resp")?.value || 0) || null,
  }));
  const respSel = qs("rdoRespGeral");
  return {
    id: d.id || null,
    projectId: Number(qs("rdoFormObra")?.value || d.projectId) || null,
    data: qs("rdoFormData")?.value || d.data,
    etapaId: Number(qs("rdoFormEtapa")?.value || 0) || null,
    climaManha: qs("rdoClimaManha")?.value || "",
    climaTarde: qs("rdoClimaTarde")?.value || "",
    climaNoite: qs("rdoClimaNoite")?.value || "",
    condicaoTrabalho: qs("rdoCondicao")?.value || "Praticável",
    atividades: qs("rdoAtividades")?.value || "",
    ocorrencias: qs("rdoOcorrencias")?.value || "",
    observacoes: qs("rdoObservacoes")?.value || "",
    efetivo, equipamentos, disciplinas,
    responsavelGeralUserId: Number(respSel?.value || 0) || null,
    responsavelGeralNome: respSel?.selectedOptions?.[0]?.textContent?.trim() || d.responsavelGeralNome || "",
  };
}

async function rdoSalvar() {
  const payload = rdoColetarForm();
  if (!payload.projectId) return alert("Selecione a obra.");
  if (!payload.data) return alert("Informe a data.");
  try {
    const r = await apiRequest("rdo-save", { method: "POST", body: JSON.stringify(payload) });
    rdoUI.atual = r.data;
    showToast("RDO salvo.");
    render();
  } catch (e) {
    alert(`Erro ao salvar: ${e.message}`);
  }
}

async function rdoEnviarAssinaturas() {
  if (!rdoUI.atual?.id) return;
  await rdoSalvar();
  if (!rdoUI.atual?.id) return;
  if (!confirm("Enviar para assinaturas? Os campos de conteúdo ficam travados até a finalização ou reabertura.")) return;
  try {
    const r = await apiRequest("rdo-enviar-assinaturas", { method: "POST", body: JSON.stringify({ id: rdoUI.atual.id }) });
    rdoUI.atual = r.data;
    showToast("RDO enviado para assinaturas.");
    render();
  } catch (e) {
    alert(`Não foi possível enviar: ${e.message}`);
  }
}

async function rdoAssinar() {
  if (!rdoUI.atual?.id) return;
  try {
    const r = await apiRequest("rdo-assinar", { method: "POST", body: JSON.stringify({ id: rdoUI.atual.id }) });
    rdoUI.atual = r.data;
    showToast(r.data.status === "Finalizado" ? "✅ RDO finalizado — todas as assinaturas coletadas." : "Assinatura registrada.");
    render();
  } catch (e) {
    alert(`Erro ao assinar: ${e.message}`);
  }
}

async function rdoReabrir() {
  if (!rdoUI.atual?.id) return;
  if (!confirm("Reabrir o RDO? Ele volta para rascunho e as assinaturas são zeradas (o histórico é mantido).")) return;
  try {
    const r = await apiRequest("rdo-reabrir", { method: "POST", body: JSON.stringify({ id: rdoUI.atual.id }) });
    rdoUI.atual = r.data;
    showToast("RDO reaberto.");
    render();
  } catch (e) {
    alert(`Erro ao reabrir: ${e.message}`);
  }
}

async function rdoExcluir(id) {
  if (!confirm("Excluir este RDO e suas fotos? Esta ação não pode ser desfeita.")) return;
  try {
    await apiRequest("rdo-delete", { method: "POST", body: JSON.stringify({ id }) });
    showToast("RDO excluído.");
    rdoCarregarLista();
  } catch (e) {
    alert(`Erro ao excluir: ${e.message}`);
  }
}

async function rdoEnviarFoto() {
  const file = qs("rdoFotoFile")?.files?.[0];
  if (!file) return alert("Escolha uma imagem.");
  if (!rdoUI.atual?.id) return;
  const form = new FormData();
  form.append("file", file);
  form.append("rdoId", String(rdoUI.atual.id));
  form.append("legenda", qs("rdoFotoLegenda")?.value || "");
  try {
    await fetchForm("rdo-foto-upload", form);
    await rdoAbrir(rdoUI.atual.id);
    showToast("Foto anexada.");
  } catch (e) {
    alert(`Erro ao enviar foto: ${e.message}`);
  }
}

async function rdoExcluirFoto(id) {
  if (!confirm("Remover esta foto?")) return;
  try {
    await apiRequest("rdo-foto-delete", { method: "POST", body: JSON.stringify({ id }) });
    if (rdoUI.atual?.id) await rdoAbrir(rdoUI.atual.id);
  } catch (e) {
    alert(`Erro ao remover: ${e.message}`);
  }
}

async function rdoCarregarFoto(imgEl, fotoId) {
  try {
    const resp = await fetch(`${API_BASE}/rdo-foto?id=${fotoId}`, { headers: authHeaders() });
    if (!resp.ok) return;
    imgEl.src = URL.createObjectURL(await resp.blob());
  } catch {
    // imagem indisponível: deixa o alt
  }
}

// ── Disciplinas da obra (gestão) ────────────────────────────────────────────
function renderRdoDisciplinas() {
  const editable = rdoCanEdit();
  qs("content").innerHTML = `
    <section class="module-head">
      <div><h2>Disciplinas da obra</h2><p>Defina as disciplinas de cada obra e o responsável (usuário com login) que assina o RDO daquela disciplina.</p></div>
      <div class="row-actions"><button class="secondary" type="button" id="rdoDiscVoltar">← Voltar aos RDOs</button></div>
    </section>
    <section class="schedule-toolbar">
      <label>Obra <select id="rdoDiscObra">${rdoObraOptions(rdoUI.discObra.projectId)}</select></label>
    </section>
    <div id="rdoDiscWrap"><div class="empty">Selecione a obra.</div></div>
  `;
  qs("rdoDiscVoltar")?.addEventListener("click", () => { rdoUI.view = "list"; render(); });
  qs("rdoDiscObra")?.addEventListener("change", (e) => { rdoUI.discObra.projectId = e.target.value; rdoCarregarDisciplinas(); });
  if (rdoUI.discObra.projectId) rdoCarregarDisciplinas();
}

async function rdoCarregarDisciplinas() {
  const wrap = qs("rdoDiscWrap");
  if (!wrap || !rdoUI.discObra.projectId) return;
  try {
    const r = await apiRequest(`obra-disciplinas-list?projectId=${rdoUI.discObra.projectId}`, { method: "GET" });
    rdoUI.discObra.lista = r.data || [];
    rdoRenderDisciplinas();
  } catch (e) {
    wrap.innerHTML = `<div class="empty">Erro: ${svgText(e.message)}</div>`;
  }
}

function rdoRenderDisciplinas() {
  const wrap = qs("rdoDiscWrap");
  if (!wrap) return;
  const editable = rdoCanEdit();
  const sugestoes = ["Elétrica", "Hidráulica", "Fundação", "Estrutura", "Alvenaria", "Cobertura", "Revestimento", "Acabamento", "Instalações", "SPDA"];
  wrap.innerHTML = `
    ${editable ? `<section class="panel">
      <h3>Adicionar disciplina</h3>
      <div class="form-grid">
        <label>Disciplina<input id="rdoDiscNome" list="rdoDiscSugestoes" placeholder="Elétrica…"><datalist id="rdoDiscSugestoes">${sugestoes.map((s) => `<option value="${s}">`).join("")}</datalist></label>
        <label>Responsável (login)<select id="rdoDiscResp">${rdoUserOptions("")}</select></label>
        <div class="actions"><button class="primary" type="button" id="rdoDiscAdd">Adicionar</button></div>
      </div>
    </section>` : ""}
    <section class="table-wrap"><table>
      <thead><tr><th>Disciplina</th><th>Responsável</th><th>Status</th>${editable ? "<th>Ações</th>" : ""}</tr></thead>
      <tbody>
        ${(rdoUI.discObra.lista || []).map((x) => `<tr>
          <td>${svgText(x.nome)}</td>
          <td>${svgText(x.responsavelNome || "—")}</td>
          <td>${svgText(x.status)}</td>
          ${editable ? `<td><div class="row-actions"><button class="danger" type="button" data-disc-del="${x.id}">Excluir</button></div></td>` : ""}
        </tr>`).join("") || `<tr><td colspan="4" class="empty">Nenhuma disciplina nesta obra.</td></tr>`}
      </tbody>
    </table></section>
  `;
  qs("rdoDiscAdd")?.addEventListener("click", rdoSalvarDisciplina);
  wrap.querySelectorAll("[data-disc-del]").forEach((b) => b.addEventListener("click", () => rdoExcluirDisciplina(Number(b.dataset.discDel))));
}

async function rdoSalvarDisciplina() {
  const nome = qs("rdoDiscNome")?.value.trim();
  if (!nome) return alert("Informe o nome da disciplina.");
  try {
    await apiRequest("obra-disciplinas-save", { method: "POST", body: JSON.stringify({
      projectId: Number(rdoUI.discObra.projectId),
      nome,
      responsavelUserId: Number(qs("rdoDiscResp")?.value || 0) || null,
    }) });
    showToast("Disciplina salva.");
    rdoCarregarDisciplinas();
  } catch (e) {
    alert(`Erro: ${e.message}`);
  }
}

async function rdoExcluirDisciplina(id) {
  if (!confirm("Excluir esta disciplina da obra?")) return;
  try {
    await apiRequest("obra-disciplinas-delete", { method: "POST", body: JSON.stringify({ id }) });
    rdoCarregarDisciplinas();
  } catch (e) {
    alert(`Erro: ${e.message}`);
  }
}

// ── PDF do RDO (window.print + container dedicado) ───────────────────────────
async function rdoGerarPdf(id) {
  let d = rdoUI.atual && sameId(rdoUI.atual.id, id) ? rdoUI.atual : null;
  try {
    if (!d) {
      const r = await apiRequest(`rdo-get?id=${id}`, { method: "GET" });
      d = r.data;
    }
  } catch (e) {
    return alert(`Erro ao gerar PDF: ${e.message}`);
  }
  const fotos = [];
  for (const f of (d.fotos || [])) {
    try {
      const resp = await fetch(`${API_BASE}/rdo-foto?id=${f.id}`, { headers: authHeaders() });
      if (resp.ok) fotos.push({ url: URL.createObjectURL(await resp.blob()), legenda: f.legenda });
    } catch {
      // ignora foto indisponível
    }
  }
  let box = qs("rdoPrint");
  if (!box) {
    box = document.createElement("div");
    box.id = "rdoPrint";
    document.body.appendChild(box);
  }
  box.innerHTML = rdoPdfHtml(d, fotos);
  document.body.classList.add("rdo-printing");
  const cleanup = () => {
    document.body.classList.remove("rdo-printing");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

function rdoPdfHtml(d, fotos) {
  const obra = nameOf("projects", d.projectId) || "";
  const tabela = (titulo, head, linhas) => linhas.length
    ? `<h3>${titulo}</h3><table class="rdo-pdf-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${linhas}</tbody></table>`
    : "";
  const efetivo = tabela("Efetivo", ["Função", "Qtd"], (d.efetivo || []).map((x) => `<tr><td>${svgText(x.funcao || "")}</td><td>${svgText(String(x.quantidade ?? ""))}</td></tr>`).join(""));
  const equip = tabela("Equipamentos", ["Equipamento", "Qtd", "Situação"], (d.equipamentos || []).map((x) => `<tr><td>${svgText(x.nome || "")}</td><td>${svgText(String(x.quantidade ?? ""))}</td><td>${svgText(x.situacao || "")}</td></tr>`).join(""));
  const atuou = (d.disciplinas || []).filter((x) => Number(x.atuouNoDia) === 1);
  const discTab = tabela("Disciplinas que atuaram", ["Disciplina", "Responsável"], atuou.map((x) => `<tr><td>${svgText(x.disciplinaNome)}</td><td>${svgText(x.responsavelNome || "—")}</td></tr>`).join(""));
  const bloco = (titulo, txt) => txt ? `<h3>${titulo}</h3><p class="rdo-pdf-text">${svgText(txt).replace(/\n/g, "<br>")}</p>` : "";
  const fotosHtml = fotos.length ? `<h3>Registro fotográfico</h3><div class="rdo-pdf-fotos">${fotos.map((f) => `<figure><img src="${f.url}"><figcaption>${svgText(f.legenda || "")}</figcaption></figure>`).join("")}</div>` : "";
  const assinaturas = `<div class="rdo-pdf-assinaturas">
    <div class="rdo-pdf-assina"><span class="linha"></span><span>${svgText(d.responsavelGeralNome || "")}</span><small>Responsável pela Obra</small></div>
    ${atuou.map((x) => `<div class="rdo-pdf-assina"><span class="linha"></span><span>${svgText(x.responsavelNome || "")}</span><small>${svgText(x.disciplinaNome)}</small></div>`).join("")}
  </div>`;
  return `
    <div class="rdo-pdf-head">
      <h1>RELATÓRIO DIÁRIO DE OBRA (RDO) Nº ${svgText(String(d.numeroSequencial || ""))}</h1>
      <p><strong>${svgText(obra)}</strong> — ${asDate(d.data)} — Condição: ${svgText(d.condicaoTrabalho || "—")}</p>
      <p>Clima: manhã ${svgText(d.climaManha || "—")} · tarde ${svgText(d.climaTarde || "—")} · noite ${svgText(d.climaNoite || "—")}</p>
    </div>
    ${efetivo}
    ${equip}
    ${bloco("Atividades executadas", d.atividades)}
    ${bloco("Ocorrências / paralisações", d.ocorrencias)}
    ${bloco("Observações", d.observacoes)}
    ${discTab}
    ${fotosHtml}
    ${assinaturas}
  `;
}

function totals() {
  const receivable = applyFilters(db.receivable);
  const payable = applyFilters(db.payable);
  const moves = applyFilters(db.cashMoves);
  const sales = applyFilters(db.sales);
  const received = receivable.filter((r) => r.status === "Recebido").reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const openReceivable = receivable.filter((r) => r.status !== "Recebido" && r.status !== "Cancelado").reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const paid = payable.filter((p) => p.status === "Pago").reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const openPayable = payable.filter((p) => p.status !== "Pago" && p.status !== "Cancelado").reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const bankBalance = moves.reduce((sum, m) => sum + (m.type === "Saída" ? -Number(m.amount || 0) : Number(m.amount || 0)), 0);
  const profit = sales.reduce((sum, s) => sum + Number(s.amount || 0) - Number(s.cost || 0), 0);
  return { received, openReceivable, paid, openPayable, bankBalance, profit };
}

function sameId(a, b) {
  return String(a || "") === String(b || "");
}

function activeDashboardProjectId() {
  return dashboardViewMode === "project" ? dashboardProjectId : "";
}

function activeDashboardProject() {
  return byId("projects", activeDashboardProjectId());
}

function dashboardRows(collection) {
  const rows = applyFilters(db[collection] || [], { ignoreProject: dashboardViewMode === "general" });
  const projectId = activeDashboardProjectId();
  return projectId ? rows.filter((row) => sameId(row.projectId, projectId)) : rows;
}

function scheduleRowsForProject(projectId, filtered = true) {
  const rows = visibleRowsForModule("projectSchedule", filtered ? applyFilters(db.projectSchedule || []) : (db.projectSchedule || []));
  return rows
    .filter((row) => !projectId || sameId(row.projectId, projectId))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.plannedStartDate || "").localeCompare(String(b.plannedStartDate || "")));
}

function scheduleMetrics(projectId, rows = scheduleRowsForProject(projectId)) {
  const activeRows = rows.filter((row) => row.status !== "Cancelada" && row.status !== "Cancelado");
  const count = activeRows.length || 1;
  const plannedPhysical = activeRows.reduce((total, row) => total + Number(row.plannedPhysicalPercent || row.physicalProgress || 0), 0) / count;
  const actualPhysical = activeRows.reduce((total, row) => total + Number(row.actualPhysicalPercent || row.physicalProgress || 0), 0) / count;
  const plannedFinancial = activeRows.reduce((total, row) => total + Number(row.plannedFinancialAmount || 0), 0);
  const actualFinancial = activeRows.reduce((total, row) => total + Number(row.actualFinancialAmount || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const delayedRows = activeRows.filter((row) => {
    if (normalizedText(row.status).includes("atras")) return true;
    if (!row.plannedEndDate || row.actualEndDate || row.status === "Concluída") return false;
    return row.plannedEndDate < today;
  });
  const delayDays = delayedRows.reduce((max, row) => Math.max(max, daysBetween(row.plannedEndDate, row.actualEndDate || today)), 0);
  const completedStages = activeRows.filter((row) => row.status === "Concluída" || row.actualEndDate).length;
  const inProgressStages = activeRows.filter((row) => row.status === "Em andamento").length;
  const milestones = [
    ...(db.projectMilestones || []).filter((row) => !projectId || sameId(row.projectId, projectId)).map((row) => ({
      name: row.name,
      message: row.defaultMessage,
      date: row.completedDate || row.plannedDate,
      completed: row.status === "Concluído" || Boolean(row.completedDate),
      visibleToClient: row.visibleToClient,
    })),
    ...activeRows.filter((row) => row.isMilestone === "Sim").map((row) => ({
      name: row.milestoneName || row.stageName,
      message: row.milestoneMessage,
      date: row.actualEndDate || row.plannedEndDate,
      completed: row.status === "Concluída" || Boolean(row.actualEndDate),
      visibleToClient: row.visibleToClient,
    })),
  ].filter((row) => row.name);
  const completedMilestone = milestones.filter((row) => row.completed).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
  const nextMilestone = milestones.filter((row) => !row.completed).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))[0];
  const receivable = (db.receivable || []).filter((row) => sameId(row.projectId, projectId) && row.status === "Recebido").reduce((total, row) => total + Number(row.amount || 0), 0);
  const balance = receivable - actualFinancial;
  return {
    plannedPhysical,
    actualPhysical,
    plannedFinancial,
    actualFinancial,
    difference: actualFinancial - plannedFinancial,
    financialExecution: plannedFinancial ? (actualFinancial / plannedFinancial) * 100 : 0,
    delayDays,
    delayedStages: delayedRows.length,
    completedStages,
    inProgressStages,
    balance,
    nextMilestone: nextMilestone?.name || "",
    completedMilestone: completedMilestone?.name || "",
    completedMilestoneMessage: completedMilestone?.message || "",
  };
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  return Math.max(0, Math.ceil((endDate - startDate) / 86400000));
}

// Cálculos do dashboard: partem do banco carregado pela API e respeitam filtros globais e escopo de obra.
function dashboardMetrics() {
  const project = activeDashboardProject();
  const receivable = dashboardRows("receivable").filter((row) => row.status !== "Cancelado");
  const payable = dashboardRows("payable").filter((row) => row.status !== "Cancelado");
  const moves = dashboardRows("cashMoves");
  const sales = dashboardRows("sales").filter((row) => row.status !== "Cancelado");
  const fiscalDocs = dashboardRows("fiscalDocuments").filter((row) => row.status !== "Cancelada");
  const proposals = dashboardRows("proposals").filter((row) => row.status !== "Cancelada");
  const purchaseOrders = dashboardRows("purchaseOrders").filter((row) => row.status !== "Cancelado");
  const technicalReports = dashboardRows("technicalReports").filter((row) => row.status !== "Arquivado");
  const schedule = dashboardRows("projectSchedule");
  const scheduleInfo = scheduleMetrics(activeDashboardProjectId(), schedule);
  const revenueTotal = sum(receivable, "amount");
  const revenueReceived = receivable.filter((row) => row.status === "Recebido").reduce((total, row) => total + Number(row.amount || 0), 0);
  const revenuePending = receivable.filter((row) => row.status !== "Recebido").reduce((total, row) => total + Number(row.amount || 0), 0);
  const expensesTotal = sum(payable, "amount");
  const currentBalance = (activeDashboardProjectId() ? 0 : bankOpeningBalance()) + moves.reduce((total, row) => total + signedCashAmount(row), 0);
  const openReceivable = receivable.filter((row) => ["Aberto", "Vencido", "Parcial"].includes(row.status)).reduce((total, row) => total + Number(row.amount || 0), 0);
  const openPayable = payable.filter((row) => ["Aberto", "Vencido", "Parcial"].includes(row.status)).reduce((total, row) => total + Number(row.amount || 0), 0);
  const overdue = receivable.filter((row) => isOverdue(row, "receivable")).reduce((total, row) => total + Number(row.amount || 0), 0)
    + payable.filter((row) => isOverdue(row, "payable")).reduce((total, row) => total + Number(row.amount || 0), 0);
  const grossProfit = sales.reduce((total, row) => total + Number(row.amount || 0) - Number(row.cost || 0), 0);
  const netProfit = revenueTotal - expensesTotal;
  const paidExpenses = payable.filter((row) => row.status === "Pago").reduce((total, row) => total + Number(row.amount || 0), 0);
  const realizedCost = paidExpenses + Math.abs(moves.filter((row) => signedCashAmount(row) < 0).reduce((total, row) => total + signedCashAmount(row), 0));
  const servicesSold = sales.filter((row) => normalizedText(row.description).includes("servic")).reduce((total, row) => total + Number(row.amount || 0), 0);
  const productsSold = sales.filter((row) => normalizedText(row.description).includes("produto") || normalizedText(row.description).includes("software")).reduce((total, row) => total + Number(row.amount || 0), 0);
  const activeProjects = applyFilters(db.projects, { ignoreProject: dashboardViewMode === "general" }).filter((row) => ["Planejamento", "Proposta enviada", "Contratada", "Em andamento", "Pausada"].includes(row.status)).length;
  const proposalsIssued = proposals.length;
  const proposalsApproved = proposals.filter((row) => ["Aprovada", "Convertida"].includes(row.status)).length;
  const conversionRate = proposalsIssued ? (proposalsApproved / proposalsIssued) * 100 : 0;
  const resultByProject = resultByProjectRows().reduce((total, row) => total + Number(row.value || 0), 0);
  if (project) {
    const expectedProfit = Number(project.revenueContracted || 0) - Number(project.costForecast || 0);
    const realizedProfit = revenueReceived - realizedCost;
    return {
      project,
      revenueContracted: Number(project.revenueContracted || 0),
      revenueReceived,
      revenuePending,
      costForecast: Number(project.costForecast || 0),
      realizedCost,
      paidExpenses,
      openPayable,
      expectedProfit,
      realizedProfit,
      expectedMargin: project.revenueContracted ? (expectedProfit / Number(project.revenueContracted || 1)) * 100 : 0,
      realizedMargin: revenueReceived ? (realizedProfit / revenueReceived) * 100 : 0,
      currentBalance,
      physicalProgress: scheduleInfo.actualPhysical,
      plannedPhysical: scheduleInfo.plannedPhysical,
      scheduleFinancialExecution: scheduleInfo.financialExecution,
      schedulePlannedFinancial: scheduleInfo.plannedFinancial,
      scheduleActualFinancial: scheduleInfo.actualFinancial,
      scheduleDifference: scheduleInfo.difference,
      scheduleDelayDays: scheduleInfo.delayDays,
      delayedStages: scheduleInfo.delayedStages,
      completedStages: scheduleInfo.completedStages,
      inProgressStages: scheduleInfo.inProgressStages,
      nextMilestone: scheduleInfo.nextMilestone || "Sem marco previsto",
      financialExecution: project.costForecast ? (realizedCost / Number(project.costForecast || 1)) * 100 : 0,
      overdue,
      linkedSuppliers: new Set(payable.map((row) => row.supplierId).filter(Boolean)).size,
      soldItems: sales.length,
      linkedProposals: proposals.length,
      purchaseOrders: purchaseOrders.length,
      technicalReports: technicalReports.length,
      fiscalDocuments: fiscalDocs.length,
      fiscalFiles: fiscalDocs.filter((row) => row.hasPdf || row.hasXml).length,
    };
  }
  return {
    revenueTotal,
    revenueReceived,
    revenuePending,
    expensesTotal,
    openPayable,
    overdue,
    currentBalance,
    grossProfit,
    netProfit,
    openReceivable,
    margin: revenueTotal ? (netProfit / revenueTotal) * 100 : 0,
    delinquency: receivable.filter((row) => isOverdue(row, "receivable")).reduce((total, row) => total + Number(row.amount || 0), 0),
    servicesSold,
    productsSold,
    proposalsIssued,
    proposalsApproved,
    conversionRate,
    resultByCostCenter: dashboardCostCenterRows().reduce((total, row) => total + Number(row.value || 0), 0),
    resultByProject,
    activeProjects,
  };
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function monthKey(value) {
  return value ? String(value).slice(0, 7) : "";
}

function monthLabel(key) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return "";
  const [year, month] = key.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date).replace(".", "");
}

function firstDate(row, fields) {
  return fields.map((field) => row[field]).find(Boolean) || "";
}

function sumRowsByMonth(rows, field, dateFields, month) {
  return rows
    .filter((row) => monthKey(firstDate(row, dateFields)) === month)
    .reduce((total, row) => total + Number(row[field] || 0), 0);
}

function isOverdue(row, type) {
  if (row.status === "Vencido") return true;
  if (["Recebido", "Pago", "Cancelado"].includes(row.status)) return false;
  const dueDate = row.dueDate;
  if (!dueDate) return false;
  return dueDate < new Date().toISOString().slice(0, 10) && (type === "receivable" ? !row.receivedDate : !row.paidDate);
}

function bankOpeningBalance() {
  return (db.bankAccounts || []).reduce((total, row) => total + Number(row.openingBalance || 0), 0);
}

function normalizedText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function signedCashAmount(row) {
  const type = normalizedText(row.type);
  if (type.startsWith("entrada")) return Number(row.amount || 0);
  if (type.startsWith("transfer")) return 0;
  return -Number(row.amount || 0);
}

function collectMonths() {
  const months = new Set();
  [
    ...dashboardRows("receivable").flatMap((row) => [row.dueDate, row.receivedDate, row.issueDate]),
    ...dashboardRows("payable").flatMap((row) => [row.dueDate, row.paidDate, row.issueDate]),
    ...dashboardRows("cashMoves").map((row) => row.date),
  ].forEach((date) => {
    const key = monthKey(date);
    if (key) months.add(key);
  });
  months.add(currentMonthKey());
  return [...months].sort().slice(-12);
}

function monthlyCashFlowRows() {
  let finalBalance = bankOpeningBalance();
  return collectMonths().map((month) => {
    const receivable = dashboardRows("receivable").filter((row) => row.status !== "Cancelado" && monthKey(row.dueDate) === month);
    const payable = dashboardRows("payable").filter((row) => row.status !== "Cancelado" && monthKey(row.dueDate) === month);
    const moves = dashboardRows("cashMoves").filter((row) => monthKey(row.date) === month);
    const entradasPrevistas = sum(receivable, "amount");
    const saidasPrevistas = sum(payable, "amount");
    const entradasRealizadas = moves.filter((row) => normalizedText(row.type).startsWith("entrada")).reduce((total, row) => total + Number(row.amount || 0), 0);
    const saidasRealizadas = moves.filter((row) => signedCashAmount(row) < 0).reduce((total, row) => total + Math.abs(signedCashAmount(row)), 0);
    finalBalance += entradasRealizadas - saidasRealizadas;
    return { month, entradasPrevistas, entradasRealizadas, saidasPrevistas, saidasRealizadas, saldoFinal: finalBalance };
  });
}

function monthlyResultRows() {
  return collectMonths().map((month) => {
    const revenue = dashboardRows("receivable").filter((row) => row.status !== "Cancelado" && monthKey(firstDate(row, ["receivedDate", "issueDate", "dueDate"])) === month).reduce((total, row) => total + Number(row.amount || 0), 0);
    const expense = dashboardRows("payable").filter((row) => row.status !== "Cancelado" && monthKey(firstDate(row, ["paidDate", "issueDate", "dueDate"])) === month).reduce((total, row) => total + Number(row.amount || 0), 0);
    return { month, revenue, expense, result: revenue - expense };
  });
}

function receivableByStatusRows() {
  const order = ["Recebido", "Aberto", "Vencido", "Parcial", "Cancelado"];
  return order.map((status) => ({
    label: status,
    value: dashboardRows("receivable").filter((row) => row.status === status).reduce((total, row) => total + Number(row.amount || 0), 0),
  }));
}

function expensesByCategoryRows() {
  const grouped = {};
  dashboardRows("payable").filter((row) => row.status !== "Cancelado").forEach((row) => {
    const label = nameOf("categories", row.categoryId) || "Sem categoria";
    grouped[label] = (grouped[label] || 0) + Number(row.amount || 0);
  });
  return Object.entries(grouped).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function payableByStatusRows() {
  const order = ["Pago", "Aberto", "Vencido", "Parcial", "Cancelado"];
  return order.map((status) => ({
    label: status,
    value: dashboardRows("payable").filter((row) => row.status === status).reduce((total, row) => total + Number(row.amount || 0), 0),
  }));
}

function revenueByClientRows() {
  const grouped = {};
  dashboardRows("receivable").filter((row) => row.status !== "Cancelado").forEach((row) => {
    const label = nameOf("clients", row.clientId) || "Sem cliente";
    grouped[label] = (grouped[label] || 0) + Number(row.amount || 0);
  });
  return Object.entries(grouped).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function resultByProjectRows() {
  const rowsForResult = (collection) => applyFilters(db[collection] || [], { ignoreProject: dashboardViewMode === "general" });
  return applyFilters(db.projects, { ignoreProject: dashboardViewMode === "general" }).map((project) => {
    const revenue = rowsForResult("receivable").filter((row) => sameId(row.projectId, project.id) && row.status !== "Cancelado").reduce((total, row) => total + Number(row.amount || 0), 0);
    const expense = rowsForResult("payable").filter((row) => sameId(row.projectId, project.id) && row.status !== "Cancelado").reduce((total, row) => total + Number(row.amount || 0), 0);
    return { label: project.name, value: revenue - expense };
  }).sort((a, b) => b.value - a.value);
}

function payableByDueMonthRows() {
  const grouped = {};
  dashboardRows("payable").filter((row) => row.status !== "Cancelado").forEach((row) => {
    const label = monthLabel(monthKey(row.dueDate)) || "Sem vencimento";
    grouped[label] = (grouped[label] || 0) + Number(row.amount || 0);
  });
  return Object.entries(grouped).map(([label, value]) => ({ label, value }));
}

function costDistributionRows() {
  const groups = {
    Material: 0,
    "Mão de obra": 0,
    Terceirizados: 0,
    Impostos: 0,
    Administrativo: 0,
    Outros: 0,
  };
  dashboardRows("payable").filter((row) => row.status !== "Cancelado").forEach((row) => {
    const category = normalizedText(nameOf("categories", row.categoryId));
    const value = Number(row.amount || 0);
    if (category.includes("mercador") || category.includes("material") || category.includes("produto")) groups.Material += value;
    else if (category.includes("mao") || category.includes("folha")) groups["Mão de obra"] += value;
    else if (category.includes("terceir")) groups.Terceirizados += value;
    else if (category.includes("imposto") || category.includes("taxa")) groups.Impostos += value;
    else if (category.includes("admin")) groups.Administrativo += value;
    else groups.Outros += value;
  });
  return Object.entries(groups).map(([label, value]) => ({ label, value }));
}

function dashboardCostCenterRows() {
  return db.costCenters.map((cc) => {
    const revenue = dashboardRows("receivable").filter((r) => r.costCenterId === cc.id && r.status !== "Cancelado").reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = dashboardRows("payable").filter((p) => p.costCenterId === cc.id && p.status !== "Cancelado").reduce((s, p) => s + Number(p.amount || 0), 0);
    return { label: cc.name, value: revenue - expense };
  }).sort((a, b) => b.value - a.value);
}

function renderDashboard() {
  const metrics = dashboardMetrics();
  const cashFlow = monthlyCashFlowRows();
  const monthlyResult = monthlyResultRows();
  const project = activeDashboardProject();
  const projectOptions = db.projects.map((row) => `<option value="${row.id}" ${sameId(row.id, dashboardProjectId) ? "selected" : ""}>${row.name}</option>`).join("");
  const dashboardCards = project ? [
    ["Receita contratada da obra", metrics.revenueContracted],
    ["Receita recebida da obra", metrics.revenueReceived],
    ["Receita pendente da obra", metrics.revenuePending],
    ["Custo previsto da obra", metrics.costForecast],
    ["Custo realizado da obra", metrics.realizedCost],
    ["Despesas pagas da obra", metrics.paidExpenses],
    ["Despesas em aberto da obra", metrics.openPayable],
    ["Lucro previsto da obra", metrics.expectedProfit],
    ["Lucro realizado da obra", metrics.realizedProfit],
    ["Margem prevista", asPercent(metrics.expectedMargin), false],
    ["Margem realizada", asPercent(metrics.realizedMargin), false],
    ["Saldo financeiro da obra", metrics.currentBalance],
    ["Percentual físico realizado", asPercent(metrics.physicalProgress), false],
    ["Percentual financeiro realizado", asPercent(metrics.scheduleFinancialExecution), false],
    ["Previsto x realizado", metrics.scheduleDifference],
    ["Etapas concluídas", metrics.completedStages, false],
    ["Etapas atrasadas", metrics.delayedStages, false],
    ["Próximo marco", metrics.nextMilestone, false],
    ["Percentual financeiro executado", asPercent(metrics.financialExecution), false],
    ["Contas vencidas vinculadas", metrics.overdue],
    ["Propostas vinculadas", metrics.linkedProposals, false],
    ["Pedidos de compra da obra", metrics.purchaseOrders, false],
    ["Relatórios técnicos vinculados", metrics.technicalReports, false],
    ["Fornecedores vinculados", metrics.linkedSuppliers, false],
    ["Serviços/produtos vendidos", metrics.soldItems, false],
    ["Notas fiscais vinculadas", metrics.fiscalDocuments, false],
    ["Arquivos fiscais anexados", metrics.fiscalFiles, false],
  ] : [
    ["Receita total", metrics.revenueTotal],
    ["Receita recebida", metrics.revenueReceived],
    ["Receita a receber", metrics.revenuePending],
    ["Despesas totais", metrics.expensesTotal],
    ["Contas a pagar", metrics.openPayable],
    ["Contas vencidas", metrics.overdue],
    ["Saldo em caixa", metrics.currentBalance],
    ["Lucro bruto", metrics.grossProfit],
    ["Lucro líquido gerencial", metrics.netProfit],
    ["Margem líquida percentual", asPercent(metrics.margin), false],
    ["Inadimplência", metrics.delinquency],
    ["Total vendido em serviços", metrics.servicesSold],
    ["Total vendido em produtos", metrics.productsSold],
    ["Propostas emitidas", metrics.proposalsIssued, false],
    ["Propostas aprovadas", metrics.proposalsApproved, false],
    ["Taxa de conversão comercial", asPercent(metrics.conversionRate), false],
    ["Resultado por centro de custo", metrics.resultByCostCenter],
    ["Resultado por obra/projeto", metrics.resultByProject],
    ["Obras/projetos ativos", metrics.activeProjects, false],
  ];
  const charts = project ? `
      ${chartPanel("Receita x custo da obra", "Receita recebida, pendente e custos", groupedBarChart([
        { label: project.name, "Receita recebida": metrics.revenueReceived, "Receita pendente": metrics.revenuePending, "Custo realizado": metrics.realizedCost, "Custo previsto": metrics.costForecast },
      ], [
        { key: "Receita recebida", color: "#0f766e" },
        { key: "Receita pendente", color: "#2563eb" },
        { key: "Custo realizado", color: "#b42318" },
        { key: "Custo previsto", color: "#b8872d" },
      ]))}
      ${chartPanel("Previsto x realizado da obra", "Orçamento, receita e custo", groupedBarChart([
        { label: project.name, "Receita contratada": metrics.revenueContracted, "Receita recebida": metrics.revenueReceived, "Custo previsto": metrics.costForecast, "Custo realizado": metrics.realizedCost },
      ], [
        { key: "Receita contratada", color: "#0f766e" },
        { key: "Receita recebida", color: "#2563eb" },
        { key: "Custo previsto", color: "#b8872d" },
        { key: "Custo realizado", color: "#b42318" },
      ]))}
      ${chartPanel("Despesas por categoria da obra", "Agrupamento de contas a pagar", horizontalBarChart(expensesByCategoryRows(), "#b8872d"))}
      ${chartPanel("Contas a pagar por vencimento", "Valores agrupados por mês", horizontalBarChart(payableByDueMonthRows(), "#b42318"))}
      ${chartPanel("Contas a receber por status", "Status financeiro da obra", horizontalBarChart(receivableByStatusRows(), "#2563eb"))}
      ${chartPanel("Lucro previsto x realizado", "Comparativo de resultado da obra", groupedBarChart([
        { label: project.name, "Lucro previsto": metrics.expectedProfit, "Lucro realizado": metrics.realizedProfit },
      ], [
        { key: "Lucro previsto", color: "#0f766e" },
        { key: "Lucro realizado", color: "#2563eb" },
      ]))}
      ${chartPanel("Evolução financeira mensal", "Receita, despesa e resultado", lineChart([
        { label: "Receita", color: "#0f766e", values: monthlyResult.map((row) => row.revenue) },
        { label: "Despesa", color: "#b42318", values: monthlyResult.map((row) => row.expense) },
        { label: "Resultado", color: "#2563eb", values: monthlyResult.map((row) => row.result) },
      ], monthlyResult.map((row) => monthLabel(row.month))))}
      ${chartPanel("Distribuição de custos da obra", "Material, mão de obra, terceirizados, impostos, administrativo e outros", horizontalBarChart(costDistributionRows(), "#0f766e"))}
    ` : `
      ${chartPanel("Fluxo de caixa previsto x realizado", "Entradas, saídas e saldo final por mês", lineChart([
        { label: "Entradas previstas", color: "#0f766e", values: cashFlow.map((row) => row.entradasPrevistas) },
        { label: "Entradas realizadas", color: "#2563eb", values: cashFlow.map((row) => row.entradasRealizadas) },
        { label: "Saídas previstas", color: "#b8872d", values: cashFlow.map((row) => row.saidasPrevistas) },
        { label: "Saídas realizadas", color: "#b42318", values: cashFlow.map((row) => row.saidasRealizadas) },
        { label: "Saldo final", color: "#147a47", values: cashFlow.map((row) => row.saldoFinal) },
      ], cashFlow.map((row) => monthLabel(row.month))))}
      ${chartPanel("Receita x despesa mensal", "Receita, despesa e resultado gerencial", groupedBarChart(monthlyResult.map((row) => ({
        label: monthLabel(row.month),
        Receita: row.revenue,
        Despesa: row.expense,
        Resultado: row.result,
      })), [
        { key: "Receita", color: "#0f766e" },
        { key: "Despesa", color: "#b42318" },
        { key: "Resultado", color: "#2563eb" },
      ]))}
      ${chartPanel("Contas a receber por status", "Recebido, aberto, vencido, parcial e cancelado", horizontalBarChart(receivableByStatusRows(), "#2563eb"))}
      ${chartPanel("Contas a pagar por status", "Pago, aberto, vencido, parcial e cancelado", horizontalBarChart(payableByStatusRows(), "#b42318"))}
      ${chartPanel("Despesas por categoria", "Agrupamento por categoria financeira", horizontalBarChart(expensesByCategoryRows(), "#b8872d"))}
      ${chartPanel("Lucro por produto e serviço", "Preço de venda menos custo estimado ou unitário", horizontalBarChart(profitByOffering().sort((a, b) => b.value - a.value).slice(0, 8), "#0f766e"))}
      ${chartPanel("Resultado por centro de custo", "Receitas menos despesas por centro", groupedBarChart(dashboardCostCenterRows().map((row) => ({ label: row.label, Resultado: row.value })), [{ key: "Resultado", color: "#147a47" }]))}
      ${chartPanel("Faturamento por cliente", "Receita agrupada por cliente", horizontalBarChart(revenueByClientRows(), "#2563eb"))}
      ${chartPanel("Resultado por obra/projeto", "Lucro ou prejuízo por obra", horizontalBarChart(resultByProjectRows(), "#0f766e"))}
    `;
  qs("content").innerHTML = `
    <section class="dashboard-intro">
      <div>
        <h2>${project ? project.name : "Visão geral ObraSync"}</h2>
        <p>Indicadores e gráficos são recalculados automaticamente a partir dos dados salvos no servidor.</p>
      </div>
      <div class="dashboard-controls">
        <label>
          Visão do Dashboard
          <select id="dashboardView">
            <option value="general" ${dashboardViewMode === "general" ? "selected" : ""}>Geral da empresa</option>
            <option value="project" ${dashboardViewMode === "project" ? "selected" : ""}>Obra/projeto específico</option>
          </select>
        </label>
        <label class="${dashboardViewMode === "project" ? "" : "hidden"}">
          Obra/projeto
          <select id="dashboardProject">
            <option value="">Selecione</option>
            ${projectOptions}
          </select>
        </label>
      </div>
    </section>
    <section class="kpi-grid dashboard-kpis">
      ${dashboardCards.map((card) => kpi(card[0], card[1], card[2] ?? true)).join("")}
    </section>
    ${dashboardAlerts(metrics)}
    ${dashboardAgendaKanbanWidgets()}
    <section class="chart-grid">
      ${charts}
    </section>
    ${table("Próximos vencimentos", applyFilters([...db.receivable, ...db.payable]).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 8), ["document", "dueDate", "clientId", "supplierId", "amount", "status"])}
  `;
  qs("dashboardView").addEventListener("change", (event) => {
    dashboardViewMode = event.target.value;
    if (dashboardViewMode === "project" && !dashboardProjectId && db.projects[0]) dashboardProjectId = db.projects[0].id;
    render();
  });
  qs("dashboardProject")?.addEventListener("change", (event) => {
    dashboardProjectId = event.target.value;
    render();
  });
}

function dashboardAlerts(metrics) {
  const alerts = [];
  if (metrics.overdue > 0) alerts.push(`Contas vencidas: ${asMoney(metrics.overdue)}.`);
  if (metrics.project && metrics.delayedStages > 0) alerts.push(`Cronograma com ${metrics.delayedStages} etapa(s) atrasada(s), atraso máximo de ${metrics.scheduleDelayDays} dia(s).`);
  if (metrics.project && metrics.realizedCost > metrics.costForecast && metrics.costForecast > 0) alerts.push("Custo realizado acima do previsto para esta obra.");
  const margin = metrics.project ? metrics.realizedMargin : metrics.margin;
  if (margin < 10 && ((metrics.project && metrics.revenueReceived > 0) || (!metrics.project && metrics.revenueTotal > 0))) alerts.push("Margem líquida baixa. Revise custos, preços e despesas.");
  if (!alerts.length) return "";
  return `<section class="alerts">${alerts.map((message) => `<div class="alert">${message}</div>`).join("")}</section>`;
}

function dashboardAgendaKanbanWidgets() {
  const events = upcomingAgendaEvents(7);
  const cards = urgentKanbanCards();
  const eventRows = events.length ? events.map((event) => `
    <li><strong>${svgText(event.titulo)}</strong><span>${asDate(String(event.data_inicio || "").slice(0, 10))} · ${agendaTypeLabel(event.tipo)}${event.obra_id ? ` · ${nameOf("projects", event.obra_id)}` : ""}</span></li>
  `).join("") : '<li class="muted-row">Sem eventos nos próximos 7 dias</li>';
  const cardRows = cards.length ? cards.map((card) => `
    <li><strong>${svgText(card.titulo)}</strong><span>${priorityLabel(card.prioridade)} · ${card.data_vencimento ? asDate(card.data_vencimento) : "Sem prazo"}${card.obra_id ? ` · ${nameOf("projects", card.obra_id)}` : ""}</span></li>
  `).join("") : '<li class="muted-row">Sem cards urgentes ou atrasados</li>';
  return `
    <section class="split dashboard-work-widgets">
      <div class="panel compact-list-panel">
        <h3>Próximos eventos da agenda</h3>
        <ul class="compact-list">${eventRows}</ul>
      </div>
      <div class="panel compact-list-panel">
        <h3>Kanban urgente/atrasado</h3>
        <ul class="compact-list">${cardRows}</ul>
      </div>
    </section>
  `;
}

function upcomingAgendaEvents(days = 7) {
  const today = startOfLocalDay(new Date());
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return (db.agendaEvents || [])
    .filter((event) => event.status !== "cancelado")
    .filter((event) => {
      const date = parseLocalDateTime(event.data_inicio);
      return date && date >= today && date <= limit;
    })
    .sort((a, b) => String(a.data_inicio).localeCompare(String(b.data_inicio)))
    .slice(0, 8);
}

function urgentKanbanCards() {
  const today = localDateString(new Date());
  return (db.kanbanCards || [])
    .filter((card) => !kanbanCardDone(card))
    .filter((card) => ["alta", "urgente"].includes(card.prioridade) || (card.data_vencimento && card.data_vencimento < today))
    .sort((a, b) => String(a.data_vencimento || "9999-12-31").localeCompare(String(b.data_vencimento || "9999-12-31")))
    .slice(0, 8);
}

function kpi(label, value, format = true) {
  const numeric = typeof value === "number" ? value : null;
  const tone = numeric === null ? "" : numeric < 0 ? "negative" : numeric > 0 ? "positive" : "";
  return `<article class="kpi ${tone}"><span>${label}</span><strong>${format ? asMoney(value) : value}</strong></article>`;
}

function resultByCostCenter() {
  return db.costCenters.map((cc) => {
    const revenue = db.receivable.filter((r) => r.costCenterId === cc.id && r.status !== "Cancelado").reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = db.payable.filter((p) => p.costCenterId === cc.id && p.status !== "Cancelado").reduce((s, p) => s + Number(p.amount || 0), 0);
    return { label: cc.name, value: revenue - expense };
  });
}

function profitByOffering() {
  return [
    ...db.products.map((p) => ({ label: p.name, value: Number(p.price || 0) - Number(p.cost || 0) })),
    ...db.services.map((s) => ({ label: s.name, value: Number(s.price || 0) - Number(s.cost || 0) })),
  ];
}

function bars(rows) {
  if (!rows.length) return `<p class="empty">Sem dados para o filtro atual.</p>`;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return `<div class="mini-bars">${rows.map((r) => `
    <div class="bar-row">
      <strong>${r.label}</strong>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(4, Math.abs(r.value) / max * 100)}%"></span></span>
      <span>${asMoney(r.value)}</span>
    </div>`).join("")}</div>`;
}

// Helpers de gráficos SVG: evitam dependências externas e funcionam abrindo o index.html direto.
function chartPanel(title, subtitle, chart) {
  return `
    <article class="chart-card">
      <header>
        <div>
          <h3>${title}</h3>
          <p>${subtitle}</p>
        </div>
      </header>
      ${chart}
    </article>
  `;
}

function emptyChart() {
  return `<div class="chart-empty">Sem dados para exibir</div>`;
}

function hasValues(values) {
  return values.some((value) => Math.abs(Number(value || 0)) > 0);
}

function compactMoney(value) {
  return money.format(Number(value || 0));
}

// Escape padrão de HTML para qualquer dado dinâmico interpolado em innerHTML.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
// Alias histórico: vários templates antigos chamam svgText.
const svgText = escapeHtml;

function lineChart(series, labels) {
  const values = series.flatMap((item) => item.values);
  if (!labels.length || !hasValues(values)) return emptyChart();
  const width = 760;
  const height = 300;
  const pad = { top: 24, right: 24, bottom: 44, left: 72 };
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const x = (index) => pad.left + (labels.length === 1 ? 0 : (index / (labels.length - 1)) * (width - pad.left - pad.right));
  const y = (value) => pad.top + (1 - ((value - min) / range)) * (height - pad.top - pad.bottom);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((step) => {
    const gy = pad.top + step * (height - pad.top - pad.bottom);
    const label = max - step * range;
    return `<line x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}" class="chart-grid-line"></line><text x="8" y="${gy + 4}" class="chart-axis">${compactMoney(label)}</text>`;
  }).join("");
  const paths = series.map((item) => {
    const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
    return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
  }).join("");
  const dots = series.map((item) => item.values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3.5" fill="${item.color}"><title>${svgText(item.label)}: ${compactMoney(value)}</title></circle>`).join("")).join("");
  const axisLabels = labels.map((label, index) => `<text x="${x(index)}" y="${height - 14}" text-anchor="middle" class="chart-axis">${svgText(label)}</text>`).join("");
  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de linha">
        ${grid}
        <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" class="chart-axis-line"></line>
        ${paths}
        ${dots}
        ${axisLabels}
      </svg>
      ${chartLegend(series)}
    </div>
  `;
}

function groupedBarChart(rows, series) {
  const values = rows.flatMap((row) => series.map((item) => Number(row[item.key] || 0)));
  if (!rows.length || !hasValues(values)) return emptyChart();
  const width = 760;
  const height = 300;
  const pad = { top: 22, right: 24, bottom: 54, left: 72 };
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const zeroY = pad.top + (1 - ((0 - min) / range)) * (height - pad.top - pad.bottom);
  const groupWidth = (width - pad.left - pad.right) / rows.length;
  const barWidth = Math.max(8, Math.min(26, (groupWidth - 14) / series.length));
  const y = (value) => pad.top + (1 - ((value - min) / range)) * (height - pad.top - pad.bottom);
  const barsSvg = rows.map((row, rowIndex) => series.map((item, itemIndex) => {
    const value = Number(row[item.key] || 0);
    const bx = pad.left + rowIndex * groupWidth + 7 + itemIndex * barWidth;
    const by = value >= 0 ? y(value) : zeroY;
    const bh = Math.max(2, Math.abs(zeroY - y(value)));
    return `<rect x="${bx}" y="${by}" width="${barWidth - 2}" height="${bh}" rx="3" fill="${item.color}"><title>${svgText(row.label)} - ${svgText(item.key)}: ${compactMoney(value)}</title></rect>`;
  }).join("")).join("");
  const labels = rows.map((row, index) => `<text x="${pad.left + index * groupWidth + groupWidth / 2}" y="${height - 16}" text-anchor="middle" class="chart-axis">${svgText(row.label)}</text>`).join("");
  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de barras">
        <line x1="${pad.left}" y1="${zeroY}" x2="${width - pad.right}" y2="${zeroY}" class="chart-axis-line"></line>
        <text x="8" y="${pad.top + 8}" class="chart-axis">${compactMoney(max)}</text>
        <text x="8" y="${zeroY - 4}" class="chart-axis">R$ 0</text>
        ${barsSvg}
        ${labels}
      </svg>
      ${chartLegend(series.map((item) => ({ label: item.key, color: item.color })))}
    </div>
  `;
}

function horizontalBarChart(rows, color) {
  const filtered = rows.filter((row) => Number(row.value || 0) !== 0);
  if (!filtered.length) return emptyChart();
  const max = Math.max(...filtered.map((row) => Math.abs(Number(row.value || 0))), 1);
  return `
    <div class="hbar-list">
      ${filtered.map((row) => {
        const value = Number(row.value || 0);
        return `
          <div class="hbar-row">
            <span>${svgText(row.label)}</span>
            <div class="hbar-track"><div class="hbar-fill ${value < 0 ? "negative" : ""}" style="width:${Math.max(4, Math.abs(value) / max * 100)}%; background:${value < 0 ? "#b42318" : color}"></div></div>
            <strong>${compactMoney(value)}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function chartLegend(series) {
  return `<div class="chart-legend">${series.map((item) => `<span><i style="background:${item.color}"></i>${svgText(item.label)}</span>`).join("")}</div>`;
}

// ── Análise de Viabilidade ──────────────────────────────────────────────────

const VIABILITY_VERDICTS = ["Viável", "Viável com ressalvas", "Inviável"];

// Indicadores derivados dos dados da análise: margem, payback, VPL, TIR e parecer sugerido.
function viabilityMetrics(record) {
  const contractValue = Number(record.contractValue || 0);
  const estimatedCost = Number(record.estimatedCost || 0);
  const months = Math.max(1, Math.round(Number(record.executionMonths || 0)) || 1);
  const tma = Number(record.tmaPercent || 0);
  const grossMargin = contractValue - estimatedCost;
  const marginPercent = contractValue ? (grossMargin / contractValue) * 100 : 0;
  // Payback simples: meses até as receitas (distribuídas no prazo) cobrirem o custo estimado.
  const paybackMonths = grossMargin > 0 && contractValue > 0 ? (estimatedCost / contractValue) * months : 0;
  // VPL simplificado: custo como desembolso inicial e receita em parcelas mensais iguais,
  // descontadas pela TMA anual convertida em taxa mensal equivalente.
  const monthlyRate = Math.pow(1 + tma / 100, 1 / 12) - 1;
  const monthlyInflow = contractValue / months;
  let npv = -estimatedCost;
  for (let t = 1; t <= months; t++) npv += monthlyInflow / Math.pow(1 + monthlyRate, t);
  const irrPercent = viabilityIrr(estimatedCost, monthlyInflow, months);
  let autoVerdict;
  if (marginPercent < 5 || npv < 0) autoVerdict = "Inviável";
  else if (marginPercent > 15 && npv > 0) autoVerdict = "Viável";
  else autoVerdict = "Viável com ressalvas";
  return { contractValue, estimatedCost, months, grossMargin, marginPercent, paybackMonths, npv, irrPercent, autoVerdict };
}

// TIR mensal por bissecção (fluxo: -custo em t0 e receita mensal constante), anualizada em %.
function viabilityIrr(initialCost, monthlyInflow, months) {
  if (initialCost <= 0 || monthlyInflow <= 0) return null;
  const npvAt = (rate) => {
    let total = -initialCost;
    for (let t = 1; t <= months; t++) total += monthlyInflow / Math.pow(1 + rate, t);
    return total;
  };
  let low = -0.99;
  let high = 10;
  if (npvAt(low) * npvAt(high) > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    if (npvAt(low) * npvAt(mid) <= 0) high = mid;
    else low = mid;
  }
  return (Math.pow(1 + (low + high) / 2, 12) - 1) * 100;
}

// Parecer efetivo: o manual prevalece; "Automático" usa o parecer calculado.
function viabilityFinalVerdict(record) {
  if (record.verdict && record.verdict !== "Automático") return record.verdict;
  return record.autoVerdict || viabilityMetrics(record).autoVerdict;
}

function viabilityTone(verdict) {
  if (verdict === "Viável") return "viable";
  if (verdict === "Inviável") return "unviable";
  return "caution";
}

function renderViability() {
  const all = db.viabilityAnalyses || [];
  const rows = all
    .filter((row) => !viabilityProjectFilter || sameId(row.projectId, viabilityProjectFilter))
    .filter((row) => !viabilityStatusFilter || (row.status || "Em análise") === viabilityStatusFilter)
    .filter((row) => !viabilityVerdictFilter || viabilityFinalVerdict(row) === viabilityVerdictFilter)
    .slice()
    .sort((a, b) => String(b.analysisDate || "").localeCompare(String(a.analysisDate || "")) || String(b.id).localeCompare(String(a.id)));
  const editable = canEditModule("viabilityAnalyses");
  const verdictCount = (verdict) => all.filter((row) => viabilityFinalVerdict(row) === verdict).length;
  const inAnalysis = all.filter((row) => (row.status || "Em análise") === "Em análise").length;
  const chartRows = rows.slice(0, 8).map((row) => {
    const m = viabilityMetrics(row);
    return { label: nameOf("projects", row.projectId) || `Análise ${row.id}`, Receita: m.contractValue, Custo: m.estimatedCost, Margem: m.grossMargin };
  });
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Análise de Viabilidade</h2>
        <p>Custo x benefício por obra/projeto com margem, payback, VPL, TIR e parecer automático.</p>
      </div>
      ${editable ? '<button class="primary" type="button" id="newViability">Nova análise</button>' : ""}
    </section>
    <section class="kpi-grid">
      ${kpi("Total de análises", all.length, false)}
      ${kpi("Viáveis", verdictCount("Viável"), false)}
      ${kpi("Com ressalvas", verdictCount("Viável com ressalvas"), false)}
      ${kpi("Inviáveis", verdictCount("Inviável"), false)}
      ${kpi("Em análise", inAnalysis, false)}
    </section>
    <section class="viability-filters">
      <label>Obra/Projeto
        <select id="viabilityProjectFilter">
          <option value="">Todas</option>
          ${(db.projects || []).map((project) => `<option value="${escapeHtml(project.id)}" ${sameId(project.id, viabilityProjectFilter) ? "selected" : ""}>${escapeHtml(project.name)}</option>`).join("")}
        </select>
      </label>
      <label>Status
        <select id="viabilityStatusFilter">
          <option value="">Todos</option>
          ${["Em análise", "Aprovada", "Reprovada", "Arquivada"].map((status) => `<option ${status === viabilityStatusFilter ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </label>
      <label>Parecer
        <select id="viabilityVerdictFilter">
          <option value="">Todos</option>
          ${VIABILITY_VERDICTS.map((verdict) => `<option ${verdict === viabilityVerdictFilter ? "selected" : ""}>${verdict}</option>`).join("")}
        </select>
      </label>
    </section>
    ${chartRows.length ? chartPanel("Custo x Receita x Margem", "Comparativo das análises filtradas", groupedBarChart(chartRows, [
      { key: "Receita", color: "#2563eb" },
      { key: "Custo", color: "#b42318" },
      { key: "Margem", color: "#147a47" },
    ])) : ""}
    ${rows.length
      ? `<section class="viability-grid">${rows.map((row) => viabilityCard(row, editable)).join("")}</section>`
      : '<div class="empty">Nenhuma análise de viabilidade para os filtros atuais.</div>'}
  `;
  qs("newViability")?.addEventListener("click", () => openForm("viabilityAnalyses"));
  [["viabilityProjectFilter", (value) => viabilityProjectFilter = value],
   ["viabilityStatusFilter", (value) => viabilityStatusFilter = value],
   ["viabilityVerdictFilter", (value) => viabilityVerdictFilter = value]].forEach(([id, setter]) => {
    qs(id)?.addEventListener("change", (event) => { setter(event.target.value); renderViability(); });
  });
  qs("content").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openForm("viabilityAnalyses", button.dataset.edit)));
  qs("content").querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeRecord("viabilityAnalyses", button.dataset.delete)));
}

function viabilityCard(row, editable) {
  const m = viabilityMetrics(row);
  const verdict = viabilityFinalVerdict(row);
  const tone = viabilityTone(verdict);
  const manual = row.verdict && row.verdict !== "Automático";
  const proposalName = row.proposalId ? nameOf("proposals", row.proposalId) : "";
  return `
    <article class="viability-card ${tone}">
      <header>
        <div>
          <h3>${escapeHtml(nameOf("projects", row.projectId) || "Sem obra vinculada")}</h3>
          <p>${asDate(row.analysisDate)}${row.responsibleUserId ? ` · ${escapeHtml(nameOf("users", row.responsibleUserId))}` : ""}${proposalName ? ` · Proposta: ${escapeHtml(proposalName)}` : ""}</p>
        </div>
        <span class="viability-verdict ${tone}">${escapeHtml(verdict)}${manual ? " (manual)" : ""}</span>
      </header>
      <div class="viability-indicators">
        <div><span>Contrato</span><strong>${asMoney(m.contractValue)}</strong></div>
        <div><span>Custo estimado</span><strong>${asMoney(m.estimatedCost)}</strong></div>
        <div><span>Margem bruta</span><strong class="${m.grossMargin < 0 ? "neg" : ""}">${asMoney(m.grossMargin)}</strong></div>
        <div><span>Margem %</span><strong>${asPercent(m.marginPercent)}</strong></div>
        <div><span>Payback</span><strong>${m.paybackMonths ? `${m.paybackMonths.toFixed(1)} meses` : "—"}</strong></div>
        <div><span>VPL (TMA ${asPercent(Number(row.tmaPercent || 0))})</span><strong class="${m.npv < 0 ? "neg" : ""}">${asMoney(m.npv)}</strong></div>
        <div><span>TIR estimada</span><strong>${m.irrPercent === null ? "—" : asPercent(m.irrPercent)}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(row.status || "Em análise")}</strong></div>
      </div>
      ${viabilityMiniChart(m)}
      ${row.risks ? `<p class="viability-note"><strong>Riscos:</strong> ${escapeHtml(row.risks)}</p>` : ""}
      ${manual && row.verdictJustification ? `<p class="viability-note"><strong>Justificativa:</strong> ${escapeHtml(row.verdictJustification)}</p>` : ""}
      ${row.verdictHistory ? `<details class="viability-history"><summary>Histórico do parecer</summary><pre>${escapeHtml(row.verdictHistory)}</pre></details>` : ""}
      ${editable ? `<footer class="row-actions">
        <button class="secondary" type="button" data-edit="${escapeHtml(row.id)}">Editar</button>
        ${canDeleteRecord("viabilityAnalyses") ? `<button class="danger" type="button" data-delete="${escapeHtml(row.id)}">Excluir</button>` : ""}
      </footer>` : ""}
    </article>
  `;
}

function viabilityMiniChart(m) {
  const max = Math.max(m.contractValue, m.estimatedCost, Math.abs(m.grossMargin), 1);
  const bar = (label, value, color) => `
    <div class="hbar-row">
      <span>${label}</span>
      <div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(4, Math.abs(value) / max * 100)}%; background:${value < 0 ? "#b42318" : color}"></div></div>
      <strong>${compactMoney(value)}</strong>
    </div>`;
  return `<div class="hbar-list viability-mini-chart">
    ${bar("Receita", m.contractValue, "#2563eb")}
    ${bar("Custo", m.estimatedCost, "#b8872d")}
    ${bar("Margem", m.grossMargin, "#147a47")}
  </div>`;
}

// Calcula os indicadores, resolve o parecer final e registra o histórico de alterações.
// Devolve uma mensagem de erro (string vazia = sucesso).
function normalizeViabilityAnalysis(data) {
  data.contractValue = Number(data.contractValue || 0);
  data.estimatedCost = Number(data.estimatedCost || 0);
  data.executionMonths = Number(data.executionMonths || 0);
  data.tmaPercent = Number(data.tmaPercent || 0);
  if (data.contractValue <= 0) return "Informe o valor total do contrato/proposta.";
  if (data.executionMonths <= 0) return "Informe o prazo de execução em meses.";
  const m = viabilityMetrics(data);
  data.grossMargin = roundMoney(m.grossMargin);
  data.marginPercent = Math.round(m.marginPercent * 100) / 100;
  data.estimatedProfit = roundMoney(m.grossMargin);
  data.paybackMonths = Math.round(m.paybackMonths * 10) / 10;
  data.npv = roundMoney(m.npv);
  data.irrPercent = m.irrPercent === null ? null : Math.round(m.irrPercent * 100) / 100;
  data.autoVerdict = m.autoVerdict;
  const isManual = Boolean(data.verdict) && data.verdict !== "Automático";
  if (isManual && data.verdict !== m.autoVerdict && !String(data.verdictJustification || "").trim()) {
    return `Informe a justificativa: o parecer manual "${data.verdict}" difere do parecer sugerido "${m.autoVerdict}".`;
  }
  data.finalVerdict = isManual ? data.verdict : m.autoVerdict;
  if (!data.analysisDate) data.analysisDate = new Date().toISOString().slice(0, 10);
  if (!data.responsibleUserId) data.responsibleUserId = currentUser?.id || "";
  const previous = editing?.id ? byId("viabilityAnalyses", editing.id) : null;
  const previousVerdict = previous ? (previous.finalVerdict || viabilityFinalVerdict(previous)) : "";
  let history = previous?.verdictHistory || "";
  if (data.finalVerdict !== previousVerdict) {
    const stamp = new Date().toLocaleString("pt-BR");
    const author = currentUser?.fullName || currentUser?.username || "sistema";
    const detail = isManual ? `manual${String(data.verdictJustification || "").trim() ? `: ${String(data.verdictJustification).trim()}` : ""}` : "automático";
    const line = `${stamp} — ${author}: parecer ${previousVerdict ? `alterado de "${previousVerdict}" para` : "definido como"} "${data.finalVerdict}" (${detail})`;
    history = history ? `${history}\n${line}` : line;
    // Só as últimas 20 entradas: o histórico crescia sem limite a cada mudança.
    history = history.split("\n").slice(-20).join("\n");
  }
  data.verdictHistory = history;
  return "";
}

// ── Plugins (sistemas externos no menu lateral) ─────────────────────────────

function sortedPlugins() {
  return (db.plugins || []).slice().sort((a, b) =>
    Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || "").localeCompare(String(b.name || "")));
}

// URL de plugin aceita: https://..., http://..., caminho absoluto (/...) ou
// relativo explícito (./...) para plugins hospedados dentro do próprio sistema.
function isValidPluginUrl(url) {
  return /^(https?:\/\/|\.?\/)/i.test(String(url || "").trim());
}

// Plugins ativos visíveis para o perfil atual (com URL válida).
function activePlugins() {
  return sortedPlugins()
    .filter((plugin) => plugin.status !== "Inativo" && isValidPluginUrl(plugin.url))
    .filter((plugin) => pluginAllowedForRole(plugin, currentUser?.role));
}

// roles vazio = todos os perfis; aceita chaves (financeiro) ou rótulos (Financeiro).
function pluginAllowedForRole(plugin, role) {
  if (role === "admin") return true;
  const allowed = String(plugin.roles || "").split(/[;,]/).map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return true;
  const roleKey = String(role || "").toLowerCase();
  const roleLabel = String(roleLabels[role] || "").toLowerCase();
  return allowed.includes(roleKey) || (Boolean(roleLabel) && allowed.includes(roleLabel));
}

function pluginRolesLabel(plugin) {
  const list = String(plugin.roles || "").split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  if (!list.length) return "Todos os perfis";
  return list.map((item) => roleLabels[item] || item).join(", ");
}

function renderPlugins() {
  const editable = canEditModule("plugins");
  const rows = sortedPlugins();
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Plugins</h2>
        <p>Sistemas externos exibidos no menu lateral e abertos em nova aba.${editable ? " Adicione, ative/desative, reordene e defina os perfis com acesso." : ""}</p>
      </div>
      ${editable ? '<button class="primary" type="button" id="newPlugin">Novo plugin</button>' : ""}
    </section>
    ${rows.length
      ? `<section class="plugins-grid">${rows.map((row, index) => pluginCard(row, index, rows.length, editable)).join("")}</section>`
      : '<div class="empty">Nenhum plugin cadastrado.</div>'}
  `;
  qs("newPlugin")?.addEventListener("click", () => openForm("plugins"));
  qs("content").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openForm("plugins", button.dataset.edit)));
  qs("content").querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeRecord("plugins", button.dataset.delete)));
  qs("content").querySelectorAll("[data-toggle-plugin]").forEach((button) => button.addEventListener("click", () => togglePluginStatus(button.dataset.togglePlugin)));
  qs("content").querySelectorAll("[data-move-plugin]").forEach((button) => button.addEventListener("click", () => {
    const [id, direction] = button.dataset.movePlugin.split(":");
    movePlugin(id, direction);
  }));
}

function pluginCard(row, index, total, editable) {
  const active = row.status !== "Inativo";
  return `
    <article class="plugin-card ${active ? "" : "inactive"}">
      <header>
        <span class="plugin-icon">${escapeHtml(row.icon || "🔌")}</span>
        <div class="plugin-copy">
          <h3>${escapeHtml(row.name)}</h3>
          <p>${escapeHtml(row.description || "")}</p>
        </div>
        <span class="status ${active ? "success" : ""}">${active ? "Ativo" : "Inativo"}</span>
      </header>
      <p class="plugin-url"><a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.url)}</a></p>
      <p class="plugin-roles">Perfis com acesso: ${escapeHtml(pluginRolesLabel(row))}</p>
      ${editable ? `<footer class="row-actions">
        <button class="secondary" type="button" data-move-plugin="${escapeHtml(row.id)}:up" ${index === 0 ? "disabled" : ""} aria-label="Mover para cima">↑</button>
        <button class="secondary" type="button" data-move-plugin="${escapeHtml(row.id)}:down" ${index === total - 1 ? "disabled" : ""} aria-label="Mover para baixo">↓</button>
        <button class="secondary" type="button" data-toggle-plugin="${escapeHtml(row.id)}">${active ? "Desativar" : "Ativar"}</button>
        <button class="secondary" type="button" data-edit="${escapeHtml(row.id)}">Editar</button>
        ${canDeleteRecord("plugins") ? `<button class="danger" type="button" data-delete="${escapeHtml(row.id)}">Excluir</button>` : ""}
      </footer>` : ""}
    </article>
  `;
}

// Preferências do sistema: CRUD padrão + card de seleção de tema.
function renderPreferences() {
  renderCrud("preferences");
  const section = document.createElement("section");
  section.className = "theme-pref-card";
  section.innerHTML = `
    <div>
      <h3>Tema do sistema</h3>
      <p>Claro, escuro ou automático (segue o tema do sistema operacional). A preferência é salva neste navegador para o seu usuário.</p>
    </div>
    <div class="theme-switch theme-switch-large" role="group" aria-label="Tema do sistema">
      ${themeSwitchButtonsHtml()}
    </div>
  `;
  const head = qs("content").querySelector(".module-head");
  if (head) head.after(section);
  else qs("content").prepend(section);
  wireThemeSwitch(section);
}

// Atualização parcial de um plugin (status/ordem) no servidor ou no modo local.
async function savePluginPatch(id, patch) {
  if (serverMode && apiResources.plugins) {
    const payload = await apiRequest(`${apiResources.plugins}/${id}`, { method: "PUT", body: JSON.stringify(patch) });
    db.plugins = (db.plugins || []).map((row) => sameId(row.id, id) ? payload.record : row);
  } else {
    db.plugins = (db.plugins || []).map((row) => sameId(row.id, id) ? { ...row, ...patch } : row);
    saveDb();
  }
}

async function togglePluginStatus(id) {
  const record = byId("plugins", id);
  if (!record) return;
  const newStatus = record.status === "Inativo" ? "Ativo" : "Inativo";
  try {
    await savePluginPatch(id, { status: newStatus });
  } catch (error) {
    return alert(`Não foi possível atualizar o plugin: ${error.message}`);
  }
  logAudit("edit", "plugins", `Plugin ${record.name}: ${newStatus === "Ativo" ? "ativado" : "desativado"}`);
  render();
}

// Reordena trocando a posição com o vizinho e regravando sortOrder sequencial.
async function movePlugin(id, direction) {
  const rows = sortedPlugins();
  const index = rows.findIndex((row) => sameId(row.id, id));
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) return;
  const order = rows.map((row) => row.id);
  [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
  try {
    for (let position = 0; position < order.length; position++) {
      const row = rows.find((item) => sameId(item.id, order[position]));
      if (Number(row.sortOrder || 0) !== position + 1) {
        await savePluginPatch(row.id, { sortOrder: position + 1 });
      }
    }
  } catch (error) {
    return alert(`Não foi possível reordenar os plugins: ${error.message}`);
  }
  render();
}

// Pré-visualização em tempo real dos cálculos no formulário de viabilidade.
function setupViabilityFormPreview() {
  const fields = qs("formFields");
  const preview = document.createElement("div");
  preview.className = "full viability-form-preview";
  fields.appendChild(preview);
  const read = (name) => {
    const input = fields.querySelector(`[name="${name}"]`);
    if (!input) return 0;
    if (input.dataset.format === "money") return parseMoneyInput(input.value);
    if (input.dataset.format === "percent") return parsePercentInput(input.value);
    return Number(input.value || 0);
  };
  const update = () => {
    const m = viabilityMetrics({
      contractValue: read("contractValue"),
      estimatedCost: read("estimatedCost"),
      executionMonths: read("executionMonths"),
      tmaPercent: read("tmaPercent"),
    });
    const verdictSelect = fields.querySelector('[name="verdict"]');
    const isManual = verdictSelect && verdictSelect.value !== "Automático";
    const finalVerdict = isManual ? verdictSelect.value : m.autoVerdict;
    preview.innerHTML = `
      <h4>Cálculos automáticos</h4>
      <div class="viability-indicators">
        <div><span>Margem bruta</span><strong>${asMoney(m.grossMargin)}</strong></div>
        <div><span>Margem %</span><strong>${asPercent(m.marginPercent)}</strong></div>
        <div><span>Lucro estimado</span><strong>${asMoney(m.grossMargin)}</strong></div>
        <div><span>Payback</span><strong>${m.paybackMonths ? `${m.paybackMonths.toFixed(1)} meses` : "—"}</strong></div>
        <div><span>VPL</span><strong class="${m.npv < 0 ? "neg" : ""}">${asMoney(m.npv)}</strong></div>
        <div><span>TIR estimada</span><strong>${m.irrPercent === null ? "—" : asPercent(m.irrPercent)}</strong></div>
      </div>
      <p class="viability-suggestion">Parecer sugerido: <span class="viability-verdict ${viabilityTone(m.autoVerdict)}">${m.autoVerdict}</span>${isManual ? ` · Parecer final (manual): <span class="viability-verdict ${viabilityTone(finalVerdict)}">${escapeHtml(finalVerdict)}</span>` : ""}</p>
    `;
  };
  ["contractValue", "estimatedCost", "executionMonths", "tmaPercent"].forEach((name) => {
    const input = fields.querySelector(`[name="${name}"]`);
    input?.addEventListener("input", update);
    input?.addEventListener("blur", update);
  });
  fields.querySelector('[name="verdict"]')?.addEventListener("change", update);
  update();
}

function renderCrud(key) {
  const config = configs[key];
  let rows = visibleRowsForModule(key, applyFilters(db[key] || []));
  if (key === "fiscalDocuments" && fiscalSoSemObra) {
    rows = rows.filter((row) => !row.projectId);
  }
  const editable = canEditModule(key);
  const tableFields = config.fields
    .filter((field) => !String(field[2]).startsWith("file"))
    .map((field) => field[0]);
  if (key === "fiscalDocuments") tableFields.push("hasPdf", "hasXml");
  if (key === "payable" || key === "receivable") tableFields.push("fiscalDocumentNumber");
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>${config.title}</h2>
        <p>${config.description}</p>
      </div>
      ${editable ? '<button class="primary" type="button" id="newRecord">Novo</button>' : ""}
    </section>
    ${table(config.title, rows, tableFields, editable, key)}
  `;
  qs("newRecord")?.addEventListener("click", () => openForm(key));
  qs("content").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openForm(key, button.dataset.edit)));
  qs("content").querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeRecord(key, button.dataset.delete)));
  qs("content").querySelectorAll("[data-toggle-block]").forEach((btn) => btn.addEventListener("click", () => toggleUserBlock(btn.dataset.toggleBlock, btn.dataset.blockState !== "1")));
  qs("content").querySelectorAll("[data-user-perms]").forEach((btn) => btn.addEventListener("click", () => abrirPermissoesUsuario(btn.dataset.userPerms)));
  qs("content").querySelectorAll(".reveal-btn").forEach((btn) => btn.addEventListener("click", () => { btn.parentElement.innerHTML = svgText(btn.dataset.original); }));
  qs("content").querySelectorAll("[data-fiscal-download]").forEach((btn) => btn.addEventListener("click", () => {
    const [id, kind] = btn.dataset.fiscalDownload.split(":");
    downloadFiscalFile(id, kind);
  }));
  qs("content").querySelectorAll("[data-convert-proposal]").forEach((button) => button.addEventListener("click", () => convertProposalToSale(button.dataset.convertProposal)));
  qs("content").querySelectorAll("[data-preview-proposal]").forEach((button) => button.addEventListener("click", () => openSavedProposalPreview(button.dataset.previewProposal)));
  qs("content").querySelectorAll("[data-create-proposal-receivables]").forEach((button) => button.addEventListener("click", () => createReceivablesFromProposal(button.dataset.createProposalReceivables)));
  qs("content").querySelectorAll("[data-create-receivable]").forEach((button) => button.addEventListener("click", () => createReceivableFromSale(button.dataset.createReceivable)));
  qs("content").querySelectorAll("[data-generate-proposal]").forEach((button) => button.addEventListener("click", () => openProposalGenerator(button.dataset.generateProposal)));
  qs("content").querySelectorAll("[data-add-budget-item]").forEach((button) => button.addEventListener("click", () => {
    const [sourceKey, id] = button.dataset.addBudgetItem.split(":");
    addBudgetItemFromSource(sourceKey, id);
  }));
  if (key === "fiscalDocuments") setupNfseImport();
  if (key === "fiscalDocuments") setupFiscalSemObraFilter();
}

// Campos cujo formatCell devolve HTML intencional (links e badges); todo o resto é escapado.
const HTML_CELL_FIELDS = new Set(["generatedLink", "hasPdf", "hasXml", "status"]);

function tableCell(field, row) {
  const content = formatCell(field, row[field], row);
  return HTML_CELL_FIELDS.has(field) ? content : escapeHtml(content);
}

function table(title, rows, fields, actions = false, actionKey = "") {
  if (!rows.length) return `<div class="empty">Sem dados para exibir</div>`;
  const canEdit = actions && (!actionKey || canEditModule(actionKey));
  const canDel = actions && (!actionKey || canDeleteRecord(actionKey));
  return `<section class="table-wrap" data-export-title="${escapeHtml(title)}">
    <table>
      <thead><tr>${fields.map((field) => `<th>${labelFor(field)}</th>`).join("")}${actions ? "<th>Ações</th>" : ""}</tr></thead>
      <tbody>
        ${rows.map((row) => {
          const extra = extraRowActions(actionKey, row);
          const editBtn = canEdit ? `<button class="secondary" type="button" data-action-key="${actionKey}" data-edit="${row.id}">Editar</button>` : "";
          const delBtn = canDel ? `<button class="danger" type="button" data-action-key="${actionKey}" data-delete="${row.id}">Excluir</button>` : "";
          const noAction = !extra && !canEdit && !canDel ? '<span class="muted">Somente leitura</span>' : "";
          return `<tr>${fields.map((field) => `<td>${tableCell(field, row)}</td>`).join("")}${actions ? `<td><div class="row-actions">${extra}${editBtn}${delBtn}${noAction}</div></td>` : ""}</tr>`;
        }).join("")}
      </tbody>
    </table>
  </section>`;
}

function extraRowActions(actionKey, row) {
  if (actionKey === "users" && isAdmin()) {
    const perms = `<button class="secondary" type="button" data-user-perms="${row.id}">Permissões</button>`;
    if (row.id === currentUser?.id) return perms;
    const blocked = row.blocked;
    return `${perms}<button class="secondary" type="button" data-toggle-block="${row.id}" data-block-state="${blocked ? "1" : "0"}">${blocked ? "Desbloquear" : "Bloquear"}</button>`;
  }
  if (["sinapiInputs", "sinapiCompositions", "ownCompositions", "quotes"].includes(actionKey)) {
    return `<button class="secondary" type="button" data-add-budget-item="${actionKey}:${row.id}">Adicionar</button>`;
  }
  if (actionKey === "workBudgets" && canGenerateProposalForBudget(row)) {
    return `<button class="secondary" type="button" data-generate-proposal="${row.id}">Gerar Proposta</button>`;
  }
  if (actionKey === "proposals") {
    const hasReceivable = (db.receivable || []).some((item) => sameId(item.proposalId, row.id));
    return `${row.status === "Aprovada" ? `<button class="secondary" type="button" data-convert-proposal="${row.id}">Converter</button>${hasReceivable ? "" : `<button class="secondary" type="button" data-create-proposal-receivables="${row.id}">Gerar contas</button>`}` : ""}${row.proposalBody ? `<button class="secondary" type="button" data-preview-proposal="${row.id}">Prévia/PDF</button>` : ""}`;
  }
  if (actionKey === "sales" && row.status !== "Cancelado") {
    const exists = (db.receivable || []).some((item) => (row.proposalId && sameId(item.proposalId, row.proposalId)) || (row.number && item.document === row.number));
    return exists ? "" : `<button class="secondary" type="button" data-create-receivable="${row.id}">Gerar conta</button>`;
  }
  return "";
}

function labelFor(field) {
  const labels = {
    name: "Nome", document: "Documento", issueDate: "Emissão", dueDate: "Vencimento", receivedDate: "Recebimento", paidDate: "Pagamento",
    clientId: "Cliente", supplierId: "Fornecedor", categoryId: "Categoria", costCenterId: "Centro de custo", chartAccountId: "Conta contábil",
    projectId: "Obra/Projeto", address: "Endereço", responsible: "Responsável", startDate: "Início", endForecast: "Previsão de término",
    budgetForecast: "Orçamento previsto", revenueContracted: "Receita contratada", costForecast: "Custo previsto", notes: "Observações",
    debitAccountId: "Débito", creditAccountId: "Crédito", bankAccount: "Banco", amount: "Valor", status: "Status", date: "Data",
    competenceDate: "Competência", entryDate: "Lançamento", originDocument: "Origem", history: "Histórico", description: "Descrição",
    code: "Código", type: "Tipo", parentId: "Conta pai", acceptsEntries: "Recebe lançamentos", manager: "Responsável", sku: "SKU",
    cost: "Custo", price: "Preço", stock: "Estoque", number: "Número", email: "E-mail", phone: "Telefone",
    bank: "Banco", agency: "Agência", accountNumber: "Conta", openingBalance: "Saldo inicial", city: "Cidade",
    baseAmount: "Base de cálculo", rate: "Alíquota %", report: "Relatório", base: "Base", total: "Total",
    line: "Linha", revenue: "Receita", expense: "Despesa", result: "Resultado", balance: "Saldo",
    month: "Mês", value: "Valor", module: "Módulo", count: "Quantidade", username: "Usuário", fullName: "Nome", password: "Senha", role: "Perfil",
    documentNumber: "Número da nota", issueDate: "Emissão", payableId: "Conta a pagar", receivableId: "Conta a receber", saleId: "Venda/Contrato",
    hasPdf: "PDF", hasXml: "XML", fiscalDocumentNumber: "Nota fiscal",
    technicalResponsible: "Responsável técnico", projectManagerId: "Gestor", commercialUserId: "Comercial", financialUserId: "Financeiro",
    completionDate: "Conclusão", realizedCost: "Custo realizado", stage: "Etapa", physicalProgress: "Avanço físico", financialProgress: "Avanço financeiro",
    stageName: "Etapa", sortOrder: "Ordem", plannedStartDate: "Início previsto", plannedEndDate: "Término previsto",
    actualStartDate: "Início real", actualEndDate: "Término real", plannedPhysicalPercent: "Físico previsto",
    actualPhysicalPercent: "Físico realizado", plannedFinancialAmount: "Financeiro previsto", actualFinancialAmount: "Financeiro realizado",
    isMilestone: "Marco", milestoneName: "Nome do marco", milestoneMessage: "Mensagem do marco", scheduleStepId: "Etapa",
    milestoneId: "Marco", defaultMessage: "Mensagem padrão", plannedDate: "Data prevista", completedDate: "Data concluída",
    recipient: "Destinatário", generatedLink: "Link gerado", responsibleUserId: "Responsável", token: "Token", url: "URL", visibility: "Visibilidade",
    expectedDate: "Previsão", title: "Título", visibleToClient: "Visível ao cliente", canView: "Visualizar", canCreate: "Criar",
    canEdit: "Editar", canDelete: "Excluir", canExport: "Exportar", canApprove: "Aprovar", canAttach: "Anexar",
    areaId: "Área/Disciplina", actionTypeId: "Tipo de atuação", subtypeId: "Subtipo/Serviço", modelId: "Modelo",
    budgetId: "Orçamento", serviceId: "Serviço", proposalId: "Proposta", origin: "Origem", parentProposalId: "Proposta anterior", createdByUserId: "Criada por",
    proposalObject: "Objeto", scope: "Escopo", stages: "Etapas", deliverables: "Entregáveis", deadline: "Prazo",
    paymentTerms: "Condição de pagamento", includedItems: "Itens inclusos", excludedItems: "Itens não inclusos",
    clientResponsibilities: "Responsabilidades do cliente", companyResponsibilities: "Responsabilidades da empresa",
    validityDays: "Validade (dias)", validityDate: "Validade", generalConditions: "Condições gerais", acceptanceText: "Aceite",
    signatureText: "Assinatura", printLayout: "Layout", proposalBody: "Corpo da proposta", itemDisplayMode: "Exibição dos itens",
    paymentCondition: "Condição de pagamento", executionDeadline: "Prazo de execução", technicalResponsible: "Responsável técnico",
    commercialResponsible: "Responsável comercial", commercialNotes: "Observações comerciais",
    versao: "Versão", data_versao: "Data da versão",
    descricao: "Descrição", alteracoes: "Alterações",
    servico: "Serviço SiAC", servicoNome: "Serviço", servicoGrupo: "Grupo", criteriosAceitacao: "Critérios de aceitação",
    responsavelElaboracao: "Elaborado por", dataElaboracao: "Elaboração", responsavelTecnico: "Responsável técnico",
    servicosQtd: "Serviços controlados", materiaisQtd: "Materiais", localObra: "Local", dataExecucao: "Execução",
    responsavelInspecao: "Inspetor", resultado: "Resultado", treinamento: "Treinamento", materialNome: "Material",
    notaFiscal: "Nota fiscal", quantidade: "Qtde", unidade: "Unid.", dataRecebimento: "Recebimento", numero: "Número",
    grau: "Grau", dataDeteccao: "Detecção", prazo: "Prazo da ação", prazoAcao: "Prazo da ação", dataTreinamento: "Data",
    instrutor: "Instrutor", cargaHoraria: "Carga (h)", tipo: "Tipo", dataAuditoria: "Data", auditor: "Auditor",
    conformidade: "Conformidade", aprovadoPor: "Aprovado por", dataAprovacao: "Aprovação",
    entradasPrevistas: "Entradas previstas", entradasRealizadas: "Entradas realizadas",
    saidasPrevistas: "Saídas previstas", saidasRealizadas: "Saídas realizadas", saldoFinal: "Saldo final",
    workBudgetId: "Orçamento de obra", workBudgetItemId: "Item do orçamento", sinapiReferenceId: "Referência SINAPI",
    sinapiUf: "UF SINAPI", sinapiReferenceType: "Tipo SINAPI",
    referenceMonth: "Mês", referenceYear: "Ano", priceType: "Tipo de preço", source: "Fonte", importDate: "Importação",
    defaultUf: "UF padrão", locationName: "Local de uso", issueDate: "Emissão", availableTypes: "Tipos disponíveis",
    referenceType: "Tipo referência", uf: "UF", classification: "Classificação", priceOrigin: "Origem preço", percentAS: "%AS",
    compositionCode: "Código composição", situation: "Situação", laborPercent: "% mão de obra", familyCode: "Família",
    inputCode: "Código insumo", inputDescription: "Descrição insumo", referenceCode: "Referência", maintenanceType: "Manutenção",
    defaultReferenceMonth: "Mês padrão", defaultReferenceYear: "Ano padrão", defaultReferenceType: "Tipo padrão",
    defaultBdiPercent: "BDI padrão", defaultItemMode: "Uso padrão", showSinapiCodeInProposal: "Código na proposta",
    showAnalyticalInProposal: "Analítico na proposta", showUnitPriceInProposal: "Unitário na proposta", showGlobalOnlyInProposal: "Valor global",
    importUserId: "Usuário importação", origin: "Origem", unit: "Unidade", quantity: "Quantidade", unitCost: "Custo unitário",
    totalCost: "Custo total", bdiPercent: "BDI %", chargesPercent: "Encargos %", discountPercent: "Desconto %",
    unitPrice: "Preço unitário", totalPrice: "Preço total", directCost: "Custo direto", version: "Versão",
    budgetDate: "Data orçamento", stageName: "Etapa", groupName: "Grupo", className: "Classe",
    sinapiCompositionId: "Composição SINAPI", itemType: "Tipo do item", itemCode: "Código do item", itemDescription: "Descrição do item",
    coefficient: "Coeficiente", estimatedCost: "Custo estimado", laborCost: "Mão de obra", materialCost: "Material",
    equipmentCost: "Equipamentos", thirdPartyCost: "Terceiros", marginPercent: "Margem %", suggestedPrice: "Preço sugerido",
    unitValue: "Valor unitário", totalValue: "Valor total", quoteDate: "Data cotação", attachmentPath: "Anexo",
    abcPosition: "#", individualPercent: "% individual", accumulatedPercent: "% acumulado", abcClass: "Classe ABC",
    workTypeId: "Tipo de obra", standardStageId: "Etapa padrão", customFieldId: "Campo personalizado",
    fieldName: "Campo", fieldType: "Tipo do campo", options: "Opções", required: "Obrigatório", sortOrder: "Ordem",
    color: "Cor", defaultPhysicalPercent: "Físico padrão", serviceSubtypeId: "Subtipo/Serviço", body: "Modelo",
    variables: "Variáveis", folder: "Subpasta", visibleToClientDefault: "Visível ao cliente", checklistId: "Checklist",
    allowsPhoto: "Permite foto", allowsAttachment: "Permite anexo", installments: "Parcelas", context: "Contexto",
    message: "Mensagem", rule: "Regra", predecessorIds: "Dependências", durationDays: "Duração",
    contractValue: "Valor do contrato", executionMonths: "Prazo (meses)", tmaPercent: "TMA %", grossMargin: "Margem bruta",
    estimatedProfit: "Lucro estimado", paybackMonths: "Payback (meses)", npv: "VPL", irrPercent: "TIR %",
    verdict: "Parecer final", autoVerdict: "Parecer sugerido", verdictJustification: "Justificativa",
    verdictHistory: "Histórico do parecer", analysisDate: "Data da análise", risks: "Riscos identificados",
    icon: "Ícone", roles: "Perfis com acesso",
    obra_id: "Obra/Projeto", cliente_id: "Cliente", usuario_id: "Responsável", titulo: "Título", tipo: "Tipo",
    data_inicio: "Início", data_fim: "Fim", dia_todo: "Dia todo", lembrete_minutos: "Lembrete",
    board_id: "Board", coluna_id: "Coluna", responsavel_id: "Responsável", data_vencimento: "Prazo",
    prioridade: "Prioridade", referencia_tipo: "Referência", referencia_id: "ID ref.", nome: "Nome", ordem: "Ordem",
  };
  return labels[field] || field;
}

function formatCell(field, value, row = {}) {
  if (field.endsWith("Date") || field === "date" || field === "endForecast" || field === "data_versao") return asDate(value);
  if (isMoneyField(field)) return asMoney(value);
  if (isPercentField(field)) return asPercent(value);
  if (field === "password") return "••••••••";
  if (["phone"].includes(field) && isSensitiveFieldMasked() && value) return maskedCell(value);
  if (["cpf", "document"].includes(field) && isSensitiveFieldMasked() && value) return maskedCell(value);
  if (field === "role") return roleLabels[value] || value || "";
  if (field === "clientId") return nameOf("clients", value);
  if (field === "cliente_id") return nameOf("clients", value);
  if (field === "supplierId") return nameOf("suppliers", value);
  if (field === "categoryId") return nameOf("categories", value);
  if (field === "costCenterId") return nameOf("costCenters", value);
  if (field === "projectId") return nameOf("projects", value);
  if (field === "obra_id") return nameOf("projects", value);
  if (field === "usuario_id" || field === "responsavel_id") return nameOf("users", value);
  if (field === "board_id") return nameOf("kanbanBoards", value);
  if (field === "coluna_id") return nameOf("kanbanColumns", value);
  if (field === "tipo") return agendaTypeLabel(value);
  if (field === "prioridade") return priorityLabel(value);
  if (field === "data_inicio" || field === "data_fim") return value ? String(value).replace("T", " ") : "";
  if (field === "data_vencimento") return asDate(value);
  if (["createdByUserId", "commercialUserId", "projectManagerId", "financialUserId"].includes(field)) return nameOf("users", value);
  if (field === "budgetId") return nameOf("budgets", value);
  if (field === "workBudgetId") return nameOf("workBudgets", value);
  if (field === "workBudgetItemId") return nameOf("workBudgetItems", value);
  if (field === "sinapiReferenceId") {
    const row = byId("sinapiReferences", value);
    return row ? `${row.uf}/${row.referenceMonth}/${row.referenceYear} - ${row.priceType}` : "";
  }
  if (field === "sinapiCompositionId") return nameOf("sinapiCompositions", value);
  if (field === "workTypeId") return nameOf("workTypes", value);
  if (field === "standardStageId") return nameOf("standardStages", value);
  if (field === "customFieldId") return nameOf("customFields", value);
  if (field === "checklistId") return nameOf("checklists", value);
  if (field === "serviceSubtypeId") return nameOf("proposalServiceSubtypes", value);
  if (field === "importUserId") return nameOf("users", value);
  if (field === "serviceId") return nameOf("services", value);
  if (field === "parentProposalId") return nameOf("proposals", value);
  if (field === "proposalId") return nameOf("proposals", value);
  if (field === "modelId") return nameOf("proposalModels", value);
  if (field === "areaId") return nameOf("proposalAreas", value);
  if (field === "actionTypeId") return nameOf("proposalActionTypes", value);
  if (field === "subtypeId") return nameOf("proposalServiceSubtypes", value);
  if (field === "scheduleStepId") return nameOf("projectSchedule", value);
  if (field === "milestoneId") return nameOf("projectMilestones", value);
  if (field === "responsibleUserId") return nameOf("users", value);
  // Só http(s) vira link clicável: escapeHtml não bloqueia esquemas como javascript:.
  if (field === "generatedLink") return value ? (/^https?:\/\//i.test(String(value)) ? `<a href="${svgText(value)}" target="_blank" rel="noopener">Abrir link</a>` : escapeHtml(value)) : "";
  // Downloads via fetch autenticado (blob): o token não vai mais na URL (access logs).
  if (field === "hasPdf") return value ? `<button class="secondary" type="button" data-fiscal-download="${escapeHtml(row.id)}:pdf">PDF</button>` : "";
  if (field === "hasXml") return value ? `<button class="secondary" type="button" data-fiscal-download="${escapeHtml(row.id)}:xml">XML</button>` : "";
  if (field === "fiscalDocumentNumber") {
    const match = (db.fiscalDocuments || []).find((doc) => sameId(doc.payableId, row.id) || sameId(doc.receivableId, row.id));
    return match ? match.documentNumber : "";
  }
  if (["chartAccountId", "debitAccountId", "creditAccountId", "parentId"].includes(field)) return nameOf("chartAccounts", value);
  if (field === "status") return `<span class="status ${["Pago", "Recebido", "Aprovado", "Concluída", "Concluído", "Enviado manualmente"].includes(value) ? "success" : ["Vencido", "Atrasada"].includes(value) ? "danger" : ""}">${escapeHtml(value || "")}</span>`;
  return value ?? "";
}

function openForm(key, id = null) {
  if (!canEditModule(key)) return;
  editing = { key, id };
  const config = configs[key];
  const row = id ? byId(key, id) : {};
  if (!id && key === "workBudgetItems" && selectedWorkBudgetId) {
    const budget = byId("workBudgets", selectedWorkBudgetId);
    row.workBudgetId = selectedWorkBudgetId;
    row.projectId = budget?.projectId || "";
    row.bdiPercent = budget?.bdiPercent || 0;
  }
  if (!id && key === "agendaEvents") {
    const defaultAgendaDate = agendaSafeDateString(agendaNewDate, agendaSafeDateString(new Date()));
    row.data_inicio = `${defaultAgendaDate}T09:00`;
    row.data_fim = `${defaultAgendaDate}T10:00`;
    row.tipo = "reuniao";
    row.status = "agendado";
    row.lembrete_minutos = 60;
    row.dia_todo = "0";
  }
  if (!id && key === "kanbanCards") {
    row.coluna_id = kanbanNewColumnId || "";
    row.prioridade = "media";
    row.ordem = Date.now();
  }
  if (!id && key === "viabilityAnalyses") {
    row.analysisDate = new Date().toISOString().slice(0, 10);
    row.responsibleUserId = currentUser?.id || "";
    row.status = "Em análise";
    row.verdict = "Automático";
    if (viabilityProjectFilter) row.projectId = viabilityProjectFilter;
  }
  qs("dialogTitle").textContent = id ? `Editar ${config.title}` : `Novo ${config.title}`;
  qs("formFields").innerHTML = config.fields.map(([field, label, type, options]) => inputFor(key, field, label, type, options, row[field], row)).join("");
  applyFormEnhancements();
  qs("recordDialog").showModal();
}

function inputFor(key, field, label, type, options, value = "", row = {}) {
  const required = options === true ? "required" : "";
  const full = type === "textarea" ? "full" : "";
  const placeholder = placeholderFor(field, label, key);
  if (type === "textarea") return `<label class="${full}">${label}<textarea name="${field}" rows="3" placeholder="${placeholder}" ${required}>${escapeHtml(value || "")}</textarea></label>`;
  if (type === "file-pdf") return `<label>${label}<input name="${field}" type="file" accept="application/pdf,.pdf" data-file-field="${field}">${row.hasPdf ? '<span class="field-hint">PDF já anexado</span>' : ""}</label>`;
  if (type === "file-xml") return `<label>${label}<input name="${field}" type="file" accept=".xml,text/xml,application/xml" data-file-field="${field}">${row.hasXml ? '<span class="field-hint">XML já anexado</span>' : ""}</label>`;
  if (type === "select") return `<label>${label}<select name="${field}" ${required}>${options.map((option) => `<option ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
  const lookup = {
    client: ["clients", "Selecione"],
    supplier: ["suppliers", "Selecione"],
    category: ["categories", "Selecione"],
    costCenter: ["costCenters", "Selecione"],
    project: ["projects", "Selecione"],
    chartAccount: ["chartAccounts", "Selecione"],
    payable: ["payable", "Selecione"],
    receivable: ["receivable", "Selecione"],
    sale: ["sales", "Selecione"],
    user: ["users", "Selecione"],
    budget: ["budgets", "Selecione"],
    workBudget: ["workBudgets", "Selecione"],
    workBudgetItem: ["workBudgetItems", "Selecione"],
    sinapiReference: ["sinapiReferences", "Selecione"],
    sinapiComposition: ["sinapiCompositions", "Selecione"],
    workType: ["workTypes", "Selecione"],
    standardStage: ["standardStages", "Selecione"],
    customField: ["customFields", "Selecione"],
    reportModel: ["reportModels", "Selecione"],
    documentType: ["documentTypes", "Selecione"],
    checklist: ["checklists", "Selecione"],
    measurementType: ["measurementTypes", "Selecione"],
    paymentMethod: ["paymentMethods", "Selecione"],
    service: ["services", "Selecione"],
    proposal: ["proposals", "Selecione"],
    proposalModel: ["proposalModels", "Selecione"],
    proposalArea: ["proposalAreas", "Selecione"],
    proposalActionType: ["proposalActionTypes", "Selecione"],
    proposalSubtype: ["proposalServiceSubtypes", "Selecione"],
    scheduleStep: ["projectSchedule", "Selecione"],
    projectMilestone: ["projectMilestones", "Selecione"],
    kanbanColumn: ["kanbanColumns", "Selecione"],
  }[type];
  if (lookup) return `<label>${label}<select name="${field}" ${required}><option value="">${lookup[1]}</option>${db[lookup[0]].map((row) => `<option value="${escapeHtml(row.id)}" ${String(row.id) === String(value) ? "selected" : ""}>${escapeHtml(`${row.code ? `${row.code} - ` : ""}${row.name || row.number || row.document || row.username || row.id}`)}</option>`).join("")}</select></label>`;
  if (isMoneyField(field) || type === "money") return `<label>${label}<input name="${field}" type="text" inputmode="decimal" value="${formatMoneyInput(value)}" placeholder="${placeholder}" data-format="money" ${required}></label>`;
  if (isPercentField(field)) return `<label>${label}<input name="${field}" type="text" inputmode="decimal" value="${formatPercentInput(value)}" placeholder="${placeholder}" data-format="percent" ${required}></label>`;
  if (type === "datetime-local") return `<label>${label}<input name="${field}" type="${type}" value="${escapeHtml(String(value || "").replace(" ", "T").slice(0, 16))}" placeholder="${placeholder}" ${required}></label>`;
  const mask = field === "phone" || field === "celular" ? 'data-mask="phone"'
    : field === "cpf" ? 'data-mask="cpf"'
    : field === "data_nascimento" ? 'data-mask="data"'
    : field === "document" && ["clients", "suppliers", "companySettings"].includes(key) ? 'data-mask="document"'
    : ["zipCode", "postalCode", "cep"].includes(field) ? 'data-mask="cep"' : "";
  // O banco guarda só dígitos (cpf/celular) e data ISO; o formulário exibe mascarado.
  if (field === "cpf") value = maskCpf(value);
  if (field === "celular") value = maskPhone(value);
  if (field === "data_nascimento") value = maskData(dataIsoToBr(value));
  return `<label>${label}<input name="${field}" type="${type}" value="${escapeHtml(value || "")}" placeholder="${placeholder}" ${required} ${mask}></label>`;
}

function applyFormEnhancements() {
  qs("formFields").querySelectorAll("[data-mask=phone]").forEach((input) => {
    input.addEventListener("input", () => input.value = maskPhone(input.value));
  });
  qs("formFields").querySelectorAll("[data-mask=document]").forEach((input) => {
    input.addEventListener("input", () => input.value = maskDocument(input.value));
  });
  qs("formFields").querySelectorAll("[data-mask=cep]").forEach((input) => {
    input.addEventListener("input", () => input.value = maskCep(input.value));
  });
  qs("formFields").querySelectorAll("[data-mask=cpf]").forEach((input) => {
    input.addEventListener("input", () => input.value = maskCpf(input.value));
  });
  qs("formFields").querySelectorAll("[data-mask=data]").forEach((input) => {
    input.addEventListener("input", () => input.value = maskData(input.value));
  });
  if (editing?.key === "users") setupUserFormValidation();
  qs("formFields").querySelectorAll("[data-format=money]").forEach((input) => {
    input.addEventListener("focus", () => input.value = input.value ? String(parseMoneyInput(input.value)).replace(".", ",") : "");
    input.addEventListener("blur", () => input.value = formatMoneyInput(parseMoneyInput(input.value)));
  });
  qs("formFields").querySelectorAll("[data-format=percent]").forEach((input) => {
    input.addEventListener("focus", () => input.value = input.value.replace("%", ""));
    input.addEventListener("blur", () => input.value = formatPercentInput(parsePercentInput(input.value)));
  });
  const pwdInput = qs("formFields").querySelector('input[name="password"]');
  if (pwdInput) {
    let meter = pwdInput.parentElement.querySelector(".pwd-strength");
    if (!meter) {
      meter = document.createElement("div");
      meter.className = "pwd-strength";
      pwdInput.parentElement.appendChild(meter);
    }
    const updateMeter = () => {
      const v = pwdInput.value;
      if (!v) { meter.innerHTML = ""; return; }
      const r = validatePassword(v);
      const score = 4 - r.errors.length;
      const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#16a085"];
      const labels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];
      const bars = [0,1,2,3].map(i => `<span style="flex:1;height:4px;border-radius:2px;background:${i < score ? colors[score] : "var(--line)"}"></span>`).join("");
      meter.innerHTML = `<div style="display:flex;gap:3px;margin-top:4px">${bars}</div><span style="font-size:11px;color:${colors[score]}">${labels[score]}</span>` + (r.errors.length ? `<ul style="margin:2px 0 0;padding-left:16px;font-size:11px;color:var(--muted)">${r.errors.map(e => `<li>${e}</li>`).join("")}</ul>` : "");
    };
    pwdInput.addEventListener("input", updateMeter);
  }
  if (editing?.key === "viabilityAnalyses") setupViabilityFormPreview();
}

// Validação em tempo real (no blur) dos campos do cadastro de usuários.
// Os inputs do formulário genérico usam name= (sem id); seleção via #formFields.
function setupUserFormValidation() {
  const fieldEl = (name) => qs("formFields").querySelector(`[name="${name}"]`);
  const rules = [
    ["fullName", (v) => validateNome(v), () => "", () => "Nome muito curto — mínimo 3 caracteres."],
    ["username", (v) => validateUsername(v), () => "Usuário válido ✓", () => "Use apenas letras minúsculas, números e ponto (3 a 30 caracteres)."],
    ["email", (v) => validateEmail(v), () => "E-mail válido ✓", () => "Formato de e-mail inválido."],
    ["cpf", (v) => validateCpf(onlyDigits(v)), () => "CPF válido ✓", () => "CPF inválido — verifique os dígitos."],
    ["data_nascimento", (v) => validateDataNascimento(v).ok, () => "Data válida ✓", (v) => validateDataNascimento(v).msg],
    ["celular", (v) => validateCelular(v), () => "Celular válido ✓", () => "Celular inválido — use (DDD) 9XXXX-XXXX."],
  ];
  rules.forEach(([name, check, okMsg, errorMsg]) => {
    const input = fieldEl(name);
    if (!input) return;
    input.addEventListener("blur", () => {
      if (!input.value.trim()) return setFieldState(input, null);
      const ok = check(input.value);
      setFieldState(input, ok, ok ? okMsg(input.value) : errorMsg(input.value));
    });
  });
}

// Confirmação ao alterar a própria senha: encerrar as outras sessões ou manter.
// Precisa ser um <dialog> com showModal(): o formulário de usuário já está
// aberto no top layer e um <div> overlay comum ficaria atrás dele.
function confirmPasswordChange() {
  return new Promise((resolve) => {
    document.getElementById("modalSenhaConfirm")?.remove();
    const modal = document.createElement("dialog");
    modal.id = "modalSenhaConfirm";
    modal.className = "pwd-confirm-dialog";
    modal.innerHTML = `
      <div class="modal-box">
        <h3>Alteração da sua senha</h3>
        <p>Você está alterando a sua própria senha. Deseja encerrar as outras sessões ativas
        (outros navegadores e dispositivos) ou permanecer conectado normalmente?</p>
        <menu>
          <button type="button" class="secondary" data-choice="cancel">Cancelar</button>
          <button type="button" class="secondary" data-choice="manter">🔒 Manter conectado</button>
          <button type="button" class="primary pwd-confirm-logout" data-choice="logout">🚪 Deslogar e redirecionar</button>
        </menu>
      </div>`;
    document.body.appendChild(modal);
    modal.showModal();
    requestAnimationFrame(() => modal.classList.add("visible"));
    let settled = false;
    const close = (result) => {
      if (settled) return;
      settled = true;
      modal.classList.remove("visible");
      setTimeout(() => { try { modal.close(); } catch { /* já fechado */ } modal.remove(); }, 280);
      resolve(result);
    };
    modal.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        const choice = button.dataset.choice;
        close(choice === "cancel" ? null : choice);
      });
    });
    // Esc e clique no backdrop equivalem a cancelar.
    modal.addEventListener("cancel", (event) => { event.preventDefault(); close(null); });
    modal.addEventListener("click", (event) => { if (event.target === modal) close(null); });
  });
}

async function saveForm(event) {
  event.preventDefault();
  if (!canEditModule(editing.key)) return;
  const validation = validateCurrentForm(event.target);
  if (!validation.ok) return alert(validation.message);
  const data = formDataToRecord(event.target, editing.key);
  let selfPasswordChanged = false;
  if (editing.key === "workBudgetItems") normalizeWorkBudgetItem(data);
  if (editing.key === "workBudgets") normalizeWorkBudget(data);
  if (editing.key === "quotes") normalizeQuote(data);
  if (editing.key === "ownCompositions") normalizeOwnComposition(data);
  if (editing.key === "agendaEvents") normalizeAgendaEvent(data);
  if (editing.key === "kanbanCards") normalizeKanbanCard(data);
  if (editing.key === "viabilityAnalyses") {
    const viabilityError = normalizeViabilityAnalysis(data);
    if (viabilityError) return alert(viabilityError);
  }
  if (editing.key === "plugins") {
    const url = String(data.url || "").trim();
    if (!isValidPluginUrl(url)) return alert("Informe uma URL válida: https://... ou caminho interno iniciando com / ou ./");
    data.url = url;
    data.sortOrder = Number(data.sortOrder || 0) || (sortedPlugins().length + (editing.id ? 0 : 1));
  }
  if (["budgets", "proposals", "workBudgets"].includes(editing.key)) {
    if (!data.createdByUserId) data.createdByUserId = currentUser.id;
    if (!data.commercialUserId && currentUser.role === "comercial") data.commercialUserId = currentUser.id;
  }
  if (editing.key === "projectTrackingLinks") {
    if (!data.token) data.token = `obra-${data.projectId || "link"}-${Date.now()}`;
    if (!data.url) data.url = "https://schimanskiengenharia.com.br/financeiro";
  }
  // Item 10: sanitizar campos de texto antes de salvar
  (configs[editing.key]?.fields || []).filter(([, , t]) => ["text", "email", "textarea"].includes(t)).forEach(([f]) => { if (data[f]) data[f] = sanitizeInput(data[f]); });
  if (editing.key === "users") {
    // Bloqueia o save se houver campo inválido (mesmas regras da validação de blur).
    const nascimento = validateDataNascimento(data.data_nascimento || "");
    const userChecks = [
      [validateNome(data.fullName), "Nome inválido — mínimo 3 caracteres."],
      [validateUsername(data.username), "Nome de usuário inválido — use apenas letras minúsculas, números e ponto (3 a 30 caracteres)."],
      [validateEmail(data.email), "E-mail inválido."],
      [validateCpf(onlyDigits(data.cpf)), "CPF inválido — verifique os dígitos."],
      [nascimento.ok, nascimento.msg || "Data de nascimento inválida."],
      [validateCelular(data.celular), "Celular inválido — use (DDD) 9XXXX-XXXX."],
    ];
    const firstError = userChecks.find(([ok]) => !ok);
    if (firstError) return alert(firstError[1]);
    const cpfDigits = onlyDigits(data.cpf);
    if (db.users.some((user) => onlyDigits(user.cpf || "") === cpfDigits && !sameId(user.id, editing.id))) {
      return alert("CPF já cadastrado para outro usuário.");
    }
    // Banco recebe apenas dígitos (cpf/celular) e data ISO (AAAA-MM-DD).
    data.cpf = cpfDigits;
    data.celular = onlyDigits(data.celular);
    data.data_nascimento = dataBrToIso(data.data_nascimento);
    if (data.password) {
      const pwdCheck = validatePassword(data.password);
      if (!pwdCheck.valid) return alert("Senha não atende aos critérios:\n• " + pwdCheck.errors.join("\n• "));
    }
    // sameId em todas as comparações: o id do banco é numérico e o editing.id
    // vem do dataset do botão (string) — !== estrito nunca excluía o próprio
    // registro e o usuário "colidia" consigo mesmo ("já existe um usuário...").
    const duplicate = db.users.some((user) => user.username.toLowerCase() === String(data.username || "").toLowerCase() && !sameId(user.id, editing.id));
    if (duplicate) return alert("Já existe um usuário com esse login.");
    if (sameId(editing.id, currentUser.id) && data.role !== "admin") return alert("O administrador logado não pode remover o próprio perfil de administrador.");
    const usersAfterSave = db.users.map((user) => sameId(user.id, editing.id) ? { ...user, ...data } : user);
    if (!usersAfterSave.some((user) => user.role === "admin" && user.status === "Ativo")) {
      return alert("Mantenha ao menos um administrador ativo no sistema.");
    }
    // Troca da própria senha: pergunta se as outras sessões devem ser encerradas.
    if (sameId(editing.id, currentUser.id) && data.password) {
      const choice = await confirmPasswordChange();
      if (choice === null) return; // cancelou: não salva nada
      selfPasswordChanged = true;
      if (choice === "logout") data.logoutOtherSessions = true;
    }
  }
  const previousRecord = editing.id ? byId(editing.key, editing.id) : null;
  try {
    if (serverMode && editing.key === "fiscalDocuments") {
      const formPayload = new FormData(event.target);
      Object.entries(data).forEach(([key, value]) => formPayload.set(key, value ?? ""));
      if (editing.id) formPayload.set("_method", "PUT");
      const result = await fetchForm(`${apiResources[editing.key]}${editing.id ? `/${editing.id}` : ""}`, formPayload);
      if (editing.id) db[editing.key] = db[editing.key].map((row) => String(row.id) === String(editing.id) ? result.record : row);
      else db[editing.key].push(result.record);
    } else if (serverMode && apiResources[editing.key]) {
      const endpoint = apiResources[editing.key];
      const payload = await apiRequest(editing.id ? `${endpoint}/${editing.id}` : endpoint, {
        method: editing.id ? "PUT" : "POST",
        body: JSON.stringify(data),
      });
      if (editing.id) {
        db[editing.key] = db[editing.key].map((row) => String(row.id) === String(editing.id) ? payload.record : row);
      } else {
        db[editing.key].push(payload.record);
      }
    } else if (editing.id) {
      db[editing.key] = db[editing.key].map((row) => String(row.id) === String(editing.id) ? { ...row, ...data } : row);
      saveDb();
    } else {
      db[editing.key].push({ id: crypto.randomUUID(), ...data });
      saveDb();
    }
  } catch (error) {
    alert(`Não foi possível salvar: ${error.message}`);
    return;
  }
  if (editing.key === "workBudgetItems" && data.workBudgetId) {
    await syncWorkBudgetTotals(data.workBudgetId);
  }
  if (editing.key === "proposals" && previousRecord && previousRecord.status !== data.status) {
    await createIntegratedRecord("proposalStatusHistory", {
      proposalId: editing.id,
      date: new Date().toISOString().slice(0, 10),
      userId: currentUser?.id || "",
      previousStatus: previousRecord.status || "",
      newStatus: data.status || "",
      notes: "Status alterado pelo cadastro de proposta.",
    }).catch(() => {});
  }
  if (!serverMode && editing.key === "projects" && !editing.id) {
    const project = db.projects.at(-1);
    ensureLocalProjectBoard(project);
    saveDb();
  }
  if (!serverMode && editing.key === "purchaseOrders" && !editing.id) {
    await createLocalPurchaseKanbanCard(db.purchaseOrders.at(-1)).catch(() => {});
  }
  if (!serverMode && editing.key === "projectMilestones" && data.status === "Concluído" && previousRecord?.status !== data.status) {
    await createLocalMilestoneBillingEvent(editing.id).catch(() => {});
  }
  const savedName = data.name || data.titulo || data.username || data.number || editing.id || "";
  logAudit(editing.id ? "edit" : "create", editing.key, String(savedName));
  if (editing.key === "users" && data.logoutOtherSessions) {
    // API já derrubou as demais sessões; encerra também a local e volta ao login.
    qs("recordDialog").close();
    logAudit("logout", "sistema", `Logout: ${currentUser?.username}`);
    if (serverMode && authToken) apiRequest("logout", { method: "POST" }).catch(() => {});
    clearAuthSession();
    clearTimeout(sessionWarnTimer);
    clearInterval(sessionWarnIntervalId);
    currentModuleTracked = "";
    showLogin("Senha alterada com sucesso! Faça login com a nova senha.");
    return;
  }
  const savedKey = editing.key;
  qs("recordDialog").close();
  await refreshAfterMutation(savedKey);
  if (savedKey === "users" && selfPasswordChanged) showToast("Senha atualizada com sucesso!");
}

function validateCurrentForm(form) {
  const isClientOrSupplier = ["clients", "suppliers"].includes(editing?.key);
  const email = form.querySelector('[name="email"]');
  if (isClientOrSupplier && !email?.value?.trim()) {
    return { ok: false, message: "E-mail é obrigatório para clientes e fornecedores." };
  }
  if (email?.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    return { ok: false, message: "Informe um e-mail válido, por exemplo joao@gmail.com." };
  }
  const shouldValidateDocument = ["clients", "suppliers", "companySettings"].includes(editing?.key);
  const documentInput = shouldValidateDocument ? form.querySelector('[name="document"]') : null;
  if (documentInput?.value) {
    const digits = onlyDigits(documentInput.value);
    if (digits.length !== 11 && digits.length !== 14) {
      return { ok: false, message: "Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos." };
    }
    if (digits.length === 11 && !validateCpf(digits)) return { ok: false, message: "CPF inválido. Confira os dígitos informados." };
    if (digits.length === 14 && !validateCnpj(digits)) return { ok: false, message: "CNPJ inválido. Confira os dígitos informados." };
  }
  const phone = form.querySelector('[name="phone"]');
  if (isClientOrSupplier && !phone?.value?.trim()) {
    return { ok: false, message: "Celular é obrigatório para clientes e fornecedores. Formato: (67) 99999-9999." };
  }
  if (phone?.value) {
    const digits = onlyDigits(phone.value);
    if (![10, 11].includes(digits.length)) return { ok: false, message: "Informe um celular válido, como (67) 99999-9999 ou (67) 3333-3333." };
  }
  return { ok: true };
}

function formDataToRecord(form, key) {
  const data = Object.fromEntries(new FormData(form).entries());
  configs[key].fields.forEach(([field, , type]) => {
    if (type?.startsWith?.("file")) delete data[field];
    if (isMoneyField(field) || type === "money") data[field] = parseMoneyInput(data[field]);
    else if (isPercentField(field)) data[field] = parsePercentInput(data[field]);
    else if (type === "number") data[field] = Number(data[field] || 0);
  });
  return data;
}

function normalizeWorkBudgetItem(data) {
  data.quantity = Number(data.quantity || 0);
  data.unitCost = Number(data.unitCost || 0);
  data.bdiPercent = Number(data.bdiPercent || 0);
  data.totalCost = data.totalCost ? Number(data.totalCost) : roundMoney(data.quantity * data.unitCost);
  data.unitPrice = data.unitPrice ? Number(data.unitPrice) : roundMoney(data.unitCost * (1 + data.bdiPercent / 100));
  data.totalPrice = data.totalPrice ? Number(data.totalPrice) : roundMoney(data.quantity * data.unitPrice);
  if (!data.projectId && data.workBudgetId) data.projectId = byId("workBudgets", data.workBudgetId)?.projectId || "";
}

function normalizeWorkBudget(data) {
  const rows = (db.workBudgetItems || []).filter((row) => sameId(row.workBudgetId, data.id || editing?.id));
  const directCost = rows.reduce((total, row) => total + Number(row.totalCost || 0), 0);
  const totalPrice = rows.reduce((total, row) => total + Number(row.totalPrice || 0), 0);
  const discount = Number(data.discountPercent || 0);
  if (directCost) data.directCost = roundMoney(directCost);
  if (directCost) data.totalCost = roundMoney(directCost * (1 + Number(data.chargesPercent || 0) / 100));
  if (totalPrice) data.totalPrice = roundMoney(totalPrice * (1 - discount / 100));
  if (!data.version) data.version = "v1";
}

function normalizeQuote(data) {
  data.quantity = Number(data.quantity || 0);
  data.unitValue = Number(data.unitValue || 0);
  data.totalValue = data.totalValue ? Number(data.totalValue) : roundMoney(data.quantity * data.unitValue);
}

function normalizeOwnComposition(data) {
  const cost = Number(data.laborCost || 0) + Number(data.materialCost || 0) + Number(data.equipmentCost || 0) + Number(data.thirdPartyCost || 0);
  if (cost && !Number(data.estimatedCost || 0)) data.estimatedCost = roundMoney(cost);
  if (cost && !Number(data.suggestedPrice || 0)) data.suggestedPrice = roundMoney(cost * (1 + Number(data.marginPercent || 0) / 100));
}

function normalizeAgendaEvent(data) {
  data.data_inicio = String(data.data_inicio || "").replace("T", " ");
  data.data_fim = data.data_fim ? String(data.data_fim).replace("T", " ") : "";
  data.dia_todo = Number(data.dia_todo || 0);
  data.lembrete_minutos = Number(data.lembrete_minutos || 60);
  if (!data.status) data.status = "agendado";
}

function normalizeKanbanCard(data) {
  data.ordem = Number(data.ordem || Date.now());
  if (!data.prioridade) data.prioridade = "media";
  if (!data.obra_id && selectedKanbanBoardId) data.obra_id = byId("kanbanBoards", selectedKanbanBoardId)?.obra_id || "";
}

async function createLocalPurchaseKanbanCard(order) {
  if (!order) return;
  const project = byId("projects", order.projectId);
  const board = project ? ensureLocalProjectBoard(project) : (db.kanbanBoards || [])[0];
  const column = (db.kanbanColumns || []).filter((row) => sameId(row.board_id, board?.id)).sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))[0];
  if (!column) return;
  db.kanbanCards.push({
    id: crypto.randomUUID(),
    coluna_id: column.id,
    obra_id: order.projectId || "",
    titulo: `Pedido ${order.number || ""}`.trim(),
    descricao: order.notes || "Card criado automaticamente a partir do pedido de compra.",
    responsavel_id: "",
    data_vencimento: order.expectedDate || "",
    prioridade: "media",
    referencia_tipo: "PEDIDO_COMPRA",
    referencia_id: order.id,
    ordem: Date.now(),
  });
  saveDb();
}

async function createLocalMilestoneBillingEvent(milestoneId) {
  const milestone = byId("projectMilestones", milestoneId);
  if (!milestone) return;
  const project = byId("projects", milestone.projectId);
  const date = milestone.completedDate || milestone.plannedDate || localDateString(new Date());
  db.agendaEvents.push({
    id: crypto.randomUUID(),
    obra_id: milestone.projectId || "",
    cliente_id: project?.clientId || "",
    usuario_id: currentUser?.id || "",
    titulo: `Cobrança: ${milestone.name}`,
    descricao: `MARCO-${milestone.id} - Evento automático de cobrança criado ao aprovar marco.`,
    tipo: "cobranca",
    data_inicio: `${date} 09:00`,
    data_fim: `${date} 10:00`,
    dia_todo: 0,
    lembrete_minutos: 1440,
    status: "agendado",
  });
  db.projectNotifications.push({
    id: crypto.randomUUID(),
    projectId: milestone.projectId,
    milestoneId: milestone.id,
    recipient: "Equipe interna",
    phone: "",
    type: "WhatsApp manual",
    message: `Evento de agenda hoje: Cobrança ${milestone.name}`,
    generatedLink: `agenda-evento-${milestone.id}`,
    status: "Preparado",
    responsibleUserId: currentUser?.id || "",
  });
  saveDb();
}

async function syncWorkBudgetTotals(workBudgetId) {
  const budget = byId("workBudgets", workBudgetId);
  if (!budget) return;
  const enriched = enrichWorkBudget(budget);
  await updateIntegratedRecord("workBudgets", budget.id, {
    ...budget,
    directCost: enriched.directCost,
    totalCost: enriched.totalCost,
    totalPrice: enriched.totalPrice,
  });
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function removeRecord(key, id) {
  if (!canEditModule(key)) return;
  if (!canDeleteRecord(key)) return alert("Seu perfil não tem permissão para excluir registros.");
  const removed = byId(key, id);
  if (key === "users" && sameId(id, currentUser.id)) return alert("O administrador logado não pode excluir o próprio usuário.");
  if (key === "users" && byId("users", id)?.role === "admin" && db.users.filter((user) => user.role === "admin").length === 1) {
    return alert("Mantenha ao menos um administrador ativo no sistema.");
  }
  const recordName = removed?.name || removed?.titulo || removed?.username || removed?.number || removed?.description || id;
  if (!await confirmDestructive(String(recordName))) return;
  try {
    if (serverMode && apiResources[key]) {
      await apiRequest(`${apiResources[key]}/${id}`, { method: "DELETE" });
    }
    db[key] = db[key].filter((row) => String(row.id) !== String(id));
    saveDb();
    logAudit("delete", key, String(recordName));
    if (key === "workBudgetItems" && removed?.workBudgetId) {
      await syncWorkBudgetTotals(removed.workBudgetId);
    }
  } catch (error) {
    alert(`Não foi possível excluir: ${error.message}`);
    return;
  }
  // Exclusões não disparam automação no servidor e o db local já foi filtrado:
  // re-renderizar basta, sem refazer o bootstrap inteiro.
  render();
}

async function createIntegratedRecord(key, data) {
  if (serverMode && apiResources[key]) {
    const payload = await apiRequest(apiResources[key], { method: "POST", body: JSON.stringify(data) });
    db[key].push(payload.record);
    return payload.record;
  }
  const record = { id: crypto.randomUUID(), ...data };
  db[key].push(record);
  saveDb();
  return record;
}

async function updateIntegratedRecord(key, id, data) {
  if (serverMode && apiResources[key]) {
    const payload = await apiRequest(`${apiResources[key]}/${id}`, { method: "PUT", body: JSON.stringify(data) });
    db[key] = db[key].map((row) => sameId(row.id, id) ? payload.record : row);
    return payload.record;
  }
  db[key] = db[key].map((row) => sameId(row.id, id) ? { ...row, ...data } : row);
  saveDb();
  return byId(key, id);
}

async function convertProposalToSale(id) {
  const proposal = byId("proposals", id);
  if (!proposal) return;
  if (!confirm("Converter esta proposta aprovada em venda/contrato?")) return;
  const today = new Date().toISOString().slice(0, 10);
  const number = `VEN-${today.replaceAll("-", "")}-${String(Date.now()).slice(-4)}`;
  try {
    await createIntegratedRecord("sales", {
      number,
      date: today,
      competenceDate: today,
      clientId: proposal.clientId || "",
      projectId: proposal.projectId || "",
      proposalId: proposal.id,
      costCenterId: "",
      description: proposal.description || `Venda gerada da proposta ${proposal.number || proposal.id}`,
      amount: Number(proposal.amount || 0),
      cost: 0,
      status: "Aprovado",
    });
    await updateIntegratedRecord("proposals", proposal.id, { ...proposal, status: "Convertida" });
    alert("Proposta convertida em venda/contrato.");
    await refreshAndRender();
  } catch (error) {
    alert(`Não foi possível converter a proposta: ${error.message}`);
  }
}

async function createReceivableFromSale(id) {
  const sale = byId("sales", id);
  if (!sale) return;
  if (!confirm("Gerar conta a receber para esta venda/contrato?")) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    await createIntegratedRecord("receivable", {
      document: sale.number || `REC-${String(Date.now()).slice(-6)}`,
      issueDate: today,
      dueDate: today,
      receivedDate: "",
      clientId: sale.clientId || "",
      projectId: sale.projectId || "",
      proposalId: sale.proposalId || "",
      categoryId: "",
      costCenterId: sale.costCenterId || "",
      bankAccount: "",
      amount: Number(sale.amount || 0),
      status: "Aberto",
    });
    alert("Conta a receber gerada.");
    await refreshAndRender();
  } catch (error) {
    alert(`Não foi possível gerar a conta a receber: ${error.message}`);
  }
}

async function createReceivablesFromProposal(id) {
  const proposal = byId("proposals", id);
  if (!proposal) return;
  if (proposal.status !== "Aprovada") return alert("Apenas propostas aprovadas podem gerar contas a receber.");
  if (!confirm("Gerar contas a receber a partir desta proposta aprovada?")) return;
  const today = new Date().toISOString().slice(0, 10);
  const terms = proposal.paymentCondition || proposal.paymentTerms || "";
  const percentages = [...String(terms).matchAll(/(\d+(?:[,.]\d+)?)\s*%/g)].map((match) => Number(match[1].replace(",", "."))).filter((value) => value > 0);
  const total = Number(proposal.amount || 0);
  const parcels = percentages.length ? percentages.map((percent, index) => ({
    label: `${formatPercentInput(percent)} - parcela ${index + 1}`,
    amount: roundMoney(total * (percent / 100)),
    dueDate: addDateStringDays(today, index * 30),
  })) : [{ label: "Valor total da proposta", amount: total, dueDate: today }];
  try {
    for (const [index, parcel] of parcels.entries()) {
      await createIntegratedRecord("receivable", {
        document: `${proposal.number || `PROP-${proposal.id}`}-${index + 1}`,
        issueDate: today,
        dueDate: parcel.dueDate,
        receivedDate: "",
        clientId: proposal.clientId || "",
        projectId: proposal.projectId || "",
        proposalId: proposal.id,
        categoryId: "",
        costCenterId: "",
        bankAccount: "",
        amount: parcel.amount,
        status: "Aberto",
      });
    }
    alert(`${parcels.length} conta(s) a receber gerada(s).`);
    await refreshAndRender();
  } catch (error) {
    alert(`Não foi possível gerar as contas a receber: ${error.message}`);
  }
}

function currentScheduleProject() {
  const filterProject = getFilters().projectId;
  return byId("projects", filterProject) || byId("projects", dashboardProjectId) || db.projects[0] || null;
}

function renderAgenda() {
  renderAgendaWeek();
}

function renderKanban() {
  ensureLocalDefaultKanban();
  const editable = canEditModule("kanban");
  const boards = db.kanbanBoards || [];
  if (!selectedKanbanBoardId || !boards.some((board) => sameId(board.id, selectedKanbanBoardId))) selectedKanbanBoardId = boards[0]?.id || "";
  const board = boards.find((row) => sameId(row.id, selectedKanbanBoardId));
  const boardOptions = boards.map((row) => `<option value="${row.id}" ${sameId(row.id, selectedKanbanBoardId) ? "selected" : ""}>${row.nome}</option>`).join("");
  const columns = (db.kanbanColumns || []).filter((column) => sameId(column.board_id, selectedKanbanBoardId)).sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Kanban</h2>
        <p>Boards por obra, compras e tarefas gerais, com cards arrastáveis por coluna.</p>
      </div>
      ${editable ? '<button id="newKanbanCard" class="primary" type="button">Novo card</button>' : ""}
    </section>
    <section class="schedule-toolbar kanban-toolbar">
      <label>Board<select id="kanbanBoardSelect">${boardOptions}</select></label>
      <span>${board?.obra_id ? `Obra: ${nameOf("projects", board.obra_id)}` : "Sem obra vinculada"}</span>
    </section>
    <section class="kanban-board">
      ${columns.map((column) => kanbanColumnHtml(column, editable)).join("") || '<div class="empty">Nenhuma coluna neste board.</div>'}
    </section>
  `;
  qs("kanbanBoardSelect").addEventListener("change", (event) => { selectedKanbanBoardId = event.target.value; renderKanban(); });
  qs("newKanbanCard")?.addEventListener("click", () => openKanbanCardForm(columns[0]?.id || ""));
  qs("content").querySelectorAll("[data-kanban-card]").forEach((card) => {
    card.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", card.dataset.kanbanCard));
  });
  qs("content").querySelectorAll("[data-kanban-column]").forEach((column) => {
    column.addEventListener("dragover", (event) => event.preventDefault());
    column.addEventListener("drop", (event) => moveKanbanCard(event.dataTransfer.getData("text/plain"), column.dataset.kanbanColumn));
  });
  qs("content").querySelectorAll("[data-edit-card]").forEach((button) => button.addEventListener("click", () => openForm("kanbanCards", button.dataset.editCard)));
  qs("content").querySelectorAll("[data-delete-card]").forEach((button) => button.addEventListener("click", () => removeRecord("kanbanCards", button.dataset.deleteCard)));
}

function renderAgendaWeek() {
  try {
    const editable = canEditModule("agenda");
    const today = agendaStartOfDay(new Date());
    const cursor = agendaDateFromValue(agendaCursorDate, today);
    agendaCursorDate = agendaSafeDateString(cursor);
    const weekStart = agendaWeekStart(cursor);
    const weekEnd = addDays(weekStart, 6);
    const isPastWeek = weekEnd < today;
    const canCreateInWeek = editable && !isPastWeek;
    const events = agendaEventsSorted();
    const nowLabel = agendaFormatNowLabel(new Date());
    qs("content").innerHTML = `
      <section class="module-head">
        <div>
          <h2>Agenda</h2>
          <p class="agenda-now-label">${nowLabel}</p>
        </div>
      </section>
      <section class="schedule-toolbar agenda-toolbar">
        <button type="button" class="secondary" id="agendaPrev">‹ Semana anterior</button>
        <button type="button" class="secondary" id="agendaToday">Hoje</button>
        <button type="button" class="secondary" id="agendaNext">Próxima semana ›</button>
        <span class="agenda-week-range">${agendaWeekLabel(weekStart)}</span>
      </section>
      ${agendaKpiHtml()}
      ${isPastWeek ? '<p class="agenda-past-notice">Semana anterior — disponível apenas para consulta.</p>' : ""}
      <div class="agenda-layout">
        ${agendaCalendarHtml(weekStart, events)}
        ${agendaFormHtml(canCreateInWeek, weekStart)}
      </div>
    `;
    qs("agendaPrev")?.addEventListener("click", () => moveAgendaCursor(-1));
    qs("agendaToday")?.addEventListener("click", () => { agendaCursorDate = agendaSafeDateString(new Date()); renderAgenda(); });
    qs("agendaNext")?.addEventListener("click", () => moveAgendaCursor(1));
    qs("agendaEventForm")?.addEventListener("submit", saveAgendaEvent);
    qs("agendaCancelEdit")?.addEventListener("click", () => { agendaEditingId = ""; renderAgenda(); });
    qs("content").querySelectorAll("[data-agenda-edit]").forEach((button) =>
      button.addEventListener("click", () => editAgendaEvent(button.dataset.agendaEdit)));
    qs("content").querySelectorAll("[data-agenda-delete]").forEach((button) =>
      button.addEventListener("click", () => removeRecord("agendaEvents", button.dataset.agendaDelete)));
    // Reentra no modo edição após re-render (ex.: ao navegar entre semanas).
    if (agendaEditingId && byId("agendaEvents", agendaEditingId)) editAgendaEvent(agendaEditingId);
    else agendaEditingId = "";
  } catch (err) {
    qs("content").innerHTML = `<div class="empty" style="padding:32px;color:var(--red)">Erro ao renderizar a agenda: ${err.message}</div>`;
    console.error("renderAgendaWeek:", err);
  }
}

function agendaCalendarHtml(weekStart, events) {
  const todayKey = agendaSafeDateString(new Date());
  const days = agendaVisibleDays(weekStart);
  return `<section class="agenda-grid agenda-week">
    ${days.map((date) => {
      const key = agendaSafeDateString(date);
      if (!key) return "";
      const isToday = key === todayKey;
      const dayEvents = events.filter((event) => agendaEventDateKey(event) === key);
      return `<article class="agenda-day${isToday ? " today" : ""}">
        <header>
          <strong>${agendaDayName(date)}</strong>
          <span>${date.getDate()}</span>
        </header>
        <div class="agenda-day-events">
          ${dayEvents.length ? dayEvents.map(agendaEventCardHtml).join("") : '<p class="empty small">Sem compromissos.</p>'}
        </div>
      </article>`;
    }).join("")}
  </section>`;
}

function agendaVisibleDays(cursor) {
  const start = agendaWeekStart(cursor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function moveAgendaCursor(direction) {
  const date = agendaDateFromValue(agendaCursorDate, new Date());
  date.setDate(date.getDate() + direction * 7);
  agendaCursorDate = agendaSafeDateString(date, agendaSafeDateString(new Date()));
  renderAgenda();
}

function agendaFormHtml(enabled, weekStart) {
  const todayDate = agendaStartOfDay(new Date());
  const today = agendaSafeDateString(todayDate);
  const defaultDate = agendaSafeDateString(weekStart < todayDate ? todayDate : weekStart, today);
  const disabled = enabled ? "" : "disabled";
  return `
    <section class="agenda-form-card">
      <h3 id="agendaFormTitle">Novo compromisso</h3>
      <form id="agendaEventForm" class="agenda-event-form">
        <input type="hidden" name="id" value="">
        <label>Data<input type="date" name="date" value="${defaultDate}" min="${today}" required ${disabled}></label>
        <label>Horario inicial<input type="time" name="startTime" value="09:00" required ${disabled}></label>
        <label>Horario final<input type="time" name="endTime" value="10:00" required ${disabled}></label>
        <label>Titulo<input name="titulo" required ${disabled}></label>
        <label>Tipo<select name="tipo" required ${disabled}>${agendaTypeOptions()}</select></label>
        <label>Responsavel<select name="usuario_id" ${disabled}><option value="">Selecione</option>${agendaOptions("users")}</select></label>
        <label>Cliente<select name="cliente_id" ${disabled}><option value="">Selecione</option>${agendaOptions("clients")}</select></label>
        <label>Obra/projeto<select name="obra_id" ${disabled}><option value="">Selecione</option>${agendaOptions("projects")}</select></label>
        <label>Observacoes<textarea name="descricao" rows="3" ${disabled}></textarea></label>
        <label>Status<select name="status" required ${disabled}>
          <option value="agendado">Agendado</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select></label>
        <div class="agenda-form-actions">
          <span>${enabled ? "" : "Semana anterior — novos compromissos bloqueados; use ✎ para editar os existentes."}</span>
          <button type="button" class="secondary hidden" id="agendaCancelEdit">Cancelar edição</button>
          <button type="submit" class="primary" id="agendaSubmitBtn" ${disabled}>Salvar compromisso</button>
        </div>
      </form>
    </section>
  `;
}

function agendaTypeOptions() {
  return ["reuniao", "vistoria", "projeto", "obra", "financeiro", "comercial", "prazo", "outro"].map((type) => `<option value="${type}">${agendaTypeLabel(type)}</option>`).join("");
}

function agendaEventsSorted() {
  return (db.agendaEvents || []).filter(agendaEventHasValidDate).slice().sort((a, b) => agendaEventDateTimeSortKey(a).localeCompare(agendaEventDateTimeSortKey(b)));
}

function agendaOptions(collection) {
  // Só registros ativos: compromissos não devem apontar para cadastros desativados.
  const rows = (db[collection] || []).filter((row) => {
    if (collection === "projects") return row.status !== "Cancelada";
    if (collection === "users") return row.status === "Ativo" && !Number(row.blocked || 0);
    return row.status === undefined || row.status === "" || row.status === "Ativo";
  });
  return rows.map((row) => {
    const label = row.fullName || row.name || row.nome || row.titulo || row.username || String(row.id);
    return `<option value="${row.id}">${svgText(label)}</option>`;
  }).join("");
}

function agendaEventCardHtml(event) {
  const start = agendaTimeLabel(event.data_inicio);
  const end = agendaTimeLabel(event.data_fim);
  const statusClass = event.status ? `status-${event.status}` : "status-agendado";
  // Editar/excluir sempre disponíveis (inclusive para eventos em datas passadas);
  // apenas a CRIAÇÃO retroativa é bloqueada.
  const editable = canEditModule("agenda");
  return `
    <article class="agenda-event ${event.tipo || ""} ${statusClass}">
      <strong>${svgText(event.titulo || "Sem titulo")}</strong>
      <span>${start}${end ? ` - ${end}` : ""}</span>
      <small>${agendaTypeLabel(event.tipo)}${event.usuario_id ? ` - ${nameOf("users", event.usuario_id)}` : ""}</small>
      ${event.cliente_id || event.obra_id ? `<small>${[nameOf("clients", event.cliente_id), nameOf("projects", event.obra_id)].filter(Boolean).join(" - ")}</small>` : ""}
      ${event.status ? `<em class="agenda-status-label">${svgText(agendaStatusLabel(event.status))}</em>` : ""}
      ${editable ? `<div class="agenda-event-actions">
        <button type="button" class="agenda-icon-btn" data-agenda-edit="${escapeHtml(event.id)}" title="Editar compromisso" aria-label="Editar">✎</button>
        <button type="button" class="agenda-icon-btn danger" data-agenda-delete="${escapeHtml(event.id)}" title="Excluir compromisso" aria-label="Excluir">🗑</button>
      </div>` : ""}
    </article>
  `;
}

function agendaStatusLabel(status) {
  return { agendado: "Agendado", em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" }[status] || status;
}

function agendaKpiHtml() {
  const events = (db.agendaEvents || []).filter(agendaEventHasValidDate);
  const todayKey = agendaSafeDateString(new Date());
  const hoje = events.filter((e) => agendaEventDateKey(e) === todayKey).length;
  const emAberto = events.filter((e) => e.status !== "concluido" && e.status !== "cancelado").length;
  const proximoEvent = events
    .filter((e) => agendaEventDateKey(e) >= todayKey && e.status !== "concluido" && e.status !== "cancelado")
    .sort((a, b) => agendaEventDateTimeSortKey(a).localeCompare(agendaEventDateTimeSortKey(b)))[0];
  const proximo = proximoEvent
    ? `${agendaFormatDate(agendaEventDateKey(proximoEvent))} — ${svgText(proximoEvent.titulo || "")}`
    : "—";
  return `
    <section class="agenda-kpis">
      <div class="agenda-kpi"><strong>${events.length}</strong><span>Total</span></div>
      <div class="agenda-kpi"><strong>${hoje}</strong><span>Hoje</span></div>
      <div class="agenda-kpi"><strong>${emAberto}</strong><span>Em aberto</span></div>
      <div class="agenda-kpi agenda-kpi-next"><strong>${proximo}</strong><span>Próximo compromisso</span></div>
    </section>
  `;
}

async function saveAgendaEvent(event) {
  event.preventDefault();
  if (!canEditModule("agenda")) return;
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const isEditing = Boolean(data.id);
  const today = agendaSafeDateString(new Date());
  const eventDate = agendaSafeDateString(data.date, "");
  if (!eventDate) return alert("Data invalida.");
  // Apenas bloqueia data passada em NOVOS compromissos; a edição de registros
  // existentes (inclusive em datas passadas) é permitida.
  if (!isEditing && eventDate < today) return alert("Nao e permitido cadastrar compromisso em data anterior ao dia atual.");
  if (data.endTime && data.startTime && data.endTime <= data.startTime) return alert("O horario final deve ser maior que o horario inicial.");
  const record = {
    obra_id: data.obra_id || "",
    cliente_id: data.cliente_id || "",
    usuario_id: data.usuario_id || "",
    titulo: data.titulo || "",
    descricao: data.descricao || "",
    tipo: data.tipo || "outro",
    data_inicio: `${eventDate} ${data.startTime}`,
    data_fim: `${eventDate} ${data.endTime}`,
    dia_todo: 0,
    lembrete_minutos: 60,
    status: data.status || "agendado",
  };
  try {
    if (isEditing) await updateIntegratedRecord("agendaEvents", data.id, record);
    else await createIntegratedRecord("agendaEvents", record);
  } catch (error) {
    alert(`Nao foi possivel salvar o compromisso: ${error.message}`);
    return;
  }
  agendaEditingId = "";
  agendaCursorDate = eventDate;
  await refreshAndRender();
}

// Preenche o formulário da agenda com um compromisso existente para edição.
// Habilita os campos mesmo em semanas passadas (a trava vale só para criação)
// e remove o min da data para permitir manter/ajustar datas anteriores.
function editAgendaEvent(id) {
  const eventRecord = byId("agendaEvents", id);
  const form = qs("agendaEventForm");
  if (!eventRecord || !form) return;
  agendaEditingId = String(id);
  form.querySelector('[name="id"]').value = eventRecord.id;
  const dateInput = form.querySelector('[name="date"]');
  dateInput.removeAttribute("min");
  dateInput.value = agendaEventDateKey(eventRecord) || agendaSafeDateString(new Date());
  form.querySelector('[name="startTime"]').value = agendaTimeLabel(eventRecord.data_inicio) || "09:00";
  form.querySelector('[name="endTime"]').value = agendaTimeLabel(eventRecord.data_fim) || "10:00";
  form.querySelector('[name="titulo"]').value = eventRecord.titulo || "";
  form.querySelector('[name="tipo"]').value = eventRecord.tipo || "outro";
  form.querySelector('[name="usuario_id"]').value = eventRecord.usuario_id || "";
  form.querySelector('[name="cliente_id"]').value = eventRecord.cliente_id || "";
  form.querySelector('[name="obra_id"]').value = eventRecord.obra_id || "";
  form.querySelector('[name="descricao"]').value = eventRecord.descricao || "";
  form.querySelector('[name="status"]').value = eventRecord.status || "agendado";
  form.querySelectorAll("input, select, textarea, button").forEach((el) => el.removeAttribute("disabled"));
  const title = qs("agendaFormTitle");
  if (title) title.textContent = "Editar compromisso";
  const submit = qs("agendaSubmitBtn");
  if (submit) submit.textContent = "Salvar alterações";
  qs("agendaCancelEdit")?.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function agendaWeekStart(date) {
  const start = agendaStartOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function agendaWeekLabel(weekStart) {
  return `${agendaFormatDate(weekStart)} a ${agendaFormatDate(addDays(weekStart, 6))}`;
}

function agendaDayName(date) {
  const safeDate = agendaDateFromValue(date);
  return safeDate ? ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][safeDate.getDay()] : "";
}

function agendaTimeLabel(value) {
  const text = String(value || "");
  if (!text) return "";
  if (!agendaDateFromValue(text)) return "Data inválida";
  // "2026-06-10T09:00" or "2026-06-10 09:00"
  const sep = text.indexOf("T") !== -1 ? "T" : " ";
  const timePart = text.split(sep)[1] || "";
  return timePart.slice(0, 5);
}

function openKanbanCardForm(columnId) {
  kanbanNewColumnId = columnId;
  openForm("kanbanCards");
}

function kanbanColumnHtml(column, editable) {
  const cards = (db.kanbanCards || []).filter((card) => sameId(card.coluna_id, column.id)).sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
  return `
    <div class="kanban-column" data-kanban-column="${column.id}">
      <header style="border-color:${svgText(column.cor || "#185FA5")}">
        <h3>${svgText(column.nome)}</h3>
        <span>${cards.length}${column.limite_cards ? `/${column.limite_cards}` : ""}</span>
      </header>
      <div class="kanban-card-list">
        ${cards.map((card) => kanbanCardHtml(card, editable)).join("") || '<div class="empty small">Sem cards</div>'}
      </div>
    </div>
  `;
}

function kanbanCardHtml(card, editable) {
  const overdue = card.data_vencimento && card.data_vencimento < localDateString(new Date()) && !kanbanCardDone(card);
  const priority = card.prioridade || "media";
  return `
    <article class="kanban-card priority-${priority} ${overdue ? "overdue" : ""}" draggable="${editable}" data-kanban-card="${card.id}">
      <strong>${svgText(card.titulo)}</strong>
      <p>${svgText(card.descricao || "")}</p>
      <footer>
        <span>${card.responsavel_id ? nameOf("users", card.responsavel_id) : "Sem responsável"}</span>
        <span>${card.data_vencimento ? asDate(card.data_vencimento) : "Sem prazo"}</span>
      </footer>
      <div class="kanban-card-actions">
        <span>${priorityLabel(priority)}</span>
        ${editable ? `<button type="button" data-edit-card="${card.id}">Editar</button><button type="button" data-delete-card="${card.id}">Excluir</button>` : ""}
      </div>
    </article>
  `;
}

async function moveKanbanCard(cardId, columnId) {
  if (!cardId || !columnId || !canEditModule("kanban")) return;
  const card = byId("kanbanCards", cardId);
  if (!card || sameId(card.coluna_id, columnId)) return;
  const targetColumn = (db.kanbanColumns || []).find((column) => sameId(column.id, columnId));
  await updateIntegratedRecord("kanbanCards", cardId, { coluna_id: columnId, ordem: Date.now() });
  if (targetColumn && normalizedText(targetColumn.nome) === normalizedText("Concluído") && card.referencia_tipo && confirm("Card movido para Concluído. Deseja atualizar o status do item vinculado?")) {
    alert("Atualização do item vinculado depende do tipo de referência e deve ser confirmada no módulo de origem.");
  }
  await refreshAndRender();
}

function ensureLocalDefaultKanban() {
  if (serverMode) return;
  if (!db.kanbanBoards?.length) {
    db.kanbanBoards = [{ id: "kb-geral", obra_id: "", nome: "Board geral", tipo: "geral" }];
  }
  db.projects.forEach((project) => ensureLocalProjectBoard(project));
  saveDb();
}

function ensureLocalProjectBoard(project) {
  if (!project) return null;
  let board = db.kanbanBoards.find((row) => sameId(row.obra_id, project.id) && row.tipo === "obra");
  if (!board) {
    board = { id: crypto.randomUUID(), obra_id: project.id, nome: `Kanban - ${project.name}`, tipo: "obra" };
    db.kanbanBoards.push(board);
  }
  ensureLocalKanbanColumns(board.id);
  return board;
}

function ensureLocalKanbanColumns(boardId) {
  const defaults = [
    ["A fazer", 10, "#185FA5"],
    ["Em andamento", 20, "#B8872D"],
    ["Aguardando aprovação", 30, "#7C3AED"],
    ["Concluído", 40, "#147A47"],
  ];
  defaults.forEach(([nome, ordem, cor]) => {
    if (!(db.kanbanColumns || []).some((column) => sameId(column.board_id, boardId) && column.nome === nome)) {
      db.kanbanColumns.push({ id: crypto.randomUUID(), board_id: boardId, nome, ordem, cor });
    }
  });
}

function kanbanCardDone(card) {
  const column = (db.kanbanColumns || []).find((row) => sameId(row.id, card.coluna_id));
  return normalizedText(column?.nome || "") === normalizedText("Concluído");
}

function agendaTypeLabel(type) {
  return ({
    reuniao: "Reunião", visita: "Visita", vistoria: "Vistoria", entrega: "Entrega",
    cobranca: "Cobrança", projeto: "Projeto", obra: "Obra",
    financeiro: "Financeiro", comercial: "Comercial", prazo: "Prazo", outro: "Outro",
  })[type] || type || "";
}

function priorityLabel(priority) {
  return ({ baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" })[priority] || priority || "";
}

function agendaViewLabel(mode) {
  return ({ month: "Mês", week: "Semana", day: "Dia" })[mode] || mode;
}

function agendaPeriodLabel(date) {
  const safeDate = agendaDateFromValue(date, new Date());
  if (agendaViewMode === "day") return agendaFormatDate(safeDate);
  if (agendaViewMode === "week") {
    const days = agendaVisibleDays(safeDate);
    return `${agendaFormatDate(days[0])} a ${agendaFormatDate(days.at(-1))}`;
  }
  return agendaFormatMonthYear(safeDate);
}

function agendaIsValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function agendaDateFromValue(value, fallback = null) {
  if (agendaIsValidDate(value)) return new Date(value.getTime());
  if (value === "" || value === null || value === undefined) return agendaIsValidDate(fallback) ? new Date(fallback.getTime()) : null;
  const parsed = typeof value === "string" ? parseLocalDate(value) : new Date(value);
  if (agendaIsValidDate(parsed)) return parsed;
  return agendaIsValidDate(fallback) ? new Date(fallback.getTime()) : null;
}

function agendaStartOfDay(value, fallback = new Date()) {
  const date = agendaDateFromValue(value, fallback) || new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function agendaSafeDateString(value, fallback = agendaSafeDateString(new Date(), "")) {
  const date = agendaDateFromValue(value);
  if (!date) return typeof fallback === "string" ? fallback : agendaSafeDateString(fallback, "");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function agendaFormatDate(value) {
  const key = agendaSafeDateString(value, "");
  return key ? asDate(key) : "Data inválida";
}

function agendaFormatMonthYear(value) {
  const date = agendaDateFromValue(value, new Date());
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function agendaFormatNowLabel(value) {
  const date = agendaDateFromValue(value, new Date());
  return date.toLocaleString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function agendaEventDateKey(event) {
  return agendaSafeDateString(event?.data_inicio, "");
}

function agendaEventHasValidDate(event) {
  return Boolean(agendaEventDateKey(event));
}

function agendaEventDateTimeSortKey(event) {
  const dateKey = agendaEventDateKey(event);
  if (!dateKey) return "";
  const time = agendaTimeLabel(event?.data_inicio);
  return `${dateKey} ${time && time !== "Data inválida" ? time : "00:00"}`;
}

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function parseLocalDateTime(value) {
  if (!value) return null;
  return new Date(String(value).replace(" ", "T"));
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderProjectSchedule() {
  const project = currentScheduleProject();
  const editable = canEditModule("projectSchedule");
  const rows = project ? scheduleRowsForProject(project.id) : [];
  const metrics = project ? scheduleMetrics(project.id, rows) : scheduleMetrics("");
  const tableFields = ["sortOrder", "stageName", "status", "plannedStartDate", "plannedEndDate", "actualStartDate", "actualEndDate", "plannedPhysicalPercent", "actualPhysicalPercent", "plannedFinancialAmount", "actualFinancialAmount", "workBudgetId", "workBudgetItemId", "durationDays", "predecessorIds", "responsible", "isMilestone"];
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Cronograma Físico-Financeiro</h2>
        <p>Etapas, marcos, avanço físico, avanço financeiro, previsto x realizado e atualização manual por WhatsApp.</p>
      </div>
      <div class="actions">
        ${editable ? '<button class="primary" type="button" id="newRecord">Nova etapa</button>' : ""}
        <button class="secondary" type="button" id="whatsappUpdateBtn" ${project ? "" : "disabled"}>Enviar atualização por WhatsApp</button>
        <button class="secondary" type="button" id="msProjectExportBtn" ${project && rows.length ? "" : "disabled"}>Exportar para MS Project</button>
        ${editable ? '<button class="secondary" type="button" id="msProjectImportBtn">Importar XML do MS Project</button><input id="msProjectImportFile" class="hidden" type="file" accept=".xml,text/xml,application/xml">' : ""}
        <button class="secondary" type="button" id="scheduleCsvBtn" ${rows.length ? "" : "disabled"}>Exportar Excel/CSV</button>
        <button class="secondary" type="button" id="schedulePrintBtn">Exportar PDF/impressão</button>
      </div>
    </section>
    <section class="schedule-toolbar">
      <label>
        Obra/Projeto
        <select id="scheduleProjectSelect">
          ${db.projects.map((row) => `<option value="${row.id}" ${project && sameId(row.id, project.id) ? "selected" : ""}>${svgText(row.name)}</option>`).join("")}
        </select>
      </label>
      <div class="schedule-next">
        <span>Próximo marco</span>
        <strong>${svgText(metrics.nextMilestone || "Sem marco previsto")}</strong>
      </div>
    </section>
    <section class="kpi-grid">
      ${kpi("Físico previsto", asPercent(metrics.plannedPhysical), false)}
      ${kpi("Físico realizado", asPercent(metrics.actualPhysical), false)}
      ${kpi("Financeiro previsto", metrics.plannedFinancial)}
      ${kpi("Financeiro realizado", metrics.actualFinancial)}
      ${kpi("Diferença previsto x realizado", metrics.difference)}
      ${kpi("Saldo financeiro da obra", metrics.balance)}
      ${kpi("Etapas concluídas", metrics.completedStages, false)}
      ${kpi("Etapas atrasadas", metrics.delayedStages, false)}
    </section>
    ${metrics.delayedStages ? `<section class="alerts"><div class="alert">Há ${metrics.delayedStages} etapa(s) atrasada(s), com atraso máximo de ${metrics.delayDays} dia(s).</div></section>` : ""}
    ${ganttChart(rows)}
    ${scheduleStepCards(rows)}
    ${table("Etapas do cronograma", rows, tableFields, editable)}
  `;
  qs("newRecord")?.addEventListener("click", () => openForm("projectSchedule"));
  qs("whatsappUpdateBtn")?.addEventListener("click", () => createWhatsappUpdate(project?.id));
  qs("msProjectExportBtn")?.addEventListener("click", () => exportMsProjectXml(project, rows));
  qs("msProjectImportBtn")?.addEventListener("click", () => qs("msProjectImportFile")?.click());
  qs("msProjectImportFile")?.addEventListener("change", (event) => importMsProjectXml(event.target.files[0], project?.id));
  qs("scheduleCsvBtn")?.addEventListener("click", () => exportRowsCsv(rows, `cronograma-${project?.name || "obra"}.csv`));
  qs("schedulePrintBtn")?.addEventListener("click", () => window.print());
  qs("scheduleProjectSelect")?.addEventListener("change", (event) => {
    qs("filterProject").value = event.target.value;
    render();
  });
  qs("content").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openForm("projectSchedule", button.dataset.edit)));
  qs("content").querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeRecord("projectSchedule", button.dataset.delete)));
}

function scheduleStepCards(rows) {
  if (!rows.length) return '<div class="empty">Sem dados para exibir</div>';
  return `
    <section class="schedule-cards">
      ${rows.map((row) => {
        const delay = row.plannedEndDate && !row.actualEndDate && row.plannedEndDate < new Date().toISOString().slice(0, 10) ? daysBetween(row.plannedEndDate, new Date().toISOString().slice(0, 10)) : 0;
        return `
          <article class="schedule-card">
            <header>
              <strong>${svgText(row.stageName || row.stage || "Etapa")}</strong>
              ${formatCell("status", row.status)}
            </header>
            <p>${svgText(row.description || row.notes || "")}</p>
            <div class="progress-line"><span style="width:${Math.min(100, Number(row.actualPhysicalPercent || row.physicalProgress || 0))}%"></span></div>
            <dl>
              <div><dt>Físico</dt><dd>${asPercent(row.actualPhysicalPercent || row.physicalProgress || 0)}</dd></div>
              <div><dt>Financeiro</dt><dd>${asMoney(row.actualFinancialAmount || 0)}</dd></div>
              <div><dt>Previsto</dt><dd>${asDate(row.plannedStartDate || row.startDate)} até ${asDate(row.plannedEndDate || row.endForecast)}</dd></div>
              <div><dt>Real</dt><dd>${asDate(row.actualStartDate)} até ${asDate(row.actualEndDate)}</dd></div>
              <div><dt>Responsável</dt><dd>${svgText(row.responsible || "Não informado")}</dd></div>
              ${delay ? `<div><dt>Atraso</dt><dd>${delay} dia(s)</dd></div>` : ""}
            </dl>
          </article>
        `;
      }).join("")}
    </section>
  `;
}

function ganttChart(rows) {
  const datedRows = rows.filter((row) => row.plannedStartDate || row.plannedEndDate || row.actualStartDate || row.actualEndDate);
  if (!datedRows.length) return '<div class="empty">Sem dados para exibir</div>';
  const dates = datedRows.flatMap((row) => [row.plannedStartDate, row.plannedEndDate, row.actualStartDate, row.actualEndDate]).filter(Boolean).sort();
  const minDate = dates[0];
  const maxDate = dates.at(-1);
  const totalDays = Math.max(1, daysBetween(minDate, maxDate) + 1);
  const today = new Date().toISOString().slice(0, 10);
  const todayOffset = today >= minDate && today <= maxDate ? Math.min(100, Math.max(0, (daysBetween(minDate, today) / totalDays) * 100)) : null;
  const bar = (start, end, cls, title) => {
    if (!start || !end) return "";
    const left = Math.max(0, (daysBetween(minDate, start) / totalDays) * 100);
    const width = Math.max(2, ((daysBetween(start, end) + 1) / totalDays) * 100);
    return `<span class="${cls}" style="left:${left}%; width:${Math.min(100 - left, width)}%"><i>${svgText(title)}</i></span>`;
  };
  return `
    <section class="gantt-panel">
      <header>
        <h3>Gantt simplificado</h3>
        <p>Previsto x realizado, linha da data atual e marcos importantes.</p>
      </header>
      <div class="gantt-scroll">
        <div class="gantt-grid">
          ${datedRows.map((row) => {
            const delay = row.plannedEndDate && !row.actualEndDate && row.plannedEndDate < today ? daysBetween(row.plannedEndDate, today) : 0;
            return `
              <div class="gantt-label">
                <strong>${svgText(row.stageName || row.stage || "Etapa")}</strong>
                <small>${svgText(row.responsible || "")} ${delay ? `• ${delay} dia(s) de atraso` : ""}</small>
              </div>
              <div class="gantt-track">
                ${todayOffset === null ? "" : `<span class="today-line" style="left:${todayOffset}%"></span>`}
                ${bar(row.plannedStartDate || row.startDate, row.plannedEndDate || row.endForecast, "planned-bar", "Previsto")}
                ${bar(row.actualStartDate, row.actualEndDate || today, "actual-bar", "Realizado")}
                ${row.isMilestone === "Sim" ? `<b class="milestone-dot" title="${svgText(row.milestoneName || row.stageName || "")}"></b>` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </section>
  `;
}

function exportMsProjectXml(project, rows) {
  if (!project || !rows.length) return alert("Selecione uma obra com etapas para exportar.");
  const sorted = [...rows].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const uidById = Object.fromEntries(sorted.map((row, index) => [row.id, index + 1]));
  const tasks = sorted.map((row, index) => {
    const uid = index + 1;
    const start = row.plannedStartDate || row.actualStartDate || new Date().toISOString().slice(0, 10);
    const finish = row.plannedEndDate || row.actualEndDate || start;
    const durationDays = Number(row.durationDays || 0) || Math.max(1, daysBetween(start, finish) + 1);
    const predecessors = String(row.predecessorIds || "")
      .split(/[,\s;]+/)
      .map((id) => uidById[id] || Number(id || 0))
      .filter(Boolean)
      .map((predecessorUid) => `<PredecessorLink><PredecessorUID>${predecessorUid}</PredecessorUID><Type>1</Type></PredecessorLink>`)
      .join("");
    return `
      <Task>
        <UID>${uid}</UID>
        <ID>${uid}</ID>
        <Name>${escapeXml(row.stageName || `Etapa ${uid}`)}</Name>
        <Type>1</Type>
        <IsNull>0</IsNull>
        <CreateDate>${new Date().toISOString()}</CreateDate>
        <Start>${start}T08:00:00</Start>
        <Finish>${finish}T17:00:00</Finish>
        <Duration>PT${Math.max(8, durationDays * 8)}H0M0S</Duration>
        <DurationFormat>7</DurationFormat>
        <PercentComplete>${Math.round(Number(row.actualPhysicalPercent || 0))}</PercentComplete>
        <Milestone>${row.isMilestone === "Sim" ? 1 : 0}</Milestone>
        <Notes>${escapeXml(row.notes || row.description || "")}</Notes>
        <Cost>${Number(row.plannedFinancialAmount || 0)}</Cost>
        ${predecessors}
      </Task>`;
  }).join("");
  const resources = sorted
    .map((row) => row.responsible)
    .filter(Boolean)
    .filter((name, index, list) => list.indexOf(name) === index)
    .map((name, index) => `<Resource><UID>${index + 1}</UID><ID>${index + 1}</ID><Name>${escapeXml(name)}</Name><Type>1</Type></Resource>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${escapeXml(project.name || "ObraSync")}</Name>
  <Title>${escapeXml(project.name || "Cronograma ObraSync")}</Title>
  <Company>Schimanski Engenharia</Company>
  <CreationDate>${new Date().toISOString()}</CreationDate>
  <CalendarUID>1</CalendarUID>
  <Tasks>${tasks}
  </Tasks>
  <Resources>${resources}</Resources>
</Project>`;
  download(new Blob([xml], { type: "application/xml;charset=utf-8" }), `ms-project-${safeFilename(project.name || "obra")}.xml`);
}

async function importMsProjectXml(file, projectId) {
  if (!file) return;
  if (!projectId) return alert("Selecione uma obra/projeto para importar o XML.");
  try {
    const storedFile = await uploadRawFile("project-upload", file);
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML inválido.");
    const tasks = [...doc.getElementsByTagNameNS("*", "Task")]
      .map((task, index) => mapMsProjectTask(task, projectId, index + 1))
      .filter((task) => task.stageName && task.stageName !== "Resumo do Projeto");
    if (!tasks.length) return alert("Nenhuma tarefa válida encontrada no XML.");
    const preview = tasks.slice(0, 12).map((task) => `${task.sortOrder}. ${task.stageName} (${asDate(task.plannedStartDate)} - ${asDate(task.plannedEndDate)})`).join("\n");
    if (!confirm(`Pré-visualização da importação:\n\n${preview}\n\nConfirmar criação/atualização das etapas?`)) return;
    const existing = scheduleRowsForProject(projectId, false);
    let created = 0;
    let skipped = 0;
    for (const task of tasks) {
      const duplicate = existing.find((row) => normalizedText(row.stageName) === normalizedText(task.stageName));
      if (duplicate) {
        skipped++;
        continue;
      }
      await createIntegratedRecord("projectSchedule", task);
      created++;
    }
    alert(`Importação concluída: ${created} etapa(s) criada(s), ${skipped} ignorada(s) por possível duplicidade.${storedFile ? ` Arquivo salvo em ${storedFile}.` : ""}`);
    await refreshAndRender();
  } catch (error) {
    alert(`Não foi possível importar o XML do Microsoft Project: ${error.message}`);
  }
}

function mapMsProjectTask(task, projectId, sortOrder) {
  const text = (name) => [...task.children].find((child) => child.localName === name)?.textContent || "";
  const start = text("Start").slice(0, 10);
  const finish = text("Finish").slice(0, 10);
  const percent = Number(text("PercentComplete") || 0);
  const durationDays = parseMsProjectDurationDays(text("Duration")) || (start && finish ? daysBetween(start, finish) + 1 : 0);
  const predecessors = [...task.getElementsByTagNameNS("*", "PredecessorLink")]
    .map((link) => [...link.children].find((child) => child.localName === "PredecessorUID")?.textContent || "")
    .filter(Boolean)
    .join(",");
  return {
    projectId,
    stageName: text("Name"),
    description: text("Notes"),
    sortOrder,
    plannedStartDate: start,
    plannedEndDate: finish,
    actualStartDate: "",
    actualEndDate: percent >= 100 ? finish : "",
    plannedPhysicalPercent: percent,
    actualPhysicalPercent: percent,
    plannedFinancialAmount: Number(text("Cost") || 0),
    actualFinancialAmount: 0,
    workBudgetId: "",
    workBudgetItemId: "",
    predecessorIds: predecessors,
    durationDays,
    status: percent >= 100 ? "Concluída" : percent > 0 ? "Em andamento" : "Não iniciada",
    responsible: "",
    isMilestone: text("Milestone") === "1" ? "Sim" : "Não",
    milestoneName: text("Milestone") === "1" ? text("Name") : "",
    milestoneMessage: "",
    visibleToClient: "Não",
    notes: "Etapa importada de XML do Microsoft Project.",
  };
}

function parseMsProjectDurationDays(duration) {
  const hours = Number(duration.match(/PT(\d+)H/)?.[1] || 0);
  return hours ? Math.max(1, Math.round(hours / 8)) : 0;
}

function escapeXml(value) {
  return String(value ?? "").replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char]));
}

function safeFilename(value) {
  return normalizedText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "arquivo";
}

async function createWhatsappUpdate(projectId) {
  const project = byId("projects", projectId);
  if (!project) return alert("Selecione uma obra/projeto para gerar a atualização.");
  const client = byId("clients", project.clientId) || {};
  const metrics = scheduleMetrics(project.id, scheduleRowsForProject(project.id, false));
  const phone = whatsappPhone(client.phone || "");
  if (!phone) return alert("Cliente sem telefone válido para WhatsApp.");
  const popup = window.open("about:blank", "_blank", "noopener");
  const portalLink = trackingUrlForProject(project.id);
  const message = `Olá, ${client.name || "cliente"}.\n\nAtualização da obra: ${project.name}\n\nMarco concluído:\n✅ ${metrics.completedMilestone || "Cronograma atualizado"}\n\nPercentual físico executado: ${asPercent(metrics.actualPhysical)}\nPercentual financeiro executado: ${asPercent(metrics.financialExecution)}\n\nPróximo marco previsto:\n${metrics.nextMilestone || "Sem próximo marco cadastrado"}\n\nAcompanhe pelo link:\n${portalLink}\n\nSchimanski Engenharia`;
  const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  const notification = await saveProjectNotification({
    projectId: project.id,
    scheduleStepId: "",
    milestoneId: "",
    recipient: client.name || "Cliente",
    phone,
    type: "WhatsApp manual",
    message,
    generatedLink: link,
    status: "Preparado",
    responsibleUserId: currentUser?.id || "",
  });
  if (popup) popup.location.href = link;
  else window.open(link, "_blank", "noopener");
  if (notification && confirm("Marcar esta notificação como enviada manualmente?")) {
    await updateProjectNotification(notification.id, { ...notification, status: "Enviado manualmente" });
  }
  await refreshAndRender();
}

async function saveProjectNotification(data) {
  if (serverMode && apiResources.projectNotifications) {
    const payload = await apiRequest(apiResources.projectNotifications, { method: "POST", body: JSON.stringify(data) });
    db.projectNotifications.push(payload.record);
    return payload.record;
  }
  const record = { id: crypto.randomUUID(), ...data };
  db.projectNotifications.push(record);
  saveDb();
  return record;
}

async function updateProjectNotification(id, data) {
  if (serverMode && apiResources.projectNotifications) {
    const payload = await apiRequest(`${apiResources.projectNotifications}/${id}`, { method: "PUT", body: JSON.stringify(data) });
    db.projectNotifications = db.projectNotifications.map((row) => sameId(row.id, id) ? payload.record : row);
    return payload.record;
  }
  db.projectNotifications = db.projectNotifications.map((row) => sameId(row.id, id) ? { ...row, ...data } : row);
  saveDb();
  return byId("projectNotifications", id);
}

function trackingUrlForProject(projectId) {
  const link = (db.projectTrackingLinks || []).find((row) => sameId(row.projectId, projectId) && row.status === "Ativo");
  return link?.url || "https://schimanskiengenharia.com.br/financeiro";
}

function whatsappPhone(value) {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function renderWorkBudgets() {
  const editable = canEditModule("workBudgets");
  const rows = visibleRowsForModule("workBudgets", applyFilters(db.workBudgets || [])).map(enrichWorkBudget);
  if (!selectedWorkBudgetId || !rows.some((row) => sameId(row.id, selectedWorkBudgetId))) selectedWorkBudgetId = rows[0]?.id || "";
  const selected = rows.find((row) => sameId(row.id, selectedWorkBudgetId));
  const proposalAllowed = selected && canGenerateProposalForBudget(selected);
  const items = selected ? budgetItemsFor(selected.id) : [];
  const abc = abcRows(items);
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Orçamentos de Obras</h2>
        <p>Monte orçamentos por obra com itens SINAPI, composições próprias, cotações, BDI, totais e integração com proposta e cronograma.</p>
      </div>
      <div class="actions">
        ${editable ? '<button class="primary" type="button" id="newRecord">Novo orçamento</button><button class="secondary" type="button" id="newBudgetItem">Novo item</button>' : ""}
        <button class="secondary" type="button" id="createProposalFromBudget" ${proposalAllowed ? "" : "disabled"}>Gerar Proposta</button>
        <button class="secondary" type="button" id="createScheduleFromBudget" ${selected ? "" : "disabled"}>Gerar cronograma</button>
      </div>
    </section>
    <section class="schedule-toolbar">
      <label>
        Orçamento
        <select id="workBudgetSelect">
          ${rows.map((row) => `<option value="${row.id}" ${sameId(row.id, selectedWorkBudgetId) ? "selected" : ""}>${svgText(row.name || row.id)}</option>`).join("")}
        </select>
      </label>
      <div class="schedule-next">
        <span>Obra vinculada</span>
        <strong>${selected ? svgText(nameOf("projects", selected.projectId) || "Sem obra") : "Sem orçamento"}</strong>
      </div>
    </section>
    <section class="kpi-grid">
      ${kpi("Custo direto", selected?.directCost || 0)}
      ${kpi("Custo total", selected?.totalCost || 0)}
      ${kpi("Preço final", selected?.totalPrice || 0)}
      ${kpi("BDI", asPercent(selected?.bdiPercent || 0), false)}
      ${kpi("Itens", items.length, false)}
      ${kpi("Classe A da Curva ABC", abc.filter((row) => row.abcClass === "A").length, false)}
    </section>
    ${table("Orçamentos de obras", rows, ["name", "projectId", "clientId", "budgetDate", "sinapiReferenceId", "priceType", "bdiPercent", "directCost", "totalCost", "totalPrice", "status"], editable, "workBudgets")}
    ${selected ? table(`Itens do orçamento: ${selected.name}`, items, ["origin", "code", "description", "unit", "quantity", "unitCost", "totalCost", "bdiPercent", "unitPrice", "totalPrice", "stageName", "costCenterId", "categoryId"], editable, "workBudgetItems") : '<div class="empty">Sem dados para exibir</div>'}
  `;
  qs("newRecord")?.addEventListener("click", () => openForm("workBudgets"));
  qs("newBudgetItem")?.addEventListener("click", () => openForm("workBudgetItems"));
  qs("workBudgetSelect")?.addEventListener("change", (event) => {
    selectedWorkBudgetId = event.target.value;
    render();
  });
  qs("createProposalFromBudget")?.addEventListener("click", () => openProposalGenerator(selectedWorkBudgetId));
  qs("createScheduleFromBudget")?.addEventListener("click", () => createScheduleFromWorkBudget(selectedWorkBudgetId));
  qs("content").querySelectorAll("[data-edit]").forEach((button) => {
    const key = button.dataset.actionKey || "workBudgets";
    button.addEventListener("click", () => openForm(key, button.dataset.edit));
  });
  qs("content").querySelectorAll("[data-delete]").forEach((button) => {
    const key = button.dataset.actionKey || "workBudgets";
    button.addEventListener("click", () => removeRecord(key, button.dataset.delete));
  });
  qs("content").querySelectorAll("[data-generate-proposal]").forEach((button) => button.addEventListener("click", () => openProposalGenerator(button.dataset.generateProposal)));
}

function enrichWorkBudget(row) {
  const items = budgetItemsFor(row.id, false);
  const directCost = items.reduce((total, item) => total + Number(item.totalCost || 0), 0) || Number(row.directCost || 0);
  const totalPrice = items.reduce((total, item) => total + Number(item.totalPrice || 0), 0) || Number(row.totalPrice || 0);
  const totalCost = directCost ? directCost * (1 + Number(row.chargesPercent || 0) / 100) : Number(row.totalCost || 0);
  const finalPrice = totalPrice ? totalPrice * (1 - Number(row.discountPercent || 0) / 100) : Number(row.totalPrice || 0);
  return { ...row, directCost: roundMoney(directCost), totalCost: roundMoney(totalCost), totalPrice: roundMoney(finalPrice) };
}

function budgetItemsFor(workBudgetId, filtered = true) {
  const base = filtered ? applyFilters(db.workBudgetItems || []) : (db.workBudgetItems || []);
  return base
    .filter((row) => sameId(row.workBudgetId, workBudgetId))
    .map((row) => {
      const copy = { ...row };
      normalizeWorkBudgetItem(copy);
      return copy;
    });
}

function sinapiDefaultSettings() {
  return (db.sinapiSettings || []).find((row) => row.status !== "Inativo") || {
    defaultUf: "MS",
    defaultReferenceMonth: 4,
    defaultReferenceYear: 2026,
    defaultReferenceType: "Sem desoneração",
    defaultBdiPercent: 25,
    defaultItemMode: "Composições",
    showSinapiCodeInProposal: "Não",
    showAnalyticalInProposal: "Não",
    showUnitPriceInProposal: "Sim",
    showGlobalOnlyInProposal: "Não",
  };
}

function renderSinapiReferences() {
  const editable = canEditModule("sinapiReferences");
  const canUseSinapi = editable || canEditModule("workBudgetItems");
  const references = visibleRowsForModule("sinapiReferences", applyFilters(db.sinapiReferences || []));
  const settings = sinapiDefaultSettings();
  const budgets = visibleRowsForModule("workBudgets", applyFilters(db.workBudgets || []));
  if (!selectedWorkBudgetId || !budgets.some((row) => sameId(row.id, selectedWorkBudgetId))) selectedWorkBudgetId = budgets[0]?.id || "";
  const inputs = filterSinapiRows(visibleRowsForModule("sinapiInputs", applyFilters(db.sinapiInputs || [])));
  const compositions = filterSinapiRows(visibleRowsForModule("sinapiCompositions", applyFilters(db.sinapiCompositions || [])));
  const labor = filterSinapiRows(visibleRowsForModule("sinapiLabor", applyFilters(db.sinapiLabor || [])));
  const families = filterSinapiRows(visibleRowsForModule("sinapiFamilies", applyFilters(db.sinapiFamilies || [])));
  const maintenances = filterSinapiRows(visibleRowsForModule("sinapiMaintenances", applyFilters(db.sinapiMaintenances || [])));
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Base SINAPI</h2>
        <p>Importe e consulte a base SINAPI/CAIXA. Padrão inicial: ${svgText(settings.defaultUf || "MS")} ${settings.defaultReferenceMonth || 4}/${settings.defaultReferenceYear || 2026}, Campo Grande/MS.${serverMode ? " As listas mostram um recorte recente — a pesquisa consulta a base completa no servidor." : ""}</p>
      </div>
      <div class="actions">
        ${editable ? '<button class="primary" type="button" id="newRecord">Nova referência</button>' : ""}
      </div>
    </section>
    <section class="panel import-panel">
      <h3>Pesquisa</h3>
      <div class="form-grid">
        <label>Pesquisar SINAPI<input id="sinapiSearch" value="${svgText(sinapiSearchTerm)}" placeholder="eletroduto pvc 25"></label>
        <label>UF<select id="sinapiUfFilter">${["MS", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO", "all"].map((uf) => `<option value="${uf}" ${sinapiUfFilter === uf ? "selected" : ""}>${uf === "all" ? "Todas" : uf}</option>`).join("")}</select></label>
        <label>Tipo de referência<select id="sinapiTypeFilter"><option value="all" ${sinapiTypeFilter === "all" ? "selected" : ""}>Todos</option><option value="Sem desoneração" ${sinapiTypeFilter === "Sem desoneração" ? "selected" : ""}>Sem desoneração</option><option value="Com desoneração" ${sinapiTypeFilter === "Com desoneração" ? "selected" : ""}>Com desoneração</option><option value="Sem encargos sociais" ${sinapiTypeFilter === "Sem encargos sociais" ? "selected" : ""}>Sem encargos sociais</option></select></label>
        <label>Mostrar<select id="sinapiSourceFilter"><option value="all" ${sinapiSourceFilter === "all" ? "selected" : ""}>Resumo geral</option><option value="inputs" ${sinapiSourceFilter === "inputs" ? "selected" : ""}>Insumos</option><option value="compositions" ${sinapiSourceFilter === "compositions" ? "selected" : ""}>Composições</option><option value="labor" ${sinapiSourceFilter === "labor" ? "selected" : ""}>Mão de obra</option><option value="families" ${sinapiSourceFilter === "families" ? "selected" : ""}>Famílias/coeficientes</option><option value="maintenances" ${sinapiSourceFilter === "maintenances" ? "selected" : ""}>Manutenções</option></select></label>
        <label>Orçamento destino<select id="sinapiTargetBudget"><option value="">Selecione</option>${budgets.map((row) => `<option value="${row.id}" ${sameId(row.id, selectedWorkBudgetId) ? "selected" : ""}>${svgText(row.name || row.id)}</option>`).join("")}</select></label>
      </div>
    </section>
    ${isAdmin() ? `<section class="panel import-panel">
      <h3>Importar SINAPI</h3>
      <div class="form-grid">
        <label>Tipo do arquivo<select id="sinapiImportType"><option value="reference">Referência SINAPI</option><option value="labor">Mão de obra</option><option value="families">Famílias e coeficientes</option><option value="maintenance">Manutenções</option></select></label>
        <label>Aba CSV / tipo de aba<select id="sinapiImportSheet"><option value="">XLSX: detectar automaticamente</option><option value="ISD">ISD - insumos sem desoneração</option><option value="ICD">ICD - insumos com desoneração</option><option value="ISE">ISE - insumos sem encargos</option><option value="CSD">CSD - composições sem desoneração</option><option value="CCD">CCD - composições com desoneração</option><option value="CSE">CSE - composições sem encargos</option><option value="Analítico">Analítico</option><option value="SEM Desoneração">Mão de obra sem desoneração</option><option value="COM Desoneração">Mão de obra com desoneração</option><option value="Coeficientes">Famílias/coeficientes</option><option value="Manutenções">Manutenções</option></select></label>
        <label>UF padrão<input id="sinapiImportUf" value="${svgText(settings.defaultUf || "MS")}" maxlength="2"></label>
        <label>Mês<input id="sinapiImportMonth" type="number" value="${Number(settings.defaultReferenceMonth || 4)}"></label>
        <label>Ano<input id="sinapiImportYear" type="number" value="${Number(settings.defaultReferenceYear || 2026)}"></label>
        <label>Tipo padrão<select id="sinapiImportReferenceType"><option ${settings.defaultReferenceType === "Sem desoneração" ? "selected" : ""}>Sem desoneração</option><option ${settings.defaultReferenceType === "Com desoneração" ? "selected" : ""}>Com desoneração</option><option ${settings.defaultReferenceType === "Sem encargos sociais" ? "selected" : ""}>Sem encargos sociais</option></select></label>
        <label>Arquivo XLSX/CSV<input id="sinapiImportFile" type="file" accept=".csv,.txt,.xlsx,text/csv"></label>
      </div>
      <div class="actions">
        <button class="secondary" type="button" id="previewSinapiImport" ${editable ? "" : "disabled"}>Validar / prévia</button>
        <button class="primary" type="button" id="runSinapiImport" ${editable ? "" : "disabled"}>Confirmar importação</button>
      </div>
      <p class="field-hint">XLSX é importado pela API quando o PHP tiver suporte a ZipArchive. Se não houver suporte, exporte cada aba do Excel para CSV e informe a aba correspondente. Arquivos ficam em /var/lib/financeiro/uploads/sinapi.</p>
      <div id="sinapiImportResult" class="empty ${sinapiLastImportHtml ? "" : "hidden"}">${sinapiLastImportHtml}</div>
    </section>` : `<section class="panel import-panel sinapi-locked">
      <h3>Importar SINAPI</h3>
      ${sinapiLockedNoticeHtml(false)}
    </section>`}
    ${table("Referências SINAPI", references, ["uf", "referenceMonth", "referenceYear", "priceType", "source", "locationName", "issueDate", "status"], editable, "sinapiReferences")}
    ${["all", "inputs"].includes(sinapiSourceFilter) ? table("Insumos SINAPI", inputs.slice(0, 80), ["sinapiReferenceId", "referenceType", "uf", "classification", "code", "description", "unit", "priceOrigin", "unitPrice", "status"], canUseSinapi, "sinapiInputs") : ""}
    ${["all", "compositions"].includes(sinapiSourceFilter) ? table("Composições SINAPI", compositions.slice(0, 80), ["sinapiReferenceId", "referenceType", "uf", "groupName", "code", "description", "unit", "unitCost", "percentAS", "status"], canUseSinapi, "sinapiCompositions") : ""}
    ${sinapiSourceFilter === "labor" ? table("Mão de obra SINAPI", labor.slice(0, 80), ["sinapiReferenceId", "referenceType", "uf", "groupName", "compositionCode", "description", "unit", "laborPercent"], editable, "sinapiLabor") : ""}
    ${sinapiSourceFilter === "families" ? table("Famílias e coeficientes", families.slice(0, 80), ["sinapiReferenceId", "familyCode", "inputCode", "inputDescription", "unit", "category", "uf", "coefficient"], editable, "sinapiFamilies") : ""}
    ${sinapiSourceFilter === "maintenances" ? table("Manutenções SINAPI", maintenances.slice(0, 80), ["sinapiReferenceId", "referenceCode", "itemType", "code", "description", "maintenanceType"], editable, "sinapiMaintenances") : ""}
  `;
  qs("newRecord")?.addEventListener("click", () => openForm("sinapiReferences"));
  qs("previewSinapiImport")?.addEventListener("click", () => importSinapiFile("preview"));
  qs("runSinapiImport")?.addEventListener("click", () => importSinapiFile("confirm"));
  qs("sinapiSearch")?.addEventListener("input", (event) => {
    sinapiSearchTerm = event.target.value;
    // O bootstrap traz só um recorte das tabelas SINAPI: a pesquisa consulta a
    // base completa no servidor (debounce) e mescla os resultados no cache local.
    clearTimeout(sinapiSearchFetchTimer);
    sinapiSearchFetchTimer = setTimeout(() => sinapiServerSearch(sinapiSearchTerm), 350);
    render();
  });
  qs("sinapiUfFilter")?.addEventListener("change", (event) => {
    sinapiUfFilter = event.target.value;
    render();
  });
  qs("sinapiTypeFilter")?.addEventListener("change", (event) => {
    sinapiTypeFilter = event.target.value;
    render();
  });
  qs("sinapiSourceFilter")?.addEventListener("change", (event) => {
    sinapiSourceFilter = event.target.value;
    render();
  });
  qs("sinapiTargetBudget")?.addEventListener("change", (event) => {
    selectedWorkBudgetId = event.target.value;
  });
  qs("content").querySelectorAll("[data-edit]").forEach((button) => {
    const key = button.dataset.actionKey || "sinapiReferences";
    button.addEventListener("click", () => openForm(key, button.dataset.edit));
  });
  qs("content").querySelectorAll("[data-delete]").forEach((button) => {
    const key = button.dataset.actionKey || "sinapiReferences";
    button.addEventListener("click", () => removeRecord(key, button.dataset.delete));
  });
  qs("content").querySelectorAll("[data-add-budget-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const [sourceKey, id] = button.dataset.addBudgetItem.split(":");
      addBudgetItemFromSource(sourceKey, id);
    });
  });
}

// Busca a base SINAPI completa no servidor e mescla os resultados no cache local
// (o bootstrap carrega só um recorte — ver SINAPI_BOOTSTRAP_LIMIT na API).
async function sinapiServerSearch(term) {
  const cleaned = (term || "").trim();
  if (!serverMode || cleaned.length < 2 || cleaned === sinapiSearchLastFetched) return;
  sinapiSearchLastFetched = cleaned;
  const params = `search=${encodeURIComponent(cleaned)}&limit=120`;
  const sources = [
    ["sinapiInputs", "sinapi-insumos"],
    ["sinapiCompositions", "sinapi-composicoes"],
    ["sinapiLabor", "sinapi-mao-de-obra"],
    ["sinapiFamilies", "sinapi-familias-coeficientes"],
    ["sinapiMaintenances", "sinapi-manutencoes"],
  ];
  const results = await Promise.all(sources.map(([, resource]) => apiRequest(`${resource}?${params}`).catch(() => ({ data: [] }))));
  let merged = false;
  results.forEach((payload, index) => {
    const key = sources[index][0];
    db[key] = db[key] || [];
    const existing = new Set(db[key].map((row) => String(row.id)));
    (payload.data || []).forEach((row) => {
      if (!existing.has(String(row.id))) {
        db[key].push(row);
        merged = true;
      }
    });
  });
  if (merged && currentModule === "sinapiReferences") render();
}

function filterSinapiRows(rows) {
  const search = normalizedText(sinapiSearchTerm);
  return rows.filter((row) => {
    const reference = byId("sinapiReferences", row.sinapiReferenceId) || {};
    if (sinapiUfFilter !== "all" && row.uf && row.uf !== sinapiUfFilter) return false;
    if (sinapiTypeFilter !== "all" && reference.priceType && reference.priceType !== sinapiTypeFilter) return false;
    if (!search) return true;
    const haystack = normalizedText(`${row.code || ""} ${row.compositionCode || ""} ${row.itemCode || ""} ${row.inputCode || ""} ${row.description || ""} ${row.itemDescription || ""} ${row.inputDescription || ""} ${row.groupName || ""} ${row.className || ""} ${row.category || ""}`);
    return search.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
  });
}

function renderAbcCurve() {
  const budgets = visibleRowsForModule("workBudgets", applyFilters(db.workBudgets || []));
  if (!selectedWorkBudgetId || !budgets.some((row) => sameId(row.id, selectedWorkBudgetId))) selectedWorkBudgetId = budgets[0]?.id || "";
  const selected = byId("workBudgets", selectedWorkBudgetId);
  const rows = selected ? abcRows(budgetItemsFor(selected.id)) : [];
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Curva ABC</h2>
        <p>Itens ordenados por preço total, percentual individual, percentual acumulado e classificação A/B/C.</p>
      </div>
      <button class="secondary" type="button" id="abcExportBtn" ${rows.length ? "" : "disabled"}>Exportar CSV</button>
    </section>
    <section class="schedule-toolbar">
      <label>
        Orçamento
        <select id="abcBudgetSelect">
          ${budgets.map((row) => `<option value="${row.id}" ${sameId(row.id, selectedWorkBudgetId) ? "selected" : ""}>${svgText(row.name || row.id)}</option>`).join("")}
        </select>
      </label>
      <div class="schedule-next"><span>Total analisado</span><strong>${asMoney(rows.reduce((total, row) => total + Number(row.totalPrice || 0), 0))}</strong></div>
    </section>
    ${table("Curva ABC do orçamento", rows, ["abcPosition", "description", "unit", "quantity", "totalPrice", "individualPercent", "accumulatedPercent", "abcClass"])}
  `;
  qs("abcBudgetSelect")?.addEventListener("change", (event) => {
    selectedWorkBudgetId = event.target.value;
    render();
  });
  qs("abcExportBtn")?.addEventListener("click", () => exportRowsCsv(rows, `curva-abc-${selected?.name || "orcamento"}.csv`));
}

function abcRows(items) {
  const sorted = [...items].sort((a, b) => Number(b.totalPrice || 0) - Number(a.totalPrice || 0));
  const total = sorted.reduce((sum, row) => sum + Number(row.totalPrice || 0), 0) || 1;
  let accumulated = 0;
  return sorted.map((row, index) => {
    const individualPercent = (Number(row.totalPrice || 0) / total) * 100;
    accumulated += individualPercent;
    return {
      ...row,
      abcPosition: index + 1,
      individualPercent,
      accumulatedPercent: accumulated,
      abcClass: accumulated <= 80 ? "A" : accumulated <= 95 ? "B" : "C",
    };
  });
}

async function importSinapiFile(mode = "preview") {
  const type = qs("sinapiImportType").value;
  const sheetName = qs("sinapiImportSheet").value;
  const uf = qs("sinapiImportUf").value.trim().toUpperCase() || "MS";
  const referenceMonth = Number(qs("sinapiImportMonth").value || 4);
  const referenceYear = Number(qs("sinapiImportYear").value || 2026);
  const referenceType = qs("sinapiImportReferenceType").value || "Sem desoneração";
  const file = qs("sinapiImportFile").files[0];
  if (!file) return alert("Selecione o arquivo SINAPI.");
  if (!serverMode) return importSinapiCsvLocal({ type, sheetName, uf, referenceMonth, referenceYear, referenceType, file });
  const form = new FormData();
  form.append("file", file);
  form.append("mode", mode);
  form.append("fileType", type);
  form.append("sheetName", sheetName);
  form.append("uf", uf);
  form.append("referenceMonth", String(referenceMonth));
  form.append("referenceYear", String(referenceYear));
  form.append("referenceType", referenceType);
  try {
    const payload = await fetchForm("sinapi-import", form);
    const summary = payload.summary || {};
    sinapiLastImportHtml = sinapiImportSummaryHtml(mode, summary, payload.samples || [], payload.file || "");
    qs("sinapiImportResult").classList.remove("hidden");
    qs("sinapiImportResult").innerHTML = sinapiLastImportHtml;
    if (mode === "confirm") {
      await refreshAndRender();
    }
  } catch (error) {
    alert(`Não foi possível importar a base SINAPI: ${error.message}`);
  }
}

function sinapiImportSummaryHtml(mode, summary, samples, filePath) {
  const rows = Object.entries(summary).map(([name, values]) => ({
    name,
    created: values.created || 0,
    updated: values.updated || 0,
    skipped: values.skipped || 0,
    total: values.total || 0,
  }));
  return `
    <strong>${mode === "confirm" ? "Importação concluída" : "Prévia validada"}</strong>
    ${filePath ? `<p class="muted">Arquivo salvo fora da pasta pública: ${svgText(filePath)}</p>` : ""}
    ${table("Resumo da importação", rows, ["name", "total", "created", "updated", "skipped"])}
    ${samples.length ? `<h4>Amostra</h4><pre>${svgText(JSON.stringify(samples.slice(0, 5), null, 2))}</pre>` : ""}
  `;
}

// ── Importação SINAPI em background (módulo Configuração SINAPI) ─────────────
// Envia os 4 XLSX oficiais do CEF de uma vez; o servidor processa em segundo
// plano (worker CLI) e o progresso chega por polling em sinapi-import-status.

const SINAPI_UFS = ["MS", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
const SINAPI_ASYNC_FILES = [
  ["referenceFile", "sinapiFileReference"],
  ["familiesFile", "sinapiFileFamilies"],
  ["laborFile", "sinapiFileLabor"],
  ["maintenanceFile", "sinapiFileMaintenance"],
];

function renderSinapiSettingsModule() {
  renderCrud("sinapiSettings");
  const settings = sinapiDefaultSettings();
  const admin = isAdmin();
  // Importar a base SINAPI é exclusivo do admin (a API também bloqueia com 403):
  // os demais perfis veem o painel bloqueado com a referência da última importação.
  if (!admin) {
    qs("content").insertAdjacentHTML("beforeend", `
      <section class="panel import-panel sinapi-locked" id="sinapiAsyncPanel">
        <h3>📥 Importar Tabela SINAPI</h3>
        ${sinapiLockedNoticeHtml(true)}
      </section>
    `);
    if (serverMode) loadSinapiLastImportInfo();
    return;
  }
  qs("content").insertAdjacentHTML("beforeend", `
    <section class="panel import-panel" id="sinapiAsyncPanel">
      <h3>📥 Importar Tabela SINAPI</h3>
      <p class="field-hint">Selecione os XLSX oficiais baixados do site da CAIXA. O mês de referência é detectado pelo nome do arquivo (ex.: SINAPI_Referência_2026_04.xlsx). O processamento roda em segundo plano no servidor: insumos e composições existentes são atualizados e os novos são inseridos — nada é apagado. Apenas administradores podem realizar esta operação.</p>
      <div class="form-grid">
        <label>Referência XLSX (insumos + composições)<input id="sinapiFileReference" type="file" accept=".xlsx"></label>
        <label>Famílias e coeficientes XLSX<input id="sinapiFileFamilies" type="file" accept=".xlsx"></label>
        <label>Mão de obra XLSX<input id="sinapiFileLabor" type="file" accept=".xlsx"></label>
        <label>Manutenções XLSX<input id="sinapiFileMaintenance" type="file" accept=".xlsx"></label>
        <label>UF padrão para importação<select id="sinapiAsyncUf">${SINAPI_UFS.map((uf) => `<option value="${uf}" ${(settings.defaultUf || "MS") === uf ? "selected" : ""}>${uf}</option>`).join("")}</select></label>
        <label>Desoneração / tipo padrão<select id="sinapiAsyncType">${["Sem desoneração", "Com desoneração", "Sem encargos sociais"].map((type) => `<option ${(settings.defaultReferenceType || "Sem desoneração") === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
        <label>Mês de referência<input id="sinapiAsyncMonth" type="number" min="1" max="12" value="${Number(settings.defaultReferenceMonth || 4)}"></label>
        <label>Ano de referência<input id="sinapiAsyncYear" type="number" min="2000" max="2100" value="${Number(settings.defaultReferenceYear || 2026)}"></label>
      </div>
      <div class="actions">
        <button class="primary" type="button" id="sinapiAsyncStart" ${serverMode ? "" : "disabled"}>Importar e Atualizar Preços</button>
      </div>
      ${!serverMode ? '<p class="field-hint">A importação em background só está disponível com a API no servidor.</p>' : ""}
      <div id="sinapiAsyncStatus" class="empty hidden"></div>
    </section>
  `);
  SINAPI_ASYNC_FILES.forEach(([, inputId]) => {
    qs(inputId)?.addEventListener("change", (event) => detectSinapiReferenceFromFile(event.target.files[0]));
  });
  qs("sinapiAsyncStart")?.addEventListener("click", startSinapiAsyncImport);
  if (serverMode) resumeSinapiAsyncJob();
}

// Aviso de acesso restrito mostrado aos perfis não-admin nos painéis de importação.
function sinapiLockedNoticeHtml(withLastImport) {
  return `
    <div class="permission-notice">
      <span class="icon">🔒</span>
      <div>
        <strong>Acesso restrito</strong>
        <p>A importação de tabelas SINAPI é permitida apenas para <strong>Administradores</strong>. Entre em contato com o administrador do sistema para solicitar a atualização dos preços.</p>
        ${withLastImport ? '<p class="muted">Última importação: <strong id="sinapiLastImport">—</strong></p>' : ""}
      </div>
    </div>
  `;
}

// Preenche a linha "Última importação" do painel bloqueado (visível a qualquer
// perfil com leitura do módulo; falha silenciosa para quem não tem permissão).
async function loadSinapiLastImportInfo() {
  try {
    const payload = await apiRequest("sinapi-import-status");
    const element = qs("sinapiLastImport");
    const job = payload.job;
    if (!element || !job) return;
    const reference = `${String(job.referenceMonth).padStart(2, "0")}/${job.referenceYear} — UF ${job.uf} — ${job.referenceType}`;
    if (job.status === "done") {
      element.textContent = `${reference}${job.finishedAt ? ` (concluída em ${String(job.finishedAt).slice(0, 16)})` : ""}`;
    } else if (["queued", "running"].includes(job.status)) {
      element.textContent = `${reference} — importação em andamento…`;
    } else {
      element.textContent = `${reference} — última tentativa falhou`;
    }
  } catch {
    // Perfil sem permissão de leitura ou sem job anterior: mantém o traço.
  }
}

// SINAPI_Referência_2026_04.xlsx → mês 04 / ano 2026 preenchidos automaticamente.
function detectSinapiReferenceFromFile(file) {
  const match = /(20\d{2})[._-](0?[1-9]|1[0-2])(?=\D|$)/.exec(file?.name || "");
  if (!match) return;
  if (qs("sinapiAsyncYear")) qs("sinapiAsyncYear").value = Number(match[1]);
  if (qs("sinapiAsyncMonth")) qs("sinapiAsyncMonth").value = Number(match[2]);
}

async function startSinapiAsyncImport() {
  const form = new FormData();
  let hasFile = false;
  for (const [field, inputId] of SINAPI_ASYNC_FILES) {
    const file = qs(inputId)?.files[0];
    if (file) {
      form.append(field, file);
      hasFile = true;
    }
  }
  if (!hasFile) return alert("Selecione ao menos um dos arquivos SINAPI (XLSX).");
  form.append("uf", qs("sinapiAsyncUf").value);
  form.append("referenceType", qs("sinapiAsyncType").value);
  form.append("referenceMonth", qs("sinapiAsyncMonth").value);
  form.append("referenceYear", qs("sinapiAsyncYear").value);
  const button = qs("sinapiAsyncStart");
  button.disabled = true;
  button.textContent = "Enviando arquivos…";
  try {
    const payload = await fetchForm("sinapi-import-async", form);
    pollSinapiAsyncJob(payload.jobId, { refreshOnDone: true });
  } catch (error) {
    alert(`Não foi possível iniciar a importação SINAPI: ${error.message}`);
    button.disabled = false;
    button.textContent = "Importar e Atualizar Preços";
  }
}

// Ao abrir o módulo, retoma o acompanhamento de um job em andamento (ex.: após
// recarregar a página) ou mostra o resultado da última importação.
async function resumeSinapiAsyncJob() {
  try {
    const payload = await apiRequest("sinapi-import-status");
    if (!payload.job) return;
    if (["queued", "running"].includes(payload.job.status)) {
      pollSinapiAsyncJob(payload.job.id, { refreshOnDone: true });
    } else {
      renderSinapiAsyncStatus(payload.job);
    }
  } catch {
    // Sem job anterior ou sem permissão de leitura: painel fica como está.
  }
}

function pollSinapiAsyncJob(jobId, { refreshOnDone = false } = {}) {
  clearTimeout(sinapiJobPollTimer);
  const seq = ++sinapiJobPollSeq;
  const startedWaiting = Date.now(); // relógio local: evita problemas de fuso com job.createdAt
  const tick = async () => {
    if (seq !== sinapiJobPollSeq) return; // outra corrente de polling assumiu
    if (!document.getElementById("sinapiAsyncStatus")) return; // saiu do módulo
    try {
      const payload = await apiRequest(`sinapi-import-status?job=${encodeURIComponent(jobId)}`);
      const job = payload.job;
      if (!job) return;
      if (job.status === "queued" && Date.now() - startedWaiting > 30000) {
        // Worker nunca saiu de queued: o exec() do Apache provavelmente falhou.
        renderSinapiAsyncStuck(job);
        const startButton = qs("sinapiAsyncStart");
        if (startButton) {
          startButton.disabled = !(isAdmin() && serverMode);
          startButton.textContent = "Importar e Atualizar Preços";
        }
        return;
      }
      renderSinapiAsyncStatus(job);
      if (["queued", "running"].includes(job.status)) {
        sinapiJobPollTimer = setTimeout(tick, 2000);
        return;
      }
      const button = qs("sinapiAsyncStart");
      if (button) {
        button.disabled = !(isAdmin() && serverMode);
        button.textContent = "Importar e Atualizar Preços";
      }
      if (job.status === "done" && refreshOnDone) {
        await refreshAndRender(); // recarrega insumos/composições com os preços novos
      }
    } catch (error) {
      const status = qs("sinapiAsyncStatus");
      if (status) {
        status.classList.remove("hidden");
        status.textContent = `Falha ao consultar o progresso: ${error.message}. Nova tentativa em 5 s…`;
      }
      sinapiJobPollTimer = setTimeout(tick, 5000);
    }
  };
  tick();
}

function renderSinapiAsyncStatus(job) {
  const container = qs("sinapiAsyncStatus");
  if (!container) return;
  container.classList.remove("hidden");
  const reference = `${String(job.referenceMonth).padStart(2, "0")}/${job.referenceYear} — UF: ${job.uf} — ${job.referenceType}`;
  if (job.status === "error") {
    container.innerHTML = `
      <strong>❌ Importação falhou</strong>
      <p>${svgText(job.errorMessage || "Erro desconhecido.")}</p>
      <p class="muted">Log do worker: /var/lib/financeiro/sinapi_jobs/ — 🗓️ Referência: ${svgText(reference)}</p>
      ${isAdmin() ? '<div class="actions"><button class="secondary" type="button" id="sinapiReprocessBtn">🔄 Reprocessar</button></div>' : ""}
    `;
    wireSinapiReprocess(job.id);
    return;
  }
  if (job.status === "done") {
    const summary = job.summary || {};
    const line = (label, key) => {
      const stats = summary[key];
      if (!stats) return "";
      return `<li>✅ ${label}: ${Number(stats.updated || 0).toLocaleString("pt-BR")} atualizado(s), ${Number(stats.created || 0).toLocaleString("pt-BR")} inserido(s)${Number(stats.skipped || 0) ? `, ${Number(stats.skipped).toLocaleString("pt-BR")} ignorado(s)` : ""}</li>`;
    };
    container.innerHTML = `
      <strong>✅ Importação concluída</strong>
      <ul class="sinapi-import-log">
        ${line("Insumos", "sinapiInputs")}
        ${line("Composições", "sinapiCompositions")}
        ${line("Itens analíticos das composições", "sinapiCompositionItems")}
        ${line("Mão de obra", "sinapiLabor")}
        ${line("Famílias e coeficientes", "sinapiFamilies")}
        ${line("Manutenções registradas", "sinapiMaintenances")}
      </ul>
      <p class="muted">🗓️ Referência: ${svgText(reference)} — ${Number(job.progress || 0).toLocaleString("pt-BR")} registros processados</p>
    `;
    return;
  }
  const total = Number(job.total || 0);
  const progress = Number(job.progress || 0);
  const percent = total ? Math.min(100, Math.round((progress / total) * 100)) : 0;
  container.innerHTML = `
    <strong>⏳ ${job.status === "queued" ? "Na fila para processamento" : "Importando…"}</strong>
    <p>${svgText(job.currentStep || "")}</p>
    <div class="progress-line"><span style="width:${percent}%"></span></div>
    <p class="muted">${total ? `${progress.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} registros (${percent}%)` : "Lendo as planilhas — o total aparece quando a leitura termina."} — 🗓️ Referência: ${svgText(reference)}</p>
  `;
}

// Job que não saiu de "queued" em 30 s: o worker não iniciou (exec/permissão).
function renderSinapiAsyncStuck(job) {
  const container = qs("sinapiAsyncStatus");
  if (!container) return;
  container.classList.remove("hidden");
  container.innerHTML = `
    <strong>⚠️ O worker de importação não iniciou após 30 segundos</strong>
    <p>Possível causa: o servidor não conseguiu executar o PHP CLI via exec() (permissões do Apache ou pacote php-cli ausente). Verifique o log em /var/lib/financeiro/sinapi_jobs/ ou contate o administrador.</p>
    ${isAdmin() ? '<div class="actions"><button class="secondary" type="button" id="sinapiReprocessBtn">🔄 Reprocessar</button></div>' : ""}
  `;
  wireSinapiReprocess(job.id);
}

function wireSinapiReprocess(jobId) {
  qs("sinapiReprocessBtn")?.addEventListener("click", () => reprocessSinapiJob(jobId));
}

// Redispara o worker reaproveitando os XLSX já enviados (job preso ou com erro).
async function reprocessSinapiJob(jobId) {
  if (!confirm("Reprocessar esta importação SINAPI com os arquivos já enviados?")) return;
  const button = qs("sinapiReprocessBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "Reprocessando…";
  }
  try {
    await apiRequest("sinapi-reprocess-job", { method: "POST", body: JSON.stringify({ jobId }) });
    pollSinapiAsyncJob(jobId, { refreshOnDone: true });
  } catch (error) {
    alert(`Erro ao reprocessar: ${error.message}`);
    if (button) {
      button.disabled = false;
      button.textContent = "🔄 Reprocessar";
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// QUALIDADE PBQP-H NÍVEL B — PQO, PES, FVS, FVM, NC, Treinamentos e Auditorias
// Metas do Nível B: mín. 11 dos 27 serviços SiAC controlados com FVS e mín. 10
// materiais controlados com FVM por obra. Espelho PHP: servicos_siac().
// ═══════════════════════════════════════════════════════════════════════════

const SERVICOS_SIAC = [
  { id: 1, grupo: "Preliminares", nome: "Compactação de aterro" },
  { id: 2, grupo: "Preliminares", nome: "Locação de obra" },
  { id: 3, grupo: "Fundações", nome: "Execução de fundação" },
  { id: 4, grupo: "Estrutura", nome: "Execução de fôrma" },
  { id: 5, grupo: "Estrutura", nome: "Montagem de armadura" },
  { id: 6, grupo: "Estrutura", nome: "Concretagem de peça estrutural" },
  { id: 7, grupo: "Estrutura", nome: "Execução de alvenaria estrutural" },
  { id: 8, grupo: "Vedações Verticais", nome: "Alvenaria não estrutural e divisória leve" },
  { id: 9, grupo: "Vedações Verticais", nome: "Revestimento interno área seca" },
  { id: 10, grupo: "Vedações Verticais", nome: "Revestimento interno área úmida" },
  { id: 11, grupo: "Vedações Verticais", nome: "Revestimento externo" },
  { id: 12, grupo: "Vedações Horizontais", nome: "Execução de contrapiso" },
  { id: 13, grupo: "Vedações Horizontais", nome: "Revestimento piso interno área seca" },
  { id: 14, grupo: "Vedações Horizontais", nome: "Revestimento piso interno área úmida" },
  { id: 15, grupo: "Vedações Horizontais", nome: "Revestimento piso externo" },
  { id: 16, grupo: "Vedações Horizontais", nome: "Execução de forro" },
  { id: 17, grupo: "Vedações Horizontais", nome: "Execução de impermeabilização" },
  { id: 18, grupo: "Vedações Horizontais", nome: "Cobertura em telhado (estrutura + telhamento)" },
  { id: 19, grupo: "Esquadrias", nome: "Colocação de porta" },
  { id: 20, grupo: "Esquadrias", nome: "Colocação de janela" },
  { id: 21, grupo: "Esquadrias", nome: "Colocação de guarda-corpo" },
  { id: 22, grupo: "Instalações", nome: "Instalação elétrica" },
  { id: 23, grupo: "Instalações", nome: "Instalação hidrossanitária" },
  { id: 24, grupo: "Instalações", nome: "Instalação de gás" },
  { id: 25, grupo: "Instalações", nome: "Instalação de SPDA" },
  { id: 26, grupo: "Acabamentos", nome: "Pintura interna" },
  { id: 27, grupo: "Acabamentos", nome: "Pintura externa" },
];

const CHECKLIST_SIAC_NIVEL_B = [
  { clausula: "4.1", desc: "Contexto da organização — partes interessadas identificadas" },
  { clausula: "4.2", desc: "Escopo do SGQ definido e documentado" },
  { clausula: "5.1", desc: "Liderança demonstra comprometimento com o SGQ" },
  { clausula: "5.2", desc: "Política da Qualidade definida, comunicada e vigente" },
  { clausula: "5.3", desc: "Responsabilidades e autoridades definidas" },
  { clausula: "6.2", desc: "Objetivos da qualidade definidos e mensuráveis" },
  { clausula: "7.1.1", desc: "Recursos necessários determinados e disponibilizados" },
  { clausula: "7.1.2", desc: "Pessoas competentes para execução dos serviços" },
  { clausula: "7.1.3", desc: "Infraestrutura adequada para execução das obras" },
  { clausula: "7.2", desc: "Competência da equipe determinada e registrada" },
  { clausula: "7.3", desc: "Conscientização da equipe sobre a política e objetivos" },
  { clausula: "7.5", desc: "Informações documentadas (PES, FVS, FVM, NC) controladas" },
  { clausula: "8.1", desc: "Processos de execução planejados e controlados" },
  { clausula: "8.1.1", desc: "PQO elaborado e implementado para cada obra" },
  { clausula: "8.4.1", desc: "Fornecedores externos controlados (básico)" },
  { clausula: "8.4.2", desc: "Tipo e extensão do controle de fornecedores definidos" },
  { clausula: "8.4.3", desc: "Informações fornecidas aos fornecedores externos" },
  { clausula: "8.5.1", desc: "Execução controlada — PES implementados na obra" },
  { clausula: "8.5.2", desc: "Identificação e rastreabilidade nos serviços controlados" },
  { clausula: "8.7", desc: "Saídas não conformes (NC) identificadas e tratadas" },
  { clausula: "9.2", desc: "Auditoria interna realizada conforme programa" },
  { clausula: "9.3", desc: "Análise crítica pela direção realizada" },
  { clausula: "10.2", desc: "NC e ação corretiva — processo implementado" },
];

const FVM_CHECKLIST_PADRAO = [
  "NF conforme o pedido",
  "Quantidade conforme o pedido",
  "Material sem danos visíveis",
  "Especificação técnica conforme",
  "Prazo de validade dentro do limite",
  "Certificado do fabricante presente",
];

const QUALIDADE_METAS = { servicos: 11, materiais: 10 };

let qualidadeObraFiltro = "";
let qualidadeEdit = null; // { key, id } — formulário aberto no módulo de qualidade atual
let qualidadeDraft = null; // rascunho de formulários com re-render (FVS, FVM, PQO)
let qualidadePrintWired = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

function qrows(key) {
  db[key] = db[key] || [];
  return db[key];
}

function qjson(value, fallback) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value || "null") : value;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function qHoje() {
  return new Date().toISOString().slice(0, 10);
}

function servicoSiac(id) {
  return SERVICOS_SIAC.find((s) => s.id === Number(id)) || null;
}

function qPqoDaObra(projectId) {
  return qrows("qualidadePqo").find((p) => sameId(p.projectId, projectId)) || null;
}

function qPesVigente(servicoSiacId) {
  return qrows("qualidadePes").find((p) => Number(p.servicoSiacId) === Number(servicoSiacId) && p.status === "Vigente") || null;
}

function qTemTreinamento(projectId, servicoSiacId) {
  return qrows("qualidadeTreinamentos").some((t) => sameId(t.projectId, projectId) && Number(t.servicoSiacId) === Number(servicoSiacId));
}

function qObrasAtivas() {
  return (db.projects || []).filter((p) => p.status !== "Cancelada");
}

function qObraSelectHtml(domId, value, { onlyWithPqo = false, optional = false } = {}) {
  const comPqo = new Set(qrows("qualidadePqo").map((p) => String(p.projectId)));
  const options = qObrasAtivas()
    .filter((p) => !onlyWithPqo || comPqo.has(String(p.id)))
    .map((p) => `<option value="${p.id}" ${sameId(p.id, value) ? "selected" : ""}>${svgText(p.name)}</option>`)
    .join("");
  return `<select id="${domId}"><option value="">${optional ? "Todas as obras" : "Selecione a obra"}</option>${options}</select>`;
}

function qServicoSelectHtml(domId, value, restrictIds = null) {
  const groups = {};
  SERVICOS_SIAC.filter((s) => !restrictIds || restrictIds.map(Number).includes(s.id)).forEach((s) => {
    (groups[s.grupo] = groups[s.grupo] || []).push(s);
  });
  const body = Object.entries(groups)
    .map(([grupo, list]) => `<optgroup label="${svgText(grupo)}">${list.map((s) => `<option value="${s.id}" ${Number(value) === s.id ? "selected" : ""}>${s.id} — ${svgText(s.nome)}</option>`).join("")}</optgroup>`)
    .join("");
  return `<select id="${domId}"><option value="">Selecione o serviço</option>${body}</select>`;
}

function qBadge(text, tone) {
  return `<span class="q-badge q-${tone}">${svgText(text)}</span>`;
}

function qKpiCard(label, value, hint, tone = "neutro") {
  return `<div class="q-kpi q-${tone}"><span>${svgText(label)}</span><strong>${value}</strong><small>${hint}</small></div>`;
}

function qBarChartSvg(pairs) {
  if (!pairs.length || pairs.every(([, v]) => !v)) return '<div class="empty">Sem dados para exibir</div>';
  const max = Math.max(1, ...pairs.map(([, v]) => v));
  const barW = 64;
  const gap = 20;
  const h = 140;
  const width = pairs.length * (barW + gap) + gap;
  return `<svg viewBox="0 0 ${width} ${h + 40}" class="q-chart" role="img">${pairs
    .map(([label, value], index) => {
      const bh = Math.max(2, Math.round((value / max) * h));
      const x = gap + index * (barW + gap);
      return `<rect x="${x}" y="${h - bh + 12}" width="${barW}" height="${bh}" rx="6"></rect>
        <text x="${x + barW / 2}" y="${h - bh + 4}" text-anchor="middle" class="q-chart-num">${value}</text>
        <text x="${x + barW / 2}" y="${h + 32}" text-anchor="middle" class="q-chart-label">${svgText(label)}</text>`;
    })
    .join("")}</svg>`;
}

function qualidadePrint(html) {
  let area = document.getElementById("qualidadePrintArea");
  if (!area) {
    area = document.createElement("div");
    area.id = "qualidadePrintArea";
    document.body.appendChild(area);
  }
  area.innerHTML = html;
  if (!qualidadePrintWired) {
    window.addEventListener("afterprint", () => document.body.classList.remove("printing-qualidade"));
    qualidadePrintWired = true;
  }
  document.body.classList.add("printing-qualidade");
  window.print();
}

function qualidadeHead(key, title, description) {
  const editable = canEditModule(key);
  return `
    <section class="module-head">
      <div>
        <h2>${svgText(title)}</h2>
        <p>${svgText(description)}</p>
      </div>
      <div class="actions">
        ${editable && key !== "qualidadeDashboard" ? `<button class="primary" type="button" id="qNovoRegistro">Novo</button>` : ""}
      </div>
    </section>
  `;
}

function qWire(key, { onEdit = null } = {}) {
  qs("qNovoRegistro")?.addEventListener("click", () => {
    qualidadeEdit = { key, id: null };
    qualidadeDraft = null;
    render();
  });
  qs("qFormCancelar")?.addEventListener("click", () => {
    qualidadeEdit = null;
    qualidadeDraft = null;
    render();
  });
  qs("content").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => {
    qualidadeEdit = { key, id: button.dataset.edit };
    qualidadeDraft = null;
    if (onEdit) onEdit(button.dataset.edit);
    render();
  }));
  qs("content").querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeRecord(key, button.dataset.delete)));
  qs("qFiltroObraQualidade")?.addEventListener("change", (event) => {
    qualidadeObraFiltro = event.target.value;
    render();
  });
}

async function qSalvar(key, data, id) {
  try {
    const record = id ? await updateIntegratedRecord(key, id, data) : await createIntegratedRecord(key, data);
    logAudit(id ? "update" : "create", key, String(record?.numero || data.servicoNome || data.materialNome || data.versao || record?.id || ""));
    if (record?.automation) alert(record.automation);
    qualidadeEdit = null;
    qualidadeDraft = null;
    await refreshAndRender();
    return true;
  } catch (error) {
    alert(`Não foi possível salvar: ${error.message}`);
    return false;
  }
}

function qVal(domId) {
  return qs(domId)?.value?.trim() ?? "";
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function renderQualidadeDashboard() {
  const obraId = qualidadeObraFiltro;
  const porObra = (rows) => rows.filter((r) => !obraId || sameId(r.projectId, obraId));
  const fvs = porObra(qrows("qualidadeFvs"));
  const fvm = porObra(qrows("qualidadeFvm"));
  const ncs = porObra(qrows("qualidadeNc"));
  const hoje = qHoje();
  const pqo = obraId ? qPqoDaObra(obraId) : null;
  const servicosControlados = pqo ? qjson(pqo.servicosControlados, []) : [];
  const materiaisControlados = pqo ? qjson(pqo.materiaisControlados, []) : [];

  const fvsAprovadas = fvs.filter((f) => f.status === "Aprovada");
  const servicosComFvs = obraId
    ? servicosControlados.filter((idServico) => fvsAprovadas.some((f) => Number(f.servicoSiacId) === Number(idServico))).length
    : new Set(fvsAprovadas.map((f) => `${f.projectId}:${f.servicoSiacId}`)).size;
  const fvmAprovadas = fvm.filter((f) => f.status === "Aprovada").length;
  const ncsAbertas = ncs.filter((n) => n.status !== "Fechada");
  const ncsVencidas = ncsAbertas.filter((n) => n.prazoAcao && n.prazoAcao < hoje);
  const metaServicosOk = obraId && servicosControlados.length >= QUALIDADE_METAS.servicos;

  const ncPorStatus = ["Aberta", "Em andamento", "Verificando", "Fechada"].map((status) => [status, ncs.filter((n) => n.status === status).length]);
  const fvsPorResultado = ["Aprovado", "Aprovado com ressalvas", "Reprovado"].map((resultado) => [resultado.replace("Aprovado com ressalvas", "C/ ressalvas"), fvs.filter((f) => f.resultado === resultado).length]);

  const alertas = [];
  ncsAbertas.forEach((nc) => {
    if (!nc.prazoAcao) return;
    const dias = Math.ceil((new Date(nc.prazoAcao) - new Date(hoje)) / 86400000);
    if (dias < 0) alertas.push(`❌ ${nc.numero} está com o prazo de ação vencido desde ${nc.prazoAcao}.`);
    else if (dias <= 3) alertas.push(`⚠️ ${nc.numero} vence em ${dias} dia(s) — ${nc.descricaoNC?.slice(0, 80) || ""}`);
  });
  (db.projectSchedule || []).filter((e) => Number(e.qualidadeBloqueada) === 1 && (!obraId || sameId(e.projectId, obraId))).forEach((e) => {
    alertas.push(`❌ Etapa "${e.stageName}" bloqueada por pendência de qualidade (FVS/NC).`);
  });
  if (pqo) {
    qjson(pqo.servicosControlados, []).forEach((idServico) => {
      if (!qPesVigente(idServico)) alertas.push(`⚠️ Serviço "${servicoSiac(idServico)?.nome || idServico}" no PQO sem PES vigente.`);
      else if (!qTemTreinamento(obraId, idServico)) alertas.push(`⚠️ Serviço "${servicoSiac(idServico)?.nome || idServico}" sem treinamento registrado nesta obra.`);
    });
  }

  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Qualidade PBQP-H — Nível B</h2>
        <p>Visão consolidada do SGQ: FVS, FVM, NCs e metas do SiAC Nível B (mín. ${QUALIDADE_METAS.servicos} serviços e ${QUALIDADE_METAS.materiais} materiais controlados por obra).</p>
      </div>
      <label>Obra ${qObraSelectHtml("qFiltroObraQualidade", obraId, { optional: true })}</label>
    </section>
    <section class="q-kpis">
      ${qKpiCard("FVS aprovadas", `${fvsAprovadas.length}/${fvs.length || 0}`, obraId ? `${servicosComFvs} de ${servicosControlados.length || "—"} serviços com FVS aprovada` : `${servicosComFvs} serviço(s)/obra com FVS aprovada`, fvsAprovadas.length ? "ok" : "neutro")}
      ${qKpiCard("FVM aprovadas", `${fvmAprovadas}/${fvm.length || 0}`, obraId ? `Meta Nível B: ${QUALIDADE_METAS.materiais} materiais controlados` : "Fichas de material aprovadas", fvmAprovadas >= QUALIDADE_METAS.materiais ? "ok" : "neutro")}
      ${qKpiCard("NCs abertas", String(ncsAbertas.length), `${ncsVencidas.length} com prazo vencido`, ncsVencidas.length ? "ruim" : ncsAbertas.length ? "atencao" : "ok")}
      ${obraId
        ? qKpiCard("Serviços controlados", `${servicosControlados.length}/27`, metaServicosOk ? "✅ Meta do Nível B atingida" : `Mínimo Nível B: ${QUALIDADE_METAS.servicos}`, metaServicosOk ? "ok" : "atencao")
        : qKpiCard("PQOs vigentes", String(qrows("qualidadePqo").filter((p) => p.status === "Vigente").length), `${qrows("qualidadePqo").length} plano(s) no total`, "neutro")}
    </section>
    <div class="q-grid-2">
      <section class="panel"><h3>NCs por status</h3>${qBarChartSvg(ncPorStatus)}</section>
      <section class="panel"><h3>FVS por resultado</h3>${qBarChartSvg(fvsPorResultado)}</section>
    </div>
    <section class="panel">
      <h3>Alertas</h3>
      ${alertas.length ? `<ul class="q-alertas">${alertas.slice(0, 12).map((a) => `<li>${svgText(a)}</li>`).join("")}</ul>` : '<div class="empty">Nenhum alerta de qualidade. ✅</div>'}
    </section>
  `;
  qWire("qualidadeDashboard");
}

// ── Política da Qualidade ────────────────────────────────────────────────────

function renderQualidadePolitica() {
  const key = "qualidadePolitica";
  const editable = canEditModule(key);
  const rows = qrows(key);
  const vigente = rows.find((r) => r.status === "Vigente");
  const editing = qualidadeEdit?.key === key;
  const row = editing && qualidadeEdit.id ? byId(key, qualidadeEdit.id) || {} : {};
  const formHtml = editing ? `
    <section class="panel import-panel">
      <h3>${qualidadeEdit.id ? "Editar versão" : "Nova versão da Política da Qualidade"}</h3>
      <div class="form-grid">
        <label>Versão<input id="qPolVersao" value="${svgText(row.versao || (vigente ? `${(parseFloat(vigente.versao) + 0.1).toFixed(1)}` : "1.0"))}"></label>
        <label>Status<select id="qPolStatus">${["Rascunho", "Vigente", "Obsoleto"].map((s) => `<option ${(row.status || "Rascunho") === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label>Aprovado por<input id="qPolAprovadoPor" value="${svgText(row.aprovadoPor || "")}"></label>
        <label>Data de aprovação<input id="qPolDataAprovacao" type="date" value="${svgText(row.dataAprovacao || "")}"></label>
        <label class="full">Conteúdo da política<textarea id="qPolConteudo" rows="10">${svgText(row.conteudo || vigente?.conteudo || "")}</textarea></label>
      </div>
      <div class="actions">
        <button class="primary" type="button" id="qPolSalvar">Salvar</button>
        <button class="secondary" type="button" id="qFormCancelar">Cancelar</button>
      </div>
    </section>` : "";
  qs("content").innerHTML = `
    ${qualidadeHead(key, "Política da Qualidade", "Documento único da empresa exigido pelo SiAC (cláusula 5.2). Ao tornar uma versão Vigente, as anteriores ficam obsoletas automaticamente.")}
    ${formHtml}
    <section class="panel">
      <h3>Versão vigente ${vigente ? qBadge(`v${vigente.versao}`, "ok") : qBadge("Inexistente", "ruim")}</h3>
      ${vigente
        ? `<pre class="q-doc">${svgText(vigente.conteudo || "")}</pre>
           <p class="muted">Aprovada por ${svgText(vigente.aprovadoPor || "—")} em ${svgText(vigente.dataAprovacao || "—")}</p>
           <div class="actions">${editable ? `<button class="secondary" type="button" id="qPolEditarVigente">Editar</button>` : ""}<button class="secondary" type="button" id="qPolImprimir">Exportar PDF</button></div>`
        : '<div class="empty">Nenhuma política vigente. Crie a primeira versão em "Novo".</div>'}
    </section>
    ${table("Histórico de versões", rows, ["versao", "aprovadoPor", "dataAprovacao", "status"], editable, key)}
  `;
  qWire(key);
  qs("qPolEditarVigente")?.addEventListener("click", () => {
    qualidadeEdit = { key, id: vigente.id };
    render();
  });
  qs("qPolImprimir")?.addEventListener("click", () => {
    if (!vigente) return;
    qualidadePrint(`
      <h1>Política da Qualidade — v${svgText(vigente.versao)}</h1>
      <p class="q-print-sub">${svgText((db.companySettings || [])[0]?.name || "ObraSync")} — PBQP-H SiAC Nível B</p>
      <div class="q-print-body">${svgText(vigente.conteudo || "").replaceAll("\n", "<br>")}</div>
      <p>Aprovado por: ${svgText(vigente.aprovadoPor || "____________")} — Data: ${svgText(vigente.dataAprovacao || "____/____/____")}</p>
    `);
  });
  qs("qPolSalvar")?.addEventListener("click", async () => {
    const conteudo = qVal("qPolConteudo");
    if (!conteudo) return alert("Informe o conteúdo da política.");
    await qSalvar(key, {
      conteudo,
      versao: qVal("qPolVersao") || "1.0",
      aprovadoPor: qVal("qPolAprovadoPor"),
      dataAprovacao: qVal("qPolDataAprovacao") || null,
      status: qVal("qPolStatus") || "Rascunho",
    }, qualidadeEdit?.id || null);
  });
}

// ── PES — Procedimentos de Execução de Serviço ───────────────────────────────

function renderQualidadePes() {
  const key = "qualidadePes";
  const editable = canEditModule(key);
  const rows = qrows(key);
  const editing = qualidadeEdit?.key === key;
  const row = editing && qualidadeEdit.id ? byId(key, qualidadeEdit.id) || {} : {};
  const formHtml = editing ? `
    <section class="panel import-panel">
      <h3>${qualidadeEdit.id ? "Editar PES" : "Novo PES"}</h3>
      <div class="form-grid">
        <label>Serviço SiAC${qServicoSelectHtml("qPesServico", row.servicoSiacId)}</label>
        <label>Versão<input id="qPesVersao" value="${svgText(row.versao || "1.0")}"></label>
        <label>Status<select id="qPesStatus">${["Rascunho", "Vigente", "Obsoleto"].map((s) => `<option ${(row.status || "Rascunho") === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label>Responsável pela elaboração<input id="qPesResponsavel" value="${svgText(row.responsavelElaboracao || "")}"></label>
        <label>Data de elaboração<input id="qPesData" type="date" value="${svgText(row.dataElaboracao || qHoje())}"></label>
        <label>Normas de referência<input id="qPesNormas" value="${svgText(row.normasReferencia || "")}" placeholder="NBR..."></label>
        <label class="full">Objetivo<textarea id="qPesObjetivo" rows="2">${svgText(row.objetivo || "")}</textarea></label>
        <label class="full">Materiais necessários<textarea id="qPesMateriais" rows="2">${svgText(row.materiaisNecessarios || "")}</textarea></label>
        <label class="full">Equipamentos e EPIs<textarea id="qPesEpi" rows="2">${svgText(row.equipamentosEpi || "")}</textarea></label>
        <label class="full">Procedimento de execução<textarea id="qPesProcedimento" rows="6">${svgText(row.procedimento || "")}</textarea></label>
        <label class="full">Critérios de aceitação — um por linha (cada linha vira um item da FVS)<textarea id="qPesCriterios" rows="5">${svgText(row.criteriosAceitacao || "")}</textarea></label>
      </div>
      <div class="actions">
        <button class="primary" type="button" id="qPesSalvar">Salvar</button>
        <button class="secondary" type="button" id="qFormCancelar">Cancelar</button>
      </div>
    </section>` : "";
  const listRows = rows.map((r) => ({ ...r, servico: `${r.servicoSiacId} — ${r.servicoNome}` }));
  qs("content").innerHTML = `
    ${qualidadeHead(key, "Procedimentos de Execução de Serviço (PES)", "Biblioteca reutilizável dos 27 serviços controlados do SiAC. Ao salvar um PES Vigente, as versões anteriores do mesmo serviço ficam obsoletas.")}
    ${formHtml}
    ${table("PES cadastrados", listRows, ["servico", "servicoGrupo", "versao", "responsavelElaboracao", "dataElaboracao", "status"], editable, key)}
  `;
  qWire(key);
  qs("qPesSalvar")?.addEventListener("click", async () => {
    const servicoId = Number(qVal("qPesServico"));
    const servico = servicoSiac(servicoId);
    if (!servico) return alert("Selecione o serviço SiAC.");
    const criterios = qVal("qPesCriterios");
    if (!criterios) return alert("Informe os critérios de aceitação — eles geram os itens da FVS.");
    await qSalvar(key, {
      servicoSiacId: servicoId,
      servicoNome: servico.nome,
      servicoGrupo: servico.grupo,
      versao: qVal("qPesVersao") || "1.0",
      objetivo: qVal("qPesObjetivo"),
      materiaisNecessarios: qVal("qPesMateriais"),
      equipamentosEpi: qVal("qPesEpi"),
      procedimento: qVal("qPesProcedimento"),
      criteriosAceitacao: criterios,
      normasReferencia: qVal("qPesNormas"),
      responsavelElaboracao: qVal("qPesResponsavel"),
      dataElaboracao: qVal("qPesData") || null,
      status: qVal("qPesStatus") || "Rascunho",
    }, qualidadeEdit?.id || null);
  });
}

// ── PQO — Plano da Qualidade da Obra ────────────────────────────────────────

function qPqoDraft(row) {
  return {
    id: row?.id || null,
    projectId: row?.projectId || "",
    versao: row?.versao || "1.0",
    responsavelTecnico: row?.responsavelTecnico || "",
    crea: row?.crea || "",
    dataInicioPrevisto: row?.dataInicioPrevisto || "",
    dataFimPrevisto: row?.dataFimPrevisto || "",
    escopo: row?.escopo || "",
    metasQualidade: row?.metasQualidade || "",
    status: row?.status || "Rascunho",
    dataAprovacao: row?.dataAprovacao || "",
    aprovadoPor: row?.aprovadoPor || "",
    servicos: qjson(row?.servicosControlados, []).map(Number),
    materiais: qjson(row?.materiaisControlados, []),
  };
}

function qPqoCollect() {
  const draft = qualidadeDraft;
  draft.projectId = qVal("qPqoObra");
  draft.versao = qVal("qPqoVersao") || "1.0";
  draft.responsavelTecnico = qVal("qPqoResponsavel");
  draft.crea = qVal("qPqoCrea");
  draft.dataInicioPrevisto = qVal("qPqoInicio");
  draft.dataFimPrevisto = qVal("qPqoFim");
  draft.escopo = qVal("qPqoEscopo");
  draft.metasQualidade = qVal("qPqoMetas");
  draft.status = qVal("qPqoStatus") || "Rascunho";
  draft.aprovadoPor = qVal("qPqoAprovadoPor");
  draft.dataAprovacao = qVal("qPqoDataAprovacao");
  draft.servicos = [...qs("content").querySelectorAll("[data-q-servico]:checked")].map((c) => Number(c.dataset.qServico));
  draft.materiais = [...qs("content").querySelectorAll("[data-q-material-row]")].map((tr) => ({
    nome: tr.querySelector("[data-q-mat-nome]").value.trim(),
    especificacao: tr.querySelector("[data-q-mat-espec]").value.trim(),
    norma: tr.querySelector("[data-q-mat-norma]").value.trim(),
  })).filter((m) => m.nome);
  return draft;
}

function renderQualidadePqo() {
  const key = "qualidadePqo";
  const editable = canEditModule(key);
  const rows = qrows(key);
  const editing = qualidadeEdit?.key === key;
  if (editing && !qualidadeDraft) qualidadeDraft = qPqoDraft(qualidadeEdit.id ? byId(key, qualidadeEdit.id) : null);
  const draft = qualidadeDraft;
  const grupos = {};
  SERVICOS_SIAC.forEach((s) => (grupos[s.grupo] = grupos[s.grupo] || []).push(s));
  const formHtml = editing ? `
    <section class="panel import-panel">
      <h3>${draft.id ? "Editar PQO" : "Gerar PQO"}</h3>
      <div class="form-grid">
        <label>Obra${qObraSelectHtml("qPqoObra", draft.projectId)}</label>
        <label>Versão<input id="qPqoVersao" value="${svgText(draft.versao)}"></label>
        <label>Responsável técnico<input id="qPqoResponsavel" value="${svgText(draft.responsavelTecnico)}"></label>
        <label>CREA<input id="qPqoCrea" value="${svgText(draft.crea)}"></label>
        <label>Início previsto<input id="qPqoInicio" type="date" value="${svgText(draft.dataInicioPrevisto)}"></label>
        <label>Fim previsto<input id="qPqoFim" type="date" value="${svgText(draft.dataFimPrevisto)}"></label>
        <label>Status<select id="qPqoStatus">${["Rascunho", "Vigente", "Encerrado"].map((s) => `<option ${draft.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label>Aprovado por<input id="qPqoAprovadoPor" value="${svgText(draft.aprovadoPor)}"></label>
        <label>Data de aprovação<input id="qPqoDataAprovacao" type="date" value="${svgText(draft.dataAprovacao)}"></label>
        <label class="full">Escopo<textarea id="qPqoEscopo" rows="3">${svgText(draft.escopo)}</textarea></label>
        <label class="full">Metas da qualidade<textarea id="qPqoMetas" rows="2">${svgText(draft.metasQualidade)}</textarea></label>
      </div>
      <fieldset class="q-fieldset">
        <legend>Serviços controlados (mín. ${QUALIDADE_METAS.servicos} para o Nível B) — <span id="qPqoContadorServicos"></span></legend>
        ${Object.entries(grupos).map(([grupo, list]) => `
          <div class="q-servico-grupo"><strong>${svgText(grupo)}</strong>
            ${list.map((s) => {
              const pes = qPesVigente(s.id);
              return `<label class="q-check"><input type="checkbox" data-q-servico="${s.id}" ${draft.servicos.includes(s.id) ? "checked" : ""}> ${s.id} — ${svgText(s.nome)} ${pes ? qBadge(`PES v${pes.versao}`, "ok") : qBadge("Sem PES vigente — crie antes de usar", "atencao")}</label>`;
            }).join("")}
          </div>`).join("")}
      </fieldset>
      <fieldset class="q-fieldset">
        <legend>Materiais controlados (mín. ${QUALIDADE_METAS.materiais} para o Nível B) — <span id="qPqoContadorMateriais"></span></legend>
        <table class="q-mat-table"><thead><tr><th>Material</th><th>Especificação</th><th>Norma</th><th></th></tr></thead>
          <tbody>${(draft.materiais.length ? draft.materiais : [{}]).map((m, i) => `
            <tr data-q-material-row>
              <td><input data-q-mat-nome value="${svgText(m.nome || "")}"></td>
              <td><input data-q-mat-espec value="${svgText(m.especificacao || "")}"></td>
              <td><input data-q-mat-norma value="${svgText(m.norma || "")}"></td>
              <td><button class="secondary" type="button" data-q-mat-remove="${i}">×</button></td>
            </tr>`).join("")}
          </tbody>
        </table>
        <button class="secondary" type="button" id="qPqoAddMaterial">+ Adicionar material</button>
      </fieldset>
      <div class="actions">
        <button class="primary" type="button" id="qPqoSalvar">Salvar PQO</button>
        <button class="secondary" type="button" id="qFormCancelar">Cancelar</button>
      </div>
    </section>` : "";
  const listRows = rows.map((r) => ({
    ...r,
    servicosQtd: `${qjson(r.servicosControlados, []).length}/27`,
    materiaisQtd: String(qjson(r.materiaisControlados, []).length),
  }));
  qs("content").innerHTML = `
    ${qualidadeHead(key, "Plano da Qualidade da Obra (PQO)", "Um plano por obra (SiAC 8.1.1) com os serviços e materiais controlados. As FVS só podem ser abertas para serviços incluídos no PQO da obra.")}
    ${formHtml}
    ${table("Planos da Qualidade", listRows, ["projectId", "versao", "responsavelTecnico", "servicosQtd", "materiaisQtd", "status"], editable, key)}
    ${rows.length ? `<section class="panel"><div class="actions">${rows.map((r) => `<button class="secondary" type="button" data-q-print-pqo="${r.id}">🖨️ PQO — ${svgText(byId("projects", r.projectId)?.name || r.projectId)}</button>`).join("")}</div></section>` : ""}
  `;
  qWire(key);
  const atualizarContadores = () => {
    const marcados = qs("content").querySelectorAll("[data-q-servico]:checked").length;
    const materiais = [...qs("content").querySelectorAll("[data-q-mat-nome]")].filter((i) => i.value.trim()).length;
    const elS = qs("qPqoContadorServicos");
    const elM = qs("qPqoContadorMateriais");
    if (elS) elS.innerHTML = `${marcados} de 27 selecionados ${marcados >= QUALIDADE_METAS.servicos ? qBadge("Meta OK", "ok") : qBadge(`Faltam ${QUALIDADE_METAS.servicos - marcados}`, "atencao")}`;
    if (elM) elM.innerHTML = `${materiais} informado(s) ${materiais >= QUALIDADE_METAS.materiais ? qBadge("Meta OK", "ok") : qBadge(`Faltam ${QUALIDADE_METAS.materiais - materiais}`, "atencao")}`;
  };
  if (editing) {
    atualizarContadores();
    qs("content").querySelectorAll("[data-q-servico]").forEach((c) => c.addEventListener("change", atualizarContadores));
    qs("content").querySelectorAll("[data-q-mat-nome]").forEach((i) => i.addEventListener("input", atualizarContadores));
    qs("qPqoAddMaterial")?.addEventListener("click", () => {
      qPqoCollect().materiais.push({ nome: "", especificacao: "", norma: "" });
      render();
    });
    qs("content").querySelectorAll("[data-q-mat-remove]").forEach((b) => b.addEventListener("click", () => {
      qPqoCollect();
      qualidadeDraft.materiais.splice(Number(b.dataset.qMatRemove), 1);
      render();
    }));
    qs("qPqoSalvar")?.addEventListener("click", async () => {
      const draftFinal = qPqoCollect();
      if (!draftFinal.projectId) return alert("Selecione a obra.");
      if (!draftFinal.id && qPqoDaObra(draftFinal.projectId)) return alert("Esta obra já possui PQO — edite o existente.");
      if (draftFinal.status === "Vigente") {
        if (!draftFinal.responsavelTecnico) return alert("Informe o responsável técnico para tornar o PQO vigente.");
        if (draftFinal.servicos.length < QUALIDADE_METAS.servicos) return alert(`Selecione ao menos ${QUALIDADE_METAS.servicos} serviços controlados (Nível B).`);
        if (draftFinal.materiais.length < QUALIDADE_METAS.materiais) return alert(`Informe ao menos ${QUALIDADE_METAS.materiais} materiais controlados (Nível B).`);
      }
      await qSalvar(key, {
        projectId: draftFinal.projectId,
        versao: draftFinal.versao,
        responsavelTecnico: draftFinal.responsavelTecnico,
        crea: draftFinal.crea,
        dataInicioPrevisto: draftFinal.dataInicioPrevisto || null,
        dataFimPrevisto: draftFinal.dataFimPrevisto || null,
        escopo: draftFinal.escopo,
        servicosControlados: JSON.stringify(draftFinal.servicos),
        materiaisControlados: JSON.stringify(draftFinal.materiais),
        metasQualidade: draftFinal.metasQualidade,
        status: draftFinal.status,
        dataAprovacao: draftFinal.dataAprovacao || null,
        aprovadoPor: draftFinal.aprovadoPor,
      }, draftFinal.id);
    });
  }
  qs("content").querySelectorAll("[data-q-print-pqo]").forEach((b) => b.addEventListener("click", () => {
    const pqo = byId(key, b.dataset.qPrintPqo);
    if (!pqo) return;
    const servicos = qjson(pqo.servicosControlados, []);
    const materiais = qjson(pqo.materiaisControlados, []);
    qualidadePrint(`
      <h1>Plano da Qualidade da Obra — v${svgText(pqo.versao)}</h1>
      <p class="q-print-sub">Obra: ${svgText(byId("projects", pqo.projectId)?.name || "")} — PBQP-H SiAC Nível B</p>
      <p><strong>Responsável técnico:</strong> ${svgText(pqo.responsavelTecnico || "—")} (CREA ${svgText(pqo.crea || "—")}) — <strong>Período:</strong> ${svgText(pqo.dataInicioPrevisto || "—")} a ${svgText(pqo.dataFimPrevisto || "—")}</p>
      <h2>Escopo</h2><div class="q-print-body">${svgText(pqo.escopo || "—").replaceAll("\n", "<br>")}</div>
      <h2>Serviços controlados (${servicos.length}/27)</h2>
      <ol>${servicos.map((idS) => `<li>${svgText(`${idS} — ${servicoSiac(idS)?.nome || ""}`)}${qPesVigente(idS) ? ` (PES v${svgText(qPesVigente(idS).versao)})` : " (sem PES vigente)"}</li>`).join("")}</ol>
      <h2>Materiais controlados (${materiais.length})</h2>
      <table border="1" cellspacing="0" cellpadding="6" width="100%"><tr><th>Material</th><th>Especificação</th><th>Norma</th></tr>
        ${materiais.map((m) => `<tr><td>${svgText(m.nome || "")}</td><td>${svgText(m.especificacao || "")}</td><td>${svgText(m.norma || "")}</td></tr>`).join("")}
      </table>
      <h2>Metas da qualidade</h2><div class="q-print-body">${svgText(pqo.metasQualidade || "—").replaceAll("\n", "<br>")}</div>
      <p>Aprovado por: ${svgText(pqo.aprovadoPor || "____________")} — Data: ${svgText(pqo.dataAprovacao || "____/____/____")}</p>
    `);
  }));
}

// ── FVS / FVM — fichas de verificação ───────────────────────────────────────

function qChecklistHtml(itens, { editableLabels = false } = {}) {
  return `
    <table class="q-mat-table q-checklist"><thead><tr><th>Item de verificação</th><th>Avaliação</th><th>Observação</th></tr></thead><tbody>
      ${itens.map((item, i) => `
        <tr data-q-check-row>
          <td>${editableLabels ? `<input data-q-check-label value="${svgText(item.item || "")}">` : `<span data-q-check-fixed="${svgText(item.item || "")}">${svgText(item.item || "")}</span>`}</td>
          <td class="q-radio-group">
            <label><input type="radio" name="qCheck${i}" value="sim" ${item.conforme === "sim" ? "checked" : ""}> ✅ Conforme</label>
            <label><input type="radio" name="qCheck${i}" value="nao" ${item.conforme === "nao" ? "checked" : ""}> ❌ Não conforme</label>
            <label><input type="radio" name="qCheck${i}" value="na" ${item.conforme === "na" ? "checked" : ""}> N/A</label>
          </td>
          <td><input data-q-check-obs value="${svgText(item.observacao || "")}"></td>
        </tr>`).join("")}
    </tbody></table>`;
}

function qChecklistCollect() {
  return [...qs("content").querySelectorAll("[data-q-check-row]")].map((tr, i) => ({
    item: tr.querySelector("[data-q-check-label]")?.value.trim() ?? tr.querySelector("[data-q-check-fixed]")?.dataset.qCheckFixed ?? "",
    conforme: tr.querySelector(`input[name="qCheck${i}"]:checked`)?.value || "",
    observacao: tr.querySelector("[data-q-check-obs]")?.value.trim() || "",
  })).filter((item) => item.item);
}

function qFvsDraft(row) {
  return {
    id: row?.id || null,
    projectId: row?.projectId || "",
    servicoSiacId: row?.servicoSiacId || "",
    etapaId: row?.etapaId || "",
    pesId: row?.pesId || null,
    dataExecucao: row?.dataExecucao || qHoje(),
    localObra: row?.localObra || "",
    responsavelExecucao: row?.responsavelExecucao || "",
    responsavelInspecao: row?.responsavelInspecao || "",
    itens: qjson(row?.itensVerificacao, []),
    resultado: row?.resultado || "",
    observacoes: row?.observacoes || "",
    acaoCorretiva: row?.acaoCorretiva || "",
    dataInspecao: row?.dataInspecao || "",
    assinaturaExecutor: row?.assinaturaExecutor || "",
    assinaturaInspetor: row?.assinaturaInspetor || "",
  };
}

function qFvsCollectCampos() {
  const draft = qualidadeDraft;
  draft.dataExecucao = qVal("qFvsDataExec");
  draft.localObra = qVal("qFvsLocal");
  draft.responsavelExecucao = qVal("qFvsRespExec");
  draft.responsavelInspecao = qVal("qFvsRespInsp");
  draft.resultado = qVal("qFvsResultado");
  draft.observacoes = qVal("qFvsObservacoes");
  draft.acaoCorretiva = qVal("qFvsAcaoCorretiva");
  draft.dataInspecao = qVal("qFvsDataInsp");
  draft.assinaturaExecutor = qVal("qFvsAssExec");
  draft.assinaturaInspetor = qVal("qFvsAssInsp");
  draft.itens = qChecklistCollect();
  return draft;
}

function renderQualidadeFvs() {
  const key = "qualidadeFvs";
  const editable = canEditModule(key);
  const editing = qualidadeEdit?.key === key;
  if (editing && !qualidadeDraft) qualidadeDraft = qFvsDraft(qualidadeEdit.id ? byId(key, qualidadeEdit.id) : null);
  const draft = qualidadeDraft;
  const rows = qrows(key).filter((r) => !qualidadeObraFiltro || sameId(r.projectId, qualidadeObraFiltro));
  const pqo = editing && draft.projectId ? qPqoDaObra(draft.projectId) : null;
  const servicosPqo = pqo ? qjson(pqo.servicosControlados, []) : null;
  const etapas = editing && draft.projectId ? (db.projectSchedule || []).filter((e) => sameId(e.projectId, draft.projectId)) : [];
  const pesVigente = editing && draft.servicoSiacId ? qPesVigente(draft.servicoSiacId) : null;
  const temNaoConforme = editing && draft.itens.some((i) => i.conforme === "nao");
  const formHtml = editing ? `
    <section class="panel import-panel">
      <h3>${draft.id ? "Editar FVS" : "Nova FVS"}</h3>
      <div class="form-grid">
        <label>Obra (com PQO)${qObraSelectHtml("qFvsObra", draft.projectId, { onlyWithPqo: true })}</label>
        <label>Serviço (do PQO da obra)${qServicoSelectHtml("qFvsServico", draft.servicoSiacId, servicosPqo)}</label>
        <label>Etapa do cronograma (recomendado)<select id="qFvsEtapa"><option value="">Sem vínculo</option>${etapas.map((e) => `<option value="${e.id}" ${sameId(e.id, draft.etapaId) ? "selected" : ""}>${svgText(e.stageName)}</option>`).join("")}</select></label>
        <label>PES utilizado<input value="${pesVigente ? svgText(`v${pesVigente.versao} — ${pesVigente.servicoNome}`) : "Sem PES vigente para o serviço"}" disabled></label>
        <label>Data de execução<input id="qFvsDataExec" type="date" value="${svgText(draft.dataExecucao)}"></label>
        <label>Data de inspeção<input id="qFvsDataInsp" type="date" value="${svgText(draft.dataInspecao)}"></label>
        <label>Local na obra<input id="qFvsLocal" value="${svgText(draft.localObra)}" placeholder="Bloco A — 2º pav."></label>
        <label>Responsável pela execução<input id="qFvsRespExec" value="${svgText(draft.responsavelExecucao)}"></label>
        <label>Responsável pela inspeção<input id="qFvsRespInsp" value="${svgText(draft.responsavelInspecao)}"></label>
      </div>
      ${draft.servicoSiacId && !pesVigente ? `<p class="field-hint">⚠️ Sem PES vigente para este serviço — crie o PES antes: os critérios de aceitação geram os itens abaixo.</p>` : ""}
      ${draft.itens.length ? qChecklistHtml(draft.itens) : '<div class="empty">Selecione o serviço para gerar os itens de verificação a partir do PES vigente.</div>'}
      <div class="form-grid">
        <label>Resultado ${temNaoConforme ? qBadge("Há item não conforme — sugerido Reprovado", "ruim") : ""}<select id="qFvsResultado">${["", "Aprovado", "Aprovado com ressalvas", "Reprovado"].map((r) => `<option value="${r}" ${(temNaoConforme && !draft.resultado ? "Reprovado" : draft.resultado) === r ? "selected" : ""}>${r || "Em preenchimento"}</option>`).join("")}</select></label>
        <label>Assinatura do executor (obrigatória)<input id="qFvsAssExec" value="${svgText(draft.assinaturaExecutor)}"></label>
        <label>Assinatura do inspetor (obrigatória)<input id="qFvsAssInsp" value="${svgText(draft.assinaturaInspetor)}"></label>
        <label class="full">Observações<textarea id="qFvsObservacoes" rows="2">${svgText(draft.observacoes)}</textarea></label>
        <label class="full">Ação corretiva (se reprovada)<textarea id="qFvsAcaoCorretiva" rows="2">${svgText(draft.acaoCorretiva)}</textarea></label>
      </div>
      <div class="actions">
        <button class="primary" type="button" id="qFvsSalvar">Salvar FVS</button>
        <button class="secondary" type="button" id="qFormCancelar">Cancelar</button>
      </div>
    </section>` : "";
  const listRows = rows.map((r) => ({ ...r, servico: `${r.servicoSiacId} — ${r.servicoNome}`, treinamento: qTemTreinamento(r.projectId, r.servicoSiacId) ? "✅" : "⚠️ Sem treinamento" }));
  qs("content").innerHTML = `
    ${qualidadeHead(key, "Fichas de Verificação de Serviço (FVS)", "Itens gerados automaticamente dos critérios de aceitação do PES vigente. FVS reprovada abre NC automaticamente; FVS aprovada desbloqueia a etapa vinculada do cronograma.")}
    <section class="schedule-toolbar"><label>Obra ${qObraSelectHtml("qFiltroObraQualidade", qualidadeObraFiltro, { optional: true })}</label></section>
    ${formHtml}
    ${table("FVS registradas", listRows, ["projectId", "servico", "localObra", "dataExecucao", "responsavelInspecao", "treinamento", "resultado", "status"], editable, key)}
  `;
  qWire(key);
  if (!editing) return;
  qs("qFvsObra")?.addEventListener("change", (event) => {
    qFvsCollectCampos();
    qualidadeDraft.projectId = event.target.value;
    qualidadeDraft.servicoSiacId = "";
    qualidadeDraft.etapaId = "";
    qualidadeDraft.itens = [];
    render();
  });
  qs("qFvsServico")?.addEventListener("change", (event) => {
    qFvsCollectCampos();
    qualidadeDraft.servicoSiacId = event.target.value;
    const pes = qPesVigente(event.target.value);
    qualidadeDraft.pesId = pes?.id || null;
    qualidadeDraft.itens = pes
      ? String(pes.criteriosAceitacao || "").split("\n").map((l) => l.trim()).filter(Boolean).map((item) => ({ item, conforme: "", observacao: "" }))
      : [];
    render();
  });
  qs("qFvsEtapa")?.addEventListener("change", (event) => {
    qualidadeDraft.etapaId = event.target.value;
  });
  qs("qFvsSalvar")?.addEventListener("click", async () => {
    const d = qFvsCollectCampos();
    if (!d.projectId) return alert("Selecione a obra (apenas obras com PQO).");
    const servico = servicoSiac(d.servicoSiacId);
    if (!servico) return alert("Selecione o serviço.");
    if (!d.itens.length) return alert("A FVS precisa dos itens de verificação (crie o PES vigente do serviço).");
    if (d.itens.some((i) => i.conforme === "nao") && d.resultado !== "Reprovado") {
      if (!confirm("Há item não conforme — o resultado sugerido é Reprovado. Salvar mesmo assim com o resultado escolhido?")) return;
    }
    if (d.resultado && (!d.assinaturaExecutor || !d.assinaturaInspetor)) return alert("As duas assinaturas são obrigatórias para concluir a FVS.");
    const status = d.resultado === "Reprovado" ? "Reprovada" : d.resultado ? "Aprovada" : d.itens.some((i) => i.conforme) ? "Preenchida" : "Pendente";
    await qSalvar(key, {
      pqoId: qPqoDaObra(d.projectId)?.id || null,
      projectId: d.projectId,
      etapaId: d.etapaId || null,
      pesId: d.pesId,
      servicoSiacId: Number(d.servicoSiacId),
      servicoNome: servico.nome,
      dataExecucao: d.dataExecucao || null,
      localObra: d.localObra,
      responsavelExecucao: d.responsavelExecucao,
      responsavelInspecao: d.responsavelInspecao,
      itensVerificacao: JSON.stringify(d.itens),
      resultado: d.resultado || null,
      observacoes: d.observacoes,
      acaoCorretiva: d.acaoCorretiva,
      dataInspecao: d.dataInspecao || null,
      assinaturaExecutor: d.assinaturaExecutor,
      assinaturaInspetor: d.assinaturaInspetor,
      status,
    }, d.id);
  });
}

function qFvmDraft(row) {
  return {
    id: row?.id || null,
    projectId: row?.projectId || "",
    materialNome: row?.materialNome || "",
    materialCodigo: row?.materialCodigo || "",
    fornecedor: row?.fornecedor || "",
    notaFiscal: row?.notaFiscal || "",
    quantidade: row?.quantidade || "",
    unidade: row?.unidade || "",
    dataRecebimento: row?.dataRecebimento || qHoje(),
    responsavelRecebimento: row?.responsavelRecebimento || "",
    itens: qjson(row?.itensVerificacao, FVM_CHECKLIST_PADRAO.map((item) => ({ item, conforme: "", observacao: "" }))),
    resultado: row?.resultado || "",
    observacoes: row?.observacoes || "",
  };
}

function renderQualidadeFvm() {
  const key = "qualidadeFvm";
  const editable = canEditModule(key);
  const editing = qualidadeEdit?.key === key;
  if (editing && !qualidadeDraft) qualidadeDraft = qFvmDraft(qualidadeEdit.id ? byId(key, qualidadeEdit.id) : null);
  const draft = qualidadeDraft;
  const rows = qrows(key).filter((r) => !qualidadeObraFiltro || sameId(r.projectId, qualidadeObraFiltro));
  const temNaoConforme = editing && draft.itens.some((i) => i.conforme === "nao");
  const formHtml = editing ? `
    <section class="panel import-panel">
      <h3>${draft.id ? "Editar FVM" : "Nova FVM"}</h3>
      <div class="form-grid">
        <label>Obra${qObraSelectHtml("qFvmObra", draft.projectId)}</label>
        <label>Material<input id="qFvmMaterial" value="${svgText(draft.materialNome)}"></label>
        <label>Código<input id="qFvmCodigo" value="${svgText(draft.materialCodigo)}"></label>
        <label>Fornecedor<input id="qFvmFornecedor" value="${svgText(draft.fornecedor)}"></label>
        <label>Nota fiscal<input id="qFvmNf" value="${svgText(draft.notaFiscal)}"></label>
        <label>Quantidade<input id="qFvmQtd" type="number" step="0.001" value="${svgText(String(draft.quantidade || ""))}"></label>
        <label>Unidade<input id="qFvmUnidade" value="${svgText(draft.unidade)}"></label>
        <label>Data de recebimento<input id="qFvmData" type="date" value="${svgText(draft.dataRecebimento)}"></label>
        <label>Responsável pelo recebimento<input id="qFvmResponsavel" value="${svgText(draft.responsavelRecebimento)}"></label>
      </div>
      ${qChecklistHtml(draft.itens, { editableLabels: true })}
      <button class="secondary" type="button" id="qFvmAddItem">+ Item personalizado para este material</button>
      <div class="form-grid">
        <label>Resultado ${temNaoConforme ? qBadge("Há item não conforme — sugerido Reprovado", "ruim") : ""}<select id="qFvmResultado">${["", "Aprovado", "Aprovado com ressalvas", "Reprovado"].map((r) => `<option value="${r}" ${(temNaoConforme && !draft.resultado ? "Reprovado" : draft.resultado) === r ? "selected" : ""}>${r || "Em preenchimento"}</option>`).join("")}</select></label>
        <label class="full">Observações<textarea id="qFvmObservacoes" rows="2">${svgText(draft.observacoes)}</textarea></label>
      </div>
      <div class="actions">
        <button class="primary" type="button" id="qFvmSalvar">Salvar FVM</button>
        <button class="secondary" type="button" id="qFormCancelar">Cancelar</button>
      </div>
    </section>` : "";
  qs("content").innerHTML = `
    ${qualidadeHead(key, "Fichas de Verificação de Material (FVM)", "Checklist padrão de recebimento com itens personalizáveis por material. FVM reprovada abre NC automaticamente com origem FVM.")}
    <section class="schedule-toolbar"><label>Obra ${qObraSelectHtml("qFiltroObraQualidade", qualidadeObraFiltro, { optional: true })}</label></section>
    ${formHtml}
    ${table("FVM registradas", rows, ["projectId", "materialNome", "fornecedor", "notaFiscal", "quantidade", "unidade", "dataRecebimento", "resultado", "status"], editable, key)}
  `;
  qWire(key);
  if (!editing) return;
  const collect = () => {
    const d = qualidadeDraft;
    d.projectId = qVal("qFvmObra");
    d.materialNome = qVal("qFvmMaterial");
    d.materialCodigo = qVal("qFvmCodigo");
    d.fornecedor = qVal("qFvmFornecedor");
    d.notaFiscal = qVal("qFvmNf");
    d.quantidade = qVal("qFvmQtd");
    d.unidade = qVal("qFvmUnidade");
    d.dataRecebimento = qVal("qFvmData");
    d.responsavelRecebimento = qVal("qFvmResponsavel");
    d.resultado = qVal("qFvmResultado");
    d.observacoes = qVal("qFvmObservacoes");
    d.itens = qChecklistCollect();
    return d;
  };
  qs("qFvmAddItem")?.addEventListener("click", () => {
    collect().itens.push({ item: "Novo item de verificação", conforme: "", observacao: "" });
    render();
  });
  qs("qFvmSalvar")?.addEventListener("click", async () => {
    const d = collect();
    if (!d.projectId) return alert("Selecione a obra.");
    if (!d.materialNome) return alert("Informe o material.");
    const status = d.resultado === "Reprovado" ? "Reprovada" : d.resultado ? "Aprovada" : "Pendente";
    await qSalvar(key, {
      pqoId: qPqoDaObra(d.projectId)?.id || null,
      projectId: d.projectId,
      materialNome: d.materialNome,
      materialCodigo: d.materialCodigo,
      fornecedor: d.fornecedor,
      notaFiscal: d.notaFiscal,
      quantidade: d.quantidade ? Number(d.quantidade) : null,
      unidade: d.unidade,
      dataRecebimento: d.dataRecebimento || null,
      responsavelRecebimento: d.responsavelRecebimento,
      itensVerificacao: JSON.stringify(d.itens),
      resultado: d.resultado || null,
      observacoes: d.observacoes,
      status,
    }, d.id);
  });
}

// ── NC — Não Conformidades ───────────────────────────────────────────────────

function renderQualidadeNc() {
  const key = "qualidadeNc";
  const editable = canEditModule(key);
  const editing = qualidadeEdit?.key === key;
  const row = editing && qualidadeEdit.id ? byId(key, qualidadeEdit.id) || {} : {};
  const hoje = qHoje();
  const todas = qrows(key);
  const rows = todas.filter((r) => !qualidadeObraFiltro || sameId(r.projectId, qualidadeObraFiltro));
  const abertas = rows.filter((n) => n.status === "Aberta").length;
  const emAndamento = rows.filter((n) => n.status === "Em andamento").length;
  const vencidas = rows.filter((n) => n.status !== "Fechada" && n.prazoAcao && n.prazoAcao < hoje).length;
  const fechadasMes = rows.filter((n) => n.status === "Fechada" && (n.dataVerificacao || n.dataAcao || "").slice(0, 7) === hoje.slice(0, 7)).length;
  const formHtml = editing ? `
    <section class="panel import-panel">
      <h3>${qualidadeEdit.id ? `Editar ${row.numero || "NC"}` : "Nova Não Conformidade"}</h3>
      <div class="form-grid">
        <label>Número<input value="${svgText(row.numero || "Gerado automaticamente (NC-ANO-SEQ)")}" disabled></label>
        <label>Obra${qObraSelectHtml("qNcObra", row.projectId)}</label>
        <label>Origem<select id="qNcOrigem">${["Manual", "FVS", "FVM", "Auditoria"].map((o) => `<option ${(row.origem || "Manual") === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
        <label>Grau<select id="qNcGrau">${["Menor", "Maior", "Critica"].map((g) => `<option ${(row.grau || "Menor") === g ? "selected" : ""}>${g}</option>`).join("")}</select></label>
        <label>Serviço relacionado${qServicoSelectHtml("qNcServico", row.servicoSiacId)}</label>
        <label>Local na obra<input id="qNcLocal" value="${svgText(row.localObra || "")}"></label>
        <label>Detectada por<input id="qNcDeteccao" value="${svgText(row.responsavelDeteccao || "")}"></label>
        <label>Data de detecção<input id="qNcDataDeteccao" type="date" value="${svgText(row.dataDeteccao || hoje)}"></label>
        <label>Prazo da ação<input id="qNcPrazo" type="date" value="${svgText(row.prazoAcao || "")}"></label>
        <label>Status<select id="qNcStatus">${["Aberta", "Em andamento", "Verificando", "Fechada"].map((s) => `<option ${(row.status || "Aberta") === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label class="full">Descrição da NC<textarea id="qNcDescricao" rows="3">${svgText(row.descricaoNC || "")}</textarea></label>
        <label class="full">Ação corretiva<textarea id="qNcAcao" rows="2">${svgText(row.acaoCorretiva || "")}</textarea></label>
        <label>Responsável pela ação<input id="qNcRespAcao" value="${svgText(row.responsavelAcao || "")}"></label>
        <label>Data da ação<input id="qNcDataAcao" type="date" value="${svgText(row.dataAcao || "")}"></label>
        <label class="full">Verificação de eficácia — como confirmar que resolveu<textarea id="qNcEficacia" rows="2">${svgText(row.verificacaoEficacia || "")}</textarea></label>
        <label>Responsável pela verificação<input id="qNcRespVerif" value="${svgText(row.responsavelVerificacao || "")}"></label>
        <label>Data da verificação<input id="qNcDataVerif" type="date" value="${svgText(row.dataVerificacao || "")}"></label>
      </div>
      <div class="actions">
        <button class="primary" type="button" id="qNcSalvar">Salvar NC</button>
        <button class="secondary" type="button" id="qFormCancelar">Cancelar</button>
      </div>
    </section>` : "";
  const listRows = rows.map((r) => ({ ...r, prazo: r.prazoAcao ? (r.status === "Fechada" ? r.prazoAcao : r.prazoAcao < hoje ? `🔴 ${r.prazoAcao}` : r.prazoAcao <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) ? `🟡 ${r.prazoAcao}` : `🟢 ${r.prazoAcao}`) : "—" }));
  qs("content").innerHTML = `
    ${qualidadeHead(key, "Não Conformidades (NC)", "Registro e tratamento de NCs (SiAC 8.7 e 10.2). NC fechada vinculada a FVS aprovada desbloqueia a etapa do cronograma automaticamente.")}
    <section class="q-kpis">
      ${qKpiCard("Abertas", String(abertas), "Aguardando plano de ação", abertas ? "atencao" : "ok")}
      ${qKpiCard("Em andamento", String(emAndamento), "Ação corretiva em execução", "neutro")}
      ${qKpiCard("Vencidas", String(vencidas), "Prazo de ação estourado", vencidas ? "ruim" : "ok")}
      ${qKpiCard("Fechadas no mês", String(fechadasMes), "Eficácia verificada", "ok")}
    </section>
    <section class="schedule-toolbar"><label>Obra ${qObraSelectHtml("qFiltroObraQualidade", qualidadeObraFiltro, { optional: true })}</label></section>
    ${formHtml}
    ${table("Não conformidades", listRows, ["numero", "projectId", "origem", "servicoNome", "grau", "dataDeteccao", "prazo", "status"], editable, key)}
  `;
  qWire(key);
  qs("qNcSalvar")?.addEventListener("click", async () => {
    const projectId = qVal("qNcObra");
    if (!projectId) return alert("Selecione a obra.");
    const descricao = qVal("qNcDescricao");
    if (!descricao) return alert("Descreva a não conformidade.");
    const servico = servicoSiac(qVal("qNcServico"));
    await qSalvar(key, {
      projectId,
      pqoId: qPqoDaObra(projectId)?.id || null,
      numero: row.numero || "",
      origem: qVal("qNcOrigem") || "Manual",
      descricaoNC: descricao,
      servicoSiacId: servico?.id || null,
      servicoNome: servico?.nome || null,
      localObra: qVal("qNcLocal"),
      grau: qVal("qNcGrau") || "Menor",
      responsavelDeteccao: qVal("qNcDeteccao"),
      dataDeteccao: qVal("qNcDataDeteccao") || qHoje(),
      prazoAcao: qVal("qNcPrazo") || null,
      acaoCorretiva: qVal("qNcAcao"),
      responsavelAcao: qVal("qNcRespAcao"),
      dataAcao: qVal("qNcDataAcao") || null,
      verificacaoEficacia: qVal("qNcEficacia"),
      responsavelVerificacao: qVal("qNcRespVerif"),
      dataVerificacao: qVal("qNcDataVerif") || null,
      status: qVal("qNcStatus") || "Aberta",
    }, qualidadeEdit?.id || null);
  });
}

// ── Treinamentos ─────────────────────────────────────────────────────────────

function renderQualidadeTreinamentos() {
  const key = "qualidadeTreinamentos";
  const editable = canEditModule(key);
  const editing = qualidadeEdit?.key === key;
  const row = editing && qualidadeEdit.id ? byId(key, qualidadeEdit.id) || {} : {};
  const rows = qrows(key).filter((r) => !qualidadeObraFiltro || sameId(r.projectId, qualidadeObraFiltro));
  const formHtml = editing ? `
    <section class="panel import-panel">
      <h3>${qualidadeEdit.id ? "Editar treinamento" : "Novo treinamento"}</h3>
      <div class="form-grid">
        <label>Obra${qObraSelectHtml("qTreinoObra", row.projectId)}</label>
        <label>Serviço SiAC${qServicoSelectHtml("qTreinoServico", row.servicoSiacId)}</label>
        <label>Data<input id="qTreinoData" type="date" value="${svgText(row.dataTreinamento || qHoje())}"></label>
        <label>Instrutor<input id="qTreinoInstrutor" value="${svgText(row.instrutor || "")}"></label>
        <label>Carga horária (h)<input id="qTreinoCarga" type="number" step="0.5" value="${svgText(String(row.cargaHoraria || ""))}"></label>
        <label class="full">Participantes<textarea id="qTreinoParticipantes" rows="2">${svgText(row.participantes || "")}</textarea></label>
        <label class="full">Conteúdo<textarea id="qTreinoConteudo" rows="2">${svgText(row.conteudo || "")}</textarea></label>
        <label class="full">Observações<textarea id="qTreinoObs" rows="2">${svgText(row.observacoes || "")}</textarea></label>
      </div>
      <div class="actions">
        <button class="primary" type="button" id="qTreinoSalvar">Salvar</button>
        <button class="secondary" type="button" id="qFormCancelar">Cancelar</button>
      </div>
    </section>` : "";
  qs("content").innerHTML = `
    ${qualidadeHead(key, "Treinamentos", "Registro de treinamentos da equipe por obra e serviço SiAC (cláusulas 7.2 e 7.3). FVS e PQO indicam serviços sem treinamento registrado.")}
    <section class="schedule-toolbar"><label>Obra ${qObraSelectHtml("qFiltroObraQualidade", qualidadeObraFiltro, { optional: true })}</label></section>
    ${formHtml}
    ${table("Treinamentos registrados", rows, ["projectId", "servicoNome", "dataTreinamento", "instrutor", "cargaHoraria"], editable, key)}
  `;
  qWire(key);
  qs("qTreinoSalvar")?.addEventListener("click", async () => {
    const projectId = qVal("qTreinoObra");
    const servico = servicoSiac(qVal("qTreinoServico"));
    if (!projectId || !servico) return alert("Selecione a obra e o serviço.");
    await qSalvar(key, {
      projectId,
      pqoId: qPqoDaObra(projectId)?.id || null,
      servicoSiacId: servico.id,
      servicoNome: servico.nome,
      dataTreinamento: qVal("qTreinoData") || qHoje(),
      instrutor: qVal("qTreinoInstrutor"),
      participantes: qVal("qTreinoParticipantes"),
      conteudo: qVal("qTreinoConteudo"),
      cargaHoraria: qVal("qTreinoCarga") ? Number(qVal("qTreinoCarga")) : null,
      observacoes: qVal("qTreinoObs"),
    }, qualidadeEdit?.id || null);
  });
}

// ── Auditorias internas SiAC ─────────────────────────────────────────────────

function renderQualidadeAuditorias() {
  const key = "qualidadeAuditorias";
  const editable = canEditModule(key);
  const editing = qualidadeEdit?.key === key;
  const row = editing && qualidadeEdit.id ? byId(key, qualidadeEdit.id) || {} : {};
  const itens = editing
    ? (qjson(row.checklistSiac, null) || CHECKLIST_SIAC_NIVEL_B.map((c) => ({ ...c, resultado: "", observacao: "" })))
    : [];
  const rows = qrows(key);
  const formHtml = editing ? `
    <section class="panel import-panel">
      <h3>${qualidadeEdit.id ? "Editar auditoria" : "Nova auditoria interna"}</h3>
      <div class="form-grid">
        <label>Tipo<select id="qAudTipo">${["Obra", "Corporativa"].map((t) => `<option ${(row.tipo || "Obra") === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Obra (para auditoria de obra)${qObraSelectHtml("qAudObra", row.projectId)}</label>
        <label>Data<input id="qAudData" type="date" value="${svgText(row.dataAuditoria || qHoje())}"></label>
        <label>Auditor<input id="qAudAuditor" value="${svgText(row.auditor || "")}"></label>
        <label>Status<select id="qAudStatus">${["Agendada", "Realizada", "Relatorio emitido"].map((s) => `<option ${(row.status || "Agendada") === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label class="full">Escopo<textarea id="qAudEscopo" rows="2">${svgText(row.escopo || "")}</textarea></label>
      </div>
      <h4>Checklist SiAC Nível B (${CHECKLIST_SIAC_NIVEL_B.length} requisitos)</h4>
      <p class="field-hint">Itens "Não Conforme" geram NC automaticamente quando a auditoria passa para Realizada.</p>
      <table class="q-mat-table q-checklist"><thead><tr><th>Cláusula</th><th>Requisito</th><th>Avaliação</th><th>Observação</th></tr></thead><tbody>
        ${itens.map((item, i) => `
          <tr data-q-aud-row data-q-aud-clausula="${svgText(item.clausula)}" data-q-aud-desc="${svgText(item.desc)}">
            <td>${svgText(item.clausula)}</td>
            <td>${svgText(item.desc)}</td>
            <td class="q-radio-group">
              <label><input type="radio" name="qAud${i}" value="Conforme" ${item.resultado === "Conforme" ? "checked" : ""}> Conforme</label>
              <label><input type="radio" name="qAud${i}" value="Não Conforme" ${item.resultado === "Não Conforme" ? "checked" : ""}> Não Conf.</label>
              <label><input type="radio" name="qAud${i}" value="N/A" ${item.resultado === "N/A" ? "checked" : ""}> N/A</label>
            </td>
            <td><input data-q-aud-obs value="${svgText(item.observacao || "")}"></td>
          </tr>`).join("")}
      </tbody></table>
      <div class="form-grid">
        <label class="full">Relatório / conclusões<textarea id="qAudRelatorio" rows="3">${svgText(row.relatorioTexto || "")}</textarea></label>
      </div>
      <div class="actions">
        <button class="primary" type="button" id="qAudSalvar">Salvar auditoria</button>
        <button class="secondary" type="button" id="qFormCancelar">Cancelar</button>
      </div>
    </section>` : "";
  const listRows = rows.map((r) => ({ ...r, conformidade: r.totalItens ? `${r.itensConformes}/${r.totalItens} (${Math.round((r.itensConformes / r.totalItens) * 100)}%)` : "—" }));
  qs("content").innerHTML = `
    ${qualidadeHead(key, "Auditorias Internas SiAC", "Checklist dos requisitos obrigatórios do SiAC Nível B (cláusulas 4 a 10). O resultado é calculado pelos itens conformes sobre os avaliados.")}
    ${formHtml}
    ${table("Auditorias", listRows, ["tipo", "projectId", "dataAuditoria", "auditor", "conformidade", "resultado", "status"], editable, key)}
  `;
  qWire(key);
  qs("qAudSalvar")?.addEventListener("click", async () => {
    const checklist = [...qs("content").querySelectorAll("[data-q-aud-row]")].map((tr, i) => ({
      clausula: tr.dataset.qAudClausula,
      desc: tr.dataset.qAudDesc,
      resultado: tr.querySelector(`input[name="qAud${i}"]:checked`)?.value || "",
      observacao: tr.querySelector("[data-q-aud-obs]")?.value.trim() || "",
    }));
    const tipo = qVal("qAudTipo") || "Obra";
    const projectId = qVal("qAudObra");
    if (tipo === "Obra" && !projectId) return alert("Selecione a obra auditada.");
    await qSalvar(key, {
      projectId: projectId || null,
      tipo,
      dataAuditoria: qVal("qAudData") || qHoje(),
      auditor: qVal("qAudAuditor"),
      escopo: qVal("qAudEscopo"),
      checklistSiac: JSON.stringify(checklist),
      relatorioTexto: qVal("qAudRelatorio"),
      status: qVal("qAudStatus") || "Agendada",
    }, qualidadeEdit?.id || null);
  });
}

async function importSinapiCsvLocal({ type, sheetName, uf, referenceMonth, referenceYear, referenceType, file }) {
  if (!/\.(csv|txt)$/i.test(file.name)) {
    alert("No modo local, exporte a aba do Excel para CSV antes de importar. No servidor, use o importador XLSX da API.");
    return;
  }
  const reference = (db.sinapiReferences || []).find((row) => row.uf === uf && Number(row.referenceMonth) === referenceMonth && Number(row.referenceYear) === referenceYear && row.priceType === referenceType)
    || { id: uid(), uf, referenceMonth, referenceYear, priceType: referenceType, source: "SINAPI/CAIXA", defaultUf: uf, locationName: "Campo Grande/MS", issueDate: "2026-05-12", availableTypes: "Sem desoneração; Com desoneração; Sem encargos sociais", importDate: new Date().toISOString().slice(0, 10), importUserId: currentUser?.id || "", status: "Ativo" };
  if (!byId("sinapiReferences", reference.id)) db.sinapiReferences.push(reference);
  const text = await file.text();
  const rows = parseCsv(text);
  const result = { created: 0, updated: 0, skipped: 0 };
  const csvType = type === "reference" ? sinapiCsvTypeFromSheet(sheetName) : type;
  for (const row of rows) {
    const record = mapSinapiCsvRow(row, reference.id, csvType, { uf, referenceType: sheetName || referenceType });
    if (!record || (!record.code && !record.compositionCode && !record.inputCode)) {
      result.skipped++;
      continue;
    }
    const key = csvType === "inputs" ? "sinapiInputs" : csvType === "compositions" ? "sinapiCompositions" : csvType === "compositionItems" ? "sinapiCompositionItems" : csvType === "labor" ? "sinapiLabor" : csvType === "families" ? "sinapiFamilies" : "sinapiMaintenances";
    db[key].push({ id: uid(), ...record });
    result.created++;
  }
  saveDb();
  sinapiLastImportHtml = `Importação local concluída: ${result.created} criado(s), ${result.skipped} ignorado(s). Use a API PHP no servidor para gravar no MariaDB/MySQL.`;
  qs("sinapiImportResult").classList.remove("hidden");
  qs("sinapiImportResult").textContent = sinapiLastImportHtml;
  render();
}

function sinapiCsvTypeFromSheet(sheetName) {
  if (["ISD", "ICD", "ISE"].includes(sheetName)) return "inputs";
  if (["CSD", "CCD", "CSE"].includes(sheetName)) return "compositions";
  if (sheetName === "Analítico") return "compositionItems";
  return "inputs";
}

async function uploadRawFile(endpoint, file) {
  if (!serverMode || !file) return "";
  const form = new FormData();
  form.append("file", file);
  const payload = await fetchForm(endpoint, form);
  return payload.file || "";
}

function mapSinapiCsvRow(row, referenceId, type, context = {}) {
  const valueOf = (...names) => {
    const found = names.find((name) => Object.prototype.hasOwnProperty.call(row, name));
    return found ? row[found] : "";
  };
  if (type === "inputs") {
    return {
      sinapiReferenceId: referenceId,
      referenceType: context.referenceType || valueOf("tipo_referencia", "referenceType", "Tipo referência"),
      uf: context.uf || valueOf("uf", "UF"),
      classification: valueOf("classificacao", "classificação", "Classificação", "categoria"),
      code: valueOf("codigo", "código", "code", "Código"),
      description: valueOf("descricao", "descrição", "description", "Descrição"),
      unit: valueOf("unidade", "unit", "Unidade"),
      priceOrigin: valueOf("origem_preco", "origem de preço", "Origem de Preço"),
      unitPrice: parseMoneyInput(valueOf("preco_unitario", "preço_unitario", "preco", "Preço", "unitPrice")),
      origin: valueOf("origem", "origin", "Origem") || "SINAPI/CAIXA",
      category: valueOf("categoria", "category", "Categoria"),
      status: "Ativo",
    };
  }
  if (type === "compositions") {
    return {
      sinapiReferenceId: referenceId,
      referenceType: context.referenceType || valueOf("tipo_referencia", "referenceType", "Tipo referência"),
      uf: context.uf || valueOf("uf", "UF"),
      code: valueOf("codigo", "código", "code", "Código"),
      description: valueOf("descricao", "descrição", "description", "Descrição"),
      unit: valueOf("unidade", "unit", "Unidade"),
      unitCost: parseMoneyInput(valueOf("custo_unitario", "custo", "unitCost", "Custo")),
      percentAS: parseMoneyInput(valueOf("percentual_as", "%AS", "as", "AS")),
      type: valueOf("tipo", "type", "Tipo"),
      groupName: valueOf("grupo", "group", "Grupo"),
      className: valueOf("classe", "class", "Classe"),
      status: "Ativo",
    };
  }
  const compositionCode = valueOf("codigo_composicao", "composicao_codigo", "composicao", "composition_code", "Composição");
  const composition = (db.sinapiCompositions || []).find((item) => sameId(item.sinapiReferenceId, referenceId) && item.code === compositionCode);
  if (type === "compositionItems") return {
    sinapiReferenceId: referenceId,
    sinapiCompositionId: valueOf("composicao_id", "compositionId", "Composição") || composition?.id || "",
    compositionCode,
    itemType: valueOf("tipo_item", "tipo", "Tipo") || "Insumo",
    itemCode: valueOf("codigo_item", "codigo", "Código"),
    itemDescription: valueOf("descricao_item", "descricao", "Descrição"),
    unit: valueOf("unidade", "unit", "Unidade"),
    coefficient: Number(String(valueOf("coeficiente", "coefficient", "Coeficiente")).replace(",", ".") || 0),
    situation: valueOf("situacao", "situação", "Situação"),
    unitPrice: parseMoneyInput(valueOf("preco_unitario", "preço_unitario", "Preço")),
    totalCost: parseMoneyInput(valueOf("custo_total", "Custo total")),
    code: valueOf("codigo_item", "codigo", "Código"),
    description: valueOf("descricao_item", "descricao", "Descrição"),
  };
  if (type === "labor") return {
    sinapiReferenceId: referenceId,
    referenceType: context.referenceType || valueOf("tipo_referencia", "Tipo referência"),
    uf: context.uf || valueOf("uf", "UF"),
    groupName: valueOf("grupo", "Grupo"),
    compositionCode: valueOf("codigo_composicao", "codigo", "Código da Composição", "Código"),
    description: valueOf("descricao", "descrição", "Descrição"),
    unit: valueOf("unidade", "Unidade"),
    laborPercent: Number(String(valueOf("percentual_mao_de_obra", "percentual", "MS", "laborPercent")).replace(",", ".") || 0),
  };
  if (type === "families") return {
    sinapiReferenceId: referenceId,
    familyCode: valueOf("codigo_familia", "Código da Família"),
    inputCode: valueOf("codigo_insumo", "Código do Insumo"),
    inputDescription: valueOf("descricao_insumo", "Descrição do Insumo"),
    unit: valueOf("unidade", "Unidade"),
    category: valueOf("categoria", "Categoria"),
    uf: context.uf || valueOf("uf", "UF"),
    coefficient: Number(String(valueOf("coeficiente", "MS", "Coefficient")).replace(",", ".") || 0),
  };
  return {
    sinapiReferenceId: referenceId,
    referenceCode: valueOf("referencia", "Referência"),
    itemType: valueOf("tipo", "Tipo"),
    code: valueOf("codigo", "Código"),
    description: valueOf("descricao", "Descrição"),
    maintenanceType: valueOf("manutencao", "manutenção", "Manutenção"),
  };
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const separator = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
  const split = (line) => {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === separator && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };
  const headers = split(lines[0]).map((header) => normalizedText(header).replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => Object.fromEntries(split(line).map((cell, index) => [headers[index] || `col${index}`, cell])));
}

function canGenerateProposalForBudget(budget) {
  return ["rascunho", "em analise", "aprovado"].includes(normalizedText(budget?.status || ""));
}

function openProposalGenerator(workBudgetId) {
  const budget = enrichWorkBudget(byId("workBudgets", workBudgetId) || {});
  if (!budget.id) return alert("Selecione um orçamento de obra.");
  if (!canGenerateProposalForBudget(budget)) return alert("A proposta pode ser gerada para orçamentos em rascunho, em análise ou aprovados.");
  const project = byId("projects", budget.projectId) || {};
  const client = byId("clients", budget.clientId || project.clientId) || {};
  const models = (db.proposalModels || []).filter((model) => model.status !== "Inativo");
  const model = models[0] || {};
  const today = new Date().toISOString().slice(0, 10);
  const validityDate = addDateStringDays(today, Number(model.validityDays || 15));
  const items = budgetItemsFor(budget.id, false);
  proposalGeneratorState = {
    budget,
    project,
    client,
    items,
    modelId: model.id || "",
    date: today,
    validityDate,
    proposalNumber: `PROP-OBRA-${today.replaceAll("-", "")}-${String(Date.now()).slice(-4)}`,
  };
  setProposalDialogMode("edit");
  renderProposalGeneratorFields(model);
  updateProposalPreview();
  qs("proposalGeneratorDialog").showModal();
}

function openSavedProposalPreview(proposalId) {
  const proposal = byId("proposals", proposalId);
  if (!proposal?.proposalBody) return alert("Esta proposta ainda não possui pré-visualização gerada.");
  proposalGeneratorState = null;
  setProposalDialogMode("preview");
  qs("proposalGeneratorFields").innerHTML = `
    <section class="proposal-generator-form no-print">
      <div class="proposal-budget-summary">
        <strong>${svgText(proposal.number || "Proposta")}</strong>
        <span>${svgText(nameOf("clients", proposal.clientId) || "")}</span>
        <span>${asMoney(proposal.amount || 0)} - ${svgText(proposal.status || "")}</span>
      </div>
    </section>
  `;
  qs("proposalPreview").innerHTML = proposal.proposalBody;
  qs("proposalGeneratorDialog").showModal();
}

function setProposalDialogMode(mode) {
  const editing = mode === "edit";
  qs("saveProposalDraft").classList.toggle("hidden", !editing);
  qs("finalizeProposal").classList.toggle("hidden", !editing);
  qs("refreshProposalPreview").classList.toggle("hidden", !editing);
}

function renderProposalGeneratorFields(model = {}) {
  const state = proposalGeneratorState;
  const budget = state.budget;
  const project = state.project;
  const client = state.client;
  const vars = proposalVariablesFor({ ...state, model, input: {} });
  const template = (value, fallback = "") => renderTemplate(value || fallback, vars);
  const generatedScope = generateScopeFromBudgetItems(state.items, project);
  const proposalModes = ["Proposta resumida", "Proposta por grupos/etapas", "Proposta detalhada", "Tabela resumida", "Tabela detalhada", "Valor global", "Agrupado por etapa", "Agrupado por categoria", "Agrupado por centro de custo"];
  if (["admin", "financeiro", "engenharia", "gestor_obra"].includes(currentUser?.role)) proposalModes.splice(3, 0, "Proposta técnica interna");
  qs("proposalGeneratorFields").innerHTML = `
    <section class="proposal-generator-form no-print">
      <div class="form-grid">
        <label>Modelo de proposta<select name="modelId" id="proposalModelSelect">${(db.proposalModels || []).filter((row) => row.status !== "Inativo").map((row) => `<option value="${row.id}" ${sameId(row.id, model.id) ? "selected" : ""}>${svgText(row.name)}</option>`).join("")}</select></label>
        <label>Obra/Projeto<select name="projectId">${db.projects.map((row) => `<option value="${row.id}" ${sameId(row.id, project.id) ? "selected" : ""}>${svgText(row.name)}</option>`).join("")}</select></label>
        <label>Cliente<select name="clientId">${db.clients.map((row) => `<option value="${row.id}" ${sameId(row.id, client.id) ? "selected" : ""}>${svgText(row.name)}</option>`).join("")}</select></label>
        <label>Exibição dos itens<select name="itemDisplayMode">
          ${proposalModes.map((option) => `<option>${option}</option>`).join("")}
        </select></label>
        <label>Condição de pagamento<textarea name="paymentCondition" rows="3">${template(model.paymentTerms || "")}</textarea></label>
        <label>Prazo de execução<input name="executionDeadline" value="${svgText(template(model.deadline || "30 dias"))}"></label>
        <label>Validade da proposta<input name="validityDate" type="date" value="${state.validityDate}"></label>
        <label>Responsável técnico<input name="technicalResponsible" value="${svgText(project.technicalResponsible || project.responsible || "")}"></label>
        <label>CREA/CAU<input name="creaCau" value="${svgText(companyValue("creaCau") || "")}" placeholder="CREA/CAU do responsável"></label>
        <label>Responsável comercial<input name="commercialResponsible" value="${svgText(nameOf("users", project.commercialUserId) || currentUser?.fullName || currentUser?.username || "")}"></label>
        <label class="full">Objeto da proposta<textarea name="proposalObject" rows="3">${template(model.proposalObject || "Prestação de serviços para {{nome_obra}}.")}</textarea></label>
        <label class="full">Escopo gerado pelos itens<textarea name="generatedScope" rows="4">${svgText(generatedScope)}</textarea></label>
        <label class="full">Escopo do modelo<textarea name="scope" rows="4">${template(model.scope || "")}</textarea></label>
        <label>Etapas<textarea name="stages" rows="4">${template(model.stages || "")}</textarea></label>
        <label>Entregáveis<textarea name="deliverables" rows="4">${template(model.deliverables || "")}</textarea></label>
        <label>Itens inclusos<textarea name="includedItems" rows="4">${template(model.includedItems || "")}</textarea></label>
        <label>Itens não inclusos<textarea name="excludedItems" rows="4">${template(model.excludedItems || "")}</textarea></label>
        <label>Responsabilidades do cliente<textarea name="clientResponsibilities" rows="4">${template(model.clientResponsibilities || "")}</textarea></label>
        <label>Responsabilidades da empresa<textarea name="companyResponsibilities" rows="4">${template(model.companyResponsibilities || "")}</textarea></label>
        <label class="full">Condições gerais<textarea name="generalConditions" rows="4">${template(model.generalConditions || "")}</textarea></label>
        <label>Observações comerciais<textarea name="commercialNotes" rows="4"></textarea></label>
        <label>Aceite<textarea name="acceptanceText" rows="4">${template(model.acceptanceText || "Aceite mediante assinatura desta proposta.")}</textarea></label>
        <label class="full">Assinatura<textarea name="signatureText" rows="3">${template(model.signatureText || "{{nome_empresa}}")}</textarea></label>
        <label>Gerar como rascunho<select name="draftStatus"><option value="Rascunho">Sim</option><option value="Gerada">Não, finalizar como gerada</option></select></label>
      </div>
      <div class="proposal-budget-summary">
        <strong>Resumo do orçamento</strong>
        <span>${svgText(budget.name || "")} ${budget.version ? `- ${svgText(budget.version)}` : ""}</span>
        <span>${state.items.length} item(ns) - ${asMoney(budget.totalPrice || 0)}</span>
      </div>
    </section>
  `;
  qs("proposalModelSelect")?.addEventListener("change", (event) => {
    const nextModel = byId("proposalModels", event.target.value) || {};
    proposalGeneratorState.modelId = nextModel.id || "";
    const today = proposalGeneratorState.date;
    proposalGeneratorState.validityDate = addDateStringDays(today, Number(nextModel.validityDays || 15));
    renderProposalGeneratorFields(nextModel);
    updateProposalPreview();
  });
  qs("proposalGeneratorFields").querySelectorAll("input, textarea, select").forEach((field) => {
    field.addEventListener("input", updateProposalPreview);
    field.addEventListener("change", updateProposalPreview);
  });
}

function collectProposalGeneratorInput() {
  const form = qs("proposalGeneratorForm");
  return Object.fromEntries(new FormData(form).entries());
}

function updateProposalPreview() {
  if (!proposalGeneratorState) return;
  const input = collectProposalGeneratorInput();
  const model = byId("proposalModels", input.modelId || proposalGeneratorState.modelId) || {};
  const project = byId("projects", input.projectId) || proposalGeneratorState.project;
  const client = byId("clients", input.clientId) || proposalGeneratorState.client;
  const vars = proposalVariablesFor({ ...proposalGeneratorState, model, project, client, input });
  qs("proposalPreview").innerHTML = proposalDocumentHtml({ ...proposalGeneratorState, model, project, client, input, vars });
}

function proposalDocumentHtml({ budget, project, client, items, model, input, vars }) {
  const value = (field) => renderTemplate(input[field] || "", vars);
  const proposalNumber = vars.numero_proposta;
  return `
    <article class="proposal-page">
      <header class="proposal-cover">
        <span>Proposta Comercial</span>
        <h1>${svgText(model.name || "Proposta Comercial")}</h1>
        <p>${svgText(project.name || "")}</p>
        <strong>${svgText(proposalNumber)}</strong>
      </header>
      <section class="proposal-meta-grid">
        <div><h3>Empresa</h3><p>${svgText(vars.nome_empresa)}</p><p>${svgText(vars.cnpj_empresa)}</p><p>${svgText(vars.telefone_empresa)} ${svgText(vars.email_empresa)}</p></div>
        <div><h3>Cliente</h3><p>${svgText(client.name || "")}</p><p>${svgText(client.document || "")}</p><p>${svgText(client.address || "")}</p></div>
        <div><h3>Obra/Projeto</h3><p>${svgText(project.name || "")}</p><p>${svgText(project.address || "")}</p><p>Orçamento: ${svgText(vars.numero_orcamento)} ${svgText(vars.versao_orcamento)}</p></div>
      </section>
      ${proposalSection("Objeto da proposta", value("proposalObject"))}
      ${proposalSection("Escopo dos serviços", `${value("generatedScope")}\n\n${value("scope")}`)}
      ${proposalSection("Etapas", value("stages"))}
      ${proposalSection("Entregáveis", value("deliverables"))}
      <section class="proposal-section">
        <h2>Itens do orçamento</h2>
        ${proposalItemsHtml(items, input.itemDisplayMode || "Tabela resumida")}
      </section>
      <section class="proposal-investment">
        <h2>Investimento</h2>
        <div><span>Valor total</span><strong>${asMoney(budget.totalPrice || 0)}</strong></div>
        <p>${svgText(vars.valor_total_extenso)}</p>
      </section>
      ${proposalSection("Condições de pagamento", value("paymentCondition"))}
      ${proposalSection("Prazo de execução", value("executionDeadline"))}
      ${proposalSection("Itens inclusos", value("includedItems"))}
      ${proposalSection("Itens não inclusos", value("excludedItems"))}
      ${proposalSection("Responsabilidades do cliente", value("clientResponsibilities"))}
      ${proposalSection("Responsabilidades da empresa", value("companyResponsibilities"))}
      ${proposalSection("Validade da proposta", asDate(input.validityDate))}
      ${proposalSection("Condições gerais", value("generalConditions"))}
      ${proposalSection("Observações comerciais", value("commercialNotes"))}
      <section class="proposal-signatures">
        <div><h2>Aceite da proposta</h2><p>${textToHtml(value("acceptanceText"))}</p><span>Assinatura do cliente</span></div>
        <div><h2>Assinatura da empresa</h2><p>${textToHtml(value("signatureText"))}</p><span>${svgText(vars.nome_empresa)}</span></div>
      </section>
    </article>
  `;
}

function proposalSection(title, text) {
  if (!String(text || "").trim()) return "";
  return `<section class="proposal-section"><h2>${svgText(title)}</h2><p>${textToHtml(text)}</p></section>`;
}

function proposalItemsHtml(items, mode) {
  if (!items.length) return '<div class="empty">Sem dados para exibir</div>';
  const settings = sinapiDefaultSettings();
  const showCode = settings.showSinapiCodeInProposal === "Sim" || mode === "Proposta técnica interna";
  const technical = mode === "Proposta técnica interna";
  if (["Valor global", "Proposta resumida"].includes(mode) || settings.showGlobalOnlyInProposal === "Sim") return `<p>Execução dos serviços conforme escopo e orçamento vinculado, pelo valor global de <strong>${asMoney(sum(items, "totalPrice"))}</strong>.</p>`;
  if (["Agrupado por etapa", "Proposta por grupos/etapas"].includes(mode)) return groupedProposalItems(items, "stageName", "Etapa");
  if (mode === "Agrupado por categoria") return groupedProposalItems(items, "categoryId", "Categoria", "categories");
  if (mode === "Agrupado por centro de custo") return groupedProposalItems(items, "costCenterId", "Centro de custo", "costCenters");
  const showUnitPrice = settings.showUnitPriceInProposal !== "Não" || technical;
  return `
    <table class="proposal-items-table">
      <thead><tr><th>Item</th>${showCode ? "<th>Código</th>" : ""}<th>Descrição</th><th>Un.</th><th>Qtd.</th>${technical ? "<th>Custo unit.</th><th>BDI</th>" : ""}${showUnitPrice ? "<th>Valor unit.</th>" : ""}<th>Valor total</th></tr></thead>
      <tbody>
        ${items.map((item, index) => `<tr><td>${index + 1}</td>${showCode ? `<td>${svgText(item.code || "")}</td>` : ""}<td>${svgText(item.description || "")}</td><td>${svgText(item.unit || "")}</td><td>${formatQuantity(item.quantity)}</td>${technical ? `<td>${asMoney(item.unitCost || 0)}</td><td>${asPercent(item.bdiPercent || 0)}</td>` : ""}${showUnitPrice ? `<td>${asMoney(item.unitPrice || 0)}</td>` : ""}<td>${asMoney(item.totalPrice || 0)}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

function groupedProposalItems(items, field, label, collection = "") {
  const grouped = {};
  items.forEach((item) => {
    const key = collection ? (nameOf(collection, item[field]) || "Sem vínculo") : (item[field] || "Sem etapa");
    grouped[key] = (grouped[key] || 0) + Number(item.totalPrice || 0);
  });
  return `
    <table class="proposal-items-table">
      <thead><tr><th>${label}</th><th>Valor total</th></tr></thead>
      <tbody>${Object.entries(grouped).map(([name, total]) => `<tr><td>${svgText(name)}</td><td>${asMoney(total)}</td></tr>`).join("")}</tbody>
    </table>
  `;
}

function proposalVariablesFor({ budget, project, client, items, model, input = {}, proposalNumber = "" }) {
  const company = (db.companySettings || [])[0] || {};
  const totalPrice = Number(budget.totalPrice || 0);
  const totalCost = items.reduce((total, item) => total + Number(item.totalCost || 0), 0);
  const bdiValue = Math.max(0, totalPrice - totalCost);
  const discountPercent = Number(budget.discountPercent || 0);
  const discountValue = discountPercent ? (totalPrice / Math.max(0.01, 1 - discountPercent / 100)) * (discountPercent / 100) : 0;
  const totals = proposalItemTotals(items);
  const proposalDate = input.date || new Date().toISOString().slice(0, 10);
  return {
    numero_proposta: proposalNumber || `PROP-OBRA-${proposalDate.replaceAll("-", "")}-${String(Date.now()).slice(-4)}`,
    nome_cliente: client.name || "",
    cpf_cnpj_cliente: client.document || "",
    endereco_cliente: client.address || "",
    nome_obra: project.name || "",
    endereco_obra: project.address || "",
    tipo_obra: nameOf("workTypes", project.workTypeId) || project.status || "",
    numero_orcamento: budget.name || budget.id || "",
    versao_orcamento: budget.version || "",
    data_orcamento: asDate(budget.budgetDate),
    data_proposta: asDate(proposalDate),
    validade_proposta: asDate(input.validityDate || ""),
    responsavel_tecnico: input.technicalResponsible || project.technicalResponsible || project.responsible || "",
    crea_cau: input.creaCau || company.creaCau || "",
    responsavel_comercial: input.commercialResponsible || nameOf("users", project.commercialUserId) || currentUser?.fullName || currentUser?.username || "",
    nome_empresa: company.name || "Schimanski Engenharia",
    cnpj_empresa: company.document || "",
    telefone_empresa: company.phone || "",
    email_empresa: company.email || "",
    valor_total: asMoney(totalPrice),
    valor_total_extenso: moneyToWords(totalPrice),
    condicao_pagamento: input.paymentCondition || model.paymentTerms || "",
    prazo_execucao: input.executionDeadline || model.deadline || "",
    observacoes: input.commercialNotes || "",
    tabela_itens_orcamento: proposalItemsText(items),
    resumo_itens_orcamento: items.map((item) => item.description).filter(Boolean).join("; "),
    escopo_gerado_pelos_itens: generateScopeFromBudgetItems(items, project),
    total_servicos: asMoney(totals.services),
    total_produtos: asMoney(totals.products),
    total_mao_de_obra: asMoney(totals.labor),
    total_materiais: asMoney(totals.materials),
    total_equipamentos: asMoney(totals.equipment),
    total_terceiros: asMoney(totals.thirdParties),
    bdi_percentual: asPercent(budget.bdiPercent || 0),
    valor_bdi: asMoney(bdiValue),
    desconto_percentual: asPercent(discountPercent),
    valor_desconto: asMoney(discountValue),
  };
}

function renderTemplate(text, vars) {
  return String(text || "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => vars[key] ?? "");
}

function proposalItemsText(items) {
  if (!items.length) return "Sem itens de orçamento.";
  return items.map((item, index) => {
    const code = item.code ? `${item.code} - ` : "";
    return `${index + 1}. ${code}${item.description || ""} | ${formatQuantity(item.quantity)} ${item.unit || ""} | ${asMoney(item.unitPrice || 0)} | ${asMoney(item.totalPrice || 0)}`;
  }).join("\n");
}

function generateScopeFromBudgetItems(items, project = {}) {
  const names = items.map((item) => item.description).filter(Boolean).slice(0, 14);
  if (!names.length) return "O presente orçamento contempla os serviços descritos no orçamento vinculado.";
  const sourceText = normalizedText(items.map((item) => `${item.description || ""} ${item.groupName || ""} ${item.stageName || ""}`).join(" "));
  if (sourceText.includes("eletric") || sourceText.includes("eletroduto") || sourceText.includes("quadro") || sourceText.includes("tomada")) {
    return "A presente proposta contempla os serviços de engenharia elétrica previstos no orçamento, incluindo materiais, mão de obra, execução, testes, comissionamento e documentação técnica, conforme itens selecionados e escopo aprovado.";
  }
  const groups = [
    ["alvenaria", "alvenaria"],
    ["concreto", "concreto"],
    ["instalacoes eletricas", "instalações elétricas"],
    ["revestimento", "revestimentos"],
    ["pintura", "pintura"],
  ].filter(([key]) => sourceText.includes(key)).map(([, label]) => label);
  if (groups.length >= 2) {
    return `A presente proposta contempla a execução dos serviços previstos em orçamento, incluindo os itens técnicos de ${joinHumanList(groups)}, conforme quantitativos e etapas vinculadas à obra/projeto.`;
  }
  const [first, ...rest] = names;
  const list = rest.length ? `${first}, incluindo ${joinHumanList(rest)}` : first;
  return `O presente orçamento contempla ${list}, conforme os itens constantes no orçamento vinculado${project.name ? ` da obra ${project.name}` : ""}.`;
}

function joinHumanList(values) {
  if (values.length <= 1) return values[0] || "";
  return `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

function proposalItemTotals(items) {
  const totals = { services: 0, products: 0, labor: 0, materials: 0, equipment: 0, thirdParties: 0 };
  items.forEach((item) => {
    const text = normalizedText(`${item.description || ""} ${nameOf("categories", item.categoryId)} ${item.origin || ""}`);
    const value = Number(item.totalPrice || 0);
    if (text.includes("mao") || text.includes("ajudante") || text.includes("eletricista")) totals.labor += value;
    else if (text.includes("material") || text.includes("produto") || text.includes("eletroduto") || text.includes("quadro")) totals.materials += value;
    else if (text.includes("equip")) totals.equipment += value;
    else if (text.includes("terceir")) totals.thirdParties += value;
    else if (text.includes("servic") || text.includes("projeto") || text.includes("laudo")) totals.services += value;
    else totals.products += value;
  });
  return totals;
}

function formatQuantity(value) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(Number(value || 0));
}

function textToHtml(text) {
  return svgText(text).replace(/\n/g, "<br>");
}

function addDateStringDays(date, days) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + Number(days || 0));
  return next.toISOString().slice(0, 10);
}

function companyValue(field) {
  return (db.companySettings || [])[0]?.[field] || "";
}

function moneyToWords(value) {
  const amount = Number(value || 0);
  const absolute = Math.abs(amount);
  const reais = Math.floor(absolute);
  const cents = Math.round((absolute - reais) * 100);
  const realText = `${numberToWordsPtBr(reais)} ${reais === 1 ? "real" : "reais"}`;
  const centText = cents ? ` e ${numberToWordsPtBr(cents)} ${cents === 1 ? "centavo" : "centavos"}` : "";
  return `${asMoney(amount)} (${amount < 0 ? "menos " : ""}${realText}${centText})`;
}

function numberToWordsPtBr(value) {
  const n = Math.floor(Number(value || 0));
  if (!n) return "zero";
  const groups = [
    [1000000000, "bilhão", "bilhões"],
    [1000000, "milhão", "milhões"],
    [1000, "mil", "mil"],
    [1, "", ""],
  ];
  const parts = [];
  let rest = n;
  groups.forEach(([base, singular, plural]) => {
    const chunk = Math.floor(rest / base);
    if (!chunk) return;
    rest %= base;
    if (base === 1000 && chunk === 1) {
      parts.push("mil");
      return;
    }
    const chunkText = hundredsToWordsPtBr(chunk);
    parts.push(base === 1 ? chunkText : `${chunkText} ${chunk === 1 ? singular : plural}`);
  });
  return parts.join(" ");
}

function hundredsToWordsPtBr(value) {
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  let n = Number(value || 0);
  if (n === 100) return "cem";
  const parts = [];
  if (n >= 100) {
    parts.push(hundreds[Math.floor(n / 100)]);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(tens[Math.floor(n / 10)]);
    n %= 10;
  } else if (n >= 10) {
    parts.push(teens[n - 10]);
    n = 0;
  }
  if (n > 0) parts.push(units[n]);
  return parts.join(" e ");
}

async function saveGeneratedProposal(statusOverride = "") {
  if (!proposalGeneratorState) return;
  updateProposalPreview();
  const input = collectProposalGeneratorInput();
  const budget = proposalGeneratorState.budget;
  const project = byId("projects", input.projectId) || proposalGeneratorState.project;
  const client = byId("clients", input.clientId) || proposalGeneratorState.client;
  const model = byId("proposalModels", input.modelId) || {};
  const items = proposalGeneratorState.items;
  const vars = proposalVariablesFor({ ...proposalGeneratorState, project, client, model, input });
  const status = statusOverride || input.draftStatus || "Rascunho";
  const body = qs("proposalPreview").innerHTML;
  try {
    const proposal = await createIntegratedRecord("proposals", {
      number: vars.numero_proposta,
      date: new Date().toISOString().slice(0, 10),
      clientId: client.id || "",
      projectId: project.id || "",
      budgetId: "",
      workBudgetId: budget.id,
      serviceId: "",
      modelId: model.id || "",
      areaId: model.areaId || "",
      actionTypeId: model.actionTypeId || "",
      subtypeId: model.subtypeId || "",
      origin: "Nova demanda",
      parentProposalId: "",
      createdByUserId: currentUser?.id || "",
      commercialUserId: currentUser?.role === "comercial" ? currentUser.id : project.commercialUserId || currentUser?.id || "",
      description: input.proposalObject || `Proposta gerada a partir do orçamento ${budget.name || budget.id}.`,
      amount: Number(budget.totalPrice || 0),
      proposalBody: body,
      itemDisplayMode: input.itemDisplayMode || "Tabela resumida",
      paymentCondition: input.paymentCondition || "",
      paymentTerms: input.paymentCondition || "",
      executionDeadline: input.executionDeadline || "",
      deadline: input.executionDeadline || "",
      validityDate: input.validityDate || "",
      technicalResponsible: input.technicalResponsible || "",
      commercialResponsible: input.commercialResponsible || "",
      commercialNotes: input.commercialNotes || "",
      status,
    });
    await createProposalLinkedRecords(proposal, { budget, project, client, model, items, vars, status });
    alert(status === "Rascunho" ? "Rascunho de proposta salvo." : "Proposta gerada e finalizada.");
    qs("proposalGeneratorDialog").close();
    proposalGeneratorState = null;
    currentModule = "proposals";
    await refreshAndRender();
  } catch (error) {
    alert(`Não foi possível salvar a proposta gerada: ${error.message}`);
  }
}

async function createProposalLinkedRecords(proposal, { budget, project, client, model, items, vars, status }) {
  await createIntegratedRecord("proposalBudgetLinks", {
    proposalId: proposal.id,
    workBudgetId: budget.id,
    projectId: project.id || "",
    clientId: client.id || "",
    proposalModelId: model.id || "",
    responsibleUserId: currentUser?.id || "",
  });
  await createIntegratedRecord("proposalStatusHistory", {
    proposalId: proposal.id,
    date: new Date().toISOString().slice(0, 10),
    userId: currentUser?.id || "",
    previousStatus: "",
    newStatus: status,
    notes: "Proposta gerada a partir do orçamento de obra.",
  });
  for (const [index, item] of items.entries()) {
    await createIntegratedRecord("proposalItems", {
      proposalId: proposal.id,
      workBudgetItemId: item.id || "",
      itemNumber: index + 1,
      code: item.code || "",
      description: item.description || "",
      unit: item.unit || "",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      totalPrice: Number(item.totalPrice || 0),
      groupName: item.stageName || "",
      visibleToClient: "Sim",
      notes: "",
    });
  }
  for (const [variableName, variableValue] of Object.entries(vars)) {
    await createIntegratedRecord("proposalVariables", {
      proposalId: proposal.id,
      variableName,
      variableValue: String(variableValue || ""),
    });
  }
}

async function addBudgetItemFromSource(sourceKey, id) {
  const budget = byId("workBudgets", selectedWorkBudgetId) || (db.workBudgets || [])[0];
  if (!budget) return alert("Crie ou selecione um orçamento de obra antes de adicionar itens.");
  const source = byId(sourceKey, id);
  if (!source) return;
  const reference = byId("sinapiReferences", source.sinapiReferenceId || budget.sinapiReferenceId) || {};
  const unitCost = Number(source.unitCost || source.unitPrice || source.estimatedCost || source.totalValue || 0);
  const bdiPercent = Number(budget.bdiPercent || source.marginPercent || 0);
  const record = {
    workBudgetId: budget.id,
    projectId: budget.projectId || source.projectId || "",
    origin: sourceKey === "ownCompositions" ? "Composição própria" : sourceKey === "quotes" ? "Cotação manual" : "SINAPI",
    sinapiReferenceId: source.sinapiReferenceId || budget.sinapiReferenceId || "",
    sinapiUf: source.uf || reference.uf || "",
    sinapiReferenceType: source.referenceType || reference.priceType || "",
    code: source.code || "",
    description: source.description || source.itemDescription || "",
    unit: source.unit || "un",
    quantity: sourceKey === "quotes" ? Number(source.quantity || 1) : 1,
    unitCost,
    totalCost: unitCost * (sourceKey === "quotes" ? Number(source.quantity || 1) : 1),
    bdiPercent,
    unitPrice: unitCost * (1 + bdiPercent / 100),
    totalPrice: unitCost * (sourceKey === "quotes" ? Number(source.quantity || 1) : 1) * (1 + bdiPercent / 100),
    stageName: "",
    costCenterId: source.costCenterId || "",
    categoryId: source.categoryId || "",
    notes: sourceKey.startsWith("sinapi") ? `Item criado a partir da Base SINAPI ${reference.uf || source.uf || ""}/${reference.referenceMonth || ""}/${reference.referenceYear || ""} ${reference.priceType || source.referenceType || ""}.` : `Item criado a partir de ${moduleLabels[sourceKey] || sourceKey}.`,
  };
  normalizeWorkBudgetItem(record);
  try {
    await createIntegratedRecord("workBudgetItems", record);
    await syncWorkBudgetTotals(budget.id);
    selectedWorkBudgetId = budget.id;
    alert("Item adicionado ao orçamento de obra.");
    currentModule = "workBudgets";
    await refreshAndRender();
  } catch (error) {
    alert(`Não foi possível adicionar o item: ${error.message}`);
  }
}

async function createScheduleFromWorkBudget(workBudgetId) {
  const budget = byId("workBudgets", workBudgetId);
  if (!budget?.projectId) return alert("O orçamento precisa estar vinculado a uma obra/projeto.");
  const items = budgetItemsFor(workBudgetId, false);
  if (!items.length) return alert("Inclua itens no orçamento antes de gerar o cronograma.");
  if (!confirm("Gerar etapas do cronograma a partir dos itens agrupados por etapa da obra?")) return;
  const grouped = {};
  items.forEach((item) => {
    const stage = item.stageName || "Itens orçados";
    if (!grouped[stage]) grouped[stage] = { items: [], total: 0 };
    grouped[stage].items.push(item);
    grouped[stage].total += Number(item.totalPrice || item.totalCost || 0);
  });
  const existingStages = scheduleRowsForProject(budget.projectId, false).map((row) => normalizedText(row.stageName));
  let created = 0;
  for (const [stageName, group] of Object.entries(grouped)) {
    if (existingStages.includes(normalizedText(stageName))) continue;
    await createIntegratedRecord("projectSchedule", {
      projectId: budget.projectId,
      stageName,
      description: group.items.map((item) => item.description).filter(Boolean).join("; ").slice(0, 800),
      sortOrder: scheduleRowsForProject(budget.projectId, false).length + created + 1,
      plannedStartDate: "",
      plannedEndDate: "",
      actualStartDate: "",
      actualEndDate: "",
      plannedPhysicalPercent: 0,
      actualPhysicalPercent: 0,
      plannedFinancialAmount: roundMoney(group.total),
      actualFinancialAmount: 0,
      workBudgetId: budget.id,
      workBudgetItemId: group.items[0]?.id || "",
      predecessorIds: "",
      durationDays: 0,
      status: "Não iniciada",
      responsible: "",
      isMilestone: "Não",
      milestoneName: "",
      milestoneMessage: "",
      visibleToClient: "Não",
      notes: "Etapa gerada a partir do orçamento de obra.",
    });
    created++;
  }
  alert(`${created} etapa(s) criada(s) no cronograma. Etapas já existentes foram preservadas.`);
  currentModule = "projectSchedule";
  await refreshAndRender();
}

function exportRowsCsv(rows, filename) {
  if (!rows.length) return alert("Sem dados para exportar.");
  const fields = Object.keys(rows[0]);
  const csv = [
    fields.join(";"),
    ...rows.map((row) => fields.map((field) => `"${String(row[field] ?? "").replaceAll('"', '""')}"`).join(";")),
  ].join("\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

function renderProjectCosts() {
  const rows = applyFilters(db.payable).filter((row) => row.projectId);
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Custos por obra</h2>
        <p>Contas a pagar vinculadas a obras/projetos. Cadastre ou edite a obra diretamente em Contas a pagar.</p>
      </div>
    </section>
    ${table("Custos por obra", rows, ["projectId", "supplierId", "document", "dueDate", "categoryId", "amount", "status"])}
  `;
}

function renderProjectRevenues() {
  const rows = applyFilters(db.receivable).filter((row) => row.projectId);
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Receitas por obra</h2>
        <p>Contas a receber vinculadas a obras/projetos. Cadastre ou edite a obra diretamente em Contas a receber.</p>
      </div>
    </section>
    ${table("Receitas por obra", rows, ["projectId", "clientId", "document", "dueDate", "categoryId", "amount", "status"])}
  `;
}

function renderProjectReport() {
  const rows = resultByProjectRows().map((row) => ({ name: row.label, total: row.value }));
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Relatório por obra</h2>
        <p>Resultado financeiro consolidado por obra/projeto, respeitando os filtros superiores.</p>
      </div>
    </section>
    ${table("Relatório por obra", rows, ["name", "total"])}
    ${chartPanel("Resultado por obra/projeto", "Receita menos despesas por obra", horizontalBarChart(resultByProjectRows(), "#0f766e"))}
  `;
}

function renderCashFlow() {
  const rows = monthlyCashFlowRows();
  const finalBalance = rows.at(-1)?.saldoFinal || bankOpeningBalance();
  qs("content").innerHTML = `
    <section class="kpi-grid">
      ${kpi("Saldo projetado final", finalBalance)}
      ${kpi("Entradas previstas", rows.reduce((total, row) => total + row.entradasPrevistas, 0))}
      ${kpi("Saídas previstas", rows.reduce((total, row) => total + row.saidasPrevistas, 0))}
      ${kpi("Saldo inicial", bankOpeningBalance())}
    </section>
    ${chartPanel("Fluxo de caixa mensal", "Previsto, realizado e saldo final", lineChart([
      { label: "Entradas previstas", color: "#0f766e", values: rows.map((row) => row.entradasPrevistas) },
      { label: "Entradas realizadas", color: "#2563eb", values: rows.map((row) => row.entradasRealizadas) },
      { label: "Saídas previstas", color: "#b8872d", values: rows.map((row) => row.saidasPrevistas) },
      { label: "Saídas realizadas", color: "#b42318", values: rows.map((row) => row.saidasRealizadas) },
      { label: "Saldo final", color: "#147a47", values: rows.map((row) => row.saldoFinal) },
    ], rows.map((row) => monthLabel(row.month))))}
    ${table("Fluxo de caixa", rows.map((row) => ({ ...row, month: monthLabel(row.month) })), ["month", "entradasPrevistas", "entradasRealizadas", "saidasPrevistas", "saidasRealizadas", "saldoFinal"])}
  `;
}

function renderReconciliation() {
  const rows = (db.bankAccounts || []).map((account) => {
    const moves = applyFilters(db.cashMoves).filter((row) => row.bankAccount === account.name);
    const entries = moves.filter((row) => signedCashAmount(row) > 0).reduce((total, row) => total + Number(row.amount || 0), 0);
    const exits = moves.filter((row) => signedCashAmount(row) < 0).reduce((total, row) => total + Math.abs(signedCashAmount(row)), 0);
    // Saldo calculado SÓ pelas movimentações (OFX + lançamentos manuais):
    // o openingBalance é ignorado de propósito — o ponto de partida do saldo
    // é o primeiro extrato OFX importado, não um valor digitado à mão.
    return {
      name: account.name,
      bank: account.bank,
      entradasRealizadas: entries,
      saidasRealizadas: exits,
      saldoFinal: entries - exits,
      status: account.status,
    };
  });
  const canImportOfx = canEditModule("reconciliation");
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Conciliação bancária</h2>
        <p>Saldo calculado pelas movimentações importadas via OFX e pelos lançamentos manuais de caixa vinculados ao nome da conta. Importe o extrato do banco para manter os saldos atualizados.</p>
      </div>
      ${canImportOfx ? '<button class="primary" id="btnOfxOpen" type="button">📥 Importar Extrato OFX</button>' : ""}
    </section>

    <div id="ofxPanel" class="ofx-panel hidden">
      <div class="ofx-panel-head">
        <h3>📥 Importar Extrato OFX</h3>
        <button class="secondary" id="btnOfxClose" type="button">✕ Fechar</button>
      </div>
      <div class="ofx-form">
        <label class="ofx-label">
          Conta bancária
          <select id="ofxBankAccount">
            <option value="">Selecione a conta…</option>
            ${(db.bankAccounts || [])
              .filter((account) => account.status === "Ativo")
              .map((account) => `<option value="${Number(account.id) || svgText(account.id)}">${svgText(account.name)}${account.bank ? ` — ${svgText(account.bank)}` : ""}</option>`)
              .join("")}
          </select>
        </label>
        <label class="ofx-label">
          Arquivo OFX / QFX
          <div class="ofx-file-wrap">
            <span class="ofx-file-btn">📂 Escolher arquivo</span>
            <input id="ofxFile" type="file" accept=".ofx,.qfx" class="ofx-file-input" />
            <span id="ofxFileName" class="ofx-file-name">Nenhum arquivo selecionado</span>
          </div>
        </label>
        <button id="btnOfxPreview" class="primary" type="button">🔍 Carregar e verificar</button>
      </div>

      <div id="ofxPreview" class="ofx-preview hidden">
        <div class="ofx-preview-head">
          <div id="ofxPreviewInfo" class="ofx-info"></div>
          <div class="ofx-preview-actions">
            <button class="secondary" id="btnOfxMarkAll" type="button">✅ Marcar todos</button>
            <button class="secondary" id="btnOfxUnmarkAll" type="button">☐ Desmarcar todos</button>
            <button id="btnOfxImport" class="primary" type="button">📥 Importar selecionados</button>
          </div>
        </div>
        <div id="ofxTableWrap" class="ofx-table-wrap"></div>
      </div>

      <div id="ofxHistory" class="ofx-history hidden">
        <h4>📋 Histórico de importações</h4>
        <div id="ofxHistoryList"></div>
      </div>
    </div>

    ${rows.length ? `
    <div class="ofx-kpi-grid">
      ${rows.map((row) => `
        <div class="ofx-kpi-card">
          <div class="ofx-kpi-bank">${svgText(row.bank || row.name)}</div>
          <div class="ofx-kpi-name">${svgText(row.name)}</div>
          <div class="ofx-kpi-saldo ${row.saldoFinal >= 0 ? "ofx-entrada" : "ofx-saida"}">${asMoney(row.saldoFinal)}</div>
          <div class="ofx-kpi-detail">
            <span class="ofx-entrada">▲ ${asMoney(row.entradasRealizadas)}</span>
            <span class="ofx-saida">▼ ${asMoney(row.saidasRealizadas)}</span>
          </div>
          <div class="ofx-kpi-status">${svgText(row.status || "")}</div>
        </div>
      `).join("")}
    </div>` : ""}

    ${rows.length ? table("Resumo por conta", rows, ["name", "bank", "entradasRealizadas", "saidasRealizadas", "saldoFinal", "status"]) : '<div class="empty">Nenhuma conta bancária cadastrada.<br>Acesse Cadastros → Contas bancárias para adicionar — só nome e banco são obrigatórios.</div>'}
  `;

  // CSP sem script inline: todos os eventos via addEventListener.
  qs("btnOfxOpen")?.addEventListener("click", () => {
    qs("ofxPanel").classList.remove("hidden");
    qs("ofxPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  qs("btnOfxClose")?.addEventListener("click", () => {
    qs("ofxPanel").classList.add("hidden");
    qs("ofxPreview")?.classList.add("hidden");
    ofxTransacoes = [];
  });
  qs("ofxFile")?.addEventListener("change", (event) => {
    qs("ofxFileName").textContent = event.target.files?.[0]?.name || "Nenhum arquivo selecionado";
  });
  qs("btnOfxPreview")?.addEventListener("click", carregarPreviewOFX);
  qs("btnOfxMarkAll")?.addEventListener("click", () => selecionarTodosOFX(true));
  qs("btnOfxUnmarkAll")?.addEventListener("click", () => selecionarTodosOFX(false));
  qs("btnOfxImport")?.addEventListener("click", confirmarImportacaoOFX);
  // Delegação: a tabela da prévia é re-renderizada, o listener no wrap persiste.
  qs("ofxTableWrap")?.addEventListener("change", (event) => {
    if (event.target.id === "ofxCheckAll") {
      selecionarTodosOFX(event.target.checked);
      return;
    }
    const checkbox = event.target.closest(".ofx-check");
    if (!checkbox) return;
    const index = Number(checkbox.dataset.idx);
    if (ofxTransacoes[index]) ofxTransacoes[index].import = checkbox.checked;
  });
  qs("ofxTableWrap")?.addEventListener("click", (event) => {
    const conciliar = event.target.closest(".ofx-btn-conciliar");
    if (conciliar) {
      conciliarTransacao(Number(conciliar.dataset.idx), conciliar.dataset.table, Number(conciliar.dataset.recordId));
      return;
    }
    const avulso = event.target.closest(".ofx-btn-avulso");
    if (avulso) importarAvulso(Number(avulso.dataset.idx));
  });

  if (canImportOfx) carregarHistoricoOFX();
}

// ── Importação OFX ───────────────────────────────────────────────────────────

let ofxTransacoes = []; // estado da prévia atual

async function carregarPreviewOFX() {
  const accountId = qs("ofxBankAccount")?.value;
  const file = qs("ofxFile")?.files?.[0];
  if (!accountId) return alert("Selecione a conta bancária.");
  if (!file) return alert("Selecione um arquivo OFX.");

  const btn = qs("btnOfxPreview");
  btn.disabled = true;
  btn.textContent = "Carregando…";
  try {
    const form = new FormData();
    form.append("ofx", file);
    form.append("bankAccountId", accountId);
    const payload = await fetchForm("ofx-preview", form);
    ofxTransacoes = payload.data.transactions;
    renderizarPreviewOFX(payload.data);
  } catch (error) {
    alert(`Erro ao processar o arquivo: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "🔍 Carregar e verificar";
  }
}

function renderizarPreviewOFX(data) {
  qs("ofxPreview").classList.remove("hidden");
  const autoMatches = ofxTransacoes.filter((txn) => !txn.duplicate && txn.autoMatch).length;
  const semMatch = ofxTransacoes.filter((txn) => !txn.duplicate && !txn.autoMatch).length;
  qs("ofxPreviewInfo").innerHTML = `
    <span class="ofx-badge">🏦 ${svgText(data.account.name)}</span>
    <span class="ofx-badge ofx-badge-green">✅ ${data.newCount} novas</span>
    <span class="ofx-badge ofx-badge-blue">🔗 ${autoMatches} com match</span>
    <span class="ofx-badge ofx-badge-yellow">❓ ${semMatch} sem match</span>
    <span class="ofx-badge ofx-badge-gray">⏭️ ${data.skipCount} já importadas</span>
  `;
  qs("ofxTableWrap").innerHTML = `
    <table class="ofx-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="ofxCheckAll" checked /></th>
          <th>Data</th><th>Descrição (OFX)</th><th>Tipo</th><th>Valor</th><th>Match encontrado</th><th>Ação</th>
        </tr>
      </thead>
      <tbody>
        ${ofxTransacoes.map((txn, index) => {
          const tipoHtml = `<span class="ofx-type ${txn.type === "Entrada" ? "ofx-entrada" : "ofx-saida"}">${txn.type === "Entrada" ? "▲" : "▼"} ${txn.type}</span>`;
          const valorHtml = `<span class="ofx-amount ${txn.type === "Entrada" ? "ofx-entrada" : "ofx-saida"}">${txn.type === "Entrada" ? "+" : "-"} ${asMoney(txn.amount)}</span>`;
          if (txn.duplicate) {
            return `
              <tr class="ofx-dup" data-idx="${index}">
                <td><input type="checkbox" disabled /></td>
                <td>${asDate(txn.date)}</td>
                <td class="ofx-memo" title="${svgText(txn.memo)}">${svgText(txn.memo)}</td>
                <td>${tipoHtml}</td><td>${valorHtml}</td>
                <td colspan="2"><span class="ofx-badge ofx-badge-gray">⏭️ Já importado</span></td>
              </tr>`;
          }
          const match = txn.autoMatch || txn.matches?.[0] || null;
          const matchHtml = match ? `
            <div class="ofx-match">
              <span class="ofx-match-conf ${match.confidence >= 85 ? "ofx-match-conf-high" : "ofx-match-conf-med"}">${match.confidence}% confiança</span>
              <span class="ofx-match-doc" title="${svgText(match.document)}">${svgText(match.document)}</span>
              <span class="ofx-match-date">venc. ${asDate(match.dueDate)}</span>
              ${match.alreadyPaid
                ? '<span class="ofx-badge ofx-badge-yellow">⚠️ Já baixado manualmente</span>'
                : `<span class="ofx-badge ofx-badge-green">${match.table === "accounts_payable" ? "A Pagar" : "A Receber"}</span>`}
            </div>`
            : '<span class="ofx-badge ofx-badge-gray">Sem match — entrada avulsa</span>';
          const acaoHtml = `
            <div class="ofx-acoes">
              ${match ? `<button class="primary ofx-btn-conciliar" data-idx="${index}" data-table="${match.table}" data-record-id="${match.id}" type="button">🔗 Conciliar</button>` : ""}
              <button class="secondary ofx-btn-avulso" data-idx="${index}" type="button" title="Importar sem vincular a título">➕ Avulso</button>
            </div>`;
          return `
            <tr data-idx="${index}">
              <td><input type="checkbox" class="ofx-check" data-idx="${index}" checked /></td>
              <td>${asDate(txn.date)}</td>
              <td class="ofx-memo" title="${svgText(txn.memo)}">${svgText(txn.memo)}</td>
              <td>${tipoHtml}</td><td>${valorHtml}</td>
              <td>${matchHtml}</td>
              <td>${acaoHtml}</td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
  ofxTransacoes.forEach((txn) => { txn.import = !txn.duplicate; });
}

// Marca a linha como resolvida (conciliada/avulsa) sem re-renderizar a tabela:
// preserva o estado dos demais checkboxes e o scroll do usuário.
function marcarLinhaOfxResolvida(index, badgeHtml) {
  const row = qs("ofxTableWrap")?.querySelector(`tr[data-idx="${index}"]`);
  if (!row) return;
  row.classList.add("ofx-dup");
  const checkbox = row.querySelector(".ofx-check");
  if (checkbox) { checkbox.checked = false; checkbox.disabled = true; }
  const cells = row.querySelectorAll("td");
  if (cells.length >= 7) {
    cells[5].innerHTML = badgeHtml;
    cells[6].innerHTML = "";
  }
  const txn = ofxTransacoes[index];
  if (txn) { txn.import = false; txn.duplicate = true; }
}

// Conciliar: baixa a conta a pagar/receber vinculando a transação do extrato
// (título já baixado manualmente é só vinculado, sem mudar status).
async function conciliarTransacao(index, table, recordId) {
  const txn = ofxTransacoes[index];
  if (!txn) return;
  const bankAccountId = Number(qs("ofxBankAccount")?.value || 0);
  const match = txn.autoMatch || txn.matches?.[0];
  if (match?.alreadyPaid && !confirm(`Este título já foi baixado manualmente como "${match.status}".\n\nVincular o extrato ao registro existente sem alterar o status?`)) {
    return;
  }
  const btn = qs("ofxTableWrap")?.querySelector(`.ofx-btn-conciliar[data-idx="${index}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "Conciliando…"; }
  try {
    const payload = await apiRequest("ofx-conciliar", {
      method: "POST",
      body: JSON.stringify({
        fitid: txn.fitid, table, recordId, bankAccountId,
        date: txn.date, amount: txn.amount, type: txn.type, memo: txn.memo,
      }),
    });
    marcarLinhaOfxResolvida(index, `<span class="ofx-badge ofx-badge-green">✅ ${payload.data.linkedOnly ? "Vinculado" : `Conciliado — ${payload.data.status}`}</span>`);
    showToast(payload.message || "Conciliado com sucesso.");
    refreshData().catch(() => {}); // atualiza db em segundo plano, sem fechar o painel
  } catch (error) {
    alert(`Erro ao conciliar: ${error.message}`);
    if (btn) { btn.disabled = false; btn.textContent = "🔗 Conciliar"; }
  }
}

// Importar avulso: a transação entra como movimento de caixa sem baixar título.
async function importarAvulso(index) {
  const txn = ofxTransacoes[index];
  if (!txn) return;
  const bankAccountId = Number(qs("ofxBankAccount")?.value || 0);
  const btn = qs("ofxTableWrap")?.querySelector(`.ofx-btn-avulso[data-idx="${index}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "Importando…"; }
  try {
    const payload = await apiRequest("ofx-import", {
      method: "POST",
      body: JSON.stringify({
        bankAccountId,
        fileName: qs("ofxFile")?.files?.[0]?.name || "extrato.ofx",
        transactions: [{ fitid: txn.fitid, date: txn.date, amount: txn.amount, type: txn.type, memo: txn.memo, import: true }],
      }),
    });
    if (!payload.data.imported) {
      alert("A transação não foi importada (já existia para esta conta).");
    }
    marcarLinhaOfxResolvida(index, '<span class="ofx-badge ofx-badge-blue">➕ Importado avulso</span>');
    showToast("➕ Movimento avulso importado.");
    refreshData().catch(() => {});
  } catch (error) {
    alert(`Erro ao importar: ${error.message}`);
    if (btn) { btn.disabled = false; btn.textContent = "➕ Avulso"; }
  }
}

function selecionarTodosOFX(checked) {
  document.querySelectorAll(".ofx-check:not(:disabled)").forEach((checkbox) => {
    checkbox.checked = checked;
    const index = Number(checkbox.dataset.idx);
    if (ofxTransacoes[index]) ofxTransacoes[index].import = checked;
  });
}

async function confirmarImportacaoOFX() {
  const select = qs("ofxBankAccount");
  const accountId = Number(select?.value || 0);
  const accountName = select?.selectedOptions?.[0]?.textContent.trim() || "";
  const fileName = qs("ofxFile")?.files?.[0]?.name || "extrato.ofx";
  const selecionadas = ofxTransacoes.filter((txn) => txn.import && !txn.duplicate);
  if (!selecionadas.length) return alert("Nenhuma transação selecionada para importar.");
  if (!confirm(`Importar ${selecionadas.length} transações para "${accountName}"?`)) return;

  const btn = qs("btnOfxImport");
  btn.disabled = true;
  btn.textContent = "Importando…";
  try {
    const payload = await apiRequest("ofx-import", {
      method: "POST",
      body: JSON.stringify({ bankAccountId: accountId, fileName, transactions: ofxTransacoes }),
    });
    showToast(`✅ ${payload.data.imported} transações importadas, ${payload.data.skipped} ignoradas.`);
    ofxTransacoes = [];
    // Os movimentos novos vieram do servidor: refaz o bootstrap e re-renderiza
    // (o painel fecha junto; o histórico recarrega no render).
    await refreshAndRender();
  } catch (error) {
    alert(`Erro ao importar: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "📥 Importar selecionados";
  }
}

async function carregarHistoricoOFX() {
  const panel = qs("ofxHistory");
  const list = qs("ofxHistoryList");
  if (!panel || !list) return;
  try {
    const payload = await apiRequest("ofx-history");
    const rows = payload.data || [];
    if (!rows.length) return;
    panel.classList.remove("hidden");
    list.innerHTML = `
      <table class="ofx-table">
        <thead>
          <tr><th>Data importação</th><th>Conta</th><th>Arquivo</th><th>Período</th><th>Importadas</th><th>Ignoradas</th></tr>
        </thead>
        <tbody>
          ${rows.map((item) => `
            <tr>
              <td>${item.importedAt ? new Date(String(item.importedAt).replace(" ", "T")).toLocaleString("pt-BR") : ""}</td>
              <td>${svgText(item.bankAccountName)}</td>
              <td class="ofx-memo" title="${svgText(item.fileName)}">${svgText(item.fileName)}</td>
              <td>${item.dateStart ? asDate(item.dateStart) : "—"} a ${item.dateEnd ? asDate(item.dateEnd) : "—"}</td>
              <td><span class="ofx-badge ofx-badge-green">${Number(item.imported) || 0}</span></td>
              <td><span class="ofx-badge ofx-badge-gray">${Number(item.skipped) || 0}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch { /* histórico é informativo: falha silenciosa */ }
}

// ── Importação de XML NFS-e (padrão ABRASF) ─────────────────────────────────

let nfseData = []; // NFs da prévia atual
let nfseXmlFile = ""; // nome do XML salvo no servidor (vira xmlPath das NFs)
let drawerNfseIdx = null; // índice da NF em nfseData usado pelo drawer de cadastro rápido
let fiscalSoSemObra = false; // filtro "Sem obra" da listagem de Documentos Fiscais

// Chip "Sem obra" no cabeçalho de Documentos Fiscais: localiza NFs importadas
// sem obra para reclassificar. Disponível também em modo leitura (é só um filtro
// de exibição) e some quando não há nota sem obra nem filtro ativo.
function setupFiscalSemObraFilter() {
  const head = qs("content")?.querySelector(".module-head");
  if (!head || qs("btnFiscalSemObra")) return;
  const semObra = (db.fiscalDocuments || []).filter((doc) => !doc.projectId).length;
  if (!semObra && !fiscalSoSemObra) return;
  const btn = document.createElement("button");
  btn.id = "btnFiscalSemObra";
  btn.type = "button";
  btn.className = fiscalSoSemObra ? "primary" : "secondary";
  btn.textContent = fiscalSoSemObra ? `Mostrando sem obra (${semObra}) ✕` : `🏗️ Sem obra (${semObra})`;
  const ancora = head.querySelector("#btnImportarNfse") || head.querySelector("#newRecord");
  head.insertBefore(btn, ancora || null);
  btn.addEventListener("click", () => {
    fiscalSoSemObra = !fiscalSoSemObra;
    renderCrud("fiscalDocuments");
  });
}

// Injetado pelo renderCrud quando o módulo é fiscalDocuments: botão no
// cabeçalho + modal em dois passos (upload/configuração → prévia em lote).
function setupNfseImport() {
  if (!canEditModule("fiscalDocuments")) return;
  const head = qs("content").querySelector(".module-head");
  if (head && !qs("btnImportarNfse")) {
    const btn = document.createElement("button");
    btn.id = "btnImportarNfse";
    btn.className = "secondary";
    btn.type = "button";
    btn.textContent = "📄 Importar XML NFS-e";
    const novo = head.querySelector("#newRecord");
    if (novo) head.insertBefore(btn, novo);
    else head.appendChild(btn);
  }
  qs("content").insertAdjacentHTML("beforeend", `
    <div id="modalNfse" class="nfse-overlay hidden">
      <div class="nfse-box">
        <div class="nfse-head">
          <h3>📄 Importar XML NFS-e</h3>
          <button id="btnFecharNfse" class="nfse-close" type="button" aria-label="Fechar">✕</button>
        </div>
        <div id="nfseStep1">
          <p class="nfse-hint">Selecione o XML exportado da prefeitura (padrão ABRASF) — aceita arquivo com várias NFS-e. NFs emitidas pela empresa viram <strong>Contas a Receber</strong>; NFs de fornecedores viram <strong>Contas a Pagar</strong>. A <strong>obra é opcional</strong> e pode ser definida por nota na próxima etapa.</p>
          <div class="nfse-form">
            <label class="ofx-label">
              Arquivo XML NFS-e
              <div class="ofx-file-wrap">
                <span class="ofx-file-btn">📂 Escolher arquivo</span>
                <input id="nfseFile" type="file" accept=".xml" class="ofx-file-input" />
                <span id="nfseFileName" class="ofx-file-name">Nenhum arquivo selecionado</span>
              </div>
            </label>
          </div>
          <div class="nfse-actions">
            <button id="btnNfsePreview" class="primary" type="button">🔍 Analisar XML</button>
          </div>
        </div>
        <div id="nfseStep2" class="hidden">
          <div id="nfseResumo" class="ofx-info"></div>
          <div id="nfseTableWrap" class="ofx-table-wrap nfse-table-wrap"></div>
          <div class="nfse-actions">
            <button class="secondary" id="btnNfseVoltar" type="button">← Voltar</button>
            <button class="primary" id="btnNfseImportar" type="button">📥 Importar selecionadas</button>
          </div>
        </div>
      </div>
    </div>
  `);

  qs("btnImportarNfse")?.addEventListener("click", () => {
    qs("modalNfse").classList.remove("hidden");
    qs("nfseStep1").classList.remove("hidden");
    qs("nfseStep2").classList.add("hidden");
    nfseData = [];
    nfseXmlFile = "";
  });
  qs("btnFecharNfse")?.addEventListener("click", fecharModalNfse);
  qs("modalNfse")?.addEventListener("click", (event) => {
    if (event.target === qs("modalNfse")) fecharModalNfse();
  });
  qs("nfseFile")?.addEventListener("change", (event) => {
    qs("nfseFileName").textContent = event.target.files?.[0]?.name || "Nenhum arquivo selecionado";
  });
  qs("btnNfsePreview")?.addEventListener("click", analisarNfseXml);
  qs("btnNfseVoltar")?.addEventListener("click", () => {
    qs("nfseStep1").classList.remove("hidden");
    qs("nfseStep2").classList.add("hidden");
  });
  qs("btnNfseImportar")?.addEventListener("click", importarNfsesSelecionadas);
  // Delegação dos checkboxes (a tabela da prévia é re-renderizada).
  qs("nfseTableWrap")?.addEventListener("change", (event) => {
    if (event.target.id === "nfseCheckAll") {
      qs("nfseTableWrap").querySelectorAll(".nfse-cb:not(:disabled)").forEach((checkbox) => {
        checkbox.checked = event.target.checked;
        const index = Number(checkbox.dataset.idx);
        if (nfseData[index]) nfseData[index].importar = event.target.checked;
      });
      return;
    }
    const obraSel = event.target.closest(".nfse-obra-sel");
    if (obraSel) {
      const index = Number(obraSel.dataset.idx);
      if (nfseData[index]) nfseData[index].projectId = Number(obraSel.value) || null;
      return;
    }
    const checkbox = event.target.closest(".nfse-cb");
    if (!checkbox) return;
    const index = Number(checkbox.dataset.idx);
    if (nfseData[index]) nfseData[index].importar = checkbox.checked;
  });
  qs("nfseTableWrap")?.addEventListener("click", (event) => {
    const button = event.target.closest(".nfse-btn-cadastrar");
    if (!button) return;
    abrirDrawerNfseEntidade(Number(button.dataset.idx));
  });
}

function fecharModalNfse() {
  qs("modalNfse")?.classList.add("hidden");
  fecharDrawerNfseEntidade();
  nfseData = [];
  nfseXmlFile = "";
}

async function analisarNfseXml() {
  const file = qs("nfseFile")?.files?.[0];
  if (!file) return alert("Selecione um arquivo XML.");
  const btn = qs("btnNfsePreview");
  btn.disabled = true;
  btn.textContent = "Analisando…";
  try {
    const form = new FormData();
    form.append("xml", file);
    const payload = await fetchForm("nfse-preview", form);
    nfseData = payload.data.nfses;
    nfseXmlFile = payload.data.xmlFile || "";
    renderizarPreviewNfse(payload.data);
    qs("nfseStep1").classList.add("hidden");
    qs("nfseStep2").classList.remove("hidden");
  } catch (error) {
    alert(`Erro ao analisar o XML: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "🔍 Analisar XML";
  }
}

function renderizarPreviewNfse(data) {
  const naoEncontrados = nfseData.filter((nf) => !nf.entityId && !nf.jaImportada).length;
  const projetoOpcoes = (db.projects || []).map((project) => `<option value="${Number(project.id) || svgText(project.id)}">${svgText(project.name)}</option>`).join("");
  qs("nfseResumo").innerHTML = `
    <div class="nfse-badges">
      <span class="ofx-badge">📄 ${data.total} NFS-e no arquivo</span>
      <span class="ofx-badge ofx-badge-green">▲ ${data.emitidas} emitidas → A Receber</span>
      <span class="ofx-badge ofx-badge-yellow">▼ ${data.recebidas} recebidas → A Pagar</span>
      <span class="ofx-badge">💰 Total: ${asMoney(data.valorTotal)}</span>
    </div>
    <div class="nfse-obra-bar">
      <span>🏗️ A obra é opcional: defina por nota na coluna "Obra", ou aplique uma de uma vez às que ficarem sem obra.</span>
      <select id="nfseObraGlobal">
        <option value="">— escolher obra —</option>
        ${projetoOpcoes}
      </select>
      <button id="btnNfseObraAplicar" class="secondary" type="button">Aplicar às vazias</button>
    </div>
    ${naoEncontrados > 0 ? `
    <div class="nfse-criar-box">
      <label class="nfse-criar-label">
        <input type="checkbox" id="nfseAutoCreate" checked />
        <div>
          <strong>Criar automaticamente ${naoEncontrados} ${naoEncontrados === 1 ? "cliente/fornecedor" : "clientes/fornecedores"} não cadastrado${naoEncontrados === 1 ? "" : "s"}</strong>
          <p>Os dados serão preenchidos a partir do XML (nome, CNPJ/CPF, endereço, e-mail, telefone). Você poderá completar as informações depois em Cadastros.</p>
        </div>
      </label>
    </div>` : ""}
  `;
  qs("nfseTableWrap").innerHTML = `
    <table class="ofx-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="nfseCheckAll" checked /></th>
          <th>NF</th><th>Emissão</th><th>Cliente/Fornecedor</th><th>Discriminação</th><th>Valor líquido</th><th>Destino</th><th>Obra (opcional)</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${nfseData.map((nf, index) => {
          const party = nfseParteEntidade(nf);
          const doc = party.cnpj || party.cpf || "";
          const entidadeHtml = nfseEntidadePreviewHtml(nf, party, doc, index);
          const resumoDisc = nf.discriminacao.length > 60 ? `${nf.discriminacao.slice(0, 60)}…` : nf.discriminacao;
          const obraCell = nf.jaImportada
            ? '<span class="muted">—</span>'
            : `<select class="nfse-obra-sel" data-idx="${index}">${nfseProjectOptions(nf.projectId)}</select>`;
          return `
            <tr data-nfse-idx="${index}" class="${nf.jaImportada ? "ofx-dup" : ""}">
              <td><input type="checkbox" class="nfse-cb" data-idx="${index}" ${nf.jaImportada ? "disabled" : "checked"} /></td>
              <td><strong>${svgText(nf.numero)}</strong></td>
              <td>${asDate(nf.dataEmissao)}</td>
              <td class="nfse-cell-entidade">${entidadeHtml}</td>
              <td class="ofx-memo" title="${svgText(nf.discriminacao)}">${svgText(resumoDisc)}</td>
              <td class="ofx-amount ${nf.tipo === "emitida" ? "ofx-entrada" : "ofx-saida"}">${nf.tipo === "emitida" ? "+" : "-"} ${asMoney(nf.valorLiquido)}</td>
              <td><span class="ofx-badge ${nf.tipo === "emitida" ? "ofx-badge-green" : "ofx-badge-yellow"}">${nf.tipo === "emitida" ? "▲ A Receber" : "▼ A Pagar"}</span></td>
              <td class="nfse-cell-obra">${obraCell}</td>
              <td>${nf.jaImportada ? '<span class="ofx-badge ofx-badge-gray">⏭️ Já importada</span>' : '<span class="ofx-badge ofx-badge-green">✅ Nova</span>'}</td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
  nfseData.forEach((nf) => {
    nf.importar = !nf.jaImportada;
    if (nf.projectId === undefined) nf.projectId = null;
  });
  qs("btnNfseObraAplicar")?.addEventListener("click", aplicarObraGlobalNfse);
}

// Opções do <select> de obra por NF: "— sem obra —" + obras, marcando a atual.
function nfseProjectOptions(selectedId) {
  const opcoes = (db.projects || []).map((project) => {
    const value = Number(project.id) || svgText(project.id);
    const sel = sameId(project.id, selectedId) ? " selected" : "";
    return `<option value="${value}"${sel}>${svgText(project.name)}</option>`;
  }).join("");
  return `<option value=""${selectedId ? "" : " selected"}>— sem obra —</option>${opcoes}`;
}

// Aplica a obra escolhida no seletor global só às NFs que ainda estão sem obra
// (não sobrescreve escolhas feitas linha a linha).
function aplicarObraGlobalNfse() {
  const value = Number(qs("nfseObraGlobal")?.value || 0) || null;
  if (!value) return alert("Escolha uma obra para aplicar às NFs sem obra.");
  let aplicadas = 0;
  nfseData.forEach((nf, index) => {
    if (nf.jaImportada || nf.projectId) return;
    nf.projectId = value;
    const sel = qs("nfseTableWrap")?.querySelector(`.nfse-obra-sel[data-idx="${index}"]`);
    if (sel) sel.value = String(value);
    aplicadas++;
  });
  showToast(aplicadas
    ? `🏗️ Obra aplicada a ${aplicadas} NF${aplicadas === 1 ? "" : "s"} sem obra.`
    : "Todas as NFs já têm obra — nada a aplicar.");
}

function nfseParteEntidade(nf) {
  return nf?.tipo === "emitida" ? (nf.tomador || {}) : (nf.prestador || {});
}

function nfseEntidadePreviewHtml(nf, party, doc, index) {
  if (nf.entityId) {
    return `
      <div class="nfse-entity">${svgText(nf.entityNome || party.nome || "—")}</div>
      <div class="nfse-entity-ok">✅ Cadastrado — vinculado automaticamente</div>
    `;
  }
  if (nf.jaImportada) {
    return `
      <div class="nfse-entity muted">${svgText(nf.entityNome || party.nome || "—")}</div>
    `;
  }
  return `
    <div class="nfse-entity">${svgText(party.nome || "—")}</div>
    <div class="nfse-entity-missing">
      <span class="nfse-entity-warn">⚠️ ${svgText(maskDocument(doc))} — não cadastrado</span>
      <button class="nfse-btn-cadastrar" data-idx="${index}" type="button">+ Cadastrar agora</button>
    </div>
  `;
}

function abrirDrawerNfseEntidade(index) {
  const nf = nfseData[index];
  if (!nf || nf.entityId || nf.jaImportada) return;
  const party = nfseParteEntidade(nf);
  const docDigits = onlyDigits((party.cnpj || party.cpf || ""));
  if (!docDigits) {
    alert("A NFS-e não trouxe CPF/CNPJ para cadastrar automaticamente esta entidade.");
    return;
  }

  drawerNfseIdx = index;
  const emitida = nf.tipo === "emitida";
  const isPF = docDigits.length === 11;
  qs("drawerNfsetitulo").textContent = emitida ? "Cadastrar cliente" : "Cadastrar fornecedor";
  qs("drawerNfsesubtitle").textContent = `Dados da NFS-e ${nf.numero} — revise e complete antes de salvar.`;
  qs("drawerNome").value = party.nome || "";
  qs("drawerDocumento").value = maskDocument(docDigits);
  qs("drawerTipo").value = isPF ? "PF" : "PJ";
  qs("drawerCep").value = party.cep ? maskCep(party.cep) : "";
  qs("drawerEndereco").value = party.endereco || "";
  qs("drawerNumero").value = party.numero || "";
  qs("drawerBairro").value = party.bairro || "";
  qs("drawerCidade").value = party.cidade || "";
  qs("drawerUf").value = String(party.uf || "").slice(0, 2).toUpperCase();
  qs("drawerEmail").value = party.email || "";
  qs("drawerTelefone").value = party.telefone ? maskPhone(party.telefone) : "";
  qs("drawerStatus").value = "Ativo";
  qs("drawerNfseIdx").value = String(index);
  qs("drawerEntidadeTipo").value = emitida ? "clients" : "suppliers";
  qs("drawerNome").style.borderColor = "";

  qs("drawerNfseEntidade").classList.remove("hidden");
  qs("drawerNfseOverlay").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => (qs("drawerNome").value ? qs("drawerEmail") : qs("drawerNome"))?.focus(), 100);
}

function fecharDrawerNfseEntidade() {
  qs("drawerNfseEntidade")?.classList.add("hidden");
  qs("drawerNfseOverlay")?.classList.add("hidden");
  document.body.style.overflow = "";
  drawerNfseIdx = null;
}

async function salvarDrawerNfseEntidade() {
  const index = Number(qs("drawerNfseIdx")?.value);
  const nf = nfseData[index];
  const nome = qs("drawerNome")?.value.trim() || "";
  const table = qs("drawerEntidadeTipo")?.value || "";
  const documento = onlyDigits(qs("drawerDocumento")?.value || "");
  if (!nf || !["clients", "suppliers"].includes(table)) return;
  if (!nome) {
    qs("drawerNome").style.borderColor = "var(--red)";
    qs("drawerNome").focus();
    return;
  }
  if (!documento) return alert("CPF/CNPJ obrigatório.");

  const btn = qs("btnSalvarDrawerNfse");
  btn.disabled = true;
  btn.textContent = "Salvando...";
  try {
    const payload = await apiRequest("nfse-cadastrar-entidade", {
      method: "POST",
      body: JSON.stringify({
        table,
        nome,
        documento,
        endereco: qs("drawerEndereco").value.trim(),
        numero: qs("drawerNumero").value.trim(),
        bairro: qs("drawerBairro").value.trim(),
        cidade: qs("drawerCidade").value.trim(),
        uf: qs("drawerUf").value.trim().toUpperCase(),
        cep: onlyDigits(qs("drawerCep").value),
        email: qs("drawerEmail").value.trim(),
        telefone: qs("drawerTelefone").value.trim(),
        status: qs("drawerStatus").value,
      }),
    });
    const entity = payload.data || {};
    nf.entityId = entity.id;
    nf.entityNome = entity.nomeFormatado || nome;
    atualizarLinhaPreviewNfse(index, nf.entityId, nf.entityNome);
    // Propaga para NFs irmãs do mesmo lote (mesmo CPF/CNPJ): o backend já evita
    // duplicar o cadastro; aqui só refletimos na prévia para o usuário não ter
    // de clicar "Cadastrar agora" de novo em cada linha repetida da entidade.
    let vinculadas = 1;
    nfseData.forEach((outra, i) => {
      if (i === index || outra.entityId || outra.jaImportada) return;
      const p = nfseParteEntidade(outra);
      if (onlyDigits(p.cnpj || p.cpf || "") !== documento) return;
      outra.entityId = entity.id;
      outra.entityNome = entity.nomeFormatado || nome;
      atualizarLinhaPreviewNfse(i, outra.entityId, outra.entityNome);
      vinculadas++;
    });
    atualizarResumoEntidadesNfse();
    fecharDrawerNfseEntidade();
    const alvo = vinculadas > 1 ? `${vinculadas} NFs deste lote` : `NF ${nf.numero}`;
    showToast(`✅ ${table === "clients" ? "Cliente" : "Fornecedor"} "${nf.entityNome}" cadastrado e vinculado a ${alvo}.`);
    refreshData().catch(() => {});
  } catch (error) {
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar e vincular à NF";
  }
}

function atualizarLinhaPreviewNfse(index, entityId, nomeFormatado) {
  const row = qs("nfseTableWrap")?.querySelector(`tr[data-nfse-idx="${index}"]`);
  if (!row) return;
  const cell = row.querySelector(".nfse-cell-entidade");
  if (cell) {
    cell.innerHTML = `
      <div class="nfse-entity">${svgText(nomeFormatado || "—")}</div>
      <div class="nfse-entity-ok">✅ Cadastrado e vinculado</div>
    `;
  }
  row.querySelector(".nfse-btn-cadastrar")?.remove();
}

function atualizarResumoEntidadesNfse() {
  const box = qs("nfseResumo")?.querySelector(".nfse-criar-box");
  if (!box) return;
  const naoEncontrados = nfseData.filter((nf) => !nf.entityId && !nf.jaImportada).length;
  if (!naoEncontrados) {
    box.remove();
    return;
  }
  const label = naoEncontrados === 1 ? "cliente/fornecedor" : "clientes/fornecedores";
  box.querySelector("strong").textContent =
    `Criar automaticamente ${naoEncontrados} ${label} não cadastrado${naoEncontrados === 1 ? "" : "s"}`;
}

async function importarNfsesSelecionadas() {
  const selecionadas = nfseData.filter((nf) => nf.importar && !nf.jaImportada);
  if (!selecionadas.length) return alert("Nenhuma NFS-e selecionada para importar.");
  const semObra = selecionadas.filter((nf) => !nf.projectId).length;
  const obraMsg = semObra
    ? `\n\n⚠️ ${semObra} NF${semObra === 1 ? "" : "s"} sem obra — entra${semObra === 1 ? "" : "m"} como "sem projeto"; reclassifique depois pelo filtro "Sem obra".`
    : "";
  if (!confirm(`Importar ${selecionadas.length} NFS-e?\n\n• Emitidas → Contas a Receber\n• Recebidas → Contas a Pagar${obraMsg}\n\nO vencimento entra como a data de emissão — ajuste depois em cada conta.`)) return;

  const criarEntidades = qs("nfseAutoCreate")?.checked ?? false;

  const btn = qs("btnNfseImportar");
  btn.disabled = true;
  btn.textContent = "Importando…";
  try {
    const payload = await apiRequest("nfse-import", {
      method: "POST",
      body: JSON.stringify({
        xmlFile: nfseXmlFile,
        criarEntidades,
        nfses: selecionadas.map((nf) => ({
          numero: nf.numero,
          dataEmissao: nf.dataEmissao,
          valorLiquido: nf.valorLiquido,
          tipo: nf.tipo,
          discriminacao: nf.discriminacao,
          codigoVerificacao: nf.codigoVerificacao,
          entityId: nf.entityId,
          projectId: nf.projectId ?? null,
          tomador: nf.tomador,
          prestador: nf.prestador,
          importar: true,
        })),
      }),
    });
    const criados = payload.data.criados?.length || 0;
    const criadosMsg = criados
      ? `, ${criados} ${criados === 1 ? "cadastro criado" : "cadastros criados"}`
      : "";
    showToast(`✅ ${payload.data.importadas} NFS-e importadas, ${payload.data.duplicatas} já existiam${criadosMsg}.`);
    fecharModalNfse();
    await refreshAndRender(); // NFs + contas a receber/pagar vieram do servidor
  } catch (error) {
    alert(`Erro ao importar: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "📥 Importar selecionadas";
  }
}

let dreMostrarRepasse = true; // DRE: exibir a seção de Repasses (conta de passagem)

function renderDre() {
  const revenue = applyFilters(db.receivable).filter((r) => categoryType(r.categoryId) === "Receita" && r.status !== "Cancelado");
  const expenses = applyFilters(db.payable).filter((p) => categoryType(p.categoryId) !== "Investimento" && categoryType(p.categoryId) !== "Repasse" && p.status !== "Cancelado");
  const grossRevenue = sum(revenue, "amount");
  const operatingExpenses = sum(expenses, "amount");
  const result = grossRevenue - operatingExpenses;
  // Repasses — conta de passagem: material/terceiros que só transitam pela
  // empresa; não compõem o resultado operacional.
  const repasseRecebido = sum(applyFilters(db.receivable).filter((r) => categoryType(r.categoryId) === "Repasse" && r.status !== "Cancelado"), "amount");
  const repassePago = sum(applyFilters(db.payable).filter((p) => categoryType(p.categoryId) === "Repasse" && p.status !== "Cancelado"), "amount");
  const saldoRepasse = repasseRecebido - repassePago;
  qs("content").innerHTML = `
    <label class="dre-toggle-repasse no-print">
      <input type="checkbox" id="dreToggleRepasse" ${dreMostrarRepasse ? "checked" : ""} />
      Incluir seção de Repasses (conta de passagem)
    </label>
    <section class="kpi-grid">
      ${kpi("Receita bruta", grossRevenue)}
      ${kpi("Despesas", operatingExpenses)}
      ${kpi("Resultado gerencial", result)}
      ${kpi("Margem", grossRevenue ? asPercent((result / grossRevenue) * 100) : asPercent(0), false)}
    </section>
    <section class="split">
      <div class="panel"><h3>Receitas por categoria</h3>${bars(groupByCategory(revenue))}</div>
      <div class="panel"><h3>Despesas por categoria</h3>${bars(groupByCategory(expenses).map((r) => ({ ...r, value: -Math.abs(r.value) })))}</div>
    </section>
    ${table("DRE gerencial", [
      { line: "Receita operacional bruta", amount: grossRevenue },
      { line: "Despesas e custos operacionais", amount: -operatingExpenses },
      { line: "Resultado gerencial", amount: result },
    ], ["line", "amount"])}
    ${(dreMostrarRepasse && (repasseRecebido || repassePago)) ? `
      <section class="dre-repasse-section">
        <h3>Repasses de terceiros (conta de passagem)</h3>
        <p class="dre-repasse-nota">Valores de material/terceiros que apenas transitam pela empresa — não compõem o resultado operacional.</p>
        ${table("Repasses", [
          { line: "(+) Repasses recebidos", amount: repasseRecebido },
          { line: "(−) Repasses pagos", amount: -repassePago },
          { line: "Saldo de repasses (idealmente zero)", amount: saldoRepasse },
        ], ["line", "amount"])}
        ${Math.abs(saldoRepasse) > 0.009 ? `<p class="dre-repasse-alerta">⚠️ Saldo de repasse diferente de zero — material recebido ainda não comprado, ou vice-versa.</p>` : ""}
      </section>
    ` : ""}
  `;
  qs("dreToggleRepasse")?.addEventListener("change", (event) => {
    dreMostrarRepasse = event.target.checked;
    renderDre();
  });
}

function renderReports(mode = "reports") {
  const reportMap = {
    reports: {
      title: "Relatórios",
      description: "Resumo executivo das principais visões gerenciais.",
      rows: [
        { report: "Fluxo de caixa", base: "Movimentações de caixa e bancos", total: totals().bankBalance },
        { report: "Inadimplência por cliente", base: "Contas a receber vencidas", total: db.receivable.filter((r) => r.status === "Vencido").reduce((s, r) => s + Number(r.amount || 0), 0) },
        { report: "Resultado por centro de custo", base: "Receitas menos despesas", total: resultByCostCenter().reduce((s, r) => s + r.value, 0) },
        { report: "Lucro por produto/serviço", base: "Preço menos custo cadastrado", total: profitByOffering().reduce((s, r) => s + r.value, 0) },
        { report: "Razão contábil", base: "Lançamentos por competência", total: sum(applyFilters(db.journalEntries), "amount") },
      ],
      fields: ["report", "base", "total"],
    },
    reportFinancial: {
      title: "Relatório financeiro",
      description: "Receita, despesa e resultado agrupados por mês.",
      rows: monthlyResultRows().map((row) => ({ month: monthLabel(row.month), revenue: row.revenue, expense: row.expense, result: row.result })),
      fields: ["month", "revenue", "expense", "result"],
    },
    reportClient: {
      title: "Relatório por cliente",
      description: "Total a receber por cliente, considerando os filtros ativos.",
      rows: groupedReport(applyFilters(db.receivable), "clientId", "clients"),
      fields: ["name", "total"],
    },
    reportSupplier: {
      title: "Relatório por fornecedor",
      description: "Total a pagar por fornecedor, considerando os filtros ativos.",
      rows: groupedReport(applyFilters(db.payable), "supplierId", "suppliers"),
      fields: ["name", "total"],
    },
    reportCostCenter: {
      title: "Relatório por centro de custo",
      description: "Resultado gerencial por centro de custo.",
      rows: dashboardCostCenterRows().map((row) => ({ name: row.label, total: row.value })),
      fields: ["name", "total"],
    },
    reportProject: {
      title: "Relatório por obra/projeto",
      description: "Resultado gerencial por obra ou projeto.",
      rows: resultByProjectRows().map((row) => ({ name: row.label, total: row.value })),
      fields: ["name", "total"],
    },
  };
  const report = reportMap[mode] || reportMap.reports;
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>${report.title}</h2>
        <p>${report.description} Use os filtros superiores e exporte a visão atual em Excel ou PDF.</p>
      </div>
    </section>
    ${report.rows.length ? table(report.title, report.rows, report.fields) : '<div class="empty">Sem dados para exibir</div>'}
    <section class="split">
      <div class="panel"><h3>Fluxo de caixa</h3>${bars(cashFlowByBank())}</div>
      <div class="panel"><h3>Resultado por centro de custo</h3>${bars(resultByCostCenter())}</div>
    </section>
  `;
}

function groupedReport(rows, idField, collection) {
  const grouped = {};
  rows.filter((row) => row.status !== "Cancelado").forEach((row) => {
    const label = nameOf(collection, row[idField]) || "Sem vínculo";
    grouped[label] = (grouped[label] || 0) + Number(row.amount || 0);
  });
  return Object.entries(grouped).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}

function renderExports() {
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Exportações</h2>
        <p>Use os botões superiores para exportar a tabela atual para Excel, gerar PDF ou criar backup JSON no servidor.</p>
      </div>
      <button id="downloadBackupBtn" class="primary" type="button">Backup JSON</button>
    </section>
    ${table("Exportações disponíveis", [
      { report: "Excel", base: "Exporta a primeira tabela da tela atual", status: "Disponível" },
      { report: "PDF", base: "Usa a impressão do navegador, compatível com Apache", status: "Disponível" },
      { report: "Backup servidor", base: "Gera JSON em /var/lib/financeiro/backups e baixa uma cópia", status: serverMode ? "Disponível" : "API indisponível" },
    ], ["report", "base", "status"])}
  `;
  qs("downloadBackupBtn").addEventListener("click", downloadBackup);
}

function renderSystemVersion() {
  const rows = db.systemVersion?.length ? db.systemVersion : seed.systemVersion;
  const editable = canEditModule("systemVersion");
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Versão do ObraSync</h2>
        <p>Controle interno para atualizar arquivos do ObraSync sem tocar no banco, uploads, backups ou config.php.</p>
      </div>
      ${editable ? '<button class="primary" type="button" id="newRecord">Novo registro</button>' : ""}
    </section>
    <section class="version-panel">
      <div>
        <span>Versão atual</span>
        <strong>${APP_VERSION}</strong>
        <small>${asDate(APP_VERSION_DATE)}</small>
      </div>
      <ul>
        ${APP_CHANGELOG.map((item) => `<li>${svgText(item)}</li>`).join("")}
      </ul>
    </section>
    <section class="alerts">
      <div class="alert">Antes de atualizar: faça backup do banco MariaDB/MySQL e da pasta /var/lib/financeiro. Não sobrescreva /etc/financeiro/config.php.</div>
    </section>
    ${table("Histórico de versões", rows, ["versao", "data_versao", "descricao", "alteracoes"], editable)}
  `;
  qs("newRecord")?.addEventListener("click", () => openForm("systemVersion"));
  qs("content").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openForm("systemVersion", button.dataset.edit)));
  qs("content").querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeRecord("systemVersion", button.dataset.delete)));
}

function renderBackupLocal() {
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Backup local/servidor</h2>
        <p>${serverMode ? "Exporte ou importe dados do banco usando a API. O servidor grava backups fora da pasta pública." : "API indisponível. Exporte dados locais antigos apenas para migração."}</p>
      </div>
      <button id="downloadBackupBtn" class="primary" type="button">Baixar backup</button>
    </section>
    <section class="panel backup-panel">
      <label class="full">
        Dados JSON
        <textarea id="backupJson" rows="12" spellcheck="false">${svgText(JSON.stringify(db, null, 2))}</textarea>
      </label>
      <div class="actions">
        <button id="refreshBackupBtn" class="secondary" type="button">Atualizar texto</button>
        <button id="importBackupBtn" class="danger" type="button">Importar JSON</button>
      </div>
    </section>
  `;
  qs("downloadBackupBtn").addEventListener("click", downloadBackup);
  qs("refreshBackupBtn").addEventListener("click", () => qs("backupJson").value = JSON.stringify(db, null, 2));
  qs("importBackupBtn").addEventListener("click", importBackup);
}

async function downloadBackup() {
  try {
    const data = serverMode ? await apiRequest("backup/export") : { data: db };
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json;charset=utf-8" });
    download(blob, `finconta-backup-${new Date().toISOString().slice(0, 10)}.json`);
    if (serverMode && data.file) alert(`Backup salvo no servidor em: ${data.file}`);
  } catch (error) {
    alert(`Não foi possível gerar backup: ${error.message}`);
  }
}

async function importBackup() {
  try {
    const parsed = JSON.parse(qs("backupJson").value);
    if (!parsed || !Array.isArray(parsed.users)) throw new Error("invalid");
    if (!confirm("Importar este backup? A API evita duplicidades quando possível.")) return;
    if (serverMode) {
      await apiRequest("backup/import", { method: "POST", body: JSON.stringify(parsed) });
      await refreshData();
    } else {
      db = parsed;
      saveDb();
    }
    await refreshAndRender();
  } catch {
    alert("JSON inválido para backup do sistema.");
  }
}

function renderMigration() {
  const legacy = safeLocalGet(STORE_KEY);
  let parsed = null;
  try {
    parsed = legacy ? JSON.parse(legacy) : null;
  } catch {
    parsed = null;
  }
  const counts = parsed ? Object.entries(parsed)
    .filter(([, value]) => Array.isArray(value))
    .map(([key, value]) => ({ module: moduleLabels[key] || key, count: value.length })) : [];
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Migração do localStorage para banco</h2>
        <p>Lê os dados antigos deste navegador e envia para o MariaDB/MySQL. Os dados antigos só são removidos se você confirmar depois.</p>
      </div>
      <button id="runMigrationBtn" class="primary" type="button" ${serverMode && parsed ? "" : "disabled"}>Migrar agora</button>
    </section>
    ${!serverMode ? '<div class="empty">API indisponível. Configure o backend PHP antes de migrar.</div>' : ""}
    ${!parsed ? '<div class="empty">Nenhum dado antigo encontrado no localStorage.</div>' : table("Prévia da migração", counts, ["module", "count"])}
    <section id="migrationResult" class="panel hidden"></section>
  `;
  qs("runMigrationBtn")?.addEventListener("click", async () => {
    try {
      const result = await apiRequest("migrate", { method: "POST", body: JSON.stringify(parsed) });
      await refreshData();
      qs("migrationResult").classList.remove("hidden");
      qs("migrationResult").innerHTML = `<h3>Registros importados</h3><pre>${svgText(JSON.stringify(result.imported, null, 2))}</pre><button id="clearLegacyBtn" class="danger" type="button">Remover localStorage antigo</button>`;
      qs("clearLegacyBtn").addEventListener("click", () => {
        if (!confirm("Remover os dados antigos do localStorage deste navegador?")) return;
        try { localStorage.removeItem(STORE_KEY); } catch { /* armazenamento indisponível */ }
        renderMigration();
      });
    } catch (error) {
      alert(`Migração falhou: ${error.message}`);
    }
  });
}

function categoryType(id) {
  return byId("categories", id)?.type || "";
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function groupByCategory(rows) {
  const grouped = {};
  rows.forEach((row) => grouped[row.categoryId] = (grouped[row.categoryId] || 0) + Number(row.amount || 0));
  return Object.entries(grouped).map(([id, value]) => ({ label: nameOf("categories", id) || "Sem categoria", value }));
}

function cashFlowByBank() {
  const grouped = {};
  applyFilters(db.cashMoves).forEach((row) => grouped[row.bankAccount] = (grouped[row.bankAccount] || 0) + signedCashAmount(row));
  return Object.entries(grouped).map(([label, value]) => ({ label, value }));
}

function exportExcel() {
  const tableEl = qs("content").querySelector("table");
  if (!tableEl) return alert("Não há tabela para exportar.");
  const html = `<html><head><meta charset="utf-8"></head><body>${tableEl.outerHTML}</body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  download(blob, `${currentModule}-${new Date().toISOString().slice(0, 10)}.xls`);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function directAccessUser() {
  return db.users.find((item) => item.role === "admin" && item.status === "Ativo")
    || db.users.find((item) => item.status === "Ativo")
    || { id: "direct-admin", username: "admin", fullName: "Acesso direto", role: "admin", status: "Ativo" };
}

function showLogin(message = "") {
  if (AUTH_BYPASS_FOR_TESTS && !serverMode) {
    showApp(directAccessUser());
    return;
  }
  currentUser = null;
  clearAuthSession();
  showLoginPanel("login");
  qs("loginError").textContent = message;
  qs("loginScreen").classList.remove("hidden");
  qs("appShell").classList.add("hidden");
  document.getElementById("favoritesBar")?.classList.add("hidden");
  document.getElementById("favTriggerStrip")?.classList.add("hidden");
  qs("loginPassword").value = "";
  qs("loginUser").focus();
}

function showApp(user) {
  currentUser = user;
  loadUserThemePreference();
  writeAuthSession(user);
  qs("loginScreen").classList.add("hidden");
  qs("appShell").classList.remove("hidden");
  logAudit("login", "sistema", `Login: ${user.username}`);
  scheduleSessionWarning();
  render();
}

async function handleLogin(event) {
  event.preventDefault();
  const username = qs("loginUser").value.trim().toLowerCase();
  const password = qs("loginPassword").value;
  try {
    if (serverMode) {
      const payload = await apiRequest("login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      authToken = payload.token || null;
      writeAuthSession(payload.user);
      if (payload.user.mustChangePassword) {
        // Não chama loadServerData() antes da troca obrigatória: a sessão recém-criada
        // já está na base; qualquer chamada extra entre login e change-password
        // introduz um ponto de falha desnecessário.
        currentUser = payload.user;
        openChangePasswordDialog(true);
        return;
      }
      await loadServerData();
      showApp(payload.user);
      return;
    }
    return showLogin(`Servidor indisponível. Verifique a conexão com a API. (${serverStatus})`);
  } catch (error) {
    showLogin(error.message || "Usuário ou senha inválidos.");
  }
}

function restoreSession() {
  applySidebarWidth();
  setupNav();
  setupThemeSwitch();
  setupFavoritesDialog();
  setupFavoritesHover();
  setupSessionWarning();
  if (AUTH_BYPASS_FOR_TESTS && !serverMode) {
    // Atalho de desenvolvimento: só vale sem API ativa; com servidor, o token é obrigatório.
    showApp(directAccessUser());
    return;
  }
  const session = readAuthSession();
  if (serverMode && session && !session.token) {
    // Sessão antiga sem token de API: força novo login para obter credencial válida.
    clearAuthSession();
    showLogin();
    return;
  }
  const user = session
    ? db.users.find((item) => String(item.id) === String(session.userId) && item.status === "Ativo") || session.user
    : null;
  if (!user) return showLogin();
  // Troca obrigatória pendente: recarregar a página (F5) não pode liberar o app
  // sem a nova senha. Number() cobre 1/"1"/true vindos da API ou do localStorage.
  if (Number(user.mustChangePassword)) {
    // Mesmo visual do login: tela de login ao fundo, modal de troca por cima.
    currentUser = user;
    qs("loginScreen").classList.remove("hidden");
    qs("appShell").classList.add("hidden");
    openChangePasswordDialog(true);
    return;
  }
  showApp(user);
}

// ── Barra de favoritos ──────────────────────────────────────────────────────

function favoritesStorageKey() {
  return `finconta.favorites.${currentUser?.id || "default"}`;
}

function loadFavorites() {
  try {
    const raw = safeLocalGet(favoritesStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch { return []; }
}

function persistFavorites(favs) {
  safeLocalSet(favoritesStorageKey(), JSON.stringify(favs.slice(0, 5)));
}

function moduleInitials(key) {
  const label = moduleLabels[key] || key;
  const words = label.split(/[\s\/]+/).filter((w) => w.length > 2);
  if (!words.length) return label.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function renderFavoritesBar() {
  const bar = document.getElementById("favoritesBar");
  const strip = document.getElementById("favTriggerStrip");
  if (!bar || !currentUser) return;
  const favs = loadFavorites();
  const allowed = new Set(visibleModules().map(([k]) => k));
  const visible = favs.filter((k) => allowed.has(k));
  bar.classList.remove("hidden");
  if (strip) strip.classList.remove("hidden");
  updateFavoritesPosition();
  if (!visible.length) {
    bar.innerHTML = `
      <span class="fav-empty">Nenhum favorito configurado. Clique em</span>
      <button class="fav-edit-btn" id="openFavoritesDialog" type="button" title="Personalizar favoritos">★ Personalizar</button>
      <span class="fav-empty">para configurar seus atalhos.</span>
    `;
  } else {
    bar.innerHTML = `
      <div class="fav-tabs" role="list">
        ${visible.map((k) => `
          <button class="fav-tab${k === currentModule ? " active" : ""}" type="button" data-module="${k}" role="listitem" title="${moduleLabels[k] || k}">
            <span class="fav-icon">${moduleInitials(k)}</span>
            <span class="fav-label">${moduleLabels[k] || k}</span>
          </button>`).join("")}
      </div>
      <button class="fav-edit-btn" id="openFavoritesDialog" type="button" title="Personalizar favoritos">★</button>
    `;
    bar.querySelectorAll(".fav-tab").forEach((btn) => {
      btn.addEventListener("click", () => { currentModule = btn.dataset.module; render(); });
    });
  }
  document.getElementById("openFavoritesDialog")?.addEventListener("click", openFavoritesModal);
}

function openFavoritesModal() {
  favoritesDialogSelections = new Set(loadFavorites());
  const allowed = visibleModules().map(([k]) => k);
  document.getElementById("favoritesPickerList").innerHTML = allowed.map((k) => {
    const checked = favoritesDialogSelections.has(k);
    return `
      <label class="fav-picker-item${checked ? " selected" : ""}">
        <input type="checkbox" value="${k}" ${checked ? "checked" : ""}>
        <span class="fav-picker-icon">${moduleInitials(k)}</span>
        <span class="fav-picker-label">${moduleLabels[k] || k}</span>
      </label>`;
  }).join("");
  document.getElementById("favoritesPickerList").querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) {
        if (favoritesDialogSelections.size >= 5) { cb.checked = false; alert("Máximo de 5 favoritos."); return; }
        favoritesDialogSelections.add(cb.value);
        cb.closest(".fav-picker-item").classList.add("selected");
      } else {
        favoritesDialogSelections.delete(cb.value);
        cb.closest(".fav-picker-item").classList.remove("selected");
      }
    });
  });
  document.getElementById("favoritesDialog").showModal();
}

function setupFavoritesDialog() {
  const dialog = document.getElementById("favoritesDialog");
  const close = () => dialog.close();

  document.getElementById("closeFavoritesDialog").addEventListener("click", close);
  document.getElementById("cancelFavoritesDialog").addEventListener("click", close);

  document.getElementById("saveFavoritesDialog").addEventListener("click", () => {
    if (favoritesDialogSelections.size === 0) {
      alert("Selecione ao menos 1 favorito.");
      return;
    }
    persistFavorites([...favoritesDialogSelections]);
    dialog.close();
    renderFavoritesBar();
  });

  dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom) {
      dialog.close();
    }
  });
}

function setupFavoritesHover() {
  const bar = document.getElementById("favoritesBar");
  const strip = document.getElementById("favTriggerStrip");
  if (!bar || !strip) return;
  let hideTimer;

  function showBar() {
    clearTimeout(hideTimer);
    bar.classList.add("fav-visible");
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!bar.matches(":hover") && !strip.matches(":hover")) {
        bar.classList.remove("fav-visible");
      }
    }, 120); // era 280ms — reduzido para acompanhar a transição mais curta
  }

  strip.addEventListener("mouseenter", showBar);
  strip.addEventListener("mouseleave", scheduleHide);
  bar.addEventListener("mouseenter", showBar);
  bar.addEventListener("mouseleave", scheduleHide);
}

window.addEventListener("resize", () => {
  applySidebarWidth();
});

// ── Segurança — funções centrais ─────────────────────────────────────────────

// Item 10: sanitização de input (remove tags HTML antes de salvar)
function sanitizeInput(value) {
  return String(value ?? "").replace(/<[^>]*>/g, "").trim();
}

// Item 7: validação de senha
function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 8) errors.push("Mínimo de 8 caracteres");
  if (!/[A-Z]/.test(password)) errors.push("Pelo menos uma letra maiúscula");
  if (!/[a-z]/.test(password)) errors.push("Pelo menos uma letra minúscula");
  if (!/[0-9]/.test(password)) errors.push("Pelo menos um número");
  return { valid: errors.length === 0, errors };
}

// Item 8: mascaramento de dados sensíveis
function isSensitiveFieldMasked() {
  return ["visualizador", "operador"].includes(currentUser?.role);
}

function maskedCell(value) {
  return `<span class="masked-cell"><span class="masked-dots">•••••••</span><button class="reveal-btn" type="button" data-original="${svgText(value)}" title="Revelar (somente para você)">Ver</button></span>`;
}

// Item 5: bloquear/desbloquear usuário
async function toggleUserBlock(userId, block) {
  if (!isAdmin()) return;
  const target = byId("users", userId);
  if (!target) return;
  await updateIntegratedRecord("users", userId, { ...target, blocked: block ? 1 : 0 });
  logAudit(block ? "block" : "unblock", "users", `${block ? "Bloqueou" : "Desbloqueou"}: ${target.username}`);
  await refreshAndRender();
}

// Item 3: permissão de deleção por perfil
function canDeleteRecord(key = currentModule) {
  const k = { agendaEvents: "agenda", kanbanBoards: "kanban", kanbanColumns: "kanban", kanbanCards: "kanban" }[key] || key;
  if (isAdmin()) return true;
  if (currentUser?.role === "gerente") return !["users", "permissions"].includes(k);
  if (currentUser?.role === "operador" || currentUser?.role === "visualizador") return false;
  return canEditModule(key);
}

// Item 4: confirmação de ação destrutiva com "CONFIRMAR"
function confirmDestructive(name = "") {
  return new Promise((resolve) => {
    const dialog = document.getElementById("confirmDestructiveDialog");
    if (!dialog) { resolve(confirm("Excluir este registro?")); return; }
    const doBtn = document.getElementById("doDestructiveBtn");
    const cancelBtn = document.getElementById("cancelDestructiveBtn");
    document.getElementById("confirmDestructiveName").textContent = name || "este item";
    function go() { cleanup(); dialog.close(); resolve(true); }
    function cancel() { cleanup(); dialog.close(); resolve(false); }
    function cleanup() {
      doBtn.removeEventListener("click", go);
      cancelBtn.removeEventListener("click", cancel);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("click", onBackdrop);
    }
    function onCancel() { cancel(); }
    function onBackdrop(e) {
      const rect = dialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) cancel();
    }
    doBtn.addEventListener("click", go);
    cancelBtn.addEventListener("click", cancel);
    dialog.addEventListener("cancel", onCancel, { once: true });
    dialog.addEventListener("click", onBackdrop);
    dialog.showModal();
    doBtn.focus();
  });
}

// Item 2: Log de auditoria
const AUDIT_LOG_KEY = "finconta.auditLog";
const AUDIT_MAX_ENTRIES = 500;

function getAuditLog() {
  try { return JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || "[]"); } catch { return []; }
}

function saveAuditLog(entries) {
  safeLocalSet(AUDIT_LOG_KEY, JSON.stringify(entries.slice(-AUDIT_MAX_ENTRIES)));
}

// Abre PDF/XML da nota com fetch autenticado (headers) e blob: o token de sessão
// não aparece mais na URL — antes ficava gravado nos access logs do Apache.
async function downloadFiscalFile(id, kind) {
  try {
    const response = await fetch(`${API_BASE}/${apiResources.fiscalDocuments}/${id}/${kind}`, { headers: authHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    alert(`Não foi possível abrir o arquivo: ${error.message}`);
  }
}

function logAudit(action, module, detail = "") {
  if (!currentUser) return;
  const log = getAuditLog();
  log.push({ id: crypto.randomUUID(), userId: currentUser.id, username: currentUser.username || "", action, module: module || currentModule, detail: String(detail).slice(0, 200), timestamp: new Date().toISOString(), host: location.hostname || "local" });
  saveAuditLog(log);
}

// Tabela do log REAL do servidor (audit_log): registro compartilhado entre
// máquinas e não apagável pelo usuário — o localStorage vira histórico auxiliar.
async function loadServerAuditLog() {
  const container = qs("serverAuditLog");
  if (!container) return;
  try {
    const payload = await apiRequest("audit-log?limit=500");
    const rows = payload.data || [];
    if (!rows.length) {
      container.innerHTML = '<div class="empty">Nenhum registro no servidor ainda.</div>';
      return;
    }
    container.innerHTML = `
      <section class="table-wrap">
        <table>
          <thead><tr><th>Data/hora</th><th>Usuário</th><th>Perfil</th><th>Ação</th><th>Módulo</th><th>Registro</th><th>Detalhes</th><th>IP</th></tr></thead>
          <tbody>${rows.map((r) => `<tr>
            <td>${escapeHtml(r.createdAt || "")}</td>
            <td>${escapeHtml(r.username || "—")}</td>
            <td>${escapeHtml(roleLabels[r.role] || r.role || "—")}</td>
            <td><span class="audit-action a-${escapeHtml(r.action || "")}">${escapeHtml(r.action || "")}</span></td>
            <td>${escapeHtml(moduleLabels[r.module] || r.module || "")}</td>
            <td>${escapeHtml(r.recordId || "")}</td>
            <td>${escapeHtml(r.details || "")}</td>
            <td>${escapeHtml(r.ip || "")}</td>
          </tr>`).join("")}</tbody>
        </table>
      </section>`;
  } catch (error) {
    container.innerHTML = `<div class="empty">Falha ao carregar o log do servidor: ${escapeHtml(error.message)}</div>`;
  }
}

function renderAuditLog() {
  if (!isAdmin()) { qs("content").innerHTML = '<div class="empty">Acesso restrito a administradores.</div>'; return; }
  const all = getAuditLog().slice().reverse();
  qs("content").innerHTML = `
    <section class="module-head">
      <div><h2>Log de Auditoria</h2><p>${serverMode ? "Registro do servidor (compartilhado e permanente) + histórico local deste navegador." : `Histórico de ações (últimas ${AUDIT_MAX_ENTRIES}).`}</p></div>
      <button class="secondary" id="clearAuditLogBtn" type="button">Limpar log local</button>
    </section>
    ${serverMode ? '<h3>Registro do servidor</h3><div id="serverAuditLog" class="empty">Carregando registro do servidor…</div><h3>Histórico local deste navegador</h3>' : ""}
    <section class="audit-filters">
      <label>Usuário<select id="afUser"><option value="">Todos</option>${[...new Set(all.map((e) => e.username))].map((u) => `<option>${svgText(u)}</option>`).join("")}</select></label>
      <label>Módulo<select id="afModule"><option value="">Todos</option>${[...new Set(all.map((e) => e.module))].map((m) => `<option value="${svgText(m)}">${svgText(moduleLabels[m] || m)}</option>`).join("")}</select></label>
      <label>De<input type="date" id="afFrom"></label>
      <label>Até<input type="date" id="afTo"></label>
    </section>
    <div id="auditTableBody">${auditTableHtml(all)}</div>
  `;
  function applyAuditFilters() {
    const u = document.getElementById("afUser").value;
    const m = document.getElementById("afModule").value;
    const f = document.getElementById("afFrom").value;
    const t = document.getElementById("afTo").value;
    let rows = all;
    if (u) rows = rows.filter((e) => e.username === u);
    if (m) rows = rows.filter((e) => e.module === m);
    if (f) rows = rows.filter((e) => e.timestamp >= f);
    if (t) rows = rows.filter((e) => e.timestamp <= t + "T23:59:59Z");
    document.getElementById("auditTableBody").innerHTML = auditTableHtml(rows);
  }
  ["afUser", "afModule", "afFrom", "afTo"].forEach((id) => document.getElementById(id).addEventListener("change", applyAuditFilters));
  document.getElementById("clearAuditLogBtn").addEventListener("click", () => {
    if (!confirm("Apagar o log LOCAL deste navegador? O registro do servidor não é afetado.")) return;
    saveAuditLog([]);
    renderAuditLog();
  });
  if (serverMode) loadServerAuditLog();
}

function auditTableHtml(entries) {
  if (!entries.length) return '<div class="empty">Nenhum registro no log.</div>';
  const cls = { login: "a-login", logout: "a-logout", create: "a-create", edit: "a-edit", delete: "a-delete", block: "a-delete", unblock: "a-login" };
  return `<div class="table-wrap"><table>
    <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Módulo</th><th>Detalhe</th><th>Host</th></tr></thead>
    <tbody>${entries.map((e) => `<tr>
      <td>${new Date(e.timestamp).toLocaleString("pt-BR")}</td>
      <td>${svgText(e.username)}</td>
      <td><span class="audit-action ${cls[e.action] || ""}">${svgText(e.action)}</span></td>
      <td>${svgText(moduleLabels[e.module] || e.module)}</td>
      <td>${svgText(e.detail)}</td>
      <td>${svgText(e.host)}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

// Item 6: histórico de acessos
function logAccess(mod) {
  if (!currentUser || !mod) return;
  const key = `finconta.ah.${currentUser.id}`;
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
  hist.push({ module: mod, label: moduleLabels[mod] || mod, ts: new Date().toISOString() });
  safeLocalSet(key, JSON.stringify(hist.slice(-10)));
}

function getAccessHistory(userId) {
  try { return JSON.parse(localStorage.getItem(`finconta.ah.${userId}`) || "[]"); } catch { return []; }
}

function renderMyProfile() {
  const hist = getAccessHistory(currentUser.id).slice().reverse();
  const blockedStatus = currentUser.blocked ? '<span style="color:var(--red);font-weight:700">Bloqueado</span>' : '<span style="color:var(--green)">Ativo</span>';
  qs("content").innerHTML = `
    <section class="module-head"><div><h2>Meu Perfil</h2><p>${svgText(currentUser.fullName || currentUser.username)}</p></div>
      ${serverMode ? '<button class="secondary" id="openChangePwdBtn" type="button">Alterar senha</button>' : ""}
    </section>
    <section class="profile-card">
      <dl class="profile-dl">
        <dt>Usuário</dt><dd>${svgText(currentUser.username)}</dd>
        <dt>Nome</dt><dd>${svgText(currentUser.fullName || "—")}</dd>
        <dt>Perfil</dt><dd>${roleLabels[currentUser.role] || svgText(currentUser.role)}</dd>
        <dt>Status</dt><dd>${blockedStatus}</dd>
      </dl>
    </section>
    <h3 style="margin-top:24px">Últimos 10 acessos</h3>
    ${hist.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Data/Hora</th><th>Módulo</th></tr></thead>
      <tbody>${hist.map((h) => `<tr><td>${new Date(h.ts).toLocaleString("pt-BR")}</td><td>${svgText(h.label)}</td></tr>`).join("")}</tbody>
    </table></div>` : '<div class="empty">Nenhum acesso registrado ainda.</div>'}
  `;
  document.getElementById("openChangePwdBtn")?.addEventListener("click", openChangePasswordDialog);
}

// Item 1: aviso de expiração de sessão
function scheduleSessionWarning() {
  clearTimeout(sessionWarnTimer);
  if (!currentUser) return;
  sessionWarnTimer = setTimeout(showSessionWarning, AUTH_TIMEOUT_MS - SESSION_WARN_BEFORE_MS);
}

function showSessionWarning() {
  if (!currentUser) return;
  const dialog = document.getElementById("sessionWarningDialog");
  if (!dialog || dialog.open) return;
  dialog.showModal();
  let secs = Math.floor(SESSION_WARN_BEFORE_MS / 1000);
  const countdown = document.getElementById("sessionCountdown");
  clearInterval(sessionWarnIntervalId);
  sessionWarnIntervalId = setInterval(() => {
    secs--;
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, "0");
    if (countdown) countdown.textContent = `${m}:${s}`;
    if (secs <= 0) {
      clearInterval(sessionWarnIntervalId);
      dialog.close();
      logAudit("logout", "sistema", "Sessão expirada por inatividade");
      showLogin("Sessão expirada por inatividade.");
    }
  }, 1000);
}

function setupSessionWarning() {
  document.getElementById("sessionRenewBtn")?.addEventListener("click", () => {
    clearInterval(sessionWarnIntervalId);
    document.getElementById("sessionWarningDialog").close();
    touchAuthSession();
    scheduleSessionWarning();
  });
  document.getElementById("sessionLogoutNowBtn")?.addEventListener("click", () => {
    clearInterval(sessionWarnIntervalId);
    document.getElementById("sessionWarningDialog").close();
    logAudit("logout", "sistema", `Logout manual: ${currentUser?.username}`);
    clearAuthSession();
    showLogin("Você encerrou a sessão.");
  });
}

// ── Força e redefinição de senha ────────────────────────────────────────────

function passwordStrengthCheck(pw) {
  return {
    length:  pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    lower:   /[a-z]/.test(pw),
    number:  /[0-9]/.test(pw),
    special: /[\W_]/.test(pw),
  };
}

function passwordStrengthHtml(pw) {
  if (!pw) return "";
  const c = passwordStrengthCheck(pw);
  const li = (ok, label) => `<li class="${ok ? "req-ok" : "req-fail"}">${ok ? "✓" : "✗"} ${label}</li>`;
  return `<ul class="pwd-reqs">
    ${li(c.length,  "Mínimo 8 caracteres")}
    ${li(c.upper,   "Uma letra maiúscula (A-Z)")}
    ${li(c.lower,   "Uma letra minúscula (a-z)")}
    ${li(c.number,  "Um número (0-9)")}
    ${li(c.special, "Um caractere especial (!@#$%^&*)")}
  </ul>`;
}

function passwordMeetsAllRules(pw) {
  const c = passwordStrengthCheck(pw);
  return c.length && c.upper && c.lower && c.number && c.special;
}

function showLoginPanel(name) {
  document.querySelectorAll(".login-panel").forEach((el) => el.classList.toggle("hidden", el.dataset.panel !== name));
  if (name === "login")  { qs("loginError").textContent = ""; qs("loginUser").focus(); }
  if (name === "forgot") { qs("forgotMsg").textContent  = ""; qs("forgotEmail").focus(); }
  if (name === "reset")  { qs("resetMsg").textContent   = ""; qs("resetNewPwd").focus(); }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  const email = qs("forgotEmail").value.trim();
  const btn = event.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await apiRequest("request-password-reset", { method: "POST", body: JSON.stringify({ email }) });
    qs("forgotMsg").textContent = "Link de redefinição enviado! Verifique sua caixa de entrada.";
    qs("forgotMsg").className = "login-success";
  } catch (error) {
    qs("forgotMsg").textContent = error.message;
    qs("forgotMsg").className = "login-error";
  } finally {
    btn.disabled = false;
  }
}

async function handleResetPassword(event) {
  event.preventDefault();
  const token = qs("resetToken").value;
  const pw1   = qs("resetNewPwd").value;
  const pw2   = qs("resetConfirmPwd").value;
  if (pw1 !== pw2) { qs("resetMsg").textContent = "As senhas não conferem."; return; }
  if (!passwordMeetsAllRules(pw1)) { qs("resetMsg").textContent = "A senha não atende a todos os requisitos de segurança."; return; }
  const btn = event.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await apiRequest("reset-password", { method: "POST", body: JSON.stringify({ token, newPassword: pw1 }) });
    qs("resetMsg").textContent = "Senha redefinida com sucesso! Redirecionando para o login…";
    qs("resetMsg").className = "login-success";
    history.replaceState(null, "", location.pathname);
    setTimeout(() => showLoginPanel("login"), 2000);
  } catch (error) {
    qs("resetMsg").textContent = error.message;
    qs("resetMsg").className = "login-error";
  } finally {
    btn.disabled = false;
  }
}

// Toast de confirmação exibido dentro do próprio site (sem abrir abas/janelas).
function showToast(message, duration = 2000) {
  document.getElementById("appToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "appToast";
  toast.className = "app-toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

async function handleChangePassword(event) {
  event.preventDefault();
  const form      = event.target;
  const currentPw = form.querySelector('[name="currentPassword"]').value;
  const newPw     = form.querySelector('[name="newPassword"]').value;
  const confirmPw = form.querySelector('[name="confirmPassword"]').value;
  const msgEl     = form.querySelector(".pwd-change-msg");
  const dialog    = document.getElementById("changePasswordDialog");
  const isForced  = dialog?.dataset.forced === "1";
  const showError = (text) => {
    msgEl.textContent = text;
    msgEl.className = "pwd-change-msg login-error";
  };

  msgEl.className = "pwd-change-msg";
  msgEl.textContent = "";

  if (!currentPw) return showError("Informe a senha atual.");
  if (newPw !== confirmPw) return showError("As senhas não coincidem.");
  if (!passwordMeetsAllRules(newPw)) return showError("A senha não atende a todos os requisitos de segurança.");

  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    if (isForced) {
      // Troca obrigatória: endpoint dedicado que recebe o token de sessão no corpo
      // (_token) para contornar a remoção do header Authorization em Apache/PHP-CGI.
      // Usuário + senha atual servem de fallback de identidade se a sessão não
      // for localizada no servidor — evita o erro "Sessão inválida".
      const res = await fetch(`${API_BASE}/forced-change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          username: currentUser?.username || "",
          currentPassword: currentPw,
          newPassword: newPw,
          _token: authToken || "",
        }),
      });
      let payload = {};
      try { payload = JSON.parse(await res.text()); } catch { /* ignore */ }
      if (!res.ok || payload.ok === false) {
        // Senha atual incorreta, requisitos não atendidos etc.: erro inline,
        // modal permanece aberto.
        showError(payload.error || `Erro ao salvar (HTTP ${res.status}). Tente novamente.`);
        return;
      }
      // Sessões invalidadas pelo servidor — limpa localmente também.
      authToken = null;
      clearAuthSession();
      if (dialog?.open) dialog.close();
      showToast("Senha atualizada com sucesso!");
      setTimeout(() => showLogin("Senha atualizada com sucesso! Faça login com a nova senha."), 2000);
    } else {
      // Troca voluntária: usa apiRequest padrão com verificação de senha atual.
      await apiRequest("change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (currentUser) currentUser.mustChangePassword = false;
      if (dialog?.open) dialog.close();
      showToast("Senha atualizada com sucesso!");
    }
  } catch (error) {
    showError(error.message || "Erro ao salvar a senha. Tente novamente.");
  } finally {
    btn.disabled = false;
  }
}

function openChangePasswordDialog(isForced = false) {
  const dialog = document.getElementById("changePasswordDialog");
  if (!dialog) return;
  const form = document.getElementById("changePasswordForm");
  form.reset();
  const msgEl = form.querySelector(".pwd-change-msg");
  msgEl.textContent = "";
  msgEl.className = "pwd-change-msg";
  document.getElementById("changePwdStrength").innerHTML = "";
  dialog.dataset.forced = isForced ? "1" : "";
  dialog.showModal();
}

async function bootstrapApp() {
  // Restaura o token salvo antes do bootstrap, para autenticar a carga inicial.
  readAuthSession();
  await loadServerData();
  // Detecta token de redefinição de senha na URL (#reset=TOKEN).
  const hash = location.hash;
  if (hash.startsWith("#reset=")) {
    const token = decodeURIComponent(hash.slice(7));
    qs("resetToken").value = token;
    showLoginPanel("reset");
    qs("loginScreen").classList.remove("hidden");
    qs("appShell").classList.add("hidden");
    return;
  }
  restoreSession();
}

document.addEventListener("click", (event) => {
  if (event.target.id === "btnFecharDrawerNfse" || event.target.id === "btnCancelarDrawerNfse") {
    fecharDrawerNfseEntidade();
  }
  if (event.target.id === "btnSalvarDrawerNfse") {
    salvarDrawerNfseEntidade();
  }
  if (event.target.id === "drawerNfseOverlay") {
    fecharDrawerNfseEntidade();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawerNfseIdx !== null) {
    fecharDrawerNfseEntidade();
  }
});

qs("drawerTelefone")?.addEventListener("input", (event) => {
  event.target.value = maskPhone(event.target.value);
});

qs("drawerCep")?.addEventListener("input", (event) => {
  event.target.value = maskCep(event.target.value);
});

qs("drawerUf")?.addEventListener("input", (event) => {
  event.target.value = event.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
});

document.addEventListener("change", (event) => {
  handleUserActivity();
  if (currentUser && event.target.closest(".filters")) render();
});
["click", "keydown", "mousemove", "touchstart", "scroll"].forEach((eventName) => {
  document.addEventListener(eventName, handleUserActivity, { passive: true });
});
setInterval(enforceInactivityTimeout, 60 * 1000);

qs("filterToggle").addEventListener("click", () => {
  const filters = document.querySelector(".filters");
  const open = filters.classList.toggle("open");
  qs("filterToggle").textContent = open ? "Ocultar filtros" : "Mostrar filtros";
  qs("filterToggle").setAttribute("aria-expanded", String(open));
});

// Sombra dinâmica no topbar ao rolar a página.
{
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    window.addEventListener("scroll", () => {
      topbar.style.boxShadow = window.scrollY > 8
        ? "0 4px 24px rgba(0,0,0,0.13)"
        : "";
    }, { passive: true });
  }
}

// Skeleton loading: preenche um tbody com linhas-fantasma enquanto dados são
// buscados de forma assíncrona (usar antes do fetch e sobrescrever ao concluir).
function showTableSkeleton(tbodyId, cols = 5, rows = 6) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: rows }, () =>
    `<tr>${Array.from({ length: cols }, () =>
      `<td><span class="skeleton">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></td>`
    ).join("")}</tr>`
  ).join("");
}
qs("excelBtn").addEventListener("click", exportExcel);
qs("pdfBtn").addEventListener("click", () => window.print());
qs("seedBtn").addEventListener("click", () => {
  if (!isAdmin()) return;
  if (serverMode) return alert("Com o servidor ativo, os dados persistentes ficam no banco. Use backup/migração em vez de restaurar exemplos.");
  if (!confirm("Restaurar os dados de exemplo?")) return;
  db = structuredClone(seed);
  saveDb();
  render();
});
qs("loginForm").addEventListener("submit", handleLogin);
qs("logoutBtn").addEventListener("click", () => {
  logAudit("logout", "sistema", `Logout: ${currentUser?.username}`);
  if (serverMode && authToken) apiRequest("logout", { method: "POST" }).catch(() => {});
  clearAuthSession();
  clearTimeout(sessionWarnTimer);
  clearInterval(sessionWarnIntervalId);
  currentModuleTracked = "";
  // Tela de login volta ao tema automático: não mantém a preferência do último usuário.
  applyThemePreference("auto", false);
  if (AUTH_BYPASS_FOR_TESTS && !serverMode) restoreSession();
  else showLogin();
});
qs("recordForm").addEventListener("submit", saveForm);
qs("cancelDialog").addEventListener("click", () => qs("recordDialog").close());
qs("closeDialog").addEventListener("click", () => qs("recordDialog").close());
qs("closeProposalDialog").addEventListener("click", () => qs("proposalGeneratorDialog").close());
qs("refreshProposalPreview").addEventListener("click", updateProposalPreview);
qs("printProposalPreview").addEventListener("click", () => {
  updateProposalPreview();
  document.body.classList.add("printing-proposal");
  window.print();
});
window.addEventListener("afterprint", () => document.body.classList.remove("printing-proposal"));
qs("saveProposalDraft").addEventListener("click", () => saveGeneratedProposal("Rascunho"));
qs("finalizeProposal").addEventListener("click", () => saveGeneratedProposal("Gerada"));

// ── Redefinição e troca de senha ─────────────────────────────────────────────

qs("forgotPasswordBtn").addEventListener("click", () => showLoginPanel("forgot"));
qs("backToLoginBtn").addEventListener("click", () => showLoginPanel("login"));
qs("backToLoginFromResetBtn").addEventListener("click", () => {
  history.replaceState(null, "", location.pathname);
  showLoginPanel("login");
});

qs("forgotForm").addEventListener("submit", handleForgotPassword);
qs("resetForm").addEventListener("submit", handleResetPassword);
qs("changePasswordForm").addEventListener("submit", handleChangePassword);

// Indicador de força em tempo real nos campos de nova senha.
["resetNewPwd", "changePwdNew"].forEach((id) => {
  const targetId = id === "resetNewPwd" ? "resetPwdStrength" : "changePwdStrength";
  document.getElementById(id)?.addEventListener("input", (e) => {
    document.getElementById(targetId).innerHTML = passwordStrengthHtml(e.target.value);
  });
});

// Feedback em tempo real do confronto nova senha × confirmação no diálogo de troca.
function syncPwdMatchFeedback() {
  const form = document.getElementById("changePasswordForm");
  if (!form) return;
  const newPw     = form.querySelector('[name="newPassword"]')?.value || "";
  const confirmPw = form.querySelector('[name="confirmPassword"]')?.value || "";
  const msgEl     = form.querySelector(".pwd-change-msg");
  if (!msgEl) return;
  if (confirmPw && newPw !== confirmPw) {
    msgEl.textContent = "As senhas não coincidem.";
    msgEl.className = "pwd-change-msg login-error";
  } else if (msgEl.textContent === "As senhas não coincidem.") {
    msgEl.textContent = "";
    msgEl.className = "pwd-change-msg";
  }
}
document.getElementById("changePwdConfirm")?.addEventListener("input", syncPwdMatchFeedback);
document.getElementById("changePwdNew")?.addEventListener("input", syncPwdMatchFeedback);

bootstrapApp();
