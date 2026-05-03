# Fluxograma — `sanitizeHtml`

```mermaid
flowchart TD
  A[sanitizeHtml recebe HTML bruto] --> B{DOMPurify disponivel?}
  B -- Sim --> C[Chamar DOMPurify.sanitize]
  C --> D[Aplicar ALLOWED_TAGS]
  D --> E[Aplicar ALLOWED_ATTR]
  E --> F[Permitir data-* e manter conteudo]
  F --> G[Retornar HTML sanitizado]
  B -- Não --> H[console.warn]
  H --> I[Retornar esc(html)]
```

## Regra

Quando DOMPurify está ausente, o sistema prefere escapar todo o HTML a renderizar conteúdo bruto.
