// tests/place_breakdown_service.test.js — детализация категории по местам (TASK_060).
// Запуск: node tests/place_breakdown_service.test.js
//
// Синтетические данные (не пользовательские): Продукты — Mercadona, Lidl,
// KFC, кафе, без места; Авто — Repsol, парковка, сервис; Подписки — Digi,
// iCloud, другой сервис. Проверяются:
//   1. суммы, доли, сортировка, счётчики, «Без подкатегории»;
//   2. инварианты: Σ мест = сумма категории, Σ категорий = общий расход,
//      каждая операция — ровно в одной строке (нет двойного учёта);
//   3. только расходы: доходы/переводы с тем же payee не учитываются;
//   4. все периоды AF.Services.Period (день/неделя/месяц/год/период/всё);
//   5. фильтр операций места (категория → место → операции);
//   6. сегменты кольца, «Остальные», цвета маркеров = цвета сегментов;
//   7. подсказки мест формы — изоляция по категории и типу;
//   8. старые операции без payee, запасное значение — подкатегория;
//   9. backup/restore, JSON, CSV export → import с payee и без.
global.window = global;
['../js/core/result.js', '../js/core/ids.js', '../js/core/app_info.js',
 '../js/services/tx_meta_service.js', '../js/services/tx_time_service.js',
 '../js/database/store.js', '../js/services/currency_service.js',
 '../js/services/period_service.js', '../js/services/analytics_service.js',
 '../js/services/place_breakdown_service.js', '../js/services/backup_service.js',
 '../js/services/export_service.js', '../js/services/csv_parser_service.js',
 '../js/services/import_source_service.js', '../js/services/import_mapping_service.js',
 '../js/services/import_service.js'].forEach(f => require(f));

const P = AF.Services.PlaceBreakdown, PR = AF.Services.Period, A = AF.Services.Analytics;
const B = AF.Services.Backup, E = AF.Services.Export, CSV = AF.Services.CsvParser,
      SRC = AF.Services.ImportSource, MAP = AF.Services.ImportMapping, IMP = AF.Services.Import;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) { if (cond) passed++; else { failed++; console.error(`FAIL: ${msg}`); } }
const near = (a, b) => Math.abs(a - b) < 1e-9;
const r2 = n => Math.round(n * 100) / 100;

