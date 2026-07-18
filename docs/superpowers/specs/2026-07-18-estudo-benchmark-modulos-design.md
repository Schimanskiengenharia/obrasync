# Design — Estudo interno + benchmark de mercado dos módulos do ObraSync

**Data:** 2026-07-18
**Status:** aprovado em brainstorming (sessão 2026-07-18)
**Tipo de entrega:** documento de estudo (sem código nesta fase)

## Contexto

O usuário quer evoluir o ObraSync em várias frentes — padrão de verificação de
erros, fluxo comercial baseado em serviços, Gantt estilo MS Project, agenda,
kanban, financeiro (a pagar/receber, NF, compras), automação de build/deploy
para o servidor on-premise e a separação do backend em API para suportar
múltiplos frontends (mobile e desktop) — mas decidiu que, antes de qualquer
implementação, é preciso:

1. Ler todos os módulos do sistema e registrar como funcionam hoje;
2. Pesquisar como os grandes players do mercado resolvem cada frente;
3. Receber tudo consolidado para aprovar ou rejeitar cada melhoria proposta.

Este design descreve como esse estudo será produzido. Cada recomendação
aprovada no estudo vira, depois, seu próprio ciclo de spec → plano →
implementação.

## Entregável

Um único documento markdown: **`docs/estudos/2026-07-estudo-benchmark-modulos.md`**
(referência permanente no repo). Estrutura:

- **Resumo executivo** (1 página): o que foi estudado, principais achados,
  recomendações de maior impacto.
- **Uma seção por frente** (8 frentes). As Frentes 1-6 seguem o esqueleto de
  benchmark; as Frentes 7-8 são de **análise técnica** e trocam o passo 2 por
  "opções de como funcionaria, com trade-offs". Esqueleto:
  1. **Como é hoje** — inventário do módulo no ObraSync: telas, ações,
     tabelas, endpoints, limitações conhecidas;
  2. **Como o mercado faz** — funcionalidades dos players pesquisados, com
     fonte citada;
  3. **Recomendações** — tabela numerada para decisão do usuário, colunas:
     `# | Melhoria | Inspiração | Impacto | Esforço | Depende de | Decisão`.
     Impacto e Esforço usam a escala Alto/Médio/Baixo (impacto = valor para o
     usuário final; esforço = tamanho da implementação no ObraSync). Decisão
     começa vazia e o usuário marca sim/não.
- **Fechamento:** visão consolidada com ordem sugerida de implementação,
  considerando dependências entre frentes (ex.: padrão de erros primeiro,
  porque as demais melhorias o utilizam).

O usuário revisa a tabela de cada frente e marca sim/não por item.

## As 8 frentes

### Frente 1 — Padrão de verificação de erros

Sem players; o benchmark aqui é de boas práticas.

- *Inventário:* como o sistema trata erros hoje — `fail()`/`respond()` no PHP,
  `showToast()`/`apiRequest()` no JS, validações de formulário, comportamento
  em erro inesperado (tela branca? toast genérico? nada?), logs disponíveis.
- *Pesquisa:* boas práticas de mensagens de erro ao usuário (heurísticas de
  UX), captura global de erros JS/PHP, padrões de log para diagnóstico.
- *Saída extra:* o **roteiro de verificação sob demanda** — checklist que o
  agente percorre quando o usuário pedir "verificar erros" (fluxos principais
  cadastro → proposta → obra → financeiro, casos de borda, permissões). Nesta
  fase o roteiro é *definido*; executá-lo é ciclo futuro.

### Frente 2 — Fluxo comercial de serviços

Cadastro cliente/fornecedor → proposta → orçamento base da proposta →
cadastro da obra → orçamento da obra fechada (buscando descontos melhores).

- *Players:* Sienge, TOTVS Construção de Obras, Mega Construção, Obra Prima —
  como encadeiam comercial → obra → suprimentos.
- *Foco:* atritos e lacunas do fluxo atual do ObraSync vs o fluxo desejado.
  A base é **serviços**; produtos ficam para o futuro (fora de escopo).

### Frente 3 — Gantt / linha do tempo

Pagamentos, compras de materiais e marcos numa linha do tempo, estilo
MS Project.

- *Players:* MS Project, Primavera P6, Smartsheet, Monday.
- *Atenção:* já existe a spec de visão futura
  `docs/specs/cronograma-fisico-financeiro.md` — o estudo a lê e conecta,
  não duplica.

### Frente 4 — Agenda

Anotações, mudança de cor quando atrasado, botão de concluído.

- *Players:* Google Calendar/Tasks, Outlook, Todoist, TickTick — tratamento
  de atraso, conclusão, notas, recorrência, lembretes.

### Frente 5 — Kanban

- *Players:* Trello, Jira, Monday, ClickUp — limites de coluna (WIP),
  etiquetas, checklists no cartão, automações, filtros, swimlanes.

### Frente 6 — Financeiro

Contas a pagar/receber, fluxo de caixa, acompanhamento de notas fiscais e
compras.

