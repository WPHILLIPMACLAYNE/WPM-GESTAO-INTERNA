# PROXIMOS_PASSOS — Roadmap pós-estabilização

Data: 2026-04-10 · Última atualização: 2026-05-03
Baseline remoto homologado: `origin/main` @ `191383e` (Vercel v34 + Supabase remoto)
Objetivo atual: sair da homologação técnica e entrar em piloto operacional controlado sem reabrir regressão.

> **Atualização 2026-04-16** — Overhaul de UI/UX (polish layer v1) entregue.
> Escopo: design system consolidado, hierarquia de z-index corrigida, microinterações,
> 15 estados vazios ricos, back-to-top global, melhorias de acessibilidade
> (`prefers-reduced-motion`, `prefers-contrast`, `:focus-visible` universal).
> Detalhes e inventário de arquivos em [`UI_UX_OVERHAUL.md`](./UI_UX_OVERHAUL.md).

> **Atualização 2026-04-18** — baseline oficial consolidado no `origin/main` (`bc6307f`).
> Qodana removido do fluxo para simplificar CI e reduzir ruído operacional.
> Fluxo seguro documentado em [`RETOMADA_SEGURA.md`](./RETOMADA_SEGURA.md).

> **Atualização 2026-04-22** — Etapas 2 e 3 concluídas na branch `VSCODEX1807`.
> PWA/service worker foi endurecido em `8c57fb4`; hardening lógico de NPS/eventos/rollback
> foi concluído em `eaa4559`. A próxima linha segura é a Etapa 4.

> **Atualização 2026-04-22 16:38** — Etapa 4 iniciada em `5eb1324`.
> `script-src` não depende mais de `'unsafe-inline'`, DOMPurify/Chart.js têm SRI,
> scripts inline foram extraídos e Playwright HTTP usa porta isolada.

> **Atualização 2026-04-22 17:36** — Etapa 4 concluída em `32311fd`.
> `style-src` também deixou de depender de `'unsafe-inline'`, o deploy ganhou
> headers HTTP no `vercel.json`, estilos dinâmicos migraram para CSSOM compatível
> com a CSP e a cobertura de segurança passou a incluir testes XSS por entidade,
> configuração de headers e validação browser-real sem violações de inline style.

> **Atualização 2026-04-22 18:30** — Etapa 6 iniciada.
> O desenho canônico de backend foi consolidado em [`BACKEND_CANONICO.md`](./BACKEND_CANONICO.md),
> usando `MAPA_ENTIDADES.md` como base para ERD lógico, papéis e transações obrigatórias.

> **Atualização 2026-04-22 19:05** — Bootstrap local do backend concluído.
> `supabase/seed.sql` agora cria um usuário admin local, a primeira unidade e o período aberto
> via `bootstrap_unit_admin(...)`; o próximo passo seguro é integrar leitura/escrita do frontend
> ao schema canônico sem remover o fallback local.

> **Atualização 2026-04-22 19:34** — Integração inicial do frontend com Supabase concluída.
> O app já carrega o SDK no browser, expõe login/logout no painel de Configurações, resolve
> sessão + `unit_members`, prefere leitura remota autenticada, mantém espelho local em
> IndexedDB/localStorage e já sincroniza o store completo via `import_backup_transaction(...)`.
> A validação real no navegador passou com `dev.admin@wpm.local`, inclusive reload remoto
> e sync imediata após o ajuste de unicidade em `addon_sales`.

> **Atualização 2026-04-22 21:05** — Etapa 7 homologada em runtime real.
> A migração assistida foi validada no navegador real com dry-run consistente, snapshot local,
> pós-migração remoto, checklist operacional e fechamento de `Abril/2026` abrindo `Maio/2026`
> limpo no backend. No fechamento do dia, a regressão do histórico de NPS também foi corrigida
> para olhar apenas meses anteriores ao período ativo.

