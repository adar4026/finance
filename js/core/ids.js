// core/ids.js — единый генератор идентификаторов (TASK_026, закрывает M-8).
// Flutter → core/ids.dart (uuid package).
//
// Зачем: до TASK_026 в приложении сосуществовали три схемы генерации —
// `Date.now()` (операции), `Date.now()+Math.random()+k` (импорт/демо) и
// `'c'+Date.now().toString(36)` (категории/счета/цели). Две сущности,
// созданные в одну миллисекунду, получали одинаковый id, а разные типы
// сущностей могли получить один и тот же префикс ('g' — и цель, и группа
// счетов). При совпадении id редактирование/удаление затрагивает не ту
// запись (`find` вернёт первую, `filter` удалит обе).
//
// Инварианты:
//  1. Два id, созданные в одну миллисекунду, различаются (счётчик процесса).
//  2. Работает без `crypto.randomUUID()` и без `crypto.getRandomValues()`.
//  3. `unique()` дополнительно гарантирует отсутствие коллизии внутри
//     конкретной коллекции — в том числе после импорта и восстановления копии.
//  4. Существующие id пользователя не переписываются: генератор влияет
//     только на вновь создаваемые сущности (массовая миграция id — вне
//     границ TASK_026).
window.AF = window.AF || {};
AF.Ids = (function () {
  // Префиксы по типам сущностей. Разные типы не должны сталкиваться:
  // до TASK_026 цель и группа счетов обе начинались с 'g'.
  const PREFIX = {
    tx: 't',
    account: 'a',
    accountGroup: 'ag',
    category: 'c',
    subcategory: 's',
    goal: 'gl',
    reminder: 'r',
  };

  let counter = 0;

  function cryptoObj() {
    try {
      if (typeof crypto !== 'undefined' && crypto) return crypto;
      if (typeof window !== 'undefined' && window && window.crypto) return window.crypto;
    } catch (e) { /* доступ к crypto может бросать в редких окружениях */ }
    return null;
  }

  // Случайный хвост в hex. Fallback на Math.random() — не криптостойкий,
  // но здесь он и не нужен: id не секрет, задача — только уникальность.
  function randomHex(bytes) {
    const n = bytes || 4;
    const c = cryptoObj();
    if (c && typeof c.getRandomValues === 'function') {
      try {
        const a = new Uint8Array(n);
        c.getRandomValues(a);
        let s = '';
        for (let i = 0; i < n; i++) s += a[i].toString(16).padStart(2, '0');
        return s;
      } catch (e) { /* падаем в Math.random ниже */ }
    }
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return s;
  }

  // UUID v4. Штатный crypto.randomUUID() доступен только в защищённом
  // контексте (https/localhost) и не во всех версиях Safari — поэтому
  // обязателен fallback, иначе создание любой сущности упало бы с TypeError.
  function uuid() {
    const c = cryptoObj();
    if (c && typeof c.randomUUID === 'function') {
      try { return c.randomUUID(); } catch (e) { /* fallback ниже */ }
    }
    const h = randomHex(16).split('');
    // выставляем версию (4) и вариант (8..b) как в RFC 4122
    h[12] = '4';
    h[16] = '89ab'[Math.floor(Math.random() * 4)];
    const s = h.join('');
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20, 32);
  }

  // Основной генератор: время (сортируемость и читаемость в отладке) +
  // счётчик процесса (снимает коллизию внутри одной миллисекунды) +
  // случайный хвост (снимает коллизию между вкладками/устройствами).
  function newId(prefix) {
    counter = (counter + 1) % 0xffffff;
    return String(prefix || '') + Date.now().toString(36) + '-' + counter.toString(36) + '-' + randomHex(3);
  }

  function takenChecker(taken) {
    if (!taken) return () => false;
    if (typeof taken === 'function') return taken;
    if (typeof taken.has === 'function') return id => taken.has(id);
    if (Array.isArray(taken)) {
      // массив сущностей ({id}) либо массив самих id
      const set = new Set(taken.map(x => String(x && typeof x === 'object' ? x.id : x)));
      return id => set.has(String(id));
    }
    if (typeof taken === 'object') return id => Object.prototype.hasOwnProperty.call(taken, id);
    return () => false;
  }

  // Гарантированно свободный id внутри коллекции.
  // `taken` — массив сущностей, массив id, Set, объект-словарь или предикат.
  function unique(prefix, taken) {
    const isTaken = takenChecker(taken);
    for (let i = 0; i < 100; i++) {
      const id = newId(prefix);
      if (!isTaken(id)) return id;
    }
    // Практически недостижимо (означало бы, что коллекция содержит все
    // варианты), но молча вернуть занятый id нельзя — берём UUID.
    return String(prefix || '') + uuid();
  }

  const forTx = state => unique(PREFIX.tx, (state && state.tx) || []);
  const forAccount = state => unique(PREFIX.account, (state && state.accounts) || []);
  const forAccountGroup = state => unique(PREFIX.accountGroup, (state && state.accountGroups) || []);
  const forCategory = state => unique(PREFIX.category, (state && state.cats) || []);
  const forSubcategory = state => unique(PREFIX.subcategory, (state && state.subcats) || []);
  const forGoal = state => unique(PREFIX.goal, (state && state.goals) || []);
  const forReminder = state => unique(PREFIX.reminder, (state && state.reminders) || []);

  return {
    PREFIX, uuid, newId, unique,
    forTx, forAccount, forAccountGroup, forCategory, forSubcategory, forGoal, forReminder,
  };
})();
