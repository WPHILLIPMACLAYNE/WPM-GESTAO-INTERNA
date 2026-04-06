    // ══════════════════════════════════════════
    // CSV EXPORT — escape, build, download + row builders para pending, scale e events
    // ══════════════════════════════════════════
    // Dependências globais (providas por scripts carregados antes):
    //   state, currentPeriodKey      — estado global / main.js
    //   compareByDateTime            — utils/helpers.js (função pura)

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

    function getPendingCsvRows(period = state) {
      const list = (period.pending || []).slice().sort((a, b) => compareByDateTime(a, b));
      return [
        ['Nome', 'Matrícula', 'Pendência', 'Solicitação', 'Hostess', 'Resposta', 'Status'],
        ...list.map(item => [item.nome || '', item.matricula || '', item.pendencia || '', item.data || '', item.hostess || '', item.resposta || '', item.status || ''])
      ];
    }

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

    function getEventsCsvRows(period = state) {
      const list = (period.events || []).slice().sort((a, b) => compareByDateTime(a, b));
      return [
        ['Data', 'Hora', 'Tipo', 'Título', 'Local', 'Responsável', 'Status', 'Descrição'],
        ...list.map(item => [item.date || '', item.time || '', item.type || '', item.title || '', item.place || '', item.owner || '', item.status || '', item.description || ''])
      ];
    }

    function exportPendingCsv() {
      return downloadCsvFile(`pendencias-${currentPeriodKey}.csv`, getPendingCsvRows());
    }

    function exportScaleCsv() {
      return downloadCsvFile(`escala-${currentPeriodKey}.csv`, getScaleCsvRows());
    }

    function exportEventsCsv() {
      return downloadCsvFile(`eventos-${currentPeriodKey}.csv`, getEventsCsvRows());
    }
