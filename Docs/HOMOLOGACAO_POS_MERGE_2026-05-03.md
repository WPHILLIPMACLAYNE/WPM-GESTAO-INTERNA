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

## Deploy remoto com Supabase habilitado

Ainda em 2026-05-03, a Vercel CLI foi autenticada, o checkout foi linkado ao projeto `wpm-gestao-interna` e as variaveis publicas de producao foram configuradas:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_UNIT_SLUG`

Redeploy de producao:

- Deployment: `dpl_AfbGoSzFa6eSsvst5BByFznNmGgJ`
- URL de producao gerada: `https://wpm-gestao-interna-nlp7ge3l6-wphillipmaclaynes-projects.vercel.app`
- Alias atualizado: `https://wpm-gestao-interna.vercel.app`
- Build: `Scripts/generate-env.mjs` gerou `env.js` com `3/9` chaves preenchidas.

Validacao pos-redeploy:

- `https://wpm-gestao-interna.vercel.app/env.js`: HTTP `200`.
- Runtime publicado: `hasEnv=true`, `hasSdk=true`, `enabled=true`.
- Host Supabase: `eautmpqkxibolmcfiacd.supabase.co`.
- `SUPABASE_UNIT_SLUG`: `wpm-unidade-local`.
- `DEPLOY_SMOKE_URL="https://wpm-gestao-interna.vercel.app/" npm run smoke:deploy`: 1 teste Playwright passou.

Bloqueio atual antes do dry-run real:

- Consulta administrativa confirmou `0` unidades em `public.units` no Supabase remoto.
- Login de desenvolvimento local (`dev.admin@wpm.local`) contra o remoto retornou `invalid_credentials`.
- Portanto, o app publicado ja esta tecnicamente pronto para autenticar, mas o backend remoto ainda precisa do bootstrap inicial de unidade/admin real antes do dry-run funcional.

Proxima etapa segura:

1. Definir dados reais do bootstrap remoto: nome da unidade, slug final, e-mail do admin e nome de exibicao.
2. Criar/confirmar usuario admin no Supabase Auth remoto.
3. Executar `public.bootstrap_unit_admin(...)` uma unica vez com `service_role`/SQL administrativo.
4. Autenticar no app publicado.
5. Executar somente o dry-run de migracao assistida.
6. Nao executar migracao antes da revisao humana do preview.

## Bootstrap remoto inicial

Ainda em 2026-05-03, o bootstrap remoto inicial foi executado com dados aprovados:

- Unidade: `Smartfit Pampulha`.
- Slug informado: `MGCPAM2`.
- Slug gravado/normalizado: `mgcpam2`.
- Admin: `smartwonkey@gmail.com`.
- Nome de exibicao: `WPM`.

Execucao:

- Usuario Auth remoto criado e confirmado.
- Espelho em `public.users` confirmado.
- `public.bootstrap_unit_admin(...)` executada uma unica vez via `service_role`/API administrativa.
- Solicitação de recuperação/definição de senha enviada para `smartwonkey@gmail.com`.
- `SUPABASE_UNIT_SLUG` de producao no Vercel atualizado para `mgcpam2`.
- Redeploy de producao concluido: `dpl_3YL8wrzwXLejpQ4uJmbhYvAGGVCC`.

Validacao:

- Runtime publicado: `hasEnv=true`, `hasSdk=true`, `enabled=true`, `unitSlug=mgcpam2`.
- Supabase remoto:
  - `public.units`: `Smartfit Pampulha`, slug `mgcpam2`, ativa.
  - `public.unit_members`: `WPM`, role `admin`, ativo, unidade `mgcpam2`.
  - `public.periods`: periodo `2026-05`, status `open`, unidade `mgcpam2`.
- `DEPLOY_SMOKE_URL="https://wpm-gestao-interna.vercel.app/" npm run smoke:deploy`: 1 teste Playwright passou.

Proxima etapa segura:

1. Usar o e-mail de recuperação recebido em `smartwonkey@gmail.com` para definir a senha do admin remoto.
2. Abrir `https://wpm-gestao-interna.vercel.app/` no navegador que contem a base local real a migrar.
3. Fazer login como `smartwonkey@gmail.com`.
4. Confirmar unidade ativa `Smartfit Pampulha` e perfil `admin`.
5. Executar apenas `Executar dry-run` em `Configuracoes` -> `Migracao assistida`.
6. Revisar o preview antes de qualquer migracao.

## Correcao do recovery de senha

