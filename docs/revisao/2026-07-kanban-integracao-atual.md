# Diagnóstico: integração atual do Kanban com os módulos de negócio

> **Data:** 2026-07-29 · **Base:** v1.39.0 — `api/index.php` (14.605 linhas), `app.js` (19.927),
> `schema.sql` (2.350), `migrations/` (60), `docs/`.
> **Objetivo:** avaliar a distância entre o Kanban de hoje e um modelo de **três quadros por obra**
> (Execução, Suprimentos, Documentação) em que a coluna do cartão de Suprimentos seria **derivada**
> do estado real dos registros (cotação → pedido → NF), não um status próprio.
> **Método:** leitura de código em quatro frentes paralelas, com verificação cruzada.
> **Nada foi alterado — este documento é só diagnóstico.**
>
> Revalida e estende `2026-07-27-varredura-cotacoes-obras.md`, cujas conclusões continuam válidas.

---

## Decisões tomadas (2026-07-29, pelo dono, após este diagnóstico)

O diagnóstico foi aceito integralmente, incluindo o contraponto. As decisões:

1. **Suprimentos NÃO será Kanban.** Quando chegar a hora, será uma **lista filtrável** com estado e
   coluna de prazo. Motivo aceito: um quadro que não aceita arrastar mente sobre o que oferece.
2. **NÃO haverá Kanban de Execução.** O cronograma (`obra_cronograma_etapas`) já é o quadro de
   status e carrega o gate FVS do PBQP-H; duplicar contornaria o controle de qualidade.
3. **Documentação vira módulo próprio**, no molde do RH F1 — não quadro. **Fica na fila**, não agora.
4. Os furos de integridade do ciclo de compras passam a ser **pendência própria, independente do
   Kanban** — registrados na §6 abaixo, criada para isso.
5. **Nada disso entra agora.** Prioridade atual: validações pendentes no servidor e a **Onda B**.

Em consequência, as seções 2, 3 e 4 deste documento deixam de ser "avaliação de proposta" e passam
a valer como **levantamento do estado atual** desses módulos, para quando cada frente for retomada.

---

## Resposta curta

**A pergunta central — "dá para derivar a coluna do quadro de Suprimentos?" — tem resposta NÃO com
os dados de hoje.** As consultas *executam*, mas não formam uma classificação confiável: existem
dois fluxos de compra paralelos que nunca se cruzam, e um deles é **estruturalmente invisível** a
partir do item de orçamento. Um item pode estar comprado, faturado e pago, e a consulta responder
"sem cotação aberta" com confiança total. Detalhe na §2.

O paradoxo do projeto é que **o quadro que parece mais atraente é o que está mais longe**, e o que
parece mais modesto (Documentação) é o mais barato — porque ali quase nada existe, então não há o
que duplicar nem contradizer.

---

## 1. O que já liga o Kanban ao negócio

### O que existe hoje

**`referencia_tipo` / `referencia_id` — só um valor, e é write-only.** O único valor gravado em
`kanban_cards.referencia_tipo` é `'PEDIDO_COMPRA'` (`api/index.php:14209`, `:14300`;
`app.js:9224` no modo local). Os demais `referencia_tipo` do sistema (`CONTA_PAGAR`,
`COTACAO_MATERIAL`, `MARCO`, `RH_MEDICAO`) pertencem a **outras tabelas**, não ao Kanban.

Quem escreve: `create_purchase_order_kanban_card()` (`api/index.php:14280-14304`), chamada na
**criação** do pedido (`api/index.php:650-655`) e de novo na aprovação (`:14221`, no-op por
idempotência). Quem lê para **decidir** alguma coisa: **ninguém**. `kanban_card_is_done()` lê
`coluna_id`, não a referência; `app.js:10186` usa `card.referencia_tipo` apenas para decidir se
exibe um `confirm()`. Não há nenhum JOIN ou SELECT que parta do cartão para consultar o pedido.

