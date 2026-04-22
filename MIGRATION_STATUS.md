# MIGRATION_STATUS.md

## Estado Atual (2026-04-22)

- Baseline estável em produção: `origin/main` (`bc6307f`, GitHub Pages v34).
- Runtime atual usa módulos `render-*` e `events-*` (ver `MODULE_MAP.md`).
- Estrutura documental corrente alinhada em `MODULE_MAP.md` e `QWEN.md`.
- Última validação local concluída antes desta atualização documental:
  - `npm test -- --reporter=dot` → `140/140`
  - `node --check sw.js src/core/pwa.js` → `OK`
  - `npx playwright test tests/e2e/service-worker.spec.js --project=chromium` → `3/3`
- Último marco funcional fechado nesta trilha: `bd0216c` (`fix(pwa): versionar cache do service worker por revisao`).
- Neste ambiente local, Playwright pode falhar por dependência de sistema ausente (`libatk-1.0.so.0`); validar E2E em CI/runner com deps completas.
- Fluxo seguro para evoluções: `Docs/RETOMADA_SEGURA.md`.

> **Importante:** o restante deste documento é histórico de auditorias anteriores e
> não deve ser usado como fonte única de baseline técnico atual.

## Resumo Executivo (Histórico)

A migração do monólito `SISTEMA_FINALIZADO.html` para a estrutura modular atual preservou a **paridade funcional pública do `APP_INTERNALS`**, manteve o CSS-base do sistema e hoje opera com **116/116 testes Vitest** e **42/42 testes Playwright** aprovados, totalizando **158/158**. A auditoria confirmou que a divisão em arquivos melhorou navegação e testabilidade, mas **não criou isolamento real entre módulos**: o projeto continua baseado em `<script>` tags clássicos, globais compartilhados e forte dependência da ordem de carga. Durante a pós-auditoria foi necessária uma correção adicional em `src/ui/render.js` para estabilizar o patch de linhas de tabela no navegador real.

## Estado Validado (Histórico)

- `index.html` usa `<script>` tags clássicos, **sem `type="module"`**.
- Ordem de carga confirmada:
  - `src/utils/helpers.js`
  - `src/core/config.js`
  - `src/core/schema.js`
  - `src/core/storage.js`
  - `src/domain/selectors.js`
  - `src/features/forms.js`
  - `src/features/nps.js`
  - `src/features/csv.js`
  - `src/features/diagnostics.js`
  - `src/ui/render.js`
  - `src/features/crud.js`
  - `src/ui/events.js`
  - `src/main.js`
- O problema das pills já corrigido pelo usuário foi confirmado:
  - `studentStatusPill`
  - `npsPill`
  - `pendingPill`
- Correção adicional aplicada nesta auditoria:
  - `src/ui/render.js`: `aplicarPatchLinhas()` passou a usar caminho seguro para `<tr>`/`<td>` reais, eliminando quebra estrutural em Chromium durante fluxos CRUD.

## Mapa de Módulos

Mapa completo em `MODULE_MAP.md`. Resumo operacional:

| Arquivo | Camada | Responsabilidade | Status |
|---------|--------|------------------|--------|
| `src/utils/helpers.js` | Transversal | utilitários puros de string/data/CSV/NPS | ✅ OK |
| `src/core/config.js` | 1-Config | constantes, defaults e estado global-base | ✅ OK |
| `src/core/schema.js` | 3-Schema | migração, normalização e sanitização do store | ⚠ globais tardios |
| `src/core/storage.js` | 2-Persistência | IndexedDB/localStorage, fila serializada, seed e reset | ⚠ mistura camadas |
| `src/domain/selectors.js` | 4-Domínio | KPIs, rankings, filtros, memoização | ✅ OK |
| `src/features/forms.js` | 3-Schema | validação, builders e leitura de formulários | ✅ OK |
| `src/features/crud.js` | 6-UI | handlers CRUD reutilizáveis | ✅ OK |
| `src/features/csv.js` | 4-Domínio | serialização/export CSV | ⚠ utilidades duplicadas |
| `src/features/diagnostics.js` | 7-Diagnósticos | smoke tests e relatórios | ✅ OK |
| `src/features/nps.js` | 6-UI | mutações de ranking e observações NPS | ✅ OK |
| `src/ui/render.js` | 5-Renderização | scheduler, patch DOM e render de todas as abas | ⚠ arquivo muito grande |
| `src/ui/events.js` | 6-UI | delegação, atalhos, modais, DnD e a11y | ⚠ alto acoplamento |
| `src/main.js` | Orquestração transversal | bootstrap, persistência de alto nível e lifecycle mensal | ⚠ núcleo centralizado |

