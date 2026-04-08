    // PIPELINE DE MIGRAÇÃO — normalizeStore, getDefaultStore, migrateStoreToV1..V4, migrateStore, sanitizeStore, saveData
    // ══════════════════════════════════════════

    /**
     * @param {Object} store
     * @returns {AppStore}
     */
    function normalizeStore(store) {
      store = store && typeof store === 'object' ? store : {};
      store.activePeriod = isValidPeriodKey(store.activePeriod) ? String(store.activePeriod) : getInitialPeriodKey();
      store.periods = store.periods && typeof store.periods === 'object' && !Array.isArray(store.periods) ? store.periods : {};
      store.archives = store.archives && typeof store.archives === 'object' && !Array.isArray(store.archives) ? store.archives : {};
      store.preferences = normalizeStorePreferences(store.preferences);

      Object.keys(store.periods).forEach(key => {
        if (!isValidPeriodKey(key) || !store.periods[key] || typeof store.periods[key] !== 'object' || Array.isArray(store.periods[key])) {
          delete store.periods[key];
          return;
        }
        normalizeData(store.periods[key]);
      });

      if (!store.periods[store.activePeriod]) {
        const source = Object.values(store.periods)[0] || demoData;
        store.periods[store.activePeriod] = buildBootstrapPeriod(source, store.activePeriod, { storeRef: store });
      }
      return store;
    }

    /** @returns {AppStore} */
    function getDefaultStore() {
      const initialKey = getInitialPeriodKey();
      return sanitizeStore({
        version: STORE_VERSION,
        activePeriod: initialKey,
        preferences: normalizeStorePreferences(),
        periods: seedYear(String(initialKey).split('-')[0], {
          withTestData: APP_STORE_PREFERENCE_DEFAULTS.initializeMonthsWithTestData
        }),
        archives: {}
      });
    }

    // Histórico de versões do armazenamento:
    // V1: baseline inicial.
    // V2: adição do campo events; normalizeData já preenche com [] quando ausente.
    // V3: adição de nps.mentions; normalizeData já preenche com [] quando ausente.
    // V4: reservado para a próxima migração real de schema.

    /**
     * @param {Object} store
     * @returns {AppStore|null}
     */
    function migrateStoreToV1(store) {
      if (!store || typeof store !== 'object') return null;
      // V0 → V1: baseline inicial do store versionado; sem transformação de schema.
      return setStoreVersion(store, 1);
    }

    /**
     * @param {Object} store
     * @returns {AppStore|null}
     */
    function migrateStoreToV2(store) {
      if (!store || typeof store !== 'object') return null;
      // V1 → V2: nenhuma transformação de schema necessária; apenas bump de versão.
      return setStoreVersion(store, 2);
    }

    /**
     * @param {Object} store
     * @returns {AppStore|null}
     */
    function migrateStoreToV3(store) {
      if (!store || typeof store !== 'object') return null;
      // V2 → V3: nenhuma transformação de schema necessária; normalizeData já completa nps.mentions.
      return setStoreVersion(store, 3);
    }

    /**
     * @param {Object} store
     * @returns {AppStore|null}
     */
    function migrateStoreToV4(store) {
      if (!store || typeof store !== 'object') return null;
      // V3 → V4: placeholder para a próxima migração real de schema.
      // TODO: aplicar aqui transformações explícitas quando V4 introduzir campos incompatíveis.
      return setStoreVersion(store, 4);
    }

    /**
     * @param {Object} store
     * @returns {AppStore|null}
     */
    function migrateStore(store) {
      if (!store || typeof store !== 'object') return null;
      let nextStore = store;
      const currentVersion = getStoreVersion(nextStore);

      if (currentVersion < 1) {
        nextStore = migrateStoreToV1(nextStore);
      }
      if (getStoreVersion(nextStore) < 2) {
        nextStore = migrateStoreToV2(nextStore);
      }
      if (getStoreVersion(nextStore) < 3) {
        nextStore = migrateStoreToV3(nextStore);
      }
      if (getStoreVersion(nextStore) < 4) {
        nextStore = migrateStoreToV4(nextStore);
      }

      if (getStoreVersion(nextStore) !== STORE_VERSION) return null;
      return nextStore;
    }

    /**
     * @param {Object} parsed
     * @returns {AppStore|null}
     */
    function sanitizeStore(parsed) {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      if (parsed && parsed.settings && parsed.students) {
        const currentKey = getInitialPeriodKey();
        return normalizeStore(setStoreVersion({
          version: getStoreVersion(parsed),
          activePeriod: currentKey,
          periods: { [currentKey]: cloneSerializable(parsed) },
          archives: {}
        }, getStoreVersion(parsed)));
      }

      if (parsed.periods && typeof parsed.periods === 'object' && !Array.isArray(parsed.periods)) {
        const rawPeriods = Object.fromEntries(
          Object.entries(parsed.periods)
            .filter(([key, value]) => isValidPeriodKey(key) && value && typeof value === 'object' && !Array.isArray(value))
            .map(([key, value]) => [key, cloneSerializable(value)])
        );
        const archives = parsed.archives && typeof parsed.archives === 'object' && !Array.isArray(parsed.archives)
          ? cloneSerializable(parsed.archives)
          : {};
        const preferences = parsed.preferences && typeof parsed.preferences === 'object' && !Array.isArray(parsed.preferences)
          ? cloneSerializable(parsed.preferences)
          : {};
        const store = normalizeStore({
          version: getStoreVersion(parsed),
          activePeriod: parsed.activePeriod,
          periods: rawPeriods,
          archives,
          preferences
        });
        const currentYear = String(store.activePeriod || getInitialPeriodKey()).split('-')[0];
        const template = store.periods[store.activePeriod] || Object.values(store.periods)[0] || demoData;
        Object.entries(seedYear(currentYear, { storeRef: store, template })).forEach(([key, period]) => {
          if (!store.periods[key]) store.periods[key] = period;
        });
        return setStoreVersion(store, getStoreVersion(parsed));
      }
      return null;
    }
