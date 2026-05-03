# User Story: Fluxo de fechamento mensal

## Metadados

| Campo | Valor |
|-------|-------|
| ID | US-WPM-002 |
| Status | 🟢 Confirmado por código e artefatos Reversa |
| Fonte principal | `src/core/lifecycle.js`, `src/core/backup.js`, `src/core/period-builder.js`, `_reversa_sdd/sdd/monthly-lifecycle.md` |
| Perfis | Gestão operacional, administração, recepção em consulta histórica |
| Escopo | Fechar mês ativo, exportar arquivo JSON, bloquear alterações retroativas e abrir próximo mês |

## História

Como gestor operacional, quero fechar o mês ativo com um arquivo JSON de evidência e travar edições posteriores, para preservar o histórico mensal, evitar alteração retroativa e iniciar o próximo período com dados limpos ou preservados conforme decisão operacional. 🟢

## Objetivos Operacionais

- 🟢 Fechar apenas período ativo ainda gravável.
- 🟢 Confirmar explicitamente o fechamento antes da operação.
- 🟢 Persistir o estado atual antes de montar o arquivo de fechamento.
- 🟢 Baixar arquivo `smartfit-fechamento-YYYY-MM.json`.
- 🟢 Registrar `storage.archives[currentPeriodKey]` com timestamp, label local e nome do mês.
- 🟢 Bloquear ações, inputs, mudanças inline e blur actions do período fechado.
- 🟢 Avançar automaticamente para `getNextPeriodKey(currentPeriodKey)`.
- 🟢 Criar o próximo mês quando inexistente.
- 🟢 Se o próximo mês já possui dados, permitir escolha entre zerar ou preservar.
- 🟢 Reverter o archive caso a persistência do fechamento falhe.

## Atores

| Ator | Responsabilidade |
|------|------------------|
| Gestor/Admin | Decide fechar o mês e escolhe como tratar o próximo período quando já há dados. 🟢 |
| Recepção | Consulta meses fechados em modo somente leitura e opera o novo mês aberto. 🟢 |
| Sistema | Exporta JSON, persiste archive, bloqueia mutações, ativa o próximo mês e sincroniza UI. 🟢 |
| Backend Supabase | Em modo remoto, representa períodos como `open`/`closed` e aplica RPC de fechamento para perfis autorizados. 🟢 |

## Pré-condições

- 🟢 `currentPeriodKey` deve estar no formato `YYYY-MM`.
- 🟢 `storage.periods[currentPeriodKey]` deve existir ou ser normalizado antes da operação.
- 🟢 O período ativo não pode estar em `storage.archives`.
- 🟢 Backend Supabase, quando ativo, não pode estar em modo read-only para permitir mutações locais.
- 🟢 O navegador deve suportar APIs de `Blob`, `URL.createObjectURL` e clique programático em `<a>` para download automático.

## Fluxo Principal

1. 🟢 Usuário aciona a ação `close-current-month`.
2. 🟢 A camada de eventos chama `closeCurrentMonth()`, alias de `closePeriod()`.
3. 🟢 `closePeriod()` chama `assertWritableCurrentPeriod()` com mensagem específica caso o mês já esteja fechado.
4. 🟢 Se o período está gravável, o sistema exibe confirmação: fechar o mês e abrir o próximo.
5. 🟢 Após confirmação, `getCommittedStoreSnapshot({ persistCurrent: true, eventType: 'close-month-backup', broadcast: false })` persiste o estado corrente.
6. 🟢 `buildMonthArchivePayload()` clona e normaliza o período atual.
7. 🟢 Sistema gera um JSON com `meta.kind = "month-archive"`, `appVersion`, `exportedAt`, `version`, `periodKey`, `periodLabel` e `data`.
8. 🟢 Sistema baixa `smartfit-fechamento-YYYY-MM.json`.
9. 🟢 Sistema guarda o archive anterior em `previousArchive` para rollback.
10. 🟢 Sistema grava `storage.archives[currentPeriodKey] = { closedAt, closedAtLabel, label }`.
11. 🟢 Sistema calcula `nextKey` com `getNextPeriodKey(currentPeriodKey)`.
12. 🟢 Se o próximo mês não existe, sistema cria via `buildBootstrapPeriod(state, nextKey, { storeRef: storage })`.
13. 🟢 Sistema persiste com `saveData(true)`.
14. 🟢 Se persistir corretamente, sistema chama `switchPeriod(nextKey, { silent: true })`.
15. 🟢 UI renderiza o próximo mês e exibe toast de sucesso.

## Fluxos Alternativos

### Período atual já fechado

