# Importação inteligente de PDF nas Cotações (IA embutida) — Design

> **Data:** 2026-07-28 · **Base:** v1.38.3
>
> **Fase 2 de 2.** Depende da Fase 1 (atributos por tipo de item):
> [`2026-07-28-cotacao-atributos-tipo-design.md`](2026-07-28-cotacao-atributos-tipo-design.md).
> A Fase 1 cria os campos; esta fase faz a IA preenchê-los a partir de um PDF.
>
> **Pré-requisito não técnico:** a Fase 1 precisa estar validada no servidor antes de começar esta.

---

## 1. Objetivo

Tirar a IA do menu separado e colocá-la dentro do trabalho real. Concretamente, o fluxo que o
usuário descreveu: abrir as cotações da obra, entrar em Instalações Elétricas, importar o PDF do
fornecedor e ter os itens extraídos — cabos separados por cor e bitola, com quantidade, valor
unitário e valor total de cada um.

Hoje isso não existe. A importação de PDF que há no sistema (`cotacao_itens_de_pdf()` em
`api/index.php`) é heurística por expressão regular: roda `pdftotext -layout` e, para cada linha que
contenha um número em formato monetário, assume que a descrição é o texto até o primeiro espaço
duplo. **O campo `quantidade` é retornado sempre como `null`** — nunca é extraído. Ela também vive
numa aba separada ("Importação de arquivos"), desligada do fluxo de cotação por material.

Em paralelo, o projeto **já tem IA generativa instalada e ociosa**: `ollama_generate()` com o modelo
`llama3.2:3b` é chamado em um único lugar do código — o teste de ping. Toda a inteligência em uso
hoje é busca por similaridade (embeddings). Esta fase põe a capacidade de leitura para trabalhar.

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Onde roda | Local (Ollama no servidor), atrás de uma interface trocável por configuração |
| Porte do modelo | **7B** — candidato `qwen2.5:7b-instruct` (bom em português e em JSON válido) |
| Natureza dos PDFs | Digitais, com texto selecionável (sem OCR nesta fase) |
| Execução | **Assíncrona**, via worker — um 7B em CPU levaria minutos e estouraria o timeout HTTP |
| Gravação | **Nunca automática** — revisão humana obrigatória antes de criar qualquer registro |

## 3. Fluxo do usuário

1. Na aba **Cotações por material**, com obra e disciplina já selecionadas nos filtros existentes,
   o usuário clica em **"Importar PDF de fornecedor"**.
2. Escolhe o arquivo e o **fornecedor** (select do cadastro). O fornecedor é obrigatório: a proposta
   precisa saber de quem é. A IA tenta sugerir a partir do cabeçalho do PDF, mas a palavra final é
   do usuário — sugestão errada de fornecedor contaminaria o comparativo de preços.
3. O upload cria um job e dispara o worker. A tela mostra progresso por polling, no mesmo padrão do
   de-para e do comparador que já existem.
4. Terminado, abre a **tela de conferência**: uma linha por item extraído, tudo editável, com a
   quantidade, unidade, valor unitário, valor total e os atributos da Fase 1 (cor, bitola…)
   preenchidos pela IA. Itens suspeitos vêm destacados (ver §7).
5. O usuário corrige o que precisar, desmarca o que não quer, e confirma.
6. Só então o sistema grava.

## 4. O que é criado ao confirmar

Para **cada item aceito**, dentro de uma única transação:

- Uma linha em **`cotacoes`** — o material cotado (`description`, `unit`, `quantity`, `projectId`,
  `categoriaId` = disciplina, `tipoItemId` = tipo inferido, `status` = 'Em cotação').
- As linhas correspondentes em **`cotacao_atributo_valores`** — os atributos da Fase 1.
- Uma linha em **`cotacao_itens`** — a proposta daquele fornecedor para esse material
  (`material_cotacao_id`, `fornecedor_id`, `valor_unitario`, `valor_total`, `marca`,
  `prazo_entrega`).

**Consequência que o usuário precisa entender:** um PDF com cinco cores de cabo gera **cinco
materiais**, cada um com uma proposta daquele fornecedor. Quando o segundo fornecedor cotar os
mesmos cabos, o sistema deve reaproveitar os materiais existentes em vez de duplicá-los — ver §6.

## 5. Arquitetura da extração

### 5.1 Interface trocável

Toda a extração fica atrás de **uma** função, para que trocar de motor seja configuração e não
reescrita:

```php
// Devolve ['ok'=>bool, 'itens'=>array, 'modelo'=>string, 'erro'=>?string, 'brutoJson'=>?string]
function extrair_itens_documento(string $texto, array $contexto, array $config): array
```

