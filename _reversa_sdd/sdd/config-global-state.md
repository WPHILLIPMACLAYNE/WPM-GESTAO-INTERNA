# Config e Estado Global

## Visão Geral

🟢 `src/core/config.js` define constantes de versão, chaves de persistência, defaults de negócio, helpers DOM, helpers de data local e variáveis globais raiz do aplicativo.

🟢 O arquivo é carregado via script clássico antes da maioria dos módulos e estabelece o contrato compartilhado por storage, schema, lifecycle, backup, Supabase, selectors, features, UI e testes.

## Responsabilidades

- 🟢 Definir chaves atuais e legadas de storage local.
- 🟢 Definir `STORE_VERSION = 4` e `APP_VERSION = 'v34'`.
- 🟢 Resolver `APP_COMMIT`, `APP_BUILD_TIME`, `APP_RELEASE_LABEL` e `APP_RUNTIME` a partir de `window.__APP_ENV__`.
- 🟢 Definir se meses devem iniciar com massa de teste em desenvolvimento.
- 🟢 Declarar nomes de meses em português.
- 🟢 Declarar `IDB_NAME` e `IDB_STORE_NAME` usados pela persistência IndexedDB.
- 🟢 Expor helper `DOM` para leitura/escrita simples em elementos por ID.
- 🟢 Definir `APP_DEFAULTS` para recepcionistas, professores, addons, nomes, pendências, eventos, escala e notas.
- 🟢 Definir `APP_STORE_PREFERENCE_DEFAULTS`.
- 🟢 Fornecer helpers de data local sem drift UTC.
- 🟢 Declarar variáveis globais `storage`, `currentPeriodKey` e `state`.
- 🟢 Declarar IDs globais de edição para aluno, pendência, escala e evento.

## Interface

### Constantes de versão e armazenamento

| Nome | Tipo | Valor/Regra | Consumidores |
|---|---|---|---|
| `STORAGE_KEY` | string | `recepcao-smartfit-dashboard-v34` | backup, storage, diagnostics, testes |
| `STORAGE_BROADCAST_KEY` | string | `recepcao-smartfit-dashboard-sync-v34` | storage cross-tab |
| `STORE_VERSION` | number | `4` | schema, backup, Supabase, testes |
| `LEGACY_STORAGE_KEYS` | string[] | v33 e v24 | migração/fallback |
| `APP_VERSION` | string | `v34` | UI, backup, Supabase payload, release |
| `LOCAL_SNAPSHOT_KEY` | string | snapshot v34 | backup/settings |
| `SYSTEM_REPORT_KEY` | string | report v34 | diagnostics |
| `FLOW_TEST_REPORT_KEY` | string | flowtests v34 | diagnostics |
| `MIGRATION_DRY_RUN_REPORT_KEY` | string | migration dry-run v34 | diagnostics |
| `UI_KEY` | string | UI state v34 | filtros/estado visual |
| `IDB_NAME` | string | `wpm-gestao-interna-db` | storage |
| `IDB_STORE_NAME` | string | `app_kv` | storage |

### Constantes de runtime

| Nome | Tipo | Regra |
|---|---|---|
| `APP_COMMIT` | string | `window.__APP_ENV__.APP_COMMIT` limpo ou `local` |
| `APP_BUILD_TIME` | string|null | `window.__APP_ENV__.APP_BUILD_TIME` limpo ou `null` |
| `APP_RELEASE_LABEL` | string | `v34` ou `v34 (<7 chars commit>)` |
| `APP_RUNTIME` | string | override válido `development/production`; senão localhost HTTP(S) vira development; fallback production |
| `DEFAULT_INITIALIZE_MONTHS_WITH_TEST_DATA` | boolean | `APP_RUNTIME === 'development'` |

### Helper DOM

| Método | Entrada | Saída | Regra |
|---|---|---|---|
| `DOM.byId(id)` | id string | `HTMLElement|null` | retorna `document.getElementById`. 🟢 |
| `DOM.html(id, markup)` | id e markup | elemento ou null | aplica `innerHTML` se existir. 🟢 |
| `DOM.text(id, value)` | id e texto | elemento ou null | aplica `textContent` se existir. 🟢 |
| `DOM.value(id, fallback)` | id e fallback | string | lê `.value`; se elemento ausente, fallback. 🟢 |
| `DOM.setValue(id, value)` | id e valor | elemento ou null | escreve `.value` se existir. 🟢 |

### Estado global raiz

