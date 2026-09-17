// tests/home_balance_drawer.test.js — TASK_049: «Общий баланс» убран с Главной
// (метка/сумма/строка изменения), Доходы/Расходы/Поток подняты сразу под
// переключатель месяца, «Общий баланс» перенесён (не продублирован) в боковую
// шторку (#drawerBalance). Статические проверки по index.html/sw.js — тот же
// приём, что tests/home_hero_screen.test.js.
// Запуск: node tests/home_balance_drawer.test.js

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

// Блок — от startRe до endMarker (следующая известная секция разметки).
function block(startRe, endMarker, label) {
  const m = html.match(startRe);
  assertTrue(!!m, `${label}: блок найден в index.html`);
  if (!m) return '';
  const from = m.index;
  const end = html.indexOf(endMarker, from + m[0].length);
  assertTrue(end > from, `${label}: конец блока найден`);
  return html.slice(from, end === -1 ? html.length : end);
}

const homeBlock = block(/<div class="screen immersive active" id="scrRecords">/, '<!-- Screen: Analytics', 'Главная (#scrRecords)');
const drawerBlock = block(/<div class="overlay drawer-ov" id="drawerOverlay">/, '<!-- Безопасность', 'Боковая шторка (#drawerOverlay)');

// ============ §1 — на Главной нет отдельного блока «Общий баланс» ============
{
  ['hb-head', 'hb-label', 'hb-val', 'fc-chg'].forEach(cls => {
    assertTrue(!homeBlock.includes(`class="${cls}`) && !new RegExp(`class="[^"]*\\b${cls}\\b`).test(homeBlock),
      `Главная: класса .${cls} на экране больше нет (метка/сумма/изменение общего баланса убраны)`);
  });
  ['fcVal', 'fcChg', 'fcEye'].forEach(id => {
    assertTrue(!homeBlock.includes(`id="${id}"`), `Главная: элемента #${id} на экране больше нет (переехал в шторку)`);
  });
  // из проверки исключаем HTML-комментарии (в них само описание переноса упоминает подпись)
  const homeBlockNoComments = homeBlock.replace(/<!--[\s\S]*?-->/g, '');
  assertTrue(!/Общий баланс/.test(homeBlockNoComments), 'Главная: текста «Общий баланс» на экране больше нет (вне комментариев)');
}

// ============ §2 — порядок: месяц → Доходы/Расходы/Поток → «Записи» ============
{
  const monthIdx = homeBlock.indexOf('id="fcMonthSwitch"');
  const statsIdx = homeBlock.indexOf('class="hb-stats"');
  const listHeadIdx = homeBlock.indexOf('class="home-list-head"');
  const recentIdx = homeBlock.indexOf('id="recentList"');
  assertTrue(monthIdx > -1 && statsIdx > monthIdx, '#fcMonthSwitch идёт раньше .hb-stats');
  assertTrue(statsIdx > -1 && listHeadIdx > statsIdx, '.hb-stats идёт раньше .home-list-head («Записи»)');
  assertTrue(listHeadIdx > -1 && recentIdx > listHeadIdx, '«Записи» идёт раньше #recentList');
  // .hero-balance#finCard содержит ровно три .hb-stat, затем (TASK_053) визуальную шкалу
  // .hb-ratio, и сразу закрывается — сразу после него «Записи». Без .hb-head/.hb-val/.fc-chg —
  // они остаются перенесёнными в шторку (TASK_049), .hb-ratio не их возврат.
  assertTrue(
    /<div class="hero-balance" id="finCard">\s*<div class="hb-stats">\s*<div class="hb-stat">.*?<\/div>\s*<div class="hb-stat">.*?<\/div>\s*<div class="hb-stat">.*?<\/div>\s*<\/div>\s*(?:<!--[\s\S]*?-->\s*)?<div class="hb-ratio" id="fcRatio"[\s\S]*?<\/div>\s*<\/div>\s*<div class="home-list-head">Записи<\/div>\s*<div id="recentList"><\/div>/.test(homeBlock),
    '.hero-balance#finCard — .hb-stats (ровно 3 показателя, без .hb-head/.hb-val/.fc-chg) + шкала .hb-ratio (TASK_053), сразу за ним «Записи» и #recentList — без прочих промежуточных блоков');
}

