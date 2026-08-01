# Diagnóstico — Conciliação bancária: pendências, vínculo posterior e conta a partir do extrato

> **Data:** 2026-08-01 · **Base:** v1.41.0 · **Método:** leitura de código (SÓ LEITURA); dados
> citados = medição do dono (10 importações, 281 transações nos arquivos, 245 movimentos em
> `cash_bank_movements`, 1 movimento com `referencia_tipo`, ZERO com `projectId`, 1 receivable
> com vínculo OFX).
>
> **Resumo em uma frase:** o sistema tem parser, dedupe por FITID, match automático e baixa por
> conciliação — mas TUDO isso só existe DENTRO da prévia de upload; depois de importar, a
> transação vira movimento de caixa órfão de contexto e **não há caminho de volta** (o endpoint
> de conciliar até RECUSA transação já importada, por design). As 4 partes pedidas pelo dono são
> o caminho de volta.

---

## 1. O que já existe

### 1.1 A tela de Conciliação hoje (`renderReconciliation`, `app.js:18017-18146`)

**[existe hoje]** A tela mostra: cards de saldo POR CONTA bancária (calculado só pelas
movimentações — `app.js:18021-18031`), tabela "Resumo por conta" (`18104`) e o painel de
importação (oculto até clicar "📥 Importar Extrato OFX"). Fluxo do painel:

1. Escolher conta + arquivo `.ofx/.qfx` → **"Carregar e verificar"** (`carregarPreviewOFX`,
   `app.js:18152`) → `POST ofx-preview` (`handle_ofx_preview`, `api/index.php:7864-7931`).
2. A prévia (`renderizarPreviewOFX`, `app.js:18176+`) lista as transações com badges (novas /
   com match / sem match / já importadas) e, POR LINHA: checkbox de importação, botão
   **Conciliar** (quando há match — `conciliarTransacao`, `app.js:18260` → `POST ofx-conciliar`)
   e **Importar avulso** (`importarAvulso`, `app.js:18288` → `ofx-import` de 1 transação).
3. **"Importar selecionados"** (`confirmarImportacaoOFX`, `app.js:18323`) → `POST ofx-import`.
4. Histórico: `carregarHistoricoOFX` (`app.js:18353`) → `ofx-history` — só os CABEÇALHOS dos
   lotes (`ofx_imports`, 50 últimos, `api:8018-8029`). Nenhuma transação individual.

### 1.2 O match automático (`ofx_find_matches`, `api/index.php:7564-7614`)

**Regra:** valor **EXATO** (`amount = ?` sobre o valor absoluto) + `ABS(DATEDIFF(dueDate, data
da transação)) <= 5` (±5 dias sobre o **VENCIMENTO**, não sobre a data de pagamento) + status ≠
Cancelado + `ofxFitid IS NULL` (título ainda sem extrato vinculado). Top 5, confiança 100 −5/dia
além do 1º (`7596`), −20 se o título já foi baixado manualmente (`7597`), −15 se a conta bancária
diverge (`7598`). `autoMatch` quando ≥85 (`7915-7917`). **Quando roda: SÓ na prévia**
(`api:7914`). **É reaproveitável como está** — recebe um array de transação e devolve candidatos;
a tela de pendências pode chamá-la sem mudança.

**O que a conciliação faz ao casar** (`handle_ofx_conciliar`, `api/index.php:7621-7718`): baixa o
título (`status` + `paidDate`/`receivedDate` = data da transação — `7683`; título JÁ baixado
manualmente é apenas VINCULADO, sem mexer em status/data — `7680`), grava `ofxFitid` no título,
**cria um movimento de caixa** com `originDocument='OFX:<fitid>'` (`7687-7695`), registra o FITID
em `ofx_fitids` com o `cashMoveId` (`7698`) e audita com details legível (`7709-7710`). Tudo em
transação.

### 1.3 A prévia permite conciliar e pular? O que sobra vira o quê?

Sim: dá para conciliar linha a linha NA PRÉVIA e importar o resto. O que é importado sem
conciliar vira movimento de caixa **"solto"**: `originDocument='OFX'` fixo, `history` = memo do
banco, **sem** categoria, obra, referência ou vínculo com título (`handle_ofx_import`,
`api:7961-7989`). É exatamente o estado dos 245 movimentos medidos.

### 1.4 Existe listagem pós-upload? — NÃO no sentido pedido

