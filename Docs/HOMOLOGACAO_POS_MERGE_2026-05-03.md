# HOMOLOGACAO_POS_MERGE_2026-05-03

Data: 2026-05-03

Objetivo: registrar a primeira homologacao funcional apos o merge da integracao pos-Reversa na `main`, validando as travas destrutivas do backend e o fluxo browser contra Supabase local.

## Escopo

- Branch/merge base: `main` apos PR #9.
- Supabase alvo: ambiente local via `npx supabase`.
- Dados usados: seed local nao sensivel da unidade `wpm-unidade-local`.
- Segredos: nenhum valor de chave foi registrado; `env.js` foi gerado temporariamente e restaurado ao fim dos testes.

## Estado de migrations

`npx supabase migration list --local` confirmou Local e Remote alinhados:

- `20260422185000`
- `20260422190000`
- `20260422194000`
- `20260422203000`
- `20260422224500`
- `20260423090000`
- `20260502183000`

## Homologacao backend transacional

Validacao feita em transacao com `ROLLBACK` no container local `supabase_db_wpm-gestao-interna`.

Resultado:

- Importacao completa sem preview aceito foi rejeitada com `WPM_IMPORT_GUARD`.
- Payload com hash adulterado foi rejeitado com `hash-mismatch`.
- Payload integro com `p_preview_accepted=true` foi aceito.
- A contagem de periodos voltou para 12 apos `ROLLBACK`, confirmando teste nao destrutivo.

## Homologacao browser

Fluxo executado com Playwright em servidor local temporario.

Resultado:

- `env.js` temporario carregou somente variaveis publicas browser-safe.
- Supabase runtime: `enabled=true`, `hasEnv=true`, `hasSdk=true`.
- Login local: `dev.admin@wpm.local`.
- Unidade ativa: `WPM Unidade Local` (`wpm-unidade-local`).
- Perfil: `admin`.
- Sessao: `authenticated`.
- Escrita: `writable=true`.

Dry-run autenticado:

- Periodos locais: 12.
- Periodos remotos: 12.
- Estado remoto: `present`.
- Erro remoto: nenhum.
- Resultado de prontidao: `blocked`.
- Motivo: `remote-mismatch`.

## Divergencias detectadas

O bloqueio da migracao assistida esta correto. O dry-run encontrou 8 divergencias no periodo `2026-04`, sempre com dados locais presentes e remoto zerado:

- `students`: local 30 vs remoto 0.
- `pending`: local 20 vs remoto 0.
- `events`: local 10 vs remoto 0.
- `scaleDays`: local 30 vs remoto 0.
- `professorShiftRows`: local 62 vs remoto 0.
- `npsMentions`: local 11 vs remoto 0.
- `addonRows`: local 18 vs remoto 0.
- `addonVolume`: local 18 vs remoto 0.

## Decisao

Nao executar migracao assistida enquanto o dry-run retornar `remote-mismatch`.

A proxima etapa segura e decidir se o ambiente local deve:

1. preservar a base remota atual e ajustar a base local antes de migrar; ou
2. tratar o Supabase local como alvo descartavel de homologacao e resetar/reseedar antes de repetir o dry-run.

Para ambiente real/remoto, a regra permanece: nao usar reset, nao sobrescrever e nao aceitar preview sem revisao humana das divergencias.

## Atualizacao da etapa seguinte

Ainda em 2026-05-03, o ambiente Supabase local foi tratado como descartavel de homologacao:

- Dump preventivo salvo fora do repositorio antes do reset local.
- `npx supabase db reset --local --yes` recriou a base com migrations e seed.
- O seed local criou unidade/admin e um periodo bootstrap vazio.
- A leitura remota foi ajustada para tratar bootstrap sem linhas operacionais como backend vazio.
- O algoritmo novo de integridade passou a ser `canonical-sha256-v1`, validado no banco via `extensions.digest`.
- Backups antigos `canonical-fnv1a32-v1` continuam aceitos pelo verificador do app.

Evidencia pos-ajuste:

- Dry-run antes da migracao: `remoteState=empty`, `canMigrate=true`, `Primeira migracao liberada`.
- Migracao assistida local: `ok=true`.
- Dry-run apos migracao: `remoteState=present`, 12 periodos remotos, 0 divergencias, `matches=true`.
- Contagens no banco local apos migracao: 12 periodos, 360 alunos, 240 pendencias, 120 eventos, 220 vendas de addon, 1 evento de auditoria.
- `npx supabase migration list --local`: migration `20260503130312` registrada junto das migrations anteriores.

## Retomada da homologacao remota funcional

Ainda em 2026-05-03, a retomada da etapa remota confirmou:

- `DEPLOY_SMOKE_URL="https://wphillipmaclayne.github.io/WPM-GESTAO-INTERNA/" npm run smoke:deploy`: 1 teste Playwright passou contra o app publicado.
- A URL do GitHub Pages respondeu `200`.
- A URL do Vercel (`https://wpm-gestao-interna.vercel.app/`) respondeu `200`.
- Ambos os artefatos publicados inicializavam em modo local-first, mas sem `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_UNIT_SLUG` no runtime.
- Consequencia: a autenticacao real e o dry-run remoto funcional ainda nao podiam ser executados nesses deploys publicados.

Correcao preparada no codigo:

- `src/core/env-bootstrap.js` passou a carregar `env.js` opcional tambem em runtime publicado, antes de `config.js`.
- `vercel.json` passou a executar `npm run build:env`, materializando `env.js` com variaveis publicas/browser-safe no artefato do Vercel.
- README e `Docs/DEPLOY_OBSERVABILIDADE.md` foram alinhados ao novo contrato.

Evidencia da correcao:

- `npx vitest run tests/unit/reconstruction-env-bootstrap.test.js tests/unit/runtime-env.test.js tests/unit/reconstruction-app-shell.test.js tests/unit/reconstruction-service-worker-pwa.test.js`: 44 testes passaram.
- `npm run smoke:deploy`: 1 teste Playwright passou contra o app local servido por HTTP, com `env.js` carregado antes dos modulos.
- Apos push para `main`, o Vercel passou a responder `/env.js` com HTTP `200`, mas ainda sem valores publicos Supabase; o status do app publicado permaneceu `hasEnv=false`.

Proxima etapa segura:

1. Configurar no deploy remoto somente variaveis publicas/browser-safe: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_UNIT_SLUG` e metadados de release quando aplicavel.
2. Redeployar o artefato.
3. Confirmar que `env.js` publicado existe, contem as variaveis publicas esperadas e que o app mostra `hasEnv=true` sem expor segredo em log.
4. Autenticar na unidade real.
5. Executar apenas `Executar dry-run` em `Configuracoes` -> `Migracao assistida`.
6. Revisar o preview humano antes de qualquer clique em `Migrar para o backend`.
