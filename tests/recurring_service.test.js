// tests/recurring_service.test.js — регулярные платежи (TASK_061).
// Запуск: node tests/recurring_service.test.js
//
// Синтетические данные (не пользовательские). Проверяются:
//   1. даты повторов (AF.Services.Forecast): 31-е / 30-е / 29 фев, високосный
//      год, переход года, еженедельно и ежедневно, переход на летнее время,
//      локальный разбор 'YYYY-MM-DD' (в т.ч. в поясе западнее UTC);
//   2. месячный / годовой эквивалент: смешанная периодичность, целые центы
//      без ошибок float, только активные расходы, валюта счёта;
//   3. сортировка: ближайшие первыми, стабильность, «по сумме»;
//   4. подписи даты и числа платежей;
//   5. авто-проводка: даты, защита от дублей (lastPosted, тот же период,
//      переход со старых «уплывших» дат), пауза и возобновление без
//      задним числом созданных операций;
//   6. нет двойного учёта: сервис не меняет state, баланс и операции.
// Файл перезапускает себя с TZ=America/Los_Angeles (§7), чтобы проверить
// календарные даты западнее UTC.
if (!process.env.TZ) process.env.TZ = 'Europe/Madrid';
global.window = global;
['../js/core/result.js', '../js/core/ids.js', '../js/services/currency_service.js',
 '../js/services/account_service.js', '../js/services/forecast_service.js',
 '../js/services/recurring_service.js'].forEach(f => require(f));