O `ofx-history` lista lotes (cabeçalho). O módulo Caixa e Bancos genérico lista os movimentos —
mas sem noção de "pendente de conciliação", sem as sugestões de match e sem nenhuma ação de
vínculo. **E o caminho de volta está BLOQUEADO por design:** `handle_ofx_conciliar` responde
**409 "já foi importada ou conciliada"** para qualquer FITID presente em `ofx_fitids`
(`api:7652-7656`) — e a importação registra todos os FITIDs. Conciliar depois do upload é
impossível hoje.

→ **[distância]** o motor existe (parser ✓, dedupe ✓, match ✓, baixa ✓, auditoria ✓); falta a
porta de entrada tardia e uma variante do conciliar que NÃO crie movimento (ver §3.1).

---

## 2. Estrutura de dados

### 2.1 Como as três tabelas se ligam

```
ofx_imports   (api:7511-7524)  — cabeçalho do lote: conta, arquivo, período, contagens, quem/quando
ofx_fitids    (api:7500-7508)  — UMA linha por transação aceita: (fitid, bankAccountId) ÚNICO
                                 + cashMoveId → o movimento que ela virou  ← O ELO CENTRAL
cash_bank_movements            — o movimento É a transação materializada (não há registro separado)
```

A transação do extrato **é** o movimento de caixa depois de importada. `cash_bank_movements` não
tem coluna de FITID — mas **dá para saber de qual transação um movimento veio**: via
`ofx_fitids.cashMoveId` (JOIN), e o `originDocument` ajuda ('OFX' no import em lote,
`'OFX:<fitid>'` no conciliado da prévia — a inconsistência entre os dois formatos é um detalhe a
padronizar). Reimportação é evitada por `UNIQUE (fitid, bankAccountId)` + checagem no import
(`api:7983-7987`) + 409 no conciliar. 281 transações → 245 movimentos: a diferença são duplicatas
entre arquivos/meses e linhas desmarcadas (contadas em `skipped` no `ofx_imports`).

### 2.2 Vínculo nos títulos

`accounts_payable` E `accounts_receivable` têm **ambos** `ofxFitid` + `ofxImportId` (ensure
`api:7530-7538`; schema.sql idem). `ofxFitid` é preenchido pelo conciliar; **`ofxImportId` nunca
é preenchido por ninguém** (campo dormente — o mesmo padrão do `conta_receber_id` do marco). O 1
receivable com OFX que você mediu veio de uma conciliação feita na prévia.

### 2.3 O que falta de campo para as 4 partes — quase NADA (proposta mínima)

- **Vincular depois:** ZERO coluna nova — `ofxFitid` no título + `ofx_fitids.cashMoveId` já
  expressam o vínculo completo (título ↔ transação ↔ movimento).
- **Criar conta a partir da transação:** ZERO coluna nova — a conta nasce com `ofxFitid` (e, aí
  sim, `ofxImportId` de carona, ativando o campo dormente).
- **Marcar obra:** ZERO coluna nova — `projectId` já existe em `cash_bank_movements` (FK +
  índice) e nas contas. Falta só a UI escrever nele (no movimento E na conta).
- **Única gravação nova recomendada (não é coluna, é preenchimento):** o movimento vinculado a
  título deve ganhar `referencia_tipo='CONTA_PAGAR'` (ou `'CONTA_RECEBER'`) + `referencia_id` —
  é o que o dedup do sistema já entende (ver §3.1). Aditivo, sem migration.

---

## 3. Riscos e coerência

### 3.1 Dupla contagem — o risco é REAL e o conciliar atual JÁ o comete

O movimento criado pelo `handle_ofx_conciliar` nasce **sem** `referencia_tipo` (`api:7687-7695`).
O dedup do sistema depende exatamente disso: `realizedCost = contas pagas + saídas de caixa`
(`app.js:4070-4071`) **sem** filtro de referência; o extrato de centro de custo pula movimento
com `referencia_tipo='CONTA_PAGAR'` (`app.js:7179-7182`) e o fluxo manual de baixa via caixa
grava o par `CONTA_PAGAR`/`CAIXA_MANUAL` (`app.js:7200-7222`) justamente para isso. Resultado:
**título baixado por conciliação OFX conta DUAS vezes no custo realizado** (uma como conta paga,
outra como saída de caixa). Com 1 conciliação feita até hoje o estrago é ~zero, mas a frente
nova multiplicaria isso. **O conserto entra na frente:** conciliar/vincular/criar SEMPRE gravam
a referência no movimento (e o lado receber define `'CONTA_RECEBER'`, que hoje não existe em
lugar nenhum).

