# Spec — Integridade na exclusão de orçamentos (FKs + bloqueio 409 + purge no front)

> **Data:** 2026-07-31 · **Origem:** achado de integridade dos 122 itens órfãos
> (`docs/revisao/2026-07-orcamento-itens-orfaos-diagnostico.md`) · **Decisões do dono:** cascata
> na composição, bloqueio nas referências externas, purge no front; ciclo spec→plano liberado;
> **deploy da migration só DEPOIS da limpeza de dados confirmada** (Etapas 1-3 do diagnóstico).

## Objetivo

Excluir um orçamento de obra nunca mais deixa lixo: a composição (itens, etapas, log de execução)
morre junto **no banco** (FK real), referências externas **bloqueiam** a exclusão com 409
explicativo, e a sessão do navegador não segura fantasmas.

Fora de escopo (deliberado): FK em `obra_cronograma_etapas.workBudgetId/workBudgetItemId`
(medição de 2026-07-31 = zero vínculos; decidir a semântica de SET NULL ali é outra conversa);
DROP da tabela de quarentena (nova autorização); alertas/relatórios novos.

## 1. Migration `migrations/2026-07-31-orcamento-fk-integridade.sql`

MariaDB aceita `ADD CONSTRAINT IF NOT EXISTS` — todas idempotentes:

```sql
-- Composição do orçamento: morre com o pai (alinha produção ao schema.sql:1407).
ALTER TABLE orcamento_obra_itens
  ADD CONSTRAINT IF NOT EXISTS fk_orc_item_budget
  FOREIGN KEY (workBudgetId) REFERENCES orcamentos_obras(id) ON DELETE CASCADE;

ALTER TABLE orcamento_etapas
  ADD CONSTRAINT IF NOT EXISTS fk_orc_etapa_orcamento
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos_obras(id) ON DELETE CASCADE;

ALTER TABLE orcamento_item_execucao_log
  ADD CONSTRAINT IF NOT EXISTS fk_exec_log_item
  FOREIGN KEY (item_id) REFERENCES orcamento_obra_itens(id) ON DELETE CASCADE;

-- Cotação que referencia orçamento: solta o vínculo (alinha ao schema.sql:1444).
ALTER TABLE cotacoes
  ADD CONSTRAINT IF NOT EXISTS fk_cotacao_budget
  FOREIGN KEY (workBudgetId) REFERENCES orcamentos_obras(id) ON DELETE SET NULL;
```

**Pré-condição operacional:** órfãos zerados (limpeza confirmada) — `ADD CONSTRAINT` falha
(errno 1452) com órfão presente. Ordem no servidor: limpeza → `git pull` → migration.

**Nota:** `schema.sql` ganha as duas constraints que ainda não declara (etapas e log), para
instalação nova nascer igual à produção.

## 2. Auto-cura `ensure_orcamento_integrity_fks()` (api/index.php)

- Checagem leve antes de qualquer DDL: `INFORMATION_SCHEMA.TABLE_CONSTRAINTS` com
  `CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_orc_item_budget'` — presente, retorna
  sem DDL (padrão dos ensures guardados, ex. `ensure_qualidade_tables` no bootstrap).
- Ausente: roda os 4 `ALTER ... IF NOT EXISTS` num `try/catch` com `error_log` (padrão `ensure_*`)
  — se ainda houver órfão residual, o bootstrap NÃO cai; loga e segue (a migration manual é o
  caminho oficial).
- Chamada no bootstrap junto dos demais ensures.

## 3. Bloqueio pré-DELETE com 409 (referências externas)

No roteamento DELETE de `workBudgets` (antes do `delete_record` genérico, `api/index.php` região
da linha ~2227; interceptação no molde da guarda G3 de projects):

- **`work_budget_delete_blockers(PDO $pdo, int $id): array`** — devolve
  `['propostas' => N, 'itensProposta' => N, 'pedidos' => N]` contando:
  - `proposta_orcamento_vinculos WHERE workBudgetId = ?` (+ `GROUP_CONCAT` de `proposalId` para a mensagem);
  - `proposta_itens WHERE orcamento_item_id IN (SELECT id FROM orcamento_obra_itens WHERE workBudgetId = ?)`;
  - `purchase_order_items WHERE work_budget_item_id IN (SELECT id FROM orcamento_obra_itens WHERE workBudgetId = ?)`.
- **`work_budget_block_message(array $counts): ?string`** — função **PURA** (molde
  `sql_error_response`): tudo zero → `null` (exclusão segue); senão monta a mensagem amigável
  nomeando os vínculos (ex.: "vinculado à(s) proposta(s) 12: exclua o vínculo na proposta antes de
  excluir o orçamento"). Sem vazar SQL/nome de tabela.
- Mensagem não-nula → `fail($msg, 409)`. Zero → `delete_record` segue e as FKs cascateiam a
  composição.
- `cotacoes` **não bloqueia** (FK SET NULL resolve sozinha); `obra_cronograma_etapas` não bloqueia
  neste ciclo (fora de escopo, medição zero).

## 4. Purge no front (`removeRecord`, app.js)

Após DELETE bem-sucedido de `workBudgets`, purgar da sessão junto com o pai:

```js
if (key === "workBudgets") {
  db.workBudgetItems = (db.workBudgetItems || []).filter((it) => !sameId(it.workBudgetId, id));
  db.orcamentoEtapas = (db.orcamentoEtapas || []).filter((e) => !sameId(e.orcamento_id, id));
}
```

(Em `serverMode` o reload traria o estado certo; o purge evita fantasma até lá — mesmo espírito do
`syncWorkBudgetTotals` que já existe para `workBudgetItems` no mesmo fluxo.)

## 5. Testes

- `scripts/tests/php/test_work_budget_block.php` (molde `test_sql_error_response`, via harness sem
  banco): `work_budget_block_message` — tudo zero → null; cada contagem isolada gera mensagem que
  cita o vínculo certo; combinações somam; nenhuma mensagem vaza `SELECT`/nome de tabela; 409 é
  responsabilidade do chamador (não testável sem banco — anotado no teste).
- Guarda JS: acrescentar a `test_toast_severity.js` OU teste novo mínimo que confirme o purge no
  corpo de `removeRecord` (extração por âncora, padrão `vm`/string dos testes existentes).
- Suíte completa `run-all.sh` verde.

## 6. Versão, deploy e validação

- `APP_VERSION` → `v1.42.0` (a v1.41.0 foi tomada pela baixa com acréscimos); `?v=` incrementa
  a partir do vigente (app.js muda); changelog em README/CLAUDE.md/STATUS.md. Migration nova
  documentada.
- **Ordem de deploy (regra do dono):** limpeza (Etapas 1-3) confirmada → push → rodar a migration
  no servidor. Se o deploy chegar antes da migration manual, o `ensure_*` tenta e, no pior caso,
  loga sem derrubar.
- **Validação em produção:** (1) criar orçamento de teste com 2 itens + 1 etapa → excluir →
  conferir no banco que itens/etapas sumiram juntos; (2) criar orçamento + gerar proposta
  vinculada → tentar excluir → 409 amigável citando a proposta; (3) widget "Execução das Obras"
  segue coerente.
