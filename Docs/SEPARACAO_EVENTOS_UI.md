# Separação da Camada de Eventos UI

## Objetivo

Reduzir o acoplamento do antigo `src/ui/events.js` sem alterar comportamento.

## Ordem de carga

No `index.html`, os scripts de eventos agora carregam nesta ordem:

1. `src/ui/events-core.js`
2. `src/ui/events-students.js`
3. `src/ui/events-pending.js`
4. `src/ui/events-addons.js`
5. `src/ui/events-scale.js`
6. `src/ui/events-nps.js`

`events-core.js` precisa vir primeiro porque define a infraestrutura compartilhada:

- `estadoEventos`
- `estadoAcessibilidade`
- `openModal()` / `closeModal()`
- `bindUIEvents()`
- `bindTooltips()`
- `bindAcessibilidade()`
- atalhos globais e sincronização de storage

## Responsabilidades por arquivo

### `src/ui/events-core.js`

- Monta a delegação principal em `bindUIEvents()`
- Coleta os registradores por domínio e despacha `click`, `change`, `input` e `focusout`
- Mantém modais, trap de foco, tooltips, atalhos globais, navegação de abas e a11y

### `src/ui/events-students.js`

- Modal de cadastro de alunos
- Edição inline de alunos
- Ações de salvar, editar e remover atendimentos

### `src/ui/events-pending.js`

- Modal e ações CRUD de pendências
- `bindPendingDnD()` do Kanban
- `updatePendingStatus()` usado por DnD e acessibilidade

### `src/ui/events-addons.js`

- Inclusão de atendente no grid
- Atualização de células de addon
- Renomeação inline de pessoa no grid

### `src/ui/events-scale.js`

- Modal e CRUD da escala
- Duplicação do mês anterior
- Sincronização dos drafts de `scaleShiftDrafts`

### `src/ui/events-nps.js`

- Menções e ajustes do ranking
- Edição de score e metas
- Autosave das observações NPS com debounce de `800ms`

## Estratégia de compatibilidade

- `bindUIEvents()` continua sendo o ponto único de delegação global.
- Cada domínio expõe `bind*Events()` e retorna handlers específicos.
- Funções já consumidas por outros módulos, como `openModal()`, `closeModal()` e `updatePendingStatus()`, permanecem globais.
- O DnD do Kanban e o autosave de NPS foram movidos sem alterar os gatilhos de inicialização em `src/main.js`.
