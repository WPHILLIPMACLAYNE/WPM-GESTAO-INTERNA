# AUDIT_MATRIX

| Area | Current status | Evidence basis | Confidence | Notes |
|---|---|---|---|---|
| Runtime entry | Stable and present | `index.html`, `src/main.js` | High | 30-script classic runtime |
| Script order contract | Live risk | `index.html`, `MODULE_MAP.md` | High | order-sensitive globals |
| Global config/state | Stable but central | `src/core/config.js` | High | defines storage keys, version, runtime mode, globals |
| Persistence layer | Mature but high-blast-radius | `src/core/storage.js`, `src/core/backup.js` | High | IndexedDB + localStorage mirror |
| Schema/versioning | Present and active | `src/core/schema.js`, `src/core/config.js` | High | store version `4` |
| Monthly lifecycle | Present and business-critical | `src/core/lifecycle.js` | High | period switching, close/reset/archive |
| CRUD flows | Present, previously audited | `src/features/crud.js`, older bug docs | High | one prior logic bug already fixed |
| Dashboard rendering | Functional hotspot | `src/ui/render-dashboard.js`, `styles.css`, git log | High | recent mobile fixes landed |
| UI event delegation | Central infrastructure | `src/ui/events-core.js`, split docs | High | one entry point fans out to domains |
| Test definitions | Present in repo | `tests/`, `package.json`, configs | High | 12 top-level test files observed |
| Test execution in this workspace | Blocked by missing deps | command output during bootstrap | High | environmental blocker, not code verdict |
| Service worker | Active and improved | `sw.js`, old audit docs | High | cache still not tied to app version |
| Security posture | Partial hardening | `index.html`, audit docs | Medium | CSP exists but still permissive |
| Documentation consistency | Mixed | root docs + `Docs/` + live code | High | multiple narratives across time |
| Backend readiness | Not started in runtime | `Docs/MAPA_ENTIDADES.md`, `Docs/PROXIMOS_PASSOS.md` | Medium | planned, not active |

## Summary reading

- Operationally usable: yes
- Structurally decoupled: no
- Test assets present: yes
- Test execution currently available in workspace: no
- Safe to start with functional rewrites: no
- Safe to start with baseline validation and doc normalization: yes
