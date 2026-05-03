// Reconstructed state machines from Reversa Task 03.
// Pure transition contracts for domain flows; no storage, DOM, or backend access.

export const MACHINE_NAMES = Object.freeze({
  PERIOD: 'period',
  PENDING: 'pending',
  EVENT: 'event',
  FEEDBACK: 'feedback',
  NPS_NOTICE: 'npsNotice',
  SCALE_ROW: 'scaleRow',
  SYNC: 'sync',
  STORE_SOURCE: 'storeSource',
});

export const STATE_MACHINES = Object.freeze({
  [MACHINE_NAMES.PERIOD]: {
    initial: 'open',
    states: ['open', 'closed'],
    transitions: {
      open: ['closed'],
      closed: ['closed'],
    },
    triggers: {
      create: { from: null, to: 'open' },
      closePeriod: { from: 'open', to: 'closed' },
      closePeriodTransaction: { from: 'open', to: 'closed' },
      editClosedPeriod: { from: 'closed', to: 'closed', blocked: true },
    },
  },

  [MACHINE_NAMES.PENDING]: {
    initial: 'aberto',
    states: ['aberto', 'respondido', 'concluido'],
    transitions: {
      aberto: ['respondido'],
      respondido: ['concluido', 'aberto'],
      concluido: ['respondido'],
    },
    linearOrder: ['aberto', 'respondido', 'concluido'],
  },

  [MACHINE_NAMES.EVENT]: {
    initial: 'Programado',
    states: ['Programado', 'Confirmado', 'Concluído', 'Cancelado'],
    transitions: {
      Programado: ['Confirmado', 'Cancelado'],
      Confirmado: ['Concluído', 'Cancelado'],
      Concluído: [],
      Cancelado: [],
    },
    inferredFlow: true,
    directEditAllowedByRuntime: true,
  },

  [MACHINE_NAMES.FEEDBACK]: {
    initial: 'Pendente',
    states: ['Pendente', 'Respondeu', 'Não respondeu'],
    transitions: {
      Pendente: ['Respondeu', 'Não respondeu'],
      Respondeu: ['Pendente'],
      'Não respondeu': ['Pendente'],
    },
  },

  [MACHINE_NAMES.NPS_NOTICE]: {
    initial: 'Pendente',
    states: ['Pendente', 'Sim', 'Não'],
    transitions: {
      Pendente: ['Sim', 'Não'],
      Sim: ['Pendente'],
      Não: ['Pendente'],
    },
  },

  [MACHINE_NAMES.SCALE_ROW]: {
    initial: 'neutral',
    states: ['neutral', 'green', 'red'],
    transitions: {
      neutral: ['green', 'red'],
      green: ['neutral'],
      red: ['neutral'],
    },
    inferredMeaning: true,
  },

  [MACHINE_NAMES.SYNC]: {
    initial: 'idle',
    states: ['idle', 'loading', 'queued', 'saving', 'conflict', 'error'],
    transitions: {
      idle: ['loading', 'queued'],
      loading: ['idle', 'error'],
      queued: ['saving'],
      saving: ['idle', 'conflict', 'error'],
      conflict: ['loading'],
      error: [],
    },
    triggers: {
      loadRemote: { from: 'idle', to: 'loading' },
      queueLocalSave: { from: 'idle', to: 'queued' },
      debounceExpired: { from: 'queued', to: 'saving' },
      guardedImportOk: { from: 'saving', to: 'idle' },
      checkpointDiverged: { from: 'saving', to: 'conflict' },
      remoteReadOk: { from: 'loading', to: 'idle' },
      remoteReadFailed: { from: 'loading', to: 'error' },
      nonConflictSaveFailure: { from: 'saving', to: 'error' },
      reloadBackendAfterConflict: { from: 'conflict', to: 'loading' },
    },
  },

  [MACHINE_NAMES.STORE_SOURCE]: {
    initial: 'local',
    states: ['local', 'supabase'],
    transitions: {
      local: ['supabase'],
      supabase: ['local'],
    },
    triggers: {
      remoteReadOrSyncOk: { from: 'local', to: 'supabase' },
      errorSignOutOrConflict: { from: 'supabase', to: 'local' },
    },
  },
});

