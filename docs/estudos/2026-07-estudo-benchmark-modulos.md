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

- Mensagens de erro devem ser visíveis, em linguagem humana e específicas — nunca genéricas como "entrada inválida" — explicando o que houve e como corrigir, sem culpar o usuário nem expor jargão técnico [1].
- Cada erro deve dar conselho construtivo e preservar o que o usuário já digitou; o tom é educado, não acusatório (evitar "inválido"/"ilegal") [1].
- Erros de formulário devem aparecer inline, junto do campo com problema — o usuário vê a mensagem enquanto conserta [2].
- Validação inline idealmente dispara no blur (ao sair do campo), não a cada tecla; combina cor (vermelho erro, âmbar aviso) com ícone/texto para acessibilidade [8][9]. Reduz erros de preenchimento (~22%) e acelera a conclusão [8][9].
- SPAs precisam de captura global de JS: `window.onerror` pega exceções de runtime não tratadas e `unhandledrejection` pega promises rejeitadas sem `.catch` — complementares, registrados na inicialização do app [3][4][5]. O handler global loga com contexto, envia a um backend e exibe mensagem amigável [3][5].
- Erro inesperado nunca silencioso: `.catch` vazios engolem falhas; o padrão é sempre registrar e, quando afeta o usuário, dar feedback visível [5].
- Em produção PHP: `display_errors=0` + `log_errors=1`, destino de log fixo/dedicado, níveis de severidade e formato estruturado (JSON); nunca logar dados sensíveis [6][7]. Logs centralizados com contexto suficiente para diagnóstico [7].
- Correlação erro↔requisição/usuário: um ID único (correlation ID) por requisição, gravado no log e **exibido ao usuário na tela de erro** — no suporte, localiza imediatamente os logs da requisição exata [10][11].

### Roteiro de verificação sob demanda

Checklist que o agente percorre quando o usuário pedir "verificar erros":

1. **Sintaxe e estáticos:** `php -l api/index.php`; `node --check app.js`.
2. **Fluxo feliz ponta a ponta (leitura de código):** cadastro cliente →
   proposta → obra → orçamento → conta a receber/pagar → baixa — conferir
   que cada passo trata resposta de erro da API (toast + estado consistente).
3. **Casos de borda:** campos vazios/valores inválidos nos formulários
   principais; IDs inexistentes nos endpoints; permissão negada.
4. **Erros inesperados:** simular resposta 500/JSON inválido — o front
   mostra algo? O PHP loga? (conferir handlers e logs)
5. **Relatório:** listar cada problema com arquivo:linha, gravidade e
   sugestão de correção — SEM corrigir nada sem aprovação.

### Recomendações

| # | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão |
|---|---|---|---|---|---|---|
| E1 | Instalar captura global de erros JS (`window.onerror` + `unhandledrejection`) registrada no bootstrap do SPA, que loga com contexto e exibe toast amigável em vez de morrer no console | [3][4][5] — hoje há 0 ocorrências de handler global | Alto | Baixo | — | ⬜ |
| E2 | Eliminar os `.catch(() => {})` silenciosos (`app.js:7157, 8724, 8732, 17127, 17155`): todo catch deve logar e, se afeta o usuário, dar feedback — erro nunca silencioso | [5] | Alto | Baixo | E1 | ⬜ |
| E3 | Substituir `alert()` bloqueante de gravação/validação (`app.js:8709-8711`) por `showToast` consistente, com distinção visual de severidade (erro/aviso) | [1] | Médio | Baixo | — | ⬜ |
| E4 | Gerar código de correlação (UUID) por requisição/erro, gravá-lo no `error_log` junto do 500 e exibi-lo ao usuário na mensagem de "erro interno" para rastreio no suporte | [10][11] — 500 genérico hoje sem código | Alto | Médio | E5 | ⬜ |
| E5 | Fixar o destino do `error_log` PHP e criar tabela/endpoint de erros de aplicação com log estruturado (JSON) e níveis de severidade — hoje diagnóstico depende só de `audit_log` (mutações) + log do SO | [6][7] | Médio | Médio | — | ⬜ |
| E6 | Estender validação inline (on blur, mensagem junto do campo) aos formulários de negócio de financeiro/orçamento/obras, hoje dependentes do backend | [2][8][9] — validação client-side só em 3 cadastros | Alto | Alto | E3 | ⬜ |
| E7 | Unificar o contrato de resposta da API em um envelope único (ex.: `{ok, data, error, code}`), eliminando a coexistência de `{ok,error}` (REST) e `{success,message}` (módulos) | [7] — hoje dois formatos | Médio | Alto | — | ⬜ |
| E8 | Padronizar catálogo de mensagens de erro acionáveis (linguagem clara, sem culpar, com próximo passo) substituindo genéricos como "Erro interno no servidor" e "formato inesperado" | [1] | Médio | Médio | E7 | ⬜ |

### Fontes

