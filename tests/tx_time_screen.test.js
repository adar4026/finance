// tests/tx_time_screen.test.js — статические проверки TASK_044 (время операции
// и порядок внутри дня): index.html / store.js / sw.js — regex по исходникам
// (тот же приём, что tests/category_tx_screen.test.js), плюс store.migrate в
// Node без DOM: старые операции не получают время, новые — нормализуются.
// Запуск: node tests/tx_time_screen.test.js

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'js', 'database', 'store.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}

// ============ §1 — подключение сервиса ДО store.js ============
{
  const iSvc = html.indexOf('<script src="js/services/tx_time_service.js"></script>');
  const iStore = html.indexOf('<script src="js/database/store.js"></script>');
  assertTrue(iSvc !== -1, 'index.html: tx_time_service.js подключён');
  assertTrue(iSvc !== -1 && iStore !== -1 && iSvc < iStore, 'index.html: tx_time_service.js подключён ДО store.js (migrate при первом load)');
  assertTrue(/'\.\/js\/services\/tx_time_service\.js'/.test(sw), 'sw.js: tx_time_service.js в precache');
  const m = sw.match(/CACHE\s*=\s*'finance-v(\d+)'/);
  assertTrue(!!m, 'sw.js: CACHE найден');
  if (m) assertTrue(parseInt(m[1], 10) >= 176, 'sw.js: версия кэша поднята до finance-v176 или выше (TASK_044)');
}

