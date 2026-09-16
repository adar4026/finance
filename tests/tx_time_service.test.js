// tests/tx_time_service.test.js — юнит-тесты для js/services/tx_time_service.js (TASK_044).
// Запуск: node tests/tx_time_service.test.js
global.window = global;
require('../js/services/tx_time_service.js');
const T = AF.Services.TxTime;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// ============ §1 — normalize ============
{
  assertEqual(T.normalize('19:30'), '19:30', 'normalize: HH:MM без изменений');
  assertEqual(T.normalize('9:05'), '09:05', 'normalize: H:MM → HH:MM');
  assertEqual(T.normalize('00:00'), '00:00', 'normalize: полночь');
  assertEqual(T.normalize('23:59'), '23:59', 'normalize: 23:59');
  assertEqual(T.normalize('23:59:10'), '23:59', 'normalize: секунды отбрасываются');
  assertEqual(T.normalize('08:15:00.000'), '08:15', 'normalize: доли секунды отбрасываются');
  assertEqual(T.normalize(' 7:07 '), '07:07', 'normalize: пробелы по краям');
  assertEqual(T.normalize('24:00'), '', 'normalize: 24:00 невалидно');
  assertEqual(T.normalize('12:60'), '', 'normalize: минуты 60 невалидны');
  assertEqual(T.normalize('1930'), '', 'normalize: без двоеточия — невалидно');
  assertEqual(T.normalize('19:3'), '', 'normalize: одна цифра минут — невалидно');
  assertEqual(T.normalize(''), '', 'normalize: пусто');
  assertEqual(T.normalize(null), '', 'normalize: null');
  assertEqual(T.normalize(undefined), '', 'normalize: undefined');
  assertEqual(T.normalize(1930), '', 'normalize: число — не строка');
  assertEqual(T.normalize('abc'), '', 'normalize: мусор');
}

// ============ §2 — minutes ============
{
  assertEqual(T.minutes('00:00'), 0, 'minutes: 00:00 → 0');
  assertEqual(T.minutes('19:30'), 1170, 'minutes: 19:30 → 1170');
  assertEqual(T.minutes('23:59'), 1439, 'minutes: 23:59 → 1439');
  assertEqual(T.minutes(''), -1, 'minutes: пусто → -1');
  assertEqual(T.minutes(undefined), -1, 'minutes: undefined → -1');
  assertEqual(T.minutes('99:99'), -1, 'minutes: невалидно → -1');
}

// ============ §3 — localDate / localTime ============
{
  const d = new Date(2026, 8, 3, 7, 5); // 3 сентября 2026, 07:05 локально
  assertEqual(T.localDate(d), '2026-09-03', 'localDate: YYYY-MM-DD с нулями');
  assertEqual(T.localTime(d), '07:05', 'localTime: HH:MM с нулями');
  const late = new Date(2026, 11, 31, 23, 59);
  assertEqual(T.localDate(late), '2026-12-31', 'localDate: 31 декабря 23:59 остаётся 31 декабря (не UTC-сдвиг)');
  assertEqual(T.localTime(late), '23:59', 'localTime: 23:59');
  assertEqual(T.localDate(new Date('x')), '', 'localDate: Invalid Date → пусто');
  assertEqual(T.localTime(new Date('x')), '', 'localTime: Invalid Date → пусто');
  assertTrue(/^\d{4}-\d{2}-\d{2}$/.test(T.localDate()), 'localDate(): без аргумента — сегодня в формате даты');
  assertTrue(/^\d{2}:\d{2}$/.test(T.localTime()), 'localTime(): без аргумента — сейчас в формате HH:MM');
  assertEqual(T.normalize(T.localTime()), T.localTime(), 'localTime() проходит normalize без изменений');
}

