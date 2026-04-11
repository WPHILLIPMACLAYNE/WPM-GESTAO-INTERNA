# FASE 0 — Checklist de Infraestrutura Externa

Data: 2026-04-10  
Branch alvo: `backend/fase-0-infra`  
Objetivo: ativar e organizar a infraestrutura externa antes de iniciar código de integração backend no app.

## Escopo da fase

Esta fase prepara serviços externos, domínio, secrets e observabilidade. Ela ainda não é a fase de schema, autenticação ou migração de dados.

Saídas esperadas da Fase 0:

- contas e projetos externos criados
- domínio e DNS sob controle
- secrets centralizados
- credenciais prontas para CI/CD e deploy
- critérios definidos para a próxima fase de código

## Ordem correta de execução

Use esta ordem para evitar retrabalho e dependências quebradas:

1. `Namecheap`
2. `Doppler`
3. `Supabase`
4. `Sentry`
5. `Mailgun`
6. `BrowserStack`
7. `Codecov`

## Dependências entre serviços

- `Namecheap` vem primeiro porque o domínio e o DNS destravam verificação do `Mailgun` e o domínio final do produto.
- `Doppler` vem cedo para virar a fonte única de secrets assim que as credenciais forem sendo geradas.
- `Supabase` pode ser ativado logo após `Doppler`, porque suas chaves vão alimentar a futura integração do app.
- `Sentry` é quase independente, mas idealmente já nasce com ambiente e release padronizados.
- `Mailgun` depende de DNS funcional no domínio escolhido.
- `BrowserStack` depende apenas de conta ativa, mas vale configurar depois que a base de secrets estiver definida.
- `Codecov` depende da pipeline de testes e do repositório GitHub já existente.

## Regras da fase

- Nunca colocar `service_role`, API keys privadas ou tokens em arquivos do frontend.
- Tudo que for segredo deve entrar no `Doppler` primeiro e só depois ser sincronizado para GitHub/Vercel.
- No browser, só podem aparecer valores públicos deliberadamente expostos, como URL pública e chave pública/publicável do Supabase ou DSN público do Sentry.
- Integrações que exigem segredo em runtime, como `Mailgun`, devem ficar para backend/edge function, nunca para JS browser-only.

---

## 1. Namecheap

### 1. O que o owner precisa fazer manualmente

- [ ] Confirmar que o domínio `wpmgestao.me` está ativo na conta correta.
- [ ] Decidir onde o DNS autoritativo ficará:
  `Namecheap BasicDNS` ou outro provedor.
- [ ] Se o DNS ficar no Namecheap, validar que a aba `Advanced DNS` está disponível para o domínio.
- [ ] Definir a estratégia de subdomínios:
  `www.wpmgestao.me`, raiz `wpmgestao.me`, e subdomínio de e-mail recomendado como `mg.wpmgestao.me`.
- [ ] Configurar ou registrar os records necessários para o site público e, depois, para o `Mailgun`.
- [ ] Documentar internamente onde o DNS será mantido para evitar editar registros no lugar errado.

### 2. O que eu implemento no código depois

- [ ] Atualizar documentação de ambiente e produção com o domínio canônico.
- [ ] Ajustar qualquer referência hardcoded de URL base para usar o domínio final.
- [ ] Preparar headers/CSP e allowlists de origem quando essa etapa entrar no deploy.
- [ ] Garantir que futuras integrações usem `mg.wpmgestao.me` para envio de e-mail e não o domínio raiz diretamente.

### 3. Observações de dependência

- `Mailgun` depende diretamente desta etapa.
- Se o DNS mudar de provedor depois, os records do `Mailgun` e do site precisarão ser recriados.

---

## 2. Doppler

### 1. O que o owner precisa fazer manualmente

- [ ] Criar o projeto do app no `Doppler`, por exemplo `wpm-gestao-interna`.
- [ ] Confirmar os ambientes raiz:
  `dev`, `stg`, `prd`.
