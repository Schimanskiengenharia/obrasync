# Diagnóstico — Integração financeiro ↔ cronograma ↔ orçamento (previsto, realizado, economia)

> **Data:** 2026-07-31 · **Base:** v1.40.0 · **Método:** leitura de código (SÓ LEITURA); schema
> por `schema.sql` + migrations; dados citados = medições do dono (2026-07-29 e 2026-07-31).
> **Decisões do dono que orientam este doc:** previsto financeiro é do CRONOGRAMA; realizado é do
> FINANCEIRO e deve ser DERIVADO (molde `rhDocSituacao`/`isOverdue`); vínculo por OBRA; sem IA.
> **Dor declarada:** digitar a mesma informação no Financeiro e no Cronograma.
>
> **Estado dos dados hoje (medido):** obra 7 = 3 etapas de cronograma (com datas), 3 marcos
> (1 concluído, todos com data), 4 contas a receber (SÓ 1 com `referencia_tipo='MARCO'`),
> **0 contas a pagar e 0 caixa vinculados**, **nenhum orçamento válido** (tabela vazia; 122 itens
> órfãos com limpeza autorizada — ver `2026-07-orcamento-itens-orfaos-diagnostico.md`).

---

## PARTE 1 — O percentual financeiro do cronograma

### 1. Digitado ou calculado? — DIGITADO, 100% manual

**[existe hoje]** As 4 grandezas da etapa (`plannedPhysicalPercent`, `actualPhysicalPercent`,
`plannedFinancialAmount`, `actualFinancialAmount`) são gravadas SOMENTE pelo CRUD genérico do
módulo (resource `projectSchedule`, `api/index.php:1908` — o formulário expõe os 4 campos;
`tableFields` em `app.js:10408`). Nenhuma automação escreve nelas (grep no `api/index.php`: além
do resource, só LEITURAS — WhatsApp `api:14149`, fallback de % da automação de marco `api:14146+`).
Import de MS Project grava datas/%. **Onde são lidas:** `scheduleMetrics` (`app.js:3977-4029` —
soma/média por obra), KPIs da tela (`app.js:10437-10446`, incl. "Saldo financeiro da obra" =
recebido da obra − Σ `actualFinancialAmount`, `app.js:4011-4012`), dashboard (`app.js:4102-4105`),
export MSP (`app.js:10568` custo).

**É AQUI a duplicação:** o dono lança a conta no Financeiro E digita o mesmo dinheiro de novo em
`actualFinancialAmount` da etapa.

### 2. Menor caminho para o realizado financeiro virar derivado

**[reuso]** O cálculo derivado por OBRA **já existe**: `app.js:4070` —
`realizedCost = contas pagas da obra + saídas de caixa da obra` (visão por obra do dashboard, com
anti dupla contagem via vínculo caixa↔conta). O molde de exibição derivada é o `rhDocSituacao`.

**[distância]** No nível da OBRA: **P** — no cronograma, exibir "Realizado (derivado do
Financeiro)" ao lado do total digitado, usando a mesma fórmula do dashboard (coleções já no
bootstrap; zero endpoint). Não apaga o campo digitado — expõe a divergência e deixa o digitado
morrer por desuso. No nível da ETAPA: depende do §3(b) — **G** hoje.

**[riscos]** Com os dados atuais o derivado da obra 7 é **R$ 0** (0 pagas/0 caixa vinculados) —
mostrar os dois números lado a lado é justamente o que evidencia o buraco de vínculo.

### 3. Conta → etapa do cronograma: NÃO existe

**[existe hoje]** Confirmado: `accounts_payable` tem `projectId`, `categoryId`, `costCenterId`,
`referencia_tipo/id` — **nada de etapa** (campos do resource em `api/index.php:1947`; receivable
idem `api:1946`). `referencia_tipo/id` não serve para isso: já carrega a ORIGEM da conta
(`COTACAO_MATERIAL`/`PEDIDO_COMPRA`/`MARCO`/`CAIXA_MANUAL`) — sobrecarregar quebraria as
automações que consultam por referência.

- **(a) Derivar por OBRA sem campo novo: SIM, hoje** — é o `realizedCost` (`app.js:4070`).
- **(b) Chegar à ETAPA — dois caminhos possíveis:**
  1. **Campo novo `cronograma_etapa_id BIGINT NULL`** em `accounts_payable` (e receivable),
     preenchido no LANÇAMENTO (select de etapas filtrado pela obra). Custo: migration aditiva +
     ensure + form. **Efeito colateral: cria DIGITAÇÃO nova** — cada conta passa a pedir
     classificação por etapa (ver contraponto §16a).
  2. **Derivar pela cadeia que já existe** quando o ciclo de compras rodar:
     `purchase_order_items.work_budget_item_id` → `orcamento_obra_itens.etapa_id` → etapa do
     ORÇAMENTO; e a etapa do CRONOGRAMA já tem `workBudgetId`/`workBudgetItemId`
     (migration `2026-06-08:6-8`) esperando ligação — **medição: zero uso** até hoje. Zero
     digitação nova, mas só cobre custo que passa por pedido.

