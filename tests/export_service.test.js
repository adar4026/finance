// tests/export_service.test.js — regression-тесты CSV-экспорта (TASK_015, ОВ-3).
// Запуск: node tests/export_service.test.js
//
// Задача теста — зафиксировать ТОЧНЫЙ порядок и содержимое полей CSV.
// Поводом стала найденная в TASK_015 ошибка: подкатегория записывалась в
// колонку «Контрагент» (позиция 5), потому что число значений совпадало с
// числом заголовков и рассинхронизация ничем не проверялась.
global.window = global;
require('../js/services/export_service.js');
const E = AF.Services.Export;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// Минимальный парсер CSV (тот же формат, что читает importCSV в index.html):
// разделитель — запятая, кавычки удваиваются внутри закавыченного поля.
function parseCsv(text) {
  const rows = []; let row = [], fld = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { fld += '"'; i++; } else q = false; } else fld += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(fld); fld = ''; }
    else if (ch === '\n') { row.push(fld); rows.push(row); row = []; fld = ''; }
    else if (ch !== '\r') fld += ch;
  }
  if (fld.length || row.length) { row.push(fld); rows.push(row); }
  return rows;
}

const HEAD = ['Дата', 'Счёт', 'Сумма', 'Валюта', 'Категория', 'Контрагент',
  'Перевод: Счёт', 'Перевод: Сумма', 'Перевод: Валюта', 'Метки', 'Место', 'Примечание'];
const I = { DATE: 0, ACC: 1, AMT: 2, CUR: 3, CAT: 4, PAYEE: 5, TACC: 6, TAMT: 7, TCUR: 8, TAGS: 9, PLACE: 10, NOTE: 11 };

const state = {
  currency: '€',
  accounts: [
    { id: 'cash', name: 'Наличные', currency: '€' },
    { id: 'card', name: 'Карта', currency: '€' },
  ],
  cats: [
    { id: 'food', name: 'Продукты', type: 'expense' },
    { id: 'sal', name: 'Зарплата', type: 'income' },
  ],
  subcats: [{ id: 's1', categoryId: 'food', name: 'Супермаркеты' }],
};

// ---- 1. Заголовок: ровно 12 колонок в утверждённом порядке ----
{
  const rows = parseCsv(E.csv([], state));
  assertEqual(rows[0], HEAD, 'Заголовок — ровно 12 колонок в утверждённом порядке');
  assertEqual(rows[0].length, 12, 'Заголовок содержит 12 колонок');
}

// ---- 2. Строка расхода: поэлементное сравнение с эталоном ----
{
  const tx = [{ id: 1, type: 'expense', amount: 54.2, cat: 'food', subcategoryId: 's1', account: 'cash',
    date: '2026-07-27', note: 'обед', payee: 'Mercadona', tags: ['еда', 'семья'], location: 'Oviedo' }];
  const r = parseCsv(E.csv(tx, state))[1];
  assertEqual(r.length, 12, 'Строка расхода — ровно 12 полей');
  assertEqual(r, ['2026-07-27', 'Наличные', '-54.2', '€', 'Продукты / Супермаркеты', 'Mercadona',
    '', '', '', 'еда, семья', 'Oviedo', 'обед'], 'Строка расхода поэлементно совпадает с эталоном');
}

// ---- 3. Строка дохода ----
{
  const tx = [{ id: 2, type: 'income', amount: 2000, cat: 'sal', account: 'card',
    date: '2026-07-05', note: '', payee: 'Inmo Digital', tags: [], location: '' }];
  const r = parseCsv(E.csv(tx, state))[1];
  assertEqual(r.length, 12, 'Строка дохода — ровно 12 полей');
  assertEqual(r, ['2026-07-05', 'Карта', '2000', '€', 'Зарплата', 'Inmo Digital',
    '', '', '', '', '', ''], 'Строка дохода поэлементно совпадает с эталоном');
  assertEqual(r[I.AMT], '2000', 'Доход экспортируется положительной суммой');
}

// ---- 4. Строка перевода ----
{
  const tx = [{ id: 3, type: 'transfer', from: 'cash', to: 'card', amount: 100, toAmount: 100,
    date: '2026-07-10', note: 'на карту', tags: ['накопления'], location: 'дом' }];
  const r = parseCsv(E.csv(tx, state))[1];
  assertEqual(r.length, 12, 'Строка перевода — ровно 12 полей');
  assertEqual(r, ['2026-07-10', 'Наличные', '-100', '€', '', '',
    'Карта', '100', '€', 'накопления', 'дом', 'на карту'], 'Строка перевода поэлементно совпадает с эталоном');
  assertEqual(r[I.CAT], '', 'У перевода колонка «Категория» пуста');
  assertTrue(r[I.TACC] !== '' && r[I.TAMT] !== '' && r[I.TCUR] !== '', 'У перевода заполнены колонки 6/7/8');
}

