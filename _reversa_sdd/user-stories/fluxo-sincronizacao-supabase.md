# User Story: Fluxo de sincronizacao Supabase

## Metadados

| Campo | Valor |
|-------|-------|
| ID | US-WPM-003 |
| Status | 🟢 Confirmado por código, SDDs e testes |
| Fonte principal | `src/core/supabase.js`, `src/core/backup.js`, `src/features/diagnostics.js`, `src/ui/events-core.js`, `tests/unit/runtime-env.test.js` |
| Perfis | Admin, gestor, recepção, professor, leitura |
| Escopo | Autenticação Supabase, seleção de unidade, leitura remota, sincronização local-first guardada por checkpoint e tratamento de conflitos |

## História

Como gestor ou administrador, quero autenticar no backend Supabase e sincronizar a base local-first com uma unidade remota sem sobrescrever dados divergentes, para manter operação offline funcional, histórico centralizado e proteção contra conflitos entre dispositivos. 🟢

## Objetivos Operacionais

- 🟢 Manter o app funcional em modo local quando Supabase não está configurado.
- 🟢 Ler `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_UNIT_SLUG` do ambiente runtime.
- 🟢 Criar client Supabase somente quando env e SDK browser estão disponíveis.
- 🟢 Autenticar usuário por e-mail e senha.
- 🟢 Resolver memberships ativos e selecionar unidade por slug preferido ou prioridade de papel.
- 🟢 Permitir escrita remota completa apenas para `admin` e `gestor`.
- 🟢 Permitir leitura remota para usuários autenticados com unidade ativa.
- 🟢 Carregar store remoto sob ação explícita de reload ou durante `loadStore()` quando disponível.
- 🟢 Persistir local primeiro e sincronizar remoto depois.
- 🟢 Proteger importação remota por checkpoint esperado.
- 🟢 Bloquear primeiro sync quando backend já tem dados e o dispositivo não tem baseline remoto.
- 🟢 Sinalizar conflitos sem merge automático.

## Atores

| Ator | Responsabilidade |
|------|------------------|
| Admin | Configura unidade, autentica, sincroniza e pode gravar backup completo remoto. 🟢 |
| Gestor | Sincroniza base operacional da unidade e pode fechar/resetar/importar remotamente. 🟢 |
| Recepção | Pode usar sessão remota em modo sem escrita completa no adapter, com bloqueios locais de mutação ampla. 🟢 |
| Professor/Leitura | Consulta dados remotos conforme membership, sem escrita completa. 🟢 |
| Sistema | Mantém estado de backend, compara checkpoints, agenda sync e preserva fallback local. 🟢 |

## Pré-condições

- 🟢 Para modo remoto, `window.__APP_ENV__.SUPABASE_URL` e `SUPABASE_ANON_KEY` devem existir.
- 🟢 O SDK `window.supabase.createClient` deve estar carregado.
- 🟢 Usuário precisa de sessão Supabase Auth válida.
- 🟢 Usuário precisa de membership ativo em unidade ativa.
- 🟢 Para sync completa, role ativa deve ser `admin` ou `gestor`.
- 🟢 Para evitar overwrite, o dispositivo deve ter baseline remoto conhecido ou o backend deve estar vazio.

## Fluxo Principal: sincronizacao local-first guardada

1. 🟢 Usuário opera o app normalmente e `saveStore()` persiste o store local.
2. 🟢 Se Supabase está habilitado, autenticado, com unidade ativa e writable, `saveStore()` chama `queueSupabaseStoreSync()`.
3. 🟢 Eventos comuns são enfileirados com debounce; eventos críticos usam sync imediata.
4. 🟢 `saveStoreToSupabase()` obtém client Supabase.
5. 🟢 `refreshSupabaseBackendState()` confirma sessão, memberships, unidade ativa e permissões.
6. 🟢 O adapter monta payload `app-backup` por `buildSupabaseBackupPayload()`.
7. 🟢 O adapter lê checkpoint remoto via `get_unit_sync_checkpoint`.
8. 🟢 Se o remoto já possui dados e não há baseline local, o fluxo para em `remote-baseline-missing`.
9. 🟢 Caso contrário, o adapter envia `p_expected_checkpoint` para `import_backup_transaction_guarded`.
10. 🟢 A RPC valida role, serializa importação por unidade e compara checkpoint.
11. 🟢 Se o checkpoint diverge, a RPC retorna erro `WPM_SYNC_CONFLICT`.
12. 🟢 Se a importação passa, o adapter lê novo checkpoint e memoriza em `lastRemoteCheckpoint`.
13. 🟢 Estado público passa para `source = "supabase"`, `syncStatus = "idle"` e `conflictStatus = "clear"`.

