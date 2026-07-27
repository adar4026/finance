// tests/tx_meta_service.test.js — юнит-тесты для js/services/tx_meta_service.js (TASK_015).
// Запуск: node tests/tx_meta_service.test.js
global.window = global;
require('../js/services/tx_meta_service.js');
const M = AF.Services.TxMeta;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// ============ §17.1 — нормализация ============

// ---- 1. Операция без новых полей: ключи не появляются ----
{
  const t = { id: 1, type: 'expense', amount: 10, cat: 'food', date: '2026-07-27' };
  M.normalizeTx(t);
  assertEqual(Object.keys(t).sort(), ['amount', 'cat', 'date', 'id', 'type'], 'Операция без метаданных — новые ключи не создаются');
}

// ---- 2. Операция со всеми тремя полями ----
{
  const t = { id: 2, payee: 'Mercadona', tags: ['еда'], location: 'Oviedo' };
  M.normalizeTx(t);
  assertEqual(t.payee, 'Mercadona', 'payee нормализован и сохранён');
  assertEqual(t.tags, ['еда'], 'tags нормализованы и сохранены');
  assertEqual(t.location, 'Oviedo', 'location нормализован и сохранён');
}

// ---- 3. Частично заполненные поля ----
{
  const t = { id: 3, payee: 'Lidl' };
  M.normalizeTx(t);
  assertTrue(t.payee === 'Lidl', 'Заполненный payee остаётся');
  assertTrue(!('tags' in t), 'Отсутствующий tags не создаётся');
  assertTrue(!('location' in t), 'Отсутствующий location не создаётся');
}

// ---- 4. Пустые строки → ключи удаляются ----
{
  const t = { id: 4, payee: '', tags: [], location: '   ' };
  M.normalizeTx(t);
  assertTrue(!('payee' in t), 'Пустой payee → ключ удалён');
  assertTrue(!('tags' in t), 'Пустой tags → ключ удалён');
  assertTrue(!('location' in t), 'Пустой location (пробелы) → ключ удалён');
}

// ---- 5. Неправильные типы → ключи удаляются, исключения нет ----
{
  const t = { id: 5, payee: 42, tags: {}, location: null };
  M.normalizeTx(t);
  assertTrue(!('payee' in t), 'payee-число → ключ удалён');
  assertTrue(!('tags' in t), 'tags-объект → ключ удалён');
  assertTrue(!('location' in t), 'location null → ключ удалён');

  assertEqual(M.normalizePayee(undefined), '', 'normalizePayee(undefined) → пустая строка');
  assertEqual(M.normalizeTags(undefined), [], 'normalizeTags(undefined) → пустой массив');
  assertEqual(M.normalizeLocation(true), '', 'normalizeLocation(boolean) → пустая строка');
  assertEqual(M.normalizeTags(42), [], 'normalizeTags(число) → пустой массив');
}

// ---- 6. Дубли тегов удаляются регистронезависимо, остаётся первое ----
{
  assertEqual(M.normalizeTags(['еда', 'ЕДА', 'Еда']), ['еда'], 'Дубли тегов в разном регистре → одно значение (первое вхождение)');
  assertEqual(M.normalizeTags(['ЕДА', 'еда']), ['ЕДА'], 'Первое вхождение сохраняет своё написание');
}

// ---- 7. Строка с разделителями и '#' ----
{
  assertEqual(M.normalizeTags('#еда, #семья'), ['еда', 'семья'], 'Строка с # и запятой → массив без #');
  assertEqual(M.normalizeTags('a;b\nc'), ['a', 'b', 'c'], 'Разделители ; и перевод строки');
  assertEqual(M.normalizeTag('###еда'), 'еда', 'Несколько ведущих # снимаются');
  assertEqual(M.normalizeTag('  #  еда  '), 'еда', '# с пробелами вокруг снимается');
  assertEqual(M.normalizeTags('бизнес расходы'), ['бизнес расходы'], 'Пробел НЕ является разделителем — многословный тег');
  assertEqual(M.normalizeTags('#'), [], 'Тег из одного # → отбрасывается');
}

// ---- 8. Лимит количества тегов ----
{
  const many = [];
  for (let i = 1; i <= 15; i++) many.push('t' + i);
  const r = M.normalizeTags(many);
  assertEqual(r.length, 10, 'Не более 10 тегов');
  assertEqual(r[0], 't1', 'Остаются первые по порядку');
  assertEqual(r[9], 't10', 'Последний оставшийся — t10');
}

// ---- 9. Обрезка payee по длине ----
{
  const long = 'x'.repeat(200);
  assertEqual(M.normalizePayee(long).length, 80, 'payee обрезается до 80 символов');
  assertEqual(M.normalizeLocation('y'.repeat(300)).length, 120, 'location обрезается до 120 символов');
}

