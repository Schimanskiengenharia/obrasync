<?php
// Classificação de erro SQL do CRUD genérico, testada contra a função REAL.
//
// Contexto: o 500 do Kanban (2026-07-28) veio de SQLSTATE 22003 — `ordem INT`
// recebendo Date.now() em milissegundos (831x o máximo de INT). Como 22003 está
// FORA da classe 23000, não era convertido em resposta amigável e virava o 500
// genérico do catch global. O mesmo padrão já havia mordido no comparador de IA
// (v1.24.2, também 22003). Esta suíte trava o comportamento para o sistema todo.
require __DIR__ . '/harness.php';

// ── 23000 (integridade) — comportamento histórico, não pode regredir ─────────
$r = sql_error_response('23000', 'create');
t_assert($r !== null && $r['status'] === 409, '23000 no create vira 409');

$r = sql_error_response('23000', 'delete');
t_assert($r !== null && $r['status'] === 409, '23000 no delete vira 409');
t_assert(str_contains($r['message'] ?? '', 'excluir'), '23000 no delete fala em excluir');

$r = sql_error_response('23000', 'update');
t_assert($r !== null && str_contains($r['message'] ?? '', 'duplicado'), '23000 no update fala em duplicado');

// ── 22xxx (dado inválido) — o que causou o 500 do Kanban ────────────────────
$r = sql_error_response('22003', 'create');
t_assert($r !== null, '22003 NAO sobe mais para o catch global');
t_assert($r['status'] === 422, '22003 vira 422 (dado do usuario, nao falha do servidor)');
t_assert(str_contains($r['message'] ?? '', 'limite'), '22003 explica que o valor excede o limite');

$r = sql_error_response('22007', 'create');
t_assert($r !== null && $r['status'] === 422, '22007 (data invalida) vira 422');
t_assert(str_contains($r['message'] ?? '', 'data'), '22007 fala em data');

$r = sql_error_response('22001', 'update');
t_assert($r !== null && $r['status'] === 422, '22001 (texto longo demais) vira 422');

// Qualquer outro 22xxx cai no genérico da classe, sem virar 500.
$r = sql_error_response('22P02', 'create');
t_assert($r !== null && $r['status'] === 422, '22 desconhecido vira 422 generico');

// ── O que NÃO pode ser capturado: precisa subir para investigação ───────────
t_assert(sql_error_response('42S02', 'create') === null, '42S02 (tabela inexistente) sobe: e bug de deploy');
t_assert(sql_error_response('42S22', 'create') === null, '42S22 (coluna inexistente) sobe: e schema drift');
t_assert(sql_error_response('HY000', 'create') === null, 'HY000 (generico) sobe');
t_assert(sql_error_response('08S01', 'create') === null, '08S01 (conexao) sobe');
t_assert(sql_error_response(null, 'create') === null, 'sqlstate ausente sobe');
t_assert(sql_error_response('', 'create') === null, 'sqlstate vazio sobe');

// ── Nenhuma mensagem pode vazar detalhe técnico ao cliente ──────────────────
foreach ([['23000', 'create'], ['23000', 'delete'], ['22003', 'create'], ['22007', 'update'], ['22001', 'create']] as [$state, $ctx]) {
    $msg = sql_error_response($state, $ctx)['message'] ?? '';
    $vazou = preg_match('/SQLSTATE|INSERT |UPDATE |SELECT |\bkanban_|\bcolumn\b/i', $msg) === 1;
    t_assert(!$vazou, "mensagem de {$state}/{$ctx} nao vaza SQL nem nome de tabela");
    t_assert($msg !== '', "mensagem de {$state}/{$ctx} nao pode ser vazia");
}

t_resumo('test_sql_error_response');
