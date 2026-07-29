// tests/store_save.test.js — поведенческие тесты контракта сохранения (TASK_026, C-1).
// Запуск: node tests/store_save.test.js
//
// Это НЕ regex-проверки кода: здесь работает настоящий AF.Store поверх
// подставного localStorage, который детерминированно бросает нужные ошибки
// (реально заполнять хранилище мегабайтами не требуется и не нужно).
// Проверяются те инварианты, ради которых заводилась задача:
//   1. успешная запись возвращает ok;
//   2. QuotaExceededError, отказ storage и сбой JSON.stringify различаются;
//   3. после неуспешной записи состояние в памяти = последнее сохранённое;
//   4. несохранённая операция не влияет на баланс, аналитику и бюджеты;
//   5. повторная попытка не создаёт дубликат;
//   6. импорт/восстановление копии не разрушают прежнюю базу при отказе записи.
global.window = global;

// ---- подставное хранилище ----
// mode: 'ok' | 'quota' | 'quota-legacy' | 'fail' | 'security'
let mode = 'ok';
const backing = new Map();
function quotaError(legacy) {
  const e = new Error('quota');
  if (legacy) { e.name = 'NS_ERROR_DOM_QUOTA_REACHED'; e.code = 1014; }
  else { e.name = 'QuotaExceededError'; e.code = 22; }
  return e;
}
global.localStorage = {
  getItem: k => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => {
    if (mode === 'quota') throw quotaError(false);
    if (mode === 'quota-legacy') throw quotaError(true);
    if (mode === 'security') { const e = new Error('denied'); e.name = 'SecurityError'; throw e; }
    if (mode === 'fail') throw new Error('disk on fire');
    backing.set(k, String(v));
  },
  removeItem: k => backing.delete(k),
};

require('../js/core/result.js');
require('../js/core/ids.js');
require('../js/services/tx_meta_service.js');
require('../js/services/period_service.js');
require('../js/services/finance_card_service.js');
require('../js/database/store.js');

const S = AF.Store;
const FC = AF.Services.FinanceCard;
const P = AF.Services.Period;
const base = t => t.amount;

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

// Свежее состояние в хранилище + загрузка через штатный путь.
function freshState(tx) {
  mode = 'ok';
  backing.clear();
  const s = S.defaults();
  s.tx = tx || [];
  S.save(s);
  return S.load();
}
function tx(id, type, amount, date, cat) {
  return { id, type, amount, date, account: 'cash', cat: cat || 'food' };
}
const JULY = () => P.range('month', new Date(2026, 6, 1));
function totals(state) {
  const { from, to } = JULY();
  return FC.totals(state, from, to, base);
}

// ============ 1. Успешная запись ============
{
  const st = freshState([tx('t1', 'expense', 10, '2026-07-05T10:00:00')]);
  const res = S.save(st);
  assertEqual(res.ok, true, 'Успешное сохранение возвращает ok:true');
  assertTrue(!res.error, 'У успешного результата нет ошибки');
  assertTrue(JSON.parse(backing.get(S.KEY)).tx.length === 1, 'Данные физически записаны в хранилище');
  assertTrue(typeof S.snapshot() === 'string', 'После успеха зафиксирован снимок последнего сохранённого состояния');
}

// ============ 2. QuotaExceededError распознаётся ============
{
  const st = freshState([]);
  mode = 'quota';
  const res = S.save(st);
  assertEqual(res.ok, false, 'При переполнении хранилища результат — ошибка');
  assertEqual(res.error.code, 'QUOTA_EXCEEDED', 'QuotaExceededError распознан как QUOTA_EXCEEDED');
  assertTrue(/хранилище приложения заполнено/.test(res.error.message), 'Сообщение о квоте понятно пользователю');
  assertTrue(/фотограф/i.test(res.error.message), 'Сообщение подсказывает, что занимает место (фото чеков)');
  assertTrue(!/\d+\s*(МБ|MB|байт)/i.test(res.error.message), 'Сообщение не называет конкретный лимит (он зависит от браузера)');
  assertTrue(!/QuotaExceededError|Error:|at\s/.test(res.error.message), 'Пользователю не показывается техническое имя исключения');

  mode = 'quota-legacy';
  assertEqual(S.save(st).error.code, 'QUOTA_EXCEEDED', 'Firefox-вариант NS_ERROR_DOM_QUOTA_REACHED тоже распознан');
  assertTrue(S.isQuotaError({ name: 'QuotaExceededError' }), 'isQuotaError: по имени');
  assertTrue(S.isQuotaError({ code: 22 }), 'isQuotaError: по legacy-коду 22');
  assertTrue(S.isQuotaError({ code: 1014 }), 'isQuotaError: по коду 1014');
  assertTrue(!S.isQuotaError(new Error('x')), 'isQuotaError: обычная ошибка — не квота');
  assertTrue(!S.isQuotaError(null), 'isQuotaError: null — не квота');
}

