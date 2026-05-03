# Service Worker / PWA

## Visão Geral

🟢 `sw.js` implementa o service worker PWA do WPM Gestão Interna, com precache de app shell, cache versionado por hash de conteúdo, fallback offline para `index.html`, limpeza de caches antigos e estratégias separadas para app shell, assets locais, `env.js` e CDNs.

🟢 `src/core/pwa.js` registra o service worker no browser, notifica online/offline, verifica atualização ao voltar online e recarrega o app quando um novo controller assume.

🟢 O objetivo operacional é manter o app estático confiável após o primeiro carregamento, reduzindo risco de cache antigo preso em GitHub Pages/Vercel.

## Responsabilidades

- 🟢 Definir versão de app e versão de estratégia de cache.
- 🟢 Enumerar assets locais do app shell em `PRECACHE_ASSET_PATHS`.
- 🟢 Derivar URLs absolutas no escopo atual do app.
- 🟢 Calcular hash do manifesto fallback.
- 🟢 Baixar cada asset com `cache: 'reload'` durante install.
- 🟢 Calcular hash de conteúdo de cada asset.
- 🟢 Criar nome de cache ativo por revisão de conteúdo.
- 🟢 Registrar cache ativo em cache meta.
- 🟢 Precachear assets estáticos e fallback de documento.
- 🟢 Chamar `skipWaiting()` no install.
- 🟢 Limpar caches antigos com prefixo `wpm-` no activate.
- 🟢 Habilitar navigation preload quando disponível.
- 🟢 Chamar `clients.claim()` no activate.
- 🟢 Tratar CDNs como network-only.
- 🟢 Nunca servir `env.js` do cache.
- 🟢 Aplicar network-first para navegação, manifest, scripts e estilos do app shell.
- 🟢 Aplicar cache-first para demais assets locais no escopo.
- 🟢 Responder 503 vazio quando rede/cache falham.
- 🟢 Aceitar mensagem `skipWaiting`.
- 🟢 Registrar SW apenas em `http:` ou `https:`.
- 🟢 Exibir toasts de atualização, online e offline.

## Interface

### Constantes

| Nome | Tipo | Regra |
|---|---|---|
| `APP_VERSION` | string | versão funcional do app; atualmente `v34`. 🟢 |
| `SW_CACHE_STRATEGY_VERSION` | string | versão da estratégia; atualmente `runtime-v2`. 🟢 |
| `CACHE_PREFIX` | string | `wpm-${APP_VERSION}-`. 🟢 |
| `META_CACHE_NAME` | string | `wpm-meta-${APP_VERSION}`. 🟢 |
| `ACTIVE_CACHE_META_URL` | URL | chave meta para cache ativo. 🟢 |
| `PRECACHE_ASSET_PATHS` | string[] | app shell e scripts locais. 🟢 |
| `DOCUMENT_FALLBACK_URL` | URL | `index.html`. 🟢 |
| `MANIFEST_URL` | URL | `manifest.json`. 🟢 |

### API Interna do Service Worker

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `hashCacheManifest(input)` | string | hash hex | FNV-like para manifesto/revisão. 🟢 |
| `hashByteArray(bytes)` | Uint8Array | hash hex | hash de conteúdo de asset. 🟢 |
| `isCdnRequest(url)` | string | boolean | detecta `cdn.jsdelivr.net`. 🟢 |
| `isAppScopeRequest(url)` | URL | boolean | origem e path dentro do escopo. 🟢 |
| `isNavigationRequest(request)` | Request | boolean | `navigate` ou `document`. 🟢 |
| `isAppShellRequest(request, url)` | Request, URL | boolean | navegação, manifest, scripts e estilos. 🟢 |
| `isLocalEnvRequest(url)` | URL | boolean | detecta `/env.js`. 🟢 |
| `shouldCacheResponse(response)` | Response | boolean | ok e tipo `basic/default`. 🟢 |
| `buildPrecacheBundle()` | nenhum | `{cacheName, entries}` | baixa assets e calcula revisão. 🟢 |
| `networkFirst(request, options)` | Request | Promise<Response> | tenta rede, depois cache/fallback. 🟢 |
| `cacheFirst(request)` | Request | Promise<Response> | tenta cache, depois rede. 🟢 |

### Eventos

| Evento | Regra |
|---|---|
| `install` | cria precache por conteúdo, grava cache ativo e chama `skipWaiting()`. 🟢 |
| `activate` | remove caches antigos, habilita preload e chama `clients.claim()`. 🟢 |
| `fetch` | aplica estratégia conforme tipo de request. 🟢 |
| `message` | se `event.data === 'skipWaiting'`, chama `self.skipWaiting()`. 🟢 |

## Regras de Negócio

