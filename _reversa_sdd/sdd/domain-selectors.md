# Domain Selectors

## Visão Geral

🟢 `src/domain/selectors.js` centraliza os seletores derivados do estado operacional: KPIs do dashboard, totais de addons, resumo de recepcionistas, pendências, ranking NPS, histórico, eventos e escala.

🟢 O módulo não persiste dados e não renderiza DOM; ele consome `state`, `storage`, `currentPeriodKey` e helpers globais para retornar objetos prontos para UI, gráficos e testes.

🟢 A estratégia de performance usa memoização por assinatura JSON e por período ativo.

## Responsabilidades

- 🟢 Manter cache global de selectors em `cacheSelectores`.
- 🟢 Limpar cache por `limparCacheSelectores()` após mutações relevantes.
- 🟢 Criar assinaturas determinísticas por `JSON.stringify(partes)`.
- 🟢 Memoizar resultados por `currentPeriodKey`, nome do selector e assinatura.
- 🟢 Limitar crescimento do cache a 120 entradas.
- 🟢 Calcular totais de addons por pessoa, tipo e geral.
- 🟢 Calcular resumo operacional por recepcionista.
- 🟢 Calcular líderes históricos de addons e NPS em períodos passados.
- 🟢 Calcular resumo e filtros de pendências.
- 🟢 Calcular ranking NPS com tendência contra `rankSnapshot`.
- 🟢 Agrupar eventos filtrados por dia e status.
- 🟢 Calcular resumo de escala e cobertura operacional.
- 🟢 Montar série histórica dos últimos meses para dashboard.
- 🟢 Montar datasets de gráficos do dashboard.
- 🟢 Agregar indicadores principais em `DashboardIndicators`.
- 🟢 Expor aliases legados como `totalAddonByPerson()`, `totalNpsMentions()`, `computeSummary()` e `getOldestOpenPending()`.

## Interface

### Cache

| Nome | Tipo | Regra |
|---|---|---|
| `cacheSelectores` | `Map<string, any>` | cache global de resultados derivados. 🟢 |
| chave completa | string | `${currentPeriodKey}::${chave}::${assinatura}`. 🟢 |
| limite | number | acima de 120 entradas, cache é limpo e item atual é reinserido. 🟢 |

### API Base

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `limparCacheSelectores()` | nenhum | void | limpa cache inteiro. 🟢 |
| `criarAssinaturaSelector(...partes)` | valores serializáveis | string | `JSON.stringify(partes)`. 🟢 |
| `lerSelectorMemorizado(chave, assinatura, calcular)` | chave, assinatura, callback | any | retorna cache ou calcula. 🟢 |

### API de Domínio

| Função | Entrada | Saída | Regra |
|---|---|---|---|
| `selecionarTotaisAddons()` | nenhum | AddonTotals | soma matriz diária por pessoa/tipo. 🟢 |
| `selecionarResumoRecepcionistas()` | nenhum | ReceptionistSummary[] | calcula volume, feedback, NPS e addons por pessoa. 🟢 |
| `selecionarLideresHistoricos(limite)` | number | Array | líderes addon/NPS de meses anteriores. 🟢 |
| `selecionarResumoPendencias()` | nenhum | PendingSummary | contagens, dashboard e pendência aberta mais antiga. 🟢 |
| `selecionarPendenciasFiltradas()` | nenhum | `{linhas, grupos}` | filtra por busca textual e agrupa status. 🟢 |
| `selecionarRankingNps()` | nenhum | NpsRankingResult | ranking, tendências, total e mapa. 🟢 |
| `selecionarDadosEventosAgrupados()` | nenhum | Object | lista filtrada, mapa por dia e resumos. 🟢 |
| `selecionarResumoEscala()` | nenhum | Object | cobertura de escala e alertas. 🟢 |
| `selecionarHistoricoDashboard(limite)` | number | DashboardHistoryPoint[] | janela dos últimos meses. 🟢 |
| `selecionarDadosGraficosDashboard(limite)` | number | Object | datasets consolidados para Chart.js. 🟢 |
| `selecionarIndicadoresDashboard()` | nenhum | DashboardIndicators | agregador principal do dashboard. 🟢 |

### Aliases

