# Architect — C4 Containers

Gerado em: 2026-05-02T17:46:12Z

```mermaid
flowchart TB
  subgraph Browser["Navegador"]
    shell["App Shell\nindex.html + styles.css"]
    core["Core SPA\nsrc/core + main.js"]
    domain["Domain/Features/UI\nsrc/domain + src/features + src/ui"]
    sw["Service Worker\nsw.js"]
    idb["IndexedDB\nwpm-gestao-interna-db/app_kv"]
    ls["localStorage\nchaves v34 + legadas"]
  end

  subgraph Remote["Servicos externos opcionais"]
    sbAuth["Supabase Auth"]
    sbDb["Supabase Postgres\nRLS + tabelas"]
    sbRpc["Supabase RPCs\ntransacoes/checkpoint"]
    cdn["CDNs"]
    sentry["Sentry"]
  end

  subgraph DevOps["Entrega e qualidade"]
    gh["GitHub Actions"]
    pages["GitHub Pages/Vercel"]
    tests["Vitest + Playwright"]
  end

  shell --> core
  shell --> domain
  shell --> cdn
  core --> idb
  core --> ls
  core --> sbAuth
  core --> sbDb
  core --> sbRpc
  core --> sw
  core --> sentry
  domain --> core
  sw --> shell
  gh --> tests
  gh --> pages
  pages --> shell
```

## Contratos Entre Containers

| Contrato | Formato | Dono |
|---|---|---|
| Store local | JSON `AppStore` versionado | `src/core/schema.js` |
| Periodo local | JSON `PeriodData` | `src/core/lifecycle.js` |
| Backup | JSON `app-backup`, `month-archive`, legado | `src/core/backup.js` |
| Supabase payload | JSON backup enviado para RPC | `src/core/supabase.js` |
| Checkpoint | JSON `revision`, `maxUpdatedAt`, contagens | SQL `get_unit_sync_checkpoint` |
| Cache PWA | Cache API com manifest versionado | `sw.js` |
