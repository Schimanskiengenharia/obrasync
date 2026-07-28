# Plano — Tema Dark Neutro v1.38.0

**Data:** 2026-07-27
**Spec:** `docs/superpowers/specs/2026-07-27-dark-theme-neutral.md`

## 1. Centralizar tokens

- Manter os valores atuais do tema claro.
- Criar tokens estruturais por função, sem nome de cor.
- Aplicar a paleta neutra no seletor `html[data-theme="dark"]`.
- Manter `--teal`/`--teal-2` como aliases temporários para compatibilidade.
- Replicar os tokens necessários no plugin de seletividade.

## 2. Migrar componentes estruturais

- Trocar usos estruturais de `var(--teal)` por `var(--accent)`.
- Trocar halos hardcoded por tokens `--focus-ring`/`--accent-shadow`.
- Aplicar superfícies próprias à sidebar, topbar, hover, inputs e overlays.
- Cobrir login, favoritos, filtros, cards, tabelas, dialogs, drawers, toasts,
  abas, Agenda, Kanban, Configurações, IA, cotações e responsividade.
- Preservar `--green`, `--red` e `--gold` nos estados semânticos.

## 3. Gráficos e ícones do frontend

- Substituir `#0f766e` usado como série genérica por `--chart-primary`.
- Manter lucro/saldo positivo em `--green` e valores negativos em `--red`.
- Manter planejado e realizado com azuis distinguíveis ou azul/âmbar conforme a
  função existente.
- Trocar ícones teal não semânticos de Viabilidade, Relatórios e PBQP-H por
  `var(--accent)`.
- Não alterar gráficos de documentos ou exportações.

## 4. Plugin de seletividade

- Neutralizar superfícies e migrar interação/foco/seleção para azul.
- Manter verde/vermelho das curvas e badges técnicos.
- Manter canvas branco e todo o bloco `@media print` inalterados.

## 5. Proteções

- Não editar API, migrations, banco, schema, dados ou cálculos financeiros.
- Não alterar helpers/classes do modo privacidade.
- Não alterar `theme-init.js`, salvo se a auditoria revelar falha funcional
  (não revelou).
- Não alterar documentos gerados, impressão ou exportação.
- Não incluir `.claude/settings.local.json`.
- Não fazer push.

## 6. Versão e documentação

- Atualizar `APP_VERSION` para `v1.38.0` e data `2026-07-27`.
- Adicionar entrada no topo de `APP_CHANGELOG`.
- Atualizar cabeçalhos e histórico em `README.md`, `STATUS.md` e `CLAUDE.md`.
- Atualizar `styles.css` e `app.js` para cache `1802` em `index.html`.

## 7. Validação

- `node --check app.js`.
- `php -l api/index.php`.
- `git diff --check`.
- Confirmar diff restrito a frontend/documentação.
- Inspecionar o dark em desktop e mobile: login, sidebar, topbar, filtros,
  dashboard, Lucro × Caixa, gráficos, tabelas, formulários, dialogs, drawers,
  Agenda, Kanban, Obras, Orçamento, SINAPI, Cotações, Financeiro, Comercial, RH,
  PBQP-H, Configurações e plugin.
- Repetir com privacidade ativa, verificando blur, sincronismo dos botões,
  tooltips/eixos e visibilidade de percentuais/contagens.
- Conferir tema claro e uma amostra de impressão/PDF no servidor.
