# Design — NOVO-3: testes automatizados mínimos

**Data:** 2026-07-19 · **Ciclo:** 4 (Onda A do backlog do estudo)
**Status:** aprovado em brainstorming
**Arquivos alvo:** `scripts/tests/` (novo) + 1 linha em `api/index.php`

## Problema

Não existe nenhuma suíte de testes no repo — o handoff exige só `php -l` e
`node --check`, manuais. Regressões em lógica de dinheiro (ex.: bug v1.25.1,
cabo a R$ 8.484 em vez de R$ 2,80 por mapeamento errado de coluna) só
aparecem em produção.

## Restrições que moldam o design

- **REGRA permanente (2026-07-19):** testes JAMAIS tocam o banco `financeiro`,
  uploads, backups ou `/etc/financeiro/config.php`.
- Ambiente local: Windows/Git Bash, PHP sem `pdo_mysql`, sem MySQL.
- `api/index.php:71-72` roda `load_config()` + `db($config)` incondicionalmente
  (CLI incluso). `load_config()` já cai em `api/config.sample.php` quando o
  config real não existe (`:1727-1734`) — o único bloqueio local é o `db()`.

## Decisões

- **Gate de teste aprovado pelo usuário (única mudança em produção):**
  `api/index.php:72` vira
  `$pdo = getenv('OBRASYNC_TESTE_SEM_DB') ? null : db($config);`
  Web e workers: variável inexistente → comportamento byte a byte igual.
  Com a variável: a biblioteca de funções REAIS carrega sem banco — testes
  testam o código de verdade, não cópias.
- **Abordagem aprovada: suíte própria enxuta** (runner bash + mini-harness
  PHP com `t_assert`), zero dependências novas. PHPUnit descartado (exige
  Composer local — YAGNI); banco de teste no servidor vira evolução futura
  (**NOVO-3b**, fora deste ciclo).

## Estrutura

```
scripts/tests/
  run-all.sh            # roda tudo; exit != 0 se qualquer teste falhar
  static-checks.sh      # php -l (api/index.php, deploy.php), node --check
                        # (app.js), bash -n (backup-pre-deploy.sh) e LF
                        # (git ls-files --eol) nos 4 arquivos
  test-backup.sh        # backup-pre-deploy.sh em diretórios temporários:
                        # (A) falha total; (B) falha parcial c/ uploads ok;
                        # (C) caminho feliz com mysqldump FAKE no PATH —
                        # valida gzip -t, atomicidade (.tmp- -> final) e
                        # retenção com KEEP=1
  php/harness.php       # putenv OBRASYNC_TESTE_SEM_DB=1 + FINANCEIRO_CONFIG
                        # apontando p/ config.sample.php; require do
                        # api/index.php REAL; t_assert()/t_resumo()
  php/test_ia_precos.php        # ia_compara_calcula_precos (função pura de
                                # dinheiro): unitário, total, % e clamps
  php/test_ia_depara_header.php # regressão v1.25.1: cabeçalho real AltoQi →
                                # G=descricao, F=codigo, H=unidade,
                                # I=quantidade, J=material, K=maoobra,
                                # L=custodireto, P=bdi; "Total*" NUNCA vira
                                # valor unitário
  php/test_log_schema_drift.php # NOVO-2 contra a função REAL: formato,
                                # dedupe por assinatura, vazio não loga
```

## Comportamento

- `bash scripts/tests/run-all.sh` roda no PC local (Git Bash) e no servidor;
  saída resumida por arquivo de teste + total; exit 0 só com tudo verde.
- Testes PHP: cada arquivo inclui `harness.php`, chama funções reais e usa
  `t_assert($cond, $mensagem)`; nenhum acesso a banco/rede/arquivos fora de
  diretórios temporários criados pelo próprio teste.
- `test-backup.sh` usa `mktemp -d` (ou scratch equivalente) para
  BACKUP_ROOT/UPLOADS_DIR/CONFIG_FILE fakes; o `mysqldump` fake é um script
  no PATH temporário que imprime SQL válido (cenário C) — nada real é lido.

## Conformidade com a REGRA de dados

Nenhum teste conecta em banco algum; `FINANCEIRO_CONFIG` aponta para o
sample; escrita só em temporários; produção não é lida nem tocada. O gate
`OBRASYNC_TESTE_SEM_DB` nunca é definido na web/workers.

## Etapas de implementação (1 commit cada)

1. Gate na linha 72 + `harness.php` + `test_ia_precos.php` (prova o conceito
   de ponta a ponta);
2. `test_ia_depara_header.php` + `test_log_schema_drift.php`;
3. `test-backup.sh` + `static-checks.sh` + `run-all.sh`.

## Critérios de sucesso

- `bash scripts/tests/run-all.sh` verde no PC do usuário;
- Sabotagem proposital (ex.: inverter um sinal em
  `ia_compara_calcula_precos`) faz a suíte falhar;
- `php -l` limpo e comportamento web/workers inalterado (gate inerte sem a
  variável).

## Fora de escopo

Testes de JS (app.js monolítico não carrega em Node sem DOM — entra com a
modularização da Frente 8); testes com banco (NOVO-3b futuro, exigirá
`financeiro_test` no servidor com aprovação do usuário); CI/CD (Opção C do
DEP foi descartada); hook pre-push (DEP1 — ciclo próprio; o runner já nasce
pronto para ele chamar).
