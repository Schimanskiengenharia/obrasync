> **SPEC DE VISÃO FUTURA — não iniciar antes de fechar os pendentes de segurança/graves do
> relatório de revisão (docs/revisao/2026-revisao-geral.md). Implementar pelas 7 fases, uma por
> vez, testando cada uma. MS Project é a Fase 7 (última), pressupõe as Fases 1-6 prontas.**
>
> **Estado atual (2026-07):** já existe o módulo `projectSchedule` ("Cronograma Físico-Financeiro")
> com as tabelas `obra_cronograma_etapas`, `obra_cronograma_marcos`, `project_schedule` e
> `tipos_medicao` — cobre etapas, marcos, Gantt simplificado e integração inicial com Microsoft
> Project. Esta spec EXPANDE esse módulo. FALTAM: atividades (com predecessoras/caminho crítico/
> risco), atividade_dependencias (TI/II/TT/IT + lag), eap_pacotes, atividade_materiais,
> atividade_recursos, medicoes/medicao_itens (só existe `tipos_medicao`), entregas_materiais,
> estoque_obra, baseline_cronograma, riscos, checklists_liberacao, alteracoes_escopo. A Fase 1
> parte do `projectSchedule` existente; a Fase 7 (MS Project) aproveita a integração inicial já
> presente.

# Fluxo Integrado de Cronograma Físico-Financeiro para o ObraSyn

O cronograma físico-financeiro do ObraSyn deve funcionar como um sistema integrado de planejamento, execução, compras, medição, pagamento e controle de riscos da obra. A lógica principal deve seguir o modelo utilizado em ferramentas como MS Project, onde cada atividade possui duração, data de início, data de fim, predecessoras, sucessoras, percentual físico, custo, recursos, materiais, status e impacto no caminho crítico.

O objetivo não é apenas criar um cronograma visual, mas sim permitir que o sistema controle os entraves reais da obra, como atraso de materiais, falta de liberação de frente de serviço, dependência entre atividades, restrições financeiras, medições pendentes, pagamentos não realizados e riscos de atraso.

O fluxo principal do ObraSyn deve ser estruturado da seguinte forma:

ORÇAMENTO / SINAPI
→ EAP / PACOTES DE SERVIÇO
→ CRONOGRAMA FÍSICO
→ DEPENDÊNCIAS TÉCNICAS
→ SUPRIMENTOS / COMPRAS
→ LIBERAÇÃO DE FRENTE DE SERVIÇO
→ EXECUÇÃO
→ MEDIÇÃO FÍSICA
→ MEDIÇÃO FINANCEIRA
→ PAGAMENTO / FLUXO DE CAIXA
→ CONTROLE DE DESVIO / RISCO / REPLANEJAMENTO

Cada atividade do cronograma deve estar vinculada ao orçamento, aos materiais necessários, à mão de obra, aos custos, às predecessoras, à frente de serviço, ao percentual físico executado, ao valor financeiro correspondente e ao status de risco.

## 1. Integração com o orçamento

O orçamento deve ser a base inicial do cronograma físico-financeiro. Cada item orçamentário precisa poder ser vinculado a uma ou mais atividades do cronograma.

Cada item do orçamento deve conter, no mínimo:

* Código do item;
* Descrição do serviço;
* Unidade de medida;
* Quantidade;
* Valor de material;
* Valor de mão de obra;
* Valor de BDI;
* Valor total;
* Categoria do serviço;
* Frente ou ala da obra;
* Peso físico;
* Peso financeiro.

O sistema deve permitir que o orçamento seja dividido por pacotes de serviço, por exemplo: elétrica, pintura, dreno, carport, telhado, cobertura, hidráulica, serviços preliminares e complementares.

O valor financeiro de cada atividade deve ser puxado do orçamento, permitindo que o cronograma gere automaticamente a curva financeira planejada da obra.

## 2. Estrutura da EAP

A EAP deve organizar a obra em pacotes e subpacotes. Para o caso da obra analisada, a estrutura pode seguir o seguinte modelo:

1. Serviços preliminares;
2. Compra de materiais;
3. Carport;
4. Dreno;
5. Manutenção das placas solares;
6. Instalação elétrica da Ala Masculina 1;
7. Retirada do telhado da Ala Masculina 1;
8. Finalização elétrica da Ala Masculina 1 na laje;
9. Instalação hidráulica dos novos boilers;
10. Instalação das telhas novas da Ala Masculina 1;
11. Pintura e fechamento da Ala Masculina 1;
12. Instalação elétrica da Ala Masculina 2;
13. Instalação elétrica da Ala Feminina 1;
14. Instalação elétrica da Ala Feminina 2;
15. Cozinha;
16. Testes, correções e entrega final.

