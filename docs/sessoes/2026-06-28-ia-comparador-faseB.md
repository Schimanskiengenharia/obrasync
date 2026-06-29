# ObraSync — Anotações da Sessão (28/06/2026)
## IA Semântica · Comparador de Orçamento · Fase B (Análise → Orçamento)

### PENDENTE CRÍTICO Nº1 — Leitura de valor no comparador (corrigir PRIMEIRO ao retomar)
O comparador lê o valor unitário ERRADO da planilha. Gravou valores inexistentes (cabo 1,5mm²
gravou R$ 8.484; correto é R$ 2,80 = coluna "Custo Direto Unit. (R$)"). Gerou "excesso" falso de
R$ 94 milhões. Causa: detecção de coluna casa por "contém" (provável "Material Unit." casando com
"Total Material", ou coluna de TOTAL lida como UNITÁRIO).
FIX a aplicar:
- Detecção por chave normalizada EXATA (sem acento/caixa, colapsar espaços, remover "(r$)"/"%"),
  NÃO por "contém". Nunca usar colunas de Total como valor unitário.
- Prioridade do unitário: Custo Direto Unit. > (Material Unit. + M.O. Unit.) > genérico.
- Calcular UNITÁRIO e TOTAL: totalOrigem = qtde×valorUnitOrigem; totalSinapi = qtde×matchValor;
  diferencaUnit, diferencaUnitPercent (se matchValor>0), diferencaTotal. Comparar unit vs unit e
  total vs total (nunca misturar).
- Botão "Aceitar todos" (+ "aceitar só ACHOU" + "desmarcar todos").
- Retornar DEBUG do mapeamento coluna→campo.
Validação: cabo 50mm² unit ≈ 52,89 / cabo 1,5mm² ≈ 2,80; economia/excesso em milhares, não milhões.

### PENDENTE Nº2 — Fluxo de Caixa: conta a pagar em 2030 distorce o gráfico
O gráfico "Fluxo de caixa previsto x realizado" mostra entradas zeradas e eixo em 2029-2030.
Causa: collectMonths() (app.js ~3710) pega todas as datas, ordena e slice(-12); existe 1 conta a
pagar com dueDate 2030-04-28 que estica a janela 4 anos. As contas a receber (R$ 256.991,45 Aberto
+ ~R$ 75 mil Recebido) estão corretas em 2026 mas ficam fora da janela.
FIX: rodar SELECT em accounts_payable WHERE dueDate>='2027-01-01' (ver se é digitação errada ou
conta legítima). Corrigir collectMonths() para CENTRAR no mês atual (ex.: 6 meses antes a 6 depois),
não deixar data isolada definir a janela.

### CONSTRUÍDO E FUNCIONANDO
- Ollama: override systemd (NUM_PARALLEL=1, MAX_LOADED_MODELS=1, NUM_THREADS=2, KEEP_ALIVE=5m,
  MAX_QUEUE=10). Modelos llama3.2:3b + all-minilm (dim 384).
- Fundação IA (api/index.php): ollama_generate(), ollama_embed(), ?module=ia&action=ping.
  O "não autenticado" era gate de permissão num módulo 'ia' inexistente (removido); agora usa a
  auth global. API exige chamada de dentro da página logada (apiModuleRequest).
- Indexação: ia_embeddings + ia_index_jobs, worker ia_index_worker.php (nohup, nice -19,
  idempotente). 24.943 embeddings (10.378 composições + 14.565 insumos), 100%.
- Seção "IA" no menu: iaIndex, iaTest, iaBusca, iaDepara, iaCompara.
- Busca semântica: action=buscarSemantica (cosseno sobre os vetores), tela com badge de
  similaridade. Testada e aprovada.
- De-para em lote: ia_depara_jobs/itens, worker, lê TODAS as abas, pula abas sem descrição,
  grupoAba = nome da aba. Classifica achou/revisar/cotação própria.
- Comparador Fase A: ia_compara_jobs/itens (setor, categoria, tipoOrigem, materialUnit,
  maoObraUnit, custoDiretoUnit, bdiPercent, diferencaPercent DECIMAL(12,2)). Detecção de cabeçalho
  fora da linha 1 (varre 15 linhas). Overflow corrigido. PORÉM a leitura do valor está errada
  (pendente nº1).
- Fase B1: action=enviarParaOrcamento {jobId, projectId, name?, apenasAceitos?}. Usa tabelas
  EXISTENTES orcamentos_obras + orcamento_obra_itens (nada novo). Mapeia origin (SINAPI/Cotação
  manual/Item livre), tipo (material/mao_de_obra por predomínio), setor→etapa (orcamento_etapas),
  categoryId por nome, sinapiSnapshotJson p/ rastreabilidade. Totais com a fórmula do orçamento
  existente. Botão "Enviar para Orçamento de Obra" no comparador/de-para. Os VALORES dependem do
  fix nº1.

### PLANILHA DE TESTE (padrão AltoQi) — estrutura
3 abas (Orcamento_SINAPI, Carport, Telhado). CABEÇALHO NA LINHA 4 (1-3 = título). Colunas:
A=Item B=Setor C=Categoria D=Referência AltoQi E=Tipo F=Código G=Descrição H=Unid. I=Qtde
J=Material Unit. K=M.O. Unit. L=Custo Direto Unit.(valor certo) M=Total Material N=Total M.O.
O=Total Direto P=BDI% Q=BDI R$ R=Total c/BDI S=Status T=Fonte U=URL V=Observação.
Comparar Custo Direto Unit. (sem BDI) vs custo SINAPI (sem BDI). BDI entra depois.

### TABELAS DO ORÇAMENTO (existentes, a Fase B reusa)
orcamentos_obras (cabeçalho), orcamento_obra_itens (itens; campos origin, tipo, etapa_id,
sinapi_id, stageName, sinapiSnapshotJson), orcamento_etapas. Visões prontas: Por Etapa, Por Tipo,
Por Centro de Custo, Previsto vs Realizado, export CSV. Módulos: workBudgets, workBudgetItems,
quotes, cotacoes, purchaseOrders, abcCurve.

### FASES FUTURAS (desenho)
- B2 Filtros/export: muito já vem das visões do orçamento (Por Etapa=ala, Por Tipo=material/MO);
  falta export filtrado "só materiais"/"só MO". Verificar antes de construir.
- B3 Aceite automático "mais barato". B4 Edição de itens (provável que já exista).
- B5 Cotações de fornecedor: módulo quotes/cotacoes JÁ existe; falta a ponte item→3 cotações→
  comparar fornecedores × SINAPI.
- "Aprendizado": treinar modelo NÃO é viável (sem GPU). Viável: memória de correções (acúmulo) +
  detecção de vícios por regras estatísticas (preço fora da mediana, etc.). Só após comparador
  estável.

### PROCESSO
Banco MISTO (en/pt) — DESCRIBE antes de SQL. financeiro_app sem DROP/TRUNCATE → usar DELETE.
Senha: export MYSQL_PWD antes (o ! quebra inline). Deploy: commit local → push → no servidor
git stash && git pull → migrations → Ctrl+Shift+R. Uma fase por vez, testar antes de avançar.
