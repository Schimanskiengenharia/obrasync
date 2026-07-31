# Diagnóstico — Cronograma: gráfico financeiro por obra + marcos no Gantt

> **Data:** 2026-07-31 · **Base de código:** v1.40.0 (commit `1b846e2`) · **Método:** leitura de
> código, SÓ LEITURA. Sem acesso ao banco daqui (regra do ambiente local): schema conferido por
> `schema.sql` + migrations + `ensure_*`; os únicos dados de produção citados vêm da **medição de
> 2026-07-29** (`docs/revisao/2026-07-kanban-integracao-atual.md` §6). Consultas prontas para
> rodar no servidor estão na Parte D.
>
> **Aviso de contexto:** frentes novas estão CONGELADAS por decisão do dono (2026-07-29). Este
> diagnóstico é insumo de avaliação, não abertura de frente. O item **G8** da Onda B (backlog
> aprovado) toca o mesmo terreno dos marcos — ver §11 e §13.
>
> **ADENDO 2026-07-31:** as consultas da Parte D **foram rodadas em produção** — resultados e
> ordem FINAL no adendo ao fim do documento. Pela medição, **nenhuma das três frentes entra
> agora**; a "Ordem sugerida" original ficou mantida como registro pré-medição.

---

## PARTE A — O Gantt e os marcos hoje

### 1. Como o Gantt é renderizado

**[existe hoje]** `ganttChart(rows)` em `app.js:10497-10539`, chamado por `renderProjectSchedule()`
(`app.js:10403`, módulo `projectSchedule`). **Não é SVG, não é canvas, não é biblioteca**: é
HTML/CSS puro — cada etapa vira um par `.gantt-label` + `.gantt-track` (`div`), e as barras são
`<span>` com `position:absolute` e `left/width` em **porcentagem de dias** sobre o intervalo
min–max das datas (`app.js:10506-10511`). CSS em `styles.css:2706-2807`:

- `.planned-bar` (dourado translúcido, `top:15px`) e `.actual-bar` (`var(--accent)`, `top:31px`) — duas linhas por track;
- `.today-line` (vermelha, `styles.css:2788`) posicionada pela data de hoje;
- `.milestone-dot` (bolinha dourada, `styles.css:2797`) para etapa com `isMilestone='Sim'` —
  **detalhe importante: fica em `right:10px` FIXO do track (`app.js:10531`), não na data do marco**.

A barra "Realizado" sem `actualEndDate` estica até hoje (`app.js:10530`). Grade de fundo é um
gradient de 12 colunas fixas (`styles.css:2754`), sem rótulos de datas no eixo.

→ **[distância]** para pôr um losango numa DATA da linha: o mecanismo de `left%` já existe nas
barras — é a mesma conta. → **[reuso]** `bar()`/`daysBetween`/`hojeLocal`. → **[o que falta]**
posicionamento por data do `milestone-dot` (hoje é decorativo) e qualquer noção de cor por estado.
→ **[tamanho]** P para um marcador posicionado. → **[riscos]** nenhum técnico; só visual (ver §13).

### 2. `obra_cronograma_etapas` — campos, estados, alimentação e gate

**[existe hoje]** `schema.sql:186-220` (sem DESCRIBE local; schema + migrations são a fonte):

| Grupo | Campos |
|---|---|
| Identificação | `id`, `projectId` (FK CASCADE), `stageName`, `description`, `sortOrder`, `responsible`, `notes` |
| Datas **planejadas** | `plannedStartDate`, `plannedEndDate` |
| Datas **reais** | `actualStartDate`, `actualEndDate` |
| Físico | `plannedPhysicalPercent`, `actualPhysicalPercent` (DECIMAL 9,4) |
| Financeiro | `plannedFinancialAmount`, `actualFinancialAmount` (DECIMAL 15,2) |
| Vínculos | `workBudgetId`, `workBudgetItemId` (migration 2026-06-08), `predecessorIds`, `durationDays` |
| Marco embutido | `isMilestone` ENUM('Não','Sim'), `milestoneName`, `milestoneMessage`, `visibleToClient` |
| Qualidade | `servicoSiacId`, `fvsId`, `qualidadeBloqueada` (migration 2026-06-27 pbqph-fase0; ensure em `api/index.php:6985-6986`) |
| Status | ENUM **6 estados** (`schema.sql:204`): `Não iniciada`, `Em andamento`, `Concluída`, `Atrasada`, `Pausada`, `Cancelada` |

