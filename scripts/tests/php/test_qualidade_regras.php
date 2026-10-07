<?php
// PBQP-H Nível B — regras PURAS do módulo de qualidade (E1: pacote 7.5).
// Primeiro teste do módulo qualidade_* (antes: zero). Cresce a cada etapa.
require __DIR__ . '/harness.php';

// ── E1-PES: aprovação registrada pelo backend ao tornar o PES Vigente ───────────
$hoje = '2026-10-07';

// Criação já Vigente (previous = null): grava quem e quando.
$p = qualidade_pes_aprovacao_plano(['status' => 'Vigente'], null, 'Alef Schimanski', $hoje);
t_assert($p === ['aprovadoPor' => 'Alef Schimanski', 'dataAprovacao' => $hoje], 'criar Vigente grava aprovador + data do PHP');

// Transição Rascunho → Vigente: grava.
$p = qualidade_pes_aprovacao_plano(['status' => 'Vigente', 'aprovadoPor' => null], ['status' => 'Rascunho'], 'Alef', $hoje);
t_assert($p !== null && $p['aprovadoPor'] === 'Alef', 'Rascunho -> Vigente grava');

// Já era Vigente e já tem aprovador (edição de texto): NÃO sobrescreve.
$p = qualidade_pes_aprovacao_plano(['status' => 'Vigente', 'aprovadoPor' => 'Fulano'], ['status' => 'Vigente', 'aprovadoPor' => 'Fulano'], 'Alef', $hoje);
t_assert($p === null, 'edicao de PES ja Vigente nao troca o aprovador');

// Vigente sem aprovador (registro anterior à E1): preenche na próxima gravação.
$p = qualidade_pes_aprovacao_plano(['status' => 'Vigente', 'aprovadoPor' => ''], ['status' => 'Vigente', 'aprovadoPor' => ''], 'Alef', $hoje);
t_assert($p !== null && $p['aprovadoPor'] === 'Alef', 'PES Vigente legado sem aprovador recebe o aprovador ao salvar');

// Obsoleto/Rascunho: nunca grava (preserva a aprovação histórica).
t_assert(qualidade_pes_aprovacao_plano(['status' => 'Obsoleto', 'aprovadoPor' => 'Fulano'], ['status' => 'Vigente'], 'Alef', $hoje) === null, 'sair de Vigente nao mexe na aprovacao');
t_assert(qualidade_pes_aprovacao_plano(['status' => 'Rascunho'], null, 'Alef', $hoje) === null, 'Rascunho nao aprova');

// Sem nome de usuário (sessão anômala): não grava vazio.
t_assert(qualidade_pes_aprovacao_plano(['status' => 'Vigente'], null, '   ', $hoje) === null, 'sem nome de usuario nao grava');

// Nome longo é truncado ao VARCHAR(120); espaços são aparados.
$p = qualidade_pes_aprovacao_plano(['status' => 'Vigente'], null, '  ' . str_repeat('a', 130) . '  ', $hoje);
t_assert($p !== null && mb_strlen($p['aprovadoPor']) === 120, 'aprovadoPor cabe em VARCHAR(120)');

// As colunas de aprovação NÃO são graváveis pelo CRUD genérico (sem digitação livre).
$pesMeta = resource_map()['qualidadePes'];
t_assert(!in_array('aprovadoPor', $pesMeta['fields'], true) && !in_array('dataAprovacao', $pesMeta['fields'], true), 'aprovadoPor/dataAprovacao fora de fields (so o backend grava)');
$limpo = clean_payload($pesMeta, ['versao' => '2', 'status' => 'Vigente', 'aprovadoPor' => 'Hacker', 'dataAprovacao' => '2000-01-01']);
t_assert(!isset($limpo['aprovadoPor']) && !isset($limpo['dataAprovacao']) && $limpo['versao'] === '2', 'payload com aprovadoPor e ignorado em silencio');

// Guardas estáticas: data pelo PHP, nunca CURDATE(); migration e ensure existem.
$fonte = (string) file_get_contents(__DIR__ . '/../../../api/index.php');
t_assert(str_contains($fonte, "qualidade_pes_aprovacao_plano(\$record, \$previous, \$nomeUsuario, date('Y-m-d'))"), 'pos_gravacao aprova com date(Y-m-d) do PHP');
t_assert(str_contains($fonte, 'function ensure_pes_aprovacao_columns'), 'ensure_pes_aprovacao_columns existe');
t_assert(is_file(__DIR__ . '/../../../migrations/2026-10-07-pbqph-e1-pes-aprovacao.sql'), 'migration aditiva da aprovacao do PES existe');

