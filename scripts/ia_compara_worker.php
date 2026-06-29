<?php
declare(strict_types=1);

/**
 * Worker CLI do comparador de orçamento da IA (ObraSync) — Fase A (análise).
 *
 * Disparado pela action ?module=ia&action=comparaStart do api/index.php:
 *   nice -n 19 php scripts/ia_compara_worker.php --job <id>
 *
 * Para cada linha do lote (ia_compara_itens): casa com a base SINAPI por código ou
 * por busca semântica (ollama_embed + cosseno contra ia_embeddings) e COMPARA o preço
 * da planilha com o da SINAPI. Classifica em ACHOU / FALTOU_IMPORTAR / COTAÇÃO PRÓPRIA.
 * NUNCA inventa preço: sem valor de um dos lados → precoMaisBaixo = 'sem_comparacao'.
 * Progresso em ia_compara_jobs; commit a cada IA_COMPARA_COMMIT_EVERY.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Worker disponível apenas via CLI.');
}

ini_set('memory_limit', '1024M');
set_time_limit(0);

// No CLI o api/index.php pula o roteamento web e entrega só as funções e as
// variáveis $config/$pdo/$resources (ver guard PHP_SAPI no topo daquele arquivo).
require __DIR__ . '/../api/index.php';

$options = getopt('', ['job:']);
$jobId = (string) ($options['job'] ?? '');
if ($jobId === '') {
    fwrite(STDERR, "Uso: php ia_compara_worker.php --job <id>\n");
    exit(1);
}

ensure_ia_tables($pdo);
ensure_ia_compara_tables($pdo);

$stmt = $pdo->prepare('SELECT * FROM ia_compara_jobs WHERE id = ? LIMIT 1');
$stmt->execute([$jobId]);
$job = $stmt->fetch();
if (!$job) {
    fwrite(STDERR, "Lote {$jobId} não encontrado em ia_compara_jobs.\n");
    exit(1);
}
if (!in_array($job['status'], ['queued', 'running'], true)) {
    fwrite(STDERR, "Lote {$jobId} já está com status '{$job['status']}'; nada a fazer.\n");
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
    $pdo->prepare('UPDATE ia_compara_jobs SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($values);
};

register_shutdown_function(static function () use ($pdo, $jobId): void {
    $error = error_get_last();
    if (!$error || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    try {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $pdo->prepare("UPDATE ia_compara_jobs SET status = 'error', errorMessage = ?, finishedAt = NOW() WHERE id = ? AND status IN ('queued','running')")
            ->execute(['Falha fatal no worker: ' . $error['message'], $jobId]);
    } catch (Throwable $ignored) {
    }
});

$total = (int) $job['total'];
$updateJob(['status' => 'running', 'startedAt' => date('Y-m-d H:i:s')]);
echo date('Y-m-d H:i:s') . " — lote {$jobId}: início (total {$total})\n";

try {
    // 1) Vetores indexados em memória (query não-bufferizada; norma pré-calculada).
    $E_origem = [];
    $E_id = [];
    $E_vec = [];
    $E_norm = [];
    $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
    $vstmt = $pdo->query('SELECT origem, origemId, embedding FROM ia_embeddings');
    while ($row = $vstmt->fetch(PDO::FETCH_ASSOC)) {
        $vec = json_decode((string) $row['embedding'], true);
        if (!is_array($vec) || !$vec) {
            continue;
        }
        $norm = 0.0;
        foreach ($vec as $v) {
            $norm += $v * $v;
        }
        if ($norm <= 0) {
            continue;
        }
        $E_origem[] = (string) $row['origem'];
        $E_id[] = (int) $row['origemId'];
        $E_vec[] = $vec;
        $E_norm[] = sqrt($norm);
    }
    $vstmt->closeCursor();
    unset($vstmt);
    $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
    $N = count($E_vec);
    $dim = $N > 0 ? count($E_vec[0]) : 0;
    echo date('Y-m-d H:i:s') . " — vetores carregados: {$N} (dim {$dim})\n";

    // 2) Mapas SINAPI por id (match semântico) e código→id (match por código).
    $compById = [];
    $compCodeToId = [];
    foreach ($pdo->query('SELECT id, code, description, unit, unitCost FROM sinapi_composicoes')->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $id = (int) $r['id'];
        $compById[$id] = ['code' => (string) $r['code'], 'description' => (string) $r['description'], 'unit' => (string) $r['unit'], 'valor' => (float) $r['unitCost']];
        $compCodeToId[(string) $r['code']] = $id;
    }
    $insById = [];
    $insCodeToId = [];
    foreach ($pdo->query('SELECT id, code, description, unit, unitPrice FROM sinapi_insumos')->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $id = (int) $r['id'];
        $insById[$id] = ['code' => (string) $r['code'], 'description' => (string) $r['description'], 'unit' => (string) $r['unit'], 'valor' => (float) $r['unitPrice']];
        $insCodeToId[(string) $r['code']] = $id;
    }

    // 3) Analisa cada item ainda sem resultado (permite retomar lote parcial).
    $upd = $pdo->prepare(
        'UPDATE ia_compara_itens
            SET statusClassificacao = ?, matchOrigem = ?, matchId = ?, matchCode = ?,
                matchDescription = ?, matchUnit = ?, matchValor = ?, similaridade = ?,
                precoMaisBaixo = ?, diferencaValor = ?, diferencaPercent = ?
          WHERE id = ?'
    );
    $items = $pdo->prepare('SELECT id, descricaoOrigem, codigoOrigem, valorUnitOrigem FROM ia_compara_itens WHERE jobId = ? AND statusClassificacao IS NULL ORDER BY id');
    $items->execute([$jobId]);
    $items = $items->fetchAll(PDO::FETCH_ASSOC);

    $processed = (int) $job['processados'];
    $failStreak = 0;
    $pdo->beginTransaction();
    $batch = 0;
    foreach ($items as $item) {
        $itemId = (int) $item['id'];
        $desc = trim((string) $item['descricaoOrigem']);
        $codigo = trim((string) ($item['codigoOrigem'] ?? ''));
        $valorPlanilha = $item['valorUnitOrigem'] !== null ? (float) $item['valorUnitOrigem'] : null;

        // 3a) Busca semântica (top1) — roda sempre para sugerir, mesmo com código.
        $bestSim = null;
        $bestIdx = null;
        if ($desc !== '' && $N > 0 && $dim > 0) {
            $embedding = null;
            for ($try = 1; $try <= 3; $try++) {
                $res = ollama_embed($desc);
                if (!empty($res['success']) && !empty($res['embedding'])) {
                    $embedding = $res['embedding'];
                    break;
                }
                usleep(300000 * $try);
            }
            if ($embedding === null) {
                if (++$failStreak >= 10) {
                    throw new RuntimeException('Ollama parou de responder após várias tentativas — análise abortada. Os itens já analisados foram preservados; reinicie para continuar.');
                }
                continue; // não conta como processado: re-rodar tenta de novo
            }
            $failStreak = 0;

            if (count($embedding) === $dim) {
                $normQ = 0.0;
                foreach ($embedding as $v) {
                    $normQ += $v * $v;
                }
                $normQ = sqrt($normQ);
                if ($normQ > 0) {
                    for ($i = 0; $i < $N; $i++) {
                        $vi = $E_vec[$i];
                        $d = 0.0;
                        for ($k = 0; $k < $dim; $k++) {
                            $d += $embedding[$k] * $vi[$k];
                        }
                        $s = $d / ($normQ * $E_norm[$i]);
                        if ($bestSim === null || $s > $bestSim) {
                            $bestSim = $s;
                            $bestIdx = $i;
                        }
                    }
                }
            }
        }

        // Top1 com dados reais da base.
        $semMatch = null;
        if ($bestIdx !== null) {
            $src = $E_origem[$bestIdx] === 'composicao' ? ($compById[$E_id[$bestIdx]] ?? null) : ($insById[$E_id[$bestIdx]] ?? null);
            if ($src) {
                $semMatch = ['origem' => $E_origem[$bestIdx], 'origemId' => $E_id[$bestIdx]] + $src
                    + ['similaridade' => round(max(0.0, min(1.0, (float) $bestSim)) * 100, 2)];
            }
        }

        // 3b) Classificação — a IA confere TODOS os itens (também os com código).
        $status = 'cotacao_propria';
        $match = null;
        $sim = null;
        if ($codigo !== '') {
            // Código na planilha: existe na base?
            $codeMatch = null;
            if (isset($compCodeToId[$codigo])) {
                $id = $compCodeToId[$codigo];
                $codeMatch = ['origem' => 'composicao', 'origemId' => $id] + $compById[$id];
            } elseif (isset($insCodeToId[$codigo])) {
                $id = $insCodeToId[$codigo];
                $codeMatch = ['origem' => 'insumo', 'origemId' => $id] + $insById[$id];
            }
            if ($codeMatch) {
                // A IA confere se o código informado bate com a descrição.
                if ($semMatch !== null && (string) $semMatch['code'] === $codigo) {
                    $status = 'achou'; // top-match semântico É o mesmo código → confirmado
                    $match = $codeMatch;
                    $sim = $semMatch['similaridade'];
                } elseif ($semMatch !== null && $bestSim !== null && $bestSim >= IA_COMPARA_ACHOU_MIN && (string) $semMatch['code'] !== $codigo) {
                    // Descrição aponta forte para OUTRO código → código informado pode estar errado.
                    $status = 'divergente';
                    $match = $semMatch; // o informado fica em codigoOrigem para o usuário comparar
                    $sim = $semMatch['similaridade'];
                } else {
                    // Semântica fraca/ambígua: confia no código informado.
                    $status = 'achou';
                    $match = $codeMatch;
                    $sim = 100.00;
                }
            } else {
                // Tem código SINAPI mas não está na nossa base — faltou importar.
                $status = 'faltou_importar';
                $match = $semMatch; // sugere o mais próximo para referência
                $sim = $semMatch['similaridade'] ?? null;
            }
        } elseif ($semMatch !== null && $bestSim !== null) {
            $sim = $semMatch['similaridade'];
            if ($bestSim >= IA_COMPARA_REVISAR_MIN) {
                // >= 80% ACHOU; 60–80% ACHOU mas com similaridade baixa (revisar no front).
                $status = 'achou';
                $match = $semMatch;
            } else {
                $status = 'cotacao_propria';
                $match = $semMatch; // mostra o mais próximo, ainda que fraco
            }
        }

        // 3c) Comparação de preço — só quando ACHOU e há os dois valores.
        $precoMaisBaixo = 'sem_comparacao';
        $diferencaValor = null;
        $diferencaPercent = null;
        $matchValor = $match['valor'] ?? null;
        if ($status === 'achou' && $valorPlanilha !== null && $matchValor !== null && $matchValor > 0) {
            $diferencaValor = round($valorPlanilha - $matchValor, 4);
            $diferencaPercent = round(($diferencaValor / $matchValor) * 100, 2);
            $rel = abs($diferencaValor) / $matchValor;
            if ($rel <= IA_COMPARA_PRECO_TOLERANCIA) {
                $precoMaisBaixo = 'igual';
            } elseif ($valorPlanilha < $matchValor) {
                $precoMaisBaixo = 'planilha';
            } else {
                $precoMaisBaixo = 'sinapi';
            }
        }

        $upd->execute([
            $status,
            $match['origem'] ?? null,
            $match['origemId'] ?? null,
            $match['code'] ?? null,
            $match['description'] ?? null,
            $match['unit'] ?? null,
            $matchValor,
            $sim,
            $precoMaisBaixo,
            $diferencaValor,
            $diferencaPercent,
            $itemId,
        ]);
        $processed++;
        if (++$batch % IA_COMPARA_COMMIT_EVERY === 0) {
            $pdo->commit();
            $updateJob(['processados' => $processed]);
            $pdo->beginTransaction();
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
    echo date('Y-m-d H:i:s') . " — lote {$jobId}: concluído ({$processed}/{$total})\n";
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $updateJob([
        'status' => 'error',
        'errorMessage' => $error->getMessage(),
        'finishedAt' => date('Y-m-d H:i:s'),
    ]);
    fwrite(STDERR, date('Y-m-d H:i:s') . " — lote {$jobId}: ERRO — {$error->getMessage()}\n");
    exit(1);
}
