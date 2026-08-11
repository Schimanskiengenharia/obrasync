<?php
// RDO aceita HEIC: helpers puros da validação e da conversão, testados contra
// o arquivo real. A assinatura substitui a lista de MIME do store_upload no
// ramo HEIC (magic database antiga devolve application/octet-stream para HEIC
// legítimo); a conversão em si só roda no servidor — aqui trava-se o puro.
require __DIR__ . '/harness.php';

function t_heic_bytes(string $brand): string
{
    return pack('N', 24) . 'ftyp' . $brand . pack('N', 0) . $brand;
}

// rdo_heic_magic_ok — caixa ftyp no offset 4 + brand da família HEIF no offset 8
t_assert(rdo_heic_magic_ok(t_heic_bytes('heic')), 'brand heic aceito');
t_assert(rdo_heic_magic_ok(t_heic_bytes('heix')), 'brand heix aceito');
t_assert(rdo_heic_magic_ok(t_heic_bytes('mif1')), 'brand mif1 (heif generico) aceito');
t_assert(rdo_heic_magic_ok(t_heic_bytes('msf1')), 'brand msf1 aceito');
t_assert(rdo_heic_magic_ok(t_heic_bytes('HEIC')), 'brand maiusculo aceito (case-insensitive)');
t_assert(!rdo_heic_magic_ok(t_heic_bytes('isom')), 'mp4 (brand isom) recusado');
t_assert(!rdo_heic_magic_ok(t_heic_bytes('avif')), 'avif recusado');
t_assert(!rdo_heic_magic_ok("\xFF\xD8\xFF\xE0" . str_repeat("\x00", 20)), 'jpeg renomeado recusado');
t_assert(!rdo_heic_magic_ok(''), 'vazio recusado');
t_assert(!rdo_heic_magic_ok('curto'), 'arquivo curto recusado');
t_assert(!rdo_heic_magic_ok(str_repeat("\x00", 32)), 'binario aleatorio recusado');

// rdo_heif_convert_cmd — escapeshellarg nos 3 argumentos + qualidade fixa
$cmd = rdo_heif_convert_cmd('/usr/bin/heif-convert', "/tmp/a'b.heic", '/tmp/out.jpg');
t_assert(str_contains($cmd, escapeshellarg('/usr/bin/heif-convert')), 'binario escapado');
t_assert(str_contains($cmd, escapeshellarg("/tmp/a'b.heic")), 'entrada escapada');
t_assert(str_contains($cmd, escapeshellarg('/tmp/out.jpg')), 'saida escapada');
t_assert(str_contains($cmd, ' -q 85 '), 'qualidade 85 fixada');

// rdo_heic_jpg_candidatos — nome direto e primeiro da série multi-imagem
t_assert(rdo_heic_jpg_candidatos('/up/rdo/x.jpg') === ['/up/rdo/x.jpg', '/up/rdo/x-1.jpg'],
    'candidatos: nome pedido e -1.jpg do multi-imagem');

t_resumo('test_rdo_heic');
