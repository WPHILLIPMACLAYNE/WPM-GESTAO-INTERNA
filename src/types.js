/**
 * src/types.js
 * JSDoc typedefs para as estruturas principais do WPM Gestão Interna.
 * Este arquivo não exporta código — apenas define tipos para checagem estática via jsconfig.json.
 */

// ══════════════════════════════════════════
// ENTIDADES
// ══════════════════════════════════════════

/**
 * @typedef {Object} Student
 * @property {string} id
 * @property {string} nome
 * @property {string} matricula
 * @property {string} ultimaVisita - Data ISO (YYYY-MM-DD)
 * @property {string} horaVisita - Formato HH:mm
 * @property {string} inicio - Data ISO (YYYY-MM-DD)
 * @property {string} avisoNps - "Sim" | "Não" | "Pendente"
 * @property {string} atendimento - Nome do recepcionista
 * @property {string} feedback - "Respondeu" | "Não respondeu" | "Pendente"
 * @property {string} addon - Tipo de addon ou vazio
 * @property {string} observacoes
 */

/**
 * @typedef {Object} PendingItem
 * @property {string} id
 * @property {string} nome
 * @property {string} matricula
 * @property {string} pendencia
 * @property {string} data - Data ISO (YYYY-MM-DD)
 * @property {string} hostess
 * @property {string} resposta
 * @property {string} status - "aberto" | "respondido" | "concluido"
 */

/**
 * @typedef {Object} NpsMention
 * @property {string} id
 * @property {string} name
 * @property {number} count
 */

/**
 * @typedef {Object} NpsData
 * @property {number} score - 0..100
 * @property {number} monthlyGoal - 0..100
 * @property {number} semesterGoal - 0..100
 * @property {string} observations
 * @property {NpsMention[]} mentions
 * @property {Object<string, number>} rankSnapshot - { [mentionId]: position }
 */

/**
 * @typedef {Object} ProfessorShift
 * @property {string} id
 * @property {string} time
 * @property {string} name
 * @property {string} swap
 */

/**
 * @typedef {Object} ScaleEntry
 * @property {string} id
 * @property {string} date - Data ISO (YYYY-MM-DD)
 * @property {string} rowTone - "green" | "red" | "neutral"
 * @property {ProfessorShift[]} professorShifts
 * @property {string} receptionTime
 * @property {string} receptionist
 * @property {string} receptionSwap
 * @property {string} note
 */

/**
 * @typedef {Object} EventItem
 * @property {string} id
 * @property {string} date - Data ISO (YYYY-MM-DD)
 * @property {string} time - Formato HH:mm
 * @property {string} type - "Evento" | "Ação" | "Campanha" | "Treinamento" | "Feriado" | "Outro"
 * @property {string} title
 * @property {string} place
 * @property {string} owner
 * @property {string} status - "Programado" | "Confirmado" | "Concluído" | "Cancelado"
 * @property {string} description
 */

/**
 * @typedef {Object} Recado
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {string} message
 * @property {string} createdAt - ISO timestamp
 * @property {boolean} read
 */

// ══════════════════════════════════════════
// SETTINGS & PERÍODO
// ══════════════════════════════════════════

/**
 * @typedef {Object} PeriodSettings
 * @property {string[]} team
 * @property {string[]} receptionists
 * @property {string[]} professors
 * @property {string[]} addonTypes
 * @property {number} monthDays
 */

/**
 * @typedef {Object} AddonsMap
 * Mapa: { [pessoa: string]: { [tipo: string]: number[] } }
 */

/**
 * @typedef {Object} PeriodData
 * @property {PeriodSettings} settings
 * @property {Student[]} students
 * @property {PendingItem[]} pending
 * @property {Recado[]} recados
 * @property {NpsData} nps
 * @property {ScaleEntry[]} scale
 * @property {EventItem[]} events
 * @property {Object<string, Object<string, number[]>>} addons
 */

/**
 * @typedef {Object} ArchiveEntry
 * @property {string} closedAt - ISO timestamp
 * @property {string} closedAtLabel
 * @property {string} label
 */

/**
 * @typedef {Object} StorePreferences
 * @property {boolean} initializeMonthsWithTestData
 */

/**
 * @typedef {Object} AppStore
 * @property {number} version
 * @property {string} activePeriod - Formato YYYY-MM
 * @property {StorePreferences} preferences
 * @property {Object<string, PeriodData>} periods
 * @property {Object<string, ArchiveEntry>} archives
 */

// ══════════════════════════════════════════
// ESTADO DA UI
// ══════════════════════════════════════════

/**
 * @typedef {Object} AppUIState
 * @property {string} [activeTab]
 * @property {string} [studentSearch]
 * @property {string} [studentFilterAtendente]
 * @property {string} [studentFilterFeedback]
 * @property {string} [pendingSearch]
 * @property {string} [eventSearch]
 * @property {string} [eventTypeFilter]
 * @property {string} [eventStatusFilter]
 * @property {string} [scaleSearch]
 */