## Fluxos Alternativos

### Supabase indisponivel

1. 🟢 Env ou SDK estão ausentes.
2. 🟢 `getSupabaseClient()` retorna `null`.
3. 🟢 `supabaseBackendState` registra `env-missing` ou `sdk-missing`.
4. 🟢 O app segue com IndexedDB/localStorage sem quebrar runtime.

### Login preservando base local

1. 🟢 Usuário informa e-mail e senha no painel Supabase.
2. 🟢 `handleSupabaseSignInAction()` chama `signInSupabasePassword(email, password, { reload: false })`.
3. 🟢 Sessão é iniciada e memberships são atualizados.
4. 🟢 A base local é preservada.
5. 🟢 UI orienta usar `Recarregar do backend` somente quando quiser trocar para a base remota.

### Recarregar do backend

1. 🟢 Usuário aciona `supabase-reload`.
2. 🟢 `reloadAppFromSupabaseSession()` carrega store local como fallback.
3. 🟢 `loadStoreFromSupabase()` consulta períodos, settings, alunos, addons, pendências, recados, NPS, escala e eventos.
4. 🟢 Períodos remotos `closed` viram `storage.archives`.
5. 🟢 O store remoto preparado é salvo localmente com `skipRemoteSync: true`.
6. 🟢 `syncAppState()`, `renderAll()` e `syncPeriodControls()` aplicam a base remota.

### Perfil somente leitura

1. 🟢 Usuário autenticado possui role não gravável no adapter completo.
2. 🟢 `writable` fica `false`.
3. 🟢 `syncCurrentStoreToSupabase()` ou `saveStoreToSupabase()` retorna skip `role-readonly`.
4. 🟢 O lifecycle local trata sessão Supabase read-only como bloqueio de mutação.

### Conflito por baseline ausente

1. 🟢 Backend remoto tem checkpoint com períodos ou auditorias.
2. 🟢 Dispositivo não tem `__supabaseLastRemoteCheckpoint` e não está com `source = "supabase"`.
3. 🟢 O adapter bloqueia sync antes da RPC de importação.
4. 🟢 Estado vira `syncStatus = "conflict"` e `conflictStatus = "baseline-missing"`.
5. 🟢 Usuário deve recarregar do backend antes de sincronizar.

### Conflito detectado pela RPC

1. 🟢 Adapter envia checkpoint esperado.
2. 🟢 Backend calcula checkpoint atual diferente.
3. 🟢 `import_backup_transaction_guarded` lança `WPM_SYNC_CONFLICT`.
4. 🟢 Adapter retorna `{ conflict: true, reason: "remote-conflict" }`.
5. 🟢 UI exibe aviso para recarregar do backend.

### Sign out

1. 🟢 Usuário encerra sessão Supabase.
2. 🟢 `signOutSupabase()` chama Auth signOut.
3. 🟢 Sessão, memberships, unidade ativa, writable e checkpoint são limpos.
4. 🟢 Estado volta para `source = "local"`.

## Regras de Negocio

