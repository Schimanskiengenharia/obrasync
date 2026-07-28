# Varredura técnica e funcional — Obras/Projetos → Cotações

**Data:** 2026-07-27  
**Escopo:** análise estática de ponta a ponta, sem alteração de código, banco, schema ou dados  
**Versão analisada:** v1.38.0  
**Resultado geral:** o ObraSync já possui o núcleo de uma cotação de compra item a item e fecha o ciclo até pedido, conta a pagar, nota fiscal e realizado. Porém, há três portas de entrada para “Cotações”, dois fluxos pós-obra concorrentes e regras diferentes entre eles. O maior risco não é ausência de estrutura: é duplicar pedidos/financeiro ou perder rastreabilidade ao continuar evoluindo caminhos paralelos.

## 1. Limites e método

Esta revisão foi feita por leitura estática do repositório. Não houve conexão com o banco de produção nem execução de fluxo com dados reais. Portanto:

- “PRONTO” significa que frontend, backend e persistência foram encontrados e parecem coerentes por inspeção;
- não confirma que as migrations estejam aplicadas no servidor;
- não confirma permissões do diretório de uploads nem dependências opcionais (`PhpSpreadsheet` e `pdftotext`);
- não confirma comportamento com dados históricos inconsistentes;
- não houve alteração de código, banco, schema, migration, commit ou push.

### Arquivos e documentos analisados

- `CLAUDE.md`
- `README.md`
- `STATUS.md`
- `docs/arquitetura/mapa-modulos-conexoes.md`
- `docs/revisao/2026-fluxo-desejado-vs-atual.md`
- `docs/superpowers/specs/2026-07-18-estudo-benchmark-modulos-design.md`
- `docs/superpowers/plans/2026-07-18-estudo-benchmark-modulos.md`
- documentos de modo privacidade e tema que citam os componentes de Cotações;
- `app.js`
- `styles.css`
- `api/index.php`
- `schema.sql`
- migrations relacionadas a cotações, pedidos, documentos fiscais, Custo da Obra e realizado;
- `plugins/` — nenhum plugin contém implementação própria de Cotações.

Não existia, antes desta tarefa, spec/plano dedicado ao estado atual de Cotações. Os documentos de benchmark tratam o tema como parte de Compras/Suprimentos. O relatório `2026-fluxo-desejado-vs-atual.md` é anterior às entregas P1/P2/F5.2/F5.3; ele é útil como histórico, mas não representa sozinho o código atual.

### Migrations diretamente relacionadas

- `migrations/2026-06-27-cotacao-importacao.sql`
- `migrations/2026-07-06-cotacao-difpercent.sql`
- `migrations/2026-07-06-cotacao-compra-vencedor.sql`
- `migrations/2026-07-08-cotacao-categorias-tipos.sql`
- `migrations/2026-07-16-cotacao-material.sql`
- `migrations/2026-07-16-cotacao-material-p2.sql`
- `migrations/2026-06-09-purchase-order-items.sql`
- `migrations/2026-07-06-compras-nf-pedido.sql`
- `migrations/2026-06-06-fiscal-documents.sql`
- `migrations/2026-06-09-orcamento-estrutura-completa.sql`
- `migrations/2026-06-09-execucao-orcamento-historico.sql`

## 2. Resposta executiva

### 2.1 O que já está pronto?

- vínculo da cotação/compra com obra;
- seleção de item real do Custo da Obra no comparador F5.2;
- múltiplos fornecedores cadastrados;
- vencedor por item/material;
- matriz item × fornecedor lado a lado;
- preço unitário, quantidade, total, marca e prazo de entrega básicos;
- comparação contra `orcamento_obra_itens.unitCost`, sem BDI;
- consolidação dos vencedores por fornecedor;
- conta a pagar, inclusive com referência anti-dupla-contagem no caminho do pedido;
- download autenticado do arquivo da cotação importada;
- auditoria genérica das mutações;
- categorias usadas como disciplina e tipos de item;
- cadastro rápido de fornecedor na importação;
- CSV/PDF/XLS/XLSX para o fluxo de arquivo, condicionado às dependências do servidor.

### 2.2 O que está muito perto?

- **pedido por fornecedor:** já é gerado com itens e vínculo ao Custo da Obra, mas falta idempotência; repetir a ação pode criar novos pedidos;
- **nota fiscal ligada ao pedido:** já nasce com `projectId`, `supplierId`, `purchaseOrderId` e `payableId`, mas a tela do ciclo correto não envia PDF/XML;
- **alimentação do realizado:** já soma `purchase_order_items.quantidade` em `quantidade_realizada` e grava log, mas o recebimento é total e está acoplado ao registro da NF.

### 2.3 O que está parcialmente implementado?