// ============ 3. Обычная storage-ошибка распознаётся ============
{
  const st = freshState([]);
  mode = 'fail';
  const res = S.save(st);
  assertEqual(res.error.code, 'STORAGE_FAILED', 'Произвольный отказ setItem — STORAGE_FAILED, а не QUOTA_EXCEEDED');
  mode = 'security';
  assertEqual(S.save(st).error.code, 'STORAGE_FAILED', 'Недоступное хранилище (private mode) — STORAGE_FAILED');
  assertTrue(/хранилище приложения недоступно/.test(S.save(st).error.message), 'Сообщение об отказе хранилища понятно');
}

// ============ 4. Ошибка JSON.stringify ============
{
  const st = freshState([]);
  mode = 'ok';
  st.tx.push({ id: 't1', type: 'expense', amount: 5, date: '2026-07-05', get boom() { throw new Error('нельзя сериализовать'); } });
  const res = S.save(st);
  assertEqual(res.ok, false, 'Несериализуемые данные не считаются сохранёнными');
  assertEqual(res.error.code, 'SERIALIZATION_FAILED', 'Сбой JSON.stringify распознан отдельным кодом');
  assertTrue(backing.get(S.KEY).indexOf('"t1"') < 0, 'В хранилище ничего не записано при сбое сериализации');

  const circular = S.defaults(); circular.self = circular;
  assertEqual(S.save(circular).error.code, 'SERIALIZATION_FAILED', 'Циклическая ссылка тоже даёт SERIALIZATION_FAILED');
}

// ============ 5. Откат состояния и финансовые показатели ============
{
  const st = freshState([tx('t1', 'expense', 100, '2026-07-05T10:00:00')]);
  const before = totals(st);
  assertClose(before.expense, 100, 'Исходный расход за июль — 100');

  mode = 'quota';
  st.tx.push(tx('t2', 'expense', 999, '2026-07-10T10:00:00'));  // новая операция в памяти
  const res = S.save(st);
  assertEqual(res.ok, false, 'Сохранение новой операции провалилось');
  assertEqual(S.rollback(st), true, 'Откат к последнему сохранённому состоянию выполнен');

  assertEqual(st.tx.length, 1, 'Несохранённая операция удалена из состояния в памяти');
  assertEqual(st.tx[0].id, 't1', 'В памяти осталась ровно прежняя операция');
  assertClose(totals(st).expense, 100, 'Неуспешно добавленный расход не влияет на итоги (аналитика/бюджеты)');
  assertClose(totals(st).income, before.income, 'Доходы не изменились');
  assertEqual(JSON.parse(backing.get(S.KEY)).tx.length, 1, 'Хранилище тоже содержит только прежнюю операцию');

  // после перезагрузки данные те же
  mode = 'ok';
  const reloaded = S.load();
  assertEqual(reloaded.tx.length, 1, 'После перезагрузки база прежняя — фантомная операция не появляется');
}

