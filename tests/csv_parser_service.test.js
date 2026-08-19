// tests/csv_parser_service.test.js — разбор CSV (TASK_038).
// Запуск: node tests/csv_parser_service.test.js
//
// Проверяется то, на чём прежний разбор внутри importCSV() ошибался:
// кодировка (читалось всегда как UTF-8), выбор разделителя по первой строке,
// кавычки с запятыми и переводами строк, пустые строки, BOM.
global.window = global;
require('../js/core/result.js');
require('../js/services/csv_parser_service.js');
const P = AF.Services.CsvParser;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) { if (cond) passed++; else { failed++; console.error(`FAIL: ${msg}`); } }

const enc = s => new TextEncoder().encode(s);

// ---- 1. Разделители ----
{
  const comma = P.parse('a,b,c\n1,2,3');
  assertTrue(comma.ok, 'Запятая: файл разобран');
  assertEqual(comma.value.delimiter, ',', 'Запятая определена как разделитель');
  assertEqual(comma.value.body[0], ['1', '2', '3'], 'Запятая: значения строки');

  const semi = P.parse('Дата;Счёт;Сумма\n01.02.2024;ING;-12,50');
  assertEqual(semi.value.delimiter, ';', 'Точка с запятой определена как разделитель');
  assertEqual(semi.value.body[0], ['01.02.2024', 'ING', '-12,50'], 'Точка с запятой: значения строки');

  const tab = P.parse('a\tb\tc\n1\t2\t3');
  assertEqual(tab.value.delimiter, '\t', 'Табуляция определена как разделитель');

  const pipe = P.parse('a|b|c\n1|2|3');
  assertEqual(pipe.value.delimiter, '|', 'Вертикальная черта определена как разделитель');
}

// ---- 2. Запятые внутри кавычек не ломают выбор разделителя ----
{
  // В заголовке три запятые внутри одного закавыченного поля — по прежнему
  // правилу «считаем символы в первой строке» победила бы запятая.
  const text = 'Дата;Категория;Примечание\n01.02.2024;Еда;"Хлеб, молоко, сыр"';
  const res = P.parse(text);
  assertEqual(res.value.delimiter, ';', 'Запятые внутри значения не перебивают настоящий разделитель');
  assertEqual(res.value.body[0][2], 'Хлеб, молоко, сыр', 'Закавыченное значение с запятыми прочитано целиком');
}

// ---- 3. Кавычки ----
{
  const res = P.parse('a,b\n"строка с ""кавычками""",2');
  assertEqual(res.value.body[0][0], 'строка с "кавычками"', 'Удвоенная кавычка внутри поля');

  const multi = P.parse('a,b\n"первая\nвторая",2');
  assertEqual(multi.value.body.length, 1, 'Перевод строки внутри кавычек не начинает новую запись');
  assertEqual(multi.value.body[0][0], 'первая\nвторая', 'Многострочное значение прочитано целиком');

  const spaces = P.parse('a,b\n"  с пробелами  ",  без кавычек  ');
  assertEqual(spaces.value.body[0][0], '  с пробелами  ', 'Пробелы внутри кавычек сохраняются');
  assertEqual(spaces.value.body[0][1], 'без кавычек', 'Пробелы вне кавычек обрезаются');
}

// ---- 4. Пустые строки ----
{
  const res = P.parse('a,b\n1,2\n\n\n3,4\n');
  assertEqual(res.value.body.length, 2, 'Пустые строки не считаются операциями');
  assertTrue(res.value.blankRows >= 2, 'Пустые строки посчитаны отдельно');
  assertEqual(res.value.totalRows, 2, 'totalRows — без заголовка и без пустых строк');
}

// ---- 5. Кодировки ----
{
  const utf8 = P.decodeBytes(enc('Дата,Счёт\n01.02.2024,Наличные'));
  assertTrue(utf8.ok, 'UTF-8 распознан');
  assertEqual(utf8.value.encoding, 'UTF-8', 'Кодировка UTF-8 определена');
  assertTrue(utf8.value.text.indexOf('Счёт') > 0, 'UTF-8: кириллица прочитана верно');

  // BOM
  const bom = P.decodeBytes(new Uint8Array([0xEF, 0xBB, 0xBF, ...enc('Дата,Сумма')]));
  assertTrue(bom.ok, 'Файл с BOM прочитан');
  assertTrue(bom.value.text.charCodeAt(0) !== 0xFEFF, 'BOM снят с начала файла');
  assertEqual(bom.value.text.slice(0, 4), 'Дата', 'BOM не попал в первый заголовок');

  // windows-1251: «Дата;Счёт» в cp1251
  const cp = new Uint8Array([0xC4, 0xE0, 0xF2, 0xE0, 0x3B, 0xD1, 0xF7, 0xB8, 0xF2]);
  const dec = P.decodeBytes(cp);
  assertTrue(dec.ok, 'windows-1251 прочитан');
  assertEqual(dec.value.encoding, 'windows-1251', 'Кодировка windows-1251 определена');
  assertEqual(dec.value.text, 'Дата;Счёт', 'windows-1251: кириллица восстановлена, а не «кракозябры»');

  const parsedCp = P.parseBytes(new Uint8Array([...cp, 0x0A, ...enc('01.02.2024;ING')]));
  assertTrue(parsedCp.ok, 'parseBytes читает cp1251 и разбирает строки');
  assertEqual(parsedCp.value.header, ['Дата', 'Счёт'], 'parseBytes: заголовок из cp1251');
  assertEqual(parsedCp.value.encoding, 'windows-1251', 'parseBytes возвращает кодировку');
}

// ---- 6. Заголовки Money Flow (русская локаль) ----
{
  const head = 'Дата,Счёт,Сумма,Валюта,Категория,Контрагент,Перевод: Счёт,Перевод: Сумма,Перевод: Валюта,Метки,Место,Примечание';
  const res = P.parse(head + '\n01.02.2024,ING,-12.50,EUR,Продукты,Lidl,,,,,,кофе');
  assertEqual(res.value.header.length, 12, 'Money Flow: 12 колонок заголовка');
  assertEqual(res.value.header[6], 'Перевод: Счёт', 'Money Flow: заголовок перевода прочитан целиком');
  assertEqual(res.value.body[0].length, 12, 'Money Flow: строка данных той же ширины');
}

// ---- 7. Ошибки ----
{
  assertEqual(P.parse('').ok, false, 'Пустой текст — ошибка');
  assertEqual(P.parse('').error.code, 'EMPTY_FILE', 'Код ошибки пустого файла');
  assertEqual(P.parse('a,b,c').error.code, 'NO_DATA_ROWS', 'Только заголовок — отдельный код ошибки');
  assertEqual(P.decodeBytes(new Uint8Array(0)).error.code, 'EMPTY_FILE', 'Пустые байты — ошибка');
  const big = new Uint8Array(P.MAX_BYTES + 1);
  assertEqual(P.decodeBytes(big).error.code, 'FILE_TOO_LARGE', 'Слишком большой файл отклоняется');
  assertTrue(!!P.parse('a,b,c').error.message, 'У ошибки есть текст для пользователя');
}

// ---- 8. Разбор не зависит от переводов строк Windows ----
{
  const res = P.parse('a,b\r\n1,2\r\n3,4\r\n');
  assertEqual(res.value.body, [['1', '2'], ['3', '4']], 'CRLF не оставляет \\r в значениях');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
