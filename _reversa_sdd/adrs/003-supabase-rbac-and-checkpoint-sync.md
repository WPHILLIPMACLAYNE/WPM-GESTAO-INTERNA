# ADR 003 — Supabase com RBAC e Sync Guardada por Checkpoint

Status: Aceito retroativamente
Data inferida: commit `feat(sync): guard supabase store import by checkpoint`
Confiança: 🟢 **CONFIRMADO**.

## Contexto

O app passou a ter backend Supabase com unidades, membros, períodos e dados operacionais. Como o store local pode substituir períodos inteiros, sobrescrita remota acidental virou risco crítico.

## Decisão

Usar RBAC por unidade no banco e permitir sync completa apenas para `admin`/`gestor`. Antes de importar backup remoto, comparar checkpoint esperado com o checkpoint atual da unidade.

## Alternativas Consideradas

- Last-write-wins sem checkpoint.
- Merge entidade a entidade no cliente.
- Sync apenas manual por SQL/admin.

## Consequências

- Dispositivos locais não sobrescrevem backend divergente sem reload.
- Conflitos aparecem como estado operacional explícito.
- O checkpoint não é hash completo do conteúdo; usa timestamps e contagens como revisão pragmática.
