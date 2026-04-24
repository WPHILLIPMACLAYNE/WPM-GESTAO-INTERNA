# AUDITORIA_COMPLETA — WPM Gestão Interna

> **Aviso:** esta auditoria é um snapshot histórico de `2026-04-10`.
> Para a baseline estrutural atual, use `MODULE_MAP.md`, `QWEN.md` e `MIGRATION_STATUS.md`.

Data: 2026-04-10
Base local auditada: commit `865586c` (`docs: adiciona auditoria completa pos-regressao`)
Base remota observada: `origin/main` em `f6f08ea` (`feat: adiciona graficos interativos no dashboard com Chart.js`)
Deploy informado: `wpm-gestao-interna.vercel.app`
Escopo: leitura, verificação e documentação. Nenhum arquivo de código foi alterado.

## Resumo executivo

O estado local auditado está funcional e estável nos checks solicitados: todos os arquivos JS em `src/` passaram em `node --check`, o Vitest fechou com `118/118` testes aprovados, `Chart.js` carregou via CDN como `4.4.7`, `window.__APP_INTERNALS__` está exposto e o service worker registrou em execução local HTTP.

Há uma divergência importante de baseline: o usuário informou `f6f08ea` como commit ativo, mas o checkout local está em `865586c`, um commit à frente de `origin/main`. Esta auditoria documenta o estado real do workspace local.

Principais riscos encontrados:

- Service Worker usa `CACHE_NAME = 'wpm-v1'`, desacoplado de versão/commit, o que pode manter assets antigos após rollback/deploy.
- Scripts `test:e2e` e `test:visual` em `package.json` apontam para arquivos fora do caminho atual.
- `playwright.config.js` usa `baseURL` absoluto antigo.
- Rollback de `createCrudHandler()` pode não restaurar `state` corretamente se `saveData()` falhar.
- Detector de duplicidade de eventos compara `entry.time` com ele mesmo.
- CSP via `<meta>` não aplica `frame-ancestors`; o navegador confirmou o aviso em console.
- `npm audit --audit-level=moderate` encontrou 1 vulnerabilidade alta em `vite`.
- A arquitetura ainda depende de scripts clássicos, globais e ordem de carga.

## Metodologia

Comandos executados:

- `git status --short --branch`
- `git log --oneline --decorate -5`
- Leitura de `QWEN.md`, `TECH_DEBT.md`, `MODULE_MAP.md`, `index.html`, `styles.css`, `sw.js`, `package.json`, `playwright.config.js`, `vitest.config.js` e `src/**/*.js`
- `node --check` em todos os arquivos `src/**/*.js`
- `npx vitest run`
- `npm audit --audit-level=moderate`
- Auditoria headless local com Playwright em viewports `1366x900`, `390x844` e `760x900`

## Fase 1 — Mapeamento estrutural

### Documentos de contexto

- `QWEN.md`: existe e descreve corretamente a arquitetura geral browser-only, mas parte da narrativa ainda chama o app de "single-file" e deve ser lida como histórico da evolução.
- `MODULE_STATUS.md`: não existe na raiz.
- `TECH_DEBT.md`: existe e ainda aponta riscos atuais: globais implícitos, dívida de modularização, funções duplicadas, linting frágil e resíduos de manutenção.
- `MODULE_MAP.md`: existe, mas está desatualizado. Ele cita `src/ui/render.js` e `src/ui/events.js` como módulos centrais, enquanto o estado atual já está separado em `render-*` e `events-*`.

### Estrutura atual de `src/`

