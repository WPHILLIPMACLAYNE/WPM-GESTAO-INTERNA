# AUDITORIA_2604 — WPM Gestão Interna

Data da auditoria: 2026-04-10
Projeto: WPM Gestão Interna
Local analisado: `/home/acewallthemac/storage/APPSPAGESTAOWPM/APLICATIVOFINALIZADO`
Commit ativo: `f6f08ea`
Escopo: auditoria somente leitura do estado pós-rollback. Nenhum código foi alterado.

## Resumo executivo

O app está em um estado executável para a suíte unitária/integrada: `npx vitest run` passou com 8 arquivos e 118 testes. A checagem sintática com `node --check` também passou para todos os arquivos `src/**/*.js`.

Os maiores riscos estão fora da sintaxe: Service Worker pode servir assets antigos por manter `CACHE_NAME = 'wpm-v1'`; scripts E2E/visual em `package.json` apontam para arquivos inexistentes na raiz; `playwright.config.js` usa caminho absoluto antigo; `npm audit` reporta vulnerabilidade alta em Vite; e há bugs lógicos em CRUD, datas e deduplicação de eventos.

## Fase 1 — Mapeamento estrutural

### Documentação existente

`QWEN.md` foi lido. Ele descreve a arquitetura como SPA browser-only v34, sem build step, com scripts clássicos carregados em ordem e persistência híbrida IndexedDB + localStorage.

`MODULE_STATUS.md` não existe na raiz do repositório. Existe `MIGRATION_STATUS.md` e `MODULE_MAP.md`, mas `MODULE_MAP.md` está desatualizado: ainda cita `src/ui/render.js` e `src/ui/events.js` como arquivos principais, enquanto o `index.html` atual carrega renderizadores e eventos separados por domínio.

### Estrutura de `src/`

Arquivos encontrados:

- `src/core/config.js`: constantes, chaves de storage, defaults, estado global (`storage`, `state`, `currentPeriodKey`) e helpers globais básicos.
- `src/core/period-builder.js`: UI state, geração de períodos, seed/bootstrap e construção de períodos limpos.
- `src/core/seed.js`: massa determinística de dados de teste.
- `src/core/schema.js`: migração/sanitização de store.
- `src/core/storage.js`: IndexedDB, localStorage, cache em memória, fila serializada e broadcast entre abas.
- `src/core/backup.js`: leitura/gravação de store, backup, importação, snapshot local e formatos legados.
- `src/core/lifecycle.js`: normalização de período, troca/fechamento/reset de mês e bloqueio de período fechado.
- `src/domain/selectors.js`: seletores e agregações derivadas para dashboard, filtros, histórico, NPS, escala e eventos.
- `src/features/forms.js`: coleta/validação de formulários e aplicação de saves puros.
- `src/features/crud.js`: factory CRUD para alunos, pendências e eventos.
- `src/features/nps.js`: ações de NPS, menções e observações.
- `src/features/csv.js`: exportação CSV.
- `src/features/diagnostics.js`: autotestes/smoke tests e painéis de diagnóstico.
- `src/ui/render-core.js`: scheduler de renderização, patch de DOM e inicialização de controles.
- `src/ui/render-dashboard.js`: dashboard, gráficos Chart.js, recados e indicadores.
- `src/ui/render-students.js`: UI de alunos/atendimentos.
- `src/ui/render-addons.js`: UI de addons e gestão de atendentes.
- `src/ui/render-pending.js`: UI de pendências e kanban.
- `src/ui/render-nps.js`: UI de NPS.
- `src/ui/render-scale.js`: UI de escala.
- `src/ui/render-events.js`: UI de eventos e calendário.
- `src/ui/render-settings.js`: configurações, diagnóstico, storage usage e manutenção.
- `src/ui/events-core.js`: delegação global de eventos, atalhos, modais, storage sync, acessibilidade e tooltips.
- `src/ui/events-students.js`: bindings de alunos.
- `src/ui/events-pending.js`: bindings de pendências/kanban.
- `src/ui/events-addons.js`: bindings de addons.
- `src/ui/events-scale.js`: bindings de escala.
- `src/ui/events-nps.js`: bindings de NPS.
- `src/main.js`: exposição de `window.__APP_INTERNALS__` e bootstrap final.
- `src/types.js`: tipos/documentação JSDoc, não carregado no `index.html`.
- `src/ui/render.js`: arquivo legado/orfão, não carregado no `index.html`.

### Dependências entre módulos

O app não usa `import`/`export` em `src/`. A dependência real é a ordem das tags `<script>` em `index.html`, com globais compartilhados entre arquivos. Essa arquitetura reduz overhead de build, mas aumenta acoplamento e risco de quebra por reordenação.

