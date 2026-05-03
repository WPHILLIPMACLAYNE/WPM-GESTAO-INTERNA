# Detective — Máquinas de Estado

Gerado em: 2026-05-02T17:42:27Z

## Período

Estados confirmados: `open`, `closed`.

```mermaid
stateDiagram-v2
  [*] --> open: periodo criado
  open --> closed: closePeriod / close_period_transaction
  closed --> closed: edicao bloqueada
```

| Transição | Gatilho | Regra |
|---|---|---|
| criar período | `ensurePeriod()`, bootstrap, import | período nasce aberto |
| `open` -> `closed` | fechamento mensal | exporta JSON, arquiva, bloqueia edição |
| `closed` -> edição | tentativa de ação | bloqueada por `assertWritableCurrentPeriod()` |

## Pendência

Estados confirmados: `aberto`, `respondido`, `concluido`.

```mermaid
stateDiagram-v2
  [*] --> aberto: nova pendencia
  aberto --> respondido: resposta ou movimento no Kanban
  respondido --> concluido: conclusao
  respondido --> aberto: retorno manual
  concluido --> respondido: retorno manual
```

🟢 **CONFIRMADO** — O teclado move status por ordem linear `aberto -> respondido -> concluido`. Drag/drop e edição também atualizam status.

## Evento / Ação

Estados confirmados no banco: `Programado`, `Confirmado`, `Concluído`, `Cancelado`.

```mermaid
stateDiagram-v2
  [*] --> Programado: novo evento ou duplicacao
  Programado --> Confirmado: validacao operacional
  Confirmado --> Concluido: execucao concluida
  Programado --> Cancelado: cancelamento
  Confirmado --> Cancelado: cancelamento
```

🟡 **INFERIDO** — O código permite editar status diretamente; a ordem acima representa o fluxo operacional provável.

## Feedback de Atendimento

Estados confirmados: `Pendente`, `Respondeu`, `Não respondeu`.

```mermaid
stateDiagram-v2
  [*] --> Pendente: novo atendimento
  Pendente --> Respondeu: feedback positivo/retorno
  Pendente --> "Não respondeu": sem retorno
  Respondeu --> Pendente: correcao manual
  "Não respondeu" --> Pendente: correcao manual
```

## Aviso NPS

Estados confirmados: `Sim`, `Não`, `Pendente`.

```mermaid
stateDiagram-v2
  [*] --> Pendente: valor remoto/default possivel
  Pendente --> Sim: aviso realizado
  Pendente --> Nao: aviso nao realizado
  Sim --> Pendente: correcao manual
  Nao --> Pendente: correcao manual
```

## Linha de Escala

Estados confirmados: `green`, `red`, `neutral`.

```mermaid
stateDiagram-v2
  [*] --> neutral: default
  neutral --> green: marcacao positiva
  neutral --> red: marcacao de atencao
  green --> neutral: correcao
  red --> neutral: correcao
```

🟡 **INFERIDO** — Os nomes indicam tom visual/operacional; o código não amarra cada cor a uma regra de negócio textual obrigatória.

## Sync Supabase

Estados confirmados: `idle`, `loading`, `queued`, `saving`, `conflict`, `error`.

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> loading: carregar remoto
  idle --> queued: save local agenda sync
  queued --> saving: debounce expirou
  saving --> idle: import guardado ok
  saving --> conflict: checkpoint divergente
  loading --> idle: leitura remota ok
  loading --> error: falha de leitura
  saving --> error: falha nao conflitiva
  conflict --> loading: recarregar backend
```

## Fonte do Store

Estados confirmados: `local`, `supabase`.

```mermaid
stateDiagram-v2
  [*] --> local: fallback padrao
  local --> supabase: leitura/sync remota bem-sucedida
  supabase --> local: erro, sign-out ou conflito
```
