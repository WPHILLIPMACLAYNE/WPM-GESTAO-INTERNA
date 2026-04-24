# MODULE_MAP.md

## Premissas

- O app continua browser-only, carregado por `<script>` tags clássicos em `index.html`.
- Não há `import`/`export` reais no runtime; dependências são por globais e ordem de carga.
- O mapa abaixo descreve a estrutura atual pós-split de renderização/eventos e extração dos scripts inline.

## Ordem de carga atual

1. `src/core/env-bootstrap.js`
2. `src/utils/helpers.js`
3. `src/core/config.js`
4. `src/core/observability.js`
5. `src/core/supabase.js`
6. `src/core/period-builder.js`
7. `src/core/seed.js`
8. `src/core/schema.js`
9. `src/core/storage.js`
10. `src/domain/selectors.js`
11. `src/features/forms.js`
12. `src/features/nps.js`
13. `src/features/csv.js`
14. `src/features/diagnostics.js`
15. `src/ui/render-core.js`
16. `src/ui/render-dashboard.js`
17. `src/ui/render-students.js`
18. `src/ui/render-pending.js`
19. `src/ui/render-nps.js`
20. `src/ui/render-scale.js`
21. `src/ui/render-events.js`
22. `src/ui/render-settings.js`
23. `src/ui/render-addons.js`
24. `src/features/crud.js`
25. `src/ui/events-core.js`
26. `src/ui/events-students.js`
27. `src/ui/events-pending.js`
28. `src/ui/events-addons.js`
29. `src/ui/events-scale.js`
30. `src/ui/events-nps.js`
31. `src/core/backup.js`
32. `src/core/lifecycle.js`
33. `src/main.js`
34. `src/ui/back-to-top.js`
35. `src/core/pwa.js`

## Mapa resumido

| Arquivo | Camada | Responsabilidade principal | Depende de |
|---|---|---|---|
| `src/core/env-bootstrap.js` | config | defaults de `window.__APP_ENV__` e carregamento local opcional de `env.js` | nenhum módulo local |
| `src/utils/helpers.js` | transversal | escape, sanitização, datas, CSV, NPS e helpers de período | APIs padrão |
| `src/core/config.js` | config | constantes, chaves, defaults, helper `DOM` e estado global | nenhum módulo local |
| `src/core/observability.js` | core | bootstrap condicional do Sentry | config/env |
| `src/core/supabase.js` | core | cliente Supabase opcional e status de backend | config/env |
| `src/core/period-builder.js` | core | preferências, UI state, equipe, addons e builders/reset de período | config, storage, helpers, lifecycle |
| `src/core/seed.js` | core | seed determinístico por período | config, helpers, period-builder |
| `src/core/schema.js` | core | normalização, migração e sanitização do store | config, period-builder, lifecycle, helpers |
| `src/core/storage.js` | core | IndexedDB, localStorage, cache, fila serializada e broadcast | config, helpers, render-core |
| `src/core/backup.js` | core | load/save store, export/import, snapshots e autoteste | storage, schema, selectors, lifecycle |
| `src/core/lifecycle.js` | core | troca/reset/fechamento de mês, lock de período e sync do app | backup, period-builder, selectors, render-core |
| `src/domain/selectors.js` | domínio | KPIs, filtros, rankings, históricos e memoização | helpers, config, period-builder |
| `src/features/forms.js` | features | leitura/validação de formulários e builders de entidades | helpers, config, lifecycle |
| `src/features/crud.js` | features | factory genérica de CRUD para aluno, pendência e evento | forms, backup, lifecycle, renders |
| `src/features/csv.js` | features | exportação CSV de pendências, escala e eventos | helpers |
| `src/features/diagnostics.js` | features | smoke tests de fluxo e persistência de relatórios | schema, backup, render-settings |
| `src/features/nps.js` | features | mutações de NPS e observações | forms, backup, render-nps |
| `src/ui/render-core.js` | ui/render | scheduler de render, filtros persistidos e patch helpers de DOM | helpers, storage, lifecycle |
| `src/ui/render-dashboard.js` | ui/render | hero, dashboard, gráficos Chart.js, insights e recados | selectors, backup, lifecycle |
| `src/ui/render-students.js` | ui/render | tabela, filtros e CRUD visual de alunos | selectors, forms, crud, lifecycle |
| `src/ui/render-pending.js` | ui/render | tabela, Kanban e CRUD visual de pendências | selectors, lifecycle |
| `src/ui/render-nps.js` | ui/render | score, metas, histórico e ranking NPS | selectors, features/nps, lifecycle |
| `src/ui/render-scale.js` | ui/render | tabela, board e modal da escala | selectors, forms, lifecycle |
| `src/ui/render-events.js` | ui/render | cards, tabela, próximos e calendário de eventos | selectors, forms, lifecycle |
| `src/ui/render-settings.js` | ui/render | configurações, backup, diagnósticos e auditoria por período | backup, diagnostics, lifecycle |
| `src/ui/render-addons.js` | ui/render | grid de addons, ranking e rename de atendente | selectors, backup, lifecycle |
| `src/ui/events-core.js` | ui/events | delegação global, modais, toasts, atalhos, a11y e storage sync | renders, backup, lifecycle |
| `src/ui/events-students.js` | ui/events | binds de aluno | render-students, crud |
| `src/ui/events-pending.js` | ui/events | binds de pendências e drag-and-drop | render-pending, csv |
| `src/ui/events-addons.js` | ui/events | binds de addons e rename | render-addons |
| `src/ui/events-scale.js` | ui/events | binds de escala | render-scale, csv |
| `src/ui/events-nps.js` | ui/events | binds de NPS e autosave | render-nps, features/nps |
| `src/main.js` | bootstrap | expõe `APP_INTERNALS` e inicializa o app | todos os módulos anteriores |
| `src/ui/back-to-top.js` | ui/events | botão flutuante de retorno ao topo | DOM pronto |
| `src/core/pwa.js` | core | registro de service worker, update e estado online/offline | DOM pronto, service worker |
| `src/types.js` | documentação | typedefs JSDoc para checagem estática | não é carregado em runtime |

## Observações

- `src/ui/render.js` e `src/ui/events.js` não fazem mais parte do runtime.
- O maior acoplamento atual está em `render-dashboard.js`, `render-settings.js`, `events-core.js`, `backup.js` e `lifecycle.js`.
- O projeto segue sensível à ordem de carga; qualquer reordenação de scripts em `index.html` pode quebrar o bootstrap.
