# Architect — C4 Componentes

Gerado em: 2026-05-02T17:46:12Z

## Componentes do Core SPA

```mermaid
flowchart LR
  env["env-bootstrap"]
  config["config/global state"]
  schema["schema/migrations"]
  storage["storage adapter"]
  backup["backup/import"]
  lifecycle["monthly lifecycle"]
  supabase["supabase adapter"]
  pwa["pwa/service worker"]
  obs["observability"]
  main["main/bootstrap"]

  env --> config --> main
  main --> storage
  main --> schema
  main --> lifecycle
  lifecycle --> backup
  backup --> schema
  backup --> storage
  storage --> supabase
  supabase --> backup
  pwa --> main
  obs --> main
```

## Componentes de Produto

```mermaid
flowchart TB
  selectors["domain/selectors\nKPIs e rankings"]
  forms["features/forms\nvalidacoes e builders"]
  crud["features/crud\nmutacoes genericas"]
  nps["features/nps\nranking e mencoes"]
  csv["features/csv\nexportacoes"]
  diagnostics["features/diagnostics\nsmoke e migracao"]
  render["ui/render-*\nDOM por dominio"]
  events["ui/events-*\nhandlers e acessibilidade"]
  helpers["utils/helpers\nsanitize, datas, CSV"]

  render --> selectors
  events --> forms
  events --> crud
  events --> nps
  events --> diagnostics
  csv --> helpers
  forms --> helpers
  selectors --> helpers
```

## Componentes Supabase

```mermaid
flowchart TB
  auth["auth.users"]
  profile["public.users"]
  membership["unit_members + RBAC"]
  periods["periods + period_settings"]
  operational["operational tables\nstudents, pending, addons, notes, nps, scale, events"]
  audit["audit_events"]
  rls["RLS policies"]
  rpc["RPCs transacionais"]
  checkpoint["checkpoint guard"]

  auth --> profile
  profile --> membership
  membership --> periods
  periods --> operational
  operational --> audit
  rls --> membership
  rls --> periods
  rls --> operational
  rpc --> periods
  rpc --> operational
  checkpoint --> rpc
```

## Componentes Criticos

| Componente | Motivo |
|---|---|
| `src/core/storage.js` | Sem ele nao ha continuidade local, fallback nem sync cross-tab. |
| `src/core/schema.js` | Define compatibilidade e saneamento do store. |
| `src/core/lifecycle.js` | Governa fechamento, reset e bloqueio do mes. |
| `src/core/supabase.js` | Ponte local-remoto e controle de conflito. |
| `supabase/migrations/*` | Contrato remoto canonico, RLS e RPCs. |
| `index.html` | Ordem de scripts e CSP sao contrato de runtime. |
| `sw.js` | Cache/update pode preservar ou quebrar releases. |