// ---------- синтетическое состояние ----------
let seq = 0;
function tx(cat, amount, date, payee, extra) {
  const t = Object.assign({ id: 'tx_' + (++seq), type: 'expense', amount, cat, account: 'a1', date }, extra || {});
  if (payee !== null && payee !== undefined) t.payee = payee;
  return t;
}
function makeState() {
  seq = 0;
  return {
    schemaVersion: 3, currency: '€',
    accounts: [{ id: 'a1', name: 'Карта', currency: '€' }, { id: 'a2', name: 'Наличные', currency: '€' }],
    cats: [
      { id: 'food', name: 'Продукты', type: 'expense' },
      { id: 'car', name: 'Авто / Prius', type: 'expense' },
      { id: 'subs', name: 'Подписки', type: 'expense' },
      { id: 'salary', name: 'Зарплата', type: 'income' },
    ],
    subcats: [{ id: 's_food_0', categoryId: 'food', name: 'Супермаркет' }],
    tx: [
      // Продукты, 09.2026
      tx('food', 53.12, '2026-09-02', 'Mercadona', { time: '10:15' }),
      tx('food', 61.40, '2026-09-06', 'Mercadona'),
      tx('food', 48.90, '2026-09-11', 'Mercadona'),
      tx('food', 30.00, '2026-09-15', 'mercadona '),          // регистр/пробел — то же место
      tx('food', 25.50, '2026-09-20', 'Mercadona'),
      tx('food', 31.48, '2026-09-27', 'Mercadona'),
      tx('food', 40.15, '2026-09-03', 'Lidl'),
      tx('food', 30.00, '2026-09-10', 'Lidl'),
      tx('food', 32.00, '2026-09-17', 'Lidl'),
      tx('food', 30.00, '2026-09-24', 'Lidl'),
      tx('food', 20.50, '2026-09-04', 'кафе'),
      tx('food', 18.00, '2026-09-08', 'кафе'),
      tx('food', 25.00, '2026-09-12', 'Кафе'),
      tx('food', 15.00, '2026-09-18', 'кафе'),
      tx('food', 20.00, '2026-09-25', 'кафе'),
      tx('food', 17.50, '2026-09-09', 'KFC'),
      tx('food', 17.50, '2026-09-22', 'KFC'),
      tx('food', 10.04, '2026-09-05', null),                  // без места
      tx('food', 12.00, '2026-09-14', null),
      tx('food', 12.00, '2026-09-28', null),
      // Продукты, август 2026 (прошлый период)
      tx('food', 300, '2026-08-10', 'Mercadona'),
      tx('food', 150, '2026-08-12', 'Lidl'),
      // Авто
      tx('car', 45, '2026-09-05', 'Repsol'),
      tx('car', 50, '2026-09-19', 'Repsol'),
      tx('car', 6, '2026-09-07', 'парковка'),
      tx('car', 120, '2026-09-21', 'сервис'),
      // Подписки
      tx('subs', 9.99, '2026-09-01', 'Digi'),
      tx('subs', 2.99, '2026-09-02', 'iCloud'),
      tx('subs', 20, '2026-09-03', 'Другой сервис'),
      // Не расходы — с тем же payee, не должны попасть никуда
      tx('food', 999, '2026-09-10', 'Mercadona', { type: 'income' }),
      tx('salary', 2000, '2026-09-01', 'Mercadona', { type: 'income' }),
      { id: 'tx_tr', type: 'transfer', amount: 500, from: 'a1', to: 'a2', date: '2026-09-13', payee: 'Mercadona', cat: 'food' },
    ],
    budgets: {}, goals: [], reminders: [], healthHistory: [], importBatches: [], settings: {},
  };
}
const inRange = (t, r) => { const d = new Date(t.date); return d >= r.from && d <= r.to; };
const SEPT = PR.range('month', new Date(2026, 8, 15));
const AUG = PR.range('month', new Date(2026, 7, 15));
function sept(st) { return st.tx.filter(t => inRange(t, SEPT)); }

// ============ 1. Продукты: суммы, доли, сортировка, счётчики ============
{
  const st = makeState();
  const bd = P.breakdown(sept(st), 'food');
  assertEqual(bd.count, 20, 'Продукты/сентябрь: 20 расходных операций (доход/перевод с payee Mercadona не учтены)');
  assertEqual(r2(bd.total), 550.09, 'Продукты/сентябрь: сумма категории €550,09');
  assertEqual(bd.rows.map(r => r.label), ['Mercadona', 'Lidl', 'кафе', 'KFC', 'Без подкатегории'],
    'Места отсортированы по сумме ↓; «кафе» — самое частое написание');
  assertEqual(bd.rows.map(r => r2(r.amount)), [250.4, 132.15, 98.5, 35, 34.04], 'Точные суммы мест');
  assertEqual(bd.rows.map(r => r.count), [6, 4, 5, 2, 3], 'Число операций каждого места');
  assertEqual(bd.rows.map(r => r.share.toFixed(1)), ['45.5', '24.0', '17.9', '6.4', '6.2'], 'Доли в процентах от суммы категории');
  assertTrue(near(bd.rows.reduce((s, r) => s + r.share, 0), 100), 'Сумма долей = 100%');
  assertTrue(bd.rows[4].isNone && bd.rows[4].key === P.NONE, '«Без подкатегории» — строка NONE');
  assertEqual(bd.rows.filter(r => r.isNone).length, 1, '«Без подкатегории» ровно одна строка');
  for (let i = 1; i < bd.rows.length; i++) assertTrue(bd.rows[i - 1].amount >= bd.rows[i].amount, `Сортировка по сумме: строка ${i}`);
}

