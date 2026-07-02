# Revisão de integridade de menus/submenus — ObraSync

> **Data:** 2026-07-01 · **Base:** `app.js` v1.25.1 (17.206 linhas) + `api/index.php` (12.648 linhas)
> **Escopo:** navegação da sidebar, roteamento, ícones, permissões por papel, duplicações.
> **Só diagnóstico — nada foi corrigido nesta passada.**
>
> Fontes analisadas: `modules` (app.js:87–193, 105 entradas), `sidebarSections` (198–217),
> `MODULE_ICONS` (220–233), `SUBMODULE_ICONS` (241–288), `roleLabels` (294–307),
> `roleModules` (309–328), `EDITABLE_BY_ROLE` (333–340), `visibleModules()`/`canAccessModule()`
> (2379–2390), `renderNav()` (2556–2604), `render()` (2754–2818), fallback `renderCrud()`
> (6574; `configs` em 564–1562), favoritos (16463–16522).

---

## 1. Módulos órfãos (menu sem tela correta)

**1 órfão funcional + 5 módulos que crasham se alcançados. Nenhuma função render chamada pelo roteamento é inexistente** (conferido nome a nome).

### 1.1 `reportModels` — "Modelos de relatório" abre a tela errada

- **Menu:** seção Configurações (`sidebarSections` app.js:216), label "Modelos de relatório". Config CRUD existe (app.js:1447).
- **Problema:** a linha app.js:2812 — `if (currentModule.startsWith("report") || currentModule === "reports") return renderReports(currentModule);` — intercepta `reportModels` ANTES do fallback `renderCrud`. `renderReports` (16082) não tem `reportModels` no `reportMap` e cai em `reportMap.reports` (16127).
- **Resultado:** clicar em "Modelos de relatório" abre a tela genérica "Relatórios". O CRUD de modelos de relatório (configs:1447) é **código morto inalcançável**.
- **Fix:** rotear `reportModels` explicitamente antes da linha 2812 (ou trocar o `startsWith` por lista fechada de chaves de relatório).

### 1.2 Quase-órfãos que CRASHAM via favoritos

`proposalItems`, `proposalStatusHistory`, `proposalFiles`, `proposalBudgetLinks`, `proposalVariables` estão em `modules` (app.js:130–134) mas **não têm entrada em `configs` nem rota própria**. Não aparecem na sidebar, porém a barra de favoritos (openFavoritesModal, 16497–16508) lista `visibleModules()` — que para admin/gerente/visualizador inclui as 105 chaves.

- **Resultado:** fixar um deles como favorito e clicar → `render()` → `renderCrud(key)` → `configs[key]` undefined → **TypeError em `config.fields` (app.js:6581), a tela morre**.
- **Fix:** excluir essas chaves de `visibleModules()`/favoritos, ou dar guard no `renderCrud` (`if (!config) return renderDashboard()` + toast).

---

## 2. Funções render sem menu (funcionalidade escondida)

| Função (linha) | Roteado? | Alcançável por? |
|---|---|---|
| `renderViability` (4800) — módulo `viabilityAnalyses` | SIM (render():2779) | **Nenhum item de menu.** Só via favoritos (16491) ou override de permissão. Papéis financeiro/comercial/engenharia/gestor_obra têm o módulo em `roleModules` (313/318/319/320) mas nunca o veem no menu. |
| `renderViabilidadeObra` (13034) | Não diretamente (render() chama `renderViabilidadeList` na 2780) | Chamada interna (13148/13308) no retorno de ações do detalhe — helper, não órfã de fato. |
| `renderCrud` p/ `customFieldValues` (configs:1437) e `checklistItems` (configs:1483) | fallback OK | Sem menu; só favoritos (admin/gerente/visualizador). Funcionam se alcançados. |

