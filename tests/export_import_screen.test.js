// tests/export_import_screen.test.js — экран «Экспорт и копии» (TASK_038).
// Запуск: node tests/export_import_screen.test.js
//
// Две части:
//   §A — поведение поверх подставного localStorage: экспорт ничего не пишет,
//        импорт и восстановление либо проходят целиком, либо не оставляют
//        следа (отказ хранилища, провал валидации, повреждённая копия);
//   §B — проверки кода экрана, которые нельзя выразить поведенчески без DOM:
//        порядок шагов восстановления, отсутствие alert()/confirm() на путях
//        импорта и восстановления, блокировка повторных нажатий, состав
//        экрана и регистрация новых сервисов в service worker.
global.window = global;

// ---- подставное хранилище (тот же приём, что в tests/store_save.test.js) ----
let mode = 'ok';
const backing = new Map();
global.localStorage = {
  getItem: k => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => {
    if (mode === 'quota') { const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; throw e; }
    if (mode === 'fail') throw new Error('storage down');
    backing.set(k, String(v));
  },
  removeItem: k => backing.delete(k),
};

const fs = require('fs'), path = require('path');
['../js/core/result.js', '../js/core/ids.js', '../js/core/app_info.js',
 '../js/services/tx_meta_service.js', '../js/services/currency_service.js',
 '../js/database/store.js', '../js/services/xlsx_writer_service.js',
 '../js/services/export_service.js', '../js/services/backup_service.js',
 '../js/services/csv_parser_service.js', '../js/services/import_source_service.js',
 '../js/services/import_mapping_service.js', '../js/services/import_service.js'].forEach(f => require(f));

const S = AF.Store, E = AF.Services.Export, B = AF.Services.Backup,
      CSV = AF.Services.CsvParser, SRC = AF.Services.ImportSource,
      MAP = AF.Services.ImportMapping, IMP = AF.Services.Import;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) { if (cond) passed++; else { failed++; console.error(`FAIL: ${msg}`); } }

const MF_HEAD = 'Дата,Счёт,Сумма,Валюта,Категория,Контрагент,Перевод: Счёт,Перевод: Сумма,Перевод: Валюта,Метки,Место,Примечание';
const FILE = MF_HEAD +
  '\n01.02.2024,ING,-12.50,EUR,Продукты,Lidl,,,,,,кофе' +
  '\n02.02.2024,ING,-30,EUR,Хобби,,,,,,,' +
  '\n03.02.2024,ING,-100,EUR,,,Наличные,100,EUR,,,снятие';

function seed() {
  mode = 'ok'; backing.clear();
  const st = S.migrate(Object.assign(S.defaults(), {
    currency: '€',
    accounts: [{ id: 'a_ing', name: 'ING', currency: '€' }, { id: 'a_cash', name: 'Наличные', currency: '€' }],
    cats: [{ id: 'c_food', name: 'Продукты', type: 'expense' }],
    tx: [{ id: 't0', type: 'expense', amount: 5, date: '2024-01-15', account: 'a_ing', cat: 'c_food' }],
  }));
  const w = S.save(st);
  if (!w.ok) throw new Error('подготовка не удалась');
  return st;
}
function stored() { return backing.get('finance_app') || null; }
function storedState() { return JSON.parse(stored()); }
// Полный путь мастера «файл → план», как он идёт на экране.
function planFor(text, state) {
  const p = CSV.parse(text).value;
  const mapping = SRC.autoMap(p.header).map;
  return IMP.buildPlan({ body: p.body, mapping, state,
    accountPlan: MAP.buildAccountPlan(IMP.collectAccountNames(p.body, mapping), state.accounts),
    categoryPlan: MAP.buildCategoryPlan(IMP.collectCategoryEntries(p.body, mapping), state.cats) });
}

// ==================== §A. Поведение ====================