| Arquivo | Linhas | Responsabilidade |
|---|---:|---|
| `src/utils/helpers.js` | 279 | Escape, sanitização, datas, CSV, NPS, período e formatação. |
| `src/core/config.js` | 162 | Constantes, chaves, defaults, helper `DOM` e estado global (`storage`, `state`, IDs de edição). |
| `src/core/period-builder.js` | 336 | UI state, preferências, equipe, addons, construção/reset de períodos e `seedYear()`. |
| `src/core/seed.js` | 190 | Massa determinística por mês para desenvolvimento/testes. |
| `src/core/schema.js` | 160 | Normalização, sanitização e migração de store até versão 4. |
| `src/core/storage.js` | 477 | IndexedDB, localStorage espelho, cache em memória, fila serializada e broadcast cross-tab. |
| `src/core/backup.js` | 599 | Load/save store, snapshots, export/import JSON, migração de payloads e autoteste de persistência. |
| `src/core/lifecycle.js` | 567 | Estado mensal, fechamento/reset/troca de período, lock de mês fechado e sync do app. |
| `src/domain/selectors.js` | 485 | KPIs, rankings, filtros, histórico do dashboard e memoização de derivados. |
| `src/features/forms.js` | 342 | Leitura/validação de formulários e builders de alunos, pendências, eventos e escala. |
| `src/features/crud.js` | 185 | Factory de CRUD e handlers para aluno, pendência e evento. |
| `src/features/csv.js` | 63 | Exportação CSV de pendências, escala e eventos. |
| `src/features/nps.js` | 84 | Mutação de menções NPS, contadores, rename, remoção e observações. |
| `src/features/diagnostics.js` | 120 | Smoke tests de fluxo e painel de autotestes. |
| `src/ui/render-core.js` | 357 | Scheduler de render, filtros persistidos de UI e patch helpers de DOM. |
| `src/ui/render-dashboard.js` | 1021 | Dashboard, gráficos Chart.js, insights, feedback chart e Painel de Recados. |
| `src/ui/render-students.js` | 192 | Renderização, edição inline e CRUD UI de alunos novos. |
| `src/ui/render-addons.js` | 144 | Grid de vendas de addons, ranking e renomeação de atendentes. |
| `src/ui/render-pending.js` | 157 | Tabela, Kanban e CRUD UI de pendências. |
| `src/ui/render-nps.js` | 240 | Risk meter, metas, histórico e ranking NPS. |
| `src/ui/render-scale.js` | 304 | Tabela, board e modal de escala. |
| `src/ui/render-events.js` | 283 | Lista, cards, tabela e calendário de eventos/ações. |
| `src/ui/render-settings.js` | 544 | Configurações, backup, diagnósticos, persistência e auditoria por período. |
| `src/ui/events-core.js` | 631 | Delegação global, modais, toasts, acessibilidade, atalhos, storage sync e tooltips. |
| `src/ui/events-students.js` | 40 | Binding de ações e change inline de alunos. |
| `src/ui/events-pending.js` | 99 | Binding de pendências e drag-and-drop Kanban. |
| `src/ui/events-addons.js` | 28 | Binding de addons e rename de atendente. |
| `src/ui/events-scale.js` | 50 | Binding de escala e editor de turnos. |
| `src/ui/events-nps.js` | 75 | Binding de NPS e autosave de observações. |
| `src/main.js` | 191 | Exposição de `APP_INTERNALS`, bootstrap e `DOMContentLoaded`. |
| `src/types.js` | 331 | Tipos JSDoc. Não é carregado no runtime. |
| `src/ui/render.js` | 2 | Stub/resíduo legado. Não é carregado em `index.html`. |

### Dependências entre módulos

O projeto não usa `import`/`export` ESM no runtime. A dependência real é por globais e ordem de `<script>`.

Ordem atual em `index.html`:

1. DOMPurify CDN
2. Chart.js CDN
3. `src/utils/helpers.js`
4. `src/core/config.js`
5. `src/core/period-builder.js`
6. `src/core/seed.js`
7. `src/core/schema.js`
8. `src/core/storage.js`
9. `src/domain/selectors.js`
10. `src/features/forms.js`
11. `src/features/nps.js`
12. `src/features/csv.js`
13. `src/features/diagnostics.js`
14. `src/ui/render-core.js`
15. `src/ui/render-dashboard.js`
16. `src/ui/render-students.js`
17. `src/ui/render-pending.js`
18. `src/ui/render-nps.js`
19. `src/ui/render-scale.js`
20. `src/ui/render-events.js`
21. `src/ui/render-settings.js`
22. `src/ui/render-addons.js`
23. `src/features/crud.js`
24. `src/ui/events-core.js`
25. `src/ui/events-students.js`
26. `src/ui/events-pending.js`
27. `src/ui/events-addons.js`
28. `src/ui/events-scale.js`
29. `src/ui/events-nps.js`
30. `src/core/backup.js`
31. `src/core/lifecycle.js`
32. `src/main.js`