const F = AF.Services.Forecast, R = AF.Services.Recurring, C = AF.Services.Currency;
let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; console.error(`FAIL [${process.env.TZ}]: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) { if (cond) passed++; else { failed++; console.error(`FAIL [${process.env.TZ}]: ${msg}`); } }
const D = (y, m, d) => new Date(y, m - 1, d);
const iso = d => (d ? F.toIso(d) : null);
const rem = (o) => Object.assign({ id: 'r' + Math.random().toString(36).slice(2), title: 'X', type: 'expense', isActive: true }, o);
const occIso = (r, a, b) => F.occurrencesBetween(r, a, b).map(iso);

// ============ §1 — даты повторов ============
{
  assertEqual(iso(F.parseDate('2026-10-16')), '2026-10-16', 'parseDate: YYYY-MM-DD → тот же локальный день');
  assertEqual(F.parseDate('2026-10-16').getHours(), 0, 'parseDate: локальная полночь, не UTC');
  assertEqual(iso(F.parseDate('2026-10-16T22:30:00')), '2026-10-16', 'parseDate: дата с временем → календарный день из строки');
  assertEqual(F.parseDate('мусор'), null, 'parseDate: мусор → null');
  assertEqual(F.parseDate(''), null, 'parseDate: пусто → null');

  const m31 = rem({ dueDate: '2026-01-31', repeatType: 'monthly' });
  assertEqual(occIso(m31, D(2026, 1, 1), D(2026, 6, 30)),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30'],
    'Ежемесячно 31-го: короткие месяцы — последний день, без «уплывания» на 3-е');
  assertEqual(occIso(m31, D(2028, 2, 1), D(2028, 3, 31)), ['2028-02-29', '2028-03-31'], '31-е в високосном феврале → 29 фев');
  const m30 = rem({ dueDate: '2026-11-30', repeatType: 'monthly' });
  assertEqual(occIso(m30, D(2026, 11, 1), D(2027, 3, 31)), ['2026-11-30', '2026-12-30', '2027-01-30', '2027-02-28', '2027-03-30'],
    'Ежемесячно 30-го: переход года, февраль → 28');
  const m29 = rem({ dueDate: '2027-01-29', repeatType: 'monthly' });
  assertEqual(occIso(m29, D(2027, 1, 1), D(2027, 3, 31)), ['2027-01-29', '2027-02-28', '2027-03-29'], '29-е в невисокосном феврале → 28');
  assertEqual(occIso(m29, D(2028, 2, 1), D(2028, 2, 29)), ['2028-02-29'], '29-е в високосном феврале → 29');

  const y29 = rem({ dueDate: '2024-02-29', repeatType: 'yearly' });
  assertEqual(occIso(y29, D(2024, 1, 1), D(2028, 12, 31)), ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'],
    'Ежегодно 29 фев: 28 фев в обычные годы и снова 29 в високосный');
  const yDec = rem({ dueDate: '2025-12-31', repeatType: 'yearly' });
  assertEqual(iso(F.nextOccurrence(yDec, D(2026, 10, 16))), '2026-12-31', 'Ежегодно 31 дек: следующая дата в этом году');
  assertEqual(iso(F.nextOccurrence(yDec, D(2027, 1, 1))), '2027-12-31', 'Ежегодно: после даты — следующий год');

  const w = rem({ dueDate: '2026-12-24', repeatType: 'weekly' });
  assertEqual(occIso(w, D(2026, 12, 20), D(2027, 1, 15)), ['2026-12-24', '2026-12-31', '2027-01-07', '2027-01-14'], 'Еженедельно: через Новый год');
  const wDst = rem({ dueDate: '2026-03-23', repeatType: 'weekly' });
  assertEqual(occIso(wDst, D(2026, 3, 23), D(2026, 4, 7)), ['2026-03-23', '2026-03-30', '2026-04-06'], 'Еженедельно: переход на летнее время не сдвигает день');
  const wDst2 = rem({ dueDate: '2026-10-19', repeatType: 'weekly' });
  assertEqual(occIso(wDst2, D(2026, 10, 19), D(2026, 11, 3)), ['2026-10-19', '2026-10-26', '2026-11-02'], 'Еженедельно: переход на зимнее время не сдвигает день');
  const dly = rem({ dueDate: '2026-03-28', repeatType: 'daily' });
  assertEqual(occIso(dly, D(2026, 3, 28), D(2026, 3, 31)), ['2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31'], 'Ежедневно через переход на летнее время');
  assertEqual(iso(F.nextOccurrence(rem({ dueDate: '2010-01-01', repeatType: 'daily' }), D(2026, 10, 16))), '2026-10-16',
    'Ежедневно с давней датой: ближайшая — сегодня (нет лимита 4000 шагов)');

  // ближайшая дата относительно сегодня
  const today = D(2026, 10, 16);
  assertEqual(iso(F.nextOccurrence(rem({ dueDate: '2026-01-16', repeatType: 'monthly' }), today)), '2026-10-16', 'Дата сегодня → сегодня');
  assertEqual(iso(F.nextOccurrence(rem({ dueDate: '2026-01-15', repeatType: 'monthly' }), today)), '2026-11-15', 'Дата прошла в этом месяце → следующий месяц');
  assertEqual(iso(F.nextOccurrence(rem({ dueDate: '2026-12-05', repeatType: 'monthly' }), today)), '2026-12-05', 'Первая дата в будущем → сама она');
  assertEqual(iso(F.nextOccurrence(rem({ dueDate: '2026-01-31', repeatType: 'monthly' }), D(2026, 12, 1))), '2026-12-31', '31-е в декабре');
  assertEqual(iso(F.nextOccurrence(rem({ dueDate: '2026-01-31', repeatType: 'monthly' }), D(2027, 1, 1))), '2027-01-31', 'Переход года для 31-го');
  assertEqual(iso(F.previousOccurrence(rem({ dueDate: '2026-01-31', repeatType: 'monthly' }), D(2026, 10, 16))), '2026-09-30', 'previousOccurrence: 31-е → 30 сен');
  assertEqual(F.previousOccurrence(rem({ dueDate: '2026-12-01', repeatType: 'monthly' }), D(2026, 10, 16)), null, 'previousOccurrence: ещё не было → null');

  // разовые — как раньше
  const once = rem({ dueDate: '2026-10-20', repeatType: 'none' });
  assertEqual(occIso(once, D(2026, 10, 1), D(2026, 10, 31)), ['2026-10-20'], 'Разовое: одна дата в диапазоне');
  assertEqual(occIso(once, D(2026, 11, 1), D(2026, 11, 30)), [], 'Разовое: вне диапазона — пусто');
  assertEqual(iso(F.nextOccurrence(once, D(2026, 12, 1))), '2026-10-20', 'Разовое: nextOccurrence — сам dueDate (прежнее поведение)');
  // день календаря: границы from/to со временем (как в Календаре)
  assertEqual(occIso(m31, new Date(2026, 3, 30, 0, 0, 0), new Date(2026, 3, 30, 23, 59, 59)), ['2026-04-30'], 'Запрос одного дня (Календарь)');
}

// ============ §2 — эквиваленты ============
{
  const base = r => R.toCents(r.amount);
  assertEqual(R.yearlyCents(rem({ amount: 20, repeatType: 'monthly' })), 24000, '20 € ежемесячно → 240 € в год');
  assertEqual(R.yearlyCents(rem({ amount: 120, repeatType: 'yearly' })), 12000, '120 € ежегодно → 120 € в год');
  assertEqual(R.yearlyCents(rem({ amount: 30, repeatType: 'weekly' })), 156000, '30 € еженедельно → 52 недели = 1560 €');
  assertEqual(R.yearlyCents(rem({ amount: 2, repeatType: 'daily' })), 73000, '2 € ежедневно → 365 дней = 730 €');
  assertEqual(R.yearlyCents(rem({ amount: 5, repeatType: 'none' })), 0, 'Разовое не входит в эквивалент');

  let s = R.summary([rem({ amount: 120, repeatType: 'yearly' })], base);
  assertEqual([s.monthlyCents, s.yearlyCents], [1000, 12000], '120 € в год → 10 € в месяц');
  s = R.summary([rem({ amount: 30, repeatType: 'weekly' })], base);
  assertEqual([s.monthlyCents, s.yearlyCents], [13000, 156000], '30 € в неделю → 1560/12 = 130 € в месяц');

  // смешанная периодичность + float-ловушки (0.1 + 0.2, 7.99, 9.99)
  const mix = [
    rem({ title: 'ChatGPT', amount: 7.99, repeatType: 'monthly' }),
    rem({ title: 'iCloud', amount: 0.99, repeatType: 'monthly' }),
    rem({ title: 'Страховка', amount: 119.9, repeatType: 'yearly' }),
    rem({ title: 'Кофе', amount: 0.1, repeatType: 'weekly' }),
    rem({ title: 'Хлеб', amount: 0.2, repeatType: 'daily' }),
    rem({ title: 'Зарплата', amount: 2000, repeatType: 'monthly', type: 'income' }),
    rem({ title: 'Пауза', amount: 50, repeatType: 'monthly', isActive: false }),
    rem({ title: 'IBI', amount: 300, repeatType: 'none' }),
  ];
  s = R.summary(mix, base);
  // 799*12 + 99*12 + 11990 + 10*52 + 20*365 = 9588 + 1188 + 11990 + 520 + 7300 = 30586
  assertEqual(s.yearlyCents, 30586, 'Смешанная периодичность: годовой эквивалент в целых центах');
  assertEqual(s.monthlyCents, 2549, 'Месячный = годовой / 12 с одним округлением (30586 / 12 = 2548,83 → 2549 центов)');
  assertEqual([s.yearly, s.monthly], [305.86, 25.49], 'Евро без хвостов float');
  assertEqual(s.count, 5, 'Считаются только активные повторяющиеся расходы');
  assertEqual([s.pausedCount, s.incomeCount], [1, 1], 'Приостановленные и доходы — отдельно');
  assertTrue(Number.isInteger(s.yearlyCents) && Number.isInteger(s.monthlyCents), 'Результат — целые центы');

  // пример из постановки: 1 955,04 € / год → 162,92 € / мес
  s = R.summary([rem({ amount: 1955.04, repeatType: 'yearly' })], base);
  assertEqual([s.monthly, s.yearly], [162.92, 1955.04], '1 955,04 € / год → 162,92 € / мес');
  // округление один раз, а не по платежу: 3 × (10 €/год) = 30 €/год = 2,50 €/мес (а не 3 × 0,83 = 2,49)
  s = R.summary([1, 2, 3].map(() => rem({ amount: 10, repeatType: 'yearly' })), base);
  assertEqual(s.monthlyCents, 250, 'Нет округления каждого платежа до суммирования');

  // валюта счёта → базовая (toBaseCents передаёт UI)
  const state = { currency: '€', rates: { '$': 1.25 } };
  const usd = rem({ amount: 12.5, repeatType: 'monthly' });
  s = R.summary([usd], r => R.toCents(C.toBase(state, r.amount, '$')));
  assertEqual(s.monthlyCents, 1000, '12,50 $ при курсе 1,25 → 10 € в месяц');

  s = R.summary([], base);
  assertEqual([s.count, s.monthlyCents, s.yearlyCents], [0, 0, 0], 'Пустой список → 0');
  s = R.summary(undefined, base);
  assertEqual(s.count, 0, 'Нет reminders → 0, без ошибок');
  assertEqual(R.toCents('abc'), 0, 'toCents: мусор → 0');
  assertEqual([R.toCents(7.99), R.toCents(0.1 + 0.2), R.toCents(119.9)], [799, 30, 11990], 'toCents: хвосты float снимаются');
}

// ============ §3 — сортировка ============
{
  const today = D(2026, 10, 16);
  const list = [
    rem({ id: 'a', title: 'Netflix', amount: 12.99, dueDate: '2026-01-20', repeatType: 'monthly' }),
    rem({ id: 'b', title: 'Аренда', amount: 800, dueDate: '2026-01-01', repeatType: 'monthly' }),
    rem({ id: 'c', title: 'ChatGPT', amount: 7.99, dueDate: '2026-01-16', repeatType: 'monthly' }),
    rem({ id: 'd', title: 'Spotify', amount: 9.99, dueDate: '2026-01-20', repeatType: 'monthly' }),
    rem({ id: 'e', title: 'Apple', amount: 9.99, dueDate: '2026-01-20', repeatType: 'monthly' }),
    rem({ id: 'f', title: 'Разовое', amount: 1, dueDate: '2026-10-17', repeatType: 'none' }),
  ];
  const items = R.items(list, today);
  assertEqual(items.length, 5, 'items: только повторяющиеся');
  assertEqual(R.sort(items, 'date').map(x => x.r.id), ['c', 'e', 'a', 'd', 'b'],
    'По дате: сегодня → 20-е (по названию) → 1 ноя');
  assertEqual(R.sort(items, 'date').map(x => x.iso), ['2026-10-16', '2026-10-20', '2026-10-20', '2026-10-20', '2026-11-01'], 'Следующие даты относительно сегодня');
  assertEqual(R.sort(items, 'amount').map(x => x.r.id), ['b', 'a', 'e', 'd', 'c'], 'По сумме: крупные первыми, равные — по дате и названию');
  assertEqual(R.sort(items.slice().reverse(), 'date').map(x => x.r.id), ['c', 'e', 'a', 'd', 'b'], 'Сортировка стабильна при любом исходном порядке');
  const twins = [rem({ id: 'x2', title: 'Same', amount: 1, dueDate: '2026-01-20', repeatType: 'monthly' }),
                 rem({ id: 'x1', title: 'Same', amount: 1, dueDate: '2026-01-20', repeatType: 'monthly' })];
  assertEqual(R.sort(R.items(twins, today), 'date').map(x => x.r.id), ['x1', 'x2'], 'Полные близнецы — детерминированно по id');
  const snapshot = JSON.stringify(list);
  R.sort(R.items(list, today), 'amount');
  assertEqual(JSON.stringify(list), snapshot, 'Сортировка не меняет данные платежей (даты в хранилище)');
  assertEqual(R.items([rem({ dueDate: 'bad', repeatType: 'monthly' })], today).length, 0, 'Битая дата — строка пропускается без ошибки');
}

// ============ §4 — подписи ============
{
  const t = D(2026, 10, 16);
  assertEqual(R.dateLabel(D(2026, 10, 16), t), 'Сегодня', 'dateLabel: сегодня');
  assertEqual(R.dateLabel(D(2026, 10, 17), t), 'Завтра', 'dateLabel: завтра');
  assertEqual(R.dateLabel(D(2026, 11, 1), t), D(2026, 11, 1).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), 'dateLabel: «1 нояб.» без года');
  assertTrue(/2027/.test(R.dateLabel(D(2027, 1, 5), t)), 'dateLabel: другой год — с годом');
  assertEqual(R.dateLabel(D(2026, 10, 31), D(2026, 10, 30)), 'Завтра', 'dateLabel: сутки через переход на зимнее время — «Завтра»');
  assertEqual([0, 1, 2, 5, 11, 12, 21, 22, 25, 101, 111].map(n => R.countLabel(n)),
    ['0 активных платежей', '1 активный платёж', '2 активных платежа', '5 активных платежей', '11 активных платежей',
     '12 активных платежей', '21 активный платёж', '22 активных платежа', '25 активных платежей', '101 активный платёж', '111 активных платежей'],
    'countLabel: русские формы множественного числа');
  assertEqual([R.LABEL.monthly, R.LABEL.weekly, R.LABEL.yearly, R.LABEL.daily], ['Ежемесячно', 'Еженедельно', 'Ежегодно', 'Ежедневно'], 'Подписи периодичности');
  assertEqual(C.format(7.9, '€', { cents: true }), '€' + (7.9).toLocaleString('ru-RU', { minimumFractionDigits: 2 }), 'format cents: «€7,90»');
  assertEqual(C.format(20, '€', { cents: true }), '€20', 'format cents: целые без копеек');
  assertEqual(C.format(7.9, '€'), '€' + (7.9).toLocaleString('ru-RU', { maximumFractionDigits: 2 }), 'format без opts — прежнее поведение');
}

// ============ §5 — авто-проводка, пауза ============
{
  const now = D(2026, 10, 16);
  const base = { autoPost: true, amount: 10, type: 'expense' };
  assertEqual(R.autoPostDates(rem(Object.assign({ dueDate: '2026-08-05', repeatType: 'monthly' }, base)), now),
    ['2026-08-05', '2026-09-05', '2026-10-05'], 'Без lastPosted — с dueDate по сегодня');
  assertEqual(R.autoPostDates(rem(Object.assign({ dueDate: '2026-08-05', repeatType: 'monthly', lastPosted: '2026-09-05' }, base)), now),
    ['2026-10-05'], 'После lastPosted — только новые');
  assertEqual(R.autoPostDates(rem(Object.assign({ dueDate: '2026-08-05', repeatType: 'monthly', lastPosted: '2026-10-05' }, base)), now),
    [], 'Повторный запуск в тот же день — ничего (нет дублей)');
  assertEqual(R.autoPostDates(rem(Object.assign({ dueDate: '2026-10-16', repeatType: 'monthly' }, base)), now), ['2026-10-16'], 'Сегодняшний повтор проводится');
  assertEqual(R.autoPostDates(rem(Object.assign({ dueDate: '2026-10-17', repeatType: 'monthly' }, base)), now), [], 'Будущий — нет');
  assertEqual(R.autoPostDates(rem(Object.assign({ dueDate: '2026-08-05', repeatType: 'monthly', autoPost: false }, base, { autoPost: false })), now), [], 'autoPost выключен — нет');
  assertEqual(R.autoPostDates(rem(Object.assign({ dueDate: '2026-08-05', repeatType: 'monthly', isActive: false }, base)), now), [], 'Приостановлен — нет');
  assertEqual(R.autoPostDates(rem(Object.assign({ dueDate: '2026-08-05', repeatType: 'none' }, base)), now), [], 'Разовое — нет (как раньше)');
  // переход со старых «уплывших» дат: раньше 31 янв → 3 мар → … → 3 окт
  const drift = rem(Object.assign({ dueDate: '2026-01-31', repeatType: 'monthly', lastPosted: '2026-10-03' }, base));
  assertEqual(R.autoPostDates(drift, D(2026, 10, 31)), [], 'Октябрь уже проведён 3-го по старой дате → 31 окт не дублируется');
  assertEqual(R.autoPostDates(drift, D(2026, 11, 30)), ['2026-11-30'], 'Дальше — по исправленным датам (30 ноя)');
  // правка даты после проводки в том же месяце
  const moved = rem(Object.assign({ dueDate: '2026-01-20', repeatType: 'monthly', lastPosted: '2026-10-03' }, base));
  assertEqual(R.autoPostDates(moved, D(2026, 10, 25)), [], 'Перенос даты на 20-е после проводки 3-го — без второй операции в октябре');
  const yr = rem(Object.assign({ dueDate: '2025-03-01', repeatType: 'yearly', lastPosted: '2026-02-27' }, base));
  assertEqual(R.autoPostDates(yr, D(2026, 10, 16)), [], 'Ежегодно: один раз за год');
  const wk = rem(Object.assign({ dueDate: '2026-10-01', repeatType: 'weekly', lastPosted: '2026-10-08' }, base));
  assertEqual(R.autoPostDates(wk, now), ['2026-10-15'], 'Еженедельно: следующий повтор после lastPosted');

  // пауза / возобновление
  assertEqual(R.pausePatch(), { isActive: false }, 'pausePatch: isActive=false (существующее поле)');
  const p31 = rem(Object.assign({ dueDate: '2026-01-31', repeatType: 'monthly', lastPosted: '2026-06-30', isActive: false }, base));
  const patch = R.resumePatch(p31, now);
  assertEqual(patch, { isActive: true, lastPosted: '2026-09-30', lastPostedV: 2 }, 'resumePatch: пропущенные за паузу повторы помечены, не проводятся');
  const resumed = Object.assign({}, p31, patch);
  assertEqual(R.autoPostDates(resumed, now), [], 'После возобновления 16 окт — ничего задним числом');
  assertEqual(R.autoPostDates(resumed, D(2026, 10, 31)), ['2026-10-31'], 'Ближайший повтор 31 окт — проводится');
  const pToday = rem(Object.assign({ dueDate: '2026-01-16', repeatType: 'monthly', lastPosted: '2026-05-16', isActive: false }, base));
  assertEqual(R.autoPostDates(Object.assign({}, pToday, R.resumePatch(pToday, now)), now), ['2026-10-16'], 'Возобновление в день платежа — сегодняшний проводится');
  assertEqual(R.resumePatch(rem({ dueDate: '2026-01-01', repeatType: 'monthly', isActive: false }), now), { isActive: true }, 'Без autoPost — только isActive');
  const fut = rem(Object.assign({ dueDate: '2026-12-01', repeatType: 'monthly', isActive: false }, base));
  assertEqual(R.resumePatch(fut, now), { isActive: true }, 'Повторов ещё не было — lastPosted не трогаем');
  const ahead = rem(Object.assign({ dueDate: '2026-01-05', repeatType: 'monthly', lastPosted: '2026-10-05', isActive: false }, base));
  assertEqual(R.resumePatch(ahead, now), { isActive: true }, 'lastPosted не откатывается назад');
}

// ============ §5b — авто-проводка: законные повторы и переход со старого формата ============
{
  // processAutoPost в миниатюре (как в index.html): даты → нормализация → lastPosted нового формата
  const newRun = (r, now, sink) => {
    const occ = R.autoPostDates(r, now);
    const n = R.normalizePatch(r); if (n) Object.assign(r, n);
    occ.forEach(iso => sink.push(iso));
    if (occ.length) { r.lastPosted = occ[occ.length - 1]; r.lastPostedV = R.LAST_POSTED_V; }
    return occ;
  };
  const days = (a, b, fn) => { for (let d = new Date(a); d <= b; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) fn(d); };
  const auto = o => rem(Object.assign({ autoPost: true, amount: 10 }, o));
  const idxOf = (r, iso) => F.indexFrom(F.parseDate(r.dueDate), r.repeatType, F.parseDate(iso));

  // 1) законные повторы не блокируются: ежедневно открываем приложение
  const legit = [
    ['daily', '2026-03-20', D(2026, 3, 20), D(2026, 4, 5)],      // через переход на летнее время
    ['weekly', '2026-10-06', D(2026, 10, 6), D(2027, 1, 12)],    // через зимнее время и Новый год
    ['monthly', '2026-01-31', D(2026, 1, 31), D(2027, 3, 31)],   // 31-е, февраль, переход года
    ['monthly', '2026-01-15', D(2026, 1, 15), D(2026, 12, 31)],
    ['yearly', '2024-02-29', D(2024, 2, 29), D(2029, 3, 1)],     // 29 фев и високосные годы
  ];
  legit.forEach(([rt, due, a, b]) => {
    const r = auto({ dueDate: due, repeatType: rt }), got = [];
    days(a, b, d => newRun(r, d, got));
    const want = occIso(r, F.parseDate(due), b);
    assertEqual(got, want, `${rt} ${due}: каждый повтор проведён ровно один раз, в свой день`);
    assertEqual(newRun(r, b, []), [], `${rt} ${due}: повторный запуск в тот же день — без дублей`);
  });
  // 2) догоняющая проводка после долгого перерыва: все пропущенные повторы, по одному
  const gapD = auto({ dueDate: '2026-10-01', repeatType: 'daily', lastPosted: '2026-10-05', lastPostedV: 2 });
  assertEqual(R.autoPostDates(gapD, D(2026, 10, 15)).length, 10, 'Ежедневно: 10 дней без входа → 10 операций (6–15 окт)');
  const gapW = auto({ dueDate: '2026-09-01', repeatType: 'weekly', lastPosted: '2026-09-08', lastPostedV: 2 });
  assertEqual(R.autoPostDates(gapW, D(2026, 10, 16)), ['2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13'], 'Еженедельно: догоняющая проводка без пропусков');
  const gapM = auto({ dueDate: '2026-01-31', repeatType: 'monthly', lastPosted: '2026-06-30', lastPostedV: 2 });
  assertEqual(R.autoPostDates(gapM, D(2026, 10, 31)), ['2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31'], 'Ежемесячно 31-го: догоняющая проводка, ни один месяц не заблокирован');
  const gapY = auto({ dueDate: '2024-02-29', repeatType: 'yearly', lastPosted: '2024-02-29', lastPostedV: 2 });
  assertEqual(R.autoPostDates(gapY, D(2026, 10, 16)), ['2025-02-28', '2026-02-28'], 'Ежегодно 29 фев: 28 фев в обычные годы, без блокировки');
  // 3) lastPosted нового формата никогда не перечитывается как старый (ежедневно летом:
  //    новая дата повтора k совпадает со старой датой повтора k+1)
  const v2 = auto({ dueDate: '2026-01-10', repeatType: 'daily', lastPosted: '2026-07-14', lastPostedV: 2 });
  assertEqual(R.autoPostDates(v2, D(2026, 7, 15)), ['2026-07-15'], 'lastPostedV:2 — 15 июля проводится (не принимается за старую дату)');
  assertEqual(R.normalizePatch(v2), null, 'Нормализация нового формата не нужна');
  // форма операции: lastPosted = dueDate (повтор 0) — тот же смысл в любом формате
  const txForm = auto({ dueDate: '2026-02-03', repeatType: 'monthly', lastPosted: '2026-02-03' });
  assertEqual(R.effectiveLastPosted(txForm), '2026-02-03', 'lastPosted из формы операции (= dueDate) не меняется');

  // 4) переход со старого формата: lastPosted, записанный старым кодом
  //    (копия логики до TASK_061: UTC-разбор, накопительный setMonth, toISOString)
  const oldOcc = (r, from, to) => {
    const out = []; const rt = r.repeatType; let d = new Date(r.dueDate), g = 0;
    while (d < from && g++ < 4000) d = R._legacyAdvance(d, rt);
    g = 0; while (d <= to && g++ < 4000) { if (d >= from) out.push(new Date(d)); d = R._legacyAdvance(d, rt); }
    return out;
  };
  const oldRun = (r, now, sink) => {
    const today = new Date(now); today.setHours(23, 59, 59, 999);
    let from; if (r.lastPosted) { from = new Date(r.lastPosted); from.setDate(from.getDate() + 1); } else from = new Date(r.dueDate);
    from.setHours(0, 0, 0, 0);
    const occ = oldOcc(r, from, today).map(d => d.toISOString().slice(0, 10));
    occ.forEach(x => sink.push(x)); if (occ.length) r.lastPosted = occ[occ.length - 1];
  };
  const trans = [
    ['daily', '2026-01-10'], ['weekly', '2026-01-06'], ['monthly', '2026-01-20'], ['monthly', '2026-01-31'],
    ['monthly', '2026-06-30'], ['yearly', '2025-02-10'], ['yearly', '2024-02-29'], ['weekly', '2026-07-07'],
  ];
  trans.forEach(([rt, due]) => {
    const r = auto({ dueDate: due, repeatType: rt }), oldSink = [], newSink = [];
    days(D(2026, 1, 1), D(2026, 10, 16), d => oldRun(r, d, oldSink));          // старая версия — до 16 окт
    const k = R.legacyPostedIndex(r);
    if (!r.lastPosted) { assertTrue(true, 'нет проводок'); return; }
    assertTrue(k >= 0, `${rt} ${due}: старый lastPosted ${r.lastPosted} распознан (повтор №${k})`);
    days(D(2026, 10, 17), D(2028, 3, 31), d => newRun(r, d, newSink));          // новая версия
    assertEqual(r.lastPostedV, R.LAST_POSTED_V, `${rt} ${due}: lastPosted переведён в новый формат`);
    const want = occIso(r, F.parseDate(due), D(2028, 3, 31)).slice(k + 1);
    assertEqual(newSink, want, `${rt} ${due}: после перехода — ровно повторы №${k + 1}…, без дубля последнего старого и без пропусков`);
    assertEqual(newRun(r, D(2028, 3, 31), []), [], `${rt} ${due}: повторный запуск — без дублей`);
  });
  // конкретные случаи (Europe/Madrid): старая летняя дата на день раньше настоящей
  if (process.env.TZ === 'Europe/Madrid') {
    const w = auto({ dueDate: '2026-01-06', repeatType: 'weekly', lastPosted: '2026-10-12' });   // проведено 13 окт (вт)
    assertEqual(R.effectiveLastPosted(w), '2026-10-13', 'Еженедельно: старое «12 окт» = повтор 13 окт');
    assertEqual(R.autoPostDates(w, D(2026, 10, 17)), [], 'Еженедельно: 13 окт не проводится второй раз');
    const dd = auto({ dueDate: '2026-01-10', repeatType: 'daily', lastPosted: '2026-10-15' });   // проведено 16 окт
    assertEqual(R.autoPostDates(dd, D(2026, 10, 17)), ['2026-10-17'], 'Ежедневно: после старого «15 окт» (= 16 окт) — только 17 окт');
    const m31 = auto({ dueDate: '2026-01-31', repeatType: 'monthly', lastPosted: '2026-10-02' }); // старый 9-й платёж («3 окт»)
    assertEqual(R.effectiveLastPosted(m31), '2026-09-30', '31-е: старый 9-й платёж → новый 9-й (30 сен)');
    assertEqual(R.autoPostDates(m31, D(2026, 10, 31)), ['2026-10-31'], '31-е: 10-й платёж (31 окт) — законный, число платежей = число повторов');
  }
  // перенос даты после проводки (новый формат) — второй операции в том же месяце нет
  const mv = auto({ dueDate: '2026-01-20', repeatType: 'monthly', lastPosted: '2026-10-03', lastPostedV: 2 });
  assertEqual(R.autoPostDates(mv, D(2026, 10, 25)), [], 'Перенос даты на 20-е после проводки 3-го — без второй операции в октябре');
  // возобновление после паузы со старым lastPosted
  const pr = auto({ dueDate: '2026-01-06', repeatType: 'weekly', lastPosted: '2026-10-12', isActive: false });
  assertEqual(R.resumePatch(pr, D(2026, 10, 16)), { isActive: true }, 'Возобновление: старое «12 окт» уже = последний повтор 13 окт — lastPosted не трогаем');
  const pr2 = auto({ dueDate: '2026-01-06', repeatType: 'weekly', lastPosted: '2026-09-01', isActive: false });
  const pp = R.resumePatch(pr2, D(2026, 10, 16));
  assertEqual(pp, { isActive: true, lastPosted: '2026-10-13', lastPostedV: 2 }, 'Возобновление: пропуски за паузу помечены, формат новый');
}

// ============ §6 — нет двойного учёта ============
{
  const state = {
    currency: '€', accounts: [{ id: 'acc1', name: 'Карта', currency: '€', start: 1000 }],
    tx: [{ id: 't1', type: 'expense', amount: 40, cat: 'food', account: 'acc1', date: '2026-10-01' }],
    reminders: [rem({ amount: 20, repeatType: 'monthly', dueDate: '2026-01-10', autoPost: false }),
                rem({ amount: 15, repeatType: 'monthly', dueDate: '2026-01-02', autoPost: true, lastPosted: '2026-10-02' })],
  };
  const before = JSON.stringify(state);
  R.summary(state.reminders); R.items(state.reminders, D(2026, 10, 16)); R.sort(R.items(state.reminders, D(2026, 10, 16)), 'date');
  R.autoPostDates(state.reminders[1], D(2026, 10, 16)); R.resumePatch(state.reminders[1], D(2026, 10, 16));
  assertEqual(JSON.stringify(state), before, 'Сервис ничего не пишет в state (операции, баланс, напоминания)');
  assertEqual(state.tx.length, 1, 'Добавление регулярного платежа само операций не создаёт');
}

// ============ §7 — пояс западнее UTC ============
if (!process.env.RECUR_CHILD) {
  const { execFileSync } = require('child_process');
  let out = '';
  try {
    out = execFileSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { TZ: 'America/Los_Angeles', RECUR_CHILD: '1' }), encoding: 'utf8' });
  } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  const m = out.match(/(\d+) passed, (\d+) failed/);
  assertTrue(!!m && m[2] === '0', 'Все проверки проходят и в America/Los_Angeles (локальные даты, не UTC)' + (m ? '' : '\n' + out));
  if (m) passed += +m[1];
}

console.log(`\nrecurring_service.test.js [${process.env.TZ}]: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
