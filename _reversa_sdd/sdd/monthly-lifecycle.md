# Monthly Lifecycle

## Visão Geral

🟢 `src/core/lifecycle.js` implementa o ciclo mensal do WPM Gestão Interna: normalização de período, seleção de mês ativo, fechamento com arquivo JSON, bloqueio de edição, reset seguro e transição para o próximo mês.

🟢 O modelo operacional usa chaves `YYYY-MM` em `storage.periods` e marca meses fechados em `storage.archives[YYYY-MM]`.

🟢 Um período fechado passa a ser somente leitura na camada de ação e na camada visual; o mesmo bloqueio é reaproveitado quando o backend Supabase está autenticado em modo sem permissão de escrita.

## Responsabilidades

- 🟢 Normalizar `PeriodData` in-place por `normalizeData()`.
- 🟢 Detectar se um período está fechado por `isPeriodLocked()`.
- 🟢 Detectar se o período ativo está fechado por `isCurrentPeriodLocked()`.
- 🟢 Bloquear mutações por `canMutateCurrentPeriod()` e `assertWritableCurrentPeriod()`.
- 🟢 Integrar modo read-only do Supabase ao mesmo mecanismo de bloqueio.
- 🟢 Sincronizar estado disabled/ARIA/title de controles bloqueáveis.
- 🟢 Detectar se um período contém dados operacionais por `periodHasMeaningfulData()`.
- 🟢 Garantir existência de período por `ensurePeriod()`.
- 🟢 Sincronizar controles de mês, ano, badge e botão de fechamento.
- 🟢 Trocar o período ativo por `switchPeriod()`.
- 🟢 Fechar mês atual por `closePeriod()`.
- 🟢 Baixar arquivo `month-archive` no fechamento.
- 🟢 Criar, zerar ou preservar o próximo mês conforme dados existentes.
- 🟢 Fazer rollback do archive se a persistência do fechamento falhar.
- 🟢 Resetar o mês atual com backup prévio por `resetPeriod()`.
- 🟢 Duplicar escala do mês anterior por `duplicatePreviousMonthScale()`.
- 🟢 Sincronizar variáveis globais a partir de store preparado por `syncAppState()`.

## Interface

### Estado e Estruturas

| Nome | Tipo | Regra |
|---|---|---|
| `currentPeriodKey` | string | período ativo no formato `YYYY-MM`. 🟢 |
| `state` | PeriodData | dados do período ativo. 🟢 |
| `storage.activePeriod` | string | espelha `currentPeriodKey`. 🟢 |
| `storage.periods` | Object<string, PeriodData> | mapa de períodos mensais. 🟢 |
| `storage.archives` | Object<string, ArchiveEntry> | meses fechados e bloqueados. 🟢 |
| `ArchiveEntry` | object | `closedAt`, `closedAtLabel`, `label`. 🟢 |

### Sets de Bloqueio

| Nome | Escopo | Regra |
|---|---|---|
| `LOCKED_CURRENT_PERIOD_ACTIONS` | botões/ações `data-action` | bloqueia fechamento, reset, CRUD, configurações e restore. 🟢 |
| `LOCKED_CURRENT_PERIOD_CHANGE_ACTIONS` | inputs `data-change-action` | bloqueia inline updates e addons. 🟢 |
| `LOCKED_CURRENT_PERIOD_INPUT_ACTIONS` | inputs `data-input-action` | bloqueia score/meta NPS. 🟢 |
| `LOCKED_CURRENT_PERIOD_BLUR_ACTIONS` | edição em blur | bloqueia renomeações. 🟢 |
| `LOCKED_CURRENT_PERIOD_CONTROL_IDS` | IDs fixos de controles | bloqueia formulários de mês, alunos, pendências, NPS, escala, eventos e settings. 🟢 |

### API do Ciclo Mensal

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `normalizeData(data)` | PeriodData | void | completa defaults e converte legados. 🟢 |
| `isPeriodLocked(key)` | string | boolean | verdadeiro quando `storage.archives[key]` existe. 🟢 |
| `canMutateCurrentPeriod(options)` | options | boolean | valida archive e read-only backend. 🟢 |
| `assertWritableCurrentPeriod(options)` | options | boolean | alias de bloqueio para fluxos de ação. 🟢 |
| `syncCurrentPeriodLockUI()` | nenhum | void | aplica disabled/ARIA/title em controles. 🟢 |
| `periodHasMeaningfulData(period)` | PeriodData | boolean | detecta dados operacionais. 🟢 |
| `ensurePeriod(key, template)` | string, PeriodData | PeriodData | cria período se ausente e normaliza. 🟢 |
| `syncPeriodControls()` | nenhum | void | sincroniza seletor, badge, botão e bloqueio de UI. 🟢 |
| `switchPeriod(key, options)` | string, options | Promise<void> | troca mês ativo e salva. 🟢 |
| `changePeriodFromControls()` | nenhum | void | lê UI e chama `switchPeriod()`. 🟢 |
| `closePeriod()` | nenhum | void | fecha mês atual e abre próximo. 🟢 |
| `resetPeriod()` | nenhum | Promise<void> | exporta backup e zera mês atual. 🟢 |
| `duplicatePreviousMonthScale()` | nenhum | void | substitui escala atual pela anterior. 🟢 |
| `syncAppState(storeLike)` | Object|null | Promise<PeriodData> | prepara store e atualiza globals. 🟢 |