A EAP deve permitir que cada pacote tenha atividades internas, custos próprios, datas planejadas, percentual executado e status de liberação.

## 3. Tipos de dependência entre atividades

O ObraSyn deve permitir a criação de dependências entre atividades, conforme a lógica de cronogramas profissionais.

Os principais tipos de dependência são:

* Término para início: uma atividade só começa quando a predecessora termina;
* Início para início: duas atividades podem começar ao mesmo tempo ou com defasagem;
* Término para término: uma atividade só pode terminar junto ou depois de outra;
* Início para término: pouco utilizada, mas pode ser prevista no sistema.

Além disso, o sistema deve permitir:

* Defasagem positiva entre atividades;
* Antecipação entre atividades;
* Marcos de controle;
* Restrições de data;
* Bloqueios por condição técnica;
* Bloqueios por condição financeira;
* Bloqueios por falta de material;
* Bloqueios por falta de aprovação.

Exemplo de dependência:

A instalação elétrica da Ala Masculina 1 só pode iniciar após a chegada dos materiais principais.
A retirada do telhado da Ala Masculina 1 deve ocorrer antes da finalização elétrica na laje.
A instalação das telhas novas só pode ocorrer após a finalização elétrica na laje e instalação hidráulica dos novos boilers.
A pintura só pode iniciar após o fechamento da cobertura.

## 4. Entraves de suprimentos

Os materiais devem ser tratados como travas de liberação de atividades. Uma atividade não deve ser considerada liberada se os materiais críticos ainda não foram comprados ou entregues.

Entraves de suprimentos que devem ser controlados:

* Material ainda não comprado;
* Pedido de compra pendente;
* Compra aguardando aprovação;
* Material comprado, mas não entregue;
* Entrega parcial;
* Material entregue errado;
* Material entregue com quantidade insuficiente;
* Nota fiscal pendente;
* Pagamento de fornecedor pendente;
* Material sem vínculo com atividade;
* Material comprado fora do período previsto.

Regra sugerida:

Uma atividade só poderá mudar para o status “Liberada” se os materiais críticos vinculados a ela estiverem disponíveis em estoque ou confirmados na obra.

Exemplo:

A instalação elétrica da Ala Masculina 1 só pode iniciar se cabos, eletrodutos, eletrocalhas, quadros, disjuntores, caixas, conectores e demais materiais críticos estiverem comprados e entregues.

## 5. Entraves técnicos de execução

O cronograma deve controlar as liberações técnicas de frente de serviço.

Entraves técnicos que devem ser considerados:

* Frente de serviço ocupada;
* Atividade predecessora incompleta;
* Interferência entre equipes;
* Sequência construtiva incorreta;
* Falta de projeto liberado;
* Falta de ART ou documentação técnica;
* Falta de aprovação do cliente ou fiscalização;
* Condição climática impeditiva;
* Falta de equipe;
* Falta de equipamento;
* Retrabalho identificado;
* Serviço executado, mas ainda não aprovado.

Regra sugerida:

Uma atividade só pode iniciar se todas as suas predecessoras obrigatórias estiverem concluídas ou liberadas parcialmente, conforme regra definida no cronograma.

## 6. Entraves financeiros

O cronograma físico-financeiro precisa diferenciar claramente avanço físico, avanço financeiro, desembolso e recebimento.

O avanço físico representa o que foi executado em campo.
O avanço financeiro representa o que foi medido ou faturado.
O desembolso representa o que saiu do caixa para compras, mão de obra, fornecedores e despesas.
O recebimento representa o que entrou no caixa conforme contrato ou medições.

Entraves financeiros a serem controlados:

* Parcela contratual ainda não recebida;
* Medição não aprovada;
* Compra maior que o caixa disponível;
* Pagamento de fornecedor em atraso;
* Desembolso antecipado em relação ao recebimento;
* Custo real maior que o custo planejado;
* Medição financeira maior que o avanço físico;
* Avanço físico sem faturamento correspondente;
* Pagamento recebido sem execução proporcional;
* Atraso de recebimento impactando compras futuras.