1. Error-Message Guidelines (Nielsen Norman Group) — https://www.nngroup.com/articles/error-message-guidelines/
2. 10 Design Guidelines for Reporting Errors in Forms (Nielsen Norman Group) — https://www.nngroup.com/articles/errors-forms-design-guidelines/
3. Capture & Report JavaScript Errors with window.onerror (Sentry Blog) — https://blog.sentry.io/client-javascript-reporting-window-onerror/
4. Window: error event (MDN Web Docs) — https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event
5. Client-side global error handling and unhandled promise rejections (DEV Community) — https://dev.to/nyxtom/client-side-global-error-handling-and-unhandled-promise-rejections-2917
6. PHP Logging: Best Practices for PHP Log Analysis (Zend) — https://www.zend.com/blog/error-logging-in-php
7. Four Logging Best Practices for Production Applications (Tideways) — https://tideways.com/profiler/blog/four-logging-best-practices-for-production-applications
8. Usability Testing of Inline Form Validation (Baymard Institute) — https://baymard.com/blog/inline-form-validation
9. A Complete Guide To Live Validation UX (Smashing Magazine) — https://www.smashingmagazine.com/2022/09/inline-validation-web-forms-ux/
10. Correlation IDs (Microsoft Engineering Fundamentals Playbook) — https://microsoft.github.io/code-with-engineering-playbook/observability/correlation-id/
11. SharePoint Correlation ID in error messages (Microsoft Support) — https://support.microsoft.com/en-gb/office/sharepoint-correlation-id-in-error-messages-what-it-is-and-how-to-use-it-5bf2dba7-43d2-484c-8ef4-e059f76e3efa

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

**Sienge (Plataforma + Construcompras)**
- ERP que integra "jornadas" num backbone único: comercial (contratos, aditivos), engenharia/orçamento (motor eCustos), suprimentos e financeiro [1].
- Orçamento vinculado de forma contínua do planejamento à execução, sem retrabalho nem redigitação [1].
- O planejamento da obra desdobra automaticamente uma "Necessidade de Compra" e notifica o comprador nas datas previstas [2].
- Compra aprovada lança sozinha em Contas a Pagar; contratos de fornecimento registram caução, retenções por medição e descontos [2].
- Construcompras: cotação com até 15 fornecedores, Mapa Comparativo de Preços com histórico de preço/prazo por fornecedor e pedido espelhado no orçamento [3].

**TOTVS Construção Obras e Projetos**
- Orçamento com estruturas precificáveis e projetos-modelo; copia insumos entre projetos [4].
- Planejamento executivo (prazos, dependências) derivado do orçamento [5].
- Planejamento aquisitivo: mostra a necessidade de compras ao longo do tempo e gera pedidos automaticamente considerando lead time [5].
- Planejamento financeiro: condições de pagamento por insumo e cronograma de desembolso ligados à aquisição [5].

**Mega Construção (ERP Mega / Senior)**
- Comercial/CRM leva a proposta da prospecção até a assinatura, com status personalizados e automação de minutas contratuais [6].
- Orçamento por etapas/subetapas em vários níveis, com várias visões por proposta e banco de composições reutilizável [6].
- Administração de Obras reúne orçamento, cronograma, solicitações, medições e custos num só lugar [7].
- Suprimentos com controle de saldo por insumo/grupo/serviço da estrutura orçamentária [6].

**Obra Prima**
- Orçamento de custo e de venda ligado ao cronograma físico-financeiro [8].
- Suprimentos: solicitação de materiais e cotação online com "mapa de cotação" recebendo as propostas no sistema [8][9].
- Integração SEFAZ recebe a NF automaticamente (até 2h), sem lançamento manual [9].
- Financeiro integrado: pagar/receber, conciliação, fluxo de caixa previsto x realizado [9].

Comparado ao fluxo desejado (proposta de serviços → orçamento base → obra → orçamento de compras buscando descontos), os quatro tratam o encadeamento como um único fluxo automatizado: a aprovação da venda dispara a criação da obra, do contrato e das contas, e o orçamento aprovado alimenta o planejamento e a "necessidade de compra" (explícito no TOTVS e no Sienge) — enquanto o ObraSync ainda depende de status digitado à mão e de três ações manuais separadas. Na etapa de compras com desconto, Sienge (Construcompras) e Obra Prima entregam mapa comparativo com histórico de preço/prazo por fornecedor e registro de negociação — o ObraSync tem apenas a matriz item×fornecedor, sem histórico/negociação estruturada.

### Recomendações

| # | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão |
|---|---|---|---|---|---|---|
| FC1 | Botão explícito "Aprovar proposta" com prévia do que será gerado (obra + orçamento + contas + contrato), substituindo o status digitado à mão | Sienge [1]; Mega [6] | Alto | Baixo | — | ⬜ |
| FC2 | Preservar metadados na cópia proposta→orçamento de obra (`etapa_id`, `tipo`, `sinapi_id`, `categoryId`, `orcamento_item_id`) em vez de gravar só `origin='Item livre'` | TOTVS [4]; Mega [6] | Alto | Médio | — | ⬜ |
| FC3 | Gerar automaticamente contas a receber + contrato + centro de custo na aprovação, herdando endereço/prazos (hoje são 3 ações manuais) | Sienge [1][2]; Mega [6] | Alto | Médio | FC1 | ⬜ |
| FC4 | Wizard/funil único cadastro→proposta→aprovação→obra→cotação→pedido→NF (hoje espalhado em ~5 módulos) | Sienge [1]; Obra Prima [8] | Alto | Alto | FC1, FC5 | ⬜ |
| FC5 | Unificar/renomear os menus ambíguos: dois "orçamentos" (`budgets` vs `workBudgets`) e dois "Cotações" (`quotes` vs `cotacoes`) | Sienge [1]; Mega [6] | Médio | Baixo | — | ⬜ |
| FC6 | Ativar `proposta_grupos` (hoje dormente): agrupar itens por disciplina/etapa com várias visões por proposta | Mega [6]; TOTVS [4] | Médio | Médio | FC2 | ⬜ |
| FC7 | Evoluir a matriz de cotação para mapa comparativo com histórico de preço/prazo por fornecedor e registro de negociação/desconto | Sienge Construcompras [3]; Obra Prima [8][9] | Alto | Médio | — | ⬜ |
| FC8 | Derivar "necessidade de compra" do orçamento da obra para alimentar as cotações automaticamente (fechar o back-link proposta↔obra↔compras) | TOTVS [5]; Sienge [2] | Médio | Alto | FC2 | ⬜ |

### Fontes

1. Sienge — o que é, como funciona e por que é o ERP líder da construção civil — https://sienge.com.br/blog/sienge-o-que-e/
2. Sienge — a ferramenta de gerenciamento de suprimentos que você precisa — https://sienge.com.br/blog/gerenciamento-de-suprimentos/
3. Sienge — Construcompras (cotação e mapa comparativo de preços) — https://sienge.com.br/construcompras/
4. TOTVS — Tudo sobre o TOTVS Construção Obras e Projetos — https://produtos.totvs.com/ficha-tecnica/tudo-sobre-o-totvs-construcao-obras-e-projetos/
5. TNU Sistemas — Planejamento no TOTVS Construção Obras e Projetos — https://www.tnusistemas.com.br/planejamento-no-totvs-construcao-obras-e-projetos-totvs-rm/
6. Senior — Funcionalidades do ERP Mega (Construção) — https://site.senior.com.br/construcao/funcionalidades-erp-mega/
7. Senior — Administração de Obras (documentação ERP Mega) — https://documentacao.senior.com.br/erp-mega/manual-do-usuario/engenharia/administracao-de-obras/administracao-de-obras/
8. Obra Prima — Software de gestão de obras com aplicativo — https://obraprima.eng.br/
9. Obra Prima — Sistema de gestão financeira para obras — https://obraprima.eng.br/financeiro/

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

**MS Project**
- Gantt com barras por tarefa, datas/duração/prazos e níveis de zoom; marcos são tarefas de duração zero exibidas como losango [2].
- Dependências nos 4 tipos (FS/SS/FF/SF) com setas ligando as barras [2].
- Baseline salvo (planejado × realizado) e **caminho crítico calculado** — tarefas críticas com barra vermelha [1].
- **Cronograma custo-carregado** (custos por tarefa) gera o custo faseado no tempo e a **curva S / fluxo de caixa** planejado × realizado [3].

**Primavera P6**
- Relações FS/FF/SS/SF com **lag/lead**; relações "driving" em linha sólida (vermelha no caminho crítico), "non-driving" pontilhada [4].
- Caminho crítico automático (CPM) [5]; baselines para medir desvios [5].
- **Cost/resource loading**: custos distribuídos no tempo geram cash flow e **curva S** acumulada; dá para montar um cronograma só de compras [6].

**Smartsheet**
- Barras + losangos de marco; dependências recalculam datas em cascata automaticamente [7].
- Baseline compara planejado × real com variância (dias adiantado/atrasado); caminho crítico em vermelho [8].
- Edição direta: arrastar barras para mudar datas e desenhar setas predecessor→sucessor no próprio Gantt [7].

**Monday.com**
- Gantt com barras + marcos em losango e setas de dependência; tipos FS (padrão), FF e SS [9].
- **Baseline como "snapshot" cinza travado** sobreposto às barras atuais [10].
- Caminho crítico destacando tarefas que definem a data final [11].

**Relação com a spec interna** — A spec `cronograma-fisico-financeiro.md` já prevê o núcleo de cálculo do que os 4 players oferecem: EAP por pacotes, dependências nos 4 tipos com lag, baseline versionado, caminho crítico e curvas S física e financeira (inclusive curva contratual 30/60/90/120). O que o benchmark **acrescenta sem duplicar a spec** é a camada de **exibição unificada na linha do tempo**: sobrepor num único Gantt as etapas + marcos + **pagamentos** + **compras/entregas de materiais**, no estilo "cronograma custo-carregado" do MSP/P6, além de convenções de UX que a spec não trata — barras vermelhas no caminho crítico, losangos de marco, baseline como snapshot cinza, linhas sólidas/pontilhadas e edição por arrastar direto no gráfico.

