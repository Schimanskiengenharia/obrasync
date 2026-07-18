# Estudo — Módulos ObraSync: inventário interno + benchmark de mercado

**Data:** 2026-07-18 · **Spec:** `docs/superpowers/specs/2026-07-18-estudo-benchmark-modulos-design.md`
**Status:** completo e reconciliado após revisão adversarial (Codex) — aguardando decisões do usuário

Como usar este documento: cada frente termina numa tabela de recomendações.
Marque a coluna **Decisão** de cada linha com **sim** ou **não**. Cada item
aprovado vira um ciclo próprio de spec → plano → implementação (por etapas).

## Resumo executivo

Este estudo mapeou **8 frentes** do ObraSync (inventário de código com nomes reais de funções/tabelas/endpoints) e comparou cada uma com o mercado (23 produtos/práticas pesquisados, ~90 fontes citadas). Resultado: **67 recomendações** numeradas, cada uma com impacto, esforço e dependências, aguardando decisão sim/não.

**Principais achados:**

1. **O sistema não tem rede de proteção contra erros inesperados** — sem captura global JS, erros morrem no console; `alert()` bloqueante; 500 genérico sem código de rastreio (Frente 1).
2. **A aprovação de proposta é o elo mais frágil do fluxo comercial** — status digitado à mão, cópia de itens que perde metadados, contas/contrato em 3 cliques manuais; concorrentes (Sienge/Mega/TOTVS) tratam a venda como um fluxo único automatizado (Frente 2).
3. **O Gantt atual só mostra etapas** — o pedido central (linha do tempo com pagamentos + compras + marcos, estilo MS Project) é a recomendação G1 e conversa com a spec de cronograma já existente (Frente 3).
4. **Agenda e Kanban têm fundações prontas mas recursos dormentes** — `lembrete_minutos` sem disparo, visões mês/dia como código morto, WIP que não bloqueia, "Concluído" detectado por nome de coluna (Frentes 4-5).
5. **O financeiro calcula demais no navegador e de menos no servidor** — DRE/vencidos no front, sem baixa parcial real, sem régua de cobrança, conciliação OFX ambígua (Frente 6).
6. **O deploy tem 2 contadores manuais que já divergiram** (`?v=1798` vs `v1.34.0`) e backup que não bloqueia — a Opção A (automatizar as pontas do fluxo atual) resolve com esforço baixo (Frente 7).
7. **A API não está pronta para mobile/desktop** — sem CORS, sem paginação, bootstrap devolve o banco inteiro, dois formatos de resposta; o caminho é strangler (módulo a módulo), com PWA primeiro e Capacitor depois (Frente 8).