## Regras de Negócio

- 🟢 Períodos devem usar chave `YYYY-MM`.
- 🟢 O período ativo deve estar em `storage.activePeriod`, `currentPeriodKey` e `state`.
- 🟢 Um período é fechado quando existe entrada correspondente em `storage.archives`.
- 🟢 Período fechado deve bloquear mutações de atendimento, pendências, addons, NPS, escala, eventos, configurações e restore de snapshot.
- 🟢 Backend Supabase em modo sem escrita deve bloquear mutações como modo somente leitura.
- 🟢 Tentativa de mutar período bloqueado deve exibir toast de warning, salvo se `silent`.
- 🟢 `syncCurrentPeriodLockUI()` deve desabilitar controles e ajustar `aria-disabled`.
- 🟢 Controles marcados como `data-historical-readonly="true"` permanecem sempre desabilitados.
- 🟢 `ensurePeriod()` deve criar período ausente via `buildBootstrapPeriod()` e normalizar dados.
- 🟢 `switchPeriod()` deve criar período se necessário, atualizar globals, salvar e renderizar.
- 🟢 `closePeriod()` deve exigir confirmação antes de fechar.
- 🟢 Fechamento deve persistir estado atual antes de gerar payload de fechamento.
- 🟢 Fechamento deve baixar `smartfit-fechamento-YYYY-MM.json`.
- 🟢 Fechamento deve gravar `ArchiveEntry` com timestamp ISO, label local e nome do mês.
- 🟢 Fechamento deve avançar para `getNextPeriodKey(currentPeriodKey)`.
- 🟢 Se próximo mês não existe, deve ser criado por `buildBootstrapPeriod()`.
- 🟢 Se próximo mês existe e tem dados, usuário escolhe entre zerar ou preservar.
- 🟢 Se próximo mês existe sem dados, deve ser resetado para iniciar limpo.
- 🟢 Se persistência do fechamento falhar, o archive recém-criado deve ser revertido.
- 🟢 Reset de período deve exportar backup completo antes de apagar dados operacionais.
- 🟢 Reset preserva configurações de equipe e tipos de addon via `resetPeriodData()`.
- 🟢 Duplicação de escala deve copiar do mês anterior, gerar novos IDs e ignorar dias inexistentes no mês alvo.
- 🔴 O produto deve permitir reabrir mês fechado, mas não há fluxo explícito de reabertura/desarquivamento na UI atual.
- 🔴 `closePeriod()` concentra exportação, archive, criação/reset do próximo mês e rollback parcial no mesmo fluxo.

## Fluxo Principal

1. 🟢 Usuário aciona `close-current-month`.
2. 🟢 `bindCoreEvents()` chama `closeCurrentMonth()`, alias de `closePeriod()`.
3. 🟢 `closePeriod()` chama `assertWritableCurrentPeriod()`.
4. 🟢 Se o mês está fechado ou backend está read-only, o fluxo retorna com aviso.
5. 🟢 Se está gravável, `showConfirm()` pede confirmação de fechamento.
6. 🟢 Após confirmação, `getCommittedStoreSnapshot({ persistCurrent: true, eventType: 'close-month-backup' })` persiste estado atual.
7. 🟢 `buildMonthArchivePayload(committedStore, currentPeriodKey, currentLabel)` monta o payload de fechamento.
8. 🟢 O app gera Blob JSON e baixa `smartfit-fechamento-currentPeriodKey.json`.
9. 🟢 O archive anterior do período é preservado em variável para rollback.
10. 🟢 `storage.archives[currentPeriodKey]` recebe `closedAt`, `closedAtLabel` e `label`.
11. 🟢 `nextKey` é calculado por `getNextPeriodKey(currentPeriodKey)`.
12. 🟢 Se o próximo período não existe, ele é criado por `buildBootstrapPeriod()`.
13. 🟢 Se o próximo período existe com dados, o usuário escolhe zerar ou preservar.
14. 🟢 Se o próximo período existe sem dados, ele é resetado por `resetPeriodData()`.
15. 🟢 `saveData(true)` persiste o archive e os dados do próximo período.
16. 🟢 Se salvar falhar, o archive é revertido e o usuário recebe toast de erro.
17. 🟢 Se salvar funcionar, `switchPeriod(nextKey, { silent: true })` ativa o próximo mês.
18. 🟢 O usuário recebe toast de sucesso com a regra aplicada ao próximo mês.

