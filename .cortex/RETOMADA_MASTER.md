# RETOMADA_MASTER

Last updated: 2026-05-03 15:24:54 -03

## Purpose

This is the master recovery guide for interrupted-session work on `WPM-GESTAO-INTERNA`.

If work is resumed after VS Code closes, chat context is lost, or an agent changes, this file provides the shortest safe path back into the project.

## Active recovery identity

- Recovery branch: `main`
- Remote recovery branch: `origin/main`
- Verified base HEAD before pause checkpoint: `d8da0d5`
- Homologated technical baseline: `191383e`
- Current production stage: remote Supabase migration homologated
- Timezone for all continuity records: `America/Sao_Paulo`

## Current project state

- The app baseline is `v34`.
- The production runtime is `https://wpm-gestao-interna.vercel.app`.
- Vercel generates and serves `env.js` with public/browser-safe Supabase env.
- Supabase project `eautmpqkxibolmcfiacd` is the remote backend used in production.
- The active unit is `Smartfit Pampulha`, slug `mgcpam2`.
- The admin user is `smartwonkey@gmail.com`, display name `WPM`, role `admin`.
- Supabase SDK is loaded from the vendored local file `src/vendor/supabase-js-2.104.0.umd.js`.
- Service worker precaches the vendored Supabase SDK.
- Recovery, password setup, login, dry-run, initial migration, backend reload, and January-to-December navigation were manually validated on 2026-05-03.
- The migrated remote dataset currently contains 12 periods and zero operational records.
- Work paused by operator on 2026-05-03 at 15:19:24 -03. Resume with Etapa 11 only.
- README was refreshed after the pause checkpoint to make GitHub match the current project state.

## Mandatory read order on resume

1. `Docs/HOMOLOGACAO_POS_MERGE_2026-05-03.md`
2. `Docs/RETOMADA_SEGURA.md`
3. `.cortex/CURRENT_STATUS.md`
4. `.cortex/RETOMADA_MASTER.md`
5. `.cortex/TASK_LEDGER.md`
6. `.cortex/AGENT_HANDOFF.md`
7. `git status`, current branch, recent commits

## Mandatory update order after each completed task

1. `Docs/RETOMADA_SEGURA.md`
2. `.cortex/CURRENT_STATUS.md`
3. `.cortex/RETOMADA_MASTER.md`
4. `.cortex/AGENT_HANDOFF.md` if next step changed
5. `.cortex/TASK_LEDGER.md`
6. related project docs such as `Docs/PROXIMOS_PASSOS.md`, `MIGRATION_STATUS.md`, or `README.md` when their facts drift

## Commit rule

- Commit stable documentation or code checkpoints.
- Always record the Sao Paulo date/time in continuity files when updating them.
- If a task is not yet safe to commit, leave a complete checkpoint before stopping.

## Session handoff test

If a new Codex session resumes this repo using the standard recovery commands and correctly identifies:

- branch `main`
- current branch `main` aligned with `origin/main`
- production runtime `https://wpm-gestao-interna.vercel.app`
- stage `remote Supabase migration homologated`
- next stage `controlled production pilot`

then it may begin its first recovery confirmation response with:

`AHAA, CONSEGUI!`

This phrase is a continuity test marker and should be used only when context was reconstructed from persisted files.

## Latest completed continuity work

- Remote runtime env enabled on Vercel.
- Remote Supabase unit/admin bootstrap completed.
- Auth recovery redirect fixed to Vercel.
- Published password update/recovery flow implemented.
- Supabase SDK loading made independent of CDN by vendoring `@supabase/supabase-js@2.104.0`.
- Service worker precache updated for the vendored SDK.
- Published app validated with `hasSdk=true`, `SDK Carregado`, and visible recovery password fields.
- Recovery email was received by the operator.
- Admin password was defined successfully.
- Published app authenticated into `Smartfit Pampulha` as `admin`.
- Dry-run approved first migration: 12 local periods, empty remote backend, 0 divergences.
- Migration to backend executed once.
- Reload from backend returned `Base remota carregada com sucesso`.
- Manual navigation from January to December validated the remote period structure.
- Final homologation documented in `Docs/HOMOLOGACAO_POS_MERGE_2026-05-03.md`.
- Post-homologation resume checkpoint published in `d8da0d5` before this pause checkpoint.

## Exact next step

Start **Etapa 11 - Piloto operacional controlado em producao**.

Minimal safe sequence:

0. verify repo status first: `git status --short --branch`, `git log --oneline -n 3`;
1. create one controlled atendimento in `Maio/2026` using the published app;
2. save locally and confirm it appears in the UI;
3. intentionally use `Sincronizar agora` once only for that known change;
4. click `Recarregar do backend`;
5. confirm the atendimento returns from Supabase;
6. document the result before testing a pendencia or addon.

Do not start broader features until this production pilot proves real-data persistence.
Do not start UI/frontend correction work before this pilot unless the operator explicitly changes priority.
