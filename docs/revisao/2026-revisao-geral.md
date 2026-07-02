# Revisão geral do ObraSync — Passada 1 (diagnóstico)

> **Data:** 2026-07-01 · **Base:** v1.25.1 — `api/index.php` (12.648 linhas), `app.js` (17.206 linhas),
> `schema.sql` (1.602), `styles.css`, `migrations/` (46 arquivos), `scripts/` (4 workers), `api/cron/jobs.php`.
> **Método:** varredura ampla por 4 frentes independentes (matriz de auth, segurança/integridade backend,
> frontend, schema×migrations), com verificação cruzada código×banco.
> **Nada foi corrigido nesta passada — só diagnóstico.**
>
> Itens já documentados como corrigidos (v1.12.x) ou aceitos por design no CLAUDE.md **não** foram re-sinalizados.
> A revisão de navegação/menus está em relatório próprio: [`2026-menus-integridade.md`](2026-menus-integridade.md).

---

## 🔴 GRAVE (corrigir urgente)

**[G1] api/index.php:229-231 + 8899-8912 + 10534 — módulo `?module=ia` roteado SEM `authorize_request` (só sessão), incluindo ações de ESCRITA.**
`enviarParaOrcamento` cria `orcamentos_obras` + `orcamento_etapas` + `orcamento_obra_itens` em QUALQUER `projectId` sem checar permissão nem vínculo; `deparaUpload`/`comparaUpload` gravam uploads; `startIndex`/`deparaStart`/`comparaStart` spawnam workers (CPU/Ollama/disco). O comentário que justifica o gate ausente (223-228: "NÃO exigimos permissão de módulo 'ia'") é obsoleto — foi escrito quando IA era só ping; a escrita veio na v1.25.0.
**Impacto:** qualquer papel autenticado mínimo (`consulta`, `cliente_obra`, `fornecedor_terceiro`, `equipe_campo`) escreve dados orçamentários e abusa de recursos. É exatamente a classe de "gate quebrado" já vista antes no módulo ia.
**Fix:** `authorize_request($pdo,$authUser,'workBudgets',action_for_method($method))` por ação (ou permissão `ia` dedicada nos papéis); em `enviarParaOrcamento`, exigir `workBudgets/create` e validar o `projectId`.

**[G2] api/cron/jobs.php:60-71 × schema.sql:212-223 — `create_due_alerts()` insere em `obra_notificacoes` valores incompatíveis com o schema e DERRUBA a cadeia inteira do cron.**
Insere `type='ALERTA_VENCIMENTO'` e `status='Pendente'`, mas o schema define `type ENUM('WhatsApp manual')`, `status ENUM('Preparado','Enviado manualmente','Cancelado')`, `recipient VARCHAR(180) NOT NULL` (não enviado) e `projectId NOT NULL` (pode vir NULL de conta sem obra). Em sql_mode estrito (padrão MariaDB) o INSERT falha na 1ª conta vencendo e o catch global (jobs.php:28) aborta o cron.
**Impacto:** alertas nunca criados E `purge_old_audit_data`/`consolidate_monthly_dre` nunca executam — `audit_log`/`login_attempts` crescem sem limite. Em modo não-estrito, grava lixo ('' no enum).
**Fix:** enviar `recipient`, usar `status='Preparado'`, ampliar o ENUM de `type` (migration + ensure), pular contas sem `projectId`; e envolver CADA job do cron em try/catch próprio.

**[G3] schema.sql:657 (+ migrations/2026-06-06-fiscal-documents.sql:26) × api/index.php:786-790/2048 — cascata `projects → fiscal_documents` + `orcamentos_obras → orcamento_obra_itens` alcançável pelo DELETE genérico sem guarda.**
`DELETE /projects/{id}` (rota REST genérica, `delete_record`, sem verificação de dependentes além do RBAC) apaga em cascata: notas fiscais/documentos fiscais, orçamentos de obra inteiros (2 níveis), cronograma, marcos e notificações. Arquivos `pdfPath`/`xmlPath` ficam órfãos no disco.
**Impacto:** exclusão acidental de UMA obra destrói registros fiscais e orçamentos sem aviso — irreversível para o usuário `financeiro_app` (sem backup pontual).
**Fix:** `fiscal_documents.projectId` → `ON DELETE SET NULL` (coluna já é NULL no schema atual) ou `RESTRICT`; bloquear DELETE de projects com dependentes (contagem prévia + 409) ou soft-delete.

