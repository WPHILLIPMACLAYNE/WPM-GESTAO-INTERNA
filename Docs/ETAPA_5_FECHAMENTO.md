# Fechamento da Etapa 5 — Modularização do WPM Gestão Interna

> **Aviso:** este documento é um snapshot histórico do fechamento inicial da Etapa 5 em `2026-04-05`.
> O retrato estrutural atual do runtime está em `MODULE_MAP.md` e `QWEN.md`.

**Data:** 5 de abril de 2026
**Projeto:** WPM Gestão Interna — SPA single-file, browser-only, script tags
**Arquitetura:** SPA de arquivo único com `<script>` tags sequenciais (sem ES modules, sem build step)

---

## 1. Resumo Executivo

A Etapa 5 transformou um single-file monolítico de **~6829 linhas de JavaScript inline** em uma estrutura modular de **10 módulos extraídos** mantendo a arquitetura de script tags sequenciais.

### Números de impacto

| Métrica | Antes | Depois | Mudança |
|---|---|---|---|
| JavaScript total em `src/` | 0 (inline no HTML) | 5689 linhas | Novo |
| `src/ui/render.js` | ~3546 linhas | 3129 linhas | **-11.8%** |
| Módulos extraídos | 0 | 10 | **+10** |
| Arquivos JS externos | 0 | 11 | **+11** |
| Testes Vitest | 112/112 | 112/112 | ✅ Estável |
| Testes Playwright | 19/19 | 19/19 | ✅ Estável |
| Total testes | 131/131 | 131/131 | ✅ 100% |

### Subetapas executadas (8 limpezas + 10 extrações)

| # | Subetapa | Tipo | Linhas afetadas |
|---|---|---|---|
| 1 | Extrair NPS actions → `features/nps.js` | Extração | 76 |
| 2 | Extrair CSV export → `features/csv.js` | Extração | 65 |
| 3 | Mover `compareByDateTime` → `utils/helpers.js` | Reposicionamento | 0 (já existia) |
| 4 | Isolar smoke tests → `features/diagnostics.js` | Extração | 111 |
| 5 | Extrair CRUD factory → `features/crud.js` | Extração | 172 |
| 6 | Mover validação UI → `features/forms.js` | Reposicionamento | 38 |
| 7 | Mover student-addon link → `features/crud.js` | Reposicionamento | 21 |
| 8 | Remover cópias duplicadas de date helpers | Limpeza | -36 |
| 9 | Remover `clamp` duplicata de `main.js` | Limpeza | -4 |
| 10 | Remover `formatRecadoDateTime` duplicata de `render.js` | Limpeza | -7 |

---

## 2. Checklist Final — O que foi modularizado

### Core (3 módulos, 918 linhas)

- [x] `src/core/config.js` (57 linhas) — Constantes (`STORAGE_KEY`, `STORE_VERSION`, `MONTH_NAMES`), helper `DOM`, `todayISO`
- [x] `src/core/schema.js` (135 linhas) — Migração de store, sanitização, validação de entidades
- [x] `src/core/storage.js` (726 linhas) — IndexedDB wrapper, localStorage, cache, broadcast channel, persistência

### Domain (1 módulo, 359 linhas)

- [x] `src/domain/selectors.js` (359 linhas) — Selectors memoizados com `cacheSelectores`: totais de addons, resumo de recepcionistas, pendências filtradas, ranking NPS, eventos agrupados, escala, indicadores dashboard

### Features (5 módulos, 736 linhas)

- [x] `src/features/forms.js` (312 linhas) — Form data getters, entity builders, validation, draft getters, validação UI (`apresentarErroValidacao`, `limparErrosValidacao`)
- [x] `src/features/crud.js` (172 linhas) — `createCrudHandler` (factory genérica), `handleSaveStudent`, `handleSavePending`, `handleSaveEvent`, `getStudentAddonLink`, `applyStudentAddonLink`
- [x] `src/features/csv.js` (65 linhas) — `csvEscape`, `buildCsvContent`, `downloadCsvFile`, row builders para pending/scale/events, export wrappers
- [x] `src/features/nps.js` (76 linhas) — `registerMention`, `adjustMention`, `setMentionCount`, `renameMention`, `removeMention`, `saveNpsObservations`
- [x] `src/features/diagnostics.js` (111 linhas) — `runFlowSmokeTests`, `loadFlowSmokeReport`, `saveFlowSmokeReport`, `clearFlowSmokeTests`, `renderFlowSmokePanel`

