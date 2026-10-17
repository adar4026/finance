// tests/bottom_nav_compact.test.js — TASK_063: адаптивная компактная нижняя навигация.
// §1 — юнит-эмуляция: код navCompact вырезается из index.html и выполняется в vm
// с минимальной заглушкой DOM (тот же приём, что tests/bottom_nav_glass_drag.test.js §6);
// §2–§4 — статические проверки по index.html.
// Запуск: node tests/bottom_nav_compact.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const script = html.slice(html.indexOf('</style>'));

// ---------- §1. Логика направления прокрутки (vm) ----------
const start = html.indexOf('const NAV_COMPACT_TOP=');
const end = html.indexOf('})();', html.indexOf('const navCompact=')) + 5;
assertTrue(start > 0 && end > start, 'блок navCompact найден в index.html');
const code = html.slice(start, end);

function makeEnv() {
  const classes = new Set();
  const listeners = {};
  let toggles = 0;
  const nav = {
    classList: {
      contains: c => classes.has(c),
      toggle: (c, on) => { toggles++; if (on) classes.add(c); else classes.delete(c); },
    },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  };
  const drag = { active: false };
  const ctx = { $: sel => (sel === '.nav' ? nav : null), navDrag: { active: () => drag.active }, Math };
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.navCompact=navCompact;', ctx);
  const nc = ctx.navCompact;
  const sa = { scrollTop: 0, scrollHeight: 3000, clientHeight: 700 };
  const to = y => { sa.scrollTop = y; nc.onScroll(sa); };
  const scrollTo = (from, target, stepPx) => { // покадровая прокрутка (как инерция)
    const dir = target > from ? 1 : -1;
    for (let y = from; dir > 0 ? y <= target : y >= target; y += dir * stepPx) to(y);
    to(target);
  };
  return { nc, nav, sa, ctx, to, scrollTo, drag, listeners, compact: () => classes.has('compact'), toggles: () => toggles };
}