**Alimentação dos percentuais/valores: 100% manual.** O CRUD genérico (`resource_map`
`'projectSchedule'`, `api/index.php:1908`) é o único escritor; nenhuma automação grava
`actualPhysicalPercent`/`actualFinancialAmount` (grep no `api/index.php`: só o resource_map e uma
LEITURA no fluxo de WhatsApp, `api/index.php:14149`). A aba Execução do orçamento alimenta
`orcamento_obra_itens.quantidade_realizada` — **não** o cronograma. Import de XML do MS Project
também grava etapas (`importMsProjectXml`, `app.js:10457`).

**Gate FVS (PBQP-H):** `qualidade_bloqueio_etapa($pdo, $etapaId, $payload)` em
`api/index.php:7101-7135`, chamado no PUT do CRUD (`api/index.php:698`) — bloqueia conclusão com
FVS não aprovada/NC aberta (`qualidade_nc` com `status <> 'Fechada'`, `api/index.php:7126`);
`qualidadeBloqueada` é setada por NC automática (`api/index.php:7093`) e limpa em `7132`.

**Atraso é DERIVADO, não só gravado:** `scheduleMetrics` (`app.js:3985-3989`) considera atrasada a
etapa com status contendo "atras" **OU** `plannedEndDate < hoje` sem `actualEndDate` e não
Concluída. O estado `Atrasada` do enum é redundante com essa regra (dois caminhos para o mesmo fato).

### 3. `obra_cronograma_marcos` e `obra_marcos_padrao` — órfãs?

**`obra_cronograma_marcos` (schema.sql:222-239): VIVA, não órfã.**
- É o módulo **"Marcos da obra"** na sidebar (seção Planejamento, `app.js:250`, `316`), CRUD
  genérico completo (resource `projectMilestones` → REST `marcos-obras`, `api/index.php:1909`;
  configs `app.js:1128`).
- **Automação em produção:** mudar o status para Concluído/Aprovado dispara
  `automate_approved_milestone` (`api/index.php:2199-2200`, função em `14117+`) — cria/atualiza
  **conta a RECEBER** com `referencia_tipo='MARCO'`, em transação com rollback e log de evento
  (`api/index.php:2186-2224`). É o "evento de cobrança" citado pelo G8.
- Alimenta o KPI "Próximo marco" do cronograma e do dashboard: `scheduleMetrics` mistura
  `db.projectMilestones` + etapas `isMilestone='Sim'` (`app.js:3993-4010`; exibição `10434`, `4719`).
- **Mas NÃO aparece no Gantt**: `ganttChart` só desenha o `milestone-dot` de etapa `isMilestone`
  (`app.js:10531`); os registros de `obra_cronograma_marcos` não são plotados.

**`obra_marcos_padrao` (schema.sql:943; migration 2026-06-08): SEMI-ÓRFÃ.** Tem tela de CRUD em
Configurações ("Marcos padrão", `app.js:282`, `327`, configs `1577`; resource `standardMilestones`,
`api/index.php:1891`) — mas **nenhum fluxo consome**: não há cópia automática para a obra nem uso
em automação (grep em `api/index.php` e `app.js`: só resource + tela). Mesmo padrão de
`tipos_documento`/`tipos_medicao`: cadastrável, inerte.

**Registros existentes: não verificável daqui.** Consulta pronta na Parte D (D-4).

### 4. Indicação visual de atraso no Gantt hoje

