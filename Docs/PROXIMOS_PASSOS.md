# PROXIMOS_PASSOS — Roadmap pós-estabilização

Data: 2026-04-10 · Última atualização: 2026-04-18
Baseline estável em produção: `origin/main` @ `bc6307f` (GitHub Pages v34)
Objetivo: evoluir para backend sem reabrir regressão no deploy estável.

> **Atualização 2026-04-16** — Overhaul de UI/UX (polish layer v1) entregue.
> Escopo: design system consolidado, hierarquia de z-index corrigida, microinterações,
> 15 estados vazios ricos, back-to-top global, melhorias de acessibilidade
> (`prefers-reduced-motion`, `prefers-contrast`, `:focus-visible` universal).
> Detalhes e inventário de arquivos em [`UI_UX_OVERHAUL.md`](./UI_UX_OVERHAUL.md).

> **Atualização 2026-04-18** — baseline oficial consolidado no `origin/main` (`bc6307f`).
> Qodana removido do fluxo para simplificar CI e reduzir ruído operacional.
> Fluxo seguro documentado em [`RETOMADA_SEGURA.md`](./RETOMADA_SEGURA.md).

## Etapa 0 — Proteger baseline

Prioridade: imediata.

Ações:

- Trabalhar sempre em branch de feature criada a partir de `origin/main`.
- Usar worktree limpa para evitar contaminar o diretório principal com artefatos de teste.
- Proibir qualquer alteração direta em `main`.
- Garantir que `.gitignore` continue cobrindo `test-results/` e `playwright-report/`.

Critério de aceite:

- `main` permanece estável e sem commits experimentais.
- Toda mudança relevante entra por PR.
- Artefatos gerados localmente não são versionados.

## Etapa 1 — Corrigir infraestrutura de validação

Prioridade: crítica.

Ações:

- Corrigir `package.json`:
  - `test:e2e`: `node Scripts/responsive-test.mjs`
  - `test:visual`: `node Scripts/visual-check.mjs`
- Corrigir `playwright.config.js` para não depender de caminho absoluto antigo.
- Preferir servidor local HTTP nos testes E2E para validar service worker/CDN de forma realista.
- Corrigir `vitest.config.js` para cobertura de `src/**/*.js`.
- Rodar:
  - `npm test`
  - `npm run test:e2e`
  - `npm run test:visual`
  - `npm run test:all`

Critério de aceite:

- Scripts rodam no diretório atual.
- Playwright abre o app correto.
- Cobertura mede código real.

## Etapa 2 — Desarmar risco de cache/service worker

Prioridade: crítica.

Ações:

- Versionar `CACHE_NAME` com `APP_VERSION` e/ou hash de commit.
- Considerar `network-first` para `index.html`, JS e CSS.
- Manter cache-first apenas para ícones/assets estáveis.
- Adicionar mensagem de update para clientes abertos.
- Validar deploy/rollback em navegador já usado, não só sessão limpa.

Critério de aceite:

- Após deploy, browser carrega assets novos.
- Após rollback, browser não mantém JS/CSS antigo.
- `PRECACHE_ASSETS` bate com `index.html`.

## Etapa 3 — Corrigir bugs lógicos antes do backend

Prioridade: alta.

Ações:

- Corrigir rollback de `createCrudHandler()` em falha de persistência.
- Corrigir duplicidade de eventos comparando `entry.time` com `entity.time`.
- Normalizar `rankSnapshot` do seed para `id -> position` ou `{}`.
- Trocar `todayISO()` para helper de data local.
- Adicionar testes:
  - falha simulada de `saveData()`;
  - evento mesmo título/data e horário diferente;
  - seed NPS com snapshot coerente;
  - data local em `America/Sao_Paulo`.

Critério de aceite:

- Falha de persistência não altera `state` nem contadores.
- Duplicidade de eventos não gera falso positivo.
- Datas seguem calendário local.

## Etapa 4 — Segurança mínima para backend

Prioridade: alta.

Ações:

- Executar `npm audit fix` em branch dedicada.
- Adicionar SRI ou hospedar DOMPurify/Chart.js localmente.
- Mover script inline final de `index.html` para arquivo JS.
- Planejar CSP sem `'unsafe-inline'`.
- Configurar headers de produção no Vercel:
  - `Content-Security-Policy` com `frame-ancestors 'none'`
  - opcional `X-Frame-Options: DENY`
- Criar testes XSS para:
  - aluno;
  - pendência;
  - evento;
  - recado;
  - NPS;
  - configurações.

Critério de aceite:

- `npm audit --audit-level=moderate` sem alta/moderada.
- Browser não acusa `frame-ancestors` ignorado por meta como única proteção.
- Entradas maliciosas renderizam como texto.

## Etapa 5 — Atualizar documentação estrutural

Prioridade: média.

Ações:

- Atualizar `QWEN.md` para refletir a estrutura atual.
- Atualizar `MODULE_MAP.md` com `render-*`, `events-*`, `backup.js` e `lifecycle.js`.
- Decidir destino de `MODULE_STATUS.md`: criar ou remover da rotina.
- Remover/mover `src/ui/render.js` se for legado.
- Documentar `src/types.js` como JSDoc não-runtime.

Critério de aceite:

- Mapa de módulos bate com `index.html`.
- Nenhum arquivo legado em `src/` confunde runtime.

## Etapa 6 — Desenhar backend canônico

Prioridade: alta após estabilização.

Ações:

- Usar `Docs/MAPA_ENTIDADES.md` como base do ERD.
- Definir tabelas mínimas:
  - `units`
  - `users`
  - `unit_members`
  - `periods`
  - `period_settings`
  - `student_attendances`
  - `addon_types`
  - `addon_sales`
  - `pending_items`
  - `shift_notes`
  - `nps_period_metrics`
  - `nps_mentions`
  - `scale_days`
  - `scale_professor_shifts`
  - `events`
  - `audit_events`
- Definir papéis:
  - admin;
  - gestor;
  - recepção;
  - professor;
  - leitura.
- Definir transações para:
  - importação de backup;
  - fechamento de mês;
  - reset de mês;
  - renomeação de membro;
  - atendimento com addon vinculado.

Critério de aceite:

- ERD aprovado.
- Regras de autorização documentadas.
- Campos de auditoria definidos.

## Etapa 7 — Criar migrador localStorage/IndexedDB

Prioridade: alta quando backend estiver pronto.

Ações:

- Ler IndexedDB primeiro e localStorage como fallback.
- Consolidar `wpm_recados_${YYYY-MM}` antes do envio.
- Validar `STORE_VERSION`.
- Executar dry-run com contagens por entidade.
- Expandir addons de matriz para linhas.
- Preservar snapshots de nomes.
- Fazer import transacional no backend.
- Gerar backup JSON antes da primeira migração real.

Critério de aceite:

- Dry-run mostra contagens coerentes com Dashboard.
- Import pode ser revertido.
- Migração não perde histórico de meses fechados.

## Etapa 8 — Definir estratégia de sincronização

Prioridade: média.

Ações:

- Escolher online-first ou offline-first.
- Se online-first:
  - backend como fonte primária;
  - IndexedDB/localStorage apenas cache;
  - conflitos tratados no servidor.
- Se offline-first:
  - fila de mutações;
  - IDs estáveis client-side;
  - `updatedAt`/version por registro;
  - resolução de conflito explícita.
- Definir comportamento multiaba/multidispositivo.

Critério de aceite:

- Sem perda silenciosa de dados.
- Conflitos têm regra previsível.
- UI mostra estado offline/sincronizando/erro.

## Etapa 9 — Evoluir UI mobile onde há tabelas largas

Prioridade: média/baixa.

Ações:

- Manter scroll horizontal como fallback.
- Criar cards mobile para:
  - Alunos;
  - Pendências;
  - Escala;
  - Eventos.
- Criar dataset visual com muitos atendentes e nomes longos.
- Revalidar bugs:
  - valores sobrepostos nos cards de atendente;
  - gráfico de barras cortado à direita.

Critério de aceite:

- Sem overflow global em `390px` e `760px`.
- Tarefas principais funcionam sem depender sempre de scroll lateral.

## Etapa 10 — Deploy e observabilidade

Prioridade: média.

Ações:

- Expor versão/commit no app.
- Criar smoke pós-deploy:
  - app inicializa;
  - Chart.js carrega;
  - service worker registra;
  - backup exporta;
  - import valida payload inválido;
  - mês ativo troca.
- Registrar erros de inicialização e importação.
- Documentar rollback seguro, incluindo cache.

Critério de aceite:

- Release validável em produção com checklist objetivo.
- Rollback não depende de tentativa manual no navegador.

## Ordem recomendada de commits

1. `fix: corrige scripts de teste e baseURL do playwright`
2. `fix: versiona cache do service worker`
3. `fix: corrige rollback CRUD e duplicidade de eventos`
4. `fix: normaliza datas locais`
5. `chore: atualiza dependencia vulneravel do vite`
6. `test: adiciona regressao de persistencia eventos datas e xss`
7. `docs: atualiza mapa modular atual`
8. `feat: prepara schema backend e migrador dry-run`
