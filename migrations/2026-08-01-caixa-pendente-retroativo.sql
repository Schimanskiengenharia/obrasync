-- E3: movimentos de EXTRATO ainda não classificados entram na fila como Pendentes.
-- Exclui os já resolvidos por referência viva (hoje: #4 CONTA_PAGAR→1, #150 CONTA_RECEBER→9).
UPDATE cash_bank_movements m
   SET m.status = 'Pendente'
 WHERE m.originDocument LIKE 'OFX%'
   AND m.status = 'Confirmado'
   AND NOT (m.referencia_tipo = 'CONTA_PAGAR' AND EXISTS (SELECT 1 FROM accounts_payable p WHERE p.id = m.referencia_id))
   AND NOT (m.referencia_tipo = 'CONTA_RECEBER' AND EXISTS (SELECT 1 FROM accounts_receivable r WHERE r.id = m.referencia_id));