**Maior retorno com menor esforço** (impacto Alto + esforço Baixo): E1/E2 (captura global de erros), FC1 (botão Aprovar proposta), AG2/AG3 (atraso vermelho + concluir em 1 clique), KB6 (flag de coluna concluída), DEP1/DEP3 (validação pré-push + backup obrigatório), API3 (CORS), FIN9 (baixa via caixa para receber).

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
| E1 | Instalar captura global de erros JS (`window.onerror` + `unhandledrejection`) no bootstrap do SPA, com deduplicação/rate-limit do toast e proteção contra loop (handler nunca reporta a própria falha) | [3][4][5] — 0 handlers hoje | Alto | Baixo | — | **sim** |
| E2 | Tratar TODOS os `.catch` vazios (além dos 5 originais, também `app.js:7664, 7748, 10613, 16403, 17609, 18833`), classificando cada um: log-only (best-effort) vs feedback ao usuário | [5] | Médio | Médio | — | **sim** |
| E3 | Fase 1: substituir `alert()` de `saveForm` (`app.js:8709-8711`) por `showToast` com severidade (que hoje nem existe, `app.js:18640`). Fase 2 opcional: migrar os demais `alert()` de negócio (`app.js:3022-3488, 13459-14556`) | [1] | Médio | Baixo (F1) | — | **sim** |
| E4 | Código de correlação (UUID gerado no SERVIDOR) gravado no `error_log` junto do 500 e exibido na mensagem — sem depender de E5; nunca reutilizar UUID vindo do cliente | [10][11] | Médio | Baixo | — | **sim** |
| E5 | (revisada) Log estruturado (JSON) em ARQUIVO/syslog dedicado com rotação e redação de segredos — não tabela no mesmo banco (falha de conexão impediria o próprio INSERT); tabela só para eventos operacionais | [6][7] | Médio | Médio | — | **sim** |
| E6 | Validação inline (on blur) priorizando as regras de negócio com mais erro real, preservando o backend — forms genéricos já emitem `required` (`app.js:7473-7537`) | [2][8][9] | Médio | Alto | — | **sim** |
| E7 | = API2 (mesma iniciativa: envelope único de resposta). Decisão única na Frente 8 | [7] | — | — | — | → API2 |
| E8 | Catálogo de mensagens acionáveis: próximo passo + código de correlação — o 500 continua sem detalhe técnico (proteção deliberada contra vazamento) | [1] | Médio | Médio | E4 | **sim** |

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
| FC1 | Botão "Aprovar proposta" com prévia dos efeitos ATUAIS (obra + orçamento); a prévia completa (contas+contrato) vem junto com FC3 | Sienge [1]; Mega [6] | Alto | Baixo | — | **sim** |
| FC2 | Preservar metadados na cópia proposta→orçamento — variante mais simples: reaproveitar `orcamento_item_id`/`sinapi_id` (já preservados em `proposta_itens`, `app.js:16668`) para buscar o item-fonte | TOTVS [4]; Mega [6] | Alto | Médio | — | **sim** |
| FC3 | Gerar contas a receber + contrato na aprovação, em transação única e idempotente (parcelamento de `paymentTerms`, snapshot); centro de custo como OPÇÃO, não criação cega | Sienge [1][2]; Mega [6] | Alto | Alto | FC1, FC2, NOVO-1 | **sim** |
| FC4 | (revisada) Painel de "próxima ação" contextual no funil (o que falta nesta proposta/obra, com links) em vez de wizard monolítico — o fluxo já é mais conectado do que parecia (proposta nasce do orçamento `app.js:16592`; cotação gera pedido `app.js:14154`) | Sienge [1] | Médio | Médio | FC1 | **sim** |
| FC5 | Unificar/renomear menus ambíguos (dois "orçamentos", dois "Cotações") — só rótulos/navegação, SEM renomear chaves/rotas persistidas | Sienge [1]; Mega [6] | Médio | Baixo | — | **sim** |
| FC6 | (revisada) Evoluir `proposta_orcamento_vinculos` como fonte ÚNICA de grupos/disciplinas — o documento já tem seções por disciplina (`proposalDisciplinasHtml` `app.js:15748`); avaliar aposentar `proposta_grupos` dormente em vez de ativá-la (evita duas fontes de verdade) | Mega [6] | Médio | Médio | — | **sim** |
| FC7 | Mapa comparativo com HISTÓRICO temporal de preço/prazo por fornecedor e registro de negociação (modelo de rodada, validade, auditoria) — a comparação de menor preço já existe (`app.js:13294, 14180`) | Sienge Construcompras [3]; Obra Prima [8][9] | Alto | Alto | — | **sim** |
| FC8 | (revisada) Planejamento de NECESSIDADE de compra por data/lead time com notificação ao comprador (estilo Sienge) — o back-link orçamento→cotação→pedido já existe (`compraMatriz` `app.js:14154`) | Sienge [2]; TOTVS [5] | Médio | Alto | FC2 | **sim** |

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
| G2 | Motor de dependências começando por FS + lag (setas + recálculo em cascata); os 4 tipos ficam para fase posterior — `predecessorIds`/`durationDays` já são persistidos e importados/exportados no XML | MSP [2], P6 [4], Smartsheet [7], Monday [9] | Alto | Alto | spec cronograma | ⬜ |
| G3 | Caminho crítico calculado (CPM) com destaque em vermelho nas barras e setas | MSP [1], P6 [5], Smartsheet [8], Monday [11] | Alto | Alto | G2 validado · spec cronograma | ⬜ |
| G4 | Baseline: primeiro UMA baseline somente-leitura (snapshot cinza sobreposto); versionamento múltiplo (0/1/2) em fase posterior — exige schema de snapshots + criação atômica + UI | Monday [10], Smartsheet [8], MSP [1] | Médio | Alto | spec cronograma | ⬜ |
| G5 | Curva S física e financeira — exige distribuição temporal/calendário/pesos e regras de medição; curva contratual CONFIGURÁVEL (não assumir 30/60/90/120) | P6 [6], MSP [3] | Alto | Alto | G1, G6 · spec cronograma | ⬜ |
| G6 | EAP hierárquica no Gantt (expandir/recolher pacotes) e % físico ponderado por peso (hoje é média aritmética) | MSP [2], P6 [6] | Médio | Alto | spec cronograma | ⬜ |
| G7 | Edição direta no Gantt (arrastar barra, desenhar seta) — o Gantt atual é HTML calculado sem handlers; snapping/validação/rollback elevam o esforço | Smartsheet [7], Monday [9], MSP [2] | Médio | Alto | G2 | ⬜ |
| G8 | (revisada) Integrar os marcos REAIS de `projectMilestones` à linha do tempo (losango + evento de cobrança) — hoje só existe um ponto na barra da etapa `isMilestone`; trocar apenas a forma seria cosmético | MSP [2], Smartsheet [7], Monday [9] | Médio | Baixo | projectMilestones (atual) | **sim** |

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
| AG1 | Fase 1: notas simples (ampliar o uso do `descricao` na UI). Histórico/comentários/anexos = fase 2 (exigem tabelas, endpoints, upload seguro e permissões — esforço Alto) | Outlook [4]; Todoist [6] | Médio | Baixo (F1) | — | **sim** |
| AG2 | Destaque vermelho de atraso também para eventos manuais (hoje só financeiros, `app.js:9319`), excluindo realizado/concluído/cancelado, com data local (M10) | Todoist [6][8]; Google [1] | Médio | Baixo | — | **sim** |
| AG3 | Botão rápido "Concluir" no card (1 clique → `status=concluido`) — o enum já aceita `concluido`/`realizado`, sem dependência de padronização | Google Tasks [2]; Todoist [6] | Médio | Baixo | — | **sim** |
| AG4 | Recorrência de eventos — modelar SÉRIE + exceções (não gerar cópias infinitas); nenhum suporte hoje no schema/handler | Google [3]/Outlook [4]/Todoist [7]/TickTick [10] | Alto | Alto | Coluna de recorrência + gerador | **sim** |
| AG5 | Lembretes reais usando `lembrete_minutos` (gravado mas dormente) — o disparo exige a plataforma de notificações compartilhada (mesma de KB9/FIN6: scheduler, fila, canais, templates, opt-out) | Outlook [5]/Todoist [6]/TickTick [11] | Alto | Alto | Plataforma de notificações | **sim** |
| AG6 | Arrastar evento para reagendar direto na grade (update já aceita `data_inicio/fim`, `api/index.php:1591`) | Google [2]/Todoist [6] | Médio | Médio | — | **sim** |
| AG7 | Visões adicionais: entregar MÊS primeiro (ou lista mensal); Dia depois — labels auxiliares existem mas não equivalem a layouts prontos; duas visões responsivas = esforço Alto | TickTick [9] | Médio | Alto | — | **sim** |
| AG8 | Cor por evento e/ou categoria/tipo (hoje sem coluna de cor; mapa fixo só p/ financeiros) | Outlook [4]; Todoist [8]; TickTick [9] | Médio | Médio | Coluna de cor + legenda unificada | **sim** |
| AG9 | Painel "Em aberto e atrasadas" — 80/20: contador com filtro primeiro; conclusão em lote depois | Google [1]; Todoist [6] | Médio | Médio | AG2 · AG3 | **sim** |

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
| KB1 | UI de CRUD de quadros e colunas (criar/renomear/reordenar/excluir/cor/limite), com proteção ao excluir coluna que contém cards | Trello [5], ClickUp [15] | Alto | Médio | — | **sim** |
| KB2 | WIP: aviso visual no estouro (padrão do mercado — Jira/ClickUp não bloqueiam) + validação no BACKEND contra corrida; sem dependência de KB1 | Jira [7], ClickUp [14] | Médio | Baixo | — | **sim** |
| KB3 | Etiquetas/tags reutilizáveis com filtro — exige catálogo + N:N + UI (a prioridade colorida já existe como paliativo) | Trello [1], Monday [9] | Médio | Alto | — | **sim** |
| KB4 | Checklist SIMPLES no card (itens marcáveis); prazo/responsável por item vira subtarefa — fase posterior | Trello [2], ClickUp [13] | Médio | Médio | — | **sim** |
| KB5 | Começar por COMENTÁRIOS no card; menção/notificação e anexos são superfícies separadas (upload fora do docroot, autorização) — fases seguintes | Trello [4][6] | Médio | Alto | — | **sim** |
| KB6 | Flag booleano "concluída" em `kanban_colunas` (migration + `ensure_*`), corrigindo `kanban_card_is_done` que decide por NOME (back `api/index.php:14136` + front `app.js:9731`); sem dependência de KB1 | Jira [8], Monday [10] | Alto | Baixo | — | **sim** |
| KB7 | Reordenação fina dentro da coluna (posição relativa) com normalização das posições no backend (evita empates de `Date.now()`) | Trello [5] | Médio | Baixo | — | **sim** |
| KB8 | Sincronizar item de origem ao concluir card com `referencia_tipo` — exige handlers idempotentes por tipo, autorização e regra de reversão | Monday [12], Trello [3] | Alto | Alto | KB6 + mapa de tipos | **sim** |
| KB9 | Alerta de atraso com notificação real — depende da plataforma de notificações compartilhada (AG5/FIN6); 80/20: o widget de urgentes do dashboard já existe (`app.js:4856`) | Trello [1], ClickUp [15] | Médio | Alto | Plataforma de notificações | **sim** |

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
| FIN1 | Baixa parcial com LANÇAMENTOS de liquidação (valor, estorno, saldo derivado) — não uma simples coluna acumulada; integra caixa/OFX/DRE/cron e corrige `mark_overdue_accounts` p/ "Parcial" vencido | Conta Azul [3], Omie [8], QuickBooks [17] | Alto | Alto | — | **sim** |
| FIN2 | Baixa em lote transacional por título (falha parcial tratada), herdando conta/data/valor da liquidação — Médio se restrita a baixa integral homogênea | Conta Azul [4], Omie [9] | Médio | Alto | FIN1 | **sim** |
| FIN3 | Seletor de período no fluxo de caixa — hoje `collectMonths` é fixo em ±6 meses | Granatum [15], QuickBooks [16] | Médio | Baixo | — | **sim** |
| FIN4 | (revisada) CENÁRIOS/simulação hipotética sem alterar títulos — previsto × realizado JÁ existe no fluxo de caixa (séries separadas, `renderCashFlow` `app.js:16852`) | Granatum [13][14], QuickBooks [16] | Médio | Alto | FIN3 | **sim** |
| FIN5 | (revisada) Endpoints on-demand de DRE/vencidos a partir das FONTES atuais — não acoplar ao snapshot `consolidate_monthly_dre` (soma `journal_entries` num total único; perderia a semântica competência/caixa/pendências do DRE atual) | Granatum [15], Omie [6] | Médio | Médio | — | **sim** |
| FIN6 | Régua de cobrança automática (D-x, vencimento, D+x) — depende de consentimento, templates, canal, tentativas e opt-out (multa/juros é opcional); usa a plataforma de notificações compartilhada | Nibo [11], Omie [6] | Alto | Alto | Plataforma de notificações | **sim** |
| FIN7 | Aging por faixas (a vencer, 1-30, 31-60, 61-90, 90+) para receber e pagar — preferencialmente calculado no backend | QuickBooks [17], Nibo [12], Conta Azul [5] | Médio | Baixo | — | **sim** |
| FIN8 | (revisada) Ajustes FINOS na conciliação existente: janela/pesos configuráveis + critério textual no match — dedupe por FitID, ±5 dias e score de confiança JÁ implementados (`ofx_find_matches` `api/index.php:7311`) | Conta Azul [1][2] | Médio | Médio | — | **sim** |
| FIN9 | Baixa via caixa vinculado simétrica para contas a receber (criar Entrada + marcar Recebido), com transação e anti-dupla vinculação — hoje só existe para pagar | Omie [8], Conta Azul [3] | Médio | Baixo | — | **sim** |

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
| DEP1 | Hook `pre-push` versionado (via `core.hooksPath`/script instalador) rodando `php -l` + `node --check` e abortando o push — contornável com `--no-verify`, por isso impacto Médio (defesa de 1ª linha, não garantia) | [5][6] | Médio | Baixo | — | **sim** |
| DEP2 | (revisada) Cache busting derivado do COMMIT: hash aplicado no deploy (ou comando de release PRÉ-commit) — versão no `pre-push` é tecnicamente incorreta (alteraria arquivos fora do commit); `?v=` e `APP_VERSION` deixam de ser contadores manuais desacoplados | [4][5] | Médio | Médio | — | **sim** |
| DEP3 | PRIMEIRO consertar o backup (propagar falha: `pipefail`, validar arquivos não-vazios, escrita atômica — hoje o script pode falhar e sair com código 0) e SÓ ENTÃO `deploy.php` abortar no exit≠0 | [9][10][11] | Alto | Médio | — | **sim** |
| DEP4 | Migrations automáticas com `schema_migrations` — SÓ após backup válido + lock de deploy (NOVO-4), com checksums/ordem, credencial restrita e teste em cópia; MySQL não tem rollback de DDL; nunca marcar aplicada após falha parcial | [7][8][9] | Alto | Alto | DEP3, NOVO-4 | **sim** |
| DEP5 | Healthcheck pós-deploy: rota de saúde sem efeito no banco + verificação do COMMIT publicado (mais robusto que comparar `APP_VERSION` manual) | [4][9] | Médio | Baixo | — | **sim** |
| DEP6 | (revisada) Rollback automático SÓ do código (git); restore de dump/uploads fica como RUNBOOK manual testado — restauração automática poderia apagar dados gravados após o backup e viola a regra de não operar o banco diretamente | [9][10][11] | Médio | Médio | DEP5 | **sim** |
| DEP7 | (revisada) Dependências (PhpSpreadsheet/pdftotext) como AVISO de capacidade no healthcheck — não abortar o deploy por dependência opcional que já degrada com 422 | [1][2] | Baixo | Baixo | DEP5 | **sim** |
| DEP8 | `deploy_run_id` + status confiável + notificação de falha (o log em si já existe; compartilha o run_id com o healthcheck do DEP5) | [4][13] | Baixo | Baixo | — | **sim** |

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

