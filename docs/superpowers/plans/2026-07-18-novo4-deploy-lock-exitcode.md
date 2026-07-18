# NOVO-4: Deploy Lock + Exit Code — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `deploy.php` deixa de responder "Deploy OK" com pull falho, serializa deploys concorrentes com flock (espera até 120s) e confirma que o commit do webhook foi publicado.

**Architecture:** Três mudanças inline no próprio `deploy.php` (97 linhas, único arquivo do sistema alterado), uma por task/commit, na ordem de menor risco: exit code → lock → verificação de commit. Happy path de sucesso permanece idêntico.

**Tech Stack:** PHP puro (sem dependências), `flock`, `git rev-parse`/`merge-base`, `exec` com exit code (mesmo padrão do backup na linha 41).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-novo4-deploy-lock-exitcode-design.md` — em dúvida, ela manda.
- **Somente** `deploy.php` é alterado. NUNCA tocar `/etc/financeiro/config.php`, uploads, backups, banco.
- Validar `php -l deploy.php` ANTES de cada commit (deploy.php quebrado quebra os próximos deploys).
- Manter **LF** (repo Unix): após cada edição rodar `grep -c $'\r' deploy.php` → esperado `0`.
- Commits: um por task, mensagens abaixo. **Sem `git push`** (manual, quando o usuário pedir; o teste real no servidor acontece após esse push).
- Repo: raiz em `outputs\`.

---

### Task 1: Exit code do `git pull`

**Files:**
- Modify: `deploy.php:48-49` (execução do pull) e `deploy.php:60-73` (log + resposta)

**Interfaces:**
- Produces: variáveis `$pullLines` (array) e `$pullExit` (int) — a Task 3 depende de `$pullExit === 0` para rodar a verificação de commit; `$output` (string) continua alimentando o log como hoje.

- [ ] **Step 1: Trocar `shell_exec` por `exec` com exit code**

Substituir (linhas 48-49):

```php
// 2) Atualização do código. Rodar git pull como alefschimanski (tem permissão no repositório).
$output = shell_exec('sudo -u alefschimanski git -C ' . escapeshellarg($appDir) . ' pull origin main 2>&1');
```

por:

```php
// 2) Atualização do código. Rodar git pull como alefschimanski (tem permissão no repositório).
//    exec com exit code: pull falho NÃO pode terminar em "Deploy OK".
$pullLines = [];
$pullExit  = 0;
exec('sudo -u alefschimanski git -C ' . escapeshellarg($appDir) . ' pull origin main 2>&1', $pullLines, $pullExit);
$output = implode("\n", $pullLines);
if ($pullExit !== 0) {
    $output = "[ERRO] git pull FALHOU (exit {$pullExit})\n" . $output;
}
```

- [ ] **Step 2: Responder 500 quando o pull falha (após gravar o log)**

Substituir (linhas 69-73):

```php
if ($issues) {
    http_response_code(500);
    die('Deploy concluído com ALERTA — arquivos protegidos ausentes: ' . implode(', ', $issues));
}
echo 'Deploy OK';
```

por:

```php
if ($pullExit !== 0) {
    http_response_code(500);
    die("Deploy FALHOU — git pull retornou exit {$pullExit}; confira {$logDir}/deploy.log");
}
if ($issues) {
    http_response_code(500);
    die('Deploy concluído com ALERTA — arquivos protegidos ausentes: ' . implode(', ', $issues));
}
echo 'Deploy OK';
```

(O log da linha 60-67 já terá sido gravado — a ordem log→resposta não muda.)

- [ ] **Step 3: Validar sintaxe e line endings**

Run: `php -l deploy.php`
Expected: `No syntax errors detected`

Run: `grep -c $'\r' deploy.php`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add deploy.php
git commit -m "fix(deploy): git pull com exit code - pull falho responde 500, nunca 'Deploy OK' (NOVO-4 etapa 1)"
```

---

