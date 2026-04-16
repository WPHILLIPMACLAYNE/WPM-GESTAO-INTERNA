# UI_UX_OVERHAUL — Polish layer v1 do WPM Gestão Interna

Data: 2026-04-16
Escopo: consolidação de design system, microinterações, acessibilidade, estados vazios ricos e utilitário global de navegação.
Estratégia: **aditiva e não destrutiva**. Toda a maturidade visual pré-existente foi preservada; as novas regras entram por cascata no final de `styles.css` como uma camada de polimento independente.

---

## 1. Polish layer em `styles.css`

Adicionada no final de `styles.css` (≈ +871 linhas) sob o cabeçalho **WPM DESIGN SYSTEM POLISH LAYER v1**.

### Tokens estendidos
- Escala tipográfica `--font-2xs` → `--font-3xl`.
- Escala de espaçamento consistente.
- Escala de raios (`--radius-sm`/`md`/`lg`/`xl`).
- Sombras em camadas (`--shadow-xs` → `--shadow-xl`) + `--shadow-focus`.
- Motion tokens (`--motion-fast`/`base`/`slow`, `--ease-out`, `--ease-spring`).
- **Hierarquia de z-index com tokens** (`--z-sticky`, `--z-topbar: 40`, `--z-modal: 90`, etc.) corrigindo conflito pré-existente onde `.topbar` e `.modal` colidiam em `z-index: 20`.
- Tokens de superfícies (`--surface-1`/`--surface-2`/`--surface-3`).

### Componentes e estados
- `.btn.is-loading` com spinner automático.
- Hover/focus universal via `:focus-visible`.
- `.tab-btn.active::after` — barra indicadora dourada animada.
- `.table` com zebra striping, sombras de scroll horizontal (mobile) e `font-feature-settings: "tnum"` para numerais tabulares.
- `.modal` com sticky header/footer e blur no scroll.
- `.mini-stat` e `.card` com hover polido.
- `.pill--dot`, `.recados-counter`, `.divider`, `.link-accent` utilitários.
- Scrollbars finos (`scrollbar-width: thin`).
- Inputs com transição consistente em focus/hover.

### Estados vazios ricos
- `.empty strong` — título em destaque (15px, 800).
- `.empty small` — meta/label uppercase discreta.
- `.empty em` — destaque dourado não-itálico para palavras-chave de ação (ex: _Novo atendimento_, _Configurações_).
- `.empty.empty--compact` — variante densa para colunas/cards reduzidos.
- `.empty::before` — círculo glyph para contexto visual.

### Feedback transiente
- `tbody tr.just-saved` — highlight dourado que decai em ~1.2s.
- Skeleton loading utilities (`.skeleton`, `.skeleton-row`, `.skeleton-pill`).
- Toast polido com transições suaves.

### Acessibilidade
- `@media (prefers-reduced-motion: reduce)` — neutraliza todas as animações.
- `@media (prefers-contrast: more)` — aumenta contraste de bordas, pills e placeholders.
- `:focus-within` nos containers (ex: `.kanban-col`) para indicação visual clara.
- `font-feature-settings: "tnum"` em números de KPI/métrica → alinhamento vertical.

### Responsividade
- Densidade ajustada para `≤480px` (padding, font-size, sombras).
- Back-to-top reposicionado e redimensionado em mobile.
- Topbar com layout mobile limpo.

---

## 2. Estados vazios enriquecidos (JS)

Padrão aplicado: `<strong>Título</strong>Corpo explicativo com próxima ação em <em>destaque dourado</em>.`

