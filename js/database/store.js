// database/store.js — Repository поверх localStorage.
// Flutter → database/ (Drift/SQLite) + repositories. UI НИКОГДА не обращается сюда напрямую — только через Services.
// Схема соответствует Product Book Part 3.
window.AF = window.AF || {};
AF.Store = (function () {
  const KEY = 'finance_app';
  // v3 (TASK_015): у операции появились необязательные payee/tags/location.
  // Ветвления по номеру версии нет — migrate идемпотентен и нормализует
  // любое состояние; номер нужен как отметка поколения в backup-файле.
  const SCHEMA_VERSION = 3;
  const PALETTE = ['#6d5df6','#22c55e','#ef4444','#f59e0b','#3bc9db','#da77f2','#ff8787','#4dabf7','#69db7c','#f783ac','#a9e34b','#fab005'];

  // Дефолтная БД (соответствует таблицам Product Book)
  function defaults() {
    return {
      schemaVersion: SCHEMA_VERSION,
      tx: [],                 // Transactions: {id,type,amount,currency,accountId/account,categoryId/cat,subcategoryId,comment/note,date,from,to,toAmount,originalAmount,exchangeRate}
                              //   + необязательные метаданные (TASK_015, v3): payee (string), tags (string[]), location (string).
                              //   Принцип «пусто = ключа нет»: пустое значение не хранится, ключ удаляется.
      accounts: [             // Accounts
        { id:'cash', name:'Наличные', emoji:'💵', type:'cash', color:'#22c55e', start:0, isArchived:false, currency:'€' },
        { id:'card', name:'Карта',    emoji:'💳', type:'bank', color:'#6d5df6', start:0, isArchived:false, currency:'€' },
      ],
      budgets: {},            // {categoryId: limitAmount} (месячный лимит)
      cats: [],               // пользовательские Categories: {id,name,type,icon,color,isSystem}
      subcats: [],            // Subcategories: {id,categoryId,name}
      goals: [],              // Goals: {id,name,targetAmount,savedAmount,currency,deadline,color,status,createdAt}
      importBatches: [],      // ImportBatches (TASK_038): {id,createdAt,source,fileName,counts} — журнал импортов CSV
      reminders: [],          // Reminders: {id,title,amount,dueDate,repeatType,categoryId,isActive}
      healthHistory: [],      // FinancialHealthHistory snapshots
      settings: {},           // key/value
      currency: '€',
      theme: 'light',         // light | dark | system  (Product Book default = light)
    };
  }

  // Миграции схемы — данные пользователя не теряются (Rule 1/2)
  function migrate(s) {
    if (!s.accounts || !s.accounts.length) s.accounts = defaults().accounts;
    s.budgets = s.budgets || {};
    // importBatches (TASK_038) — журнал импортов CSV: по записи на импорт,
    // нужен для «Отменить импорт» и для честного показа истории. Ключ
    // необязательный, поэтому SCHEMA_VERSION не поднимается (подъём 3 → 4
    // зарезервирован за TASK_035) — тот же приём, что у настроек
    // безопасности в TASK_023: отсутствие ключа = пустой журнал.
    ['tx','cats','subcats','goals','reminders','healthHistory','importBatches'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
    s.settings = s.settings || {};
    if (!s.theme) s.theme = 'light';
    if (!s.currency) s.currency = '€';
    s.accounts.forEach((a, i) => {
      if (!a.type) a.type = (a.id === 'cash' || /налич|cash/i.test(a.name)) ? 'cash'
        : (a.currency && a.currency !== '€' && a.currency !== 'EUR') ? 'crypto' : 'bank';
      if (!a.color) a.color = PALETTE[i % PALETTE.length];
      if (a.isArchived === undefined) a.isArchived = false;
    });
    const def = s.accounts[0].id;
    s.tx.forEach(t => { if (!t.account && t.type !== 'transfer') t.account = def; });
    // Метаданные операции (TASK_015). migrate — единственная точка, через
    // которую проходят ВСЕ пути входа данных (старт, restore .afb, импорт
    // JSON, импорт CSV), поэтому нормализация нужна только здесь.
    // Проверка наличия сервиса — не декоративная: инвариант совместимости
    // TASK_015 §0, сценарий С2 (новый store.js мог приехать с CDN раньше
    // tx_meta_service.js). Без сервиса метаданные просто не нормализуются,
    // остальная миграция отрабатывает полностью и данные не теряются.
    const TM = (typeof AF !== 'undefined' && AF && AF.Services) ? AF.Services.TxMeta : null;
    if (TM && typeof TM.normalizeTx === 'function') s.tx.forEach(t => TM.normalizeTx(t));
    // Настройки безопасности (TASK_023): lockDelay/biometric/bioCredId живут в
    // s.settings.security. SCHEMA_VERSION не поднимается — ключи необязательны,
    // их отсутствие = безопасные значения по умолчанию, нормализация
    // идемпотентна. Проверка наличия сервиса — тот же инвариант совместимости
    // TASK_015 §0, что и у TxMeta выше: без сервиса приложение стартует с
    // прежним поведением (код спрашивается на входе) и не падает.
    const SEC = (typeof AF !== 'undefined' && AF && AF.Services) ? AF.Services.Security : null;
    if (SEC && typeof SEC.normalize === 'function') SEC.normalize(s);
    s.schemaVersion = SCHEMA_VERSION;
    return s;
  }

  // ===== TASK_026: единый контракт сохранения =====
  // Коды ошибок записи. Вызывающий код обязан различать их: переполнение
  // хранилища требует другого сообщения пользователю, чем несериализуемые
  // данные или недоступное storage (private mode, отключённые cookies).
  const SAVE_ERROR = {
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',           // хранилище заполнено
    SERIALIZATION_FAILED: 'SERIALIZATION_FAILED', // JSON.stringify бросил
    STORAGE_FAILED: 'STORAGE_FAILED',           // storage недоступен / прочее
  };
  const SAVE_MESSAGE = {
    QUOTA_EXCEEDED: 'Не удалось сохранить данные: хранилище приложения заполнено. ' +
      'Удалите ненужные фотографии чеков или создайте резервную копию.',
    SERIALIZATION_FAILED: 'Не удалось сохранить данные: не получилось подготовить их к записи.',
    STORAGE_FAILED: 'Не удалось сохранить данные: хранилище приложения недоступно.',
  };

  // Последнее СОСТОЯВШЕЕСЯ состояние в сериализованном виде. Строка уже
  // построена в save() — храним готовую, лишнего JSON.stringify не делаем.
  // Служит источником отката: после неуспешной записи память обязана
  // соответствовать последнему успешно сохранённому состоянию.
  let lastGoodJson = null;

  // Браузерные варианты переполнения квоты: имя (Chrome/Safari/Firefox),
  // legacy-код 22 и Firefox 1014. iOS Safari в приватном режиме бросает
  // QuotaExceededError уже на первом setItem — тот же код, то же сообщение.
  function isQuotaError(e) {
    if (!e) return false;
    const name = e.name || '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
    return e.code === 22 || e.code === 1014;
  }

  function saveErr(code, e) {
    return AF.Result.err({ code, message: SAVE_MESSAGE[code] || SAVE_MESSAGE.STORAGE_FAILED, cause: e || null });
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const s = Object.assign(defaults(), raw ? JSON.parse(raw) : {});
      const migrated = migrate(s);
      // Точка отсчёта для отката. migrate идемпотентен, поэтому это состояние
      // эквивалентно содержимому хранилища (перезагрузка даст то же самое).
      markSaved(migrated);
      return migrated;
    } catch (e) {
      console.warn('Store.load failed, using defaults', e);
      const d = defaults();
      markSaved(d);
      return d;
    }
  }

  function save(state) {
    const prevUpdatedAt = state.updatedAt;
    let json;
    try {
      state.updatedAt = Date.now();
      json = JSON.stringify(state);
    } catch (e) {
      state.updatedAt = prevUpdatedAt;
      console.error('Store.save: serialization failed', e);
      return saveErr(SAVE_ERROR.SERIALIZATION_FAILED, e);
    }
    try {
      localStorage.setItem(KEY, json);
    } catch (e) {
      state.updatedAt = prevUpdatedAt;
      const code = isQuotaError(e) ? SAVE_ERROR.QUOTA_EXCEEDED : SAVE_ERROR.STORAGE_FAILED;
      console.error('Store.save failed [' + code + ']', e && e.name);
      return saveErr(code, e);
    }
    lastGoodJson = json;
    return AF.Result.ok(true);
  }

  // Зафиксировать состояние как «последнее успешно сохранённое» без записи.
  // Нужен только для load(): дальше отметку двигает исключительно успешный save().
  function markSaved(state) {
    try { lastGoodJson = JSON.stringify(state); } catch (e) { lastGoodJson = null; }
  }

  function snapshot() { return lastGoodJson; }

  // Откат состояния в памяти к последнему успешно сохранённому.
  // Восстанавливаем ВНУТРЬ того же объекта, а не возвращаем новый: на `state`
  // держат ссылки замыкания и сервисы, подмена ссылки оставила бы часть
  // приложения на несохранённых данных.
  function rollback(state, json) {
    const src = (typeof json === 'string') ? json : lastGoodJson;
    if (typeof src !== 'string' || !state || typeof state !== 'object') return false;
    let parsed;
    try { parsed = JSON.parse(src); } catch (e) { return false; }
    if (!parsed || typeof parsed !== 'object') return false;
    Object.keys(state).forEach(k => { delete state[k]; });
    Object.assign(state, parsed);
    return true;
  }

  return {
    KEY, SCHEMA_VERSION, PALETTE, SAVE_ERROR, SAVE_MESSAGE,
    defaults, migrate, load, save, markSaved, snapshot, rollback, isQuotaError,
  };
})();