Acoplamentos principais:

- `config` fornece constantes, estado e `DOM`.
- `period-builder`, `schema`, `storage`, `backup` e `lifecycle` formam a camada de persistência/estado.
- `selectors` depende de estado normalizado, helpers e período ativo.
- `forms`, `crud`, `nps`, `csv` e `diagnostics` dependem de estado, helpers e render/event APIs.
- `render-*` depende fortemente de `selectors`, `state`, `storage`, helpers e funções de persistência.
- `events-*` chama ações dos renders/features e usa delegação em `events-core`.
- `main.js` é o último arquivo e congela `APP_INTERNALS`; se qualquer função exposta não existir antes dele, o bootstrap quebra.

Não foram encontradas importações duplicadas ou ciclos ESM, porque não há imports reais. O risco equivalente é ciclo temporal por global definido tarde.

### `index.html`

Pontos verificados:

- CSP via `<meta>` existe, com `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com`.
- DOMPurify é carregado por CDN pinado em `3.2.6`.
- Chart.js é carregado por CDN pinado em `4.4.7`.
- Os scripts locais seguem a ordem modular atual.
- Service Worker é registrado no final do body com `/sw.js`.
- Eventos `online`/`offline` mostram toast local.
- Há cinco canvases de gráficos no Dashboard.

Achado de segurança: `frame-ancestors` dentro de `<meta http-equiv="Content-Security-Policy">` é ignorado pelo navegador. Para clickjacking, precisa virar header HTTP no deploy.

### `styles.css`

O CSS é amplo e responsivo. Breakpoints encontrados:

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
- `prefers-reduced-motion: reduce`
- `print`

Elementos largos por design:

- `student-table`: até `1510px`/`1410px`.
- `pending-table`: entre `820px` e `1040px`.
- Tabela de escala: entre `760px` e `980px`.
- Tabela de eventos: `900px`.
- Calendário de eventos: `630px`/`700px`.
- `feedbackChart` usa overflow horizontal controlado no container.

## Fase 2 — Análise de código

### Sintaxe

Resultado: OK.

Todos os arquivos `src/**/*.js` passaram em `node --check`.

### `window.__APP_INTERNALS__`

Resultado: OK.

Validado em Playwright local. Chaves expostas:

- `config`
- `persistence`
- `schema`
- `domain`
- `actions`
- `rendering`
- `ui`
- `diagnostics`

### `localStorage` e IndexedDB

Chaves atuais:

- `recepcao-smartfit-dashboard-v34`: store principal espelhado em localStorage.
- `recepcao-smartfit-dashboard-sync-v34`: broadcast cross-tab.
- `controle_recepcao_app_snapshot_v34`: snapshot local.
- `controle_recepcao_app_report_v34`: relatório de diagnóstico estrutural.
- `controle_recepcao_app_flowtests_v34`: relatório de autotestes de fluxo.
- `controle_recepcao_app_ui_v34`: estado da UI.
- `wpm_recados_${YYYY-MM}`: chave legada de recados por período.

Chaves legadas:

- `recepcao-smartfit-dashboard-v33`
- `recepcao-smartfit-dashboard-v24`
- `controle_recepcao_app_snapshot_v33`
- `controle_recepcao_app_report_v33`
- `controle_recepcao_app_flowtests_v33`
- `controle_recepcao_app_ui_v33`

Chaves temporárias/dinâmicas:

- `${STORAGE_KEY}__probe__`
- `${STORAGE_KEY}__selftest__${Date.now()}`
- `${STORAGE_KEY}_corrompido_${Date.now()}`

IndexedDB:

- Database: `wpm-gestao-interna-db`
- Object store: `app_kv`
- Chaves espelhadas no mesmo namespace do localStorage.

### Service Worker

`sw.js` está coerente com a lista modular atual: todos os arquivos carregados por `index.html` estão no `PRECACHE_ASSETS`, incluindo `backup.js`, `lifecycle.js`, `render-*` e `events-*`.

