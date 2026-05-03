# Schema / Migrations

## Visão Geral

🟢 `src/core/schema.js` define o contrato de schema do `AppStore` local, executando migração sequencial de versão, sanitização de formatos legados e normalização estrutural antes de qualquer store ser salvo ou consumido.

🟢 O componente trabalha junto com `src/core/period-builder.js`, `src/core/lifecycle.js` e `src/core/backup.js` para garantir que dados vindos de localStorage, IndexedDB, backup JSON ou Supabase sejam convertidos para `STORE_VERSION = 4`.

🟡 A migração V4 existe como placeholder de versão: o código registra a etapa e aplica o bump, mas não contém transformação incompatível explícita.

## Responsabilidades

- 🟢 Determinar versão efetiva do store por `getStoreVersion()`.
- 🟢 Aplicar versão no objeto por `setStoreVersion()`.
- 🟢 Migrar stores V0/V1/V2/V3 até V4 em ordem crescente.
- 🟢 Rejeitar stores cuja versão final não seja `STORE_VERSION`.
- 🟢 Aceitar formato legado de período único com `settings` e `students`.
- 🟢 Aceitar formato multi-período com `periods`, `activePeriod`, `archives` e `preferences`.
- 🟢 Remover períodos inválidos ou não-objetos durante sanitização.
- 🟢 Normalizar cada `PeriodData` por `normalizeData()`.
- 🟢 Preencher período ativo ausente com `buildBootstrapPeriod()`.
- 🟢 Criar store padrão com `getDefaultStore()`.
- 🟢 Completar os 12 meses do ano ativo por `seedYear()`.
- 🟢 Normalizar preferências por `normalizeStorePreferences()`.
- 🟢 Preparar qualquer candidato de store por `prepareStoreCandidate()` antes de persistir.

## Interface

### Constantes e Versão

| Nome | Tipo | Regra |
|---|---|---|
| `STORE_VERSION` | number | versão corrente do schema; atualmente `4`. 🟢 |
| `STORAGE_KEY` | string | chave primária do store local, `recepcao-smartfit-dashboard-v34`. 🟢 |
| `LEGACY_STORAGE_KEYS` | string[] | chaves antigas consideradas por `loadLocalStore()`. 🟢 |

### API de Migração

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `getStoreVersion(store)` | Object | number | retorna inteiro positivo ou `0`. 🟢 |
| `setStoreVersion(store, version)` | Object, number | Object | muta `store.version`. 🟢 |
| `migrateStoreToV1(store)` | Object | AppStore|null | V0 -> V1, bump sem transformação. 🟢 |
| `migrateStoreToV2(store)` | Object | AppStore|null | V1 -> V2, bump sem transformação. 🟢 |
| `migrateStoreToV3(store)` | Object | AppStore|null | V2 -> V3, bump sem transformação. 🟢 |
| `migrateStoreToV4(store)` | Object | AppStore|null | V3 -> V4, placeholder para futura migração real. 🟢 |
| `migrateStore(store)` | Object | AppStore|null | executa cadeia V1..V4 e valida versão final. 🟢 |

### API de Sanitização

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `sanitizeStore(parsed)` | Object | AppStore|null | aceita legado single-period ou multi-period. 🟢 |
| `normalizeStore(store)` | Object | AppStore | normaliza forma de store e seus períodos. 🟢 |
| `getDefaultStore()` | nenhum | AppStore | cria store inicial versionado e sanitizado. 🟢 |
| `prepareStoreCandidate(storeLike)` | Object | AppStore|null | clona, migra, sanitiza e força `STORE_VERSION`. 🟢 |
| `normalizeData(data)` | PeriodData | void | normaliza dados de período in-place. 🟢 |
| `seedYear(year, options)` | string/number | Object<string,PeriodData> | cria 12 períodos para o ano. 🟢 |

## Regras de Negócio

- 🟢 Todo store persistido deve sair de `prepareStoreCandidate()` com `version === STORE_VERSION`.
- 🟢 Store inválido, nulo, array ou não-objeto deve ser rejeitado.
- 🟢 Store legado com `settings` e `students` deve ser encapsulado em `periods[currentKey]`.
- 🟢 Store multi-período deve preservar apenas períodos com chave mensal válida.
- 🟢 Chave de período inválida deve ser descartada durante `sanitizeStore()`.
- 🟢 `activePeriod` inválido deve cair para `getInitialPeriodKey()`.
- 🟢 `periods`, `archives` e `preferences` não-objetos devem ser substituídos por objetos seguros.
- 🟢 Cada período preservado deve passar por `normalizeData()`.
- 🟢 Se o período ativo não existir após filtragem, deve ser criado a partir do primeiro período válido ou de `demoData`.
- 🟢 O ano do período ativo deve conter 12 entradas após sanitização multi-período.
- 🟢 `preferences.initializeMonthsWithTestData` deve virar booleano, usando default por runtime quando ausente.
- 🟢 `normalizeData()` deve completar arrays e campos legados de `scale/escala`, `events/eventos`, `nps.mentions`, `addons`, `students`, `pending` e `recados`.
- 🟢 JSON corrompido lido do armazenamento deve ser preservado em chave `_corrompido_` antes de retornar store nulo.
- 🔴 Não há downgrade de store acima de `STORE_VERSION`; versão final diferente de `4` retorna `null`.
- 🟢 A etapa V4 é um bump/marco de normalização sem transformação incompatível esperada, por decisão humana.