| Função | Saída | Regra |
|---|---|---|
| `totalAddonByPerson(person)` | number | lê `selecionarTotaisAddons().porPessoa`. 🟢 |
| `totalNpsMentions()` | number | lê `selecionarRankingNps().totalCitacoes`. 🟢 |
| `computeSummary()` | ReceptionistSummary[] | alias de resumo de recepcionistas. 🟢 |
| `getOldestOpenPending()` | PendingItem|null | lê `maisAntigaAberta`. 🟢 |
| `diffInDays(dateStr)` | number | dias decorridos sem negativo. 🟢 |

## Regras de Negócio

- 🟢 Todo selector memoizado deve incluir `currentPeriodKey` na chave de cache.
- 🟢 Assinatura deve conter apenas partes de estado que afetam o resultado do selector.
- 🟢 Se o cache passa de 120 entradas, ele deve ser limpo para evitar crescimento indefinido.
- 🟢 `selecionarTotaisAddons()` deve considerar pessoas ativas e histórico existente em `state.addons`.
- 🟢 Totais de addons devem somar todos os dias da matriz `addons[pessoa][tipo]`.
- 🟢 Tipos de addons conhecidos devem incluir `state.settings.addonTypes` e chaves já existentes no grupo histórico.
- 🟢 Resumo de recepcionistas deve calcular taxa de feedback, taxa de addon, taxa positiva e diferença contra taxa global.
- 🟢 Feedback não pendente conta como feedback respondido para métricas.
- 🟢 Líderes históricos devem considerar apenas períodos anteriores ao `currentPeriodKey`.
- 🟢 Em empate de líder addon/NPS histórico, nome em ordem `pt-BR` decide.
- 🟢 Pendências devem ser contadas por status `aberto`, `respondido`, `concluido`.
- 🟢 Itens do dashboard de pendências devem priorizar status em aberto, depois respondido, depois concluído.
- 🟢 Pendência aberta mais antiga deve ser a menor data entre itens `aberto` com data.
- 🟢 Filtro de pendências deve usar busca textual normalizada sobre nome, matrícula, descrição, resposta e hostess.
- 🟢 Ranking NPS deve ordenar por `sortNpsMentionsByRanking()`.
- 🟢 Tendência NPS deve comparar posição atual com `state.nps.rankSnapshot[item.id]`.
- 🟢 Sem snapshot NPS, tendência padrão deve ser estável.
- 🟢 Histórico do dashboard deve caminhar para trás a partir de `currentPeriodKey`.
- 🟢 Datasets de dashboard devem produzir série de alunos, atendimentos, distribuição de feedback, NPS e ranking de addons.
- 🟢 Indicadores do dashboard devem agregar alunos, feedback, NPS, pendências, escala, evento, addons e metas.
- 🟡 A assinatura por `JSON.stringify` privilegia simplicidade e pode ser custosa para estados grandes.
- 🔴 O módulo depende de globais browser/app em vez de receber estado por parâmetro, reduzindo isolamento puro.

## Fluxo Principal

1. 🟢 UI ou teste chama um selector, por exemplo `selecionarIndicadoresDashboard()`.
2. 🟢 O selector monta uma assinatura por `criarAssinaturaSelector(...)`.
3. 🟢 A assinatura serializa os campos de `state`, `storage`, filtros ou parâmetros relevantes.
4. 🟢 O selector chama `lerSelectorMemorizado(chave, assinatura, calcular)`.
5. 🟢 A chave completa inclui `currentPeriodKey`.
6. 🟢 Se a chave existe em `cacheSelectores`, o valor memoizado é retornado.
7. 🟢 Se não existe, o callback `calcular` é executado.
8. 🟢 O valor calculado é salvo em `cacheSelectores`.
9. 🟢 Se o cache excede 120 entradas, ele é limpo e o valor atual é reinserido.
10. 🟢 O valor derivado é retornado para renderização, gráficos ou testes.
11. 🟢 Quando uma mutação relevante ocorre, código de feature/core chama `limparCacheSelectores()`.
12. 🟢 A próxima renderização recalcula os selectors afetados.

## Fluxos Alternativos