- 🟢 Cache de app deve ter nome `wpm-v34-[hash]`.
- 🟢 A revisão de cache deve depender do conteúdo baixado dos assets, não apenas da lista de caminhos.
- 🟢 Cache meta deve persistir o nome do cache ativo.
- 🟢 Se cache meta não existe, fallback deve ser `CACHE_NAME_FALLBACK`.
- 🟢 Durante install, falha ao baixar asset de precache deve falhar o bundle.
- 🟢 Apenas respostas `ok` e de tipo `basic/default` devem ser cacheadas.
- 🟢 CDNs devem ser network-only e não entrar no cache.
- 🟢 `env.js` deve ser sempre buscado da rede e nunca servido de cache antigo.
- 🟢 Navegações devem usar network-first com fallback para `index.html`.
- 🟢 Manifest, scripts e styles locais do app shell devem usar network-first.
- 🟢 Assets locais estáveis fora do app shell devem usar cache-first.
- 🟢 Requests não GET devem ser ignorados pelo service worker.
- 🟢 Caches antigos com prefixo `wpm-` devem ser removidos no activate, exceto meta e cache ativo.
- 🟢 O app shell deve ficar disponível offline após primeiro carregamento controlado.
- 🟢 Registro PWA deve ser ignorado em `file://` ou runtimes sem `navigator.serviceWorker`.
- 🟢 Ao detectar novo SW instalado com controller anterior, `pwa.js` deve avisar atualização.
- 🟢 Ao `controllerchange`, o app deve recarregar uma vez para aplicar atualização.
- 🟢 Requisito offline atual é leve: app deve funcionar offline depois de já ter sido carregado online ao menos uma vez.
- 🟢 CDNs network-only e ausência de página offline dedicada são riscos aceitos para o requisito offline leve atual.

## Fluxo Principal

1. 🟢 Browser carrega `src/core/pwa.js`.
2. 🟢 `initPwaRuntime()` verifica suporte a `navigator.serviceWorker`.
3. 🟢 Se protocolo é `http:` ou `https:`, registra `sw.js` no escopo atual.
4. 🟢 Service worker recebe evento `install`.
5. 🟢 `buildPrecacheBundle()` baixa cada asset com `cache: 'reload'`.
6. 🟢 Cada resposta é validada por `shouldCacheResponse()`.
7. 🟢 O conteúdo de cada asset é convertido em hash.
8. 🟢 A revisão final combina versão, estratégia e hashes dos assets.
9. 🟢 Cache `wpm-v34-[revision]` é criado.
10. 🟢 Assets e fallback `index.html` são gravados.
11. 🟢 Nome do cache ativo é salvo em `wpm-meta-v34`.
12. 🟢 `self.skipWaiting()` acelera ativação.
13. 🟢 No `activate`, caches antigos `wpm-*` são removidos.
14. 🟢 `navigationPreload` é habilitado quando disponível.
15. 🟢 `clients.claim()` assume páginas no escopo.
16. 🟢 Fetches futuros usam network-first ou cache-first conforme tipo.

## Fluxos Alternativos

- **CDN:** 🟢 `cdn.jsdelivr.net` é buscado na rede; falha retorna `503`.
- **`env.js`:** 🟢 sempre usa `fetch(event.request)` sem fallback cacheado.
- **Navegação offline:** 🟢 `networkFirst()` tenta cache da request e depois `DOCUMENT_FALLBACK_URL`.
- **Script/style offline:** 🟢 se já cacheado, network-first retorna cópia do cache após falha de rede.
- **Asset local não shell:** 🟢 `cacheFirst()` retorna cache primeiro e preenche cache na primeira rede bem-sucedida.
- **Protocolo `file://`:** 🟢 `pwa.js` não registra SW e apenas loga indisponibilidade.
- **Online:** 🟢 `pwa.js` tenta `reg.update()` e exibe toast de conexão restaurada.
- **Offline:** 🟢 `pwa.js` exibe toast "Modo offline - dados locais".
- **Novo controller:** 🟢 se havia controller no boot, toast é exibido e a página recarrega uma vez.

## Dependências

- `sw.js` — service worker e estratégias de cache.
- `src/core/pwa.js` — registro, update e notificações de rede.
- `index.html` — registra manifest e carrega `src/core/pwa.js`.
- `manifest.json` e `icons/` — instalabilidade PWA.
- `src/**/*.js` e `styles.css` — assets do app shell.
- `env.js` — override runtime local, explicitamente não cacheado.
- Browser APIs — `ServiceWorkerGlobalScope`, `caches`, `fetch`, `Request`, `Response`, `navigator.serviceWorker`.
- Testes — `tests/unit/service-worker-config.test.js`, `tests/e2e/service-worker.spec.js`, `tests/e2e/post-deploy-smoke.spec.js`.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Disponibilidade | App shell deve abrir offline após primeiro carregamento. | `DOCUMENT_FALLBACK_URL`, E2E SW | 🟢 |
| Atualização | Cache deve mudar quando conteúdo dos assets muda. | `hashByteArray`, `buildPrecacheBundle()` | 🟢 |
| Segurança operacional | `env.js` não pode ficar preso em cache antigo. | `isLocalEnvRequest()` | 🟢 |
| Compatibilidade | CDNs não devem ser cacheadas pelo SW. | `isCdnRequest()` | 🟢 |
| Higiene | Caches antigos `wpm-*` devem ser removidos. | `activate` cleanup | 🟢 |
| UX | Usuário deve receber sinais de update/offline/online. | `src/core/pwa.js` | 🟢 |
| Pós-deploy | Service worker deve ser validado por smoke/E2E. | `service-worker.spec.js` | 🟢 |

