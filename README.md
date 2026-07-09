# ObraSync

> Versão `v1.32.1` · 2026-07-09

ObraSync é uma aplicação web em HTML, CSS, JavaScript puro, PHP e MariaDB/MySQL para gestão integrada de obras, financeiro, comercial e contabilidade gerencial. O frontend fica em `/var/www/financeiro`, a URL pública é `https://schimanskiengenharia.com.br/financeiro`, os dados persistentes ficam no banco e os arquivos de dados ficam fora da pasta pública.

Antes de atualizar em produção, faça backup do banco e de `/var/lib/financeiro`. **Nunca sobrescreva `/etc/financeiro/config.php`**, uploads, backups ou o banco MariaDB/MySQL.

---

## Para quem está retomando o projeto (leia primeiro)

Esta seção orienta qualquer pessoa — ou outra IA — que precise continuar o trabalho sem se perder.

- **Versão atual:** `v1.19.0` (2026-06-28). A versão fica em **dois lugares que devem andar juntos**: a constante `APP_VERSION`/`APP_VERSION_DATE` no topo de `app.js` (com `APP_CHANGELOG`) e o cabeçalho deste README. O painel "Versão" em Configurações lê de `APP_VERSION`.
- **Cache busting:** sempre que `app.js` ou `styles.css` mudarem, **incremente o `?v=NNNN`** das tags correspondentes em `index.html` (hoje `app.js?v=1770`, `styles.css?v=1770`). Sem isso o navegador serve a versão velha.
- **Estado de saúde (2026-06-28):** em produção e estável. A leva **v1.15→v1.18** entregou o fluxo **Orçamento → Proposta com base SINAPI** (múltiplos orçamentos, BDI flexível, licitação, hierarquia por disciplina, modelos), **SINAPI no PDF + export Excel**, **contrato a partir da proposta** (template 13 cláusulas + anexos assinados), **CEP autofill universal** (corrigindo a regressão do CSP), **endereço próprio da obra** e a **exclusão de análise de viabilidade**; além do **fix do asDate** (Viabilidade travando). Ver o changelog abaixo e `STATUS.md` para o que está FEITO vs PENDENTE.
- **Arquitetura:** SPA sem build. Todo o frontend está em `app.js` (arquivo único, ~15 mil linhas) + `index.html` (shell) + `styles.css`. Todo o backend está em `api/index.php` (arquivo único, ~8,7 mil linhas). O banco é MariaDB/MySQL (`financeiro`).
- **Convenções do backend (siga-as):** respostas via `respond(['ok' => true, 'data' => ...])` e erros via `fail($msg, $status)`; INSERT/UPDATE genéricos via `insert_dynamic()`/`update_dynamic()` (descartam colunas inexistentes — toleram diferenças de schema); auditoria via `server_audit()`. Muitas tabelas novas são criadas sob demanda por funções `ensure_*` no próprio `index.php` (além das migrations).
- **Convenções do frontend:** chamadas autenticadas via `apiRequest()`; uploads via `fetchForm()`; toasts via `showToast()`; escape de HTML via `svgText()`/`escapeHtml()`. O token de sessão vai no header `Authorization: Bearer`.
- **Deploy:** push na `main` → webhook GitHub → `deploy.php` roda `git pull` + backup pré-deploy. Em produção rode as migrations novas manualmente após o deploy. Nunca toque em `/etc/financeiro/config.php`, uploads, backups ou banco.
- **Onde o histórico está documentado:** o changelog navegável está em `APP_CHANGELOG` (app.js) e na seção **Histórico de Versões** logo abaixo; as duas rodadas de auditoria de código (todas concluídas) estão no fim deste README como registro histórico.

---

## Histórico de Versões

Mapa de cada marco do produto, do mais novo ao mais antigo, com as features e as tabelas/arquivos envolvidos. Use-o para entender *o que existe e por quê* antes de mexer.

### v1.19.0 — 2026-06-28 · Importação mensal SINAPI com pacote, prévia e referência padrão

- **Base SINAPI dentro de Orçamento de Obra:** o card "Importação mensal SINAPI" agora aceita upload múltiplo dos arquivos oficiais da competência (`Referência`, `mão de obra`, `famílias/coeficientes`, `manutenções`), gera prévia antes de processar e mostra histórico de referências/importações.
- **Backend novo por módulo:** `?module=sinapi&action=previewPacote|processarPacote|statusImportacao|listarReferencias|ativarReferencia`, reaproveitando `sinapi_import_jobs` e o worker `scripts/sinapi_import_worker.php`.
- **Migration:** `2026-06-28-sinapi-importacao-mensal.sql` adiciona `sinapi_import_files`, `sinapi_import_errors`, `sinapi_referencias.isDefault/defaultAt/importJobId`, `sinapi_import_jobs.replaceExisting/packagePreviewJson` e `orcamento_obra_itens.sinapiSnapshotJson`.
- **Reimportação controlada:** opção de manter/atualizar a base existente ou substituir os registros da referência importada antes do upsert.
- **Referência padrão atual:** uma referência pode ser marcada como padrão; `GET api/sinapi-buscar?q=` continua compatível e passa a usar a referência padrão quando nenhum filtro é informado.
- **Snapshot no orçamento:** itens SINAPI gravam código, descrição, unidade, custo unitário, UF/mês/ano e tipo de referência no momento da inclusão, evitando alteração retroativa de orçamentos antigos.
- **Dependência XLSX:** leitura de `.xlsx/.xls` exige PhpSpreadsheet; sem a biblioteca a API retorna 422 orientando `cd /var/www/financeiro && composer require phpoffice/phpspreadsheet`.

### v1.18.0 — 2026-06-28 · Fluxo Orçamento → Proposta (SINAPI), contrato, CEP universal e correções

> Consolidação da leva **v1.15 → v1.18** (commits `c55d713`, `4fe6974`, `b3bd75f`, `801d428`, `7674875`, `fe821e2`, `93fef84`, `a36ecea`, `21f8400`). **Nomes de tabelas/colunas abaixo conferidos no código** (não no doc antigo).

- **Base SINAPI alimentando o orçamento e a proposta** (`c55d713`; migration `2026-06-28-orcamento-proposta-sinapi.sql`; `ensure_proposal_cost_columns`):
  - Busca instantânea na base SINAPI completa: endpoint `GET api/sinapi-buscar?q=` (≤20, código por prefixo + descrição `LIKE`) + índices `idx_comp_code`/`idx_insumo_code`. A aba "Buscar SINAPI" do orçamento agora consulta o servidor (antes só os ~300 do cache).
  - `proposta_itens` ganhou `custo_unitario`, `bdi_item`, `orcamento_item_id`, `sinapi_id` (a proposta passa a **registrar o custo** vindo do orçamento técnico).
  - `commercial_proposals` ganhou `bdi_geral`, `bdi_tipo` ENUM(`percentual`/`valor_fixo`/`por_item`/`misto`), `custo_total_orcamentos`, `valor_bdi_total`, `modo_licitacao` ENUM(`Não`/`Sim`).
- **Proposta com múltiplos orçamentos + BDI ponderado** (`4fe6974`): `proposta_orcamento_vinculos` estendida com `nome_grupo`, `bdi_grupo`, `custo_total`, `valor_venda`, `ordem`. Vincular vários orçamentos como grupos; totalizador com custo, **BDI médio ponderado**, venda e margem; resumo por grupo no PDF do cliente (sem expor custo).
- **BDI flexível** (`b3bd75f`): seletor "Formação do preço (BDI)" no gerador — **automático** (mantém preço do orçamento), **geral %**, **por grupo**, **manual por item** (calcula o BDI resultante). Visão interna (custo+BDI+margem) alternável da visão do cliente.
- **Modo licitação** (`801d428`): comparativo **referência SINAPI** (custo × BDI de referência) **× valor ofertado**, com o % de desconto por item e global ("Oferta com X% de desconto sobre a referência SINAPI").
- **Correção do `asDate`** (`7674875`): passou a aceitar **datetime do MySQL** (`"2026-06-28 04:31:10"`) e datas inválidas/zeradas (`0000-00-00`) **sem lançar `RangeError`**. Corrigiu a aba **Viabilidade** que ficava eternamente "carregando" (o erro estourava dentro de um `.map` em `renderViabilidadeList`).
- **CEP autofill universal + autofill de cadastro + endereço da obra** (`fe821e2`; migration `2026-06-28-obra-endereco-local.sql`; `ensure_obra_endereco_columns`):
  - **CSP corrigido** — a regressão era o `connect-src 'self'` no `.htaccess` **bloqueando o fetch ao ViaCEP**. Agora `connect-src` libera `https://viacep.com.br https://brasilapi.com.br`.
  - `bindCepInput`/`initFormEnhancers`: qualquer campo `.cep-input`/`[data-cep]`/`name=zipCode|cep|obra_cep` em **qualquer formulário/modal** (via `MutationObserver`) busca ViaCEP → **fallback BrasilAPI** e preenche `address`/`bairro`/`cidade`/`estado` por convenção de `name`, de forma **não-destrutiva**.
  - `setupClientAutofill` e o novo `setupSupplierAutofill` são auto-ligados a selects `clientId`/`supplierId` em todos os forms.
  - **Endereço próprio da obra:** `projects` ganhou `usa_endereco_empresa` (TINYINT default 1), `bairro`, `cidade`, `estado` — **reaproveitando** `projects.address` e `projects.zipCode` que **já existiam** (⚠️ NÃO há `obra_cep`/`obra_endereco`; o doc/branding antigo divergia). Toggle "A obra fica no mesmo endereço da empresa?"; PDFs usam o endereço próprio quando `usa_endereco_empresa=0`.
