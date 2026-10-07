# ObraSync — Panorama setor por setor (2026-10-06)

> Leitura completa do repositório (`outputs/`): código (`app.js` 20.650 linhas, `api/index.php` 16.037, `styles.css` 6.670, `schema.sql` 2.352), 61 migrations, 25 arquivos de teste, CLAUDE.md, README, STATUS, 13 diagnósticos em `docs/revisao/`, o estudo de benchmark, 22 specs e 16 planos em `docs/superpowers/`, e as memórias do projeto.
>
> **Objetivo:** servir de base para decidir mudanças **setor por setor** (setor = seção da sidebar). Para cada setor: o que existe, o que está pendente, o que o dono já decidiu (não repropor) e candidatos de mudança com tamanho (P/M/G).
>
> **Regra de leitura:** os diagnósticos de `docs/revisao/` são fotografias da data em que foram escritos. Itens marcados **[verificado hoje]** foram conferidos no código em 2026-10-06; os demais vêm dos documentos e podem já ter sido fechados sem atualizar o doc (caso G1 em 2026-07-28). Antes de agir em qualquer item, confirmar no código.

---

## 0. Situação geral

| Fato | Valor |
|---|---|
| Versão em produção | `v1.46.0` (2026-08-11); **local: `v1.47.0` (2026-10-06, segurança S1–S7), cache `?v=1819`, sem push** |
| Último commit de código | sessão 2026-10-06: `b308307`…`af0978f` + fechamento (ver STATUS §0.0) |
| Commits sem push | 4 de docs PBQP-H (até `a71e59b`) + os da sessão de segurança |
| Última sessão de trabalho | 2026-10-06 (Transversal + Configurações — segurança) |
| Suíte de testes | 29 blocos (`scripts/tests/run-all.sh`) |
| Módulos na sidebar | 15 seções, ~105 chaves de módulo, 12 papéis |

**Decisões vigentes que condicionam tudo:**
1. **Congelamento de frentes novas (2026-07-29)** + **pausa de construção (2026-08-02)**: "as próximas decisões saem do uso, não do desenho". O dono ia classificar os 243 movimentos pendentes e voltar com uma lista medida por uso. Só a frente **PBQP-H** foi descongelada (2026-09-02).
2. **Dados de produção intocáveis**: migrations só aditivas; qualquer mudança de dado exige plano + backup + autorização prévia.
3. **Implementação sempre por etapas**, com validação por etapa; ciclo spec → plano → etapas.
4. **Backlog oficial** = estudo de benchmark (70/70 decisões "sim") em Ondas A→E. Onda A concluída. Onda B fatiada em 6 lotes: L1 Erros ✅ (v1.40.0) · L2 Deploy · L3 Comercial (FC1/FC5) · L4 Kanban (KB2/6/7) · L5 Financeiro (FIN3/7/9) · L6 Agenda+Gantt (AG2/AG3/G8).

**Pendências de servidor (não verificáveis daqui):**
- `composer require dompdf/dompdf` (v1.46.0, PDF do RDO) e `sudo apt install libheif-examples` (v1.45.0, HEIC).
- Migration **retroativa** `2026-08-01-caixa-pendente-retroativo.sql` (mudança de dado, só com backup, ≈243 linhas) — conciliação E3.
- Migration `2026-07-31-receivable-acrescimos.sql` (v1.41.0) — `ensure_*` cobre, mas rodar.
- Migration RH F1 — o registro de 2026-08-02 diz que foi rodada; confirmar.
- Roteiros de validação em produção nunca executados: Onda B L1, conciliação E1/E2/E3, HEIC, PDF do RDO, RH F1, visual v1.36–v1.38.
- Repo do servidor tem merges locais divergentes de `origin/main` (cada pull gera "Merge ort") — pendente `reset --hard origin/main` após resgatar dump.
- Contagens reais do PBQP-H (SQL pronto no §5 do diagnóstico) nunca rodadas.

---

## 1. Transversal (plataforma, segurança, dívida técnica)

**Existe:** auth por token (CSPRNG, idle 30 min/TTL 12 h), RBAC por papel + grade por usuário, CSP/HSTS, uploads fora do docroot, deploy por webhook com HMAC + lock + backup validado que aborta (DEP3/NOVO-4), schema-drift logado (NOVO-2), suíte de testes (NOVO-3), captura global de erros JS (E1/E2), toast com severidade (E3), código de correlação em 500 (E4), `ensure_*` de auto-cura, log PHP em `/var/lib/financeiro/logs/`.

