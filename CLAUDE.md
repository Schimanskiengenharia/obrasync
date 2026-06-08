# ObraSync — Contexto do Projeto

## Ambiente
- OS: Debian 13.5 (Trixie)
- Servidor web: Apache + mod_rewrite + .htaccess
- Backend: PHP puro (sem framework)
- Banco: MariaDB, banco "financeiro", charset utf8mb4
- Config do banco: /etc/financeiro/config.php (NUNCA editar)
- Frontend: HTML + CSS + JavaScript puro (sem framework)
- URL: https://schimanskiengenharia.com.br/financeiro

## Estrutura de arquivos
- /var/www/financeiro/index.html     — frontend principal
- /var/www/financeiro/app.js         — lógica frontend
- /var/www/financeiro/styles.css     — estilos
- /var/www/financeiro/api/           — todos os endpoints PHP
- /var/www/financeiro/migrations/    — arquivos SQL versionados
- /var/lib/financeiro/uploads/       — uploads fora da pasta pública
- /var/lib/financeiro/backups/       — backups

## Convenções do código
- API usa camelCase internamente (clienteId, valorTotal, obraId)
- Banco usa snake_case (cliente_id, valor_total, obra_id)
- A API aceita ambos via aliases — sempre verificar antes de mapear
- PDO com prepared statements em TODOS os endpoints
- Respostas JSON padrão: {success: true/false, data: {}, message: ""}
- Transações PDO obrigatórias em operações multi-tabela

## Regras críticas
- NUNCA editar /etc/financeiro/config.php
- NUNCA salvar uploads em /var/www/financeiro/assets/
- Migrations sempre em /var/www/financeiro/migrations/YYYY-MM-DD-nome.sql
- Backup obrigatório antes de qualquer migration

## Tabelas principais
- commercial_proposals         — propostas comerciais
- proposta_itens               — itens da proposta
- proposta_orcamento_vinculos  — vinculo proposta e orcamento
- proposta_status_historico    — historico de status
- obras                        — eixo central (campo: projectId)
- orcamentos_obras             — orcamentos vinculados a obras
- orcamento_obra_itens         — itens do orcamento da obra
- obra_cronograma_etapas       — etapas do cronograma
- obra_cronograma_marcos       — marcos e medicoes
- pedidos_compra               — pedidos de compra
- contas_a_receber             — contas a receber
- contas_a_pagar               — contas a pagar
- eventos_automacao            — log de automacoes
