# Diagnóstico — Módulo de Qualidade × Regimento SiAC 2021 (Nível B)

> **Data:** 2026-09-01 · **Tipo:** diagnóstico (só leitura) · **Base de código:** v1.46.0 (commit 97c1401)
>
> **Referência normativa:** SiAC 2021 (Portarias 75 e 577/2021, Anexos 1, 3 e 4), decisão de mirar o
> **Nível B**, subsetor Edificações. Números do Nível B usados aqui (fornecidos pelo dono a partir do
> guia simplificado): **11 serviços** com procedimento (40% da lista de 27), **6 com registros**,
> **3 observáveis na obra**; **20 materiais** na lista, **10 com procedimento** de inspeção,
> **5 com registro**, **3 observados**. Auditoria pode ser em uma obra só (Asilo).
>
> ⚠️ **Limitações desta rodada:** (a) o guia simplificado citado "em anexo" não está gravado no repo —
> este doc usa os números acima como dados; onde a aplicabilidade de uma cláusula no Nível B depende
> do texto exato do Anexo 3, isso está sinalizado; (b) **o banco de produção não estava acessível**
> desta máquina (SSH 192.168.1.100 sem rota nesta rede; a API pública exige login) — as contagens do
> item 5 estão como **SQL pronto para rodar no servidor**, não como números.

---

## 1. O que existe hoje

### 1.1 Tabelas `qualidade_*` (8 tabelas — schema.sql:1862-2034, `ensure_qualidade_tables` api/index.php:7224-7401)

| Tabela | Campos-chave reais | O que a tela permite (app.js:12401-13685) |
|---|---|---|
| `qualidade_politica` | conteudo, versao, status (Rascunho/Vigente/Obsoleto), **aprovadoPor, dataAprovacao** | Nova versão (default = vigente + 0.1), editar/excluir, exportar PDF gerado. Salvar como Vigente obsoleta as anteriores (backend, index.php:7551). |
| `qualidade_pes` | servicoSiacId, servicoNome/Grupo, versao, status (R/V/O), objetivo, materiaisNecessarios, equipamentosEpi, procedimento, **criteriosAceitacao** (1 linha = 1 item da FVS), normasReferencia, **responsavelElaboracao/dataElaboracao**, **arquivoPdf/arquivoNome/arquivoData** (Fase 1) | CRUD, upload/download do PDF do procedimento (máx 10 MB, `?module=procedimentosExecucao`). Vigente obsoleta versões anteriores do MESMO serviço. **NÃO tem aprovadoPor/dataAprovacao** — só elaborador. |
| `qualidade_pqo` | projectId (**UNIQUE — 1 PQO/obra**), versao, responsavelTecnico, crea, escopo, **servicosControlados LONGTEXT (JSON de ids)**, **materiaisControlados LONGTEXT (JSON `{nome, especificacao, norma}` texto livre)**, metasQualidade TEXT, status (Rascunho/Vigente/Encerrado), aprovadoPor, dataAprovacao | CRUD + impressão do PQO. Serviços = checkboxes dos 27 SiAC (badge "PES vX" ou "sem PES vigente"); materiais = linhas digitadas à mão, **sem biblioteca**. Validação 11 serviços / 10 materiais **só ao salvar como Vigente**. |
| `qualidade_fvs` | projectId, pqoId, **etapaId**, pesId, servicoSiacId, itensVerificacao (JSON, gerados dos critérios do PES), resultado, **assinaturaExecutor/assinaturaInspetor** (texto, validadas no servidor), status derivado (Pendente/Preenchida/Aprovada/Reprovada), datas, responsáveis, ação corretiva | CRUD com filtro de obra; obra precisa ter PQO e o serviço estar no PQO; checklist ✅/❌/N/A; reprovada abre NC automática; aprovada desbloqueia a etapa. Coluna calculada "treinamento" (⚠️ se obra+serviço sem treinamento). Sem impressão. |
| `qualidade_fvm` | projectId, materialNome/Codigo, fornecedor (**texto livre, não FK**), notaFiscal, quantidade/unidade, dataRecebimento, responsavelRecebimento, itensVerificacao (checklist de 6 itens padrão, rótulos editáveis), resultado, **lote, fabricante, dataFabricacao, validade, localAplicacao, certificadoQualidade, purchaseOrderId** (Fase 1) | CRUD com filtro de obra (não exige PQO); botão "Registrar recebimento (FVM)" na linha do Pedido de Compra pré-preenche obra/fornecedor/pedido; alerta de validade ≤30 dias; reprovada abre NC automática. Sem assinaturas, sem impressão. |
| `qualidade_nc` | **numero UNIQUE `NC-AAAA-###`** (gerado no servidor com retry anti-corrida), origem (Manual/FVS/FVM/Auditoria), fvsId/fvmId, grau (Menor/Maior/Critica), descricaoNC, prazoAcao, **acaoCorretiva + verificacaoEficacia** (obrigatórias para fechar; operador não fecha — 403), status Aberta→Em andamento→Verificando→Fechada | CRUD com KPIs próprios (abertas, vencidas, fechadas no mês) e semáforo de prazo. Fechar NC de FVS aprovada desbloqueia a etapa. |
| `qualidade_treinamentos` | projectId, servicoSiacId, dataTreinamento, instrutor, cargaHoraria, **participantes TEXT (texto livre)**, conteudo | CRUD com filtro de obra. Vincula a serviço SiAC, **não** a PES/versão nem a `rh_colaboradores`. Sem validade/reciclagem, sem lista de presença anexada. |
| `qualidade_auditorias` | tipo (Obra/Corporativa), projectId (NULL = sede), dataAuditoria, auditor, escopo, **checklistSiac LONGTEXT** (23 cláusulas, `CHECKLIST_SIAC_NIVEL_B` app.js:12437), totalItens/itensConformes/ncsAbertas/resultado (calculados no servidor), status Agendada/Realizada/Relatorio emitido | CRUD; ao passar para Realizada, calcula % conformidade (Conforme / c/ Ressalvas ≥70% / Nao Conforme) e **abre 1 NC por item não conforme**. Sem PDF do relatório. |

