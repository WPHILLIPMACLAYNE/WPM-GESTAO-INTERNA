# User Story: Fluxo de atendimento e addons

## Metadados

| Campo | Valor |
|-------|-------|
| ID | US-WPM-001 |
| Status | 🟢 Confirmado por código e testes |
| Fonte principal | `src/features/forms.js`, `src/features/crud.js`, `src/ui/render-students.js`, `src/ui/render-addons.js`, `tests/e2e/workflows.spec.js` |
| Perfis | Recepção, gestão operacional |
| Escopo | Registrar, editar, filtrar e excluir atendimentos; vincular addon ao atendimento; refletir contadores e rankings |

## História

Como pessoa da recepção, quero registrar atendimentos de alunos com matrícula, datas, feedback, aviso de NPS, atendente e addon opcional, para acompanhar volume comercial do mês, qualidade do atendimento e vendas complementares por pessoa. 🟢

## Objetivos Operacionais

- 🟢 Permitir cadastro de um novo atendimento pela aba de alunos ou botão global de novo atendimento.
- 🟢 Exigir ao menos o nome do aluno antes de salvar.
- 🟢 Normalizar matrícula para dígitos e rejeitar entrada com caracteres não numéricos.
- 🟢 Salvar atendimento no período ativo usando `state.students`.
- 🟢 Quando houver addon selecionado, incrementar automaticamente o contador diário em `state.addons[atendimento][addon][dia - 1]`.
- 🟢 Ao editar atendimento existente, remover o vínculo anterior de addon antes de aplicar o novo vínculo.
- 🟢 Nunca permitir contador de addon negativo.
- 🟢 Atualizar áreas `hero`, `dashboard`, `students` e `addons` após salvamento de atendimento.
- 🟢 Preservar persistência após reload.
- 🟢 Permitir busca por texto, filtro por atendente e filtro por feedback na tabela de atendimentos.

## Atores

| Ator | Responsabilidade |
|------|------------------|
| Recepção | Cria e edita atendimentos, escolhe atendente e addon. 🟢 |
| Gestor | Consulta ranking, volume de atendimentos, resumo de recepcionistas e addons. 🟢 |
| Sistema | Valida, persiste, atualiza contadores e rerenderiza áreas impactadas. 🟢 |

## Pré-condições

- 🟢 O período ativo deve estar gravável; `assertWritableCurrentPeriod()` bloqueia alterações em períodos fechados/históricos.
- 🟢 Deve existir `state.settings.receptionists` ou equipe equivalente para preencher o select de atendimento.
- 🟢 Deve existir `state.settings.addonTypes` para preencher o select de addons.
- 🟢 `state.addons` deve conter arrays por pessoa/tipo com tamanho igual a `state.settings.monthDays`, normalizados por lifecycle/builders.

## Fluxo Principal

1. 🟢 Usuário abre a aba de alunos ou aciona o botão de novo atendimento.
2. 🟢 Sistema abre modal com campos de nome, matrícula, última visita, hora, início, aviso NPS, atendimento, feedback, addon e observações.
3. 🟢 Usuário preenche ao menos o nome e seleciona atendente; addon pode ficar vazio.
4. 🟢 Ao salvar, `getStudentFormData()` coleta valores do DOM, normaliza matrícula e cria `id` novo quando não há edição.
5. 🟢 `validateStudent()` valida nome obrigatório e matrícula numérica.
6. 🟢 `applyStudentSave()` monta a entidade e insere/substitui em `state.students`.
7. 🟢 `createCrudHandler()` clona estado anterior, aplica mutação e chama `saveData()`.
8. 🟢 Antes do commit persistente, se for edição, o addon anterior é decrementado.
9. 🟢 O addon atual é incrementado conforme `inicio || ultimaVisita || getActivePeriodFallbackDate()`.
10. 🟢 Se persistência falhar, o sistema faz rollback do estado, repõe storage do período ativo, limpa cache de seletores e rerenderiza.
11. 🟢 Se persistência passar, o modal é finalizado, a UI é atualizada e rankings/indicadores passam a refletir o atendimento.

## Fluxos Alternativos

### Atendimento sem addon

