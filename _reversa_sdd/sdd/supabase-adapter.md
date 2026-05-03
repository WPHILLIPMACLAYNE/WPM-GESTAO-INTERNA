# Supabase Adapter

## Visão Geral

🟢 `src/core/supabase.js` implementa a integração local-first com Supabase: leitura de env runtime, criação de client browser, autenticação, memberships por unidade, RBAC, reconstrução do store remoto, sincronização guardada por checkpoint e resolução operacional de conflitos.

🟢 O app continua funcional em IndexedDB/localStorage quando env, SDK, sessão, unidade ou permissão remota não estão disponíveis.

🟢 A escrita remota completa só é permitida para roles `admin` e `gestor` e usa RPC guardada `import_backup_transaction_guarded`.

## Responsabilidades

- 🟢 Ler `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_UNIT_SLUG` de `window.__APP_ENV__`.
- 🟢 Detectar disponibilidade real de env e SDK browser.
- 🟢 Criar client Supabase singleton com sessão persistida e refresh automático.
- 🟢 Vincular listener de Auth uma única vez.
- 🟢 Manter `supabaseBackendState` para painel, bloqueio e diagnóstico.
- 🟢 Normalizar usuário, memberships, roles e unidade ativa.
- 🟢 Selecionar unidade ativa por slug preferido ou prioridade de role.
- 🟢 Determinar escrita remota apenas para `admin` e `gestor`.
- 🟢 Reconstruir `PeriodData` local a partir de múltiplas tabelas Supabase.
- 🟢 Recriar `archives` locais a partir de períodos remotos fechados.
- 🟢 Montar payload `app-backup` para sync remota.
- 🟢 Ler e memorizar checkpoint remoto.
- 🟢 Bloquear primeiro sync local quando backend já está populado sem baseline.
- 🟢 Chamar `import_backup_transaction_guarded` com checkpoint esperado.
- 🟢 Debouncear sync remota para eventos comuns.
- 🟢 Executar sync imediata para eventos críticos.
- 🟢 Recarregar app a partir da sessão Supabase sob comando explícito.
- 🟢 Encerrar sessão e limpar estado remoto local.
- 🟢 Resetar caches do adapter em testes.

## Interface

### Estado Interno

| Nome | Tipo | Regra |
|---|---|---|
| `__supabaseClientCache` | client|null | singleton do client Supabase. 🟢 |
| `__supabaseSessionCache` | session|null | cache de sessão Auth. 🟢 |
| `__supabaseAuthListenerBound` | boolean | evita múltiplos listeners Auth. 🟢 |
| `__supabaseSyncTimer` | number|null | timer de sync debounced. 🟢 |
| `__supabasePendingSyncStore` | Object|null | último store aguardando sync. 🟢 |
| `__supabaseSyncPromise` | Promise|null | sync remota em execução. 🟢 |
| `__supabaseLastRemoteCheckpoint` | Object|null | baseline remoto memorizado. 🟢 |
| `supabaseBackendState` | object | estado público congelado por getter. 🟢 |

### Papéis

| Papel | Prioridade | Escrita remota |
|---|---:|---|
| `admin` | 1 | sim. 🟢 |
| `gestor` | 2 | sim. 🟢 |
| `recepcao` | 3 | não no sync completo. 🟢 |
| `professor` | 4 | não. 🟢 |
| `leitura` | 5 | não. 🟢 |

