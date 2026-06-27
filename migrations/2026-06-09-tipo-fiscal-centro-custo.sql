-- Novo tipo "Fiscal/Tributário" + lista completa dos 25 centros de custo padrão.
-- Amplia o ENUM do campo `tipo`, garante os 25 centros canônicos (INSERT IGNORE,
-- sem duplicar nem sobrescrever os já existentes) e reclassifica FIS-01/FIS-02.
-- Migração segura e idempotente (MariaDB 10.5+).
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-tipo-fiscal-centro-custo.sql
--
-- ESTRUTURA REAL (confirme antes com `DESCRIBE cost_centers;`):
--   tipo ENUM('operacional','administrativo','tecnico','financeiro')
--        NOT NULL DEFAULT 'administrativo'   (criada em 2026-06-09-centros-custo-melhorias.sql)
-- Mantemos NOT NULL ao ampliar o ENUM para não afrouxar a coluna existente.
--
-- IMPORTANTE: INSERT IGNORE só INSERE os códigos que faltam (UNIQUE em `code`).
-- Ele NÃO renomeia/atualiza centros já cadastrados. Em bancos que receberam o
-- seed antigo (onde ADM-06='Impostos e Taxas' e existia ADM-10='Seguros'), esses
-- registros permanecem como estão — confira com `SELECT code, name, tipo FROM
-- cost_centers ORDER BY code;` e ajuste manualmente se quiser alinhar à lista nova.

USE financeiro;

-- 1) Amplia o ENUM do tipo para incluir 'fiscal_tributario'.
ALTER TABLE cost_centers
  MODIFY COLUMN tipo
    ENUM('operacional','administrativo','tecnico','financeiro','fiscal_tributario')
    NOT NULL DEFAULT 'administrativo';

