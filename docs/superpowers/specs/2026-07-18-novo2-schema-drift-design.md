# Design — NOVO-2: expor schema drift no insert_dynamic/update_dynamic

**Data:** 2026-07-18 · **Ciclo:** 3 (Onda A do backlog do estudo)
**Status:** aprovado em brainstorming
**Arquivo alvo:** `api/index.php` (somente)

## Problema

`insert_dynamic` (`api/index.php:14197-14209`) e `update_dynamic`
(`:14211-14219`) filtram o payload contra `table_columns()` e **descartam
em silêncio** qualquer chave que não seja coluna real. Isso é tolerância de
schema por design (auto-cura `ensure_*`), mas esconde drift real: migration
não rodada, typo de nome de campo, cópia de dados que perde colunas (caso
FC2). Ninguém fica sabendo.

**Restrição de segurança (descoberta na exploração):** o filtro é também a
barreira contra injeção via nome de coluna — os nomes são interpolados no
SQL com crases (`:14205`, `:14216`). O filtro NÃO pode ser afrouxado.

## Decisões

- **Decisão do usuário: só registrar** (não recusar). Comportamento HTTP e
  a tolerância de schema ficam intactos; recusa/allowlist só será
  considerada depois, com dados reais do log.
- **Abordagem aprovada: helper único** chamado pelas duas funções —
  cobre também os chamadores de negócio diretos (aprovação de proposta,
  IA→orçamento etc.), que são o alvo do NOVO-2.

## Comportamento

1. **Helper novo `log_schema_drift(string $op, string $table, array $dropped): void`**
   (posicionado junto de `insert_dynamic`):
   - `$dropped` vazio → retorna imediatamente;
   - dedupe por requisição: `static $logged = []`, assinatura
     `"$table|" . implode(',', $dropped)` — a mesma combinação só é logada
     uma vez por request;
   - grava `error_log('[ObraSync schema-drift] ' . $op . ' em ' . $table
     . ': colunas descartadas: ' . implode(', ', $dropped))`;
   - nunca lança exceção (best-effort, padrão `server_audit`).
2. **`insert_dynamic`:** guarda `array_keys($data)` antes do filtro;
   depois calcula `$dropped = array_values(array_diff($antes,
   array_keys($data)))` e chama `log_schema_drift('INSERT', $table,
   $dropped)` — **ANTES** do `if (!$data) throw`: drift total (todas as
   chaves descartadas) é o caso mais grave e precisa ser logado antes da
   exceção. O filtro, a exceção e o SQL não mudam.
3. **`update_dynamic`:** idem com `'UPDATE'`; o log acontece **antes** do
   early-return de `$data` vazio, pelo mesmo motivo.

## O que NÃO muda

Nenhuma resposta HTTP, nenhum campo, nenhuma migration, nenhum
comportamento do SPA. Log estruturado próprio é o E5 (Onda C); recusa de
payload não existe (decisão do usuário); correção dos drifts que o log
revelar vira item próprio.

## Implementação

Uma única etapa (helper + 2 pontos de chamada = uma unidade testável e
revisável), 1 commit.

## Testes

- `php -l api/index.php` (obrigatório antes do commit).
- Teste CLI local (scratchpad, não commitado) da lógica do helper — cópia
  standalone com `error_log` para arquivo temporário: verifica formato da
  mensagem, dedupe na mesma "requisição" e passthrough de `$dropped` vazio.
- **Validação em produção é passiva:** após o deploy, linhas
  `[ObraSync schema-drift]` no error_log do PHP são achados reais (drift ou
  typo); ausência de linhas também é resultado válido.

## Risco declarado

Risco baixo: mudança aditiva de observabilidade. Único cuidado é não tocar
no filtro (segurança). `api/index.php` tem ~14,3k linhas — edição cirúrgica
nas duas funções + helper.
