# Spec — Conciliação Etapa 2: tela de pendências (+ endurecimento do motor)

> **Data:** 2026-08-01 · **Origem:** diagnóstico aceito
> (`docs/revisao/2026-08-conciliacao-pendencias-diagnostico.md`) + achados PARQUEADOS do review
> final da E1 (obrigatórios antes da tela) · **Decisões do dono:** obra OPCIONAL no ato do
> vínculo ("é ele que transforma sete meses de extrato em custo classificado por obra"); validação
> da E1 acontece JUNTO com a E2, pela tela; movimento **#4** (R$ 1.880,09, CONTA_PAGAR→título 1)
> é o único vínculo manual existente — vira caso de teste da guarda e da listagem.

## Objetivo

Dar ao dono a fila de trabalho: as ~244 transações importadas sem título, com sugestões de match,
ação de vincular (com obra opcional) e desfazer — no ritmo dele, não no momento do upload.

Fora de escopo: criar conta a partir da transação (E3); detector de similares (E4); vínculo com
valor diferente (juros — etapa futura); merge de movimento manual×OFX duplicado.

## 0. Abertura — endurecimento do motor (ANTES da tela; achados parqueados do review E1)

1. **Guarda no `ofx-vincular`:** antes da transação, se o MOVIMENTO já tem
   `referencia_tipo IN ('CONTA_PAGAR','CONTA_RECEBER')` + `referencia_id` apontando para um
   título QUE AINDA EXISTE e ≠ `recordId` → **409** "esta transação já representa a baixa do
   título X — desfaça aquele vínculo antes". Referência morta (título apagado) pode ser
   sobrescrita. Decisão em função **pura** `ofx_movimento_livre(array $movimento, ?array
   $tituloDaReferencia): ?string` (null = livre; string = motivo do 409) — testável sem banco.
2. **Desvincular determinístico:** o lookup do movimento ganha
   `ORDER BY (originDocument LIKE 'OFX%') DESC, id DESC` (prefere o movimento do extrato quando
   um manual e um OFX carregam a mesma referência; coluna×literal — collation-safe).
3. **Migration `2026-08-01-ofx-fitid-unique.sql`:** `ADD UNIQUE INDEX IF NOT EXISTS uk_pay_fitid
   (ofxFitid)` em `accounts_payable` e `uk_rec_fitid (ofxFitid)` em `accounts_receivable`
   (UNIQUE aceita múltiplos NULL — só valores preenchidos são únicos; fecha o TOCTOU do
   pré-check). Aditiva; o índice simples antigo (`idx_pay_fitid`/`idx_rec_fitid`) fica
   (redundância inofensiva, sem DROP). `ensure_ofx_tables` passa a criar também o UNIQUE
   (guardado por checagem no INFORMATION_SCHEMA.STATISTICS). Pré-condição trivial: hoje há no
   máximo 1 título com `ofxFitid` por lado (medido) — sem risco de duplicata na criação.

## 1. Endpoint `GET ofx-pendencias` (paginado — NUNCA no bootstrap)

Query params: `bankAccountId` (opcional), `de`/`ate` (datas do movimento, opcionais),
`lado` (`Entrada`|`Saída`, opcional), `limit` (default 20, máx 50), `offset`.

