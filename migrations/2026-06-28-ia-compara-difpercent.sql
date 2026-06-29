-- Migração: amplia ia_compara_itens.diferencaPercent de DECIMAL(7,2) para
-- DECIMAL(12,2). O cálculo (valorPlanilha - valorSinapi)/valorSinapi*100 estourava
-- o DECIMAL(7,2) (máx 99999.99) quando o valor SINAPI era muito pequeno, causando
-- SQLSTATE[22003]. O worker também passou a só calcular o % quando o valor SINAPI > 0.
-- Idempotente; também aplicada em runtime por ensure_ia_compara_tables() no api/index.php.

USE financeiro;

ALTER TABLE ia_compara_itens
  MODIFY diferencaPercent DECIMAL(12,2) NULL;
