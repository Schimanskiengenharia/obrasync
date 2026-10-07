<?php
// S1 — confinamento dos downloads ao upload_dir + colunas de caminho "somente upload".
// Contrato: arquivo_confinado() devolve o caminho real SÓ quando o arquivo existe e
// está dentro da base (realpath dos dois lados); ../, absoluto fora, symlink para
// fora e inexistente devolvem null. clean_payload() ignora em silêncio as colunas
// de caminho (o front pode reenviar o registro inteiro sem erro).
require __DIR__ . '/harness.php';

$raiz = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'obrasync-s1-' . bin2hex(random_bytes(4));
$base = $raiz . DIRECTORY_SEPARATOR . 'uploads';
$sub = $base . DIRECTORY_SEPARATOR . 'procedimentos';
$fora = $raiz . DIRECTORY_SEPARATOR . 'fora';
mkdir($sub, 0750, true);
mkdir($fora, 0750, true);
$valido = $sub . DIRECTORY_SEPARATOR . 'pes.pdf';
$segredo = $fora . DIRECTORY_SEPARATOR . 'segredo.txt';
file_put_contents($valido, '%PDF-1.4');
file_put_contents($segredo, 'nao pode');

// 1. caminho válido dentro da base (e dentro do subdiretório).
$r = arquivo_confinado($valido, $base);
t_assert($r !== null && realpath($valido) === $r, 'caminho valido dentro da base e aceito');
t_assert(arquivo_confinado($valido, $sub) !== null, 'base pode ser o proprio subdiretorio');

// 2. traversal com ../ saindo da base.
$traversal = $sub . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'fora' . DIRECTORY_SEPARATOR . 'segredo.txt';
t_assert(is_file($traversal), 'sanidade: o alvo do traversal existe');
t_assert(arquivo_confinado($traversal, $base) === null, 'traversal ../ fora da base e recusado');

// 3. caminho absoluto fora da base.
t_assert(arquivo_confinado($segredo, $base) === null, 'absoluto fora da base e recusado');

// 4. inexistente (dentro ou fora) → null.
t_assert(arquivo_confinado($sub . DIRECTORY_SEPARATOR . 'nao-existe.pdf', $base) === null, 'inexistente dentro da base e null');
t_assert(arquivo_confinado('', $base) === null, 'caminho vazio e null');
t_assert(arquivo_confinado($valido, $raiz . DIRECTORY_SEPARATOR . 'base-inexistente') === null, 'base inexistente e null');

// 5. symlink DENTRO da base apontando para FORA: realpath resolve o alvo → recusado.
$link = $sub . DIRECTORY_SEPARATOR . 'link-para-fora.pdf';
$symlinkOk = false;
try {
    $symlinkOk = @symlink($segredo, $link);
} catch (Throwable $e) {
    $symlinkOk = false;
}
if ($symlinkOk) {
    t_assert(arquivo_confinado($link, $base) === null, 'symlink dentro da base apontando para fora e recusado');
} else {
    // Windows sem privilégio de symlink: a asserção roda no servidor (Linux).
    echo "aviso: symlink() indisponivel aqui; asserção de symlink pulada (roda no servidor)\n";
}

// 6. prefixo enganoso: /uploads-outro/ não é /uploads/ (a barra final conta).
$enganoso = $raiz . DIRECTORY_SEPARATOR . 'uploads-outro';
mkdir($enganoso, 0750, true);
file_put_contents($enganoso . DIRECTORY_SEPARATOR . 'x.pdf', 'x');
t_assert(arquivo_confinado($enganoso . DIRECTORY_SEPARATOR . 'x.pdf', $base) === null, 'diretorio irmao com mesmo prefixo e recusado');

// 7. colunas "somente upload": o CRUD genérico as ignora SEM erro.
$mapa = resource_map();
$pes = clean_payload($mapa['qualidadePes'], ['versao' => '2', 'status' => 'Vigente', 'arquivoPdf' => '/etc/passwd', 'arquivoNome' => 'x', 'arquivoData' => '2026-10-06']);
t_assert(!array_key_exists('arquivoPdf', $pes) && !array_key_exists('arquivoNome', $pes) && !array_key_exists('arquivoData', $pes), 'PES: arquivoPdf/arquivoNome/arquivoData ignorados pelo PUT generico');
t_assert(($pes['versao'] ?? null) === '2' && ($pes['status'] ?? null) === 'Vigente', 'PES: demais campos continuam gravaveis');