### API Pública

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `readSupabaseEnv()` | nenhum | env object | lê runtime env. 🟢 |
| `isSupabaseEnabled()` | nenhum | boolean | exige env e SDK. 🟢 |
| `getSupabaseClient()` | nenhum | client|null | cria/retorna singleton ou modo offline. 🟢 |
| `getSupabaseSession(options)` | options | Promise<session|null> | lê sessão Auth com cache. 🟢 |
| `refreshSupabaseBackendState(options)` | options | Promise<state> | resolve sessão, memberships, unidade e escrita. 🟢 |
| `getSupabaseBackendState()` | nenhum | Readonly state | snapshot congelado do estado. 🟢 |
| `loadStoreFromSupabase(fallbackStore)` | AppStore|null | Promise<AppStore|null> | carrega store remoto ou retorna null. 🟢 |
| `saveStoreToSupabase(storeLike)` | Object | Promise<Result> | sincroniza store via RPC guardada. 🟢 |
| `queueSupabaseStoreSync(storeLike, options)` | Object, options | Promise<Result> | debounce/immediate sync. 🟢 |
| `syncCurrentStoreToSupabase(options)` | options | Promise<Result> | sync manual do store atual. 🟢 |
| `reloadAppFromSupabaseSession(options)` | options | Promise<boolean> | aplica base remota no app local. 🟢 |
| `signInSupabasePassword(email, password, options)` | credenciais | Promise<Result> | autentica por senha. 🟢 |
| `signOutSupabase()` | nenhum | Promise<Result> | encerra sessão e limpa estado. 🟢 |
| `getSupabaseStatus()` | nenhum | status object | diagnóstico resumido. 🟢 |
| `resetSupabaseClient()` | nenhum | void | limpa caches e estado. 🟢 |

### Checkpoint

| Campo | Tipo | Regra |
|---|---|---|
| `revision` | string | revisão calculada pelo backend ou fallback de `maxUpdatedAt`. 🟢 |
| `maxUpdatedAt` | string | maior timestamp remoto. 🟢 |
| `periodCount` | number | quantidade de períodos remotos. 🟢 |
| `auditCount` | number | quantidade de auditorias remotas. 🟢 |

## Regras de Negócio

- 🟢 Sem env público ou SDK browser, Supabase fica desabilitado e o app segue local.
- 🟢 Client Supabase deve ser singleton por runtime.
- 🟢 Auth listener deve atualizar sessão, usuário, memberships e estado.
- 🟢 Ao sair da sessão, memberships, unidade ativa, writable e checkpoint local devem ser limpos.
- 🟢 Membership ativo deve exigir vínculo ativo e unidade ativa.
- 🟢 `SUPABASE_UNIT_SLUG` tem prioridade quando encontra membership ativo compatível.
- 🟢 Sem slug preferido, membership ativo é escolhido por prioridade de role e nome da unidade.
- 🟢 Somente roles `admin` e `gestor` podem gravar sync remoto completo.
- 🟢 Sessão autenticada sem role gravável mantém leitura remota, mas UI entra em modo somente leitura.
- 🟢 `loadStoreFromSupabase()` deve retornar `null` quando não há client, unidade ativa ou períodos remotos.
- 🟢 Leitura remota deve consultar períodos e tabelas operacionais por `period_id`.
- 🟢 `mapSupabasePeriodToLocal()` deve remontar `PeriodData` com settings, alunos, pendências, recados, NPS, escala, eventos e addons.
- 🟢 Períodos remotos com `status = closed` devem virar `storage.archives[periodKey]`.
- 🟢 Store remoto reconstruído deve passar por `prepareStoreCandidate()`.
- 🟢 `saveStoreToSupabase()` deve pular se Supabase está desabilitado, sem unidade ou sem role gravável.
- 🟢 Antes de gravar, adapter deve ler checkpoint remoto atual.
- 🟢 Se não existe baseline local e checkpoint remoto não está vazio, sync deve parar em `remote-baseline-missing`.
- 🟢 Quando há baseline, RPC deve receber `p_expected_checkpoint`.
- 🟢 Importação remota completa deve enviar `p_preview_accepted=true` e payload com envelope de integridade.
- 🟢 Conflito remoto deve mudar `syncStatus` para `conflict` e `conflictStatus` para `detected`.
- 🟢 Erro não conflitivo deve mudar `syncStatus` para `error`.
- 🟢 Sync bem-sucedida deve memorizar o novo checkpoint e marcar `source = 'supabase'`.
- 🟢 Eventos `import`, `restore`, `reset`, `close`, `recovery` e `close-month-backup` devem syncar imediatamente quando acionados pelo save local.
- 🔴 O checkpoint remoto não é hash completo do conteúdo; usa timestamps e contagens como revisão pragmática.
- 🟢 O adapter não implementa merge automático de conflitos entre stores divergentes por decisão operacional atual; o operador deve recarregar do backend.

