# WPM Gestão Interna — Documentação Técnica

> **Versão:** v34 &nbsp;|&nbsp; **Autor:** Wallace Phillip Maclayne &nbsp;|&nbsp; **Licença:** Todos os direitos reservados

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Funcionalidades Principais](#2-funcionalidades-principais)
3. [Arquitetura Técnica](#3-arquitetura-técnica)
4. [Estrutura de Arquivos](#4-estrutura-de-arquivos)
5. [Dependências e Requisitos](#5-dependências-e-requisitos)
6. [Guia de Instalação e Uso](#6-guia-de-instalação-e-uso)
7. [API Interna](#7-api-interna)
8. [Persistência de Dados](#8-persistência-de-dados)
9. [Testes Automatizados](#9-testes-automatizados)
10. [Acessibilidade](#10-acessibilidade)
11. [Solução de Problemas](#11-solução-de-problemas)

---

## 1. Visão Geral do Sistema

### O que é

O **WPM Gestão Interna** é um aplicativo SPA (Single Page Application) de arquivo único, projetado para controle e gestão interna da recepção de academias da rede Smart Fit. O sistema centraliza em uma única interface todas as operações mensais de atendimento, vendas complementares, gestão de pendências, pesquisa de satisfação (NPS), escala de funcionários e registro de eventos.

### Público-alvo

- Recepionistas de academia
- Líderes de operação
- Gerentes de unidade

### Princípios de Design

| Princípio | Implementação |
|-----------|--------------|
| **Zero dependência de servidor** | Funciona 100% offline no navegador |
| **Arquivo único** | Sem build step, sem instalação — basta abrir no navegador |
| **Persistência local** | IndexedDB + localStorage com backup/export JSON |
| **Multi-período** | Cada mês é um período independente com dados isolados |
| **Responsivo** | Desktop (1440px), tablet (768-1024px) e mobile (360-760px) |

### Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5 + CSS3 + JavaScript ES6+ |
| Persistência | IndexedDB (primário) + localStorage (espelho/fallback) |
| Sync cross-tab | BroadcastChannel API |
| Testes | Playwright (Chromium headless) |
| Tema | Dark mode com CSS custom properties |

---

## 2. Funcionalidades Principais

### 2.1 Dashboard

Painel central com indicadores em tempo real do mês ativo:

| Indicador | Descrição |
|-----------|-----------|
| **Total de alunos** | Registros de atendimentos no mês |
| **Média geral de feedback** | Taxa de resposta dos atendimentos |
| **Feedback positivo** | Porcentagem de respostas positivas por recepcionista |
| **NPS atual** | Pontuação Net Promoter Score (0-100) com faixa de risco |
| **Pendências abertas** | Itens pendentes de resolução |
| **Próxima escala** | Data e resumo do próximo dia de escala |
| **Próximo evento** | Próximo evento ou ação programada |

**Insights automáticos:**
- Destaque em feedback (recepcionista com maior taxa positiva)
- Líder de addons (maior volume de vendas complementares)
- Líder NPS (funcionário mais citado nas menções)
- Urgência operacional (pendência aberta mais antiga)
- Progresso das metas mensal e semestral de NPS

**Indicadores visuais (Chart.js via CDN):**
- **Linha:** Evolução de alunos novos nos últimos 6 meses, lendo o storage por período
- **Barra:** Atendimentos por recepcionista no mês ativo
- **Doughnut:** Distribuição dos feedbacks do mês ativo entre Respondeu, Pendente e Não respondeu
- **Linha com área:** Tendência de NPS dos últimos 6 meses com linha de meta mensal tracejada
- **Barra horizontal:** Ranking dos top vendedores de addons do mês ativo

**Painel de Recados:** Sistema de comunicação entre turnos com status de leitura (lido/não lido).

### 2.2 Alunos (Atendimentos)

Cadastro e gestão de atendimentos com:

- **Campos:** Nome, matrícula, data/hora da visita, início do plano, aviso NPS, recepcionista, feedback, addon vendido, observações
- **Edição inline:** Data de visita e horário editáveis diretamente na tabela
- **Filtros:** Busca textual, filtro por recepcionista e status de feedback
- **Resumo:** Total de alunos, atendimentos por recepcionista, feedbacks respondidos/pendentes, addons vendidos

### 2.3 Addons

Acompanhamento de vendas complementares por recepcionista:

- **Grid visual:** Barras diárias por tipo de addon (ex: aval físico, treino personalizado)
- **Histórico preservado:** Addons de recepcionistas removidos são mantidos em modo leitura
- **Ranking:** Top vendedores do mês com posição e total

### 2.4 Pendências

Gestão de ocorrências com quadro Kanban e tabela:

- **Status:** Aberto → Respondido → Concluído
- **Drag & Drop:** Arraste cards entre colunas para atualizar status
- **Campos:** Nome, matrícula, descrição da pendência, data, recepcionista responsável, resposta, status
- **Exportação:** CSV com todos os registros
- **Indicadores:** Cards com contagem por status + total

### 2.5 NPS (Net Promoter Score)

Pesquisa de satisfação com:

- **Score:** Input numérico (0-100) com medidor visual de risco (5 faixas)
- **Metas:** Configuração de meta mensal e semestral com barra de progresso
- **Menções:** Registro de funcionários citados pelos alunos
- **Ranking:** Ordenação por quantidade de citações com indicadores de tendência (↑ subiu, ↓ caiu, → estável, ★ novo)
- **Histórico:** Evolução do NPS dos meses anteriores
- **Observações:** Campo de texto livre com auto-save (debounce 800ms)
- **Líderes históricos:** Destaques de addons e NPS dos meses anteriores

### 2.6 Escala

Gestão de escalas de trabalho:

- **Matriz visual:** Calendário mensal com dias da semana
- **Turnos múltiplos:** Professor(es) + Recepção por dia
- **Trocas:** Campo para registrar substituições
- **Código de cores:** Verde (sábado), Vermelho (feriado), Neutro (dia normal)
- **Duplicação:** Copiar escala do mês anterior
- **Exportação:** CSV completo

### 2.7 Eventos / Ações

Registro de eventos, campanhas e treinamentos:

- **Tipos:** Evento, Ação, Campanha, Treinamento, Feriado, Outro
- **Status:** Programado, Confirmado, Concluído, Cancelado
- **Calendário visual:** Grid mensal com indicadores coloridos por tipo
- **Lista consolidada:** Tabela filtrável por tipo e status
- **Próximos eventos:** Cards destacados com contagem regressiva

### 2.8 Configurações

Central de administração do sistema:

- **Equipe:** Cadastro de recepcionistas, professores e tipos de addon (textarea com um nome por linha)
- **Bootstrap de períodos:** Toggle para decidir se meses novos começam com massa determinística de teste ou vazios
- **Barra de saúde:** Status do armazenamento, meses com dados, último backup, total de registros
- **Backup/Restauração:**
  - Exportar backup JSON completo (todos os períodos)
  - Importar backup JSON (substitui dados atuais)
  - Fechar mês (gera arquivo de fechamento e abre próximo mês)
  - Resetar mês (com backup automático pré-reset)
  - Snapshot local (salva/restaura estado rapidamente)
- **Manutenção:** Limpeza de meses vazios
- **Validação:** Diagnósticos automáticos da integridade dos dados
- **Autotestes:** Simulação de backup, reset e exportações sem alterar dados reais
- **Painel técnico de persistência:** Status do IndexedDB, broadcast, autoteste de escrita/leitura
- **Auditoria de períodos:** Lista de todos os meses com métricas e status (vazio/completo/revisar)

---

## 3. Arquitetura Técnica

### 3.1 Camadas do Código

O JavaScript está organizado em 8 camadas lógicas (ver comentário "Mapa da arquitetura" no início do `<script>`):

```
┌─────────────────────────────────────────────┐
│  1. CONSTANTES & CONFIGURAÇÃO               │  Chaves de storage, versões, defaults
├─────────────────────────────────────────────┤
│  2. ARMAZENAMENTO / PERSISTÊNCIA            │  IndexedDB, localStorage, cache, broadcast
├─────────────────────────────────────────────┤
│  3. SCHEMA / MIGRAÇÃO / SANITIZAÇÃO         │  Versionamento, normalização, limpeza
├─────────────────────────────────────────────┤
│  4. LÓGICA DE DOMÍNIO / SELECTORS           │  Memoized queries, cálculos de negócio
├─────────────────────────────────────────────┤
│  5. TRANSIÇÕES DE ESTADO / AÇÕES            │  applyStudentSave, switchPeriod, etc.
├─────────────────────────────────────────────┤
│  6. RENDERIZAÇÃO                            │  renderHero, renderDashboard, etc.
├─────────────────────────────────────────────┤
│  7. UI / EVENTOS / ACESSIBILIDADE           │  Delegação, atalhos, modais, DnD
├─────────────────────────────────────────────┤
│  8. DIAGNÓSTICOS / TESTES                   │  Smoke tests, auditoria, relatórios
└─────────────────────────────────────────────┘
```

### 3.2 Sistema de Renderização

```
Alteração de dados
       │
       ▼
  saveData() ──► persistStoredJson() ──► IndexedDB
       │                                      │
       ▼                                      ▼
  requestRender()                     storageCache.set()
       │                                      │
       ▼                                      ▼
  requestAnimationFrame()              BroadcastChannel
       │                                      │
       ▼                                      ▼
  executarRenderAgendado()            Outras abas recarregam
       │
       ▼
  renderSections(dirty set)
       │
       ▼
  aplicarHtmlSeMudou() ──► Hash comparison ──► Só atualiza se mudou
```

### 3.3 Memoization de Selectors

Selectors caros são memoizados com assinatura hash dos dados de entrada:

```javascript
selecionarTotaisAddons()     → Cache por período + pessoas + tipos + dados
selecionarResumoRecepcionistas() → Cache por recepcionistas + alunos + addons
selecionarRankingNps()       → Cache por mentions + snapshot + score
selecionarIndicadoresDashboard() → Cache por todas as collections
```

Limite de 120 entradas no cache para evitar memory leaks.

---

## 4. Estrutura de Arquivos

```
APLICATIVO FINALIZADO/
│
├── SISTEMA_FINALIZADO.html      # Aplicação completa (~12.700 linhas)
│   ├── <head>
│   │   ├── Meta tags (viewport, theme-color, description)
│   │   └── <style>              # CSS completo (~4.500 linhas)
│   │       ├── Variables (:root)
│   │       ├── Reset e base
│   │       ├── Componentes (btn, card, pill, modal, toast...)
│   │       ├── Layout (topbar, hero, tabs, grids)
│   │       ├── Seções (dashboard, students, pending, nps, scale, events, settings)
│   │       ├── Animações (cardPop, fadeSlideIn, pulse)
│   │       └── Media queries (1440, 1380, 1260, 1180, 1100, 900, 760, 560px)
│   ├── <body>
│   │   ├── Topbar (brand, period selectors, actions)
│   │   ├── Hero (mini-stat cards)
│   │   ├── Tabs navigation (7 abas)
│   │   ├── Views (dashboard, students, addons, pending, nps, scale, events, settings)
│   │   ├── Modals (student, pending, scale, event, confirm)
│   │   ├── Tooltip global
│   │   ├── Toasts (save, alert)
│   │   ├── Live regions (aria-live polite/assertive)
│   │   └── Footer (autoria)
│   └── <script>                  # JavaScript completo (~8.000 linhas)
│       ├── Configuração e constantes
│       ├── Camada de persistência (IndexedDB + localStorage)
│       ├── Schema, migração e sanitização
│       ├── Lógica de domínio (selectors memoizados)
│       ├── Ações e transições de estado
│       ├── Funções de renderização
│       ├── Bindings de UI e eventos
│       ├── Diagnósticos e testes
│       └── Inicialização
│
├── package.json                 # Dependências de desenvolvimento
├── package-lock.json            # Lockfile do npm
├── responsive-test.mjs          # Teste de responsividade (Playwright)
├── visual-check.mjs             # Screenshots visuais (Playwright)
├── QWEN.md                      # Documentação de contexto do projeto
└── node_modules/                # Dependências instaladas
    └── playwright/
```

### Detalhamento do `SISTEMA_FINALIZADO.html`

| Seção | Linhas aprox. | Conteúdo |
|-------|--------------|----------|
| CSS `:root` variables | 1–40 | Tokenização de cores, espaçamento, tipografia |
| CSS base e componentes | 40–950 | Buttons, inputs, tables, cards, modals, pills |
| CSS layout | 950–2000 | Topbar, hero, grids, kanban, schedule matrix |
| CSS media queries | 2000–4900 | 8 breakpoints responsivos |
| HTML estrutura | 3000–6100 | Topbar, abas, views, modals, footer |
| JS configuração | 6100–6350 | Constantes, DOM helper, chaves de storage |
| JS persistência | 6350–7000 | IndexedDB wrapper, cache, broadcast, fila |
| JS schema/migração | 7000–7700 | Sanitização, normalização, migração V1→V4 |
| JS domínio/selectors | 7700–9200 | Memoized queries, indicadores, filtros |
| JS renderização | 9200–11500 | Todas as funções `render*` |
| JS UI/eventos | 11500–12400 | Delegação, modais, tooltips, atalhos, DnD |
| JS inicialização | 12400–12702 | Boot sequence e `__APP_INTERNALS__` |

---

## 5. Dependências e Requisitos

### Requisitos do Navegador

| Recurso | Necessário | Notas |
|---------|-----------|-------|
| **IndexedDB** | ✅ Sim | Backend principal de persistência |
| **localStorage** | ✅ Sim | Espelho e fallback |
| **BroadcastChannel** | ⚠️ Opcional | Sync entre abas (graceful degradation) |
| **structuredClone** | ✅ Sim | Clonagem profunda de objetos |
| **crypto.randomUUID** | ✅ Sim | Geração de IDs únicos |
| **Intl.DateTimeFormat** | ✅ Sim | Formatação de datas em pt-BR |
| **CSS custom properties** | ✅ Sim | Tema e variáveis |
| **`<template>`** | ⚠️ Opcional | Usado internamente para patching |

### Navegadores Suportados

| Navegador | Versão Mínima | Notas |
|-----------|--------------|-------|
| Chrome / Edge | 92+ | Suporte total |
| Firefox | 90+ | Suporte total |
| Safari | 15.4+ | Suporte total (exceto BroadcastChannel em iframes) |
| Mobile Chrome | 92+ | Suporte total |
| Mobile Safari (iOS) | 15.4+ | Suporte total |

### Dependências de Desenvolvimento

```jsonc
{
  "playwright": "^1.59.1"   // Apenas para testes automatizados
}
```

**Dependências de produção:** Nenhuma. O arquivo HTML é 100% autocontido.

### Requisitos de Sistema

| Item | Mínimo | Recomendado |
|------|--------|-------------|
| RAM | 2 GB | 4 GB |
| Espaço em disco | 50 MB (para dados locais) | 200 MB |
| Resolução | 360×800 (mobile) | 1440×900 (desktop) |

---

## 6. Guia de Instalação e Uso

### 6.1 Uso Imediato (sem instalação)

1. **Abra o arquivo no navegador:**
   ```bash
   # Linux
   xdg-open "SISTEMA_FINALIZADO.html"

   # macOS
   open "SISTEMA_FINALIZADO.html"

   # Windows
   start "SISTEMA_FINALIZADO.html"
   ```

2. **Ou simplesmente dê duplo clique** no arquivo `SISTEMA_FINALIZADO.html`

3. **Pronto.** Em `localhost/dev`, o sistema inicia com massa determinística de teste por padrão. Em `file://` e produção, meses novos começam vazios até você ativar o toggle correspondente em **Configurações**.

### 6.2 Instalação das Dependências de Teste

Para rodar os testes automatizados de responsividade:

```bash
# Acesse o diretório
cd "storage/APP SPA GESTAO WPM/APLICATIVO FINALIZADO"

# Instale as dependências
npm install

# Instale os browsers do Playwright
npx playwright install chromium
```

### 6.3 Rodando os Testes

**Teste de responsividade (5 viewports):**
```bash
node responsive-test.mjs
```
Verifica:
- Overflow horizontal
- Visibilidade da topbar
- Acessibilidade das 7 abas
- Renderização de conteúdo por viewport

**Screenshots visuais:**
```bash
node visual-check.mjs
```
Gera screenshots de cada aba em cada viewport em `/tmp/screenshots/`.

### 6.4 Primeiros Passos no Sistema

#### Passo 1 — Configurar a Equipe
1. Acesse a aba **Configurações**
2. Edite os campos:
   - **Recepcionistas:** Um nome por linha
   - **Professores:** Um nome por linha
   - **Tipos de Addon:** Um tipo por linha
3. Clique em **Salvar configurações**

#### Passo 2 — Registrar Atendimentos
1. Acesse a aba **Alunos**
2. Clique em **+ Novo atendimento**
3. Preencha: Nome, matrícula, recepcionista, addon (se houver)
4. Clique em **Salvar atendimento**

#### Passo 3 — Registrar Addons Diários
1. Acesse a aba **Addons**
2. Em cada recepcionista, preencha os valores diários por tipo
3. Os totais atualizam automaticamente

#### Passo 4 — Gerenciar Pendências
1. Acesse a aba **Pendências**
2. Clique em **+ Nova pendência**
3. Arraste os cards no Kanban para atualizar o status

#### Passo 5 — Acompanhar NPS
1. Acesse a aba **NPS**
2. Ajuste a pontuação (input ou slider)
3. Adicione menções a funcionários
4. Defina metas mensal e semestral

#### Passo 6 — Configurar Escala
1. Acesse a aba **Escala**
2. Clique em um dia no calendário ou em **+ Adicionar dia**
3. Preencha professores, recepção e observações
4. Salve

#### Passo 7 — Registrar Eventos
1. Acesse a aba **Eventos**
2. Clique em **+ Novo evento/ação**
3. Preencha data, tipo, título, local, responsável
4. Salve

### 6.5 Backup e Restauração

**Exportar backup:**
1. Vá para **Configurações**
2. Clique em **Exportar backup JSON**
3. O arquivo será baixado automaticamente

**Importar backup:**
1. Vá para **Configurações**
2. Clique em **Importar backup** ou selecione o arquivo
3. Confirme a substituição dos dados

**Fechar mês:**
1. Vá para **Configurações**
2. Clique em **Fechar mês**
3. O arquivo de fechamento será baixado
4. O próximo mês é aberto automaticamente

### 6.6 Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl + 1` a `Ctrl + 7` | Navegar para aba específica |
| `Ctrl + F` | Focar campo de busca na aba ativa |
| `Arrow Left / Right` | Navegar entre abas (com foco na tab) |
| `Home / End` | Ir para primeira/última aba |
| `Escape` | Fechar modal ativo |
| `/` | Focar busca global |

---

## 7. API Interna

O sistema expõe `window.__APP_INTERNALS__` para diagnóstico e uso avançado via console do navegador.

### Estrutura

```javascript
window.__APP_INTERNALS__ = {
  config: {
    STORAGE_KEY,        // Chave principal no IndexedDB
    STORE_VERSION,      // Versão atual do schema (4)
    APP_VERSION,        // Versão do app ('v34')
    MONTH_NAMES,        // Array de nomes de meses em pt-BR
    APP_DEFAULTS        // Valores padrão para recepcionistas, professores, addons
  },

  persistence: {
    readStoredValue,    // Ler valor do storage
    readStoredJson,     // Ler e parsear JSON
    writeStoredValue,   // Escrever valor
    writeStoredJson,    // Escrever objeto como JSON
    removeStoredValue,  // Remover chave
    loadStore,          // Carregar store completo
    saveStore,          // Salvar store completo
    saveData            // Salvar estado atual
  },

  schema: {
    sanitizeDeep,       // Sanitização recursiva
    sanitizeUIState,    // Sanitizar estado da UI
    normalizeData,      // Normalizar dados do período
    normalizeStore,     // Normalizar store completo
    migrateStore,       // Executar migrações pendentes
    sanitizeStore,      // Sanitizar + normalizar
    buildCleanPeriodFromTemplate,  // Criar período limpo
    buildEmptyPeriodFromTemplate,  // Alias para buildCleanPeriodFromTemplate
    resetPeriodData     // Resetar dados de um período
  },

  domain: {
    getReceptionists,           // Lista de recepcionistas ativos
    getProfessors,              // Lista de professores ativos
    getAllEmployees,            // Todos os funcionários
    selecionarTotaisAddons,     // Totais de addons por pessoa
    selecionarResumoRecepcionistas,  // Resumo por recepcionista
    selecionarResumoPendencias,      // Contagem e itens de pendências
    selecionarRankingNps,            // Ranking de menções NPS
    selecionarDadosEventosAgrupados, // Eventos agrupados por dia
    selecionarResumoEscala,          // Resumo da escala
    selecionarIndicadoresDashboard,  // Todos os KPIs do dashboard
    computeSummary,                  // Resumo geral
    getPeriodMetrics                 // Métricas de um período
  },

  actions: {
    applyStudentSave,       // Salvar atendimento (validação + upsert)
    applyPendingSave,       // Salvar pendência
    applyEventSave,         // Salvar evento
    switchPeriod,           // Trocar período ativo
    resetPeriodData,        // Resetar dados do período
    saveSettings,           // Salvar configurações da equipe
    resizeMonth,            // Redimensionar dias do mês
    saveLocalSnapshot,      // Salvar snapshot local
    restoreLocalSnapshot,   // Restaurar snapshot local
    applyImportedStore      // Aplicar backup importado
  },

  rendering: {
    AREAS_RENDERIZACAO,  // ['hero','dashboard','students','addons','pending','nps','scale','events','settings']
    estadoRenderizacao,  // Estado interno do agendador
    requestRender,       // Agendar renderização (dirty + rAF)
    limparFilaRender,    // Limpar fila de renderização
    renderSection,       // Renderizar uma seção
    renderSections,      // Renderizar múltiplas seções
    renderAll,           // Renderizar tudo
    // + funções render* individuais
  },

  ui: {
    DOM,                        // Helper de acesso ao DOM
    bindUIEvents,               // Vincular todos os eventos
    initUIBindings,             // Inicializar bindings de filtros
    initializeStaticControls,   // Inicializar controles estáticos
    bindTabKeyboardNavigation,  // Navegação por teclado das abas
    bindModalBackdropClose,     // Fechar modal ao clicar no backdrop
    bindGlobalKeyboardShortcuts,// Atalhos globais (Ctrl+1..7, Esc, /)
    bindStorageSync             // Sincronização cross-tab
  },

  diagnostics: {
    runSystemDiagnostics,   // Validar integridade dos dados
    runFlowSmokeTests,      // Autotestes de backup/reset/export
    renderDiagnosticsPanel, // Renderizar painel de diagnósticos
    renderFlowSmokePanel,   // Renderizar painel de autotestes
    renderPeriodAudit       // Renderizar auditoria de períodos
  }
};
```

### Exemplo de Uso no Console

```javascript
// Ver indicadores do dashboard
const indicadores = window.__APP_INTERNALS__.domain.selecionarIndicadoresDashboard();
console.log(indicadores);

// Forçar renderização de uma seção
window.__APP_INTERNALS__.rendering.requestRender(['dashboard']);

// Ver métricas do período atual
const metrics = window.__APP_INTERNALS__.domain.getPeriodMetrics();
console.log(metrics);

// Executar diagnósticos silenciosos
window.__APP_INTERNALS__.diagnostics.runSystemDiagnostics(true);
```

---

## 8. Persistência de Dados

### 8.1 Camada Híbrida

```
┌──────────────────────────────────────────────────┐
│              Aplicação (estado em memória)       │
│                      │                           │
│         storageCache (Map) ← leituras síncronas  │
│                      │                           │
│    ┌─────────────────┼─────────────────┐         │
│    ▼                 ▼                 ▼         │
│  IndexedDB      localStorage     Broadcast      │
│  (primário)     (espelho)        Channel        │
└──────────────────────────────────────────────────┘
```

### 8.2 Chaves de Armazenamento

| Chave | Conteúdo | Backend |
|-------|----------|---------|
| `recepcao-smartfit-dashboard-v34` | Store principal (todos os períodos) | IndexedDB + localStorage |
| `controle_recepcao_app_snapshot_v34` | Último snapshot local | localStorage |
| `controle_recepcao_app_report_v34` | Relatório de diagnósticos | localStorage |
| `controle_recepcao_app_flowtests_v34` | Relatório de autotestes | localStorage |
| `controle_recepcao_app_ui_v34` | Estado da UI (filtros, aba ativa) | localStorage |
| `recepcao-smartfit-dashboard-sync-v34` | Broadcast de sincronização | BroadcastChannel |

### 8.3 Estrutura do Store

```javascript
{
  version: 4,                          // Versão do schema
  activePeriod: "2026-04",             // Período ativo
  preferences: {                       // Preferências globais do bootstrap
    initializeMonthsWithTestData: false
  },
  periods: {
    "2026-04": {                       // Dados do mês
      settings: { receptionists, professors, team, addonTypes, monthDays },
      students: [{ id, nome, matricula, ultimaVisita, horaVisita, inicio, avisoNps, atendimento, feedback, addon, observacoes }],
      pending: [{ id, nome, matricula, pendencia, data, hostess, resposta, status }],
      recados: [{ id, from, to, text, createdAt, read }],
      nps: { score, monthlyGoal, semesterGoal, observations, mentions: [{ id, name, count }], rankSnapshot: {} },
      scale: [{ id, date, rowTone, professorShifts: [{ id, time, name, swap }], receptionTime, receptionist, receptionSwap, note }],
      events: [{ id, date, time, type, title, place, owner, status, description }],
      addons: { "Nome": { "Tipo": [valor_por_dia] } }
    }
  },
  archives: {
    "2026-03": { closedAt: "...", closedAtLabel: "...", label: "..." }
  }
}
```

### 8.4 Migração de Schema

| Versão | Mudança |
|--------|---------|
| **V1** | Baseline inicial |
| **V2** | Adição do campo `events` |
| **V3** | Adição de `nps.mentions` |
| **V4** | Placeholder para próxima migração real |

Migrações são executadas automaticamente ao carregar dados de versões anteriores.

### 8.5 Limites

| Limite | Valor | Comportamento ao atingir |
|--------|-------|-------------------------|
| localStorage | ~5-10 MB | Toast de alerta + fallback para IndexedDB |
| IndexedDB | ~50% do disco livre | Depende do navegador |
| Import de arquivo | 50 MB | Rejeitado com toast de erro |
| Cache de selectors | 120 entradas | Limpeza automática (LRU) |

---

## 9. Testes Automatizados

### 9.1 Teste de Responsividade (`responsive-test.mjs`)

Testa o app em 5 viewports:

| Viewport | Resolução | Dispositivo |
|----------|-----------|-------------|
| `desktop-1440` | 1440×900 | Desktop padrão |
| `tablet-portrait` | 1024×1366 | iPad em pé |
| `tablet-landscape` | 820×1180 | iPad deitado |
| `iphone-14` | 390×844 | iPhone 14 |
| `android-small` | 360×800 | Android genérico |

**Verificações por viewport:**
1. Sem overflow horizontal
2. Topbar visível
3. Todas as 7 abas acessíveis
4. Conteúdo de cada aba visível após clique
5. Font-size de inputs (16px em mobile para evitar zoom)
6. Tabela de pendências com min-width adequado
7. Colunas do Kanban presentes

**Saída:**
```
========== SUMMARY ==========
✅ No issues detected across all viewports.
// ou
⚠️  3 issue(s) found:
  [iphone-14] page: Horizontal overflow: scrollWidth=420 > clientWidth=390
  [tablet-portrait] tabs: Only 5 tab buttons found (expected 7+)
  ...
```

### 9.2 Check Visual (`visual-check.mjs`)

Captura screenshots de cada aba em cada viewport para inspeção manual:

```
/tmp/screenshots/
├── desktop-1440_dashboard.png
├── desktop-1440_students.png
├── ...
├── iphone-390_events.png
└── android-360_settings.png
```

### 9.3 Autotestes Internos (via aba Configurações)

O sistema possui autotestes embutidos que validam:

| Teste | O que verifica |
|-------|---------------|
| **Round-trip de backup JSON** | Serialização e desserialização preservam dados |
| **Exportação CSV de pendências** | Gera linhas de dados válidas |
| **Exportação CSV de escala** | Gera turnos exportados |
| **Exportação CSV de eventos** | Gera eventos exportados |
| **Reset do mês em simulação** | Zera todos os contadores corretamente |
| **Cobertura anual mínima** | Pelo menos 12 períodos disponíveis |

### 9.4 Validação do Sistema (via aba Configurações)

Diagnósticos automáticos verificam:

| Verificação | Critério de aprovação |
|------------|----------------------|
| Estrutura principal do armazenamento | Período ativo disponível |
| Atendimentos vinculados a recepcionistas | 100% dos registros válidos |
| Pendências vinculadas a recepcionistas | 100% com hostess válida |
| Cobertura de NPS | Todos os funcionários aparecem nas citações |
| Massa de teste do período | ≥30 alunos, ≥20 pendências, ≥10 eventos, escala > 0 |
| Cobertura anual carregada | ≥12 períodos disponíveis |
| Snapshot local disponível | Existe snapshot para restauração |

---

## 10. Acessibilidade

### Recursos Implementados

| Recurso | Implementação |
|---------|--------------|
| **Skip link** | `.skip-link` aparece ao focar com Tab |
| **ARIA live regions** | 3 zonas: `polite`, `assertive`, `role="alert"` |
| **Gerenciamento de foco em modais** | Foco salvo ao abrir, restaurado ao fechar |
| **Navegação por teclado nas abas** | `ArrowLeft/Right`, `Home`, `End` (WAI-ARIA Tabs Pattern) |
| **Focus visible** | Outline amarelo em todos elementos interativos |
| **Validação acessível** | `aria-invalid="true"` + feedback auditivo via live region |
| **Labels em inputs** | `aria-label` em inputs de tabela |
| **Drag & Drop com alternativa por teclado** | Botões de ação para mover pendências sem mouse |
| **Modais semânticos** | `role="dialog"`, `aria-modal="true"`, `aria-hidden` |
| **Tooltips via teclado** | Disparados também por `focusin`/`focusout` |

### Atalhos de Acessibilidade

| Tecla | Comportamento |
|-------|--------------|
| `Tab` | Navegação sequencial |
| `Shift+Tab` | Navegação reversa |
| `Escape` | Fechar modal ativo + retornar foco |
| `Arrow keys` nas abas | Navegação entre tabs |

---

## 11. Solução de Problemas

### Problemas Comuns

#### "Armazenamento local cheio"

**Sintoma:** Toast vermelho avisando que o armazenamento está cheio.

**Solução:**
1. Vá para **Configurações** → **Exportar backup JSON**
2. Em **Manutenção**, clique em **Limpar meses vazios**
3. Se persistir, resete o mês atual (com backup prévio)

#### "Dados não aparecem após abrir em outra aba"

**Sintoma:** Abriu uma nova aba e os dados não estão sincronizados.

**Solução:**
- Aguarde alguns segundos — o BroadcastChannel sincroniza automaticamente
- Se não funcionar, recarregue a página (F5)
- Verifique se o navegador suporta BroadcastChannel

#### "Erro ao inicializar a aplicação"

**Sintoma:** Toast vermelho "Falha ao inicializar os dados do aplicativo."

**Solução:**
1. Abra o console do navegador (F12)
2. Procure por erros em vermelho
3. Se for corrupção de dados:
   - O app salva um backup corrompido com sufixo `_corrompido_<timestamp>`
   - Importe o último snapshot em **Configurações** → **Restaurar snapshot local**

#### "Kanban de pendências não permite arrastar"

**Sintoma:** Cards não respondem a drag & drop.

**Solução:**
- Use os botões de editar pendência e alterar o status manualmente
- Verifique se o navegador suporta Drag and Drop API

#### "Filtros não atualizam a tabela"

**Sintoma:** Digita na busca mas a tabela não muda.

**Solução:**
- Os filtros têm debounce de 150ms — aguarde um instante
- Verifique o console para erros de JavaScript

### Como Exportar Dados para Suporte

1. **Configurações** → **Exportar backup JSON**
2. **Configurações** → **Validar sistema** → Copie o relatório do console
3. Envie o arquivo JSON + screenshot do problema

### Logs e Diagnósticos

O sistema gera logs no console do navegador em situações específicas:

```
console.error → Falhas de persistência, corrupção de dados
console.warn  → Broadcast falhou, fallback ativado
console.log   → Diagnósticos de inicialização (se habilitados)
```

Para acesso avançado, use `window.__APP_INTERNALS__` no console.

---

## Apêndice A — Glossário

| Termo | Significado |
|-------|------------|
| **Addon** | Serviço complementar vendido (aval físico, treino personalizado, etc.) |
| **Hostess** | Recepcionista responsável pela pendência |
| **NPS** | Net Promoter Score — métrica de satisfação do cliente (0-100) |
| **Período** | Mês de referência no formato `YYYY-MM` (ex: `2026-04`) |
| **Recado** | Mensagem entre turnos de recepcionistas |
| **Store** | Estrutura principal de dados (todos os períodos + archives) |
| **Snapshot** | Cópia pontual do estado do app salva localmente |

## Apêndice B — Histórico de Versões

| Versão | Data | Mudanças |
|--------|------|----------|
| **v34** | 2026 | Versão atual. Multi-período, IndexedDB, Kanban, NPS avançado, recados, diagnósticos |
| **v33** | — | Versão legada (chave migrada automaticamente) |
| **v24** | — | Versão legada (chave migrada automaticamente) |

## Apêndice C — Créditos

| Item | Detalhe |
|------|---------|
| **Autor** | Wallace Phillip Maclayne |
| **Copyright** | © 2024–2026 Wallace Phillip Maclayne |
| **Engenharia assistida** | Claude (Anthropic) |
| **Tecnologia** | HTML/CSS/JS vanilla, persistência híbrida IndexedDB + localStorage |
