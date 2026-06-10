# ObraSync

ObraSync é uma aplicação web em HTML, CSS, JavaScript puro, PHP e MariaDB/MySQL para gestão integrada de obras, financeiro, comercial e contabilidade gerencial. O frontend continua em `/var/www/financeiro`, a URL pública permanece `https://schimanskiengenharia.com.br/financeiro`, mas os dados persistentes ficam no banco e os arquivos de dados ficam fora da pasta pública.

## Versão Atual

- Versão: `v1.7.0`
- Data: `2026-06-08`
- Nome visual: `ObraSync`.
- URL mantida: `https://schimanskiengenharia.com.br/financeiro`.
- Resumo: gestor integrado de obras, financeiro, comercial e contabilidade gerencial, com importador SINAPI 04/2026 MS por XLSX/CSV, orçamento de obras baseado em SINAPI, gerador de proposta comercial com modelo editável, pré-visualização/PDF A4, composições próprias, cotações, Curva ABC, cronograma físico-financeiro e integração inicial com Microsoft Project por XML.

Antes de atualizar em produção, faça backup do banco e de `/var/lib/financeiro`. Nunca sobrescreva `/etc/financeiro/config.php`, uploads, backups ou o banco MariaDB/MySQL.

Se existir algum nome do sistema definido manualmente em `/etc/financeiro/config.php`, ajuste esse valor manualmente para `ObraSync` depois do backup. Este pacote não altera `/etc/financeiro/config.php` automaticamente.

## Estrutura Recomendada

Arquivos públicos do sistema:

```bash
/var/www/financeiro
  index.html
  styles.css
  app.js
  assets/
  api/
  README.md
```

Dados fora da pasta pública:

```bash
/var/lib/financeiro
  backups/
  uploads/
```

Configuração sensível fora da pasta pública:

```bash
/etc/financeiro/config.php
```

## Banco de Dados

1. Instale dependências:

```bash
sudo apt update
sudo apt install apache2 mariadb-server php php-mysql
```

2. Crie banco e usuário:

```bash
sudo mariadb
```

```sql
CREATE DATABASE IF NOT EXISTS financeiro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'financeiro_app'@'localhost' IDENTIFIED BY 'TROQUE_ESSA_SENHA_FORTE';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON financeiro.* TO 'financeiro_app'@'localhost';
FLUSH PRIVILEGES;
```

3. Importe o schema:

```bash
mysql -u root -p financeiro < /var/www/financeiro/schema.sql
```

O schema cria tabelas para clientes, fornecedores, produtos, serviços, categorias, centros de custo, obras/projetos, cronograma físico-financeiro, marcos, notificações, links de acompanhamento, pedidos de compra, relatórios técnicos, propostas comerciais, modelos de propostas, contas bancárias, orçamentos, vendas, contas a receber, contas a pagar, caixa/bancos, plano de contas, lançamentos contábeis, permissões, versões, configurações, preferências e usuários.

## Configuração PHP

Copie o exemplo:

```bash
sudo mkdir -p /etc/financeiro
sudo cp /var/www/financeiro/api/config.sample.php /etc/financeiro/config.php
sudo nano /etc/financeiro/config.php
```

Defina as credenciais reais:

```php
'db' => [
    'host' => '127.0.0.1',
    'database' => 'financeiro',
    'user' => 'financeiro_app',
    'password' => 'TROQUE_ESSA_SENHA_FORTE',
    'charset' => 'utf8mb4',
],
```

Proteja o arquivo:

```bash
sudo chown root:www-data /etc/financeiro/config.php
sudo chmod 640 /etc/financeiro/config.php
```

## Pastas de Dados

```bash
sudo mkdir -p /var/lib/financeiro/backups /var/lib/financeiro/uploads
sudo chown -R www-data:www-data /var/lib/financeiro
sudo chmod -R 750 /var/lib/financeiro
```

Não salve anexos, PDFs, exports ou backups em `assets/` nem em `/var/www/financeiro`.

Estrutura preparada para anexos futuros:

```bash
/var/lib/financeiro/uploads/obras
/var/lib/financeiro/uploads/propostas
/var/lib/financeiro/uploads/notas-fiscais
/var/lib/financeiro/uploads/relatorios
/var/lib/financeiro/uploads/projetos
/var/lib/financeiro/uploads/sinapi
/var/lib/financeiro/uploads/project
/var/lib/financeiro/uploads/cotacoes
```

## Apache

Ative rewrite e headers:

```bash
sudo a2enmod rewrite headers
sudo systemctl reload apache2
```

Garanta que o diretório permita `.htaccess`:

```apache
<Directory /var/www/financeiro>
    AllowOverride All
    Require all granted
</Directory>
```

O sistema continuará acessível em:

```text
https://schimanskiengenharia.com.br/financeiro
```

## Login Inicial

O `schema.sql` cria usuários iniciais:

