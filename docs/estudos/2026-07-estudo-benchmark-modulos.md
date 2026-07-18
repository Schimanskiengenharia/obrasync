# Estudo — Módulos ObraSync: inventário interno + benchmark de mercado

**Data:** 2026-07-18 · **Spec:** `docs/superpowers/specs/2026-07-18-estudo-benchmark-modulos-design.md`
**Status:** em produção (seções são preenchidas por etapas; "pendente" = etapa ainda não executada)

Como usar este documento: cada frente termina numa tabela de recomendações.
Marque a coluna **Decisão** de cada linha com **sim** ou **não**. Cada item
aprovado vira um ciclo próprio de spec → plano → implementação (por etapas).

## Resumo executivo

pendente

## Frente 1 — Padrão de verificação de erros

### Como é hoje

#### Telas e ações
- `saveForm(event)` (`app.js:8577`) — handler central: chama `validateCurrentForm` (`app.js:8757`) e envolve a persistência em `try/catch` que exibe `alert("Não foi possível salvar: ...")` (`app.js:8709-8711`). Erros de validação também via `alert()` bloqueante, não `showToast`.
- `apiRequest`/`fetchForm` (`app.js:1929/1949`): falha de rede vira `Error("Falha de conexão...")`; ambos delegam a `handleApiResponse` (`app.js:1893`) — JSON inválido lança "O servidor respondeu em formato inesperado (HTTP ...)"; 401 → limpa sessão + `showLogin`; `!ok || success:false` → lança a mensagem do payload.
- `showToast` (`app.js:18640`): usado para sucesso/aviso, raramente para erro. Muitos `.catch(() => {})` silenciosos (`app.js:7157, 8724, 8732, 17127, 17155`).
- **NÃO há `window.onerror`/`unhandledrejection` global** (0 ocorrências).
- Validações client-side: só e-mail/CPF-CNPJ/telefone para `clients`/`suppliers`/`companySettings` + bloco de `users`; formulários de financeiro/orçamento/obras dependem do backend.

#### Endpoints
- REST: `respond()` → `{ok:true,data}` e `fail()` → `{ok:false,error}` + status (`api/index.php:1783/1790`). Módulos `?module=`: padrão `{success,data,message}` com helpers próprios (`agenda_respond`, `payable_respond`, `cotacao_respond`...), cada um com `try/catch` que loga `[ObraSync <mod>]`.
- Catch global `Throwable` (`api/index.php:881-886`): loga no `error_log` e responde `fail('Erro interno no servidor…',500)` — nunca vaza SQL/stack.
- Códigos: 400 (payload), 422 (regra de negócio/dependência ausente), 401/403 (auth), 405, 500.

#### Tabelas e colunas-chave
- `audit_log` via `server_audit()` (`api/index.php:8938`): userId/username/role/action/module/recordId/details(400 chars)/ip — só MUTAÇÕES (~91 chamadas); leituras não são auditadas; falha de auditoria nunca derruba a operação.
- `login_attempts` (rate limit). Config: `display_errors=0` + `log_errors=1` no topo (`api/index.php:15-16`).

#### Limitações e lacunas observadas
- Sem captura global de erros JS: exceção não tratada em render/handler morre no console sem feedback ao usuário; `.catch(() => {})` engolem falhas silenciosamente.
- Erros de gravação usam `alert()` bloqueante, inconsistente com `showToast`; o 500 genérico não tem código de correlação para achar a linha no `error_log`.
- Validação client-side pontual (3 cadastros); backend valida principalmente tipos/documentos — pouca checagem de obrigatórios de negócio.
- Destino do `error_log` PHP não é fixado (vai para o log padrão do servidor); não há tabela/endpoint de erros de aplicação — diagnóstico depende de `audit_log` (só mutações) + log do SO.
- Dois formatos de resposta coexistem (`{ok,error}` vs `{success,message}`) — superfície de inconsistência.

### Boas práticas do mercado

pendente

### Roteiro de verificação sob demanda

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 2 — Fluxo comercial de serviços

### Como é hoje