**Backend — o que falta para a API servir outros clientes**
- **Envelope de resposta único:** hoje coexistem `{ok,data}`/`{ok,error}` (REST) e `{success,data,message}` (módulos); qualquer SDK mobile teria de replicar o `handleApiResponse` do SPA. Padronizar um só contrato (ex.: `{ok, data, error, code}` — mesmo alvo do E7 da Frente 1). Os dois formatos convivem durante a transição — migração por fatias, nunca big-bang.
- **Rotas consistentes:** unificar os dois estilos (REST por path × `?module=&action=`) sob um padrão REST previsível (~15 handlers + ~90 recursos a normalizar aos poucos).
- **Versionamento `/api/v1/`** sem quebrar o SPA (que usa `API_BASE` relativo) [3][4][5]; **documentação OpenAPI** como contrato máquina-legível e teste de cada fatia migrada [4][5][6].
- **CORS + preflight:** hoje 0 `Access-Control-Allow-Origin` e nenhum `OPTIONS` — sem isso nenhum front em outra origem chama a API.
- **Auth para mobile:** sessão em banco com idle 30 min é agressiva; adotar access token curto + refresh token de longa duração, com rotação e storage seguro, coexistindo com a sessão atual do SPA [7][8][9].
- **Paginação + bootstrap fatiado:** o `bootstrap` devolve o banco inteiro — inviável em rede móvel.
- **Estratégia strangler:** padronizar UM módulo por vez atrás de fachada, cada fatia testável, sem quebrar o SPA [1][2][3].

