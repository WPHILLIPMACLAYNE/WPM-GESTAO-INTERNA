# DIAGNÓSTICO MOBILE — Bug 2 e Bug 3

Data: 2026-04-10
Commit base: `865586c`
Método: Playwright headless + screenshots reais + medições de bounding box + análise CSS
Servidor local: `npx serve . -p 3000`
Dataset injetado: 4 atendentes (Wallace, Emilia, Gessica, Maickon) com registros de alunos, feedback e addons no mês ativo

---

## Viewports testadas

| Viewport | Largura container `#summaryList` | Canvas `#feedbackChart` |
|---|---|---|
| 390×844 | 344px | 306px |
| 480×854 | 434px | 396px |
| 760×900 | 702px | 664px |

---

## Bug 2 — Valores sobrepostos nos cards de atendente

### Veredito: CONFIRMADO

### Screenshots

**390×844** — `Screenshots/diag-390x844-summaryList.png`

Valores Feedback% e Addons colados: "86%4", "60%2", "62%7", "40%5".
Labels "FEEDBACK" e "ADDONS" fundidas em "FEEDBACKADDONS".
Coluna "Vs Média" (+22pts / -3pts) salta para linha acima do grid.

**480×854** — `Screenshots/diag-480x854-summaryList.png`

Mesmo padrão, ligeiramente menos grave: "86% 4", "60% 2", "62% 7", "40% 5" ainda colados.
"FEEDBACKADDONS" ainda fundido. "Vs Média" ainda sangra fora do grid.

**760×900** — `Screenshots/diag-760x900-summaryList.png`

Sem sobreposição. Todas as colunas visíveis e separadas: TOTAL / FEEDBACK / ADDONS / POSITIVO / VS MÉDIA.

### Medições de bounding box (390×844)

| Atendente | Overlaps detectados | `.metric` com scrollWidth > clientWidth |
|---|---|---|
| Wallace | 22 | Feedback, Addons, Positivo, Vs Média |
| Emilia | 22 | Feedback, Addons, Positivo, Vs Média |
| Gessica | 22 | Feedback, Addons, Positivo, Vs Média |
| Maickon | 22 | Feedback, Addons, Positivo, Vs Média |

> Nota: o contador de overlaps inclui pares pai–filho (`.metric` + `<strong>` + `<span>`). O overlap visualmente relevante é entre colunas `.metric` irmãs, confirmado pelas screenshots.

### Causa raiz — CSS

Regra do Dashboard (sem breakpoint de override para mobile):

```css
#dashboard .summary-item--dashboard-person {
  grid-template-columns: minmax(0, 1.35fr) repeat(5, minmax(0, .72fr));
  align-items: center;
  gap: 16px;
  overflow: visible;          /* ← permite sangramento visual */
}
```

Com container de 344px (390×844):

- Total de gaps: 5 × 16px = 80px
- Espaço disponível: 344 − 80 = 264px distribuídos em 6 colunas (fr ratio total: 1,35 + 5×0,72 = 4,95)
- Coluna nome: 1,35/4,95 × 264 ≈ **72px**
- Cada coluna métrica: 0,72/4,95 × 264 ≈ **38px**

Conteúdo de cada `.metric`: número com `font-size: clamp(24px, 2vw, 28px)` (≥ 24px) + label como "FEEDBACK" em 12px uppercase com `letter-spacing: .06em` (≈ 70px). Não cabe em 38px.

Agravante: `#dashboard .metric { overflow: visible }` — seletor mais específico sobrescreve o override global de estabilidade:

```css
/* v5 stability override — especificidade 0-1-0, sobrescrito abaixo */
.metric { overflow: hidden; }

/* Dashboard override — especificidade 1-1-0, vence */
#dashboard .metric { overflow: visible; }
#dashboard .metric span { white-space: normal; overflow: visible; text-overflow: clip; }
```

Com `overflow: visible`, o conteúdo de cada `.metric` sangra sobre a coluna adjacente, causando a sobreposição visual relatada.

Em 760px (702px de container), cada coluna métrica recebe ≈ 90px → conteúdo cabe sem overflow.

### Ausência de override mobile

Não existe nenhuma regra `@media (max-width: ...)` que altere `grid-template-columns` de `#dashboard .summary-item--dashboard-person` para viewports estreitas. O grid de 6 colunas é aplicado em todos os tamanhos de tela.

### Risco residual

Em nomes longos de atendente (ex: "Alessandra"), a coluna nome (72px) também overflow, comprimindo ainda mais as colunas métricas e piorando o bug.

---

## Bug 3 — Gráfico de barras cortado à direita (Feedback Positivo)

### Veredito: CONFIRMADO

### Screenshots

**390×844** — `Screenshots/diag-390x844-feedback-chart.png`

Barra de Maickon visível mas encostada no limite direito. Label truncado para "MAICKO" (ellipsis aplicado). A barra em si (0%) é minúscula em altura, mas a coluna está cortada na largura — o lado direito desaparece no limite do container.

**480×854** — `Screenshots/diag-480x854-feedback-chart.png`

Maickon visível com label completo, mas a coluna está espremida contra o limite direito sem margem de respiro. O container não rola — a 4ª coluna usa o espaço residual mínimo disponível.

**760×900** — `Screenshots/diag-760x900-feedback-chart.png`