// ============ §4 — normalizeTx: «пусто = ключа нет» ============
{
  const t = { id: 1, type: 'expense', amount: 10, cat: 'food', date: '2026-07-27' };
  T.normalizeTx(t);
  assertEqual(Object.keys(t).sort(), ['amount', 'cat', 'date', 'id', 'type'], 'Старая операция без time: ключ не появляется, дата не тронута');
  assertEqual(t.date, '2026-07-27', 'normalizeTx не меняет date');

  const ok = { id: 2, time: '9:30', date: '2026-07-27' };
  T.normalizeTx(ok);
  assertEqual(ok.time, '09:30', 'normalizeTx: время приводится к HH:MM');

  const bad = { id: 3, time: '25:00' };
  T.normalizeTx(bad);
  assertTrue(!('time' in bad), 'normalizeTx: невалидное время → ключ удалён');

  const empty = { id: 4, time: '' };
  T.normalizeTx(empty);
  assertTrue(!('time' in empty), 'normalizeTx: пустое время → ключ удалён');

  const twice = { id: 5, time: '12:00', payee: 'X' };
  T.normalizeTx(twice); const once = JSON.stringify(twice); T.normalizeTx(twice);
  assertEqual(JSON.stringify(twice), once, 'normalizeTx идемпотентна');
  assertEqual(twice.payee, 'X', 'normalizeTx не трогает остальные поля');

  assertEqual(T.normalizeTx(null), null, 'normalizeTx(null) — без падения');
  assertEqual(T.normalizeTx('x'), 'x', 'normalizeTx(строка) — без падения');
}

// ============ §5 — idStamp ============
{
  assertEqual(T.idStamp(1690000000000), 1690000000000, 'idStamp: числовой id (до TASK_026) — сам id');
  assertEqual(T.idStamp('1690000000000'), 1690000000000, 'idStamp: числовая строка');
  const ms = 1789581524760;
  assertEqual(T.idStamp('t' + ms.toString(36) + '-1-a1b2c3'), ms, 'idStamp: id TASK_026 t<base36>-… → миллисекунды');
  assertEqual(T.idStamp('tx_abc'), 0, 'idStamp: неразбираемый id → 0');
  assertEqual(T.idStamp(null), 0, 'idStamp: null → 0');
  assertEqual(T.idStamp(undefined), 0, 'idStamp: undefined → 0');
  assertEqual(T.idStamp(NaN), 0, 'idStamp: NaN → 0');
}