**Mobile**
- **PWA:** menor esforço, reusa o SPA responsivo, instalável, sem loja [10][11][12]. **Capacitor:** mesmo código web num shell nativo, entra nas lojas e ganha push/câmera/offline — melhor custo-benefício para gestão usada em obra/escritório [10][11]. **Nativo:** só se exigir UX/performance específica — não é o caso.
- **Recomendação:** PWA primeiro; Capacitor quando quiser loja/recursos nativos, reusando o mesmo front.

**Desktop**
- **PWA instalável:** custo quase zero, atualiza sozinho — cobre o "app de escritório". **Electron/Tauri:** só com integração profunda ao SO (Tauri = binário leve; Electron = maior) [13][14].
- **Recomendação:** PWA instalável; Tauri como evolução se surgir necessidade de SO.

**Ordem sugerida (fatias pequenas, cada uma testável):** 1. OpenAPI do que existe → 2. envelope único módulo a módulo → 3. CORS+preflight → 4. `/api/v1` + paginação + bootstrap fatiado → 5. auth mobile com refresh token → 6. PWA instalável → 7. Capacitor.

### Recomendações

| # | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão |
|---|---|---|---|---|---|---|
| API1 | Inventariar e documentar as rotas em OpenAPI + CONTRACT TESTS executáveis (documentar schemas/erros/permissões dos ~90 recursos e handlers é trabalho Alto) | [4][5][6] | Médio | Alto | — | ⬜ |
| API2 | (= E7) Envelope de resposta único via fachada/adaptador, módulo a módulo, sem quebrar o SPA — impacto pleno quando houver o 2º cliente | [1][2][3] | Alto | Alto | API1 | ⬜ |
| API3 | CORS com ALLOWLIST configurável + `Vary: Origin` + nunca `*` com credenciais — implementar quando houver origem externa concreta (o produto atual é same-origin) | [5] | Médio | Baixo | — | ⬜ |
| API4 | `/api/v1` via fachada preservando envelopes legados + estratégia de deprecação — impacto real só com cliente externo | [3][4][5] | Baixo | Médio | API1 | ⬜ |
| API5 | (revisada) Bootstrap LAZY por módulo + metadados `total/next` + SPA adotar a paginação — `limit/offset` com teto 5000 JÁ existe no CRUD (`api/index.php:1956`) e o bootstrap já recorta SINAPI | [4][5] | Alto | Médio | — | ⬜ |
| API6 | Auth mobile: ajustar idle/TTL da sessão atual já serve mobile online; refresh token rotativo SÓ com threat model e cliente real | [7][8][9] | Médio | Alto | API1 | ⬜ |
| API7 | Fase 1: PWA instalável online (manifest + service worker básico) — não depende de CORS nem de API5. Fase 2: offline com fila de mutações e invalidação (Alto, dados financeiros) | [10][11][12] | Médio | Médio | — | ⬜ |
| API8 | Capacitor: reutiliza a UI mas exige lojas, storage seguro, deep links, push e testes nativos | [10][11] | Médio | Alto | API7 (+API6 p/ sessão persistente) | ⬜ |

