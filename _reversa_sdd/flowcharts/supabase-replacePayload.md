# Fluxograma — `replace_period_from_payload`

```mermaid
flowchart TD
  A[Payload local do período] --> B[Extrair settings/students/pending/recados/nps/scale/events/addons]
  B --> C[clear_period_operational_data]
  C --> D[Upsert period_settings]
  D --> E[Recriar addon_types]
  E --> F[Inserir nps_period_metrics e nps_mentions]
  F --> G[Inserir student_attendances]
  G --> H[Inserir pending_items]
  H --> I[Inserir shift_notes]
  I --> J[Inserir scale_days e scale_professor_shifts]
  J --> K[Inserir events]
  K --> L[Expandir addons por pessoa/tipo/dia em addon_sales manual]
```

## Regra

O payload browser-only é substitutivo: antes de importar, os dados operacionais do período são limpos e reconstruídos em tabelas relacionais.