**A automação copia e esquece.** O cartão recebe `titulo`, `descricao`, `data_vencimento`,
`obra_id`, `prioridade` fixa `'media'` (`api/index.php:14280-14304`); **não** copia responsável nem
valor (a tabela não tem campo de valor, `schema.sql:320-339`). Cai sempre na coluna de menor
`ordem` do board de compras (`first_kanban_column_id`, `api/index.php:14306-14312`) — na prática
"A fazer". É idempotente por `find_by_reference` (`:14287`).

**Não há sincronização de volta.** Busca por tratamento de cancelamento de pedido que toque
`kanban_cards`: nenhum resultado. Pedido cancelado ou alterado deixa o cartão **órfão e
desatualizado**, com título e prazo antigos e sem qualquer sinalização.

**"Mover para Concluído" é cosmético.** `api/index.php:909-911` calcula um campo
`completionPrompt` na resposta — e **nada no `app.js` lê esse campo**; é código morto. No front,
`moveKanbanCard` (`app.js:10180-10190`) mostra um `confirm()` e, se aceito, um `alert()` dizendo
que a atualização "deve ser confirmada no módulo de origem". **Nenhuma requisição é disparada,
nenhum registro muda.**

**Boards só nascem com a obra.** `ensure_project_kanban_boards` (`api/index.php:14226-14234`) cria
2 boards (`obra` e `compras`) com 4 colunas fixas (A fazer 10, Em andamento 20, Aguardando
aprovação 30, Concluído 40 — `:14259-14278`). É chamada em **apenas dois pontos**, ambos na criação
da obra (`:645` e `:775`), dentro de `try/catch` que só loga. **Obras criadas antes disso, ou cuja
criação de board falhou, ficam permanentemente sem quadro** — não há backfill, cron nem caminho
client-side (`ensureLocalDefaultKanban` tem `if (serverMode) return`, `app.js:9193`).

**Dashboard consome:** `prioridade`, `data_vencimento`, `titulo`, `obra_id` e `coluna_id`
(indiretamente, via `kanbanCardDone`) — `app.js:5126-5170`.

**Permissão** unificada na chave `'kanban'` (`api/index.php:9316`, `app.js:2567`). Sem acesso:
`equipe_campo`, `cliente_obra`, `fornecedor_terceiro`, `consulta`.

### Distância até o modelo desejado

Média. A tabela **já tem** o par `referencia_tipo`/`referencia_id` que o modelo derivado exige — só
nunca foi usado para ler. O que falta não é estrutura de dados, é **fluxo de volta**: hoje a
integração é de mão única (negócio → cartão), e o modelo proposto exige mão dupla.

### O que dá para reusar

O par referência já existente e sua idempotência (`find_by_reference`); a resolução de "concluído"
por nome de coluna (`kanban_card_is_done`), que já prova que o quadro sabe reagir a estado sem
campo próprio no cartão; e o esquema de permissão, que não precisa mudar.

### O que falta criar

Um backfill de boards para obras antigas (hoje elas simplesmente não têm quadro); sincronização de
cartão quando o pedido muda ou é cancelado; e o consumo real da referência — hoje `completionPrompt`
é gerado e descartado.

### Tamanho: **P** (backfill e limpeza) · **M** (sincronização de volta)

### Riscos

O maior é silencioso: **obras sem board não aparecem no seletor**, e o usuário não tem como criar
cartão para elas a não ser montando um board na mão pelo CRUD genérico. Isso já é um defeito hoje,
independente do redesenho.

---

## 2. Suprimentos — a coluna é derivável? **Não.**

### O que existe hoje

O encadeamento real, com os campos que ligam cada elo:

| Transição | Campo de ligação | FK real? | Status |
|---|---|---|---|
| item de orçamento → cotação | `cotacao_itens.orcamento_item_id` → `orcamento_obra_itens.id` (`schema.sql:1849`) | **Não** — só índice (`:1856`) | `vencedor TINYINT` (`:1852`); `status_comparacao` é sobre **preço**, não ciclo |
| cotação → pedido | `purchase_order_items.work_budget_item_id` → `orcamento_obra_itens.id` (`schema.sql:1805`) | **Não** | `purchase_orders.status VARCHAR` — `Solicitado`/`Aprovado`/`Recebido` |
| pedido → NF | `fiscal_documents.purchaseOrderId` (`schema.sql:763`) | **Não**, e sem índice dedicado | `status ENUM('Pendente','Anexada','Conferida','Cancelada')` |

