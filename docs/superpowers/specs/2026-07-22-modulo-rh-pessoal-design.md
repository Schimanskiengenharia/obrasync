# Design — Módulo RH/Pessoal (contratados + empreiteiros, foco em vencimento de documentos)

**Data:** 2026-07-22 · **Status:** APROVADO em 2026-07-22 com 3 ajustes (soft-delete de colaborador; exclusão de documento apaga o arquivo; permissões iniciais restritas — LGPD). F1 autorizada; F2/F3 aguardam o teste da F1.
**Escopo:** especificação do módulo COMPLETO; implementação em 3 fases (F1 → F2 → F3), cada uma testável sozinha.
**Plano:** `docs/superpowers/plans/2026-07-22-modulo-rh-pessoal.md`

## Problema

O ObraSync não tem gestão de pessoas de canteiro. Contratados (próprios, diaristas,
autônomos) e funcionários de empreiteiras trabalham nas obras sem controle de
documentos obrigatórios — ASO, treinamentos NR-10/NR-18/NR-35, contratos — e o
vencimento desses documentos é risco direto de compliance (fiscalização,
embargos, responsabilidade solidária). O objetivo nº 1 do módulo é: **nenhum
documento vence sem aviso**.

## O que já existe e será reusado (conferido no código em 2026-07-22)

| Necessidade | O que existe | Onde |
|---|---|---|
| Empresa empreiteira | `suppliers` (com endereço, PBQP-H etc.) | `schema.sql:53-83` |
| Padrão visual de vencimento | PBQP-H: `qFvmValidadeAlerta` — vencido = vermelho (`q-badge q-ruim`), vence em ≤30 dias = âmbar (`q-badge q-atencao`) | `app.js:12646`, `styles.css:4019` |
| Severidade de alerta no dashboard | `dashboardAlerts`: perda direta = `alert-danger`, atenção = `alert-warning` (padrão da Frente 1 do estudo) | `app.js:4791` |
| Cron diário | `api/cron/jobs.php` — cadeia de jobs isolados em try/catch; `create_due_alerts` (D-3 de contas) grava em `obra_notificacoes` com dedupe diário por `generatedLink` | `jobs.php:79-114` |
| Upload seguro | `store_upload()` (whitelist ext+mime, nome aleatório, fora do docroot em `/var/lib/financeiro/uploads/<sub>`) + download autenticado por id | `api/index.php:9762` |
| CRUD + bootstrap grátis | `resource_map()` — REST completo, auditoria, autorização e `db.<key>` no front sem código extra | `api/index.php:1800` |
| Permissões por papel | `default_role_view/edit_modules` (back) espelhando `roleModules`/`EDITABLE_BY_ROLE` (front), overrides em `user_permissions` | `api/index.php:9285/9302`, `app.js:328/352` |
| Padrão de cadastro de tipos | `tipos_documento` (geral) e `cotacao_categorias` (por módulo) | `schema.sql:1465`, migration 2026-07-08 |
| Datas de negócio | `hojeLocal()`/`localDateString`/`parseLocalDate` (regra M10 — nunca UTC); no PHP, data local do PHP, nunca `CURDATE()` | `app.js:3975/9883/9859` |
| Conta a pagar gerada de outro módulo | Cotações P2: `materialGerarConta` — 1 conta por grupo, `referencia_tipo`/`referencia_id`, guarda anti-corrida `WHERE conta_pagar_id IS NULL`, heal se a conta for excluída | CLAUDE.md v1.34.0 |
| Efetivo diário em obra | RDO: `obra_rdo.efetivo` JSON `[{funcao, quantidade}]` | `schema.sql:2186`, `app.js:3033` |

**Correções de premissa descobertas na exploração** (importam para o design):

1. **"F1" no estudo benchmark = Frente 1 (padrão de erros)**, não vencimento de
   documentos. O padrão de cores desejado (vencido=vermelho / ≤30 dias=âmbar) já
   existe implementado, mas no módulo PBQP-H. É ele que será reusado.
2. **`obra_notificacoes` exige obra** (`projectId` NOT NULL) e não existe sino
   global — os alertas do dashboard são calculados no cliente a partir de `db`.
   Consequência: o alerta de cron só tem "endereço" quando a pessoa está
   **alocada numa obra**, o que nasce na F2 (decisão abaixo).
3. Não há nenhum item de RH no backlog do estudo benchmark — módulo 100% novo,
   sem colisão com as Ondas A→E.

## Decisões de design

### D1. Uma tabela de pessoas: `rh_colaboradores`