#### Telas e ações
- **Cadastros:** CRUD genérico (`renderCrud`) para `clients`/`suppliers`; autofill CEP (`setupClientAutofill` `app.js:7671`, `setupSupplierAutofill` `app.js:7771`, ViaCEP/BrasilAPI).
- **Custo da Obra:** `renderWorkBudgets` (`app.js:10831`) — itens, etapas, base SINAPI, BDI; botão "Gerar proposta" → `openProposalGenerator` (`app.js:15263`).
- **Proposta:** painel de orçamentos vinculados (`renderProposalGroupsPanel` `app.js:15535`), documento (`proposalDocumentHtml` `app.js:15894`), modelos (`saveProposalAsTemplate`/`applyProposalTemplate`), salvar → `createProposalLinkedRecords` (`app.js:16638`).
- **Aprovação (não há botão):** o usuário edita o campo Status → "Aprovada". Na lista, botões pós-aprovação (`app.js:7245`): "Converter", "Gerar contas" (`createReceivablesFromProposal`), "Gerar contrato" (`generateContractFromProposal`), "Prévia/PDF".
- **Cotações/compras:** `renderCotacoes` (`app.js:13167`) — cotação por material, consolidado, anexar NF; matriz item×fornecedor + "Gerar pedido de compra (vencedores)".

#### Endpoints
- **Aprovação da proposta (PUT transacional, `api/index.php:657-843`):** reusa obra ou cria `projects` + boards kanban + `orcamentos_obras`, copia `proposta_itens`→`orcamento_obra_itens`; guarda anti-reaprovação; registra `eventos_automacao`.
- Módulo cotações (`handle_cotacoes_module` `api/index.php:3682`): materialList/Salvar/Concluir (regra N cotações), consolidado + `materialGerarConta` (uma conta a pagar por empresa), `compraMatriz`/`compraGerarPedido`/`comprasRegistrar` (F5.3: NF + conta + `quantidade_realizada`).
- `automate_approved_purchase_order` (`api/index.php:13898`); viabilidade pode bloquear proposta (`check_bloqueio` `:5567`).

#### Tabelas e colunas-chave
- `commercial_proposals` (`clientId`, `amount`, `status`, `projectId`, `bdi_geral`, `custo_total_orcamentos`); `proposta_itens` (`proposalId`, `custo_unitario`, `bdi_item`, `orcamento_item_id`, `sinapi_id`, `grupo_id`); `proposta_orcamento_vinculos` (UNIQUE proposalId+workBudgetId; `nome_grupo`, `disciplina`, `bdi_grupo`, `custo_total`, `valor_venda`); `proposta_grupos` (**dormente**); `proposta_modelos`.
- `orcamentos_obras` + `orcamento_obra_itens`; `projects` (**sem coluna `proposalId`** — back-link só por `eventos_automacao`); `sales_contracts` (snapshot do cliente); `cotacoes`/`cotacao_itens`/`purchase_orders`/`fiscal_documents`/`accounts_payable`.

#### Limitações e lacunas observadas
- **Aprovação é implícita:** digitar Status="Aprovada" na edição — nada sinaliza que isso cria obra+orçamento.
- **Cópia de itens empobrecida na aprovação** (`api/index.php:776-807`): grava só `origin='Item livre'` + custos/BDI/stageName — **perde `etapa_id`, `tipo`, `sinapi_id`, `categoryId`, `orcamento_item_id`**.
- **Contas a receber e contrato NÃO nascem na aprovação:** são 3 ações manuais separadas na lista; não herda endereço/prazos nem cria centro de custo.
- **`proposta_grupos` dormente:** nunca é gravada; `proposta_itens.grupo_id` fica nulo; documento descreve objeto único (multi-disciplina parcial).
- **Ambiguidade de navegação:** dois "orçamentos" no menu (`budgets` comercial vs `workBudgets`) e dois módulos "Cotações" (`quotes` antigo vs `cotacoes`).
- **Funil fragmentado:** fechar uma venda de serviços atravessa ~5 módulos (Custo da Obra → gerador de proposta → editar status → gerar contas/contrato/anexos → cotação → pedido → NF) sem um wizard único.

### Como o mercado faz

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 3 — Gantt / linha do tempo

### Como é hoje

#### Telas e ações
- Módulo `projectSchedule` ("Cronograma Físico-Financeiro"), render em `app.js:9890` (`renderProjectSchedule`); despacho em `app.js:2835`. Sidebar "Planejamento" (`app.js:225`).
- Ações da tela (`app.js:9903-9910`): Nova etapa, Enviar atualização por WhatsApp (`createWhatsappUpdate`), Exportar MS Project (`exportMsProjectXml` `app.js:10028`), Importar XML MS Project (`importMsProjectXml` `app.js:10082`), Exportar CSV, Exportar PDF/impressão, seletor de obra.
- Componentes: KPIs físico/financeiro previsto×realizado + saldo/atrasos (`app.js:9924`); Gantt (`ganttChart` `app.js:9984`); cards por etapa (`scheduleStepCards` `app.js:9955`); tabela de etapas.
- Módulo irmão `projectMilestones` ("Marcos da obra", `app.js:981`) — CRUD de marcos; mudar status para Concluído/Aprovado dispara a automação. Métricas em `scheduleMetrics` (`app.js:3796`).