**[G4] Provisionamento do zero QUEBRADO — schema.sql defasado + 2 migrations fora de ordem.**
(a) `schema.sql` (arquivo inteiro): faltam 12+ tabelas que só existem em migrations/ensure_* (`proposta_grupos`, `proposta_modelos`, `viabilidade_*` ×4, `cotacao_fornecedor`, `cotacao_itens`, `orcamento_etapas`, `purchase_order_items`, `orcamento_item_execucao_log`, `eventos_automacao`) e dezenas de colunas (recorrência/juros/ofx nas contas, `bdi_*` em propostas, snapshot de contrato, `pbqph_*` em suppliers, etc.) — a premissa "schema.sql é fonte da verdade" mente para quem for instalar/consultar.
(b) migrations/2026-06-27-pbqph-fase1.sql:30,41: `ALTER TABLE qualidade_fvm/qualidade_pes` — tabelas que NENHUMA migration nem o schema.sql criam (só `ensure_qualidade_tables`, api/index.php:5341) → `mysql < arquivo` aborta.
(c) migrations/2026-06-08-sinapi-2026-04-ms-importer.sql:6,28: altera `sinapi_referencias`/`orcamentos_obras`, criadas pela migration `2026-06-08-sinapi-msproject-...` que ordena DEPOIS alfabeticamente → rodada sequencial em banco novo falha.
**Impacto:** instalação limpa por schema.sql+migrations não sobe; afeta também DR/ambiente de teste.
**Fix:** regenerar `schema.sql` do banco real (`mysqldump --no-data`); criar as `qualidade_*` em migration; renomear/fundir as migrations SINAPI para restaurar a ordem.

---

## 🟡 MÉDIO

**[M1] api/index.php:529 + handlers (viabilidade 4432/4460, payable 955, agenda 857, costCenters, purchaseOrderItems 4893, obra-disciplinas 501) — autorização dos módulos `?module=` deriva do MÉTODO HTTP (`action_for_method`), mas os handlers aceitam POST para delete/update.** `POST ?module=viabilidade&action=delete` (exclui análise + apaga arquivos) é autorizado como `create` — `canDelete`/`canEdit` não são realmente aplicados. **Fix:** autorizar pela ação resolvida no handler, não pelo método.

**[M2] api/index.php:3358-3374 — `cotacoes action=salvarItens` faz `DELETE FROM cotacao_itens WHERE cotacao_id=?` e reinsere SEM transação.** Falha no meio da reinserção (ex.: overflow de DECIMAL) perde os itens definitivamente. Mesmo padrão em `importar` (3320-3343) e `delete` (3467-3471). **Fix:** beginTransaction/commit + rollback no catch.

**[M3] scripts/ia_compara_worker.php:116-127 (idem ia_depara_worker.php:122-133) — mapas `code→id` carregam TODAS as `sinapi_composicoes`/`sinapi_insumos` sem filtrar pela referência `isDefault`;** códigos repetidos entre meses/UFs → o último id vence, e `matchValor`/comparação de preço podem usar referência antiga/arbitrária, distorcendo economia/excesso. **Fix:** filtrar por `sinapiReferenceId` da referência default.

**[M4] api/index.php:3408 + migrations/2026-06-27-cotacao-importacao.sql:41 — `cotacao_itens.diferenca_percentual DECIMAL(8,2)` sem clamp.** `(valor_unitario−unitPrice)/unitPrice*100` com `unitPrice` pequeno estoura 999.999,99 → `SQLSTATE[22003]`. MESMA classe do bug já corrigido no `diferencaPercent` do comparador (lá com DECIMAL(12,2)+clamp). **Fix:** clamp no PHP e/ou DECIMAL(12,2).

**[M5] api/index.php:5915 (`ensure_ofx_tables`) — `ofx_imports`/`ofx_fitids` não existem em schema.sql nem em migration** (a própria migration 2026-06-12 diz servir a "instalações com usuário sem DDL", mas não as cria) → módulo OFX quebra nesses ambientes. **Fix:** adicionar os CREATEs à migration e ao schema.sql.

**[M6] `fiscal_documents` com 3 definições divergentes** — migration 2026-06-06: `projectId NOT NULL`+FK CASCADE; schema.sql:640: NULL+CASCADE; `ensure_fiscal_documents_table` (api/index.php:2112): NULL e SEM FK. O `MODIFY ... NULL` só roda dentro de `ensure_ofx_tables` (endpoints OFX): instalação via migration que nunca usou OFX mantém NOT NULL e o lote NFS-e sem obra falha. **Fix:** migration própria do MODIFY + alinhar FKs.

