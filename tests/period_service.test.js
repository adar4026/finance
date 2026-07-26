// tests/period_service.test.js — юнит-тесты для js/services/period_service.js (TASK_003A).
// Запуск: node tests/period_service.test.js
global.window = global;
require('../js/services/period_service.js');
const P = AF.Services.Period;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function ymdhms(d) { return [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]; }

// ---- День: локальные границы ----
{
  const { from, to } = P.range('day', new Date(2026, 6, 26, 15, 30));
  assertEqual(ymdhms(from), [2026, 6, 26, 0, 0, 0], 'День — начало 00:00 локально');
  assertEqual(ymdhms(to), [2026, 6, 26, 23, 59, 59], 'День — конец 23:59:59 локально');
}

// ---- Неделя: понедельник-воскресенье ----
{
  // 2026-07-26 — воскресенье; неделя должна быть 2026-07-20 (пн) .. 2026-07-26 (вс)
  const { from, to } = P.range('week', new Date(2026, 6, 26));
  assertEqual(ymdhms(from), [2026, 6, 20, 0, 0, 0], 'Неделя — начало в понедельник');
  assertEqual(ymdhms(to), [2026, 6, 26, 23, 59, 59], 'Неделя — конец в воскресенье 23:59:59');
}
{
  // 2026-07-20 — понедельник; та же неделя
  const { from, to } = P.range('week', new Date(2026, 6, 20));
  assertEqual(ymdhms(from), [2026, 6, 20, 0, 0, 0], 'Неделя — понедельник как якорь остаётся началом той же недели');
  assertEqual(ymdhms(to), [2026, 6, 26, 23, 59, 59], 'Неделя — воскресенье той же недели');
}

// ---- Месяц: локальные границы ----
{
  const { from, to } = P.range('month', new Date(2026, 6, 15));
  assertEqual(ymdhms(from), [2026, 6, 1, 0, 0, 0], 'Месяц — 1 число 00:00');
  assertEqual(ymdhms(to), [2026, 6, 31, 23, 59, 59], 'Месяц — последний день 23:59:59');
}

// ---- Год: с 1 января по 31 декабря ----
{
  const { from, to } = P.range('year', new Date(2026, 6, 15));
  assertEqual(ymdhms(from), [2026, 0, 1, 0, 0, 0], 'Год — 1 января 00:00');
  assertEqual(ymdhms(to), [2026, 11, 31, 23, 59, 59], 'Год — 31 декабря 23:59:59');
}

// ---- Период: учитывает обе выбранные даты ----
{
  const { from, to } = P.range('custom', new Date(2026, 6, 15), new Date(2026, 5, 10), new Date(2026, 6, 5));
  assertEqual(ymdhms(from), [2026, 5, 10, 0, 0, 0], 'Период — начало из customFrom, 00:00');
  assertEqual(ymdhms(to), [2026, 6, 5, 23, 59, 59], 'Период — конец из customTo, 23:59:59');
}

// ---- Стрелки: сдвиг на правильный интервал ----
{
  const d = new Date(2026, 6, 15);
  assertEqual([P.shiftAnchor('day', d, 1).getFullYear(), P.shiftAnchor('day', d, 1).getMonth(), P.shiftAnchor('day', d, 1).getDate()], [2026, 6, 16], 'День: +1 сдвигает на один день');
  assertEqual([P.shiftAnchor('week', d, 1).getDate()], [22], 'Неделя: +1 сдвигает на 7 дней');
  assertEqual([P.shiftAnchor('month', d, 1).getMonth()], [7], 'Месяц: +1 сдвигает на один месяц');
  assertEqual([P.shiftAnchor('year', d, 1).getFullYear()], [2027], 'Год: +1 сдвигает на один год');
  assertEqual([P.shiftAnchor('month', new Date(2026, 11, 1), 1).getFullYear(), P.shiftAnchor('month', new Date(2026, 11, 1), 1).getMonth()], [2027, 0], 'Месяц: декабрь+1 = январь следующего года');
}

// ---- Запрет будущего диапазона ----
{
  const now = new Date(2026, 6, 26, 12, 0, 0);
  assertTrue(P.isFutureRange('day', P.shiftAnchor('day', now, 1), now) === true, 'День: завтра — будущее относительно текущего момента');
  assertTrue(P.isFutureRange('day', now, now) === false, 'День: сегодня — не будущее');
  assertTrue(P.isFutureRange('week', P.shiftAnchor('week', now, 1), now) === true, 'Неделя: следующая неделя — будущее');
  assertTrue(P.isFutureRange('week', now, now) === false, 'Неделя: текущая неделя — не будущее');
  assertTrue(P.isFutureRange('month', P.shiftAnchor('month', now, 1), now) === true, 'Месяц: следующий месяц — будущее');
  assertTrue(P.isFutureRange('month', now, now) === false, 'Месяц: текущий месяц — не будущее');
  assertTrue(P.isFutureRange('year', P.shiftAnchor('year', now, 1), now) === true, 'Год: следующий год — будущее');
  assertTrue(P.isFutureRange('year', now, now) === false, 'Год: текущий год — не будущее');
  assertTrue(P.isFutureRange('custom', P.shiftAnchor('custom', now, 1), now) === false, 'Период: смещение стрелками не блокируется (существующий UX не меняется)');
}

// ---- Операции около полуночи не смещаются из-за UTC (границы диапазона, не сама фильтрация) ----
{
  const { from, to } = P.range('day', new Date(2026, 6, 26, 0, 0, 1));
  assertTrue(from.getDate() === 26 && to.getDate() === 26, 'День на границе полуночи — границы не съезжают на соседний день');
}

// ---- Подпись диапазона по режиму (раздел 8) ----
{
  assertTrue(P.label('year', new Date(2026, 6, 1)) === '2026', 'Год — подпись это просто число года');
  assertTrue(P.label('month', new Date(2026, 6, 1)).includes('2026'), 'Месяц — подпись содержит год');
  assertTrue(P.label('custom', new Date(2026, 6, 1), null, null).length > 0, 'Период без выбора — безопасная подпись, не пусто');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
