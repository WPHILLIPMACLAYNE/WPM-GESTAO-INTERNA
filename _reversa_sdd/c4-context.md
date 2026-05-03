# Architect — C4 Contexto

Gerado em: 2026-05-02T17:46:12Z

```mermaid
flowchart LR
  recepcao["Recepcionista"]
  gestor["Gestor/Admin"]
  professor["Professor"]
  leitura["Usuario leitura"]

  app["WPM Gestao Interna\nSPA browser-only"]

  supabase["Supabase\nAuth + Postgres + RPC"]
  cdn["CDNs\nDOMPurify, Chart.js, Supabase JS"]
  sentry["Sentry opcional"]
  github["GitHub Actions / Pages"]

  recepcao -->|"registra atendimentos, addons, pendencias"| app
  gestor -->|"fecha mes, sincroniza, audita"| app
  professor -->|"consulta escala/operacao"| app
  leitura -->|"consulta dados"| app

  app -->|"HTTPS JS assets"| cdn
  app -->|"IndexedDB/localStorage"| browserStorage["Storage do navegador"]
  app -->|"Auth, PostgREST, RPC JSON"| supabase
  app -->|"erros se configurado"| sentry
  github -->|"publica e valida release"| app
```

## Relacoes

| Origem | Destino | Relacao | Confianca |
|---|---|---|---|
| Usuario operacional | SPA | Usa UI de recepcao, dashboard, pendencias, NPS, escala e eventos. | CONFIRMADO |
| SPA | Storage navegador | Persiste store local-first. | CONFIRMADO |
| SPA | Supabase | Login, leitura remota e sync guardada. | CONFIRMADO |
| SPA | CDNs | Carrega libs runtime. | CONFIRMADO |
| SPA | Sentry | Observabilidade opcional por env. | CONFIRMADO |
| GitHub Actions/Pages | SPA | CI e publicacao estatica. | CONFIRMADO |