No caso de contrato com pagamentos em 30, 60, 90 e 120 dias, com percentuais de 30%, 25%, 25% e 20%, o sistema deve tratar isso como curva financeira contratual. Essa curva não deve ser confundida com o avanço físico real da obra.

O cronograma deve comparar:

* Valor previsto a receber;
* Valor efetivamente recebido;
* Valor previsto a gastar;
* Valor efetivamente gasto;
* Valor comprometido em compras;
* Valor medido;
* Valor ainda não medido;
* Saldo de contrato;
* Saldo de obra a executar.

## 7. Fluxo físico-financeiro recomendado

O fluxo físico-financeiro deve seguir a seguinte sequência:

1. Planejamento físico da atividade;
2. Planejamento financeiro da atividade;
3. Planejamento das compras necessárias;
4. Aprovação das compras;
5. Compra dos materiais;
6. Entrega dos materiais;
7. Liberação da frente de serviço;
8. Execução da atividade;
9. Registro do percentual executado;
10. Validação da execução;
11. Medição física;
12. Medição financeira;
13. Faturamento;
14. Recebimento;
15. Comparação entre planejado e realizado;
16. Identificação de desvio;
17. Replanejamento, se necessário.

O sistema deve impedir que uma medição financeira ultrapasse o percentual físico aprovado da atividade.

Regra sugerida:

Valor medido da atividade menor ou igual ao percentual físico aprovado multiplicado pelo valor total da atividade.

## 8. Baseline e replanejamento

O ObraSyn deve possuir controle de baseline. A baseline representa a fotografia do planejamento aprovado em determinado momento.

Sugestão de controle:

* Baseline 0: cronograma original aprovado;
* Baseline 1: primeiro replanejamento;
* Baseline 2: segundo replanejamento;
* Realizado: execução real da obra.

O sistema deve comparar:

* Início planejado x início real;
* Fim planejado x fim real;
* Duração planejada x duração real;
* Custo planejado x custo real;
* Percentual físico planejado x percentual físico realizado;
* Percentual financeiro planejado x percentual financeiro realizado;
* Desembolso previsto x desembolso realizado;
* Recebimento previsto x recebimento realizado.

Sempre que houver alteração relevante de prazo, custo ou escopo, o sistema deve permitir gerar uma nova baseline, preservando o histórico anterior.

## 9. Caminho crítico

O sistema deve identificar as atividades críticas da obra. Atividades críticas são aquelas que, se atrasarem, podem atrasar a entrega final ou a entrega de uma frente importante.

Exemplo de caminho crítico da Ala Masculina 1:

Compra de materiais
→ Entrega de materiais
→ Instalação elétrica da Ala Masculina 1
→ Retirada do telhado
→ Finalização elétrica na laje
→ Instalação hidráulica dos boilers
→ Instalação das telhas novas
→ Pintura
→ Fechamento da ala

Se qualquer uma dessas atividades atrasar, a entrega da Ala Masculina 1 pode ser impactada.

O sistema deve destacar atividades críticas em painel próprio e gerar alertas quando houver risco de atraso em atividade crítica.

## 10. Motor de risco

Cada atividade deve possuir uma classificação automática de risco.

O risco pode considerar os seguintes fatores:

* Se a atividade está no caminho crítico;
* Se há atraso em predecessoras;
* Se os materiais estão comprados;
* Se os materiais foram entregues;
* Se há pagamento pendente;
* Se a frente de serviço está liberada;
* Se existe interferência com outra equipe;
* Se houve retrabalho;
* Se o custo real está acima do planejado;
* Se a produtividade está abaixo da planejada;
* Se a atividade depende de aprovação externa.

Classificação sugerida:

Risco baixo: atividade dentro do prazo, material disponível, frente liberada e fora do caminho crítico.
Risco médio: atividade com pequena pendência, entrega parcial ou leve atraso.
Risco alto: atividade crítica com material pendente, frente não liberada ou atraso relevante.
Risco crítico: atividade crítica atrasada, sem material, sem caixa ou com impacto direto na entrega da obra.

Exemplo de alerta:

Atividade: Instalação elétrica da Ala Masculina 1
Status de risco: Alto
Motivos: atividade no caminho crítico, depende da entrega dos cabos, início previsto próximo e material ainda não entregue.

## 11. Status das atividades

Cada atividade do cronograma deve possuir um status operacional.

Sugestão de status:

* Não iniciada;
* Aguardando material;
* Aguardando compra;
* Aguardando entrega;
* Aguardando frente de serviço;
* Aguardando aprovação;
* Liberada;
* Em execução;
* Pausada;
* Concluída fisicamente;
* Aguardando medição;
* Medida;
* Faturada;
* Recebida;
* Reprovada;
* Em retrabalho;
* Concluída definitivamente.

O status da atividade deve ser atualizado manualmente ou automaticamente, conforme os vínculos com compras, materiais, medições e predecessoras.

## 12. Integrações internas necessárias

O ObraSyn deve integrar os seguintes módulos:

Orçamento → Cronograma
Cronograma → Compras
Compras → Estoque / Entrega de materiais
Estoque → Liberação de atividade
Cronograma → Diário de obra
Diário de obra → Avanço físico
Avanço físico → Medição
Medição → Financeiro
Financeiro → Fluxo de caixa
Cronograma → Risco
Risco → Dashboard
Baseline → Comparativo planejado x realizado

Cada módulo deve alimentar o outro, evitando lançamento duplicado de informações.

## 13. Tabelas principais do sistema

Estrutura mínima sugerida:

* obras;
* orcamento_itens;
* eap_pacotes;
* atividades;
* atividade_dependencias;
* atividade_materiais;
* atividade_recursos;
* compras;
* compra_itens;
* entregas_materiais;
* estoque_obra;
* rdo;
* medicoes;
* medicao_itens;
* pagamentos;
* baseline_cronograma;
* riscos;
* checklists_liberacao;
* alteracoes_escopo.

## 14. Campos principais da tabela de atividades

A tabela de atividades deve conter, no mínimo:

* id;
* obra_id;
* eap_id;
* nome;
* descrição;
* data_inicio_planejada;
* data_fim_planejada;
* data_inicio_real;
* data_fim_real;
* duração_planejada;
* duração_real;
* percentual_planejado;
* percentual_real;
* custo_planejado;
* custo_real;
* peso_fisico;
* peso_financeiro;
* status;
* eh_marco;
* eh_caminho_critico;
* nivel_risco;
* responsavel;
* observacoes.

## 15. Campos principais da tabela de dependências

A tabela de dependências deve conter:

* id;
* atividade_id;
* predecessora_id;
* tipo_dependencia;
* lag_dias;
* obrigatoria;
* descricao_regra.

Exemplo:

Atividade: Instalar telha nova da Ala Masculina 1
Predecessoras obrigatórias: finalizar elétrica na laje e instalar hidráulica dos boilers.
Tipo: término para início.
Lag: 0 dias.

## 16. Campos principais da tabela de compras

A tabela de compras deve conter:

* id;
* obra_id;
* atividade_id;
* fornecedor;
* status;
* data_solicitacao;
* data_aprovacao;
* data_compra;
* data_prevista_entrega;
* data_entrega_real;
* valor_total;
* condicao_pagamento;
* nota_fiscal;
* observacoes.

## 17. Regras automáticas recomendadas

Regra 1: atividade não inicia sem predecessora obrigatória concluída.
Regra 2: atividade não inicia sem material crítico entregue.
Regra 3: atividade não inicia sem frente de serviço liberada.
Regra 4: compra deve ocorrer antes da data de início da atividade, considerando prazo de entrega e folga de segurança.
Regra 5: medição financeira não pode ultrapassar o avanço físico aprovado.
Regra 6: pagamento recebido não significa avanço físico executado.
Regra 7: atividade crítica atrasada deve gerar alerta automático.
Regra 8: material atrasado em atividade crítica deve gerar risco alto ou crítico.
Regra 9: custo real acima do planejado deve gerar alerta financeiro.
Regra 10: alteração de prazo ou escopo deve permitir criação de nova baseline.

## 18. Fluxo específico para a obra analisada

Para a obra com carport, dreno, manutenção das placas solares, elétrica das alas, troca de telha apenas na Ala Masculina 1, hidráulica dos boilers e pintura, o fluxo sugerido é:

Contrato aprovado
→ Cronograma baseline aprovado
→ Planejamento das compras proporcionais por frente de serviço
→ Liberação da primeira parcela contratual
→ Compra dos materiais da primeira etapa
→ Entrega dos materiais
→ Início das frentes liberadas em paralelo: carport, dreno, manutenção das placas solares e instalação elétrica da Ala Masculina 1
→ Antes da finalização da elétrica da Ala Masculina 1, iniciar retirada do telhado
→ Finalizar elétrica da Ala Masculina 1 na laje
→ Executar instalação hidráulica dos novos boilers
→ Instalar telhas novas da Ala Masculina 1
→ Executar pintura da Ala Masculina 1
→ Fechar e liberar a Ala Masculina 1
→ Executar elétrica das demais alas conforme liberação de material e frente de serviço
→ Executar medições parciais
→ Comparar avanço físico com fluxo financeiro de 30, 60, 90 e 120 dias
→ Corrigir desvios e atualizar riscos
→ Entregar obra final.

