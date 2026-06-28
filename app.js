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
const APP_VERSION = "v1.23.0";
const APP_VERSION_DATE = "2026-06-28";
const APP_CHANGELOG = [
  "De-para em lote: passa a ler TODAS as abas do Excel (não só a primeira), usando o nome de cada aba como grupo/categoria (ex.: Elétrica, Hidráulica, Pavimento 1). Abas sem coluna de descrição reconhecível (capa/resumo/índice) são puladas e listadas no resumo pós-upload. A coluna \"Grupo\" aparece na tabela de resultado e no export, e há um filtro por grupo (aba) além dos baldes de situação (v1.23.0).",
  "Comparador de orçamento com IA (Fase A — análise): nova tela em IA → Comparador de orçamento. Suba um orçamento externo em Excel/CSV; para cada item a IA encontra o equivalente na base SINAPI (por código ou por busca semântica) e COMPARA o preço da planilha com o da SINAPI, indicando qual é mais baixo e a diferença (R$ e %). Classifica em ACHOU, FALTOU IMPORTAR (código SINAPI que não está na nossa base) e COTAÇÃO PRÓPRIA. Relatório com baldes coloridos por situação, resumo de economia/excesso estimado (diferença × quantidade), tabela com valor planilha × valor SINAPI e destaque do mais barato, e exportação em Excel. Fase de análise — ainda não gera orçamento editável (v1.22.0).",
  "De-para em lote da IA: nova tela em IA → De-para em lote. Suba um orçamento externo em Excel/CSV; a IA lê a planilha (detectando automaticamente as colunas de descrição, código, quantidade, unidade e valor), classifica cada item contra a base SINAPI pela mesma busca semântica (cosseno) em ACHOU (alta similaridade ou código SINAPI válido), REVISAR (similaridade média, ou código informado que não existe na base) e COTAÇÃO PRÓPRIA (sem equivalente). A classificação roda em segundo plano com barra de progresso; o resultado vem em baldes coloridos por situação, tabela com o match sugerido (código + descrição + valor SINAPI) e similaridade, botões Aceitar por item e exportação do resultado em Excel (v1.21.0).",
  "Busca semântica da IA na base SINAPI: nova tela em IA → Busca semântica onde você descreve o item em linguagem natural e recebe as composições/insumos SINAPI mais parecidos POR SIGNIFICADO (não por palavra exata). O servidor gera o embedding do texto (Ollama, 384 dims) e ordena por similaridade de cosseno sobre os ~25 mil vetores já indexados, com filtro por origem (todos/composições/insumos), badge de similaridade (verde/amarelo/cinza), código + descrição + unidade e valor do item (v1.20.0).",
  "Importação mensal SINAPI na Base SINAPI: upload múltiplo dos arquivos oficiais, detecção de competência/tipo, prévia com colunas/amostras/alertas, processamento em fila, reimportação com manter/substituir, histórico por arquivo e referência padrão atual usada pela busca do orçamento (v1.19.0).",
  "Consolidação v1.18.0 (documentação de handoff): README/CLAUDE/STATUS sincronizados com o estado real do projeto, com os nomes reais de tabelas/colunas e o changelog completo da leva (asDate, CEP/autofill/obra, proposta por disciplina/modelos/SINAPI, contrato e exclusão de viabilidade).",
  "Análise de Viabilidade: botão \"Excluir\" em cada análise da lista remove a análise inteira em cascata (grupos, itens e anexos, inclusive os arquivos do disco) numa transação com rollback, após confirmação irreversível (v1.17.1).",
  "Contrato a partir da proposta: botão \"Gerar contrato\" na proposta cria/atualiza o contrato com snapshot do cliente, valor e objeto consolidado por disciplina; \"Contrato (PDF)\" gera o documento no template de Prestação de Serviços Técnicos com 13 cláusulas (cabeçalho/rodapé da empresa, campos faltantes como placeholders); e \"Anexos\" permite enviar a proposta assinada e o contrato assinado (PDF), marcando o contrato como assinado (v1.17.0).",
  "Proposta por disciplina + modelos + SINAPI: cada orçamento vinculado recebe uma disciplina (Elétrico, Hidráulico, Civil…) e o PDF passa a agrupar o investimento por disciplina com subtotais; \"Salvar como modelo\" e \"Aplicar modelo…\" reutilizam a estrutura da proposta (sem cliente); o PDF mostra código SINAPI + referência (mês/ano/UF) por item e um anexo de composições SINAPI utilizadas; e botão \"Exportar SINAPI (Excel)\" gera a planilha .xlsx da obra agrupada por etapa com subtotais (v1.16.0).",
  "CEP autofill universal: qualquer campo de CEP (em qualquer formulário/modal) preenche endereço/bairro/cidade/UF via ViaCEP com BrasilAPI de fallback (CSP liberado para ambos); preenchimento automático de cadastro de cliente e fornecedor ligado em todos os formulários; e no cadastro de obra o toggle \"A obra fica no mesmo endereço da empresa?\" (quando NÃO, bloco de endereço próprio com CEP) — PDFs usam o endereço próprio quando aplicável (v1.15.5).",
  "Correção: asDate passou a aceitar datetime do MySQL (\"2026-06-28 04:31:10\") e datas inválidas/zeradas sem lançar RangeError — a aba Viabilidade não trava mais ao carregar (v1.15.4).",
  "Modo licitação na proposta: comparativo com a referência SINAPI (custo × BDI de referência) versus o valor ofertado, com o percentual de desconto por item e global (\"Oferta com X% de desconto sobre a referência SINAPI\"), para propostas baseadas em preços SINAPI (v1.15.3).",
  "Formação de preço (BDI) flexível na proposta: BDI geral (%) para todos os itens, BDI por grupo/orçamento, ou venda manual por item com o BDI resultante calculado automaticamente — escolhido no seletor \"Formação do preço (BDI)\" do gerador (v1.15.2).",
  "Proposta com múltiplos orçamentos: vincule vários orçamentos de obra à mesma proposta, cada um como um grupo com BDI próprio (ex.: Cobertura 22%, Elétrica 25%), com totalizador de custo, BDI médio ponderado, valor de venda e margem, e resumo por grupo no PDF para o cliente (v1.15.1).",
  "Fluxo Orçamento → Proposta com base SINAPI: busca instantânea na base SINAPI completa (endpoint dedicado + índice de código) também dentro do orçamento de obra; a proposta passa a registrar o custo do orçamento técnico por item (custo unitário/BDI), com visão interna (custo + BDI + margem) alternável e separada da visão do cliente; estrutura de dados pronta para múltiplos orçamentos vinculados com BDI próprio por grupo (v1.15.0).",
  "Correção do erro 500 ao gerar contas a pagar recorrentes: as constantes PAYABLE_RECURRENCE_MAX/INDETERMINADO foram movidas para o topo do index.php (const não é \"hoisted\" — ficavam indefinidas em runtime após o roteamento) e a geração das parcelas passou a blindar as chaves estrangeiras (fornecedor, obra, categoria, centro de custo, conta) (v1.14.0).",
  "Dashboard revisado: Lucro Gerencial vs Caixa Real recalculado (lucro = todas as contas com vencimento no período, exceto canceladas; caixa = recebido − pago por data efetiva; A Receber Líquido = lucro − caixa), gráfico de evolução mensal com recorte por obra, cards dinâmicos e alertas (vencidos, etapas atrasadas, propostas expiradas, obras atrasadas, itens em estouro) (v1.14.0).",
  "Importação e comparação de cotações de fornecedores por PDF e Excel/CSV: leitura nativa de CSV, PhpSpreadsheet para .xlsx/.xls e pdftotext para PDF, com comparação automática contra o orçamento da obra por similaridade de descrição e classificação abaixo/igual/acima (v1.14.0).",
  "PBQP-H Fase 1: qualificação de fornecedores (materiais controlados), rastreabilidade por lote, vínculo FVM↔pedido de compra e geração de PDF no PES (v1.14.0).",
  "Ícones Tabler servidos localmente (sem CDN, compatível com a CSP) e subitens da sidebar com ícones coloridos e animação de entrada corrigida (v1.14.0).",
  "Cores por status nas notas/documentos fiscais e gráficos do dashboard mais finos e proporcionais (v1.14.0).",
  "Módulo de Análise de Viabilidade por tipo de obra: checklist com grupos/itens padrão (energia solar, obra civil, elétrica, ar-condicionado, cobertura, hidráulica, manutenção), progresso automático, itens aguardando terceiro, anexos, relatório PDF e bloqueio da proposta quando há item obrigatório reprovado (v1.14.0).",
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
  "Orçamento de Obra reestruturado: etapas (orcamento_etapas), tipos de custo, código hierárquico e visões Por Etapa, Por Centro de Custo, Por Tipo e Previsto vs Realizado, com BDI por etapa, impressão e exportação CSV (v1.12.0).",
  "Coluna Realizado vs Orçado no Orçamento de Obra: badges de execução, alerta de estouro, totalizadores e atualização de quantidade realizada com histórico (v1.12.0).",
  "Dashboard de execução de obras consumindo endpoint do servidor (resumo previsto/realizado), com spinner de carregamento, erro com botão de retentar, atualização automática a cada 5 min e tooltip combinado por obra no gráfico (v1.12.0).",
  "Correção do erro 500 na criação de contas a pagar recorrentes (auto-cura das colunas de recorrência) e na aprovação de marcos (colunas de referência em accounts_receivable) (v1.12.0).",
  "Varredura de segurança: correção de XSS armazenado em widgets, cards, selects e relatórios; rate limit na troca obrigatória de senha; bloqueio do diretório .git no Apache (v1.12.0).",
  "Auto-cura (ensure_*) de fiscal_documents, agenda/kanban e colunas email/blocked/mustChangePassword de usuários — evita erro 500 em servidor sem a migração; hardening de XXE no parse de XML, sanitização de logo SVG, filtros corrigidos e tela inicial à prova de falha (v1.12.1).",
  "Novo tipo \"Fiscal / Tributário\" nos centros de custo: dropdown de cadastro e badge na listagem; lista padrão completa com 25 centros (ADM-01..09, TEC-01..10, FIS-01..02, FIN-01..04) com exemplos pré-preenchidos. Abas \"O que entra aqui\" e \"Exemplos de Lançamentos\" simplificadas para texto livre, sem botões de sugestão/modelos (v1.13.0).",
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
  ["viabilityAnalyses", "Viabilidade Financeira"],
  ["viabilidadeObra", "Análise de Viabilidade"],
  ["cotacoes", "Cotações"],
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
  ["iaBusca", "Busca semântica"],
  ["iaDepara", "De-para em lote"],
  ["iaCompara", "Comparador de orçamento"],
  ["iaIndex", "Indexação SINAPI"],
  ["iaTest", "Teste de IA"],
  ["backupLocal", "Backup local"],
  ["preferences", "Preferências do sistema"],
  ["migration", "Migração para banco"],
];

// Navegação lateral organizada pelo fluxo de trabalho da empresa:
// Dashboard → Cadastros → Comercial → Viabilidade → Obras → Orçamento de Obra
// → Planejamento → Financeiro → Contabilidade → Relatórios → Configurações.
const sidebarSections = [
  { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard", module: "dashboard" },
  { id: "cadastros", label: "Cadastros", icon: "ti-database", modules: ["clients", "suppliers", "products", "services", "categories", "costCenters", "bankAccounts"] },
  { id: "comercial", label: "Comercial", icon: "ti-briefcase", modules: ["budgets", "proposals", "proposalModels", "proposalAreas", "proposalActionTypes", "proposalServiceSubtypes", "sales"] },
  { id: "viabilidade", label: "Viabilidade", icon: "ti-clipboard-check", modules: ["viabilidadeObra"] },
  { id: "obras", label: "Obras/Projetos", icon: "ti-building-skyscraper", modules: ["projects", "cotacoes", "projectCosts", "projectRevenues", "fiscalDocuments", "rdo", "projectNotifications", "projectTrackingLinks", "projectReport"] },
  { id: "qualidadePbqph", label: "Qualidade PBQP-H", icon: "ti-certificate", modules: ["qualidadeDashboard", "qualidadePolitica", "qualidadePes", "qualidadePqo", "qualidadeFvs", "qualidadeFvm", "qualidadeNc", "qualidadeTreinamentos", "qualidadeAuditorias"] },
  { id: "orcamentoObra", label: "Orçamento de Obra", icon: "ti-calculator", modules: ["workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "ownCompositions", "quotes", "abcCurve", "purchaseOrders"] },
  { id: "planejamento", label: "Planejamento", icon: "ti-calendar-event", modules: ["projectSchedule", "projectMilestones", "agenda", "kanban", "technicalReports"] },
  { id: "financeiro", label: "Financeiro", icon: "ti-currency-dollar", modules: ["receivable", "payable", "cashMoves", "cashFlow", "reconciliation"] },
  { id: "contabilidade", label: "Contabilidade Gerencial", icon: "ti-chart-infographic", modules: ["chartAccounts", "journalEntries", "dre", "taxDocuments", "taxes"] },
  { id: "relatorios", label: "Relatórios", icon: "ti-chart-dots", modules: ["reports", "reportFinancial", "reportClient", "reportSupplier", "reportCostCenter", "reportProject", "exports"] },
  // Lançador de plugins: itens dinâmicos vindos de db.plugins, abertos em nova aba.
  { id: "pluginsLauncher", label: "Plugins", icon: "ti-plug", pluginLauncher: true },
  // IA: seção própria (cresce com busca semântica, de-para, IA Orçamento). Mesma
  // visibilidade de plugins — só papéis que herdam todos os módulos (admin/gerente/
  // visualizador) a enxergam, pois os módulos de IA não estão nas listas dos demais.
  { id: "ia", label: "IA", icon: "ti-robot", modules: ["iaBusca", "iaDepara", "iaCompara", "iaIndex", "iaTest"] },
  { id: "config", label: "Configurações", icon: "ti-settings", modules: ["companySettings", "users", "permissions", "systemVersion", "workTypes", "workStatuses", "standardStages", "standardMilestones", "customFields", "reportModels", "documentTypes", "checklists", "measurementTypes", "paymentMethods", "whatsappTemplates", "visibilityRules", "sinapiSettings", "plugins", "backupLocal", "preferences", "migration", "auditLog", "myProfile"] },
];

// Ícones Tabler (ti-*) por módulo, usados nos itens da sidebar. Sem mapeamento → bolinha.
const MODULE_ICONS = {
  dashboard: "ti-layout-dashboard",
  clients: "ti-users", suppliers: "ti-truck", products: "ti-package", services: "ti-tool",
  categories: "ti-category", costCenters: "ti-building", bankAccounts: "ti-building-bank",
  budgets: "ti-calculator", proposals: "ti-file-text", sales: "ti-file-certificate",
  projects: "ti-building-skyscraper", projectSchedule: "ti-calendar-stats", projectMilestones: "ti-flag",
  rdo: "ti-clipboard-list", purchaseOrders: "ti-shopping-cart", fiscalDocuments: "ti-receipt",
  cotacoes: "ti-tag", viabilidadeObra: "ti-clipboard-check", viabilityAnalyses: "ti-coin",
  receivable: "ti-arrow-up-circle", payable: "ti-arrow-down-circle", cashFlow: "ti-trending-up",
  reconciliation: "ti-refresh", agenda: "ti-calendar", kanban: "ti-layout-kanban",
  reports: "ti-chart-bar", reportFinancial: "ti-chart-bar", reportClient: "ti-chart-bar",
  reportSupplier: "ti-chart-bar", reportCostCenter: "ti-chart-bar", reportProject: "ti-chart-bar",
  users: "ti-user-check", sinapiReferences: "ti-database-import", iaTest: "ti-robot",
};
// Ícone do módulo principal (seção/topo): classe Tabler vira <i>; emoji legado vira <span>.
function sidebarIconHtml(icon) {
  if (icon && /^ti-/.test(icon)) return `<i class="ti ${icon} sidebar-icon module-icon" aria-hidden="true"></i>`;
  return `<span class="nav-icon sidebar-icon module-icon">${icon || ""}</span>`;
}

// Ícone Tabler + cor por SUBmódulo (item do submenu). Sem mapeamento → ícone neutro.
const SUBMODULE_ICONS = {
  // Cadastros (roxo)
  clients: ["ti-users", "#534AB7"], suppliers: ["ti-truck", "#534AB7"], products: ["ti-package", "#7F77DD"],
  services: ["ti-tool", "#534AB7"], categories: ["ti-category", "#7F77DD"], costCenters: ["ti-building", "#534AB7"],
  bankAccounts: ["ti-building-bank", "#7F77DD"],
  // Comercial (verde)
  budgets: ["ti-calculator", "#3B6D11"], proposals: ["ti-file-text", "#639922"], proposalModels: ["ti-template", "#639922"],
  proposalAreas: ["ti-sitemap", "#639922"], proposalActionTypes: ["ti-list-details", "#3B6D11"],
  proposalServiceSubtypes: ["ti-list-check", "#639922"], sales: ["ti-file-certificate", "#3B6D11"],
  // Viabilidade (teal)
  viabilidadeObra: ["ti-clipboard-check", "#0F6E56"], viabilityAnalyses: ["ti-coin", "#0F6E56"],
  // Obras/Projetos + orçamento de obra + SINAPI (azul)
  projects: ["ti-building-skyscraper", "#185FA5"], cotacoes: ["ti-tag", "#185FA5"], workBudgets: ["ti-calculator", "#378ADD"],
  workBudgetItems: ["ti-list-details", "#185FA5"], projectCosts: ["ti-coin", "#185FA5"], projectRevenues: ["ti-cash", "#378ADD"],
  purchaseOrders: ["ti-shopping-cart", "#185FA5"], fiscalDocuments: ["ti-receipt", "#378ADD"],
  projectSchedule: ["ti-calendar-stats", "#185FA5"], projectMilestones: ["ti-flag", "#378ADD"], abcCurve: ["ti-chart-bar", "#185FA5"],
  agenda: ["ti-calendar", "#378ADD"], kanban: ["ti-layout-kanban", "#185FA5"], projectNotifications: ["ti-bell", "#378ADD"],
  projectTrackingLinks: ["ti-link", "#185FA5"], technicalReports: ["ti-file-report", "#378ADD"], projectReport: ["ti-chart-pie", "#185FA5"],
  rdo: ["ti-clipboard-list", "#378ADD"], sinapiReferences: ["ti-database-import", "#185FA5"], sinapiInputs: ["ti-package", "#378ADD"],
  sinapiCompositions: ["ti-stack-2", "#185FA5"], sinapiCompositionItems: ["ti-list-details", "#378ADD"], sinapiLabor: ["ti-users", "#185FA5"],
  sinapiFamilies: ["ti-category", "#378ADD"], sinapiMaintenances: ["ti-tool", "#185FA5"], ownCompositions: ["ti-box", "#378ADD"],
  quotes: ["ti-tag", "#185FA5"],
  // Financeiro
  receivable: ["ti-arrow-up-circle", "#3B6D11"], payable: ["ti-arrow-down-circle", "#A32D2D"], cashMoves: ["ti-cash-banknote", "#854F0B"],
  cashFlow: ["ti-trending-up", "#854F0B"], reconciliation: ["ti-refresh", "#854F0B"],
  // Contabilidade (coral)
  chartAccounts: ["ti-hierarchy", "#993C1D"], journalEntries: ["ti-pencil", "#993C1D"], dre: ["ti-report-analytics", "#993C1D"],
  taxDocuments: ["ti-file-invoice", "#993C1D"], taxes: ["ti-percentage", "#993C1D"],
  // Relatórios (teal)
  reports: ["ti-chart-bar", "#0F6E56"], reportFinancial: ["ti-chart-bar", "#0F6E56"], reportClient: ["ti-user", "#0F6E56"],
  reportSupplier: ["ti-truck", "#0F6E56"], reportCostCenter: ["ti-building", "#0F6E56"], reportProject: ["ti-building-skyscraper", "#0F6E56"],
  exports: ["ti-download", "#0F6E56"],
  // Qualidade PBQP-H (teal/coral)
  qualidadeDashboard: ["ti-gauge", "#0F6E56"], qualidadePolitica: ["ti-file-text", "#0F6E56"], qualidadePes: ["ti-clipboard-text", "#0F6E56"],
  qualidadePqo: ["ti-clipboard-check", "#0F6E56"], qualidadeFvs: ["ti-checklist", "#0F6E56"], qualidadeFvm: ["ti-package", "#0F6E56"],
  qualidadeNc: ["ti-alert-triangle", "#A32D2D"], qualidadeTreinamentos: ["ti-school", "#0F6E56"], qualidadeAuditorias: ["ti-clipboard-check", "#0F6E56"],
  // Configurações (cinza)
  companySettings: ["ti-building", "#5F5E5A"], users: ["ti-users", "#5F5E5A"], permissions: ["ti-lock", "#5F5E5A"],
  systemVersion: ["ti-info-circle", "#5F5E5A"], workTypes: ["ti-list", "#5F5E5A"], workStatuses: ["ti-activity", "#5F5E5A"],
  standardStages: ["ti-stairs", "#5F5E5A"], standardMilestones: ["ti-flag", "#5F5E5A"], customFields: ["ti-forms", "#5F5E5A"],
  reportModels: ["ti-template", "#5F5E5A"], documentTypes: ["ti-files", "#5F5E5A"], checklists: ["ti-checklist", "#5F5E5A"],
  measurementTypes: ["ti-ruler", "#5F5E5A"], paymentMethods: ["ti-credit-card", "#5F5E5A"], whatsappTemplates: ["ti-message", "#5F5E5A"],
  visibilityRules: ["ti-eye", "#5F5E5A"], sinapiSettings: ["ti-adjustments", "#5F5E5A"], plugins: ["ti-plug", "#5F5E5A"],
  backupLocal: ["ti-database-export", "#5F5E5A"], preferences: ["ti-settings", "#5F5E5A"], migration: ["ti-database-export", "#5F5E5A"],
  auditLog: ["ti-history", "#5F5E5A"], myProfile: ["ti-user-circle", "#5F5E5A"],
  // IA (azul)
  iaBusca: ["ti-search", "#185FA5"], iaDepara: ["ti-arrows-exchange", "#185FA5"], iaCompara: ["ti-scale", "#185FA5"], iaIndex: ["ti-database-cog", "#185FA5"], iaTest: ["ti-plug-connected", "#185FA5"],
};
function submenuIconHtml(moduleKey) {
  const [ic, color] = SUBMODULE_ICONS[moduleKey] || ["ti-point", "#8a93a6"];
  return `<i class="ti ${ic} submenu-ic" style="color:${color}" aria-hidden="true"></i>`;
}

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
    "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "sinapiSettings", "ownCompositions", "quotes", "abcCurve", "viabilityAnalyses", "viabilidadeObra",
    "fiscalDocuments", "receivable", "payable", "cashMoves", "cashFlow", "reconciliation",
    "proposals", "sales", "chartAccounts", "journalEntries", "dre", "taxDocuments", "taxes",
    "reports", "reportFinancial", "reportClient", "reportSupplier", "reportCostCenter", "reportProject", "exports", "systemVersion", "qualidadeDashboard",
  ],
  comercial: ["dashboard", "clients", "projects", "projectSchedule", "agenda", "kanban", "workBudgets", "abcCurve", "viabilityAnalyses", "viabilidadeObra", "budgets", "proposals", "proposalModels", "sales", "reportClient", "systemVersion"],
  engenharia: ["dashboard", "rdo", "projects", "projectSchedule", "projectMilestones", "agenda", "kanban", "projectNotifications", "projectTrackingLinks", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "ownCompositions", "quotes", "abcCurve", "viabilityAnalyses", "viabilidadeObra", "purchaseOrders", "cotacoes", "fiscalDocuments", "technicalReports", "projectReport", "proposals", "reportProject", "systemVersion", "qualidadeDashboard", "qualidadePes", "qualidadePqo", "qualidadeFvs", "qualidadeFvm", "qualidadeNc", "qualidadeTreinamentos"],
  gestor_obra: ["dashboard", "rdo", "projects", "projectSchedule", "projectMilestones", "agenda", "kanban", "projectNotifications", "projectTrackingLinks", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "ownCompositions", "quotes", "abcCurve", "viabilityAnalyses", "viabilidadeObra", "purchaseOrders", "cotacoes", "fiscalDocuments", "technicalReports", "projectReport", "proposals", "reportProject", "systemVersion", "qualidadeDashboard", "qualidadePes", "qualidadePqo", "qualidadeFvs", "qualidadeFvm", "qualidadeNc", "qualidadeTreinamentos"],
  equipe_campo: ["dashboard", "projectReport", "systemVersion"],
  cliente_obra: ["dashboard", "projectReport", "projectSchedule", "technicalReports", "systemVersion"],
  fornecedor_terceiro: ["dashboard", "systemVersion"],
  consulta: ["dashboard", "projectReport", "cashFlow", "dre", "reports", "reportFinancial", "reportClient", "reportSupplier", "reportCostCenter", "reportProject", "exports", "qualidadeDashboard"],
  gerente: modules.map(([key]) => key).filter((k) => !["users", "permissions"].includes(k)),
  operador: ["dashboard", "rdo", "clients", "suppliers", "products", "services", "categories", "costCenters", "bankAccounts", "projects", "projectCosts", "projectRevenues", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "ownCompositions", "quotes", "abcCurve", "fiscalDocuments", "receivable", "payable", "cashMoves", "cashFlow", "reconciliation", "budgets", "proposals", "sales", "purchaseOrders", "cotacoes", "projectSchedule", "projectMilestones", "agenda", "kanban", "projectReport", "reports", "reportFinancial", "reportClient", "reportSupplier", "reportCostCenter", "reportProject", "myProfile", "qualidadeDashboard", "qualidadeFvs", "qualidadeFvm", "qualidadeNc"],
  visualizador: modules.map(([key]) => key),
};

// Mutação por papel (espelho de default_role_edit_modules no servidor). Fonte
// única, reusada por canEditModule e pelo cálculo do padrão na grade de
// permissões por usuário.
const EDITABLE_BY_ROLE = {
  financeiro: ["fiscalDocuments", "receivable", "payable", "cashMoves", "cashFlow", "reconciliation", "categories", "costCenters", "bankAccounts", "chartAccounts", "journalEntries", "taxDocuments", "taxes", "exports", "projectSchedule", "agenda", "kanban", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "sinapiSettings", "quotes", "sales", "viabilityAnalyses", "viabilidadeObra"],
  comercial: ["clients", "budgets", "proposals", "agenda", "kanban", "viabilityAnalyses", "viabilidadeObra"],
  engenharia: ["rdo", "projects", "projectSchedule", "projectMilestones", "agenda", "kanban", "projectNotifications", "projectTrackingLinks", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "ownCompositions", "quotes", "purchaseOrders", "cotacoes", "fiscalDocuments", "technicalReports", "viabilidadeObra", "qualidadePes", "qualidadePqo", "qualidadeFvs", "qualidadeFvm", "qualidadeNc", "qualidadeTreinamentos"],
  gestor_obra: ["rdo", "projects", "projectSchedule", "projectMilestones", "agenda", "kanban", "projectNotifications", "projectTrackingLinks", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "sinapiCompositionItems", "sinapiLabor", "sinapiFamilies", "sinapiMaintenances", "ownCompositions", "quotes", "purchaseOrders", "cotacoes", "fiscalDocuments", "technicalReports", "viabilidadeObra", "qualidadePes", "qualidadePqo", "qualidadeFvs", "qualidadeFvm", "qualidadeNc", "qualidadeTreinamentos"],
  gerente: modules.map(([k]) => k).filter((k) => !["users", "permissions"].includes(k)),
  operador: ["rdo", "clients", "suppliers", "products", "services", "categories", "costCenters", "bankAccounts", "projects", "projectCosts", "projectRevenues", "workBudgets", "workBudgetItems", "sinapiReferences", "sinapiInputs", "sinapiCompositions", "ownCompositions", "quotes", "fiscalDocuments", "receivable", "payable", "cashMoves", "reconciliation", "budgets", "proposals", "sales", "purchaseOrders", "cotacoes", "projectSchedule", "projectMilestones", "agenda", "kanban", "qualidadeFvs", "qualidadeFvm", "qualidadeNc"],
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
let lucroCaixaPeriod = "mesAtual"; // período do painel Lucro Gerencial vs Caixa Real
let selectedWorkBudgetId = "";
let workBudgetItemFilter = "all"; // filtro de execução: all|estouro|naoiniciado|andamento|concluido
let workBudgetView = "etapa"; // visão do orçamento: etapa|centro|tipo|execucao
let sinapiSearchTerm = "";
let sinapiSourceFilter = "all";
let sinapiUfFilter = "MS";
let sinapiTypeFilter = "all";
let sinapiLastImportHtml = "";
let sinapiJobPollTimer = null;
let sinapiJobPollSeq = 0; // invalida correntes de polling antigas após re-render
let sinapiSearchFetchTimer = null;
let sinapiSearchLastFetched = ""; // último termo já buscado no servidor (evita repetição)
let sinapiPackagePreview = null;
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
let agendaLegendCollapsed = false;
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
  orcamentoEtapas: "orcamento-etapas",
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
  proposalGroups: "proposta-grupos",
  proposalTemplates: "proposta-modelos",
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
      ["name",        "Nome / Razão social",   "text",   true],
      ["document",    "CPF/CNPJ",              "text"],
      ["email",       "E-mail",                "email",  true],
      ["phone",       "Celular / WhatsApp",    "text",   true],
      ["zipCode",     "CEP",                   "text"],
      ["address",     "Rua / Logradouro",      "text"],
      ["numero",      "Número",                "text"],
      ["complemento", "Complemento",           "text"],
      ["bairro",      "Bairro",                "text"],
      ["cidade",      "Cidade",                "text"],
      ["estado",      "Estado (UF)",           "select", ["", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]],
      ["status",      "Status",                "select", ["Ativo", "Inativo"]],
    ],
  },
  suppliers: {
    title: "Fornecedores",
    description: "Cadastro de fornecedores para compras, contas a pagar, categorias e documentos de origem.",
    fields: [
      ["name",        "Nome / Razão social",   "text",   true],
      ["document",    "CPF/CNPJ",              "text"],
      ["email",       "E-mail",                "email",  true],
      ["phone",       "Celular / WhatsApp",    "text",   true],
      ["zipCode",     "CEP",                   "text"],
      ["address",     "Rua / Logradouro",      "text"],
      ["numero",      "Número",                "text"],
      ["complemento", "Complemento",           "text"],
      ["bairro",      "Bairro",                "text"],
      ["cidade",      "Cidade",                "text"],
      ["estado",      "Estado (UF)",           "select", ["", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]],
      ["status",      "Status",                "select", ["Ativo", "Inativo"]],
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
      ["zipCode", "CEP da obra", "text"],
      ["address", "Endereço da obra", "text"],
      ["bairro", "Bairro", "text"],
      ["cidade", "Cidade", "text"],
      ["estado", "UF", "text"],
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
    title: "Viabilidade Financeira",
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
      ["code", "Código SINAPI", "text"],
      ["codigo", "Código hierárquico", "text"],
      ["tipo", "Tipo de custo", "select", ["material", "mao_de_obra", "equipamento", "subempreiteiro", "outros"]],
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
      ["amount", "Valor total", "number"],
      ["desconto", "Desconto (R$)", "money"],
      ["condicoes_pagamento", "Condições de pagamento", "text"],
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
      ["email", "E-mail", "email"],
      ["phone", "Telefone", "text"],
      ["zipCode", "CEP", "text"],
      ["address", "Rua / Logradouro", "text"],
      ["numero", "Número", "text"],
      ["complemento", "Complemento", "text"],
      ["bairro", "Bairro", "text"],
      ["city", "Cidade", "text"],
      ["estado", "Estado (UF)", "select", ["", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]],
      ["website", "Site", "text"],
      ["instagram", "Instagram", "text"],
      ["whatsapp", "WhatsApp (só números)", "text"],
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
  orcamentoEtapas: [],
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
  proposalGroups: [],
  proposalTemplates: [],
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
  if (!response.ok || payload.ok === false || payload.success === false) {
    const error = new Error(payload.error || payload.message || `Erro HTTP ${response.status}`);
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
  // Aceita date pura ("2026-06-28") e datetime do MySQL ("2026-06-28 04:31:10" ou com "T").
  // Nunca deixa dateFmt.format lançar RangeError com data inválida/zerada.
  if (value === null || value === undefined || value === "") return "";
  const s = String(value).trim().replace(" ", "T");
  if (s === "" || s.startsWith("0000-00-00")) return "";
  const iso = s.length === 10 ? `${s}T00:00:00Z` : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : dateFmt.format(d);
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
  if (field === "website") return "www.schimanskiengenharia.com.br";
  if (field === "instagram") return "@schimanskiengenharia";
  if (field === "whatsapp") return "67999999999";
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
  const permissionKey = { agendaEvents: "agenda", kanbanBoards: "kanban", kanbanColumns: "kanban", kanbanCards: "kanban", orcamentoEtapas: "workBudgets" }[key] || key;
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
          <button class="nav-section-toggle sidebar-item module-item" type="button" data-nav-group="${section.id}" aria-expanded="${open}">
            ${sidebarIconHtml(section.icon)}
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
        <button class="nav-section-toggle sidebar-item module-item ${active ? "active" : ""}" type="button" data-nav-group="${section.id}" aria-expanded="${open}">
          ${sidebarIconHtml(section.icon)}
          <span class="nav-label">${section.label}</span>
          <span class="nav-caret">${open ? "−" : "+"}</span>
        </button>
        <div class="nav-submenu ${open ? "open" : ""}">
          ${items.map((moduleKey) => navButton(moduleKey, moduleLabels[moduleKey], "", "submenu-item")).join("")}
        </div>
      </div>
    `;
  }).join("");
  updateShellState();
}

function navButton(moduleKey, label, icon, extraClass = "") {
  const isSub = extraClass.includes("submenu-item");
  const mainIcon = icon || MODULE_ICONS[moduleKey] || "";
  const iconHtml = isSub
    ? submenuIconHtml(moduleKey)
    : (mainIcon ? sidebarIconHtml(mainIcon) : '<span class="nav-dot"></span>');
  return `
    <button class="nav-link sidebar-item ${isSub ? "" : "module-item"} ${extraClass} ${moduleKey === currentModule ? "active" : ""}" type="button" data-module="${moduleKey}">
      ${iconHtml}
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
  setupFilterClientAffordance();
}

// Filtro por cliente (Relatórios e demais módulos): indicador 🔄 + atalho para
// ver o cadastro completo do cliente selecionado, sem sair da tela.
function setupFilterClientAffordance() {
  const select = qs("filterClient");
  if (!select) return;
  const host = select.closest("label") || select.parentElement;
  if (host && !host.querySelector(".filter-client-sync")) {
    select.insertAdjacentHTML("afterend",
      '<span class="client-sync-indicator filter-client-sync" title="Os dados do cliente selecionado podem ser consultados no cadastro completo">🔄 <button type="button" class="link-button" id="filterClientView">Ver cadastro</button></span>');
    qs("filterClientView")?.addEventListener("click", () => {
      const id = qs("filterClient").value;
      if (!id) { alert("Selecione um cliente no filtro para ver o cadastro completo."); return; }
      openClientFullView(id);
    });
  }
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
      if (filters[key] && String(row[key] || "") !== String(filters[key])) return false;
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
  if (currentModule === "viabilidadeObra") { viabilidadeObraOpenId = null; return renderViabilidadeList(); }
  if (currentModule === "cotacoes") { cotacaoOpenId = null; return renderCotacoes(); }
  if (currentModule === "plugins") return renderPlugins();
  if (currentModule === "iaBusca") return renderIaBusca();
  if (currentModule === "iaDepara") return renderIaDepara();
  if (currentModule === "iaCompara") return renderIaCompara();
  if (currentModule === "iaIndex") return renderIaIndex();
  if (currentModule === "iaTest") return renderIaTest();
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
  if (currentModule === "costCenters") return renderCostCenters();
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
    ${generateDocumentHeader("Relatório Diário de Obra (RDO)", [obra, asDate(d.data)].filter(Boolean).join(" · "))}
    <div class="rdo-pdf-head">
      <p><strong>RDO Nº ${svgText(String(d.numeroSequencial || ""))}</strong> · Condição: ${svgText(d.condicaoTrabalho || "—")}</p>
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
    ${generateDocumentFooter()}
  `;
}

// ─── Status financeiro tolerante a maiúsc/minúsc/espaços ────────────────────
// Dados importados (OFX/NFS-e) ou editados direto no banco podem gravar
// "recebido"/"pago"/"aberto" em vez de "Recebido"/"Pago"/"Aberto". Comparar com
// === quebraria silenciosamente os KPIs e o gráfico Lucro x Caixa (tudo viraria
// "em aberto", caixa zerado). Estes helpers normalizam antes de comparar.
function normFinStatus(status) {
  return String(status || "").trim().toLowerCase();
}
function isRecebido(status) { return normFinStatus(status) === "recebido"; }
function isPago(status) { return normFinStatus(status) === "pago"; }
function isCancelado(status) { return normFinStatus(status) === "cancelado"; }
// Em aberto = não liquidado e não cancelado (cobre Aberto/Vencido/Parcial).
function isReceberAberto(status) { return !isRecebido(status) && !isCancelado(status); }
function isPagarAberto(status) { return !isPago(status) && !isCancelado(status); }

function totals() {
  const receivable = applyFilters(db.receivable);
  const payable = applyFilters(db.payable);
  const moves = applyFilters(db.cashMoves);
  const sales = applyFilters(db.sales);
  const received = receivable.filter((r) => isRecebido(r.status)).reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const openReceivable = receivable.filter((r) => isReceberAberto(r.status)).reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const paid = payable.filter((p) => isPago(p.status)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const openPayable = payable.filter((p) => isPagarAberto(p.status)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
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
  const receivable = (db.receivable || []).filter((row) => sameId(row.projectId, projectId) && isRecebido(row.status)).reduce((total, row) => total + Number(row.amount || 0), 0);
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
  const revenueReceived = receivable.filter((row) => isRecebido(row.status)).reduce((total, row) => total + Number(row.amount || 0), 0);
  const revenuePending = receivable.filter((row) => !isRecebido(row.status) && !isCancelado(row.status)).reduce((total, row) => total + Number(row.amount || 0), 0);
  const expensesTotal = sum(payable, "amount");
  const currentBalance = (activeDashboardProjectId() ? 0 : bankOpeningBalance()) + moves.reduce((total, row) => total + signedCashAmount(row), 0);
  const openReceivable = receivable.filter((row) => isReceberAberto(row.status)).reduce((total, row) => total + Number(row.amount || 0), 0);
  const openPayable = payable.filter((row) => isPagarAberto(row.status)).reduce((total, row) => total + Number(row.amount || 0), 0);
  const overdue = receivable.filter((row) => isOverdue(row, "receivable")).reduce((total, row) => total + Number(row.amount || 0), 0)
    + payable.filter((row) => isOverdue(row, "payable")).reduce((total, row) => total + Number(row.amount || 0), 0);
  const grossProfit = sales.reduce((total, row) => total + Number(row.amount || 0) - Number(row.cost || 0), 0);
  const netProfit = revenueTotal - expensesTotal;
  const paidExpenses = payable.filter((row) => isPago(row.status)).reduce((total, row) => total + Number(row.amount || 0), 0);
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
  if (normFinStatus(row.status) === "vencido") return true;
  if (isRecebido(row.status) || isPago(row.status) || isCancelado(row.status)) return false;
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

// ─── Lucro Gerencial (competência) vs Caixa Real ────────────────────────────
// Indicadores calculados a partir do db já carregado (contas a receber/pagar).
// Colunas reais usadas: accounts_receivable(status,dueDate,receivedDate,amount)
// e accounts_payable(status,dueDate,paidDate,amount). "Em aberto" segue a mesma
// convenção do restante do dashboard: status ≠ Recebido/Pago e ≠ Cancelado
// (inclui Vencido e Parcial), não apenas o literal "Aberto".
const LUCRO_CAIXA_PERIODS = [
  ["mesAtual", "Mês atual"],
  ["ultimoMes", "Último mês"],
  ["ultimos3Meses", "Últimos 3 meses"],
  ["ultimos6Meses", "Últimos 6 meses"],
  ["anoAtual", "Ano atual"],
];

function lucroCaixaFmtDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Intervalo [start, end] inclusivo (YYYY-MM-DD) por chave de período.
function lucroCaixaPeriodRange(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstOf = (yy, mm) => new Date(yy, mm, 1);       // mm negativo recua o ano corretamente
  const lastOf = (yy, mm) => new Date(yy, mm + 1, 0);
  switch (key) {
    case "ultimoMes": return { start: lucroCaixaFmtDate(firstOf(y, m - 1)), end: lucroCaixaFmtDate(lastOf(y, m - 1)) };
    case "ultimos3Meses": return { start: lucroCaixaFmtDate(firstOf(y, m - 2)), end: lucroCaixaFmtDate(lastOf(y, m)) };
    case "ultimos6Meses": return { start: lucroCaixaFmtDate(firstOf(y, m - 5)), end: lucroCaixaFmtDate(lastOf(y, m)) };
    case "anoAtual": return { start: `${y}-01-01`, end: `${y}-12-31` };
    case "mesAtual":
    default: return { start: lucroCaixaFmtDate(firstOf(y, m)), end: lucroCaixaFmtDate(lastOf(y, m)) };
  }
}

// Núcleo do cálculo dado um intervalo explícito e um filtro opcional de obra.
function lucroCaixaCompute(start, end, projectId = "") {
  const inRange = (value) => { const d = String(value || "").slice(0, 10); return d && d >= start && d <= end; };
  const matchProject = (row) => !projectId || sameId(row.projectId, projectId);
  const total = (rows) => rows.reduce((acc, row) => acc + Number(row.amount || 0), 0);
  const receivable = (db.receivable || []).filter(matchProject);
  const payable = (db.payable || []).filter(matchProject);

  // LUCRO GERENCIAL (competência): TODAS as contas com vencimento (dueDate) no
  // período, qualquer status exceto Cancelado — recebidas + em aberto. Conta cada
  // título uma vez pelo vencimento, mesmo que já tenha sido recebido/pago numa data
  // de outro período (isso fechava o gap em que um título já recebido sumia do lucro).
  const receitasTotais = total(receivable.filter((r) => !isCancelado(r.status) && inRange(r.dueDate)));
  const custosTotais = total(payable.filter((p) => !isCancelado(p.status) && inRange(p.dueDate)));

  // CAIXA REAL (regime de caixa): só o efetivamente recebido/pago no período, pela
  // data efetiva (receivedDate/paidDate). Status case-insensitive (isRecebido/isPago).
  // Pode SUPERAR o lucro quando entram recebimentos de competências anteriores ou há
  // mais contas a pagar em aberto do que a receber — então a diferença pode ser negativa.
  const recebidas = total(receivable.filter((r) => isRecebido(r.status) && inRange(r.receivedDate || r.dueDate)));
  const pagas = total(payable.filter((p) => isPago(p.status) && inRange(p.paidDate || p.dueDate)));
  // Em aberto pela competência (apoio à reconciliação/relatório).
  const abertasReceber = total(receivable.filter((r) => isReceberAberto(r.status) && inRange(r.dueDate)));
  const abertasPagar = total(payable.filter((p) => isPagarAberto(p.status) && inRange(p.dueDate)));

  const lucroGerencial = receitasTotais - custosTotais;
  const resultadoCaixa = recebidas - pagas;
  return {
    start, end, recebidas, pagas, abertasReceber, abertasPagar, receitasTotais, custosTotais,
    lucroGerencial,
    resultadoCaixa,
    aReceberLiquido: lucroGerencial - resultadoCaixa,
  };
}

function lucroCaixaIndicators(periodKey, projectId = "") {
  const { start, end } = lucroCaixaPeriodRange(periodKey);
  return lucroCaixaCompute(start, end, projectId);
}

// Série mensal (lucro gerencial x caixa real) para o gráfico de evolução.
// Período "anoAtual" → meses corridos do ano (Jan → mês atual). Demais → janela
// móvel de N meses terminando no mês atual. Assim o filtro de período afeta o eixo X.
function lucroCaixaMonthlyRows(projectId = "", periodKey = "ultimos6Meses") {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const buckets = [];
  if (periodKey === "anoAtual") {
    for (let mm = 0; mm <= m; mm++) buckets.push([y, mm]);
  } else {
    const count = ({ ultimos6Meses: 6, ultimos3Meses: 3, ultimoMes: 2, mesAtual: 6 })[periodKey] || 6;
    for (let i = count - 1; i >= 0; i--) { const d = new Date(y, m - i, 1); buckets.push([d.getFullYear(), d.getMonth()]); }
  }
  return buckets.map(([yy, mm]) => {
    const start = lucroCaixaFmtDate(new Date(yy, mm, 1));
    const end = lucroCaixaFmtDate(new Date(yy, mm + 1, 0));
    const ind = lucroCaixaCompute(start, end, projectId);
    return { month: `${yy}-${String(mm + 1).padStart(2, "0")}`, lucro: ind.lucroGerencial, caixa: ind.resultadoCaixa };
  });
}

function lucroCaixaMonthsForPeriod(periodKey) {
  return ({ anoAtual: 12, ultimos6Meses: 6, ultimos3Meses: 3 })[periodKey] || 6;
}

function lucroCaixaChart(periodKey, projectId = "") {
  const rows = lucroCaixaMonthlyRows(projectId, periodKey);
  const labels = rows.map((r) => monthLabel(r.month));
  // Tooltip combinado por mês: lucro gerencial, caixa real e a diferença
  // (= a receber líquido = lucro − caixa). Mostra as duas séries mesmo quando
  // as linhas coincidem (sem contas em aberto no mês → lucro = caixa).
  const tooltips = rows.map((r) => {
    const diff = r.lucro - r.caixa;
    const hint = diff > 0 ? "(lucro ainda não recebido)" : diff < 0 ? "(caixa acima do lucro — recebimentos de outros períodos ou contas a pagar em aberto)" : "(lucro e caixa sincronizados)";
    return `${monthLabel(r.month)}\nLucro Gerencial: ${compactMoney(r.lucro)}\nCaixa Real: ${compactMoney(r.caixa)}\nDiferença: ${compactMoney(diff)}\n${hint}`;
  });
  return chartPanel(
    "Evolução: lucro gerencial x caixa",
    `Resultado por competência e caixa real por mês${projectId ? " · " + svgText(nameOf("projects", projectId) || "obra") : ""}`,
    lineChart([
      { label: "Lucro Gerencial (competência)", color: "#185FA5", values: rows.map((r) => r.lucro) },
      { label: "Caixa Real (regime de caixa)", color: "#3B6D11", values: rows.map((r) => r.caixa) },
    ], labels, tooltips, { strokeWidth: 2, dotRadius: 4 })
  );
}

// Contas (a receber + a pagar) em aberto vencidas há mais de 30 dias — global,
// independente do período selecionado (risco corrente).
function lucroCaixaOverdue30(projectId = "") {
  const cutoff = lucroCaixaFmtDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const matchProject = (row) => !projectId || sameId(row.projectId, projectId);
  const overdue = (row) => { const d = String(row.dueDate || "").slice(0, 10); return d && d < cutoff; };
  const total = (rows) => rows.reduce((acc, row) => acc + Number(row.amount || 0), 0);
  const receber = total((db.receivable || []).filter((r) => matchProject(r) && isReceberAberto(r.status) && overdue(r)));
  const pagar = total((db.payable || []).filter((p) => matchProject(p) && isPagarAberto(p.status) && overdue(p)));
  return { receber, pagar, total: receber + pagar };
}

function lucroCaixaPeriodSelect(id, selected) {
  const options = LUCRO_CAIXA_PERIODS.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
  return `<label class="lucro-caixa-period">Período<select id="${id}">${options}</select></label>`;
}

function lucroCaixaAlerts(ind, over) {
  const alerts = [];
  const pctNaoRecebido = ind.lucroGerencial > 0 ? (ind.aReceberLiquido / ind.lucroGerencial) * 100 : 0;
  if (ind.lucroGerencial > 0 && ind.aReceberLiquido > 0 && pctNaoRecebido > 30) {
    alerts.push(`<div class="alert alert-warning">Atenção: ${Math.round(pctNaoRecebido)}% do lucro ainda não entrou no caixa. Verifique contas a receber em aberto.</div>`);
  }
  if (over.total > 0) {
    alerts.push(`<div class="alert alert-danger">${asMoney(over.total)} em contas vencidas há mais de 30 dias.</div>`);
  }
  return alerts;
}

// Painel de 3 cards (Dashboard) com seletor de período, alertas automáticos,
// recorte opcional por obra/projeto e gráfico de evolução mensal.
function lucroCaixaPanel(periodKey, projectId = "") {
  const ind = lucroCaixaIndicators(periodKey, projectId);
  const alerts = lucroCaixaAlerts(ind, lucroCaixaOverdue30(projectId));
  const tone = (value) => (value < 0 ? "negative" : value > 0 ? "positive" : "");
  const scopeNote = projectId ? `Obra: ${svgText(nameOf("projects", projectId) || "—")}` : "Visão geral da empresa";
  return `
    <section class="lucro-caixa-panel">
      <div class="lucro-caixa-head">
        <div>
          <h3>Lucro Gerencial vs Caixa Real</h3>
          <p class="muted">${scopeNote} · competência x dinheiro efetivamente movimentado no período.</p>
        </div>
        ${lucroCaixaPeriodSelect("dashLucroCaixaPeriod", periodKey)}
      </div>
      <div class="lucro-caixa-cards">
        <article class="lc-card ${tone(ind.lucroGerencial)}">
          <span class="lc-label">Lucro Gerencial</span>
          <strong class="lc-value ${ind.lucroGerencial < 0 ? "lc-neg" : "lc-blue"}">${asMoney(ind.lucroGerencial)}</strong>
          <span class="lc-sub">Receitas − Custos (competência)</span>
        </article>
        <article class="lc-card ${tone(ind.resultadoCaixa)}">
          <span class="lc-label">Caixa Real</span>
          <strong class="lc-value ${ind.resultadoCaixa < 0 ? "lc-neg" : "lc-green"}">${asMoney(ind.resultadoCaixa)}</strong>
          <span class="lc-sub">Recebido − Pago (regime de caixa)</span>
        </article>
        <article class="lc-card ${tone(ind.aReceberLiquido)}">
          <span class="lc-label">A receber líquido <span class="lc-info" tabindex="0" title="Este valor está no lucro mas ainda não entrou no caixa — são contas a receber em aberto menos contas a pagar em aberto">ⓘ</span></span>
          <strong class="lc-value lc-amber">${asMoney(ind.aReceberLiquido)}</strong>
          <span class="lc-sub">${ind.aReceberLiquido > 0
            ? "Está no lucro mas ainda não entrou no caixa"
            : ind.aReceberLiquido < 0
              ? "Caixa real acima do lucro — recebimentos de períodos anteriores ou mais contas a pagar em aberto do que a receber"
              : "Lucro e caixa estão sincronizados"}</span>
        </article>
      </div>
      ${alerts.length ? `<div class="lucro-caixa-alerts">${alerts.join("")}</div>` : ""}
      <div class="lucro-caixa-chart">${lucroCaixaChart(periodKey, projectId)}</div>
    </section>`;
}

// Seção "Reconciliação Lucro x Caixa" para o relatório DRE Gerencial.
// Respeita o filtro de obra/projeto da barra de filtros (getFilters).
function lucroCaixaReconcSection(periodKey, projectId = "") {
  const ind = lucroCaixaIndicators(periodKey, projectId);
  const alerts = lucroCaixaAlerts(ind, lucroCaixaOverdue30(projectId));
  const scope = projectId ? ` · ${svgText(nameOf("projects", projectId) || "obra")}` : "";
  return `
    <section class="dre-bloco lucro-caixa-reconc">
      <div class="lucro-caixa-head">
        <h3>Reconciliação Lucro x Caixa</h3>
        ${lucroCaixaPeriodSelect("dreLucroCaixaPeriod", periodKey)}
      </div>
      <p class="muted">Por que o lucro de competência difere do dinheiro em caixa no período (${asDate(ind.start)} a ${asDate(ind.end)})${scope}.</p>
      ${table("Reconciliação Lucro x Caixa", [
        { line: "Lucro gerencial (competência)", amount: ind.lucroGerencial },
        { line: "Caixa real (regime de caixa)", amount: ind.resultadoCaixa },
        { line: "Diferença (a receber líquido)", amount: ind.aReceberLiquido },
        { line: "Receitas em aberto no período", amount: ind.abertasReceber },
        { line: "Despesas em aberto no período", amount: ind.abertasPagar },
      ], ["line", "amount"])}
      ${alerts.length ? `<div class="lucro-caixa-alerts">${alerts.join("")}</div>` : ""}
    </section>`;
}

function renderDashboard() {
  const metrics = dashboardMetrics();
  const cashFlow = monthlyCashFlowRows();
  const monthlyResult = monthlyResultRows();
  const project = activeDashboardProject();
  const projectOptions = db.projects.map((row) => `<option value="${row.id}" ${sameId(row.id, dashboardProjectId) ? "selected" : ""}>${svgText(row.name)}</option>`).join("");
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
        <h2>${project ? svgText(project.name) : "Visão geral ObraSync"}</h2>
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
    ${lucroCaixaPanel(lucroCaixaPeriod, activeDashboardProjectId())}
    <section class="kpi-grid dashboard-kpis">
      ${dashboardCards.map((card) => kpi(card[0], card[1], card[2] ?? true)).join("")}
    </section>
    ${dashboardAlerts(metrics)}
    ${dashboardExecutionSection()}
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
  qs("dashLucroCaixaPeriod")?.addEventListener("change", (event) => {
    lucroCaixaPeriod = event.target.value;
    render();
  });
  loadDashboardExecution();
}

// Execução (realizado vs orçado) das obras ativas, agregada por projeto.
function activeProjectsExecution() {
  const items = db.workBudgetItems || [];
  return (db.projects || []).filter((p) => p.status === "Em andamento").map((project) => {
    const projItems = items.filter((it) => sameId(it.projectId, project.id));
    let totalPrev = 0;
    let totalReal = 0;
    let temItem90 = false;
    const estouroItems = [];
    projItems.forEach((it) => {
      const ex = budgetItemExecution(it);
      totalPrev += ex.totalPrev;
      totalReal += ex.totalReal;
      if (ex.estouro || ex.pct > 100) estouroItems.push({ item: it, ex });
      else if (ex.pct >= 90 && ex.pct <= 100) temItem90 = true;
    });
    const badge = estouroItems.length ? "vermelho" : (temItem90 ? "amarelo" : "verde");
    const pct = totalPrev > 0 ? (totalReal / totalPrev) * 100 : 0;
    return { project, totalPrev, totalReal, pct, estouroItems, estouroCount: estouroItems.length, badge, hasItems: projItems.length > 0 };
  }).filter((r) => r.hasItems);
}

function goToProjectBudget(projectId) {
  const budget = (db.workBudgets || []).find((b) => sameId(b.projectId, projectId));
  if (budget) selectedWorkBudgetId = budget.id;
  currentModule = "workBudgets";
  render();
}

// Os 3 widgets de execução buscam o resumo do servidor (?module=dashboardExecution
// &action=summary), com spinner, erro+retry e auto-refresh a cada 5 min.
let dashboardExecState = { data: null, loading: false, error: false };
let dashboardExecTimer = null;

function dashboardExecutionSection() {
  return `<div id="dashExecContainer">${dashboardExecutionContent()}</div>`;
}

function dashboardExecutionContent() {
  const s = dashboardExecState;
  if (s.loading && !s.data) {
    return '<section class="exec-loading"><span class="exec-spinner"></span> Carregando dados de execução das obras…</section>';
  }
  if (s.error && !s.data) {
    return '<section class="exec-error"><span>Não foi possível carregar os dados de execução.</span> <button type="button" class="secondary" id="dashExecRetry">Tentar novamente</button></section>';
  }
  if (!s.data || !(s.data.obras || []).length) return "";
  return dashboardExecutionWidgets(s.data);
}

// Fallback de modo local: monta o mesmo formato a partir do db carregado.
function computeExecutionSummaryLocal() {
  const all = activeProjectsExecution();
  return {
    obras: all.map((r) => ({ id: r.project.id, name: r.project.name, previsto: r.totalPrev, realizado: r.totalReal, percentual: r.pct, estouro: Math.max(0, r.totalReal - r.totalPrev), itens_estouro: r.estouroCount })),
    estouros: all.flatMap((r) => r.estouroItems.map((e) => ({ id: e.item.id, projectId: r.project.id, obra: r.project.name, item: e.item.description || e.item.code || "Item", percentual: e.ex.pct }))),
    totais: { itens_estouro: all.reduce((s, r) => s + r.estouroCount, 0) },
  };
}

async function loadDashboardExecution(force = false) {
  if (!serverMode) {
    dashboardExecState = { data: computeExecutionSummaryLocal(), loading: false, error: false };
    repaintDashboardExecution();
    return;
  }
  if (dashboardExecState.data && !force) {
    repaintDashboardExecution();
    scheduleDashboardExecRefresh();
    return;
  }
  dashboardExecState = { ...dashboardExecState, loading: true, error: false };
  repaintDashboardExecution();
  try {
    const data = await apiModuleRequest("?module=dashboardExecution&action=summary");
    dashboardExecState = { data: data || { obras: [], estouros: [], totais: {} }, loading: false, error: false };
  } catch {
    dashboardExecState = { ...dashboardExecState, loading: false, error: true };
  }
  repaintDashboardExecution();
  scheduleDashboardExecRefresh();
}

function repaintDashboardExecution() {
  const c = qs("dashExecContainer");
  if (!c) return;
  c.innerHTML = dashboardExecutionContent();
  wireDashboardExecution();
}

function scheduleDashboardExecRefresh() {
  if (dashboardExecTimer) clearTimeout(dashboardExecTimer);
  dashboardExecTimer = setTimeout(() => { if (currentModule === "dashboard") loadDashboardExecution(true); }, 5 * 60 * 1000);
}

function dashboardExecutionWidgets(data) {
  const obras = data.obras || [];
  const estouros = data.estouros || [];
  const totalEstouro = (data.totais && data.totais.itens_estouro) || estouros.length;
  const badgeOf = (o) => (o.itens_estouro > 0 ? "vermelho" : (o.percentual >= 90 ? "amarelo" : "verde"));
  const badgeClass = (b) => (b === "vermelho" ? "exec-estouro" : b === "amarelo" ? "exec-parcial" : "exec-concluido");
  const barClass = (b) => (b === "vermelho" ? "exec-bar-red" : b === "amarelo" ? "exec-bar-yellow" : "exec-bar-green");

  const obrasComEstouro = [...new Set(estouros.map((e) => e.projectId))];
  const estouroAlert = totalEstouro ? `
    <section class="exec-dash-alert">
      <div class="exec-dash-alert-head">⚠️ ${totalEstouro} item(ns) com estouro em ${obrasComEstouro.length} obra(s)</div>
      <ul class="exec-dash-alert-list">
        ${estouros.slice(0, 6).map((e) => `<li><strong>${svgText(e.obra)}</strong> · ${svgText(e.item || "Item")} · ${asPercent(e.percentual)}</li>`).join("")}
      </ul>
      ${obrasComEstouro.length ? `<button type="button" class="secondary" data-exec-detail="${escapeHtml(obrasComEstouro[0])}">Ver detalhes</button>` : ""}
    </section>` : "";

  const obrasCard = `
    <div class="panel exec-dash-card">
      <div class="exec-dash-card-head">
        <h3>Execução das Obras</h3>
        <button type="button" class="link-button" id="dashExecRefresh" title="Atualizar agora">↻ Atualizar</button>
      </div>
      <div class="exec-dash-list">
        ${obras.slice(0, 5).map((o) => {
          const b = badgeOf(o);
          return `<button type="button" class="exec-dash-item" data-exec-go="${escapeHtml(o.id)}" title="Abrir o orçamento desta obra">
            <div class="exec-dash-item-head">
              <strong>${svgText(o.name)}</strong>
              <span class="exec-badge ${badgeClass(b)}">${asPercent(o.percentual)}</span>
            </div>
            <div class="exec-progress-bar small"><span class="${barClass(b)}" style="width:${Math.min(100, Math.round(o.percentual || 0))}%"></span></div>
            <span class="muted">${asMoney(o.realizado)} realizado de ${asMoney(o.previsto)} previsto</span>
          </button>`;
        }).join("")}
      </div>
      ${obras.length > 5 ? `<button type="button" class="link-button" data-exec-all>Ver todas (${obras.length})</button>` : ""}
    </div>`;

  const chart = chartPanel("Previsto vs Realizado por obra", "Valor orçado, realizado e estouro por obra ativa", executionGroupedChart(obras));

  return `
    ${estouroAlert}
    <section class="split dashboard-execution">
      ${obrasCard}
      ${chart}
    </section>`;
}

// Gráfico SVG (padrão do projeto) com tooltip combinado por obra (não o <title>).
function executionGroupedChart(obras) {
  const series = [{ key: "Previsto", color: "#2563eb" }, { key: "Realizado", color: "#2e7d32" }, { key: "Estouro", color: "#c62828" }];
  const rows = obras.map((o) => ({
    label: o.name,
    Previsto: Number(o.previsto || 0),
    Realizado: Number(o.realizado || 0),
    Estouro: Number(o.estouro != null ? o.estouro : Math.max(0, (o.realizado || 0) - (o.previsto || 0))),
    _o: o,
  }));
  const values = rows.flatMap((r) => series.map((s) => Number(r[s.key] || 0)));
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
  const bars = rows.map((row, ri) => {
    const o = row._o;
    const tt = encodeURIComponent(JSON.stringify({
      nome: o.name,
      previsto: Number(o.previsto || 0),
      realizado: Number(o.realizado || 0),
      saldo: Number(o.previsto || 0) - Number(o.realizado || 0),
      pct: Number(o.percentual || 0),
      estouro: Number(row.Estouro || 0),
      itens: Number(o.itens_estouro || 0),
    }));
    const rects = series.map((s, si) => {
      const value = Number(row[s.key] || 0);
      const bx = pad.left + ri * groupWidth + 7 + si * barWidth;
      const by = value >= 0 ? y(value) : zeroY;
      const bh = Math.max(2, Math.abs(zeroY - y(value)));
      return `<rect x="${bx}" y="${by}" width="${barWidth - 2}" height="${bh}" rx="3" fill="${s.color}"></rect>`;
    }).join("");
    const hit = `<rect x="${pad.left + ri * groupWidth}" y="${pad.top}" width="${groupWidth}" height="${height - pad.top - pad.bottom}" fill="transparent"></rect>`;
    return `<g class="exec-bar-group" data-tt="${tt}">${rects}${hit}</g>`;
  }).join("");
  const labels = rows.map((row, i) => `<text x="${pad.left + i * groupWidth + groupWidth / 2}" y="${height - 16}" text-anchor="middle" class="chart-axis">${svgText(row.label)}</text>`).join("");
  return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Previsto vs Realizado por obra">${bars}${labels}</svg></div>`;
}

function wireDashboardExecution() {
  const c = qs("dashExecContainer");
  if (!c) return;
  c.querySelectorAll("[data-exec-go]").forEach((b) => b.addEventListener("click", () => goToProjectBudget(b.dataset.execGo)));
  c.querySelectorAll("[data-exec-detail]").forEach((b) => b.addEventListener("click", () => { workBudgetItemFilter = "estouro"; goToProjectBudget(b.dataset.execDetail); }));
  c.querySelector("[data-exec-all]")?.addEventListener("click", () => { currentModule = "workBudgets"; render(); });
  qs("dashExecRetry")?.addEventListener("click", () => loadDashboardExecution(true));
  qs("dashExecRefresh")?.addEventListener("click", () => loadDashboardExecution(true));
  wireExecChartTooltip();
}

function execChartTooltipEl() {
  let tip = qs("execChartTooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "execChartTooltip";
    tip.className = "exec-chart-tooltip";
    document.body.appendChild(tip);
  }
  return tip;
}

function positionExecTooltip(tip, event) {
  const offset = 14;
  const rect = tip.getBoundingClientRect();
  let x = event.clientX + offset;
  let y = event.clientY + offset;
  if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - offset;
  if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - offset;
  tip.style.left = `${Math.max(8, x)}px`;
  tip.style.top = `${Math.max(8, y)}px`;
}

function execTooltipHtml(d) {
  const head = `<div class="exec-tt-title">🏗 ${svgText(d.nome)}</div>`;
  const row = (label, value, cls = "") => `<div class="exec-tt-row ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
  if (d.estouro > 0 || d.pct > 100) {
    return head
      + row("Previsto:", asMoney(d.previsto))
      + row("Realizado:", asMoney(d.realizado))
      + row("Estouro:", `${asMoney(d.estouro)} ⚠️`, "exec-tt-bad")
      + row("Execução:", asPercent(d.pct))
      + row("Itens:", `${d.itens} ${d.itens === 1 ? "item" : "itens"} com estouro`);
  }
  return head
    + row("Previsto:", asMoney(d.previsto))
    + row("Realizado:", asMoney(d.realizado))
    + row("Saldo:", `${asMoney(d.saldo)} ✓`, "exec-tt-ok")
    + row("Execução:", asPercent(d.pct))
    + row("Estouro:", "— (nenhum)");
}

function wireExecChartTooltip() {
  const groups = qs("dashExecContainer")?.querySelectorAll(".exec-bar-group");
  if (!groups || !groups.length) return;
  const tip = execChartTooltipEl();
  groups.forEach((g) => {
    const show = (event) => {
      try { tip.innerHTML = execTooltipHtml(JSON.parse(decodeURIComponent(g.dataset.tt))); } catch { return; }
      tip.style.display = "block";
      positionExecTooltip(tip, event);
    };
    g.addEventListener("mouseenter", show);
    g.addEventListener("mousemove", (event) => positionExecTooltip(tip, event));
    g.addEventListener("mouseleave", () => { tip.style.display = "none"; });
  });
}

function dashboardAlerts(metrics) {
  const alerts = [];
  if (metrics.overdue > 0) alerts.push(`Contas vencidas: ${asMoney(metrics.overdue)}.`);
  if (metrics.project && metrics.delayedStages > 0) alerts.push(`Cronograma com ${metrics.delayedStages} etapa(s) atrasada(s), atraso máximo de ${metrics.scheduleDelayDays} dia(s).`);
  if (metrics.project && metrics.realizedCost > metrics.costForecast && metrics.costForecast > 0) alerts.push("Custo realizado acima do previsto para esta obra.");
  const margin = metrics.project ? metrics.realizedMargin : metrics.margin;
  if (margin < 10 && ((metrics.project && metrics.revenueReceived > 0) || (!metrics.project && metrics.revenueTotal > 0))) alerts.push("Margem líquida baixa. Revise custos, preços e despesas.");
  // Auditoria do dashboard — alertas da empresa (visão geral): propostas expiradas,
  // obras atrasadas e estouro de orçamento. Campos reais: validityDate (proposta),
  // endForecast (obra), quantidade_realizada/quantity (item do orçamento).
  if (!metrics.project) {
    const hoje = localDateString(new Date());
    const propostasExpiradas = (db.proposals || []).filter((p) => p.status === "Enviada" && p.validityDate && String(p.validityDate).slice(0, 10) < hoje).length;
    if (propostasExpiradas > 0) alerts.push(`${propostasExpiradas} proposta(s) enviada(s) com validade vencida — renove ou arquive.`);
    const obrasAtrasadas = (db.projects || []).filter((o) => ["Em andamento", "Contratada"].includes(o.status) && o.endForecast && String(o.endForecast).slice(0, 10) < hoje).length;
    if (obrasAtrasadas > 0) alerts.push(`${obrasAtrasadas} obra(s) com previsão de término vencida.`);
    const itensEstouro = (db.workBudgetItems || []).filter((i) => Number(i.quantity || 0) > 0 && Number(i.quantidade_realizada || 0) > Number(i.quantity || 0)).length;
    if (itensEstouro > 0) alerts.push(`${itensEstouro} item(ns) do orçamento com quantidade realizada acima da prevista (estouro).`);
  }
  if (!alerts.length) return "";
  return `<section class="alerts">${alerts.map((message) => `<div class="alert">${message}</div>`).join("")}</section>`;
}

function dashboardAgendaKanbanWidgets() {
  const events = upcomingAgendaEvents(7);
  const cards = urgentKanbanCards();
  const eventRows = events.length ? events.map((event) => `
    <li><strong>${svgText(event.titulo)}</strong><span>${asDate(String(event.data_inicio || "").slice(0, 10))} · ${agendaTypeLabel(event.tipo)}${event.obra_id ? ` · ${svgText(nameOf("projects", event.obra_id))}` : ""}</span></li>
  `).join("") : '<li class="muted-row">Sem eventos nos próximos 7 dias</li>';
  const cardRows = cards.length ? cards.map((card) => `
    <li><strong>${svgText(card.titulo)}</strong><span>${priorityLabel(card.prioridade)} · ${card.data_vencimento ? asDate(card.data_vencimento) : "Sem prazo"}${card.obra_id ? ` · ${svgText(nameOf("projects", card.obra_id))}` : ""}</span></li>
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
  return `<article class="kpi ${tone}"><span>${label}</span><strong>${format ? asMoney(value) : svgText(value)}</strong></article>`;
}

function resultByCostCenter() {
  return db.costCenters.map((cc) => {
    const revenue = db.receivable.filter((r) => sameId(r.costCenterId, cc.id) && !isCancelado(r.status)).reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = db.payable.filter((p) => sameId(p.costCenterId, cc.id) && !isCancelado(p.status)).reduce((s, p) => s + Number(p.amount || 0), 0);
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
      <strong>${svgText(r.label)}</strong>
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

// Versão abreviada para os rótulos do eixo Y dos gráficos: R$ 1k, R$ 10k, R$ 1M.
// Tooltips continuam usando compactMoney (valor cheio).
function abbreviateMoney(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const fmt = (x) => {
    const r = Math.round(x * 10) / 10;
    return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace(".", ",");
  };
  if (abs >= 1000000) return `${sign}R$ ${fmt(abs / 1000000)}M`;
  if (abs >= 1000) return `${sign}R$ ${fmt(abs / 1000)}k`;
  return `${sign}R$ ${Math.round(abs)}`;
}

// Escape padrão de HTML para qualquer dado dinâmico interpolado em innerHTML.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
// Alias histórico: vários templates antigos chamam svgText.
const svgText = escapeHtml;

function lineChart(series, labels, columnTooltips = null, opts = {}) {
  const strokeW = opts.strokeWidth || 1.5;
  const dotR = opts.dotRadius || 2.5;
  const values = series.flatMap((item) => item.values);
  if (!labels.length || !hasValues(values)) return emptyChart();
  const width = 760;
  const height = 180;
  const pad = { top: 16, right: 24, bottom: 28, left: 52 };
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const x = (index) => pad.left + (labels.length === 1 ? 0 : (index / (labels.length - 1)) * (width - pad.left - pad.right));
  const y = (value) => pad.top + (1 - ((value - min) / range)) * (height - pad.top - pad.bottom);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((step) => {
    const gy = pad.top + step * (height - pad.top - pad.bottom);
    const label = max - step * range;
    return `<line x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}" class="chart-grid-line"></line><text x="8" y="${gy + 4}" class="chart-axis">${abbreviateMoney(label)}</text>`;
  }).join("");
  const paths = series.map((item) => {
    const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
    return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
  }).join("");
  const dots = series.map((item) => item.values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="${dotR}" fill="${item.color}"><title>${svgText(item.label)}: ${compactMoney(value)}</title></circle>`).join("")).join("");
  const axisLabels = labels.map((label, index) => `<text x="${x(index)}" y="${height - 14}" text-anchor="middle" class="chart-axis">${svgText(label)}</text>`).join("");
  // Faixa transparente por coluna: tooltip combinado (todas as séries do mês) ao
  // passar o mouse. Fica por cima de tudo para capturar o hover. Opcional —
  // quando columnTooltips não é informado, o gráfico segue inalterado.
  const hoverBands = (Array.isArray(columnTooltips) && columnTooltips.length === labels.length)
    ? labels.map((_, index) => {
        const span = labels.length > 1 ? (width - pad.left - pad.right) / (labels.length - 1) : (width - pad.left - pad.right);
        const rx = Math.max(pad.left, x(index) - span / 2);
        const rw = Math.min(width - pad.right, x(index) + span / 2) - rx;
        return `<rect x="${rx}" y="${pad.top}" width="${rw}" height="${height - pad.top - pad.bottom}" fill="transparent"><title>${svgText(columnTooltips[index])}</title></rect>`;
      }).join("")
    : "";
  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de linha">
        ${grid}
        <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" class="chart-axis-line"></line>
        ${paths}
        ${dots}
        ${axisLabels}
        ${hoverBands}
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
        <h2>Viabilidade Financeira</h2>
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

// ── Seção IA: tela de indexação (módulo iaIndex) ────────────────────────────
// Casa dedicada da IA no menu. Hoje só a indexação; preparada para crescer (busca
// semântica, de-para, IA Orçamento) — basta adicionar novos módulos à seção "ia" do
// menu + seus render*(), ou abas internas aqui dentro.
function renderIaIndex() {
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>IA — Indexação</h2>
        <p>Geração dos vetores de busca semântica (embeddings) da base SINAPI. Primeira etapa da IA local; a busca semântica e os demais recursos virão nesta seção.</p>
      </div>
    </section>
    ${iaIndexCardHtml()}`;
  wireIaIndexCard();
}

// ── IA: card de indexação da base SINAPI (usado pela seção IA) ──────────────
// Mesma autenticação/sessão das outras telas: apiModuleRequest envia o token e bate
// em ?module=ia&action=startIndex|indexStatus (worker em background no servidor).
let iaIndexTimer = null;

function iaIndexCardHtml() {
  if (!serverMode) {
    return '<section class="panel"><h3>IA — Indexação da base SINAPI</h3><p class="empty">Disponível apenas com a API no servidor.</p></section>';
  }
  return `
    <section class="panel" id="iaIndexCard">
      <h3>IA — Indexação da base SINAPI</h3>
      <p class="field-hint">Gera os vetores de busca semântica (embeddings) das composições e insumos da base SINAPI — necessário antes da busca por IA. Total estimado: ~25 mil itens (10.378 composições + 14.565 insumos). Roda em segundo plano, em baixa prioridade.</p>
      <div id="iaIndexProgress" class="muted">Verificando status…</div>
      <div style="height:10px;background:var(--line);border-radius:5px;overflow:hidden;margin:10px 0">
        <div id="iaIndexBar" style="height:100%;width:0%;background:#185FA5;transition:width .3s"></div>
      </div>
      <div class="actions"><button class="primary" type="button" id="iaIndexBtn">Indexar base para IA</button></div>
    </section>`;
}

function wireIaIndexCard() {
  if (!serverMode || !qs("iaIndexCard")) return;
  qs("iaIndexBtn")?.addEventListener("click", startIaIndex);
  loadIaIndexStatus();
}

function updateIaIndexUI(d) {
  const prog = qs("iaIndexProgress");
  const bar = qs("iaIndexBar");
  const btn = qs("iaIndexBtn");
  if (!prog || !bar) return false;
  const total = Number(d.total || 0);
  const done = Number(d.processados || 0);
  const pct = Math.max(0, Math.min(100, Number(d.percent || 0)));
  const label = { queued: "na fila", running: "indexando…", done: "concluído ✅", error: "erro", none: "não iniciado" }[d.status] || (d.status || "");
  prog.textContent = `${done.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} indexados (${pct}%) — ${label}`
    + (d.status === "error" && d.error ? ` · ${d.error}` : "");
  bar.style.width = `${pct}%`;
  const busy = d.status === "running" || d.status === "queued";
  if (btn) { btn.disabled = busy; btn.textContent = busy ? "Indexando…" : "Indexar base para IA"; }
  return busy;
}

async function loadIaIndexStatus() {
  try {
    const d = await apiModuleRequest("?module=ia&action=indexStatus");
    if (updateIaIndexUI(d)) scheduleIaPoll();
  } catch (error) {
    const prog = qs("iaIndexProgress");
    if (prog) prog.textContent = `Não foi possível obter o status: ${error.message}`;
  }
}

function scheduleIaPoll() {
  if (iaIndexTimer) clearTimeout(iaIndexTimer);
  iaIndexTimer = setTimeout(() => {
    iaIndexTimer = null;
    // Continua o polling só enquanto a aba Plugins (com o card) estiver aberta.
    if (currentModule === "plugins" && qs("iaIndexProgress")) loadIaIndexStatus();
  }, 2500);
}

async function startIaIndex() {
  const btn = qs("iaIndexBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Iniciando…"; }
  try {
    await apiModuleRequest("?module=ia&action=startIndex", { method: "POST" });
    showToast("Indexação IA iniciada em segundo plano.");
    loadIaIndexStatus();
  } catch (error) {
    alert(`Não foi possível iniciar a indexação: ${error.message}`);
    if (btn) { btn.disabled = false; btn.textContent = "Indexar base para IA"; }
  }
}

// ── Seção IA: busca semântica na base SINAPI (módulo iaBusca) ────────────────
// O usuário descreve o item em linguagem natural; o servidor gera o embedding do
// texto (Ollama, 384 dims) e compara por similaridade de cosseno com os vetores já
// indexados em ia_embeddings, devolvendo os itens SINAPI mais parecidos POR
// SIGNIFICADO (não por palavra exata). Mesma sessão/token das demais telas.
function renderIaBusca() {
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>IA — Busca semântica</h2>
        <p>Descreva o que procura em linguagem natural e encontre os itens da base SINAPI mais parecidos por significado — não por palavra exata.</p>
      </div>
    </section>
    <section class="panel">
      ${serverMode ? "" : '<p class="empty">A busca semântica depende da API PHP e do Ollama no servidor. Em modo local não está disponível.</p>'}
      <form id="iaBuscaForm" class="ia-busca-form" autocomplete="off">
        <label class="ia-busca-campo">
          <span>Descreva o item que procura</span>
          <textarea id="iaBuscaTexto" rows="3" placeholder="Ex.: assentamento de piso cerâmico com argamassa colante em ambiente interno" ${serverMode ? "" : "disabled"}></textarea>
        </label>
        <div class="ia-busca-controls">
          <label>Buscar em
            <select id="iaBuscaOrigem" ${serverMode ? "" : "disabled"}>
              <option value="todos">Todos</option>
              <option value="composicao">Só composições</option>
              <option value="insumo">Só insumos</option>
            </select>
          </label>
          <label>Resultados
            <select id="iaBuscaLimite" ${serverMode ? "" : "disabled"}>
              <option value="10">10</option>
              <option value="20" selected>20</option>
              <option value="50">50</option>
            </select>
          </label>
          <button class="primary" type="submit" id="iaBuscaBtn" ${serverMode ? "" : "disabled"}>Buscar</button>
        </div>
      </form>
      <p class="field-hint">A busca leva ~1–2s para gerar o embedding do texto. Requer a base já indexada (seção IA → Indexação SINAPI).</p>
      <div id="iaBuscaResultados" class="ia-busca-resultados"></div>
    </section>`;
  if (!serverMode) return;
  qs("iaBuscaForm")?.addEventListener("submit", runIaBusca);
  qs("iaBuscaTexto")?.focus();
}

async function runIaBusca(event) {
  event.preventDefault();
  const box = qs("iaBuscaResultados");
  if (!box) return;
  const texto = (qs("iaBuscaTexto")?.value || "").trim();
  if (!texto) {
    box.innerHTML = '<p class="empty">Digite uma descrição para buscar.</p>';
    qs("iaBuscaTexto")?.focus();
    return;
  }
  const origem = qs("iaBuscaOrigem")?.value || "todos";
  const limite = Number(qs("iaBuscaLimite")?.value || 20);
  const btn = qs("iaBuscaBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Buscando…"; }
  box.innerHTML = '<p class="muted">Buscando itens parecidos por significado… (gerando o embedding do texto)</p>';
  try {
    // apiModuleRequest envia a sessão (token) e devolve o data [{origem, code,
    // description, unit, valor, similaridade}]; se o Ollama estiver fora a API
    // responde success:false e o apiModuleRequest lança com a mensagem clara.
    const data = await apiModuleRequest("?module=ia&action=buscarSemantica", {
      method: "POST",
      body: JSON.stringify({ texto, origem, limite }),
    });
    renderIaBuscaResultados(data || []);
  } catch (error) {
    box.innerHTML = `<p style="color:#b42318"><strong>❌ Não foi possível buscar.</strong> ${escapeHtml(error.message || "Erro desconhecido.")}</p>`;
  } finally {
    if (btn) { btn.disabled = !serverMode; btn.textContent = "Buscar"; }
  }
}

// Badge de % de similaridade: verde >80, amarelo 60–80, cinza <60.
function iaSimBadge(sim) {
  const pct = Math.max(0, Math.min(100, Number(sim || 0)));
  const cls = pct > 80 ? "ia-sim-alta" : (pct >= 60 ? "ia-sim-media" : "ia-sim-baixa");
  return `<span class="ia-sim-badge ${cls}">${pct.toFixed(1)}%</span>`;
}

function renderIaBuscaResultados(rows) {
  const box = qs("iaBuscaResultados");
  if (!box) return;
  if (!Array.isArray(rows) || !rows.length) {
    box.innerHTML = '<p class="empty">Nenhum item encontrado. Verifique se a base SINAPI já foi indexada (seção IA → Indexação SINAPI).</p>';
    return;
  }
  const lines = rows.map((row) => {
    const isComp = row.origem === "composicao";
    const tag = isComp
      ? '<span class="ia-tag ia-tag-comp">COMPOSIÇÃO</span>'
      : '<span class="ia-tag ia-tag-ins">INSUMO</span>';
    return `
      <article class="ia-result-row">
        <div class="ia-result-sim">${iaSimBadge(row.similaridade)}</div>
        <div class="ia-result-main">
          <div class="ia-result-head">${tag}<strong>${escapeHtml(row.code || "")}</strong>${row.unit ? `<span class="ia-result-unit">${escapeHtml(row.unit)}</span>` : ""}</div>
          <div class="ia-result-desc">${escapeHtml(row.description || "")}</div>
        </div>
        <div class="ia-result-valor">${asMoney(row.valor)}</div>
      </article>`;
  }).join("");
  box.innerHTML = `
    <p class="muted ia-result-count">${rows.length} resultado(s), ordenados por similaridade.</p>
    <div class="ia-result-list">${lines}</div>`;
}

// ── Seção IA: de-para em lote (módulo iaDepara) ─────────────────────────────
// Fluxo: sobe planilha (.xlsx/.csv) → a IA classifica cada item contra a base
// SINAPI (mesma busca semântica por cosseno, no worker) em ACHOU/REVISAR/COTAÇÃO
// PRÓPRIA → o usuário revisa (Aceitar) → exporta o resultado em Excel.
const iaDeparaState = { jobId: null, total: 0, colunas: [], status: "none", filtro: "todos", grupo: "todos", counts: null, grupos: [], abasLidas: [], abasIgnoradas: [] };
let iaDeparaTimer = null;

const IA_DEPARA_SIT = {
  achou: { label: "ACHOU", cls: "ia-dp-achou" },
  revisar: { label: "REVISAR", cls: "ia-dp-revisar" },
  cotacao_propria: { label: "COTAÇÃO PRÓPRIA", cls: "ia-dp-cotacao" },
};

function iaDeparaColLabel(c) {
  return ({ descricao: "Descrição", codigo: "Código", quantidade: "Quantidade", unidade: "Unidade", valor: "Valor" })[c] || c;
}

// Resumo das abas lidas/ignoradas (mostrado após o upload, antes de classificar).
function iaDeparaAbasResumoHtml() {
  const lidas = iaDeparaState.abasLidas || [];
  const ign = iaDeparaState.abasIgnoradas || [];
  if (!lidas.length && !ign.length) return "";
  const lidasTxt = lidas.length
    ? lidas.map((a) => `<span class="ia-dp-aba-tag ia-dp-aba-ok">${escapeHtml(a.nome || "(sem nome)")} <span class="muted">(${Number(a.linhas || 0)})</span></span>`).join(" ")
    : '<span class="muted">nenhuma</span>';
  const ignTxt = ign.length
    ? ign.map((nome) => `<span class="ia-dp-aba-tag ia-dp-aba-skip">${escapeHtml(nome || "(sem nome)")}</span>`).join(" ")
    : "";
  return `
    <div class="ia-dp-abas">
      <div><strong>Abas lidas:</strong> ${lidasTxt}</div>
      ${ign.length ? `<div class="ia-dp-abas-ign"><strong>Ignoradas</strong> <span class="muted">(sem coluna de descrição)</span>: ${ignTxt}</div>` : ""}
    </div>`;
}

function renderIaDepara() {
  if (iaDeparaTimer) { clearTimeout(iaDeparaTimer); iaDeparaTimer = null; }
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>IA — De-para em lote</h2>
        <p>Suba um orçamento externo em Excel; a IA compara cada item com a base SINAPI e o classifica em ACHOU, REVISAR ou COTAÇÃO PRÓPRIA. Depois você revisa e exporta o resultado.</p>
      </div>
    </section>
    <section class="panel">
      ${serverMode ? "" : '<p class="empty">O de-para em lote depende da API PHP e do Ollama no servidor. Em modo local não está disponível.</p>'}
      <div id="iaDeparaUploadBox" class="${serverMode ? "" : "hidden"}">
        <h3>1. Enviar planilha</h3>
        <p class="field-hint">Aceita .xlsx, .xls ou .csv. A planilha precisa de uma coluna de <strong>descrição</strong> (ou Item/Serviço/Produto). Detectadas automaticamente quando existirem: código (SINAPI), quantidade, unidade e valor. Nada é inventado — só lemos o que está na planilha.</p>
        <form id="iaDeparaForm" class="ia-dp-upload-form">
          <input type="file" id="iaDeparaFile" accept=".xlsx,.xls,.csv" required ${serverMode ? "" : "disabled"}>
          <button class="primary" type="submit" ${serverMode ? "" : "disabled"}>Enviar planilha</button>
        </form>
      </div>
      <div id="iaDeparaArea"></div>
    </section>`;
  if (!serverMode) return;
  qs("iaDeparaForm")?.addEventListener("submit", iaDeparaUpload);
}

async function iaDeparaUpload(event) {
  event.preventDefault();
  const file = qs("iaDeparaFile")?.files?.[0];
  const area = qs("iaDeparaArea");
  if (!file) { alert("Selecione uma planilha."); return; }
  const btn = qs("iaDeparaForm")?.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
  if (area) area.innerHTML = '<p class="muted">Lendo a planilha e detectando as colunas…</p>';
  try {
    const fd = new FormData();
    fd.append("file", file);
    const payload = await fetchForm("?module=ia&action=deparaUpload", fd);
    const d = payload?.data ?? payload;
    if (!d || !d.jobId) throw new Error((payload && payload.message) || "Falha ao ler a planilha.");
    iaDeparaState.jobId = d.jobId;
    iaDeparaState.total = d.total || 0;
    iaDeparaState.colunas = d.colunasDetectadas || [];
    iaDeparaState.abasLidas = d.abasLidas || [];
    iaDeparaState.abasIgnoradas = d.abasIgnoradas || [];
    iaDeparaState.status = "uploaded";
    iaDeparaState.filtro = "todos";
    iaDeparaState.grupo = "todos";
    iaDeparaState.grupos = [];
    iaDeparaState.counts = null;
    iaDeparaRenderReady();
  } catch (error) {
    if (area) area.innerHTML = `<p style="color:#b42318"><strong>❌ ${escapeHtml(error.message || "Não foi possível ler a planilha.")}</strong></p>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Enviar planilha"; }
  }
}

function iaDeparaRenderReady() {
  const area = qs("iaDeparaArea");
  if (!area) return;
  const cols = iaDeparaState.colunas.length
    ? iaDeparaState.colunas.map((c) => `<span class="ia-dp-chip-col">${escapeHtml(iaDeparaColLabel(c))}</span>`).join(" ")
    : '<span class="muted">nenhuma além da descrição</span>';
  area.innerHTML = `
    <div class="ia-dp-ready">
      <h3>2. Classificar com IA</h3>
      <p><strong>${iaDeparaState.total.toLocaleString("pt-BR")}</strong> itens lidos. Colunas detectadas: ${cols}</p>
      ${iaDeparaAbasResumoHtml()}
      <p class="field-hint">A IA gera o embedding de cada descrição e compara por significado com a base SINAPI (~1–2s por item; roda em segundo plano, em baixa prioridade). Itens com código SINAPI válido casam direto pelo código.</p>
      <div id="iaDeparaProgress" class="hidden">
        <div class="ia-dp-progress-text muted">Classificando…</div>
        <div class="ia-dp-bar"><div id="iaDeparaBar" style="width:0%"></div></div>
      </div>
      <div class="actions"><button class="primary" type="button" id="iaDeparaStartBtn">Classificar com IA</button></div>
    </div>
    <div id="iaDeparaResult"></div>`;
  qs("iaDeparaStartBtn")?.addEventListener("click", iaDeparaStart);
}

async function iaDeparaStart() {
  if (!iaDeparaState.jobId) return;
  const btn = qs("iaDeparaStartBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Iniciando…"; }
  try {
    await apiModuleRequest("?module=ia&action=deparaStart", { method: "POST", body: JSON.stringify({ jobId: iaDeparaState.jobId }) });
    qs("iaDeparaProgress")?.classList.remove("hidden");
    iaDeparaPoll();
  } catch (error) {
    alert(`Não foi possível iniciar a classificação: ${error.message}`);
    if (btn) { btn.disabled = false; btn.textContent = "Classificar com IA"; }
  }
}

async function iaDeparaPoll() {
  if (!iaDeparaState.jobId) return;
  try {
    const d = await apiModuleRequest(`?module=ia&action=deparaStatus&job=${encodeURIComponent(iaDeparaState.jobId)}`);
    const pct = Math.max(0, Math.min(100, Number(d.percent || 0)));
    const bar = qs("iaDeparaBar");
    const txt = document.querySelector("#iaDeparaProgress .ia-dp-progress-text");
    if (bar) bar.style.width = `${pct}%`;
    if (txt) {
      const label = { queued: "na fila", running: "classificando…", done: "concluído ✅", error: "erro", none: "—" }[d.status] || d.status;
      txt.textContent = `${Number(d.processados || 0).toLocaleString("pt-BR")} de ${Number(d.total || 0).toLocaleString("pt-BR")} (${pct}%) — ${label}`
        + (d.status === "error" && d.error ? ` · ${d.error}` : "");
    }
    iaDeparaState.status = d.status;
    iaDeparaState.counts = d.counts || iaDeparaState.counts;
    if (d.status === "running" || d.status === "queued") {
      iaDeparaTimer = setTimeout(() => { iaDeparaTimer = null; if (currentModule === "iaDepara" && qs("iaDeparaBar")) iaDeparaPoll(); }, 2500);
    } else if (d.status === "done") {
      const startBtn = qs("iaDeparaStartBtn");
      if (startBtn) { startBtn.disabled = false; startBtn.textContent = "Reclassificar"; }
      iaDeparaLoadResults("todos");
    } else {
      const startBtn = qs("iaDeparaStartBtn");
      if (startBtn) { startBtn.disabled = false; startBtn.textContent = "Tentar novamente"; }
    }
  } catch (error) {
    const txt = document.querySelector("#iaDeparaProgress .ia-dp-progress-text");
    if (txt) txt.textContent = `Não foi possível obter o status: ${error.message}`;
  }
}

async function iaDeparaLoadResults(filtro) {
  iaDeparaState.filtro = filtro || "todos";
  const box = qs("iaDeparaResult");
  if (!box) return;
  box.innerHTML = '<p class="muted">Carregando resultados…</p>';
  try {
    const data = await apiModuleRequest(`?module=ia&action=deparaItens&job=${encodeURIComponent(iaDeparaState.jobId)}&situacao=${encodeURIComponent(iaDeparaState.filtro)}&grupo=${encodeURIComponent(iaDeparaState.grupo || "todos")}`);
    iaDeparaState.counts = data.counts || iaDeparaState.counts;
    iaDeparaState.grupos = data.grupos || iaDeparaState.grupos;
    iaDeparaRenderResult(data.itens || [], data.counts || {});
  } catch (error) {
    box.innerHTML = `<p style="color:#b42318">Não foi possível carregar os resultados: ${escapeHtml(error.message)}</p>`;
  }
}

function iaDeparaRenderResult(itens, counts) {
  const box = qs("iaDeparaResult");
  if (!box) return;
  const c = counts || {};
  const f = iaDeparaState.filtro;
  const bucket = (key, label, cls) => `
    <button type="button" class="ia-dp-bucket ${cls} ${f === key ? "active" : ""}" data-dp-filtro="${key}">
      <span class="ia-dp-bucket-num">${Number(c[key] || 0).toLocaleString("pt-BR")}</span>
      <span class="ia-dp-bucket-lbl">${label}</span>
    </button>`;
  const head = `
    <div class="ia-dp-buckets">
      <button type="button" class="ia-dp-bucket ia-dp-b-todos ${f === "todos" ? "active" : ""}" data-dp-filtro="todos">
        <span class="ia-dp-bucket-num">${Number(c.total || 0).toLocaleString("pt-BR")}</span><span class="ia-dp-bucket-lbl">TODOS</span>
      </button>
      ${bucket("achou", "ACHOU", "ia-dp-b-achou")}
      ${bucket("revisar", "REVISAR", "ia-dp-b-revisar")}
      ${bucket("cotacao_propria", "COTAÇÃO PRÓPRIA", "ia-dp-b-cotacao")}
      <button type="button" class="secondary ia-dp-export" id="iaDeparaExportBtn">⤓ Exportar resultado</button>
    </div>
    ${iaDeparaGrupoFilterHtml()}`;
  if (!itens.length) {
    box.innerHTML = head + '<p class="empty">Nenhum item nesta situação.</p>';
  } else {
    box.innerHTML = head + `
      <div class="ia-dp-table-wrap">
        <table class="ia-dp-table">
          <thead><tr>
            <th>#</th><th>Grupo</th><th>Descrição (origem)</th><th>Cód.</th><th></th>
            <th>Sim.</th><th>Match SINAPI</th><th>Valor</th><th>Ação</th>
          </tr></thead>
          <tbody>${itens.map(iaDeparaRowHtml).join("")}</tbody>
        </table>
      </div>`;
  }
  box.querySelectorAll("[data-dp-filtro]").forEach((btn) => btn.addEventListener("click", () => iaDeparaLoadResults(btn.dataset.dpFiltro)));
  qs("iaDeparaExportBtn")?.addEventListener("click", iaDeparaExport);
  qs("iaDeparaGrupoSel")?.addEventListener("change", (e) => { iaDeparaState.grupo = e.target.value || "todos"; iaDeparaLoadResults(iaDeparaState.filtro); });
  box.querySelectorAll("[data-dp-aceitar]").forEach((btn) => btn.addEventListener("click", () => iaDeparaAceitar(Number(btn.dataset.dpAceitar), btn)));
  box.querySelectorAll("[data-dp-criar]").forEach((btn) => btn.addEventListener("click", () => iaDeparaCriarComposicao(btn.dataset.dpCriar)));
}

// Seletor de grupo (aba) — só aparece quando há mais de um grupo no lote.
function iaDeparaGrupoFilterHtml() {
  const grupos = (iaDeparaState.grupos || []).filter((g) => (g.nome || "") !== "");
  if (grupos.length <= 1) return "";
  const sel = iaDeparaState.grupo || "todos";
  const totalTodos = grupos.reduce((acc, g) => acc + Number(g.total || 0), 0);
  const opts = [`<option value="todos" ${sel === "todos" ? "selected" : ""}>Todos os grupos (${totalTodos})</option>`]
    .concat(grupos.map((g) => `<option value="${escapeHtml(g.nome)}" ${sel === g.nome ? "selected" : ""}>${escapeHtml(g.nome)} (${Number(g.total || 0)})</option>`))
    .join("");
  return `
    <div class="ia-dp-grupo-filter">
      <label>Grupo (aba) <select id="iaDeparaGrupoSel">${opts}</select></label>
    </div>`;
}

function iaDeparaRowHtml(it) {
  const sit = IA_DEPARA_SIT[it.statusClassificacao] || { label: "—", cls: "" };
  const tag = `<span class="ia-dp-sit ${sit.cls}">${sit.label}</span>`;
  const grupo = it.grupoAba ? `<span class="ia-dp-grupo-tag">${escapeHtml(it.grupoAba)}</span>` : '<span class="muted">—</span>';
  const codOrigem = it.codigoOrigem ? `<div class="ia-dp-cod">${escapeHtml(it.codigoOrigem)}</div>` : '<span class="muted">—</span>';
  const sim = it.similaridade != null ? iaSimBadge(it.similaridade) : '<span class="muted">—</span>';
  let matchCell = '<span class="muted">—</span>';
  if (it.matchCode || it.matchDescription) {
    const mtag = it.matchOrigem === "insumo"
      ? '<span class="ia-tag ia-tag-ins">INS</span>'
      : (it.matchOrigem === "composicao" ? '<span class="ia-tag ia-tag-comp">COMP</span>' : "");
    matchCell = `<div class="ia-dp-match">${mtag}<strong>${escapeHtml(it.matchCode || "")}</strong>${it.matchUnit ? ` <span class="ia-result-unit">${escapeHtml(it.matchUnit)}</span>` : ""}<div class="ia-dp-match-desc">${escapeHtml(it.matchDescription || "")}</div></div>`;
  }
  const valor = it.matchValor != null
    ? asMoney(it.matchValor)
    : (it.valorOrigem != null ? `<span class="muted" title="valor da planilha (origem)">${asMoney(it.valorOrigem)}</span>` : "");
  let acao;
  if (it.statusClassificacao === "cotacao_propria") {
    acao = `<button class="secondary ia-dp-mini" type="button" data-dp-criar="${it.id}">Criar comp. própria</button>`;
  } else {
    const aceito = Number(it.aceito) === 1;
    acao = `<button class="${aceito ? "ia-dp-aceito" : "secondary"} ia-dp-mini" type="button" data-dp-aceitar="${it.id}">${aceito ? "✓ Aceito" : "Aceitar"}</button>`;
  }
  const extras = [
    it.unidadeOrigem ? `un: ${escapeHtml(it.unidadeOrigem)}` : "",
    it.quantidade != null ? `qtd: ${escapeHtml(String(it.quantidade))}` : "",
  ].filter(Boolean).join(" · ");
  return `
    <tr class="ia-dp-tr ${Number(it.aceito) === 1 ? "is-aceito" : ""}">
      <td class="ia-dp-linha">${it.linhaPlanilha ?? ""}</td>
      <td>${grupo}</td>
      <td class="ia-dp-desc">${tag}<div>${escapeHtml(it.descricaoOrigem || "")}</div>${extras ? `<span class="muted ia-dp-un">${extras}</span>` : ""}</td>
      <td>${codOrigem}</td>
      <td class="ia-dp-arrow">→</td>
      <td>${sim}</td>
      <td>${matchCell}</td>
      <td class="ia-dp-valor">${valor}</td>
      <td>${acao}</td>
    </tr>`;
}

async function iaDeparaAceitar(itemId, btn) {
  const novo = !btn.classList.contains("ia-dp-aceito");
  btn.disabled = true;
  try {
    await apiModuleRequest("?module=ia&action=deparaAceitar", { method: "POST", body: JSON.stringify({ itemId, aceito: novo }) });
    btn.classList.toggle("ia-dp-aceito", novo);
    btn.classList.toggle("secondary", !novo);
    btn.textContent = novo ? "✓ Aceito" : "Aceitar";
    btn.closest("tr")?.classList.toggle("is-aceito", novo);
  } catch (error) {
    alert(`Não foi possível salvar: ${error.message}`);
  } finally {
    btn.disabled = false;
  }
}

function iaDeparaCriarComposicao(_itemId) {
  // A criação completa da composição própria é a próxima fase; por ora levamos o
  // usuário ao módulo de composições próprias (o item é cotado fora da SINAPI).
  if (!canAccessModule("ownCompositions")) {
    showToast("Item de cotação própria: cadastre uma composição própria para ele.");
    return;
  }
  showToast("Crie a composição própria para este item de cotação fora da SINAPI.");
  currentModule = "ownCompositions";
  render();
}

async function iaDeparaExport() {
  if (!iaDeparaState.jobId) return;
  const btn = qs("iaDeparaExportBtn");
  if (btn) btn.disabled = true;
  try {
    const resp = await fetch(`${API_BASE}/?module=ia&action=deparaExport&job=${encodeURIComponent(iaDeparaState.jobId)}`, { headers: authHeaders() });
    if (!resp.ok) {
      let msg = `Erro ${resp.status}`;
      try { const j = await resp.json(); msg = j.error || j.message || msg; } catch { /* corpo não-JSON */ }
      throw new Error(msg);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DeParaIA_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(`Não foi possível exportar: ${error.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Seção IA: comparador de orçamento (módulo iaCompara) — Fase A ────────────
// Fluxo: sobe planilha → a IA casa cada item com a SINAPI (código ou busca
// semântica) e COMPARA o preço da planilha com o da SINAPI → relatório com baldes
// por situação + resumo de economia/excesso + comparação por linha → export Excel.
// Só análise nesta fase: não vira orçamento editável.
const iaComparaState = { jobId: null, total: 0, colunas: [], status: "none", filtro: "todos", counts: null, resumo: null };
let iaComparaTimer = null;

const IA_COMPARA_SIT = {
  achou: { label: "ACHOU", cls: "ia-dp-achou" },
  faltou_importar: { label: "FALTOU IMPORTAR", cls: "ia-dp-revisar" },
  cotacao_propria: { label: "COTAÇÃO PRÓPRIA", cls: "ia-dp-cotacao" },
};

function renderIaCompara() {
  if (iaComparaTimer) { clearTimeout(iaComparaTimer); iaComparaTimer = null; }
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>IA — Comparador de orçamento</h2>
        <p>Suba um orçamento em Excel; a IA encontra o equivalente na base SINAPI (por código ou por significado) e compara o preço da planilha com o da SINAPI, indicando qual é mais baixo e a diferença. Fase de análise — não gera orçamento editável ainda.</p>
      </div>
    </section>
    <section class="panel">
      ${serverMode ? "" : '<p class="empty">O comparador depende da API PHP e do Ollama no servidor. Em modo local não está disponível.</p>'}
      <div id="iaComparaUploadBox" class="${serverMode ? "" : "hidden"}">
        <h3>1. Enviar planilha</h3>
        <p class="field-hint">Aceita .xlsx, .xls ou .csv. Precisa de uma coluna de <strong>descrição</strong> (ou Item/Serviço/Produto); para comparar preço, inclua a coluna de <strong>valor unitário</strong> (e quantidade, para estimar economia/excesso). Detectadas automaticamente: código (SINAPI), unidade, quantidade e valor. Nada é inventado — só lemos o que está na planilha.</p>
        <form id="iaComparaForm" class="ia-dp-upload-form">
          <input type="file" id="iaComparaFile" accept=".xlsx,.xls,.csv" required ${serverMode ? "" : "disabled"}>
          <button class="primary" type="submit" ${serverMode ? "" : "disabled"}>Enviar planilha</button>
        </form>
      </div>
      <div id="iaComparaArea"></div>
    </section>`;
  if (!serverMode) return;
  qs("iaComparaForm")?.addEventListener("submit", iaComparaUpload);
}

async function iaComparaUpload(event) {
  event.preventDefault();
  const file = qs("iaComparaFile")?.files?.[0];
  const area = qs("iaComparaArea");
  if (!file) { alert("Selecione uma planilha."); return; }
  const btn = qs("iaComparaForm")?.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
  if (area) area.innerHTML = '<p class="muted">Lendo a planilha e detectando as colunas…</p>';
  try {
    const fd = new FormData();
    fd.append("file", file);
    const payload = await fetchForm("?module=ia&action=comparaUpload", fd);
    const d = payload?.data ?? payload;
    if (!d || !d.jobId) throw new Error((payload && payload.message) || "Falha ao ler a planilha.");
    iaComparaState.jobId = d.jobId;
    iaComparaState.total = d.total || 0;
    iaComparaState.colunas = d.colunasDetectadas || [];
    iaComparaState.status = "uploaded";
    iaComparaState.filtro = "todos";
    iaComparaState.counts = null;
    iaComparaState.resumo = null;
    iaComparaRenderReady();
  } catch (error) {
    if (area) area.innerHTML = `<p style="color:#b42318"><strong>❌ ${escapeHtml(error.message || "Não foi possível ler a planilha.")}</strong></p>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Enviar planilha"; }
  }
}

function iaComparaRenderReady() {
  const area = qs("iaComparaArea");
  if (!area) return;
  const cols = iaComparaState.colunas.length
    ? iaComparaState.colunas.map((c) => `<span class="ia-dp-chip-col">${escapeHtml(iaDeparaColLabel(c))}</span>`).join(" ")
    : '<span class="muted">nenhuma além da descrição</span>';
  const temValor = iaComparaState.colunas.includes("valor");
  area.innerHTML = `
    <div class="ia-dp-ready">
      <h3>2. Analisar com IA</h3>
      <p><strong>${iaComparaState.total.toLocaleString("pt-BR")}</strong> itens lidos. Colunas detectadas: ${cols}</p>
      ${temValor ? "" : '<p class="field-hint" style="color:#855107">⚠ Nenhuma coluna de valor foi detectada — os itens serão classificados, mas sem comparação de preço.</p>'}
      <p class="field-hint">A IA gera o embedding de cada descrição e compara por significado com a base SINAPI (~1–2s por item; roda em segundo plano). Itens com código SINAPI válido casam direto pelo código.</p>
      <div id="iaComparaProgress" class="hidden">
        <div class="ia-dp-progress-text muted">Analisando…</div>
        <div class="ia-dp-bar"><div id="iaComparaBar" style="width:0%"></div></div>
      </div>
      <div class="actions"><button class="primary" type="button" id="iaComparaStartBtn">Analisar com IA</button></div>
    </div>
    <div id="iaComparaResult"></div>`;
  qs("iaComparaStartBtn")?.addEventListener("click", iaComparaStart);
}

async function iaComparaStart() {
  if (!iaComparaState.jobId) return;
  const btn = qs("iaComparaStartBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Iniciando…"; }
  try {
    await apiModuleRequest("?module=ia&action=comparaStart", { method: "POST", body: JSON.stringify({ jobId: iaComparaState.jobId }) });
    qs("iaComparaProgress")?.classList.remove("hidden");
    iaComparaPoll();
  } catch (error) {
    alert(`Não foi possível iniciar a análise: ${error.message}`);
    if (btn) { btn.disabled = false; btn.textContent = "Analisar com IA"; }
  }
}

async function iaComparaPoll() {
  if (!iaComparaState.jobId) return;
  try {
    const d = await apiModuleRequest(`?module=ia&action=comparaStatus&job=${encodeURIComponent(iaComparaState.jobId)}`);
    const pct = Math.max(0, Math.min(100, Number(d.percent || 0)));
    const bar = qs("iaComparaBar");
    const txt = document.querySelector("#iaComparaProgress .ia-dp-progress-text");
    if (bar) bar.style.width = `${pct}%`;
    if (txt) {
      const label = { queued: "na fila", running: "analisando…", done: "concluído ✅", error: "erro", none: "—" }[d.status] || d.status;
      txt.textContent = `${Number(d.processados || 0).toLocaleString("pt-BR")} de ${Number(d.total || 0).toLocaleString("pt-BR")} (${pct}%) — ${label}`
        + (d.status === "error" && d.error ? ` · ${d.error}` : "");
    }
    iaComparaState.status = d.status;
    iaComparaState.counts = d.counts || iaComparaState.counts;
    if (d.status === "running" || d.status === "queued") {
      iaComparaTimer = setTimeout(() => { iaComparaTimer = null; if (currentModule === "iaCompara" && qs("iaComparaBar")) iaComparaPoll(); }, 2500);
    } else if (d.status === "done") {
      const startBtn = qs("iaComparaStartBtn");
      if (startBtn) { startBtn.disabled = false; startBtn.textContent = "Reanalisar"; }
      iaComparaLoadResults("todos");
    } else {
      const startBtn = qs("iaComparaStartBtn");
      if (startBtn) { startBtn.disabled = false; startBtn.textContent = "Tentar novamente"; }
    }
  } catch (error) {
    const txt = document.querySelector("#iaComparaProgress .ia-dp-progress-text");
    if (txt) txt.textContent = `Não foi possível obter o status: ${error.message}`;
  }
}

async function iaComparaLoadResults(filtro) {
  iaComparaState.filtro = filtro || "todos";
  const box = qs("iaComparaResult");
  if (!box) return;
  box.innerHTML = '<p class="muted">Carregando relatório…</p>';
  try {
    const data = await apiModuleRequest(`?module=ia&action=comparaItens&job=${encodeURIComponent(iaComparaState.jobId)}&situacao=${encodeURIComponent(iaComparaState.filtro)}`);
    iaComparaState.counts = data.counts || iaComparaState.counts;
    iaComparaState.resumo = data.resumo || iaComparaState.resumo;
    iaComparaRenderResult(data.itens || [], data.counts || {}, data.resumo);
  } catch (error) {
    box.innerHTML = `<p style="color:#b42318">Não foi possível carregar o relatório: ${escapeHtml(error.message)}</p>`;
  }
}

function iaComparaResumoHtml(resumo) {
  if (!resumo) return "";
  return `
    <div class="ia-cmp-resumo">
      <div class="ia-cmp-resumo-item ia-cmp-r-econ">
        <span class="ia-cmp-r-num">${asMoney(resumo.economiaTotal || 0)}</span>
        <span class="ia-cmp-r-lbl">Economia estimada<br><span class="muted">${Number(resumo.planilhaMaisBarata || 0)} itens com planilha mais barata</span></span>
      </div>
      <div class="ia-cmp-resumo-item ia-cmp-r-exc">
        <span class="ia-cmp-r-num">${asMoney(resumo.excessoTotal || 0)}</span>
        <span class="ia-cmp-r-lbl">Excesso estimado<br><span class="muted">${Number(resumo.sinapiMaisBarata || 0)} itens com planilha mais cara</span></span>
      </div>
      <div class="ia-cmp-resumo-item ia-cmp-r-eq">
        <span class="ia-cmp-r-num">${Number(resumo.iguais || 0)}</span>
        <span class="ia-cmp-r-lbl">Preços equivalentes<br><span class="muted">${Number(resumo.comparados || 0)} itens comparados</span></span>
      </div>
    </div>`;
}

function iaComparaRenderResult(itens, counts, resumo) {
  const box = qs("iaComparaResult");
  if (!box) return;
  const c = counts || {};
  const f = iaComparaState.filtro;
  const bucket = (key, label, cls) => `
    <button type="button" class="ia-dp-bucket ${cls} ${f === key ? "active" : ""}" data-cmp-filtro="${key}">
      <span class="ia-dp-bucket-num">${Number(c[key] || 0).toLocaleString("pt-BR")}</span>
      <span class="ia-dp-bucket-lbl">${label}</span>
    </button>`;
  const head = `
    <div class="ia-dp-buckets">
      <button type="button" class="ia-dp-bucket ia-dp-b-todos ${f === "todos" ? "active" : ""}" data-cmp-filtro="todos">
        <span class="ia-dp-bucket-num">${Number(c.total || 0).toLocaleString("pt-BR")}</span><span class="ia-dp-bucket-lbl">TODOS</span>
      </button>
      ${bucket("achou", "ACHOU", "ia-dp-b-achou")}
      ${bucket("faltou_importar", "FALTOU IMPORTAR", "ia-dp-b-revisar")}
      ${bucket("cotacao_propria", "COTAÇÃO PRÓPRIA", "ia-dp-b-cotacao")}
      <button type="button" class="secondary ia-dp-export" id="iaComparaExportBtn">⤓ Exportar relatório</button>
    </div>`;
  const resumoHtml = iaComparaResumoHtml(resumo || iaComparaState.resumo);
  if (!itens.length) {
    box.innerHTML = resumoHtml + head + '<p class="empty">Nenhum item nesta situação.</p>';
  } else {
    box.innerHTML = resumoHtml + head + `
      <div class="ia-dp-table-wrap">
        <table class="ia-dp-table ia-cmp-table">
          <thead><tr>
            <th>#</th><th>Descrição (planilha)</th><th>Cód.</th><th>Un</th><th>Qtd</th>
            <th>Valor planilha</th><th></th><th>Match SINAPI</th><th>Valor SINAPI</th>
            <th>Sim.</th><th>Comparação</th><th>Ação</th>
          </tr></thead>
          <tbody>${itens.map(iaComparaRowHtml).join("")}</tbody>
        </table>
      </div>`;
  }
  box.querySelectorAll("[data-cmp-filtro]").forEach((btn) => btn.addEventListener("click", () => iaComparaLoadResults(btn.dataset.cmpFiltro)));
  qs("iaComparaExportBtn")?.addEventListener("click", iaComparaExport);
  box.querySelectorAll("[data-cmp-aceitar]").forEach((btn) => btn.addEventListener("click", () => iaComparaAceitar(Number(btn.dataset.cmpAceitar), btn)));
}

// Badge de comparação de preço: verde se a planilha é mais barata, vermelho se a
// SINAPI é mais barata (planilha mais cara), neutro se equivalentes.
function iaComparaBadge(it) {
  const p = it.precoMaisBaixo;
  if (!p || p === "sem_comparacao") return '<span class="muted">—</span>';
  if (p === "igual") return '<span class="ia-cmp-badge ia-cmp-igual">≈ equivalentes</span>';
  const dif = Math.abs(Number(it.diferencaValor || 0));
  const pct = Math.abs(Number(it.diferencaPercent || 0));
  if (p === "planilha") {
    return `<span class="ia-cmp-badge ia-cmp-planilha">Planilha −${asMoney(dif)} (−${pct.toFixed(1)}%)</span>`;
  }
  return `<span class="ia-cmp-badge ia-cmp-sinapi">SINAPI mais barata · planilha +${asMoney(dif)} (+${pct.toFixed(1)}%)</span>`;
}

function iaComparaRowHtml(it) {
  const sit = IA_COMPARA_SIT[it.statusClassificacao] || { label: "—", cls: "" };
  const tag = `<span class="ia-dp-sit ${sit.cls}">${sit.label}</span>`;
  const simWarn = (it.statusClassificacao === "achou" && it.similaridade != null && it.similaridade < 80)
    ? ' <span class="ia-cmp-warn" title="similaridade baixa — revise o match">⚠</span>' : "";
  const codOrigem = it.codigoOrigem ? `<span class="ia-dp-cod">${escapeHtml(it.codigoOrigem)}</span>` : '<span class="muted">—</span>';
  const sim = it.similaridade != null ? `${iaSimBadge(it.similaridade)}${simWarn}` : '<span class="muted">—</span>';
  let matchCell = '<span class="muted">—</span>';
  if (it.matchCode || it.matchDescription) {
    const mtag = it.matchOrigem === "insumo"
      ? '<span class="ia-tag ia-tag-ins">INS</span>'
      : (it.matchOrigem === "composicao" ? '<span class="ia-tag ia-tag-comp">COMP</span>' : "");
    matchCell = `<div class="ia-dp-match">${mtag}<strong>${escapeHtml(it.matchCode || "")}</strong>${it.matchUnit ? ` <span class="ia-result-unit">${escapeHtml(it.matchUnit)}</span>` : ""}<div class="ia-dp-match-desc">${escapeHtml(it.matchDescription || "")}</div></div>`;
  }
  const low = it.precoMaisBaixo;
  const valPlanilha = it.valorUnitOrigem != null
    ? `<span class="${low === "planilha" ? "ia-cmp-low" : ""}">${asMoney(it.valorUnitOrigem)}</span>`
    : '<span class="muted">—</span>';
  const valSinapi = it.matchValor != null
    ? `<span class="${low === "sinapi" ? "ia-cmp-low" : ""}">${asMoney(it.matchValor)}</span>`
    : '<span class="muted">—</span>';
  const aceito = Number(it.aceito) === 1;
  const acao = `<button class="${aceito ? "ia-dp-aceito" : "secondary"} ia-dp-mini" type="button" data-cmp-aceitar="${it.id}">${aceito ? "✓ Aceito" : "Aceitar"}</button>`;
  return `
    <tr class="ia-dp-tr ${aceito ? "is-aceito" : ""}">
      <td class="ia-dp-linha">${it.linhaPlanilha ?? ""}</td>
      <td class="ia-dp-desc">${tag}<div>${escapeHtml(it.descricaoOrigem || "")}</div></td>
      <td>${codOrigem}</td>
      <td>${it.unidadeOrigem ? escapeHtml(it.unidadeOrigem) : ""}</td>
      <td class="ia-dp-valor">${it.quantidadeOrigem != null ? escapeHtml(String(it.quantidadeOrigem)) : ""}</td>
      <td class="ia-dp-valor">${valPlanilha}</td>
      <td class="ia-dp-arrow">→</td>
      <td>${matchCell}</td>
      <td class="ia-dp-valor">${valSinapi}</td>
      <td>${sim}</td>
      <td>${iaComparaBadge(it)}</td>
      <td>${acao}</td>
    </tr>`;
}

async function iaComparaAceitar(itemId, btn) {
  const novo = !btn.classList.contains("ia-dp-aceito");
  btn.disabled = true;
  try {
    await apiModuleRequest("?module=ia&action=comparaAceitar", { method: "POST", body: JSON.stringify({ itemId, aceito: novo }) });
    btn.classList.toggle("ia-dp-aceito", novo);
    btn.classList.toggle("secondary", !novo);
    btn.textContent = novo ? "✓ Aceito" : "Aceitar";
    btn.closest("tr")?.classList.toggle("is-aceito", novo);
  } catch (error) {
    alert(`Não foi possível salvar: ${error.message}`);
  } finally {
    btn.disabled = false;
  }
}

async function iaComparaExport() {
  if (!iaComparaState.jobId) return;
  const btn = qs("iaComparaExportBtn");
  if (btn) btn.disabled = true;
  try {
    const resp = await fetch(`${API_BASE}/?module=ia&action=comparaExport&job=${encodeURIComponent(iaComparaState.jobId)}`, { headers: authHeaders() });
    if (!resp.ok) {
      let msg = `Erro ${resp.status}`;
      try { const j = await resp.json(); msg = j.error || j.message || msg; } catch { /* corpo não-JSON */ }
      throw new Error(msg);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ComparadorIA_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(`Não foi possível exportar: ${error.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
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

// ─── Centros de Custo: tipo, orientação de uso, exemplos e histórico ────────
const COST_CENTER_TIPOS = [
  ["administrativo", "Administrativo"],
  ["tecnico", "Técnico"],
  ["operacional", "Operacional"],
  ["financeiro", "Financeiro"],
  ["fiscal_tributario", "Fiscal / Tributário"],
];

function costCenterTipoLabel(tipo) {
  const found = COST_CENTER_TIPOS.find(([value]) => value === tipo);
  return found ? found[1] : "Administrativo";
}

// Lançamentos vinculados a um centro de custo (contas a receber/pagar + caixa),
// normalizados e ordenados do mais recente para o mais antigo.
function costCenterMovements(ccId, start, end) {
  const inRange = (value) => { const d = String(value || "").slice(0, 10); return d && (!start || d >= start) && (!end || d <= end); };
  const moves = [];
  (db.receivable || []).filter((r) => sameId(r.costCenterId, ccId)).forEach((r) => {
    const date = String(r.receivedDate || r.dueDate || "").slice(0, 10);
    if (!inRange(date)) return;
    moves.push({ date, desc: r.document || "Conta a receber", value: Number(r.amount || 0), kind: "entrada", origin: "Conta a receber", module: "receivable", id: r.id });
  });
  (db.payable || []).filter((p) => sameId(p.costCenterId, ccId)).forEach((p) => {
    const date = String(p.paidDate || p.dueDate || "").slice(0, 10);
    if (!inRange(date)) return;
    const linked = p.referencia_tipo === "CAIXA_MANUAL" && p.referencia_id;
    moves.push({ date, desc: p.document || "Conta a pagar", value: Number(p.amount || 0), kind: "saida", origin: linked ? "Conta a pagar + Caixa (vinculados)" : "Conta a pagar", module: "payable", id: p.id, linked: Boolean(linked), referencia_tipo: p.referencia_tipo || "", referencia_id: p.referencia_id || "" });
  });
  (db.cashMoves || []).filter((m) => sameId(m.costCenterId, ccId)).forEach((m) => {
    const date = String(m.date || "").slice(0, 10);
    if (!inRange(date)) return;
    // Deduplicação: caixa manual já vinculado a uma conta a pagar não é recontado
    // (o valor já entra pela própria conta a pagar).
    if (m.referencia_tipo === "CONTA_PAGAR" && m.referencia_id) return;
    const kind = m.type === "Entrada" ? "entrada" : m.type === "Saída" ? "saida" : "neutro";
    moves.push({ date, desc: m.history || m.originDocument || "Movimento de caixa", value: Number(m.amount || 0), kind, origin: "Manual (caixa)", module: "cashMoves", id: m.id, referencia_tipo: m.referencia_tipo || "", referencia_id: m.referencia_id || "" });
  });
  return moves.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function renderCostCenters() {
  const editable = canEditModule("costCenters");
  const removable = canDeleteRecord("costCenters");
  const { start, end } = lucroCaixaPeriodRange("mesAtual");
  const centers = (db.costCenters || []).slice().sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")) || String(a.name || "").localeCompare(String(b.name || "")));
  const rowsHtml = centers.length ? centers.map((cc) => {
    const moves = costCenterMovements(cc.id, start, end);
    const entradas = moves.filter((m) => m.kind === "entrada").reduce((s, m) => s + m.value, 0);
    const saidas = moves.filter((m) => m.kind === "saida").reduce((s, m) => s + m.value, 0);
    const saldo = entradas - saidas;
    const tipo = cc.tipo || "administrativo";
    const ativo = (cc.status || "Ativo") === "Ativo";
    return `<tr>
      <td>
        <strong>${cc.code ? svgText(cc.code) + " · " : ""}</strong>${svgText(cc.name || "")}
        ${cc.descricao_uso ? `<span class="cc-info" tabindex="0" title="${escapeHtml(cc.descricao_uso)}">ℹ</span>` : ""}
      </td>
      <td><span class="cc-badge cc-badge-${tipo}">${costCenterTipoLabel(tipo)}</span></td>
      <td class="cc-saldo ${saldo < 0 ? "cc-neg" : saldo > 0 ? "cc-pos" : ""}">${asMoney(saldo)}</td>
      <td><span class="status ${ativo ? "success" : ""}">${ativo ? "Ativo" : "Inativo"}</span></td>
      <td><div class="row-actions">
        ${editable ? `<button class="secondary" type="button" data-cc-edit="${cc.id}">Editar</button>` : ""}
        ${removable ? `<button class="danger" type="button" data-cc-delete="${cc.id}">Excluir</button>` : ""}
        ${!editable && !removable ? '<span class="muted">Somente leitura</span>' : ""}
      </div></td>
    </tr>`;
  }).join("") : `<tr><td colspan="5"><div class="empty">Nenhum centro de custo cadastrado.</div></td></tr>`;
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <h2>Centros de Custo</h2>
        <p>Estrutura gerencial com tipo, orientação de uso, exemplos e histórico de lançamentos. Saldo calculado no mês atual.</p>
      </div>
      ${editable ? '<button class="primary" type="button" id="newCostCenter">Novo</button>' : ""}
    </section>
    <section class="table-wrap" data-export-title="Centros de Custo">
      <table>
        <thead><tr><th>Código / Nome</th><th>Tipo</th><th>Saldo do mês</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </section>
  `;
  qs("newCostCenter")?.addEventListener("click", () => openCostCenterForm(null));
  qs("content").querySelectorAll("[data-cc-edit]").forEach((btn) => btn.addEventListener("click", () => openCostCenterForm(btn.dataset.ccEdit)));
  qs("content").querySelectorAll("[data-cc-delete]").forEach((btn) => btn.addEventListener("click", () => removeRecord("costCenters", btn.dataset.ccDelete)));
}

function costCenterHistoryPaneHtml(ccId, periodKey) {
  const { start, end } = lucroCaixaPeriodRange(periodKey);
  const all = costCenterMovements(ccId, start, end);
  const entradas = all.filter((m) => m.kind === "entrada").reduce((s, m) => s + m.value, 0);
  const saidas = all.filter((m) => m.kind === "saida").reduce((s, m) => s + m.value, 0);
  const moves = all.slice(0, 20);
  // Detecção de possível duplicidade: mesmo dia + mesmo valor presentes tanto em
  // caixa manual quanto em conta a pagar (e ainda não vinculados entre si).
  const dupKeyOf = (m) => `${m.date}|${(Math.round(m.value * 100) / 100).toFixed(2)}`;
  const cashKeys = new Set(all.filter((m) => m.module === "cashMoves").map(dupKeyOf));
  const payKeys = new Set(all.filter((m) => m.module === "payable").map(dupKeyOf));
  // Só marca como duplicidade quando o reforço (fornecedor/descrição) confirma o
  // par — desambigua pagamentos iguais no mesmo dia para fornecedores diferentes.
  const dupKeys = new Set([...cashKeys].filter((k) => {
    if (!payKeys.has(k)) return false;
    const pair = findCostCenterDupPair(ccId, k);
    return Boolean(pair.cash && pair.payable);
  }));
  const canLink = canEditModule("cashMoves") && canEditModule("payable");
  const periodOptions = LUCRO_CAIXA_PERIODS.map(([v, l]) => `<option value="${v}" ${v === periodKey ? "selected" : ""}>${l}</option>`).join("");
  const rows = moves.length ? moves.map((m) => {
    const isDup = (m.module === "cashMoves" || m.module === "payable") && dupKeys.has(dupKeyOf(m));
    return `
    <tr class="${isDup ? "cc-dup" : ""}">
      <td>${m.date ? asDate(m.date) : "—"}${isDup ? ` <span class="cc-dup-warn" tabindex="0" title="Possível duplicidade — verifique se este lançamento já está registrado em Contas a Pagar">⚠️</span>` : ""}</td>
      <td>${svgText(m.desc)}</td>
      <td class="${m.kind === "entrada" ? "cc-pos" : m.kind === "saida" ? "cc-neg" : ""}">${m.kind === "entrada" ? "+" : m.kind === "saida" ? "−" : ""}${asMoney(m.value)}</td>
      <td>${m.kind === "entrada" ? "Entrada" : m.kind === "saida" ? "Saída" : "—"}</td>
      <td>${svgText(m.origin)}</td>
      <td><div class="row-actions">
        <button type="button" class="secondary cc-link" data-cc-open="${m.module}:${escapeHtml(m.id)}">Abrir</button>
        ${isDup && canLink ? `<button type="button" class="secondary cc-dup-link" data-dupkey="${escapeHtml(dupKeyOf(m))}">Marcar como vinculado</button>` : ""}
      </div></td>
    </tr>`;
  }).join("") : `<tr><td colspan="6"><div class="empty">Sem lançamentos no período.</div></td></tr>`;
  return `
    <div class="cc-hist-head">
      <label>Período<select id="ccHistPeriod">${periodOptions}</select></label>
      <div class="cc-hist-totais">
        <span class="cc-pos">Entradas: ${asMoney(entradas)}</span>
        <span class="cc-neg">Saídas: ${asMoney(saidas)}</span>
        <span class="${entradas - saidas < 0 ? "cc-neg" : "cc-pos"}"><strong>Saldo: ${asMoney(entradas - saidas)}</strong></span>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Tipo</th><th>Origem</th><th>Original</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted cc-hist-nota">Exibindo os ${moves.length} lançamento(s) mais recentes do período. Os totais consideram todos os lançamentos vinculados no período.</p>`;
}

function openCostCenterForm(id) {
  if (!canEditModule("costCenters")) return;
  const cc = id ? byId("costCenters", id) : {};
  const tipoOptions = COST_CENTER_TIPOS.map(([v, l]) => `<option value="${v}" ${(cc.tipo || "administrativo") === v ? "selected" : ""}>${l}</option>`).join("");
  const statusOptions = ["Ativo", "Inativo"].map((s) => `<option ${(cc.status || "Ativo") === s ? "selected" : ""}>${s}</option>`).join("");
  const dialog = document.createElement("dialog");
  dialog.className = "cc-dialog";
  dialog.innerHTML = `
    <div class="cc-modal">
      <header class="cc-head">
        <h3>${id ? "Editar" : "Novo"} centro de custo</h3>
        <button type="button" class="cc-x" data-close aria-label="Fechar">✕</button>
      </header>
      <nav class="cc-tabs">
        <button type="button" class="active" data-tab="geral">Dados Gerais</button>
        <button type="button" data-tab="uso">O que entra aqui</button>
        <button type="button" data-tab="exemplos">Exemplos de Lançamentos</button>
        <button type="button" data-tab="historico">Histórico de Lançamentos</button>
      </nav>
      <div class="cc-panes">
        <section class="cc-pane active" data-pane="geral">
          <div class="form-grid">
            <label>Código (ex: ADM-01)<input name="code" value="${escapeHtml(cc.code || "")}" placeholder="ADM-01"></label>
            <label>Nome do centro de custo<input name="name" value="${escapeHtml(cc.name || "")}" placeholder="Administrativo Geral"></label>
            <label>Tipo<select name="tipo">${tipoOptions}</select></label>
            <label>Responsável<input name="manager" value="${escapeHtml(cc.manager || "")}"></label>
            <label>Status<select name="status">${statusOptions}</select></label>
          </div>
        </section>
        <section class="cc-pane" data-pane="uso">
          <p class="muted">Descreva o que deve ser lançado neste centro de custo.</p>
          <textarea name="descricao_uso" rows="7" placeholder="Ex.: Lançar aqui todas as despesas administrativas...">${escapeHtml(cc.descricao_uso || "")}</textarea>
        </section>
        <section class="cc-pane" data-pane="exemplos">
          <p class="muted">Liste exemplos de lançamentos típicos.</p>
          <textarea name="exemplos" rows="9" placeholder="- Aluguel do escritório&#10;- Conta de energia elétrica">${escapeHtml(cc.exemplos || "")}</textarea>
        </section>
        <section class="cc-pane" data-pane="historico" id="ccHistoricoPane">
          ${id ? costCenterHistoryPaneHtml(id, "mesAtual") : '<div class="empty">Salve o centro de custo para ver o histórico de lançamentos vinculados.</div>'}
        </section>
      </div>
      <footer class="cc-foot">
        <button type="button" class="secondary" data-close>Cancelar</button>
        <button type="button" class="primary" data-save>Salvar</button>
      </footer>
    </div>`;
  document.body.appendChild(dialog);
  const q = (sel) => dialog.querySelector(sel);
  const close = () => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); };

  dialog.querySelectorAll("[data-tab]").forEach((btn) => btn.addEventListener("click", () => {
    dialog.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b === btn));
    dialog.querySelectorAll("[data-pane]").forEach((p) => p.classList.toggle("active", p.dataset.pane === btn.dataset.tab));
  }));

  // Renderiza e re-liga os eventos do histórico (período, abrir original e o
  // botão "Marcar como vinculado" das possíveis duplicidades).
  const renderHistory = (periodKey) => {
    const pane = q("#ccHistoricoPane");
    if (!pane) return;
    pane.innerHTML = costCenterHistoryPaneHtml(id, periodKey);
    pane.querySelector("#ccHistPeriod")?.addEventListener("change", (event) => renderHistory(event.target.value));
    pane.querySelectorAll("[data-cc-open]").forEach((btn) => btn.addEventListener("click", () => {
      const [module, recId] = String(btn.dataset.ccOpen).split(":");
      close();
      if (canAccessModule(module)) { currentModule = module; render(); if (canEditModule(module)) openForm(module, recId); }
    }));
    pane.querySelectorAll("[data-dupkey]").forEach((btn) => btn.addEventListener("click", async () => {
      const pair = findCostCenterDupPair(id, btn.dataset.dupkey);
      if (!pair.cash || !pair.payable) { alert("Não foi possível identificar o par de lançamentos a vincular."); return; }
      if (!confirm("Confirmar que o lançamento de caixa e a conta a pagar são o MESMO pagamento? A conta será baixada e o valor deixará de contar em dobro no centro de custo.")) return;
      btn.disabled = true;
      try {
        await linkCashPayable(pair.cash.id, pair.payable.id);
        renderHistory(pane.querySelector("#ccHistPeriod")?.value || periodKey);
      } catch (error) {
        alert(`Não foi possível vincular: ${error.message}`);
        btn.disabled = false;
      }
    }));
  };
  if (id) renderHistory("mesAtual");

  dialog.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", close));
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  q("[data-save]").addEventListener("click", () => saveCostCenter(dialog, id, close));
  dialog.showModal();
}

async function saveCostCenter(dialog, id, close) {
  const q = (sel) => dialog.querySelector(sel);
  const data = {
    code: q('[name="code"]').value.trim(),
    name: q('[name="name"]').value.trim(),
    tipo: q('[name="tipo"]').value,
    manager: q('[name="manager"]').value.trim(),
    status: q('[name="status"]').value,
    descricao_uso: q('[name="descricao_uso"]').value.trim(),
    exemplos: q('[name="exemplos"]').value.trim(),
  };
  if (!data.name) { alert("Informe o nome do centro de custo."); return; }
  try {
    if (id) await updateIntegratedRecord("costCenters", id, data);
    else await createIntegratedRecord("costCenters", data);
  } catch (error) {
    alert(`Não foi possível salvar: ${error.message}`);
    return;
  }
  logAudit(id ? "edit" : "create", "costCenters", data.name);
  close();
  render();
}

// ─── Prevenção de dupla contagem: vínculo caixa ↔ conta a pagar ─────────────
const cashDupIgnored = new Set(); // duplicidades dispensadas pelo usuário nesta sessão

// Tokens significativos (≥3 letras/números, sem acento) para casar descrições.
function dupTokenize(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]{3,}/g) || [];
}

// Reforço da heurística: dado um caixa e uma conta a pagar já com mesmo valor,
// data e centro de custo, verifica se também batem por FORNECEDOR e DESCRIÇÃO.
// O caixa não tem supplierId, então o fornecedor da conta é procurado (LIKE) no
// texto do caixa (histórico/documento). Mesma ideia para o documento da conta.
function cashPayableMatch(cash, payable) {
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const cashText = `${cash.history || ""} ${cash.originDocument || ""}`;
  const cashNorm = norm(cashText);
  const cashTokens = new Set(dupTokenize(cashText));
  const supplierName = nameOf("suppliers", payable.supplierId) || "";
  const supplierMatch = dupTokenize(supplierName).some((t) => cashTokens.has(t));
  // Documento: token ≥3 OU substring direta (LIKE) — cobre números curtos (NF-2).
  const docNorm = norm(payable.document).trim();
  const descMatch = dupTokenize(payable.document).some((t) => cashTokens.has(t))
    || (docNorm.length >= 3 && cashNorm.includes(docNorm));
  return { supplierName, supplierMatch, descMatch, hasText: cashTokens.size > 0, corroborated: supplierMatch || descMatch };
}

// Escolhe a conta a pagar correspondente a um caixa entre candidatas de mesmo
// valor/data/centro. Com um único candidato, mantém a heurística base. Havendo
// ambiguidade (vários candidatos — ex.: pagamentos iguais no mesmo dia para
// fornecedores diferentes), só casa quando há corroboração de fornecedor/descrição.
function matchCashToPayable(cash, candidatePayables) {
  if (!candidatePayables.length) return null;
  if (candidatePayables.length === 1) return candidatePayables[0];
  const corroborated = candidatePayables.map((p) => ({ p, info: cashPayableMatch(cash, p) })).filter((x) => x.info.corroborated);
  return corroborated.length === 1 ? corroborated[0].p : null;
}

// Localiza o par (movimento de caixa + conta a pagar) por trás de uma chave
// "data|valor" para o botão "Marcar como vinculado", já com o reforço acima.
function findCostCenterDupPair(ccId, dupKey) {
  const [date, valStr] = String(dupKey).split("|");
  const val = Number(valStr);
  const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;
  const cashCandidates = (db.cashMoves || []).filter((m) => sameId(m.costCenterId, ccId)
    && String(m.date || "").slice(0, 10) === date && round2(m.amount) === val
    && !(m.referencia_tipo === "CONTA_PAGAR" && m.referencia_id));
  const payCandidates = (db.payable || []).filter((p) => sameId(p.costCenterId, ccId)
    && String(p.paidDate || p.dueDate || "").slice(0, 10) === date && round2(p.amount) === val
    && p.status !== "Cancelado" && !(p.referencia_tipo === "CAIXA_MANUAL" && p.referencia_id));
  for (const cash of cashCandidates) {
    const payable = matchCashToPayable(cash, payCandidates);
    if (payable) return { cash, payable };
  }
  return { cash: cashCandidates[0] || null, payable: null };
}

// Vincula um caixa e uma conta a pagar já existentes (servidor faz em transação;
// modo local atualiza o db diretamente). Não re-renderiza — quem chama decide.
async function linkCashPayable(cashId, payableId) {
  if (serverMode) {
    await apiModuleRequest("?module=cashMoves&action=link", { method: "POST", body: JSON.stringify({ cashMoveId: cashId, payableId }) });
    await refreshData();
    return;
  }
  const cash = byId("cashMoves", cashId);
  const p = byId("payable", payableId);
  if (cash) { cash.referencia_tipo = "CONTA_PAGAR"; cash.referencia_id = payableId; }
  if (p && p.status !== "Cancelado") {
    p.status = "Pago";
    if (!p.paidDate) p.paidDate = (cash?.date) || new Date().toISOString().slice(0, 10);
    p.referencia_tipo = "CAIXA_MANUAL";
    p.referencia_id = cashId;
  }
  saveDb();
}

// Cria um movimento de caixa vinculado a uma conta a pagar (baixa a conta).
async function submitLinkedCashMove(data, payableId) {
  try {
    if (serverMode) {
      await apiModuleRequest("?module=cashMoves&action=create", { method: "POST", body: JSON.stringify({ ...data, type: "Saída", payableId }) });
    } else {
      const cashId = crypto.randomUUID();
      db.cashMoves.push({ id: cashId, ...data, type: "Saída", status: "Confirmado", referencia_tipo: "CONTA_PAGAR", referencia_id: payableId });
      const p = byId("payable", payableId);
      if (p && p.status !== "Cancelado") {
        p.status = "Pago";
        if (!p.paidDate) p.paidDate = data.date || new Date().toISOString().slice(0, 10);
        p.referencia_tipo = "CAIXA_MANUAL";
        p.referencia_id = cashId;
      }
      saveDb();
    }
    return true;
  } catch (error) {
    alert(`Não foi possível registrar o caixa vinculado: ${error.message}`);
    return false;
  }
}

// Campo opcional "Vincular a conta a pagar" no formulário de novo caixa.
function setupCashPayableLink() {
  const formFields = qs("formFields");
  if (!formFields || formFields.querySelector("#cashLinkPayable")) return;
  const open = (db.payable || []).filter((p) => p.status !== "Pago" && p.status !== "Cancelado")
    .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  const options = ['<option value="">— Não vincular —</option>'].concat(open.map((p) =>
    `<option value="${escapeHtml(p.id)}">${escapeHtml(`${p.document || "Conta"} · ${asMoney(p.amount)} · vence ${asDate(String(p.dueDate || "").slice(0, 10)) || "—"}`)}</option>`)).join("");
  const wrap = document.createElement("label");
  wrap.className = "full cash-link-field";
  wrap.innerHTML = `Vincular a conta a pagar (opcional)<select id="cashLinkPayable">${options}</select><span class="field-hint">Ao vincular, a conta a pagar é baixada automaticamente e o valor deixa de contar em dobro no centro de custo.</span>`;
  formFields.appendChild(wrap);
  wrap.querySelector("#cashLinkPayable").addEventListener("change", (event) => {
    const p = byId("payable", event.target.value);
    if (!p) return;
    const amountInput = formFields.querySelector('[name="amount"]');
    const typeSel = formFields.querySelector('[name="type"]');
    const ccSel = formFields.querySelector('[name="costCenterId"]');
    if (amountInput && !amountInput.value) amountInput.value = formatMoneyInput(p.amount);
    if (typeSel) typeSel.value = "Saída";
    if (ccSel && p.costCenterId && !ccSel.value) ccSel.value = p.costCenterId;
  });
}

// PARTE 4 — pares de caixa (saída) e conta a pagar com mesmo valor, centro de
// custo e data, ainda não vinculados entre si.
function findPossibleDuplicates() {
  const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;
  const openPayables = (db.payable || []).filter((p) => p.status !== "Cancelado" && p.costCenterId && !(p.referencia_tipo === "CAIXA_MANUAL" && p.referencia_id));
  const used = new Set(); // uma conta a pagar não pode casar com vários caixas
  const pairs = [];
  (db.cashMoves || []).forEach((m) => {
    if (m.type !== "Saída" || !m.costCenterId) return;
    if (m.referencia_tipo === "CONTA_PAGAR" && m.referencia_id) return;
    const date = String(m.date || "").slice(0, 10);
    const val = round2(m.amount);
    const candidates = openPayables.filter((p) => !used.has(p.id) && sameId(p.costCenterId, m.costCenterId) && round2(p.amount) === val
      && (String(p.paidDate || "").slice(0, 10) === date || String(p.dueDate || "").slice(0, 10) === date));
    const match = matchCashToPayable(m, candidates);
    if (!match) return; // ambíguo sem corroboração de fornecedor/descrição → ignora
    used.add(match.id);
    const info = cashPayableMatch(m, match);
    pairs.push({ cashId: m.id, payableId: match.id, date, value: val, costCenterId: m.costCenterId, cashDesc: m.history || m.originDocument || "Caixa", payDesc: match.document || "Conta a pagar", supplier: info.supplierName });
  });
  return pairs;
}

function duplicatesReportPanel() {
  const pairs = findPossibleDuplicates().filter((pr) => !cashDupIgnored.has(`${pr.cashId}:${pr.payableId}`));
  const rows = pairs.length ? pairs.map((pr) => `
    <tr>
      <td>${pr.date ? asDate(pr.date) : "—"}</td>
      <td>${svgText(nameOf("costCenters", pr.costCenterId) || "—")}</td>
      <td class="cc-neg">${asMoney(pr.value)}</td>
      <td>${svgText(pr.cashDesc)}</td>
      <td>${svgText(pr.payDesc)}${pr.supplier ? ` <span class="muted">· ${svgText(pr.supplier)}</span>` : ""}</td>
      <td><div class="row-actions">
        <button type="button" class="primary" data-dup-link="${escapeHtml(pr.cashId)}:${escapeHtml(pr.payableId)}">Vincular</button>
        <button type="button" class="secondary" data-dup-ignore="${escapeHtml(pr.cashId)}:${escapeHtml(pr.payableId)}">Ignorar</button>
      </div></td>
    </tr>`).join("") : `<tr><td colspan="6"><div class="empty">Nenhuma duplicidade provável encontrada. 🎉</div></td></tr>`;
  return `
    <section class="panel dup-report">
      <h3>⚠️ Lançamentos possivelmente duplicados</h3>
      <p class="muted">Movimentos de caixa (saída) e contas a pagar com o mesmo valor, centro de custo e data. Vincule para não contar o valor duas vezes, ou ignore se forem pagamentos distintos.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Centro de custo</th><th>Valor</th><th>Caixa</th><th>Conta a pagar</th><th>Ação</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function wireDuplicatesReport() {
  qs("content").querySelectorAll("[data-dup-link]").forEach((btn) => btn.addEventListener("click", async () => {
    const [cashId, payableId] = String(btn.dataset.dupLink).split(":");
    if (!confirm("Vincular este lançamento de caixa à conta a pagar? A conta será baixada e o valor deixará de contar em dobro.")) return;
    btn.disabled = true;
    try { await linkCashPayable(cashId, payableId); render(); }
    catch (error) { alert(`Não foi possível vincular: ${error.message}`); btn.disabled = false; }
  }));
  qs("content").querySelectorAll("[data-dup-ignore]").forEach((btn) => btn.addEventListener("click", () => {
    cashDupIgnored.add(btn.dataset.dupIgnore);
    render();
  }));
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
  if (key === "suppliers") tableFields.push("pbqph_nivel");
  const docTitle = { purchaseOrders: "Pedido de Compra" }[key];
  qs("content").innerHTML = `
    ${docTitle ? generateDocumentHeader(docTitle, documentPeriodSubtitle()) : ""}
    <section class="module-head">
      <div>
        <h2>${config.title}</h2>
        <p>${config.description}</p>
      </div>
      ${editable ? '<button class="primary" type="button" id="newRecord">Novo</button>' : ""}
    </section>
    ${key === "fiscalDocuments" ? fiscalStatusLegend() : ""}
    ${key === "payable" ? payableGroupsPanelHtml(rows) : ""}
    ${table(config.title, rows, tableFields, editable, key)}
    ${docTitle ? generateDocumentFooter() : ""}
  `;
  if (key === "payable") setupPayableGroupActions();
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
  qs("content").querySelectorAll("[data-generate-contract]").forEach((button) => button.addEventListener("click", () => generateContractFromProposal(button.dataset.generateContract)));
  qs("content").querySelectorAll("[data-contract-pdf]").forEach((button) => button.addEventListener("click", () => printContract(button.dataset.contractPdf)));
  qs("content").querySelectorAll("[data-contract-anexos]").forEach((button) => button.addEventListener("click", () => openContractAnexos(button.dataset.contractAnexos)));
  qs("content").querySelectorAll("[data-print-po]").forEach((button) => button.addEventListener("click", () => openPurchaseOrderPrint(button.dataset.printPo)));
  qs("content").querySelectorAll("[data-po-fvm]").forEach((button) => button.addEventListener("click", () => abrirFvmDoPedido(button.dataset.poFvm)));
  qs("content").querySelectorAll("[data-po-cotacao]").forEach((button) => button.addEventListener("click", () => {
    const po = byId("purchaseOrders", button.dataset.poCotacao);
    currentModule = "cotacoes";
    cotacaoOpenId = null;
    render();
    setTimeout(() => openCotacaoImport({ obra_id: po?.projectId || "", purchase_order_id: po?.id || "" }), 60);
  }));
  qs("content").querySelectorAll("[data-supplier-qual]").forEach((button) => button.addEventListener("click", () => openSupplierQualificationForm(button.dataset.supplierQual)));
  qs("content").querySelectorAll("[data-generate-proposal]").forEach((button) => button.addEventListener("click", () => openProposalGenerator(button.dataset.generateProposal)));
  qs("content").querySelectorAll("[data-add-budget-item]").forEach((button) => button.addEventListener("click", () => {
    const [sourceKey, id] = button.dataset.addBudgetItem.split(":");
    addBudgetItemFromSource(sourceKey, id);
  }));
  if (key === "fiscalDocuments") setupNfseImport();
  if (key === "fiscalDocuments") setupFiscalSemObraFilter();
}

// Campos cujo formatCell devolve HTML intencional (links e badges); todo o resto é escapado.
const HTML_CELL_FIELDS = new Set(["generatedLink", "hasPdf", "hasXml", "status", "pbqph_nivel"]);

function tableCell(field, row, moduleKey = "") {
  const content = formatCell(field, row[field], row, moduleKey);
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
          return `<tr>${fields.map((field) => `<td>${tableCell(field, row, actionKey)}</td>`).join("")}${actions ? `<td><div class="row-actions">${extra}${editBtn}${delBtn}${noAction}</div></td>` : ""}</tr>`;
        }).join("")}
      </tbody>
    </table>
  </section>`;
}

// ── Contrato a partir da proposta ─────────────────────────────────────────
// Objeto/escopo consolidado a partir das disciplinas/grupos vinculados à proposta.
function buildContractObjeto(proposal, links, project) {
  const base = `Prestação de serviços técnicos de engenharia${project && project.name ? ` para ${project.name}` : ""}.`;
  if (!links || !links.length) return proposal.description || base;
  const byDisc = {};
  links.forEach((l) => { const d = l.disciplina || "Geral"; (byDisc[d] = byDisc[d] || []).push(l.nome_grupo || ""); });
  const linhas = Object.entries(byDisc).map(([d, gs]) => `${d}: ${gs.filter(Boolean).join(", ")}`);
  return `${base}\n\nEscopo por disciplina:\n${linhas.join("\n")}`;
}

async function generateContractFromProposal(proposalId) {
  const proposal = byId("proposals", proposalId);
  if (!proposal) return alert("Proposta não encontrada.");
  if (proposal.status !== "Aprovada" && !confirm("Esta proposta não está APROVADA. Gerar o contrato mesmo assim?")) return;
  const client = byId("clients", proposal.clientId) || {};
  const project = byId("projects", proposal.projectId) || {};
  const links = (db.proposalBudgetLinks || []).filter((l) => sameId(l.proposalId, proposalId));
  const objeto = buildContractObjeto(proposal, links, project);
  const existing = (db.sales || []).find((s) => sameId(s.proposalId, proposalId));
  if (existing && !confirm("Já existe um contrato gerado desta proposta. Deseja ATUALIZAR os dados dele em vez de duplicar?")) return;
  const today = new Date().toISOString().slice(0, 10);
  const numero = existing?.numero_contrato || `CT-${today.replaceAll("-", "")}-${String(Date.now()).slice(-4)}`;
  const data = {
    number: existing?.number || `VEN-${today.replaceAll("-", "")}-${String(Date.now()).slice(-4)}`,
    date: today,
    clientId: proposal.clientId || "",
    projectId: proposal.projectId || "",
    proposalId: proposal.id,
    description: objeto,
    amount: Number(proposal.amount || 0),
    cost: Number(proposal.custo_total_orcamentos || 0),
    status: existing?.status || "Aberto",
    numero_contrato: numero,
    data_contrato: today,
    valor_contrato: Number(proposal.amount || 0),
    objeto,
    status_contrato: "gerado",
    cliente_nome: client.name || "",
    cpf_cnpj: client.document || "",
    email: client.email || "",
    telefone: client.phone || "",
    endereco: clientFullAddress(client) || client.address || "",
    cidade: client.cidade || "",
    estado: client.estado || "",
    cep: client.zipCode || "",
  };
  try {
    if (existing) await updateIntegratedRecord("sales", existing.id, data);
    else await createIntegratedRecord("sales", data);
    alert(`Contrato ${numero} ${existing ? "atualizado" : "gerado"} a partir da proposta. Em Vendas/Contratos use "Contrato (PDF)".`);
    currentModule = "sales";
    await refreshAndRender();
  } catch (e) {
    alert(`Não foi possível gerar o contrato: ${e.message}`);
  }
}

// PDF do contrato pelo template de 13 cláusulas (impressão pelo navegador).
function contractPdfHtml(contract) {
  const c = (db.companySettings || [])[0] || {};
  const proposal = byId("proposals", contract.proposalId) || {};
  const valor = Number(contract.valor_contrato || contract.amount || proposal.amount || 0);
  const v = (val, ph) => (val && String(val).trim()) ? svgText(val) : `<span class="contract-ph">[${ph}]</span>`;
  const clausula = (n, titulo, corpo) => `<section class="contract-clause"><h3>CLÁUSULA ${n} — ${svgText(titulo)}</h3><div>${corpo}</div></section>`;
  const valorExtenso = typeof moneyToWords === "function" ? moneyToWords(valor) : asMoney(valor);
  return `
    <article class="contract-page">
      ${generateDocumentHeader("Contrato de Prestação de Serviços Técnicos", contract.numero_contrato || "")}
      <p class="contract-parties"><strong>CONTRATANTE:</strong> ${v(contract.cliente_nome, "nome do cliente")}, CPF/CNPJ ${v(contract.cpf_cnpj, "CPF/CNPJ")}, ${v(contract.endereco, "endereço")}${contract.cidade ? " — " + svgText(contract.cidade) : ""}${contract.estado ? "/" + svgText(contract.estado) : ""}.</p>
      <p class="contract-parties"><strong>CONTRATADA:</strong> ${svgText(c.name || "[empresa]")}, CNPJ ${v(c.document, "CNPJ")}, ${svgText([c.address, c.city || c.cidade, c.estado].filter(Boolean).join(", ") || "[endereço da empresa]")}.</p>
      ${clausula("1ª", "Do Objeto", `<p>${v(contract.objeto, "objeto/escopo do contrato")}</p>`)}
      ${clausula("2ª", "Dos Documentos Integrantes", `<p>Integram este contrato a proposta comercial ${proposal.number ? "nº " + svgText(proposal.number) : `<span class="contract-ph">[nº da proposta]</span>`} e seus anexos técnicos.</p>`)}
      ${clausula("3ª", "Das Obrigações da Contratada", `<p>Executar os serviços conforme as normas técnicas vigentes, com pessoal qualificado, fornecendo a respectiva Anotação/Registro de Responsabilidade Técnica (ART/RRT).</p>`)}
      ${clausula("4ª", "Das Obrigações da Contratante", `<p>Disponibilizar acesso, informações e condições necessárias à execução e efetuar os pagamentos nos prazos pactuados.</p>`)}
      ${clausula("5ª", "Do Valor e da Forma de Pagamento", `<p>O valor total dos serviços é de <strong>${svgText(valorExtenso)}</strong>, pago por medição conforme <span class="contract-ph">[forma/cronograma de pagamento por medição]</span>.</p>`)}
      ${clausula("6ª", "Do Prazo de Execução", `<p>${v(proposal.executionDeadline || proposal.deadline, "prazo de execução")}.</p>`)}
      ${clausula("7ª", "Da Responsabilidade Técnica", `<p>Responsável técnico: ${v(proposal.technicalResponsible, "responsável técnico")} — ART/RRT nº <span class="contract-ph">[ART/RRT]</span>.</p>`)}
      ${clausula("8ª", "Da Segurança e Saúde no Trabalho", `<p>A execução observará as Normas Regulamentadoras aplicáveis à natureza dos serviços (ex.: NR-18, NR-35, NR-10, quando pertinentes).</p>`)}
      ${clausula("9ª", "Das Alterações de Escopo", `<p>Alterações de escopo serão formalizadas por termo aditivo, com revisão de prazo e/ou preço.</p>`)}
      ${clausula("10ª", "Da Garantia", `<p>Os serviços possuem garantia nos termos da legislação aplicável.</p>`)}
      ${clausula("11ª", "Da Rescisão", `<p>O contrato poderá ser rescindido por inadimplemento de qualquer cláusula, mediante notificação prévia.</p>`)}
      ${clausula("12ª", "Do Foro", `<p>Fica eleito o foro da comarca de ${svgText(c.city || c.cidade || "")}${(c.city || c.cidade) ? "" : `<span class="contract-ph">[comarca]</span>`} para dirimir questões oriundas deste contrato.</p>`)}
      ${clausula("13ª", "Das Disposições Gerais", `<p>Os casos omissos serão resolvidos de comum acordo entre as partes, por escrito.</p>`)}
      <div class="contract-signatures">
        <div><span class="contract-sign-line"></span><br>${v(contract.cliente_nome, "Contratante")}</div>
        <div><span class="contract-sign-line"></span><br>${svgText(c.name || "Contratada")}</div>
      </div>
      ${generateDocumentFooter()}
    </article>`;
}

function printContract(contractId) {
  const contract = byId("sales", contractId);
  if (!contract) return alert("Contrato não encontrado.");
  printStandaloneDocument(contractPdfHtml(contract));
  // Marca como "gerado" se ainda estava em rascunho (não bloqueia a impressão).
  if (contract.status_contrato !== "gerado" && contract.status_contrato !== "assinado") {
    updateIntegratedRecord("sales", contractId, { status_contrato: "gerado" }).catch(() => {});
  }
}

// Download autenticado de um anexo do contrato (arquivos ficam fora do docroot).
async function downloadContractAnexo(contractId, tipo) {
  try {
    const resp = await fetch(`${API_BASE}/contrato-download?id=${encodeURIComponent(contractId)}&tipo=${encodeURIComponent(tipo)}`, { headers: authHeaders() });
    if (!resp.ok) throw new Error(`Erro ${resp.status}`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tipo}_${contractId}.pdf`; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(`Não foi possível baixar o anexo: ${e.message}`);
  }
}

// Dialog de anexos do contrato: proposta assinada / contrato gerado / contrato assinado.
function openContractAnexos(contractId) {
  const contract = byId("sales", contractId);
  if (!contract) return alert("Contrato não encontrado.");
  const anexos = [
    ["proposta_assinada", "Proposta assinada (PDF)", contract.proposta_assinada_path],
    ["contrato_gerado", "Contrato gerado (PDF)", contract.contrato_gerado_path],
    ["contrato_assinado", "Contrato assinado (PDF)", contract.contrato_assinado_path],
  ];
  const dialog = document.createElement("dialog");
  dialog.className = "agenda-detail-dialog contract-anexos-dialog";
  document.body.appendChild(dialog);
  const close = () => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); };
  dialog.innerHTML = `
    <div class="modal-box">
      <h3>Anexos do contrato ${escapeHtml(contract.numero_contrato || contract.number || "")}</h3>
      <p class="muted">Status: ${escapeHtml(contract.status_contrato || "rascunho")}</p>
      <div class="contract-anexos-list">
        ${anexos.map(([tipo, label, path]) => `
          <div class="contract-anexo-row">
            <strong>${escapeHtml(label)}</strong>
            <div class="contract-anexo-state">${path ? `<button type="button" class="link-button" data-download="${tipo}">Baixar</button>` : `<span class="muted">não anexado</span>`}</div>
            <input type="file" accept="application/pdf" data-file="${tipo}">
            <button type="button" class="secondary" data-upload="${tipo}">Enviar</button>
          </div>`).join("")}
      </div>
      <div class="agenda-detail-actions"><button type="button" class="secondary" data-close>Fechar</button></div>
    </div>`;
  dialog.querySelector("[data-close]")?.addEventListener("click", close);
  dialog.querySelectorAll("[data-download]").forEach((b) => b.addEventListener("click", () => downloadContractAnexo(contractId, b.dataset.download)));
  dialog.querySelectorAll("[data-upload]").forEach((b) => b.addEventListener("click", async () => {
    const tipo = b.dataset.upload;
    const input = dialog.querySelector(`input[data-file="${tipo}"]`);
    const file = input?.files?.[0];
    if (!file) return alert("Selecione um PDF.");
    const fd = new FormData();
    fd.append("contratoId", contractId);
    fd.append("tipo", tipo);
    fd.append("file", file);
    b.disabled = true;
    try {
      await fetchForm("contrato-upload", fd);
      await refreshData();
      close();
      openContractAnexos(contractId);
    } catch (e) {
      b.disabled = false;
      alert(`Falha no upload: ${e.message}`);
    }
  }));
  dialog.showModal();
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
    return `${row.status === "Aprovada" ? `<button class="secondary" type="button" data-convert-proposal="${row.id}">Converter</button>${hasReceivable ? "" : `<button class="secondary" type="button" data-create-proposal-receivables="${row.id}">Gerar contas</button>`}<button class="secondary" type="button" data-generate-contract="${row.id}">Gerar contrato</button>` : ""}${row.proposalBody ? `<button class="secondary" type="button" data-preview-proposal="${row.id}">Prévia/PDF</button>` : ""}`;
  }
  if (actionKey === "sales" && row.status !== "Cancelado") {
    const exists = (db.receivable || []).some((item) => (row.proposalId && sameId(item.proposalId, row.proposalId)) || (row.number && item.document === row.number));
    const conta = exists ? "" : `<button class="secondary" type="button" data-create-receivable="${row.id}">Gerar conta</button>`;
    return `${conta}<button class="secondary" type="button" data-contract-pdf="${row.id}">Contrato (PDF)</button><button class="secondary" type="button" data-contract-anexos="${row.id}">Anexos</button>`;
  }
  if (actionKey === "purchaseOrders") {
    return `<button class="secondary" type="button" data-print-po="${row.id}">Imprimir / Gerar PDF</button><button class="secondary" type="button" data-po-fvm="${row.id}">Registrar recebimento (FVM)</button><button class="secondary" type="button" data-po-cotacao="${row.id}">Importar cotação</button>`;
  }
  if (actionKey === "suppliers") {
    return `<button class="secondary" type="button" data-supplier-qual="${row.id}">Qualificação PBQP-H</button>`;
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

// Notas Fiscais: cada status ganha cor própria via classe nf-status-<slug>.
// Slug remove acentos e normaliza (Conferida → conferida, Cancelada → cancelada).
function nfStatusSlug(status) {
  return String(status || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nfStatusBadge(status) {
  const slug = nfStatusSlug(status);
  return `<span class="nf-status${slug ? ` nf-status-${slug}` : ""}">${escapeHtml(status || "—")}</span>`;
}

// Legenda de cores exibida no topo da tela de Notas Fiscais.
function fiscalStatusLegend() {
  const statuses = (configs.fiscalDocuments.fields.find((f) => f[0] === "status")?.[3]) || ["Pendente", "Anexada", "Conferida", "Cancelada"];
  return `<div class="nf-status-legend">
    <span class="nf-status-legend__label">Legenda:</span>
    ${statuses.map((s) => nfStatusBadge(s)).join("")}
  </div>`;
}

function formatCell(field, value, row = {}, moduleKey = "") {
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
  if (field === "pbqph_nivel") return supplierQualBadge(value);
  if (field === "status" && moduleKey === "fiscalDocuments") return nfStatusBadge(value);
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
  // Preenchimento automático global: qualquer formulário com select de cliente.
  const clientSelect = qs("formFields").querySelector('select[name="clientId"], select[name="cliente_id"]');
  if (clientSelect) setupClientAutofill(qs("formFields"), clientSelect);
  if (["clients", "suppliers", "companySettings"].includes(editing?.key)) setupAddressCep();
  if (editing?.key === "projects") setupObraEnderecoToggle();
  if (editing?.key === "companySettings") setupCompanyLogoUpload();
  if (editing?.key === "payable" && !editing.id) setupPayableRecurrence();
  if (editing?.key === "payable" && editing.id) setupPayableCashLink();
  if (editing?.key === "cashMoves" && !editing.id) setupCashPayableLink();
  if (editing?.key === "purchaseOrders") setupPurchaseOrderForm();
}

// Seção "Vincular ao lançamento de caixa" no formulário de uma conta a pagar JÁ
// PAGA: lista movimentos de caixa com mesmo valor e mesma data para o usuário
// escolher qual vincular (grava a referência cruzada e deduplica no histórico).
function setupPayableCashLink() {
  const formFields = qs("formFields");
  if (!formFields || formFields.querySelector("#payableCashLink")) return;
  const payable = byId("payable", editing.id);
  if (!payable) return;
  const alreadyLinked = payable.referencia_tipo === "CAIXA_MANUAL" && payable.referencia_id;
  if (payable.status !== "Pago" || alreadyLinked) return;
  const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;
  const val = round2(payable.amount);
  const dates = [String(payable.paidDate || "").slice(0, 10), String(payable.dueDate || "").slice(0, 10)].filter(Boolean);
  const candidates = (db.cashMoves || []).filter((m) => m.type === "Saída" && round2(m.amount) === val
    && dates.includes(String(m.date || "").slice(0, 10)) && !(m.referencia_tipo === "CONTA_PAGAR" && m.referencia_id));
  const list = candidates.length ? candidates.map((m) => `
    <div class="pcl-row">
      <span>${asDate(String(m.date || "").slice(0, 10)) || "—"} · ${asMoney(m.amount)} · ${svgText(m.history || m.originDocument || "Caixa")}${m.costCenterId ? ` · ${svgText(nameOf("costCenters", m.costCenterId) || "")}` : ""}</span>
      <button type="button" class="secondary" data-pcl-link="${escapeHtml(m.id)}">Vincular</button>
    </div>`).join("") : '<p class="muted">Nenhum movimento de caixa com mesmo valor e data encontrado.</p>';
  const section = document.createElement("div");
  section.id = "payableCashLink";
  section.className = "full payable-cash-link";
  section.innerHTML = `
    <h4 class="pcl-title">🔗 Vincular ao lançamento de caixa</h4>
    <p class="field-hint">Esta conta está paga. Se o pagamento também foi lançado manualmente no caixa, vincule-o para não contar o valor duas vezes no centro de custo.</p>
    <div class="pcl-list">${list}</div>`;
  formFields.appendChild(section);
  section.querySelectorAll("[data-pcl-link]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("Vincular este lançamento de caixa a esta conta a pagar? O valor deixará de contar em dobro no centro de custo.")) return;
    btn.disabled = true;
    try {
      await linkCashPayable(btn.dataset.pclLink, editing.id);
      try { qs("recordDialog").close(); } catch { /* já fechado */ }
      render();
    } catch (error) {
      alert(`Não foi possível vincular: ${error.message}`);
      btn.disabled = false;
    }
  }));
}

// Preenchimento automático dos dados do cliente ao montar uma obra/projeto.
// A tabela `clients` só possui name, document (CPF/CNPJ), email, phone, zipCode
// e address — então os únicos campos da obra com correspondência DIRETA de
// coluna são "address" e "zipCode" (preenchidos e destacados como automáticos).
// Os demais dados do cliente (nome, CPF/CNPJ, e-mail, telefone) são exibidos num
// painel de referência, já que a tabela `projects` não tem colunas para eles.
// Mapa de campos de formulário que têm coluna correspondente no cadastro de
// clientes. A tabela `clients` real só tem name, document, email, phone,
// zipCode e address — então os únicos campos diretamente preenchíveis são
// "address" e "zipCode". Nome/CPF/e-mail/telefone aparecem no painel de
// referência (não há coluna equivalente na maioria dos formulários).
const CLIENT_AUTOFILL_MAP = { address: "address", zipCode: "zipCode", cep: "zipCode", endereco: "address" };
const CLIENT_AUTOFILL_TOOLTIP = "Preenchido automaticamente do cadastro do cliente. Clique para editar.";
const CLIENT_AUTOFILL_EMPTY_PLACEHOLDER = "Não cadastrado — clique para adicionar no cadastro do cliente";

// Função global reutilizável: resolve os dados de um cliente e chama o callback.
// Instantâneo a partir do db já carregado; cai para o endpoint só se faltar.
function carregarDadosCliente(clienteId, callback) {
  if (!clienteId) return;
  const local = byId("clients", clienteId);
  if (local) { callback(local); return; }
  if (serverMode) {
    apiModuleRequest(`?module=clients&action=get&id=${encodeURIComponent(clienteId)}`)
      .then((data) => { if (data && data.id) callback(data); })
      .catch(() => {});
  }
}

// Preenchimento automático GLOBAL: liga qualquer select de cliente
// (name="clientId" ou "cliente_id") aos campos do formulário + painel de
// referência + botão "Ver cadastro completo". Reutilizável em qualquer tela.
function setupClientAutofill(container, clientSelect) {
  if (!container || !clientSelect || clientSelect.dataset.autofillReady === "1") return;
  clientSelect.dataset.autofillReady = "1";
  const inputByName = (name) => container.querySelector(`[name="${name}"]`);
  const labelHost = clientSelect.closest("label") || clientSelect;

  // Indicador 🔄 ao lado do dropdown.
  if (!labelHost.querySelector(".client-sync-indicator")) {
    clientSelect.insertAdjacentHTML("afterend",
      '<span class="client-sync-indicator" title="Os dados abaixo serão preenchidos automaticamente do cadastro deste cliente">🔄 Dados preenchidos automaticamente do cliente</span>');
  }

  // Painel de referência (escopado ao container, sem id global).
  let panel = container.querySelector(".client-autofill-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "client-autofill-panel full hidden";
    labelHost.insertAdjacentElement("afterend", panel);
  }

  // Edição manual remove o destaque automático e protege o campo da limpeza.
  Object.keys(CLIENT_AUTOFILL_MAP).forEach((field) => {
    const input = inputByName(field);
    input?.addEventListener("input", () => {
      if (input.dataset.autofilled === "1" && input.value !== (input.dataset.autofilledValue || "")) {
        input.classList.remove("autofilled");
        input.dataset.autofilled = "0";
        input.removeAttribute("title");
      }
    });
  });

  const fillFromClient = (client) => {
    Object.entries(CLIENT_AUTOFILL_MAP).forEach(([field, clientField]) => {
      const input = inputByName(field);
      if (!input) return;
      if (client) {
        let value = client[clientField] || "";
        if ((field === "zipCode" || field === "cep") && value) value = maskCep(value);
        input.value = value;
        input.dataset.autofilled = "1";
        input.dataset.autofilledValue = value;
        input.classList.add("autofilled");
        input.title = CLIENT_AUTOFILL_TOOLTIP;
        if (!value) input.placeholder = CLIENT_AUTOFILL_EMPTY_PLACEHOLDER;
      } else if (input.dataset.autofilled === "1") {
        // Só limpa o que foi preenchido automaticamente e não foi editado à mão.
        input.value = "";
        input.dataset.autofilled = "0";
        input.classList.remove("autofilled");
        input.removeAttribute("title");
      }
    });
    renderClientAutofillPanel(panel, client);
  };

  const applyClient = (clientId) => {
    if (!clientId) { fillFromClient(null); return; }
    carregarDadosCliente(clientId, fillFromClient);
  };

  clientSelect.addEventListener("change", () => applyClient(clientSelect.value));
  // Já há cliente ao abrir: mostra o painel de referência SEM sobrescrever os
  // valores já gravados no registro em edição.
  if (clientSelect.value) carregarDadosCliente(clientSelect.value, (client) => renderClientAutofillPanel(panel, client));
}

const SUPPLIER_AUTOFILL_MAP = { address: "address", zipCode: "zipCode", cep: "zipCode", endereco: "address" };
const SUPPLIER_AUTOFILL_TOOLTIP = "Preenchido automaticamente do cadastro do fornecedor. Clique para editar.";

function carregarDadosFornecedor(fornecedorId, callback) {
  if (!fornecedorId) return;
  const local = byId("suppliers", fornecedorId);
  if (local) { callback(local); return; }
  if (serverMode) {
    apiModuleRequest(`?module=suppliers&action=get&id=${encodeURIComponent(fornecedorId)}`)
      .then((data) => { if (data && data.id) callback(data); })
      .catch(() => {});
  }
}

function renderSupplierAutofillPanel(panel, supplier) {
  if (!panel) return;
  if (!supplier) { panel.classList.add("hidden"); panel.innerHTML = ""; return; }
  const linha = (label, value) => `<div class="client-autofill-row"><span>${label}</span>${value && String(value).trim() ? `<strong>${svgText(value)}</strong>` : '<span class="muted">—</span>'}</div>`;
  panel.innerHTML = `
    <div class="client-autofill-head"><span>🔄 Dados do fornecedor carregados automaticamente</span></div>
    <div class="client-autofill-grid">
      ${linha("Nome", supplier.name)}
      ${linha("CPF/CNPJ", supplier.document ? maskDocument(supplier.document) : "")}
      ${linha("E-mail", supplier.email)}
      ${linha("Telefone", supplier.phone ? maskPhone(supplier.phone) : "")}
      ${linha("Endereço", clientFullAddress(supplier))}
      ${linha("Cidade/UF", [supplier.cidade, supplier.estado].filter(Boolean).join(" / "))}
      ${linha("CEP", supplier.zipCode ? maskCep(supplier.zipCode) : "")}
    </div>`;
  panel.classList.remove("hidden");
}

// Preenchimento automático global do FORNECEDOR — espelha setupClientAutofill.
function setupSupplierAutofill(container, supplierSelect) {
  if (!container || !supplierSelect || supplierSelect.dataset.autofillReady === "1") return;
  supplierSelect.dataset.autofillReady = "1";
  const inputByName = (name) => container.querySelector(`[name="${name}"]`);
  const labelHost = supplierSelect.closest("label") || supplierSelect;
  if (!labelHost.querySelector(".client-sync-indicator")) {
    supplierSelect.insertAdjacentHTML("afterend",
      '<span class="client-sync-indicator" title="Os dados abaixo serão preenchidos automaticamente do cadastro deste fornecedor">🔄 Dados preenchidos automaticamente do fornecedor</span>');
  }
  let panel = container.querySelector(".supplier-autofill-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "client-autofill-panel supplier-autofill-panel full hidden";
    labelHost.insertAdjacentElement("afterend", panel);
  }
  Object.keys(SUPPLIER_AUTOFILL_MAP).forEach((field) => {
    const input = inputByName(field);
    input?.addEventListener("input", () => {
      if (input.dataset.autofilled === "1" && input.value !== (input.dataset.autofilledValue || "")) {
        input.classList.remove("autofilled"); input.dataset.autofilled = "0"; input.removeAttribute("title");
      }
    });
  });
  const fillFrom = (supplier) => {
    Object.entries(SUPPLIER_AUTOFILL_MAP).forEach(([field, supField]) => {
      const input = inputByName(field);
      if (!input) return;
      if (supplier) {
        let value = supplier[supField] || "";
        if ((field === "zipCode" || field === "cep") && value) value = maskCep(value);
        input.value = value; input.dataset.autofilled = "1"; input.dataset.autofilledValue = value;
        input.classList.add("autofilled"); input.title = SUPPLIER_AUTOFILL_TOOLTIP;
      } else if (input.dataset.autofilled === "1") {
        input.value = ""; input.dataset.autofilled = "0"; input.classList.remove("autofilled"); input.removeAttribute("title");
      }
    });
    renderSupplierAutofillPanel(panel, supplier);
  };
  supplierSelect.addEventListener("change", () => {
    if (!supplierSelect.value) { fillFrom(null); return; }
    carregarDadosFornecedor(supplierSelect.value, fillFrom);
  });
  if (supplierSelect.value) carregarDadosFornecedor(supplierSelect.value, (s) => renderSupplierAutofillPanel(panel, s));
}

// ── CEP autofill universal ────────────────────────────────────────────────
// Liga QUALQUER campo de CEP (classe .cep-input, [data-cep] ou name zipCode/cep/
// obra_cep) à busca ViaCEP, com BrasilAPI como fallback. Preenche logradouro/
// bairro/cidade/UF do container mais próximo por convenção de name. Idempotente,
// não-destrutivo (não sobrescreve o que o usuário digitou) e auto-anexável.
const CEP_INPUT_SELECTOR = '.cep-input, [data-cep], input[name="zipCode"], input[name="cep"], input[name="obra_cep"]';

async function cepFetch(cep) {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (r.ok) { const d = await r.json(); if (d && !d.erro) return { logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, uf: d.uf }; }
  } catch { /* tenta o fallback */ }
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
    if (r.ok) { const d = await r.json(); if (d && d.cep) return { logradouro: d.street, bairro: d.neighborhood, cidade: d.city, uf: d.state }; }
  } catch { /* sem rede: o usuário preenche à mão, sem erro */ }
  return null;
}

function cepTargets(scope) {
  const q = (sel) => scope.querySelector && scope.querySelector(sel);
  return {
    address: q('[name="address"], [name="endereco"], [name="logradouro"], [name="obra_endereco"]'),
    bairro: q('[name="bairro"], [name="obra_bairro"]'),
    cidade: q('[name="cidade"], [name="city"], [name="localidade"], [name="obra_cidade"]'),
    estado: q('[name="estado"], [name="uf"], [name="obra_estado"]'),
  };
}

function bindCepInput(input) {
  if (!input || input.dataset.cepReady === "1") return;
  input.dataset.cepReady = "1";
  let lastCep = "";
  const run = async () => {
    const cep = onlyDigits(input.value);
    if (cep.length !== 8 || cep === lastCep) return;
    lastCep = cep;
    const scope = input.closest("form") || input.closest("dialog") || input.closest(".modal-box") || document;
    input.classList.add("cep-loading");
    const data = await cepFetch(cep);
    input.classList.remove("cep-loading");
    if (!data) { if (typeof showToast === "function") showToast("CEP não encontrado"); return; }
    const t = cepTargets(scope);
    // Não-destrutivo: só preenche campo vazio ou que já tinha sido preenchido por CEP.
    const setIf = (el, val) => {
      if (!el || !val) return;
      if (el.value && el.dataset.autofilled !== "1") return;
      el.value = val;
      el.dataset.autofilled = "1";
      el.dataset.autofilledValue = val;
      el.classList.add("autofilled");
      el.title = "Preenchido pela busca de CEP. Clique para editar.";
    };
    setIf(t.address, data.logradouro);
    setIf(t.bairro, data.bairro);
    setIf(t.cidade, data.cidade);
    setIf(t.estado, data.uf);
    (scope.querySelector && scope.querySelector('[name="numero"]'))?.focus();
  };
  input.addEventListener("blur", run);
  input.addEventListener("input", () => { if (onlyDigits(input.value).length === 8) run(); });
}

function bindCepInputs(root) {
  root = root || document;
  if (root.matches && root.matches(CEP_INPUT_SELECTOR)) bindCepInput(root);
  if (root.querySelectorAll) root.querySelectorAll(CEP_INPUT_SELECTOR).forEach(bindCepInput);
}

// Compatibilidade: telas que chamavam setupAddressCep continuam funcionando.
function setupAddressCep() {
  const formFields = qs("formFields");
  formFields?.querySelectorAll('[name="zipCode"], [name="cep"], .cep-input').forEach(bindCepInput);
}

// Toggle "A obra fica no mesmo endereço da empresa?": SIM (default) oculta o bloco de
// endereço próprio e usa company_settings; NÃO mostra o bloco (com .cep-input ativo).
// Não-destrutivo: ocultar não apaga o endereço já gravado.
function setupObraEnderecoToggle() {
  const ff = qs("formFields");
  if (!ff) return;
  const row = editing && editing.id ? (byId("projects", editing.id) || {}) : {};
  const addrNames = ["zipCode", "address", "bairro", "cidade", "estado"];
  const labels = addrNames.map((n) => ff.querySelector(`[name="${n}"]`)?.closest("label")).filter(Boolean);
  if (!labels.length) return;
  // Estado inicial: usa o valor salvo; se indefinido, infere — obra com endereço próprio
  // começa "NÃO" (mostra o bloco), obra nova/sem endereço começa "SIM".
  let usaEmpresa = row.usa_endereco_empresa;
  if (usaEmpresa === undefined || usaEmpresa === null || usaEmpresa === "") usaEmpresa = row.address ? 0 : 1;
  usaEmpresa = Number(usaEmpresa) ? 1 : 0;
  const wrap = document.createElement("div");
  wrap.className = "obra-endereco-toggle full";
  wrap.innerHTML = `
    <label class="obra-endereco-check"><input type="checkbox" id="obraUsaEmpresa" ${usaEmpresa ? "checked" : ""}> A obra fica no mesmo endereço da empresa?</label>
    <input type="hidden" name="usa_endereco_empresa" value="${usaEmpresa}">
    <p class="muted obra-endereco-hint"></p>`;
  labels[0].parentNode.insertBefore(wrap, labels[0]);
  const hidden = wrap.querySelector('input[name="usa_endereco_empresa"]');
  const hint = wrap.querySelector(".obra-endereco-hint");
  const apply = (usa) => {
    labels.forEach((l) => l.classList.toggle("hidden", !!usa));
    hidden.value = usa ? 1 : 0;
    const comp = (db.companySettings || [])[0] || {};
    hint.textContent = usa
      ? `Usará o endereço da empresa: ${[comp.address, comp.cidade, comp.estado].filter(Boolean).join(", ") || "(configure em Configurações da empresa)"}`
      : "Informe o endereço próprio da obra abaixo — o CEP preenche o restante.";
  };
  apply(usaEmpresa);
  wrap.querySelector("#obraUsaEmpresa").addEventListener("change", (e) => apply(e.target.checked ? 1 : 0));
}

// Auto-anexa o autofill de cadastro (cliente/fornecedor) a qualquer select desses
// registros presente no DOM, em qualquer formulário/modal.
function bindAutofillSelects(root) {
  root = root || document;
  if (!root.querySelectorAll) return;
  root.querySelectorAll('select[name="clientId"], select[name="cliente_id"]').forEach((sel) => {
    const c = sel.closest("form") || sel.closest("dialog") || sel.closest(".modal-box");
    if (c) setupClientAutofill(c, sel);
  });
  root.querySelectorAll('select[name="supplierId"], select[name="fornecedor_id"], select[name="fornecedorId"]').forEach((sel) => {
    const c = sel.closest("form") || sel.closest("dialog") || sel.closest(".modal-box");
    if (c) setupSupplierAutofill(c, sel);
  });
}

// Varre o DOM (inicial + via MutationObserver) ligando CEP e autofill em todo form.
let formEnhancerStarted = false;
function initFormEnhancers() {
  if (formEnhancerStarted || typeof document === "undefined" || !document.body) return;
  formEnhancerStarted = true;
  const scan = (node) => { bindCepInputs(node); bindAutofillSelects(node); };
  scan(document);
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); });
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
}

// Endereço efetivo da obra para PDFs/relatórios: usa o endereço próprio quando
// usa_endereco_empresa=0, senão o da empresa (company_settings).
function obraEnderecoEfetivo(project) {
  if (!project) return "";
  const comp = (db.companySettings || [])[0] || {};
  const usaEmpresa = (project.usa_endereco_empresa === undefined || project.usa_endereco_empresa === null || project.usa_endereco_empresa === "")
    ? !project.address
    : Number(project.usa_endereco_empresa) === 1;
  const src = usaEmpresa ? comp : project;
  const linha1 = [src.address, src.numero].filter((v) => v && String(v).trim()).join(", ");
  return [linha1, src.bairro, [src.cidade, src.estado].filter(Boolean).join("/"), src.zipCode ? "CEP " + maskCep(src.zipCode) : ""].filter((v) => v && String(v).trim()).join(" - ");
}

// Endereço completo legível do cliente (logradouro, número, complemento, bairro).
function clientFullAddress(client) {
  if (!client) return "";
  const line1 = [client.address, client.numero].filter((v) => v && String(v).trim()).join(", ");
  return [line1, client.complemento, client.bairro].filter((v) => v && String(v).trim()).join(" - ");
}

function renderClientAutofillPanel(panel, client) {
  if (!panel) return;
  if (!client) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }
  const linha = (label, value) => {
    const has = value !== null && value !== undefined && String(value).trim() !== "";
    const cell = has
      ? `<strong>${svgText(value)}</strong>`
      : `<button type="button" class="link-button client-missing" data-open-client="${escapeHtml(client.id)}" title="${escapeHtml(CLIENT_AUTOFILL_EMPTY_PLACEHOLDER)}">Não cadastrado — adicionar</button>`;
    return `<div class="client-autofill-row"><span>${label}</span>${cell}</div>`;
  };
  panel.innerHTML = `
    <div class="client-autofill-head">
      <span>🔄 Dados do cliente carregados automaticamente</span>
      <button type="button" class="link-button" data-open-client="${escapeHtml(client.id)}">Ver cadastro completo do cliente</button>
    </div>
    <div class="client-autofill-grid">
      ${linha("Nome", client.name)}
      ${linha("CPF/CNPJ", client.document ? maskDocument(client.document) : "")}
      ${linha("E-mail", client.email)}
      ${linha("Telefone/WhatsApp", client.phone ? maskPhone(client.phone) : "")}
      ${linha("Endereço", clientFullAddress(client))}
      ${linha("Cidade/UF", [client.cidade, client.estado].filter(Boolean).join(" / "))}
      ${linha("CEP", client.zipCode ? maskCep(client.zipCode) : "")}
    </div>
  `;
  panel.classList.remove("hidden");
  panel.querySelectorAll("[data-open-client]").forEach((btn) => btn.addEventListener("click", () => openClientFullView(client.id)));
}

// Modal empilhado (sem perder o formulário da obra) com o cadastro completo do
// cliente. "Editar no módulo Clientes" leva ao cadastro para completar dados
// faltantes, confirmando antes de descartar a obra em edição.
function openClientFullView(clientId) {
  const client = byId("clients", clientId);
  if (!client) { alert("Cliente não encontrado."); return; }
  const linha = (label, value) => `<div class="agenda-detail-row"><dt>${escapeHtml(label)}</dt><dd>${svgText(value || "—")}</dd></div>`;
  const dialog = document.createElement("dialog");
  dialog.className = "agenda-detail-dialog";
  dialog.innerHTML = `
    <div class="modal-box agenda-detail-box">
      <h3>Cadastro do cliente</h3>
      <dl class="agenda-detail-list">
        ${linha("Nome", client.name)}
        ${linha("CPF/CNPJ", client.document ? maskDocument(client.document) : "")}
        ${linha("E-mail", client.email)}
        ${linha("Telefone/WhatsApp", client.phone ? maskPhone(client.phone) : "")}
        ${linha("CEP", client.zipCode ? maskCep(client.zipCode) : "")}
        ${linha("Endereço", clientFullAddress(client))}
        ${linha("Cidade", client.cidade)}
        ${linha("Estado", client.estado)}
        ${linha("Status", client.status)}
      </dl>
      <div class="agenda-detail-actions">
        ${canEditModule("clients") ? '<button type="button" class="primary" data-edit-client>Editar no módulo Clientes</button>' : ""}
        <button type="button" class="secondary" data-close-client>Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); };
  dialog.querySelector("[data-close-client]")?.addEventListener("click", close);
  dialog.querySelector("[data-edit-client]")?.addEventListener("click", () => {
    if (!confirm("Abrir o cadastro do cliente vai fechar o formulário atual. Dados não salvos aqui serão perdidos. Continuar?")) return;
    close();
    try { qs("recordDialog").close(); } catch { /* já fechado */ }
    currentModule = "clients";
    render();
    openForm("clients", clientId);
  });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  dialog.showModal();
}

// ─── Contas a pagar recorrentes + quitação antecipada ───────────────────────
const RECORRENCIA_TIPOS = [
  ["mensal", "Mensal"], ["bimestral", "Bimestral"], ["trimestral", "Trimestral"],
  ["semestral", "Semestral"], ["anual", "Anual"],
];
const RECORRENCIA_MESES = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
const RECORRENCIA_INDETERMINADO_PARCELAS = 24; // horizonte rolante para "indeterminado"

// Wrapper para os endpoints de módulo (?module=...&action=...) que respondem
// no padrão { success, data, message }. Devolve apenas o data em caso de sucesso.
async function apiModuleRequest(path, options = {}) {
  const payload = await apiRequest(path, options);
  if (payload && payload.success === false) throw new Error(payload.message || "Operação não concluída.");
  return payload?.data ?? payload;
}

function recCapitalize(text) {
  const s = String(text || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

// Soma meses preservando o dia, clampando ao último dia do mês de destino.
function addMonthsClamped(iso, months) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(iso).slice(0, 10);
  const target = new Date(y, (m - 1) + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = String(Math.min(d, lastDay)).padStart(2, "0");
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  return `${target.getFullYear()}-${mm}-${day}`;
}

// Injeta no formulário de nova conta a pagar a opção de recorrência/parcelamento.
function setupPayableRecurrence() {
  const formFields = qs("formFields");
  if (!formFields || formFields.querySelector("#payableRecurrenceBox")) return;
  const tipoOptions = RECORRENCIA_TIPOS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  const box = document.createElement("div");
  box.id = "payableRecurrenceBox";
  box.className = "full payable-recurrence-box";
  box.innerHTML = `
    <label class="payable-recurrence-toggle">
      <input type="checkbox" id="payableRecurrenceToggle"> Conta recorrente / parcelada
    </label>
    <div id="payableRecurrenceFields" class="payable-recurrence-fields hidden">
      <label>Tipo de recorrência<select id="recTipo">${tipoOptions}</select></label>
      <label>Número de parcelas<input type="number" id="recParcelas" min="1" value="12"></label>
      <label class="rec-inline"><input type="checkbox" id="recIndeterminado"> Indeterminado</label>
      <label>Data da 1ª parcela<input type="date" id="recPrimeiraData"></label>
      <label>Valor da 1ª parcela (R$)<input type="text" inputmode="decimal" id="recValorPrimeira" placeholder="0,00"></label>
      <label>Valor das demais (R$)<input type="text" inputmode="decimal" id="recValorDemais" placeholder="igual à 1ª"></label>
      <p id="recPreview" class="payable-recurrence-preview full"></p>
    </div>`;
  formFields.appendChild(box);

  const toggle = box.querySelector("#payableRecurrenceToggle");
  const fields = box.querySelector("#payableRecurrenceFields");
  const amountInput = formFields.querySelector('[name="amount"]');
  const dueInput = formFields.querySelector('[name="dueDate"]');
  const updatePreview = () => {
    const preview = box.querySelector("#recPreview");
    const cfg = readRecurrenceConfig();
    if (!cfg) { preview.textContent = ""; return; }
    const parcels = buildRecurrenceParcels(cfg);
    if (!parcels.length) { preview.textContent = ""; return; }
    const last = parcels[parcels.length - 1];
    preview.textContent = `Serão geradas ${cfg.indeterminado ? `${parcels.length} parcelas (indeterminado)` : `${parcels.length} parcelas`} ${cfg.tipo}, de ${asDate(parcels[0].dueDate)} até ${asDate(last.dueDate)}.`;
  };

  toggle.addEventListener("change", () => {
    fields.classList.toggle("hidden", !toggle.checked);
    if (toggle.checked) {
      if (!box.querySelector("#recPrimeiraData").value) box.querySelector("#recPrimeiraData").value = (dueInput?.value || new Date().toISOString().slice(0, 10));
      if (!box.querySelector("#recValorPrimeira").value && amountInput?.value) box.querySelector("#recValorPrimeira").value = amountInput.value;
      updatePreview();
    }
  });
  box.querySelector("#recIndeterminado").addEventListener("change", (e) => {
    box.querySelector("#recParcelas").disabled = e.target.checked;
    updatePreview();
  });
  ["#recTipo", "#recParcelas", "#recPrimeiraData", "#recValorPrimeira", "#recValorDemais"].forEach((sel) =>
    box.querySelector(sel).addEventListener("input", updatePreview));
}

function readRecurrenceConfig() {
  const box = qs("payableRecurrenceBox");
  if (!box) return null;
  const indeterminado = box.querySelector("#recIndeterminado").checked;
  const parcelas = indeterminado ? 0 : Math.max(1, Number(box.querySelector("#recParcelas").value || 0));
  const primeiraData = box.querySelector("#recPrimeiraData").value;
  if (!primeiraData || (!indeterminado && parcelas < 1)) return null;
  const valorPrimeira = parseMoneyInput(box.querySelector("#recValorPrimeira").value);
  const demaisRaw = box.querySelector("#recValorDemais").value.trim();
  const valorDemais = demaisRaw ? parseMoneyInput(demaisRaw) : valorPrimeira;
  return { tipo: box.querySelector("#recTipo").value, indeterminado, parcelas, primeiraData, valorPrimeira, valorDemais };
}

function buildRecurrenceParcels(cfg) {
  const total = cfg.indeterminado ? RECORRENCIA_INDETERMINADO_PARCELAS : Math.min(360, cfg.parcelas);
  const months = RECORRENCIA_MESES[cfg.tipo] || 1;
  return Array.from({ length: total }, (_, idx) => {
    const i = idx + 1;
    return {
      parcela_numero: i,
      parcela_total: cfg.indeterminado ? null : total,
      dueDate: addMonthsClamped(cfg.primeiraData, months * (i - 1)),
      amount: i === 1 ? cfg.valorPrimeira : cfg.valorDemais,
    };
  });
}

// Cria a recorrência (servidor gera as parcelas em transação; modo local gera no db).
async function submitPayableRecurrence(data) {
  const cfg = readRecurrenceConfig();
  if (!cfg) { alert("Preencha os dados da recorrência: tipo, parcelas, data da 1ª parcela e valor."); return false; }
  const descricao = String(data.document || "").trim();
  if (!descricao) { alert("Informe o documento/descrição da conta."); return false; }
  if (!(cfg.valorPrimeira > 0) && !(cfg.valorDemais > 0)) { alert("Informe o valor das parcelas."); return false; }
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (serverMode) {
      await apiModuleRequest("?module=payable&action=create_recurrence", {
        method: "POST",
        body: JSON.stringify({
          descricao,
          recorrencia_tipo: cfg.tipo,
          parcelas: cfg.indeterminado ? 0 : cfg.parcelas,
          primeira_data: cfg.primeiraData,
          valor_primeira: cfg.valorPrimeira,
          valor_demais: cfg.valorDemais,
          issueDate: data.issueDate || today,
          supplierId: data.supplierId || "",
          projectId: data.projectId || "",
          categoryId: data.categoryId || "",
          costCenterId: data.costCenterId || "",
          bankAccount: data.bankAccount || "",
        }),
      });
    } else {
      const rid = crypto.randomUUID();
      buildRecurrenceParcels(cfg).forEach((p) => {
        db.payable.push({
          id: crypto.randomUUID(),
          document: cfg.indeterminado ? `${descricao} - Parcela ${p.parcela_numero}` : `${descricao} - Parcela ${p.parcela_numero}/${p.parcela_total}`,
          issueDate: data.issueDate || today,
          dueDate: p.dueDate,
          paidDate: "",
          supplierId: data.supplierId || "",
          projectId: data.projectId || "",
          categoryId: data.categoryId || "",
          costCenterId: data.costCenterId || "",
          bankAccount: data.bankAccount || "",
          amount: p.amount,
          status: "Aberto",
          recorrencia_id: rid,
          parcela_numero: p.parcela_numero,
          parcela_total: p.parcela_total,
          recorrencia_tipo: cfg.tipo,
        });
      });
      saveDb();
    }
    return true;
  } catch (error) {
    alert(`Não foi possível gerar as parcelas: ${error.message}`);
    return false;
  }
}

// Edição de parcela recorrente: pergunta o escopo. Retorna true se já tratou
// (propagou para várias parcelas e fechou); false para seguir o update normal.
async function maybeApplyRecurrenceScopeEdit(data) {
  const rec = byId("payable", editing.id);
  if (!rec || !rec.recorrencia_id) return false; // não recorrente
  const scope = await chooseRecurrenceScope();
  if (scope === null) return true;   // cancelou
  if (scope === "one") return false; // segue update normal de uma parcela
  const fields = {
    amount: data.amount,
    supplierId: data.supplierId || "",
    categoryId: data.categoryId || "",
    costCenterId: data.costCenterId || "",
    projectId: data.projectId || "",
    bankAccount: data.bankAccount || "",
  };
  try {
    if (serverMode) {
      await apiModuleRequest("?module=payable&action=update_scope", {
        method: "POST",
        body: JSON.stringify({ recorrencia_id: rec.recorrencia_id, scope, parcela_numero: rec.parcela_numero, parcela_id: rec.id, fields }),
      });
      qs("recordDialog").close();
      await refreshAndRender();
    } else {
      (db.payable || []).forEach((p) => {
        if (!sameId(p.recorrencia_id, rec.recorrencia_id)) return;
        if (p.status === "Pago" || p.status === "Cancelado") return;
        if (scope === "forward" && Number(p.parcela_numero || 0) < Number(rec.parcela_numero || 0)) return;
        Object.assign(p, fields);
      });
      saveDb();
      qs("recordDialog").close();
      render();
    }
  } catch (error) {
    alert(`Não foi possível atualizar as parcelas: ${error.message}`);
  }
  return true;
}

function chooseRecurrenceScope() {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "agenda-detail-dialog";
    dialog.innerHTML = `
      <div class="modal-box agenda-detail-box">
        <h3>Alterar parcela recorrente</h3>
        <p class="muted">Esta conta faz parte de uma recorrência. O que deseja alterar?</p>
        <div class="recurrence-scope-actions">
          <button type="button" class="secondary" data-scope="one">Apenas esta parcela</button>
          <button type="button" class="secondary" data-scope="forward">Esta e as próximas</button>
          <button type="button" class="secondary" data-scope="all">Todas as parcelas em aberto</button>
          <button type="button" class="link-button" data-scope="cancel">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    const done = (val) => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); resolve(val); };
    dialog.querySelectorAll("[data-scope]").forEach((btn) => btn.addEventListener("click", () => {
      const s = btn.dataset.scope;
      done(s === "cancel" ? null : s);
    }));
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); done(null); });
    dialog.showModal();
  });
}

// ── Painel visual de grupos de recorrência na lista de contas a pagar ──
function groupRecurrences(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    if (!row.recorrencia_id) return;
    if (!map.has(row.recorrencia_id)) map.set(row.recorrencia_id, []);
    map.get(row.recorrencia_id).push(row);
  });
  return Array.from(map.entries()).map(([rid, parcels]) => {
    parcels.sort((a, b) => Number(a.parcela_numero || 0) - Number(b.parcela_numero || 0));
    const ativas = parcels.filter((p) => p.status !== "Cancelado");
    const total = Number(parcels[0]?.parcela_total) || ativas.length;
    const pagas = parcels.filter((p) => p.status === "Pago").length;
    const baseName = String(parcels[0]?.document || "").replace(/\s*-\s*Parcela.*$/i, "") || "Recorrência";
    return { rid, parcels, total, pagas, baseName, tipo: parcels[0]?.recorrencia_tipo || "", indeterminado: !parcels[0]?.parcela_total };
  });
}

function payableGroupsPanelHtml(rows) {
  const groups = groupRecurrences(rows);
  if (!groups.length) return "";
  return `<section class="payable-groups">
    <h3>Contas recorrentes</h3>
    <div class="payable-groups-grid">${groups.map(payableGroupCardHtml).join("")}</div>
  </section>`;
}

function payableGroupCardHtml(g) {
  const denom = g.total || g.parcels.length;
  const pct = denom ? Math.min(100, Math.round((g.pagas / denom) * 100)) : 0;
  const done = g.pagas >= denom && denom > 0;
  return `<article class="payable-group-card">
    <header>
      <strong title="${escapeHtml(g.baseName)}">${svgText(g.baseName)}</strong>
      <button type="button" class="payable-group-menu-btn" data-group-menu="${escapeHtml(g.rid)}" title="Opções" aria-label="Opções">⋯</button>
    </header>
    <div class="payable-group-meta">
      <span class="badge ${done ? "badge-done" : "badge-progress"}">${g.pagas}/${denom} pagas</span>
      <span class="muted">${recCapitalize(g.tipo)}${g.indeterminado ? " · indeterminado" : ""}</span>
    </div>
    <div class="payable-progress"><span style="width:${pct}%"></span></div>
    <div class="payable-group-actions" id="groupActions-${escapeHtml(g.rid)}" hidden>
      <button type="button" class="secondary" data-group-view="${escapeHtml(g.rid)}">Ver todas as parcelas</button>
      <button type="button" class="secondary" data-group-settle="${escapeHtml(g.rid)}">Quitar antecipadamente</button>
      <button type="button" class="secondary" data-group-update="${escapeHtml(g.rid)}">Alterar valor das próximas</button>
      <button type="button" class="danger" data-group-cancel="${escapeHtml(g.rid)}">Cancelar recorrência</button>
    </div>
  </article>`;
}

function setupPayableGroupActions() {
  const content = qs("content");
  content.querySelectorAll("[data-group-menu]").forEach((btn) => btn.addEventListener("click", () => {
    const el = qs("groupActions-" + btn.dataset.groupMenu);
    if (el) el.hidden = !el.hidden;
  }));
  content.querySelectorAll("[data-group-view]").forEach((btn) => btn.addEventListener("click", () => openRecurrenceParcels(btn.dataset.groupView)));
  content.querySelectorAll("[data-group-settle]").forEach((btn) => btn.addEventListener("click", () => openEarlySettlement(btn.dataset.groupSettle)));
  content.querySelectorAll("[data-group-update]").forEach((btn) => btn.addEventListener("click", () => updateFutureParcels(btn.dataset.groupUpdate)));
  content.querySelectorAll("[data-group-cancel]").forEach((btn) => btn.addEventListener("click", () => cancelRecurrenceGroup(btn.dataset.groupCancel)));
}

function groupParcels(rid) {
  return (db.payable || []).filter((p) => sameId(p.recorrencia_id, rid))
    .sort((a, b) => Number(a.parcela_numero || 0) - Number(b.parcela_numero || 0));
}

function openRecurrenceParcels(rid) {
  const parcels = groupParcels(rid);
  if (!parcels.length) return;
  const rowsHtml = parcels.map((p) => `<div class="agenda-detail-row"><dt>${svgText(p.document || ("Parcela " + p.parcela_numero))}</dt><dd>${asDate(String(p.dueDate || "").slice(0, 10))} · ${asMoney(p.amount)} · ${svgText(p.status)}${p.juros_aplicado != null && p.juros_aplicado !== "" ? " ⚡" : ""}</dd></div>`).join("");
  const dialog = document.createElement("dialog");
  dialog.className = "agenda-detail-dialog";
  dialog.innerHTML = `<div class="modal-box agenda-detail-box"><h3>Parcelas da recorrência</h3><dl class="agenda-detail-list">${rowsHtml}</dl><div class="agenda-detail-actions"><button type="button" class="secondary" data-close>Fechar</button></div></div>`;
  document.body.appendChild(dialog);
  const close = () => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); };
  dialog.querySelector("[data-close]")?.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  dialog.showModal();
}

function openEarlySettlement(rid) {
  const future = groupParcels(rid).filter((p) => p.status !== "Pago" && p.status !== "Cancelado");
  if (!future.length) { alert("Não há parcelas em aberto para quitar nesta recorrência."); return; }
  const dialog = document.createElement("dialog");
  dialog.className = "agenda-detail-dialog early-settlement-dialog";
  dialog.innerHTML = `
    <div class="modal-box">
      <h3>Quitar antecipadamente</h3>
      <p class="muted">Selecione as parcelas a quitar. As parcelas futuras NÃO selecionadas serão canceladas.</p>
      <div class="settlement-list">
        ${future.map((p) => `
          <label class="settlement-item">
            <input type="checkbox" class="settle-check" data-id="${escapeHtml(p.id)}" data-amount="${Number(p.amount || 0)}" checked>
            <span class="settlement-name">${svgText(p.document || ("Parcela " + p.parcela_numero))}</span>
            <span class="muted">${asDate(String(p.dueDate || "").slice(0, 10))}</span>
            <strong>${asMoney(p.amount)}</strong>
          </label>`).join("")}
      </div>
      <div class="settlement-fields">
        <label>Juros / Multa (R$)<input type="text" inputmode="decimal" id="settleJuros" value="0,00"></label>
        <label>Desconto (R$)<input type="text" inputmode="decimal" id="settleDesconto" value="0,00"></label>
        <label>Conta/Banco de saída (opcional)<input type="text" id="settleBank" placeholder="Ex.: Banco do Brasil"></label>
      </div>
      <p class="settlement-summary" id="settleSummary"></p>
      <div class="agenda-detail-actions">
        <button type="button" class="primary" id="settleConfirm">Confirmar quitação</button>
        <button type="button" class="secondary" data-close>Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  const close = () => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); };
  const updateSummary = () => {
    const selected = [...dialog.querySelectorAll(".settle-check")].filter((c) => c.checked);
    const original = selected.reduce((s, c) => s + Number(c.dataset.amount || 0), 0);
    const juros = parseMoneyInput(dialog.querySelector("#settleJuros").value);
    const desconto = parseMoneyInput(dialog.querySelector("#settleDesconto").value);
    const total = Math.max(0, original + juros - desconto);
    dialog.querySelector("#settleSummary").innerHTML = `${selected.length} parcela(s) · Valor original: <strong>${asMoney(original)}</strong> · Juros: <strong>${asMoney(juros)}</strong> · Desconto: <strong>${asMoney(desconto)}</strong> · Total a pagar: <strong>${asMoney(total)}</strong>`;
  };
  dialog.querySelectorAll(".settle-check, #settleJuros, #settleDesconto").forEach((el) => el.addEventListener("input", updateSummary));
  updateSummary();
  dialog.querySelector("[data-close]")?.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.querySelector("#settleConfirm").addEventListener("click", async () => {
    const ids = [...dialog.querySelectorAll(".settle-check")].filter((c) => c.checked).map((c) => c.dataset.id);
    if (!ids.length) { alert("Selecione ao menos uma parcela."); return; }
    const juros = parseMoneyInput(dialog.querySelector("#settleJuros").value);
    const desconto = parseMoneyInput(dialog.querySelector("#settleDesconto").value);
    const bankAccount = dialog.querySelector("#settleBank").value.trim();
    if (!confirm("Confirmar a quitação antecipada das parcelas selecionadas? As demais parcelas futuras serão canceladas.")) return;
    const confirmBtn = dialog.querySelector("#settleConfirm");
    confirmBtn.disabled = true;
    try {
      await runEarlySettlement(rid, ids, juros, desconto, bankAccount);
      close();
    } catch (error) {
      alert(`Não foi possível quitar: ${error.message}`);
      confirmBtn.disabled = false;
    }
  });
  dialog.showModal();
}

async function runEarlySettlement(rid, ids, juros, desconto, bankAccount) {
  if (serverMode) {
    await apiModuleRequest("?module=payable&action=early_settlement", {
      method: "POST",
      body: JSON.stringify({ recorrencia_id: rid, parcela_ids: ids, juros, desconto, bankAccount }),
    });
    await refreshAndRender();
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const idset = new Set(ids.map(String));
  const selected = (db.payable || []).filter((p) => sameId(p.recorrencia_id, rid) && idset.has(String(p.id)) && p.status !== "Pago" && p.status !== "Cancelado");
  const original = selected.reduce((s, p) => s + Number(p.amount || 0), 0);
  let jurosRest = juros;
  selected.forEach((p, i) => {
    const jp = original <= 0 ? 0 : (i === selected.length - 1 ? jurosRest : Math.round(juros * (Number(p.amount || 0) / original) * 100) / 100);
    jurosRest = Math.round((jurosRest - jp) * 100) / 100;
    Object.assign(p, { status: "Pago", paidDate: today, valor_original: Number(p.amount || 0), juros_aplicado: jp });
    if (bankAccount) p.bankAccount = bankAccount;
  });
  (db.payable || []).forEach((p) => {
    if (sameId(p.recorrencia_id, rid) && p.status !== "Pago" && p.status !== "Cancelado") p.status = "Cancelado";
  });
  const total = Math.max(0, original + juros - desconto);
  if (total > 0) {
    db.cashMoves.push({ id: crypto.randomUUID(), date: today, bankAccount: bankAccount || "", type: "Saída", history: `Quitação antecipada — ${selected.length} parcela(s)`, amount: total, originDocument: `QUIT:${rid}`, status: "Confirmado" });
  }
  saveDb();
  render();
}

async function updateFutureParcels(rid) {
  const future = groupParcels(rid).filter((p) => p.status !== "Pago" && p.status !== "Cancelado");
  if (!future.length) { alert("Não há parcelas futuras em aberto."); return; }
  const input = prompt(`Novo valor para as ${future.length} parcela(s) em aberto (R$):`, formatMoneyInput(future[0]?.amount || 0));
  if (input === null) return;
  const novoValor = parseMoneyInput(input);
  if (!(novoValor > 0)) { alert("Valor inválido."); return; }
  try {
    if (serverMode) {
      await apiModuleRequest("?module=payable&action=update_scope", {
        method: "POST",
        body: JSON.stringify({ recorrencia_id: rid, scope: "all", fields: { amount: novoValor } }),
      });
      await refreshAndRender();
    } else {
      future.forEach((p) => { p.amount = novoValor; });
      saveDb();
      render();
    }
  } catch (error) {
    alert(`Não foi possível atualizar: ${error.message}`);
  }
}

async function cancelRecurrenceGroup(rid) {
  const future = groupParcels(rid).filter((p) => p.status !== "Pago" && p.status !== "Cancelado");
  if (!future.length) { alert("Não há parcelas futuras para cancelar."); return; }
  if (!confirm(`Cancelar ${future.length} parcela(s) futura(s) desta recorrência? As parcelas já pagas são mantidas como histórico.`)) return;
  try {
    if (serverMode) {
      await apiModuleRequest("?module=payable&action=cancel_recurrence", { method: "POST", body: JSON.stringify({ recorrencia_id: rid }) });
      await refreshAndRender();
    } else {
      future.forEach((p) => { p.status = "Cancelado"; });
      saveDb();
      render();
    }
  } catch (error) {
    alert(`Não foi possível cancelar: ${error.message}`);
  }
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
  // Conta a pagar recorrente: gera todas as parcelas em vez de um único registro.
  if (editing.key === "payable" && !editing.id && qs("payableRecurrenceToggle")?.checked) {
    const ok = await submitPayableRecurrence(data);
    if (ok) {
      qs("recordDialog").close();
      if (serverMode) await refreshAndRender(); else render();
    }
    return;
  }
  // Edição de uma parcela recorrente: pergunta o escopo (esta / próximas / todas).
  if (editing.key === "payable" && editing.id) {
    const handled = await maybeApplyRecurrenceScopeEdit(data);
    if (handled) return; // já tratado (propagou e fechou) — não cai no fluxo normal
  }
  // Pedido de compra com itens detalhados: salva o pedido e os itens (saveBulk).
  if (editing.key === "purchaseOrders") {
    const handled = await submitPurchaseOrder(data);
    if (handled) return;
  }
  // Novo movimento de caixa vinculado a uma conta a pagar: baixa a conta e grava
  // a referência cruzada (evita dupla contagem no centro de custo).
  if (editing.key === "cashMoves" && !editing.id) {
    const payableId = qs("cashLinkPayable")?.value;
    if (payableId) {
      const ok = await submitLinkedCashMove(data, payableId);
      if (ok) { qs("recordDialog").close(); if (serverMode) await refreshAndRender(); else render(); }
      return;
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
  const boardOptions = boards.map((row) => `<option value="${row.id}" ${sameId(row.id, selectedKanbanBoardId) ? "selected" : ""}>${svgText(row.nome)}</option>`).join("");
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
      <span>${board?.obra_id ? `Obra: ${svgText(nameOf("projects", board.obra_id))}` : "Sem obra vinculada"}</span>
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
        <div class="agenda-side">
          ${agendaLegendHtml()}
          ${agendaFormHtml(canCreateInWeek, weekStart)}
        </div>
      </div>
    `;
    qs("agendaPrev")?.addEventListener("click", () => moveAgendaCursor(-1));
    qs("agendaToday")?.addEventListener("click", () => { agendaCursorDate = agendaSafeDateString(new Date()); renderAgenda(); });
    qs("agendaNext")?.addEventListener("click", () => moveAgendaCursor(1));
    qs("agendaEventForm")?.addEventListener("submit", saveAgendaEvent);
    // Preenchimento automático de dados do cliente também no formulário da agenda.
    const agendaForm = qs("agendaEventForm");
    const agendaClientSelect = agendaForm?.querySelector('select[name="cliente_id"]');
    if (agendaForm && agendaClientSelect) setupClientAutofill(agendaForm, agendaClientSelect);
    qs("agendaCancelEdit")?.addEventListener("click", () => { agendaEditingId = ""; renderAgenda(); });
    qs("content").querySelectorAll("[data-agenda-edit]").forEach((button) =>
      button.addEventListener("click", () => editAgendaEvent(button.dataset.agendaEdit)));
    qs("content").querySelectorAll("[data-agenda-delete]").forEach((button) =>
      button.addEventListener("click", () => removeRecord("agendaEvents", button.dataset.agendaDelete)));
    // Eventos financeiros (a receber/pagar, marcos e pedidos) abrem o detalhe ao clicar.
    qs("content").querySelectorAll("[data-fin-event]").forEach((el) => {
      const open = () => {
        const [collection, id] = String(el.dataset.finEvent).split(":");
        openAgendaFinancialDetail(collection, id);
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });
    });
    // Legenda colapsável.
    qs("agendaLegendToggle")?.addEventListener("click", () => {
      agendaLegendCollapsed = !agendaLegendCollapsed;
      qs("agendaLegend")?.classList.toggle("collapsed", agendaLegendCollapsed);
      const toggle = qs("agendaLegendToggle");
      if (toggle) toggle.textContent = agendaLegendCollapsed ? "+" : "−";
    });
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
  const start = agendaWeekStart(weekStart);
  const finEvents = agendaFinancialEvents(agendaSafeDateString(start), agendaSafeDateString(addDays(start, 6)));
  return `<section class="agenda-grid agenda-week">
    ${days.map((date) => {
      const key = agendaSafeDateString(date);
      if (!key) return "";
      const isToday = key === todayKey;
      const dayEvents = events.filter((event) => agendaEventDateKey(event) === key);
      const dayFinEvents = finEvents.filter((event) => event.dateKey === key);
      const hasAny = dayEvents.length || dayFinEvents.length;
      return `<article class="agenda-day${isToday ? " today" : ""}">
        <header>
          <strong>${agendaDayName(date)}</strong>
          <span>${date.getDate()}</span>
        </header>
        <div class="agenda-day-events">
          ${dayFinEvents.map(agendaFinancialCardHtml).join("")}
          ${dayEvents.map(agendaEventCardHtml).join("")}
          ${hasAny ? "" : '<p class="empty small">Sem compromissos.</p>'}
        </div>
      </article>`;
    }).join("")}
  </section>`;
}

// Mapa único de cores/legenda dos eventos financeiros exibidos na agenda.
// As classes correspondem às regras .agenda-evento-* definidas no styles.css.
const AGENDA_FIN_COLORS = {
  receber: { cls: "agenda-evento-receber", dot: "#1a73e8", label: "A Receber (no prazo)" },
  recebido: { cls: "agenda-evento-recebido", dot: "#2e7d32", label: "Recebido" },
  pagar: { cls: "agenda-evento-pagar", dot: "#f57c00", label: "A Pagar (no prazo)" },
  pago: { cls: "agenda-evento-pago", dot: "#1b5e20", label: "Pago" },
  vencido: { cls: "agenda-evento-vencido", dot: "#c62828", label: "Vencido (receber ou pagar)" },
  marco: { cls: "agenda-evento-marco", dot: "#6a1b9a", label: "Marco de obra" },
  compra: { cls: "agenda-evento-compra", dot: "#f9a825", label: "Entrega de compra" },
  manual: { cls: "agenda-evento-manual", dot: "#546e7a", label: "Evento manual" },
};

// Monta os eventos financeiros automáticos do período (a receber, a pagar,
// marcos de obra e pedidos de compra) a partir dos dados já carregados em `db`.
// startKey/endKey são strings YYYY-MM-DD inclusivas.
function agendaFinancialEvents(startKey, endKey) {
  const todayKey = agendaSafeDateString(new Date());
  const inRange = (dateKey) => Boolean(dateKey) && (!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey);
  const dayOf = (value) => String(value || "").slice(0, 10);
  const events = [];

  // 1. Contas a receber — vencimento (dueDate).
  (db.receivable || []).forEach((row) => {
    if (row.status === "Cancelado") return;
    const dateKey = dayOf(row.dueDate);
    if (!inRange(dateKey)) return;
    let color = "receber";
    if (row.status === "Recebido") color = "recebido";
    else if (dateKey < todayKey) color = "vencido";
    events.push({
      dateKey, color, icon: "$", collection: "receivable", id: row.id,
      title: `Receber: ${nameOf("clients", row.clientId) || row.document || "—"} · ${asMoney(row.amount)}`,
    });
  });

  // 2. Contas a pagar — vencimento (dueDate).
  (db.payable || []).forEach((row) => {
    if (row.status === "Cancelado") return;
    const dateKey = dayOf(row.dueDate);
    if (!inRange(dateKey)) return;
    let color = "pagar";
    let icon = "$";
    if (row.status === "Pago") {
      color = "pago";
      // Quitação antecipada preenche valor_original → marcador especial ⚡.
      if (row.recorrencia_id && row.valor_original != null && row.valor_original !== "") icon = "⚡";
    } else if (dateKey < todayKey) {
      color = "vencido";
    }
    events.push({
      dateKey, color, icon, collection: "payable", id: row.id,
      title: `${icon === "⚡" ? "Quitado antecip.: " : "Pagar: "}${nameOf("suppliers", row.supplierId) || row.document || "—"} · ${asMoney(row.amount)}`,
    });
  });

  // 3. Marcos de obra — data prevista (plannedDate).
  (db.projectMilestones || []).forEach((row) => {
    if (row.status === "Cancelado") return;
    const dateKey = dayOf(row.plannedDate);
    if (!inRange(dateKey)) return;
    events.push({
      dateKey, color: "marco", icon: "🏗", collection: "projectMilestones", id: row.id,
      title: `Marco: ${row.name || nameOf("projects", row.projectId) || "—"}`,
    });
  });

  // 4. Pedidos de compra — previsão de entrega (expectedDate).
  (db.purchaseOrders || []).forEach((row) => {
    if (row.status === "Cancelado") return;
    const dateKey = dayOf(row.expectedDate);
    if (!inRange(dateKey)) return;
    events.push({
      dateKey, color: "compra", icon: "📦", collection: "purchaseOrders", id: row.id,
      title: `Compra: ${row.number || "—"} · ${asMoney(row.amount)}`,
    });
  });

  return events.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function agendaFinancialCardHtml(ev) {
  const meta = AGENDA_FIN_COLORS[ev.color] || AGENDA_FIN_COLORS.manual;
  return `
    <article class="agenda-event agenda-event-fin ${meta.cls}" data-fin-event="${ev.collection}:${escapeHtml(ev.id)}" role="button" tabindex="0" title="${escapeHtml(ev.title)}">
      <strong><span class="agenda-fin-icon">${ev.icon}</span> ${svgText(ev.title)}</strong>
    </article>
  `;
}

function agendaLegendHtml() {
  const collapsed = agendaLegendCollapsed ? " collapsed" : "";
  const items = ["receber", "recebido", "pagar", "pago", "vencido", "marco", "compra", "manual"]
    .map((key) => {
      const meta = AGENDA_FIN_COLORS[key];
      return `<li><span class="agenda-legend-dot" style="background:${meta.dot}"></span>${meta.label}</li>`;
    }).join("");
  return `
    <aside id="agendaLegend" class="agenda-legend${collapsed}">
      <header class="agenda-legend-head">
        <strong>Legenda</strong>
        <button type="button" id="agendaLegendToggle" class="agenda-legend-toggle" title="Minimizar legenda" aria-label="Minimizar legenda">${agendaLegendCollapsed ? "+" : "−"}</button>
      </header>
      <ul class="agenda-legend-list">${items}</ul>
    </aside>
  `;
}

// Detalhes exibidos no modal de cada tipo de evento financeiro.
function agendaFinancialDetailRows(collection, row) {
  const d = (value) => asDate(String(value || "").slice(0, 10));
  if (collection === "receivable") return [
    ["Documento", row.document],
    ["Cliente", nameOf("clients", row.clientId)],
    ["Obra/Projeto", nameOf("projects", row.projectId)],
    ["Vencimento", d(row.dueDate)],
    ["Recebimento", d(row.receivedDate)],
    ["Valor", asMoney(row.amount)],
    ["Status", row.status],
  ];
  if (collection === "payable") return [
    ["Documento", row.document],
    ["Fornecedor", nameOf("suppliers", row.supplierId)],
    ["Obra/Projeto", nameOf("projects", row.projectId)],
    ["Vencimento", d(row.dueDate)],
    ["Pagamento", d(row.paidDate)],
    ["Valor", asMoney(row.amount)],
    ["Status", row.status],
  ];
  if (collection === "projectMilestones") return [
    ["Marco", row.name],
    ["Obra/Projeto", nameOf("projects", row.projectId)],
    ["Data prevista", d(row.plannedDate)],
    ["Data concluída", d(row.completedDate)],
    ["Status", row.status],
    ["Observações", row.notes],
  ];
  if (collection === "purchaseOrders") return [
    ["Número", row.number],
    ["Fornecedor", nameOf("suppliers", row.supplierId)],
    ["Obra/Projeto", nameOf("projects", row.projectId)],
    ["Data do pedido", d(row.date)],
    ["Previsão de entrega", d(row.expectedDate)],
    ["Valor", asMoney(row.amount)],
    ["Status", row.status],
  ];
  return [];
}

// Abre um modal com os detalhes completos do registro financeiro e um atalho
// para o módulo de origem (conta a receber/pagar, marco ou pedido).
function openAgendaFinancialDetail(collection, id) {
  const row = byId(collection, id);
  if (!row) { alert("Registro não encontrado. Ele pode ter sido removido."); return; }
  const moduleLabel = {
    receivable: "Conta a receber",
    payable: "Conta a pagar",
    projectMilestones: "Marco da obra",
    purchaseOrders: "Pedido de compra",
  }[collection] || "Registro";
  const body = agendaFinancialDetailRows(collection, row)
    .map(([label, value]) => `<div class="agenda-detail-row"><dt>${escapeHtml(label)}</dt><dd>${svgText(value || "—")}</dd></div>`)
    .join("");
  const canOpen = typeof canAccessModule === "function" ? canAccessModule(collection) : true;
  const dialog = document.createElement("dialog");
  dialog.className = "agenda-detail-dialog";
  dialog.innerHTML = `
    <div class="modal-box agenda-detail-box">
      <h3>${escapeHtml(moduleLabel)}</h3>
      <dl class="agenda-detail-list">${body}</dl>
      <div class="agenda-detail-actions">
        ${canOpen ? '<button type="button" class="primary" data-detail-open>Abrir registro original</button>' : ""}
        <button type="button" class="secondary" data-detail-close>Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); };
  dialog.querySelector("[data-detail-close]")?.addEventListener("click", close);
  dialog.querySelector("[data-detail-open]")?.addEventListener("click", () => {
    close();
    currentModule = collection;
    render();
  });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  dialog.showModal();
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
      <small>${agendaTypeLabel(event.tipo)}${event.usuario_id ? ` - ${svgText(nameOf("users", event.usuario_id))}` : ""}</small>
      ${event.cliente_id || event.obra_id ? `<small>${svgText([nameOf("clients", event.cliente_id), nameOf("projects", event.obra_id)].filter(Boolean).join(" - "))}</small>` : ""}
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
        <span>${card.responsavel_id ? svgText(nameOf("users", card.responsavel_id)) : "Sem responsável"}</span>
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
    ${generateDocumentHeader("Cronograma Físico-Financeiro", `${project?.name || "Sem obra selecionada"} · ${documentPeriodSubtitle()}`)}
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
    ${generateDocumentFooter()}
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

// ─── Realizado vs Orçado (execução dos itens do orçamento de obra) ──────────
function fmtQty(value) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function budgetItemExecution(item) {
  const qtd = Number(item.quantity || 0);
  const real = Number(item.quantidade_realizada || 0);
  const vu = Number(item.unitPrice || 0);
  const totalPrev = Number(item.totalPrice || qtd * vu);
  const totalReal = real * vu;
  const pct = qtd > 0 ? (real / qtd) * 100 : (real > 0 ? 100 : 0);
  return { qtd, real, vu, totalPrev, totalReal, pct, saldo: totalPrev - totalReal, estouro: qtd > 0 && real > qtd };
}

function budgetItemStatusBadge(pct, estouro) {
  if (estouro || pct > 100) return '<span class="exec-badge exec-estouro">⚠️ Estouro</span>';
  if (pct >= 100) return '<span class="exec-badge exec-concluido">Concluído</span>';
  if (pct >= 50) return '<span class="exec-badge exec-parcial">Parcial</span>';
  if (pct >= 1) return '<span class="exec-badge exec-andamento">Em andamento</span>';
  return '<span class="exec-badge exec-naoiniciado">Não iniciado</span>';
}

function budgetItemMatchesFilter(ex, filter) {
  if (filter === "estouro") return ex.estouro || ex.pct > 100;
  if (filter === "naoiniciado") return ex.pct === 0;
  if (filter === "andamento") return ex.pct >= 1 && ex.pct < 100;
  if (filter === "concluido") return ex.pct >= 100 && !ex.estouro;
  return true;
}

function renderWorkBudgetExecutionSection(budget, items, editable) {
  const execs = items.map((item) => ({ item, ex: budgetItemExecution(item) }));
  const totalPrev = execs.reduce((s, e) => s + e.ex.totalPrev, 0);
  const totalReal = execs.reduce((s, e) => s + e.ex.totalReal, 0);
  const saldoTotal = totalPrev - totalReal;
  const pctGeral = totalPrev > 0 ? (totalReal / totalPrev) * 100 : 0;
  const estouroCount = execs.filter((e) => e.ex.estouro || e.ex.pct > 100).length;
  const filtered = execs.filter((e) => budgetItemMatchesFilter(e.ex, workBudgetItemFilter));
  const barClass = pctGeral > 100 ? "exec-bar-red" : pctGeral >= 80 ? "exec-bar-yellow" : "exec-bar-green";
  const filtros = [["all", "Todos"], ["estouro", "Estouro"], ["naoiniciado", "Não iniciados"], ["andamento", "Em andamento"], ["concluido", "Concluídos"]];
  const colspan = editable ? 12 : 11;
  return `
    <section class="exec-progress-panel">
      <div class="exec-progress-head">
        <strong>Execução geral da obra: ${asPercent(pctGeral)}</strong>
        <span class="muted">${asMoney(totalReal)} realizado de ${asMoney(totalPrev)} previsto</span>
      </div>
      <div class="exec-progress-bar"><span class="${barClass}" style="width:${Math.min(100, Math.round(pctGeral))}%"></span></div>
      ${estouroCount ? `<button type="button" class="exec-estouro-alert" id="execEstouroBtn">⚠️ ${estouroCount} item(ns) com estouro de quantidade — clique para ver</button>` : ""}
    </section>
    <section class="exec-filters">
      ${filtros.map(([v, l]) => `<button type="button" class="exec-chip ${workBudgetItemFilter === v ? "active" : ""}" data-exec-filter="${v}">${l}</button>`).join("")}
    </section>
    <section class="table-wrap" data-export-title="Realizado vs Orçado">
      <table class="exec-table">
        <thead><tr>
          <th>Código</th><th>Descrição</th><th>Unid.</th><th>Qtd. prev.</th><th>Valor Unit.</th><th>Total prev.</th>
          <th>Qtd. real.</th><th>% Exec.</th><th>Total real.</th><th>Saldo</th><th>Status</th>${editable ? "<th>Ações</th>" : ""}
        </tr></thead>
        <tbody>
          ${filtered.length ? filtered.map(({ item, ex }) => `
            <tr class="${ex.estouro ? "exec-row-estouro" : ""}">
              <td>${ex.estouro ? "⚠️ " : ""}${svgText(item.code || "")}</td>
              <td>${svgText(item.description || "")}</td>
              <td>${svgText(item.unit || "")}</td>
              <td>${fmtQty(ex.qtd)}</td>
              <td>${asMoney(ex.vu)}</td>
              <td>${asMoney(ex.totalPrev)}</td>
              <td><strong>${fmtQty(ex.real)}</strong></td>
              <td>${asPercent(ex.pct)}</td>
              <td>${asMoney(ex.totalReal)}</td>
              <td class="${ex.saldo < 0 ? "cc-neg" : ""}">${asMoney(ex.saldo)}</td>
              <td>${budgetItemStatusBadge(ex.pct, ex.estouro)}</td>
              ${editable ? `<td><div class="row-actions">
                <button type="button" class="secondary" data-exec-update="${item.id}">Atualizar</button>
                <button type="button" class="secondary" data-action-key="workBudgetItems" data-edit="${item.id}">Editar</button>
              </div></td>` : ""}
            </tr>`).join("") : `<tr><td colspan="${colspan}"><div class="empty">Nenhum item neste filtro.</div></td></tr>`}
        </tbody>
        <tfoot>
          <tr class="exec-totals">
            <td colspan="5">Totais</td>
            <td>${asMoney(totalPrev)}</td>
            <td colspan="2">${asPercent(pctGeral)}</td>
            <td>${asMoney(totalReal)}</td>
            <td class="${saldoTotal < 0 ? "cc-neg" : ""}">${asMoney(saldoTotal)}</td>
            <td colspan="${editable ? 2 : 1}"></td>
          </tr>
        </tfoot>
      </table>
    </section>`;
}

// Modal de atualização manual da quantidade realizada + histórico de alterações.
function openBudgetItemExecution(itemId) {
  const item = byId("workBudgetItems", itemId);
  if (!item) { alert("Item do orçamento não encontrado."); return; }
  const dialog = document.createElement("dialog");
  dialog.className = "agenda-detail-dialog exec-update-dialog";
  document.body.appendChild(dialog);
  const close = () => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); };

  const historyHtml = (history) => {
    if (history === null) return '<p class="muted">Carregando histórico…</p>';
    if (!history.length) return '<p class="muted">Sem alterações registradas.</p>';
    return history.map((h) => `<div class="exec-hist-row">
      <span>${h.created_at ? asDate(String(h.created_at).slice(0, 10)) : "—"}</span>
      <span>${fmtQty(h.quantidade_anterior)} → <strong>${fmtQty(h.quantidade_nova)}</strong></span>
      <span class="muted">${svgText(nameOf("users", h.usuario_id) || (h.origem === "pedido_compra" ? "Pedido de compra" : "Manual"))}</span>
      ${h.motivo ? `<span class="muted">${svgText(h.motivo)}</span>` : ""}
    </div>`).join("");
  };

  const paint = (history) => {
    const cur = byId("workBudgetItems", itemId) || item;
    const ex = budgetItemExecution(cur);
    dialog.innerHTML = `
      <div class="modal-box exec-update-box">
        <h3>Atualizar execução do item</h3>
        <p class="muted">${svgText(cur.description || cur.code || "")}</p>
        <div class="exec-update-info">
          <span>Qtd. prevista: <strong>${fmtQty(ex.qtd)} ${svgText(cur.unit || "")}</strong></span>
          <span>Realizada atual: <strong>${fmtQty(ex.real)}</strong></span>
          <span>% Executado: <strong>${asPercent(ex.pct)}</strong></span>
        </div>
        <label>Nova quantidade realizada<input id="execNovaQtd" inputmode="decimal" value="${escapeHtml(String(ex.real).replace(".", ","))}"></label>
        <label>Motivo (opcional)<input id="execMotivo" placeholder="Ex.: medição em campo, ajuste de quantidade"></label>
        <div class="agenda-detail-actions">
          <button type="button" class="primary" id="execSalvar">Salvar</button>
          <button type="button" class="secondary" data-close>Fechar</button>
        </div>
        <h4 class="exec-hist-title">Histórico de alterações</h4>
        <div class="exec-hist">${historyHtml(history)}</div>
      </div>`;
    dialog.querySelector("[data-close]")?.addEventListener("click", close);
    dialog.querySelector("#execSalvar")?.addEventListener("click", salvar);
  };

  const salvar = async () => {
    const nova = parseMoneyInput(dialog.querySelector("#execNovaQtd").value);
    const motivo = dialog.querySelector("#execMotivo").value.trim();
    if (!(nova >= 0)) { alert("Informe uma quantidade válida."); return; }
    const btn = dialog.querySelector("#execSalvar");
    if (btn) btn.disabled = true;
    try {
      if (serverMode) {
        await apiModuleRequest("?module=workBudgetExecution&action=update", { method: "POST", body: JSON.stringify({ itemId, quantidade_realizada: nova, motivo }) });
        await refreshData();
      } else {
        const it = byId("workBudgetItems", itemId);
        if (it) it.quantidade_realizada = nova;
        saveDb();
      }
      close();
      render();
    } catch (error) {
      alert(`Não foi possível salvar: ${error.message}`);
      if (btn) btn.disabled = false;
    }
  };

  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  paint(null);
  dialog.showModal();
  if (serverMode) {
    apiModuleRequest(`?module=workBudgetExecution&action=history&itemId=${encodeURIComponent(itemId)}`)
      .then((h) => paint(h || []))
      .catch(() => paint([]));
  } else {
    paint([]);
  }
}

// ─── Estrutura profissional do orçamento: etapas, tipos e visões ────────────
const BUDGET_TIPOS = [
  ["material", "Material"],
  ["mao_de_obra", "Mão de obra"],
  ["equipamento", "Equipamento"],
  ["subempreiteiro", "Subempreiteiro"],
  ["outros", "Outros"],
];
const BUDGET_TIPO_SHORT = { material: "Mat.", mao_de_obra: "M.O.", equipamento: "Equip.", subempreiteiro: "Subemp.", outros: "Outros" };
function budgetTipoLabel(t) { const f = BUDGET_TIPOS.find(([v]) => v === t); return f ? f[1] : "Material"; }
function budgetTipoShort(t) { return BUDGET_TIPO_SHORT[t] || "Mat."; }
function budgetItemCost(it) { const t = Number(it.totalCost || 0); return t || Number(it.quantity || 0) * Number(it.unitCost || 0); }
function budgetEtapas(orcamentoId) {
  return (db.orcamentoEtapas || []).filter((e) => sameId(e.orcamento_id, orcamentoId))
    .sort((a, b) => (Number(a.ordem || 0) - Number(b.ordem || 0)) || String(a.codigo || "").localeCompare(String(b.codigo || "")));
}
function budgetEtapaBdi(etapa, budget) {
  const esp = etapa && etapa.bdi_especifico != null && etapa.bdi_especifico !== "" ? Number(etapa.bdi_especifico) : null;
  return esp != null ? esp : Number(budget.bdiPercent || 0);
}
function budgetTipoTotals(items) {
  const totals = {};
  BUDGET_TIPOS.forEach(([v]) => (totals[v] = 0));
  items.forEach((it) => { const k = it.tipo || "material"; totals[k] = (totals[k] || 0) + budgetItemCost(it); });
  return totals;
}
function budgetTotals(budget, items) {
  const etapas = budgetEtapas(budget.id);
  let custoDireto = 0;
  let bdiValor = 0;
  const add = (grp, etapa) => {
    const c = grp.reduce((s, it) => s + budgetItemCost(it), 0);
    custoDireto += c;
    bdiValor += c * (budgetEtapaBdi(etapa, budget) / 100);
  };
  etapas.forEach((et) => add(items.filter((it) => sameId(it.etapa_id, et.id)), et));
  const semEtapa = items.filter((it) => !it.etapa_id);
  if (semEtapa.length) add(semEtapa, null);
  return { custoDireto, bdiValor, totalComBdi: custoDireto + bdiValor };
}

function budgetViewSwitcher() {
  const views = [["etapa", "Por Etapa"], ["centro", "Por Centro de Custo"], ["tipo", "Por Tipo de Custo"], ["execucao", "Previsto vs Realizado"]];
  return `<section class="budget-view-switch no-print">${views.map(([v, l]) => `<button type="button" class="exec-chip ${workBudgetView === v ? "active" : ""}" data-budget-view="${v}">${l}</button>`).join("")}</section>`;
}

function budgetTotalizadores(budget, items) {
  const tt = budgetTipoTotals(items);
  const tot = budgetTotals(budget, items);
  const tipoRows = BUDGET_TIPOS.filter(([v]) => tt[v] > 0).map(([v, l]) => `<div class="bt-row"><span>${l}</span><strong>${asMoney(tt[v])}</strong></div>`).join("");
  return `
    <section class="budget-totais">
      <div class="budget-totais-tipos">
        <h4>Custo direto por tipo</h4>
        ${tipoRows || '<div class="bt-row"><span>Sem itens</span><strong>R$ 0,00</strong></div>'}
      </div>
      <div class="budget-totais-final">
        <div class="bt-row"><span>Custo direto (sem BDI)</span><strong>${asMoney(tot.custoDireto)}</strong></div>
        <div class="bt-row"><span>BDI ${asPercent(budget.bdiPercent || 0)}</span><strong>${asMoney(tot.bdiValor)}</strong></div>
        <div class="bt-row bt-total"><span>TOTAL COM BDI</span><strong>${asMoney(tot.totalComBdi)}</strong></div>
      </div>
    </section>`;
}

function renderBudgetEtapaView(budget, items, editable) {
  const etapas = budgetEtapas(budget.id);
  const semEtapa = items.filter((it) => !it.etapa_id);
  const itemRow = (it) => `<tr>
    <td>${svgText(it.codigo || it.code || "")}</td>
    <td>${svgText(it.description || "")}</td>
    <td><span class="bt-tipo">${budgetTipoShort(it.tipo)}</span></td>
    <td>${svgText(it.unit || "")}</td>
    <td>${fmtQty(it.quantity)}</td>
    <td>${asMoney(it.unitCost)}</td>
    <td>${asMoney(budgetItemCost(it))}</td>
    ${editable ? `<td class="no-print"><div class="row-actions">
      <button type="button" class="secondary" data-action-key="workBudgetItems" data-edit="${it.id}" title="Editar">✎</button>
      <button type="button" class="danger" data-action-key="workBudgetItems" data-delete="${it.id}" title="Remover">✕</button>
    </div></td>` : ""}
  </tr>`;
  const etapaBlock = (etapa, grp) => {
    const subtotal = grp.reduce((s, it) => s + budgetItemCost(it), 0);
    return `<section class="budget-etapa">
      <header class="budget-etapa-head">
        <strong>${etapa ? `${etapa.codigo ? etapa.codigo + " — " : ""}${svgText(etapa.nome)}` : "Itens sem etapa"}</strong>
        <span class="budget-etapa-sub">Subtotal: ${asMoney(subtotal)}${etapa ? ` · BDI ${asPercent(budgetEtapaBdi(etapa, budget))}` : ""}</span>
        ${editable && etapa ? `<span class="budget-etapa-acts no-print"><button type="button" class="secondary" data-etapa-edit="${etapa.id}">editar</button><button type="button" class="danger" data-etapa-remove="${etapa.id}">remover</button></span>` : ""}
      </header>
      <div class="table-wrap"><table class="budget-items-table">
        <thead><tr><th>Cód.</th><th>Descrição</th><th>Tipo</th><th>Un</th><th>Qtd</th><th>V.Unit</th><th>Total</th>${editable ? '<th class="no-print"></th>' : ""}</tr></thead>
        <tbody>${grp.length ? grp.map(itemRow).join("") : `<tr><td colspan="${editable ? 8 : 7}"><span class="muted">Sem itens nesta etapa.</span></td></tr>`}</tbody>
      </table></div>
      ${editable ? `<button type="button" class="link-button budget-add-item no-print" data-add-item-etapa="${etapa ? etapa.id : ""}">+ Adicionar item</button>` : ""}
    </section>`;
  };
  return `
    ${editable ? '<button type="button" class="secondary budget-nova-etapa no-print" id="budgetNovaEtapa">+ Nova etapa</button>' : ""}
    ${etapas.map((et) => etapaBlock(et, items.filter((it) => sameId(it.etapa_id, et.id)))).join("")}
    ${(semEtapa.length || !etapas.length) ? etapaBlock(null, semEtapa) : ""}`;
}

function renderBudgetCentroView(items) {
  const groups = {};
  items.forEach((it) => { const k = it.costCenterId || "__none"; (groups[k] = groups[k] || []).push(it); });
  let totalGeral = 0;
  const blocks = Object.entries(groups).map(([cc, grp]) => {
    const sub = grp.reduce((s, it) => s + budgetItemCost(it), 0);
    totalGeral += sub;
    const name = cc === "__none" ? "Sem centro de custo" : (nameOf("costCenters", cc) || "Centro de custo");
    return `<section class="budget-group">
      <header><strong>${svgText(name)}</strong><span>${asMoney(sub)}</span></header>
      <div class="table-wrap"><table class="budget-items-table"><tbody>
        ${grp.map((it) => `<tr><td>${svgText(it.codigo || it.code || "")}</td><td>${svgText(it.description || "")}</td><td class="bt-num">${asMoney(budgetItemCost(it))}</td></tr>`).join("")}
        <tr class="budget-group-sub"><td colspan="2">Subtotal</td><td class="bt-num">${asMoney(sub)}</td></tr>
      </tbody></table></div>
    </section>`;
  }).join("");
  return `${blocks || '<p class="muted">Sem itens.</p>'}<div class="budget-group-total">TOTAL GERAL: ${asMoney(totalGeral)}</div>`;
}

function renderBudgetTipoView(items) {
  const tt = budgetTipoTotals(items);
  const totalReal = Object.values(tt).reduce((s, v) => s + v, 0);
  const total = totalReal || 1;
  const rows = BUDGET_TIPOS.map(([v, l]) => ({ l, val: tt[v] || 0, pct: (tt[v] || 0) / total * 100 })).filter((r) => r.val > 0);
  return `<section class="budget-tipo-view">
    ${rows.length ? rows.map((r) => `<div class="budget-tipo-row">
      <span class="budget-tipo-name">${r.l}</span>
      <span class="budget-tipo-val">${asMoney(r.val)}</span>
      <span class="budget-tipo-pct">${asPercent(r.pct)}</span>
      <span class="budget-tipo-bar"><span style="width:${Math.round(r.pct)}%"></span></span>
    </div>`).join("") : '<p class="muted">Sem itens.</p>'}
    <div class="budget-tipo-row budget-tipo-total"><span class="budget-tipo-name">TOTAL</span><span class="budget-tipo-val">${asMoney(totalReal)}</span><span></span><span></span></div>
  </section>`;
}

function renderWorkBudgetStructure(budget, items, editable) {
  let view = "";
  if (workBudgetView === "centro") view = renderBudgetCentroView(items);
  else if (workBudgetView === "tipo") view = renderBudgetTipoView(items);
  else if (workBudgetView === "execucao") view = renderWorkBudgetExecutionSection(budget, items, editable);
  else view = renderBudgetEtapaView(budget, items, editable);
  return `
    <section class="budget-header-bar no-print">
      <div class="budget-header-info">
        <span>BDI geral: <strong>${asPercent(budget.bdiPercent || 0)}</strong></span>
        <span>Status: <strong>${svgText(budget.status || "Rascunho")}</strong></span>
      </div>
      <div class="budget-header-acts">
        <button type="button" class="secondary" id="budgetPrint">Imprimir</button>
        <button type="button" class="secondary" id="budgetExportCsv">Exportar Excel</button>
        ${editable ? '<button type="button" class="secondary" id="budgetEditHeader">Editar orçamento</button>' : ""}
      </div>
    </section>
    ${budgetViewSwitcher()}
    ${view}
    ${budgetTotalizadores(budget, items)}`;
}

// Modal de cadastro de etapa do orçamento.
function openBudgetEtapaForm(budget, etapa) {
  if (!canEditModule("workBudgets")) return;
  const dialog = document.createElement("dialog");
  dialog.className = "agenda-detail-dialog";
  dialog.innerHTML = `
    <div class="modal-box exec-update-box">
      <h3>${etapa ? "Editar" : "Nova"} etapa</h3>
      <label>Nome da etapa<input id="etNome" value="${escapeHtml(etapa?.nome || "")}" placeholder="Ex.: Fundação"></label>
      <label>Código (opcional)<input id="etCodigo" value="${escapeHtml(etapa?.codigo || "")}" placeholder="Ex.: 1"></label>
      <label>BDI específico % (opcional — vazio usa o BDI geral)<input id="etBdi" inputmode="decimal" value="${etapa && etapa.bdi_especifico != null ? escapeHtml(String(etapa.bdi_especifico).replace(".", ",")) : ""}"></label>
      <div class="agenda-detail-actions">
        <button type="button" class="primary" id="etSalvar">Salvar</button>
        <button type="button" class="secondary" data-close>Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  const close = () => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); };
  dialog.querySelector("[data-close]")?.addEventListener("click", close);
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dialog.querySelector("#etSalvar").addEventListener("click", async () => {
    const nome = dialog.querySelector("#etNome").value.trim();
    if (!nome) { alert("Informe o nome da etapa."); return; }
    const bdiRaw = dialog.querySelector("#etBdi").value.trim();
    const data = {
      orcamento_id: budget.id,
      obra_id: budget.projectId || "",
      nome,
      codigo: dialog.querySelector("#etCodigo").value.trim(),
      ordem: etapa?.ordem || (budgetEtapas(budget.id).length + 1),
      bdi_especifico: bdiRaw !== "" ? parseMoneyInput(bdiRaw) : "",
    };
    try {
      if (etapa) await updateIntegratedRecord("orcamentoEtapas", etapa.id, data);
      else await createIntegratedRecord("orcamentoEtapas", data);
      close();
      if (serverMode) await refreshAndRender(); else render();
    } catch (error) { alert(`Não foi possível salvar a etapa: ${error.message}`); }
  });
  dialog.showModal();
}

async function removeBudgetEtapa(etapaId) {
  const etapa = byId("orcamentoEtapas", etapaId);
  if (!etapa) return;
  if (!confirm(`Remover a etapa "${etapa.nome}"? Os itens dela ficarão sem etapa (não serão excluídos).`)) return;
  try {
    // Solta os itens da etapa antes de removê-la.
    const its = (db.workBudgetItems || []).filter((it) => sameId(it.etapa_id, etapaId));
    for (const it of its) {
      if (serverMode) await apiRequest(`${apiResources.workBudgetItems}/${it.id}`, { method: "PUT", body: JSON.stringify({ etapa_id: "" }) }).catch(() => {});
      else { it.etapa_id = ""; }
    }
    await removeRecord("orcamentoEtapas", etapaId);
  } catch (error) { alert(`Não foi possível remover a etapa: ${error.message}`); }
}

// Modal "Adicionar item" com 3 abas: SINAPI · Composição própria · Manual.
function openBudgetItemModal(budget, etapaId) {
  if (!canEditModule("workBudgets")) return;
  let tab = "sinapi";
  let picked = null;
  const dialog = document.createElement("dialog");
  dialog.className = "agenda-detail-dialog budget-item-dialog";
  document.body.appendChild(dialog);
  const close = () => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); };
  const tipoOptions = BUDGET_TIPOS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  const ccOptions = '<option value="">Herda da obra</option>' + (db.costCenters || []).filter((c) => c.status !== "Inativo").map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml((c.code ? c.code + " - " : "") + (c.name || ""))}</option>`).join("");

  const resultsHtml = (q) => {
    const list = tab === "sinapi" ? (db.sinapiCompositions || []) : (db.ownCompositions || []);
    const term = (q || "").toLowerCase();
    const filtered = list.filter((r) => !term || String(r.code || "").toLowerCase().includes(term) || String(r.description || "").toLowerCase().includes(term)).slice(0, 40);
    if (!filtered.length) return '<p class="muted">Nenhuma composição encontrada.</p>';
    return filtered.map((r) => {
      const valor = tab === "sinapi" ? Number(r.unitCost || 0) : Number(r.suggestedPrice || r.estimatedCost || 0);
      const ref = tab === "sinapi" ? byId("sinapiReferences", r.sinapiReferenceId) || r : {};
      const refLabel = tab === "sinapi" ? ` · ${escapeHtml(ref.uf || r.uf || "")} ${String(ref.referenceMonth || r.referenceMonth || "").padStart(2, "0")}/${escapeHtml(ref.referenceYear || r.referenceYear || "")} ${escapeHtml(ref.priceType || r.priceType || r.referenceType || "")}` : "";
      return `<button type="button" class="budget-item-result" data-pick="${escapeHtml(r.id)}">${escapeHtml((r.code ? r.code + " - " : "") + (r.description || ""))} <span class="muted">${escapeHtml(r.unit || "")} · ${asMoney(valor)}${refLabel}</span></button>`;
    }).join("");
  };
  const tabHtml = () => {
    if (tab === "manual") return `
      <div class="form-grid">
        <label>Código<input id="biCodigo" placeholder="1.1.001"></label>
        <label>Descrição<input id="biDesc" placeholder="Descrição do item"></label>
        <label>Unidade<input id="biUnid" value="un"></label>
      </div>`;
    return `<input id="biSearch" class="budget-item-search" placeholder="Buscar por código ou descrição…"><div class="budget-item-results" id="biResults">${resultsHtml("")}</div>`;
  };

  const recompute = () => {
    const qtd = parseMoneyInput(dialog.querySelector("#biQtd")?.value || "0");
    const vu = parseMoneyInput(dialog.querySelector("#biVu")?.value || "0");
    const totalEl = dialog.querySelector("#biTotal");
    if (totalEl) totalEl.textContent = asMoney(qtd * vu);
  };

  const paint = () => {
    dialog.innerHTML = `
      <div class="modal-box budget-item-box">
        <h3>Adicionar item ao orçamento</h3>
        <nav class="cc-tabs">
          <button type="button" class="${tab === "sinapi" ? "active" : ""}" data-bi-tab="sinapi">Buscar SINAPI</button>
          <button type="button" class="${tab === "propria" ? "active" : ""}" data-bi-tab="propria">Composição Própria</button>
          <button type="button" class="${tab === "manual" ? "active" : ""}" data-bi-tab="manual">Item Manual</button>
        </nav>
        <div class="budget-item-tab">${tabHtml()}</div>
        <div class="budget-item-common">
          <label>Tipo<select id="biTipo">${tipoOptions}</select></label>
          <label>Centro de custo<select id="biCc">${ccOptions}</select></label>
          <label>Quantidade<input id="biQtd" inputmode="decimal" value="1"></label>
          <label>Valor unitário (R$)<input id="biVu" inputmode="decimal" value="0,00"></label>
          <div class="budget-item-total">Total: <strong id="biTotal">${asMoney(0)}</strong></div>
        </div>
        <div class="agenda-detail-actions">
          <button type="button" class="primary" id="biSalvar">Adicionar ao orçamento</button>
          <button type="button" class="secondary" data-close>Cancelar</button>
        </div>
      </div>`;
    dialog.querySelectorAll("[data-bi-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.biTab; picked = null; paint(); }));
    dialog.querySelector("[data-close]")?.addEventListener("click", close);
    dialog.querySelector("#biSalvar")?.addEventListener("click", salvar);
    dialog.querySelector("#biQtd")?.addEventListener("input", recompute);
    dialog.querySelector("#biVu")?.addEventListener("input", recompute);
    const search = dialog.querySelector("#biSearch");
    if (search) {
      let biSearchTimer = null;
      search.addEventListener("input", () => {
        const q = search.value;
        dialog.querySelector("#biResults").innerHTML = resultsHtml(q);
        wirePick();
        // O cache local traz só uma amostra (bootstrap). Para a aba SINAPI, busca a
        // base COMPLETA no servidor (endpoint instantâneo) e mescla os resultados.
        if (tab === "sinapi" && q.trim().length >= 2) {
          clearTimeout(biSearchTimer);
          biSearchTimer = setTimeout(async () => {
            try {
              const payload = await apiRequest(`sinapi-buscar?q=${encodeURIComponent(q.trim())}`);
              const rows = payload?.data || [];
              if (rows.length) {
                db.sinapiCompositions = db.sinapiCompositions || [];
                const known = new Set(db.sinapiCompositions.map((r) => String(r.id)));
                rows.forEach((r) => { if (!known.has(String(r.id))) db.sinapiCompositions.push(r); });
                if (search.value === q) { dialog.querySelector("#biResults").innerHTML = resultsHtml(q); wirePick(); }
              }
            } catch { /* mantém os resultados locais se o servidor falhar */ }
          }, 300);
        }
      });
    }
    wirePick();
    recompute();
  };
  const wirePick = () => {
    dialog.querySelectorAll("[data-pick]").forEach((btn) => btn.addEventListener("click", () => {
      const list = tab === "sinapi" ? (db.sinapiCompositions || []) : (db.ownCompositions || []);
      const r = list.find((x) => sameId(x.id, btn.dataset.pick));
      if (!r) return;
      picked = r;
      const vu = tab === "sinapi" ? Number(r.unitCost || 0) : Number(r.suggestedPrice || r.estimatedCost || 0);
      dialog.querySelector("#biVu").value = formatMoneyInput(vu);
      dialog.querySelectorAll(".budget-item-result").forEach((el) => el.classList.remove("picked"));
      btn.classList.add("picked");
      recompute();
    }));
  };

  const salvar = async () => {
    const qtd = parseMoneyInput(dialog.querySelector("#biQtd").value);
    const vu = parseMoneyInput(dialog.querySelector("#biVu").value);
    let descricao = "";
    let unidade = "un";
    let codigo = "";
    if (tab === "manual") {
      descricao = dialog.querySelector("#biDesc").value.trim();
      unidade = dialog.querySelector("#biUnid").value.trim() || "un";
      codigo = dialog.querySelector("#biCodigo").value.trim();
    } else {
      if (!picked) { alert("Selecione uma composição na lista."); return; }
      descricao = picked.description || "";
      unidade = picked.unit || "un";
      codigo = picked.code || "";
    }
    if (!descricao) { alert("Informe a descrição do item."); return; }
    const data = {
      workBudgetId: budget.id,
      projectId: budget.projectId || "",
      etapa_id: etapaId || "",
      codigo,
      code: codigo,
      description: descricao,
      unit: unidade,
      quantity: qtd,
      unitCost: vu,
      totalCost: roundMoney(qtd * vu),
      bdiPercent: Number(budget.bdiPercent || 0),
      tipo: dialog.querySelector("#biTipo").value,
      costCenterId: dialog.querySelector("#biCc").value || "",
      origin: tab === "sinapi" ? "SINAPI" : (tab === "propria" ? "Própria" : "Manual"),
      sinapi_id: tab === "sinapi" && picked ? picked.id : "",
      sinapiReferenceId: tab === "sinapi" && picked ? (picked.sinapiReferenceId || "") : "",
      sinapiUf: tab === "sinapi" && picked ? (picked.uf || byId("sinapiReferences", picked.sinapiReferenceId)?.uf || "") : "",
      sinapiReferenceType: tab === "sinapi" && picked ? (picked.priceType || byId("sinapiReferences", picked.sinapiReferenceId)?.priceType || picked.referenceType || "") : "",
      notes: tab === "sinapi" && picked ? `Snapshot SINAPI: ${(picked.uf || byId("sinapiReferences", picked.sinapiReferenceId)?.uf || "")} ${String(picked.referenceMonth || byId("sinapiReferences", picked.sinapiReferenceId)?.referenceMonth || "").padStart(2, "0")}/${picked.referenceYear || byId("sinapiReferences", picked.sinapiReferenceId)?.referenceYear || ""} ${picked.priceType || byId("sinapiReferences", picked.sinapiReferenceId)?.priceType || picked.referenceType || ""}.` : "",
      sinapiSnapshotJson: tab === "sinapi" && picked ? JSON.stringify({
        codigo: codigo,
        descricao,
        unidade,
        custoUnitario: vu,
        referenciaMes: picked.referenceMonth || byId("sinapiReferences", picked.sinapiReferenceId)?.referenceMonth || "",
        referenciaAno: picked.referenceYear || byId("sinapiReferences", picked.sinapiReferenceId)?.referenceYear || "",
        uf: picked.uf || byId("sinapiReferences", picked.sinapiReferenceId)?.uf || "",
        tipoPrecoReferencia: picked.priceType || byId("sinapiReferences", picked.sinapiReferenceId)?.priceType || picked.referenceType || "",
      }) : "",
      composicao_propria_id: tab === "propria" && picked ? picked.id : "",
      ordem: (db.workBudgetItems || []).filter((it) => sameId(it.etapa_id, etapaId)).length + 1,
    };
    try {
      await createIntegratedRecord("workBudgetItems", data);
      close();
      if (serverMode) await refreshAndRender(); else render();
    } catch (error) { alert(`Não foi possível adicionar o item: ${error.message}`); }
  };

  dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  paint();
  dialog.showModal();
}

// Exporta o orçamento para CSV (uma linha por item + totalizadores).
function exportWorkBudgetCsv(budget, items) {
  if (!items.length) return alert("Sem itens para exportar.");
  const etapaNome = (id) => { const e = byId("orcamentoEtapas", id); return e ? (e.codigo ? e.codigo + " - " : "") + e.nome : ""; };
  const rows = items.map((it) => {
    const cost = budgetItemCost(it);
    const real = Number(it.quantidade_realizada || 0);
    const totalReal = real * Number(it.unitCost || 0);
    return {
      Etapa: etapaNome(it.etapa_id),
      "Código": it.codigo || it.code || "",
      "Descrição": it.description || "",
      Tipo: budgetTipoLabel(it.tipo),
      Unidade: it.unit || "",
      "Qtd Prevista": Number(it.quantity || 0),
      "Valor Unit.": Number(it.unitCost || 0),
      "Total Previsto": cost,
      "Qtd Realizada": real,
      "Total Realizado": totalReal,
      Saldo: cost - totalReal,
      "Centro de Custo": nameOf("costCenters", it.costCenterId) || "",
    };
  });
  const tot = budgetTotals(budget, items);
  const blank = Object.fromEntries(Object.keys(rows[0]).map((k) => [k, ""]));
  rows.push({ ...blank, "Descrição": "CUSTO DIRETO", "Total Previsto": tot.custoDireto });
  rows.push({ ...blank, "Descrição": `BDI (${Number(budget.bdiPercent || 0)}%)`, "Total Previsto": tot.bdiValor });
  rows.push({ ...blank, "Descrição": "TOTAL COM BDI", "Total Previsto": tot.totalComBdi });
  const obra = (nameOf("projects", budget.projectId) || budget.name || "obra").replace(/[^\w\-]+/g, "_");
  exportRowsCsv(rows, `Orcamento_${obra}_${new Date().toISOString().slice(0, 10)}.csv`);
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
    ${generateDocumentHeader("Orçamento de Obra", selected ? [selected.name, nameOf("projects", selected.projectId) || "Sem obra", asDate(selected.budgetDate)].filter(Boolean).join(" · ") : "Sem orçamento selecionado")}
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
    ${selected ? renderWorkBudgetStructure(selected, items, editable) : '<div class="empty">Sem dados para exibir</div>'}
    ${generateDocumentFooter()}
  `;
  qs("content").querySelectorAll("[data-exec-filter]").forEach((btn) => btn.addEventListener("click", () => { workBudgetItemFilter = btn.dataset.execFilter; render(); }));
  qs("execEstouroBtn")?.addEventListener("click", () => { workBudgetItemFilter = "estouro"; render(); });
  qs("content").querySelectorAll("[data-exec-update]").forEach((btn) => btn.addEventListener("click", () => openBudgetItemExecution(btn.dataset.execUpdate)));
  qs("content").querySelectorAll("[data-budget-view]").forEach((btn) => btn.addEventListener("click", () => { workBudgetView = btn.dataset.budgetView; render(); }));
  qs("content").querySelectorAll("[data-add-item-etapa]").forEach((btn) => btn.addEventListener("click", () => { if (selected) openBudgetItemModal(selected, btn.dataset.addItemEtapa); }));
  qs("content").querySelectorAll("[data-etapa-edit]").forEach((btn) => btn.addEventListener("click", () => { if (selected) openBudgetEtapaForm(selected, byId("orcamentoEtapas", btn.dataset.etapaEdit)); }));
  qs("content").querySelectorAll("[data-etapa-remove]").forEach((btn) => btn.addEventListener("click", () => removeBudgetEtapa(btn.dataset.etapaRemove)));
  qs("budgetNovaEtapa")?.addEventListener("click", () => { if (selected) openBudgetEtapaForm(selected); });
  qs("budgetPrint")?.addEventListener("click", () => window.print());
  qs("budgetExportCsv")?.addEventListener("click", () => { if (selected) exportWorkBudgetCsv(selected, items); });
  qs("budgetEditHeader")?.addEventListener("click", () => { if (selected) openForm("workBudgets", selected.id); });
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

// Tela de teste da integração com a IA local (Ollama). Autenticada como as demais:
// a chamada parte desta página logada (apiModuleRequest envia o token da sessão) e
// bate no endpoint ?module=ia&action=ping, que internamente chama ollama_generate e
// ollama_embed no servidor. O Ollama nunca é exposto à internet (127.0.0.1).
function renderIaTest() {
  const content = qs("content");
  content.innerHTML = `
    <section class="panel">
      <h3>Teste de Conexão IA (Ollama)</h3>
      <p class="field-hint">Valida a integração local com o Ollama — geração de texto (llama3.2:3b) e embeddings (all-minilm, dimensão esperada 384). A chamada é feita server-side, de 127.0.0.1 para 127.0.0.1; o Ollama nunca é exposto à internet.</p>
      ${serverMode ? "" : '<p class="empty">A IA local depende da API PHP no servidor. Em modo local (sem servidor) o teste não está disponível.</p>'}
      <div class="actions">
        <button class="primary" type="button" id="iaPingBtn" ${serverMode ? "" : "disabled"}>Testar conexão IA</button>
      </div>
      <div id="iaPingResult" class="hidden" style="margin-top:14px"></div>
    </section>`;
  qs("iaPingBtn")?.addEventListener("click", testIaConnection);
}

async function testIaConnection() {
  const btn = qs("iaPingBtn");
  const box = qs("iaPingResult");
  if (!btn || !box) return;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Testando…";
  box.classList.remove("hidden");
  box.innerHTML = '<p class="muted">Consultando o Ollama…</p>';
  try {
    // apiModuleRequest envia a sessão (token) e devolve o data {gen_ok, gen_response,
    // embed_ok, embed_dim}; se o Ollama estiver fora, a API responde success:false e
    // o apiModuleRequest lança com a mensagem clara (sem pendurar — curl tem timeout).
    const data = await apiModuleRequest("?module=ia&action=ping");
    const genOk = !!data.gen_ok;
    const embedOk = !!data.embed_ok;
    const dim = Number(data.embed_dim || 0);
    box.innerHTML = `
      <p><strong>Geração de texto:</strong> ${genOk ? "✅ OK" : "❌ falhou"}</p>
      ${genOk ? `<p class="muted">Resposta do modelo: ${escapeHtml(String(data.gen_response || "(vazia)"))}</p>` : ""}
      <p><strong>Embeddings:</strong> ${embedOk ? "✅ OK" : "❌ falhou"}</p>
      ${embedOk ? `<p class="muted">Dimensão do vetor: <strong>${dim}</strong> ${dim === 384 ? "(esperado: 384 ✅)" : "(esperado: 384 ⚠️)"}</p>` : ""}`;
  } catch (error) {
    box.innerHTML = `<p style="color:#b42318"><strong>❌ Ollama indisponível.</strong> ${escapeHtml(error.message || "Não foi possível conectar ao serviço de IA local.")}</p>`;
  } finally {
    btn.disabled = !serverMode;
    btn.textContent = original;
  }
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
    ${sinapiMonthlyImportHtml(settings, editable)}
    ${table("Referências SINAPI", references, ["uf", "referenceMonth", "referenceYear", "priceType", "source", "locationName", "issueDate", "status"], editable, "sinapiReferences")}
    ${["all", "inputs"].includes(sinapiSourceFilter) ? table("Insumos SINAPI", inputs.slice(0, 80), ["sinapiReferenceId", "referenceType", "uf", "classification", "code", "description", "unit", "priceOrigin", "unitPrice", "status"], canUseSinapi, "sinapiInputs") : ""}
    ${["all", "compositions"].includes(sinapiSourceFilter) ? table("Composições SINAPI", compositions.slice(0, 80), ["sinapiReferenceId", "referenceType", "uf", "groupName", "code", "description", "unit", "unitCost", "percentAS", "status"], canUseSinapi, "sinapiCompositions") : ""}
    ${sinapiSourceFilter === "labor" ? table("Mão de obra SINAPI", labor.slice(0, 80), ["sinapiReferenceId", "referenceType", "uf", "groupName", "compositionCode", "description", "unit", "laborPercent"], editable, "sinapiLabor") : ""}
    ${sinapiSourceFilter === "families" ? table("Famílias e coeficientes", families.slice(0, 80), ["sinapiReferenceId", "familyCode", "inputCode", "inputDescription", "unit", "category", "uf", "coefficient"], editable, "sinapiFamilies") : ""}
    ${sinapiSourceFilter === "maintenances" ? table("Manutenções SINAPI", maintenances.slice(0, 80), ["sinapiReferenceId", "referenceCode", "itemType", "code", "description", "maintenanceType"], editable, "sinapiMaintenances") : ""}
  `;
  qs("newRecord")?.addEventListener("click", () => openForm("sinapiReferences"));
  qs("sinapiPkgAnalyze")?.addEventListener("click", previewSinapiPackage);
  qs("sinapiPkgProcess")?.addEventListener("click", processSinapiPackage);
  qs("sinapiPkgFiles")?.addEventListener("change", (event) => {
    Array.from(event.target.files || []).forEach(detectSinapiReferenceFromFile);
  });
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
  qs("content").querySelectorAll("[data-sinapi-default]").forEach((button) => {
    button.addEventListener("click", () => activateSinapiReference(button.dataset.sinapiDefault));
  });
  if (serverMode) {
    loadSinapiReferenceHistory();
    resumeSinapiAsyncJob();
  }
}

function sinapiMonthlyImportHtml(settings, editable) {
  if (!isAdmin()) return `<section class="panel import-panel sinapi-locked"><h3>Importação mensal SINAPI</h3>${sinapiLockedNoticeHtml(false)}<div id="sinapiReferenceHistory" class="sinapi-history"></div></section>`;
  const typeOptions = ["Sem desoneração", "Com desoneração", "Sem encargos sociais"].map((type) => `<option ${settings.defaultReferenceType === type ? "selected" : ""}>${type}</option>`).join("");
  return `
    <section class="panel import-panel sinapi-monthly-panel">
      <h3>Importação mensal SINAPI</h3>
      <div class="form-grid">
        <label>UF<select id="sinapiPkgUf">${SINAPI_UFS.map((uf) => `<option value="${uf}" ${(settings.defaultUf || "MS") === uf ? "selected" : ""}>${uf}</option>`).join("")}</select></label>
        <label>Mês<input id="sinapiPkgMonth" type="number" min="1" max="12" value="${Number(settings.defaultReferenceMonth || 4)}"></label>
        <label>Ano<input id="sinapiPkgYear" type="number" min="2000" max="2100" value="${Number(settings.defaultReferenceYear || 2026)}"></label>
        <label>Tipo de preço/referência<select id="sinapiPkgType">${typeOptions}</select></label>
        <label class="full">Arquivos da competência<input id="sinapiPkgFiles" type="file" accept=".xlsx,.xls,.csv,.txt" multiple></label>
        <label>Reimportação<select id="sinapiPkgReplace"><option value="0">Manter/atualizar base existente</option><option value="1">Substituir a base desta referência</option></select></label>
      </div>
      <div class="actions">
        <button class="secondary" type="button" id="sinapiPkgAnalyze" ${editable && serverMode ? "" : "disabled"}>Analisar arquivos</button>
        <button class="primary" type="button" id="sinapiPkgProcess" disabled>Processar importação</button>
      </div>
      <p class="field-hint">Arquivos esperados: SINAPI_Referência_YYYY_MM.xlsx, SINAPI_mao_de_obra_YYYY_MM.xlsx, SINAPI_familias_e_coeficientes_YYYY_MM.xlsx e SINAPI_Manutenções_YYYY_MM.xlsx. Os originais ficam fora da pasta pública em /var/lib/financeiro/uploads/sinapi.</p>
      <div id="sinapiPackagePreview" class="empty hidden"></div>
      <div id="sinapiAsyncStatus" class="empty hidden"></div>
      <div id="sinapiReferenceHistory" class="sinapi-history"></div>
    </section>`;
}

async function previewSinapiPackage() {
  const input = qs("sinapiPkgFiles");
  const files = Array.from(input?.files || []);
  if (!files.length) return alert("Selecione os arquivos mensais SINAPI.");
  const form = new FormData();
  files.forEach((file) => form.append("files[]", file));
  form.append("uf", qs("sinapiPkgUf").value);
  form.append("referenceMonth", qs("sinapiPkgMonth").value);
  form.append("referenceYear", qs("sinapiPkgYear").value);
  form.append("referenceType", qs("sinapiPkgType").value);
  form.append("replaceExisting", qs("sinapiPkgReplace").value);
  const button = qs("sinapiPkgAnalyze");
  button.disabled = true;
  button.textContent = "Analisando…";
  try {
    const payload = await fetchForm("?module=sinapi&action=previewPacote", form);
    if (payload.success === false) throw new Error(payload.message || payload.error || "Prévia não gerada.");
    sinapiPackagePreview = payload.data || payload;
    renderSinapiPackagePreview(sinapiPackagePreview);
    const processButton = qs("sinapiPkgProcess");
    if (processButton) processButton.disabled = !(sinapiPackagePreview.jobId && serverMode);
  } catch (error) {
    alert(`Não foi possível analisar os arquivos SINAPI: ${error.message}`);
  } finally {
    button.disabled = !(isAdmin() && serverMode);
    button.textContent = "Analisar arquivos";
  }
}

function renderSinapiPackagePreview(data) {
  const box = qs("sinapiPackagePreview");
  if (!box) return;
  const rows = (data.preview || []).map((file) => ({
    arquivo: file.fileName,
    tipo: sinapiFileTypeLabel(file.fileType),
    competencia: `${String(file.referenceMonth || "").padStart(2, "0")}/${file.referenceYear || ""}`,
    uf: file.uf || "",
    preco: file.priceType || "",
    linhas: Number(file.rowsFound || 0).toLocaleString("pt-BR"),
    colunas: (file.columns || []).map((s) => `${s.sheet}: ${(s.columns || []).slice(0, 6).join(", ")}`).join(" | "),
    alertas: (file.alerts || []).join(" | "),
  }));
  const samples = (data.preview || []).flatMap((file) => (file.samples || []).slice(0, 2).map((sample) => ({ arquivo: file.fileName, recurso: sample.resource, registro: JSON.stringify(sample.data || {}) })));
  box.classList.remove("hidden");
  box.innerHTML = `
    <strong>Prévia do pacote</strong>
    ${table("Arquivos analisados", rows, ["arquivo", "tipo", "competencia", "uf", "preco", "linhas", "colunas", "alertas"])}
    ${samples.length ? table("Primeiros registros válidos", samples, ["arquivo", "recurso", "registro"]) : '<p class="muted">Nenhum registro válido encontrado.</p>'}
  `;
}

async function processSinapiPackage() {
  if (!sinapiPackagePreview?.jobId) return alert("Gere a prévia antes de processar.");
  if (!confirm("Processar a importação SINAPI desta competência?")) return;
  const replaceExisting = qs("sinapiPkgReplace")?.value === "1";
  const button = qs("sinapiPkgProcess");
  button.disabled = true;
  button.textContent = "Enviando para fila…";
  try {
    const payload = await apiModuleRequest("?module=sinapi&action=processarPacote", {
      method: "POST",
      body: JSON.stringify({ jobId: sinapiPackagePreview.jobId, replaceExisting }),
    });
    pollSinapiAsyncJob(payload.jobId || sinapiPackagePreview.jobId, { refreshOnDone: true });
  } catch (error) {
    alert(`Não foi possível processar a importação SINAPI: ${error.message}`);
    button.disabled = false;
    button.textContent = "Processar importação";
  }
}

async function loadSinapiReferenceHistory() {
  const box = qs("sinapiReferenceHistory");
  if (!box || !serverMode) return;
  try {
    const data = await apiModuleRequest("?module=sinapi&action=listarReferencias");
    renderSinapiReferenceHistory(data);
  } catch {
    box.innerHTML = "";
  }
}

function renderSinapiReferenceHistory(data) {
  const box = qs("sinapiReferenceHistory");
  if (!box) return;
  const refs = (data.references || []).slice(0, 20);
  const jobs = (data.jobs || []).slice(0, 10);
  box.innerHTML = `
    <h4>Histórico de referências</h4>
    <div class="table-wrap"><table><thead><tr><th>Competência</th><th>UF</th><th>Tipo</th><th>Importação</th><th>Linhas</th><th>Status</th><th>Padrão</th><th></th></tr></thead><tbody>
      ${refs.map((ref) => `<tr>
        <td>${String(ref.referenceMonth).padStart(2, "0")}/${svgText(ref.referenceYear)}</td>
        <td>${svgText(ref.uf || "")}</td>
        <td>${svgText(ref.priceType || "")}</td>
        <td>${svgText(ref.importDate || ref.createdAt || "")}</td>
        <td>${Number(ref.totalComposicoes || 0).toLocaleString("pt-BR")} comp. / ${Number(ref.totalInsumos || 0).toLocaleString("pt-BR")} ins.</td>
        <td>${svgText(ref.status || "")}</td>
        <td>${Number(ref.isDefault || 0) ? "Sim" : "Não"}</td>
        <td>${Number(ref.isDefault || 0) ? "" : `<button class="secondary" type="button" data-sinapi-default="${escapeHtml(ref.id)}">Definir padrão</button>`}
          <button class="secondary" type="button" data-sinapi-recalc="${escapeHtml(ref.id)}">Recalcular custos</button></td>
      </tr>`).join("") || '<tr><td colspan="8">Nenhuma referência importada.</td></tr>'}
    </tbody></table></div>
    <h4>Fila e tentativas recentes</h4>
    <div class="table-wrap"><table><thead><tr><th>Competência</th><th>UF</th><th>Tipo</th><th>Status</th><th>Linhas</th><th>Data</th></tr></thead><tbody>
      ${jobs.map((job) => `<tr><td>${String(job.referenceMonth || "").padStart(2, "0")}/${svgText(job.referenceYear || "")}</td><td>${svgText(job.uf || "")}</td><td>${svgText(job.referenceType || "")}</td><td>${sinapiJobStatusLabel(job.status)}</td><td>${Number(job.progress || 0).toLocaleString("pt-BR")} / ${Number(job.total || 0).toLocaleString("pt-BR")}</td><td>${svgText(String(job.createdAt || "").slice(0, 16))}</td></tr>`).join("") || '<tr><td colspan="6">Sem importações recentes.</td></tr>'}
    </tbody></table></div>`;
  box.querySelectorAll("[data-sinapi-default]").forEach((button) => {
    button.addEventListener("click", () => activateSinapiReference(button.dataset.sinapiDefault));
  });
  box.querySelectorAll("[data-sinapi-recalc]").forEach((button) => {
    button.addEventListener("click", () => recalcSinapiCosts(button.dataset.sinapiRecalc, button));
  });
}

// Pós-processamento: cruza os itens das composições com os preços dos insumos (e o
// custo das composições auxiliares) e grava unitPrice/totalCost/unitCost. Idempotente.
async function recalcSinapiCosts(id, button) {
  if (!id || !confirm("Recalcular o custo das composições desta referência cruzando os itens com os preços dos insumos? Pode levar alguns minutos.")) return;
  const original = button ? button.textContent : "";
  if (button) { button.disabled = true; button.textContent = "Recalculando…"; }
  try {
    const data = await apiModuleRequest("?module=sinapi&action=recalcularCustos", { method: "POST", body: JSON.stringify({ referenceId: id }) });
    const r = (data.references && data.references[0]) || data.summary || {};
    const sample = (r.missingSample || []).slice(0, 10).join(", ");
    alert(
      `Custos recalculados.\n\n` +
      `Composições: ${Number(r.compositions || 0).toLocaleString("pt-BR")}\n` +
      `Itens precificados: ${Number(r.itemsPriced || 0).toLocaleString("pt-BR")}\n` +
      `Itens sem preço: ${Number(r.itemsWithoutPrice || 0).toLocaleString("pt-BR")}\n` +
      `Passadas: ${Number(r.passes || 0)}` +
      (sample ? `\n\nSem preço (amostra): ${sample}` : "")
    );
    await loadSinapiReferenceHistory();
  } catch (error) {
    alert(`Não foi possível recalcular os custos: ${error.message}`);
  } finally {
    if (button) { button.disabled = false; button.textContent = original; }
  }
}

async function activateSinapiReference(id) {
  if (!id || !confirm("Definir esta referência SINAPI como padrão atual dos orçamentos?")) return;
  try {
    await apiModuleRequest("?module=sinapi&action=ativarReferencia", { method: "POST", body: JSON.stringify({ id }) });
    showToast("Referência SINAPI padrão atualizada.");
    await refreshAndRender();
  } catch (error) {
    alert(`Não foi possível ativar a referência: ${error.message}`);
  }
}

function sinapiFileTypeLabel(type) {
  return { reference: "Referência", labor: "Mão de obra", families: "Famílias/coeficientes", maintenance: "Manutenções" }[type] || "Referência";
}

function sinapiJobStatusLabel(status) {
  return { draft: "aguardando confirmação", queued: "aguardando", running: "processando", done: "concluído", error: "erro" }[status] || svgText(status || "");
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
        const packageButton = qs("sinapiPkgProcess");
        if (packageButton) {
          packageButton.disabled = !(isAdmin() && serverMode && sinapiPackagePreview?.jobId);
          packageButton.textContent = "Processar importação";
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
      const packageButton = qs("sinapiPkgProcess");
      if (packageButton) {
        packageButton.disabled = !(isAdmin() && serverMode && sinapiPackagePreview?.jobId);
        packageButton.textContent = "Processar importação";
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
  // PBQP-H Fase 1: certificações de fornecedores vencendo (30 dias) e materiais (FVM) com validade próxima.
  (db.suppliers || []).forEach((f) => {
    [["PBQP-H", f.pbqph_validade], ["ISO 9001", f.iso9001_validade]].forEach(([cert, val]) => {
      if (!val) return;
      const dias = Math.ceil((new Date(val) - new Date(hoje)) / 86400000);
      if (dias < 0) alertas.push(`❌ ${cert} do fornecedor ${f.name} venceu em ${val}.`);
      else if (dias <= 30) alertas.push(`⚠️ ${cert} do fornecedor ${f.name} vence em ${dias} dia(s).`);
    });
  });
  fvm.forEach((m) => {
    if (!m.validade) return;
    const dias = Math.ceil((new Date(m.validade) - new Date(hoje)) / 86400000);
    if (dias >= 0 && dias <= 30) alertas.push(`⚠️ Material ${m.materialNome}${m.lote ? " (lote " + m.lote + ")" : ""} vence em ${dias} dia(s).`);
  });

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
      <div class="q-pes-pdf">
        <strong>Procedimento em PDF (PBQP-H)</strong>
        ${row.id ? `
          ${row.arquivoPdf
            ? `<p class="muted">📎 ${svgText(row.arquivoNome || "procedimento.pdf")}${row.arquivoData ? " · " + asDate(row.arquivoData) : ""} <button type="button" class="secondary" id="qPesVerPdf">Visualizar PDF</button></p>`
            : '<p class="muted">Nenhum PDF anexado.</p>'}
          <label>${row.arquivoPdf ? "Substituir PDF" : "Anexar PDF do procedimento"}<input type="file" id="qPesPdfFile" accept="application/pdf,.pdf"></label>
          <button type="button" class="secondary" id="qPesUpPdf">Enviar PDF</button>`
          : '<p class="muted">Salve o PES para anexar o PDF do procedimento.</p>'}
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
  qs("qPesVerPdf")?.addEventListener("click", () => qPesAbrirPdf(qualidadeEdit?.id));
  qs("qPesUpPdf")?.addEventListener("click", () => qPesUploadPdf(qualidadeEdit?.id));
}

// PBQP-H Fase 1 — upload/visualização do PDF do procedimento (PES).
async function qPesUploadPdf(pesId) {
  if (!pesId) return alert("Salve o PES antes de anexar o PDF.");
  const file = qs("qPesPdfFile")?.files?.[0];
  if (!file) return alert("Selecione um arquivo PDF.");
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return alert("Apenas arquivos PDF são aceitos.");
  if (file.size > 10 * 1024 * 1024) return alert("PDF acima de 10 MB.");
  try {
    const form = new FormData();
    form.append("pesId", pesId);
    form.append("file", file);
    await fetchForm("?module=procedimentosExecucao&action=uploadPdf", form);
    showToast("PDF do procedimento anexado.");
    await refreshAndRender();
  } catch (error) {
    alert(`Não foi possível enviar o PDF: ${error.message}`);
  }
}
async function qPesAbrirPdf(pesId) {
  if (!pesId) return;
  try {
    const resp = await fetch(`${API_BASE}/?module=procedimentosExecucao&action=downloadPdf&id=${encodeURIComponent(pesId)}`, { headers: authHeaders() });
    if (!resp.ok) throw new Error("PDF do procedimento não encontrado.");
    const url = URL.createObjectURL(await resp.blob());
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    alert(error.message);
  }
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

// PBQP-H Fase 1 — qualificação de fornecedores (status + certificações + avaliação).
const SUPPLIER_QUAL_STATUS = [
  ["nao_avaliado", "Não avaliado", "cinza"],
  ["aprovado", "Aprovado", "verde"],
  ["em_avaliacao", "Em avaliação", "amarelo"],
  ["suspenso", "Suspenso", "laranja"],
  ["reprovado", "Reprovado", "vermelho"],
];
function supplierQualMeta(value) {
  return SUPPLIER_QUAL_STATUS.find(([k]) => k === (value || "nao_avaliado")) || SUPPLIER_QUAL_STATUS[0];
}
function supplierQualBadge(value) {
  const [, label, cls] = supplierQualMeta(value);
  return `<span class="sup-qual sup-qual-${cls}">${label}</span>`;
}
function openSupplierQualificationForm(id) {
  if (!canEditModule("suppliers")) return;
  if (!serverMode) return alert("A qualificação de fornecedores requer conexão com o servidor.");
  const s = byId("suppliers", id);
  if (!s) return;
  const statusOpts = SUPPLIER_QUAL_STATUS.map(([v, l]) => `<option value="${v}" ${(s.pbqph_nivel || "nao_avaliado") === v ? "selected" : ""}>${l}</option>`).join("");
  const letraOpts = ["", "A", "B", "C", "D"].map((l) => `<option value="${l}" ${(s.pbqph_letra || "") === l ? "selected" : ""}>${l || "—"}</option>`).join("");
  const nota = (fid, val) => `<select id="${fid}"><option value="">—</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(val) === n ? "selected" : ""}>${"★".repeat(n)} (${n})</option>`).join("")}</select>`;
  const { close, q } = viabilidadeDialog(`
    <div class="viab-modal">
      <header class="viab-modal-head"><h3>Qualificação PBQP-H — ${escapeHtml(s.name || "")}</h3><button type="button" class="viab-x" data-close aria-label="Fechar">✕</button></header>
      <div class="viab-modal-body">
        <h4 class="q-subhead">Status de qualificação</h4>
        <div class="form-grid"><label>Status<select id="sqStatus">${statusOpts}</select></label></div>
        <h4 class="q-subhead">Certificações</h4>
        <div class="form-grid">
          <label>PBQP-H — nível<select id="sqLetra">${letraOpts}</select></label>
          <label>PBQP-H — validade<input type="date" id="sqPbqphVal" value="${escapeHtml((s.pbqph_validade || "").slice(0, 10))}"></label>
          <label class="sq-chk"><input type="checkbox" id="sqIso" ${Number(s.iso9001) ? "checked" : ""}> ISO 9001</label>
          <label>ISO 9001 — validade<input type="date" id="sqIsoVal" value="${escapeHtml((s.iso9001_validade || "").slice(0, 10))}"></label>
          <label class="sq-chk"><input type="checkbox" id="sqDatec" ${Number(s.datec) ? "checked" : ""}> DATec SiNAT</label>
          <label>DATec — número<input id="sqDatecNum" value="${escapeHtml(s.datec_numero || "")}"></label>
          <label class="sq-chk"><input type="checkbox" id="sqAbnt" ${Number(s.abnt_marca) ? "checked" : ""}> Marca de conformidade ABNT</label>
        </div>
        <h4 class="q-subhead">Avaliação de desempenho (1 a 5)</h4>
        <div class="form-grid">
          <label>Pontualidade nas entregas${nota("sqPont", s.avaliacao_pontualidade)}</label>
          <label>Qualidade dos produtos${nota("sqQual", s.avaliacao_qualidade)}</label>
          <label>Preço competitivo${nota("sqPreco", s.avaliacao_preco)}</label>
          <label>Responsável pela avaliação<input id="sqResp" value="${escapeHtml(s.avaliacao_responsavel || "")}"></label>
          <label>Data da avaliação<input type="date" id="sqData" value="${escapeHtml((s.avaliacao_data || "").slice(0, 10))}"></label>
        </div>
      </div>
      <footer class="viab-modal-foot"><button type="button" class="secondary" data-close>Cancelar</button><button type="button" class="primary" data-save>Salvar qualificação</button></footer>
    </div>`, "viab-dialog-md");
  q("[data-save]").addEventListener("click", async () => {
    try {
      const payload = {
        ...s,
        pbqph_nivel: q("#sqStatus").value,
        pbqph_letra: q("#sqLetra").value,
        pbqph_validade: q("#sqPbqphVal").value || null,
        iso9001: q("#sqIso").checked ? 1 : 0,
        iso9001_validade: q("#sqIsoVal").value || null,
        datec: q("#sqDatec").checked ? 1 : 0,
        datec_numero: q("#sqDatecNum").value,
        abnt_marca: q("#sqAbnt").checked ? 1 : 0,
        avaliacao_pontualidade: q("#sqPont").value || null,
        avaliacao_qualidade: q("#sqQual").value || null,
        avaliacao_preco: q("#sqPreco").value || null,
        avaliacao_responsavel: q("#sqResp").value,
        avaliacao_data: q("#sqData").value || null,
      };
      const res = await apiRequest(`${apiResources.suppliers}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      db.suppliers = db.suppliers.map((r) => sameId(r.id, id) ? (res.record || { ...r, ...payload }) : r);
      close();
      showToast("Qualificação do fornecedor atualizada.");
      render();
    } catch (error) {
      alert(`Erro ao salvar qualificação: ${error.message}`);
    }
  });
}

// PBQP-H Fase 1 — abre uma FVM já vinculada ao pedido de compra, pré-preenchida.
function abrirFvmDoPedido(poId) {
  const po = byId("purchaseOrders", poId);
  if (!po) return;
  if (!canEditModule("qualidadeFvm")) return alert("Sem permissão para registrar FVM.");
  const supplier = byId("suppliers", po.supplierId);
  qualidadeEdit = { key: "qualidadeFvm", id: null };
  qualidadeDraft = qFvmDraft(null);
  qualidadeDraft.projectId = po.projectId || "";
  qualidadeDraft.fornecedor = supplier?.name || "";
  qualidadeDraft.fabricante = supplier?.name || "";
  qualidadeDraft.purchaseOrderId = po.id;
  qualidadeDraft.dataRecebimento = qHoje();
  currentModule = "qualidadeFvm";
  render();
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
    // PBQP-H Fase 1 — rastreabilidade de lote + vínculo com pedido de compra.
    lote: row?.lote || "",
    fabricante: row?.fabricante || "",
    dataFabricacao: row?.dataFabricacao || "",
    validade: row?.validade || "",
    localAplicacao: row?.localAplicacao || "",
    certificadoQualidade: Number(row?.certificadoQualidade) ? 1 : 0,
    purchaseOrderId: row?.purchaseOrderId || "",
  };
}

// Selo de alerta de validade do material (vencido / vence em <= 30 dias).
function qFvmValidadeAlerta(validade) {
  if (!validade) return "";
  const dias = Math.ceil((new Date(validade) - new Date(qHoje())) / 86400000);
  if (dias < 0) return " " + qBadge("Vencido", "ruim");
  if (dias <= 30) return " " + qBadge(`Vence em ${dias} dia(s)`, "atencao");
  return "";
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
      <h4 class="q-subhead">Rastreabilidade (PBQP-H / SiNAT)</h4>
      <div class="form-grid">
        <label>Lote<input id="qFvmLote" value="${svgText(draft.lote)}"></label>
        <label>Fabricante<input id="qFvmFabricante" value="${svgText(draft.fabricante)}" placeholder="Fabricante do material"></label>
        <label>Data de fabricação<input id="qFvmDataFab" type="date" value="${svgText(draft.dataFabricacao)}"></label>
        <label>Validade${qFvmValidadeAlerta(draft.validade)}<input id="qFvmValidade" type="date" value="${svgText(draft.validade)}"></label>
        <label>Local de aplicação na obra<input id="qFvmLocal" list="qFvmLocalSug" value="${svgText(draft.localAplicacao)}" placeholder="Ex.: Bloco A - 2 pav. - fachada norte"><datalist id="qFvmLocalSug">${["Fundação", "Estrutura", "Alvenaria", "Cobertura", "Elétrica", "Hidráulica", "Revestimento", "Acabamento"].map((s) => `<option value="${s}">`).join("")}</datalist></label>
        <label>Certificado de qualidade recebido<select id="qFvmCert">${[["0", "Não"], ["1", "Sim"]].map(([v, l]) => `<option value="${v}" ${Number(draft.certificadoQualidade) === Number(v) ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Pedido de compra vinculado<select id="qFvmPedido"><option value="">— Nenhum —</option>${(db.purchaseOrders || []).map((po) => `<option value="${escapeHtml(po.id)}" ${sameId(po.id, draft.purchaseOrderId) ? "selected" : ""}>${escapeHtml(po.number || po.id)}</option>`).join("")}</select></label>
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
    d.lote = qVal("qFvmLote");
    d.fabricante = qVal("qFvmFabricante");
    d.dataFabricacao = qVal("qFvmDataFab");
    d.validade = qVal("qFvmValidade");
    d.localAplicacao = qVal("qFvmLocal");
    d.certificadoQualidade = Number(qVal("qFvmCert")) ? 1 : 0;
    d.purchaseOrderId = qVal("qFvmPedido");
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
      lote: d.lote,
      fabricante: d.fabricante,
      dataFabricacao: d.dataFabricacao || null,
      validade: d.validade || null,
      localAplicacao: d.localAplicacao,
      certificadoQualidade: d.certificadoQualidade,
      purchaseOrderId: d.purchaseOrderId || null,
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
    || { id: crypto.randomUUID(), uf, referenceMonth, referenceYear, priceType: referenceType, source: "SINAPI/CAIXA", defaultUf: uf, locationName: "Campo Grande/MS", issueDate: "2026-05-12", availableTypes: "Sem desoneração; Com desoneração; Sem encargos sociais", importDate: new Date().toISOString().slice(0, 10), importUserId: currentUser?.id || "", status: "Ativo" };
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
    db[key].push({ id: crypto.randomUUID(), ...record });
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

// ─── Módulo de importação e comparação de cotações de fornecedores ──────────
let cotacaoOpenId = null;
let cotacaoDetail = null;
let cotacaoList = [];
const COTACAO_STATUS = { importada: ["Importada", "cinza"], comparada: ["Comparada", "amarelo"], aprovada: ["Aprovada", "verde"], reprovada: ["Reprovada", "vermelho"] };
const COTACAO_COMPARA = { nao_comparado: ["Sem correspondência", "cinza"], abaixo: ["Abaixo do orçado", "verde"], igual: ["Equivalente", "amarelo"], acima: ["Acima 5-20%", "laranja"], muito_acima: ["Muito acima >20%", "vermelho"] };
function cotacaoBadge(meta, key) {
  const [label, cls] = meta[key] || Object.values(meta)[0];
  return `<span class="sup-qual sup-qual-${cls}">${label}</span>`;
}
async function cotacaoApi(action, options = {}, extra = "") {
  return apiModuleRequest(`?module=cotacoes&action=${action}${extra}`, options);
}

function renderCotacoes() {
  if (cotacaoOpenId) return renderCotacaoDetalhe();
  return renderCotacaoLista();
}

async function renderCotacaoLista() {
  const content = qs("content");
  const editable = canEditModule("cotacoes");
  const head = `
    <section class="module-head">
      <div><h2>Cotações de Fornecedores</h2><p>Importe orçamentos em PDF, Excel (.xlsx/.xls) ou CSV e compare automaticamente com o orçamento da obra.</p></div>
      ${editable ? '<button class="primary" type="button" id="cotNova">+ Importar cotação</button>' : ""}
    </section>`;
  if (!serverMode) {
    content.innerHTML = head + '<div class="empty">O módulo de cotações requer conexão com o servidor.</div>';
    qs("cotNova")?.addEventListener("click", () => openCotacaoImport());
    return;
  }
  content.innerHTML = head + '<div class="empty">Carregando cotações…</div>';
  qs("cotNova")?.addEventListener("click", () => openCotacaoImport());
  let list;
  try {
    list = await cotacaoApi("list") || [];
  } catch (error) {
    content.innerHTML = head + `<div class="empty">Não foi possível carregar: ${svgText(error.message)}</div>`;
    qs("cotNova")?.addEventListener("click", () => openCotacaoImport());
    return;
  }
  if (currentModule !== "cotacoes" || cotacaoOpenId) return;
  cotacaoList = list;
  const vencendo = list.filter((c) => { if (!c.validade_cotacao) return false; const d = Math.ceil((new Date(c.validade_cotacao) - new Date()) / 86400000); return d >= 0 && d <= 7; });
  const rows = list.map((c) => `
    <tr>
      <td>${svgText(c.fornecedor_nome)}</td>
      <td>${c.obra_id ? svgText(nameOf("projects", c.obra_id) || "") : "—"}</td>
      <td>${svgText((c.arquivo_tipo || "").toUpperCase())}</td>
      <td>${Number(c.total_itens || 0)}</td>
      <td>${c.score != null ? Number(c.score).toFixed(0) + "%" : "—"}</td>
      <td>${cotacaoBadge(COTACAO_STATUS, c.status)}</td>
      <td>${asDate(c.created_at)}</td>
      <td><button class="secondary" type="button" data-open="${escapeHtml(c.id)}">Abrir</button></td>
    </tr>`).join("");
  content.innerHTML = `
    ${head}
    ${vencendo.length ? `<div class="alert alert-warning">⚠️ ${vencendo.length} cotação(ões) vencendo em até 7 dias.</div>` : ""}
    ${list.length
      ? `<section class="table-wrap"><table><thead><tr><th>Fornecedor</th><th>Obra</th><th>Tipo</th><th>Itens</th><th>Score</th><th>Status</th><th>Importada</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></section>`
      : '<div class="empty">Nenhuma cotação importada. Clique em "+ Importar cotação".</div>'}`;
  qs("cotNova")?.addEventListener("click", () => openCotacaoImport());
  content.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => abrirCotacao(el.dataset.open)));
}

async function abrirCotacao(id) {
  cotacaoOpenId = id;
  cotacaoDetail = null;
  qs("content").innerHTML = '<div class="empty">Carregando cotação…</div>';
  try {
    cotacaoDetail = await cotacaoApi("get", {}, `&id=${encodeURIComponent(id)}`);
  } catch (error) {
    qs("content").innerHTML = `<div class="empty">Erro: ${svgText(error.message)}</div>`;
    return;
  }
  if (currentModule === "cotacoes") renderCotacaoDetalhe();
}

function renderCotacaoDetalhe() {
  const c = cotacaoDetail;
  if (!c) return renderCotacaoLista();
  const editable = canEditModule("cotacoes");
  const itens = c.itens || [];
  const totalCotado = itens.reduce((s, i) => s + Number(i.valor_total || (Number(i.valor_unitario || 0) * Number(i.quantidade || 0)) || 0), 0);
  const linhas = itens.map((i) => `
    <tr>
      <td>${svgText(i.descricao)}</td>
      <td>${svgText(i.unidade || "")}</td>
      <td>${i.quantidade != null ? Number(i.quantidade).toLocaleString("pt-BR") : ""}</td>
      <td>${i.valor_unitario != null ? asMoney(i.valor_unitario) : "—"}</td>
      <td>${i.diferenca_percentual != null ? Number(i.diferenca_percentual).toFixed(1) + "%" : "—"}</td>
      <td>${cotacaoBadge(COTACAO_COMPARA, i.status_comparacao)}</td>
    </tr>`).join("");
  qs("content").innerHTML = `
    <section class="module-head">
      <div>
        <button class="secondary" type="button" id="cotVoltar">← Voltar</button>
        <h2>Cotação — ${svgText(c.fornecedor_nome)}</h2>
        <p>${c.obra_id ? "Obra: " + svgText(nameOf("projects", c.obra_id) || "—") + " · " : ""}${cotacaoBadge(COTACAO_STATUS, c.status)} · ${itens.length} itens · Total ${asMoney(totalCotado)}${c.score != null ? " · Score " + Number(c.score).toFixed(0) + "%" : ""}</p>
      </div>
      <div class="viab-detail-actions">
        ${editable ? '<button class="secondary" type="button" id="cotEditar">Editar itens</button>' : ""}
        ${editable ? '<button class="primary" type="button" id="cotComparar">Comparar com orçamento</button>' : ""}
        <button class="secondary" type="button" id="cotCsv">Exportar CSV</button>
        <button class="secondary" type="button" id="cotPdf">Imprimir comparativo</button>
      </div>
    </section>
    ${itens.length
      ? `<section class="table-wrap"><table><thead><tr><th>Descrição</th><th>Unid.</th><th>Qtd</th><th>Valor cotado</th><th>Dif. %</th><th>Situação</th></tr></thead><tbody>${linhas}</tbody></table></section>`
      : '<div class="empty">Nenhum item. Edite os itens (útil para PDFs com extração imprecisa).</div>'}`;
  qs("cotVoltar").addEventListener("click", () => { cotacaoOpenId = null; cotacaoDetail = null; renderCotacaoLista(); });
  qs("cotEditar")?.addEventListener("click", () => openCotacaoEditarItens());
  qs("cotComparar")?.addEventListener("click", () => cotacaoComparar());
  qs("cotCsv").addEventListener("click", () => cotacaoExportarCsv(c.id));
  qs("cotPdf").addEventListener("click", () => cotacaoImprimir());
}

function openCotacaoImport(prefill = {}) {
  if (!canEditModule("cotacoes")) return;
  if (!serverMode) return alert("Requer conexão com o servidor.");
  const projOpts = ['<option value="">— Sem obra —</option>'].concat((db.projects || []).map((p) => `<option value="${escapeHtml(p.id)}" ${sameId(p.id, prefill.obra_id) ? "selected" : ""}>${escapeHtml(p.name)}</option>`)).join("");
  const poOpts = ['<option value="">— Sem pedido —</option>'].concat((db.purchaseOrders || []).map((p) => `<option value="${escapeHtml(p.id)}" ${sameId(p.id, prefill.purchase_order_id) ? "selected" : ""}>${escapeHtml(p.number || p.id)}</option>`)).join("");
  const supOpts = (db.suppliers || []).map((s) => `<option value="${escapeHtml(s.name)}">`).join("");
  const { close, q } = viabilidadeDialog(`
    <div class="viab-modal">
      <header class="viab-modal-head"><h3>Importar cotação</h3><button type="button" class="viab-x" data-close>✕</button></header>
      <div class="viab-modal-body">
        <div class="form-grid">
          <label>Obra<select id="cotObra">${projOpts}</select></label>
          <label>Pedido de compra (opcional)<select id="cotPedido">${poOpts}</select></label>
          <label>Fornecedor<input id="cotForn" list="cotFornSug" placeholder="Nome do fornecedor"><datalist id="cotFornSug">${supOpts}</datalist></label>
          <label>Data da cotação<input type="date" id="cotData"></label>
          <label>Validade<input type="date" id="cotValidade"></label>
          <label>Arquivo (PDF, XLSX, XLS, CSV — máx 20MB)<input type="file" id="cotFile" accept=".pdf,.xlsx,.xls,.csv"></label>
        </div>
        <p class="muted">CSV é lido nativamente. .xlsx/.xls exigem a lib PhpSpreadsheet no servidor; PDF exige pdftotext (poppler-utils). Itens importados podem ser revisados antes de comparar.</p>
      </div>
      <footer class="viab-modal-foot"><button type="button" class="secondary" data-close>Cancelar</button><button type="button" class="primary" data-save>Importar</button></footer>
    </div>`, "viab-dialog-md");
  q("[data-save]").addEventListener("click", async () => {
    const file = q("#cotFile").files?.[0];
    const forn = q("#cotForn").value.trim();
    if (!forn) return alert("Informe o fornecedor.");
    if (!file) return alert("Selecione um arquivo.");
    if (file.size > 20 * 1024 * 1024) return alert("Arquivo acima de 20 MB.");
    const btn = q("[data-save]");
    btn.disabled = true;
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("fornecedor_nome", forn);
      if (q("#cotObra").value) form.append("obra_id", q("#cotObra").value);
      if (q("#cotPedido").value) form.append("purchase_order_id", q("#cotPedido").value);
      if (q("#cotData").value) form.append("data_cotacao", q("#cotData").value);
      if (q("#cotValidade").value) form.append("validade_cotacao", q("#cotValidade").value);
      const res = await fetchForm("?module=cotacoes&action=importar", form);
      const data = res?.data ?? res;
      close();
      showToast(res?.message || "Cotação importada.");
      if (data?.id) { cotacaoOpenId = data.id; cotacaoDetail = data; renderCotacoes(); }
      else renderCotacaoLista();
    } catch (error) {
      btn.disabled = false;
      alert(`Falha na importação: ${error.message}`);
    }
  });
}

function openCotacaoEditarItens() {
  if (!cotacaoDetail || !canEditModule("cotacoes")) return;
  const linhaInputs = (it = {}) => `
    <tr class="cot-edit-row">
      <td><input value="${escapeHtml(it.descricao || "")}" data-f="descricao"></td>
      <td><input value="${escapeHtml(it.unidade || "")}" data-f="unidade" size="5"></td>
      <td><input value="${escapeHtml(it.quantidade || "")}" data-f="quantidade" size="6"></td>
      <td><input value="${escapeHtml(it.valor_unitario || "")}" data-f="valor_unitario" size="8"></td>
      <td><input value="${escapeHtml(it.marca || "")}" data-f="marca" size="8"></td>
      <td><button type="button" class="danger cot-del-row">✕</button></td>
    </tr>`;
  const { close, q, dialog } = viabilidadeDialog(`
    <div class="viab-modal">
      <header class="viab-modal-head"><h3>Revisar itens da cotação</h3><button type="button" class="viab-x" data-close>✕</button></header>
      <div class="viab-modal-body">
        <table class="cot-edit-table"><thead><tr><th>Descrição</th><th>Un.</th><th>Qtd</th><th>V. unit.</th><th>Marca</th><th></th></tr></thead>
          <tbody id="cotEditBody">${(cotacaoDetail.itens || []).map(linhaInputs).join("") || linhaInputs()}</tbody></table>
        <button type="button" class="secondary" id="cotAddRow">+ Adicionar item</button>
      </div>
      <footer class="viab-modal-foot"><button type="button" class="secondary" data-close>Cancelar</button><button type="button" class="primary" data-save>Salvar itens</button></footer>
    </div>`, "viab-dialog-lg");
  const wire = () => dialog.querySelectorAll(".cot-del-row").forEach((b) => b.onclick = () => { b.closest("tr").remove(); });
  wire();
  q("#cotAddRow").addEventListener("click", () => { q("#cotEditBody").insertAdjacentHTML("beforeend", linhaInputs()); wire(); });
  q("[data-save]").addEventListener("click", async () => {
    const itens = [...dialog.querySelectorAll(".cot-edit-row")].map((tr) => {
      const o = {};
      tr.querySelectorAll("[data-f]").forEach((inp) => o[inp.dataset.f] = inp.value);
      return o;
    }).filter((o) => (o.descricao || "").trim());
    try {
      const data = await cotacaoApi("salvarItens", { method: "POST", body: JSON.stringify({ cotacao_id: cotacaoDetail.id, itens }) });
      cotacaoDetail = data;
      close();
      showToast("Itens salvos.");
      renderCotacaoDetalhe();
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  });
}

async function cotacaoComparar() {
  if (!cotacaoDetail) return;
  let obraId = cotacaoDetail.obra_id;
  if (!obraId) {
    const nome = prompt("Comparar com o orçamento de qual obra? Digite parte do nome:");
    if (!nome) return;
    const proj = (db.projects || []).find((p) => (p.name || "").toLowerCase().includes(nome.toLowerCase()));
    if (!proj) return alert("Obra não encontrada.");
    obraId = proj.id;
  }
  try {
    const data = await cotacaoApi("comparar", { method: "POST", body: JSON.stringify({ cotacao_id: cotacaoDetail.id, obra_id: obraId }) });
    cotacaoDetail = data;
    showToast("Comparação concluída.");
    renderCotacaoDetalhe();
  } catch (error) {
    alert(`Erro na comparação: ${error.message}`);
  }
}

async function cotacaoExportarCsv(id) {
  try {
    const resp = await fetch(`${API_BASE}/?module=cotacoes&action=exportarCsv&id=${encodeURIComponent(id)}`, { headers: authHeaders() });
    if (!resp.ok) throw new Error("Falha ao exportar.");
    const url = URL.createObjectURL(await resp.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparativo-cotacao-${id}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    alert(error.message);
  }
}

function cotacaoImprimir() {
  const c = cotacaoDetail;
  if (!c) return;
  const obra = c.obra_id ? nameOf("projects", c.obra_id) : "";
  const linhas = (c.itens || []).map((i) => {
    const [sit] = COTACAO_COMPARA[i.status_comparacao] || COTACAO_COMPARA.nao_comparado;
    return `<tr><td>${svgText(i.descricao)}</td><td>${svgText(i.unidade || "")}</td><td>${i.quantidade != null ? Number(i.quantidade).toLocaleString("pt-BR") : ""}</td><td>${i.valor_unitario != null ? asMoney(i.valor_unitario) : "—"}</td><td>${i.diferenca_percentual != null ? Number(i.diferenca_percentual).toFixed(1) + "%" : "—"}</td><td>${svgText(sit)}</td></tr>`;
  }).join("");
  const html = `
    <article class="doc-sheet">
      ${generateDocumentHeader("COMPARATIVO DE COTAÇÕES", [obra, c.fornecedor_nome, asDate(c.created_at)].filter(Boolean).join(" · "))}
      <section class="doc-block">
        <table class="doc-table"><thead><tr><th>Descrição</th><th>Un.</th><th>Qtd</th><th>Valor cotado</th><th>Dif. %</th><th>Situação</th></tr></thead><tbody>${linhas}</tbody></table>
      </section>
      ${generateDocumentFooter()}
    </article>`;
  openPrintDialog(html);
}

// ─── Módulo de Análise de Viabilidade por tipo de obra (frontend) ───────────
// Backend: ?module=viabilidade&action=...  (tabelas viabilidade_analises/_grupos/_itens/_anexos)
let viabilidadeObraOpenId = null;      // análise aberta no detalhe (null = listagem)
let viabilidadeObraDetail = null;      // análise completa carregada
let viabilidadeObraList = [];          // cache da listagem
const viabilidadeObraFilters = { tipo: "", status: "", periodo: "" };

// 3º elemento = nome do ícone Tabler (ti-<nome>).
const VIABILIDADE_TIPOS = [
  ["energia_solar", "Energia Solar", "sun"],
  ["obra_civil", "Obra Civil", "building-skyscraper"],
  ["eletrica", "Instalação Elétrica", "bolt"],
  ["ar_condicionado", "Ar Condicionado", "wind"],
  ["cobertura", "Cobertura e Telhado", "home"],
  ["hidraulica", "Hidráulica", "droplet"],
  ["manutencao", "Manutenção Predial", "tool"],
  ["outro", "Outro", "dots-circle-horizontal"],
];
const VIABILIDADE_STATUS = {
  em_andamento: ["Em andamento", "viab-st-andamento"],
  aprovada: ["Aprovada", "viab-st-aprovada"],
  bloqueada: ["Bloqueada", "viab-st-bloqueada"],
  concluida: ["Concluída", "viab-st-concluida"],
};
// Status do item: [label, ícone Tabler, classe de cor]. Cores (CSS): aprovado verde,
// em andamento amarelo, aguardando azul, reprovado vermelho, não iniciado cinza.
const VIABILIDADE_ITEM_STATUS = {
  nao_iniciado: ["Não iniciado", "circle", "viab-it-naoiniciado"],
  em_andamento: ["Em andamento", "clock", "viab-it-andamento"],
  aguardando_terceiro: ["Aguardando terceiro", "hourglass", "viab-it-aguardando"],
  aprovado: ["Aprovado", "circle-check", "viab-it-aprovado"],
  reprovado: ["Reprovado", "circle-x", "viab-it-reprovado"],
};
// Ícone Tabler por tipo de grupo de viabilidade.
const VIABILIDADE_GRUPO_ICONS = {
  tecnica: "tool",
  financeira: "currency-dollar",
  legal: "file-certificate",
  ambiental: "leaf",
  concessionaria: "building-community",
  operacional: "settings",
  mercado: "trending-up",
  risco: "alert-triangle",
};
// Ícone pequeno por conteúdo do item (1ª regra cujo padrão casa com a descrição).
const VIABILIDADE_ITEM_ICON_RULES = [
  [/estrutural|telhado/, "building"],
  [/sombreamento/, "shadow"],
  [/dimensionamento/, "ruler"],
  [/capacidade.*el[eé]tric|instala[cç][aã]o el[eé]tric/, "plug"],
  [/inversor/, "cpu"],
  [/solicita[cç][aã]o|acesso à rede/, "send"],
  [/aprova[cç][aã]o.*(concession|conex)|vistoria da concession/, "check"],
  [/medidor/, "replace"],
  [/payback/, "calendar-stats"],
  [/pagamento|financiamento/, "credit-card"],
  [/or[cç]amento/, "receipt"],
  [/\bart\b|\brrt\b/, "file-text"],
  [/alvar[aá]|licen[cç]a/, "license"],
  [/condom[ií]nio|autoriza[cç][aã]o/, "building-community"],
  [/solo|terreno|sondagem/, "layers"],
  [/topografia/, "map"],
  [/projeto aprovado|aprovado na prefeitura/, "file-check"],
  [/t[eé]rmica/, "temperature"],
  [/drenagem|pluvial|reservat[oó]rio|press[aã]o|tubula[cç]|esgoto/, "droplet"],
  [/laudo|diagn[oó]stico/, "clipboard-list"],
  [/vistoria/, "eye"],
  [/pbqp/, "award"],
  [/iso ?9001/, "certificate"],
  [/qualidade/, "shield-check"],
];

function viabilidadeTipoMeta(tipo) {
  return VIABILIDADE_TIPOS.find(([v]) => v === tipo) || ["outro", "Outro", "dots-circle-horizontal"];
}
function viabilidadeStatusMeta(status) {
  return VIABILIDADE_STATUS[status] || VIABILIDADE_STATUS.em_andamento;
}
function viabilidadeItemStatusMeta(status) {
  return VIABILIDADE_ITEM_STATUS[status] || VIABILIDADE_ITEM_STATUS.nao_iniciado;
}
function viabilidadeGrupoIcon(tipo) {
  return VIABILIDADE_GRUPO_ICONS[String(tipo || "").toLowerCase()] || "checklist";
}
function viabilidadeItemIcon(descricao) {
  const s = String(descricao || "").toLowerCase();
  for (const [re, ic] of VIABILIDADE_ITEM_ICON_RULES) {
    if (re.test(s)) return ic;
  }
  return "point";
}
// Ícone Tabler (webfont ti-*). aria-hidden: decorativo — o texto ao lado dá o significado.
function tiIcon(name, sizeClass = "viab-ti-16") {
  return `<i class="ti ti-${name} viab-ti ${sizeClass}" aria-hidden="true"></i>`;
}
function viabilidadeStatusBadge(status) {
  const [label, cls] = viabilidadeStatusMeta(status);
  return `<span class="viab-badge ${cls}">${label}</span>`;
}
function viabilidadeProgressBar(pct, extraClass = "") {
  const value = Math.max(0, Math.min(100, Number(pct || 0)));
  const tone = value >= 100 ? "viab-bar-green" : value >= 50 ? "viab-bar-blue" : value >= 1 ? "viab-bar-yellow" : "viab-bar-gray";
  return `<div class="viab-progress ${extraClass}"><span class="${tone}" style="width:${value}%"></span></div>`;
}
async function viabilidadeApi(action, options = {}, extra = "") {
  return apiModuleRequest(`?module=viabilidade&action=${action}${extra}`, options);
}

// Download de anexo via fetch autenticado (o token vai no header, não na URL).
async function downloadViabilidadeAnexo(id) {
  try {
    const resp = await fetch(`${API_BASE}/?module=viabilidade&action=download_anexo&id=${encodeURIComponent(id)}`, { headers: authHeaders() });
    if (!resp.ok) throw new Error("Não foi possível baixar o anexo.");
    const url = URL.createObjectURL(await resp.blob());
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    alert(error.message);
  }
}

function renderViabilidadeObra() {
  if (viabilidadeObraOpenId) return renderViabilidadeDetail();
  return renderViabilidadeList();
}

async function renderViabilidadeList() {
  const content = qs("content");
  const editable = canEditModule("viabilidadeObra");
  const head = `
    <section class="module-head">
      <div>
        <h2>Análise de Viabilidade</h2>
        <p>Checklist de viabilidade por tipo de obra: técnica, financeira, legal, concessionária e mais — bloqueia a proposta quando há item obrigatório reprovado.</p>
      </div>
      ${editable ? '<button class="primary" type="button" id="viabNova">+ Nova análise</button>' : ""}
    </section>`;
  if (!serverMode) {
    content.innerHTML = head + '<div class="empty">O módulo de viabilidade requer conexão com o servidor.</div>';
    qs("viabNova")?.addEventListener("click", () => openViabilidadeCreate());
    return;
  }
  content.innerHTML = head + '<div class="empty">Carregando análises…</div>';
  qs("viabNova")?.addEventListener("click", () => openViabilidadeCreate());
  let list;
  try {
    list = await viabilidadeApi("list") || [];
  } catch (error) {
    if (currentModule === "viabilidadeObra" && !viabilidadeObraOpenId) {
      content.innerHTML = head + `<div class="empty">Não foi possível carregar as análises: ${svgText(error.message)}</div>`;
      qs("viabNova")?.addEventListener("click", () => openViabilidadeCreate());
    }
    return;
  }
  if (currentModule !== "viabilidadeObra" || viabilidadeObraOpenId) return;
  viabilidadeObraList = Array.isArray(list) ? list : [];
  const now = Date.now();
  const periodCut = { "30": 30, "90": 90, "365": 365 }[viabilidadeObraFilters.periodo];
  const rows = viabilidadeObraList.filter((a) => {
    if (viabilidadeObraFilters.tipo && a.tipo_obra !== viabilidadeObraFilters.tipo) return false;
    if (viabilidadeObraFilters.status && a.status !== viabilidadeObraFilters.status) return false;
    if (periodCut) {
      const created = Date.parse((a.created_at || "").replace(" ", "T"));
      if (!Number.isNaN(created) && (now - created) > periodCut * 86400000) return false;
    }
    return true;
  });
  const tipoOptions = ['<option value="">Todos os tipos</option>']
    .concat(VIABILIDADE_TIPOS.map(([v, l]) => `<option value="${v}" ${v === viabilidadeObraFilters.tipo ? "selected" : ""}>${l}</option>`)).join("");
  const statusOptions = ['<option value="">Todos os status</option>']
    .concat(Object.entries(VIABILIDADE_STATUS).map(([v, [l]]) => `<option value="${v}" ${v === viabilidadeObraFilters.status ? "selected" : ""}>${l}</option>`)).join("");
  const periodoOptions = [["", "Todo o período"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["365", "Este ano"]]
    .map(([v, l]) => `<option value="${v}" ${v === viabilidadeObraFilters.periodo ? "selected" : ""}>${l}</option>`).join("");
  const cards = rows.map((a) => {
    const [tipoKey, tipoLabel, tipoIcon] = viabilidadeTipoMeta(a.tipo_obra);
    const obra = a.obra_id ? nameOf("projects", a.obra_id) : "";
    return `
      <article class="viab-card" data-open="${escapeHtml(a.id)}">
        <header class="viab-card-head">
          <span class="viab-tipo">${tiIcon(tipoIcon)} ${svgText(tipoLabel)}</span>
          ${viabilidadeStatusBadge(a.status)}
        </header>
        <h3>${svgText(a.nome || "Sem nome")}</h3>
        ${obra ? `<p class="muted">Obra: ${svgText(obra)}</p>` : ""}
        ${viabilidadeProgressBar(a.progresso_geral)}
        <div class="viab-card-foot">
          <span class="muted">${Number(a.progresso_geral || 0).toFixed(0)}% concluído</span>
          <span class="muted">${asDate(a.created_at)}</span>
        </div>
        <div class="viab-card-actions">
          <button class="secondary" type="button" data-open="${escapeHtml(a.id)}">Abrir</button>
          ${editable ? `<button class="secondary viab-del-btn" type="button" data-del="${escapeHtml(a.id)}" title="Excluir análise">${tiIcon("trash")} Excluir</button>` : ""}
        </div>
      </article>`;
  }).join("");
  content.innerHTML = `
    ${head}
    <section class="viab-filters">
      <label>Tipo de obra<select id="viabFiltroTipo">${tipoOptions}</select></label>
      <label>Status<select id="viabFiltroStatus">${statusOptions}</select></label>
      <label>Período<select id="viabFiltroPeriodo">${periodoOptions}</select></label>
    </section>
    ${rows.length ? `<section class="viab-grid">${cards}</section>` : '<div class="empty">Nenhuma análise de viabilidade para os filtros atuais.</div>'}
  `;
  qs("viabNova")?.addEventListener("click", () => openViabilidadeCreate());
  qs("viabFiltroTipo")?.addEventListener("change", (e) => { viabilidadeObraFilters.tipo = e.target.value; renderViabilidadeList(); });
  qs("viabFiltroStatus")?.addEventListener("change", (e) => { viabilidadeObraFilters.status = e.target.value; renderViabilidadeList(); });
  qs("viabFiltroPeriodo")?.addEventListener("change", (e) => { viabilidadeObraFilters.periodo = e.target.value; renderViabilidadeList(); });
  content.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => openViabilidadeAnalise(el.dataset.open)));
  content.querySelectorAll("[data-del]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); excluirViabilidadeAnalise(el.dataset.del); }));
}

// Exclui a análise inteira (cascata grupos/itens/anexos + arquivos), após confirmação.
async function excluirViabilidadeAnalise(id) {
  if (!id) return;
  if (!confirm("Excluir esta análise de viabilidade?\n\nEsta ação é IRREVERSÍVEL e remove todos os grupos, itens e anexos (inclusive os arquivos enviados) desta análise.")) return;
  try {
    await viabilidadeApi("delete", { method: "POST", body: JSON.stringify({ id }) });
    if (typeof showToast === "function") showToast("Análise excluída.");
    await renderViabilidadeList();
  } catch (error) {
    if (typeof showToast === "function") showToast(error.message || "Não foi possível excluir a análise."); else alert(error.message);
  }
}

async function openViabilidadeAnalise(id) {
  viabilidadeObraOpenId = id;
  viabilidadeObraDetail = null;
  qs("content").innerHTML = '<div class="empty">Carregando análise…</div>';
  try {
    viabilidadeObraDetail = await viabilidadeApi("get", {}, `&id=${encodeURIComponent(id)}`);
  } catch (error) {
    qs("content").innerHTML = `<div class="empty">Não foi possível abrir a análise: ${svgText(error.message)}</div>`;
    return;
  }
  if (currentModule === "viabilidadeObra") renderViabilidadeDetail();
}

function viabilidadeFlatItems(detail) {
  return (detail?.grupos || []).flatMap((g) => (g.itens || []).map((i) => ({ ...i, _grupo: g })));
}

function renderViabilidadeDetail() {
  const a = viabilidadeObraDetail;
  if (!a) return renderViabilidadeList();
  const editable = canEditModule("viabilidadeObra");
  const [, tipoLabel, tipoIcon] = viabilidadeTipoMeta(a.tipo_obra);
  const itens = viabilidadeFlatItems(a);
  const obrig = itens.filter((i) => Number(i.obrigatorio) === 1);
  const obrigConcluidos = obrig.filter((i) => i.status === "aprovado");
  const reprovados = obrig.filter((i) => i.status === "reprovado");
  const aguardando = itens.filter((i) => i.status === "aguardando_terceiro");
  const prazos = aguardando.map((i) => i.prazo).filter(Boolean).sort();
  const conclusao = reprovados.length ? "Bloqueada" : (Number(a.progresso_geral) >= 100 ? "Viável" : "Em análise");

  const blockBanner = reprovados.length ? `
    <div class="viab-block-banner">
      <strong>⚠️ ${reprovados.length} ${reprovados.length === 1 ? "item bloqueante reprovado" : "itens bloqueantes reprovados"} — a proposta não pode ser gerada até resolução.</strong>
      <ul>${reprovados.map((i) => `<li><button type="button" class="linklike" data-item="${escapeHtml(i.id)}">${svgText(i._grupo.nome)} · ${svgText(i.descricao)}</button></li>`).join("")}</ul>
    </div>` : "";

  const resumo = `
    <section class="viab-resumo">
      <div><span>Itens obrigatórios</span><strong>${obrigConcluidos.length} / ${obrig.length} concluídos</strong></div>
      <div><span>Bloqueantes pendentes</span><strong class="${reprovados.length ? "viab-danger" : ""}">${reprovados.length}</strong></div>
      <div><span>Aguardando terceiro</span><strong>${aguardando.length}${prazos.length ? ` · prazo ${asDate(prazos[0])}` : ""}</strong></div>
    </section>`;

  const grupos = (a.grupos || []).map((g) => {
    const itensHtml = (g.itens || []).map((i) => {
      const [stLabel, stIcon, stCls] = viabilidadeItemStatusMeta(i.status);
      const contentIcon = viabilidadeItemIcon(i.descricao);
      const detalhe = [
        i.status === "aguardando_terceiro" && i.prazo ? `prazo ${asDate(i.prazo)}` : "",
        i.terceiro_nome ? svgText(i.terceiro_nome) : "",
        (i.anexos || []).length ? `📎 ${i.anexos.length}` : "",
      ].filter(Boolean).join(" · ");
      return `
        <li class="viab-item">
          <span class="viab-item-icon" title="${svgText(stLabel)}">${tiIcon(contentIcon, "viab-ti-14 viab-ti-muted")}</span>
          <span class="viab-item-desc">
            ${svgText(i.descricao)}
            ${Number(i.obrigatorio) === 1 ? '<span class="viab-mini-tag">obrigatório</span>' : ""}
            ${detalhe ? `<small class="muted">${detalhe}</small>` : ""}
          </span>
          <span class="viab-badge ${stCls}">${tiIcon(stIcon, "viab-ti-12")} ${stLabel}</span>
          ${editable ? `<button class="secondary" type="button" data-item="${escapeHtml(i.id)}">Atualizar</button>` : ""}
        </li>`;
    }).join("");
    return `
      <section class="viab-grupo">
        <header class="viab-grupo-head">
          <div>
            <h3>${tiIcon(viabilidadeGrupoIcon(g.tipo), "viab-ti-18")} ${svgText(g.nome)}</h3>
            <span class="viab-mini-tag ${Number(g.obrigatorio) === 1 ? "viab-tag-obrig" : "viab-tag-opc"}">${Number(g.obrigatorio) === 1 ? "Obrigatório" : "Opcional"}</span>
          </div>
          <div class="viab-grupo-prog">${viabilidadeProgressBar(g.progresso)}<span class="muted">${Number(g.progresso || 0).toFixed(0)}%</span></div>
        </header>
        <ul class="viab-itens">${itensHtml || '<li class="muted">Nenhum item neste grupo.</li>'}</ul>
        ${editable ? `<button class="secondary viab-add-item" type="button" data-add-item="${escapeHtml(g.id)}">+ Adicionar item ao grupo</button>` : ""}
      </section>`;
  }).join("");

  qs("content").innerHTML = `
    <section class="module-head viab-detail-head">
      <div>
        <button class="secondary" type="button" id="viabVoltar">← Voltar</button>
        <h2>${svgText(a.nome)}</h2>
        <p><span class="viab-tipo">${tiIcon(tipoIcon)} ${svgText(tipoLabel)}</span> ${viabilidadeStatusBadge(a.status)} ${a.obra_id ? "· Obra: " + svgText(nameOf("projects", a.obra_id) || "—") : ""}</p>
      </div>
      <div class="viab-detail-actions">
        ${editable ? '<button class="secondary" type="button" id="viabEditar">Editar</button>' : ""}
        <button class="secondary" type="button" id="viabImprimir">Imprimir relatório</button>
        ${editable ? '<button class="secondary" type="button" id="viabVincular">Vincular à proposta</button>' : ""}
      </div>
    </section>
    <section class="viab-progress-geral">
      <div class="viab-progress-geral-head"><strong>Progresso geral</strong><span>${Number(a.progresso_geral || 0).toFixed(0)}%</span></div>
      ${viabilidadeProgressBar(a.progresso_geral, "viab-progress-lg")}
    </section>
    ${blockBanner}
    ${resumo}
    <div class="viab-grupos">${grupos}</div>
    ${editable ? '<div class="viab-foot"><button class="primary" type="button" id="viabAddGrupo">+ Adicionar novo grupo</button></div>' : ""}
  `;
  qs("viabVoltar").addEventListener("click", () => { viabilidadeObraOpenId = null; viabilidadeObraDetail = null; renderViabilidadeList(); });
  qs("viabImprimir").addEventListener("click", () => printViabilidadeReport());
  qs("viabEditar")?.addEventListener("click", () => openViabilidadeEdit());
  qs("viabVincular")?.addEventListener("click", () => viabilidadeVincularProposta());
  qs("viabAddGrupo")?.addEventListener("click", () => openViabilidadeAddGrupo());
  qs("content").querySelectorAll("[data-item]").forEach((el) => el.addEventListener("click", () => openViabilidadeItemModal(el.dataset.item)));
  qs("content").querySelectorAll("[data-add-item]").forEach((el) => el.addEventListener("click", () => openViabilidadeAddItem(el.dataset.addItem)));
}

// Modal genérico do módulo: cria <dialog>, devolve helpers de fechar.
function viabilidadeDialog(innerHtml, className = "") {
  const dialog = document.createElement("dialog");
  dialog.className = `viab-dialog ${className}`.trim();
  dialog.innerHTML = innerHtml;
  document.body.appendChild(dialog);
  const close = () => { try { dialog.close(); } catch { /* já fechado */ } dialog.remove(); };
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dialog.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  dialog.showModal();
  return { dialog, close, q: (sel) => dialog.querySelector(sel) };
}

function openViabilidadeCreate(prefill = {}) {
  if (!canEditModule("viabilidadeObra")) return;
  if (!serverMode) return alert("O módulo de viabilidade requer conexão com o servidor.");
  let tipoSel = prefill.tipo_obra || "energia_solar";
  const projOptions = ['<option value="">— Sem obra —</option>']
    .concat((db.projects || []).map((p) => `<option value="${escapeHtml(p.id)}" ${sameId(p.id, prefill.obra_id) ? "selected" : ""}>${escapeHtml(p.name)}</option>`)).join("");
  const cliOptions = ['<option value="">— Sem cliente —</option>']
    .concat((db.clients || []).map((c) => `<option value="${escapeHtml(c.id)}" ${sameId(c.id, prefill.cliente_id) ? "selected" : ""}>${escapeHtml(c.name)}</option>`)).join("");
  const propOptions = ['<option value="">— Sem proposta —</option>']
    .concat((db.proposals || []).map((p) => `<option value="${escapeHtml(p.id)}" ${sameId(p.id, prefill.proposta_id) ? "selected" : ""}>${escapeHtml(p.number || p.id)}</option>`)).join("");
  const tabs = VIABILIDADE_TIPOS.map(([v, l, ic]) => `<button type="button" class="viab-tipo-tab ${v === tipoSel ? "active" : ""}" data-tipo="${v}">${tiIcon(ic, "viab-ti-24")}<span>${l}</span></button>`).join("");
  const { close, q, dialog } = viabilidadeDialog(`
    <div class="viab-modal">
      <header class="viab-modal-head"><h3>Nova análise de viabilidade</h3><button type="button" class="viab-x" data-close aria-label="Fechar">✕</button></header>
      <div class="viab-modal-body">
        <p class="muted">Selecione o tipo de obra — o checklist padrão (grupos e itens) é carregado automaticamente.</p>
        <div class="viab-tipo-tabs">${tabs}</div>
        <div class="form-grid">
          <label>Nome da análise<input name="nome" value="${escapeHtml(prefill.nome || "")}" placeholder="Ex.: Viabilidade UFV Cliente X"></label>
          <label>Obra/Projeto<select name="obra_id">${projOptions}</select></label>
          <label>Cliente<select name="cliente_id">${cliOptions}</select></label>
          <label>Proposta (opcional)<select name="proposta_id">${propOptions}</select></label>
        </div>
      </div>
      <footer class="viab-modal-foot"><button type="button" class="secondary" data-close>Cancelar</button><button type="button" class="primary" data-save>Criar análise</button></footer>
    </div>`, "viab-dialog-md");
  dialog.querySelectorAll("[data-tipo]").forEach((btn) => btn.addEventListener("click", () => {
    tipoSel = btn.dataset.tipo;
    dialog.querySelectorAll("[data-tipo]").forEach((b) => b.classList.toggle("active", b === btn));
  }));
  q("[data-save]").addEventListener("click", async () => {
    const nome = q('[name="nome"]').value.trim();
    if (!nome) return alert("Informe o nome da análise.");
    try {
      const data = await viabilidadeApi("create", {
        method: "POST",
        body: JSON.stringify({
          tipo_obra: tipoSel,
          nome,
          obra_id: q('[name="obra_id"]').value || null,
          cliente_id: q('[name="cliente_id"]').value || null,
          proposta_id: q('[name="proposta_id"]').value || null,
        }),
      });
      close();
      showToast("Análise de viabilidade criada.");
      viabilidadeObraDetail = data;
      viabilidadeObraOpenId = data?.id ?? null;
      renderViabilidadeObra();
    } catch (error) {
      alert(`Erro ao criar análise: ${error.message}`);
    }
  });
}

function openViabilidadeItemModal(itemId) {
  const item = viabilidadeFlatItems(viabilidadeObraDetail).find((i) => sameId(i.id, itemId));
  if (!item) return;
  const editable = canEditModule("viabilidadeObra");
  const statusOptions = Object.entries(VIABILIDADE_ITEM_STATUS)
    .map(([v, [l]]) => `<option value="${v}" ${v === item.status ? "selected" : ""}>${l}</option>`).join("");
  const anexosHtml = (item.anexos || []).length
    ? `<ul class="viab-anexos">${item.anexos.map((an) => `<li><button type="button" class="linklike" data-anexo="${escapeHtml(an.id)}">📎 ${svgText(an.nome_arquivo)}</button></li>`).join("")}</ul>`
    : '<p class="muted">Nenhum anexo.</p>';
  const { close, q, dialog } = viabilidadeDialog(`
    <div class="viab-modal">
      <header class="viab-modal-head"><h3>Atualizar item</h3><button type="button" class="viab-x" data-close aria-label="Fechar">✕</button></header>
      <div class="viab-modal-body">
        <p class="viab-item-title">${svgText(item.descricao)}</p>
        <div class="form-grid">
          <label>Status<select name="status" ${editable ? "" : "disabled"}>${statusOptions}</select></label>
          <label>Responsável pela verificação<input name="responsavel" value="${escapeHtml(item.responsavel || "")}" ${editable ? "" : "disabled"}></label>
          <label>Data de verificação<input type="date" name="data_verificacao" value="${escapeHtml((item.data_verificacao || "").slice(0, 10))}" ${editable ? "" : "disabled"}></label>
          <label>Prazo (aguardando terceiro)<input type="date" name="prazo" value="${escapeHtml((item.prazo || "").slice(0, 10))}" ${editable ? "" : "disabled"}></label>
          <label>Nome do terceiro<input name="terceiro_nome" value="${escapeHtml(item.terceiro_nome || "")}" placeholder="Ex.: ENERGISA, Prefeitura" ${editable ? "" : "disabled"}></label>
        </div>
        <label class="viab-block-label">Observações<textarea name="observacao" rows="4" ${editable ? "" : "disabled"}>${escapeHtml(item.observacao || "")}</textarea></label>
        <div class="viab-anexo-box">
          <strong>Anexos</strong>
          ${anexosHtml}
          ${editable ? '<label class="viab-file-label">Anexar documento (PDF, foto)<input type="file" name="arquivo" accept=".pdf,.png,.jpg,.jpeg,.webp"></label>' : ""}
        </div>
      </div>
      <footer class="viab-modal-foot">${editable ? '<button type="button" class="danger viab-foot-left" data-delete>Excluir item</button>' : ""}<button type="button" class="secondary" data-close>Fechar</button>${editable ? '<button type="button" class="primary" data-save>Salvar</button>' : ""}</footer>
    </div>`, "viab-dialog-md");
  dialog.querySelectorAll("[data-anexo]").forEach((b) => b.addEventListener("click", () => downloadViabilidadeAnexo(b.dataset.anexo)));
  q("[data-delete]")?.addEventListener("click", async () => {
    if (!confirm("Excluir este item do checklist?")) return;
    try {
      const data = await viabilidadeApi("delete_item", { method: "DELETE" }, `&id=${encodeURIComponent(item.id)}`);
      viabilidadeObraDetail = data;
      close();
      showToast("Item removido.");
      renderViabilidadeDetail();
    } catch (error) {
      alert(`Erro ao remover item: ${error.message}`);
    }
  });
  q("[data-save]")?.addEventListener("click", async () => {
    const saveBtn = q("[data-save]");
    saveBtn.disabled = true;
    try {
      const data = await viabilidadeApi("update_item", {
        method: "POST",
        body: JSON.stringify({
          item_id: item.id,
          status: q('[name="status"]').value,
          responsavel: q('[name="responsavel"]').value,
          data_verificacao: q('[name="data_verificacao"]').value,
          prazo: q('[name="prazo"]').value,
          terceiro_nome: q('[name="terceiro_nome"]').value,
          observacao: q('[name="observacao"]').value,
        }),
      });
      viabilidadeObraDetail = data;
      const file = q('[name="arquivo"]')?.files?.[0];
      if (file) {
        const form = new FormData();
        form.append("item_id", item.id);
        form.append("arquivo", file);
        const res = await fetchForm("?module=viabilidade&action=upload_anexo", form);
        const upData = res?.data ?? res;
        if (upData?.grupos) viabilidadeObraDetail = upData;
      }
      close();
      showToast("Item atualizado.");
      renderViabilidadeDetail();
    } catch (error) {
      saveBtn.disabled = false;
      alert(`Erro ao salvar item: ${error.message}`);
    }
  });
}

function openViabilidadeAddItem(grupoId) {
  if (!canEditModule("viabilidadeObra")) return;
  const { close, q } = viabilidadeDialog(`
    <div class="viab-modal">
      <header class="viab-modal-head"><h3>Adicionar item ao grupo</h3><button type="button" class="viab-x" data-close aria-label="Fechar">✕</button></header>
      <div class="viab-modal-body">
        <label class="viab-block-label">Descrição do item<input name="descricao" placeholder="Ex.: Verificação adicional"></label>
        <div class="form-grid">
          <label>Obrigatório?<select name="obrigatorio"><option value="1">Sim (bloqueia proposta)</option><option value="0">Não (opcional)</option></select></label>
          <label>Nome do terceiro (opcional)<input name="terceiro_nome" placeholder="Ex.: Prefeitura"></label>
        </div>
      </div>
      <footer class="viab-modal-foot"><button type="button" class="secondary" data-close>Cancelar</button><button type="button" class="primary" data-save>Adicionar</button></footer>
    </div>`, "viab-dialog-md");
  q("[data-save]").addEventListener("click", async () => {
    const descricao = q('[name="descricao"]').value.trim();
    if (!descricao) return alert("Informe a descrição do item.");
    try {
      const data = await viabilidadeApi("add_item", {
        method: "POST",
        body: JSON.stringify({ grupo_id: grupoId, descricao, obrigatorio: q('[name="obrigatorio"]').value, terceiro_nome: q('[name="terceiro_nome"]').value }),
      });
      viabilidadeObraDetail = data;
      close();
      showToast("Item adicionado.");
      renderViabilidadeDetail();
    } catch (error) {
      alert(`Erro ao adicionar item: ${error.message}`);
    }
  });
}

function openViabilidadeAddGrupo() {
  if (!canEditModule("viabilidadeObra") || !viabilidadeObraDetail) return;
  const tipoOpts = [["tecnica", "Técnica"], ["financeira", "Financeira"], ["legal", "Legal"], ["ambiental", "Ambiental"], ["concessionaria", "Concessionária"], ["operacional", "Operacional"], ["mercado", "Mercado"], ["outro", "Outro"]]
    .map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  const { close, q } = viabilidadeDialog(`
    <div class="viab-modal">
      <header class="viab-modal-head"><h3>Adicionar novo grupo</h3><button type="button" class="viab-x" data-close aria-label="Fechar">✕</button></header>
      <div class="viab-modal-body">
        <div class="form-grid">
          <label>Nome do grupo<input name="nome" placeholder="Ex.: Segurança"></label>
          <label>Tipo<select name="tipo">${tipoOpts}</select></label>
          <label>Obrigatório?<select name="obrigatorio"><option value="1">Sim</option><option value="0">Não</option></select></label>
        </div>
      </div>
      <footer class="viab-modal-foot"><button type="button" class="secondary" data-close>Cancelar</button><button type="button" class="primary" data-save>Adicionar</button></footer>
    </div>`, "viab-dialog-md");
  q("[data-save]").addEventListener("click", async () => {
    const nome = q('[name="nome"]').value.trim();
    if (!nome) return alert("Informe o nome do grupo.");
    try {
      const data = await viabilidadeApi("add_grupo", {
        method: "POST",
        body: JSON.stringify({ analise_id: viabilidadeObraDetail.id, nome, tipo: q('[name="tipo"]').value, obrigatorio: q('[name="obrigatorio"]').value }),
      });
      viabilidadeObraDetail = data;
      close();
      showToast("Grupo adicionado.");
      renderViabilidadeDetail();
    } catch (error) {
      alert(`Erro ao adicionar grupo: ${error.message}`);
    }
  });
}

function openViabilidadeEdit() {
  if (!canEditModule("viabilidadeObra") || !viabilidadeObraDetail) return;
  const a = viabilidadeObraDetail;
  const statusOpts = Object.entries(VIABILIDADE_STATUS).map(([v, [l]]) => `<option value="${v}" ${v === a.status ? "selected" : ""}>${l}</option>`).join("");
  const { close, q } = viabilidadeDialog(`
    <div class="viab-modal">
      <header class="viab-modal-head"><h3>Editar análise</h3><button type="button" class="viab-x" data-close aria-label="Fechar">✕</button></header>
      <div class="viab-modal-body">
        <div class="form-grid">
          <label>Nome<input name="nome" value="${escapeHtml(a.nome || "")}"></label>
          <label>Status<select name="status">${statusOpts}</select></label>
        </div>
        <label class="viab-block-label">Observações<textarea name="observacoes" rows="4">${escapeHtml(a.observacoes || "")}</textarea></label>
      </div>
      <footer class="viab-modal-foot"><button type="button" class="secondary" data-close>Cancelar</button><button type="button" class="primary" data-save>Salvar</button></footer>
    </div>`, "viab-dialog-md");
  q("[data-save]").addEventListener("click", async () => {
    try {
      const data = await viabilidadeApi("update", {
        method: "PUT",
        body: JSON.stringify({ id: a.id, nome: q('[name="nome"]').value.trim(), status: q('[name="status"]').value, observacoes: q('[name="observacoes"]').value }),
      });
      viabilidadeObraDetail = data;
      close();
      showToast("Análise atualizada.");
      renderViabilidadeDetail();
    } catch (error) {
      alert(`Erro ao salvar: ${error.message}`);
    }
  });
}

async function viabilidadeVincularProposta() {
  if (!viabilidadeObraDetail) return;
  const reprovados = viabilidadeFlatItems(viabilidadeObraDetail).filter((i) => Number(i.obrigatorio) === 1 && i.status === "reprovado");
  if (reprovados.length) return alert("Não é possível aprovar: há itens obrigatórios reprovados. Resolva os bloqueios primeiro.");
  if (!confirm("Marcar esta análise como APROVADA para liberar a geração da proposta?")) return;
  try {
    const data = await viabilidadeApi("update", { method: "PUT", body: JSON.stringify({ id: viabilidadeObraDetail.id, status: "aprovada" }) });
    viabilidadeObraDetail = data;
    showToast("Viabilidade aprovada.");
    renderViabilidadeDetail();
  } catch (error) {
    alert(`Erro ao aprovar: ${error.message}`);
  }
}

function printViabilidadeReport() {
  const a = viabilidadeObraDetail;
  if (!a) return;
  const [, tipoLabel] = viabilidadeTipoMeta(a.tipo_obra);
  const cliente = a.cliente_id ? nameOf("clients", a.cliente_id) : "";
  const obra = a.obra_id ? nameOf("projects", a.obra_id) : "";
  const itens = viabilidadeFlatItems(a);
  const obrig = itens.filter((i) => Number(i.obrigatorio) === 1);
  const reprovados = obrig.filter((i) => i.status === "reprovado");
  const aguardando = itens.filter((i) => i.status === "aguardando_terceiro");
  const conclusao = reprovados.length ? "BLOQUEADA" : (Number(a.progresso_geral) >= 100 ? "VIÁVEL" : "EM ANÁLISE");
  const subtitulo = [tipoLabel, cliente, asDate(a.created_at)].filter(Boolean).join(" · ");
  const gruposHtml = (a.grupos || []).map((g) => `
    <section class="doc-block">
      <h3>${svgText(g.nome)} — ${Number(g.obrigatorio) === 1 ? "Obrigatório" : "Opcional"} · ${Number(g.progresso || 0).toFixed(0)}%</h3>
      <table class="doc-table">
        <thead><tr><th>Item</th><th>Status</th><th>Observações</th></tr></thead>
        <tbody>
          ${(g.itens || []).map((i) => {
            const [stLabel] = viabilidadeItemStatusMeta(i.status);
            const obs = [i.observacao, i.terceiro_nome ? `Terceiro: ${i.terceiro_nome}` : "", i.prazo ? `Prazo: ${asDate(i.prazo)}` : ""].filter(Boolean).join(" — ");
            return `<tr><td>${svgText(i.descricao)}${Number(i.obrigatorio) === 1 ? " *" : ""}</td><td>${stLabel}</td><td>${svgText(obs)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </section>`).join("");
  const aguardandoHtml = aguardando.length ? `
    <section class="doc-block">
      <h3>Itens aguardando terceiro</h3>
      <ul>${aguardando.map((i) => `<li>${svgText(i.descricao)} — ${svgText(i.terceiro_nome || "terceiro")}${i.prazo ? ` · prazo ${asDate(i.prazo)}` : ""}</li>`).join("")}</ul>
    </section>` : "";
  const html = `
    <article class="doc-sheet">
      ${generateDocumentHeader("RELATÓRIO DE ANÁLISE DE VIABILIDADE", subtitulo)}
      <section class="doc-block">
        <h2>${svgText(a.nome)}</h2>
        <div class="doc-kv">
          ${obra ? `<p><span class="doc-kv-label">Obra/Projeto:</span> ${svgText(obra)}</p>` : ""}
          ${cliente ? `<p><span class="doc-kv-label">Cliente:</span> ${svgText(cliente)}</p>` : ""}
          <p><span class="doc-kv-label">Tipo de obra:</span> ${svgText(tipoLabel)}</p>
        </div>
      </section>
      <section class="doc-block">
        <h3>Resumo executivo</h3>
        <p>Progresso geral: <strong>${Number(a.progresso_geral || 0).toFixed(0)}%</strong> · Itens obrigatórios concluídos: <strong>${obrig.filter((i) => i.status === "aprovado").length}/${obrig.length}</strong> · Itens bloqueantes: <strong>${reprovados.length}</strong></p>
        <p>Conclusão: <strong>${conclusao}</strong></p>
      </section>
      ${gruposHtml}
      ${aguardandoHtml}
      <section class="doc-block doc-signature">
        <p>____________________________________________</p>
        <p>Responsável técnico</p>
      </section>
      ${generateDocumentFooter()}
    </article>`;
  openPrintDialog(html);
}

// Gate de viabilidade antes de gerar uma proposta a partir do orçamento.
// Bloqueia se a análise da obra estiver bloqueada; oferece criar uma se não houver.
async function proposalViabilityGate(budget) {
  if (!serverMode || !budget.projectId) return true;
  let analyses = [];
  try {
    analyses = await viabilidadeApi("list", {}, `&obra_id=${encodeURIComponent(budget.projectId)}`) || [];
  } catch {
    return true; // falha de rede na checagem não deve impedir a geração
  }
  const bloqueadas = analyses.filter((a) => a.status === "bloqueada");
  if (bloqueadas.length) {
    alert(`⚠️ A análise de viabilidade desta obra está BLOQUEADA (itens obrigatórios reprovados).\n\nAnálise: ${bloqueadas[0].nome}\n\nResolva os bloqueios antes de gerar a proposta.`);
    return false;
  }
  if (!analyses.length) {
    const criar = confirm("Não há análise de viabilidade para esta obra.\n\nDeseja criar uma análise de viabilidade antes de gerar a proposta?\n\nOK = criar agora · Cancelar = pular e gerar a proposta");
    if (criar) {
      currentModule = "viabilidadeObra";
      viabilidadeObraOpenId = null;
      render();
      setTimeout(() => openViabilidadeCreate({ obra_id: budget.projectId, cliente_id: budget.clientId || "" }), 60);
      return false;
    }
    return true;
  }
  if (analyses.some((a) => a.status === "aprovada" || a.status === "concluida")) {
    showToast("✅ Viabilidade aprovada vinculada a esta obra.", 3500);
  }
  return true;
}

async function openProposalGenerator(workBudgetId) {
  const budget = enrichWorkBudget(byId("workBudgets", workBudgetId) || {});
  if (!budget.id) return alert("Selecione um orçamento de obra.");
  if (!canGenerateProposalForBudget(budget)) return alert("A proposta pode ser gerada para orçamentos em rascunho, em análise ou aprovados.");
  if (!(await proposalViabilityGate(budget))) return;
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
    // Grupos = orçamentos vinculados à proposta. O primeiro é o orçamento de origem.
    // bdi_grupo "" = automático (usa o preço do próprio orçamento, com BDI por etapa);
    // um número sobrepõe o BDI de todo o grupo (recalcula os preços a partir do custo).
    grupos: [{ budgetId: budget.id, nome_grupo: budget.name || `Orçamento ${budget.id}`, bdi_grupo: "", ordem: 0 }],
    // Formação do preço (BDI): auto = preço do orçamento; geral = um BDI p/ tudo (A);
    // grupo = BDI por orçamento (B); item = venda manual por item, BDI calculado (C/D).
    bdiMode: "auto",
    bdiGeral: Number(budget.bdiPercent || 0),
    itemOverrides: {},
    // Modo licitação: compara o ofertado com a referência SINAPI (custo × BDI de ref.).
    modoLicitacao: false,
    bdiReferencia: Number(budget.bdiPercent || 0) || 25,
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
  // Visão interna (custo + BDI + margem) só para perfis internos. O cliente nunca vê custo.
  const canSeeInternal = ["admin", "financeiro", "engenharia", "gestor_obra"].includes(currentUser?.role);
  qs("proposalGeneratorFields").innerHTML = `
    <section class="proposal-generator-form no-print">
      <div class="proposal-budget-summary">
        <strong>${svgText(proposal.number || "Proposta")}</strong>
        <span>${svgText(nameOf("clients", proposal.clientId) || "")}</span>
        <span>${asMoney(proposal.amount || 0)} - ${svgText(proposal.status || "")}</span>
      </div>
      ${canSeeInternal ? `<div class="proposal-view-toggle no-print">
        <button type="button" class="secondary active" id="proposalViewClient">Visão cliente</button>
        <button type="button" class="secondary" id="proposalViewInternal">Visão interna</button>
      </div>` : ""}
    </section>
  `;
  const showClient = () => {
    qs("proposalPreview").innerHTML = sanitizeStoredHtml(proposal.proposalBody);
    qs("proposalViewClient")?.classList.add("active");
    qs("proposalViewInternal")?.classList.remove("active");
  };
  showClient();
  if (canSeeInternal) {
    qs("proposalViewClient")?.addEventListener("click", showClient);
    qs("proposalViewInternal")?.addEventListener("click", () => {
      qs("proposalPreview").innerHTML = savedProposalInternalHtml(proposal);
      qs("proposalViewInternal")?.classList.add("active");
      qs("proposalViewClient")?.classList.remove("active");
    });
  }
  qs("proposalGeneratorDialog").showModal();
}

// Visão interna de uma proposta salva: tabela de custos/margem a partir dos itens
// persistidos (custo_unitario/bdi_item). Cai para o resumo do cabeçalho quando os
// itens não têm custo registrado (propostas geradas antes da v1.15.0). Uso interno.
function savedProposalInternalHtml(proposal) {
  const its = (db.proposalItems || []).filter((i) => sameId(i.proposalId, proposal.id));
  const vendaTotal = Number(proposal.amount || 0) || its.reduce((s, i) => s + Number(i.totalPrice || 0), 0);
  const custoTotal = Number(proposal.custo_total_orcamentos || 0)
    || its.reduce((s, i) => s + Number(i.custo_unitario || 0) * Number(i.quantity || 0), 0);
  const bdiTotal = Number(proposal.valor_bdi_total || 0) || Math.max(0, vendaTotal - custoTotal);
  const margemPct = vendaTotal > 0 ? (bdiTotal / vendaTotal) * 100 : 0;
  const rows = its.map((i, idx) => {
    const custoU = Number(i.custo_unitario || 0);
    const qtd = Number(i.quantity || 0);
    const custoT = custoU * qtd;
    const vendaT = Number(i.totalPrice || 0);
    const bdiPct = i.bdi_item != null && i.bdi_item !== "" ? Number(i.bdi_item) : (custoT > 0 ? ((vendaT - custoT) / custoT) * 100 : 0);
    return `<tr><td>${idx + 1}</td><td>${svgText(i.description || "")}</td><td>${svgText(i.unit || "")}</td><td>${formatQuantity(i.quantity)}</td><td>${asMoney(custoU)}</td><td>${asMoney(custoT)}</td><td>${asPercent(bdiPct)}</td><td>${asMoney(Number(i.unitPrice || 0))}</td><td>${asMoney(vendaT)}</td><td>${i.visibleToClient === "Não" ? "oculto" : "visível"}</td></tr>`;
  }).join("");
  return `<article class="proposal-page">
    <section class="proposal-section">
      <h2>Visão interna — custos e margem</h2>
      <p class="muted no-print">Uso interno. Não compartilhe esta visão com o cliente.</p>
      ${its.length ? `<table class="proposal-items-table">
        <thead><tr><th>Item</th><th>Descrição</th><th>Un.</th><th>Qtd.</th><th>Custo unit.</th><th>Custo total</th><th>BDI</th><th>Valor unit.</th><th>Valor total</th><th>Cliente</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : `<p class="muted">Itens detalhados sem custo registrado (proposta anterior à v1.15.0). Mostrando apenas o resumo.</p>`}
    </section>
    <section class="proposal-investment">
      <h2>Resumo financeiro interno</h2>
      <div><span>Custo total</span><strong>${asMoney(custoTotal)}</strong></div>
      <div><span>BDI / margem total</span><strong>${asMoney(bdiTotal)}</strong></div>
      <div><span>Valor de venda</span><strong>${asMoney(vendaTotal)}</strong></div>
      <div><span>Margem sobre venda</span><strong>${asPercent(margemPct)}</strong></div>
    </section>
  </article>`;
}

// Defesa em profundidade: o corpo da proposta é HTML gerado com campos já
// escapados, mas fica persistido no banco e é reinjetado aqui. Parseia num
// <template> inerte (scripts não executam, imagens não carregam) e remove
// qualquer conteúdo ativo antes de exibir, caso o registro tenha sido adulterado.
function sanitizeStoredHtml(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  tpl.content.querySelectorAll("script, iframe, object, embed").forEach((el) => el.remove());
  tpl.content.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const activeUrl = /^(href|src|xlink:href)$/.test(name) && /^\s*javascript:/i.test(attr.value);
      if (name.startsWith("on") || activeUrl) el.removeAttribute(attr.name);
    });
  });
  return tpl.innerHTML;
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
      <div id="proposalGroupsPanel"></div>
    </section>
  `;
  renderProposalGroupsPanel();
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
  // Preenchimento automático de dados do cliente também no gerador de propostas
  // (mesmo padrão global: indicador 🔄, painel de referência e "Ver cadastro").
  const genContainer = qs("proposalGeneratorFields");
  const genClientSelect = genContainer?.querySelector('select[name="clientId"]');
  if (genContainer && genClientSelect) setupClientAutofill(genContainer, genClientSelect);
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
  const calc = proposalGroupsCompute();
  const budgetForVars = { ...proposalGeneratorState.budget, totalPrice: calc.vendaTotal };
  const vars = proposalVariablesFor({ ...proposalGeneratorState, budget: budgetForVars, items: calc.combinedItems, model, project, client, input });
  qs("proposalPreview").innerHTML = proposalDocumentHtml({ ...proposalGeneratorState, budget: budgetForVars, items: calc.combinedItems, calc, model, project, client, input, vars, licitacao: proposalGeneratorState.modoLicitacao, refBdi: proposalGeneratorState.bdiReferencia });
}

// Calcula os grupos (orçamentos vinculados) da proposta: custo, venda e BDI efetivo
// de cada um, a lista combinada de itens (com preço efetivo por grupo) e os totais
// com BDI ponderado. bdi_grupo "" = automático (mantém o preço do orçamento, com BDI
// por etapa); número = sobrepõe o BDI do grupo inteiro recalculando do custo.
function proposalGroupsCompute() {
  const state = proposalGeneratorState;
  if (!state) return { grupos: [], combinedItems: [], custoTotal: 0, vendaTotal: 0, bdiPonderado: 0 };
  const mode = state.bdiMode || "auto";
  const geral = Number(state.bdiGeral || 0);
  const overrides = state.itemOverrides || {};
  const grupos = (state.grupos && state.grupos.length)
    ? state.grupos
    : [{ budgetId: state.budget.id, nome_grupo: state.budget.name, bdi_grupo: "", ordem: 0 }];
  const multi = grupos.length > 1;
  const computed = grupos.map((g, idx) => {
    const budget = enrichWorkBudget(byId("workBudgets", g.budgetId) || state.budget || {});
    const items = budgetItemsFor(g.budgetId, false);
    const custo = items.reduce((s, it) => s + Number(it.totalCost || 0), 0);
    // BDI do grupo conforme o modo. null = sem override (mantém o preço do orçamento).
    let groupBdi = null;
    if (mode === "geral") groupBdi = geral;
    else if (mode === "grupo") groupBdi = (g.bdi_grupo === "" || g.bdi_grupo == null || isNaN(Number(g.bdi_grupo))) ? null : Number(g.bdi_grupo);
    const effItems = items.map((it) => {
      const groupName = multi ? (g.nome_grupo || budget.name || "") : (it.stageName || it.groupName || "");
      const custoU = Number(it.unitCost || 0);
      const qty = Number(it.quantity || 0);
      let up = Number(it.unitPrice || 0);
      let bdiP = Number(it.bdiPercent || 0);
      if (groupBdi != null) { up = roundMoney(custoU * (1 + groupBdi / 100)); bdiP = groupBdi; }
      // Modo "item": venda manual por item tem prioridade; BDI vira o resultante.
      if (mode === "item" && overrides[it.id] != null && overrides[it.id] !== "") {
        up = roundMoney(Number(overrides[it.id]));
        bdiP = custoU > 0 ? ((up - custoU) / custoU) * 100 : 0;
      }
      return { ...it, unitPrice: up, totalPrice: roundMoney(qty * up), bdiPercent: bdiP, stageName: multi ? (g.nome_grupo || budget.name || "") : it.stageName, groupName, _grupoIdx: idx };
    });
    // Sem override de BDI nem manual: usa o total do orçamento (já com desconto/encargos).
    const venda = (groupBdi == null && mode !== "item")
      ? roundMoney(Number(budget.totalPrice || 0) || effItems.reduce((s, it) => s + Number(it.totalPrice || 0), 0))
      : roundMoney(effItems.reduce((s, it) => s + Number(it.totalPrice || 0), 0));
    const bdiEff = custo > 0 ? ((venda - custo) / custo) * 100 : (groupBdi || 0);
    return { budgetId: g.budgetId, nome_grupo: g.nome_grupo || budget.name || `Orçamento ${g.budgetId}`, disciplina: g.disciplina || "", bdi_grupo: g.bdi_grupo, ordem: idx, budget, items: effItems, custo: roundMoney(custo), venda, bdiEff };
  });
  const custoTotal = roundMoney(computed.reduce((s, g) => s + g.custo, 0));
  const vendaTotal = roundMoney(computed.reduce((s, g) => s + g.venda, 0));
  const combinedItems = computed.flatMap((g) => g.items);
  const bdiPonderado = custoTotal > 0 ? ((vendaTotal - custoTotal) / custoTotal) * 100 : 0;
  return { grupos: computed, combinedItems, custoTotal, vendaTotal, bdiPonderado };
}

// Painel interno (no gerador) dos orçamentos vinculados: custo, BDI editável por grupo,
// venda e totalizador com BDI ponderado. Atualiza só o próprio nó + a prévia — não
// re-renderiza o formulário inteiro (preserva o que o usuário digitou nos textos).
function renderProposalGroupsPanel() {
  const panel = qs("proposalGroupsPanel");
  if (!panel || !proposalGeneratorState) return;
  const mode = proposalGeneratorState.bdiMode || "auto";
  const calc = proposalGroupsCompute();
  const linkedIds = new Set((proposalGeneratorState.grupos || []).map((g) => String(g.budgetId)));
  const available = (db.workBudgets || [])
    .filter((b) => !linkedIds.has(String(b.id)))
    .map((b) => `<option value="${escapeHtml(b.id)}">${escapeHtml((b.name || `Orçamento ${b.id}`) + (b.version ? " - " + b.version : ""))}</option>`)
    .join("");
  const multi = calc.grupos.length > 1;
  const margem = roundMoney(calc.vendaTotal - calc.custoTotal);
  const margemPct = calc.vendaTotal > 0 ? (margem / calc.vendaTotal) * 100 : 0;
  const bdiCell = (g, idx) => mode === "grupo"
    ? `<td><input class="pg-bdi" data-idx="${idx}" inputmode="decimal" placeholder="auto (${asPercent(g.bdiEff)})" value="${g.bdi_grupo === "" || g.bdi_grupo == null ? "" : escapeHtml(g.bdi_grupo)}" style="width:5.5rem"></td>`
    : `<td>${asPercent(g.bdiEff)}</td>`;
  const modeOptions = [["auto", "Automático (BDI do orçamento)"], ["geral", "BDI geral (%)"], ["grupo", "BDI por grupo"], ["item", "Manual por item"]]
    .map(([v, l]) => `<option value="${v}" ${v === mode ? "selected" : ""}>${l}</option>`).join("");
  // Modo "item": tabela editável de venda por item (BDI resultante calculado).
  const itemTable = mode === "item" ? `
    <div class="proposal-item-prices">
      <table class="proposal-groups-table">
        <thead><tr><th>Item</th><th>Custo unit.</th><th>Qtd.</th><th>Venda unit.</th><th>BDI result.</th></tr></thead>
        <tbody>
          ${calc.combinedItems.map((it) => {
            const custoU = Number(it.unitCost || 0);
            const bdi = custoU > 0 ? ((Number(it.unitPrice || 0) - custoU) / custoU) * 100 : 0;
            return `<tr>
              <td>${svgText((it.code ? it.code + " - " : "") + (it.description || ""))}</td>
              <td>${asMoney(custoU)}</td>
              <td>${formatQuantity(it.quantity)}</td>
              <td><input class="pg-item-price" data-item="${escapeHtml(it.id)}" inputmode="decimal" value="${formatMoneyInput(Number(it.unitPrice || 0))}" style="width:7rem"></td>
              <td>${asPercent(bdi)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : "";
  panel.innerHTML = `
    <div class="proposal-groups">
      <div class="proposal-groups-head"><strong>Orçamentos vinculados</strong>
        <span class="muted">${calc.grupos.length} orçamento(ns)</span>
      </div>
      <datalist id="proposalDisciplinas">${["Elétrico", "Hidráulico", "Civil", "Estrutura", "Cobertura", "Energia Solar", "Subestação", "Ar-condicionado", "Instalações"].map((d) => `<option value="${d}"></option>`).join("")}</datalist>
      <table class="proposal-groups-table">
        <thead><tr><th>Grupo / Orçamento</th><th>Disciplina</th><th>Custo</th><th>BDI %</th><th>Venda</th><th></th></tr></thead>
        <tbody>
          ${calc.grupos.map((g, idx) => `
            <tr>
              <td><input class="pg-nome" data-idx="${idx}" value="${escapeHtml(g.nome_grupo)}"></td>
              <td><input class="pg-disc" data-idx="${idx}" list="proposalDisciplinas" value="${escapeHtml(g.disciplina || "")}" placeholder="—" style="width:8rem"></td>
              <td>${asMoney(g.custo)}</td>
              ${bdiCell(g, idx)}
              <td>${asMoney(g.venda)}</td>
              <td>${calc.grupos.length > 1 ? `<button type="button" class="link-button danger pg-remove" data-idx="${idx}" title="Remover">✕</button>` : ""}</td>
            </tr>`).join("")}
        </tbody>
        ${multi ? `<tfoot>
          <tr class="pg-total"><td>Total</td><td></td><td>${asMoney(calc.custoTotal)}</td><td>${asPercent(calc.bdiPonderado)} <span class="muted">pond.</span></td><td>${asMoney(calc.vendaTotal)}</td><td></td></tr>
          <tr class="pg-margem"><td colspan="6" class="muted">Margem bruta: ${asMoney(margem)} (${asPercent(margemPct)})</td></tr>
        </tfoot>` : ""}
      </table>
      ${available ? `<div class="proposal-groups-add no-print">
        <select id="proposalAddBudgetSelect">${available}</select>
        <button type="button" class="secondary" id="proposalAddBudgetBtn">+ Vincular orçamento</button>
      </div>` : `<p class="muted no-print">Todos os orçamentos disponíveis já estão vinculados.</p>`}
      <div class="proposal-bdi-form no-print">
        <label>Formação do preço (BDI)<select id="proposalBdiMode">${modeOptions}</select></label>
        ${mode === "geral" ? `<label>BDI geral (%)<input id="proposalBdiGeral" inputmode="decimal" value="${escapeHtml(proposalGeneratorState.bdiGeral ?? 0)}" style="width:6rem"></label>` : ""}
        <label class="proposal-licitacao-toggle"><input type="checkbox" id="proposalModoLicitacao" ${proposalGeneratorState.modoLicitacao ? "checked" : ""}> Proposta para licitação (referência SINAPI)</label>
        ${proposalGeneratorState.modoLicitacao ? `<label>BDI de referência (%)<input id="proposalBdiReferencia" inputmode="decimal" value="${escapeHtml(proposalGeneratorState.bdiReferencia ?? 0)}" style="width:6rem"></label>` : ""}
      </div>
      ${!multi ? `<div class="proposal-groups-summary muted">Custo ${asMoney(calc.custoTotal)} · BDI ${asPercent(calc.bdiPonderado)} · Venda ${asMoney(calc.vendaTotal)} · Margem ${asMoney(margem)} (${asPercent(margemPct)})</div>` : ""}
      ${itemTable}
      <div class="proposal-groups-actions no-print">
        <button type="button" class="secondary" id="proposalExportSinapi">Exportar SINAPI (Excel)</button>
        <button type="button" class="secondary" id="proposalSaveTemplate">Salvar como modelo</button>
        <button type="button" class="secondary" id="proposalApplyTemplate">Aplicar modelo…</button>
      </div>
    </div>`;
  qs("proposalBdiMode")?.addEventListener("change", (e) => {
    proposalGeneratorState.bdiMode = e.target.value;
    renderProposalGroupsPanel();
    updateProposalPreview();
  });
  qs("proposalBdiGeral")?.addEventListener("change", (e) => {
    const raw = String(e.target.value || "").trim().replace(",", ".");
    proposalGeneratorState.bdiGeral = raw === "" ? 0 : Number(raw);
    renderProposalGroupsPanel();
    updateProposalPreview();
  });
  qs("proposalModoLicitacao")?.addEventListener("change", (e) => {
    proposalGeneratorState.modoLicitacao = e.target.checked;
    renderProposalGroupsPanel();
    updateProposalPreview();
  });
  qs("proposalBdiReferencia")?.addEventListener("change", (e) => {
    const raw = String(e.target.value || "").trim().replace(",", ".");
    proposalGeneratorState.bdiReferencia = raw === "" ? 0 : Number(raw);
    updateProposalPreview();
  });
  panel.querySelectorAll(".pg-item-price").forEach((inp) => inp.addEventListener("change", (e) => {
    const id = e.target.dataset.item;
    proposalGeneratorState.itemOverrides = proposalGeneratorState.itemOverrides || {};
    const val = parseMoneyInput(e.target.value || "0");
    proposalGeneratorState.itemOverrides[id] = val;
    renderProposalGroupsPanel();
    updateProposalPreview();
  }));
  panel.querySelectorAll(".pg-bdi").forEach((inp) => inp.addEventListener("change", (e) => {
    const idx = Number(e.target.dataset.idx);
    const raw = String(e.target.value || "").trim().replace(",", ".");
    proposalGeneratorState.grupos[idx].bdi_grupo = raw === "" ? "" : Number(raw);
    renderProposalGroupsPanel();
    updateProposalPreview();
  }));
  panel.querySelectorAll(".pg-nome").forEach((inp) => inp.addEventListener("change", (e) => {
    const idx = Number(e.target.dataset.idx);
    proposalGeneratorState.grupos[idx].nome_grupo = e.target.value;
    updateProposalPreview();
  }));
  panel.querySelectorAll(".pg-remove").forEach((btn) => btn.addEventListener("click", (e) => {
    const idx = Number(e.target.dataset.idx);
    proposalGeneratorState.grupos.splice(idx, 1);
    renderProposalGroupsPanel();
    updateProposalPreview();
  }));
  qs("proposalAddBudgetBtn")?.addEventListener("click", () => {
    const id = qs("proposalAddBudgetSelect")?.value;
    if (!id) return;
    const b = byId("workBudgets", id);
    if (!b) return;
    proposalGeneratorState.grupos.push({ budgetId: b.id, nome_grupo: b.name || `Orçamento ${b.id}`, bdi_grupo: "", disciplina: "", ordem: proposalGeneratorState.grupos.length });
    renderProposalGroupsPanel();
    updateProposalPreview();
  });
  panel.querySelectorAll(".pg-disc").forEach((inp) => inp.addEventListener("change", (e) => {
    const idx = Number(e.target.dataset.idx);
    proposalGeneratorState.grupos[idx].disciplina = e.target.value;
    updateProposalPreview();
  }));
  qs("proposalExportSinapi")?.addEventListener("click", () => {
    const proj = proposalGeneratorState.project || byId("projects", proposalGeneratorState.budget?.projectId) || {};
    exportSinapiExcel(proj.id || proposalGeneratorState.budget?.projectId, proj.name);
  });
  qs("proposalSaveTemplate")?.addEventListener("click", saveProposalAsTemplate);
  qs("proposalApplyTemplate")?.addEventListener("click", applyProposalTemplate);
}

// ── Modelos de proposta (proposta_modelos) ────────────────────────────────
// Serializa a árvore atual (grupos + orçamentos + BDI), sem cliente nem valores
// finais, preservando referências de orçamento/SINAPI por meio dos budgetIds.
async function saveProposalAsTemplate() {
  if (!proposalGeneratorState) return;
  const nome = prompt("Nome do modelo de proposta:");
  if (!nome || !nome.trim()) return;
  const estrutura = {
    bdiMode: proposalGeneratorState.bdiMode || "auto",
    bdiGeral: Number(proposalGeneratorState.bdiGeral || 0),
    modelId: proposalGeneratorState.modelId || "",
    grupos: (proposalGeneratorState.grupos || []).map((g, i) => ({
      budgetId: g.budgetId, nome_grupo: g.nome_grupo || "", disciplina: g.disciplina || "",
      bdi_grupo: g.bdi_grupo === "" || g.bdi_grupo == null ? "" : Number(g.bdi_grupo), ordem: i,
    })),
  };
  const disciplinas = [...new Set(estrutura.grupos.map((g) => g.disciplina).filter(Boolean))].join(", ");
  try {
    await createIntegratedRecord("proposalTemplates", {
      nome: nome.trim(),
      descricao: `Modelo gerado da proposta (${estrutura.grupos.length} orçamento(s)).`,
      disciplina: disciplinas,
      estrutura_json: JSON.stringify(estrutura),
      ativo: 1,
    });
    alert("Modelo de proposta salvo. Reutilize em \"Aplicar modelo…\".");
  } catch (e) {
    alert(`Não foi possível salvar o modelo: ${e.message}`);
  }
}

// Aplica um modelo ativo à proposta atual: recria os grupos a partir dos orçamentos
// do modelo (os que ainda existem) e mantém o cliente/obra atuais. Não acopla cliente.
function applyProposalTemplate() {
  if (!proposalGeneratorState) return;
  const modelos = (db.proposalTemplates || []).filter((m) => Number(m.ativo) !== 0);
  if (!modelos.length) return alert("Nenhum modelo de proposta salvo ainda. Use \"Salvar como modelo\" primeiro.");
  const lista = modelos.map((m, i) => `${i + 1}) ${m.nome}${m.disciplina ? " — " + m.disciplina : ""}`).join("\n");
  const escolha = prompt(`Escolha o modelo (número):\n${lista}`);
  const idx = Number(escolha) - 1;
  const modelo = modelos[idx];
  if (!modelo) return;
  let estrutura;
  try { estrutura = JSON.parse(modelo.estrutura_json || "{}"); } catch { return alert("Modelo inválido (estrutura corrompida)."); }
  const grupos = (estrutura.grupos || []).filter((g) => byId("workBudgets", g.budgetId));
  if (!grupos.length) return alert("Os orçamentos deste modelo não existem mais neste sistema.");
  proposalGeneratorState.grupos = grupos.map((g, i) => ({ budgetId: g.budgetId, nome_grupo: g.nome_grupo || "", disciplina: g.disciplina || "", bdi_grupo: g.bdi_grupo ?? "", ordem: i }));
  proposalGeneratorState.bdiMode = estrutura.bdiMode || "auto";
  proposalGeneratorState.bdiGeral = Number(estrutura.bdiGeral || 0);
  proposalGeneratorState.itemOverrides = {};
  renderProposalGroupsPanel();
  updateProposalPreview();
  alert(`Modelo "${modelo.nome}" aplicado. Ajuste quantidades/preços e o cliente normalmente.`);
}

// Bloco "Investimento" do PDF (visão do cliente): com vários grupos vira um resumo por
// grupo (sem custo) + total geral; com um só, o total simples. Nunca expõe custo/BDI.
function proposalInvestmentHtml(calc, vars) {
  if (calc && calc.grupos.length > 1) {
    const temDisc = calc.grupos.some((g) => g.disciplina);
    let rows;
    if (temDisc) {
      const byDisc = {};
      calc.grupos.forEach((g) => { const k = g.disciplina || "Outros"; (byDisc[k] = byDisc[k] || []).push(g); });
      rows = Object.entries(byDisc).map(([disc, gs]) => {
        const sub = gs.reduce((s, g) => s + g.venda, 0);
        const inner = gs.map((g) => `<div class="pi-sub"><span>${svgText(g.nome_grupo)}</span><strong>${asMoney(g.venda)}</strong></div>`).join("");
        return `<div class="pi-disc"><div class="pi-disc-head"><span>${svgText(disc)}</span><strong>${asMoney(sub)}</strong></div>${inner}</div>`;
      }).join("");
    } else {
      rows = calc.grupos.map((g) => `<div><span>${svgText(g.nome_grupo)}</span><strong>${asMoney(g.venda)}</strong></div>`).join("");
    }
    return `
      <section class="proposal-investment">
        <h2>Investimento</h2>
        ${rows}
        <div class="proposal-investment-total"><span>Valor total</span><strong>${asMoney(calc.vendaTotal)}</strong></div>
        <p>${svgText(vars.valor_total_extenso)}</p>
      </section>`;
  }
  return `
      <section class="proposal-investment">
        <h2>Investimento</h2>
        <div><span>Valor total</span><strong>${asMoney(calc ? calc.vendaTotal : 0)}</strong></div>
        <p>${svgText(vars.valor_total_extenso)}</p>
      </section>`;
}

// Seção de licitação: referência SINAPI (custo × BDI de referência) × valor ofertado,
// com o % de desconto por item e global. Para propostas baseadas em preços SINAPI.
function proposalLicitacaoHtml(calc, refBdi) {
  const items = (calc && calc.combinedItems) || [];
  if (!items.length) return "";
  let refTotal = 0;
  let offTotal = 0;
  const rows = items.map((it, idx) => {
    const custoU = Number(it.unitCost || 0);
    const qty = Number(it.quantity || 0);
    const ref = roundMoney(custoU * (1 + Number(refBdi || 0) / 100));
    const refT = roundMoney(qty * ref);
    const off = Number(it.unitPrice || 0);
    const offT = Number(it.totalPrice || 0);
    refTotal += refT;
    offTotal += offT;
    const desc = ref > 0 ? ((ref - off) / ref) * 100 : 0;
    return `<tr><td>${idx + 1}</td><td>${svgText(it.description || "")}</td><td>${svgText(it.unit || "")}</td><td>${formatQuantity(it.quantity)}</td><td>${asMoney(ref)}</td><td>${asMoney(off)}</td><td>${asPercent(desc)}</td></tr>`;
  }).join("");
  const descGlobal = refTotal > 0 ? ((refTotal - offTotal) / refTotal) * 100 : 0;
  return `
    <section class="proposal-section">
      <h2>Comparativo com a referência SINAPI (licitação)</h2>
      <table class="proposal-items-table">
        <thead><tr><th>Item</th><th>Descrição</th><th>Un.</th><th>Qtd.</th><th>Ref. SINAPI</th><th>Ofertado</th><th>Desc.</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><th colspan="4">Total</th><th>${asMoney(refTotal)}</th><th>${asMoney(offTotal)}</th><th>${asPercent(descGlobal)}</th></tr></tfoot>
      </table>
      <p><strong>Oferta com ${asPercent(descGlobal)} de desconto sobre a referência SINAPI (BDI de referência ${asPercent(Number(refBdi || 0))}).</strong></p>
    </section>`;
}

// Info SINAPI de um item da proposta (a partir de sinapi_id): código, descrição,
// unidade, valor unitário e a referência (mês/ano/UF) da tabela usada.
function sinapiInfoForItem(item) {
  const sid = item && (item.sinapi_id || item.sinapiId);
  if (!sid) return null;
  const comp = byId("sinapiCompositions", sid);
  if (!comp) return null;
  const ref = byId("sinapiReferences", comp.sinapiReferenceId);
  const refLabel = ref ? `${String(ref.referenceMonth || "").padStart(2, "0")}/${ref.referenceYear || ""} ${ref.uf || ""}`.trim() : "";
  return { code: comp.code || "", description: comp.description || "", unit: comp.unit || "", unitCost: Number(comp.unitCost || 0), refLabel };
}

// Anexo do PDF: composições SINAPI utilizadas (sem repetição). Omitido se nenhuma.
function proposalSinapiAnexoHtml(items) {
  const seen = new Map();
  (items || []).forEach((it) => {
    const info = sinapiInfoForItem(it);
    if (info && info.code && !seen.has(info.code)) seen.set(info.code, info);
  });
  if (!seen.size) return "";
  const rows = [...seen.values()].map((c) => `<tr><td>${svgText(c.code)}</td><td>${svgText(c.description)}</td><td>${svgText(c.unit)}</td><td>${asMoney(c.unitCost)}</td><td>${svgText(c.refLabel)}</td></tr>`).join("");
  return `
    <section class="proposal-section proposal-sinapi-anexo">
      <h2>Composições SINAPI utilizadas</h2>
      <table class="proposal-items-table">
        <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th>Valor unit.</th><th>Referência</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

// Exporta a tabela SINAPI da obra em .xlsx (download autenticado via blob).
async function exportSinapiExcel(obraId, label) {
  if (!obraId) return alert("Selecione uma obra para exportar a tabela SINAPI.");
  try {
    const resp = await fetch(`${API_BASE}/sinapi-export-obra?obra_id=${encodeURIComponent(obraId)}`, { headers: authHeaders() });
    if (!resp.ok) {
      let msg = `Erro ${resp.status}`;
      try { const j = await resp.json(); msg = j.error || j.message || msg; } catch { /* corpo não-JSON */ }
      throw new Error(msg);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SINAPI_${String(label || "obra").replace(/[^A-Za-z0-9_-]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(`Não foi possível exportar a tabela SINAPI: ${e.message}`);
  }
}

function proposalDocumentHtml({ budget, project, client, items, model, input, vars, calc, licitacao, refBdi }) {
  const value = (field) => renderTemplate(input[field] || "", vars);
  const proposalNumber = vars.numero_proposta;
  const company = (db.companySettings || [])[0] || {};
  const addr = companyAddressLines(company);
  const companyLogo = companyLogoSrc(company);
  return `
    <article class="proposal-page">
      <header class="proposal-header">
        <div class="proposal-header-company">
          ${companyLogo ? `<img class="proposal-logo" src="${escapeHtml(companyLogo)}" alt="Logo da empresa">` : ""}
          <div class="proposal-company-info">
            <strong class="proposal-company-name">${svgText(vars.nome_empresa)}</strong>
            ${vars.cnpj_empresa ? `<p>CNPJ: ${svgText(vars.cnpj_empresa)}</p>` : ""}
            ${addr.street ? `<p>${svgText(addr.street)}</p>` : ""}
            ${addr.cityCep ? `<p>${svgText(addr.cityCep)}</p>` : ""}
            ${proposalCompanyContactLine(vars)}
            ${vars.instagram_empresa ? `<p>📷 ${svgText(vars.instagram_empresa)}</p>` : ""}
          </div>
        </div>
        <div class="proposal-header-doc">
          <span class="proposal-doc-title">Proposta Comercial</span>
          <strong class="proposal-doc-number">Nº ${svgText(proposalNumber)}</strong>
          ${vars.data_proposta ? `<p>Emissão: ${svgText(vars.data_proposta)}</p>` : ""}
          ${vars.validade_proposta ? `<p>Válida até: ${svgText(vars.validade_proposta)}</p>` : ""}
          ${vars.responsavel_comercial ? `<p>Responsável: ${svgText(vars.responsavel_comercial)}</p>` : ""}
        </div>
      </header>
      <section class="proposal-meta-grid proposal-meta-2">
        <div><h3>Cliente</h3><p>${svgText(client.name || "")}</p><p>${svgText(client.document || "")}</p><p>${svgText(clientFullAddress(client) || client.address || "")}</p></div>
        <div><h3>Obra/Projeto</h3><p>${svgText(project.name || "")}</p><p>${svgText(obraEnderecoEfetivo(project) || project.address || "")}</p><p>Orçamento: ${svgText(vars.numero_orcamento)} ${svgText(vars.versao_orcamento)}</p></div>
      </section>
      ${proposalSection("Objeto da proposta", value("proposalObject"))}
      ${proposalSection("Escopo dos serviços", `${value("generatedScope")}\n\n${value("scope")}`)}
      ${proposalSection("Etapas", value("stages"))}
      ${proposalSection("Entregáveis", value("deliverables"))}
      <section class="proposal-section">
        <h2>Itens do orçamento</h2>
        ${proposalItemsHtml(items, input.itemDisplayMode || "Tabela resumida")}
      </section>
      ${proposalInvestmentHtml(calc || { grupos: [], vendaTotal: Number(budget.totalPrice || 0) }, vars)}
      ${licitacao ? proposalLicitacaoHtml(calc, refBdi) : ""}
      ${proposalSection("Condições de pagamento", value("paymentCondition"))}
      ${proposalSection("Prazo de execução", value("executionDeadline"))}
      ${proposalSection("Itens inclusos", value("includedItems"))}
      ${proposalSection("Itens não inclusos", value("excludedItems"))}
      ${proposalSection("Responsabilidades do cliente", value("clientResponsibilities"))}
      ${proposalSection("Responsabilidades da empresa", value("companyResponsibilities"))}
      ${proposalSection("Validade da proposta", asDate(input.validityDate))}
      ${proposalSection("Condições gerais", value("generalConditions"))}
      ${proposalSection("Observações comerciais", value("commercialNotes"))}
      ${proposalSinapiAnexoHtml(items)}
      <section class="proposal-signatures">
        <div><h2>Aceite da proposta</h2><p>${textToHtml(value("acceptanceText"))}</p><span>Assinatura do cliente</span></div>
        <div><h2>Assinatura da empresa</h2><p>${textToHtml(value("signatureText"))}</p><span>${svgText(vars.nome_empresa)}</span></div>
      </section>
      <footer class="proposal-footer">${svgText([vars.nome_empresa, vars.cnpj_empresa ? `CNPJ ${vars.cnpj_empresa}` : "", vars.whatsapp_empresa || vars.telefone_empresa, vars.email_empresa].filter(Boolean).join(" · "))}</footer>
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
        ${items.map((item, index) => { const sinapi = sinapiInfoForItem(item); return `<tr><td>${index + 1}</td>${showCode ? `<td>${svgText(item.code || "")}</td>` : ""}<td>${svgText(item.description || "")}${sinapi && sinapi.code ? `<br><small class="proposal-sinapi-tag">SINAPI ${svgText(sinapi.code)}${sinapi.refLabel ? " · ref " + svgText(sinapi.refLabel) : ""}</small>` : ""}</td><td>${svgText(item.unit || "")}</td><td>${formatQuantity(item.quantity)}</td>${technical ? `<td>${asMoney(item.unitCost || 0)}</td><td>${asPercent(item.bdiPercent || 0)}</td>` : ""}${showUnitPrice ? `<td>${asMoney(item.unitPrice || 0)}</td>` : ""}<td>${asMoney(item.totalPrice || 0)}</td></tr>`; }).join("")}
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
    endereco_empresa: composeCompanyAddress(company),
    cidade_uf_empresa: [company.city || company.cidade, company.estado].filter(Boolean).join(" - "),
    cep_empresa: company.zipCode ? maskCep(company.zipCode) : "",
    site_empresa: company.website || company.site || "",
    whatsapp_empresa: company.whatsapp || company.phone || "",
    instagram_empresa: company.instagram || "",
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

// Endereço completo da empresa em duas linhas para o cabeçalho do PDF, ignorando
// campos vazios. street = "Rua X, 123 - Sala 4 - Centro"; cityCep = "Cidade - UF · CEP".
function companyAddressLines(company) {
  const c = company || {};
  const line1 = [c.address, c.numero].filter((v) => v && String(v).trim()).join(", ");
  const street = [line1, c.complemento, c.bairro].filter((v) => v && String(v).trim()).join(" - ");
  const cidadeUf = [c.city || c.cidade, c.estado].filter((v) => v && String(v).trim()).join(" - ");
  const cep = c.zipCode ? `CEP ${maskCep(c.zipCode)}` : "";
  const cityCep = [cidadeUf, cep].filter(Boolean).join(" · ");
  return { street, cityCep };
}

function composeCompanyAddress(company) {
  const { street, cityCep } = companyAddressLines(company);
  return [street, cityCep].filter(Boolean).join(" · ");
}

// URL pública da logo da empresa (servida pelo endpoint getLogo, sem auth).
function companyLogoSrc(company, bust) {
  const c = company || (db.companySettings || [])[0] || {};
  if (!c.logo_url) return "";
  return `${API_BASE}/?module=companySettings&action=getLogo&v=${encodeURIComponent(bust || c.logo_url)}`;
}

// ─── Cabeçalho/rodapé padrão de documentos (reutilizável + print-only) ──────
// Subtítulo de período a partir dos filtros superiores.
function documentPeriodSubtitle() {
  const f = getFilters();
  if (f.start && f.end) return `Período: ${asDate(f.start)} a ${asDate(f.end)}`;
  if (f.start) return `A partir de ${asDate(f.start)}`;
  if (f.end) return `Até ${asDate(f.end)}`;
  return "Todos os períodos";
}

// Cabeçalho padronizado: logo à esquerda, dados da empresa ao centro, título e
// subtítulo à direita, com linha divisória. Visível apenas na impressão.
function generateDocumentHeader(titulo, subtitulo = "") {
  const c = (db.companySettings || [])[0] || {};
  const logo = companyLogoSrc(c);
  const addr = companyAddressLines(c);
  const enderecoLinha = [addr.street, addr.cityCep].filter(Boolean).join(" · ");
  const contatos = [
    (c.whatsapp || c.phone) ? `📱 ${c.whatsapp || c.phone}` : "",
    c.email ? `📧 ${c.email}` : "",
    (c.website || c.site) ? `🌐 ${c.website || c.site}` : "",
  ].filter(Boolean).join(" · ");
  return `
    <header class="doc-header doc-print-only">
      ${logo ? `<img class="doc-logo" src="${escapeHtml(logo)}" alt="Logo da empresa">` : ""}
      <div class="doc-company">
        <strong class="doc-company-name">${svgText(c.name || "Empresa")}</strong>
        ${c.document ? `<span>CNPJ: ${svgText(c.document)}</span>` : ""}
        ${enderecoLinha ? `<span>${svgText(enderecoLinha)}</span>` : ""}
        ${contatos ? `<span>${svgText(contatos)}</span>` : ""}
      </div>
      <div class="doc-title-box">
        <span class="doc-title">${svgText(titulo)}</span>
        ${subtitulo ? `<span class="doc-subtitle">${svgText(subtitulo)}</span>` : ""}
      </div>
    </header>`;
}

// Rodapé padronizado: dados da empresa + data/hora de geração. O número de página
// é resolvido por CSS (@page counter). Visível apenas na impressão.
function generateDocumentFooter() {
  const c = (db.companySettings || [])[0] || {};
  const info = [c.name, c.document ? `CNPJ ${c.document}` : "", c.whatsapp || c.phone, c.email].filter(Boolean).join(" · ");
  const stamp = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `
    <footer class="doc-footer doc-print-only">
      <span>${svgText(info)}</span>
      <span>Gerado em ${svgText(stamp)}</span>
    </footer>`;
}

// Imprime um documento isolado (container dedicado #docPrint, padrão do RDO):
// abre o preview/PDF do navegador mostrando só o documento.
function printStandaloneDocument(innerHtml) {
  let box = qs("docPrint");
  if (!box) {
    box = document.createElement("div");
    box.id = "docPrint";
    document.body.appendChild(box);
  }
  box.innerHTML = innerHtml;
  document.body.classList.add("doc-printing");
  const cleanup = () => {
    document.body.classList.remove("doc-printing");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// Pedido de compra individual imprimível (cabeçalho/rodapé da empresa).
async function openPurchaseOrderPrint(id) {
  const po = byId("purchaseOrders", id);
  if (!po) { alert("Pedido de compra não encontrado."); return; }
  const supplier = byId("suppliers", po.supplierId) || {};
  const supplierAddr = [
    clientFullAddress(supplier),
    [supplier.cidade, supplier.estado].filter(Boolean).join(" - "),
    supplier.zipCode ? `CEP ${maskCep(supplier.zipCode)}` : "",
  ].filter(Boolean).join(" · ");
  const linha = (label, valor) => `<p><span class="doc-kv-label">${label}:</span> ${svgText(valor || "—")}</p>`;

  let items = [];
  if (serverMode) {
    try { items = await apiModuleRequest(`?module=purchaseOrderItems&action=list&purchaseOrderId=${encodeURIComponent(id)}`) || []; } catch { items = []; }
  }
  const qtd = (v) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  const amount = Number(po.amount || 0);
  const desconto = Number(po.desconto || 0);
  const subtotal = items.length ? items.reduce((s, it) => s + Number(it.valor_total || 0), 0) : amount + desconto;
  const total = items.length ? Math.max(0, subtotal - desconto) : amount;
  const itemRows = items.length
    ? items.map((it, i) => `<tr><td>${i + 1}</td><td>${svgText(it.descricao || "")}</td><td>${svgText(it.unidade || "un")}</td><td>${qtd(it.quantidade)}</td><td>${asMoney(it.valor_unitario)}</td><td>${asMoney(it.valor_total)}</td></tr>`).join("")
    : `<tr><td>1</td><td>${svgText(nameOf("categories", po.categoryId) || (po.number ? `Pedido ${po.number}` : "Itens do pedido"))}</td><td>vb</td><td>1</td><td>${asMoney(amount)}</td><td>${asMoney(amount)}</td></tr>`;

  const html = `
    <article class="doc-sheet">
      ${generateDocumentHeader("Pedido de Compra", [po.number ? `Nº ${po.number}` : "", asDate(po.date), po.status].filter(Boolean).join(" · "))}
      <div class="doc-blocks">
        <section class="doc-block">
          <h3>Fornecedor</h3>
          <p><strong>${svgText(supplier.name || nameOf("suppliers", po.supplierId) || "—")}</strong></p>
          ${supplier.document ? `<p>${svgText(supplier.document)}</p>` : ""}
          ${supplierAddr ? `<p>${svgText(supplierAddr)}</p>` : ""}
          ${(supplier.phone || supplier.email) ? `<p>${svgText([supplier.phone, supplier.email].filter(Boolean).join(" · "))}</p>` : ""}
        </section>
        <section class="doc-block">
          <h3>Pedido</h3>
          ${linha("Número", po.number)}
          ${linha("Emissão", asDate(po.date))}
          ${linha("Entrega prevista", asDate(po.expectedDate))}
          ${linha("Obra vinculada", nameOf("projects", po.projectId))}
          ${linha("Centro de custo", nameOf("costCenters", po.costCenterId))}
          ${linha("Condições de pagamento", po.condicoes_pagamento)}
          ${linha("Status", po.status)}
        </section>
      </div>
      <section class="doc-section">
        <h3>Itens</h3>
        <table class="doc-table">
          <thead><tr><th>Item</th><th>Descrição</th><th>Unid.</th><th>Qtd.</th><th>Valor Unit.</th><th>Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr><td colspan="5" class="doc-total-label">Subtotal</td><td>${asMoney(subtotal)}</td></tr>
            ${desconto > 0 ? `<tr><td colspan="5" class="doc-total-label">Desconto</td><td>− ${asMoney(desconto)}</td></tr>` : ""}
            <tr class="doc-total-row"><td colspan="5" class="doc-total-label">TOTAL GERAL</td><td>${asMoney(total)}</td></tr>
          </tfoot>
        </table>
      </section>
      ${po.notes ? `<section class="doc-section"><h3>Observações</h3><p>${textToHtml(po.notes)}</p></section>` : ""}
      <section class="doc-signatures">
        <div><span class="doc-sign-line"></span><span>Solicitante</span><span class="doc-sign-date">Data: ____/____/______</span></div>
        <div><span class="doc-sign-line"></span><span>Aprovado por</span><span class="doc-sign-date">Data: ____/____/______</span></div>
      </section>
      ${generateDocumentFooter()}
    </article>`;
  printStandaloneDocument(html);
}

// ─── Itens detalhados no formulário de pedido de compra ─────────────────────
let purchaseOrderItemsState = [];
const PO_CONDICOES_SUGESTOES = ["À vista", "30 dias", "50% entrada + 50% na entrega", "30/60 dias"];

function setupPurchaseOrderForm() {
  const formFields = qs("formFields");
  if (!formFields || formFields.querySelector("#poItemsBox")) return;

  // Datalist de condições de pagamento (sugestões + campo livre).
  const condInput = formFields.querySelector('[name="condicoes_pagamento"]');
  if (condInput && !formFields.querySelector("#poCondicoesList")) {
    condInput.setAttribute("list", "poCondicoesList");
    condInput.setAttribute("placeholder", "Ex.: À vista, 30 dias, 50% entrada + 50% na entrega…");
    condInput.insertAdjacentHTML("afterend", `<datalist id="poCondicoesList">${PO_CONDICOES_SUGESTOES.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("")}</datalist>`);
  }

  const box = document.createElement("div");
  box.id = "poItemsBox";
  box.className = "full po-items-box";
  box.innerHTML = `
    <div class="po-items-head">
      <h4>Itens do pedido</h4>
      <button type="button" class="secondary" id="poAddItem">+ Adicionar item</button>
    </div>
    <div class="table-wrap"><table class="po-items-table">
      <thead><tr><th>Descrição</th><th>Unid.</th><th>Qtd.</th><th>Valor Unit.</th><th>Total</th><th>Item do orçamento</th><th></th></tr></thead>
      <tbody id="poItemsBody"></tbody>
    </table></div>
    <div class="po-items-totals">
      <span>Subtotal: <strong id="poSubtotal">${asMoney(0)}</strong></span>
      <span>Desconto: <strong id="poDescontoView">${asMoney(0)}</strong></span>
      <span class="po-total-geral">Total geral: <strong id="poTotalGeral">${asMoney(0)}</strong></span>
    </div>`;
  formFields.appendChild(box);

  const body = box.querySelector("#poItemsBody");
  const projectSelect = formFields.querySelector('[name="projectId"]');
  const descontoInput = formFields.querySelector('[name="desconto"]');
  const amountInput = formFields.querySelector('[name="amount"]');

  const budgetOptionsHtml = (selectedId) => {
    const projectId = projectSelect?.value || "";
    const its = (db.workBudgetItems || []).filter((it) => !projectId || sameId(it.projectId, projectId));
    return `<option value="">—</option>` + its.map((it) => `<option value="${escapeHtml(it.id)}" ${sameId(it.id, selectedId) ? "selected" : ""}>${escapeHtml(`${it.code ? it.code + " - " : ""}${it.description || it.id}`)}</option>`).join("");
  };

  const recompute = () => {
    let subtotal = 0;
    purchaseOrderItemsState.forEach((it, i) => {
      const total = Number(it.quantidade || 0) * Number(it.valor_unitario || 0);
      subtotal += total;
      const cell = body.querySelector(`tr[data-idx="${i}"] .po-i-total`);
      if (cell) cell.textContent = asMoney(total);
    });
    const desconto = descontoInput ? parseMoneyInput(descontoInput.value) : 0;
    const totalGeral = Math.max(0, subtotal - desconto);
    box.querySelector("#poSubtotal").textContent = asMoney(subtotal);
    box.querySelector("#poDescontoView").textContent = asMoney(desconto);
    box.querySelector("#poTotalGeral").textContent = asMoney(totalGeral);
    if (amountInput) {
      if (purchaseOrderItemsState.length) { amountInput.value = formatMoneyInput(totalGeral); amountInput.readOnly = true; }
      else { amountInput.readOnly = false; }
    }
  };

  const renderRows = () => {
    body.innerHTML = purchaseOrderItemsState.map((it, i) => `
      <tr data-idx="${i}">
        <td><input class="po-i-desc" value="${escapeHtml(it.descricao || "")}" placeholder="Descrição do item"></td>
        <td><input class="po-i-unid" value="${escapeHtml(it.unidade || "un")}"></td>
        <td><input class="po-i-qtd" inputmode="decimal" value="${escapeHtml(String(it.quantidade ?? 1).replace(".", ","))}"></td>
        <td><input class="po-i-vu" inputmode="decimal" value="${formatMoneyInput(it.valor_unitario || 0)}"></td>
        <td class="po-i-total">${asMoney(Number(it.quantidade || 0) * Number(it.valor_unitario || 0))}</td>
        <td><select class="po-i-budget">${budgetOptionsHtml(it.work_budget_item_id)}</select></td>
        <td><button type="button" class="danger po-i-remove" title="Remover item">✕</button></td>
      </tr>`).join("");
    body.querySelectorAll("tr").forEach((tr) => {
      const i = Number(tr.dataset.idx);
      tr.querySelector(".po-i-desc").addEventListener("input", (e) => { purchaseOrderItemsState[i].descricao = e.target.value; });
      tr.querySelector(".po-i-unid").addEventListener("input", (e) => { purchaseOrderItemsState[i].unidade = e.target.value; });
      tr.querySelector(".po-i-qtd").addEventListener("input", (e) => { purchaseOrderItemsState[i].quantidade = parseMoneyInput(e.target.value); recompute(); });
      tr.querySelector(".po-i-vu").addEventListener("input", (e) => { purchaseOrderItemsState[i].valor_unitario = parseMoneyInput(e.target.value); recompute(); });
      tr.querySelector(".po-i-budget").addEventListener("change", (e) => {
        purchaseOrderItemsState[i].work_budget_item_id = e.target.value || null;
        const bi = byId("workBudgetItems", e.target.value);
        if (bi) {
          if (!purchaseOrderItemsState[i].descricao) { purchaseOrderItemsState[i].descricao = bi.description || ""; tr.querySelector(".po-i-desc").value = purchaseOrderItemsState[i].descricao; }
          if (bi.unit) { purchaseOrderItemsState[i].unidade = bi.unit; tr.querySelector(".po-i-unid").value = bi.unit; }
        }
      });
      tr.querySelector(".po-i-remove").addEventListener("click", () => { purchaseOrderItemsState.splice(i, 1); renderRows(); });
    });
    recompute();
  };

  box.querySelector("#poAddItem").addEventListener("click", () => {
    purchaseOrderItemsState.push({ descricao: "", unidade: "un", quantidade: 1, valor_unitario: 0, work_budget_item_id: null });
    renderRows();
  });
  descontoInput?.addEventListener("input", recompute);
  projectSelect?.addEventListener("change", renderRows);

  purchaseOrderItemsState = [];
  renderRows();
  if (editing.id && serverMode) {
    apiModuleRequest(`?module=purchaseOrderItems&action=list&purchaseOrderId=${encodeURIComponent(editing.id)}`)
      .then((items) => {
        purchaseOrderItemsState = (items || []).map((it) => ({
          descricao: it.descricao || "",
          unidade: it.unidade || "un",
          quantidade: Number(it.quantidade || 0),
          valor_unitario: Number(it.valor_unitario || 0),
          work_budget_item_id: it.work_budget_item_id || null,
          observacao: it.observacao || "",
        }));
        renderRows();
      })
      .catch(() => {});
  }
}

// Salva o pedido com itens detalhados (amount = subtotal − desconto) e os itens.
// Retorna true se tratou (não cai no fluxo normal). Sem itens → fluxo normal.
async function submitPurchaseOrder(data) {
  if (!serverMode || !purchaseOrderItemsState.length) return false;
  const desconto = Number(data.desconto || 0);
  const subtotal = purchaseOrderItemsState.reduce((s, it) => s + Number(it.quantidade || 0) * Number(it.valor_unitario || 0), 0);
  data.amount = Math.max(0, subtotal - desconto);
  data.desconto = desconto;
  try {
    const record = editing.id
      ? await updateIntegratedRecord("purchaseOrders", editing.id, data)
      : await createIntegratedRecord("purchaseOrders", data);
    const poId = record?.id || editing.id;
    await apiModuleRequest("?module=purchaseOrderItems&action=saveBulk", {
      method: "POST",
      body: JSON.stringify({
        purchaseOrderId: poId,
        items: purchaseOrderItemsState,
        desconto,
        condicoes_pagamento: data.condicoes_pagamento || "",
      }),
    });
  } catch (error) {
    alert(`Não foi possível salvar o pedido com itens: ${error.message}`);
    return true;
  }
  logAudit(editing.id ? "edit" : "create", "purchaseOrders", String(data.number || ""));
  qs("recordDialog").close();
  await refreshAndRender();
  return true;
}

// Linha de contato do cabeçalho: 📱 WhatsApp · 📧 E-mail · 🌐 Site (ignora vazios).
function proposalCompanyContactLine(vars) {
  const parts = [
    vars.whatsapp_empresa ? `📱 ${vars.whatsapp_empresa}` : "",
    vars.email_empresa ? `📧 ${vars.email_empresa}` : "",
    vars.site_empresa ? `🌐 ${vars.site_empresa}` : "",
  ].filter(Boolean);
  return parts.length ? `<p>${svgText(parts.join(" · "))}</p>` : "";
}

// Upload/remoção da logo da empresa em Configurações → Dados da empresa.
function setupCompanyLogoUpload() {
  const formFields = qs("formFields");
  if (!formFields || formFields.querySelector("#companyLogoBox")) return;
  const box = document.createElement("div");
  box.id = "companyLogoBox";
  box.className = "full company-logo-box";

  const renderInner = () => {
    const c = (db.companySettings || [])[0] || {};
    const hasLogo = Boolean(c.logo_url);
    box.innerHTML = `
      <h4 class="company-logo-title">Logo da empresa</h4>
      <div class="company-logo-row">
        <div class="company-logo-preview">${hasLogo ? `<img src="${companyLogoSrc(c, Date.now())}" alt="Logo atual">` : '<span class="muted">Sem logo cadastrada</span>'}</div>
        <div class="company-logo-actions">
          <input type="file" id="companyLogoFile" accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg">
          <button type="button" class="secondary" id="companyLogoUpload">Enviar logo</button>
          ${hasLogo ? '<button type="button" class="danger" id="companyLogoRemove">Remover logo</button>' : ""}
        </div>
      </div>
      <p class="field-hint">Envie sua logo em PNG ou JPG (máx. 2MB). Recomendado: fundo transparente (PNG), largura mínima de 400px (ideal 400×200px).</p>`;
    box.querySelector("#companyLogoUpload")?.addEventListener("click", uploadLogo);
    box.querySelector("#companyLogoRemove")?.addEventListener("click", removeLogo);
  };

  const uploadLogo = async () => {
    const file = box.querySelector("#companyLogoFile")?.files?.[0];
    if (!file) { alert("Selecione um arquivo de logo (PNG, JPG ou SVG)."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("Arquivo acima de 2MB. Reduza o tamanho da logo."); return; }
    const fd = new FormData();
    fd.append("logo", file);
    const btn = box.querySelector("#companyLogoUpload");
    if (btn) btn.disabled = true;
    try {
      const result = await fetchForm("?module=companySettings&action=uploadLogo", fd);
      const c = (db.companySettings || [])[0];
      if (c) c.logo_url = result?.data?.logo_url || result?.logo_url || "logo.png";
      if (typeof showToast === "function") showToast("Logo enviada com sucesso!");
      renderInner();
    } catch (error) {
      alert(`Não foi possível enviar a logo: ${error.message}`);
      if (btn) btn.disabled = false;
    }
  };

  const removeLogo = async () => {
    if (!confirm("Remover a logo da empresa?")) return;
    try {
      await apiModuleRequest("?module=companySettings&action=removeLogo", { method: "POST" });
      const c = (db.companySettings || [])[0];
      if (c) c.logo_url = "";
      if (typeof showToast === "function") showToast("Logo removida.");
      renderInner();
    } catch (error) {
      alert(`Não foi possível remover a logo: ${error.message}`);
    }
  };

  formFields.appendChild(box);
  renderInner();
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
  // Base de custo vinda do(s) orçamento(s) técnico(s): custo, venda e BDI por grupo.
  const calc = proposalGroupsCompute();
  const items = calc.combinedItems;
  const budgetForVars = { ...budget, totalPrice: calc.vendaTotal };
  const vars = proposalVariablesFor({ ...proposalGeneratorState, budget: budgetForVars, items, project, client, model, input });
  const status = statusOverride || input.draftStatus || "Rascunho";
  const body = qs("proposalPreview").innerHTML;
  const custoTotalOrcamentos = calc.custoTotal;
  const amountTotal = calc.vendaTotal;
  const valorBdiTotal = Math.max(0, amountTotal - custoTotalOrcamentos);
  const bdiModeMap = { auto: "percentual", geral: "percentual", grupo: "misto", item: "por_item" };
  const bdiTipo = bdiModeMap[proposalGeneratorState.bdiMode || "auto"] || "percentual";
  const bdiGeral = (proposalGeneratorState.bdiMode === "geral") ? Number(proposalGeneratorState.bdiGeral || 0) : roundMoney(calc.bdiPonderado);
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
      amount: roundMoney(amountTotal),
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
      bdi_geral: bdiGeral,
      bdi_tipo: bdiTipo,
      custo_total_orcamentos: roundMoney(custoTotalOrcamentos),
      valor_bdi_total: roundMoney(valorBdiTotal),
      modo_licitacao: proposalGeneratorState.modoLicitacao ? "Sim" : "Não",
    });
    await createProposalLinkedRecords(proposal, { budget, project, client, model, items, vars, status, calc });
    alert(status === "Rascunho" ? "Rascunho de proposta salvo." : "Proposta gerada e finalizada.");
    qs("proposalGeneratorDialog").close();
    proposalGeneratorState = null;
    currentModule = "proposals";
    await refreshAndRender();
  } catch (error) {
    alert(`Não foi possível salvar a proposta gerada: ${error.message}`);
  }
}

async function createProposalLinkedRecords(proposal, { budget, project, client, model, items, vars, status, calc }) {
  // Um vínculo por orçamento (grupo). Cada um guarda nome, BDI, custo e venda do grupo.
  const grupos = (calc && calc.grupos && calc.grupos.length)
    ? calc.grupos
    : [{ budgetId: budget.id, nome_grupo: budget.name || "", bdi_grupo: Number(budget.bdiPercent || 0), custo: 0, venda: Number(budget.totalPrice || 0), bdiEff: Number(budget.bdiPercent || 0), ordem: 0 }];
  for (const g of grupos) {
    await createIntegratedRecord("proposalBudgetLinks", {
      proposalId: proposal.id,
      workBudgetId: g.budgetId,
      projectId: project.id || "",
      clientId: client.id || "",
      proposalModelId: model.id || "",
      responsibleUserId: currentUser?.id || "",
      nome_grupo: g.nome_grupo || "",
      disciplina: g.disciplina || "",
      bdi_grupo: (g.bdi_grupo === "" || g.bdi_grupo == null) ? roundMoney(g.bdiEff || 0) : Number(g.bdi_grupo),
      custo_total: roundMoney(g.custo || 0),
      valor_venda: roundMoney(g.venda || 0),
      ordem: g.ordem || 0,
    });
  }
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
      groupName: item.groupName || item.stageName || "",
      visibleToClient: "Sim",
      notes: "",
      custo_unitario: Number(item.unitCost || 0),
      bdi_item: item.bdiPercent != null && item.bdiPercent !== "" ? Number(item.bdiPercent) : null,
      orcamento_item_id: item.id || "",
      sinapi_id: item.sinapi_id || "",
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
  const f = getFilters();
  const obraNome = f.projectId ? (nameOf("projects", f.projectId) || "Obra") : "Todas as obras";
  qs("content").innerHTML = `
    ${generateDocumentHeader("Relatório de Obra", `${obraNome} · ${documentPeriodSubtitle()}`)}
    <section class="module-head">
      <div>
        <h2>Relatório por obra</h2>
        <p>Resultado financeiro consolidado por obra/projeto, respeitando os filtros superiores.</p>
      </div>
    </section>
    ${table("Relatório por obra", rows, ["name", "total"])}
    ${chartPanel("Resultado por obra/projeto", "Receita menos despesas por obra", horizontalBarChart(resultByProjectRows(), "#0f766e"))}
    ${generateDocumentFooter()}
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

// DRE Híbrido: competência (resultado de direito) + conciliação de caixa
// (o que virou dinheiro) + pendências (em aberto). Substitui o DRE simples.
function renderDre() {
  // ── COMPETÊNCIA: tudo reconhecido no período (status ≠ Cancelado), exceto
  //    Repasse na receita e Investimento/Repasse na despesa.
  const recCompet = applyFilters(db.receivable).filter((r) => r.status !== "Cancelado" && categoryType(r.categoryId) !== "Repasse");
  const despCompet = applyFilters(db.payable).filter((p) => p.status !== "Cancelado" && categoryType(p.categoryId) !== "Investimento" && categoryType(p.categoryId) !== "Repasse");
  const receitaCompet = sum(recCompet, "amount");
  const despesaCompet = sum(despCompet, "amount");
  const resultadoCompet = receitaCompet - despesaCompet;
  const margemCompet = receitaCompet ? (resultadoCompet / receitaCompet) * 100 : 0;
  // ── CONCILIAÇÃO DE CAIXA: da competência, o que efetivamente virou dinheiro.
  const recebido = sum(recCompet.filter((r) => r.status === "Recebido"), "amount");
  const pago = sum(despCompet.filter((p) => p.status === "Pago"), "amount");
  const geracaoCaixa = recebido - pago;
  // ── PENDÊNCIAS: em aberto (mesma definição de openReceivable/openPayable).
  const emAberto = ["Aberto", "Vencido", "Parcial"];
  const aReceber = sum(recCompet.filter((r) => emAberto.includes(r.status)), "amount");
  const aPagar = sum(despCompet.filter((p) => emAberto.includes(p.status)), "amount");
  // ── REPASSES — conta de passagem: não compõem o resultado operacional.
  const repasseRecebido = sum(applyFilters(db.receivable).filter((r) => categoryType(r.categoryId) === "Repasse" && r.status !== "Cancelado"), "amount");
  const repassePago = sum(applyFilters(db.payable).filter((p) => categoryType(p.categoryId) === "Repasse" && p.status !== "Cancelado"), "amount");
  const saldoRepasse = repasseRecebido - repassePago;

  const repasseSection = (dreMostrarRepasse && (repasseRecebido || repassePago)) ? `
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
  ` : "";

  qs("content").innerHTML = `
    <label class="dre-toggle-repasse no-print">
      <input type="checkbox" id="dreToggleRepasse" ${dreMostrarRepasse ? "checked" : ""} />
      Incluir seção de Repasses (conta de passagem)
    </label>
    <section class="kpi-grid">
      ${kpi("Receita bruta (competência)", receitaCompet)}
      ${kpi("Resultado por competência", resultadoCompet)}
      ${kpi("Geração de caixa", geracaoCaixa)}
      ${kpi("Margem", asPercent(margemCompet), false)}
    </section>
    <section class="split">
      <div class="panel"><h3>Receitas por categoria</h3>${bars(groupByCategory(recCompet))}</div>
      <div class="panel"><h3>Despesas por categoria</h3>${bars(groupByCategory(despCompet).map((r) => ({ ...r, value: -Math.abs(r.value) })))}</div>
    </section>
    <section class="dre-bloco">
      <h3>Competência (resultado de direito)</h3>
      ${table("Competência", [
        { line: "Receita operacional bruta", amount: receitaCompet },
        { line: "(−) Despesas e custos operacionais", amount: -despesaCompet },
        { line: `= Resultado por competência (margem ${asPercent(margemCompet)})`, amount: resultadoCompet },
      ], ["line", "amount"])}
    </section>
    <section class="dre-bloco dre-caixa-section">
      <h3>Conciliação de caixa</h3>
      <p class="dre-caixa-nota">O que efetivamente entrou/saiu no período (status Recebido/Pago).</p>
      ${table("Conciliação de caixa", [
        { line: "Recebido no período", amount: recebido },
        { line: "(−) Pago no período", amount: -pago },
        { line: "= Geração de caixa real", amount: geracaoCaixa },
      ], ["line", "amount"])}
    </section>
    <section class="dre-bloco">
      <h3>Pendências</h3>
      ${table("Pendências", [
        { line: "A receber (ainda não entrou)", amount: aReceber },
        { line: "A pagar (ainda não saiu)", amount: aPagar },
      ], ["line", "amount"])}
    </section>
    ${lucroCaixaReconcSection(lucroCaixaPeriod, getFilters().projectId)}
    ${repasseSection}
  `;
  qs("dreToggleRepasse")?.addEventListener("change", (event) => {
    dreMostrarRepasse = event.target.checked;
    renderDre();
  });
  qs("dreLucroCaixaPeriod")?.addEventListener("change", (event) => {
    lucroCaixaPeriod = event.target.value;
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
    ${generateDocumentHeader(report.title, documentPeriodSubtitle())}
    <section class="module-head">
      <div>
        <h2>${report.title}</h2>
        <p>${report.description} Use os filtros superiores e exporte a visão atual em Excel ou PDF.</p>
      </div>
    </section>
    ${report.rows.length ? table(report.title, report.rows, report.fields) : '<div class="empty">Sem dados para exibir</div>'}
    ${mode === "reports" ? duplicatesReportPanel() : ""}
    <section class="split">
      <div class="panel"><h3>Fluxo de caixa</h3>${bars(cashFlowByBank())}</div>
      <div class="panel"><h3>Resultado por centro de custo</h3>${bars(resultByCostCenter())}</div>
    </section>
    ${generateDocumentFooter()}
  `;
  if (mode === "reports") wireDuplicatesReport();
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

bootstrapApp().catch((error) => {
  console.error("Falha ao iniciar o ObraSync:", error);
  try {
    showLoginPanel("login");
    qs("loginScreen").classList.remove("hidden");
    qs("appShell").classList.add("hidden");
  } catch (e) {
    /* DOM ainda não pronto: nada a fazer além do log acima. */
  }
});

// CEP autofill universal + autofill de cliente/fornecedor em qualquer form/modal.
initFormEnhancers();
