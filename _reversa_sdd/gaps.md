# Lacunas de Revisao — Gestao interna de academias

> Gerado pelo Revisor em 2026-05-02T18:54:12Z

## Criticas

| Lacuna | Specs afetadas | Pergunta |
|--------|----------------|----------|
| Reabertura de mes fechado foi confirmada como necessaria, mas nao existe na UI atual. | `monthly-lifecycle.md`, `fluxo-fechamento-mensal.md` | Pergunta 2 respondida |
| Backups/imports devem combinar confirmacao manual e integridade/autenticidade, mas assinatura/hash nao existem. | `backup-import.md` | Pergunta 4 respondida |
| Importacao de backup completo deve ter preview granular antes de substituir/remover periodos; UI atual ainda nao implementa. | `backup-import.md`, `supabase-database-rpcs.md` | Pergunta 7 respondida |

## Moderadas

| Lacuna | Specs afetadas | Pergunta |
|--------|----------------|----------|
| `APP_DEFAULTS` confirmado como seed/demo; reimplementacao nao deve tratar como dados reais de producao. | `config-global-state.md` | Pergunta 1 respondida |
| Offline frio nao e requisito atual; requisito confirmado e app offline apos primeiro carregamento online. | `service-worker-pwa.md`, `app-shell.md` | Pergunta 5 respondida |
| `STORE_VERSION = 4` confirmado como bump/marco sem transformacao incompatível esperada. | `schema-migrations.md` | Pergunta 6 respondida |
| Leitura individual de recados confirmada como local/visual; backend por usuario nao e requisito agora. | `domain.md`, `ui-render-events.md`, `supabase-database-rpcs.md` | Pergunta 8 respondida |
| Retry/backoff de IndexedDB nao existe apos falha de gravacao. | `storage-adapter.md` | - |
| Checkpoint Supabase usa timestamps/contagens, nao hash completo de conteudo; conflito deve ser resolvido recarregando do backend. | `supabase-adapter.md`, `supabase-database-rpcs.md` | Pergunta 3 respondida |

## Cosmeticas / Arquiteturais

| Lacuna | Specs afetadas | Observacao |
|--------|----------------|------------|
| Nao ha contrato formal separado de todos os IDs DOM publicos. | `app-shell.md` | O contrato esta distribuido entre `index.html` e modulos UI. |
| `diagnostics.js` mistura dominio, renderizacao e orquestracao. | `features-business-actions.md` | Risco de manutencao, nao bloqueia reimplementacao. |
| CRUD e selectors dependem de globais runtime/browser. | `features-business-actions.md`, `domain-selectors.md` | Arquitetura confirmada, reduz testabilidade pura. |
| `render-dashboard.js` contem migracao de recados legados. | `ui-render-events.md` | Acoplamento de renderizacao e persistencia. |
| `aplicarPatchLinhas()` usa `innerHTML` por contrato local. | `ui-render-events.md` | Exige disciplina de escape nos renderizadores. |
| `src/core/observability.js` nao possui SDD dedicado. | `code-spec-matrix.md` | Coberto por contratos agregados. |

## Reclassificacoes Aplicadas

| De | Para | Item | Evidencia |
|----|------|------|-----------|
| 🟡 | 🟢 | Exclusao de atendimento compensa addon e faz rollback. | `src/ui/render-students.js` chama `applyStudentAddonLink(existing, -1)` e desfaz com `+1` se `saveData()` falhar. |
