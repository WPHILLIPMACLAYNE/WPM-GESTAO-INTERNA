# Features / Business Actions

## Visão Geral

🟢 `src/features` implementa as ações de negócio acionadas pela UI: validação de formulários, salvamento CRUD, vínculo aluno-addon, ações NPS, exportação CSV, autotestes de fluxo, dry-run de migração e migração assistida para Supabase.

🟢 A camada opera sobre `state` e delega persistência para `saveData()`/`saveStore()`, respeitando bloqueio de período fechado e modo Supabase somente leitura.

🟢 O principal contrato transacional é `createCrudHandler()`: validar, aplicar mutação, persistir e fazer rollback do estado anterior se o salvamento falhar.

## Responsabilidades

- 🟢 Validar strings, números, datas e matrículas.
- 🟢 Ler drafts de aluno, pendência, evento, escala, configurações, menção NPS e observações NPS do DOM.
- 🟢 Construir entidades normalizadas para aluno, pendência e evento.
- 🟢 Aplicar upsert puro em `PeriodData`.
- 🟢 Apresentar erros de validação com `aria-invalid`, feedback global, toast e foco.
- 🟢 Criar handlers CRUD reutilizáveis por `createCrudHandler()`.
- 🟢 Fazer rollback para `previousState` quando `saveData()` falha.
- 🟢 Atualizar contador de addon vinculado a aluno salvo.
- 🟢 Confirmar evento duplicado por título, data e horário.
- 🟢 Registrar, ajustar, setar, renomear e remover menções NPS.
- 🟢 Capturar snapshot de ranking NPS antes de mutações.
- 🟢 Salvar observações NPS com debounce na camada de eventos.
- 🟢 Exportar pendências, escala e eventos em CSV UTF-8 com BOM.
- 🟢 Executar smoke tests de backup, CSV, reset simulado e cobertura anual.
- 🟢 Gerar dry-run de migração local/remota sem alterar estado real.
- 🟢 Definir prontidão de migração assistida.
- 🟢 Executar migração assistida com preflight, snapshot local, sync Supabase e reload remoto.

## Interface

### Módulos

| Arquivo | Papel |
|---|---|
| `src/features/forms.js` | validação, leitura de formulários, builders e apply-save. 🟢 |
| `src/features/crud.js` | factory CRUD, rollback e vínculo aluno-addon. 🟢 |
| `src/features/nps.js` | ações do ranking e observações NPS. 🟢 |
| `src/features/csv.js` | builders e download CSV. 🟢 |
| `src/features/diagnostics.js` | smoke tests, dry-run e migração assistida. 🟢 |

### API de Forms

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `normalizeNumericId(value)` | any | string | remove não dígitos. 🟢 |
| `validateStudent(data)` | Object | ValidationResult | exige nome e matrícula numérica se preenchida. 🟢 |
| `validatePending(data)` | Object | ValidationResult | exige nome/pendência e data no período ativo. 🟢 |
| `validateEvent(data)` | Object | ValidationResult | exige data/título e data no período ativo. 🟢 |
| `getStudentFormData()` | nenhum | Student draft | lê DOM de aluno. 🟢 |
| `getPendingFormData()` | nenhum | Pending draft | lê DOM de pendência. 🟢 |
| `getEventFormData()` | nenhum | Event draft | lê DOM de evento. 🟢 |
| `getScaleFormData()` | nenhum | ScaleEntry | lê escala e remove turnos vazios. 🟢 |
| `getSettingsFormData()` | nenhum | Object | deduplica equipes e tipos de addon. 🟢 |
| `applyStudentSave()` | store, formData, existing | SaveResult | valida e upserta aluno. 🟢 |
| `applyPendingSave()` | store, formData, existing | SaveResult | valida e upserta pendência. 🟢 |
| `applyEventSave()` | store, formData, existing | SaveResult | valida e upserta evento ordenado. 🟢 |
| `apresentarErroValidacao(erros)` | erros | void | marca campos, foca primeiro e mostra toast. 🟢 |

