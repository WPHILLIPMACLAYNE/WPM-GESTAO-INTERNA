# WPM Gestão Interna — Aplicativo Finalizado

## Visão Geral

Sistema de gestão interna **WPM** criado por **Wallace Phillip Maclayne**. É um aplicativo SPA (Single Page Application) completo para controle de atendimentos, addons, pendências, NPS, escala e eventos da empresa.

- **Versão do app:** v34
- **Arquivo principal:** `SISTEMA_FINALIZADO.html` (HTML único com CSS + JS embutidos, ~12.700 linhas)
- **Autor:** Wallace Phillip Maclayne

## Funcionalidades

O sistema é organizado em **7 abas**:

| Aba | Descrição |
|---|---|
| **Dashboard** | Painel com indicadores gerais, totais de addons, resumo de recepionistas e pendências |
| **Alunos** | Cadastro e gestão de alunos com filtros e tabela pesquisável |
| **Pendências** | Gestão de pendências com quadro Kanban (drag & drop) e tabela |
| **NPS** | Ranking NPS com observações |
| **Escala** | Controle de escala de funcionários |
| **Eventos** | Registro e consulta de eventos |
| **Configurações** | Configurações do sistema, backup/restauração de dados |

## Arquitetura

- **SPA monolítico** — tudo em um único arquivo HTML (CSS + JS inline)
- **Tema escuro** com variáveis CSS customizadas (acentos em amarelo `#FFC20F`)
- **Persistência via `localStorage`** — dados salvos no navegador com versionamento de schema e migração
- **Responsivo** — projetado para desktop, tablet e mobile
- **Sem build step** — abre direto no navegador

## Estrutura do Projeto

```
APLICATIVO FINALIZADO/
├── SISTEMA_FINALIZADO.html   # Aplicação completa (HTML + CSS + JS)
├── package.json              # Dependências de dev (apenas Playwright)
├── package-lock.json
├── responsive-test.mjs       # Teste responsivo com Playwright (5 viewports)
├── visual-check.mjs          # Screenshots visuais com Playwright (5 viewports)
└── node_modules/             # Dependências instaladas
```

## Tecnologias

- **HTML5 / CSS3 / JavaScript (ES Modules inline)**
- **Playwright** — usado apenas para testes automatizados de responsividade
- **localStorage** — persistência de dados no navegador

## Comandos

### Instalar dependências (apenas para testes)

```bash
npm install
```

### Rodar teste responsivo

Verifica overflow horizontal, visibilidade da topbar, abas e conteúdo em 5 viewports (desktop, tablet, mobile):

```bash
node responsive-test.mjs
```

Screenshots salvos em `/tmp/screenshots/`.

### Rodar check visual

Captura screenshots de cada aba em cada viewport para inspeção visual:

```bash
node visual-check.mjs
```

### Abrir o aplicativo

Basta abrir `SISTEMA_FINALIZADO.html` em qualquer navegador moderno:

```bash
# No navegador
file:///home/acewallthemac/storage/APP%20SPA%20GESTAO%20WPM/APLICATIVO%20FINALIZADO/SISTEMA_FINALIZADO.html
```

## Estrutura Interna do JavaScript

O código JS expõe `window.__APP_INTERNALS__` com módulos internos para diagnóstico:

- **`config`** — chaves de storage, versão, constantes
- **`persistence`** — funções de leitura/escrita no localStorage
- **`schema`** — sanitização, normalização e migração de dados
- **`domain`** — seletores e cálculos de negócio (addons, NPS, eventos, escala)
- **`actions`** — operações de salvar, trocar período, importar/exportar
- **`rendering`** — funções de renderização de cada aba/seção
- **`ui`** — bindings de eventos, navegação por teclado, drag & drop
- **`diagnostics`** — smoke tests e diagnósticos do sistema

## Convenções Observadas

- Código em **português** (variáveis, funções, comentários)
- **CSS variables** para tema (dark mode com acentos amarelos)
- **`clamp()`** e **`vw`** para tipografia fluida
- **Drag & Drop** nativo no Kanban de pendências
- **Atalhos de teclado** para navegação entre abas (`Ctrl+1..7`, `Ctrl+F` para buscar)
- **BroadcastChannel** para sincronização entre abas do navegador