## Fluxos Alternativos

- **Troca manual de período:** 🟢 `changePeriodFromControls()` lê `periodMonthSelect` e `periodYearInput`, monta `YYYY-MM` e chama `switchPeriod()`.
- **Período ausente ao trocar:** 🟢 `ensurePeriod()` cria período por bootstrap antes de ativar.
- **Reset de mês:** 🟢 `resetPeriod()` exige mês gravável, exporta backup, confirma e chama `resetPeriodData(currentPeriodKey, state)`.
- **Duplicação de escala:** 🟢 `duplicatePreviousMonthScale()` exige mês gravável, copia escala do mês anterior e substitui a atual.
- **Mês anterior sem escala:** 🟢 exibe toast warning e não altera dados.
- **Escala atual já preenchida:** 🟢 exige confirmação antes de substituir.
- **Backend Supabase read-only:** 🟢 `canMutateCurrentPeriod()` bloqueia mutação mesmo que o mês local esteja aberto.
- **Renderização de lock:** 🟢 `syncPeriodControls()` atualiza badge, botão de fechamento e chama `syncCurrentPeriodLockUI()`.
- **Import/restore de fechamento mensal:** 🟢 payload `month-archive` importado também grava `archives[periodKey]`, preservando a mesma semântica de fechado.

## Dependências

- `src/core/lifecycle.js` — componente principal do ciclo mensal.
- `src/core/backup.js` — `getCommittedStoreSnapshot()`, `buildMonthArchivePayload()`, `exportBackup()`, `saveData()`.
- `src/core/period-builder.js` — `buildBootstrapPeriod()`, `resetPeriodData()`.
- `src/core/schema.js` — `prepareStoreCandidate()` via `syncAppState()`.
- `src/core/supabase.js` — estado read-only e sync remoto por eventos críticos.
- `src/utils/helpers.js` — `getPeriodLabel()`, `getNextPeriodKey()`, `getPreviousPeriodKey()`, `isValidPeriodKey()`.
- `src/ui/events-core.js` — roteia ações de fechar/resetar/snapshot.
- `src/ui/render-*` — consome bloqueios por `assertWritableCurrentPeriod()` e `syncCurrentPeriodLockUI()`.
- Browser APIs — `Blob`, `URL.createObjectURL`, `document.createElement('a')`.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Integridade | Fechamento deve gerar arquivo antes de bloquear mês. | `buildMonthArchivePayload()`, Blob download | 🟢 |
| Segurança operacional | Mês fechado deve bloquear mutações. | `LOCKED_CURRENT_PERIOD_*`, `assertWritableCurrentPeriod()` | 🟢 |
| Recuperabilidade | Reset deve exportar backup antes de apagar. | `resetPeriod()` | 🟢 |
| Consistência | Falha ao salvar fechamento deve reverter archive local. | rollback em `finishClose()` | 🟢 |
| Acessibilidade | Controles bloqueados devem expor `aria-disabled`. | `syncCurrentPeriodLockUI()` | 🟢 |
| Compatibilidade | Período ausente deve ser criado sob demanda. | `ensurePeriod()` | 🟢 |
| UX/Operação | Próximo mês com dados exige escolha zerar/preservar. | `periodHasMeaningfulData()` + `showConfirm()` | 🟢 |

> Inferido do código. Validar com usuários se o bloqueio sem reabertura atende exceções operacionais reais.

## Critérios de Aceitação

```gherkin
Dado um mês aberto
Quando o usuário confirma o fechamento mensal
Então o app deve baixar um arquivo month-archive do período atual
E deve registrar storage.archives[currentPeriodKey]
E deve avançar para o próximo mês

Dado um mês já fechado
Quando o usuário tenta editar alunos, pendências, addons, NPS, escala, eventos ou configurações
Então a ação deve ser bloqueada
E deve exibir mensagem de mês fechado

Dado que o próximo mês não existe
Quando closePeriod concluir
Então o próximo mês deve ser criado por buildBootstrapPeriod

Dado que o próximo mês já possui dados
Quando closePeriod chegar na transição
Então o usuário deve escolher entre zerar e preservar os dados existentes

Dado que a persistência do fechamento falha
Quando saveData retornar falso
Então o archive criado deve ser revertido
E o período atual não deve ser tratado como fechado

Dado um mês aberto
Quando resetPeriod for confirmado
Então o app deve exportar backup completo antes do reset
E deve limpar os dados operacionais preservando configurações do período

Dado que o backend Supabase está read-only
Quando qualquer mutação local é acionada
Então canMutateCurrentPeriod deve bloquear a ação
E deve exibir mensagem de sessão somente leitura
```