### Task 2: Lock de deploy com espera (flock, timeout 120s)

**Files:**
- Modify: `deploy.php:28-29` (logo após `$appDir`/`$logDir`) — inserir o bloco de lock ANTES do backup
- Modify: `deploy.php` seção do log (`$logMsg`) — incluir a linha do lock

**Interfaces:**
- Consumes: `$logDir` (definido na linha 29).
- Produces: `$lockNote` (string) — entra no `$logMsg`. O handle `$lockHandle` fica aberto até o fim do processo (liberação automática do flock).

- [ ] **Step 1: Inserir o bloco de lock após as definições de diretório**

Logo após `$logDir = '/var/lib/financeiro';` (linha 29) e ANTES do comentário do backup, inserir:

```php
// 0) Lock de deploy: serializa execuções concorrentes (dois pushes seguidos).
//    flock é liberado pelo SO quando o processo termina — sem lock órfão em
//    crash. Se o lock não puder ser criado, o deploy SEGUE sem serialização
//    (o lock nunca é motivo de deploy parar). Espera até 120s pelo anterior.
set_time_limit(300);
$lockNote   = '';
$lockHandle = @fopen("{$logDir}/deploy.lock", 'c');
if ($lockHandle === false) {
    $lockNote = '[AVISO] lock indisponível (deploy.lock não pôde ser aberto) — deploy segue SEM serialização';
} else {
    $lockAcquired = false;
    $lockDeadline = time() + 120;
    while (time() < $lockDeadline) {
        if (flock($lockHandle, LOCK_EX | LOCK_NB)) {
            $lockAcquired = true;
            break;
        }
        sleep(1);
    }
    if (!$lockAcquired) {
        $busyMsg = date('Y-m-d H:i:s') . " — Deploy NÃO executado: ocupado (timeout de 120s aguardando outro deploy)\n---\n";
        @file_put_contents("{$logDir}/deploy.log", $busyMsg, FILE_APPEND);
        http_response_code(503);
        die('Deploy ocupado — outro deploy em andamento; redispare o webhook em alguns minutos.');
    }
    $lockNote = '[lock] adquirido';
}
```

- [ ] **Step 2: Incluir o lock no log do deploy**

Substituir o início do `$logMsg`:

```php
$logMsg = date('Y-m-d H:i:s') . " — Deploy:\n"
    . "[backup pré-deploy]\n" . trim((string) $backupOutput) . "\n"
```

por:

```php
$logMsg = date('Y-m-d H:i:s') . " — Deploy:\n"
    . ($lockNote !== '' ? $lockNote . "\n" : '')
    . "[backup pré-deploy]\n" . trim((string) $backupOutput) . "\n"
```

- [ ] **Step 3: Teste local do padrão de lock (scratchpad, não commitado)**

Criar `<scratchpad>/lock_test.php` com o mesmo padrão (fopen `c` + loop
`flock LOCK_EX|LOCK_NB` + sleep 1, timeout 10s) apontando para um arquivo
de lock no scratchpad; rodar DUAS instâncias com `run_in_background` na
primeira (ela segura o lock por 5s):

```php
<?php // lock_test.php <segurar_segundos>
$hold = (int) ($argv[1] ?? 0);
$h = fopen(__DIR__ . '/test.lock', 'c');
$t0 = time(); $ok = false;
while (time() < $t0 + 10) { if (flock($h, LOCK_EX | LOCK_NB)) { $ok = true; break; } sleep(1); }
echo ($ok ? "ADQUIRIDO após " . (time() - $t0) . "s" : "TIMEOUT") . "\n";
if ($ok && $hold > 0) sleep($hold);
```

Run: `php lock_test.php 5` (background) e ~1s depois `php lock_test.php 0`
Expected: 1ª imprime `ADQUIRIDO após 0s`; 2ª imprime `ADQUIRIDO após ~4-5s` (esperou a 1ª soltar) — nunca TIMEOUT.

