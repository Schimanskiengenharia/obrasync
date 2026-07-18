# Resultado da Revisao Adversarial (Codex) - 2026-07-18

## Veredito por recomendacao

| ID | Veredito | Justificativa (com arquivo:linha quando contestar) |
|----|----------|-----------------------------------------------------|
| E1 | CONFIRMADA | Nao ha handler global; as requisicoes so normalizam erros em `handleApiResponse` (`app.js:1893-1959`). Escopo baixo se houver deduplicacao/rate limit para o toast e o handler nao tentar reportar recursivamente a propria falha. |
| E2 | AJUSTAR | A lacuna e maior e mais heterogenea que as cinco linhas citadas: ha catches vazios tambem em `app.js:7664, 7748, 10613, 16403, 17609, 18833`. Nem todos devem virar toast (logout/refresh best-effort); classificar em log-only versus feedback. Remover dependencia de E1: erro capturado nao chega ao handler global. Impacto Medio, esforco Medio. |
| E3 | AJUSTAR | O alvo imediato existe em `app.js:8577-8582, 8710`, mas o app tem muitos outros `alert()` em fluxos de negocio (`app.js:3022-3488, 13459-14556`). Ou limitar E3 a `saveForm` (Baixo/Baixo), ou assumir migracao sistemica (Medio/Alto). `showToast` hoje nem recebe severidade (`app.js:18640`). |
| E4 | AJUSTAR | O 500 global realmente nao tem ID (`api/index.php:881-885`), mas E5 nao e dependencia: um correlation ID pode entrar no `error_log` atual e na resposta. Impacto Medio, esforco Baixo/Medio; nunca reutilizar UUID fornecido pelo cliente sem validacao. |
| E5 | CONTESTADA | A recomendacao mistura destino de log com tabela/endpoint no mesmo banco. Erros de conexao/SQL podem impedir justamente esse INSERT, e o codigo ja usa `error_log` de forma ampla (`api/index.php:13-16, 883-884`). Alternativa: JSON em arquivo/syslog dedicado, rotacao/retencao e redacao de segredos; tabela de aplicacao apenas para eventos operacionais que nao dependam da falha. |
| E6 | AJUSTAR | A lacuna existe, mas formularios genericos ja emitem `required` (`app.js:7473-7537`) e passam por `validateCurrentForm` (`app.js:8580, 8757`). Priorizar regras de negocio de maior erro e preservar validacao backend; E3 nao e dependencia tecnica. Impacto Medio, esforco Alto. |
| E7 | AJUSTAR | Dois envelopes coexistem (`api/index.php:962-970, 1783-1794`) e o SPA ja os normaliza (`app.js:1893-1927`), portanto o impacto atual e Medio/condicional a novos clientes. Fundir com API2 e migrar por handler, mantendo adaptador temporario. |
| E8 | AJUSTAR | Catalogo nao depende de E7. Mensagem 500 generica e protecao deliberada contra vazamento (`api/index.php:12-16, 881-885`); torna-la "acionavel" deve significar proximo passo + correlation ID, nao detalhe tecnico. Depende de E4, nao E7. |
| FC1 | AJUSTAR | A aprovacao ainda ocorre pela edicao de status (`api/index.php:657-675`) e os botoes pos-aprovacao so aparecem depois (`app.js:7243-7246`). Um botao com previa apenas de obra+orcamento e Baixo; incluir contas+contrato que ainda nao sao gerados depende de FC3 e eleva o esforco a Medio. |
| FC2 | CONFIRMADA | A copia grava somente 13 campos e fixa `origin='Item livre'` (`api/index.php:775-807`), embora `proposta_itens` preserve `orcamento_item_id` e `sinapi_id` (`app.js:16668-16686`). Reaproveitar `workBudgetItemId/orcamento_item_id` para buscar o item-fonte e a variante mais simples. |
| FC3 | AJUSTAR | Contas e contrato seguem em acoes separadas (`app.js:7243-7250`), mas criacao automatica exige parcelamento de `paymentTerms`, idempotencia, snapshot e transacao unica. Esforco Alto, nao Medio; depende de FC1, FC2 e do NOVO-1. Centro de custo deve ser opcao/politica, nao criacao cega. |
| FC4 | CONTESTADA | O fluxo nao esta desconectado a ponto de justificar um wizard monolitico: proposta ja nasce do orcamento (`app.js:16592-16627`), e cotacao de compra ja gera pedido dos vencedores (`app.js:14154-14233`). Um painel de "proxima acao" com links/contexto resolve a fragmentacao com muito menos acoplamento. Impacto Alto nao esta demonstrado para dev solo. |
| FC5 | CONFIRMADA | Os quatro recursos coexistem no mapa (`api/index.php:1821-1824, 1848`) e a ambiguidade e de rotulo/navegacao. Baixo esforco, desde que nao renomeie chaves/rotas persistidas. |
| FC6 | CONTESTADA | `proposta_grupos` esta dormente, mas o problema funcional ja e atendido por `proposta_orcamento_vinculos`: grupos guardam disciplina, descricao, BDI, custo e venda (`app.js:16638-16658`), e o documento ja cria secoes por disciplina (`app.js:15748-15771`). Ativar outra tabela duplicaria a fonte de verdade; evoluir o vinculo existente. |
| FC7 | AJUSTAR | O sistema ja compara menor valor e diferencas (`app.js:13294-13318, 14180-14217`). A lacuna real e historico temporal/negociacao. Isso requer modelo de rodada, validade, moeda/unidade e auditoria; esforco Alto e impacto Medio/Alto, nao uma simples evolucao Media. |
| FC8 | CONTESTADA | O back-link basico ja existe: `compraMatriz` parte de `workBudgetId`, lista itens do orcamento, compara fornecedores e gera pedido (`app.js:14154-14233`). O item deve ser reescrito como planejamento de necessidade por data/lead time e notificacao ao comprador, nao "alimentar cotacoes" novamente. |
| G1 | CONFIRMADA | O Gantt atual recebe apenas `projectSchedule` e desenha uma barra por etapa (`app.js:9890-9936, 9984-10020`); financeiro, pedidos e `projectMilestones` nao entram como camadas. Alto/Alto e honesto. |
| G2 | AJUSTAR | A lacuna visual/calculo existe, mas `predecessorIds` e `durationDays` ja sao persistidos e importados/exportados no XML (`schema.sql:186-207`, `app.js:10030-10145`). Reescrever como motor de dependencias (comecar por FS+lag), setas e recalc; os quatro tipos podem ser fase posterior. |
| G3 | CONFIRMADA | Nao ha CPM/baseline no schema atual; a propria spec declara caminho critico futuro (`docs/specs/cronograma-fisico-financeiro.md:247-275`). Depende de um motor G2 validado. |
| G4 | AJUSTAR | Baseline versionado nao existe e a spec exige historico (`docs/specs/cronograma-fisico-financeiro.md:227-247`). Esforco Alto, nao Medio: schema de snapshots, criacao atomica, comparacao e UI; entregar primeiro uma baseline unica somente leitura. |
| G5 | AJUSTAR | Etapas ja carregam valores previstos/realizados (`schema.sql:186-207`), mas curva S correta exige distribuicao temporal, calendario, pesos e contratos. Esforco Alto e dependencias G1/G6 + regras de medicao; "30/60/90/120" nao pode ser assumido universalmente. |
| G6 | CONFIRMADA | O modelo atual e plano (`sortOrder`, `stageName`) e nao possui parent/WBS (`schema.sql:186-207`). EAP e ponderacao demandam a spec e esforco Alto. |
| G7 | AJUSTAR | O Gantt e HTML calculado sem handlers de edicao (`app.js:9984-10020`); arrastar barras e desenhar ligacoes com snapping, validacao e rollback e Alto, nao Medio. Depende do motor G2; G1 nao e dependencia estrita para editar etapas. |
| G8 | AJUSTAR | Ja existe marcador de marco, mas como ponto em linha de etapa (`app.js:10014-10019`, `styles.css:2694`); `projectMilestones` separado nao e mesclado. Trocar so a forma e cosmetico (Baixo/Baixo); integrar a tabela real e o evento de cobranca e Medio/Baixo. |
| AG1 | AJUSTAR | `agenda_eventos` tem apenas `descricao` e nenhum historico/anexo (`schema.sql:277-297`). Historico + upload seguro nao reutilizam um TEXT: exigem tabelas, endpoints, permissoes e retencao. Esforco Alto; variante simples: ampliar descricao sem "rica"/anexos. |
| AG2 | AJUSTAR | Atraso manual realmente nao recebe a regra aplicada aos financeiros (`app.js:9262-9287, 9312-9339`). Esforco Baixo, mas impacto Medio, nao Alto; excluir realizado/concluido/cancelado e usar data local. |
| AG3 | AJUSTAR | O card nao oferece conclusao rapida e a atualizacao existe, mas o enum ja aceita `realizado` e `concluido` (`schema.sql:284-290`); nao ha dependencia de "padronizar enum". Impacto Medio, esforco Baixo. |
| AG4 | CONFIRMADA | Nao ha coluna/regra de recorrencia em `agenda_eventos` (`schema.sql:277-297`) nem gerador no handler (`api/index.php:1555-1611`). Alto/Alto; modelar serie + excecoes, nao apenas gerar copias infinitas. |
| AG5 | AJUSTAR | `lembrete_minutos` e gravado (`api/index.php:1564-1585`), mas o cron so possui alertas financeiros D-3 e grava notificacao "Preparado" (`api/cron/jobs.php:79-113`). Disparo real requer canal/worker compartilhado com FIN6/KB9; esforco Alto, nao Medio. |
| AG6 | CONFIRMADA | A grade semanal so liga editar/excluir (`app.js:9222-9234`), e o update aceita `data_inicio/data_fim` (`api/index.php:1591-1611`). Medio/Medio e plausivel. |
| AG7 | AJUSTAR | A tela ativa e exclusivamente semanal (`app.js:9187-9225`); labels auxiliares nao equivalem a layouts Dia/Mes. Esforco Alto para duas visoes responsivas, navegacao, intervalos e densidade; entregar Mes primeiro ou lista mensal. |
| AG8 | CONFIRMADA | Nao ha `cor` no schema/handler da agenda (`schema.sql:277-297`, `api/index.php:1624-1638`); cores atuais sao mapa fixo financeiro (`app.js:9290-9301`). Medio/Medio. |
| AG9 | CONFIRMADA | Nao existe painel agregado/lote na renderizacao semanal (`app.js:9187-9255`). Medio/Medio, depois de AG2/AG3; a alternativa 80/20 e um contador com filtro, antes de conclusao em lote. |
| KB1 | CONFIRMADA | A UI so seleciona quadro e cria/edita card (`app.js:9150-9185`), embora CRUD generico para boards/columns exista (`api/index.php:1831-1833`). Medio, com protecao para excluir coluna que contem cards. |
| KB2 | AJUSTAR | O limite so e exibido (`app.js:9692-9699`) e o drop atualiza sem checar (`app.js:9726-9733`). KB1 nao e dependencia; implementar aviso visual primeiro, coerente com as fontes, e validar novamente no backend contra corrida. |
| KB3 | AJUSTAR | O schema do card nao tem tags (`schema.sql:320-338`). Para etiquetas reutilizaveis + filtro, esforco Alto (catalogo + N:N + UI), e impacto Medio para o publico atual; uma prioridade colorida ja existe. |
| KB4 | AJUSTAR | Nao ha checklist no card (`schema.sql:320-338`). Checklist simples e Medio; prazo/responsavel por item transforma em subtarefas e eleva para Alto. Separar fases. |
| KB5 | AJUSTAR | Comentarios, mencoes, notificacao e anexos sao quatro superficies; nenhuma esta no modelo (`schema.sql:320-338`). Esforco Alto, com upload fora do docroot e autorizacao; comecar por comentarios sem mencao/anexo. |
| KB6 | AJUSTAR | A fragilidade e real: backend decide por nome (`api/index.php:14136-14141`) e front repete a regra (`app.js:9731-9733, 9774`). KB1 nao e dependencia; flag + migration + `ensure_*` pode vir antes. Impacto Medio/Alto, esforco Baixo. |
| KB7 | CONFIRMADA | O drop grava `ordem=Date.now()` (`app.js:9726-9733`) e nao calcula vizinhos. Medio/Baixo, mas normalizar posicoes no backend para evitar empates/crescimento. |
| KB8 | AJUSTAR | Hoje ha apenas confirmacao e aviso, sem update da origem (`app.js:9731-9734`). Sincronizacao generica exige handlers idempotentes por `referencia_tipo`, autorizacao e regra de reversao; esforco Alto. Depende de KB6 e de mapa explicito de tipos. |
| KB9 | AJUSTAR | Cron nao consulta `kanban_cards` (`api/cron/jobs.php:25-31, 79-114`). Notificar de verdade depende da mesma infraestrutura de entrega de AG5/FIN6; esforco Alto. Sem canal, variante 80/20 e painel/dashboard, que ja destaca urgentes (`app.js:4856`). |
| FIN1 | AJUSTAR | Status Parcial existe, mas nao ha valor/saldo de baixa (`app.js:1226-1243`; `schema.sql:680-747`). Uma coluna acumulada nao e trilha financeira suficiente: criar lancamentos de liquidacao, estorno, saldo derivado e integrar caixa/OFX/DRE/cron. Esforco Alto. |
| FIN2 | AJUSTAR | A lacuna existe, mas lote deve ser transacional por titulo, tratar falha parcial e herdar a conta/data/valor da liquidacao de FIN1. Esforco Alto para pagar+receber mistos; Medio apenas para baixa integral homogenea. |
| FIN3 | CONFIRMADA | O eixo esta fixo por constantes em 6+6 meses (`app.js:4027-4039`) e `renderCashFlow` nao oferece controle (`app.js:16842-16860`). Medio/Baixo. |
| FIN4 | CONTESTADA | Projetado x realizado ja existe: entradas e saidas previstas/realizadas sao series e colunas separadas (`app.js:16842-16859`). A lacuna e somente cenarios/simulacao; reescrever como "cenarios hipoteticos sem alterar titulos", com impacto Medio e esforco Alto. |
| FIN5 | CONTESTADA | `consolidate_monthly_dre` soma `journal_entries` em um unico total (`api/cron/jobs.php:116-146`), enquanto o DRE atual separa competencia, caixa, pendencias e repasses (`app.js:17698-17729`). Consumir essa consolidacao perderia semantica. Criar endpoints on-demand a partir das fontes atuais; nao acoplar o relatorio ao snapshot mensal. |
| FIN6 | CONFIRMADA | O cron atual cria apenas alerta D-3 interno, sem envio (`api/cron/jobs.php:79-113`). Alto/Alto e honesto; depende primeiro de consentimento, templates, canal, tentativas e opt-out, nao necessariamente de multa/juros. |
| FIN7 | CONFIRMADA | Nao ha aging por faixas; dados e helper de atraso existem (`app.js:3753-3778, 4151-4168`). Medio/Baixo, preferencialmente calculado no backend se o bootstrap for fatiado. |
| FIN8 | CONTESTADA | A recomendacao descreve o que ja esta implementado: dedupe por FITID/conta (`api/index.php:7237-7255, 7398-7415`), valor exato + janela de +/-5 dias + confianca (`api/index.php:7307-7360`) e sugestao confirmada na UI (`app.js:17056-17069, 17111-17125`). Restaria apenas tornar janela/pesos configuraveis e melhorar criterio textual. |
| FIN9 | CONFIRMADA | `cashMoves` aceita somente `payableId`, cria Saida e baixa `accounts_payable` (`api/index.php:5941-5998`); o front tambem oferece apenas conta a pagar (`app.js:6842-6887`). A simetria e Medio/Baixo, com transacao e anti-dupla vinculacao. |
| DEP1 | AJUSTAR | So ha hook de exemplo em `.git/hooks`; validacoes continuam manuais (`CLAUDE.md:278-283`). Versionar hook via `core.hooksPath`/script instalador. Impacto Medio, pois `--no-verify` e outra maquina contornam; esforco Baixo. |
| DEP2 | CONTESTADA | `pre-push` ocorre depois do commit: alterar `app.js/index.html` ali deixa mudancas fora do commit que esta sendo enviado. Alem disso, cache key `1798` e versao semantica `v1.34.0` nao sao o mesmo contador (`index.html:17,363`; `app.js:22`). Usar hash do commit/build no URL ou comando de release antes do commit. |
| DEP3 | AJUSTAR | O deploy realmente ignora exit nao zero (`deploy.php:31-49`), mas apenas abortar nesse codigo nao basta: o script usa so `set -u`, tolera credencial/uploads ausentes e termina 0 apos erros (`backup-pre-deploy.sh:11, 41-67`); o pipeline `mysqldump \| gzip` nao usa `pipefail`. Primeiro tornar backup atomico, validar arquivos nao vazios e propagar falha; esforco Medio. |
| DEP4 | AJUSTAR | Nao ha `schema_migrations`, mas 61 DDLs + auto-cura e MySQL sem rollback DDL tornam execucao automatica mais arriscada que "Medio". Esforco Alto; depende de DEP3 ajustado, lock de deploy, credencial restrita, checksum/ordem e teste em copia. Nunca marcar aplicada apos falha parcial. |
| DEP5 | AJUSTAR | A verificacao atual so olha existencia de caminhos (`deploy.php:51-71`). Healthcheck nao depende de DEP4: criar rota sem banco destrutivo + verificacao de banco e commit/versao. Esforco Baixo/Medio; comparar commit publicado e mais robusto que `APP_VERSION` manual. |
| DEP6 | CONTESTADA | Restaurar automaticamente "ultimo dump/uploads" por falha de healthcheck pode apagar dados gravados apos o backup e conflita com migrations forward-only. O guia proibe operacao direta em banco/uploads (`CLAUDE.md:210-217`). Automatizar rollback apenas do codigo; manter restore de dados como runbook testado e decisao humana. |
| DEP7 | CONTESTADA | PhpSpreadsheet e `pdftotext` sao dependencias opcionais com degradacao explicita 422 (`api/index.php:3428-3429, 3490-3492`); abortar todo deploy por sua ausencia bloqueia modulos nao relacionados. Fazer healthcheck com aviso/estado de capacidade; abortar somente se o release declarar a dependencia obrigatoria. Nao depende de DEP4. |
| DEP8 | AJUSTAR | Log de deploy ja existe com backup, pull e verificacao (`deploy.php:60-67`). A lacuna e status confiavel/run ID/commit e notificacao de falha. Nao depende de DEP5 para estruturar o log; impacto Baixo, esforco Baixo. |
| API1 | AJUSTAR | O roteamento mistura bloco inline e handlers (`api/index.php:79-235, 1797-1879`); documentar schemas/erros/permissoes de todos os recursos e Alto, nao Medio. OpenAPI nao e "base de teste" por si so: gerar contract tests executaveis e validar o documento no CI. |
| API2 | AJUSTAR | Mesmo alvo de E7; manter um unico ID/backlog. A divergencia e real (`api/index.php:962-970, 1783-1794`), mas impacto Alto so quando houver segundo cliente. Migracao por fachada/adaptador, esforco Alto. |
| API3 | AJUSTAR | CORS/preflight nao existem (`api/index.php:9-16, 79-83`), mas o produto atual e same-origin (`app.js:5-8`), logo impacto e condicional/Medio. Nao depende de API1; exigir allowlist configuravel, `Vary: Origin`, metodos/headers minimos e nunca `*` com credenciais/tokens. |
| API4 | AJUSTAR | Nao ha versionamento, mas API2 nao e dependencia: uma fachada `/api/v1` pode preservar envelopes legados. Impacto Baixo/Medio ate existir cliente externo; depende de inventario/contrato API1 e estrategia de deprecacao. |
| API5 | CONTESTADA | CRUD generico ja suporta `limit`/`offset` com teto 5000 (`api/index.php:1953-1963`), e o bootstrap ja limita tabelas SINAPI pesadas (`api/index.php:2620-2649`). A lacuna real e bootstrap lazy por modulo, metadados `total/next` e uso da paginacao pelo SPA; nao depende de API4. |
| API6 | AJUSTAR | Sessao stateful ja usa Bearer, hash, idle e TTL absoluto (`api/index.php:8809-8887`), portanto serve um cliente mobile online; 30 min pode ser ajustado sem JWT. Refresh token rotativo so apos threat model/cliente real. Depende de contrato de auth/API1, nao de CORS; impacto condicional, esforco Alto. |
| API7 | AJUSTAR | Nao ha manifest/service worker (`index.html:1-18`), mas PWA same-origin nao depende de API3 nem API5. "Instalavel online" e Medio/Medio; offline confiavel com dados financeiros, invalidacao e fila de mutacoes e Alto. Impacto Medio, separar as duas fases. |
| API8 | AJUSTAR | Capacitor reutiliza UI, nao elimina assinatura de lojas, storage seguro, deep links, permissoes, politica de privacidade, push/camera e testes nativos. Esforco Alto, impacto condicional; depende de API7 apenas para maturidade web, e de API6 se exigir sessao mobile persistente. |