### Fontes

1. Strangler Fig Pattern — Azure Architecture Center (Microsoft Learn) — https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig
2. Embracing the Strangler Fig pattern for legacy modernization (Thoughtworks) — https://www.thoughtworks.com/en-us/insights/articles/embracing-strangler-fig-pattern-legacy-modernization-part-one
3. Strangler Fig pattern for API versioning (Zuplo) — https://zuplo.com/learning-center/strangler-fig-pattern-for-api-versioning
4. Versioning Best Practices in REST API Design (Speakeasy) — https://www.speakeasy.com/api-design/versioning/
5. API Versioning: Guidelines and Best Practices (Kong Inc.) — https://konghq.com/blog/engineering/service-design-guidelines-api-versioning
6. How to Document REST APIs with OpenAPI (OneUptime) — https://oneuptime.com/blog/post/2026-01-26-openapi-rest-documentation/view
7. Refresh Tokens in Mobile APIs: A Complete Guide (Medium) — https://medium.com/@edu.hoyos/refresh-tokens-in-mobile-apis-a-complete-guide-for-ios-and-android-71caa707f2f6
8. Refresh Tokens: What Are They and When to Use Them (Auth0) — https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/
9. JWT Best Practices for Web & Mobile Apps (Duende) — https://duendesoftware.com/learn/best-practices-using-jwts-with-web-and-mobile-apps
10. PWA vs Capacitor vs Native: Choosing an App Architecture in 2026 (Our Code World) — https://ourcodeworld.com/articles/read/3646/pwa-vs-capacitor-vs-native-2026
11. Building Progressive Web Apps (Capacitor Documentation) — https://capacitorjs.com/docs/web/progressive-web-apps
12. PWA vs Native App in 2025: Pros & Cons for Business Apps (Wezom) — https://wezom.com/blog/pwa-vs-native-app-in-2025
13. Tauri v2 vs Electron 2026: The Honest Comparison (BuildMVPFast) — https://www.buildmvpfast.com/blog/tauri-v2-vs-electron-desktop-apps-2026
14. Electron vs. Tauri (DoltHub Blog) — https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/

