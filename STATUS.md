# STATUS — ObraSync

> **Versão:** `v1.19.0` · 2026-06-28 · **Varredura:** 2026-06-27 · **Ambiente:** produção em `https://schimanskiengenharia.com.br/financeiro`

---

## 1. Resumo executivo

ObraSync é um ERP web de gestão integrada de obras, financeiro, comercial e
contabilidade gerencial para a Schimanski Engenharia. SPA em JavaScript puro
(`app.js`), API única em PHP (`api/index.php`), banco MariaDB/MySQL. Sem
frameworks e sem etapa de build.

O sistema está **em produção e estável**. A leva **v1.15→v1.18 (2026-06-28)**
entregou o fluxo **Orçamento → Proposta com base SINAPI**: busca rápida na base
SINAPI, proposta usando o **custo do orçamento técnico**, **múltiplos orçamentos**
com **BDI ponderado**, **BDI flexível** (geral/por grupo/manual por item), **modo
licitação** (comparativo SINAPI × ofertado), **hierarquia por disciplina** e
**modelos reutilizáveis** de proposta, **SINAPI no PDF** + **export Excel** por
obra, e **contrato a partir da proposta** (template de 13 cláusulas + anexos
assinados). Também: **CEP autofill universal** (corrigindo a regressão do CSP que
bloqueava o ViaCEP) com **autofill de cadastro** de cliente/fornecedor em todos os
forms e **endereço próprio da obra**, a **exclusão de análise de viabilidade**
inteira (cascata + arquivos), e o **fix do `asDate`** (Viabilidade que travava no
load). A v1.14.0 entregou cotações, PBQP-H Fase 1, Viabilidade e o dashboard
Lucro×Caixa. A base herda a v1.12.0/v1.12.1 (Orçamento profissional + varredura de
segurança completa). **Atenção:** parte da v1.18.0 (export Excel, anexos de
contrato, PDF do contrato) **ainda não foi validada em runtime no servidor** — ver
seção 3.

Na **v1.19.0**, a Base SINAPI ganhou importação mensal por pacote com upload múltiplo, prévia, histórico por arquivo, reimportação controlada, referência padrão atual e snapshot do item SINAPI no orçamento. A leitura de XLSX agora exige PhpSpreadsheet.

---

## 2. Módulos implementados e status

| Módulo | Status | Observação |
|---|---|---|
| Dashboard (geral + por obra) | 🟢 Estável | Painel de execução de obras (endpoint + tooltip combinado); Lucro Gerencial vs Caixa Real recalculado + alertas (v1.14.0) |
| Cadastros (clientes, fornecedores, produtos, serviços, categorias, centros de custo, contas) | 🟢 Estável | CEP autofill **universal** (`.cep-input`, ViaCEP+BrasilAPI) em todos os forms; autofill de cliente **e fornecedor**; endereço próprio da obra com toggle (v1.18.0) |
| Orçamento de Obra | 🟢 Estável | Etapas/tipos/4 visões/BDI por etapa/CSV + Realizado vs Orçado; busca SINAPI na base completa (v1.18.0) |
| SINAPI / composições / cotações / Curva ABC | 🟢 Estável | Importador XLSX/CSV + assíncrono; cotações (v1.14.0); busca rápida `sinapi-buscar` + **export Excel por obra** `sinapi-export-obra` (PhpSpreadsheet) (v1.18.0) |
| Financeiro (a pagar, a receber, caixa, fluxo) | 🟢 Estável | Recorrentes (500 corrigido na v1.14.0), quitação antecipada, anti dupla contagem |
| Conciliação OFX | 🟢 Estável | Match automático por FITID |
| Pedidos de compra | 🟢 Estável | Itens detalhados, condições, impressão com identidade visual |
| Comercial (propostas, gerador, modelos, contrato) | 🟢 Estável | Proposta usa custo do orçamento; **múltiplos orçamentos** + BDI ponderado; **BDI flexível**; **licitação**; **hierarquia por disciplina**; **modelos** (`proposta_modelos`); SINAPI no PDF + anexo; **contrato a partir da proposta** (13 cláusulas) + anexos assinados (v1.18.0) |
| Cronograma / Gantt / MS Project | 🟡 Funcional | Aprovação de marco corrigida (era 500 determinístico) |
| Agenda / Kanban | 🟢 Estável | Auto-curado por `ensure_agenda_tables`/`ensure_kanban_tables` (v1.12.1) |
| Notas / Documentos fiscais + NFS-e | 🟢 Estável | Auto-curado por `ensure_fiscal_documents_table` (v1.12.1) |
| Contabilidade gerencial (DRE, plano de contas, impostos) | 🟢 Estável | |
| Qualidade (PBQP-H Nível B) | 🟢 Estável | Auto-curado; Fase 1: qualificação de fornecedores, rastreabilidade por lote, FVM↔pedido, PDF no PES (v1.14.0) |
| Plugins / Seletividade / Viabilidade | 🟢 Estável | Viabilidade por tipo de obra com checklist e bloqueio de proposta (v1.14.0); **exclusão de análise inteira** em cascata + arquivos (v1.18.0) |
| RDO | 🟢 Estável | Cabeçalho/rodapé da empresa |
| RH / Pessoal | 🟡 Funcional | **F1 implementada**: cadastro de colaboradores (próprio/diarista/autônomo/empreiteira), documentos com anexo e badges de vencimento (`rhDocSituacao`/`rhDocBadge`, reusa `q-badge`), painel Vencimentos e bloco no dashboard; acesso restrito a `gestor_obra` (LGPD). **F2** (alocação em obras) e **F3** (pagamentos) pendentes (v1.35.0) |
| Configurações / RBAC / Usuários / Backup / Auditoria | 🟢 Estável | |