| Nome | Tipo | Regra |
|---|---|---|
| `storage` | `AppStore` | store completo em memória, preenchido após bootstrap. 🟢 |
| `currentPeriodKey` | string | período ativo `YYYY-MM`. 🟢 |
| `state` | `PeriodData` | ponte para `storage.periods[currentPeriodKey]`. 🟢 |
| `editingStudentId` | string|null | ID em edição no modal de aluno. 🟢 |
| `editingPendingId` | string|null | ID em edição no modal de pendência. 🟢 |
| `editingScaleId` | string|null | ID em edição no modal de escala. 🟢 |
| `editingEventId` | string|null | ID em edição no modal de evento. 🟢 |

## Regras de Negócio

- 🟢 A versão canônica do store é `STORE_VERSION = 4`.
- 🟢 A versão humana do app é `APP_VERSION = 'v34'`.
- 🟢 Chaves legadas v33/v24 devem permanecer conhecidas para migração.
- 🟢 `APP_RUNTIME_OVERRIDE` só é aceito se for `development` ou `production`.
- 🟢 Runtime localhost via HTTP(S) deve ser tratado como `development`.
- 🟢 Falhas ao ler `window.__APP_ENV__` devem cair em valores seguros (`local`, `null`, `production`).
- 🟢 `DEFAULT_INITIALIZE_MONTHS_WITH_TEST_DATA` deve ser verdadeiro apenas em desenvolvimento.
- 🟢 Datas formatadas por `formatDateToLocalISO()` devem evitar drift UTC usando getters locais.
- 🟢 `todayISO()` deve fixar hora em 12:00 antes de aplicar offset.
- 🟢 `currentMonthDayISO()` deve fixar dia 1, depois aplicar o dia solicitado com mínimo 1.
- 🟢 `APP_DEFAULTS.receptionists`, `professors` e `addonTypes` devem preencher settings vazios em normalização/lifecycle.
- 🟢 `APP_STORE_PREFERENCE_DEFAULTS.initializeMonthsWithTestData` deriva do runtime.
- 🟢 `APP_DEFAULTS` deve ser tratado como massa seed/demo e defaults de bootstrap, não como configuração real de produção validada.

## Fluxo Principal

1. 🟢 `index.html` carrega `src/core/env-bootstrap.js`.
2. 🟢 `index.html` carrega `src/utils/helpers.js`.
3. 🟢 `index.html` carrega `src/core/config.js`.
4. 🟢 `config.js` define chaves de storage, versão e release.
5. 🟢 `config.js` calcula runtime e preferência default de seed.
6. 🟢 `config.js` declara `DOM` e `APP_DEFAULTS`.
7. 🟢 `config.js` declara helpers de data local.
8. 🟢 `config.js` declara `storage`, `currentPeriodKey`, `state` e IDs de edição.
9. 🟢 Módulos posteriores consomem esses símbolos globais.
10. 🟢 `src/main.js` expõe parte desse contrato em `window.__APP_INTERNALS__.config` para testes/diagnóstico.

## Fluxos Alternativos

- **`window.__APP_ENV__` indisponível:** 🟢 `APP_COMMIT` vira `local`, `APP_BUILD_TIME` vira `null` e runtime cai para `production`.
- **Override de runtime válido:** 🟢 `APP_RUNTIME_OVERRIDE = development|production` prevalece sobre autodetect.
- **Override inválido:** 🟢 valor é ignorado; o runtime é autodetectado por protocolo/hostname.
- **Elemento DOM ausente:** 🟢 métodos `DOM.*` retornam `null` ou fallback sem lançar erro.
- **Data com offset:** 🟢 `todayISO(offset)` ajusta o dia depois de fixar horário local em 12:00.

## Dependências

- `src/core/env-bootstrap.js` — deve definir `window.__APP_ENV__` antes do config.
- `document` e `window` — usados por helper DOM e runtime detection.
- Módulos consumidores:
  - `src/core/storage.js`
  - `src/core/schema.js`
  - `src/core/backup.js`
  - `src/core/lifecycle.js`
  - `src/core/supabase.js`
  - `src/core/observability.js`
  - `src/core/seed.js`
  - `src/domain/selectors.js`
  - `src/features/forms.js`
  - `src/ui/render-*`
  - `src/main.js`
