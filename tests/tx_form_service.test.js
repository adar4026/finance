// tests/tx_form_service.test.js — юнит-тесты для js/services/tx_form_service.js (TASK_013).
// Запуск: node tests/tx_form_service.test.js
global.window = global;
require('../js/services/tx_form_service.js');
const F = AF.Services.TxForm;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// ---- Тип по умолчанию — «Расход» (требование 1 постановки TASK_013) ----
{
  assertEqual(F.DEFAULT_TYPE, 'expense', 'Тип по умолчанию — expense (Расход)');
  assertTrue(F.isValidType(F.DEFAULT_TYPE), 'Тип по умолчанию входит в список допустимых типов');
}

// ---- Допустимые типы переключателя (Доход/Расход/Перевод) ----
{
  assertEqual(F.TYPES, ['expense', 'income', 'transfer'], 'Ровно три типа операции');
  assertTrue(F.isValidType('expense') && F.isValidType('income') && F.isValidType('transfer'), 'expense/income/transfer — валидные типы');
  assertTrue(!F.isValidType('receipt'), '«Чек» — не тип операции (шторка убрана, TASK_013)');
  assertTrue(!F.isValidType('') && !F.isValidType(undefined), 'Пустое/неопределённое значение — не валидный тип');
}

// ---- Видимость полей: Расход и Доход показывают одинаковый набор полей операции ----
{
  const exp = F.visibilityFor('expense');
  const inc = F.visibilityFor('income');
  assertEqual(exp, inc, 'Расход и Доход показывают один и тот же набор блоков формы');
  assertTrue(exp.catBlock && exp.subcatBlock && exp.accField && exp.scheduleBlock, 'Расход/Доход: категория, подкатегория, счёт, расписание видны');
  assertTrue(exp.receiptBlock, 'Расход/Доход: блок прикрепления чека виден (функция чека не удалена, TASK_013 п.10)');
  assertTrue(exp.amountDisplay && !exp.transDisplay && !exp.transRow, 'Расход/Доход: обычный дисплей суммы, не карточка перевода');
}

// ---- Видимость полей: Перевод показывает только связанные с переводом поля ----
{
  const tr = F.visibilityFor('transfer');
  assertTrue(tr.transRow && tr.transDisplay, 'Перевод: пара счетов и двусторонняя карточка видны');
  assertTrue(!tr.amountDisplay, 'Перевод: обычный дисплей суммы скрыт (используется trans-display)');
  assertTrue(!tr.catBlock && !tr.subcatBlock && !tr.receiptBlock && !tr.scheduleBlock && !tr.accField, 'Перевод: категория/подкатегория/чек/расписание/одиночный счёт скрыты');
}

// ---- Заголовок страницы: создание vs редактирование ----
{
  assertEqual(F.titleFor(false), 'Новая операция', 'Заголовок при создании');
  assertEqual(F.titleFor(true), 'Редактировать операцию', 'Заголовок при редактировании');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