### 4. Previsto financeiro por etapa: digitado; a ponte com o orçamento existe e nunca foi usada

`plannedFinancialAmount` é digitado no mesmo formulário. As colunas `workBudgetId`/
`workBudgetItemId` da etapa do cronograma foram criadas exatamente para puxar do orçamento e
**nunca foram preenchidas** (medição 2026-07-31: zero vínculos). Detalhe estrutural: a etapa do
CRONOGRAMA (`obra_cronograma_etapas`), a etapa do ORÇAMENTO (`orcamento_etapas`, `api:1905`) e o
`stageName` texto-livre do item são **três vocabulários independentes** (ver §10).

---

## PARTE 2 — A ponte marco → conta a receber

### 5. A automação completa (mapa)

**[existe hoje]** Disparo: PUT genérico em `projectMilestones` com transição de status para
Concluído/Aprovado (`api/index.php:2198-2201`), **transacional com rollback + log de evento**
(`api:2186-2224`). Função `automate_approved_milestone` (`api/index.php:14117-14197`):

- **Idempotente**: se já há conta com `referencia_tipo='MARCO'` e `referencia_id=<marco>`, não
  duplica (`api:14128-14136`).
- **Valor**: `amount = projects.valor_contrato × percent/100` (`api:14155-14156`). O `percent`
  vem de colunas de percentual do MARCO **que não existem na tabela real** → cai no fallback: %
  da etapa vinculada (`scheduleStepId`), na ordem `percentual`→`plannedFinancialPercent` (não
  existem)→**`plannedPhysicalPercent`** (`api:14146-14153`). Ou seja: **valor = contrato × %
  FÍSICO previsto da etapa** — e **marco sem etapa vinculada gera conta de R$ 0,00**.
- **Vencimento**: hoje + `prazo_pagamento` do projeto (fallback **30 dias**) — não a data da
  parcela contratual (`api:14158-14160`).
- **Campos gravados** (`insert_dynamic`, `api:14162-14188`): `document='MARCO-<id>'`,
  `description='Medicao: <nome>'`, emissão hoje, `clientId`/`costCenterId` herdados do projeto,
  status Aberto, `referencia_tipo='MARCO'`/`referencia_id`.
- **Extras**: tenta gravar `conta_receber_id` no marco — **descartado em silêncio** (coluna não
  existe; `update_dynamic` ignora — o vínculo vive SÓ do lado da conta, `api:14189-14193`); cria
  evento de cobrança na agenda (`create_milestone_billing_event`, `api:14194`).

### 6. Por que digitam à mão em vez de concluir o marco — três causas no código

1. **A automação é INVISÍVEL.** O `saveForm` genérico não exibe `record.automation`
   (`app.js:9081-9091` só troca a linha no `db`); o único `alert(record.automation)` do app está
   no fluxo de QUALIDADE (`app.js:12427`). Quem conclui um marco não fica sabendo que uma conta
   nasceu — e a tela de marcos (`configs.projectMilestones`, `app.js:1128-1142`) não diz uma
   palavra sobre cobrança.
2. **O valor sai errado ou zero** na configuração típica (marco sem etapa, etapa sem %, projeto
   sem `valor_contrato`) — quem tem o boleto/parcela na mão digita o valor certo direto.
3. **O vencimento sai errado** (hoje+30 ≠ data da parcela do contrato).

Medição bate: 4 contas a receber na obra 7, só 1 `MARCO` — as outras 3 manuais.

### 7. Campo de valor no marco — avaliação

**[existe hoje]** `obra_cronograma_marcos` NÃO tem valor (DESCRIBE do dono; configs
`app.js:1128-1142` idem). O valor da conta vem da fórmula frágil do §5.

**[falta criar]** `valor_previsto DECIMAL(15,2) NULL` (+ opcional `data_prevista_cobranca` já
existe como `plannedDate`). Com ele: (a) o cronograma exibe previsto de RECEITA por marco (as
parcelas do contrato viram plano visível); (b) a automação usa `valor_previsto` direto (fallback
para a fórmula atual), e o vencimento pode usar `plannedDate` quando futura. **[tamanho] P/M**
(migration aditiva 1 coluna + ensure + form + 2 pontos na automação + feedback visível).
**[riscos]** baixo; regra do drift: migration é a fonte, `ensure_*` junto, schema.sql alinhado.

