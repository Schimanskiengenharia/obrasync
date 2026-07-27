# Modo Privacidade — ocultar valores financeiros (design)

**Data:** 2026-07-27 · **Status:** aprovado pelo usuário

## Objetivo

Botão que deixa **ilegíveis** (borrados) os valores financeiros em todo o sistema —
lucros, despesas, saldos, receitas — para proteger a tela de olhares durante
reuniões e compartilhamento de tela. Como o ícone de olho de apps de banco.

## Decisões aprovadas

| Decisão | Escolha |
|---|---|
| Efeito | Borrão (blur) — ilegível, mas o valor continua no DOM (não é proteção contra F12; usuário ciente) |
| Abrangência | Sistema inteiro (todos os módulos), botão na topbar |
| Gráficos | Borrar só os números (valores e eixo Y); barras/linhas visíveis — proporções sim, absolutos não |
| Percentuais, contagens e datas | **Visíveis** (coerente com a regra dos gráficos) |
| Impressão | Borrão vale na impressão; para imprimir com valores, desligar o modo |
| Persistência | `localStorage` (`finconta.privacy`), por navegador; sem backend |
| Abordagem | A — marcação central + varredura (aprovada vs. embrulhar `asMoney()` global, rejeitada por risco em exports/atributos) |

## Componentes

### 1. Botão e estado
- Botão-ícone (`ti-eye` / `ti-eye-off`) na `.actions` da topbar (`index.html`), ao lado de Excel/PDF, com `title`/`aria-label` "Ocultar valores" / "Mostrar valores".
- Estado global `privacyMode` (boolean), lido/salvo via `safeLocalGet`/`safeLocalSet` na chave `finconta.privacy`.
- Ativo → classe `privacy-mode` no `<body>`; alternar chama `render()` (necessário para gráficos/tooltips).

### 2. Efeito (CSS em `styles.css`)
- `.privacy-mode .money-blur { filter: blur(7px); user-select: none; }` (com transição curta).
- Inputs: `.privacy-mode input[data-format="money"]:not(:focus) { filter: blur(7px); }` — focou para editar, enxerga; desfocou, borra. Inputs de dinheiro ad-hoc que não têm `data-format="money"` (ex.: `anfValor`, `cnfValor`, `.pg-item-price`, `.po-i-vu`) recebem o atributo na etapa 3.
- Sem exceção de `@media print` (borrão vale ao imprimir).

### 3. Marcação central (cobre a maior parte do sistema)
- `kpi(label, value, format, tone)`: quando `format === true` (valor monetário), o `<strong>` ganha `money-blur`. Cards com percentuais/contagens (`format === false`) ficam visíveis.
- `formatCell()`: quando `isMoneyField(field)`, devolve `<span class="money-blur">${asMoney(value)}</span>` — cobre as colunas de dinheiro de todas as tabelas (`table()`) do sistema. `isPercentField` não é tocado.
- Helpers de gráfico (`groupedBarChart`, `horizontalBarChart`, `lineChart`): classe `money-blur` nos `<text>` SVG de rótulos de valor e do eixo Y; rótulos de categoria/mês visíveis. Tooltips com valores (`<title>` SVG e tooltip combinado do dashboard de execução): com o modo ativo, substituir a parte numérica por "•••" na re-renderização.

### 4. Varredura da cauda longa
- Novo helper `moneySpan(value)` → `<span class="money-blur">${asMoney(value)}</span>`.
- Aplicar nos painéis que usam `asMoney()` direto em template de tela: painel Lucro x Caixa, alertas do dashboard, widgets de execução de obras, DRE, fluxo de caixa, relatórios (financeiro/cliente/fornecedor/centro de custo/obra), orçamento de obra, propostas (telas de listagem/painéis), RH e demais.
- **Não tocar**: usos de `asMoney`/valores em exportações (Excel/CSV), HTML de impressão de documentos (proposta, contrato, pedido de compra, RDO — documentos gerados intencionalmente), atributos HTML e mensagens de toast/confirm.

## Etapas de implementação (validação por etapa)

1. **Etapa 1 — Infra + Dashboard:** botão, estado, CSS, `kpi()`, gráficos, Lucro x Caixa, alertas, execução, tabela de vencimentos (via `formatCell`). Valida no dashboard.
2. **Etapa 2 — Pontos centrais do resto:** `formatCell` (todas as tabelas), inputs `data-format="money"`, cards `kpi()` de outros módulos. Valida no financeiro.
3. **Etapa 3 — Varredura custom:** guiada por grep de todos os ~169 usos de `asMoney()` (classificando cada um: tela visível → `moneySpan`; export/impressão/atributo → não tocar), mais os inputs de dinheiro ad-hoc. Cobre DRE, fluxo de caixa, relatórios e demais painéis. Valida módulo a módulo.

Cada etapa: `node --check app.js`, bump `APP_VERSION`/changelog em `app.js`, `?v=` em `index.html`, commit separado. Push manual quando o usuário pedir.

## Fora de escopo

- Máscara "•••" no lugar do valor (rejeitada — escolhido blur).
- Persistência por usuário no servidor (localStorage basta).
- Ocultar valores de exportações/documentos impressos gerados intencionalmente.
- Integração com o mascaramento por perfil já existente (`isSensitiveFieldMasked` — recurso distinto, não alterar).

## Critérios de sucesso

- Com o modo ativo: nenhum valor em R$ legível em cards, tabelas, gráficos, painéis e inputs (sem foco) de qualquer módulo; percentuais/contagens/datas continuam legíveis; barras/linhas dos gráficos visíveis.
- Com o modo inativo: sistema idêntico ao atual.
- Excel/CSV/PDF e documentos de impressão saem íntegros (sem HTML vazado, valores normais).
- Preferência sobrevive a recarregar a página e trocar de módulo.
