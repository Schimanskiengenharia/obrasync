# Atributos por tipo de item nas Cotações (A2) — Design

> **Data:** 2026-07-28 · **Base:** v1.38.3 · **Item do backlog:** A2 (Onda A do estudo de benchmark, aprovado em 2026-07-18)
>
> **Fase 1 de 2.** Esta spec cobre **apenas** a estrutura de atributos. A extração por IA
> (importar PDF dentro da cotação e deixar a IA preencher os itens e seus atributos) é a **Fase 2**
> e terá spec própria — ver "Fase 2" no fim deste documento.

---

## 1. O problema

O pedido original do usuário: *"abrir cotações da obra, abrir instalações elétricas, importar o PDF
e a IA extrair os valores dos cabos e de cada cor, unitariamente e globalmente e quantidade"* — e,
mais amplamente, que a IA deixe de ser um menu à parte e passe a viver dentro dos fluxos de trabalho.

Dois obstáculos concretos impedem isso hoje:

**1. Não existe onde guardar "cor" ou "bitola".** A tabela `cotacoes` (o material cotado) tem
`description`, `unit`, `quantity`, `categoriaId` e `tipoItemId`. Um cabo azul e um cabo vermelho só
podem ser diferenciados por texto livre dentro de `description` — não há como filtrar, agrupar ou
somar por cor. Sem essa estrutura, a IA da Fase 2 não teria campo nenhum para preencher.

**2. A importação de PDF atual não usa IA e é frágil.** `cotacao_itens_de_pdf()`
(`api/index.php`) roda `pdftotext -layout` e, para cada linha que contenha um número em formato
monetário, chuta que a descrição é o texto até o primeiro espaço duplo. **O campo `quantidade` é
sempre `null`** — nunca é extraído. A unidade sai de uma lista fixa por regex. Isso é diagnóstico,
não crítica: a heurística foi escrita antes de haver IA no projeto.

Vale registrar um achado que motiva a Fase 2: o projeto **já tem IA generativa instalada**
(`ollama_generate()`, modelo `llama3.2:3b`) e ela é chamada em **um único lugar** — o teste de ping
(`api/index.php`, no handler de teste do módulo IA). Toda a inteligência em uso hoje é busca por
similaridade via embeddings. A capacidade de leitura/extração está ociosa.

## 2. Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Escopo do "embutir IA" | Piloto em Cotações | Menor risco; o motor de extração é reaproveitável nos outros fluxos depois de provado |
| Onde a IA roda (Fase 2) | Local agora, atrás de uma interface trocável | Preço de fornecedor não sai da rede; se a precisão local não convencer, trocar para API externa vira configuração, não reescrita |
| Natureza dos PDFs | Quase sempre digitais (texto selecionável) | Viabiliza extração via `pdftotext` + modelo local, sem OCR nem modelo de visão |
| Cor/bitola | Atributos configuráveis por tipo (este A2) | Estrutura correta e já aprovada no backlog; colunas fixas resolveriam só elétrica e engessariam hidráulica, alvenaria etc. |
| Alcance na UI (Fase 1) | Cadastrar, preencher e ver na lista | Fecha o ciclo completo sem mexer em filtro/agrupamento, que são telas hoje estáveis |
| Troca de tipo de item | Perguntar ao usuário na hora | Evita tanto perda silenciosa de preenchimento quanto acúmulo invisível de lixo |

## 3. Escopo

**Nesta Fase 1:**
- Cadastro de atributos por tipo de item (definição).
- Preenchimento dos atributos ao criar/editar um material cotado.
- Exibição dos atributos preenchidos na lista de cotações por material.

**Fora desta fase** (não implementar agora): filtro por atributo, agrupamento/totalização por
atributo no Resultado das cotações, atributos em cotações de **compra** (`cotacao_itens` com
`cotacao_id`, o fluxo de importação de arquivo), e toda a extração por IA.

## 4. Modelo de dados

Duas tabelas novas, espelhando o par que já existe para campos personalizados de obra
(`obra_campos_personalizados` + `obra_valores_personalizados`).