### Recomendações

| # | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão |
|---|---|---|---|---|---|---|
| G1 | Gantt unificado com linha do tempo sobrepondo etapas + MARCOS + PAGAMENTOS (contas a pagar/receber) + COMPRAS/entregas de materiais, em faixas/camadas estilo MS Project (cronograma custo-carregado) | MS Project [2][3], Primavera P6 [6] | Alto | Alto | financeiro + pedidos de compra (dados atuais) | ⬜ |
| G2 | Desenhar dependências no Gantt (setas predecessor→sucessor), tipos FS/SS/FF/SF com lag e recálculo de datas em cascata | MSP [2], P6 [4], Smartsheet [7], Monday [9] | Alto | Alto | spec cronograma | ⬜ |
| G3 | Caminho crítico calculado (CPM) com destaque em vermelho nas barras e setas | MSP [1], P6 [5], Smartsheet [8], Monday [11] | Alto | Alto | G2 · spec cronograma | ⬜ |
| G4 | Baseline versionado sobreposto como snapshot cinza + variância (dias adiantado/atrasado) | Monday [10], Smartsheet [8], MSP [1] | Médio | Médio | spec cronograma | ⬜ |
| G5 | Curva S física e financeira derivada das etapas custo-carregadas + curva contratual de pagamento (30/60/90/120) | P6 [6], MSP [3] | Alto | Médio | spec cronograma | ⬜ |
| G6 | EAP hierárquica no Gantt (expandir/recolher pacotes) e % físico ponderado por peso (hoje é média aritmética) | MSP [2], P6 [6] | Médio | Alto | spec cronograma | ⬜ |
| G7 | Edição direta no Gantt: arrastar barra para alterar datas e desenhar seta de dependência no próprio gráfico | Smartsheet [7], Monday [9], MSP [2] | Médio | Médio | G1 · G2 | ⬜ |
| G8 | Marcos como losango na linha do tempo, reaproveitando o evento de cobrança já existente (aprovação de marco) | MSP [2], Smartsheet [7], Monday [9] | Baixo | Baixo | projectMilestones (atual) | ⬜ |

### Fontes

1. Microsoft Support — Show the critical path of your project in Project — https://support.microsoft.com/en-us/office/show-the-critical-path-of-your-project-in-project-ad6e3b08-7748-4231-afc4-a2046207fd86
2. ProjectManager — Microsoft Project Gantt Chart: A How-to Guide — https://www.projectmanager.com/blog/microsoft-project-gantt-chart
3. Leroux Consulting — How to Generate a Cashflow (S-Curve) from your Microsoft Project Construction Schedules — https://lerouxconsulting.com/ms-project-for-construction-articles-and-resources/generate-cashflow-s-curve-ms-project-construction
4. ProjectManagerTemplate — Primavera P6 Relationship Types — https://www.projectmanagertemplate.com/post/primavera-p6-relationship-types-project-scheduling
5. ProjectManager — Primavera P6 Scheduling: How to Create a P6 Schedule — https://www.projectmanager.com/blog/primavera-p6-scheduling-p6-schedule
6. ScheduleReader — How to cost load and resource load a schedule in Primavera P6 — https://www.schedulereader.com/how-to-cost-load-and-resource-load-a-schedule-in-primavera-p6/
7. Smartsheet — Gantt Chart Software: Manage Timelines & Dependencies — https://www.smartsheet.com/content/gantt-chart-software
8. Smartsheet Learning Center — Baselines and critical path — https://help.smartsheet.com/learning-track/project-fundamentals-part-2-project-settings/baselines-and-critical-path
9. monday.com Support — The Gantt Chart View and Widget — https://support.monday.com/hc/en-us/articles/360015643840-The-Gantt-Chart-View-and-Widget
10. monday.com Support — The Gantt Baseline — https://support.monday.com/hc/en-us/articles/360020978159-The-Gantt-Baseline
11. monday.com Support — Critical Path for the Gantt Chart — https://support.monday.com/hc/en-us/articles/4420037448850-Critical-Path-for-the-Gantt-Chart

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

**Google Calendar + Google Tasks**
- Tarefas vencidas aparecem como entrada de dia inteiro com a contagem de pendências dos últimos 30 dias; ao clicar, dá para revisar e concluir direto dali [1].
- Conclusão em 1 clique: círculo ao lado da tarefa; as concluídas recolhem sob um cabeçalho "Concluídas" com contador [2].
- Recorrência nativa (diária, semanal, mensal, anual ou personalizada); concluir avança a data em vez de duplicar [3].
- Lembrete = data+hora com notificação; arrastar a tarefa na grade reagenda [2].