Note que o pedido **não aponta para a cotação** — ele re-deriva o vínculo a partir do item do
orçamento (`api/index.php:4164`), "pulando" o registro da cotação.

### Por que a derivação não fecha — quatro motivos independentes

**(1) O Fluxo B1 é invisível.** Existem dois motores de compra que nunca se cruzam, provados pelos
dois `referencia_tipo` distintos que geram contas a pagar:
- **B1 "Cotações por material"** — `materialsalvar` (`api/index.php:4349-4410`) grava `cotacoes`
  **sem nunca preencher** `orcamento_item_id` nem `workBudgetId`; gera conta com
  `referencia_tipo='COTACAO_MATERIAL'` (`:4699`); a NF é anexada só por `payableId`, sem pedido.
- **B2 "Custo da Obra → cotação de compra → pedido"** — o encadeamento da tabela acima; gera conta
  com `referencia_tipo='PEDIDO_COMPRA'` (`:14209`).

Como qualquer consulta de estado precisa partir de `orcamento_obra_itens`, e B1 não tem vínculo
nenhum com essa tabela, **um material comprado, faturado e pago inteiramente por B1 aparece como
"(a) sem cotação aberta"**. Não é ambiguidade entre dois estados — é a consulta devolver o estado
errado com confiança total, que é pior.

**(2) Falta rodada/versão.** `cotacao_itens` não tem campo que distinga decisão vigente de decisão
histórica. Uma segunda cotação do mesmo item convive com a primeira sem sinalização, e o
`HAVING SUM(vencedor)=0` do estado (b) deixa de valer.

**(3) `compraGerarPedido` não é idempotente.** O SELECT de vencedores (`api/index.php:4111-4116`)
**não exclui** os que já viraram pedido, e não há `UNIQUE(work_budget_item_id)`. Clicar duas vezes
em "Gerar pedido" cria dois pedidos para o mesmo item. Se um tiver NF e o outro não, **a mesma
linha satisfaz (d) e (e) ao mesmo tempo** — dentro do próprio B2, sem nem envolver B1.

**(4) NF é por pedido inteiro.** Não existe vínculo NF↔item. `automate_received_purchase_order`
(`api/index.php:6488-6516`) soma **todos** os itens do pedido de uma vez, e `comprasregistrar` marca
o pedido inteiro como recebido (`:4234`) mesmo com NF parcial. O estado (e) **sempre superestima**.

### O que falta criar (lista exata)

1. Vínculo entre o Fluxo B1 e `orcamento_obra_itens` — **não existe coluna candidata**;
   `cotacoes.workBudgetId` existe no schema (`schema.sql:1434`) mas nunca é preenchido.
2. Campo de rodada/vigência em `cotacao_itens`.
3. Idempotência real em `compraGerarPedido` + trava de unicidade item↔pedido ativo.
4. Tabela de vínculo NF↔item (`fiscal_document_items` com quantidade faturada).

### Data-limite do material: **não existe**

Nenhuma das tabelas tem "quando o material precisa estar no canteiro".
`cotacao_itens.prazo_entrega` é `VARCHAR(100)` — texto livre tipo "15 dias", não consultável.
`purchase_orders.expectedDate` existe, mas é por pedido e só nasce **depois** da decisão de compra —
tarde demais para orientar quando abrir a cotação.

**Onde caberia:** uma coluna `DATE` em **`orcamento_obra_itens`**, único registro que representa um
item real e único da obra com quantidade, e que hoje não tem data nenhuma. Ele já tem `etapa_id`
(`schema.sql:1403`), o que permitiria cruzar com `obra_cronograma_etapas.plannedStartDate` para
calcular antecedência sem duplicar dado.

### Distância: **grande.** · Tamanho: **G** · Riscos

Construir o quadro derivado sobre esta fundação produziria um painel **confiante e errado** — o
pior tipo de erro num sistema de gestão, porque não se apresenta como falha.

---

## 3. Execução — o que já existe é mais do que parece

### O que existe hoje

