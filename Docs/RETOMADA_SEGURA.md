# RETOMADA_SEGURA.md

Data: 2026-04-18
Última atualização: 2026-04-18 18:08:50 -03
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

Data/hora: 2026-04-18 18:08:50 -03

- Branch atual: `VSCODEX1807`
- Último commit conhecido: `0496003`
- Estado do worktree ao fim desta tarefa:
  - `.cortex/AGENT_HANDOFF.md` modificado
  - `.cortex/CURRENT_STATUS.md` modificado
  - `.cortex/IMPROVEMENT_BACKLOG.md` modificado
  - `.cortex/LEARNING_LEDGER.md` modificado
  - `.cortex/QUICK_REFERENCE.md` modificado
  - `.cortex/RETOMADA_MASTER.md` novo
  - `.cortex/TASK_LEDGER.md` novo
  - `.cortex/UPDATE_PROTOCOL.md` novo
  - `Docs/RETOMADA_SEGURA.md` modificado
- Contexto recuperado e consolidado:
  - o trilho salvo no repositório é de retomada segura, baseline estável e estabilização incremental
  - o PR/planejamento de Supabase não deve ser usado como continuação desta linha
  - a `.cortex/` agora foi convertida de snapshot estático para camada viva de continuidade
  - a branch oficial de retomada desta sessão passa a ser `VSCODEX1807`
- Tarefa concluída nesta sessão:
  - formalização do protocolo de continuidade no repositório
  - lapidação da `.cortex/` com protocolo, log de tarefas e handoff vivo
  - criação do trilho de retomada `VSCODEX1807` e da política de commit por tarefa longa
- Arquivos tocados nesta tarefa:
  - `Docs/RETOMADA_SEGURA.md`
  - `.cortex/CURRENT_STATUS.md`
  - `.cortex/AGENT_HANDOFF.md`
  - `.cortex/QUICK_REFERENCE.md`
  - `.cortex/IMPROVEMENT_BACKLOG.md`
  - `.cortex/LEARNING_LEDGER.md`
  - `.cortex/RETOMADA_MASTER.md`
  - `.cortex/UPDATE_PROTOCOL.md`
  - `.cortex/TASK_LEDGER.md`
- Validação executada:
  - leitura completa da pasta `.cortex/`
  - identificação de redundância operacional e defasagem de snapshot
  - sincronização do protocolo entre `Docs/RETOMADA_SEGURA.md` e `.cortex/`
  - criação bem-sucedida da branch `VSCODEX1807`
- Pendências imediatas:
  - aplicar a regra de commit por tarefa > 7 minutos na branch `VSCODEX1807`
  - manter carimbo de data/hora de SP em toda atualização de contexto
- Próximo passo exato mais seguro:
  - validar a baseline executável (`node --check src/main.js`, `npm test`, `npx playwright test --reporter=line`)
  - registrar aqui, em `.cortex/CURRENT_STATUS.md`, `.cortex/RETOMADA_MASTER.md` e `.cortex/TASK_LEDGER.md` o resultado real antes de qualquer mudança funcional