- **Dashboard completo:** 🟢 `selecionarIndicadoresDashboard()` orquestra resumo de recepcionistas, pendências, addons e NPS.
- **Gráficos do dashboard:** 🟢 `selecionarDadosGraficosDashboard()` combina histórico, recepcionistas, feedback e ranking de addons.
- **Histórico sem período existente:** 🟢 `buildDashboardHistoryPoint()` retorna `hasData=false` e métricas zeradas.
- **Ranking NPS sem snapshot:** 🟢 todos os itens ficam com tendência estável.
- **Ranking NPS com novo item:** 🟢 item sem posição anterior recebe `trend-new`.
- **Eventos filtrados:** 🟢 `selecionarDadosEventosAgrupados()` usa filtros de visão e agrupa por dia numérico.
- **Escala com dias de atenção:** 🟢 `selecionarResumoEscala()` conta fim de semana ou `rowTone='red'`.
- **Pendências filtradas:** 🟢 query vazia retorna todas as linhas agrupadas; query preenchida filtra por texto normalizado.
- **Líderes históricos inexistentes:** 🟢 períodos sem líder addon e sem líder NPS são filtrados fora.

## Dependências

- `src/domain/selectors.js` — componente principal.
- `src/core/lifecycle.js` — chama `limparCacheSelectores()` em `syncAppState()`.
- `src/core/backup.js` — chama `limparCacheSelectores()` em `saveData()`.
- `src/features/crud.js` — limpa cache após mutações de CRUD.
- `src/ui/render-dashboard.js` — consome indicadores e dados de gráficos.
- `src/ui/render-nps.js` — consome ranking NPS e líderes históricos.
- `src/ui/render-pending.js` — consome pendências filtradas.
- `src/ui/render-scale.js` — consome resumo de escala.
- `src/ui/render-events.js` — consome eventos agrupados e limpa cache após mutações.
- Helpers globais — `getAddonPeople`, `getReceptionists`, `sortNpsMentionsByRanking`, `getEventViewFilters`, `getScaleViewFilters`, `getPendingViewFilters`, `getUpcomingEvent`, `todayISO`, `clamp`, `getRiskBand`, `getNpsGoalProgress`.
- Testes — `tests/unit/selectors-real.test.js`, `tests/unit/xss-entities.test.js`, `tests/e2e/app.spec.js`.

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|---|---|---|---|
| Performance | Selectors devem ser memoizados por assinatura. | `cacheSelectores`, `lerSelectorMemorizado()` | 🟢 |
| Consistência | Cache deve separar resultados por período ativo. | chave com `currentPeriodKey` | 🟢 |
| Previsibilidade | Assinaturas devem ser determinísticas. | `JSON.stringify(partes)` | 🟢 |
| Memória | Cache deve ter limite operacional. | limite de 120 entradas | 🟢 |
| Separação | Selectors não devem renderizar DOM nem persistir dados. | `src/domain/selectors.js` | 🟢 |
| Testabilidade | Selectors reais devem ser acessíveis por internals. | `tests/unit/selectors-real.test.js` | 🟢 |

> Inferido do código. Validar performance com stores grandes porque alguns selectors assinam arrays completos.

## Critérios de Aceitação

```gherkin
Dado que um selector é chamado duas vezes com a mesma assinatura
Quando currentPeriodKey não muda
Então a segunda chamada deve retornar o valor memoizado

Dado que cacheSelectores possui mais de 120 entradas
Quando lerSelectorMemorizado calcula um novo valor
Então o cache deve ser limpo
E o valor atual deve ser reinserido

Dado um estado com addons por pessoa e tipo
Quando selecionarTotaisAddons for chamado
Então deve retornar porPessoa, porPessoaTipo e totalGeral consistentes

Dado menções NPS com rankSnapshot anterior
Quando selecionarRankingNps for chamado
Então cada item deve receber position e tendencia correta

Dado pendências com status mistos
Quando selecionarResumoPendencias for chamado
Então deve contar aberto, respondido e concluido
E deve identificar a pendência aberta mais antiga

Dado uma query de pendências
Quando selecionarPendenciasFiltradas for chamado
Então deve retornar apenas linhas cujo texto normalizado contém a query
E deve agrupar por status

Dado o dashboard renderizando gráficos
Quando selecionarDadosGraficosDashboard for chamado
Então deve retornar histórico, atendimentos, feedbackDistribuicao, addonRanking e metaMensalAtual
```

## Cenários de Borda