## Reconciliação pós-revisão adversarial (Codex, 2026-07-18)

O estudo passou por revisão adversarial independente (protocolo em
`2026-07-revisao-adversarial-codex.md`, resultado em
`2026-07-revisao-adversarial-codex-resultado.md`): 16 recomendações
confirmadas, 11 contestadas e 40 ajustadas. **As tabelas acima já estão na
versão reconciliada** — linhas marcadas "(revisada)" tiveram o texto
reescrito; impacto/esforço/dependências foram corrigidos conforme os
ajustes aceitos.

**Contestações verificadas por leitura de código antes de aceitar** (4/4
procederam): FIN8 (`ofx_find_matches` já tem dedupe FitID + janela ±5 dias +
score de confiança, `api/index.php:7311`), API5 (`limit/offset` teto 5000 já
existe, `api/index.php:1956`), FIN4 (previsto×realizado já plotado em séries
separadas, `app.js:16852`), FC6 (`proposalDisciplinasHtml` já gera seções por
disciplina, `app.js:15748`). As demais contestações (DEP2, DEP6, DEP7, E5,
FC4, FC8, FIN5) procedem por argumento técnico consistente com o inventário.

**Redundâncias consolidadas:** E7 = API2 (decisão única na Frente 8);
AG5 + KB9 + FIN6 compartilham uma **plataforma de notificações** (scheduler,
fila, canais, templates, opt-out — implementar uma vez); DEP5 + DEP8
compartilham o `deploy_run_id`; G5 consome o motor/dataset de G1/G6.

### Itens novos (propostos pela revisão adversarial)

| # | Melhoria | Evidência | Impacto | Esforço | Depende de | Decisão |
|---|---|---|---|---|---|---|
| NOVO-1 | Criação da proposta ATÔMICA em um endpoint (cabeçalho + vínculos + itens + variáveis, com idempotency key) — hoje cada registro é uma requisição e falha intermediária deixa proposta parcial | `app.js:16620-16695` | Alto | Alto | — | **sim** |
| NOVO-2 | Parar de descartar silenciosamente campos em `insert_dynamic`/`update_dynamic` em operações de negócio: registrar/recusar colunas inesperadas, expondo schema drift | `api/index.php:14197-14218` | Alto | Baixo | — | **sim** |
| NOVO-3 | Testes automatizados mínimos (fluxos financeiros/comerciais + smoke do deploy) — hoje o handoff exige só validação de sintaxe e não há suíte no repo | `CLAUDE.md`; `api/index.php:657-843` | Alto | Alto | — | **sim** |
| NOVO-4 | Serializar deploys com LOCK e verificar exit code/commit do `git pull` — hoje `shell_exec` pode falhar e o webhook ainda responder "Deploy OK" | `deploy.php:48-73` | Alto | Baixo | — | **sim** |

