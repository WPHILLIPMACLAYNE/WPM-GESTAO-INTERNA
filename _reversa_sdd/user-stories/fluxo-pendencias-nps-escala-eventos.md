# User Story: Fluxo de pendencias, NPS, escala e eventos

## Metadados

| Campo | Valor |
|-------|-------|
| ID | US-WPM-004 |
| Status | 🟢 Confirmado por código, SDDs e testes |
| Fonte principal | `src/features/forms.js`, `src/features/crud.js`, `src/features/nps.js`, `src/ui/render-pending.js`, `src/ui/events-pending.js`, `src/ui/render-nps.js`, `src/ui/events-nps.js`, `src/ui/render-scale.js`, `src/ui/events-scale.js`, `src/ui/render-events.js`, `tests/e2e/workflows.spec.js` |
| Perfis | Recepção, gestão operacional, coordenação |
| Escopo | Pendências, NPS, escala mensal e agenda de eventos/ações |

## Historia

Como equipe operacional, quero controlar pendências de alunos, NPS, escala e eventos do período em telas integradas, para acompanhar execução diária, resposta ao aluno, qualidade percebida, cobertura de turnos e ações programadas do mês. 🟢

## Objetivos Operacionais

- 🟢 Registrar pendências com aluno, matrícula, descrição, data, responsável, resposta e status.
- 🟢 Mover pendências por Kanban entre `aberto`, `respondido` e `concluido`.
- 🟢 Buscar pendências e exportar CSV do período.
- 🟢 Registrar NPS com score, metas, observações e menções por funcionário.
- 🟢 Salvar observações NPS com debounce e persistir score/metas imediatamente.
- 🟢 Montar escala mensal com data, tom operacional, recepção e turnos de professores.
- 🟢 Exigir ao menos um turno de professor antes de salvar um dia de escala.
- 🟢 Duplicar escala do mês anterior quando houver dados.
- 🟢 Criar, editar, duplicar, excluir, filtrar e exportar eventos/ações/feriados.
- 🟢 Fazer rollback de mutações quando `saveData()` falha em pontos críticos.
- 🟢 Bloquear todas as mutações quando o período está fechado ou read-only.

## Atores

| Ator | Responsabilidade |
|------|------------------|
| Recepção | Registra pendências, respostas, NPS operacional e eventos simples. 🟢 |
| Gestor | Acompanha Kanban, NPS, escala, eventos, cobertura e relatórios CSV. 🟢 |
| Coordenação | Planeja eventos/ações, valida escala e acompanha status do mês. 🟢 |
| Sistema | Valida dados, persiste, ordena, renderiza painéis e bloqueia período fechado. 🟢 |

## Pre-condicoes

- 🟢 O período ativo deve estar gravável por `assertWritableCurrentPeriod()`.
- 🟢 `state.pending`, `state.nps`, `state.scale` e `state.events` devem existir após normalização.
- 🟢 Pendências dependem de responsáveis vindos de recepcionistas/equipe configurada.
- 🟢 Escala depende de data pertencente ao período ativo e pelo menos uma linha de professor.
- 🟢 Eventos dependem de data pertencente ao período ativo e título preenchido.
- 🟢 NPS deve manter score/metas clampados entre 0 e 100.

## Fluxo Principal: pendencias

1. 🟢 Usuário abre a aba de pendências e aciona nova pendência.
2. 🟢 Sistema abre modal com nome, matrícula, descrição, data, responsável, resposta e status.
3. 🟢 `getPendingFormData()` normaliza matrícula para dígitos e coleta campos do DOM.
4. 🟢 `validatePending()` exige nome e descrição.
5. 🟢 Se data preenchida pertence a outro período, sistema bloqueia o salvamento.
6. 🟢 `applyPendingSave()` insere ou substitui item por `id`.
7. 🟢 Após salvar, sistema fecha modal, limpa formulário e renderiza `hero`, `dashboard` e `pending`.
8. 🟢 Usuário pode arrastar card no Kanban para mudar status.
9. 🟢 `updatePendingStatus()` salva novo status, preserva foco acessível e rerenderiza.
10. 🟢 Exportar CSV baixa `pendencias-YYYY-MM.csv`.

