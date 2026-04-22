# WPM Gestão Interna

Sistema de gestão interna para recepção — controle de atendimentos, pendências, NPS, escala e eventos em um único painel, 100% no navegador.

![Stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20CSS-f7df1e?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-enabled-5a0fc8?style=flat-square)
![License](https://img.shields.io/badge/license-ISC-blue?style=flat-square)
![Lang](https://img.shields.io/badge/lang-pt--BR-009c3b?style=flat-square)

---

## Sumário

- [Visão geral](#visão-geral)
- [Principais recursos](#principais-recursos)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Como rodar localmente](#como-rodar-localmente)
- [Testes](#testes)
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
| Testes E2E/visuais | [Playwright](https://playwright.dev/) + scripts próprios em `Scripts/` |
| Backend (planejado) | [Supabase](https://supabase.com/) (adapters já esboçados em `src/core/supabase.js`) |

---

## Arquitetura

O projeto é um **SPA de arquivo único (`index.html`)** com módulos JS organizados por responsabilidade. Não há bundler — os módulos são carregados em ordem e conversam via escopo global controlado.

```
┌────────────────────────────────────────────────────────────────┐
│                        index.html                             │
│  (topbar · hero · tabs · 8 views · 5 modais · footer)         │
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

---

## Testes

```bash
# Unitários (Vitest)
npm test

# E2E responsivo (Playwright headless + múltiplas viewports)
npm run test:e2e

# Visual check (screenshots + comparação)
npm run test:visual

# Tudo
npm run test:all
```

Relatórios ficam em `playwright-report/` e `test-results/`.

> Esses artefatos são locais e estão no `.gitignore`.

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
├── index.html                 # SPA monolítica (entrada principal)
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

- **Service Worker** (`sw.js`) pré-cacheia `index.html`, `styles.css`, módulos `src/**/*.js`, `manifest.json` e ícones.
- **IndexedDB** guarda todo o `state` — atendimentos, pendências, escalas, NPS, eventos, configurações.
- **Backup JSON** por um clique em *Configurações* → ideal para migrar entre navegadores ou arquivar o mês.
- **Detecção online/offline**: toast notifica quando conexão cai ou volta.

> **Atenção ao cache**: após deploy, o service worker pode manter assets antigos. Plano de mitigação em [`Docs/PROXIMOS_PASSOS.md`](./Docs/PROXIMOS_PASSOS.md) (Etapa 2).

---

## Documentação complementar

| Arquivo | Conteúdo |
|---|---|
| [`Docs/DOCUMENTACAO.md`](./Docs/DOCUMENTACAO.md) | Documentação funcional completa |
| [`Docs/UI_UX_OVERHAUL.md`](./Docs/UI_UX_OVERHAUL.md) | Design system + polish layer v1 |
| [`Docs/PROXIMOS_PASSOS.md`](./Docs/PROXIMOS_PASSOS.md) | Roadmap de evolução (Fase 0 → backend) |
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
- [ ] **Cache-busting do Service Worker** — versionamento por commit hash
- [ ] **Testes XSS** — aluno, pendência, evento, recado, NPS
- [ ] **Backend canônico (Supabase)** — schema, auth, RLS
- [ ] **Multi-unidade** — suporte a várias recepções no mesmo backend
- [ ] **Relatórios exportáveis** — PDF mensal consolidado

Detalhes em [`Docs/PROXIMOS_PASSOS.md`](./Docs/PROXIMOS_PASSOS.md).

---

## Contribuindo

Este é um projeto interno da WPM, mas o código segue práticas abertas:

1. Crie uma branch a partir de `main` (`feat/...`, `fix/...`, `docs/...`).
2. Rode `npm run test:all` antes de abrir PR.
3. Siga o padrão de commits: `tipo(escopo): mensagem` em pt-BR.
4. Para mudanças em `styles.css`, valide em 390 / 480 / 760 / 1200px.

O repositório usa o framework **CORTEX** (`.cortex/`) para auditoria e governança — ver [`PROTOCOL.md`](./PROTOCOL.md).

---

## Licença

ISC — ver [`package.json`](./package.json).

---

## Autor

**Wallace Phillip Maclayne** · [@WPHILLIPMACLAYNE](https://github.com/WPHILLIPMACLAYNE)

Engenharia assistida por Claude · Anthropic