// ── E1-PQO: obsolescência com histórico (snapshot da vigente anterior) ─────────
$vig = ['status' => 'Vigente', 'versao' => '1.0', 'projectId' => 7];
t_assert(qualidade_pqo_snapshot_necessario(null, $vig) === null, 'criacao nao gera historico');
t_assert(qualidade_pqo_snapshot_necessario(['status' => 'Rascunho', 'versao' => '1.0'], $vig) === null, 'Rascunho -> Vigente nao gera historico (nada a preservar)');
t_assert(qualidade_pqo_snapshot_necessario($vig, ['status' => 'Vigente', 'versao' => '1.0', 'escopo' => 'texto editado']) === null, 'editar a vigente sem trocar a versao nao gera historico');
t_assert(qualidade_pqo_snapshot_necessario($vig, ['status' => 'Vigente', 'versao' => '1.1']) === 'Substituída pela v1.1', 'nova versao vigente guarda a anterior');
t_assert(qualidade_pqo_snapshot_necessario($vig, ['status' => 'Encerrado', 'versao' => '1.0']) === 'Vigente v1.0 passou a Encerrado', 'sair de Vigente guarda a anterior');
t_assert(qualidade_pqo_snapshot_necessario(['status' => 'Encerrado', 'versao' => '1.0'], ['status' => 'Vigente', 'versao' => '2.0']) === null, 'anterior nao vigente nao gera historico');
// Recurso de histórico: existe, mapeia para a permissão do PQO e é somente leitura.
$mapa = resource_map();
t_assert(isset($mapa['qualidadePqoVersoes']) && $mapa['qualidadePqoVersoes']['table'] === 'qualidade_pqo_versoes', 'resource qualidadePqoVersoes existe');
t_assert(permission_module_key('qualidadePqoVersoes') === 'qualidadePqo', 'historico herda a permissao do PQO');
t_assert(str_contains($fonte, "\$key === 'qualidadePqoVersoes' && \$method !== 'GET'"), 'rota generica recusa escrita no historico');
t_assert(str_contains($fonte, 'function ensure_pqo_versoes_table'), 'ensure_pqo_versoes_table existe');
t_assert(is_file(__DIR__ . '/../../../migrations/2026-10-07-pbqph-e1-pqo-versoes.sql'), 'migration aditiva do historico do PQO existe');
t_assert(str_contains((string) file_get_contents(__DIR__ . '/../../../schema.sql'), 'CREATE TABLE IF NOT EXISTS qualidade_pqo_versoes'), 'schema.sql tem qualidade_pqo_versoes');

// ── E1-caronas: DELETE de registros finais bloqueado; gate recalculado ───────────
t_assert(qualidade_delete_bloqueado('qualidadeFvs', ['status' => 'Aprovada']) !== null, 'FVS Aprovada nao pode ser excluida');
t_assert(qualidade_delete_bloqueado('qualidadeFvs', ['status' => 'Reprovada']) !== null, 'FVS Reprovada nao pode ser excluida');
t_assert(qualidade_delete_bloqueado('qualidadeFvs', ['status' => 'Pendente']) === null, 'FVS Pendente pode ser excluida');
t_assert(qualidade_delete_bloqueado('qualidadeFvm', ['status' => 'Aprovada']) !== null, 'FVM Aprovada nao pode ser excluida');
t_assert(qualidade_delete_bloqueado('qualidadeFvm', ['status' => 'Pendente']) === null, 'FVM Pendente pode ser excluida');
t_assert(qualidade_delete_bloqueado('qualidadeNc', ['status' => 'Fechada']) !== null, 'NC Fechada nao pode ser excluida');
t_assert(qualidade_delete_bloqueado('qualidadeNc', ['status' => 'Aberta']) === null, 'NC Aberta pode ser excluida (gate recalculado)');
t_assert(qualidade_delete_bloqueado('qualidadePes', ['status' => 'Vigente']) === null, 'PES nao entra na regra de status final');
t_assert(str_contains((string) qualidade_delete_bloqueado('qualidadeNc', ['status' => 'Fechada']), '7.5'), 'mensagem cita o SiAC 7.5');