Complementos fora de `qualidade_*`:

- **Gate do cronograma:** `obra_cronograma_etapas.servicoSiacId/fvsId/qualidadeBloqueada`; concluir etapa de serviço controlado sem FVS aprovada (ou com NC aberta) → 422 (`qualidade_bloqueio_etapa`, index.php:7508).
- **Qualificação de fornecedores (Fase 1):** 13 colunas em `suppliers` (`pbqph_nivel` status ENUM, `pbqph_letra/validade`, `iso9001(+validade)`, `datec(+numero)`, `abnt_marca`, `avaliacao_pontualidade/qualidade/preco` 1-5, `avaliacao_data/responsavel`) — modal "Qualificação PBQP-H" na lista de fornecedores + badge na tabela + alertas de certificação vencida no dashboard. **Snapshot único** — a tabela de histórico `fornecedor_avaliacoes` NÃO existe.
- **Dashboard da Qualidade** (`renderQualidadeDashboard`, app.js:12641): KPIs FVS aprovadas, FVM aprovadas (meta 10), NCs abertas/vencidas, serviços controlados x/27 com "Meta Nível B: 11" (`QUALIDADE_METAS = {servicos:11, materiais:10}` — **hardcoded**, coincide com os números do regimento para serviços/materiais com procedimento); alertas (NC vencida, etapa bloqueada, serviço sem PES/treinamento, certificação de fornecedor vencendo, material vencendo).
- **Permissões (achado):** `qualidadePolitica` e `qualidadeAuditorias` não estão em nenhum papel restrito — engenharia/gestor_obra **não veem** Política nem Auditorias (index.php:10970-10996); `operador` tem edit sem view em FVS/FVM/NC.

**Quantos registros:** não foi possível contar nesta rodada (banco inacessível) — ver §5, SQL pronto.

### 1.2 O que as "Fases 2-3" do backlog (PBQPH_ANALISE.md) já preveem — para não duplicar