**Só TEXTO, nenhuma cor/badge/ícone.** No Gantt: "• N dia(s) de atraso" em `<small>` no
`.gantt-label` (`app.js:10521`, `10525`). Fora do Gantt: cartões de etapa mostram "Atraso: N
dia(s)" (`app.js:10473`, `10488`); KPI "Etapas atrasadas" com tom `negative` no dashboard
(`app.js:4718`, corrigido na v1.39.1); alertas (`app.js:5135`, `10447`). **As barras do Gantt têm
cor fixa** (dourado/azul) independentemente de atraso — o único vermelho do Gantt é a `today-line`.

### 5. Popup de legenda reusável

**Não existe popup de legenda em nenhuma tela.** O que existe de mais próximo:
- `chartLegend(series)` (`app.js:5418-5420`) — legenda **inline** sob cada gráfico
  (`.chart-legend`), usada por todos os lineChart/groupedBarChart. É o padrão do sistema.
- O Gantt usa o subtítulo do painel como "legenda" (`app.js:10516`).
- Padrão genérico de dialog: `<dialog>` + `showModal()` (ex.: `favoritesDialog` `app.js:19293`;
  `viabilidadeDialog` foi reusado pelo modal da IA — precedente de reuso).

→ Um "botão de legenda com popup" seria **padrão novo** no sistema; a legenda inline
(`chartLegend`) é o molde existente. Ver contraponto em §13.

---

## PARTE B — O gráfico financeiro

### 6. Fluxo de caixa global: como é e se filtra por obra

**[existe hoje]** `renderCashFlow()` (`app.js:17916-17935`, módulo `cashFlow`) → `lineChart()`
(`app.js:5312-5360`) — **SVG feito à mão** (viewBox 760×180, polylines, sem biblioteca), com 5
séries (entradas/saídas previstas e realizadas + saldo final). Dados: `monthlyCashFlowRows()`
(`app.js:4225-4238`) sobre `collectMonths()` (`app.js:4214`, janela FIXA ±6 meses —
`CASHFLOW_MONTHS_BACK/FORWARD`, `app.js:4208-4209`; o **FIN3 da Onda B** vai mexer exatamente aqui).

**Filtro por obra: existe, mas por efeito colateral — não por seletor próprio.**
`monthlyCashFlowRows` usa `dashboardRows()` (`app.js:3964-3968`), que aplica `applyFilters` com
`ignoreProject: dashboardViewMode === "general"` + recorte por `dashboardProjectId` quando o
dashboard está em modo "por obra". Como `dashboardViewMode` nasce `"general"` (`app.js:604`):
- com o dashboard no modo geral (default), o módulo Fluxo de Caixa **ignora o filtro global de obra**;
- se o usuário deixou o dashboard em "por obra", esse recorte **vaza** para o módulo Fluxo de Caixa.

**Caveat do saldo:** `saldoFinal` acumula a partir de `bankOpeningBalance()` — soma dos saldos
iniciais de TODAS as contas bancárias (`app.js:4190-4192`, uso em `4226`). Ou seja, mesmo
"filtrado" por obra, o saldo parte de uma base global. **Uma curva por obra não pode reusar essa
função como está** — teria de começar em zero.

### 7. O que a visão "por obra" do dashboard já tem de gráfico financeiro

**[existe hoje]** O branch `project ?` de `renderDashboardBody` (`app.js:4754-4785`) monta **7
gráficos, todos já recortados pela obra** via `dashboardRows`: Receita×custo; Previsto×realizado;
Despesas por categoria; Contas a pagar por vencimento; A receber por status; Lucro previsto×
realizado; **"Evolução financeira mensal"** (lineChart de receita/despesa/resultado por mês,
`app.js:4780-4784`); Distribuição de custos. Além do **painel Lucro Gerencial × Caixa Real**
(v1.37) e dos widgets de execução.

**O achado central deste diagnóstico:** o painel Lucro×Caixa já tem
`lucroCaixaChart(projectId, mode)` com **modo "acumulado"** (`lucroCaixaEvolutionRows`,
`app.js:4517-4526`): a série **"caixa" acumulada é exatamente a curva de saldo de caixa da obra**
(entradas realizadas − saídas realizadas, mês a mês, acumulando de zero dentro do período dos
filtros, com recorte dimensional próprio por obra/cliente/centro — `lucroCaixaMonthlyRows`,
`app.js:4493`). **A ideia (a) já existe ~90%** — o que não existe é a pintura verde/vermelho por
sinal e o destaque da linha do zero. A curva com "Saldo final" da visão GERAL (`app.js:4787-4793`)
não aparece na visão por obra — e não deveria ser portada como está, pelo caveat do §6.

