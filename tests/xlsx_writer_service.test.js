// tests/xlsx_writer_service.test.js — писатель .xlsx (TASK_038).
// Запуск: node tests/xlsx_writer_service.test.js
//
// Файл .xlsx — это ZIP с XML внутри, поэтому тест не «смотрит на строку», а
// разбирает получившийся архив обратно: сигнатуры, CRC каждой записи,
// центральный каталог и содержимое листа. Ошибка в любом из этих полей даёт
// файл, который Excel откажется открывать, — и заметить это иначе нельзя.
global.window = global;
require('../js/services/xlsx_writer_service.js');
const X = AF.Services.Xlsx;
const zlib = require('zlib');

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) { if (cond) passed++; else { failed++; console.error(`FAIL: ${msg}`); } }

// Минимальный распаковщик ZIP (метод store) — читает центральный каталог.
function unzip(bytes) {
  const buf = Buffer.from(bytes);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('битая запись каталога');
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    if (buf.readUInt32LE(offset) !== 0x04034b50) throw new Error('битый локальный заголовок ' + name);
    const lNameLen = buf.readUInt16LE(offset + 26), lExtraLen = buf.readUInt16LE(offset + 28);
    const start = offset + 30 + lNameLen + lExtraLen;
    const data = buf.slice(start, start + size);
    out[name] = { data, crc, method, size };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
function crcOf(buf) { return zlib.crc32 ? zlib.crc32(buf) >>> 0 : X.crc32(new Uint8Array(buf)); }

const columns = [
  { title: 'Дата', type: 'date' },
  { title: 'Сумма', type: 'money' },
  { title: 'Категория', type: 'text' },
];
const rows = [
  ['2024-02-01', -12.5, 'Продукты'],
  ['2024-02-29', 1000, 'Зарплата & "премия" <годовая>'],
  ['не дата', 'не число', ''],
];
const book = X.build({ sheetName: 'Операции', columns, rows });
const files = unzip(book);

// ============ 1. Структура пакета ============
{
  assertEqual(book[0], 0x50, 'Файл начинается сигнатурой ZIP (P)');
  assertEqual(book[1], 0x4b, 'Файл начинается сигнатурой ZIP (K)');
  ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels',
   'xl/styles.xml', 'xl/worksheets/sheet1.xml'].forEach(n =>
    assertTrue(!!files[n], 'В пакете есть обязательная часть ' + n));
  assertEqual(Object.keys(files).length, 6, 'В пакете ровно шесть частей — лишнего не пишем');
}

// ============ 2. Целостность архива ============
{
  Object.keys(files).forEach(n => {
    assertEqual(files[n].method, 0, 'Метод хранения store для ' + n);
    assertEqual(files[n].crc, crcOf(files[n].data), 'CRC32 совпадает для ' + n);
    assertEqual(files[n].size, files[n].data.length, 'Размер записи совпадает для ' + n);
  });
  assertEqual(X.crc32(X.utf8('123456789')), 0xCBF43926, 'CRC32 даёт эталонное значение для «123456789»');
}

// ============ 3. Содержимое листа ============
{
  const sheet = files['xl/worksheets/sheet1.xml'].data.toString('utf8');
  assertTrue(sheet.indexOf('<?xml version="1.0"') === 0, 'Лист начинается XML-декларацией');
  assertTrue(sheet.indexOf('<t xml:space="preserve">Дата</t>') > 0, 'Заголовок «Дата» на месте');
  // дата — числом с датным стилем, а не текстом: иначе не работают сортировка и фильтр
  assertTrue(/<c r="A2" s="2"><v>45323<\/v><\/c>/.test(sheet), 'Дата записана серийным номером Excel с датным стилем');
  assertTrue(/<c r="A3" s="2"><v>45351<\/v><\/c>/.test(sheet), '29 февраля високосного года записано верно');
  assertTrue(/<c r="B2" s="3"><v>-12\.5<\/v><\/c>/.test(sheet), 'Сумма записана числом с денежным стилем');
  assertTrue(/<c r="B3" s="3"><v>1000<\/v><\/c>/.test(sheet), 'Положительная сумма записана числом');
  assertTrue(sheet.indexOf('&amp;') > 0 && sheet.indexOf('&quot;') > 0 && sheet.indexOf('&lt;') > 0,
    'Спецсимволы XML экранированы');
  assertTrue(sheet.indexOf('& "') < 0, 'Неэкранированных спецсимволов не осталось');
  // нераспознанные значения не теряются и не ломают книгу — уходят текстом
  assertTrue(/<c r="A4" t="inlineStr"><is><t xml:space="preserve">не дата<\/t>/.test(sheet), 'Неразобранная дата сохранена текстом');
  assertTrue(/<c r="B4" t="inlineStr"><is><t xml:space="preserve">не число<\/t>/.test(sheet), 'Нечисловая сумма сохранена текстом');
  assertTrue(sheet.indexOf('<autoFilter ref="A1:C4"/>') > 0, 'Автофильтр охватывает все строки');
  assertTrue(sheet.indexOf('state="frozen"') > 0, 'Строка заголовка закреплена');
}

