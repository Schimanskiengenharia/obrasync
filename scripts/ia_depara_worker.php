<?php
declare(strict_types=1);

/**
 * Worker CLI do de-para em lote da IA (ObraSync).
 *
 * Disparado pela action ?module=ia&action=deparaStart do api/index.php:
 *   nice -n 19 php scripts/ia_depara_worker.php --job <id>
 *
 * Para cada linha do lote (ia_depara_itens), gera o embedding da descrição via
 * ollama_embed() e calcula a SIMILARIDADE DE COSSENO contra os vetores indexados em
 * ia_embeddings (mesma lógica do action=buscarSemantica), pegando o top1/top3.
 * Classifica em ACHOU / REVISAR / COTAÇÃO PRÓPRIA conforme os limiares e a presença
 * de um código SINAPI válido na planilha. Progresso em ia_depara_jobs; commit a cada
 * IA_DEPARA_COMMIT_EVERY. NUNCA inventa preço/coeficiente: os valores vêm da base.
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
    fwrite(STDERR, "Uso: php ia_depara_worker.php --job <id>\n");
    exit(1);
}

ensure_ia_tables($pdo);
ensure_ia_depara_tables($pdo);

$stmt = $pdo->prepare('SELECT * FROM ia_depara_jobs WHERE id = ? LIMIT 1');
$stmt->execute([$jobId]);
$job = $stmt->fetch();
if (!$job) {
    fwrite(STDERR, "Lote {$jobId} não encontrado em ia_depara_jobs.\n");
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
    $pdo->prepare('UPDATE ia_depara_jobs SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($values);
};

// Erro fatal (ex.: memória) não pode deixar o lote preso em "running": o polling do
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
        $pdo->prepare("UPDATE ia_depara_jobs SET status = 'error', errorMessage = ?, finishedAt = NOW() WHERE id = ? AND status IN ('queued','running')")
            ->execute(['Falha fatal no worker: ' . $error['message'], $jobId]);
    } catch (Throwable $ignored) {
    }
});

$total = (int) $job['total'];
$updateJob(['status' => 'running', 'startedAt' => date('Y-m-d H:i:s')]);
echo date('Y-m-d H:i:s') . " — lote {$jobId}: início (total {$total})\n";

try {
    // 1) Carrega os vetores indexados na memória (uma vez). Query não-bufferizada para
    //    não materializar os ~115 MB de JSON do servidor de uma vez; decodifica e
    //    guarda só o array de floats + a norma pré-calculada.
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

    // 2) Mapas dos itens reais SINAPI: por id (para o match semântico) e código→id
    //    (para o match por código, mais forte que a semântica).
    $compById = [];
    $compCodeToId = [];
    foreach ($pdo->query('SELECT id, code, description, unit, unitCost FROM sinapi_composicoes')->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $id = (int) $r['id'];
        $compById[$id] = ['code' => (string) $r['code'], 'description' => (string) $r['description'], 'unit' => (string) $r['unit'], 'valor' => (float) $r['unitCost']];
        $compCodeToId[(string) $r['code']] = $id; // referência mais recente (maior id) prevalece
    }
    $insById = [];
    $insCodeToId = [];
    foreach ($pdo->query('SELECT id, code, description, unit, unitPrice FROM sinapi_insumos')->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $id = (int) $r['id'];
        $insById[$id] = ['code' => (string) $r['code'], 'description' => (string) $r['description'], 'unit' => (string) $r['unit'], 'valor' => (float) $r['unitPrice']];
        $insCodeToId[(string) $r['code']] = $id;
    }

    // 3) Classifica cada item ainda sem resultado (permite retomar lote parcial).
    $upd = $pdo->prepare(
        'UPDATE ia_depara_itens
            SET statusClassificacao = ?, matchOrigem = ?, matchId = ?, matchCode = ?,
                matchDescription = ?, matchUnit = ?, matchValor = ?, similaridade = ?, top3Json = ?
          WHERE id = ?'
    );
    // tipoLinha='item': títulos de seção/subtotais gravados no upload não são
    // classificados (não gastar embedding com título de bloco).
    $items = $pdo->prepare("SELECT id, descricaoOrigem, codigoOrigem FROM ia_depara_itens WHERE jobId = ? AND statusClassificacao IS NULL AND tipoLinha = 'item' ORDER BY id");
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

        // 3a) Busca semântica (top3) — roda sempre para sugerir, mesmo com código.
        $best = []; // [ [simRaw, idx], ... ] ordenado desc, no máx. 3
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
                // Falhas seguidas = Ollama provavelmente fora: aborta o lote.
                if (++$failStreak >= 10) {
                    throw new RuntimeException('Ollama parou de responder após várias tentativas — classificação abortada. Os itens já classificados foram preservados; reinicie para continuar.');
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
                        if (count($best) < 3 || $s > $best[count($best) - 1][0]) {
                            $best[] = [$s, $i];
                            usort($best, static fn ($a, $b) => $b[0] <=> $a[0]);
                            if (count($best) > 3) {
                                array_splice($best, 3);
                            }
                        }
                    }
                }
            }
        }

        // 3b) Monta o top3 com os dados reais da base.
        $top3 = [];
        foreach ($best as $b) {
            [$s, $i] = $b;
            $src = $E_origem[$i] === 'composicao' ? ($compById[$E_id[$i]] ?? null) : ($insById[$E_id[$i]] ?? null);
            if (!$src) {
                continue; // vetor aponta para item removido da base
            }
            $top3[] = [
                'origem' => $E_origem[$i],
                'origemId' => $E_id[$i],
                'code' => $src['code'],
                'description' => $src['description'],
                'unit' => $src['unit'],
                'valor' => $src['valor'],
                'similaridade' => round(max(0.0, min(1.0, $s)) * 100, 2),
            ];
        }
        $top1 = $top3[0] ?? null;
        $bestSim = isset($best[0]) ? (float) $best[0][0] : null; // 0-1 cru, p/ os limiares

        // 3c) Regra de classificação — a IA confere TODOS os itens (também os com código).
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
                if ($top1 !== null && (string) $top1['code'] === $codigo) {
                    $status = 'achou'; // top-match semântico É o mesmo código → confirmado
                    $match = $codeMatch;
                    $sim = $top1['similaridade'];
                } elseif ($top1 !== null && $bestSim !== null && $bestSim >= IA_DEPARA_ACHOU_MIN && (string) $top1['code'] !== $codigo) {
                    // Descrição aponta forte para OUTRO código → código informado pode estar errado.
                    $status = 'divergente';
                    $match = $top1; // mostra o que a descrição sugere (o informado fica em codigoOrigem)
                    $sim = $top1['similaridade'];
                } else {
                    // Semântica fraca/ambígua: confia no código informado.
                    $status = 'achou';
                    $match = $codeMatch;
                    $sim = 100.00;
                }
            } else {
                // Tem código mas não está na base — faltou importar: REVISAR.
                $status = 'revisar';
                $match = $top1;
                $sim = $top1['similaridade'] ?? null;
            }
        } elseif ($top1 !== null && $bestSim !== null) {
            $sim = $top1['similaridade'];
            $match = $top1;
            if ($bestSim >= IA_DEPARA_ACHOU_MIN) {
                $status = 'achou';
            } elseif ($bestSim >= IA_DEPARA_REVISAR_MIN) {
                $status = 'revisar';
            } else {
                $status = 'cotacao_propria';
            }
        }

        $upd->execute([
            $status,
            $match['origem'] ?? null,
            $match['origemId'] ?? null,
            $match['code'] ?? null,
            $match['description'] ?? null,
            $match['unit'] ?? null,
            $match['valor'] ?? null,
            $sim,
            $top3 ? json_encode($top3, JSON_UNESCAPED_UNICODE) : null,
            $itemId,
        ]);
        $processed++;
        if (++$batch % IA_DEPARA_COMMIT_EVERY === 0) {
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