{ // 1. Начальное состояние — Expanded
  const e = makeEnv();
  assertEqual(e.compact(), false, '1. старт: Expanded (класса compact нет)');
  assertEqual(e.nc._state.compact, false, '1. старт: состояние Expanded');
  assertTrue(!/<div class="nav[^"]*compact/.test(html), '1. разметка .nav без compact');
}
{ // 2. Прокрутка вниз — Compact; 3. вверх — Expanded
  const e = makeEnv();
  e.scrollTo(0, 400, 6);
  assertEqual(e.compact(), true, '2. устойчивая прокрутка вниз → Compact');
  e.scrollTo(400, 370, 6);
  assertEqual(e.compact(), false, '3. устойчивая прокрутка вверх (≥12px) → Expanded');
  e.scrollTo(370, 600, 4);
  assertEqual(e.compact(), true, '2. снова вниз → Compact');
  e.to(600);
  assertEqual(e.compact(), true, 'нет движения (dy=0) → состояние не меняется');
}
{ // 4. Возврат к верхней границе — Expanded
  const e = makeEnv();
  e.scrollTo(0, 500, 10);
  assertEqual(e.compact(), true, '4. подготовка: Compact');
  e.to(20); // резкий скачок к верху (напр. тап по статус-бару)
  assertEqual(e.compact(), false, '4. у верхней границы (≤24px) → Expanded');
  const f = makeEnv();
  f.scrollTo(0, 50, 10);
  assertEqual(f.compact(), false, 'Compact не включается, пока контент не ушёл под шапку (≤56px)');
}
{ // 5. Незначительные колебания не переключают
  const e = makeEnv();
  e.scrollTo(0, 300, 10);
  assertEqual(e.compact(), true, '5. подготовка: Compact');
  const before = e.toggles();
  for (let i = 0; i < 40; i++) e.to(300 + (i % 2 ? -5 : 5)); // дрожание ±5px
  assertEqual(e.compact(), true, '5. дрожание ±5px в Compact — без переключений');
  assertEqual(e.toggles(), before, '5. дрожание — класс не трогается');
  const g = makeEnv();
  g.to(200); g.to(100); // в Expanded на глубине: сначала устанавливаем позицию
  for (let i = 0; i < 40; i++) g.to(100 + (i % 2 ? 7 : 0)); // 0/7/0/7 — смена направления сбрасывает накопление
  assertEqual(g.compact(), false, '5. колебания 7px в Expanded — гистерезис не даёт Compact');
  const h = makeEnv();
  h.to(200); h.to(100); h.to(106); h.to(111);
  assertEqual(h.compact(), false, '5. 11px вниз — ниже порога 12px');
  h.to(112);
  assertEqual(h.compact(), true, '5. 12px вниз — порог достигнут');
}
{ // rubber-band iOS и пустой экран
  const e = makeEnv(); // max = 2300
  e.scrollTo(0, 2300, 20);
  assertEqual(e.compact(), true, 'конец списка: Compact');
  e.to(2360); e.to(2330); e.to(2300); // отскок за нижнюю границу
  assertEqual(e.compact(), true, 'rubber-band у нижнего края не раскрывает панель');
  const f = makeEnv();
  f.sa.scrollHeight = 700; // прокручивать нечего
  f.to(0); f.to(40);
  assertEqual(f.compact(), false, 'нет прокручиваемого содержимого → всегда Expanded');
  const g = makeEnv();
  g.scrollTo(0, 400, 10);
  g.sa.scrollHeight = 600; g.to(0); // контент сжался (другой период) — max ≤ 0
  assertEqual(g.compact(), false, 'контент стал короче экрана → Expanded');
}
{ // 6. Переключение вкладок, drag, клавиатура
  const e = makeEnv();
  e.scrollTo(0, 400, 10);
  e.nc.expand();
  assertEqual(e.compact(), false, '6. expand() (смена вкладки) → Expanded');
  e.scrollTo(400, 600, 10);
  assertEqual(e.compact(), true, '6. после смены вкладки прокрутка вниз снова даёт Compact');
  e.drag.active = true;
  e.scrollTo(600, 500, 10);
  assertEqual(e.compact(), true, '6. во время drag pill состояние не меняется');
  e.drag.active = false;
  e.nc.init();
  assertEqual((e.listeners.focusin || []).length, 1, 'фокус в капсуле — один обработчик focusin');
  e.listeners.focusin[0]();
  assertEqual(e.compact(), false, 'фокус клавиатуры в капсуле → Expanded (подписи видны)');
  const t = e.toggles();
  e.nc.expand();
  assertEqual(e.toggles(), t, 'повторный expand() не трогает класс');
  assertTrue(/moveNavIndicator\(\);\n\s*navCompact\.expand\(\);/.test(html), '6. showScreen() вызывает navCompact.expand()');
  // 11. смена вкладки сбрасывает точку отсчёта: позиция другого экрана не даёт ложного направления
  const k = makeEnv();
  k.scrollTo(0, 400, 10);
  k.ctx.$ = sel => (sel === '.nav' ? k.nav : sel === '#scrollArea' ? k.sa : null);
  k.sa.scrollTop = 900; k.nc.expand();           // переключились на экран, где позиция другая
  assertEqual(k.nc._state.lastY, 900, '11. expand() берёт текущую позицию #scrollArea как точку отсчёта');
  k.to(905);
  assertEqual(k.compact(), false, '11. после смены вкладки 5px вниз — без ложного Compact (скачок позиции не засчитан)');
  assertTrue(/navCompact\.init\(\);/.test(script), 'navCompact.init() вызывается при запуске');
}