| Regra | Evidência |
|-------|-----------|
| Supabase é opcional; app deve seguir local se env/SDK falham. | `getSupabaseClient()` e testes de fallback. 🟢 |
| Client Supabase é singleton por runtime. | `__supabaseClientCache`. 🟢 |
| Auth listener deve ser vinculado uma vez. | `__supabaseAuthListenerBound`. 🟢 |
| Role gravável do adapter completo é somente `admin` ou `gestor`. | `SUPABASE_WRITABLE_ROLES`. 🟢 |
| Unidade ativa usa slug preferido quando há match. | `selectActiveSupabaseMembership()`. 🟢 |
| Sem slug válido, prioridade é `admin`, `gestor`, `recepcao`, `professor`, `leitura`. | `SUPABASE_ROLE_PRIORITY`. 🟢 |
| Sync remota sempre usa payload `app-backup`. | `buildSupabaseBackupPayload()`. 🟢 |
| Eventos `import`, `restore`, `reset`, `close`, `recovery` e `close-month-backup` sincronizam imediatamente. | `shouldSyncSupabaseImmediately()`. 🟢 |
| Leitura remota deve reconstruir `archives` a partir de períodos `closed`. | `loadStoreFromSupabase()`. 🟢 |
| Primeiro sync não pode sobrescrever backend populado sem baseline. | `remote-baseline-missing`. 🟢 |
| Conflitos não têm merge automático por decisão operacional atual. | Decisão humana: sempre recarregar do backend antes de sincronizar. 🟢 |
| Checkpoint não é hash completo de conteúdo. | SDD e Data Master registram revisão pragmática. 🔴 |

## Critérios de Aceitação

### Cenário 1: fallback local sem configuração

Dado que `SUPABASE_URL` ou `SUPABASE_ANON_KEY` estão ausentes
Quando o app inicializa e tenta obter client Supabase
Então `getSupabaseClient()` deve retornar `null`
E o app deve continuar usando store local
E o painel deve indicar backend indisponível/offline. 🟢

### Cenário 2: login com base local preservada

Dado env e SDK Supabase disponíveis
Quando usuário entra com e-mail e senha válidos pela UI
Então a sessão deve ser criada
E memberships/unidade ativa devem ser carregados
E a base local não deve ser substituída automaticamente
E a UI deve orientar recarregar do backend apenas sob decisão explícita. 🟢

### Cenário 3: sync bem-sucedida de admin

Dado usuário `admin` autenticado com unidade ativa
E checkpoint remoto vazio ou igual ao baseline local
Quando o store local é salvo em evento crítico
Então a sync deve executar imediatamente
E chamar `import_backup_transaction_guarded` com `p_expected_checkpoint`
E memorizar o novo checkpoint remoto
E marcar `source = "supabase"`. 🟢

### Cenário 4: usuário sem escrita completa

Dado usuário autenticado com role não gravável
Quando tenta sincronizar store completo
Então `saveStoreToSupabase()` deve retornar skip `role-readonly`
E ações de mutação devem ser bloqueadas como sessão somente leitura quando aplicável. 🟢

### Cenário 5: backend remoto ja populado sem baseline

Dado backend com `periodCount > 0` ou `auditCount > 0`
E o dispositivo ainda não carregou checkpoint remoto
Quando tenta sincronizar store local
Então a RPC de importação não deve ser chamada
E o resultado deve ser conflito `remote-baseline-missing`
E a UI deve orientar recarregar do backend. 🟢

### Cenário 6: checkpoint divergente durante RPC

Dado um baseline local conhecido
E outro dispositivo alterou o backend depois desse baseline
Quando a RPC guardada recebe checkpoint esperado antigo
Então o backend deve lançar `WPM_SYNC_CONFLICT`
E o adapter deve marcar `syncStatus = "conflict"` e `conflictStatus = "detected"`. 🟢

### Cenário 7: reload remoto

Dado usuário autenticado com unidade ativa e períodos remotos
Quando usuário aciona `Recarregar do backend`
Então o app deve consultar tabelas remotas por `period_id`
E reconstruir `AppStore` local
E criar archives para períodos fechados
E salvar local sem reenviar imediatamente ao backend. 🟢

## Cenarios de Borda