## Divergências entre os players — onde o mercado NÃO concorda

Nas tabelas de recomendação, a maioria das funcionalidades é consenso (todos têm). Abaixo, os pontos onde os players resolvem **o mesmo problema de jeitos diferentes** — nesses, além do sim/não, cabe escolher QUAL estilo seguir. Cada divergência aponta a recomendação afetada.

**Kanban — limite WIP: avisar ou bloquear? (afeta KB2)**
- Jira: ao estourar o limite, a coluna fica **vermelha** — alerta visual, o drop NÃO é bloqueado [F5: 7].
- ClickUp: destaque visual ao atingir a capacidade — também não bloqueia [F5: 14].
- Trello: não tem WIP nativo (só via power-up).
- *Escolha para o ObraSync:* o mercado dominante **avisa e deixa passar** (confia no time); bloquear de fato é mais rígido e raro. KB2 pode ser implementado nos dois modos — definir qual.

**Kanban — o que significa coluna "Concluída"? (afeta KB6/KB8)**
- Jira: coluna é **mapeada a um status** do fluxo de trabalho — "Done" vem do status, não do nome [F5: 8].
- Monday: semântica de rótulo ("What's Done") na coluna de status [F5: 10].
- Trello: por posição/arquivamento, sem semântica formal.
- *Escolha:* flag explícito na coluna (estilo Jira, proposto em KB6) é o mais robusto; o modelo Trello (implícito) é o que o ObraSync tem hoje e já quebrou (detecção por nome).

**Agenda — como tratar atrasados? (afeta AG2/AG9)**
- Google: **agrega** as vencidas numa entrada única de dia inteiro com contador (não polui a grade) [F4: 1].
- Todoist: botão **"Reagendar tudo"** — move todas as vencidas para hoje com sugestões inteligentes [F4: 6].
- TickTick: **lembretes persistentes** que insistem até concluir (estilo alarme) [F4: 11].
- *Escolha:* são três filosofias — visão agregada, reagendamento em massa, ou insistência. AG9 (painel de atrasadas) segue o estilo Google; dá para combinar com o botão de reagendar do Todoist.

**Agenda — cor: de quê? (afeta AG8)**
- Outlook: cor por **categoria** definida pelo usuário [F4: 4].
- Todoist: cor por **prioridade** (P1 vermelho) + etiquetas [F4: 8].
- Google: cor por evento/calendário individual.
- *Escolha:* cor por categoria/tipo (Outlook) casa melhor com os tipos já existentes na agenda do ObraSync; cor livre por evento (Google) é mais flexível e mais trabalhosa.

**Financeiro — conciliação: regras, IA ou integração bancária? (afeta FIN8)**
- Conta Azul: usuário **configura as regras** de match (exato; aproximado ±5 dias) [F6: 2].
- Nibo: **categorização automática** com ~85% de acerto (aprendizado) [F6: 10].
- Omie: aposta na **integração direta com os bancos** (extrato entra sozinho) [F6: 7].
- *Escolha:* para o ObraSync (OFX manual hoje), o caminho realista é o da Conta Azul — regras configuráveis + sugestão em vez de auto-match cego; integração bancária direta exige convênios/APIs de banco.

**Financeiro — projeção de caixa: cenários ou simulação? (afeta FIN4)**
- Granatum: **cenários salvos** (otimista/pessimista/realista) com metas acompanhadas [F6: 13].
- QuickBooks: **planner interativo** de curto prazo (~90 dias), ajustes hipotéticos que não alteram os livros [F6: 16].
- *Escolha:* cenários salvos servem planejamento de obra (horizonte longo); o planner serve decisão do dia a dia. Definir qual dos dois (ou ambos, em fases).

**Fluxo comercial — necessidade de compra: notificar ou gerar? (afeta FC8)**
- Sienge: o planejamento **desdobra a necessidade e NOTIFICA o comprador** nas datas previstas — humano decide [F2: 2].
- TOTVS: **gera os pedidos automaticamente** considerando lead time — sistema decide [F2: 5].
- *Escolha:* notificação (Sienge) mantém controle humano e é mais segura para começar; geração automática (TOTVS) é mais agressiva e exige lead times cadastrados.

**Fluxo comercial — entrada de NF: buscar ou receber? (afeta FC7/FIN8)**
- Obra Prima: **recebe a NF da SEFAZ automaticamente** (até 2h, sem digitação) [F2: 9].
- Sienge: NF é **vinculada manualmente** a medições/contratos (uma NF pode ligar várias medições) [F6: 18][19].
- *Escolha:* a busca automática na SEFAZ é um diferencial grande, mas exige certificado digital e integração fiscal — não está em nenhuma recomendação atual; se interessar, vira item novo.

