import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AREAS_RENDERIZACAO,
  STORAGE_BROADCAST_KEY,
  UI_BINDINGS,
  aplicarHtmlSeMudou,
  aplicarPatchCards,
  aplicarPatchLinhas,
  createUiRenderEventsRuntime,
  normalizarAlvosRender,
  sanitizeUiHtml,
} from '../../src/reconstruction/ui-render-events.js';

describe('reconstruction ui render events', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('normaliza alvos validos, all/tudo e descarta alvos desconhecidos', () => {
    expect(AREAS_RENDERIZACAO).toEqual([
      'hero',
      'dashboard',
      'students',
      'addons',
      'pending',
      'nps',
      'scale',
      'events',
      'settings',
    ]);
    expect(UI_BINDINGS.search).toMatchObject({ area: 'students', debounceMs: 150 });
    expect(normalizarAlvosRender(['dashboard', 'bad', 'nps', 'dashboard'])).toEqual(['dashboard', 'nps']);
    expect(normalizarAlvosRender('all')).toEqual(AREAS_RENDERIZACAO);
    expect(normalizarAlvosRender('tudo')).toEqual(AREAS_RENDERIZACAO);
  });

  it('agenda render por areas sujas uma vez por frame e sincroniza lock ao final', () => {
    const rendered = [];
    const rafCallbacks = [];
    const syncCurrentPeriodLockUI = vi.fn();
    const runtime = createUiRenderEventsRuntime({
      document,
      requestAnimationFrame: (callback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      },
      renderers: {
        renderDashboard: () => rendered.push('dashboard'),
        renderNps: () => rendered.push('nps'),
        renderStudents: () => rendered.push('students'),
      },
      syncCurrentPeriodLockUI,
    });

    runtime.requestRender(['dashboard', 'nps']);
    runtime.requestRender(['dashboard', 'students']);

    expect(rafCallbacks).toHaveLength(1);
    rafCallbacks[0]();

    expect(rendered).toEqual(['dashboard', 'nps', 'students']);
    expect(runtime.renderState.ultimoLote).toEqual(['dashboard', 'nps', 'students']);
    expect(syncCurrentPeriodLockUI).toHaveBeenCalledTimes(1);
  });

  it('reagenda novo lote quando renderizador marca area suja durante render', () => {
    const rafCallbacks = [];
    const rendered = [];
    const runtime = createUiRenderEventsRuntime({
      document,
      requestAnimationFrame: (callback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      },
      renderers: {
        renderDashboard: ({ runtime: ui }) => {
          rendered.push('dashboard');
          ui.requestRender('nps');
        },
        renderNps: () => rendered.push('nps'),
      },
    });

    runtime.requestRender('dashboard');
    rafCallbacks[0]();

    expect(rendered).toEqual(['dashboard']);
    expect(rafCallbacks).toHaveLength(2);

    rafCallbacks[1]();
    expect(rendered).toEqual(['dashboard', 'nps']);
  });

  it('renderAll limpa fila, inicializa filtros e renderiza todas as secoes', () => {
    document.body.innerHTML = '<input data-ui-binding="search">';
    const rendered = [];
    const runtime = createUiRenderEventsRuntime({
      document,
      loadUIState: () => ({ search: 'ana' }),
      normalizeState: vi.fn(),
      syncCurrentPeriodLockUI: vi.fn(),
      renderers: Object.fromEntries(AREAS_RENDERIZACAO.map((area) => [
        `render${area[0].toUpperCase()}${area.slice(1)}`,
        () => rendered.push(area),
      ])),
    });

    runtime.renderAll();

    expect(document.querySelector('[data-ui-binding="search"]').value).toBe('ana');
    expect(rendered).toEqual(AREAS_RENDERIZACAO);
  });

  it('salva filtro imediatamente e renderiza area alvo apos debounce de 150ms', () => {
    vi.useFakeTimers();
    const saved = [];
    const rendered = [];
    const runtime = createUiRenderEventsRuntime({
      document,
      saveUIState: (patch) => saved.push(patch),
      requestAnimationFrame: (callback) => {
        callback();
        return 1;
      },
      renderers: {
        renderStudents: () => rendered.push('students'),
      },
    });

    expect(runtime.handleFilterInput('search', 'aluno')).toBe(true);
    expect(saved).toEqual([{ search: 'aluno' }]);
    expect(rendered).toEqual([]);

    vi.advanceTimersByTime(149);
    expect(rendered).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(rendered).toEqual(['students']);
  });

  it('delegacao global idempotente trata tabs, actions e limpa erro de campo', () => {
    document.body.innerHTML = `
      <button class="tab-btn" data-tab="nps">NPS</button>
      <button data-action="save-student">Salvar</button>
      <label data-field class="has-error"><input aria-invalid="true"></label>
    `;
    const setActiveTab = vi.fn();
    const actionClick = vi.fn(() => true);
    const runtime = createUiRenderEventsRuntime({
      document,
      setActiveTab,
      actionBindings: [{ onClick: actionClick }],
      requestAnimationFrame: (callback) => {
        callback();
        return 1;
      },
    });

    expect(runtime.bindUIEvents()).toBe(true);
    expect(runtime.bindUIEvents()).toBe(false);

    document.querySelector('.tab-btn').click();
    document.querySelector('[data-action]').click();
    document.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));

    expect(setActiveTab).toHaveBeenCalledWith('nps');
    expect(actionClick).toHaveBeenCalledWith('save-student', document.querySelector('[data-action]'), expect.any(Event), runtime);
    expect(document.querySelector('[data-field]').classList.contains('has-error')).toBe(false);
    expect(document.querySelector('input').hasAttribute('aria-invalid')).toBe(false);
  });

  it('abre modal, prende Tab, fecha com Escape e restaura foco', () => {
    document.body.innerHTML = `
      <button id="return-to">Abrir</button>
      <section id="edit-modal" class="modal" aria-hidden="true" role="dialog">
        <button id="first">Primeiro</button>
        <button id="last">Ultimo</button>
      </section>
    `;
    const runtime = createUiRenderEventsRuntime({ document });
    runtime.bindAcessibilidade();
    runtime.bindGlobalKeyboardShortcuts();
    document.getElementById('return-to').focus();

    expect(runtime.openModal('edit-modal')).toBe(true);
    expect(document.body.classList.contains('modal-open')).toBe(true);
    expect(document.getElementById('edit-modal').getAttribute('aria-hidden')).toBe(null);
    expect(document.activeElement.id).toBe('first');

    document.getElementById('last').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement.id).toBe('first');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('edit-modal').getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement.id).toBe('return-to');
  });

  it('toast danger usa live region assertiva e confirm executa callback escolhido', () => {
    const ok = vi.fn();
    const cancel = vi.fn();
    document.body.innerHTML = `
      <section id="confirm-modal" class="modal" aria-hidden="true" role="dialog">
        <p data-confirm-message></p>
        <button>OK</button>
      </section>
    `;
    const runtime = createUiRenderEventsRuntime({ document });

    expect(runtime.showToast('Falha', 'danger')).toMatchObject({ assertive: true });
    expect(document.getElementById('toast-live-assertive').getAttribute('aria-live')).toBe('assertive');
    expect(document.getElementById('toast-live-assertive').textContent).toBe('Falha');

    runtime.showConfirm('Confirmar?', ok, cancel);
    expect(document.querySelector('[data-confirm-message]').textContent).toBe('Confirmar?');
    expect(runtime.resolveConfirm(true)).toBe(true);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('storage sync consome broadcast e kanban move status por Alt+ArrowRight', () => {
    const consumeStorageBroadcast = vi.fn();
    const updatePendingStatus = vi.fn();
    document.body.innerHTML = '<article data-pending-id="p1" data-status="aberto" tabindex="0"></article>';
    const runtime = createUiRenderEventsRuntime({
      document,
      window,
      consumeStorageBroadcast,
      updatePendingStatus,
    });

    expect(runtime.bindStorageSync()).toBe(true);
    expect(runtime.bindKanbanKeyboard()).toBe(true);

    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_BROADCAST_KEY,
      newValue: '{"version":1}',
    }));
    const kanbanCard = document.querySelector('[data-pending-id]');
    kanbanCard.focus();
    kanbanCard.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
    }));

    expect(consumeStorageBroadcast).toHaveBeenCalledWith('{"version":1}');
    expect(updatePendingStatus).toHaveBeenCalledWith('p1', 'em_andamento');
  });

  it('sanitiza HTML, evita reescrita identica e patch por chave preserva foco', () => {
    document.body.innerHTML = '<div id="target"></div><div id="cards"></div>';
    const target = document.getElementById('target');

    expect(sanitizeUiHtml('<img src=x onerror="boom"><script>alert(1)</script>')).toBe('<img src=x>');
    expect(aplicarHtmlSeMudou(target, '<strong>OK</strong>')).toBe(true);
    const firstNode = target.firstChild;
    expect(aplicarHtmlSeMudou(target, '<strong>OK</strong>')).toBe(false);
    expect(target.firstChild).toBe(firstNode);

    const cards = document.getElementById('cards');
    aplicarPatchCards(cards, [
      { id: 'a', value: 'A' },
      { id: 'b', value: 'B' },
    ], (item) => item.id, (item) => `<input data-focus-key="${item.id}" value="${item.value}">`);
    cards.querySelector('[data-focus-key="b"]').focus();

    const result = aplicarPatchCards(cards, [
      { id: 'b', value: 'B2' },
      { id: 'c', value: 'C' },
    ], (item) => item.id, (item) => `<input data-focus-key="${item.id}" value="${item.value}">`);

    expect(result).toMatchObject({ inserted: 1, removed: 1 });
    expect([...cards.children].map((node) => node.dataset.key)).toEqual(['b', 'c']);
    expect(document.activeElement.dataset.focusKey).toBe('b');
  });

  it('sanitiza midia ativa em patch de linhas de tabela', () => {
    document.body.innerHTML = '<table><tbody id="rows"></tbody></table>';
    const rows = document.getElementById('rows');

    aplicarPatchLinhas(rows, [
      { id: 'row-1', text: '<img src=x data-xss="row">Linha segura' },
    ], item => item.id, item => `<td>${item.text}</td>`);

    expect(rows.querySelector('[data-xss="row"]')).toBeNull();
    expect(rows.textContent).toContain('Linha segura');
  });
});