**Distinção crucial de desenho para a tela de pendências:** o conciliar da PRÉVIA cria o
movimento (a transação ainda não existe no caixa). O vincular TARDIO **não pode criar movimento**
— a transação JÁ é um movimento (via `ofx_fitids.cashMoveId`); ele deve apenas ligar o existente
(gravar `referencia_*` no movimento + `ofxFitid` no título + baixar o título). Reusar o handler
atual sem essa variante duplicaria o caixa.

Caso-limite adicional já existente: título baixado manualmente COM caixa manual vinculado
(`CAIXA_MANUAL`) que depois é conciliado na prévia → o conciliar cria um SEGUNDO movimento para
a mesma saída (`api:7678-7695` não checa `referencia_tipo` do título). A tela de pendências herda
o problema se reusar o handler — mais um motivo para a variante "vincular sem criar".

### 3.2 Interação com a baixa com acréscimos (v1.41.0)

O conciliar baixa por UPDATE direto (`api:7683`) — **não** passa pelo PUT genérico, logo não
passa por `aplicar_acrescimo_baixa`. Hoje isso é neutro porque o match exige valor IGUAL
(transação = título → sem acréscimo embutido detectável). Na frente nova:

- **Criar conta a partir da transação:** `amount = valor da transação`, `valor_original = NULL`,
  `juros_aplicado = NULL` — **não inventar** separação de juros que o banco não informa. Se o
  dono souber o acréscimo, edita a conta depois e o fluxo v1.41.0 assume (recalcula do original).
- **Vincular com diferença de valor** (transação > título, típico de boleto pago com juros): é a
  EXTENSÃO natural do match ("valor próximo", não só exato) e deve gravar
  `juros_aplicado = diferença` e `valor_original = valor do título` — de preferência baixando o
  título via PUT genérico (reusa `aplicar_acrescimo_baixa` + o diff de auditoria da v1.41.0 de
  graça, em vez de repetir a regra em SQL direto).

### 3.3 Desvincular — não existe; o que precisa acontecer

Nada no código desfaz um vínculo. O desfazer correto: limpar `ofxFitid`/`ofxImportId` do título;
se a baixa veio da conciliação (e não era `linkedOnly`), reabrir o título (`status` Aberto +
data de baixa NULL); limpar `referencia_*` do movimento. **O movimento NÃO é apagado** — a linha
do extrato é um fato bancário. Registrar no audit (o `details` da v1.41.0 já mostra o
antes→depois da reabertura). Tamanho P, mas é o seguro da frente inteira: errar vínculo sem
poder desfazer faria o dono voltar a não conciliar.

### 3.4 Volume e paginação

245 movimentos hoje, ~35/mês. A tela de pendências deve nascer com **endpoint dedicado e
paginado** (filtro por conta + período, `LIMIT/OFFSET` ou "carregar mais") — **não** entrar no
bootstrap (que já carrega tudo a cada login). Índices existentes bastam (`idx_ofx_account`,
`idx_cash_date`, `uk_fitid_account`); o match roda 1 consulta por linha ABERTA na tela (lazy, ao
expandir a linha — não para as 245 de uma vez).

---

## 4. Detector de possível duplicação (§5 do pedido)

**[existe hoje]** Dois moldes: o FITID (duplicidade EXATA de transação — `uk_fitid_account` +
409) e o `ofx_find_matches` (semelhança valor+data — **é exatamente o buscador de "títulos
parecidos"** que o detector precisa, invertendo o uso: em vez de sugerir match para conciliar,
avisa "já existe título parecido" antes de criar).

**Proposta (advisory, nunca bloqueia):**
- Função SQL `titulos_similares($pdo, $lado, $valor, $data, $parteId = null)`:
  base = valor exato + `ABS(DATEDIFF(dueDate, ?)) <= 5` (o mesmo ±5 do match). Classificação:
  base + **mesmo fornecedor/cliente** = **suspeita ALTA**; base + descrição parecida (prefixo
  normalizado do `document`/`history`) = **MÉDIA**; valor igual sozinho = **FRACA e não exibida
  por padrão** — as 48 parcelas de contrato do banco têm valor idêntico, e é o critério de DATA
  próxima que as separa (parcelas legítimas vencem ~30 dias entre si; só a parcela do MESMO mês
  colidiria, e aí fornecedor+valor+data é suspeita alta correta).
