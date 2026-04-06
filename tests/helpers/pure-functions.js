/**
 * Módulo de funções puras extraídas do app.js para testes unitários.
 * Estas funções não dependem de DOM, IndexedDB ou estado global.
 */

// ─── Escape & Sanitização ────────────────────────────────────────────────

export function esc(value) {
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

export function sanitizeDeep(value) {
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeDeep(v)])
    );
  }
  if (typeof value === 'string') return value.replace(/\x00/g, '').trim();
  return value;
}

// ─── Formatação ──────────────────────────────────────────────────────────

export function formatDate(v) {
  if (!v) return '-';
  const [y, m, d] = v.split('-');
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y}`;
}

export function formatPct(v) {
  return `${Math.round((v || 0) * 100)}%`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function csvEscape(value) {
  const normalized = String(value ?? '').replace(/\r?\n/g, ' ');
  return /[";,]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

export function buildCsvContent(rows) {
  return rows.map(row => row.map(csvEscape).join(';')).join('\n');
}

// ─── Data helpers ────────────────────────────────────────────────────────

export function getWeekdayLabel(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    timeZone: 'America/Sao_Paulo'
  }).format(new Date(Date.UTC(y, m - 1, d, 12))).replace('.', '');
}

export function suggestScaleTone(dateStr) {
  if (!dateStr) return 'neutral';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 'neutral';
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (weekday === 6) return 'green';
  return 'neutral';
}

export function isDateInActivePeriod(value, periodKey) {
  const prefix = String(periodKey || '').slice(0, 7);
  return Boolean(value) && String(value).startsWith(prefix);
}

export function getPeriodLabel(key = '2026-04') {
  const [year, month] = String(key).split('-');
  const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${MONTH_NAMES[Number(month) - 1] || month}/${year}`;
}

export function getPreviousPeriodKey(key) {
  const [yearStr, monthStr] = String(key).split('-');
  let year = Number(yearStr);
  let month = Number(monthStr) - 1;
  if (month < 1) { month = 12; year -= 1; }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getNextPeriodKey(key) {
  const [yearStr, monthStr] = String(key).split('-');
  let year = Number(yearStr);
  let month = Number(monthStr) + 1;
  if (month > 12) { month = 1; year += 1; }
  return `${year}-${String(month).padStart(2, '0')}`;
}

// ─── NPS helpers ─────────────────────────────────────────────────────────

export function getRiskBand(score) {
  const value = clamp(Number(score || 0), 0, 100);
  if (value <= 20) return { label: 'Faixa crítica • vermelho', tone: 'risk-red' };
  if (value <= 40) return { label: 'Faixa de atenção • laranja', tone: 'risk-orange' };
  if (value <= 60) return { label: 'Faixa moderada • amarelo', tone: 'risk-yellow' };
  if (value <= 80) return { label: 'Faixa boa • verde claro', tone: 'risk-green-light' };
  return { label: 'Faixa excelente • verde escuro', tone: 'risk-green-dark' };
}

export function getNpsGoalProgress(score, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, (score / goal) * 100);
}

// ─── Validation helpers ──────────────────────────────────────────────────

export function validateStudent(formData) {
  const errors = {};
  if (!String(formData?.nome || '').trim()) errors.nome = 'Informe o nome do aluno.';
  if (!String(formData?.matricula || '').trim()) errors.matricula = 'Informe a matrícula.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validatePending(formData) {
  const errors = {};
  if (!String(formData?.nome || '').trim()) errors.nome = 'Informe o nome.';
  if (!String(formData?.pendencia || '').trim()) errors.required = 'Informe a descrição da pendência.';
  if (!String(formData?.data || '').trim()) errors.data = 'Informe a data.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateEvent(formData) {
  const errors = {};
  if (!String(formData?.date || '').trim()) errors.date = 'Informe a data do evento.';
  if (!String(formData?.title || '').trim()) errors.required = 'Informe o título do evento.';
  return { valid: Object.keys(errors).length === 0, errors };
}

// ─── Period helpers ──────────────────────────────────────────────────────

export function isValidPeriodKey(key) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(key || ''));
}

export function getPeriodMetrics(period) {
  if (!period) return { students: 0, pending: 0, events: 0, scale: 0, mentions: 0, recados: 0, addonVolume: 0 };
  return {
    recados: (period.recados || []).length,
    students: (period.students || []).length,
    pending: (period.pending || []).length,
    events: (period.events || []).length,
    scale: (period.scale || []).length,
    mentions: (period.nps?.mentions || []).length,
    addonVolume: Object.values(period.addons || {}).reduce((acc, byType) =>
      acc + Object.values(byType || {}).reduce((sum, days) =>
        sum + (days || []).reduce((dayAcc, value) => dayAcc + Number(value || 0), 0), 0), 0)
  };
}

export function periodHasMeaningfulData(period) {
  if (!period) return false;
  return Boolean(
    (period.recados || []).length ||
    (period.students || []).length ||
    (period.pending || []).length ||
    (period.scale || []).length ||
    (period.events || []).length ||
    period.nps?.score ||
    period.nps?.observations ||
    (period.nps?.mentions || []).length ||
    Object.values(period.addons || {}).some(group =>
      Object.values(group || {}).some(days =>
        (days || []).some(value => Number(value || 0) > 0)
      )
    )
  );
}
