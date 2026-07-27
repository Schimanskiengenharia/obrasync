# Plano — Lucro Gerencial × Caixa Real por período total

**Data:** 2026-07-27
**Spec:** `docs/superpowers/specs/2026-07-27-lucro-caixa-periodo-total.md`

## 1. Preservar e isolar a fórmula

- Manter `lucroCaixaPeriodRange()` e `LUCRO_CAIXA_PERIODS` somente para o
  histórico dos Centros de Custo, que ainda depende deles.
- Substituir o estado específico do painel `lucroCaixaPeriod` por
  `lucroCaixaEvolutionMode = "mensal"`.
- Criar helpers de escopo dimensional próprios do painel; não usar
  `applyFilters()` para datas.
- Preservar as fórmulas de competência e caixa documentadas na spec.

## 2. Resolver o período global

- Ler `getFilters().start`/`.end`.
- Montar o escopo filtrado sem recorte de data.
- Encontrar a primeira data financeira válida.
- Aplicar as quatro regras de início/fim e fallback para escopo vazio.
- Exibir o intervalo formatado no painel e na reconciliação DRE.

## 3. Consolidar indicadores

- Ampliar `lucroCaixaCompute()` com:
  - valores e contagens de abertas a receber/pagar;
  - valores e contagens de vencidas a receber/pagar;
  - entradas e saídas explícitas;
  - lucro, caixa líquido e diferença.
- Garantir que cancelados sejam excluídos e status sejam case-insensitive.
- Manter `Parcial` integralmente aberto e fora do caixa efetivo.

## 4. Evolução mensal/acumulada

- Gerar a lista contígua de meses dentro do intervalo.
- Limitar o primeiro e o último bucket às datas reais do período.
- Calcular cada mês a partir do mesmo escopo já filtrado.
- Na visão acumulada, aplicar soma progressiva às duas séries.
- Manter tooltips combinados e protegidos pelo modo privacidade.

## 5. Interface

- Trocar o seletor antigo de período pelo seletor `Mensal`/`Acumulado`.
- Exibir `Período analisado`.
- Expandir de 3 para 9 cards.
- Usar `money-blur` em todo montante.
- Mostrar quantidades sem blur.
- Ajustar grid responsivo e tons semânticos.
- Atualizar a reconciliação DRE para usar o período global e retirar o seletor
  próprio de período.

## 6. Documentação e versão

- Subir para `v1.37.0`, data `2026-07-27`.
- Adicionar entrada no topo de `APP_CHANGELOG`.
- Incrementar cache busting real de `1800` para `1801`.
- Atualizar `README.md`, `STATUS.md` e `CLAUDE.md`, corrigindo os cabeçalhos de
  versão que ainda apontam para `v1.19.0`.

## 7. Validação

- `php -l api/index.php`.
- `node --check app.js`.
- Verificar diff e ausência de alterações em schema/migrations/API.
- Testar no navegador:
  1. mês único;
  2. três meses;
  3. ano completo;
  4. sem movimento;
  5. só receber;
  6. só pagar;
  7. recebimento parcial (comportamento documentado);
  8. pagamento parcial (comportamento documentado);
  9. canceladas;
  10. obra;
  11. cliente;
  12. mensal;
  13. acumulado;
  14. privacidade.
- Conferir desktop e viewport mobile.
- Registrar limitações que dependam de dados reais/servidor.