## Fluxo Principal

1. 🟢 `saveStore()` persiste o store local primeiro.
2. 🟢 Se Supabase está habilitado, autenticado, com unidade ativa e writable, `saveStore()` chama `queueSupabaseStoreSync()`.
3. 🟢 `queueSupabaseStoreSync()` clona o store e agenda sync debounced ou imediata.
4. 🟢 `saveStoreToSupabase()` obtém client por `getSupabaseClient()`.
5. 🟢 `refreshSupabaseBackendState()` confirma sessão, membership, unidade e role.
6. 🟢 Se não há unidade ou escrita, retorna skipped.
7. 🟢 `buildSupabaseBackupPayload()` transforma o store local em `app-backup`.
8. 🟢 `readSupabaseSyncCheckpoint()` lê o checkpoint remoto atual.
9. 🟢 Se backend remoto tem dados e o app não tem baseline, retorna conflito `remote-baseline-missing`.
10. 🟢 O adapter define `expectedCheckpoint` a partir do baseline memorizado ou checkpoint atual.
11. 🟢 O adapter chama `callSupabaseRpc('importBackupTransactionGuarded', ...)`, que valida parametros e mapeia para `import_backup_transaction_guarded(p_unit_id, p_payload, p_expected_checkpoint, p_preview_accepted)`.
12. 🟢 Se a RPC retorna erro de conflito, o estado vira `conflict/detected`.
13. 🟢 Se a RPC retorna outro erro, o estado vira `error`.
14. 🟢 Se a RPC conclui, o adapter lê novo checkpoint.
15. 🟢 `rememberSupabaseRemoteCheckpoint()` memoriza checkpoint e limpa conflito.
16. 🟢 `supabaseBackendState` recebe `source='supabase'`, `syncStatus='idle'` e `lastSyncAt`.
17. 🟢 O resultado retorna `{ ok: true, data, checkpoint }`.

## Fluxos Alternativos

- **Sem env:** 🟢 `refreshSupabaseBackendState()` marca `sessionStatus='offline'` e `source='local'`.
- **Sem SDK CDN:** 🟢 estado marca `sessionStatus='sdk-missing'` e app segue local.
- **Erro ao criar client:** 🟢 `sessionStatus='error'`, `lastError='init-error:...'`.
- **Usuário anônimo:** 🟢 estado fica enabled, porém `sessionStatus='anonymous'`, sem unidade e sem escrita.
- **Login por senha:** 🟢 `signInSupabasePassword()` autentica, atualiza backend state e opcionalmente recarrega remoto.
- **Login pela UI:** 🟢 `handleSupabaseSignInAction()` preserva base local e orienta recarregar do backend manualmente.
- **Recarregar do backend:** 🟢 `reloadAppFromSupabaseSession()` lê local como fallback, carrega remoto, salva local sem resync e renderiza.
- **Backend remoto vazio:** 🟢 `loadStoreFromSupabase()` memoriza checkpoint vazio e retorna `null`.
- **Falha de leitura remota:** 🟢 estado volta para `source='local'`, `syncStatus='error'` e app mantém store local.
- **Sync manual:** 🟢 `syncCurrentStoreToSupabase()` força `queueSupabaseStoreSync(..., immediate:true)` e mostra toast.
- **Migração assistida:** 🟢 `runAssistedMigrationToSupabase()` exige backend autenticado/writable, dry-run pronto, snapshot local e sync imediata.
- **Sign out:** 🟢 `signOutSupabase()` limpa sessão, unidade, writable, checkpoint e volta para modo local.
- **Teste:** 🟢 `resetSupabaseClient()` limpa client, timers, promessas e estado.

## Dependências

