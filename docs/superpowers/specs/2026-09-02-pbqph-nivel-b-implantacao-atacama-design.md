# Implantação PBQP-H Nível B no Condomínio Atacama — desenho (EM ANDAMENTO)

> **Data:** 2026-09-02 · **Atualizado:** 2026-10-07 · **Status:** Seção 1 aprovada; **Seção 2 (E0)
> fechada fora desta spec** (S1 da sessão de segurança, v1.47.0, commits `b308307`/`82c674a`,
> validado em produção); **Seção 3 (E1) EXECUTADA** (commits `80da4fc`, `97153fe`, `8a74e78`,
> aguardando validação do dono). Próxima: **Seção 4 (E2)**, que depende da saída do script
> `scripts/sql/2026-10-07-pbqph-contagens-reais.sql` (blocos 4 e 5) para a biblioteca de materiais.

## Decisões do dono — 2026-10-07 (E1)

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Onde o PES exibe aprovador e data (não havia PDF gerado do PES) | **(a)** "Exportar PDF" do PES via `qualidadePrint`, molde de Política/PQO, com bloco "Aprovado por / em" |
| 2 | Histórico do PQO com `uk_pqo_project` (uma linha por obra) | **(a)** tabela aditiva `qualidade_pqo_versoes` com snapshot JSON do estado anterior; UNIQUE intacto; só o backend grava; recurso somente leitura |
| 3 | Origem da biblioteca de ~20 materiais | **(b) ajustada:** proposta cruzando a lista de referência do SiAC com os nomes reais já digitados (blocos 4 e 5 do script de contagens), indicando quais têm procedimento e a origem das faixas 40/50/25%; o dono revisa antes do commit. É E2, não bloqueia E1 |
| 4 | DELETE de FVS/NC deixando `qualidadeBloqueada=1` órfão | **(a)** bloquear DELETE de registro com status final (FVS/FVM Aprovada/Reprovada, NC Fechada); no DELETE permitido, recalcular o gate da etapa |
| E1-PES | Quem aprova | `aprovadoPor` = **nome do usuário logado** que torna o PES Vigente, gravado no backend (padrão da assinatura do RDO), sem campo de digitação; `dataAprovacao` = `date('Y-m-d')` do PHP; VARCHAR por consistência com Política/PQO |

## Seção 3. E1 — Pacote 7.5 (EXECUTADA em 2026-10-07)

- **PES:** `aprovadoPor`/`dataAprovacao` (migration `2026-10-07-pbqph-e1-pes-aprovacao.sql` +
  `ensure_pes_aprovacao_columns`), decisão pura `qualidade_pes_aprovacao_plano()`; form mostra a
  aprovação como texto; lista com as duas colunas; "Exportar PDF" (`qPesPrintHtml`, pura).
- **PQO:** `qualidade_pqo_versoes` (migration `2026-10-07-pbqph-e1-pqo-versoes.sql` +
  `ensure_pqo_versoes_table`), decisão pura `qualidade_pqo_snapshot_necessario()` (anterior
  Vigente e versão mudou ou saiu de Vigente), painel "Histórico de versões" com impressão do
  snapshot (`qPqoPrintHtml` compartilhada).
- **Caronas:** 9.1.1/9.1.2/9.1.3 no `CHECKLIST_SIAC_NIVEL_B` (26 cláusulas); `qProximaVersao()`
  (fallback 1 → 1.1); `criar_nc_automatica` com data do PHP; `qualidade_delete_bloqueado()` +
  `qualidade_recalcular_gate()`/`qualidade_gate_estado()`; engenharia/gestor_obra com view em
  Política e Auditorias; operador com view em FVS/FVM/NC no backend.
- **Fora do E1 (fica para E5, como a spec previa):** campos mínimos obrigatórios da FVM no
  servidor (lote, responsável, `fornecedorId`) — o dono os colocou no E5.
- **Testes:** `test_qualidade_regras.php` (60) e `test_qualidade_front.js` (47) — primeiros do módulo.
- **Servidor:** rodar as 2 migrations (o `ensure_*` cobre, mas rodar dá consistência).
>
> **Base:** `docs/revisao/2026-09-pbqph-nivel-b-diagnostico.md` (§1-§6.3) — este spec não repete o
> diagnóstico; só desenha o que fazer. Guia simplificado do SiAC recebido em 2026-09-02 (não está
> no repo).

## Decisões já tomadas (2026-09-02)

- **Obra-alvo:** Condomínio Atacama, execução no canteiro **em até 1 mês**.
- **Escopo do plano:** código **+** implantação operacional, em duas trilhas paralelas.
- **Abordagem escolhida: A** — operar com o que existe no dia 1; código em 5 etapas pequenas, cada
  uma com deploy e validação, na ordem do que precisa existir antes do primeiro registro.
  Descartadas: B (só operar, sem código — registros nasceriam com o furo do 7.5: PES sem aprovador,
  FVM aceita ficha vazia) e C (construir tudo antes — não cabe em 1 mês com validação por etapa).
- **Congelamento de frentes (2026-07-29) continua valendo para todo o resto.** Este pedido explícito
  descongela **só** a frente PBQP-H.
- Regras permanentes: migrations só aditivas; dados de produção intocáveis; implementação fatiada
  com validação por etapa; teste puro (`node --check` + teste próprio) para cada cálculo novo.

---

## Seção 1. Trilha operacional (Atacama, semanas 0 a 4) — APROVADA

O que a empresa faz **no sistema que já existe**, semana a semana.

