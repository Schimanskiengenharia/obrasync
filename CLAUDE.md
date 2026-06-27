# CLAUDE.md — Guia para agentes de IA no projeto ObraSync

> **Versão atual:** `v1.12.1` · 2026-06-27
> **Última varredura de código:** 2026-06-27 (3ª rodada — segurança, bugs, performance, qualidade, UX; itens MÉDIO/BAIXO fechados na v1.12.1)

Este arquivo orienta qualquer agente (ou pessoa) que continue o desenvolvimento.
Leia também o `README.md` (seção "Para quem está retomando o projeto") e o
`STATUS.md` (estado executivo, módulos, pendências e próximos passos).

---

## Arquitetura (resumo)

- **SPA sem build.** Frontend: `app.js` (arquivo único, ~13,7 mil linhas) + `index.html` (shell) + `styles.css`. Backend: `api/index.php` (arquivo único, ~7,7 mil linhas). Banco: MariaDB/MySQL (`utf8mb4`).
- **Frontend:** objeto global `db`; `render()` despacha por `currentModule`; HTML montado por template strings e injetado com `innerHTML`.
- **Backend:** roteamento por `path` (REST) e por `?module=...&action=...`; CRUD genérico via `resource_map()` + `insert_dynamic()`/`update_dynamic()` (descartam colunas inexistentes — toleram diferenças de schema).

## Convenções obrigatórias (siga-as)

- **Antes de qualquer SQL:** confirme os nomes reais das colunas (muitas são camelCase: `costCenterId`, `dueDate`, `projectId`, `unitPrice`). Não duplique colunas que já existem.
- **Antes de salvar:** valide a sintaxe — `php -l api/index.php` e `node --check app.js`.
- **Backend:** respostas REST via `respond(['ok' => true, 'data' => ...])` e erros via `fail($msg, $status)`; módulos `?module=` respondem `{success, data, message}`. Auditoria via `server_audit()`. Tabelas/colunas novas devem ter **`ensure_*`** no `index.php` (não só migração) para auto-cura em produção.
- **Frontend:** chamadas autenticadas via `apiRequest()` / `apiModuleRequest()`; uploads via `fetchForm()`; toasts via `showToast()`. **Sempre** escape de dados do banco em `innerHTML` com `svgText()` / `escapeHtml()`. IDs novos via `crypto.randomUUID()` (não existe `uid()`).
- **Cache busting:** ao mudar `app.js`/`styles.css`, incremente `?v=NNNN` em `index.html` (hoje `app.js?v=1742`, `styles.css?v=1742`) e a constante `APP_VERSION` no topo de `app.js`.
- **Deploy:** push na `main` → webhook GitHub → `deploy.php` roda `git pull` + backup pré-deploy. Em produção, rode as migrations novas manualmente. **Nunca** toque em `/etc/financeiro/config.php`, uploads, backups ou banco.
- **Commits:** use a mensagem exata pedida pelo usuário. Não faça `git push` sem solicitação. Não inclua `.claude/settings.local.json` nos commits.

---

## Varredura de 2026-06-27 — problemas CORRIGIDOS (v1.12.0)

| # | Prioridade | Categoria | Problema | Correção |
|---|---|---|---|---|
| 1 | ALTO | Segurança (XSS) | Dados do banco injetados em `innerHTML` sem escape: `bars()`/`kpi()` (DRE/Relatórios), `<option>`/cabeçalhos (Dashboard/Kanban), `nameOf()` em cards (Agenda/Kanban/Dashboard) | Envolvidos com `svgText()` |
| 2 | CRÍTICO | Bug | `importSinapiCsvLocal` chamava `uid()` (inexistente) → `ReferenceError` abortava import local de CSV SINAPI | `crypto.randomUUID()` |
| 3 | ALTO | Bug (500) | `automate_approved_milestone` exige colunas de referência em `accounts_receivable` que nenhuma migração criava → 500 + rollback do status ao aprovar marco | `ensure_referencia_columns` cobre `accounts_receivable` + guarda no bootstrap |
| 4 | ALTO | Segurança | Rota `forced-change-password` era oráculo de força bruta/enumeração (identifica por `username`, confere senha sem rate limit/log) | Rate limit na janela/contexto do login + `register_attempt` + auditoria |
| 5 | ALTO | Segurança | Diretório `.git` exposto via HTTP (docroot é working tree) | `RedirectMatch 404 /\.git` no `.htaccess` |
| — | CRÍTICO | Bug (500) | (rodada anterior) Criação de parcelas recorrentes dava 500 sem as colunas de recorrência | `ensure_payable_recurrence_columns` |

## Problemas da varredura — TODOS resolvidos na v1.12.1

**MÉDIO ✅**
- `ensure_fiscal_documents_table()` — `fiscal_documents` auto-curada (POST de NF e NFS-e).
- `ensure_agenda_tables()` / `ensure_kanban_tables()` — Agenda/Kanban auto-curados.
- `ensure_users_extra_columns()` agora cria `email`/`blocked`/`mustChangePassword`.
- `applyFilters` com comparação estrita (campo vazio não burla mais o filtro).

**BAIXO ✅**
- Logo SVG: rejeita conteúdo ativo no upload + CSP `sandbox` ao servir.
- `display_errors=0`/`log_errors=1` no topo do `index.php`.
- `safe_xml_load()` (rejeita DOCTYPE + `LIBXML_NONET`) em todos os parses de XML.
- `sanitizeStoredHtml()` no `proposalBody`; `bootstrapApp().catch(...)`.