### 8. Fontes de dados para uma curva de saldo acumulado POR OBRA

| Fonte | Vínculo à obra | PREVISTO | REALIZADO |
|---|---|---|---|
| `accounts_receivable` (`schema.sql:686-706`) | `projectId` FK | `dueDate` + `amount` (status ≠ Cancelado) | `receivedDate` + `amount` |
| `accounts_payable` (mesma estrutura, `schema.sql` bloco anterior) | `projectId` FK | `dueDate` + `amount` | `paidDate` + `amount` |
| `cash_bank_movements` (`schema.sql:784-802`) | **`projectId` existe e é utilizável** (FK + índice `idx_cash_project`) | — (caixa é sempre realizado) | `date` + `amount` por `type` Entrada/Saída |

Regras já consolidadas no sistema (v1.37, painel Lucro×Caixa — reusar, não recriar):
cancelados fora; `Parcial` integralmente em aberto; helpers case-insensitive
(`isRecebido`/`isPago`); `isOverdue` em `app.js:4182-4188`; anti dupla contagem
caixa↔conta a pagar via `referencia_tipo='CONTA_PAGAR'` (`schema.sql:796-797`) — se somar caixa E
contas pagas, é preciso deduplicar pela referência, como o Lucro×Caixa já faz.

**Caveat de DADOS (medição de produção 2026-07-29):** 98,4% das contas a pagar não têm nenhuma
referência e a **obra 7 (Asilo) não tem NENHUMA conta a pagar vinculada** (`projectId`) — o lado
de saídas de uma curva por obra sairia **R$ 0, plano**, hoje. Entradas e caixa por obra não foram
medidos (consultas D-1/D-2).

### 9. Modo privacidade num gráfico novo

**Regra dos 3 helpers** (guarda: `scripts/tests/js/test_privacy_coverage.js`, cabeçalho):
`moneySpan()` só em HTML de tela; `maskMoneyText()` em textContent/atributo/`<option>`/título SVG;
`asMoney()` cru só em documento/export.

**Nos gráficos, o padrão já vem de fábrica nos motores:** `lineChart` aplica `money-blur` nos
rótulos do eixo Y (`app.js:5328`) e `maskMoneyText` nos `<title>` dos pontos (`5334`) e nos
tooltips combinados de coluna (`5344`). **Um gráfico novo que REUSE `lineChart`/`groupedBarChart`/
`horizontalBarChart` nasce conforme sem nenhum esforço.** Se fizer SVG próprio: eixo com
`<text class="chart-axis money-blur">` e tooltip via `maskMoneyText` — na mão.

**O teste-guarda NÃO quebraria com um gráfico novo** que esqueça a privacidade do eixo: ele varre
padrões proibidos (moneySpan em textContent/atributo/`escapeHtml`/`<option>`; moneySpan em gerador
de documento; `.catch` vazio) — pega os erros clássicos, **não garante cobertura de eixo novo**.
Erro que ELE pegaria: `svgText(moneySpan(...))` num título de SVG. Conclusão: reusar os motores =
conformidade automática; SVG próprio = revisão manual obrigatória.

---

## PARTE C — Reuso, risco e contraponto

### 10. Molde de status DERIVADO para a cor do marco

Dois moldes vivos:
- **`isOverdue(row, type)`** (`app.js:4182-4188`) — financeiro; compara `dueDate < hojeLocal()`
  por STRING (regra M10) e checa quitação. Binário.