// ============ 2. Инварианты: Σ мест = категория; Σ категорий = общий расход ============
{
  const st = makeState();
  const cur = sept(st);
  const catSum = cat => cur.filter(t => t.type === 'expense' && t.cat === cat).reduce((s, t) => s + t.amount, 0);
  ['food', 'car', 'subs'].forEach(cat => {
    const bd = P.breakdown(cur, cat);
    assertTrue(near(bd.rows.reduce((s, r) => s + r.amount, 0), bd.total), `${cat}: Σ строк = total`);
    assertTrue(near(bd.total, catSum(cat)), `${cat}: Σ мест = сумма категории (как в Аналитике)`);
    assertEqual(bd.rows.reduce((s, r) => s + r.count, 0), bd.count, `${cat}: Σ счётчиков = число операций`);
    // нет двойного учёта: объединение фильтров мест = все операции категории, без пересечений
    const ids = [];
    bd.rows.forEach(r => P.filter(cur, cat, r.key).forEach(t => ids.push(t.id)));
    assertEqual(ids.length, new Set(ids).size, `${cat}: каждая операция ровно в одной строке`);
    assertEqual(ids.length, bd.count, `${cat}: фильтры мест покрывают все операции категории`);
  });
  const cats = Array.from(new Set(cur.filter(t => t.type === 'expense').map(t => t.cat)));
  const sumCats = cats.reduce((s, c) => s + P.breakdown(cur, c).total, 0);
  assertTrue(near(sumCats, A.expense(cur)), 'Σ всех расходных категорий = общий расход периода (AF.Services.Analytics.expense)');
}

// ============ 3. Авто и Подписки ============
{
  const st = makeState();
  const car = P.breakdown(sept(st), 'car');
  assertEqual(car.rows.map(r => [r.label, r.amount, r.count]), [['сервис', 120, 1], ['Repsol', 95, 2], ['парковка', 6, 1]],
    'Авто: сервис / Repsol / парковка — суммы и счётчики');
  assertTrue(!car.rows.some(r => r.isNone), 'Авто: без «Без подкатегории», если все операции с местом');
  const subs = P.breakdown(sept(st), 'subs');
  assertEqual(subs.rows.map(r => r.label), ['Другой сервис', 'Digi', 'iCloud'], 'Подписки: Digi / iCloud / другой сервис');
  assertEqual(r2(subs.total), 32.98, 'Подписки: сумма');
}

// ============ 4. Только расходы ============
{
  const st = makeState();
  const inc = P.breakdown(sept(st), 'salary');
  assertEqual(inc.count, 0, 'Доходная категория в расходной детализации пуста');
  const foodIncome = P.breakdown(sept(st), 'food', { type: 'income' });
  assertEqual(foodIncome.total, 999, 'Явный type:income считает только доходы (расходы не смешиваются)');
  assertTrue(!P.filter(sept(st), 'food', 'mercadona').some(t => t.type !== 'expense'), 'Фильтр места не возвращает доход/перевод');
}

