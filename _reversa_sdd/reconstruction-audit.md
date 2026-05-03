# Auditoria Pos-Reversa — Reconstrucao vs App Real

**Gerado em:** 2026-05-02
**Escopo:** comparar `_reversa_sdd/`, `src/reconstruction/*`, testes reconstruidos e o runtime real em `src/core`, `src/features`, `src/ui`, `src/domain` e `supabase`.
**Estado do plano:** `18 tarefas | 18 concluidas | 0 pendentes` em `_reversa_sdd/reconstruction-plan.md`.
**Resultado:** INTEGRACAO POS-REVERSA LOCAL CONCLUIDA em 2026-05-02. Blocos 1, 2-local, 3-local, 4, 5 e 6 concluidos; resta aplicar/validar migration no Supabase alvo antes de tratar o backend remoto como homologado.

---

## Sumario Executivo

A reconstrucao Reversa esta completa como **contrato executavel**: foram criados modulos isolados em `src/reconstruction/` e suites unitarias cobrindo schema, dominio, storage, lifecycle, Supabase, UI, API e fluxos de usuario.

O app real, porem, ainda nao incorporou todos os hardenings descobertos/confirmados durante a reconstrucao. O proximo trabalho deve ser uma fase de **Hardening e Integracao Pos-Reversa**, migrando para producao apenas os pontos validados como lacunas reais.

---

## Evidencias de Cobertura

- Plano Reversa fechado: 18/18 tarefas concluidas.
- Artefatos reconstruidos criados em `src/reconstruction/`.
- Testes reconstruidos adicionados em `tests/unit/reconstruction-*.test.js`.
- Ultima validacao completa do Bloco 3: `npx vitest run --testTimeout=20000` passou com **25 arquivos** e **255 testes**.
- `confidence-report.md` registra confianca geral de **97.32%**, com lacunas ja respondidas em `questions.md`.

---

## Achados Prioritarios

### P1 — Reabertura de mes fechado existe no contrato reconstruido, mas nao no app real

**Status:** integrado no app real em 2026-05-02.
**Evidencia no Reversa:** `questions.md` confirma que o sistema deve permitir reabrir mes fechado. `monthly-lifecycle.md` marca a ausencia como lacuna.
**Evidencia na reconstrucao:** `src/reconstruction/monthly-lifecycle.js` implementa `reopenPeriod()` com autorizacao, motivo e auditoria.
**Evidencia no app real:** `src/core/lifecycle.js` agora expoe `reopenPeriod()` com autorizacao, motivo, `reopenAudit`, rollback em falha de persistencia e botao real `reopenMonthBtn` para reabertura do mes selecionado.

**Risco:** mes fechado por engano nao tem recuperacao operacional pela UI real.
**Proximo passo:** manter o fluxo local coberto e, quando o backend for priorizado, espelhar a auditoria/guardas no Supabase.

---

### P1 — Importacao destrutiva com preview granular e integridade no app real/backend

**Status:** integrado no fluxo local em 2026-05-02; backend/adapter Supabase alinhados em 2026-05-02.
**Evidencia no Reversa:** `questions.md` confirma que backup completo precisa preview granular antes de apagar/substituir e tambem validacao de integridade/autenticidade.
**Evidencia na reconstrucao:** `src/reconstruction/backup-import.js` implementa `buildImportPreview()`, `validateImportGuards()` e hash de integridade; `src/reconstruction/supabase-database-rpcs.js` exige preview aceito e integridade em importacao guardada.
**Evidencia no app real:** `src/core/backup.js` agora gera backups com envelope de integridade, calcula preview granular por periodo, bloqueia backup completo destrutivo sem aceite explicito e rejeita hash adulterado. O fluxo de arquivo e snapshot exibem o impacto antes de aplicar. `src/core/supabase.js` envia payload remoto com envelope de integridade e `p_preview_accepted: true`; `supabase/migrations/20260502183000_import_guard_preview_integrity.sql` valida aceite de preview, origem confiavel e hash antes da importacao guardada.

**Risco residual:** o bloqueio backend depende da migration estar aplicada no ambiente Supabase alvo.
**Proximo passo:** aplicar a migration no ambiente Supabase e validar em homologacao com importacao/sync real.

---

### P2 — Supabase CDN com SRI

**Status:** integrado em 2026-05-02.
**Evidencia:** `index.html` agora carrega `@supabase/supabase-js@2.104.0` com `integrity="sha384-DBZI/1Gz1C29oeP5N6ORumbrmMNoaze4Afb4/c3JkFv79Wh3n1DIzbLRVbu6sJQT"` e `crossorigin="anonymous"`. O hash foi calculado a partir do asset CDN pinado.