- **Hierarquia de proposta por disciplina + modelos + SINAPI no PDF + export Excel** (`93fef84`; migration `2026-06-28-proposta-hierarquia-modelos.sql`; `ensure_proposta_hierarquia`):
  - Nova `proposta_grupos` (`proposalId`, `parent_id`, `nivel`, `ordem`, `disciplina`, `nome`) — árvore por disciplina (Elétrico → Solar/Instalações/Subestação; Hidráulico; Civil → Fundação/Alvenaria). `proposta_orcamento_vinculos` ganhou `grupo_id`+`disciplina`; `proposta_itens` ganhou `grupo_id`. O PDF agrupa o investimento por disciplina com subtotais. *(A UI atual atribui disciplina por orçamento e agrupa; o editor drag-and-drop n-níveis ficou para evolução.)*
  - Nova `proposta_modelos` (`nome`, `descricao`, `disciplina`, `estrutura_json`, `ativo`): "Salvar como modelo" serializa a estrutura (sem cliente) e "Aplicar modelo…" reaplica numa nova proposta.
  - **SINAPI no PDF:** cada item com `sinapi_id` mostra código SINAPI + referência (mês/ano/UF, de `sinapi_referencias`) e há o anexo "Composições SINAPI utilizadas" (omitido se nenhum).
  - **Export Excel** `GET api/sinapi-export-obra?obra_id=` (`handle_sinapi_export_obra`, **PhpSpreadsheet**): `.xlsx` dos itens de origem SINAPI da obra, agrupado por etapa/disciplina com subtotais; botão "Exportar SINAPI (Excel)".
- **Contrato a partir da proposta + anexos assinados** (`a36ecea`; migration `2026-06-28-contrato-proposta-anexos.sql`; `ensure_contrato_columns`):
  - `sales_contracts` **reaproveita** `proposalId` (origem) e ganhou `numero_contrato`, `data_contrato`, `valor_contrato`, `objeto`, `status_contrato` (rascunho/gerado/assinado), `proposta_assinada_path`, `contrato_gerado_path`, `contrato_assinado_path` e snapshot do cliente (`cliente_nome`, `cpf_cnpj`, `email`, `telefone`, `endereco`, `cidade`, `estado`, `cep`).
  - "Gerar contrato" clona snapshot + valor (com BDI) + objeto consolidado por disciplina. **PDF do contrato gerado pelo NAVEGADOR** (igual proposta/RDO — não há lib de PDF server-side em PHP) no template **Prestação de Serviços Técnicos (13 cláusulas)**; campos sem dado viram placeholders editáveis.
  - Anexos via `POST api/contrato-upload` / `GET api/contrato-download` em `/var/lib/financeiro/uploads/contratos` (PDF, `store_upload`); ao anexar o contrato assinado → `status_contrato='assinado'`.
- **Excluir análise de viabilidade inteira** (`21f8400`; **sem migration**): `POST/DELETE api/?module=viabilidade&action=delete` — cascata transacional (rollback) **anexos → itens → grupos → análise** e remoção dos **arquivos físicos** do disco (com proteção path-traversal, só sob `/var/lib/financeiro/uploads/`). Botão lixeira na lista com confirmação irreversível.
  - ⚠️ **Nuance de schema:** `viabilidade_anexos` referencia **`item_id`** (NÃO `analise_id`) — o anexo só se liga à análise **através do item** (`viabilidade_itens.analise_id`). Por isso o `SELECT`/`DELETE` dos anexos usa `JOIN viabilidade_itens it ON it.id = an.item_id WHERE it.analise_id = ?`.

### v1.14.0 — 2026-06-28 · Cotações, PBQP-H Fase 1, Viabilidade, dashboard Lucro×Caixa e correções
- **Importação e comparação de cotações** (migration `2026-06-27-cotacao-importacao.sql`; tabelas `cotacao_fornecedor`/`cotacao_itens`; `ensure_cotacao_import_tables`; `?module=cotacoes&action=importar|comparar|salvarItens|exportarCsv`): CSV nativo (`fgetcsv`), **.xlsx/.xls via PhpSpreadsheet** e **PDF via pdftotext** (poppler-utils), com comparação automática contra o orçamento da obra por similaridade de descrição e classificação abaixo/igual/acima/muito_acima. Dependências documentadas no `CLAUDE.md`.
- **PBQP-H Fase 1** (migrations `2026-06-27-pbqph-fase1.sql`, `2026-06-27-qualificacao-fornecedores.sql`): qualificação de fornecedores de materiais controlados, **rastreabilidade por lote**, vínculo **FVM ↔ pedido de compra** e geração de **PDF no PES**. Antecedido pela análise de integração PBQP-H/SiNAT (`docs`).
- **Módulo de Análise de Viabilidade por tipo de obra** (migration `2026-06-27-viabilidade-modulo.sql`): checklist com grupos/itens padrão (solar, obra civil, elétrica, ar-condicionado, cobertura, hidráulica, manutenção), progresso automático, itens aguardando terceiro, anexos, relatório PDF e **bloqueio da proposta** quando há item obrigatório reprovado. Disponível como módulo independente (sem duplicata no Comercial).
- **Dashboard — Lucro Gerencial vs Caixa Real corrigido:** Lucro = todas as contas com **vencimento no período** (exceto canceladas, por `dueDate`); Caixa = **recebido − pago** por data efetiva (`receivedDate`/`paidDate`); **A Receber Líquido = Lucro − Caixa** (pode ser legitimamente negativo). Gráfico de evolução mensal com recorte por obra, cards dinâmicos e alertas (vencidos, etapas atrasadas, propostas expiradas, obras atrasadas, itens em estouro).
- **Ícones Tabler servidos localmente** (`assets/fonts/tabler-icons.min.css` + `.woff2`, sem CDN — compatível com a CSP `font-src 'self'`); subitens da sidebar com **ícones coloridos e animação de entrada corrigida** (antes ficavam invisíveis por `opacity:0` + `prefers-reduced-motion`).
- **Cores por status nas notas/documentos fiscais** e **gráficos do dashboard mais finos** e proporcionais.
- **Correção do erro 500 nas contas a pagar recorrentes:** as constantes `PAYABLE_RECURRENCE_MAX`/`PAYABLE_RECURRENCE_INDETERMINADO` foram movidas para o topo de `api/index.php` (PHP **não faz hoisting de `const`** — ficavam indefinidas em runtime, pois o roteamento inline dá `exit` antes de alcançá-las) e a geração das parcelas passou a **blindar as chaves estrangeiras** (fornecedor/obra/categoria/centro de custo/conta).
- **Inclui também** (consolidação dos marcos intermediários não versionados no histórico): centros de custo com tipo **Fiscal / Tributário** e lista padrão de 25 centros (v1.13.0); fechamento das pendências MÉDIO/BAIXO da varredura — `ensure_*` faltantes, hardening XXE, sanitização de logo SVG e filtros corrigidos (v1.12.1).

### v1.12.0 — 2026-06-27 · Orçamento profissional, dashboard de execução e varredura de segurança
- **Refatoração do Orçamento de Obra** (migration `2026-06-09-orcamento-estrutura-completa.sql`; tabela `orcamento_etapas` + colunas `codigo`/`tipo`/`etapa_id`/`sinapi_id`/`composicao_propria_id`/`ordem` em `orcamento_obra_itens`; `ensure_budget_structure`). Estrutura por **etapas/subitens**, **tipos de custo** (material, mão de obra, equipamento, subempreiteiro, outros), código hierárquico, **BDI por etapa** e quatro visões: **Por Etapa**, **Por Centro de Custo**, **Por Tipo de Custo** e **Previsto vs Realizado**. Modal de inclusão em 3 abas (SINAPI/Composição própria/Manual), totalizadores, impressão e exportação CSV.
- **Realizado vs Orçado** no Orçamento de Obra (endpoint `?module=workBudgetExecution`; `orcamento_item_execucao_log`; migration `2026-06-09-execucao-orcamento-historico.sql`): badges de execução, alerta de estouro, totalizadores, barra de progresso, filtros e atualização da quantidade realizada com histórico.
- **Dashboard de execução de obras** (endpoint `?module=dashboardExecution&action=summary`): 3 widgets (execução por obra, alerta de estouro e gráfico **Previsto vs Realizado**) que consomem o resumo do servidor, com **spinner** de carregamento, **erro + botão retentar**, **auto-refresh a cada 5 min** / botão Atualizar e **tooltip combinado por obra** no gráfico SVG.
- **Pedidos de compra com itens detalhados** (migration `2026-06-09-purchase-order-items.sql`; `purchase_order_items` + `condicoes_pagamento`/coluna de vínculo a orçamento; `ensure_purchase_order_items`) e visualização individual imprimível com cabeçalho/rodapé da empresa.
- **Identidade visual nos documentos** (`generateDocumentHeader`/`generateDocumentFooter`): logo, dados e endereço completo da empresa em propostas, pedidos de compra e RDO; upload de logo/site (`logo_url`/`website`/`instagram`/`whatsapp`; migrations `2026-06-09-logo-site-empresa.sql`, `…-campos-endereco-fornecedores-empresa.sql`).
- **Preenchimento automático global de dados do cliente** em todos os módulos (busca pontual `?module=clients&action=get`), **snapshot do cliente em propostas/contratos** (migration `2026-06-09-snapshot-cliente-proposta.sql`) e **busca de endereço por CEP (ViaCEP)** com campos cidade/estado/complemento em clientes e fornecedores.
- **Contas a pagar recorrentes + quitação antecipada** (migration `2026-06-09-contas-recorrentes.sql`; `ensure_payable_recurrence_columns`) e **prevenção de dupla contagem** caixa ↔ conta a pagar (migration `2026-06-09-vinculo-caixa-conta-pagar.sql`; `ensure_referencia_columns`).
- **Correções de erro 500:** auto-cura das colunas de recorrência na criação de parcelas; colunas de referência adicionadas a `accounts_receivable` na aprovação de marcos (`automate_approved_milestone`).
- **Varredura de segurança (2026-06-27):** correção de **XSS armazenado** em widgets do dashboard, cards de agenda/kanban, `<option>`/cabeçalhos e helpers de relatório (`bars`/`kpi`); **rate limit** na rota de troca obrigatória de senha (anti força-bruta/enumeração); **bloqueio do diretório `.git`** no Apache. Detalhes e pendências em `STATUS.md`.

