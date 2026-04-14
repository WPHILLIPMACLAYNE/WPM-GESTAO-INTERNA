# PLANOS_ABC

## Plano A — Baseline executável sem mexer no app

Objetivo:
Conseguir uma baseline executável e confiável sem alterar comportamento.

Ações:

1. Instalar dependências de desenvolvimento.
2. Rodar `npm test`.
3. Rodar `npx playwright test --reporter=list`.
4. Registrar resultados reais no CORTEX layer.
5. Atualizar apenas documentação que estiver comprovadamente desatualizada.

Condição de parada:

- baseline testável confirmada, ou
- bloqueio ambiental explicitamente documentado

Quando escolher:

- imediatamente
- antes de qualquer refactor
- antes de tocar em storage, lifecycle, SW, dashboard ou docs estruturais

## Plano B — Hardening de baixo risco dentro da arquitetura atual

Objetivo:
Reduzir fragilidade sem reescrever a arquitetura.

Ações candidatas:

1. Normalizar documentação estrutural para refletir o runtime atual.
2. Revisar `sw.js` para acoplar cache a `APP_VERSION` ou commit.
3. Validar a semântica de `rankSnapshot`.
4. Revisar CSP/CDN de forma incremental.
5. Mapear duplicações reais de helpers antes de deduplicar qualquer função.

Condição de parada:

- nenhuma alteração quebra ordem de scripts, bootstrap, persistência ou layout do dashboard

Quando escolher:

- depois do Plano A
- quando o objetivo for estabilização e clareza

## Plano C — Reestruturação profunda

Objetivo:
Criar fronteiras reais entre módulos e reduzir dependência de globais.

Pré-condições mínimas:

1. baseline executável validada
2. regressions map atualizado
3. docs estruturais já alinhadas
4. estratégia explícita para script order, storage, lifecycle e rollback

Fases sugeridas:

1. extrair contratos explícitos entre camadas
2. reduzir globais por domínio
3. diminuir centralidade de `backup.js`, `lifecycle.js`, `events-core.js`, `render-dashboard.js`
4. só depois avaliar ESM ou build step

Quando não escolher:

- no primeiro movimento
- sem baseline verde
- sem cobertura reexecutada

## Recomendação atual

A evidência do repositório aponta para `Plano A` como próximo passo seguro.
`Plano B` vem em seguida.
`Plano C` ainda é prematuro para esta primeira aplicação do CORTEX.
