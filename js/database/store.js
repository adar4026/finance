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
    ['tx','cats','subcats','goals','reminders','healthHistory'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
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
    s.schemaVersion = SCHEMA_VERSION;
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const s = Object.assign(defaults(), raw ? JSON.parse(raw) : {});
      return migrate(s);
    } catch (e) {
      console.warn('Store.load failed, using defaults', e);
      return defaults();
    }
  }

  function save(state) {
    try {
      state.updatedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(state));
      return AF.Result.ok(true);
    } catch (e) {
      console.error('Store.save failed', e);
      return AF.Result.err('Не удалось сохранить данные');
    }
  }

  return { KEY, SCHEMA_VERSION, PALETTE, defaults, migrate, load, save };
})();