### v1.11.0 — 2026-06-13 · Importação de NFS-e (XML ABRASF)
- **Importação de XML NFS-e** (`handle_nfse_preview`/`handle_nfse_import` + `parse_nfse_abrasf` em `api/index.php`; `setupNfseImport`/`analisarNfseXml`/`renderizarPreviewNfse`/`importarNfsesSelecionadas` em `app.js`). Lê o XML padrão ABRASF (uma ou várias NFs), mostra prévia em lote e grava: NFs **emitidas** pela empresa → **Contas a Receber**; NFs de **fornecedores** → **Contas a Pagar**. Cada NF vira também um `fiscal_documents` vinculado à obra (obrigatória). Controle de duplicatas por `documentNumber` (`NFS-e <numero>`). Tudo transacional.
- **Criação automática de cliente/fornecedor** (`nfse_create_entity`): quando o tomador (emitida) ou prestador (recebida) não está cadastrado, o usuário pode marcar na prévia para criar o registro a partir do XML (nome, CNPJ/CPF, endereço, CEP, e-mail, telefone). O parser passou a extrair endereço/contato das duas partes; o frontend envia `criarEntidades` + os objetos `tomador`/`prestador`; a API devolve `data.criados[]`.

### v1.10.0 — 2026-06-12 · Conciliação bancária OFX
- **Importação OFX multi-banco** (migration `2026-06-12-ofx-conciliacao.sql`; tabelas `ofx_imports` e `ofx_fitids`; colunas de conciliação em `accounts_payable`/`accounts_receivable`). Parser de OFX, controle de duplicatas por **FITID**, saldo por extrato, KPI cards por banco, cadastro simplificado de conta, prévia e histórico.
- **Match automático** por valor + data com **baixa automática** das contas a pagar/receber e importação avulsa de lançamentos sem contraparte.

### v1.9.0 — 2026-06-09 a 2026-06-11 · Produtividade, qualidade, plugins e hardening
- **Agenda e Kanban** integrados às obras (migration `2026-06-09-agenda-kanban.sql`; `agenda_eventos`, `kanban_boards`, `kanban_colunas`, `kanban_cards`; correção de enums em `2026-06-10-fix-agenda-enums.sql`).
- **Importador SINAPI assíncrono** (migration `2026-06-11-sinapi-import-jobs.sql`; tabela `sinapi_import_jobs`; worker `scripts/sinapi_import_worker.php`). Upload dos 4 arquivos CEF, processamento em fila, prévia e acompanhamento de progresso. Importação restrita ao **admin**.
- **Módulo PBQP-H Nível B** (commit `7526d50`; tabelas `qualidade_politica`, `qualidade_pqo`, `qualidade_pes`, `qualidade_fvs`, `qualidade_fvm`, `qualidade_nc`, `qualidade_treinamentos`, `qualidade_auditorias`). PQO, PES, FVS, FVM, NC, Treinamentos, Auditoria e Dashboard, integrados ao cronograma.
- **Sistema de plugins** (migration `2026-06-10-system-plugins.sql`; tabela `system_plugins`) e **plugin de Estudo de Seletividade** (`plugins/seletividade/`) com estudos salvos no banco e PDF técnico em padrão ABNT NBR 14724.
- **Análises de viabilidade** (migration `2026-06-10-viability-analyses.sql`; tabela `viability_analyses`) com histórico de parecer.
- **Endurecimento de segurança** (auditorias de 2026-06-11, todas concluídas — ver fim do README): rate limit de login/reset (`login_attempts`), reset sem enumeração de e-mail, TTL absoluto de sessão de 12 h, **audit_log server-side** (`audit_log`), CSP/HSTS, tema extraído para `theme-init.js`, tokens fora das URLs, `list_records` com `?limit/?offset`.

### v1.8.0 — 2026-06-10 · Autenticação real e força de senha
- Token de sessão na API (`api_sessions`), autorização por rota/perfil (`role_permissions`), força de senha (PHP+JS), reset por e-mail com token de 2 h (`password_reset_tokens`), `mustChangePassword` no primeiro login.

### Até v1.8.0 — base do produto
- Gestão integrada de obras, financeiro, comercial e contabilidade gerencial; orçamentos com base SINAPI; gerador de propostas a partir de orçamento; cronograma físico-financeiro + Gantt + Microsoft Project (XML); estruturas editáveis; RBAC; deploy automático por webhook. Ver `APP_CHANGELOG` em `app.js` para a lista completa.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML, CSS e JavaScript puro (sem frameworks, sem build) |
| Backend | PHP (API única em `api/index.php`) |
| Banco de dados | MariaDB/MySQL, charset `utf8mb4` |
| Servidor | Apache (com `.htaccess` na raiz e em `api/`) |
| Configuração | `/etc/financeiro/config.php` (fora da pasta pública) |
| Deploy | `deploy.php` + webhook GitHub + cron de backup |

---

## Estrutura de Arquivos

```
/var/www/financeiro          ← raiz pública
  index.html                 # Shell único da SPA (cache busting via ?v=NNNN)
  app.js                     # Toda a lógica do frontend (arquivo único, ~10 mil linhas)
  theme-init.js              # Aplica o tema antes do render (extraído por causa do CSP)
  styles.css                 # Estilos e responsividade
  schema.sql                 # Schema base do banco (tabelas criadas no install do zero)
  deploy.php                 # Webhook de deploy automático via GitHub
  backup-pre-deploy.sh       # Backup automático disparado pelo deploy.php
  .htaccess                  # Segurança e headers HTTP (CSP/HSTS)
  .deployignore              # Lista do que o deploy NUNCA pode tocar
  api/
    index.php                # API REST PHP (CRUD genérico + rotas especiais + ensure_*)
    config.sample.php        # Exemplo de configuração (copie para /etc/financeiro/)
    cron/jobs.php            # Tarefas agendadas (backup; expurgo de audit_log/login_attempts)
    .htaccess
  migrations/                # Migrações SQL incrementais (ver lista abaixo)
  scripts/
    sinapi_import_worker.php # Worker da fila de importação SINAPI (assíncrono)
  plugins/
    seletividade/            # Plugin Estudo de Seletividade (app.js, index.html, style.css)
  assets/                    # Imagens estáticas
  README.md

/var/lib/financeiro          ← dados fora da pasta pública
  backups/
  uploads/
    obras/
    propostas/
    notas-fiscais/
    relatorios/
    projetos/
    sinapi/
    project/
    cotacoes/
  deploy.log

/etc/financeiro/config.php   ← credenciais (nunca sobrescrever)
```

---

## Módulos do Sistema

A navegação é organizada em seções na sidebar (os módulos visíveis dependem do perfil e dos plugins habilitados):

### Dashboard
KPIs dinâmicos, gráficos SVG, indicadores gerais e por obra, filtros por período/cliente/projeto/status.

### Cadastros
Clientes, Fornecedores, Produtos, Serviços, Categorias financeiras, Centros de custo, Contas bancárias.

### Obras/Projetos *(eixo central)*
- Obras/Projetos, Custos por obra, Receitas por obra.
- **Orçamentos de Obras** com base **SINAPI 04/2026 (UF padrão MS)**: referências, insumos, composições, itens, mão de obra, famílias/coeficientes, manutenções, importador XLSX/CSV.
- Composições próprias, Cotações, **Curva ABC**.
- **Cronograma físico-financeiro**, marcos, **Gantt simplificado**, integração **Microsoft Project (XML)**.
- Notificações, links de acompanhamento, pedidos de compra, relatórios técnicos.
- **Notas Fiscais / Documentos Fiscais** (upload, download, vínculo com obra).
- **Agenda** e **Kanban** integrados.

### Financeiro
Contas a receber, Contas a pagar, Movimentações de caixa, Fluxo de caixa, Conciliação bancária.

### Comercial
- Orçamentos, **Propostas comerciais** (itens, histórico de status, arquivos, vínculos, variáveis dinâmicas).
- **Gerador de proposta a partir de orçamento**, com modelos editáveis, pré-visualização e PDF A4.
- Taxonomia: Áreas/Disciplinas → Tipos de atuação → Subtipos/Serviços.
- Vendas/Contratos.

### Contabilidade Gerencial
Plano de contas, Lançamentos contábeis, **DRE gerencial**, Documentos fiscais, Impostos.

### Qualidade (PBQP-H Nível B)
Política da qualidade, PQO, PES, FVS, FVM, NC, Treinamentos, Auditoria e Dashboard da qualidade, integrados ao cronograma da obra. *(v1.9.0)*

### Plugins
Módulos opcionais habilitáveis por instalação (`system_plugins`). Inclui o **Estudo de Seletividade** (engenharia elétrica) com estudos salvos e PDF técnico ABNT, e **Análises de viabilidade**. *(v1.9.0)*

### Relatórios
Financeiro, por cliente, por fornecedor, por centro de custo, por obra/projeto; Exportações.

### Configurações
Dados da empresa, Usuários, **Permissões/Perfis (RBAC)**, Versão, estruturas editáveis (tipos de obra, status, etapas, marcos, campos personalizados, modelos de relatório, tipos de documento, checklists, tipos de medição, formas de pagamento, mensagens WhatsApp, regras de visualização), Configuração SINAPI, Backup, Preferências, Migração, Log de auditoria, Meu Perfil.

---

## Banco de Dados

### Instalação do zero

```bash
sudo apt update
sudo apt install apache2 mariadb-server php php-mysql php-zip
```

```bash
sudo mariadb
```

```sql
CREATE DATABASE IF NOT EXISTS financeiro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'financeiro_app'@'localhost' IDENTIFIED BY 'TROQUE_ESSA_SENHA_FORTE';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON financeiro.* TO 'financeiro_app'@'localhost';
FLUSH PRIVILEGES;
```

```bash
mysql -u root -p financeiro < /var/www/financeiro/schema.sql
```

### Grupos de tabelas