- disciplina só existe no fluxo “Cotações por material”, não no fluxo canônico ligado ao item do Custo da Obra;
- mínimo configurável de propostas só é aplicado no fluxo por material; a matriz do Custo da Obra permite vencedor com um único fornecedor;
- desconto e condição de pagamento existem no pedido, mas não na proposta do fornecedor e não são propagados;
- validade existe na importação de arquivo, mas não nas propostas dos fluxos de compra;
- marca existe; modelo não;
- anexo existe no cabeçalho importado, mas não por proposta;
- histórico e auditoria existem de forma genérica, sem snapshot da decisão;
- recebimento existe apenas como recebimento integral disparado junto com a NF;
- formação de preço existe, mas está dividida entre o CRUD antigo `quotes` e a importação;
- o fluxo de compra principal está funcional no esqueleto, porém compete com o fluxo por material que gera conta a pagar diretamente.

### 2.4 O que ainda está longe?

- seleção de um fornecedor vencedor para o pacote inteiro. Há agrupamento posterior por fornecedor, mas não existe modo de decisão “pacote único”.

### 2.5 O que não existe?

- etapa vinculada à cotação;
- frete por proposta;
- impostos por proposta;
- exceção formal para menos de três propostas, com justificativa e aprovação.

### 2.6 O que está duplicado ou mal posicionado?

Há três experiências com o mesmo conceito:

1. `quotes`, no menu **Custo da Obra → Cotações**: CRUD antigo sobre `cotacoes`, capaz de enviar um item ao orçamento;
2. `cotacoes`, no menu **Obras/Projetos → Cotações**: abas “Cotações por material”, “Resultado das cotações” e “Importação de arquivos”;
3. botão **Cotações de compra** dentro do Custo da Obra: matriz item × fornecedor e ciclo correto até pedido.

Além disso, existem dois caminhos pós-obra:

- `Cotações por material → Resultado` gera **conta a pagar diretamente**, sem pedido;
- `Custo da Obra → Cotações de compra` gera **pedido por fornecedor**, depois conta/NF/realizado.

O segundo é o caminho arquiteturalmente correto para compra. O primeiro deve ser convergido para ele, não ampliado em paralelo.

### 2.7 Maior risco técnico atual

O maior risco é **duplicação financeira e perda de rastreabilidade por falta de idempotência e por coexistência de dois ciclos de compra**.

Evidências:

- `compraGerarPedido` não filtra vencedores já transformados em pedido e não possui chave de idempotência; a mesma ação pode gerar novos pedidos;
- `compraRegistrar` reaproveita o cabeçalho mais recente de `cotacao_fornecedor` por obra+fornecedor, mesmo se ele veio de arquivo, já está aprovado ou já aponta para outro pedido;
- `cotacao_fornecedor.purchase_order_id` aceita apenas um pedido e pode ser sobrescrito;
- o fluxo por material cria `accounts_payable` diretamente, enquanto o fluxo F5.3 cria a conta via `PEDIDO_COMPRA`;
- uma cotação por material com `conta_pagar_id` pode ser reaberta ou excluída; a conta/NF permanece e perde seu contexto de decisão;
- a tela usa `asMoney()` diretamente em componentes customizados, sem `moneySpan()`/`money-blur`; portanto os valores de Cotações e Compras não respeitam integralmente o modo privacidade v1.36.0.

### 2.8 Melhor próximo passo

Antes de adicionar campos, consolidar o caminho canônico:

1. declarar **Custo da Obra → Cotações de compra → Pedido → NF/Conta → Recebimento → Realizado** como fluxo oficial de compra;
2. impedir geração duplicada de pedido;
3. impedir reabertura/exclusão de decisões já ligadas a pedido/conta/NF;
4. aplicar a regra mínima e a exceção justificada no fluxo canônico;
5. proteger todos os valores monetários pelo modo privacidade;
6. renomear/separar claramente a cotação de formação de preço.

## 3. Mapa dos fluxos atuais

### 3.1 Fluxo A — formação de preço

**Situação:** parcialmente separado, parcialmente duplicado.

#### A1. CRUD antigo `quotes`

- navegação: **Custo da Obra → Cotações**;
- frontend: `moduleConfigs.quotes` em `app.js`;
- tabela: `cotacoes` com `categoriaId IS NULL`;
- fornecedor por `supplierId`;
- permite descrição, unidade, quantidade, valor, datas, anexo como caminho textual, obra e orçamento;
- o botão genérico “Adicionar” chama `addBudgetItemFromSource("quotes")`;
- cria `orcamento_obra_itens.origin = 'Cotação manual'`;
- aplica o BDI do orçamento ao criar preço de venda;
- não gera pedido de compra.

É a única ponte direta “cotação avulsa → formação de preço”, mas não oferece comparação lado a lado.

#### A2. Importação de arquivos

- navegação: **Obras/Projetos → Cotações → Importação de arquivos**;
- tabelas: `cotacao_fornecedor` + `cotacao_itens`;
- aceita fornecedor cadastrado, obra opcional, data, validade e arquivo;
- compara itens importados por similaridade de descrição contra `unitCost`;
- exporta CSV, imprime e permite download do original;
- não possui botão para enviar os itens ao orçamento;
- não gera pedido diretamente pela interface.

Este fluxo pode apoiar formação de preço, mas depende de já existir Custo da Obra para comparar e termina em um beco para inclusão no orçamento.

### 3.2 Fluxo B — compra da obra

**Situação:** duplicado.

#### B1. Cotações por material