{ // 13. Сдвиг scrollTop из-за перерисовки (scroll anchoring) — не жест пользователя
  // Воспроизведено в Dev Preview: смена вкладки в Compact → showScreen → expand() (lastY=330) →
  // render() нового экрана: scrollHeight 1611→1945, браузер сдвинул scrollTop 330→382 → прежде +52px
  // засчитывались как прокрутка вниз и панель снова сворачивалась через 23ms.
  const e = makeEnv();
  e.scrollTo(0, 330, 10);
  assertEqual(e.compact(), true, '13. подготовка: Compact');
  e.ctx.$ = sel => (sel === '.nav' ? e.nav : sel === '#scrollArea' ? e.sa : null);
  e.nc.expand();                                  // showScreen()
  e.sa.scrollHeight = 2645;                       // новый экран длиннее
  e.to(382);                                      // anchoring: +52px без участия пользователя
  assertEqual(e.compact(), false, '13. смена вкладки + scroll anchoring (+52px, другая высота) — панель остаётся Expanded');
  e.scrollTo(382, 420, 6);
  assertEqual(e.compact(), true, '13. дальше обычная прокрутка вниз на новом экране → Compact');
  const f = makeEnv();
  f.scrollTo(0, 600, 10);
  f.sa.scrollHeight = 3200; f.to(560);            // контент над позицией изменился, -40px
  assertEqual(f.compact(), true, '13. сдвиг вверх при изменении высоты контента не раскрывает панель');
  f.to(550);
  assertEqual(f.compact(), true, '13. после перерисовки отсчёт от новой точки: 10px вверх — ниже порога');
  f.to(545);
  assertEqual(f.compact(), false, '13. ещё 5px вверх (итого 15px от новой точки) → Expanded');
}