- **Cadastros**: `clients`, `suppliers`, `products`, `services`, `financial_categories`, `cost_centers`, `bank_accounts`, `formas_pagamento`.
- **Obras**: `projects`, `project_schedule`, `obra_cronograma_etapas`, `obra_cronograma_marcos`, `obra_etapas_padrao`, `obra_marcos_padrao`, `obra_tipos`, `obra_status`, `obra_campos_personalizados`, `obra_valores_personalizados`, `obra_notificacoes`, `obra_links_acompanhamento`, `purchase_orders`, `technical_reports`.
- **SINAPI/Orçamentos**: `sinapi_referencias`, `sinapi_insumos`, `sinapi_composicoes`, `sinapi_composicao_itens`, `sinapi_mao_de_obra`, `sinapi_familias_coeficientes`, `sinapi_manutencoes`, `sinapi_configuracoes`, `orcamentos_obras`, `orcamento_obra_itens`, `composicoes_proprias`, `cotacoes`.
- **Comercial**: `commercial_proposals`, `proposta_itens`, `proposta_arquivos`, `proposta_status_historico`, `proposta_orcamento_vinculos`, `proposta_variaveis`, `proposal_models`, `proposal_areas`, `proposal_action_types`, `proposal_service_subtypes`, `budgets`, `sales_contracts`.
- **Financeiro**: `accounts_receivable`, `accounts_payable`, `cash_bank_movements`.
- **Conciliação OFX**: `ofx_imports`, `ofx_fitids` (+ colunas de conciliação em `accounts_receivable`/`accounts_payable`).
- **Contabilidade**: `chart_accounts`, `journal_entries`, `taxes`, `tax_documents`, `fiscal_documents`, `tipos_documento`.
- **Produtividade**: `agenda_eventos`, `kanban_boards`, `kanban_colunas`, `kanban_cards`, `checklists`, `checklist_itens`, `mensagens_padrao`, `modelos_relatorio`, `tipos_medicao`.
- **Qualidade (PBQP-H Nível B)**: `qualidade_politica`, `qualidade_pqo`, `qualidade_pes`, `qualidade_fvs`, `qualidade_fvm`, `qualidade_nc`, `qualidade_treinamentos`, `qualidade_auditorias`.
- **Plugins / análises**: `system_plugins`, `viability_analyses` (+ tabelas próprias de cada plugin, ex.: estudos de seletividade salvos).
- **Sistema**: `system_users`, `role_permissions`, `regras_visualizacao`, `company_settings`, `system_preferences`, `sistema_versoes`, `api_sessions`, `password_reset_tokens`, `audit_log`, `login_attempts`, `sinapi_import_jobs`.

> Algumas tabelas mais novas (ex.: qualidade, OFX, audit_log, login_attempts) são criadas tanto pelas migrations quanto, em fallback, por funções `ensure_*` em `api/index.php` na primeira utilização. Isso permite que o módulo funcione mesmo se a migration ainda não foi rodada — mas o correto é rodar a migration.

### Migrações incrementais

Execute em ordem **alfabética de nome de arquivo** em bancos existentes (todas usam
`IF NOT EXISTS` — não resetam dados). Desde a correção G4 (2026-07-03) a ordem
alfabética é autossuficiente: nenhuma migration depende de tabela criada só em
runtime ou por migration posterior.

```bash
cd /var/www/financeiro
for f in migrations/*.sql; do
  echo "== $f"
  mysql -u root -p financeiro < "$f" || break
done
```

(O `-p` pergunta a senha a cada arquivo; para rodar sem prompts, use um
`~/.my.cnf` com as credenciais ou `mysql --defaults-extra-file=...`.)

A migration `2026-06-10-password-strength.sql` adiciona `email` e `mustChangePassword` em `system_users` e cria `password_reset_tokens`. Todos os usuários existentes ficam marcados para redefinir a senha no próximo login.

> **Ordem importa**: rode na ordem alfabética (que coincide com a cronológica). Todas usam `IF NOT EXISTS`/`ADD COLUMN` idempotentes — repetir não reseta dados. As tabelas de qualidade (PBQP-H) e algumas colunas novas também têm fallback `ensure_*` no `api/index.php`, mas rodar a migration é o caminho recomendado em produção. Nota: `2026-06-08-sinapi-2026-04-ms-importer.sql` foi renomeada para `2026-06-09-sinapi-2026-04-ms-importer.sql` (precisa rodar depois da `2026-06-08-sinapi-msproject-editable-structures.sql`, que cria as tabelas que ela altera).

---

## Configuração PHP

```bash
sudo mkdir -p /etc/financeiro
sudo cp /var/www/financeiro/api/config.sample.php /etc/financeiro/config.php
sudo nano /etc/financeiro/config.php
```

```php
return [
    'db' => [
        'host'     => '127.0.0.1',
        'database' => 'financeiro',
        'user'     => 'financeiro_app',
        'password' => 'TROQUE_ESSA_SENHA_FORTE',
        'charset'  => 'utf8mb4',
    ],
    'data_dir'      => '/var/lib/financeiro',
    'backup_dir'    => '/var/lib/financeiro/backups',
    'upload_dir'    => '/var/lib/financeiro/uploads',
    'auth' => [
        'dev_bypass' => false,  // NUNCA habilite em produção
    ],
    // Secret do webhook GitHub (gere com: php -r "echo bin2hex(random_bytes(32));")
    'deploy_secret' => 'COLE_AQUI_A_CHAVE_GERADA',
    'mail' => [
        'from_email'    => 'noreply@schimanskiengenharia.com.br',
        'from_name'     => 'ObraSync',
        'app_url'       => 'https://schimanskiengenharia.com.br/financeiro',
        'smtp_host'     => '',      // vazio = usa php mail() com relay do servidor
        'smtp_port'     => 587,
        'smtp_user'     => '',
        'smtp_pass'     => '',
        'smtp_tls'      => true,
        'log_reset_url' => false,   // true = loga URL de reset no error_log (dev)
    ],
];
```

```bash
sudo chown root:www-data /etc/financeiro/config.php
sudo chmod 640 /etc/financeiro/config.php
```

---

## Pastas de Dados

```bash
sudo mkdir -p \
  /var/lib/financeiro/backups \
  /var/lib/financeiro/uploads/obras \
  /var/lib/financeiro/uploads/propostas \
  /var/lib/financeiro/uploads/notas-fiscais \
  /var/lib/financeiro/uploads/relatorios \
  /var/lib/financeiro/uploads/projetos \
  /var/lib/financeiro/uploads/sinapi \
  /var/lib/financeiro/uploads/project \
  /var/lib/financeiro/uploads/cotacoes

sudo chown -R www-data:www-data /var/lib/financeiro
sudo chmod -R 750 /var/lib/financeiro
```

Não salve anexos, PDFs, exports ou backups em `/var/www/financeiro/assets`.

---

## Apache

```bash
sudo a2enmod rewrite headers
sudo systemctl reload apache2
```

No VirtualHost, permita `.htaccess`:

```apache
<Directory /var/www/financeiro>
    AllowOverride All
    Require all granted
</Directory>
```

---

## Deploy Automático (GitHub Webhook)

O arquivo `deploy.php` recebe eventos de push do GitHub e executa `git pull` automaticamente.

### Configuração

1. Gere o secret no servidor:
   ```bash
   php -r "echo bin2hex(random_bytes(32));"
   ```

2. Adicione `deploy_secret` em `/etc/financeiro/config.php` (veja seção Configuração PHP).

3. No GitHub: **Settings → Webhooks → Add webhook**
   - **Payload URL**: `https://schimanskiengenharia.com.br/financeiro/deploy.php`
   - **Content type**: `application/json`
   - **Secret**: a mesma chave gerada acima
   - **Events**: `Just the push event`

4. Permissão de sudo para o `www-data` rodar git pull e o backup como `alefschimanski`:
   ```bash
   sudo visudo
   # Adicione:
   www-data ALL=(alefschimanski) NOPASSWD: /usr/bin/git -C /var/www/financeiro pull origin main
   www-data ALL=(alefschimanski) NOPASSWD: /usr/bin/bash /var/www/financeiro/backup-pre-deploy.sh
   ```

5. O log de deploy fica em `/var/lib/financeiro/deploy.log`.

### Deploy manual

```bash
sudo -u alefschimanski git -C /var/www/financeiro pull origin main
```

### Arquivos protegidos — NUNCA sobrescrever em produção

O arquivo `.deployignore` (raiz do repositório) lista tudo o que o deploy **não pode tocar**.
O `git pull` só altera arquivos versionados, então os itens abaixo ficam naturalmente fora
do alcance do deploy — mas o `deploy.php` confere a existência de cada um após o pull e
registra `[ALERTA]` no `deploy.log` (devolvendo HTTP 500 ao webhook) se algum sumir:

| Caminho | Conteúdo |
| --- | --- |
| `/etc/financeiro/config.php` | Credenciais do banco, SMTP e secret do deploy |
| `/var/lib/financeiro/backups/` | Backups do banco (manuais, cron e pré-deploy) |
| `/var/lib/financeiro/uploads/` | Anexos enviados (notas fiscais, cotações, SINAPI, projetos) |
| `.env` / `*.env` / `api/config.php` | Bloqueados pelo `.gitignore` — nunca versionar |

Os dados locais do navegador (localStorage: `finconta.v1`, `finconta.auth`,
`finconta.favorites.*`, `finconta.ah.*`) ficam apenas no cliente e nunca são afetados
pelo deploy.

**Regras de ouro:**

1. Nunca edite `/etc/financeiro/config.php` pelo repositório — ele vive fora de
   `/var/www/financeiro` exatamente para não ser alcançado pelo `git pull`.
2. Nunca rode `git clean -fdx` ou `git reset --hard` no servidor sem backup: esses
   comandos podem apagar arquivos não versionados criados em produção.
3. Antes de qualquer mudança estrutural, confirme que o backup pré-deploy mais
   recente existe em `/var/lib/financeiro/backups/pre-deploy/`.

### Backup automático pré-deploy

O script `backup-pre-deploy.sh` roda automaticamente no início de cada deploy
(chamado pelo `deploy.php`) e:

1. Lê as credenciais do banco direto de `/etc/financeiro/config.php`;
2. Gera `banco-<nome>.sql.gz` via `mysqldump --single-transaction`;
3. Compacta a pasta de uploads em `uploads.tar.gz`;
4. Salva tudo em `/var/lib/financeiro/backups/pre-deploy/AAAAMMDD-HHMMSS/`;
5. Mantém apenas os 10 backups mais recentes (configurável via `KEEP`).

Execução manual a qualquer momento:

```bash
sudo -u alefschimanski /usr/bin/bash /var/www/financeiro/backup-pre-deploy.sh
```

---

## Login e Autenticação

