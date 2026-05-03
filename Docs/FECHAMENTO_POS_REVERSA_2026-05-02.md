# FECHAMENTO_POS_REVERSA_2026-05-02

Data: 2026-05-02

Atualizacao 2026-05-03 13:29: homologacao pos-merge registrada em [`HOMOLOGACAO_POS_MERGE_2026-05-03.md`](./HOMOLOGACAO_POS_MERGE_2026-05-03.md). O bloqueio local inicial por `remote-mismatch` foi superado no alvo remoto correto: Vercel publicou env Supabase, o SDK foi vendorizado, recovery/senha/login passaram, o dry-run retornou `12 periodo(s) locais, backend remoto vazio, 0 divergencia(s)`, a migracao inicial foi executada uma vez e o reload remoto carregou a base Supabase com sucesso.

Objetivo: iniciar a etapa de fechamento e homologacao da integracao pos-Reversa, separando o que ja esta validado localmente do que ainda precisa ser aplicado no Supabase alvo.

## Estado executivo

Status: integracao pos-Reversa concluida localmente e homologacao remota funcional concluida em producao.

Blocos locais concluidos:

- Bloco 1: reabertura de mes fechado no app real.
- Bloco 2: preview granular e integridade para importacao destrutiva.
- Bloco 3: RPC/migration Supabase alinhada para exigir preview aceito e integridade.
- Bloco 4: Supabase CDN com SRI.
- Bloco 5: contrato RPC reconstruido conectado ao adapter real para RPCs criticas.
- Bloco 6: sanitizacao central de patch de linhas de tabela.

## Evidencias locais

- `npx vitest run --testTimeout=20000`: 25 arquivos, 258 testes passaram.
- `node --check src/ui/render-core.js src/reconstruction/ui-render-events.js src/main.js`: sem erro de sintaxe.
- `git diff --check`: sem problemas de whitespace.
- Hash SRI do Supabase CDN recalculado e conferido contra `index.html`.
- Migration `20260422185000_preserve_legacy_public_tables.sql` adicionada para preservar tabelas legadas remotas antes da baseline canonica.
- Migration `20260502183000_import_guard_preview_integrity.sql` validada contra o Postgres local em transacao com `ROLLBACK`.
- Migration `20260502183000_import_guard_preview_integrity.sql` aplicada no Supabase local com `npx supabase db push --local`.
- `npx supabase db lint --local`: sem erro fatal; apenas warnings preexistentes em funcoes antigas.
- `npx supabase migration list --local`: migration `20260502183000` consta registrada no banco local.
- Helpers de integridade validados por SQL direto: payload valido retorna `ok=true`; hash adulterado retorna `hash-mismatch`.
- RPC guardada validada em transacao com `ROLLBACK`: sem preview foi rejeitado, hash adulterado foi rejeitado e payload integro com preview aceito passou.
- Contagem local de periodos apos rollback permaneceu em 12, confirmando que o teste destrutivo nao alterou a base.

## Supabase local

O CLI global `supabase` nao esta instalado neste ambiente, mas `npx supabase` funciona.

Status local observado:

- Docker disponivel.
- Setup Supabase local acessivel em `http://127.0.0.1:54321`.
- Banco local acessivel em `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- Migration nova: `supabase/migrations/20260502183000_import_guard_preview_integrity.sql`.
- Sintaxe/DDL da migration validada em transacao manual com rollback.
- Aplicacao efetiva no banco local concluida via `npx supabase db push --local`.

Comandos seguros para leitura/diagnostico:

```bash
npx supabase status
npx supabase migration list --local
npx supabase db lint --local
```

Nao rodar `db reset` sem decidir antes se a base local pode ser descartada, porque esse comando recria o banco local.

Validacao nao destrutiva ja executada:

```bash
docker exec -i supabase_db_wpm-gestao-interna psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c 'begin;' -f - -c 'rollback;' \
  < supabase/migrations/20260502183000_import_guard_preview_integrity.sql