### API CRUD / NPS / CSV / Diagnóstico

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `createCrudHandler(config)` | CrudHandlerConfig | async function | factory transacional. 🟢 |
| `getStudentAddonLink(student)` | Student | link|null | resolve pessoa/tipo/dia. 🟢 |
| `applyStudentAddonLink(student, delta)` | Student, number | void | aplica delta clampado em addon. 🟢 |
| `saveStudent`, `savePending`, `saveEventItem` | nenhum | Promise<void> | aliases de handlers CRUD. 🟢 |
| `registerMention()` | nenhum | void | cria ou incrementa menção NPS. 🟢 |
| `adjustMention(id, delta)` | string, number | void | ajusta count sem negativo. 🟢 |
| `setMentionCount(id, value)` | string, number | void | define count absoluto sem negativo. 🟢 |
| `renameMention(id, name)` | string, string | void | renomeia menção. 🟢 |
| `removeMention(id)` | string | void | confirma e remove menção. 🟢 |
| `saveNpsObservations()` | nenhum | Promise<void> | persiste observações NPS. 🟢 |
| `exportPendingCsv()` | nenhum | string | baixa `pendencias-YYYY-MM.csv`. 🟢 |
| `exportScaleCsv()` | nenhum | string | baixa `escala-YYYY-MM.csv`. 🟢 |
| `exportEventsCsv()` | nenhum | string | baixa `eventos-YYYY-MM.csv`. 🟢 |
| `runFlowSmokeTests(silent)` | boolean | FlowSmokeReportItem[] | valida fluxos sem alterar dados reais. 🟢 |
| `runMigrationDryRun(silent)` | boolean | Promise<Object> | snapshot local/remoto e comparação. 🟢 |
| `getMigrationReadiness(report)` | Object|null | readiness | gate da migração assistida. 🟢 |
| `runAssistedMigrationToSupabase()` | nenhum | Promise<Object> | migração real guardada. 🟢 |

## Regras de Negócio

- 🟢 Toda ação mutável deve chamar `assertWritableCurrentPeriod()` antes de alterar `state`.
- 🟢 Aluno deve ter nome preenchido.
- 🟢 Matrícula preenchida deve conter apenas dígitos.
- 🟢 Pendência deve ter nome e descrição.
- 🟢 Data de pendência, quando preenchida e válida, deve pertencer ao período ativo.
- 🟢 Evento deve ter data e título.
- 🟢 Data de evento deve pertencer ao período ativo.
- 🟢 Eventos salvos devem ser ordenados por data/hora.
- 🟢 Erro de validação deve marcar campos e focar o primeiro campo inválido.
- 🟢 `createCrudHandler()` deve clonar `previousState` antes de aplicar mutação.
- 🟢 `apply*Save()` deve retornar `SaveResult` sem persistir diretamente.
- 🟢 Em falha de `saveData()`, o handler deve restaurar `state`, `storage.activePeriod` e `storage.periods[currentPeriodKey]`.
- 🟢 Em rollback, cache de selectors deve ser limpo e targets devem ser renderizados.
- 🟢 Ao editar aluno com addon anterior, contador anterior deve ser decrementado antes de incrementar o novo.
- 🟢 Delta de addon nunca pode deixar contador abaixo de zero.
- 🟢 Link aluno-addon usa `inicio || ultimaVisita || getActivePeriodFallbackDate()`.
- 🟢 Evento duplicado por data, horário e título normalizado deve exigir confirmação.
- 🟢 Registro NPS deve somar em menção existente case-insensitive ou criar nova com UUID.
- 🟢 Mutação NPS deve capturar rank snapshot antes de alterar menções.
- 🟢 CSV deve incluir BOM UTF-8.
- 🟢 Pendências, escala e eventos exportados devem ser ordenados por `compareByDateTime()`.
- 🟢 Escala CSV deve expandir múltiplos turnos de professores em múltiplas linhas.
- 🟢 Smoke tests devem usar clones/serialização e não alterar dados reais.
- 🟢 Dry-run de migração deve consolidar recados legados em clone.
- 🟢 Migração assistida deve exigir backend autenticado e writable.
- 🟢 Migração assistida só pode prosseguir se `getMigrationReadiness().canMigrate === true`.
- 🟢 Antes da migração assistida, deve salvar snapshot local.
- 🟢 Migração assistida deve sincronizar store via `queueSupabaseStoreSync(..., immediate:true)`.
- 🔴 `diagnostics.js` mistura domínio, renderização HTML de painéis e orquestração de migração.
- 🔴 CRUD depende de globais de UI/runtime em vez de injeção explícita de dependências.

## Fluxo Principal

1. 🟢 Usuário aciona salvar aluno, pendência ou evento.
2. 🟢 Evento de UI chama `saveStudent`, `savePending` ou `saveEventItem`.
3. 🟢 Handler criado por `createCrudHandler(config)` valida se o período é gravável.
4. 🟢 Handler clona `previousState`.
5. 🟢 Handler lê formulário por `getFormData()`.
6. 🟢 Handler localiza entidade existente na coleção.
7. 🟢 Handler chama `applySave(state, formData, existing)`.
8. 🟢 Se `result.ok` é falso, traduz erros e chama `apresentarErroValidacao()`.
9. 🟢 Se há duplicidade configurada, pede confirmação.
10. 🟢 No commit, `state` recebe `result.nextState`.
11. 🟢 Hook `onBeforeSave` executa regras complementares, como ajuste de addon.
12. 🟢 `saveData()` persiste store local e agenda sync remota quando aplicável.
13. 🟢 Se `saveData()` falha, handler restaura estado anterior, limpa cache, renderiza targets e mostra toast.
14. 🟢 Se salva, hook `onAfterSave` roda quando existir.
15. 🟢 UI é finalizada, render local específico executa e `requestRender(renderTargets)` agenda áreas impactadas.