// ---- 5. Число полей строки == числу колонок заголовка для всех трёх типов ----
{
  const tx = [
    { id: 1, type: 'expense', amount: 1, cat: 'food', account: 'cash', date: '2026-07-01', note: '' },
    { id: 2, type: 'income', amount: 2, cat: 'sal', account: 'card', date: '2026-07-02', note: '' },
    { id: 3, type: 'transfer', from: 'cash', to: 'card', amount: 3, date: '2026-07-03', note: '' },
  ];
  const rows = parseCsv(E.csv(tx, state));
  assertEqual(rows.length, 4, 'Заголовок + три строки данных');
  rows.forEach((r, i) => assertEqual(r.length, rows[0].length,
    `Строка ${i}: число полей совпадает с числом колонок заголовка`));
}

// ---- 6. РЕГРЕССИЯ ОВ-3: позиция 5 — payee, а НЕ подкатегория ----
{
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', subcategoryId: 's1', account: 'cash',
    date: '2026-07-27', note: '', payee: 'Lidl' }];
  const r = parseCsv(E.csv(tx, state))[1];
  assertEqual(r[I.PAYEE], 'Lidl', 'Позиция 5 («Контрагент») содержит payee');
  assertTrue(r[I.PAYEE] !== 'Супермаркеты', 'РЕГРЕССИЯ ОВ-3: подкатегория НЕ попадает в колонку «Контрагент»');
}

// ---- 6b. Регрессия ОВ-3 при отсутствующем payee: колонка пуста, не подкатегория ----
{
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', subcategoryId: 's1', account: 'cash',
    date: '2026-07-27', note: '' }];
  const r = parseCsv(E.csv(tx, state))[1];
  assertEqual(r[I.PAYEE], '', 'Без payee колонка «Контрагент» пуста (а не занята подкатегорией)');
}

// ---- 7. Позиция 4: «Категория / Подкатегория» при наличии подкатегории ----
{
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', subcategoryId: 's1', account: 'cash',
    date: '2026-07-27', note: '' }];
  const r = parseCsv(E.csv(tx, state))[1];
  assertEqual(r[I.CAT], 'Продукты / Супермаркеты', 'Колонка «Категория» содержит иерархию «Категория / Подкатегория»');
}

// ---- 8. Позиция 4: только категория при отсутствии подкатегории ----
{
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', account: 'cash', date: '2026-07-27', note: '' }];
  const r = parseCsv(E.csv(tx, state))[1];
  assertEqual(r[I.CAT], 'Продукты', 'Без подкатегории колонка «Категория» содержит только категорию');
}
{
  // подкатегория с неизвестным id не должна давать висящий разделитель
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', subcategoryId: 'нет-такой', account: 'cash', date: '2026-07-27', note: '' }];
  const r = parseCsv(E.csv(tx, state))[1];
  assertEqual(r[I.CAT], 'Продукты', 'Неизвестная подкатегория не добавляет разделитель " / "');
}

// ---- 9. ИНВАРИАНТ §0/С4: операция без метаданных → позиции 5/9/10 пусты ----
{
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', account: 'cash', date: '2026-07-27', note: 'x' }];
  let threw = null, r = null;
  try { r = parseCsv(E.csv(tx, state))[1]; } catch (e) { threw = e; }
  assertTrue(threw === null, 'С4: экспорт операции без новых полей не падает');
  assertEqual([r[I.PAYEE], r[I.TAGS], r[I.PLACE]], ['', '', ''], 'С4: позиции 5/9/10 пусты у операции без метаданных');
}

// ---- 10. Теги объединяются через ', ' ----
{
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', account: 'cash', date: '2026-07-27',
    note: '', tags: ['еда', 'семья', 'ЖКХ'] }];
  const r = parseCsv(E.csv(tx, state))[1];
  assertEqual(r[I.TAGS], 'еда, семья, ЖКХ', 'Теги объединяются через ", "');
}

// ---- 11. Значение с запятой корректно закавычено ----
{
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', account: 'cash', date: '2026-07-27',
    note: '', location: 'Oviedo, Asturias' }];
  const raw = E.csv(tx, state);
  assertTrue(raw.indexOf('"Oviedo, Asturias"') !== -1, 'Значение с запятой закавычено в сыром CSV');
  assertEqual(parseCsv(raw)[1][I.PLACE], 'Oviedo, Asturias', 'Значение с запятой корректно читается обратно');
  assertEqual(parseCsv(raw)[1].length, 12, 'Запятая внутри значения не ломает число полей');
}

// ---- 12. Кавычки внутри значения удваиваются ----
{
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', account: 'cash', date: '2026-07-27',
    note: '', payee: 'Bar "El Rincón"' }];
  const raw = E.csv(tx, state);
  assertTrue(raw.indexOf('"Bar ""El Rincón"""') !== -1, 'Кавычки внутри значения удваиваются');
  assertEqual(parseCsv(raw)[1][I.PAYEE], 'Bar "El Rincón"', 'Значение с кавычками читается обратно без потерь');
}

