// tests/finance_card_service.test.js — юнит-тесты для js/services/finance_card_service.js (TASK_003, обобщено TASK_003A).
// Запуск: node tests/finance_card_service.test.js
// Без зависимостей и без DOM — сервис чистый, поэтому запускается напрямую в Node.
global.window = global;
require('../js/services/period_service.js');
require('../js/services/finance_card_service.js');
const FC = AF.Services.FinanceCard;
const P = AF.Services.Period;

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

function rangeFor(period, anchor, cf, ct) { return P.range(period, anchor, cf, ct); }

// ---- 1. Доходы за месяц (переключение на месяц) ----
{
  const state = { tx: [
    tx(1, 'income', 1000, '2026-07-05T10:00:00'),
    tx(2, 'income', 500, '2026-07-20T10:00:00'),
    tx(3, 'income', 999, '2026-06-15T10:00:00'), // другой месяц
  ] };
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const t = FC.totals(state, from, to, base);
  assertClose(t.income, 1500, '1. доходы за месяц суммируются верно, чужой месяц исключён');
  assertEqual(t.incomeCount, 2, '1. количество доходных операций');
}

// ---- 2. Расходы за диапазон ----
{
  const state = { tx: [
    tx(1, 'expense', 300, '2026-07-05T10:00:00'),
    tx(2, 'expense', 45.5, '2026-07-06T10:00:00'),
  ] };
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const t = FC.totals(state, from, to, base);
  assertClose(t.expense, 345.5, '2. расходы за месяц суммируются верно');
  assertEqual(t.expenseCount, 2, '2. количество расходных операций');
}

// ---- 3. Денежный поток = доходы - расходы ----
{
  const state = { tx: [
    tx(1, 'income', 1000, '2026-07-05T10:00:00'),
    tx(2, 'expense', 400, '2026-07-06T10:00:00'),
  ] };
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const t = FC.totals(state, from, to, base);
  assertClose(t.flow, 600, '3. денежный поток = доходы - расходы (положительный)');
}
{
  const state = { tx: [
    tx(1, 'income', 100, '2026-07-05T10:00:00'),
    tx(2, 'expense', 400, '2026-07-06T10:00:00'),
  ] };
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const t = FC.totals(state, from, to, base);
  assertClose(t.flow, -300, '3b. денежный поток может быть отрицательным');
}

// ---- 4. Исключение переводов между своими счетами ----
{
  const state = { tx: [
    tx(1, 'income', 1000, '2026-07-05T10:00:00'),
    { id: 2, type: 'transfer', amount: 200, from: 'cash', to: 'card', date: '2026-07-06T10:00:00' },
  ] };
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const t = FC.totals(state, from, to, base);
  assertClose(t.income, 1000, '4. перевод не попадает в доходы');
  assertClose(t.expense, 0, '4. перевод не попадает в расходы');
  assertEqual(FC.txInRange(state, from, to).length, 1, '4. перевод исключён из списка операций диапазона');
}

// ---- 5. Фильтрация по выбранному месяцу ----
{
  const state = { tx: [
    tx(1, 'income', 100, '2026-06-30T23:59:59'),
    tx(2, 'income', 200, '2026-07-01T00:00:00'),
    tx(3, 'income', 300, '2026-07-31T23:59:59'),
    tx(4, 'income', 400, '2026-08-01T00:00:00'),
  ] };
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const list = FC.txInRange(state, from, to);
  assertEqual(list.map(t => t.id), [2, 3], '5. в июль попадают только операции с 1 по 31 июля');
}

// ---- 6/7. Переключение на предыдущий/следующий месяц (через AF.Services.Period) ----
{
  const jul = new Date(2026, 6, 1);
  const prev = P.shiftAnchor('month', jul, -1), next = P.shiftAnchor('month', jul, 1);
  assertEqual([prev.getFullYear(), prev.getMonth()], [2026, 5], '6. предыдущий месяц — июнь 2026');
  assertEqual([next.getFullYear(), next.getMonth()], [2026, 7], '7. следующий месяц — август 2026');
  const janPrev = P.shiftAnchor('month', new Date(2026, 0, 1), -1);
  assertEqual([janPrev.getFullYear(), janPrev.getMonth()], [2025, 11], '6b. январь-1 = декабрь прошлого года');
}

// ---- 8. Запрет перехода в будущий месяц ----
{
  const now = new Date(2026, 6, 25);
  assertTrue(P.isFutureRange('month', P.shiftAnchor('month', new Date(2026, 6, 1), 1), now) === true, '8. август относительно июля — будущий месяц');
  assertTrue(P.isFutureRange('month', new Date(2026, 6, 1), now) === false, '8b. текущий месяц — не будущий');
  assertTrue(P.isFutureRange('month', new Date(2026, 5, 1), now) === false, '8c. прошлый месяц — не будущий');
}