1. 🟢 Usuário tenta fechar mês já presente em `storage.archives`.
2. 🟢 `assertWritableCurrentPeriod()` retorna falso.
3. 🟢 Sistema exibe aviso de mês fechado.
4. 🟢 Nenhum arquivo é baixado, nenhum archive novo é gravado e o período ativo não muda.

### Próximo mês inexistente

1. 🟢 Fechamento chega em `nextKey`.
2. 🟢 `storage.periods[nextKey]` não existe.
3. 🟢 Sistema cria período por `buildBootstrapPeriod()`.
4. 🟢 Sistema normaliza o período criado.
5. 🟢 Toast final informa que o próximo mês foi iniciado com dados zerados.

### Próximo mês existe sem dados operacionais

1. 🟢 `nextPeriod` existe.
2. 🟢 `periodHasMeaningfulData(nextPeriod)` retorna falso.
3. 🟢 Sistema executa `finishClose(true)`.
4. 🟢 `resetPeriodData(nextKey, state)` inicia o período com base limpa.

### Próximo mês existe com dados

1. 🟢 `nextPeriod` existe e possui alunos, pendências, recados, escala, eventos, NPS ou addons.
2. 🟢 Sistema exibe confirmação secundária.
3. 🟢 Confirmar significa zerar e iniciar limpo.
4. 🟢 Cancelar significa preservar dados existentes.
5. 🟢 Em ambos os casos, o mês fechado permanece arquivado se `saveData(true)` passar.

### Falha ao persistir fechamento

1. 🟢 Sistema já gravou `storage.archives[currentPeriodKey]` em memória.
2. 🟢 `saveData(true)` retorna falso.
3. 🟢 Se havia `previousArchive`, sistema restaura esse valor.
4. 🟢 Se não havia archive anterior, sistema remove `storage.archives[currentPeriodKey]`.
5. 🟢 Sistema exibe toast `Falha ao fechar o mês. Tente novamente.`
6. 🟢 Sistema não troca para o próximo período.

## Regras de Negócio

| Regra | Evidência |
|-------|-----------|
| O mês fechado é representado localmente por entrada em `storage.archives[YYYY-MM]`. | `isPeriodLocked()` em `src/core/lifecycle.js`. 🟢 |
| Fechamento exige confirmação antes de exportar/arquivar. | `showConfirm()` em `closePeriod()`. 🟢 |
| O arquivo de fechamento sempre usa `kind: month-archive`. | `buildMonthArchivePayload()` em `src/core/backup.js`. 🟢 |
| O nome de download segue `smartfit-fechamento-YYYY-MM.json`. | `a.download` em `closePeriod()`. 🟢 |
| Após fechamento, o período ativo vira o próximo mês. | `switchPeriod(nextKey, { silent: true })`. 🟢 |
| Mês fechado bloqueia CRUD, configurações, restore, reset, inline update, addons, NPS e renomeações. | Sets `LOCKED_CURRENT_PERIOD_*`. 🟢 |
| UI deve desabilitar controles bloqueados e atualizar badge de status. | `syncCurrentPeriodLockUI()` e `syncPeriodControls()`. 🟢 |
| Reabertura de mês fechado deve existir. | Decisão humana confirmou a necessidade; ausência em lifecycle/UI atual. 🔴 |
| No backend, fechamento de período exige papel `admin` ou `gestor`. | `close_period_transaction` documentado em Data Master. 🟢 |

## Critérios de Aceitação

### Cenário 1: fechamento feliz de mês aberto

Dado um mês ativo aberto com dados operacionais
Quando o gestor confirma o fechamento mensal
Então o sistema deve persistir o estado atual
E baixar `smartfit-fechamento-YYYY-MM.json`
E criar `storage.archives[YYYY-MM]` com `closedAt`, `closedAtLabel` e `label`
E abrir automaticamente o próximo mês
E exibir mensagem de sucesso. 🟢

### Cenário 2: bloqueio após fechamento

Dado um mês presente em `storage.archives`
Quando o usuário tenta cadastrar aluno, alterar addon, editar pendência, mudar NPS, editar escala, criar evento ou salvar configurações
Então a ação deve ser bloqueada
E o sistema deve mostrar aviso de mês fechado
E controles associados devem estar desabilitados ou com `aria-disabled`. 🟢

### Cenário 3: próximo mês sem dados

Dado que o próximo mês existe mas não contém dados operacionais
Quando o mês atual é fechado
Então o próximo mês deve ser resetado/inicializado limpo
E deve se tornar o período ativo. 🟢

### Cenário 4: próximo mês com dados

