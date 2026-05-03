# UI Render / Events

## Visão Geral

🟢 `src/ui` implementa a camada visual e interativa do SPA: renderização por áreas, patching de DOM sem virtual DOM, delegação global de eventos, modais, toasts, acessibilidade, filtros persistidos, abas, drag/drop, gráficos, recados e painéis operacionais.

🟢 A UI atua como cola entre `core`, `domain` e `features`: handlers de evento chamam ações de negócio, ações chamam `requestRender()`, e o scheduler renderiza apenas as áreas marcadas como sujas.

🟡 A camada é fortemente baseada em funções globais carregadas por `<script>`, sem import/export explícito entre módulos.

## Responsabilidades

- 🟢 Definir áreas válidas de renderização.
- 🟢 Persistir e aplicar filtros de visão por `UI_BINDINGS`.
- 🟢 Agendar renderização por `requestAnimationFrame`.
- 🟢 Agregar alvos sujos em `estadoRenderizacao.sujas`.
- 🟢 Renderizar seções por `RENDER_MAP`.
- 🟢 Sincronizar UI de período bloqueado após cada render.
- 🟢 Aplicar HTML somente quando assinatura muda.
- 🟢 Aplicar patch por chave preservando foco e seleção.
- 🟢 Sanitizar HTML antes de inserir no DOM em helpers centrais.
- 🟢 Aplicar estilos runtime por atributos `data-style-*`.
- 🟢 Inicializar listeners globais de forma idempotente.
- 🟢 Delegar `click`, `change`, `input` e `focusout` para bindings por domínio.
- 🟢 Controlar modais com foco de retorno e bloqueio de scroll.
- 🟢 Emitir toasts e live regions acessíveis.
- 🟢 Controlar confirmação assíncrona por modal.
- 🟢 Sincronizar abas, atalhos globais, tooltips e storage cross-tab.
- 🟢 Suportar drag/drop e teclado para Kanban de pendências.
- 🟢 Renderizar dashboard, alunos, addons, pendências, NPS, escala, eventos e configurações.
- 🟢 Montar/destruir gráficos Chart.js evitando instâncias sobrepostas.

## Interface

### Áreas de Renderização

| Área | Renderizador | Regra |
|---|---|---|
| `hero` | `renderHero()` | resumo superior do período. 🟢 |
| `dashboard` | `renderDashboard()` | KPIs, gráficos, insights e recados. 🟢 |
| `students` | `renderStudents()` | tabela/filtros de atendimentos. 🟢 |
| `addons` | `renderAddons()` | matriz e ranking de addons. 🟢 |
| `pending` | `renderPending()` | tabela e Kanban de pendências. 🟢 |
| `nps` | `renderNps()` | score, metas, ranking e histórico. 🟢 |
| `scale` | `renderScale()` | tabela e quadro de escala. 🟢 |
| `events` | `renderEvents()` | calendário/lista/resumos de eventos. 🟢 |
| `settings` | `renderSettings()` | configurações, backup, diagnóstico e Supabase. 🟢 |

### Estado de Renderização

| Campo | Tipo | Regra |
|---|---|---|
| `sujas` | Set<string> | áreas pendentes. 🟢 |
| `agendado` | boolean | evita múltiplos RAF simultâneos. 🟢 |
| `idQuadro` | number | id de `requestAnimationFrame`. 🟢 |
| `renderizando` | boolean | evita reentrada direta. 🟢 |
| `ultimoLote` | string[] | último lote processado. 🟢 |
| `controlesUiInicializados` | boolean | evita duplicar filtros de UI. 🟢 |

### API de Render

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `normalizarAlvosRender(alvos)` | string/string[] | string[] | aceita `all`/`tudo` e filtra áreas válidas. 🟢 |
| `requestRender(alvos)` | string/string[] | void | marca áreas sujas e agenda RAF. 🟢 |
| `executarRenderAgendado()` | nenhum | void | renderiza áreas sujas e sincroniza lock UI. 🟢 |
| `limparFilaRender()` | nenhum | void | cancela RAF e limpa fila. 🟢 |
| `renderAll()` | nenhum | void | normaliza estado e renderiza todas as seções. 🟢 |
| `aplicarHtmlSeMudou(el, html)` | Element, html | void | troca HTML apenas se hash mudou. 🟢 |
| `aplicarPatchPorChave(container, descritores)` | Element, list | void | patch por chave com preservação de foco. 🟢 |
| `aplicarPatchLinhas(container, itens, obterChave, renderizarLinha)` | Element, list | void | patch de linhas de tabela com sanitizacao central. 🟢 |
| `aplicarPatchCards(...)` | Element, list | void | patch de cards por chave. 🟢 |