```

Aplicacao local ja executada:

```bash
npx supabase db push --local
npx supabase migration list --local
```

Homologacao local transacional ja executada:

```bash
docker exec -i supabase_db_wpm-gestao-interna psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Dentro da transacao, com usuario admin local autenticado:

- `import_backup_transaction_guarded(..., p_preview_accepted=false)` rejeitou com `WPM_IMPORT_GUARD`.
- payload com hash `00000000` rejeitou com `hash-mismatch`.
- payload integro com `p_preview_accepted=true` passou.
- `ROLLBACK` preservou os 12 periodos locais.

## Homologacao remota

Projeto remoto linkado em 2026-05-02:

- Ref: `eautmpqkxibolmcfiacd`.
- Nome: `WPHILLIPMACLAYNE's Project`.
- Regiao: South America (Sao Paulo).
- Historico remoto de migrations: vazio no momento da primeira listagem.
- O push remoto inicial falhou porque o projeto ja tinha schema legado sem historico de migrations: `periods.id bigint` conflitava com a baseline canonica `periods.id uuid`.
- A migration `20260422185000_preserve_legacy_public_tables.sql` preservou o schema legado renomeando `periods`, `archives` e `profiles` para `legacy_periods`, `legacy_archives` e `legacy_profiles` antes da baseline.
- `npx supabase db push --dry-run --include-all` indicou que 7 migrations seriam enviadas.
- `npx supabase db push --include-all --yes` aplicado com sucesso no remoto.
- Historico remoto confirmado via `supabase_migrations.schema_migrations`.

Migrations aplicadas no remoto:

- `20260422185000_preserve_legacy_public_tables.sql`
- `20260422190000_backend_canonical_schema.sql`
- `20260422194000_backend_transaction_rpcs.sql`
- `20260422203000_bootstrap_initial_admin.sql`
- `20260422224500_fix_addon_sales_unique_index.sql`
- `20260423090000_sync_checkpoint_guard.sql`
- `20260502183000_import_guard_preview_integrity.sql`

Confirmacoes remotas observadas:

- `public.periods.id`: `uuid`.
- `public.legacy_periods.id`: `bigint`.
- `public.legacy_archives` preservada.
- `public.legacy_profiles` preservada.
- Tabelas canonicas novas presentes: `units`, `unit_members`, `periods`, `audit_events`.

## Checklist de homologacao funcional

Executar com dados nao sensiveis ou base de homologacao:

1. Abrir o app com `env.js` apontando para o Supabase alvo.
2. Autenticar usuario gravavel da unidade correta.
3. Rodar dry-run da migracao assistida.
4. Conferir contagens do preview por periodo e tipo de entidade.
5. Aceitar explicitamente o preview antes da importacao.
6. Confirmar que o sync remoto chama `import_backup_transaction_guarded` com `p_preview_accepted=true`.
7. Recarregar do backend e validar amostra: alunos, pendencias, escala, eventos, NPS, addons e recados.
8. Testar rejeicao de payload adulterado em ambiente controlado.
9. Testar rejeicao de importacao sem aceite de preview.
10. Testar conflito de checkpoint com duas sessoes ou alteracao remota concorrente.

## Criterio de aceite

- Migration aplicada no Supabase alvo.
- Importacao sem preview aceito rejeitada no backend.
- Payload com hash adulterado rejeitado no backend.
- Importacao aceita preserva os dados esperados apos reload remoto.
- Conflito de checkpoint continua bloqueando sobrescrita silenciosa.
- Suite local continua verde antes de commit/PR.

## Riscos residuais

- `diagnostics.js` segue como divida de manutenibilidade, nao bloqueante.
- O SRI deve ser recalculado sempre que `@supabase/supabase-js` mudar de versao.
- O catalogo RPC real cobre apenas as RPCs criticas usadas hoje pelo adapter browser.