**FECHADO em 2026-10-06 (v1.47.0, sessão de segurança S1–S7 — detalhe em STATUS §0.0):**
- ~~S1 downloads sem confinamento (PES = E0 da PBQP-H, contrato, RDO foto, RH doc, NF, viabilidade)~~ → `resolver_arquivo_servido()`; colunas de caminho fora do CRUD genérico; registro-pai obrigatório; auditoria em produção = 0 caminhos fora da base.
- ~~S2 POST de delete/cancel como `create`~~ → já era parcialmente tratado por prefixo; os 4 casos restantes de cotações (`materialExcluir/propostaExcluir/materialCancelar/materialReabrir`) agora exigem `delete`; `sinapiReferences` DELETE só admin.
- ~~S3 `visualizador = '*'`~~ → lista explícita (sem administração nem RH); gerente sem backup/migração/auditoria no menu; papéis externos sem lista de usuários.
- ~~S4 `?token=` na query~~ → fallback removido (front já usava header). ~~S6 `dev_bypass`~~ → exige `app_env=local` + localhost, logado. ~~S7 exceção em 500/400~~ → genérico + log.

**Pendente (registrado em 2026-10-06, sem código):**
- **`role_can` sem grade = delete igual a edit.** Sem linha em `role_permissions`/`user_permissions`, create/edit/delete usam a mesma lista de edição do papel. Papéis sem grade preenchida continuam podendo excluir com permissão de edição. A distinção do S2 só tem efeito com grade por papel/usuário. Fecha com padrão de delete por papel ou com grade seedada — decisão do dono.
- **S5 opção 2 — ACL por obra para papéis externos** (`cliente_obra`, `fornecedor_terceiro`, `equipe_campo`): vínculo usuário→obra (coluna aditiva ou tabela), filtro no bootstrap e nos downloads. É o P0 da auditoria PBQP-H de 2026-09-02 e **a base do futuro portal de cliente/comprador para incorporadoras**. Frente própria, com spec; o S1 já exige registro-pai vivo, mas não isola usuários entre obras.
- **Integridade:** FKs CASCADE só no papel (drift schema × produção em `orcamento_obra_itens`, `orcamento_etapas`, `cotacoes.workBudgetId`, `proposta_orcamento_vinculos`); `schema.sql` regride a cada migration nova (G4 recorrente); collation mista `unicode_ci` × `uca1400_ai_ci` (frente própria: converter antigas → uca1400, com backup, janela, varredura de duplicatas por acento; regra vigente: nenhum JOIN texto×texto sem `COLLATE` explícito).
- **Dívida:** dois arquivos únicos gigantes; `kanban_cards.ordem` INT (estoura em 2038); `avisarFalha` ainda chama `showToast` sem severidade [verificado hoje]; `cursor:pointer` no `.app-toast`.
- **Backlog Onda B L2 (Deploy):** DEP1/5/7/8 — próximo lote na ordem oficial.

**Decidido:** DEP2/DEP6 contestadas (não fazer); DEP4 (migrations automáticas) só com guarda de aditividade; API1–8 e Gantt completo ficam na Onda E; plataforma única de notificações (AG5+KB9+FIN6) na Onda D.

**Candidatos de mudança:** (P) decidir o padrão de delete por papel (`role_can` sem grade); (M) frente collation; (M) Onda B L2; (M/G) ACL por obra como frente própria com spec.

---

## 2. Dashboard

**Existe:** visão geral e por obra, KPIs, painel Lucro Gerencial × Caixa Real pelo período global (mensal/acumulado), widgets de execução das obras, alertas (vencidos pagar/receber, cronograma, RH), modo privacidade, `renderDashboard` com try/catch e teste próprio.