// ---- A1. Экспорт ничего не меняет ----
{
  const st = seed();
  const before = stored();
  const list = st.tx;
  const csv = E.csv(list, st);
  const xlsx = E.xlsx(list, st, 'февраль');
  const html = E.reportHTML(st, list, 'февраль');
  const json = E.toJSON(st);
  assertTrue(csv.length > 0, 'CSV сформирован');
  assertTrue(xlsx && xlsx.length > 0, 'XLSX сформирован');
  assertTrue(html.length > 0, 'HTML-отчёт для PDF сформирован');
  assertTrue(json.length > 0, 'JSON сформирован');
  assertEqual(stored(), before, 'Ни один экспорт не изменил хранилище');
  assertEqual(st.tx.length, 1, 'Экспорт не изменил состояние в памяти');
}

// ---- A2. Применение периода ----
{
  // exportTx() на экране фильтрует строковым ключом даты, а не new Date(t.date):
  // 'YYYY-MM-DD' разбирается как полночь UTC, и в плюсовых поясах операция
  // первого числа выпадала из своего же месяца.
  const tx = [
    { id: '1', date: '2024-01-01', type: 'expense', amount: 1 },
    { id: '2', date: '2024-01-31', type: 'expense', amount: 1 },
    { id: '3', date: '2024-02-01', type: 'expense', amount: 1 },
    { id: '4', date: '2023-12-31', type: 'expense', amount: 1 },
  ];
  const pick = (from, to) => tx.filter(t => { const d = String(t.date).slice(0, 10); return d >= from && d <= to; }).map(t => t.id);
  assertEqual(pick('2024-01-01', '2024-01-31'), ['1', '2'], 'Границы месяца включают первое и последнее число');
  assertEqual(pick('2024-01-01', '2024-12-31'), ['1', '2', '3'], 'Год включает все свои месяцы и не захватывает соседний');
  assertEqual(pick('2000-01-01', '2999-01-01'), ['1', '2', '3', '4'], 'Вся история включает всё');
}

// ---- A3. Импорт: успешная запись ----
{
  const st = seed();
  const plan = planFor(FILE, st);
  const applied = IMP.apply(st, plan, { source: 'Money Flow', fileName: 'mf.csv' });
  assertTrue(applied.ok, 'План применён');
  const w = S.save(applied.value);
  assertTrue(w.ok, 'Импортированное состояние записано');
  const disk = storedState();
  assertEqual(disk.tx.length, 4, 'На диске 1 прежняя + 3 импортированные операции');
  assertEqual(disk.accounts.length, 2, 'Существующие счета переиспользованы');
  assertEqual(disk.cats.length, 2, 'Создана одна новая категория');
  assertEqual(disk.importBatches.length, 1, 'Журнал импорта записан на диск');
  assertTrue(disk.tx.filter(t => t.type === 'transfer').length === 1, 'Перевод записан одной операцией');
}

// ---- A4. Импорт: провал разбора → 0 изменений ----
{
  const st = seed();
  const before = stored();
  const res = CSV.parse('');
  assertTrue(!res.ok, 'Пустой файл не разбирается');
  assertEqual(stored(), before, 'Провал разбора: хранилище не изменилось');
  assertEqual(st.tx.length, 1, 'Провал разбора: состояние в памяти не изменилось');
}

// ---- A5. Импорт: провал валидации → 0 изменений ----
{
  const st = seed();
  const before = stored();
  const plan = planFor(FILE, st);
  plan.items[0].tx.cat = 'нет такой категории';
  const applied = IMP.apply(st, plan, {});
  assertTrue(!applied.ok, 'Валидация остановила импорт');
  assertEqual(stored(), before, 'Провал валидации: хранилище не изменилось');
  assertEqual(st.tx.length, 1, 'Провал валидации: состояние в памяти не изменилось');
  assertEqual(st.cats.length, 1, 'Провал валидации: категории не созданы');
  assertEqual(st.accounts.length, 2, 'Провал валидации: счета не созданы');
}

