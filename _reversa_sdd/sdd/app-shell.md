# App Shell

## Visão Geral

🟢 O App Shell é o ponto de entrada estático do WPM Gestão Interna. Ele declara metadados PWA, CSP, CSS, CDNs e a árvore HTML inicial da aplicação em `index.html`.

🟢 O App Shell também define a ordem de carregamento dos scripts clássicos. Essa ordem é contrato de runtime porque os módulos compartilham funções e estado no escopo global do navegador.

## Responsabilidades

- 🟢 Declarar idioma `pt-BR`, viewport, descrição, tema mobile, manifest e ícone PWA.
- 🟢 Aplicar Content Security Policy sem `unsafe-inline`, restringindo scripts, estilos, conexões, workers, frame ancestors, base URI e form action.
- 🟢 Carregar `styles.css` como stylesheet principal e stylesheet runtime marcada com `data-runtime-stylesheet`.
- 🟢 Carregar DOMPurify e Chart.js via CDN com SRI e `crossorigin`.
- 🟢 Carregar Supabase JS via CDN com versão pinada, SRI e `crossorigin`.
- 🟢 Carregar `src/core/env-bootstrap.js` antes dos demais módulos locais.
- 🟢 Carregar módulos locais em ordem explícita: utils, core, domain, features, UI, backup/lifecycle e `src/main.js` por último.
- 🟢 Expor a estrutura DOM inicial para topbar, controles de período, abas, seções, formulários, modais, painéis e pontos de montagem dos renderizadores.
- 🟢 Fornecer fallback `noscript` para navegadores sem JavaScript.
- 🟢 Carregar `src/ui/back-to-top.js` e `src/core/pwa.js` no fim do corpo para funcionalidades auxiliares pós-shell.

## Interface

### Entradas

| Entrada | Tipo | Origem | Regra |
|---|---|---|---|
| `index.html` | documento HTML | host estático | Deve ser servido como app shell principal. 🟢 |
| `styles.css` | CSS | host estático | Deve existir e ser carregado antes da renderização visual. 🟢 |
| `manifest.json` | Web App Manifest | host estático | Deve estar disponível para PWA/install prompt. 🟢 |
| CDNs | JavaScript remoto | jsDelivr/Sentry CDN | Devem respeitar a CSP em `script-src`. 🟢 |
| scripts locais | JavaScript clássico | `src/**/*.js` | Devem executar na ordem declarada no HTML. 🟢 |
| `env.js` opcional | JavaScript local | carregado por `env-bootstrap` | Não é declarado diretamente no App Shell. 🟢 |

### Saídas

| Saída | Tipo | Consumidor |
|---|---|---|
| DOM inicial | HTML estruturado | `src/ui/render-*`, `src/ui/events-*` |
| Elementos com IDs estáveis | contrato de UI | renderizadores, handlers e testes |
| Globais de CDN | `DOMPurify`, `Chart`, `supabase` | helpers, gráficos e adapter Supabase |
| Ordem de execução | contrato runtime | módulos clássicos locais |
| CSP efetiva | política de segurança | navegador |

### IDs e pontos de montagem críticos

- 🟢 `main-content`, `periodMonthSelect`, `periodYearInput`, `monthStatusBadge`, `closeMonthBtn`.
- 🟢 Abas `dashboard`, `students`, `addons`, `pending`, `nps`, `scale`, `events`, `settings`.
- 🟢 Containers de renderização como `dashboardCards`, `summaryList`, `addonsOverview`, `pendingOverview`, `supabaseAuthPanel`.
- 🟢 Canvas de Chart.js como `dashboardStudentsEvolutionChart`, `dashboardReceptionistsChart`, `dashboardFeedbackDistributionChart`, `dashboardNpsTrendChart`, `dashboardAddonRankingChart`.

## Regras de Negócio

