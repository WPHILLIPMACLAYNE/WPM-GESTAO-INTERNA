# Storage Adapter

## Visão Geral

🟢 `src/core/storage.js` implementa a camada de armazenamento local híbrida do WPM Gestão Interna, combinando IndexedDB, espelho/fallback localStorage, cache em memória, fila serializada de operações e broadcast cross-tab.

🟢 O objetivo do componente é manter o app local-first e operacional mesmo sem backend remoto, ao mesmo tempo oferecendo leitura síncrona por cache/localStorage para UI, testes e diagnóstico.

## Responsabilidades

- 🟢 Detectar erro de quota local via `QuotaExceededError` ou `code === 22`.
- 🟢 Ler, escrever e remover valores brutos do localStorage com tratamento de erro.
- 🟢 Testar disponibilidade de broadcast cross-tab via `STORAGE_BROADCAST_KEY`.
- 🟢 Serializar operações de escrita/remoção por `queueStorageOperation()`.
- 🟢 Manter `persistenceTechState` com modo, status, backend, broadcast, última operação e autoteste.
- 🟢 Normalizar opções de persistência em formato booleano ou objeto.
- 🟢 Emitir broadcast cross-tab com timestamp, sequência e tipo de evento.
- 🟢 Enumerar chaves atuais e legadas conhecidas para hidratação/migração.
- 🟢 Abrir IndexedDB `IDB_NAME` com object store `IDB_STORE_NAME`.
- 🟢 Persistir preferencialmente no IndexedDB e espelhar em localStorage.
- 🟢 Usar localStorage como backend primário quando IndexedDB não está disponível.
- 🟢 Hidratar cache em memória a partir de IndexedDB e fallback localStorage.
- 🟢 Expor leitura síncrona via cache/localStorage e leitura primária assíncrona via IndexedDB.
- 🟢 Remover chaves de IndexedDB, localStorage e cache.
- 🟢 Oferecer helpers JSON e fallback para chaves legadas.

## Interface

### Estado interno

| Nome | Tipo | Regra |
|---|---|---|
| `storageCache` | `Map<string,string>` | cache em memória para leituras síncronas. 🟢 |
| `storageCacheHydrated` | boolean | evita hidratação repetida. 🟢 |
| `idbOpenPromise` | Promise|null | singleton de abertura IndexedDB. 🟢 |
| `storageOperationQueue` | Promise | fila serial de operações. 🟢 |
| `storageBroadcastCounter` | number | sequência de eventos cross-tab. 🟢 |
| `persistenceTechState` | `PersistenceTechState` | estado técnico exibido em Configurações. 🟢 |

### API de leitura

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `hydrateStorageCache()` | nenhum | `Promise<void>` | carrega chaves conhecidas de IDB/localStorage. 🟢 |
| `readPrimaryStoredValue(key, options)` | key, updateCache | `Promise<string|null>` | tenta IDB, depois localStorage. 🟢 |
| `readStoredValue(key)` | key | `string|null` | lê cache, depois localStorage. 🟢 |
| `readStoredJson(key, fallback)` | key, fallback | valor parseado | retorna fallback em erro/ausência. 🟢 |
| `readStoredJsonWithFallback(primary, legacy, fallback)` | chaves | valor parseado | tenta chave primária e legadas. 🟢 |
| `hasStoredValue(key)` | key | boolean | verifica valor síncrono. 🟢 |
| `hasStoredValueWithFallback(primary, legacy)` | chaves | boolean | verifica qualquer chave. 🟢 |

### API de escrita/remoção

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `persistStoredValue(key, value, onQuotaMessage, options)` | string | `Promise<PersistenceResult>` | grava IDB primeiro e espelha localStorage. 🟢 |
| `persistStoredJson(key, value, ...)` | valor serializável | `Promise<PersistenceResult>` | serializa JSON antes de persistir. 🟢 |
| `writeStoredValue(key, value, msg)` | string | `Promise<boolean>` | wrapper booleano. 🟢 |
| `writeStoredJson(key, value, msg)` | valor | `Promise<boolean>` | wrapper JSON booleano. 🟢 |
| `removeStoredValue(key)` | key | `Promise<boolean>` | remove de IDB, localStorage e cache. 🟢 |
| `removeStoredValues(keys)` | array | `Promise<boolean>` | remove sequencialmente e exige sucesso total. 🟢 |
| `emitStorageBroadcast(type)` | eventType | `Promise<boolean>` | grava payload no localStorage broadcast key. 🟢 |

### Estruturas de retorno