// ---- A6. Импорт: отказ записи → откат ----
{
  const st = seed();
  const before = stored();
  const plan = planFor(FILE, st);
  const applied = IMP.apply(st, plan, {});
  assertTrue(applied.ok, 'План применён к клону состояния');
  mode = 'quota';
  const w = S.save(applied.value);
  mode = 'ok';
  assertTrue(!w.ok, 'Запись не удалась');
  assertEqual(w.error.code, 'QUOTA_EXCEEDED', 'Ошибка переполнения различима');
  assertEqual(stored(), before, 'Отказ записи: на диске прежняя база');
  assertEqual(st.tx.length, 1, 'Отказ записи: рабочее состояние не тронуто — apply() его не мутирует');
  assertEqual(storedState().tx.length, 1, 'Отказ записи: импортированных операций на диске нет');
}

// ---- A7. Повторный импорт того же файла ----
{
  const st = seed();
  const applied = IMP.apply(st, planFor(FILE, st), {});
  S.save(applied.value);
  const afterFirst = storedState();
  const second = planFor(FILE, afterFirst);
  assertEqual(second.counts.toImport, 0, 'Повторный импорт: импортировать нечего');
  assertEqual(second.counts.duplicates, 3, 'Повторный импорт: все строки — дубликаты');
  const applied2 = IMP.apply(afterFirst, second, {});
  assertTrue(!applied2.ok, 'Пустой повторный импорт не применяется');
  assertEqual(storedState().tx.length, 4, 'Повторный импорт не изменил число операций на диске');
}

// ---- A8. Восстановление: успешная замена ----
{
  const st = seed();
  const backupFile = B.create(st, { appVersion: '1.0.0' });
  // меняем данные после копии
  const changed = JSON.parse(JSON.stringify(st));
  changed.tx.push({ id: 't9', type: 'income', amount: 999, date: '2024-03-01', account: 'a_ing', cat: 'c_food' });
  assertTrue(S.save(changed).ok, 'Изменённое состояние записано');
  assertEqual(storedState().tx.length, 2, 'На диске изменённая база');

  const insp = B.inspect(backupFile);
  assertTrue(insp.ok, 'Копия прочитана');
  assertEqual(storedState().tx.length, 2, 'Чтение копии ничего не восстановило — только предпросмотр');
  const mig = B.migrateBackup(insp.value.data);
  const w = S.save(mig.value);
  assertTrue(w.ok, 'Восстановленное состояние записано');
  assertEqual(storedState().tx.length, 1, 'Восстановление вернуло прежнее состояние');
  const reread = S.load();
  assertEqual(B.counts(reread).tx, B.counts(mig.value).tx, 'Проверка после записи: счётчики сошлись');
}

// ---- A9. Восстановление: повреждённая копия не трогает базу ----
{
  const st = seed();
  const before = stored();
  const file = B.create(st);
  const broken = file.replace('"amount": 5', '"amount": 50');
  const res = B.inspect(broken);
  assertTrue(!res.ok, 'Повреждённая копия отклонена');
  assertEqual(res.error.code, B.ERROR.CHECKSUM_MISMATCH, 'Причина — контрольная сумма');
  assertEqual(stored(), before, 'Повреждённая копия: база на диске не изменилась');

  ['', 'не json', '{"foo":1}', '[1,2]'].forEach(bad => {
    assertTrue(!B.inspect(bad).ok, 'Отклонён негодный файл: ' + (bad || '<пусто>'));
  });
  assertEqual(stored(), before, 'Ни один негодный файл не изменил базу');
}