- 🟢 O App Shell deve iniciar em português do Brasil por `html lang="pt-BR"`.
- 🟢 O App Shell deve manter o título de produto `WPM Gestão Interna • v34`.
- 🟢 JavaScript é obrigatório para operação; sem JS, exibe banner `noscript`.
- 🟢 A CSP deve permitir conexões locais Supabase (`127.0.0.1:54321`, `localhost:54321`) e domínios Supabase/Sentry configurados.
- 🟢 `frame-ancestors 'none'` deve impedir incorporação por frames.
- 🟢 `style-src 'self'` exige que estilos dinâmicos sejam aplicados via stylesheet/runtime JS, não por estilos inline estáticos.
- 🟢 `env-bootstrap.js` deve carregar antes de `config.js` para garantir defaults seguros de ambiente.
- 🟢 `src/main.js` deve permanecer por último no carregamento principal para inicializar após a definição dos módulos.
- 🟢 `src/core/pwa.js` deve ser carregado depois do shell para registrar Service Worker sem bloquear a estrutura inicial.
- 🟢 Supabase JS CDN está pinado e com SRI `sha384` calculado para `@2.104.0`.
- 🔴 Não há contrato formal separado listando todos os IDs DOM públicos; o contrato está implícito em `index.html` e nos módulos UI.

## Fluxo Principal

1. 🟢 O navegador requisita `index.html` no host estático.
2. 🟢 O navegador aplica metadados, CSP, manifest, ícone PWA e `styles.css`.
3. 🟢 O navegador carrega DOMPurify, Chart.js e Supabase JS via CDN.
4. 🟢 `src/core/env-bootstrap.js` define defaults seguros de ambiente e prepara carregamento opcional de `env.js`.
5. 🟢 Os scripts locais são executados em ordem, expondo helpers, estado, adapters, selectors, features e renderizadores.
6. 🟢 `src/core/backup.js` e `src/core/lifecycle.js` entram antes do bootstrap final.
7. 🟢 `src/main.js` inicializa a aplicação no `DOMContentLoaded`.
8. 🟢 O DOM inicial oferece os pontos de montagem para renderização das seções.
9. 🟢 `src/ui/back-to-top.js` e `src/core/pwa.js` carregam funcionalidades auxiliares e PWA.

## Fluxos Alternativos

- **JavaScript desabilitado:** 🟢 O usuário vê o banner `noscript` informando que JavaScript é necessário.
- **CDN DOMPurify indisponível:** 🟡 `sanitizeHtml()` possui fallback por escape em `src/utils/helpers.js`, perdendo HTML permitido mas preservando segurança básica.
- **CDN Chart.js indisponível:** 🟡 O app core pode continuar, mas gráficos dependentes de Chart.js degradam ou não renderizam.
- **Supabase JS indisponível:** 🟢 O adapter Supabase cai para modo offline/local-first se SDK/env/sessão não estiverem disponíveis.
- **CSP bloqueia script ou conexão:** 🟢 O navegador bloqueia o recurso; a aplicação depende dos testes estruturais/smoke para detectar regressão.

## Dependências

- `styles.css` — aparência e layout principal.
- `manifest.json` e `icons/icon-192.svg` — experiência PWA.
- DOMPurify CDN — sanitização HTML.
- Chart.js CDN — gráficos do dashboard.
- Supabase JS CDN — Auth, PostgREST e RPC opcional.
- `src/core/env-bootstrap.js` — contrato de ambiente antes do core.
- `src/utils/helpers.js` — helpers globais necessários por módulos posteriores.
- `src/core/config.js` — constantes, DOM helper e estado global.
- `src/core/*` — persistência, schema, backup, lifecycle, Supabase, observabilidade e PWA.
- `src/domain/selectors.js` — dados derivados para UI.
- `src/features/*.js` — ações de negócio.
- `src/ui/*.js` — renderização e eventos.
- `src/main.js` — bootstrap final.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Segurança | Bloquear inline scripts/styles inseguros e framing externo por CSP. | `index.html` meta CSP | 🟢 |
| Segurança | Usar DOMPurify para sanitização HTML. | `index.html` CDN DOMPurify; `src/utils/helpers.js` usa `DOMPurify` | 🟢 |
| Segurança | Carregar DOMPurify, Chart.js e Supabase JS com SRI. | `index.html` atributos `integrity` | 🟢 |
| Segurança | Supabase JS CDN ainda não tem SRI documentado. | `_reversa_sdd/dependencies.md` | 🟡 |
| Disponibilidade | Operar sem Supabase quando env, SDK ou sessão falham. | `src/core/supabase.js`; `_reversa_sdd/code-analysis.md` | 🟢 |
| Disponibilidade | Exibir fallback para navegadores sem JavaScript. | `index.html` `noscript` | 🟢 |
| Compatibilidade | Carregar scripts clássicos em ordem fixa, sem bundler. | `index.html`; `_reversa_sdd/inventory.md` | 🟢 |
| PWA | Declarar manifest, theme-color, apple mobile flags e registrar PWA depois do shell. | `index.html`, `src/core/pwa.js` | 🟢 |

