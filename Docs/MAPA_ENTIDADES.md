# MAPA_ENTIDADES — Preparação para Backend

Data: 2026-04-10
Base auditada: commit `f6f08ea`

## Store principal

Persistência atual:

- IndexedDB: database `wpm-gestao-interna-db`, store `app_kv`.
- localStorage espelho: `recepcao-smartfit-dashboard-v34`.

Estrutura macro:

```json
{
  "version": 4,
  "activePeriod": "2026-04",
  "preferences": {
    "initializeMonthsWithTestData": false
  },
  "periods": {
    "2026-04": {}
  },
  "archives": {
    "2026-03": {
      "closedAt": "ISO datetime",
      "closedAtLabel": "string",
      "label": "Março/2026"
    }
  }
}
```

## Entidade: Período

Chave atual: `periods[YYYY-MM]`

Estrutura:

```json
{
  "settings": {},
  "students": [],
  "pending": [],
  "recados": [],
  "nps": {},
  "scale": [],
  "events": [],
  "addons": {}
}
```

Volume esperado: 1 registro por mês por unidade.

Backend sugerido:

- Tabela `periods`.
- Colunas: `id`, `unit_id`, `period_key`, `status`, `closed_at`, `created_at`, `updated_at`.
- Constraint única: `unit_id + period_key`.

## Entidade: Configurações

Chave atual: `periods[YYYY-MM].settings`

Estrutura:

```json
{
  "team": ["Wallace"],
  "receptionists": ["Wallace"],
  "professors": ["Charles"],
  "addonTypes": ["Energy", "Body", "Coach"],
  "monthDays": 30
}
```

Volume esperado: pequeno, 1 objeto por período. Listas normalmente abaixo de 100 itens.

Backend sugerido:

- `unit_members` para recepcionistas/professores.
- `addon_types` para tipos.
- `period_settings` para snapshot mensal.

Autenticação/autorização:

- Leitura: usuários autenticados da unidade.
- Escrita: admin/gestor.

## Entidade: Alunos / Atendimentos

Chave atual: `periods[YYYY-MM].students`

Estrutura observada:

```json
{
  "id": "uuid",
  "nome": "string",
  "matricula": "string",
  "ultimaVisita": "YYYY-MM-DD",
  "horaVisita": "HH:mm",
  "inicio": "YYYY-MM-DD",
  "avisoNps": "string",
  "atendimento": "string",
  "feedback": "Positivo|Neutro|Negativo|string",
  "addon": "Energy|Body|Coach|string",
  "observacoes": "string"
}
```

Volume esperado: 0 a 1.000 registros/mês por unidade.

Operações:

- Criar atendimento.
- Editar dados.
- Excluir.
- Filtrar/exportar.
- Atualizar addon vinculado.

Backend sugerido:

- Tabela `student_attendances`.
- FK para `period_id`.
- Campos normalizados para atendente e addon quando possível.
- Índices: `period_id`, `matricula`, `atendimento`, `inicio`, `feedback`.

Riscos de migração:

- `atendimento` e `addon` hoje são strings livres; no backend devem virar FK ou manter campo legado.
- Duplicidade por matrícula/nome precisa de regra de negócio.

## Entidade: Addons

Chave atual: `periods[YYYY-MM].addons`

Estrutura:

```json
{
  "Wallace": {
    "Energy": [0, 1, 0, 2],
    "Body": [0, 0, 0, 1]
  }
}
```

O array representa contadores por dia do mês, índice `0 = dia 1`.

Volume esperado: `receptionists * addonTypes * monthDays`, geralmente baixo.

Backend sugerido:

- Tabela `addon_sales`.
- Colunas: `period_id`, `date`, `receptionist_id`, `addon_type_id`, `quantity`.
- Constraint única por `period/date/receptionist/addon_type`.

Autenticação/autorização:

- Leitura: equipe autenticada.
- Escrita: equipe/gestor, com auditoria.

Riscos:

- Atualização atual é incremental e pode divergir do atendimento vinculado em falha de save.
- Migração precisa expandir arrays em linhas por dia.

## Entidade: Pendências

Chave atual: `periods[YYYY-MM].pending`

Estrutura:

```json
{
  "id": "uuid",
  "nome": "string",
  "matricula": "string",
  "pendencia": "string",
  "data": "YYYY-MM-DD",
  "hostess": "string",
  "resposta": "string",
  "status": "aberto|respondido|concluido|string"
}
```

Volume esperado: 0 a 500 registros/mês.

Backend sugerido:

- Tabela `pending_items`.
- Índices: `period_id`, `status`, `data`, `hostess`, `matricula`.
- Histórico opcional de status em `pending_item_events`.

