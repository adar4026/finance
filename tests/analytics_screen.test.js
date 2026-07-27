// tests/analytics_screen.test.js — тесты для TASK_019 (редизайн экрана «Аналитика»).
// Два слоя проверок:
//  1. Юнит-тесты чистой функции AF.Services.Analytics.compare() — логика
//     «Сравнение с прошлым периодом»: обычный случай, нулевой предыдущий
//     период, отсутствие данных — без NaN/Infinity.
//  2. Статические regex-проверки index.html (по образцу §7
//     tests/demo_data_service.test.js) — состав/порядок секций экрана
//     «Аналитика», отсутствие старой фиолетовой карточки, единственность
//     обработчиков, отсутствие регресса класса TASK_018 ($$(...).map()
//     напрямую на NodeList).
// Запуск: node tests/analytics_screen.test.js

const fs = require('fs');
const path = require('path');

global.window = global;
require('../js/services/analytics_service.js');
const A = AF.Services.Analytics;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// ============ §1 — compare(): обычный случай (без state — сырые суммы) ============
{
  const cur = [{ type: 'income', amount: 1000 }, { type: 'expense', amount: 400 }];
  const pre = [{ type: 'income', amount: 800 }, { type: 'expense', amount: 500 }];
  const r = A.compare(cur, pre);
  assertEqual(r.income.cur, 1000, 'compare(): income.cur');
  assertEqual(r.income.prev, 800, 'compare(): income.prev');
  assertEqual(r.income.deltaPct, 25, 'compare(): income.deltaPct (рост на 25%)');
  assertEqual(r.expense.cur, 400, 'compare(): expense.cur');
  assertEqual(r.expense.deltaPct, -20, 'compare(): expense.deltaPct (снижение на 20%)');
}

// ============ §2 — compare(): нулевой предыдущий период (без NaN/Infinity) ============
{
  const cur = [{ type: 'income', amount: 500 }];
  const pre = [];
  const r = A.compare(cur, pre);
  assertEqual(r.income.prev, 0, 'compare(): нулевой предыдущий доход');
  assertEqual(r.income.deltaPct, 0, 'compare(): deltaPct=0 при нулевом предыдущем (не NaN/Infinity)');
  assertTrue(Number.isFinite(r.income.deltaPct), 'compare(): income.deltaPct — конечное число');
  assertTrue(Number.isFinite(r.expense.deltaPct), 'compare(): expense.deltaPct — конечное число (оба периода без расходов)');
}

// ============ §3 — compare(): отсутствие данных в обоих периодах ============
{
  const r = A.compare([], []);
  assertEqual(r.income.cur, 0, 'compare(): нет данных — income.cur=0');
  assertEqual(r.income.deltaPct, 0, 'compare(): нет данных — income.deltaPct=0, не NaN');
  assertEqual(r.expense.deltaPct, 0, 'compare(): нет данных — expense.deltaPct=0, не NaN');
  assertTrue(Number.isFinite(r.income.deltaPct) && Number.isFinite(r.expense.deltaPct), 'compare(): нет данных — оба deltaPct конечны');
}

// ============ §4 — compare(): падение с прибыли в убыток (проверка знака) ============
{
  const cur = [{ type: 'income', amount: 100 }, { type: 'expense', amount: 300 }];
  const pre = [{ type: 'income', amount: 300 }, { type: 'expense', amount: 100 }];
  const r = A.compare(cur, pre);
  assertTrue(r.income.deltaPct < 0, 'compare(): доход упал — deltaPct отрицателен');
  assertTrue(r.expense.deltaPct > 0, 'compare(): расход вырос — deltaPct положителен');
}

