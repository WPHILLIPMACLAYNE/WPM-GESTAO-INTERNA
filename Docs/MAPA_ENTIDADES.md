# MAPA_ENTIDADES — WPM Gestão Interna

Data: 2026-04-10
Base local auditada: commit `865586c`
Objetivo: documentar o modelo atual localStorage/IndexedDB e orientar a futura modelagem backend.

## Persistência atual

Backend local primário:

- IndexedDB database: `wpm-gestao-interna-db`
- Object store: `app_kv`

Espelho/fallback:

- localStorage

Chaves:

| Chave | Tipo | Conteúdo |
|---|---|---|
| `recepcao-smartfit-dashboard-v34` | atual | Store principal completo. |
| `recepcao-smartfit-dashboard-sync-v34` | atual | Evento de broadcast cross-tab. |
| `controle_recepcao_app_snapshot_v34` | atual | Snapshot local para restauração rápida. |
| `controle_recepcao_app_report_v34` | atual | Relatório de diagnóstico estrutural. |
| `controle_recepcao_app_flowtests_v34` | atual | Relatório de autotestes de fluxo. |
| `controle_recepcao_app_ui_v34` | atual | Estado de UI/filtros/aba ativa. |
| `wpm_recados_${YYYY-MM}` | legado | Recados por período antes da migração para store. |
| `recepcao-smartfit-dashboard-v33` | legado | Store antigo. |
| `recepcao-smartfit-dashboard-v24` | legado | Store antigo. |
| `controle_recepcao_app_snapshot_v33` | legado | Snapshot antigo. |
| `controle_recepcao_app_report_v33` | legado | Relatório antigo. |
| `controle_recepcao_app_flowtests_v33` | legado | Autotestes antigos. |
| `controle_recepcao_app_ui_v33` | legado | UI state antigo. |

Chaves dinâmicas:

- `${STORAGE_KEY}__probe__`
- `${STORAGE_KEY}__selftest__${Date.now()}`
- `${STORAGE_KEY}_corrompido_${Date.now()}`

## Store principal