Ainda em 2026-05-03, o primeiro link de recuperacao abriu `localhost:3000`, que nao estava servindo o app. A causa era a configuracao Auth do Supabase ainda apontando para URL local.

Correcao aplicada:

- `supabase/config.toml` agora usa `site_url = "https://wpm-gestao-interna.vercel.app"`.
- Redirects permitidos mantem Vercel, `127.0.0.1:3000` e `localhost:3000`.
- `supabase config push --project-ref eautmpqkxibolmcfiacd --yes` atualizou o Auth remoto.
- `api.schemas` foi preservado como `["public", "graphql_public"]` para nao deixar alteracao lateral.
- O app ganhou formulario de atualizacao de senha no painel Supabase autenticado.
- Novo recovery enviado para `smartwonkey@gmail.com`.

Validacao:

- Link de recovery gerado pela API aponta para `redirectHost = wpm-gestao-interna.vercel.app`.
- `node --check src/core/supabase.js src/reconstruction/supabase-adapter.js src/main.js src/ui/render-settings.js src/ui/events-core.js`: OK.
- `npx vitest run tests/unit/runtime-env.test.js tests/unit/reconstruction-supabase-adapter.test.js tests/unit/reconstruction-app-shell.test.js`: 43 testes passaram.
- Deploy de producao com painel de senha: `dpl_F97AVZAbANPAhFDXH4v6Rna462X4`.
- Runtime publicado validado: `unitSlug=mgcpam2`, `enabled=true`, `hasEnv=true`, `hasSdk=true`, `hasUpdatePassword=true`.
- `DEPLOY_SMOKE_URL="https://wpm-gestao-interna.vercel.app/" npm run smoke:deploy`: 1 teste Playwright passou.
- Recovery reenviado apos o deploy do painel de senha: HTTP `200`.

Proxima etapa segura:

1. Abrir o e-mail de recuperacao mais recente em `smartwonkey@gmail.com`.
2. Definir a senha no app publicado usando o novo painel de senha.
3. Permanecer autenticado na unidade `Smartfit Pampulha`.
4. Rodar apenas `Executar dry-run`.

## Hotfix do fluxo de recuperacao no app publicado

Ainda em 2026-05-03, foi identificado que o link de recuperacao chegava ao app publicado, mas o usuario nao tinha um fluxo claro e direto para concluir a troca de senha. O app dependia do estado autenticado implicito do Supabase e nao destacava o modo `PASSWORD_RECOVERY`.

Correcao aplicada:

- `src/core/supabase.js` agora detecta `type=recovery`/erros de recovery na URL e trata o evento Auth `PASSWORD_RECOVERY`.
- O estado Supabase passou a guardar `passwordRecovery` e `passwordRecoveryError`.
- `src/ui/render-settings.js` passou a mostrar mensagem de recuperacao, campos de nova senha e acoes de `Enviar reset de senha`/`Definir nova senha`.
- `src/ui/events-core.js` ganhou acao para solicitar novo recovery diretamente pelo painel.
- `src/main.js` expoe `requestSupabasePasswordRecovery` em `APP_INTERNALS.backend`.
- Testes novos cobrem envio de recovery com `redirectTo` do app atual e ativacao do modo `PASSWORD_RECOVERY`.

Validacao:

- `node --check src/core/supabase.js src/main.js src/ui/events-core.js src/ui/render-settings.js`: OK.
- `npx vitest run tests/unit/runtime-env.test.js tests/unit/selectors-real.test.js tests/unit/xss-entities.test.js`: 47 testes passaram.
- `npx vitest run --maxWorkers=1 --minWorkers=1`: 267 testes passaram.
- Deploy de producao: `dpl_CCWKoJaiNjvmNpe5f3TmMFwgb72V`.
- Alias publicado: `https://wpm-gestao-interna.vercel.app`.
- `https://wpm-gestao-interna.vercel.app/`: HTTP `200`.
- `https://wpm-gestao-interna.vercel.app/env.js`: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_UNIT_SLUG=mgcpam2` carregados.
- `DEPLOY_SMOKE_URL="https://wpm-gestao-interna.vercel.app/" npm run smoke:deploy`: 1 teste Playwright passou.
- Novo recovery reenviado para `smartwonkey@gmail.com`: HTTP `200`.

Proxima etapa segura:

1. Abrir somente o e-mail de recuperacao mais recente em `smartwonkey@gmail.com`.
2. Definir a nova senha no app publicado.
3. Fazer login no backend e confirmar unidade `Smartfit Pampulha`, perfil `admin`.
4. Depois disso, seguir para o dry-run de migracao assistida.
