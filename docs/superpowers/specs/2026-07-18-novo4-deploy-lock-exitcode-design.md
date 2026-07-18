# Design — NOVO-4: lock de deploy + exit code + verificação de commit

**Data:** 2026-07-18 · **Ciclo:** 1 (Onda A do backlog aprovado no estudo
`docs/estudos/2026-07-estudo-benchmark-modulos.md`)
**Status:** aprovado em brainstorming
**Arquivo alvo:** `deploy.php` (único arquivo alterado)

## Problema

`deploy.php` hoje (v. `deploy.php:48-73`):
- roda `git pull` via `shell_exec` (linha 49) — **sem exit code**: pull falho
  passa despercebido;
- responde `Deploy OK` (linha 73) sempre que os caminhos protegidos existem,
  mesmo com pull falho;
- **não tem lock**: dois webhooks simultâneos rodam dois `git pull`
  concorrentes no mesmo working tree.

## Decisões de design

- **Lock:** espera em fila com timeout (decisão do usuário) — não rejeita
  imediatamente, porque o GitHub não reenvia webhook sozinho.
- **Abordagem:** `flock` nativo no próprio `deploy.php` (aprovada) — o SO
  libera o lock automaticamente na morte do processo; zero infra nova.
  Alternativas descartadas: `mkdir` atômico (lock órfão em crash) e fila
  externa systemd/at (overkill para dev solo).

## Comportamento

### 1. Lock com espera

(As seções seguem a ordem do fluxo no arquivo; a ordem de IMPLEMENTAÇÃO é
outra — ver "Ordem de implementação" abaixo.)

- Posição: **após** validar a assinatura HMAC e o branch (requisição
  inválida não enfileira).
- Arquivo: `/var/lib/financeiro/deploy.lock` (mesmo diretório do
  `deploy.log`, já gravável pelo usuário do PHP).
- Mecânica: `fopen` + loop de `flock(LOCK_EX | LOCK_NB)` com `sleep(1)`,
  até **120 s**.
  - Conseguiu → prossegue (lock solto no fim do request ou na morte do
    processo).
  - Timeout → HTTP **503** `Deploy ocupado — outro deploy em andamento`
    + linha no log (a delivery falha fica visível no GitHub para
    redisparo manual).
  - `fopen` falhou (permissão) → **prossegue SEM lock** com
    `[AVISO] lock indisponível` no log — o lock nunca é motivo de deploy
    parar.

### 2. Exit code do `git pull`

- Trocar `shell_exec` por `exec('sudo -u ... git -C ... pull origin main
  2>&1', $pullLines, $pullExit)` (mesmo padrão já usado no backup,
  linha 41).
- `$pullExit !== 0` → log `[ERRO] git pull FALHOU (exit N)` + saída
  completa, resposta HTTP **500** com a mesma mensagem — **sem** `Deploy
  OK`. A verificação de caminhos protegidos e o log continuam rodando
  (diagnóstico completo), mas o status final é erro.
- Saída do pull permanece sempre no log (comportamento atual mantido).

### 3. Verificação do commit publicado

- Após pull com exit 0: `git rev-parse HEAD` (via `exec`, mesmo usuário
  sudo).
- Sucesso = o SHA `after` do payload do GitHub é **ancestral de ou igual
  a** HEAD: `git merge-base --is-ancestor <after> HEAD` (exit 0).
  - Ancestral, e não igualdade: com dois pushes seguidos, o primeiro pull
    já traz os dois commits e HEAD legitimamente passa do `after` do
    primeiro webhook (o lock serializa, mas não impede isso).
- Não-ancestral → `[ERRO] HEAD não contém o commit do webhook` + HTTP
  **500**.
- Payload sem `after` (redelivery incomum) → apenas `[AVISO]` no log,
  deploy segue.

## O que NÃO muda

- Caminho feliz: backup → pull → verificação de protegidos → log →
  `Deploy OK`, byte a byte igual na saída de sucesso.
- Backup falho continua NÃO bloqueando (isso é o DEP3, ciclo próprio).
- Sem run_id/notificação (DEP8), sem tocar em `/etc/financeiro/config.php`,
  uploads, backups ou banco.

## Ordem de implementação (etapas, 1 commit cada)

1. **Exit code do pull** (menor risco, maior valor);
2. **Lock com espera**;
3. **Verificação do commit**.

## Testes

- Local (PC, sem banco): `php -l deploy.php` a cada etapa; teste CLI do
  lock com dois processos concorrentes disputando o `flock` (script de
  teste dedicado, roda com o PHP local).
- Servidor (quando o usuário autorizar o push): deploy real observando
  `deploy.log` — as novas linhas `[git pull exit]`, `[lock]` e
  `[commit]` devem aparecer; delivery do webhook no GitHub deve mostrar
  200 no sucesso.

## Risco declarado

`deploy.php` é infraestrutura auto-modificável: se quebrar, quebra os
próximos deploys. Mitigação: 3 commits pequenos, `php -l` obrigatório
antes de cada um, happy path inalterado.