### API de Eventos

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `bindUIEvents()` | nenhum | void | registra delegação global idempotente. 🟢 |
| `collectUiEventBindings()` | nenhum | binding[] | agrega bindings core/abas. 🟢 |
| `dispatchUiBinding(bindings, handlerName, ...args)` | list, string | boolean | para no primeiro handler true. 🟢 |
| `openModal(id)` | string | void | abre modal, salva foco e foca primeiro controle. 🟢 |
| `closeModal(id)` | string | void | fecha modal e restaura foco quando possível. 🟢 |
| `showToast(message, type, duration)` | args | void | toast com live region. 🟢 |
| `showSaveToast(message, duration)` | args | void | toast de salvamento. 🟢 |
| `showConfirm(message, onOk, onCancel)` | args | void | confirmação por modal. 🟢 |
| `bindAcessibilidade()` | nenhum | void | foco modal, labels, roving Kanban e teclado. 🟢 |
| `bindStorageSync()` | nenhum | void | reage a broadcast/storage cross-tab. 🟢 |
| `bindTooltips()` | nenhum | void | tooltip por hover/focus. 🟢 |

## Regras de Negócio

- 🟢 Render targets devem pertencer a `AREAS_RENDERIZACAO`.
- 🟢 `requestRender()` não deve agendar novo RAF se já existe render agendado ou em execução.
- 🟢 Novas áreas marcadas durante render devem ser reagendadas após o lote atual.
- 🟢 `renderAll()` deve limpar fila pendente, normalizar `state`, popular filtros, aplicar UI state e renderizar todas as áreas.
- 🟢 Depois de renderizar, UI deve chamar `syncCurrentPeriodLockUI()`.
- 🟢 Filtros de visão devem ser persistidos por `saveUIState()`.
- 🟢 Inputs de filtro devem usar debounce de 150ms.
- 🟢 HTML inserido por `aplicarHtmlSeMudou()` deve ser sanitizado.
- 🟢 Patch por chave deve preservar foco e seleção quando seletor estável puder ser reconstruído.
- 🟢 Eventos globais devem ser registrados uma única vez por flags de `estadoEventos`.
- 🟢 Clique em `.tab-btn` deve trocar aba por `setActiveTab()`.
- 🟢 Clique em `[data-action]` deve ser delegado para bindings coletados.
- 🟢 `change` e `input` devem limpar erro de validação do campo antes de despachar.
- 🟢 Modais devem marcar `aria-hidden`, travar scroll do body e restaurar foco de retorno.
- 🟢 Toast danger/warning deve usar live region assertiva.
- 🟢 Kanban de pendências deve suportar drag/drop e roving tabindex.
- 🟢 `Alt+ArrowLeft/Right` em pendência deve mover status quando permitido.
- 🟢 `Escape` deve fechar modal ativo.
- 🟢 `/` deve focar busca da aba ativa quando o foco não está em campo editável.
- 🟢 Evento `storage` com `STORAGE_BROADCAST_KEY` deve chamar `consumeStorageBroadcast()`.
- 🟢 Renderizadores devem usar `esc()`/`sanitizeHtml()` ou markup controlado para evitar HTML inseguro.
- 🟡 Patching com `innerHTML` em linhas de tabela depende da disciplina de escape do renderizador.
- 🔴 `render-dashboard.js` contém comportamento de migração de recados legados, misturando persistência com renderização.

## Fluxo Principal

1. 🟢 `initializeApp()` inicializa controles estáticos.
2. 🟢 `initUIBindings()` conecta filtros persistidos.
3. 🟢 `bindUIEvents()` registra listeners delegados.
4. 🟢 Bindings de acessibilidade, atalhos, modal, tooltips, storage e DnD são inicializados de forma idempotente.
5. 🟢 `renderAll()` desenha a tela inicial.
6. 🟢 Usuário interage com DOM.
7. 🟢 Listener global localiza `.tab-btn` ou `[data-action]`.
8. 🟢 `dispatchUiBinding()` chama o primeiro binding capaz de tratar a ação.
9. 🟢 Handler de UI chama feature/core correspondente.
10. 🟢 Feature/core muta estado, persiste ou abre modal/toast.
11. 🟢 Handler chama `requestRender(targets)` para áreas impactadas.
12. 🟢 `requestRender()` adiciona alvos em `estadoRenderizacao.sujas`.
13. 🟢 `requestAnimationFrame` chama `executarRenderAgendado()`.
14. 🟢 O scheduler renderiza cada área suja por `renderSection()`.
15. 🟢 Helpers de patch atualizam DOM preservando foco quando possível.
16. 🟢 `syncCurrentPeriodLockUI()` aplica estado read-only/fechado.