**Pendente [verificado hoje — `dashboardRows` e `lucroCaixaMatchesDimensions` inalterados]:**
1. **Conflito filtro global × seletor de obra do dashboard**: se apontam para obras diferentes a tela zera sem avisar. Único item que produz informação enganosa.
2. Widget "Execução das Obras" ignora a visão por obra.
3. Ordem dos blocos: alertas só aparecem depois de 18–27 cartões.
4. `dashboardCostCenterRows`/`resultByProjectRows` são O(n²) e rodam duas vezes por render.
5. `kpi()` pinta contagens neutras de verde.
6. Alertas de vencimento gerados pelo cron (`obra_notificacoes`) não aparecem no dashboard.
7. Obra criada pela aprovação nasce `Planejamento` e `dashboardExecution` só lista `Em andamento` → previsto some.

**Decidido:** nada — STATUS §0.2 diz "aguarda decisão". Validação visual de v1.36–v1.38 em dados reais ainda pendente ao dono.

**Candidatos:** (P) pacote dos itens 1–5 (só `app.js`, sem endpoint, teste `test_dashboard_polish.js` já existe); (P) item 7 — incluir `Planejamento` no filtro ou promover status na aprovação.

---

## 3. Cadastros

**Existe:** clientes, fornecedores (com 13 colunas de qualificação PBQP-H), produtos, serviços, categorias financeiras, centros de custo (abas + dados padrão), contas bancárias; CEP universal (ViaCEP/BrasilAPI), autofill de cliente/fornecedor em todo form, endereço próprio da obra.

**Pendente:**
- Campo "Conta contábil vinculada" nas categorias é **decorativo**: `chart_accounts` nasce vazia (sem seed, sem `ensure_default_chart_accounts`) e DRE/relatórios não consomem `chartAccountId`.
- Fornecedor em **texto livre** na FVM e na cotação importada (a UI nunca manda `fornecedor_id`).
- Qualificação de fornecedores: falta critério documentado e amarração ao uso (8.4.1.1 parcial); histórico de avaliações **saiu** do escopo do Nível B.

**Decidido:** "não inventar estrutura contábil sem validar" — escolha entre orientar cadastro manual ou seed segue aberta.

**Candidatos:** (P) decidir o destino do campo de conta contábil (esconder ou seedar); (P) `fornecedor_id` obrigatório na FVM (entra no E5 da PBQP-H).

---

## 4. Comercial

**Existe:** `budgets` (orçamento comercial, valor fechado por frente — os 5 reais do dono vivem aqui), propostas com máquina N:N (grupos por disciplina, BDI flexível, licitação, documento por seções, variáveis, modelos), contrato a partir da proposta (13 cláusulas hardcoded, anexos assinados), aprovação cria a obra em transação sem duplicar.

**Pendente:**
- **Frente aprovada em 2026-08-02 (na fila do uso), ordem fixa:** (1) vínculo proposta↔orçamento aceita `budgets` (coluna aditiva `budgetId`, `workBudgetId` vira NULL, modo valor-fechado) — **destrava tudo**, M; (2) nova versão + vigência derivada (`parentProposalId` semi-morto), P/M; (3) modelo de contrato (`contrato_modelos`, 13 cláusulas viram semente), M; (4) anexo da planilha no budget, P; (5) contrato enriquece a obra (`valor_contrato` → `revenueContracted`), P. Mais: coluna de **custo opcional** em `budgets` (margem prevista × realizada).
- Onda B L3: FC1 (botão Aprovar com prévia) e FC5 (renomear rótulos ambíguos — `budgets` → "Orçamentos comerciais", dois "Cotações").
- Onda C: FC2 (cópia proposta→orçamento perde `etapa_id`/`tipo`/`sinapi_id`/`categoryId` e usa `unitPrice` como custo), FC3 (contas + contrato na aprovação), NOVO-1 (`createProposalLinkedRecords` faz dezenas de POSTs sem transação → proposta parcial em falha).
- Menus: 5 módulos `proposal*` sem `configs` crasham via favoritos; backend dá view de áreas/tipos/subtipos ao comercial, front não.

**Decidido (não repropor):** obra nasce da proposta aprovada (contrato só enriquece); **não** espelhar `budgets` em `orcamentos_obras`; **não** criar tabela de versões; **não** ativar `proposta_grupos` (evoluir `proposta_orcamento_vinculos`); FC4 wizard único contestado (preferir painel "próxima ação").

**Candidatos:** (M) item 1 da frente (é o que faz o módulo funcionar com os dados reais); (P) FC5 junto com a limpeza de menus.

---

## 5. Viabilidade

