# Protocolo de Revisão Adversarial — Estudo de Benchmark (para o Codex)

**Alvo da revisão:** `docs/estudos/2026-07-estudo-benchmark-modulos.md` (67 recomendações em 8 frentes)
**Papel do revisor:** ADVERSARIAL. Seu trabalho é tentar DERRUBAR as recomendações, não confirmá-las por cortesia. Uma recomendação só sobrevive se a evidência aguentar o ataque.
**Restrições:** somente leitura — NÃO modifique `app.js`, `api/index.php` nem o estudo. Escreva o resultado APENAS no arquivo de saída indicado no fim.

## Contexto mínimo

- Repo: SPA sem build (`app.js` ~15k linhas) + `api/index.php` (~14,3k linhas) + `schema.sql`/`migrations/`. Convenções em `CLAUDE.md`.
- O estudo tem, por frente: "Como é hoje" (inventário com arquivo:linha), "Como o mercado faz"/"Opções" (com fontes), e tabela de recomendações (IDs E*, FC*, G*, AG*, KB*, FIN*, DEP*, API*).
- Há também a seção "Divergências entre os players" (escolhas de estilo) e "Fechamento" (ordem em ondas).

## Ataques a executar (para CADA recomendação)

1. **A lacuna existe mesmo?** Confira no código a afirmação do "Como é hoje" que motiva a recomendação (os arquivo:linha citados). Se a linha citada não corresponde, se a funcionalidade JÁ existe parcialmente, ou se o problema é menor do que descrito → CONTESTAR com a evidência real (arquivo:linha).
2. **O esforço está honesto?** Dado o tamanho/acoplamento real do código envolvido, o Esforço (Alto/Médio/Baixo) está subestimado? Recomendação com esforço subestimado é armadilha — AJUSTAR com justificativa.
3. **O impacto está inflado?** Para um dev solo com usuários reais de construtora, essa melhoria muda o dia a dia ou é cosmética? Se inflado → AJUSTAR.
4. **Conflita com a arquitetura/convenções?** Algo na recomendação briga com padrões do `CLAUDE.md` (ensure_*, migrations idempotentes, escape de innerHTML, timezone local M10, nunca tocar config/uploads/banco)? → CONTESTAR ou condicionar.
5. **Existe alternativa mais simples?** Se 20% do esforço resolve 80% da dor de outro jeito, proponha a alternativa (isso NÃO mata a recomendação — vira variante).
6. **Dependências erradas?** A coluna "Depende de" está correta? Falta dependência? Há ciclo?

## Ataques transversais (uma vez só)

7. **O que FALTA?** Olhando o inventário "Como é hoje" das 8 frentes: há lacuna grave que o estudo NÃO transformou em recomendação? Liste como itens NOVOS (prefixo NOVO-1, NOVO-2...).
8. **Redundâncias entre frentes:** além de E7≈API2 (já declarada), há outras recomendações que são a mesma iniciativa disfarçada?
9. **A ordem em ondas faz sentido?** A Onda 0 (DEP1-3 + E1-3) é mesmo o melhor começo? Alguma dependência entre ondas está invertida?
10. **Fontes:** aponte recomendações cuja única sustentação é página de marketing do fabricante (viés comercial) — elas precisam de ceticismo extra na decisão.

## Formato de saída (OBRIGATÓRIO)

Escreva o resultado em: `docs/estudos/2026-07-revisao-adversarial-codex-resultado.md`

```markdown
# Resultado da Revisão Adversarial (Codex) — <data>

## Veredito por recomendação
| ID | Veredito | Justificativa (com arquivo:linha quando contestar) |
|----|----------|-----------------------------------------------------|
| E1 | CONFIRMADA / CONTESTADA / AJUSTAR | ... |
(uma linha para TODAS as 67; em AJUSTAR, diga o que muda: impacto, esforço ou dependência)

## Itens novos propostos
| ID | Descrição | Evidência (arquivo:linha) | Impacto | Esforço |
| NOVO-1 | ... |

## Redundâncias encontradas
...

## Crítica à ordem em ondas
...

## Recomendações sustentadas só por marketing
...

## Resumo: top 5 contestações mais importantes
...
```

Regras finais: honestidade acima de cordialidade; toda contestação PRECISA de evidência (arquivo:linha ou fonte); na dúvida entre CONFIRMADA e CONTESTADA, escolha CONTESTADA e explique — o reconciliador decide depois.
