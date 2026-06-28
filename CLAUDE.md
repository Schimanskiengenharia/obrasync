# CLAUDE.md — Guia para agentes de IA no projeto ObraSync

> **Versão atual:** `v1.18.0` · 2026-06-28
> **Última varredura de código:** 2026-06-27 (3ª rodada — segurança, bugs, performance, qualidade, UX; itens MÉDIO/BAIXO fechados na v1.12.1)
> **Handoff:** este doc foi atualizado na v1.18.0 para troca de IA — confira a seção **Sessão 2026-06-28 — v1.18.0** e **Operação/Deploy (handoff)** abaixo.

Este arquivo orienta qualquer agente (ou pessoa) que continue o desenvolvimento.
Leia também o `README.md` (seção "Para quem está retomando o projeto") e o
`STATUS.md` (estado executivo, módulos, pendências e próximos passos).

---

## Arquitetura (resumo)

- **SPA sem build.** Frontend: `app.js` (arquivo único, ~15 mil linhas) + `index.html` (shell) + `styles.css`. Backend: `api/index.php` (arquivo único, ~8,7 mil linhas). Banco: MariaDB/MySQL (`utf8mb4`).
- **Frontend:** objeto global `db`; `render()` despacha por `currentModule`; HTML montado por template strings e injetado com `innerHTML`.
- **Backend:** roteamento por `path` (REST) e por `?module=...&action=...`; CRUD genérico via `resource_map()` + `insert_dynamic()`/`update_dynamic()` (descartam colunas inexistentes — toleram diferenças de schema).

## Convenções obrigatórias (siga-as)

- **Antes de qualquer SQL:** rode `SHOW TABLES`/`DESCRIBE` (ou, sem acesso ao banco, confira `schema.sql` + migrations + as queries no código — são a fonte da verdade) e use os **nomes reais**. O schema é **MISTO**: a API/tabelas antigas são camelCase em inglês (`costCenterId`, `dueDate`, `projectId`, `unitPrice`, `zipCode`); as tabelas/colunas novas (2026-06) são snake_case em português (`analise_id`, `usa_endereco_empresa`, `bdi_grupo`, `status_contrato`, `estrutura_json`). **Documente como está de fato; não duplique colunas existentes** (ex.: obra reaproveita `projects.address`/`zipCode` — NÃO crie `obra_cep`). Migrations sempre com `IF NOT EXISTS`.
- **Antes de salvar:** valide a sintaxe — `php -l api/index.php` e `node --check app.js`.
- **Backend:** respostas REST via `respond(['ok' => true, 'data' => ...])` e erros via `fail($msg, $status)`; módulos `?module=` respondem `{success, data, message}`. Auditoria via `server_audit()`. Tabelas/colunas novas devem ter **`ensure_*`** no `index.php` (não só migração) para auto-cura em produção.
- **Frontend:** chamadas autenticadas via `apiRequest()` / `apiModuleRequest()`; uploads via `fetchForm()`; toasts via `showToast()`. **Sempre** escape de dados do banco em `innerHTML` com `svgText()` / `escapeHtml()`. IDs novos via `crypto.randomUUID()` (não existe `uid()`).
- **Cache busting:** ao mudar `app.js`/`styles.css`, incremente `?v=NNNN` em `index.html` (hoje `app.js?v=1769`, `styles.css?v=1769`) e a constante `APP_VERSION` no topo de `app.js`.
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

## Sessão 2026-06-28 — v1.18.0 (Orçamento→Proposta SINAPI, contrato, CEP universal)

Leva `v1.15→v1.18`. **Tabelas/colunas reais** (conferidas no código):

**Proposta (fluxo central):**
- `commercial_proposals` (+ `bdi_geral`, `bdi_tipo`, `custo_total_orcamentos`, `valor_bdi_total`, `modo_licitacao`).
- `proposta_itens` (FK **`proposalId`**; + `custo_unitario`, `bdi_item`, `orcamento_item_id`, `sinapi_id`, `grupo_id`).
- `proposta_orcamento_vinculos` = o vínculo proposta↔orçamento e o conceito de "grupos" (+ `nome_grupo`, `bdi_grupo`, `custo_total`, `valor_venda`, `ordem`, `grupo_id`, `disciplina`).
- `proposta_grupos` (NOVA): `proposalId`, `parent_id`, `nivel`, `ordem`, `disciplina`, `nome` — árvore por disciplina.
- `proposta_modelos` (NOVA): `nome`, `descricao`, `disciplina`, `estrutura_json`, `ativo` — modelos reutilizáveis.
- ⚠️ **NÃO existem `proposta_orcamentos`** (papel é do `proposta_orcamento_vinculos`).
- Frontend: `proposalGroupsCompute()`, `renderProposalGroupsPanel()`, `proposalDocumentHtml()`, `saveGeneratedProposal()`/`createProposalLinkedRecords()`, `proposalSinapiAnexoHtml()`, `exportSinapiExcel()`, `saveProposalAsTemplate()`/`applyProposalTemplate()`.

