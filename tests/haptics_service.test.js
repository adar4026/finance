// tests/haptics_service.test.js — тесты для TASK_042 (тактильный отклик
// цифровой клавиатуры на iPhone).
//
//  §1  AF.Services.Haptics — юнит-тесты с fake DOM:
//      - на iOS-подобной среде (нет navigator.vibrate) tap() делает ровно один
//        импульс через <label><input type=checkbox switch></label>.click();
//      - элемент помечен aria-hidden, скрыт, вставлен в <head> и удалён после;
//      - success() — два импульса с паузой (второй через таймер);
//      - при наличии navigator.vibrate используется он, switch-приём не
//        дублируется (нет двойного отклика на Android);
//      - без DOM и без vibrate — тихий no-op, без исключений;
//      - исключение внутри DOM-операций не пробрасывается наружу.
//  §2  Статика index.html/sw.js:
//      - сервис подключён в index.html и в precache sw.js, версия кэша поднята;
//      - клавиши слушают pointerdown (keyPressHaptic), key() по click больше
//        не вызывает navigator.vibrate (нет двойного отклика);
//      - touchstart на клавишах не используется;
//      - успешное сохранение вызывает success() после проверки res.ok;
//      - логика ввода (applyKey/evalExpr) не изменена.
// Запуск: node tests/haptics_service.test.js

const fs = require('fs');
const path = require('path');

global.window = global;
require('../js/services/haptics_service.js');
const H = AF.Services.Haptics;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// ---- fake DOM: фиксирует созданные элементы, вставки в head и клики ----
function fakeDocument(opts) {
  opts = opts || {};
  const log = { clicks: [], appended: [], removed: [], created: [] };
  function el(tag) {
    const attrs = {}, children = [];
    const node = {
      tag, attrs, children, style: {}, type: undefined,
      setAttribute(k, v) { attrs[k] = v; },
      getAttribute(k) { return attrs[k]; },
      appendChild(c) { children.push(c); return c; },
      click() { log.clicks.push(node); },
    };
    log.created.push(node);
    return node;
  }
  const head = {
    children: [],
    appendChild(c) { if (opts.throwOnAppend) throw new Error('boom'); head.children.push(c); log.appended.push(c); return c; },
    removeChild(c) { head.children.splice(head.children.indexOf(c), 1); log.removed.push(c); return c; },
  };
  return { doc: { createElement: el, head }, head, log };
}

// ============ §1 — сервис ============

// 1.1 iOS-подобная среда: нет vibrate → switch-приём, ровно один импульс
{
  const { doc, head, log } = fakeDocument();
  const h = H.create({ navigator: {}, document: doc, setTimeout: () => {} });
  assertEqual(h.tap(), 'switch', 'tap(): без navigator.vibrate используется switch-приём');
  assertEqual(log.clicks.length, 1, 'tap(): ровно один click (один импульс на касание)');
  const label = log.clicks[0];
  assertEqual(label.tag, 'label', 'клик выполняется по <label>');
  assertEqual(label.getAttribute('aria-hidden'), 'true', '<label> скрыт от accessibility-дерева');
  assertEqual(label.style.display, 'none', '<label> визуально скрыт (display:none)');
  assertEqual(label.children.length, 1, 'внутри <label> один элемент');
  const input = label.children[0];
  assertEqual(input.tag, 'input', 'внутри <label> — <input>');
  assertEqual(input.type, 'checkbox', 'input type=checkbox');
  assertEqual(input.getAttribute('switch'), '', 'у input есть атрибут switch (нативный переключатель iOS)');
  assertEqual(log.appended.length, 1, '<label> вставлен в <head>');
  assertEqual(log.removed.length, 1, '<label> удалён из <head> после клика');
  assertEqual(head.children.length, 0, 'в <head> ничего не остаётся');
  assertTrue(log.appended[0] === label && log.removed[0] === label, 'вставлен и удалён тот же элемент');
}

