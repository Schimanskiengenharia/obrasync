# Diagnóstico: fluxo de trabalho desejado vs atual — ObraSync

> **Data:** 2026-07-06 · **Base:** `app.js` v1.26.3 (17.380 linhas) + `api/index.php` (13.033 linhas) + `schema.sql` + migrations.
> **Escopo:** 5 frentes mapeadas pelo dono, comparadas com o código real. **Só diagnóstico — nada foi alterado.**
> **Bússola de reuso:** [`docs/arquitetura/mapa-modulos-conexoes.md`](../arquitetura/mapa-modulos-conexoes.md).
>
> Formato por frente: **[existe hoje] → [distância] → [proposta reusando o existente] → [tamanho P/M/G] → [riscos/dependências]**.
> Ao final: sugestão de ordem de implementação.

---

## FRENTE 1 — Dashboard: cores dos avisos

**Desejado:** avisos de perda de dinheiro (contas a pagar, contas vencidas) em VERMELHO; avisos de atenção em AMARELO.

### Existe hoje

O dashboard (`renderDashboard`, app.js:4086) tem **quatro blocos com avisos**, cada um com estilo próprio (não há central de notificações/sino):

1. **Bloco principal `dashboardAlerts()`** (app.js:4510–4531) — 7 avisos possíveis, **TODOS com a mesma classe `.alert` = vermelho** (styles.css:1644), sem diferenciação de severidade:

| # | Condição (app.js) | Aviso | Cor hoje |
|---|---|---|---|
| 1 | 4512 | Contas vencidas: R$ X | vermelho |
| 2 | 4513 | Cronograma com N etapa(s) atrasada(s) | vermelho |
| 3 | 4514 | Custo realizado acima do previsto (obra) | vermelho |
| 4 | 4516 | Margem líquida baixa | vermelho |
| 5 | 4522 | Proposta(s) enviada(s) com validade vencida | vermelho |
| 6 | 4524 | Obra(s) com previsão de término vencida | vermelho |
| 7 | 4526 | Item(ns) do orçamento com estouro | vermelho |

2. **Painel Lucro × Caixa `lucroCaixaAlerts()`** (app.js:4008–4018) — **único bloco que JÁ diferencia**: "% do lucro ainda não entrou no caixa" usa `.alert-warning` (âmbar, styles.css:1653); "vencidas há +30 dias" usa `.alert-danger` (vermelho, styles.css:1665).
3. **Widget de execução de obras** (app.js:4345–4392) — já usa vermelho/amarelo/verde (`.exec-estouro`/`.exec-parcial`/`.exec-concluido`, styles.css:2094–2098).
4. **KPI cards** (`kpi()`, app.js:4579–4583) — cor pelo SINAL do valor: positivo = verde. Efeito contra-intuitivo: os cards **"Contas a pagar"** (app.js:4125) e **"Contas vencidas"** (app.js:4126) mostram o valor em **VERDE** (é positivo), quando semanticamente deveriam ser vermelhos.

Observação: os alertas de vencimento do cron (`obra_notificacoes` tipo `ALERTA_VENCIMENTO`, migration 2026-07-01) **não aparecem no dashboard** — só no módulo `projectNotifications`.

### Distância

Pequena. As classes de severidade **já existem com suporte a tema escuro** (`.alert-warning` âmbar, `.alert-danger` vermelho — styles.css:1653/1665); o que falta é o `dashboardAlerts()` classificar cada aviso em vez de jogar tudo numa string com classe única (o `.map()` da linha app.js:4530).

### Proposta (reusando o existente)

