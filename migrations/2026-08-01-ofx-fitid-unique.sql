-- E2: UNIQUE no vínculo OFX dos títulos — fecha a corrida de dois vínculos
-- simultâneos no mesmo FITID (TOCTOU do pré-check do ofx-vincular). UNIQUE aceita
-- múltiplos NULL: só valores preenchidos são únicos. O índice simples antigo
-- (idx_pay_fitid/idx_rec_fitid) permanece — migration só aditiva.
ALTER TABLE accounts_payable ADD UNIQUE INDEX IF NOT EXISTS uk_pay_fitid (ofxFitid);
ALTER TABLE accounts_receivable ADD UNIQUE INDEX IF NOT EXISTS uk_rec_fitid (ofxFitid);