## Itens novos propostos

| ID | Descricao | Evidencia (arquivo:linha) | Impacto | Esforco |
|----|-----------|---------------------------|---------|---------|
| NOVO-1 | Tornar a criacao completa da proposta atomica em um endpoint (cabecalho + vinculos + historico + itens + variaveis), com idempotency key. Hoje cada registro e uma requisicao; falha intermediaria deixa proposta parcial. | `app.js:16620-16634, 16638-16695` | Alto | Alto |
| NOVO-2 | Parar de descartar silenciosamente campos em `insert_dynamic/update_dynamic`: em operacoes de negocio, registrar/recusar colunas inesperadas e expor schema drift. | `api/index.php:14197-14218` | Alto | Baixo |
| NOVO-3 | Criar testes automatizados minimos para os fluxos financeiros/comerciais e smoke tests do deploy. O handoff exige apenas sintaxe e nao ha suite no repositorio. | `CLAUDE.md:278-283`; `api/index.php:657-843`; `api/index.php:7368-7457` | Alto | Alto |
| NOVO-4 | Serializar deploys com lock e verificar exit code/commit do `git pull`; hoje `shell_exec` pode falhar e o webhook ainda responder "Deploy OK" se os caminhos existirem. | `deploy.php:48-73` | Alto | Baixo |

