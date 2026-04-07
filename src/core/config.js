/**
 * src/core/config.js
 * Constantes, chaves, versões, defaults e labels fixos.
 * Carregado via <script> antes de main.js.
 */

    // ══════════════════════════════════════════
    // CONSTANTES & CONFIGURAÇÃO
    // ══════════════════════════════════════════

    const STORAGE_KEY = 'recepcao-smartfit-dashboard-v34';
    const STORAGE_BROADCAST_KEY = 'recepcao-smartfit-dashboard-sync-v34';
    const STORE_VERSION = 4;
    const LEGACY_STORAGE_KEYS = ['recepcao-smartfit-dashboard-v33', 'recepcao-smartfit-dashboard-v24'];
    const APP_VERSION = 'v34';
    const APP_RUNTIME = (() => {
      try {
        const protocol = String(window?.location?.protocol || '').toLowerCase();
        const hostname = String(window?.location?.hostname || '').toLowerCase();
        const isLocalhost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
        return (protocol === 'http:' || protocol === 'https:') && isLocalhost ? 'development' : 'production';
      } catch {
        return 'production';
      }
    })();
    const DEFAULT_INITIALIZE_MONTHS_WITH_TEST_DATA = APP_RUNTIME === 'development';
    const LOCAL_SNAPSHOT_KEY = 'controle_recepcao_app_snapshot_v34';
    const SYSTEM_REPORT_KEY = 'controle_recepcao_app_report_v34';
    const FLOW_TEST_REPORT_KEY = 'controle_recepcao_app_flowtests_v34';
    const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const UI_KEY = 'controle_recepcao_app_ui_v34';
    const IDB_NAME = 'wpm-gestao-interna-db';
    const IDB_STORE_NAME = 'app_kv';
    const LEGACY_LOCAL_SNAPSHOT_KEYS = ['controle_recepcao_app_snapshot_v33'];
    const LEGACY_SYSTEM_REPORT_KEYS = ['controle_recepcao_app_report_v33'];
    const LEGACY_FLOW_TEST_REPORT_KEYS = ['controle_recepcao_app_flowtests_v33'];
    const LEGACY_UI_KEYS = ['controle_recepcao_app_ui_v33'];

    const DOM = {
      byId(id) {
        return document.getElementById(id);
      },
      html(id, markup) {
        const el = DOM.byId(id);
        if (el) el.innerHTML = markup;
        return el;
      },
      text(id, value) {
        const el = DOM.byId(id);
        if (el) el.textContent = value;
        return el;
      },
      value(id, fallback = '') {
        const el = DOM.byId(id);
        return el ? el.value : fallback;
      },
      setValue(id, value) {
        const el = DOM.byId(id);
        if (el) el.value = value;
        return el;
      }
    };

    const APP_DEFAULTS = {
      receptionists: ['Wallace', 'Emilia', 'Gessica', 'Maickon'],
      professors: ['Charles', 'Phillipe', 'Junior', 'Samuel', 'Gabriel', 'Maicon', 'Saulo'],
      addonTypes: ['Energy', 'Body', 'Coach'],
      studentFirstNames: ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Giovana', 'Hugo', 'Isabela', 'João', 'Karen', 'Lucas', 'Mariana', 'Nathan', 'Olivia', 'Paulo', 'Quezia', 'Rafael', 'Sabrina', 'Thiago', 'Ursula', 'Vinicius', 'Wesley', 'Yasmin', 'Zoe', 'Bianca', 'Caio', 'Debora', 'Enzo', 'Fabiana', 'Guilherme', 'Helena', 'Igor', 'Jéssica', 'Leandro', 'Mirela'],
      studentLastNames: ['Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves', 'Ferreira', 'Gomes', 'Henrique', 'Ibrahim', 'Jesus', 'Klein', 'Lopes', 'Macedo', 'Nascimento', 'Oliveira', 'Pereira', 'Queiroz', 'Ramos', 'Silva', 'Teixeira', 'Uchoa', 'Vieira'],
      pendingTopics: ['Atualizar cadastro', 'Confirmar avaliação física', 'Regularizar biometria', 'Enviar contrato assinado', 'Ajustar vencimento', 'Reagendar retorno comercial', 'Entregar atestado', 'Validar dependente', 'Confirmar plano familiar', 'Liberar acesso no totem'],
      pendingResponses: ['WhatsApp enviado e aguardando retorno.', 'Cliente respondeu e seguirá com a regularização.', 'Ligação realizada e recado anotado.', 'Pendência conferida com apoio da recepção.', 'Caso revisado e encaminhado ao professor responsável.'],
      eventTypes: ['Ação', 'Campanha', 'Treinamento', 'Feriado', 'Evento'],
      eventTitles: ['Mutirão de matrícula', 'Treinamento de vendas', 'Campanha de indicação', 'Ação comercial no salão', 'Aula temática', 'Blitz de retenção', 'Feriado operacional', 'Treinamento de recepção', 'Campanha de addons', 'Evento de comunidade'],
      eventPlaces: ['Recepção', 'Sala funcional', 'Entrada da unidade', 'Studio bike', 'Área de musculação', 'Sala de reunião'],
      eventOwners: ['Recepção', 'Coordenação', 'Marketing', 'Equipe comercial'],
      eventStatuses: ['Programado', 'Confirmado', 'Concluído'],
      scaleTimes: ['06h - 12h', '07h - 13h', '08h - 14h', '12h - 18h', '13h - 19h', '14h - 20h', '16h - 22h'],
      notes: ['Foco em retenção e relacionamento.', 'Fluxo alto esperado no período da tarde.', 'Reforçar abordagem comercial na recepção.', 'Cobertura planejada para horários críticos.', 'Monitorar retorno dos alunos com visita inicial.']
    };

    const APP_STORE_PREFERENCE_DEFAULTS = Object.freeze({
      initializeMonthsWithTestData: DEFAULT_INITIALIZE_MONTHS_WITH_TEST_DATA
    });

    function todayISO(offset = 0) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    }

    function currentMonthDayISO(day = 1) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(1);
      d.setDate(Math.max(1, Number(day || 1)));
      return d.toISOString().slice(0, 10);
    }

    // ══════════════════════════════════════════
    // ESTADO GLOBAL — declarado aqui para estar disponível antes de qualquer módulo
    // ══════════════════════════════════════════

    let storage;
    let currentPeriodKey;
    let state;

    // Estado de edição de formulários
    let editingStudentId = null;
    let editingPendingId = null;
    let editingScaleId = null;
    let editingEventId = null;