- `admin` / `admin123`
- `alefschimanski` / `Schimanski!@#`

No primeiro login, a API regrava a senha como hash. Troque as senhas imediatamente pelo módulo `Usuários`.

O login agora emite um token de sessão da API (tabela `api_sessions`, criada pela migration `2026-06-10-api-auth-sessions.sql` ou sob demanda pela própria API). O frontend envia esse token em todas as requisições (`Authorization: Bearer ...`) e a sessão expira após 30 minutos de inatividade, em sincronia com o timeout do frontend.

O bypass de login do frontend (`AUTH_BYPASS_FOR_TESTS`) é derivado do ambiente (`APP_ENV`): nunca vale em produção e, mesmo em desenvolvimento, só se aplica quando a API não está ativa (modo `localStorage`). No backend, o bypass de desenvolvimento (`auth.dev_bypass` em `/etc/financeiro/config.php`) fica desligado por padrão e só atende requisições vindas de `127.0.0.1`/`::1`. Nunca habilite em produção.

## API PHP

Endpoints principais:

```text
GET    /financeiro/api/bootstrap
POST   /financeiro/api/login
GET    /financeiro/api/fornecedores
POST   /financeiro/api/fornecedores
PUT    /financeiro/api/fornecedores/{id}
DELETE /financeiro/api/fornecedores/{id}
POST   /financeiro/api/migrate
GET    /financeiro/api/backup/export
POST   /financeiro/api/backup/import
POST   /financeiro/api/sinapi-upload
POST   /financeiro/api/sinapi-import
POST   /financeiro/api/project-upload
POST   /financeiro/api/logout
```

Autenticação e autorização por rota:

- Todas as rotas exigem token de sessão, exceto `POST /login`.
- `backup` e `migrate` exigem perfil `admin`.
- `sinapi-upload`/`sinapi-import` exigem permissão de edição em Configuração SINAPI; `project-upload` exige edição no Cronograma.
- CRUD genérico valida a permissão do perfil por módulo e por ação (GET=visualizar, POST=criar, PUT/PATCH=editar, DELETE=excluir), usando a tabela `role_permissions` quando houver linha cadastrada e, na ausência dela, os mesmos padrões de perfis do frontend.
- O `bootstrap` devolve apenas os módulos que o perfil autenticado pode visualizar (usuários vêm em versão resumida para exibir vínculos por nome).
- Downloads de notas fiscais aceitam o token via `?token=` por serem navegação direta do navegador.

Módulos cobertos: clientes, fornecedores, produtos, serviços, obras/projetos, orçamentos de obras, base SINAPI, composições próprias, cotações, Curva ABC, cronograma, importação/exportação Microsoft Project, pedidos de compra, relatórios técnicos, propostas, modelos de propostas, áreas/disciplinas, tipos de atuação, subtipos/serviços, contas a receber, contas a pagar, movimentações de caixa, categorias, centros de custo, contas bancárias, documentos fiscais, permissões, estruturas editáveis, versões e usuários.

## Dashboard

O dashboard possui:

- Visão geral da empresa.
- Visão por obra/projeto específico.
- KPIs dinâmicos calculados do banco.
- Gráficos SVG sem CDN.
- Indicadores comerciais: propostas emitidas, propostas aprovadas e taxa de conversão.
- Indicadores por obra: propostas vinculadas, pedidos de compra e relatórios técnicos.
- Filtros por período, cliente, obra/projeto, status da obra, centro de custo e categoria.
- Alertas para contas vencidas, custo realizado acima do previsto e baixa margem.

Regras importantes:

- Sem data inicial e sem data final: mostra todos os registros.
- Apenas data inicial: mostra registros a partir dessa data.
- Apenas data final: mostra registros até essa data.
- Data inicial e final: mostra registros dentro do intervalo.
- Visão geral da empresa: consolida todos os dados da empresa, sem depender de uma obra específica.
- Visão por obra/projeto: filtra serviços, produtos, receitas, despesas, contas, movimentações, fornecedores e documentos fiscais vinculados à obra selecionada.

## Obras/Projetos como Eixo Central

O módulo de obras/projetos foi ampliado para aceitar responsável técnico, gestor da obra, comercial responsável, financeiro responsável, data de conclusão e custo realizado.

Cada registro financeiro, comercial ou técnico pode ser vinculado à obra/projeto por `projectId`. Isso permite filtrar dashboard, custos, receitas, pedidos de compra, relatórios técnicos, notas fiscais, propostas, vendas e contas por obra.

Status previstos:

- Planejamento.
- Proposta enviada.
- Contratada.
- Em andamento.
- Pausada.
- Concluída.
- Cancelada.

## Orçamentos de Obras e SINAPI

O menu `Obras/Projetos` possui:

- `Orçamentos de Obras`.
- `Base SINAPI`.
- `Insumos SINAPI`.
- `Composições SINAPI`.
- `Itens das composições SINAPI`.
- `Mão de obra SINAPI`.
- `Famílias e coeficientes`.
- `Manutenções SINAPI`.
- `Composições Próprias`.
- `Cotações`.
- `Curva ABC`.