- **`rhDocSituacao(doc)`** (`app.js:16236-16244`) — devolve `{key, dias}` com 3+ estados
  (`vencido`/`atencao`/`ok`), e `rhDocBadge` (`16247-16252`) mapeia para as classes `q-badge
  q-ruim/q-atencao/q-ok`. **É o molde certo** para "azul planejado / verde cumprido / vermelho
  vencido": função pura → key → classe, sem gravar nada no banco.

Complemento obrigatório: a regra de atraso de ETAPA já existe em `scheduleMetrics.delayedRows`
(`app.js:3985-3989`). Qualquer cor de marco/etapa derivada deve **reusar essa mesma regra** (ou
extraí-la para helper), senão nascem dois conceitos de "atrasada" que divergem.

### 11. O que as duas ideias DUPLICARIAM

**(a) Curva de saldo acumulado por obra:**
- `lucroCaixaChart(projectId, "acumulado")` — a série de caixa acumulado **já é essa curva**
  (§7). Duplicação quase total; a novidade real é cosmética (cor por sinal, linha do zero).
- "Evolução financeira mensal" da visão por obra (`app.js:4780`) — mesmo eixo tempo×R$, sem acumular.
- KPI "Saldo financeiro da obra" do cronograma (`app.js:4011-4012`, exibido em `10443`) — o número
  final da mesma curva, calculado como recebido − realizado das etapas.
- Fluxo de caixa da visão geral (`app.js:4787-4793`) — a linha "Saldo final" acumulada já existe lá.

**(b) Marcos derivados por etapa:**
- `milestone-dot` já é um marco visual por etapa **opt-in** (`isMilestone='Sim'`, `app.js:10531`).
- `obra_cronograma_marcos` já é o marco "de verdade" com data planejada/concluída, status próprio e
  automação de cobrança (§3) — e há o **G8 aprovado na Onda B** (estudo, linhas 254 e 811):
  "integrar os marcos REAIS de projectMilestones à linha do tempo (losango + evento de cobrança)".
  Marcos derivados de TODA etapa criariam um **terceiro** conceito de marco no mesmo Gantt,
  concorrendo com os dois que existem e com um item de backlog já aprovado.

### 12. Risco de desempenho

**Baixo, e sem endpoint novo.** Tudo que as duas ideias precisam já chega no bootstrap
(`bootstrap_data`, `api/index.php:2571`, devolve todas as coleções do `resource_map` — o
front já lê `db.projectSchedule`, `db.projectMilestones`, `db.receivable`, `db.payable`,
`db.cashMoves`). O molde v1.37 ("usa as coleções já carregadas pelo bootstrap") vale aqui.

Volumes: um cronograma tem dezenas de etapas (o gráfico é linear nas etapas); o financeiro de
produção INTEIRO tinha 62 contas a pagar em 2026-07-29 — uma curva mensal por obra é uma varredura
linear de coleções já em memória, mesma ordem dos ~15 gráficos que o dashboard já monta por
render. Contagem exata de etapas/lançamentos do Asilo: não verificável daqui (consulta D-3).
Único anti-padrão a evitar: refiltrar a coleção inteira dentro de laço (o O(n²) do §0.2 item 4 do
STATUS.md).

### 13. CONTRAPONTO — o que eu NÃO faria como descrito

**(a) Curva de saldo por obra — discordo de construir gráfico novo; o caminho é promover o que existe.**
1. A curva pedida **já existe** no Lucro×Caixa acumulado por obra (§7). Construir outra ao lado
   criaria DOIS saldos acumulados com regras ligeiramente diferentes na mesma tela — o tipo de
   divergência que vira chamado de "número não bate".
2. **Verde acima de zero / vermelho abaixo numa MESMA linha**: num `<polyline>` isso exige
   segmentar o path no cruzamento do zero (interpolar o ponto de troca). Custo desproporcional para
   ganho puramente cosmético — e o `lineChart` é compartilhado por 10+ telas; mexer nele por isso é
   risco espalhado. Alternativas baratas e no padrão do sistema: linha do zero destacada
   (1 `<line>` com classe própria) + tom do número no card ao lado (`kpiToneNumero`, v1.39.1, já
   pinta negativo de vermelho). Se a cor na linha for inegociável, duas séries (positiva/negativa)
   é o truque barato — mas aí a legenda mente ("duas" linhas).