> **Atualização 2026-04-23** — Etapa 8 fechada como sync local-first guardada.
> O envio remoto agora usa checkpoint de unidade (`get_unit_sync_checkpoint`) e a RPC
> `import_backup_transaction_guarded(...)`. Se outro dispositivo alterar o backend desde a última
> leitura/sync conhecida, o app entra em estado de conflito e exige `Recarregar do backend` antes
> de tentar novo envio, evitando sobrescrita silenciosa.

> **Atualização 2026-05-02** — Fechamento pos-Reversa iniciado.
> Os blocos locais 1 a 6 foram integrados ao app real: reabertura de mes fechado,
> preview/integridade de backup, import guard Supabase, SRI no Supabase CDN,
> catalogo RPC critico e sanitizacao central de tabelas. A migration
> `20260502183000_import_guard_preview_integrity.sql` foi validada e aplicada no
> Supabase local. Em 2026-05-02, o remoto `eautmpqkxibolmcfiacd` recebeu as
> 7 migrations com preservacao das tabelas legadas em `legacy_periods`,
> `legacy_archives` e `legacy_profiles`.
> Roteiro: [`FECHAMENTO_POS_REVERSA_2026-05-02.md`](./FECHAMENTO_POS_REVERSA_2026-05-02.md).

> **Atualização 2026-05-03** — Homologação remota funcional concluída em produção.
> O Vercel publica `env.js` com Supabase remoto, o SDK Supabase foi vendorizado para não depender de CDN,
> recovery/senha/login foram validados com `smartwonkey@gmail.com`, a unidade `Smartfit Pampulha`
> (`mgcpam2`) autenticou com perfil `admin`, o dry-run retornou `12 periodo(s) locais, backend remoto vazio,
> 0 divergencia(s)`, a migração inicial foi executada uma única vez, o reload do backend retornou
> `Base remota carregada com sucesso` e os 12 meses de janeiro a dezembro foram navegados manualmente.
> Fonte de verdade: [`HOMOLOGACAO_POS_MERGE_2026-05-03.md`](./HOMOLOGACAO_POS_MERGE_2026-05-03.md).

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

Status 2026-04-22: concluída localmente em `eaa4559`. `todayISO()` já usava data local antes desta etapa; os demais itens foram corrigidos e cobertos por unitários/workflows.

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

Status 2026-04-22: concluída localmente em `32311fd`. Entregue nesta etapa: `npm audit --audit-level=moderate` sem vulnerabilidades, SRI nos CDNs atuais, extração de scripts inline do app shell, remoção de `'unsafe-inline'` de `script-src` e `style-src`, headers de produção no `vercel.json` e testes XSS/CSP cobrindo renderização e navegador real.

Ações:

- Executar `npm audit fix` em branch dedicada.
- Adicionar SRI ou hospedar DOMPurify/Chart.js localmente.
- Mover script inline final de `index.html` para arquivo JS.
- Planejar CSP sem `'unsafe-inline'`. ✅
- Configurar headers de produção no Vercel:
  - `Content-Security-Policy` com `frame-ancestors 'none'` ✅
  - `X-Frame-Options: DENY` ✅
- Criar testes XSS para:
  - aluno; ✅
  - pendência; ✅
  - evento; ✅
  - recado; ✅
  - NPS; ✅
  - configurações. ✅

Critério de aceite:

- `npm audit --audit-level=moderate` sem alta/moderada. ✅
- Browser não acusa `frame-ancestors` ignorado por meta como única proteção. ✅
- Entradas maliciosas renderizam como texto. ✅

## Etapa 5 — Atualizar documentação estrutural

Status: **concluída em 2026-04-22**.

Prioridade: média.

Ações:

- `QWEN.md` atualizado para refletir a estrutura atual.
- `MODULE_MAP.md` alinhado ao runtime carregado por `index.html`.
- `MIGRATION_STATUS.md` promovido a snapshot corrente da baseline documental.
- `src/ui/render.js` deixou de existir no tree ativo.
- `src/types.js` documentado como artefato JSDoc não-runtime.
- Documentos históricos da Etapa 5 e auditorias antigas passaram a indicar explicitamente que não representam o runtime atual.

