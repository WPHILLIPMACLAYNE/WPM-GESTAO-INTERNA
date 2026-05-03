# ADR 004 — PWA, CSP Forte e Observabilidade de Release

Status: Aceito retroativamente
Data inferida: commits de PWA, CSP e deploy observability
Confiança: 🟢 **CONFIRMADO**.

## Contexto

O projeto é publicado como app estático e precisa ser confiável em navegador, inclusive com cache, atualização e segurança compatíveis com GitHub Pages.

## Decisão

Endurecer o app shell PWA, remover scripts inline, reforçar CSP e adicionar smoke/observabilidade de release.

## Alternativas Consideradas

- App estático sem service worker.
- CSP permissiva com inline scripts.
- Deploy sem smoke automatizado.

## Consequências

- Menor superfície de XSS e regressão de cache.
- Scripts precisam ser modulares e carregados por ordem controlada.
- Releases ganham validação mínima antes/depois da publicação.
