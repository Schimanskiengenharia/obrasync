# ObraSync

> Versão `v1.8.0` · 2026-06-10

ObraSync é uma aplicação web em HTML, CSS, JavaScript puro, PHP e MariaDB/MySQL para gestão integrada de obras, financeiro, comercial e contabilidade gerencial. O frontend fica em `/var/www/financeiro`, a URL pública é `https://schimanskiengenharia.com.br/financeiro`, os dados persistentes ficam no banco e os arquivos de dados ficam fora da pasta pública.

Antes de atualizar em produção, faça backup do banco e de `/var/lib/financeiro`. **Nunca sobrescreva `/etc/financeiro/config.php`**, uploads, backups ou o banco MariaDB/MySQL.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML, CSS e JavaScript puro (sem frameworks, sem build) |
| Backend | PHP (API única em `api/index.php`) |
| Banco de dados | MariaDB/MySQL, charset `utf8mb4` |
| Servidor | Apache (com `.htaccess` na raiz e em `api/`) |
| Configuração | `/etc/financeiro/config.php` (fora da pasta pública) |
| Deploy | `deploy.php` + webhook GitHub + cron de backup |

---

## Estrutura de Arquivos

```
/var/www/financeiro          ← raiz pública
  index.html                 # Shell único da SPA
  app.js                     # Toda a lógica do frontend (~6.500 linhas)
  styles.css                 # Estilos e responsividade
  schema.sql                 # Schema completo do banco (70+ tabelas)
  deploy.php                 # Webhook de deploy automático via GitHub
  .htaccess                  # Segurança e headers HTTP
  api/
    index.php                # API REST PHP (CRUD genérico + rotas especiais)
    config.sample.php        # Exemplo de configuração (copie para /etc/financeiro/)
    cron/jobs.php            # Tarefas agendadas (backup automático)
    .htaccess
  migrations/                # 10 migrações SQL incrementais
  assets/                    # Imagens estáticas
  README.md

/var/lib/financeiro          ← dados fora da pasta pública
  backups/
  uploads/
    obras/
    propostas/
    notas-fiscais/
    relatorios/
    projetos/
    sinapi/
    project/
    cotacoes/
  deploy.log

/etc/financeiro/config.php   ← credenciais (nunca sobrescrever)
```

---

## Módulos do Sistema

A navegação é organizada em 7 seções na sidebar:

### Dashboard
KPIs dinâmicos, gráficos SVG, indicadores gerais e por obra, filtros por período/cliente/projeto/status.

### Cadastros
Clientes, Fornecedores, Produtos, Serviços, Categorias financeiras, Centros de custo, Contas bancárias.

### Obras/Projetos *(eixo central)*
- Obras/Projetos, Custos por obra, Receitas por obra.
- **Orçamentos de Obras** com base **SINAPI 04/2026 (UF padrão MS)**: referências, insumos, composições, itens, mão de obra, famílias/coeficientes, manutenções, importador XLSX/CSV.
- Composições próprias, Cotações, **Curva ABC**.
- **Cronograma físico-financeiro**, marcos, **Gantt simplificado**, integração **Microsoft Project (XML)**.
- Notificações, links de acompanhamento, pedidos de compra, relatórios técnicos.
- **Notas Fiscais / Documentos Fiscais** (upload, download, vínculo com obra).
- **Agenda** e **Kanban** integrados.

### Financeiro
Contas a receber, Contas a pagar, Movimentações de caixa, Fluxo de caixa, Conciliação bancária.

### Comercial
- Orçamentos, **Propostas comerciais** (itens, histórico de status, arquivos, vínculos, variáveis dinâmicas).
- **Gerador de proposta a partir de orçamento**, com modelos editáveis, pré-visualização e PDF A4.
- Taxonomia: Áreas/Disciplinas → Tipos de atuação → Subtipos/Serviços.
- Vendas/Contratos.