// ---- 10. Обрезка тега по длине ----
{
  assertEqual(M.normalizeTag('z'.repeat(50)).length, 24, 'Тег обрезается до 24 символов');
}

// ---- 11. Обрезка не разрезает суррогатную пару эмодзи ----
{
  // 24 эмодзи (по 2 UTF-16 code unit каждый) + хвост
  const emo = '🛒'.repeat(30);
  const cut = M.normalizeTag(emo);
  assertEqual(Array.from(cut).length, 24, 'Обрезка тега считает code points, а не UTF-16 units');
  assertTrue(cut.indexOf('�') === -1 && !/[\uD800-\uDBFF]$/.test(cut), 'Суррогатная пара не разрезана пополам');
  assertEqual(M.normalizePayee('Mercadona 🛒'), 'Mercadona 🛒', 'Эмодзи в payee сохраняется');
}

// ---- 12. Unicode: испанский, кириллица ----
{
  assertEqual(M.normalizePayee('Gijón'), 'Gijón', 'Испанская диакритика сохраняется');
  assertEqual(M.normalizePayee('Ñoño'), 'Ñoño', 'Ñ сохраняется');
  assertEqual(M.normalizeLocation('Щёлково'), 'Щёлково', 'Кириллица с ё сохраняется');
  assertEqual(M.normalizeTags(['ЖКХ', 'niños']), ['ЖКХ', 'niños'], 'Смешанные алфавиты в тегах');
  assertEqual(M.normalizeTags(['Año', 'AÑO']), ['Año'], 'Регистронезависимый дедуп работает для Ñ');
}

// ---- 13. Схлопывание пробелов и переносов ----
{
  assertEqual(M.normalizePayee('  a\n\n  b  '), 'a b', 'Переносы и повторные пробелы схлопываются');
  assertEqual(M.normalizeLocation('Oviedo,\tCalle  Uría'), 'Oviedo, Calle Uría', 'Табуляция и двойные пробелы схлопываются');
  assertEqual(M.normalizeTag(' многослов   ный '), 'многослов ный', 'Внутри тега пробелы схлопываются');
}

// ---- 14. Операция-перевод нормализуется так же ----
{
  const t = { id: 14, type: 'transfer', from: 'cash', to: 'card', amount: 100, tags: ['  #накопления '], location: ' дом ', payee: '' };
  M.normalizeTx(t);
  assertEqual(t.tags, ['накопления'], 'Теги перевода нормализуются');
  assertEqual(t.location, 'дом', 'Место перевода нормализуется');
  assertTrue(!('payee' in t), 'Пустой payee перевода → ключ удалён');
  assertEqual(t.type, 'transfer', 'Тип перевода не тронут');
  assertEqual(t.from, 'cash', 'Поля перевода не тронуты');
}

// ---- 15. Идемпотентность ----
{
  const t = { id: 15, payee: '  Mercadona  ', tags: ['#еда', 'ЕДА', ''], location: ' Oviedo ' };
  M.normalizeTx(t);
  const once = JSON.stringify(t);
  M.normalizeTx(t);
  assertEqual(JSON.stringify(t), once, 'Повторная нормализация ничего не меняет (идемпотентность)');
  assertEqual(t.payee, 'Mercadona', 'Идемпотентность: payee');
  assertEqual(t.tags, ['еда'], 'Идемпотентность: tags');
}

// ---- 16-17. metaSearchText ----
{
  assertEqual(M.metaSearchText({ id: 1 }), '', 'metaSearchText пустой операции → пустая строка');
  assertEqual(M.metaSearchText(null), '', 'metaSearchText(null) → пустая строка, без исключения');
  assertEqual(M.metaSearchText({ payee: 'Mercadona', tags: ['еда', 'семья'], location: 'Oviedo' }),
    'Mercadona еда семья Oviedo', 'metaSearchText собирает все три поля');
  assertEqual(M.metaSearchText({ tags: ['еда'] }), 'еда', 'metaSearchText только с тегами');
  assertEqual(M.metaSearchText({ payee: 'Lidl', tags: [] }), 'Lidl', 'Пустой массив тегов не добавляет пробелов');
}

