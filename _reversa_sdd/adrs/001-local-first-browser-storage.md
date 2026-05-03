# ADR 001 — Persistência Local-First no Navegador

Status: Aceito retroativamente
Data inferida: histórico até 2026-05-02
Confiança: 🟢 **CONFIRMADO** para a implementação; 🟡 **INFERIDO** para motivação.

## Contexto

O sistema é uma SPA browser-only sem backend obrigatório no runtime inicial. A operação de recepção precisa continuar mesmo sem Supabase configurado, sem SDK disponível, sem sessão ou com falha remota.

## Decisão

Persistir o store em IndexedDB como backend local primário, com fallback para localStorage, cache em memória e broadcast cross-tab.

## Alternativas Consideradas

- Usar apenas localStorage: simples, mas mais frágil para volume e quota.
- Exigir Supabase online: centraliza dados, mas quebra operação offline/local.
- Usar backend próprio: maior controle, mas aumenta infraestrutura.

## Consequências

- O app segue operável em GitHub Pages/local.
- Migrações e backups precisam normalizar stores legados.
- Conflitos entre local e remoto precisam ser tratados explicitamente.