3. **O dado real de hoje faria o gráfico mentir:** com 98,4% das contas sem vínculo e a obra 7 sem
   nenhuma conta a pagar vinculada, a curva por obra nasce plana em zero — o mesmo fenômeno do card
   "Custo realizado R$ 0,00" (§6.6 do relatório do Kanban). O gargalo não é falta de gráfico, é
   falta de `projectId` nos lançamentos — que só o USO resolve (coerente com o congelamento).
   Minha sugestão: antes de qualquer tela, rodar D-1/D-2 e decidir com o resultado na mão.

**(b) Marcos derivados por etapa — discordo do desenho; o problema real é outro.**
1. Derivar marco inicial E final de TODA etapa dobra os símbolos no track (2×N losangos) para
   repetir informação que as barras já dão — início e fim JÁ SÃO as extremidades das barras. Marco
   tem valor quando é ESCOLHA (etapa-chave, evento de cobrança) — e isso já existe duas vezes:
   `isMilestone` opt-in e `obra_cronograma_marcos` com automação (§3, §11).
2. **O que falta de verdade no Gantt não é marco — é COR DE ATRASO.** A regra `delayedRows` existe
   (§10) e hoje vira só texto pequeno (§4). Pintar a barra (ou o track) da etapa atrasada é
   1 classe CSS + 1 condição, resolve a dor ("ver atraso de longe") sem novo conceito.
3. Contra-proposta em ordem de valor: (i) cor de atraso nas barras usando `delayedRows`;
   (ii) corrigir o `milestone-dot` para a DATA do marco (hoje `right:10px` fixo — quase um bug
   visual); (iii) **G8** (já aprovado) traz os marcos REAIS de `obra_cronograma_marcos` como
   losango posicionado por `plannedDate/completedDate`, com cor derivada no molde `rhDocSituacao`
   (azul pendente futuro / verde concluído / vermelho pendente vencido). Isso entrega o espírito da
   sua ideia (b) sem criar o terceiro conceito de marco.
4. **Legenda: inline, não popup.** O sistema inteiro usa `chartLegend` inline (§5); um popup seria
   padrão novo para 3 itens de legenda. Uma linha de `chartLegend`-like sob o título do Gantt custa
   quase nada e aparece sempre (popup esconde a informação atrás de um clique).

---

## PARTE D — Exemplos concretos

### D-1. O gráfico com os dados REAIS de hoje — aviso explícito

**A obra 7 (Asilo São João Bosco) não tem NENHUMA conta a pagar vinculada** (medição de produção
2026-07-29; 61 das 62 contas do sistema estão `(sem referencia)` e nenhuma aponta para a obra 7).
**O lado de saídas da curva sairia R$ 0, plano, do início ao fim.** Entradas (`accounts_receivable`
com `projectId=7`) e caixa (`cash_bank_movements.projectId`) **não foram medidos** — antes de
desenhar qualquer tela, rode D-2 e veja se a curva teria conteúdo. Não é possível montar exemplo
numérico honesto daqui; o que dá para afirmar: **hoje o exemplo real do Asilo é uma linha plana**
salvo surpresa no lado das entradas.

### D-2. Consulta que alimentaria o gráfico (rodar no servidor e ver o resultado bruto)

