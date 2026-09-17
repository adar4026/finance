// tests/immersive_screens.test.js — TASK_048: Аналитика / Счета / Бюджеты
// приведены к immersive UI-системе Главной (TASK_047): один общий ambient-слой,
// один сегмент периода, один month-switch, hero-показатели без карточек.
// Статические проверки по исходнику index.html/sw.js (тот же приём, что
// tests/home_hero_screen.test.js) — бизнес-логика не менялась.
// Запуск: node tests/immersive_screens.test.js

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
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const SCOPE = '\\.app:has\\(\\.immersive\\.active\\)';

// ============ §1 — один общий ambient-слой на четыре экрана ============
{
  ['scrRecords', 'scrCharts', 'scrAccounts', 'scrBudgets'].forEach(id =>
    assertTrue(new RegExp(`<div class="screen immersive( active)?" id="${id}">`).test(html), `#${id} помечен классом .immersive`));
  assertEqual((html.match(/class="screen immersive/g) || []).length, 4, 'ровно четыре immersive-экрана (Профиль/Настройки — нет)');
  assertTrue(!/<div class="screen immersive" id="scrMore">/.test(html), '#scrMore не immersive');
  assertEqual((html.match(/id="financeAmbient"/g) || []).length, 1, 'единственный слой .finance-ambient — в .app, не по одному на экран');
  assertTrue(new RegExp(`${SCOPE} \\.finance-ambient\\{display:block\\}`).test(css), 'видимость слоя — одно правило по .immersive, не четыре');
  assertTrue(!/\.app:has\(#scrCharts\.active\)|\.app:has\(#scrAccounts\.active\)|\.app:has\(#scrBudgets\.active\)/.test(css),
    'нет отдельных per-screen копий scope-селектора');
  assertTrue(/#scrRecords,#scrCharts,#scrAccounts,#scrBudgets\{background:transparent\}/.test(css), 'четыре экрана прозрачны над слоем');
  assertTrue(/\.scroll-area:has\(>\.immersive\.active\)\{background:transparent\}/.test(css), '.scroll-area прозрачна над слоем на immersive-экранах');
  assertTrue(!/#scrCharts\{background:var\(--main-bg-grad\)\}|#scrAccounts\{background:var\(--main-bg-grad\)\}|#scrBudgets\{background:var\(--main-bg-grad\)\}/.test(css),
    'старые плоские фоны экранов удалены');
  // токены/анимация/dark/reduced-motion — те же, без дублирования
  assertEqual((css.match(/@keyframes hero-drift-1\{/g) || []).length, 1, 'keyframes слоя не продублированы');
  assertEqual((css.match(/\.ambient-blob\{animation:none;will-change:auto\}/g) || []).length, 1, 'reduced-motion — одно правило на все экраны');
  assertEqual((css.match(/--hero-b1:/g) || []).length, 2, 'токены --hero-* — по одному набору на светлую и тёмную тему, без per-screen копий');
}

// ============ §2 — header / сегмент периода / subhead — общий scope ============
{
  ['\\.topbar:not\\(\\.scrolled\\)\\{background:transparent\\}', '\\.hdr-search\\{flex:0 1 auto', '\\.hdr-ana\\{background:var\\(--hero-glass\\)',
   '\\.subhead\\{padding-top:6px\\}', '\\.periods\\{background:transparent;border-color:transparent;padding:0;gap:0\\}',
   '\\.periods-indicator\\{top:0;height:100%'].forEach(rule =>
    assertTrue(new RegExp(`${SCOPE} ${rule}`).test(css), `правило "${rule.slice(0, 30)}…" в общем scope .immersive`));
  assertTrue(!/\.app:has\(#scrRecords\.active\)/.test(css), 'Home-only scope (#scrRecords) больше не используется');
  assertEqual((html.match(/id="periods"/g) || []).length, 1, 'единственный #periods (общий для Главной и Аналитики)');
  assertTrue(/<div class="periods" id="anaCatSeg"/.test(html), 'сегмент Расходы/Доходы Аналитики — тот же .periods (тот же стиль capsule)');
}

// ============ §3 — один month-switch для #fcMonthSwitch и #navrow ============
{
  assertTrue(/<div class="month-switch" id="navrow">/.test(html), '#navrow — компонент .month-switch (не старый .navrow)');
  assertTrue(/<button type="button" class="m-arrow" id="prevP" aria-label="Назад"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"\/><\/svg><\/button>/.test(html),
    '#prevP — тот же SVG-шеврон, что #fcMonthPrev');
  assertTrue(/<button type="button" class="m-arrow" id="nextP" aria-label="Вперёд"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"\/><\/svg><\/button>/.test(html),
    '#nextP — тот же SVG-шеврон, что #fcMonthNext');
  assertTrue(/<div class="m-label" id="periodLabel" aria-live="polite">/.test(html), '#periodLabel — .m-label');
  assertEqual((html.match(/id="navrow"/g) || []).length, 1, 'единственный #navrow');
  assertTrue(/\.month-switch \.m-arrow\{width:44px;height:44px;flex:0 0 44px/.test(css), 'базовое правило .month-switch: touch 44×44 (одно на оба переключателя)');
  assertTrue(/\.month-switch \.m-arrow svg\{width:30px;height:30px/.test(css), 'базовое правило: шеврон 30px');
  assertTrue(!/#scrRecords \.month-switch/.test(css), 'нет Home-only override для month-switch — единый компонент');
  assertTrue(/#navrow \.m-label::first-letter\{text-transform:uppercase\}/.test(css), 'первая буква подписи периода — как fcCapFirst() на Главной (без capitalize каждого слова)');
  assertTrue(/^\s*\.navrow\{display:flex/m.test(css) && /<div class="navrow" id="catTxNav">/.test(html), 'глобальный .navrow (overlay «Операции по категории») не тронут');
  // обработчики не менялись
  assertTrue(/\$\('#prevP'\)\.onclick=\(\)=>shiftPeriod\(-1\);/.test(html) && /\$\('#nextP'\)\.onclick=\(\)=>shiftPeriod\(1\);/.test(html), '#prevP/#nextP — прежний shiftPeriod()');
  assertTrue(/\$\('#navrow'\)\.style\.display=\(noPeriod\|\|period==='all'\|\|id==='scrRecords'\)\?'none':'flex';/.test(html), 'showScreen(): логика показа #navrow не изменена');
}

// ============ §4 — Аналитика: сегмент + donut без карточки, графики на месте ============
{
  assertTrue(/<div class="panel ana-top">\s*<div class="periods" id="anaCatSeg"/.test(html), 'первая панель Аналитики — .ana-top (без карточки)');
  assertTrue(/#scrCharts \.panel\.ana-top\{background:transparent;border:none;box-shadow:none/.test(css), '.ana-top: без фона/рамки/тени');
  assertTrue(/#scrCharts \.ana-top \.catlist2\{background:var\(--card\)/.test(css), 'легенда категорий — остаётся карточкой');
  assertTrue(!/class="panel ana-hero"/.test(html), 'не используется старый .ana-hero (сиреневый, color:#fff)');
  ['pieChart', 'barChart', 'capChart', 'distChart', 'anaCompare', 'catLegend', 'capRanges'].forEach(id =>
    assertEqual((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `id="${id}" сохранён`));
  assertEqual((html.match(/<div class="screen immersive" id="scrCharts">[\s\S]*?<div class="panel">/g) || []).length, 1, 'остальные .panel Аналитики — карточки, как были');
  assertTrue(/^\s*\.panel\{background:var\(--card\);border:1px solid var\(--line\);border-radius:20px;padding:18px;margin-bottom:14px\}/m.test(css), 'глобальный .panel не изменён');
}

// ============ §5 — Счета: «Общий капитал» = .hero-balance ============
{
  assertTrue(/<div class="hero-balance acc-hero">\s*<div class="hb-head"><span class="hb-label">Общий капитал <span id="capEye2" class="hb-eye" style="cursor:pointer">👁<\/span><\/span><\/div>\s*<div class="hb-val" id="accTotalCapital">€0<\/div>\s*<div class="hb-cur" id="accCapCur">EUR<\/div>\s*<\/div>/.test(html),
    'разметка героя Счетов: label + глаз, сумма, валюта — ids сохранены');
  assertTrue(!/<div class="capital cap-simple">/.test(html), 'сиреневая .capital.cap-simple убрана');
  assertTrue(/\$\('#accTotalCapital'\)\.textContent=num\(totalCapital\(\)\);/.test(html) && /\$\('#accCapCur'\)\.textContent=curCode\(state\.currency\);/.test(html), 'renderAccountsScreen() не менялась');
  assertTrue(/\$\('#capEye2'\)\.onclick=/.test(html), 'обработчик глаза сохранён');
  ['accList', 'accEditBtn', 'addAccBtn', 'addGroupBtn', 'distList', 'distCount'].forEach(id =>
    assertEqual((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `id="${id}" сохранён`));
  assertTrue(/^\s*\.capital\{background:var\(--cap-grad\)/m.test(css), 'глобальный .capital (Статистика #statsHero) не тронут');
}

// ============ §6 — Бюджеты: герой без карточки на общем компоненте ============
{
  assertTrue(/bt\.className='hero-balance bud-hero';/.test(html), 'renderBudgets(): контейнер героя — .hero-balance.bud-hero');
  assertTrue(!/bt\.className='capital bud-hero'/.test(html), 'старый .capital у героя бюджета не используется');
  assertTrue(!/#scrBudgets \.capital\{/.test(html) && !/#scrAccounts \.capital\{/.test(html), 'мёртвые правила #scrBudgets/#scrAccounts .capital удалены');
  assertTrue(/\.bud-hero \.bh-val\{font-size:clamp\(34px,11vw,46px\)/.test(css), 'остаток бюджета — та же типографика, что баланс Главной/капитал Счетов');
  assertTrue(/\.bud-hero \.bh-bar\{height:10px;background:var\(--hero-sep\)/.test(css) && /\.bud-hero \.bh-fill\{height:100%;background:var\(--nav-blue\)/.test(css), 'прогресс — токены темы, не белый на градиенте');
  assertTrue(!/\.bud-hero \.bh-fill\{[^}]*#fff/.test(css) && !/\.bud-hero \.bh-foot\{[^}]*#fff/.test(css), 'в .bud-hero нет захардкоженного белого');
  // остальная логика бюджетов не тронута
  assertTrue(/function budgetMonthRange\(\)\{const a=new Date\(anchor\);/.test(html) && /function budgetTotals\(\)\{/.test(html), 'budgetMonthRange()/budgetTotals() на месте');
  assertTrue(/<div class="bud-card" data-cat="\$\{cid\}">/.test(html) && /\.bud-card\{background:var\(--card\)/.test(css), 'карточки категорий — как были');
  ['budgetTotal', 'budCards', 'addBudgetBtn'].forEach(id => assertEqual((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `id="${id}" сохранён`));
}

// ============ §7 — версия кэша ============
{
  const m = sw.match(/const CACHE = 'finance-v(\d+)';/);
  assertTrue(!!m && parseInt(m[1], 10) >= 180, 'sw.js: версия кэша поднята до finance-v180 или выше');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
