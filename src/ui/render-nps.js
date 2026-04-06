    function getSortedMentions() {
      return selecionarRankingNps().ranking;
    }

    function getRankMap() {
      return { ...selecionarRankingNps().mapaRanking };
    }

    function captureNpsRankSnapshot() {
      state.nps.rankSnapshot = getRankMap();
    }

    function trendBadge(item) {
      return `<span class="trend-badge ${item.tendencia?.classe || 'trend-stable'}">${item.tendencia?.rotulo || '— estável'}</span>`;
    }

    function getNpsHistoryRows(limit = 6) {
      try {
        const periods = storage?.periods || {};
        return Object.keys(periods)
          .filter(key => key && key !== currentPeriodKey)
          .sort((a, b) => b.localeCompare(a))
          .map(key => {
            const period = periods[key];
            const score = clamp(Number(period?.nps?.score || 0), 0, 100);
            const mentions = Array.isArray(period?.nps?.mentions)
              ? period.nps.mentions.reduce((acc, item) => acc + Number(item?.count || 0), 0)
              : 0;
            const observations = String(period?.nps?.observations || '').trim();
            const hasSignal = score > 0 || mentions > 0 || observations;
            if (!hasSignal) return null;
            return {
              key,
              label: getPeriodLabel(key),
              score,
              band: getRiskBand(score)
            };
          })
          .filter(Boolean)
          .slice(0, limit);
      } catch (error) {
        console.error('Falha ao montar histórico de NPS:', error);
        return [];
      }
    }

    function renderNps() {
      const score = clamp(Number(state.nps.score || 0), 0, 100);
      const band = getRiskBand(score);
      const rankingNps = selecionarRankingNps();
      const pointerLeft = `calc(${score}% - ${score === 100 ? 12 : 0}px)`;

      const monthlyGoal = clamp(Number(state.nps.monthlyGoal ?? 75), 0, 100);
      const semesterGoal = clamp(Number(state.nps.semesterGoal ?? 80), 0, 100);
      const monthlyProgress = getNpsGoalProgress(score, monthlyGoal);
      const semesterProgress = getNpsGoalProgress(score, semesterGoal);
      const historyRows = getNpsHistoryRows();
      document.getElementById('npsMeterBox').innerHTML = `
        <div class="score-hero">
          <div class="nps-score-copy">
            <div class="score-number">${score}</div>
            <div class="score-band">${esc(band.label)}</div>
          </div>
          <div class="goal-pills">
            <div class="goal-pill-strong"><span>Citações no mês</span><strong>${rankingNps.totalCitacoes}</strong></div>
            <div class="goal-pill-strong"><span>Meta mensal</span><strong>${monthlyGoal}</strong></div>
            <div class="goal-pill-strong"><span>Meta semestral</span><strong>${semesterGoal}</strong></div>
          </div>
        </div>
        <div class="risk-meter-wrap">
          <div class="risk-pointer" style="left:${pointerLeft};">
            <div class="marker-value">${score}</div>
            <div class="marker"></div>
          </div>
          <div class="risk-meter">
            <div class="risk-segment risk-red"></div>
            <div class="risk-segment risk-orange"></div>
            <div class="risk-segment risk-yellow"></div>
            <div class="risk-segment risk-green-light"></div>
            <div class="risk-segment risk-green-dark"></div>
          </div>
          <div class="risk-scale">
            <div>0–20</div>
            <div>21–40</div>
            <div>41–60</div>
            <div>61–80</div>
            <div>81–100</div>
          </div>
        </div>
        <div class="score-slider-row nps-grid-3">
          <div class="field">
            <label>Pontuação NPS</label>
            <input id="npsScoreInput" type="number" min="0" max="100" value="${score}" aria-label="Pontuação NPS" data-input-action="update-nps-score" data-source="input" />
          </div>
          <div class="field">
            <label>Meta mensal NPS</label>
            <input id="npsMonthlyGoalInput" type="number" min="0" max="100" value="${monthlyGoal}" aria-label="Meta mensal de NPS" data-input-action="update-nps-goal" data-field="monthlyGoal" />
          </div>
          <div class="field">
            <label>Meta semestral NPS</label>
            <input id="npsSemesterGoalInput" type="number" min="0" max="100" value="${semesterGoal}" aria-label="Meta semestral de NPS" data-input-action="update-nps-goal" data-field="semesterGoal" />
          </div>
        </div>
        <div class="score-slider-row">
          <div class="field">
            <label>Ajuste rápido</label>
            <input id="npsScoreRange" type="range" min="0" max="100" value="${score}" aria-label="Ajuste rápido da pontuação NPS" data-input-action="update-nps-score" data-source="range" />
          </div>
        </div>
        <div class="nps-goals-panel">
          <div class="nps-progress-grid">
            <div class="nps-progress-card">
              <div class="nps-progress-head">
                <div class="nps-progress-title">Progresso da meta mensal</div>
                <div class="nps-progress-meta">${score}/${monthlyGoal} • ${Math.round(monthlyProgress)}%${monthlyProgress >= 100 ? ' ✓' : ''}</div>
              </div>
              <div class="nps-progress-track"><div class="nps-progress-fill" style="width:${Math.min(100, monthlyProgress)}%"></div></div>
            </div>
            <div class="nps-progress-card">
              <div class="nps-progress-head">
                <div class="nps-progress-title">Progresso da meta semestral</div>
                <div class="nps-progress-meta">${score}/${semesterGoal} • ${Math.round(semesterProgress)}%${semesterProgress >= 100 ? ' ✓' : ''}</div>
              </div>
              <div class="nps-progress-track"><div class="nps-progress-fill" style="width:${Math.min(100, semesterProgress)}%"></div></div>
            </div>
          </div>
        </div>
      `;

      aplicarHtmlSeMudou(document.getElementById('npsHistoryBox'), historyRows.length ? `
        <div class="nps-history-panel">
          <div class="toolbar-title">
            <span class="section-kicker">Evolução</span>
            <h2>Histórico de NPS</h2>
            <p>Leitura rápida dos meses anteriores disponíveis na base local.</p>
          </div>
          <div class="nps-history-list">
            ${historyRows.map(item => `
              <div class="nps-history-item">
                <div class="nps-history-period">${esc(item.label)}</div>
                <div class="nps-history-score">${item.score}</div>
                <div class="nps-history-band ${getNpsHistoryBandClass(item.score)}">${esc(item.band.label)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="nps-history-panel">
          <div class="toolbar-title">
            <span class="section-kicker">Evolução</span>
            <h2>Histórico de NPS</h2>
            <p>Leitura rápida dos meses anteriores disponíveis na base local.</p>
          </div>
          <div class="empty nps-history-empty">Dados de meses anteriores aparecerão aqui conforme o uso.</div>
        </div>
      `);

      document.getElementById('npsObservations').value = state.nps.observations || '';

      const ranking = rankingNps.ranking;
      document.getElementById('npsRankingList').innerHTML = ranking.length ? ranking.map(item => `
        <div class="rank-item">
          <div class="rank-left">
            <div class="rank-position">#${item.position}</div>
            <div class="rank-name-group">
              <div class="rank-name-line">
                ${item.position === 1 ? '<span class="crown">👑</span>' : ''}
                <input class="rank-name-input" value="${esc(item.name)}" aria-label="Nome do funcionário citado na posição ${item.position}" data-blur-action="rename-mention" data-id="${item.id}" />
                ${trendBadge(item)}
              </div>
              <div class="rank-meta">${item.count} cita${item.count === 1 ? 'ção' : 'ções'} no mês</div>
            </div>
          </div>
          <div class="rank-actions">
            <button class="btn btn-ghost btn-xs" data-action="adjust-mention" data-id="${item.id}" data-delta="-1" aria-label="Reduzir em uma citação para ${esc(item.name)}">-1</button>
            <input class="count-box" type="number" min="0" value="${item.count}" aria-label="Quantidade de citações de ${esc(item.name)}" data-change-action="set-mention-count" data-id="${item.id}" />
            <button class="btn btn-primary btn-xs" data-action="adjust-mention" data-id="${item.id}" data-delta="1" aria-label="Aumentar em uma citação para ${esc(item.name)}">+1</button>
            <button class="btn btn-danger btn-xs" data-action="remove-mention" data-id="${item.id}" aria-label="Excluir ${esc(item.name)} do ranking de NPS">Excluir</button>
          </div>
        </div>
      `).join('') : '<div class="empty">Ainda não há funcionários citados no NPS.</div>';

      const lideres = selecionarLideresHistoricos();
      aplicarHtmlSeMudou(document.getElementById('npsHistLeaders'), lideres.length ? `
        <div class="hist-leaders">
          <div class="hist-leaders-title">Líderes dos meses anteriores</div>
          <div class="hist-leaders-subtitle">Resumo dos destaques de addons e citações NPS dos períodos já fechados.</div>
          <div class="hist-leaders-list">
            ${lideres.map(m => `
              <div class="hist-leaders-card">
                <div class="hist-leaders-period">${esc(m.label)}</div>
                <div class="hist-leaders-row">
                  <span class="hist-leaders-label">Líder addons</span>
                  <span class="hist-leaders-value">${m.addonLeader ? `${esc(m.addonLeader.name)}<span class="hl-total">${m.addonLeader.total}</span>` : 'Sem dados'}</span>
                </div>
                <div class="hist-leaders-row">
                  <span class="hist-leaders-label">Líder NPS</span>
                  <span class="hist-leaders-value">${m.npsLeader ? `${esc(m.npsLeader.name)}<span class="hl-total">${m.npsLeader.total} cit.</span>` : 'Sem dados'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="hist-leaders">
          <div class="hist-leaders-title">Líderes dos meses anteriores</div>
          <div class="hist-leaders-subtitle">Resumo dos destaques de addons e citações NPS dos períodos já fechados.</div>
          <div class="hist-leaders-empty">Dados de meses anteriores aparecerão aqui conforme o uso.</div>
        </div>
      `);
    }

    function updateNpsScore(value, source) {
      if (!assertWritableCurrentPeriod({ rerender: ['hero', 'dashboard', 'nps'] })) return;
      state.nps.score = clamp(Number(value || 0), 0, 100);
      saveData();
      requestRender(['hero', 'dashboard', 'nps']);
      if (source === 'input') {
        DOM.setValue('npsScoreRange', state.nps.score);
      } else {
        DOM.setValue('npsScoreInput', state.nps.score);
      }
    }

    function updateNpsGoal(field, value) {
      if (!assertWritableCurrentPeriod({ rerender: ['dashboard', 'nps'] })) return;
      state.nps[field] = clamp(Number(value || 0), 0, 100);
      saveData();
      requestRender(['dashboard', 'nps']);
    }

    // NPS actions movidas para src/features/nps.js