// ============ §3 — «Общий баланс» перенесён (не продублирован) в шторку ============
{
  assertTrue(/<div class="drawer-balance" id="drawerBalance">/.test(drawerBlock), 'Шторка: компактный блок #drawerBalance присутствует');
  assertTrue(/Общий баланс/.test(drawerBlock), 'Шторка: подпись «Общий баланс» на месте');
  ['fcVal', 'fcChg', 'fcEye'].forEach(id => {
    assertTrue(drawerBlock.includes(`id="${id}"`), `Шторка: элемент #${id} перенесён внутрь #drawerBalance`);
    // единственность по всему документу — не дублирован, просто перемещён
    assertEqual((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `#${id}: единственный экземпляр во всём документе`);
  });
  // блок появляется после карточки профиля, до первой группы меню
  const headIdx = drawerBlock.indexOf('id="drawerHead"');
  const balIdx = drawerBlock.indexOf('id="drawerBalance"');
  const firstGroupIdx = drawerBlock.indexOf('drawer-group');
  assertTrue(headIdx > -1 && balIdx > headIdx && balIdx < firstGroupIdx,
    '#drawerBalance расположен между карточкой профиля и первой группой меню');
  // не карточка-кнопка навигации — не .drawer-row/.drawer-card
  const balBlockMatch = drawerBlock.match(/<div class="drawer-balance" id="drawerBalance">([\s\S]*?)<\/div>\s*<\/div>/);
  assertTrue(!!balBlockMatch && !/drawer-row|drawer-card/.test(balBlockMatch[1]), '#drawerBalance не переиспользует .drawer-row/.drawer-card (это не пункт меню)');
}

// ============ §4 — расчёт не дублируется, остальная бизнес-логика не тронута ============
{
  assertTrue(/function renderFinanceCard\(\)\{\s*const FC=AF\.Services\.FinanceCard, PR=AF\.Services\.Period, now=new Date\(\);/.test(html),
    'renderFinanceCard() — единственная функция, заполняющая #fcVal/#fcChg — не изменена');
  assertEqual((html.match(/function renderFinanceCard\(\)/g) || []).length, 1, 'renderFinanceCard() определена ровно один раз (нет копии расчёта)');
  assertTrue(/\$\('#fcVal'\)\.textContent=num\(capChg\.endCapital\);/.test(html), '#fcVal по-прежнему заполняется из capChg.endCapital (тот же метод расчёта)');
  assertTrue(/\$\('#fcEye'\)\.onclick=\(\)=>\{state\.hideAmounts=!state\.hideAmounts;save\(\);render\(\);updateEye\(\);updateFcEye\(\);\};/.test(html),
    '#fcEye: тот же обработчик скрытия сумм, работает независимо от места в DOM');
  assertTrue(/function shiftPeriod\(dir\)\{anchor=AF\.Services\.Period\.shiftAnchor\(period,anchor,dir\);render\(\);\}/.test(html), 'shiftPeriod() не изменён');
  assertTrue(/function renderRecent\(list\)\{/.test(html) && /function homeGroupedTxHtml\(list\)\{/.test(html), 'список операций (renderRecent/homeGroupedTxHtml) не тронут');
  assertTrue(/function totalCapital\(endDate\)\{return AF\.Services\.Account\.totalCapital\(state,endDate\);\}/.test(html), 'totalCapital() не изменена');
}

// ============ §5 — фон/декоративный слой Главной и версия кэша ============
{
  assertTrue(/<div class="screen immersive active" id="scrRecords">/.test(html), '#scrRecords остаётся .immersive (fluid-фон сохранён)');
  assertTrue(/\.app:has\(\.immersive\.active\) \.finance-ambient\{display:block\}/.test(html), '.finance-ambient по-прежнему показывается на immersive-экранах');
  assertTrue(/const CACHE = 'finance-v(\d+)';/.test(sw) && parseInt(sw.match(/finance-v(\d+)/)[1], 10) >= 181, "sw.js: версия кэша ≥ finance-v181");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