// ---- A10. Восстановление: отказ записи → прежняя база цела ----
{
  const st = seed();
  const before = stored();
  const other = S.migrate(Object.assign(S.defaults(), {
    accounts: [{ id: 'x', name: 'Другой', currency: '€' }],
    tx: [{ id: 'z1', type: 'expense', amount: 1, date: '2024-05-05', account: 'x', cat: 'c' }],
  }));
  const file = B.create(other);
  const insp = B.inspect(file);
  const mig = B.migrateBackup(insp.value.data);
  mode = 'fail';
  const w = S.save(mig.value);
  mode = 'ok';
  assertTrue(!w.ok, 'Запись восстановленного состояния не удалась');
  assertEqual(stored(), before, 'Отказ записи при восстановлении: на диске прежняя база');
  assertEqual(storedState().accounts[0].id, 'a_ing', 'Прежние счета целы');
}

// ---- A11. Восстановление: провал проверки после записи → возврат снимка ----
{
  const st = seed();
  const safetyJson = S.snapshot();          // снимок последнего успешного сохранения
  assertTrue(typeof safetyJson === 'string', 'Снимок прежнего состояния доступен');
  const other = S.migrate(Object.assign(S.defaults(), {
    accounts: [{ id: 'x', name: 'Другой', currency: '€' }], tx: [],
  }));
  assertTrue(S.save(other).ok, 'Замена записана');
  assertEqual(storedState().tx.length, 0, 'На диске новая (пустая) база');
  // проверка не сошлась — возвращаем снимок, как это делает restoreSafety()
  const back = S.save(JSON.parse(safetyJson));
  assertTrue(back.ok, 'Снимок записан обратно');
  assertEqual(storedState().tx.length, 1, 'Прежние операции вернулись');
  assertEqual(storedState().accounts[0].id, 'a_ing', 'Прежние счета вернулись');
}

// ---- A12. Отмена импорта ----
{
  const st = seed();
  const plan = planFor(FILE, st);
  const applied = IMP.apply(st, plan, {});
  S.save(applied.value);
  const afterImport = S.load();
  assertEqual(afterImport.tx.length, 4, 'После импорта 4 операции');
  const undone = IMP.undo(afterImport, plan.batchId);
  assertTrue(undone.ok, 'Отмена подготовлена');
  assertTrue(S.save(undone.value.state).ok, 'Отмена записана');
  const disk = storedState();
  assertEqual(disk.tx.length, 1, 'После отмены осталась только собственная операция');
  assertEqual(disk.tx[0].id, 't0', 'Уцелела именно она');
  assertEqual(disk.cats.length, 1, 'Созданная импортом категория удалена');
  assertEqual(disk.importBatches.length, 0, 'Журнал импорта очищен');
}

// ==================== §B. Код экрана ====================
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

// ---- B1. Состав экрана ----
{
  ['expPeriod', 'expCustom', 'expFrom', 'expTo', 'expPdf', 'expXls', 'expCsv',
   'impCsvBtn', 'impCsvFile', 'bkpCreate', 'bkpRestore', 'bkpFile'].forEach(id =>
    assertTrue(html.indexOf('id="' + id + '"') > 0, 'На экране есть элемент #' + id));
  ['month', 'prevmonth', 'year', 'prevyear', 'all', 'custom'].forEach(v =>
    assertTrue(new RegExp('<option value="' + v + '"').test(html), 'Период «' + v + '» доступен в списке'));
  assertTrue(/<span>Импорт данных<\/span>/.test(html), 'Есть отдельный раздел «Импорт данных»');
  assertTrue(/Excel \(\.xlsx\)/.test(html), 'Excel заявлен как .xlsx');
  assertTrue(!/Excel \(\.xls\)</.test(html), 'Старой подписи Excel (.xls) на экране не осталось');
  assertTrue(/<b>Импортировать CSV<\/b>/.test(html), 'Есть карточка «Импортировать CSV»');
  assertTrue(/class="exp-row danger" id="bkpRestore"/.test(html),
    'Восстановление помечено как разрушающее действие и отличается от импорта');
  ['importOverlay', 'restoreOverlay', 'impBody', 'impNext', 'impBack', 'rstBody', 'rstConfirm'].forEach(id =>
    assertTrue(html.indexOf('id="' + id + '"') > 0, 'Есть узел мастера/предпросмотра #' + id));
}