Arquivos SINAPI 04/2026 analisados para preparar o importador:

- `SINAPI_Referência_2026_04.xlsx`.
- `SINAPI_mao_de_obra_2026_04.xlsx`.
- `SINAPI_familias_e_coeficientes_2026_04.xlsx`.
- `SINAPI_Manutenções_2026_04.xlsx`.

Referência padrão criada:

- Fonte: `SINAPI/CAIXA`.
- UF padrão: `MS`.
- Local de uso principal: `Campo Grande/MS`.
- Mês/ano: `04/2026`.
- Data de emissão identificada nos arquivos: `12/05/2026`.
- Tipos: `Sem desoneração`, `Com desoneração` e `Sem encargos sociais`.

Mapeamento do arquivo `SINAPI_Referência_2026_04.xlsx`:

- `ISD`: insumos com encargos sociais sem desoneração.
- `ICD`: insumos com encargos sociais com desoneração.
- `ISE`: insumos sem encargos sociais.
- `CSD`: composições com encargos sociais sem desoneração.
- `CCD`: composições com encargos sociais com desoneração.
- `CSE`: composições sem encargos sociais.
- `Analítico`: itens e coeficientes das composições.

Nas abas `CSD`, `CCD` e `CSE`, o código da composição vem como fórmula de hiperlink no XLSX da CAIXA. O importador extrai o código da fórmula quando o valor em cache vier `0`.

Fluxo recomendado:

1. Cadastre ou selecione uma obra/projeto.
2. Confira a referência padrão `MS 04/2026` em `Base SINAPI`.
3. Em `Base SINAPI > Importar SINAPI`, selecione o arquivo XLSX ou CSV, mês/ano, UF e tipo padrão.
4. Clique em `Validar / prévia`.
5. Confira o resumo de insumos, composições, itens analíticos, mão de obra, famílias ou manutenções.
6. Clique em `Confirmar importação` para gravar no MariaDB/MySQL.
7. Pesquise insumos ou composições por código ou descrição.
8. Selecione o orçamento destino e clique em `Adicionar` para criar o item do orçamento.
9. Ajuste quantidade, etapa da obra, centro de custo, categoria, custo unitário e BDI.
10. Use `Gerar proposta` para criar uma proposta comercial a partir do orçamento.
11. Use `Gerar cronograma` para criar etapas do cronograma físico-financeiro agrupadas por etapa do orçamento.

Busca SINAPI:

- Aceita termos não consecutivos, como `eletroduto pvc 25`, `concreto fck 25`, `tomada 2p t` ou `alvenaria bloco ceramico`.
- Permite filtrar por UF, tipo de referência, insumos, composições, mão de obra, famílias/coeficientes e manutenções.
- O padrão inicial é `MS` e referência `04/2026`.

Compatibilidade XLSX/CSV:

- XLSX: a API lê diretamente quando o PHP tiver `ZipArchive/php-zip` disponível.
- CSV: alternativa estável quando o servidor não tiver suporte a XLSX.
- Para CSV, abra a planilha no Excel/LibreOffice, selecione a aba desejada e salve como `CSV UTF-8`.
- Ao importar CSV, selecione no campo `Aba CSV / tipo de aba` a aba exportada: `ISD`, `ICD`, `ISE`, `CSD`, `CCD`, `CSE`, `Analítico`, `SEM Desoneração`, `COM Desoneração`, `Coeficientes` ou `Manutenções`.

No Debian, se quiser importar XLSX direto, instale o suporte Zip do PHP:

```bash
sudo apt install php-zip
sudo systemctl reload apache2
```

Configurações editáveis em `Configurações > Configuração SINAPI`:

- UF padrão.
- Mês/ano padrão.
- Tipo de referência padrão.
- BDI padrão.
- Uso padrão de composições ou insumos.
- Exibir código SINAPI na proposta.
- Exibir composições analíticas na proposta.
- Exibir preço unitário na proposta.
- Exibir apenas valor global na proposta.

Níveis de proposta a partir de orçamento SINAPI:

- `Proposta resumida`: escopo textual e valor global.
- `Proposta por grupos/etapas`: agrupa por etapa e exibe valor por etapa.
- `Proposta detalhada`: exibe unidade, quantidade, preço de venda e total, ocultando custo interno.
- `Proposta técnica interna`: exibe custo, BDI e dados internos; fica restrita a administrador, financeiro, engenharia ou gestor autorizado.

Os arquivos importados são salvos fora da pasta pública:

```bash
/var/lib/financeiro/uploads/sinapi
/var/lib/financeiro/uploads/project
```

Não salve bases SINAPI, XML do Project, cotações ou anexos em `/var/www/financeiro/assets`.

Tabelas principais:

- `sinapi_referencias`.
- `sinapi_insumos`.
- `sinapi_composicoes`.
- `sinapi_composicao_itens`.
- `sinapi_mao_de_obra`.
- `sinapi_familias_coeficientes`.
- `sinapi_manutencoes`.
- `sinapi_configuracoes`.
- `orcamentos_obras`.
- `orcamento_obra_itens`.
- `composicoes_proprias`.
- `cotacoes`.

O orçamento calcula custo direto, custo total, preço total, BDI e desconto. A `Curva ABC` ordena os itens por valor total, calcula percentual individual, percentual acumulado e classifica em A, B ou C.

## Gerador de Proposta Comercial

No módulo `Obras/Projetos > Orçamentos de Obras`, o botão `Gerar Proposta` cria uma proposta comercial a partir do orçamento selecionado.

Fluxo recomendado:

1. Selecione um orçamento nos status `Rascunho`, `Em análise` ou `Aprovado`.
2. Clique em `Gerar Proposta`.
3. Escolha o modelo de proposta.
4. Confirme cliente, obra/projeto, condição de pagamento, prazo, validade e responsáveis.
5. Revise o escopo gerado automaticamente pelos itens do orçamento.
6. Escolha se a proposta exibirá tabela resumida, tabela detalhada, agrupamento por etapa, agrupamento por categoria, agrupamento por centro de custo ou apenas valor global.
7. Use a pré-visualização para editar textos antes de finalizar.
8. Salve como `Rascunho` ou finalize como `Gerada`.
9. Use `Exportar / Imprimir PDF` para abrir a impressão do navegador em layout A4.

A proposta gerada mantém vínculo com:

- Orçamento de obra original.
- Obra/projeto.
- Cliente.
- Modelo de proposta.
- Usuário responsável.

O sistema cria registros auxiliares em:

- `commercial_proposals`.
- `proposta_itens`.
- `proposta_orcamento_vinculos`.
- `proposta_variaveis`.
- `proposta_status_historico`.
- `proposta_arquivos`, preparado para PDFs salvos futuramente fora da pasta pública.

Os modelos de proposta continuam editáveis em:

```text
Área/Disciplina -> Tipo de atuação -> Subtipo/Serviço -> Modelo de proposta
```

Variáveis aceitas no modelo:

```text
{{nome_cliente}}
{{cpf_cnpj_cliente}}
{{endereco_cliente}}
{{nome_obra}}
{{endereco_obra}}
{{tipo_obra}}
{{numero_orcamento}}
{{versao_orcamento}}
{{data_orcamento}}
{{data_proposta}}
{{validade_proposta}}
{{responsavel_tecnico}}
{{crea_cau}}
{{responsavel_comercial}}
{{nome_empresa}}
{{cnpj_empresa}}
{{telefone_empresa}}
{{email_empresa}}
{{valor_total}}
{{valor_total_extenso}}
{{condicao_pagamento}}
{{prazo_execucao}}
{{observacoes}}
{{tabela_itens_orcamento}}
{{resumo_itens_orcamento}}
{{escopo_gerado_pelos_itens}}
{{total_servicos}}
{{total_produtos}}
{{total_mao_de_obra}}
{{total_materiais}}
{{total_equipamentos}}
{{total_terceiros}}
{{bdi_percentual}}
{{valor_bdi}}
{{desconto_percentual}}
{{valor_desconto}}
```

O gerador usa somente preço de venda na proposta do cliente. Custos internos, margem, composições analíticas e BDI detalhado não são exibidos, salvo se o administrador adaptar o modelo e a política de visualização.

Para PDF nesta etapa, a prioridade é a impressão do navegador com `@media print` e layout A4. Não salve PDFs em `/var/www/financeiro/assets`. Caso uma versão gerada seja persistida futuramente, use:

```bash
/var/lib/financeiro/uploads/propostas
```

Propostas finalizadas podem seguir o fluxo comercial:

- Alterar status para `Aprovada`.
- Usar `Converter` para criar venda/contrato.
- Usar `Gerar contas` para criar parcelas em contas a receber conforme a condição de pagamento.

## Estruturas Editáveis

Em `Configurações`, o administrador pode manter estruturas editáveis sem engessar o sistema:

- Tipos de obra.
- Status de obra.
- Etapas padrão.
- Marcos padrão.
- Campos personalizados.
- Modelos de relatório.
- Tipos de documento.
- Checklists.
- Tipos de medição.
- Formas de pagamento.
- Mensagens padrão.
- Regras de visualização.

Campos personalizados ficam em:

- `obra_tipos`.
- `obra_campos_personalizados`.
- `obra_valores_personalizados`.

Use esses cadastros para adaptar o ObraSync a construção civil, reforma, energia solar, subestação, laudo técnico, consultoria, regularização e outros tipos de obra.

## Cronograma Físico-Financeiro

