# Deploy e observabilidade

## Metadados de release

O app expõe a versão funcional (`APP_VERSION`) e os metadados públicos de deploy em:

- Configurações → Sobre o sistema.
- `window.__APP_INTERNALS__.config.APP_COMMIT`.
- `window.__APP_INTERNALS__.config.APP_BUILD_TIME`.
- `window.__APP_INTERNALS__.config.APP_RELEASE_LABEL`.

No CI/deploy, gere o `env.js` com:

```bash
APP_COMMIT="$(git rev-parse HEAD)" \
APP_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
node Scripts/generate-env.mjs
```

Se `SENTRY_RELEASE` não for informado, o Sentry usa `APP_VERSION@APP_COMMIT`. Em desenvolvimento local sem commit injetado, o app mostra `local`.

## Smoke pós-deploy

Execute contra a URL publicada:

```bash
DEPLOY_SMOKE_URL="https://sua-url-publicada.example" npm run smoke:deploy
```

Sem `DEPLOY_SMOKE_URL`, o comando sobe o servidor estático local configurado no Playwright (`http://127.0.0.1:4173`) e valida o mesmo checklist.

Checklist coberto pelo smoke:

- app inicializa e expõe `__APP_INTERNALS__`;
- Chart.js fica disponível no runtime;
- service worker registra em origem HTTP/HTTPS;
- backup JSON dispara download;
- importação rejeita payload inválido;
- mês ativo troca e persiste no estado da aplicação.

## Erros capturados

Com `SENTRY_DSN` e SDK do Sentry carregados, o app registra:

- falha de inicialização (`feature: bootstrap`);
- falha de recovery do bootstrap (`stage: initializeApp-recovery`);
- falha de registro ou atualização do service worker (`feature: pwa`);
- falha de leitura, validação ou aplicação de importação de backup (`feature: backup-import`).

Os contextos de importação incluem nome, tipo e tamanho do arquivo, mas não incluem conteúdo do backup.

## Rollback seguro

Procedimento objetivo:

1. Reverter o deploy para o artefato ou commit anterior conhecido.
2. Gerar `env.js` novamente com o `APP_COMMIT` do rollback e `APP_BUILD_TIME` do novo deploy.
3. Publicar todos os arquivos estáticos do artefato anterior, incluindo `index.html`, `sw.js`, `styles.css`, `manifest.json`, `icons/` e `src/`.
4. Invalidar o cache da CDN/hosting para `index.html`, `sw.js`, `env.js`, `styles.css` e `src/**`.
5. Executar `DEPLOY_SMOKE_URL="<url>" npm run smoke:deploy`.

Observações sobre cache:

- O `sw.js` versiona caches por `APP_VERSION` e hash do manifesto de assets; trocar qualquer asset listado força cache novo.
- A rotina de `activate` remove caches antigos do prefixo da versão atual que não sejam o cache ativo.
- O rollback não deve depender de orientar usuários a limpar cache manualmente; a invalidação do hosting/CDN e o service worker atualizado precisam entregar o artefato revertido.
