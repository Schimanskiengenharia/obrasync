<?php
// S2 — permissão exigida por ação ?module= (módulo/ação → view/create/edit/delete).
// Contrato: verbo destrutivo (delete/remove/remover/cancel/cancelar/excluir/reabrir/
// apagar) casado como PALAVRA INTEIRA nos tokens camelCase/snake/kebab da ação → 'delete';
// nunca por substring. update*/early_settlement → 'edit'; leituras → 'view'; o resto
// herda o método HTTP. DELETE de sinapiReferences pelo CRUD genérico é só do admin.
require __DIR__ . '/harness.php';

// Tokens
t_assert(acao_tokens('materialExcluir') === ['material', 'excluir'], 'camelCase vira tokens');
t_assert(acao_tokens('cancel_recurrence') === ['cancel', 'recurrence'], 'snake_case vira tokens');
t_assert(acao_tokens('check-bloqueio') === ['check', 'bloqueio'], 'kebab-case vira tokens');
t_assert(acao_tokens('materialGerarConta') === ['material', 'gerar', 'conta'], 'tres palavras camelCase');
t_assert(acao_tokens('DELETE') === ['delete'], 'maiusculas viram minusculas');
t_assert(acao_tokens('') === [], 'vazio vira lista vazia');

// Ações destrutivas por POST (o furo: caíam em 'create')
$destrutivas = ['materialExcluir', 'propostaExcluir', 'materialCancelar', 'materialReabrir', 'delete', 'delete_item', 'cancel_recurrence', 'removeLogo'];
foreach ($destrutivas as $a) {
    t_assert(module_request_action('POST', ['action' => $a]) === 'delete', "POST {$a} exige delete");
}
t_assert(module_request_action('DELETE', ['action' => 'delete_item']) === 'delete', 'DELETE delete_item exige delete');

// Palavra inteira, NÃO substring: 'cancelamento' não é 'cancel', 'deleted' não é 'delete'.
t_assert(module_request_action('POST', ['action' => 'cancelamentoRelatorio']) === 'create', 'substring cancel... nao casa (palavra inteira)');
t_assert(module_request_action('POST', ['action' => 'deletedItems']) === 'create', 'substring delete... nao casa (palavra inteira)');
t_assert(module_request_action('POST', ['action' => 'materialexcluir']) === 'create', 'minusculo sem separador nao e token (contrato explicito)');

// Edição e leitura (inalterados)
t_assert(module_request_action('POST', ['action' => 'update_scope']) === 'edit', 'update_scope exige edit');
t_assert(module_request_action('POST', ['action' => 'update_item']) === 'edit', 'update_item exige edit');
t_assert(module_request_action('POST', ['action' => 'early_settlement']) === 'edit', 'early_settlement exige edit');
t_assert(module_request_action('GET', ['action' => 'list']) === 'view', 'list exige view');
t_assert(module_request_action('GET', ['action' => 'listarReferencias']) === 'view', 'listarReferencias exige view');
t_assert(module_request_action('GET', ['action' => 'downloadPdf']) === 'view', 'downloadPdf exige view');
t_assert(module_request_action('GET', ['action' => 'materialConsolidado']) === 'view', 'GET sem verbo herda o metodo (view)');
t_assert(module_request_action('GET', []) === 'view', 'GET sem acao = view');
t_assert(module_request_action('POST', []) === 'create', 'POST sem acao = create');
t_assert(module_request_action('PUT', ['action' => 'x']) === 'edit', 'PUT herda edit');

// Criação continua criação (POST com verbo não destrutivo)
foreach (['materialSalvar', 'propostaSalvar', 'materialConcluir', 'saveBulk', 'compraGerarPedido', 'importar'] as $a) {
    t_assert(module_request_action('POST', ['action' => $a]) === 'create', "POST {$a} continua create");
}

// Papel com create e sem delete: a camada que decide a AÇÃO exigida agora pede
// 'delete' para excluir — user_can/role_can consultam a coluna canDelete.
t_assert(['view' => 'canView', 'create' => 'canCreate', 'edit' => 'canEdit', 'delete' => 'canDelete'][module_request_action('POST', ['action' => 'materialExcluir'])] === 'canDelete', 'materialExcluir consulta canDelete, nao canCreate');

// DELETE de recurso crítico pelo CRUD genérico: só admin.
t_assert(recurso_delete_so_admin('sinapiReferences') === true, 'sinapiReferences: DELETE so admin');
t_assert(recurso_delete_so_admin('clients') === false, 'clients: DELETE segue a permissao normal');
$fonte = (string) file_get_contents(__DIR__ . '/../../../api/index.php');
t_assert(preg_match('/\$method === \'DELETE\' && recurso_delete_so_admin\(\$key\)\) \{\s*require_admin\(\$authUser\);/', $fonte) === 1, 'rota generica aplica require_admin no DELETE critico');

t_resumo('test_autorizacao_acoes');