### Contabilidade Gerencial
Plano de contas, Lançamentos contábeis, **DRE gerencial**, Documentos fiscais, Impostos.

### Relatórios
Financeiro, por cliente, por fornecedor, por centro de custo, por obra/projeto; Exportações.

### Configurações
Dados da empresa, Usuários, **Permissões/Perfis (RBAC)**, Versão, estruturas editáveis (tipos de obra, status, etapas, marcos, campos personalizados, modelos de relatório, tipos de documento, checklists, tipos de medição, formas de pagamento, mensagens WhatsApp, regras de visualização), Configuração SINAPI, Backup, Preferências, Migração, Log de auditoria, Meu Perfil.

---

## Banco de Dados

### Instalação do zero

```bash
sudo apt update
sudo apt install apache2 mariadb-server php php-mysql php-zip
```

```bash
sudo mariadb
```

```sql
CREATE DATABASE IF NOT EXISTS financeiro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'financeiro_app'@'localhost' IDENTIFIED BY 'TROQUE_ESSA_SENHA_FORTE';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON financeiro.* TO 'financeiro_app'@'localhost';
FLUSH PRIVILEGES;
```

```bash
mysql -u root -p financeiro < /var/www/financeiro/schema.sql
```

### Grupos de tabelas

- **Cadastros**: `clients`, `suppliers`, `products`, `services`, `financial_categories`, `cost_centers`, `bank_accounts`, `formas_pagamento`.
- **Obras**: `projects`, `project_schedule`, `obra_cronograma_etapas`, `obra_cronograma_marcos`, `obra_etapas_padrao`, `obra_marcos_padrao`, `obra_tipos`, `obra_status`, `obra_campos_personalizados`, `obra_valores_personalizados`, `obra_notificacoes`, `obra_links_acompanhamento`, `purchase_orders`, `technical_reports`.
- **SINAPI/Orçamentos**: `sinapi_referencias`, `sinapi_insumos`, `sinapi_composicoes`, `sinapi_composicao_itens`, `sinapi_mao_de_obra`, `sinapi_familias_coeficientes`, `sinapi_manutencoes`, `sinapi_configuracoes`, `orcamentos_obras`, `orcamento_obra_itens`, `composicoes_proprias`, `cotacoes`.
- **Comercial**: `commercial_proposals`, `proposta_itens`, `proposta_arquivos`, `proposta_status_historico`, `proposta_orcamento_vinculos`, `proposta_variaveis`, `proposal_models`, `proposal_areas`, `proposal_action_types`, `proposal_service_subtypes`, `budgets`, `sales_contracts`.
- **Financeiro**: `accounts_receivable`, `accounts_payable`, `cash_bank_movements`.
- **Contabilidade**: `chart_accounts`, `journal_entries`, `taxes`, `tax_documents`, `fiscal_documents`, `tipos_documento`.
- **Produtividade**: `agenda_eventos`, `kanban_boards`, `kanban_colunas`, `kanban_cards`, `checklists`, `checklist_itens`, `mensagens_padrao`, `modelos_relatorio`, `tipos_medicao`.
- **Sistema**: `system_users`, `role_permissions`, `regras_visualizacao`, `company_settings`, `system_preferences`, `sistema_versoes`, `api_sessions`, `password_reset_tokens`.

### Migrações incrementais

Execute em ordem em bancos existentes (use `IF NOT EXISTS` — não reseta dados):

```bash
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-06-contact-fields.sql
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-06-fiscal-documents.sql
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-06-integrated-management-proposals-rbac.sql
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-07-obrasync-integration-review.sql
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-07-physical-financial-schedule-whatsapp.sql
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-08-proposal-generator-from-work-budget.sql
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-08-sinapi-2026-04-ms-importer.sql
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-08-sinapi-msproject-editable-structures.sql
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-10-api-auth-sessions.sql
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-10-password-strength.sql
```