// ============ 5. Периоды: день, неделя, месяц, год, произвольный, всё ============
{
  const st = makeState();
  const anchor = new Date(2026, 8, 15);
  const cases = [
    ['day', 1, 30],                         // 15.09 — Mercadona 30
    ['week', 0, 0],                         // пересчитывается ниже по AF.Services.Period.range('week')
    ['month', 20, 550.09],
    ['year', 22, 1000.09],
  ];
  // уточняем неделю честным пересчётом, чтобы тест не зависел от ручной арифметики
  const wk = PR.range('week', anchor);
  const wkList = st.tx.filter(t => t.type === 'expense' && t.cat === 'food' && inRange(t, wk));
  cases[1] = ['week', wkList.length, wkList.reduce((s, t) => s + t.amount, 0)];
  cases.forEach(([p, cnt, sum]) => {
    const r = PR.range(p, anchor);
    const bd = P.breakdown(st.tx.filter(t => inRange(t, r)), 'food');
    assertEqual(bd.count, cnt, `Период ${p}: число операций`);
    assertEqual(r2(bd.total), r2(sum), `Период ${p}: сумма`);
  });
  const custom = PR.range('custom', anchor, new Date(2026, 7, 1), new Date(2026, 8, 5));
  const bdC = P.breakdown(st.tx.filter(t => inRange(t, custom)), 'food');
  assertEqual(bdC.rows.map(r => r.label), ['Mercadona', 'Lidl', 'кафе', 'Без подкатегории'], 'Произвольный период: места');
  assertEqual(r2(bdC.total), r2(300 + 150 + 53.12 + 40.15 + 20.5 + 10.04), 'Произвольный период: сумма');
  const all = PR.range('all', anchor);
  assertEqual(P.breakdown(st.tx.filter(t => inRange(t, all)), 'food').count, 22, 'Всё время: все расходы категории');
  const aug = P.breakdown(st.tx.filter(t => inRange(t, AUG)), 'food');
  assertEqual(aug.rows.map(r => [r.label, r.amount]), [['Mercadona', 300], ['Lidl', 150]], 'Прошлый месяц: своя детализация');
  const empty = P.breakdown(st.tx.filter(t => inRange(t, PR.range('month', new Date(2026, 6, 1)))), 'food');
  assertEqual([empty.count, empty.total, empty.rows.length], [0, 0, 0], 'Пустой период: 0 операций, без строк (пустое состояние)');
}

// ============ 6. Фильтр: категория → место → операции ============
{
  const st = makeState();
  const cur = sept(st);
  const merc = P.filter(cur, 'food', 'mercadona');
  assertEqual(merc.length, 6, 'Mercadona: 6 операций (включая «mercadona »)');
  assertTrue(merc.every(t => t.cat === 'food' && t.type === 'expense'), 'Mercadona: только расходы «Продуктов»');
  const none = P.filter(cur, 'food', P.NONE);
  assertEqual(none.map(t => t.amount), [10.04, 12, 12], '«Без подкатегории» — только операции категории без места');
  assertEqual(P.filter(cur, 'food', null).length, 20, 'key=null — все операции категории');
  assertEqual(P.filter(cur, 'car', 'mercadona').length, 0, 'Место одной категории не находит операций другой');
  assertEqual(P.filter(cur, 'food', 'repsol').length, 0, 'Repsol не относится к «Продуктам»');
}

// ============ 7. Сегменты кольца и цвета ============
{
  const st = makeState();
  const bd = P.breakdown(sept(st), 'food');
  const segs = P.segments(bd.rows);
  assertEqual(segs.length, 5, '5 мест — 5 сегментов');
  assertTrue(bd.rows.every((r, i) => r.color === segs[i].color), 'Цвет маркера строки = цвет сегмента');
  assertEqual(bd.rows.find(r => r.isNone).color, P.NONE_COLOR, '«Без подкатегории» — нейтральный цвет');
  const pal = bd.rows.filter(r => !r.isNone).map(r => r.color);
  assertEqual(pal, P.PALETTE.slice(0, 4), 'Места получают цвета палитры по порядку, NONE слот палитры не занимает');
  assertTrue(near(segs.reduce((s, g) => s + g.amount, 0), bd.total), 'Σ сегментов = сумма категории');

  // много мест → 7 крупнейших + «Остальные»
  const many = [];
  for (let i = 0; i < 12; i++) many.push(tx('food', 100 - i, '2026-09-10', 'Место ' + i));
  const bm = P.breakdown(many, 'food');
  const sm = P.segments(bm.rows);
  assertEqual(sm.length, P.MAX_SEGMENTS, '12 мест → ровно 8 сегментов');
  assertTrue(sm[7].isRest && sm[7].label === P.REST_LABEL, 'Последний сегмент — «Остальные»');
  assertEqual(sm[7].keys.length, 5, '«Остальные» объединяет 5 мелких мест');
  assertTrue(near(sm[7].amount, bm.rows.slice(7).reduce((s, r) => s + r.amount, 0)), 'Сумма «Остальных» = сумма хвоста');
  assertTrue(bm.rows.slice(7).every(r => r.color === P.REST_COLOR), 'Строки хвоста — цвет «Остальных»');
  assertEqual(bm.rows.length, 12, 'Список показывает все 12 мест (прокрутка), свёртка только в кольце');
  assertTrue(near(sm.reduce((s, g) => s + g.amount, 0), bm.total), 'Σ сегментов с «Остальными» = сумма категории');
  const exact = [];
  for (let i = 0; i < 8; i++) exact.push(tx('food', 10 + i, '2026-09-10', 'X' + i));
  assertEqual(P.segments(P.breakdown(exact, 'food').rows).some(g => g.isRest), false, 'Ровно 8 мест — без «Остальных»');
  assertEqual(P.segments([]).length, 0, 'Пустой список — нет сегментов');
}