## Monólito × Modular

### Paridade pública do `APP_INTERNALS`

- Resultado: **nenhuma função pública do `APP_INTERNALS` original ficou ausente** na versão modularizada.
- Conclusão: a migração preservou a superfície pública formal do sistema.

### Diferenças encontradas fora da superfície pública

- Declarações presentes no monólito e não encontradas com o mesmo formato de declaração na versão modular:
  - `doSave`
  - `saveEventItem`
  - `savePending`
  - `saveStudent`
- Interpretação:
  - `saveStudent`, `savePending` e `saveEventItem` continuam funcionalmente presentes, mas aparecem como aliases/fluxos indiretos, não como a mesma declaração top-level.

- Declarações adicionadas pela modularização:
  - `createCrudHandler`
  - `doResizeMonth`
  - `sanitizeHtml`

### Duplicações entre módulos

- `buildCsvContent`: `src/features/csv.js`, `src/utils/helpers.js`
- `csvEscape`: `src/features/csv.js`, `src/utils/helpers.js`
- `eventStatusClass`: `src/ui/render.js`, `src/utils/helpers.js`
- `formatBytes`: `src/ui/render.js`, `src/utils/helpers.js`
- `formatPctPrecise`: `src/ui/render.js`, `src/utils/helpers.js`
- `formatPersistenceTimestamp`: `src/core/storage.js`, `src/utils/helpers.js`
- `getInitialPeriodKey`: `src/core/storage.js`, `src/utils/helpers.js`
- `getNextPeriodKey`: `src/main.js`, `src/utils/helpers.js`
- `getNpsGoalProgress`: `src/domain/selectors.js`, `src/utils/helpers.js`
- `getNpsHistoryBandClass`: `src/ui/render.js`, `src/utils/helpers.js`
- `getPeriodLabel`: `src/main.js`, `src/utils/helpers.js`
- `getPreviousPeriodKey`: `src/main.js`, `src/utils/helpers.js`
- `getRiskBand`: `src/ui/render.js`, `src/utils/helpers.js`
- `isValidPeriodKey`: `src/core/schema.js`, `src/utils/helpers.js`
- `normalizeEventType`: `src/ui/render.js`, `src/utils/helpers.js`
- `normalizeSearchText`: `src/ui/render.js`, `src/utils/helpers.js`
- `sanitizeDeep`: `src/core/storage.js`, `src/utils/helpers.js`
- `shortText`: `src/main.js`, `src/utils/helpers.js`
- `suggestScaleTone`: `src/ui/render.js`, `src/utils/helpers.js`
- `toneLabel`: `src/ui/render.js`, `src/utils/helpers.js`

## Auditoria CSS

- Variáveis CSS no monólito: `39`
- Variáveis CSS em `styles.css`: `39`
- Variáveis ausentes em `styles.css`: `nenhuma`
- Media queries no monólito: `14`
- Media queries em `styles.css`: `14`
- Media queries ausentes em `styles.css`: `nenhuma`
- Seletores do monólito ausentes em `styles.css`: `nenhum`
- Seletores adicionais em `styles.css`:
  - `#pending .kanban-scroll::-webkit-scrollbar`
  - `#pending .pending-table td`
  - `#pending .pending-table th`
  - `#pending .table-wrap td`
  - `.dragging`
  - `.modal.show .modal-content`
  - `.section.glass`
  - `.table-wrap::-webkit-scrollbar`
  - `.tabs::-webkit-scrollbar`
  - `[data-tooltip]::after`

## Dependências e Integridade Estrutural

- Não existem `import`/`export` reais em `src/`; logo, **imports circulares formais não se aplicam**.
- O projeto depende de **globais compartilhados** e de **acoplamento por ordem de carga**.
- `src/ui/events.js` e `src/main.js` são os principais pontos de acoplamento.
- `src/core/schema.js` e `src/core/storage.js` ainda trocam responsabilidades por referências tardias/globais.
- O lint básico reflete essa arquitetura:
  - o comando original com `--no-eslintrc` falha no ESLint 10
  - o equivalente com `--no-config-lookup` reporta muitos `no-undef` e `no-unused-vars`
  - a maioria dos achados vem de globais browser-only (`window`, `document`, `localStorage`, `indexedDB`, `console`) e de símbolos compartilhados entre arquivos clássicos (`STORE_VERSION`, `normalizeData`, `requestRender`, etc.)

## Seed Determinístico e Isolamento por Período

- `generatePeriodSeed('2026-07')` e `generatePeriodSeed('2026-08')` foram validados.
- Resultado por período validado:
  - `30` alunos
  - `20` pendências
  - `11` menções NPS
  - `31` registros de escala
  - `10` eventos
  - `4` pessoas em addons
