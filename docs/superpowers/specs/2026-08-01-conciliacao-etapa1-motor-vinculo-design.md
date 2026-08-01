# Spec — Conciliação Etapa 1: motor de vínculo tardio + fix da dupla contagem + desvincular

> **Data:** 2026-08-01 · **Origem:** `docs/revisao/2026-08-conciliacao-pendencias-diagnostico.md`
> (aceito integralmente pelo dono) · **Decisões do dono:** dupla contagem é BUG ATIVO e entra
> nesta etapa; vincular tardio NÃO cria movimento (a transação já é o movimento); obra OPCIONAL,
> nunca obrigatória; ordem confirmada (motor → tela → criar conta → detector).

## Objetivo

Criar o MOTOR que as Etapas 2-4 vão usar: vincular uma transação JÁ IMPORTADA a um título
existente (baixando-o), desfazer um vínculo errado, e parar de contar duas vezes a mesma saída
no custo realizado. Sem tela nova nesta etapa (a Etapa 2 é a tela) — validação via API e via os
números do dashboard.

Fora de escopo (deliberado): tela de pendências (E2); criar conta a partir da transação (E3);
detector de similares (E4); vínculo com valor DIFERENTE do título (variante juros — reusa a
v1.41.0 numa etapa futura); merge de movimentos duplicados manuais×OFX (caso-limite documentado
abaixo); ativação do `ofxImportId` (não há elo fitid→lote no schema; seria coluna aditiva em
`ofx_fitids`, fora do escopo).

## 1. Endpoint novo `POST ofx-vincular` (vínculo tardio, sem criar movimento)

Payload: `{ fitid, bankAccountId, table: 'accounts_payable'|'accounts_receivable', recordId,
projectId?, categoryId?, costCenterId? }`.

**Validações (todas com 409/422 amigável):**
1. `ofx_fitids` tem o par (fitid, bankAccountId) COM `cashMoveId` → senão 404 "transação não
   importada" (transação de prévia não entra aqui).
2. Nenhum título (pagar OU receber) já usa esse `ofxFitid` → 409 "transação já vinculada".
3. Título existe, não Cancelado, sem `ofxFitid` → 409 "título já vinculado a outro extrato".
4. Lado coerente: movimento `Saída` ↔ `accounts_payable`; `Entrada` ↔ `accounts_receivable`.
5. Valor do título = valor do movimento (igualdade exata em 2 casas) → 422 explicando que
   vínculo com diferença (juros) chega em etapa futura.
6. Título com `referencia_tipo='CAIXA_MANUAL'` → 409 explicativo (já tem movimento manual
   representando este dinheiro; tratar exige merge — fora do escopo; mensagem orienta).

**Gravações (UMA transação SQL):**
- Título: se aberto → `status = Pago|Recebido`, `paidDate|receivedDate = date do movimento`,
  `ofxFitid = fitid`; se já baixado → só `ofxFitid` (linkedOnly, status/data preservados).
  Mesmo contrato do conciliar da prévia (`api/index.php:7678-7685`).
- **Movimento (o já existente — NUNCA criar outro):** `referencia_tipo = 'CONTA_PAGAR'|
  'CONTA_RECEBER'`, `referencia_id = recordId`; `projectId/categoryId/costCenterId` = payload
  quando informado, senão HERDA do título (obra opcional: vazio é válido e fica vazio se nem
  payload nem título tiverem).
- Auditoria: `server_audit('update', key, recordId, details)` com o antes→depois do título via
  `financeiro_baixa_audit_details` (reuso v1.41.0) + sufixo `— vínculo OFX FITID <fitid>,
  movimento #<cashMoveId>`.

Resposta: `{ ok, data: { recordId, table, status, linkedOnly, cashMoveId } }`.

## 2. Endpoint novo `POST ofx-desvincular`

Payload: `{ table, recordId, reabrirTitulo: bool }` — **o chamador decide** se o título reabre
(o front da Etapa 2 pergunta ao usuário; sem heurística de adivinhação no backend).

