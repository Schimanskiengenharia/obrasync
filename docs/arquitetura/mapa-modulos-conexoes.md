# ObraSync — Mapa de Módulos e Conexões (04/07/2026)

Levantamento do que existe e como as peças se ligam. Serve de bússola para decidir o que
construir/conectar em vez de abrir frentes soltas.

## Eixo central — JÁ CONECTADO (funciona de ponta a ponta)
SINAPI (base de preços) → Comparador IA (planilha vs SINAPI) → Orçamento de obra
(orcamentos_obras + orcamento_obra_itens + orcamento_etapas) → Proposta (commercial_proposals)
→ Contrato (sales_contracts) → Financeiro (accounts_payable/receivable).
O Cronograma simples (projectSchedule: obra_cronograma_etapas/marcos, project_schedule,
tipos_medicao) pendura no orçamento.
Vínculos reais no código: proposta_orcamento_vinculos, sinapi_id/sinapiSnapshotJson nos itens,
sinapiReferenceId, workBudgetId, projectId.

## Pontas soltas — EXISTEM mas NÃO ligadas ao orçamento
- Cotações (tabelas cotacoes, cotacao_fornecedor, cotacao_itens, quotes) — existem, sem ponte
  para o orçamento.
- Comparador de fornecedores (matriz item×fornecedor, menor preço por item e no total) — a
  CONSTRUIR. Marcação manual de correspondência (usuário marca qual item = qual). Excel por
  fornecedor. Categorias (iluminação, tomada) = agrupamento simples.
- Pedido de compra (purchase_orders, purchase_order_items) — existe, falta ligar cotação→pedido.
Ciclo desejado: pedido de cotação (em Obras) → cotações → comparativo por tipo → pedido de compra.

## Base pronta e sólida
- IA local (Ollama llama3.2:3b + all-minilm, 24.943 embeddings, busca semântica + de-para).
- Segurança: 5 graves da revisão corrigidos e testados (G1/M1 autorização, G2 cron, G3
  soft-delete de obras, G4 provisionamento/schema 114 tabelas, timezone M10-12 + fluxo de caixa).
- Financeiro + fluxo de caixa (corrigido: mostra os meses corretos com entradas).

## Duas frentes para escolher (uma por vez, até o fim)
1. EIXO CENTRAL: terminar comparador IA → orçamento (resolver valores zerando ao enviar certas
   planilhas para o orçamento) e depois a Fase B (orçamento filtrável: filtrar por categoria/
   setor/tipo, ver material/MO separado, export Excel só do filtrado). Está ~90% pronto.
2. CICLO DE COMPRAS: ligar cotações → comparador de fornecedores → pedido de compra.

## Pendências técnicas conhecidas (para retomar)
- Comparador SINAPI: bug da fórmula =J93+K93 lida como 9393 — CORRIGIDO no código (commit
  e533bcc, calculateFormulas + material+MO como custo direto). Falta VALIDAR com upload NOVO da
  planilha (os lotes antigos gravados com o bug não se auto-corrigem; "Reanalisar" não relê o
  arquivo — tem que subir de novo).
- Ponte análise→orçamento (B1): cria orçamento + itens, mas ao enviar as planilhas
  Relacao_Tomadas/Relacao_Quadros os itens vieram com unitCost=0 (as planilhas tinham preço) —
  investigar se a leitura não achou a coluna de preço no formato dessas planilhas OU se a ponte
  perdeu o valor no caminho. (Orçamentos 6 e 7, projeto 9, aparecem ao selecionar no dropdown
  "Orçamento" — não é bug de exibição.)
- Médios/pequenos da revisão (16 médios + 22 pequenos) ainda pendentes (2ª passada).

## Visão futura (spec separada)
Cronograma físico-financeiro completo (MS Project) — ver docs/specs/cronograma-fisico-financeiro.md.
Não iniciar antes de fechar os ciclos acima.