**Orçamento/obra:** `orcamentos_obras` (header) + `orcamento_obra_itens` (FK `workBudgetId`; tem `sinapi_id`, `etapa_id`, `tipo`, `stageName`, `bdiPercent`, `quantidade_realizada`, `projectId`). `projects` (+ `usa_endereco_empresa`, `bairro`, `cidade`, `estado`; reaproveita `address`/`zipCode`).

**SINAPI:** `sinapi_composicoes` (`code`, `description`, `unit`, `unitCost`, `sinapiReferenceId`), `sinapi_referencias` (`referenceMonth`, `referenceYear`, `uf`, `priceType`). Endpoints novos: `GET api/sinapi-buscar?q=`, `GET api/sinapi-export-obra?obra_id=` (PhpSpreadsheet).

**Contrato:** `sales_contracts` reaproveita `proposalId`; + `numero_contrato`, `data_contrato`, `valor_contrato`, `objeto`, `status_contrato`, `proposta_assinada_path`, `contrato_gerado_path`, `contrato_assinado_path`, snapshot (`cliente_nome`, `cpf_cnpj`, `email`, `telefone`, `endereco`, `cidade`, `estado`, `cep`). Endpoints: `POST api/contrato-upload`, `GET api/contrato-download`. Frontend: `generateContractFromProposal()`, `contractPdfHtml()` (13 cláusulas, impressão pelo navegador), `openContractAnexos()`.

**Viabilidade (PT-BR, tabelas próprias — não confundir com `viability_analyses`):** `viabilidade_analises`, `viabilidade_grupos` (`analise_id`), `viabilidade_itens` (`analise_id`, `grupo_id`), `viabilidade_anexos` (**`item_id`**, `caminho`). ⚠️ **anexo liga-se à análise SÓ via item** (`JOIN viabilidade_itens`). Action nova: `?module=viabilidade&action=delete` (cascata transacional + apaga arquivos do disco com proteção path-traversal). Handler: `handle_viabilidade_module` (~linha 4076); `delete_item` por volta de 4301.

**CEP universal:** `connect-src` no `.htaccess` libera `viacep.com.br`/`brasilapi.com.br` (a regressão era o CSP). `bindCepInput`/`initFormEnhancers` (MutationObserver) ligam `.cep-input`/`[name=zipCode|cep|obra_cep]` em todo form; `setupClientAutofill`/`setupSupplierAutofill` auto-ligados a selects de cadastro.

**Migrations da leva:** `2026-06-28-orcamento-proposta-sinapi.sql`, `2026-06-28-obra-endereco-local.sql`, `2026-06-28-proposta-hierarquia-modelos.sql`, `2026-06-28-contrato-proposta-anexos.sql` (todas idempotentes + `ensure_*`). A exclusão de viabilidade não tem migration.

## Operação/Deploy (handoff)

- **Fluxo de deploy:** editar no PC (VS Code) → `git commit` local → **`git push`** quando o usuário pedir → no servidor `cd /var/www/financeiro && git stash && git pull origin main` (o `git stash` evita conflito quando o working tree do servidor tem mudanças locais, ex.: `.htaccess`/permissões) → **rodar as migrations novas** manualmente (`mysql -u root -p financeiro < migrations/<arquivo>.sql`) → no navegador **Ctrl+Shift+R** (hard refresh) para pegar o novo `?v=`.
- **CRLF/LF:** edite mantendo **LF** (o repo é Unix). Cuidado com o VS Code no Windows convertendo para CRLF — pode sujar diffs e quebrar shebangs de scripts.
- **`.htaccess` no pull:** se o `git pull` reclamar de conflito local no `.htaccess`, usar `git stash` antes (ou `git checkout -- .htaccess`) — não editar o `.htaccess` direto no servidor sem commitar.
- **fail2ban:** o servidor tem fail2ban; cuidado com tentativas repetidas de login/SSH durante testes para não se auto-bloquear.
- **Auto-cura `ensure_*`:** o bootstrap roda funções `ensure_*` que criam tabelas/colunas faltantes em runtime — então um deploy sem rodar a migration normalmente **não quebra** (mas rode a migration para consistência). Toda feature nova com tabela/coluna deve ter migration **e** `ensure_*`.
- **Dependências externas:** Excel (cotações e SINAPI) exige `composer require phpoffice/phpspreadsheet`; PDF de cotação exige `poppler-utils` (`pdftotext`). Sem elas, os endpoints retornam 422 orientando.
- **Nunca** toque em `/etc/financeiro/config.php`, uploads, backups ou o banco diretamente.