**`obra_cronograma_etapas` já é um quadro de status** (`schema.sql:186-220`): `status` ENUM com
seis valores (Não iniciada/Em andamento/Concluída/Atrasada/Pausada/Cancelada), datas planejadas ×
reais, percentual físico e financeiro, responsável, predecessoras — e o **gate PBQP-H**.

**O gate de qualidade é real e está no cronograma.** `qualidade_bloqueio_etapa()`
(`api/index.php:7058-7091`) impede concluir etapa que tenha `servicoSiacId` sem FVS aprovada; é
aplicado no `PUT/PATCH` de `projectSchedule` (`api/index.php:669-679`), devolvendo 422. A FVS liga
a **etapa do cronograma** (`qualidade_fvs.etapaId`, `schema.sql:1918`), **não** a item de orçamento.

**A execução por item já é gravada e auditada.** `orcamento_obra_itens.quantidade_realizada` é
alimentada por dois caminhos — manual, pela aba Execução (`api/index.php:6535-6555`), e automático,
no recebimento de pedido (`:6488-6516`) — ambos gravando em `orcamento_item_execucao_log`
(`schema.sql:1772-1782`) com origem, motivo e usuário.

**O RDO é outra coisa.** `obra_rdo` é um registro **por obra+dia** (`schema.sql:2173-2198`) com
clima, efetivo, equipamentos, ocorrências e cadeia de assinatura por disciplina — um documento
formal diário. O serviço executado é **texto livre** no campo `atividades`, sem quantidade e sem
vínculo com item de orçamento.

**O que falta em toda parte:** `orcamento_obra_itens` **não tem disciplina nem responsável**, e
`orcamento_etapas` não tem status nenhum.

### Distância e o risco de duplicação

Depende inteiramente do **grão**:

- **Grão de etapa → duplicação direta.** Duplicaria `obra_cronograma_etapas.status` e, pior,
  **contornaria o gate PBQP-H** se não reimplementasse `qualidade_bloqueio_etapa()`. Um cartão
  arrastado para "Concluído" fecharia um serviço que o cronograma recusaria fechar sem FVS
  aprovada. Isso é regressão de controle de qualidade, não inconveniência.
- **Grão de item → lacuna real.** Item de orçamento **não tem status formal** hoje, só o progresso
  numérico. Um cartão nesse grão que, ao ser concluído, chamasse o endpoint já existente
  (`?module=workBudgetExecution&action=update`) seria **um front alternativo para a mesma
  gravação** — aproveitando o log que já existe, sem criar terceiro registro de estado.

### O que dá para reusar

O endpoint de execução e seu log; o gate PBQP-H (se o quadro operar em etapa, tem de chamá-lo).

### Tamanho: **M** (grão de item) · **G** (grão de etapa, por causa do gate) · Riscos

Duas fontes de verdade sobre "o serviço está pronto" divergindo entre si. E, se o Kanban virar o
caminho preferido dos usuários, o RDO — que é **documento legal** — passa a ser preenchido por
obrigação e não por uso, degradando o registro que tem valor jurídico.

---

## 4. Documentação — quase tudo falta, e é por isso que é o mais barato

### O que existe hoje

| Documento | Registro canônico? |
|---|---|
| ART / RRT | **Não existe.** Só texto em item de checklist de viabilidade (`api/index.php:5395`, `:5419`) |
| Licenças e alvarás | **Não existe.** Idem (`:5397`, `:5418`, `:5429`) |
| Aprovação de concessionária | **Não existe.** Grupo de checklist com `terceiro_nome='ENERGISA'` (`:5382-5387`) |
| Medições | **Não existe** formalmente. `tipos_medicao` é catálogo **órfão** |
| Aditivos contratuais | **Não existe.** Só cláusula de texto no PDF (`app.js:7449`) |
| Laudos / relatórios | **`technical_reports`** (`schema.sql:366-380`) — mas **sem campo de arquivo** e sem validade |