export function getMachine(machineName) {
  const machine = STATE_MACHINES[machineName];
  if (!machine) {
    throw new Error(`Unknown state machine: ${machineName}`);
  }
  return machine;
}

export function getInitialState(machineName) {
  return getMachine(machineName).initial;
}

export function isKnownState(machineName, state) {
  return getMachine(machineName).states.includes(state);
}

export function listStates(machineName) {
  return [...getMachine(machineName).states];
}

export function listNextStates(machineName, currentState) {
  const machine = getMachine(machineName);
  return [...(machine.transitions[currentState] || [])];
}

export function canTransition(machineName, fromState, toState) {
  if (fromState === null || fromState === undefined) {
    return getMachine(machineName).initial === toState;
  }

  return listNextStates(machineName, fromState).includes(toState);
}

export function transition(machineName, fromState, toState, metadata = {}) {
  const machine = getMachine(machineName);
  const normalizedFrom = fromState ?? null;

  if (!canTransition(machineName, normalizedFrom, toState)) {
    return {
      ok: false,
      machine: machineName,
      from: normalizedFrom,
      to: toState,
      state: fromState,
      reason: `Transição inválida em ${machineName}: ${normalizedFrom ?? '[inicio]'} -> ${toState}`,
      metadata,
    };
  }

  return {
    ok: true,
    machine: machineName,
    from: normalizedFrom,
    to: toState,
    state: toState,
    terminal: listNextStates(machineName, toState).length === 0,
    inferredFlow: Boolean(machine.inferredFlow || machine.inferredMeaning),
    metadata,
  };
}

export function transitionByTrigger(machineName, currentState, triggerName, metadata = {}) {
  const machine = getMachine(machineName);
  const trigger = machine.triggers?.[triggerName];

  if (!trigger) {
    return {
      ok: false,
      machine: machineName,
      from: currentState,
      to: currentState,
      state: currentState,
      reason: `Gatilho desconhecido em ${machineName}: ${triggerName}`,
      metadata,
    };
  }

  if (trigger.blocked) {
    return {
      ok: false,
      blocked: true,
      machine: machineName,
      from: currentState,
      to: trigger.to,
      state: currentState,
      reason: `Gatilho bloqueado em ${machineName}: ${triggerName}`,
      metadata,
    };
  }

  if (trigger.from !== null && trigger.from !== currentState) {
    return {
      ok: false,
      machine: machineName,
      from: currentState,
      to: trigger.to,
      state: currentState,
      reason: `Estado atual não aceita ${triggerName}: esperado ${trigger.from}, recebido ${currentState}`,
      metadata,
    };
  }

  return transition(machineName, trigger.from, trigger.to, { ...metadata, trigger: triggerName });
}

export function assertWritablePeriod(periodState) {
  if (periodState === 'closed') {
    return {
      ok: false,
      blocked: true,
      state: periodState,
      reason: 'Períodos fechados bloqueiam edição.',
    };
  }

  return {
    ok: periodState === 'open',
    blocked: false,
    state: periodState,
    reason: periodState === 'open' ? null : `Estado de período desconhecido: ${periodState}`,
  };
}

export function nextPendingStatus(currentStatus, direction = 1) {
  const order = getMachine(MACHINE_NAMES.PENDING).linearOrder;
  const index = order.indexOf(currentStatus);
  if (index === -1) return getInitialState(MACHINE_NAMES.PENDING);
  const nextIndex = Math.min(order.length - 1, Math.max(0, index + Math.sign(direction || 1)));
  return order[nextIndex];
}

export function normalizeState(machineName, state) {
  return isKnownState(machineName, state) ? state : getInitialState(machineName);
}

export function describeMachine(machineName) {
  const machine = getMachine(machineName);
  return {
    name: machineName,
    initial: machine.initial,
    states: listStates(machineName),
    transitions: Object.fromEntries(
      Object.entries(machine.transitions).map(([state, nextStates]) => [state, [...nextStates]]),
    ),
  };
}