- 🟢 Env presente e SDK ausente deve resultar em `sdk-missing`, não erro fatal.
- 🟢 Usuário autenticado sem membership ativo deve ficar sem `activeUnit` e sem escrita.
- 🟢 Slug preferido sem match deve cair para unidade ativa de maior prioridade.
- 🟢 Backend sem períodos deve memorizar checkpoint vazio e preservar store local.
- 🟢 Falha de leitura remota deve manter `source = "local"` e não apagar store local.
- 🟢 Uma nova sync debounced cancela timer anterior e conserva o último store pendente.
- 🟢 `skipRemoteSync: true` impede reenvio quando o store foi recém-carregado do backend.
- 🟢 Período remoto `closed` sem `closed_at` recebe fallback de timestamp para archive local.
- 🟡 Consulta de `scale_professor_shifts` depende de filtro posterior por IDs de escala; validar volume em produção.
- 🟢 Merge automático entre local e remoto divergentes não existe por decisão operacional atual; operador deve recarregar do backend.

## Dados Envolvidos

| Entidade | Campos relevantes |
|----------|-------------------|
| `supabaseBackendState` | `enabled`, `hasEnv`, `hasSdk`, `sessionStatus`, `user`, `memberships`, `activeUnit`, `writable`, `source`, `syncStatus`, `conflictStatus`, `lastRemoteCheckpoint`, `lastError`. 🟢 |
| `Membership` | `membershipId`, `displayName`, `role`, `active`, `unitId`, `unitName`, `unitSlug`, `unitTimezone`, `unitActive`. 🟢 |
| `Checkpoint` | `revision`, `maxUpdatedAt`, `periodCount`, `auditCount`. 🟢 |
| `AppStore` | `version`, `activePeriod`, `preferences`, `periods`, `archives`. 🟢 |
| `Supabase tables` | `periods`, `period_settings`, `addon_types`, `student_attendances`, `addon_sales`, `pending_items`, `shift_notes`, `nps_period_metrics`, `nps_mentions`, `scale_days`, `scale_professor_shifts`, `events`. 🟢 |

## Rastreabilidade

| Comportamento | Arquivos |
|---------------|----------|
| Env, client, auth, memberships e estado público | `src/core/supabase.js` 🟢 |
| Load remoto e reconstrução de store | `src/core/supabase.js` 🟢 |
| Save remoto, checkpoint e conflito | `src/core/supabase.js` 🟢 |
| Persistir local antes de sync remota | `src/core/backup.js` 🟢 |
| Login, logout, reload e sync manual da UI | `src/ui/events-core.js`, `src/ui/render-settings.js` 🟢 |
| Migração assistida e dry-run | `src/features/diagnostics.js` 🟢 |
| RPCs guardadas e RLS | `supabase/migrations/*.sql`, `_reversa_sdd/sdd/supabase-database-rpcs.md` 🟢 |
| Contrato HTTP das RPCs | `_reversa_sdd/openapi/supabase-rpcs.yaml` 🟢 |
| Testes de fallback, checkpoint e conflitos | `tests/unit/runtime-env.test.js` 🟢 |

## Fora de Escopo

- 🟢 Merge automático campo a campo entre store local e remoto, por decisão operacional atual.
- 🟢 Resolução visual de conflito por diff, por decisão operacional atual.
- 🟢 Administração completa de usuários e memberships pela UI.
- 🟢 Garantia criptográfica do checkpoint como hash completo.
- 🟢 Bootstrap privilegiado de unidade/admin, coberto pelos RPCs de banco.

## Observações de Reimplementação

- 🟢 A sincronização remota deve ser posterior à persistência local; falha remota não pode apagar o trabalho local.
- 🟢 A ação de login não deve trocar a base automaticamente, porque isso poderia sobrescrever a experiência local sem confirmação.
- 🟢 O baseline remoto é parte central do contrato; sem ele, sync contra backend populado deve bloquear.
- 🟢 O estado público do backend deve ser suficiente para painel, bloqueios e diagnósticos.
- 🟢 Eventos críticos precisam `immediate: true`; eventos comuns devem usar debounce para reduzir chamadas.
- 🟢 Implementações futuras que adicionem merge devem preservar a proteção de checkpoint antes de qualquer escrita remota.