## Fluxo Principal: NPS

1. 🟢 Usuário abre aba NPS.
2. 🟢 Usuário ajusta score ou metas.
3. 🟢 `updateNpsScore()` e `updateNpsGoal()` aplicam clamp `0..100`, salvam e rerenderizam.
4. 🟢 Usuário registra menção informando nome e quantidade.
5. 🟢 `registerMention()` exige nome e incrementa menção existente sem diferenciar maiúsculas/minúsculas.
6. 🟢 Antes de mutar ranking, sistema chama `captureNpsRankSnapshot()`.
7. 🟢 Usuário pode ajustar quantidade por botões, input absoluto, renomear ou remover menção.
8. 🟢 Observações NPS são salvas por autosave com debounce de 800 ms ou botão explícito.
9. 🟢 Dashboard e aba NPS refletem score, metas, ranking atual e líderes históricos.

## Fluxo Principal: escala

1. 🟢 Usuário abre aba Escala e aciona novo dia de escala.
2. 🟢 Sistema sugere data padrão do período, tom operacional e horário de recepção.
3. 🟢 Usuário adiciona uma ou mais linhas de professor com horário, nome e troca opcional.
4. 🟢 `getScaleFormData()` remove turnos totalmente vazios.
5. 🟢 `saveScaleDay()` exige data preenchida, data dentro do período e ao menos um turno.
6. 🟢 Sistema insere/substitui o dia por `id`, ordena por data e salva.
7. 🟢 Após persistir, fecha modal e renderiza dashboard/escala.
8. 🟢 Usuário pode duplicar escala do mês anterior por `duplicatePreviousMonthScale()`.
9. 🟢 Dias excedentes em mês menor são ignorados durante duplicação.

## Fluxo Principal: eventos e acoes

1. 🟢 Usuário abre aba Eventos e aciona novo evento/ação.
2. 🟢 Sistema coleta data, horário, tipo, status, título, local, responsável e descrição.
3. 🟢 `validateEvent()` exige data e título.
4. 🟢 Data do evento deve pertencer ao período ativo.
5. 🟢 `applyEventSave()` insere/substitui e ordena por data/hora.
6. 🟢 Antes de salvar duplicata, `duplicateCheck` compara mesmo título normalizado, data e horário.
7. 🟢 Se duplicata existir, sistema pede confirmação antes de persistir.
8. 🟢 Evento pode ser duplicado criando novo `id`, título com `(cópia)` e status `Programado`.
9. 🟢 Exclusão e duplicação guardam snapshot anterior e fazem rollback se persistência falhar.
10. 🟢 Calendário mensal agrupa eventos por dia e mostra até 3 itens por card.

## Fluxos Alternativos

### Pendencia movida por Kanban

1. 🟢 Usuário arrasta card para coluna com `data-drop-status`.
2. 🟢 Sistema aplica classe visual de drop.
3. 🟢 Ao soltar, `updatePendingStatus()` altera status e salva.
4. 🟢 Se item não existe ou status é igual, nada muda.

### NPS sem nome de mencao

1. 🟢 Usuário tenta registrar menção sem nome.
2. 🟢 Sistema exibe toast `Informe o nome do funcionário citado.`
3. 🟢 Nenhuma menção é criada.

### Escala sem turno

1. 🟢 Usuário tenta salvar dia de escala sem linhas preenchidas.
2. 🟢 Sistema exibe `Adicione pelo menos uma linha de professor.`
3. 🟢 Foco volta para ação de adicionar linha.
4. 🟢 Nenhuma escala é persistida.

### Evento duplicado

1. 🟢 Usuário tenta salvar evento com mesmo título normalizado, data e horário de outro item.
2. 🟢 Sistema abre confirmação.
3. 🟢 Cancelar preserva modal aberto e não persiste novo evento.
4. 🟢 Confirmar salva o evento duplicado.

