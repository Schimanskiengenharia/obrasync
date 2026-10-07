<?php
// S3 — visualizador com lista EXPLÍCITA (sem '*') e papéis externos sem a lista de usuários.
// Contrato: default_role_view_modules()['visualizador'] é um array que cobre os
// recursos de consulta e NUNCA inclui administração do sistema nem RH/Pessoal;
// papel_externo() marca cliente_obra/fornecedor_terceiro/equipe_campo.
require __DIR__ . '/harness.php';

$vis = default_role_view_modules()['visualizador'];
t_assert(is_array($vis) && count($vis) > 20, 'visualizador e lista explicita (nao e "*")');
foreach (modulos_vedados_ao_visualizador() as $vedado) {
    t_assert(!in_array($vedado, $vis, true), "visualizador NAO ve {$vedado}");
}
foreach (['users', 'permissions', 'backupLocal', 'migration', 'auditLog', 'rhColaboradores', 'rhTiposDocumento', 'rhVencimentos', 'rhDocumentos'] as $esperado) {
    t_assert(in_array($esperado, modulos_vedados_ao_visualizador(), true), "lista de vedados contem {$esperado}");
}
foreach (['dashboard', 'projects', 'clients', 'receivable', 'payable', 'cashMoves', 'reconciliation', 'rdo', 'workBudgets', 'proposals', 'sales', 'qualidadePes', 'qualidadeFvs', 'plugins', 'sinapiReferences', 'viabilityAnalyses', 'agenda', 'kanban', 'fiscalDocuments'] as $ok) {
    t_assert(in_array($ok, $vis, true), "visualizador ve {$ok}");
}
// Nenhum sub-recurso cru (ex.: kanbanCards) — tudo mapeado ao módulo-pai.
foreach ($vis as $k) {
    t_assert(permission_module_key($k) === $k, "lista do visualizador usa a chave-pai ({$k})");
}
// Edição: visualizador continua sem nada (lista de edição não o lista).
t_assert(!isset(default_role_edit_modules()['visualizador']), 'visualizador segue sem permissao de edicao padrao');

// Papéis externos (sem lista básica de usuários no bootstrap).
foreach (['cliente_obra', 'fornecedor_terceiro', 'equipe_campo'] as $r) {
    t_assert(papel_externo($r) === true, "{$r} e papel externo");
}
foreach (['admin', 'gerente', 'financeiro', 'comercial', 'engenharia', 'gestor_obra', 'consulta', 'operador', 'visualizador'] as $r) {
    t_assert(papel_externo($r) === false, "{$r} e papel interno");
}
$fonte = (string) file_get_contents(__DIR__ . '/../../../api/index.php');
t_assert(str_contains($fonte, "if (papel_externo(\$role)) {") && str_contains($fonte, 'SELECT id, fullName FROM system_users'), 'bootstrap devolve so id+fullName referenciados para papel externo');

t_resumo('test_papeis_visualizador');
