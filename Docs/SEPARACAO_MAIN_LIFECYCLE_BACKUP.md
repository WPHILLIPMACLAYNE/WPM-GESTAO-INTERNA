# Separação de Bootstrap, Lifecycle e Backup

## Objetivo

Reduzir o acoplamento de `src/main.js` sem alterar comportamento.

## Ordem de carga

No `index.html`, os scripts agora carregam nesta sequência final:

1. `src/ui/events-core.js`
2. `src/ui/events-students.js`
3. `src/ui/events-pending.js`
4. `src/ui/events-addons.js`
5. `src/ui/events-scale.js`
6. `src/ui/events-nps.js`
7. `src/core/backup.js`
8. `src/core/lifecycle.js`
9. `src/main.js`

`main.js` permanece por último porque é o bootstrap final do app. `backup.js` e `lifecycle.js` precisam estar carregados antes para expor as rotinas consumidas por `initializeApp()` e por `APP_INTERNALS`.

## Responsabilidades por arquivo

### `src/main.js`

- Mantém apenas `APP_INTERNALS`
- Expõe `initializeApp()`
- Registra o listener de `DOMContentLoaded`
- Orquestra o bootstrap final sem concentrar regras de negócio de backup ou lifecycle
- Passa a depender da política de inicialização de períodos definida em `storage.preferences.initializeMonthsWithTestData`

### `src/core/lifecycle.js`

- `normalizeData()`
- `syncAppState()`
- `syncPeriodControls()`
- `switchPeriod()`
- `changePeriodFromControls()`
- `closePeriod()` / `closeCurrentMonth`
- `resetPeriod()` / `resetSelectedMonth`
- `duplicatePreviousMonthScale()`
- Regras de bloqueio de mês fechado e navegação entre períodos
- Criação de novos períodos via `buildBootstrapPeriod()`, respeitando o toggle de seed do usuário

### `src/core/backup.js`

- `loadStore()` / `saveStore()` / `saveData()`
- `getCommittedStoreSnapshot()`
- `buildBackupPayload()` e variantes de payload
- `exportBackup()` / `importBackup()`
- `saveLocalSnapshot()` / `restoreLocalSnapshot()`
- Coerção de backups legados e importação de arquivos de fechamento mensal
- Persistência do objeto `preferences` no backup completo

## Política de seed no bootstrap

- Em ambiente de desenvolvimento (`http://localhost`, `127.0.0.1`), o default do toggle é `ON`.
- Em produção/file (`file://` e demais hosts), o default do toggle é `OFF`.
- Quando o toggle está ligado, períodos novos criados sem dados usam `generatePeriodSeed(periodKey)`.
- Quando o toggle está desligado, períodos novos usam `buildEmptyPeriodFromTemplate()`.
- O reset manual do mês continua vazio por definição, mesmo com o toggle ligado.

## Estratégia de compatibilidade

- A superfície pública exposta em `APP_INTERNALS` foi preservada.
- `main.js` continua sendo o último script carregado e o único ponto de bootstrap.
- `lifecycle.js` e `backup.js` continuam trabalhando com globais compartilhadas porque a aplicação ainda usa `<script>` tags sequenciais, não ES modules.
- As chamadas que antes partiam de `src/main.js` continuam acessíveis pelos mesmos handlers e fluxos de UI.
