# Backup / Import

## Visão Geral

🟢 `src/core/backup.js` implementa a camada de backup, snapshot local, importação JSON e persistência de alto nível do WPM Gestão Interna.

🟢 O componente transforma o estado local em payloads exportáveis, restaura payloads reconhecidos, valida schema por `prepareStoreCandidate()` e sincroniza estado em memória, UI, controles de período e diagnósticos após importação.

🟢 A importação aceita três famílias de dados: backup completo multi-período, fechamento mensal `month-archive` e payload legado de período único.

## Responsabilidades

- 🟢 Preparar store candidato por clone, migração, sanitização e versionamento.
- 🟢 Carregar store local da chave principal ou de chaves legadas.
- 🟢 Gerar store padrão quando nenhum dado válido existe.
- 🟢 Persistir store principal em `STORAGE_KEY`.
- 🟢 Remover chaves legadas após salvamento bem-sucedido.
- 🟢 Gerar payload de backup completo com metadados.
- 🟢 Gerar payload de fechamento mensal `month-archive`.
- 🟢 Calcular resumo agregado do backup.
- 🟢 Salvar snapshot local de restauração rápida.
- 🟢 Restaurar snapshot local após confirmação.
- 🟢 Exportar backup completo como arquivo JSON.
- 🟢 Validar arquivo importado por tamanho, extensão e tipo.
- 🟢 Ler arquivo importado via `FileReader`.
- 🟢 Detectar tipo de payload importado por descriptor.
- 🟢 Coagir payload reconhecido para `AppStore` válido.
- 🟢 Gerar backup preventivo antes de aplicar importação.
- 🟢 Aplicar importação, recarregar store persistido e sincronizar UI.
- 🟢 Capturar erros de leitura, validação e aplicação quando `captureError()` existe.

## Interface

### Payloads Exportáveis

| Payload | Campos | Regra |
|---|---|---|
| `app-backup` | `meta`, `version`, `activePeriod`, `preferences`, `periods`, `archives` | backup completo do store. 🟢 |
| `month-archive` | `meta`, `version`, `periodKey`, `periodLabel`, `data` | fechamento de um único mês. 🟢 |
| `local snapshot` | `savedAt`, `payload` | cópia rápida salva em storage local. 🟢 |

### API de Store e Backup

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `prepareStoreCandidate(storeLike)` | Object | AppStore|null | clona, migra, sanitiza e força `STORE_VERSION`. 🟢 |
| `readStoredStore(key)` | string | Promise<AppStore|null> | lê JSON e prepara store. 🟢 |
| `loadLocalStore()` | nenhum | Promise<AppStore> | chave principal, legadas ou default. 🟢 |
| `loadStore(options)` | `{skipRemote?}` | Promise<AppStore> | local primeiro, Supabase se disponível. 🟢 |
| `saveStore(storeLike, options)` | Object, options | Promise<boolean> | persiste store, broadcast e sync remoto opcional. 🟢 |
| `saveData(options)` | options | Promise<boolean> | copia `state` para `storage.periods[currentPeriodKey]`. 🟢 |
| `getCommittedStoreSnapshot(options)` | options | Promise<AppStore> | persiste opcionalmente antes de ler snapshot. 🟢 |
| `buildBackupPayload(options)` | options | Promise<Object> | payload completo exportável. 🟢 |
| `exportBackup()` | nenhum | Promise<void> | baixa JSON e salva snapshot local. 🟢 |

### API de Importação

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `extractImportedPayload(source)` | Object | Object|null | remove wrapper `payload` e sanitiza profundo. 🟢 |
| `isMonthArchivePayload(payload)` | Object | boolean | valida `periodKey` e `data`. 🟢 |
| `getMonthArchiveImportMeta(payload)` | Object | Object|null | extrai período, label e data exportada. 🟢 |
| `buildStoreFromMonthArchivePayload(payload, baseStore)` | Object, AppStore | AppStore|null | mescla mês importado no store atual. 🟢 |
| `getImportedPayloadDescriptor(source)` | Object | descriptor | classifica `month-archive`, `full-backup`, `legacy-period` ou `unknown`. 🟢 |
| `coerceImportedStore(source)` | Object | AppStore|null | converte payload reconhecido para store válido. 🟢 |
| `applyImportedStore(parsed, options)` | Object, options | Promise<BackupSummary> | salva, sincroniza app e retorna resumo. 🟢 |
| `importBackup(file)` | File | void | valida, lê, confirma e aplica importação. 🟢 |