#### Endpoints
- REST CRUD genérico via `resource_map` (`api/index.php:1826-1828`): `projectSchedule`→`obra_cronograma_etapas`, `projectMilestones`→`obra_cronograma_marcos`, `projectNotifications`→`obra_notificacoes`.
- PUT/PATCH de etapa passa por gate PBQP-H `qualidade_bloqueio_etapa` (`api/index.php:631`).
- Automação transacional no `update_record` (`api/index.php:2100-2122`): marco com status→Concluído/Aprovado ⇒ `automate_approved_milestone` (`api/index.php:13816`). Sem endpoint de import server-side: MS Project é 100% no front (parse XML via `DOMParser`, cria etapas uma a uma pelo CRUD REST).

#### Tabelas e colunas-chave
- `obra_cronograma_etapas` (`schema.sql:186`): `stageName, sortOrder, plannedStart/EndDate, actualStart/EndDate, planned/actualPhysicalPercent, planned/actualFinancialAmount, status, responsible, isMilestone, milestoneName/Message, visibleToClient`. Colunas de Gantt/MSP (`predecessorIds, durationDays, workBudgetId, workBudgetItemId`) vêm da migration `2026-06-08-sinapi-msproject-editable-structures.sql`.
- `obra_cronograma_marcos` (`schema.sql:222`): `scheduleStepId`, `name`, `plannedDate`, `completedDate`, `status` (Pendente/Concluído/Cancelado), `conta_receber_id`.
- Aprovação de marco: idempotente por `referencia_tipo='MARCO'`+`referencia_id`; valor = `valor_contrato × percentual/100`, vencimento = data+`prazo_pagamento` (default 30d); insere em `accounts_receivable`, grava `conta_receber_id` no marco e cria evento de agenda (`create_milestone_billing_event`).

#### O que a spec futura já prevê
A spec `docs/specs/cronograma-fisico-financeiro.md` descreve expansão em 7 fases (MS Project é a última): **EAP** por pacotes (`eap_pacotes`, peso físico/financeiro por item); **dependências** entre atividades nos 4 tipos (TI/II/TT/IT) com lag; **medição** física e financeira separadas (`medicoes`/`medicao_itens`) integradas a contas a receber/pagar; **baseline** versionado (Baseline 0/1/2 vs Realizado); **risco** com classificação automática ligada a caminho crítico, materiais, caixa; e **curvas S** física e financeira, com curva contratual de pagamento (30/60/90/120 dias) distinta do avanço físico. Tabelas ainda inexistentes: `atividades`, `atividade_dependencias`, `eap_pacotes`, `medicoes`, `baseline_cronograma`, `riscos`, entre outras.

#### Limitações e lacunas observadas
- O Gantt atual (`ganttChart` `app.js:9984`) mostra **apenas etapas** (barra prevista × realizada, linha "hoje" e ponto de marco). NÃO plota pagamentos, compras, medições nem dependências/caminho crítico; `predecessorIds` só é usado no export/import MS Project, não desenhado.
- Sem EAP hierárquica (lista plana por `sortOrder`), sem caminho crítico, sem baseline, sem curva S (KPIs são médias/somatórios simples).
- Percentual físico é média aritmética das etapas (não ponderada por peso); `scheduleMetrics` mistura marcos de `projectMilestones` com etapas `isMilestone`.
- Import MS Project: só XML (sem `.mpp`); lê Name/Start/Finish/Duration/PercentComplete/Cost/Milestone/PredecessorLink; dedup por nome; não trata calendários/recursos.
- WhatsApp é manual (link `wa.me`); medição→financeiro só existe via aprovação de marco (proporcional ao contrato), sem medição por item/quantidade.

### Como o mercado faz

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 4 — Agenda

### Como é hoje

