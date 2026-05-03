# Fluxograma — Módulo `src/ui`

```mermaid
flowchart TD
  A[initializeApp] --> B[initializeStaticControls]
  B --> C[initUIBindings]
  C --> D[bindUIEvents]
  D --> E[bindPendingDnD / acessibilidade / atalhos / tooltips]
  E --> F[renderAll]
  F --> G[Normalizar estado e filtros]
  G --> H[Renderizar seções principais]
  H --> I[Sincronizar UI de período bloqueado]

  J[Usuário interage com DOM] --> K[Delegação em bindUIEvents]
  K --> L[dispatchUiBinding]
  L --> M[Handler de features/core/ui]
  M --> N[Mutação de estado ou persistência]
  N --> O[requestRender alvos]
  O --> P[executarRenderAgendado via requestAnimationFrame]
  P --> Q[renderSection por área suja]
  Q --> R[Patching DOM com preservação de foco]
  R --> I
```

## Evidências

- `src/ui/render-core.js`: `AREAS_RENDERIZACAO`, `RENDER_MAP`, `requestRender`, `executarRenderAgendado`, `renderAll`.
- `src/ui/events-core.js`: `bindUIEvents`, `collectUiEventBindings`, `dispatchUiBinding`, controles globais.