Critério de aceite:

- Mapa de módulos bate com `index.html`. ✅
- Nenhum arquivo legado em `src/` confunde runtime. ✅

## Etapa 6 — Desenhar backend canônico

Prioridade: alta após estabilização.

Status 2026-04-22: concluída no nível de modelagem lógica.
O desenho canônico, o ERD lógico, os papéis e as transações mínimas já estão documentados em
[`BACKEND_CANONICO.md`](./BACKEND_CANONICO.md) e sustentam o schema local de `supabase/`.

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

Status 2026-04-22: homologada em navegador real.
Leitura local/legado, contagens comparativas por entidade, dry-run guiado, migração assistida com
backup, snapshot local, bloqueio por divergência remota e validação pós-migração já passaram no
fluxo operacional real. O backend preservou o histórico necessário para fechar `Abril/2026` e abrir
`Maio/2026` zerado na base remota.

Checklist operacional: [`HOMOLOGACAO_MIGRACAO_REAL.md`](./HOMOLOGACAO_MIGRACAO_REAL.md).

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

Status 2026-04-23: concluída no nível operacional atual.
Estratégia escolhida: **local-first com checkpoint remoto guardado**. O IndexedDB/localStorage
continua sendo o primeiro commit do navegador; o Supabase é o espelho remoto canônico quando há
sessão autenticada e perfil gravável. Antes de importar o store completo no backend, o cliente
compara o checkpoint remoto conhecido com o checkpoint atual da unidade. Divergência bloqueia o
envio e mostra estado de conflito até o operador recarregar do backend.

Ações:

- Escolher online-first ou offline-first. ✅
- Se online-first:
  - backend como fonte primária;
  - IndexedDB/localStorage apenas cache;
  - conflitos tratados no servidor.
- Se offline-first:
  - fila de mutações; ✅ fila/debounce de store completo
  - IDs estáveis client-side; ✅ preservados por entidade no store atual
  - `updatedAt`/version por registro; substituído por checkpoint agregado de unidade nesta fase ✅
  - resolução de conflito explícita. ✅ recarregar backend antes de novo envio
- Definir comportamento multiaba/multidispositivo. ✅ broadcast local + conflito remoto por checkpoint

Critério de aceite:

- Sem perda silenciosa de dados. ✅
- Conflitos têm regra previsível. ✅
- UI mostra estado offline/sincronizando/erro/conflito. ✅

Limite consciente: a resolução ainda é por store completo, não por merge entidade-a-entidade. Quando
houver conflito remoto, a decisão segura é recarregar do backend, revisar a base atual e reaplicar a
edição local se necessário.

## Etapa 9 — Evoluir UI mobile onde há tabelas largas

Prioridade: média/baixa.

Status 2026-04-23: primeira passada concluída para tabelas operacionais críticas.
Alunos e Pendências agora usam layout de cards no mobile; Escala e Eventos escondem tabelas
redundantes em telas pequenas e priorizam as visões em quadro/cards já existentes. A regressão E2E
cobre ausência de scroll horizontal interno em `390px` para Alunos, Pendências, Escala e Eventos.
Segunda passada: dataset E2E com 8 atendentes e nomes longos cobre cards de atendente no Dashboard
e limita o gráfico de feedback positivo para rolagem interna controlada, sem cortar a direita.

Ações:

- Manter scroll horizontal como fallback. ✅
- Criar cards mobile para:
  - Alunos; ✅
  - Pendências; ✅
  - Escala; ✅ via quadro visual mobile sem tabela duplicada
  - Eventos. ✅ via agenda em cards mobile sem tabela duplicada