> Inferido a partir do código e artefatos Reversa. Validar com equipe de operações antes de transformar em checklist de release formal.

## Critérios de Aceitação

```gherkin
Dado que o usuário abre o app em um navegador com JavaScript habilitado
Quando o navegador carrega o index.html
Então o App Shell deve carregar styles.css, CDNs e scripts locais na ordem declarada
E src/main.js deve ser o último script principal antes da inicialização do app

Dado que o navegador possui JavaScript desabilitado
Quando o usuário abre o index.html
Então o banner noscript deve informar que o aplicativo precisa de JavaScript para funcionar corretamente

Dado que a CSP está ativa
Quando um recurso tenta executar script inline não autorizado ou abrir o app em frame externo
Então o navegador deve bloquear a execução/incorporação pela política definida no App Shell

Dado que Supabase JS ou env público não estão disponíveis
Quando o App Shell e os módulos principais carregam
Então a aplicação deve seguir em modo local-first sem quebrar o runtime principal

Dado que Chart.js está carregado com sucesso
Quando o dashboard renderiza os canvases declarados no App Shell
Então os renderizadores podem criar gráficos nos IDs de canvas esperados

Dado que DOMPurify está carregado com sucesso
Quando helpers de sanitização recebem HTML de renderização
Então o conteúdo deve passar por DOMPurify antes de ser aplicado no DOM
```

## Cenários de Borda

- 🟢 **CDN DOMPurify ausente:** sanitização deve degradar para escape textual seguro.
- 🟢 **Chart.js ausente em offline frio:** visualizações gráficas podem degradar, mas o requisito offline atual é abrir depois de carregamento online prévio.
- 🟢 **Supabase local em desenvolvimento:** CSP permite `http/ws` em `127.0.0.1:54321` e `localhost:54321`.
- 🟢 **Service Worker e env local:** `env.js` não deve ser cacheado pelo SW conforme arquitetura PWA documentada.
- 🟡 **Mudança de ordem de scripts:** qualquer alteração deve validar bootstrap real, pois os módulos não usam ESM runtime.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Carregar `index.html` como app shell principal | Must | Sem shell não há aplicação. |
| Manter ordem dos scripts locais | Must | Contrato crítico de runtime por globais. |
| Aplicar CSP sem `unsafe-inline` | Must | Decisão explícita de hardening. |
| Carregar `env-bootstrap` antes do core | Must | Necessário para defaults de ambiente. |
| Declarar pontos de montagem DOM estáveis | Must | Renderizadores e testes dependem dos IDs. |
| Carregar DOMPurify | Should | Há fallback seguro, mas perde HTML permitido. |
| Carregar Chart.js | Should | App core funciona, mas dashboard visual perde gráficos. |
| Carregar Supabase JS | Should | Backend é opcional; local-first é fallback. |
| Declarar manifest/PWA metadata | Should | Importante para experiência instalada/offline. |
| Links sociais do topo | Could | Não são caminho crítico de operação. |

> Prioridade inferida por posição na cadeia de bootstrap, dependências de renderização e decisões de segurança documentadas.

## Rastreabilidade de Código

| Arquivo | Função / Contrato | Cobertura |
|---|---|---|
| `index.html` | App shell, CSP, DOM inicial, ordem de scripts | 🟢 |
| `styles.css` | Estilos principais e stylesheet runtime | 🟢 |
| `manifest.json` | Manifest PWA | 🟢 |
| `src/core/env-bootstrap.js` | Ambiente antes do core | 🟢 |
| `src/utils/helpers.js` | Sanitização/fallback DOMPurify e runtime styles | 🟢 |
| `src/core/config.js` | Constantes e estado global esperados pelo shell | 🟢 |
| `src/main.js` | Bootstrap final | 🟢 |
| `src/core/pwa.js` | Registro PWA pós-shell | 🟢 |
| `src/ui/back-to-top.js` | Comportamento auxiliar pós-shell | 🟢 |
| `_reversa_sdd/inventory.md` | Evidência arquitetural do shell | 🟢 |
| `_reversa_sdd/dependencies.md` | Evidência de CDNs e SRI | 🟢 |
| `_reversa_sdd/architecture.md` | Container App Shell | 🟢 |