**Três catálogos prontos e nunca ligados a nada:** `tipos_documento` (`schema.sql:1465`),
`tipos_medicao` (`:1501`) e `modelos_relatorio` (`:1450`). Existe até o widget de formulário
`documentType` (`app.js:7811`), mas **nenhum registro do sistema tem um campo `documentTypeId`**.
São peças de encaixe já fabricadas, esperando a tabela que nunca foi criada.

**O padrão de validade do RH é diretamente copiável:** `rh_tipos_documento` (tipo com
`dias_alerta` configurável) + `rh_documentos` (número, emissão, validade, arquivo) + situação
calculada em runtime por `rhDocSituacao` (`app.js:16177-16185`). Trocar `rh_colaboradores` por
`projects` daria `obra_tipos_documento` + `obra_documentos` quase sem adaptação.

### Distância: **pequena em conceito, média em execução**

Não há o que integrar nem contradizer — não existe registro concorrente para nenhum desses
documentos. É construção nova sobre um padrão já validado no próprio sistema.

### O que falta criar

As duas tabelas no molde do RH, o CRUD, o upload autenticado (molde `rh-doc-*`) e o alerta de
vencimento. **E ligar os três catálogos órfãos**, que é o ganho colateral.

### Tamanho: **M** · Riscos

Baixos. O maior é de escopo: "documentação da obra" pode inchar indefinidamente se não for fechada
uma lista inicial de tipos.

---

## 5. Padrões e riscos

### Já existe estado derivado no sistema? Sim — quatro padrões distintos

1. **Runtime puro, sem gravação** — `rhDocSituacao` (`app.js:16177`), `qFvmValidadeAlerta`
   (`app.js:13101`). Simples, nunca desatualiza, mas invisível a SQL/export.
2. **Híbrido documentado** — `isOverdue` (`app.js:4180`) + `mark_overdue_accounts`
   (`api/cron/jobs.php:54-67`). **É o precedente direto do modelo proposto.** O comentário no
   código explica o porquê: o cálculo runtime é a fonte de verdade na tela, e o job persiste uma
   cópia para quem **não passa pelo JS** — relatórios, exports e filtros SQL. A prova de que isso é
   necessário está no histórico: o relatório de inadimplência lia `status === 'Vencido'` literal e
   dava sempre zero, corrigido na v1.32.1.
3. **Gravado no evento** — `status_comparacao` (`api/index.php:3941`),
   `viabilidade_recalcular_progresso` (`:5558`). Snapshot no momento da ação; não se atualiza
   sozinho depois.
4. **`kanban_card_is_done`** (`api/index.php:14393`) — deriva "concluído" **do nome da coluna**.
   É o inverso do que se quer: aqui a coluna é a causa e o estado é a consequência. O modelo
   proposto quer a coluna como consequência. O mecanismo de resolver por nome serve de ponto de
   partida, mas a agregação do estado real dos registros **não existe e teria de ser construída**.

### Cartões livres e derivados no mesmo quadro

Conviveriam mal. Um cartão derivado não pode ser **arrastado** (a coluna é consequência, não
causa), não pode ser **excluído** sem que o registro de origem desapareça, e sua **ordenação** não
tem significado — `ordem` é gravada e o cartão derivado não teria uma. Hoje o quadro trata todos os
cartões igual: `moveKanbanCard` grava `coluna_id` direto (`app.js:10185`), `removeRecord` apaga sem
perguntar de onde veio. Misturar os dois exigiria que **cada ação da UI verificasse a natureza do
cartão** — e é exatamente esse tipo de bifurcação que produziu o bug do card no board errado.

### O que se perde ao tirar o arrastar de Suprimentos

Menos do que parece: o arrastar **hoje não faz nada** além de mudar a coluna. Não atualiza pedido,
não muda status, não dispara nada (§1). Trocá-lo por uma coluna derivada não retira comportamento
real — retira a **ilusão** de que arrastar significa alguma coisa. O que se perde de fato é o uso
como rascunho pessoal ("vou deixar isso em 'Em andamento' porque estou cuidando"), que o modelo
derivado não acomoda.

### Volume