| Arquivo | Linha | Contexto |
|---|---|---|
| `src/ui/render-students.js` | 72 | Tabela de atendimentos vazia |
| `src/ui/render-pending.js` | 49 | Tabela de pendências vazia |
| `src/ui/render-pending.js` | 83 | Coluna do kanban sem itens (variante compacta) |
| `src/ui/render-dashboard.js` | 519 | Lista de atendentes vazia |
| `src/ui/render-dashboard.js` | 538 | Gráfico de feedback sem dados |
| `src/ui/render-dashboard.js` | 556 | Overview de addons sem atendentes |
| `src/ui/render-dashboard.js` | 586 | Lista de pendências do dashboard vazia |
| `src/ui/render-events.js` | 209 | Lista de eventos/ações vazia |
| `src/ui/render-events.js` | 258 | Próximo evento ausente |
| `src/ui/render-events.js` | 264 | Tabela de agenda vazia |
| `src/ui/render-scale.js` | 50 | Turnos de um dia vazios |
| `src/ui/render-scale.js` | 224 | Tabela de escala vazia |
| `src/ui/render-scale.js` | 255 | Board de escala vazio |
| `src/ui/render-nps.js` | 187 | Ranking NPS sem citações |
| `src/ui/render-addons.js` | 45 | Grid de addons sem atendentes |

---

## 3. Back-to-top (utilitário global)

Componente flutuante discreto para views longas (Students, Events, Scale, Dashboard após scroll).

- **HTML**: `<button class="back-to-top">` imediatamente antes do `<script>` principal em `index.html:1027`.
- **JS**: IIFE em `index.html:1029-1042`. Threshold de 480px de scroll. Listener `passive: true`. Click com `scrollTo({ top: 0, behavior: 'smooth' })`.
- **CSS**:
  - `position: fixed; right: 18px; bottom: 84px`.
  - Aparece com `opacity` + `transform` suave.
  - Usa `--z-sticky` (menor que modais).
  - `:has(.modal.show) .back-to-top { opacity: 0 }` — não compete com diálogo aberto.
  - Mobile: reposicionado (`right: 12px; bottom: 72px`) e reduzido (`40px`).
  - `prefers-reduced-motion` → transição linear curta, sem transform.

---

## 4. Validação

| Check | Resultado |
|---|---|
| `node --check` em todos os render `src/ui/*.js` editados | **OK** (7/7) |
| Balanço de chaves `{ }` em `styles.css` | **1250/1250** |
| Estrutura do `index.html` (footer/script/body) | **íntegra** |
| Regressões em media queries Bug 2/Bug 3 | **preservadas** (@media 390/480/760 intactas) |

Playwright E2E/visual não foi executado — `node_modules` ausente no ambiente. Rodar `npm ci && npm run test:e2e && npm run test:visual` antes de publicação.

---

## 5. Arquivos tocados

```
index.html                     (+15)
src/ui/render-addons.js        (+1, -1)
src/ui/render-dashboard.js     (+4, -4)
src/ui/render-events.js        (+3, -3)
src/ui/render-nps.js           (+1, -1)
src/ui/render-pending.js       (+2, -2)
src/ui/render-scale.js         (+3, -3)
src/ui/render-students.js      (+1, -1)
styles.css                     (+871)
```

---

## 6. O que ficou de fora (débito deliberado)

- **Tokenização total**: tokens adicionados coexistem com valores hardcoded pré-existentes em regras legadas. Migração completa para tokens é trabalho incremental futuro.
- **Skeleton loading nos renders**: CSS pronto, mas os render functions ainda não emitem markup `.skeleton-*` durante carregamento. Pode ser plugado pontualmente em `renderDashboard` e `renderStudents` quando `state` ainda estiver em hidratação.
- **Field-error inline (`.field-error`)**: CSS pronto; uso opt-in em validação de formulário.
- **Teste visual**: screenshots pós-overhaul não foram capturados (Playwright não disponível localmente).

---

## 7. Como estender

Para adicionar um novo empty state rico:

```html
<div class="empty">
  <strong>Título curto e direto</strong>
  Corpo explicativo (1-2 linhas) que ajuda o usuário a entender
  o que está vazio e sugere a <em>próxima ação</em>.
</div>
```

Variante compacta (colunas estreitas, mini-cards):

```html
<div class="empty empty--compact">
  <strong>Sem itens</strong>
  Texto curto.
</div>
```

Para ações inline com estilo de link dourado: `<a class="link-accent">…</a>`.
Para botão flutuante de ação adicional no topo: copiar padrão do `.back-to-top`.