Dado que o próximo mês já contém dados significativos
Quando o mês atual é fechado
Então o sistema deve perguntar se o usuário quer zerar ou preservar o próximo mês
E confirmar deve limpar dados operacionais
E cancelar deve manter os dados existentes. 🟢

### Cenário 5: falha de persistência

Dado que `saveData(true)` falha durante `finishClose()`
Quando o fechamento tenta persistir o archive
Então o archive recém-criado deve ser removido ou revertido
E o período ativo não deve avançar para o próximo mês
E o usuário deve receber toast de erro. 🟢

### Cenário 6: tentativa de fechar mês já bloqueado

Dado um período já fechado
Quando o usuário tenta fechar o mesmo mês novamente
Então o sistema deve impedir a ação antes do download
E deve informar que o mês já está fechado. 🟢

## Cenários de Borda

- 🟢 Se `storage.periods[nextKey]` não existe, o próximo período é criado sob demanda.
- 🟢 Se `nextPeriod` contém apenas estrutura vazia normalizada, `periodHasMeaningfulData()` retorna falso.
- 🟢 Se `nextPeriod` contém NPS score, observações, menções, recados, alunos, pendências, escala, eventos ou addon maior que zero, ele é tratado como significativo.
- 🟢 Se `previousArchive` existia, rollback preserva o estado anterior em vez de apagar.
- 🟢 O botão de fechar mês é desabilitado quando o período ativo tem archive.
- 🟢 Controles `data-historical-readonly="true"` permanecem desabilitados mesmo fora do lock comum.
- 🟡 O download via Blob não tem tratamento explícito de falha; navegadores com bloqueio de download podem não entregar arquivo mesmo que o archive local prossiga.
- 🔴 Deve haver reabertura/desarquivamento de mês fechado, mas a UI atual não documenta nem implementa esse fluxo.

## Dados Envolvidos

| Entidade | Campos relevantes |
|----------|-------------------|
| `AppStore` | `version`, `activePeriod`, `periods`, `archives`. 🟢 |
| `PeriodData` | `settings`, `students`, `pending`, `recados`, `nps`, `scale`, `events`, `addons`. 🟢 |
| `ArchiveEntry` | `closedAt`, `closedAtLabel`, `label`. 🟢 |
| `MonthArchivePayload` | `meta.kind`, `meta.appVersion`, `meta.exportedAt`, `version`, `periodKey`, `periodLabel`, `data`. 🟢 |
| Supabase `periods` | `period_key`, `label`, `status`, `closed_at`. 🟢 |

## Rastreabilidade

| Comportamento | Arquivos |
|---------------|----------|
| Fechamento local e avanço de mês | `src/core/lifecycle.js` 🟢 |
| Geração do payload `month-archive` | `src/core/backup.js` 🟢 |
| Criação/reset do próximo mês | `src/core/period-builder.js` 🟢 |
| Bloqueio visual e de ações | `src/core/lifecycle.js`, `src/ui/events-core.js` 🟢 |
| Estados `open`/`closed` | `_reversa_sdd/state-machines.md` 🟢 |
| Decisão arquitetural de mês fechado | `_reversa_sdd/adrs/002-monthly-period-archive-lock.md` 🟢 |
| Contrato SDD detalhado | `_reversa_sdd/sdd/monthly-lifecycle.md` 🟢 |
| Regras SQL/RPC remoto | `_reversa_sdd/sdd/supabase-database-rpcs.md`, `_reversa_sdd/database/business-rules.md` 🟢 |

## Fora de Escopo

- 🔴 Reabrir um mês fechado ainda precisa de fluxo próprio; a decisão humana confirmou que isso deve ser suportado.
- 🟢 Editar manualmente o JSON de fechamento.
- 🟢 Sincronização remota detalhada do fechamento via RPC, coberta pela user story de Supabase.
- 🟢 Reset manual de mês aberto, embora compartilhe mecanismos de backup e limpeza.
- 🟢 Duplicação de escala do mês anterior, tratada como conveniência do lifecycle.

## Observações de Reimplementação

- 🟢 O arquivo JSON deve ser gerado antes de o usuário ser movido para o próximo mês.
- 🟢 O lock não deve depender apenas de UI desabilitada; ações e handlers também precisam checar gravabilidade.
- 🟢 `periodHasMeaningfulData()` é a regra de decisão para proteger dados já existentes no próximo mês.
- 🟢 O rollback do archive é obrigatório para evitar um período marcado como fechado sem persistência confiável.
- 🟢 A integração Supabase deve manter semântica equivalente: período `closed` não deve aceitar mutações operacionais por usuários sem permissão apropriada.