`kanbanCards` está no `resource_map` (`api/index.php:1879`) e o bootstrap **carrega todos os
recursos sem paginação** — o comentário em `list_records` (`:1993-1999`) diz que GETs sem limite
"continuam devolvendo tudo por compatibilidade". Hoje isso é inofensivo (poucos cartões manuais).
Com **um cartão por item de material**, cada login passaria a baixar os cartões de **todas as obras**.

Não encontrei no repositório evidência do número de itens por obra (não há seed de
`orcamento_obra_itens` nem citação em docs) — então não afirmo ordem de grandeza. O que é **fato
verificado** é a ausência de paginação: se a obra tiver centenas de itens e houver dezenas de obras,
o bootstrap cresce proporcionalmente, sem teto.

---

## 6. PENDÊNCIA PRÓPRIA — integridade do ciclo de compras

> Registrada como frente **independente do Kanban** por decisão de 2026-07-29. Estes furos existem
> hoje, em produção, e **afetam o previsto × realizado da obra** — não são pré-requisito de uma
> feature futura, são defeitos de integridade do fluxo que já roda.

### 6.1 Dois fluxos financeiros paralelos que não se enxergam

O mesmo material pode ser comprado por dois caminhos que geram contas a pagar por
`referencia_tipo` diferentes e **nunca se cruzam**:

| | Fluxo B1 — "Cotações por material" | Fluxo B2 — "Custo da Obra → pedido" |
|---|---|---|
| Onde nasce | `materialsalvar` (`api/index.php:4349-4410`) | `compraregistrar` (`api/index.php:4025-4091`) |
| Liga ao item de orçamento? | **Não** — nunca grava `orcamento_item_id` nem `workBudgetId` | Sim, via `cotacao_itens.orcamento_item_id` |
| Conta a pagar | `referencia_tipo='COTACAO_MATERIAL'` (`:4699`) | `referencia_tipo='PEDIDO_COMPRA'` (`:14209`) |
| Gera pedido de compra? | Não | Sim |
| Alimenta `quantidade_realizada`? | **Não** | Sim, no recebimento |

**Consequência direta no previsto × realizado:** todo material comprado pelo B1 é invisível para o
painel de execução. O custo sai do caixa (a conta a pagar existe e é paga), mas o **realizado da
obra não se move** — porque só `automate_received_purchase_order` alimenta `quantidade_realizada`, e
o B1 não passa por pedido. Quanto mais a empresa usar o fluxo B1, mais o previsto × realizado
subestima o executado.

**Falta:** um vínculo entre `cotacoes` (com `categoriaId IS NOT NULL`) e `orcamento_obra_itens`.
A coluna `cotacoes.workBudgetId` existe no schema (`schema.sql:1434`) e **nunca é preenchida** —
é a candidata natural.

### 6.2 Não-idempotência do "Gerar pedido de compra" — dupla contagem no realizado

`compraGerarPedido` (`api/index.php:4098-4183`) seleciona os vencedores (`:4111-4116`) **sem excluir
os que já viraram pedido**, e não existe `UNIQUE(work_budget_item_id)` nem verificação de
pré-existência. Clicar duas vezes gera **dois pedidos apontando para o mesmo item de orçamento**.

**Aqui está o impacto mais grave no previsto × realizado.** A soma do recebimento é acumulativa:

```php
UPDATE orcamento_obra_itens SET quantidade_realizada = COALESCE(quantidade_realizada,0) + ? WHERE id = ?
```
(`api/index.php:6501`)

**Justiça com o código existente:** há sim proteção contra reprocessar o **mesmo** pedido — a
chamada por REST exige transição de status (`status_changed_to(..., ['Recebido'])`,
`api/index.php:2169`) e o caminho da aba Compras tem guarda explícita
(`if ($statusAtual !== 'Recebido')`, `:4234`, com comentário "não repete se já Recebido"). O furo
**não** é reprocessar o mesmo pedido.

O furo é que **a guarda é por pedido, não por item**. Dois pedidos distintos apontando para o mesmo
`orcamento_obra_itens.id` são, para essa guarda, dois eventos legítimos — e cada recebimento soma.
O item termina com **o dobro** da quantidade realizada, e o dashboard de execução
(`handle_dashboard_execution_module`, `api/index.php:6571-6639`) acusa **estouro falso**.