**Outlook (Calendário + To Do)**
- No detalhe da tarefa: etapas, recorrência, vencimento/lembrete e anexar nota ou arquivo [4].
- Lembretes com atalhos rápidos ("mais tarde hoje", "amanhã", "próxima semana") [5].
- Categorias com cor e listas inteligentes (Meu Dia, Importante, Planejado, Concluído, Vence hoje) [4].

**Todoist**
- Prioridades com cor (P1 = vermelho) e etiquetas coloridas por contexto [6][8].
- Gestão de atrasadas: botão "Reagendar" move todas as vencidas para hoje, com sugestões do Smart Schedule [6].
- Recorrência inteligente; concluir reinicia para a próxima ocorrência [7].
- Lembretes automáticos, personalizados, recorrentes e por localização; comentários com anexos [6].

**TickTick**
- Múltiplas visões de calendário: mês, semana, agenda, multi-dia e multi-semana [9].
- Recorrência flexível, incluindo padrões avançados como "último dia do mês" [10].
- Lembretes fortes: vários horários de alerta e lembretes persistentes que insistem até concluir [11].
- Etiquetas para categorizar e visões alternativas lista/kanban/linha do tempo [9].

### Recomendações

| # | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão |
|---|---|---|---|---|---|---|
| AG1 | Anotações ricas em eventos (bloco de notas/comentários além do `descricao` único, com histórico e anexos leves) | Outlook [4]; Todoist [6] | Médio | Baixo | Reuso do campo `descricao` existente | ⬜ |
| AG2 | Destaque vermelho de atraso também para eventos manuais (hoje só financeiros em `app.js:9319`), reusando `isOverdue`/`hojeLocal` | Todoist [6][8]; Google [1] | Alto | Baixo | Regra de status vs data (fuso local, M10) | ⬜ |
| AG3 | Botão rápido de "Concluir" no card (1 clique → `status=concluido`) sem abrir o select | Google Tasks [2]; Todoist [6] | Alto | Baixo | Padronizar enum de status (concluido/realizado) | ⬜ |
| AG4 | Recorrência de eventos (diária/semanal/mensal/anual/personalizada) — hoje inexistente | Google [3]/Outlook [4]/Todoist [7]/TickTick [10] | Alto | Alto | Nova coluna de recorrência + geração de ocorrências | ⬜ |
| AG5 | Ativar lembretes efetivos: usar a coluna dormente `lembrete_minutos` (default 60) com UI e disparo real | Outlook [5]/Todoist [6]/TickTick [11] | Alto | Médio | Coluna já existe; falta UI + job de notificação | ⬜ |
| AG6 | Arrastar evento para reagendar direto na grade | Google [2]/Todoist [6] | Médio | Médio | Grade da agenda + action `update` existente | ⬜ |
| AG7 | Ativar visões Dia e Mês (helpers `agendaViewLabel`/`agendaPeriodLabel` já existem como código morto, `app.js:9789-9800`) | TickTick [9]; Google/Outlook | Médio | Médio | Reativar código morto já presente | ⬜ |
| AG8 | Cor por evento e/ou por categoria/tipo (hoje sem coluna de cor; só CSS por tipo+status) | Outlook [4]; Todoist [8]; TickTick [9] | Médio | Médio | Nova coluna de cor + legenda unificada | ⬜ |
| AG9 | Painel/lista "Em aberto e atrasadas" com contador e conclusão em lote | Google [1]; Todoist [6] | Médio | Médio | AG2 · AG3 | ⬜ |

### Fontes

1. Google Workspace Updates — Manage overdue tasks in Google Calendar — https://workspaceupdates.googleblog.com/2022/02/manage-overdue-tasks-in-google-calendar.html
2. Google Tasks: the complete guide [2026] (2sync) — https://2sync.com/blog/google-tasks-complete-guide
3. Manage repeating tasks in Google Tasks & Google Calendar — Google Calendar Help — https://support.google.com/calendar/answer/12132599
4. Manage tasks with To Do in Outlook — Microsoft Support — https://support.microsoft.com/en-us/office/manage-tasks-with-to-do-in-outlook-6e8a991b-ea62-4009-a7f7-62b70a57ec18
5. Add or delete notifications or reminders in Outlook — Microsoft Support — https://support.microsoft.com/en-us/office/add-or-delete-notifications-or-reminders-in-outlook-7a992377-ca93-4ddd-a711-851ef3597925
6. How to Use Todoist Effectively – The Complete Guide — Todoist — https://www.todoist.com/inspiration/how-to-use-todoist-effectively
7. Introduction to recurring dates — Todoist — https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV
8. Change color themes (prioridades e cores) — Todoist — https://www.todoist.com/help/articles/change-color-themes-zD0N5K
9. Features — TickTick — https://ticktick.com/features
10. Set Up Recurring Tasks — TickTick — https://help.ticktick.com/articles/7055782206349770752
11. Effective Reminder Feature — TickTick — https://help.ticktick.com/articles/7055782395743567872

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

