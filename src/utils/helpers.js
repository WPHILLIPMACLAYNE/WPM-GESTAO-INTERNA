/**
 * src/utils/helpers.js
 * Funções utilitárias puras: escape, sanitização, formatação, validação, datas.
 * Expõe funções no escopo global (padrão browser).
 * Carregado ANTES de main.js via <script>.
 */

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

    function cloneSerializable(value) {
      if (value === undefined) return undefined;
      try {
        return structuredClone(value);
      } catch {
        return JSON.parse(JSON.stringify(value));
      }
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    }

    function formatDate(v) {
      if (!v) return '-';
      const [y, m, d] = v.split('-');
      if (!y || !m || !d) return v;
      return `${d}/${m}/${y}`;
    }

    function formatPct(v) { return `${Math.round((v || 0) * 100)}%`; }

    function formatPctPrecise(value) {
      const pct = Number(value || 0) * 100;
      const isInteger = Math.abs(pct - Math.round(pct)) < 0.001;
      return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: isInteger ? 0 : 2, maximumFractionDigits: 2 })}%`;
    }

    function normalizeSearchText(value) {
      return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    }

    function csvEscape(value) {
      const normalized = String(value ?? '').replace(/\r?\n/g, ' ');
      return /[";,]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
    }

    function buildCsvContent(rows) {
      return rows.map(row => row.map(csvEscape).join(';')).join('\n');
    }

    function shortText(value, max = 120) {
      const text = String(value ?? '').trim();
      return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…` : text;
    }

    function formatBytes(bytes) {
      const value = Math.max(0, Number(bytes || 0));
      if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
      if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${value} B`;
    }

    function formatPersistenceTimestamp(value) {
      if (!value) return '—';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
    }

    function getWeekdayLabel(dateStr) {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return '';
      return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' })
        .format(new Date(Date.UTC(y, m - 1, d, 12))).replace('.', '');
    }

    function suggestScaleTone(dateStr) {
      if (!dateStr) return 'neutral';
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return 'neutral';
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      return weekday === 6 ? 'green' : 'neutral';
    }

    function isValidPeriodKey(key) {
      return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(key || ''));
    }

    function getPeriodLabel(key = currentPeriodKey) {
      const [year, month] = String(key).split('-');
      const monthIndex = Math.max(0, Number(month || 1) - 1);
      return `${MONTH_NAMES[monthIndex] || month}/${year}`;
    }

    function getPreviousPeriodKey(key) {
      const [yearStr, monthStr] = String(key).split('-');
      const dt = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      dt.setMonth(dt.getMonth() - 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    }

    function getNextPeriodKey(key) {
      const [yearStr, monthStr] = String(key).split('-');
      const dt = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      dt.setMonth(dt.getMonth() + 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    }

    function getInitialPeriodKey() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function toneLabel(value) {
      return value === 'green' ? 'Sábado' : value === 'red' ? 'Feriado' : 'Dia normal';
    }

    function compareByDateTime(a, b) {
      const aKey = `${a.date || ''}T${a.time || '00:00'}`;
      const bKey = `${b.date || ''}T${b.time || '00:00'}`;
      return aKey.localeCompare(bKey);
    }

    function eventStatusClass(value) {
      const key = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (key.includes('confirm')) return 'event-status-confirmado';
      if (key.includes('concl')) return 'event-status-concluido';
      if (key.includes('cancel')) return 'event-status-cancelado';
      return 'event-status-programado';
    }

    function normalizeEventType(value) {
      const key = String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (key.includes('acao')) return 'acao';
      if (key.includes('camp')) return 'campanha';
      if (key.includes('trein')) return 'treinamento';
      if (key.includes('feriado')) return 'feriado';
      if (key.includes('evento')) return 'evento';
      return 'outro';
    }

    function isDateInActivePeriod(value) {
      return Boolean(value) && String(value).startsWith(getPeriodPrefix());
    }

    function getPeriodPrefix(key = currentPeriodKey) {
      const [year, month] = String(key).split('-');
      return `${year}-${month}`;
    }

    function getDefaultPeriodDate() {
      return `${getPeriodPrefix()}-01`;
    }

    function getActivePeriodFallbackDate() {
      const today = todayISO();
      return isDateInActivePeriod(today) ? today : getDefaultPeriodDate();
    }

    function getPeriodDisplayDate(dateStr) {
      return dateStr ? formatDate(dateStr) : '—';
    }

    function formatRecadoDateTime(value) {
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return '-';
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(dt);
    }

    function getNpsGoalProgress(score, goal) {
      const safeScore = clamp(Number(score || 0), 0, 100);
      const safeGoal = clamp(Number(goal || 0), 0, 100);
      return safeGoal ? Math.min(100, (safeScore / safeGoal) * 100) : 0;
    }

    function getRiskBand(score) {
      const value = clamp(Number(score || 0), 0, 100);
      if (value <= 20) return { label: 'Faixa crítica • vermelho', tone: 'risk-red' };
      if (value <= 40) return { label: 'Faixa de atenção • laranja', tone: 'risk-orange' };
      if (value <= 60) return { label: 'Faixa moderada • amarelo', tone: 'risk-yellow' };
      if (value <= 80) return { label: 'Faixa boa • verde claro', tone: 'risk-green-light' };
      return { label: 'Faixa excelente • verde escuro', tone: 'risk-green-dark' };
    }

    function getNpsHistoryBandClass(score) {
      if (score <= 20) return 'is-risk';
      if (score <= 40) return 'is-warning';
      if (score <= 60) return 'is-mid';
      if (score <= 80) return 'is-good';
      return 'is-excellent';
    }