| Já previsto no backlog | Fase | Este diagnóstico… |
|---|---|---|
| `qualidade_ensaios` (controle tecnológico, NC automática) | 2 | **não repropõe** — e recomenda adiar (ver §4: é peso de Nível A) |
| `qualidade_equipe` (NRs por trabalhador, validade, alerta 30 dias) | 2 | não repropõe; o painel trata treinamento só como evidência por obra+serviço |
| `qualidade_pit` (PIT formal PQO×PES×frequência) | 2 | não repropõe — PIT não é exigência nominal do B (§4) |
| Relatório mensal de qualidade em PDF | 3 | não repropõe |
| Rastreabilidade ponta-a-ponta (lote→FVS→local) | 3 | não repropõe; para o B basta o que a FVM já tem |
| Bloqueio financeiro por recebimento reprovado; evolução Nível A | 3 | fora de escopo aqui |

O que este diagnóstico propõe e o backlog **não** cobre: painel de prontidão (§3) e as lacunas
documentais do Anexo 3 (6.2, 9.3, 9.1.2, aprovação do PES, lista formal) — sem sobreposição.

---

## 2. Requisitos do Nível B (tabela do Anexo 3) × sistema

Legenda: **ATENDE** = tela e dado existem · **PARCIAL** = estrutura existe, falta fluxo/dado · **FALTA** = nada no sistema.

### 2.1 As lacunas apontadas pelo guia (foco)

| Req. | Situação | Detalhe |
|---|---|---|
| **6.2 Objetivos da qualidade com indicador** | **FALTA** | Único lugar: `qualidade_pqo.metasQualidade` TEXT livre, nunca parseado; as metas 11/10 são constante de frontend. Não há objetivo mensurável da EMPRESA, indicador, meta numérica, período nem medição. A cláusula está no checklist de auditoria (app.js:12443), ou seja, a própria auditoria interna apontaria NC aqui. |
| **7.5 Controle de documentos** | **PARCIAL** | Política e PQO têm versao+status+aprovadoPor+dataAprovacao; PES tem versao+status+PDF anexado **mas não tem aprovadoPor/dataAprovacao** (schema.sql:1873 — só elaborador). Vigência automática (obsoletar anterior) existe para Política e PES, **não para PQO**. Não há histórico de revisões (a versão anterior vira Obsoleto mas nada registra o que mudou), nem controle de distribuição/cópia controlada. Para o B, o furo objetivo é: **procedimento sem evidência de aprovação**. |
| **9.3 Análise crítica pela direção** | **FALTA** | Zero ocorrências no código (nem tabela, nem tela, nem registro de reunião). Também está no checklist de auditoria (app.js:12459) — mesma observação do 6.2. |
| **8.4.1.1 Qualificação de fornecedores** | **PARCIAL** | Estrutura da Fase 1 completa (13 colunas + modal + alertas de validade). Falta o **fluxo**: (a) critério documentado de qualificação (o que torna um fornecedor "aprovado"); (b) histórico de avaliações (`fornecedor_avaliacoes` não existe — snapshot sobrescrevível); (c) amarração ao uso: nada impede/avisa compra ou FVM de fornecedor `nao_avaliado`/`suspenso` — e a FVM guarda o fornecedor como **texto livre**, não FK, então nem dá para cruzar de forma confiável. |
| **8.5.2 Rastreabilidade por lote** | **PARCIAL (estrutura ATENDE)** | As 7 colunas existem e estão no formulário FVM (lote, fabricante, dataFabricacao, validade, localAplicacao, certificadoQualidade, purchaseOrderId — schema.sql:1960). Nenhum campo é obrigatório e não há relatório de rastreabilidade (dado o lote, onde foi aplicado). Para o B: estrutura suficiente; a pendência é **disciplina de preenchimento** + uma consulta simples. |
| **9.1.2 Satisfação do cliente** | **FALTA** | Zero ocorrências — e é a única das lacunas que **nem no checklist de auditoria interna aparece** (9.1.x inteiro está ausente das 23 cláusulas). Ponto cego duplo: falta o registro E falta o item que lembraria da falta. |
| **Lista formal de serviços/materiais controlados com evolução por nível** | **PARCIAL** | A lista existe **por obra**, dentro do PQO (JSON em `servicosControlados`/`materiaisControlados`). O regimento pede a lista da **empresa** (declarada no SGQ), da qual a obra deriva a sua, com os percentuais de evolução por nível (11→…→27 serviços). Hoje: serviços OK como seleção dos 27 SiAC; **materiais são texto livre sem biblioteca** — cada PQO pode escrever "Cimento CP-II" de um jeito, o que impede contar "10 materiais com procedimento" de forma estável. A validação 11/10 só roda ao tornar o PQO Vigente. |