Um segundo caminho leva ao mesmo lugar: voltar o status de "Recebido" para outro e avançar de novo
dispara `status_changed_to` outra vez, somando de novo — a guarda é sobre a *transição*, não sobre
o fato já ter ocorrido.

**Falta:** verificação de pré-existência em `compraGerarPedido` (anti-join contra
`purchase_order_items` já criados) e/ou trava de unicidade item↔pedido ativo; e, para o
recebimento, registrar o que já foi somado por item em vez de confiar no status do pedido.

### 6.3 Falta de rodada/vigência na cotação

`cotacao_itens` não tem campo que separe decisão vigente de decisão histórica. Uma segunda cotação
do mesmo item convive com a primeira sem sinalização; `vencedor` não tem `UNIQUE`
(`migrations/2026-07-06-cotacao-compra-vencedor.sql:8`) e nada impede dois vencedores para o mesmo
item. Além disso, `compraregistrar` reaproveita o cabeçalho `cotacao_fornecedor` mais recente por
fornecedor+obra (`api/index.php:4052`, `ORDER BY id DESC LIMIT 1`) e um novo pedido **sobrescreve o
`purchase_order_id` do cabeçalho inteiro** (`:4170`), inclusive de propostas de rodadas antigas —
por isso `cotacao_fornecedor.purchase_order_id` não é confiável como sinal por item.

**Falta:** campo de rodada/vigência em `cotacao_itens` (ou `supersededAt`).

### 6.4 Nota fiscal sem granularidade de item

`fiscal_documents.purchaseOrderId` (`schema.sql:763`) aponta para o **pedido inteiro**; não existe
vínculo NF↔item. `comprasregistrar` marca o pedido todo como Recebido (`:4234`) e
`automate_received_purchase_order` soma **todos** os itens de uma vez (`:6496-6513`), mesmo que a NF
cubra parte. **Recebimento parcial não é representável** — ou o item conta inteiro, ou não conta.

**Falta:** tabela de vínculo NF↔item (`fiscal_document_items` com `purchase_order_item_id` e
quantidade faturada).

### 6.5 Como verificar se já aconteceu em produção

Consultas **somente leitura**, para medir o estrago antes de decidir a correção:

```sql
-- (1) Itens de orçamento com MAIS DE UM pedido apontando para eles (dupla contagem provável)
SELECT poi.work_budget_item_id, COUNT(DISTINCT poi.purchase_order_id) AS pedidos,
       GROUP_CONCAT(DISTINCT poi.purchase_order_id) AS quais
  FROM purchase_order_items poi
 WHERE poi.work_budget_item_id IS NOT NULL
 GROUP BY poi.work_budget_item_id
HAVING pedidos > 1;

-- (2) Itens cujo realizado passou do previsto (sintoma de dupla contagem)
SELECT id, description, quantity AS previsto, quantidade_realizada AS realizado
  FROM orcamento_obra_itens
 WHERE quantidade_realizada > quantity AND quantity > 0;

-- (3) Quanto do gasto da obra veio pelo fluxo B1 (invisível ao realizado)
SELECT referencia_tipo, COUNT(*) AS contas, SUM(amount) AS total
  FROM accounts_payable
 WHERE referencia_tipo IN ('COTACAO_MATERIAL','PEDIDO_COMPRA')
 GROUP BY referencia_tipo;

-- (4) Itens com mais de um vencedor na mesma cotação
SELECT orcamento_item_id, COUNT(*) AS vencedores
  FROM cotacao_itens
 WHERE vencedor = 1 AND orcamento_item_id IS NOT NULL
 GROUP BY orcamento_item_id
HAVING vencedores > 1;
```

A consulta (3) é a mais reveladora: mostra qual fatia do dinheiro da obra passa por um caminho que
o painel de execução não enxerga.

### Ordem sugerida para esta frente (quando for retomada)

Do mais barato e mais urgente para o mais estrutural: **6.2** (idempotência — é o que corrompe dado
hoje, e a correção é local), depois **6.1** (vínculo do B1, que destrava o previsto × realizado
real), depois **6.3** e **6.4**, que são mudanças de modelo e pedem ciclo próprio.