**Conta Azul**
- Conciliação bancária automática: importa o extrato diariamente, cruza os lançamentos e dá baixa automática no que já foi pago/recebido [1][2].
- Regras de match configuráveis: só correspondências exatas (mesmo valor e vencimento) e/ou aproximadas (mesmo valor, vencimento ±5 dias) [2].
- Baixa parcial via "Informar pagamento/recebimento" com campo "valor pago" — o saldo restante fica em aberto [3].
- Ações em lote sobre lançamentos selecionados [4]; conceito de "aging list" para priorizar cobrança [5].

**Omie**
- Contas a pagar/receber com monitoramento de prazos e emissão automática de cobranças, NF-e/NFS-e no mesmo ERP [6].
- Conciliação com importação automática de extrato dos principais bancos [7].
- Baixa parcial informando valor menor que o título; residual calculado automaticamente [8].
- Baixa em lote (11+ títulos vira processamento assíncrono) [9].

**Nibo**
- Conciliação inteligente: importação automática do extrato com categorização a ~85% de acerto [10].
- Régua de cobrança automatizada: lembretes por e-mail e WhatsApp em momentos estratégicos [11]; perfis de cobrança com multa, juros, desconto [11].
- Relatórios com vencidas mês a mês e filtros por período, categoria e centro de custo [12].

**Granatum**
- Fluxo de caixa previsto × realizado consolidando futuros planejados/recorrentes e realizados [13][14].
- Cenários orçamentários (otimista/pessimista/realista) com metas [13].
- DRE e fluxo de caixa por regime de caixa ou competência, com filtros e exportação [15].

**QuickBooks** (referência global)
- Cash Flow Planner interativo: projeta entradas/saídas usando histórico + títulos em aberto; ajustes hipotéticos sem alterar os livros [16].
- Baixa parcial reduz o saldo e marca a fatura como paga/parcial [17].
- Relatório de aging de A/R por faixas (atual, 1-30, 31-60, 60+ dias) [17].

**Sienge** (financeiro/suprimentos — construção)
- Medição vincula avanço físico/financeiro do contrato ao título financeiro; uma NF pode ligar-se a várias medições/contratos [18][19].
- Título em Contas a Pagar com apropriações de obra e impostos, integrado à liberação de medição em Suprimentos [18].
- Integração e conciliação bancária centralizadas (extrato digital, cheques, saldos, adiantamentos) [20].

### Recomendações

| # | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão |
|---|---|---|---|---|---|---|
| FIN1 | Fluxo real de baixa parcial (pagar e receber): campo "valor pago/recebido", saldo residual e status "Parcial" alimentado por lançamentos — hoje "Parcial" existe no select mas não há registro do valor pago | Conta Azul [3], Omie [8], QuickBooks [17] | Alto | Médio | Coluna de valor pago acumulado; ajustar `mark_overdue_accounts` p/ "Parcial" vencido | ⬜ |
| FIN2 | Baixa em lote por multisseleção (informar pagamento/conta em vários títulos de uma vez) — hoje a baixa é título a título | Conta Azul [4], Omie [9] | Médio | Médio | FIN1 | ⬜ |
| FIN3 | Seletor de período no fluxo de caixa — hoje `collectMonths` é fixo em ±6 meses | Granatum [15], QuickBooks [16] | Médio | Baixo | — | ⬜ |
| FIN4 | Fluxo de caixa projetado × realizado com cenários (previsto de recorrentes + em aberto vs movimentado) | Granatum [13][14], QuickBooks [16] | Alto | Alto | FIN3; recorrências existentes | ⬜ |
| FIN5 | Mover DRE e métricas de vencido para o backend consumindo `consolidate_monthly_dre` — hoje tudo no front e o cron não abastece `renderDre` | Granatum [15], Omie [6] | Médio | Médio | Endpoint da consolidação | ⬜ |
| FIN6 | Régua de cobrança / lembretes automáticos de inadimplência (D-x, no vencimento, D+x) por e-mail/WhatsApp — hoje só cron `create_due_alerts` D-3 | Nibo [11], Omie [6] | Alto | Alto | Canal de envio; perfis de multa/juros/desconto | ⬜ |
| FIN7 | Relatório de aging por faixas (a vencer, 1-30, 31-60, 61-90, 90+) para receber e pagar | QuickBooks [17], Nibo [12], Conta Azul [5] | Médio | Baixo | `isOverdue`/`dueDate` existentes | ⬜ |
| FIN8 | Conciliação OFX com regras e antiduplicidade (match exato + aproximado por janela de dias, dedupe por FitID, sugestão em vez de auto-match cego) — hoje match por valor+data ambíguo | Conta Azul [1][2], Nibo [10], Omie [7] | Alto | Alto | `ofxFitid` existente; `ofx_find_matches` | ⬜ |
| FIN9 | Baixa via caixa vinculado simétrica para contas a receber (criar Entrada + marcar Recebido) — hoje só existe para pagar | Omie [8], Conta Azul [3] | Médio | Baixo | `cash_bank_movements` `referencia_tipo/id` existentes | ⬜ |

