# ObraSync

Sistema web de gestão integrada para empresas de engenharia e construção civil. Cobre todo o ciclo operacional: obras, orçamentos, propostas comerciais, financeiro, contabilidade gerencial, cronograma físico-financeiro e relatórios.

URL de produção: `https://schimanskiengenharia.com.br/financeiro`

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript puro (sem framework) |
| Backend | PHP 8.x puro (sem framework) |
| Banco de dados | MariaDB / MySQL, banco `financeiro`, charset `utf8mb4` |
| Servidor web | Apache 2 + mod_rewrite + `.htaccess` |
| OS | Debian 12+ / Ubuntu 22+ |
| Autenticação | Session-based, bcrypt via `password_hash()` |
| Gráficos | SVG gerado no frontend (sem CDN) |

---

## Funcionalidades Implementadas

### Obras / Projetos
- Cadastro completo de obras/projetos com responsável técnico, gestor, comercial e financeiro responsável
- Status de obra: Planejamento, Proposta enviada, Contratada, Em andamento, Pausada, Concluída, Cancelada
- Campos personalizados por tipo de obra
- Vinculação de todos os registros financeiros, comerciais e técnicos por `projectId`

### Orçamentos e SINAPI
- Orçamentos de obras com base SINAPI e composições próprias
- Importador SINAPI 04/2026 (XLSX e CSV): insumos, composições, mão de obra, famílias/coeficientes e manutenções
- Busca SINAPI com termos não consecutivos
- Composições próprias e cotações
- Curva ABC automática (A/B/C por valor percentual acumulado)
- Cálculo de custo direto, custo total, preço de venda, BDI e desconto

### Proposta Comercial
- Gerador de proposta a partir de orçamento de obra
- Modelos de proposta editáveis com variáveis dinâmicas (`{{nome_cliente}}`, `{{valor_total}}`, etc.)
- Níveis de proposta: resumida, por etapas, detalhada e técnica interna
- Pré-visualização A4 + exportação PDF via impressão do navegador
- Fluxo: Proposta → Aprovada → Venda/Contrato → Contas a Receber

### Cronograma Físico-Financeiro
- Etapas com datas previstas/realizadas, % físico e valor financeiro
- Marcos e medições por etapa
- Gantt simplificado em HTML/CSS/JS puro (sem biblioteca)
- Exportação/importação com Microsoft Project via XML
- Geração de mensagem WhatsApp manual com link de acompanhamento

### Financeiro
- Contas a receber e contas a pagar
- Movimentações de caixa e contas bancárias
- Documentos fiscais (NF-e, NFS-e, recibos) com upload de PDF e XML
- Plano de contas e lançamentos contábeis
- DRE gerencial, fluxo de caixa e contabilidade gerencial

### Comercial
- Clientes, fornecedores, produtos e serviços
- Orçamentos, propostas, modelos de proposta, vendas/contratos
- Áreas/disciplinas → Tipos de atuação → Subtipos/Serviços

### Dashboard
- Visão geral da empresa e visão por obra/projeto
- KPIs dinâmicos calculados do banco
- Filtros por período, cliente, obra, status, centro de custo e categoria
- Alertas para contas vencidas, custo acima do previsto e baixa margem
- Indicadores comerciais: propostas emitidas, aprovadas e taxa de conversão

### Configurações e Administração
- Perfis e permissões por módulo (admin, financeiro, comercial, engenharia)
- Estruturas editáveis: tipos de obra, status, etapas, marcos, checklists, formas de pagamento
- Backup manual e automático (cron)
- Migração do localStorage para o banco MariaDB

### Interface
- Barra de favoritos configurável (até 5 módulos fixados)
- Sidebar expansível/recolhível com responsividade completa
- Tema claro com variáveis CSS customizáveis
- Suporte a celular, tablet, notebook e desktop

---

## Como Rodar Localmente

### Pré-requisitos

```bash
sudo apt update
sudo apt install apache2 mariadb-server php php-mysql php-zip
sudo a2enmod rewrite headers
sudo systemctl restart apache2
```

### 1. Clone o repositório

```bash
git clone <url-do-repo> /var/www/financeiro
```

### 2. Configure o banco

```bash
sudo mariadb
```

```sql
CREATE DATABASE IF NOT EXISTS financeiro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'financeiro_app'@'localhost' IDENTIFIED BY 'TROQUE_ESSA_SENHA';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON financeiro.* TO 'financeiro_app'@'localhost';
FLUSH PRIVILEGES;
```

```bash
mysql -u root -p financeiro < /var/www/financeiro/schema.sql
```

### 3. Configure o PHP

```bash
sudo mkdir -p /etc/financeiro
sudo cp /var/www/financeiro/api/config.sample.php /etc/financeiro/config.php
sudo nano /etc/financeiro/config.php
```

Edite as credenciais:

```php
'db' => [
    'host'     => '127.0.0.1',
    'database' => 'financeiro',
    'user'     => 'financeiro_app',
    'password' => 'TROQUE_ESSA_SENHA',
    'charset'  => 'utf8mb4',
],
```

Proteja o arquivo:

```bash
sudo chown root:www-data /etc/financeiro/config.php
sudo chmod 640 /etc/financeiro/config.php
```

### 4. Crie as pastas de dados