Autenticação/autorização:

- Leitura/escrita para equipe autenticada.
- Exclusão ou conclusão em massa deveria exigir permissão superior.

## Entidade: NPS

Chave atual: `periods[YYYY-MM].nps`

Estrutura:

```json
{
  "score": 75,
  "monthlyGoal": 75,
  "semesterGoal": 80,
  "observations": "string",
  "mentions": [
    {
      "id": "uuid",
      "name": "string",
      "count": 3
    }
  ],
  "rankSnapshot": {
    "uuid": 1
  }
}
```

Volume esperado: 1 objeto por período, com 0 a 100 menções.

Backend sugerido:

- `nps_period_metrics`.
- `nps_mentions`.

Autenticação/autorização:

- Escrita de score/meta/observações deve ser autenticada.
- Alteração de metas pode exigir gestor/admin.

## Entidade: Escala

Chave atual: `periods[YYYY-MM].scale`

Estrutura:

```json
{
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "rowTone": "neutral|green|string",
  "professorShifts": [
    {
      "id": "uuid",
      "time": "06h - 12h",
      "name": "string",
      "swap": "string"
    }
  ],
  "receptionTime": "string",
  "receptionist": "string",
  "receptionSwap": "string",
  "note": "string"
}
```

Volume esperado: até 31 dias por período, com múltiplos turnos por dia.

Backend sugerido:

- `scale_days`.
- `scale_professor_shifts`.
- Índices por `period_id`, `date`, `receptionist`.

Autenticação/autorização:

- Leitura para equipe.
- Escrita por gestor/admin ou função autorizada.

## Entidade: Eventos e ações

Chave atual: `periods[YYYY-MM].events`

Estrutura:

```json
{
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "type": "Ação|Campanha|Treinamento|Feriado|Evento|string",
  "title": "string",
  "place": "string",
  "owner": "string",
  "status": "Programado|Confirmado|Concluído|string",
  "description": "string"
}
```

Volume esperado: 0 a 200 eventos/mês.

Backend sugerido:

- Tabela `events`.
- Índices por `period_id`, `date`, `status`, `type`.

Risco atual:

- Checagem de duplicidade compara `entry.time` com ele mesmo, gerando falso positivo para horários diferentes.

## Entidade: Recados

Chave atual:

- Principal: `periods[YYYY-MM].recados`
- Legado: `wpm_recados_${YYYY-MM}`

Estrutura:

```json
{
  "id": "uuid",
  "from": "string",
  "to": "string",
  "text": "string",
  "createdAt": "ISO datetime",
  "read": false
}
```

Volume esperado: 0 a 500 recados/mês.

Backend sugerido:

- Tabela `shift_notes`.
- Opcional: `shift_note_reads` por usuário, caso "lido" deixe de ser global.

Autenticação/autorização:

- Criar recado: usuário autenticado.
- Marcar lido: usuário autenticado.
- Excluir: autor, gestor ou admin.

Riscos:

- Hoje `read` é booleano global, não por usuário.
- Migração deve consolidar chaves legadas antes de importar.

## Entidade: UI State

Chave atual: `controle_recepcao_app_ui_v34`

Conteúdo: aba ativa, filtros, preferências de visualização e controles de tela.

Volume esperado: pequeno por navegador.

Backend sugerido:

- Manter local por padrão.
- Só migrar para backend se houver login multi-dispositivo.

## Entidade: Snapshots e relatórios

Chaves atuais:

- `controle_recepcao_app_snapshot_v34`
- `controle_recepcao_app_report_v34`
- `controle_recepcao_app_flowtests_v34`

Uso:

- Snapshot local para restore rápido.
- Relatório de diagnóstico.
- Resultado de autotestes.

Backend sugerido:

- Snapshots podem virar `backup_exports` ou permanecer arquivo local.
- Relatórios podem virar logs operacionais se houver observabilidade.

## Operações críticas para backend

- Importar backup.
- Restaurar snapshot.
- Resetar mês.
- Fechar mês.
- Alterar configurações de equipe/tipos.
- Excluir entidades.
- Migrar dados legados.

Essas operações devem ter autenticação forte, autorização por papel e log de auditoria.

## Riscos gerais de migração

- Dados locais podem estar divergentes entre IndexedDB e localStorage.
- Não há `unit_id`/`tenant_id` no modelo atual.
- Strings de pessoas/tipos precisam virar entidades ou preservar histórico textual.
- Fechamento de mês precisa ser transacional.
- Offline/múltiplas abas precisam de estratégia de conflito.
- Datas devem ser migradas com timezone explícito.
- Dados gerados por seed em desenvolvimento não devem ir para produção.

