// tests/finance_card_service.test.js — юнит-тесты для js/services/finance_card_service.js (TASK_003).
// Запуск: node tests/finance_card_service.test.js
// Без зависимостей и без DOM — сервис чистый, поэтому запускается напрямую в Node.
global.window = global;
require('../js/services/finance_card_service.js');
const FC = AF.Services.FinanceCard;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertClose(actual, expected, msg, eps = 0.001) {
  if (Math.abs(actual - expected) <= eps) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${expected}\n  actual:   ${actual}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// txBase без конвертации валют (все суммы уже в базовой валюте) — упрощает тесты.
const base = t => t.amount;

function tx(id, type, amount, isoDate) {
  return { id, type, amount, date: isoDate, account: 'cash', cat: 'c1' };
}

// ---- 1. Доходы за месяц ----
{
  const state = { tx: [
    tx(1, 'income', 1000, '2026-07-05T10:00:00'),
    tx(2, 'income', 500, '2026-07-20T10:00:00'),
    tx(3, 'income', 999, '2026-06-15T10:00:00'), // другой месяц
  ] };
  const t = FC.totals(state, new Date(2026, 6, 1), base);
  assertClose(t.income, 1500, '1. доходы за месяц суммируются верно, чужой месяц исключён');
  assertEqual(t.incomeCount, 2, '1. количество доходных операций');
}

// ---- 2. Расходы за месяц ----
{
  const state = { tx: [
    tx(1, 'expense', 300, '2026-07-05T10:00:00'),
    tx(2, 'expense', 45.5, '2026-07-06T10:00:00'),
  ] };
  const t = FC.totals(state, new Date(2026, 6, 1), base);
  assertClose(t.expense, 345.5, '2. расходы за месяц суммируются верно');
  assertEqual(t.expenseCount, 2, '2. количество расходных операций');
}

// ---- 3. Денежный поток ----
{
  const state = { tx: [
    tx(1, 'income', 1000, '2026-07-05T10:00:00'),
    tx(2, 'expense', 400, '2026-07-06T10:00:00'),
  ] };
  const t = FC.totals(state, new Date(2026, 6, 1), base);
  assertClose(t.flow, 600, '3. денежный поток = доходы - расходы (положительный)');
}
{
  const state = { tx: [
    tx(1, 'income', 100, '2026-07-05T10:00:00'),
    tx(2, 'expense', 400, '2026-07-06T10:00:00'),
  ] };
  const t = FC.totals(state, new Date(2026, 6, 1), base);
  assertClose(t.flow, -300, '3b. денежный поток может быть отрицательным');
}

// ---- 4. Исключение переводов между своими счетами ----
{
  const state = { tx: [
    tx(1, 'income', 1000, '2026-07-05T10:00:00'),
    { id: 2, type: 'transfer', amount: 200, from: 'cash', to: 'card', date: '2026-07-06T10:00:00' },
  ] };
  const t = FC.totals(state, new Date(2026, 6, 1), base);
  assertClose(t.income, 1000, '4. перевод не попадает в доходы');
  assertClose(t.expense, 0, '4. перевод не попадает в расходы');
  assertEqual(FC.txForMonth(state, new Date(2026, 6, 1)).length, 1, '4. перевод исключён из списка операций месяца');
}

// ---- 5. Фильтрация по выбранному месяцу ----
{
  const state = { tx: [
    tx(1, 'income', 100, '2026-06-30T23:59:59'),
    tx(2, 'income', 200, '2026-07-01T00:00:00'),
    tx(3, 'income', 300, '2026-07-31T23:59:59'),
    tx(4, 'income', 400, '2026-08-01T00:00:00'),
  ] };
  const list = FC.txForMonth(state, new Date(2026, 6, 1));
  assertEqual(list.map(t => t.id), [2, 3], '5. в июль попадают только операции с 1 по 31 июля');
}

// ---- 6/7. Переключение на предыдущий/следующий месяц ----
{
  const jul = new Date(2026, 6, 1);
  assertEqual([FC.addMonths(jul, -1).getFullYear(), FC.addMonths(jul, -1).getMonth()], [2026, 5], '6. предыдущий месяц — июнь 2026');
  assertEqual([FC.addMonths(jul, 1).getFullYear(), FC.addMonths(jul, 1).getMonth()], [2026, 7], '7. следующий месяц — август 2026');
  // переход через границу года
  assertEqual([FC.addMonths(new Date(2026, 0, 1), -1).getFullYear(), FC.addMonths(new Date(2026, 0, 1), -1).getMonth()], [2025, 11], '6b. январь-1 = декабрь прошлого года');
}

// ---- 8. Запрет перехода в будущий месяц ----
{
  const now = new Date(2026, 6, 25);
  assertTrue(FC.isFutureMonth(new Date(2026, 7, 1), now) === true, '8. август относительно июля — будущий месяц');
  assertTrue(FC.isFutureMonth(new Date(2026, 6, 1), now) === false, '8b. текущий месяц — не будущий');
  assertTrue(FC.isFutureMonth(new Date(2026, 5, 1), now) === false, '8c. прошлый месяц — не будущий');
}

// ---- 9. Локальные границы месяца (не UTC) ----
{
  const { from, to } = FC.monthBounds(new Date(2026, 6, 1));
  assertEqual([from.getFullYear(), from.getMonth(), from.getDate(), from.getHours()], [2026, 6, 1, 0], '9. начало месяца — 1 июля 00:00 локально');
  assertEqual([to.getFullYear(), to.getMonth(), to.getDate(), to.getHours(), to.getMinutes(), to.getSeconds()], [2026, 6, 31, 23, 59, 59], '9b. конец месяца — 31 июля 23:59:59 локально');
}

// ---- 10. Операции около полуночи ----
{
  const state = { tx: [
    tx(1, 'expense', 10, '2026-07-01T00:00:00'),
    tx(2, 'expense', 20, '2026-06-30T23:59:59'),
    tx(3, 'expense', 30, '2026-07-31T23:59:59'),
    tx(4, 'expense', 40, '2026-08-01T00:00:00'),
  ] };
  const list = FC.txForMonth(state, new Date(2026, 6, 1));
  assertEqual(list.map(t => t.id), [1, 3], '10. полночь на границе месяца относится к верному месяцу');
}

// ---- 11. Пустой месяц ----
{
  const state = { tx: [] };
  const t = FC.totals(state, new Date(2026, 6, 1), base);
  assertClose(t.income, 0, '11. пустой месяц — доходы 0');
  assertClose(t.expense, 0, '11b. пустой месяц — расходы 0');
  assertClose(t.flow, 0, '11c. пустой месяц — поток 0');
}

// ---- 12. Одна операция ----
{
  const state = { tx: [tx(1, 'income', 250, '2026-07-10T12:00:00')] };
  const t = FC.totals(state, new Date(2026, 6, 1), base);
  assertClose(t.income, 250, '12. одна операция — сумма верна');
  assertEqual(t.incomeCount, 1, '12b. одна операция — счётчик операций верен');
}

// ---- 13. Несколько операций в один день ----
{
  const state = { tx: [
    tx(1, 'expense', 10, '2026-07-05T09:00:00'),
    tx(2, 'expense', 15, '2026-07-05T18:00:00'),
    tx(3, 'expense', 5, '2026-07-05T23:00:00'),
  ] };
  const t = FC.totals(state, new Date(2026, 6, 1), base);
  assertClose(t.expense, 30, '13. три операции одного дня суммируются верно');
  assertEqual(t.expenseCount, 3, '13b. три операции одного дня — счётчик верен');
}

// ---- Капитал на конец месяца / изменение за месяц (счета) ----
{
  const state = {
    tx: [
      tx(1, 'income', 1000, '2026-06-15T10:00:00'),
      tx(2, 'expense', 200, '2026-07-05T10:00:00'),
      tx(3, 'income', 500, '2026-07-20T10:00:00'),
    ],
    accounts: [{ id: 'cash', start: 0, currency: '€', isArchived: false }],
    currency: '€',
  };
  const totalCapitalFn = (s, endDate) => s.tx
    .filter(t => !endDate || new Date(t.date) <= endDate)
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
  const now = new Date(2026, 7, 15); // после июля — месяц уже завершён
  const capEnd = FC.capitalAtMonthEnd(state, new Date(2026, 6, 1), now, totalCapitalFn);
  assertClose(capEnd, 1300, 'Капитал на конец июля = 1000(июнь) - 200 + 500 = 1300');
  const chg = FC.capitalChange(state, new Date(2026, 6, 1), now, totalCapitalFn);
  assertClose(chg.change, 300, 'Изменение капитала за июль = -200+500 = 300 (совпадает с потоком)');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
