# Estudo Benchmark dos Módulos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produzir o documento `docs/estudos/2026-07-estudo-benchmark-modulos.md` — inventário interno + benchmark de mercado das 8 frentes do ObraSync, com tabelas de recomendação para decisão do usuário.

**Architecture:** Documento único construído por etapas: esqueleto → inventário interno (8 agentes de leitura em paralelo) → benchmark/análise por frente (uma task por frente, pesquisa web) → resumo executivo e fechamento. Cada task termina em commit; o usuário pode revisar entre etapas.

**Tech Stack:** Markdown; agentes Explore (leitura do código); WebSearch/WebFetch (benchmark). Nenhum código do sistema é alterado.

## Global Constraints

- Idioma do documento: **português brasileiro**.
- Arquivo do estudo: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (único; não criar outros arquivos de estudo).
- Spec de referência: `docs/superpowers/specs/2026-07-18-estudo-benchmark-modulos-design.md` — em dúvida de escopo, ela manda.
- **Nenhuma alteração** em `app.js`, `api/index.php`, `styles.css`, `index.html`, `schema.sql`, migrations ou qualquer código do sistema.
- Tabela de recomendações com colunas exatas: `# | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão`.
- Impacto/Esforço: escala **Alto/Médio/Baixo**. Decisão: sempre `⬜` (o usuário marca depois).
- IDs das recomendações por frente: `E` (erros), `FC` (fluxo comercial), `G` (Gantt), `AG` (agenda), `KB` (kanban), `FIN` (financeiro), `DEP` (deploy), `API` (API/multi-frontend). Ex.: `E1`, `FC3`.
- Toda afirmação sobre player de mercado deve ter fonte (URL) na seção "Fontes" da frente.
- Mínimo de 5 recomendações por frente (se a pesquisa render menos, registrar por quê no texto da frente).
- Commits: prefixo `docs(estudo): ...`, um por task. **Nunca** fazer `git push` (é manual, só quando o usuário pedir).
- Repo: working tree em `outputs\` (raiz do repo git).

---

### Task 1: Esqueleto do documento de estudo

**Files:**
- Create: `docs/estudos/2026-07-estudo-benchmark-modulos.md`

**Interfaces:**
- Produces: os títulos de seção exatos (`## Frente N — ...`, `### Como é hoje`, `### Como o mercado faz` / `### Opções de como funcionaria`, `### Recomendações`) que TODAS as tasks seguintes localizam via grep para preencher conteúdo.

- [ ] **Step 1: Criar o arquivo com o esqueleto completo**

Conteúdo exato do arquivo:

```markdown
# Estudo — Módulos ObraSync: inventário interno + benchmark de mercado

**Data:** 2026-07-18 · **Spec:** `docs/superpowers/specs/2026-07-18-estudo-benchmark-modulos-design.md`
**Status:** em produção (seções são preenchidas por etapas; "pendente" = etapa ainda não executada)

Como usar este documento: cada frente termina numa tabela de recomendações.
Marque a coluna **Decisão** de cada linha com **sim** ou **não**. Cada item
aprovado vira um ciclo próprio de spec → plano → implementação (por etapas).

## Resumo executivo

pendente

## Frente 1 — Padrão de verificação de erros

### Como é hoje

pendente

### Boas práticas do mercado

pendente

### Roteiro de verificação sob demanda

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 2 — Fluxo comercial de serviços

### Como é hoje

pendente

### Como o mercado faz

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 3 — Gantt / linha do tempo

### Como é hoje

pendente

### Como o mercado faz

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 4 — Agenda

### Como é hoje

pendente

### Como o mercado faz

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 5 — Kanban

### Como é hoje

pendente

### Como o mercado faz

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 6 — Financeiro

### Como é hoje

pendente

### Como o mercado faz

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 7 — Agente de build/deploy on-premise (análise técnica)

### Como é hoje

pendente

### Opções de como funcionaria

pendente

### Recomendações

pendente

### Fontes

pendente

## Frente 8 — Backend como API + múltiplos frontends (análise técnica)

### Como é hoje

pendente

### Opções de como funcionaria

pendente

### Recomendações

pendente

### Fontes

pendente

## Fechamento — visão consolidada e ordem sugerida

pendente
```