O `schema.sql` cria usuários iniciais (`admin` e `alefschimanski`) com a senha
temporária `TROQUE_NO_PRIMEIRO_ACESSO` e `mustChangePassword = 1` — o sistema
exige a troca no primeiro login. Nenhuma senha real fica versionada no
repositório; em instalações novas, faça o primeiro login imediatamente após
executar o schema (ou edite o placeholder antes).

### Fluxo de sessão

O login emite um token de sessão (tabela `api_sessions`). O frontend envia esse token em todas as requisições (`Authorization: Bearer ...`). A sessão expira após **30 minutos de inatividade**, com aviso 5 minutos antes.

### Força de senha (v1.8.0)

Senhas novas precisam ter:
- Mínimo 8 caracteres
- Pelo menos uma letra maiúscula
- Pelo menos um caractere especial (`!`, `@`, `#`, `%`, etc.)

Todos os usuários existentes são marcados com `mustChangePassword = 1` pela migration e são obrigados a criar uma nova senha no primeiro login após a atualização.

### Redefinição de senha por e-mail

A rota pública `POST /financeiro/api/request-password-reset` gera um token com validade de 2 horas e envia um link por e-mail. A rota `POST /financeiro/api/reset-password` valida o token e atualiza a senha.

Configure a seção `mail` em `/etc/financeiro/config.php` para ativar o envio. Se `smtp_host` estiver vazio, o sistema usa o `mail()` do PHP com o relay configurado no servidor (ex.: Postfix).

### Bypass de desenvolvimento

O bypass de login (`AUTH_BYPASS_FOR_TESTS`) nunca vale em produção. Em desenvolvimento, só se aplica quando a API não está ativa (modo `localStorage`). No backend, `auth.dev_bypass` em `config.php` fica desligado por padrão e só atende `127.0.0.1`/`::1`.

---

## API PHP

### Endpoints principais

```text
POST   /financeiro/api/login
POST   /financeiro/api/logout
POST   /financeiro/api/request-password-reset   ← público (sem token)
POST   /financeiro/api/reset-password           ← público (sem token)
POST   /financeiro/api/change-password          ← autenticado
GET    /financeiro/api/bootstrap
GET    /financeiro/api/fornecedores
POST   /financeiro/api/fornecedores
PUT    /financeiro/api/fornecedores/{id}
DELETE /financeiro/api/fornecedores/{id}
POST   /financeiro/api/migrate                  ← admin
GET    /financeiro/api/backup/export            ← admin
POST   /financeiro/api/backup/import            ← admin
POST   /financeiro/api/sinapi-upload
POST   /financeiro/api/sinapi-import               ← caminho síncrono (limitado)
POST   /financeiro/api/sinapi-import-async         ← enfileira o job (worker)
GET    /financeiro/api/sinapi-import-status        ← progresso do job
POST   /financeiro/api/project-upload
POST   /financeiro/api/nfse-preview                ← analisa o XML NFS-e (multipart)
POST   /financeiro/api/nfse-import                 ← grava NFs + contas (+ cria entidades)
POST   /financeiro/api/ofx-preview                 ← analisa o extrato OFX
POST   /financeiro/api/ofx-import                  ← grava lançamentos do extrato
POST   /financeiro/api/ofx-conciliar               ← match/baixa contra contas
GET    /financeiro/api/ofx-history                 ← histórico de importações OFX
```

Downloads de notas fiscais aceitam token via `?token=` por serem navegação direta do navegador:

```text
GET /financeiro/api/notas-fiscais/{id}/pdf?token=...
GET /financeiro/api/notas-fiscais/{id}/xml?token=...
```

### Autorização por rota e perfil

- Todas as rotas exigem token de sessão, exceto `login`, `request-password-reset` e `reset-password`.
- `backup` e `migrate` exigem perfil `admin`.
- `sinapi-upload`/`sinapi-import` exigem permissão de edição em Configuração SINAPI.
- `project-upload` exige permissão de edição no Cronograma.
- CRUD genérico valida permissão por módulo e ação (GET=visualizar, POST=criar, PUT/PATCH=editar, DELETE=excluir) consultando `role_permissions` — com fallback nos padrões de perfil do frontend.
- O `bootstrap` devolve apenas os módulos que o perfil autenticado pode visualizar.

---

## Perfis e Permissões

| Perfil | Acesso |
|---|---|
| `admin` | Total — todos os módulos e ações |
| `gerente` | Total exceto Usuários e Permissões |
| `financeiro` | Financeiro, contabilidade, documentos fiscais, relatórios e exportações |
| `comercial` | Clientes, orçamentos, propostas, modelos e vendas |
| `engenharia` / `gestor_obra` | Obras, cronograma, pedidos, relatórios técnicos, propostas vinculadas |
| `operador` | Módulos operacionais do dia a dia (sem usuários/permissões) |
| `visualizador` | Leitura em todos os módulos |
| `equipe_campo` | Dashboard e relatório por obra |
| `cliente_obra` | Dashboard, cronograma e relatórios técnicos liberados |
| `consulta` | Dashboard e relatórios financeiros |
| `fornecedor_terceiro` | Dashboard |

A tabela `role_permissions` permite customizar ações (visualizar, criar, editar, excluir, exportar, aprovar, anexar) por módulo para qualquer perfil. Quando não houver linha cadastrada, o sistema usa os padrões acima.

---

## Dashboard

- Visão geral da empresa: consolida todos os dados, sem depender de uma obra selecionada.
- Visão por obra/projeto: filtra serviços, produtos, receitas, despesas, contas, movimentações, fornecedores e documentos fiscais vinculados à obra.
- KPIs dinâmicos calculados do banco.
- Gráficos SVG sem CDN.
- Indicadores comerciais: propostas emitidas, aprovadas e taxa de conversão.
- Filtros por período, cliente, obra/projeto, status da obra, centro de custo e categoria.
- Alertas para contas vencidas, custo acima do previsto e baixa margem.
- Regra de datas: sem data = mostra tudo; só inicial = a partir de; só final = até; ambas = intervalo.

---

## Obras/Projetos como Eixo Central

Cada registro financeiro, comercial ou técnico pode ser vinculado à obra por `projectId`. Isso permite filtrar dashboard, custos, receitas, pedidos, relatórios técnicos, notas fiscais, propostas e contas por obra.

Fluxo comercial integrado:

- Orçamento aprovado → gera Proposta (mantém `workBudgetId`).
- Proposta aprovada → `Converter` → Venda/Contrato.
- Venda/Contrato → `Gerar conta` → Conta a receber (mantém vínculo com cliente, obra, proposta, categoria e centro de custo).

Status de obras: Planejamento, Proposta enviada, Contratada, Em andamento, Pausada, Concluída, Cancelada.

---

## SINAPI e Orçamentos de Obras

Referência padrão incluída: **SINAPI 04/2026, UF MS, Campo Grande/MS**, tipos Sem desoneração, Com desoneração e Sem encargos sociais.

Fluxo recomendado:

1. Confirme a referência padrão `MS 04/2026` em `Base SINAPI`.
2. Em `Base SINAPI > Importar SINAPI`, selecione o arquivo XLSX ou CSV, mês/ano, UF e tipo.
3. Clique em `Validar / prévia` e confira o resumo.
4. Clique em `Confirmar importação` para gravar no banco.
5. Pesquise insumos ou composições por código ou descrição.
6. Selecione o orçamento destino e clique em `Adicionar`.
7. Ajuste quantidade, etapa, centro de custo, categoria, custo unitário e BDI.
8. Use `Gerar proposta` para criar proposta comercial a partir do orçamento.
9. Use `Gerar cronograma` para criar etapas agrupadas por etapa do orçamento.

Compatibilidade de arquivo:

- XLSX: lido diretamente quando o PHP tiver `php-zip` instalado (`sudo apt install php-zip`).
- CSV: alternativa estável — exporte a aba desejada do Excel/LibreOffice como `CSV UTF-8`.

Abas SINAPI aceitas: `ISD`, `ICD`, `ISE`, `CSD`, `CCD`, `CSE`, `Analítico`, `SEM Desoneração`, `COM Desoneração`, `Coeficientes`, `Manutenções`.

A Curva ABC ordena itens por valor total, calcula percentual individual, percentual acumulado e classifica em A, B ou C.

---

## Gerador de Proposta Comercial

Em `Obras/Projetos > Orçamentos de Obras`, o botão `Gerar Proposta` cria uma proposta a partir do orçamento.

Fluxo:

1. Selecione um orçamento (`Rascunho`, `Em análise` ou `Aprovado`).
2. Clique em `Gerar Proposta`.
3. Escolha modelo, cliente, obra, condição de pagamento, prazo, validade e responsáveis.
4. Revise o escopo gerado automaticamente.
5. Escolha o formato: resumida, detalhada, por etapa, por categoria, por centro de custo ou só valor global.
6. Salve como `Rascunho` ou finalize como `Gerada`.
7. Use `Exportar / Imprimir PDF` para layout A4 pelo navegador.

Variáveis aceitas nos modelos:

```
{{nome_cliente}}  {{cpf_cnpj_cliente}}  {{endereco_cliente}}
{{nome_obra}}     {{endereco_obra}}     {{tipo_obra}}
{{numero_orcamento}}  {{versao_orcamento}}  {{data_orcamento}}
{{data_proposta}} {{validade_proposta}} {{responsavel_tecnico}}
{{crea_cau}}      {{responsavel_comercial}}
{{nome_empresa}}  {{cnpj_empresa}}  {{telefone_empresa}}  {{email_empresa}}
{{valor_total}}   {{valor_total_extenso}}  {{condicao_pagamento}}
{{prazo_execucao}} {{observacoes}}
{{tabela_itens_orcamento}}  {{resumo_itens_orcamento}}
{{escopo_gerado_pelos_itens}}
{{total_servicos}}  {{total_produtos}}  {{total_mao_de_obra}}
{{total_materiais}} {{total_equipamentos}} {{total_terceiros}}
{{bdi_percentual}}  {{valor_bdi}}  {{desconto_percentual}}  {{valor_desconto}}
```

---

## Estruturas Editáveis

Em `Configurações`, o administrador mantém sem engessar o sistema:

- Tipos de obra, Status de obra, Etapas padrão, Marcos padrão, Campos personalizados.
- Modelos de relatório, Tipos de documento, Checklists, Tipos de medição.
- Formas de pagamento, Mensagens padrão (WhatsApp), Regras de visualização.
- Configuração SINAPI (UF padrão, mês/ano, tipo de referência, BDI padrão, exibição na proposta).

Use esses cadastros para adaptar o ObraSync a construção civil, reforma, energia solar, subestação, laudo, consultoria, regularização e outros tipos de obra.

---

## Cronograma Físico-Financeiro

Campos principais da etapa: obra/projeto, nome, descrição, ordem, datas previstas e reais, percentual físico previsto e realizado, valor financeiro previsto e realizado, status, responsável e observações.

O módulo calcula automaticamente percentual e valor financeiro previsto/realizado, diferença entre previsto e realizado, atraso em dias, próximo marco e saldo financeiro da obra.

Cada etapa pode ser marcada como marco importante, com mensagem padrão e opção de liberar para cliente/investidor.

---

## Gantt Simplificado

Visualização tipo Gantt em HTML/CSS/JS puro, sem biblioteca externa. Desktop: barras horizontais de previsto × realizado, linha da data atual, indicação de marcos. Celular: cards responsivos com etapa, status, datas, percentuais e atraso.

---

## Microsoft Project

Integração por arquivo (sem API online):

- `Exportar para MS Project`: gera XML compatível.
- `Importar XML do MS Project`: lê tarefas, mostra prévia e cria etapas após confirmação.
- `Exportar Excel/CSV` e `Exportar PDF/impressão`.

Mapeamento: Nome → `Task Name`, datas previstas → `Start`/`Finish`, percentual físico → `Percent Complete`, responsável → recursos, marco → `Milestone`, dependências → `PredecessorLink`, valor previsto → `Cost`.

Arquivos XML são armazenados em `/var/lib/financeiro/uploads/project`.

---

## WhatsApp Manual

O botão `Enviar atualização por WhatsApp` gera um link `wa.me` com mensagem preenchida automaticamente (nome do cliente, obra, marco concluído, percentuais físico/financeiro, próximo marco, link de acompanhamento e assinatura). Não há integração com a API oficial — o sistema gera o link e registra a notificação como `Preparado` para confirmação posterior.

---

## Notas Fiscais / Documentos Fiscais

Campos: obra/projeto, fornecedor/prestador, número da nota, data de emissão, valor, tipo, status, vínculos financeiros, upload de PDF e XML.

Arquivos salvos em `/var/lib/financeiro/uploads/notas-fiscais`. Downloads via API exigem token de sessão (passado via `?token=` por ser link direto do navegador).

```bash
sudo mkdir -p /var/lib/financeiro/uploads/notas-fiscais
sudo chown -R www-data:www-data /var/lib/financeiro/uploads/notas-fiscais
sudo chmod -R 750 /var/lib/financeiro/uploads/notas-fiscais
```

### Importação de XML NFS-e (padrão ABRASF) — v1.11.0

No módulo Notas Fiscais, o botão **📄 Importar XML NFS-e** abre um assistente em duas etapas.

Fluxo:

1. Selecione o XML exportado da prefeitura (padrão ABRASF; aceita um arquivo com várias NFS-e), a **obra/projeto** (obrigatória) e o vencimento em dias.
2. Clique em **Analisar XML** — a API (`nfse-preview`) faz o parse (`parse_nfse_abrasf`), identifica emitidas × recebidas comparando o CNPJ do prestador com o CNPJ da empresa, casa cada NF com cliente/fornecedor pelos dígitos do documento (`nfse_find_entity`) e marca duplicatas (por `documentNumber`).
3. Na prévia, revise a lista e desmarque o que não quer importar. Se houver partes **não cadastradas**, aparece a opção **"Criar automaticamente N clientes/fornecedores"** (marcada por padrão).
4. Clique em **Importar selecionadas** (`nfse-import`). Para cada NF nova: cria um `fiscal_documents` vinculado à obra e a conta correspondente — **emitida → Contas a Receber**, **recebida → Contas a Pagar** — com referência cruzada. Tudo transacional.

Criação automática de entidade (`nfse_create_entity`): quando a NF não tem vínculo e a opção está marcada, cria o registro em `clients` (emitida → tomador) ou `suppliers` (recebida → prestador) com nome, CNPJ/CPF formatado, endereço (logradouro+número+bairro), CEP, e-mail e telefone extraídos do XML. Reconfere o documento antes de inserir para não duplicar dentro do mesmo lote. Falha ao criar não aborta a importação (a NF entra sem vínculo). A resposta traz `data.criados[]` com os cadastros criados.

> Detalhe de implementação: o frontend (`importarNfsesSelecionadas`) envia, além de `criarEntidades`, os objetos `tomador` e `prestador` de cada NF — o parser extrai endereço/contato das duas partes. Sem esses dados no payload, a criação no servidor não teria como preencher os campos.

---

## Conciliação Bancária OFX — v1.10.0

No módulo Financeiro, a conciliação importa extratos **OFX** de múltiplos bancos.

- Parser de OFX com controle de duplicatas por **FITID** (tabelas `ofx_imports` e `ofx_fitids`) — reimportar o mesmo extrato não duplica lançamentos.
- Saldo por extrato, KPI cards por banco e cadastro simplificado de conta bancária.
- Prévia antes de gravar e histórico de importações.
- **Match automático** por valor + data contra contas a pagar/receber em aberto, com **baixa automática** ao conciliar. Lançamentos sem contraparte podem ser importados avulsos.
- As colunas de conciliação ficam em `accounts_receivable`/`accounts_payable` (migration `2026-06-12-ofx-conciliacao.sql`).

---

## Qualidade — PBQP-H Nível B — v1.9.0

Módulo de Sistema de Gestão da Qualidade alinhado ao PBQP-H/SiAC Nível B, integrado ao cronograma das obras:

- **Política da qualidade** (`qualidade_politica`), **PQO** — Plano da Qualidade da Obra (`qualidade_pqo`), **PES** — Plano de Execução de Serviços (`qualidade_pes`).
- **FVS** — Ficha de Verificação de Serviço (`qualidade_fvs`) e **FVM** — Ficha de Verificação de Material (`qualidade_fvm`), com regras de assinaturas e resultado validadas no servidor.
- **NC** — Não Conformidades (`qualidade_nc`) com numeração sequencial protegida contra corrida.
- **Treinamentos** (`qualidade_treinamentos`), **Auditoria** (`qualidade_auditorias`) e **Dashboard** da qualidade.

---

## Plugins e Estudos Técnicos — v1.9.0

- **Sistema de plugins** (`system_plugins`): habilita/desabilita módulos opcionais por instalação. Os arquivos de cada plugin ficam em `plugins/<nome>/`.
- **Estudo de Seletividade** (`plugins/seletividade/`): plugin de engenharia elétrica para estudo de seletividade/coordenação de proteção, com estudos salvos no banco (salvar, listar, carregar, duplicar, excluir por usuário) e geração de **PDF técnico** em padrão ABNT NBR 14724 (cabeçalho, rodapé da empresa em todas as páginas, assinaturas de Resp. Técnico/Execução/Cliente, coordenogramas).
- **Análises de viabilidade** (`viability_analyses`): parecer de viabilidade com histórico de mudanças de parecer.

---

## Propostas Comerciais

O menu `Comercial` cobre: Orçamentos, Propostas, Modelos de propostas, Áreas/Disciplinas, Tipos de atuação, Subtipos/Serviços, Vendas/Contratos.

Classificação: `Área/Disciplina → Tipo de atuação → Subtipo/Serviço → Modelo de proposta`.

Uma proposta pode ser independente ou vinculada a cliente, obra/projeto, orçamento, serviço ou modelo. Origens aceitas: nova demanda, derivada de laudo, derivada de projeto, derivada de obra existente, adicional/complementar, retrofit, manutenção, regularização.

---

## Máscaras e Formatação

- Telefone: `(67) 99999-9999` ou `(67) 3333-3333`.
- CPF/CNPJ, CEP: validados e formatados.
- Moeda: exibição em `R$ 1.000,00`, banco como decimal `1000.00`.
- Percentuais: exibição em `10,00%`, banco como número.

---

## Responsividade

Celular, tablet, notebook, desktop e telas grandes. Sidebar vira menu ocultável no celular. Filtros recolhíveis. KPIs em grade responsiva. Gantt troca por cards no celular. Botões maiores para toque.

---

## Migração do localStorage para o Banco

```text
Configurações > Migração para banco
```

Lê dados do `localStorage`, envia para `/financeiro/api/migrate`, mostra contagem de registros criados/atualizados e mantém dados antigos até confirmação. Evita duplicidades por documento, código, nome ou usuário.

---

## Backup Manual

Pelo sistema:

```text
Configurações > Backup local/servidor
```

Pelo terminal:

```bash
mysqldump -u financeiro_app -p financeiro > /var/lib/financeiro/backups/financeiro-$(date +%F).sql
tar -czf /var/lib/financeiro/backups/uploads-$(date +%F).tar.gz /var/lib/financeiro/uploads
```

---

## Backup Automático com Cron

```bash
sudo nano /usr/local/bin/backup-financeiro.sh
```