## Fluxos Alternativos

- **Salvar aluno com addon:** 🟢 remove delta do registro anterior e aplica delta no novo vínculo.
- **Salvar evento duplicado:** 🟢 mostra confirmação antes de persistir.
- **Validação de aluno falha:** 🟢 campo `student_nome` ou `student_matricula` recebe erro e foco.
- **Validação de pendência falha:** 🟢 nome/matrícula/descrição/data são mapeados para campos específicos.
- **Registrar NPS existente:** 🟢 incrementa count da menção cujo nome bate sem diferenciar maiúsculas.
- **Remover NPS:** 🟢 exige confirmação antes de filtrar a menção.
- **Salvar observações NPS:** 🟢 persiste texto e mostra toast somente se salvar.
- **Exportar escala vazia:** 🟢 CSV ainda contém cabeçalho.
- **Smoke tests silenciosos:** 🟢 salvam relatório e renderizam settings sem toast final.
- **Dry-run sem backend autenticado:** 🟢 gera snapshot local e marca comparação remota indisponível.
- **Dry-run com backend vazio:** 🟢 readiness libera primeira migração.
- **Dry-run com divergência remota:** 🟢 readiness bloqueia migração assistida.
- **Migração assistida sem função de sync:** 🟢 retorna skipped `sync-function-missing`.

## Dependências

- `src/features/forms.js` — validação e apply-save.
- `src/features/crud.js` — transação CRUD e addon link.
- `src/features/nps.js` — mutações NPS.
- `src/features/csv.js` — exportação CSV.
- `src/features/diagnostics.js` — smoke tests, dry-run e migração.
- `src/core/lifecycle.js` — `assertWritableCurrentPeriod()`, `normalizeData()`.
- `src/core/backup.js` — `saveData()`, `saveStore()`, `buildBackupPayload()`, `saveLocalSnapshot()`.
- `src/core/storage.js` — relatórios persistidos e limpeza de legados.
- `src/domain/selectors.js` — cache limpo após mutações.
- `src/ui/events-*` — roteiam ações de usuário para features.
- `src/ui/render-*` — callbacks de finalização/renderização e painéis.
- `src/core/supabase.js` — estado backend, load remoto e sync guardada.
- Testes `tests/unit/runtime-env.test.js`, `tests/unit/selectors-real.test.js`, `tests/e2e/visual-states.spec.js`.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Integridade | CRUD deve rollbackar se persistência falhar. | `createCrudHandler()` | 🟢 |
| Segurança operacional | Ações mutáveis respeitam período fechado/read-only. | `assertWritableCurrentPeriod()` | 🟢 |
| Acessibilidade | Validação deve usar `aria-invalid` e foco no primeiro erro. | `apresentarErroValidacao()` | 🟢 |
| Compatibilidade | CSV deve abrir corretamente com BOM UTF-8. | `downloadCsvFile()` | 🟢 |
| Observabilidade | Smoke/dry-run salvam relatórios renderizáveis. | `saveFlowSmokeReport()`, `saveMigrationDryRunReport()` | 🟢 |
| Segurança de migração | Migração assistida exige dry-run/readiness. | `getMigrationReadiness()` | 🟢 |
| Resiliência | Smoke tests e dry-run usam clones, não estado real. | `structuredClone`, `cloneSerializable` | 🟢 |

> Inferido do código. Validar manualmente fluxos de erro reais de `saveData()` porque a maioria dos testes cobre caminhos controlados.

## Critérios de Aceitação

```gherkin
Dado um aluno sem nome
Quando saveStudent for chamado
Então deve marcar student_nome como inválido
E não deve chamar commit de persistência

Dado uma pendência com data fora do período ativo
Quando savePending for chamado
Então deve mostrar erro de data pertencente ao período atual

Dado um evento com mesmo título, data e horário de outro evento
Quando saveEventItem for chamado
Então deve pedir confirmação antes de salvar

Dado que saveData falha durante um CRUD
Quando o handler tratar a falha
Então state deve voltar para previousState
E storage.periods[currentPeriodKey] deve refletir o rollback

Dado um aluno editado com addon anterior
Quando o aluno é salvo com novo addon
Então o contador anterior deve decrementar
E o novo contador deve incrementar sem ficar negativo

Dado uma menção NPS existente
Quando registerMention usa o mesmo nome com caixa diferente
Então deve incrementar a menção existente

Dado que runMigrationDryRun detecta divergência remota
Quando getMigrationReadiness avaliar o relatório
Então canMigrate deve ser false
E runAssistedMigrationToSupabase deve bloquear o envio
```