Chave: `recepcao-smartfit-dashboard-v34`

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
      "closedAt": "2026-04-10T12:00:00.000Z",
      "closedAtLabel": "10/04/2026, 09:00:00",
      "label": "Março/2026"
    }
  }
}
```

Backend sugerido:

- `units`
- `periods`
- `period_archives`
- `app_preferences`
- `audit_events`

Autenticação: todo acesso a dados operacionais deve exigir usuário autenticado e vínculo com unidade.

## Entidade: Unidade

Status atual: implícita. O app assume uma única unidade/local.

Backend sugerido:

```json
{
  "id": "uuid",
  "name": "string",
  "timezone": "America/Sao_Paulo",
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime"
}
```

Volume esperado: 1 ou poucas unidades.

Operações com autenticação:

- Criar/editar unidade: admin.
- Ler unidade: usuários vinculados.

## Entidade: Usuário / membro da equipe

Status atual: nomes em strings dentro de `settings.receptionists`, `settings.professors`, `students.atendimento`, `pending.hostess`, `nps.mentions.name`, `scale.*`.

Estrutura backend sugerida:

```json
{
  "id": "uuid",
  "unitId": "uuid",
  "name": "string",
  "role": "admin|gestor|recepcao|professor|leitura",
  "active": true,
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime"
}
```

Volume esperado: dezenas por unidade.

Riscos de migração:

- Histórico usa nome como identificador. Renomear pessoas pode ter alterado registros antigos.
- Deve preservar `displayNameSnapshot` nas entidades históricas mesmo usando FK futura.

## Entidade: Período

Chave atual: `periods[YYYY-MM]`

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

Backend sugerido:

```json
{
  "id": "uuid",
  "unitId": "uuid",
  "periodKey": "2026-04",
  "status": "open|closed",
  "closedAt": "ISO datetime|null",
  "closedBy": "uuid|null",
  "label": "Abril/2026",
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime"
}
```

Volume esperado: 12 períodos/ano por unidade.

Constraint: `unitId + periodKey` único.

Operações com autenticação:

- Leitura: usuários da unidade.
- Criar/trocar período: equipe autenticada.
- Fechar/resetar: gestor/admin.

## Entidade: Configurações do período

Chave atual: `periods[YYYY-MM].settings`

```json
{
  "team": ["Wallace", "Charles"],
  "receptionists": ["Wallace"],
  "professors": ["Charles"],
  "addonTypes": ["Energy", "Body", "Coach"],
  "monthDays": 30
}
```

Backend sugerido:

- `period_settings`
- `addon_types`
- snapshots de membros ativos no período

Volume esperado: 1 objeto pequeno por período.

Operações com autenticação:

- Leitura: equipe.
- Escrita: gestor/admin.

Riscos:

- `team` mistura recepção e professores.
- Alterar configurações hoje pode reatribuir registros de nomes removidos.

## Entidade: Atendimento / Aluno novo

Chave atual: `periods[YYYY-MM].students`

```json
{
  "id": "uuid",
  "nome": "string",
  "matricula": "string",
  "ultimaVisita": "YYYY-MM-DD",
  "horaVisita": "HH:mm",
  "inicio": "YYYY-MM-DD",
  "avisoNps": "Sim|Não|Pendente",
  "atendimento": "string",
  "feedback": "Respondeu|Não respondeu|Pendente",
  "addon": "string",
  "observacoes": "string"
}
```

Volume esperado: 0 a 1.000 registros/mês por unidade.

Backend sugerido: `student_attendances`

Campos:

- `id`
- `periodId`
- `studentName`
- `membershipNumber`
- `lastVisitDate`
- `lastVisitTime`
- `startedAtDate`
- `npsNoticeStatus`
- `receptionistId`
- `receptionistNameSnapshot`
- `feedbackStatus`
- `addonTypeId`
- `addonTypeSnapshot`
- `notes`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

Índices:

- `periodId`
- `membershipNumber`
- `receptionistId`
- `startedAtDate`
- `feedbackStatus`

Operações com autenticação:

- Criar/editar: recepção/gestor/admin.
- Excluir: gestor/admin ou recepção com auditoria.
- Exportar: gestor/admin.

Riscos:

- Hoje não há regra forte de duplicidade por matrícula.
- Vínculo aluno-addon é uma mutação composta e deve virar transação.

## Entidade: Venda de addon

Chave atual: `periods[YYYY-MM].addons`

```json
{
  "Wallace": {
    "Energy": [0, 1, 0, 2],
    "Body": [0, 0, 0, 1]
  }
}
```

O array representa dia do mês: índice `0 = dia 1`.

Volume esperado: `recepcionistas * tipos * dias`; baixo a médio.

Backend sugerido: `addon_sales`

```json
{
  "id": "uuid",
  "periodId": "uuid",
  "date": "YYYY-MM-DD",
  "receptionistId": "uuid",
  "receptionistNameSnapshot": "string",
  "addonTypeId": "uuid",
  "addonTypeSnapshot": "string",
  "quantity": 2,
  "source": "manual|student_attendance",
  "studentAttendanceId": "uuid|null",
  "createdBy": "uuid",
  "updatedBy": "uuid"
}
```

Constraint sugerida: `periodId + date + receptionistId + addonTypeId + source/studentAttendanceId`.

Operações com autenticação:

- Leitura: equipe.
- Escrita manual: recepção/gestor.
- Ajuste retroativo: gestor/admin.

Riscos:

- Migração precisa expandir matriz em linhas.
- Quantidade ligada a atendimento pode divergir se rollback local falhar.

## Entidade: Pendência

Chave atual: `periods[YYYY-MM].pending`

```json
{
  "id": "uuid",
  "nome": "string",
  "matricula": "string",
  "pendencia": "string",
  "data": "YYYY-MM-DD",
  "hostess": "string",
  "resposta": "string",
  "status": "aberto|respondido|concluido"
}
```

Volume esperado: 0 a 500 registros/mês.

Backend sugerido: `pending_items`

Campos:

- `id`
- `periodId`
- `studentName`
- `membershipNumber`
- `description`
- `requestedAtDate`
- `assigneeId`
- `assigneeNameSnapshot`
- `response`
- `status`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

Opcional: `pending_item_events` para histórico de status.

Índices:

- `periodId`
- `status`
- `requestedAtDate`
- `assigneeId`
- `membershipNumber`

Operações com autenticação:

- Criar/editar/mover status: recepção/gestor.
- Excluir: gestor/admin ou com auditoria.

## Entidade: Recado

Chave atual: `periods[YYYY-MM].recados`
Chave legada: `wpm_recados_${YYYY-MM}`

```json
{
  "id": "uuid",
  "from": "string",
  "to": "Todos|string",
  "text": "string",
  "createdAt": "ISO datetime",
  "read": false
}
```

Volume esperado: dezenas a centenas por mês.

Backend sugerido: `shift_notes`

Campos:

- `id`
- `periodId`
- `fromUserId`
- `fromNameSnapshot`
- `toUserId|null`
- `toAudience`
- `message`
- `createdAt`
- `createdBy`

Leitura:

- Opção simples: `read` global por recado.
- Opção recomendada: `shift_note_reads` por usuário.

Operações com autenticação:

- Criar: equipe.
- Marcar como lido: usuário autenticado.
- Excluir: autor, gestor ou admin.

Riscos:

- Migração precisa consolidar store atual e chaves legadas antes do envio.
- Modelo atual `read` global não diferencia usuários.

## Entidade: NPS

Chave atual: `periods[YYYY-MM].nps`

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
    "mentionId": 1
  }
}
```