```bash
#!/bin/bash
set -e
BACKUP_DIR="/var/lib/financeiro/backups"
mkdir -p "$BACKUP_DIR"
mysqldump -u financeiro_app -p'SENHA_DO_BANCO' financeiro > "$BACKUP_DIR/financeiro-$(date +%F-%H%M).sql"
tar -czf "$BACKUP_DIR/uploads-$(date +%F-%H%M).tar.gz" /var/lib/financeiro/uploads
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

```bash
sudo chmod 750 /usr/local/bin/backup-financeiro.sh
sudo crontab -e
```

```cron
0 2 * * * /usr/local/bin/backup-financeiro.sh
```

---

## Restauração

Banco:

```bash
mysql -u root -p financeiro < /var/lib/financeiro/backups/financeiro-AAAA-MM-DD.sql
```

Uploads:

```bash
sudo tar -xzf /var/lib/financeiro/backups/uploads-AAAA-MM-DD.tar.gz -C /
sudo chown -R www-data:www-data /var/lib/financeiro
```

---

## Atualização Segura

Substitua apenas os arquivos públicos:

```bash
/var/www/financeiro/index.html
/var/www/financeiro/styles.css
/var/www/financeiro/app.js
/var/www/financeiro/assets/
/var/www/financeiro/api/
/var/www/financeiro/README.md
```

**Não apague:**

```bash
/etc/financeiro/config.php
/var/lib/financeiro
banco MariaDB/MySQL financeiro
```

Após subir os arquivos, execute as migrations novas que ainda não foram rodadas.

---

## Checklist Pós-Deploy (v1.11.0)

- [ ] **Incrementou o `?v=NNNN`** das tags `styles.css`/`app.js` em `index.html` (evita cache velho).
- [ ] Todas as migrations pendentes executadas (ver lista em "Migrações incrementais", até `2026-06-13-nfse-fiscal-documents-permissions.sql`).
- [ ] Importação OFX: prévia, detecção de duplicatas por FITID, match/baixa automática.
- [ ] Importação XML NFS-e: prévia em lote, criação de Contas a Receber/Pagar e criação automática de cliente/fornecedor não cadastrado.
- [ ] Módulo Qualidade (PBQP-H): criar FVS/FVM/NC e validar regras server-side.
- [ ] Importador SINAPI assíncrono: enfileirar e acompanhar progresso (worker ativo).
- [ ] Plugin Seletividade: salvar estudo, gerar PDF, duplicar/excluir.
- [ ] Migrations `2026-06-10-api-auth-sessions.sql` e `2026-06-10-password-strength.sql` executadas.
- [ ] `deploy_secret` configurado em `/etc/financeiro/config.php` e no GitHub Webhook.
- [ ] Seção `mail` configurada em `/etc/financeiro/config.php` (SMTP ou relay Postfix).
- [ ] Login com usuário administrador — sistema exige nova senha (mustChangePassword).
- [ ] Nova senha atende força exigida (8+ chars, maiúscula, caractere especial).
- [ ] Fluxo "Esqueci minha senha": solicitar reset, receber e-mail, redefinir.
- [ ] Cadastro de cliente, fornecedor, obra/projeto.
- [ ] Criação de orçamento de obra e busca SINAPI.
- [ ] Geração de proposta a partir de orçamento.
- [ ] Pré-visualização A4 e impressão/PDF.
- [ ] Cronograma físico-financeiro e Gantt.
- [ ] Upload/download de documento fiscal (verifica token no link).
- [ ] Backup manual e verificação do log.
- [ ] Responsividade em celular e tablet.
- [ ] Permissões por perfil (testar com usuário não-admin).

---

## Backlog Técnico

### P0 — Base de funcionamento ✅ concluído em 2026-06-10

- ~~Autenticação e autorização reais na API~~ — token de sessão (`api_sessions`), autorização por perfil/módulo via `role_permissions` com fallback nos padrões do frontend.
- ~~Tratar respostas não-JSON no frontend~~ — `apiRequest()` e `fetchForm()` com try/catch, tratamento de 401 e mensagens amigáveis.
- ~~Blindar `loadDb()` e `localStorage`~~ — `safeLocalGet`/`safeLocalSet` e fallback para seed.
- ~~Padronizar `AUTH_BYPASS_FOR_TESTS`~~ — derivado de `APP_ENV`, nunca em produção; backend com `auth.dev_bypass` desligado por padrão.
- ~~Revisar boot do app~~ — `APP_ENV` (`file`/`local`/`production`), `loadServerData` distingue API fora do ar de login pendente.
- ~~Validação de força de senha~~ — regra em PHP e JS, diálogo obrigatório no primeiro login, reset por e-mail com token de 2 h.

### P1 — Risco funcional por módulo

- ~~Dashboard: validar filtros e datas~~ — `validDateInput`, guards `NaN` em `daysBetween` e `monthLabel`. ✅
- ~~CRUD genérico: escape HTML em `innerHTML`~~ — `escapeHtml` em `table()`, `fillSelect`, `inputFor` e badge de status. ✅
- Agenda/Kanban: quebrar lógica em helpers menores, corrigir datas inválidas.
- Cronograma/Gantt: revisar cálculos de intervalo, dependências e fallback mobile.
- Propostas: separar geração, preview, persistência e exportação.
- Financeiro: revisar consistência entre contas, caixa, conciliação e vínculos por obra.
- Documentos fiscais: garantir download/upload com permissões reais no backend.
- Relatórios: remover dependência de estado global implícito nas agregações.

### P2 — Manutenção e qualidade

- Quebrar `app.js` em módulos menores; extrair constantes e regras repetidas.
- Camada única de helpers para datas, dinheiro, texto seguro e selects.
- Consolidar breakpoints e padrões repetidos no CSS.
- Acessibilidade: dialogs, foco inicial, navegação por teclado, estados de erro.
- Testes mínimos para login, bootstrap, agenda, propostas e backups.

---

## Auditoria de Código — 2026-06-11 (1ª rodada — CONCLUÍDA)

> ✅ **2026-06-11 — TODOS os itens desta seção foram corrigidos.** A1 (1–5) no
> commit `80ee8a2`; A2 (6–11) e A3 (12–16) no commit `613e4de`. Os textos abaixo
> ficam como registro histórico do que foi encontrado.
> ⚠️ **Continuam MANUAIS (item 2):** trocar a senha real do usuário em produção
> (a antiga permanece no histórico do Git) e avaliar limpeza do histórico se o
> repositório não for privado.

### A1 — Bugs reais e segurança (corrigir primeiro)

1. ~~**Bypass da troca obrigatória de senha ao recarregar a página.**
   `restoreSession()` (app.js, ~linha 6588) restaura a sessão e chama `showApp()`
   sem verificar `mustChangePassword` — nem no `user` do localStorage nem no
   registro vindo de `db.users`. Quem recarregar (F5) durante o modal de troca
   obrigatória entra no sistema sem trocar a senha.~~
   ✅ **Corrigido em 2026-06-11 (commit `80ee8a2`):** `restoreSession()` verifica
   `mustChangePassword` (do `db.users` ou da sessão persistida) e reabre o modal
   forçado sobre a tela de login; `writeAuthSession()` agora persiste a flag.

2. ~~**Senhas reais em texto plano versionadas no repositório.**
   `schema.sql` (usuários iniciais) e
   `migrations/2026-06-10-fix-login-usuarios-iniciais.sql` contêm `admin123` e
   `Schimanski!@#` em texto plano, públicos no histórico do GitHub.~~
   ✅ **Corrigido em 2026-06-11 (commit `80ee8a2`):** seeds substituídos pelo
   placeholder `TROQUE_NO_PRIMEIRO_ACESSO` com `mustChangePassword = 1`.
   ⚠️ **Pendências manuais:** trocar a senha real do usuário em produção (a
   antiga continua no histórico do Git) e avaliar limpeza do histórico se o
   repositório não for privado.

3. ~~**Automations sem try/catch após save (mesma classe do bug da agenda já corrigido).**
   No roteador da API (`api/index.php`, POST genérico ~linhas 139–145):
   `ensure_project_kanban_boards()` (criação de obra) e
   `create_purchase_order_kanban_card()` (pedido de compra) rodam **depois** do
   INSERT sem try/catch — qualquer falha devolve 500 com o registro já gravado,
   confundindo o usuário (registro "fantasma").~~
   ✅ **Corrigido em 2026-06-11 (commit `80ee8a2`):** as duas automations do POST
   ganharam try/catch + `error_log` (padrão da agenda). O caminho PUT de
   marcos/pedidos **não precisou de mudança**: `update_record()` já roda a
   automação dentro de transação com rollback — uma falha desfaz também o UPDATE,
   sem deixar registro fantasma.

4. ~~**`handle_login` cancela silenciosamente a troca obrigatória definida pelo admin.**
   Se `mustChangePassword = 1` mas a senha atual já atende aos requisitos de
   força, o login zera a flag (api/index.php, `handle_login`). Cenário quebrado:
   admin define senha temporária FORTE para um usuário e marca "trocar no primeiro
   acesso" — a flag é cancelada no login e o usuário permanece com a senha
   temporária.~~
   ✅ **Corrigido em 2026-06-11 (commit `80ee8a2`):** auto-clear removido — a
   flag só é zerada pela troca efetiva de senha.

5. ~~**Backup pré-deploy pode nunca executar (sudo × sudoers).**
   `deploy.php` executa `sudo -u alefschimanski bash /var/www/financeiro/backup-pre-deploy.sh`
   (sem caminho completo do bash e sem `-n`), enquanto o sudoers documentado exige
   match exato `/usr/bin/bash /var/www/financeiro/backup-pre-deploy.sh`. Se o
   `bash` resolver para outro caminho ou a regra não casar, o sudo aguarda senha
   sem TTY e o backup falha silenciosamente (só aparece no deploy.log).~~
   ✅ **Corrigido em 2026-06-11 (commit `80ee8a2`):** `deploy.php` usa
   `sudo -n -u alefschimanski /usr/bin/bash ...` e grava `[ALERTA]` no deploy.log
   com o exit code quando o backup falha.
   ⚠️ **Verificação manual após o próximo deploy:** `grep backup /var/lib/financeiro/deploy.log`.

### A2 — Funcionais

6. **Log de Auditoria não é um registro real.** `logAudit()` grava apenas no
   localStorage do navegador (máx. 500 entradas, apagável pelo próprio usuário,
   não compartilhado entre máquinas). Em modo servidor o módulo "Log de Auditoria"
   mostra só o que aconteceu naquele navegador. *Correção sugerida:* criar tabela
   `audit_log` na API e gravar server-side nas mutações autenticadas.

7. **`fetchForm` (uploads) sem as proteções do `apiRequest`.** Não tem o retry de
   401 com token relido nem o fallback `?token=` — uploads de notas fiscais/SINAPI
   /projetos podem falhar nos mesmos cenários de header removido que afetavam o
   DELETE. Replicar o tratamento do `apiRequest`.

8. **Tokens de sessão expostos em URLs.** O fallback `?token=` (DELETE/PUT/PATCH)
   e os links de download PDF/XML (`hasPdf`/`hasXml`) colocam o token de sessão na
   query string — fica registrado nos access logs do Apache e em históricos.
   *Mitigação sugerida:* tokens de download de uso único/curta duração, ou
   suprimir a query de token no log do Apache.