## Fluxos Alternativos

- **Filtro de busca:** 🟢 UI state é salvo imediatamente e render é debounced em 150ms.
- **Troca de aba por teclado:** 🟢 setas/Home/End movem foco entre `.tab-btn` e salvam `activeTab`.
- **Modal aberto:** 🟢 Tab fica preso aos focáveis do modal ativo.
- **Clique no backdrop:** 🟢 fecha o modal clicado.
- **Storage broadcast:** 🟢 outro tab salva, evento `storage` consome broadcast e sincroniza store/UI.
- **Kanban drag/drop:** 🟢 `drop` em coluna muda status da pendência por `updatePendingStatus()`.
- **Kanban teclado:** 🟢 setas verticais/Home/End movem foco; Alt+setas muda coluna.
- **NPS autosave:** 🟢 observações NPS usam debounce de 800ms em `events-nps.js`.
- **Escala:** 🟢 modal mantém `scaleShiftDrafts` e exige pelo menos um turno de professor.
- **Eventos:** 🟢 calendário mensal agrupa eventos por dia e limita top 3 no card do dia.
- **Dashboard invisível:** 🟢 gráficos são evitados quando dashboard não está visível.
- **Chart vazio:** 🟢 fallback visual substitui gráfico sem dados.

## Dependências

- `src/ui/render-core.js` — scheduler, patching e filtros de UI.
- `src/ui/events-core.js` — delegação, modais, toasts, acessibilidade e globals.
- `src/ui/events-students.js`, `events-pending.js`, `events-addons.js`, `events-scale.js`, `events-nps.js` — bindings por aba.
- `src/ui/render-dashboard.js`, `render-students.js`, `render-addons.js`, `render-pending.js`, `render-nps.js`, `render-scale.js`, `render-events.js`, `render-settings.js` — renderizadores.
- `src/domain/selectors.js` — KPIs, filtros derivados, rankings e agrupamentos.
- `src/features/*` — actions chamadas pelos handlers.
- `src/core/lifecycle.js` — `setActiveTab()`, `syncCurrentPeriodLockUI()`, bloqueio e períodos.
- `src/core/storage.js` — UI state, broadcast e cache cross-tab.
- `src/utils/helpers.js` — escape, sanitização, runtime styles, datas e ordenação.
- Chart.js CDN — gráficos do dashboard.
- DOMPurify CDN — sanitização HTML quando disponível.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Performance | Render deve ser por áreas sujas e por frame. | `requestRender()`, `executarRenderAgendado()` | 🟢 |
| Acessibilidade | Modais, tabs, Kanban e toasts devem ser navegáveis/anunciados. | `bindAcessibilidade()`, live regions | 🟢 |
| Segurança | HTML renderizado deve ser escapado/sanitizado. | `sanitizeHtml()`, `esc()` | 🟢 |
| Consistência | UI read-only deve ser re-sincronizada após render. | `syncCurrentPeriodLockUI()` | 🟢 |
| Resiliência | Listeners não devem duplicar em re-render. | flags `estadoEventos` | 🟢 |
| UX | Foco deve ser preservado em patches e modais. | `capturarEstadoFoco()`, `restaurarEstadoFoco()` | 🟢 |
| Compatibilidade | Cross-tab deve reagir a storage/broadcast. | `bindStorageSync()` | 🟢 |

> Inferido do código. Validar visualmente em desktop/mobile porque a UI concentra muitas responsabilidades e estados.

## Critérios de Aceitação

```gherkin
Dado que requestRender recebe dashboard e nps
Quando executarRenderAgendado roda no próximo frame
Então apenas dashboard e nps devem ser renderizados
E syncCurrentPeriodLockUI deve executar ao final

Dado que requestRender é chamado várias vezes no mesmo frame
Quando já existe render agendado
Então não deve criar múltiplos requestAnimationFrame

Dado que um filtro de busca recebe input
Quando o usuário digita
Então saveUIState deve persistir o valor
E a área alvo deve renderizar após debounce

Dado um modal aberto
Quando o usuário pressiona Tab
Então o foco deve permanecer dentro do modal

Dado uma pendência focada no Kanban
Quando o usuário pressiona Alt+ArrowRight
Então a pendência deve avançar de status se o período for gravável

Dado uma alteração em outra aba do navegador
Quando storage event chega com STORAGE_BROADCAST_KEY
Então consumeStorageBroadcast deve sincronizar o app

Dado HTML igual ao anterior
Quando aplicarHtmlSeMudou é chamado
Então o DOM não deve ser reescrito
```