- obra obrigatória;
- disciplina obrigatória via `cotacao_categorias`;
- tipo de item opcional;
- material livre, unidade e quantidade;
- N propostas com fornecedor cadastrado;
- mínimo configurável de fornecedores distintos;
- vencedor por material;
- consolidação por fornecedor;
- gera conta a pagar diretamente;
- permite criar/vincular NF à conta.

Não vincula item do Custo da Obra, etapa ou pedido; não alimenta o realizado.

#### B2. Cotações de compra dentro do Custo da Obra

- parte de `orcamentos_obras`;
- cada proposta é vinculada diretamente a `orcamento_obra_itens.id`;
- matriz item × fornecedor;
- compara `valor_unitario` contra `unitCost`;
- escolhe vencedor por item;
- agrupa vencedores por fornecedor;
- cria um `purchase_orders` por fornecedor;
- cria `purchase_order_items.work_budget_item_id`;
- ao registrar compra, cria/recupera conta a pagar, cria NF, marca pedido como Recebido e soma realizado.

Este é o caminho que mais se aproxima do fluxo desejado e deve ser o núcleo da evolução.

## 4. Frontend

### 4.1 Navegação e rótulos

| Chave | Navegação | Rótulo |
|---|---|---|
| `cotacoes` | Obras/Projetos | Cotações |
| `quotes` | Custo da Obra | Cotações |
| `purchaseOrders` | Custo da Obra | Pedidos de compra |
| `compras` | Custo da Obra | Compras da Obra |

Dois itens laterais têm exatamente o rótulo “Cotações”. A matriz de compra não é um módulo lateral próprio: ela abre pelo botão “Cotações de compra” da tela `renderWorkBudgets`.

### 4.2 O que o usuário consegue fazer hoje

- listar e filtrar cotações por material por obra, disciplina e status;
- cadastrar disciplina/categoria e tipo de item;
- criar material de cotação com obra, disciplina, tipo, unidade, quantidade e observação;
- adicionar, editar e excluir propostas de fornecedores cadastrados;
- comparar cartões de propostas, menor valor e diferença R$/%;
- concluir escolhendo vencedor, reabrir, cancelar ou excluir;
- ver resultado por obra agrupado por fornecedor;
- gerar conta a pagar direta por fornecedor e vincular NF;
- importar arquivo de fornecedor, revisar itens, comparar ao orçamento, exportar, imprimir e baixar original;
- abrir um Custo da Obra, registrar cotações item a item, visualizar matriz, escolher vencedores e gerar pedidos;
- registrar compra+NF e visualizar pedido, conta e NF na aba Compras da Obra;
- usar o CRUD antigo para mandar uma cotação avulsa à formação de preço.

### 4.3 Campos e funções apenas parciais

- “Disciplina” é `cotacao_categorias`, não vínculo com etapa/EAP do orçamento;
- “tipo de item” não possui atributos de especificação; a própria UI avisa que A2 está pendente;
- `purchase_orders.condicoes_pagamento` e `desconto` existem, mas não aparecem na proposta de fornecedor da matriz;
- `validade_cotacao` existe no cabeçalho importado, mas não no cadastro manual da compra;
- a matriz mostra ausência de proposta como “—”, mas não gera alerta/contagem;
- divergência de unidade/especificação não pode ser calculada porque a proposta manual herda descrição/unidade do item;
- o “recebimento” não possui tela própria nem quantidade parcial.

### 4.4 Botões e fluxos de risco

- **Gerar pedido de compra (vencedores):** fluxo existe, mas pode ser repetido;
- **Registrar compra + NF:** cria NF sem upload e trata o pedido inteiro como recebido;
- **Reabrir cotação:** não verifica `conta_pagar_id`;
- **Excluir cotação de material:** pode deixar conta/NF financeiramente existentes sem o contexto original;
- **Gerar conta a pagar:** pertence ao caminho B1, que contorna o pedido;
- **Adicionar proposta:** permite mais de uma proposta do mesmo fornecedor para o mesmo material; o mínimo conta distintos, mas não há restrição de unicidade;
- **Importação:** o backend ainda aceita `purchase_order_id`, embora a UI tenha removido esse campo.

### 4.5 Modo privacidade

O modo privacidade não está completo em Cotações.

Os componentes customizados entre `renderCotacaoMaterialLista`, `renderCotacaoResultado`, `paintCompraMatriz`, `renderCompras` e os dialogs usam `asMoney()` diretamente. Não envolvem os valores com `moneySpan()`/`money-blur`, e o CSS do modo privacidade só borra `.money-blur` e inputs monetários formatados.

Ficam potencialmente visíveis no modo privacidade:

- menor proposta;
- valor unitário e total dos cartões;
- diferenças em reais;
- subtotais e total geral;
- valor da conta;
- valores de NF;
- custo orçado e propostas na matriz;
- total do pedido;
- valores em opções, dialogs, toasts e impressão do comparativo.

Percentuais e quantidades devem continuar visíveis; somente os valores em reais precisam ser protegidos.

### 4.6 Responsividade

