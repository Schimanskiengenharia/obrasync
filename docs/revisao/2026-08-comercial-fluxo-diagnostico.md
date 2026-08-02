# Diagnóstico — Frente Comercial: do orçamento ao contrato

> **Data:** 2026-08-02 · **Base:** v1.44.0 · **Método:** leitura de código (SÓ LEITURA); dados
> medidos pelo dono confirmados contra o schema/fluxos: 5 `budgets` reais (todos `proposalId`
> NULL), 2 `commercial_proposals`, **0 `proposta_orcamento_vinculos`**, **0 `orcamentos_obras`**,
> 1 `proposal_models`, `sales_contracts` sem tabela de modelo.
>
> **Fluxo-alvo do dono:** Excel (orça fora) → `budgets` um por disciplina → proposta que JUNTA
> disciplinas com Modelo de texto → versões v1/v2/v3 → contrato da versão aceita → obra do
> contrato. **Premissa aceita:** o detalhe do Excel NÃO entra no sistema — só o valor por frente,
> com a planilha como guarda.

---

## 1. O elo orçamento → proposta (o degrau principal)

**[existe hoje]** O vínculo N:N existe e funciona — mas **num trilho que o dono não usa**:

- O fluxo nasce no GERADOR de proposta, acionado pelo botão "Gerar Proposta" na linha de
  **`workBudgets`** (`orcamentos_obras` — extraRowActions, `canGenerateProposalForBudget`).
- O painel "Orçamentos vinculados" (`renderProposalGroupsPanel`, `app.js:16196+`) tem o
  **"+ Vincular orçamento"** (`app.js:16263`) — e o select lista os **`workBudgets` do mesmo
  projeto** ainda não vinculados. Grupos com disciplina (datalist de 9 sugestões), descrição
  (vira seção do documento), BDI por grupo/geral/manual.
- `proposalGroupsCompute` (`app.js:16147`) calcula o CUSTO de cada grupo somando
  **`budgetItemsFor(g.budgetId)`** — os ITENS de `orcamento_obra_itens`. É aqui que o trilho
  trava para o dono: `budgets` é valor fechado POR FRENTE, sem itens.
- `proposta_orcamento_vinculos.workBudgetId` é **NOT NULL** (migration
  `2026-06-08-proposal-generator-from-work-budget.sql:62`) com UNIQUE `(proposalId, workBudgetId)`.

**[distância]** Tudo que o fluxo-alvo precisa (grupos, disciplina, descrição, venda por grupo,
documento em seções) JÁ existe — apontando para a tabela vazia. Os 5 orçamentos reais estão em
`budgets` (number/cliente/obra/centro/descrição/**amount**/status — `app.js:1376+`), invisíveis
para o gerador.

**O menor caminho para o vínculo aceitar OS DOIS — três opções, com custo:**

| Opção | Desenho | Custo | Veredito |
|---|---|---|---|
| **(a) Coluna aditiva `budgetId`** | `proposta_orcamento_vinculos` ganha `budgetId NULL`; `workBudgetId` vira NULL; regra one-of no app; gerador ganha modo **"grupo de valor fechado"** (custo = `amount` do budget, sem tabela de itens; BDI opcional sobre o valor); o "+ Vincular" lista os dois conjuntos | **M** (migration + ensure + gerador + painel + documento) | **Recomendada** — preserva tudo que existe, o UNIQUE vira dois parciais |
| (b) Polimórfico `origem_tipo`/`origem_id` | refaz a chave do vínculo | M/G | Quebra UNIQUE/índices/consumidores (contrato lê os vínculos; IA); padrão que a casa não usa — não vale |
| (c) Espelhar `budgets` em `orcamentos_obras` | criar workBudget-casca por budget | P/M | **Rejeitar** — dado fantasma no módulo técnico (Custo da Obra listaria orçamentos sem itens); é a receita de um novo caso "122 órfãos" |

**`commercial_proposals.budgetId` E `workBudgetId` (singulares):** resquício confirmado do 1:1 —
`budgetId` sobrevive no seed/demo e em rótulos (`app.js:1945-1946`, `7716`); o gerador grava o
principal. Convivem com o N:N como "orçamento de origem" informativo — inofensivos; a fonte da
verdade multi-disciplina são os vínculos. Não mexer.