A migration `2026-06-10-password-strength.sql` adiciona `email` e `mustChangePassword` em `system_users` e cria `password_reset_tokens`. Todos os usuários existentes ficam marcados para redefinir a senha no próximo login.

---

## Configuração PHP

```bash
sudo mkdir -p /etc/financeiro
sudo cp /var/www/financeiro/api/config.sample.php /etc/financeiro/config.php
sudo nano /etc/financeiro/config.php
```

```php
return [
    'db' => [
        'host'     => '127.0.0.1',
        'database' => 'financeiro',
        'user'     => 'financeiro_app',
        'password' => 'TROQUE_ESSA_SENHA_FORTE',
        'charset'  => 'utf8mb4',
    ],
    'data_dir'      => '/var/lib/financeiro',
    'backup_dir'    => '/var/lib/financeiro/backups',
    'upload_dir'    => '/var/lib/financeiro/uploads',
    'auth' => [
        'dev_bypass' => false,  // NUNCA habilite em produção
    ],
    // Secret do webhook GitHub (gere com: php -r "echo bin2hex(random_bytes(32));")
    'deploy_secret' => 'COLE_AQUI_A_CHAVE_GERADA',
    'mail' => [
        'from_email'    => 'noreply@schimanskiengenharia.com.br',
        'from_name'     => 'ObraSync',
        'app_url'       => 'https://schimanskiengenharia.com.br/financeiro',
        'smtp_host'     => '',      // vazio = usa php mail() com relay do servidor
        'smtp_port'     => 587,
        'smtp_user'     => '',
        'smtp_pass'     => '',
        'smtp_tls'      => true,
        'log_reset_url' => false,   // true = loga URL de reset no error_log (dev)
    ],
];
```

```bash
sudo chown root:www-data /etc/financeiro/config.php
sudo chmod 640 /etc/financeiro/config.php
```

---

## Pastas de Dados

```bash
sudo mkdir -p \
  /var/lib/financeiro/backups \
  /var/lib/financeiro/uploads/obras \
  /var/lib/financeiro/uploads/propostas \
  /var/lib/financeiro/uploads/notas-fiscais \
  /var/lib/financeiro/uploads/relatorios \
  /var/lib/financeiro/uploads/projetos \
  /var/lib/financeiro/uploads/sinapi \
  /var/lib/financeiro/uploads/project \
  /var/lib/financeiro/uploads/cotacoes

sudo chown -R www-data:www-data /var/lib/financeiro
sudo chmod -R 750 /var/lib/financeiro
```

Não salve anexos, PDFs, exports ou backups em `/var/www/financeiro/assets`.

---

## Apache

```bash
sudo a2enmod rewrite headers
sudo systemctl reload apache2
```

No VirtualHost, permita `.htaccess`:

```apache
<Directory /var/www/financeiro>
    AllowOverride All
    Require all granted
</Directory>
```

---

## Deploy Automático (GitHub Webhook)

O arquivo `deploy.php` recebe eventos de push do GitHub e executa `git pull` automaticamente.

### Configuração

1. Gere o secret no servidor:
   ```bash
   php -r "echo bin2hex(random_bytes(32));"
   ```

2. Adicione `deploy_secret` em `/etc/financeiro/config.php` (veja seção Configuração PHP).

3. No GitHub: **Settings → Webhooks → Add webhook**
   - **Payload URL**: `https://schimanskiengenharia.com.br/financeiro/deploy.php`
   - **Content type**: `application/json`
   - **Secret**: a mesma chave gerada acima
   - **Events**: `Just the push event`

4. Permissão de sudo para o `www-data` rodar git pull como `alefschimanski`:
   ```bash
   sudo visudo
   # Adicione:
   www-data ALL=(alefschimanski) NOPASSWD: /usr/bin/git -C /var/www/financeiro pull origin main
   ```

5. O log de deploy fica em `/var/lib/financeiro/deploy.log`.

### Deploy manual

```bash
sudo -u alefschimanski git -C /var/www/financeiro pull origin main
```