**[M7] migrations/2026-06-28-proposta-hierarquia-modelos.sql:13 — `proposta_grupos` sem FK para `commercial_proposals` e sem limpeza no delete** (todas as demais `proposta_*` têm CASCADE) → árvore de grupos órfã ao excluir proposta. **Fix:** FK CASCADE ou limpeza no handler.

**[M8] Filhos sem FK acumulam órfãos ao excluir o pai pela rota genérica** — `orcamento_etapas.orcamento_id/obra_id`, `purchase_order_items.purchase_order_id` (o DELETE em api/index.php:4999 é só do saveBulk), `orcamento_item_execucao_log.item_id`, `viabilidade_analises.obra_id/proposta_id`, `agenda_eventos.obra_id`, `cotacao_fornecedor.obra_id`, `obra_rdo*.projectId`. **Fix:** FKs (CASCADE/SET NULL) ou limpeza explícita nos deletes.

**[M9] api/index.php:1724 — `sinapi_referencias` deletável pelo CRUD genérico** — cascata (schema.sql:901-976) apaga toda a base importada (insumos/composições/itens/MO/famílias — centenas de milhares de linhas) e `ia_embeddings` (sem FK) vira ponteiro morto. **Fix:** guarda dedicada com confirmação + limpeza de embeddings.

**[M10] app.js:5097 — `scheduleIaPoll()` só continua o polling se `currentModule === "plugins"`, mas o card vive no módulo `iaIndex`** (render 5026, despacho 2786) → o polling morre após o 1º ciclo; barra congela e botão fica em "Indexando…". Resquício de quando o card ficava em Plugins. **Fix:** `currentModule === "iaIndex"`.

**[M11] app.js:3698 (padrão repetido: 3668, 3516, 6688, 7773, 8045, 8571, 8599, 8627, 9479, 9510, 11296, 13606) — "hoje" via `new Date().toISOString().slice(0,10)` é data UTC:** no Brasil, a partir de ~21h vira "amanhã" — `isOverdue` marca conta que vence hoje como Vencida à noite; `currentMonthKey()` (3668) muda o mês do dashboard/fluxo antes da virada. Inconsistente com `localDateString()` (9402) usado pela agenda/kanban. **Fix:** helper único `hojeLocal()` baseado em `localDateString(new Date())`.

**[M12] app.js:12692 — alerta "cotações vencendo em até 7 dias" subtrai meia-noite UTC do agora local** — cotação que vence hoje sai da contagem a partir de ~21h. Mesma família em 11467/11484/11491/12160. **Fix:** comparar strings `YYYY-MM-DD` ou `parseLocalDate`.

**[M13] app.js:14936-14991 — `createProposalLinkedRecords` faz dezenas de POSTs sequenciais (vínculos + histórico + 1/item + 1/variável) sem transação nem compensação:** falha no meio deixa proposta criada com vínculos/itens parciais e alert genérico (14932). **Fix:** endpoint batch transacional no PHP, ou apagar a proposta criada no catch.

**[M14] app.js:130-134 × 6581 — 5 módulos (`proposalItems`, `proposalStatusHistory`, `proposalFiles`, `proposalBudgetLinks`, `proposalVariables`) estão em `modules` mas sem `configs` nem rota — fixá-los como favorito CRASHA a tela** (`config.fields` de undefined). Detalhe no relatório de menus §1.2. **Fix:** guard no `renderCrud` + excluí-los dos favoritos.

**[M15] Permissões front×back divergentes (resumo — detalhe no relatório de menus §4):** `visualizador = '*'` no backend (api/index.php:7944) entrega GET /users e backup completo a papel somente-leitura; `backupLocal`/`migration` no menu de gerente/visualizador com backend `require_admin` (403 ao clicar); operador tem edit sem view em qualidadeFvs/Fvm/Nc (7943 vs 7956); overrides por usuário de `viabilidadeObra`/`cotacoes` nunca são consultados (`permission_module_key` 7704-7723 não mapeia as chaves).