### Fontes

1. Conciliação bancária automática para PMEs — Conta Azul — https://contaazul.com/funcionalidades/conciliacao-bancaria/
2. Conciliação bancária automática: como fazer — Conta Azul — https://ajuda.contaazul.com/hc/pt-br/articles/7454707570701
3. Lançamentos financeiros: como fazer baixa parcial — Conta Azul — https://ajuda.contaazul.com/hc/pt-br/articles/7184294182797
4. Lançamentos financeiros: como editar em lote — Conta Azul — https://ajuda.contaazul.com/hc/pt-br/articles/7711548868365
5. Aging List: como usar para receber mais rápido — Conta Azul (blog) — https://blog.contaazul.com/o-que-e-aging-list-e-como-ele-ajuda-a-receber-mais-rapido
6. Controle Financeiro Empresarial — Omie — https://www.omie.com.br/funcionalidades/controle-financeiro-empresarial/
7. Conciliação bancária — Omie — https://www.omie.com.br/funcionalidades/conciliacao-bancaria/
8. Realizando uma Baixa Parcial de Receita — Ajuda Omie — https://ajuda.omie.com.br/pt-BR/articles/499024-realizando-uma-baixa-parcial-receita
9. Baixando as Contas a Pagar em Lote — Ajuda Omie — https://ajuda.omie.com.br/pt-BR/articles/7828387-baixando-as-contas-a-pagar-em-lote
10. Conciliação Bancária Inteligente — Nibo — https://www.nibo.com.br/empresa/funcionalidades/conciliacao-inteligente
11. Central de Cobranças (régua de cobrança) — Nibo — https://www.nibo.com.br/sistema-de-cobrancas
12. Quais são os relatórios do Nibo Gestão Financeira? — Nibo — https://ajuda.nibo.com.br/pt-BR/articles/7026282-quais-sao-os-relatorios-do-nibo-gestao-financeira
13. Funcionalidades do software de gestão financeira — Granatum — https://www.granatum.com.br/financeiro/funcionalidades
14. Como analisar fluxo de caixa projetado x realizado — Granatum — https://ajuda.granatum.com.br/support/solutions/articles/67000747248
15. Relatório de fluxo de caixa — Granatum — https://www.granatum.com.br/financeiro/funcionalidades/relatorio-fluxo-de-caixa
16. Use the cash flow planner in QuickBooks Online — Intuit — https://quickbooks.intuit.com/learn-support/en-us/help-article/budget-forecast-reports/use-cash-flow-planner-quickbooks-online/L2l59mIqe_US_en_US
17. Manage Accounts Receivable and Payable with QuickBooks — Fusion CPA — https://www.fusiontaxes.com/thought-leadership/blog/manage-accounts-receivable-and-accounts-payable-efficiently-with-quickbooks-plus/
18. Como funciona o Cadastro de Medição — Sienge — https://ajuda.sienge.com.br/support/solutions/articles/153000254155
19. Como vincular uma mesma nota a mais de uma medição — Sienge — https://ajuda.sienge.com.br/support/solutions/articles/153000199252
20. Integração bancária na construção civil — Sienge — https://sienge.com.br/blog/integracao-financeiro-bancos/

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

Três caminhos para reduzir os passos manuais e os riscos do fluxo atual, preservando a regra de nunca tocar em `/etc/financeiro/config.php`, uploads, backups ou banco.

**Opção A — Automatizar as pontas do fluxo git/webhook atual (evolução incremental).**
- *Automatiza:* hook local `pre-push` que roda `php -l` + `node --check` e aborta o push se falhar [5][6]; incremento sincronizado de `?v=` e `APP_VERSION` no mesmo hook; `deploy.php` passa a exigir backup bem-sucedido (aborta em vez de só logar `[ALERTA]`) e a rodar migrations pendentes com registro em tabela de controle (`schema_migrations`) [7][8].
- *Pré-requisitos:* git hooks no PC, tabela de migrations, ajuste em `deploy.php`. Zero infra nova.
- *Riscos:* hook local é burlável (`--no-verify`); migração automática exige idempotência (já garantida) e guarda/log.
- *Esforço:* Baixo/Médio. Mantém GitHub como fonte da verdade e o backup+HMAC existentes.

**Opção B — Deploy direto pela LAN (SSH/rsync).**
- *Automatiza:* agente local que valida, builda e sincroniza via `rsync` sobre SSH, sem GitHub; `--exclude` protege config/uploads/backups [1][2][3][4].
- *Riscos:* perde o gatilho por push e a rastreabilidade do git; pode subir lixo não commitado; um `--delete` mal configurado apaga arquivos protegidos. Migrations continuam à parte.
- *Esforço:* Médio.