Risco: `CACHE_NAME = 'wpm-v1'` não acompanha `APP_VERSION`, hash ou commit. Isso pode manter JS/CSS antigos em navegadores após deploy/rollback.

CDNs são `network-only`, o que evita cache local de DOMPurify/Chart.js pelo SW, mas significa que offline completo pode ficar sem bibliotecas externas se elas não estiverem no cache HTTP do navegador.

### Chart.js

Resultado: OK.

Playwright local confirmou:

- `window.Chart.version = "4.4.7"`
- cinco canvases do Dashboard visíveis no desktop.
- fallback de "Chart.js indisponível" existe se `window.Chart` não carregar.

### Testes

Resultado do Vitest:

- Test files: `8 passed`
- Tests: `118 passed`
- Duração: `8.93s`

### `npm audit`

Resultado: falha por 1 vulnerabilidade alta em `vite 7.0.0 - 7.3.1`.

Advisories reportados:

- Path Traversal em optimized deps `.map`
- `server.fs.deny` bypass com query
- Arbitrary File Read via WebSocket do dev server

Correção indicada pelo npm: `npm audit fix`.

## Fase 3 — Análise funcional

### Dashboard

Funcionalidades:

- KPIs de alunos, feedback, NPS, pendências, próxima escala e próximo evento.
- Gráficos Chart.js: evolução de alunos, atendimentos por recepcionista, distribuição de feedbacks, tendência NPS e ranking de addons.
- Insights operacionais: destaque de feedback, líder de addons, líder NPS, urgência operacional e metas NPS.
- Resumo por atendente.
- Gráfico visual de feedback positivo.
- Overview de addons.
- Overview de pendências.
- Painel de Recados.

### Alunos novos

Funcionalidades:

- Cadastro/edição/exclusão via modal.
- Filtro por busca, atendente e feedback.
- Resumo de total, atendimentos por atendente, feedbacks e addons.
- Edição inline de última visita e hora.
- Vínculo automático com contador de addon quando o aluno tem addon marcado.

### Vendas de addons

Funcionalidades:

- Grid por atendente, tipo de addon e dia do mês.
- Ajuste manual de quantidade por dia.
- Ranking de top sellers.
- Inclusão de recepcionista.
- Renomeação de atendente com propagação para alunos, pendências, NPS e addons.
- Histórico de atendente removido fica somente leitura.

### Pendências

Funcionalidades:

- CRUD completo.
- Busca textual.
- Cards de status.
- Tabela filtrável.
- Kanban por `aberto`, `respondido`, `concluido`.
- Drag-and-drop entre colunas.
- Navegação por teclado no Kanban.
- Exportação CSV.

### NPS

Funcionalidades:

- Score atual e faixa de risco.
- Meta mensal e semestral.
- Ajuste rápido por input/range.
- Observações com autosave de 800ms.
- Registro, ajuste, edição e remoção de menções.
- Ranking com tendência.
- Histórico de NPS de meses anteriores.
- Líderes históricos de addons/NPS.

### Escala

Funcionalidades:

- CRUD de dias de escala.
- Múltiplos turnos de professores por dia.
- Recepção, troca e observações.
- Board visual e tabela.
- Busca.
- Resumo operacional de cobertura.
- Duplicação da escala do mês anterior.
- Exportação CSV.

### Eventos e ações

Funcionalidades:

- CRUD de evento/ação.
- Duplicação de item.
- Busca e filtros por tipo/status.
- Cards, lista de próximos, calendário mensal e tabela.
- Exportação CSV.
- Validação de data dentro do período ativo.

### Configurações

Funcionalidades:

- Edição de recepcionistas, professores e tipos de addon.
- Toggle `initializeMonthsWithTestData`.
- Export/import de backup JSON.
- Snapshot local e restauração.
- Fechamento/reset de mês.
- Diagnósticos estruturais.
- Autoteste de persistência.
- Autotestes de fluxo.
- Auditoria por período.
- Limpeza de meses vazios.

### Backup/importação

Formatos aceitos:

- Backup completo: `meta.kind = "app-backup"`, `version`, `activePeriod`, `preferences`, `periods`, `archives`.
- Fechamento mensal: `meta.kind = "month-archive"`, `periodKey`, `periodLabel`, `data`.
- Payload legado de período único: objeto com `settings`, `students`, `pending`, `recados`, `nps`, `scale`, `events`, `addons` ou aliases antigos.

Fluxo:

- Export gera JSON e salva snapshot local.
- Import valida tipo, gera backup antes da substituição e aplica store normalizado.
- Fechamento mensal baixa arquivo `smartfit-fechamento-${periodKey}.json`, arquiva o mês e abre o próximo.

### Sistema de mês ativo

Leitura/escrita:

- `storage.activePeriod`
- `currentPeriodKey`
- `state = storage.periods[currentPeriodKey]`
- controles `periodMonthSelect` e `periodYearInput`
- `syncPeriodControls()`, `switchPeriod()`, `changePeriodFromControls()`, `ensurePeriod()`, `syncAppState()`

Propagação:

- Trocar período salva `activePeriod`, normaliza `state`, renderiza tudo e sincroniza controles.
- Meses fechados entram em `storage.archives` e bloqueiam ações mutáveis.

### Painel de Recados

CRUD observado:

- Create: `publishRecado()`
- Read/list: `loadRecados()` e `renderRecadosPanel()`
- Update: `markRecadoAsRead()`
- Delete: `removeRecado()`

Persistência:

- Atual: `periods[YYYY-MM].recados`
- Legado: `wpm_recados_${YYYY-MM}` com migração para store.

Status: CRUD completo no escopo local.

### Funções/arquivos órfãos ou resíduos

- `src/ui/render.js`: stub de 2 linhas, não carregado no runtime.
- `src/types.js`: JSDoc útil, mas não carregado no runtime.
- `MODULE_MAP.md`: defasado em relação à estrutura real.
- `MODULE_STATUS.md`: referenciado pelo processo, mas ausente.
- `package.json` campo `main: "app.js"` não corresponde ao app atual.
- `vitest.config.js` coverage inclui `app.js`, não `src/**/*.js`.

## Fase 4 — Responsividade

Teste headless:

- `390x844`: todas as abas sem overflow global (`rootOverflow = 0`).
- `760x900`: todas as abas sem overflow global (`rootOverflow = 0`).

Bug 2 informado: valores sobrepostos nos cards de atendente.

- Não reproduzido por checagem objetiva de bounding boxes em `#summaryList`.
- Resultado: `summaryOverlaps = 0` em `390x844` e `760x900`.
- Risco residual: textos muito longos em nomes reais ainda podem pressionar layouts de métricas, embora o CSS atual use `min-width: 0`, truncamento e grids responsivos.

Bug 3 informado: gráfico de barras cortado à direita.

- Não reproduzido como overflow global.
- `feedbackChart` fica dentro de container com `overflow-x: auto`.
- Em `390x844`, o gráfico mediu `306px` dentro de parent `344px`.
- Em `760x900`, mediu `664px` dentro de parent `702px`.
- Risco residual: a regra JS define `feedbackChart.style.minWidth = Math.max(summary.length * 88, 560)`, então muitas pessoas podem exigir scroll horizontal.

Elementos com largura fixa/propositalmente largos:

- Alunos: tabela `1410px` em mobile/tablet.
- Pendências: tabela `820px`/`860px`.
- Escala: tabela `760px`/`800px`.
- Eventos: tabela `900px`; calendário `630px`.

Avaliação: a estratégia atual usa scroll horizontal localizado para tabelas/calendários. Funciona tecnicamente, mas não é UX ideal para mobile pequeno.

## Fase 5 — Segurança

### `innerHTML`

Há uso amplo de `innerHTML`, principalmente em renderizadores. A maior parte dos templates escapa dados com `esc()` ou passa por `sanitizeHtml()` via `aplicarHtmlSeMudou()`/`criarNoRenderizado()`.

Pontos de maior atenção:

- `aplicarPatchLinhas()` usa `container.innerHTML = html` sem sanitização porque as linhas são templates controlados; depende de escape manual em cada interpolação.
- `DOM.html()` em `config.js` seta HTML cru; se usado com dados externos no futuro vira sink perigoso.
- `render-addons.js`, `render-nps.js`, `render-settings.js`, `render-dashboard.js` e `features/diagnostics.js` montam HTML diretamente.

