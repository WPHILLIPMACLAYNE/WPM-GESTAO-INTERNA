# WPM Gestão Interna — Contexto para Agentes de IA

> **Leia este arquivo COMPLETO antes de fazer qualquer coisa no projeto.**

---

## Quem sou eu

Projeto: WPM Gestão Interna  
Autor: Wallace Phillip Maclayne Alves Alencar  
Unidade: Smart Fit Pampulha, Belo Horizonte, MG  
Repositório: https://github.com/WPHILLIPMACLAYNE/WPM-GESTAO-INTERNA  
Deploy: https://wpm-gestao-interna.vercel.app  
Domínio futuro: wpmgestao.me  

---

## Stack

- **Frontend:** HTML/CSS/JS browser-only (SPA modular, ~30 arquivos em src/)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Deploy:** Vercel (CI/CD automático via GitHub Actions)
- **Email:** Mailgun
- **Monitoramento:** Sentry
- **Secrets:** Doppler
- **Testes dispositivos reais:** BrowserStack (2000+ browsers, Student Pack)
- **Cobertura de testes:** Codecov (integrado ao CI, Student Pack)
- **Testes unitários:** Vitest (118/118)
- **Testes E2E:** Playwright (142/142)
- **CI:** 9/9 checks verdes

---

## Ponto de restauração

```bash
git checkout v1.0-stable
```

Tag criada em 10/04/2026. CI 100% verde. Se tudo quebrar, volte aqui.

---

## Roles do sistema

| Role | Acesso |
|------|--------|
| Admin Geral (Wallace) | Total — todas as unidades |
| Regional | Superusuário — unidades do seu estado |
| Gerente | Superusuário — apenas sua unidade |
| Recepcionista / Professor | Operacional — apenas sua unidade |

## Ações que exigem superusuário

- Editar NPS
- Editar Escala
- Configurações
- Resetar mês
- Fechar mês
- Importar backup
- Aprovar novos usuários

---

## Fases do backend

| Fase | Status | Branch | Descrição |
|------|--------|--------|-----------|
| 0 — Infraestrutura | ⏳ | `backend/fase-0-infra` | Domínio, Mailgun, Sentry, Doppler |
| 1 — Schema BD | ⏳ | `backend/fase-1-schema` | Tabelas Supabase com RLS |
| 2 — Autenticação | ⏳ | `backend/fase-2-auth` | Login, registro, roles, sessão |
| 3 — Migração | ⏳ | `backend/fase-3-migracao` | localStorage → Supabase |
| 4 — Integração | ⏳ | `backend/fase-4-integracao` | Frontend conectado ao backend |
| 5 — Novas abas | ⏳ | `backend/fase-5-novas-abas` | DEA, Registros Internos, Mural Personal |
| 6 — Painel Admin | ⏳ | `backend/fase-6-admin` | Interface de gestão de unidades |

> **Atualize esta tabela ao concluir cada fase. Mude ⏳ para ✅.**
> Estado real em 17/04/2026: a entrega tecnica da Fase 0 ja foi mergeada no `main`
> (runtime env, scaffold de Supabase/Sentry e CI). A ativacao manual dos servicos
> externos continua controlada em `Docs/FASE_0_CHECKLIST.md`.

---

## Estratégia de branches

Cada fase tem sua própria branch. O trabalho nunca vai direto para o `main`.

**Fluxo obrigatório:**
```
main (sempre estável)
  └── backend/fase-X-nome (trabalho da fase)
        └── merge para main apenas com CI verde
```

**Criar branch de uma nova fase:**
```bash
git checkout main
git pull
git checkout -b backend/fase-X-nome
git push origin backend/fase-X-nome
```

**Comandos por fase:**
```bash
# Fase 0
git checkout -b backend/fase-0-infra && git push origin backend/fase-0-infra

# Fase 1
git checkout -b backend/fase-1-schema && git push origin backend/fase-1-schema

# Fase 2
git checkout -b backend/fase-2-auth && git push origin backend/fase-2-auth

# Fase 3
git checkout -b backend/fase-3-migracao && git push origin backend/fase-3-migracao

# Fase 4
git checkout -b backend/fase-4-integracao && git push origin backend/fase-4-integracao

# Fase 5
git checkout -b backend/fase-5-novas-abas && git push origin backend/fase-5-novas-abas

# Fase 6
git checkout -b backend/fase-6-admin && git push origin backend/fase-6-admin
```

**Merge ao concluir cada fase (apenas com CI verde):**
```bash
git checkout main
git pull
git merge backend/fase-X-nome --no-ff -m "feat: fase X concluída — [descrição]"
git push
# Aguardar CI verde antes de criar a próxima branch
```

---

## Regras de ouro — NUNCA viole