## Redundancias encontradas

- **E7 = API2**: duplicata integral; manter um unico item com duas motivacoes (UX de erro e clientes externos).
- **AG5 + KB9 + FIN6**: os gatilhos diferem, mas scheduler, fila, tentativas, templates, preferencias e canais de entrega sao uma plataforma compartilhada. Implementa-la uma vez e cadastrar tipos de notificacao.
- **FC6 e o agrupamento ja feito em `proposta_orcamento_vinculos`**: nao e apenas redundancia entre recomendacoes; e uma segunda modelagem para capacidade existente (`app.js:16638-16658`).
- **G1 e G5** compartilham a mesma normalizacao temporal/custo-carregada. A curva S deve consumir o motor/dataset de G1/G6, nao recalcular valores em paralelo.
- **DEP5 e DEP8** compartilham o conceito de uma execucao de deploy identificavel; healthcheck, commit, logs e notificacao devem usar o mesmo `deploy_run_id`.

## Critica a ordem em ondas

A Onda 0 nao deve ser executada como escrita.

1. **Antes dela, integridade:** NOVO-3 (ao menos smoke/contract tests), NOVO-4 e DEP3 ajustado. Automatizar migrations ou rollback sem testes, lock e backup realmente valido aumenta o raio de falha.
2. **Remover DEP2 da onda:** a solucao no `pre-push` e tecnicamente incorreta. Substituir por cache key derivada do commit/deploy.
3. **E2 nao depende de E1:** eliminar/classificar catches vazios deve ocorrer antes ou junto de E1; handler global nao observa promessas ja capturadas e engolidas.
4. **FC1 simples pode vir cedo**, mas a previa prometida deve mostrar apenas efeitos atuais. FC1 completo espera NOVO-1/FC2/FC3.
5. **KB6, FIN3, FIN7 e FIN9** continuam boas vitorias iniciais. AG2/AG3 sao uteis, mas impacto e Medio, nao Alto.
6. **DEP4 deve sair da Onda 1:** migrations automaticas so depois de backup validado, lock, checksums e testes; classificar como estrutural.
7. **API3 nao e fundacao para PWA same-origin:** fazer CORS apenas quando existir origem autorizada concreta. API5 ajustado (bootstrap lazy) e mais importante para rede movel.
8. **G8 nao precisa esperar o Gantt completo**, mas integrar `projectMilestones` e diferente de apenas trocar um ponto por losango.