**Risco residual:** quando a versao do pacote mudar, o hash SRI tambem deve ser recalculado antes do deploy.
**Proximo passo:** manter teste de seguranca exigindo `sha384` e seguir para contrato RPC compartilhado.

---

### P2 — Contrato de API reconstruido conectado parcialmente ao adapter real

**Status:** integrado incrementalmente em 2026-05-02.
**Evidencia na reconstrucao:** `src/reconstruction/supabase-rpc-api.js` centraliza catalogo das 7 RPCs, validacao de parametros, respostas e erros PostgREST.
**Evidencia no app real:** `src/core/supabase.js` agora possui catalogo minimo de RPCs criticas (`getUnitSyncCheckpoint` e `importBackupTransactionGuarded`), valida parametros, expoe `getSupabaseRpcOperation()`, `validateSupabaseRpcParams()` e `callSupabaseRpc()` em `APP_INTERNALS`, e o fluxo real chama RPC por `operationId` em vez de string PostgREST espalhada.

**Risco residual:** o catalogo real cobre apenas as RPCs usadas pelo adapter browser atual; as demais RPCs permanecem no contrato reconstruido ate serem consumidas por producao.
**Proximo passo:** seguir para UI patch/sanitizacao e diagnostics, mantendo a expansao do catalogo quando novas RPCs entrarem no adapter real.

---

### P3 — Patching de linhas com sanitizacao central

**Status:** integrado em 2026-05-02.
**Evidencia:** `src/ui/render-core.js` agora sanitiza HTML de linhas em `aplicarPatchLinhas()` antes de aplicar no `tbody`, remove midia ativa desnecessaria para tabelas e expoe o helper em `APP_INTERNALS.rendering` para teste/diagnostico. O contrato reconstruido em `src/reconstruction/ui-render-events.js` acompanha a mesma regra.

**Risco residual:** renderizadores ainda devem continuar usando `esc()` para preservar texto literal e evitar markup inesperado; a sanitizacao central atua como defesa adicional.
**Proximo passo:** manter testes XSS obrigatorios e evitar novas tabelas com `innerHTML` fora dos helpers.

---

### P3 — Diagnosticos e dry-run ainda misturam dominio, HTML e orquestracao

**Status:** divida de manutenibilidade.
**Evidencia:** `sdd/features-business-actions.md` marca `diagnostics.js` como acoplado. `src/features/diagnostics.js` manipula relatorios, HTML e dry-run/migracao em um mesmo modulo.

**Risco:** alteracoes no painel de diagnostico podem afetar regras de migracao e vice-versa.
**Proximo passo:** nao bloquear MVP; extrair somente quando tocar no fluxo de migracao assistida ou quando abrir fase de refatoracao.

---

## Matriz de Integracao Recomendada

| Ordem | Bloco | Motivo | Saida esperada |
|---:|---|---|---|
| 1 | Reabertura de mes fechado | Requisito confirmado e ausencia operacional real | CONCLUIDO: `src/core/lifecycle.js`, UI topbar, schema/backup e teste real |
| 2 | Preview/integridade de importacao | Maior risco de perda de dados | CONCLUIDO local: preview, hash, guardas e testes |
| 3 | Supabase import guard alinhado | Evita divergencia local/remoto | CONCLUIDO local: migration/RPC, adapter, OpenAPI/testes |
| 4 | SRI do Supabase CDN | Hardening pequeno e objetivo | CONCLUIDO: `index.html` + testes de config/app-shell |
| 5 | Contrato RPC compartilhado | Reduz divergencia futura | CONCLUIDO incremental: catalogo/validacao real para RPCs criticas |
| 6 | UI patch/sanitizacao e diagnostics | Manutenibilidade e defesa futura | CONCLUIDO incremental: sanitizacao central de linhas; diagnostics fica como divida nao bloqueante |

---

## Decisao Recomendada

Nao substituir o app real por `src/reconstruction/*`. Esses modulos devem servir como fonte de verdade e suite de contrato.

Encerramento local da fase:

**Fase: Integracao Pos-Reversa — concluida localmente**

Riscos residuais:
1. Aplicar e validar `supabase/migrations/20260502183000_import_guard_preview_integrity.sql` no Supabase alvo.
2. Recalcular SRI quando `@supabase/supabase-js` for atualizado.
3. Manter `diagnostics.js` como divida de manutenibilidade ate a proxima fase de refatoracao.

---

## Proximo Comando Operacional

Proximo comando operacional recomendado:

> Rodar validacao final, revisar diff da fase e preparar commit/PR ou aplicacao da migration no ambiente Supabase alvo.
