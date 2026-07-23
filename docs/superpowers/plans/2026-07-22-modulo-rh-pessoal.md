# Módulo RH/Pessoal — Implementation Plan (3 fases)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo de RH/Pessoal (contratados + empreiteiros) com foco em vencimento de documentos (ASO, NR-10/18/35, contratos): F1 cadastro+documentos+alertas, F2 alocação em obras+cron, F3 pagamentos.

**Architecture:** F1 (Tasks 1-5) é autossuficiente e vai para produção sozinha; F2 (Tasks 6-8) e F3 (Tasks 9-10) têm contratos fixados aqui, mas o detalhamento passo a passo de cada uma é feito num ciclo curto próprio DEPOIS da validação da fase anterior no servidor (padrão do estudo benchmark: um ciclo por item). Tudo pelo caminho padrão da casa: `resource_map` para CRUD, `ensure_*` + migration aditiva, telas custom no molde da Viabilidade/Cotações.

**Tech Stack:** PHP monolítico (`api/index.php`), SPA sem build (`app.js`), MariaDB, suíte NOVO-3 (`scripts/tests/`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-22-modulo-rh-pessoal-design.md`.
- **REGRA de dados:** produção intocável; migrations SÓ aditivas (`CREATE TABLE IF NOT EXISTS` + seed idempotente); nenhum ALTER em tabela existente em nenhuma fase; nunca tocar `/etc/financeiro/config.php`, uploads, backups ou banco direto.
- Validações por task: `php -l api/index.php` · `node --check app.js` · `bash scripts/tests/run-all.sh` · `git ls-files --eol` → `i/lf w/lf` em todo arquivo tocado.
- **Datas de negócio:** front `hojeLocal()`/`localDateString`/`parseLocalDate` (nunca `toISOString`/`new Date(iso)`); PHP `date('Y-m-d')` local (nunca `CURDATE()`).
- **XSS:** todo dado do banco em `innerHTML` passa por `escapeHtml()`/`svgText()`.
- Toda tabela nova tem migration **e** cobertura em `ensure_rh_tables` (auto-cura).
- Commits com as mensagens indicadas, **sem `git push`** (push é manual, quando o usuário pedir). Não commitar `.claude/settings.local.json`.
- Cache busting só na última task da fase: `APP_VERSION` em `app.js` + `?v=` em `index.html` (F1 = próxima minor livre; hoje seria v1.35.0).
- Nomes de ícone Tabler: conferir existência em `assets/fonts/tabler-icons.min.css` ANTES de usar (v2.47 não tem todos os nomes).

---

# FASE 1 — Cadastro + documentos + alertas (implementar primeiro)

### Task 1: Banco + REST + permissões (backend de dados completo)

**Files:**
- Create: `migrations/2026-07-22-rh-pessoal-f1.sql` (ajustar a data do nome para o dia da implementação)
- Modify: `api/index.php` — `ensure_rh_tables` nova (perto de `ensure_rdo_tables`, ~8016), `resource_map()` (~1800), guarda no bootstrap (~2539), `permission_module_key()` (~9057), `default_role_view_modules()` (~9285), `default_role_edit_modules()` (~9302)

**Interfaces:**
- Produces: tabelas `rh_colaboradores`/`rh_tipos_documento`/`rh_documentos`; resources REST `rh-colaboradores`/`rh-tipos-documento`/`rh-documentos` (keys `rhColaboradores`/`rhTiposDocumento`/`rhDocumentos`, com `db.*` no bootstrap); chaves de permissão `rhColaboradores` e `rhTiposDocumento`; função `ensure_rh_tables(PDO $pdo): void`.

- [ ] **Step 1: Migration `migrations/2026-07-22-rh-pessoal-f1.sql`**

```sql
-- Módulo RH/Pessoal — Fase 1 (cadastro + documentos). Aditiva e idempotente.
CREATE TABLE IF NOT EXISTS rh_colaboradores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  cpf VARCHAR(14) NULL,
  tipo_vinculo ENUM('proprio','diarista','autonomo','empreiteira') NOT NULL DEFAULT 'proprio',
  fornecedor_id BIGINT UNSIGNED NULL,
  funcao VARCHAR(120) NULL,
  telefone VARCHAR(40) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  observacoes TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rh_colab_cpf (cpf),
  KEY idx_rh_colab_fornecedor (fornecedor_id),
  CONSTRAINT fk_rh_colab_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_tipos_documento (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(140) NOT NULL,
  exige_validade ENUM('Não','Sim') NOT NULL DEFAULT 'Sim',
  dias_alerta INT NOT NULL DEFAULT 30,
  descricao VARCHAR(255) NULL,
  ordem INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rh_tipo_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_documentos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  colaborador_id BIGINT UNSIGNED NOT NULL,
  tipo_documento_id BIGINT UNSIGNED NOT NULL,
  numero VARCHAR(80) NULL,
  data_emissao DATE NULL,
  data_validade DATE NULL,
  arquivo_path VARCHAR(500) NULL,
  arquivo_nome VARCHAR(255) NULL,
  observacoes TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_rh_doc_colab (colaborador_id),
  KEY idx_rh_doc_validade (data_validade),
  CONSTRAINT fk_rh_doc_colab FOREIGN KEY (colaborador_id) REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
  CONSTRAINT fk_rh_doc_tipo FOREIGN KEY (tipo_documento_id) REFERENCES rh_tipos_documento(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed idempotente (linha a linha, por nome)
INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem)
SELECT 'ASO', 'Sim', 30, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_documento WHERE nome = 'ASO');
INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem)
SELECT 'Treinamento NR-10', 'Sim', 30, 2 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_documento WHERE nome = 'Treinamento NR-10');
INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem)
SELECT 'Treinamento NR-18', 'Sim', 30, 3 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_documento WHERE nome = 'Treinamento NR-18');
INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem)
SELECT 'Treinamento NR-35', 'Sim', 30, 4 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_documento WHERE nome = 'Treinamento NR-35');
INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem)
SELECT 'Contrato', 'Não', 30, 5 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_documento WHERE nome = 'Contrato');
```

- [ ] **Step 2: `ensure_rh_tables` em `api/index.php`**

Colocar perto das outras `ensure_*` de módulo (modelo: `ensure_rdo_tables`, ~8016). Mesmo DDL da migration (os 3 `CREATE TABLE IF NOT EXISTS` idênticos), com `static $done` e o seed condicional:

```php
function ensure_rh_tables(PDO $pdo): void
{
    static $done = false;
    if ($done) { return; }
    // ... os 3 CREATE TABLE IF NOT EXISTS idênticos à migration ...
    $vazio = (int) $pdo->query('SELECT COUNT(*) FROM rh_tipos_documento')->fetchColumn() === 0;
    if ($vazio) {
        $pdo->exec("INSERT INTO rh_tipos_documento (nome, exige_validade, dias_alerta, ordem) VALUES
            ('ASO','Sim',30,1),('Treinamento NR-10','Sim',30,2),('Treinamento NR-18','Sim',30,3),
            ('Treinamento NR-35','Sim',30,4),('Contrato','Não',30,5)");
    }
    $done = true;
}
```

Guarda no bootstrap (junto das outras, ~2539, mesmo shape da Viabilidade):

```php
if (!resolve_existing_table($pdo, ['rh_colaboradores'], false)) { ensure_rh_tables($pdo); }
```

- [ ] **Step 3: Resources no `resource_map()` (~1800)**

`arquivo_path` fica `hidden` (caminho absoluto do servidor não vai ao bootstrap; o front usa `arquivo_nome` para saber se há anexo):

```php
'rhColaboradores' => r('rh_colaboradores', ['rh-colaboradores'], ['nome','cpf','tipo_vinculo','fornecedor_id','funcao','telefone','status','observacoes'], ['cpf']),
'rhTiposDocumento' => r('rh_tipos_documento', ['rh-tipos-documento'], ['nome','exige_validade','dias_alerta','descricao','ordem','status'], ['nome']),
'rhDocumentos' => r('rh_documentos', ['rh-documentos'], ['colaborador_id','tipo_documento_id','numero','data_emissao','data_validade','arquivo_nome','observacoes'], [], ['arquivo_path']),
```

- [ ] **Step 4: Permissões (backend)**

Em `permission_module_key()` (~9057): `'rhDocumentos' => 'rhColaboradores',` (documentos herdam a permissão de pessoas).
Em `default_role_view_modules()` (~9285): adicionar `'rhColaboradores'` e `'rhTiposDocumento'` às listas de `financeiro`, `engenharia`, `gestor_obra` e `consulta` (admin/gerente/visualizador já herdam tudo).
Em `default_role_edit_modules()` (~9302): adicionar `'rhColaboradores'` à lista de `gestor_obra` (tipos: edit só admin/gerente, que são automáticos — não adicionar `rhTiposDocumento` a nenhuma lista de edit).

- [ ] **Step 5: Validar e commitar**

Run: `php -l api/index.php` → `No syntax errors detected`
Run: `bash scripts/tests/run-all.sh` → todos os blocos ok
Run (após `git add`): `git ls-files --eol api/index.php migrations/2026-07-22-rh-pessoal-f1.sql` → `i/lf w/lf`

```bash
git add api/index.php migrations/2026-07-22-rh-pessoal-f1.sql
git commit -m "feat(rh): tabelas rh_colaboradores/rh_tipos_documento/rh_documentos + REST + permissoes (F1 task 1)"
```

---

### Task 2: Anexos — upload/download de documento

**Files:**
- Modify: `api/index.php` — rotas novas no bloco de rotas REST simples (espelhar o bloco `rdo-foto-upload`/`rdo-foto`, ~479-493) + 2 handlers novos (perto de `handle_rdo_upload_foto`, ~8541)

**Interfaces:**
- Consumes: `ensure_rh_tables` (Task 1); `store_upload($file, $dir, $exts, $mimes): string` (~9762); `respond()`/`fail()`; `server_audit()`.
- Produces: `POST rh-doc-upload` (multipart: `documentoId`, `file`) e `GET rh-doc-arquivo?id=` — usados pela Task 4.

- [ ] **Step 1: Rotas (mesmo shape do bloco RDO ~479)**

```php
// rh-doc-upload: POST multipart, permissão edit de rhColaboradores
authorize_request($pdo, $authUser, 'rhColaboradores', 'edit');
handle_rh_doc_upload($pdo, $config, $authUser);
// rh-doc-arquivo: GET ?id=, permissão view
authorize_request($pdo, $authUser, 'rhColaboradores', 'view');
handle_rh_doc_download($pdo, $config);
```

- [ ] **Step 2: Handlers**

```php
function handle_rh_doc_upload(PDO $pdo, array $config, array $authUser): void
{
    ensure_rh_tables($pdo);
    $docId = (int) ($_POST['documentoId'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, arquivo_path FROM rh_documentos WHERE id = ?');
    $stmt->execute([$docId]);
    $doc = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc) { fail('Documento não encontrado.', 404); }
    $uploadRoot = rtrim($config['upload_dir'] ?? '/var/lib/financeiro/uploads', '/');
    $dir = $uploadRoot . '/rh';
    if (!is_dir($dir)) { mkdir($dir, 0750, true); }
    $path = store_upload($_FILES['file'] ?? null, $dir,
        ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
        ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    $nomeOriginal = mb_substr((string) ($_FILES['file']['name'] ?? ''), 0, 255);
    // Substituição: apaga o anterior COM guarda de path-traversal (padrão Viabilidade)
    $anterior = (string) ($doc['arquivo_path'] ?? '');
    if ($anterior !== '') {
        $real = realpath($anterior);
        if ($real !== false && strpos($real, realpath($uploadRoot) . DIRECTORY_SEPARATOR) === 0 && is_file($real)) {
            @unlink($real);
        }
    }
    $pdo->prepare('UPDATE rh_documentos SET arquivo_path = ?, arquivo_nome = ? WHERE id = ?')
        ->execute([$path, $nomeOriginal, $docId]);
    server_audit($pdo, $authUser, 'rhDocumentos', 'upload', (string) $docId);
    respond(['ok' => true, 'data' => ['id' => $docId, 'arquivo_nome' => $nomeOriginal]]);
}

function handle_rh_doc_download(PDO $pdo, array $config): void
{
    ensure_rh_tables($pdo);
    $docId = (int) ($_GET['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT arquivo_path, arquivo_nome FROM rh_documentos WHERE id = ?');
    $stmt->execute([$docId]);
    $doc = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc || !$doc['arquivo_path'] || !is_file($doc['arquivo_path'])) { fail('Arquivo não encontrado.', 404); }
    $ext = strtolower(pathinfo($doc['arquivo_path'], PATHINFO_EXTENSION));
    $mimes = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
    header('Content-Disposition: inline; filename="' . rawurlencode((string) ($doc['arquivo_nome'] ?: basename($doc['arquivo_path']))) . '"');
    readfile($doc['arquivo_path']);
    exit;
}
```

Conferir a assinatura real de `server_audit` no arquivo e ajustar a chamada ao shape usado pelos vizinhos (ex.: `handle_rdo_upload_foto`).

- [ ] **Step 3: Validar e commitar**

Run: `php -l api/index.php` → `No syntax errors detected`
Run: `bash scripts/tests/run-all.sh` → verde

```bash
git add api/index.php
git commit -m "feat(rh): upload/download de anexo de documento (rh-doc-upload / rh-doc-arquivo) (F1 task 2)"
```

---

### Task 3: Front — registro do módulo + tipos (CRUD genérico) + lista/form de colaboradores

**Files:**
- Modify: `app.js` — `modules` (~105), `sidebarSections` (~217), `SUBMODULE_ICONS` (~260), `roleModules` (~328), `EDITABLE_BY_ROLE` (~352), mapa de rotas REST (~551-572), `configs` (~583), dispatch em `render()` (~2808+), funções novas `renderRhColaboradores`/`openRhColaboradorForm` + helpers
- Modify: `styles.css` — só se precisar de classe nova (preferir reusar `.q-badge`, `.module-head`, `.empty`)

**Interfaces:**
- Consumes: resources REST da Task 1 (`db.rhColaboradores`, `db.rhTiposDocumento`, `db.rhDocumentos` via bootstrap; rotas `rh-colaboradores` etc.); `viabilidadeDialog(html, cls)` (~14914); `apiRequest`; `escapeHtml`/`svgText`; `showToast`.
- Produces: módulos `rhColaboradores`/`rhVencimentos`/`rhTiposDocumento` registrados; `RH_VINCULOS` (mapa label); `rhFichaOpenId` (estado da ficha, usado na Task 4); `renderRhColaboradores()`.

- [ ] **Step 1: Registro declarativo**

Em `modules`: `["rhColaboradores", "Colaboradores"], ["rhVencimentos", "Vencimentos de documentos"], ["rhTiposDocumento", "Tipos de documento (RH)"]`.
Em `sidebarSections` (nova seção antes de "Configurações"):

```js
{ id: "rh", label: "RH / Pessoal", icon: "ti-users", modules: ["rhColaboradores", "rhVencimentos", "rhTiposDocumento"] },
```

Em `SUBMODULE_ICONS`: propor `rhColaboradores: ["ti-id-badge-2", "#185FA5"]`, `rhVencimentos: ["ti-alarm", "#c0392b"]`, `rhTiposDocumento: ["ti-file-certificate", "#3B6D11"]` — **conferir cada nome** em `assets/fonts/tabler-icons.min.css` (fallbacks: `ti-id`, `ti-clock`, `ti-certificate`).
Em `roleModules`: adicionar as 3 keys a `financeiro`, `engenharia`, `gestor_obra`, `consulta` (espelho exato do backend Task 1 Step 4).
Em `EDITABLE_BY_ROLE`: adicionar `rhColaboradores` a `gestor_obra`.
No mapa de rotas REST (onde está `projectNotifications: "notificacoes-obras"`): `rhColaboradores: "rh-colaboradores", rhTiposDocumento: "rh-tipos-documento", rhDocumentos: "rh-documentos"`.
Em `render()`: `if (currentModule === "rhColaboradores") return renderRhColaboradores();` (rhVencimentos entra na Task 5; `rhTiposDocumento` NÃO ganha if — cai no `renderCrud` genérico).

- [ ] **Step 2: Config do CRUD genérico de tipos**

Em `configs`, espelhando o formato EXATO do config vizinho `documentTypes` (~1478):

```js
rhTiposDocumento: {
  title: "Tipos de documento (RH)",
  description: "Documentos de colaboradores (ASO, treinamentos NR, contratos) e a antecedência do alerta de vencimento.",
  fields: [ /* nome (text), exige_validade (select Sim/Não), dias_alerta (number), descricao (text), ordem (number), status (select Ativo/Inativo) — mesmas tuplas do documentTypes */ ],
},
```

- [ ] **Step 3: Helpers + lista de colaboradores**

```js
const RH_VINCULOS = { proprio: "Próprio", diarista: "Diarista", autonomo: "Autônomo", empreiteira: "Empreiteira" };
let rhFichaOpenId = null; // Task 4

function rhFornecedorNome(id) {
  const f = (db.suppliers || []).find(s => String(s.id) === String(id));
  return f ? f.name : "";
}
```

`renderRhColaboradores()`: `module-head` (título + botão "Novo colaborador" se `canEditModule("rhColaboradores")`) + filtros (busca por nome/CPF, select de vínculo, select de status) + tabela: Nome (link que abre a ficha — Task 4), CPF (formatado na exibição), Vínculo (`RH_VINCULOS`), Empresa (só empreiteira), Função, Telefone, Status, Documentos (badge — Task 5; até lá, contagem inline `(db.rhDocumentos || []).filter(d => String(d.colaborador_id) === String(c.id)).length`). Todo dado com `escapeHtml`. Modelo estrutural: `renderViabilidadeList` (~14705).

`openRhColaboradorForm(colab)`: dialog via `viabilidadeDialog` com os campos; o select de fornecedor (de `db.suppliers` ativos) só aparece quando vínculo = empreiteira (listener no select de vínculo); validações antes do save: nome obrigatório; CPF → só dígitos (11) ou vazio→`null`; empreiteira sem fornecedor → `showToast` de erro e não salva. Save: `apiRequest("rh-colaboradores", { method: "POST", body: JSON.stringify(payload) })` (update: `PUT rh-colaboradores/{id}`) — copiar o shape de `saveProjectNotification`/`updateProjectNotification` (~10196); depois atualizar `db.rhColaboradores` local e `render()`.

- [ ] **Step 4: Validar e commitar**

Run: `node --check app.js` → sem erro
Manual (local, sem banco): não aplicável — validação visual fica no roteiro da Task 5.

```bash
git add app.js styles.css
git commit -m "feat(rh): modulo no front - secao RH/Pessoal, tipos via CRUD generico e lista/form de colaboradores (F1 task 3)"
```

---

### Task 4: Front — ficha do colaborador + CRUD de documentos + anexos

**Files:**
- Modify: `app.js` — ficha dentro de `renderRhColaboradores` (estado `rhFichaOpenId`, padrão `cotacaoView`), `openRhDocumentoForm`, upload/download/exclusão de anexo

**Interfaces:**
- Consumes: `rhFichaOpenId` (Task 3); endpoints da Task 2; `fetchForm(path, formData)` (~1949); padrão de download autenticado de `exportSinapiExcel` (fetch + `authHeaders()` + blob).
- Produces: `rhDocsDaPessoa(colabId)` — usada pela Task 5 (e substitui a contagem inline da Task 3 na coluna Documentos).

- [ ] **Step 1: Helper de documentos por pessoa (mais recente por tipo)**

```js
function rhDocsDaPessoa(colabId) {
  const docs = (db.rhDocumentos || []).filter(d => String(d.colaborador_id) === String(colabId));
  const porTipo = new Map();
  docs.forEach(d => {
    const k = String(d.tipo_documento_id);
    const atual = porTipo.get(k);
    // renovação: vale o de MAIOR validade (comparação de string YYYY-MM-DD, regra M10)
    if (!atual || String(d.data_validade || "") > String(atual.data_validade || "")) porTipo.set(k, d);
  });
  return [...porTipo.values()];
}
```

- [ ] **Step 2: Ficha (`rhFichaOpenId !== null` → sub-view na mesma tela)**

Cabeçalho com dados da pessoa + botão Editar + Voltar; tabela de TODOS os documentos da pessoa (não só o mais recente): Tipo, Número, Emissão, Validade, Situação (badge — Task 5), Anexo (nome + baixar se `arquivo_nome`; senão "—"), ações Editar/Excluir/Anexar (se `canEditModule`).

`openRhDocumentoForm(colab, doc)`: dialog com tipo (select de `db.rhTiposDocumento` ativos), número, emissão, validade, observações + `<input type="file">` opcional. Validação: se o tipo tem `exige_validade === "Sim"`, validade obrigatória. Save: POST/PUT `rh-documentos`; se houver arquivo selecionado, na sequência `fetchForm("rh-doc-upload", formData)` com `documentoId` + `file`, e refletir `arquivo_nome` no `db` local.
Download: shape de `exportSinapiExcel` com path `rh-doc-arquivo?id=<id>` (abrir blob em nova aba).
Excluir documento: confirmação + `DELETE rh-documentos/{id}` + atualizar `db` local.

- [ ] **Step 3: Validar e commitar**

Run: `node --check app.js` → sem erro

```bash
git add app.js
git commit -m "feat(rh): ficha do colaborador com documentos e anexos (upload/download autenticado) (F1 task 4)"
```

---

### Task 5: Situação de vencimento + painel Vencimentos + dashboard + release F1

**Files:**
- Modify: `app.js` — `rhDocSituacao`/`rhDocBadge`, badge na lista (Task 3) e na ficha (Task 4), `renderRhVencimentos` + dispatch, bloco em `dashboardAlerts` (~4791), `APP_VERSION` + `APP_CHANGELOG`
- Modify: `index.html` — `?v=` de `app.js` e `styles.css`
- Modify: `CLAUDE.md` (entrada da versão no topo) e `STATUS.md` (linha do módulo)

**Interfaces:**
- Consumes: `rhDocsDaPessoa` (Task 4); `hojeLocal()` (~3975), `parseLocalDate` (~9859), `startOfLocalDay` (~9873); `qBadge(text, tone)` (~11828).
- Produces: `rhDocSituacao(doc): {key, dias}` e `rhDocBadge(sit): string` — contrato reusado pela F2 (cron espelha a MESMA regra em PHP).

- [ ] **Step 1: Helper de situação (regra M10, espelho do `qFvmValidadeAlerta`)**

```js
function rhDocSituacao(doc) {
  if (!doc.data_validade) return { key: "sem_validade", dias: null };
  const hoje = hojeLocal();
  if (doc.data_validade < hoje) return { key: "vencido", dias: null }; // string vs string
  const dias = Math.round((startOfLocalDay(parseLocalDate(doc.data_validade)) - startOfLocalDay(new Date())) / 86400000);
  const tipo = (db.rhTiposDocumento || []).find(t => String(t.id) === String(doc.tipo_documento_id));
  const janela = Number(tipo && tipo.dias_alerta) > 0 ? Number(tipo.dias_alerta) : 30;
  return { key: dias <= janela ? "atencao" : "ok", dias };
}

function rhDocBadge(sit) {
  if (sit.key === "vencido") return qBadge("VENCIDO", "ruim");
  if (sit.key === "atencao") return qBadge(`Vence em ${sit.dias} dia(s)`, "atencao");
  if (sit.key === "ok") return qBadge("Válido", "ok");
  return qBadge("Sem validade", "");
}
```

Conferir os tons existentes de `qBadge` (`q-ruim`/`q-atencao` confirmados em `styles.css:4019`); se não houver tom verde `q-ok`, criar `.q-badge.q-ok` no `styles.css` seguindo o par vizinho.
Badge da LISTA (coluna Documentos) = pior situação entre `rhDocsDaPessoa(c.id)`: vencido > atencao > ok > sem docs ("—").

- [ ] **Step 2: `renderRhVencimentos()`**

Dispatch em `render()`. Conteúdo: para cada colaborador `Ativo`, para cada doc de `rhDocsDaPessoa`, uma linha com Colaborador (link para a ficha), Vínculo, Tipo, Validade, Situação (badge), Anexo. Ordenar por `data_validade` crescente (nulls no fim); filtros: situação (todos / só vencidos / só vencendo), tipo de documento, vínculo. Sem endpoint novo — tudo de `db`.

- [ ] **Step 3: Bloco no `dashboardAlerts` (~4791)**

```js
// RH: documentos de colaboradores ativos (mais recente por pessoa+tipo)
let rhVencidos = 0, rhVencendo = 0;
(db.rhColaboradores || []).filter(c => (c.status || "Ativo") === "Ativo").forEach(c => {
  rhDocsDaPessoa(c.id).forEach(d => {
    const sit = rhDocSituacao(d);
    if (sit.key === "vencido") rhVencidos += 1;
    else if (sit.key === "atencao") rhVencendo += 1;
  });
});
if (rhVencidos > 0) alerts.push({ level: "danger", message: `${rhVencidos} documento(s) de colaborador VENCIDO(S) — ver RH / Vencimentos.` });
if (rhVencendo > 0) alerts.push({ level: "warning", message: `${rhVencendo} documento(s) de colaborador vencendo — ver RH / Vencimentos.` });
```

- [ ] **Step 4: Release F1**

`APP_VERSION` → próxima minor livre (hoje v1.35.0) + entrada no `APP_CHANGELOG`; `index.html` `?v=` +1 nos dois arquivos; entrada de versão no topo do `CLAUDE.md`; linha "RH / Pessoal" na tabela de módulos do `STATUS.md`.

- [ ] **Step 5: Validar e commitar**

Run: `node --check app.js` → sem erro
Run: `php -l api/index.php` → limpo
Run: `bash scripts/tests/run-all.sh` → verde

```bash
git add app.js styles.css index.html CLAUDE.md STATUS.md
git commit -m "feat(rh): situacao de vencimento (badges), painel Vencimentos e alertas no dashboard - release F1 (F1 task 5)"
```

- [ ] **Step 6: Roteiro de validação da F1 no servidor (usuário)**

Após o push (manual) e `mysql -u root -p financeiro < migrations/2026-07-22-rh-pessoal-f1.sql`:
1. Criar 1 colaborador de cada vínculo; empreiteira sem fornecedor deve ser bloqueada no form.
2. CPF duplicado deve ser rejeitado; CPF vazio deve salvar.
3. Criar documentos: validade ONTEM (badge VENCIDO vermelho), validade em 10 dias (âmbar "Vence em 10 dia(s)"), validade em 90 dias (Válido), tipo Contrato sem validade (Sem validade).
4. Renovar o ASO (novo registro com validade futura) → badge da pessoa deixa de acusar vencido; painel Vencimentos mostra só o mais recente.
5. Anexar PDF a um documento, baixar, substituir por imagem, baixar de novo; arquivo .txt deve ser recusado.
6. Dashboard: bloco vermelho + âmbar com as contagens certas.
7. Papel restrito (ex.: `equipe_campo`): seção RH invisível; `consulta`: vê mas não edita.
8. Tela Configurações → Permissões: ajustar um papel e conferir efeito.

---

# FASE 2 — Alocação em obras (detalhar em ciclo próprio APÓS validar F1)

> Contratos fixados aqui; o passo a passo (código completo) é escrito no início da fase, no mesmo processo da F1. Nenhuma mudança de schema em tabelas existentes.

### Task 6: `rh_alocacoes` + telas de alocação

**Files:** `migrations/<data>-rh-pessoal-f2-alocacao.sql` (DDL exato na spec, seção F2) · `api/index.php` (DDL em `ensure_rh_tables`; resource `'rhAlocacoes' => r('rh_alocacoes', ['rh-alocacoes'], ['colaborador_id','projectId','data_inicio','data_fim','funcao_na_obra','observacoes'], [])`; `permission_module_key`: `'rhAlocacoes' => 'rhColaboradores'`) · `app.js` (ações Alocar/Encerrar na ficha e na lista; coluna "Obra atual"; filtro por obra na lista e no painel Vencimentos).

**Regras:** máx. 1 alocação aberta (`data_fim IS NULL`) por colaborador+obra (validação no front + conferência no save); FK `projectId` ON DELETE RESTRICT (padrão G3 — obra arquiva, não some).

### Task 7: Dashboard por obra + RDO

**Files:** `app.js` — em `dashboardAlerts`, quando `activeDashboardProject()`, contar só documentos de colaboradores com alocação aberta na obra; no form do RDO, botão "Preencher com efetivo alocado" que agrupa alocações abertas da obra por `funcao_na_obra` e injeta linhas `{funcao, quantidade}` na UI existente do efetivo (`rdoEfetivoRowHtml` ~3033). **Schema do RDO intocado.**

### Task 8: Cron `create_rh_doc_alerts` + teste na suíte

**Files:** `api/cron/jobs.php` (job novo na cadeia `$jobs`, depois de `create_due_alerts`) · `api/index.php` (função pura) · `scripts/tests/php/test_rh_doc_janela.php` (novo, via `harness.php`).

**Contrato da função pura (testável sem banco):**

```php
// $docs: cada item ['id' => int, 'data_validade' => 'YYYY-MM-DD'|null, 'dias_alerta' => int]
// $hoje: 'YYYY-MM-DD' (date('Y-m-d') do PHP — nunca CURDATE())
// Retorna itens nas janelas PONTUAIS: D-dias_alerta => 'antecedencia', D-0 => 'hoje'
function rh_docs_em_janela(array $docs, string $hoje): array
```

**Job:** para cada retorno, localizar a alocação ABERTA mais recente do colaborador; sem alocação → pula (mesma regra de conta sem obra do `create_due_alerts`); grava em `obra_notificacoes` via `insert_dynamic`: `projectId` da alocação, `recipient='Alerta automático'`, `type='ALERTA_VENCIMENTO'` (valor de ENUM já existente — sem ALTER), `message` "Documento de colaborador vence em N dia(s): <nome> — <tipo> (<data>)" / "...vence HOJE...", `generatedLink='RH_DOC:<id>'`, `status='Preparado'`; dedupe com `notification_exists_today` (1 notificação por documento por janela).

**Validação da fase:** teste da suíte verde + roteiro no servidor (alocar, `php api/cron/jobs.php`, conferir Notificações da obra; rodar 2ª vez no mesmo dia → sem duplicata).

---

# FASE 3 — Pagamentos (detalhar em ciclo próprio APÓS validar F2)

### Task 9: `rh_diarias` + `rh_medicoes` + telas de lançamento

**Files:** `migrations/<data>-rh-pessoal-f3-pagamentos.sql` (DDL exato na spec, seção F3) · `api/index.php` (DDL no `ensure_rh_tables`; resources `rhDiarias`/`rhMedicoes` com permissão herdada de `rhColaboradores`) · `app.js` (lançamento de diárias por colaborador diarista/autônomo — data, obra, valor; medições por empreiteira — fornecedor, obra, período, valor, fluxo Aberta → Aprovada).

### Task 10: Geração de contas a pagar + heal

**Files:** `api/index.php` — `handle_rh_module` (`?module=rh`) com actions `diariaGerarConta` e `medicaoGerarConta`, + `rh_heal_contas` · `app.js` — modais de geração (categoria + vencimento) e exibição do vínculo.

**Contrato (cópia do `materialGerarConta` das Cotações P2):**
- Diárias: agrupa Abertas por colaborador+obra → UMA conta em `accounts_payable` com `document='RH-DIA-<colabId>-<hash curto>'` (≤80 chars, nome do colaborador na mensagem/observação), `status='Aberto'`, `referencia_tipo='RH_DIARIA'`, `referencia_id`=1ª diária, `amount`=Σ, categoria/vencimento do modal; transação + guarda anti-corrida `UPDATE rh_diarias SET conta_pagar_id=? WHERE id IN (...) AND conta_pagar_id IS NULL` com rollback se a contagem não bater; tudo já vinculado → 409 com os documentos.
- Medições: exige `status='Aprovada'`; conta com `supplierId=fornecedor_id`, `referencia_tipo='RH_MEDICAO'`, `referencia_id=<id>`, `document='RH-MED-<id>'`; medição → `Faturada`.
- `rh_heal_contas`: se a conta vinculada foi excluída no financeiro, limpa `conta_pagar_id` e volta o status (espelho de `cotacao_material_heal_contas`).

**Validação da fase:** lançar diárias/medição → gerar conta → conferir em Contas a Pagar; excluir a conta → heal libera; duas gerações concorrentes → uma vence, outra recebe 409.

---

## Após o plano

Cada fase fecha com: suíte verde local, commit(s) sem push, push manual quando o usuário pedir, migration rodada manualmente no servidor, e o roteiro de validação da fase executado pelo usuário antes de abrir o ciclo da fase seguinte.