### 2.2 Demais requisitos do Anexo 3 (visão rápida)

| Req. | Situação | Evidência |
|---|---|---|
| 4.1-4.4 Contexto/escopo do SGQ | **FALTA** (documental) | Nada no sistema; tipicamente resolvido em manual da qualidade fora do sistema — decidir onde mora (ver §3, item manual). |
| 5.1/5.3 Liderança, papéis | **PARCIAL** | Papéis/permissões do sistema existem; a designação formal (RD/organograma) é documental. |
| 5.2 Política da Qualidade | **ATENDE** | `qualidade_politica` com aprovação e vigência + PDF. Ressalva: engenharia/gestor_obra não a veem (permissão) — política precisa ser "comunicada e entendida". |
| 7.1/7.2 Recursos, competência | **PARCIAL** | Treinamentos por obra+serviço existem; sem validade/registro individual (Fase 2 `qualidade_equipe` cobre o resto). |
| 7.1.5 Recursos de medição (calibração) | **FALTA** | Nada. **Confirmar no Anexo 3 o quanto o B exige** (no SiAC costuma ser flexibilizado no B; se o guia confirmar exigência, é item manual com anexo — certificados). |
| 8.1/8.1.1 Planejamento — PQO por obra | **ATENDE** | PQO único por obra, versão, aprovação, impressão. |
| 8.2 Requisitos do cliente | **PARCIAL** | Contratos/propostas existem no sistema (módulo comercial); não há análise crítica de requisitos formal. |
| 8.3 Projeto | **N.A. (exclusão típica)** | Construtora que não projeta exclui 8.3 — registrar a exclusão no escopo do SGQ. |
| 8.4 Aquisição (geral) | **PARCIAL** | Pedido de compra + FVM no recebimento + qualificação (ver 8.4.1.1 acima). |
| 8.5.1 Controle de produção (PES+FVS) | **ATENDE** | 27 serviços SiAC, PES versionado com critérios → itens da FVS, assinaturas obrigatórias validadas no servidor, gate de etapa. É o coração do módulo e está sólido. |
| 8.5.3/8.5.4 Propriedade do cliente, preservação | **PARCIAL/FALTA** | Preservação de materiais: item do checklist FVM ("sem danos visíveis") e campo validade; armazenamento não é tratado. Baixo peso no B. |
| 8.6 Liberação | **ATENDE** | FVS aprovada + NCs fechadas liberam a etapa (422 caso contrário). |
| 8.7 / 10.2 Saídas NC, NC e ação corretiva | **ATENDE** | Fluxo completo com numeração, graus, eficácia, automações de FVS/FVM/Auditoria. |
| 9.1.1/9.1.3 Monitoramento e análise | **PARCIAL** | Dashboard com KPIs e % de conformidade por auditoria; sem série histórica/indicador formal (depende do 6.2). |
| 9.2 Auditoria interna | **ATENDE (estrutura)** | Tela completa com checklist de 23 cláusulas e NC automática. O que vale para o auditor é **ter realizado** ≥1 no ano — ver §3/§5. Checklist não cobre 9.1.x (registrado acima). |
| 10.3 Melhoria contínua | **PARCIAL** | Evidenciável por NCs fechadas com eficácia; sem registro próprio. |

---

## 3. Painel de prontidão Nível B

### 3.1 Requisitos com status CALCULÁVEL dos dados

Tudo abaixo é computável **no frontend com as coleções que o bootstrap já carrega** (o dashboard da
qualidade já faz contas idênticas) — sem endpoint novo para a parte calculada.

