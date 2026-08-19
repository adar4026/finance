// services/import_mapping_service.js — сопоставление внешних счетов и категорий
// с уже существующими в базе. Flutter → services/import_mapping_service.dart
//
// TASK_038. Прежний импорт сравнивал имена как name.trim().toLowerCase():
// «ING » совпадало, «ING Bank» и «ing_bank» — уже нет, а «Groceries» при
// существующей категории «Продукты» создавало вторую категорию с тем же
// смыслом. За несколько импортов это давало десятки почти одинаковых
// категорий, разносящих одни и те же расходы по разным строкам аналитики.
//
// Здесь три уровня подбора, и каждый честно сообщает свою уверенность:
//   exact  — нормализованные имена совпали;
//   alias  — совпадение через словарь двуязычных синонимов;
//   none   — совпадения нет, нужна новая сущность (или выбор пользователя).
// Автоматически применяются только exact и alias. Всё остальное — решение
// пользователя: молча создавать сущности по догадке нельзя.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.ImportMapping = (function () {

  // Нормализация имени: регистр, диакритика, пунктуация, пробелы.
  // Диакритика снимается тем же способом, что и в поиске (TASK_016), —
  // «Café» и «Cafe» должны быть одним счётом.
  const COMBINING = /[̀-ͯ]/g;
  const NON_ALNUM = /[^\p{L}\p{N}]+/gu;
  function normalizeName(v) {
    let s = String(v == null ? '' : v).toLowerCase().trim();
    try { s = s.normalize('NFD').replace(COMBINING, ''); } catch (e) { /* окружение без normalize */ }
    return s.replace(/ё/g, 'е').replace(NON_ALNUM, ' ').replace(/\s+/g, ' ').trim();
  }

  // Двуязычные синонимы категорий. Список намеренно короткий и состоит
  // только из однозначных соответствий: ошибочный синоним склеит две разные
  // статьи расходов, а это хуже лишней категории.
  const CATEGORY_ALIASES = [
    ['Продукты', 'Groceries', 'Food', 'Supermarket', 'Еда', 'Продукты питания'],
    ['Кафе', 'Restaurants', 'Restaurant', 'Cafe', 'Dining', 'Рестораны', 'Кафе и рестораны'],
    ['Транспорт', 'Transport', 'Transportation'],
    ['Такси', 'Taxi', 'Ride hailing'],
    ['Топливо', 'Fuel', 'Gas', 'Petrol', 'Бензин', 'АЗС'],
    ['Жильё', 'Housing', 'Rent', 'Аренда', 'Квартира'],
    ['Коммунальные', 'Utilities', 'Коммуналка', 'Коммунальные услуги'],
    ['Связь', 'Communication', 'Mobile', 'Phone', 'Телефон', 'Интернет', 'Internet'],
    ['Здоровье', 'Health', 'Healthcare', 'Medicine', 'Медицина', 'Аптека', 'Pharmacy'],
    ['Спорт', 'Sport', 'Sports', 'Fitness', 'Фитнес'],
    ['Одежда', 'Clothes', 'Clothing', 'Apparel', 'Обувь'],
    ['Развлечения', 'Entertainment', 'Leisure', 'Досуг'],
    ['Подписки', 'Subscriptions', 'Subscription'],
    ['Образование', 'Education', 'Учёба', 'Courses'],
    ['Подарки', 'Gifts', 'Gift', 'Подарок'],
    ['Путешествия', 'Travel', 'Trips', 'Vacation', 'Отпуск'],
    ['Дети', 'Kids', 'Children', 'Childcare'],
    ['Питомцы', 'Pets', 'Pet', 'Животные'],
    ['Красота', 'Beauty', 'Personal care', 'Уход'],
    ['Налоги', 'Taxes', 'Tax'],
    ['Зарплата', 'Salary', 'Wage', 'Payroll', 'Оклад'],
    ['Подработка', 'Freelance', 'Side income', 'Фриланс'],
    ['Проценты', 'Interest', 'Вклад'],
    ['Инвестиции', 'Investments', 'Investment', 'Dividends', 'Дивиденды'],
    ['Возврат', 'Refund', 'Refunds', 'Cashback', 'Кэшбэк'],
    ['Другое', 'Other', 'Misc', 'Miscellaneous', 'Прочее'],
  ];

  // нормализованное имя → индекс группы синонимов. Строится один раз.
  const ALIAS_GROUP = (function () {
    const m = new Map();
    CATEGORY_ALIASES.forEach((group, gi) => group.forEach(n => m.set(normalizeName(n), gi)));
    return m;
  })();

  function aliasGroupOf(name) {
    const g = ALIAS_GROUP.get(normalizeName(name));
    return (g === undefined) ? null : g;
  }

  // ---- Счета ---------------------------------------------------------
  // Синонимов для счетов нет: «ING», «Revolut», «Cash» — имена собственные,
  // угадывать их соответствия нельзя. Только нормализованное совпадение.
  function matchAccount(externalName, accounts) {
    const n = normalizeName(externalName);
    if (!n) return { match: null, how: 'none' };
    const exact = (accounts || []).find(a => normalizeName(a.name) === n);
    return exact ? { match: exact, how: 'exact' } : { match: null, how: 'none' };
  }

  // ---- Категории -----------------------------------------------------
  // Категории в модели разделены по типу (доход/расход), поэтому подбор
  // всегда идёт внутри своего типа: «Проценты» для дохода и «Проценты» для
  // расхода — разные сущности.
  function matchCategory(externalName, cats, type) {
    const n = normalizeName(externalName);
    if (!n) return { match: null, how: 'none' };
    const list = (cats || []).filter(c => !type || c.type === type);
    const exact = list.find(c => normalizeName(c.name) === n);
    if (exact) return { match: exact, how: 'exact' };
    const g = aliasGroupOf(externalName);
    if (g !== null) {
      const alias = list.find(c => aliasGroupOf(c.name) === g);
      if (alias) return { match: alias, how: 'alias' };
    }
    return { match: null, how: 'none' };
  }

  function matchSubcategory(externalName, subcats, categoryId) {
    const n = normalizeName(externalName);
    if (!n) return { match: null, how: 'none' };
    const found = (subcats || []).find(s => s.categoryId === categoryId && normalizeName(s.name) === n);
    return found ? { match: found, how: 'exact' } : { match: null, how: 'none' };
  }

  // ---- Планы сопоставления ------------------------------------------
  // План — данные для экрана: по строке на каждое встреченное в файле имя.
  // action по умолчанию 'use' при найденном совпадении и 'create' при
  // отсутствии; пользователь может переключить любую строку.
  function buildAccountPlan(externalNames, accounts) {
    const seen = new Map();
    (externalNames || []).forEach(raw => {
      const name = String(raw == null ? '' : raw).trim();
      const key = normalizeName(name);
      if (!key) return;
      if (seen.has(key)) { seen.get(key).count++; return; }
      const m = matchAccount(name, accounts);
      seen.set(key, {
        key, external: name, count: 1,
        action: m.match ? 'use' : 'create',
        targetId: m.match ? m.match.id : null,
        suggestedId: m.match ? m.match.id : null,
        how: m.how,
      });
    });
    return Array.from(seen.values());
  }

  // entries: [{ name, type }] — тип нужен, чтобы не смешивать доход и расход
  function buildCategoryPlan(entries, cats) {
    const seen = new Map();
    (entries || []).forEach(e => {
      const name = String((e && e.name) == null ? '' : e.name).trim();
      const type = (e && e.type) || 'expense';
      const key = planKeyForCategory(name, type);
      if (!normalizeName(name)) return;
      if (seen.has(key)) { seen.get(key).count++; return; }
      const m = matchCategory(name, cats, type);
      seen.set(key, {
        key, external: name, type, count: 1,
        action: m.match ? 'use' : 'create',
        targetId: m.match ? m.match.id : null,
        suggestedId: m.match ? m.match.id : null,
        how: m.how,
      });
    });
    return Array.from(seen.values());
  }

  function planKeyForAccount(name) { return normalizeName(name); }
  function planKeyForCategory(name, type) { return (type || 'expense') + ' ' + normalizeName(name); }

  return {
    CATEGORY_ALIASES, normalizeName, aliasGroupOf,
    matchAccount, matchCategory, matchSubcategory,
    buildAccountPlan, buildCategoryPlan, planKeyForAccount, planKeyForCategory,
  };
})();