🟢 estável · 🟡 funcional com ressalva · 🔴 quebrado (nenhum)

---

## 3. Problemas conhecidos e pendentes

### v1.19.0 — FEITO vs PENDENTE

**✅ FEITO em código e validado por sintaxe:**
- Base SINAPI com importação mensal por pacote, prévia persistida, fila via `sinapi_import_jobs`, histórico em `sinapi_import_files`, log em `sinapi_import_errors`, opção manter/substituir e referência padrão atual.
- `sinapi-buscar` mantém compatibilidade com `q=` e usa a referência padrão quando o usuário não informa filtro.
- Item do orçamento preserva snapshot SINAPI (`sinapiSnapshotJson`) além das colunas já existentes (`code`, `description`, `unit`, `unitCost`, `sinapiReferenceId`, `sinapiUf`, `sinapiReferenceType`).

**🟡 PENDENTE de validação em runtime no servidor:**
- Rodar a migration `2026-06-28-sinapi-importacao-mensal.sql`.
- Instalar/confirmar PhpSpreadsheet: `cd /var/www/financeiro && composer require phpoffice/phpspreadsheet`.
- Testar com os quatro XLSX oficiais da CAIXA da mesma competência e conferir permissões de `/var/lib/financeiro/uploads/sinapi` e `/var/lib/financeiro/sinapi_jobs`.

### v1.18.0 — FEITO vs PENDENTE (honesto)

**✅ FEITO e validado em runtime** (o usuário confirmou "está funcionando"):
- Fluxo proposta base SINAPI: múltiplos orçamentos, BDI flexível, licitação, busca SINAPI.
- `asDate` corrigido — Viabilidade abre normal.
- CEP autofill universal + CSP corrigido; autofill de cliente/fornecedor; toggle de endereço da obra.
- Exclusão de análise de viabilidade.

**🟡 FEITO mas PENDENTE de validação em runtime no servidor** (implementado + `php -l`/`node --check` OK, **mas não testado em produção** — exige dependências/arquivos do servidor):
- **Export Excel SINAPI** (`sinapi-export-obra`): exige `composer require phpoffice/phpspreadsheet`. Sem ele → 422.
- **Anexos de contrato** (`contrato-upload`/`download`): grava em `/var/lib/financeiro/uploads/contratos` (dono `www-data`) — validar permissões.
- **PDF do contrato** (13 cláusulas): gerado pelo navegador; revisar o texto jurídico das cláusulas com o responsável antes de usar oficialmente.
- **Anexo SINAPI no PDF da proposta:** depende da composição estar no cache do front (itens adicionados via SINAPI ficam; itens antigos podem não exibir a tag).