**Definição de PENDENTE (aprendida com o movimento #4):** transação importada
(`ofx_fitids.cashMoveId IS NOT NULL`) cujo fitid **não está em nenhum título** E cujo movimento
**não tem referência viva** (`referencia_tipo` NULL, ou referência órfã de título apagado). O
movimento #4, se for de extrato, NÃO aparece — já está representado pelo título 1.

SQL: `ofx_fitids f JOIN cash_bank_movements m ON m.id = f.cashMoveId` (numérico) + checagem de
título por `NOT EXISTS (... WHERE p.ofxFitid = f.fitid COLLATE utf8mb4_unicode_ci)` — **o único
JOIN texto×texto da frente, com COLLATE explícito obrigatório** (regra da spec E1 §5-B; vira
no-op após a padronização) + exclusão de referência viva via `LEFT JOIN` pelos ids.

Resposta por linha: `fitid`, `cashMoveId`, `date`, `type`, `amount`, `history`, `bankAccountId`,
`bankAccountName`, e **`matches`** (reuso direto de `ofx_find_matches` por linha da página — máx
50 consultas leves por request, indexadas) com `autoMatch` quando confiança ≥85 (mesma régua da
prévia). Total de pendentes no payload (`total`) para o badge da aba.

## 2. A tela — aba "Pendências" no módulo Conciliação

- **Aba própria** ao lado do conteúdo atual da tela Conciliação (o painel de upload continua
  como está): `Pendências (N)` — o N vem do endpoint (primeira página), não do bootstrap.
- Filtros: conta bancária, período (de/até), lado. Paginação "Carregar mais" (`offset`).
- **Linha:** data · histórico (escapado) · tipo · valor (`moneySpan`) · melhor sugestão
  (documento do título + vencimento + confiança, badge no molde da prévia) · ações:
  **[Vincular]** e, quando não há match, **[Escolher título]**.
- **Modal de vínculo** (reusa o padrão de dialog existente): mostra a transação e o título
  (sugerido ou escolhido numa lista de títulos ABERTOS do MESMO VALOR e mesmo lado, qualquer
  data); campos **OPCIONAIS** — **Obra/Projeto** (select de `db.projects`, default vazio com
  hint "herda do título se vazio"), Categoria, Centro de custo; botão Vincular → `POST
  ofx-vincular`; sucesso → `showToast(success)` + linha some da lista (recarrega página atual).
  Erros 409/422 do motor aparecem no toast `warning` (mensagens já são amigáveis).
- **Desfazer:** após vincular, a linha vira estado "vinculada" com botão Desfazer até o próximo
  reload da lista (chama `ofx-desvincular`; `confirm()` pergunta se reabre o título — os dois
  botões do fluxo: "Desfazer e reabrir" / "Desfazer e manter baixado").
- **Privacidade:** todo R$ de tela via `moneySpan`; textos dinâmicos escapados (`escapeHtml`);
  nenhum `alert()` novo (toast com severidade, regra E3).

## 3. Testes

- `scripts/tests/php/test_ofx_movimento_livre.php`: a função pura da guarda — movimento sem
  referência → livre; referência CONTA_PAGAR com título vivo ≠ recordId → motivo cita o título;
  mesma referência do próprio recordId → livre (revincular idempotente é inofensivo);
  referência órfã (título null) → livre; CAIXA_MANUAL no movimento → livre (não é reivindicação
  de baixa); mensagens sem SQL/tabela.
- `scripts/tests/js/test_ofx_pendencias.js` (vm): helpers puros da tela (montagem de linha/badge
  de confiança/estado vinculada) — extração por âncora, no molde dos testes existentes.
- Suíte completa verde.

## 4. Versão, deploy e validação (inclui a validação pendente da E1)

- Versão `v1.43.0`; `?v=` 1812→1813; changelog nos 3 docs. **Migration nova** (a do UNIQUE) —
  rodar no servidor após o pull (ensure cobre se atrasar).
- **Validação em produção, pela tela (E1+E2 juntas, roteiro do dono):**
  1. Aba Pendências mostra ~244 (ou 243, se o #4 for de extrato — conferir que o **#4 NÃO
     aparece**);
  2. Vincular uma transação com match: título baixado com a data do movimento, obra escolhida
     no modal gravada no movimento; conferir no Custo da Obra/dashboard por obra que o valor
     apareceu classificado;
  3. Vincular uma SEM match escolhendo título de mesmo valor;
  4. Desfazer com "reabrir": título Aberto de novo, transação volta à lista de pendências;
  5. Tentar vincular a transação do movimento #4 (se de extrato, via id direto na API) → 409
     citando o título 1 (prova da guarda);
  6. Auditoria mostrando antes→depois de cada passo.