**Existe:** `viabilidadeObra` (checklist por tipo de obra, grupos/itens, progresso, anexos, PDF, bloqueio de proposta, exclusão em cascata). `viabilityAnalyses` (viabilidade financeira, legado) existe no código mas **não tem item de menu**.

**Pendente (status desconhecido, docs de 2026-07-01):** dois módulos coexistem — aposentar ou reintroduzir o legado conscientemente; `permission_module_key` não mapeia `viabilidadeObra` → overrides por usuário ignorados; `?module=viabilidade&action=delete` autorizado como `create`; `viabilidade_analises.obra_id/proposta_id` sem FK; erros do download de anexo em envelope divergente.

**Candidatos:** (P) decidir o legado + mapear a chave de permissão + autorização de delete. Setor pequeno, fecha num ciclo.

---

## 6. Obras/Projetos

**Existe:** obras (soft-delete, endereço, campos personalizados, tipos/status), aba Cotações por material (ver §8), custos/receitas por obra, NF/NFS-e (ABRASF → contas), RDO (fotos em lote, HEIC, assinaturas com CPF, PDF real via dompdf, relatório semanal), notificações, links de acompanhamento, relatório por obra.

**Pendente:**
- **De uso, não de tela:** 98,4% das contas a pagar são lançadas à mão e a obra 7 não tem nenhuma vinculada → "Custo realizado = R$ 0,00" é falta de `projectId`. Não verificado se as 61 contas apontam para outras obras ou nenhuma.
- Cópia proposta→orçamento da obra (FC2); `projects` não guarda `proposalId`; não herda endereço/prazos/gestor.
- **Documentação da obra** (ART/RRT, licenças, medições, aditivos) sem registro canônico; `technical_reports` sem arquivo/validade; catálogos órfãos (`tipos_documento`, `tipos_medicao`, `modelos_relatorio`).
- RDO: serviço executado em texto livre, sem quantidade nem vínculo ao item de orçamento; `unlink` de foto antes da transação; `URL.createObjectURL` nunca revogado no fluxo individual.
- Rótulos: `fiscalDocuments` × `taxDocuments` iguais; `projectReport` × `reportProject` idênticos.

**Decidido:** Documentação vira módulo próprio no molde do RH F1 (na fila); MP4/vídeo vetado no RDO; HEIC convertido no servidor; lib JS de HEIC barrada pelo CSP.

**Candidatos:** (M) módulo Documentação da obra (já desenhado, reaproveita 3 catálogos); (P) dedupe de rótulos/menus; (G) RDO com serviço vinculado ao orçamento (depende de orçamento em uso).

---

## 7. Qualidade PBQP-H — **única frente descongelada**

**Existe:** 8 tabelas `qualidade_*` (política, PES com 27 serviços SiAC, PQO por obra, FVS com gate no cronograma, FVM com lote/NF/pedido, NC numerada, treinamentos, auditorias com checklist de 23 cláusulas), qualificação de fornecedores (Fase 1, v1.14.0), dashboard com metas 11/10 hardcoded.

**Estado:** diagnóstico Nível B completo (3 commits + adendos, **sem push**); auditoria independente de 2026-09-02 (110 controles, parecer "não apto como repositório probatório", **não rastreada no git de propósito**); spec de implantação no **Condomínio Atacama** com **Seção 1 (trilha operacional, semanas 0–4) aprovada**. **Retomar pela Seção 2.**

**Etapas de código previstas na spec (ordem):**
- **E0** — segurança do PDF do PES: **FECHADO em 2026-10-06 pelo S1 (v1.47.0)** — download confinado ao `upload_dir`, `arquivoPdf/arquivoNome/arquivoData` fora do PUT genérico. A spec do Atacama pode pular a Seção 2 e retomar pela Seção 3 (E1).
- **E1** — pacote 7.5: **EXECUTADO em 2026-10-07** (commits `80da4fc`, `97153fe`, `8a74e78`; STATUS §0.0.1) — aprovação do PES pelo backend + "Exportar PDF", histórico do PQO em `qualidade_pqo_versoes`, 9.1.x no checklist, Política sem NaN, NC com data do PHP, DELETE de registro final bloqueado com gate recalculado, permissões. Aguarda validação do dono e as 2 migrations no servidor.
- **E2** — biblioteca de ~20 materiais como constante (molde dos 27 serviços) + metas **derivadas por ceil** (40/50/25%) no lugar de `QUALIDADE_METAS` 11/10 + flag executa/não executa.
- **E3** — painel de prontidão (C1–C14 calculáveis) como seção do `renderQualidadeDashboard`, não tela nova; observáveis pelas etapas em andamento.
- **E4** — tabela `qualidade_requisitos` para 8 confirmações manuais com anexo (M1–M8; M8 = preservação 8.5.4).
- **E5** — aviso (não bloqueio) em `comprasregistrar` quando recebe sem FVM; FVM passa a exigir lote E responsável.

