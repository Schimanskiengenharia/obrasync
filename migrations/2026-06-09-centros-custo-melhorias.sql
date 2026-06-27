-- Melhorias nos centros de custo: tipo, descrição de uso e exemplos + seed dos
-- centros padrão. Migração segura e idempotente (MariaDB 10.5+).
-- Execute no Debian:
--   mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-09-centros-custo-melhorias.sql
--
-- IMPORTANTE: a tabela real é `cost_centers` e já possui as colunas `code`
-- (código, UNIQUE), `name` (nome), `manager` e `status` ('Ativo'/'Inativo').
-- Por isso NÃO recriamos `codigo`/`nome`/`ativo` — reaproveitamos as existentes
-- e adicionamos apenas o que falta: tipo, descricao_uso e exemplos.

USE financeiro;

ALTER TABLE cost_centers
  ADD COLUMN IF NOT EXISTS tipo
    ENUM('operacional','administrativo','tecnico','financeiro') NOT NULL DEFAULT 'administrativo' AFTER name,
  ADD COLUMN IF NOT EXISTS descricao_uso TEXT NULL
    COMMENT 'O que deve ser lançado neste centro de custo' AFTER tipo,
  ADD COLUMN IF NOT EXISTS exemplos TEXT NULL
    COMMENT 'Exemplos de lançamentos para este centro' AFTER descricao_uso;

-- Centros de custo padrão: só inserem quando a tabela está vazia (instalação
-- nova). O WHERE NOT EXISTS evita duplicar em bancos que já têm cadastros.
INSERT INTO cost_centers (code, name, tipo, descricao_uso, status)
SELECT d.code, d.name, d.tipo, d.descricao_uso, 'Ativo'
FROM (
  SELECT 'ADM-01' AS code, 'Administrativo Geral' AS name, 'administrativo' AS tipo, 'Despesas do escritório: aluguel, energia, água, internet, material de escritório' AS descricao_uso
  UNION ALL SELECT 'ADM-02', 'Pessoal e RH', 'administrativo', 'Salários, pró-labore, INSS, FGTS, benefícios, rescisões'
  UNION ALL SELECT 'ADM-03', 'Veículos e Transporte', 'administrativo', 'Combustível, manutenção, IPVA, seguro veicular, pedágios'
  UNION ALL SELECT 'ADM-04', 'Equipamentos e Ferramentas', 'administrativo', 'Compra, aluguel e manutenção de equipamentos e ferramentas'
  UNION ALL SELECT 'ADM-05', 'Marketing e Comercial', 'administrativo', 'Site, publicidade, materiais de divulgação, eventos'
  UNION ALL SELECT 'ADM-06', 'Impostos e Taxas', 'financeiro', 'ISS, PIS, COFINS, IRPJ, CSLL, alvarás e licenças'
  UNION ALL SELECT 'ADM-07', 'Contabilidade e Jurídico', 'administrativo', 'Honorários de contador, advogado e outros consultores'
  UNION ALL SELECT 'ADM-08', 'TI e Sistemas', 'administrativo', 'ObraSync, softwares, domínio, hospedagem, suporte'
  UNION ALL SELECT 'ADM-09', 'Capacitação e Treinamento', 'administrativo', 'Cursos, certificações, NRs, treinamentos da equipe'
  UNION ALL SELECT 'ADM-10', 'Seguros', 'administrativo', 'Seguro obra, seguro empresa, ART/RRT'
  UNION ALL SELECT 'TEC-01', 'Obras Civis', 'tecnico', 'Materiais e mão de obra de obras civis, subempreiteiros'
  UNION ALL SELECT 'TEC-02', 'Instalações Elétricas', 'tecnico', 'Materiais elétricos, mão de obra eletricista, ART elétrica'
  UNION ALL SELECT 'TEC-03', 'Instalações Hidráulicas', 'tecnico', 'Materiais hidráulicos, mão de obra encanador'
  UNION ALL SELECT 'TEC-04', 'Cobertura e Telhado', 'tecnico', 'Telhas, estrutura metálica, mão de obra telhadista'
  UNION ALL SELECT 'TEC-05', 'Ar Condicionado e Climatização', 'tecnico', 'Equipamentos, instalação e manutenção de ar condicionado'
  UNION ALL SELECT 'TEC-06', 'Projetos e Consultoria', 'tecnico', 'Projetos arquitetônicos, estruturais, elétricos, hidráulicos'
  UNION ALL SELECT 'TEC-07', 'Manutenção Predial', 'tecnico', 'Serviços de manutenção corretiva e preventiva'
  UNION ALL SELECT 'FIN-01', 'Reserva de Capital', 'financeiro', 'Provisões, reservas, capital de giro'
  UNION ALL SELECT 'FIN-02', 'Investimentos', 'financeiro', 'Compra de equipamentos de grande valor, veículos'
  UNION ALL SELECT 'FIN-03', 'Encargos Financeiros', 'financeiro', 'Juros, tarifas bancárias, IOF, multas'
) AS d
WHERE NOT EXISTS (SELECT 1 FROM cost_centers);
