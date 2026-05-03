---
status: changes_requested
scope: VSCODEX1809-mobile-tables..HEAD
phase: VSCODEX1810-deploy-observability
depth: standard
files_reviewed: 17
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
validations:
  - npm test
  - node --check src/main.js src/core/config.js src/core/observability.js src/core/backup.js src/core/pwa.js
  - npm audit --audit-level=moderate
  - git diff --check VSCODEX1809-mobile-tables..HEAD
---

# Code Review - VSCODEX1810 Deploy Observability

## Resultado

Solicitar alteracoes.

O fluxo GSD formal nao conseguiu resolver uma fase porque este checkout nao tem `.planning/` e o `gsd-sdk` disponivel nao expoe `query init.phase-op`. A revisao foi executada sobre o escopo real da branch atual: `VSCODEX1809-mobile-tables..HEAD`.

## Achados

### WR-001 - Supabase CDN continua sem SRI

Severidade: P2
Local: `index.html:24`
Problema: O cliente Supabase agora esta pinado em `@2.104.0`, mas a tag de script externa ainda nao possui `integrity`.
Impacto: Como `script-src` permite `https://cdn.jsdelivr.net`, um comprometimento do CDN, pacote ou caminho servido executaria codigo com o mesmo privilegio do app. DOMPurify e Chart.js ja seguem o padrao mais seguro com SRI; o novo script critico deveria seguir o mesmo contrato.
Evidencia: `index.html:18-24` mostra SRI para DOMPurify e Chart.js, mas nao para Supabase.
Correcao sugerida: Adicionar o hash SRI correspondente ao artefato exato de `@supabase/supabase-js@2.104.0` ou servir uma copia versionada local controlada pelo projeto.

### IF-001 - `git diff --check` falha por trailing whitespace

Severidade: P4
Local: `Docs/CX_FULLSTACK_SCAN_EXECUCAO_2026-04-23.md:3`
Problema: O documento novo contem espacos finais nas linhas 3 e 4.
Impacto: Nao quebra runtime, mas deixa a branch falhando em validacao basica de diff e cria ruido em reviews futuros.
Evidencia: `git diff --check VSCODEX1809-mobile-tables..HEAD` reportou trailing whitespace nessas duas linhas.
Correcao sugerida: Remover os dois espacos finais ou substituir por quebra de paragrafo Markdown sem whitespace terminal.

### IF-002 - Auditoria npm ainda aponta `postcss@8.5.8`

Severidade: P4
Local: `package-lock.json`
Problema: `npm audit --audit-level=moderate` reporta `postcss <8.5.10` via `vitest -> vite -> postcss`.
Impacto: A vulnerabilidade e moderada e fica em dependencia de desenvolvimento, mas o gate recomendado do projeto nao esta limpo.
Evidencia: `npm ls postcss` resolve `postcss@8.5.8`; `npm audit` recomenda `npm audit fix`.
Correcao sugerida: Rodar `npm audit fix` e confirmar que o lockfile sobe `postcss` para versao corrigida sem alterar indevidamente a matriz de testes.

## Validacoes Executadas

- `npm test`: passou, 12 arquivos e 157 testes.
- `node --check src/main.js src/core/config.js src/core/observability.js src/core/backup.js src/core/pwa.js`: passou.
- `npm audit --audit-level=moderate`: falhou com 1 vulnerabilidade moderada em `postcss`.
- `git diff --check VSCODEX1809-mobile-tables..HEAD`: falhou com trailing whitespace em `Docs/CX_FULLSTACK_SCAN_EXECUCAO_2026-04-23.md`.

## Scorecard

- Seguranca: 4/5
- Correcao funcional: 5/5
- Testes e evidencias: 4/5
- Operabilidade: 4/5
- Manutenibilidade: 4/5
- Documentacao: 4/5

Total: 25/30.

## Riscos Residuais

- A suite E2E completa e o smoke deploy nao foram executados nesta revisao.
- O app depende de scripts CDN no bootstrap; qualquer mudanca em `index.html` deve manter CSP, SRI e ordem de carga sincronizados.