1. 🟢 Usuário salva atendimento com `student_addon` vazio.
2. 🟢 Sistema registra o aluno em `state.students`.
3. 🟢 Nenhum contador em `state.addons` é alterado.
4. 🟢 Dashboard e tabela ainda contabilizam atendimento por recepcionista.

### Edição alterando addon

1. 🟢 Usuário edita atendimento existente.
2. 🟢 Sistema mantém o mesmo `id`.
3. 🟢 Antes de salvar, o vínculo de addon anterior é decrementado com delta `-1`.
4. 🟢 Depois, o novo vínculo é incrementado com delta `+1`.
5. 🟢 O contador usa clamp `Math.max(0, valor + delta)`.

### Filtros de atendimento

1. 🟢 Usuário pesquisa por nome, matrícula, atendente, observações ou addon.
2. 🟢 Sistema normaliza texto e reduz linhas exibidas.
3. 🟢 Usuário filtra por atendente ou feedback.
4. 🟢 Sistema exibe somente registros compatíveis.

### Excluir atendimento

1. 🟢 Usuário aciona exclusão em uma linha.
2. 🟢 Sistema pede confirmação e localiza o atendimento existente.
3. 🟢 Sistema aplica `applyStudentAddonLink(existing, -1)` antes de remover o atendimento.
4. 🟢 Se `saveData()` falhar, o atendimento é recolocado e `applyStudentAddonLink(existing, 1)` compensa o contador.
5. 🟢 Em sucesso, sistema renderiza `hero`, `dashboard`, `students` e `addons`.

## Regras de Negócio

| Regra | Evidência |
|-------|-----------|
| Nome do aluno é obrigatório. | `validateStudent()` em `src/features/forms.js`. 🟢 |
| Matrícula aceita somente dígitos quando preenchida. | `normalizeNumericId()` e erro de validação por divergência entre bruto e normalizado. 🟢 |
| Atendimento salvo entra no começo da lista se for novo. | `upsertStudent()` usa `[student, ...store.students]`. 🟢 |
| Edição substitui item por `id`. | `upsertStudent()` usa `findIndex`. 🟢 |
| Addon depende de aluno ter `addon` e `atendimento`. | `getStudentAddonLink()`. 🟢 |
| Dia do addon usa `inicio`, depois `ultimaVisita`, depois fallback do período. | `getStudentAddonLink()`. 🟢 |
| Dia é limitado entre 1 e `monthDays`. | `Math.min(state.settings.monthDays, Math.max(1, day)) - 1`. 🟢 |
| Link inexistente de pessoa/tipo não altera contador. | `getStudentAddonLink()` retorna `null`. 🟢 |
| Falha de `saveData()` restaura estado anterior. | `commitSave()` em `createCrudHandler()`. 🟢 |
| Período fechado bloqueia escrita. | `assertWritableCurrentPeriod()`. 🟢 |

## Critérios de Aceitação

### Cenário 1: cadastro válido com addon

Dado um período ativo gravável com atendente `Wallace` e addon `Energy` configurados
Quando a recepção salva um atendimento de `Alice Audit` com início em `2026-04-05` e addon `Energy`
Então o atendimento deve aparecer na tabela de alunos
E o registro deve persistir no store do período ativo
E o contador de addons de `Wallace/Energy` no dia 5 deve aumentar em 1
E dashboard, alunos e addons devem ser atualizados. 🟢

### Cenário 2: validação de nome obrigatório

Dado que o modal de atendimento está aberto
Quando a recepção tenta salvar sem preencher nome
Então o sistema deve exibir a mensagem `Preencha ao menos o nome do aluno.`
E nenhum atendimento novo deve ser persistido
E nenhum contador de addon deve ser alterado. 🟢

### Cenário 3: matrícula inválida

Dado que o modal de atendimento está aberto
Quando a recepção informa matrícula com caracteres não numéricos
Então o sistema deve bloquear o salvamento
E deve apontar erro no campo de matrícula
E deve preservar os dados digitados para correção. 🟢

### Cenário 4: edição troca addon