```bash
sudo mkdir -p /var/lib/financeiro/backups
sudo mkdir -p /var/lib/financeiro/uploads/{obras,propostas,notas-fiscais,relatorios,projetos,sinapi,project,cotacoes}
sudo chown -R www-data:www-data /var/lib/financeiro
sudo chmod -R 750 /var/lib/financeiro
```

### 5. Configure o Apache

Em `/etc/apache2/sites-available/000-default.conf` (ou no VirtualHost):

```apache
<Directory /var/www/financeiro>
    AllowOverride All
    Require all granted
</Directory>
```

```bash
sudo systemctl reload apache2
```

### 6. Rode as migrations

```bash
for f in /var/www/financeiro/migrations/*.sql; do
  mysql -u root -p financeiro < "$f"
done
```

### 7. Acesse

```
http://localhost/financeiro
```

Login inicial:
- **Usuário:** `admin` **Senha:** `admin123`
- **Usuário:** `alefschimanski` **Senha:** `Schimanski!@#`

> As senhas são convertidas para bcrypt automaticamente no primeiro login. Troque-as pelo módulo `Usuários`.

---

## Como Fazer Deploy

### Deploy via webhook (método atual)

O arquivo `deploy.php` recebe o webhook do GitHub e executa `git pull`:

1. Configure o webhook no GitHub:
   - URL: `https://schimanskiengenharia.com.br/financeiro/deploy.php`
   - Secret: `OBRASYNC_DEPLOY_SECRET_2026`
   - Evento: `push` para `main`

2. Ao fazer `git push origin main`, o deploy é acionado automaticamente.

### Deploy manual via SSH

```bash
ssh usuario@schimanskiengenharia.com.br
cd /var/www/financeiro
git pull origin main
```

### Após o deploy

Se houver migrations novas:

```bash
mysql -u root -p financeiro < /var/www/financeiro/migrations/YYYY-MM-DD-nome.sql
```

### Arquivos que NÃO devem ser sobrescritos no deploy

```
/etc/financeiro/config.php
/var/lib/financeiro/        (uploads e backups)
Banco MariaDB financeiro
```

---

## Estrutura de Arquivos

```
/var/www/financeiro/
  index.html          frontend principal
  app.js              lógica frontend (SPA)
  styles.css          estilos
  deploy.php          webhook de deploy automático
  schema.sql          schema completo do banco
  api/
    index.php         todos os endpoints REST
    .htaccess         roteamento para index.php
    config.sample.php exemplo de configuração
  migrations/         arquivos SQL versionados (YYYY-MM-DD-nome.sql)

/var/lib/financeiro/  (fora da pasta pública)
  uploads/            arquivos enviados pelos usuários
  backups/            backups do banco e uploads

/etc/financeiro/
  config.php          credenciais do banco (nunca editar via deploy)
```

---

## API Principal

```
GET    /financeiro/api/bootstrap          carrega todos os dados iniciais
POST   /financeiro/api/login              autenticação
GET    /financeiro/api/{recurso}          lista registros
POST   /financeiro/api/{recurso}          cria registro
PUT    /financeiro/api/{recurso}/{id}     atualiza registro
DELETE /financeiro/api/{recurso}/{id}     remove registro
POST   /financeiro/api/migrate            migração do localStorage
GET    /financeiro/api/backup/export      exporta backup JSON
POST   /financeiro/api/backup/import      importa backup JSON
POST   /financeiro/api/sinapi-import      importa base SINAPI
POST   /financeiro/api/project-upload     upload de XML do MS Project
```

Recursos disponíveis: `clients`, `suppliers`, `products`, `services`, `projects`, `workBudgets`, `sinapiReferencias`, `sinapiInsumos`, `sinapiComposicoes`, `proposals`, `sales`, `receivables`, `payables`, `cashMovements`, `fiscalDocuments`, `purchaseOrders`, `users`, `permissions` e outros.

---

## Backup

### Manual (interface)

`Configurações > Backup local/servidor`

### Manual (terminal)

```bash
mysqldump -u financeiro_app -p financeiro > /var/lib/financeiro/backups/financeiro-$(date +%F).sql
tar -czf /var/lib/financeiro/backups/uploads-$(date +%F).tar.gz /var/lib/financeiro/uploads
```

### Automático (cron)

```bash
sudo nano /usr/local/bin/backup-financeiro.sh
```

```bash
#!/bin/bash
set -e
BACKUP_DIR="/var/lib/financeiro/backups"
mysqldump -u financeiro_app -p'SENHA' financeiro > "$BACKUP_DIR/financeiro-$(date +%F-%H%M).sql"
tar -czf "$BACKUP_DIR/uploads-$(date +%F-%H%M).tar.gz" /var/lib/financeiro/uploads
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

```bash
sudo chmod 750 /usr/local/bin/backup-financeiro.sh
# Agendar para 2h todo dia:
echo "0 2 * * * /usr/local/bin/backup-financeiro.sh" | sudo crontab -
```

### Restauração

```bash
mysql -u root -p financeiro < /var/lib/financeiro/backups/financeiro-AAAA-MM-DD.sql
sudo tar -xzf /var/lib/financeiro/backups/uploads-AAAA-MM-DD.tar.gz -C /
sudo chown -R www-data:www-data /var/lib/financeiro
```

---

## Versão Atual

- **Versão:** `v1.8.0`
- **Data:** `2026-06-10`
- **Banco:** `financeiro` (MariaDB/MySQL, utf8mb4)