### 8. Caminho inverso (receber a conta → marco): NÃO existe

Grep `'MARCO'` no `api/index.php`: só a geração (`api:14128-14186`) e o log de erro (`api:2218`).
Receber a conta não toca marco/cronograma. **Deveria?** Parcial: marcar algo como "cobrança
recebida" no marco seria útil ao cronograma, mas `status='Concluído'`/`completedDate` são fatos
FÍSICOS do marco, não financeiros — misturar os dois no mesmo status seria erro. O honesto é
DERIVAR na exibição (o cronograma consulta a conta `MARCO-<id>` e badge "recebida/aberta/vencida"
no molde `isOverdue`) — sem gravar nada no marco. Tamanho P, condicionado ao §7.

### 9. Lado de PAGAR: sem automação equivalente — e está certo assim

Não existe etapa/marco gerando conta a pagar prevista. O previsto de CUSTO já tem casa: o
ORÇAMENTO (itens × etapas), e o caminho orçamento→cotação→pedido→conta (Cotações P2,
`materialGerarConta`; pedido aprovado idem) já gera a conta real com referência. Duplicar
previsão de custo no cronograma criaria o mesmo problema de dupla digitação que este diagnóstico
quer matar. O que falta no pagar não é automação nova — é o ciclo de compras RODAR (medição
2026-07-29: nunca rodou).

---

## PARTE 3 — Previsto × realizado × economia por etapa

### 10. `stageName` VARCHAR × `etapa_id`: dois vínculos, três vocabulários

**[existe hoje]** O item do orçamento tem **os dois**: `etapa_id` (aponta `orcamento_etapas`, sem
FK real) e `stageName` texto livre. Usos divergem: a execução agrupa por `etapa_id`
(`app.js:11124`), o export SINAPI por obra agrupa por `stageName` (`api/index.php:3355`), o
comparador de cotações nem agrupa. **Quebra em**: renomear a etapa (o `stageName` gravado no item
não acompanha), acento/caixa ("Fundações" ≠ "fundacoes" — grupos duplicados no export). E
`orcamento_etapas.nome` × `obra_cronograma_etapas.stageName` são conjuntos independentes — nada
os relaciona hoje (§4). Qualquer quadro por etapa deve usar **`etapa_id`**, nunca `stageName`.

### 11. Economia por etapa via pedidos: SIM, os dados permitem — com uma ressalva honesta

**[existe hoje]** `purchase_order_items` (migration `2026-06-09:12-25`): `quantidade`,
`valor_unitario`, **`valor_total` GENERATED STORED**, `work_budget_item_id` NULL + índice.
Cadeia: pedido → item do pedido → item do orçamento (`unitCost`/`totalCost`) → `etapa_id`.

**Fórmula honesta por etapa, só do que foi comprado:**
`previsto_comprado = Σ (quantidade_pedida × unitCost_orçado)` e
`realizado_comprado = Σ valor_total_pedido` **dos MESMOS itens** — nunca `totalCost` total do item
(compra parcial inflaria o previsto). Economia = diferença. Itens de pedido com
`work_budget_item_id NULL` ficam num balde "sem vínculo" visível (não somem).

### 12. O que as telas já mostram e o que falta

| Tela | O que mostra | O que NÃO mostra |
|---|---|---|
| Custo da Obra — visões (etapa/tipo/centro) | previsto por `etapa_id` (`budgetItemsFor`, `app.js:11431`) | nada de compra/pago |
| Execução (Realizado × Orçado) | `quantidade_realizada` × `quantity` por item (alimentada por recebimento de pedido, `api:6543`, ou digitação) | R$ de compra; economia |
| Widget "Execução das Obras" | previsto × realizado R$ por OBRA (`api:6614+`) | grão de etapa |
| Comparação de cotação × orçamento | preço cotado × orçado por similaridade (`api:3954+`) | consolidação por etapa; pedidos |

**[falta criar]** um quadro "por etapa: orçado dos itens comprados × pedido × economia" — os
JOINs existem; é tela + consulta (M). **[riscos]** hoje daria VAZIO (ver §17).

### 13. NF sem granularidade de item: limita, não impede

`fiscal_documents` liga a `payableId`/`purchaseOrderId` INTEIROS (campos em `api/index.php:1907`)
— não há NF-por-item. Consequência: "valor PAGO por etapa" só existiria rateando a conta/NF pelos
itens do pedido (proporcional ao `valor_total`) — rateio é estimativa, não fato. **Mais honesto
hoje: valor do PEDIDO por item** (fato registrado com granularidade), rotulado como "comprado",
com o "pago" existindo só no nível pedido/conta. Quando o ciclo de compras + NF rodar de verdade,
reavaliar se o rateio vale a pena.

