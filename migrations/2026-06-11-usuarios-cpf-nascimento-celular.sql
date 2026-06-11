-- Novos campos cadastrais obrigatórios dos usuários do sistema.
-- O banco guarda apenas dígitos (cpf/celular) e data ISO (data_nascimento);
-- as máscaras 000.000.000-00, (00) 00000-0000 e DD/MM/AAAA são só do frontend.
-- A API também cria estas colunas sob demanda (ensure_users_extra_columns);
-- esta migration existe para instalações novas e execução manual documentada.

ALTER TABLE system_users
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(14) NULL,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE NULL,
  ADD COLUMN IF NOT EXISTS celular VARCHAR(15) NULL;

-- Índice único separado: UNIQUE em coluna NULL permite vários usuários antigos
-- sem CPF e ainda bloqueia CPF repetido entre os preenchidos.
CREATE UNIQUE INDEX IF NOT EXISTS uk_system_users_cpf ON system_users (cpf);