**Outros achados abertos:** 9.1.x fora da constante `CHECKLIST_SIAC_NIVEL_B` (custo ~zero); DELETE de FVS/NC sem guarda (etapa com `qualidadeBloqueada=1` órfã); engenharia/gestor_obra sem view em Política/Auditorias; operador com edit sem view em FVS/FVM/NC; `criar_nc_automatica` usa `CURDATE()` (fere M10); migration `pbqph-fase1` altera tabelas que nenhuma migration cria; **zero testes** para `qualidade_*`; `parseFloat(versao)+0.1` sem fallback → "NaN" na Política.

**Decidido:** Nível B, subsetor Edificações, auditoria só no Atacama, canteiro em ≤1 mês; abordagem A (operar com o que existe, código em 5 etapas pequenas); ensaios e PIT rebaixados (peso de Nível A); sem módulo de satisfação (pesquisa anexada); painel como seção; lista de 20 materiais escrita uma vez com nomes padronizados. Guia simplificado do chat **não está no repo** (gravar é decisão do dono) e tem 3 linhas defasadas.

**Candidatos:** seguir a spec — apresentar Seção 2 (E0), depois 3–7, uma por vez; fazer push dos 4 commits de docs; rodar as contagens do §5.

---

## 8. Custo da Obra (orçamento, SINAPI, cotações, pedidos, compras)

**Existe:** orçamento de obra (etapas, tipos, 4 visões, BDI por etapa, CSV, realizado × orçado com histórico), base SINAPI (importação mensal por pacote, referência padrão, busca, export Excel), composições próprias, `quotes` (CRUD antigo), Curva ABC, pedidos de compra com itens, Compras da Obra (matriz item × fornecedor → pedido), Cotações por material (P1/P2: N propostas, vencedor, conta a pagar por empresa, NF depois), categorias/tipos de cotação (A1).

**Pendente:**
- **Três portas "Cotações"** (`quotes`, `cotacoes` em Obras, botão no Custo da Obra) e **dois ciclos concorrentes** (material → conta direta × matriz → pedido). Direção declarada: convergir no canônico.
- **Furos do ciclo de compras (risco latente — a medição de 2026-07-29 provou que o ciclo nunca rodou):** 6.2 `compraGerarPedido` não idempotente + guarda de recebimento por pedido (dobra `quantidade_realizada`); 6.1 fluxo por material não liga ao item nem move o realizado (`cotacoes.workBudgetId` nunca preenchido); 6.3 sem rodada/vigência, `vencedor` sem UNIQUE, `purchase_order_id` sobrescrevível; 6.4 NF por pedido inteiro, recebimento parcial não representável. Reabrir/excluir cotação não checa `conta_pagar_id`.
- RBAC semântico: rota autoriza por `purchaseOrders`; `materialExcluir`/`propostaExcluir`/`materialCancelar` caem em `create`.
- Bug IA → orçamento: títulos/subtotais da planilha viram itens com qtd 1 e custo 0 (F5c); orçamentos 6/7 do projeto 9 precisam de limpeza. Fix do 9393 precisa de **upload novo** para validar.
- Limpeza dos 122 itens órfãos: 6 passos entregues em 2026-08-02; a **migration de integridade (FK/RESTRICT) só roda após a limpeza confirmada** — status a confirmar.
- `sinapi_referencias` deletável pelo CRUD genérico apaga a base inteira; workers carregam mapas sem filtrar `isDefault`; `salvarItens` sem transação.
- `workBudgetItems` redundante no menu; rename "Custo da Obra" com ~10 strings pendentes; schema.sql não cria `cotacao_categorias`/`cotacao_tipos_item`.
- **A2** (atributos por tipo de cotação) aguarda só aval no spec; IA de importação Fase 2 depende de A2 + RAM/GPU do servidor.
- Inexistentes: etapa vinculada à cotação, frete, impostos, exceção formal para <3 propostas, data-limite do material.