- [ ] Criar um ambiente/config extra para integração com GitHub Actions, se fizer sentido no fluxo do time.
- [ ] Autorizar a integração do `Doppler` com o repositório GitHub do projeto.
- [ ] Se a operação usar sync automático, configurar também a integração com `Vercel` por ambiente.
- [ ] Definir a convenção de nomes dos secrets.
- [ ] Cadastrar, à medida que surgirem, pelo menos estes secrets:
  `SUPABASE_URL`, `SUPABASE_ANON_KEY` ou `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` se release automation for usada, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`, `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`, `CODECOV_TOKEN`.
- [ ] Definir quem tem acesso administrativo e quem terá acesso apenas de leitura.

### 2. O que eu implemento no código depois

- [ ] Formalizar um contrato de configuração para o projeto:
  quais variáveis são públicas, privadas e de CI.
- [ ] Adaptar workflows para consumir secrets vindos do GitHub sincronizados pelo `Doppler`.
- [ ] Preparar documentação local para desenvolvimento com `Doppler CLI`, sem gravar secrets no repositório.
- [ ] Garantir que o app browser-only consuma apenas variáveis públicas injetadas com segurança.

### 3. Observações de dependência

- Esta etapa deve acontecer antes da propagação de secrets para CI/CD.
- `Supabase`, `Sentry`, `Mailgun`, `BrowserStack` e `Codecov` alimentam o `Doppler` com credenciais depois de ativados.

---

## 3. Supabase

### 1. O que o owner precisa fazer manualmente

- [ ] Criar o projeto no `Supabase`.
- [ ] Escolher organização, nome do projeto, região e senha do banco.
- [ ] Guardar em local seguro a senha do banco e o `project ref`.
- [ ] Abrir o painel do projeto e anotar:
  `Project URL`, chave pública/publicável e chave privada `service_role`.
- [ ] Validar as configurações iniciais de `Auth`, mesmo que o login só seja implementado na Fase 2.
- [ ] Revisar se a região escolhida é adequada para a operação no Brasil.
- [ ] Inserir as credenciais no `Doppler`, separando público de privado.

### 2. O que eu implemento no código depois

- [ ] Evoluir [src/core/config.js](/mnt/storage/APPSPAGESTAOWPM/APLICATIVOFINALIZADO/src/core/config.js) para expor somente configuração pública necessária ao cliente.
- [ ] Criar `src/core/supabase.js` para inicializar o client e manter fallback offline compatível com o estado atual do app.
- [ ] Proteger o projeto contra uso indevido da chave privada:
  `service_role` não entra no browser.
- [ ] Preparar a camada de inicialização para convivência entre persistência local atual e backend futuro.
- [ ] Deixar a base pronta para a Fase 1, quando entrarem `migrations` e modelagem real.

### 3. Observações de dependência

- Depende apenas de o `Doppler` já existir como destino dos secrets.
- A parte de `migrations SQL` pertence mais naturalmente à Fase 1 de schema do que à Fase 0.

---

## 4. Sentry

### 1. O que o owner precisa fazer manualmente

- [ ] Criar ou selecionar a organização no `Sentry`.
- [ ] Criar um projeto JavaScript para o frontend web.
- [ ] Copiar o `DSN` do projeto.
- [ ] Definir nomes de ambiente que serão usados de forma consistente:
  `development`, `staging`, `production`.
- [ ] Se houver automação de release depois, gerar também um `auth token` apropriado e limitar seu escopo.
- [ ] Inserir `DSN` e eventual token no `Doppler`.
- [ ] Confirmar quem receberá alertas e notificações do projeto.

### 2. O que eu implemento no código depois

- [ ] Adicionar bootstrap do `Sentry` no frontend de forma condicional por ambiente.
- [ ] Enviar `environment` e `release` de forma consistente.
- [ ] Capturar erros globais relevantes sem poluir o app em ambiente local.
- [ ] Integrar o cliente com a futura camada `Supabase` quando fizer sentido para tracing.
- [ ] Documentar como desativar ou reduzir amostragem em desenvolvimento.

### 3. Observações de dependência

- Pode ser configurado logo após `Supabase`.
- Fica melhor quando já existe convenção de ambientes definida no `Doppler`.

---

## 5. Mailgun

### 1. O que o owner precisa fazer manualmente

- [ ] Criar a conta/projeto no `Mailgun`.
- [ ] Adicionar um domínio de envio, preferencialmente `mg.wpmgestao.me`.
- [ ] Copiar os registros DNS exigidos pelo `Mailgun`.
- [ ] Voltar ao `Namecheap` e criar os registros `TXT`, `MX` e `CNAME` necessários.
- [ ] Aguardar propagação e concluir a verificação do domínio no `Mailgun`.
- [ ] Criar a API key com escopo mínimo necessário.
- [ ] Definir um remetente padrão, por exemplo algo como `nao-responda@mg.wpmgestao.me`.
- [ ] Inserir `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` e remetentes padrão no `Doppler`.

### 2. O que eu implemento no código depois

- [ ] Não integrar `Mailgun` diretamente no browser.
- [ ] Preparar o contrato para envio de e-mail via backend seguro, edge function ou automação server-side.
- [ ] Documentar quais eventos futuros poderão disparar e-mail:
  convite, aprovação de usuário, aviso operacional, recuperação de acesso ou notificação administrativa.
- [ ] Quando existir backend, criar módulo de envio com segredo isolado do frontend.

### 3. Observações de dependência

- Depende de `Namecheap` e do DNS já decidido.
- Os secrets devem ser centralizados no `Doppler` antes de qualquer automação.

---

## 6. BrowserStack

### 1. O que o owner precisa fazer manualmente

- [ ] Ativar a conta no `BrowserStack`.
- [ ] Confirmar acesso ao produto correto para o projeto:
  pelo menos testes web em browsers reais e, se desejado, mobile real.
- [ ] Copiar `username` e `access key`.
- [ ] Definir uma matriz mínima de teste:
  Android, iPhone, Chrome desktop e Safari.
- [ ] Decidir se o time vai usar testes em URL pública, Preview deploy ou `BrowserStack Local`.
- [ ] Inserir credenciais no `Doppler`.

### 2. O que eu implemento no código depois

- [ ] Adicionar configuração opcional de execução remota para Playwright ou suíte equivalente.
- [ ] Criar scripts/workflows para rodar smoke tests na matriz mínima escolhida.
- [ ] Se a estratégia for ambiente privado, preparar uso de `BrowserStack Local`.
- [ ] Manter o fluxo local atual intacto, usando BrowserStack como camada complementar e não substituta.

### 3. Observações de dependência

- Não bloqueia `Supabase`, `Sentry` ou `Mailgun`.
- Fica mais útil quando já existe URL estável ou estratégia definida de teste local/staging.

---

## 7. Codecov

### 1. O que o owner precisa fazer manualmente

- [ ] Conectar o repositório GitHub ao `Codecov`.
- [ ] Verificar se o repositório será tratado como público ou privado no serviço.
- [ ] Gerar o `CODECOV_TOKEN` se o fluxo exigir token.
- [ ] Definir regras mínimas de cobertura e status checks desejados.
- [ ] Inserir o token no `Doppler` e sincronizá-lo para GitHub Actions se esse for o padrão escolhido.

### 2. O que eu implemento no código depois

- [ ] Ajustar `vitest` para produzir coverage útil sobre `src/**/*.js`.
- [ ] Atualizar [.github/workflows/ci.yml](/mnt/storage/APPSPAGESTAOWPM/APLICATIVOFINALIZADO/.github/workflows/ci.yml) para fazer upload do coverage ao `Codecov`.
- [ ] Opcionalmente criar `codecov.yml` para metas, paths ignorados e status checks.
- [ ] Garantir que a cobertura publicada reflita código real e não artefatos legados.

### 3. Observações de dependência

- Depende da pipeline de testes estar operacional.
- Faz mais sentido depois da correção de cobertura citada em [Docs/PROXIMOS_PASSOS.md](/mnt/storage/APPSPAGESTAOWPM/APLICATIVOFINALIZADO/Docs/PROXIMOS_PASSOS.md).

---

## Sequência operacional resumida

### Bloco A — Domínio e secret store

- [ ] Confirmar domínio e DNS no `Namecheap`
- [ ] Criar projeto e ambientes no `Doppler`

### Bloco B — Serviços que geram credenciais-base

- [ ] Criar projeto no `Supabase`
- [ ] Criar projeto no `Sentry`
- [ ] Registrar todos os secrets gerados no `Doppler`

### Bloco C — Serviços que dependem de DNS ou CI

- [ ] Verificar domínio do `Mailgun` via `Namecheap`
- [ ] Ativar `BrowserStack`
- [ ] Conectar `Codecov`
- [ ] Sincronizar secrets para GitHub/Vercel se aplicável

### Bloco D — Entrega técnica pós-ativação

- [ ] Ajustar contrato de variáveis em `config.js`
- [ ] Criar `src/core/supabase.js`
- [ ] Planejar bootstrap do `Sentry`
- [ ] Planejar workflow seguro para `Mailgun`
- [ ] Planejar integrações de CI com `BrowserStack` e `Codecov`

## Critério de aceite da Fase 0

A Fase 0 pode ser considerada concluída quando:

- todos os serviços externos tiverem conta/projeto ativo
- o domínio e o DNS estiverem definidos e documentados
- todos os secrets estiverem no `Doppler`
- nenhuma credencial privada estiver exposta no frontend
- existir clareza objetiva sobre o que entra na Fase 1 e o que ficou só preparado nesta fase

## Fora do escopo da Fase 0

Estes itens não devem ser tratados como conclusão da Fase 0:

- modelagem completa das tabelas no `Supabase`
- `migrations SQL` finais
- autenticação pronta no app
- migração real de `IndexedDB/localStorage`
- envio de e-mail diretamente do frontend