- [ ] **Step 2: Verificar o esqueleto**

Run: `grep -c "^## Frente" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `8`

Run: `grep -c "^pendente$" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `35`

- [ ] **Step 3: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): esqueleto do estudo de benchmark das 8 frentes"
```

---

### Task 2: Inventário interno — preencher "Como é hoje" das 8 frentes

**Files:**
- Modify: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (as 8 seções `### Como é hoje`)

**Interfaces:**
- Consumes: títulos de seção do esqueleto (Task 1).
- Produces: as 8 seções "Como é hoje" preenchidas — as tasks 3-10 escrevem recomendações comparando o mercado contra ESTE conteúdo.

- [ ] **Step 1: Despachar 8 agentes Explore em paralelo (um por frente)**

Todos os agentes são somente leitura, recebem o mesmo preâmbulo e um foco
específico. Preâmbulo comum (incluir em cada prompt):

> Você está no repo do ObraSync (raiz `outputs\`): SPA sem build — `app.js`
> (~15k linhas, objeto global `db`, `render()` despacha por `currentModule`),
> `api/index.php` (~8,7k linhas, REST por path + `?module=&action=`),
> `schema.sql` + `migrations/`, docs em `docs/` e `CLAUDE.md`. NÃO modifique
> nada. Devolva APENAS markdown pronto para colar, com os subtítulos:
> **Telas e ações** (funções `render*`/handlers relevantes), **Endpoints**
> (path REST ou module/action), **Tabelas e colunas-chave**, **Limitações e
> lacunas observadas**. Seja específico (nomes reais de funções, tabelas,
> colunas) e conciso (máx. ~60 linhas).

Focos por agente:

1. **Frente 1 (erros):** como o sistema trata erros hoje — `fail()`/`respond()` e formatos de erro no PHP; `apiRequest`/`apiModuleRequest`/`fetchForm`/`showToast` no JS; validações de formulário (onde existem e onde não); o que acontece em erro inesperado (JS sem catch? PHP com `display_errors=0`/`log_errors=1`?); `server_audit()`; existe captura global (`window.onerror`)? logs disponíveis.
2. **Frente 2 (fluxo comercial):** o caminho cadastro cliente/fornecedor → proposta (`commercial_proposals`, `proposta_itens`, `proposta_orcamento_vinculos`, `proposta_grupos`) → orçamento (`orcamentos_obras`/`orcamento_obra_itens`) → obra (`projects`) → contrato (`sales_contracts`) → cotações/compras. Onde o fluxo exige passos manuais ou re-digitação; o que já é automático.
3. **Frente 3 (Gantt/cronograma):** módulo de cronograma/Gantt atual — telas, tabelas de marcos/tarefas, importação MS Project, aprovação de marco → conta a receber. LER TAMBÉM `docs/specs/cronograma-fisico-financeiro.md` e resumir o que ela já prevê (EAP, dependências, baseline, curva S).
4. **Frente 4 (agenda):** módulo agenda — tabelas (`ensure_agenda_tables`), campos de evento, endpoints `?module=agenda`, integração com financeiro, o que existe de status/cores/conclusão/anotações hoje.
5. **Frente 5 (kanban):** módulo kanban — tabelas (`ensure_kanban_tables`), colunas/cartões/campos, endpoints, o que existe de etiquetas/filtros/limites hoje.
6. **Frente 6 (financeiro):** `accounts_payable`/`accounts_receivable` (recorrência, quitação antecipada, vencidas — job `mark_overdue_accounts`), `cash_bank_movements`, fluxo de caixa (`collectMonths`), OFX, `fiscal_documents`/NFS-e e vínculos (`payableId`), `purchase_orders` e ciclo cotação → conta → NF, dashboards (overduePayable/overdueReceivable).
7. **Frente 7 (deploy):** fluxo de deploy completo — `deploy.php` (webhook HMAC), `backup-pre-deploy.sh`, `scripts/`, cache busting (`?v=` em `index.html` + `APP_VERSION`), migrations manuais, funções `ensure_*` (auto-cura), seção Operação/Deploy do `CLAUDE.md`.
8. **Frente 8 (API):** estrutura de roteamento do `api/index.php` — REST por path vs `?module=&action=`, os DOIS formatos de resposta (`respond()`/`fail()` vs `{success,data,message}`), `resource_map()`/`insert_dynamic()`, autenticação (`authenticate_request`, token em header, sessão), headers CORS/CSP no `.htaccess`, acoplamentos com o SPA.

- [ ] **Step 2: Colar cada resultado na seção "Como é hoje" da frente correspondente**

Substituir a linha `pendente` da seção `### Como é hoje` de cada frente pelo
markdown devolvido pelo agente (revisar antes de colar: remover redundância,
manter nomes reais).

- [ ] **Step 3: Verificar que nenhuma seção "Como é hoje" ficou pendente**

Run: `awk '/^### Como é hoje/{getline; getline; if ($0=="pendente") print NR}' docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: saída vazia (nenhuma linha)

- [ ] **Step 4: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): inventario interno das 8 frentes (como e hoje)"
```

---

### Task 3: Frente 1 — boas práticas de erros + roteiro de verificação + recomendações

**Files:**
- Modify: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (Frente 1: seções `### Boas práticas do mercado`, `### Roteiro de verificação sob demanda`, `### Recomendações`, `### Fontes`)

**Interfaces:**
- Consumes: seção "Como é hoje" da Frente 1 (Task 2).
- Produces: recomendações `E1..En`; o roteiro de verificação sob demanda (referenciado no Fechamento, Task 11).

- [ ] **Step 1: Pesquisar boas práticas**

WebSearch (mínimo 4 buscas, ajustar conforme resultados):
- `error message UX best practices Nielsen Norman`
- `PHP production error handling logging best practices`
- `JavaScript window.onerror unhandledrejection global error capture SPA`
- `form validation UX inline error best practices`

Guardar título+URL de cada fonte usada.

- [ ] **Step 2: Escrever "Boas práticas do mercado"**

Substituir `pendente` por síntese em tópicos (mensagens de erro claras e
acionáveis; validação inline antes do submit; captura global JS
(`window.onerror`/`unhandledrejection`) e log centralizado; erro inesperado
nunca silencioso — sempre feedback ao usuário + registro para diagnóstico;
correlação de erro com requisição/usuário). Cada afirmação com fonte
numerada `[1]`, `[2]`...

- [ ] **Step 3: Escrever "Roteiro de verificação sob demanda"**

Substituir `pendente` por um checklist executável (o roteiro que o agente
percorre quando o usuário pedir "verificar erros"), com no mínimo estes
blocos, cada um com passos concretos:

```markdown
1. **Sintaxe e estáticos:** `php -l api/index.php`; `node --check app.js`.
2. **Fluxo feliz ponta a ponta (leitura de código):** cadastro cliente →
   proposta → obra → orçamento → conta a receber/pagar → baixa — conferir
   que cada passo trata resposta de erro da API (toast + estado consistente).
3. **Casos de borda:** campos vazios/valores inválidos nos formulários
   principais; IDs inexistentes nos endpoints; permissão negada.
4. **Erros inesperados:** simular resposta 500/JSON inválido — o front
   mostra algo? O PHP loga? (conferir handlers e logs)
5. **Relatório:** listar cada problema com arquivo:linha, gravidade e
   sugestão de correção — SEM corrigir nada sem aprovação.
```

- [ ] **Step 4: Escrever a tabela "Recomendações" (IDs E1..En, mínimo 5)**

Formato exato (exemplo de linha — o conteúdo real sai da comparação entre
"Como é hoje" e as boas práticas):

```markdown
| # | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão |
|---|---|---|---|---|---|---|
| E1 | Captura global de erros JS com log no servidor | Boas práticas [3] | Alto | Médio | — | ⬜ |
```

- [ ] **Step 5: Preencher "Fontes" da Frente 1 e verificar**

Run: `grep -c "^| E[0-9]" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `5` ou mais

- [ ] **Step 6: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): frente 1 - boas praticas de erros, roteiro de verificacao e recomendacoes"
```

---

### Task 4: Frente 2 — benchmark do fluxo comercial (ERPs de construção)

**Files:**
- Modify: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (Frente 2: `### Como o mercado faz`, `### Recomendações`, `### Fontes`)

**Interfaces:**
- Consumes: seção "Como é hoje" da Frente 2 (Task 2).
- Produces: recomendações `FC1..FCn`.

- [ ] **Step 1: Pesquisar os players**

WebSearch (mínimo, ajustar conforme resultados):
- `Sienge funcionalidades comercial orçamento obra fluxo`
- `TOTVS Construção de Obras funcionalidades proposta orçamento`
- `Mega Construção ERP funcionalidades`
- `Obra Prima software gestão obras funcionalidades`
- `software gestão obras fluxo proposta orçamento contrato suprimentos`

Complementar com WebFetch nas páginas de produto. Foco: como cada um encadeia
cadastro → proposta (de SERVIÇOS) → orçamento → obra → suprimentos/descontos;
o que automatizam entre etapas.

- [ ] **Step 2: Escrever "Como o mercado faz"**

Substituir `pendente` por: um bloco curto por player (3-6 funcionalidades
relevantes com fonte) + um parágrafo comparando com o fluxo desejado pelo
usuário (proposta de serviços → orçamento base → obra → orçamento de compras
buscando descontos).

- [ ] **Step 3: Escrever a tabela "Recomendações" (IDs FC1..FCn, mínimo 5)**

Mesmo formato de colunas das Global Constraints. Basear cada linha numa
lacuna concreta entre "Como é hoje" e o benchmark.

- [ ] **Step 4: Preencher "Fontes" e verificar**

Run: `grep -c "^| FC[0-9]" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `5` ou mais

- [ ] **Step 5: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): frente 2 - benchmark do fluxo comercial de servicos"
```

---

### Task 5: Frente 3 — benchmark de Gantt / linha do tempo

**Files:**
- Modify: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (Frente 3: `### Como o mercado faz`, `### Recomendações`, `### Fontes`)

**Interfaces:**
- Consumes: seção "Como é hoje" da Frente 3 (Task 2 — inclui o resumo da spec `docs/specs/cronograma-fisico-financeiro.md`).
- Produces: recomendações `G1..Gn`.

- [ ] **Step 1: Pesquisar os players**

WebSearch (mínimo):
- `MS Project Gantt features timeline milestones dependencies`
- `Primavera P6 schedule features`
- `Smartsheet Gantt features`
- `Monday.com Gantt timeline view features`

Foco: linha do tempo combinando marcos + pagamentos + compras; dependências;
baseline; caminho crítico; o que é exibição vs o que é cálculo.

- [ ] **Step 2: Escrever "Como o mercado faz"**

Bloco por player (3-6 funcionalidades com fonte) + parágrafo explícito de
como isso se relaciona com a spec existente do cronograma físico-financeiro
(o que a spec já cobre; o que o benchmark acrescenta; SEM duplicá-la).

- [ ] **Step 3: Escrever a tabela "Recomendações" (IDs G1..Gn, mínimo 5)**

Recomendações que a spec do cronograma já prevê devem dizer isso na coluna
"Depende de" (ex.: `spec cronograma`).

- [ ] **Step 4: Preencher "Fontes" e verificar**

Run: `grep -c "^| G[0-9]" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `5` ou mais

- [ ] **Step 5: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): frente 3 - benchmark de gantt e linha do tempo"
```

---

### Task 6: Frente 4 — benchmark de agenda

**Files:**
- Modify: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (Frente 4: `### Como o mercado faz`, `### Recomendações`, `### Fontes`)

**Interfaces:**
- Consumes: seção "Como é hoje" da Frente 4 (Task 2).
- Produces: recomendações `AG1..AGn`.

- [ ] **Step 1: Pesquisar os players**

WebSearch (mínimo):
- `Google Calendar Tasks features overdue completed`
- `Outlook calendar tasks features`
- `Todoist features overdue tasks color notes`
- `TickTick features task management calendar`

Foco nos pedidos do usuário: anotações em eventos, destaque visual de
atrasado (cor), botão/fluxo de concluir; e o que mais os players fazem
(recorrência, lembretes, arrastar para reagendar, visões dia/semana/mês).

- [ ] **Step 2: Escrever "Como o mercado faz"**

Bloco por player (3-6 funcionalidades com fonte).

- [ ] **Step 3: Escrever a tabela "Recomendações" (IDs AG1..AGn, mínimo 5)**

Incluir obrigatoriamente linhas para os 3 pedidos explícitos do usuário
(anotações, cor de atrasado, botão concluído) — com impacto/esforço avaliados
contra o inventário.

- [ ] **Step 4: Preencher "Fontes" e verificar**

Run: `grep -c "^| AG[0-9]" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `5` ou mais

- [ ] **Step 5: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): frente 4 - benchmark de agenda"
```

---

### Task 7: Frente 5 — benchmark de kanban

**Files:**
- Modify: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (Frente 5: `### Como o mercado faz`, `### Recomendações`, `### Fontes`)

**Interfaces:**
- Consumes: seção "Como é hoje" da Frente 5 (Task 2).
- Produces: recomendações `KB1..KBn`.

- [ ] **Step 1: Pesquisar os players**

WebSearch (mínimo):
- `Trello features labels checklists automation butler`
- `Jira board features WIP limits swimlanes`
- `Monday.com board features`
- `ClickUp board view features`

Foco: limites WIP, etiquetas, checklists no cartão, automações, filtros,
swimlanes, datas/atraso no cartão, anexos/comentários.

- [ ] **Step 2: Escrever "Como o mercado faz"**

Bloco por player (3-6 funcionalidades com fonte).

- [ ] **Step 3: Escrever a tabela "Recomendações" (IDs KB1..KBn, mínimo 5)**

- [ ] **Step 4: Preencher "Fontes" e verificar**

Run: `grep -c "^| KB[0-9]" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `5` ou mais

- [ ] **Step 5: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): frente 5 - benchmark de kanban"
```

---

### Task 8: Frente 6 — benchmark de financeiro

**Files:**
- Modify: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (Frente 6: `### Como o mercado faz`, `### Recomendações`, `### Fontes`)

**Interfaces:**
- Consumes: seção "Como é hoje" da Frente 6 (Task 2).
- Produces: recomendações `FIN1..FINn`.

- [ ] **Step 1: Pesquisar os players**

WebSearch (mínimo):
- `Conta Azul funcionalidades contas a pagar receber conciliação`
- `Omie funcionalidades financeiro NFe contas`
- `Nibo funcionalidades gestão financeira`
- `Granatum funcionalidades fluxo de caixa`
- `QuickBooks accounts payable receivable features`
- `Sienge financeiro suprimentos funcionalidades`

Foco: acompanhamento de NF (status, vínculo com compra/conta), alertas e
régua de cobrança, aging/inadimplência, conciliação bancária, usabilidade de
baixa de contas, fluxo de caixa projetado vs realizado.

- [ ] **Step 2: Escrever "Como o mercado faz"**

Bloco por player (3-6 funcionalidades com fonte) — nos players já usados na
Frente 2 (Sienge), citar só o lado financeiro/suprimentos sem repetir o resto.

- [ ] **Step 3: Escrever a tabela "Recomendações" (IDs FIN1..FINn, mínimo 5)**

- [ ] **Step 4: Preencher "Fontes" e verificar**

Run: `grep -c "^| FIN[0-9]" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `5` ou mais

- [ ] **Step 5: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): frente 6 - benchmark de financeiro"
```

---

### Task 9: Frente 7 — análise técnica do agente de build/deploy

**Files:**
- Modify: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (Frente 7: `### Opções de como funcionaria`, `### Recomendações`, `### Fontes`)

**Interfaces:**
- Consumes: seção "Como é hoje" da Frente 7 (Task 2 — fluxo de deploy atual).
- Produces: recomendações `DEP1..DEPn`.

- [ ] **Step 1: Pesquisar as opções técnicas**

WebSearch (mínimo):
- `self-hosted deploy automation PHP git webhook vs SSH rsync`
- `database migration automation deploy PHP MySQL rollback`
- `GitHub Actions self-hosted runner on-premise deploy`

Contexto fixo da análise (vem do inventário): servidor on-premise na mesma
rede local; fluxo atual commit → push → webhook → `deploy.php`; migrations
manuais; `?v=`/`APP_VERSION` manuais; ambiente local sem MySQL; NUNCA tocar
`/etc/financeiro/config.php`, uploads, backups, banco.

- [ ] **Step 2: Escrever "Opções de como funcionaria"**

Comparar no mínimo 3 caminhos, cada um com: o que automatiza, pré-requisitos,
riscos, esforço:

```markdown
**Opção A — Automatizar as pontas do fluxo git/webhook atual:** script local
de pré-push (valida `php -l`/`node --check`, incrementa `?v=`+`APP_VERSION`)
+ `deploy.php` passa a rodar migrations pendentes com registro e backup.

**Opção B — Deploy direto pela rede local (SSH/rsync):** agente local builda,
valida e sincroniza com o servidor sem passar pelo GitHub; webhook vira
opcional. Exige chave SSH e disciplina de branch.

**Opção C — Runner de CI self-hosted (ex.: GitHub Actions runner na rede):**
pipeline formal com etapas de validação, deploy e rollback; maior setup.
```

Fechar com recomendação fundamentada de UMA opção (ou combinação) para o
contexto do ObraSync.

- [ ] **Step 3: Escrever a tabela "Recomendações" (IDs DEP1..DEPn, mínimo 5)**

Fatiar a opção recomendada em passos incrementais (cada linha = uma etapa
implementável por si só, ex.: `DEP1` validação pré-push, `DEP2` cache
busting automático, `DEP3` migrations automáticas com backup...).

- [ ] **Step 4: Preencher "Fontes" e verificar**

Run: `grep -c "^| DEP[0-9]" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `5` ou mais

- [ ] **Step 5: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): frente 7 - analise tecnica do agente de build/deploy"
```

---

### Task 10: Frente 8 — análise técnica da API + múltiplos frontends

**Files:**
- Modify: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (Frente 8: `### Opções de como funcionaria`, `### Recomendações`, `### Fontes`)

**Interfaces:**
- Consumes: seção "Como é hoje" da Frente 8 (Task 2 — roteamento e formatos da API atual).
- Produces: recomendações `API1..APIn`.

- [ ] **Step 1: Pesquisar as opções técnicas**

WebSearch (mínimo):
- `strangler fig pattern API migration legacy PHP`
- `PWA vs native app vs Capacitor comparison business app`
- `Electron vs Tauri vs installable PWA desktop app comparison`
- `REST API versioning OpenAPI documentation PHP`

- [ ] **Step 2: Escrever "Opções de como funcionaria"**

Cobrir, cada um com trade-offs no contexto do ObraSync (SPA + api/index.php
monolíticos, auth por token em header):

```markdown
**Backend:** o que falta para a API atual servir outros clientes —
padronizar respostas num formato único, rotas REST consistentes,
versionamento (`/api/v1/`), documentação OpenAPI, CORS, auth para mobile
(tokens de longa duração/refresh). Estratégia incremental (strangler):
padronizar módulo a módulo SEM quebrar o SPA — nunca big-bang.

**Mobile:** PWA (menor esforço, reusa o SPA responsivo) vs wrapper
Capacitor (app nas lojas reusando o web) vs nativo (maior esforço, só se
precisar de recursos de dispositivo).

**Desktop:** PWA instalável (praticamente grátis) vs Electron/Tauri (só se
precisar de integração com o SO).

**Ordem sugerida de migração** em etapas pequenas, cada uma testável.
```

- [ ] **Step 3: Escrever a tabela "Recomendações" (IDs API1..APIn, mínimo 5)**

Cada linha = etapa incremental (ex.: `API1` formato único de resposta,
`API2` inventário/documentação das rotas existentes, `API3` CORS + auth
mobile, ...). Coluna "Depende de" encadeando a ordem.

- [ ] **Step 4: Preencher "Fontes" e verificar**

Run: `grep -c "^| API[0-9]" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `5` ou mais

- [ ] **Step 5: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): frente 8 - analise tecnica da API e multiplos frontends"
```

---

### Task 11: Resumo executivo + fechamento + revisão final

**Files:**
- Modify: `docs/estudos/2026-07-estudo-benchmark-modulos.md` (seções `## Resumo executivo` e `## Fechamento — visão consolidada e ordem sugerida`; linha de Status no topo)

**Interfaces:**
- Consumes: todas as tabelas de recomendação (E, FC, G, AG, KB, FIN, DEP, API) das tasks 3-10.

- [ ] **Step 1: Escrever o "Fechamento — visão consolidada e ordem sugerida"**

Substituir `pendente` por: leitura transversal das 8 tabelas — dependências
entre frentes (ex.: padrão de erros antes das melhorias de UX que o usam;
padronização da API antes de mobile; deploy automatizado cedo porque barateia
todos os ciclos seguintes) e uma ordem sugerida de implementação em ondas
(Onda 1, Onda 2, ...), citando os IDs das recomendações. Lembrar a regra do
usuário: implementação sempre por etapas pequenas com validação.

- [ ] **Step 2: Escrever o "Resumo executivo"**

Substituir `pendente` por no máximo 1 página: o que foi estudado, os 5-8
achados mais importantes, e as recomendações de maior impacto (citar IDs).

- [ ] **Step 3: Revisão final do documento**

Checklist (corrigir inline o que falhar):

Run: `grep -c "^pendente$" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `0`

Run: `grep -c "| ⬜ |" docs/estudos/2026-07-estudo-benchmark-modulos.md`
Expected: `40` ou mais (8 frentes × ≥5 recomendações, todas com Decisão vazia)

- Conferir que toda frente tem seção "Fontes" com URLs;
- Conferir que nenhum ID de recomendação se repete;
- Atualizar a linha de Status no topo para: `**Status:** completo — aguardando decisões do usuário`.

- [ ] **Step 4: Commit**

```bash
git add docs/estudos/2026-07-estudo-benchmark-modulos.md
git commit -m "docs(estudo): resumo executivo, fechamento e revisao final do estudo"
```

---

## Após o plano

Com o documento completo, apresentar ao usuário para que marque a coluna
**Decisão** (sim/não) de cada recomendação. Os itens aprovados formam o
backlog priorizado; cada um segue seu próprio ciclo spec → plano →
implementação, **por etapas** (preferência registrada do usuário).