#### Telas e ações
- `renderAgenda()` (`app.js:9146`) só chama `renderAgendaWeek()` (`app.js:9187`) — **existe apenas a visão SEMANA**. Helpers de mês/dia (`agendaViewLabel`/`agendaPeriodLabel`, `app.js:9789-9800`) existem mas nunca são renderizados (código morto).
- Toolbar: "Semana anterior / Hoje / Próxima semana"; KPIs (`agendaKpiHtml` `app.js:9573`): Total, Hoje, Em aberto, Próximo compromisso.
- Formulário (`agendaFormHtml` `app.js:9491`): Data, Horário inicial/final, Título, Tipo, Responsável, Cliente, Obra, Observações (=`descricao`), **Status** (agendado/em_andamento/concluido/cancelado). Criação retroativa bloqueada.
- **Conclusão**: existe via select de status (sem botão rápido). **Cores**: sem cor por evento — eventos manuais coloridos por tipo+status (CSS); financeiros com mapa fixo `AGENDA_FIN_COLORS` (`app.js:9292`) e legenda só deles.
- **Atrasado**: destaque vermelho **só para eventos financeiros** (`app.js:9319`); eventos manuais não têm marcação de atraso.
- **Notas**: só o campo `descricao`. **Recorrência**: inexistente. **Lembretes**: coluna `lembrete_minutos` existe (default 60) mas sem UI nem disparo — campo dormente.

#### Endpoints
- `handle_agenda_module` (`api/index.php:889`), permissão `agenda`. Actions: `list` (filtros obra/tipo/período), `feed` (consolidado, `api/index.php:1464`), `get`, `create`, `update`, `delete`. Também no `resource_map` como `agendaEvents`.

#### Tabelas e colunas-chave
- `agenda_eventos` (`schema.sql:277` + `ensure_agenda_tables`): `obra_id`, `cliente_id`, `usuario_id`, `titulo`, `descricao`, `tipo ENUM(11 valores)`, `data_inicio/fim DATETIME`, `dia_todo`, `lembrete_minutos`, `status ENUM(agendado,em_andamento,realizado,concluido,cancelado)`.
- **Não há** coluna de cor nem de recorrência; nenhum vínculo FK com contas a pagar/receber.

#### Limitações e lacunas observadas
- **Eventos financeiros não são persistidos**: cards de A Receber/A Pagar/Marcos/Pedidos são calculados em runtime (`agendaFinancialEvents` `app.js:9306` no front; `agenda_feed` no back) — não viram linhas em `agenda_eventos`.
- Única ponte que grava evento real (aprovação de marco → evento cobrança) só funciona no modo local (`createLocalMilestoneBillingEvent` `app.js:8867` faz `db.agendaEvents.push`, não persiste via API).
- Faltam: visão mês/dia, cor por evento, atraso para eventos manuais, recorrência, lembretes efetivos, botão rápido de concluir.
- Divergência de opções de tipo/status entre `agendaFormHtml` e o form genérico `openForm` (`app.js:1005-1010`); `status='realizado'` existe no banco mas não é ofertado na tela.

### Como o mercado faz

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 5 — Kanban

### Como é hoje

#### Telas e ações
- `renderKanban()` (`app.js:9150`): seletor de board, colunas ordenadas por `ordem`, botão "Novo card". **Não há UI para criar/editar/excluir colunas nem boards.**
- `kanbanColumnHtml()` (`app.js:9692`): header com nome, cor da coluna e contador `cards.length/limite_cards`. `kanbanCardHtml()` (`app.js:9707`): título, descrição, responsável, prazo, badge de prioridade e classe `overdue`.
- Drag-and-drop (`app.js:9176-9182` → `moveKanbanCard()` `app.js:9726`): grava `coluna_id` + `ordem = Date.now()`; ao cair em "Concluído" com `referencia_tipo`, apenas `confirm`+`alert` (não altera o item de origem).
- Dashboard: widget "Kanban urgente/atrasado" (`urgentKanbanCards` `app.js:4856`).

#### Endpoints
- Sem handler dedicado — CRUD 100% genérico via `resource_map()` (`api/index.php:1831-1833`): `kanbanBoards`→`kanban_boards`, `kanbanColumns`→`kanban_colunas`, `kanbanCards`→`kanban_cards`; permissão `'kanban'`.
- Automações backend: `ensure_project_kanban_boards()` (`api/index.php:13969`, cria boards `obra` e `compras` da obra); `create_purchase_order_kanban_card()` (`:14023`, pedido de compra vira card `referencia_tipo='PEDIDO_COMPRA'`).

