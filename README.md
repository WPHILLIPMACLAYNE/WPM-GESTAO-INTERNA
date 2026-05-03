# WPM Gestão Interna

Aplicação web operacional para recepção de academias, com dashboard, atendimentos, pendências, NPS, escala, eventos, backup, PWA offline e sincronização guardada com Supabase.

![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS-f7df1e?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-enabled-5a0fc8?style=flat-square)
![Backend](https://img.shields.io/badge/backend-Supabase-3ecf8e?style=flat-square)
![Deploy](https://img.shields.io/badge/deploy-Vercel-black?style=flat-square)
![Lang](https://img.shields.io/badge/lang-pt--BR-009c3b?style=flat-square)

## Estado Atual

O projeto deixou de ser o antigo HTML monolítico e hoje é uma aplicação web modular, browser-first, com app shell em `index.html`, módulos em `src/`, Service Worker próprio, testes automatizados e backend Supabase remoto homologado.

Produção principal:

- App publicado: `https://wpm-gestao-interna.vercel.app`
- Backend remoto: Supabase project `eautmpqkxibolmcfiacd`
- Unidade homologada: `Smartfit Pampulha`
- Slug operacional: `mgcpam2`
- Versão do app/store: `v34` / store version `4`
- Baseline técnico homologado: `191383e`
- Checkpoint documental mais recente antes desta atualização: `b4b50fd`

Em 2026-05-03, a homologação remota foi concluída com Vercel + Supabase:

- `env.js` publicado pelo Vercel com variáveis públicas browser-safe.
- Supabase Auth, recovery de senha, login e perfil admin validados no app publicado.
- SDK Supabase vendorizado em `src/vendor/supabase-js-2.104.0.umd.js` e precacheado pelo Service Worker.
- Dry-run remoto aprovado com `12 periodo(s) locais`, backend vazio e `0 divergencia(s)`.
- Migração inicial executada uma única vez.
- Reload remoto retornou `Base remota carregada com sucesso`.
- Navegação manual validou janeiro a dezembro.

Próxima etapa bloqueante antes de novas features:

**Etapa 11 - Piloto operacional controlado em produção.**

O objetivo é criar um atendimento controlado em `Maio/2026`, salvar localmente, sincronizar uma única vez, recarregar do Supabase e confirmar que o registro voltou do backend. Só depois disso entram novo ciclo visual, features ou expansão operacional.

## O Que o Sistema Faz

O WPM Gestão Interna centraliza a operação diária da recepção:

- Dashboard com KPIs, NPS, pendências, escala, eventos, recados e visão por atendente.
- Cadastro de alunos/atendimentos com feedback, addon, observações e filtros.
- Pendências em tabela e Kanban, com drag-and-drop e histórico de resposta.
- NPS com ranking, metas, histórico, observações e tendências.
- Escala semanal de professores e recepção, com turnos e substituições.
- Eventos e ações mensais com calendário, status, filtros e responsáveis.
- Configurações de equipe, professores, addons, período ativo, backup e diagnóstico.
- Backup/import JSON com preview, hash de integridade e proteções contra importação destrutiva.
- Sync local-first com checkpoint remoto para evitar sobrescrita silenciosa entre dispositivos.

## Arquitetura

O projeto não é mais um arquivo único com CSS e JavaScript embutidos. A aplicação continua sem bundler, mas agora é modularizada em camadas explícitas carregadas por `<script>` clássicos em ordem controlada.

```
index.html
├── env-bootstrap + config + observability
├── core/
│   ├── supabase.js
│   ├── storage.js
│   ├── schema.js
│   ├── backup.js
│   ├── lifecycle.js
│   └── pwa.js
├── domain/
│   └── selectors.js
├── features/
│   ├── crud.js
│   ├── forms.js
│   ├── nps.js
│   ├── csv.js
│   └── diagnostics.js
├── ui/
│   ├── render-*.js
│   ├── events-*.js
│   └── back-to-top.js
└── utils/
    └── helpers.js
```

Princípios atuais:

- `core/` concentra persistência, schema, backup, Supabase, lifecycle e PWA.
- `domain/` contém selectors puros para indicadores, rankings e filtros.
- `features/` guarda ações de negócio reutilizáveis.
- `ui/render-*` renderiza cada área funcional.
- `ui/events-*` conecta DOM events aos fluxos de negócio.
- `src/types.js` documenta contratos JSDoc e não é carregado em runtime.
- `MODULE_MAP.md` é a referência para ordem de carga e responsabilidades.

Limite consciente: o runtime ainda depende de globais e ordem de `<script>`, então mudanças em `index.html`, `sw.js`, `storage`, `backup`, `lifecycle`, `render-dashboard` e `events-core` exigem validação focada.

## Stack

| Camada | Tecnologia |
|---|---|
| Interface | HTML5, CSS custom, JavaScript ES2022 |
| Design | WPM Design System Polish Layer v1 em `styles.css` |
| Runtime | App shell estático, sem bundler, módulos por `<script>` clássico |
| Persistência local | IndexedDB + espelho localStorage + broadcast cross-tab |
| Backend | Supabase Auth, PostgreSQL, RPCs transacionais e RLS |
| Sync | Local-first guardado por checkpoint remoto de unidade |
| PWA | `sw.js`, `manifest.json`, cache versionado e suporte offline |
| Segurança | CSP via Vercel headers, SRI, DOMPurify, testes XSS |
| Testes | Vitest, Playwright, visual snapshots e smoke pós-deploy |
| Deploy | Vercel com `npm run build:env` gerando `env.js` público |

## Backend Supabase

O backend canônico está em `supabase/migrations/` e cobre:

- unidades, usuários e vínculos de unidade;
- períodos mensais e configurações por período;
- atendimentos, pendências, NPS, addons, escala e eventos;
- tabelas legadas preservadas;
- RPCs de bootstrap, importação guardada, checkpoint de sync e reload;
- hash de integridade `canonical-sha256-v1` para payloads de importação.

Contrato operacional:

- O browser só recebe `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_UNIT_SLUG`.
- `service_role` nunca entra em `env.js` nem no frontend.
- `Sincronizar agora` envia o store local completo apenas quando o checkpoint remoto ainda bate.
- Se houver conflito remoto, a ação segura é `Recarregar do backend`, revisar e reaplicar manualmente.
- `Importar backup` é operação de alto risco e exige preview revisado.

## PWA, Offline e Sync

O app continua útil sem rede após a primeira visita:

- Service Worker precacheia app shell, CSS, scripts, manifest, ícones e SDK Supabase local.
- IndexedDB guarda o store principal.
- localStorage funciona como espelho/compatibilidade.
- Broadcast cross-tab mantém abas sincronizadas.
- Toasts indicam estado online/offline e falhas relevantes.
- Backups JSON permitem transporte e recuperação manual.

Quando autenticado no Supabase, o app pode recarregar o backend ou sincronizar o store local, sempre com guarda de checkpoint para reduzir risco de perda silenciosa.

## Como Rodar Localmente

Pré-requisitos:

- Node.js 18+
- npm 9+
- Supabase CLI apenas se for testar backend local

Instalação:

```bash
git clone https://github.com/WPHILLIPMACLAYNE/WPM-GESTAO-INTERNA.git
cd WPM-GESTAO-INTERNA
npm install
```

Servidor estático:

```bash
python3 -m http.server 3000
# ou
npx serve . -p 3000
```

Acesse `http://localhost:3000`.

Configuração local opcional:

```bash
npm run setup
```

Esse comando cria `env.js` a partir de `env.example.js`. Edite somente variáveis públicas browser-safe:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_UNIT_SLUG`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`
- `APP_COMMIT`
- `APP_BUILD_TIME`
- `APP_RUNTIME_OVERRIDE`

Backend local:

```bash
npx supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npx supabase db reset --local
```

O seed local cria uma unidade de desenvolvimento, um admin local e o período aberto do mês corrente.

## Testes e Validação

Comandos principais:

```bash
npm test
npm run test:coverage
npm run test:e2e
npm run test:visual
npm run test:all
```

Smoke de deploy publicado:

```bash
DEPLOY_SMOKE_URL="https://wpm-gestao-interna.vercel.app/" npm run smoke:deploy
```

Validações importantes por tipo de mudança:

| Mudança | Validação recomendada |
|---|---|
| Lógica pura | `npm test` |
| Runtime/app shell | `node --check` nos JS alterados + `npm test` |
| UI ou fluxo browser | `npm run test:e2e` |
| Mudança visual sensível | `npm run test:visual` ou specs visuais Playwright |
| Service Worker/PWA | `tests/e2e/service-worker.spec.js` + smoke |
| Deploy | `npm run build:env` + `npm run smoke:deploy` |
| Sync/backup/import | testes unitários de backup/import + fluxo manual controlado |

Artefatos locais como `test-results/` e `playwright-report/` não devem ser commitados.

## Segurança e Qualidade

O projeto já passou por ciclos de hardening importantes:

- CSP sem `unsafe-inline` em scripts e estilos.
- Headers Vercel para CSP, `X-Frame-Options`, `Referrer-Policy` e `X-Content-Type-Options`.
- DOMPurify e Chart.js com SRI.
- Supabase SDK local vendorizado para reduzir dependência de CDN no fluxo de auth/recovery.
- Testes XSS por entidade.
- Labels e controles revisados para acessibilidade.
- Service Worker com cobertura dedicada.
- Importação Supabase guardada por preview, hash e RPC transacional.
- CORTEX como camada viva de continuidade, status e retomada.

## Design System e UX

O WPM Design System Polish Layer v1 está consolidado em `styles.css`:

- tokens de tipografia, espaçamento, raios, sombras, motion e z-index;
- botões, pills, cards, tabelas, modais, toasts e formulários;
- estados vazios ricos com próxima ação;
- `:focus-visible`, `prefers-reduced-motion` e `prefers-contrast`;
- layout mobile com cards para áreas críticas;
- botão global back-to-top;
- checks de responsividade em 390, 480, 760 e 1200px para mudanças visuais.

Documentos-chave:

- `Docs/UI_UX_OVERHAUL.md`
- `Docs/DIAGNOSTICO_MOBILE.md`
- `.cortex/REGRESSION_MAP.md`

## Estrutura de Diretórios

```
.
├── index.html
├── styles.css
├── sw.js
├── manifest.json
├── env.example.js
├── vercel.json
├── src/
│   ├── core/
│   ├── domain/
│   ├── features/
│   ├── reconstruction/
│   ├── ui/
│   ├── utils/
│   ├── vendor/
│   ├── main.js
│   └── types.js
├── supabase/
│   ├── migrations/
│   ├── reconstruction/
│   ├── config.toml
│   └── seed.sql
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── helpers/
├── Scripts/
├── Docs/
├── _reversa_sdd/
├── .cortex/
├── icons/
└── Legacy/
```

## Documentação Principal

| Documento | Finalidade |
|---|---|
| [Docs/HOMOLOGACAO_POS_MERGE_2026-05-03.md](./Docs/HOMOLOGACAO_POS_MERGE_2026-05-03.md) | Fonte de verdade da homologação Vercel + Supabase |
| [Docs/PROXIMOS_PASSOS.md](./Docs/PROXIMOS_PASSOS.md) | Roadmap atual, incluindo Etapas 11 e 12 |
| [Docs/RETOMADA_SEGURA.md](./Docs/RETOMADA_SEGURA.md) | Protocolo de retomada e proteção do baseline |
| [.cortex/CURRENT_STATUS.md](./.cortex/CURRENT_STATUS.md) | Estado operacional vivo |
| [.cortex/AGENT_HANDOFF.md](./.cortex/AGENT_HANDOFF.md) | Handoff para próxima sessão |
| [.cortex/RETOMADA_MASTER.md](./.cortex/RETOMADA_MASTER.md) | Guia mestre de recuperação |
| [MODULE_MAP.md](./MODULE_MAP.md) | Ordem de carga e responsabilidade dos módulos |
| [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) | Histórico e snapshot da migração |
| [Docs/BACKEND_CANONICO.md](./Docs/BACKEND_CANONICO.md) | Modelo lógico Supabase |
| [Docs/GUIA_CODE_REVIEW_PROJETO.md](./Docs/GUIA_CODE_REVIEW_PROJETO.md) | Guia de revisão e validação |
| [Docs/DEPLOY_OBSERVABILIDADE.md](./Docs/DEPLOY_OBSERVABILIDADE.md) | Deploy, smoke, observabilidade e rollback |
| [Docs/UI_UX_OVERHAUL.md](./Docs/UI_UX_OVERHAUL.md) | Design system e polish layer |
| [_reversa_sdd/](./_reversa_sdd/) | Especificações reconstruídas pelo Reversa |

## Roadmap Atual

- [x] Modularização do antigo app monolítico.
- [x] Separação `core`, `domain`, `features`, `ui`, `utils`.
- [x] UI/UX Overhaul v1 e correções mobile críticas.
- [x] PWA/service worker endurecido.
- [x] CSP, SRI, headers Vercel e testes XSS.
- [x] Backend canônico Supabase com migrations e RPCs.
- [x] Sync local-first guardado por checkpoint remoto.
- [x] Auth/recovery/login em produção.
- [x] Migração inicial remota homologada.
- [ ] Etapa 11: piloto operacional controlado com dado real/controlado.
- [ ] Etapa 12: runbook operacional pós-piloto.
- [ ] Multi-unidade.
- [ ] Relatórios exportáveis.

## Como Continuar o Projeto

Antes de qualquer nova tarefa:

```bash
git status --short --branch
git log --oneline -n 5
sed -n '1,180p' .cortex/CURRENT_STATUS.md
sed -n '1,160p' .cortex/AGENT_HANDOFF.md
```

Regra de ouro atual:

1. Não iniciar feature nova antes da Etapa 11.
2. Não fazer refinamento visual antes de provar persistência real em produção.
3. Não usar `Importar backup` em produção sem preview revisado.
4. Não clicar `Sincronizar agora` repetidamente.
5. Documentar cada etapa concluída em `.cortex/` e `Docs/RETOMADA_SEGURA.md`.

## Contribuição e Fluxo Git

Este é um projeto interno da WPM, mas o repositório segue práticas formais:

- trabalhar em branch própria a partir de `origin/main`;
- usar commits convencionais em pt-BR;
- rodar validações compatíveis com o escopo da mudança;
- não commitar `env.js`, secrets, `test-results/` ou `playwright-report/`;
- manter README, `.cortex/` e docs de status alinhados quando a verdade operacional mudar.

## Licença

ISC. Consulte `package.json`.

## Autor

Wallace Phillip Maclayne - [@WPHILLIPMACLAYNE](https://github.com/WPHILLIPMACLAYNE)