- Testes `tests/unit/runtime-env.test.js`, `tests/unit/selectors-real.test.js`, `tests/e2e/*.spec.js`.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Compatibilidade | Expor constantes e estado como globais de script clássico. | `src/core/config.js`, `index.html` | 🟢 |
| Disponibilidade | Falhas ao ler env devem cair em defaults seguros. | `src/core/config.js` try/catch | 🟢 |
| Testabilidade | Contrato deve ser observável por `window.__APP_INTERNALS__.config`. | `src/main.js`, testes E2E/unit | 🟢 |
| Consistência temporal | Datas locais devem evitar drift UTC. | `formatDateToLocalISO`, `todayISO` | 🟢 |
| Migração | Chaves legadas devem continuar listadas. | `LEGACY_*_KEYS`, `backup.js`, `storage.js` | 🟢 |

> Inferido a partir do código. Validar nomes default de pessoas/tipos antes de usar como configuração oficial fora do ambiente atual.

## Critérios de Aceitação

```gherkin
Dado que APP_RUNTIME_OVERRIDE é "production"
Quando config.js executa
Então APP_RUNTIME deve ser "production"
E DEFAULT_INITIALIZE_MONTHS_WITH_TEST_DATA deve ser false

Dado que o app roda em localhost sem override
Quando config.js executa
Então APP_RUNTIME deve ser "development"
E DEFAULT_INITIALIZE_MONTHS_WITH_TEST_DATA deve ser true

Dado que window.__APP_ENV__.APP_COMMIT contém um SHA
Quando config.js executa
Então APP_COMMIT deve conter o SHA
E APP_RELEASE_LABEL deve conter v34 com os sete primeiros caracteres do commit

Dado que um elemento DOM existe com determinado id
Quando DOM.text(id, "valor") é chamado
Então o textContent do elemento deve ser atualizado

Dado que um elemento DOM não existe
Quando DOM.value(id, "fallback") é chamado
Então o retorno deve ser "fallback"

Dado que todayISO recebe offset 1
Quando a função executa
Então deve retornar uma data local ISO do dia seguinte sem conversão UTC direta
```

## Cenários de Borda

- 🟢 **Erro ao acessar `window.__APP_ENV__`:** runtime cai para defaults sem quebrar bootstrap.
- 🟢 **Hostname `::1` ou `[::1]`:** runtime é tratado como development quando protocolo é HTTP(S).
- 🟢 **Dia solicitado menor que 1 em `currentMonthDayISO`:** usa no mínimo dia 1.
- 🟡 **Listas APP_DEFAULTS alteradas:** seed, lifecycle, settings e testes podem mudar comportamento amplo.
- 🔴 **Incremento futuro de `STORE_VERSION`:** requer migração explícita correspondente em `schema.js`; o config apenas muda a constante.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Definir `STORE_VERSION` e chaves de storage | Must | Caminho crítico de persistência e migração. |
| Definir `storage`, `currentPeriodKey`, `state` | Must | Estado raiz usado por quase todos os módulos. |
| Calcular `APP_RUNTIME` | Must | Controla seed/defaults e observabilidade. |
| Expor `DOM` helper | Should | Usado por features/UI; há alternativas nativas, mas o código depende dele. |
| Manter `APP_DEFAULTS` | Must | Normalização e seed dependem desses defaults. |
| Manter chaves legadas | Should | Importante para migração/compatibilidade. |
| Metadata de release | Should | Importante para settings, logs e Sentry. |
| IDs globais de edição | Should | Necessários para modais atuais; poderiam ser encapsulados futuramente. |

> Prioridade inferida por frequência de chamada e posição na cadeia de dependências.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `src/core/config.js` | constantes, defaults, DOM helper, estado global | 🟢 |
| `src/main.js` | exposição em `APP_INTERNALS.config` | 🟢 |
| `src/core/schema.js` | consumo de `STORE_VERSION` | 🟢 |
| `src/core/storage.js` | consumo de chaves/IDB | 🟢 |
| `src/core/backup.js` | consumo de storage keys, version e datas | 🟢 |
| `src/core/lifecycle.js` | consumo de `APP_DEFAULTS`, `state`, `storage` | 🟢 |
| `src/core/seed.js` | consumo de `APP_DEFAULTS` | 🟢 |
| `src/features/forms.js` | consumo de IDs de edição e DOM helper | 🟢 |
| `src/ui/render-settings.js` | consumo de release/runtime/storage metadata | 🟢 |
| `tests/unit/runtime-env.test.js` | valida runtime, commit e build time | 🟢 |
| `tests/e2e/*.spec.js` | valida `APP_INTERNALS.config` | 🟢 |
