# HOMOLOGACAO_MIGRACAO_REAL — Etapa 7

Data: 2026-04-22

Atualizacao 2026-05-02: a etapa de fechamento pos-Reversa adicionou uma camada obrigatoria de preview aceito e integridade de payload para importacao/sync Supabase. O roteiro complementar esta em [`FECHAMENTO_POS_REVERSA_2026-05-02.md`](./FECHAMENTO_POS_REVERSA_2026-05-02.md).

Atualizacao 2026-05-03: a homologacao pos-merge local esta registrada em [`HOMOLOGACAO_POS_MERGE_2026-05-03.md`](./HOMOLOGACAO_POS_MERGE_2026-05-03.md). O fluxo browser autenticou, mas o dry-run bloqueou a migracao por divergencias entre local e remoto em `2026-04`.

Objetivo: validar a migracao assistida da base legada real para o backend Supabase sem perda silenciosa de dados.

> Resultado do ciclo de 2026-04-22:
> homologacao operacional concluida em navegador real com sessao autenticada, dry-run consistente,
> snapshot local salvo, validacao pos-migracao remota e fechamento de `Abril/2026` abrindo
> `Maio/2026` limpo no backend.

## Quando usar

Use este roteiro em qualquer primeira migracao real de unidade ou em reimportacao assistida apos validacao comparativa.

## Pre-requisitos

- `env.js` configurado com `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_UNIT_SLUG` quando aplicavel.
- Backend local/remoto acessivel e usuario autenticavel com perfil gravavel na unidade correta.
- Migration `supabase/migrations/20260502183000_import_guard_preview_integrity.sql` aplicada quando o alvo for Supabase remoto.
- Operacao conduzida em uma unica janela e, idealmente, sem outro dispositivo editando a mesma unidade durante a homologacao.
- Base local real ja carregada no navegador que sera migrado.

## Checklist operacional

1. Preparar a sessao

- Abrir o app no navegador alvo.
- Fazer login no painel `Supabase Auth e unidade ativa`.
- O login deve preservar a base local; use `Recarregar do backend` apenas quando quiser trocar explicitamente para a base remota.
- Confirmar:
  - `Sessao = autenticada`
  - `Perfil gravavel = sim`
  - unidade ativa correta

2. Rodar o dry-run

- Ir em `Configuracoes` -> `Migracao assistida`.
- Clicar em `Executar dry-run`.
- Conferir no relatorio:
  - contagens locais coerentes com o Dashboard;
  - preview granular coerente por periodo e tipo de entidade;
  - recados legados detectados quando existirem;
  - situacao remota em um dos estados seguros:
    - `Backend vazio`
    - `Comparacao remota consistente`

3. Decidir se pode migrar

- Pode prosseguir quando a prontidao estiver em:
  - `Primeira migracao liberada`
  - `Pronto para migrar`
- Deve abortar quando aparecer:
  - `Comparacao remota falhou`
  - `Divergencias detectadas`
  - sessao sem escrita

4. Executar a migracao assistida

- Clicar em `Migrar para o backend`.
- Esperar a conclusao do backup local automatico e do envio transacional.
- Confirmar o toast final sem erro.
- Confirmar que a importacao so foi liberada apos aceite explicito do preview.
- Em homologacao tecnica, validar que payload adulterado ou sem aceite de preview e rejeitado pelo backend.

5. Validar o pos-migracao

- Recarregar do backend.
- Confirmar que a base remota volta a abrir normalmente.
- Validar amostra minima:
  - meses fechados permanecem acessiveis;
  - alunos, pendencias, escala, eventos e NPS continuam presentes;
  - addons e recados mantem volumes esperados;
  - contagens do novo dry-run continuam coerentes.

## Evidencias minimas

- Horario da execucao.
- Usuario e unidade usados na homologacao.
- Captura do relatorio de dry-run antes da migracao.
- Captura do estado pos-migracao com a base remota carregada.
- Registro de qualquer divergencia ou ajuste manual necessario.

## Rollback imediato

Se a validacao falhar:

1. nao continuar editando a base;
2. usar o snapshot local gerado automaticamente antes da migracao;
3. restaurar a partir do fluxo de backup local;
4. repetir o dry-run antes de qualquer nova tentativa.

## Criterio de aceite

- Dry-run coerente com a base local real.
- Preview aceito explicitamente antes de qualquer substituicao destrutiva.
- Backend remoto rejeita importacao sem `p_preview_accepted=true` ou com integridade invalida.
- Primeira importacao ou reimportacao concluida sem erro.
- Pos-migracao remoto bate com a amostra local revisada.
- Nenhuma perda de historico de meses fechados.