// ============ 4. Книга и стили ============
{
  const wb = files['xl/workbook.xml'].data.toString('utf8');
  assertTrue(wb.indexOf('name="Операции"') > 0, 'Имя листа записано');
  const styles = files['xl/styles.xml'].data.toString('utf8');
  assertTrue(styles.indexOf('numFmtId="164"') > 0, 'Формат даты объявлен');
  assertTrue(styles.indexOf('numFmtId="165"') > 0, 'Денежный формат объявлен');
  const ct = files['[Content_Types].xml'].data.toString('utf8');
  ['workbook.xml', 'sheet1.xml', 'styles.xml'].forEach(n =>
    assertTrue(ct.indexOf(n) > 0, 'Тип содержимого объявлен для ' + n));
}

// ============ 5. Вспомогательные функции ============
{
  assertEqual(X.colName(0), 'A', 'Колонка 0 — A');
  assertEqual(X.colName(25), 'Z', 'Колонка 25 — Z');
  assertEqual(X.colName(26), 'AA', 'Колонка 26 — AA');
  assertEqual(X.colName(51), 'AZ', 'Колонка 51 — AZ');
  assertEqual(X.dateSerial('2024-02-01'), 45323, 'Серийный номер 01.02.2024');
  assertEqual(X.dateSerial('1970-01-01'), 25569, 'Серийный номер начала эпохи Unix');
  assertEqual(X.dateSerial('мусор'), null, 'Неразобранная дата — null');
  assertEqual(X.stripControl('a' + String.fromCharCode(7) + 'b'), 'ab', 'Управляющий символ вырезан');
  assertEqual(X.stripControl('строка\nвторая\tтаб'), 'строка\nвторая\tтаб', 'Перевод строки и табуляция сохранены');
}

// ============ 6. Крайние случаи ============
{
  const empty = unzip(X.build({ columns, rows: [] }));
  assertTrue(!!empty['xl/worksheets/sheet1.xml'], 'Книга без строк собирается');
  const s = empty['xl/worksheets/sheet1.xml'].data.toString('utf8');
  assertTrue(s.indexOf('<row r="1">') > 0, 'В пустой книге остаётся строка заголовка');
  assertTrue(s.indexOf('<row r="2">') < 0, 'Строк данных нет');

  const long = X.build({ sheetName: 'Очень длинное имя листа сверх предела Excel', columns, rows: [] });
  const name = unzip(long)['xl/workbook.xml'].data.toString('utf8').match(/name="([^"]*)"/)[1];
  assertTrue(name.length <= 31, 'Имя листа обрезано до предела Excel (31 символ)');

  const big = X.build({ columns, rows: Array.from({ length: 500 }, (_, i) => ['2024-02-01', i, 'Категория ' + i]) });
  const bigSheet = unzip(big)['xl/worksheets/sheet1.xml'].data.toString('utf8');
  assertTrue(bigSheet.indexOf('<row r="501">') > 0, '500 строк записаны полностью');
  assertEqual(unzip(big)['xl/worksheets/sheet1.xml'].crc, crcOf(unzip(big)['xl/worksheets/sheet1.xml'].data),
    'CRC большого листа верен');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