#### Tabelas e colunas-chave
- `kanban_boards`: `obra_id`, `nome`, `tipo ENUM('obra','compras','geral')`.
- `kanban_colunas`: `board_id` (FK CASCADE), `nome`, `ordem`, `cor`, `limite_cards INT NULL` (campo WIP declarado). Colunas padrão: "A fazer", "Em andamento", "Aguardando aprovação", "Concluído".
- `kanban_cards`: `coluna_id`, `obra_id`, `titulo`, `descricao`, `responsavel_id`, `data_vencimento`, `prioridade ENUM(baixa/media/alta/urgente)`, `referencia_tipo/id`, `ordem`.

#### Limitações e lacunas observadas
- Sem CRUD de colunas/boards na UI (só defaults semeados ou chamada API direta).
- `limite_cards` (WIP) é apenas exibido; `moveKanbanCard` NÃO bloqueia o drop ao estourar o limite.
- Card sem etiquetas/tags, checklists, comentários e anexos.
- Atraso (`overdue`) é só visual no front; sem alerta/cron dedicado.
- Mover para "Concluído" não sincroniza o item de origem (só `alert`); "Concluído" é detectado por NOME da coluna (`kanban_card_is_done`) — renomear quebra a regra.
- Reordenação por `ordem = Date.now()` no drop; sem reordenamento fino dentro da coluna.

### Como o mercado faz

**Trello**
- Etiquetas coloridas e nomeadas nos cartões, usadas inclusive como gatilho/filtro de automação [1].
- Checklists avançados com prazo e responsável por item de subtarefa [2].
- Automação Butler por regras (gatilho "mover cartão para lista" → ação: mover, atribuir, aplicar etiqueta, definir prazo) e por data de vencimento (ex.: 1 dia antes, mover e marcar "Urgente") [1][3].
- Comentários com menção (@) que notificam, e anexos renomeáveis/reordenáveis por arrastar [4][6].
- Criação/edição/movimentação de listas e cartões pela própria UI, incl. mover cartão entre quadros [5].

**Jira**
- Limite WIP por coluna: ao estourar, o fundo da coluna fica vermelho como alerta visual (não bloqueia o drop) [7].
- Swimlanes (raias horizontais) configuráveis por consulta JQL, com raia padrão "Everything Else" [7][8].
- Colunas configuráveis em Board Settings, cada uma mapeada a um ou mais status do fluxo (o "Concluído" vem do status, não do nome digitado) [8].

**Monday.com**
- Coluna de Status com até 40 rótulos coloridos e descrição por rótulo [9].
- Automações (nativas e entre quadros) que atualizam itens, notificam, mudam status e movem itens conforme regras [11][12].
- Ao mover item com automação "move item", a seção de comentários acompanha o item; coluna Mirror reflete dados de outro quadro [10][12].

**ClickUp**
- Limite WIP por coluna com destaque visual ao atingir a capacidade [14].
- Swimlanes alternáveis por responsável, tag ou campo personalizado [13].
- Checklists/subtarefas no cartão e ícones de propriedades (descrição, anexos, checklist, dependências) no card [13].
- Campos personalizados e automações (reatribuir ao mudar status, lembrete quando o prazo se aproxima) [13][15].

### Recomendações

| # | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão |
|---|---|---|---|---|---|---|
| KB1 | UI de CRUD de quadros e colunas (criar/renomear/reordenar/excluir/definir cor e limite), sem depender de seed ou API direta | Trello [5], ClickUp [15] | Alto | Médio | — | ⬜ |
| KB2 | Fazer `limite_cards` (WIP) bloquear ou avisar no drop em `moveKanbanCard` (coluna cheia = drop recusado + toast, ou destaque vermelho) | Jira [7], ClickUp [14] | Médio | Baixo | KB1 | ⬜ |
| KB3 | Etiquetas/tags coloridas por card, reutilizáveis no quadro e usáveis como filtro | Trello [1], Monday [9] | Alto | Médio | — | ⬜ |
| KB4 | Checklists no card com itens marcáveis (e, opcional, prazo/responsável por item) | Trello [2], ClickUp [13] | Médio | Médio | — | ⬜ |
| KB5 | Comentários (com menção/notificação) e anexos no card | Trello [4][6] | Médio | Médio | — | ⬜ |
| KB6 | Marcar coluna como "concluída" por flag booleano em `kanban_colunas` (não por NOME), corrigindo `kanban_card_is_done` que quebra ao renomear | Jira [8], Monday [10] | Alto | Baixo | KB1 | ⬜ |
| KB7 | Reordenação fina dentro da coluna (posição relativa) em vez de `ordem = Date.now()` no drop | Trello [5] | Médio | Baixo | — | ⬜ |
| KB8 | Ao mover card com `referencia_tipo` para coluna concluída, sincronizar o item de origem (baixar/atualizar status), substituindo o `confirm`+`alert` | Monday [12], Trello [3] | Alto | Médio | KB6 | ⬜ |
| KB9 | Alerta de atraso via cron/automação (não só a classe visual `overdue`): notificar responsável em D-x do `data_vencimento` | Trello [1], ClickUp [15] | Médio | Médio | — | ⬜ |