**Decidido:** canônico = Custo da Obra → itens → propostas → mapa → **um pedido por fornecedor** → conta/NF → recebimento → realizado; fluxo por material **não continua como segundo motor financeiro**; formação de preço fica pré-obra; Suprimentos = **lista filtrável**, não Kanban; ordem de correção quando retomar: **6.2 → 6.1 → 6.3 → 6.4**; não puxar `plannedFinancialAmount` do orçamento agora (ligaria ao vazio); FC8 contestada (matriz já existe).

**Candidatos:** (P) RBAC semântico + bloqueios pós-conversão (P0 do spec de estado atual); (M) 6.2 idempotência; (G) convergência dos dois ciclos — só quando o ciclo começar a ser usado.

---

## 9. Planejamento (cronograma, marcos, agenda, kanban, relatórios técnicos)

**Existe:** cronograma físico-financeiro simples (etapas/marcos, Gantt, import MS Project XML, gate FVS), marcos da obra (automação marco → conta a receber), agenda (visão semana), kanban por obra + visão "Todos os boards" com filtros, relatórios técnicos.

**Pendente:**
- **Frente marco → conta a receber (aprovada 2026-08-01, 4 itens) [verificado hoje: `valor_previsto` não existe]:** campo `valor_previsto` em R$ no marco; vencimento = `plannedDate`; toast de automação no `saveForm` genérico (beneficia todas as automações); coluna `conta_receber_id` que a automação tenta gravar e não existe.
- Kanban: obras antigas sem board (sem backfill); `completionPrompt` morto e "Mover para Concluído" não dispara requisição; cartão de pedido cancelado fica órfão; `kanbanCards` sem paginação no bootstrap; `ordem` INT. Onda B L4: KB2 (WIP com validação), KB6 (flag "concluída" na coluna, vitória fácil), KB7.
- Cronograma: `milestone-dot` em posição fixa; `obra_cronograma_marcos` não plotado (G8 — único com dado real: 3 marcos); `obra_marcos_padrao` semi-órfã (0 registros); dois caminhos para "atrasada"; `workBudgetId` da etapa nunca preenchido; três vocabulários de etapa.
- Agenda: só semana (mês/dia código morto); `lembrete_minutos` dormente; Onda B L6: AG2 (atraso em manuais), AG3 (concluir em 1 clique).
- Spec do cronograma físico-financeiro completo (EAP, dependências, CPM, baseline, curva S, medições) = **visão futura em 7 fases, não iniciada**.

**Decidido:** **não** haverá Kanban de Execução (cronograma é o quadro e carrega o gate FVS); marco ganha **valor**, não percentual; nenhuma frente de Gantt/cor de atraso agora (0 etapas atrasadas — sem alvo); não tocar nos três vocabulários neste ciclo; marcos início+fim por etapa fora; sem `cronograma_etapa_id` na conta.

**Candidatos:** (P/M) frente marco → conta (já aprovada, 4 itens pequenos); (P) KB6 + AG2/AG3; (P) decidir destino de `obra_marcos_padrao`.

---

## 10. Financeiro

**Existe:** contas a receber/pagar (recorrência, quitação antecipada, baixa com data editável e acréscimos derivados no backend, auditoria antes→depois), job Aberto→Vencido, caixa com **aprovação de movimentos pendentes** (E3: linha, lote, similares, dispensar, desaprovar), fluxo de caixa (±6 meses), conciliação OFX com motor de vínculo tardio (E1) e aba de pendências por relevância com lote (E2).

