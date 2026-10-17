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

// ---------- §1. Прогресс сжатия (vm) ----------
const start = html.indexOf('const NAV_COMPACT_TOP=');
const end = html.indexOf('})();', html.indexOf('const navCompact=')) + 5;
assertTrue(start > 0 && end > start, 'блок navCompact найден в index.html');
const code = html.slice(start, end);
const RANGE = +(code.match(/const NAV_COMPACT_RANGE=(\d+)/) || [])[1];
const MAXSTEP = +(code.match(/const NAV_COMPACT_MAXSTEP=([\d.]+)/) || [])[1];
assertEqual(RANGE, 90, 'NAV_COMPACT_RANGE — 90px прокрутки на полный ход прогресса');
assertTrue(MAXSTEP > 0 && MAXSTEP < 1, 'NAV_COMPACT_MAXSTEP — доля прогресса за кадр');

// Заглушка DOM: капсула хранит записанные значения --nav-p, rAF-кадры прокручиваются вручную
// (тот же приём, что tests/bottom_nav_glass_drag.test.js §6).
function makeEnv(opts) {
  const o = opts || {};
  const listeners = {};
  const writes = [];
  const nav = {
    style: { setProperty: (k, v) => { if (k === '--nav-p') writes.push(v); } },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  };
  const drag = { active: false };
  const frames = [];
  const ctx = {
    $: sel => (sel === '.nav' ? nav : null),
    navDrag: { active: () => drag.active },
    Math,
    requestAnimationFrame: o.noRaf ? undefined : fn => { frames.push(fn); return frames.length; },
    matchMedia: q => ({ matches: !!o.reduce && /reduced-motion/.test(q) }),
  };
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.navCompact=navCompact;', ctx);
  const nc = ctx.navCompact;
  const sa = { scrollTop: 0, scrollHeight: 3000, clientHeight: 700 };
  const to = y => { sa.scrollTop = y; nc.onScroll(sa); };
  const scrollBy = (dy, times) => { for (let i = 0; i < times; i++) to(sa.scrollTop + dy); };
  // прокрутить запланированные кадры догонки (каждый может запланировать следующий)
  const runFrames = (limit) => {
    let n = 0;
    while (frames.length && n < (limit || 200)) { const f = frames.shift(); f(); n++; }
    return n;
  };
  const shown = () => (writes.length ? +writes[writes.length - 1] : 0);
  return { nc, nav, sa, ctx, to, scrollBy, runFrames, frames, writes, drag, listeners,
    shown, target: () => nc._state.p };
}

