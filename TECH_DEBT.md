# TECH_DEBT.md

## CRÍTICO (corrigir agora)

- Arquitetura ainda depende de `<script>` tags clássicos e globais implícitos; não há fronteiras reais entre módulos, o que mantém o sistema vulnerável a bugs de ordem de carga como o caso das pills.
- O split de UI melhorou a organização, mas `src/ui/render-dashboard.js`, `src/ui/render-settings.js`, `src/ui/events-core.js` e `src/main.js` ainda concentram responsabilidades demais e funcionam como “mini-monólitos”.
- `src/core/storage.js` mistura persistência, UI state, seed determinístico, builders de período e helpers de schema, reduzindo previsibilidade e dificultando testes localizados.
- O bootstrap padrão usa `seedYear()` + `buildEmptyPeriodFromTemplate()` e **não** consome `generatePeriodSeed()`. O seed determinístico existe e funciona, mas não alimenta a inicialização real do app.
- Há funções duplicadas entre `src/utils/helpers.js` e outros módulos (`csvEscape`, `buildCsvContent`, `formatBytes`, `getRiskBand`, `getNpsGoalProgress`, `normalizeSearchText`, `eventStatusClass`, `formatPersistenceTimestamp`, `shortText`, etc.), aumentando risco de divergência.

## MÉDIO (próximo sprint)

- `src/core/schema.js` depende de globais definidos depois ou fora do próprio arquivo (`getInitialPeriodKey`, `buildEmptyPeriodFromTemplate`, `getStoreVersion`, `setStoreVersion`, `cloneSerializable`, `normalizeData`), o que enfraquece a coesão da camada.
- O linting básico fica poluído por `no-undef` e `no-unused-vars` porque a configuração atual não modela a arquitetura browser-only baseada em globais; além disso, o comando original com `--no-eslintrc` está defasado no ESLint 10.
- Funções longas candidatas a split:
  - `src/core/storage.js`: `generatePeriodSeed`
  - `src/ui/events-core.js`: `bindUIEvents`
  - `src/ui/render-dashboard.js`: `renderDashboard`
  - `src/ui/render-settings.js`: `renderSettings`
- Ainda há resíduos de manutenção:
  - `TODO` de migração futura em `src/core/schema.js`
  - `console.warn` de fallback/sync em `src/utils/helpers.js` e `src/core/storage.js`
- Os testes visuais exigem helper determinístico e tolerância pequena de pixels por causa de rasterização e comportamento sticky; isso é aceitável, mas pede disciplina para evitar flakiness futura.

## BAIXO (backlog)

- `src/features/csv.js` carrega uma função auxiliar `list` sem papel claro na superfície pública.
- O mapa modular ainda contém arquivos de “suporte transversal” (`main.js`, `helpers.js`) que não se encaixam perfeitamente nas 7 camadas originais; vale revisar o modelo conceitual da modularização.
- O CSS está funcionalmente preservado, mas ganhou alguns seletores extras não presentes no monólito original:
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
- O requisito “Saulo sem abertura sábado/feriado” não foi encontrado implementado no código atual; precisa de validação funcional antes de virar teste obrigatório.