---

## Login e Autenticação

O `schema.sql` cria usuários iniciais:

- `admin` / `admin123`
- `alefschimanski` / `Schimanski!@#`

**Troque as senhas imediatamente após o primeiro login.**

### Fluxo de sessão

O login emite um token de sessão (tabela `api_sessions`). O frontend envia esse token em todas as requisições (`Authorization: Bearer ...`). A sessão expira após **30 minutos de inatividade**, com aviso 5 minutos antes.

### Força de senha (v1.8.0)

Senhas novas precisam ter:
- Mínimo 8 caracteres
- Pelo menos uma letra maiúscula
- Pelo menos um caractere especial (`!`, `@`, `#`, `%`, etc.)

Todos os usuários existentes são marcados com `mustChangePassword = 1` pela migration e são obrigados a criar uma nova senha no primeiro login após a atualização.

### Redefinição de senha por e-mail

A rota pública `POST /financeiro/api/request-password-reset` gera um token com validade de 2 horas e envia um link por e-mail. A rota `POST /financeiro/api/reset-password` valida o token e atualiza a senha.

Configure a seção `mail` em `/etc/financeiro/config.php` para ativar o envio. Se `smtp_host` estiver vazio, o sistema usa o `mail()` do PHP com o relay configurado no servidor (ex.: Postfix).

### Bypass de desenvolvimento

O bypass de login (`AUTH_BYPASS_FOR_TESTS`) nunca vale em produção. Em desenvolvimento, só se aplica quando a API não está ativa (modo `localStorage`). No backend, `auth.dev_bypass` em `config.php` fica desligado por padrão e só atende `127.0.0.1`/`::1`.

---

## API PHP

### Endpoints principais

```text
POST   /financeiro/api/login
POST   /financeiro/api/logout
POST   /financeiro/api/request-password-reset   ← público (sem token)
POST   /financeiro/api/reset-password           ← público (sem token)
POST   /financeiro/api/change-password          ← autenticado
GET    /financeiro/api/bootstrap
GET    /financeiro/api/fornecedores
POST   /financeiro/api/fornecedores
PUT    /financeiro/api/fornecedores/{id}
DELETE /financeiro/api/fornecedores/{id}
POST   /financeiro/api/migrate                  ← admin
GET    /financeiro/api/backup/export            ← admin
POST   /financeiro/api/backup/import            ← admin
POST   /financeiro/api/sinapi-upload
POST   /financeiro/api/sinapi-import
POST   /financeiro/api/project-upload
```

Downloads de notas fiscais aceitam token via `?token=` por serem navegação direta do navegador:

```text
GET /financeiro/api/notas-fiscais/{id}/pdf?token=...
GET /financeiro/api/notas-fiscais/{id}/xml?token=...
```

### Autorização por rota e perfil

- Todas as rotas exigem token de sessão, exceto `login`, `request-password-reset` e `reset-password`.
- `backup` e `migrate` exigem perfil `admin`.
- `sinapi-upload`/`sinapi-import` exigem permissão de edição em Configuração SINAPI.
- `project-upload` exige permissão de edição no Cronograma.
- CRUD genérico valida permissão por módulo e ação (GET=visualizar, POST=criar, PUT/PATCH=editar, DELETE=excluir) consultando `role_permissions` — com fallback nos padrões de perfil do frontend.
- O `bootstrap` devolve apenas os módulos que o perfil autenticado pode visualizar.

---

## Perfis e Permissões

| Perfil | Acesso |
|---|---|
| `admin` | Total — todos os módulos e ações |
| `gerente` | Total exceto Usuários e Permissões |
| `financeiro` | Financeiro, contabilidade, documentos fiscais, relatórios e exportações |
| `comercial` | Clientes, orçamentos, propostas, modelos e vendas |
| `engenharia` / `gestor_obra` | Obras, cronograma, pedidos, relatórios técnicos, propostas vinculadas |
| `operador` | Módulos operacionais do dia a dia (sem usuários/permissões) |
| `visualizador` | Leitura em todos os módulos |
| `equipe_campo` | Dashboard e relatório por obra |
| `cliente_obra` | Dashboard, cronograma e relatórios técnicos liberados |
| `consulta` | Dashboard e relatórios financeiros |
| `fornecedor_terceiro` | Dashboard |