### Semana 0 — decisões em documento, fora do sistema por enquanto

- **Lista de serviços da empresa:** dos 27 do SiAC, marcar quais a empresa executa no Atacama e
  quais os 11 que recebem procedimento primeiro. Serviços de início de obra entram na primeira
  leva: compactação de aterro, locação, fundação, fôrma, armadura, concretagem. Telhado, elétrica e
  hidrossanitária entram na leva seguinte, quando a obra chegar lá.
- **Lista de 20 materiais controlados** com nome padronizado, um por linha, indicando quais 10 têm
  procedimento de inspeção. **Esses nomes exatos viram a biblioteca da etapa 2 de código** — a lista
  é escrita uma vez e não muda de grafia (é o que evita migração de dado depois).
- **Escopo do SGQ, organograma e Política da Qualidade** em texto curto. A Política entra no sistema
  já nesta semana como versão **Vigente** (Qualidade → Política).

### Semana 1 — cadastros no sistema

- Obra **Condomínio Atacama** em Projetos, com o cronograma por etapas. Cada etapa de serviço
  controlado recebe o `servicoSiacId` — é isso que liga o gate de conclusão à FVS.
- **PQO do Atacama em Rascunho:** responsável técnico e CREA, serviços marcados na lista dos 27,
  materiais digitados com os nomes da semana 0.
- Fornecedores principais de material controlado passam pelo **modal de qualificação PBQP-H**
  (status + validade).

### Semana 2 — procedimentos e treinamento

- **PES dos serviços da primeira leva**, com critérios de aceitação **um por linha** (cada linha
  vira item da FVS). PDF do procedimento anexado.
- **Treinamento** das equipes desses serviços registrado no módulo, por obra e serviço.
- Quando a **etapa 1 de código** estiver no ar, cada PES recebe aprovador e data e passa a Vigente.

### Semanas 3 e 4 — primeiros registros

- **PQO salvo como Vigente** (o sistema valida 11 serviços / 10 materiais nesse momento).
- Primeiro recebimento de material controlado com **FVM** preenchida com lote, nota fiscal e
  responsável.
- Primeira **FVS** na primeira etapa concluída, com assinaturas do executor e do inspetor.

### Durante a obra — rotina

- FVM a cada recebimento de material da lista. FVS a cada etapa de serviço controlado. NC sempre
  que uma ficha reprovar.
- **Mês 2:** auditoria interna (tela de Auditorias), reunião de análise crítica com ata (M2),
  documento de objetivos com indicador (M1).
- **Mês 3:** com dois meses de registro, pedir proposta a dois ou três OAC.

### Alerta que muda o guia

Os **3 serviços observáveis** na Fase 2 são os que estiverem em execução no dia da auditoria, não
necessariamente telhado/elétrica/hidrossanitária. No Atacama isso depende de onde a Fase 2 cair no
cronograma. **O painel calcula os observáveis pelas etapas em andamento, não por lista fixa**
(substitui a regra C13 do diagnóstico §6.3).

---

## Seções pendentes (a apresentar, uma por vez, com aprovação)

Esqueleto acordado na escolha da abordagem A. Cada etapa de código = 1 ciclo deploy + validação.

| Seção | Etapa | Conteúdo previsto | Quando entra |
|---|---|---|---|
| 2 | **E0 — Segurança do PDF do PES** | `arquivoPdf` gravável via PUT genérico + `readfile()` sem confinar ao upload_dir (diagnóstico §4 item 8a). Ciclo próprio e curto. | Antes de tudo |
| 3 | **E1 — Pacote 7.5** | `aprovadoPor`/`dataAprovacao` no PES (2 colunas aditivas + form + Vigente exige aprovador); campos mínimos obrigatórios na FVM no servidor (`responsavelRecebimento` + `lote` ou `notaFiscal` + ≥1 item) quando `resultado` preenchido; bloquear DELETE de FVS/FVM/NC com status final; 9.1.1/9.1.2/9.1.3 no `CHECKLIST_SIAC_NIVEL_B`; obsoletar PQO anterior ao salvar Vigente. | **Antes da primeira FVS/FVM** (semana 2-3) |
| 4 | **E2 — Biblioteca + metas derivadas** | Constante no app.js: 27 serviços e ~20 materiais com flag **executa/não executa**; PQO seleciona materiais da biblioteca (casando por nome normalizado com o que já foi digitado — sem migração); metas por `ceil` (40%/50%/25%) no lugar de `QUALIDADE_METAS` 11/10. | Semana 3-4 |
| 5 | **E3 — Painel de prontidão** | Seção no topo do `renderQualidadeDashboard`: C1-C14 calculados das coleções já carregadas, gates (política, auditoria no ano, análise crítica, ≥2 meses de registro), % geral por média simples, colunas Fase 1 / Fase 2. Função pura + teste JS. | Mês 1 |
| 6 | **E4 — Requisitos manuais** | Tabela `qualidade_requisitos` (M1-M8, status, responsável, data, anexo) + upload no molde do PDF do PES + tela simples dentro da Qualidade. | Mês 1-2 (antes da auditoria interna) |
| 7 | **E5 — Avisos em compras** | Aviso (não bloqueio) no pedido com fornecedor `nao_avaliado`/suspenso; aviso de recebimento (`comprasregistrar`) sem FVM para material da biblioteca. Depende da E2. | Mês 2 |

Depois da Seção 7: validação/teste/deploy/constraints, self-review do spec, revisão do dono, e
então o skill `writing-plans` gera o plano de implementação da E0/E1.
