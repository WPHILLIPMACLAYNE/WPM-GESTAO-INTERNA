# RETOMADA_SEGURA.md

Data: 2026-04-22
Última atualização: 2026-04-22 16:38:51 -03
Objetivo: continuar evolução do projeto sem risco de quebrar a versão em produção.

## Baseline oficial

- Deploy atual (GitHub Pages): `origin/main`
- Commit de referência: `bc6307f` (2026-04-17)
- Versão visual: `v34`

## Regras de proteção

1. Nunca desenvolver direto em `main`.
2. Nunca fazer `push --force` em `main`.
3. Toda mudança passa por branch de trabalho e Pull Request.
4. Antes de merge, validar testes e revisar impacto em deploy.

## Fluxo recomendado (com worktree)

```bash
# Atualizar referências
git fetch --all --prune

# Criar worktree limpa baseada no main estável
git worktree add /tmp/wpm-safe origin/main

# Criar branch de trabalho
git -C /tmp/wpm-safe checkout -b chore/minha-mudanca
```

## Checklist antes de abrir PR

```bash
# Na worktree de trabalho
npm ci
npm test
node --check src/main.js
```

Observação: se E2E não rodar localmente por dependências de sistema, registrar isso no PR e deixar a validação final no CI.

## Checklist de merge sem risco

1. Confirmar que o PR parte de `origin/main` atualizado.
2. Confirmar que não houve alteração funcional não planejada.
3. Confirmar que artefatos gerados (`test-results`, `playwright-report`) não entraram no commit.
4. Mergear somente com checks verdes.

## Recuperação rápida

Se um PR causar regressão, reverter o merge commit em nova branch e abrir PR de rollback:

```bash
git checkout -b hotfix/revert-<sha> origin/main
git revert <sha-do-merge>
git push -u origin hotfix/revert-<sha>
```

## Protocolo de continuidade

Este arquivo passa a ser a fonte de verdade para retomada de sessão quando o VS Code,
o navegador ou a conversa com o agente forem interrompidos.

## Branch de retomada VSCODEX

Padrão oficial para retomadas seguras:

- criar branch no formato `VSCODEXHHMM`
- usar horário de São Paulo no nome
- usar essa branch como trilho de recuperação quando houver risco de perder contexto ou trabalho em andamento

Branch de retomada ativa desta sessão:

- `VSCODEX1807`
- criada em `2026-04-18 18:07:46 -03`

Regra:

- se uma tarefa levar mais de 7 minutos e terminar em estado correto, ela deve ser commitada na branch `VSCODEX` ativa
- ao finalizar a tarefa, atualizar este arquivo e o núcleo vivo da `.cortex/`
- a branch ativa também deve existir no GitHub como trilho remoto oficial da sessão
- o diretório local é a frente de trabalho principal; ao fim do dia, branch local e branch remota devem ficar alinhadas por commit + push

### Regra operacional

Ao concluir cada tarefa fechada:

1. Atualizar este arquivo.
2. Atualizar o núcleo vivo da `.cortex/`:
   - `.cortex/CURRENT_STATUS.md`
   - `.cortex/AGENT_HANDOFF.md`
   - `.cortex/TASK_LEDGER.md`
   - `.cortex/RETOMADA_MASTER.md`
3. Registrar branch atual, último commit e próximo passo.
4. Carimbar a atualização com data e hora de São Paulo.
5. Fazer commit pequeno sempre que a tarefa estiver em estado consistente.
6. Se a tarefa ultrapassar 7 minutos e estiver correta ao final, commitar obrigatoriamente na branch `VSCODEX` ativa.
7. Se ainda não der para commitar, deixar aqui o checkpoint completo antes de seguir.

### O que registrar em cada checkpoint

- data e hora
- branch atual
- último commit conhecido
- tarefa concluída
- arquivos tocados
- validação executada
- pendências
- próximo passo exato
- carimbo da última atualização

### Comandos mínimos para reconstrução

Se a sessão fechar, usar estes comandos no repositório e enviar a saída:

```bash
git branch --show-current
git rev-parse --short HEAD
git status --short
git log --oneline -n 5
sed -n '1,220p' Docs/RETOMADA_SEGURA.md
sed -n '1,220p' .cortex/CURRENT_STATUS.md
sed -n '1,220p' .cortex/RETOMADA_MASTER.md
sed -n '1,240p' .cortex/TASK_LEDGER.md
```

## Checkpoint atual

Data/hora: 2026-04-22 16:38:51 -03

- Branch atual: `VSCODEX1807`
- Último commit conhecido: `5eb1324`
- Estado do worktree ao fim desta tarefa:
  - `.cortex/AGENT_HANDOFF.md` modificado
  - `.cortex/CURRENT_STATUS.md` modificado
  - `.cortex/RETOMADA_MASTER.md` modificado
  - `.cortex/TASK_LEDGER.md` modificado
  - `Docs/RETOMADA_SEGURA.md` modificado
  - `Docs/PROXIMOS_PASSOS.md` modificado
  - `README.md` modificado
  - `MODULE_MAP.md` modificado
  - `index.html` commitado em `5eb1324`
  - `sw.js` commitado em `5eb1324`
  - `playwright.config.js` commitado em `5eb1324`
  - `tests/e2e/app.spec.js` commitado em `5eb1324`
  - `src/core/env-bootstrap.js` commitado em `5eb1324`
  - `src/core/pwa.js` commitado em `5eb1324`
  - `src/ui/back-to-top.js` commitado em `5eb1324`
- Contexto recuperado e consolidado:
  - o trilho salvo no repositório é de retomada segura, baseline estável e estabilização incremental
  - o PR/planejamento de Supabase não deve ser usado como continuação desta linha
  - a `.cortex/` agora foi convertida de snapshot estático para camada viva de continuidade
  - a branch oficial de retomada desta sessão passa a ser `VSCODEX1807`
- Tarefa concluída nesta sessão:
  - início da Etapa 4 de segurança mínima antes de backend
  - remoção de scripts inline do app shell e extração para arquivos versionados
  - remoção de `'unsafe-inline'` de `script-src`
  - adição de SRI e `crossorigin="anonymous"` aos scripts CDN DOMPurify/Chart.js
  - isolamento do servidor HTTP do Playwright na porta `4173`
- Arquivos tocados nesta tarefa:
  - `index.html`
  - `sw.js`
  - `playwright.config.js`
  - `tests/e2e/app.spec.js`
  - `src/core/env-bootstrap.js`
  - `src/core/pwa.js`
  - `src/ui/back-to-top.js`
  - `README.md`
  - `MODULE_MAP.md`
  - `Docs/PROXIMOS_PASSOS.md`
  - `Docs/RETOMADA_SEGURA.md`
  - `.cortex/CURRENT_STATUS.md`
  - `.cortex/AGENT_HANDOFF.md`
  - `.cortex/RETOMADA_MASTER.md`
  - `.cortex/TASK_LEDGER.md`
- Validação executada:
  - `npm audit --audit-level=moderate` OK com `0 vulnerabilities`
  - `node --check src/core/env-bootstrap.js src/core/pwa.js src/ui/back-to-top.js sw.js` OK
  - `npm test -- --run --reporter=dot` OK com `130 passed`
  - `npx playwright test tests/e2e/service-worker.spec.js --reporter=line` OK com `2 passed`
  - `npx playwright test tests/e2e/app.spec.js --reporter=line` OK com `25 passed`
  - `npm run test:e2e` OK sem issues em desktop, tablet e mobile
- Pendências imediatas:
  - commitar este checkpoint de continuidade sobre `5eb1324`
  - fazer `push` para manter `origin/VSCODEX1807` alinhada com a branch local
  - validar update/rollback em navegador já usado quando houver preview ou release candidata
- Próximo passo exato mais seguro:
  - commitar e fazer `push` deste checkpoint
  - continuar a Etapa 4
  - tratar ou escopar `style-src 'unsafe-inline'`, configurar headers de produção e adicionar testes XSS por entidade