// 1.2 Каждое касание — отдельный импульс (45,52 → 5 касаний → 5 импульсов)
{
  const { doc, log } = fakeDocument();
  const h = H.create({ navigator: {}, document: doc, setTimeout: () => {} });
  ['4', '5', '.', '5', '2'].forEach(() => h.tap());
  assertEqual(log.clicks.length, 5, 'пять касаний → пять импульсов, без пропусков и дублей');
}

// 1.3 success(): два импульса — второй через таймер с паузой
{
  const { doc, log } = fakeDocument();
  const timers = [];
  const h = H.create({ navigator: {}, document: doc, setTimeout: (fn, ms) => { timers.push({ fn, ms }); } });
  assertEqual(h.success(), 'switch', 'success(): без vibrate — switch-приём');
  assertEqual(log.clicks.length, 1, 'success(): первый импульс синхронно');
  assertEqual(timers.length, 1, 'success(): второй импульс запланирован таймером');
  assertTrue(timers[0].ms >= 60 && timers[0].ms <= 200, `success(): пауза между импульсами разумная (${timers[0].ms}ms)`);
  timers[0].fn();
  assertEqual(log.clicks.length, 2, 'success(): после таймера — ровно два импульса');
}

// 1.4 Android-подобная среда: есть navigator.vibrate → только он, без switch-дубля
{
  const { doc, log } = fakeDocument();
  const calls = [];
  const h = H.create({ navigator: { vibrate: p => { calls.push(p); return true; } }, document: doc, setTimeout: () => {} });
  assertEqual(h.tap(), 'vibrate', 'tap(): при наличии vibrate используется он');
  assertEqual(calls, [8], 'tap(): короткий импульс 8ms');
  assertEqual(log.clicks.length, 0, 'tap(): switch-приём не дублирует vibrate');
  assertEqual(h.success(), 'vibrate', 'success(): при наличии vibrate используется он');
  assertEqual(calls.length, 2, 'success(): один вызов vibrate с паттерном');
  assertTrue(Array.isArray(calls[1]) && calls[1].length === 3, 'success(): паттерн из двух импульсов и паузы');
  assertEqual(log.clicks.length, 0, 'success(): switch-приём не дублирует vibrate');
}

// 1.5 Среда без DOM и без vibrate — тихий no-op
{
  const h = H.create({ navigator: null, document: null, setTimeout: null });
  let threw = false;
  try { assertEqual(h.tap(), 'none', 'tap() без DOM/vibrate → none'); assertEqual(h.success(), 'none', 'success() без DOM/vibrate → none'); }
  catch (e) { threw = true; }
  assertTrue(!threw, 'без DOM/vibrate нет исключений');
  assertEqual(H.tap(), 'none', 'экземпляр по умолчанию в Node (нет DOM) — none, без исключений');
}

// 1.6 Ошибка внутри DOM не пробрасывается (отклик не должен ронять ввод)
{
  const { doc } = fakeDocument({ throwOnAppend: true });
  const h = H.create({ navigator: {}, document: doc, setTimeout: () => {} });
  let threw = false, r;
  try { r = h.tap(); } catch (e) { threw = true; }
  assertTrue(!threw, 'исключение при вставке в DOM перехвачено');
  assertEqual(r, 'none', 'при сбое DOM tap() возвращает none');
}

// 1.7 navigator.vibrate бросает → падаем на switch-приём, без исключений
{
  const { doc, log } = fakeDocument();
  const h = H.create({ navigator: { vibrate: () => { throw new Error('nope'); } }, document: doc, setTimeout: () => {} });
  let threw = false, r;
  try { r = h.tap(); } catch (e) { threw = true; }
  assertTrue(!threw, 'исключение vibrate перехвачено');
  assertEqual(r, 'switch', 'после сбоя vibrate используется switch-приём');
  assertEqual(log.clicks.length, 1, 'ровно один импульс');
}

// 1.8 Фабрика и публичный API
{
  assertEqual(typeof H.create, 'function', 'AF.Services.Haptics.create — фабрика');
  assertEqual(typeof H.tap, 'function', 'AF.Services.Haptics.tap');
  assertEqual(typeof H.success, 'function', 'AF.Services.Haptics.success');
}