// ============ 8. Подсказки формы: изоляция по категории ============
{
  const st = makeState();
  const food = P.suggestions(st.tx, 'food');
  assertEqual(food.slice(0, 4), ['Mercadona', 'кафе', 'Lidl', 'KFC'], 'Продукты: подсказки по частоте ↓');
  assertTrue(!food.includes('Repsol'), 'Repsol из «Авто» не предлагается в «Продуктах»');
  const car = P.suggestions(st.tx, 'car');
  assertEqual(car, ['Repsol', 'сервис', 'парковка'], 'Авто: Repsol первым (2 раза), затем по свежести');
  assertTrue(!car.includes('Mercadona'), 'Mercadona не предлагается в «Авто»');
  assertEqual(P.suggestions(st.tx, 'salary'), [], 'Доходы не подсказываются как места расхода');

  // новое место в «Авто» появляется в подсказках своей категории, не в чужой
  st.tx.push(tx('car', 42.3, '2026-09-30', 'Gasolinera Petronor'));
  assertTrue(P.suggestions(st.tx, 'car').includes('Gasolinera Petronor'), 'Новое место появилось в подсказках «Авто»');
  assertTrue(!P.suggestions(st.tx, 'food').includes('Gasolinera Petronor'), 'Новое место НЕ появилось в «Продуктах»');
  // операция без места не порождает пустую подсказку
  st.tx.push(tx('car', 3, '2026-09-30', null));
  assertTrue(P.suggestions(st.tx, 'car').every(v => v), 'Операция без места не даёт пустой подсказки');
  assertEqual(P.suggestions(st.tx, 'food', { limit: 2 }).length, 2, 'limit ограничивает число чипов');
  assertEqual(P.suggestions(st.tx, 'food').length <= P.MAX_SUGGESTIONS, true, 'По умолчанию не больше MAX_SUGGESTIONS');
  const only = [tx('subs', 1, '2026-09-01', 'Spotify')];
  assertEqual(P.suggestions(only, 'subs', { excludeId: only[0].id }), [], 'excludeId исключает операцию');
  // свежесть: при равной частоте — более поздняя дата раньше
  const fresh = [tx('subs', 1, '2026-09-01', 'Old'), tx('subs', 1, '2026-09-20', 'New')];
  assertEqual(P.suggestions(fresh, 'subs'), ['New', 'Old'], 'При равной частоте — сначала свежее');
}

