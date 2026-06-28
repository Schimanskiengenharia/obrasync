# PBQPH_ANALISE — Integração PBQP-H / SiNAT no ObraSync

> **Versão:** `v1.0` · **Data:** 2026-06-28 · **Tipo:** Análise de gaps + plano de implementação (documento — **nada foi implementado**)

Este documento mapeia os 10 requisitos do PBQP-H/SiNAT pedidos contra o que o
ObraSync **já possui**, aponta o que falta e propõe um plano de implementação em
fases. A implementação será feita em prompts separados, fase a fase.

---

## Resumo executivo

⚠️ **O ObraSync já tem um SGQ alinhado ao PBQP-H/SiAC Nível B** (módulo "Qualidade
PBQP-H", entregue na v1.9.0, marcado como 🟢 **Estável** no `STATUS.md`). Ele cobre:
Política da Qualidade, **PQO** (Plano da Qualidade da Obra), **PES** (Procedimentos
de Execução de Serviço), **FVS** (Ficha de Verificação de Serviço), **FVM** (Ficha
de Verificação de Material), **NC** (Não Conformidades com numeração `NC-AAAA-###`),
Treinamentos, Auditoria e Dashboard — **tudo integrado ao cronograma** (a etapa de um
serviço controlado só é concluída com FVS aprovada e NCs vinculadas fechadas).

Portanto, a maior parte do esforço **não é criar do zero — é estender o que existe**.

Dos 10 requisitos analisados: **3 já existem completos · 4 parciais · 3 faltando.**

### Mapa rápido

| # | Requisito | Situação | Prioridade | Complexidade | Onde mexer |
|---|---|---|---|---|---|
| 1 | Recebimento de materiais | 🟡 Parcial | Alta | Média | `qualidade_fvm` + vínculo com Pedido de Compra |
| 2 | Controle de execução / FVS | 🟢 Existe | — | — | `qualidade_fvs` (completo, com gate de etapa) |
| 3 | Não-conformidades + ação corretiva | 🟢 Existe | — | — | `qualidade_nc` (fluxo completo) |
| 4 | Qualificação de fornecedores | 🔴 Falta | Alta | Simples-Média | estender `suppliers` |
| 5 | Rastreabilidade de lote | 🔴 Falta | Média | Simples | colunas em `qualidade_fvm` |
| 6 | Controle tecnológico / ensaios | 🔴 Falta | Alta | Média | módulo novo `qualidade_ensaios` |
| 7 | Plano de Inspeção e Testes (PIT) | 🟡 Parcial | Média | Média-Complexa | PQO + PES + `checklists` → módulo PIT |
| 8 | Procedimentos de execução (PE) | 🟢 Existe | — | — | `qualidade_pes` (completo) |
| 9 | Relatório mensal de qualidade | 🟡 Parcial | Média | Média | Dashboard existe → falta export PDF |
| 10 | Qualificação da mão de obra | 🟡 Parcial | Alta | Média | `qualidade_treinamentos` + registro de NRs |

---

## Base já existente (o que reaproveitar)

- **Tabelas** (`api/index.php`, `ensure_qualidade_tables`): `qualidade_politica`,
  `qualidade_pqo`, `qualidade_pes`, `qualidade_fvs`, `qualidade_fvm`, `qualidade_nc`,
  `qualidade_treinamentos`, `qualidade_auditorias`.
- **Lógica de negócio já pronta** (reaproveitável nas novas funções):
  - Numeração sequencial de NC `NC-AAAA-###` com proteção contra corrida
    (`qualidade_proximo_numero_nc`).
  - **Abertura automática de NC** quando uma FVS ou FVM é "Reprovada"
    (`qualidade_criar_nc_registro`) — reusar nos ensaios e no recebimento.
  - **Gate de cronograma**: etapa com `servicoSiacId` só conclui com FVS aprovada e
    NCs fechadas; coluna `qualidadeBloqueada` em `obra_cronograma_etapas`.
  - Cálculo de conformidade da auditoria (% conformes, NCs geradas).
- **Biblioteca SiAC**: 27 serviços padrão (PES) e checklist de 22 cláusulas
  (auditoria) já embutidos no frontend.
- **Arquitetura para módulos novos** (`CLAUDE.md`): config + menu no `app.js`
  (`render()` por `currentModule`); no backend, `resource_map()` + `ensure_*` para
  auto-cura; migração correspondente. Uploads via `store_upload`; PDF via
  `generateDocumentHeader`/`generateDocumentFooter`.

---

## Análise item a item

### ITEM 1 — Controle de recebimento de materiais — 🟡 Parcial
- **Já existe:** **FVM** (`qualidade_fvm` / `renderQualidadeFvm`) com checklist padrão
  (`FVM_CHECKLIST_PADRAO`): NF conforme o pedido, quantidade conforme, sem danos,
  especificação técnica conforme, **prazo de validade**, **certificado do fabricante**.
  Captura fornecedor, nota fiscal, quantidade/unidade, data de recebimento, responsável,
  resultado **Aprovado / Aprovado com ressalvas / Reprovado** e abre **NC automática** se
  reprovado. Ou seja, o "checklist de inspeção de recebimento" pedido **já existe**.
- **Falta:** vínculo com o **Pedido de Compra** (`purchase_orders` não tem campo de
  recebimento/conformidade nem aponta para a FVM); ação "Inspecionar recebimento" a
  partir do pedido; campos de lote/local de aplicação (ver Item 5).
- **Prioridade:** Alta · **Complexidade:** Média
- **Como implementar:** adicionar `purchaseOrderId` em `qualidade_fvm`; botão
  "Receber / Inspecionar" no Pedido de Compra (status `Recebido`) que abre a FVM
  pré-preenchida (fornecedor, NF, itens do pedido). Opcional: bloquear/avisar pagamento
  se o recebimento foi Reprovado.

### ITEM 2 — Controle de execução no canteiro — 🟢 Existe
- **Já existe:** **FVS** (`qualidade_fvs`) completa — serviço (SiAC), PES aplicado,
  data de execução/inspeção, local, responsável pela execução e pela inspeção, itens de
  verificação (gerados dos critérios do PES), resultado, observações, ação corretiva e
  **assinaturas obrigatórias** de executor e inspetor (validadas no servidor). **Vincula
  à etapa do cronograma (`etapaId`)** e **a conclusão da etapa é bloqueada** sem FVS
  aprovada (exatamente o fluxo pedido). O **RDO** complementa com clima, efetivo,
  equipamentos, ocorrências e assinaturas por disciplina.
- **Falta:** nada essencial. Melhoria possível: anexar fotos/evidências à própria FVS.
- **Prioridade:** — · **Complexidade:** —

### ITEM 3 — Não-conformidades e ações corretivas — 🟢 Existe
- **Já existe:** **NC** (`qualidade_nc`) com numeração `NC-AAAA-###`, origem
  (Manual/FVS/FVM/Auditoria), grau (Menor/Maior/Crítica), descrição, local, responsável
  e data de detecção, **prazo**, **ação corretiva** (+ responsável/data), **verificação de
  eficácia** (+ responsável/data) e status Aberta → Em andamento → Verificando → Fechada.
  Fecho exige ação + verificação; só perfis gestores/engenharia fecham. Abertura
  automática a partir de FVS/FVM/Auditoria reprovadas.
- **Falta:** nada essencial. Melhoria: análise de causa-raiz estruturada (5 porquês/Ishikawa).
- **Prioridade:** — · **Complexidade:** —

### ITEM 4 — Qualificação e controle de fornecedores — 🔴 Falta
- **Já existe:** cadastro de `suppliers` (nome, documento, endereço, contato, status).
  **Nenhum** campo de qualificação/certificação.
- **Falta:** certificações (PBQP-H, ISO 9001, DATec, marca ABNT) com validade; índice de
  desempenho (pontualidade, qualidade, preço); status de qualificação
  (Aprovado/Em avaliação/Suspenso/Reprovado); histórico de avaliações.
- **Prioridade:** Alta · **Complexidade:** Simples-Média
- **Como implementar:** `ensure_supplier_qualification_columns` adicionando
  `pbqphNivel`, `iso9001`, `datec`, `marcaAbnt`, `certValidade`, `indiceDesempenho`,
  `statusQualificacao`, `ultimaAvaliacao` em `suppliers`; aba "Qualificação" no formulário
  do fornecedor (padrão de abas já usado em centro de custo). Tabela opcional
  `fornecedor_avaliacoes` para histórico periódico.

### ITEM 5 — Rastreabilidade de materiais (lote) — 🔴 Falta
- **Já existe:** a FVM guarda material, fornecedor e **nota fiscal**.
- **Falta:** **lote**, fabricante, data de fabricação, validade (como campo, hoje é só item
  de checklist) e **local de aplicação na obra** (ex.: "Bloco A — 2º pav. — fachada norte").
- **Prioridade:** Média · **Complexidade:** Simples
- **Como implementar:** colunas `lote`, `fabricante`, `dataFabricacao`, `validade`,
  `localAplicacao` em `qualidade_fvm` (via `ensure_*`), expostas no formulário FVM.
  Rastreabilidade ponta-a-ponta (lote → FVS → local) fica para a Fase 3.

### ITEM 6 — Controle tecnológico (ensaios) — 🔴 Falta
- **Já existe:** nada dedicado. Os "itens de verificação" de FVS/FVM são genéricos, não
  registram ensaios (resistência de concreto/CP, slump, absorção, espessura etc.).
- **Falta:** módulo de ensaios.
- **Prioridade:** Alta · **Complexidade:** Média
- **Como implementar:** módulo novo `qualidadeEnsaios` (`qualidade_ensaios`): `projectId`,
  `etapaId`, `tipoEnsaio`, `dataColeta`, `laboratorio`, `idCorpoProva`, `resultadoObtido`,
  `unidade`, `resultadoMinimo` (exigido por norma), `normaReferencia`, `situacao`
  (Aprovado/Reprovado), `acaoSeReprovado`, `status`. Reaproveitar `qualidade_criar_nc_registro`
  para abrir NC automática quando reprovado.

### ITEM 7 — Plano de Inspeção e Testes (PIT) — 🟡 Parcial
- **Já existe:** **PQO** define `servicosControlados` e `materiaisControlados`; **PES**
  define `criteriosAceitacao` por serviço; módulo `checklists`/`checklistItems` genérico
  (por tipo de obra e etapa, com obrigatório/foto/anexo). Juntos formam a *base* de um PIT.
- **Falta:** uma estrutura PIT formal que cruze **ponto de inspeção × tipo de verificação
  (FVS/FVM/Ensaio) × frequência × critério de aceitação × responsável**, carregada
  automaticamente por tipo de obra/sistema construtivo.
- **Prioridade:** Média · **Complexidade:** Média-Complexa
- **Como implementar:** módulo `qualidadePit` (`qualidade_pit`) gerado a partir do PQO +
  PES, com template padrão por `workType`. Pode reusar `checklists` como ponto de partida.

### ITEM 8 — Procedimentos de execução (PE) — 🟢 Existe
- **Já existe:** **PES** (`qualidade_pes`) — objetivo, materiais necessários,
  equipamentos/EPI, **procedimento**, **critérios de aceitação**, **normas de referência**,
  versão e status. Biblioteca de 27 serviços SiAC; os critérios alimentam os itens da FVS.
- **Falta:** anexar o PDF do procedimento e exigir "li/ciente" do responsável antes de
  iniciar a etapa (hoje o PE é texto estruturado, não documento anexado).
- **Prioridade:** Baixa · **Complexidade:** Simples
- **Como implementar:** anexo de PDF no PES (via `store_upload`) + checkbox de ciência na
  etapa do cronograma. Melhoria incremental.

### ITEM 9 — Relatório mensal de qualidade — 🟡 Parcial
- **Já existe:** **Dashboard da Qualidade** (`renderQualidadeDashboard`) com indicadores
  (NC por status, NCs vencidas, FVS por resultado, serviços controlados vs meta Nível B) e
  alertas; auditorias calculam % de conformidade.
- **Falta:** **geração/exportação** de um relatório mensal consolidado (PDF) com NCs
  abertas/fechadas no mês, resultados de ensaios, índice de conformidade de recebimento,
  checklists executados vs planejados e itens reprovados em FVS.
- **Prioridade:** Média · **Complexidade:** Média (depende de dados das Fases 1-2)
- **Como implementar:** relatório com `generateDocumentHeader/Footer` agregando os
  indicadores por mês/obra.

### ITEM 10 — Qualificação da mão de obra — 🟡 Parcial
- **Já existe:** **Treinamentos** (`qualidade_treinamentos`) registra eventos: data,
  instrutor, carga horária, conteúdo e **participantes em texto livre**.
- **Falta:** **registro por trabalhador** com NRs/habilitações e **validade**, e **alerta
  automático quando uma NR vence em 30 dias**.
- **Prioridade:** Alta · **Complexidade:** Média
- **Como implementar:** módulo `qualidadeEquipe` (`qualidade_equipe`/`obra_equipe`):
  `projectId`, `nome`, `funcao`, `cpf`, `nrs` (JSON: tipo + validade), `certificacoes`
  (JSON), com alertas de vencimento no Dashboard da Qualidade (reaproveitar o padrão de
  alertas de NC vencida).

---

## Plano de implementação em fases

### FASE 1 — Quick wins (estende estruturas existentes, alto impacto)
Itens que **aproveitam tabelas/telas já prontas** — baixo risco, entregam valor rápido.

1. **Item 4 — Qualificação de fornecedores:** colunas em `suppliers` + aba "Qualificação".
2. **Item 5 — Rastreabilidade de lote:** colunas `lote/fabricante/dataFabricacao/validade/
   localAplicacao` na FVM.
3. **Item 1 — Recebimento ↔ Pedido de Compra:** `purchaseOrderId` na FVM + botão
   "Inspecionar recebimento" no pedido (abre FVM pré-preenchida).
4. **Item 8 (incremento) — anexo de PDF no PES** + ciência na etapa.

### FASE 2 — Módulos novos (complexidade média)
Requerem tabela + endpoints + tela novos, mas seguem o padrão dos módulos de qualidade.

5. **Item 6 — Controle tecnológico/ensaios:** módulo `qualidade_ensaios` (com NC automática).
6. **Item 10 — Equipe/qualificação da mão de obra:** módulo `qualidade_equipe` com NRs e
   alertas de vencimento (30 dias).
7. **Item 7 — PIT formal:** módulo `qualidade_pit` derivado de PQO + PES, template por tipo
   de obra.

### FASE 3 — SGQ avançado
Funcionalidades que dependem dos dados das fases anteriores ou exigem cruzamentos complexos.

8. **Item 9 — Relatório mensal de qualidade (PDF)** consolidando todos os indicadores.
9. **Rastreabilidade ponta-a-ponta** (lote do material → FVS → local de aplicação).
10. **Automação financeira-qualidade:** bloqueio/alerta de pagamento quando recebimento
    reprovado; dashboards de tendência; evolução para **Nível A** (Nível B é o atual).

---

## Observações e riscos

- O módulo atual está alinhado ao **Nível B** do SiAC (o `README.md` deixa explícito). A
  meta de Nível A (mais serviços/materiais controlados e controle tecnológico obrigatório)
  reforça a prioridade dos **ensaios (Item 6)** e do **PIT (Item 7)**.
- **Dados de trabalhadores** (Item 10: CPF, NRs) entram em escopo de LGPD — tratar acesso
  por perfil e evitar exposição indevida.
- Toda tabela/coluna nova deve ter **`ensure_*`** no `index.php` (auto-cura), além da
  migração — convenção obrigatória do projeto (`CLAUDE.md`).
- Nada aqui foi implementado. Cada fase será executada em prompt próprio.