Uma única tabela para todos os vínculos, com ENUM
`tipo_vinculo('proprio','diarista','autonomo','empreiteira')`. Quando
`tipo_vinculo='empreiteira'`, `fornecedor_id` (FK → `suppliers.id`) é
**obrigatório** (validação de aplicação): a EMPRESA empreiteira é o fornecedor
que já existe — não se duplica cadastro de empresa. `funcao` é texto livre
(mesmo modelo do efetivo do RDO: "Pedreiro", "Eletricista"), o que permite o
agrupamento da F2 sem tabela de cargos (YAGNI).

**Ciclo de vida (ajuste da aprovação):** colaborador com histórico **não se
exclui — se INATIVA** (`status='Inativo'`), no mesmo espírito do soft-delete de
obras (G3): documentos de RH são histórico de compliance (fiscalização pode
exigir ASO de ex-funcionário anos depois). Exclusão física só é permitida
quando a pessoa não tem NENHUM documento/alocação/diária — o front esconde
"Excluir" quando há vínculos (oferece Inativar/Reativar) e as FKs
`ON DELETE RESTRICT` (`rh_documentos`, `rh_alocacoes`, `rh_diarias`) são o
guarda-costas no banco.

### D2. Tipos de documento: cadastro PRÓPRIO (`rh_tipos_documento`)

Alternativas consideradas:
- **(a) Reusar `tipos_documento`** (cadastro geral): descartada — a semântica lá
  é de arquivamento (subpasta sugerida, visibilidade para cliente no portal) e
  o RH precisa de campos que não cabem no cadastro geral sem poluí-lo.
- **(b) Cadastro próprio `rh_tipos_documento`** ✅ — segue o padrão já usado por
  Cotações (`cotacao_categorias`): tabela pequena, seed inicial, CRUD simples.
  Campos específicos de RH: `exige_validade` (ASO/NRs sim; contrato por prazo
  indeterminado não) e `dias_alerta` (antecedência do aviso âmbar,
  **configurável por tipo**, default 30).

Seed (só quando a tabela está vazia): ASO, Treinamento NR-10, Treinamento
NR-18, Treinamento NR-35 (todos `exige_validade='Sim'`, `dias_alerta=30`) e
Contrato (`exige_validade='Não'`). O usuário cadastra os demais.

### D3. Documentos: `rh_documentos` com status CALCULADO

Uma linha por documento da pessoa: tipo, número, `data_emissao`,
`data_validade`, arquivo anexo. O status **não é coluna** — é função da data,
calculada onde for exibida:

- `vencido` — `data_validade < hoje` → vermelho (`q-ruim`);
- `atencao` — vence em ≤ `dias_alerta` do tipo → âmbar (`q-atencao`), texto
  "vence em N dia(s)";
- `ok` — válido → verde (`q-ok`);
- `sem_validade` — tipo não exige validade → neutro.

Racional: diferente de `accounts_payable` (onde "Vencido" persiste porque a
conta pode ser baixada/cancelada), aqui o status é 100% derivável da data — 
persistir criaria a necessidade de um job para manter a coluna coerente, sem
ganho. Helper único no front (`rhDocSituacao`) usado em todas as telas, com
datas pela regra M10 (`hojeLocal()`/`parseLocalDate`, nunca `toISOString`).
Renovação de documento = **novo registro** (o anterior fica como histórico);
a tela destaca, por pessoa+tipo, apenas o documento com a maior validade.

### D4. Alertas de vencimento — dashboard na F1, cron na F2

**Dashboard (F1):** bloco novo em `dashboardAlerts` computado no cliente a
partir de `db.rhDocumentos`/`db.rhColaboradores`/`db.rhTiposDocumento` (todos
chegam de graça pelo bootstrap via `resource_map`):
- `alert-danger`: "X documento(s) de colaborador VENCIDO(s)";
- `alert-warning`: "Y documento(s) de colaborador vencem nos próximos dias".
Considera só colaboradores `Ativo` e, por pessoa+tipo, só o documento mais
recente (renovado não alarma). Além do dashboard, o módulo tem o painel
**Vencimentos** (lista completa ordenada por validade, com filtros).