t_assert(qualidade_gate_estado([], 0) === 0, 'sem FVS e sem NC: gate liberado (conclusao volta a exigir FVS)');
t_assert(qualidade_gate_estado([['id' => 9, 'status' => 'Reprovada']], 0) === 1, 'ultima FVS reprovada: bloqueia');
t_assert(qualidade_gate_estado([['id' => 9, 'status' => 'Aprovada'], ['id' => 8, 'status' => 'Reprovada']], 0) === 0, 'ultima FVS aprovada (anterior reprovada): libera');
t_assert(qualidade_gate_estado([['id' => 9, 'status' => 'Aprovada']], 2) === 1, 'NC aberta vinculada: bloqueia mesmo com FVS aprovada');
t_assert(qualidade_gate_estado([['id' => 9, 'status' => 'Pendente']], 0) === 0, 'FVS pendente sem NC: libera (ainda nao ha reprovacao)');

// Rota genérica aplica a regra e recalcula o gate.
t_assert(str_contains($fonte, "\$recusa = qualidade_delete_bloqueado(\$key, \$registro);") && str_contains($fonte, 'qualidade_recalcular_gate($pdo, $etapaAfetada);'), 'DELETE generico bloqueia registro final e recalcula o gate');

// criar_nc_automatica: data pelo PHP, nunca CURDATE().
$iNc = strpos($fonte, 'function criar_nc_automatica(');
$corpoNc = substr($fonte, $iNc, 2200);
t_assert(!str_contains($corpoNc, 'CURDATE()') && str_contains($corpoNc, "date('Y-m-d')"), 'criar_nc_automatica usa date(Y-m-d) do PHP');

// Permissões: engenharia/gestor_obra veem Política e Auditorias; operador vê o que edita.
$view = default_role_view_modules();
$edit = default_role_edit_modules();
foreach (['engenharia', 'gestor_obra'] as $r) {
    t_assert(in_array('qualidadePolitica', $view[$r], true) && in_array('qualidadeAuditorias', $view[$r], true), "{$r} ve Politica e Auditorias");
    t_assert(!in_array('qualidadePolitica', $edit[$r], true) && !in_array('qualidadeAuditorias', $edit[$r], true), "{$r} nao edita Politica/Auditorias (so view)");
}
foreach ($edit as $papel => $modulos) {
    if ($papel === 'gerente') {
        continue;
    }
    foreach ($modulos as $m) {
        if (str_starts_with($m, 'qualidade')) {
            t_assert(in_array($m, $view[$papel] ?? [], true), "{$papel}: edit em {$m} implica view");
        }
    }
}

// ── E1-fix: Política padronizada com o PES (aprovador = nome completo pelo backend) ──
$polMeta = $mapa['qualidadePolitica'];
$limpoPol = clean_payload($polMeta, ['conteudo' => 'x', 'versao' => '1.1', 'status' => 'Vigente', 'aprovadoPor' => 'alef', 'dataAprovacao' => '2026-07-05']);
t_assert(!isset($limpoPol['aprovadoPor']) && !isset($limpoPol['dataAprovacao']) && $limpoPol['versao'] === '1.1', 'Politica: aprovadoPor/dataAprovacao ignorados no CRUD (so o backend grava)');
$iPol = strpos($fonte, "if (\$key === 'qualidadePolitica' && (\$record['status'] ?? '') === 'Vigente') {");
$corpoPol = substr($fonte, $iPol, 1200);
t_assert(str_contains($corpoPol, "qualidade_pes_aprovacao_plano(\$record, \$previous, \$nomeUsuario, date('Y-m-d'))") && str_contains($corpoPol, "update_dynamic(\$pdo, 'qualidade_politica', \$id, \$aprovacao)"), 'Politica usa a mesma decisao pura do PES ao entrar em Vigente');
t_assert(is_file(__DIR__ . '/../../../scripts/sql/2026-10-07-pbqph-politica-aprovadoPor-nome-completo.sql'), 'script (nao executado) para alinhar a Politica existente');

t_resumo('test_qualidade_regras');