**Navegação programática** (`currentModule = '...'` fora do menu — todos com rota válida): `workBudgets` (4247, 4419, 5992, 15029), `ownCompositions` (5558), `cotacoes` (6624), `sales` (6718), `clients` (7645), `qualidadeFvm` (12127), `viabilidadeObra` (13583), `proposals` (14929), `projectSchedule` (15081), favoritos (16491). Nenhum módulo é alcançável SÓ por código, exceto os quase-órfãos do §1.2.

---

## 3. Ícones

- **Faltando no menu: NENHUM.** Todos os 96 submódulos têm chave em `SUBMODULE_ICONS`; `dashboard` usa o ícone da seção (`ti-layout-dashboard`, 199).
- **Ícones mortos:** `viabilityAnalyses` em `SUBMODULE_ICONS` (251) e `MODULE_ICONS` (227) — módulo sem entrada no menu.
- **Observação estrutural:** `MODULE_ICONS` (220–233) é praticamente inerte — `navButton` (2606–2611) só o consulta para itens de topo sem ícone explícito, e o único item de topo (dashboard) já recebe `section.icon`. Candidato a remoção.

---

## 4. Permissões inconsistentes

### 4.1 roleModules × menu

- `viabilityAnalyses` está em `roleModules` de financeiro (313), comercial (318), engenharia (319), gestor_obra (320) — mas nunca aparece no menu (§2).
- `proposalItems`/`proposalStatusHistory`/`proposalFiles`/`proposalBudgetLinks`/`proposalVariables`/`customFieldValues`/`checklistItems` entram em admin/gerente/visualizador (via `modules.map`) e na grade de permissões (renderPermUserModal 2444), sem existir no menu.
- **Inverso (backend permite, front esconde):** `plugins` está em `default_role_view_modules` do backend para financeiro/comercial/engenharia/gestor_obra/equipe_campo/cliente_obra/fornecedor_terceiro/consulta/operador (api/index.php:7935–7943), mas o `roleModules` do front não o dá a nenhum desses — menu Plugins invisível, API `seletividade-estudos` (389) liberada.
- `proposalAreas`/`proposalActionTypes`/`proposalServiceSubtypes`: backend dá view ao comercial (7936); front não (318) — comercial edita propostas sem ver os catálogos.

### 4.2 Módulos sensíveis × papéis

- 🔴 **`visualizador` vê TUDO** (`roleModules.visualizador = modules.map(...)`, app.js:327): `users`, `permissions`, `companySettings`, `backupLocal`, `migration`, `auditLog`, `preferences`, `plugins` e toda a seção IA. O backend confirma: `'visualizador' => '*'` (api/index.php:7944) — **GET /users devolve a lista completa de usuários a um papel "somente leitura"**. Rever se "visualizador" deveria mesmo ser um espelho total do admin sem escrita.
- 🟡 **`gerente`** (325) vê `migration`, `backupLocal`, `auditLog`, IA, `companySettings` — mas o backend nega gerente só em users/permissions (7920–7922); ver cruzamentos abaixo.
- IA visível apenas a admin/gerente/visualizador no front (215) — mas ver 4.3(1).

### 4.3 Front × backend (o gate de um lado não bate com o do outro)

