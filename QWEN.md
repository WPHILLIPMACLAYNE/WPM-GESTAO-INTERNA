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
├── src/                        # JavaScript modular (13 arquivos)
│   ├── main.js                 # Bootstrap, persistência, inicialização
│   ├── core/
│   │   ├── config.js           # Constantes, estado global, DOM helper
│   │   ├── schema.js           # Migração, sanitização, validação
│   │   └── storage.js          # IndexedDB, localStorage, broadcast
│   ├── domain/
│   │   └── selectors.js        # Selectors memoizados com cache
│   ├── features/
│   │   ├── forms.js            # Form data, entity builders, validação
│   │   ├── crud.js             # Factory genérica de CRUD
│   │   ├── csv.js              # Exportação CSV
│   │   ├── nps.js              # CRUD de menções NPS + observações
│   │   └── diagnostics.js      # Smoke tests de fluxo
│   ├── ui/
│   │   ├── render.js           # Render scheduler, todas as funções render*
│   │   └── events.js           # Delegação de eventos, DnD, tooltips, a11y
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
4. src/core/schema.js
5. src/core/storage.js
6. src/domain/selectors.js
7. src/features/forms.js
8. src/features/nps.js
9. src/features/csv.js
10. src/features/diagnostics.js
11. src/ui/render.js         ← render scheduler, render*, patch DOM
12. src/features/crud.js     ← handlers CRUD (resolve collections via getter)
13. src/ui/events.js         ← event delegation
14. src/main.js              ← bootstrap, period lifecycle, APP_INTERNALS, initializeApp
```

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
- `Docs/ETAPA_5_FINALIZACAO.md` — Detalhes da refatoração modular
- `Docs/CORRECOES_ETAPA_[1-4].md` — Histórico de correções por etapa