> Inferido do código. Validar em deploy real porque service worker depende de HTTPS, escopo e comportamento do navegador.

## Critérios de Aceitação

```gherkin
Dado um primeiro carregamento em HTTP/HTTPS
Quando o app inicializa
Então src/core/pwa.js deve registrar sw.js no escopo atual

Dado o evento install
Quando buildPrecacheBundle executa
Então cada asset de PRECACHE_ASSET_PATHS deve ser baixado com cache reload
E o cache ativo deve usar hash derivado do conteúdo

Dado o evento activate
Quando há caches antigos wpm-*
Então todos devem ser removidos exceto meta e cache ativo

Dado uma navegação offline após primeiro carregamento
Quando networkFirst falha na rede
Então deve retornar index.html do cache como fallback

Dado uma requisição para env.js
Quando o fetch passa pelo service worker
Então deve buscar da rede sem servir cache antigo

Dado uma requisição para cdn.jsdelivr.net
Quando o fetch passa pelo service worker
Então deve usar network-only

Dado uma nova versão do service worker assumindo controller
Quando controllerchange ocorre
Então pwa.js deve exibir toast e recarregar uma vez
```

## Cenários de Borda

- 🟢 **Sem suporte a service worker:** `pwa.js` retorna sem registrar.
- 🟢 **Protocolo não HTTP/HTTPS:** registro é ignorado.
- 🟢 **Cache meta ausente:** `getActiveCacheName()` usa `CACHE_NAME_FALLBACK`.
- 🟢 **Resposta de precache não OK:** install falha com erro explícito.
- 🟢 **Request não GET:** service worker não intercepta.
- 🟢 **Navegação offline sem fallback cacheado:** retorna `503`.
- 🟢 **CDN offline:** retorna `503` vazio.
- 🟢 **Mensagem `skipWaiting`:** força `self.skipWaiting()`.
- 🟡 **Asset removido de `PRECACHE_ASSET_PATHS`:** install falha se caminho ainda listado e não existir.
- 🟢 **Dependência CDN em modo offline frio:** recursos CDN podem faltar mesmo com app shell cacheado, mas offline frio não é requisito atual.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Registro do service worker | Must | Ativa PWA/cache. |
| Precache por hash de conteúdo | Must | Evita cache antigo preso. |
| Fallback offline para app shell | Must | Garante abertura offline após primeiro load. |
| `env.js` network-only | Must | Evita configuração runtime obsoleta. |
| Limpeza de caches antigos | Must | Controla armazenamento e versões. |
| CDNs network-only | Should | Evita armazenar terceiros no SW. |
| Toast online/offline/update | Should | Melhora operação do usuário. |
| Message `skipWaiting` | Could | Útil para controle futuro de atualização. |

> Prioridade inferida pelo papel do PWA em deploy estático e recuperação pós-atualização.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `sw.js` | `APP_VERSION`, `SW_CACHE_STRATEGY_VERSION`, `PRECACHE_ASSET_PATHS` | 🟢 |
| `sw.js` | `hashCacheManifest`, `hashByteArray` | 🟢 |
| `sw.js` | `isCdnRequest`, `isAppScopeRequest`, `isNavigationRequest`, `isAppShellRequest`, `isLocalEnvRequest` | 🟢 |
| `sw.js` | `readActiveCacheNameFromMeta`, `writeActiveCacheName`, `getActiveCacheName`, `openActiveCache` | 🟢 |
| `sw.js` | `fetchPrecacheEntry`, `buildPrecacheBundle`, `putInCache` | 🟢 |
| `sw.js` | `networkFirst`, `cacheFirst` | 🟢 |
| `sw.js` | `install`, `activate`, `fetch`, `message` event listeners | 🟢 |
| `src/core/pwa.js` | `initPwaRuntime`, SW registration, update, controllerchange, online/offline toasts | 🟢 |
| `index.html` | manifest link e carga de PWA runtime | 🟢 |
| `manifest.json` | contrato PWA de instalação | 🟢 |
| `tests/unit/service-worker-config.test.js` | cache meta e revisão por conteúdo | 🟢 |
| `tests/e2e/service-worker.spec.js` | registro, cache versionado e offline app shell | 🟢 |
| `_reversa_sdd/flowcharts/core-service-worker.md` | fluxo install/activate/fetch | 🟢 |
| `_reversa_sdd/adrs/004-pwa-csp-and-release-observability.md` | decisão PWA/CSP/observabilidade | 🟢 |