{ // 1. Старт: капсула полная, прогресс 0
  const e = makeEnv();
  assertEqual(e.target(), 0, '1. старт: прогресс 0 (полная капсула)');
  assertTrue(!/--nav-p\s*:\s*[^0]/.test(html.slice(html.indexOf('<div class="nav" role'), html.indexOf('<!-- Add / edit page'))),
    '1. разметка .nav без инлайнового прогресса');
  assertTrue(!/\.nav\.compact|classList\.toggle\('compact'/.test(html), '1. отдельного состояния .compact больше нет');
}
{ // 2. Прокрутка вниз — непрерывное сжатие ровно по пройденным пикселям
  const e = makeEnv();
  e.to(60); e.runFrames();
  assertEqual(+e.target().toFixed(3), +(4 / RANGE).toFixed(3), '2. первые 56px (под шапкой) не сжимают, далее 1:1');
  e.to(60 + RANGE / 2); e.runFrames();
  assertTrue(Math.abs(e.target() - (4 / RANGE + 0.5)) < 1e-9, '2. половина диапазона — половина прогресса');
  e.to(60 + RANGE * 2); e.runFrames();
  assertEqual(e.target(), 1, '2. дальше прогресс упирается в 1 (компактная капсула)');
  const w = e.writes.length;
  e.to(60 + RANGE * 3); e.runFrames();
  assertEqual(e.target(), 1, '2. прокрутка вниз в компактном состоянии ничего не меняет');
  assertTrue(e.writes.length - w <= 1, '2. лишних записей в DOM нет');
}
{ // 3. Прокрутка вверх — такое же непрерывное раскрытие
  const e = makeEnv();
  e.to(400); e.runFrames();
  assertEqual(e.target(), 1, '3. подготовка: капсула сжата');
  e.to(400 - RANGE / 4); e.runFrames();
  assertTrue(Math.abs(e.target() - 0.75) < 1e-9, '3. четверть диапазона вверх — прогресс .75');
  e.to(400 - RANGE); e.runFrames();
  assertEqual(e.target(), 0, '3. полный диапазон вверх — капсула снова полная');
  e.to(400 - RANGE * 2); e.runFrames();
  assertEqual(e.target(), 0, '3. дальше вверх — прогресс не уходит ниже 0');
}
{ // 4. Жест ведёт сжатие: короткое движение — частичное, без доводки до края
  const e = makeEnv();
  e.to(100); e.runFrames();                       // 44px сверх NAV_COMPACT_MIN
  const p = e.target();
  assertTrue(p > 0.4 && p < 0.6, `4. короткий жест даёт частичное сжатие (${p.toFixed(2)})`);
  assertEqual(e.frames.length, 0, '4. после жеста нечего доводить — кадры не запланированы');
  const shown = e.shown();
  e.runFrames();
  assertEqual(e.shown(), shown, '4. в покое капсула сама не доезжает ни к полной, ни к компактной');
}
{ // 5. Смена направления разворачивает сжатие сразу, без доигрывания старого перехода
  const e = makeEnv();
  e.to(60); e.scrollBy(9, 5); e.runFrames();      // вниз до ~.5
  const mid = e.target();
  assertTrue(mid > 0.4 && mid < 0.6, '5. подготовка: середина хода');
  e.to(e.sa.scrollTop - 9); e.runFrames();
  assertTrue(Math.abs(e.target() - (mid - 9 / RANGE)) < 1e-9, '5. первый же кадр вверх уменьшает прогресс ровно на пройденное');
  assertEqual(e.shown(), Math.round(e.target() * 1000) / 1000, '5. нарисованное значение совпадает с целью — задержки нет');
}
{ // 6. Микродвижения: микроизменение прогресса, переключаться нечему
  const e = makeEnv();
  e.to(200); e.runFrames();
  const base = e.target();
  for (let i = 0; i < 40; i++) { e.to(200 + (i % 2 ? 4 : 0)); e.runFrames(); }
  assertTrue(Math.abs(e.target() - base) <= 4 / RANGE + 1e-9, '6. дребезг ±4px меняет прогресс не больше чем на 4px хода');
  assertTrue(4 / RANGE < 0.05, '6. это <5% хода (≈1px ширины) — мерцания состояний нет');
}
{ // 7. Крупный скачок (wheel/PageDown) — догоняется за кадры, без телепортации
  const e = makeEnv();
  e.to(600);
  assertEqual(e.target(), 1, '7. цель — полностью сжатая капсула');
  assertTrue(e.shown() <= MAXSTEP + 1e-9, '7. за первый кадр нарисован только шаг');
  assertTrue(e.frames.length > 0, '7. запланирована догонка');
  const n = e.runFrames();
  assertEqual(e.shown(), 1, '7. догонка доходит до цели');
  assertTrue(n >= 1 / MAXSTEP - 2 && n <= 1 / MAXSTEP + 2, `7. полный ход ≈ ${Math.round(1 / MAXSTEP)} кадров (${n})`);
  const seq = e.writes.map(Number);
  for (let i = 1; i < seq.length; i++)
    assertTrue(seq[i] - seq[i - 1] <= MAXSTEP + 1e-9, '7. ни один кадр не прыгает больше шага');
}
{ // 8. Обычный жест пальцем идёт один в один, без догонки и задержки
  const e = makeEnv();
  e.to(60);
  for (let i = 0; i < 8; i++) {
    e.to(e.sa.scrollTop + 10);
    assertEqual(e.shown(), +e.target().toFixed(3), '8. 10px за кадр — нарисовано сразу, без промежуточных кадров');
    assertEqual(e.frames.length, 0, '8. догонка не планируется');
  }
}
{ // 9. Верхняя граница и пустой экран — всегда полная капсула
  const e = makeEnv();
  e.to(400); e.runFrames();
  e.to(20); e.runFrames();
  assertEqual(e.target(), 0, '9. у верхней границы (≤24px) — полная капсула');
  const f = makeEnv();
  f.sa.scrollHeight = 700;                        // прокручивать нечего
  f.to(0); f.to(40); f.runFrames();
  assertEqual(f.target(), 0, '9. нет прокручиваемого содержимого — полная капсула');
  const g = makeEnv();
  g.to(400); g.runFrames();
  g.sa.scrollHeight = 600; g.to(0); g.runFrames(); // контент стал короче экрана
  assertEqual(g.target(), 0, '9. контент короче экрана — капсула раскрывается');
}
{ // 10. Rubber-band iOS у краёв не трогает прогресс
  const e = makeEnv();                            // max = 2300
  e.to(2300); e.runFrames();
  assertEqual(e.target(), 1, '10. конец списка: капсула сжата');
  const p = e.target();
  e.to(2360); e.to(2330); e.to(2300); e.runFrames();
  assertEqual(e.target(), p, '10. отскок за нижнюю границу ничего не меняет (позиция зажата в [0,max])');
}
{ // 11. Смена вкладки, drag, клавиатура
  const e = makeEnv();
  e.ctx.$ = sel => (sel === '.nav' ? e.nav : sel === '#scrollArea' ? e.sa : null);
  e.to(400); e.runFrames();
  e.nc.expand();
  assertEqual(e.target(), 0, '11. expand() (смена вкладки) — цель «полная капсула»');
  const n = e.runFrames();
  assertEqual(e.shown(), 0, '11. раскрытие доезжает до конца');
  assertTrue(n > 1, `11. раскрытие анимируется кадрами, а не телепортируется (${n})`);
  e.to(600); e.runFrames();
  assertEqual(e.target(), 1, '11. после смены вкладки прокрутка вниз снова сжимает');
  e.drag.active = true;
  const during = e.target();
  e.to(500); e.runFrames();
  assertEqual(e.target(), during, '11. во время drag pill прогресс не меняется');
  e.drag.active = false;
  e.nc.init();
  assertEqual((e.listeners.focusin || []).length, 1, '11. фокус в капсуле — один обработчик focusin');
  e.listeners.focusin[0](); e.runFrames();
  assertEqual(e.target(), 0, '11. фокус клавиатуры в капсуле — капсула полная (подписи видны)');
  const w = e.writes.length;
  e.nc.expand(); e.runFrames();
  assertEqual(e.writes.length, w, '11. повторный expand() ничего не пишет');
  assertTrue(/moveNavIndicator\(\);\n\s*navCompact\.expand\(\);/.test(html), '11. showScreen() вызывает navCompact.expand()');
  assertTrue(/navCompact\.init\(\);/.test(script), 'navCompact.init() вызывается при запуске');
  // позиция другого экрана не даёт ложного движения
  const k = makeEnv();
  k.ctx.$ = sel => (sel === '.nav' ? k.nav : sel === '#scrollArea' ? k.sa : null);
  k.to(400); k.runFrames();
  k.sa.scrollTop = 900; k.nc.expand(); k.runFrames();
  assertEqual(k.nc._state.lastY, 900, '11. expand() берёт текущую позицию #scrollArea как точку отсчёта');
  k.to(905); k.runFrames();
  assertTrue(Math.abs(k.target() - 5 / RANGE) < 1e-9, '11. после смены вкладки считается только реальное движение (5px), а не скачок позиции');
}
{ // 12. Сдвиг scrollTop из-за перерисовки (scroll anchoring) — не жест пользователя
  // Воспроизведено в Dev Preview: смена вкладки в сжатом состоянии → showScreen → expand() →
  // render() нового экрана: scrollHeight 1611→1945, браузер сдвинул scrollTop 330→382 → прежде
  // +52px засчитывались как прокрутка вниз и капсула снова сжималась через 23ms.
  const e = makeEnv();
  e.ctx.$ = sel => (sel === '.nav' ? e.nav : sel === '#scrollArea' ? e.sa : null);
  e.to(330); e.runFrames();
  assertEqual(e.target(), 1, '12. подготовка: капсула сжата');
  e.nc.expand(); e.runFrames();                   // showScreen()
  e.sa.scrollHeight = 2645;                       // новый экран длиннее
  e.to(382); e.runFrames();                       // anchoring: +52px без участия пользователя
  assertEqual(e.target(), 0, '12. смена вкладки + scroll anchoring — капсула остаётся полной');
  e.to(382 + 30); e.runFrames();
  assertTrue(Math.abs(e.target() - 30 / RANGE) < 1e-9, '12. дальше обычная прокрутка считается с нуля');
  const f = makeEnv();
  f.to(600); f.runFrames();
  f.sa.scrollHeight = 3200; f.to(560); f.runFrames();  // высота изменилась, −40px
  assertEqual(f.target(), 1, '12. сдвиг вверх при изменении высоты контента не раскрывает капсулу');
  f.to(560 - RANGE / 2); f.runFrames();
  assertTrue(Math.abs(f.target() - 0.5) < 1e-9, '12. после перерисовки отсчёт идёт от новой точки');
}
{ // 13. Высота изменилась БЕЗ scroll-события — первое реальное движение не теряется (resync)
  // Воспроизведено в Dev Preview (390): «Все записи» у верха (последнее событие: max 3236) →
  // «Главная» (scrollTop 0 → 0, события нет, реальный max 902) → прокрутка вниз одним событием
  // принималась за relayout и не сжимала капсулу.
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
    e.sa.scrollHeight = 3936; e.to(300); e.to(0); e.runFrames();   // «Все записи»: max 3236
    e.sa.scrollHeight = 1602; e.nc.expand(); e.runFrames();        // «Главная»: max 902, события нет
    e.to(450); e.runFrames();
    assertEqual(e.target(), 0, '13. причина: без resync первое движение на новой высоте не считается');
  }
  { // с ResizeObserver
    const { e, ro } = mk();
    e.nc.init();
    assertTrue(typeof ro.cb === 'function', '13. init() создаёт ResizeObserver');
    assertEqual(ro.observed.length, 1 + e.sa.children.length, '13. наблюдаются #scrollArea и его блоки (.subhead, экраны)');
    assertEqual(ro.observed[0], e.sa, '13. наблюдается сама #scrollArea (высота viewport)');
    e.sa.scrollHeight = 3936; e.to(300); e.to(0); e.runFrames();
    e.sa.scrollHeight = 1602; e.nc.expand(); ro.cb(); e.runFrames();  // layout нового экрана → resync
    assertEqual(e.nc._state.lastMax, 902, '13. resync: точка отсчёта по новой прокручиваемой высоте');
    e.to(450); e.runFrames();
    assertEqual(e.target(), 1, '13. первая прокрутка вниз после смены экрана считается полностью');
  }
  { // свежая загрузка: высота выросла после init (рендер/шрифты) без scroll-события
    const { e, ro } = mk();
    e.sa.scrollHeight = 700; e.nc.init(); e.to(0); e.runFrames();    // при запуске прокручивать нечего
    e.sa.scrollHeight = 1602; ro.cb();                               // контент дорисовался
    e.to(60 + RANGE); e.runFrames();
    assertEqual(e.target(), 1, '13. свежая загрузка: первая прокрутка вниз считается полностью');
    e.to(60 + RANGE - 30); e.runFrames();
    assertTrue(Math.abs(e.target() - (1 - 30 / RANGE)) < 1e-9, '13. первая прокрутка вверх — тоже');
  }
  { // resync не трогает прогресс и ничего не рисует
    const { e, ro } = mk();
    e.nc.init();
    e.to(200); e.runFrames();
    const p = e.target(), w = e.writes.length;
    ro.cb();
    assertEqual(e.target(), p, '13. resync не меняет прогресс');
    assertEqual(e.writes.length, w, '13. resync не пишет в DOM');
  }
  { // без ResizeObserver (старые браузеры) — init() не падает
    const e = makeEnv();
    e.ctx.$ = sel => (sel === '.nav' ? e.nav : sel === '#scrollArea' ? e.sa : null);
    let ok = true; try { e.nc.init(); } catch (_) { ok = false; }
    assertTrue(ok, '13. без ResizeObserver init() работает (только focusin)');
  }
  assertTrue(!/addEventListener\('scroll'/.test(code) && /new ResizeObserver\(resync\)/.test(code),
    '13. resync — ResizeObserver, не дополнительный scroll-слушатель');
}
{ // 14. prefers-reduced-motion — без догонки, сразу конечное значение
  const e = makeEnv({ reduce: true });
  e.nc.init();
  e.to(600);
  assertEqual(e.shown(), 1, '14. reduced-motion: крупный скачок применяется сразу');
  assertEqual(e.frames.length, 0, '14. reduced-motion: кадры догонки не планируются');
  e.ctx.$ = sel => (sel === '.nav' ? e.nav : sel === '#scrollArea' ? e.sa : null);
  e.nc.expand();
  assertEqual(e.shown(), 0, '14. reduced-motion: раскрытие при смене вкладки тоже без анимации');
  const n = makeEnv(); n.nc.init(); n.to(600);
  assertTrue(n.shown() < 1, '14. без reduced-motion тот же скачок анимируется');
}
{ // 15. Без requestAnimationFrame (старый браузер) — прогресс всё равно доходит до цели
  const e = makeEnv({ noRaf: true });
  e.to(600);
  assertEqual(e.shown(), 1, '15. без rAF крупный скачок применяется сразу, без зависания на полпути');
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

// ---------- §3. CSS: размеры считаются из прогресса --nav-p ----------
const block = (() => {
  const i = css.indexOf('/* ===== TASK_063:');
  const j = css.indexOf('.drawer{', i);
  return i > 0 && j > i ? css.slice(i, j) : '';
})();
const navRule = (css.match(/\.nav\{position:fixed;[\s\S]*?touch-action:pan-y\}/) || [''])[0];
{
  assertTrue(!!block, 'комментарий блока TASK_063 найден');
  assertTrue(!!navRule, 'основное правило .nav найдено');
  assertTrue(/--nav-p:0;/.test(navRule), 'прогресс --nav-p по умолчанию 0 (полная капсула)');
  assertTrue(/--navh-compact:54px;/.test(css) && /--nav-compact-tab:50px;/.test(css), 'токены компактного размера');
  // высота, padding, ширина — линейная интерполяция по прогрессу, а не два фиксированных состояния
  assertTrue(/height:calc\(var\(--navh\) - \(var\(--navh\) - var\(--navh-compact\)\) \* var\(--nav-p\)\)/.test(navRule),
    'высота 64 → 54 считается из прогресса');
  assertTrue(/padding:calc\(7px - 3px \* var\(--nav-p\)\) 7px;/.test(navRule),
    'вертикальный padding 7 → 4 из прогресса, горизонтальный 7px постоянный (геометрия navDrag)');
  assertTrue(/left:calc\(var\(--nav-inset\) \+ \(var\(--nav-compact-inset\) - var\(--nav-inset\)\) \* var\(--nav-p\)\)/.test(navRule)
    && /right:calc\(var\(--nav-inset\) \+ \(var\(--nav-compact-inset\) - var\(--nav-inset\)\) \* var\(--nav-p\)\)/.test(navRule),
    'боковые отступы симметрично уходят к центру — капсула реально сужается и остаётся по центру');
  assertTrue(/max-width:calc\(500px - \(500px - var\(--nav-compact-w\)\) \* var\(--nav-p\)\)/.test(navRule),
    'предел ширины сужается вместе с капсулой — на десктопе ход тоже линейный, без рывка');
  assertTrue(/@media \(max-width:340px\)\{\.nav\{--nav-inset:12px\}/.test(css), 'на узком экране исходный отступ 12px');
  assertTrue(/--nav-compact-inset:max\(12px,calc\(50% - var\(--nav-compact-w\) \/ 2\)\);/.test(css),
    'компактный отступ — центрирование, минимум 12px от края');
  assertTrue(/--nav-compact-w:calc\(var\(--nav-count,5\) \* var\(--nav-compact-tab\) \+ 16px\);/.test(css),
    'компактная ширина считается по содержимому (вкладки × ширина + padding/контур), а не константой');
  // сжатие — настоящая ширина, не масштабирование
  assertTrue(!/transform:scale/.test(navRule), 'капсула не масштабируется трансформацией — меняется настоящая геометрия');
  // подписи и иконки
  assertTrue(/\.nav button \.lb\{[^}]*max-height:calc\(16px \* \(1 - var\(--nav-p\)\)\);opacity:calc\(1 - var\(--nav-p\) \* 2\.6\)\}/.test(css),
    'подписи гаснут и схлопываются по прогрессу (гаснут быстрее сжатия)');
  assertTrue(/\.nav button \.lb\{[^}]*text-overflow:clip/.test(css), 'вместо многоточия — обрезка: текст уходит под край, пока гаснет');
  assertTrue(/\.nav button\{[^}]*gap:calc\(2px \* \(1 - var\(--nav-p\)\)\)/.test(css), 'зазор иконка/подпись тоже по прогрессу');
  assertTrue(/\.nav button \.ic svg\{[^}]*transform:scale\(calc\(1 - \.08 \* var\(--nav-p\)\)\)/.test(css),
    'иконка плавно уменьшается до .92');
  assertTrue(/\.nav-indicator\{position:absolute;top:calc\(7px - 3px \* var\(--nav-p\)\);bottom:calc\(7px - 3px \* var\(--nav-p\)\);/.test(css),
    'подложка активной вкладки следует за высотой капсулы');
  assertTrue(/\.nav-indicator\{[^}]*width:calc\(\(100% - 14px\) \/ var\(--nav-count,5\)\)/.test(css),
    'ширина подложки — доля ширины капсулы (подстраивается на любом прогрессе)');
  assertTrue(/grid-template-columns:repeat\(var\(--nav-count,5\),minmax\(0,1fr\)\)/.test(navRule),
    'пять равных колонок — сужаются вместе с капсулой, все вкладки остаются');
  // ничего не скрывается и не отключается: пять вкладок доступны на любом прогрессе
  assertTrue(!/display:none|visibility:hidden|pointer-events:none/.test(block + navRule),
    'вкладки не скрываются и не отключаются при сжатии');
  assertEqual(54 - 4 * 2 - 2, 44, 'область нажатия в компактном состоянии — 44px по высоте (54 − padding 2×4 − контур 2×1)');
  const W = 5 * 50 + 16, inner = W - 7 * 2 - 2;
  assertTrue(W <= 320 - 2 * 12, 'на 320px компактная капсула помещается с отступами ≥12px');
  assertTrue(inner / 5 >= 44, `вкладка в компактном состоянии ≥44px шириной (${(inner / 5).toFixed(1)}px)`);
  // переходов на этих свойствах нет — иначе значение «догоняло» бы прокрутку с задержкой
  const navTransition = (css.match(/\.app,\.nav\{transition:([^}]*)\}/) || [])[1] || '';
  assertTrue(/filter|transform/.test(navTransition), 'переход остаётся только на эффектах шторки (filter/transform)');
  assertTrue(!/transition:[^}]*(height|padding|left|right|max-width)/.test(navRule + block),
    'на размерах капсулы CSS-переходов нет — они следуют за прокруткой без задержки');
  assertTrue(!/\.nav button \.lb\{[^}]*transition/.test(css) && !/\.nav button \.ic svg\{[^}]*transition/.test(css),
    'подписи и иконки тоже без переходов — ими управляет прогресс');
  // стекло/цвета/темы не затронуты
  assertTrue(!/background|border-color|box-shadow|backdrop-filter|color:/.test(block.replace(/\/\*[\s\S]*?\*\//g, '')),
    'сжатие не меняет стекло и цвета — светлая и тёмная темы из токенов TASK_062');
  assertTrue(/\.scroll-area\{[^}]*padding-bottom:calc\(var\(--navh\) \+ env\(safe-area-inset-bottom\) \+ 26px\)/.test(css),
    'резерв контента рассчитан на полную высоту — последняя строка не перекрывается ни на каком прогрессе');
  assertTrue(/bottom:var\(--nav-bottom\)/.test(navRule) && /--nav-bottom:max\(6px,calc\(env\(safe-area-inset-bottom\) - 14px\)\)/.test(css),
    'safe area iOS не изменилась (TASK_062A)');
  // navDrag: высота pill берётся фактическая, т.к. вертикальный padding зависит от прогресса
  assertTrue(/s\.pillW=\(r\.width-NAV_PAD\*2\)\/count;s\.pillH=pill\.getBoundingClientRect\(\)\.height;/.test(script),
    'navDrag берёт фактическую высоту подложки (вертикальный padding зависит от прогресса)');
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
