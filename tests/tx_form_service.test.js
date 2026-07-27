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

// ---- TASK_015: видимость метаданных (payee скрыт у перевода, ОВ-2) ----
{
  const exp = F.visibilityFor('expense');
  const inc = F.visibilityFor('income');
  const tr = F.visibilityFor('transfer');
  assertTrue(exp.payeeRow && exp.tagsRow && exp.locationRow, 'Расход: получатель, метки и место видны');
  assertTrue(inc.payeeRow && inc.tagsRow && inc.locationRow, 'Доход: получатель, метки и место видны');
  assertTrue(!tr.payeeRow, 'Перевод: «Получатель» скрыт — его роль выполняет «На счёт» (ОВ-2)');
  assertTrue(tr.tagsRow && tr.locationRow, 'Перевод: метки и место остаются доступны (ОВ-2)');
  assertEqual(exp, inc, 'Расход и Доход по-прежнему дают одинаковый набор блоков (с учётом метаданных)');
}

// ---- Заголовок страницы: создание vs редактирование ----
{
  assertEqual(F.titleFor(false), 'Новая операция', 'Заголовок при создании');
  assertEqual(F.titleFor(true), 'Редактировать операцию', 'Заголовок при редактировании');
}

// ---- TASK_014: подпись основной кнопки по типу операции (п. 7.8) ----
{
  assertEqual(F.saveLabelFor('expense'), 'Сохранить расход', 'Кнопка при расходе');
  assertEqual(F.saveLabelFor('income'), 'Сохранить доход', 'Кнопка при доходе');
  assertEqual(F.saveLabelFor('transfer'), 'Сохранить перевод', 'Кнопка при переводе');
  assertEqual(F.saveLabelFor(undefined), 'Сохранить расход', 'Неизвестный тип → подпись расхода (тип по умолчанию)');
}

// ---- TASK_014: человекочитаемая дата в строке «Дата» (п. 7.6) ----
{
  assertEqual(F.dateLabel('2026-07-27', '2026-07-27'), 'Сегодня', 'Текущая дата → «Сегодня»');
  assertEqual(F.dateLabel('2026-07-26', '2026-07-27'), 'Вчера', 'Предыдущий день → «Вчера»');
  assertEqual(F.dateLabel('2026-07-28', '2026-07-27'), 'Завтра', 'Следующий день → «Завтра»');
  assertEqual(F.dateLabel('2026-07-20', '2026-07-27'), '20 июля', 'Дата этого года — без года');
  assertEqual(F.dateLabel('2025-12-31', '2026-07-27'), '31 декабря 2025', 'Дата прошлого года — с годом');
  assertEqual(F.dateLabel('2026-07-27T10:30:00', '2026-07-27'), 'Сегодня', 'ISO с временем усекается до дня');
  assertEqual(F.dateLabel('', '2026-07-27'), '', 'Пустая дата → пустая строка');
  // граница месяца и года — «Вчера»/«Завтра» не должны ломаться на переходе
  assertEqual(F.dateLabel('2026-06-30', '2026-07-01'), 'Вчера', 'Вчера через границу месяца');
  assertEqual(F.dateLabel('2025-12-31', '2026-01-01'), 'Вчера', 'Вчера через границу года');
  assertEqual(F.dateLabel('2026-03-01', '2026-02-28'), 'Завтра', 'Завтра через границу месяца');
  // без опорной даты (todayIso не передан) — только локализованная дата
  assertEqual(F.dateLabel('2026-07-27', ''), '27 июля 2026', 'Без опорной даты — полная локализованная дата');
}

// ---- TASK_014: сдвиг даты не зависит от локального времени/DST ----
{
  assertEqual(F.shiftIsoDay('2026-07-27', -1), '2026-07-26', 'Сдвиг на день назад');
  assertEqual(F.shiftIsoDay('2026-07-27', 1), '2026-07-28', 'Сдвиг на день вперёд');
  assertEqual(F.shiftIsoDay('2026-03-29', -1), '2026-03-28', 'Переход на летнее время не сдвигает сутки');
  assertEqual(F.shiftIsoDay('не-дата', 1), '', 'Неразбираемое значение → пустая строка');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