1. 🔴 **IA — backend SEM gate de papel.** Front: seção `ia` restrita a admin/gerente/visualizador (app.js:215 + roleModules). Backend: `?module=ia` só exige sessão — api/index.php:229–231 e `handle_ia_module` 8899–8905 (o comentário 223–228 admite: "NÃO exigimos permissão de módulo 'ia'" — obsoleto desde que a v1.25.0 adicionou escrita). Qualquer papel autenticado (`equipe_campo`, `fornecedor_terceiro`, `cliente_obra`, `consulta`) chama TODAS as ações de IA, incluindo `startIndex` (dispara worker pesado) e **`enviarParaOrcamento` (cria registros em `orcamentos_obras`/`orcamento_obra_itens` sem permissão de workBudgets, em qualquer projectId)**. Front nega, backend permite — a direção errada da falha. *(Achado replicado como GRAVE #1 no relatório geral.)*
2. 🟡 **auditLog** — menu visível a gerente/visualizador (325/327); backend `audit-log` é `require_admin` (api/index.php:245–247). O front mitiga com gate próprio em `renderAuditLog` (16722–16723) → **item de menu morto** para gerente/visualizador.
3. 🟡 **backupLocal / migration** — menus visíveis a gerente/visualizador; `renderBackupLocal` (16205) e `renderMigration` (16259) **não** têm gate no front; backend `backup` (259–262) e `migrate` (264–269) são `require_admin`. Gerente/visualizador clicam "Baixar backup"/"Migrar agora" → 403. **Pior:** o textarea do backup (16217) despeja `JSON.stringify(db)` inteiro — para visualizador isso inclui a tabela de usuários carregada no bootstrap.
4. 🟡 **operador × Qualidade** — front dá view de `qualidadeDashboard/Fvs/Fvm/Nc` ao operador (326); `default_role_view_modules.operador` (api/index.php:7943) não tem nenhum `qualidade*` → bootstrap devolve listas vazias (`bootstrap_data` filtra por `role_can`, 2473–2488) e GET REST responde 403 — **mas `default_role_edit_modules.operador` (7956) PERMITE criar/editar qualidadeFvs/Fvm/Nc**. Operador grava fichas que nunca consegue listar.
5. 🟡 **consulta/equipe_campo/cliente_obra — relatórios zerados** — front/back dão view de cashFlow/dre/reports ao consulta (324 ↔ 7942), mas as telas derivam de `db.receivable/payable/journalEntries`, que o bootstrap não entrega a esse papel → relatórios renderizam zerados (parecem bug). Mesmo padrão para equipe_campo/cliente_obra em `projectReport`.
6. 🟡 **Chaves divergentes front/back** — menu `viabilidadeObra` ↔ backend autoriza como `viabilityAnalyses` (192–193); menu `cotacoes` ↔ backend autoriza como `purchaseOrders` (210–211). `permission_module_key` (7704–7723) não mapeia nenhum dos dois — **overrides por usuário gravados na grade para `viabilidadeObra`/`cotacoes` nunca são consultados pelo backend**.

---

## 5. Duplicações / sobreposições

| # | Módulos | Sobreposição | Sugestão |
|---|---|---|---|
| 1 | `quotes` (Orçamento de Obra, configs:893) × `cotacoes` (Obras/Projetos, renderCotacoes 12662) | **Dois itens de menu com o MESMO label "Cotações"** — quotes = CRUD manual de cotações de preço p/ itens de orçamento; cotacoes = importação/comparação de arquivos de fornecedores (backend handle_cotacoes_module 3265) | Consolidar sob `cotacoes` ou renomear `quotes` → "Cotações manuais" |
| 2 | `projectReport` ("Relatório por obra", renderProjectReport 15121) × `reportProject` ("Relatório por obra/projeto", renderReports 16120–16125) | Ambos agregam `resultByProjectRows()` (15122 ↔ 16123) — mesma fonte, mesma tabela | Eliminar `reportProject` (ou o inverso) |
| 3 | `fiscalDocuments` ("Notas Fiscais / Doc. Fiscais", Obras) × `taxDocuments` ("Documentos fiscais", Contabilidade) | Labels colidem; o 1º é NF/NFS-e importadas com XML/PDF, o 2º é documento fiscal contábil simples | Renomear `taxDocuments` ou fundir no primeiro |
| 4 | `viabilityAnalyses` ("Viabilidade Financeira", legado sem menu) × `viabilidadeObra` ("Análise de Viabilidade", tabelas `viabilidade_*`) | Dois módulos de viabilidade; o legado sobrevive em roleModules/ícones/rota | Aposentar `viabilityAnalyses` (remover de roleModules/ícones/rota) ou devolvê-lo ao menu conscientemente |
| 5 | `budgets` ("Orçamentos", Comercial) × `workBudgets` ("Orçamentos de Obras") | Propósitos distintos (comercial simplificado × obra completo com etapas/BDI/SINAPI), nomenclatura colide | Manter, mas rotular `budgets` → "Orçamentos comerciais" |

---

## 6. Mapa completo (seção → módulo → render → ícone → papéis)

Render existe? = função chamada pelo roteamento existe e mostra a tela certa. (\*) = ressalva.

| Seção | moduleKey | Label | Render existe? | Ícone? | Papéis que veem |
|---|---|---|---|---|---|
| Dashboard | dashboard | Dashboard ObraSync | renderDashboard | sim (seção) | todos os 12 papéis |
| Cadastros | clients | Clientes | renderCrud (config OK) | sim | admin, financeiro, comercial, gerente, operador, visualizador |
| Cadastros | suppliers | Fornecedores | renderCrud (config OK) | sim | admin, financeiro, gerente, operador, visualizador |
| Cadastros | products | Produtos | renderCrud (config OK) | sim | admin, gerente, operador, visualizador |
| Cadastros | services | Serviços | renderCrud (config OK) | sim | admin, gerente, operador, visualizador |
| Cadastros | categories | Categorias financeiras | renderCrud (config OK) | sim | admin, financeiro, gerente, operador, visualizador |
| Cadastros | costCenters | Centros de custo | renderCostCenters | sim | admin, financeiro, gerente, operador, visualizador |
| Cadastros | bankAccounts | Contas bancárias | renderCrud (config OK) | sim | admin, financeiro, gerente, operador, visualizador |
| Comercial | budgets | Orçamentos | renderCrud (config OK) | sim | admin, comercial, gerente, operador, visualizador |
| Comercial | proposals | Propostas | renderCrud (config OK) | sim | admin, financeiro, comercial, engenharia, gestor_obra, gerente, operador, visualizador |
| Comercial | proposalModels | Modelos de propostas | renderCrud (config OK) | sim | admin, comercial, gerente, visualizador |
| Comercial | proposalAreas | Áreas/Disciplinas | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Comercial | proposalActionTypes | Tipos de atuação | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Comercial | proposalServiceSubtypes | Subtipos/Serviços | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Comercial | sales | Vendas/Contratos | renderCrud (config OK) | sim | admin, financeiro, comercial, gerente, operador, visualizador |
| Viabilidade | viabilidadeObra | Análise de Viabilidade | renderViabilidadeList | sim | admin, financeiro, comercial, engenharia, gestor_obra, gerente, visualizador |
| Obras/Projetos | projects | Obras/Projetos | renderCrud (config OK) | sim | admin, financeiro, comercial, engenharia, gestor_obra, gerente, operador, visualizador |
| Obras/Projetos | cotacoes | Cotações | renderCotacoes | sim | admin, engenharia, gestor_obra, gerente, operador, visualizador |
| Obras/Projetos | projectCosts | Custos por obra | renderProjectCosts | sim | admin, gerente, operador, visualizador |
| Obras/Projetos | projectRevenues | Receitas por obra | renderProjectRevenues | sim | admin, gerente, operador, visualizador |
| Obras/Projetos | fiscalDocuments | Notas Fiscais / Doc. Fiscais | renderCrud (config OK) | sim | admin, financeiro, engenharia, gestor_obra, gerente, operador, visualizador |
| Obras/Projetos | rdo | Diário de Obra (RDO) | renderRdo | sim | admin, engenharia, gestor_obra, gerente, operador, visualizador |
| Obras/Projetos | projectNotifications | Notificações da obra | renderCrud (config OK) | sim | admin, engenharia, gestor_obra, gerente, visualizador |
| Obras/Projetos | projectTrackingLinks | Links de acompanhamento | renderCrud (config OK) | sim | admin, engenharia, gestor_obra, gerente, visualizador |
| Obras/Projetos | projectReport | Relatório por obra | renderProjectReport | sim | admin, engenharia, gestor_obra, equipe_campo, cliente_obra, consulta, gerente, operador, visualizador |
| Qualidade PBQP-H | qualidadeDashboard | Dashboard Qualidade | renderQualidadeDashboard | sim | admin, financeiro, engenharia, gestor_obra, consulta, gerente, operador, visualizador |
| Qualidade PBQP-H | qualidadePolitica | Política da Qualidade | renderQualidadePolitica | sim | admin, gerente, visualizador |
| Qualidade PBQP-H | qualidadePes | Procedimentos (PES) | renderQualidadePes | sim | admin, engenharia, gestor_obra, gerente, visualizador |
| Qualidade PBQP-H | qualidadePqo | Plano da Obra (PQO) | renderQualidadePqo | sim | admin, engenharia, gestor_obra, gerente, visualizador |
| Qualidade PBQP-H | qualidadeFvs | Fichas de Serviço (FVS) | renderQualidadeFvs | sim | admin, engenharia, gestor_obra, gerente, operador, visualizador |
| Qualidade PBQP-H | qualidadeFvm | Fichas de Material (FVM) | renderQualidadeFvm | sim | admin, engenharia, gestor_obra, gerente, operador, visualizador |
| Qualidade PBQP-H | qualidadeNc | Não Conformidades (NC) | renderQualidadeNc | sim | admin, engenharia, gestor_obra, gerente, operador, visualizador |
| Qualidade PBQP-H | qualidadeTreinamentos | Treinamentos | renderQualidadeTreinamentos | sim | admin, engenharia, gestor_obra, gerente, visualizador |
| Qualidade PBQP-H | qualidadeAuditorias | Auditorias Internas | renderQualidadeAuditorias | sim | admin, gerente, visualizador |
| Orçamento de Obra | workBudgets | Orçamentos de Obras | renderWorkBudgets | sim | admin, financeiro, comercial, engenharia, gestor_obra, gerente, operador, visualizador |
| Orçamento de Obra | workBudgetItems | Itens do orçamento | renderCrud (config OK) | sim | admin, financeiro, engenharia, gestor_obra, gerente, operador, visualizador |
| Orçamento de Obra | sinapiReferences | Base SINAPI | renderSinapiReferences | sim | admin, financeiro, engenharia, gestor_obra, gerente, operador, visualizador |
| Orçamento de Obra | sinapiInputs | Insumos SINAPI | renderCrud (config OK) | sim | admin, financeiro, engenharia, gestor_obra, gerente, operador, visualizador |
| Orçamento de Obra | sinapiCompositions | Composições SINAPI | renderCrud (config OK) | sim | admin, financeiro, engenharia, gestor_obra, gerente, operador, visualizador |
| Orçamento de Obra | sinapiCompositionItems | Itens das composições SINAPI | renderCrud (config OK) | sim | admin, financeiro, engenharia, gestor_obra, gerente, visualizador |
| Orçamento de Obra | sinapiLabor | Mão de obra SINAPI | renderCrud (config OK) | sim | admin, financeiro, engenharia, gestor_obra, gerente, visualizador |
| Orçamento de Obra | sinapiFamilies | Famílias e coeficientes | renderCrud (config OK) | sim | admin, financeiro, engenharia, gestor_obra, gerente, visualizador |
| Orçamento de Obra | sinapiMaintenances | Manutenções SINAPI | renderCrud (config OK) | sim | admin, financeiro, engenharia, gestor_obra, gerente, visualizador |
| Orçamento de Obra | ownCompositions | Composições Próprias | renderCrud (config OK) | sim | admin, financeiro, engenharia, gestor_obra, gerente, operador, visualizador |
| Orçamento de Obra | quotes | Cotações | renderCrud (config OK) | sim | admin, financeiro, engenharia, gestor_obra, gerente, operador, visualizador |
| Orçamento de Obra | abcCurve | Curva ABC | renderAbcCurve | sim | admin, financeiro, comercial, engenharia, gestor_obra, gerente, operador, visualizador |
| Orçamento de Obra | purchaseOrders | Pedidos de compra | renderCrud (config OK) | sim | admin, engenharia, gestor_obra, gerente, operador, visualizador |
| Planejamento | projectSchedule | Cronograma Físico-Financeiro | renderProjectSchedule | sim | admin, financeiro, comercial, engenharia, gestor_obra, cliente_obra, gerente, operador, visualizador |
| Planejamento | projectMilestones | Marcos da obra | renderCrud (config OK) | sim | admin, engenharia, gestor_obra, gerente, operador, visualizador |
| Planejamento | agenda | Agenda | renderAgenda | sim | admin, financeiro, comercial, engenharia, gestor_obra, gerente, operador, visualizador |
| Planejamento | kanban | Kanban | renderKanban | sim | admin, financeiro, comercial, engenharia, gestor_obra, gerente, operador, visualizador |
| Planejamento | technicalReports | Relatórios técnicos | renderCrud (config OK) | sim | admin, engenharia, gestor_obra, cliente_obra, gerente, visualizador |
| Financeiro | receivable | Contas a receber | renderCrud (config OK) | sim | admin, financeiro, gerente, operador, visualizador |
| Financeiro | payable | Contas a pagar | renderCrud (config OK) | sim | admin, financeiro, gerente, operador, visualizador |
| Financeiro | cashMoves | Movimentações de caixa | renderCrud (config OK) | sim | admin, financeiro, gerente, operador, visualizador |
| Financeiro | cashFlow | Fluxo de caixa | renderCashFlow | sim | admin, financeiro, consulta, gerente, operador, visualizador |
| Financeiro | reconciliation | Conciliação bancária | renderReconciliation | sim | admin, financeiro, gerente, operador, visualizador |
| Contabilidade | chartAccounts | Plano de contas | renderCrud (config OK) | sim | admin, financeiro, gerente, visualizador |
| Contabilidade | journalEntries | Lançamentos contábeis | renderCrud (config OK) | sim | admin, financeiro, gerente, visualizador |
| Contabilidade | dre | DRE gerencial | renderDre | sim | admin, financeiro, consulta, gerente, visualizador |
| Contabilidade | taxDocuments | Documentos fiscais | renderCrud (config OK) | sim | admin, financeiro, gerente, visualizador |
| Contabilidade | taxes | Impostos | renderCrud (config OK) | sim | admin, financeiro, gerente, visualizador |
| Relatórios | reports | Relatórios | renderReports("reports") | sim | admin, financeiro, consulta, gerente, operador, visualizador |
| Relatórios | reportFinancial | Relatório financeiro | renderReports OK | sim | admin, financeiro, consulta, gerente, operador, visualizador |
| Relatórios | reportClient | Relatório por cliente | renderReports OK | sim | admin, financeiro, comercial, consulta, gerente, operador, visualizador |
| Relatórios | reportSupplier | Relatório por fornecedor | renderReports OK | sim | admin, financeiro, consulta, gerente, operador, visualizador |
| Relatórios | reportCostCenter | Relatório por centro de custo | renderReports OK | sim | admin, financeiro, consulta, gerente, operador, visualizador |
| Relatórios | reportProject | Relatório por obra/projeto | renderReports OK | sim | admin, financeiro, engenharia, gestor_obra, consulta, gerente, operador, visualizador |
| Relatórios | exports | Exportações | renderExports | sim | admin, financeiro, consulta, gerente, visualizador |
| Plugins | (dinâmico) | itens de db.plugins | abre em nova aba (2563–2584) | seção | quem vê `plugins` |
| IA | iaBusca | Busca semântica | renderIaBusca | sim | admin, gerente, visualizador |
| IA | iaDepara | De-para em lote | renderIaDepara | sim | admin, gerente, visualizador |
| IA | iaCompara | Comparador de orçamento | renderIaCompara | sim | admin, gerente, visualizador |
| IA | iaIndex | Indexação SINAPI | renderIaIndex | sim | admin, gerente, visualizador |
| IA | iaTest | Teste de IA | renderIaTest | sim | admin, gerente, visualizador |
| Configurações | companySettings | Dados da empresa | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | users | Usuários | renderCrud (config OK) | sim | admin, **visualizador** |
| Configurações | permissions | Permissões | renderCrud (config OK) | sim | admin, **visualizador** |
| Configurações | systemVersion | Versão do Sistema | renderSystemVersion | sim | todos exceto consulta e operador |
| Configurações | workTypes | Tipos de obra | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | workStatuses | Status de obra | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | standardStages | Etapas padrão | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | standardMilestones | Marcos padrão | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | customFields | Campos personalizados | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | reportModels | Modelos de relatório | **NÃO(\*)** — desviado p/ renderReports genérico (2812) | sim | admin, gerente, visualizador |
| Configurações | documentTypes | Tipos de documento | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | checklists | Checklists | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | measurementTypes | Tipos de medição | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | paymentMethods | Formas de pagamento | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | whatsappTemplates | Mensagens padrão | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | visibilityRules | Regras de visualização | renderCrud (config OK) | sim | admin, gerente, visualizador |
| Configurações | sinapiSettings | Configuração SINAPI | renderSinapiSettingsModule | sim | admin, financeiro, gerente, visualizador |
| Configurações | plugins | Plugins | renderPlugins | sim | admin, gerente, visualizador |
| Configurações | backupLocal | Backup local | renderBackupLocal (\*403 p/ não-admin) | sim | admin, gerente, visualizador |
| Configurações | preferences | Preferências do sistema | renderPreferences | sim | admin, gerente, visualizador |
| Configurações | migration | Migração para banco | renderMigration (\*403 p/ não-admin) | sim | admin, gerente, visualizador |
| Configurações | auditLog | Log de Auditoria | renderAuditLog (\*bloqueia não-admin no front) | sim | admin, gerente, visualizador |
| Configurações | myProfile | Meu Perfil | renderMyProfile | sim | admin, gerente, operador, visualizador |

---

## Sumário

| Métrica | Valor |
|---|---|
| Entradas fixas no menu | 97 (13 seções + Dashboard) + lançador dinâmico de Plugins |
| Chaves em `modules[]` | 105 (8 fora do menu) |
| Órfãos (menu → tela errada) | **1** (`reportModels`, desviado pelo `startsWith("report")` em app.js:2812) |
| Módulos que crasham via favoritos | **5** (`proposalItems`, `proposalStatusHistory`, `proposalFiles`, `proposalBudgetLinks`, `proposalVariables` — sem `configs`) |
| Renders sem menu | **1** (`viabilityAnalyses`/renderViability) + 2 menu-less funcionais (`customFieldValues`, `checklistItems`) |
| Sem ícone no menu | **0** (1 chave morta: `viabilityAnalyses`) |
| Inconsistências de permissão | **6** (IA sem gate no backend; auditLog/backup/migration p/ gerente-visualizador vs require_admin; visualizador = '*'; operador Qualidade edit-sem-view; relatórios zerados p/ consulta; chaves viabilidadeObra/cotacoes sem mapeamento no backend) |
| Duplicações | **5** (destaque: dois menus com o mesmo label "Cotações"; dois relatórios por obra idênticos) |

### Prioridades sugeridas

1. 🔴 Gate de papel no `?module=ia` do backend (fecha também o achado GRAVE #1 do relatório geral).
2. 🔴 Guard no `renderCrud`/favoritos para módulos sem `configs` (crash de tela).
3. 🟡 Rever `visualizador = *` (users/permissions/backup completo para papel somente-leitura).
4. 🟡 Rotear `reportModels` corretamente (antes do `startsWith("report")`).
5. 🟡 Mapear `viabilidadeObra`→`viabilityAnalyses` e `cotacoes`→`purchaseOrders` em `permission_module_key` (overrides por usuário hoje inócuos).
