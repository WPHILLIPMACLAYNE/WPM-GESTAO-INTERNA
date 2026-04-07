# QWEN.md — WPM Gestão Interna

## Visão Geral do Projeto

**WPM Gestão Interna** é um SPA (Single Page Application) de arquivo único para gestão interna da recepção de academias da rede Smart Fit. O sistema centraliza operações mensais de atendimento, vendas complementares (addons), gestão de pendências, pesquisa de satisfação (NPS), escala de funcionários e registro de eventos.

- **Autor:** Wallace Phillip Maclayne
- **Versão atual:** v34
- **Licença:** Todos os direitos reservados
- **Arquitetura:** Single-file SPA com `<script>` tags sequenciais — sem build step, sem ES modules, sem servidor

### Princípios de Design

| Princípio | Implementação |
|---|---|
| Zero dependência de servidor | Funciona 100% offline no navegador |
| Arquivo único | Sem build step — basta abrir no navegador |
| Persistência local | IndexedDB (primário) + localStorage (espelho/fallback) |
| Sync cross-tab | BroadcastChannel API |
| Multi-período | Cada mês é um período independente com dados isolados |
| Responsivo | Desktop (1440px), tablet (768-1024px) e mobile (360-760px) |

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript ES6+ |
| Persistência | IndexedDB + localStorage |
| Sync cross-tab | BroadcastChannel API |
| Testes unitários | Vitest + Happy-DOM |
| Testes E2E | Playwright (Chromium) |
| CSS | Dark mode com CSS custom properties |
| Sanitização | DOMPurify (CDN) |

---

## Estrutura de Arquivos

```
APLICATIVOFINALIZADO/
├── index.html                  # Aplicação principal (~935 linhas HTML)
├── styles.css                  # CSS completo (~5214 linhas)
├── package.json                # Dependências de desenvolvimento
├── vitest.config.js            # Configuração do Vitest
├── playwright.config.js        # Configuração do Playwright
│
├── src/                        # JavaScript modular (31 arquivos)
│   ├── core/
│   │   ├── config.js           # Constantes, estado global, DOM helper
│   │   ├── period-builder.js   # Builders de período e templates
│   │   ├── schema.js           # Migração, sanitização, validação
│   │   ├── seed.js             # Seed determinístico de massa inicial
│   │   ├── storage.js          # IndexedDB, localStorage, broadcast
│   │   ├── backup.js           # Persistência de alto nível, import/export e snapshots
│   │   └── lifecycle.js        # Ciclo mensal, troca/fechamento/reset de períodos
│   ├── domain/
│   │   └── selectors.js        # Selectors memoizados com cache
│   ├── features/
│   │   ├── forms.js            # Form data, entity builders, validação
│   │   ├── crud.js             # Factory genérica de CRUD
│   │   ├── csv.js              # Exportação CSV
│   │   ├── nps.js              # CRUD de menções NPS + observações
│   │   └── diagnostics.js      # Smoke tests de fluxo
│   ├── ui/
│   │   ├── render-core.js      # Scheduler, patch DOM, filtros e bindings leves
│   │   ├── render-dashboard.js # Dashboard e hero
│   │   ├── render-students.js  # Alunos
│   │   ├── render-pending.js   # Pendências
│   │   ├── render-nps.js       # NPS
│   │   ├── render-scale.js     # Escala
│   │   ├── render-events.js    # Eventos e ações
│   │   ├── render-settings.js  # Configurações
│   │   ├── render-addons.js    # Grid de addons
│   │   ├── events-core.js      # Delegação principal, modais, tooltips, a11y, atalhos
│   │   ├── events-students.js  # Handlers de alunos
│   │   ├── events-pending.js   # Handlers de pendências + DnD do Kanban
│   │   ├── events-addons.js    # Handlers do grid de addons
│   │   ├── events-scale.js     # Handlers da escala
│   │   └── events-nps.js       # Handlers de NPS e autosave de observações
│   ├── main.js                 # Bootstrap final: initializeApp, APP_INTERNALS, DOMContentLoaded
│   └── utils/
│       └── helpers.js          # Funções puras (format, date, esc, etc.)
│
├── tests/
│   ├── unit/                   # Testes unitários (Vitest)
│   ├── integration/            # Testes de integração
│   └── e2e/                    # Testes end-to-end (Playwright)
│
├── Docs/                       # Documentação técnica
│   ├── DOCUMENTACAO.md         # Documentação principal
│   ├── CORRECOES_ETAPA_1..md   # Correções etapa 1
│   ├── CORRECOES_ETAPA_2..md   # Correções etapa 2
│   ├── CORRECOES_ETAPA_3..md   # Correções etapa 3
│   ├── CORRECOES_ETAPA_4..md   # Correções etapa 4
│   ├── ETAPA_5_FINALIZACAO.md  # Finalização e refatoração modular
│   ├── SEPARACAO_EVENTOS_UI.md # Separação da camada de eventos UI
│   ├── SEPARACAO_MAIN_LIFECYCLE_BACKUP.md # Separação entre bootstrap, lifecycle e backup
│   └── QWEN.md                 # Contexto anterior
│
├── Legacy/                     # Arquivos legados
├── Scripts/                    # Scripts utilitários
└── node_modules/               # Dependências instaladas
```