A tabela `role_permissions` permite customizar ações (visualizar, criar, editar, excluir, exportar, aprovar, anexar) por módulo para qualquer perfil. Quando não houver linha cadastrada, o sistema usa os padrões acima.

---

## Dashboard

- Visão geral da empresa: consolida todos os dados, sem depender de uma obra selecionada.
- Visão por obra/projeto: filtra serviços, produtos, receitas, despesas, contas, movimentações, fornecedores e documentos fiscais vinculados à obra.
- KPIs dinâmicos calculados do banco.
- Gráficos SVG sem CDN.
- Indicadores comerciais: propostas emitidas, aprovadas e taxa de conversão.
- Filtros por período, cliente, obra/projeto, status da obra, centro de custo e categoria.
- Alertas para contas vencidas, custo acima do previsto e baixa margem.
- Regra de datas: sem data = mostra tudo; só inicial = a partir de; só final = até; ambas = intervalo.

---

## Obras/Projetos como Eixo Central

Cada registro financeiro, comercial ou técnico pode ser vinculado à obra por `projectId`. Isso permite filtrar dashboard, custos, receitas, pedidos, relatórios técnicos, notas fiscais, propostas e contas por obra.

Fluxo comercial integrado:

- Orçamento aprovado → gera Proposta (mantém `workBudgetId`).
- Proposta aprovada → `Converter` → Venda/Contrato.
- Venda/Contrato → `Gerar conta` → Conta a receber (mantém vínculo com cliente, obra, proposta, categoria e centro de custo).

Status de obras: Planejamento, Proposta enviada, Contratada, Em andamento, Pausada, Concluída, Cancelada.

---

## SINAPI e Orçamentos de Obras

Referência padrão incluída: **SINAPI 04/2026, UF MS, Campo Grande/MS**, tipos Sem desoneração, Com desoneração e Sem encargos sociais.

Fluxo recomendado:

1. Confirme a referência padrão `MS 04/2026` em `Base SINAPI`.
2. Em `Base SINAPI > Importar SINAPI`, selecione o arquivo XLSX ou CSV, mês/ano, UF e tipo.
3. Clique em `Validar / prévia` e confira o resumo.
4. Clique em `Confirmar importação` para gravar no banco.
5. Pesquise insumos ou composições por código ou descrição.
6. Selecione o orçamento destino e clique em `Adicionar`.
7. Ajuste quantidade, etapa, centro de custo, categoria, custo unitário e BDI.
8. Use `Gerar proposta` para criar proposta comercial a partir do orçamento.
9. Use `Gerar cronograma` para criar etapas agrupadas por etapa do orçamento.

Compatibilidade de arquivo:

- XLSX: lido diretamente quando o PHP tiver `php-zip` instalado (`sudo apt install php-zip`).
- CSV: alternativa estável — exporte a aba desejada do Excel/LibreOffice como `CSV UTF-8`.

Abas SINAPI aceitas: `ISD`, `ICD`, `ISE`, `CSD`, `CCD`, `CSE`, `Analítico`, `SEM Desoneração`, `COM Desoneração`, `Coeficientes`, `Manutenções`.

A Curva ABC ordena itens por valor total, calcula percentual individual, percentual acumulado e classifica em A, B ou C.

---

## Gerador de Proposta Comercial

Em `Obras/Projetos > Orçamentos de Obras`, o botão `Gerar Proposta` cria uma proposta a partir do orçamento.

Fluxo:

1. Selecione um orçamento (`Rascunho`, `Em análise` ou `Aprovado`).
2. Clique em `Gerar Proposta`.
3. Escolha modelo, cliente, obra, condição de pagamento, prazo, validade e responsáveis.
4. Revise o escopo gerado automaticamente.
5. Escolha o formato: resumida, detalhada, por etapa, por categoria, por centro de custo ou só valor global.
6. Salve como `Rascunho` ou finalize como `Gerada`.
7. Use `Exportar / Imprimir PDF` para layout A4 pelo navegador.

Variáveis aceitas nos modelos:

```
{{nome_cliente}}  {{cpf_cnpj_cliente}}  {{endereco_cliente}}
{{nome_obra}}     {{endereco_obra}}     {{tipo_obra}}
{{numero_orcamento}}  {{versao_orcamento}}  {{data_orcamento}}
{{data_proposta}} {{validade_proposta}} {{responsavel_tecnico}}
{{crea_cau}}      {{responsavel_comercial}}
{{nome_empresa}}  {{cnpj_empresa}}  {{telefone_empresa}}  {{email_empresa}}
{{valor_total}}   {{valor_total_extenso}}  {{condicao_pagamento}}
{{prazo_execucao}} {{observacoes}}
{{tabela_itens_orcamento}}  {{resumo_itens_orcamento}}
{{escopo_gerado_pelos_itens}}
{{total_servicos}}  {{total_produtos}}  {{total_mao_de_obra}}
{{total_materiais}} {{total_equipamentos}} {{total_terceiros}}
{{bdi_percentual}}  {{valor_bdi}}  {{desconto_percentual}}  {{valor_desconto}}
```

---

## Estruturas Editáveis

Em `Configurações`, o administrador mantém sem engessar o sistema:

- Tipos de obra, Status de obra, Etapas padrão, Marcos padrão, Campos personalizados.
- Modelos de relatório, Tipos de documento, Checklists, Tipos de medição.
- Formas de pagamento, Mensagens padrão (WhatsApp), Regras de visualização.
- Configuração SINAPI (UF padrão, mês/ano, tipo de referência, BDI padrão, exibição na proposta).

Use esses cadastros para adaptar o ObraSync a construção civil, reforma, energia solar, subestação, laudo, consultoria, regularização e outros tipos de obra.

---

## Cronograma Físico-Financeiro

Campos principais da etapa: obra/projeto, nome, descrição, ordem, datas previstas e reais, percentual físico previsto e realizado, valor financeiro previsto e realizado, status, responsável e observações.

O módulo calcula automaticamente percentual e valor financeiro previsto/realizado, diferença entre previsto e realizado, atraso em dias, próximo marco e saldo financeiro da obra.

Cada etapa pode ser marcada como marco importante, com mensagem padrão e opção de liberar para cliente/investidor.

---

## Gantt Simplificado

Visualização tipo Gantt em HTML/CSS/JS puro, sem biblioteca externa. Desktop: barras horizontais de previsto × realizado, linha da data atual, indicação de marcos. Celular: cards responsivos com etapa, status, datas, percentuais e atraso.

---

## Microsoft Project

Integração por arquivo (sem API online):

- `Exportar para MS Project`: gera XML compatível.
- `Importar XML do MS Project`: lê tarefas, mostra prévia e cria etapas após confirmação.
- `Exportar Excel/CSV` e `Exportar PDF/impressão`.

Mapeamento: Nome → `Task Name`, datas previstas → `Start`/`Finish`, percentual físico → `Percent Complete`, responsável → recursos, marco → `Milestone`, dependências → `PredecessorLink`, valor previsto → `Cost`.

Arquivos XML são armazenados em `/var/lib/financeiro/uploads/project`.

---

## WhatsApp Manual

O botão `Enviar atualização por WhatsApp` gera um link `wa.me` com mensagem preenchida automaticamente (nome do cliente, obra, marco concluído, percentuais físico/financeiro, próximo marco, link de acompanhamento e assinatura). Não há integração com a API oficial — o sistema gera o link e registra a notificação como `Preparado` para confirmação posterior.