$venda = clean_payload($mapa['sales'], ['number' => 'C-1', 'proposta_assinada_path' => '/etc/passwd', 'contrato_gerado_path' => '/x', 'contrato_assinado_path' => '/y']);
t_assert(!isset($venda['proposta_assinada_path']) && !isset($venda['contrato_gerado_path']) && !isset($venda['contrato_assinado_path']), 'contrato: *_path ignorados pelo PUT generico');
t_assert(($venda['number'] ?? null) === 'C-1', 'contrato: number continua gravavel');

$nf = clean_payload($mapa['fiscalDocuments'], ['documentNumber' => '123', 'pdfPath' => '/etc/passwd', 'xmlPath' => '/etc/shadow']);
t_assert(!isset($nf['pdfPath']) && !isset($nf['xmlPath']) && ($nf['documentNumber'] ?? null) === '123', 'NF: pdfPath/xmlPath ignorados, documentNumber mantido');

// Só campos protegidos no payload → array vazio (o CRUD responde 400 "Nenhum campo
// válido", que é o comportamento já existente para payload sem campo util).
t_assert(clean_payload($mapa['qualidadePes'], ['arquivoPdf' => '/etc/passwd']) === [], 'payload so com campo protegido vira vazio');

// A lista de campos protegidos cobre exatamente as tabelas com download por caminho gravado.
$protegidos = campos_somente_upload();
t_assert(isset($protegidos['qualidade_pes'], $protegidos['sales_contracts'], $protegidos['fiscal_documents']), 'campos_somente_upload cobre PES, contrato e NF');
foreach ($protegidos as $tabela => $campos) {
    foreach ($mapa as $meta) {
        if ($meta['table'] === $tabela) {
            foreach ($campos as $campo) {
                t_assert(in_array($campo, $meta['fields'], true), "campo protegido {$tabela}.{$campo} existe em fields (senao a protecao e inutil)");
            }
        }
    }
}

// 8. S1-fix — política de obra arquivada por origem (S5 opção 1):
//    NF (pdf/xml) e contrato continuam baixáveis com a obra arquivada (só exigem o
//    registro-pai); foto de RDO e anexo de viabilidade ficam bloqueados.
t_assert(download_bloqueia_obra_arquivada('fiscal_documents') === false, 'NF (pdf/xml) baixavel com obra arquivada');
t_assert(download_bloqueia_obra_arquivada('sales_contracts') === false, 'contrato baixavel com obra arquivada');
t_assert(download_bloqueia_obra_arquivada('obra_rdo_fotos') === true, 'foto de RDO bloqueada com obra arquivada');
t_assert(download_bloqueia_obra_arquivada('viabilidade_anexos') === true, 'anexo de viabilidade bloqueado com obra arquivada');
t_assert(download_bloqueia_obra_arquivada('qualidade_pes') === false, 'PES nao tem obra: nunca bloqueia por arquivamento');
// Os 4 handlers consultam a política (senão a regra vira letra morta).
$fonte = (string) file_get_contents(__DIR__ . '/../../../api/index.php');
foreach (['fiscal_documents', 'sales_contracts', 'obra_rdo_fotos', 'viabilidade_anexos'] as $origem) {
    t_assert(str_contains($fonte, "download_bloqueia_obra_arquivada('{$origem}')"), "handler de {$origem} consulta download_bloqueia_obra_arquivada");
}

// Limpeza.
foreach ([$link, $valido, $segredo, $enganoso . DIRECTORY_SEPARATOR . 'x.pdf'] as $f) {
    if (is_file($f) || is_link($f)) {
        @unlink($f);
    }
}
foreach ([$sub, $base, $fora, $enganoso, $raiz] as $d) {
    @rmdir($d);
}

t_resumo('test_arquivo_confinado');
