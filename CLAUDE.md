# CLAUDE.md — Guia para agentes de IA no projeto ObraSync

> **Sessão 28/06/2026:** IA semântica (busca + de-para + comparador) e Fase B1 (ponte análise → orçamento). 2 pendentes críticos — ver [`docs/sessoes/2026-06-28-ia-comparador-faseB.md`](docs/sessoes/2026-06-28-ia-comparador-faseB.md).
>
> **Visão futura** — Cronograma Físico-Financeiro completo (EAP, dependências MS Project, medição, baseline, risco, curvas S): [`docs/specs/cronograma-fisico-financeiro.md`](docs/specs/cronograma-fisico-financeiro.md). Não iniciar antes de fechar os graves da revisão.
>
> **Mapa de arquitetura (estado atual 04/07/2026)** — módulos e conexões: eixo central já ligado (SINAPI→comparador IA→orçamento→proposta→contrato→financeiro), pontas soltas (cotações/comparador de fornecedores/pedido de compra) e pendências para retomar: [`docs/arquitetura/mapa-modulos-conexoes.md`](docs/arquitetura/mapa-modulos-conexoes.md).
>
> **Versão atual:** `v1.35.0` · 2026-07-23
>
> **v1.35.0 — Módulo RH/Pessoal (Fase 1 — cadastro, documentos e vencimentos):** módulo novo **RH / Pessoal** (tabelas `rh_colaboradores`/`rh_tipos_documento`/`rh_documentos`, migration `2026-07-22-rh-pessoal-f1.sql`, REST genérico via `resource_map`), com **permissões restritas por LGPD**: só o papel `gestor_obra` (além de admin/gerente/visualizador, que herdam todos os módulos) vê a seção — `financeiro`/`engenharia`/`consulta`/`equipe_campo` não têm acesso. Cadastro de colaboradores (próprio/diarista/autônomo/empreiteira — empreiteira exige `fornecedor_id` do cadastro; CPF único quando informado) com ficha própria de documentos e anexos (rotas dedicadas `rh-doc-upload`/`rh-doc-arquivo`/`rh-doc-delete` no molde do RDO — upload/download autenticado, exclusão apaga também o arquivo do disco). Helper central `rhDocSituacao(doc)`/`rhDocBadge(sit)` (app.js) calcula a situação de vencimento reusando as classes `q-badge q-ruim/q-atencao/q-ok` (Qualidade) — vermelho VENCIDO, âmbar "Vence em N dia(s)" dentro da antecedência do tipo de documento, verde Válido; aparece na ficha (por documento) e na lista de colaboradores (pior situação da pessoa). Painel novo **Vencimentos** (`renderRhVencimentos`) lista todos os documentos vigentes de colaboradores Ativo (mais recente por pessoa+tipo, `rhDocsDaPessoa`) ordenados por validade, com filtros situação/tipo/vínculo. Bloco novo em `dashboardAlerts` soma vencidos (danger)/vencendo (warning) — ainda sem recorte por obra (chega na F2, via alocação). **F2** (alocação em obras, efetivo no RDO, cron `create_rh_doc_alerts`) e **F3** (diárias/medições de empreiteira → contas a pagar) ficam para os próximos ciclos — spec e plano completos em `docs/superpowers/specs/2026-07-22-modulo-rh-pessoal-design.md` e `docs/superpowers/plans/2026-07-22-modulo-rh-pessoal.md`.
>
> **v1.34.0 — Cotações por MATERIAL (P2 — consolidado + financeiro):** aba nova "Resultado das cotações" no módulo Cotações de Fornecedores (`cotacaoView === "resultado"`, `renderCotacaoResultado` em app.js): por OBRA, as cotações Concluídas agrupadas pela EMPRESA vencedora (proposta `vencedor=1`), subtotal por empresa + total geral (`valor_item = COALESCE(valor_total, valor_unitario)` da proposta vencedora). **Coluna nova `cotacoes.conta_pagar_id`** (migration `2026-07-16-cotacao-material-p2.sql` + mesmo `ensure_cotacao_material_columns`; gate do bootstrap agora checa categoriaId E conta_pagar_id) = vínculo POR COTAÇÃO com a conta gerada. Actions novas em `?module=cotacoes`: `materialConsolidado` (GET projectId) e `materialGerarConta` (POST projectId/fornecedorId/categoryId/dueDate) — **UMA conta por empresa** em `accounts_payable` (document `COT-<ids>`, status Aberto, `referencia_tipo='COTACAO_MATERIAL'`, `referencia_id`=1ª cotação, amount=Σ dos pendentes; categoria/vencimento escolhidos no modal), transacional com guarda anti-corrida (`UPDATE ... WHERE conta_pagar_id IS NULL` + rollback se corrida) e **sem duplicar** (grupo todo vinculado → 409 com os documentos; materiais novos depois → nova conta só com eles; `cotacao_material_heal_contas` limpa vínculo se a conta foi excluída no financeiro). **NF depois:** botão "Anexar/Vincular NF" no grupo (`openCotacaoAnexarNf`) — cria NF nova via REST `notas-fiscais` existente (`save_fiscal_document`, com upload PDF/XML, `payableId` preenchido, status Anexada) OU vincula NF já cadastrada sem vínculo (PUT multipart com todos os campos + payableId); a coluna "Nota fiscal" de Contas a Pagar já exibia a NF vinculada (nada novo lá). Permissões: consolidado/gerar = módulo cotações; anexar NF = fiscalDocuments. **NÃO** mexe no fluxo de importação nem no F5.3 (compras por pedido).
>
> **v1.33.0 — Cotações por MATERIAL (P1):** aba nova (e inicial) "Cotações por material" no módulo Cotações de Fornecedores (`cotacaoView` em app.js; a importação de arquivos virou a 2ª aba). **REUSO, nada recriado:** o cabeçalho da cotação de material é a tabela **`cotacoes`** (projectId/description/unit/quantity/notes/status VARCHAR com 'Em cotação'/'Concluída'/'Cancelada') + colunas novas `categoriaId` (disciplina, cotacao_categorias) e `tipoItemId` (cotacao_tipos_item; `categoriaId IS NOT NULL` = é cotação por material — as linhas do CRUD antigo `quotes` convivem na mesma tabela com categoriaId NULL); cada **proposta** é uma linha de **`cotacao_itens`** (valor_unitario/marca/prazo_entrega/observacao/vencedor/diferenca_percentual) + colunas novas `material_cotacao_id` e `fornecedor_id` (suppliers, obrigatório), com **`cotacao_id` agora NULL** (proposta manual não tem cabeçalho de arquivo; o fluxo de importação não muda — todas as queries dele fazem JOIN cotacao_fornecedor). Migration `2026-07-16-cotacao-material.sql` + `ensure_cotacao_material_columns` (bootstrap + handler). Actions novas em `?module=cotacoes` (mesma permissão purchaseOrders): `materialList` (filtros projectId/categoriaId/status), `materialGet`, `materialSalvar`, `materialExcluir` (apaga só as propostas dela + cabeçalho), `propostaSalvar`/`propostaExcluir` (recalculam `diferenca_percentual` de TODAS as propostas vs a MAIS BARATA, menor=0%, com clamp IA_COMPARA_DIFPERCENT_MAX), `materialConcluir` (**regra das N cotações**: exige >= `minCotacoesPorMaterial` — `system_preferences`, seed '3', editável em Configurações → Preferências — propostas de fornecedores **DIFERENTES** via COUNT(DISTINCT fornecedor_id); senão 422 "faltam X"; marca vencedor=1 na escolhida e status 'Concluída'), `materialReabrir` (volta a 'Em cotação' e zera vencedor), `materialCancelar`. Front: `renderCotacaoMaterialLista/Detalhe`, cards lado a lado com menor destacado + dif R$/% vs menor, botão Concluir desabilitado com "(faltam X)" + banner. **P2 (pendente): gerar conta a pagar da vencedora. NÃO importa arquivo neste fluxo.**
>
> **v1.32.1 — Vencidas separadas + job Aberto→Vencido:** `dashboardMetrics` não tem mais `overdue` somado nem `delinquency` — virou `overduePayable`/`overdueReceivable` (+ `*Count`), nas DUAS visões (geral e por obra). Cards: "Contas a pagar vencidas" (tone `negative`) e "Inadimplência (a receber vencidas)" (tone `warning` — classe nova `.kpi.warning` no styles.css, âmbar do F1); alertas do dashboard um por lado (pagar=danger, receber=warning); relatório "Inadimplência por cliente" usa `isOverdue` (antes `status === "Vencido"` literal, sempre 0). Cron: job novo `mark_overdue_accounts` em `api/cron/jobs.php` (primeiro da cadeia G2) — `status='Aberto'` + `dueDate <` HOJE (data do **PHP** em America/Campo_Grande, NÃO `CURDATE()` — MySQL pode estar em UTC, regra M10-12) + `paidDate/receivedDate IS NULL` (espelha isOverdue) → `'Vencido'`. Não toca Parcial/Pago/Recebido/Cancelado; idempotente; loga linhas afetadas no stdout. Baixar conta 'Vencido' funciona (fluxos só bloqueiam 'Cancelado'; `isPagarAberto`/`isReceberAberto` já tratam Vencido como em aberto). O `isOverdue` do front segue em tempo real (reforço duplo).
>
> **v1.32.0 — Cotações A1 (categorias + tipos de item):** estrutura manual categoria→tipo dentro do módulo Cotações de Fornecedores (botão "Categorias de Cotação" na lista, tela própria via `cotacaoCatOpen`/`renderCotacaoCategorias` em app.js). Tabelas novas `cotacao_categorias` (nome único, ordem, status) e `cotacao_tipos_item` (categoriaId FK CASCADE, nome único por categoria, unidadePadrao, ordem, status) — migration `2026-07-08-cotacao-categorias-tipos.sql` + `ensure_cotacao_categorias_tables` (handler + bootstrap). Actions em `?module=cotacoes`: `listCategorias` (GET, tipos aninhados), `categoriaSalvar`/`tipoSalvar` (POST create/update; inativar = salvar com `status:'Inativo'`; duplicata → 409), `categoriaOrdenar`/`tipoOrdenar` (POST lista de ids → ordem=posição, transacional). Mesma permissão do módulo (purchaseOrders via authorize_request). **A2 (pendente):** atributos customizados por tipo no molde de `obra_campos_personalizados` (fieldName/fieldType/options/required/sortOrder/status); **A3:** vincular categoria/tipo a `cotacao_itens` (NÃO recriar descricao/unidade/valor_unitario/marca/vencedor/diferenca_percentual/status_comparacao — já existem).
>
> **v1.31.0 — RDO blocos de assinatura (nome + CPF + datas):** `handle_rdo_get` agora devolve `responsavelGeralCpf` (lookup por `responsavelGeralUserId`→fallback `createdByUserId`), `disciplinas[].responsavelCpf` e `assinaturas[].assinanteCpf` (LEFT JOIN `system_users.cpf` — coluna garantida por `ensure_users_extra_columns`, banco guarda só dígitos). No app.js: `rdoCpfFmt` (máscara na exibição; vazio = "não informado"), `rdoDataHora` (TIMESTAMP MySQL → "DD/MM/AAAA HH:MM" pela STRING, sem Date/UTC — regra M10), `rdoAssinaturasBlocosHtml(d)` (bloco Geral = criador com criadoEm/assinadoEm da última assinatura tipo Geral; um bloco por disciplina atuou=1 com responsável, usando `assinado/assinadoEm` da própria disciplina — "pendente" se não assinou). Os blocos substituíram as linhas manuscritas no `rdoPdfHtml` e entram em cada dia do relatório semanal. O fluxo de assinar (`handle_rdo_assinar`) NÃO mudou — já gravava disciplina + `obra_rdo_assinaturas` em transação.
>
> **v1.30.0 — Relatório Semanal de RDO (só leitura, sem backend novo):** botão "Relatório semanal" na lista do RDO → view `rdoUI.view === "semanal"` (`renderRdoSemanal`/`rdoSemanalGerar`/`rdoSemanalDocHtml` em app.js). Consolida 7 dias corridos (referência − 6 até a referência) reusando `rdo-list?projectId&de&ate` + `rdo-get` por dia + `rdo-foto` (blobs; objectURLs revogadas em `rdoSemanalLimparUrls`). O miolo de um dia foi extraído de `rdoPdfHtml` para **`rdoDiaCorpoHtml(d, fotos)`** (compartilhado pelo PDF individual e pelo semanal — mexeu ali, mexeu nos dois). Dia da semana/aritmética de datas em horário LOCAL (`rdoDiaSemana`/`rdoSomarDias` — nunca UTC, regra M10). PDF via `printStandaloneDocument` (#docPrint); na tela o doc rende em `.rdo-semanal-doc` (cabeçalho da empresa é `.doc-print-only`). Fotos no semanal limitadas a `max-height:70mm` (regra em styles.css escopada a `.rdo-semanal-doc`/`#docPrint`).
>
> **v1.29.0 — RDO (assinatura do criador + fotos em lote):** o assinante principal (`obra_rdo.responsavelGeralUserId/Nome`) é gravado SEMPRE pelo backend a partir do usuário da sessão na criação (`handle_rdo_save` ignora `responsavelGeral*` do payload; na edição mantém o criador, com fallback em `createdByUserId` p/ RDOs antigos) — o select `rdoRespGeral` virou input somente leitura e `rdo_project_responsible()` foi removida. Fotos: input `multiple` + fila `rdoFotosPendentes` (previews com legenda individual, `rdoRenderFotosPreview`/`rdoEnviarFotos`); o envio reusa o endpoint `rdo-foto-upload` UMA requisição por foto — falha individual não derruba o lote (a foto fica na fila com a legenda). `obra_rdo_fotos.legenda` já existia (sem migration).
>
> **v1.26.3 — fórmulas do Excel (bug raiz do 9393):** `sinapi_rows_from_sheet($sheet, $calculateFormulas)` — uploads da IA (depara/compara) leem com `getCalculatedValue()` + fallback POR CÉLULA (`getOldCalculatedValue()` → `getValue()`); caminho SINAPI segue `toArray(..., false, ...)` sem custo. `ia_planilha_ler_ricos`: material+M.O. presentes → valorEfetivo E custoDiretoUnit = soma (SEMPRE); custoDireto isolado só se `ia_custo_direto_plausivel()` (≤100× a soma parcial). Lotes antigos com 9393/9292 exigem novo upload ou Reanalisar.
>
> **Sessão 04/07/2026 — comparador IA (totais + aceite em lote):** colunas novas `ia_compara_itens.totalOrigem/totalSinapi/diferencaTotal` (migration `2026-07-04-ia-compara-totais.sql` + `ensure_ia_compara_tables`); cálculo de preço centralizado na função PURA `ia_compara_calcula_precos()` (api/index.php — unitário E total, worker usa ela). `ia_compara_resumo` soma diferença por TOTAL (fallback `diferencaValor×quantidade` p/ lotes antigos; "Reanalisar" preenche). Aceite em LOTE via payload `{jobId, modo: todos|achou|nenhum}` no `comparaAceitar`/`deparaAceitar` (`ia_accept_bulk`); botões nas duas telas. A detecção de coluna por chave exata (v1.25.1) NÃO mudou.
>
> **Sessão 04/07/2026 — timezone (M10/M11/M12):** front alinhado ao fuso LOCAL. `asDate()` formata data pura (YYYY-MM-DD) pela string (nunca desloca o dia); helper `hojeLocal()` (= `localDateString(new Date())`) substituiu `new Date().toISOString().slice(0,10)` em TODAS as comparações com datas do banco e defaults gravados (isOverdue, prazos NC via `qHoje()`, cotações vencendo — `parseLocalDate`+`startOfLocalDay`); `currentMonthKey()` em local. Nomes de arquivo de export mantiveram toISOString (cosmético). Ao criar código novo: **nunca** use `toISOString()` para "hoje"/data de negócio — use `hojeLocal()`/`localDateString`.
>
> **Sessão 03/07/2026 — G3 (soft-delete de obras):** excluir obra agora ARQUIVA (`projects.deletedAt/deletedBy/archivedReason`; migration `2026-07-03-obra-soft-delete.sql` + `ensure_project_soft_delete`). Nenhum DELETE físico em `projects` (guarda em `delete_record` + FKs `fiscal_documents`/`orcamentos_obras` convertidas para `ON DELETE RESTRICT`). `db.projects` só traz ativas (bootstrap/list filtram `deletedAt IS NULL`; `?archived=1` lista arquivadas); `db.projectsArchived` alimenta o painel "Obras arquivadas" (tela Obras) com Desarquivar via `POST api/obras/{id}/restore` (permissão canDelete). `byId("projects")` tem fallback no arquivo para resolver nomes em registros antigos.
> **Última varredura de código:** 2026-06-27 (3ª rodada — segurança, bugs, performance, qualidade, UX; itens MÉDIO/BAIXO fechados na v1.12.1)
> **Handoff:** este doc foi atualizado na v1.25.0 (Fase B1: ponte IA → Orçamento de Obra) — confira a seção **Sessão 2026-06-28 — v1.25.0** e **Operação/Deploy (handoff)** abaixo.
>
> **Patches v1.24.x:** `v1.24.1` — fluxo de caixa centra a janela de meses no mês atual (`collectMonths` = mês corrente ± `CASHFLOW_MONTHS_BACK`/`FORWARD`, default 6/6), uma data isolada no futuro não estica mais o eixo. `v1.24.2` — comparador IA: `diferencaPercent` ampliado para `DECIMAL(12,2)` (migration `2026-06-28-ia-compara-difpercent.sql` + guard em `ensure_ia_compara_tables`) e o worker só calcula a % quando `valorUnitOrigem > 0` E `matchValor > 0`, com clamp (`IA_COMPARA_DIFPERCENT_MAX`/`DIFVALOR_MAX`) — corrige `SQLSTATE[22003]` por base SINAPI ~zero. Re-rodar pelo "Reanalisar" é idempotente. `v1.24.3` — as colunas ricas **Material unit.** e **M.O. unit.** passam a ser exibidas nas telas (sob o valor) e no export Excel do de-para e do comparador (a captura/armazenamento já vinham da v1.24.0). Lembrete: o valor de comparação segue a prioridade `custoDiretoUnit > materialUnit+maoObraUnit > valor genérico` (custo SEM BDI vs custo SINAPI sem BDI) — ver `ia_planilha_ler_ricos`.

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
- **Cache busting:** ao mudar `app.js`/`styles.css`, incremente `?v=NNNN` em `index.html` (hoje `app.js?v=1770`, `styles.css?v=1770`) e a constante `APP_VERSION` no topo de `app.js`.
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

## Sessão 2026-06-28 — v1.25.1 (Correção da leitura de valor: detecção exata de coluna)

**Bug grave corrigido:** o comparador/de-para gravava valor unitário ERRADO (cabo 1,5mm² → R$ 8.484; correto R$ 2,80 da coluna "Custo Direto Unit. (R$)"), gerando "excesso" irreal de milhões. Causa: `ia_depara_map_header` casava por "contém" ("Material Unit." casava com "Total Material"; colunas de Total viravam valor unitário).

**Fix:** `ia_depara_norm` agora remove a marca monetária `(R$)`/`R$`/`$` e `%` antes de limpar a pontuação. `ia_depara_map_header` casa por **chave normalizada EXATA** num dicionário (não "contém"); qualquer coluna que comece com "total" → `null` (nunca é valor unitário); só a descrição tem fallback fuzzy. Prioridade do valor unitário inalterada (`custodireto` > `material+maoobra` > `valor`), agora com as colunas certas. Testado com o cabeçalho real AltoQi (linha 4): G→descricao, F→codigo, H→unidade, I→quantidade, J→material, K→maoobra, **L→custodireto**, P→bdi, Total* → ignoradas. **Debug:** `comparaUpload`/`deparaUpload` retornam `mapaColunas` (campo→letra) + `headerLinha`, exibidos na tela ("Colunas detectadas: L → Custo direto unit., ..."). Helpers novos `ia_col_letter`/`ia_depara_mapa_colunas`.

**PENDENTE (próxima sessão):** comparação UNITÁRIA × TOTAL no comparador (totalOrigem/totalSinapi/diferencaTotal) + botão "Aceitar todos"/"só ACHOU"/"Desmarcar". Ver `docs/sessoes/2026-06-28-ia-comparador-faseB.md`.

## Sessão 2026-06-28 — v1.25.0 (Fase B1: ponte IA → Orçamento de Obra)

**Feature:** botão **"Enviar para Orçamento de Obra"** no resultado do comparador (`iaCompara`) e do de-para (`iaDepara`). Cria um orçamento de obra **nas tabelas existentes** (`orcamentos_obras` + `orcamento_obra_itens`) — NÃO há estrutura nova. Endpoint `POST ?module=ia&action=enviarParaOrcamento` `{jobId, projectId, name?, apenasAceitos?}` → `handle_ia_enviar_para_orcamento`.

**Fluxo do endpoint:** detecta a origem do lote (busca o jobId em `ia_compara_jobs` → `ia_compara_itens` campo de valor `valorUnitOrigem`; senão `ia_depara_jobs` → `ia_depara_itens` campo `valorOrigem`). Cria o cabeçalho (`status='Rascunho'`, `version` única no projeto via loop no `uk projectId,name,version`, `sinapiReferenceId` = referência `isDefault`, `priceType` da referência). Para cada item (filtra `aceito=1` se `apenasAceitos`): cria `orcamento_obra_itens` com `insert_dynamic` (descarta colunas inexistentes) mapeando:
- `description=descricaoOrigem`; `code`/`codigo`=matchCode (achou) ou codigoOrigem; `unit`=unidadeOrigem||matchUnit; `quantity`=quantidadeOrigem||1.
- `unitCost` = **custoDiretoUnit > valorUnitOrigem/valorOrigem** (custo SEM BDI vs SINAPI sem BDI); `bdiPercent` da planilha.
- `origin` enum: achou→`SINAPI`, cotacao_propria→`Cotação manual`, faltou_importar/divergente→`Item livre`.
- `tipo` enum: material/M.O. pelo predomínio de materialUnit/maoObraUnit (default `material`).
- `stageName`=setor + `etapa_id` (cria `orcamento_etapas` por setor distinto); `categoryId` casa `financial_categories.name` por nome (senão NULL + nota); `sinapi_id`=matchId **só** quando achou+composicao (a JOIN de export liga em `sinapi_composicoes`); `sinapiSnapshotJson` com rastreabilidade; `notes` com divergência/categoria não casada.
- **Totais espelham `normalizeWorkBudgetItem`/`normalizeWorkBudget` do app.js** (não há recálculo no PHP): item `totalCost=qtd*unitCost`, `unitPrice=unitCost*(1+bdi/100)`, `totalPrice=qtd*unitPrice`; cabeçalho `directCost=ΣtotalCost`, `totalCost=directCost` (charges 0), `totalPrice=ΣtotalPrice` (discount 0). Tudo numa transação; `ensure_budget_structure` garante `tipo/etapa_id/sinapi_id/codigo`.

**Frontend:** `iaEnviarParaOrcamento(origem)` abre modal (reusa `viabilidadeDialog`) com obra (`db.projects`), nome default (`Orçamento IA - <arquivo>`) e "só aceitos"; em sucesso `iaEnviarSucesso` oferece "Abrir em Orçamentos de Obras" (`currentModule='workBudgets'`). NÃO transforma em proposta nem faz agrupamentos multidimensionais (próximas fases).

## Sessão 2026-06-28 — v1.24.0 (Planilhas reais: cabeçalho + colunas ricas + divergente)

**Correções na leitura das planilhas reais (AltoQi) nos módulos `iaDepara` e `iaCompara`:**

1. **Detecção de cabeçalho** (`ia_depara_detect_columns`, usada pelos dois): não assume mais a linha 1 — varre as primeiras 15 linhas e elege a primeira que tenha a coluna de descrição **e ≥2 colunas reconhecíveis** (títulos/subtítulos antes são ignorados). Prefere a coluna "Descrição" forte à coluna "Item" (número WBS) via `ia_depara_header_is_strong_desc`.

2. **Colunas ricas** (`ia_depara_map_header` ampliado, ordem específica ANTES de `valor`): Setor, Categoria, Tipo, Material Unit., M.O. Unit., Custo Direto Unit., BDI %. ⚠️ `'material'` foi REMOVIDO das variantes de `descricao` (colidia com "Material Unit."). Helper `ia_planilha_ler_ricos` lê esses campos e define o **valor unitário efetivo** pela prioridade **Custo Direto > Material + M.O. > valor genérico** (`fonteValor` documenta). Novas colunas em `ia_depara_itens`/`ia_compara_itens` (setor, categoria, tipoOrigem, materialUnit, maoObraUnit, custoDiretoUnit, bdiPercent) — migration `2026-06-28-ia-planilhas-ricas.sql` + `ia_ensure_planilha_rich_columns` (ADD COLUMN IF NOT EXISTS + MODIFY do enum só quando falta 'divergente', via INFORMATION_SCHEMA, p/ não rebuildar a cada request).

3. **Classificação confere TODOS os itens** (workers): mesmo com código, roda a semântica. Código existente: top1.code == informado → **achou** (confirmado); descrição aponta forte (≥ACHOU_MIN) para outro código → **divergente** (match = sugestão; o informado fica em `codigoOrigem`); senão confia no código → achou. Novo valor de enum **`divergente`** nos dois `statusClassificacao`. Comparação de preço (compara) segue só para `achou`.

4. **Exibição:** colunas Setor/Categoria/Tipo nas tabelas e no export; filtro por **Setor** (ala/parte da obra) — `ia_depara_grupos($pdo,$jobId,'setor')` / `ia_compara_setores`; balde/badge **DIVERGENTE** (laranja) com dica "código informado X — a descrição parece ser outro item". `iaDeparaSelectFilter` genérico (reusado por grupo e setor). CSS `.ia-dp-divergente`/`.ia-dp-setor-tag`/`.ia-dp-diverg-hint`.

## Sessão 2026-06-28 — v1.23.0 (De-para em lote: multi-aba + grupo)

**Ajuste no `iaDepara`:** `deparaUpload` agora lê **todas as abas** do Excel (antes só a 1ª), detectando colunas por aba (`ia_depara_detect_columns`). Abas sem coluna de descrição são puladas e devolvidas em `abasIgnoradas`; as lidas vão em `abasLidas:[{nome,linhas,colunasDetectadas}]`. Retorno do upload: `{jobId, total, colunasDetectadas, abasLidas, abasIgnoradas}` (e `colunasJson` do job agora guarda esse resumo). **Nova coluna `ia_depara_itens.grupoAba VARCHAR(160)`** = nome da aba de origem (migration `2026-06-28-ia-depara-grupo-aba.sql` + `ALTER ... ADD COLUMN IF NOT EXISTS` no `ensure_ia_depara_tables`). CSV = aba única (nome do arquivo).

`deparaItens` passou a retornar `grupoAba` por item + `grupos:[{nome,total}]` e aceita `&grupo=` para filtrar. Export inclui a coluna **Grupo (aba)**. Frontend: resumo de abas pós-upload (`iaDeparaAbasResumoHtml`), coluna **Grupo** na tabela, e seletor de grupo (`iaDeparaGrupoFilterHtml`, aparece com 2+ grupos) que combina com os baldes de situação. Classificação e endpoints inalterados. CSS `.ia-dp-abas`/`.ia-dp-grupo-*`.

## Sessão 2026-06-28 — v1.22.0 (Comparador de orçamento IA — Fase A)

**Feature:** nova tela em **IA → Comparador de orçamento** (módulo `iaCompara`). Upload de planilha → IA casa cada item com a SINAPI (código ou busca semântica) e **compara o preço planilha × SINAPI** → relatório → export. **Fase A: só análise** (não vira orçamento editável — Fase B). Estrutura espelha o de-para (`iaDepara`); reusa `ia_depara_detect_columns`/`cotacao_num` na leitura e o cosseno do `buscarSemantica`.

**Tabelas novas:** migration `2026-06-28-ia-comparador.sql` + `ensure_ia_compara_tables()`. `ia_compara_jobs` e `ia_compara_itens` — esta com os dados crus (`descricaoOrigem`, `codigoOrigem`, `unidadeOrigem`, `quantidadeOrigem`, `valorUnitOrigem`), o match (`statusClassificacao` enum **achou/faltou_importar/cotacao_propria**, `matchOrigem/Id/Code/Description/Unit/Valor`, `similaridade`) e a comparação (`precoMaisBaixo` enum planilha/sinapi/igual/sem_comparacao, `diferencaValor` = planilha−sinapi, `diferencaPercent`). FK `ON DELETE CASCADE`.

**Endpoints (`?module=ia`):** `comparaUpload` (POST multipart), `comparaStart` (POST), `comparaStatus` (GET + counts), `comparaItens` (GET + counts + **resumo**), `comparaAceitar` (POST), `comparaExport` (GET .xlsx). `ia_compara_resumo()` agrega via SQL: nº planilha mais barata / SINAPI mais barata / iguais + economia/excesso total (Σ diferença×quantidade quando há qtd). Constantes `IA_COMPARA_ACHOU_MIN=0.80`, `IA_COMPARA_REVISAR_MIN=0.60`, `IA_COMPARA_PRECO_TOLERANCIA=0.005`, `IA_COMPARA_COMMIT_EVERY=25`.

**Worker:** `scripts/ia_compara_worker.php` (espelha `ia_depara_worker.php`; `spawn_ia_compara_worker`). Classificação: com código → existe na base = ACHOU; não existe = **FALTOU_IMPORTAR**. Sem código → top1 ≥60% ACHOU (60–80% marca "similaridade baixa/revisar" no front via aviso ⚠), <60% COTAÇÃO PRÓPRIA. **Comparação só quando ACHOU + há `valorUnitOrigem` + `matchValor>0`:** `diferencaValor=valorUnitOrigem−matchValor`, `%`, e `precoMaisBaixo` (tolerância 0,5% = igual). Nunca inventa preço → faltando um valor = `sem_comparacao`.

**Frontend:** `renderIaCompara()` + `iaCompara*` (`app.js`). Resumo no topo (economia/excesso), baldes por situação (reusa classes `.ia-dp-b-*`), tabela **Valor planilha × Valor SINAPI** com destaque `.ia-cmp-low` no mais barato e badge `.ia-cmp-badge` (planilha −R$/% verde, SINAPI mais barata vermelho), aviso ⚠ p/ similaridade <80%, Aceitar por item e Exportar relatório. CSS `.ia-cmp-*` em `styles.css`. **Não** transforma em orçamento e **não** faz agrupamentos multidimensionais (próximas fases).

## Sessão 2026-06-28 — v1.21.0 (De-para em lote da IA)

**Feature:** nova tela em **IA → De-para em lote** (módulo `iaDepara`). Upload de um orçamento externo (.xlsx/.xls/.csv) → a IA classifica cada item contra a base SINAPI por busca semântica → revisão → export. Reusa a lógica do `action=buscarSemantica` (embedding + cosseno sobre `ia_embeddings`).

**Tabelas novas:** migration `2026-06-28-ia-depara-lote.sql` + `ensure_ia_depara_tables()` (auto-cura runtime, igual a `ia_embeddings`). `ia_depara_jobs` (lote/progresso) e `ia_depara_itens` (linha crua da planilha + resultado: `statusClassificacao` enum achou/revisar/cotacao_propria, `matchOrigem/matchId/matchCode/matchDescription/matchUnit/matchValor`, `similaridade` 0-100, `top3Json`, `aceito`). FK `ia_depara_itens.jobId → ia_depara_jobs.id ON DELETE CASCADE`.

**Endpoints (POST/GET em `?module=ia`):** `deparaUpload` (POST multipart: lê a 1ª aba com `read_xlsx_sheets`, detecta colunas por cabeçalho normalizado em `ia_depara_map_header`/`ia_depara_detect_columns` — descrição obrigatória; grava linhas cruas, **não inventa dados**), `deparaStart` (POST {jobId}: zera resultados e dispara o worker; exige `ia_embeddings` já populada), `deparaStatus` (GET polling + counts), `deparaItens` (GET lista + filtro por situação), `deparaAceitar` (POST {itemId, aceito}), `deparaExport` (GET download .xlsx via PhpSpreadsheet). Helper `ia_read_json_body()` lê o corpo JSON no padrão `{success,data,message}`.

**Worker:** `scripts/ia_depara_worker.php` (espelha `ia_index_worker.php`; spawn por `spawn_ia_depara_worker` com nohup+nice-19). Carrega os vetores em memória 1x (query não-bufferizada, norma pré-calculada), monta mapas SINAPI por id e código→id, e por item: embed + cosseno top1/top3. **Regra (constantes `IA_DEPARA_ACHOU_MIN=0.80`, `IA_DEPARA_REVISAR_MIN=0.60`, `IA_DEPARA_COMMIT_EVERY=25`):** com código na planilha → existe na base = ACHOU (match por código, sim=100); não existe = REVISAR. Sem código → top1 ≥80% ACHOU, 60–80% REVISAR, <60% COTAÇÃO PRÓPRIA. Commit a cada 25.

**Frontend:** `renderIaDepara()` + `iaDeparaUpload/Start/Poll/LoadResults/RenderResult/RowHtml/Aceitar/Export` (`app.js`). Módulo registrado em `moduleNames`, seção `ia` da sidebar, `SUBMODULE_ICONS` (`ti-arrows-exchange`) e roteamento. Upload via `fetchForm`; download autenticado via `fetch + authHeaders + blob` (igual `exportSinapiExcel`). Baldes coloridos achou/revisar/cotacao + tabela com Aceitar / "Criar comp. própria" (que por ora só navega para `ownCompositions` — criação completa é a próxima fase). CSS `.ia-dp-*` em `styles.css`. **Não** foram feitos os agrupamentos multidimensionais (disciplina/ala/fornecedor) — próxima fase.

## Sessão 2026-06-28 — v1.20.0 (Busca semântica IA na base SINAPI)

**Feature:** nova tela em **IA → Busca semântica** (módulo `iaBusca`). O usuário descreve o item em linguagem natural e recebe as composições/insumos SINAPI mais parecidos **por significado** (não por palavra exata), ordenados por **similaridade de cosseno** sobre os ~25 mil vetores já indexados em `ia_embeddings` (10.378 composições + 14.565 insumos, embeddings JSON de 384 dims).

**Endpoint:** `POST ?module=ia&action=buscarSemantica`, corpo `{ texto, limite?=20 (1–100), origem?='todos'|'composicao'|'insumo' }`. Fluxo em `handle_ia_busca_semantica()` (`api/index.php`, logo após `handle_ia_index_status`): (1) `ollama_embed($texto)` → vetor 384; (2) varre `ia_embeddings` (filtrando por `origem`), calcula cosseno = produto escalar / (normA·normB) — vetores **não** são pré-normalizados, então a norma é calculada no laço; (3) `usort` desc + `array_slice($limite)`; (4) busca os dados reais em lote via `ia_fetch_sinapi_rows()` (`sinapi_composicoes.unitCost` / `sinapi_insumos.unitPrice`); (5) responde `{success, data:[{origem, code, description, unit, valor, similaridade(0–100)}]}` no padrão `sinapi_module_respond`. Itens indexados mas removidos da base são ignorados. **Performance:** carrega tudo em memória (`memory_limit=1024M`, `set_time_limit=120`); se ficar lento, cachear vetores em APCu (TODO).

**Frontend:** `renderIaBusca()` + `runIaBusca()` + `renderIaBuscaResultados()`/`iaSimBadge()` (`app.js`). Módulo `iaBusca` registrado em `moduleNames`, na seção `ia` da sidebar (junto de `iaIndex`/`iaTest`), em `SUBMODULE_ICONS` (`ti-search`) e no roteamento de `render()`. Badge de similaridade: verde >80, amarelo 60–80, cinza <60 (classes `.ia-sim-*` em `styles.css`). Usa `apiModuleRequest`. Sem migration/tabela nova (reaproveita `ia_embeddings`). **De-para em lote (upload de planilha) ainda NÃO existe** — só a busca individual.

## Sessão 2026-06-28 — v1.19.0 (Importação mensal SINAPI)

**Fluxo novo:** em `Orçamento de Obra > Base SINAPI`, o card "Importação mensal SINAPI" faz upload múltiplo dos arquivos oficiais, gera prévia persistida, processa em fila e permite definir a referência padrão atual.

**Endpoints reais:** `?module=sinapi&action=previewPacote`, `processarPacote`, `statusImportacao`, `listarReferencias`, `ativarReferencia`. O endpoint antigo `GET api/sinapi-buscar?q=` continua existindo e agora usa `sinapi_referencias.isDefault = 1` quando nenhum filtro de referência é passado.

**Tabelas/colunas novas:** migration `2026-06-28-sinapi-importacao-mensal.sql`; auto-cura `ensure_sinapi_monthly_import_tables()`. Novas tabelas `sinapi_import_files`, `sinapi_import_errors`; novas colunas `sinapi_referencias.isDefault/defaultAt/importJobId`, `sinapi_import_jobs.replaceExisting/packagePreviewJson`, `orcamento_obra_itens.sinapiSnapshotJson`.

**Worker:** `scripts/sinapi_import_worker.php` continua sendo o processador assíncrono. Quando `replaceExisting=1`, ele limpa somente os dados da referência/recurso antes do upsert. Erros por linha vão para `sinapi_import_errors`.

**Dependência obrigatória para XLSX:** `PhpSpreadsheet`. Sem ela, a API retorna 422 orientando:
```
cd /var/www/financeiro && composer require phpoffice/phpspreadsheet
```

**Snapshot de orçamento:** ao adicionar item SINAPI ao orçamento, o frontend grava `sinapiSnapshotJson` com código, descrição, unidade, custo unitário, mês/ano/UF e tipo de preço/referência, além das colunas já existentes. Orçamentos antigos não devem ser recalculados automaticamente ao trocar a base padrão.

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