### Utils (1 módulo, 236 linhas)

- [x] `src/utils/helpers.js` (236 linhas) — Funções puras: `formatDate`, `esc`, `clamp`, `slugify`, `normalizeSearchText`, `compareByDateTime`, `getWeekdayLabel`, `suggestScaleTone`, `toneLabel`, `eventStatusClass`, `normalizeEventType`, `isDateInActivePeriod`, `getPeriodPrefix`, `getDefaultPeriodDate`, `getActivePeriodFallbackDate`, `getPeriodDisplayDate`, `formatRecadoDateTime`, `getNpsHistoryBandClass`, `getRiskBand`

### UI (2 módulos existentes, 3692 linhas)

- [x] `src/ui/events.js` (563 linhas) — `bindUIEvents()`: delegação de eventos (click, input, change, blur, submit), drag-and-drop de pendências, tooltips, acessibilidade, atalhos de teclado, sincronização de storage
- [x] `src/ui/render.js` (3129 linhas) — Render scheduler, patch DOM, todas as funções `render*`, recados module, students/addons render, pending render, NPS render, scale render, events render, settings render, import/export, system diagnostics

### Bootstrap

- [x] `src/main.js` (1056 linhas) — Persistence wrappers, UI feedback, period lifecycle, bootstrap (`initializeApp`), `APP_INTERNALS`

---

## 3. O que ficou transitório mas aceitável

### `src/ui/render.js` (3129 linhas)

| Bloco interno | ~Linhas | Situação |
|---|---|---|
| Render scheduler + patch DOM | ~250 | ✅ Interface estável, uso interno |
| Recados (CRUD + storage + migração legado) | ~360 | ⚠️ Monkey-patch `renderHero`/`renderDashboard`, storage próprio |
| Students + Addons (render + CRUD inline) | ~350 | ⚠️ CRUD e render fundidos |
| Pending (render + CRUD + DnD) | ~270 | ⚠️ 3 responsabilidades misturadas |
| NPS render | ~130 | ⚠️ `captureNpsRankSnapshot` chamado por `nps.js` |
| Scale CRUD | ~200 | ⚠️ CRUD async acoplado ao render |
| Events CRUD | ~200 | ⚠️ CRUD async acoplado ao render |
| Settings (render + actions) | ~80 | ⚠️ Actions misturadas com render |
| Import/Export | ~300 | ⚠️ Acoplado a persistence em `main.js` |
| System diagnostics | ~250 | ⚠️ Mistura lógica + render |

### `src/ui/events.js` (563 linhas)

Delegação de eventos que chama 40+ funções de outros módulos. Aceitável — é o papel legítimo de um event binder/controller.

### `src/main.js` (1056 linhas)

| Seção | ~Linhas | Situação |
|---|---|---|
| Persistence (`loadStore`, `saveStore`, `saveData`) | ~290 | ✅ Ponto central de persistência |
| UI feedback (`showToast`, `showConfirm`) | ~55 | ⚠️ Chamado por 12+ módulos |
| Period lifecycle (`switchPeriod`, `closeCurrentMonth`, lock) | ~410 | ⚠️ Acoplado a `state`, `storage`, `saveData`, `renderAll` |
| Bootstrap + APP_INTERNALS | ~200 | ✅ Orquestrador de inicialização |
| `normalizeData` | ~100 | ⚠️ Função grande de normalização de dados |

---

## 4. Principais ganhos arquiteturais

### 4.1 Dependências inversas eliminadas

