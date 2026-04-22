# BUGS_CONHECIDOS — WPM Gestão Interna

Data original: 2026-04-10
Última revisão de contexto: 2026-04-22
Baseline atual em produção: `origin/main` (`bc6307f`)
Escopo: inventário histórico de bugs/riscos levantados em auditorias anteriores.

> Status dos itens pode ter mudado desde a auditoria original.
> Antes de executar qualquer correção, revalidar cada item no baseline atual.
> Referência estrutural corrente: `MODULE_MAP.md`, `QWEN.md` e `MIGRATION_STATUS.md`.

## CRÍTICO

### Service Worker pode manter assets antigos após rollback/deploy

Arquivo: `sw.js`

Evidência: `CACHE_NAME = 'wpm-v1'` é fixo, enquanto o app está em `APP_VERSION = 'v34'` e passou por rollbacks hoje.

Impacto: navegador pode continuar servindo JS/CSS antigos mesmo depois de novo deploy, gerando regressões fantasmas e divergência entre código remoto e tela do usuário.

Correção sugerida:

- Versionar cache por `APP_VERSION` + hash/commit.
- Usar `network-first` para `index.html` e considerar atualização agressiva de JS/CSS durante estabilização.
- Adicionar checklist pós-deploy para limpar/validar cache antigo.

### Rollback do CRUD pode deixar `state` inconsistente se `saveData()` falhar

Arquivo: `src/features/crud.js`

Evidência: `state = result.nextState` acontece antes de `saveData()`. O rollback manipula `currentCollection`, que pode apontar para a coleção antiga, não necessariamente para o `state` já substituído.

Impacto: falha de persistência pode deixar UI/memória divergente do armazenamento. Em alunos, o contador de addon vinculado também pode ficar incorreto.

Correção sugerida:

- Preservar snapshot completo do `state` antes da mutação.
- Aplicar troca de `state` somente depois de persistência bem-sucedida, ou restaurar `state` inteiro no rollback.
- Adicionar teste simulando falha de `saveData()`.

### Scripts E2E/visual locais apontam para caminhos errados

Arquivo: `package.json`

Evidência: `test:e2e` chama `node responsive-test.mjs` e `test:visual` chama `node visual-check.mjs`, mas os arquivos existem em `Scripts/responsive-test.mjs` e `Scripts/visual-check.mjs`.

Impacto: validações visuais/responsivas locais podem falhar com `MODULE_NOT_FOUND`, reduzindo confiança justamente após regressões de layout.

Correção sugerida:

- Atualizar scripts para `node Scripts/responsive-test.mjs` e `node Scripts/visual-check.mjs`.
- Rodar `npm run test:e2e`, `npm run test:visual` e `npm run test:all`.

### Playwright aponta para diretório absoluto antigo

Arquivo: `playwright.config.js`

Evidência: `baseURL` usa `file:///home/acewallthemac/storage/APP%20SPA%20GESTAO%20WPM/APLICATIVO%20FINALIZADO/index.html`, enquanto o projeto auditado está em `APPSPAGESTAOWPM/APLICATIVOFINALIZADO`.

Impacto: E2E pode testar outro app, outro diretório ou falhar em máquinas diferentes.

Correção sugerida:

- Calcular `baseURL` a partir do diretório do repositório atual.
- Preferir servidor local HTTP para validar service worker, CDN e rotas como em produção.

## MÉDIO

### Detector de duplicidade de eventos compara horário com ele mesmo

Arquivo: `src/features/crud.js`

Evidência: condição usa `String(entry.time || '') === String(entry.time || '')`.

Impacto: eventos com mesmo título/data e horários diferentes podem disparar falso alerta de duplicidade.

Correção sugerida: comparar `entry.time` com `entity.time`.

### CSP declara `frame-ancestors` em meta, mas navegador ignora

Arquivo: `index.html`

Evidência: Playwright registrou console error: `The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.`

Impacto: proteção contra clickjacking não está ativa por essa diretiva no HTML.

Correção sugerida:

- Configurar header HTTP no Vercel, por exemplo `Content-Security-Policy` com `frame-ancestors 'none'`.
- Adicionar `X-Frame-Options: DENY` se compatível com a estratégia de deploy.

### CSP permite inline script/style

Arquivo: `index.html`

Evidência: `script-src` e `style-src` usam `'unsafe-inline'`.

Impacto: reduz a força da CSP contra XSS.

Correção sugerida:

- Mover script inline do service worker/online-offline para arquivo JS.
- Evoluir para nonce/hash ou CSP sem inline.

### DOMPurify e Chart.js via CDN sem SRI

Arquivo: `index.html`

Evidência: scripts pinados por versão, mas sem `integrity`.

Impacto: risco de supply chain/CDN. Baixo em operação comum, maior para app que manipula dados de alunos.

Correção sugerida:

- Adicionar SRI ou hospedar dependências localmente.
- Decidir estratégia offline para Chart.js/DOMPurify caso o PWA prometa operação offline completa.

### `innerHTML` cru ainda depende de escape manual em tabelas

Arquivos: `src/ui/render-core.js` e renderizadores.

Evidência: `aplicarPatchLinhas()` usa `container.innerHTML = html` sem sanitização, assumindo templates controlados e dados escapados.

Impacto: qualquer interpolação futura sem `esc()` vira XSS.

Correção sugerida:

- Criar testes XSS por entidade.
- Reduzir uso de HTML cru ou centralizar interpolação segura.

### `todayISO()` usa `toISOString()` e pode sofrer drift UTC

Arquivo: `src/core/config.js`

Evidência: helper deriva data por `toISOString().slice(0, 10)`.

Impacto: em `America/Sao_Paulo`, perto da noite/madrugada, a data UTC pode divergir do calendário local, afetando defaults, backup e filtros.

Correção sugerida: gerar `YYYY-MM-DD` por getters locais ou helper timezone-aware.

### Vulnerabilidade alta em Vite

Comando: `npm audit --audit-level=moderate`

Resultado: 1 vulnerabilidade alta em `vite 7.0.0 - 7.3.1`.

Impacto: principal risco em dev server exposto/compartilhado. Produção estática é menos afetada, mas deve ser saneada antes de backend.

Correção sugerida: executar `npm audit fix` em commit dedicado e validar lockfile/testes.

### `rankSnapshot` inicial do seed tem formato inconsistente

Arquivo: `src/core/seed.js`

Evidência: typedef espera `rankSnapshot` como `{ [mentionId]: position }`, mas seed inicial usa `Object.fromEntries(mentions.map(item => [item.name, item.count]))`.

Impacto: tendências iniciais de NPS podem não representar posição anterior de forma coerente até novo snapshot ser capturado.

Correção sugerida: inicializar snapshot por `id -> position` ou deixar `{}` no seed.

### Mapa modular defasado

Arquivos: `MODULE_MAP.md`, `QWEN.md`

Status atual: **resolvido em 2026-04-22**.

Evidência atual: `MODULE_MAP.md` e `QWEN.md` já refletem o runtime com `render-*`, `events-*`, `env-bootstrap`, `observability`, `supabase`, `back-to-top` e `pwa`.

Impacto residual: nenhum no baseline documental corrente.

Correção aplicada: atualização dos docs estruturais e do snapshot em `MIGRATION_STATUS.md`.

## LOW

### `src/ui/render.js` é resíduo legado no diretório runtime

Arquivo: `src/ui/render.js`

Status atual: **resolvido em 2026-04-22**.

Evidência atual: o arquivo não existe mais no diretório `src/ui/`.

Impacto residual: nenhum no runtime atual.

Correção aplicada: remoção do resíduo legado do tree ativo.

### `src/types.js` não é carregado pelo app

Arquivo: `src/types.js`

Impacto: útil como JSDoc, mas não-runtime. Pode parecer esquecido.

Correção sugerida: documentar explicitamente no mapa modular ou integrar a tooling JSDoc.

### `package.json` aponta `main` para `app.js`

Arquivo: `package.json`

Status atual: **resolvido em 2026-04-22**.

Evidência atual: `package.json` não possui mais campo `main`.

Impacto residual: nenhum.

Correção aplicada: limpeza do manifesto do pacote no baseline atual.

### Cobertura Vitest mira `app.js`

Arquivo: `vitest.config.js`

Status atual: **resolvido em 2026-04-22**.

Evidência atual: `coverage.include = ['src/**/*.js']`.

Impacto residual: cobertura já mira o código modular real.

Correção aplicada: include trocado para `src/**/*.js` com exclusão de `node_modules/` e `tests/`.

### Tabelas e calendário dependem de scroll horizontal em mobile

Arquivos: `styles.css`, abas Alunos, Pendências, Escala e Eventos.

Evidência: teste headless em `390x844` e `760x900` não teve overflow global, mas tabelas internas medem entre `760px` e `1410px`.

Impacto: funcional, porém UX limitada em telas pequenas.

Correção sugerida: manter scroll como fallback, mas planejar cards mobile para tabelas críticas.

### Bug 2 e Bug 3 informados não foram reproduzidos automaticamente

Escopo: Dashboard mobile.

Evidência:

- `summaryOverlaps = 0` nos cards de atendente em `390x844` e `760x900`.
- `feedbackChart` ficou dentro de container com `overflow-x: auto`, sem overflow global.

Impacto: podem depender de dados reais específicos, nomes longos ou browser/device.

Correção sugerida: adicionar teste visual com dataset de nomes longos e muitos atendentes.

---

## RESOLVIDOS

### Conflito de z-index entre `.topbar` e `.modal`

Status: **Resolvido em 2026-04-16** (overhaul de UI/UX).

Evidência original: ambos em `z-index: 20` — dependia da ordem de montagem para qual ficava por cima.

Correção aplicada: introdução de hierarquia tokenizada no polish layer de `styles.css`:
`--z-topbar: 40; --z-modal: 90; --z-sticky: 30; --z-toast: 100`. Agora modais sempre cobrem a topbar, toasts cobrem modais, e o botão `.back-to-top` fica abaixo de modais.

Ver `UI_UX_OVERHAUL.md` seção 1.

### Estados vazios genéricos ("Nenhum item encontrado")

Status: **Resolvido em 2026-04-16** (overhaul de UI/UX).

Evidência original: 15 mensagens vazias sem contexto nem próxima ação.

Correção aplicada: todas reescritas com padrão `<strong>Título</strong>Corpo + <em>ação</em>` em `src/ui/render-*.js`. Novo CSS `.empty strong/small/em/.empty--compact` no polish layer.

Ver `UI_UX_OVERHAUL.md` seção 2.
