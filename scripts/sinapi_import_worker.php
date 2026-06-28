<?php
declare(strict_types=1);

/**
 * Worker CLI da importação SINAPI em background (ObraSync).
 *
 * Disparado pela action sinapi-import-async do api/index.php:
 *   php scripts/sinapi_import_worker.php --job <id>
 *
 * Lê o job em sinapi_import_jobs (arquivos já salvos em uploads/sinapi pelos
 * campos paramsJson), processa cada planilha com o MESMO parser XLSX puro-PHP
 * do importador síncrono (parse_sinapi_file) e grava por upsert — nunca
 * DELETE + INSERT — atualizando progress/total/summaryJson para o polling do
 * frontend. Credenciais vêm de /etc/financeiro/config.php via load_config().
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Worker disponível apenas via CLI.');
}

// A planilha Referência (13 MB) expande bastante ao virar arrays PHP; no CLI o
// limite de memória padrão costuma ser -1, mas garantimos explicitamente.
ini_set('memory_limit', '-1');
set_time_limit(0);

// No CLI o api/index.php pula o roteamento web e entrega só as funções e as
// variáveis $config/$pdo/$resources (ver guard PHP_SAPI no topo daquele arquivo).
require __DIR__ . '/../api/index.php';

$options = getopt('', ['job:']);
$jobId = (string) ($options['job'] ?? '');
if ($jobId === '') {
    fwrite(STDERR, "Uso: php sinapi_import_worker.php --job <id>\n");
    exit(1);
}

ensure_sinapi_monthly_import_tables($pdo);
$stmt = $pdo->prepare('SELECT * FROM sinapi_import_jobs WHERE id = ? LIMIT 1');
$stmt->execute([$jobId]);
$job = $stmt->fetch();
if (!$job) {
    fwrite(STDERR, "Job {$jobId} não encontrado em sinapi_import_jobs.\n");
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
    $pdo->prepare('UPDATE sinapi_import_jobs SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($values);
};

// Erro fatal (estouro de memória etc.) não pode deixar o job preso em "running":
// o polling do frontend ficaria girando para sempre.
register_shutdown_function(static function () use ($pdo, $jobId): void {
    $error = error_get_last();
    if (!$error || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    try {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $pdo->prepare("UPDATE sinapi_import_jobs SET status = 'error', errorMessage = ?, finishedAt = NOW() WHERE id = ? AND status IN ('queued','running')")
            ->execute(['Falha fatal no worker: ' . $error['message'], $jobId]);
    } catch (Throwable $ignored) {
    }
});

$params = json_decode((string) ($job['paramsJson'] ?? '{}'), true) ?: [];
$files = is_array($params['files'] ?? null) ? $params['files'] : [];
$replaceExisting = !empty($params['replaceExisting']) || ((int) ($job['replaceExisting'] ?? 0) === 1);
$uf = (string) $job['uf'];
$month = (int) $job['referenceMonth'];
$year = (int) $job['referenceYear'];
$referenceType = (string) $job['referenceType'];

$updateJob(['status' => 'running', 'currentStep' => 'Iniciando a leitura dos arquivos']);
echo date('Y-m-d H:i:s') . " — job {$jobId}: início (UF {$uf}, ref {$month}/{$year}, {$referenceType})\n";

try {
    $summary = [];
    $progress = 0;
    $total = 0;
    $referenceCache = []; // priceType => id em sinapi_referencias (evita um SELECT por linha)
    $cleared = [];

    foreach (sinapi_job_file_types() as $field => $info) {
        $path = (string) ($files[$field] ?? '');
        if ($path === '') {
            continue;
        }
        if (!is_file($path)) {
            throw new RuntimeException("Arquivo de {$info['label']} não encontrado em {$path}.");
        }

        $pdo->prepare("UPDATE sinapi_import_files SET status = 'processando' WHERE jobId = ? AND storedPath = ?")->execute([$jobId, $path]);
        $updateJob(['currentStep' => "Lendo a planilha de {$info['label']} (pode levar alguns minutos)"]);
        echo date('Y-m-d H:i:s') . " — lendo {$info['label']}: {$path}\n";
        $entries = parse_sinapi_file($path, $info['fileType'], '', $uf, $month, $year, $referenceType);
        if (!$entries) {
            throw new RuntimeException("Nenhum registro reconhecido na planilha de {$info['label']} — confira se o arquivo e a UF ({$uf}) estão corretos.");
        }

        $total += count($entries);
        $updateJob(['total' => $total, 'currentStep' => "Gravando {$info['label']} no banco"]);
        echo date('Y-m-d H:i:s') . ' — ' . count($entries) . " registros de {$info['label']}\n";

        $pdo->beginTransaction();
        foreach ($entries as $entry) {
            $key = $entry['resource'];
            $priceType = (string) ($entry['priceType'] ?? $referenceType);
            $referenceCache[$priceType] ??= ensure_sinapi_reference($pdo, $resources['sinapiReferences'], $uf, $month, $year, $priceType, (string) ($entry['referenceType'] ?? $referenceType));
            $referenceId = $referenceCache[$priceType];
            $pdo->prepare('UPDATE sinapi_referencias SET importJobId = ?, importDate = CURDATE() WHERE id = ?')->execute([$jobId, $referenceId]);

            $data = $entry['data'];
            if (in_array('sinapiReferenceId', $resources[$key]['fields'], true)) {
                $data['sinapiReferenceId'] = $referenceId;
            }
            if ($key === 'sinapiCompositionItems' && empty($data['sinapiCompositionId']) && !empty($data['compositionCode'])) {
                $data['sinapiCompositionId'] = find_sinapi_composition_id($pdo, $referenceId, (string) $data['compositionCode']);
            }

            $summary[$key] ??= ['total' => 0, 'created' => 0, 'updated' => 0, 'skipped' => 0];
            $summary[$key]['total']++;
            if ($replaceExisting && empty($cleared[$referenceId][$key])) {
                sinapi_clear_reference_resource($pdo, $key, $referenceId);
                $cleared[$referenceId][$key] = true;
            }
            try {
                $result = upsert_resource_record($pdo, $resources[$key], $data, $key);
            } catch (Throwable $rowError) {
                sinapi_record_import_error($pdo, $jobId, basename($path), $info['fileType'], $summary[$key]['total'], $rowError->getMessage(), $data);
                $result = 'skipped';
            }
            $summary[$key][$result]++;
            $progress++;

            // Commits em lotes: o progresso fica visível no polling e uma falha no
            // meio não perde o que já foi gravado (upserts são idempotentes).
            if ($progress % 500 === 0) {
                $pdo->commit();
                $updateJob(['progress' => $progress, 'summaryJson' => json_encode($summary, JSON_UNESCAPED_UNICODE)]);
                $pdo->beginTransaction();
            }
        }
        if ($pdo->inTransaction()) {
            $pdo->commit();
        }
        $updateJob(['progress' => $progress, 'summaryJson' => json_encode($summary, JSON_UNESCAPED_UNICODE)]);
        $pdo->prepare("UPDATE sinapi_import_files SET status = 'concluido', rowsFound = ? WHERE jobId = ? AND storedPath = ?")->execute([count($entries), $jobId, $path]);
        unset($entries); // libera memória antes do próximo arquivo
    }

    $updateJob([
        'status' => 'done',
        'currentStep' => 'Importação concluída',
        'progress' => $progress,
        'total' => $total,
        'summaryJson' => json_encode($summary, JSON_UNESCAPED_UNICODE),
        'finishedAt' => date('Y-m-d H:i:s'),
    ]);
    echo date('Y-m-d H:i:s') . " — job {$jobId}: concluído ({$progress} registros)\n";
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $updateJob([
        'status' => 'error',
        'errorMessage' => $error->getMessage(),
        'finishedAt' => date('Y-m-d H:i:s'),
    ]);
    if (!empty($path)) {
        $pdo->prepare("UPDATE sinapi_import_files SET status = 'erro', errorMessage = ? WHERE jobId = ? AND storedPath = ?")->execute([$error->getMessage(), $jobId, (string) $path]);
    }
    sinapi_record_import_error($pdo, $jobId, !empty($path) ? basename((string) $path) : null, isset($info) ? ($info['fileType'] ?? null) : null, null, $error->getMessage());
    fwrite(STDERR, date('Y-m-d H:i:s') . " — job {$jobId}: ERRO — {$error->getMessage()}\n{$error->getTraceAsString()}\n");
    exit(1);
}