// ---- 13. Значения с ';' и переводом строки закавычены ----
{
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', account: 'cash', date: '2026-07-27',
    note: 'строка1\nстрока2', payee: 'A;B' }];
  const raw = E.csv(tx, state);
  const rows = parseCsv(raw);
  assertEqual(rows[1][I.PAYEE], 'A;B', 'Значение с ";" читается обратно');
  assertEqual(rows[1][I.NOTE], 'строка1\nстрока2', 'Значение с переводом строки читается обратно');
  assertEqual(rows.length, 2, 'Перевод строки внутри значения не создаёт лишнюю строку CSV');
}

// ---- 14. Round-trip: csv() → parseCsv() → те же значения по позициям ----
{
  const tx = [
    { id: 1, type: 'expense', amount: 12.5, cat: 'food', subcategoryId: 's1', account: 'cash',
      date: '2026-07-27', note: 'заметка', payee: 'Mercadona', tags: ['еда', 'семья'], location: 'Gijón' },
    { id: 2, type: 'transfer', from: 'cash', to: 'card', amount: 50, toAmount: 50,
      date: '2026-07-20', note: '', payee: 'Себе', tags: ['накопления'], location: 'дом' },
  ];
  const rows = parseCsv(E.csv(tx, state));
  assertEqual(rows[1][I.PAYEE], 'Mercadona', 'Round-trip: payee расхода');
  assertEqual(rows[1][I.TAGS], 'еда, семья', 'Round-trip: tags расхода');
  assertEqual(rows[1][I.PLACE], 'Gijón', 'Round-trip: location расхода (с диакритикой)');
  assertEqual(rows[1][I.NOTE], 'заметка', 'Round-trip: note расхода отдельно от метаданных');
  assertEqual(rows[2][I.PAYEE], 'Себе', 'Round-trip: payee перевода');
  assertEqual(rows[2][I.TAGS], 'накопления', 'Round-trip: tags перевода');
  assertEqual(rows[2][I.PLACE], 'дом', 'Round-trip: location перевода');
  rows.forEach(r => assertEqual(r.length, 12, 'Round-trip: каждая строка — 12 полей'));
}

// ---- XLS: три новые колонки, экспорт не падает без метаданных ----
{
  const tx = [
    { id: 1, type: 'expense', amount: 10, cat: 'food', subcategoryId: 's1', account: 'cash',
      date: '2026-07-27', note: 'x', payee: 'Lidl', tags: ['еда'], location: 'Oviedo' },
    { id: 2, type: 'income', amount: 5, cat: 'sal', account: 'card', date: '2026-07-26', note: '' },
  ];
  let html = null, threw = null;
  try { html = E.xlsHtml(tx, state, 'июль'); } catch (e) { threw = e; }
  assertTrue(threw === null, 'С4: xlsHtml не падает на операции без метаданных');
  assertTrue(/<th>Контрагент<\/th>/.test(html), 'XLS: колонка «Контрагент» присутствует');
  assertTrue(/<th>Метки<\/th>/.test(html), 'XLS: колонка «Метки» присутствует');
  assertTrue(/<th>Место<\/th>/.test(html), 'XLS: колонка «Место» присутствует');
  assertTrue(html.indexOf('<td>Lidl</td>') !== -1, 'XLS: payee выгружается');
  assertTrue(html.indexOf('<td>еда</td>') !== -1, 'XLS: tags выгружаются');
  assertTrue(html.indexOf('<td>Oviedo</td>') !== -1, 'XLS: location выгружается');
  const headCount = (html.match(/<th>/g) || []).length;
  const firstRowCells = (html.split('<tr>')[2].match(/<td>/g) || []).length;
  assertEqual(firstRowCells, headCount, 'XLS: число ячеек строки совпадает с числом заголовков');
}

// ---- PDF-отчёт не изменён (ОВ: остаётся сводным, без метаданных) ----
{
  const tx = [{ id: 1, type: 'expense', amount: 10, cat: 'food', account: 'cash', date: '2026-07-27',
    note: 'x', payee: 'Lidl', location: 'Oviedo' }];
  let html = null, threw = null;
  try { html = E.reportHTML(state, tx, 'июль'); } catch (e) { threw = e; }
  assertTrue(threw === null, 'reportHTML не падает на операции с метаданными');
  assertTrue(html.indexOf('Lidl') === -1 && html.indexOf('Oviedo') === -1,
    'PDF-отчёт намеренно не содержит метаданных (компоновка не менялась)');
}

// ---- toJSON сохраняет новые поля ----
{
  const st = { tx: [{ id: 1, payee: 'Lidl', tags: ['еда'], location: 'Oviedo' }] };
  const back = JSON.parse(E.toJSON(st));
  assertEqual(back.tx[0].payee, 'Lidl', 'toJSON сохраняет payee');
  assertEqual(back.tx[0].tags, ['еда'], 'toJSON сохраняет tags');
  assertEqual(back.tx[0].location, 'Oviedo', 'toJSON сохраняет location');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
