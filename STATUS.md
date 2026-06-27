# STATUS — ObraSync

> **Versão:** `v1.12.0` · **Varredura:** 2026-06-27 · **Ambiente:** produção em `https://schimanskiengenharia.com.br/financeiro`

---

## 1. Resumo executivo

ObraSync é um ERP web de gestão integrada de obras, financeiro, comercial e
contabilidade gerencial para a Schimanski Engenharia. SPA em JavaScript puro
(`app.js`), API única em PHP (`api/index.php`), banco MariaDB/MySQL. Sem
frameworks e sem etapa de build.

O sistema está **em produção e estável**. Nesta sessão (v1.12.0) o Orçamento de
Obra foi reestruturado para nível profissional (etapas, tipos de custo, visões,
BDI por etapa), foi adicionado o painel de execução de obras no Dashboard, e foi
feita uma **varredura completa de segurança/bugs**. Todos os itens
**CRÍTICOS e ALTOS de segurança** e os **bugs que quebravam fluxos** foram
corrigidos. Restam pendências de prioridade **MÉDIO/BAIXO** (seção 3).

---

## 2. Módulos implementados e status

| Módulo | Status | Observação |
|---|---|---|
| Dashboard (geral + por obra) | 🟢 Estável | Novo painel de execução de obras (endpoint + tooltip combinado) |
| Cadastros (clientes, fornecedores, produtos, serviços, categorias, centros de custo, contas) | 🟢 Estável | Preenchimento automático de cliente, ViaCEP, endereço completo |
| Orçamento de Obra | 🟢 Estável | Reestruturado: etapas/tipos/4 visões/BDI por etapa/CSV + Realizado vs Orçado |
| SINAPI / composições / cotações / Curva ABC | 🟢 Estável | Importador XLSX/CSV + assíncrono |
| Financeiro (a pagar, a receber, caixa, fluxo) | 🟢 Estável | Recorrentes, quitação antecipada, anti dupla contagem |
| Conciliação OFX | 🟢 Estável | Match automático por FITID |
| Pedidos de compra | 🟢 Estável | Itens detalhados, condições, impressão com identidade visual |
| Comercial (propostas, gerador, modelos) | 🟢 Estável | Snapshot de cliente, PDF com identidade visual |
| Cronograma / Gantt / MS Project | 🟡 Funcional | Aprovação de marco corrigida (era 500 determinístico) |
| Agenda / Kanban | 🟡 Funcional | Depende da migração; falta `ensure_*` (pendência MÉDIO) |
| Notas / Documentos fiscais + NFS-e | 🟡 Funcional | `fiscal_documents` sem `ensure_*` (pendência MÉDIO) |
| Contabilidade gerencial (DRE, plano de contas, impostos) | 🟢 Estável | |
| Qualidade (PBQP-H Nível B) | 🟢 Estável | Auto-curado |
| Plugins / Seletividade / Viabilidade | 🟢 Estável | |
| RDO | 🟢 Estável | Cabeçalho/rodapé da empresa |
| Configurações / RBAC / Usuários / Backup / Auditoria | 🟢 Estável | |

🟢 estável · 🟡 funcional com ressalva · 🔴 quebrado (nenhum)

---

## 3. Problemas conhecidos e pendentes

### Corrigidos nesta varredura (v1.12.0)

| Prioridade | Categoria | Problema | Arquivo | Correção |
|---|---|---|---|---|
| ALTO | Segurança (XSS armazenado) | `bars()`/`kpi()`, `<option>`/cabeçalhos, `nameOf()` em cards injetavam dados do banco sem escape | `app.js` (4344, 4367, 3865, 3976, 7093, 7105, 4299, 4302, 7495, 7496, 7652) | `svgText()` |
| CRÍTICO | Bug | `uid()` inexistente quebrava import local de CSV SINAPI | `app.js` (10444, 10457) | `crypto.randomUUID()` |
| ALTO | Bug (500) | Aprovar marco → `accounts_receivable` sem colunas de referência → 500 + rollback | `api/index.php` (`automate_approved_milestone` 7190; `ensure_referencia_columns` 2527) | colunas em `accounts_receivable` + guarda no bootstrap |
| ALTO | Segurança | `forced-change-password` = oráculo de força bruta/enumeração sem rate limit | `api/index.php` (`handle_forced_change_password` 6126) | rate limit (contexto login) + registro + auditoria |
| ALTO | Segurança | Diretório `.git` exposto via HTTP | `.htaccess` | `RedirectMatch 404 /\.git` |
| CRÍTICO | Bug (500) | (rodada anterior) Parcelas recorrentes davam 500 sem as colunas | `api/index.php` | `ensure_payable_recurrence_columns` |

### Pendentes — aguardando aprovação

