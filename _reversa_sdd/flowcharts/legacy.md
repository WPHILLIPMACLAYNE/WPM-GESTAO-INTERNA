# Fluxograma — Módulo `Legacy`

```mermaid
flowchart TD
  A[SISTEMA_FINALIZADO.html monolítico] --> B[HTML]
  A --> C[CSS inline]
  A --> D[JS inline]
  D --> E[Legacy/app.js extraído]
  E --> F[Camadas lógicas internas]
  F --> G[core]
  F --> H[domain]
  F --> I[features]
  F --> J[ui]
  F --> K[utils]

  G --> L[src atual modular]
  H --> L
  I --> L
  J --> L
  K --> L
```

## Evidências

- `Legacy/SISTEMA_FINALIZADO.html` contém HTML, CSS e JS embutidos.
- `Legacy/app.js` contém o comentário "Mapa da arquitetura" com 8 camadas internas.
- `index.html` atual carrega `src/**/*.js`, não arquivos de `Legacy`.
