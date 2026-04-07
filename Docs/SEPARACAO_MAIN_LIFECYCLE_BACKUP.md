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

### `src/core/backup.js`

- `loadStore()` / `saveStore()` / `saveData()`
- `getCommittedStoreSnapshot()`
- `buildBackupPayload()` e variantes de payload
- `exportBackup()` / `importBackup()`
- `saveLocalSnapshot()` / `restoreLocalSnapshot()`
- Coerção de backups legados e importação de arquivos de fechamento mensal

## Estratégia de compatibilidade

- A superfície pública exposta em `APP_INTERNALS` foi preservada.
- `main.js` continua sendo o último script carregado e o único ponto de bootstrap.
- `lifecycle.js` e `backup.js` continuam trabalhando com globais compartilhadas porque a aplicação ainda usa `<script>` tags sequenciais, não ES modules.
- As chamadas que antes partiam de `src/main.js` continuam acessíveis pelos mesmos handlers e fluxos de UI.