Ordem revisada sugerida: (A) integridade/transacoes/testes/deploy; (B) correcoes pequenas comprovadas E2/E3/KB6/FIN3/FIN7/FIN9/AG2/AG3; (C) atomizar proposta e enriquecer aprovacao; (D) plataforma de notificacoes; (E) cronograma e API por contratos/fatias.

## Recomendacoes sustentadas so por marketing

- **FC1-FC8:** todas usam exclusivamente paginas comerciais, blogs de fabricante/parceiro ou fichas de produto nas fontes da Frente 2 (`docs/estudos/2026-07-estudo-benchmark-modulos.md:178-186`). As lacunas internas podem ser reais, mas alegacoes como "fluxo unico", geracao automatica e varias visoes nao foram verificadas em documentacao operacional independente.
- **FIN5:** Granatum [15] e Omie [6] sao paginas de funcionalidades; nao sustentam que o snapshot `consolidate_monthly_dre` do ObraSync seja a arquitetura correta.
- **FIN6:** Nibo [11] e Omie [6] sao paginas comerciais. A necessidade de cobranca pode ser real, mas entregabilidade, consentimento, custo de WhatsApp e taxa de sucesso nao foram evidenciados.
- **AG7:** a unica fonte numerada especifica da linha e a pagina geral de features do TickTick [9]; "Google/Outlook" aparece sem referencia. As visoes Dia/Mes sao convencao conhecida, mas o ganho para os usuarios atuais nao foi medido.

