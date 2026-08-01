# Spec — Conciliação E3 (nova): fluxo de aprovação em Movimentações de caixa

> **Data:** 2026-08-01 · **Substitui** a E3 original (criar conta na aba Pendências — cancelada;
> ver Adendo 2 do diagnóstico `docs/revisao/2026-08-conciliacao-pendencias-diagnostico.md`).
> **Decisões do dono:** movimento importado nasce PENDENTE; aprovar exige categoria + centro de
> custo (obra OPCIONAL, disponível no ato); aprovar cria a conta JÁ LIQUIDADA com o vínculo da
> E1; lote com dados comuns; detector de similares antes de criar (nunca bloqueia; no lote,
> separa suspeitas); retroativo para os pendentes atuais EXCETO os já resolvidos (#4, #150).

## Objetivo

Transformar os ~243 movimentos de extrato sem classificação em contas a pagar/receber
classificadas (categoria, centro, obra opcional) — na tela de Movimentações de caixa, no ritmo
do dono, com lote para os repetidos ("dez tarifas → classifica uma vez → dez contas").

Fora de escopo: E4 (detector no lançamento manual e NFS-e); workflow multi-nível/permissão nova
(`canEditModule("cashMoves")` basta); mudanças no conciliar da prévia; tela nova (é a tela
existente + um painel).

## 1. O estado PENDENTE (zero ALTER — `status` é VARCHAR)

- **Valores novos:** `'Pendente'` e `'Dispensado'` (além do `'Confirmado'` default). Sem
  migration de schema.
- **Nasce Pendente:** SÓ a importação OFX (`handle_ofx_import` passa a gravar `'Pendente'`).
  Movimentos manuais e os criados por automação (conciliar da prévia, quitação antecipada,
  baixa via caixa vinculado) continuam nascendo `'Confirmado'` — quem digitou/automatizou já
  classificou.
- **CONFIRMADO POR VARREDURA:** nenhum cálculo do sistema filtra movimento por `status` (saldo
  por conta, `currentBalance`, fluxo de caixa, `realizedCost`, centro de custo, Lucro×Caixa).
  **Pendente/Dispensado contam no caixa normalmente** — o pendente é sobre CLASSIFICAÇÃO, não
  sobre existência do dinheiro. Zero mudança de número em qualquer dashboard.
- **Transições:**
  - Pendente → **Aprovar** → Confirmado + referência (cria a conta; §2)
  - Pendente → **Dispensar** → Dispensado (sai das filas; NÃO cria título; ex.: transferência
    entre contas próprias) — **reversível**: Dispensado → **Reativar** → Pendente
  - Pendente → **vinculado pela E2/E1** → Confirmado (o UPDATE do movimento no `ofx-vincular`
    ganha `status='Confirmado'` de carona — sai da fila do Caixa)
  - Confirmado nunca regride por esta frente.

## 2. Aprovar (individual)

- **Na linha** (`extraRowActions("cashMoves", row)` — mesmo gancho de Pedidos/Propostas):
  status `Pendente` → botões **Aprovar** e **Dispensar** + o badge de status que a tabela já
  mostra; `Dispensado` → botão **Reativar**.
- **Modal de aprovação:** categoria financeira* e centro de custo* OBRIGATÓRIOS; obra OPCIONAL
  (select com vazio válido); fornecedor (Saída) / cliente (Entrada) **OPCIONAL** (ver
  contraponto §9.1); mostra data/valor/histórico do movimento (com `moneySpan`).
- **Endpoint `POST cash-move-aprovar`** `{cashMoveId, categoryId*, costCenterId*, projectId?,
  parteId?, forcar?}`:
  1. Valida: movimento existe, `status='Pendente'`, e **movimento livre** (REUSO de
     `ofx_movimento_livre` — referência viva de título recusa com o mesmo 409 da E1).
  2. **Detector (§4) antes de criar** — havendo similares e sem `forcar:true`, responde a lista
     SEM criar (o front abre as 3 saídas).
  3. Criação (UMA transação): título no lado do tipo (Entrada→`accounts_receivable`,
     Saída→`accounts_payable`) com `document='MOV-<cashMoveId>'`, `issueDate`/`dueDate`/
     `paidDate|receivedDate` = data do movimento, `amount` = valor, status `Pago|Recebido`,
     `bankAccount` do movimento, categoria/centro/obra/parte do payload,
     **`valor_original`/`juros_aplicado` NULOS** (o banco não separa juros — edição posterior
     ativa o fluxo v1.41.0), **`ofxFitid`** quando o movimento tem FITID (lookup numérico
     `ofx_fitids.cashMoveId`); movimento recebe `referencia_tipo/referencia_id` + a MESMA
     classificação (categoria/centro/obra) + `status='Confirmado'`. É o dedup da E1: a conta
     entra no `paidExpenses` e a saída sai do `saidasCaixaSemTitulo` — custo realizado conta 1x.
  4. Auditoria com details (antes→depois do movimento + "conta MOV-x criada").

## 2-B. Edição depois de aprovado (revisão do dono, 2026-08-02)

**Princípio: o FATO é do banco; a CLASSIFICAÇÃO é do par.**

- **Fato travado (valor, data, tipo):** com o movimento aprovado/vinculado, o PUT genérico
  RECUSA mudança nesses campos com 422 amigável ("valor/data/tipo vêm do extrato — desfaça a
  aprovação para corrigir"). **Refino além do pedido:** movimento de EXTRATO (`originDocument`
  OFX) tem fato imutável SEMPRE, até pendente — a linha do banco não é editável por natureza;
  editá-la hoje é porta de divergência silenciosa com o extrato. Movimento MANUAL segue editável
  enquanto não vinculado.
- **Classificação propaga NOS DOIS SENTIDOS:** categoria/centro/obra editados no MOVIMENTO
  aprovado propagam para o título; editados no TÍTULO vinculado propagam para o movimento
  (espelho por SQL direto no hook do PUT — sem loop). Um par, uma classificação.
- **Juros no título vinculado = DECOMPOSIÇÃO, não soma.** O `amount` de título com `ofxFitid` é
  o TOTAL que saiu/entrou no banco — fato travado. Informar acréscimo nesse título NÃO soma
  (somaria e divergiria do extrato): decompõe — `valor_original = amount − juros_aplicado`,
  `amount` intacto. É um ramo novo na `aplicar_acrescimo_baixa` (v1.41.0), detectado por
  `ofxFitid` preenchido, com teste próprio. **Resposta à pergunta "o movimento precisa saber?":
  NÃO** — o total não muda; o juros explica a composição; a auditoria registra.
- **Desfazer aprovação (`cash-move-desaprovar`):** apaga o título `MOV-<id>` criado (dado
  derivado do movimento), movimento volta a Pendente sem referência. **Guardas:** só título
  nascido da aprovação (referência casada), e RECUSA se o título ganhou vida própria — NF
  vinculada (`fiscal_documents.payableId/receivableId`) ou acréscimo lançado → 409 orientando
  tratar no título primeiro. Auditoria com o estado apagado nos details.

## 2-C. Visibilidade do aprovado (revisão do dono, 2026-08-02)

- **Status `'Aprovado'`** no movimento — nos DOIS caminhos que ligam movimento a título
  (aprovar do Caixa E vincular tardio da E2): um único estado "resolvido com título". Badge
  verde na linha (o `formatCell` de status ganha 'Aprovado' na lista de sucesso). `Confirmado`
  fica para manuais/automações/legado.
- **Filtro na tela do Caixa:** chips `Todos · Pendentes (N) · Aprovados (N) · Dispensados (N)`
  (filtro client-side sobre as linhas já carregadas).
- **Link para o título:** linha aprovada ganha **"Ver conta"** (`extraRowActions`) — abre o
  formulário do título direto (`openForm(payable|receivable, referencia_id)` — o dialog é
  global, funciona de qualquer tela). E o botão **Desaprovar** (com as guardas do §2-B).
- **Dispensado:** badge visível, entra no chip de filtro, e o **Reativar é pela tela** (botão na
  linha — já estava no desenho; confirmado).

## 3. Aprovação em LOTE

- **Painel** `cashPendentesPanelHtml(rows)` acima da tabela do Caixa (precedente:
  `payableGroupsPanelHtml` no mesmo `renderCrud`): "Pendentes de classificação (N)" com lista
  compacta (checkbox · data · histórico · valor), campos comuns (categoria*, centro*, parte?,
  obra?) e **"Aprovar selecionados (N)"**.
- **REGRA: lote de UM lado só** (Entrada XOR Saída) — fornecedor e cliente não se misturam;
  front valida ao marcar, backend revalida.
- **Endpoint `POST cash-move-aprovar-lote`** `{itens: [ids], dados: {categoryId*, costCenterId*,
  parteId?, projectId?}}` (máx 50/chamada; front fatia): por item, DETECTOR primeiro —
  **suspeita NÃO cria** e volta em `suspeitas[]` (com os similares) para tratamento individual;
  limpa cria na PRÓPRIA transação (falha individual não derruba — padrão E2). Resposta:
  `{criadas, suspeitas: [{cashMoveId, similares}], falhas: [{cashMoveId, motivo}]}`. Cada conta
  nasce com seu valor/data/histórico próprios; só a classificação é comum.

## 4. Detector de similares (§5 do diagnóstico — nunca bloqueia)

- **SQL fino + classificação pura.** Candidatos: mesmo lado, **valor EXATO**,
  `ABS(DATEDIFF(dueDate, data do movimento)) <= 5`, status ≠ Cancelado, sem `ofxFitid` (máx 5,
  consulta indexada por parâmetro). Valor igual SEM data próxima não conta (as 48 parcelas de
  contrato são o falso positivo clássico).
- **`titulos_similares_classificar(array $candidatos, $parteId): array`** (pura, testável):
  candidato com a MESMA parte (fornecedor/cliente do payload) → suspeita **ALTA**; demais →
  **MÉDIA**; ordena alta primeiro.
- **UX das 3 saídas** (modal individual): **Vincular ao encontrado** (chama o `ofx-vincular` da
  E1 — o movimento tem FITID; os ~243 têm) / **Criar mesmo assim** (`forcar: true`) /
  **Cancelar**. No lote não há diálogo: suspeitas são SEPARADAS e ficam na fila com aviso.

## 5. Retroativo (mudança de DADO — executada pelo dono, com backup; NUNCA automática)

`migrations/2026-08-01-caixa-pendente-retroativo.sql` (rodar UMA vez, após backup validado):

```sql
-- E3: movimentos de EXTRATO ainda não classificados entram na fila como Pendentes.
-- Exclui os já resolvidos por referência viva (hoje: #4 CONTA_PAGAR→1, #150 CONTA_RECEBER→9).
UPDATE cash_bank_movements m
   SET m.status = 'Pendente'
 WHERE m.originDocument LIKE 'OFX%'
   AND m.status = 'Confirmado'
   AND NOT (m.referencia_tipo = 'CONTA_PAGAR' AND EXISTS (SELECT 1 FROM accounts_payable p WHERE p.id = m.referencia_id))
   AND NOT (m.referencia_tipo = 'CONTA_RECEBER' AND EXISTS (SELECT 1 FROM accounts_receivable r WHERE r.id = m.referencia_id));
```

**Esperado: ≈243 linhas.** NÃO entra em `ensure_*` (auto-cura é para schema; mudança de dado é
decisão executada uma vez). O `ensure_*` não reverte nada se a migration não rodar — o fluxo
simplesmente não tem pendentes retroativos até rodar.

## 6. Interação com a aba Pendências da Conciliação (E2)

As duas telas olham o mesmo dado por ângulos COMPLEMENTARES: **E2 = casar com título que JÁ
EXISTE** (fila por match); **Caixa = classificar e CRIAR o que não existe**. Anti-duplicidade:

- Aprovado no Caixa → referência viva no movimento → **some da E2** (exclusão que já existe).
- Vinculado na E2 → `status='Confirmado'` de carona → **some da fila do Caixa**.
- **Dispensado → some das DUAS** (a query da E2 ganha `AND m.status <> 'Dispensado'`).
- Corrida entre duas abas abertas: as guardas da E1 (`ofx_movimento_livre`, pré-check de fitid,
  UNIQUE) respondem 409 amigável para o segundo clique — sem duplicidade possível.
- O bucket "sem título" da E2 troca o texto por um aviso apontando o Caixa ("classifique e crie
  em Movimentações de caixa") — a E2 não ganha criação própria.

## 7. Testes

- `scripts/tests/php/test_cash_aprovar_plano.php`: função pura nova
  **`cash_move_aprovar_plano(array $movimento, array $payload): array`** (decide
  recusar/criar: não-Pendente recusa; categoria/centro ausentes recusam; lado pelo tipo;
  Transferência recusa com mensagem própria; monta os campos do título e do UPDATE do movimento
  — datas/valor/status/document; valor_original/juros nulos; mensagens sem SQL).
- `scripts/tests/php/test_titulos_similares.php`: `titulos_similares_classificar` — mesma parte
  → alta; sem parte → média; ordenação alta primeiro; vazio → vazio.
- Front sem teste novo (padrão E2); guardas de privacidade/toast/alert continuam valendo.

## 8. Versão, deploy e validação

- `v1.44.0`; `?v=` 1813→1814; changelog nos 3 docs; **RODAR a migration retroativa** (com
  backup) após o deploy.
- **Roteiro:** (1) rodar o retroativo → fila "Pendentes (≈243)" no Caixa, #4 e #150 fora;
  (2) aprovar UMA tarifa com categoria+centro → conta Pago criada com `MOV-<id>`, movimento
  Confirmado com referência, custo realizado conta 1x; (3) lote de 5 tarifas iguais →
  classificar uma vez, 5 contas; (4) aprovar uma com título parecido existente → detector abre
  as 3 saídas; vincular ao encontrado → baixa via E1; (5) dispensar uma transferência própria →
  sai das filas do Caixa E da E2, saldo intacto; reativar → volta; (6) obra marcada numa
  aprovação → valor classificado no dashboard por obra; (7) auditoria com antes→depois.

## 9. CONTRAPONTO — o que eu faria diferente do enunciado (explícito, como pedido)

1. **Fornecedor/cliente NÃO deve ser obrigatório.** O enunciado lista categoria+centro como
   obrigatórios e cita fornecedor/cliente como "o que o dono classificou" — mantive OPCIONAL de
   propósito: obrigar criaria cadastros-lixo ("Banco XYZ Tarifas") só para aprovar tarifa. O
   detector fica mais fraco sem parte (só suspeita média) — troca consciente.
2. **Lote de um lado só** (não estava no enunciado): misturar Entrada+Saída num lote com o mesmo
   `parteId` faria fornecedor virar cliente. Validação dupla (front+back).
3. **Retroativo manual, nunca no deploy/ensure**: é mudança de DADO em 243 linhas — backup +
   execução sua, uma vez, com contagem esperada. Automatizar isso no bootstrap violaria a regra
   da casa.
4. **Dispensado continua existindo** (no saldo e na tabela) — só sai das FILAS. Não é exclusão:
   transferência própria é dinheiro real que se moveu. E é reversível.
5. **`document='MOV-<id>'`** no título criado — rastreável e honesto; não inventar número de
   nota que não existe.
6. **O que NÃO vale fazer agora:** aprovação multi-nível/perfis (o dono é o aprovador);
   detector no lançamento manual e NFS-e (é a E4, e o molde sai pronto daqui); qualquer coluna
   nova (o VARCHAR de status + campos existentes cobrem tudo — zero ALTER de schema).
7. **(Rev. 2026-08-02) Fato do EXTRATO imutável sempre, não só quando aprovado** — fui além do
   proposto: a linha do banco não deveria ser editável nem pendente (é a fonte da conciliação).
   Se você discordar, o travamento volta a valer só para aprovados — 1 condição a menos.
8. **(Rev. 2026-08-02) Juros em título vinculado DECOMPÕE em vez de somar** — o total é fato
   bancário; somar (regra v1.41.0 padrão) divergiria do extrato. Título sem vínculo de extrato
   continua no fluxo v1.41.0 normal.
9. **(Rev. 2026-08-02) `'Aprovado'` também no vincular da E2** — um estado só para "resolvido
   com título"; dois nomes para a mesma coisa seria confusão de filtro.
10. **(Rev. 2026-08-02) Desaprovar APAGA o título MOV-<id>** (dado derivado), mas RECUSA se ele
    ganhou vida própria (NF/juros) — apagar dado enriquecido seria destrutivo demais.
