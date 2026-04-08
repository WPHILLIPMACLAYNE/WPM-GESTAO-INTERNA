    // ══════════════════════════════════════════
    // CSV EXPORT — escape, build, download + row builders para pending, scale e events
    // ══════════════════════════════════════════
    // Dependências globais (providas por scripts carregados antes):
    //   state, currentPeriodKey      — estado global / core/config.js
    //   compareByDateTime            — utils/helpers.js (função pura)

    /** Triggers a CSV file download in the browser. @param {string} filename @param {string[][]} rows @returns {string} */
    function downloadCsvFile(filename, rows) {
      const csv = buildCsvContent(rows);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      return csv;
    }

    /** Builds CSV rows for pending items. @param {PeriodData} [period] @returns {string[][]} */
    function getPendingCsvRows(period = state) {
      const list = (period.pending || []).slice().sort((a, b) => compareByDateTime(a, b));
      return [
        ['Nome', 'Matrícula', 'Pendência', 'Solicitação', 'Hostess', 'Resposta', 'Status'],
        ...list.map(item => [item.nome || '', item.matricula || '', item.pendencia || '', item.data || '', item.hostess || '', item.resposta || '', item.status || ''])
      ];
    }

    /** Builds CSV rows for scale entries. @param {PeriodData} [period] @returns {string[][]} */
    function getScaleCsvRows(period = state) {
      const rows = [['Data', 'Professor', 'Horário professor', 'Troca professor', 'Recepção', 'Horário recepção', 'Troca recepção', 'Tom da linha', 'Observação']];
      (period.scale || []).slice().sort((a, b) => compareByDateTime(a, b)).forEach(item => {
        const shifts = item.professorShifts?.length ? item.professorShifts : [{ time: '', name: '', swap: '' }];
        shifts.forEach(shift => {
          rows.push([item.date || '', shift.name || '', shift.time || '', shift.swap || '', item.receptionist || '', item.receptionTime || '', item.receptionSwap || '', item.rowTone || '', item.note || '']);
        });
      });
      return rows;
    }

    /** Builds CSV rows for event items. @param {PeriodData} [period] @returns {string[][]} */
    function getEventsCsvRows(period = state) {
      const list = (period.events || []).slice().sort((a, b) => compareByDateTime(a, b));
      return [
        ['Data', 'Hora', 'Tipo', 'Título', 'Local', 'Responsável', 'Status', 'Descrição'],
        ...list.map(item => [item.date || '', item.time || '', item.type || '', item.title || '', item.place || '', item.owner || '', item.status || '', item.description || ''])
      ];
    }

    /** Exports pending items as a downloadable CSV. @returns {string} */
    function exportPendingCsv() {
      return downloadCsvFile(`pendencias-${currentPeriodKey}.csv`, getPendingCsvRows());
    }

    /** Exports scale entries as a downloadable CSV. @returns {string} */
    function exportScaleCsv() {
      return downloadCsvFile(`escala-${currentPeriodKey}.csv`, getScaleCsvRows());
    }

    /** Exports event items as a downloadable CSV. @returns {string} */
    function exportEventsCsv() {
      return downloadCsvFile(`eventos-${currentPeriodKey}.csv`, getEventsCsvRows());
    }