**Pendente:**
- **Frente Duplicadas (aprovada 2026-08-02, 3 etapas, gate = dado da classificação dos 243):** fila computada de suspeitas título×título e título×NF órfã, tabela mínima `duplicidade_descartes`, ações vincular/mesclar/"não é duplicata"/excluir. Requisito do dono: suspeita registrada e visível (outra pessoa vai operar).
- **E3-B divisão de lançamento** (etapa própria): N contas por movimento com eixos ortogonais (valor, categoria, centro, obra); juros bloqueado em fatia; sem lote. Bloqueia os 243 mistos.
- Residual E2/E3: offset pula linhas após vínculos individuais; INNER JOIN `bank_accounts` esconde transação de conta apagada; `ensure` UNIQUE só checa `uk_pay_fitid`; extrair `fato_mudou()` pura; travar `status` no form de cashMoves OFX; índice `(amount, dueDate)`.
- Onda B L5: FIN3 (janela do fluxo configurável), FIN7 (aging por faixas no backend), FIN9 (caixa vinculado simétrico para receber). Onda C: FIN1 (baixa parcial real — `Parcial` hoje é só rótulo e `mark_overdue_accounts` não o converte), FIN2 (lote), FIN5 (DRE/vencidos on-demand).
- `ofxImportId` dormente; `originDocument` com dois formatos; fluxo de caixa filtra obra por efeito colateral do `dashboardViewMode`; `juros_aplicado`/`valor_original` DECIMAL(10,2) estreitos; relatórios zerados para `consulta`/`equipe_campo`/`cliente_obra` (bootstrap não entrega as coleções).
- Servidor: migration retroativa (≈243) + validação E1/E2/E3.

**Decidido:** obra **opcional** na conciliação; fato do extrato **imutável**; juros em título com fitid **decompõe**; status `Aprovado` unificado; desaprovar só sem NF/juros; sem automação de conta a pagar por etapa; FIN8 contestada (match já tem dedupe/janela/confiança); FIN4 contestada (já existe; lacuna é cenários).

**Candidatos:** (P) FIN3/FIN7/FIN9 (Onda B L5, já aprovados); (M) E3-B (se o dono confirmar que notas mistas são relevantes); (M/G) Duplicadas quando vier o dado.

---

## 11. Contabilidade Gerencial

**Existe:** plano de contas (vazio), lançamentos contábeis, DRE gerencial calculada no front, documentos fiscais, impostos, cron `consolidate_monthly_dre`.

**Pendente:** `consolidate_monthly_dre` é no-op permanente (nenhuma tabela `dre_*` existe); DRE não usa `chartAccountId`; DRE/fluxo/vencidos calculados no front (FIN5); rótulo `taxDocuments` colide com `fiscalDocuments`.

**Decidido:** FIN5 contestada na forma "consumir o snapshot" — fazer endpoints on-demand sem perder a semântica competência/caixa.

**Candidatos:** decisão de produto antes de código — manter contabilidade gerencial mínima (e esconder o que é morto: plano de contas vazio, cron no-op) ou investir. Setor menos maduro do sistema.

---

## 12. Relatórios

**Existe:** relatórios financeiro, por cliente, fornecedor, centro de custo, obra; exportações.

**Pendente:** `reportProject` duplica `projectReport`; `reportModels` abre tela errada por `startsWith("report")` (CRUD morto); relatórios zerados para papéis de consulta (coleções ausentes no bootstrap); "Inadimplência por cliente" corrigido na v1.32.1; FIN7 aging.

**Candidatos:** (P) dedupe + fix do roteamento de `reportModels` — entra na limpeza de menus.

---

## 13. IA

**Existe:** Ollama local (llama3.2:3b + all-minilm), 24.943 embeddings, busca semântica, de-para em lote (multi-aba, grupos, divergente), comparador de orçamento (totais, aceite em lote, export), ponte "Enviar para Orçamento de Obra" (B1), indexação, teste. Autorização por papel reusando `workBudgets` (G1 fechado).

**Pendente:** bug de valores zerando ao enviar certas planilhas para o orçamento (Relacao_Tomadas/Quadros); validar fix do 9393 com upload novo; Fase B (orçamento filtrável por categoria/setor/tipo, material/M.O. separados, export do filtrado) ~90%; `scheduleIaPoll` morre fora de `plugins` (M10, a confirmar); upload sem rollback → job órfão; 500 de `enviarParaOrcamento` vaza `getMessage()`; polling sem retry; IA de importação de cotações Fase 2 (PDF por regex hoje, `quantidade` sempre null) depende de A2 + levantar RAM/GPU; seção visível só a admin/gerente/visualizador.

**Decidido:** IA local atrás de interface trocável; porte 7–8B para a Fase 2; gravação **nunca automática**; APCu para vetores só se ficar lento.

