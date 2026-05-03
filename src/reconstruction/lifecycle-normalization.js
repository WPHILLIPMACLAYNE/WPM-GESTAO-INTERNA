// Reconstructed lifecycle normalization from Reversa Task 07.
// Pure PeriodData normalization for legacy local stores, backups, and remote payloads.

import { APP_DEFAULTS } from './config-global-state.js';
import { createId, normalizeNumericId } from './domain-entities.js';

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function uniqueTexts(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)).filter(Boolean))];
}

export function normalizeRecado(item = {}) {
  const text = normalizeText(item.text ?? item.message);
  const from = normalizeText(item.from ?? item.author);
  const to = normalizeText(item.to, 'Todos');
  if (!from || !text) return null;

  return {
    id: normalizeText(item.id) || createId(),
    from,
    to,
    text,
    message: text,
    author: normalizeText(item.author ?? from),
    createdAt: normalizeText(item.createdAt) || new Date().toISOString(),
    read: Boolean(item.read),
    readAt: item.readAt === null ? null : normalizeText(item.readAt, null),
    periodKey: normalizeText(item.periodKey),
  };
}

export function normalizeRecadosCollection(recados = []) {
  return (Array.isArray(recados) ? recados : [])
    .map(normalizeRecado)
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
}

export function sortNpsMentionsByRanking(mentions = []) {
  return [...mentions].sort((left, right) => {
    if (Number(right.count || 0) !== Number(left.count || 0)) {
      return Number(right.count || 0) - Number(left.count || 0);
    }
    return String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR');
  });
}

export function buildNpsRankSnapshot(mentions = []) {
  return Object.fromEntries(
    sortNpsMentionsByRanking(mentions).map((item, index) => [item.id, index + 1]),
  );
}