**Cron (F2, decisão justificada):** o pedido era avaliar reusar/estender
`create_due_alerts`. Avaliado: o padrão será reusado (job novo na mesma cadeia
do `jobs.php`, mesmo dedupe `notification_exists_today`, mesmo
`type='ALERTA_VENCIMENTO'` — sem mexer no ENUM), mas a tabela de destino
`obra_notificacoes` exige `projectId`, e pessoa só ganha obra com a
**alocação da F2**. Portanto o job `create_rh_doc_alerts` entra na F2:
janelas pontuais **D-`dias_alerta`** ("vence em N dias") e **D-0** ("vence
HOJE"), gravando na obra da alocação aberta mais recente do colaborador
(1 notificação por documento por janela; sem alocação aberta → pulado, igual
a conta sem obra hoje). Na F1 o alerta diário é coberto pelo dashboard, que
qualquer usuário do módulo vê ao abrir o sistema.

### D5. Uploads e permissões

- **Anexos:** subpasta nova `<upload_dir>/rh`; extensões `pdf,jpg,jpeg,png,webp`
  (mimes correspondentes); endpoints dedicados `rh-doc-upload` (POST, edit) e
  `rh-doc-arquivo` (GET, view) no molde exato de `rdo-foto-upload`/`rdo-foto`
  (via `store_upload` + download por id com `readfile`). Substituir anexo apaga
  o arquivo anterior do disco com guarda de path-traversal (`realpath` contra a
  raiz de uploads, como na exclusão da Viabilidade). **Excluir documento usa
  rota dedicada `rh-doc-delete`** (não o DELETE genérico): apaga a linha E o
  arquivo do disco, com a mesma guarda de path-traversal (ajuste da aprovação).
- **Permissões:** duas chaves novas, `rhColaboradores` (pessoas + documentos +
  painel de vencimentos; sub-recurso `rhDocumentos` herda via
  `permission_module_key`) e `rhTiposDocumento` (configuração de tipos).
  Defaults **RESTRITOS** (ajuste da aprovação — LGPD: CPF é dado pessoal):
  - view e edit: só `admin`, `gerente` (automáticos) e `gestor_obra`;
  - tipos de documento: edit só `admin`/`gerente`;
  - ressalva: `visualizador` tem view `'*'` por design do sistema — para
    ocultar RH dele, ajustar na tela de permissões (`role_permissions`);
  - abrir para outros papéis depois é configuração em runtime na tela de
    permissões existente, sem mudança de código.
  Espelhado nos DOIS lados (front `roleModules`/`EDITABLE_BY_ROLE`; back
  `default_role_view/edit_modules`). Consequência coerente: quem não vê o
  módulo não recebe `db.rhDocumentos` no bootstrap e portanto não vê o bloco
  de RH no dashboard.

### D6. CRUD pelo caminho padrão da casa

`rh_colaboradores`, `rh_tipos_documento` e `rh_documentos` entram no
`resource_map()` (REST completo + auditoria + bootstrap). Validações de
formulário (CPF só dígitos, fornecedor obrigatório para empreiteira, validade
obrigatória quando o tipo exige) ficam no front, como em clientes/fornecedores.
Endpoints custom só onde o genérico não cobre: upload/download de anexo (F1),
job de cron (F2) e geração de contas (F3).

## Estrutura de dados (todas as migrations aditivas + `ensure_rh_tables`)

### F1 — migration `2026-07-22-rh-pessoal-f1.sql` (data ajustada ao dia da implementação)

```sql
rh_colaboradores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  cpf VARCHAR(14) NULL,                -- só dígitos (padrão system_users.cpf)
  tipo_vinculo ENUM('proprio','diarista','autonomo','empreiteira') NOT NULL DEFAULT 'proprio',
  fornecedor_id BIGINT UNSIGNED NULL,  -- FK suppliers ON DELETE SET NULL; obrigatório (app) se empreiteira
  funcao VARCHAR(120) NULL,
  telefone VARCHAR(40) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  observacoes TEXT NULL,
  createdAt/updatedAt TIMESTAMP,
  UNIQUE KEY uk_rh_colab_cpf (cpf)     -- NULL múltiplos permitidos
)

rh_tipos_documento (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(140) NOT NULL UNIQUE,
  exige_validade ENUM('Não','Sim') NOT NULL DEFAULT 'Sim',
  dias_alerta INT NOT NULL DEFAULT 30,
  descricao VARCHAR(255) NULL,
  ordem INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt/updatedAt TIMESTAMP
)  -- + seed condicional (ASO, NR-10, NR-18, NR-35, Contrato)

rh_documentos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  colaborador_id BIGINT UNSIGNED NOT NULL,   -- FK rh_colaboradores ON DELETE RESTRICT (histórico de compliance)
  tipo_documento_id BIGINT UNSIGNED NOT NULL,-- FK rh_tipos_documento ON DELETE RESTRICT
  numero VARCHAR(80) NULL,
  data_emissao DATE NULL,
  data_validade DATE NULL,                   -- obrigatória (app) se o tipo exige
  arquivo_path VARCHAR(500) NULL,            -- caminho absoluto do store_upload
  arquivo_nome VARCHAR(255) NULL,            -- nome original, para exibição
  observacoes TEXT NULL,
  createdAt/updatedAt TIMESTAMP,
  KEY idx_rh_doc_colab (colaborador_id),
  KEY idx_rh_doc_validade (data_validade)
)
```

### F2 — migration `<data>-rh-pessoal-f2-alocacao.sql`

```sql
rh_alocacoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  colaborador_id BIGINT UNSIGNED NOT NULL,  -- FK rh_colaboradores ON DELETE RESTRICT
  projectId BIGINT UNSIGNED NOT NULL,       -- FK projects ON DELETE RESTRICT (padrão G3)
  data_inicio DATE NOT NULL,
  data_fim DATE NULL,                       -- NULL = alocação aberta
  funcao_na_obra VARCHAR(120) NULL,         -- default: funcao do colaborador
  observacoes TEXT NULL,
  createdAt/updatedAt TIMESTAMP,
  KEY idx_rh_aloc_obra (projectId),
  KEY idx_rh_aloc_colab (colaborador_id)
)
```
Regra de aplicação: no máximo 1 alocação **aberta** por colaborador+obra.

### F3 — migration `<data>-rh-pessoal-f3-pagamentos.sql`

```sql
rh_diarias (        -- para tipo_vinculo diarista/autonomo
  id, colaborador_id FK ON DELETE RESTRICT, projectId FK NULL,
  data DATE NOT NULL, valor DECIMAL(15,2) NOT NULL, observacoes,
  status VARCHAR(30) DEFAULT 'Aberta',       -- Aberta | Faturada | Cancelada
  conta_pagar_id BIGINT UNSIGNED NULL,       -- FK accounts_payable ON DELETE SET NULL
  createdAt/updatedAt
)

rh_medicoes (       -- para empreiteiras (empresa = suppliers)
  id, fornecedor_id BIGINT UNSIGNED NOT NULL FK suppliers, projectId FK NULL,
  descricao VARCHAR(255), periodo_inicio DATE, periodo_fim DATE,
  valor DECIMAL(15,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'Aberta',       -- Aberta | Aprovada | Faturada | Cancelada
  conta_pagar_id BIGINT UNSIGNED NULL,
  createdAt/updatedAt
)
```

## Backend

- **F1:** 3 entradas novas no `resource_map()` (`rhColaboradores` →
  `rh_colaboradores` alias `rh-colaboradores`; `rhTiposDocumento`;
  `rhDocumentos`) + `ensure_rh_tables()` (chamada no bootstrap com guarda
  `resolve_existing_table`, padrão da Viabilidade) + rotas `rh-doc-upload` /
  `rh-doc-arquivo` / `rh-doc-delete` + chaves de permissão nos defaults +
  `permission_module_key` (`rhDocumentos` → `rhColaboradores`).
- **F2:** resource `rhAlocacoes` (permissão herdada de `rhColaboradores`) + job
  `create_rh_doc_alerts` na cadeia do `jobs.php`, com a lógica de janela numa
  **função pura** (`rh_docs_em_janela(array $docs, string $hoje): array`)
  testável pela suíte NOVO-3 (harness sem banco).
- **F3:** actions `?module=rh` — `diariaGerarConta` e
  `medicaoAprovar`/`medicaoGerarConta`, copiando o contrato do
  `materialGerarConta` das Cotações P2: transação, `document` prefixado
  (`RH-DIA-…` / `RH-MED-…`), `referencia_tipo='RH_DIARIA'|'RH_MEDICAO'`,
  `referencia_id`, amount = Σ dos pendentes, categoria/vencimento escolhidos em
  modal, guarda anti-corrida `UPDATE … WHERE conta_pagar_id IS NULL` com
  rollback, 409 se tudo já vinculado, e heal (`rh_heal_contas`) que limpa o
  vínculo se a conta foi excluída no financeiro. Medição gera conta com
  `supplierId = fornecedor_id`; diárias agrupadas por colaborador+obra geram
  conta sem fornecedor (nome do colaborador no `document`).

## Frontend

- **Registro:** seção nova na sidebar `{ id:"rh", label:"RH / Pessoal" }` com os
  módulos `rhColaboradores` (Colaboradores), `rhVencimentos` (Vencimentos) e
  `rhTiposDocumento` (Tipos de documento RH — CRUD genérico via `configs`).
  Ícones Tabler conferidos no CSS local antes do uso (nem todo nome existe na
  v2.47 — checagem faz parte do plano).
- **Colaboradores (`renderRhColaboradores`)**: lista com busca e filtros (tipo
  de vínculo, status), coluna "Documentos" com o badge do PIOR status entre os
  documentos da pessoa, e coluna empresa (nome do fornecedor quando
  empreiteira). Form em dialog (`viabilidadeDialog`): campo fornecedor aparece
  e vira obrigatório só quando tipo = empreiteira.
- **Ficha da pessoa:** view interna (padrão `cotacaoView`) com os dados + tabela
  de documentos (tipo, número, emissão, validade, badge de situação, anexo).
  Documento: criar/editar em dialog; upload via `fetchForm("rh-doc-upload")`;
  download autenticado via `fetch + authHeaders + blob`; excluir com
  confirmação.
- **Vencimentos (`renderRhVencimentos`)**: tabela de todos os documentos (de
  colaboradores ativos, mais recente por pessoa+tipo) ordenada por validade
  crescente, filtros "só vencidos / vencendo / todos" + por tipo + por vínculo.
  É a tela de trabalho diário do compliance.
- **Helper central `rhDocSituacao(doc)`** → `{key, dias}` (+ `rhDocBadge(sit)`)
  reusando as classes `q-badge q-ruim/q-atencao/q-ok` existentes; datas pela
  regra M10.
- **Dashboard:** bloco em `dashboardAlerts` (D4). Na visão POR OBRA, a partir da
  F2, os alertas consideram só colaboradores alocados na obra.
- **F2:** na ficha e na lista, coluna/aba "Obra atual" + ações
  Alocar/Encerrar; no RDO, botão "Preencher com efetivo alocado" que agrupa as
  alocações abertas da obra por `funcao_na_obra` e preenche as linhas
  `{funcao, quantidade}` do JSON `efetivo` (schema do RDO intocado — só
  conveniência de preenchimento).
- **F3:** telas de lançamento de diárias (grade por período) e de medições de
  empreiteira (com fluxo Aberta → Aprovada → gerar conta), sempre mostrando o
  vínculo com a conta gerada (padrão visual das Cotações P2).

## Fases (cada uma testável sozinha)

| Fase | Entrega | Testável por |
|---|---|---|
| **F1 — Cadastro + documentos + alertas** | Tabelas F1, CRUD de pessoas/tipos/documentos, anexos, badges de situação, painel Vencimentos, bloco no dashboard, permissões | Roteiro manual no servidor: criar pessoa de cada vínculo (empreiteira exige fornecedor), documentos com validade passada/≤30d/futura, conferir badges + dashboard + upload/download + papel restrito |
| **F2 — Alocação em obras** | `rh_alocacoes`, telas de alocação, dashboard por obra, botão de efetivo no RDO, job `create_rh_doc_alerts` no cron | Alocar/encerrar, conferir efetivo no RDO, rodar `php api/cron/jobs.php` e ver as linhas em Notificações da obra (D-N e D-0, sem duplicar no mesmo dia); teste da função pura na suíte |
| **F3 — Pagamentos** | `rh_diarias`/`rh_medicoes`, geração de contas em `accounts_payable`, heal | Lançar diárias/medição, gerar conta, conferir em Contas a Pagar, excluir a conta e ver o heal liberar o vínculo; corrida dupla → 409 |

## Conformidade com as regras permanentes

- **Migrations só aditivas:** só `CREATE TABLE IF NOT EXISTS` + seed condicional;
  nenhum ALTER em tabela existente em NENHUMA fase (o cron F2 reusa o valor de
  ENUM `ALERTA_VENCIMENTO` que já existe em `obra_notificacoes`).
- **Dados do servidor intocáveis:** nada destrutivo; uploads em subpasta nova.
- **Fluxo manual:** sem IA no caminho; alertas são informativos — nenhum
  bloqueio automático de RDO/pagamento por documento vencido.
- **Reuso:** suppliers, padrão de badges do PBQP-H, severidade danger/warning
  do dashboard, cadeia do cron + dedupe, `store_upload`, `resource_map`,
  permissões por papel, contrato de geração de conta das Cotações P2, regra M10.

## Fora de escopo (explícito)

Ponto/frequência e espelho de horas; folha de pagamento, encargos e eSocial;
bloqueio automático de RDO/acesso por documento vencido (só alerta); envio de
notificação externa (WhatsApp/e-mail — Onda D do estudo terá a plataforma única
de notificações); portal do colaborador; gestão de estoque de EPI (entrega de
EPI pode ser cadastrada como tipo de documento, sem validade); qualquer coisa
com IA.