### Fontes

1. Advanced Trello Features — Automations, Checklists and More — https://trello.com/guide/enterprise/advanced-features
2. Set due dates for checklist items (advanced checklists) | Trello Support — https://support.atlassian.com/trello/docs/how-to-use-advanced-checklists-to-set-due-dates/
3. Create and manage automations (Butler) | Trello Support — https://help.trello.com/article/1318-creating-and-managing-butler-commands
4. Comment on a card | Trello Support — https://support.atlassian.com/trello/docs/commenting-on-cards/
5. Add and customize cards and lists | Trello Support — https://support.atlassian.com/trello/docs/add-and-customize-cards-and-lists/
6. Order up! Rename and rearrange attachments in Trello | Atlassian Work Life — https://blog.trello.com/rename-and-rearrange-attachments
7. Swimlanes and WIP limit in a Kanban Board | Atlassian Community — https://community.atlassian.com/forums/Jira-questions/Swimlanes-and-WIP-limit-in-a-Kanban-Board/qaq-p/2419984
8. Configure board settings (Columns and Swimlanes) | Atlassian Confluence — https://releasemanagement.atlassian.net/wiki/spaces/ASPT/pages/844759116/Configure+board+settings
9. The Status Column | monday.com Support — https://support.monday.com/hc/en-us/articles/360001269685-The-Status-Column
10. The Mirror Column | monday.com Support — https://support.monday.com/hc/en-us/articles/360001733859-The-Mirror-Column
11. Get started with monday automations | monday.com Support — https://support.monday.com/hc/en-us/articles/360001222900-Get-started-with-monday-automations
12. Cross-board automations | monday.com Support — https://support.monday.com/hc/en-us/articles/360011393900-Cross-board-automations
13. Free Kanban Board Software for Teams | ClickUp — https://clickup.com/features/kanban-board
14. How to Use Kanban Board Work in Progress (WIP) Limits | ClickUp — https://clickup.com/p/features/kanban-board/wip-limits
15. Customize Board view | ClickUp Help — https://help.clickup.com/hc/en-us/articles/35342044832279-Customize-Board-view

## Frente 6 — Financeiro

### Como é hoje

#### Telas e ações
- **Contas a pagar/receber:** CRUD genérico (`renderCrud`, `app.js:2851`); a "baixa" comum é editar o título e mudar `status`→Pago/Recebido + `paidDate`/`receivedDate`.
- **Recorrência (pagar):** gerar N parcelas (`app.js:8178`), alterar escopo, cancelar; **quitação antecipada** com juros/desconto (`runEarlySettlement` `app.js:8438`, cancela parcelas futuras).
- **Baixa via caixa vinculado (anti dupla contagem):** `submitLinkedCashMove` (`app.js:6843`, cria Saída e marca Pago), `linkCashPayable`, `matchCashToPayable`. **Não há equivalente para a receber.**
- **Fluxo de caixa:** `renderCashFlow` (`app.js:16842`), janela fixa ±6 meses (`collectMonths` `app.js:4033`). **Conciliação/OFX:** `renderReconciliation` (`app.js:16863`).
- **NF/NFS-e:** config `fiscalDocuments` (`app.js:931`); "Anexar/Vincular NF" a partir de Cotações material (P2). **Pedidos de compra + aba Compras** (`renderCompras` `app.js:2815`) fecham o ciclo pedido→NF.
- **Dashboards:** `dashboardMetrics` (`app.js:3859`, `overduePayable`/`overdueReceivable`), DRE (`renderDre` `app.js:17698`), "Inadimplência por cliente" (usa `isOverdue`).