## Fluxo Principal

1. 🟢 `loadLocalStore()` tenta ler `STORAGE_KEY`.
2. 🟢 `readStoredStore()` lê o valor bruto com `readPrimaryStoredValue()`.
3. 🟢 O JSON é parseado.
4. 🟢 `prepareStoreCandidate()` clona o candidato por `cloneSerializable()`.
5. 🟢 `migrateStore()` calcula a versão atual com `getStoreVersion()`.
6. 🟢 Se versão menor que 1, aplica `migrateStoreToV1()`.
7. 🟢 Se versão menor que 2, aplica `migrateStoreToV2()`.
8. 🟢 Se versão menor que 3, aplica `migrateStoreToV3()`.
9. 🟢 Se versão menor que 4, aplica `migrateStoreToV4()`.
10. 🟢 Se a versão final não for `STORE_VERSION`, retorna `null`.
11. 🟢 `sanitizeStore()` transforma legado single-period ou multi-period em `AppStore`.
12. 🟢 `normalizeStore()` corrige `activePeriod`, mapas, preferências e períodos.
13. 🟢 `normalizeData()` normaliza cada período válido.
14. 🟢 `seedYear()` completa meses ausentes do ano ativo.
15. 🟢 `prepareStoreCandidate()` força `STORE_VERSION`.
16. 🟢 `saveStore()` persiste o store normalizado na chave principal.
17. 🟢 Chaves legadas são removidas após persistência bem-sucedida.

## Fluxos Alternativos

- **Store primário ausente:** 🟢 `loadLocalStore()` tenta cada chave em `LEGACY_STORAGE_KEYS`.
- **Todas as chaves ausentes ou inválidas:** 🟢 `getDefaultStore()` cria store inicial e `saveStore()` persiste silenciosamente.
- **JSON corrompido:** 🟢 `readStoredStore()` salva o conteúdo bruto em chave com sufixo `_corrompido_<timestamp>` e retorna `null`.
- **Formato legado single-period:** 🟢 `sanitizeStore()` cria store com `activePeriod=currentKey` e `periods[currentKey]=clone(parsed)`.
- **Formato multi-period com períodos inválidos:** 🟢 períodos inválidos são filtrados antes de `normalizeStore()`.
- **Período ativo sem dados:** 🟢 `normalizeStore()` cria período ativo por `buildBootstrapPeriod()`.
- **Preferências ausentes:** 🟢 `normalizeStorePreferences()` aplica `APP_STORE_PREFERENCE_DEFAULTS`.
- **Store remoto carregado do Supabase:** 🟢 `loadStore()` recebe candidato remoto e chama `saveStore()` com o mesmo pipeline de preparo.

## Dependências

- `src/core/config.js` — define `STORE_VERSION`, `STORAGE_KEY`, `LEGACY_STORAGE_KEYS` e defaults globais.
- `src/core/schema.js` — concentra `normalizeStore`, `getDefaultStore`, `migrateStore*` e `sanitizeStore`.
- `src/core/period-builder.js` — fornece versionamento, preferências, builders de período e `seedYear()`.
- `src/core/lifecycle.js` — fornece `normalizeData()` e regras de normalização de `PeriodData`.
- `src/core/backup.js` — consome o pipeline por `prepareStoreCandidate()`, `readStoredStore()`, `loadLocalStore()`, `loadStore()` e `saveStore()`.
- `src/core/storage.js` — fornece leitura/persistência física via IndexedDB/localStorage.
- `src/core/supabase.js` — integra stores remotos ao mesmo contrato local.
- `_reversa_sdd/data-dictionary.md` — descreve `AppStore`, `PeriodData` e estruturas aninhadas.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Compatibilidade | Stores legados devem continuar importáveis. | `LEGACY_STORAGE_KEYS`, `sanitizeStore()` | 🟢 |
| Integridade | Períodos inválidos devem ser descartados antes do uso. | filtro de `parsed.periods` | 🟢 |
| Resiliência | JSON corrompido não deve quebrar bootstrap. | `readStoredStore()` | 🟢 |
| Determinismo | Migrações devem executar em ordem fixa. | `migrateStore()` | 🟢 |
| Disponibilidade | Store padrão deve ser criado quando nada válido existe. | `getDefaultStore()`, `loadLocalStore()` | 🟢 |
| Operabilidade | Dado corrompido deve ser preservado para recuperação manual. | chave `_corrompido_` | 🟢 |
| Evolução | Nova versão deve ser representada por função dedicada. | `migrateStoreToV1..V4()` | 🟢 |