**MÉDIO (corrigir em breve)**
- **`fiscal_documents` sem `ensure_*`** — POST de NF / importação NFS-e dá 500 em servidor que não rodou `2026-06-06-fiscal-documents.sql`. *Sugestão:* criar `ensure_fiscal_documents_table()` espelhando a migração e chamar no ramo `fiscalDocuments`/NFS-e.
- **`agenda_eventos` + `kanban_*` sem `ensure_*`** — `?module=agenda` dá 500 sem `2026-06-09-agenda-kanban.sql`. *Sugestão:* `ensure_agenda_tables()`/`ensure_kanban_tables()`.
- **`system_users` (`email`/`blocked`/`mustChangePassword`) sem `ensure_*`** — `authenticate_request` seleciona `u.blocked` literalmente; banco sem a coluna → 500 em toda request autenticada. *Sugestão:* estender `ensure_users_extra_columns()`.
- **`applyFilters` deixa passar registro com campo vazio** (`app.js` 2603) — filtros de cliente/status/categoria ficam furados. *Sugestão:* comparação estrita `String(row[key] || "") !== String(filters[key])`.

**BAIXO (defesa em profundidade / polimento)**
- Upload de logo **SVG** sem sanitização de conteúdo (mitigado pela CSP).
- Senha **legada em texto puro** aceita durante a transição `mustChangePassword`.
- `load_config()`/`db()` **fora do try/catch** global (vaza DSN se `display_errors=On`).
- **XXE**: `simplexml_load_string` sem `LIBXML_NONET` (mitigado pelo PHP 8).
- `proposalBody` reinjetado como **HTML cru** do banco.
- `bootstrapApp()` **sem `.catch`** (tela branca se `restoreSession` lançar).
- `generatedLink` vira `<a href>` sem validar esquema (`javascript:` passa pelo escape).

### Pontos fortes confirmados (não re-sinalizar)
Prepared statements em todo SQL (sem SQLi); autorização por rota/perfil após
`authenticate_request`; token de sessão CSPRNG + SHA-256 + idle 30 min/TTL 12 h;
`password_hash` (bcrypt); rate limit de login/reset; CSRF mitigado por auth via
header (sem cookie); uploads fora do docroot e não executados; deploy com HMAC +
`escapeshellarg`; headers CSP/HSTS/X-Frame-Options/nosniff presentes; erros
detalhados só no `error_log`, cliente recebe mensagem genérica.

---

## 4. Próximos passos sugeridos

1. **Fechar as pendências MÉDIO** (todas são `ensure_*` faltando + 1 filtro) — baixo risco, alto valor; elimina 500 em instalações sem migração.
2. **Rodar as migrações pendentes em produção** (lista no `README.md`) — a auto-cura cobre as principais, mas a migração é o caminho recomendado.
3. **Itens BAIXO de hardening** conforme janela de manutenção.
4. **Dívida técnica:** modularizar `app.js`/`index.php` (arquivos únicos muito grandes); camada única de helpers de data/dinheiro/texto seguro.
5. **Testes mínimos** para login, bootstrap, recorrência, aprovação de marco e importações.

---

## 5. Como continuar o desenvolvimento

- Leia `CLAUDE.md` (convenções) e a seção "Para quem está retomando" do `README.md`.
- **Antes de SQL:** confira nomes reais de colunas (camelCase). **Antes de salvar:** `php -l api/index.php` e `node --check app.js`.
- Feature nova = **migração + `ensure_*`** (auto-cura) + escape de HTML no frontend.
- Atualize `APP_VERSION`/`APP_CHANGELOG` (app.js), `?v=` em `index.html`, cabeçalho do `README.md`, `CLAUDE.md` e este `STATUS.md`.
- Commit local com a mensagem pedida; `git push` é manual. Após o push: `cd /var/www/financeiro && git pull origin main` no servidor.

---

## 6. Stack e ambiente

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + CSS + JavaScript puro (sem framework/build) — `app.js`, `index.html`, `styles.css` |
| Backend | PHP (API única `api/index.php`), roteamento REST + `?module=` |
| Banco | MariaDB/MySQL `utf8mb4` |
| Servidor | Apache (`.htaccess` na raiz e em `api/`), mod_rewrite/headers |
| Config | `/etc/financeiro/config.php` (fora do docroot) |
| Dados | `/var/lib/financeiro` (uploads, backups, deploy.log) |
| Deploy | `deploy.php` (webhook GitHub, HMAC-SHA256) + `backup-pre-deploy.sh` |
| Auth | Token de sessão (`api_sessions`), `Authorization: Bearer`, RBAC por `role_permissions` |

---

## 7. Tabelas do banco e seus propósitos (principais)

