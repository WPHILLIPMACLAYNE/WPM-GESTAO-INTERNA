# WPM Gestão Interna

Sistema de gestão interna para recepção — controle de atendimentos, pendências, NPS, escala e eventos em um único painel, 100% no navegador.

![Stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20CSS-f7df1e?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-enabled-5a0fc8?style=flat-square)
![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-22c55e?style=flat-square)
![Backend](https://img.shields.io/badge/backend-Supabase%20optional-3ecf8e?style=flat-square)
![License](https://img.shields.io/badge/license-ISC-blue?style=flat-square)
![Lang](https://img.shields.io/badge/lang-pt--BR-009c3b?style=flat-square)

---

## Sumário

- [Visão geral](#visão-geral)
- [Status atual](#status-atual)
- [Principais recursos](#principais-recursos)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Como rodar localmente](#como-rodar-localmente)
- [Testes](#testes)
- [Qualidade, segurança e auditoria](#qualidade-segurança-e-auditoria)
- [Fluxo Seguro de Evolução](#fluxo-seguro-de-evolução)
- [Estrutura de diretórios](#estrutura-de-diretórios)
- [Design system](#design-system)
- [PWA e offline](#pwa-e-offline)
- [Documentação complementar](#documentação-complementar)
- [Roadmap](#roadmap)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

---

## Visão geral

O **WPM Gestão Interna** é um SPA (Single Page Application) concebido para o dia a dia da recepção: concentra em um só lugar os principais fluxos operacionais — alunos novos, pendências abertas, citações de NPS, escala de professores/recepção e eventos/ações do mês — com dashboards consolidados, filtros por período e persistência local (IndexedDB) com exportação/importação de backup.

O projeto nasceu para substituir planilhas e mensagens soltas, oferecendo uma **fonte única de verdade** para a equipe de atendimento, com foco em:

- **Velocidade**: UI densa mas legível, pensada para uso diário.
- **Confiabilidade**: dados persistidos localmente, sem dependência de rede.
- **Autonomia**: backup/import em um clique, sem servidor obrigatório.
- **Estética premium**: design system consolidado em tema escuro com acento dourado.

---

## Status atual

Esta linha de release está consolidada como versão candidata para `main` e foi validada em CI com:

- **Testes Unitários + Coverage**: Vitest com provider `@vitest/coverage-v8`.
- **Testes E2E**: Playwright em Chromium.
- **Validação de estrutura**: presença de entrypoints, CSP, DOMPurify e módulos críticos.
- **Teste de responsividade**: script multi-viewport em desktop, tablet e mobile.
- **Deploy preview**: Vercel ativo para a branch de release.

Auditoria executiva registrada em [`Docs/CX_FULLSTACK_SCAN_EXECUCAO_2026-04-23.md`](./Docs/CX_FULLSTACK_SCAN_EXECUCAO_2026-04-23.md).

---

## Principais recursos

### Dashboard
- KPIs do mês: NPS, pendências abertas, próxima escala, próximo evento.
- Gráfico de feedback positivo por atendente.
- Ranking de addons vendidos por pessoa.
- Painel de recados independente por período.
- Comparativo do atendente vs. média do time.

### Alunos novos do mês
- Cadastro rápido com atendente, feedback, addon e observações.
- Edição inline de última visita e hora.
- Filtros por atendente, status de feedback e busca textual.
- Vínculo automático de addon ao contador do atendente.

### Pendências
- Tabela e **Kanban** (Abertas / Respondidas / Concluídas).
- Drag-and-drop entre colunas com atalhos de teclado.
- Resposta e histórico por pendência.
- Strip de status no topo com contadores em tempo real.

### NPS
- Ranking de citações por funcionário com tendência mês a mês.
- Histórico de líderes dos meses anteriores.
- Ajuste rápido de contagem (+/-) ou edição numérica direta.

### Escala
- Grade semanal de professores + recepção.
- Board visual por dia com turnos múltiplos.
- Duplicação do mês anterior em um clique.
- Troca de turno com registro de quem substitui.

### Eventos e ações
- Agenda do mês com tipo, responsável e status.
- Calendário visual + tabela detalhada.
- Duplicação de eventos recorrentes.
- Chips de status e filtros combináveis.

### Configurações
- Cadastro de recepcionistas, professores, tipos de addon.
- Import/export de backup completo (JSON).
- Alternância de período ativo (mês/ano) com bloqueio de escrita em períodos fechados.

---

## Stack

| Camada | Tecnologia |
|---|---|
| UI | HTML5 + CSS custom (design tokens, `:has()`, `:focus-visible`, scroll-snap) |
| Lógica | JavaScript ES2022 modular (sem bundler — imports via `<script>` + IIFE/global) |
| Persistência | IndexedDB (via módulo próprio `src/core/storage.js`) |
| Gráficos | [Chart.js](https://www.chartjs.org/) via CDN |
| Sanitização | [DOMPurify](https://github.com/cure53/DOMPurify) via CDN |
| PWA | Service Worker próprio (`sw.js`) com `manifest.json` |
| Testes unitários | [Vitest](https://vitest.dev/) |
| Coverage | `@vitest/coverage-v8` |
| Testes E2E/visuais | [Playwright](https://playwright.dev/) + scripts próprios em `Scripts/` |
| Backend | [Supabase](https://supabase.com/) com auth/session, leitura remota e sync híbrida inicial em `src/core/supabase.js` |
| Segurança | CSP sem `unsafe-inline`, DOMPurify, SRI nos CDNs críticos e testes XSS por entidade |
| CI/CD | GitHub Actions + Vercel preview/deploy |

---

## Arquitetura

O projeto é um **SPA browser-only com `index.html` como app shell** e módulos JS organizados por responsabilidade em `src/`. Não há bundler nem `import`/`export` no runtime — os scripts são carregados em ordem pelo HTML e conversam via escopo global controlado.

```
┌────────────────────────────────────────────────────────────────┐
│                 index.html (app shell)                        │
│  (CSP · CDNs · ordem de scripts · topbar · tabs · modais)     │
└────────────────────────────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌──────────┐         ┌──────────┐        ┌──────────┐
   │  core/   │         │ domain/  │        │features/ │
   │          │         │          │        │          │
   │ storage  │         │selectors │        │  crud    │
   │ backup   │         │          │        │  forms   │
   │ schema   │         │          │        │  nps     │
   │ seed     │         │          │        │  csv     │
   │lifecycle │         │          │        │diagnstc. │
   │observab. │         │          │        │          │
   │supabase  │         │          │        │          │
   └────┬─────┘         └────┬─────┘        └────┬─────┘
        │                    │                   │
        └────────────────────┼───────────────────┘
                             ▼
                       ┌──────────┐
                       │   ui/    │
                       │          │
                       │ render-* │  ← renderização pura
                       │ events-* │  ← bindings de DOM events
                       └──────────┘
                             │
                             ▼
                       ┌──────────┐
                       │ utils/   │
                       │ helpers  │
                       └──────────┘
```

**Princípios:**

- **`render-*`** produzem HTML declarativamente a partir de `state`.
- **`events-*`** fazem binding de handlers e delegam para `features/` (lógica de negócio).
- **`core/storage`** centraliza IndexedDB; ninguém mais toca persistência direto.
- **`domain/selectors`** são funções puras que derivam indicadores do `state`.
- **Diffing otimizado**: helpers `aplicarHtmlSeMudou`, `aplicarPatchLinhas`, `aplicarPatchCards` minimizam re-renderização.

---

## Como rodar localmente

### Pré-requisitos

- Node.js ≥ 18
- npm ≥ 9

### Passos

```bash
# 1. Clonar e entrar no diretório
git clone https://github.com/WPHILLIPMACLAYNE/WPM-GESTAO-INTERNA.git
cd WPM-GESTAO-INTERNA

# 2. Instalar dependências (dev apenas)
npm install

# 3. Servir o app (qualquer servidor estático funciona)
python3 -m http.server 3000
# ou
npx serve . -p 3000
```

Acesse **http://localhost:3000**.

> **Por que um servidor?** O Service Worker e os módulos JS exigem origem HTTP (não `file://`). Qualquer servidor estático serve.

### Runtime de ambiente (`env.js`)

- O app sempre inicia com defaults seguros de `window.__APP_ENV__` em `src/core/env-bootstrap.js`.
- O arquivo `env.js` é opcional e carregado somente em runtime local (`localhost`, `127.0.0.1` ou `file://`).
- Em deploy remoto (como GitHub Pages), `env.js` não é requisitado, evitando ruído de `404` no boot.
- Chaves públicas suportadas hoje: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_UNIT_SLUG`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `APP_COMMIT`, `APP_BUILD_TIME` e `APP_RUNTIME_OVERRIDE`.
- Checklist de deploy, smoke pós-deploy e rollback seguro: [`Docs/DEPLOY_OBSERVABILIDADE.md`](./Docs/DEPLOY_OBSERVABILIDADE.md).

### Backend local (`Supabase`)

O schema canônico e as RPCs de backend vivem em `supabase/migrations/`. Para subir o backend local com seed de desenvolvimento:

```bash
npx supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npx supabase db reset --local
```

O `db reset` aplica as migrations e carrega `supabase/seed.sql`, criando:

- unidade local `WPM Unidade Local`
- período aberto do mês corrente em `America/Sao_Paulo`
- usuário admin de desenvolvimento

Credenciais locais seeded:

- e-mail: `dev.admin@wpm.local`
- senha: `Admin123!`

Para ligar o frontend ao backend local, preencha o `env.js` com os valores públicos do `npx supabase status`:

```js
window.__APP_ENV__ = Object.assign({}, window.__APP_ENV__ || {}, {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'sb_publishable_...',
  SUPABASE_UNIT_SLUG: 'wpm-unidade-local',
  APP_COMMIT: 'local-dev',
  APP_BUILD_TIME: new Date().toISOString()
});
```

Bootstrap inicial fora do seed:

- a função `public.bootstrap_unit_admin(...)` cria a primeira `unit`, o vínculo `admin` e o `period_settings` inicial;
- o uso é restrito a `service_role` ou SQL administrativo;
- a `service_role` nunca deve ir para `env.js` nem para o browser.

Homologação operacional real da migração assistida:

- o roteiro está em [`Docs/HOMOLOGACAO_MIGRACAO_REAL.md`](./Docs/HOMOLOGACAO_MIGRACAO_REAL.md);
- em 2026-04-22 o fluxo foi validado em navegador real com sessão autenticada, dry-run consistente,
  snapshot local, pós-migração remoto e fechamento de mês sobre a base remota.

---

## Testes

```bash
# Unitários (Vitest)
npm test

# Unitários com coverage
npm run test:coverage

# E2E responsivo (Playwright headless + múltiplas viewports)
npm run test:e2e

# Visual check (screenshots + comparação)
npm run test:visual

# Tudo
npm run test:all
```

Relatórios ficam em `playwright-report/` e `test-results/`.

> Esses artefatos são locais e estão no `.gitignore`.

### Matriz de CI

O workflow principal (`.github/workflows/ci.yml`) executa:

| Job | Finalidade |
|---|---|
| Testes Unitários | `npm run test:coverage`, upload de coverage e Codecov quando token existe |
| Testes E2E | `npx playwright test --reporter=line` com Chromium |
| Validação de Estrutura | checa entrypoints, CSP, DOMPurify, reduced motion e modularização |
| Teste de Responsividade | executa `Scripts/responsive-test.mjs` em múltiplas viewports |
| Resumo | consolida o status dos jobs no summary do GitHub Actions |

Para smoke pós-deploy real:

```bash
npm run smoke:deploy
```

---

## Qualidade, segurança e auditoria

O projeto recebeu hardening específico para uso em produção browser-first:

- CSP sem `unsafe-inline` em `script-src` e `style-src`.
- DOMPurify com SRI para sanitização dos patches HTML.
- Chart.js com SRI.
- Supabase CDN fixado em versão exata.
- Testes de XSS por entidade cobrindo alunos, pendências, eventos, recados, NPS e configurações.
- Labels de formulários associados a seus campos, incluindo linhas dinâmicas da escala.
- Service Worker com estratégia de revisão de assets e testes dedicados.
- Persistência local-first com fila serializada, IndexedDB, espelho localStorage e broadcast cross-tab.
- Sync Supabase protegido por checkpoint remoto para evitar sobrescrita silenciosa.

Relatórios e guias principais:

- [`Docs/CX_FULLSTACK_SCAN_EXECUCAO_2026-04-23.md`](./Docs/CX_FULLSTACK_SCAN_EXECUCAO_2026-04-23.md)
- [`Docs/GUIA_CODE_REVIEW_PROJETO.md`](./Docs/GUIA_CODE_REVIEW_PROJETO.md)
- [`Docs/DEPLOY_OBSERVABILIDADE.md`](./Docs/DEPLOY_OBSERVABILIDADE.md)

---

## Fluxo Seguro de Evolução

Para continuar o projeto sem risco de quebrar o deploy atual:

- use `origin/main` como baseline estável;
- desenvolva sempre em branch própria;
- não faça alterações diretas em `main`;
- valide testes antes de abrir PR.

Guia prático completo: [`Docs/RETOMADA_SEGURA.md`](./Docs/RETOMADA_SEGURA.md).

---

## Estrutura de diretórios

```
.
├── index.html                 # App shell, CSP, CDNs e ordem de carga dos módulos
├── styles.css                 # CSS completo + WPM Polish Layer v1
├── sw.js                      # Service Worker (PWA)
├── manifest.json              # Web App Manifest
├── src/
│   ├── main.js                # Bootstrap + lifecycle
│   ├── types.js               # JSDoc typedefs
│   ├── core/                  # Persistência, backup, schema, observabilidade
│   ├── domain/                # Selectors puros
│   ├── features/              # Regras de negócio (crud, forms, nps, csv)
│   ├── ui/
│   │   ├── render-*.js        # Funções de renderização por view
│   │   └── events-*.js        # Bindings de DOM events
│   └── utils/helpers.js       # Esc, date, format, debounce, etc.
├── Scripts/                   # Ferramentas dev (setup-env, testes)
├── tests/                     # Unitários (Vitest) e E2E (Playwright)
├── icons/                     # Ícones PWA
├── adapters/                  # Adapters de integração (Supabase, etc.)
├── Docs/                      # Documentação técnica e roadmap
└── Legacy/                    # Arquivos antigos preservados
```

---

## Design system

Consolidado no **WPM Design System Polish Layer v1** (camada aditiva em `styles.css`).

### Tokens globais

- **Tipografia**: `--font-2xs` a `--font-3xl`.
- **Espaçamento**: escala consistente.
- **Raios**: `--radius-sm`/`md`/`lg`/`xl`.
- **Sombras**: `--shadow-xs` a `--shadow-xl` + `--shadow-focus`.
- **Motion**: `--motion-fast`/`base`/`slow`, `--ease-out`, `--ease-spring`.
- **Z-index**: `--z-sticky`, `--z-topbar: 40`, `--z-modal: 90`, `--z-toast: 100`.
- **Cores**: tema escuro com acento `#FFC20F` (dourado).

### Componentes

Botões (`.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-xs`, `.btn.is-loading`), cards (`.card`, `.card-kpi`, `.card-nav`), pills (`.pill`, `.pill.ok`, `.pill.bad`, `.pill.warn`, `.pill--dot`), tabelas (`.table` com scroll-shadows + zebra + tabular-nums), modais (sticky head/footer com blur), formulários (inputs com transições, `.field-error`, `.field-group`).

### Estados vazios ricos

```html
<div class="empty">
  <strong>Título direto</strong>
  Corpo explicativo com <em>próxima ação</em> em destaque dourado.
</div>
```

Variante compacta: `.empty.empty--compact`.

### Acessibilidade

- `:focus-visible` universal com `--shadow-focus`.
- `@media (prefers-reduced-motion: reduce)` — desliga todas as animações.
- `@media (prefers-contrast: more)` — reforça bordas, pills e placeholders.
- Navegação por teclado no Kanban (ArrowUp/Down, Home/End, Alt+Arrow para mover).
- `aria-label` em todos os botões de ação de linha.

### Utilitários globais

- **Back-to-top** flutuante (`.back-to-top`) que aparece após 480px de scroll e oculta automaticamente quando modal está aberto.
- **Toasts** com transições suaves.
- **Skeleton loading** (`.skeleton`, `.skeleton-row`, `.skeleton-pill`).

Detalhes completos em [`Docs/UI_UX_OVERHAUL.md`](./Docs/UI_UX_OVERHAUL.md).

---

## PWA e offline

O app funciona offline após a primeira visita:

- **Service Worker** (`sw.js`) pré-cacheia `index.html`, `styles.css`, módulos `src/**/*.js`, `manifest.json` e ícones, com revisão derivada do conteúdo dos assets.
- **IndexedDB** guarda todo o `state` — atendimentos, pendências, escalas, NPS, eventos, configurações.
- **Sync local-first guardada**: quando autenticado no Supabase, o app envia o store local para o backend apenas se o checkpoint remoto da unidade ainda bate com a última leitura/sincronização conhecida.
- **Backup JSON** por um clique em *Configurações* → ideal para migrar entre navegadores ou arquivar o mês.
- **Detecção online/offline**: toast notifica quando conexão cai ou volta.

> Mudanças em bootstrap, `sw.js`, `index.html` ou ordem de scripts devem ser verificadas junto com [`MODULE_MAP.md`](./MODULE_MAP.md).

---

## Documentação complementar

| Arquivo | Conteúdo |
|---|---|
| [`Docs/DOCUMENTACAO.md`](./Docs/DOCUMENTACAO.md) | Documentação funcional completa |
| [`Docs/CX_FULLSTACK_SCAN_EXECUCAO_2026-04-23.md`](./Docs/CX_FULLSTACK_SCAN_EXECUCAO_2026-04-23.md) | Execução da auditoria fullstack/UX/segurança da release |
| [`Docs/UI_UX_OVERHAUL.md`](./Docs/UI_UX_OVERHAUL.md) | Design system + polish layer v1 |
| [`Docs/DEPLOY_OBSERVABILIDADE.md`](./Docs/DEPLOY_OBSERVABILIDADE.md) | Checklist de deploy, smoke e observabilidade |
| [`Docs/PROXIMOS_PASSOS.md`](./Docs/PROXIMOS_PASSOS.md) | Roadmap de evolução (Fase 0 → backend) |
| [`Docs/BACKEND_CANONICO.md`](./Docs/BACKEND_CANONICO.md) | ERD lógico, papéis e transações canônicas do backend |
| [`Docs/HOMOLOGACAO_MIGRACAO_REAL.md`](./Docs/HOMOLOGACAO_MIGRACAO_REAL.md) | Checklist operacional da migração assistida real |
| [`Docs/GUIA_CODE_REVIEW_PROJETO.md`](./Docs/GUIA_CODE_REVIEW_PROJETO.md) | Guia de revisão com severidade, evidência e validação |
| [`Docs/BUGS_CONHECIDOS.md`](./Docs/BUGS_CONHECIDOS.md) | Bugs e riscos rastreados |
| [`Docs/DIAGNOSTICO_MOBILE.md`](./Docs/DIAGNOSTICO_MOBILE.md) | Análise mobile + Bug 2/Bug 3 |
| [`Docs/MAPA_ENTIDADES.md`](./Docs/MAPA_ENTIDADES.md) | Modelo de dados para backend |
| [`Docs/FASE_0_CHECKLIST.md`](./Docs/FASE_0_CHECKLIST.md) | Checklist de preparação para Supabase |
| [`MODULE_MAP.md`](./MODULE_MAP.md) | Mapa modular (render-*, events-*, features) |
| [`TECH_DEBT.md`](./TECH_DEBT.md) | Débito técnico e prioridades |
| [`MIGRATION_STATUS.md`](./MIGRATION_STATUS.md) | Status da migração para backend |

---

## Roadmap

- [x] **Fase 0** — Infraestrutura de runtime, Supabase base e observabilidade
- [x] **UI/UX Overhaul v1** — Design system, empty states ricos, back-to-top, a11y
- [x] **Cache-busting do Service Worker** — revisão derivada do conteúdo dos assets e teste dedicado
- [x] **Hardening CSP + Testes XSS** — headers Vercel, SRI, XSS por entidade
- [x] **Backend canônico (Supabase)** — schema, auth, RLS, sync híbrida, migração assistida, homologação operacional real e guarda de conflito por checkpoint
- [ ] **Merge fino por entidade** — reduzir escrita remota de store completo quando houver múltiplos operadores simultâneos
- [ ] **Multi-unidade** — suporte a várias recepções no mesmo backend
- [ ] **Relatórios exportáveis** — PDF mensal consolidado

Detalhes em [`Docs/PROXIMOS_PASSOS.md`](./Docs/PROXIMOS_PASSOS.md).

---

## Contribuindo

Este é um projeto interno da WPM, mas o código segue práticas abertas:

1. Crie uma branch a partir de `main` (`feat/...`, `fix/...`, `docs/...`).
2. Rode `npm test`, `npm run test:coverage` e `npm run test:e2e` antes de abrir PR.
3. Siga o padrão de commits: `tipo(escopo): mensagem` em pt-BR.
4. Para mudanças em `styles.css`, rode `npm run test:visual` e valide em 390 / 480 / 760 / 1200px.

O repositório usa o framework **CORTEX** (`.cortex/`) para auditoria e governança — ver [`PROTOCOL.md`](./PROTOCOL.md).

---

## Licença

ISC — ver [`package.json`](./package.json).

---

## Autor

**Wallace Phillip Maclayne** · [@WPHILLIPMACLAYNE](https://github.com/WPHILLIPMACLAYNE)

Engenharia assistida por agentes de código e revisão automatizada
