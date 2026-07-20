<?php
// Regressão do bug v1.25.1 (cabo a R$ 8.484 em vez de R$ 2,80): coluna de
// TOTAL casava como valor unitário por match "contém". O contrato atual é
// chave normalizada EXATA + "total*" sempre ignorado.
require __DIR__ . '/harness.php';

// Normalização remove marca monetária e pontuação sem deixar lixo.
t_assert(ia_depara_norm('Custo Direto Unit. (R$)') === 'custo direto unit', 'norm custo direto');
t_assert(ia_depara_norm('M.O. Unit. (R$)') === 'm o unit', 'norm m.o.');
t_assert(ia_depara_norm('BDI (%)') === 'bdi', 'norm bdi');

// Cabeçalho real AltoQi (v1.25.1): cada coluna no campo certo.
t_assert(ia_depara_map_header('Descrição') === 'descricao', 'descricao');
t_assert(ia_depara_map_header('Código') === 'codigo', 'codigo');
t_assert(ia_depara_map_header('Unidade') === 'unidade', 'unidade');
t_assert(ia_depara_map_header('Quantidade') === 'quantidade', 'quantidade');
t_assert(ia_depara_map_header('Material Unit. (R$)') === 'material', 'material unit');
t_assert(ia_depara_map_header('M.O. Unit. (R$)') === 'maoobra', 'maoobra unit');
t_assert(ia_depara_map_header('Custo Direto Unit. (R$)') === 'custodireto', 'custo direto');
t_assert(ia_depara_map_header('BDI (%)') === 'bdi', 'bdi');

// O CERNE do bug: colunas de TOTAL nunca viram valor unitário (nem nada).
t_assert(ia_depara_map_header('Total Material (R$)') === null, 'total material ignorado');
t_assert(ia_depara_map_header('Total M.O. (R$)') === null, 'total mo ignorado');
t_assert(ia_depara_map_header('Total (R$)') === null, 'total ignorado');

// "Item" é descrição FRACA (nº WBS) — mapeia, mas a preferência forte é testada
// pela função ia_depara_header_is_strong_desc.
t_assert(ia_depara_map_header('Item') === 'descricao', 'item vira descricao fraca');
t_assert(ia_depara_header_is_strong_desc('Descrição') === true, 'descricao e forte');
t_assert(ia_depara_header_is_strong_desc('Item') === false, 'item nao e forte');

t_resumo('test_ia_depara_header');