| Antes | Depois | Ganho |
|---|---|---|
| `crud.js` → `apresentarErroValidacao` em `events.js` | `crud.js` → `apresentarErroValidacao` em `forms.js` | Feature → Feature (mesma camada) |
| `crud.js` → `applyStudentAddonLink` em `render.js` | `applyStudentAddonLink` definida em `crud.js` | Lógica de domínio fora de render |
| `crud.js` → `getActivePeriodFallbackDate` em `render.js` | `crud.js` → `getActivePeriodFallbackDate` em `helpers.js` | Helper puro na camada correta |
| `csv.js` → `compareByDateTime` em `render.js` | `csv.js` → `helpers.js` (já existia) | Dependência inversa eliminada |
| `render.js` → funções CSV em `csv.js` | `diagnostics.js` → `csv.js` | Dependência contida em feature |

### 4.2 Duplicatas eliminadas

- 7 helpers de data/período duplicados em `render.js` (já existiam em `helpers.js`)
- `compareByDateTime` duplicado em `render.js` (já existia em `helpers.js`)
- `clamp` duplicado em `main.js` (já existia em `helpers.js`)
- `formatRecadoDateTime` duplicado em `render.js` (já existia em `helpers.js`)

### 4.3 Separação conceitual

- CRUD genérico (`createCrudHandler`) separado de renderização
- Exportação CSV isolada como feature independente
- Smoke tests de fluxo concentrados em módulo próprio
- Validação UI movida para camada de forms
- Student-addon link movido para CRUD

### 4.4 Estabilidade preservada

- **131/131 testes passando** após todas as extrações
- Zero regressão funcional
- Zero alteração em `styles.css` (5213 linhas, inalterado)
- Zero alteração em `index.html` estrutural (apenas adição de `<script>` tags)

---

## 5. Riscos e limites do modelo atual de script tags

### 5.1 Estado global implícito

Todos os módulos compartilham estado via variáveis globais (`state`, `storage`, `currentPeriodKey`). Não há encapsulamento real — a "modularização" é conceitual, não de escopo.

**Impacto:** Qualquer módulo pode ler/escrever qualquer variável global. Não há como detectar efeitos colaterais acidentais estaticamente.

### 5.2 Ordem de carregamento frágil

Os 11 `<script>` tags devem ser carregados em ordem exata. Se `csv.js` vier antes de `helpers.js`, quebra silenciosamente.

```
1. utils/helpers.js
2. core/config.js
3. core/schema.js
4. core/storage.js
5. domain/selectors.js
6. features/forms.js
7. features/nps.js
8. features/csv.js
9. features/diagnostics.js
10. features/crud.js
11. ui/events.js
12. ui/render.js
13. main.js
```

**Impacto:** Adicionar um módulo na posição errada causa erros de referência em tempo de execução.

### 5.3 Dependências bidirecionais de facto

- `render.js` → `events.js`: `apresentarErroValidacao` (movido para `forms.js`, mas `events.js` ainda define `limparErroValidacaoCampo`)
- `crud.js` → `render.js`: `requestRender`, `finalize*SaveUI`, `render*SaveUI` (callbacks legítimos, mas acoplamento)
- `diagnostics.js` → `csv.js`: smoke test valida exportação CSV

**Impacto:** Não é possível carregar módulos em ordem arbitrária ou lazy-load.

### 5.4 `render.js` permanece como módulo Deus

Com 3129 linhas, contém 10+ responsabilidades distintas. Cada extração adicional exigiria resolver acoplamento bidirecional com renderização, o que não é trivial neste modelo.

**Impacto:** O arquivo mais crítico do sistema continua sendo o mais difícil de manter e testar isoladamente.

### 5.5 `main.js` como cola inevitável

Com 1056 linhas, atua como persistence layer + UI feedback + period lifecycle + bootstrap. Sem ES modules com injeção de dependências, não há para onde mover essas responsabilidades sem criar indireção artificial.

**Impacto:** `main.js` é o ponto de acoplamento máximo — tudo depende direta ou indiretamente dele.

---

## 6. Contexto para continuidade

### Estrutura atual de arquivos

