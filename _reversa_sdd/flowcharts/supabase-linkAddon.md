# Fluxograma — `link_student_attendance_addon_transaction`

```mermaid
flowchart TD
  A[Recebe student_attendance_id] --> B[SELECT attendance FOR UPDATE]
  B --> C{Atendimento existe?}
  C -- Não --> D[Raise não encontrado]
  C -- Sim --> E[Carregar período]
  E --> F[require_unit_role admin/gestor/recepcao]
  F --> G{Atendimento tem addon?}
  G -- Não --> H[Deletar addon_sales derivada]
  H --> I[Auditar delete-linked-addon-sale]
  I --> J[Retornar saleAction deleted]
  G -- Sim --> K[Buscar venda derivada existente]
  K --> L{Venda existe?}
  L -- Não --> M[Inserir addon_sales source student_attendance]
  L -- Sim --> N[Atualizar addon_sales existente]
  M --> O[Auditar attendance-addon-link]
  N --> O
  O --> P[Retornar saleAction upserted]
```

## Regra

Venda de addon derivada de atendimento é mantida como linha única por atendimento e segue permissão de `admin`, `gestor` ou `recepcao`.
