# Perguntas para Validacao — Gestao interna de academias

> Gerado pelo Revisor em 2026-05-02T18:54:12Z
> Responda cada pergunta no chat ou preencha o campo **Resposta** e me avise quando terminar.

---

## Pergunta 1

✅ Respondida

**Contexto:** `src/core/config.js` define `APP_DEFAULTS` com nomes, tipos de addon, eventos, respostas e textos usados por seed/bootstrap.
**Spec afetada:** [`_reversa_sdd/sdd/config-global-state.md`](sdd/config-global-state.md)
**Pergunta:** Os valores em `APP_DEFAULTS` sao configuracao real de producao da academia ou apenas massa seed/demo para iniciar o app?
**Impacto:** Se forem producao, a spec deve tratar esses valores como regra/configuracao padrao confirmada. Se forem demo, devem continuar marcados como inferidos e evitados em reimplementacao real.

**Resposta:** Demo/seed, nao configuracao real de producao.

---

## Pergunta 2

✅ Respondida

**Contexto:** `closePeriod()` fecha meses via `storage.archives`, mas nao ha acao UI para reabrir/desarquivar.
**Spec afetada:** [`_reversa_sdd/sdd/monthly-lifecycle.md`](sdd/monthly-lifecycle.md), [`_reversa_sdd/user-stories/fluxo-fechamento-mensal.md`](user-stories/fluxo-fechamento-mensal.md)
**Pergunta:** O sistema deve permitir reabrir um mes fechado em algum perfil/admin, ou o fechamento mensal deve ser irreversivel pela interface?
**Impacto:** Se houver reabertura, falta uma spec/fluxo. Se for irreversivel, a lacuna vira regra de negocio confirmada.

**Resposta:** Deve permitir reabrir mes fechado.

---

## Pergunta 3

✅ Respondida

**Contexto:** Sync Supabase bloqueia conflitos por checkpoint, mas nao implementa merge automatico entre stores divergentes.
**Spec afetada:** [`_reversa_sdd/sdd/supabase-adapter.md`](sdd/supabase-adapter.md), [`_reversa_sdd/user-stories/fluxo-sincronizacao-supabase.md`](user-stories/fluxo-sincronizacao-supabase.md)
**Pergunta:** Em conflito remoto, a decisao correta e sempre "recarregar do backend antes de sincronizar", ou o produto precisa de uma tela/processo de merge manual?
**Impacto:** Define se a ausencia de merge e uma limitacao aceita ou uma funcionalidade obrigatoria faltante.

**Resposta:** Em conflito remoto, sempre recarregar do backend antes de sincronizar; nao precisa merge manual agora.

---

## Pergunta 4

✅ Respondida

**Contexto:** Importacao/exportacao JSON nao possui assinatura, hash ou verificacao criptografica de origem.
**Spec afetada:** [`_reversa_sdd/sdd/backup-import.md`](sdd/backup-import.md)
**Pergunta:** Arquivos de backup/fechamento precisam de validacao de integridade/autenticidade, ou a confirmacao manual atual e suficiente para o uso operacional?
**Impacto:** Se integridade forte for requisito, faltam hash/assinatura e validacao antes de importar. Se nao, fica como risco aceito.

**Resposta:** De preferencia ambos: confirmacao manual e validacao de integridade/autenticidade.

---

## Pergunta 5

✅ Respondida

**Contexto:** PWA faz app-shell cache, mas dependencias CDN como Chart.js/DOMPurify podem faltar em offline frio; nao ha pagina offline dedicada.
**Spec afetada:** [`_reversa_sdd/sdd/service-worker-pwa.md`](sdd/service-worker-pwa.md), [`_reversa_sdd/sdd/app-shell.md`](sdd/app-shell.md)
**Pergunta:** O requisito offline esperado e "app abre depois de ja ter carregado online" ou deve funcionar em offline frio com todos os assets/fornecedores vendorizados?
**Impacto:** Define se CDNs network-only sao risco aceito ou se o PWA precisa empacotar dependencias e uma experiencia offline dedicada.

**Resposta:** Opcao leve: o app precisa funcionar offline depois de ja ter sido carregado online ao menos uma vez.

---

## Pergunta 6

✅ Respondida

**Contexto:** `STORE_VERSION = 4` esta documentado, mas a migracao V4 parece um placeholder sem transformacao estrutural explicita.
**Spec afetada:** [`_reversa_sdd/sdd/schema-migrations.md`](sdd/schema-migrations.md)
**Pergunta:** A versao V4 deveria transformar algum campo real de stores antigos, ou o bump para V4 foi apenas marco/normalizacao sem mudanca incompatível?
**Impacto:** Se havia transformacao esperada, falta implementacao e teste. Se foi marco sem mudanca estrutural, a spec pode reclassificar como regra confirmada.

**Resposta:** Foi bump/marco sem mudanca incompatível esperada.

---

## Pergunta 7

✅ Respondida

**Contexto:** `backup completo` e `import_backup_transaction` podem substituir/remover periodos ausentes no payload, com confirmacao mas sem preview granular.
**Spec afetada:** [`_reversa_sdd/sdd/backup-import.md`](sdd/backup-import.md), [`_reversa_sdd/sdd/supabase-database-rpcs.md`](sdd/supabase-database-rpcs.md)
**Pergunta:** Ao importar backup completo, o comportamento correto e substituir totalmente a base, incluindo remover periodos ausentes, ou deveria haver preview granular antes de apagar/substituir?
**Impacto:** Define se a substituicao total e regra operacional aceita ou uma lacuna critica de seguranca de dados.

**Resposta:** Precisa preview granular antes de apagar/substituir dados.

---

## Pergunta 8

✅ Respondida

**Contexto:** Recados/`shift_notes` tem migracao local e tabela remota, mas a leitura individual de recados parece local/incompleta no backend.
**Spec afetada:** [`_reversa_sdd/domain.md`](domain.md), [`_reversa_sdd/sdd/ui-render-events.md`](sdd/ui-render-events.md), [`_reversa_sdd/sdd/supabase-database-rpcs.md`](sdd/supabase-database-rpcs.md)
**Pergunta:** O estado de leitura individual dos recados precisa sincronizar no backend por usuario, ou pode permanecer apenas local/visual?
**Impacto:** Se precisa sincronizar, faltam campos/RPCs/policies. Se local basta, a spec deve registrar essa decisao como regra.

**Resposta:** Estado de leitura individual pode ficar local/visual; nao precisa sincronizar no backend por usuario agora.