1. Em `dashboardAlerts()`, cada `alerts.push(...)` passa a carregar `{texto, severidade}`; o join da linha 4530 aplica `.alert-danger` ou `.alert-warning`. **Zero CSS novo.** Mapeamento sugerido (validar com o dono):
   - **VERMELHO (perda de dinheiro):** contas vencidas (#1), custo realizado acima do previsto (#3), estouro de itens (#7).
   - **AMARELO (atenção):** cronograma atrasado (#2), margem baixa (#4), propostas com validade vencida (#5), obras com término vencido (#6).
2. Nos KPI cards, sobrescrever o `tone` dos cards "Contas a pagar"/"Contas vencidas" (app.js:4125–4126) para vermelho quando valor > 0 (o `kpi()` já aceita tone, app.js:4579).

### Tamanho: **P** (algumas dezenas de linhas em app.js, sem migration, sem backend).

### Riscos/dependências

Nenhum técnico. Única decisão do dono: o mapeamento exato aviso→cor (a tabela acima é sugestão). Independente das demais frentes.

---

## FRENTE 2 — Categorias financeiras: "Conta contábil vinculada" vazia

**Desejado:** entender se falta algo.

### Existe hoje

- O dropdown do form de categoria (`categories`, app.js:1262, campo tipo `chartAccount`) puxa opções de **`db.chartAccounts`** (mapeamento app.js:7177; montagem das `<option>` em app.js:7214).
- A tabela **`chart_accounts` existe** (schema.sql:98–107: code, name, type, parentId, acceptsEntries, status) e `financial_categories.chartAccountId` é FK **nullable** (schema.sql:113–115).
- A **tela de cadastro existe e está no menu**: Contabilidade Gerencial → "Plano de contas" (moduleNames app.js:157; sidebar app.js:212; form app.js:1266–1277; CRUD genérico via `renderCrud`).
- O bootstrap devolve `chartAccounts` normalmente (resource_map api/index.php:1800; bootstrap_data api/index.php:2510–2542).

### Diagnóstico direto

**Não é bug.** O dropdown está vazio porque **a tabela nasce vazia e não há seed nem auto-cura** — nenhum `INSERT INTO chart_accounts` em schema/migrations/PHP, e não existe `ensure_default_chart_accounts` (contraste: centros de custo têm `ensure_default_cost_centers`, chamado no bootstrap em api/index.php:2393). As 7 contas demo do frontend (app.js:1565–1573) são sobrescritas pelo `[]` do servidor em `refreshData()` (app.js:2004).

**A categoria funciona 100% sem a vinculação:** o campo é opcional e hoje é praticamente decorativo — só aparece como coluna/label na listagem (app.js:6955, 7118). **A DRE não usa** o vínculo (agrupa por categoria financeira, app.js:16169–16217); nenhum relatório/export consome `chartAccountId`.

### Proposta (reusando o existente)

Duas opções, em ordem de esforço:
1. **Só orientação:** cadastrar contas em Contabilidade Gerencial → Plano de contas; elas passam a aparecer no dropdown. Custo zero.
2. **Seed automático:** criar `ensure_default_chart_accounts()` espelhando o padrão `ensure_default_cost_centers` (api/index.php:2393), semeando um plano de contas mínimo de construção civil (pode partir das 7 contas demo do app.js:1565–1573). Migration + `ensure_*`, como manda a convenção.

Se um dia o dono quiser DRE/relatórios POR conta contábil, isso é escopo novo (hoje o vínculo não alimenta nada) — decidir antes se vale manter o campo.

### Tamanho: **P** (opção 2: 1 função ensure + 1 migration).

### Riscos/dependências

Nenhum. Independente. Único ponto de atenção: escolher um plano de contas padrão que faça sentido para o dono (não inventar estrutura contábil sem validar).

---

## FRENTE 3 — Comercial: orçamento multi-item/multi-disciplina

**Desejado:** um orçamento comercial (Orç-01, cliente João) com várias disciplinas (cozinha + energia solar), valor total + descrição/valor por disciplina, proposta refletindo as seções, template acompanhando e contrato "falando de acordo". Alternativas do dono: (a) vários orçamentos juntados numa proposta; (b) um orçamento com seções.

### Existe hoje

**Há DOIS "orçamentos" no sistema — e a confusão começa aí:**

| Conceito | Tabela | Módulo | Itemizado? | Gera proposta? |
|---|---|---|---|---|
| Orçamento COMERCIAL | `budgets` | `budgets` ("Orçamentos", seção Comercial) | **NÃO** (1 descrição + 1 valor; app.js:1073–1089) | **NÃO** (sem botão; campo `proposalId` existe mas sem fluxo) |
| Orçamento de OBRA | `orcamentos_obras` + `orcamento_obra_itens` | `workBudgets` | SIM (itens, etapas, BDI) | **SIM** — `openProposalGenerator` (app.js:13771), botões em app.js:6931–6932 e 10533 |

**`budget_items` não existe.** Toda a capacidade multi-disciplina vive na camada proposta:

- **A alternativa (a) do dono JÁ É o modelo implementado (~80% pronto):** `proposta_orcamento_vinculos` (schema.sql:610–629) guarda **vários orçamentos por proposta** (UNIQUE proposalId+workBudgetId), cada vínculo com `nome_grupo`, `disciplina`, `bdi_grupo`, `custo_total`, `valor_venda`, `ordem`. A UI permite via painel "Orçamentos vinculados" com botão **"+ Vincular orçamento"** (`renderProposalGroupsPanel`, app.js:14043–14190; handler 14170–14178). O cálculo por grupo é `proposalGroupsCompute()` (app.js:13994–14038).
- **O documento da proposta é o gargalo:** `proposalDocumentHtml()` (app.js:14367–14426) descreve **um único objeto** (objeto/escopo/etapas são variáveis de nível-proposta via `{{placeholders}}`). Multi-disciplina aparece só em dois pontos parciais: o quadro de investimento `proposalInvestmentHtml()` (app.js:14249–14278) agrupa **valores** por disciplina quando há 2+ grupos (sem descrição/itens por seção), e a tabela de itens plana pode agrupar por nome do grupo (app.js:14439, 14024).
- **`proposta_grupos` (árvore por disciplina, schema.sql:2077–2088) está DORMENTE:** nenhuma linha de código escreve/lê nela; `proposta_itens.grupo_id` nunca é preenchido (`createProposalLinkedRecords`, app.js:15110–15166, grava vínculos+itens+variáveis, sem grupos).
- **Template:** `proposta_modelos.estrutura_json` guarda a árvore de grupos `{budgetId, nome_grupo, disciplina, bdi_grupo, ordem}` (`saveProposalAsTemplate` app.js:14195–14221; `applyProposalTemplate` 14225–14245) — não placeholders de texto por seção.
- **Contrato:** `buildContractObjeto()` (app.js:6752–6759) já monta "Escopo por disciplina:" listando os grupos **por nome** no objeto; o valor é único (`proposal.amount`, app.js:6780/6785). `contractPdfHtml` (app.js:6809) usa esse objeto na cláusula 1ª.

### Distância

A infraestrutura da alternativa (a) existe e funciona: vários orçamentos por proposta, cada um com disciplina e valor. Faltam três peças: **descrição por disciplina** (não há coluna), **documento em seções** (título + descrição + subtotal por disciplina) e **contrato com valor por disciplina**. A alternativa (b) exigiria acordar `proposta_grupos` + construir um editor de seções do zero — muito mais longe do que existe.

### Proposta (reusando o existente) — estender a alternativa (a)

1. **Coluna `descricao` em `proposta_orcamento_vinculos`** (migration + `ensure_*`) — a descrição/escopo de cada disciplina.
2. **Campo de descrição no painel de grupos** (`renderProposalGroupsPanel`, que já edita nome_grupo/disciplina/BDI por linha).
3. **Documento por seções:** em `proposalDocumentHtml`, quando `calc.grupos.length > 1`, iterar `calc.grupos` emitindo seção por disciplina (título + descrição + subtotal, tabela de itens do grupo opcional) — o padrão de iteração já está provado em `proposalInvestmentHtml`.
4. **Template:** incluir as descrições no `estrutura_json` (o save/apply já serializa os grupos — é acrescentar o campo).
5. **Contrato:** estender `buildContractObjeto` para incluir o valor por disciplina (`valor_venda` já está no vínculo).
6. **Decisão de UX:** o módulo `budgets` (Comercial → "Orçamentos") não participa de nada — ou escondê-lo do menu ou reposicioná-lo como funil/pré-venda, para o "Orç-01 do João" do dono passar a ser lido como "proposta com N orçamentos de obra vinculados".

Nota: "disciplina" hoje = um orçamento de obra inteiro vinculado. Para o caso do dono (cozinha + solar), são 2 orçamentos de obra (ou 1 orçamento por disciplina criado rápido) vinculados à mesma proposta — o fluxo já suporta.

### Tamanho: **M** (1 coluna + UI do painel + geração do documento em seções + contrato; sem estrutura nova).

### Riscos/dependências

- Propostas antigas sem descrição por grupo → renderização deve ser condicional (não quebrar documentos já salvos em `proposalBody`).
- Coordenar com a FRENTE 4a: a aprovação copia `proposta_itens` para o orçamento da obra — se a estrutura de grupos evoluir, o mapeamento grupo→`stageName` (que já acontece) deve ser mantido.
- `proposta_grupos` dormente: ou conectar de fato ou documentar como reserva futura — não deixar meio-caminho.

---

## FRENTE 4a — Obras/Projetos: nascer da proposta

**Desejado:** ao aprovar a proposta, a obra nasce dela — herdando cliente, valores, cadastros (o "previsto") para comparar com o realizado.

### Existe hoje — **a automação JÁ EXISTE no backend, mas com defeitos**

Correção de premissa: `createProposalLinkedRecords()` (app.js:15110) roda na **criação** da proposta (grava vínculos/itens/variáveis) — não é a aprovação. A automação real dispara no **PUT que muda o status para "Aprovada"** (api/index.php:657–776, transacional, com guarda anti-reaprovação):

1. **Cria a obra** (`projects`, api/index.php:685–697) herdando: `clientId`, `amount`→`revenueContracted`, `commercialUserId`, `description`→`name`. Status fixo `'Planejamento'`.
2. Cria os boards Kanban da obra (698).
3. **Cria um orçamento de obra novo** (`orcamentos_obras`, 705–718, status 'Aprovado', `totalPrice`=amount) e **copia `proposta_itens` → `orcamento_obra_itens`** (720–747).
4. Registra em `eventos_automacao` (749–754) e responde com `projectId`/`workBudgetId`.

Não há botão "Aprovar" — a transição é edição do campo Status no cadastro (saveRecord PUT, app.js:8382–8392). Pós-aprovação existem botões manuais: "Converter" em venda (app.js:8739), **"Gerar contas"** a receber (`createReceivablesFromProposal`, app.js:8794 — já grava `projectId`+`proposalId`), "Gerar contrato" (app.js:6761).

**Peças de previsto vs realizado que já existem:** `orcamento_obra_itens.quantidade_realizada` + `workBudgetExecution` update/history (api/index.php:5230–5252) + `dashboardExecution&action=summary` (api/index.php:5268–5342: previsto=ΣtotalPrice, realizado=Σqtd_realizada×unitPrice) + visão "Realizado vs Orçado" no orçamento. O realizado **financeiro** (payable/receivable por `projectId`) vive em relatórios separados (app.js:15269/15282/15295) e **não cruza** com o físico.

### Distância — defeitos da automação atual

1. **Obra duplicada (o pior):** a proposta normalmente nasce de um orçamento que JÁ tem `projectId` (o gerador copia, app.js:15068). A automação **sempre cria obra nova** sem checar, e só re-vincula `proposal.projectId` se estava vazio (api/index.php:700–703) → nasce obra+orçamento **órfãos/duplicados**, e a proposta continua apontando para a obra original.
2. **Previsto de custo errado:** os itens copiados recebem `unitCost = item.unitPrice` (preço de VENDA, api/index.php:733) — o `custo_unitario` que existe em `proposta_itens` é **ignorado** → margem zero na base de comparação.
3. Metadados perdidos na cópia: `etapa_id`, `tipo`, `bdiPercent`, `sinapi_id`, `categoryId` ficam nulos (origin='Item livre').
4. Não herda endereço/prazos/gestor; não cria contas a receber/contrato/centro de custo (continuam manuais); `projects` não guarda `proposalId`.
5. A obra nasce `'Planejamento'` e o `dashboardExecution` filtra `'Em andamento'` (api/index.php:5289) → o previsto some do dashboard até troca manual de status.

### Proposta (reusando o existente) — consertar a automação, não criar fluxo novo

1. **Se a proposta já tem `projectId` (ou orçamentos vinculados via `proposta_orcamento_vinculos`): REUSAR** — promover a obra existente (status, `revenueContracted`) e marcar os orçamentos vinculados como o "previsto", em vez de criar duplicata. Criar obra nova só quando realmente não existe.
2. Na cópia de itens: `unitCost = custo_unitario` (que já vem preenchido de `proposta_itens`) e carregar `bdi_item`, `sinapi_id`, `orcamento_item_id`, grupo→`stageName`/`etapa_id`.
3. Gravar o back-link (coluna `proposalId` na obra ou ao menos manter `eventos_automacao` + atualizar `commercial_proposals.projectId` sempre).
4. Opcional (decisão do dono): disparar `createReceivablesFromProposal` na aprovação (a função já existe) e herdar endereço quando a proposta/cliente tiver.
5. Rever o filtro do `dashboardExecution` (incluir 'Planejamento'/'Contratada' ou trocar o status inicial da obra criada).

### Tamanho: **M** (cirurgia numa função transacional existente + cópia de campos; sem tabela nova).

### Riscos/dependências

- A função é transacional e dispara em TODA aprovação — regressão aqui quebra o fluxo comercial inteiro. Testar com proposta com e sem projeto, re-aprovação, multi-grupos.
- Dados históricos: obras/orçamentos duplicados já criados em produção precisarão de limpeza manual (são identificáveis por `eventos_automacao` + notes "Criado automaticamente").
- Depende conceitualmente da FRENTE 3 (estrutura da proposta) — fazer as duas de forma coordenada.

---

## FRENTE 4b — Cotação de formação de preço (rápida, pré-obra)

**Desejado:** cotar rápido (m² de telha + pedreiro) para formar o preço da proposta. Problemas relatados: fornecedor texto livre; comparação com erro; pedido de compra aparecendo no fluxo; falta anexo PDF/Excel.

### Existe hoje

**Há DOIS módulos "Cotações" com o mesmo rótulo no menu:**

| | `quotes` (antigo) | `cotacoes` (novo — o que o dono usa) |
|---|---|---|
| Tabelas | `cotacoes` (schema.sql:1414–1436) | `cotacao_fornecedor` + `cotacao_itens` (schema.sql:1801–1837) |
| Menu | seção Orçamento de Obra (app.js:209) | seção Obras/Projetos (app.js:207) |
| Fornecedor | `supplierId` FK real | `fornecedor_nome` texto (FK `fornecedor_id` existe mas nunca preenchida) |
| Tela | CRUD genérico | `renderCotacoes()` dedicado (app.js:12834+): importar CSV/XLSX/PDF, comparar, exportar |
| Ponte p/ orçamento | **SIM** — botão "Adicionar" cria item do orçamento (`addBudgetItemFromSource('quotes')`, app.js:15168, origin "Cotação manual") | NÃO — beco: só compara/exporta |

**Os 4 problemas relatados — todos CONFIRMADOS no código:**

1. **Fornecedor texto livre:** o form de importação usa `<input>` com datalist só de NOMES (app.js:12945/12953) e envia apenas `fornecedor_nome` (app.js:12973). O backend até aceita `fornecedor_id` (api/index.php:3451) e a coluna existe — **a UI nunca o manda**.
2. **Erro da comparação:** `diferenca_percentual` é **`DECIMAL(8,2)` sem clamp** (schema.sql:1833; cálculo em api/index.php:3535–3538, só `round()`): um `unitPrice` ínfimo gera % em milhões → **SQLSTATE[22003] → 500 "Erro ao processar a cotação"**. É exatamente o overflow que o comparador IA já teve e corrigiu (migration `2026-06-28-ia-compara-difpercent.sql` + clamp `IA_COMPARA_DIFPERCENT_MAX` em api/index.php:68–69 e 10610–10611) — **a cotação não recebeu nenhuma das três proteções**. Problema conceitual adicional: compara o preço do fornecedor contra `orcamento_obra_itens.unitPrice` (**preço de venda COM BDI**, api/index.php:3518) por similaridade fuzzy ≥0.4 — para formação de preço o certo é `unitCost`; e sem orçamento da obra retorna "Nenhum item correspondente" (inútil pré-obra).
3. **Pedido de compra no fluxo:** o form de importação tem select "Pedido de compra (opcional)" (app.js:12952 → `purchase_order_id`, api/index.php:3450) e a tela de Pedidos tem botão "Importar cotação" (app.js:6944/6703–6709). Não existe o inverso (gerar pedido DA cotação).
4. **Anexo:** o arquivo importado É salvo no disco (`store_upload` → dir `cotacoes`, api/index.php:3436–3457) **mas não há endpoint de download nem link na tela** — fica órfão. Não há anexo avulso.

### Distância

Cada problema tem conserto pequeno e localizado; o que falta de maior é a ponte "cotação nova → orçamento/proposta" (formação de preço), que hoje só existe no módulo antigo.

### Proposta (reusando o existente)

1. **Fornecedor:** trocar o input por select/lookup de `db.suppliers` enviando `fornecedor_id` (coluna pronta; manter `fornecedor_nome` como fallback para fornecedor não cadastrado). **P**
2. **Comparação:** copiar o fix do comparador IA — alargar `diferenca_percentual` para `DECIMAL(12,2)` (migration + ajuste no `ensure_cotacao_import_tables`, api/index.php:2677–2723) + clamp + guarda de denominador; e comparar contra `unitCost` (sem BDI) em vez de `unitPrice`. **P**
3. **Pedido fora do fluxo:** remover o campo `#cotPedido` do form de importação (a coluna `purchase_order_id` fica para a FRENTE 5, quando o pedido nasce DEPOIS da comparação). **P**
4. **Anexo:** endpoint de download do `arquivo_original` + link na tela de detalhe, reusando o padrão de download seguro de `contrato-download`/`viabilidade_anexos`. Upload avulso opcional depois. **P**
5. **Formação de preço:** ponte cotação nova → orçamento, espelhando `addBudgetItemFromSource('quotes')` (app.js:15168): botão "Enviar item ao orçamento" na tela de detalhe da cotação, criando `orcamento_obra_itens` com origin "Cotação manual". Com isso a cotação rápida alimenta o orçamento → que já vira proposta pelo fluxo existente. **P/M**
6. **UX:** renomear os dois módulos no menu ("Cotações" 2× confunde) — ex.: "Cotações (importação)" vs "Cotações avulsas", ou consolidar no novo.

### Tamanho: **M** no conjunto (5 itens P/P-M independentes entre si).

### Riscos/dependências

- O fix do clamp (item 2) é pré-requisito do comparador de fornecedores da FRENTE 5 (mesma fundação).
- Consolidar `quotes` × `cotacoes` é decisão de produto — não apagar o antigo sem migrar a ponte para orçamento (é a única que existe hoje).

---

## FRENTE 5 — Orçamento de Obra = "Custo da Obra" + cotação de compra item a item

**Desejado:** pós-ganho, comparar item a item (orçado SINAPI × cotações de mercado) → comprar mais barato → pedido no fluxo certo (cotação → comparação → pedido) → aba COMPRAS com NFs vinculando à obra. Também: renomear para "Custo da Obra", repensar "Itens do orçamento", e o bug do envio IA→orçamento.

### (a) Pontes orçamento ↔ cotações ↔ pedidos — existe hoje

O ciclo tem **pontes parciais, mas não fecha**:

| Ponte | Estado |
|---|---|
| cotação item ↔ item do orçamento | **EXISTE**: `cotacao_itens.orcamento_item_id` populado pela comparação (api/index.php:3522/3538). A comparação item a item orçado×cotado **JÁ EXISTE** — por similaridade de descrição ≥0.4 contra `orcamento_obra_itens` da obra (api/index.php:3507–3551), porém contra `unitPrice` (com BDI) e sujeita ao overflow da Frente 4b |
| pedido item ↔ item do orçamento | **EXISTE**: `purchase_order_items.work_budget_item_id`, com select na grade do pedido (`setupPurchaseOrderForm`, app.js:14762/14831; saveBulk api/index.php:4988–5069) |
| cotação → pedido | **SÓ COLUNA**: `cotacao_fornecedor.purchase_order_id` existe, mas nenhum fluxo gera pedido a partir da cotação vencedora |
| pedido → financeiro | **EXISTE E FUNCIONA**: pedido Aprovado auto-cria conta a pagar (`automate_approved_purchase_order`, api/index.php:12602–12671, idempotente); pedido Recebido soma `quantidade_realizada` nos itens do orçamento (api/index.php:5186–5214) — **a execução física já é alimentada pelas compras** |

### (b) NF vinculando à obra — existe hoje

`fiscal_documents` **já tem `projectId`** (FK, schema.sql:751), `supplierId`, `payableId`/`receivableId`, status, pdf/xml. O **import NFS-e em lote já automatiza**: cria a NF E a conta a pagar/receber com back-link (api/index.php:7540–7616). O lançamento **manual** é CRUD genérico sem automação (o usuário vincula tudo à mão), e **não existe vínculo NF↔pedido de compra** (nenhuma coluna). Não existe módulo/aba "Compras" — só "Pedidos de compra" e "Notas fiscais" separados.

### (c) Bug do envio IA→orçamento — CAUSA CONFIRMADA no código

`handle_ia_enviar_para_orcamento` (api/index.php:10854–11144). Duas negligências somadas:

1. **No upload** (deparaUpload api/index.php:9764–9767; comparaUpload 10457–10460), a única condição para uma linha da planilha virar item é **ter texto na coluna descrição**. Títulos de seção e subtotais ("QUADROS ELÉTRICOS", "1.1 INSTALAÇÕES") passam e são gravados com `valorUnitOrigem=null`, `quantidade=null`, `unidade=null`.
2. **No envio** (api/index.php:10900–10904), o SELECT pega **todas** as linhas do lote (só filtra `aceito=1` se "apenas aceitos") — sem filtro por `statusClassificacao` nem por "tem valor". Os defaults completam o estrago: `qtd=1` (11013–11014) e `unitCost = null→0.0` (11018–11020) → cada cabeçalho da planilha vira um item do orçamento com **quantidade 1 e custo 0**.

Isso reproduz exatamente o sintoma relatado ("puxa a descrição mas puxa até mais do que isso" + unitCost=0 nos orçamentos 6 e 7 do projeto 9). **Não foi possível conferir os dados reais localmente** (sem MySQL local — banco só no servidor); validação sugerida lá: `SELECT description, quantity, unitCost FROM orcamento_obra_itens WHERE workBudgetId IN (6,7) AND (unitCost = 0 OR unitCost IS NULL);` — a expectativa é que as linhas zeradas sejam títulos/subtotais da planilha.

**Fix proposto (duplo cinto):** no upload, pular linha que não tenha NENHUM dado além da descrição (sem qtd E sem unidade E sem qualquer valor — heurística de seção); e no envio, descartar (ou ao menos avisar) itens sem valor unitário. **P/M**

### (d) Módulo `workBudgetItems` ("Itens do orçamento") — redundante

Não tem render próprio (cai no CRUD genérico; config app.js:725–751). A tela principal do orçamento (`renderWorkBudgets`, app.js:10516) **já edita os mesmos itens inline usando o MESMO config** via `data-action-key="workBudgetItems"` (app.js:9997/10171–10172, pré-preenchendo o orçamento em app.js:7130–7131). O item de menu standalone só mostra a lista solta de todos os itens de todos os orçamentos, sem contexto. **Proposta:** tirar do menu, **mantendo o config** (o inline depende dele). **P**

### (e) Renomear para "Custo da Obra"

Rename só de apresentação (manter a chave técnica `workBudgets` — evita tocar roteamento/permissões/resource_map/~60 usos internos): rótulos em app.js:103–104, seção app.js:209, títulos app.js:704–705/725–726, botões "Enviar para Orçamento de Obra"/"Abrir em Orçamentos de Obras" (app.js:5468, 5827, 6018, 6064, 6068) e textos default do backend (api/index.php:10939/10979). **P** (~10 strings).

### Proposta (reusando o existente) — fechar o ciclo cotação → comparação → pedido → NF

1. **Fundação:** fix do overflow + comparar contra `unitCost` (vem da Frente 4b) e fix do envio IA (item c) — sem isso, o "orçado" e a comparação não são confiáveis.
2. **Comparador de fornecedores** (o mapa de módulos já o previa): matriz item×fornecedor sobre `cotacao_itens` agrupadas por `obra_id`, usando o `orcamento_item_id` já gravado pela comparação + marcação manual de correspondência. Menor preço por item vs `unitCost` orçado = a comparação "disjuntor orçado × disjuntor cotado" que o dono quer.
3. **Cotação → pedido:** botão "Gerar pedido de compra" na comparação/cotação vencedora → cria `purchase_orders` + `purchase_order_items` **com `work_budget_item_id`** (grade e saveBulk já existem) e grava `cotacao_fornecedor.purchase_order_id` (coluna pronta). A partir daí o fluxo existente assume: aprovação → conta a pagar automática; recebimento → quantidade_realizada.
4. **Aba "Compras" da obra:** (i) coluna nova `purchaseOrderId` em `fiscal_documents` (migration + ensure); (ii) automação no create manual de NF espelhando o que o import NFS-e já faz (gerar/conciliar conta a pagar quando tem projectId); (iii) uma view agregadora por obra: pedido → NF → conta a pagar (os três já têm `projectId`). Pode nascer como aba dentro da tela da obra ou módulo "Compras" na seção Obras.
5. Renomear "Custo da Obra" (e) + tirar `workBudgetItems` do menu (d) na mesma leva, já que tocam os mesmos rótulos/menu.

### Tamanho: **G** no conjunto — mas fatiável: (c) fix IA = P/M; (d)+(e) = P; comparador de fornecedores = M; cotação→pedido = M; aba Compras = M.

### Riscos/dependências

- Depende da Frente 4b (clamp/unitCost) — mesma fundação de comparação.
- O "previsto" precisa estar limpo (fix do item c) antes de comparar item a item; os orçamentos 6/7 do projeto 9 precisarão de limpeza/re-upload no servidor (lotes antigos não se auto-corrigem — mesmo padrão da pendência do 9393).
- Automação de NF→conta a pagar deve respeitar o anti-dupla-contagem existente (pedido aprovado JÁ cria conta a pagar — NF do mesmo pedido deve conciliar com a conta existente via `referencia_tipo`, não criar outra).
- Consolidação `quotes`×`cotacoes` (Frente 4b) deve vir antes ou junto, para o ciclo ter UMA porta de entrada.

---

## Ordem de implementação sugerida

A lógica: primeiro os consertos pequenos e independentes (confiança + visual), depois limpar a base do "previsto" (que alimenta tudo), depois o comercial, e por último o ciclo de compras (o maior, que depende das fundações).

| # | Frente | Tamanho | Por quê nesta posição |
|---|---|---|---|
| 1 | **F1 — cores do dashboard** | P | Independente, ganho visível imediato, zero risco. |
| 2 | **F2 — plano de contas (seed ou orientação)** | P | Independente; decide-se junto se o vínculo terá uso futuro. |
| 3 | **F5c — fix do envio IA→orçamento** | P/M | O "previsto" é a base de TODAS as comparações (4a, 5); hoje entra sujo (itens fantasma custo 0). Alinha com a pendência nº1 do mapa (eixo central ~90%). Inclui limpeza dos orçamentos 6/7 no servidor. |
| 4 | **F4b — cotação rápida** (fornecedor FK, clamp+unitCost, tirar pedido do form, download do anexo, ponte p/ orçamento) | M | Itens pequenos e independentes; o clamp e o "comparar contra unitCost" são a fundação do comparador de fornecedores (F5). Habilita a formação de preço pré-obra. |
| 5 | **F4a — aprovação sem duplicar + custo real** | M | Conserta a automação existente (obra duplicada é o defeito mais destrutivo hoje); com o previsto limpo (passo 3), o previsto vs realizado passa a fazer sentido. |
| 6 | **F3 — proposta multi-disciplina** (descrição por grupo + documento em seções + contrato) | M | Coordenar com F4a (mesmo fluxo proposta→obra); estende o que já está ~80% pronto. Pode inverter com o passo 5 se a prioridade comercial for maior — mas quem aprova proposta hoje está criando obras duplicadas, por isso 4a primeiro. |
| 7 | **F5 — ciclo de compras completo** (comparador de fornecedores → pedido → aba Compras/NF) + rename "Custo da Obra" + tirar workBudgetItems do menu | G | O maior bloco; depende dos passos 3–5 (previsto limpo, comparação sem overflow, contra custo). Fecha o ciclo do mapa de módulos ("pontas soltas"). |

Dependências em resumo: **3 → 5 → 7** (previsto limpo → previsto correto na aprovação → comparação de compras) e **4 → 7** (clamp/unitCost → comparador de fornecedores). 1, 2 e 6 são paralelizáveis.