O menu `Obras/Projetos > Cronograma Físico-Financeiro` permite cadastrar várias etapas por obra/projeto.

Campos principais da etapa:

- Obra/projeto.
- Nome da etapa.
- Descrição.
- Ordem.
- Data prevista de início e término.
- Data real de início e término.
- Percentual físico previsto e realizado.
- Valor financeiro previsto e realizado.
- Status: Não iniciada, Em andamento, Concluída, Atrasada, Pausada ou Cancelada.
- Responsável.
- Observações.

Cada etapa pode ser marcada como marco importante, com nome do marco, mensagem padrão e opção de liberar para cliente/investidor.

O módulo calcula automaticamente:

- Percentual físico previsto e realizado.
- Valor financeiro previsto e realizado.
- Diferença entre previsto e realizado.
- Atraso em dias.
- Etapas atrasadas, concluídas e em andamento.
- Saldo financeiro da obra.
- Próximo marco.

## Gantt Simplificado

A tela do cronograma possui uma visualização tipo Gantt feita em HTML, CSS e JavaScript puro, sem biblioteca pesada.

Em desktop, o Gantt mostra coluna de etapas e barras horizontais de previsto x realizado, com linha da data atual e indicação de marcos.

Em celular, a tela exibe cards responsivos com etapa, status, datas, percentual físico, valor financeiro, responsável e atraso quando houver.

## Microsoft Project

No `Cronograma Físico-Financeiro`, a integração inicial é por arquivo, sem API online:

- `Exportar para MS Project`: gera XML compatível com Microsoft Project Desktop.
- `Importar XML do MS Project`: lê tarefas do XML, mostra prévia e cria etapas após confirmação.
- `Exportar Excel/CSV`: baixa as etapas em CSV.
- `Exportar PDF/impressão`: usa a impressão do navegador.

Mapeamento inicial:

- Nome da etapa -> `Task Name`.
- Data prevista de início -> `Start`.
- Data prevista de término -> `Finish`.
- Duração -> `Duration`.
- Percentual físico realizado -> `Percent Complete`.
- Responsável -> recursos do Project quando informado.
- Marco -> `Milestone`.
- Dependências -> `PredecessorLink`.
- Valor financeiro previsto -> `Cost`.

Arquivos XML importados são armazenados pelo endpoint `POST /financeiro/api/project-upload` em:

```bash
/var/lib/financeiro/uploads/project
```

## WhatsApp Manual

O botão `Enviar atualização por WhatsApp` gera um link `wa.me` com mensagem preenchida automaticamente para o telefone do cliente vinculado à obra.

A mensagem inclui:

- Nome do cliente.
- Nome da obra.
- Marco concluído.
- Percentual físico executado.
- Percentual financeiro executado.
- Próximo marco previsto.
- Link interno de acompanhamento.
- Assinatura Schimanski Engenharia.

Nesta etapa não há integração com a API oficial do WhatsApp. O sistema apenas gera o link manual, registra a notificação como `Preparado` e permite marcar como `Enviado manualmente` após confirmação.

Tabelas criadas para esta etapa:

- `obra_cronograma_etapas`.
- `obra_cronograma_marcos`.
- `obra_notificacoes`.
- `obra_links_acompanhamento`.

## Perfis e Permissões

Perfis preparados:

- Administrador: acesso total.
- Financeiro: financeiro, contabilidade gerencial, documentos fiscais, relatórios e exportações.
- Comercial: clientes, orçamentos, propostas próprias, modelos e vendas autorizadas.
- Engenharia/Técnico/Gestor de obra: obras, cronograma, pedidos, relatórios técnicos e propostas vinculadas.
- Equipe de campo: previsto para etapa futura, sem operação completa nesta etapa.
- Cliente/Dono da obra: previsto para portal futuro, com visão limitada a itens liberados.
- Fornecedor/Terceiro: cadastro preparado para uso futuro.

A tabela `role_permissions` prepara ações por módulo: visualizar, criar, editar, excluir, exportar, aprovar e anexar arquivo. A regra operacional atual continua compatível com o frontend e não remove o login existente.

## Propostas Comerciais

O menu `Comercial` agora possui:

- Orçamentos.
- Propostas.
- Modelos de propostas.
- Áreas/Disciplinas.
- Tipos de atuação.
- Subtipos/Serviços.
- Vendas/Contratos.

A classificação segue a estrutura:

```text
Área/Disciplina -> Tipo de atuação -> Subtipo/Serviço -> Modelo de proposta
```

Exemplos iniciais: Engenharia Elétrica, Engenharia Civil, Arquitetura, Gestão de Obras e Energia Solar Fotovoltaica. O administrador pode criar novas áreas, tipos, subtipos, modelos e ativar/inativar modelos.

Uma proposta pode ser independente, vinculada a cliente, obra/projeto, orçamento, serviço ou modelo. Também pode ter origem como nova demanda, derivada de laudo, derivada de projeto, derivada de obra existente, adicional/serviço complementar, retrofit, manutenção, regularização ou outro.

