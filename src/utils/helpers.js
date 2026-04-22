/**
 * src/utils/helpers.js
 * Funções utilitárias puras: escape, sanitização, formatação, validação, datas.
 * Expõe funções no escopo global (padrão browser).
 * Carregado ANTES de main.js via <script>.
 */

    /** @param {*} value - Value to HTML-escape. @returns {string} HTML-safe string. */
    function esc(value) {
      if (value == null) return '';
      const str = String(value);
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    /** @param {string} html - Raw HTML string. @returns {string} Sanitized HTML via DOMPurify. */
    function sanitizeHtml(html) {
      if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
        return DOMPurify.sanitize(html, {
          ALLOWED_TAGS: [
            'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'p', 'br', 'span',
            'div', 'article', 'section', 'header', 'footer', 'h1', 'h2', 'h3',
            'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'form', 'input', 'select', 'option', 'textarea', 'button', 'label',
            'img', 'svg', 'circle', 'path', 'g', 'code', 'pre', 'blockquote',
            'small', 'sub', 'sup', 'mark', 'time', 'abbr', 'address', 'cite',
            'data', 'dfn', 'kbd', 'samp', 'var', 'details', 'summary', 'dialog',
            'figure', 'figcaption', 'main', 'nav', 'output', 'progress', 'meter'
          ],
          ALLOWED_ATTR: [
            'href', 'title', 'target', 'rel', 'src', 'alt', 'class', 'id',
            'style', 'data-*', 'aria-*', 'role', 'tabindex', 'type', 'value',
            'placeholder', 'required', 'disabled', 'readonly', 'checked',
            'selected', 'for', 'name', 'min', 'max', 'step', 'pattern',
            'maxlength', 'minlength', 'autocomplete', 'autofocus', 'form',
            'action', 'method', 'enctype', 'novalidate', 'draggable',
            'contenteditable', 'hidden', 'colspan', 'rowspan', 'scope',
            'headers', 'abbr', 'axis', 'dir', 'lang', 'xml:lang', 'translate'
          ],
          ALLOW_DATA_ATTR: true,
          KEEP_CONTENT: true,
          RETURN_DOM: false,
          RETURN_DOM_FRAGMENT: false
        });
      }
      console.warn('DOMPurify indisponível — usando fallback esc()');
      return esc(html);
    }

    /** @param {*} value - Value to deep-sanitize (removes null bytes, trims strings). @returns {*} Sanitized copy. */
    function sanitizeDeep(value) {
      if (Array.isArray(value)) return value.map(sanitizeDeep);
      if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, sanitizeDeep(v)])
        );
      }
      if (typeof value === 'string') return value.replace(/\x00/g, '').trim();
      return value;
    }

    /** @param {*} value - Serializable value to deep-clone. @returns {*} Deep clone via structuredClone or JSON fallback. */
    function cloneSerializable(value) {
      if (value === undefined) return undefined;
      try {
        return structuredClone(value);
      } catch {
        return JSON.parse(JSON.stringify(value));
      }
    }

    /** @param {number} value - Number to clamp. @param {number} min - Lower bound. @param {number} max - Upper bound. @returns {number} Clamped value. */
    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    }

    /** @param {string} v - ISO date string (YYYY-MM-DD). @returns {string} Formatted as DD/MM/YYYY or '-'. */
    function formatDate(v) {
      if (!v) return '-';
      const [y, m, d] = v.split('-');
      if (!y || !m || !d) return v;
      return `${d}/${m}/${y}`;
    }

    /** @param {number} v - Decimal value (0-1). @returns {string} Rounded percentage string. */
    function formatPct(v) { return `${Math.round((v || 0) * 100)}%`; }

    /** @param {number} value - Decimal value (0-1). @returns {string} Precise percentage with up to 2 decimals. */
    function formatPctPrecise(value) {
      const pct = Number(value || 0) * 100;
      const isInteger = Math.abs(pct - Math.round(pct)) < 0.001;
      return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: isInteger ? 0 : 2, maximumFractionDigits: 2 })}%`;
    }

    /** @param {*} value - Text to normalize for accent-insensitive search. @returns {string} Lowercased, accent-stripped, trimmed string. */
    function normalizeSearchText(value) {
      return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    }

    /** @param {*} value - Value to escape for CSV output. @returns {string} CSV-safe string. */
    function csvEscape(value) {
      const normalized = String(value ?? '').replace(/\r?\n/g, ' ');
      return /[";,]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
    }

    /** @param {Array<string[]>} rows - Array of row arrays. @returns {string} CSV content with semicolon delimiter. */
    function buildCsvContent(rows) {
      return rows.map(row => row.map(csvEscape).join(';')).join('\n');
    }

    /** @param {*} value - Text to truncate. @param {number} [max=120] - Maximum length. @returns {string} Truncated text with ellipsis if needed. */
    function shortText(value, max = 120) {
      const text = String(value ?? '').trim();
      return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…` : text;
    }

    /** @param {number} bytes - Byte count. @returns {string} Human-readable size (B, KB, or MB). */
    function formatBytes(bytes) {
      const value = Math.max(0, Number(bytes || 0));
      if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
      if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${value} B`;
    }

    /** @param {string|number} value - Timestamp value. @returns {string} Localized pt-BR datetime or '---'. */
    function formatPersistenceTimestamp(value) {
      if (!value) return '—';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
    }

    /** @param {string} dateStr - ISO date (YYYY-MM-DD). @returns {string} Abbreviated weekday name in Portuguese. */
    function getWeekdayLabel(dateStr) {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return '';
      return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' })
        .format(new Date(Date.UTC(y, m - 1, d, 12))).replace('.', '');
    }

    /** @param {string} dateStr - ISO date (YYYY-MM-DD). @returns {string} Suggested tone ('green' for Saturday, else 'neutral'). */
    function suggestScaleTone(dateStr) {
      if (!dateStr) return 'neutral';
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return 'neutral';
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      return weekday === 6 ? 'green' : 'neutral';
    }

    /** @param {string} key - Period key to validate. @returns {boolean} True if key matches YYYY-MM format. */
    function isValidPeriodKey(key) {
      return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(key || ''));
    }

    /** @param {string} [key=currentPeriodKey] - Period key (YYYY-MM). @returns {string} Human-readable label (e.g. 'Janeiro/2026'). */
    function getPeriodLabel(key = currentPeriodKey) {
      const [year, month] = String(key).split('-');
      const monthIndex = Math.max(0, Number(month || 1) - 1);
      return `${MONTH_NAMES[monthIndex] || month}/${year}`;
    }

    /** @param {string} key - Period key (YYYY-MM). @returns {string} Previous month's period key. */
    function getPreviousPeriodKey(key) {
      const [yearStr, monthStr] = String(key).split('-');
      const dt = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      dt.setMonth(dt.getMonth() - 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    }

    /** @param {string} key - Period key (YYYY-MM). @returns {string} Next month's period key. */
    function getNextPeriodKey(key) {
      const [yearStr, monthStr] = String(key).split('-');
      const dt = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      dt.setMonth(dt.getMonth() + 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    }

    /** @returns {string} Current month's period key (YYYY-MM). */
    function getInitialPeriodKey() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    /** @param {string} value - Tone key ('green', 'red', or other). @returns {string} Display label for the tone. */
    function toneLabel(value) {
      return value === 'green' ? 'Sábado' : value === 'red' ? 'Feriado' : 'Dia normal';
    }

    /** @param {{ date?: string, time?: string }} a - First object with date/time. @param {{ date?: string, time?: string }} b - Second object with date/time. @returns {number} Comparison result for sorting. */
    function compareByDateTime(a, b) {
      const aKey = `${a.date || ''}T${a.time || '00:00'}`;
      const bKey = `${b.date || ''}T${b.time || '00:00'}`;
      return aKey.localeCompare(bKey);
    }

    /** @param {string} value - Event status text. @returns {string} CSS class for the event status. */
    function eventStatusClass(value) {
      const key = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (key.includes('confirm')) return 'event-status-confirmado';
      if (key.includes('concl')) return 'event-status-concluido';
      if (key.includes('cancel')) return 'event-status-cancelado';
      return 'event-status-programado';
    }

    /** @param {string} value - Event type display text. @returns {string} Normalized internal event type key. */
    function normalizeEventType(value) {
      const key = String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (key.includes('acao')) return 'acao';
      if (key.includes('camp')) return 'campanha';
      if (key.includes('trein')) return 'treinamento';
      if (key.includes('feriado')) return 'feriado';
      if (key.includes('evento')) return 'evento';
      return 'outro';
    }

    /** @param {string} value - ISO date string. @returns {boolean} True if date falls within the active period. */
    function isDateInActivePeriod(value) {
      return Boolean(value) && String(value).startsWith(getPeriodPrefix());
    }

    /** @param {string} [key=currentPeriodKey] - Period key (YYYY-MM). @returns {string} YYYY-MM prefix string. */
    function getPeriodPrefix(key = currentPeriodKey) {
      const [year, month] = String(key).split('-');
      return `${year}-${month}`;
    }

    /** @returns {string} First day of the active period (YYYY-MM-01). */
    function getDefaultPeriodDate() {
      return `${getPeriodPrefix()}-01`;
    }

    /** @returns {string} Today's date if in active period, otherwise first day of active period. */
    function getActivePeriodFallbackDate() {
      const today = todayISO();
      return isDateInActivePeriod(today) ? today : getDefaultPeriodDate();
    }

    /** @param {string} dateStr - ISO date string. @returns {string} Formatted date for display or '---'. */
    function getPeriodDisplayDate(dateStr) {
      return dateStr ? formatDate(dateStr) : '—';
    }

    /** @param {string|number} value - Timestamp for a {@link Recado}. @returns {string} Formatted pt-BR short date+time or '-'. */
    function formatRecadoDateTime(value) {
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return '-';
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(dt);
    }

    /** @param {number} score - Current NPS score (0-100). @param {number} goal - NPS goal (0-100). @returns {number} Progress percentage toward the goal (0-100). */
    function getNpsGoalProgress(score, goal) {
      const safeScore = clamp(Number(score || 0), 0, 100);
      const safeGoal = clamp(Number(goal || 0), 0, 100);
      return safeGoal ? Math.min(100, (safeScore / safeGoal) * 100) : 0;
    }

    /** @param {NpsMention[]} mentions @returns {NpsMention[]} */
    function sortNpsMentionsByRanking(mentions = []) {
      return [...mentions].sort((a, b) => {
        if (Number(b.count || 0) !== Number(a.count || 0)) return Number(b.count || 0) - Number(a.count || 0);
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      });
    }

    /** @param {NpsMention[]} mentions @returns {Object<string, number>} */
    function buildNpsRankSnapshot(mentions = []) {
      return Object.fromEntries(
        sortNpsMentionsByRanking(mentions).map((item, index) => [item.id, index + 1])
      );
    }

    /** @param {NpsMention[]} mentions @param {*} snapshot @returns {Object<string, number>} */
    function normalizeNpsRankSnapshot(mentions = [], snapshot = {}) {
      const safeSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : {};
      const mentionIds = new Set(mentions.map(item => item.id).filter(Boolean));
      const normalized = {};
      Object.entries(safeSnapshot).forEach(([key, value]) => {
        const position = Number(value);
        if (mentionIds.has(key) && Number.isFinite(position) && position > 0) {
          normalized[key] = position;
        }
      });
      if (Object.keys(safeSnapshot).length && !Object.keys(normalized).length && mentions.length) {
        return buildNpsRankSnapshot(mentions);
      }
      return normalized;
    }

    /** @param {number} score - NPS score (0-100). @returns {RiskBand} Risk band with label and tone class. */
    function getRiskBand(score) {
      const value = clamp(Number(score || 0), 0, 100);
      if (value <= 20) return { label: 'Faixa crítica • vermelho', tone: 'risk-red' };
      if (value <= 40) return { label: 'Faixa de atenção • laranja', tone: 'risk-orange' };
      if (value <= 60) return { label: 'Faixa moderada • amarelo', tone: 'risk-yellow' };
      if (value <= 80) return { label: 'Faixa boa • verde claro', tone: 'risk-green-light' };
      return { label: 'Faixa excelente • verde escuro', tone: 'risk-green-dark' };
    }

    /** @param {number} score - NPS score (0-100). @returns {string} CSS class for NPS history band visualization. */
    function getNpsHistoryBandClass(score) {
      if (score <= 20) return 'is-risk';
      if (score <= 40) return 'is-warning';
      if (score <= 60) return 'is-mid';
      if (score <= 80) return 'is-good';
      return 'is-excellent';
    }