- *Inventário:* módulos financeiros do ObraSync — pagar/receber (recorrência,
  quitação antecipada, vencidas/inadimplência), caixa e fluxo de caixa, OFX,
  notas fiscais/NFS-e e vínculos com contas, pedidos de compra e o ciclo
  cotação → conta a pagar → NF.
- *Players:* Conta Azul, Omie, Nibo, Granatum (gestão financeira BR, forte em
  pagar/receber, conciliação e NF-e) e QuickBooks (referência global) — e o
  lado financeiro/suprimentos do Sienge, aproveitando a pesquisa da Frente 2.
- *Foco:* acompanhamento de NF (status, vínculo com compra e com conta),
  visão de pagar/receber (alertas, régua de cobrança, aging/inadimplência),
  conciliação e usabilidade de baixa de contas.

### Frente 7 — Agente de build/deploy on-premise (análise técnica)

O servidor de produção é on-premise, na mesma rede local deste computador.

- *Inventário (como é hoje):* editar no PC → commit → push manual → webhook
  GitHub → `deploy.php` (git pull + backup pré-deploy); migrations rodadas
  manualmente no servidor; cache busting manual (`?v=` + `APP_VERSION`);
  hard refresh no navegador. Ambiente local sem MySQL/pdo_mysql (testes com
  banco só no servidor).
- *Análise (opções de como funcionaria):* um agente/rotina de build que
  valida (`php -l`, `node --check`), versiona o cache busting, faz o deploy
  e roda migrations automaticamente — comparando caminhos: manter o fluxo
  git/webhook e automatizar as pontas vs deploy direto pela rede local
  (SSH/rsync); rollback e backup; como testar com banco antes de subir.
- *Foco:* reduzir passos manuais e erros de deploy (migration esquecida,
  `?v=` não incrementado), mantendo as regras existentes (nunca tocar em
  `/etc/financeiro/config.php`, uploads, backups, banco).

### Frente 8 — Backend como API + múltiplos frontends (análise técnica)

O usuário quer, no futuro, frontends mobile e desktop além do web — o que
exige o backend separado em uma API consumível por qualquer cliente.

- *Inventário (como é hoje):* `api/index.php` único (~8,7 mil linhas) com
  roteamento misto (REST por path + `?module=&action=`), respostas em dois
  formatos (`respond()`/`fail()` vs `{success, data, message}`), auth por
  token em header, acoplamentos com o SPA (`app.js` monolítico).
- *Análise (opções de como funcionaria):* o que falta para ser uma API de
  verdade — padronização de respostas e rotas, versionamento, documentação
  (ex.: OpenAPI), CORS, auth adequada a mobile; opções de frontend mobile
  (PWA vs app nativo vs wrapper tipo Capacitor) e desktop (PWA instalável
  vs Electron/Tauri vs o próprio web); estratégia de migração incremental
  sem quebrar o SPA atual; esforço e riscos de cada caminho.
- *Foco:* mapa de decisão arquitetural — não é para reescrever nada agora,
  e sim saber qual caminho seguir e em que ordem.

## Método de execução (abordagem híbrida, aprovada)

1. **Inventário interno** — 8 agentes de leitura em paralelo (somente
   leitura, um por frente), varrendo `app.js`, `api/index.php`, `schema.sql`,
   migrations e docs. Cada um devolve o mapa estruturado da sua frente:
   telas, ações, tabelas, endpoints, limitações. O agente da Frente 3 também
   lê a spec do cronograma físico-financeiro; o da Frente 7 mapeia o fluxo
   de deploy (`deploy.php`, `backup-pre-deploy.sh`, scripts/); o da Frente 8
   mapeia o roteamento e os formatos de resposta da API.
2. **Benchmark de mercado / análise técnica** — Frentes 1-6: pesquisa web
   dirigida (3-5 players cada), extraindo funcionalidades com fonte citada.
   Frentes 7-8: pesquisa técnica das opções (ferramentas, arquiteturas) e
   comparação de trade-offs no contexto do ObraSync.
3. **Síntese** — consolidação no documento único: tabelas de recomendação
   com impacto/esforço/dependências e ordem sugerida de implementação.
4. **Apresentação** — o usuário recebe o doc, revisa e marca sim/não em cada
   recomendação.

## Critério de sucesso

O usuário consegue decidir cada item da tabela sem abrir o código nem
pesquisar por fora — o documento é autossuficiente.

## Fora de escopo desta fase

- Qualquer código, migration ou mudança de comportamento no sistema;
- Produtos no fluxo comercial (serviços primeiro; produtos bem mais à
  frente);
- Implementar o cronograma físico-financeiro (a spec própria continua
  valendo; o estudo só conecta);
- Executar o roteiro de verificação de erros (definido no estudo; rodar é
  ciclo futuro);
- Construir o agente de build/deploy (Frente 7 só analisa e recomenda);
- Separar a API ou criar frontends mobile/desktop (Frente 8 só analisa e
  recomenda o caminho).

## Próximos passos

1. Usuário revisa este design doc;
2. Plano de implementação do estudo (skill writing-plans);
3. Execução: inventário paralelo → benchmark → síntese → apresentação;
4. Decisões do usuário na matriz → backlog priorizado → ciclos de
   implementação por item aprovado.