Os modelos aceitam variáveis dinâmicas no texto, como:

```text
{{nome_cliente}}
{{cpf_cnpj_cliente}}
{{endereco_cliente}}
{{nome_obra}}
{{endereco_obra}}
{{tipo_servico}}
{{descricao_servico}}
{{valor_total}}
{{condicao_pagamento}}
{{prazo_entrega}}
{{validade_proposta}}
{{data_proposta}}
{{responsavel_tecnico}}
{{crea_cau}}
{{nome_empresa}}
{{cnpj_empresa}}
{{telefone_empresa}}
{{email_empresa}}
```

## Máscaras e Formatação

Os formulários possuem placeholders e máscaras visuais para:

- Telefone/celular: `(67) 99999-9999` ou `(67) 3333-3333`.
- E-mail: `joao@gmail.com`, com validação antes de salvar.
- CPF/CNPJ em clientes, fornecedores e dados da empresa.
- CEP em campos `cep`, `zipCode` ou `postalCode`, quando existirem.
- Moeda brasileira: exibição em `R$ 1.000,00` e envio ao banco como decimal `1000.00`.
- Percentuais: exibição em `10,00%` e envio ao banco como número.

Valores monetários são exibidos em padrão brasileiro nos cards, tabelas, relatórios, propostas, contas, obras/projetos e gráficos.

## Responsividade

O layout foi reforçado para celular, tablet, notebook, desktop e telas grandes:

- Sidebar continua expansível no desktop e vira menu lateral ocultável no celular.
- Filtros ficam recolhíveis no celular pelo botão `Mostrar filtros` / `Ocultar filtros`.
- KPIs usam grade responsiva.
- Gráficos e painéis ocupam 100% da largura disponível.
- Tabelas mantêm rolagem horizontal controlada.
- Formulários ficam em uma coluna no celular.
- Cronograma físico-financeiro troca Gantt/tabela por cards simplificados em telas pequenas.
- Botões ficam maiores e com espaçamento adequado para toque.

## Notas Fiscais / Documentos Fiscais

O menu `Obras/Projetos > Notas Fiscais / Documentos Fiscais` permite cadastrar documentos vinculados a obras/projetos com:

- Obra/projeto.
- Fornecedor/prestador.
- Número da nota fiscal.
- Data de emissão.
- Valor.
- Tipo: Nota Fiscal de Serviço, Nota Fiscal de Produto, Recibo, Comprovante ou Outro.
- Status: Pendente, Anexada, Conferida ou Cancelada.
- Vínculo opcional com conta a pagar, conta a receber, venda/contrato, centro de custo e categoria financeira.
- Upload de PDF e XML.
- Observações.

Os arquivos não ficam em `/var/www/financeiro/assets`. A API salva os anexos em:

```bash
/var/lib/financeiro/uploads/notas-fiscais
```

Permissões recomendadas:

```bash
sudo mkdir -p /var/lib/financeiro/uploads/notas-fiscais
sudo chown -R www-data:www-data /var/lib/financeiro/uploads/notas-fiscais
sudo chmod -R 750 /var/lib/financeiro/uploads/notas-fiscais
```

O banco guarda apenas o caminho interno dos arquivos. O download deve ser feito pela API, por exemplo:

```text
/financeiro/api/notas-fiscais/{id}/pdf
/financeiro/api/notas-fiscais/{id}/xml
```

As permissões seguem a estrutura descrita em `Perfis e Permissões`. Cliente/dono da obra não possui acesso a notas fiscais internas nesta etapa.

## Migração Segura da Tabela de Notas Fiscais

Para bancos já existentes, execute a migração sem apagar dados:

```bash
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-06-fiscal-documents.sql
```

Essa migração usa `CREATE TABLE IF NOT EXISTS`, portanto não reseta tabelas existentes.

Para habilitar os campos opcionais de CEP/endereço em clientes, fornecedores, obras e dados da empresa:

```bash
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-06-contact-fields.sql
```

Para habilitar versionamento, perfis, permissões preparadas, propostas comerciais, cronograma, pedidos de compra e relatórios técnicos:

```bash
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-06-integrated-management-proposals-rbac.sql
```

Para habilitar o cronograma físico-financeiro, marcos, notificações WhatsApp manual e links de acompanhamento:

```bash
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-07-physical-financial-schedule-whatsapp.sql
```

Para registrar a consolidação ObraSync no histórico de versões:

```bash
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-07-obrasync-integration-review.sql
```

Para habilitar SINAPI, orçamentos de obras, composições próprias, cotações, Curva ABC, integração Microsoft Project e estruturas editáveis:

```bash
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-08-sinapi-msproject-editable-structures.sql
```

Para habilitar o gerador de proposta comercial a partir de orçamento de obra:

```bash
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-08-proposal-generator-from-work-budget.sql
```