**[M16] Formato de resposta misto nos erros — api/index.php:11289-11308, 11363-11371, 10005-10020, 10444-10459, 4540-4556:** dentro de `?module=sinapi`, `?module=ia` (exports) e `?module=viabilidade` (download_anexo), erros saem via `fail()` `{ok:false,error}` enquanto sucesso sai `{success,data,message}` — cliente que lê `.message`/`.success` não exibe o erro. **Fix:** usar `sinapi_module_respond(false,...)`/`viabilidade_respond` nos erros.

---

## 🟢 PEQUENO

**Backend**

- **[P1] api/index.php:7521-7524** — `authenticate_request` retorna admin fixo (`id=0`) se `dev_bypass` + REMOTE_ADDR localhost — se ligado em produção, qualquer processo local/proxy vira admin. **Fix:** garantir desabilitado em prod; exigir flag de ambiente explícita.
- **[P2] api/index.php:3005/8432/7264/8495/4540** — downloads (contrato, NF, foto RDO, PES, anexo viabilidade) autorizam só por módulo/view, sem checar vínculo do registro — IDOR de objeto dentro do módulo (sem path traversal; caminho vem do DB). **Fix:** validar escopo se segregação por obra for requisito (padrão do `seletividade-estudos`).
- **[P3] api/index.php:9597-9603 e 10221-10227** — `deparaUpload`/`comparaUpload`: transação sem try/catch+rollback e job commitado antes — INSERT de item falhando (célula gigante sem clamp) → 500 e job órfão 'queued' por 10 min. **Fix:** rollback + remover job + clamp nos numéricos.
- **[P4] api/index.php:10812** — 500 de `enviarParaOrcamento` concatena `$error->getMessage()` (vaza SQL/tabelas ao cliente). **Fix:** error_log + mensagem genérica.
- **[P5] api/index.php:7193-7199** — `handle_rdo_delete` apaga fotos do DISCO antes da transação; rollback (7208) ressuscita registros apontando p/ arquivos removidos. **Fix:** unlink só após commit (como viabilidade 4491-4501).
- **[P6] api/index.php:7506-7513** — fallback `?token=` no download fiscal aceita o token de sessão COMPLETO (12h) na query string → gravado em access logs de Apache/proxies. **Fix:** token de download dedicado, curto, de uso único.
- **[P7] api/index.php:3312** — upload de cotações chama `store_upload(..., ['pdf','xlsx','xls','csv'], [])` com lista MIME VAZIA → validação de conteúdo desligada (só extensão). **Fix:** passar os MIMEs.
- **[P8] api/index.php:11930-11944** — `xlsx_shared_strings()` usa retorno de `safe_xml_load()` sem checar `false` (fatal com XML rejeitado); porém `xlsx_shared_strings`/`xlsx_cell_value`/`xlsx_column_index` são código morto (zero chamadas). **Fix:** remover as três.
- **[P9] api/cron/jobs.php:76-80** — `consolidate_monthly_dre` é no-op permanente: nenhuma tabela `dre_*` existe em schema/migrations/ensure_* — feature silenciosamente morta. **Fix:** criar a tabela ou remover o job.

**Banco**

- **[P10] migrations/2026-06-09-contas-recorrentes.sql:20-25** — `juros_aplicado`/`valor_original` DECIMAL(10,2) mais estreitos que `amount` DECIMAL(15,2). **Fix:** DECIMAL(15,2).
- **[P11] Collation mista** — tabelas novas sem COLLATE explícito caem em `utf8mb4_general_ci` (agenda, kanban, viabilidade_*, cotacao_*, orcamento_etapas, purchase_order_items, eventos_automacao, proposta_grupos/modelos); resto é `unicode_ci` — risco de "Illegal mix of collations" em JOIN futuro. **Fix:** padronizar COLLATE.
- **[P12] `sales_contracts` com DOIS conjuntos de snapshot do cliente** — `cliente_cpf_cnpj/...` (migration 2026-06-09) e `cpf_cnpj/...` (2026-06-28); `maybe_snapshot_client` (api/index.php:3688) grava os prefixados e o PDF do contrato (app.js:6736) lê os SEM prefixo — podem divergir. **Fix:** unificar.
- **[P13] migrations/2026-06-28-contrato-proposta-anexos.sql:17-19** — paths de anexo VARCHAR(255) vs padrão VARCHAR(500) do sistema.
- **[P14] api/index.php:4582** — `accounts_receivable.referencia_tipo/id` sem índice (pagar e caixa têm, migration 2026-06-09-vinculo).
- **[P15] schema.sql:542** — cascata de `proposta_arquivos` apaga registros mas não os arquivos físicos (`filePath`) — lixo em disco.