---

## Recomendação

### O que fazer, e em que ordem

**Primeiro, o que não depende de decisão nenhuma:** o backfill de boards para obras antigas
(hoje elas não aparecem no seletor) e a remoção do `completionPrompt` morto e do `confirm()` que
promete uma atualização que não acontece. **Tamanho P**, e corrige defeito real independente do
redesenho.

**Segundo, se a decisão for seguir com os três quadros — comece pela Documentação.** É o inverso da
intuição, e a razão é justamente que **lá não existe nada**: sem registro concorrente, não há
duplicação possível nem contradição com módulo existente, o padrão do RH é copiável quase
literalmente, e o ganho colateral é ligar três catálogos que estão prontos e órfãos. É a fatia que
entrega valor sem depender de consertar nada antes.

**Terceiro, Suprimentos — mas a fundação primeiro.** Antes de qualquer quadro derivado, é preciso
resolver os quatro itens da §2 (vínculo do B1 com o orçamento, rodada em cotação, idempotência do
pedido, NF por item). Esse trabalho **tem valor por si só**, independente de Kanban — é a mesma
dívida que a varredura de 27/07 já apontou. Só depois disso a projeção derivada faz sentido, e aí o
padrão a seguir é o do `isOverdue` + cron (§5, item 2), que já é precedente documentado no projeto.

**Quarto, Execução — apenas no grão de item**, escrevendo no endpoint de execução que já existe.

### O que eu acho que NÃO vale fazer

Você pediu contraponto, então aqui está, em ordem de convicção:

**1. Não faça o quadro de Suprimentos derivado agora.** É a peça mais atraente da ideia e a que
está mais longe de ser possível. Com os dados de hoje, ele mostraria "sem cotação aberta" para
material já comprado e pago pelo Fluxo B1 — e mostraria isso com a mesma confiança visual de um
dado correto. Um painel errado é pior que painel nenhum, porque remove o incentivo de conferir na
fonte. Enquanto os dois fluxos de compra existirem em paralelo, nenhuma projeção sobre eles é
confiável.

**2. Não faça o quadro de Execução no grão de etapa.** Duplicaria o `status` do cronograma, que já
tem seis estados, datas e percentuais — e **contornaria o gate PBQP-H**. Um cartão arrastado para
"Concluído" fecharia um serviço que o cronograma recusa fechar sem FVS aprovada. Trocar controle de
qualidade por conveniência de interface é o pior negócio possível num sistema que busca certificação.

**3. Não misture cartões livres e derivados no mesmo quadro.** Cada ação da UI passaria a precisar
saber a natureza do cartão. Se for adiante, que o quadro seja inteiramente derivado ou inteiramente
manual — não os dois.

**4. Desconfie da premissa.** O relato que originou esta análise foi um cartão que "sumiu" — e a
causa não foi falta de quadros, foi um select que exibia ID em vez de nome. Vale perguntar se o
problema real é a **estrutura** do Kanban ou a **usabilidade** dele. As Ondas B e C do backlog já
têm itens de Kanban aprovados (aviso de WIP, coluna de conclusão, reordenação, CRUD de quadros,
checklist no cartão) que custam uma fração disso.

**5. Considere que o Kanban pode não ser o lugar.** Suprimentos é uma **consulta com estado**, não
um quadro de tarefas — uma tela de lista com filtro por estado e coluna de prazo entregaria a mesma
informação sem prometer interatividade que o modelo derivado não pode cumprir. O quadro de colunas
convida a arrastar; se arrastar não faz nada, a interface está mentindo. Vale considerar o formato
antes da estrutura.

### O ponto que eu levantaria antes de tudo

Os dois fluxos de compra paralelos são o problema de fundo. Eles produzem contas a pagar por
caminhos diferentes, não se enxergam, e tornam impossível responder com segurança "qual o estado
deste material". Enquanto isso não for resolvido, qualquer camada visual construída em cima —
Kanban, painel ou relatório — herda a mesma cegueira. Resolver a duplicação dos fluxos destravaria
o quadro de Suprimentos **e** o ciclo de compras, que é onde o dinheiro passa.