### DOMPurify

DOMPurify está carregado via CDN e `sanitizeHtml()` o usa quando disponível. O fallback é `esc()`.

Riscos:

- Allowlist permite `style`, `data-*`, `aria-*`, `svg`, `path` e muitos elementos. Isso é flexível, mas maior que o necessário para dados de usuário.
- CDN não tem SRI.

### Dados sensíveis hardcoded

Não foram encontrados tokens, secrets ou credenciais.

Existem dados pessoais/identificadores públicos:

- Nome/autoria.
- Links sociais.
- Número de WhatsApp.
- Nomes padrão de equipe/seeds.

Com backend, dados reais de alunos, matrículas, pendências e NPS não devem permanecer acessíveis sem autenticação.

### XSS potencial

O risco atual é moderado:

- Entradas de aluno, pendência, evento, recado e NPS são em geral exibidas com `esc()`.
- Importação aplica `sanitizeDeep()`, que remove null byte e trim, mas não faz escape semântico; a segurança depende da renderização.
- Templates de tabela com `innerHTML` cru pedem testes de regressão XSS por entidade antes do backend.

### CSP

CSP em meta ajuda parcialmente, mas:

- Usa `'unsafe-inline'` para scripts/styles.
- `frame-ancestors` é ignorado quando entregue por `<meta>`.
- Em Vercel, clickjacking deve ser mitigado por header HTTP.

## Fase 6 — Mapeamento para backend

Pontos de leitura/escrita local:

- Store principal: `loadStore()`, `saveStore()`, `saveData()`, `readStoredStore()`, `applyImportedStore()`.
- UI state: `getUIState()`, `saveUIState()`, `sanitizeUIState()`, `setActiveTab()`.
- Snapshots: `saveLocalSnapshot()`, `restoreLocalSnapshot()`.
- Diagnósticos: `saveSystemReport()`, `saveFlowSmokeReport()`, `clearFlowSmokeTests()`.
- Recados legados: `readLegacyRecados()`, `clearLegacyRecadosStorageKey()`, `getLegacyRecadoPeriodKeys()`.
- Persistência baixa: `readLocalStorageValue()`, `writeLocalStorageValue()`, `deleteLocalStorageValue()`, `idbGetValue()`, `idbSetValue()`, `idbDeleteValue()`.

Entidades documentadas em detalhe em `Docs/MAPA_ENTIDADES.md`.

Operações que precisarão autenticação:

- Todas as leituras de dados operacionais.
- Criar/editar/excluir alunos, pendências, eventos, escala, addons, NPS e recados.
- Importar backup.
- Exportar backup.
- Fechar/resetar mês.
- Editar configurações.
- Limpar meses vazios.
- Restaurar snapshot.

Riscos de migração:

- Arrays de addons por dia precisam virar linhas normalizadas.
- Strings livres de recepcionistas/professores precisam virar usuários/membros ou manter snapshot histórico.
- `recados.read` hoje é global; backend multiusuário deve decidir leitura por usuário ou por recado.
- Operações compostas precisam de transação: fechamento, reset, import, renomeação de pessoa e vínculo aluno-addon.
- IndexedDB é primário e localStorage é espelho; migrador deve ler IndexedDB primeiro.
- Service Worker/cache antigo pode fazer o cliente enviar schema antigo ao backend.

## Conclusão

O app está em estado funcional para o baseline local, com testes unitários/integrados verdes e Dashboard Chart.js carregando corretamente. O maior risco imediato não é sintaxe ou teste unitário: é confiabilidade operacional ao redor de cache/service worker, scripts de validação visual/E2E, configuração Playwright antiga e alguns bugs lógicos que só aparecem em falha de persistência ou cenários específicos.

Antes de iniciar backend, recomenda-se corrigir infraestrutura de testes, versionamento do service worker, bugs lógicos prioritários, CSP/header de produção e cobertura XSS. O backend deve nascer com autenticação, transações e migração explícita do modelo local.