-- 2) Lista canônica dos 25 centros padrão. INSERT IGNORE não duplica os já
--    existentes — apenas insere os que faltam (ex.: TEC-08..10, FIN-04, FIS-01/02).
INSERT IGNORE INTO cost_centers (code, name, tipo, descricao_uso, exemplos, status) VALUES
  ('ADM-01', 'Administrativo Geral', 'administrativo', 'Despesas do escritório: aluguel, energia, água, internet, material de escritório', '', 'Ativo'),
  ('ADM-02', 'Pessoal e RH', 'administrativo', 'Salários, pró-labore, INSS, FGTS, benefícios, rescisões', '', 'Ativo'),
  ('ADM-03', 'Veículos e Transporte', 'administrativo', 'Combustível, manutenção, IPVA, seguro veicular, pedágios', '', 'Ativo'),
  ('ADM-04', 'Equipamentos e Ferramentas', 'administrativo', 'Compra, aluguel e manutenção de equipamentos e ferramentas', '', 'Ativo'),
  ('ADM-05', 'Marketing e Comercial', 'administrativo', 'Site, publicidade, materiais de divulgação, eventos', '', 'Ativo'),
  ('ADM-06', 'Contabilidade e Jurídico', 'administrativo', 'Honorários de contador, advogado e outros consultores', '', 'Ativo'),
  ('ADM-07', 'TI e Sistemas', 'administrativo', 'ObraSync, softwares, domínio, hospedagem, suporte', '', 'Ativo'),
  ('ADM-08', 'Capacitação e Treinamento', 'administrativo', 'Cursos, certificações, NRs, treinamentos da equipe', '', 'Ativo'),
  ('ADM-09', 'Seguros', 'administrativo', 'Apólices de seguro da empresa', '- Seguro de obra\n- Seguro de responsabilidade civil\n- Seguro de vida em grupo\n- Seguro do escritório\n- Seguro de equipamentos\n- Seguro de veículos', 'Ativo'),
  ('TEC-01', 'Obras Civis', 'tecnico', 'Materiais e mão de obra de obras civis, subempreiteiros', '', 'Ativo'),
  ('TEC-02', 'Instalações Elétricas', 'tecnico', 'Materiais elétricos, mão de obra eletricista, ART elétrica', '', 'Ativo'),
  ('TEC-03', 'Instalações Hidráulicas', 'tecnico', 'Materiais hidráulicos, mão de obra encanador', '', 'Ativo'),
  ('TEC-04', 'Cobertura e Telhado', 'tecnico', 'Telhas, estrutura metálica, mão de obra telhadista', '', 'Ativo'),
  ('TEC-05', 'Ar Condicionado e Climatização', 'tecnico', 'Equipamentos, instalação e manutenção de ar condicionado', '', 'Ativo'),
  ('TEC-06', 'Projetos e Consultoria', 'tecnico', 'Projetos arquitetônicos, estruturais, elétricos, hidráulicos', '', 'Ativo'),
  ('TEC-07', 'Manutenção Predial', 'tecnico', 'Serviços de manutenção corretiva e preventiva', '', 'Ativo'),
  ('TEC-08', 'Análise e Laudos Técnicos', 'tecnico', 'Análises, laudos e pareceres técnicos', '- Laudo de vistoria estrutural\n- Análise de solo (sondagem SPT)\n- Ensaio de concreto\n- Laudo de infiltração\n- Parecer técnico de patologia\n- Laudo para seguro de obra\n- Vistoria cautelar de imóvel\n- Análise de conformidade NR', 'Ativo'),
  ('TEC-09', 'Segurança do Trabalho', 'tecnico', 'Equipamentos e serviços de segurança do trabalho', '- Capacete, bota, luva\n- Cinto e talabarte\n- Óculos de proteção\n- Protetor auricular\n- Máscara respiratória\n- Colete refletivo\n- Sinalização de obra\n- PCMSO e PPRA\n- Treinamento NR-35, NR-18, NR-10\n- Técnico de segurança terceirizado', 'Ativo'),
  ('TEC-10', 'Locação de Equipamentos', 'tecnico', 'Aluguel de equipamentos pesados e especiais', '- Andaime tubular\n- Retroescavadeira\n- Miniescavadeira\n- Caminhão basculante\n- Caçamba de entulho\n- Guindaste\n- Compactador de solo\n- Betoneira\n- Gerador de energia\n- Balancim', 'Ativo'),
  ('FIS-01', 'Tributos e Impostos', 'fiscal_tributario', 'Impostos e tributos obrigatórios da empresa', '- ISS mensal\n- PIS mensal\n- COFINS mensal\n- IRPJ trimestral\n- CSLL trimestral\n- Simples Nacional mensal\n- IPTU do escritório\n- Imposto de renda pessoa jurídica', 'Ativo'),
  ('FIS-02', 'Taxas, Licenças e Anuidades', 'fiscal_tributario', 'Taxas obrigatórias, licenças e anuidades', '- Alvará de funcionamento\n- Licença ambiental\n- Taxa de bombeiros\n- Taxa de vigilância sanitária\n- ART e RRT\n- Taxa CREA anuidade\n- Taxa CAU anuidade\n- Certidões e documentos', 'Ativo'),
  ('FIN-01', 'Reserva de Capital', 'financeiro', 'Provisões, reservas, capital de giro', '', 'Ativo'),
  ('FIN-02', 'Investimentos', 'financeiro', 'Compra de equipamentos de grande valor, veículos', '', 'Ativo'),
  ('FIN-03', 'Encargos Financeiros', 'financeiro', 'Juros, tarifas bancárias, IOF, multas', '', 'Ativo'),
  ('FIN-04', 'Empréstimos e Financiamentos', 'financeiro', 'Parcelas de dívidas e financiamentos bancários', '- Parcela de empréstimo capital de giro\n- Financiamento de veículo\n- Financiamento de equipamento\n- Cartão de crédito empresarial\n- Cheque especial\n- BNDES e Pronampe\n- Financiamento imobiliário', 'Ativo');

-- 3) Reclassifica FIS-01/FIS-02 para fiscal_tributario (cobre instalações onde
--    eles já existiam com outro tipo). Idempotente.
UPDATE cost_centers SET tipo = 'fiscal_tributario' WHERE code IN ('FIS-01', 'FIS-02');
