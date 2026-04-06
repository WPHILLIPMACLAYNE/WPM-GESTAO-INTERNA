    // CAMADA DE SEED — massa determinística por período e helpers de geração
    // ══════════════════════════════════════════

    function makeRng(seed) {
      let h = 1779033703 ^ String(seed).length;
      for (let i = 0; i < String(seed).length; i++) {
        h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
      };
    }

    function pick(list, rng) {
      return list[Math.floor(rng() * list.length)] || '';
    }

    function maybe(list, rng, chance = 0.5) {
      return rng() <= chance ? pick(list, rng) : '';
    }

    function generatePeriodSeed(periodKey) {
      const [yearStr, monthStr] = String(periodKey).split('-');
      const year = Number(yearStr) || new Date().getFullYear();
      const month = Number(monthStr) || 1;
      const monthDays = new Date(year, month, 0).getDate();
      const rng = makeRng(`smartfit-${periodKey}`);
      const receptionists = [...APP_DEFAULTS.receptionists];
      const professors = [...APP_DEFAULTS.professors];
      const addonTypes = [...APP_DEFAULTS.addonTypes];
      const base = {
        settings: {
          team: [...receptionists],
          receptionists: [...receptionists],
          professors: [...professors],
          addonTypes: [...addonTypes],
          monthDays
        },
        students: [],
        nps: { score: 0, monthlyGoal: 75, semesterGoal: 80, observations: '', mentions: [], rankSnapshot: {} },
        scale: [],
        events: [],
        pending: [],
        addons: {}
      };

      seedAddons(base);
      const matriculaBase = year * 10000 + month * 100;
      for (let i = 0; i < 30; i++) {
        const day = String(1 + Math.floor(rng() * monthDays)).padStart(2, '0');
        const date = `${yearStr}-${String(month).padStart(2, '0')}-${day}`;
        const name = `${pick(APP_DEFAULTS.studentFirstNames, rng)} ${pick(APP_DEFAULTS.studentLastNames, rng)}`;
        const atendimento = pick(receptionists, rng);
        const addon = rng() < 0.62 ? pick(addonTypes, rng) : '';
        const feedbackRoll = rng();
        const feedback = feedbackRoll < 0.45 ? 'Respondeu' : feedbackRoll < 0.72 ? 'Não respondeu' : 'Pendente';
        const student = {
          id: crypto.randomUUID(),
          nome: name,
          matricula: String(matriculaBase + i + 1),
          ultimaVisita: date,
          horaVisita: `${String(6 + Math.floor(rng() * 15)).padStart(2, '0')}:${pick(['00','10','20','30','40','50'], rng)}`,
          inicio: date,
          avisoNps: rng() < 0.65 ? 'Sim' : 'Não',
          atendimento,
          feedback,
          addon,
          observacoes: `${pick(APP_DEFAULTS.notes, rng)} ${rng() < 0.4 ? 'Perfil com potencial para retenção.' : 'Acompanhar próxima visita.'}`
        };
        base.students.push(student);
        if (addon) {
          const idx = Math.max(0, Math.min(monthDays - 1, Number(day) - 1));
          base.addons[atendimento][addon][idx] = Number(base.addons[atendimento][addon][idx] || 0) + 1;
        }
      }

      const statuses = ['aberto', 'respondido', 'concluido'];
      for (let i = 0; i < 20; i++) {
        const student = base.students[Math.floor(rng() * base.students.length)];
        const day = String(1 + Math.floor(rng() * monthDays)).padStart(2, '0');
        const status = statuses[Math.floor(rng() * statuses.length)];
        base.pending.push({
          id: crypto.randomUUID(),
          nome: student.nome,
          matricula: student.matricula,
          pendencia: `${pick(APP_DEFAULTS.pendingTopics, rng)} — ${pick(['prioridade alta', 'acompanhar no próximo turno', 'validar no sistema', 'cliente aguardando retorno'], rng)}.`,
          data: `${yearStr}-${String(month).padStart(2, '0')}-${day}`,
          hostess: pick(receptionists, rng),
          resposta: status === 'aberto' ? '' : pick(APP_DEFAULTS.pendingResponses, rng),
          status
        });
      }

      const mentions = getAllEmployees(base).map(name => ({
        id: crypto.randomUUID(),
        name,
        count: 1 + Math.floor(rng() * 18)
      }));
      const totalMentions = mentions.reduce((acc, item) => acc + item.count, 0);
      const positiveStudents = base.students.filter(item => item.feedback === 'Respondeu').length;
      base.nps = {
        score: clamp(Math.round((positiveStudents / Math.max(1, base.students.length)) * 100), 35, 98),
        monthlyGoal: 75,
        semesterGoal: 80,
        observations: `Mês ${MONTH_NAMES[month - 1]} com ${totalMentions} citações distribuídas entre recepção e professores. Reforçar retorno ativo em horários de pico e manter abordagem comercial padronizada.`,
        mentions,
        rankSnapshot: Object.fromEntries(mentions.map(item => [item.name, item.count]))
      };

      for (let day = 1; day <= monthDays; day++) {
        const date = `${yearStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const rowTone = suggestScaleTone(date);
        const shiftsCount = 1 + Math.floor(rng() * 3);
        const professorShifts = Array.from({ length: shiftsCount }, () => ({
          id: crypto.randomUUID(),
          time: pick(APP_DEFAULTS.scaleTimes, rng),
          name: pick(professors, rng),
          swap: rng() < 0.22 ? 'Cobertura' : ''
        }));
        base.scale.push({
          id: crypto.randomUUID(),
          date,
          rowTone,
          professorShifts,
          receptionTime: pick(APP_DEFAULTS.scaleTimes, rng),
          receptionist: pick(receptionists, rng),
          receptionSwap: rng() < 0.15 ? 'Troca aprovada' : '',
          note: pick(APP_DEFAULTS.notes, rng)
        });
      }

      for (let i = 0; i < 10; i++) {
        const day = String(1 + Math.floor(rng() * monthDays)).padStart(2, '0');
        const type = pick(APP_DEFAULTS.eventTypes, rng);
        base.events.push({
          id: crypto.randomUUID(),
          date: `${yearStr}-${String(month).padStart(2, '0')}-${day}`,
          time: `${String(7 + Math.floor(rng() * 13)).padStart(2, '0')}:${pick(['00','15','30','45'], rng)}`,
          type,
          title: pick(APP_DEFAULTS.eventTitles, rng),
          place: pick(APP_DEFAULTS.eventPlaces, rng),
          owner: pick(APP_DEFAULTS.eventOwners, rng),
          status: type === 'Feriado' ? 'Confirmado' : pick(APP_DEFAULTS.eventStatuses, rng),
          description: `${pick(APP_DEFAULTS.notes, rng)} ${pick(['Acionar equipe completa.', 'Preparar comunicação visual.', 'Registrar resultados no fechamento do mês.', 'Acompanhar leads gerados no mesmo dia.'], rng)}`
        });
      }

      return base;
    }

    const demoData = generatePeriodSeed(getInitialPeriodKey());
