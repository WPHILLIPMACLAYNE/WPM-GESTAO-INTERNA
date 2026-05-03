# Dependências Reversa — Gestão interna de academias

Gerado em: 2026-05-02T17:05:27Z

## Gerenciador de Pacotes

- Gerenciador: npm
- Arquivo de manifesto: `package.json`
- Lockfile: `package-lock.json`
- Tipo de pacote: `"type": "module"`

## Dependências de Desenvolvimento

| Pacote | Range em `package.json` | Versão resolvida | Uso identificado |
|---|---:|---:|---|
| `@playwright/test` | `^1.59.1` | `1.59.1` | testes E2E/visual/smoke |
| `@vitest/coverage-v8` | `^3.2.4` | `3.2.4` | coverage do Vitest |
| `happy-dom` | `^20.0.0` | `20.8.9` | ambiente DOM dos testes unitários |
| `jsdom` | `^26.0.0` | `26.1.0` | dependência de suporte a testes |
| `playwright` | `^1.59.1` | `1.59.1` | runner/browser automation |
| `vitest` | `^3.0.0` | `3.2.4` | testes unitários e de integração |

Dependências transitivas relevantes:

| Pacote | Versão resolvida | Origem |
|---|---:|---|
| `vite` | `7.3.2` | transitiva de `vitest` |
| `postcss` | `8.5.8` | transitiva de `vite` |

## Bibliotecas de Runtime via CDN

| Biblioteca | Local | Versão/URL | Observação |
|---|---|---|---|
| DOMPurify | `index.html` | `https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js` | possui SRI e `crossorigin` |
| Chart.js | `index.html` | `https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js` | possui SRI e `crossorigin` |
| Supabase JS | `index.html` | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.104.0` | versão pinada, SRI `sha384` e `crossorigin` |

## Ferramentas e Plataformas

- GitHub Actions: `.github/workflows/ci.yml`
- Vercel: `vercel.json`
- Supabase CLI/config: `supabase/config.toml`
- Python HTTP server: usado pelo Playwright e recomendado para servir o app localmente.

## Scripts de Projeto

| Script | Comando | Finalidade |
|---|---|---|
| `setup` | `node Scripts/setup-env.mjs` | preparar `env.js` local |
| `postinstall` | `node Scripts/setup-env.mjs` | preparar ambiente após install |
| `build:env` | `node Scripts/generate-env.mjs` | gerar `env.js` a partir de `process.env` |
| `test` | `vitest run` | unitários e integração |
| `test:coverage` | `vitest run --coverage` | coverage V8 |
| `smoke:deploy` | `playwright test tests/e2e/post-deploy-smoke.spec.js --project=chromium` | smoke pós-deploy |
| `test:e2e` | `node Scripts/responsive-test.mjs` | responsividade multi-viewport |
| `test:visual` | `node Scripts/visual-check.mjs` | checagem visual |
| `test:all` | `npm run test && npm run test:e2e` | validação combinada |

## Observações

- 🟢 **CONFIRMADO**: Não há dependências de produção em `package.json`; o runtime principal depende de scripts locais e CDNs.
- 🟢 **CONFIRMADO**: Supabase é carregado como SDK browser via CDN, não como pacote npm de runtime.
- 🟡 **INFERIDO**: A presença de `postcss@8.5.8` é relevante para auditoria de dev-deps; revisar com `npm audit` quando o objetivo for hardening.