---

## Notas Fiscais / Documentos Fiscais

Campos: obra/projeto, fornecedor/prestador, número da nota, data de emissão, valor, tipo, status, vínculos financeiros, upload de PDF e XML.

Arquivos salvos em `/var/lib/financeiro/uploads/notas-fiscais`. Downloads via API exigem token de sessão (passado via `?token=` por ser link direto do navegador).

```bash
sudo mkdir -p /var/lib/financeiro/uploads/notas-fiscais
sudo chown -R www-data:www-data /var/lib/financeiro/uploads/notas-fiscais
sudo chmod -R 750 /var/lib/financeiro/uploads/notas-fiscais
```

---

## Propostas Comerciais

O menu `Comercial` cobre: Orçamentos, Propostas, Modelos de propostas, Áreas/Disciplinas, Tipos de atuação, Subtipos/Serviços, Vendas/Contratos.

Classificação: `Área/Disciplina → Tipo de atuação → Subtipo/Serviço → Modelo de proposta`.

Uma proposta pode ser independente ou vinculada a cliente, obra/projeto, orçamento, serviço ou modelo. Origens aceitas: nova demanda, derivada de laudo, derivada de projeto, derivada de obra existente, adicional/complementar, retrofit, manutenção, regularização.

---

## Máscaras e Formatação

- Telefone: `(67) 99999-9999` ou `(67) 3333-3333`.
- CPF/CNPJ, CEP: validados e formatados.
- Moeda: exibição em `R$ 1.000,00`, banco como decimal `1000.00`.
- Percentuais: exibição em `10,00%`, banco como número.

---

## Responsividade

Celular, tablet, notebook, desktop e telas grandes. Sidebar vira menu ocultável no celular. Filtros recolhíveis. KPIs em grade responsiva. Gantt troca por cards no celular. Botões maiores para toque.

---

## Migração do localStorage para o Banco

```text
Configurações > Migração para banco
```

Lê dados do `localStorage`, envia para `/financeiro/api/migrate`, mostra contagem de registros criados/atualizados e mantém dados antigos até confirmação. Evita duplicidades por documento, código, nome ou usuário.

---

## Backup Manual

Pelo sistema:

```text
Configurações > Backup local/servidor
```

Pelo terminal:

```bash
mysqldump -u financeiro_app -p financeiro > /var/lib/financeiro/backups/financeiro-$(date +%F).sql
tar -czf /var/lib/financeiro/backups/uploads-$(date +%F).tar.gz /var/lib/financeiro/uploads
```

---

## Backup Automático com Cron

```bash
sudo nano /usr/local/bin/backup-financeiro.sh
```