// ============ §2 — статика index.html / sw.js ============

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

assertTrue(/<script src="js\/services\/haptics_service\.js"><\/script>/.test(html), 'index.html подключает haptics_service.js');
assertTrue(html.indexOf('js/services/haptics_service.js') < html.indexOf('<script>\n'), 'сервис подключён до inline-скрипта приложения');
assertTrue(/'\.\/js\/services\/haptics_service\.js'/.test(sw), 'sw.js кэширует haptics_service.js');
{
  const m = sw.match(/CACHE = 'finance-v(\d+)'/);
  assertTrue(m && +m[1] >= 174, `версия кэша sw.js поднята (finance-v${m && m[1]})`);
}

// Клавиши: pointerdown → keyPressHaptic, click → key(k) — оба на одной кнопке
assertTrue(/\$\$\('\.keypad button\[data-k\]'\)\.forEach\(b=>\{const k=b\.dataset\.k;if\(k&&k!=='back-hold'\)\{b\.onclick=\(\)=>key\(k\);b\.onpointerdown=keyPressHaptic;\}\}\);/.test(html),
  'клавиши: click → key(k), pointerdown → keyPressHaptic');
assertTrue(/\$\('#kdDone'\)\.onpointerdown=keyPressHaptic;/.test(html), '«Готово» (#kdDone) — лёгкий отклик на pointerdown');
assertTrue(/\$\('#kdDone'\)\.onclick=closeKeypad;/.test(html), '«Готово» по-прежнему закрывает клавиатуру по click');
assertTrue(/function keyPressHaptic\(e\)\{if\(e&&e\.button>0\)return;AF\.Services\.Haptics\.tap\(\);\}/.test(html),
  'keyPressHaptic: один tap(), вторичные кнопки мыши игнорируются');
assertTrue(!/\$\('#saveBtn2?'\)\.onpointerdown/.test(html), '✓ (#saveBtn) не получает tap() на pointerdown — только success() при сохранении (нет тройного отклика)');

// Нет двойного отклика: key() по click больше не вибрирует
{
  const keyFn = html.match(/function key\(k\)\{[\s\S]*?\n\}/);
  assertTrue(!!keyFn, 'функция key(k) найдена');
  assertTrue(keyFn && !/navigator\.vibrate|haptic\(|Haptics\./.test(keyFn[0]), 'key(k) по click не вызывает отклик (нет дубля с pointerdown)');
  assertTrue(keyFn && /aExpr=applyKey\(aExpr,k\);/.test(keyFn[0]) && /updateDisplay\(\);/.test(keyFn[0]), 'key(k): логика ввода (applyKey → updateDisplay) сохранена');
}
assertTrue(!/keypad[^\n]*touchstart|touchstart[^\n]*keypad/.test(html), 'touchstart на клавиатуре не используется');

// Успешное сохранение: success() строго после проверки res.ok
{
  const i = html.indexOf('if(!res.ok)return;');
  const j = html.indexOf('AF.Services.Haptics.success();');
  assertTrue(i > 0 && j > i && j - i < 400, 'success() вызывается после if(!res.ok)return в saveTx');
  assertTrue(!/haptic\(14\)/.test(html), 'старый haptic(14) при сохранении заменён');
}

// Логика ввода/расчёта не изменена
assertTrue(html.includes("function applyKey(e,k){\n  if(k==='clear')return '0';\n  if(k==='back')return e.length>1?e.slice(0,-1):'0';"), 'applyKey не изменён (clear/back)');
assertTrue(html.includes("if(k==='.'){const last=e.split(/[+\\-−×÷]/).pop();return last.includes('.')?e:e+'.';}"), 'applyKey не изменён (десятичная точка)');
assertTrue(html.includes("try{const r=Function('\"use strict\";return('+s+')')();return isFinite(r)?Math.round(r*100)/100:NaN;}"), 'evalExpr не изменён');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