// ---- 18-20e. payeeSuggestions ----
{
  const tx = [
    { payee: 'Mercadona', date: '2026-07-01' },
    { payee: 'Mercadona', date: '2026-07-10' },
    { payee: 'mercadona', date: '2026-07-20' },
    { payee: 'Mercado Central', date: '2026-07-25' },
    { payee: 'Lidl', date: '2026-07-26' },
    { payee: '', date: '2026-07-26' },
    { date: '2026-07-26' },
    null,
  ];

  // 18 — частотная сортировка
  assertEqual(M.payeeSuggestions(tx, 'merc'), ['Mercadona', 'Mercado Central'],
    'Частотная сортировка: Mercadona (3) выше Mercado Central (1)');

  // 19 — регистронезависимый матч
  assertEqual(M.payeeSuggestions(tx, 'MERC')[0], 'Mercadona', 'Матч регистронезависим (запрос в верхнем регистре)');
  assertEqual(M.payeeSuggestions(tx, 'lid'), ['Lidl'], 'Матч по подстроке в нижнем регистре');
  assertEqual(M.payeeSuggestions(tx, 'central'), ['Mercado Central'], 'Матч по подстроке в середине значения');

  // 20 / 20b — возвращается существующее (самое частое) написание
  assertEqual(M.payeeSuggestions(tx, 'mercadona'), ['Mercadona'],
    'Возвращается самое частое написание (Mercadona×2, mercadona×1), а не запрос пользователя');

  // 20a — при равной частоте выше более свежая операция
  const tie = [
    { payee: 'Alpha', date: '2026-01-01' },
    { payee: 'Beta', date: '2026-06-01' },
  ];
  assertEqual(M.payeeSuggestions(tie, 'a'), ['Beta', 'Alpha'],
    'При равной частоте выше более свежая операция');

  // 20c — лимит
  const manyTx = [];
  for (let i = 1; i <= 12; i++) manyTx.push({ payee: 'Shop ' + i, date: '2026-07-0' + (i % 9 + 1) });
  assertEqual(M.payeeSuggestions(manyTx, 'shop').length, 5, 'По умолчанию не более 5 подсказок');
  assertEqual(M.payeeSuggestions(manyTx, 'shop', 3).length, 3, 'Явный лимит соблюдается');

  // 20d — кириллица и Unicode
  const uni = [
    { payee: 'Магазин у дома', date: '2026-07-01' },
    { payee: 'Gijón Centro', date: '2026-07-02' },
  ];
  assertEqual(M.payeeSuggestions(uni, 'мага'), ['Магазин у дома'], 'Подсказки работают с кириллицей');
  assertEqual(M.payeeSuggestions(uni, 'МАГА'), ['Магазин у дома'], 'Кириллица регистронезависимо');
  assertEqual(M.payeeSuggestions(uni, 'gij'), ['Gijón Centro'], 'Подсказки работают с диакритикой');

  // 20e — пустой запрос / пустой список / мусор
  assertEqual(M.payeeSuggestions(tx, ''), [], 'Пустой запрос → пустой список');
  assertEqual(M.payeeSuggestions(tx, '   '), [], 'Запрос из пробелов → пустой список');
  assertEqual(M.payeeSuggestions([], 'merc'), [], 'Пустой список операций → пустой список');
  assertEqual(M.payeeSuggestions(null, 'merc'), [], 'null вместо списка → пустой список, без исключения');
  assertEqual(M.payeeSuggestions(tx, null), [], 'null-запрос → пустой список');
  assertEqual(M.payeeSuggestions(tx, 'неттакого'), [], 'Нет совпадений → пустой список');
}

// ---- Служебное: prototype pollution не ломает группировку ----
{
  const tx = [{ payee: 'constructor', date: '2026-07-01' }, { payee: '__proto__', date: '2026-07-02' }];
  assertEqual(M.payeeSuggestions(tx, 'constructor'), ['constructor'], 'Значение "constructor" не ломает группировку');
  assertEqual(M.payeeSuggestions(tx, '__proto__'), ['__proto__'], 'Значение "__proto__" не ломает группировку');
}

// ============ §17.2 — миграция ============
require('../js/core/result.js');
require('../js/database/store.js');
const S = AF.Store;

// ---- 21. Состояние схемы v2 без метаданных ----
{
  const st = Object.assign(S.defaults(), {
    schemaVersion: 2,
    tx: [{ id: 1, type: 'expense', amount: 10, cat: 'food', account: 'cash', date: '2026-07-27', note: 'старая' }],
  });
  S.migrate(st);
  assertEqual(st.schemaVersion, 3, 'migrate поднимает schemaVersion 2 → 3');
  assertEqual(S.SCHEMA_VERSION, 3, 'SCHEMA_VERSION === 3');
  assertEqual(Object.keys(st.tx[0]).sort(), ['account', 'amount', 'cat', 'date', 'id', 'note', 'type'],
    'Старая операция не изменилась — новые ключи не появились');
}

