# Fluxograma — Módulo `src/utils`

```mermaid
flowchart TD
  A[Helpers globais carregados antes do main.js] --> B[Sanitizacao e escape]
  A --> C[Formatacao e CSV]
  A --> D[Datas e periodos]
  A --> E[NPS e eventos]
  A --> F[Runtime style CSP]

  B --> B1[esc / sanitizeHtml / sanitizeDeep]
  C --> C1[formatDate / formatPct / buildCsvContent]
  D --> D1[getPeriodLabel / getPreviousPeriodKey / getNextPeriodKey]
  E --> E1[sortNpsMentionsByRanking / getRiskBand / normalizeEventType]
  F --> F1[applyRuntimeStyleData / setRuntimeStyle]

  B1 --> G[Consumido por renderizadores e features]
  C1 --> G
  D1 --> G
  E1 --> G
  F1 --> G
```

## Evidências

- `src/utils/helpers.js`: comentário inicial informa carregamento antes de `main.js` e exposição no escopo global.
- O arquivo agrupa sanitização, datas, CSV, NPS, eventos e runtime style.
