# Lucro Gerencial × Caixa Real — período total

**Data:** 2026-07-27
**Status:** especificação de implementação
**Escopo:** painel do Dashboard e reconciliação correspondente no DRE Gerencial
**Sem alteração de schema ou dados**

## Objetivo

Fazer o painel “Lucro Gerencial × Caixa Real” usar o intervalo definido pelos
filtros globais, consolidando os cards sobre o período completo e mantendo o
gráfico como detalhamento mensal. O gráfico terá as visões **Mensal** e
**Acumulado**.

## Fontes reais de dados

O painel atual não possui endpoint próprio. Ele usa os registros já entregues por
`GET /api/bootstrap`:

| Conceito | Tabela | Coleção frontend | Colunas usadas |
|---|---|---|---|
| Contas a receber | `accounts_receivable` | `db.receivable` | `id`, `document`, `issueDate`, `dueDate`, `receivedDate`, `clientId`, `projectId`, `proposalId`, `categoryId`, `costCenterId`, `amount`, `status` |
| Contas a pagar | `accounts_payable` | `db.payable` | `id`, `document`, `issueDate`, `dueDate`, `paidDate`, `supplierId`, `projectId`, `categoryId`, `costCenterId`, `amount`, `status` |
| Cliente da obra | `projects` | `db.projects` | `id`, `clientId`, `status` |

`dueDate` é `DATE NOT NULL` nas duas tabelas. `receivedDate` e `paidDate` são
`DATE NULL`. `amount` é o valor total do título; não existem colunas de valor
parcial liquidado.

## Implementação anterior encontrada

### Período

O painel tinha seletor próprio (`lucroCaixaPeriod`) e não usava as datas dos
filtros globais. As opções eram:

- mês atual;
- último mês;
- últimos 3 meses;
- últimos 6 meses;
- ano atual.

O período era convertido em intervalo inclusivo por
`lucroCaixaPeriodRange(key)`. Os cards eram calculados por
`lucroCaixaIndicators()` → `lucroCaixaCompute()`.

### Fórmula anterior

Para cada intervalo inclusivo `[start, end]`:

```text
receitas_totais =
  Σ accounts_receivable.amount
  onde status != Cancelado
  e dueDate está no intervalo

custos_totais =
  Σ accounts_payable.amount
  onde status != Cancelado
  e dueDate está no intervalo

lucro_gerencial = receitas_totais - custos_totais

entradas_caixa =
  Σ accounts_receivable.amount
  onde status == Recebido (case-insensitive)
  e (receivedDate, com fallback para dueDate) está no intervalo

saídas_caixa =
  Σ accounts_payable.amount
  onde status == Pago (case-insensitive)
  e (paidDate, com fallback para dueDate) está no intervalo

caixa_real_líquido = entradas_caixa - saídas_caixa

diferença = lucro_gerencial - caixa_real_líquido
```

O card antigo chamava a diferença de “A receber líquido”, embora a própria
fórmula demonstre que ela não é sinônimo de contas a receber: também sofre o
efeito das contas a pagar e de liquidações de competências anteriores.

### Status, cancelados e vencidas

- Status são normalizados com `trim().toLowerCase()`.
- `Recebido` e `Pago` são os únicos estados considerados liquidados.
- `Cancelado` é excluído de competência, caixa e aberto.
- “Em aberto” significa qualquer status não liquidado e não cancelado, incluindo
  `Aberto`, `Vencido` e `Parcial`.
- `isOverdue()` considera vencido o status literal `Vencido` ou um título não
  liquidado/cancelado com `dueDate < hojeLocal()` e sem data efetiva.
- O alerta “há mais de 30 dias” era global e independente do período selecionado.

### Pagamentos e recebimentos parciais

O schema não guarda `valorRecebido`/`valorPago` parcial. Portanto, anteriormente:

- um título `Parcial` entrava pelo valor total na competência;
- entrava pelo valor total nas contas em aberto;
- não entrava no caixa efetivo, mesmo que tivesse `receivedDate`/`paidDate`,
  porque o status não era `Recebido`/`Pago`.

Esse comportamento será preservado nesta etapa. Alterá-lo exigiria uma regra de
negócio e uma fonte de valor parcial que hoje não existem.

### Filtros anteriores

O painel recebia somente o recorte opcional de obra da visão do Dashboard. Não
aplicava diretamente:

- data inicial/final globais;
- cliente;
- fornecedor;
- centro de custo;
- categoria;
- status/status da obra.

O filtro genérico `applyFilters()` não pode ser reutilizado diretamente no
cálculo porque sua regra de datas aceita o registro quando **qualquer** campo de
data cai no intervalo. O painel precisa usar `dueDate` para competência e a data
efetiva para caixa.

## Comportamento novo

### Resolução do período global

O intervalo continua inclusivo e passa a ser resolvido pelos filtros
`#filterStart` e `#filterEnd`:

1. inicial + final: usar todo o intervalo;
2. somente inicial: inicial até `hojeLocal()`;
3. somente final: primeira data financeira disponível no escopo até a final;
4. sem datas: primeira data financeira disponível no escopo até `hojeLocal()`.