- Criar dataset visual com muitos atendentes e nomes longos. ✅
- Revalidar bugs:
  - valores sobrepostos nos cards de atendente; ✅ coberto por nova checagem responsiva básica
  - gráfico de barras cortado à direita. ✅

Critério de aceite:

- Sem overflow global em `390px` e `760px`. ✅
- Tarefas principais funcionam sem depender sempre de scroll lateral. ✅ para telas tabulares críticas

## Etapa 10 — Deploy e observabilidade

Prioridade: média.

Ações:

- [x] Expor versão/commit no app.
- [x] Criar smoke pós-deploy:
  - [x] app inicializa;
  - [x] Chart.js carrega;
  - [x] service worker registra;
  - [x] backup exporta;
  - [x] import valida payload inválido;
  - [x] mês ativo troca.
- [x] Registrar erros de inicialização e importação.
- [x] Documentar rollback seguro, incluindo cache.

Critério de aceite:

- Release validável em produção com checklist objetivo.
- Rollback não depende de tentativa manual no navegador.

## Etapa 11 — Piloto operacional controlado em produção

Prioridade: imediata.

Status 2026-05-03: próxima etapa. A migração remota estrutural está homologada, mas ainda falta provar persistência com um dado operacional real ou controlado criado após a migração.

Objetivo:

- Confirmar que o ciclo de uso real funciona em produção: criar dado -> salvar localmente -> sincronizar intencionalmente -> recarregar do backend -> reencontrar o dado vindo do Supabase.

Ações:

- Usar o app publicado em `https://wpm-gestao-interna.vercel.app`.
- Fazer login como `smartwonkey@gmail.com`.
- Confirmar `SDK Carregado`, unidade `Smartfit Pampulha`, perfil `admin` e fonte ativa `Supabase`.
- Criar **um** atendimento controlado em `Maio/2026`.
- Conferir que o atendimento aparece na UI antes de qualquer sync.
- Executar `Sincronizar agora` uma única vez e somente para esse dado conhecido.
- Executar `Recarregar do backend`.
- Confirmar que o atendimento voltou do Supabase.
- Registrar evidência em `Docs/HOMOLOGACAO_POS_MERGE_2026-05-03.md` ou documento de piloto dedicado.
- Repetir o padrão com **uma** pendência ou **um** addon somente depois do atendimento passar.

Critério de aceite:

- Dado criado no app publicado retorna após reload remoto.
- Não há divergência ou conflito remoto.
- O operador sabe quando usar `Recarregar do backend` e `Sincronizar agora`.
- Nenhum backup é importado durante o piloto.

Guardrails:

- Não clicar em `Sincronizar agora` repetidamente.
- Não usar `Importar backup` sem preview revisado e aprovação explícita.
- Não iniciar features novas até o piloto mínimo estar documentado.

## Etapa 12 — Runbook operacional pós-piloto

Prioridade: alta após a Etapa 11.

Ações:

- Documentar regras simples para equipe:
  - quando usar `Recarregar do backend`;
  - quando usar `Sincronizar agora`;
  - quando exportar backup;
  - quando importação é proibida;
  - o que fazer em conflito remoto;
  - como validar mês ativo antes de lançar dados.
- Atualizar README e docs de homologação com linguagem operacional.
- Criar checklist curto de abertura/fechamento do dia.

Critério de aceite:

- Um operador consegue usar o app sem conhecer detalhes técnicos de Supabase.
- A equipe evita ações destrutivas por padrão.
- O próximo desenvolvimento parte de um protocolo operacional claro.

## Ordem recomendada de commits

1. `fix: corrige scripts de teste e baseURL do playwright`
2. `fix: versiona cache do service worker`
3. `fix: corrige rollback CRUD e duplicidade de eventos`
4. `fix: normaliza datas locais`
5. `chore: atualiza dependencia vulneravel do vite`
6. `test: adiciona regressao de persistencia eventos datas e xss`
7. `docs: atualiza mapa modular atual`
8. `feat: prepara schema backend e migrador dry-run`
