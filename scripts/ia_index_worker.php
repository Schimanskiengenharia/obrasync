<?php
declare(strict_types=1);

/**
 * Worker CLI da indexação IA da base SINAPI (ObraSync).
 *
 * Disparado pela action ?module=ia&action=startIndex do api/index.php:
 *   nice -n 19 php scripts/ia_index_worker.php --job <id>
 *
 * Percorre sinapi_composicoes e sinapi_insumos, monta o texto (descrição + unidade),
 * gera o embedding via ollama_embed() (all-minilm, 384 floats, UMA chamada por vez —
 * NUM_PARALLEL=1 no Ollama) e grava em ia_embeddings por upsert (origem+origemId),
 * idempotente: re-rodar não duplica e retoma de onde parou. Progresso em ia_index_jobs.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Worker disponível apenas via CLI.');
}

ini_set('memory_limit', '512M');
set_time_limit(0);

// No CLI o api/index.php pula o roteamento web e entrega só as funções e as
// variáveis $config/$pdo/$resources (ver guard PHP_SAPI no topo daquele arquivo).
require __DIR__ . '/../api/index.php';

$options = getopt('', ['job:']);
$jobId = (string) ($options['job'] ?? '');
if ($jobId === '') {
    fwrite(STDERR, "Uso: php ia_index_worker.php --job <id>\n");
    exit(1);
}

ensure_ia_tables($pdo);
$stmt = $pdo->prepare('SELECT * FROM ia_index_jobs WHERE id = ? LIMIT 1');
$stmt->execute([$jobId]);
$job = $stmt->fetch();
if (!$job) {
    fwrite(STDERR, "Job {$jobId} não encontrado em ia_index_jobs.\n");
    exit(1);
}
if (!in_array($job['status'], ['queued', 'running'], true)) {
    fwrite(STDERR, "Job {$jobId} já está com status '{$job['status']}'; nada a fazer.\n");
    exit(0);
}

$updateJob = static function (array $fields) use ($pdo, $jobId): void {
    $sets = [];
    $values = [];
    foreach ($fields as $column => $value) {
        $sets[] = "`{$column}` = ?";
        $values[] = $value;
    }
    $values[] = $jobId;
    $pdo->prepare('UPDATE ia_index_jobs SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($values);
};

// Erro fatal (ex.: memória) não pode deixar o job preso em "running": o polling do
// frontend ficaria girando para sempre.
register_shutdown_function(static function () use ($pdo, $jobId): void {
    $error = error_get_last();
    if (!$error || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    try {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $pdo->prepare("UPDATE ia_index_jobs SET status = 'error', errorMessage = ?, finishedAt = NOW() WHERE id = ? AND status IN ('queued','running')")
            ->execute(['Falha fatal no worker: ' . $error['message'], $jobId]);
    } catch (Throwable $ignored) {
    }
});

$total = (int) $job['total'];
$updateJob(['status' => 'running', 'startedAt' => date('Y-m-d H:i:s')]);
echo date('Y-m-d H:i:s') . " — job {$jobId}: início (total {$total})\n";

try {
    // Textos já indexados (origem:origemId → texto) para pular o que não mudou.
    $existing = [];
    foreach ($pdo->query('SELECT origem, origemId, texto FROM ia_embeddings')->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $existing[$row['origem'] . ':' . (int) $row['origemId']] = (string) $row['texto'];
    }

    $upsert = $pdo->prepare(
        'INSERT INTO ia_embeddings (origem, origemId, code, texto, embedding, sinapiReferenceId)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE code = VALUES(code), texto = VALUES(texto),
             embedding = VALUES(embedding), sinapiReferenceId = VALUES(sinapiReferenceId)'
    );

    $processed = (int) $job['processados'];
    $failStreak = 0;
    $sources = [
        ['origem' => 'composicao', 'sql' => 'SELECT id, code, description, unit, sinapiReferenceId FROM sinapi_composicoes ORDER BY id'],
        ['origem' => 'insumo', 'sql' => 'SELECT id, code, description, unit, sinapiReferenceId FROM sinapi_insumos ORDER BY id'],
    ];

    $pdo->beginTransaction();
    $batch = 0;
    foreach ($sources as $src) {
        $origem = $src['origem'];
        // fetchAll antes do loop: evita query não-bufferizada ativa durante os commits.
        foreach ($pdo->query($src['sql'])->fetchAll(PDO::FETCH_ASSOC) as $item) {
            $origemId = (int) $item['id'];
            $texto = trim((string) $item['description'] . ' ' . (string) $item['unit']);
            $key = $origem . ':' . $origemId;

            // Já indexado e inalterado → pula (permite retomar uma indexação parcial).
            if (isset($existing[$key]) && $existing[$key] === $texto) {
                $processed++;
                if (++$batch % 50 === 0) {
                    $pdo->commit();
                    $updateJob(['processados' => $processed]);
                    $pdo->beginTransaction();
                }
                continue;
            }
            if ($texto === '') {
                $processed++;
                continue;
            }

            // Embedding sequencial. Retry para falhas transitórias do Ollama.
            $embedding = null;
            for ($try = 1; $try <= 3; $try++) {
                $res = ollama_embed($texto);
                if (!empty($res['success']) && !empty($res['embedding'])) {
                    $embedding = $res['embedding'];
                    break;
                }
                usleep(300000 * $try);
            }
            if ($embedding === null) {
                // Várias falhas seguidas = Ollama provavelmente fora: aborta como erro.
                if (++$failStreak >= 10) {
                    throw new RuntimeException('Ollama parou de responder após várias tentativas — indexação abortada. Os itens já indexados foram preservados; reinicie para continuar.');
                }
                continue; // não conta como processado: re-rodar tenta de novo
            }
            $failStreak = 0;

            $upsert->execute([
                $origem,
                $origemId,
                (string) ($item['code'] ?? ''),
                $texto,
                json_encode($embedding),
                ($item['sinapiReferenceId'] ?? null) ?: null,
            ]);
            $processed++;
            if (++$batch % 50 === 0) {
                $pdo->commit();
                $updateJob(['processados' => $processed]);
                $pdo->beginTransaction();
            }
        }
    }
    if ($pdo->inTransaction()) {
        $pdo->commit();
    }
    $updateJob([
        'status' => 'done',
        'processados' => $processed,
        'finishedAt' => date('Y-m-d H:i:s'),
    ]);
    echo date('Y-m-d H:i:s') . " — job {$jobId}: concluído ({$processed}/{$total})\n";
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $updateJob([
        'status' => 'error',
        'errorMessage' => $error->getMessage(),
        'finishedAt' => date('Y-m-d H:i:s'),
    ]);
    fwrite(STDERR, date('Y-m-d H:i:s') . " — job {$jobId}: ERRO — {$error->getMessage()}\n");
    exit(1);
}