**Frontend**

- **[P16] app.js:10421-10424 (e 8411-8413)** — `enrichWorkBudget`/`normalizeWorkBudget` caem no total antigo quando a soma dos itens é 0 (`|| Number(row.directCost)`) — excluir o último item nunca zera o cabeçalho (propaga a dashboards/propostas). **Fix:** `items.length ? soma : row.directCost`.
- **[P17] app.js:5395-5398 (e 5726-5729)** — `iaDeparaPoll`/`iaComparaPoll`: erro transitório de rede mata o polling sem reagendar. **Fix:** 1-2 retries no catch.
- **[P18] app.js:13166 e 17108** — código morto: `conclusao` calculada e nunca usada em `renderViabilidadeDetail`; `showTableSkeleton` nunca chamada. **Fix:** remover.
- **[P19] app.js:11536** — `parseFloat(vigente.versao) + 0.1` sem fallback → sugere "NaN" na Política da Qualidade com versão não numérica. **Fix:** `(parseFloat(...) || 1.0)`.
- **[P20] app.js:6871/6883** — chave `issueDate` duplicada no objeto de `labelFor` (a 2ª sobrescreve; mesmo valor hoje, mascara erro futuro). **Fix:** remover duplicata.
- **[P21] app.js:3401** — fotos do RDO: `URL.createObjectURL` nunca revogado — vazamento de blobs a cada PDF gerado. **Fix:** revogar no `afterprint`.
- **[P22] app.js:12823-12824** — modal "Revisar itens" da cotação: `it.quantidade || ""` apaga 0 legítimo ao reexibir/salvar. **Fix:** `it.quantidade ?? ""`.

---

## Matriz de autenticação/autorização (todos os endpoints)

**Fluxo de bootstrap** (`api/index.php`, try inicia na linha 79): rotas públicas tratadas ANTES do gate — `login`, `request-password-reset`, `reset-password`, `forced-change-password`, `?module=companysettings&action=getlogo` (85-112), cada uma com `exit`. `authenticate_request($pdo,$config)` na linha 115 — todo o resto exige sessão (Bearer → `api_sessions`, SHA-256, idle 30 min/TTL 12 h, checa `status='Ativo'` e `blocked`). Depois vêm os módulos `?module=` (125-231) e as rotas REST (233-792). **Não há rota de escrita processada antes do gate (sem bypass de ordem); handlers de módulo dão `exit` (sem fall-through).** Autorização: `authorize_request()` → `user_can()` → override em `user_permissions`, senão `role_can()` (tabela `role_permissions` + defaults). `action_for_method`: GET→view, POST→create, PUT/PATCH→edit, DELETE→delete.

