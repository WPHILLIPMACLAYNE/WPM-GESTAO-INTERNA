# Fluxograma — Módulo `src/core`

## Bootstrap Geral

```mermaid
flowchart TD
  A[index.html] --> B[env-bootstrap.js]
  B --> C[window.__APP_ENV__ defaults]
  C --> D{runtime local?}
  D -- sim --> E[carrega env.js]
  D -- nao --> F[segue sem env.js]
  E --> G[config.js]
  F --> G[config.js]
  G --> H[modulos core/domain/features/ui]
  H --> I[main.js]
  I --> J[exposeAppInternals]
  J --> K[DOMContentLoaded]
  K --> L[initializeApp]
  L --> M[hydrateStorageCache]
  M --> N[syncAppState]
  N --> O[bindings UI]
  O --> P[renderAll]
  P --> Q[syncPeriodControls]
  Q --> R[runSystemDiagnostics]
  R --> S[app pronto]
```

## Persistência e Sincronização

```mermaid
flowchart TD
  A[mutacao de estado] --> B[saveData]
  B --> C[storage.periods[currentPeriodKey] = state]
  C --> D[saveStore]
  D --> E[prepareStoreCandidate]
  E --> F[persistStoredJson STORAGE_KEY]
  F --> G{IndexedDB disponivel?}
  G -- sim --> H[idbSetValue]
  H --> I[atualiza cache Map]
  I --> J[espelha localStorage]
  G -- nao --> K[localStorage primario]
  J --> L[remove legacy keys]
  K --> L
  L --> M{broadcast habilitado?}
  M -- sim --> N[emitStorageBroadcast]
  M -- nao --> O[continua]
  N --> P{Supabase autenticado e writable?}
  O --> P
  P -- sim --> Q[queueSupabaseStoreSync]
  P -- nao --> R[retorna salvo local]
  Q --> S{evento critico?}
  S -- sim --> T[saveStoreToSupabase imediato]
  S -- nao --> U[sync remoto debounced]
```

## Ciclo Mensal

```mermaid
flowchart TD
  A[closePeriod] --> B{periodo atual writable?}
  B -- nao --> C[toast bloqueio]
  B -- sim --> D[confirmar fechamento]
  D --> E[getCommittedStoreSnapshot]
  E --> F[buildMonthArchivePayload]
  F --> G[download fechamento JSON]
  G --> H[storage.archives[currentPeriodKey] = archive]
  H --> I[nextKey = getNextPeriodKey]
  I --> J{proximo mes tem dados?}
  J -- sim --> K[confirmar zerar ou preservar]
  J -- nao --> L[criar/resetar proximo periodo]
  K --> L
  L --> M[saveData]
  M --> N{salvou?}
  N -- nao --> O[rollback archive + toast erro]
  N -- sim --> P[switchPeriod nextKey]
  P --> Q[toast sucesso]
```

## Supabase Local-First

```mermaid
flowchart TD
  A[getSupabaseClient] --> B{env + SDK presentes?}
  B -- nao --> C[estado offline/local]
  B -- sim --> D[createClient singleton]
  D --> E[bind auth listener]
  E --> F[refreshSupabaseBackendState]
  F --> G[session + memberships]
  G --> H[selectActiveSupabaseMembership]
  H --> I{role admin/gestor?}
  I -- sim --> J[writable true]
  I -- nao --> K[writable false]
  J --> L[loadStoreFromSupabase ou saveStoreToSupabase]
  K --> M[modo somente leitura]
```