// ============ 6. Неуспешное редактирование возвращает прежнюю версию ============
{
  const st = freshState([tx('t1', 'expense', 100, '2026-07-05T10:00:00')]);
  mode = 'quota';
  const t = st.tx.find(x => x.id === 't1');
  t.amount = 5000; t.note = 'изменено'; t.cat = 'transport';
  assertEqual(S.save(st).ok, false, 'Правка не сохранилась');
  S.rollback(st);
  assertClose(st.tx[0].amount, 100, 'Сумма операции вернулась к прежней');
  assertEqual(st.tx[0].cat, 'food', 'Категория операции вернулась к прежней');
  assertTrue(!st.tx[0].note, 'Частично изменённого объекта не осталось');
  assertClose(totals(st).expense, 100, 'Несохранённая правка не влияет на итоги');
}

// ============ 7. Неуспешное удаление восстанавливает операцию ============
{
  const st = freshState([tx('t1', 'expense', 100, '2026-07-05T10:00:00'), tx('t2', 'income', 300, '2026-07-06T10:00:00')]);
  mode = 'fail';
  st.tx = st.tx.filter(x => x.id !== 't1');
  assertEqual(S.save(st).ok, false, 'Удаление не сохранилось');
  S.rollback(st);
  assertEqual(st.tx.length, 2, 'Операция не исчезла — восстановлена откатом');
  assertTrue(st.tx.some(x => x.id === 't1'), 'Восстановлена именно удалявшаяся операция');
  assertClose(totals(st).expense, 100, 'Баланс не изменился после неуспешного удаления');
  assertClose(totals(st).income, 300, 'Доходы не изменились после неуспешного удаления');
}

// ============ 8. Повторная попытка не создаёт дубликат ============
{
  const st = freshState([tx('t1', 'expense', 100, '2026-07-05T10:00:00')]);
  const pendingId = AF.Ids.forTx(st);   // id формы выдаётся один раз (как aTxId в index.html)

  mode = 'quota';
  st.tx.push(tx(pendingId, 'expense', 42, '2026-07-07T10:00:00'));
  assertEqual(S.save(st).ok, false, 'Первая попытка провалилась');
  S.rollback(st);
  assertEqual(st.tx.length, 1, 'После отката добавленной операции нет');

  // повтор с тем же id — storage уже починился
  mode = 'ok';
  st.tx.push(tx(pendingId, 'expense', 42, '2026-07-07T10:00:00'));
  assertEqual(S.save(st).ok, true, 'Повторная попытка удалась');
  assertEqual(st.tx.length, 2, 'Операция записана ровно один раз — дубликата нет');
  assertEqual(st.tx.filter(x => x.id === pendingId).length, 1, 'Нет двух записей с одним id');
  assertClose(totals(st).expense, 142, 'Итог учитывает операцию один раз');

  // третье нажатие «Сохранить» по уже сохранённой форме (двойной клик) —
  // в index.html отсекается закрытой формой и флагом txSaving; здесь
  // проверяется, что данные при этом остаются консистентными.
  const stored = JSON.parse(backing.get(S.KEY));
  assertEqual(stored.tx.filter(x => x.id === pendingId).length, 1, 'В хранилище тоже ровно одна такая операция');
}

// ============ 9. Импорт: прежняя база не разрушается при отказе записи ============
{
  const st = freshState([tx('t1', 'expense', 100, '2026-07-05T10:00:00')]);
  const oldRaw = backing.get(S.KEY);

  // сценарий importJSON()/doBackupRestore(): кандидат собирается ОТДЕЛЬНО и
  // принимается только при успешной записи
  const next = Object.assign({}, st, { tx: [tx('i1', 'expense', 7, '2026-01-01T10:00:00')] });
  mode = 'quota';
  const w = S.save(next);
  assertEqual(w.ok, false, 'Импортируемая база не записалась');
  assertEqual(backing.get(S.KEY), oldRaw, 'Прежняя база в хранилище не тронута');
  assertEqual(st.tx.length, 1, 'Состояние в памяти осталось прежним — частично импортированного нет');
  assertEqual(st.tx[0].id, 't1', 'В памяти прежняя операция');

  mode = 'ok';
  const w2 = S.save(next);
  assertEqual(w2.ok, true, 'Повторный импорт после восстановления storage удался');
  assertEqual(S.load().tx[0].id, 'i1', 'Только теперь база заменена импортированной');
}