**F3 (documento em seções por disciplina):** `proposalDocumentHtml` (`app.js:17115`) monta as
seções a partir dos GRUPOS (nome, disciplina, descrição, valores) — **funciona com `budgets` sem
alteração conceitual**; só a tabela DETALHADA de itens não existiria (coerente com "orça fora" —
os modos resumidos de `itemDisplayMode` cobrem).

## 2. Versionamento da negociação

**[existe hoje — em pedaços desligados]:**
- `parentProposalId`: **semi-morto** — está no formulário ("Proposta anterior", `app.js:1327`),
  tem rótulo e `formatCell` (`7716`, `7837`), o gerador o zera (`17826`)… e NENHUMA ação o usa:
  não há botão "nova versão", a lista não agrupa, o documento não menciona.
- `proposta_status_historico`: **ALIMENTADO** em dois pontos — mudança de status pelo cadastro
  (`saveForm`, `app.js:~9106-9113`) e a geração (`createProposalLinkedRecords`, `app.js:17859+`,
  que grava vínculos + histórico + itens + variáveis). Sem tela dedicada de leitura.
- **Documento preservado por versão: JÁ FUNCIONA por construção** — `proposalBody` é do registro;
  versão = novo registro = novo documento; a v1 continua imprimível no registro antigo.
- **Contrato registrando a versão: JÁ FUNCIONA por construção** — `sales_contracts.proposalId`
  aponta o registro (= a versão) que gerou o contrato.

**[falta criar]** o pouco que liga os pedaços: **(i)** ação "Criar nova versão" (duplica
proposta + vínculos + variáveis, aponta `parentProposalId`, status da anterior → `Substituída`);
**(ii)** vigência DERIVADA (a versão sem sucessora e não-Substituída da cadeia — molde
`rhDocSituacao`, nada gravado além do status); **(iii)** lista agrupando por cadeia (vigente em
destaque + "v3 · 2 anteriores") ou, mínimo, filtro que oculta Substituídas. Tamanho: **P/M**.

## 3. Modelos

**Proposta [existe hoje e funciona]:** `proposal_models` alimenta o gerador
(`applyProposalTemplate`, `app.js:16947` — preenche objeto/escopo/prazo/condições/etc.;
`saveProposalAsTemplate`, `16916`, salva `estrutura_json`); o documento consome modelo +
variáveis automaticamente. `proposalModelId` por grupo é gravado (`17870`) — hoje informativo.
**`proposta_variaveis` está VIVA** (gravada na geração, `app.js:17910`; resource
`proposalVariables`, `api:2339`) — **é o mecanismo de variáveis reusável**.

**Contrato [não existe]:** `contractPdfHtml` (`app.js:7528`) tem as **13 cláusulas HARDCODED**
(builder `clausula()`, `7533`). Proposta de desenho: tabela **`contrato_modelos`** no molde
exato de `proposal_models` (nome, `estrutura_json` com cláusulas `[{titulo, corpo}]` e
variáveis `{{cliente}}/{{objeto}}/{{valor}}/{{prazo}}/{{condicoes}}` substituídas da
proposta/contrato — o `buildContractObjeto` já monta o objeto POR DISCIPLINA dos vínculos,
`app.js:7416`), com as 13 cláusulas atuais viradas em **modelo-semente** (migração invisível:
o PDF sai idêntico até alguém editar). Tamanho: **M** (tabela aditiva + ensure + CRUD
config-driven + render com fallback).

## 4. Proposta → Contrato → Obra

**Aprovação (estado pós-F4a, confirmado):** transição para Aprovada roda em transação no
backend (`api/index.php:~1050-1100`): reusa obra existente do cliente (anti-duplicação;
`obraReusada`) ou **cria a obra com `revenueContracted = proposal.amount`** (`api:1095`); em
obra existente, preenche `revenueContracted` **só se ≤ 0** (`api:1075-1076`) — não sobrescreve.
Cria também o orçamento de obra. Rollback + log de evento em erro.