- tabelas usam `.table-wrap { overflow:auto }`, portanto não quebram a página, mas exigem rolagem horizontal;
- a matriz possui `min-width` por fornecedor e cresce indefinidamente; com três ou mais fornecedores, mobile vira uma tabela larga;
- cartões de proposta usam grid responsivo `minmax(230px, 1fr)` e são adequados;
- abas usam `flex-wrap`;
- não há versão em cards da matriz no mobile;
- dialogs usam componentes compartilhados e parecem adaptáveis, mas isso requer teste visual.

## 5. Backend — actions encontradas

Todas passam por `?module=cotacoes&action=...` e o backend autoriza usando o módulo **`purchaseOrders`**, não `cotacoes`. O envelope próprio é:

```json
{"success": true, "data": {}, "message": ""}
```

Há **29 actions canônicas** e dois aliases adicionais de importação (`importarExcel`, `importarPdf`). O frontend atual consome todas as canônicas, exceto `delete` do fluxo importado; consome `importar`, não os aliases.

| Action | Método | Finalidade / tabelas | Campos principais e resposta | Validações / integrações / riscos |
|---|---|---|---|---|
| `list` | GET | Lista `cotacao_fornecedor` com contagem em `cotacao_itens` | filtros `obra_id`, `purchase_order_id`, `status`; retorna array | Consumida pela aba arquivos |
| `get` | GET | Cabeçalho + itens importados | `id`; retorna objeto completo | Consumida |
| `importar` | POST multipart | Salva arquivo, cabeçalho e itens parseados | arquivo, `fornecedor_nome`; opcionais obra, fornecedor FK, datas | 20 MB; extensões controladas; audita; falta transação entre cabeçalho/itens |
| `importarExcel` / `importarPdf` | POST | Aliases de `importar` | mesmos campos | Não consumidos pelo frontend atual |
| `salvarItens` | POST | Substitui todos os itens de uma cotação importada | `cotacao_id`, `itens[]`; retorna cotação | DELETE+INSERT sem transação; consumida |
| `comparar` | POST | Similaridade contra `orcamento_obra_itens.unitCost` | cotação e obra; retorna itens/classificação/score | threshold 0,4; clamp; não valida unidade/especificação |
| `exportarCsv` | GET | Exporta comparativo | `id`; stream CSV | Consumida; valor previsto é `unitCost` |
| `anexo` | GET | Download autenticado do original | `id`; stream | path traversal protegido; consumida |
| `delete` | DELETE/POST | Exclui cotação importada, itens e arquivo | `id`; resposta vazia | Não há botão no frontend atual; exclusão de arquivo usa caminho salvo |
| `compraMatriz` | GET | Matriz do orçamento | `workBudgetId`; retorna itens e cotações | Consumida; sem mínimo de propostas |
| `compraRegistrar` | POST | Cria proposta para item do Custo | item, fornecedor, preço, qtd, marca, prazo | Reusa cabeçalho mais recente obra+fornecedor; permite duplicata; audita |
| `compraVencedor` | POST | Marca/desmarca vencedor por item | `cotacao_item_id`, `vencedor` | Desmarca todos do item; não exige N propostas; consumida |
| `compraGerarPedido` | POST | Agrupa vencedores e cria pedido por fornecedor | `workBudgetId`; retorna `pedidos[]` | Transacional; cria itens vinculados; **não idempotente**; não leva condições |
| `comprasRegistrar` | POST | Conta + NF + recebimento + realizado | pedido, NF, data, valor, tipo | Transacional; NF sem arquivo; recebimento total; permite NFs adicionais |
| `materialList` | GET | Lista `cotacoes` com `categoriaId` | filtros obra, categoria, status | Retorna mínimo vigente; consumida |
| `materialGet` | GET | Cabeçalho material + propostas | `id` | Consumida |
| `materialSalvar` | POST | Cria/edita cotação por material | obra, categoria, tipo, descrição, unidade, qtd, notas | Só edita aberta; não liga item/etapa do Custo |
| `materialExcluir` | POST/DELETE | Apaga cabeçalho e propostas | `id` | Transacional; não bloqueia conta/NF já gerada |
| `propostaSalvar` | POST | Cria/edita proposta manual | material, fornecedor, preço, marca, prazo, obs. | Só aberta; recalcula diferença vs menor; sem unicidade fornecedor/material |
| `propostaExcluir` | POST | Exclui proposta | `id` | Só aberta; recalcula diferenças |
| `materialConcluir` | POST | Escolhe vencedor e conclui | material e proposta | Exige N fornecedores distintos; audita |
| `materialReabrir` | POST | Reabre e limpa vencedor | material | Não bloqueia se já há conta/NF |
| `materialCancelar` | POST | Cancela cotação aberta | material | Após reabertura pode cancelar mesmo com vínculos financeiros |
| `materialConsolidado` | GET | Vencedores por obra | `projectId`; retorna linhas | Consumida; GET pode limpar vínculo de conta órfão sem auditoria |
| `materialGerarConta` | POST | Uma conta direta por fornecedor | obra, fornecedor, categoria, vencimento | Transacional e anti-corrida; contorna pedido |
| `listCategorias` | GET | Categorias com tipos aninhados | sem campos | Consumida |
| `categoriaSalvar` | POST | Cria/edita/inativa categoria | id, nome, ordem, status | Duplicata por nome; audita |
| `tipoSalvar` | POST | Cria/edita/inativa tipo | categoria, nome, unidade, ordem, status | FK real só categoria→tipo |
| `categoriaOrdenar` | POST | Reordena categorias | `ids[]` | Transacional; não valida que todos os ids existam |
| `tipoOrdenar` | POST | Reordena tipos da categoria | categoria, `ids[]` | Transacional |

