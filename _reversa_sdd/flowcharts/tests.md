# Fluxograma — Módulo `tests`

```mermaid
flowchart TD
  A[Testes] --> B[Vitest unit]
  A --> C[Vitest integration]
  A --> D[Playwright E2E]
  A --> E[Playwright visual]

  B --> F[pure-functions]
  B --> G[loadRealApp + Happy DOM]
  C --> F
  D --> H[index.html real no navegador]
  E --> H

  G --> I[window.__APP_INTERNALS__]
  H --> I
  I --> J[Validar core/domain/features/ui/utils]
```

## Evidências

- `vitest.config.js`: unit/integration em `happy-dom`.
- `playwright.config.js`: E2E em Chromium com servidor HTTP local.
- `tests/helpers/load-real-app.js`: carrega scripts reais do `index.html`.