- `src/core/supabase.js` — adapter principal.
- `src/core/backup.js` — `buildBackupPayload()`, `saveStore()`, `loadStore()`, `readStoredStore()`.
- `src/core/schema.js` — `prepareStoreCandidate()` e versão do store.
- `src/core/lifecycle.js` — `syncAppState()` e bloqueio read-only via backend state.
- `src/core/storage.js` — persistência local que precede sync remota.
- `src/features/diagnostics.js` — dry-run e migração assistida.
- `src/ui/events-core.js` — login, logout, reload e sync manual.
- `src/ui/render-settings.js` — painel Supabase e ações do usuário.
- `supabase/migrations/20260422190000_backend_canonical_schema.sql` — schema e RLS.
- `supabase/migrations/20260422194000_backend_transaction_rpcs.sql` — RPCs transacionais.
- `supabase/migrations/20260423090000_sync_checkpoint_guard.sql` — checkpoint e import guardado.
- Supabase JS CDN — `window.supabase.createClient`.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Disponibilidade | App deve funcionar sem Supabase. | `getSupabaseClient()` retorna null e source local | 🟢 |
| Segurança | Sync completa só para `admin`/`gestor`. | `SUPABASE_WRITABLE_ROLES` | 🟢 |
| Integridade | Sync remota deve comparar checkpoint. | `import_backup_transaction_guarded` | 🟢 |
| Resiliência | Falha remota não deve quebrar store local. | catches em load/save Supabase | 🟢 |
| Consistência | Eventos críticos devem syncar imediatamente. | `shouldSyncSupabaseImmediately()` | 🟢 |
| Performance | Eventos comuns devem ser debounced. | `queueSupabaseStoreSync()` com delay >= 250ms | 🟢 |
| Observabilidade | Estado deve expor status, conflito, erro e checkpoint. | `supabaseBackendState` | 🟢 |

> Inferido do código. Validar em ambiente real a latência e comportamento de RLS/RPC além dos mocks de runtime.

## Critérios de Aceitação

```gherkin
Dado que SUPABASE_URL ou SUPABASE_ANON_KEY estão ausentes
Quando getSupabaseClient for chamado
Então deve retornar null
E o app deve continuar em modo local

Dado um usuário autenticado com role recepcao
Quando refreshSupabaseBackendState concluir
Então writable deve ser false
E a UI deve operar em modo somente leitura para mutações

Dado um usuário admin autenticado com unidade ativa
Quando saveStoreToSupabase for chamado
Então deve montar payload app-backup
E chamar import_backup_transaction_guarded com checkpoint esperado

Dado que o backend remoto possui dados e não existe baseline local
Quando saveStoreToSupabase tentar sincronizar
Então deve retornar conflito remote-baseline-missing
E não deve sobrescrever o backend

Dado que a RPC retorna WPM_SYNC_CONFLICT
Quando saveStoreToSupabase tratar o erro
Então syncStatus deve ser conflict
E conflictStatus deve ser detected

Dado uma leitura remota bem-sucedida
Quando loadStoreFromSupabase concluir
Então deve reconstruir AppStore local
E deve criar archives para períodos remotos closed

Dado um evento close-month-backup
Quando saveStore agenda sync remota
Então queueSupabaseStoreSync deve executar imediatamente
```

## Cenários de Borda

