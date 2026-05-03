# Plano Reversa — Gestão interna de academias

## Fase 1 — Reconhecimento

- [x] **Scout** — Mapear superfície do projeto, stack, entry points, módulos, dependências, integrações e riscos iniciais.

## Fase 2 — Escavação

- [x] **Archaeologist** — Análise do módulo `src/core`
- [x] **Archaeologist** — Análise do módulo `src/domain`
- [x] **Archaeologist** — Análise do módulo `src/features`
- [x] **Archaeologist** — Análise do módulo `src/ui`
- [x] **Archaeologist** — Análise do módulo `src/utils`
- [x] **Archaeologist** — Análise do módulo `supabase`
- [x] **Archaeologist** — Análise do módulo `Legacy`
- [x] **Archaeologist** — Análise do módulo `tests`
- [x] **Data Master** — Documentar modelo de dados local/remoto, migrações Supabase e persistência browser-only.
- [x] **Detective** — Extrair regras de negócio implícitas, fluxos operacionais, permissões e decisões técnicas.

## Fase 3 — Interpretação

- [x] **Architect** — Consolidar arquitetura, integrações, riscos e matriz de impacto das especificações.

## Fase 4 — Geração

- [x] **Writer** — Gerar especificações executáveis em `_reversa_sdd/` no idioma definido.

## Fase 5 — Revisão

- [x] **Reviewer** — Revisar consistência, confiança das evidências e lacunas para validação humana.

## Observações

- O Reversa escreve apenas em `.reversa/` e `_reversa_sdd/`.
- Arquivos existentes do projeto não serão apagados, modificados ou sobrescritos.
- Após o Scout, este plano pode ser refinado com uma tarefa por módulo realmente identificado em `.reversa/context/surface.json`.