| # | Indicador | Regra de cálculo proposta | Meta (Nível B) |
|---|---|---|---|
| C1 | Política vigente | existe `qualidade_politica.status='Vigente'` | binário |
| C2 | PQO da obra-alvo | PQO da obra com `status='Vigente'` | binário |
| C3 | Serviços na lista | `len(JSON servicosControlados)` do PQO vigente | ≥ 11 |
| C4 | Serviços com procedimento | `COUNT(DISTINCT servicoSiacId)` de `qualidade_pes` `status='Vigente'` **∩ serviços do PQO** | ≥ 11 |
| C5 | Serviços com registro | `COUNT(DISTINCT servicoSiacId)` de FVS `status='Aprovada'` na obra | ≥ 6 |
| C6 | Materiais na lista | `len(JSON materiaisControlados)` do PQO vigente | ≥ 20 |
| C7 | Materiais com registro | `COUNT(DISTINCT materialNome)` de FVM da obra com resultado preenchido | ≥ 5 |
| C8 | NC sob controle | zero NC com `status≠'Fechada'` e `prazoAcao < hoje` | binário |
| C9 | Fluxo de NC em uso | ≥ 1 NC fechada com acaoCorretiva + verificacaoEficacia | binário |
| C10 | Auditoria interna no ano | ≥ 1 `qualidade_auditorias` com `status ∈ (Realizada, Relatorio emitido)` e `dataAuditoria` no ano corrente | binário |
| C11 | Treinamento dos serviços | serviços do PQO com treinamento na obra ÷ serviços do PQO (`qTemTreinamento`) | 100% (indicativo — ver §4) |
| C12 | Gate operante | zero etapas com `qualidadeBloqueada=1` pendentes na obra | binário |

Notas de honestidade do cálculo: C7 deduplica por `materialNome`, que é texto livre — normalizar
(trim/minúsculas) e aceitar que é aproximado até existir biblioteca de materiais (§4). "Materiais com
procedimento" (meta 10) **não é calculável hoje**: o checklist padrão da FVM é genérico, não é
procedimento por material — entra como item manual (M6) ou fica aguardando a biblioteca.

### 3.2 Requisitos que exigem CONFIRMAÇÃO MANUAL com anexo

Estrutura mínima: tabela nova `qualidade_requisitos` (id, codigo, descricao, status
Pendente/Atendido, responsavel, dataConfirmacao, arquivoAnexo/arquivoNome/arquivoData, observacao) —
migration aditiva + `ensure_*` + upload no molde do PDF do PES.

| # | Item | Anexo esperado |
|---|---|---|
| M1 | 6.2 Objetivos da qualidade com indicadores | documento de objetivos/indicadores aprovado |
| M2 | 9.3 Análise crítica pela direção | ata da reunião (entradas/saídas) |
| M3 | 9.1.2 Satisfação do cliente | pesquisa aplicada / registro de tratamento |
| M4 | 7.5 Procedimentos aprovados | enquanto o PES não tiver aprovadoPor: declaração/lista assinada. **Melhor:** adicionar `aprovadoPor`/`dataAprovacao` ao PES (2 colunas aditivas) e este item vira calculável: % de PES vigentes com aprovador+PDF |
| M5 | 4.x Manual/escopo do SGQ (com exclusão do 8.3) | manual da qualidade |
| M6 | Materiais com procedimento de inspeção (meta 10) | procedimentos de inspeção; vira calculável quando existir biblioteca de materiais |
| M7 | 8.4.1.1 Critério de qualificação de fornecedores | procedimento + evidência das avaliações (a % de fornecedores avaliados até é calculável em `suppliers.pbqph_nivel`, mas sem amarração FVM↔fornecedor o número não prova uso — manter manual) |
| M8 | 7.1.5 Calibração (se o Anexo 3 exigir no B) | certificados de calibração |

### 3.3 Percentual geral

- Cada linha vale 0 (FALTA), 0,5 (PARCIAL/incompleto) ou 1 (OK). Calculáveis: C3-C7 e C11
  pontuam proporcional à meta (ex.: 8 de 11 serviços com PES = 0,73); binários são 0/1.
- **Percentual = média simples das ~20 linhas** — sem pesos. Pesos dariam falsa precisão; o que o
  auditor trata como eliminatório vira **gate**, não peso: com C10 (auditoria interna), M2 (análise
  crítica) ou C1 (política) zerados, o painel exibe "NÃO PRONTO para Fase 1" independentemente do %.