---

## Módulos e Ordem de Carregamento

A ordem de carregamento dos `<script>` tags em `index.html` é crítica:

```
1. dompurify (CDN)
2. src/utils/helpers.js
3. src/core/config.js       ← state, storage, currentPeriodKey, editing IDs, DOM helper
4. src/core/period-builder.js
5. src/core/seed.js
6. src/core/schema.js
7. src/core/storage.js
8. src/domain/selectors.js
9. src/features/forms.js
10. src/features/nps.js
11. src/features/csv.js
12. src/features/diagnostics.js
13. src/ui/render-core.js
14. src/ui/render-dashboard.js
15. src/ui/render-students.js
16. src/ui/render-pending.js
17. src/ui/render-nps.js
18. src/ui/render-scale.js
19. src/ui/render-events.js
20. src/ui/render-settings.js
21. src/ui/render-addons.js
22. src/features/crud.js     ← handlers CRUD (resolve collections via getter)
23. src/ui/events-core.js    ← delegação principal, modais, tooltips, a11y
24. src/ui/events-students.js
25. src/ui/events-pending.js
26. src/ui/events-addons.js
27. src/ui/events-scale.js
28. src/ui/events-nps.js
29. src/core/backup.js       ← persistência de alto nível, import/export e snapshots
30. src/core/lifecycle.js    ← ciclo mensal, navegação entre meses, sync do período ativo
31. src/main.js              ← bootstrap final: initializeApp, APP_INTERNALS, DOMContentLoaded
```

### Camada de Eventos UI

- `src/ui/events-core.js` centraliza a infraestrutura transversal: `bindUIEvents()`, atalhos de teclado, trap de foco em modais, tooltips, sincronização de storage e acessibilidade.
- `bindUIEvents()` continua sendo a porta única da delegação global, mas agora monta registradores por domínio via `bindStudentEvents()`, `bindPendingEvents()`, `bindAddonEvents()`, `bindScaleEvents()` e `bindNpsEvents()`.
- `src/ui/events-pending.js` mantém `bindPendingDnD()` e `updatePendingStatus()`, preservando o comportamento do Kanban.
- O autosave de observações de NPS saiu de `src/main.js` e passou para `src/ui/events-nps.js`, sem alterar o debounce de `800ms`.

### Lifecycle & Backup

- `src/core/lifecycle.js` centraliza o lifecycle mensal: `switchPeriod()`, `closePeriod()`, `resetPeriod()`, `changePeriodFromControls()`, `duplicatePreviousMonthScale()`, `syncPeriodControls()` e `syncAppState()`.
- `src/core/backup.js` concentra persistência de alto nível e restauração: `loadStore()`, `saveStore()`, `saveData()`, snapshots commitados, `exportBackup()`, `importBackup()`, `saveLocalSnapshot()` e `restoreLocalSnapshot()`.
- `src/main.js` deixou de carregar regras de lifecycle e backup. O arquivo agora só expõe `APP_INTERNALS`, executa `initializeApp()` e instala o listener de `DOMContentLoaded`.

### Arquitetura em Camadas

```
┌─────────────────────────────────────────────┐
│  1. CONSTANTES & CONFIGURAÇÃO               │  Chaves de storage, versões, defaults
├─────────────────────────────────────────────┤
│  2. ARMAZENAMENTO / PERSISTÊNCIA            │  IndexedDB, localStorage, cache, broadcast
├─────────────────────────────────────────────┤
│  3. SCHEMA / MIGRAÇÃO / SANITIZAÇÃO         │  Versionamento, normalização, limpeza
├─────────────────────────────────────────────┤
│  4. LÓGICA DE DOMÍNIO / SELECTORS           │  Memoized queries, cálculos de negócio
├─────────────────────────────────────────────┤
│  5. TRANSIÇÕES DE ESTADO / AÇÕES            │  applyStudentSave, switchPeriod, etc.
├─────────────────────────────────────────────┤
│  6. RENDERIZAÇÃO                            │  renderHero, renderDashboard, etc.
├─────────────────────────────────────────────┤
│  7. UI / EVENTOS / ACESSIBILIDADE           │  Delegação, atalhos, modais, DnD
├─────────────────────────────────────────────┤
│  8. DIAGNÓSTICOS / TESTES                   │  Smoke tests, auditoria, relatórios
└─────────────────────────────────────────────┘
```