Para habilitar o importador SINAPI 04/2026 MS, mão de obra, famílias/coeficientes, manutenções e configuração SINAPI:

```bash
mysql -u root -p financeiro < /var/www/financeiro/migrations/2026-06-08-sinapi-2026-04-ms-importer.sql
```

Crie também as subpastas de upload:

```bash
sudo mkdir -p /var/lib/financeiro/uploads/sinapi /var/lib/financeiro/uploads/project /var/lib/financeiro/uploads/cotacoes /var/lib/financeiro/uploads/propostas
sudo chown -R www-data:www-data /var/lib/financeiro/uploads/sinapi /var/lib/financeiro/uploads/project /var/lib/financeiro/uploads/cotacoes /var/lib/financeiro/uploads/propostas
sudo chmod -R 750 /var/lib/financeiro/uploads/sinapi /var/lib/financeiro/uploads/project /var/lib/financeiro/uploads/cotacoes /var/lib/financeiro/uploads/propostas
```

A API foi preparada para ignorar campos novos caso a coluna ainda não exista, evitando quebra durante a atualização dos arquivos.

## Migração do localStorage

Use o menu:

```text
Configurações > Migração para banco
```

A migração:

- lê os dados antigos do `localStorage`;
- envia para `/financeiro/api/migrate`;
- mostra quantos registros foram criados ou atualizados;
- mantém os dados antigos até confirmação do usuário;
- tenta evitar duplicidades por documento, código, nome ou usuário.

## Revisão de Integração

Obra/projeto é o eixo central do ObraSync. O padrão interno de vínculo é `projectId`.

Módulos integrados por `projectId`:

- Propostas.
- Orçamentos.
- Orçamentos de obras.
- Itens do orçamento.
- Cotações.
- Composições próprias.
- Vendas/Contratos.
- Contas a receber.
- Contas a pagar.
- Movimentações de caixa.
- Documentos fiscais / notas fiscais.
- Pedidos de compra.
- Relatórios técnicos.
- Cronograma físico-financeiro.
- Produtos.
- Serviços.
- Lançamentos contábeis e impostos, quando aplicável.

A API também aceita aliases comuns em integrações, como `obra_id`, `projeto_id`, `project_id`, `cliente_id`, `fornecedor_id`, `proposta_id`, `conta_pagar_id`, `conta_receber_id`, `etapa_id` e `marco_id`, convertendo internamente para o padrão camelCase do sistema.

Fluxo comercial integrado:

- Proposta pode ser independente ou vinculada a cliente, obra/projeto, orçamento, serviço e modelo.
- Orçamento de obra aprovado pode gerar proposta comercial mantendo o vínculo `workBudgetId`.
- Proposta aprovada pode ser convertida em venda/contrato pela ação `Converter`.
- Venda/contrato pode gerar conta a receber pela ação `Gerar conta`.
- Conta a receber mantém vínculo com cliente, obra/projeto, proposta, categoria e centro de custo.

Fluxo financeiro e contábil:

- Contas a receber e a pagar alimentam dashboard, fluxo de caixa, DRE gerencial e relatórios.
- Movimentações de caixa alimentam saldo e fluxo realizado.
- Documentos fiscais podem ser vinculados a obra, fornecedor, venda/contrato, conta a pagar, conta a receber, centro de custo e categoria.
- Lançamentos contábeis continuam separados do financeiro, com competência, débito, crédito, histórico, valor e documento de origem.

Dashboard:

- Visão geral ObraSync consolida a empresa e não depende da obra selecionada.
- Visão por obra/projeto filtra registros vinculados à obra selecionada.
- Filtros de data seguem a regra: sem data mostra tudo; só inicial mostra a partir; só final mostra até; inicial e final mostram intervalo.

## Checklist Pós-Atualização

Após subir os arquivos e rodar as migrações necessárias, testar:

- Login com usuário administrador.
- Cadastro de cliente.
- Cadastro de fornecedor.
- Cadastro de produto.
- Cadastro de serviço.
- Criação de obra/projeto.
- Cadastro de tipo de obra e campo personalizado.
- Criação de orçamento de obra.
- Configuração SINAPI padrão MS 04/2026.
- Prévia de importação SINAPI.
- Importação XLSX da referência SINAPI, se `php-zip` estiver instalado.
- Importação CSV de uma aba SINAPI exportada do Excel.
- Importação de base SINAPI em CSV.
- Importação de mão de obra SINAPI.
- Importação de famílias e coeficientes SINAPI.
- Importação de manutenções SINAPI.
- Busca SINAPI com termos não consecutivos.
- Inclusão de item SINAPI no orçamento.
- Composição própria adicionada ao orçamento.
- Cotação vinculada ao orçamento.
- Curva ABC do orçamento.
- Criação de proposta.
- Geração de proposta a partir de orçamento de obra.
- Seleção de modelo no gerador de proposta.
- Pré-visualização A4 da proposta gerada.
- Impressão/exportação em PDF pelo navegador.
- Histórico de status da proposta.
- Conversão de proposta aprovada em venda/contrato.
- Geração de contas a receber a partir de proposta aprovada.
- Geração de conta a receber a partir de venda/contrato.
- Criação de conta a pagar.
- Movimentação de caixa.
- Documento fiscal com vínculo financeiro.
- Dashboard geral ObraSync.
- Dashboard por obra/projeto.
- Cronograma físico-financeiro e Gantt.
- Exportação do cronograma para XML do Microsoft Project.
- Importação de XML do Microsoft Project com prévia.
- Geração de WhatsApp manual.
- Histórico de notificações.
- Permissões por perfil.
- Upload/download de documento fiscal.
- API `/financeiro/api/bootstrap`.
- Backup manual.
- Responsividade em celular, tablet, notebook e desktop.