// ============ §2 — форма: строка «Время» после «Дата» ============
{
  assertTrue(/<input type="time" id="fTime" class="tx-native" aria-label="Время операции">/.test(html),
    'index.html: нативное поле #fTime (type=time) в строке формы');
  assertTrue(/<div class="tx-row" id="timeRow">/.test(html), 'index.html: строка #timeRow');
  assertTrue(/<span class="tx-val" id="timeRowVal">—<\/span>/.test(html), 'index.html: видимое значение #timeRowVal, по умолчанию «—»');
  const iDate = html.indexOf('id="dateRow"'), iTime = html.indexOf('id="timeRow"');
  assertTrue(iDate !== -1 && iTime > iDate, 'index.html: строка «Время» идёт после строки «Дата»');
  assertTrue(/\$\('#fTime'\)\.onchange=\(\)=>\{haptic\(8\);syncTimeRow\(\);\};/.test(html), 'index.html: onchange #fTime → syncTimeRow');
  assertTrue(/function syncTimeRow\(\)\{[\s\S]*?normalize\(\$\('#fTime'\)\.value\)\|\|'—'/.test(html), 'index.html: syncTimeRow показывает HH:MM либо «—»');
  assertTrue(/function syncTxRows\(\)\{syncAccRows\(\);syncDateRow\(\);syncTimeRow\(\);syncRepeatRow\(\);\}/.test(html), 'index.html: syncTxRows включает syncTimeRow');
}

// ============ §3 — openSheet: новая — локальные дата+время; старая — сохранённое или пусто ============
{
  assertTrue(/\$\('#fTime'\)\.value=AF\.Services\.TxTime\.normalize\(t\.time\);/.test(html),
    'index.html: при редактировании поле времени = сохранённое время (пусто у старой записи, ничего не подставляется)');
  assertTrue(/\$\('#fDate'\)\.value=AF\.Services\.TxTime\.localDate\(now\);\$\('#fTime'\)\.value=AF\.Services\.TxTime\.localTime\(now\);/.test(html),
    'index.html: новая операция — локальные дата и время из одного момента');
  assertTrue(!/\$\('#fDate'\)\.value=new Date\(\)\.toISOString\(\)/.test(html), 'index.html: UTC-дата (toISOString) для #fDate больше не используется');
}

// ============ §4 — saveTx: time пишется только при заполненном поле ============
{
  assertTrue(/const time=AF\.Services\.TxTime\.normalize\(\$\('#fTime'\)\.value\);/.test(html), 'index.html: saveTx читает и нормализует #fTime');
  assertTrue(/const date=\$\('#fDate'\)\.value\|\|AF\.Services\.TxTime\.localDate\(\);/.test(html), 'index.html: saveTx fallback даты — локальная');
  assertTrue(/function applyTxTime\(t,time\)\{\s*if\(time\)t\.time=time;else delete t\.time;\s*return t;\s*\}/.test(html),
    'index.html: applyTxTime — «пусто = ключа нет»');
  const n = (html.match(/applyTxTime\(applyTxMeta\(/g) || []).length;
  assertEqual(n, 4, 'index.html: applyTxTime применяется во всех 4 ветках saveTx (перевод новый/редакт., расход-доход новый/редакт.)');
}

// ============ §5 — сортировка: все сгруппированные списки через сервис ============
{
  assertTrue(!/b\.id-a\.id/.test(html), 'index.html: сортировка b.id-a.id (NaN для строковых id) удалена полностью');
  const n = (html.match(/AF\.Services\.TxTime\.sortDay\(byDay\[day\]\)/g) || []).length;
  assertEqual(n, 3, 'index.html: homeGroupedTxHtml/groupedTxHtml/catxGroupedTxHtml сортируют день через TxTime.sortDay');
  assertTrue(/const items=AF\.Services\.TxTime\.sortAll\(list\);/.test(html), 'index.html: renderRecent — TxTime.sortAll (дни desc, внутри дня время desc)');
  // дни по-прежнему по убыванию
  const days = (html.match(/const days=Object\.keys\(byDay\)\.sort\(\(a,b\)=>b\.localeCompare\(a\)\);/g) || []).length;
  assertEqual(days, 3, 'index.html: порядок дней (по убыванию) не изменён');
}

// ============ §6 — отображение времени в строках ============
{
  assertTrue(/function txTimeHtml\(t\)\{[\s\S]*?<span class="tx-time">\$\{s\}<\/span> · /.test(html), 'index.html: txTimeHtml — «19:30 · » либо пусто');
  assertTrue(/const extra=txTimeHtml\(t\)\+\[t\.payee\|\|null/.test(html), 'index.html: homeTxRow — время первым в подзаголовке');
  assertTrue(/<div class="home-sub">\$\{txTimeHtml\(t\)\}\$\{from\?esc\(from\.name\)/.test(html), 'index.html: homeTxRow (перевод) — время первым');
  assertTrue(/<div class="t2">\$\{txTimeHtml\(t\)\}\$\{\(acc\?acc\.emoji/.test(html), 'index.html: txRow — время первым в .t2');
  assertTrue(/<div class="t2">\$\{txTimeHtml\(t\)\}\$\{from\?esc\(from\.name\)/.test(html), 'index.html: txRow (перевод) — время первым в .t2');
  assertTrue(/\.tx-time\{font-variant-numeric:tabular-nums\}/.test(html), 'index.html: .tx-time — табличные цифры');
}

// ============ §7 — store.migrate: нормализация, старые записи без времени ============
{
  assertTrue(/AF\.Services\.TxTime/.test(store) && /TT\.normalizeTx\(t\)/.test(store), 'store.js: migrate вызывает TxTime.normalizeTx с проверкой наличия сервиса');
  assertTrue(/SCHEMA_VERSION = 3;/.test(store), 'store.js: SCHEMA_VERSION не поднят (ключ необязательный)');

  global.window = global;
  global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  require(path.join(root, 'js', 'core', 'result.js'));
  require(path.join(root, 'js', 'services', 'tx_time_service.js'));
  require(path.join(root, 'js', 'database', 'store.js'));
  const st = AF.Store.defaults();
  st.tx = [
    { id: 1690000000000, type: 'expense', amount: 5, cat: 'food', account: 'cash', date: '2026-09-10' },
    { id: 't' + Date.now().toString(36) + '-1-abcdef', type: 'expense', amount: 7, cat: 'food', account: 'cash', date: '2026-09-10', time: '9:30' },
    { id: 'z', type: 'income', amount: 9, cat: 'salary', account: 'cash', date: '2026-09-10', time: '25:99' },
  ];
  const out = AF.Store.migrate(st);
  assertTrue(!('time' in out.tx[0]), 'migrate: старой операции время не подставляется');
  assertEqual(out.tx[0].date, '2026-09-10', 'migrate: дата старой операции не изменена');
  assertEqual(out.tx[1].time, '09:30', 'migrate: время новой операции нормализовано к HH:MM');
  assertTrue(!('time' in out.tx[2]), 'migrate: невалидное время удалено');
  const again = JSON.stringify(AF.Store.migrate(out).tx);
  assertEqual(again, JSON.stringify(out.tx), 'migrate идемпотентен для time');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
