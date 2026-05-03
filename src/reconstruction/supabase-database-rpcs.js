// Reconstructed Supabase Database/RPCs from Reversa Task 11.
// In-memory executable contract for remote schema roles, checkpoints, guarded imports,
// period transactions, attendance-addon links, and initial admin bootstrap.

import {
  buildImportPreview,
  coerceImportedStore,
  validateImportGuards,
} from './backup-import.js';
import { getNextPeriodKey } from './monthly-lifecycle.js';
import {
  buildCleanPeriodFromTemplate,
  cloneSerializable,
  isValidPeriodKey,
} from './period-builder.js';
import { prepareStoreCandidate } from './schema-migrations.js';
import { normalizeData } from './lifecycle-normalization.js';
import { getPeriodLabel } from './domain-selectors.js';

export const READ_ROLES = Object.freeze(['admin', 'gestor', 'recepcao', 'professor', 'leitura']);
export const WRITE_ROLES = Object.freeze(['admin', 'gestor']);
export const FRONT_DESK_WRITE_ROLES = Object.freeze(['admin', 'gestor', 'recepcao']);
export const WPM_SYNC_CONFLICT = 'WPM_SYNC_CONFLICT';

export function createRpcError(message, code = 'XX000', details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

export function cloneDb(db) {
  return cloneSerializable(db || {});
}

export function createEmptyDatabase() {
  return {
    units: [],
    users: [],
    unitMembers: [],
    periods: [],
    auditEvents: [],
    addonSales: [],
  };
}

export function createSupabaseRpcRuntime(initial = {}) {
  const db = {
    ...createEmptyDatabase(),
    ...cloneDb(initial.db),
  };
  let actor = initial.actor || { userId: null, authRole: 'authenticated', currentUser: 'authenticated' };
  let clock = typeof initial.clock === 'function' ? initial.clock : () => new Date().toISOString();
  let idCounter = 0;
  const locks = new Set();

  function createId(prefix = 'id') {
    idCounter += 1;
    return `${prefix}-${String(idCounter).padStart(4, '0')}`;
  }

  function setActor(nextActor = {}) {
    actor = { ...actor, ...nextActor };
  }

  function setClock(nextClock) {
    clock = typeof nextClock === 'function' ? nextClock : clock;
  }

  function touch(row) {
    row.updatedAt = clock();
    return row;
  }

  function getDatabase() {
    return db;
  }

  function findMembership(unitId, roles = READ_ROLES) {
    if (actor.authRole === 'service_role') return null;
    return db.unitMembers.find((member) => (
      member.unitId === unitId
      && member.userId === actor.userId
      && member.active !== false
      && roles.includes(member.role)
    )) || null;
  }

  function currentUnitRole(unitId) {
    return findMembership(unitId, READ_ROLES)?.role || null;
  }

  function currentUnitMemberId(unitId) {
    return findMembership(unitId, READ_ROLES)?.id || null;
  }

  function hasUnitRole(unitId, roles = READ_ROLES) {
    return actor.authRole === 'service_role' || Boolean(findMembership(unitId, roles));
  }

  function requireUnitRole(unitId, roles = READ_ROLES) {
    if (actor.authRole === 'service_role') return null;
    if (!actor.userId) {
      throw createRpcError('Usuario nao autenticado.', '42501');
    }
    const member = findMembership(unitId, roles);
    if (!member) {
      throw createRpcError(`Permissao insuficiente para a unidade ${unitId}.`, '42501');
    }
    return member.id;
  }

  function resolveMemberId(unitId, displayName) {
    const normalized = String(displayName || '').trim().toLowerCase();
    if (!normalized) return null;
    return db.unitMembers.find((member) => (
      member.unitId === unitId
      && member.active !== false
      && String(member.displayName || '').trim().toLowerCase() === normalized
    ))?.id || null;
  }

  function getUnitPeriods(unitId) {
    return db.periods
      .filter((period) => period.unitId === unitId)
      .sort((left, right) => String(left.periodKey).localeCompare(String(right.periodKey)));
  }

  function toStore(unitId) {
    const periods = {};
    const archives = {};
    let activePeriod = null;

    getUnitPeriods(unitId).forEach((period) => {
      const data = cloneSerializable(period.data || {});
      normalizeData(data);
      periods[period.periodKey] = data;
      if (!activePeriod || period.status === 'open') activePeriod = period.periodKey;
      if (period.status === 'closed') {
        archives[period.periodKey] = {
          closedAt: period.closedAt || clock(),
          closedAtLabel: period.closedAtLabel || period.closedAt || '',
          label: period.label || getPeriodLabel(period.periodKey),
        };
      }
    });

    return prepareStoreCandidate({
      version: 4,
      activePeriod: activePeriod || getUnitPeriods(unitId)[0]?.periodKey || '2026-01',
      preferences: { initializeMonthsWithTestData: false },
      periods,
      archives,
    }, { defaults: { initializeMonthsWithTestData: false } });
  }

  function upsertPeriodFromImport(unitId, periodKey, data, archive = null) {
    if (!isValidPeriodKey(periodKey)) {
      throw createRpcError(`Periodo invalido: ${periodKey}`, '22007');
    }
    const normalized = cloneSerializable(data || {});
    normalizeData(normalized);
    let period = db.periods.find((item) => item.unitId === unitId && item.periodKey === periodKey);
    if (!period) {
      period = {
        id: createId('period'),
        unitId,
        periodKey,
        label: archive?.label || getPeriodLabel(periodKey),
        status: archive ? 'closed' : 'open',
        closedAt: archive?.closedAt || null,
        closedAtLabel: archive?.closedAtLabel || null,
        data: normalized,
        createdAt: clock(),
        updatedAt: clock(),
      };
      db.periods.push(period);
    } else {
      period.label = archive?.label || period.label || getPeriodLabel(periodKey);
      period.status = archive ? 'closed' : 'open';
      period.closedAt = archive?.closedAt || null;
      period.closedAtLabel = archive?.closedAtLabel || null;
      period.data = normalized;
      touch(period);
    }
    return period;
  }

  function logAuditEvent(unitId, periodId, actorMemberId, eventType, entityType, entityId = null, payload = {}) {
    const audit = {
      id: createId('audit'),
      unitId,
      periodId,
      actorMemberId,
      eventType,
      entityType,
      entityId,
      payload: cloneSerializable(payload),
      createdAt: clock(),
    };
    db.auditEvents.push(audit);
    return audit.id;
  }

  function getUnitSyncCheckpoint(unitId) {
    requireUnitRole(unitId, READ_ROLES);
    const periods = getUnitPeriods(unitId);
    const audits = db.auditEvents.filter((event) => event.unitId === unitId);
    const addonSales = db.addonSales.filter((sale) => periods.some((period) => period.id === sale.periodId));
    const timestamps = [
      ...periods.map((period) => period.updatedAt || period.createdAt || ''),
      ...audits.map((event) => event.createdAt || ''),
      ...addonSales.map((sale) => sale.updatedAt || sale.createdAt || ''),
    ].filter(Boolean).sort();
    const rowCount = periods.length + audits.length + addonSales.length;
    const maxUpdatedAt = timestamps.at(-1) || '';
    const revision = rowCount === 0 && periods.length === 0 && audits.length === 0
      ? ''
      : [maxUpdatedAt, periods.length, rowCount, audits.length].join(':');

    return {
      revision,
      maxUpdatedAt,
      periodCount: periods.length,
      auditCount: audits.length,
    };
  }

  function importBackupTransaction(unitId, payload, options = {}) {
    const actorMemberId = requireUnitRole(unitId, WRITE_ROLES);
    const beforeStore = toStore(unitId);
    const preview = buildImportPreview(payload, beforeStore, {
      ...options,
      defaults: { initializeMonthsWithTestData: false },
    });
    const guard = validateImportGuards(payload, preview, {
      ...options,
      previewAccepted: options.previewAccepted,
      requireIntegrity: options.requireIntegrity !== false,
      requireTrustedSource: options.requireTrustedSource !== false,
    });
    if (!guard.ok) {
      throw createRpcError(guard.message || `Import guard failed: ${guard.reason}`, 'WPM_IMPORT_GUARD', { guard });
    }
    const targetStore = preview.targetStore || coerceImportedStore(payload, beforeStore, options);
    if (!targetStore) {
      throw createRpcError('Payload remoto invalido.', '22023');
    }
    const descriptor = preview.descriptor;
    const existingKeys = new Set(getUnitPeriods(unitId).map((period) => period.periodKey));
    const targetKeys = new Set(Object.keys(targetStore.periods || {}));
    let deletedPeriods = 0;

    if (descriptor.kind === 'full-backup') {
      db.periods = db.periods.filter((period) => {
        if (period.unitId !== unitId || targetKeys.has(period.periodKey)) return true;
        deletedPeriods += 1;
        return false;
      });
    }

    Object.entries(targetStore.periods || {}).forEach(([periodKey, periodData]) => {
      const archive = targetStore.archives?.[periodKey] || null;
      upsertPeriodFromImport(unitId, periodKey, periodData, archive);
    });

    const importedPeriods = targetKeys.size;
    logAuditEvent(unitId, null, actorMemberId, 'backup-import', 'store', null, {
      kind: descriptor.kind,
      importedPeriods,
      deletedPeriods,
    });

    return {
      ok: true,
      kind: descriptor.kind,
      importedPeriods,
      deletedPeriods,
      previousPeriodCount: existingKeys.size,
      currentPeriodCount: getUnitPeriods(unitId).length,
    };
  }

  async function importBackupTransactionGuarded(unitId, payload, expectedCheckpoint = null, options = {}) {
    requireUnitRole(unitId, WRITE_ROLES);
    if (locks.has(unitId)) {
      throw createRpcError('Importacao ja em andamento para esta unidade.', '55P03');
    }
    locks.add(unitId);
    try {
      const currentCheckpoint = getUnitSyncCheckpoint(unitId);
      if (!expectedCheckpoint) {
        if (currentCheckpoint.periodCount > 0 || currentCheckpoint.auditCount > 0) {
          throw createRpcError(
            `${WPM_SYNC_CONFLICT}: backend possui dados sem checkpoint local conhecido; recarregue do backend antes de sincronizar.`,
            WPM_SYNC_CONFLICT,
            { currentCheckpoint },
          );
        }
      } else if (JSON.stringify(currentCheckpoint) !== JSON.stringify(expectedCheckpoint)) {
        throw createRpcError(
          `${WPM_SYNC_CONFLICT}: checkpoint remoto divergente; recarregue do backend antes de sincronizar.`,
          WPM_SYNC_CONFLICT,
          { currentCheckpoint, expectedCheckpoint },
        );
      }

      const result = importBackupTransaction(unitId, payload, options);
      return {
        ...result,
        previousCheckpoint: currentCheckpoint,
        nextCheckpoint: getUnitSyncCheckpoint(unitId),
      };
    } finally {
      locks.delete(unitId);
    }
  }

  function closePeriodTransaction(unitId, payload = {}, periodKey = null, periodLabel = null, resetNextPeriod = false) {
    const actorMemberId = requireUnitRole(unitId, WRITE_ROLES);
    const key = periodKey || payload.periodKey || payload.activePeriod;
    const period = db.periods.find((item) => item.unitId === unitId && item.periodKey === key);
    if (!period) throw createRpcError(`Periodo ${key} nao encontrado.`, 'P0002');
    if (period.status === 'closed') throw createRpcError(`Periodo ${key} ja esta fechado.`, '22023');

    period.status = 'closed';
    period.closedAt = clock();
    period.closedAtLabel = period.closedAt;
    period.label = periodLabel || period.label || getPeriodLabel(key);
    touch(period);
    logAuditEvent(unitId, period.id, actorMemberId, 'close-month', 'period', period.id, { periodKey: key });

    const nextKey = getNextPeriodKey(key);
    let nextPeriod = db.periods.find((item) => item.unitId === unitId && item.periodKey === nextKey);
    let nextAction = 'preserved';
    if (!nextPeriod) {
      nextPeriod = upsertPeriodFromImport(unitId, nextKey, buildCleanPeriodFromTemplate(period.data, nextKey), null);
      nextAction = 'created';
    } else if (resetNextPeriod) {
      nextPeriod.status = 'open';
      nextPeriod.closedAt = null;
      nextPeriod.closedAtLabel = null;
      nextPeriod.data = buildCleanPeriodFromTemplate(period.data, nextKey);
      touch(nextPeriod);
      nextAction = 'reset';
    }

    return {
      ok: true,
      periodKey: key,
      status: period.status,
      nextPeriodKey: nextKey,
      nextAction,
    };
  }

  function resetPeriodTransaction(unitId, payload = {}) {
    const actorMemberId = requireUnitRole(unitId, WRITE_ROLES);
    const key = payload.periodKey || payload.activePeriod;
    const period = db.periods.find((item) => item.unitId === unitId && item.periodKey === key);
    if (!period) throw createRpcError(`Periodo ${key} nao encontrado.`, 'P0002');
    if (period.status === 'closed') throw createRpcError(`Periodo ${key} esta fechado e nao pode ser resetado.`, '22023');

    const monthlyGoal = Number(period.data?.nps?.monthlyGoal ?? 75);
    const semesterGoal = Number(period.data?.nps?.semesterGoal ?? 80);
    period.data = buildCleanPeriodFromTemplate(period.data, key);
    period.data.nps.monthlyGoal = monthlyGoal;
    period.data.nps.semesterGoal = semesterGoal;
    normalizeData(period.data);
    touch(period);
    logAuditEvent(unitId, period.id, actorMemberId, 'reset-month', 'period', period.id, { periodKey: key });

    return { ok: true, periodKey: key, monthlyGoal, semesterGoal };
  }

  function linkStudentAttendanceAddonTransaction(unitId, attendanceId, saleDate = null, quantity = 1) {
    const actorMemberId = requireUnitRole(unitId, FRONT_DESK_WRITE_ROLES);
    const period = getUnitPeriods(unitId).find((item) => (
      (item.data?.students || []).some((student) => student.id === attendanceId)
    ));
    if (!period) throw createRpcError(`Atendimento ${attendanceId} nao encontrado.`, 'P0002');
    const student = period.data.students.find((item) => item.id === attendanceId);
    const existingIndex = db.addonSales.findIndex((sale) => sale.periodId === period.id && sale.attendanceId === attendanceId && sale.source === 'student_attendance');

    if (!student.addon) {
      if (existingIndex >= 0) {
        const [deleted] = db.addonSales.splice(existingIndex, 1);
        logAuditEvent(unitId, period.id, actorMemberId, 'attendance-addon-link', 'addon_sale', deleted.id, { saleAction: 'deleted' });
        return { ok: true, saleAction: 'deleted', saleId: deleted.id };
      }
      return { ok: true, saleAction: 'none' };
    }

    const sale = existingIndex >= 0 ? db.addonSales[existingIndex] : {
      id: createId('sale'),
      periodId: period.id,
      attendanceId,
      source: 'student_attendance',
      createdAt: clock(),
    };
    sale.saleDate = saleDate || student.inicio || `${period.periodKey}-01`;
    sale.receptionistNameSnapshot = student.atendimento || '';
    sale.addonTypeSnapshot = student.addon;
    sale.quantity = Math.max(0, Number(quantity || 0));
    touch(sale);
    if (existingIndex < 0) db.addonSales.push(sale);
    logAuditEvent(unitId, period.id, actorMemberId, 'attendance-addon-link', 'addon_sale', sale.id, { saleAction: existingIndex >= 0 ? 'updated' : 'created' });

    return { ok: true, saleAction: existingIndex >= 0 ? 'updated' : 'created', saleId: sale.id, quantity: sale.quantity };
  }

  function bootstrapUnitAdmin({
    userId,
    unitName,
    unitSlug,
    displayName,
    periodKey = '2026-01',
    timezone = 'America/Sao_Paulo',
    monthDays = null,
  } = {}) {
    if (actor.authRole !== 'service_role' && !['postgres', 'supabase_admin'].includes(actor.currentUser)) {
      throw createRpcError('bootstrap_unit_admin so pode ser executada por service_role ou SQL administrativo.', '42501');
    }
    if (!userId) throw createRpcError('p_user_id e obrigatorio.', '22023');
    if (!String(unitName || '').trim()) throw createRpcError('p_unit_name e obrigatorio.', '22023');
    if (!String(unitSlug || '').trim()) throw createRpcError('p_unit_slug e obrigatorio.', '22023');
    if (!String(displayName || '').trim()) throw createRpcError('p_display_name e obrigatorio.', '22023');
    if (!isValidPeriodKey(periodKey)) throw createRpcError('p_period_key deve seguir o formato YYYY-MM.', '22007');
    if (monthDays !== null && (monthDays < 28 || monthDays > 31)) throw createRpcError('p_month_days deve estar entre 28 e 31.', '22023');
    if (!db.users.some((user) => user.id === userId)) throw createRpcError(`Usuario ${userId} nao existe em public.users.`, '23503');

    const slug = String(unitSlug).trim().toLowerCase();
    let unit = db.units.find((item) => item.slug === slug);
    if (!unit) {
      unit = { id: createId('unit'), slug, createdAt: clock() };
      db.units.push(unit);
    }
    unit.name = String(unitName).trim();
    unit.timezone = String(timezone || 'America/Sao_Paulo').trim() || 'America/Sao_Paulo';
    unit.active = true;
    touch(unit);

    const otherAdmin = db.unitMembers.find((member) => member.unitId === unit.id && member.active !== false && member.role === 'admin' && member.userId !== userId);
    if (otherAdmin) {
      throw createRpcError(`A unidade ${unit.id} ja possui outro admin ativo; bootstrap inicial recusado.`, '23505');
    }

    let member = db.unitMembers.find((item) => item.unitId === unit.id && item.userId === userId);
    if (!member) {
      member = { id: createId('member'), unitId: unit.id, userId, createdAt: clock() };
      db.unitMembers.push(member);
    }
    member.displayName = String(displayName).trim();
    member.role = 'admin';
    member.active = true;
    touch(member);

    let period = db.periods.find((item) => item.unitId === unit.id && item.periodKey === periodKey);
    if (!period) {
      const data = buildCleanPeriodFromTemplate({ settings: { monthDays: monthDays || undefined } }, periodKey);
      period = upsertPeriodFromImport(unit.id, periodKey, data, null);
    }

    return {
      bootUnitId: unit.id,
      bootUnitMemberId: member.id,
      bootPeriodId: period.id,
    };
  }

  return {
    getDatabase,
    setActor,
    setClock,
    currentUnitRole,
    currentUnitMemberId,
    hasUnitRole,
    requireUnitRole,
    resolveMemberId,
    toStore,
    getUnitSyncCheckpoint,
    importBackupTransaction,
    importBackupTransactionGuarded,
    closePeriodTransaction,
    resetPeriodTransaction,
    linkStudentAttendanceAddonTransaction,
    bootstrapUnitAdmin,
    logAuditEvent,
    upsertPeriodFromImport,
  };
}