- 🟢 **Sem alunos:** taxas de feedback e positivas retornam `0`.
- 🟢 **Sem addons vendidos:** ranking de addons usa pessoas conhecidas com valores zerados para UI.
- 🟢 **Pessoa com tipo histórico fora de settings:** tipo ainda entra no total por `Object.keys(grupo)`.
- 🟢 **Período histórico legado sem addons/NPS:** líder histórico ignora falha e filtra período sem dados.
- 🟢 **NPS snapshot vazio:** tendências ficam estáveis.
- 🟢 **NPS item novo:** tendência vira `trend-new`.
- 🟢 **Evento sem dia válido:** agrupamento por dia ignora item inválido.
- 🟢 **Escala sem data ou data inválida:** cálculo de fim de semana pode não contar item como atenção.
- 🟢 **Histórico com mês ausente:** ponto histórico mantém label e `hasData=false`.
- 🟡 **Assinatura com objeto grande:** `JSON.stringify` pode custar mais que o cálculo em stores volumosos.
- 🔴 **Mutação sem limpar cache:** se uma mutação alterar objeto fora das assinaturas ou não limpar cache quando necessário, UI pode exibir derivado antigo.

## Prioridade

| Requisito | MoSCoW | Justificativa |
|---|---|---|
| Memoização por período e assinatura | Must | Base de performance e consistência dos selectors. |
| `selecionarIndicadoresDashboard()` | Must | Agregador principal da tela inicial. |
| Totais de addons | Must | Usado por dashboard, addons e ranking comercial. |
| Ranking NPS com tendências | Must | Fluxo central de NPS e histórico. |
| Pendências filtradas e resumidas | Must | Alimenta Kanban/dashboard operacional. |
| Dados de gráficos dashboard | Should | Importante para visão executiva. |
| Resumo de escala e eventos | Should | Apoia abas operacionais e alertas. |
| Líderes históricos | Could | Recurso de análise, não bloqueia operação atual. |
| Aliases legados | Could | Compatibilidade e conveniência. |

> Prioridade inferida por consumo direto nos renderizadores e testes reais.

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---|---|---|
| `src/domain/selectors.js` | `cacheSelectores`, `limparCacheSelectores`, `criarAssinaturaSelector`, `lerSelectorMemorizado` | 🟢 |
| `src/domain/selectors.js` | `selecionarTotaisAddons`, `totalAddonByPerson` | 🟢 |
| `src/domain/selectors.js` | `selecionarResumoRecepcionistas`, `itemsComFeedback`, `computeSummary` | 🟢 |
| `src/domain/selectors.js` | `selecionarLideresHistoricos` | 🟢 |
| `src/domain/selectors.js` | `selecionarResumoPendencias`, `selecionarPendenciasFiltradas`, `getOldestOpenPending` | 🟢 |
| `src/domain/selectors.js` | `selecionarRankingNps`, `totalNpsMentions` | 🟢 |
| `src/domain/selectors.js` | `selecionarDadosEventosAgrupados` | 🟢 |
| `src/domain/selectors.js` | `selecionarResumoEscala` | 🟢 |
| `src/domain/selectors.js` | `getShortPeriodLabel`, `getDashboardHistoryPeriodKeys`, `buildDashboardHistoryPoint`, `selecionarHistoricoDashboard` | 🟢 |
| `src/domain/selectors.js` | `selecionarDadosGraficosDashboard`, `selecionarIndicadoresDashboard`, `diffInDays` | 🟢 |
| `src/ui/render-dashboard.js` | consumo de indicadores e dados de gráficos | 🟢 |
| `src/ui/render-nps.js` | consumo de ranking e líderes históricos | 🟢 |
| `src/ui/render-pending.js` | consumo de pendências filtradas | 🟢 |
| `src/ui/render-scale.js` | consumo de resumo de escala | 🟢 |
| `src/ui/render-events.js` | consumo de eventos agrupados | 🟢 |
| `tests/unit/selectors-real.test.js` | validação de KPIs, filtros, ranking e memoização | 🟢 |
| `_reversa_sdd/flowcharts/domain.md` | fluxo de selector memoizado e indicadores | 🟢 |
| `_reversa_sdd/flowcharts/domain-selecionarRankingNps.md` | fluxo do ranking NPS | 🟢 |
