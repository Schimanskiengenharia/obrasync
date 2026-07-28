# Tema Dark Neutro — especificação visual

**Data:** 2026-07-27
**Versão alvo:** v1.38.0
**Escopo:** interface web e plugin de seletividade
**Sem alteração de API, banco, schema, cálculos, dados, exportações ou documentos**

## Objetivo

Substituir o dark verde/teal por superfícies cinza-preto neutras, usando azul
como cor de navegação, seleção, controles, links e foco. Verde permanece
reservado a sucesso, concluído, recebido, lucro e resultado positivo.

O tema claro mantém sua aparência atual. A compatibilidade é preservada pelo
mesmo mecanismo de `theme-init.js`: `data-theme="light|dark"` é aplicado no
`<html>` antes do primeiro paint.

## Auditoria anterior à implementação

### Variáveis atuais

O `:root` de `styles.css` define:

| Token anterior | Claro | Dark anterior | Uso |
|---|---:|---:|---|
| `--bg` | `#f4f7f6` | `#0e1615` | fundo geral |
| `--panel` | `#ffffff` | `#17211f` | sidebar, cards, dialogs |
| `--panel-2` | `#eef4f2` | `#22322f` | hover/seleção/superfície secundária |
| `--ink` | `#172322` | `#e6f1ee` | texto principal |
| `--muted` | `#60716e` | `#9ab1ac` | texto secundário |
| `--line` | `#d8e1de` | `#2c3c38` | bordas |
| `--teal` | `#0f766e` | herdado do claro | ação/navegação/foco |
| `--teal-2` | `#134e4a` | `#5eead4` | destaque textual |
| `--field` | `#ffffff` | `#101a18` | inputs |
| `--table-head` | `#f8fbfa` | `#1d2b28` | cabeçalho de tabela |
| `--nav-ink` | `#41514d` | `#c3d4d0` | texto da sidebar |
| `--shadow` | sombra verde suave | preto 50% | elevação |
| `--gold`, `--red`, `--green` | semânticos | herdados | alerta, erro, sucesso |

O plugin `plugins/seletividade/style.css` replica quase o mesmo conjunto, sem
`--table-head` e `--nav-ink`.

### Cores hardcoded

Varredura por hexadecimal, `rgb/rgba/hsl`, `style=`, `background`, `fill` e
`stroke`:

| Arquivo | Ocorrências de literais | Observações |
|---|---:|---|
| `styles.css` | 464 | estados semânticos, documentos de impressão e vários halos teal estruturais |
| `app.js` | 187 | mapa de ícones, séries SVG, agenda, medidores e mensagens inline |
| `index.html` | 0 cores; 1 `style=` | margem do diálogo de troca de senha, sem cor |
| `plugins/seletividade/style.css` | 75 | tokens duplicados, foco/seleção teal e bloco `@media print` |
| `plugins/seletividade/app.js` | 16 | paleta do canvas; verde de retaguarda é série semântica |
| `plugins/seletividade/index.html` | 0 | sem cor inline |

Há 41 `style=` em `app.js`; a maioria controla dimensões/progresso. Os pontos
com cor são mensagens de erro/alerta, medidor de senha, ícones de submenu,
legenda da agenda e cabeçalhos configuráveis de Kanban.

### Verde/teal estrutural encontrado

- Dark base: `#0e1615`, `#17211f`, `#22322f`, `#101a18`, `#1d2b28`,
  `#2c3c38`, `#9ab1ac` e `#c3d4d0`.
- Acento herdado: `#0f766e`, `#134e4a`, `#5eead4` e
  `rgba(15,118,110,...)`.
- Login: gradiente teal sobre a imagem.
- Sidebar: toggle, ícones, pontos, item ativo, hover, seção ativa e seletor de
  tema.
- Links, botões primários/secundários, foco de campos, favoritos, abas,
  checkboxes/radios, cards selecionados e controles ativos.
- Agenda: dia atual, status agendado e KPIs não semânticos.
- Kanban: bordas padrão das colunas/cards.
- Dashboards e relatórios: séries de receita, entradas previstas, distribuição
  de custos e resultado usando `#0f766e` como cor genérica.
- Ícones dos grupos Viabilidade, Relatórios e PBQP-H em `#0f6e56`.
- Plugin de seletividade: botões, foco, links, modos, seleção, modal, lista,
  toast e sombras.