1. **Nunca faça push sem CI verde**
2. **Nunca force push no main sem autorização explícita do Wallace**
3. **Nunca commite chaves, tokens ou senhas**
4. **Nunca altere lógica de negócio ao corrigir bug de layout**
5. **Commits pequenos — uma funcionalidade por commit**
6. **Se o CI quebrar, pare tudo e use o Prompt de Emergência CI**
7. **Antes de qualquer push: node --check + vitest run + playwright test**

---

## Checklist pré-push

```bash
# 1. Sintaxe
node --check src/main.js

# 2. Testes unitários
npx vitest run

# 3. Testes E2E
npx playwright test --reporter=line

# 4. Verificar se não há secrets no código
grep -r "eyJ\|sk_\|pk_\|password" src/

# 5. Verificar .env não está no commit
git status
```

---

## Arquivos críticos

| Arquivo | Função |
|---------|--------|
| src/main.js | Bootstrap, expõe window.__APP_INTERNALS__ |
| src/core/config.js | Constantes e estado global |
| src/core/storage.js | IndexedDB + localStorage |
| src/core/lifecycle.js | Mês ativo, fechamento, reset |
| src/core/supabase.js | Wrapper do client Supabase (fallback null) |
| src/core/observability.js | Bootstrap condicional do Sentry |
| src/domain/selectors.js | KPIs e derivados |
| src/ui/render-dashboard.js | Dashboard + gráficos Chart.js |
| index.html | Entry point — ordem dos scripts é crítica |
| env.example.js | Template do contrato runtime (browser-safe) |
| env.js | Valores reais (gitignored, gerado via Doppler/Vercel) |
| styles.css | CSS global + media queries |
| sw.js | Service Worker — cache versionado |
| .github/workflows/ci.yml | Pipeline CI/CD |
| Docs/AUDITORIA_COMPLETA.md | Auditoria técnica completa |
| Docs/MAPA_ENTIDADES.md | Estrutura de dados para o backend |

## Contrato de ambiente runtime (Fase 0)

O app lê configuração de `window.__APP_ENV__`, populado nesta ordem:

1. Inline `<script>` em `index.html` define defaults seguros (todos `null`).
2. `<script src="env.js">` opcional sobrescreve com valores reais.
3. Falha silenciosa se `env.js` não existir (gitignored).

**Setup local:**
```bash
npm run setup        # copia env.example.js → env.js (idempotente)
# edite env.js manualmente OU:
doppler run -- node Scripts/generate-env.mjs
```

**Build em CI/Vercel:**
```bash
node Scripts/generate-env.mjs   # lê process.env e gera env.js
```

**Chaves browser-safe atualmente suportadas:**

| Chave | Origem | Quando aparece |
|-------|--------|----------------|
| `SUPABASE_URL` | Supabase project | Fase 1 |
| `SUPABASE_ANON_KEY` | Supabase project | Fase 1 |
| `SENTRY_DSN` | Sentry project | Fase 0 (depois de criar) |
| `SENTRY_ENVIRONMENT` | App config | Fase 0 |
| `SENTRY_RELEASE` | CI commit SHA | Fase 0 |

**Diagnóstico:**
```js
window.__APP_INTERNALS__.backend.getSupabaseStatus()
window.__APP_INTERNALS__.observability.getObservabilityStatus()
```

---

## Protocolo de emergência

### CI quebrou
```bash
node --check src/**/*.js
npx vitest run
npx playwright test --reporter=line
# Identifique o erro, corrija apenas ele, teste novamente
```

### App quebrou em produção
```
Vercel → Deployments → último deploy que funcionava → Promote to Production
```

### Rollback completo
```bash
cd ~/storage/APPSPAGESTAOWPM/APLICATIVOFINALIZADO
sudo rm -rf test-results
git checkout v1.0-stable
git push origin HEAD:main --force
```

---

## Documentação disponível em Docs/

- `AUDITORIA_COMPLETA.md` — auditoria técnica do projeto
- `BUGS_CONHECIDOS.md` — bugs priorizados
- `MAPA_ENTIDADES.md` — estrutura de dados
- `PROXIMOS_PASSOS.md` — roadmap
- `DIAGNOSTICO_MOBILE.md` — bugs mobile diagnosticados

## Serviços do Student Pack em uso

| Serviço | Função | URL |
|---------|--------|-----|
| Supabase | Banco + Auth + Realtime | supabase.com |
| Vercel | Deploy + CI/CD | vercel.com |
| Mailgun | Email transacional | mailgun.com |
| Sentry | Monitoramento de erros | sentry.io |
| Doppler | Secrets/env vars | doppler.com |
| Namecheap | Domínio wpmgestao.me | namecheap.com |
| BrowserStack | Testes em dispositivos reais | browserstack.com |
| Codecov | Cobertura de testes no CI | codecov.io |

---

*Última atualização: 10/04/2026*
