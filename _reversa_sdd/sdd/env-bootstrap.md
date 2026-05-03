# Env Bootstrap

## Visão Geral

🟢 O Env Bootstrap é o contrato de ambiente runtime do frontend. Ele garante que `window.__APP_ENV__` exista com defaults seguros antes de `src/core/config.js`, `src/core/supabase.js` e `src/core/observability.js`.

🟢 Em runtime local (`file:`, `localhost`, `127.0.0.1`, `[::1]`), ele tenta carregar `env.js` como override público opcional. Em deploy remoto, ele não requisita `env.js`.

## Responsabilidades

- 🟢 Inicializar `window.__APP_ENV__` com todas as chaves públicas suportadas e valor default `null`.
- 🟢 Preservar valores pré-existentes em `window.__APP_ENV__` usando `Object.assign`.
- 🟢 Detectar runtime local por protocolo `file:` ou host local.
- 🟢 Carregar `env.js` apenas em runtime local.
- 🟢 Usar `document.write` quando o script atual ainda está em `document.readyState === 'loading'`.
- 🟢 Usar injeção de `<script src="env.js">` no `document.head` quando o documento já não está em loading.
- 🟢 Evitar requisições 404 de `env.js` em GitHub Pages/Vercel/deploy remoto.
- 🟢 Permitir que o app funcione local-first quando nenhuma variável pública está configurada.

## Interface

### Chaves de ambiente

| Chave | Tipo | Uso | Default |
|---|---|---|---|
| `SUPABASE_URL` | string|null | URL pública do projeto Supabase. | `null` |
| `SUPABASE_ANON_KEY` | string|null | Chave anônima/publishable do Supabase browser client. | `null` |
| `SUPABASE_UNIT_SLUG` | string|null | Unidade preferida quando há múltiplos vínculos. | `null` |
| `SENTRY_DSN` | string|null | DSN público do Sentry frontend. | `null` |
| `SENTRY_ENVIRONMENT` | string|null | Ambiente Sentry. | `null` |
| `SENTRY_RELEASE` | string|null | Release Sentry explícita. | `null` |
| `APP_COMMIT` | string|null | SHA público do deploy. | `null` |
| `APP_BUILD_TIME` | string|null | Timestamp público do build/deploy. | `null` |
| `APP_RUNTIME_OVERRIDE` | string|null | Override `development` ou `production`. | `null` |

### Entradas

| Entrada | Tipo | Origem | Regra |
|---|---|---|---|
| `window.__APP_ENV__` pré-existente | object | testes, env anterior, script externo | Deve ser preservado e mesclado. 🟢 |
| `window.location.protocol` | string | navegador | `file:` habilita carregamento local de `env.js`. 🟢 |
| `window.location.hostname` | string | navegador | `localhost`, `127.0.0.1`, `[::1]` habilitam `env.js`. 🟢 |
| `env.js` | script local gitignored/gerado | setup local/CI | Deve conter apenas valores públicos browser-safe. 🟢 |

### Saídas

| Saída | Tipo | Consumidor |
|---|---|---|
| `window.__APP_ENV__` | object | `config.js`, `supabase.js`, `observability.js`, testes |
| `<script src="env.js">` | elemento/script document.write | runtime local |
| defaults seguros | valores `null` | fallback local-first |

## Regras de Negócio

- 🟢 `window.__APP_ENV__` deve existir antes de `config.js`.
- 🟢 Valores já definidos em `window.__APP_ENV__` não devem ser descartados.
- 🟢 `env.js` só deve ser carregado em runtimes locais.
- 🟢 Em deploy remoto, `env.js` não deve ser requisitado.
- 🟢 Se `SUPABASE_URL` ou `SUPABASE_ANON_KEY` estiverem ausentes, o app deve continuar em modo local-first.
- 🟢 `SUPABASE_UNIT_SLUG` é opcional e apenas influencia a escolha de unidade ativa.
- 🟢 `SENTRY_DSN` ausente deve resultar em observabilidade Sentry no-op.
- 🟢 `APP_RUNTIME_OVERRIDE` só deve aceitar `development` ou `production` em `config.js`; outros valores caem no autodetect.
- 🟢 `env.example.js` deve servir como template commitado.
- 🟢 `env.js` deve permanecer não commitado e nunca conter credenciais privadas.
- 🔴 Não há validação criptográfica ou schema runtime das chaves em `env-bootstrap.js`; validações são por consumidores.

## Fluxo Principal

1. 🟢 `index.html` carrega `src/core/env-bootstrap.js` antes dos demais scripts locais.
2. 🟢 A IIFE `bootstrapRuntimeEnv()` executa imediatamente.
3. 🟢 O bootstrap cria/mescla `window.__APP_ENV__` com as nove chaves públicas suportadas.
4. 🟢 O bootstrap calcula `isLocalRuntime` a partir de protocolo e hostname.
5. 🟢 Se não for runtime local, o script retorna sem carregar `env.js`.
6. 🟢 Se for local e o documento ainda estiver carregando, usa `document.write('<script src="env.js"><\\/script>')`.
7. 🟢 Se for local e o documento já não estiver carregando, cria script síncrono e adiciona ao `document.head`.
8. 🟢 Consumidores posteriores leem `window.__APP_ENV__` com defaults já definidos.

## Fluxos Alternativos