### 5.1 Permissões

- a rota inteira usa `authorize_request(..., 'purchaseOrders', module_request_action(...))`;
- a UI decide visibilidade/edição por `cotacoes` em várias telas e por `purchaseOrders` em Compras;
- customizações de RBAC em `cotacoes` não necessariamente controlam o backend;
- `module_request_action` classifica pelo início da action. `materialExcluir`, `propostaExcluir` e `materialCancelar` não começam com `excluir`/`cancel`; como são POST, tendem a exigir `create`, não `delete`;
- updates como `materialSalvar`, `propostaSalvar`, `compraVencedor`, `categoriaSalvar` também caem em `create`, não `edit`.

Isso precisa ser corrigido antes de considerar o módulo seguro para perfis customizados.

## 6. Banco — mapa das tabelas reais

| Tabela | Função e PK | Obra | Fornecedor/material/orçamento | Pedido/financeiro/fiscal | Uso atual |
|---|---|---|---|---|---|
| `projects` | obra; PK `id` | própria | — | referenciada pelos módulos | ativo |
| `suppliers` | fornecedor; PK `id` | indireto | `supplierId`/`fornecedor_id` | pedido, AP, NF | ativo |
| `cotacoes` | cotação avulsa ou cabeçalho por material; PK `id` | `projectId` | `supplierId`, `workBudgetId`, `categoriaId`, `tipoItemId` | `conta_pagar_id` | ativo em dois fluxos |
| `cotacao_fornecedor` | cabeçalho de arquivo/compra por fornecedor; PK `id` | `obra_id` | `fornecedor_id`, nome snapshot | `purchase_order_id` | ativo |
| `cotacao_itens` | item importado, item de compra ou proposta manual; PK `id` | indireto | `cotacao_id`, `material_cotacao_id`, `fornecedor_id`, `orcamento_item_id` | vencedor | ativo em três papéis |
| `cotacao_categorias` | disciplina manual; PK `id` | não | pai de tipos | não | ativo; ausente do `schema.sql` base |
| `cotacao_tipos_item` | tipo por disciplina; PK `id` | não | `categoriaId` | não | ativo; ausente do `schema.sql` base |
| `orcamentos_obras` | Custo da Obra; PK `id` | `projectId` | — | origem da compra | ativo |
| `orcamento_obra_itens` | item previsto; PK `id` | `projectId` | `workBudgetId`, `etapa_id`, custos | `quantidade_realizada` | ativo |
| `orcamento_etapas` | etapa/EAP; PK `id` | `obra_id` | `orcamento_id` | não | ativo, não ligado à cotação |
| `purchase_orders` | pedido; PK `id` | `projectId` | `supplierId` | origem da AP/NF | ativo |
| `purchase_order_items` | itens do pedido; PK `id` | indireto | `work_budget_item_id` | pertence ao pedido | ativo |
| `accounts_payable` | conta a pagar; PK `id` | `projectId` | `supplierId` | `referencia_tipo/id` | ativo |
| `fiscal_documents` | NF/documento; PK `id` | `projectId` | `supplierId` | `purchaseOrderId`, `payableId` | ativo |
| `orcamento_item_execucao_log` | histórico do realizado; PK `id` | indireto | `item_id` | origem `pedido_compra` | ativo |
| `audit_log` | auditoria genérica; PK `id` | indireto | módulo/registro/texto | usuário/IP/data | ativo |
| `eventos_automacao` | log de automações | indireto | entidade de origem/destino | pedido→AP/realizado | ativo |
| `system_preferences` | preferências; PK `id` | não | `minCotacoesPorMaterial` | não | ativo |
| `financial_categories` | categoria da conta | não | selecionada na conta direta | AP | ativo |
| `qualidade_fvm` | recebimento/inspeção PBQP-H | `projectId` | material/fornecedor textual | `purchaseOrderId`, NF | existente, não integrado ao fluxo de Cotações |

### 6.1 FKs e relacionamentos

FKs efetivamente declaradas:

- `cotacoes.supplierId → suppliers`;
- `cotacoes.projectId → projects`;
- `cotacoes.workBudgetId → orcamentos_obras`;
- `cotacao_tipos_item.categoriaId → cotacao_categorias ON DELETE CASCADE`;
- FKs usuais de `purchase_orders`, `accounts_payable`, `fiscal_documents` e `orcamento_obra_itens`.

Relacionamentos relevantes sem FK:

- `cotacoes.categoriaId`;
- `cotacoes.tipoItemId`;
- `cotacoes.conta_pagar_id`;
- `cotacao_fornecedor.obra_id`;
- `cotacao_fornecedor.fornecedor_id`;
- `cotacao_fornecedor.purchase_order_id`;
- `cotacao_itens.cotacao_id`;
- `cotacao_itens.material_cotacao_id`;
- `cotacao_itens.fornecedor_id`;
- `cotacao_itens.orcamento_item_id`;
- `purchase_order_items.purchase_order_id`;
- `purchase_order_items.work_budget_item_id`;
- `fiscal_documents.purchaseOrderId`;
- `orcamento_etapas.orcamento_id/obra_id`;
- `orcamento_item_execucao_log.item_id`.

### 6.2 Inconsistências de schema e uso

1. `schema.sql` afirma conter todas as tabelas atuais, mas não cria `cotacao_categorias` nem `cotacao_tipos_item`; elas dependem de migration/`ensure_*`.
2. `cotacao_itens` representa três entidades diferentes:
   - item de arquivo importado;
   - proposta manual por material;
   - proposta de compra vinculada ao orçamento.
3. `cotacoes` representa cotação avulsa e cabeçalho por material, distinguido apenas por `categoriaId IS NOT NULL`.
4. Não existe coluna explícita de finalidade (`formacao_preco` × `compra_obra`).
5. Não existe snapshot estruturado de descrição, unidade e especificação aprovada.
6. `fornecedor_nome` é um snapshot útil; deve ser preservado mesmo com FK.
7. `marca`, `prazo_entrega` e `observacao` são snapshots úteis, mas insuficientes.
8. `cotacao_fornecedor.observacoes` não é preenchida pelos formulários atuais.
9. `cotacao_fornecedor.status='reprovada'` existe, mas não foi encontrado fluxo de reprovação.
10. `cotacoes` possui campos legados (`unitValue`, `totalValue`, `validityDate`, `attachmentPath`, `workBudgetId`) que não são preenchidos pelo fluxo por material.
11. `purchase_orders.condicoes_pagamento` e `desconto` não são preenchidos por `compraGerarPedido`.
12. `fiscal_documents.purchaseOrderId` existe sem FK nem índice específico.
13. O vínculo de uma cotação importada a um único `purchase_order_id` é insuficiente quando um mesmo cabeçalho passa a conter itens de orçamentos/pedidos diferentes.

## 7. Comparativo obrigatório

| Funcionalidade desejada | Situação atual | Classificação | Evidência no código | O que falta | Esforço estimado |
|---|---|---|---|---|---|
| Cotação vinculada à obra | `projectId`/`obra_id`; obrigatório nos fluxos manuais de compra | **PRONTO** | `materialSalvar`, `compraRegistrar`, schema | Tornar obrigatório também onde a finalidade for compra | pequeno |
| Disciplina | Categoria funciona como disciplina só no fluxo por material | **PARCIAL** | `cotacoes.categoriaId`, `renderCotacaoMaterial*` | Levar disciplina ao fluxo item do Custo e definir fonte canônica | médio |
| Etapa | Etapas existem no orçamento, sem vínculo na cotação | **INEXISTENTE** | `orcamento_etapas`, `orcamento_obra_itens.etapa_id` | Derivar/snapshot da etapa no cabeçalho/itens | médio |
| Material | Item real do Custo pode ser selecionado; fluxo por material aceita texto livre | **PRONTO** | `compraRegistrar.orcamento_item_id` | Convergir o fluxo livre para item real quando pós-obra | pequeno |
| Vários fornecedores | Matriz e propostas suportam N fornecedores | **PRONTO** | `cotacao_itens.fornecedor_id`, matriz | Restringir duplicatas do mesmo fornecedor/item | pequeno |
| Mínimo configurável de propostas | Só em `materialConcluir`; matriz ignora | **PARCIAL** | `minCotacoesPorMaterial` | Aplicar no caminho canônico + exceção | médio |
| Vencedor por material | Um vencedor por item/material | **PRONTO** | `vencedor`, `compraVencedor`, `materialConcluir` | Proteger decisão já convertida em pedido/conta | pequeno |
| Vencedor único do pacote | Só há agrupamento posterior | **LONGE** | `compraGerarPedido` agrupa vencedores | Criar modo pacote e regra de decisão | médio |
| Mapa lado a lado | Matriz item × fornecedores existe | **PRONTO** | `paintCompraMatriz` | Alertas de ausência/unidade/especificação | pequeno |
| Preço unitário | Campo e cálculos existem | **PRONTO** | `valor_unitario` | Snapshot monetário/precisão e moeda, se necessário | pequeno |
| Frete | Nenhum campo/cálculo | **INEXISTENTE** | ausência no schema/form | Campo por proposta/pacote e rateio | médio |
| Desconto | Só existe no pedido | **PARCIAL** | `purchase_orders.desconto` | Capturar na proposta e levar ao pedido/comparativo | médio |
| Impostos | Nenhum campo por proposta | **INEXISTENTE** | ausência | Campos/regra de composição do total | médio |
| Condição de pagamento | Só existe no pedido e não é propagada | **PARCIAL** | `condicoes_pagamento` | Capturar por proposta e usar no pedido/AP | médio |
| Prazo de entrega | Texto por item/proposta | **PRONTO** | `prazo_entrega` | Estruturar em data/dias e consolidar por fornecedor | pequeno |
| Validade | Só no cabeçalho importado | **PARCIAL** | `validade_cotacao` | Levar às propostas manuais e alertas | pequeno |
| Marca/modelo | Marca existe; modelo não | **PARCIAL** | `cotacao_itens.marca` | Campo modelo e divergência de especificação | pequeno |
| Anexos | Original importado é baixável; não há anexo por proposta | **PARCIAL** | `arquivo_original`, action `anexo` | Anexo por fornecedor/proposta e upload no ciclo do pedido | médio |
| Justificativa com menos de 3 | P1 bloqueia; F5.2 permite sem justificar | **INEXISTENTE** | `materialConcluir`, ausência na matriz | Exceção, motivo, aprovador e auditoria | médio |
| Histórico | Há logs genéricos, sem histórico de estados/decisão | **PARCIAL** | `audit_log`, `eventos_automacao` | Tabela de histórico/snapshots | médio |
| Auditoria | `server_audit` cobre mutações principais | **PARCIAL** | chamadas em actions | Antes/depois, motivo, vínculo imutável e leituras críticas | médio |
| Consolidado por fornecedor | Existe nos dois fluxos | **PRONTO** | `materialConsolidado`, `compraGerarPedido` | Manter apenas no fluxo canônico | pequeno |
| Pedido por fornecedor | Implementado, mas repetível | **MUITO PERTO** | `compraGerarPedido` | Idempotência, condições, datas e bloqueios | médio |
| Conta a pagar | Existe direta e via pedido | **PRONTO** | `materialGerarConta`, `automate_approved_purchase_order` | Remover o atalho direto no fluxo de compra | pequeno |
| Nota fiscal | Existe vinculada à obra/pedido/conta | **MUITO PERTO** | `comprasRegistrar`, `fiscal_documents` | PDF/XML no caminho canônico, duplicidade e conferência | médio |
| Recebimento | NF marca pedido inteiro como recebido | **PARCIAL** | `automate_received_purchase_order` | Recebimento separado e parcial por item | grande |
| Alimentação do realizado | Quantidade do pedido soma no item e gera log | **MUITO PERTO** | `quantidade_realizada`, log | Alimentar só o efetivamente recebido e tratar estorno | médio |
| Comparação com Custo da Obra | Usa vínculo direto e `unitCost` sem BDI | **PRONTO** | `compraMatriz`, `comparar` | Alertas de unidade/especificação e custo snapshot | pequeno |
| Cotação de formação de preço | CRUD antigo alimenta orçamento; importação compara, mas os dois não se unem | **PARCIAL** | `quotes`, `addBudgetItemFromSource`, importação | Uma UX própria, sem pedido, com comparação preliminar | médio |
| Cotação de compra | Duas implementações pós-obra com saídas diferentes | **DUPLICADO/REDUNDANTE** | material→AP e matriz→pedido | Escolher matriz/pedido como canônico e migrar/harmonizar o outro | grande |