// ============ 9. Старые операции без payee, подкатегория как запасное значение ============
{
  const sub = id => (id === 's_food_0' ? 'Супермаркет' : '');
  const list = [
    { id: 'o1', type: 'expense', amount: 10, cat: 'food', date: '2026-09-01' },                            // старая: ни payee, ни sub
    { id: 'o2', type: 'expense', amount: 20, cat: 'food', date: '2026-09-02', subcategoryId: 's_food_0' },  // только подкатегория
    { id: 'o3', type: 'expense', amount: 5, cat: 'food', date: '2026-09-03', subcategoryId: 's_food_0', payee: 'Lidl' }, // payee важнее
    { id: 'o4', type: 'expense', amount: 7, cat: 'food', date: '2026-09-04', subcategoryId: 's_gone' },     // удалённая подкатегория
    { id: 'o5', type: 'expense', amount: 3, cat: 'food', date: '2026-09-05', payee: 'супермаркет' },        // payee = имя подкатегории
    { id: 'o6', type: 'expense', amount: 1, cat: 'food', date: '2026-09-06', payee: '   ' },                // пустой payee
  ];
  const bd = P.breakdown(list, 'food', { subName: sub });
  assertEqual(bd.rows.map(r => [r.label, r.amount, r.count]),
    [['Супермаркет', 23, 2], ['Без подкатегории', 18, 3], ['Lidl', 5, 1]],
    'Подкатегория видна в статистике; payee важнее подкатегории; payee и подкатегория с одним именем сливаются');
  assertEqual(P.placeKey(list[0], sub), P.NONE, 'Старая операция без полей → «Без подкатегории»');
  assertEqual(P.placeKey(list[3], sub), P.NONE, 'Удалённая подкатегория → «Без подкатегории», без ошибки');
  assertEqual(P.filter(list, 'food', 'супермаркет', { subName: sub }).map(t => t.id), ['o2', 'o5'], 'Фильтр по месту-подкатегории');
  assertEqual(P.breakdown(list, 'food').rows.find(r => r.isNone).count, 4, 'Без resolver подкатегорий — только payee');
  assertEqual(P.breakdown(null, 'food'), { total: 0, count: 0, rows: [] }, 'null вместо списка — пустой результат, без исключения');
  assertEqual(P.breakdown([null, 5, 'x'], 'food').count, 0, 'Мусорные элементы пропускаются');
}

// ============ 10. Валюта: сумма через amountOf (txBase) ============
{
  const list = [tx('food', 10, '2026-09-01', 'Lidl', { account: 'usd' }), tx('food', 10, '2026-09-02', 'Lidl')];
  const bd = P.breakdown(list, 'food', { amountOf: t => (t.account === 'usd' ? t.amount / 2 : t.amount) });
  assertEqual(bd.total, 15, 'Сумма считается колбэком amountOf (правила валюты вызывающей стороны)');
}

// ============ 11. Сравнение с прошлым периодом без «∞%» ============
{
  assertEqual(P.change(0, 0), { kind: 'none' }, '0 → 0: нет сравнения');
  assertEqual(P.change(50, 0), { kind: 'new' }, 'Прошлый период 0: «новое», не ∞%');
  const c = P.change(550.09, 450);
  assertEqual([c.kind, c.up, c.pct.toFixed(1)], ['pct', true, '22.2'], 'Рост на 22,2%');
  const d = P.change(300, 450);
  assertEqual([d.kind, d.up, d.pct.toFixed(1)], ['pct', false, '33.3'], 'Снижение на 33,3%');
  assertTrue(!/∞|Infinity|NaN/.test(JSON.stringify([P.change(1, 0), P.change(0, 0), P.change(0, 5)])), 'Нет ∞/NaN');
}

// ============ 12. Backup / restore ============
{
  const st = makeState();
  const file = B.create(st, { appVersion: '0.0.0-test', createdAt: 1 });
  const res = B.restore(file);
  assertTrue(res.ok, 'Новая резервная копия с payee восстанавливается');
  const back = res.value;
  assertEqual(back.tx.filter(t => t.payee).length, st.tx.filter(t => t.payee).length, 'Backup сохраняет все значения места');
  assertEqual(P.breakdown(sept(back), 'food').rows.map(r => [r.label, r2(r.amount)]),
    P.breakdown(sept(st), 'food').rows.map(r => [r.label, r2(r.amount)]), 'Детализация после restore совпадает');
  // старая копия без поля payee
  const old = makeState();
  old.tx.forEach(t => { delete t.payee; });
  old.tx[0].futureField = { x: 1 };                        // неизвестное поле не теряется
  const oldRes = B.restore(JSON.stringify({ app: 'Alex Finance', data: old }));
  assertTrue(oldRes.ok, 'Старая копия без payee восстанавливается без ошибки');
  const ob = P.breakdown(sept(oldRes.value), 'food');
  assertEqual(ob.rows.map(r => r.label), ['Без подкатегории'], 'Старые операции — одной строкой «Без подкатегории»');
  assertEqual(r2(ob.total), 550.09, 'Старая копия: сумма категории та же');
  assertEqual(oldRes.value.tx[0].futureField, { x: 1 }, 'Неизвестное дополнительное поле операции сохранено');
  // migrate нормализует payee (пробелы) и не создаёт пустой ключ
  const m = AF.Store.migrate(Object.assign(AF.Store.defaults(), {
    tx: [{ id: 'm1', type: 'expense', amount: 1, cat: 'food', account: 'cash', date: '2026-09-01', payee: '  Mercadona   Oviedo ' },
         { id: 'm2', type: 'expense', amount: 1, cat: 'food', account: 'cash', date: '2026-09-01', payee: '' }] }));
  assertEqual(m.tx[0].payee, 'Mercadona Oviedo', 'migrate: пробелы в месте схлопнуты');
  assertTrue(!('payee' in m.tx[1]), 'migrate: пустое место — ключа нет');
}