{ // 14. Высота изменилась БЕЗ scroll-события — первое реальное движение не теряется (resync)
  // Воспроизведено в Dev Preview (390): «Все записи» у верха (последнее событие: max 3236) → «Главная»
  // (scrollTop 0 → 0, события нет, реальный max 902) → прокрутка вниз одним событием на 450px
  // принималась за relayout (902 ≠ 3236) и не сворачивала панель; свернулось лишь на втором событии.
  const mk = () => {
    const e = makeEnv();
    const ro = { cb: null, observed: [] };
    e.sa.children = [{ id: 'subhead' }, { id: 'scrRecords' }, { id: 'scrJournal' }];
    e.ctx.$ = sel => (sel === '.nav' ? e.nav : sel === '#scrollArea' ? e.sa : null);
    e.ctx.ResizeObserver = function (cb) { ro.cb = cb; this.observe = el => ro.observed.push(el); };
    e.ctx.Array = Array;
    return { e, ro };
  };
  { // без resync — демонстрация причины: устаревший lastMax глотает первый жест
    const { e } = mk();
    e.sa.scrollHeight = 3936; e.to(300); e.to(0);   // «Все записи»: max 3236
    e.sa.scrollHeight = 1602; e.nc.expand();         // «Главная»: max 902, scroll-события нет
    e.to(450);
    assertEqual(e.compact(), false, '14. причина: без resync первое движение на новой высоте засчитано как relayout');
  }
  { // с ResizeObserver
    const { e, ro } = mk();
    e.nc.init();
    assertTrue(typeof ro.cb === 'function', '14. init() создаёт ResizeObserver');
    assertEqual(ro.observed.length, 1 + e.sa.children.length, '14. наблюдаются #scrollArea и его блоки (.subhead, экраны)');
    assertEqual(ro.observed[0], e.sa, '14. наблюдается сама #scrollArea (высота viewport)');
    e.sa.scrollHeight = 3936; e.to(300); e.to(0);
    e.sa.scrollHeight = 1602; e.nc.expand(); ro.cb();  // layout нового экрана → resync
    assertEqual(e.nc._state.lastMax, 902, '14. resync: точка отсчёта по новой прокручиваемой высоте');
    e.to(450);
    assertEqual(e.compact(), true, '14. первая прокрутка вниз после смены экрана (одним событием) → Compact');
  }
  { // anchoring после resync: layout уже сдвинул scrollTop — scroll-событие приходит с dy = 0
    const { e, ro } = mk();
    e.nc.init();
    e.scrollTo(0, 330, 10);
    assertEqual(e.compact(), true, '14. подготовка: Compact');
    e.nc.expand();
    e.sa.scrollHeight = 2645; e.sa.scrollTop = 382; ro.cb(); // render + anchoring + ResizeObserver
    e.to(382);
    assertEqual(e.compact(), false, '14. сдвиг scroll anchoring после resync — панель остаётся Expanded');
    e.scrollTo(382, 420, 6);
    assertEqual(e.compact(), true, '14. дальше обычная прокрутка вниз → Compact');
  }
  { // свежая загрузка: высота выросла после init (рендер/шрифты) без scroll-события
    const { e, ro } = mk();
    e.sa.scrollHeight = 700; e.nc.init(); e.to(0);    // при запуске прокручивать нечего
    e.sa.scrollHeight = 1602; ro.cb();                // контент дорисовался
    e.to(300);
    assertEqual(e.compact(), true, '14. свежая загрузка: первая прокрутка вниз одним событием → Compact');
    e.to(280);
    assertEqual(e.compact(), false, '14. первая прокрутка вверх (20px) → Expanded');
  }
  { // resync не сбрасывает накопление жеста и не трогает класс
    const { e, ro } = mk();
    e.nc.init();
    e.to(200); e.to(100); e.to(106);
    const t = e.toggles();
    ro.cb();
    assertEqual(e.nc._state.acc, 6, '14. resync сохраняет накопленное движение');
    assertEqual(e.toggles(), t, '14. resync не переключает состояние');
    e.to(112);
    assertEqual(e.compact(), true, '14. жест продолжается после resync (6 + 6 = 12px) → Compact');
  }
  { // без ResizeObserver (старые браузеры) — init() не падает
    const e = makeEnv();
    e.ctx.$ = sel => (sel === '.nav' ? e.nav : sel === '#scrollArea' ? e.sa : null);
    let ok = true; try { e.nc.init(); } catch (_) { ok = false; }
    assertTrue(ok, '14. без ResizeObserver init() работает (только focusin)');
  }
  assertTrue(!/addEventListener\('scroll'/.test(code) && /new ResizeObserver\(resync\)/.test(code),
    '14. resync — ResizeObserver, не дополнительный scroll-слушатель');
}

// ---------- §2. Единственный scroll-обработчик ----------
{
  const scrollListeners = script.match(/addEventListener\('scroll'/g) || [];
  assertEqual(scrollListeners.length, 2, '8. в приложении два scroll-слушателя: #scrollArea и visualViewport (как до TASK_063)');
  assertTrue(!/addEventListener\('scroll'/.test(code), '8. navCompact не вешает свой scroll-слушатель');
  assertTrue(/const sync=\(\)=>\{tb\.classList\.toggle\('scrolled',\(sa\.scrollTop\|\|0\)>4\);navCompact\.onScroll\(sa\);\}/.test(script),
    '8. compact ведёт существующий обработчик #scrollArea');
  assertTrue(/sa\.addEventListener\('scroll',sync,\{passive:true\}\)/.test(script), '8. обработчик passive');
}

// ---------- §3. CSS компактного состояния ----------
const block = (() => {
  const s = css.indexOf('/* ===== TASK_063:');
  const e = css.indexOf('.drawer{', s);
  return s > 0 && e > s ? css.slice(s, e) : '';
})();
{
  assertTrue(!!block, 'CSS-блок TASK_063 найден');
  assertTrue(/--navh-compact:54px;/.test(css), 'токен --navh-compact 54px');
  assertTrue(/\.nav\.compact\{height:var\(--navh-compact\);padding-top:4px;padding-bottom:4px;/.test(block),
    'Compact: высота 54px, вертикальный padding 4px');
  assertTrue(!/\.nav\.compact\{[^}]*padding-(left|right)/.test(block) && !/\.nav\.compact\{[^}]*padding:/.test(block),
    'горизонтальный padding 7px не меняется (геометрия navDrag)');
  // 7. Все пять вкладок доступны: ничего не скрывается и не отключается
  assertTrue(!/\.nav\.compact[^{]*button[^{]*\{[^}]*(display:none|visibility:hidden|pointer-events:none)/.test(block),
    '7. в Compact вкладки не скрываются и не отключаются');
  assertTrue(/\.nav\.compact button \.lb\{opacity:0;max-height:0\}/.test(block), '7. подписи уходят плавно (opacity + max-height)');
  assertEqual(54 - 4 * 2 - 2, 44, '7. область нажатия в Compact — 44px по высоте (54 − padding 2×4 − контур 2×1), ширина ≥56px на 320px');
  assertTrue(/\.nav\.compact \.nav-indicator\{top:4px;bottom:4px\}/.test(block), 'pill следует за высотой капсулы');
  assertTrue(/\.nav\.compact button \.ic svg\{transform:scale\(\.92\)\}/.test(block), 'иконка уменьшается через transform');
  assertTrue(/height \.22s/.test(block) && /\.lb\{max-height:16px;transition:opacity \.16s/.test(block), 'анимация ≈220ms');
  // 9. Обе темы: compact не трогает материал/цвета — их задают токены TASK_062
  assertTrue(!/\.compact[^{]*\{[^}]*(background|border-color|color:|box-shadow|backdrop-filter)/.test(block),
    '9. Compact не меняет стекло/цвета — светлая и тёмная темы из токенов TASK_062');
  // Сужение внешней капсулы: left/right симметрично уходят к центру
  assertTrue(/--nav-compact-tab:50px;/.test(css), 'ширина вкладки в Compact — токен --nav-compact-tab 50px');
  assertTrue(/--nav-compact-w:calc\(var\(--nav-count,5\) \* var\(--nav-compact-tab\) \+ 16px\);/.test(css),
    'ширина Compact считается по содержимому: число вкладок × вкладка + padding/контур (не жёсткая константа)');
  assertTrue(/--nav-compact-inset:max\(12px,calc\(50% - var\(--nav-compact-w\) \/ 2\)\);/.test(css),
    'боковой отступ Compact — центрирование, минимум 12px от края');
  assertTrue(/\.nav\.compact\{[^}]*left:var\(--nav-compact-inset\);right:var\(--nav-compact-inset\)\}/.test(block),
    'Compact: внешняя граница капсулы движется внутрь с обеих сторон (left/right)');
  assertTrue(/left \.24s/.test(block) && /right \.24s/.test(block), 'сужение анимируется (left/right .24s)');
  // 10. 320px: капсула 264px помещается с отступами ≥12px; вкладки ≥44px шириной
  const W = 5 * 50 + 16, inner = W - 7 * 2 - 2;
  assertTrue(W <= 320 - 2 * 12, '10. на 320px компактная капсула помещается в экран с отступами ≥12px');
  assertTrue(inner / 5 >= 44, `10. вкладка в Compact ≥44px шириной (${(inner / 5).toFixed(1)}px)`);
  // pill и колонки — в % от капсулы, без пиксельных констант (подстраиваются под ширину)
  assertTrue(/\.nav-indicator\{position:absolute;top:7px;bottom:7px;left:7px;z-index:0;\s*width:calc\(\(100% - 14px\) \/ var\(--nav-count,5\)\)/.test(css),
    'ширина pill — доля ширины капсулы (адаптируется к Compact)');
  assertTrue(/grid-template-columns:repeat\(var\(--nav-count,5\),minmax\(0,1fr\)\)/.test(css), 'пять равных колонок grid — сужаются вместе с капсулой');
  // drag: геометрия читается на каждом pointerdown — сужение не ломает жест
  const drag = html.slice(html.indexOf('const navDrag=(()=>{'), html.indexOf('const NAV_COMPACT_TOP='));
  assertTrue(/getBoundingClientRect\(\)/.test(drag), 'navDrag читает геометрию капсулы при жесте (не кэширует при загрузке)');
  // «＋» не участвует в анимации капсулы (TASK_063: перенесена к заголовку «Записи», §4)
  assertTrue(!/nav-add|list-add|addBtn/.test(block.replace(/\/\*[\s\S]*?\*\//g, '')),
    'CSS компактной навигации не затрагивает кнопку «＋»');
  assertTrue(/@media \(prefers-reduced-motion: reduce\)\{\s*\.nav,\.nav button \.lb,\.nav button \.ic svg\{transition:none\}/.test(block),
    'prefers-reduced-motion — без анимации');
  assertTrue(/\.scroll-area\{[^}]*padding-bottom:calc\(var\(--navh\) \+ env\(safe-area-inset-bottom\) \+ 26px\)/.test(css),
    'резерв контента рассчитан на полную высоту — последняя строка не перекрывается');
}

// ---------- §4. Кнопка «＋» у заголовка «Записи» (TASK_063) ----------
{
  const home = html.slice(html.indexOf('<div class="screen immersive active" id="scrRecords">') >= 0
    ? html.indexOf('id="scrRecords"') : html.indexOf('id="scrRecords"'), html.indexOf('<!-- Screen: Analytics'));
  assertTrue(home.length > 0, 'блок #scrRecords найден');
  assertTrue(/<div class="home-list-head list-head-add"><span>Записи<\/span><button class="list-add" id="addBtn" type="button" aria-label="Добавить операцию"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"\/><\/svg><\/button><\/div>\s*<div id="recentList"><\/div>/.test(home),
    '«＋» справа от заголовка «Записи» на Главной (одна строка, перед #recentList), доступное имя «Добавить операцию»');
  assertEqual((html.match(/id="addBtn"/g) || []).length, 1, 'кнопка «＋» одна (id="addBtn")');
  assertTrue(!/nav-add/.test(html), 'старой floating-кнопки у капсулы (.nav-add) нет — ни в разметке, ни в CSS, ни в токенах');
  const navHtml = html.slice(html.indexOf('<div class="nav" role="navigation"'), html.indexOf('<!-- Add / edit page'));
  assertTrue(!/addBtn|list-add/.test(navHtml), '«＋» не в капсуле и не рядом с ней');
  assertTrue(!/class="list-add"[^>]*>/.test(html.slice(html.indexOf('id="scrJournal"'))), 'в «Все записи» и других разделах «＋» не дублируется');
  // обработчик — прежний openSheet(null), один, без повторного вызова при уже открытой форме
  const handlers = script.match(/\$\('#addBtn'\)\.(onclick|addEventListener)/g) || [];
  assertEqual(handlers.length, 1, 'один обработчик #addBtn');
  assertTrue(/\$\('#addBtn'\)\.onclick=\(\)=>\{if\(!\$\('#overlay'\)\.classList\.contains\('show'\)\)openSheet\(null\);\};/.test(script),
    'нажатие открывает существующую форму openSheet(null); при открытой форме — no-op (без второго pushState)');
  assertEqual((script.replace(/<!--[\s\S]*?-->/g, '').match(/openSheet\(null\)/g) || []).length, 1, 'новых путей добавления операции нет');
  // CSS: строка заголовка, круглая кнопка 44px, сдержанный синий, независима от навигации
  const head = (css.match(/\.home-list-head\.list-head-add\{([^}]*)\}/) || [])[1] || '';
  assertTrue(/display:flex;align-items:center;justify-content:space-between/.test(head), 'заголовок и «＋» на одной линии, по центру по вертикали, кнопка справа');
  assertTrue(/\.list-head-add>span\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/.test(css),
    'на узком экране сжимается заголовок (многоточие), а не кнопка — без перекрытия и переполнения');
  const btn = (css.match(/\.list-add\{(flex:none[^}]*)\}/) || [])[1] || '';
  assertTrue(!!btn, '.list-add — основное правило найдено');
  assertTrue(/flex:none;width:44px;height:44px;border-radius:50%/.test(btn), 'круглая кнопка 44×44 (область нажатия), не сжимается');
  assertTrue(!/position:(fixed|absolute|sticky)/.test(btn), '«＋» в потоке заголовка, не закреплена у навигации');
  assertTrue(!/--nav(h|-bottom|-compact)/.test(btn), '«＋» не зависит от высоты/ширины навигации');
  assertTrue(/background:var\(--list-add-bg\);border:1px solid var\(--list-add-border\);box-shadow:var\(--list-add-shadow\)/.test(btn), 'цвет/граница/тень — токены');
  assertTrue(/color:#fff/.test(btn) && /touch-action:manipulation/.test(btn), 'белый плюс; без задержки double-tap zoom');
  // стекло по референсу Revolut: полупрозрачная голубая поверхность + размытие фона, без плотной заливки
  assertTrue(/-webkit-backdrop-filter:blur\(var\(--list-add-blur\)\) saturate\(160%\);\s*backdrop-filter:blur\(var\(--list-add-blur\)\) saturate\(160%\)/.test(btn),
    'стекло: backdrop-filter (оба префикса)');
  assertTrue(!/linear-gradient|radial-gradient/.test(btn) && !/linear-gradient/.test((css.match(/--list-add-bg:[^;]*;/g) || []).join('')),
    'без внутреннего градиента — ровная полупрозрачная поверхность');
  const lightBg = (css.match(/--list-add-bg:rgba\((\d+),(\d+),(\d+),(\.\d+)\)/) || []);
  assertTrue(lightBg.length === 5 && +lightBg[4] < 1 && +lightBg[3] > +lightBg[1], 'светлая тема: полупрозрачная голубая поверхность (alpha < 1, синий канал доминирует)');
  assertTrue(+lightBg[4] >= 0.7, 'светлая тема: плотность ≥ .7 — белый плюс ≥ 3:1 на светлом фоне Главной (замер: 3.14:1)');
  const darkBg = (css.match(/--list-add-bg:rgba\((\d+),(\d+),(\d+),(\.\d+)\)/g) || [])[1] || '';
  assertTrue(/rgba\(110,160,255,\.28\)/.test(darkBg), 'тёмная тема: светлое прозрачное стекло (без неона)');
  assertTrue(!/0 0 \d+px rgba\([^)]*\)(?!.*inset)/.test((css.match(/--list-add-shadow:[^;]*;/g) || []).join('')),
    'без свечения: только мягкая тень снизу и внутренний блик');
  assertTrue(/\.list-add:active\{transform:scale\(\.96\)\}/.test(css), 'нажатие — scale(.96)');
  assertTrue(/@media \(hover:hover\) and \(pointer:fine\)\{\.list-add:hover\{background:var\(--list-add-bg-hover\)\}\}/.test(css),
    'hover — только на устройствах с указателем, лёгкое уплотнение стекла');
  assertTrue(/@supports not \(\(backdrop-filter:blur\(1px\)\) or \(-webkit-backdrop-filter:blur\(1px\)\)\)\{\s*\.list-add\{background:var\(--list-add-bg-solid\)\}\s*\}/.test(css),
    'fallback без backdrop-filter — плотная поверхность --list-add-bg-solid');
  assertTrue(/\.list-add:focus-visible\{outline:2px solid var\(--nav-active\)/.test(css), 'focus для клавиатуры');
  assertTrue(/@media \(prefers-reduced-motion: reduce\)\{\.list-add\{transition:none\}\.list-add:active\{transform:none\}\}/.test(css),
    'prefers-reduced-motion — без анимации и масштаба нажатия');
  ['--list-add-bg', '--list-add-bg-hover', '--list-add-bg-solid', '--list-add-border', '--list-add-shadow', '--list-add-blur'].forEach(t =>
    assertEqual((css.match(new RegExp(`${t}:`, 'g')) || []).length, 2, `${t} задан для светлой и тёмной темы`));
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
