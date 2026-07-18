# Design — DEP3: backup que falha de verdade e aborta o deploy

**Data:** 2026-07-18 · **Ciclo:** 2 (Onda A do backlog do estudo)
**Status:** aprovado em brainstorming
**Arquivos alvo:** `backup-pre-deploy.sh` e `deploy.php`

## Problema

`backup-pre-deploy.sh` hoje:
- `set -u` apenas — sem `pipefail`: no pipeline `mysqldump | gzip`
  (linhas 42-44), se o `mysqldump` falhar o `gzip` sai com 0 e o script
  imprime **"OK: dump salvo"** com um arquivo vazio/corrompido;
- falhas de dump/tar viram `echo "ERRO..."` e o script **termina com
  exit 0** (linhas 47-49, 57-59);
- credenciais ausentes → só "AVISO", deploy segue **sem backup do banco**
  (linha 51); pasta de uploads ausente → idem (linha 61);
- nada valida conteúdo dos arquivos; o diretório parcial conta na
  retenção dos 10.

`deploy.php` hoje: `$backupExit !== 0` vira só `[ALERTA]` no log e o
deploy **continua** (comportamento herdado; o NOVO-4 não mexeu nisso).

## Decisões

- **Obrigatórios (decisão do usuário): dump do banco E uploads.**
  Credenciais ausentes, pasta de uploads inexistente, ou falha/corrupção
  em qualquer um dos dois → backup INVÁLIDO → deploy abortado.
- **Abordagem aprovada: coletar erros e falhar no fim** — o script tenta
  dump E uploads, valida os dois, acumula falhas e sai com exit 1
  listando tudo (diagnóstico completo numa rodada). Descartadas: `set -e`
  (para na primeira falha; armadilhas com pipeline) e patch mínimo (sem
  validação/atomicidade).
- **Script ausente também aborta**: `deploy.php` com `is_file` falso hoje
  "pula" o backup; passa a ser erro fatal (configuração quebrada).

## Comportamento

### 1. `backup-pre-deploy.sh` reescrito

- `set -u -o pipefail`.
- Gera tudo em **`${BACKUP_ROOT}/.tmp-${STAMP}/`** (prefixo `.` fica fora
  do glob `*/` da retenção). No sucesso completo: `mv` para
  `${BACKUP_ROOT}/${STAMP}/` (atômico no mesmo filesystem). Na falha: o
  `.tmp-` permanece para diagnóstico (inclui `mysqldump.err`) e o script
  imprime o caminho.
- Na largada: remove `.tmp-*` com mais de 7 dias (find -mtime +7).
- **Validação de cada artefato:** arquivo existe, tamanho > 0 e
  `gzip -t` passa (vale para `banco-*.sql.gz` e `uploads.tar.gz`).
- **Acúmulo de erros:** cada falha registra uma linha `ERRO: ...` num
  array; ao final, se houver qualquer erro → imprime todas as linhas e
  `exit 1`; senão `mv` atômico + `exit 0`.
- Casos que viram ERRO (antes eram AVISO/OK falso): credenciais não
  encontradas; mysqldump falho; dump vazio/corrompido; `UPLOADS_DIR`
  inexistente; tar falho; tar vazio/corrompido; falha no `mv` final.
- Retenção dos 10 e variáveis de ambiente (`CONFIG_FILE`, `BACKUP_ROOT`,
  `UPLOADS_DIR`, `KEEP`) inalteradas. Falha na retenção NÃO é erro
  (limpeza é best-effort, como hoje).

### 2. `deploy.php` aborta sem backup válido

- Script ausente: em vez de "backup pulado", `$backupExit = 1` +
  mensagem de erro (trata igual a backup falho).
- Após o bloco do backup e ANTES do `git pull`: se `$backupExit !== 0` →
  grava o log (com a saída completa do backup) e responde **HTTP 500
  "Deploy ABORTADO — backup pré-deploy falhou"**. Nada é publicado sem
  backup válido.
- O prefixo `[ALERTA] ... FALHOU` atual morre (a falha agora é fatal e
  autoexplicativa no log); a saída do backup continua sempre no log.

### 3. Caronas aprovadas pela revisão final do NOVO-4 (mesmo ciclo)

- Anexar stderr capturado de `git rev-parse`/`merge-base` ao
  `$commitNote` nos ramos de erro (hoje descartado).
- Sentinela `$pullExit = -1` (e `$backupExit = -1`) antes dos `exec` —
  fecha a janela "exec não executou e exit ficou 0".

## O que NÃO muda

- Fluxo do deploy no sucesso (lock → backup → pull → verificação →
  `Deploy OK`); migrations (DEP4), healthcheck (DEP5), rollback (DEP6)
  ficam nos seus ciclos; nunca tocar `/etc/financeiro/config.php`,
  uploads, backups, banco.

## Ordem de implementação (etapas, 1 commit cada)

1. Reescrever `backup-pre-deploy.sh` (com testes locais);
2. `deploy.php`: abortar com 500 quando backup falhar (+ script ausente);
3. Caronas: stderr do git no log + sentinelas de exit.

## Testes

- **Local (Git Bash, sem MySQL):** o script aceita env vars — testar:
  (a) config fake sem credenciais → exit 1 com `ERRO` de credenciais e
  `ERRO` de uploads quando apontado para pasta inexistente; (b)
  `UPLOADS_DIR` fake com arquivos → tar gerado, validado (`gzip -t`) e
  diretório renomeado atomicamente (sem `.tmp-` residual); (c) retenção
  com KEEP baixo. O caminho feliz do mysqldump só é testável no servidor.
- `php -l deploy.php`; `bash -n backup-pre-deploy.sh` (sintaxe);
  `git ls-files --eol` → `i/lf w/lf` nos dois arquivos.
- **Servidor (próximo push):** valida DEP3 e NOVO-4 juntos — no sucesso,
  `deploy.log` mostra `[lock] adquirido`, backup OK com caminho final,
  `[git pull]`, `[commit] HEAD ... contém ...`; simular falha de backup
  (ex.: `BACKUP_ROOT` temporariamente sem permissão) → delivery 500
  "Deploy ABORTADO" e nada publicado.

## Risco declarado

O shebang/execução do script roda via sudoers com match exato — a
reescrita NÃO muda o caminho nem a forma de invocação (`/usr/bin/bash
<script>`), só o conteúdo. `deploy.php` segue auto-modificável: commits
pequenos + `php -l` obrigatório.