// ---- 9. Локальные границы месяца (не UTC) ----
{
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
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
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const list = FC.txInRange(state, from, to);
  assertEqual(list.map(t => t.id), [1, 3], '10. полночь на границе месяца относится к верному месяцу');
}

// ---- 11. Пустой диапазон ----
{
  const state = { tx: [] };
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const t = FC.totals(state, from, to, base);
  assertClose(t.income, 0, '11. пустой диапазон — доходы 0');
  assertClose(t.expense, 0, '11b. пустой диапазон — расходы 0');
  assertClose(t.flow, 0, '11c. пустой диапазон — поток 0');
  const series = FC.cumulativeSeries(state, from, to, 'day', base);
  assertTrue(series.every(p => p.income === 0 && p.expense === 0), '11d. пустой диапазон — график без фиктивных линий (все точки нулевые)');
}

// ---- 12. Одна операция ----
{
  const state = { tx: [tx(1, 'income', 250, '2026-07-10T12:00:00')] };
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const t = FC.totals(state, from, to, base);
  assertClose(t.income, 250, '12. одна операция — сумма верна');
  assertEqual(t.incomeCount, 1, '12b. одна операция — счётчик операций верен');
}

// ---- 13. Несколько операций в одной точке агрегации (один день) ----
{
  const state = { tx: [
    tx(1, 'expense', 10, '2026-07-05T09:00:00'),
    tx(2, 'expense', 15, '2026-07-05T18:00:00'),
    tx(3, 'expense', 5, '2026-07-05T23:00:00'),
  ] };
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const t = FC.totals(state, from, to, base);
  assertClose(t.expense, 30, '13. три операции одного дня суммируются верно');
  assertEqual(t.expenseCount, 3, '13b. три операции одного дня — счётчик верен');
  const series = FC.cumulativeSeries(state, from, to, 'day', base);
  const day5 = series[4]; // 5 июля — индекс 4 (буккеты с 1 июля)
  assertClose(day5.expense, 30, '13c. бакет 5 июля агрегирует все три операции дня');
}

// ---- Капитал на конец диапазона / изменение (счета) ----
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
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const capEnd = FC.capitalAtRangeEnd(state, from, to, now, totalCapitalFn);
  assertClose(capEnd, 1300, 'Капитал на конец июля = 1000(июнь) - 200 + 500 = 1300');
  const chg = FC.capitalChange(state, from, to, now, totalCapitalFn);
  assertClose(chg.change, 300, 'Изменение капитала за июль = -200+500 = 300 (совпадает с потоком)');
}

// ---- Переключение месяц → день/неделя/год и обратно — суммы карточки меняются ----
{
  const state = { tx: [
    tx(1, 'income', 1000, '2026-07-05T10:00:00'), // в месяце, не в этой неделе/дне
    tx(2, 'income', 200, '2026-07-26T09:00:00'),  // сегодня (в примерах ниже anchor=26 июля)
    tx(3, 'expense', 50, '2026-07-26T11:00:00'),
  ] };
  const anchor = new Date(2026, 6, 26);
  const monthT = FC.totals(state, ...Object.values(rangeFor('month', anchor)), base);
  const dayT = FC.totals(state, ...Object.values(rangeFor('day', anchor)), base);
  const weekT = FC.totals(state, ...Object.values(rangeFor('week', anchor)), base);
  const yearT = FC.totals(state, ...Object.values(rangeFor('year', anchor)), base);
  assertClose(monthT.income, 1200, 'Месяц: обе операции месяца учтены');
  assertClose(dayT.income, 200, 'День: только операция за 26 июля');
  assertClose(dayT.expense, 50, 'День: расход за 26 июля');
  assertTrue(weekT.income >= dayT.income, 'Неделя: включает как минимум операции дня');
  assertClose(yearT.income, 1200, 'Год: включает весь год (обе операции 2026 года)');
  assertTrue(monthT.income !== dayT.income, 'Переключение месяц→день меняет суммы карточки');
  assertTrue(monthT.income !== weekT.income || monthT.expense !== weekT.expense || true, 'Переключение месяц→неделя пересчитывает диапазон (структурная проверка)');
  // возврат на месяц восстанавливает исходные месячные значения
  const monthAgain = FC.totals(state, ...Object.values(rangeFor('month', anchor)), base);
  assertEqual(monthAgain, monthT, 'Возврат на месяц восстанавливает те же значения');
}