## Sessão 2026-06-28 — v1.14.0 (cotações, PBQP-H Fase 1, viabilidade, dashboard, fix do 500)

**Features novas**
- **Cotações (importar/comparar)** — `?module=cotacoes&action=importar|comparar|salvarItens|exportarCsv`; tabelas `cotacao_fornecedor`/`cotacao_itens` (`ensure_cotacao_import_tables`; migration `2026-06-27-cotacao-importacao.sql`). CSV nativo; **.xlsx/.xls** exigem **PhpSpreadsheet**; **PDF** exige **pdftotext/poppler-utils** (ver seção "Dependências do módulo de Cotações"). Comparação por similaridade de descrição contra `orcamento_obra_itens`.
- **PBQP-H Fase 1** — qualificação de fornecedores de materiais controlados, rastreabilidade por lote, vínculo **FVM ↔ pedido de compra**, **PDF no PES** (migrations `2026-06-27-pbqph-fase1.sql`, `2026-06-27-qualificacao-fornecedores.sql`).
- **Análise de Viabilidade por tipo de obra** — checklist com grupos/itens padrão, progresso automático, anexos, PDF e **bloqueio de proposta** com item obrigatório reprovado (migration `2026-06-27-viabilidade-modulo.sql`). Módulo independente, sem duplicata no Comercial.
- **Ícones Tabler locais** — webfont v2.47.0 self-hosted (`assets/fonts/tabler-icons.min.css` + `.woff2`); CSP `font-src 'self'`. Subitens da sidebar com ícones coloridos + animação corrigida. **Atenção:** nem todo nome existe na v2.47 (`ti-steps`→`ti-stairs`, `ti-layers`→`ti-stack-2`); confirme o nome antes de usar.

**Dashboard — Lucro Gerencial vs Caixa Real**
- **Lucro** = todas as contas com vencimento no período (qualquer status exceto cancelada), por `dueDate`. **Caixa** = `receivedDate` recebidas − `paidDate` pagas. **A Receber Líquido = Lucro − Caixa** (pode ser legitimamente negativo). Cores das séries: `#185FA5` (lucro) / `#3B6D11` (caixa). Helpers de status são case-insensitive (`normFinStatus`/`isRecebido`/`isPago`/...).

**Correção crítica — 500 em contas a pagar recorrentes**
- Raiz: `const PAYABLE_RECURRENCE_MAX`/`PAYABLE_RECURRENCE_INDETERMINADO` estavam **no meio** do `index.php`. O roteamento é **inline** (`try` ~linha 40 até o `catch`) e dá `exit` antes de alcançá-las; **`const` em PHP não é "hoisted"** → ficavam **indefinidas em runtime**. Movidas para o **topo** (junto de `AUTH_*`/`LOGIN_*`/`SINAPI_*`, antes do roteamento). `MAX=600` (≈50 anos mensais), `INDETERMINADO=24`. Também há blindagem de FK na geração das parcelas. **Lição:** toda constante usada pelo código alcançado durante o roteamento DEVE ser definida antes da linha ~40.

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
| Qualidade (PBQP-H) | ✅ Estável (auto-curado por `ensure_qualidade_tables`). **Fase 1:** qualificação de fornecedores, rastreabilidade por lote, FVM↔pedido, PDF no PES. |
| Cotações (importação/comparação) | ✅ PDF/Excel/CSV → comparação com o orçamento. Excel exige PhpSpreadsheet; PDF exige pdftotext. |
| Plugins / Viabilidade / SINAPI | ✅ Estável. Viabilidade por tipo de obra com checklist e bloqueio de proposta. |
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

---

## Dependências do módulo de Cotações (importação PDF/Excel)

`?module=cotacoes&action=importar|comparar|salvarItens|exportarCsv` (tabelas `cotacao_fornecedor`/`cotacao_itens`, auto-curadas por `ensure_cotacao_import_tables`).

- **CSV**: lido nativamente (`fgetcsv`) — **sem dependência**. Detecta cabeçalho (descrição/unidade/qtd/valor unit./total/marca/prazo) e separador `;`/`,`.
- **.xlsx/.xls**: exigem **PhpSpreadsheet** no servidor. Sem ela, o endpoint retorna 422 orientando. Instalar:
  ```
  cd /var/www/financeiro && composer require phpoffice/phpspreadsheet
  ```
  O loader procura `vendor/autoload.php` automaticamente.
- **PDF**: exige **pdftotext** (pacote `poppler-utils`). Sem ele, retorna 422. Instalar:
  ```
  sudo apt install poppler-utils
  ```
  Extração por regex é heurística (revisar itens antes de comparar).
- **Comparação** com o orçamento usa `orcamento_obra_itens` (`description`, `unitPrice`) por similaridade de descrição; classifica em abaixo/igual/acima/muito_acima e calcula o score.