// ══════════════════════════════════════════
// RESULTADOS & DERIVADOS
// ══════════════════════════════════════════

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid
 * @property {Object<string, string>} errors
 */

/**
 * @typedef {Object} SaveResult
 * @property {boolean} ok
 * @property {ValidationResult} [validation]
 * @property {PeriodData} [nextState]
 * @property {(Student|PendingItem|EventItem)} [entity]
 */

/**
 * @typedef {Object} RiskBand
 * @property {string} label
 * @property {string} tone
 */

/**
 * @typedef {Object} PersistenceResult
 * @property {boolean} ok
 * @property {boolean} localPersisted
 * @property {boolean} indexedDbPersisted
 */

/**
 * @typedef {Object} PersistenceTechState
 * @property {string} modeLabel
 * @property {string} status
 * @property {string} backendLabel
 * @property {boolean} broadcastAvailable
 * @property {string|null} lastSuccessAt
 * @property {string} lastOperationType
 * @property {number} storeVersion
 * @property {{ status: string, detail: string }} selfTest
 */

/**
 * @typedef {Object} PeriodMetrics
 * @property {number} recados
 * @property {number} students
 * @property {number} pending
 * @property {number} events
 * @property {number} scale
 * @property {number} mentions
 * @property {number} addonVolume
 */

/**
 * @typedef {Object} BackupSummary
 * @property {number} periods
 * @property {number} archives
 * @property {number} recados
 * @property {number} students
 * @property {number} pending
 * @property {number} events
 * @property {number} scale
 * @property {number} mentions
 * @property {number} addonVolume
 */

/**
 * @typedef {Object} ReceptionistSummary
 * @property {string} nome
 * @property {number} total
 * @property {number} comFeedback
 * @property {number} nps
 * @property {number} addon
 * @property {number} addonVolume
 * @property {number} positivos
 * @property {number} taxaFeedback
 * @property {number} taxaAddon
 * @property {number} taxaPositiva
 * @property {number} diferencaTaxa
 */

/**
 * @typedef {Object} AddonTotals
 * @property {Object<string, number>} porPessoa
 * @property {Object<string, Object<string, number>>} porPessoaTipo
 * @property {number} totalGeral
 */

/**
 * @typedef {Object} NpsRankingResult
 * @property {Array<NpsMention & { position: number, tendencia: { classe: string, rotulo: string } }>} ranking
 * @property {number} totalCitacoes
 * @property {(NpsMention & { position: number })|null} top
 * @property {Object<string, number>} mapaRanking
 */

/**
 * @typedef {Object} PendingSummary
 * @property {{ aberto: number, respondido: number, concluido: number }} contagens
 * @property {PendingItem[]} itensDashboard
 * @property {number} total
 * @property {number} abertas
 * @property {number} concluidas
 * @property {PendingItem|null} maisAntigaAberta
 */

/**
 * @typedef {Object} DashboardIndicators
 * @property {number} totalAlunos
 * @property {number} mediaFeedback
 * @property {number} feedbackPositivo
 * @property {number} npsAtual
 * @property {RiskBand} faixaNps
 * @property {number} pendenciasAbertas
 * @property {number} pendenciasConcluidas
 * @property {number} totalPendencias
 * @property {ScaleEntry|null} proximaEscala
 * @property {EventItem|null} proximoEvento
 * @property {ReceptionistSummary[]} resumoRecepcionistas
 * @property {PendingSummary} resumoPendencias
 * @property {AddonTotals} totaisAddons
 * @property {NpsRankingResult} rankingNps
 * @property {ReceptionistSummary|null} destaqueFeedback
 * @property {string} liderAddonNome
 * @property {number} liderAddonTotal
 * @property {(NpsMention & { position: number })|null} itemNpsTopo
 * @property {number} metaMensal
 * @property {number} metaSemestral
 * @property {number} percentualMetaMensal
 * @property {number} percentualMetaSemestral
 * @property {PendingItem|null} maisAntigaAberta
 */

/**
 * @typedef {Object} FlowSmokeReportItem
 * @property {string} label
 * @property {'ok'|'bad'|'warn'|'info'} status
 * @property {string} detail
 */

/**
 * @typedef {Object} CrudHandlerConfig
 * @property {string} name
 * @property {Array} collection
 * @property {function(): Object} getFormData
 * @property {function(PeriodData, Object, Object=): SaveResult} applySave
 * @property {function(ValidationResult): Array<{ id: string, message: string }>} getValidationErrors
 * @property {function(Object, Object, PeriodData): void} [onBeforeSave]
 * @property {function(Object, Object, PeriodData, string): void} [onAfterSave]
 * @property {function(): void} finalizeUI
 * @property {function(): void} renderUI
 * @property {string|string[]} renderTargets
 * @property {function(Object, Array): string|null} [duplicateCheck]
 */