**Contrato:** `generateContractFromProposal` monta o objeto **por disciplina** a partir dos
vínculos (F3 chega ao contrato ✓). **Testável hoje? Sai SEM seções** — com 0 vínculos, cai no
fallback (`description` da proposta, `app.js:7418`). O detalhamento aparece assim que o elo do
§1 existir.

**Obra:** nasce da **PROPOSTA aprovada** (não do contrato). `revenueContracted` vem da
automação ✓; **`costForecast` é 100% manual** (nenhuma automação escreve — só o cadastro).
`sales.valor_contrato` alimenta a automação do marco (`api:15162`), mas o contrato **não toca a
obra**.

## 5. Síntese e contraponto

### O fluxo-alvo, seta a seta

```
Excel ──► budgets (1 por disciplina)          EXISTE (manual; SEM lugar p/ anexar a planilha-guarda)
budgets ──► proposta multi-disciplina          NÃO EXISTE (o elo espera workBudgets; vínculos = 0)
proposta + modelo de texto ──► documento       EXISTE (models + variáveis + seções por disciplina)
negociação ──► versões v1/v2/v3                PARCIAL (campo existe; ação/vigência/agrupamento não)
versão aceita ──► contrato                     PARCIAL (gera com disciplinas ✓; modelo de contrato NÃO existe — 13 cláusulas fixas)
contrato ──► obra                              DIFERENTE (obra nasce da PROPOSTA aprovada, com revenueContracted; costForecast manual; contrato não toca obra)
```

### Lacunas por retorno sobre esforço

1. **Vínculo aceita `budgets`** (opção a) — **M** — destrava o fluxo-alvo INTEIRO; sem ele, todo
   o resto opera no vazio.
2. **Ação "Nova versão" + vigência derivada + agrupamento** — **P/M** — liga os pedaços que já
   existem (parent, histórico, documento por registro).
3. **Modelo de contrato com variáveis** — **M** — reusa `proposta_variaveis` + semente das 13.
4. **Anexo da planilha no `budget`** — **P** — a guarda do Excel não tem onde morar hoje (o
   molde de upload do RDO/NF serve).
5. **Contrato enriquece a obra** — **P** — `valor_contrato` → `revenueContracted` quando
   maior/ausente (em vez de mover o nascimento da obra).

### CONTRAPONTO — o que NÃO vale fazer, ou vale diferente

- **"Obra nasce do contrato": discordo de mover o nascimento.** A automação atual (proposta
  Aprovada → obra) é o gatilho certo — contrato demora assinatura e a obra precisa existir antes
  para planejamento. O que falta é o item 5: o contrato ENRIQUECER a obra, não parí-la.
- **NÃO espelhar `budgets` em `orcamentos_obras`** (opção c) — cria dado fantasma no módulo
  técnico; é a receita de um novo caso "122 órfãos".
- **NÃO criar tabela de versões** — `parentProposalId` + status `Substituída` + ação de duplicar
  cobre a negociação real; tabela própria seria sobre-engenharia para v1/v2/v3.
- **`budgets` não tem campo de CUSTO** — só `amount`. Se o resultado POR DISCIPLINA no comercial
  importar (margem da proposta), é decisão sua: 1 coluna `custo` opcional (aditiva) — senão o
  BDI/margem do gerador não significa nada para grupos de valor fechado, e o honesto é
  escondê-los nesses grupos.
- **Alinhado com sua premissa:** itens do Excel NÃO entram; a proposta de `budgets` nunca terá
  tabela detalhada de itens — e não deve fingir que tem.

### Exemplo concreto — com os dados de HOJE (5 budgets, 2 propostas, 0 vínculos)

- **Item 1** entregaria na hora: o painel de grupos povoável com os 5 orçamentos reais (Asilo e
  Atacama, por frente) → primeira proposta multi-disciplina de verdade, com seções por
  disciplina no documento.
- **Item 2**: as 2 propostas atuais viram cadeias de 1 versão — visualmente NADA muda até a
  primeira renegociação (é o esperado).
- **Item 3**: o PDF do contrato sai IDÊNTICO ao atual (modelo-semente) até alguém editar o
  modelo — mudança invisível no dia 1, por design.
- **Contrato por disciplina HOJE**: sairia **sem seções** (0 vínculos → fallback na descrição).
  Vira real junto com o item 1.