**⏳ PENDENTE / próximos passos (não feito):**
- **Hierarquia de proposta:** a UI agrupa por disciplina e persiste em `proposta_grupos`/vínculos, mas **falta o editor visual da árvore n-níveis com drag-and-drop** (reordenar item↔subitem). Hoje a disciplina é atribuída por orçamento.
- **Modelos de proposta:** "Aplicar modelo" reusa a estrutura de orçamentos; a clonagem é por registros (não há endpoint transacional único de clonagem no servidor).
- **PBQP-H Fases 2 e 3** (após a Fase 1 entregue).
- **Dashboard Lucro Gerencial × Caixa Real:** recalculado na v1.14.0; revalidar os números com dados reais (o usuário já questionou casos "Lucro < Caixa" — são legítimos quando há contas a pagar abertas).
- Rodar as 4 migrations da leva no servidor (idempotentes; `ensure_*` cobre, mas rodar dá consistência).

### Entregue / corrigido na v1.14.0 (2026-06-28)

| Tipo | Item | Arquivo | Detalhe |
|---|---|---|---|
| Bug (500) | Contas a pagar recorrentes davam 500 ao gerar parcelas | `api/index.php` (`PAYABLE_RECURRENCE_MAX`/`_INDETERMINADO`, `payable_create_recurrence`) | Constantes estavam no meio do arquivo; o roteamento inline dá `exit` antes de alcançá-las e `const` PHP não é "hoisted" → indefinidas em runtime. **Movidas para o topo** (antes do roteamento) + blindagem de FK na geração das parcelas. |
| Feature | Importação/comparação de cotações (PDF/Excel/CSV) | `api/index.php`, `app.js`, migration `2026-06-27-cotacao-importacao.sql` | `cotacao_fornecedor`/`cotacao_itens`; PhpSpreadsheet (.xlsx) e pdftotext (PDF) opcionais; comparação por similaridade com o orçamento. |
| Feature | PBQP-H Fase 1 | migrations `2026-06-27-pbqph-fase1.sql`, `…-qualificacao-fornecedores.sql` | Qualificação de fornecedores, rastreabilidade por lote, FVM↔pedido, PDF no PES. |
| Feature | Análise de Viabilidade por tipo de obra | migration `2026-06-27-viabilidade-modulo.sql` | Checklist com grupos/itens, progresso, anexos, PDF e bloqueio de proposta. |
| Correção | Dashboard Lucro Gerencial vs Caixa Real | `app.js` (`lucroCaixaCompute`/`lucroCaixaChart`) | Lucro = vencimentos do período (exceto cancelados); Caixa = recebido−pago efetivos; A Receber Líquido = Lucro−Caixa. Alertas (vencidos/atrasos/propostas/obras/estouro). |
| UX | Ícones Tabler locais (sem CDN) + subitens da sidebar visíveis | `index.html`, `styles.css`, `assets/fonts/` | Webfont v2.47.0 self-hosted (CSP `font-src 'self'`); animação corrigida (não ficam mais invisíveis). |
| UX | Cores por status em notas fiscais; gráficos do dashboard mais finos | `app.js`, `styles.css` | |

### Corrigidos nesta varredura (v1.12.0)

| Prioridade | Categoria | Problema | Arquivo | Correção |
|---|---|---|---|---|
| ALTO | Segurança (XSS armazenado) | `bars()`/`kpi()`, `<option>`/cabeçalhos, `nameOf()` em cards injetavam dados do banco sem escape | `app.js` (4344, 4367, 3865, 3976, 7093, 7105, 4299, 4302, 7495, 7496, 7652) | `svgText()` |
| CRÍTICO | Bug | `uid()` inexistente quebrava import local de CSV SINAPI | `app.js` (10444, 10457) | `crypto.randomUUID()` |
| ALTO | Bug (500) | Aprovar marco → `accounts_receivable` sem colunas de referência → 500 + rollback | `api/index.php` (`automate_approved_milestone` 7190; `ensure_referencia_columns` 2527) | colunas em `accounts_receivable` + guarda no bootstrap |
| ALTO | Segurança | `forced-change-password` = oráculo de força bruta/enumeração sem rate limit | `api/index.php` (`handle_forced_change_password` 6126) | rate limit (contexto login) + registro + auditoria |
| ALTO | Segurança | Diretório `.git` exposto via HTTP | `.htaccess` | `RedirectMatch 404 /\.git` |
| CRÍTICO | Bug (500) | (rodada anterior) Parcelas recorrentes davam 500 sem as colunas | `api/index.php` | `ensure_payable_recurrence_columns` |