**Candidatos:** (P) fechar o bug dos valores zerados (eixo central ~90%); (P) M10/P3/P4 se ainda existirem.

---

## 14. RH / Pessoal

**Existe (F1, v1.35.0):** colaboradores (próprio/diarista/autônomo/empreiteira com `fornecedor_id`), tipos de documento com `dias_alerta`, documentos com anexo e situação calculada (vencido/vence em N dias/válido), painel Vencimentos, bloco no dashboard. Acesso só admin/gerente/gestor_obra (LGPD).

**Pendente:** roteiro de validação da F1 no servidor (10 passos); **F2** alocação em obras (`rh_alocacoes`, cron `create_rh_doc_alerts` em `obra_notificacoes`, "preencher efetivo do RDO com alocados", dashboard RH por obra); **F3** diárias e medições de empreiteira → contas a pagar (molde do `materialGerarConta`).

**Decidido:** F2/F3 só após o teste da F1; fora de escopo: ponto/horas, folha/eSocial, bloqueio automático por documento vencido, portal, EPI, IA.

**Candidatos:** (M) F2 — conecta RH ao RDO e à obra, e é pré-requisito do efetivo no PBQP-H (equipe treinada por serviço).

---

## 15. Configurações

**Existe:** dados da empresa, usuários, permissões (grade por usuário), versão, 11 catálogos (tipos/status de obra, etapas/marcos padrão, campos personalizados, modelos de relatório, tipos de documento, checklists, tipos de medição, formas de pagamento, mensagens), regras de visualização, SINAPI, plugins, backup local, preferências, migração, auditoria, perfil.

**FECHADO em 2026-10-06 (S3, v1.47.0):** ~~`backupLocal`/`migration`/`auditLog` visíveis a gerente/visualizador~~ (fora do menu + guarda `isAdmin()`); ~~`visualizador = '*'`~~ (lista explícita, sem administração nem RH).

**Pendente:** `plugins` liberado no backend a 9 papéis que não o veem; `permission_module_key` não mapeia `viabilidadeObra`/`cotacoes` (o backend autoriza por `viabilityAnalyses`/`purchaseOrders`, então overrides por usuário nessas chaves do front não têm efeito); catálogos órfãos sem consumidor (`obra_marcos_padrao` 0 registros, `tipos_documento`, `tipos_medicao`, `modelos_relatorio`).

**Candidatos:** (P) **limpeza de menus e permissões** — um ciclo só, cruzando `sidebarSections` × `roleModules` × `permission_module_key` × telas mortas. Fecha também os itens de Relatórios, Viabilidade e Obras marcados como rótulo/dup.

**Registrado em 2026-10-06 (S3, sem código):** o papel `gerente` continua com view em RH/Pessoal (herda tudo menos administração); manter ou vedar é **decisão pendente do Alef**.

---

## 16. Ordem sugerida para "mudanças setor por setor"

A ordem respeita as decisões vigentes (PBQP-H descongelada; o resto depende de o dono reabrir a fila) e começa pelo que é pequeno, verificado hoje e sem dependência de servidor:

1. **Qualidade PBQP-H** — retomar a spec pela Seção 2 (E0), push dos docs, contagens. É a frente com prazo (canteiro do Atacama).
2. ~~**Transversal + Configurações** — os achados de segurança~~ **FEITO em 2026-10-06 (v1.47.0, S1–S7)**. Resta a limpeza de menus/permissões (duplicados e telas mortas de 5 setores), ciclo P.
3. **Dashboard** — pacote dos 5 itens já diagnosticados (P).
4. **Planejamento** — frente marco → conta a receber (aprovada, 4 itens) + KB6/AG2/AG3.
5. **Financeiro** — FIN3/FIN7/FIN9 (Onda B L5) e, com o dado dos 243, Duplicadas/E3-B.
6. **Comercial** — item 1 da frente (vínculo aceita `budgets`) + FC5.
7. **Custo da Obra** — P0 do spec (RBAC + bloqueios pós-conversão) e 6.2; convergência só quando o ciclo for usado.
8. **RH** — F2.
9. **Obras** — Documentação da obra.
10. **IA, Contabilidade, Viabilidade, Cadastros** — decisões de produto curtas antes de código.

Cada item acima = ciclo próprio (brainstorming → spec → plano → etapas com validação), conforme a regra de implementação por etapas.