### Contagem

- **PRONTO:** 10
- **MUITO PERTO:** 3
- **PARCIAL:** 11
- **LONGE:** 1
- **INEXISTENTE:** 4
- **DUPLICADO/REDUNDANTE:** 1
- **Total avaliado:** 30

## 8. Plano recomendado em fases pequenas

### Fase 1 — estabilizar o fluxo existente e escolher o canônico

**Objetivo:** declarar a matriz do Custo da Obra como origem oficial da compra e eliminar riscos imediatos.

- arquivos prováveis: `app.js`, `api/index.php`, `styles.css`, documentação;
- tabelas reutilizadas: todas as atuais;
- migration: não obrigatória para os primeiros bloqueios; recomendável para idempotência forte;
- riscos: compatibilidade com cotações antigas já ligadas a conta direta;
- dependências: levantamento dos dados reais no servidor;
- teste manual:
  1. gerar pedido uma vez;
  2. tentar gerar novamente;
  3. tentar reabrir/excluir cotação ligada;
  4. testar perfis com permissões customizadas;
  5. ativar privacidade em todas as telas;
- aceite: nenhum pedido/conta duplicado; decisões convertidas ficam protegidas; R$ ocultos no modo privacidade.

### Fase 2 — unificar finalidade, cabeçalho e vínculos

**Objetivo:** separar explicitamente `formacao_preco` e `compra_obra`, mantendo uma porta de entrada clara para cada finalidade.

- arquivos prováveis: `app.js`, `api/index.php`, `schema.sql`, nova migration;
- tabelas reutilizadas: `cotacoes`, `cotacao_fornecedor`, `cotacao_itens`, `orcamentos_obras`, `orcamento_obra_itens`;
- migration: sim, para finalidade, responsável, prazo de resposta e vínculos canônicos;
- riscos: coexistência de registros legados e discriminadores nulos;
- dependências: decisão de produto sobre qual tela permanece;
- teste manual: criar uma cotação pré-obra e uma pós-obra e comprovar que somente a segunda oferece pedido;
- aceite: finalidade explícita, navegação sem dois “Cotações” indistintos, nenhuma compra sem obra/item.

### Fase 3 — completar proposta e mapa comparativo

**Objetivo:** capturar todos os termos comerciais e alertas.

