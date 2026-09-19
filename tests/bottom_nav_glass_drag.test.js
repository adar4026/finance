// tests/bottom_nav_glass_drag.test.js — TASK_056: нижняя навигация — floating glass
// capsule, glass pill с drag-жестом, пятая вкладка «Записи», отдельная кнопка «＋».
// §1–§5 — статические проверки по index.html / sw.js (тот же приём, что
// tests/home_hero_screen.test.js); §6 — юнит-эмуляция жеста: код navDrag
// вырезается из index.html и выполняется в vm с минимальной заглушкой DOM.
// Запуск: node tests/bottom_nav_glass_drag.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function block(startRe, endStr, name) {
  const m = html.match(startRe);
  assertTrue(!!m, `${name}: начало блока найдено`);
  if (!m) return '';
  const start = m.index;
  const end = html.indexOf(endStr, start);
  assertTrue(end > start, `${name}: конец блока найден`);
  return html.slice(start, end);
}
function ruleBody(selector, src) {
  const re = new RegExp(selector.replace(/[.#()>:\[\]="~*+-]/g, c => '\\' + c) + '\\{([^}]*)\\}');
  const m = (src || html).match(re);
  return m ? m[1] : null;
}
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const val = (src, t) => (src.match(new RegExp(`(?:^|[\\s;])${t}:([^;]+);`, 'm')) || [])[1];
const light = block(/:root, \[data-theme="light"\]\{/, '[data-theme="dark"]{', 'светлые токены');
const dark = block(/\[data-theme="dark"\]\{/, '*{box-sizing', 'тёмные токены');

// ---------- §1. Разметка: пять вкладок в капсуле, «Записи» по центру, «＋» вне капсулы ----------
{
  const nav = block(/<div class="nav" role="navigation"/, '</div>\n<button class="nav-add"', 'разметка .nav');
  const tabs = [...nav.matchAll(/data-s="(scr\w+)"/g)].map(m => m[1]);
  assertEqual(tabs, ['scrRecords', 'scrCharts', 'scrJournal', 'scrAccounts', 'scrBudgets'],
    'пять вкладок в порядке Главная · Аналитика · Записи · Счета · Бюджеты');
  assertEqual(tabs[2], 'scrJournal', '«Записи» — ровно по центру капсулы');
  const labels = [...nav.matchAll(/<span class="lb">([^<]+)<\/span>/g)].map(m => m[1]);
  assertEqual(labels, ['Главная', 'Аналитика', 'Записи', 'Счета', 'Бюджеты'], 'подписи вкладок');
  assertTrue(!/addbtn|id="addBtn"|Добавить/.test(nav), 'внутри капсулы нет кнопки «＋ Добавить» и пустой центральной ячейки');
  assertTrue(/style="--nav-count:5"/.test(nav), 'капсула объявляет --nav-count:5 (сетка и ширина pill)');
  assertTrue(/<div class="nav-indicator" id="navIndicator" aria-hidden="true"><\/div>/.test(nav), 'одна общая pill #navIndicator (aria-hidden)');
  assertTrue(/<button class="on" data-s="scrRecords" aria-current="page">/.test(nav), 'стартовая вкладка — Главная с aria-current');
  assertTrue(/data-s="scrJournal"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3\.5" width="14" height="17" rx="2\.5"\/><path d="M8\.5 8\.5h7M8\.5 12h7M8\.5 15\.5h4\.5"\/><\/svg>/.test(nav),
    'иконка «Записи» — line-icon журнала/списка в стиле остальных (24-viewBox, stroke)');
  assertTrue(/<\/div>\n<button class="nav-add" id="addBtn" type="button" aria-label="Добавить операцию"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"\/><\/svg><\/button>/.test(html),
    '«＋» — отдельная кнопка .nav-add#addBtn сразу ПОСЛЕ закрытия .nav (не внутри капсулы), тот же id и aria-label');
  assertEqual((html.match(/id="addBtn"/g) || []).length, 1, 'id="addBtn" один');
  assertTrue(/\$\('#addBtn'\)\.onclick=\(\)=>openSheet\(null\);/.test(html), 'действие «＋» не изменилось: openSheet(null)');
}

// ---------- §2. Токены: отдельные light/dark значения стекла, палитра Finance ----------
{
  const need = ['--nav-bg', '--nav-bg-solid', '--nav-border', '--nav-highlight', '--nav-blur', '--nav-saturate',
    '--nav-muted', '--nav-active', '--nav-pill-bg', '--nav-pill-border', '--nav-pill-shadow',
    '--nav-glint', '--nav-pill-edge-light', '--nav-pill-edge-dark',
    '--nav-add-bg', '--nav-add-bg-solid', '--nav-add-border', '--nav-add-shadow'];
  need.forEach(t => {
    assertTrue(new RegExp(`(^|[\\s;])${t}:`, 'm').test(light), `light: токен ${t}`);
    assertTrue(new RegExp(`(^|[\\s;])${t}:`, 'm').test(dark), `dark: токен ${t}`);
  });
  // TASK_057: почти прозрачное стекло по финальному LexCar (light .03 / blur 2px; dark .42 / blur 16px)
  assertEqual(val(light, '--nav-bg'), 'rgba(255,255,255,.03)', 'light --nav-bg — почти прозрачное светлое стекло');
  assertEqual(val(light, '--nav-blur'), '2px', 'light blur 2px');
  assertEqual(val(light, '--nav-border'), 'rgba(22,24,31,.42)', 'light — заметный тонкий контур держит капсулу');
  assertEqual(val(dark, '--nav-bg'), 'rgba(30,30,36,.42)', 'dark --nav-bg — отдельное тёмное стекло, не белый rgba');
  assertEqual(val(dark, '--nav-blur'), '16px', 'dark blur 16px');
  assertTrue(val(light, '--nav-bg') !== val(dark, '--nav-bg'), 'light/dark стекло различаются');
  assertEqual(val(light, '--nav-pill-bg'), 'rgba(79,125,240,.18)', 'light pill — синий акцент навигации (#4f7df0) .18, не цвета LexCar');
  assertEqual(val(dark, '--nav-pill-bg'), 'rgba(91,139,255,.30)', 'dark pill — синий акцент (#5b8bff) .30');
  assertEqual(val(light, '--nav-active'), 'var(--nav-blue2)', 'light: активная вкладка — более глубокий синий --nav-blue2');
  assertEqual(val(dark, '--nav-active'), 'var(--nav-blue)', 'dark: активная вкладка — --nav-blue');
  assertTrue(/--nav-blue:#4f7df0;/.test(light) && /--nav-blue:#5b8bff;/.test(dark), 'акцент --nav-blue не подменён');
  assertTrue(/--accent:#6d5df6;/.test(light), 'фирменный --accent не тронут');
  assertTrue(/--nav-glass-bg:linear-gradient\(180deg,rgba\(255,255,255,\.68\),rgba\(255,255,255,\.30\)\),var\(--nav-active-bg\);/.test(light),
    'токены TASK_002 --nav-glass-* не изменены (их использует .periods-indicator)');
  assertTrue(!/#b39cff|#6d4de6|rgba\(139, 110, 255|rgba\(109, 77, 230/.test(css), 'цвета LexCar не перенесены');
}

// ---------- §3. Капсула: настоящее стекло + Safari + fallback ----------
{
  const nav = ruleBody('.nav', css);
  assertTrue(!!nav, '.nav правило найдено');
  assertTrue(/position:fixed/.test(nav) && /z-index:30/.test(nav), '.nav — fixed, z-index:30 (над шапкой, под overlay)');
  assertTrue(/bottom:max\(6px,env\(safe-area-inset-bottom\)\)/.test(nav), 'safe area снизу сохранена');
  assertTrue(/left:16px;right:16px;margin:0 auto/.test(nav) && !/translateX\(-50%\)/.test(nav), 'центрирование left/right+margin (без дробного translateX под backdrop-filter)');
  assertTrue(/display:grid;grid-template-columns:repeat\(var\(--nav-count,5\),minmax\(0,1fr\)\)/.test(nav), 'пять равных колонок (grid)');
  assertTrue(/background:var\(--nav-bg\)/.test(nav), 'фон капсулы — прозрачный токен --nav-bg');
  assertTrue(/-webkit-backdrop-filter:blur\(var\(--nav-blur\)\) saturate\(var\(--nav-saturate\)\)/.test(nav), '-webkit-backdrop-filter (Safari/iPhone)');
  assertTrue(/[^-]backdrop-filter:blur\(var\(--nav-blur\)\) saturate\(var\(--nav-saturate\)\)/.test(nav), 'backdrop-filter (стандартный)');
  assertTrue(/border:1px solid var\(--nav-border\)/.test(nav), 'тонкий контур');
  assertTrue(/inset 0 1px 0 var\(--nav-highlight\)/.test(nav) && /var\(--nav-shadow\)/.test(nav), 'верхний блик + существующая мягкая тень --nav-shadow');
  assertTrue(!/(^|;)opacity:/.test(nav), 'без opacity на всей панели (иконки/текст непрозрачны)');
  assertTrue(/touch-action:pan-y/.test(nav), 'touch-action:pan-y — вертикальный pan остаётся браузеру');
  assertTrue(/overflow:hidden/.test(nav), 'pill не выходит за скругление капсулы');
  assertTrue(/@supports not \(\(backdrop-filter:blur\(1px\)\) or \(-webkit-backdrop-filter:blur\(1px\)\)\)\{\s*\.nav\{background:var\(--nav-bg-solid\)\}\s*\.nav-add\{background:var\(--nav-add-bg-solid\)\}/.test(css),
    '@supports fallback без backdrop-filter — плотные --nav-bg-solid / --nav-add-bg-solid');
  assertTrue(/\.nav button\.on,\.nav button\.preview\{color:var\(--nav-active\)\}/.test(css), 'активная и preview-вкладка — синий акцент --nav-active');
  assertTrue(/\.nav button:focus-visible\{outline:2px solid var\(--nav-active\)/.test(css), 'focus state для keyboard-навигации');
  // TASK_057: компактная капсула и вкладки по LexCar b2e5423/e387441
  assertTrue(/border-radius:32px/.test(nav), 'капсула 64px с radius 32px — полностью скруглённые торцы');
  const btn = ruleBody('.nav button', css);
  assertTrue(/color:var\(--nav-muted\)/.test(btn) && /gap:3px/.test(btn) && /font-size:11px;font-weight:600;letter-spacing:0/.test(btn) && /border-radius:999px/.test(btn),
    'вкладка: --nav-muted, gap 3px, подпись 11px/600, скругление 999px');
  assertTrue(/\.nav button \.ic svg\{width:22px;height:22px/.test(css), 'иконка 22px');
  assertTrue(/\.nav button\.on \.lb\{font-weight:700\}/.test(css) && /\.nav button\.on \.ic svg\{stroke-width:2\.4\}/.test(css), 'активная: подпись 700, штрих иконки 2.4');
  assertTrue(/@media \(max-width:340px\)\{\.nav\{left:12px;right:12px\}\.nav button\{font-size:9\.5px;padding:0 1px\}\}/.test(css), '≤340px: подпись 9.5px, отступы 12px');
  assertTrue(/\.nav\.dragging button\[data-s\]\{transform:none\}/.test(css), 'во время drag :active-scale кнопок отключён');
  assertTrue(/\.scroll-area\{[^}]*padding-bottom:calc\(var\(--navh\) \+ env\(safe-area-inset-bottom\) \+ 26px\)/.test(css), 'нижний отступ scroll-контента не изменён');
  assertTrue(/--navh:64px/.test(light), 'высота капсулы --navh 64px (TASK_057, LexCar b2e5423)');
}

// ---------- §4. Pill, «живое стекло», reduced motion, кнопка «＋» ----------
{
  const pill = ruleBody('.nav-indicator', css);
  assertTrue(!!pill, '.nav-indicator найдена');
  assertTrue(/top:7px;bottom:7px;left:7px/.test(pill) && /width:calc\(\(100% - 14px\) \/ var\(--nav-count,5\)\)/.test(pill), 'pill = одна колонка внутри padding 7px');
  assertTrue(/transform:translate3d\(calc\(var\(--nav-index,0\) \* 100%\),0,0\)/.test(pill), 'положение pill — CSS по --nav-index (без измерения DOM)');
  assertTrue(/border-radius:999px/.test(pill), 'pill полностью скруглена (999px)');
  assertTrue(/background:var\(--nav-pill-bg\);border:1px solid var\(--nav-pill-border\);box-shadow:var\(--nav-pill-shadow\)/.test(pill),
    'pill: полупрозрачная заливка на акценте + светлый контур + inset-блик/свечение (--nav-pill-*)');
  assertTrue(/inset 0 1px 0 rgba\(255,255,255,\.30\),0 3px 12px rgba\(79,125,240,\.14\)/.test(val(light, '--nav-pill-shadow')), 'light pill shadow: inset блик + синее свечение');
  assertTrue(!/backdrop-filter/.test(pill), 'у pill нет своего backdrop-filter (второй blur в Safari лишний)');
  assertTrue(/pointer-events:none/.test(pill) && /overflow:hidden/.test(pill), 'pill декоративна, слои блика обрезаются по радиусу');
  assertTrue(!/will-change/.test(pill), 'will-change не задан постоянно');
  assertTrue(/\.nav\.dragging \.nav-indicator\{transition:opacity \.18s ease;will-change:transform\}/.test(css), 'will-change только в состоянии drag, transition transform выключена');
  assertTrue(/\.nav-indicator\.snap\{transition:opacity \.18s ease,transform \.38s cubic-bezier\(\.22,1\.25,\.36,1\)\}/.test(css), 'пружинное прилипание .snap (0.38s, overshoot)');
  assertTrue(/\.nav-indicator::before,\.nav-indicator::after\{content:"";position:absolute;inset:0;border-radius:inherit;\s*pointer-events:none;opacity:0/.test(css), 'декоративные ::before/::after, pointer-events:none, в покое невидимы');
  assertTrue(/\.nav-indicator::before\{background:radial-gradient\(28px 24px at var\(--glint-x,50%\) var\(--glint-y,50%\),var\(--nav-glint\) 0%,transparent 72%\)\}/.test(css), 'блик под пальцем — radial-gradient по --glint-x/--glint-y');
  assertTrue(/\.nav-indicator::after\{background:linear-gradient\(90deg,var\(--nav-pill-edge-dark\) 0%,transparent 38%,transparent 62%,var\(--nav-pill-edge-light\) 100%\);\s*transform:scaleX\(var\(--drag-dir,1\)\)\}/.test(css), 'передний/задний край по направлению движения (--drag-dir)');
  assertTrue(/\.nav-indicator\.live::before\{opacity:1\}/.test(css) && /\.nav-indicator\.live::after\{opacity:var\(--drag-v,0\)\}/.test(css), 'слои включаются только в .live (удержание/drag)');
  assertTrue(/\.nav-indicator\.live\{filter:saturate\(calc\(1 \+ \.12 \* var\(--drag-v,0\)\)\) brightness\(calc\(1 \+ \.03 \* var\(--drag-v,0\)\)\)\}/.test(css), 'очень лёгкое изменение насыщенности/яркости стекла по скорости');
  assertTrue(!/\.nav-indicator[^{]*\{[^}]*animation:/.test(css), 'нет постоянной анимации в покое');
  const rm = css.match(/@media \(prefers-reduced-motion: reduce\)\{\s*\.nav-indicator\{transition:opacity \.18s ease,transform \.01s\}\s*\.nav-indicator\.snap\{transition:opacity \.18s ease,transform \.2s ease\}\s*\.nav-indicator::before,\.nav-indicator::after\{display:none\}\s*\.nav-indicator\.live\{filter:none\}\s*\}/);
  assertTrue(!!rm, 'reduced motion: без пружины/блика/фильтра, tap-переходы остаются');
  // не Canvas/WebGL/SVG-фильтры
  assertTrue(!/<div class="nav"[^>]*>[\s\S]*?<canvas/.test(html.slice(html.indexOf('<div class="nav" role'), html.indexOf('<button class="nav-add"'))), 'в навигации нет canvas');
  assertTrue(!/\.nav-indicator[^{]*\{[^}]*filter:url\(/.test(css), 'нет SVG displacement/filter:url() на pill');
  const add = (css.match(/\.nav-add\{(position:fixed[^}]*)\}/) || [])[1];
  assertTrue(!!add, '.nav-add (основное правило) найдена');
  assertTrue(/position:fixed;z-index:31/.test(add), '«＋» выше капсулы по z-index (31 > 30)');
  assertTrue(/right:max\(16px,env\(safe-area-inset-right\),calc\(\(100% - 500px\) \/ 2\)\)/.test(add), 'правый край «＋» совпадает с краем капсулы, учитывает safe area');
  assertTrue(/bottom:calc\(max\(6px,env\(safe-area-inset-bottom\)\) \+ var\(--navh\) \+ 12px\)/.test(add), '«＋» немного выше капсулы, safe area снизу');
  assertTrue(/width:48px;height:48px;border-radius:50%/.test(add), 'небольшая круглая кнопка');
  assertTrue(/background:var\(--nav-add-bg\);border:1px solid var\(--nav-add-border\);box-shadow:var\(--nav-add-shadow\)/.test(add), 'нейтральное стекло: тонкий контур, блик/тень через токены');
  assertTrue(/-webkit-backdrop-filter:blur\(var\(--nav-blur\)\)/.test(add) && /[^-]backdrop-filter:blur\(var\(--nav-blur\)\)/.test(add), '«＋»: оба префикса backdrop-filter');
  assertTrue(!/--nav-blue|--accent[^-]/.test(add) && !/linear-gradient/.test(add), '«＋» не синяя/фиолетовая primary-кнопка');
  assertTrue(/body\.drawer-open \.nav-add\{filter:blur\(6px\) brightness\(\.92\);transform:scale\(\.98\)\}/.test(css), '«＋» блюрится вместе с интерфейсом при открытой шторке');
  assertTrue(/body\.drawer-open \.app,body\.drawer-open \.nav\{filter:blur\(6px\) brightness\(\.92\);transform:scale\(\.98\)\}/.test(css), 'существующее правило шторки не изменено');
}

// ---------- §5. JS: moveNavIndicator, navDrag, showScreen, «Записи», sw.js ----------
const jsStart = html.indexOf('/* ============ Glass pill — индикатор активной вкладки');
const jsEnd = html.indexOf('let navIndicatorResizeTimer=null;');
const navJs = html.slice(jsStart, jsEnd);
{
  assertTrue(jsStart > -1 && jsEnd > jsStart, 'блок moveNavIndicator/navDrag найден');
  assertTrue(/const NAV_TABS=\(\)=>Array\.from\(\$\$\('\.nav button\[data-s\]'\)\);/.test(navJs), 'NAV_TABS — массив кнопок вкладок');
  assertTrue(/nav\.style\.setProperty\('--nav-index',idx\)/.test(navJs), 'moveNavIndicator пишет --nav-index');
  assertTrue(!/function moveNavIndicator[\s\S]*?getBoundingClientRect[\s\S]*?const NAV_PAD/.test(navJs), 'moveNavIndicator больше не измеряет DOM');
  assertTrue(/const NAV_DRAG_THRESHOLD=8;/.test(navJs), 'порог drag — 8px');
  assertTrue(/const NAV_SNAP_MS=380;/.test(navJs) && /const NAV_STRETCH_MAX=0\.05;/.test(navJs), 'константы пружины/растяжения');
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(ev =>
    assertTrue(new RegExp(`nav\\.addEventListener\\('${ev}',on`).test(navJs), `Pointer Events: ${ev}`));
  assertTrue(/nav\.setPointerCapture\(e\.pointerId\)/.test(navJs), 'setPointerCapture на капсуле');
  assertTrue(/nav\.releasePointerCapture\(s\.id\)/.test(navJs), 'releasePointerCapture при завершении');
  assertTrue(/s\.raf=requestAnimationFrame\(frame\)/.test(navJs), 'движение через requestAnimationFrame');
  assertTrue(/pill\.style\.transform=`translate3d\(\$\{s\.x\}px,0,0\) scaleX\(/.test(navJs), 'во время drag — только transform:translate3d (+ лёгкий scaleX)');
  assertTrue(/setProperty\('--glint-x'/.test(navJs) && /setProperty\('--glint-y'/.test(navJs) && /setProperty\('--drag-dir'/.test(navJs) && /setProperty\('--drag-v'/.test(navJs),
    'декоративные эффекты — через CSS custom properties');
  // геометрия — на pointerdown, не на pointermove
  const onDown = navJs.slice(navJs.indexOf('function onDown'), navJs.indexOf('function onMove'));
  const onMove = navJs.slice(navJs.indexOf('function onMove'), navJs.indexOf('function onUp'));
  assertTrue(/getBoundingClientRect/.test(onDown), 'геометрия капсулы читается на pointerdown');
  assertTrue(!/getBoundingClientRect|offsetWidth|clientWidth/.test(onMove), 'на pointermove layout не читается');
  assertTrue(/if\(Math\.abs\(dx\)<NAV_DRAG_THRESHOLD\)/.test(onMove) && /if\(Math\.abs\(dy\)>Math\.abs\(dx\)\)return;/.test(onMove), 'порог по X; вертикальное движение — не drag');
  assertTrue(/s\.x=clamp\(s\.baseX\+\(s\.lastX-s\.startX\),0,s\.maxX\)/.test(navJs), 'pill зажата в границах капсулы (0..maxX)');
  assertTrue(/setPreview\(Math\.round\(s\.x\/s\.pillW\)\)/.test(navJs), 'preview ближайшей вкладки');
  assertTrue(/if\(wasDragging&&target!==s\.index\)\{const b=tabs\(\)\[target\];if\(b\)showScreen\(b\.dataset\.s\);\}/.test(navJs), 'переход — существующий showScreen() только при другой вкладке');
  assertTrue(/function onCancel[\s\S]*?settle\(s\.index\)/.test(navJs), 'pointercancel — возврат к текущей вкладке');
  assertTrue(/nav\.addEventListener\('click',onClickCapture,true\)/.test(navJs) && /if\(s\.moved\)\{s\.moved=false;e\.stopPropagation\(\);e\.preventDefault\(\);\}/.test(navJs), 'click после drag глотается (capture-guard), обычные onclick кнопок не тронуты');
  assertTrue(/prefers-reduced-motion: reduce/.test(navJs) && /const stretch=s\.reduceMotion\?1:1\+NAV_STRETCH_MAX\*s\.v;/.test(navJs), 'reduced motion: без растяжения/блика в JS');
  assertTrue(/\$\$\('\.nav button\[data-s\]'\)\.forEach\(b=>b\.onclick=\(\)=>showScreen\(b\.dataset\.s\)\);\nnavDrag\.init\(\);/.test(html), 'обработчики tap прежние; navDrag.init() после них');
  assertTrue(/\$\$\('\.nav button\[data-s\]'\)\.forEach\(b=>\{const on=b\.dataset\.s===id;b\.classList\.toggle\('on',on\);if\(on\)b\.setAttribute\('aria-current','page'\);else b\.removeAttribute\('aria-current'\);\}\);/.test(html), 'showScreen(): .on + aria-current для пяти вкладок');
  assertTrue(/const noPeriod=\(id==='scrMore'\|\|id==='scrAccounts'\|\|id==='scrJournal'\);/.test(html), '«Записи» — без переключателя периода (журнал целиком)');
  // экран «Записи»
  assertTrue(/<div class="screen immersive" id="scrJournal">\s*<div class="home-list-head journal-head">Все записи <span class="journal-count" id="journalCount"><\/span><\/div>\s*<div id="journalList"><\/div>\s*<\/div>/.test(html), 'экран #scrJournal: заголовок + список');
  assertTrue(/#scrJournal\{background:transparent\}/.test(css), '#scrJournal прозрачен над .finance-ambient (как остальные immersive)');
  const rj = html.slice(html.indexOf('function renderJournal'), html.indexOf('// TASK_004: разметка списка операций'));
  assertTrue(/const items=AF\.Services\.TxTime\.sortAll\(state\.tx\);/.test(rj), 'renderJournal: все операции state.tx в существующем порядке (TxTime.sortAll)');
  assertTrue(/el\.innerHTML=homeGroupedTxHtml\(items\);/.test(rj), 'renderJournal: та же разметка строк, что на Главной (homeGroupedTxHtml, полный текст)');
  assertTrue(/\$\$\('#journalList \.home-tx'\)\.forEach\(r=>r\.onclick=\(\)=>openSheet\(r\.dataset\.id\)\);/.test(rj), 'tap по записи — существующий openSheet(id)');
  assertTrue(!/inPeriod/.test(rj), 'renderJournal не фильтрует по периоду (полный журнал)');
  assertTrue(!/reduce\(|amount/.test(rj), 'renderJournal не добавляет финансовых расчётов');
  assertTrue(/updateHome\(list\);\n  renderJournal\(\); \/\/ TASK_056\n  renderFinanceCard\(\);/.test(html), 'render(): renderJournal() рядом с updateHome(); Главная не изменена');
  assertTrue(/function renderRecent\(list\)\{[\s\S]*?el\.innerHTML=homeGroupedTxHtml\(items\);\n  \$\$\('#recentList \.home-tx'\)/.test(html), 'renderRecent() Главной — без изменений');
  assertTrue(/const CACHE = 'finance-v189';/.test(sw), 'sw.js: cache version поднят до finance-v189 (TASK_057)');
  assertTrue(!/<script src="[^"]*(react|vue|framer|gsap|hammer)/i.test(html), 'без сторонних библиотек');
}

// ---------- §6. Юнит-эмуляция жеста: navDrag в vm с заглушкой DOM ----------
{
  function makeEl(extra) {
    const cls = new Set();
    const props = {};
    const el = {
      listeners: {},
      classList: {
        add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)),
        contains: c => cls.has(c), toggle: (c, on) => { on ? cls.add(c) : cls.delete(c); },
      },
      get className() { return [...cls].join(' '); },
      style: {
        setProperty: (k, v) => { props[k] = String(v); }, removeProperty: k => { delete props[k]; },
        getPropertyValue: k => props[k] || '', get transform() { return props.transform || ''; }, set transform(v) { props.transform = v; },
        get transition() { return props.transition || ''; }, set transition(v) { props.transition = v; },
      },
      props,
      offsetWidth: 100,
      addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
      setPointerCapture() { this.captured = true; this.captures = (this.captures || 0) + 1; }, releasePointerCapture() { this.captured = false; },
      setAttribute() {}, removeAttribute() {},
      dataset: {},
    };
    return Object.assign(el, extra || {});
  }
  const NAVW = 358, NAVH = 76, NAVL = 16, NAVT = 700;
  const nav = makeEl({ getBoundingClientRect: () => ({ left: NAVL, top: NAVT, width: NAVW, height: NAVH, right: NAVL + NAVW, bottom: NAVT + NAVH }) });
  const pill = makeEl();
  const ids = ['scrRecords', 'scrCharts', 'scrJournal', 'scrAccounts', 'scrBudgets'];
  const tabs = ids.map(id => { const b = makeEl(); b.dataset.s = id; return b; });
  tabs[0].classList.add('on');
  const calls = [];
  const rafQ = [];
  const timers = [];
  const ctx = {
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, PointerEvent: function () {} },
    $: s => (s === '.nav' ? nav : s === '#navIndicator' ? pill : null),
    $$: s => (s === '.nav button[data-s]' ? tabs : []),
    showScreen: id => { calls.push(id); tabs.forEach(b => b.classList.toggle('on', b.dataset.s === id)); },
    requestAnimationFrame: fn => { rafQ.push(fn); return rafQ.length; },
    cancelAnimationFrame: () => {},
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    Math, Array, String, Number, console,
  };
  ctx.window.PointerEvent = ctx.window.PointerEvent; // 'PointerEvent' in window
  vm.createContext(ctx);
  vm.runInContext(navJs + '\nglobalThis.navDrag=navDrag;', ctx);
  ctx.navDrag.init();
  const flushRaf = () => { while (rafQ.length) rafQ.shift()(); };
  const flushTimers = () => { while (timers.length) timers.shift().fn(); };
  const fire = (t, o) => (nav.listeners[t] || []).forEach(fn => fn(Object.assign({ pointerId: 1, isPrimary: true, pointerType: 'touch', button: 0 }, o)));
  const pillW = (NAVW - 14) / 5;
  const y = NAVT + NAVH / 2;
  const centerX = i => NAVL + 7 + pillW * i + pillW / 2;

  // 6.1 drag вправо: Главная → Записи (2 колонки)
  fire('pointerdown', { clientX: centerX(0), clientY: y });
  assertTrue(pill.classList.contains('live'), 'удержание на pill — состояние live (блик)');
  fire('pointermove', { clientX: centerX(0) + 4, clientY: y }); flushRaf();
  assertTrue(!nav.classList.contains('dragging'), 'сдвиг 4px < порога — ещё не drag');
  fire('pointermove', { clientX: centerX(0) + 20, clientY: y }); flushRaf();
  assertTrue(nav.classList.contains('dragging') && nav.captured === true, 'после порога — drag + setPointerCapture на капсуле');
  assertTrue(/^translate3d\(12\.0*px,0,0\) scaleX\(1\.\d+\)$/.test(pill.style.transform) || /translate3d\(12px/.test(pill.style.transform),
    `после порога pill сдвинута ровно на (dx − порог) = 12px без рывка (${pill.style.transform})`);
  assertTrue(/^\d+(\.\d+)?px$/.test(pill.props['--glint-x']) && /^\d+(\.\d+)?px$/.test(pill.props['--glint-y']), 'блик --glint-x/--glint-y в px');
  fire('pointermove', { clientX: centerX(2) + 5, clientY: y }); flushRaf();
  assertTrue(tabs[2].classList.contains('preview') && !tabs[1].classList.contains('preview'), 'preview — ближайшая вкладка (Записи)');
  assertEqual(pill.props['--drag-dir'], '1', 'направление вправо → --drag-dir 1');
  fire('pointerup', { clientX: centerX(2) + 5, clientY: y });
  assertEqual(calls, ['scrJournal'], 'на отпускании — showScreen(«Записи») один раз');
  assertTrue(pill.classList.contains('snap') && !nav.classList.contains('dragging') && nav.captured === false, 'snap-состояние, drag снят, capture отпущен');
  assertEqual(pill.style.transform, `translate3d(${2 * pillW}px,0,0)`, 'pill прилипает ровно к колонке «Записи»');
  assertTrue(!tabs[2].classList.contains('preview'), 'preview снят');
  // click после drag глотается
  let stopped = 0;
  (nav.listeners.click || []).forEach(fn => fn({ stopPropagation: () => stopped++, preventDefault() {} }));
  assertEqual(stopped, 1, 'click после drag остановлен (capture-guard)');
  (nav.listeners.click || []).forEach(fn => fn({ stopPropagation: () => stopped++, preventDefault() {} }));
  assertEqual(stopped, 1, 'следующий click (обычный tap) проходит');
  flushTimers();
  assertEqual(pill.style.transform, '', 'после пружины inline transform снят — положением владеет CSS (--nav-index)');
  assertEqual(nav.props['--nav-index'], '2', '--nav-index указывает на «Записи»');
  assertTrue(!pill.classList.contains('snap') && !pill.classList.contains('live'), 'pill в спокойном состоянии');

  // 6.2 drag влево за левую границу: зажим 0, переход на Главную
  calls.length = 0;
  fire('pointerdown', { clientX: centerX(2), clientY: y });
  fire('pointermove', { clientX: centerX(2) - 400, clientY: y }); flushRaf();
  assertTrue(/^translate3d\(0px,0,0\)/.test(pill.style.transform), 'pill не выходит за левую границу (x=0)');
  assertEqual(pill.props['--drag-dir'], '-1', 'направление влево → --drag-dir -1');
  fire('pointerup', { clientX: centerX(2) - 400, clientY: y });
  assertEqual(calls, ['scrRecords'], 'прилипание к Главной');
  flushTimers();

  // 6.3 drag вправо за правую границу: зажим maxX
  calls.length = 0;
  fire('pointerdown', { clientX: centerX(0), clientY: y });
  fire('pointermove', { clientX: centerX(0) + 900, clientY: y }); flushRaf();
  assertTrue(pill.style.transform.startsWith(`translate3d(${4 * pillW}px,0,0)`), 'pill не выходит за правую границу (maxX = 4 колонки)');
  fire('pointerup', { clientX: centerX(0) + 900, clientY: y });
  assertEqual(calls, ['scrBudgets'], 'прилипание к Бюджетам');
  flushTimers();

  // 6.4 короткий сдвиг (< порога) — tap, экран не меняется, capture не ставится
  calls.length = 0; const capturesBefore = nav.captures;
  fire('pointerdown', { clientX: centerX(4), clientY: y });
  fire('pointermove', { clientX: centerX(4) + 6, clientY: y }); flushRaf();
  fire('pointerup', { clientX: centerX(4) + 6, clientY: y });
  assertEqual(calls, [], 'сдвиг < 8px — не drag, showScreen не вызван');
  assertEqual(nav.captures, capturesBefore, 'до порога pointer capture не ставится (обычный tap кнопок не ломается)');
  assertEqual(pill.style.transform, '', 'pill не двигалась');
  let stopped2 = 0;
  (nav.listeners.click || []).forEach(fn => fn({ stopPropagation: () => stopped2++, preventDefault() {} }));
  assertEqual(stopped2, 0, 'click после короткого tap НЕ глотается');

  // 6.5 вертикальное движение — не drag
  calls.length = 0;
  fire('pointerdown', { clientX: centerX(4), clientY: y });
  fire('pointermove', { clientX: centerX(4) + 10, clientY: y + 40 }); flushRaf();
  assertTrue(!nav.classList.contains('dragging'), '|dy| > |dx| — drag не начинается (вертикальный scroll остаётся браузеру)');
  fire('pointercancel', { clientX: centerX(4) + 10, clientY: y + 40 });
  assertEqual(calls, [], 'pointercancel — экран не менялся');
  assertTrue(!pill.classList.contains('live'), 'live снят по pointercancel');

  // 6.6 отпускание на той же вкладке — возврат без showScreen
  calls.length = 0;
  fire('pointerdown', { clientX: centerX(4), clientY: y });
  fire('pointermove', { clientX: centerX(4) - 20, clientY: y }); flushRaf();
  fire('pointerup', { clientX: centerX(4) - 20, clientY: y });
  assertEqual(calls, [], 'ближайшая — текущая вкладка: showScreen не вызывается');
  assertEqual(pill.style.transform, `translate3d(${4 * pillW}px,0,0)`, 'pill пружиной возвращается на текущую вкладку');
  flushTimers();

  // 6.7 reduced motion — без live/растяжения, snap короче
  ctx.navDrag._state.reduceMotion = true;
  fire('pointerdown', { clientX: centerX(4), clientY: y });
  assertTrue(!pill.classList.contains('live'), 'reduced motion: удержание не включает блик');
  fire('pointermove', { clientX: centerX(4) - 60, clientY: y }); flushRaf();
  assertTrue(/scaleX\(1\.0000\)$/.test(pill.style.transform), 'reduced motion: без растяжения');
  fire('pointerup', { clientX: centerX(4) - 60, clientY: y });
  assertEqual(timers[timers.length - 1].ms, 200, 'reduced motion: snap 200ms вместо 380');
  flushTimers();
  ctx.navDrag._state.reduceMotion = false;

  // 6.8 второй (не primary) указатель игнорируется
  calls.length = 0;
  fire('pointerdown', { clientX: centerX(3), clientY: y, isPrimary: false, pointerId: 5 });
  fire('pointermove', { clientX: centerX(3) - 200, clientY: y, isPrimary: false, pointerId: 5 }); flushRaf();
  assertTrue(!nav.classList.contains('dragging'), 'не-primary указатель не начинает drag');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