// ---- B2. Никаких alert()/confirm() на новых путях ----
{
  assertTrue(!/\balert\(/.test(code), 'alert() в коде экрана не используется');
  const importBlock = code.slice(code.indexOf('function openImportCsv'), code.indexOf('function impBack'));
  assertTrue(!/\bconfirm\(/.test(importBlock), 'Мастер импорта не использует confirm()');
  const restoreBlock = code.slice(code.indexOf('function openRestorePreview'), code.indexOf('function restoreSafety'));
  assertTrue(!/\bconfirm\(/.test(restoreBlock), 'Восстановление не использует confirm() — есть экран предпросмотра');
  assertTrue(/toastError\(/.test(importBlock), 'Ошибки импорта показываются существующим механизмом тостов');
  assertTrue(/toastError\(/.test(restoreBlock), 'Ошибки восстановления показываются тостом');
}

// ---- B3. Порядок шагов восстановления ----
{
  const body = code.slice(code.indexOf('function doRestoreCommit'), code.indexOf('function restoreSafety'));
  const iSnapshot = body.indexOf('AF.Store.snapshot()');
  const iSafetyFile = body.indexOf('alex_finance_safety_');
  const iSave = body.indexOf('AF.Store.save(next)');
  const iLoad = body.indexOf('load();');
  const iCheck = body.indexOf('actual.tx!==expected.tx');
  const iToast = body.indexOf("toast('Данные восстановлены");
  assertTrue(iSnapshot > 0 && iSafetyFile > iSnapshot, 'Safety-копия создаётся до чего-либо ещё');
  assertTrue(iSafetyFile < iSave, 'Safety-копия создаётся ДО записи новой базы');
  assertTrue(iSave < iLoad && iLoad < iCheck, 'После записи база перечитывается и проверяется');
  assertTrue(iCheck < iToast, 'Успех объявляется только после проверки записанного');
  assertTrue(/if\(!w\.ok\)\{/.test(body) && body.indexOf('if(!w.ok)') < iLoad, 'Отказ записи прерывает сценарий до объявления успеха');
  assertTrue(/restoreSafety\(safetyJson\)/.test(body), 'При несошедшейся проверке восстанавливается снимок прежней базы');
  assertTrue(/rstBusy/.test(body), 'Повторное нажатие во время восстановления заблокировано');
}

// ---- B4. Импорт меняет базу ровно в одном месте ----
{
  const commit = code.slice(code.indexOf('function impCommit'), code.indexOf('function impRenderResult'));
  assertTrue(/const I=AF\.Services\.Import;/.test(commit), 'Запись обращается к сервису импорта');
  assertTrue(/I\.apply\(state,impCtx\.plan/.test(commit), 'Запись идёт через Import.apply() над готовым планом, а не построчно');
  assertTrue(commit.indexOf('applied.ok') < commit.indexOf('AF.Store.save'), 'Результат apply() проверяется до записи');
  assertTrue(/if\(!w\.ok\)\{/.test(commit), 'Отказ записи обрабатывается');
  assertTrue(commit.indexOf('if(!w.ok)') < commit.indexOf('impGoto(3)'), 'Экран результата показывается только после успешной записи');
  assertTrue(/impBusy/.test(commit), 'Повторное нажатие во время импорта заблокировано');
  // ни один шаг мастера, кроме impCommit, не пишет в хранилище
  const wizard = code.slice(code.indexOf('function openImportCsv'), code.indexOf('function impCommit'));
  assertTrue(!/AF\.Store\.save\(/.test(wizard), 'Шаги анализа, сопоставления и предпросмотра не пишут в хранилище');
  assertTrue(!/state\.tx\.push|state\.accounts\.push|state\.cats\.push/.test(wizard),
    'Шаги мастера не добавляют сущности в состояние — этого и не должно случиться до подтверждения');
  const undo = code.slice(code.indexOf('function impUndo'), code.indexOf('function impNext'));
  assertTrue(/if\(!w\.ok\)\{/.test(undo) && undo.indexOf('if(!w.ok)') < undo.indexOf("toast('Импорт отменён"),
    'Отмена импорта не объявляет успех без записи');
}

// ---- B5. Экспорт не пишет в базу ----
{
  ['doExportCsv', 'doExportXls', 'doExportPdf'].forEach(fn => {
    const body = code.slice(code.indexOf('function ' + fn), code.indexOf('function ' + fn) + 900);
    assertTrue(!/AF\.Store\.save|\bsave\(\)/.test(body.slice(0, body.indexOf('\n}'))), fn + '() не сохраняет состояние');
  });
  assertTrue(/function expLock\(/.test(code), 'Кнопки экспорта блокируются на время формирования файла');
  assertTrue(/downloadBytes\(/.test(code), 'Для .xlsx используется бинарная выгрузка');
}

// ---- B6. Старая реализация импорта удалена ----
{
  assertTrue(!/function importCSV\(/.test(code), 'Старая функция importCSV() удалена');
  assertTrue(!/function parseCSV\(/.test(code), 'Старый парсер CSV в index.html удалён — разбор живёт в сервисе');
  assertTrue(!/function ensureAcc\(/.test(code), 'Старое создание счетов на лету удалено');
  assertTrue(!/function resolveCatPath\(/.test(code), 'Старое разрешение пути категории удалено');
  assertTrue(/function ensureCat\(/.test(code), 'ensureCat() сохранена — ею пользуется форма операции');
  assertTrue(/aCat=ensureCat\(name,aType\)/.test(code), 'У ensureCat() есть реальный потребитель вне импорта');
}

// ---- B7. Сервисы зарегистрированы ----
{
  ['xlsx_writer_service', 'csv_parser_service', 'import_source_service',
   'import_mapping_service', 'import_service'].forEach(n => {
    assertTrue(html.indexOf('js/services/' + n + '.js') > 0, 'index.html подключает ' + n);
    assertTrue(sw.indexOf('js/services/' + n + '.js') > 0, 'sw.js кэширует ' + n);
  });
  const m = sw.match(/const CACHE = 'finance-v(\d+)'/);
  assertTrue(!!m && Number(m[1]) >= 169, 'Версия кэша service worker поднята (v169+)');
}

// ---- B8. Мобильная вёрстка ----
{
  const css = html.slice(html.indexOf('.imp-steps{'), html.indexOf('.imp-done .t{'));
  assertTrue(/\.imp-scroll\{[^}]*max-height/.test(css), 'Длинные списки сопоставления скроллятся внутри себя');
  assertTrue(/\.imp-scroll\{[^}]*overflow-y:auto/.test(css), 'У списка сопоставления собственный вертикальный скролл');
  assertTrue(/\.imp-btn\{[^}]*min-height:48px/.test(css), 'Кнопки мастера имеют нормальный tap target');
  assertTrue(/\.imp-row select\{[^}]*max-width:52%/.test(css), 'Селект сопоставления ограничен по ширине — строка не уезжает за экран');
  assertTrue(/\.imp-row select\{[^}]*min-height:38px/.test(css), 'Селект сопоставления достаточно крупный для касания');
  assertTrue(/\.imp-foot\{[^}]*env\(safe-area-inset-bottom\)/.test(css), 'Кнопки мастера учитывают safe-area');
  assertTrue(/overflow-wrap:anywhere/.test(css), 'Длинные значения переносятся, а не растягивают карточку');
  assertTrue(!/var\(--imp-|#[0-9a-f]{6}/i.test(css.replace(/rgba?\([^)]*\)/g, '')),
    'Новый CSS использует только существующие токены темы — цвета не захардкожены');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
