# Relatorio de Confianca — Gestao interna de academias

> Atualizado pelo Revisor em 2026-05-02T19:05:35Z apos validacao humana das 8 perguntas.

---

## Resumo Geral

| Nivel | Quantidade | Percentual |
|-------|-----------:|-----------:|
| 🟢 CONFIRMADO | 1973 | 96.15% |
| 🟡 INFERIDO | 48 | 2.34% |
| 🔴 LACUNA | 31 | 1.51% |
| **Total** | 2052 | 100% |

**Confianca geral:** 97.32% (soma de 🟢 + metade dos 🟡).

---

## Por Spec

| Spec | 🟢 | 🟡 | 🔴 | Confianca |
|------|---:|---:|---:|----------:|
| `sdd/app-shell.md` | 66 | 5 | 1 | 95.14% |
| `sdd/backup-import.md` | 116 | 1 | 4 | 96.28% |
| `sdd/config-global-state.md` | 73 | 1 | 1 | 98.00% |
| `sdd/domain-selectors.md` | 115 | 2 | 2 | 97.48% |
| `sdd/env-bootstrap.md` | 55 | 2 | 2 | 94.92% |
| `sdd/features-business-actions.md` | 144 | 1 | 3 | 97.64% |
| `sdd/monthly-lifecycle.md` | 128 | 1 | 3 | 97.35% |
| `sdd/schema-migrations.md` | 102 | 3 | 1 | 97.64% |
| `sdd/service-worker-pwa.md` | 121 | 1 | 0 | 99.59% |
| `sdd/storage-adapter.md` | 98 | 1 | 2 | 97.52% |
| `sdd/supabase-adapter.md` | 142 | 1 | 2 | 98.28% |
| `sdd/supabase-database-rpcs.md` | 154 | 1 | 3 | 97.79% |
| `sdd/ui-render-events.md` | 142 | 3 | 3 | 96.96% |
| `user-stories/fluxo-atendimento-addons.md` | 91 | 1 | 0 | 99.46% |
| `user-stories/fluxo-fechamento-mensal.md` | 102 | 1 | 3 | 96.70% |
| `user-stories/fluxo-pendencias-nps-escala-eventos.md` | 136 | 1 | 0 | 99.64% |
| `user-stories/fluxo-sincronizacao-supabase.md` | 123 | 1 | 1 | 98.80% |
| `traceability/code-spec-matrix.md` | 65 | 21 | 0 | 87.79% |
| `openapi/supabase-rpcs.yaml` | 0 | 0 | 0 | N/A |
| `traceability/spec-impact-matrix.md` | 0 | 0 | 0 | N/A |

---

## Lacunas Pendentes 🔴

As lacunas foram consolidadas por tema em [`gaps.md`](gaps.md). As 8 perguntas de validacao humana foram respondidas em [`questions.md`](questions.md).

### Principais temas

- Fechamento mensal: reabertura de mes fechado foi confirmada como requisito, mas nao existe na UI atual.
- Backup/import: validacao de integridade/autenticidade foi confirmada como desejavel junto da confirmacao manual, mas ainda nao existe hash/assinatura.
- Backup/import: preview granular antes de substituir/remover dados foi confirmado como requisito, mas ainda nao existe na UI atual.
- Sync Supabase: conflito remoto deve ser resolvido recarregando do backend antes de sincronizar; merge manual nao e requisito agora.
- PWA/offline: requisito atual e funcionar offline depois do primeiro carregamento online; offline frio nao e requisito atual.
- Configuracao: `APP_DEFAULTS` foi confirmado como seed/demo, nao como dados reais de producao.
- Store V4: bump foi confirmado como marco/normalizacao sem mudanca incompatível.

---

## Recomendacoes

- [x] Responder as 8 perguntas de [`questions.md`](questions.md).
- [ ] Criar fluxo/contrato de implementacao para reabrir mes fechado (`reopenPeriod` ou equivalente).
- [ ] Adicionar preview granular antes de importacao completa substituir/remover dados.
- [ ] Adicionar validacao de integridade/autenticidade em backups, mantendo a confirmacao manual.
- [ ] Manter conflito Supabase como "recarregar do backend antes de sincronizar"; nao planejar merge manual nesta fase.
- [ ] Manter PWA leve: garantir abertura offline apos primeiro carregamento online; offline frio fica fora do escopo atual.

---

## Historico de Reclassificacoes

| De | Para | Afirmação | Evidencia |
|----|------|-----------|-----------|
| 🟡 | 🟢 | Exclusao de atendimento remove o aluno, decrementa addon e reverte ambos em falha de persistencia. | `src/ui/render-students.js` usa `applyStudentAddonLink(existing, -1)`, restaura `state.students` e aplica `+1` se `saveData()` falhar. |

---

## Revisao Cruzada

Nao aplicavel nesta sessao: nao havia ferramenta `codex:*` disponivel para delegacao automatica.