- **Cadastros:** `clients`, `suppliers`, `products`, `services`, `financial_categories`, `cost_centers`, `bank_accounts`, `formas_pagamento`.
- **Obras:** `projects`, `obra_cronograma_etapas`, `obra_cronograma_marcos`, `obra_etapas_padrao`, `obra_marcos_padrao`, `obra_tipos`, `obra_status`, `obra_campos_personalizados`, `obra_valores_personalizados`, `obra_notificacoes`, `obra_links_acompanhamento`, `purchase_orders`, **`purchase_order_items`**, `technical_reports`.
- **SINAPI/Orçamentos:** `sinapi_referencias`, `sinapi_insumos`, `sinapi_composicoes`, `sinapi_composicao_itens`, `sinapi_mao_de_obra`, `sinapi_familias_coeficientes`, `sinapi_manutencoes`, `sinapi_configuracoes`, `orcamentos_obras`, `orcamento_obra_itens`, **`orcamento_etapas`**, **`orcamento_item_execucao_log`**, `composicoes_proprias`, `cotacoes`, `sinapi_import_jobs`.
- **Comercial:** `commercial_proposals`, `proposta_itens`, `proposta_arquivos`, `proposta_status_historico`, `proposta_orcamento_vinculos`, `proposta_variaveis`, `proposal_models`, `proposal_areas`, `proposal_action_types`, `proposal_service_subtypes`, `budgets`, `sales_contracts`.
- **Financeiro:** `accounts_receivable`, `accounts_payable`, `cash_bank_movements` (todas com `referencia_tipo`/`referencia_id` para anti dupla contagem e automações); OFX: `ofx_imports`, `ofx_fitids`.
- **Contabilidade:** `chart_accounts`, `journal_entries`, `taxes`, `tax_documents`, `fiscal_documents`, `tipos_documento`.
- **Produtividade:** `agenda_eventos`, `kanban_boards`, `kanban_colunas`, `kanban_cards`, `checklists`, `checklist_itens`, `mensagens_padrao`, `modelos_relatorio`, `tipos_medicao`.
- **Qualidade (PBQP-H):** `qualidade_politica`, `qualidade_pqo`, `qualidade_pes`, `qualidade_fvs`, `qualidade_fvm`, `qualidade_nc`, `qualidade_treinamentos`, `qualidade_auditorias`.
- **Plugins/análises:** `system_plugins`, `viability_analyses`.
- **Sistema:** `system_users`, `role_permissions`, `regras_visualizacao`, `company_settings`, `system_preferences`, `sistema_versoes`, `api_sessions`, `password_reset_tokens`, `audit_log`, `login_attempts`, `eventos_automacao`.

---

## 8. Endpoints disponíveis (resumo)

**REST / autenticação**
- `POST /api/login`, `POST /api/logout`, `GET /api/bootstrap`
- `POST /api/request-password-reset`, `POST /api/reset-password` *(públicos)*
- `POST /api/forced-change-password` *(troca obrigatória, com rate limit)*
- `GET /api/check-session`
- CRUD genérico por recurso (`/api/<recurso>` GET/POST/PUT/DELETE), autorizado por módulo/ação
- `POST /api/migrate`, `GET /api/backup/export`, `POST /api/backup/import` *(admin)*
- `POST /api/sinapi-upload|sinapi-import|sinapi-import-async`, `GET /api/sinapi-import-status`
- `POST /api/nfse-preview|nfse-import`, `POST /api/ofx-preview|ofx-import|ofx-conciliar`, `GET /api/ofx-history`
- `GET /api/notas-fiscais/{id}/pdf|xml?token=...` *(download por link direto)*

**Por `?module=` (`{success,data,message}`)**
- `GET ?module=dashboardExecution&action=summary`
- `POST ?module=workBudgetExecution&action=update` · `GET …&action=history`
- `?module=orcamentoEtapas` (CRUD das etapas)
- `?module=purchaseOrderItems&action=list|saveBulk`
- `?module=payable&action=create_recurrence|early_settlement|update_scope|cancel_recurrence` · `GET …&action=group`
- `?module=cashMoves&action=create|link`
- `?module=costCenters&action=list|get|create|update|delete`
- `GET ?module=clients&action=get&id=`
- `?module=agenda`
- `GET ?module=companySettings&action=getLogo` *(público — logo em `<img>`)*

---

## 9. Fluxos de automação implementados

- **Marco de obra aprovado/concluído** → cria **Conta a Receber** (`automate_approved_milestone`), proporcional ao valor do contrato × percentual, com referência cruzada `MARCO` (corrigido nesta versão: colunas em `accounts_receivable`).
- **Pedido de compra aprovado/recebido** → automações em `purchase_orders` (transacional).
- **Conta a pagar recorrente** → gera N parcelas (`payable_create_recurrence`), com quitação antecipada (juros/desconto) e cancelamento de recorrência.
- **Caixa ↔ Conta a pagar** → vínculo por `referencia_tipo`/`referencia_id` evitando dupla contagem no centro de custo (`cash_move_create_linked`).
- **Importação NFS-e (ABRASF)** → emitidas viram **Contas a Receber**, recebidas viram **Contas a Pagar**, cada NF gera `fiscal_documents`; cria cliente/fornecedor a partir do XML quando ausente.
- **Conciliação OFX** → match por valor+data e **baixa automática** de contas a pagar/receber; duplicatas barradas por FITID.
- **Proposta aprovada** → conversão em Venda/Contrato → geração de Conta a Receber, mantendo vínculos.
- **Bootstrap self-healing** → funções `ensure_*` criam tabelas/colunas novas sob demanda no primeiro acesso (auto-cura sem migração manual).
- **Auditoria** → `server_audit()` grava ações em `audit_log`; `eventos_automacao` registra automações; `login_attempts` sustenta o rate limit.