| Estrutura | Campos | Regra |
|---|---|---|
| `PersistenceResult` | `ok`, `localPersisted`, `indexedDbPersisted` | indica sucesso global e backend utilizado. 🟢 |
| Broadcast payload | `ts`, `seq`, `type` | JSON armazenado em `STORAGE_BROADCAST_KEY`. 🟢 |
| `persistenceTechState.selfTest` | `status`, `detail` | usado por painel de Configurações/autoteste. 🟢 |

## Regras de Negócio

- 🟢 IndexedDB é o backend principal quando disponível.
- 🟢 localStorage é espelho quando IndexedDB persiste com sucesso.
- 🟢 localStorage vira backend primário quando IndexedDB não existe no `window`.
- 🟢 Falha de quota deve mostrar toast de armazenamento cheio.
- 🟢 Falha não quota de persistência deve mostrar toast de falha local.
- 🟢 Escritas e remoções devem ser enfileiradas para evitar corrida.
- 🟢 Falha do espelho localStorage não deve invalidar commit IndexedDB já bem-sucedido, exceto quando localStorage é o único backend.
- 🟢 Cache deve ser atualizado após persistência bem-sucedida.
- 🟢 Cache deve ser removido quando chave é removida.
- 🟢 Hidratação deve considerar chaves atuais e legadas.
- 🟢 Se IndexedDB tiver valor string, ele deve alimentar cache e espelho localStorage.
- 🟢 Broadcast cross-tab deve ser opcional e tolerante a falha.
- 🟢 JSON inválido deve retornar fallback em `readStoredJson`.
- 🟢 `persistenceTechState` deve renderizar Configurações quando atualizado, salvo se `rerender=false`.
- 🔴 Não há retry/backoff de IndexedDB após falha de gravação além do retorno de erro.

## Fluxo Principal

1. 🟢 Durante bootstrap, o app chama hidratação/leitura do store.
2. 🟢 `hydrateStorageCache()` coleta chaves conhecidas atuais e legadas.
3. 🟢 Para cada chave, tenta ler IndexedDB.
4. 🟢 Se IndexedDB contém string, atualiza cache e espelho localStorage.
5. 🟢 Se IndexedDB não contém string, tenta fallback localStorage.
6. 🟢 Leituras síncronas posteriores usam `storageCache` ou localStorage.
7. 🟢 Escritas chamam `persistStoredValue()` ou `persistStoredJson()`.
8. 🟢 A operação entra em `queueStorageOperation()`.
9. 🟢 Se IndexedDB existe, grava em object store `app_kv`.
10. 🟢 Após commit IDB, atualiza cache e tenta espelhar localStorage.
11. 🟢 Se IndexedDB não existe, grava direto no localStorage e atualiza cache.
12. 🟢 Remoções passam pela mesma fila e removem de todos os backends disponíveis.

## Fluxos Alternativos

- **IndexedDB indisponível:** 🟢 `persistStoredValue()` usa localStorage como backend principal.
- **IndexedDB falha com quota:** 🟢 retorna `ok=false` e mostra toast de armazenamento cheio.
- **IndexedDB falha sem quota:** 🟢 retorna `ok=false`, loga erro e mostra toast de falha local.
- **Espelho localStorage falha após IDB ok:** 🟢 retorna `ok=true`, `indexedDbPersisted=true`, `localPersisted=false` e loga warning quando não quota.
- **JSON inválido:** 🟢 `readStoredJson()` captura erro e retorna fallback.
- **Broadcast indisponível:** 🟢 `broadcastAvailable=false`; falha de emissão gera warning e retorna `false`.
- **Operação anterior falhou:** 🟢 `queueStorageOperation()` captura a falha anterior e continua com a próxima.

## Dependências

- `src/core/config.js` — fornece `STORAGE_KEY`, chaves legadas, `IDB_NAME`, `IDB_STORE_NAME`, `STORE_VERSION`.
- `window.indexedDB` — backend primário.
- `window.localStorage` — espelho/fallback e broadcast.
- `showToast()` — mensagens de quota/falha.
- `requestRender()` — atualização do painel de Configurações via `updatePersistenceTechState()`.
- `src/core/backup.js` — consome `readPrimaryStoredValue`, `persistStoredJson`, `removeStoredValues`, `emitStorageBroadcast`.
- `src/ui/render-settings.js` — exibe `persistenceTechState` e uso localStorage.
- Testes unitários/E2E — acessam helpers por `APP_INTERNALS.persistence` e limpam cache/storage.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Disponibilidade | App deve persistir localmente sem Supabase. | `src/core/storage.js`, `_reversa_sdd/architecture.md` | 🟢 |
| Disponibilidade | Sem IndexedDB, deve usar localStorage como fallback. | `persistStoredValue()` | 🟢 |
| Consistência | Escritas/remoções devem ser serializadas. | `queueStorageOperation()` | 🟢 |
| Observabilidade | Estado técnico deve expor backend, última operação e autoteste. | `persistenceTechState`, `render-settings.js` | 🟢 |
| Compatibilidade | Chaves legadas devem ser consideradas na hidratação/fallback. | `getKnownStorageKeys()` | 🟢 |
| Resiliência | JSON inválido não deve lançar para consumidores. | `readStoredJson()` | 🟢 |
| UX/Operação | Erro de quota deve orientar exportar backup e limpar dados antigos. | `persistStoredValue()` | 🟢 |