## Backup Manual

No sistema, use:

```text
Configurações > Backup local/servidor
```

Ou pelo terminal:

```bash
mysqldump -u financeiro_app -p financeiro > /var/lib/financeiro/backups/financeiro-$(date +%F).sql
tar -czf /var/lib/financeiro/backups/uploads-$(date +%F).tar.gz /var/lib/financeiro/uploads
```

## Backup Automático com Cron

Crie o script:

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
tar -czf "$BACKUP_DIR/notas-fiscais-$(date +%F-%H%M).tar.gz" /var/lib/financeiro/uploads/notas-fiscais
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

```bash
sudo chmod 750 /usr/local/bin/backup-financeiro.sh
sudo crontab -e
```

Executar todo dia às 2h:

```cron
0 2 * * * /usr/local/bin/backup-financeiro.sh
```

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

## Atualização Segura

Para atualizar o sistema, substitua apenas:

```bash
/var/www/financeiro/index.html
/var/www/financeiro/styles.css
/var/www/financeiro/app.js
/var/www/financeiro/assets/
/var/www/financeiro/api/
/var/www/financeiro/README.md
```

Não apague:

```bash
/etc/financeiro/config.php
/var/lib/financeiro
Banco MariaDB/MySQL financeiro
```

Assim, clientes, fornecedores, produtos, serviços, obras/projetos, contas, anexos, backups e configurações permanecem preservados.

## Backlog Técnico Prioritário

Revisão do código atual para a próxima rodada de implementação:

### P0 - Corrigir base do funcionamento

- Colocar autenticação e autorização reais na API PHP, com validação por rota e por perfil.
- Tratar respostas não-JSON no frontend antes do `JSON.parse`, para não quebrar em páginas HTML de erro.
- Blindar `loadDb()` e qualquer leitura de `localStorage` com `try/catch` e fallback para `seed`.
- Padronizar o `AUTH_BYPASS_FOR_TESTS` como recurso de desenvolvimento e nunca de produção.
- Revisar o boot do app para diferenciar claramente `file:`, `localhost`, Apache local e ambiente publicado.

### P1 - Reduzir risco funcional por módulo

- `Dashboard`: validar todos os filtros e datas antes de renderizar gráficos e KPIs.
- `CRUD genérico`: padronizar escape HTML em opções, labels e tabelas montadas com `innerHTML`.
- `Agenda` e `Kanban`: quebrar a lógica em helpers menores e corrigir tratamento de datas inválidas.
- `Cronograma físico-financeiro` e `Gantt`: revisar cálculos de intervalo, dependências e fallback mobile.
- `Propostas`: separar geração de conteúdo, preview, persistência e exportação em etapas independentes.
- `Financeiro`: revisar consistência entre contas, caixa, conciliação e vínculos por obra/projeto.
- `Documentos fiscais`: garantir download, upload e vínculo com permissões reais no backend.
- `Relatórios`: revisar agregações e filtros para não depender de estado global implícito.

### P2 - Manutenção e qualidade

- Extrair constantes e regras repetidas de `app.js` para módulos menores.
- Criar uma camada única de helpers para datas, dinheiro, texto seguro e montagem de selects.
- Reduzir o uso de `innerHTML` onde houver dados dinâmicos que possam mudar de origem.
- Revisar o CSS para eliminar padrões repetidos, consolidar breakpoints e melhorar responsividade real em telas pequenas.
- Revisar acessibilidade dos dialogs, foco inicial, navegação por teclado e estados de erro.
- Adicionar validações e testes mínimos para login, bootstrap, agenda, propostas e backups.

### Ordem sugerida de implementação

1. Autenticação/autorização na API.
2. Tolerância a erro no bootstrap e no `apiRequest()`.
3. Blindagem de `localStorage` e normalização de datas.
4. Revisão de `Agenda`, `Kanban` e `Cronograma`.
5. Revisão de `Propostas` e exportação/PDF.
6. Limpeza estrutural de `app.js` e racionalização do CSS.
7. Testes mínimos e checklist de regressão por módulo.