### Cores verdes preservadas por semântica

- `--green` e variantes de sucesso.
- KPIs positivos, lucro e saldo positivo.
- Status recebido, pago, concluído, aprovado, viável e conciliado.
- Menor preço/economia, comparação favorável e itens aceitos.
- Eventos de obra/projeto quando a cor identifica a categoria na agenda.
- Curva de retaguarda do coordenograma do plugin, cuja legenda usa verde para
  diferenciar a série técnica.
- Cores fixas dentro de `@media print` e canvas/relatório do plugin, pois
  documentos gerados ficam fora do tema da interface.

### Componentes que ignoravam tokens

- Gradiente do login e barra de favoritos.
- Halos de foco/sombra com `rgba(15,118,110,...)`.
- Séries SVG declaradas em `app.js`.
- Cores de submódulos em `SUBMODULE_ICONS`.
- Tags/setores e estados selecionados em IA, permissões, RDO e cotações.
- Canvas do plugin, intencionalmente claro para manter consistência com o PDF.
- Blocos de impressão e prévias `.proposal-print`, `#docPrint`,
  `.print-report`, que devem continuar isolados.

## Tokens finais

Novos tokens estruturais:

- `--accent`, `--accent-hover`, `--accent-focus`;
- `--accent-soft`, `--accent-soft-strong`, `--accent-shadow`, `--focus-ring`;
- `--sidebar-surface`, `--topbar-surface`, `--surface-hover`;
- `--line-soft`, `--disabled`, `--overlay`;
- `--chart-primary`, `--chart-secondary`.

No claro, eles apontam para os valores atuais para evitar regressão visual. No
dark:

| Papel | Valor |
|---|---:|
| Fundo | `#0f1115` |
| Sidebar/topbar | `#15181e` |
| Cards/dialogs/drawers | `#1b1f27` |
| Inputs/superfície secundária | `#222731` |
| Hover | `#292f3a` |
| Borda | `#303744` |
| Borda suave | `#262c35` |
| Texto principal | `#f3f4f6` |
| Texto secundário | `#a7afbd` |
| Desabilitado | `#737c8c` |
| Azul principal | `#0a66c2` |
| Azul hover | `#1677d2` |
| Foco | `#4c9aff` |
| Overlay | `rgba(0,0,0,0.58)` |

`--teal` e `--teal-2` permanecem apenas como aliases de compatibilidade para
plugins/código legado, apontando para o acento azul no dark.

## Acessibilidade e contraste

- Texto principal e secundário usam contraste alto sobre cards e fundo.
- Bordas de cards/inputs não se confundem com as superfícies.
- `:focus-visible` e foco de campos usam `#4c9aff` com anel translúcido.
- Hover é uma superfície neutra própria, não apenas uma mudança mínima de
  borda.
- Estados nunca dependem apenas da cor: continuam com texto, ícone, posição ou
  rótulo.
- Preto absoluto não será usado em superfícies grandes; fica restrito a overlays
  translúcidos e regras existentes de documentos.

## Modo privacidade

Não alterar `privacyMode`, `applyPrivacyMode`, `togglePrivacyMode`,
`moneySpan`, `maskMoneyText`, `.privacy-mode` ou `.money-blur`.

O estado ativo dos dois botões passa a usar o token azul estrutural. Blur,
tooltips/eixos monetários, percentuais e contagens mantêm a regra v1.36.0.

## Impressão, PDF e exportação

Não alterar cores dentro de `@media print`, prévias de documento deliberadamente
brancas, canvas usado no PDF ou geradores de documento/exportação em `app.js`.
As mudanças de SVG se limitam aos gráficos da interface.

## Critérios de aceite

- Dark sem aparência verde/teal nas superfícies e ações.
- Sidebar, topbar, cards, inputs e overlays usam a paleta neutra.
- Navegação, seleção, foco, botões e abas usam azul.
- Verdes semânticos continuam verdes.
- Gráficos preservam distinção entre positivo, negativo, planejado e realizado.
- Tema claro, privacidade, impressão, PDFs e exportações permanecem funcionais.
- Desktop e mobile não sofrem regressão de layout.
- `node --check app.js`, `php -l api/index.php` e `git diff --check` passam.