### Corrigidos na rodada 3b — v1.12.1 (todos os MÉDIO/BAIXO)

**MÉDIO ✅**
- **`fiscal_documents` agora tem `ensure_fiscal_documents_table()`** — chamado em `save_fiscal_document`, na importação NFS-e e no bootstrap. Não dá mais 500 sem a migração.
- **`agenda_eventos` + `kanban_*` agora têm `ensure_agenda_tables()`/`ensure_kanban_tables()`** — chamados em `handle_agenda_module`, `ensure_project_kanban_boards` e no bootstrap.
- **`system_users`:** `ensure_users_extra_columns()` agora cria `email`/`blocked`/`mustChangePassword` (além de `cpf`/`data_nascimento`/`celular`) + guarda no bootstrap.
- **`applyFilters`** (`app.js`): comparação estrita `String(row[key] || "") !== String(filters[key])` — filtros não deixam mais passar registros com campo vazio.

**BAIXO ✅**
- Upload de logo **SVG** rejeita conteúdo ativo (`<script>`/handlers/`javascript:`/`<!ENTITY>`); ao servir SVG envia CSP `sandbox`.
- `display_errors=0` + `log_errors=1` no topo do `index.php` (nunca vaza DSN/stack trace, mesmo no caminho antes do try/catch).
- **XXE:** novo `safe_xml_load()` (rejeita DOCTYPE + `LIBXML_NONET`) usado em todos os parses de NFS-e/OFX/XLSX.
- `proposalBody` agora passa por `sanitizeStoredHtml()` (parse num `<template>` inerte + remoção de script/handlers) antes de ser injetado.
- `bootstrapApp()` agora tem `.catch` que revela a tela de login em vez de tela branca.

**Aceito por design (não alterado):**
- Senha **legada em texto puro** durante a transição `mustChangePassword` — é o fluxo documentado de primeiro login (seed → bcrypt no primeiro acesso); remover quebraria a ativação de instalações novas.
- `generatedLink` **já validava** o esquema (`^https?://`) — nada a fazer.

### Pontos fortes confirmados (não re-sinalizar)
Prepared statements em todo SQL (sem SQLi); autorização por rota/perfil após
`authenticate_request`; token de sessão CSPRNG + SHA-256 + idle 30 min/TTL 12 h;
`password_hash` (bcrypt); rate limit de login/reset; CSRF mitigado por auth via
header (sem cookie); uploads fora do docroot e não executados; deploy com HMAC +
`escapeshellarg`; headers CSP/HSTS/X-Frame-Options/nosniff presentes; erros
detalhados só no `error_log`, cliente recebe mensagem genérica.

---

## 4. Próximos passos sugeridos

1. ✅ **Pendências MÉDIO/BAIXO fechadas na v1.12.1** (todos os `ensure_*` faltantes + XXE + SVG + filtros + tela inicial).
2. **Rodar as migrações pendentes em produção** (lista no `README.md`) — a auto-cura cobre, mas a migração continua sendo o caminho recomendado.
3. **Dívida técnica:** modularizar `app.js`/`index.php` (arquivos únicos muito grandes); camada única de helpers de data/dinheiro/texto seguro.
4. **Testes mínimos** para login, bootstrap, recorrência, aprovação de marco e importações.
5. **Avaliar** mover o token de sessão do `localStorage` para cookie `HttpOnly`/`SameSite` (remove a superfície de roubo via XSS de vez).

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