```bash
#!/bin/bash
set -e
BACKUP_DIR="/var/lib/financeiro/backups"
mkdir -p "$BACKUP_DIR"
mysqldump -u financeiro_app -p'SENHA_DO_BANCO' financeiro > "$BACKUP_DIR/financeiro-$(date +%F-%H%M).sql"
tar -czf "$BACKUP_DIR/uploads-$(date +%F-%H%M).tar.gz" /var/lib/financeiro/uploads
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

```bash
sudo chmod 750 /usr/local/bin/backup-financeiro.sh
sudo crontab -e
```

```cron
0 2 * * * /usr/local/bin/backup-financeiro.sh
```

---

## Restauração

Banco:

```bash
mysql -u root -p financeiro < /var/lib/financeiro/backups/financeiro-AAAA-MM-DD.sql
```

Uploads:

```bash
sudo tar -xzf /var/lib/financeiro/backups/uploads-AAAA-MM-DD.tar.gz -C /
sudo chown -R www-data:www-data /var/lib/financeiro
```

---

## Atualização Segura

Substitua apenas os arquivos públicos:

```bash
/var/www/financeiro/index.html
/var/www/financeiro/styles.css
/var/www/financeiro/app.js
/var/www/financeiro/assets/
/var/www/financeiro/api/
/var/www/financeiro/README.md
```

**Não apague:**

```bash
/etc/financeiro/config.php
/var/lib/financeiro
banco MariaDB/MySQL financeiro
```

Após subir os arquivos, execute as migrations novas que ainda não foram rodadas.

---

## Checklist Pós-Deploy (v1.8.0)

- [ ] Migrations `2026-06-10-api-auth-sessions.sql` e `2026-06-10-password-strength.sql` executadas.
- [ ] `deploy_secret` configurado em `/etc/financeiro/config.php` e no GitHub Webhook.
- [ ] Seção `mail` configurada em `/etc/financeiro/config.php` (SMTP ou relay Postfix).
- [ ] Login com usuário administrador — sistema exige nova senha (mustChangePassword).
- [ ] Nova senha atende força exigida (8+ chars, maiúscula, caractere especial).
- [ ] Fluxo "Esqueci minha senha": solicitar reset, receber e-mail, redefinir.
- [ ] Cadastro de cliente, fornecedor, obra/projeto.
- [ ] Criação de orçamento de obra e busca SINAPI.
- [ ] Geração de proposta a partir de orçamento.
- [ ] Pré-visualização A4 e impressão/PDF.
- [ ] Cronograma físico-financeiro e Gantt.
- [ ] Upload/download de documento fiscal (verifica token no link).
- [ ] Backup manual e verificação do log.
- [ ] Responsividade em celular e tablet.
- [ ] Permissões por perfil (testar com usuário não-admin).

---

## Backlog Técnico

### P0 — Base de funcionamento ✅ concluído em 2026-06-10

- ~~Autenticação e autorização reais na API~~ — token de sessão (`api_sessions`), autorização por perfil/módulo via `role_permissions` com fallback nos padrões do frontend.
- ~~Tratar respostas não-JSON no frontend~~ — `apiRequest()` e `fetchForm()` com try/catch, tratamento de 401 e mensagens amigáveis.
- ~~Blindar `loadDb()` e `localStorage`~~ — `safeLocalGet`/`safeLocalSet` e fallback para seed.
- ~~Padronizar `AUTH_BYPASS_FOR_TESTS`~~ — derivado de `APP_ENV`, nunca em produção; backend com `auth.dev_bypass` desligado por padrão.
- ~~Revisar boot do app~~ — `APP_ENV` (`file`/`local`/`production`), `loadServerData` distingue API fora do ar de login pendente.
- ~~Validação de força de senha~~ — regra em PHP e JS, diálogo obrigatório no primeiro login, reset por e-mail com token de 2 h.

### P1 — Risco funcional por módulo

- ~~Dashboard: validar filtros e datas~~ — `validDateInput`, guards `NaN` em `daysBetween` e `monthLabel`. ✅
- ~~CRUD genérico: escape HTML em `innerHTML`~~ — `escapeHtml` em `table()`, `fillSelect`, `inputFor` e badge de status. ✅
- Agenda/Kanban: quebrar lógica em helpers menores, corrigir datas inválidas.
- Cronograma/Gantt: revisar cálculos de intervalo, dependências e fallback mobile.
- Propostas: separar geração, preview, persistência e exportação.
- Financeiro: revisar consistência entre contas, caixa, conciliação e vínculos por obra.
- Documentos fiscais: garantir download/upload com permissões reais no backend.
- Relatórios: remover dependência de estado global implícito nas agregações.

### P2 — Manutenção e qualidade

- Quebrar `app.js` em módulos menores; extrair constantes e regras repetidas.
- Camada única de helpers para datas, dinheiro, texto seguro e selects.
- Consolidar breakpoints e padrões repetidos no CSS.
- Acessibilidade: dialogs, foco inicial, navegação por teclado, estados de erro.
- Testes mínimos para login, bootstrap, agenda, propostas e backups.