- O seed é determinístico e os dados ficam confinados ao mês correto.
- Observação importante:
  - o **seed existe e funciona**, mas o bootstrap padrão do app continua inicializando meses vazios via `seedYear()` + `buildEmptyPeriodFromTemplate()`.

## Testes e Cobertura

### Suites executadas

- `npx vitest run --reporter=verbose`
  - `116/116` aprovados
- `npx playwright test --reporter=list`
  - `42/42` aprovados
- Total consolidado:
  - `158/158`

### Testes adicionados na pós-auditoria

- `tests/helpers/load-real-app.js`
  - helper para subir os scripts reais do app no ambiente de teste
- `tests/unit/selectors-real.test.js`
  - seed determinístico real
  - KPIs e totais de addons
  - filtro de pendências
  - ranking NPS + memoização
- `tests/e2e/workflows.spec.js`
  - 8 abas sem erro de console
  - CRUD completo de alunos
  - CRUD completo de pendências + kanban + CSV
  - CRUD completo de eventos
  - NPS com debounce e reload
  - exportar/resetar/importar backup
  - isolamento de períodos e reset mensal
- `tests/e2e/visual.spec.js`
  - regressão visual de 8 abas
  - viewports `1920x1080` e `1366x768`

### Gaps remanescentes

- A tabela de alunos é coberta funcionalmente, mas não há asserção literal de “11 colunas” por cabeçalho.
- A persistência IndexedDB não é testada isoladamente; os E2E validam persistência do app como caixa-preta.
- A regra “Saulo sem abertura sábado/feriado” não foi encontrada implementada no código atual, portanto não virou teste obrigatório nesta auditoria.

## Lint Básico

Comando equivalente executado:

```bash
npx eslint src/ --no-config-lookup --rule '{"no-undef": "error", "no-unused-vars": "warn"}'
```

Achados dominantes:

- `warning / no-unused-vars`
  - constantes globais de `config.js` aparecem como “não usadas” localmente porque são consumidas por outros arquivos clássicos
- `error / no-undef`
  - browser globals: `window`, `document`, `localStorage`, `indexedDB`, `console`, `structuredClone`
  - globais entre arquivos: `STORE_VERSION`, `requestRender`, `normalizeData`, `getInitialPeriodKey`, `setStoreVersion`, `cloneSerializable`, etc.

Conclusão:

- o lint atual mede mais a **arquitetura global clássica** do que defeitos reais isolados de cada arquivo.

## Checklist de Performance

- `aplicarHtmlSeMudou()` preservado: **sim**
- fila coalescida via `requestRender()` preservada: **sim**
- memoização com `lerSelectorMemorizado()` e cache limitado a `120` entradas: **sim**
- serialização de persistência via `queueStorageOperation()`: **sim**

## Problemas Encontrados e Corrigidos

- Correção já aplicada antes da auditoria:
  - pills de alunos/NPS/pendências movidas de `src/ui/events.js` para `src/ui/render.js`
- Correção aplicada na pós-auditoria:
  - `src/ui/render.js`: patch de linhas de tabela ajustado para preservar `<tr>` reais em Chromium
- Estabilização de testes adicionada:
  - helpers de seed nos testes Playwright passaram a esperar estado inicial consistente
  - navegação visual passou a usar `setActiveTab(..., true)` + `scrollTo(0, 0)` para eliminar flakiness por scroll/foco

## Recomendações Para Próximas Iterações

1. Criar fronteiras reais entre módulos, reduzindo o uso de globais implícitos e eliminando dependência frágil da ordem de `<script>`.
2. Quebrar `src/ui/render.js`, `src/ui/events.js` e `src/main.js` em unidades menores por domínio funcional.
3. Consolidar helpers duplicados em `src/utils/helpers.js` e remover cópias locais.
4. Decidir explicitamente se o bootstrap padrão deve continuar vazio ou passar a usar o seed determinístico.
5. Adicionar uma configuração de lint alinhada ao ambiente browser/global atual para reduzir ruído e aumentar sinal.

## Decisões Arquiteturais do QWEN Que Merecem Revisão

- Modularização por arquivos sem modularização semântica real (globais continuam dominando o fluxo).
- Colocação de responsabilidades de schema/persistência/UI state no mesmo arquivo (`src/core/storage.js`).
- Centralização de render, settings, import/export, diagnósticos e recados em `src/ui/render.js`.
- Dependência de `main.js` como orquestrador de quase tudo, mantendo alto acoplamento estrutural.
- Introdução de duplicatas utilitárias em vez de reutilização consistente de `src/utils/helpers.js`.