// ============ 13. JSON и CSV export → import ============
{
  const st = makeState();
  const json = JSON.parse(E.toJSON(st));
  assertEqual(json.tx.filter(t => t.payee === 'Mercadona').length, 9, 'JSON-экспорт сохраняет payee (включая доход/перевод)');

  const expOnly = st.tx.filter(t => t.type === 'expense');
  const text = E.csv(expOnly, st);
  const head = text.split('\n')[0].split(',');
  assertEqual(head[5], 'Контрагент', 'CSV: колонка места — «Контрагент» (позиция 5)');
  const parsed = CSV.parse(text);
  assertTrue(parsed.ok, 'CSV экспорта разбирается');
  const target = { schemaVersion: 3, currency: '€', accounts: st.accounts.slice(), cats: st.cats.slice(), subcats: [],
    tx: [], budgets: {}, goals: [], reminders: [], healthHistory: [], importBatches: [], settings: {} };
  const p = parsed.value, mapping = SRC.autoMap(p.header).map;
  assertTrue(mapping.payee === 5, 'Импорт распознаёт колонку места');
  const plan = IMP.buildPlan({ body: p.body, mapping, state: target,
    accountPlan: MAP.buildAccountPlan(IMP.collectAccountNames(p.body, mapping), target.accounts),
    categoryPlan: MAP.buildCategoryPlan(IMP.collectCategoryEntries(p.body, mapping), target.cats), skipDuplicates: true });
  const imported = plan.items.filter(i => i.tx).map(i => i.tx);
  assertEqual(imported.length, expOnly.length, 'Импортированы все расходы');
  const bdIn = P.breakdown(imported.filter(t => inRange(t, SEPT)), 'food');
  assertEqual(bdIn.rows.map(r => [r.label, r.count, r2(r.amount)]),
    P.breakdown(sept(st), 'food').rows.map(r => [r.label, r.count, r2(r.amount)]), 'CSV round-trip: детализация совпадает');

  // старый CSV без колонки места
  const oldCsv = 'Дата,Счёт,Сумма,Валюта,Категория,Примечание\n02.09.2026,Карта,-10,EUR,Продукты,хлеб\n03.09.2026,Карта,-5,EUR,Продукты,';
  const po = CSV.parse(oldCsv).value, mo = SRC.autoMap(po.header).map;
  assertEqual(mo.payee, -1, 'Старый CSV: колонки места нет');
  const planOld = IMP.buildPlan({ body: po.body, mapping: mo, state: target,
    accountPlan: MAP.buildAccountPlan(IMP.collectAccountNames(po.body, mo), target.accounts),
    categoryPlan: MAP.buildCategoryPlan(IMP.collectCategoryEntries(po.body, mo), target.cats), skipDuplicates: true });
  const oldTx = planOld.items.filter(i => i.tx).map(i => i.tx);
  assertEqual(oldTx.length, 2, 'Старый CSV без места импортируется');
  assertEqual(P.breakdown(oldTx, 'food').rows.map(r => r.label), ['Без подкатегории'], 'Старый CSV: операции без места');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