Para a Ala Masculina 1, o fluxo é mais complexo porque existe troca de telhado. Para a Ala Feminina 1, Ala Feminina 2 e demais frentes apenas de elétrica, o fluxo pode ser:

Material entregue
→ Frente liberada
→ Instalação elétrica
→ Testes
→ Correções
→ Medição
→ Fechamento da frente.

## 19. Integração com pagamento 30, 60, 90 e 120 dias

O contrato possui fluxo de pagamento dividido em:

30 dias: 30%
60 dias: 25%
90 dias: 25%
120 dias: 20%

O sistema deve permitir vincular esse fluxo contratual ao cronograma financeiro, mas sem obrigar que o avanço físico siga exatamente os mesmos percentuais.

As compras de materiais devem ser proporcionais às frentes que serão executadas em cada etapa. Por exemplo, se a primeira etapa executar apenas parte da Ala Masculina 1, carport, dreno e manutenção solar, a compra de materiais deve considerar apenas os materiais necessários para essas frentes, evitando comprar material de etapas futuras sem necessidade de caixa.

O sistema deve mostrar alerta quando:

* A compra prevista for maior que a parcela recebida;
* O valor executado for menor que o valor recebido;
* O valor executado for maior que o valor medido;
* O cronograma exigir material sem caixa disponível;
* O pagamento de fornecedor ocorrer antes do recebimento contratual;
* A obra estiver fisicamente atrasada, mas financeiramente adiantada.

## 20. Dashboard recomendado

O painel do ObraSyn deve apresentar:

* Percentual físico planejado;
* Percentual físico realizado;
* Percentual financeiro planejado;
* Percentual financeiro realizado;
* Curva S física;
* Curva S financeira;
* Valor previsto a receber;
* Valor recebido;
* Valor previsto a pagar;
* Valor pago;
* Custo comprometido;
* Custo realizado;
* Saldo de contrato;
* Saldo de obra;
* Atividades críticas;
* Materiais críticos;
* Frentes bloqueadas;
* Frentes liberadas;
* Atividades com risco alto;
* Atividades com risco crítico;
* Desvio de prazo;
* Desvio de custo;
* Próximos marcos da obra.

## 21. Modelo de desenvolvimento por fases

Para implantação no ObraSyn, recomenda-se dividir o desenvolvimento em fases.

Fase 1: cronograma físico-financeiro básico
Criar obras, EAP, atividades, datas, custos, percentuais, predecessoras e status.

Fase 2: integração com orçamento
Vincular itens orçamentários às atividades e gerar peso físico e financeiro.

Fase 3: compras e materiais
Criar vínculo entre atividades, materiais, compras, entregas e estoque de obra.

Fase 4: medição e financeiro
Transformar avanço físico aprovado em medição financeira e integrar com contas a receber e contas a pagar.

Fase 5: risco e caminho crítico
Criar alertas automáticos para atraso, material pendente, falta de caixa, frente bloqueada e atividades críticas.

Fase 6: baseline e replanejamento
Permitir salvar versões do cronograma e comparar planejado x realizado.

Fase 7: compatibilidade com MS Project
Permitir importar e exportar atividades com campos compatíveis: ID, EAP/WBS, nome da tarefa, duração, início, fim, predecessoras, custo, recurso, percentual concluído e baseline.

## 22. Resumo da lógica central

O ObraSyn deve funcionar com a seguinte lógica:

Orçamento define o valor.
EAP organiza o escopo.
Cronograma define o tempo.
Predecessoras definem a sequência.
Compras liberam materiais.
Materiais liberam frentes.
Frentes liberam execução.
Execução gera avanço físico.
Avanço físico gera medição.
Medição gera faturamento.
Faturamento gera recebimento.
Pagamentos geram controle de caixa.
Desvios geram alertas.
Alertas geram risco.
Risco orienta o replanejamento.

Com isso, o cronograma deixa de ser apenas uma lista de datas e passa a ser um sistema de gestão de obra, integrando prazo, custo, compras, execução, medição, pagamento e risco.
