# CURRENT_STATUS

Snapshot date: 2026-05-03
Last updated: 2026-05-03 15:19:24 -03

## Live status

- Branch: `main`
- Verified base HEAD before pause checkpoint: `d8da0d5`
- Remote tracking branch: `origin/main`
- Local and remote state: aligned at `d8da0d5a7fd42be30e6bbedbe045fb3cc9a71cad`
- Homologated technical baseline: `191383e` (remote Supabase homologation)
- Latest published documentation checkpoint before this pause update: `d8da0d5` (`docs: atualiza estágio pós-homologação remota`)
- Baseline in production: Vercel alias `https://wpm-gestao-interna.vercel.app`
- Latest production deploy validated in this block: `dpl_3Qnt3pQX1kkE5889RvoxVLMELRMD`
- App version: `v34`
- Store version: `4`
- Runtime model: browser-only SPA with classic `<script>` files in fixed order
- Backend model: Supabase remote with local-first guarded sync and checkpoint protection
- Current operational stage: **remote Supabase migration homologated; ready for controlled production pilot**

## What is now complete

The former blocker chain was completed on 2026-05-03:

- Vercel production publishes browser-safe runtime env through generated `env.js`.
- Published app loads Supabase env for remote project `eautmpqkxibolmcfiacd`.
- Production unit was bootstrapped as `Smartfit Pampulha`.
- Runtime slug is `mgcpam2`.
- Remote admin is `smartwonkey@gmail.com`, display name `WPM`, role `admin`.
- Supabase Auth recovery redirects to `https://wpm-gestao-interna.vercel.app`.
- Password recovery flow works in the published app.
- Supabase SDK is vendored at `src/vendor/supabase-js-2.104.0.umd.js`, loaded locally before `src/core/supabase.js`, and precached by `sw.js`.
- Recovery mode no longer renders before the local store exists.
- Password was defined successfully from the latest recovery email.
- Admin login was confirmed in the published app.
- Dry-run reported `12 periodo(s) locais, backend remoto vazio, 0 divergencia(s)`.
- Assisted migration was executed once.
- Reload from backend completed with `Base remota carregada com sucesso`.
- Fonte ativa after reload: `Supabase`.
- Remote summary after reload: `12 periodo(s)`, `0 arquivo(s)`, `0 alunos`, `0 pendencias`, `0 eventos`, `0 recados`, `0 mencoes NPS`, `0 linhas addon`.
- Manual month navigation validated January through December.

## Current working reading

The project has crossed from backend enablement into a production-pilot stage.

Important interpretation:

- The remote structure, auth path, recovery path, dry-run, initial migration, and backend reload are approved.
- The migrated operational dataset is empty/zeroed, matching the local state observed during homologation.
- The remote database is usable as the canonical mirror for the current production unit.
- `Sincronizar agora` should remain operationally conservative: use it only after a deliberate real-data change and after confirming the operator understands it sends the local store to Supabase.
- `Importar backup` remains a high-risk operation and should not be used casually in production.

## Latest validation evidence

- `npx vitest run tests/unit/runtime-env.test.js tests/unit/reconstruction-app-shell.test.js tests/unit/security-config.test.js tests/unit/reconstruction-service-worker-pwa.test.js tests/unit/service-worker-config.test.js --maxWorkers=1 --minWorkers=1` OK with `48 passed`.
- `DEPLOY_SMOKE_URL="https://wpm-gestao-interna.vercel.app/" npm run smoke:deploy` OK with `1 passed`.
- Published HTML contains `src/vendor/supabase-js-2.104.0.umd.js` and no Supabase CDN script.
- Published `sw.js` precaches `src/vendor/supabase-js-2.104.0.umd.js`.
- Playwright runtime validation on `https://wpm-gestao-interna.vercel.app/?type=recovery` confirmed `hasSdk=true`, `SDK Carregado`, `passwordRecovery=true`, and visible password fields.
- Manual operator validation confirmed successful password setup, login, dry-run, migration, backend reload, and month navigation.

## Current safe next step

Do **not** start a new feature yet.

Next stage: **Etapa 11 - Piloto operacional controlado em producao**.

Session paused on 2026-05-03 at 15:19:24 -03 by operator request. On the next Codex session, resume here and do not run any new visual/frontend work before the pilot.

Recommended order:

1. Confirm `main` is still aligned with `origin/main` and inspect the latest commit.
2. Execute a minimal real-data pilot in the published app:
   - create one controlled atendimento in `Maio/2026`;
   - save locally;
   - use `Sincronizar agora` once only if the operator intentionally wants to send that change;
   - reload from backend;
   - confirm the record returns from Supabase.
3. Repeat the same pattern for one pendencia or one addon only after the first atendimento passes.
4. Close/reopen the browser, log in, reload from backend, and confirm persistence survives a fresh session.
5. Update operational runbook language for:
   - when to use `Recarregar do backend`;
   - when to use `Sincronizar agora`;
   - when to export backup;
   - when import is allowed.

## Guardrails

Do not:

- click `Sincronizar agora` repeatedly;
- use `Importar backup` without a reviewed preview and explicit intent;
- assume old GitHub Pages runtime is the canonical production runtime;
- trust historical docs over `Docs/HOMOLOGACAO_POS_MERGE_2026-05-03.md` and this status file;
- start feature work before the controlled pilot proves real-data persistence.

## CORTEX operating rule

`.cortex/` is a living continuity layer.

After every completed task:

1. update `CURRENT_STATUS.md`
2. update `AGENT_HANDOFF.md`
3. update `RETOMADA_MASTER.md`
4. append an entry to `TASK_LEDGER.md`
5. update any reference artifact that changed materially

Protocol details live in `UPDATE_PROTOCOL.md`.

## Authoritative priority

For present-state decisions, trust these in order:

1. live code in `index.html`, `src/`, `sw.js`, configs
2. `Docs/HOMOLOGACAO_POS_MERGE_2026-05-03.md`
3. `Docs/RETOMADA_SEGURA.md`
4. `.cortex/CURRENT_STATUS.md`
5. `.cortex/RETOMADA_MASTER.md`
6. `.cortex/TASK_LEDGER.md`
7. `Docs/PROXIMOS_PASSOS.md`
8. other audit/reference docs as dated evidence

## Main unresolved pressures

- script-order coupling and shared mutable globals remain architectural constraints;
- sync is still store-level, not entity-level merge;
- real-data pilot has not yet been executed;
- operational runbook needs to make `Recarregar`, `Sincronizar`, backup and import rules explicit for non-developer use;
- documentation drift must be actively controlled because older roadmap sections contain historical local-homologation facts.