- **Deploy remoto sem env.js:** 🟢 O bootstrap não requisita `env.js`; o app segue com defaults e sem ruído de 404.
- **Dev local com env.js ausente:** 🟡 O navegador pode tentar carregar `env.js` e falhar, mas `window.__APP_ENV__` já existe com defaults.
- **Dev local com env.js existente:** 🟢 `env.js` sobrescreve valores públicos por `Object.assign`.
- **Teste com `appEnv`:** 🟢 O helper de teste injeta `window.__APP_ENV__` e valida defaults/overrides.
- **CI/Vercel com variáveis públicas:** 🟢 `Scripts/generate-env.mjs` gera `env.js` a partir de `process.env`; uso remoto depende do pipeline servir esse arquivo quando desejado.

## Dependências

- `index.html` — deve carregar o bootstrap antes de `config.js`.
- `env.example.js` — documenta contrato e regras de segurança.
- `env.js` — override local/gerado e gitignored.
- `Scripts/setup-env.mjs` — cria `env.js` a partir do template se ausente.
- `Scripts/generate-env.mjs` — gera `env.js` a partir de variáveis públicas de processo.
- `src/core/config.js` — consome `APP_COMMIT`, `APP_BUILD_TIME` e `APP_RUNTIME_OVERRIDE`.
- `src/core/supabase.js` — consome `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_UNIT_SLUG`.
- `src/core/observability.js` — consome `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`.
- `tests/unit/runtime-env.test.js` — cobre contrato de defaults, overrides e consumidores.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Segurança | Apenas variáveis públicas browser-safe devem entrar em `env.js`. | `env.example.js`, `Scripts/generate-env.mjs` | 🟢 |
| Segurança | Credenciais privadas como service role e tokens de servidor são proibidas no browser env. | `env.example.js`, `Scripts/generate-env.mjs` | 🟢 |
| Disponibilidade | Ausência de env remoto não pode quebrar bootstrap; defaults `null` mantêm app local-first. | `src/core/env-bootstrap.js`, `src/core/supabase.js` | 🟢 |
| Operabilidade | Deploy remoto não deve requisitar `env.js` automaticamente. | `src/core/env-bootstrap.js`, README | 🟢 |
| Testabilidade | Contrato de env deve ser injetável por testes sem arquivo externo. | `tests/helpers/load-real-app.js`, `tests/unit/runtime-env.test.js` | 🟢 |

> Inferido a partir do código. Validar com equipe de operações antes de expor novas chaves públicas.

## Critérios de Aceitação

```gherkin
Dado que o app carrega sem env.js
Quando src/core/env-bootstrap.js executa
Então window.__APP_ENV__ deve existir
E todas as chaves públicas suportadas devem existir com valor null

Dado que window.__APP_ENV__ já possui APP_COMMIT definido
Quando src/core/env-bootstrap.js executa
Então APP_COMMIT deve ser preservado no objeto resultante

Dado que o app roda em GitHub Pages ou outro host remoto
Quando src/core/env-bootstrap.js executa
Então env.js não deve ser requisitado automaticamente

Dado que o app roda em localhost
Quando src/core/env-bootstrap.js executa durante o loading do documento
Então env.js deve ser carregado via document.write

Dado que o app roda localmente após o loading do documento
Quando src/core/env-bootstrap.js executa
Então um script env.js deve ser adicionado ao document.head com async=false

Dado que SUPABASE_URL e SUPABASE_ANON_KEY estão null
Quando src/core/supabase.js avalia o ambiente
Então o backend deve ficar offline/local sem interromper o app
```

## Cenários de Borda

- 🟢 **`file://` local:** deve carregar `env.js`, pois é considerado runtime local.
- 🟢 **IPv6 loopback `[::1]`:** deve carregar `env.js`.
- 🟡 **`env.js` ausente em dev:** defaults já existem, mas a requisição local pode falhar; comportamento aceitável.
- 🟢 **`APP_RUNTIME_OVERRIDE` inválido:** `config.js` ignora e autodetecta runtime.
- 🟢 **Sentry DSN ausente:** `observability.js` deve operar como no-op silencioso.
- 🔴 **Nova chave pública futura:** precisa ser adicionada em `env-bootstrap.js`, `env.example.js`, `Scripts/generate-env.mjs` e testes.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Criar defaults seguros em `window.__APP_ENV__` | Must | Consumidores posteriores dependem do objeto. |
| Preservar valores existentes | Must | Necessário para testes, env gerado e overrides. |
| Não requisitar `env.js` em deploy remoto | Must | Evita 404 e ruído de bootstrap. |
| Carregar `env.js` em runtime local | Should | Facilita desenvolvimento e Supabase local. |
| Restringir chaves a valores públicos | Must | Regra de segurança explícita. |
| Suportar metadata de release | Should | Importante para observabilidade e painel de settings. |
| Suportar `APP_RUNTIME_OVERRIDE` | Could | Útil em testes/preview, mas há autodetect. |

> Prioridade inferida por posição no bootstrap e dependência de Supabase/Sentry/config.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `src/core/env-bootstrap.js` | `bootstrapRuntimeEnv` | 🟢 |
| `env.example.js` | template de contrato público | 🟢 |
| `Scripts/setup-env.mjs` | criação local de `env.js` | 🟢 |
| `Scripts/generate-env.mjs` | geração CI/Vercel de `env.js` | 🟢 |
| `src/core/config.js` | consumo de `APP_COMMIT`, `APP_BUILD_TIME`, `APP_RUNTIME_OVERRIDE` | 🟢 |
| `src/core/supabase.js` | consumo de Supabase env | 🟢 |
| `src/core/observability.js` | consumo de Sentry env | 🟢 |
| `tests/unit/runtime-env.test.js` | testes do contrato runtime | 🟢 |
| `tests/helpers/load-real-app.js` | injeção de env em testes | 🟢 |
| `README.md` | documentação operacional do env | 🟢 |