- [ ] **Step 4: Validar sintaxe e line endings**

Run: `php -l deploy.php`
Expected: `No syntax errors detected`

Run: `grep -c $'\r' deploy.php`
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add deploy.php
git commit -m "feat(deploy): lock com flock serializa deploys concorrentes - espera ate 120s, 503 no timeout (NOVO-4 etapa 2)"
```

---

### Task 3: Verificação do commit publicado

**Files:**
- Modify: `deploy.php` — bloco novo após o pull (usa `$pullExit` da Task 1); linha no `$logMsg`; resposta 500 nova

**Interfaces:**
- Consumes: `$pullExit` (Task 1), `$data['after']` (payload já decodificado na linha 22), `$appDir`.
- Produces: `$commitNote` (string, entra no log) e `$commitFail` (bool, decide o 500).

- [ ] **Step 1: Inserir a verificação após o pull (antes da verificação de caminhos protegidos)**

```php
// 2b) Confirma que o commit anunciado pelo webhook está publicado: o SHA
//     "after" deve ser ancestral de (ou igual a) HEAD. Ancestral, não
//     igualdade: com dois pushes seguidos o primeiro pull já traz os dois
//     commits e HEAD legitimamente passa do "after" do primeiro webhook.
$commitNote = '';
$commitFail = false;
$afterSha   = (string) ($data['after'] ?? '');
if ($pullExit === 0) {
    if (!preg_match('/^[0-9a-f]{40}$/i', $afterSha)) {
        $commitNote = '[AVISO] payload sem SHA "after" válido — verificação de commit pulada';
    } else {
        $headLines = [];
        $headExit  = 0;
        exec('sudo -u alefschimanski git -C ' . escapeshellarg($appDir) . ' rev-parse HEAD 2>&1', $headLines, $headExit);
        $headSha = trim((string) ($headLines[0] ?? ''));
        if ($headExit !== 0) {
            $commitFail = true;
            $commitNote = "[ERRO] git rev-parse HEAD falhou (exit {$headExit})";
        } else {
            $ancestorOut  = [];
            $ancestorExit = 1;
            exec('sudo -u alefschimanski git -C ' . escapeshellarg($appDir) . ' merge-base --is-ancestor ' . escapeshellarg($afterSha) . ' HEAD 2>&1', $ancestorOut, $ancestorExit);
            if ($ancestorExit !== 0) {
                $commitFail = true;
                $commitNote = "[ERRO] HEAD ({$headSha}) não contém o commit do webhook ({$afterSha})";
            } else {
                $commitNote = "[commit] HEAD {$headSha} contém {$afterSha}";
            }
        }
    }
}
```

- [ ] **Step 2: Incluir no log e na resposta**

No `$logMsg`, após a seção `[git pull]`, acrescentar:

```php
    . ($commitNote !== '' ? $commitNote . "\n" : '')
```

E na cadeia de respostas, entre o bloco do `$pullExit` e o do `$issues`:

```php
if ($commitFail) {
    http_response_code(500);
    die("Deploy FALHOU — commit do webhook não confirmado no working tree; confira {$logDir}/deploy.log");
}
```

- [ ] **Step 3: Validar sintaxe e line endings**

Run: `php -l deploy.php`
Expected: `No syntax errors detected`

Run: `grep -c $'\r' deploy.php`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add deploy.php
git commit -m "feat(deploy): verifica commit do webhook publicado (merge-base --is-ancestor) apos o pull (NOVO-4 etapa 3)"
```

---

## Após o plano

Validação final é NO SERVIDOR e depende do usuário: `git push` autorizado →
webhook roda → conferir em `/var/lib/financeiro/deploy.log` as linhas novas
`[lock] adquirido` e `[commit] HEAD ... contém ...`, e delivery 200 no
GitHub. Só então o ciclo NOVO-4 é dado como verificado (regra
verification-before-completion).