- arquivos prováveis: `app.js`, `styles.css`, `api/index.php`, `schema.sql`, migration;
- tabelas reutilizadas: cabeçalho/propostas atuais;
- migration: sim, para frete, desconto, impostos, condição, validade, modelo, anexo e snapshots;
- riscos: rateio de frete/desconto/imposto entre itens;
- dependências: Fase 2;
- teste manual: três fornecedores, um sem item, um com unidade divergente, um acima do previsto;
- aceite: total conferível por proposta, alerta de ausência/unidade/especificação e anexos baixáveis.

### Fase 4 — governança da decisão

**Objetivo:** mínimo configurável, exceção justificada, vencedor por item ou pacote e histórico imutável.

- arquivos prováveis: `app.js`, `api/index.php`, migration;
- tabelas reutilizadas: `system_preferences`, `audit_log`;
- migration: sim, para decisão/histórico/exceção;
- riscos: mudança de vencedor após aprovação;
- dependências: Fase 3;
- teste manual: concluir com 3; bloquear com 2; concluir com 2 somente com justificativa e permissão; pacote único;
- aceite: toda exceção e troca de vencedor ficam auditáveis.

### Fase 5 — pedido por fornecedor robusto

**Objetivo:** tornar geração idempotente e levar condições comerciais.

- arquivos prováveis: `api/index.php`, `app.js`, migration;
- tabelas reutilizadas: `purchase_orders`, `purchase_order_items`;
- migration: sim, para chave de origem/idempotência e, se necessário, snapshot da decisão;
- riscos: pedidos históricos e geração concorrente;
- dependências: Fase 4;
- teste manual: clique duplo, duas sessões simultâneas, novos itens após pedido anterior, um pedido por fornecedor;
- aceite: a mesma decisão nunca cria dois pedidos; condições e totais batem com a cotação.

### Fase 6 — conta, NF, recebimento e realizado

**Objetivo:** separar emissão fiscal de recebimento físico e suportar parcial/estorno.

- arquivos prováveis: `app.js`, `api/index.php`, migration;
- tabelas reutilizadas: `accounts_payable`, `fiscal_documents`, `purchase_orders`, `purchase_order_items`, `orcamento_item_execucao_log`, possivelmente `qualidade_fvm`;
- migration: sim, para recebimentos por item/lote;
- riscos: dupla soma do realizado e divergência NF×pedido;
- dependências: Fase 5;
- teste manual: NF parcial, duas entregas, estorno, quantidade maior/menor, FVM;
- aceite: realizado reflete recebido, não apenas faturado; estorno é auditável; AP não duplica.

### Fase 7 — importação padronizada e apoio por IA

**Objetivo:** usar arquivo/IA para preencher propostas sem inventar dados e sem criar um quarto fluxo.

- arquivos prováveis: `app.js`, `api/index.php`, serviços IA existentes;
- tabelas reutilizadas: modelo canônico das Fases 2–3;
- migration: talvez não, se o modelo já estiver completo;
- riscos: correspondência incorreta e confiança excessiva;
- dependências: modelo canônico e alertas de divergência;
- teste manual: PDF/Excel de três fornecedores, itens faltantes, unidade diferente e baixa confiança;
- aceite: importação gera rascunho revisável no mesmo fluxo manual, com origem/confiança e sem pedido automático.

## 9. Roteiro de validação no servidor

1. Confirmar migrations aplicadas e existência das colunas/tabelas descritas.
2. Conferir registros com `categoriaId IS NULL` e `IS NOT NULL`.
3. Identificar cabeçalhos `cotacao_fornecedor` com itens de mais de um orçamento ou `purchase_order_id` já preenchido.
4. Testar como admin e como gestor de obra com permissões customizadas.
5. Criar Custo da Obra com três itens e três fornecedores.
6. Registrar cotações em todos os itens e conferir menor preço/diferença contra `unitCost`.
7. Marcar vencedores diferentes por item.
8. Gerar pedidos e conferir um por fornecedor.
9. Repetir a geração para comprovar o risco atual de duplicidade — somente em ambiente de teste.
10. Registrar NF e conferir:
    - pedido Recebido;
    - AP com `referencia_tipo='PEDIDO_COMPRA'`;
    - NF com `purchaseOrderId`/`payableId`;
    - `quantidade_realizada`;
    - `orcamento_item_execucao_log`;
    - `audit_log`/`eventos_automacao`.
11. Testar o fluxo por material e comparar o resultado financeiro com o fluxo por pedido.
12. Ativar modo privacidade e percorrer lista, cartões, resultado, matriz, Compras, dialogs e toasts.
13. Testar mobile com três e cinco fornecedores.
14. Testar anexo importado e dependências XLSX/PDF.

## 10. Conclusão

O ObraSync não precisa começar Cotações do zero. O núcleo correto já existe dentro do Custo da Obra. A prioridade é **convergência e integridade**, não mais uma camada de UI:

1. estabilizar idempotência e vínculos;
2. aplicar privacidade e RBAC corretamente;
3. unificar os dois fluxos de compra;
4. completar os termos comerciais e governança;
5. só então evoluir recebimento parcial e IA.

