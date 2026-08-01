-- E3: movimentos de EXTRATO ainda não classificados entram na fila como Pendentes.
-- Exclui os já resolvidos por referência viva (hoje: #4 CONTA_PAGAR→1, #150 CONTA_RECEBER→9)
-- e os já reivindicados por um título via ofxFitid (conciliações pré-v1.42 setaram o
-- fitid no título sem gravar a referência no movimento — sem esta exclusão o movimento
-- entraria como Pendente sem ter saída: aprovar bateria no UNIQUE de ofxFitid, 409).
UPDATE cash_bank_movements m
   SET m.status = 'Pendente'
 WHERE m.originDocument LIKE 'OFX%'
   AND m.status = 'Confirmado'
   AND NOT (m.referencia_tipo = 'CONTA_PAGAR' AND EXISTS (SELECT 1 FROM accounts_payable p WHERE p.id = m.referencia_id))
   AND NOT (m.referencia_tipo = 'CONTA_RECEBER' AND EXISTS (SELECT 1 FROM accounts_receivable r WHERE r.id = m.referencia_id))
   AND NOT EXISTS (SELECT 1 FROM ofx_fitids f JOIN accounts_payable p ON p.ofxFitid = f.fitid COLLATE utf8mb4_unicode_ci WHERE f.cashMoveId = m.id)
   AND NOT EXISTS (SELECT 1 FROM ofx_fitids f2 JOIN accounts_receivable r3 ON r3.ofxFitid = f2.fitid COLLATE utf8mb4_unicode_ci WHERE f2.cashMoveId = m.id);