9. **Troca voluntária de senha não invalida as outras sessões** do usuário
   (`handle_change_password` não limpa `api_sessions`); a troca forçada já limpa.
   Decidir e alinhar o comportamento.

10. **Selects da agenda listam registros Inativos.** `agendaOptions()` não filtra
    `status === "Ativo"` para usuários/clientes/obras — compromissos podem ser
    atribuídos a cadastros desativados.

11. **Migração (`/migrate`) pode casar registros errados.** `find_existing_id()`
    testa cada campo `unique` isoladamente (OR) — ex.: cliente é considerado
    "existente" só pelo nome igual, e o registro é ATUALIZADO. Risco de
    sobrescrever cadastro homônimo ao migrar. Considerar matching por combinação
    de campos ou só por `document`.

### A3 — Visuais e menores

12. **Tema escuro:** badges `.audit-action.a-login` e `.a-create` (styles.css
    ~967/969) sem override escuro — ficam com fundo pastel claro no dark.
13. **Plugin Seletividade:** `qs("instIsolacao").selectedOptions[0].textContent`
    (buildPrintReport) sem guarda — exceção teórica se não houver opção
    selecionada. Usar fallback.
14. **HSTS desativado:** header `Strict-Transport-Security` permanece comentado no
    `.htaccess` raiz — ativar após confirmar HTTPS 100% estável.
15. **`verdictHistory` da viabilidade cresce sem limite** (texto concatenado a cada
    mudança de parecer) — truncar para as últimas N entradas.
16. **Tema após logout** mantém a preferência do último usuário no login
    (cosmético; o tema correto é reaplicado ao logar).

## Auditoria de Código — 2026-06-11 (2ª rodada — CONCLUÍDA)

> ✅ **2026-06-11 — TODOS os itens desta seção (17–30) foram corrigidos no
> commit `613e4de`.** Os textos abaixo ficam como registro histórico. Resumo:
> bootstrap SINAPI com recorte (LIMIT 300) + busca paginada no servidor; rate
> limit de login/reset; reset sem enumeração de e-mail; senha plana restrita a
> mustChangePassword; TTL absoluto de sessão (12 h); validação server-side da
> qualidade (assinaturas da FVS, fechamento de NC); retry na numeração da NC;
> importador síncrono limitado a 4 MB; spawn sem sleep(2); uploads sem caminho
> absoluto; tokens fora das URLs (headers + download via blob); audit_log
> server-side; CSP + HSTS ativos (tema extraído para theme-init.js);
> list_records com ?limit/?offset; operador não fecha NC.

### B1 — Alta prioridade

17. **Bootstrap sem paginação × base SINAPI completa (bomba-relógio).**
    `bootstrap_data()` devolve TODAS as linhas de TODOS os recursos visíveis —
    incluindo `sinapi_insumos`, `sinapi_composicoes` e `sinapi_composicao_itens`.
    Com o importador assíncrono agora é fácil carregar a base oficial inteira
    (Analítico tem dezenas/centenas de milhares de linhas): o JSON do bootstrap
    pode passar de dezenas de MB e o login/refresh ficará inutilizável.
    *Correção sugerida:* excluir as tabelas SINAPI grandes do bootstrap e criar
    busca paginada na API (`?search=&limit=`), carregando-as sob demanda no
    módulo Base SINAPI.

18. **Login sem proteção contra força bruta.** `handle_login` aceita tentativas
    ilimitadas (sem rate limit por IP/usuário, sem atraso progressivo, sem
    bloqueio temporário). O mesmo vale para `request-password-reset` (permite
    disparar e-mails sem limite). *Correção:* tabela `login_attempts` com
    janela deslizante + atraso/bloqueio temporário.

19. **Enumeração de e-mails no reset de senha.** `handle_request_password_reset`
    responde 404 "E-mail não cadastrado" — confirma quais e-mails existem no
    sistema. *Correção:* responder sempre 200 com mensagem genérica.

20. **Fallback de senha em texto plano no login.** `handle_login` aceita
    `hash_equals($stored, $password)` — qualquer valor não-hash na coluna
    `password` é tratado como senha válida (necessário hoje para o seed
    `TROQUE_NO_PRIMEIRO_ACESSO`). *Correção:* restringir o fallback a
    `mustChangePassword = 1` ou removê-lo após migrar os usuários legados.

### B2 — Médios

21. **Sessões sem expiração absoluta.** Só há timeout de inatividade (30 min);
    um token usado continuamente (ou roubado e mantido vivo) nunca expira.
    Adicionar TTL absoluto (ex.: 12 h desde `createdAt`).

22. **Regras de qualidade sem validação server-side.** A API aceita FVS com
    `status = 'Aprovada'` sem assinaturas/resultado e NC fechada sem
    verificação — as regras (assinaturas obrigatórias, resultado × status)
    existem só no frontend. Validar em `qualidade_pos_gravacao`/gancho de PUT,
    inclusive por exigência de registros controlados do próprio SiAC (7.5).

23. **Corrida na numeração de NC.** `qualidade_proximo_numero_nc` usa MAX+1 sem
    lock — duas NCs simultâneas podem colidir no UNIQUE `numero` e devolver 500.
    Retry no insert ou sequência dedicada.

24. **Importador SINAPI síncrono antigo continua carregando o XLSX inteiro no
    PHP-CGI** (memória/timeout com o arquivo de 13 MB). Com o assíncrono no ar,
    limitar tamanho do arquivo no caminho síncrono ou aposentá-lo.

25. **`sleep(2)` no disparo do worker SINAPI** segura a requisição (e um worker
    FPM/CGI) por 2 s só para conferir se o job saiu de `queued`. Mover a
    detecção para o primeiro poll de `sinapi-import-status`.

26. **`generatedLink` vira `<a href>` sem validação de esquema** — um valor
    `javascript:...` passa pelo `escapeHtml` (que não cobre URI scheme).
    Validar `^https?://` antes de renderizar como link.

### B3 — Hardening / menores

27. **Sem Content-Security-Policy.** Com o token de sessão no `localStorage`,
    XSS = roubo de sessão; CSP é a defesa em profundidade que falta. O
    `index.html` tem script inline (tema) — exigirá nonce ou mover para arquivo.

28. **`list_records` sem LIMIT/paginação** — todo GET devolve a tabela inteira
    (mesma classe do item 17, em menor escala).

29. **Caminho absoluto do servidor exposto nas respostas de upload**
    (`respond(['file' => $path])`) — divulgação menor de estrutura interna.

30. **Operador pode fechar NC** (edição em `qualidadeNc`) — avaliar se o
    fechamento deve exigir gestor/engenharia (decisão de negócio do SGQ).

---

## Auditoria de Código — 2026-06-27 (3ª rodada — varredura completa)

> Varredura de segurança, bugs, performance, qualidade e UX sobre `app.js`,
> `api/index.php`, `deploy.php`, `.htaccess`, `migrations/`. Os itens
> **CRÍTICO/ALTO de segurança** e os **bugs que quebram o sistema** foram
> corrigidos nesta versão (v1.12.0). O relatório completo e as pendências
> MÉDIO/BAIXO estão em **`STATUS.md`** (raiz do projeto).

### Corrigidos nesta rodada (v1.12.0)

1. ~~**XSS armazenado** em vários pontos que injetavam dados do banco em
   `innerHTML` sem escape: helpers `bars()`/`kpi()` (DRE/Relatórios), `<option>`
   e cabeçalhos do Dashboard/Kanban, e nomes via `nameOf()` em cards de
   Agenda/Kanban/Dashboard.~~ ✅ Envolvidos com `svgText()`.
2. ~~**Bug crítico:** `importSinapiCsvLocal` chamava `uid()` (função
   inexistente) → `ReferenceError` abortava a importação local de CSV
   SINAPI.~~ ✅ Trocado por `crypto.randomUUID()`.
3. ~~**Erro 500 na aprovação de marcos:** `automate_approved_milestone` exige
   colunas de referência em `accounts_receivable`, que nenhuma migração criava
   (só caixa/contas a pagar). Lançava 500 e desfazia a mudança de status.~~
   ✅ `ensure_referencia_columns` agora cobre `accounts_receivable` + guarda no
   bootstrap.
4. ~~**Oráculo de força bruta/enumeração** na rota pública
   `forced-change-password`: identificava o usuário pelo `username` do corpo e
   conferia a senha sem rate limit nem log, contornando o throttle do login.~~
   ✅ Rate limit na mesma janela/contexto do login + registro de tentativas e
   auditoria de falhas.
5. ~~**Diretório `.git` exposto** via HTTP (o docroot é uma working tree).~~
   ✅ `RedirectMatch 404 /\.git` no `.htaccess`.

### Rodada 3b — v1.12.1 (todas as pendências MÉDIO/BAIXO fechadas)

- ~~**MÉDIO:** tabelas sem `ensure_*` (`fiscal_documents`, `agenda_eventos`/Kanban)
  e colunas `email`/`blocked`/`mustChangePassword` de `system_users`; filtro
  `applyFilters` deixando passar registros com campo vazio.~~
  ✅ `ensure_fiscal_documents_table()`, `ensure_agenda_tables()`,
  `ensure_kanban_tables()`, extensão de `ensure_users_extra_columns()` (+ guardas
  no bootstrap e nos handlers) e comparação estrita em `applyFilters`.
- ~~**BAIXO:** SVG de logo sem sanitização; `db()` fora do try/catch; XXE no parse
  de XML; `proposalBody` reinjetado como HTML; `bootstrapApp()` sem `.catch`.~~
  ✅ Sanitização do SVG no upload + CSP `sandbox` ao servir; `display_errors=0`
  no topo; `safe_xml_load()` (rejeita DOCTYPE + `LIBXML_NONET`) em todos os
  parses; `sanitizeStoredHtml()` no `proposalBody`; `bootstrapApp().catch(...)`.

> **Mantidos por design:** a senha legada em texto puro durante a transição
> `mustChangePassword` (fluxo documentado de primeiro login); `generatedLink` já
> validava o esquema `^https?://`.
