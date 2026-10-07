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

t_resumo('test_qualidade_regras');