**Aceito por design (não alterar):**
- Senha legada em texto puro na transição `mustChangePassword` — fluxo documentado de primeiro login (seed → bcrypt). Remover quebra ativação de instalações novas.
- `generatedLink` já valida `^https?://` — nada a fazer.

> Pontos fortes confirmados (não re-sinalizar): prepared statements em todo SQL (sem SQLi), autorização por rota/perfil após `authenticate_request`, sessão com token CSPRNG + SHA-256 + idle/TTL, `password_hash`, rate limit de login/reset, CSRF mitigado por auth via header, uploads fora do docroot, deploy com HMAC + `escapeshellarg`.

---

## Estado atual dos módulos

| Módulo | Estado |
|---|---|
| Dashboard (geral + por obra) | ✅ Estável. Novo: widgets de execução de obras via endpoint + tooltip combinado. |
| Orçamento de Obra | ✅ Reestruturado (etapas/tipos/visões/BDI por etapa/CSV) + Realizado vs Orçado. |
| Cadastros (clientes, fornecedores, etc.) | ✅ Estável. Preenchimento automático + ViaCEP + endereço completo. |
| Financeiro (pagar/receber/caixa/fluxo) | ✅ Estável. Recorrentes + quitação antecipada + anti dupla contagem + OFX. |
| Pedidos de compra | ✅ Itens detalhados + condições + impressão com identidade visual. |
| Comercial (propostas/gerador) | ✅ Estável. Snapshot de cliente + identidade visual no PDF. |
| Cronograma / Gantt / MS Project | ✅ Estável; aprovação de marco corrigida (era 500). |
| Agenda / Kanban | ✅ Estável; auto-curado por `ensure_agenda_tables`/`ensure_kanban_tables`. |
| Notas/Documentos fiscais + NFS-e | ✅ Estável; auto-curado por `ensure_fiscal_documents_table`. |
| Qualidade (PBQP-H) | ✅ Estável (auto-curado por `ensure_qualidade_tables`). |
| Plugins / Viabilidade / SINAPI | ✅ Estável. |
| RDO | ✅ Com cabeçalho/rodapé da empresa. |

---

## Novas tabelas criadas nesta sessão de desenvolvimento (v1.12.0)

| Tabela | Propósito | Origem |
|---|---|---|
| `orcamento_etapas` | Etapas hierárquicas do orçamento de obra (nome, código, ordem, BDI específico) | migration `2026-06-09-orcamento-estrutura-completa.sql` + `ensure_budget_structure` |
| `purchase_order_items` | Itens detalhados do pedido de compra | migration `2026-06-09-purchase-order-items.sql` + `ensure_purchase_order_items` |
| `orcamento_item_execucao_log` | Histórico de atualização da quantidade realizada por item | migration `2026-06-09-execucao-orcamento-historico.sql` + `ensure_budget_execution_log` |

**Colunas adicionadas:** `orcamento_obra_itens` (`codigo`, `tipo`, `etapa_id`, `sinapi_id`, `composicao_propria_id`, `ordem`, `quantidade_realizada`); `accounts_payable` (`recorrencia_id`, `parcela_numero`, `parcela_total`, `recorrencia_tipo`, `juros_aplicado`, `valor_original`, `referencia_tipo`, `referencia_id`); `accounts_receivable` (`referencia_tipo`, `referencia_id` — adicionadas nesta varredura); `cash_bank_movements` (`referencia_tipo`, `referencia_id`); `purchase_orders` (`condicoes_pagamento` + vínculo a orçamento); `company_settings` (`logo_url`, `website`, `instagram`, `whatsapp`, endereço); `clients`/`suppliers` (`cidade`, `estado`, `complemento`, ...).

## Novos endpoints criados nesta sessão (v1.12.0)

| Endpoint | Função |
|---|---|
| `GET ?module=dashboardExecution&action=summary` | Resumo previsto/realizado por obra + estouros (dashboard de execução) |
| `POST ?module=workBudgetExecution&action=update` / `GET …&action=history` | Atualiza quantidade realizada do item + histórico |
| `?module=orcamentoEtapas` (alias `orcamento-etapas`) | CRUD das etapas do orçamento |
| `GET/POST ?module=purchaseOrderItems&action=list/saveBulk` | Itens do pedido de compra |
| `POST ?module=payable&action=create_recurrence/early_settlement/update_scope/cancel_recurrence` · `GET …&action=group` | Recorrência e quitação antecipada de contas a pagar |
| `POST ?module=cashMoves&action=create/link` | Caixa vinculado a conta a pagar (anti dupla contagem) |
| `?module=costCenters&action=list/get/create/update/delete` | Centros de custo (abas + dados padrão) |
| `GET ?module=clients&action=get&id=` | Busca pontual de cliente (preenchimento automático) |
| `?module=agenda` | Eventos da agenda integrados ao financeiro |

---

## Como continuar

1. Rode `php -l api/index.php` e `node --check app.js` após qualquer edição.
2. Para features novas, crie a migração **e** um `ensure_*` correspondente (auto-cura).
3. Atualize `APP_VERSION`/`APP_CHANGELOG` em `app.js`, o `?v=` em `index.html`, o cabeçalho do `README.md` e este arquivo.
4. Commit local; o `git push` é manual quando o usuário pedir. Após o push, o usuário roda `cd /var/www/financeiro && git pull origin main` no servidor.