```
/home/acewallthemac/storage/APP SPA GESTAO WPM/APLICATIVO FINALIZADO/
├── index.html              (934 linhas — HTML + 13 <script> tags)
├── styles.css              (5213 linhas — inalterado)
├── src/
│   ├── main.js             (1056 linhas — bootstrap + persistence + period lifecycle)
│   ├── core/
│   │   ├── config.js       (57 linhas)
│   │   ├── schema.js       (135 linhas)
│   │   └── storage.js      (726 linhas)
│   ├── domain/
│   │   └── selectors.js    (359 linhas)
│   ├── features/
│   │   ├── crud.js         (172 linhas)
│   │   ├── csv.js          (65 linhas)
│   │   ├── diagnostics.js  (111 linhas)
│   │   ├── forms.js        (312 linhas)
│   │   └── nps.js          (76 linhas)
│   ├── ui/
│   │   ├── events.js       (563 linhas)
│   │   └── render.js       (3129 linhas)
│   └── utils/
│       └── helpers.js      (236 linhas)
├── tests/
│   ├── unit/               (7 arquivos, 112 testes Vitest)
│   ├── e2e/                (1 arquivo, 19 testes Playwright)
│   ├── helpers/
│   └── integration/
├── vitest.config.js
├── playwright.config.js
└── package.json
```

### Testes

- **Comando:** `npm test` (Vitest) + `npx playwright test`
- **Resultado:** 131/131 passando
- **Cobertura:** Unit tests para helpers, esc, validação, date helpers, CSV, forms, selectors. E2E para estrutura, responsividade, funcionalidade básica, CSP.

### O que NÃO foi extraído e por quê

| Bloco | Linhas aprox. | Razão |
|---|---|---|
| Recados module | ~360 | Monkey-patch de `renderHero`/`renderDashboard`, storage próprio com migração de legado |
| Students CRUD inline | ~350 | CRUD e render fundidos no mesmo bloco, sem fronteira clara |
| Pending CRUD + DnD | ~270 | Mistura render, CRUD e UI binding (drag-and-drop) |
| Scale CRUD async | ~200 | `saveScaleDay` é async com re-render interno |
| Events CRUD async | ~200 | `duplicateEventItem` é async, `saveEventItem` acoplado ao render |
| Import/Export | ~300 | Acoplado a `saveData` e `normalizeStore` em `main.js` |
| Period lifecycle | ~410 | Acoplado a `state`, `storage`, `saveData`, `renderAll` |
| System diagnostics | ~250 | Mistura lógica de teste com renderização de painéis |

### Se o próximo chat continuar

**Próximos passos razoáveis (se houver Etapa 6):**

1. **Resolver monkey-patch de recados** — extrair `renderFeedbackSummary`, `renderRecadosPanel`, `renderHeroRecadosBadge` para que não precisem monkey-patch de `renderHero`/`renderDashboard`
2. **Mover `normalizeData` para `core/schema.js`** — é lógica de sanitização/normalização de dados, não de bootstrap
3. **Avaliar migração para ES modules** — só faria sentido se houver ganho real de encapsulamento (injeção de dependências, tree-shaking, lazy-load)
4. **Adicionar testes unitários para CRUD factory** — a peça mais genérica do sistema não tem cobertura direta

**Próximos passos NÃO recomendados:**

- Extrair blocos acoplados de `render.js` sem resolver dependências bidirecionais primeiro
- Criar pseudo-módulos (arquivos separados que compartilham estado implícito sem melhorar fronteira)
- Refatorar `styles.css` (5213 linhas) — não é escopo de modularização JS

---

## 7. Veredito Final

**Etapa 5: ENCERRADA ✅**

A modularização atingiu um ponto de equilíbrio onde extrações adicionais teriam custo desproporcional ao ganho. Os 10 módulos extraídos têm fronteiras conceituais claras e o sistema está estável com 131/131 testes passando.

O que resta em `render.js` (3129 linhas) e `main.js` (1056 linhas) são blocos intrinsecamente acoplados ao modelo de script tags sequenciais. Separá-los exigiria mudança arquitetural para ES modules com injeção explícita de dependências — uma Etapa 6 de natureza diferente.

**Créditos:** Wallace Phillip Maclayne — WPM Gestão Interna v34