// ============ §5 — статические проверки index.html (TASK_019) ============
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  // 5.1 — отсутствие старой фиолетовой финансовой карточки на «Аналитике»
  assertTrue(!/class="capital cap-ana"/.test(html), 'index.html: контейнер .capital.cap-ana полностью убран из разметки');
  // .cap-ana как класс в разметке или как CSS-селектор (.cap-ana{ / .cap-ana .xxx{) — не должен встречаться
  // нигде, кроме поясняющего текстового комментария TASK_019 (который не содержит "class=" или "{")
  const capAnaRealUsages = (html.match(/class="[^"]*\bcap-ana\b[^"]*"|\.cap-ana[ {.]/g) || []);
  assertEqual(capAnaRealUsages.length, 0, 'index.html: .cap-ana как класс разметки или CSS-правило нигде не встречается');
  assertTrue(!/id="anaNet"/.test(html), 'index.html: #anaNet (сумма результата в карточке) удалён');
  assertTrue(!/id="anaNetChg"/.test(html), 'index.html: #anaNetChg (бейдж % к пред. периоду в карточке) удалён');
  assertTrue(!/id="anaPeriodLbl"/.test(html), 'index.html: #anaPeriodLbl (подпись месяца в карточке) удалён');
  assertTrue(!/id="anaInc"/.test(html) && !/id="anaExp"/.test(html), 'index.html: #anaInc/#anaExp (доходы/расходы в карточке) удалены');
  assertTrue(!/class="seg-ie ana-cat-seg"/.test(html), 'index.html: старый класс .seg-ie.ana-cat-seg удалён');

  // 5.2 — правильный порядок секций внутри #scrCharts
  const scrM = html.match(/<div class="screen" id="scrCharts">([\s\S]*?)\n  <\/div>\n\n  <!-- Screen: Budgets/);
  assertTrue(!!scrM, '#scrCharts найден в index.html и закрывается перед экраном «Бюджеты»');
  if (scrM) {
    const body = scrM[1];
    const idxToggle = body.indexOf('id="anaCatSeg"');
    const idxPie = body.indexOf('id="pieChart"');
    const idxLegend = body.indexOf('id="catLegend"');
    const idxCompare = body.indexOf('id="anaCompare"');
    const idxBar = body.indexOf('id="barChart"');
    const idxCap = body.indexOf('id="capChart"');
    [['#anaCatSeg', idxToggle], ['#pieChart', idxPie], ['#catLegend', idxLegend],
     ['#anaCompare', idxCompare], ['#barChart', idxBar], ['#capChart', idxCap]]
      .forEach(([name, v]) => assertTrue(v >= 0, `#scrCharts: раздел ${name} найден`));
    assertTrue(idxToggle < idxPie, 'Порядок: переключатель Расходы/Доходы перед круговой диаграммой');
    assertTrue(idxPie < idxLegend, 'Порядок: круговая диаграмма перед списком категорий');
    assertTrue(idxLegend < idxCompare, 'Порядок: категории перед «Сравнение с прошлым периодом»');
    assertTrue(idxCompare < idxBar, 'Порядок: «Сравнение с прошлым периодом» перед графиком «Доходы и расходы»');
    assertTrue(idxBar < idxCap, 'Порядок: «Доходы и расходы» перед «Динамика капитала»');
    assertTrue(!/cap-ana|anaNet|anaPeriodLbl/.test(body), '#scrCharts: внутри блока экрана нет остатков старой карточки');
  }

  // 5.3 — переключатель Расходы/Доходы теперь на общем компоненте .periods/.periods-indicator
  assertTrue(/<div class="periods" id="anaCatSeg"/.test(html), 'index.html: #anaCatSeg использует общий класс .periods (Liquid Glass), не .seg-ie');
  assertTrue(/<div class="periods-indicator" id="anaCatSegInd"/.test(html), 'index.html: #anaCatSegInd — стеклянный индикатор переключателя Аналитики');

  // 5.4 — новая функция moveAnaCatSegIndicator() существует и защищена от отсутствия узлов/скрытого состояния
  const fnM = html.match(/function moveAnaCatSegIndicator\(instant\)\{[\s\S]*?\n\}/);
  assertTrue(!!fnM, 'moveAnaCatSegIndicator() найдена в index.html');
  if (fnM) {
    assertTrue(fnM[0].includes('if(!ind||!wrap)return;'), 'moveAnaCatSegIndicator(): защита от отсутствия DOM-узлов');
    assertTrue(fnM[0].includes('wrap.offsetParent===null'), 'moveAnaCatSegIndicator(): защита от скрытого состояния экрана (offsetParent===null)');
  }

  // 5.5 — подключение к resize/orientationchange/ResizeObserver (не только к клику)
  assertTrue(/navIndicatorResizeTimer=setTimeout\(\(\)=>\{[^}]*moveAnaCatSegIndicator\(true\)/.test(html), 'moveAnaCatSegIndicator(true) вызывается в обработчике resize');
  assertTrue(/orientationchange'[\s\S]{0,200}moveAnaCatSegIndicator\(true\)/.test(html), 'moveAnaCatSegIndicator(true) вызывается в обработчике orientationchange');
  assertTrue(/const anaCatSegEl=\$\('#anaCatSeg'\);\s*\n\s*if\(anaCatSegEl\)new ResizeObserver\(\(\)=>moveAnaCatSegIndicator\(true\)\)\.observe\(anaCatSegEl\);/.test(html), 'ResizeObserver подключён к #anaCatSeg');
  assertTrue(/moveAnaCatSegIndicator\(\);\s*\n\}/.test(html), 'renderAnalytics() вызывает moveAnaCatSegIndicator() на каждый рендер (как movePeriodsIndicator() для #periods)');

  // 5.6 — единственность обработчика клика переключателя (без дублирования)
  const clickMatches = html.match(/\$\$\('#anaCatSeg button'\)\.forEach\(b=>b\.onclick=/g) || [];
  assertEqual(clickMatches.length, 1, 'Обработчик клика #anaCatSeg подключается ровно один раз (без дублирующихся обработчиков)');

  // 5.7 — обработчик клика переключателя двигает индикатор и перерисовывает диаграмму/категории
  const clickBodyM = html.match(/\$\$\('#anaCatSeg button'\)\.forEach\(b=>b\.onclick=\(\)=>\{[\s\S]*?\}\);/);
  assertTrue(!!clickBodyM, 'Тело обработчика клика #anaCatSeg найдено');
  if (clickBodyM) {
    assertTrue(clickBodyM[0].includes('moveAnaCatSegIndicator()'), 'Клик по переключателю двигает Liquid Glass индикатор');
    assertTrue(clickBodyM[0].includes('renderAnaPie(anaCur,anaPre)'), 'Клик по переключателю немедленно перерисовывает круговую диаграмму и категории');
  }

  // 5.8 — regression-класс TASK_018: $$(...).map( без обёртки [...] нигде не встречается
  const badNodeListMap = html.match(/\$\$\([^)]*\)\.map\(/g) || [];
  assertEqual(badNodeListMap.length, 0, 'Нет вызовов $$(...).map() напрямую на NodeList (класс бага TASK_018) — все обёрнуты в [...]');

  // 5.9 — форматирование сумм в списке категорий через общий num()
  assertTrue(/\$\('#pieTotal'\)\.textContent=num\(total\)/.test(html), 'Сумма в центре круговой диаграммы форматируется через общий num()');
  assertTrue(html.includes("$('#catLegend').innerHTML=entries.length?rows.join('')"), 'Список категорий сохраняет существующий рендер по entries.length');
  assertTrue(html.includes('Нет доходов') && html.includes('Нет расходов'), 'Список категорий сохраняет существующее состояние «нет данных» (Нет доходов/Нет расходов)');

  // 5.10 — renderAnalytics() по-прежнему приводит в действие все аналитические блоки в прежнем порядке вызовов
  assertTrue(/renderAnaBar\(\);renderAnaPie\(cur,pre\);renderAnaCompare\(cur,pre\);renderCapChart\(\);/.test(html), 'renderAnalytics(): сохранён вызов renderAnaBar/renderAnaPie/renderAnaCompare/renderCapChart в прежнем порядке и с прежними аргументами');

  // 5.11 — общий переключатель периода и общая строка навигации периода не дублированы для Аналитики
  const periodsOccurrences = (html.match(/id="periods"/g) || []).length;
  assertEqual(periodsOccurrences, 1, 'Единственный #periods в разметке (общий для Главной и Аналитики, не задублирован)');
  const navrowOccurrences = (html.match(/id="navrow"/g) || []).length;
  assertEqual(navrowOccurrences, 1, 'Единственный #navrow в разметке (общая строка навигации периода)');

  // 5.12 — графики «Доходы и расходы» и «Динамика капитала» сохранены как есть
  assertTrue(/canvas id="barChart"/.test(html), 'canvas#barChart («Доходы и расходы») сохранён');
  assertTrue(/canvas id="capChart"/.test(html), 'canvas#capChart («Динамика капитала») сохранён');
  assertTrue(/id="capRanges"/.test(html) && /data-r="7d"/.test(html) && /data-r="all"/.test(html), 'Кнопки диапазона 7Д/1М/3М/6М/1Г/Всё («Динамика капитала») сохранены');

  // 5.13 — карточки экрана «Аналитика» получили фон/тень/радиус Главной (scoped, глобальный .panel не тронут)
  assertTrue(/#scrCharts\{background:var\(--home-bg\)\}/.test(html), 'index.html: #scrCharts получил тот же светло-серый фон, что и #scrRecords (Главная)');
  assertTrue(/#scrCharts \.panel\{border-radius:22px;box-shadow:var\(--fincard-shadow\)\}/.test(html), 'index.html: карточки .panel внутри #scrCharts получили тень/радиус .fincard (scoped-override)');
  assertTrue(/\.panel\{background:var\(--card\);border:1px solid var\(--line\);border-radius:20px;padding:18px;margin-bottom:14px\}/.test(html), 'index.html: глобальное правило .panel (используется на других экранах — Бюджеты/Счета/Health Score) не изменено');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