#### Endpoints
- `handle_payable_module` (`api/index.php:1027`): `create_recurrence`/`early_settlement`/`update_scope`/`cancel_recurrence`/`group`.
- `?module=cashMoves&action=create/link` (baixa+caixa com `referencia_tipo/id` nas duas pontas).
- **OFX:** `ofx-preview/import/conciliar/history` (match por valor+data, `ofx_find_matches` `:7311`). **NFS-e ABRASF:** `nfse-preview/cadastrar-entidade/import` (`parse_nfse_abrasf` `:7801`).
- **Ciclo compra:** PO aprovado→conta (`automate_approved_purchase_order` `:13898`); cotação material P2 → `materialGerarConta` (`:4582`).
- **Cron** (`api/cron/jobs.php`): `mark_overdue_accounts` (Aberto→Vencido pela data local PHP), `create_due_alerts` (D-3), `consolidate_monthly_dre`.

#### Tabelas e colunas-chave
- `accounts_payable`: dueDate/paidDate, supplierId, projectId, categoryId, costCenterId, amount, status (Aberto/Pago/Vencido/Parcial/Cancelado), `recorrencia_*`, `juros_aplicado`, `valor_original`, `referencia_tipo/id`, `ofxFitid`.
- `accounts_receivable`: dueDate/receivedDate, clientId, projectId, proposalId, amount, status, `referencia_tipo/id`, `ofxFitid`.
- `cash_bank_movements`: type (Entrada/Saída/Transferência), `referencia_tipo` (CONTA_PAGAR/CAIXA_MANUAL)/`referencia_id`.
- `fiscal_documents`: documentNumber, amount, type, status (Pendente/Anexada/Conferida/Cancelada), `payableId`, `receivableId`, `purchaseOrderId`, `pdfPath`/`xmlPath`.
- `purchase_orders`: status (Solicitado/Aprovado/Comprado/Recebido/Cancelado), `condicoes_pagamento`, `conta_pagar_id`.

#### Limitações e lacunas observadas
- Fluxo de caixa, DRE e métricas de vencido são calculados **no frontend** a partir do `db` global; `consolidate_monthly_dre` (cron) existe mas não abastece o `renderDre`.
- Janela do fluxo de caixa fixa (±6 meses), sem seletor de período na tela.
- Status **"Parcial"** é opção do select mas não há fluxo de baixa parcial (nenhum lançamento de valor pago parcial).
- `mark_overdue_accounts` só converte `status='Aberto'` — títulos "Parcial" vencidos não viram "Vencido" no banco; depende do cron rodar.
- Baixa com caixa vinculado só existe para pagar; a receber não tem fluxo simétrico.
- Anti dupla contagem depende de `referencia_tipo/id`; OFX importado + lançamento manual podem duplicar se não conciliados (match por valor+data pode ser ambíguo).

### Como o mercado faz

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 7 — Agente de build/deploy on-premise (análise técnica)

### Como é hoje

#### Fluxo atual passo a passo
1. Editar no PC (VS Code, mantendo **LF**) → `git commit` local → `git push origin main` (só quando o usuário pedir).
2. Webhook do GitHub (POST em `deploy.php`) dispara a cada push: `deploy.php:14-20` valida `HMAC sha256` do payload via `hash_equals` (403 se inválido); secret em `/etc/financeiro/config.php` ou env `DEPLOY_SECRET`.
3. Filtro de branch (`deploy.php:23-26`): só `refs/heads/main`.
4. **Backup pré-deploy** (`deploy.php:33-46`): roda `backup-pre-deploy.sh` via sudo; falha NÃO bloqueia o deploy, só loga `[ALERTA]`.
5. **Atualização**: `git -C /var/www/financeiro pull origin main` (`deploy.php:49`).
6. **Verificação pós-deploy** (`deploy.php:53-58`): confere existência dos caminhos protegidos do `.deployignore`; log em `/var/lib/financeiro/deploy.log`.
7. **Manual no servidor**: rodar migrations novas (`mysql ... < migrations/<arquivo>.sql`) e `Ctrl+Shift+R` no navegador.

#### Arquivos e scripts
- `deploy.php` (webhook HMAC + backup + git pull + verificação; `deploy_protected_paths()` com defaults hardcoded).
- `backup-pre-deploy.sh`: `mysqldump --single-transaction | gzip` + `tar` de uploads em `/var/lib/financeiro/backups/pre-deploy/<timestamp>/`; retém últimos 10.
- **Cache busting**: `?v=1798` em `index.html` + `APP_VERSION="v1.34.0"` em `app.js:22` — **ambos manuais e desacoplados** (contadores independentes que podem divergir).
- **Migrations**: 61 arquivos `.sql` idempotentes; rodadas manualmente. Auto-cura em runtime por ~51 funções `ensure_*` no bootstrap (`api/index.php:2504-2559`).
- `scripts/` (workers IA/SINAPI) são runtime, não fazem parte do deploy.

