# Handoff — sessão 2026-10-06/07 (segurança S1–S7 → PBQP-H E1/E2 → infra /obrasync)

> **Para retomar:** ler só este arquivo, conferir com o Alef quais pendências de servidor (§2) foram
> feitas, e abrir o **E3 (painel de prontidão C1–C14)** pela tabela de reconferência. **O E3 NÃO foi
> iniciado.** Regras da sessão em vigor: reconferir no código antes de mexer (ABERTO / JÁ FECHADO /
> DIFERENTE + `arquivo:linha`), plano antes do código e aguardar OK, migrations só aditivas, scripts
> de dado separados e não executados, teste em toda correção, um commit por item, push só a pedido.

## 1. Onde paramos

| Frente | Estado |
|---|---|
| **Segurança S1–S7** (Transversal + Configurações) | **Fechado e validado em produção** na `v1.47.0` (commits `b308307`…`af0978f`, release `a616932`). Auditoria de caminhos rodada em produção: 0 fora da base. Detalhe: STATUS §0.0. |
| **PBQP-H Nível B** (única frente descongelada; prazo: canteiro do Condomínio Atacama) | **E0** fechado pelo S1. **E1** (pacote 7.5) fechado: `80da4fc` PES, `97153fe` PQO, `8a74e78` caronas, `0249622` E1-fix Política. **E2** entregue e pushado (`17f713c`): biblioteca de materiais, metas derivadas, lista da empresa por obra — **validação em produção pendente**. **Próximo: E3**, começando por reconferência e plano. Spec: `docs/superpowers/specs/2026-09-02-pbqph-nivel-b-implantacao-atacama-design.md` (Seções 3 e 4 executadas; decisões 1-4 registradas). |
| **Infra /financeiro → /obrasync** | Código pronto e pushado (`8c8d171`): caminho base derivado (`appPublicBase()` / `app_public_url()`), `config.sample.php` em `/obrasync`. Apache/GitHub pendentes (§3). |
| **Ordem dos setores** | Segue o arquivo de prompts por setor do Alef: depois da PBQP-H vem **Configurações + Relatórios**, depois **Transversal (dívida)**. |

**Versão:** `APP_VERSION` segue `v1.47.0` (2026-10-06); o bump para a próxima versão fica para o
fechamento da frente PBQP-H. Cache atual `?v=1821` (E1 e E2 mexeram em `app.js`).

**Suíte:** 32/32 blocos (`bash scripts/tests/run-all.sh`). Testes criados nesta sessão:
`test_arquivo_confinado.php` 35 · `test_autorizacao_acoes.php` 38 · `test_papeis_visualizador.php`
121 · `test_bearer_token.php` 8 · `test_dev_bypass.php` 14 · `test_app_public_url.php` 13 ·
`test_qualidade_regras.php` 67 · `test_role_modules.js` 38 · `test_qualidade_front.js` 77.
Guarda estática nova no `static-checks.sh` (S7: nenhum `getMessage()` em `fail()`/`*_respond()`).

**Commits da sessão (todos em `origin/main`, último `207a910`):**
S1 `b308307` · `713f497` · `82c674a` · S2 `eb1ebc7` · S3 `9d7d186` · S4 `231e0d6` · S6 `bc576b1` ·
S7 `af0978f` · release `a616932` · docs `5153090` · contagens `5d907c7` · E1 `80da4fc` `97153fe`
`8a74e78` `86343ce` · E1-fix `0249622` · infra `8c8d171` · E2 `17f713c` · docs `207a910` · handoff
(este commit).

**Migrations novas (aditivas, rodar no servidor):** `2026-10-07-pbqph-e1-pes-aprovacao.sql`,
`2026-10-07-pbqph-e1-pqo-versoes.sql`, `2026-10-07-pbqph-e2-pqo-lista-empresa.sql` (o `ensure_*`
cobre, mas rodar dá consistência). **Scripts só-leitura/manuais em `scripts/sql/`:** auditoria de
caminhos (S1), contagens reais PBQP-H, auditoria de links `/financeiro`, Política `aprovadoPor`
(UPDATE comentado).

## 2. Pendências de servidor (feitas pelo Alef — marcar conforme ele confirmar)

- [ ] Rodar as três migrations de 2026-10-07 (com backup antes).
- [ ] Validar E1 e E2 no navegador: PES Vigente com aprovador e "Exportar PDF"; histórico do PQO ao
      trocar a versão; recusa (422) ao excluir FVS Aprovada; NC Aberta excluída liberando a etapa;
      seleção de materiais da biblioteca e metas no PQO.
- [ ] SELECT do orçamento do Atacama (decide se a Curva ABC muda os 10 materiais com procedimento):
      ```sql
      SELECT o.id, o.name, o.status, COUNT(i.id) AS itens
        FROM orcamentos_obras o JOIN projects p ON p.id = o.projectId
        LEFT JOIN orcamento_obra_itens i ON i.workBudgetId = o.id
       WHERE p.name LIKE '%Atacama%' GROUP BY o.id, o.name, o.status;
      ```
- [ ] **No PQO do Atacama: fechar em exatamente 20 executados** — marcar "não executa" no bloco não
      usado (cerâmico 6 ou concreto 7), na argamassa/cal não usada (industrializada 8 ou cal 11) e em
      **uma reserva** que a obra não use (21 gesso, 22 vidro ou 23 aditivos/graute). Motivo: a meta é
      `ceil(0,5 × executados)` — com 21 executados sobe para 11 e a obra só terá 10 com procedimento;
      com 20 fica em 10. Confirmado em `qMetasNivelB`: 20 → 10/5/3; 21 → 11/6/3; 23 → 12/6/3. O
      contador do PQO mostra "N executados · M controlados (meta X)" e o selo "Faltam X".