```sql
-- Curva mensal por obra: previsto (vencimento) x realizado (pagamento/recebimento/caixa).
-- Troque @obra pelo id (7 = Asilo). Saldo acumulado = somar realizado_liquido na leitura.
SET @obra = 7;
SELECT mes,
       SUM(entrada_prevista)  AS entrada_prevista,
       SUM(saida_prevista)    AS saida_prevista,
       SUM(entrada_realizada) AS entrada_realizada,
       SUM(saida_realizada)   AS saida_realizada,
       SUM(entrada_realizada) - SUM(saida_realizada) AS realizado_liquido_mes
FROM (
  SELECT DATE_FORMAT(dueDate, '%Y-%m') AS mes, amount AS entrada_prevista, 0 AS saida_prevista,
         0 AS entrada_realizada, 0 AS saida_realizada
    FROM accounts_receivable WHERE projectId = @obra AND status <> 'Cancelado'
  UNION ALL
  SELECT DATE_FORMAT(receivedDate, '%Y-%m'), 0, 0, amount, 0
    FROM accounts_receivable WHERE projectId = @obra AND receivedDate IS NOT NULL
  UNION ALL
  SELECT DATE_FORMAT(dueDate, '%Y-%m'), 0, amount, 0, 0
    FROM accounts_payable WHERE projectId = @obra AND status <> 'Cancelado'
  UNION ALL
  SELECT DATE_FORMAT(paidDate, '%Y-%m'), 0, 0, 0, amount
    FROM accounts_payable WHERE projectId = @obra AND paidDate IS NOT NULL
  UNION ALL
  -- Caixa com vínculo à obra, EXCLUINDO o que já quita conta a pagar (anti dupla contagem):
  SELECT DATE_FORMAT(`date`, '%Y-%m'), 0, 0,
         CASE WHEN `type` = 'Entrada' THEN amount ELSE 0 END,
         CASE WHEN `type` = 'Saída'   THEN amount ELSE 0 END
    FROM cash_bank_movements
   WHERE projectId = @obra
     AND (referencia_tipo IS NULL OR referencia_tipo <> 'CONTA_PAGAR')
) t
WHERE mes IS NOT NULL
GROUP BY mes ORDER BY mes;
```

### D-3. Consultas de volumetria (para o §12 e para decidir se a curva teria conteúdo)

```sql
SELECT projectId, COUNT(*) AS etapas FROM obra_cronograma_etapas GROUP BY projectId;
SELECT 'receb' fonte, COUNT(*) FROM accounts_receivable WHERE projectId = 7
UNION ALL SELECT 'pagar', COUNT(*) FROM accounts_payable WHERE projectId = 7
UNION ALL SELECT 'caixa', COUNT(*) FROM cash_bank_movements WHERE projectId = 7;
```

### D-4. Marcos: têm registro? (a pergunta do §3 que só o banco responde)

```sql
SELECT 'marcos_obra' t, COUNT(*), SUM(status='Concluído') FROM obra_cronograma_marcos
UNION ALL SELECT 'marcos_padrao', COUNT(*), NULL FROM obra_marcos_padrao
UNION ALL SELECT 'etapas_isMilestone', COUNT(*), NULL FROM obra_cronograma_etapas WHERE isMilestone='Sim';
```

### D-5. Esboço do marco na linha do Gantt (como descrito na ideia b)

```
Fundações            │◆────────────────◆        │   ← 2 marcos derivados (início/fim)
  planejado          │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          │   ▓ = planned-bar (dourado)
  realizado          │ ████████████████████     │   █ = actual-bar (azul, estica até hoje)
                     │            ┊hoje         │
Alvenaria (ATRASADA) │      ◆──────────◆        │   ◆ vermelho no fim: plannedEndDate < hoje
  planejado          │      ▓▓▓▓▓▓▓▓▓▓          │     sem actualEndDate → "vencido sem cumprir"
  realizado          │      ██████████████▶     │
Estrutura (CONCLUÍDA)│  ◆──────────◆            │   ◆ verde nos dois: actualStart/End preenchidos
```

Estados de cor da ideia (b): **azul** = data planejada futura, nada realizado; **verde** =
cumprido (data real preenchida ≤ planejada, ou etapa Concluída); **vermelho** = data planejada no
passado sem data real (mesma regra de `delayedRows`). Na contra-proposta do §13, os ◆ ficam SÓ nos
marcos reais (`obra_cronograma_marcos`/`isMilestone`) e a barra inteira da etapa atrasada fica
vermelha — o atraso grita sem dobrar símbolos.

### D-6. Texto da legenda (3 estados + contexto das barras)

> **Legenda** — ▓ barra superior: período planejado · █ barra inferior: período realizado ·
> ┃ linha vermelha vertical: hoje · **◆ azul**: marco planejado (ainda no prazo) ·
> **◆ verde**: marco cumprido · **◆ vermelho**: marco vencido sem conclusão