## Cenários de Borda

- 🟢 **Período ativo sem entrada em `storage.periods`:** `ensurePeriod()` cria e normaliza antes de ativar.
- 🟢 **Archive anterior já existia:** `closePeriod()` preserva `previousArchive` para rollback.
- 🟢 **Falha ao salvar fechamento:** archive novo é removido ou restaurado ao valor anterior.
- 🟢 **Próximo mês com dados reais:** confirmação secundária decide reset/preservação.
- 🟢 **Próximo mês sem dados reais:** reset automático inicializa mês limpo.
- 🟢 **Escala duplicada para mês menor:** dias fora do mês alvo são ignorados e contados.
- 🟢 **Controle com título prévio:** lock salva título em `data-lock-hint` e restaura ao desbloquear.
- 🟢 **Renomeação contentEditable:** lock altera `contentEditable`, `tabindex` e `aria-disabled`.
- 🟡 **Download de fechamento falha no navegador:** não há catch explícito ao clique/Blob; o fluxo segue para archive.
- 🔴 **Reabertura de mês fechado:** decisão humana confirmou que deve existir, mas não há comando operacional documentado para remover `storage.archives[key]`.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Fechar mês com arquivo JSON | Must | Marco operacional do ciclo mensal. |
| Bloquear edição de mês fechado | Must | Evita alteração retroativa acidental. |
| Avançar para próximo mês | Must | Fluxo principal após fechamento. |
| Rollback de archive em falha | Must | Evita estado fechado sem persistência confiável. |
| Reset com backup prévio | Must | Protege contra perda de dados manual. |
| Sincronizar UI locked/read-only | Should | Mantém experiência coerente e acessível. |
| Escolha zerar/preservar próximo mês | Should | Evita perda quando já há dados no mês seguinte. |
| Duplicar escala anterior | Could | Conveniência operacional, não núcleo do fechamento. |

> Prioridade inferida pela posição no fechamento mensal, nos bloqueios de CRUD e na operação local-first.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `src/core/lifecycle.js` | `LOCKED_CURRENT_PERIOD_ACTIONS`, `LOCKED_CURRENT_PERIOD_CHANGE_ACTIONS`, `LOCKED_CURRENT_PERIOD_INPUT_ACTIONS`, `LOCKED_CURRENT_PERIOD_BLUR_ACTIONS` | 🟢 |
| `src/core/lifecycle.js` | `LOCKED_CURRENT_PERIOD_CONTROL_IDS` | 🟢 |
| `src/core/lifecycle.js` | `normalizeData` | 🟢 |
| `src/core/lifecycle.js` | `isPeriodLocked`, `isCurrentPeriodLocked`, `getCurrentPeriodLockMessage` | 🟢 |
| `src/core/lifecycle.js` | `isBackendReadOnlyMode`, `getBackendReadonlyMessage` | 🟢 |
| `src/core/lifecycle.js` | `canMutateCurrentPeriod`, `assertWritableCurrentPeriod` | 🟢 |
| `src/core/lifecycle.js` | `syncCurrentPeriodLockUI` | 🟢 |
| `src/core/lifecycle.js` | `periodHasMeaningfulData`, `ensurePeriod` | 🟢 |
| `src/core/lifecycle.js` | `syncPeriodControls`, `switchPeriod`, `changePeriodFromControls` | 🟢 |
| `src/core/lifecycle.js` | `closePeriod`, `closeCurrentMonth` | 🟢 |
| `src/core/lifecycle.js` | `resetPeriod`, `resetSelectedMonth` | 🟢 |
| `src/core/lifecycle.js` | `duplicatePreviousMonthScale` | 🟢 |
| `src/core/lifecycle.js` | `syncAppState` | 🟢 |
| `src/core/backup.js` | `buildMonthArchivePayload`, `exportBackup`, `saveData` | 🟢 |
| `src/core/period-builder.js` | `buildBootstrapPeriod`, `resetPeriodData` | 🟢 |
| `src/utils/helpers.js` | `getPeriodLabel`, `getNextPeriodKey`, `getPreviousPeriodKey`, `isValidPeriodKey` | 🟢 |
| `src/ui/events-core.js` | ações `close-current-month`, `reset-selected-month`, `restore-local-snapshot` | 🟢 |
| `_reversa_sdd/flowcharts/core-closePeriod.md` | fluxo de fechamento mensal | 🟢 |
| `_reversa_sdd/adrs/002-monthly-period-archive-lock.md` | decisão de período mensal fechado | 🟢 |