**Opção C — Runner de CI self-hosted na LAN (GitHub Actions runner on-premise).**
- *Automatiza:* pipeline formal no push — validação, deploy, migrations e rollback como steps versionados; runner na própria rede [12][13].
- *Riscos:* manutenção do runner e superfície de ataque; overkill para dev solo.
- *Esforço:* Alto.

**Recomendação:** adotar a **Opção A** como caminho principal. Para um dev solo, com deploys frequentes, servidor na mesma LAN e a disciplina de não tocar config/uploads/backups/banco, A entrega a maior redução de risco (validação forçada, cache busting sincronizado, backup que bloqueia, migrations rastreadas) com o menor esforço e sem infra nova. Descartar B (perde rastreabilidade e arrisca caminhos protegidos); deixar C como evolução futura se o projeto ganhar mais colaboradores — a partir de A, migrar para C é natural, pois os mesmos passos (lint → backup → migrate → healthcheck → rollback) já estarão scriptados.

### Recomendações

| # | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão |
|---|---|---|---|---|---|---|
| DEP1 | Hook `pre-push` local que roda `php -l api/index.php` + `node --check app.js` e **aborta o push** se algum falhar | [5][6] | Alto | Baixo | — | ⬜ |
| DEP2 | Cache busting automático no mesmo `pre-push`: incrementa `?v=` (index.html) e `APP_VERSION` (app.js) **em sincronia**, eliminando os dois contadores manuais | [4][5] | Médio | Baixo | DEP1 | ⬜ |
| DEP3 | Backup obrigatório que **aborta o deploy**: `deploy.php` interrompe (não só loga) se `backup-pre-deploy.sh` falhar — nunca publicar sem backup válido | [9][10][11] | Alto | Baixo | — | ⬜ |
| DEP4 | Registro de migrations aplicadas (tabela `schema_migrations`) + execução automática das pendentes no `deploy.php`, aplicando só o que falta e logando cada arquivo | [7][8][9] | Alto | Médio | DEP3 | ⬜ |
| DEP5 | Healthcheck pós-deploy: HTTP 200 numa rota de saúde + versão publicada = `APP_VERSION` esperada (além da checagem de caminhos do `.deployignore`) | [4][9] | Médio | Médio | DEP4 | ⬜ |
| DEP6 | Rollback documentado/automatizado: reverte para o commit anterior e restaura o último dump/uploads se o healthcheck falhar; migrations forward-only | [9][10][11] | Alto | Médio | DEP3, DEP5 | ⬜ |
| DEP7 | Verificação de dependências no deploy: checagem de PhpSpreadsheet e poppler-utils, abortando com mensagem clara se faltarem | [1][2] | Médio | Baixo | DEP4 | ⬜ |
| DEP8 | Notificação/log estruturado do resultado do deploy (sucesso/erro, versão, migrations aplicadas, rollback) com retorno visível ao dev | [4][13] | Baixo | Baixo | DEP5 | ⬜ |

### Fontes

1. simple-php-git-deploy (markomarkovic) — https://github.com/markomarkovic/simple-php-git-deploy
2. Lyquix/php-git-deploy — deploy automático via webhooks — https://github.com/Lyquix/php-git-deploy
3. A tiny "Deployer" made with Shell Script and Rsync (DEV Community) — https://dev.to/felipperegazio/a-tiny-deployer-made-with-shell-script-and-rsync-3djd
4. Automating Website Deployments with Git: A Practical Guide (DeployBase) — https://deploybase.io/blog/automating-website-deployments-with-git-a-practical-guide
5. Git Pre-Push Hook: A Practical Guide (Sling Academy) — https://www.slingacademy.com/article/git-pre-push-hook-a-practical-guide-with-examples/
6. Git: Automatically Lint Your Code or Run Tests on git push (Natter Stefan) — https://blog.natterstefan.me/git-automatically-lint-your-code-or-run-tests-on-git-push-with-git-hooks
7. How to Handle Database Migrations in MySQL (OneUptime) — https://oneuptime.com/blog/post/2026-02-02-mysql-database-migrations/view
8. How to Manage Database Migrations in PHP (DEV Community) — https://dev.to/abhay_yt_52a8e72b213be229/how-to-manage-database-migrations-in-php-12bi
9. Database Migration Strategies for Zero-Downtime Deployments (DeployHQ) — https://www.deployhq.com/blog/database-migration-strategies-for-zero-downtime-deployments-a-step-by-step-guide
10. Database Rollbacks in CI/CD: Strategies and Pitfalls (Medium) — https://medium.com/@jasminfluri/database-rollbacks-in-ci-cd-strategies-and-pitfalls-f0ffd4d4741a
11. Database Rollback Strategies in DevOps (Harness) — https://www.harness.io/harness-devops-academy/database-rollback-strategies-in-devops
12. Self-hosted runners (GitHub Docs) — https://docs.github.com/actions/hosting-your-own-runners
13. How to Configure Self-Hosted Runners in GitHub Actions (OneUptime) — https://oneuptime.com/blog/post/2026-01-25-github-actions-self-hosted-runners/view

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