---

## Ordem sugerida e o que fica de fora (pré-medição — SUPERADA pelo adendo abaixo)

1. **Rodar D-2/D-3/D-4 no servidor** (5 min) — decide tudo: se a curva do Asilo é plana e os
   marcos têm zero registros, ambas as ideias esperam o USO gerar dado (coerente com o
   congelamento de frentes).
2. **Cor de atraso nas barras do Gantt** (P) — resolve a dor visual real com regra que já existe
   (`delayedRows`); zero conceito novo.
3. **Promover o Lucro×Caixa acumulado por obra** (P) — linha do zero destacada + tom no card
   (`kpiToneNumero`); entrega a ideia (a) sem gráfico novo.
4. **G8 quando chegar a vez dele na Onda B** (M) — marcos reais posicionados por data no Gantt com
   cor derivada (molde `rhDocSituacao`); entrega o espírito da ideia (b). De carona: posicionar o
   `milestone-dot` pela data.

**Fica de fora (recomendação):** curva de saldo como gráfico novo separado (duplica §7); marcos
derivados início+fim por etapa (terceiro conceito de marco, ruído 2×N); popup de legenda (padrão
novo — usar legenda inline); segmentação verde/vermelho do path no cruzamento do zero (custo
desproporcional); qualquer mudança em `obra_marcos_padrao` (semi-órfã — decidir seu destino é
outra conversa).

---

## ADENDO — Medição de produção (2026-07-31) e ordem FINAL

O dono aceitou o diagnóstico integralmente (inclusive o contraponto §13: cor de atraso vale mais
que marcos; marcos início+fim por etapa está FORA; sem gráfico novo; sem popup; sem segmentar o
path) e rodou as consultas da Parte D em produção.

### Resultados medidos

| Consulta | Resultado |
|---|---|
| (1) Curva da obra 7 | Não rodou na 1ª tentativa: a versão one-liner colada no terminal tinha um `GROUP BY mes` sobrando no ramo do caixa (erro de transcrição; o SQL da D-2 acima sempre esteve correto). A resposta ficou derivável da (3): **só entradas realizadas → curva monotônica crescente, que nunca cruza o zero**. |
| (2) Etapas | **Só a obra 7 tem cronograma**: 3 etapas, 3 com datas, 1 `isMilestone`, **atrasadas_hoje = 0**. |
| (3) Financeiro da obra 7 | receber = **4 registros, 4 realizados** · pagar = **0** · caixa = **0**. |
| (4) Marcos | `obra_cronograma_marcos` = **3 registros, 3 com data, 1 concluído** · `obra_marcos_padrao` = **0** (semi-órfã confirmada) · etapas `isMilestone` = 1. |

### O que os dados decidem — a ordem pré-medição INVERTEU

1. **Cor de atraso na barra: NÃO entra agora.** 0 etapas atrasadas — não haveria nada a pintar.
   *Gatilho de retomada:* a consulta (2) acusar `atrasadas_hoje > 0`.
2. **Polimento do Lucro×Caixa acumulado: NÃO entra agora.** A obra só tem entradas; a curva sobe
   e nunca cruza o zero — linha do zero e tom verde/vermelho não teriam o que destacar.
   *Gatilho:* (3) mostrar saídas realizadas vinculadas à obra (`pagar`/`caixa` > 0).
3. **G8 é a ÚNICA frente com conteúdo real** (3 marcos datados, 1 concluído — o Gantt já nasceria
   com losango verde e pendentes azuis/vermelhos conforme a data). **Mesmo assim não fura a
   fila:** fica na vez dele dentro da Onda B, como aprovado.

**Decisão registrada: nenhuma das três entra agora.** A pendência que os números continuam
apontando é de USO, não de tela: a obra em execução tem `pagar = 0` e `caixa = 0` vinculados —
vincular lançamentos à obra (`projectId`) segue sendo a ação de maior retorno e custo zero de
código.
