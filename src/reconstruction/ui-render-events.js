// Reconstructed UI Render / Events contract from Reversa Task 16.
// Testable mirror of src/ui render scheduling, delegated events, dialogs,
// toasts, filters, storage sync and keyboard affordances.

export const AREAS_RENDERIZACAO = Object.freeze([
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

export const RENDER_MAP = Object.freeze({
  hero: 'renderHero',
  dashboard: 'renderDashboard',
  students: 'renderStudents',
  addons: 'renderAddons',
  pending: 'renderPending',
  nps: 'renderNps',
  scale: 'renderScale',
  events: 'renderEvents',
  settings: 'renderSettings',
});

export const UI_BINDINGS = Object.freeze({
  search: { area: 'students', debounceMs: 150 },
  addonSearch: { area: 'addons', debounceMs: 150 },
  pendingSearch: { area: 'pending', debounceMs: 150 },
  npsSearch: { area: 'nps', debounceMs: 150 },
  scaleSearch: { area: 'scale', debounceMs: 150 },
  eventSearch: { area: 'events', debounceMs: 150 },
});

export const STORAGE_BROADCAST_KEY = 'wpm_storage_broadcast';

const VALID_RENDER_AREAS = new Set(AREAS_RENDERIZACAO);
const ASSERTIVE_TOAST_TYPES = new Set(['danger', 'warning']);

export function normalizarAlvosRender(alvos) {
  const rawTargets = Array.isArray(alvos) ? alvos : [alvos];
  const normalized = rawTargets.flatMap((target) => {
    if (target === 'all' || target === 'tudo') return AREAS_RENDERIZACAO;
    return [target];
  });
  return [...new Set(normalized.filter((target) => VALID_RENDER_AREAS.has(target)))];
}

export function createRenderState() {
  return {
    sujas: new Set(),
    agendado: false,
    idQuadro: 0,
    renderizando: false,
    ultimoLote: [],
    controlesUiInicializados: false,
  };
}

export function createEventState() {
  return {
    uiEventsBound: false,
    acessibilidadeBound: false,
    storageSyncBound: false,
    tooltipsBound: false,
    shortcutsBound: false,
    tabKeyboardBound: false,
    kanbanBound: false,
  };
}

export function sanitizeUiHtml(html, sanitizer = globalThis.DOMPurify) {
  const raw = String(html ?? '');
  if (sanitizer && typeof sanitizer.sanitize === 'function') {
    return sanitizer.sanitize(raw);
  }
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
}

export function hashUiHtml(html) {
  let hash = 2166136261;
  const text = String(html ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function aplicarHtmlSeMudou(element, html, options = {}) {
  if (!element) return false;
  const safeHtml = sanitizeUiHtml(html, options.sanitizer);
  const signature = hashUiHtml(safeHtml);
  if (element.dataset?.renderSignature === signature) return false;
  element.innerHTML = safeHtml;
  if (element.dataset) element.dataset.renderSignature = signature;
  applyRuntimeStyles(element);
  return true;
}

export function applyRuntimeStyles(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  const styled = root.querySelectorAll('[data-style-width],[data-style-height],[data-style-left],[data-style-top]');
  styled.forEach((element) => {
    for (const [dataKey, styleKey] of [
      ['styleWidth', 'width'],
      ['styleHeight', 'height'],
      ['styleLeft', 'left'],
      ['styleTop', 'top'],
    ]) {
      const value = element.dataset?.[dataKey];
      if (value) element.style[styleKey] = value;
    }
  });
  return styled.length;
}

function getOwnerDocument(node, fallback = globalThis.document) {
  return node?.ownerDocument || fallback;
}

function getStableFocusSelector(element) {
  if (!element) return null;
  if (element.id) return `#${CSS.escape(element.id)}`;
  if (element.dataset?.focusKey) return `[data-focus-key="${CSS.escape(element.dataset.focusKey)}"]`;
  if (element.name) return `[name="${CSS.escape(element.name)}"]`;
  return null;
}

function captureFocusState(container) {
  const documentRef = getOwnerDocument(container);
  const active = documentRef?.activeElement;
  if (!active || !container?.contains?.(active)) return null;
  return {
    selector: getStableFocusSelector(active),
    selectionStart: active.selectionStart,
    selectionEnd: active.selectionEnd,
  };
}

function restoreFocusState(container, focusState) {
  if (!focusState?.selector || typeof container?.querySelector !== 'function') return false;
  const target = container.querySelector(focusState.selector);
  if (!target || typeof target.focus !== 'function') return false;
  target.focus();
  if (
    Number.isInteger(focusState.selectionStart)
    && Number.isInteger(focusState.selectionEnd)
    && typeof target.setSelectionRange === 'function'
  ) {
    target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
  }
  return true;
}

export function aplicarPatchPorChave(container, descriptors = [], options = {}) {
  if (!container) return { inserted: 0, updated: 0, removed: 0 };
  const documentRef = getOwnerDocument(container);
  const focusState = captureFocusState(container);
  const existing = new Map();
  Array.from(container.children || []).forEach((child) => {
    if (child.dataset?.key) existing.set(child.dataset.key, child);
  });

  const nextNodes = [];
  let inserted = 0;
  let updated = 0;

  for (const descriptor of descriptors) {
    const key = String(descriptor?.key ?? '');
    if (!key) continue;
    const tagName = descriptor.tagName || options.tagName || 'div';
    let node = existing.get(key);
    if (!node) {
      node = documentRef.createElement(tagName);
      node.dataset.key = key;
      inserted += 1;
    }
    for (const [name, value] of Object.entries(descriptor.attributes || {})) {
      if (value === false || value === null || value === undefined) node.removeAttribute(name);
      else node.setAttribute(name, String(value));
    }
    if (aplicarHtmlSeMudou(node, descriptor.html, options)) updated += 1;
    nextNodes.push(node);
    existing.delete(key);
  }

  const removed = existing.size;
  existing.forEach((node) => node.remove());
  nextNodes.forEach((node) => {
    if (node.parentElement !== container || node !== container.lastElementChild) {
      container.appendChild(node);
    }
  });
  restoreFocusState(container, focusState);

  return { inserted, updated, removed };
}

export function aplicarPatchLinhas(container, items = [], getKey, renderRow, options = {}) {
  return aplicarPatchPorChave(
    container,
    (Array.isArray(items) ? items : []).map((item, index) => ({
      key: getKey(item, index),
      tagName: 'tr',
      html: sanitizeUiHtml(renderRow(item, index), options.sanitizer)
        .replace(/<\/?(?:img|svg|circle|path|g)\b[^>]*>/gi, ''),
    })),
    options,
  );
}

export function aplicarPatchCards(container, items = [], getKey, renderCard, options = {}) {
  return aplicarPatchPorChave(
    container,
    (Array.isArray(items) ? items : []).map((item, index) => ({
      key: getKey(item, index),
      tagName: 'article',
      html: renderCard(item, index),
      attributes: { class: options.className || 'card' },
    })),
    options,
  );
}

function isEditableElement(element) {
  const tag = String(element?.tagName || '').toLowerCase();
  return element?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

function findFirstFocusable(root) {
  return root?.querySelector?.('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || null;
}

export function createUiRenderEventsRuntime(options = {}) {
  const documentRef = options.document || globalThis.document;
  const windowRef = options.window || globalThis.window;
  const renderState = options.renderState || createRenderState();
  const eventState = options.eventState || createEventState();
  const renderers = options.renderers || {};
  const uiBindings = options.uiBindings || UI_BINDINGS;
  const areaSelectors = options.areaSelectors || {};
  const actionBindings = options.actionBindings || [];
  const modalFocusStack = [];
  let confirmState = null;
  const debounceTimers = new Map();

  const requestAnimationFrameFn = options.requestAnimationFrame
    || windowRef?.requestAnimationFrame?.bind(windowRef)
    || ((callback) => setTimeout(callback, 0));
  const cancelAnimationFrameFn = options.cancelAnimationFrame
    || windowRef?.cancelAnimationFrame?.bind(windowRef)
    || ((id) => clearTimeout(id));

  function getAreaElement(area) {
    const selector = areaSelectors[area] || `[data-render-area="${area}"]`;
    return documentRef?.querySelector?.(selector) || documentRef?.getElementById?.(area) || null;
  }

  function renderSection(area) {
    const rendererName = RENDER_MAP[area];
    const renderer = renderers[area] || renderers[rendererName];
    if (typeof renderer !== 'function') return false;
    const result = renderer({
      area,
      element: getAreaElement(area),
      runtime,
      state: options.getState?.(),
    });
    if (typeof result === 'string') {
      return aplicarHtmlSeMudou(getAreaElement(area), result, { sanitizer: options.sanitizer });
    }
    return result !== false;
  }

  function executarRenderAgendado() {
    if (renderState.renderizando) return;
    renderState.agendado = false;
    renderState.idQuadro = 0;
    const batch = [...renderState.sujas];
    renderState.sujas.clear();
    renderState.renderizando = true;
    renderState.ultimoLote = batch;
    try {
      batch.forEach((area) => renderSection(area));
      options.syncCurrentPeriodLockUI?.();
    } finally {
      renderState.renderizando = false;
    }
    if (renderState.sujas.size > 0) {
      runtime.requestRender([...renderState.sujas]);
    }
  }

  function requestRender(targets = 'all') {
    normalizarAlvosRender(targets).forEach((target) => renderState.sujas.add(target));
    if (renderState.agendado || renderState.renderizando || renderState.sujas.size === 0) return;
    renderState.agendado = true;
    renderState.idQuadro = requestAnimationFrameFn(executarRenderAgendado);
  }

  function limparFilaRender() {
    if (renderState.agendado && renderState.idQuadro) {
      cancelAnimationFrameFn(renderState.idQuadro);
    }
    renderState.sujas.clear();
    renderState.agendado = false;
    renderState.idQuadro = 0;
  }

  function renderAll() {
    limparFilaRender();
    options.normalizeState?.();
    initUIBindings();
    normalizarAlvosRender('all').forEach((area) => renderSection(area));
    options.syncCurrentPeriodLockUI?.();
  }

  function collectUiEventBindings() {
    return [
      ...actionBindings,
      ...(typeof options.collectUiEventBindings === 'function' ? options.collectUiEventBindings() : []),
    ];
  }

  function dispatchUiBinding(bindings, handlerName, ...args) {
    for (const binding of bindings || []) {
      const handler = binding?.[handlerName];
      if (typeof handler === 'function' && handler(...args, runtime) === true) return true;
    }
    return false;
  }

  function clearFieldError(element) {
    if (!element) return;
    element.removeAttribute?.('aria-invalid');
    const field = element.closest?.('[data-field]');
    field?.classList?.remove('has-error');
  }

  function handleClick(event) {
    const tabButton = event.target?.closest?.('.tab-btn');
    if (tabButton) {
      const tabName = tabButton.dataset?.tab || tabButton.dataset?.target;
      if (tabName) {
        options.setActiveTab?.(tabName);
        requestRender('all');
      }
      return;
    }

    const actionTarget = event.target?.closest?.('[data-action]');
    if (actionTarget) {
      dispatchUiBinding(collectUiEventBindings(), 'onClick', actionTarget.dataset.action, actionTarget, event);
    }
  }

  function handleChange(event) {
    clearFieldError(event.target);
    dispatchUiBinding(collectUiEventBindings(), 'onChange', event.target, event);
  }

  function handleInput(event) {
    clearFieldError(event.target);
    if (event.target?.dataset?.uiBinding) {
      handleFilterInput(event.target.dataset.uiBinding, event.target.value);
    }
    dispatchUiBinding(collectUiEventBindings(), 'onInput', event.target, event);
  }

  function handleFocusOut(event) {
    dispatchUiBinding(collectUiEventBindings(), 'onFocusOut', event.target, event);
  }

  function bindUIEvents() {
    if (!documentRef || eventState.uiEventsBound) return false;
    documentRef.addEventListener('click', handleClick);
    documentRef.addEventListener('change', handleChange);
    documentRef.addEventListener('input', handleInput);
    documentRef.addEventListener('focusout', handleFocusOut);
    eventState.uiEventsBound = true;
    return true;
  }

  function initUIBindings() {
    if (renderState.controlesUiInicializados) return false;
    const uiState = options.loadUIState?.() || {};
    Object.entries(uiBindings).forEach(([name, binding]) => {
      const control = documentRef?.querySelector?.(`[data-ui-binding="${name}"]`);
      if (!control) return;
      if (uiState[name] !== undefined) control.value = uiState[name];
      if (binding.label && !control.getAttribute('aria-label')) control.setAttribute('aria-label', binding.label);
    });
    renderState.controlesUiInicializados = true;
    return true;
  }

  function handleFilterInput(bindingName, value) {
    const binding = uiBindings[bindingName];
    if (!binding) return false;
    options.saveUIState?.({ [bindingName]: value });
    if (debounceTimers.has(bindingName)) clearTimeout(debounceTimers.get(bindingName));
    debounceTimers.set(bindingName, setTimeout(() => {
      requestRender(binding.area);
      debounceTimers.delete(bindingName);
    }, binding.debounceMs ?? 150));
    return true;
  }

  function openModal(id) {
    const modal = documentRef?.getElementById?.(id);
    if (!modal) return false;
    modalFocusStack.push({ id, returnTo: documentRef.activeElement });
    modal.classList.add('is-open');
    modal.removeAttribute('aria-hidden');
    documentRef.body?.classList?.add('modal-open');
    findFirstFocusable(modal)?.focus?.();
    return true;
  }

  function closeModal(id) {
    const modal = documentRef?.getElementById?.(id);
    if (!modal) return false;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    const focusEntryIndex = modalFocusStack.findLastIndex((entry) => entry.id === id);
    const focusEntry = focusEntryIndex >= 0 ? modalFocusStack.splice(focusEntryIndex, 1)[0] : null;
    const stillOpen = documentRef.querySelector?.('.modal.is-open, [role="dialog"].is-open');
    if (!stillOpen) documentRef.body?.classList?.remove('modal-open');
    if (focusEntry?.returnTo?.isConnected) focusEntry.returnTo.focus?.();
    else findFirstFocusable(stillOpen)?.focus?.();
    return true;
  }

  function getToastRegion(assertive = false) {
    const id = assertive ? 'toast-live-assertive' : 'toast-live';
    let region = documentRef?.getElementById?.(id);
    if (!region && documentRef?.body) {
      region = documentRef.createElement('div');
      region.id = id;
      region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
      region.setAttribute('aria-atomic', 'true');
      documentRef.body.appendChild(region);
    }
    return region;
  }

  function showToast(message, type = 'info', duration = 3000) {
    const assertive = ASSERTIVE_TOAST_TYPES.has(type);
    const region = getToastRegion(assertive);
    if (region) region.textContent = String(message ?? '');
    options.onToast?.({ message, type, duration, assertive });
    return { message, type, duration, assertive };
  }

  function showSaveToast(message = 'Alteracoes salvas.', duration = 1800) {
    return showToast(message, 'success', duration);
  }

  function showConfirm(message, onOk, onCancel) {
    confirmState = { message, onOk, onCancel };
    const modalId = options.confirmModalId || 'confirm-modal';
    const messageElement = documentRef?.querySelector?.(`[data-confirm-message]`);
    if (messageElement) messageElement.textContent = String(message ?? '');
    openModal(modalId);
    return confirmState;
  }

  function resolveConfirm(accepted) {
    const current = confirmState;
    confirmState = null;
    closeModal(options.confirmModalId || 'confirm-modal');
    if (accepted) current?.onOk?.();
    else current?.onCancel?.();
    return Boolean(accepted);
  }

  function bindAcessibilidade() {
    if (!documentRef || eventState.acessibilidadeBound) return false;
    documentRef.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const modal = documentRef.querySelector?.('.modal.is-open, [role="dialog"].is-open');
      if (!modal) return;
      const focusables = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables.at(-1);
      if (event.shiftKey && documentRef.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    eventState.acessibilidadeBound = true;
    return true;
  }

  function bindGlobalKeyboardShortcuts() {
    if (!documentRef || eventState.shortcutsBound) return false;
    documentRef.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const modal = documentRef.querySelector?.('.modal.is-open, [role="dialog"].is-open');
        if (modal?.id) closeModal(modal.id);
        return;
      }
      if (event.key === '/' && !isEditableElement(event.target)) {
        const activeTab = options.getActiveTab?.();
        const search = documentRef.querySelector?.(`[data-tab-search="${activeTab}"], .tab-pane.is-active [type="search"], [data-active-search]`);
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    });
    eventState.shortcutsBound = true;
    return true;
  }

  function bindStorageSync() {
    if (!windowRef || eventState.storageSyncBound) return false;
    windowRef.addEventListener('storage', (event) => {
      if (event.key === STORAGE_BROADCAST_KEY) {
        options.consumeStorageBroadcast?.(event.newValue);
      }
    });
    eventState.storageSyncBound = true;
    return true;
  }

  function bindTooltips() {
    if (!documentRef || eventState.tooltipsBound) return false;
    const showTooltip = (event) => {
      const target = event.target?.closest?.('[data-tooltip]');
      if (!target) return;
      target.setAttribute('aria-describedby', target.dataset.tooltipId || 'runtime-tooltip');
    };
    documentRef.addEventListener('mouseover', showTooltip);
    documentRef.addEventListener('focusin', showTooltip);
    eventState.tooltipsBound = true;
    return true;
  }

  function bindKanbanKeyboard() {
    if (!documentRef || eventState.kanbanBound) return false;
    documentRef.addEventListener('keydown', (event) => {
      const card = event.target?.closest?.('[data-pending-id][data-status]');
      if (!card || !event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const statuses = options.pendingStatuses || ['aberto', 'em_andamento', 'resolvido'];
      const currentIndex = statuses.indexOf(card.dataset.status);
      const nextStatus = statuses[currentIndex + direction];
      if (!nextStatus) return;
      event.preventDefault();
      options.updatePendingStatus?.(card.dataset.pendingId, nextStatus);
    });
    eventState.kanbanBound = true;
    return true;
  }

  const runtime = {
    renderState,
    eventState,
    normalizarAlvosRender,
    requestRender,
    executarRenderAgendado,
    limparFilaRender,
    renderAll,
    renderSection,
    aplicarHtmlSeMudou,
    aplicarPatchPorChave,
    aplicarPatchLinhas,
    aplicarPatchCards,
    initUIBindings,
    handleFilterInput,
    bindUIEvents,
    collectUiEventBindings,
    dispatchUiBinding,
    openModal,
    closeModal,
    showToast,
    showSaveToast,
    showConfirm,
    resolveConfirm,
    bindAcessibilidade,
    bindStorageSync,
    bindTooltips,
    bindGlobalKeyboardShortcuts,
    bindKanbanKeyboard,
  };

  return runtime;
}