| Módulo | Action/Rota | HTTP | Auth global | Gate de papel | Escreve? | Obs |
|---|---|---|---|---|---|---|
| (público) | login | POST | NÃO (pré-auth) | — | Sim (sessão) | rate-limit user/IP |
| (público) | request-password-reset | POST | NÃO | — | Sim (token reset) | rate-limit IP |
| (público) | reset-password | POST | NÃO | — | Sim (senha) | valida token |
| (público) | forced-change-password | POST | NÃO (token no corpo) | — | Sim (senha) | rate-limit (aceito por design) |
| companySettings | getlogo | GET | NÃO | — | Não | logo pública |
| (auth) | check-session / checkSession | GET | Sim | nenhum (só sessão) | Não | intencional |
| (auth) | bootstrap / '' | GET | Sim | nenhum (dados filtrados por papel) | Não | payload inicial |
| (auth) | logout | POST | Sim | nenhum (self) | Sim | |
| (auth) | change-password | POST | Sim | nenhum (self) | Sim | |
| (auth) | audit-log | GET | Sim | require_admin | Não | |
| (auth) | backup | GET/POST | Sim | require_admin | Sim | |
| (auth) | migrate | POST | Sim | require_admin | Sim | |
| (auth) | sinapi-upload / import / import-async / reprocess-job | POST | Sim | require_admin | Sim | |
| (auth) | sinapi-import-status | GET | Sim | sinapiSettings/view | Não | |
| (auth) | sinapi-buscar | GET | Sim | sinapiCompositions/view | Não | |
| (auth) | sinapi-export-obra | GET | Sim | workBudgets/view | Não | |
| (auth) | contrato-upload | POST | Sim | sales/edit | Sim (arquivo) | |
| (auth) | contrato-download | GET | Sim | sales/view | Não | IDOR por id → P2 |
| (auth) | project-upload | POST | Sim | projectSchedule/edit | Sim (arquivo) | |
| (auth) | seletividade-estudos | GET/POST/PUT/DELETE | Sim | plugins/view | Sim | isolado por userId (bom) |
| (auth) | ofx-preview / import / conciliar | POST | Sim | reconciliation/edit | Sim | |
| (auth) | ofx-history | GET | Sim | reconciliation/view | Não | |
| (auth) | nfse-preview / cadastrar-entidade / import | POST | Sim | fiscalDocuments/edit | Sim | preview grava XML |
| (auth) | rdo-list/get/foto | GET | Sim | rdo/view | Não | |
| (auth) | rdo-save/enviar-assinaturas/assinar/reabrir/foto-upload/foto-delete | POST | Sim | rdo/edit | Sim | |
| (auth) | rdo-delete | POST | Sim | rdo/delete | Sim | |
| (auth) | obra-disciplinas-list | GET | Sim | rdo/view | Não | |
| (auth) | obra-disciplinas-save/delete | POST | Sim | rdo/edit | Sim | delete via POST=edit → M1 |
| (auth) | user-permissions-get/save/reset | GET/POST | Sim | require_admin | Sim | |
| REST genérico | resource_map() (~70 recursos: clients, suppliers, projects, workBudgets, receivable, payable, users, permissions, proposals, sinapi*, qualidade*, …) | GET/POST/PUT/PATCH/DELETE | Sim | authorize_request(key, action_for_method) | Sim (exceto GET) | users/permissions de fato só admin (defaults); proposals PUT→Aprovada gera obra+orçamento |
| agenda | list/feed/get; create; update; delete | GET/POST/PUT/PATCH/DELETE | Sim | agenda/action_for_method | Sim | delete aceita POST → M1 |
| clients | get | GET | Sim | clients/view | Não | |
| payable | create_recurrence/early_settlement/update_scope/cancel_recurrence; group | POST/GET | Sim | payable/action_for_method | Sim | cancel/settlement via POST=create → M1 |
| costCenters | list/get; create/update/delete | GET/POST | Sim | costCenters/action_for_method | Sim | update/delete aceitam POST → M1 |
| cashMoves | create, link | POST | Sim | cashMoves/create | Sim | baixa conta a pagar |
| companySettings | uploadLogo; removeLogo | POST/DELETE | Sim | companySettings/edit (fixo) | Sim (arquivo) | |
| purchaseOrderItems | list; create/update/delete/saveBulk | GET/POST | Sim | purchaseOrders/action_for_method | Sim | update/delete aceitam POST → M1 |
| workBudgetExecution | history; update | GET/POST/PUT/PATCH | Sim | workBudgets/action_for_method | Sim | |
| dashboardExecution | summary | GET | Sim | dashboard/view | Não | |
| viabilidade | list/get/check_bloqueio/download_anexo; create/add_item/add_grupo/upload_anexo; update/update_item; delete/delete_item | GET/POST/PUT/PATCH/DELETE | Sim | viabilityAnalyses/action_for_method | Sim + apaga arquivos | delete via POST=create → M1 |
| procedimentosExecucao | uploadPdf; downloadPdf | POST/GET | Sim | qualidadePes/action_for_method | Sim (arquivo) | |
| cotacoes | list/get/exportarCsv; importar/salvarItens/comparar | GET/POST | Sim | purchaseOrders/action_for_method | Sim (arquivo) | chave front `cotacoes` ≠ backend |
| sinapi | statusImportacao/listarReferencias | GET | Sim | sinapiReferences/view | Não | |
| sinapi | previewPacote/processarPacote/ativarReferencia/recalcularCustos | POST | Sim | sinapiReferences/create + require_admin interno | Sim | duplo gate (bom) |
| **ia** | ping/indexStatus/deparaStatus/deparaItens/comparaStatus/comparaItens/deparaExport/comparaExport | GET | Sim | **NENHUM** | Não | → G1 |
| **ia** | startIndex/buscarSemantica/deparaUpload/deparaStart/deparaAccept/comparaUpload/comparaStart/comparaAccept/**enviarParaOrcamento** | POST | Sim | **NENHUM** | **SIM** (cria orçamentos, uploads, spawn workers) | 🔴 **→ G1** |

**Infra fora da API web:** `deploy.php` — HMAC SHA-256 com `hash_equals`, só `refs/heads/main`, `escapeshellarg` (OK). `api/cron/jobs.php` — guard `PHP_SAPI==='cli'` (OK). `scripts/*.php` (4 workers) — guard CLI, disparados via `exec()` com `escapeshellarg` e jobId UUID server-side (OK).

---

## Verificado e OK (não re-sinalizar em passadas futuras)

- **SQL injection:** nenhum encontrado — todas as queries com dado de request usam prepared statements; interpolações existentes são seguras (LIMIT/OFFSET com `(int)`+clamp; nomes de tabela/coluna vindos de allowlists fixas: `resource_map`, `role_can`:7911, `user_can`:7772, `ia_depara_grupos`:9973, `nfse_find_entity`:6568, `ofx_conciliar`:6080 com whitelist).
- **DROP/TRUNCATE:** zero em runtime e em migrations — `replaceExisting` do SINAPI usa DELETE por referência; compatível com `financeiro_app`.
- **DELETE/UPDATE sem WHERE:** nenhum acidental (UPDATEs globais de `isDefault` em ativarReferencia são por design e transacionais).
- **Transações nos fluxos críticos:** aprovação de proposta (652-754), recorrência/quitação de contas, OFX, NFS-e, RDO, user_permissions, viabilidade delete (unlink pós-commit + anti-traversal), enviarParaOrcamento; workers com `register_shutdown_function` + rollback + `expire_stale_*`.
- **Uploads:** `store_upload` valida extensão+MIME (exceto P7), nome aleatório, chmod 0640, destino fora do docroot; downloads por id com caminho do banco (sem traversal).
- **Credenciais:** nenhuma hardcoded; hash de senha nunca sai em listagem.
- **Frontend:** nenhuma função inexistente referenciada em handlers (878 nomes × on* verificados); `node --check` passa; camada de API trata 401/retry/erros; **XSS: nada encontrado nos módulos novos** (iaDepara/iaCompara/viabilidade/cotações/PBQPH/qualificação — tudo com escapeHtml/svgText); JSON.parse todos protegidos; divisões por zero guardadas; `handle_ia_enviar_para_orcamento` espelha `normalizeWorkBudgetItem` exatamente (sem drift).
- **Migrations:** idempotentes (IF NOT EXISTS onde importa); ENUMs do schema.sql refletem a última versão; bootstrap só roda `ensure_*` quando falta (sem DDL por request).
- **Nota:** `proposta_grupos` e `proposta_modelos` EXISTEM (migration 2026-06-28 + `ensure_proposta_hierarquia`:2805) — memória/specs antigas que digam o contrário estão defasadas; só `proposta_orcamentos` nunca existiu.

---

## Sumário

| Nível | Contagem |
|---|---|
| 🔴 GRAVE | **4** (G1-G4) |
| 🟡 MÉDIO | **16** (M1-M16) |
| 🟢 PEQUENO | **22** (P1-P22) |
| **Total** | **42** |

### Top 5 — atacar primeiro

1. **[G1] Gate de papel no módulo `ia`** — escrita orçamentária + abuso de workers por qualquer sessão; fecha também a inconsistência nº 1 do relatório de menus. Correção pequena (1 `authorize_request` por ação) e de alto impacto.
2. **[G2] Cron `create_due_alerts` × `obra_notificacoes`** — hoje o cron inteiro morre no primeiro vencimento: alertas não saem e purge/DRE nunca rodam (tabelas de log crescendo desde sempre).
3. **[G3] Cascata `projects → fiscal_documents`/orçamentos no DELETE genérico** — um clique errado apaga notas fiscais; trocar FK para SET NULL/RESTRICT + guarda na API.
4. **[G4] Provisionamento do zero** — regenerar `schema.sql` e consertar as 2 migrations fora de ordem (pbqph-fase1, sinapi-2026-04); barato de fazer e destrava DR/testes.
5. **[M1] Autorização por método HTTP nos módulos `?module=`** — `canDelete`/`canEdit` são contornáveis via POST em viabilidade/payable/agenda/costCenters/purchaseOrderItems; autorizar pela ação real.

> **Passada 2 sugerida:** correções na ordem acima (G1/G2/G4/M1 são pequenas e cirúrgicas; G3 exige decisão de produto sobre soft-delete vs bloqueio), depois o bloco de timezone do frontend (M10-M12) num commit único.
