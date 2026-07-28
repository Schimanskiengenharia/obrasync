# Spec de diagnóstico — Cotações de Obras: estado atual e direção recomendada

**Data:** 2026-07-27  
**Tipo:** diagnóstico e especificação de direção; não autoriza implementação  
**Documento detalhado:** `docs/revisao/2026-07-27-varredura-cotacoes-obras.md`

## Objetivo

Registrar a arquitetura real da aba **Obras/Projetos → Cotações**, os limites dos fluxos existentes e as decisões necessárias antes da próxima implementação.

## Estado atual

O produto possui três experiências:

1. **Cotação avulsa para formação de preço**
   - módulo técnico `quotes`;
   - tabela `cotacoes`, normalmente com `categoriaId NULL`;
   - pode virar item de `orcamento_obra_itens` via `addBudgetItemFromSource("quotes")`;
   - não deve gerar compra.

2. **Cotação por material dentro de Obras/Projetos**
   - cabeçalho em `cotacoes`, identificado por `categoriaId IS NOT NULL`;
   - propostas em `cotacao_itens.material_cotacao_id`;
   - exige N fornecedores distintos;
   - escolhe vencedor por material;
   - consolida por fornecedor;
   - gera conta a pagar diretamente e vincula NF;
   - não gera pedido nem alimenta realizado.

3. **Cotação de compra dentro do Custo da Obra**
   - item real em `orcamento_obra_itens`;
   - propostas em `cotacao_itens.orcamento_item_id`;
   - matriz lado a lado;
   - vencedor por item;
   - pedido por fornecedor;
   - conta a pagar por referência `PEDIDO_COMPRA`;
   - NF ligada ao pedido;
   - recebimento integral e realizado.

## Decisão arquitetural recomendada

### Formação de preço

Manter um fluxo explicitamente pré-obra:

```text
Fornecedor/referência preliminar
  → custo sem BDI
  → Custo da Obra/orçamento técnico
  → BDI
  → proposta comercial
```

Regras:

- não oferecer pedido de compra;
- não criar conta a pagar;
- permitir referência preliminar;
- ao enviar ao orçamento, criar snapshot do custo;
- usar rótulo inequívoco, como “Cotações para formação de preço”.

### Compra da obra

Adotar como canônico:

```text
Custo da Obra
  → itens reais
  → fornecedores/propostas
  → mapa comparativo
  → decisão
  → um pedido por fornecedor
  → conta a pagar e nota fiscal
  → recebimento
  → realizado
```

O fluxo “Cotações por material → conta a pagar direta” deve convergir para esse caminho. Não deve continuar como segundo motor financeiro.

## Regras mínimas para a próxima evolução

1. Uma cotação de compra deve ter finalidade explícita e obra obrigatória.
2. Cada item deve apontar para `orcamento_obra_itens.id` ou guardar justificativa para item livre.
3. Disciplina e etapa devem ser derivadas/snapshot do Custo da Obra.
4. Um fornecedor deve ter no máximo uma proposta vigente por item/rodada.
5. O mínimo de propostas deve valer no fluxo canônico.
6. Menos que o mínimo exige justificativa, usuário aprovador e histórico.
7. Deve ser possível decidir por item ou por pacote.
8. Frete, desconto, impostos e condição de pagamento devem participar do total comparável.
9. Pedido deve ser gerado uma única vez por decisão/fornecedor.
10. Condições comerciais devem ser copiadas para o pedido.
11. NF não equivale automaticamente a recebimento físico.
12. Recebimento deve aceitar parcial e alimentar somente a quantidade recebida.
13. Valores em reais devem respeitar o modo privacidade em tela, dialog, toast e tooltip.
14. Exportações e documentos não devem herdar o blur de privacidade.

## Invariantes de integridade

- Não reabrir, excluir ou trocar vencedor depois de pedido/conta/NF sem fluxo explícito de cancelamento/estorno.
- Não criar `accounts_payable` por dois caminhos para a mesma compra.
- Não sobrescrever `cotacao_fornecedor.purchase_order_id` de uma decisão anterior.
- Não reutilizar silenciosamente um cabeçalho importado em outra rodada/orçamento.
- Não recalcular o custo previsto histórico a partir de um registro mutável; preservar snapshot.
- Não somar realizado duas vezes.
- Não criar pedido sem fornecedor cadastrado e obra.

## Lacunas prioritárias

### P0 — integridade e segurança

- idempotência de `compraGerarPedido`;
- bloqueios após conversão financeira;
- convergência do fluxo direto para pedido;
- autorização semântica correta para excluir/cancelar/editar;
- modo privacidade nos componentes customizados;
- proteção contra reaproveitamento indevido de `cotacao_fornecedor`.

### P1 — modelo comercial

- finalidade;
- responsável;
- prazo de resposta;
- etapa;
- frete;
- desconto;
- impostos;
- condição de pagamento;
- validade;
- modelo;
- anexo por proposta;
- snapshots.

### P2 — governança

- exceção justificada;
- aprovador;
- histórico imutável;
- decisão por pacote;
- alertas de ausência/unidade/especificação.

### P3 — execução

- NF com PDF/XML no fluxo do pedido;
- recebimentos parciais;
- estorno;
- integração opcional com FVM/PBQP-H;
- realizado baseado em recebimento.

## Critério para considerar “Cotação de compra” pronta

Uma obra com três itens e três fornecedores deve permitir:

1. registrar todas as propostas e anexos;
2. comparar custo previsto, termos e divergências;
3. concluir com mínimo ou exceção auditada;
4. escolher vencedores por item ou pacote;
5. gerar exatamente um pedido por fornecedor;
6. preservar condições e snapshots;
7. vincular uma ou mais NFs sem duplicar AP;
8. receber parcial ou totalmente;
9. alimentar realizado somente pelo recebido;
10. reconstruir toda a decisão pelo histórico;
11. ocultar todos os valores monetários quando a privacidade estiver ativa.

## Fora de escopo desta spec

- implementação;
- alteração de schema;
- migração de dados históricos;
- alteração de fórmulas financeiras;
- escolha definitiva de nomes de menu;
- automação por IA antes da consolidação do modelo.