- **Comportamento:** no `POST` de payable/receivable (lançamento manual), no criar-a-partir-da-
  transação e no import de NFS-e (que também cria título), a resposta traz `similares[]`; o
  front mostra aviso com 3 saídas — **vincular ao encontrado / criar mesmo assim / cancelar**.
  O aviso usa o toast/confirm com severidade warning (E3). Nada é bloqueado.
- **Custo:** consulta única no banco por criação (não no front). Com 62 contas é nada; para
  milhares, índice aditivo `(amount, dueDate)` nos dois lados resolve — opcional e barato.

---

## 5. Contraponto e exemplo

### 5.1 O que eu faria diferente

1. **Obra opcional, nunca obrigatória.** Boa parte das 245 transações é despesa geral da
   empresa. Se a tela exigir obra, o dono para de conciliar de novo. Campo `projectId` visível
   com default vazio + botão explícito "sem obra". A meta é vínculo honesto, não vínculo total.
2. **Pendências é ABA própria, não painel do upload.** Conciliar depois é outra tarefa, com
   outro ritmo — e com endpoint paginado próprio, fora do bootstrap.
3. **O motor vem antes da tela** (ordem abaixo): a variante "vincular sem criar movimento" + a
   gravação de `referencia_*` são o que impede a tela de multiplicar a dupla contagem do §3.1.
   De carona, consertar o conciliar da prévia (mesmo furo).
4. **Não estender o match para "valor aproximado" na v1:** valor exato + vencimento ±5 já cobre
   o grosso; a variante com diferença-como-juros (§3.2) entra depois, reusando a v1.41.0 — senão
   o escopo dobra.

### 5.2 Quantas das 245 apareceriam na tela de pendências HOJE — consulta e número

```bash
mysql -u financeiro_app -h 127.0.0.1 financeiro -e "SELECT COUNT(*) AS pendentes FROM ofx_fitids f LEFT JOIN accounts_payable p ON p.ofxFitid = f.fitid LEFT JOIN accounts_receivable r ON r.ofxFitid = f.fitid WHERE p.id IS NULL AND r.id IS NULL AND f.cashMoveId IS NOT NULL"
```

**Número esperado: 244 de 245** (245 transações registradas com movimento; a sua medição achou
1 receivable com vínculo OFX; nenhum payable). Rode para cravar — se vier diferente, a diferença
são conciliações da prévia que criaram movimento sem eu ter contado.

### 5.3 Tamanho e ordem recomendada

| Parte | Conteúdo | Tamanho |
|---|---|---|
| **Motor de vínculo tardio** (parte 2 do pedido + fix §3.1) | endpoint `vincular` que NÃO cria movimento (usa `ofx_fitids.cashMoveId`), grava `referencia_*` no movimento, `ofxFitid`/`ofxImportId` no título, baixa via PUT genérico (reusa v1.41.0 + auditoria); conserta o conciliar da prévia; desvincular (§3.3) | **M** |
| **Tela de pendências** (parte 1) + **obra no ato** (parte 4) | aba na Conciliação, endpoint paginado (conta+período), reuso de `ofx_find_matches` por linha, ação Vincular com campo obra/categoria/centro | **M** |
| **Criar conta a partir da transação** (parte 3) | modal pré-preenchido (data/valor/tipo), nasce liquidada com `ofxFitid`+referência+obra; sem juros inventado (§3.2) | **M** |
| **Detector de duplicação** (§4) | `titulos_similares` + aviso 3-opções nos pontos de criação | **P/M** |

**Ordem:** motor → tela+obra → criar conta (com o detector embutido nela) → detector nos demais
pontos (lançamento manual, NFS-e). É UMA frente com 4 etapas de validação — cada uma entrega
algo usável, no padrão da casa.

**Ganho imediato mensurável:** com as duas primeiras etapas, os 244 pendentes viram fila de
trabalho com sugestão pronta — e cada vínculo/criação passa a preencher o `projectId` que hoje
está ZERADO nos 245, destravando o dashboard por obra (o mesmo buraco apontado nos diagnósticos
do Kanban e da integração financeiro↔cronograma).
