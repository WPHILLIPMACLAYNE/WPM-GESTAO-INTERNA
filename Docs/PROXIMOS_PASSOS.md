# PROXIMOS_PASSOS — Roadmap Técnico

Data: 2026-04-10
Base auditada: commit `f6f08ea`

## Objetivo

Estabilizar o estado pós-rollback, recuperar confiabilidade de testes/deploy e preparar a evolução para backend sem introduzir nova regressão em produção.

## Etapa 0 — Congelar baseline

Prioridade: imediata.

Ações:

- Manter `f6f08ea` como baseline funcional até correções críticas serem aplicadas em branch separada.
- Registrar esta auditoria como referência de estado.
- Evitar mudanças simultâneas em Service Worker, módulos e backend.

Critério de aceite:

- Documentos desta auditoria versionados.
- Nenhuma alteração de código misturada no commit de auditoria.

## Etapa 1 — Corrigir infraestrutura de testes

Prioridade: crítica.

Ações:

- Corrigir `package.json` para apontar `test:e2e` para `Scripts/responsive-test.mjs`.
- Corrigir `package.json` para apontar `test:visual` para `Scripts/visual-check.mjs`.
- Corrigir `playwright.config.js` para calcular `baseURL` relativo ao repositório atual.
- Corrigir `vitest.config.js` para cobertura de `src/**/*.js`, não `app.js`.
- Rodar `npm test`, `npm run test:e2e`, `npm run test:visual`, `npm run test:all`.

Critério de aceite:

- Scripts executam sem `MODULE_NOT_FOUND`.
- Playwright abre o `index.html` correto em qualquer máquina.
- Relatório de cobertura aponta para código real.

## Etapa 2 — Desarmar risco de Service Worker

Prioridade: crítica.

Ações:

- Versionar `CACHE_NAME` com `APP_VERSION` ou hash do commit.
- Considerar network-first para `index.html`, JS e CSS durante a fase de estabilização.
- Garantir limpeza de caches antigos no activate.
- Adicionar mecanismo de atualização controlada para clientes já abertos.
- Validar produção com DevTools: cache antigo removido, assets novos carregados.

Critério de aceite:

- Após novo deploy/rollback, navegador não mantém bundle antigo.
- `sw.js` não referencia assets inexistentes.
- Deploy em Vercel raiz funciona e cenário local/file não quebra silenciosamente.

## Etapa 3 — Corrigir bugs lógicos prioritários

Prioridade: crítica/média.

Ações:

- Corrigir rollback do CRUD para restaurar `state` inteiro quando `saveData()` falhar.
- Corrigir duplicidade de eventos para comparar `entry.time` com `entity.time`.
- Trocar `todayISO()`/datas locais para helper sem UTC drift.
- Adicionar testes unitários para falha de persistência no CRUD.
- Adicionar teste para evento com mesmo título/data e horário diferente.
- Adicionar teste para data local em timezone `America/Sao_Paulo`.

Critério de aceite:

- Falha simulada de persistência não altera estado nem contadores de addon.
- Evento de mesmo título/data em horário diferente não dispara duplicidade.
- Datas de formulário/backup seguem calendário local.

## Etapa 4 — Segurança antes de backend

Prioridade: alta.

Ações:

- Rodar `npm audit fix` e commitar lockfile atualizado.
- Reduzir sinks genéricos de `innerHTML`.
- Criar helper único para renderização segura de templates.
- Remover ou restringir `style` da allowlist do DOMPurify se não for necessário.
- Planejar CSP sem `'unsafe-inline'`.
- Adicionar SRI ou estratégia local para DOMPurify e Chart.js.
- Adicionar testes XSS por entidade: aluno, pendência, evento, recado, NPS e configurações.

Critério de aceite:

- `npm audit --audit-level=moderate` sem vulnerabilidades.
- Testes XSS confirmam que inputs aparecem como texto, não executam HTML/JS.
- CSP futura documentada e compatível com scripts externos.

## Etapa 5 — Limpeza estrutural controlada

Prioridade: média.

Ações:

- Atualizar `MODULE_MAP.md` para a estrutura atual.
- Criar ou remover referência a `MODULE_STATUS.md`.
- Decidir destino de `src/ui/render.js`: remover, mover para `Legacy/` ou reincorporar explicitamente.
- Marcar `src/types.js` como documentação não-runtime ou integrá-lo ao tooling JSDoc.
- Atualizar `QWEN.md` para refletir a divisão real de render/events.

Critério de aceite:

- Mapa de módulos bate com `index.html`.
- Não há arquivo legado em `src/` confundindo runtime.

## Etapa 6 — Modelagem de backend

Prioridade: alta após estabilização.

Ações:

- Definir entidades canônicas com base em `Docs/MAPA_ENTIDADES.md`.
- Adicionar `unit_id`, `created_by`, `updated_by`, `created_at`, `updated_at` e auditoria onde necessário.
- Definir papéis: admin, gestor, recepção, leitura.
- Modelar transações para fechamento/reset/importação.
- Definir migração de addons de matriz por dia para tabela normalizada.
- Definir estratégia de recados: `read` global ou leitura por usuário.

Critério de aceite:

- ERD aprovado.
- Regras de autorização documentadas.
- Plano de migração de localStorage/IndexedDB documentado.

## Etapa 7 — Migração localStorage → banco

Prioridade: alta quando backend estiver pronto.

Ações:

- Criar exportador/migrador que leia IndexedDB primeiro e localStorage como fallback.
- Consolidar recados legados `wpm_recados_${YYYY-MM}` antes da importação.
- Validar schema local com versão antes de enviar.
- Executar dry-run mostrando contagens por entidade.
- Criar import transacional no backend.
- Preservar backup JSON antes da primeira migração.

Critério de aceite:

- Dry-run mostra contagens coerentes com dashboard.
- Import pode ser revertido.
- Dados migrados mantêm histórico por período.

## Etapa 8 — Estratégia de sincronização

Prioridade: média.

Ações:

- Decidir se o app continuará offline-first ou passará para online-first.
- Se offline-first: criar fila de mutações, controle de versão por registro e resolução de conflito.
- Se online-first: remover dependência de localStorage como fonte primária e usar cache apenas para UI/offline limitado.
- Definir política para múltiplas abas.

Critério de aceite:

- Fluxo de concorrência documentado.
- Não há perda silenciosa de dados em duas abas/dispositivos.

## Etapa 9 — Deploy e observabilidade

Prioridade: média.

Ações:

- Adicionar checklist de release.
- Adicionar smoke test pós-deploy.
- Registrar versão/commit visível no app.
- Monitorar erros de inicialização, Service Worker e importação.
- Documentar rollback seguro, incluindo limpeza de cache.

Critério de aceite:

- Release pode ser validado em produção com passos objetivos.
- Rollback não depende de limpeza manual incerta no navegador.

## Ordem recomendada de commits futuros

1. `fix: corrige scripts e configuracao de testes`
2. `fix: versiona cache do service worker`
3. `fix: corrige rollback CRUD e duplicidade de eventos`
4. `fix: normaliza datas locais sem UTC drift`
5. `chore: atualiza dependencias vulneraveis`
6. `test: cobre regressao de CRUD datas eventos e XSS`
7. `docs: atualiza mapa estrutural dos modulos`
8. `feat: prepara schema de backend`