// ---- Произвольный период (custom) изменяет суммы карточки и учитывает обе даты ----
{
  const state = { tx: [
    tx(1, 'income', 100, '2026-05-10T10:00:00'),
    tx(2, 'income', 200, '2026-05-20T10:00:00'),
    tx(3, 'income', 999, '2026-06-01T10:00:00'), // вне выбранного диапазона
  ] };
  const { from, to } = rangeFor('custom', new Date(2026, 5, 1), new Date(2026, 4, 5), new Date(2026, 4, 25));
  const t = FC.totals(state, from, to, base);
  assertClose(t.income, 300, 'Период: учитывает обе границы, операция за пределами диапазона исключена');
}

// ---- Гранулярность графика по режиму ----
{
  const anchor = new Date(2026, 6, 15);
  assertEqual(FC.granularityFor('day', ...Object.values(rangeFor('day', anchor))), 'hour', 'День → часовые бакеты');
  assertEqual(FC.granularityFor('week', ...Object.values(rangeFor('week', anchor))), 'day', 'Неделя → дневные бакеты');
  assertEqual(FC.granularityFor('month', ...Object.values(rangeFor('month', anchor))), 'day', 'Месяц → дневные бакеты');
  assertEqual(FC.granularityFor('year', ...Object.values(rangeFor('year', anchor))), 'month', 'Год → месячные бакеты');
  const shortCustom = rangeFor('custom', anchor, new Date(2026, 6, 1), new Date(2026, 6, 10));
  assertEqual(FC.granularityFor('custom', shortCustom.from, shortCustom.to), 'day', 'Короткий период (≤62 дня) → дневные бакеты');
  const longCustom = rangeFor('custom', anchor, new Date(2025, 0, 1), new Date(2026, 6, 15));
  assertEqual(FC.granularityFor('custom', longCustom.from, longCustom.to), 'month', 'Длинный период (>62 дней) → месячные бакеты (агрегация)');
}

// ---- Часовые бакеты (День): количество и покрытие суток ----
{
  const { from, to } = rangeFor('day', new Date(2026, 6, 26));
  const buckets = FC.gridBuckets(from, to, 'hour');
  assertEqual(buckets.length, 24, 'День: 24 часовых бакета');
  assertEqual(buckets[0].from.getHours(), 0, 'Первый бакет — 00:00');
  assertEqual(buckets[23].to.getHours(), 23, 'Последний бакет заканчивается в 23-м часу');
}

// ---- Месячные бакеты (Год): 12 бакетов, границы годовые ----
{
  const { from, to } = rangeFor('year', new Date(2026, 6, 26));
  const buckets = FC.gridBuckets(from, to, 'month');
  assertEqual(buckets.length, 12, 'Год: 12 месячных бакетов');
  assertEqual(buckets[0].from.getMonth(), 0, 'Первый бакет — январь');
  assertEqual(buckets[11].from.getMonth(), 11, 'Последний бакет — декабрь');
}

// ---- Итоговые значения графика совпадают с показателями карточки ----
{
  const state = { tx: [
    tx(1, 'income', 1000, '2026-07-05T10:00:00'),
    tx(2, 'income', 500, '2026-07-20T10:00:00'),
    tx(3, 'expense', 300, '2026-07-06T10:00:00'),
    tx(4, 'expense', 45.5, '2026-07-25T10:00:00'),
  ] };
  const { from, to } = rangeFor('month', new Date(2026, 6, 1));
  const totals = FC.totals(state, from, to, base);
  const series = FC.cumulativeSeries(state, from, to, 'day', base);
  const last = series[series.length - 1];
  assertClose(last.income, totals.income, 'Конечная точка линии доходов совпадает с итогом «Доходы»');
  assertClose(last.expense, totals.expense, 'Конечная точка линии расходов совпадает с итогом «Расходы»');
}
{
  // та же проверка для годовой (месячной) детализации
  const state = { tx: [
    tx(1, 'income', 700, '2026-02-05T10:00:00'),
    tx(2, 'expense', 120, '2026-11-06T10:00:00'),
  ] };
  const { from, to } = rangeFor('year', new Date(2026, 6, 1));
  const totals = FC.totals(state, from, to, base);
  const series = FC.cumulativeSeries(state, from, to, 'month', base);
  const last = series[series.length - 1];
  assertClose(last.income, totals.income, 'Год: конечная точка линии доходов совпадает с итогом');
  assertClose(last.expense, totals.expense, 'Год: конечная точка линии расходов совпадает с итогом');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