export function normalizeNpsRankSnapshot(mentions = [], snapshot = {}) {
  const safeSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : {};
  const mentionIds = new Set(mentions.map((item) => item.id).filter(Boolean));
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

export function getReceptionists(source = {}) {
  return uniqueTexts(source?.settings?.receptionists?.length ? source.settings.receptionists : source?.settings?.team)
    .concat([])
    .length
    ? uniqueTexts(source?.settings?.receptionists?.length ? source.settings.receptionists : source?.settings?.team)
    : [...APP_DEFAULTS.receptionists];
}

export function getProfessors(source = {}) {
  const professors = uniqueTexts(source?.settings?.professors);
  return professors.length ? professors : [...APP_DEFAULTS.professors];
}

export function totalAddonVolumeForPerson(person, source = {}) {
  const group = source?.addons?.[person] || {};
  const knownTypes = [...new Set([...(source?.settings?.addonTypes || []), ...Object.keys(group)])];
  return knownTypes.reduce((total, type) => {
    const values = Array.isArray(group[type]) ? group[type] : [];
    return total + values.reduce((acc, value) => acc + Number(value || 0), 0);
  }, 0);
}

export function getAddonPeople(source = {}) {
  const activeReceptionists = getReceptionists(source);
  const historicalPeople = Object.keys(source?.addons || {}).filter((person) => (
    person && (activeReceptionists.includes(person) || totalAddonVolumeForPerson(person, source) > 0)
  ));
  return [...new Set([...activeReceptionists, ...historicalPeople])];
}

export function getTotalAddonVolume(source = {}) {
  return Object.keys(source?.addons || {}).reduce((total, person) => total + totalAddonVolumeForPerson(person, source), 0);
}

export function hydrateLegacyAddonsFromStudents(data) {
  if (!data || getTotalAddonVolume(data) > 0) return;

  data.students.forEach((student) => {
    const person = normalizeText(student?.atendimento);
    const type = normalizeText(student?.addon);
    const rawDate = normalizeText(student?.inicio || student?.ultimaVisita);
    const day = Number(rawDate.split('-')[2] || 0);
    if (!person || !type || !day) return;

    data.addons[person] ||= {};
    const arr = Array.from(
      { length: data.settings.monthDays },
      (_, index) => Number((data.addons[person][type] || [])[index] || 0),
    );
    const index = Math.min(data.settings.monthDays, Math.max(1, day)) - 1;
    arr[index] = Number(arr[index] || 0) + 1;
    data.addons[person][type] = arr;
  });
}

export function seedAddons(data) {
  data.addons = {};
  getReceptionists(data).forEach((name) => {
    data.addons[name] = {};
    (data.settings.addonTypes || APP_DEFAULTS.addonTypes).forEach((type) => {
      data.addons[name][type] = Array.from({ length: data.settings.monthDays }, () => 0);
    });
  });
}

export function normalizeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;

  data.settings ||= { team: [], addonTypes: [], monthDays: 31, receptionists: [], professors: [] };
  data.settings.receptionists = uniqueTexts(data.settings.receptionists?.length ? data.settings.receptionists : data.settings.team);
  data.settings.professors = uniqueTexts(data.settings.professors);
  if (!data.settings.receptionists.length) data.settings.receptionists = [...APP_DEFAULTS.receptionists];
  if (!data.settings.professors.length) data.settings.professors = [...APP_DEFAULTS.professors];
  data.settings.team = uniqueTexts(data.settings.team?.length ? data.settings.team : data.settings.receptionists);
  data.settings.addonTypes = uniqueTexts(data.settings.addonTypes).length
    ? uniqueTexts(data.settings.addonTypes)
    : [...APP_DEFAULTS.addonTypes];
  data.settings.monthDays = clamp(Number(data.settings.monthDays || 31), 28, 31);

  data.students = (Array.isArray(data.students) ? data.students : []).map((student) => ({
    id: normalizeText(student.id) || createId(),
    nome: normalizeText(student.nome),
    matricula: normalizeNumericId(student.matricula),
    ultimaVisita: normalizeText(student.ultimaVisita),
    horaVisita: normalizeText(student.horaVisita ?? student.horario),
    inicio: normalizeText(student.inicio),
    avisoNps: normalizeText(student.avisoNps, 'Sim'),
    atendimento: normalizeText(student.atendimento, data.settings.team[0] || ''),
    feedback: normalizeText(student.feedback, 'Pendente'),
    addon: normalizeText(student.addon),
    observacoes: normalizeText(student.observacoes),
  }));

  data.pending = (Array.isArray(data.pending) ? data.pending : []).map((item) => ({
    id: normalizeText(item.id) || createId(),
    nome: normalizeText(item.nome),
    matricula: normalizeNumericId(item.matricula),
    pendencia: normalizeText(item.pendencia),
    data: normalizeText(item.data),
    hostess: normalizeText(item.hostess, data.settings.team[0] || ''),
    resposta: normalizeText(item.resposta),
    status: normalizeText(item.status, 'aberto'),
  }));

  data.recados = normalizeRecadosCollection(data.recados);
  data.scale = (Array.isArray(data.scale) ? data.scale : Array.isArray(data.escala) ? data.escala : [])
    .map((item) => {
      const shifts = Array.isArray(item.professorShifts)
        ? item.professorShifts
        : Array.isArray(item.professores)
          ? item.professores
          : [];
      return {
        id: normalizeText(item.id) || createId(),
        date: normalizeText(item.date ?? item.data),
        rowTone: ['green', 'red', 'neutral'].includes(item.rowTone)
          ? item.rowTone
          : ['green', 'red', 'neutral'].includes(item.tone)
            ? item.tone
            : 'neutral',
        professorShifts: (shifts.length
          ? shifts
          : [{ time: item.professorTime || item.horarioProfessor || '', name: item.professor || '', swap: item.professorSwap || item.trocaProfessor || '' }]
        ).map((shift) => ({
          id: normalizeText(shift.id) || createId(),
          time: normalizeText(shift.time ?? shift.horario),
          name: normalizeText(shift.name ?? shift.nome),
          swap: normalizeText(shift.swap ?? shift.troca),
        })),
        receptionTime: normalizeText(item.receptionTime ?? item.horarioRecepcao),
        receptionist: normalizeText(item.receptionist ?? item.recepcionista),
        receptionSwap: normalizeText(item.receptionSwap ?? item.trocaRecepcao),
        note: normalizeText(item.note ?? item.observacao),
      };
    })
    .filter((item) => item.date);

  data.events = (Array.isArray(data.events) ? data.events : Array.isArray(data.eventos) ? data.eventos : [])
    .map((item) => ({
      id: normalizeText(item.id) || createId(),
      date: normalizeText(item.date ?? item.data),
      time: normalizeText(item.time ?? item.hora),
      type: normalizeText(item.type ?? item.tipo, 'Evento'),
      title: normalizeText(item.title ?? item.titulo),
      place: normalizeText(item.place ?? item.local),
      owner: normalizeText(item.owner ?? item.responsavel),
      status: normalizeText(item.status ?? item.situacao, 'Programado'),
      description: normalizeText(item.description ?? item.descricao),
    }))
    .filter((item) => item.date || item.title);

  data.addons = data.addons && typeof data.addons === 'object' && !Array.isArray(data.addons) ? data.addons : {};
  data.nps = data.nps && typeof data.nps === 'object' && !Array.isArray(data.nps) ? data.nps : {};
  data.nps.score = clamp(Number(data.nps.score ?? 0), 0, 100);
  data.nps.monthlyGoal = clamp(Number(data.nps.monthlyGoal ?? 75), 0, 100);
  data.nps.semesterGoal = clamp(Number(data.nps.semesterGoal ?? 80), 0, 100);
  data.nps.observations = normalizeText(data.nps.observations);
  data.nps.mentions = (Array.isArray(data.nps.mentions) ? data.nps.mentions : [])
    .map((item) => ({
      id: normalizeText(item.id) || createId(),
      name: normalizeText(item.name ?? item.nome),
      count: Math.max(0, Number(item.count || item.citacoes || 0)),
    }))
    .filter((item) => item.name);
  data.nps.rankSnapshot = normalizeNpsRankSnapshot(data.nps.mentions, data.nps.rankSnapshot);

  hydrateLegacyAddonsFromStudents(data);

  getAddonPeople(data).forEach((person) => {
    data.addons[person] ||= {};
    const knownTypes = [...new Set([...(data.settings.addonTypes || APP_DEFAULTS.addonTypes), ...Object.keys(data.addons[person] || {})])];
    knownTypes.forEach((type) => {
      const values = Array.isArray(data.addons[person][type]) ? data.addons[person][type] : [];
      data.addons[person][type] = Array.from({ length: data.settings.monthDays }, (_, index) => Number(values[index] || 0));
    });
  });
}