A primeira data financeira disponível será o menor valor válido entre
`issueDate`, `dueDate`, `receivedDate` e `paidDate` dos títulos não cancelados
que respeitam os demais filtros. Como `dueDate` é obrigatório, lançamentos sem
data efetiva continuam tendo uma data de competência.

Se o escopo não tiver nenhum título, o início usa a própria data inicial, a data
final ou hoje, nessa ordem. Assim o painel exibe um período válido e zerado.

### Filtros dimensionais

Antes de calcular o período e os valores:

- **obra:** vínculo direto por `projectId`; na visão por obra do Dashboard, a
  obra ativa é o recorte mais específico;
- **cliente:** contas a receber casam por `clientId` ou pela obra do cliente;
  contas a pagar casam pelas obras cujo `projects.clientId` é o cliente;
- **centro de custo:** vínculo direto por `costCenterId`;
- **fornecedor:** restringe contas a pagar por `supplierId`; se selecionado,
  contas a receber não participam;
- **categoria:** vínculo direto por `categoryId`;
- **status:** comparação normalizada; se selecionado, restringe os dois lados;
- **status da obra:** considera o status da obra vinculada.

Essa regra de cliente evita produzir “lucro do cliente” com receitas do cliente
e despesas de todas as obras.

### Fórmula final

A fórmula principal de lucro e caixa não muda. Muda o intervalo e são expostas
as parcelas já calculadas:

```text
lucro_gerencial_total = receitas_totais - custos_totais
entradas_caixa = recebidas
saídas_caixa = pagas
caixa_real_líquido = recebidas - pagas
diferença_lucro_caixa = lucro_gerencial_total - caixa_real_líquido
```

Também serão calculados, sempre por `dueDate` dentro do período:

```text
a_receber_abertas = Σ títulos a receber não liquidados/cancelados
a_receber_vencidas = subconjunto de a_receber_abertas vencido hoje
a_pagar_abertas = Σ títulos a pagar não liquidados/cancelados
a_pagar_vencidas = subconjunto de a_pagar_abertas vencido hoje
```

Cada indicador de aberto/vencido inclui valor e quantidade. Valores em reais
respeitam a privacidade; quantidades permanecem visíveis.

### Evolução mensal e acumulada

O gráfico usa todos os meses que interceptam o período resolvido. O primeiro e o
último mês são limitados pelas datas exatas do filtro.

- **Mensal:** mostra o lucro gerencial e o caixa real líquido de cada mês.
- **Acumulado:** para cada mês, soma o mês atual e todos os anteriores desde o
  início do intervalo.

Os cards nunca mudam com esse seletor; representam o total do período completo.

## Interface

O painel exibirá:

- `Período analisado: DD/MM/AAAA a DD/MM/AAAA`;
- seletor de evolução `Mensal` / `Acumulado`;
- nove cards consolidados:
  1. Lucro gerencial;
  2. Entradas de caixa;
  3. Saídas de caixa;
  4. Caixa real líquido;
  5. Diferença lucro × caixa;
  6. A receber em aberto;
  7. A receber vencidas;
  8. A pagar em aberto;
  9. A pagar vencidas;
- gráfico mensal como detalhamento, não como fonte dos cards.

O termo “A receber líquido” sai do card principal e vira “Diferença lucro ×
caixa”, para não equiparar conceitos diferentes.

## Modo privacidade

- Todos os montantes dos cards usam `money-blur`.
- Eixo Y e tooltips continuam usando os helpers existentes de privacidade.
- Alertas monetários usam `moneySpan()`/`maskMoneyText()`.
- Quantidades, datas, nomes dos meses, seletor e linhas do gráfico permanecem
  visíveis.
- Não há alteração em exportações, impressão ou documentos gerados.

## Performance e API

Não será criado endpoint nesta etapa:

- o bootstrap atual já executa uma consulta por recurso e entrega integralmente
  `accounts_receivable` e `accounts_payable`;
- o painel não fará novas requisições nem uma consulta por mês;
- os meses serão agregados no frontend sobre as coleções já carregadas;
- criar um endpoint sem retirar essas coleções do bootstrap duplicaria tráfego e
  cálculo.

Evolução futura, se o volume das contas tornar o bootstrap pesado: criar um
resumo SQL único agrupado por mês e filtros, e paginar as listas financeiras.
Essa mudança deve ser feita em conjunto; não é necessária agora.

## Limitações conhecidas

1. Não existe valor parcial liquidado; títulos `Parcial` seguem integralmente em
   aberto e fora do caixa efetivo.
2. Título marcado `Recebido`/`Pago` sem data efetiva usa `dueDate` como fallback,
   preservando a regra anterior.
3. Não existe vínculo direto de cliente em `accounts_payable`; o filtro por
   cliente depende do vínculo da conta com uma obra do cliente.
4. Contas sem obra não entram quando um cliente é selecionado.

## Critérios de aceite

- Datas globais resolvem os quatro cenários solicitados.
- O período utilizado aparece explicitamente.
- Cards representam todo o período.
- Mensal e acumulado usam a mesma base e intervalo.
- Cancelados não entram.
- `Parcial` preserva o comportamento documentado.
- Filtros de obra, cliente e centro de custo produzem recortes coerentes.
- Nenhuma consulta por mês é criada.
- Modo privacidade cobre cards, eixo, tooltips e alertas.
- `php -l api/index.php` e `node --check app.js` passam.
