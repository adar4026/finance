// tests/category_tx_screen.test.js — тесты для TASK_041 (визуальное
// приведение экрана «Операции по категории», #catTxOverlay, к единой
// системе с Главной: фон, карточки, круглая кнопка «Назад», компактная
// шапка/фильтры, починка обрезания «/год»).
//
// Задача чисто интерфейсная — фильтрация/расчёты (catTxRange/renderCatTx)
// не менялись, поэтому проверки статические — regex по index.html и sw.js
// (тот же приём, что tests/budgets_screen.test.js/tests/profile_screen.test.js):
//  1. Кнопка «Назад» — круглая, без border на var(--text), старый × удалён.
//  2. Шапка — одна строка [back][title], не центрировано.
//  3. Фон экрана — тот же токен, что #scrRecords (var(--main-bg-grad)).
//  4. Summary-карточка — переиспользует .fincard (не новый дублирующий стиль).
//  5. /год не обрезается — ellipsis/nowrap убраны из .cat-avg .ca-i.
//  6. Карточки операций — Home-стиль (.home-daycard/.home-tx), не старые
//     .daycard/.tx; при этом groupedTxHtml()/.tx/.daycard (используются
//     «Все операции») не тронуты.
//  7. Компактный заголовок дня — новая функция catxDayLabel(), не трогает
//     dayLabelFull() (используется другими экранами).
//  8. Расчётная логика (catTxRange/monthsInRange/renderCatTx фильтрация)
//     не изменена.
//  9. Версия кэша service worker поднята.
// Запуск: node tests/category_tx_screen.test.js

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// ============ §1 — кнопка «Назад»: круглая, мягкая, без старого × ============
{
  assertTrue(/<button class="catx-back" id="catTxClose" aria-label="Назад">/.test(html),
    'index.html: #catTxClose — новая круглая кнопка .catx-back (не .iconbtn)');
  assertTrue(!/<button class="iconbtn" id="catTxClose">×<\/button>/.test(html),
    'index.html: старая кнопка × (.iconbtn) для #catTxClose удалена');
  assertTrue(/\.catx-back\{width:46px;height:46px;border-radius:50%/.test(html),
    'index.html: .catx-back — круглая, 46px (в диапазоне 44–48px)');
  assertTrue(/\.catx-back\{[^}]*border:1px solid rgba\(0,0,0,\.07\)/.test(html),
    'index.html: .catx-back — мягкая полупрозрачная граница, не сплошная тёмная (не var(--text))');
  assertTrue(!/\.catx-back\{[^}]*border:1\.6px solid var\(--text\)/.test(html),
    'index.html: .catx-back НЕ использует жёсткую обводку var(--text) (в отличие от .secp-back)');
  assertTrue(/\.catx-back\{[^}]*box-shadow:var\(--fincard-shadow\)/.test(html),
    'index.html: .catx-back — лёгкая тень var(--fincard-shadow) (Home-токен, не новый)');
  assertTrue(/\.catx-back\{[^}]*background:var\(--card\)/.test(html),
    'index.html: .catx-back — светлый фон var(--card)');
}

// ============ §2 — шапка: одна строка [back][title], не центрировано ============
{
  assertTrue(/<div class="catx-nav">\s*<button class="catx-back"/.test(html),
    'index.html: .catx-nav — кнопка «Назад» первым элементом строки шапки');
  assertTrue(/<div class="catx-title" id="catTxTitle">/.test(html),
    'index.html: #catTxTitle — .catx-title, часть той же строки .catx-nav (не отдельный .detail-top)');
  assertTrue(/\.catx-title\{flex:1;min-width:0;/.test(html),
    'index.html: .catx-title — flex:1 (растягивается рядом с кнопкой, не центрируется абсолютно)');
  assertTrue(!/\.catx-title\{[^}]*position:absolute/.test(html),
    'index.html: .catx-title не использует absolute-центрирование (в отличие от .secp-title/.prof-title)');
  assertTrue(/\.catx-title\{[^}]*-webkit-line-clamp:2/.test(html),
    'index.html: .catx-title — длинные названия переносятся до 2 строк с аккуратной обрезкой, без разрушения layout');
}

// ============ §3 — фон экрана = тот же токен, что «Главная» ============
{
  const recM = html.match(/#scrRecords\{background:var\((--[\w-]+)\)\}/);
  assertTrue(!!recM, '#scrRecords{background:var(--...)} найден в index.html (эталон)');
  const bgToken = recM && recM[1];
  assertTrue(!!bgToken && new RegExp(`\\.catx-page\\{background:var\\(${bgToken.replace(/-/g, '\\-')}\\)`).test(html),
    'index.html: .catx-page использует тот же фон-токен, что #scrRecords (Home), не новый подобранный цвет');
}

// ============ §4 — summary-карточка переиспользует .fincard ============
{
  assertTrue(/<div class="fincard catx-summary">/.test(html),
    'index.html: обёртка сумм/среднего — буквально класс .fincard (переиспользование Home-компонента), не новый дублирующий стиль');
  const fincardRuleCount = (html.match(/^\s*\.fincard\{/gm) || []).length;
  assertTrue(fincardRuleCount === 1, 'index.html: базовое правило .fincard{...} не задублировано под категорию');
}

// ============ §5 — «/год» больше не обрезается («€4 50...») ============
{
  assertTrue(/\.cat-avg \.ca-i\{[^}]*white-space:normal/.test(html),
    'index.html: .cat-avg .ca-i — white-space:normal (не nowrap), длинные суммы переносятся, а не обрезаются');
  assertTrue(!/\.cat-avg \.ca-i\{[^}]*text-overflow:ellipsis/.test(html),
    'index.html: .cat-avg .ca-i больше не задаёт text-overflow:ellipsis');
  assertTrue(/\.cat-avg \.ca-i\{[^}]*font-size:clamp\(/.test(html),
    'index.html: .cat-avg .ca-i — адаптивный font-size (clamp), помогает длинным суммам помещаться');
}

// ============ §6 — карточки операций: Home-стиль, «Все операции» не тронуты ============
{
  assertTrue(/function catxGroupedTxHtml\(list\)\{/.test(html),
    'index.html: новая функция catxGroupedTxHtml() — рендер списка операций только для #catTxList');
  assertTrue(/catxGroupedTxHtml\(list\)[^;]*;[\s\S]{0,40}home-tx/.test(html) || /\$\('#catTxList'\)\.innerHTML=catxGroupedTxHtml\(list\);/.test(html),
    'renderCatTx(): #catTxList рендерится через catxGroupedTxHtml (Home-стиль), не через старый groupedTxHtml');
  assertTrue(/\$\$\('#catTxList \.home-tx'\)\.forEach\(x=>x\.onclick=\(\)=>openSheet\(x\.dataset\.id\)\);/.test(html),
    'renderCatTx(): обработчик клика по строке операции навешивается на .home-tx (Home-компонент), клик по-прежнему открывает openSheet()');
  assertTrue(/<div class="home-daycard">\$\{items\.map\(homeTxRow\)\.join\(''\)\}<\/div><\/div>`;\s*\}\)\.join/.test(html),
    'catxGroupedTxHtml(): строки рендерятся homeTxRow() (тот же компонент, что на Главной)');
  // «Все операции» и общий groupedTxHtml/.tx/.daycard — НЕ затронуты
  assertTrue(/function groupedTxHtml\(list\)\{/.test(html), 'groupedTxHtml() (используется «Все операции») присутствует без изменений');
  assertTrue(/\$\('#allTxList'\)\.innerHTML=groupedTxHtml\(state\.tx\.filter\(inPeriod\)\);/.test(html),
    'openAllTx(): «Все операции» по-прежнему рендерится через groupedTxHtml (старый .tx/.daycard), не переключены на Home-компонент');
}

// ============ §7 — компактный заголовок дня — новая функция, dayLabelFull() не тронута ============
{
  assertTrue(/function catxDayLabel\(day\)\{/.test(html), 'index.html: новая функция catxDayLabel() (компактный заголовок дня)');
  assertTrue(/function dayLabelFull\(day\)\{/.test(html), 'dayLabelFull() (используется другими экранами) присутствует без изменений');
  assertTrue(/const s=new Date\(day\)\.toLocaleDateString\('ru-RU',\{weekday:'long',day:'numeric',month:'long',year:'numeric'\}\);/.test(html),
    'dayLabelFull(): формат (длинный день недели + год) не изменён');
  assertTrue(/const wd=d\.toLocaleDateString\('ru-RU',\{weekday:'short'\}\);/.test(html) &&
    /const rest=d\.toLocaleDateString\('ru-RU',\{day:'numeric',month:'long'\}\);/.test(html),
    'catxDayLabel(): короткий день недели + число/месяц без года');
}

// ============ §8 — расчётная логика не изменена ============
{
  assertTrue(/function catTxRange\(\)\{/.test(html), 'catTxRange() присутствует без изменений сигнатуры');
  assertTrue(/function monthsInRange\(from,to\)\{/.test(html), 'monthsInRange() присутствует без изменений сигнатуры');
  assertTrue(/const list=state\.tx\.filter\(t=>t\.type===ty&&catTxIds\.includes\(t\.cat\)&&inAnaRange\(t,r\)\);/.test(html),
    'renderCatTx(): фильтрация операций по категории/периоду не изменена');
  assertTrue(/const sum=list\.reduce\(\(s,t\)=>s\+txBase\(t\),0\);/.test(html), 'renderCatTx(): расчёт суммы не изменён');
  assertTrue(/const avgM=sum\/months, avgY=avgM\*12;/.test(html), 'renderCatTx(): расчёт средних /мес и /год не изменён');
  assertTrue(/function openCatTx\(catIds,label,range,rangeLabel,type\)\{/.test(html), 'openCatTx() — сигнатура и точки входа (Аналитика/Бюджеты) не изменены');
}

// ============ §9 — версия кэша service worker поднята ============
{
  const m = sw.match(/const CACHE = 'finance-v(\d+)'/);
  assertTrue(!!m, 'sw.js: CACHE найден');
  if (m) assertTrue(parseInt(m[1], 10) >= 171, "sw.js: версия кэша поднята до finance-v171 или выше (TASK_041)");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
