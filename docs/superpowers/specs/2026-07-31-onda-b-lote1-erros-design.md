# Spec — Onda B, Lote 1: E3 (toast com severidade) + E4 (código de correlação)

> **Data:** 2026-07-31 · **Origem:** estudo `docs/estudos/2026-07-estudo-benchmark-modulos.md`
> (itens E3 e E4, Onda B) · **Decisões do dono nesta sessão:** E3 só Fase 1 (saveForm);
> código de correlação em **UUID completo**; abordagem A + A (toast hospedado no modal +
> helper puro com edição mecânica dos pontos de 500).

## Objetivo

1. **E3 (Fase 1):** substituir os `alert()` do `saveForm` (`app.js:8964`) por `showToast`
   com severidade — o toast atual (`app.js:19712`) não tem severidade e ficaria invisível
   atrás do modal do formulário (`recordDialog` abre com `showModal()`, `app.js:7838`).
2. **E4:** todo erro **500** passa a exibir um código de correlação (UUID v4 gerado no
   **servidor**) na mensagem ao usuário, e o mesmo código vai para o `error_log` — permite
   ligar a reclamação do usuário à linha exata do log. Nunca reutilizar UUID vindo do cliente.

Fora de escopo (deliberado): os demais ~265 `alert()` do app (Fase 2 do E3, opcional no
estudo); catálogo de mensagens acionáveis (E8); log estruturado (E5); mensagens 4xx.

## E3 — Frontend (`app.js` + `styles.css`)

### `showToast(message, opts)` — assinatura retrocompatível

- `opts` **número** → duração em ms, severidade `info` (compatível com todas as chamadas atuais).
- `opts` **objeto** → `{ severity = "info", duration }`.
- Severidades e defaults (função **pura** `toastConfig(severity)`, testável isolada):

| severity | classe CSS | role | duração default |
|---|---|---|---|
| `info` | `app-toast` (visual atual) | `status` | 2000 |
| `success` | `app-toast toast-success` | `status` | 2000 |
| `warning` | `app-toast toast-warning` | `alert` | 4000 |
| `error` | `app-toast toast-error` | `alert` | 6000 |

- Cores via tokens existentes (`--green`, âmbar do F1, vermelho de erro) — dark theme
  resolve sozinho. Sem ícones; o conteúdo continua `textContent` + `maskMoneyText`
  (privacidade intacta — o teste-guarda `test_privacy_coverage.js` já vigia).
- **Clicar no toast fecha na hora** (qualquer severidade).
- **Host:** último `dialog:modal` aberto (`[...document.querySelectorAll("dialog:modal")].at(-1)`)
  ou `document.body`. Filho do modal no top layer pinta **acima** dele; `position: fixed`
  mantém a posição na tela. Se o modal fechar antes da duração, o toast morre junto — aceito.

### `saveForm`

- As 10 mensagens de validação (`validation.message`, `kanbanError`, `viabilityError`,
  checagens de usuário/plugin/CPF/senha/admin) → `showToast(msg, { severity: "warning" })`.
- O catch de gravação (`Não foi possível salvar: ...`, `app.js:9100`) →
  `showToast(msg, { severity: "error" })`.
- `confirm()`/`prompt()`/`confirmPasswordChange()` **não mudam** (são decisões, não avisos).

### Carona (1 linha)

- `reportGlobalError` (E1) passa a chamar o toast com `{ severity: "error" }`.

## E4 — Backend (`api/index.php`)

### Helpers (no topo do arquivo, antes do roteamento — lição das constantes v1.14.0)

- `obra_error_ref(): string` — UUID v4 de `random_bytes(16)` (bits de versão/variant
  ajustados), memoizado em `static`: **todas** as chamadas do mesmo request devolvem o
  mesmo UUID. Não lê nada do cliente.
- `apply_error_ref(string $message, int $status): string` — **pura**: `$status >= 500` →
  `"$message (código: <uuid>)"`; senão devolve `$message` intacta.

### Pontos de aplicação (edição mecânica)

1. `fail()` (`api/index.php:1836`): mensagem via `apply_error_ref` + campo `errorRef`
   no JSON quando ≥500 (disponível para uso futuro do front; hoje o front só exibe a mensagem).
2. As **11 funções `*_respond`** de módulo (idênticas — `agenda_respond:1008`,
   `clients_module_respond:1050`, `payable_respond:1108`, `cotacao_respond:3457`,
   `cost_centers_respond:5279`, `viabilidade_respond:5625`, `cash_moves_respond:6038`,
   `company_settings_respond:6151`, `poi_respond:6343`, `wbe_respond:6563`,
   `sinapi_module_respond:12836`): 1 linha cada — `$message = apply_error_ref($message, $status);`
   antes do `json_encode`.
3. Os `error_log` dos **catches que terminam em resposta 500** (~17 pontos, incluindo o
   catch global `api/index.php:927`): prefixo vira `[ObraSync …][ref <uuid>]` via
   `obra_error_ref()`. `error_log` informativos de automação (que não respondem 500)
   ficam como estão.

Exemplo do resultado:

```
Usuário:   Erro interno no servidor. Tente novamente ou contate o administrador.
           (código: 550e8400-e29b-41d4-a716-446655440000)
error_log: [ObraSync API][ref 550e8400-e29b-41d4-a716-446655440000] SQLSTATE[42S02] ...
           em /var/www/financeiro/api/index.php:1234
```

## Testes

- `scripts/tests/php/test_error_ref.php` (molde `test_sql_error_response.php`):
  `apply_error_ref` só anexa em ≥500 (499 não, 500/503 sim); formato UUID v4;
  `obra_error_ref()` estável dentro do request (duas chamadas = mesmo valor).
- `scripts/tests/js/test_toast_severity.js` (molde `vm` do `test_error_handler.js`):
  `toastConfig` mapeia severidade→classe/role/duração; compat com 2º argumento numérico;
  **guarda**: não existe mais `alert(` dentro do corpo de `saveForm`.
- Ambos entram no `scripts/tests/run-all.sh`.

## Versão e validação da etapa

- Sem migration, sem mudança de schema, sem endpoint novo.
- `APP_VERSION` → `v1.40.0`; `?v=` 1809→1810 em `index.html`; changelog em
  `README.md`/`CLAUDE.md`/`STATUS.md`.
- **Validação em produção (roteiro do dono):** abrir um cadastro, salvar com campo
  inválido → toast âmbar **acima do modal**; salvar válido → gravação normal.
  E4: conferir no próximo 500 real que a mensagem traz o código e que
  `grep <código> /var/lib/financeiro/logs/php-error.log` acha a linha — **não** forçar
  500 artificial em produção.