---

## PARTE 4 — Síntese

### 14. O fluxo do dinheiro da obra HOJE (onde digita, o que propaga, onde duplica)

```
DIGITA 1x e propaga sozinho:
  proposta Aprovada ──► obra + orçamento (automação)
  cotação P2 vencedora ──► conta a PAGAR (referencia COTACAO_MATERIAL)
  pedido Recebido ──► quantidade_realizada do item (execução física)
  marco Concluído ──► conta a RECEBER 'MARCO-<id>' + evento de agenda   ← SILENCIOSO e valor frágil

DIGITA 2x (a duplicação real):
  ① actualFinancialAmount da etapa  ✍  = o mesmo dinheiro das contas pagas do Financeiro
  ② plannedFinancialAmount da etapa ✍  = o mesmo previsto que viveria no orçamento (ponte
     workBudgetId/ItemId da etapa existe desde 2026-06-08 e nunca foi usada)
  ③ conta a receber da parcela      ✍  = o que o marco concluído JÁ gera (mas sem valor certo,
     sem vencimento certo e sem avisar) — 3 de 4 contas da obra 7 foram manuais
```

### 15. Pequeno que destrava × grande que espera

- **P (destrava muito):** dar VOZ e VALOR à ponte do marco — `valor_previsto` no marco (§7) +
  automação usando-o + `plannedDate` como vencimento quando futura + toast de feedback no
  `saveForm` para `record.automation` (1 linha, beneficia TODAS as automações do CRUD) + badge
  derivada "cobrança recebida/aberta/vencida" (§8). Mata a duplicação ③.
- **P (meio passo honesto):** "Realizado (derivado do Financeiro)" por OBRA no cronograma (§2),
  ao lado do digitado — mata a ① no nível que os dados de hoje permitem.
- **G (espera):** conta→etapa (§3b), quadro de economia por etapa (§11-12), unificação dos três
  vocabulários de etapa (§10) — todos dependem de orçamento válido e ciclo de compras rodando; o
  lugar deles é a spec do cronograma completo (`docs/specs/cronograma-fisico-financeiro.md`).

### 16. CONTRAPONTO — onde discordo do caminho aparente

- **(a) NÃO criar `cronograma_etapa_id` na conta agora.** Parece a solução direta e é uma
  armadilha: troca digitação por digitação (classificar cada conta por etapa é MAIS trabalho
  manual, o oposto do objetivo). O grão de etapa deve vir DERIVADO da cadeia
  pedido→item→etapa quando o ciclo de compras rodar — zero campo novo, zero digitação nova.
- **(b) NÃO puxar `plannedFinancialAmount` do orçamento agora.** A obra em uso não tem orçamento
  válido (zero registros; órfãos em limpeza). Ligar cronograma→orçamento hoje ligaria ao vazio.
  Registrar a ponte (colunas já existem) e ativar quando houver orçamento real.
- **(c) O marco NÃO deve ganhar percentual, e sim VALOR.** A fórmula atual (contrato × % físico)
  é a fonte do valor errado — parcela de contrato é um VALOR combinado, não uma fração calculada.
  `valor_previsto` R$ direto, como o dono pediu para juros/acréscimos (mesma filosofia: o boleto/
  contrato já traz o número).
- **(d) NÃO tocar nos três vocabulários de etapa neste ciclo.** É a reforma certa no lugar errado:
  mexe em orçamento+cronograma+export ao mesmo tempo, com dados em transição. Spec do cronograma
  completo é o dono desse problema.

### 17. Exemplo concreto — o que cada frente entregaria HOJE

- **Ponte do marco (P):** a ÚNICA com conteúdo imediato. Obra 7: 3 marcos datados; preenchendo
  `valor_previsto` nos 2 pendentes, o cronograma mostraria "previsto a faturar: R$ X em <data>"
  por marco, e concluir passaria a gerar conta certa e AVISAR. A conta `MARCO-` existente
  ganharia badge "aberta/vencida/recebida".
- **Realizado derivado por obra (P):** mostraria **R$ 0,00** ao lado do que estiver digitado nas
  3 etapas — vazio que INFORMA (evidencia a falta de vínculo dos lançamentos, mesmo fenômeno do
  card "Custo realizado R$ 0,00").
- **Quadro de economia por etapa (G):** **VAZIO** — sem orçamento válido não há `etapa_id`, sem
  pedidos vinculados não há comprado. Não construir agora.
