# Fluxograma — Módulo `supabase`

```mermaid
flowchart TD
  A[Auth user] --> B[handle_auth_user_created]
  B --> C[public.users]
  C --> D[unit_members]
  D --> E{has_unit_role}
  E --> F[RLS por unidade]
  F --> G[Tabelas operacionais por period_id]
  G --> H[RPCs transacionais]
  H --> I[audit_events]

  J[App local] --> K[src/core/supabase.js]
  K --> L[RPC import/close/reset/link]
  L --> E
  L --> G
```

## Evidências

- `20260422190000_backend_canonical_schema.sql`: schema, RLS, triggers e policies.
- `20260422194000_backend_transaction_rpcs.sql`: RPCs transacionais.
- `20260423090000_sync_checkpoint_guard.sql`: guard de sincronização.
