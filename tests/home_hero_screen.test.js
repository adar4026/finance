// tests/home_hero_screen.test.js — TASK_047: Главная — цельный immersive-hero
// на fluid-фоне вместо белых карточек. Статические проверки по исходнику
// index.html/sw.js (тот же приём, что tests/home_tx_wrap_screen.test.js):
// задача — только разметка/CSS Главной, финансовая логика не менялась.
// Запуск: node tests/home_hero_screen.test.js

const fs = require('fs');
const path = require('path');
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
function ruleBody(selector) {
  const re = new RegExp(selector.replace(/[.#()>:\[\]="]/g, c => '\\' + c) + '\\{([^}]*)\\}');
  const m = html.match(re);
  return m ? m[1] : null;
}
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

// ============ §1 — декоративный fluid-слой ============
{
  const ambM = html.match(/<div class="finance-ambient" id="financeAmbient" aria-hidden="true">([\s\S]*?)<\/div>/);
  assertTrue(!!ambM, 'index.html: слой .finance-ambient присутствует и помечен aria-hidden="true"');
  const inner = ambM ? ambM[1] : '';
  assertEqual((inner.match(/class="ambient-blob blob-\d"/g) || []).length, 4, 'ровно 4 blob-слоя (лимит производительности Safari/PWA: 3–4)');
  assertTrue(/class="ambient-fade"/.test(inner), 'есть слой плавного перехода .ambient-fade к базовому фону');
  // слой лежит в .app ДО .topbar — иначе не мог бы оказаться под sticky-шапкой
  const appIdx = html.indexOf('<div class="app">'), ambIdx = html.indexOf('id="financeAmbient"'), tbIdx = html.indexOf('id="topbar"');
  assertTrue(appIdx > -1 && ambIdx > appIdx && ambIdx < tbIdx, 'слой .finance-ambient — первый ребёнок .app, до .topbar');

  const amb = ruleBody('.finance-ambient');
  assertTrue(!!amb, 'CSS-правило .finance-ambient найдено');
  assertTrue(/pointer-events:none/.test(amb || ''), '.finance-ambient не перехватывает касания (pointer-events:none)');
  assertTrue(/z-index:0/.test(amb || ''), '.finance-ambient — нижний слой (z-index:0)');
  assertTrue(/position:absolute;inset:0/.test(amb || ''), '.finance-ambient фиксирован за контентом (absolute inset:0 в .app)');
  assertTrue(/display:none/.test(amb || '') && /\.app:has\(#scrRecords\.active\) \.finance-ambient\{display:block\}/.test(css),
    'слой показывается только пока активна Главная (:has(#scrRecords.active))');
  const sa = css.match(/\.scroll-area\{([^}]*)\}/);
  assertTrue(!!sa && /position:relative;z-index:1/.test(sa[1]), '.scroll-area (контент) поднят над слоем: z-index:1');
  assertTrue(/\.topbar\{position:sticky;top:0;z-index:20/.test(css), '.topbar остаётся над контентом (z-index:20)');
  assertTrue(/\.nav\{[\s\S]*?z-index:30/.test(css), '.nav остаётся над шапкой (z-index:30)');
}

// ============ §2 — анимация: только transform, спокойные разные длительности, reduced-motion ============
{
  const blob = ruleBody('.ambient-blob');
  assertTrue(!!blob && /will-change:transform/.test(blob), 'will-change:transform — только на анимируемых blob\'ах');
  const durations = [1, 2, 3, 4].map(i => {
    const b = ruleBody(`.blob-${i}`) || '';
    const m = b.match(/animation:hero-drift-\d (\d+)s ease-in-out infinite alternate/);
    return m ? +m[1] : null;
  });
  assertEqual(durations.slice().sort((a, b) => a - b), [16, 21, 25, 30], 'четыре независимые длительности 16/21/25/30s');
  for (let i = 1; i <= 4; i++) {
    const kf = css.match(new RegExp(`@keyframes hero-drift-${i}\\{([^}]*\\}[^}]*)\\}`));
    assertTrue(!!kf, `@keyframes hero-drift-${i} определены`);
    const body = kf ? kf[1] : '';
    assertTrue(/translate3d\(/.test(body) && /scale\(/.test(body), `hero-drift-${i}: translate3d + scale`);
    assertTrue(!/background|filter|box-shadow|left:|top:|width:|height:/.test(body), `hero-drift-${i}: анимируется только transform (без layout/paint-свойств)`);
    assertTrue(!/rotate\(/.test(body), `hero-drift-${i}: без вращения`);
    const b = ruleBody(`.blob-${i}`) || '';
    assertTrue(/radial-gradient\(/.test(b) && !/filter:blur/.test(b), `.blob-${i}: мягкий край через radial-gradient, без filter:blur`);
  }
  assertTrue(/@media \(prefers-reduced-motion:reduce\)\{\s*\.ambient-blob\{animation:none;will-change:auto\}/.test(css),
    'prefers-reduced-motion: анимация выключена, слои остаются (не display:none)');
}

// ============ §3 — Home без карточек: header / сегмент / стрелки / баланс / показатели ============
{
  assertTrue(!/<div class="fincard" id="finCard">/.test(html), 'белая карточка .fincard#finCard на Главной убрана');
  assertTrue(/<div class="hero-balance" id="finCard">/.test(html), 'финансовый блок — .hero-balance без карточки');
  assertTrue(/<div class="fincard catx-summary">/.test(html) && /^\s*\.fincard\{/m.test(css), '.fincard сохранён для «Операций по категории» (#catTxOverlay)');
  const hb = ruleBody('.hero-balance') || '';
  assertTrue(!/background|border|box-shadow/.test(hb), '.hero-balance: без фона/рамки/тени (не карточка и не капсула)');
  // все id, которые заполняет renderFinanceCard(), на месте
  ['fcVal', 'fcChg', 'fcEye', 'fcInc', 'fcExp', 'fcFlow', 'fcIncN', 'fcExpN', 'fcFlowN', 'fcMonthLabel', 'fcMonthPrev', 'fcMonthNext']
    .forEach(id => assertEqual((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `id="${id}" единственный и сохранён`));
  assertTrue(/<div class="ci2-v inc" id="fcInc">/.test(html) && /<div class="ci2-v" id="fcFlow">/.test(html),
    'значения показателей сохраняют класс .ci2-v (renderFinanceCard() переписывает className #fcFlow как "ci2-v …")');
  const stats = ruleBody('.hb-stats') || '';
  assertTrue(/display:grid;grid-template-columns:repeat\(3,1fr\)/.test(stats), 'Доходы/Расходы/Поток — grid 3×1fr (одна строка на 320px)');
  assertTrue(/\.hb-stat\{[^}]*border-left:1px solid var\(--hero-sep\)/.test(css) && /\.hb-stat:first-child\{border-left:none\}/.test(css),
    'между показателями — тонкие разделители, без плиток');
  assertTrue(!/\.hb-stat\{[^}]*background/.test(css), '.hb-stat без фона (не карточки)');
  const val = ruleBody('.hb-val') || '';
  assertTrue(/font-size:clamp\(/.test(val) && /font-weight:800/.test(val), 'баланс — крупный, responsive через clamp()');
  assertTrue(/\.hb-stat \.ci2-v\{font-size:clamp\(/.test(css), 'показатели — responsive font-size через clamp()');
  // header на Главной
  assertTrue(/\.app:has\(#scrRecords\.active\) \.topbar:not\(\.scrolled\)\{background:transparent\}/.test(css), 'header на Главной прозрачный (стекло .scrolled при прокрутке сохранено)');
  assertTrue(/\.app:has\(#scrRecords\.active\) \.hdr-search\{flex:0 1 auto;width:min\(54%,208px\)/.test(css), 'поиск — компактная капсула по центру, не на всю ширину');
  assertTrue(/id="searchTop"/.test(html) && /\$\('#searchTop'\)\.onclick=openSearch;/.test(html), 'кнопка поиска использует существующий openSearch');
  assertTrue(/\$\('#anaTop'\)\.onclick=\(\)=>showScreen\('scrCharts'\);/.test(html), 'кнопка графиков — существующий переход на Аналитику');
  assertTrue(/\.app:has\(#scrRecords\.active\) \.periods\{background:transparent;border-color:transparent;padding:0;gap:0\}/.test(css), 'сегмент периода на Главной без белой карточки');
  assertTrue(/\.app:has\(#scrRecords\.active\) \.periods-indicator\{top:0;height:100%/.test(css), 'активный пункт — capsule на том же #periodsIndicator (логика не дублируется)');
  assertTrue(/#scrRecords \.month-switch \.m-arrow\{width:44px;height:44px/.test(css), 'стрелки периода: touch target 44×44');
  assertTrue(/#scrRecords \.month-switch \.m-arrow svg\{width:30px;height:30px/.test(css), 'шеврон стрелок ~30px');
  assertTrue(/<div class="home-list-head">Записи<\/div>\s*<div id="recentList"><\/div>/.test(html), 'заголовок «Записи» перед списком, список не изменён');
  // .periods вне Главной (Аналитика) — базовое правило не тронуто
  assertTrue(/^\s*\.periods\{position:relative;display:flex;background:var\(--card\);border:1px solid var\(--line\);border-radius:12px;padding:3px;gap:2px\}/m.test(css),
    'базовое правило .periods (Аналитика) не изменено');
  assertTrue(/^\s*\.hdr-search\{flex:1 1 auto;min-width:0;height:44px/m.test(css), 'базовое правило .hdr-search (другие экраны) не изменено');
}

// ============ §4 — фон Главной: прозрачный экран над слоем; остальные экраны — прежний токен; dark ============
{
  assertTrue(/#scrRecords\{background:transparent\}/.test(css), '#scrRecords прозрачен (фон рисует .finance-ambient)');
  assertTrue(/\.scroll-area:has\(>#scrRecords\.active\)\{background:transparent\}/.test(css), '.scroll-area на Главной прозрачна');
  ['#scrCharts', '#scrAccounts', '#scrBudgets'].forEach(id =>
    assertTrue(new RegExp(`${id}\\{background:var\\(--main-bg-grad\\)\\}`).test(css), `${id} — прежний фон --main-bg-grad`));
  const light = css.slice(css.indexOf(':root, [data-theme="light"]{'), css.indexOf('[data-theme="dark"]{'));
  const dark = css.slice(css.indexOf('[data-theme="dark"]{'), css.indexOf('*{box-sizing'));
  ['--hero-top', '--hero-bottom', '--hero-b1', '--hero-b2', '--hero-b3', '--hero-b4', '--hero-glass', '--hero-capsule', '--hero-sep'].forEach(t => {
    assertTrue(new RegExp(`${t}:`).test(light), `светлая тема: токен ${t}`);
    assertTrue(new RegExp(`${t}:`).test(dark), `тёмная тема: свой токен ${t}`);
  });
  assertTrue(/--hero-b4:rgba\(79,125,240,/.test(light), 'blob medium blue = существующий --nav-blue (#4f7df0), не новый цвет');
  assertTrue(/\.topbar\{[^}]*padding:max\(10px,env\(safe-area-inset-top\)\)/.test(css), 'header учитывает env(safe-area-inset-top)');
}

// ============ §5 — бизнес-логика не тронута, версия кэша ============
{
  assertTrue(/function renderFinanceCard\(\)\{\s*const FC=AF\.Services\.FinanceCard, PR=AF\.Services\.Period, now=new Date\(\);/.test(html), 'renderFinanceCard() на месте');
  assertTrue(/const totals=FC\.totals\(state,from,to,txBase\);/.test(html), 'доходы/расходы/поток — прежний FC.totals()');
  assertTrue(/const capChg=FC\.capitalChange\(state,from,to,now,/.test(html), 'общий баланс — прежний FC.capitalChange() (абсолютный капитал)');
  assertTrue(/\$\('#fcMonthPrev'\)\.onclick=\(\)=>\{if\(period==='custom'\)return;fcMonthAnimDir=-1;shiftPeriod\(-1\);\};/.test(html), 'стрелка назад — прежний shiftPeriod(-1)');
  assertTrue(/function shiftPeriod\(dir\)\{anchor=AF\.Services\.Period\.shiftAnchor\(period,anchor,dir\);render\(\);\}/.test(html), 'shiftPeriod() не изменён');
  assertTrue(/function renderRecent\(list\)\{/.test(html) && /function homeGroupedTxHtml\(list\)\{/.test(html), 'список операций (renderRecent/homeGroupedTxHtml) на месте');
  assertTrue(!/<video|WebGL|requestAnimationFrame\(heroLoop/.test(html), 'без видео/WebGL/JS-анимационного цикла для фона');
  assertTrue(/const CACHE = 'finance-v179';/.test(sw), 'sw.js: версия кэша поднята до finance-v179');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