### Falha de persistencia em evento

1. 🟢 `saveData()` retorna falso durante salvamento/exclusão/duplicação de evento.
2. 🟢 Sistema restaura estado anterior.
3. 🟢 Modal fica aberto quando o salvamento inicial falha.
4. 🟢 Toast informa a falha.

## Regras de Negocio

| Regra | Evidência |
|-------|-----------|
| Pendência exige nome e descrição. | `validatePending()` em `src/features/forms.js`. 🟢 |
| Matrícula de pendência aceita somente dígitos quando preenchida. | `normalizeNumericId()` e validação de divergência. 🟢 |
| Data de pendência, escala e evento deve pertencer ao período ativo. | `isDateInActivePeriod()` em validações. 🟢 |
| Pendência possui status `aberto`, `respondido` ou `concluido`. | Kanban/render e state machine. 🟢 |
| NPS score/metas ficam entre 0 e 100. | `clamp()` em `updateNpsScore()`/`updateNpsGoal()`. 🟢 |
| Menção NPS existente é incrementada por comparação case-insensitive. | `registerMention()`. 🟢 |
| Contagem de menção não pode ficar negativa. | `Math.max(0, ...)` em ajustes. 🟢 |
| Escala exige pelo menos um turno de professor. | `saveScaleDay()`. 🟢 |
| Turnos vazios são removidos do payload de escala. | `getScaleFormData()`. 🟢 |
| Evento exige data e título. | `validateEvent()`. 🟢 |
| Evento duplicado por título/data/hora exige confirmação. | `duplicateCheck` em `handleSaveEvent`. 🟢 |
| Eventos são ordenados por data/hora. | `upsertEvent()` e renderizadores. 🟢 |
| Período fechado/read-only bloqueia mutações. | `assertWritableCurrentPeriod()` em handlers. 🟢 |

## Criterios de Aceitacao

### Cenario 1: pendencia completa com Kanban e CSV

Dado um período aberto
Quando a recepção registra pendência com nome, matrícula, descrição, data, responsável e status `aberto`
Então a pendência deve aparecer na tabela e no Kanban
E ao arrastar para `respondido`, o status deve persistir
E o CSV `pendencias-YYYY-MM.csv` deve conter nome e descrição da pendência. 🟢

### Cenario 2: pendencia invalida

Dado o modal de pendência aberto
Quando usuário tenta salvar sem nome ou descrição
Então o sistema deve exibir erro de validação
E não deve persistir nova pendência. 🟢

### Cenario 3: NPS persiste score e observacoes

Dado um período com dados carregados
Quando usuário altera score para `72` e digita observações
Então o score deve ser salvo como número entre 0 e 100
E observações devem persistir após debounce
E reload deve exibir o mesmo score e texto. 🟢

### Cenario 4: mencao NPS existente

Dado uma menção NPS chamada `Wallace`
Quando usuário registra `wallace` novamente com quantidade 2
Então a menção existente deve ser incrementada
E não deve criar duplicata por diferença de maiúsculas. 🟢

### Cenario 5: escala valida

Dado um período aberto
Quando usuário salva escala com data do período e pelo menos um turno de professor
Então o dia deve entrar em `state.scale` ordenado por data
E dashboard/escala devem ser renderizados
E o modal deve fechar após persistência bem-sucedida. 🟢

### Cenario 6: escala invalida

Dado um modal de escala aberto
Quando usuário salva sem data, com data fora do período ou sem turno de professor
Então o sistema deve bloquear salvamento
E exibir mensagem específica ao usuário. 🟢

### Cenario 7: evento duplicado confirmado

Dado um evento existente com título, data e horário
Quando usuário salva outro evento com mesmo título normalizado, data e horário
Então o sistema deve pedir confirmação
E só deve persistir o duplicado após confirmar. 🟢

### Cenario 8: rollback de evento

Dado que `saveData()` falha
Quando usuário tenta salvar, excluir ou duplicar evento
Então o estado anterior deve ser restaurado
E o usuário deve receber aviso de falha
E a UI deve continuar consistente. 🟢