Ordem atual de carga:

1. Helpers e config.
2. Períodos, seed, schema e storage.
3. Selectors e features.
4. Renderizadores por domínio.
5. CRUD.
6. Eventos por domínio.
7. Backup, lifecycle e `main.js`.

Não há importação circular ESM porque não há ESM em `src/`. O equivalente arquitetural é acoplamento circular por globais: `crud.js` chama callbacks de render, renderizadores dependem de `state`, `storage` e seletores, e lifecycle chama render/sync.

### `index.html`

Pontos verificados:

- CSP existe, mas permite `script-src 'unsafe-inline'` e `style-src 'unsafe-inline'`.
- DOMPurify é carregado por CDN `https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js`.
- Chart.js é carregado por CDN `https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js`.
- Scripts da aplicação são clássicos, sem `type="module"`, e a ordem importa.
- Service Worker é registrado via `navigator.serviceWorker.register('/sw.js')`.

Riscos:

- O registro absoluto `/sw.js` pressupõe deploy na raiz do domínio.
- Sem SRI nos scripts CDN.
- CSP ainda permite inline script/style, então reduz mas não elimina impacto de XSS.

### `styles.css`

O CSS é monolítico e extenso. Há organização por blocos e muitos ajustes responsivos, mas existe sobreposição de breakpoints e larguras mínimas fixas em tabelas/grades.

Breakpoints encontrados:

- `max-width: 1440px`
- `max-width: 1380px`
- `max-width: 1320px`
- `max-width: 1260px`
- `max-width: 1180px`
- `max-width: 1100px`
- `max-width: 900px`
- `max-width: 860px`
- `max-width: 760px`
- `max-width: 720px`
- `max-width: 640px`
- `max-width: 560px`
- `prefers-reduced-motion`
- `print`

Riscos responsivos:

- `#students .student-table` mantém `min-width: 1240px` até mobile.
- `#pending .pending-table` mantém `min-width: 820px` em telas pequenas.
- `#scale .schedule-matrix table` mantém `min-width: 760px` em telas pequenas.
- `.event-calendar-grid` mantém `min-width: 630px` em telas pequenas.
- O dashboard já define `min-height: 260px` e canvas com `height: 260px`, reduzindo risco de altura zero, mas não há override mobile específico para barras largas.

## Fase 2 — Análise de código

### Checagem sintática

Comandos executados:

- `node --check src/main.js`
- `for f in $(find src -name '*.js' | sort); do node --check "$f"; done`

Resultado: todos passaram sem erro de sintaxe.

### `window.__APP_INTERNALS__`

`src/main.js` expõe `window.__APP_INTERNALS__ = APP_INTERNALS`. O objeto está congelado via `Object.freeze` e agrupa `config`, `persistence`, `schema`, `domain`, `actions`, `rendering`, `ui` e `diagnostics`. A exposição está adequada para testes/diagnóstico.

### Importações duplicadas ou circulares

Não foram encontrados `import`/`export` em `src/`. As importações ESM existem somente nos testes e configs. Portanto, não há circularidade ESM detectável por grafo de imports.

Arquivos não carregados pelo `index.html`:

- `src/types.js`
- `src/ui/render.js`

### localStorage

Chaves principais:

- `recepcao-smartfit-dashboard-v34`: espelho localStorage do store principal.
- `recepcao-smartfit-dashboard-sync-v34`: broadcast entre abas.
- `controle_recepcao_app_snapshot_v34`: snapshot local.
- `controle_recepcao_app_report_v34`: relatório de diagnóstico.
- `controle_recepcao_app_flowtests_v34`: relatório de autotestes.
- `controle_recepcao_app_ui_v34`: filtros/UI state.
- `wpm_recados_${YYYY-MM}`: chave legada de recados por período.

Chaves legadas:

- `recepcao-smartfit-dashboard-v33`
- `recepcao-smartfit-dashboard-v24`
- `controle_recepcao_app_snapshot_v33`
- `controle_recepcao_app_report_v33`
- `controle_recepcao_app_flowtests_v33`
- `controle_recepcao_app_ui_v33`

Risco: localStorage é usado como espelho e fallback. Se o IndexedDB falhar, o app tenta seguir pelo espelho, mas isso pode mascarar divergências entre stores em cenários de quota, múltiplas abas ou rollback de versão.

### IndexedDB

IndexedDB ainda está ativo e é a persistência principal:

- Database: `wpm-gestao-interna-db`
- Object store: `app_kv`

`localStorage` é usado como espelho, fallback síncrono e canal de broadcast.

### `sw.js`

Estratégia atual:

- `install`: precache de assets estáticos.
- `activate`: remove caches com nome diferente de `wpm-v1`.
- `fetch`: network-only para CDN; cache-first para assets locais; fallback de documento para `/index.html`.

Riscos críticos:

- `CACHE_NAME` é `wpm-v1` e não acompanha `APP_VERSION` ou hash de deploy.
- Cache-first pode servir JS/CSS antigos após rollback/deploy se o cache não for invalidado.
- Lista de precache usa caminhos absolutos `/src/...`, frágil para deploy sob subpath.
- CDN é network-only; offline sem rede quebra DOMPurify/Chart.js.

### Chart.js

Chart.js é carregado por CDN no `index.html`. `src/ui/render-dashboard.js` verifica `window.Chart`, configura defaults globais (`responsive = true`, `maintainAspectRatio = false`) e usa fallback visual quando Chart.js não está disponível.

## Fase 3 — Análise lógica e funcional

### Funcionalidades por aba

Dashboard:

- Cards/KPIs por período.
- Gráficos Chart.js.
- Histórico dos últimos meses.
- Painel de recados com publicar, marcar como lido e excluir.
- Badge de recados não lidos.

Alunos novos:

- Cadastro, edição, exclusão e filtros.
- Validação de nome/matrícula.
- Edição inline e vínculo com addons.
- Exportação/efeitos em métricas do dashboard.

Vendas de addons:

- Matriz por atendente/tipo/dia.
- Edição de contadores.
- Renomeação/remoção de atendente.
- Totais por tipo e recepcionista.

Pendências:

- Cadastro, edição e exclusão.
- Filtros/busca.
- Kanban por status.
- Movimentação por drag-and-drop/teclado.
- Export CSV.

NPS:

- Score mensal, metas, observações.
- Menções/ranking.
- Histórico e indicadores.

Escala:

- Cadastro/edição/exclusão de dias.
- Linhas de professor por turno.
- Recepção, trocas e observações.
- Duplicação da escala do mês anterior.

Eventos e ações:

- Cadastro, edição, duplicação e exclusão.
- Calendário/lista.
- Filtros e export CSV.
- Checagem de duplicidade.

Configurações:

- Equipe, professores, tipos de addon.
- Número de dias do mês.
- Preferência de inicializar meses com seed.
- Diagnósticos, autotestes, snapshot, backup/importação e limpeza de meses vazios.

### Funções/arquivos órfãos ou não utilizados

- `src/ui/render.js` não é carregado pelo `index.html`; parece legado da fase pré-split.
- `src/types.js` não é carregado; pode ser mantido como documentação JSDoc, mas não tem papel runtime.
- `MODULE_MAP.md` ainda documenta `render.js`/`events.js` como módulos centrais e precisa ser atualizado.

### Backup/importação

Formatos aceitos:

- Backup completo: objeto com `version`, `activePeriod`, `periods` e `archives`.
- Payload embrulhado: `{ payload: ... }`.
- Fechamento mensal: `{ periodKey, periodLabel, data, meta }`.
- Legado de período único: objeto contendo `settings`, `students`, `pending`, `recados`, `nps`, `scale`, `events`, `addons`, `escala` ou `eventos`.

Validações:

- Arquivo precisa ser JSON ou terminar em `.json`.
- Limite de tamanho: 50 MB.
- Importação sempre tenta exportar backup antes de substituir/restaurar.

Riscos:

- O import substitui todos os dados para backup completo e depende de confirmação do usuário.
- Sem autenticação ou trilha de auditoria; no backend isso precisa ser tratado como operação administrativa.

### Mês ativo

O mês ativo é armazenado em `storage.activePeriod` e refletido nas variáveis globais `currentPeriodKey` e `state`. A troca de mês chama `switchPeriod`, garante/cria o período, atualiza `storage.activePeriod`, persiste e renderiza.

Riscos:

- Estado global mutável compartilhado por muitos módulos.
- Persistência falha em alguns fluxos pode deixar `state` e store parcialmente divergentes.
- Datas usando `toISOString()` podem deslocar dia no fuso `America/Sao_Paulo`.

### Painel de Recados

CRUD observado:

- Publicar: `publishRecado`.
- Ler/listar: `loadRecados` e `renderRecadosPanel`.
- Marcar como lido: `markRecadoAsRead`.
- Excluir: `removeRecado`.
- Persistir: `saveRecados`.
- Migração legado localStorage: `migrateLegacyRecadosToStore`.

Funcionalmente o CRUD está completo. O risco principal é concorrência entre abas/offline: a mesclagem por id/assinatura reduz duplicidade, mas não resolve conflitos reais de edição/exclusão simultânea.

## Fase 4 — Responsividade

### Dashboard mobile

Bugs conhecidos avaliados por código:

- Gráficos colapsando: parcialmente mitigado por `min-height: 260px` no shell e `height: 260px !important` no canvas.
- Valores sobrepostos nos cards de atendente: existe uso amplo de `min-width: 0`, mas há chips/labels e cards com larguras mínimas que podem continuar apertando em 375px.
- Gráfico de barras cortado à direita: risco permanece porque o canvas é 100% e Chart.js é responsivo, mas labels/barras longas podem exceder a área útil sem wrapper horizontal ou ajuste de ticks por viewport.

### Demais abas mobile

As abas usam scroll horizontal para tabelas largas. Isso evita quebrar layout, mas não é a melhor UX em telas pequenas.

Pontos de atenção:

- Alunos: tabela com `min-width: 1240px`.
- Pendências: tabela com `min-width: 820px`; kanban tem ajustes melhores.
- Escala: matriz com `min-width: 760px`.
- Eventos: calendário com `min-width: 630px`.
- Configurações: muitos painéis e tabelas dependem de grids que viram 1 coluna, mas ainda há cards com conteúdo longo.

## Fase 5 — Segurança e qualidade

### `innerHTML` e sanitização

Há muitos usos de `innerHTML`. A maioria interpola dados com `esc()`, e `sanitizeHtml()` usa DOMPurify quando disponível.

Riscos:

- `DOM.html(id, markup)` em `src/core/config.js` é um sink genérico sem sanitização.
- `aplicarPatchLinhas()` usa `container.innerHTML = html` cru por necessidade de preservar `<tr>/<td>`, confiando que o HTML já venha escapado.
- A segurança depende de disciplina por call site. Isso é aceitável para SPA local, mas frágil para multiusuário/backend.

### DOMPurify

DOMPurify está carregado por CDN e usado por `sanitizeHtml`. O fallback é `esc()` se DOMPurify não existir.

Ponto de atenção: a allowlist permite atributos como `style`, `data-*` e `aria-*`. Para backend/multiusuário, recomenda-se restringir mais ou evitar HTML rico vindo de dados.

### Dados sensíveis

Não foram encontrados tokens, senhas, keys Supabase ou segredos hardcoded em `src/`, `index.html`, configs principais e docs relevantes. O grep amplo encontrou apenas termos genéricos e artefatos gerados, sem segredo operacional.

### Testes

Comandos executados:

- `npx vitest run`: passou, 8 arquivos e 118 testes.
- `npm run test:e2e`: falhou porque `responsive-test.mjs` não existe na raiz.
- `npm run test:visual`: falhou porque `visual-check.mjs` não existe na raiz.
- `npx playwright test --list`: listou 142 testes em 4 arquivos.
- `npx npm@latest audit --audit-level=moderate`: falhou com 1 vulnerabilidade alta em Vite `7.0.0 - 7.3.1`.

### Playwright

`playwright.config.js` está funcional o suficiente para listar testes, mas contém `baseURL` absoluto e antigo:

`file:///home/acewallthemac/storage/APP%20SPA%20GESTAO%20WPM/APLICATIVO%20FINALIZADO/index.html`

Esse caminho não corresponde ao diretório atual e torna a suíte não portável.

## Fase 6 — Preparação para backend

### Pontos de leitura/escrita local

- Store principal: `src/core/backup.js` e `src/core/storage.js`.
- UI state: `src/core/period-builder.js`.
- Recados legados: `src/ui/render-dashboard.js`.
- Relatórios/autotestes: `src/features/diagnostics.js` e `src/ui/render-settings.js`.
- Broadcast entre abas: `src/core/storage.js` e `src/ui/events-core.js`.

### Entidades principais

As entidades e estruturas estão detalhadas em `Docs/MAPA_ENTIDADES.md`.

### Operações que precisarão autenticação

- Login e leitura de dados da unidade.
- Criar/editar/excluir alunos/atendimentos.
- Criar/editar/excluir pendências.
- Atualizar addons.
- Atualizar NPS, metas, observações e menções.
- Criar/editar/excluir escala.
- Criar/editar/excluir eventos.
- Criar/marcar/excluir recados.
- Alterar configurações.
- Importar backup, restaurar snapshot, resetar mês, fechar mês e migrar dados.

### Riscos de migração localStorage → banco

- IDs locais `crypto.randomUUID()` sem usuário/unidade associada.
- Sem trilha de auditoria.
- Sem resolução de conflito entre abas/dispositivos.
- Dados legados v24/v33/v34 precisam de migração controlada.
- Fechamento de mês e arquivos de backup precisam virar transações atômicas.
- Datas precisam ser normalizadas com fuso explícito.
- Recados legados em chaves separadas precisam ser consolidados antes da migração.