Dado um atendimento existente com addon vinculado
Quando a recepção altera o addon ou a data usada no vínculo e salva
Então o contador anterior deve ser decrementado sem ficar negativo
E o novo contador deve ser incrementado no dia calculado
E o atendimento deve manter seu `id`. 🟢

### Cenário 5: persistência falha

Dado que o salvamento retorna falha
Quando a recepção tenta salvar um atendimento válido
Então o sistema deve restaurar o estado anterior
E deve recolocar `storage.activePeriod` e `storage.periods[currentPeriodKey]`
E deve exibir toast de falha
E deve rerenderizar as áreas impactadas. 🟢

### Cenário 6: busca e filtros

Dado dois atendimentos cadastrados para atendentes e feedbacks diferentes
Quando o usuário pesquisa por `Alice`, filtra por `Wallace` ou filtra por `Respondeu`
Então a tabela deve exibir apenas registros compatíveis
E limpar filtros deve restaurar a lista do período. 🟢

## Cenários de Borda

- 🟢 Se `inicio` estiver vazio, o vínculo de addon usa `ultimaVisita`.
- 🟢 Se `inicio` e `ultimaVisita` estiverem vazios, o vínculo usa data fallback do período ativo.
- 🟢 Se o dia calculado for maior que `monthDays`, o índice é limitado ao último dia configurado.
- 🟢 Se atendente ou tipo de addon não existir mais em `state.addons`, o atendimento ainda pode ser salvo, mas contador não é alterado.
- 🟢 Se addon anterior já estiver em zero, decremento não gera número negativo.
- 🟡 Se um atendente removido permanece apenas em histórico, a aba Addons entra em modo somente leitura para esse nome; a interação exata com atendimento novo deve ser validada no fluxo de configurações.

## Dados Envolvidos

| Entidade | Campos relevantes |
|----------|-------------------|
| `Student` | `id`, `nome`, `matricula`, `ultimaVisita`, `horaVisita`, `inicio`, `avisoNps`, `atendimento`, `feedback`, `addon`, `observacoes`. 🟢 |
| `state.students` | Lista de atendimentos do período ativo. 🟢 |
| `state.addons` | Mapa pessoa -> tipo -> array diário de quantidades. 🟢 |
| `settings.addonTypes` | Tipos exibidos no select e usados em rankings. 🟢 |
| `settings.receptionists` / equipe | Pessoas disponíveis para atendimento e apuração comercial. 🟢 |

## Rastreabilidade

| Comportamento | Arquivos |
|---------------|----------|
| Coleta e validação do formulário | `src/features/forms.js` 🟢 |
| Inserção/substituição de aluno | `src/features/forms.js` 🟢 |
| Transação, rollback e render targets | `src/features/crud.js` 🟢 |
| Vínculo automático aluno-addon | `src/features/crud.js` 🟢 |
| Tabela, busca, filtros e modal de alunos | `src/ui/render-students.js` 🟢 |
| Grid e ranking de addons | `src/ui/render-addons.js`, `src/domain/selectors.js` 🟢 |
| Persistência e reload em E2E | `tests/e2e/workflows.spec.js` 🟢 |
| Persistência Supabase normalizada | `src/core/supabase.js`, `_reversa_sdd/sdd/supabase-database-rpcs.md` 🟢 |

## Fora de Escopo

- 🟢 Criação e edição manual direta de vendas na aba Addons, exceto como reflexo do atendimento.
- 🟢 Fechamento mensal e bloqueio definitivo do período.
- 🟢 Sincronização remota detalhada com Supabase.
- 🟢 Fluxos de NPS, pendências, escala e eventos além dos campos presentes no atendimento.

## Observações de Reimplementação

- 🟢 O salvamento deve ser tratado como operação transacional em memória, com cópia serializável anterior.
- 🟢 O vínculo addon não deve ser implementado como simples soma no fim; a edição exige compensação do registro anterior.
- 🟢 A UI depende de rerender seletivo, não de reload completo.
- 🟢 A matriz de contadores por dia é parte do contrato do domínio; usar somente total agregado perderia fidelidade.
- 🟢 A exclusão de atendimento também compensa o contador de addon e desfaz essa compensação em rollback.