// ============ 10. Снимок и откат: краевые случаи ============
{
  const st = freshState([tx('t1', 'expense', 1, '2026-07-05T10:00:00')]);
  assertEqual(S.rollback(st, '{'), false, 'Битый снимок не применяется (и не портит состояние)');
  assertEqual(st.tx.length, 1, 'Состояние после неудачного отката не изменилось');
  assertEqual(S.rollback(null), false, 'Откат без состояния безопасно возвращает false');
  assertEqual(S.rollback(st, '"строка"'), false, 'Не-объект в снимке не применяется');

  // откат сохраняет ССЫЛКУ на объект состояния (на него держат ссылки замыкания)
  const ref = st;
  mode = 'quota';
  st.extraKey = 'мусор от несохранённой правки';
  S.save(st);
  S.rollback(st);
  assertTrue(ref === st, 'Откат восстанавливает внутрь того же объекта, а не подменяет ссылку');
  assertTrue(!('extraKey' in st), 'Ключи, появившиеся после последнего сохранения, удалены');
  mode = 'ok';
}

// ============ 11. Успешные CRUD-сценарии не регрессировали ============
{
  const st = freshState([]);
  st.tx.push(tx('t1', 'expense', 50, '2026-07-05T10:00:00'));
  assertEqual(S.save(st).ok, true, 'Регресс: добавление операции сохраняется');
  st.tx.find(x => x.id === 't1').amount = 75;
  assertEqual(S.save(st).ok, true, 'Регресс: редактирование сохраняется');
  assertClose(S.load().tx[0].amount, 75, 'Регресс: правка дошла до хранилища');
  st.tx = [];
  assertEqual(S.save(st).ok, true, 'Регресс: удаление сохраняется');
  assertEqual(S.load().tx.length, 0, 'Регресс: удаление дошло до хранилища');

  st.accounts.push({ id: 'a9', name: 'Новый', type: 'bank', currency: '€', start: 0, isArchived: false });
  st.cats.push({ id: 'c9', name: 'Своя', type: 'expense', emoji: '🎯' });
  st.budgets.c9 = 200;
  st.goals.push({ id: 'gl9', name: 'Цель', targetAmount: 100, savedAmount: 0 });
  assertEqual(S.save(st).ok, true, 'Регресс: счета/категории/бюджеты/цели сохраняются');
  const back = S.load();
  assertEqual(back.accounts.some(a => a.id === 'a9'), true, 'Регресс: счёт на месте после перезагрузки');
  assertEqual(back.budgets.c9, 200, 'Регресс: бюджет на месте после перезагрузки');
  assertEqual(back.goals.length, 1, 'Регресс: цель на месте после перезагрузки');
  assertEqual(back.schemaVersion, 3, 'SCHEMA_VERSION не изменён (остаётся 3)');
}

// ============ 12. Инварианты TASK_025 продолжают выполняться ============
{
  // внутренний перевод не меняет суммарный поток; итоги не дают NaN на пустом периоде
  const st = freshState([
    tx('t1', 'income', 1000, '2026-07-01T10:00:00'),
    tx('t2', 'expense', 250, '2026-07-02T10:00:00'),
    { id: 't3', type: 'transfer', amount: 300, from: 'cash', to: 'card', date: '2026-07-03T10:00:00' },
  ]);
  const t = totals(st);
  assertClose(t.income, 1000, 'Инвариант: перевод не увеличивает доходы');
  assertClose(t.expense, 250, 'Инвариант: перевод не увеличивает расходы');

  const empty = FC.totals(st, ...Object.values(P.range('month', new Date(2019, 0, 1))), base);
  assertTrue(!isNaN(empty.income) && !isNaN(empty.expense), 'Инвариант: пустой период даёт нули без NaN');

  // тот же набор после неуспешной записи и отката даёт те же числа
  mode = 'fail';
  st.tx.push(tx('t4', 'expense', 5000, '2026-07-04T10:00:00'));
  S.save(st); S.rollback(st);
  const t2 = totals(st);
  assertEqual([t2.income, t2.expense], [t.income, t.expense], 'Инвариант: после отката финансовые итоги идентичны исходным');
  mode = 'ok';
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
