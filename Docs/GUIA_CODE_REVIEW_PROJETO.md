# Guia de Code Review do Projeto

## Objetivo

Este guia adapta dois modelos de review mais gerais para o contexto do **WPM Gestao Interna**: um review deve ser **baseado em risco**, mas terminar com uma **decisao objetiva**. Aqui, seguranca e correcao ficam acima de estilo.

Saidas validas ao final do review:

- `Aprovado`
- `Aprovado com ressalvas`
- `Solicitar alteracoes`
- `Bloquear merge/release`

## Escopo e criticidade

O projeto e um SPA browser-only com persistencia local (`IndexedDB` + `localStorage`), `Service Worker`, import/export de backup e testes com `Vitest` e `Playwright`.

Criticidade recomendada para revisao:

- `N2` para ajustes visuais, docs e testes isolados.
- `N3` para mudancas em persistencia, backup, lifecycle de periodo, `sw.js`, `index.html`, contrato de `env.js` e seguranca de renderizacao.

## Ordem de prioridade

### P1 - Bloqueadores

- vazamento de segredos, dados sensiveis ou runtime config indevida;
- XSS, HTML inseguro, uso de `innerHTML` sem escape/sanitizacao adequada;
- quebra de persistencia, import/export, fechamento de mes ou troca de periodo;
- alteracao insegura na ordem de scripts de `index.html`;
- mudanca de `Service Worker` com risco de cache quebrado ou update preso;
- regressao que corrompe dados ou impede bootstrap.

### P2 - Rejeitar ate corrigir

- logica incorreta em KPI, filtros, CRUD, NPS, escala, eventos ou pendencias;
- falha de compatibilidade entre estado real e renderizacao;
- teste ausente em fluxo alterado relevante;
- quebra de contrato em `window.__APP_ENV__` ou `window.__APP_INTERNALS__`.

### P3 - Solicitar melhoria

- duplicacao evitavel;
- acoplamento desnecessario entre `core`, `features` e `ui`;
- nomes ruins, JSDoc inconsistente, legibilidade baixa;
- cobertura insuficiente em mudanca nao critica.

### P4 - Sugerir

- refinamento de estilo;
- reorganizacao menor de markup/CSS;
- docs auxiliares e comentarios opcionais.

## Checklist obrigatorio por tipo de mudanca

### Toda mudanca

- revisar o `diff` e o impacto lateral;
- validar se a mudanca respeita a ordem de carga documentada em `MODULE_MAP.md`;
- executar `npm test`;
- executar `npm audit --audit-level=moderate`;
- registrar evidencias, nao opinioes vagas.

### Mudanca em bootstrap, runtime ou persistencia

- executar `node --check src/main.js`;
- revisar `index.html`, `sw.js`, `src/core/storage.js`, `src/core/lifecycle.js`, `src/core/backup.js`;
- confirmar fallback seguro sem `env.js`;
- confirmar que import/export e troca de periodo continuam coerentes.

### Mudanca visual ou de fluxo no navegador

- executar `npm run test:e2e`;
- se houver snapshot/UI sensivel, executar `npx playwright test tests/e2e/visual.spec.js tests/e2e/visual-states.spec.js --reporter=line`;
- verificar responsividade, overflow horizontal e estados vazios.

## Regras especificas deste repositorio

### Seguranca de renderizacao

- `innerHTML` so e aceitavel quando o markup for totalmente controlado pelo app ou passar por sanitizacao/escape consistente.
- Qualquer novo ponto de HTML dinamico deve ser revisado junto com `src/utils/helpers.js` e `src/ui/render-core.js`.
- Mudancas na CSP em `index.html` sao tratadas como `P1`.

### Persistencia e dados

- `IndexedDB` e a persistencia principal; `localStorage` e espelho/compatibilidade. Nao introduza leitura/gravacao paralela sem entender a fila serializada.
- Alteracoes em schema, migracao, backup e restore exigem evidencias de teste.
- Nunca misture refino visual com alteracao de lifecycle de dados no mesmo review sem justificativa forte.

### Service Worker e entrega

- `sw.js` precisa manter estrategia clara de versionamento de cache.
- Toda mudanca em precache deve considerar `env.js` opcional no runtime local e ausencia dele em deploy remoto.
- Se houver risco de cache antigo preso, o review deve pedir estrategia de invalidacao explicita.

### Testes e snapshots

- Teste novo deve ficar no nivel correto: `tests/unit`, `tests/integration` ou `tests/e2e`.
- Snapshot so deve ser atualizado junto com justificativa da mudanca visual.
- Para testes visuais, prefira estado deterministico de tempo/dados quando o layout depende de data atual.

### Continuidade operacional

- Se a mudanca tocar fluxo de retomada, docs operacionais ou `.cortex/`, o review deve verificar consistencia entre arquivos, nao apenas sintaxe.
- Documentacao incompleta e defeito quando a mudanca altera contrato operacional do projeto.

## Scorecard rapido

Avalie cada eixo de `0` a `5`:

- `Seguranca`
- `Correcao funcional`
- `Testes e evidencias`
- `Operabilidade`:
  cache, bootstrap, rollback, diagnostico
- `Manutenibilidade`
- `Documentacao`

Interpretacao sugerida:

- `24-30`: pronto para aprovar, se nao houver bloqueador.
- `18-23`: aprovar com ressalvas ou pedir ajustes pequenos.
- `12-17`: solicitar alteracoes.
- `0-11`: bloquear ate reavaliar.

## Template de achado

Use este formato no review:

```text
Severidade: P1 | P2 | P3 | P4
Local: arquivo:linha
Problema: descricao objetiva do defeito
Impacto: risco funcional, de seguranca ou operacional
Evidencia: fato observado ou inferencia marcada como tal
Correcao sugerida: ajuste minimo necessario
```

## Template de conclusao

```text
Escopo: PR | worktree | baseline
Criticidade: N2 | N3
Resultado: Aprovado | Aprovado com ressalvas | Solicitar alteracoes | Bloquear merge/release
Scorecard: Seguranca X, Correcao X, Testes X, Operabilidade X, Manutenibilidade X, Documentacao X
Validacoes executadas: [lista real]
Riscos residuais: [lista curta]
```

## Adaptacao dos dois guias para este projeto

Do guia mais analitico, este documento herda:

- calibracao por risco e criticidade;
- foco em evidencia antes de opiniao;
- revisao contextual para frontend browser-only.

Do guia mais operacional, este documento herda:

- matriz P1/P2/P3/P4;
- scorecard final;
- decisao explicita de aprovacao ou bloqueio;
- exigencia de localizacao, impacto e fix em cada achado.

O que ficou de fora de forma intencional:

- gates pesados de compliance/regulatorio que nao combinam com a realidade atual do projeto;
- checklists genericos de backend que nao se aplicam ao runtime principal;
- obrigatoriedade de ferramentas nao instaladas no repositorio quando a mesma evidencia pode ser obtida com testes, leitura de diff e auditoria local.