- [ ] Script da Política (`aprovadoPor` "alef" → nome completo): cosmético; o UPDATE vem comentado,
      backup no passo 0.
- [ ] Conferir as faixas 40/50/25% no Anexo da Portaria nº 75/2021 (fonte atual é secundária:
      diagnóstico §6.3); divergência corrige só as constantes `SIAC_B_FAIXA_*` em `app.js`.

## 3. Troca de endereço /financeiro → /obrasync

- **Código pronto** (`8c8d171`): caminho base derivado da URL no front e da requisição/config no
  backend; `config.sample.php` em `/obrasync`; README com a Payload URL nova; teste com guarda
  contra caminho público fixo; `scripts/sql/2026-10-07-infra-links-financeiro-auditoria.sql` conta
  os links gravados (só leitura).
- **Apache:** config em `/etc/apache2/conf-available/financeiro.conf` (`Alias /financeiro`,
  `AllowOverride All`). Só o Apache responde em 80/443; o Nginx instalado está parado.
- **Passo A** (`obrasync.conf` com o segundo Alias para o mesmo diretório, os dois endereços juntos;
  `config.php` `mail.app_url` → `/obrasync`): **status a confirmar com o Alef**.
- **Passo B:** trocar a Payload URL do webhook no GitHub para
  `https://schimanskiengenharia.com.br/obrasync/deploy.php` e testar com **Redeliver** (o GitHub
  não segue 301).
- **Passo C:** só depois do B, trocar o `Alias /financeiro` por
  `RedirectMatch 301 ^/financeiro(/.*)?$ /obrasync$1`. Os links de acompanhamento e mensagens de
  WhatsApp já gravados dependem desse 301; **não alterar no banco**.

## 4. Estado do servidor

- Config real em `/etc/financeiro/config.php` (não na raiz do projeto); `upload_dir =
  /var/lib/financeiro/uploads`.
- O repositório do servidor tinha ~45 merges locais: o deploy faz `git pull` com merge a cada push.
  Corrigir para `--ff-only` ou `reset --hard origin/main` na **Onda B L2 Deploy** (sessão
  Transversal).
- Backups feitos em 2026-10-06: branch `backup-servidor-2026-10-06` no repo do servidor; cópia do
  Composer em `~/backup-composer-2026-10-06/`; dump de estrutura em `~/schema_real_2026-10-06.sql`
  (120 tabelas, sem dados) — insumo do item **T3 (regenerar `schema.sql`)**.
- `composer.json`, `composer.lock` e `vendor/` estão **não rastreados** em `/var/www/financeiro`
  (instalação do dompdf). Verificar na sessão Transversal se `vendor/` fica acessível pela web.
- `financeiro_app` não tem `LOCK TABLES`: usar `--skip-lock-tables` no `mysqldump`. Root do MariaDB
  exige senha.
- Aviso de CSP do Cloudflare Insights (beacon bloqueado) é inofensivo; a solução é desligar o Web
  Analytics no Cloudflare, não afrouxar a CSP.
- Contagens reais PBQP-H (2026-10-07): Política v1.0 Vigente; 1 PES Vigente (SPDA, sem PDF); PQO,
  FVS, FVM, NC, treinamentos, auditorias = 0; 7 fornecedores, nenhum avaliado; 0 etapas com
  `servicoSiacId`; gate fail-open encerrado (colunas existem).

## 5. Decisões de produto registradas (não repropor)

- **Público-alvo do ObraSync:** construtoras e incorporadoras.
- **Modelo futuro:** Empreendimento como raiz, com escopo por contrato (pré-obra; obra como
  executora, gerenciadora ou fiscal; pós-obra), escolhido caso a caso, incluindo o modo "só
  fiscalização" com executor terceiro. Não é código agora (congelamento), mas orienta a futura
  Fase 1 (Empreendimento e Unidades).
- `viabilityAnalyses` (legado) deve ser avaliado como possível base da viabilidade de incorporação
  antes de ser aposentado.
- PBQP-H: Nível B, Atacama, abordagem A; decisões 1-4 do E1 (PDF do PES via `qualidadePrint`;
  histórico do PQO em tabela aditiva; biblioteca de materiais pela referência do SiAC com os pares em
  aberto todos com procedimento; DELETE de registro final bloqueado + gate recalculado); `aprovadoPor`
  = nome completo da sessão (PES e Política). MP4 no RDO vetado; Nível A, ensaios/PIT, módulo de
  satisfação, painel como tela separada, auditoria fora do Atacama e FK destrutiva em `qualidade_*`:
  **não fazer**.
- Já no panorama (`docs/revisao/2026-10-06-panorama-setor-por-setor.md`): `role_can` trata delete
  como edit sem grade; ACL por obra como frente própria (base também do portal de
  cliente/comprador); gerente com view em RH — decisão pendente do Alef.

## 6. Como retomar amanhã

1. Ler este handoff.
2. Conferir com o Alef quais itens do §2 e o Passo A do §3 foram feitos; marcar aqui.
3. Abrir o **E3** (painel de prontidão C1–C14 como SEÇÃO do `renderQualidadeDashboard`, status
   calculado, link para a evidência, função pura + teste JS) pela tabela de reconferência: o que o
   dashboard já calcula (`renderQualidadeDashboard`), as definições C1–C14 e gates no diagnóstico
   §3.1/§6.3, a regra dos observáveis pelas etapas em andamento (spec Seção 1), e a regra rígida de
   C7 (só FVM com lote E responsável). Plano em etapas, esperar OK, um commit por item.