- Exibição: barra geral + duas colunas (Fase 1 documental / Fase 2 obra) — ver §4 sobre por que essa
  separação importa mais que o número único.

**Tamanho: M.** Parte calculada = P (uma seção nova no `renderQualidadeDashboard`, só leitura das
coleções). Parte manual = a tabela nova + upload + tela simples, no molde já batido do módulo. Somado,
M — cabe em 2 etapas de implementação (calculada primeiro, manual depois), como o dono prefere.

---

## 4. Contraponto

**O que NÃO vale fazer (ou fazer diferente):**

1. **Não criar tela nova para o painel** — é mais uma aba para ninguém abrir. Colocar a seção
   "Prontidão Nível B" no topo do `renderQualidadeDashboard`, que já tem os KPIs e o filtro de obra.
2. **Não transformar C11 (treinamento) em critério duro.** `participantes` é texto livre; contar
   isso como evidência formal é teatro de dados. Deixar como indicativo (⚠️) até a Fase 2
   (`qualidade_equipe`) dar registro individual.
3. **Não construir módulo de satisfação do cliente.** Para o B, uma pesquisa por obra entregue com
   anexo (item M3) resolve. Módulo com formulário/envio/tabulação é over-engineering agora.
4. **Não antecipar ensaios (`qualidade_ensaios`) nem PIT por causa do B.** O backlog os marca como
   prioridade alta, mas o peso deles é a evolução ao Nível A / controle tecnológico. Para a auditoria
   do B com os números 11/6/3 e 20/10/5/3, FVS+FVM+PES cobrem. Mirar o B permite **rebaixar** a
   prioridade desses dois itens da Fase 2 — o diagnóstico anterior foi escrito sem essa decisão.
5. **Não resolver o 7.5 com GED/controle de documentos genérico.** Duas colunas no PES
   (`aprovadoPor`, `dataAprovacao`) + o PDF que já existe + a obsolescência automática que já existe
   = 7.5 atendido para o B. (Bônus barato no mesmo pacote: obsoletar PQO antigo ao salvar novo
   Vigente, hoje só Política/PES têm esse tratamento.)
6. **A lista formal, sim, vale fazer diferente do que existe:** a lista do PQO é por obra e os
   materiais são texto livre. Proposta mínima: biblioteca de ~20 materiais (constante no app.js, como
   os 27 serviços — nem precisa de tabela na primeira etapa) e o PQO seleciona dela. Isso destrava a
   contagem estável de C6/C7 e o futuro M6→calculável. A "lista da empresa com evolução por nível"
   pode ser o próprio par (biblioteca + metas por nível) sem estrutura nova.
7. **Corrigir o checklist de auditoria interna** (adicionar 9.1.1/9.1.2/9.1.3 às 23 cláusulas) — é
   edição de constante, custo ~zero, e elimina o ponto cego duplo do 9.1.2.
8. **Achados colaterais dos mapeamentos que não são deste escopo mas não devem se perder:**
   (a) `arquivoPdf` do PES é gravável via PUT genérico e o download faz `readfile()` sem confinar ao
   diretório de uploads — **leitura arbitrária de arquivo por usuário autenticado com edit**; corrigir
   em ciclo próprio, curto; (b) DELETE de FVS/NC sem guarda pode deixar etapa travada com
   `qualidadeBloqueada=1` órfã; (c) engenharia/gestor_obra sem view em Política/Auditorias;
   (d) `criar_nc_automatica` usa `CURDATE()` (fuso MySQL) contra a regra M10.

**O que o auditor da Fase 1 pergunta primeiro** (auditoria de planejamento/documental — antes de
pisar na obra) e a ordem que isso impõe às lacunas:

| Ordem | Pergunta do auditor | Lacuna correspondente | Custo |
|---|---|---|---|
| 1º | "Mostre o escopo/manual do SGQ e a **lista de serviços e materiais controlados** declarada" | M5 + lista formal (§2.1) | documental + item 6 acima |
| 2º | "Política e **objetivos com indicadores** — onde estão medidos?" | 6.2 (**FALTA hoje**) | M1 (documental) — sistema só registra |
| 3º | "Seus procedimentos são **controlados**? Quem aprovou o PES de alvenaria, que versão vale?" | 7.5 — PES sem aprovador | 2 colunas (item 5 acima) |
| 4º | "**Auditoria interna** e **análise crítica** — atas e resultados" | C10 (executar!) + 9.3 (M2) | operacional, não de código |
| 5º | "O **PQO da obra** que vou auditar" | C2 — PQO do Asilo vigente e aprovado | operacional |
| 6º | Satisfação do cliente, qualificação de fornecedores | 9.1.2, 8.4.1.1 | M3/M7 |

A leitura importante: **as lacunas nº 2 e nº 4 não são software** — são um documento de objetivos,
uma auditoria interna executada e uma ata de análise crítica. O sistema pode registrá-los (painel,
§3.2), mas nenhuma linha de código substitui fazê-los. Por isso a ordem acima ≠ ordem de facilidade:
o item mais barato de código (7.5) é só o 3º na fila do auditor.

---

## 5. Exemplo com dados de hoje

O banco só existe no servidor e não estava acessível desta máquina nesta rodada (SSH LAN sem rota;
API exige login). Contagens reais — colar no servidor (100% leitura):

```sql
SELECT 'pes_vigentes_distintos' k, COUNT(DISTINCT servicoSiacId) v FROM qualidade_pes WHERE status='Vigente'
UNION ALL SELECT 'pes_total', COUNT(*) FROM qualidade_pes
UNION ALL SELECT 'pqo_vigentes', COUNT(*) FROM qualidade_pqo WHERE status='Vigente'
UNION ALL SELECT 'fvs_total', COUNT(*) FROM qualidade_fvs
UNION ALL SELECT 'fvs_aprovadas', COUNT(*) FROM qualidade_fvs WHERE status='Aprovada'
UNION ALL SELECT 'fvs_servicos_distintos_aprov', COUNT(DISTINCT servicoSiacId) FROM qualidade_fvs WHERE status='Aprovada'
UNION ALL SELECT 'fvm_total', COUNT(*) FROM qualidade_fvm
UNION ALL SELECT 'fvm_materiais_distintos', COUNT(DISTINCT LOWER(TRIM(materialNome))) FROM qualidade_fvm
UNION ALL SELECT 'nc_abertas', COUNT(*) FROM qualidade_nc WHERE status<>'Fechada'
UNION ALL SELECT 'nc_vencidas', COUNT(*) FROM qualidade_nc WHERE status<>'Fechada' AND prazoAcao < CURDATE()
UNION ALL SELECT 'treinamentos', COUNT(*) FROM qualidade_treinamentos
UNION ALL SELECT 'auditorias_realizadas_ano', COUNT(*) FROM qualidade_auditorias
  WHERE status IN ('Realizada','Relatorio emitido') AND YEAR(dataAuditoria) = YEAR(CURDATE())
UNION ALL SELECT 'politica_vigente', COUNT(*) FROM qualidade_politica WHERE status='Vigente';
```

Como o painel converteria (fórmula do §3.3), com um cenário **ilustrativo** — NÃO são dados reais,
apenas a mecânica: se hoje existirem, digamos, 5 PES vigentes, 1 PQO vigente do Asilo com 11
serviços, 0 auditoria no ano e nenhum dos 8 itens manuais confirmado, o painel marcaria
C1=1 · C2=1 · C3=1 · C4=5/11=0,45 · C5-C7 proporcionais · C10=0 · M1-M8=0 → algo na faixa de
**30-40%, com o selo "NÃO PRONTO para Fase 1"** (gates C10 e M2 zerados). O valor do painel está
menos no número e mais nessa lista do que zerar primeiro.

Duas observações que valem mesmo sem as contagens: a biblioteca dos 27 serviços SiAC é constante de
código (não registro em banco) — "quantos PES existem" mede procedimentos escritos, não a biblioteca;
e o KPI atual "FVM aprovadas" do dashboard conta **fichas**, não materiais distintos — a contagem do
painel (C7) é a correta para a meta do regimento, e os dois números vão divergir.