## Regras de Negócio

- 🟢 Backup completo deve incluir `meta.kind = 'app-backup'`, versão do app e timestamp ISO.
- 🟢 Fechamento mensal deve incluir `meta.kind = 'month-archive'`, `periodKey`, `periodLabel` e `data` normalizado.
- 🟢 Antes de gerar backup completo, o estado atual deve ser persistido por padrão.
- 🟢 `exportBackup()` deve salvar snapshot local após disparar download.
- 🟢 Snapshot local deve ser armazenado em `LOCAL_SNAPSHOT_KEY` e limpar chaves legadas equivalentes.
- 🟢 Restauração de snapshot deve exigir período atual gravável.
- 🟢 Importação de arquivo deve exigir período atual gravável.
- 🟢 Arquivo importado deve ter no máximo 50MB.
- 🟢 Arquivo importado deve ser JSON por MIME `application/json` ou extensão `.json`.
- 🟢 Importação deve aceitar wrapper `{ payload }` ou payload direto.
- 🟢 Payload completo com `periods` substitui todos os dados atuais após confirmação.
- 🟢 Payload `month-archive` deve mesclar apenas o período informado no store atual.
- 🟢 Payload `month-archive` deve marcar o período importado como fechado em `archives`.
- 🟢 Payload legado de período único deve ser encapsulado no período inicial atual.
- 🟢 Toda importação reconhecida deve passar por `coerceImportedStore()` e `prepareStoreCandidate()`.
- 🟢 Antes de aplicar importação confirmada, o app deve chamar `exportBackup()` como backup preventivo.
- 🟢 Após aplicar importação, o app deve recarregar o store persistido por `readStoredStore(STORAGE_KEY)`.
- 🟢 Após aplicar importação, o app deve chamar `syncAppState()`, `renderAll()`, `syncPeriodControls()` e `runSystemDiagnostics(true)`.
- 🔴 Importação não implementa merge interativo de conflitos; backup completo substitui o store inteiro.
- 🔴 Deve haver validação de integridade/autenticidade do arquivo importado além da confirmação manual; isso não está implementado.

## Fluxo Principal

1. 🟢 Usuário seleciona arquivo JSON para importação.
2. 🟢 `importBackup(file)` verifica se o período atual é gravável.
3. 🟢 A função rejeita arquivo ausente, maior que 50MB ou sem formato JSON.
4. 🟢 `FileReader.readAsText(file)` lê o conteúdo.
5. 🟢 No `reader.onload`, o conteúdo é parseado como JSON.
6. 🟢 `getImportedPayloadDescriptor(parsed)` classifica o tipo de payload.
7. 🟢 `coerceImportedStore(parsed)` tenta converter o payload para `AppStore`.
8. 🟢 Se o store importado é inválido, lança erro de validação.
9. 🟢 O app exibe confirmação específica para `month-archive` ou backup completo.
10. 🟢 Após confirmação, `exportBackup()` gera backup preventivo do estado atual.
11. 🟢 `applyImportedStore(parsed, { eventType: 'import' })` aplica o payload.
12. 🟢 `applyImportedStore()` chama `coerceImportedStore()` novamente.
13. 🟢 `saveStore(normalized, { silent: true, eventType })` persiste o store.
14. 🟢 `readStoredStore(STORAGE_KEY)` recarrega o dado persistido.
15. 🟢 `syncAppState(committedStore)` sincroniza variáveis globais.
16. 🟢 UI, controles de período e diagnósticos são atualizados.
17. 🟢 O usuário recebe toast de sucesso com resumo da importação.

## Fluxos Alternativos

