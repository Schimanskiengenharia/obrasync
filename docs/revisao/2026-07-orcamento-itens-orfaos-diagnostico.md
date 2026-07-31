# Diagnóstico — Itens órfãos de orçamento (integridade da exclusão)

> **Data:** 2026-07-31 · **Base de código:** v1.40.0 · **Achado do dono, medido no servidor:**
> `orcamentos_obras` = 0 registros; `orcamento_obra_itens` = **122 itens órfãos** (workBudgetId
> 6 e 7 → projectId 9, 40+44 itens; workBudgetId 9 e 10 → projectId 7, 11+27 itens). Como os
> órfãos mantêm `projectId`, agregações de previsto POR OBRA somam registros fantasma (confirmado:
> consulta de previsto por etapa no projectId=7 devolve 38 itens de orçamentos excluídos).
>
> **Status (2026-07-31):** causa raiz identificada; Etapa 0 medida (TODAS as filhas = zero —
> os 122 estão isolados); **Etapas 1-3 AUTORIZADAS pelo dono** (backup → quarentena → verificação),
> execução pelo dono no servidor, comando a comando. Etapa 4 (código) tem spec própria:
> `docs/superpowers/specs/2026-07-31-orcamento-integridade-exclusao-design.md` — **deploy da
> migration só DEPOIS da limpeza confirmada**.

---

## 1. Causa raiz — a FK de CASCADE só existe no papel

1. **A exclusão passa pelo `delete_record` genérico** (`api/index.php:2227-2235`): um
   `DELETE FROM orcamentos_obras WHERE id = ?` seco. A única guarda especial ali é a de obras
   (G3). Nenhum tratamento de filhos no PHP.
2. **O front não purga**: `removeRecord("workBudgets")` (app.js) remove só o registro de
   `db.workBudgets`; `db.workBudgetItems` mantém os itens na sessão até o reload.
3. **Drift schema × banco real:** `schema.sql:1407` declara
   `fk_orc_item_budget ... ON DELETE CASCADE`, mas a migration que criou a tabela em produção
   (`2026-06-08-sinapi-msproject-editable-structures.sql:201-223`) criou **sem FK nenhuma** (só
   índices) e nenhuma migration posterior adicionou a constraint (`fk_orc_item_budget` não existe
   em `migrations/` nem em `ensure_*`). Instalação nova a partir do `schema.sql` teria o CASCADE;
   a produção não tem constraint.

Mesmo drift nos vizinhos: `cotacoes.workBudgetId` (`schema.sql:1444` = SET NULL; migration sem
FK); `orcamento_etapas.orcamento_id`, `orcamento_item_execucao_log.item_id` e
`proposta_orcamento_vinculos.workBudgetId` **sem FK nem no schema.sql**.

## 2. Quem contava os 122 órfãos

| Consumidor | Onde | Efeito |
|---|---|---|
| Widget "Execução das Obras" (dashboard) | `api/index.php:6614+` — `JOIN orcamento_obra_itens i ON i.projectId = p.id` | previsto/realizado/estouros por obra inflados |
| Alerta "itens com estouro" | `app.js:5148` | contagem sobre TODOS os `db.workBudgetItems` |
| Select "vínculo ao item do orçamento" (pedido de compra) | `app.js:17402` (por `projectId`) | oferecia itens fantasma para vincular |
| Export "SINAPI por obra" | `api/index.php:3329-3340` (`WHERE i.projectId = ?`) | órfãos com `sinapi_id` no Excel |
| Cotações → comparação com orçamento | `api/index.php:3954` (`WHERE projectId = ?`) | comparava preços contra fantasmas |

Por que ninguém viu: as telas de Custo da Obra/execução leem por `workBudgetId`
(`budgetItemsFor`, `app.js:11431`) — sem o pai na lista, **órfão não aparece em tela nenhuma**,
só nos agregados por obra. O bootstrap ainda carrega os 122 em `db.workBudgetItems` a cada login.

## 3. Etapa 0 — medição das filhas (2026-07-31): TODAS ZERO

| Consulta | Resultado |
|---|---|
| `orcamento_etapas` órfãs | **0** |
| `orcamento_item_execucao_log` de itens órfãos | **0** |
| `proposta_orcamento_vinculos` órfãos | **0** |
| `proposta_itens.orcamento_item_id` → itens órfãos | **0** |
| `purchase_order_items.work_budget_item_id` → itens órfãos | **0** ← o gate da limpeza |
| `obra_cronograma_etapas` com vínculo a orçamento | **0** (nenhuma etapa tem vínculo) |
| `cotacoes.workBudgetId` órfãs | **0** |

**Conclusão: os 122 itens estão isolados — nenhuma referência externa.** A limpeza é segura no
desenho quarentena → DELETE transacional.

## 4. Plano autorizado (Etapas 1-3, executadas pelo dono no servidor)

> Regra vigente: dados de produção intocáveis — só com backup validado, quarentena reversível e
> confirmação de contagem em cada passo. Os comandos abaixo são os entregues ao dono
> (`export MYSQL_PWD` antes; `unset MYSQL_PWD` ao fim).

- **Etapa 1 — backup dirigido:** `mysqldump --single-transaction` das 9 tabelas envolvidas +
  `gzip -t` + conferência de `INSERT INTO` no dump.
- **Etapa 2a — quarentena:** `CREATE TABLE orcamento_obra_itens_quarentena_2026_07 LIKE ...` +
  `INSERT ... SELECT` dos órfãos; **esperado: 122** na quarentena.
- **Etapa 2b — ensaio:** `DELETE` dos órfãos dentro de transação com `ROLLBACK` incondicional,
  só para ler o `ROW_COUNT()`; **esperado: 122**; divergiu → parar.
- **Etapa 2c — DELETE real:** mesma sentença com `COMMIT`; **esperado após: 0 itens na tabela**
  (com `orcamentos_obras` vazia, todo item era órfão).
- **Etapa 3 — verificação:** consulta de órfãos = 0; agregação por obra sem linhas; no navegador
  (Ctrl+Shift+R): widget "Execução das Obras" vazio, alerta de estouro ausente, select de vínculo
  do pedido sem itens.
- **Retenção:** a tabela de quarentena fica até ordem explícita de DROP (destrutivo = nova
  autorização).

## 5. Etapa 4 — fechar a porta (código; ciclo próprio)

Spec: `docs/superpowers/specs/2026-07-31-orcamento-integridade-exclusao-design.md`. Resumo do
desenho aprovado em conversa: **cascata na composição** (FK real `ON DELETE CASCADE` em
itens/etapas/log — e `SET NULL` em `cotacoes.workBudgetId`, alinhando com o schema.sql) +
**bloqueio 409 nas referências externas** (proposta/pedidos) + **purge no front**
(`db.workBudgetItems`/`db.orcamentoEtapas` no `removeRecord`). **A migration só roda depois da
limpeza** — `ADD CONSTRAINT` falha com órfão presente.