`$contexto` carrega o que o modelo precisa saber para acertar: a disciplina, a lista de tipos de
item cadastrados nela e, para cada tipo, os atributos da Fase 1 com seus valores possíveis. É isso
que permite ao modelo devolver `cor: "azul"` em vez de texto livre — ele recebe a lista de cores
válidas e é instruído a escolher entre elas ou deixar nulo.

Seleção do motor por configuração (`config['ia_extrator']`, default `'ollama'`):
- `extrator_ollama()` — implementação desta fase, roda no servidor.
- `extrator_externo()` — **não implementado agora**; o ponto de extensão fica pronto para o dia em
  que a precisão local não bastar, sem reescrever o resto.

### 5.2 O worker

`scripts/cotacao_import_worker.php`, espelhando `scripts/ia_depara_worker.php` (guarda de CLI,
disparo por `nohup` com `nice`, `register_shutdown_function` para erro fatal, expiração de jobs
travados). Passos:

1. `pdftotext -layout` sobre o arquivo. Se o texto sair vazio ou quase vazio, o job termina com erro
   explicando que o PDF parece ser digitalizado — **não** tenta adivinhar (OCR está fora do escopo).
2. Divide o texto em blocos que caibam no contexto do modelo, com sobreposição de algumas linhas
   para não cortar um item ao meio. Blocos são processados em sequência e os resultados concatenados.
3. Para cada bloco, chama `extrair_itens_documento()`.
4. Valida e normaliza cada item (§7), grava em `cotacao_import_itens` e atualiza o progresso.

### 5.3 O prompt

Instruções em português, saída em JSON estrito (usando o modo JSON do Ollama), com:
- A regra central, repetida: **não inventar**. Campo que não estiver no documento vem `null`.
  É preferível deixar vazio para o humano preencher do que entregar um número plausível e errado.
- Um exemplo resolvido (few-shot) com uma linha de cabo, mostrando a separação por cor.
- A lista de tipos e atributos válidos daquela disciplina, com os valores possíveis.
- Números em formato brasileiro no documento; a saída deve vir numérica.

## 6. Reaproveitamento de material entre fornecedores

Quando o segundo fornecedor cotar o mesmo cabo, criar um material novo destruiria o comparativo —
que é justamente o valor do módulo. Na tela de conferência, cada item extraído é confrontado com os
materiais já existentes na mesma obra e disciplina; havendo candidato semelhante, a linha aparece
como **"vincular ao material existente"** em vez de "criar novo", com o nome do material sugerido, e
o usuário pode trocar a decisão.

O casamento reusa o que já existe no projeto: `cotacao_normalizar_desc()` para normalizar a
descrição e, quando a base de embeddings estiver populada, a mesma similaridade de cosseno usada na
busca semântica. Sugestão fraca não vira vínculo automático — na dúvida, propõe criar novo.

## 7. Confiança e barreiras contra alucinação

Um modelo 7B erra. O desenho parte disso, em vez de torcer para não acontecer.

**Nada é gravado sem revisão humana.** Não há modo "importar direto".

Cada item recebe avisos automáticos, calculados **em código** (não pelo modelo):

| Verificação | Regra | Efeito |
|---|---|---|
| Aritmética | `quantidade × valor_unitario` vs `valor_total`, tolerância de 1% | Divergiu → item marcado em vermelho com os dois valores à vista |
| Ancoragem no texto | A descrição extraída precisa aparecer no texto do PDF (comparação normalizada) | Não apareceu → marcado como possível invenção |
| Faixa de valor | Unitário ≤ 0 ou acima de um teto configurável | Marcado |
| Atributo fora da lista | Valor que não está nas `options` daquele atributo | Descartado e marcado, nunca gravado torto |
| Campo obrigatório vazio | Atributo `required` da Fase 1 sem valor | Marcado; bloqueia a confirmação daquele item |

**Fallback.** Se o modelo não devolver JSON válido depois de duas tentativas, o job não morre: cai
para a heurística `cotacao_itens_de_pdf()` que já existe, marca o job como **extração degradada** e
avisa na tela que aqueles itens vieram do método antigo (sem quantidade, sem atributos). Pior
resultado, mas nunca tela vazia sem explicação.

## 8. Modelo de dados

Duas tabelas novas, no molde de `ia_depara_jobs`/`ia_depara_itens`:

**`cotacao_import_jobs`** — `id` VARCHAR(64) PK, `projectId`, `categoriaId`, `fornecedorId`,
`nomeArquivo`, `arquivoPath`, `total`, `processados`, `status` ENUM('queued','running','done',
'error'), `modelo`, `degradado` TINYINT, `errorMessage`, `createdAt`, `startedAt`, `finishedAt`,
`userId`.

**`cotacao_import_itens`** — `id` PK, `jobId` FK ON DELETE CASCADE, `descricao`, `unidade`,
`quantidade`, `valor_unitario`, `valor_total`, `marca`, `prazo_entrega`, `tipoItemId` (inferido),
`atributosJson` (mapa atributo→valor), `avisosJson` (lista de avisos da §7), `confianca` DECIMAL,
`materialSugeridoId` (§6), `acao` ENUM('criar','vincular','ignorar'), `aceito` TINYINT,
`cotacaoGeradaId` (preenchido na confirmação).

Migration aditiva **e** `ensure_cotacao_import_tables()`, conforme a convenção do projeto.

O arquivo enviado é guardado fora do docroot com o mesmo `store_upload()` já usado no sistema
(nome aleatório, validação de extensão e MIME real), e o texto extraído **não** é persistido além do
necessário — o job guarda o caminho do PDF, não o texto inteiro.

## 9. Endpoints

Em `?module=cotacoes`, mesma permissão do módulo:

| Ação | Método | Função |
|---|---|---|
| `importPdfUpload` | POST multipart | Recebe arquivo + `projectId`/`categoriaId`/`fornecedorId`, valida, cria o job e dispara o worker |
| `importPdfStatus` | GET | Polling: status, progresso, se está degradado |
| `importPdfItens` | GET | Itens extraídos com avisos e sugestões de vínculo |
| `importPdfItemSalvar` | POST | Salva a correção manual de um item na tela de conferência |
| `importPdfConfirmar` | POST | Cria materiais/atributos/propostas dos itens aceitos, em transação |
| `importPdfDescartar` | POST | Descarta o job e apaga o PDF do disco |

## 10. Testes

Sem banco local, a cobertura automatizada mira as funções puras — que é onde mora o risco de erro
silencioso:

- Normalização de número em formato pt-BR (`1.234,56` → `1234.56`), incluindo casos degenerados.
- Validação do JSON devolvido pelo modelo: campo faltando, tipo errado, item vazio, JSON truncado.
- Checagem aritmética com a tolerância de 1%, incluindo divisão por zero.
- Ancoragem da descrição no texto original.
- Atributo com valor fora das `options`.
- Divisão do texto em blocos com sobreposição, garantindo que nenhuma linha se perca.

O motor de IA em si é isolado por injeção: nos testes, `extrair_itens_documento()` é substituída por
uma função que devolve respostas fixas, inclusive respostas ruins de propósito (JSON inválido,
número absurdo, descrição inventada) para provar que as barreiras da §7 pegam cada caso.

Roteiro de validação no servidor, com PDFs reais de fornecedor: um PDF simples, um com várias cores
de cabo, um de fornecedor diferente para o mesmo material (testando o reaproveitamento da §6), e um
PDF digitalizado (deve recusar com mensagem clara, não devolver lixo).

## 11. Riscos

| Risco | Mitigação |
|---|---|
| Servidor sem memória para o 7B (precisa de ~6 GB livres) | **Levantar `free -h` e `nvidia-smi` antes de começar.** Sem folga, ou se usa modelo menor com expectativa menor, ou se ativa o motor externo |
| Extração lenta demais para uso prático | Worker assíncrono com progresso; medir tempo real no piloto antes de expandir para outros fluxos |
| Modelo inventa valores plausíveis | Revisão obrigatória + as cinco verificações automáticas da §7, calculadas em código |
| Duplicação de materiais entre fornecedores | Sugestão de vínculo da §6 |
| Duas importações de PDF convivendo no sistema | Decisão consciente: a aba "Importação de arquivos" atende o fluxo de cotação de compra (comparação com orçamento) e **não é tocada** nesta fase. Unificar depende de decidir o futuro dos dois ciclos de compra, que é o assunto de `docs/revisao/2026-07-27-varredura-cotacoes-obras.md` — fora do escopo |
| PDF gigante estourando contexto | Divisão em blocos com sobreposição (§5.2) |

## 12. Fora do escopo

OCR e PDF digitalizado; extração em planilhas Excel (já existe caminho próprio); substituição da aba
de importação de arquivos; embutir IA nos demais módulos (Orçamento, Propostas) — o motor fica
reaproveitável, mas cada fluxo terá seu próprio ciclo; e o motor externo, cujo ponto de extensão
fica pronto mas sem implementação.