## Cenários de Borda

- 🟢 **Alvo inválido em requestRender:** alvo é descartado.
- 🟢 **`all` ou `tudo`:** expande para todas as áreas conhecidas.
- 🟢 **Render solicita novo render durante execução:** novo lote é reagendado.
- 🟢 **Elemento focado some após patch:** restauração de foco é ignorada sem erro.
- 🟢 **Modal fecha enquanto outro segue aberto:** foco vai para o modal remanescente.
- 🟢 **Tooltip passa do viewport:** posição é ajustada dentro da janela.
- 🟢 **Storage key desconhecida:** evento é ignorado.
- 🟢 **Controle sem label for:** inicialização estática sincroniza label com campo.
- 🟡 **Chart.js ausente:** dashboard precisa usar fallback ou evitar montagem; validar nos cenários offline/CDN.
- 🔴 **IDs/data-* instáveis em markup renderizado:** preservação de foco pode falhar.
- 🟢 **Markup de tabela sem escape prévio:** `aplicarPatchLinhas()` sanitiza o HTML antes do `innerHTML` e remove midia ativa desnecessaria para linhas.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Scheduler por áreas sujas | Must | Base de atualização da SPA. |
| Delegação global idempotente | Must | Evita duplicação de handlers e conecta todas as actions. |
| Patching DOM com sanitização | Must | Segurança e performance da UI. |
| Bloqueio read-only após render | Must | Protege mês fechado e sessão Supabase read-only. |
| Modais/toasts/live regions | Must | Fluxos de CRUD, confirmação e feedback dependem disso. |
| Acessibilidade de Kanban/modais/tabs | Should | Qualidade operacional e navegação por teclado. |
| Gráficos Chart.js | Should | Dashboard executivo importante. |
| Tooltips | Could | Melhora leitura, mas não bloqueia operação. |
| Migração de recados dentro do dashboard | Won't | Deve ser preservada por compatibilidade, mas é candidata a extração futura. |

> Prioridade inferida por papel no bootstrap, mutações e renderização operacional.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `src/ui/render-core.js` | `UI_BINDINGS`, `AREAS_RENDERIZACAO`, `estadoRenderizacao`, `RENDER_MAP` | 🟢 |
| `src/ui/render-core.js` | `requestRender`, `executarRenderAgendado`, `limparFilaRender`, `renderAll` | 🟢 |
| `src/ui/render-core.js` | `aplicarHtmlSeMudou`, `aplicarPatchPorChave`, `aplicarPatchLinhas`, `aplicarPatchCards` | 🟢 |
| `src/ui/events-core.js` | `estadoEventos`, `estadoAcessibilidade`, `bindUIEvents`, `dispatchUiBinding` | 🟢 |
| `src/ui/events-core.js` | `openModal`, `closeModal`, `showToast`, `showSaveToast`, `showConfirm`, `_resolveConfirm` | 🟢 |
| `src/ui/events-core.js` | `bindAcessibilidade`, `bindStorageSync`, `bindTooltips`, `bindGlobalKeyboardShortcuts`, `bindTabKeyboardNavigation` | 🟢 |
| `src/ui/events-students.js` | bindings de aluno | 🟢 |
| `src/ui/events-pending.js` | Kanban, DnD e status de pendências | 🟢 |
| `src/ui/events-nps.js` | NPS autosave e ações | 🟢 |
| `src/ui/events-scale.js` | escala e CSV | 🟢 |
| `src/ui/events-addons.js` | addon actions | 🟢 |
| `src/ui/render-dashboard.js` | hero, dashboard, charts e recados | 🟢 |
| `src/ui/render-students.js` | tabela e modais de alunos | 🟢 |
| `src/ui/render-pending.js` | tabela/Kanban de pendências | 🟢 |
| `src/ui/render-addons.js` | matriz/ranking de addons | 🟢 |
| `src/ui/render-nps.js` | score, metas, ranking e histórico | 🟢 |
| `src/ui/render-scale.js` | escala e quadro mensal | 🟢 |
| `src/ui/render-events.js` | calendário/lista/eventos | 🟢 |
| `src/ui/render-settings.js` | settings, backup, Supabase e diagnósticos | 🟢 |
| `_reversa_sdd/flowcharts/ui.md` | fluxo UI geral | 🟢 |
| `_reversa_sdd/flowcharts/ui-requestRender.md` | scheduler de render | 🟢 |
| `_reversa_sdd/flowcharts/ui-bindUIEvents.md` | delegação de eventos | 🟢 |
