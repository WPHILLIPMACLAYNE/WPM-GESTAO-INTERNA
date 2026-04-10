# BUGS_CONHECIDOS — WPM Gestão Interna

Data: 2026-04-10
Base auditada: commit `f6f08ea`
Escopo: bugs e riscos encontrados durante auditoria somente leitura.

## CRÍTICO

### Service Worker pode manter assets antigos após rollback/deploy

Arquivo: `sw.js`
Linhas relevantes: `CACHE_NAME = 'wpm-v1'`, precache e estratégia cache-first.

Impacto: alto. Como o cache não muda junto com `APP_VERSION`/commit, navegadores podem continuar servindo JS/CSS antigos mesmo após rollback. Isso é especialmente crítico no contexto pós-regressão relatado.

Correção sugerida: versionar `CACHE_NAME` por release/commit, limpar caches antigos agressivamente em rollback e considerar network-first para HTML/JS durante fase instável.

### Scripts E2E e visual quebrados

Arquivo: `package.json`
Linhas relevantes: `test:e2e` e `test:visual`.

Sintoma:

- `npm run test:e2e` falha com `Cannot find module .../responsive-test.mjs`.
- `npm run test:visual` falha com `Cannot find module .../visual-check.mjs`.

Causa: os scripts apontam para arquivos na raiz, mas os arquivos existem em `Scripts/responsive-test.mjs` e `Scripts/visual-check.mjs`.

Impacto: alto. Pipeline local/CI dá falso negativo operacional e impede validação pós-deploy.

### Playwright usa caminho absoluto antigo

Arquivo: `playwright.config.js`
Linha relevante: `baseURL`.

Valor atual aponta para `APP SPA GESTAO WPM/APLICATIVO FINALIZADO`, não para o diretório atual `APPSPAGESTAOWPM/APLICATIVOFINALIZADO`.

Impacto: alto. A suíte pode abrir arquivo errado ou falhar em outra máquina. A listagem de testes funciona, mas a execução fica não confiável.

### Rollback incompleto no CRUD em falha de persistência

Arquivo: `src/features/crud.js`
Linhas relevantes: `state = result.nextState` antes de `saveData()` e rollback que altera `currentCollection`.

Impacto: alto. Se `saveData()` falhar, o rollback mexe na coleção antiga, mas `state` já aponta para `result.nextState`. Em alunos, o hook de addon também pode deixar contador divergente.

Correção sugerida: preservar snapshot anterior de `state`, só trocar `state` após persistência bem sucedida, ou restaurar `state` inteiro em falha.

## MÉDIO

### Checagem de duplicidade de eventos compara horário com ele mesmo

Arquivo: `src/features/crud.js`
Linha relevante: `String(entry.time || '') === String(entry.time || '')`.

Impacto: médio. A checagem sempre considera o horário igual, então eventos com mesmo título/data e horários diferentes podem disparar falso alerta de duplicidade.

Correção sugerida: comparar `entry.time` com `entity.time`.

### Datas baseadas em `toISOString()` podem deslocar dia no Brasil

Arquivo: `src/core/config.js`
Funções relevantes: `todayISO()` e derivadas.

Impacto: médio. `toISOString()` usa UTC. Em `America/Sao_Paulo`, horários noturnos podem gerar dia diferente do calendário local, afetando período, backup, filtros e defaults de formulários.

Correção sugerida: gerar `YYYY-MM-DD` com getters locais (`getFullYear`, `getMonth`, `getDate`) ou helper timezone-aware.

### Vulnerabilidade alta em Vite

Comando: `npx npm@latest audit --audit-level=moderate`

Resultado: 1 vulnerabilidade alta em `vite 7.0.0 - 7.3.1`, com advisory de path traversal/arbitrary file read em dev server.

Impacto: médio em produção estática, alto em ambiente de desenvolvimento compartilhado ou exposto.

Correção sugerida: rodar `npm audit fix` e commitar `package-lock.json`.

### CSP ainda permite inline script/style

Arquivo: `index.html`
Linha relevante: meta CSP.

Impacto: médio. A CSP ajuda, mas `'unsafe-inline'` reduz a proteção contra XSS.

Correção sugerida: remover scripts inline, mover handlers para arquivos JS, usar nonce/hash ou CSP mais restritiva.

### Sinks `innerHTML` dependem de escape manual

Arquivos: `src/core/config.js`, `src/ui/render-core.js`, renderizadores de UI.

Impacto: médio. A maior parte dos dados é escapada, mas a arquitetura depende da disciplina de cada template. Com backend/multiusuário, qualquer interpolação esquecida vira XSS.

Correção sugerida: centralizar render seguro, evitar sinks genéricos crus e adicionar testes de XSS por entidade.

### `MODULE_STATUS.md` ausente e `MODULE_MAP.md` desatualizado

Impacto: médio. A documentação não reflete a divisão atual de render/events, aumentando risco de manutenção errada.

Correção sugerida: atualizar documentação estrutural após estabilização.

## BAIXO

### `src/ui/render.js` permanece no repositório sem ser carregado

Impacto: baixo a médio. Pode confundir manutenção e auditorias. Se for legado, mover para `Legacy/` ou remover em commit dedicado.

### `src/types.js` não é carregado no runtime

Impacto: baixo. Pode ser mantido como documentação JSDoc, mas deveria estar claramente marcado como não-runtime.

### `package.json` aponta `main` para `app.js`

Impacto: baixo. O app é browser-only e não usa `main`, mas o campo está obsoleto e confunde tooling.

### Cobertura Vitest aponta para `app.js`

Arquivo: `vitest.config.js`
Linha relevante: `coverage.include = ['app.js']`.

Impacto: baixo. Testes passam, mas relatório de cobertura não cobre `src/**/*.js`.

### Tabelas/grades largas em mobile

Arquivos: `styles.css`

Impacto: baixo a médio. A solução atual depende de scroll horizontal em telas pequenas. Funciona, mas gera UX ruim e pode cortar visualmente gráficos/tabelas.

### CDN sem SRI

Arquivo: `index.html`

Impacto: baixo a médio. DOMPurify e Chart.js são pinados por versão, mas sem integridade Subresource Integrity.