// ---- 22. Состояние с битыми метаданными ----
{
  const st = Object.assign(S.defaults(), {
    tx: [
      { id: 1, type: 'expense', amount: 1, account: 'cash', date: '2026-07-27', payee: '  Lidl  ', tags: 'еда,#еда, семья', location: 42 },
      { id: 2, type: 'income', amount: 2, account: 'cash', date: '2026-07-27', payee: 99, tags: null, location: ' Oviedo ' },
    ],
  });
  S.migrate(st);
  assertEqual(st.tx[0].payee, 'Lidl', 'migrate нормализует payee');
  assertEqual(st.tx[0].tags, ['еда', 'семья'], 'migrate нормализует и дедуплицирует tags');
  assertTrue(!('location' in st.tx[0]), 'migrate удаляет location неверного типа');
  assertTrue(!('payee' in st.tx[1]), 'migrate удаляет payee неверного типа');
  assertTrue(!('tags' in st.tx[1]), 'migrate удаляет tags = null');
  assertEqual(st.tx[1].location, 'Oviedo', 'migrate нормализует location');
}

// ---- 23. Двойной migrate идемпотентен ----
{
  const st = Object.assign(S.defaults(), {
    tx: [{ id: 1, type: 'expense', amount: 1, account: 'cash', date: '2026-07-27', payee: ' A ', tags: ['#b'], location: ' C ' }],
  });
  S.migrate(st);
  const once = JSON.stringify(st.tx);
  S.migrate(st);
  assertEqual(JSON.stringify(st.tx), once, 'Двойной migrate идемпотентен');
}

// ---- 24. ИНВАРИАНТ §0/С2: migrate при отсутствующем AF.Services.TxMeta ----
{
  const saved = AF.Services.TxMeta;
  delete AF.Services.TxMeta;
  let threw = null;
  const st = Object.assign(S.defaults(), {
    schemaVersion: 2,
    tx: [{ id: 1, type: 'expense', amount: 1, account: 'cash', date: '2026-07-27', payee: '  A  ' }],
  });
  try { S.migrate(st); } catch (e) { threw = e; }
  AF.Services.TxMeta = saved;
  assertTrue(threw === null, 'С2: migrate не падает без AF.Services.TxMeta');
  assertEqual(st.schemaVersion, 3, 'С2: migrate доводит schemaVersion до конца даже без сервиса');
  assertEqual(st.tx[0].payee, '  A  ', 'С2: без сервиса метаданные просто не нормализуются (данные не теряются)');
  assertEqual(st.tx[0].account, 'cash', 'С2: остальные шаги migrate отработали');
}

// ---- 24b. ИНВАРИАНТ §0/С2: migrate при полностью отсутствующем AF.Services ----
{
  const saved = AF.Services;
  AF.Services = undefined;
  let threw = null;
  const st = Object.assign(S.defaults(), { tx: [{ id: 1, type: 'expense', amount: 1, account: 'cash', date: '2026-07-27' }] });
  try { S.migrate(st); } catch (e) { threw = e; }
  AF.Services = saved;
  assertTrue(threw === null, 'С2: migrate не падает при отсутствующем AF.Services целиком');
  assertEqual(st.schemaVersion, 3, 'С2: schemaVersion выставлен и в этом случае');
}

// ---- 24c. ИНВАРИАНТ §0/С6: старые операции без новых полей ----
{
  const st = Object.assign(S.defaults(), {
    schemaVersion: 2,
    tx: [
      { id: 1, type: 'expense', amount: 10, cat: 'food', date: '2026-07-27' },              // без account — дозаполнится
      { id: 2, type: 'transfer', from: 'cash', to: 'card', amount: 5, date: '2026-07-27' },
    ],
  });
  let threw = null;
  try { S.migrate(st); } catch (e) { threw = e; }
  assertTrue(threw === null, 'С6: старые операции мигрируют без ошибки');
  assertEqual(st.tx[0].account, 'cash', 'С6: существующее поведение migrate (счёт по умолчанию) сохранено');
  assertTrue(!('payee' in st.tx[0]) && !('tags' in st.tx[0]) && !('location' in st.tx[0]), 'С6: ключи не создаются у расхода');
  assertTrue(!('payee' in st.tx[1]) && !('tags' in st.tx[1]) && !('location' in st.tx[1]), 'С6: ключи не создаются у перевода');
}

// ---- Сервис не имеет побочных эффектов при загрузке (С3) ----
{
  assertTrue(typeof AF.Services.TxMeta === 'object', 'С3: сервис зарегистрирован в AF.Services');
  assertTrue(typeof AF.Services.TxMeta.normalizeTx === 'function', 'С3: методы на месте');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