---

## Funcionalidades Principais

| Módulo | Descrição |
|---|---|
| **Dashboard** | KPIs em tempo real, insights automáticos, painel de recados entre turnos |
| **Alunos** | Cadastro de atendimentos com edição inline, filtros, resumo por recepcionista |
| **Addons** | Grid visual de vendas diárias por tipo e recepcionista, ranking top vendedores |
| **Pendências** | Quadro Kanban com drag & drop, tabela filtrável, exportação CSV |
| **NPS** | Score 0-100 com risk meter, metas, menções a funcionários, ranking com tendências |
| **Escala** | Calendário mensal com turnos de professores + recepção, código de cores, duplicação |
| **Eventos** | Registro de eventos/ações/campanhas, calendário visual, filtros por tipo/status |
| **Configurações** | Equipe, backup/restauração JSON, fechar mês, resetar mês, diagnósticos |

---

## Persistência de Dados

### Camada Híbrida

```
┌──────────────────────────────────────────────────┐
│              Aplicação (estado em memória)       │
│                      │                           │
│         storageCache (Map) ← leituras síncronas  │
│                      │                           │
│    ┌─────────────────┼─────────────────┐         │
│    ▼                 ▼                 ▼         │
│  IndexedDB      localStorage     Broadcast      │
│  (primário)     (espelho)        Channel        │
└──────────────────────────────────────────────────┘
```

### Chaves de Armazenamento

| Chave | Conteúdo |
|---|---|
| `recepcao-smartfit-dashboard-v34` | Store principal |
| `controle_recepcao_app_snapshot_v34` | Último snapshot local |
| `controle_recepcao_app_ui_v34` | Estado da UI (filtros, aba ativa) |

### Estrutura do Store

```javascript
{
  version: 4,
  activePeriod: "2026-04",
  periods: {
    "2026-04": {
      settings: { receptionists, professors, team, addonTypes, monthDays },
      students: [/* atendimentos */],
      pending: [/* pendências */],
      recados: [/* recados entre turnos */],
      nps: { score, monthlyGoal, semesterGoal, observations, mentions, rankSnapshot },
      scale: [/* dias de escala */],
      events: [/* eventos e ações */],
      addons: { "Nome": { "Tipo": [valor_por_dia] } }
    }
  },
  archives: { "2026-03": { /* mês fechado */ } }
}
```

---

## Comandos Principais

### Instalação de Dependências

```bash
npm install
```

### Executar Testes

```bash
# Testes unitários e de integração (Vitest)
npm test               # Executa uma vez
npm run test:watch     # Modo watch
npm run test:coverage  # Com cobertura

# Testes E2E (Playwright)
npm run test:e2e

# Todos os testes
npm run test:all
```

### Servir Localmente (desenvolvimento)

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8000
```

Acesse em: `http://localhost:8000/index.html`

---

## Desenvolvimento

### Adicionar Nova Funcionalidade

1. Identifique a camada responsável (features, domain, ui, etc.)
2. Crie ou edite o módulo correspondente em `src/`
3. Adicione o `<script>` tag em `index.html` na ordem correta de carregamento
4. Escreva testes unitários em `tests/unit/` ou E2E em `tests/e2e/`
5. Execute `npm test && npm run test:e2e` para validar

### Debug via Console

O app expõe `window.__APP_INTERNALS__` para diagnóstico:

```javascript
// Ver indicadores do dashboard
const indicadores = window.__APP_INTERNALS__.domain.selecionarIndicadoresDashboard();

// Forçar renderização
window.__APP_INTERNALS__.rendering.requestRender(['dashboard']);

// Ver métricas do período
const metrics = window.__APP_INTERNALS__.domain.getPeriodMetrics();

// Diagnósticos
window.__APP_INTERNALS__.diagnostics.runSystemDiagnostics(true);
```

### Convenções de Código

- **JavaScript ES6+** sem frameworks
- **Funções puras** em `src/utils/helpers.js`
- **Selectors memoizados** com cache limitado a 120 entradas
- **Sanitização** de inputs via DOMPurify + sanitização interna
- **Acessibilidade:** `aria-live`, navegação por teclado, foco previsível, modais com retorno de foco
- **Atalhos:** `Ctrl+1..7` para navegação entre abas, `Esc` para fechar modais, `/` para busca