Todos os 4 atendentes visíveis com barras e labels completos. Sem corte. Container amplo (664px) acomoda as 4 colunas confortavelmente.

### Medições objetivas (390×844)

| Elemento | Valor |
|---|---|
| `#feedbackChart` offsetWidth | **306px** |
| `#feedbackChart` style.minWidth (inline JS) | **560px** |
| `.chart-box` offsetWidth | **344px** |
| `.chart-box` scrollWidth | **342px** |
| `.chart-box` overflow-x | **auto** |
| `.chart-box` pai overflow | **hidden** |
| Espaço mínimo necessário (4 barras) | **310px** (4×70 + 3×10) |
| Déficit | **4px** |

### Causa raiz — CSS + `contain`

O gráfico "Feedback Positivo" é renderizado como um flex de colunas HTML (`#feedbackChart` / `.chart`), não um canvas Chart.js.

**Passo 1 — JS seta minWidth:**

`render-dashboard.js` define:
```js
feedbackChart.style.minWidth = Math.max(summary.length * 88, 560) + 'px'
```

Com 4 atendentes: `max(4×88, 560) = 560px`.

**Passo 2 — CSS anula o minWidth com `!important`:**

```css
#dashboard .dashboard-section--feedback .chart {
  min-width: 0 !important;   /* anula o style inline de 560px */
  contain: layout size;      /* ← a causa principal do corte */
  overflow: visible;         /* padrão, sem scroll interno */
}
```

`!important` em regra de folha de estilo supera `element.style.minWidth` (inline style). O elemento renderiza em 306px (largura do container), não 560px.

**Passo 3 — `contain: layout size` isola o overflow:**

`contain: size` faz o container reportar suas próprias dimensões independentemente do conteúdo filho. Com 4 colunas de `min-width: 70px`:

```
4 × 70px (barras) + 3 × 10px (gaps) = 310px mínimo necessário
container disponível = 306px → déficit de 4px
```

O conteúdo "vaza" 4px para além dos 306px, mas `contain: size` impede que esse overflow seja reportado como `scrollWidth` do `.chart-box`. Como resultado:

- `.chart-box` relata `scrollWidth ≈ clientWidth` → sem barra de scroll horizontal
- O `overflow-x: auto` no `.chart-box` nunca dispara
- A 4ª coluna (Maickon) é cortada no clip boundary do `.chart`

**Passo 4 — bar-label usa ellipsis:**

```css
#dashboard .dashboard-section--feedback .bar-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

A label "MAICKON" é truncada para "MAICKO" porque a coluna não tem largura suficiente para o texto completo.

### Risco residual

- Com mais de 4 atendentes o déficit cresce: 5 barras × 70px + 4 × 10px = 390px > 306px (déficit de 84px). O 5º atendente ficaria completamente invisível.
- O `min-width: 0 !important` foi provavelmente adicionado para evitar que o gráfico quebre layouts em viewports muito estreitas, mas cria o efeito colateral de suprimir o scroll intencional.
- O `contain: layout size` impede que o `.chart-box` detecte o overflow, cancelando o mecanismo de scroll `overflow-x: auto`.

---

## Resumo dos vereditos

| Bug | Veredito | Viewports afetadas | Causa raiz |
|---|---|---|---|
| Bug 2 — Valores sobrepostos | **CONFIRMADO** | 390×844, 480×854 | Grid 6 colunas com `minmax(0, .72fr)` + `overflow: visible` sem override mobile |
| Bug 3 — Barra cortada à direita | **CONFIRMADO** | 390×844, 480×854 | `min-width: 0 !important` anula JS + `contain: layout size` suprime scroll |

---

## Arquivos de evidência

```
Screenshots/
├── diag-390x844-summaryList.png        ← Bug 2: sobreposição clara em 390px
├── diag-480x854-summaryList.png        ← Bug 2: sobreposição em 480px
├── diag-760x900-summaryList.png        ← Bug 2: sem sobreposição em 760px (ok)
├── diag-390x844-feedback-chart.png     ← Bug 3: Maickon cortado + label truncado
├── diag-480x854-feedback-chart.png     ← Bug 3: Maickon espremido no limite direito
├── diag-760x900-feedback-chart.png     ← Bug 3: sem corte em 760px (ok)
├── diag-390x844-dashboard-full.png     ← Dashboard completo 390px
├── diag-480x854-dashboard-full.png     ← Dashboard completo 480px
└── diag-760x900-dashboard-full.png     ← Dashboard completo 760px
```

---

## Referências CSS — linhas relevantes em `styles.css`

| Regra | Linha |
|---|---|
| `#dashboard .summary-item--dashboard-person` — grid 6 colunas | ~3863 |
| `#dashboard .metric { overflow: visible }` | ~3888 |
| `#dashboard .metric span { overflow: visible }` | ~3894 |
| `.metric { overflow: hidden }` (v5, sobrescrito) | ~4289 |
| `#dashboard .dashboard-section--feedback .chart { min-width: 0 !important; contain: layout size }` | ~3917 |
| `#dashboard .dashboard-section--feedback .bar-col { min-width: 70px }` | ~3930 |
| `#dashboard .dashboard-section--feedback .bar-label { text-overflow: ellipsis }` | ~3944 |