## Cenarios de Borda

- 🟢 Pendência com data vazia é permitida; data preenchida fora do período é bloqueada.
- 🟢 Kanban ignora drop quando não há `draggingPendingId`.
- 🟢 NPS mention count digitado manualmente é clampado em zero mínimo.
- 🟢 Remover menção exige confirmação.
- 🟢 Autosave de observações NPS aguarda 800 ms; botão explícito cancela debounce e salva na hora.
- 🟢 Escala duplicada de mês anterior gera novos IDs.
- 🟢 Dias que não existem no mês alvo são ignorados na duplicação de escala.
- 🟢 Evento sem horário ainda aparece no calendário como sem horário ou dia todo quando feriado.
- 🟢 Calendário mostra no máximo 3 itens por dia e informa excedentes.
- 🟡 Exclusões de pendência/escala fazem rollback parcial simples; validar se ordem original precisa ser preservada em falhas raras.

## Dados Envolvidos

| Entidade | Campos relevantes |
|----------|-------------------|
| `PendingItem` | `id`, `nome`, `matricula`, `pendencia`, `data`, `hostess`, `resposta`, `status`. 🟢 |
| `NpsState` | `score`, `monthlyGoal`, `semesterGoal`, `observations`, `mentions`, `rankSnapshot`. 🟢 |
| `NpsMention` | `id`, `name`, `count`. 🟢 |
| `ScaleEntry` | `id`, `date`, `rowTone`, `professorShifts`, `receptionTime`, `receptionist`, `receptionSwap`, `note`. 🟢 |
| `ProfessorShift` | `id`, `time`, `name`, `swap`. 🟢 |
| `EventItem` | `id`, `date`, `time`, `type`, `title`, `place`, `owner`, `status`, `description`. 🟢 |

## Rastreabilidade

| Comportamento | Arquivos |
|---------------|----------|
| Validações e builders de pendência/evento/escala | `src/features/forms.js` 🟢 |
| CRUD genérico, rollback e duplicata de evento | `src/features/crud.js` 🟢 |
| Ações NPS | `src/features/nps.js`, `src/ui/render-nps.js`, `src/ui/events-nps.js` 🟢 |
| Kanban e tabela de pendências | `src/ui/render-pending.js`, `src/ui/events-pending.js` 🟢 |
| Escala e turnos | `src/ui/render-scale.js`, `src/ui/events-scale.js`, `src/core/lifecycle.js` 🟢 |
| Eventos, calendário e duplicação | `src/ui/render-events.js`, `src/features/forms.js`, `src/features/crud.js` 🟢 |
| Exports CSV | `src/features/csv.js` 🟢 |
| Seletores derivados | `src/domain/selectors.js` 🟢 |
| Testes E2E de pendências, eventos e NPS | `tests/e2e/workflows.spec.js` 🟢 |
| Contratos SDD relacionados | `_reversa_sdd/sdd/features-business-actions.md`, `_reversa_sdd/sdd/ui-render-events.md` 🟢 |

## Fora de Escopo

- 🟢 Atendimento e addons, cobertos por `US-WPM-001`.
- 🟢 Fechamento mensal, coberto por `US-WPM-002`.
- 🟢 Sincronização Supabase, coberta por `US-WPM-003`.
- 🟢 Gestão de equipe/configurações, exceto impacto indireto em responsáveis, menções e escala.
- 🟢 Relatórios analíticos avançados fora dos CSVs operacionais existentes.

## Observacoes de Reimplementacao

- 🟢 Pendências precisam existir em duas representações coerentes: tabela e Kanban.
- 🟢 NPS deve capturar snapshot de ranking antes de mutações que alteram menções.
- 🟢 Escala não deve aceitar dia sem turno de professor, mesmo que recepção esteja preenchida.
- 🟢 Eventos devem tratar duplicidade antes do commit e manter rollback explícito em falha de persistência.
- 🟢 Todos os fluxos devem usar o mesmo bloqueio de período fechado para evitar alterações retroativas.