> Inferido a partir do código. Validar limites reais de quota por navegador em homologação operacional.

## Critérios de Aceitação

```gherkin
Dado que IndexedDB está disponível
Quando persistStoredValue grava uma chave
Então o valor deve ser salvo no IndexedDB
E o cache em memória deve ser atualizado
E o localStorage deve ser atualizado como espelho

Dado que IndexedDB não está disponível
Quando persistStoredValue grava uma chave
Então o valor deve ser salvo no localStorage
E o retorno deve indicar indexedDbPersisted=false

Dado que IndexedDB retorna QuotaExceededError
Quando persistStoredValue tenta gravar
Então a função deve retornar ok=false
E deve exibir mensagem de armazenamento local cheio

Dado que o cache contém uma chave
Quando readStoredValue é chamado com essa chave
Então o valor deve ser retornado do cache sem depender do IndexedDB

Dado que readStoredJson recebe JSON inválido
Quando a função tenta parsear o valor
Então deve retornar o fallback informado

Dado que uma remoção de chave é executada
Quando removeStoredValue conclui com sucesso
Então a chave deve ser removida do IndexedDB, localStorage e storageCache

Dado que uma aba salva dados com broadcast habilitado
Quando emitStorageBroadcast executa
Então o localStorage deve receber payload com ts, seq e type
```

## Cenários de Borda

- 🟢 **Falha localStorage durante probe de broadcast:** `broadcastAvailable` fica falso.
- 🟢 **Falha localStorage como espelho após IDB ok:** commit principal continua válido.
- 🟢 **Falha IDB na abertura:** `idbOpenPromise` é zerada no catch para permitir nova tentativa futura.
- 🟡 **Valor salvo no IDB não string:** hidratação ignora como valor primário e tenta localStorage.
- 🟢 **Remover várias chaves:** remove sequencialmente; retorno só é true se todas as remoções derem certo.
- 🔴 **Corrupção simultânea entre abas:** broadcast avisa outra aba, mas não há merge transacional local entre stores divergentes.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Persistir em IndexedDB | Must | Backend local primário e caminho crítico. |
| Fallback localStorage | Must | Mantém disponibilidade sem IndexedDB. |
| Cache síncrono | Must | UI e testes dependem de leitura imediata. |
| Fila serializada | Must | Evita corrida em gravações/remover. |
| Hidratação de chaves legadas | Should | Importante para migração e compatibilidade. |
| Broadcast cross-tab | Should | Mantém abas alinhadas, mas app ainda opera sem ele. |
| Painel técnico de persistência | Should | Diagnóstico operacional importante. |
| Autoteste de persistência | Could | Útil em Configurações, não é fluxo primário. |

> Prioridade inferida por posição na cadeia de persistência e dependência dos fluxos de backup/lifecycle/sync.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `src/core/storage.js` | `storageCache`, `idbOpenPromise`, `storageOperationQueue` | 🟢 |
| `src/core/storage.js` | `isQuotaExceededError` | 🟢 |
| `src/core/storage.js` | `readLocalStorageValue`, `writeLocalStorageValue`, `deleteLocalStorageValue` | 🟢 |
| `src/core/storage.js` | `queueStorageOperation` | 🟢 |
| `src/core/storage.js` | `persistenceTechState`, `updatePersistenceTechState` | 🟢 |
| `src/core/storage.js` | `emitStorageBroadcast`, `canUseStorageBroadcast` | 🟢 |
| `src/core/storage.js` | `withIndexedDbStore`, `idbGetValue`, `idbSetValue`, `idbDeleteValue` | 🟢 |
| `src/core/storage.js` | `hydrateStorageCache`, `readPrimaryStoredValue`, `readStoredValue` | 🟢 |
| `src/core/storage.js` | `persistStoredValue`, `persistStoredJson` | 🟢 |
| `src/core/storage.js` | `removeStoredValue`, `removeStoredValues` | 🟢 |
| `src/core/backup.js` | integração com store, broadcast e remoção de legados | 🟢 |
| `src/ui/render-settings.js` | painel técnico de persistência | 🟢 |
| `tests/unit/runtime-env.test.js` | persistência do store em cenários reais | 🟢 |
| `tests/e2e/*.spec.js` | leitura/limpeza via `APP_INTERNALS.persistence` | 🟢 |