- 🟢 **Env presente e SDK ausente:** estado fica `sdk-missing`, sem quebrar runtime.
- 🟢 **Membership sem unidade ativa:** usuário fica autenticado, mas sem `activeUnit` e sem escrita.
- 🟢 **Slug preferido sem match:** adapter escolhe membership ativo de maior prioridade.
- 🟢 **Tabela remota sem períodos:** checkpoint vazio é memorizado e store local é preservado.
- 🟢 **Período remoto fechado sem `closed_at`:** adapter usa timestamp atual como fallback de label.
- 🟢 **Addon sale fora do intervalo de dias do mês:** venda é ignorada no mapper.
- 🟢 **Timer de sync existente:** nova chamada cancela timer anterior e mantém último store pendente.
- 🟢 **Sign out durante uso:** caches de sessão e checkpoint são limpos.
- 🟡 **`scale_professor_shifts` é consultado sem `.in()` por período diretamente:** filtro posterior usa IDs de `scale_days`; validar volume remoto em produção.
- 🔴 **Checkpoint não cobre hash completo:** alterações com mesmo timestamp/contagem podem escapar teoricamente.
- 🟢 **Conflito não tem merge automático:** decisão humana confirmou que o operador deve recarregar do backend antes de sincronizar novamente.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Fallback local sem Supabase | Must | Premissa local-first do app. |
| Auth e membership por unidade | Must | Define contexto e permissões remotas. |
| Escrita só admin/gestor | Must | Barreira de segurança operacional. |
| Sync guardada por checkpoint | Must | Evita overwrite remoto acidental. |
| Load remoto para store local | Must | Permite troca controlada para base Supabase. |
| Debounce de sync | Should | Reduz chamadas em mutações frequentes. |
| Sync imediata em eventos críticos | Should | Fecha janela de perda em import/reset/fechamento. |
| Migração assistida | Should | Importante para adoção, mas depende de diagnóstico. |
| Reset de client para testes | Could | Essencial para teste, não para operação final. |

> Prioridade inferida pela cadeia de persistência local-first, RBAC e proteção de dados remotos.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `src/core/supabase.js` | `supabaseBackendState`, caches internos e constantes de role | 🟢 |
| `src/core/supabase.js` | `getSupabaseRpcOperation`, `validateSupabaseRpcParams`, `callSupabaseRpc` | 🟢 |
| `src/core/supabase.js` | `updateSupabaseBackendState`, `getSupabaseBackendState` | 🟢 |
| `src/core/supabase.js` | `normalizeSupabaseCheckpoint`, `isEmptySupabaseCheckpoint`, `rememberSupabaseRemoteCheckpoint` | 🟢 |
| `src/core/supabase.js` | `readSupabaseEnv`, `isSupabaseEnabled`, `getSupabaseClient` | 🟢 |
| `src/core/supabase.js` | `bindSupabaseAuthListener`, `getSupabaseSession`, `refreshSupabaseBackendState` | 🟢 |
| `src/core/supabase.js` | `snapshotSupabaseUser`, `snapshotSupabaseMembership`, `selectActiveSupabaseMembership` | 🟢 |
| `src/core/supabase.js` | `mapSupabasePeriodToLocal`, `groupSupabaseRows` | 🟢 |
| `src/core/supabase.js` | `buildSupabaseBackupPayload`, `shouldSyncSupabaseImmediately` | 🟢 |
| `src/core/supabase.js` | `loadStoreFromSupabase` | 🟢 |
| `src/core/supabase.js` | `saveStoreToSupabase`, `queueSupabaseStoreSync`, `syncCurrentStoreToSupabase` | 🟢 |
| `src/core/supabase.js` | `reloadAppFromSupabaseSession`, `signInSupabasePassword`, `signOutSupabase` | 🟢 |
| `src/core/supabase.js` | `getSupabaseStatus`, `resetSupabaseClient` | 🟢 |
| `src/core/backup.js` | integração `saveStore()` -> `queueSupabaseStoreSync()` | 🟢 |
| `src/core/lifecycle.js` | `isBackendReadOnlyMode()` e bloqueio de UI | 🟢 |
| `src/features/diagnostics.js` | `runAssistedMigrationToSupabase()` | 🟢 |
| `src/ui/events-core.js` | handlers Supabase de login, logout, reload e sync | 🟢 |
| `supabase/migrations/20260423090000_sync_checkpoint_guard.sql` | `get_unit_sync_checkpoint`, `import_backup_transaction_guarded` | 🟢 |
| `_reversa_sdd/flowcharts/core-saveStoreToSupabase.md` | fluxo de save remoto guardado | 🟢 |
| `_reversa_sdd/permissions.md` | RBAC e modo somente leitura | 🟢 |