## Cenários de Borda

- 🟢 **Matrícula vazia:** permitida em aluno/pendência.
- 🟢 **Matrícula com caracteres não numéricos:** normalizada, mas validação falha se difere do bruto preenchido.
- 🟢 **Data de pendência vazia:** permitida.
- 🟢 **Evento sem hora:** permitido se data e título existem.
- 🟢 **Turno de escala vazio:** removido de `professorShifts`.
- 🟢 **Configurações com nomes repetidos:** deduplicadas por `Set`.
- 🟢 **Addon link sem data:** usa fallback do período ativo.
- 🟢 **Addon link para pessoa/tipo inexistente:** não altera contador.
- 🟢 **Ajuste NPS negativo:** count é clampado em zero.
- 🟢 **Dry-run remoto com erro:** readiness bloqueia migração.
- 🟡 **Rollback após hook `onBeforeSave`:** restaura `state`, mas efeitos externos futuros em hooks exigiriam cuidado.
- 🔴 **Validação depende de DOM:** regras de erro e foco não são puramente testáveis sem ambiente browser.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| CRUD transacional com rollback | Must | Núcleo de gravação operacional. |
| Validação de aluno/pendência/evento | Must | Protege dados básicos. |
| Bloqueio de período/read-only | Must | Evita mutação indevida. |
| Vínculo aluno-addon | Must | Mantém ranking comercial consistente. |
| Ações NPS | Must | Fluxo central de ranking e metas. |
| CSV operacional | Should | Exportação útil, mas não bloqueia registro local. |
| Smoke tests | Should | Suporte de validação operacional. |
| Dry-run/migração assistida | Should | Crítico para adoção Supabase, mas não para uso local. |
| Render de painéis diagnósticos dentro de features | Could | Útil, porém responsabilidade misturada. |

> Prioridade inferida por frequência de uso e impacto direto em persistência local.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `src/features/forms.js` | `isNonEmptyString`, `isValidNumber`, `isPositiveNumber`, `isValidDateValue`, `normalizeNumericId` | 🟢 |
| `src/features/forms.js` | `validateStudent`, `validatePending`, `validateEvent` | 🟢 |
| `src/features/forms.js` | `getStudentFormData`, `getPendingFormData`, `getEventFormData`, `getScaleFormData`, `getSettingsFormData` | 🟢 |
| `src/features/forms.js` | `applyStudentSave`, `applyPendingSave`, `applyEventSave`, `apresentarErroValidacao` | 🟢 |
| `src/features/crud.js` | `getStudentAddonLink`, `applyStudentAddonLink`, `createCrudHandler` | 🟢 |
| `src/features/crud.js` | `saveStudent`, `savePending`, `saveEventItem` | 🟢 |
| `src/features/nps.js` | `registerMention`, `adjustMention`, `setMentionCount`, `renameMention`, `removeMention`, `saveNpsObservations` | 🟢 |
| `src/features/csv.js` | `downloadCsvFile`, `getPendingCsvRows`, `getScaleCsvRows`, `getEventsCsvRows` | 🟢 |
| `src/features/csv.js` | `exportPendingCsv`, `exportScaleCsv`, `exportEventsCsv` | 🟢 |
| `src/features/diagnostics.js` | `runFlowSmokeTests`, `loadFlowSmokeReport`, `saveFlowSmokeReport`, `clearFlowSmokeTests` | 🟢 |
| `src/features/diagnostics.js` | `buildMigrationStoreSnapshot`, `compareMigrationSnapshots`, `buildMigrationCandidateStore` | 🟢 |
| `src/features/diagnostics.js` | `runMigrationDryRun`, `getMigrationReadiness`, `runAssistedMigrationToSupabase` | 🟢 |
| `src/ui/events-*` | roteamento de ações para features | 🟢 |
| `tests/unit/runtime-env.test.js` | dry-run e migração assistida | 🟢 |
| `_reversa_sdd/flowcharts/features.md` | CRUD e migração assistida | 🟢 |
| `_reversa_sdd/flowcharts/features-runMigrationDryRun.md` | dry-run de migração | 🟢 |
