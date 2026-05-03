# Architect — Spec Impact Matrix

Gerado em: 2026-05-02T17:46:12Z

| Especificacao / Regra | Core | Domain | Features | UI | Supabase | Tests |
|---|---|---|---|---|---|---|
| App inicia browser-only com fallback local | `env-bootstrap`, `main`, `storage` | - | - | render inicial | - | unit/integration |
| Store versionado `STORE_VERSION = 4` | `schema`, `backup` | - | - | settings diagnostics | import payload | unit |
| Periodo mensal `YYYY-MM` | `lifecycle`, `period-builder` | historico/KPIs | forms validam data | period controls | `periods` | unit/e2e |
| Fechamento bloqueia edicao | `archives`, lock sets | selectors respeitam estado | mutacoes chamam assert | controles disabled | `close_period_transaction` | e2e/unit |
| Reset gera backup antes | `backup`, `lifecycle` | - | diagnostics | settings action | `reset_period_transaction` | unit/e2e |
| Atendimentos/alunos | `normalizeData` | resumo recepcionistas | forms/crud | students UI | `student_attendances` | unit/e2e |
| Pendencias Kanban | `normalizeData` | resumo/filtros | forms/crud | pending UI/events | `pending_items` | unit/e2e |
| Addons por pessoa/tipo/dia | `normalizeData` | totais/ranking | student-addon link | addons UI | `addon_types`, `addon_sales` | unit/e2e |
| NPS e tendencias | `normalizeData` | ranking NPS | nps actions | nps render/events | `nps_period_metrics`, `nps_mentions` | unit/visual |
| Escala com turnos | `normalizeData` | resumo escala | forms | scale UI | `scale_days`, `scale_professor_shifts` | e2e/visual |
| Eventos/calendario | `normalizeData` | resumo eventos | forms/crud | events UI | `events` | e2e/visual |
| Recados | legacy migration/storage | dashboard | - | recados UI | `shift_notes` | unit/e2e |
| Supabase Auth e memberships | `supabase` | - | diagnostics | settings backend panel | `users`, `unit_members`, RLS | unit |
| Sync guardada por checkpoint | `supabase`, `backup` | - | diagnostics | settings sync actions | RPC checkpoint/import | unit |
| PWA/cache/update | `pwa`, `sw.js` | - | - | update UX | - | e2e service-worker |
| CSP/seguranca app shell | `index.html`, env | - | - | runtime sem inline | headers deploy | CI/smoke |
| Release smoke/observabilidade | `observability` | - | diagnostics | settings/deploy smoke | - | Playwright/GitHub Actions |

## Areas de Alto Impacto

| Componente | Specs afetadas | Risco de mudanca |
|---|---|---|
| `src/core/schema.js` | Store inteiro, import, Supabase, testes | Alto |
| `src/core/storage.js` | Persistencia, fallback, sync cross-tab | Alto |
| `src/core/lifecycle.js` | Fechamento, reset, lock, periodos | Alto |
| `src/core/supabase.js` | Auth, RBAC, sync, conflito, mapeamento remoto | Alto |
| `supabase/migrations/*` | Modelo remoto, RLS, RPCs, auditoria | Alto |
| `index.html` | Ordem de scripts, CSP, CDNs | Alto |
| `src/ui/render-*` | UX operacional e snapshots visuais | Medio/Alto |
| `sw.js` | Cache, offline e releases | Medio/Alto |