```sql
CREATE TABLE IF NOT EXISTS cotacao_tipo_atributos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipoItemId BIGINT UNSIGNED NOT NULL,
  fieldName VARCHAR(160) NOT NULL,
  fieldType VARCHAR(40) NOT NULL DEFAULT 'Texto',
  `options` TEXT,
  `required` ENUM('Não','Sim') NOT NULL DEFAULT 'Não',
  sortOrder INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cotattr_tipo FOREIGN KEY (tipoItemId) REFERENCES cotacao_tipos_item(id) ON DELETE CASCADE,
  UNIQUE KEY uk_cotattr_tipo_nome (tipoItemId, fieldName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cotacao_atributo_valores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cotacaoId BIGINT UNSIGNED NOT NULL,
  atributoId BIGINT UNSIGNED NOT NULL,
  `value` TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cotval_cotacao FOREIGN KEY (cotacaoId) REFERENCES cotacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cotval_atributo FOREIGN KEY (atributoId) REFERENCES cotacao_tipo_atributos(id) ON DELETE CASCADE,
  UNIQUE KEY uk_cotval_cotacao_attr (cotacaoId, atributoId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Onde os valores penduram, e por quê.** No fluxo de cotação por material, `cotacoes` é o
**material que está sendo cotado** e `cotacao_itens` são as **propostas dos fornecedores** para
aquele material. "Cabo flexível 2,5mm² azul, 100 m" é uma linha em `cotacoes`; três fornecedores
cotando esse cabo são três linhas em `cotacao_itens`. Cor e bitola descrevem o material, não a
proposta — por isso `cotacao_atributo_valores.cotacaoId` aponta para `cotacoes`.

**Nomenclatura.** O schema do projeto é misto (camelCase inglês nas tabelas antigas, snake_case
português nas novas de 2026-06 em diante). Aqui os nomes de coluna seguem **o molde
`obra_campos_personalizados`** (`fieldName`/`fieldType`/`options`/`required`/`sortOrder`), como o
item A2 do backlog determina explicitamente, e **não** o padrão local da família `cotacao_*`
(`nome`/`ordem`). O motivo é prático, não estético: o frontend já sabe renderizar um campo a partir
desses nomes, e reusá-los permite aproveitar essa lógica em vez de duplicá-la. Já o nome do pai
(`tipoItemId`) segue a família `cotacao_*`.

**Entrega:** migration `2026-07-28-cotacao-atributos-tipo.sql` (aditiva, idempotente, com
`IF NOT EXISTS`) **e** função `ensure_cotacao_atributos_tables()` no `api/index.php`, chamada no
handler do módulo e no gate do bootstrap — conforme a convenção obrigatória do projeto (toda tabela
nova precisa dos dois, para auto-cura em produção).

## 5. Backend

Quatro ações novas em `?module=cotacoes`, no mesmo molde de `categoriaSalvar`/`tipoSalvar`/
`tipoOrdenar` que já existem:

| Ação | Método | Payload | Resposta |
|---|---|---|---|
| `atributoList` | GET | `tipoItemId` (ou `categoriaId` para trazer de todos os tipos da disciplina) | Lista de atributos ordenada por `sortOrder` |
| `atributoSalvar` | POST | `{id?, tipoItemId, fieldName, fieldType, options, required, sortOrder, status}` | Registro salvo; duplicata de `fieldName` no mesmo tipo → **409** |
| `atributoExcluir` | POST | `{id}` | Exclui se nunca usado; se houver valores gravados, **recusa e orienta a inativar** (`status='Inativo'`) |
| `atributoOrdenar` | POST | `{ids: [...]}` | `sortOrder` = posição, em transação |

**Preenchimento dos valores.** O `materialSalvar` existente passa a aceitar
`atributos: {<atributoId>: "<valor>"}` no payload e grava em `cotacao_atributo_valores` **na mesma
transação** do material — se a gravação dos atributos falhar, o material não é salvo pela metade.
`materialGet` e `materialList` passam a devolver os valores preenchidos junto do material.

**Validação no servidor** (nunca só no cliente — o payload pode vir de fora do formulário):
- `required='Sim'` com valor vazio → **422** nomeando o campo que falta.
- `Seleção` com valor fora de `options` → **422**.
- `Múltipla escolha` com qualquer item fora de `options` → **422**.
- `Número`/`Moeda`/`Percentual` com valor não numérico → **422**.
- `Data` fora de `YYYY-MM-DD` → **422**.
- `atributoId` que não pertence ao `tipoItemId` do material → **422** (evita gravar valor de um tipo
  em material de outro).

**Permissão:** a mesma do módulo de cotações (`purchaseOrders` via `authorize_request`), sem criar
perfil novo — coerente com `categoriaSalvar`/`tipoSalvar`.

## 6. Frontend

**Cadastro.** A tela **Categorias de Cotação** (que já existe: `cotacaoCatOpen` /
`renderCotacaoCategorias`) ganha, dentro de cada tipo de item, a gestão dos seus atributos —
adicionar, editar, reordenar e inativar.

Os `fieldType` aceitos nesta fase são **oito**: Texto, Número, Moeda, Percentual, Data, Seleção,
Múltipla escolha e Sim/Não. São os mesmos que o sistema já renderiza para campos de obra, **menos
`Arquivo`**, que fica deliberadamente de fora: anexo exige rota de upload e download autenticado,
guarda de path traversal e exclusão do arquivo em disco (o molde do RH, `rh-doc-upload`/`-arquivo`/
`-delete`) — é uma frente inteira, não um tipo de campo a mais. Se surgir necessidade real de anexar
arquivo a um atributo, vira item próprio.

**Formato de armazenamento** (`cotacao_atributo_valores.value` é TEXT e guarda sempre string):
- Texto: como digitado.
- Número / Moeda / Percentual: número com **ponto** decimal (`"1234.56"`), normalizado no backend a
  partir do formato pt-BR digitado, para permitir comparação numérica depois.
- Data: `YYYY-MM-DD`.
- Seleção: exatamente um dos valores de `options`.
- Múltipla escolha: os valores escolhidos unidos por `;` (mesmo separador de `options`), sem espaço
  em volta — ex.: `"azul;vermelho"`.
- Sim/Não: a string `Sim` ou `Não`.

As `options` (para Seleção e Múltipla escolha) são separadas por `;`, com espaços em volta ignorados
e itens vazios descartados.

**Preenchimento.** No formulário de material (`openCotacaoMaterialForm`), escolher o tipo de item
carrega e renderiza dinamicamente os atributos ativos daquele tipo. Campo obrigatório vazio bloqueia
o salvar com mensagem clara apontando qual campo falta.

**Exibição.** A lista de cotações por material (`renderCotacaoMaterialLista`) mostra os atributos
preenchidos de forma compacta na linha do material — o suficiente para distinguir o cabo azul do
vermelho de relance, sem transformar a lista numa planilha.

**Convenções que já ficam amarradas:**
- Todo valor vindo do banco passa por `escapeHtml`/`svgText` antes de ir para `innerHTML`.
- Atributo de `fieldType='Moeda'` exibido em tela usa `moneySpan()` — a regra do modo privacidade
  fechada na v1.38.3. Em documento/export continuaria `asMoney` (não se aplica nesta fase, que não
  toca impressão).
- Ao mudar `app.js`/`styles.css`, incrementar o `?v=` em `index.html` e `APP_VERSION`.

## 7. Regras e casos de borda

**Material sem tipo de item.** `cotacoes.tipoItemId` é opcional hoje e continua sendo. Material sem
tipo simplesmente não exibe seção de atributos — não é erro.

**Troca de tipo de item com atributos preenchidos.** Ao trocar o tipo de um material que já tem
valores gravados, o sistema **pergunta antes de salvar**: descartar os valores que não pertencem ao
tipo novo, ou mantê-los gravados (ocultos, recuperáveis se o tipo original for restaurado). Nenhuma
das duas ações acontece em silêncio. O diálogo só aparece quando há valores preenchidos que ficariam
órfãos — trocar o tipo de um material sem preenchimento não pergunta nada.

**Atributo inativado.** Some do formulário de materiais novos, mas valores já gravados continuam
sendo exibidos na lista e na edição, marcados como inativos — mesmo padrão de `status` do resto do
sistema (categorias, tipos de item, tipos de documento do RH).

**Exclusão.** Excluir um tipo de item já apaga seus atributos em cascata (FK). Excluir um atributo
que já tem valores gravados é **recusado** com orientação para inativar — a regra do projeto é que
mudanças destrutivas em dado de produção exigem decisão explícita, nunca efeito colateral.

**Duplicidade.** `fieldName` é único por tipo de item (`uk_cotattr_tipo_nome`); a colisão retorna
409 com mensagem amigável, aproveitando o tratamento de `SQLSTATE 23000` que já existe no CRUD
genérico desde a v1.35.0.

## 8. Testes e validação

O ambiente local não tem banco (sem `pdo_mysql`, sem MySQL), então a verificação automatizada cobre
o que independe de banco, e o resto vira roteiro de servidor.

**Automatizado** (entra em `scripts/tests/`, rodado por `run-all.sh`):
- `php -l api/index.php` e `node --check app.js` (estáticos já existentes).
- Teste de função pura no harness PHP: parse de `options` (separador `;`, espaços, item vazio),
  validação de obrigatório e validação de valor fora da lista de `Seleção`.
- O guarda `test_privacy_coverage.js` já existente continua valendo — se um atributo Moeda for
  renderizado em contexto errado, ele acusa.

**Roteiro de validação no servidor** (após deploy e migration):
1. Criar em Instalações Elétricas o tipo "Cabo" com atributos: cor (Seleção: azul; vermelho; verde;
   preto; branco), bitola (Seleção: 1,5mm²; 2,5mm²; 4mm²; 6mm²) e isolação (Texto, opcional).
2. Criar um material do tipo Cabo — os três campos devem aparecer; deixar cor vazia deve bloquear.
3. Criar um segundo material igual mudando só a cor; a lista deve distinguir os dois.
4. Inativar o atributo isolação — some do formulário novo, permanece nos materiais que já o tinham.
5. Trocar o tipo de um material preenchido para "Eletroduto" — o diálogo de decisão deve aparecer;
   testar as duas respostas.
6. Tentar excluir um atributo com valores gravados — deve recusar e orientar a inativar.
7. Tentar criar dois atributos com o mesmo nome no mesmo tipo — deve dar 409 amigável.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Formulário de material fica pesado com muitos atributos | Cadastro é do usuário; a UI mantém os atributos numa seção própria, colapsável se passar de ~6 campos |
| Atributos cadastrados de forma inconsistente entre disciplinas (ex.: "cor" e "Cor") | `fieldName` único por tipo já evita duplicata dentro do tipo; padronização entre tipos é decisão de uso, não de código |
| Regressão em telas estáveis (lista e formulário de cotação por material) | Alcance limitado a duas telas; nenhuma mudança em `cotacao_itens`, no fluxo de importação de arquivo ou no consolidado/financeiro |
| Migration não rodada em produção | Função `ensure_cotacao_atributos_tables()` cria as tabelas em runtime (auto-cura), como todo o resto do sistema |

## 10. Fase 2 (contexto, não faz parte desta spec)

Depois desta fase validada no servidor, a Fase 2 fará a importação inteligente **dentro** da
cotação: botão de importar PDF na própria cotação de Instalações Elétricas → `pdftotext` extrai o
texto → um modelo local (maior que o `llama3.2:3b` atual) devolve JSON estruturado com uma linha por
variação, contendo descrição, quantidade, unidade, valor unitário, valor total **e os atributos
cadastrados nesta Fase 1** → tela de conferência onde o usuário revisa e corrige antes de gravar.

**Porte do modelo — decidido em 2026-07-28: faixa 7B.** Candidato principal
`qwen2.5:7b-instruct` (bom em português e em devolver JSON válido), a confirmar contra o hardware
real. Duas consequências que a spec da Fase 2 terá de absorver:

1. **Memória.** Um 7B quantizado (Q4) ocupa cerca de 4,5 GB só de pesos, mais o cache de contexto —
   na prática exige uns 6 GB livres. Se o servidor não tiver essa folga, o modelo entra em swap e a
   extração fica inutilizável. **Pendência de levantamento:** RAM livre e presença de GPU no
   servidor (`free -h` e `nvidia-smi`).
2. **A extração tem de ser assíncrona.** Em CPU, um 7B gera na ordem de 5–15 tokens/s; uma cotação
   com algumas dezenas de itens em JSON pode levar minutos. Uma requisição HTTP síncrona estouraria
   o timeout. O fluxo deve seguir o padrão de worker que o projeto já usa em
   `scripts/ia_depara_worker.php` — enfileira o job, dispara o worker em background com `nohup`, e a
   tela faz polling de status, exatamente como o de-para e o comparador já fazem hoje.

Pontos que a spec da Fase 2 terá de decidir e que **não** estão decididos aqui: se cada variação
vira uma `cotacoes` separada ou um material com múltiplas linhas; como sinalizar baixa confiança da
extração para o revisor; e o que acontece com o fluxo de importação por arquivo que já existe na aba
"Importação de arquivos" — convive, é substituído ou passa a chamar o mesmo motor.