- **Exportação manual:** 🟢 `exportBackup()` monta payload completo, dispara download `smartfit-recepcao-backup-YYYY-MM-DD_HHhMM.json`, salva snapshot local e mostra toast.
- **Snapshot local:** 🟢 `saveLocalSnapshot()` persiste `{ savedAt, payload }` em `LOCAL_SNAPSHOT_KEY`.
- **Restauração de snapshot:** 🟢 `restoreLocalSnapshot()` lê chave atual ou legada e aplica via `applyImportedStore()`.
- **Backup para fechamento mensal:** 🟢 `buildMonthArchivePayload()` normaliza um único período e monta payload `month-archive`.
- **Importação de `month-archive`:** 🟢 `buildStoreFromMonthArchivePayload()` clona store atual, substitui só `periods[periodKey]` e atualiza `archives[periodKey]`.
- **Importação de payload legado:** 🟢 `coerceImportedStore()` cria `{ version, activePeriod, periods: { [initialKey]: payload }, archives: {} }`.
- **Erro de leitura:** 🟢 `reader.onerror` chama `captureError(stage='read-file')` e mostra toast.
- **Erro de validação:** 🟢 catch externo chama `captureError(stage='validate')` e mostra toast de arquivo inválido.
- **Erro de aplicação:** 🟢 catch interno chama `captureError(stage='apply')` e mostra toast de erro ao aplicar backup.

## Dependências

- `src/core/backup.js` — componente principal.
- `src/core/schema.js` — migração e sanitização do store.
- `src/core/storage.js` — leitura, escrita, remoção e broadcast local.
- `src/core/lifecycle.js` — `syncAppState()`, bloqueio de período e normalização de dados.
- `src/core/period-builder.js` — validação de período e labels mensais.
- `src/core/supabase.js` — sync remoto opcional acionado por `saveStore()`.
- `src/ui` — `renderAll()`, `syncPeriodControls()`, `showToast()` e `showConfirm()`.
- `src/utils` — `cloneSerializable()`, `sanitizeDeep()` e helpers de data.
- `window.FileReader`, `Blob`, `URL.createObjectURL`, elemento `<a>` — APIs browser de arquivo/download.
- `captureError()` — telemetria opcional de erros.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Segurança operacional | Import deve pedir confirmação e gerar backup preventivo. | `showConfirm()`, `exportBackup()` | 🟢 |
| Compatibilidade | Deve aceitar backup completo, fechamento mensal e legado. | `coerceImportedStore()` | 🟢 |
| Integridade | Todo payload importado deve passar por schema atual. | `prepareStoreCandidate()` | 🟢 |
| Disponibilidade | Falha no store local deve cair para default no load. | `loadLocalStore()` | 🟢 |
| Observabilidade | Erros devem ser capturados por estágio quando possível. | `captureError()` | 🟢 |
| UX/Operação | Mensagens de sucesso devem resumir períodos e registros. | `showToast(successMessage)` | 🟢 |
| Limite de recurso | Arquivo importado deve ter limite de 50MB. | `file.size > 50 * 1024 * 1024` | 🟢 |

> Inferido do código. Validar em homologação se 50MB cobre o volume real esperado de períodos históricos.

## Critérios de Aceitação

```gherkin
Dado que o usuário exporta um backup
Quando exportBackup executar
Então o estado atual deve ser persistido
E um arquivo JSON app-backup deve ser baixado
E um snapshot local deve ser salvo

Dado um arquivo maior que 50MB
Quando importBackup for chamado
Então a importação deve ser bloqueada
E deve exibir mensagem de arquivo muito grande

Dado um arquivo sem MIME application/json e sem extensão .json
Quando importBackup for chamado
Então a importação deve ser bloqueada
E deve exibir mensagem de formato inválido

Dado um backup completo válido
Quando o usuário confirmar a importação
Então o app deve exportar backup preventivo
E substituir o store atual pelo store importado normalizado

Dado um payload month-archive válido
Quando o usuário confirmar a importação
Então somente o período informado deve ser restaurado ou atualizado
E o archive desse período deve ser marcado como fechado

Dado um payload legado de período único
Quando coerceImportedStore for chamado
Então o payload deve ser encapsulado no período inicial atual
E o resultado deve ser um AppStore válido

Dado que applyImportedStore conclui
Quando o store importado é persistido
Então o app deve sincronizar estado, renderizar UI, atualizar controles e rodar diagnósticos
```