Observacao adicional: G1/G5 usam em parte consultorias e conteudo de fornecedores, nao estudos de resultado. Isso nao invalida os padroes de cronograma, mas nao prova impacto Alto no ObraSync.

## Resumo: top 5 contestacoes mais importantes

1. **FIN8:** dedupe por FITID, janela de +/-5 dias, confianca e sugestao confirmavel ja existem; a recomendacao repete o codigo atual.
2. **FC6:** agrupamento/disciplinas/visoes ja usam `proposta_orcamento_vinculos`; ativar `proposta_grupos` cria duas fontes de verdade.
3. **API5:** paginacao `limit/offset` ja existe e SINAPI ja e recortado; o problema restante e bootstrap lazy + contrato de pagina.
4. **DEP2:** um `pre-push` nao pode versionar corretamente arquivos do commit que ja foi criado; cache key e versao semantica tambem nao devem ser o mesmo contador.
5. **DEP6:** restore automatico de banco/uploads em falha de healthcheck arrisca perda de dados novos; rollback automatico deve se limitar ao codigo.

O risco transversal mais urgente, embora seja **AJUSTAR** e nao CONTESTADA, e DEP3: o backup atual pode imprimir erro e ainda sair com codigo 0, portanto "abortar se o script falhar" nao protege nada ate o proprio script propagar e validar a falha.