**Gantt — baseline: snapshot visual ou variância numérica? (afeta G4)**
- Monday: baseline como **snapshot cinza travado** sobreposto às barras — comparação visual [F3: 10].
- Smartsheet: **variância em números** (dias adiantado/atrasado) por tarefa [F3: 8].
- MSP/P6: **múltiplas baselines versionadas** (0/1/2...) — mais completo e mais complexo [F3: 1][5].
- *Escolha:* a spec interna de cronograma já prevê o modelo MSP/P6 (versionado); o snapshot visual do Monday é o mais simples de exibir primeiro.

**Gantt — dependências: quão completo? (afeta G2)**
- Monday: só FS/FF/SS (sem SF) [F3: 9].
- MSP/P6: os 4 tipos + lag/lead; P6 distingue relação "driving" (linha sólida) de "non-driving" (pontilhada) [F3: 2][4].
- *Escolha:* começar com FS simples (o que 90% das obras usa) e evoluir; implementar os 4 tipos de cara é fidelidade MSP com custo alto.

**Erros — validação: quando disparar? (afeta E6)**
- Baymard/Smashing: validar **no blur** (ao sair do campo) — nem a cada tecla, nem só no submit [F1: 8][9].
- Prática comum em ERPs: validar só no submit (mais simples, pior UX).
- *Escolha:* blur é a recomendação técnica; para formulários longos do ObraSync o ganho é grande.

> Notação: [Fn: x] = fonte x da Frente n neste documento.

## Fechamento — visão consolidada e ordem sugerida

**Dependências transversais entre as frentes:**

- O **padrão de erros (F1) vem primeiro**: as melhorias de UX das outras frentes vão usar o toast padronizado (E3), a captura global (E1) e o log estruturado (E5). E7 (envelope de resposta único) é a MESMA iniciativa que API2 — decidir junto.
- O **deploy automatizado (F7) cedo barateia tudo**: com implementação por etapas (regra do projeto), cada etapa entra em produção — DEP1-DEP4 reduzem o custo e o risco de TODOS os ciclos seguintes.
- O **Gantt completo (F3) depende da spec de cronograma** (EAP, dependências, baseline): G2-G6 só depois de decidir implementá-la; G1 (linha do tempo com pagamentos/compras/marcos) e G8 podem começar antes, com os dados que já existem.
- A **frente de API (F8) é pré-requisito do mobile/desktop**, não urgência: pode andar em fatias (strangler) em paralelo às outras, começando pelo que também serve ao SPA atual (API1-API3).

**Ordem sugerida em ondas — REVISADA após a revisão adversarial** (cada onda = conjunto de ciclos spec → plano → implementação por etapas; dentro da onda, itens são independentes salvo "Depende de"):

- **Onda A — Integridade primeiro:** NOVO-4 (lock de deploy + exit code do pull), DEP3 (backup que falha de verdade e aborta), NOVO-2 (schema drift explícito), NOVO-3 (smoke tests mínimos), E1, E2 (rede de proteção de erros — E2 junto ou antes de E1, pois o handler global não vê promessas já engolidas).
- **Onda B — Correções pequenas comprovadas:** E3 (fase saveForm), E4 (correlation ID), FC1 (aprovar com prévia dos efeitos atuais), FC5 (menus), KB2, KB6, KB7 (WIP aviso, flag concluída, reordenação), FIN3, FIN7, FIN9, AG2, AG3, G8 (marcos reais na linha do tempo), DEP1, DEP5, DEP7, DEP8.
- **Onda C — Fluxos e transações:** NOVO-1 (proposta atômica), FC2, FC3, FC6 (vínculos como fonte única), FIN1, FIN2 (baixa parcial/lote com lançamentos), FIN5 (endpoints on-demand), KB1, KB4, AG1, AG6, AG8, DEP2 (cache por commit), DEP6 (rollback de código), E5, E8.
- **Onda D — Plataforma de notificações e pesados de módulo:** plataforma única de notificações (base de AG5 + KB9 + FIN6), AG4, AG7, AG9, KB3, KB5, KB8, FC4 (painel de próxima ação), FC7, FC8, FIN4, FIN8, E6, DEP4 (migrations automáticas — só com backup validado + lock + testes).
- **Onda E — Cronograma e API:** G1-G7 (Gantt custo-carregado com a spec de cronograma), API1-API8 (incluindo E7/API2 como decisão única), por contratos/fatias strangler.

A ordem é sugestão: as decisões sim/não nas tabelas definem o backlog real. Itens rejeitados saem; itens aprovados viram ciclos individuais respeitando apenas as colunas "Depende de".