## Cenários de Borda

- 🟢 **Arquivo ausente:** `importBackup()` retorna sem ação.
- 🟢 **Período atual bloqueado:** `assertWritableCurrentPeriod()` impede importação e restauração.
- 🟢 **JSON inválido:** parse falha e gera erro de validação.
- 🟢 **Payload com wrapper `payload`:** `extractImportedPayload()` usa o conteúdo interno.
- 🟢 **Payload `month-archive` sem `periodLabel`:** label é derivado por `getPeriodLabel(periodKey)`.
- 🟢 **`meta.exportedAt` inválido:** archive usa data existente ou data atual como fallback.
- 🟢 **Snapshot inexistente:** restauração mostra mensagem informativa e não altera dados.
- 🟢 **Falha ao salvar store importado:** `applyImportedStore()` lança erro e preserva o fluxo de toast/capture.
- 🟡 **Falha no backup preventivo antes do import:** erro cai no catch de aplicação; a importação não prossegue.
- 🔴 **Backup completo importado por engano:** decisão humana confirmou que deve haver preview granular antes de apagar/substituir dados; a UI atual ainda não implementa esse preview.
- 🔴 **Arquivo JSON adulterado mas estruturalmente válido:** decisão humana indicou preferência por confirmação manual + assinatura/hash; assinatura/hash ainda não existem.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Exportar backup completo | Must | Proteção operacional central. |
| Importar backup completo | Must | Recuperação de dados e migração local. |
| Backup preventivo antes de import | Must | Evita perda acidental sem cópia anterior. |
| `prepareStoreCandidate()` no import | Must | Garante compatibilidade com schema atual. |
| Snapshot local | Should | Restauração rápida útil, mas não substitui arquivo externo. |
| `month-archive` | Should | Apoia fechamento mensal e restauração pontual. |
| Captura por estágio | Should | Facilita diagnóstico, mas app opera sem Sentry. |
| Resumo agregado de importação | Could | Melhora UX de confirmação pós-import. |

> Prioridade inferida pelo papel de backup/import como salvaguarda de dados local-first.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `src/core/backup.js` | `prepareStoreCandidate` | 🟢 |
| `src/core/backup.js` | `readStoredStore`, `loadLocalStore`, `loadStore` | 🟢 |
| `src/core/backup.js` | `saveStore`, `saveData` | 🟢 |
| `src/core/backup.js` | `getCommittedStoreSnapshot` | 🟢 |
| `src/core/backup.js` | `buildBackupPayloadFromStore`, `buildBackupPayload` | 🟢 |
| `src/core/backup.js` | `buildMonthArchivePayload` | 🟢 |
| `src/core/backup.js` | `getBackupSummary` | 🟢 |
| `src/core/backup.js` | `isLegacyPeriodPayload`, `extractImportedPayload` | 🟢 |
| `src/core/backup.js` | `isMonthArchivePayload`, `getMonthArchiveImportMeta` | 🟢 |
| `src/core/backup.js` | `buildArchiveEntryFromMonthArchivePayload`, `buildStoreFromMonthArchivePayload` | 🟢 |
| `src/core/backup.js` | `getImportedPayloadDescriptor`, `coerceImportedStore` | 🟢 |
| `src/core/backup.js` | `applyImportedStore`, `saveLocalSnapshot`, `restoreLocalSnapshot` | 🟢 |
| `src/core/backup.js` | `exportBackup`, `importBackup` | 🟢 |
| `src/core/lifecycle.js` | `syncAppState`, `resetPeriod` integração com backup | 🟢 |
| `src/main.js` | exposição em `APP_INTERNALS` | 🟢 |
| `_reversa_sdd/flowcharts/core-importBackup.md` | fluxo importBackup | 🟢 |
