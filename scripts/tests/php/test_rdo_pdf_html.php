<?php
// RDO PDF por download: helpers puros e o builder do documento, testados
// contra o arquivo real. O dompdf em si só roda no servidor (composer) —
// aqui trava-se o HTML: escapes, máscaras, datas pela string (M10) e as
// regras de assinatura (Geral + disciplinas que atuaram com responsável).
require __DIR__ . '/harness.php';

// rdo_pdf_cpf_fmt — máscara 000.000.000-00 (espelho do rdoCpfFmt do front)
t_assert(rdo_pdf_cpf_fmt('12345678901') === '123.456.789-01', 'cpf com 11 digitos mascarado');
t_assert(rdo_pdf_cpf_fmt('') === 'não informado', 'cpf vazio vira nao informado');
t_assert(rdo_pdf_cpf_fmt(null) === 'não informado', 'cpf null vira nao informado');
t_assert(rdo_pdf_cpf_fmt('123') === '123', 'cpf curto sai como veio');
t_assert(rdo_pdf_cpf_fmt('111.222.333-44') === '111.222.333-44', 'cpf ja pontuado remascara igual');

// rdo_pdf_data_br — pela STRING, sem Date/UTC (regra M10)
t_assert(rdo_pdf_data_br('2026-08-11') === '11/08/2026', 'data pura vira DD/MM/AAAA');
t_assert(rdo_pdf_data_br('2026-08-11 17:30:00') === '11/08/2026 17:30', 'timestamp vira DD/MM/AAAA HH:MM');
t_assert(rdo_pdf_data_br('lixo') === 'lixo', 'fora do padrao sai como veio');
t_assert(rdo_pdf_data_br(null) === '', 'null vira vazio');

// rdo_pdf_esc
t_assert(rdo_pdf_esc('<b>&"') === '&lt;b&gt;&amp;&quot;', 'escape de html completo');

// rdo_pdf_documento_html — documento completo
$rdo = [
    'numeroSequencial' => 12,
    'data' => '2026-08-11',
    'condicaoTrabalho' => 'Praticável',
    'climaManha' => 'Sol', 'climaTarde' => 'Nublado', 'climaNoite' => '',
    'atividades' => "Linha 1\nLinha 2",
    'ocorrencias' => '',
    'observacoes' => 'Obs',
    'efetivo' => [['funcao' => 'Pedreiro', 'quantidade' => 3]],
    'equipamentos' => [['nome' => 'Betoneira', 'quantidade' => 1, 'situacao' => 'OK']],
    'disciplinas' => [
        ['disciplinaNome' => 'Elétrica', 'atuouNoDia' => 1, 'responsavelUserId' => 5, 'responsavelNome' => 'Ana', 'responsavelCpf' => '12345678901', 'assinado' => 1, 'assinadoEm' => '2026-08-11 17:30:00'],
        ['disciplinaNome' => 'Hidráulica', 'atuouNoDia' => 0, 'responsavelUserId' => 6, 'responsavelNome' => 'Bruno', 'responsavelCpf' => null, 'assinado' => 0, 'assinadoEm' => null],
    ],
    'assinaturas' => [],
    'responsavelGeralNome' => 'Carlos',
    'responsavelGeralCpf' => '98765432100',
    'createdAt' => '2026-08-11 08:00:00',
];
$empresa = ['name' => 'Schimanski <Engenharia>', 'document' => '00.000.000/0001-00'];
$fotos = [['src' => 'data:image/jpeg;base64,QUJD', 'legenda' => 'Fundação <a>']];
$html = rdo_pdf_documento_html($rdo, $empresa, 'Obra <b>Teste</b>', $fotos, null);

t_assert(str_contains($html, 'Relatório Diário de Obra'), 'titulo do documento presente');
t_assert(str_contains($html, 'RDO Nº 12'), 'numero sequencial presente');
t_assert(str_contains($html, 'Obra &lt;b&gt;Teste&lt;/b&gt;'), 'nome da obra ESCAPADO');
t_assert(str_contains($html, 'Schimanski &lt;Engenharia&gt;'), 'nome da empresa ESCAPADO');
t_assert(str_contains($html, '11/08/2026'), 'data do RDO em formato BR');
t_assert(str_contains($html, 'Linha 1<br>Linha 2'), 'quebra de linha das atividades vira <br>');
t_assert(!str_contains($html, 'Ocorrências'), 'bloco vazio (ocorrencias) nao aparece');
t_assert(str_contains($html, 'Pedreiro') && str_contains($html, 'Betoneira'), 'tabelas de efetivo e equipamentos');
t_assert(str_contains($html, 'data:image/jpeg;base64,QUJD'), 'foto embutida como data URI');
t_assert(str_contains($html, 'Fundação &lt;a&gt;'), 'legenda da foto ESCAPADA');
t_assert(str_contains($html, 'Carlos') && str_contains($html, '987.654.321-00'), 'bloco de assinatura do criador com CPF mascarado');
t_assert(str_contains($html, 'pendente'), 'criador sem assinatura registrada = pendente');
t_assert(str_contains($html, 'Ana') && str_contains($html, '123.456.789-01') && str_contains($html, '11/08/2026 17:30'), 'disciplina que atuou assina com data');
t_assert(!str_contains($html, 'Bruno'), 'disciplina que NAO atuou fica fora das assinaturas');
t_assert(!str_contains($html, '<img class="doc-logo"'), 'sem logoDataUri nao ha tag de logo');

$comLogo = rdo_pdf_documento_html($rdo, $empresa, 'Obra', [], 'data:image/png;base64,AAA=');
t_assert(str_contains($comLogo, 'data:image/png;base64,AAA='), 'logo embutida quando informada');
t_assert(!str_contains($comLogo, 'Registro fotográfico'), 'sem fotos nao ha secao fotografica');

t_resumo('test_rdo_pdf_html');