Volume esperado: 1 objeto por período, dezenas de menções.

Backend sugerido:

- `nps_period_metrics`
- `nps_mentions`
- opcional `nps_rank_snapshots`

Campos de `nps_period_metrics`:

- `id`
- `periodId`
- `score`
- `monthlyGoal`
- `semesterGoal`
- `observations`
- `updatedBy`
- `updatedAt`

Campos de `nps_mentions`:

- `id`
- `periodId`
- `employeeId|null`
- `nameSnapshot`
- `count`

Operações com autenticação:

- Leitura: equipe.
- Escrita: gestor/recepção autorizada.

Riscos:

- Menções usam nome livre.
- `rankSnapshot` atual pode estar inconsistente no seed.

## Entidade: Escala

Chave atual: `periods[YYYY-MM].scale`

```json
{
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "rowTone": "green|red|neutral",
  "professorShifts": [
    {
      "id": "uuid",
      "time": "08h - 13h",
      "name": "string",
      "swap": "string"
    }
  ],
  "receptionTime": "08h - 17h",
  "receptionist": "string",
  "receptionSwap": "string",
  "note": "string"
}
```

Volume esperado: até 31 dias por período, com 1 a 3 turnos de professor por dia.

Backend sugerido:

- `scale_days`
- `scale_professor_shifts`
- opcional `scale_reception_shifts`

Operações com autenticação:

- Leitura: equipe.
- Criar/editar/excluir/duplicar mês anterior: gestor/admin ou responsável de escala.

Riscos:

- Duplicação entre meses deve ser transacional.
- Professor e recepção usam strings; preservar snapshots.
- Feriado/sábado é visual (`rowTone`), não calendário oficial.

## Entidade: Evento/Ação

Chave atual: `periods[YYYY-MM].events`

```json
{
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "type": "Evento|Ação|Campanha|Treinamento|Feriado|Outro",
  "title": "string",
  "place": "string",
  "owner": "string",
  "status": "Programado|Confirmado|Concluído|Cancelado",
  "description": "string"
}
```

Volume esperado: dezenas por mês.

Backend sugerido: `events`

Campos:

- `id`
- `periodId`
- `date`
- `time`
- `type`
- `title`
- `place`
- `ownerUserId|null`
- `ownerNameSnapshot`
- `status`
- `description`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

Índices:

- `periodId`
- `date`
- `type`
- `status`

Operações com autenticação:

- Criar/editar/duplicar/excluir: gestor/admin ou equipe autorizada.
- Exportar CSV: gestor/admin.

Riscos:

- Detector atual de duplicidade tem bug no horário.
- `owner` é string livre.

## Entidade: UI state

Chave atual: `controle_recepcao_app_ui_v34`

```json
{
  "activeTab": "dashboard",
  "studentSearch": "string",
  "studentFilterAtendente": "string",
  "studentFilterFeedback": "string",
  "pendingSearch": "string",
  "eventSearch": "string",
  "eventTypeFilter": "string",
  "eventStatusFilter": "string",
  "scaleSearch": "string"
}
```

Backend sugerido: não migrar como dado operacional. Pode virar preferência local por navegador ou `user_preferences` se houver login.

## Entidade: Diagnósticos e snapshots

Chaves atuais:

- `controle_recepcao_app_snapshot_v34`
- `controle_recepcao_app_report_v34`
- `controle_recepcao_app_flowtests_v34`

Backend sugerido:

- Snapshots: manter export JSON client-side ou armazenar como `backup_exports` com autorização forte.
- Diagnósticos: não precisa migrar, exceto logs operacionais do backend.

## Riscos principais da migração

- Fonte primária é IndexedDB; localStorage é espelho. Migração deve ler IndexedDB primeiro.
- Dados locais não têm autenticação nem autoria. Backend precisa criar `createdBy/updatedBy` com valor de migração.
- Strings livres precisam virar FKs ou snapshots.
- Fechamento/reset/importação precisam de transação.
- Matriz de addons deve ser expandida para linhas.
- Chaves legadas de recados precisam ser consolidadas.
- Cache do service worker pode manter código antigo e enviar payload antigo.
- XSS deve ser testado antes de multiusuário.
- Conflitos entre abas/dispositivos exigirão política clara: online-first ou offline-first com fila de mutações.