---

## Estado Atual dos Testes

- **Vitest:** 112/112 ✅
- **Playwright:** 19/19 ✅
- **Total:** 131/131 ✅

---

## Navegadores Suportados

| Navegador | Versão Mínima |
|---|---|
| Chrome / Edge | 92+ |
| Firefox | 90+ |
| Safari | 15.4+ |
| Mobile Chrome | 92+ |
| Mobile Safari (iOS) | 15.4+ |

---

## Documentação Adicional

- `Docs/DOCUMENTACAO.md` — Documentação técnica completa (API, schema, migração, a11y)
- `Docs/SEPARACAO_EVENTOS_UI.md` — Responsabilidades, ordem de carga e estratégia da nova camada de eventos
- `Docs/SEPARACAO_MAIN_LIFECYCLE_BACKUP.md` — Responsabilidades, ordem de carga e compatibilidade entre bootstrap, lifecycle e backup
- `Docs/ETAPA_5_FINALIZACAO.md` — Detalhes da refatoração modular
- `Docs/CORRECOES_ETAPA_[1-4].md` — Histórico de correções por etapa

---

## Pós-auditoria

### Data

- Auditoria concluída em `2026-04-06`

### Resultado Final dos Testes

- **Vitest:** `116/116` ✅
- **Playwright:** `42/42` ✅
- **Total consolidado:** `158/158` ✅

### Resultado da Comparação Monólito × Modular

- A superfície pública do `APP_INTERNALS` foi preservada: **nenhuma função pública do monólito ficou ausente** na versão modular.
- Diferenças de declaração encontradas fora da superfície pública:
  - presentes no monólito, mas não com a mesma declaração top-level na versão modular: `doSave`, `saveEventItem`, `savePending`, `saveStudent`
  - adicionadas na versão modular: `createCrudHandler`, `doResizeMonth`, `sanitizeHtml`
- Duplicações relevantes entre módulos:
  - `csvEscape`, `buildCsvContent`
  - `formatBytes`, `formatPersistenceTimestamp`
  - `getRiskBand`, `getNpsGoalProgress`, `getNpsHistoryBandClass`
  - `normalizeSearchText`, `normalizeEventType`, `eventStatusClass`
  - `shortText`, `toneLabel`, `suggestScaleTone`

### Correções Confirmadas

- Correção prévia confirmada:
  - `studentStatusPill`, `npsPill` e `pendingPill` permanecem em `src/ui/render.js`, eliminando o bug de ordem de carga que quebrava Alunos Novos e Pendências.
- Correção adicional feita na pós-auditoria:
  - `src/ui/render.js`: `aplicarPatchLinhas()` foi ajustado para preservar `<tr>` reais no navegador e estabilizar CRUD + E2E.

### Status Final de Cada Módulo

- `src/utils/helpers.js` — `✅ OK`
- `src/core/config.js` — `✅ OK`
- `src/core/backup.js` — `✅ persistência de alto nível, import/export e snapshots`
- `src/core/lifecycle.js` — `✅ ciclo mensal e navegação de período`
- `src/core/schema.js` — `⚠ depende de globais tardios`
- `src/core/storage.js` — `⚠ mistura persistência, schema e UI state`
- `src/domain/selectors.js` — `✅ OK`
- `src/features/forms.js` — `✅ OK`
- `src/features/crud.js` — `✅ OK`
- `src/features/csv.js` — `⚠ mantém utilidades duplicadas`
- `src/features/diagnostics.js` — `✅ OK`
- `src/features/nps.js` — `✅ OK`
- `src/ui/render-*.js` — `⚠ render ainda depende de globais e ordem de carga`
- `src/ui/events-*.js` — `✅ separados por domínio; core ainda depende de globais do app`
- `src/main.js` — `✅ bootstrap mínimo; continua dependente da ordem de <script>`

### Observações Finais da Auditoria

- O CSS foi preservado funcionalmente: mesmas `39` variáveis e `14` media queries do monólito.
- Os mecanismos de performance foram preservados:
  - `aplicarHtmlSeMudou()`
  - `requestRender()`
  - `lerSelectorMemorizado()` com limite de `120`
  - `queueStorageOperation()`
- O seed determinístico funciona, mas o bootstrap padrão do app continua iniciando meses vazios em vez de usar `generatePeriodSeed()`.
- A modularização melhorou manutenção e testabilidade, mas o projeto continua dependente da ordem de `<script>` e de globais implícitos.
