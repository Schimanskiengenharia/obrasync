# Incidente 2026-07-19 — Telas vazias (Clientes/Contas a Pagar) com banco intacto

## Sintoma
Produção: telas de Clientes e Contas a Pagar vazias; banco intacto (8 clients,
53+ payables via SELECT direto); `/api/bootstrap` respondendo **200 com corpo
minúsculo**; error.log do Apache limpo; disco 49%; working tree do servidor
idêntico a `origin/main` (diff vazio em api/index.php, app.js, index.html).

## Investigação (systematic-debugging)
- Nenhum commit desde 3a4d641 tocou caminho de LEITURA: deploy.php e
  backup-pre-deploy.sh rodam só no webhook; NOVO-2 (59ebe37) é +19 linhas
  aditivas nas funções de ESCRITA. NOVO-2 inocentado por evidência.
- Mecanismo do sintoma localizado no código: `bootstrap_data`
  (api/index.php:2604-2617) devolve `[]` **silenciosamente, com 200**, para
  cada coleção cujo `role_can(...)` seja falso; o mesmo loop também engole
  `PDOException` por coleção (`:2637-2638`) devolvendo `[]`.
- `role_can` (:9251-9279) nega tudo para papel vazio/desconhecido, e usa
  comparação ESTRITA `'Sim'/'1'/'true'` no canView de `role_permissions`.
- `authenticate_request` (:8838-8888) lê o papel FRESCO de `system_users` a
  cada request (JOIN), e a sessão tem TTL absoluto de 12h
  (`AUTH_MAX_SESSION_SECONDS`).

## Resolução
Logout + login resolveu tudo (Clientes, Contas a Pagar, dashboard). Nenhuma
mudança de código.

## Causa declarada e ressalva honesta
Usuário: "sessão antiga, criada antes das correções de autorização (G1)".
Ressalva de engenharia: uma sessão literalmente pré-G1 (junho) é impossível —
o TTL absoluto é 12h. A explicação consistente com o código: a sessão do
navegador pertencia a um usuário/estado de papel SEM as permissões (ex.:
outro usuário logado nas últimas 12h naquele navegador, ou papel do usuário
temporariamente diferente); o logout apagou a linha da sessão e destruiu a
evidência. Encerrado como resolvido-por-relogin, causa-provável-de-dados,
com monitoramento (se repetir: rodar os 3 SELECTs do runbook abaixo ANTES
de deslogar).

## Runbook (se repetir)
```sql
SELECT id, username, role, status, blocked FROM system_users;
SELECT role, module, canView, status FROM role_permissions
 WHERE module IN ('clients','payable') ORDER BY role, module;
SELECT createdAt, username, action, module, recordId, LEFT(details,120)
  FROM audit_log WHERE module IN ('users','permissions') ORDER BY id DESC LIMIT 20;
-- e ANTES do logout: SELECT s.userId, u.username, u.role FROM api_sessions s
--   JOIN system_users u ON u.id=s.userId; (identifica a quem pertence a sessão)
```

## Itens de hardening propostos (aguardando decisão do usuário no backlog)
1. **NOVO-5 (proposto):** bootstrap nunca converter "permissão negada" ou
   `PDOException` em lista vazia silenciosa — marcar as coleções que falharam
   (ex.: `_unavailable: [chaves]` no payload) e o front avisar "não foi
   possível carregar X" em vez de fingir vazio. Classe de falha invisível —
   mesmo espírito da Frente 1 do estudo.
2. **NOVO-6 (proposto):** `role_can` aceitar variações de canView
   (case-insensitive; 'sim'/'Sim'/'1') — a comparação estrita atual é
   armadilha de dados.

## Decisão sobre invalidar sessões antigas
TTL absoluto de 12h já limita a exposição: qualquer sessão anômala morre
sozinha em <=12h. Purga geral é opcional (1 comando, força relogin único de
todos): `DELETE FROM api_sessions;` — sem necessidade de código novo (um
"sessionVersion" seria overengineering para evento único).
