// tests/home_income_expense_ratio.test.js — TASK_053: Главная — тонкая текстовая
// шкала соотношения доходов/расходов под .hb-stats. Статические проверки по
// исходнику index.html/sw.js (тот же приём, что tests/home_balance_drawer.test.js)
// — задача только визуальная, юнит-тесты самой доли ratio() уже покрыты
// tests/finance_card_service.test.js.
// Запуск: node tests/home_income_expense_ratio.test.js

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

// ============ §1 — разметка: место, состав, без дублирования ============
{
  // ровно между .hb-stats и «Записи», внутри #finCard (не отдельным блоком экрана)
  const finCardM = homeBlock.match(/<div class="hero-balance" id="finCard">([\s\S]*?)<\/div>\s*<div class="home-list-head">Записи<\/div>/);
  assertTrue(!!finCardM, '#finCard содержит .hb-stats + шкалу и сразу за ним «Записи» (без промежуточных блоков)');
  const finCardInner = finCardM ? finCardM[1] : '';
  const statsIdx = finCardInner.indexOf('class="hb-stats"');
  const ratioIdx = finCardInner.indexOf('id="fcRatio"');
  assertTrue(statsIdx > -1 && ratioIdx > statsIdx, '#fcRatio идёт после .hb-stats внутри #finCard');

  ['fcRatio', 'fcRatioInc', 'fcRatioExp'].forEach(id => {
    assertEqual((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `#${id}: единственный экземпляр во всём документе`);
  });
  assertTrue(/<div class="hb-ratio" id="fcRatio" role="img" aria-label="[^"]*">/.test(homeBlock), '#fcRatio — role="img" с исходным aria-label (обновляется в JS)');
  assertTrue(/<div class="hb-ratio-inc" id="fcRatioInc" aria-hidden="true"><\/div>/.test(homeBlock), '#fcRatioInc — пустой, aria-hidden (не читается screen reader отдельно)');
  assertTrue(/<div class="hb-ratio-exp" id="fcRatioExp" aria-hidden="true"><\/div>/.test(homeBlock), '#fcRatioExp — пустой, aria-hidden');
}

// ============ §2 — отсутствие видимого текста внутри шкалы ============
{
  const ratioM = homeBlock.match(/<div class="hb-ratio" id="fcRatio"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  const ratioBlock = ratioM ? ratioM[0] : '';
  assertTrue(ratioBlock.length > 0, 'блок #fcRatio найден для проверки текста');
  // между открывающим и закрывающим div сегментов нет текстовых узлов, только вложенные div'ы
  const inner = ratioBlock.replace(/<div[^>]*>/g, '').replace(/<\/div>/g, '').trim();
  assertEqual(inner, '', '#fcRatio: внутри разметки нет видимого текста/цифр (только пустые сегменты-div)');
}

// ============ §3 — CSS: без карточки, компактный отступ, семантические токены ============
{
  const ratioCss = ruleBody('.hb-ratio');
  assertTrue(!!ratioCss, 'CSS-правило .hb-ratio найдено');
  assertTrue(/height:[7-9]px/.test(ratioCss), '.hb-ratio: высота 7–9px (тонкая линия)');
  assertTrue(/border-radius:999px/.test(ratioCss), '.hb-ratio: pill-скругление по всей длине');
  assertTrue(/overflow:hidden/.test(ratioCss), '.hb-ratio: overflow:hidden — сегменты обрезаются по форме pill');
  assertTrue(/background:var\(--line\)/.test(ratioCss), '.hb-ratio: нейтральный фон — существующий токен --line (виден только когда нет данных)');
  assertTrue(!/border:|box-shadow:|backdrop-filter:/.test(ratioCss), '.hb-ratio: без рамки/тени/blur — не карточка');
  const mtM = ratioCss.match(/margin-top:(\d+)px/);
  assertTrue(!!mtM && +mtM[1] <= 10, '.hb-ratio: компактный отступ сверху (≤10px)');
  assertTrue(!/margin-bottom|padding-bottom/.test(ratioCss), '.hb-ratio: без нижнего отступа — не сдвигает «Записи» лишним воздухом');

  const incCss = ruleBody('.hb-ratio-inc'), expCss = ruleBody('.hb-ratio-exp');
  assertTrue(!!incCss && /background:var\(--income\)/.test(incCss), '.hb-ratio-inc: цвет — существующий семантический токен --income');
  assertTrue(!!expCss && /background:var\(--expense\)/.test(expCss), '.hb-ratio-exp: цвет — существующий семантический токен --expense');
  // никаких новых hex/rgba цветов в добавленных правилах
  [ratioCss, incCss, expCss].forEach(css => {
    assertTrue(!/#[0-9a-fA-F]{3,8}\b/.test(css) && !/rgba?\(/.test(css), 'CSS шкалы не хардкодит новый цвет (#hex/rgb) — только var(--...)');
  });
}

// ============ §4 — renderFinanceCard(): ratio() пишется из того же totals(), без второй агрегации ============
{
  assertTrue(/function renderFinanceCard\(\)\{\s*const FC=AF\.Services\.FinanceCard, PR=AF\.Services\.Period, now=new Date\(\);/.test(html),
    'renderFinanceCard() — та же единственная функция (не создана копия)');
  assertEqual((html.match(/function renderFinanceCard\(\)/g) || []).length, 1, 'renderFinanceCard() определена ровно один раз');
  assertTrue(/const ratio=FC\.ratio\(totals\);/.test(html), 'шкала считается из FC.ratio(totals) — того же totals, что заполняет #fcInc/#fcExp/#fcFlow');
  assertTrue(/\$\('#fcRatioInc'\)\.style\.width=ratio\.incomePct\+'%';/.test(html), '#fcRatioInc: ширина сегмента из ratio.incomePct');
  assertTrue(/\$\('#fcRatioExp'\)\.style\.width=ratio\.expensePct\+'%';/.test(html), '#fcRatioExp: ширина сегмента из ratio.expensePct');
  assertTrue(/\$\('#fcRatio'\)\.setAttribute\('aria-label',ratio\.hasData\?`Доходы \$\{ratio\.incomeLabelPct\}%, расходы \$\{ratio\.expenseLabelPct\}%`:'Нет доходов и расходов за период'\);/.test(html),
    '#fcRatio: динамический aria-label с процентами, либо нейтральный текст при отсутствии данных — не выводится визуально (aria-атрибут)');
  // расчёт totals()/#fcInc/#fcExp/#fcFlow — не изменён
  assertTrue(/\$\('#fcInc'\)\.textContent='\+'\+num\(totals\.income\);/.test(html), '#fcInc: расчёт не изменён');
  assertTrue(/\$\('#fcExp'\)\.textContent='−'\+num\(totals\.expense\);/.test(html), '#fcExp: расчёт не изменён');
  assertTrue(/const totals=FC\.totals\(state,from,to,txBase\);/.test(html), 'totals() — тот же вызов, вторая независимая агрегация не создана');
}

// ============ §5 — обновление при каждом периоде: ratio() вызывается внутри той же render-функции,
// что уже вызывается shiftPeriod()/сменой периода/после CRUD (тот же контракт, что #fcInc/#fcExp) ============
{
  // ratio-строки идут ПОСЛЕ строк #fcInc/#fcExp/#fcFlow и ДО конца функции — в одном потоке выполнения,
  // значит пересчитывается при каждом вызове renderFinanceCard(), как и остальная сводка.
  const fnM = html.match(/function renderFinanceCard\(\)\{[\s\S]*?\n\}/);
  assertTrue(!!fnM, 'тело renderFinanceCard() найдено целиком');
  const fnBody = fnM ? fnM[0] : '';
  const incIdx = fnBody.indexOf("$('#fcInc')");
  const ratioIdx = fnBody.indexOf('FC.ratio(totals)');
  assertTrue(incIdx > -1 && ratioIdx > incIdx, 'FC.ratio(totals) вызывается в том же проходе renderFinanceCard(), после заполнения #fcInc — синхронно с сводкой');
  assertTrue(/function shiftPeriod\(dir\)\{anchor=AF\.Services\.Period\.shiftAnchor\(period,anchor,dir\);render\(\);\}/.test(html),
    'shiftPeriod() (День/Неделя/Месяц/Год/Период, смена месяца) по-прежнему вызывает общий render() → renderFinanceCard() → пересчёт шкалы');
}

// ============ §6 — версия кэша ============
{
  assertTrue(/const CACHE = 'finance-v(\d+)';/.test(sw) && parseInt(sw.match(/finance-v(\d+)/)[1], 10) >= 185, "sw.js: версия кэша ≥ finance-v185");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