> Inferido do código. Validar com exemplos reais de backups antigos antes de remover qualquer chave legada.

## Critérios de Aceitação

```gherkin
Dado um store sem version
Quando prepareStoreCandidate for chamado
Então migrateStore deve aplicar V1, V2, V3 e V4 em ordem
E o resultado deve ter version igual a STORE_VERSION

Dado um store legado com settings e students
Quando sanitizeStore for chamado
Então o resultado deve conter activePeriod válido
E deve mover o payload legado para periods[activePeriod]

Dado um store multi-período com uma chave inválida
Quando sanitizeStore for chamado
Então a chave inválida deve ser descartada
E os períodos válidos devem ser normalizados

Dado um store sem período ativo materializado
Quando normalizeStore for chamado
Então periods[activePeriod] deve ser criado por buildBootstrapPeriod

Dado um store multi-período válido com meses ausentes no ano ativo
Quando sanitizeStore concluir
Então seedYear deve preencher os meses ausentes sem sobrescrever meses existentes

Dado um JSON corrompido salvo em STORAGE_KEY
Quando readStoredStore tentar carregar
Então deve preservar o valor bruto em chave corrompida
E deve retornar null para permitir fallback

Dado um store com version maior que STORE_VERSION
Quando migrateStore for chamado
Então o resultado deve ser null
```

## Cenários de Borda

- 🟢 **`store` é array:** `sanitizeStore()` retorna `null`.
- 🟢 **`periods` existe mas contém entradas inválidas:** entradas são descartadas por `isValidPeriodKey()` e validação de objeto.
- 🟢 **`activePeriod` inválido:** substituído por `getInitialPeriodKey()`.
- 🟢 **`preferences` não é objeto:** substituída por defaults normalizados.
- 🟢 **`archives` não é objeto:** substituído por `{}`.
- 🟢 **`settings.team` ausente:** `normalizeData()` usa recepcionistas ou defaults.
- 🟢 **`scale` legado em `escala`:** normalizado para `scale`.
- 🟢 **`events` legado em `eventos`:** normalizado para `events`.
- 🟢 **`nps.mentions` ausente:** normalizado para array vazio.
- 🟢 **`addons` ausente:** reconstruído a partir de alunos legados quando há `atendimento`, `addon` e data.
- 🟡 **Store remoto válido porém com versão futura:** rejeitado como incompatível; não há fluxo de downgrade.
- 🟢 **V4 placeholder:** decisão humana confirmou que foi bump/marco sem mudança incompatível esperada.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| `prepareStoreCandidate()` antes de persistir | Must | Caminho crítico de save/load/import/sync. |
| `migrateStore()` sequencial | Must | Garante versão compatível. |
| `sanitizeStore()` legado e multi-período | Must | Sustenta upgrade de dados existentes. |
| `normalizeData()` em cada período | Must | Evita UI quebrada por campos ausentes. |
| `seedYear()` para meses ausentes | Should | Preserva navegação anual completa. |
| Preservar JSON corrompido | Should | Ajuda recuperação operacional. |
| Preferências de seed por runtime | Should | Mantém produção limpa e desenvolvimento com dados de teste. |
| Placeholder V4 | Won't | Não entrega transformação real até existir mudança incompatível formalizada. |

> Prioridade inferida pelo uso em bootstrap, persistência, importação, Supabase e lifecycle mensal.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `src/core/config.js` | `STORE_VERSION`, `STORAGE_KEY`, `LEGACY_STORAGE_KEYS` | 🟢 |
| `src/core/schema.js` | `normalizeStore` | 🟢 |
| `src/core/schema.js` | `getDefaultStore` | 🟢 |
| `src/core/schema.js` | `migrateStoreToV1`, `migrateStoreToV2`, `migrateStoreToV3`, `migrateStoreToV4` | 🟢 |
| `src/core/schema.js` | `migrateStore` | 🟢 |
| `src/core/schema.js` | `sanitizeStore` | 🟢 |
| `src/core/period-builder.js` | `getStoreVersion`, `setStoreVersion` | 🟢 |
| `src/core/period-builder.js` | `normalizeStorePreferences`, `shouldInitializeMonthsWithTestData` | 🟢 |
| `src/core/period-builder.js` | `buildCleanPeriodFromTemplate`, `buildBootstrapPeriod`, `buildEmptyPeriodFromTemplate` | 🟢 |
| `src/core/period-builder.js` | `resetPeriodData`, `seedYear` | 🟢 |
| `src/core/lifecycle.js` | `normalizeData` | 🟢 |
| `src/core/backup.js` | `prepareStoreCandidate`, `readStoredStore`, `loadLocalStore`, `loadStore`, `saveStore` | 🟢 |
| `src/core/supabase.js` | preparação de store remoto e fallback Supabase | 🟡 |
| `src/features/diagnostics.js` | checks de normalização e round-trip | 🟢 |
| `_reversa_sdd/code-analysis.md` | lacuna V4 placeholder | 🟢 |
