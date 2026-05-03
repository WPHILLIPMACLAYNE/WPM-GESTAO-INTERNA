# Fluxograma — Importação de Payload Legado

```mermaid
flowchart TD
  A[Arquivo JSON importado] --> B[extractImportedPayload]
  B --> C{É month-archive?}
  C -- Sim --> D[buildStoreFromMonthArchivePayload]
  D --> E[Mesclar período e archives]
  C -- Não --> F{Tem periods?}
  F -- Sim --> G[prepareStoreCandidate full-backup]
  F -- Não --> H{É período único legado?}
  H -- Sim --> I[Encapsular em periods do mês inicial]
  H -- Não --> J[Rejeitar como desconhecido]
  E --> K[applyImportedStore]
  G --> K
  I --> K
  K --> L[saveStore]
  L --> M[syncAppState / renderAll / diagnostics]
```

## Regra

O legado aceita backup completo, fechamento mensal e payload de período único antigo, sempre passando por sanitização e normalização antes de persistir.