- Valida: título existe e TEM `ofxFitid`; resolve o movimento via `ofx_fitids.cashMoveId`.
- Em transação: título perde `ofxFitid`/`ofxImportId`; se `reabrirTitulo` e o status é o de
  baixa → volta a `Aberto` + data de baixa NULL. Movimento perde `referencia_tipo/referencia_id`
  (volta a "pendente"). **O movimento nunca é apagado** (a linha do extrato é fato bancário) e o
  FITID continua registrado (a transação não pode ser reimportada).
- Auditoria com antes→depois (o diff da v1.41.0 mostra a reabertura).

## 3. Fix da dupla contagem (bug ativo) — frontend

`realizedCost` (`app.js:4070-4071`) soma contas pagas + TODAS as saídas de caixa. Fix: extrair
helper **puro** e usar nos dois pontos de consumo:

```js
// Saídas de caixa SEM título vinculado: movimento com referencia CONTA_PAGAR é a
// MESMA saída da conta paga que o cálculo já somou — contar os dois é dobrar.
function saidasCaixaSemTitulo(moves) {
  return Math.abs(moves
    .filter((m) => signedCashAmount(m) < 0 && !(m.referencia_tipo === "CONTA_PAGAR" && m.referencia_id))
    .reduce((total, m) => total + signedCashAmount(m), 0));
}
```

`realizedCost = paidExpenses + saidasCaixaSemTitulo(moves)`. O plano varre os demais pontos que
somam conta+caixa (`costDistributionRows`, visões de centro de custo — as que já deduplicam
ficam como estão). A série "caixa" do Lucro×Caixa NÃO muda (caixa real é o extrato inteiro — lá
não há soma com contas).

## 4. Fix do conciliar da PRÉVIA (`handle_ofx_conciliar`)

O movimento que ele cria passa a nascer com `referencia_tipo='CONTA_PAGAR'|'CONTA_RECEBER'` +
`referencia_id`, e HERDA `projectId/categoryId/costCenterId` do título (`api/index.php:
7687-7695`). Título com `referencia_tipo='CAIXA_MANUAL'` → 409 explicativo (mesma regra do §1
item 6 — hoje ele criaria o segundo movimento em silêncio). `originDocument` mantém
`'OFX:<fitid>'`.

## 5. Histórico (1 conciliação existente) — autorização à parte

O código desta etapa corrige o COMPORTAMENTO. O único registro histórico (1 receivable com
`ofxFitid`) fica como está até o dono autorizar o UPDATE de 1 linha (proposto na conversa;
detalhe: por ser do lado RECEBER, ele NÃO distorce o `realizedCost` hoje — o conserto é de
consistência, não de número errado).

## 6. Testes

- `scripts/tests/php/test_ofx_vinculo.php` (harness, sem banco): funções puras extraídas do
  handler — `ofx_vinculo_plano(array $titulo, array $movimento, array $payload): array` (decide
  baixar|linkedOnly|recusar+motivo; valida lado/valor/CAIXA_MANUAL) e a mensagem de recusa
  (sem vazar SQL). Cobre: aberto→baixa; já baixado→linkedOnly; lado errado; valor diferente;
  CAIXA_MANUAL; cancelado; herança de projectId/categoria (payload vence título; vazio fica
  vazio).
- `scripts/tests/js/test_dedup_caixa.js` (vm): `saidasCaixaSemTitulo` — saída com referencia
  CONTA_PAGAR não conta; saída sem referencia conta; entradas nunca entram; lista vazia = 0.
- Suíte completa verde.

## 7. Versão, deploy e validação

- **Sem migration, sem coluna nova** (o motor usa só estrutura existente).
- Versão: a próxima livre no momento do release (v1.42.0 se sair antes da integridade de
  orçamentos; senão v1.43.0) — o plano fixa.
- **Validação em produção (roteiro do dono):** (1) rodar a consulta de pendentes (§5.2 do
  diagnóstico) e escolher UMA transação de teste; (2) `ofx-vincular` nela via tela… não há tela
  ainda — validação da Etapa 1 é via os NÚMEROS: o card "Custo realizado" do dashboard deve
  CAIR se houver pares duplicados hoje (não há — só 1, do lado receber), e a Etapa 2 valida o
  motor de verdade; alternativa: vincular 1 transação via curl autenticado com o roteiro que o
  plano trará pronto; (3) desvincular a mesma e conferir título reaberto + movimento pendente +
  audit com antes→depois.
