# RETOMADA_SEGURA.md

Data: 2026-04-22
Última atualização: 2026-04-22 16:08:54 -03
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

Data/hora: 2026-04-22 16:08:54 -03

- Branch atual: `VSCODEX1807`
- Último commit conhecido: `8c57fb4`
- Estado do worktree ao fim desta tarefa:
  - `.cortex/AGENT_HANDOFF.md` modificado
  - `.cortex/CURRENT_STATUS.md` modificado
  - `.cortex/RETOMADA_MASTER.md` modificado
  - `.cortex/TASK_LEDGER.md` modificado
  - `Docs/RETOMADA_SEGURA.md` modificado
  - `AGENTS.md` commitado em `694e8ed`
  - `Docs/GUIA_CODE_REVIEW_PROJETO.md` commitado em `694e8ed`
  - `sw.js` commitado em `8c57fb4`
  - `index.html` commitado em `8c57fb4`
  - `manifest.json` commitado em `8c57fb4`
  - `tests/e2e/service-worker.spec.js` commitado em `8c57fb4`
  - `tests/e2e/visual-states.spec.js` commitado em `d847a27`
  - `tests/e2e/visual.spec.js` commitado em `d847a27`
  - `tests/helpers/fixed-browser-clock.js` commitado em `d847a27`
- Contexto recuperado e consolidado:
  - o trilho salvo no repositório é de retomada segura, baseline estável e estabilização incremental
  - o PR/planejamento de Supabase não deve ser usado como continuação desta linha
  - a `.cortex/` agora foi convertida de snapshot estático para camada viva de continuidade
  - a branch oficial de retomada desta sessão passa a ser `VSCODEX1807`
- Tarefa concluída nesta sessão:
  - estabilização dos snapshots visuais com congelamento determinístico do relógio do browser
  - criação de um guia de code review específico do projeto e ligação dele ao fluxo de contribuição
  - hardening do service worker para escopo seguro em root/subpath, fetch `network-first` do app shell e recarga orientada a update
  - adição de teste Playwright dedicado para registro do service worker e shell offline
- Arquivos tocados nesta tarefa:
  - `tests/e2e/visual-states.spec.js`
  - `tests/e2e/visual.spec.js`
  - `tests/helpers/fixed-browser-clock.js`
  - `Docs/GUIA_CODE_REVIEW_PROJETO.md`
  - `AGENTS.md`
  - `sw.js`
  - `index.html`
  - `manifest.json`
  - `tests/e2e/service-worker.spec.js`
  - `Docs/RETOMADA_SEGURA.md`
  - `.cortex/CURRENT_STATUS.md`
  - `.cortex/AGENT_HANDOFF.md`
  - `.cortex/RETOMADA_MASTER.md`
  - `.cortex/TASK_LEDGER.md`
- Validação executada:
  - `node --check sw.js` OK
  - `npm test` OK com `129 passed`
  - `npx playwright test tests/e2e/service-worker.spec.js --reporter=line` OK com `2 passed`
  - `npm run test:e2e` OK sem issues em desktop, tablet e mobile
  - `npx playwright test tests/e2e/app.spec.js --reporter=line` OK com `23 passed`
- Pendências imediatas:
  - commitar este checkpoint de continuidade
  - fazer `push` para manter `origin/VSCODEX1807` alinhada com a branch local
  - validar update/rollback em navegador já usado quando houver preview ou release candidata
- Próximo passo exato mais seguro:
  - fazer `push` deste checkpoint
  - iniciar a Etapa 3
  - revisar `rankSnapshot`, comparação de duplicidade de eventos e rollback em falha de persistência
