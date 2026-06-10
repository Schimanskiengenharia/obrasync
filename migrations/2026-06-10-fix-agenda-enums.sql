-- Alinha os ENUMs da agenda com as opcoes exibidas pelo frontend.

ALTER TABLE agenda_eventos
  MODIFY COLUMN tipo ENUM('reuniao','visita','vistoria','entrega','cobranca','projeto','obra','financeiro','comercial','prazo','outro') NOT NULL;

ALTER TABLE agenda_eventos
  MODIFY COLUMN status ENUM('agendado','em_andamento','realizado','concluido','cancelado') DEFAULT 'agendado';