#### Passos manuais e riscos
- Migrations manuais (auto-cura `ensure_*` mitiga, mas doc pede rodar mesmo assim).
- Cache busting 100% manual em dois lugares → risco de esquecer/dessincronizar.
- `git stash` manual no servidor antes do pull (conflitos com `.htaccess` local); CRLF/LF no VS Code Windows; fail2ban (risco de auto-bloqueio em testes).
- Validações `php -l`/`node --check` são manuais — nenhum hook/CI as força.
- NUNCA tocar: `/etc/financeiro/config.php`, uploads, backups, banco.

#### Limitações e lacunas observadas
- Sem CI/CD, testes automatizados ou lint no pipeline; código quebrado pode ir ao ar (deploy não valida sintaxe antes do pull).
- Backup falho não aborta o deploy — pode publicar sem backup válido.
- Verificação pós-deploy só checa existência de caminhos, não integridade.
- Sem rollback automatizado (reverter = git manual + restaurar dump/uploads).
- Sem `composer install`/verificação de dependências no deploy (PhpSpreadsheet, poppler-utils instalados à mão).

### Opções de como funcionaria

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 8 — Backend como API + múltiplos frontends (análise técnica)

### Como é hoje

#### Roteamento e formatos de resposta
- Ponto de entrada único: `api/index.php` (**~14,3k linhas**, maior que os ~8,7k citados em docs antigos). Roteamento web fora do CLI; `try` inline (linha 79) até `catch (Throwable)` (881-886) com 500 genérico.
- **Dois estilos de rota convivem:** REST por path (rotas nomeadas + CRUD genérico via `normalize_resource()` contra `resource_map()`, ~90 recursos) e `?module=&action=` (~15 módulos com handler dedicado, cada um com 3-4 aliases).
- **Dois formatos de resposta incompatíveis:** `{ok:true,data}`/`{ok:false,error}` no REST vs `{success,data,message}` nos módulos — o SPA normaliza os dois em `handleApiResponse` (`app.js:1921`).
- `insert_dynamic`/`update_dynamic` (`api/index.php:14197/14211`) **descartam silenciosamente colunas inexistentes** (tolerância a drift de schema).

#### Autenticação e permissões
- `authenticate_request` (`api/index.php:8838`): token em toda rota; `bearer_token()` lê `Authorization: Bearer`, fallback `X-Auth-Token` (custom), e `?token=` só no download de NF.
- Sessão em banco (`api_sessions`, não JWT): token CSPRNG + SHA-256; idle 30 min (`AUTH_IDLE_SECONDS=1800`), absoluto 12h; cada request faz UPDATE de `lastActivity`. Rate limit de login.
- `authorize_request` → `role_permissions` (canView/canCreate/canEdit/canDelete) com fallback em defaults hardcoded; permissão derivada da AÇÃO real.

#### Acoplamentos com o SPA
- `API_BASE` relativo (`app.js:5`): assume front e API no MESMO host/diretório.
- Token no `localStorage`; `bootstrap` devolve **o banco inteiro de uma vez** (`bootstrap_data` → objeto global `db`) — payload monolítico que um mobile herdaria.
- Uploads via `fetchForm` multipart; downloads autenticados exigem `fetch + authHeaders + blob`.

#### Limitações e lacunas observadas
- **Sem CORS:** nenhum `Access-Control-Allow-Origin`/tratamento de `OPTIONS`; CSP `connect-src 'self' + viacep/brasilapi` — a API não aceita chamada de outra origem hoje.
- Dois contratos de resposta obrigam qualquer cliente a tratar ambos; SDK mobile precisaria replicar `handleApiResponse`.
- Sem versionamento (`/api/v1`), sem paginação no CRUD genérico nem no `bootstrap` — pesado para mobile.
- Sessão stateful com idle 30 min é agressiva para app mobile; header `X-Auth-Token` é custom.
- Timezone de negócio acoplado ao PHP do servidor (`America/Campo_Grande`); erros sempre 500 genérico sem códigos estruturados para diagnóstico programático.

### Opções de como funcionaria

pendente

### Recomendações

pendente

### Fontes

pendente

## Fechamento — visão consolidada e ordem sugerida

pendente