// ============ §6 — compareInDay / sortDay ============
const mk = (id, time, extra) => Object.assign({ id, date: '2026-09-16' }, time ? { time } : {}, extra || {});
const tid = (ms, k) => 't' + ms.toString(36) + '-' + (k || 1) + '-abcdef';
{
  // 1) время по убыванию: 19:30 выше 16:45 выше 10:00
  const a = mk('a', '10:00'), b = mk('b', '19:30'), c = mk('c', '16:45');
  assertEqual(T.sortDay([a, b, c]).map(t => t.id), ['b', 'c', 'a'], 'sortDay: 19:30 > 16:45 > 10:00');
  assertEqual(T.sortDay([c, a, b]).map(t => t.id), ['b', 'c', 'a'], 'sortDay: результат не зависит от исходного порядка');
  assertTrue(T.compareInDay(b, a) < 0, 'compareInDay: позднее время — «меньше» (выше)');
  assertTrue(T.compareInDay(a, b) > 0, 'compareInDay: раннее время — «больше» (ниже)');
}
{
  // 2) запись со временем выше записи без времени
  const old = mk(1690000000000), fresh = mk(tid(1789581524760), '00:05');
  assertEqual(T.sortDay([fresh, old]).map(t => t.id), [fresh.id, old.id], 'sortDay: 00:05 выше записи без времени');
  assertEqual(T.sortDay([old, fresh]).map(t => t.id), [fresh.id, old.id], 'sortDay: новая запись со временем встаёт наверх дня');
}
{
  // 3) без времени — старые числовые id по убыванию (прежний порядок b.id-a.id сохранён)
  const o1 = mk(1690000000001), o2 = mk(1690000000002), o3 = mk(1690000000003);
  assertEqual(T.sortDay([o1, o2, o3]).map(t => t.id), [o3.id, o2.id, o1.id], 'sortDay: старые числовые id — новые сверху');
  assertEqual(T.sortDay([o3, o1, o2]).map(t => t.id), [o3.id, o2.id, o1.id], 'sortDay: числовые id — детерминированно');
}
{
  // 3b) без времени — id TASK_026 (строки): раньше b.id-a.id давал NaN и порядок вставки
  const s1 = mk(tid(1789581524000)), s2 = mk(tid(1789581524500)), s3 = mk(tid(1789581525000));
  assertEqual(T.sortDay([s1, s2, s3]).map(t => t.id), [s3.id, s2.id, s1.id], 'sortDay: строковые id t… — новые сверху (баг NaN устранён)');
}
{
  // 3c) смешанные: числовые (старые) ниже строковых (новые)
  const n = mk(1690000000000), s = mk(tid(1789581524760));
  assertEqual(T.sortDay([s, n]).map(t => t.id), [s.id, n.id], 'sortDay: t…-id (2026) выше числового id (2023)');
  assertEqual(T.sortDay([n, s]).map(t => t.id), [s.id, n.id], 'sortDay: то же при другом исходном порядке');
}
{
  // 4) неразбираемые id → позиция в массиве: позже добавленная выше, стабильно
  const x = mk('imp-a'), y = mk('imp-b'), z = mk('imp-c');
  const r1 = T.sortDay([x, y, z]).map(t => t.id);
  assertEqual(r1, ['imp-c', 'imp-b', 'imp-a'], 'sortDay: неразбираемые id — позже в массиве = выше');
  const r2 = T.sortDay(T.sortDay([x, y, z]).reverse()).map(t => t.id);
  assertEqual(r2, ['imp-c', 'imp-b', 'imp-a'], 'sortDay: повторная сортировка того же массива даёт тот же порядок');
}
{
  // одинаковое время — резерв по id, затем по позиции
  const p = mk(tid(1789581524000), '12:00'), q = mk(tid(1789581525000), '12:00');
  assertEqual(T.sortDay([p, q]).map(t => t.id), [q.id, p.id], 'sortDay: равное время → более новый id выше');
  const u = mk('u', '12:00'), v = mk('v', '12:00');
  assertEqual(T.sortDay([u, v]).map(t => t.id), ['v', 'u'], 'sortDay: равное время и неразбираемые id → позже добавленная выше');
}
{
  // sortDay не мутирует исходный массив и переживает мусор
  const arr = [mk('a', '10:00'), mk('b', '11:00')];
  const copy = arr.slice();
  T.sortDay(arr);
  assertEqual(arr.map(t => t.id), copy.map(t => t.id), 'sortDay: исходный массив не изменён');
  assertEqual(T.sortDay(null), [], 'sortDay(null) → []');
  assertEqual(T.sortDay([null, mk('a', '10:00')]).length, 2, 'sortDay: null-элемент не роняет сортировку');
  assertEqual(T.sortDay([mk('a', '25:00'), mk('b', '10:00')]).map(t => t.id), ['b', 'a'], 'sortDay: невалидное время = нет времени');
}

// ============ §7 — compare / sortAll: дни по убыванию, внутри дня — время ============
{
  const d1a = { id: 'x1', date: '2026-09-15', time: '23:00' };
  const d2a = { id: 'x2', date: '2026-09-16', time: '08:00' };
  const d2b = { id: 'x3', date: '2026-09-16', time: '19:30' };
  const d2old = { id: 1690000000000, date: '2026-09-16' };
  const r = T.sortAll([d1a, d2old, d2a, d2b]).map(t => t.id);
  assertEqual(r, ['x3', 'x2', 1690000000000, 'x1'], 'sortAll: новый день выше, внутри дня 19:30 > 08:00 > без времени');
  assertTrue(T.compare(d2a, d1a) < 0, 'compare: более новая дата — выше, даже с ранним временем');
  assertEqual(T.compare({ date: '2026-09-16' }, { date: '2026-09-16' }), 0, 'compare: одинаковые дни без времени и id → 0');
  assertEqual(T.sortAll(null), [], 'sortAll(null) → []');
  const long = { id: 'l', date: '2026-09-16T10:00:00', time: '09:00' };
  assertEqual(T.compare(long, { id: 'm', date: '2026-09-16', time: '10:00' }) > 0, true, 'compare: date с временем в строке сравнивается по первым 10 символам');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
