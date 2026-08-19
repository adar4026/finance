// tests/budgets_screen.test.js — тесты для TASK_022 (Apple-редизайн экрана
// «Бюджеты» по образцу «Счета», TASK_020).
//
// Задача чисто интерфейсная: расчётная логика бюджетов (budgetMonthRange/
// budgetSpent/budgetIds/budgetTotals/budgetLevel/budgetColor) не менялась,
// поэтому проверки статические — regex по index.html и sw.js (тот же приём,
// что tests/analytics_screen.test.js §5 и tests/profile_screen.test.js):
//  1. Фон экрана и зона под навигацией приведены к var(--home-bg).
//  2. Карточка «Осталось в бюджете» использует ТОТ ЖЕ градиент/тень, что
//     карточка «Общий капитал» на «Счетах» (#scrAccounts .capital) — не
//     новый похожий цвет, а буквально идентичная строка CSS.
//  3. Карточки категорий (.bud-card) — без border, с var(--fincard-shadow),
//     старая толстая красная рамка при перерасходе (.bud-card.over) удалена.
//  4. Пустое состояние (.bud-empty) получило белый фон/тень.
//  5. Кнопка «Добавить бюджет» использует тот же класс .add-dashed, что
//     кнопки добавления на «Счетах».
//  6. Вся расчётная логика бюджетов не тронута (функции присутствуют
//     дословно, без изменений сигнатур).
//  7. Версия кэша service worker поднята.
// Запуск: node tests/budgets_screen.test.js

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}

// ============ §1 — фон экрана «Бюджеты» приведён к тому же токену, что «Главная» ============
// TASK_039: конкретный токен фона основных экранов сменился с --home-bg на
// --main-bg-grad (мягкий мятно-серо-зелёный градиент); инвариант — все четыре
// экрана и их зона под навигацией используют ОДИН И ТОТ ЖЕ токен, каким бы он
// ни был, а не дословно "--home-bg".
{
  const recM = html.match(/#scrRecords\{background:var\((--[\w-]+)\)\}/);
  assertTrue(!!recM, '#scrRecords{background:var(--...)} найден в index.html (эталон)');
  const bgToken = recM && recM[1];
  const budEsc = bgToken ? bgToken.replace(/[-]/g, '\\-') : '';
  assertTrue(!!bgToken && new RegExp(`#scrBudgets\\{background:var\\(${budEsc}\\)\\}`).test(html),
    'index.html: #scrBudgets получил тот же фон, что #scrRecords/#scrCharts/#scrAccounts');
  assertTrue(!!bgToken && new RegExp(`\\.scroll-area:has\\(>#scrBudgets\\.active\\)\\{background:var\\(${budEsc}\\)\\}`).test(html),
    'index.html: зона под нижней навигацией на «Бюджетах» тоже покрыта тем же токеном (тот же приём TASK_009/019/020)');
}

// ============ §2 — карточка «Осталось в бюджете» = тот же градиент, что «Счета» ============
{
  const accM = html.match(/#scrAccounts \.capital\{background:([^}]*?padding:[^;]+;?)\}/);
  const budM = html.match(/#scrBudgets \.capital\{background:([^}]*?padding:[^;]+;?)\}/);
  assertTrue(!!accM, '#scrAccounts .capital{...} найден в index.html (эталон)');
  assertTrue(!!budM, '#scrBudgets .capital{...} найден в index.html');
  if (accM && budM) {
    // Оба правила должны использовать один и тот же градиент/тень — сверяем
    // саму background-строку (без учёта различающегося конечного padding).
    const accBg = accM[1].split(/;\s*box-shadow:/)[0];
    const budBg = budM[1].split(/;\s*box-shadow:/)[0];
    assertEqual(budBg, accBg, '#scrBudgets .capital использует БУКВАЛЬНО тот же градиент, что #scrAccounts .capital (не новый похожий цвет)');
    const accShadow = accM[1].match(/box-shadow:([^;]+);/);
    const budShadow = budM[1].match(/box-shadow:([^;]+);/);
    assertTrue(!!accShadow && !!budShadow, 'оба правила задают box-shadow явно');
    if (accShadow && budShadow) {
      assertEqual(budShadow[1], accShadow[1], '#scrBudgets .capital использует ту же тень, что #scrAccounts .capital');
    }
  }
  assertTrue(/#scrBudgets \.capital\{background:linear-gradient\(135deg,#a79cf7 0%,#8fb0f6 55%,#8fdde3 100%\)/.test(html),
    'index.html: #scrBudgets .capital — точный градиент карточки «Личный профиль A-Lex» (.drawer-head, TASK_017), как и на «Счетах»');
  assertTrue(/bt\.className='capital bud-hero'/.test(html),
    'renderBudgets(): герой-карточка получает класс .capital (переиспользование общего компонента), не только собственный .bud-hero');
  // Старое отдельное правило .bud-hero{background:var(--cap-grad);...} (свой подобранный
  // фиолетовый, общий с .ana-hero/.cashflow-card/goals-summary) больше не существует —
  // цвет карточки идёт исключительно от .capital.
  assertTrue(!/\.bud-hero\{background:var\(--cap-grad\)/.test(html),
    'index.html: .bud-hero больше не красится отдельным var(--cap-grad) — карточка не должна оставаться отдельной сиреневой карточкой');
}

// ============ §3 — карточки категорий: без рамки, без толстой рамки при перерасходе ============
{
  assertTrue(/\.bud-card\{background:var\(--card\);border-radius:20px;box-shadow:var\(--fincard-shadow\);/.test(html),
    'index.html: .bud-card — белая карточка с var(--fincard-shadow) (стиль .acc-cat/.fincard), без border');
  assertTrue(!/\.bud-card\{[^}]*border:1px solid var\(--line\)/.test(html),
    'index.html: .bud-card больше не имеет border:1px solid var(--line)');
  assertTrue(!/\.bud-card\.over\{/.test(html),
    'index.html: .bud-card.over{...} (толстая красная рамка вокруг всей карточки при перерасходе) как CSS-правило полностью удалено');
  assertTrue(!/class="bud-card \$\{over\?'over':''\}"/.test(html),
    'renderBudgets(): разметка карточки больше не подставляет класс over (рамка убрана как оформление)');
  assertTrue(/class="bud-card" data-cat="\$\{cid\}"/.test(html),
    'renderBudgets(): карточка категории — просто .bud-card, статус читается по тексту/прогресс-бару');
  // Статус остаётся понятным через цвет текста и прогресс-бар — эти правила не тронуты
  assertTrue(/\.bc-rl\.over\{color:var\(--expense\)\}/.test(html), '.bc-rl.over (красный текст «Перерасход») сохранён');
  assertTrue(/\.bc-rl\.warn\{color:var\(--warn\)\}/.test(html), '.bc-rl.warn (оранжевый текст приближения к лимиту) сохранён');
  assertTrue(/\.bc-rv\.over\{color:var\(--expense\);font-weight:800\}/.test(html), '.bc-rv.over (красная сумма перерасхода) сохранён');
  assertTrue(/const rl=over\?'over':\(lvl==='warning'\?'warn':''\);/.test(html), 'renderBudgets(): статус bc-rl по-прежнему вычисляется из over/lvl (без изменений логики)');
}

// ============ §4 — пустое состояние: белая карточка, те же данные (без выдуманных) ============
{
  assertTrue(/\.bud-empty\{background:var\(--card\);border-radius:20px;box-shadow:var\(--fincard-shadow\);text-align:center/.test(html),
    'index.html: .bud-empty получил белый фон/радиус/тень — тот же язык, что карточки категорий');
  assertTrue(html.includes('Бюджетов пока нет.<br>Нажмите «Добавить бюджет».'),
    'index.html: текст пустого состояния сохранён без изменений (без выдуманных данных)');
}

// ============ §5 — кнопка «Добавить бюджет» = тот же класс, что кнопки «Счетов» ============
{
  assertTrue(/<button class="add-dashed" id="addBudgetBtn">/.test(html), '#addBudgetBtn использует общий класс .add-dashed');
  assertTrue(/<button class="add-dashed" id="addAccBtn">/.test(html), '#addAccBtn (эталон, «Счета») использует тот же класс .add-dashed');
  // Единственное определение .add-dashed в CSS — оба экрана буквально делят один компонент,
  // а не два похожих класса с одинаковым именем.
  const addDashedRuleCount = (html.match(/^\s*\.add-dashed\{/gm) || []).length;
  assertEqual(addDashedRuleCount, 1, 'index.html: базовое правило .add-dashed{...} определено ровно один раз — общий компонент, не задублирован под Бюджеты');
}

// ============ §6 — расчётная логика бюджетов не изменена ============
{
  assertTrue(/function budgetMonthRange\(\)\{/.test(html), 'budgetMonthRange() присутствует без изменений сигнатуры');
  assertTrue(/function budgetSpent\(catId\)\{/.test(html), 'budgetSpent(catId) присутствует без изменений сигнатуры');
  assertTrue(/function budgetIds\(\)\{/.test(html), 'budgetIds() присутствует без изменений сигнатуры');
  assertTrue(/function budgetTotals\(\)\{/.test(html), 'budgetTotals() присутствует без изменений сигнатуры');
  assertTrue(/function budgetLevel\(pct\)\{return pct>=100\?'critical':pct>=80\?'warning':'ok';\}/.test(html),
    'budgetLevel(): пороги 80%/100% не изменены');
  assertTrue(/function budgetColor\(level,fallback\)\{/.test(html), 'budgetColor() присутствует без изменений сигнатуры');
  assertTrue(/function openBudgetEdit\(cid\)\{/.test(html), 'openBudgetEdit() (редактор бюджета) не тронут — вне границ задачи');
  assertTrue(/function saveBudget\(\)\{/.test(html) && /function deleteBudget\(\)\{/.test(html),
    'saveBudget()/deleteBudget() присутствуют без изменений — создание/редактирование/удаление бюджета сохранено');
}

// ============ §7 — версия кэша service worker поднята ============
{
  const m = sw.match(/const CACHE = 'finance-v(\d+)'/);
  assertTrue(!!m, 'sw.js: CACHE найден');
  if (m) assertTrue(parseInt(m[1], 10) >= 165, 'sw.js: версия кэша поднята до finance-v165 или выше (TASK_022)');
}

// ============ §8 — TASK_024: «Потрачено/Лимит» в герой-карточке — белый текст ============
// Общий .bh-foot{color:var(--muted2)} побеждает унаследованный от .capital
// белый (color, заданный прямо на элементе, всегда выигрывает у наследования
// от предка). Без явного color:#fff на .bud-hero .bh-foot текст читался бы
// приглушённым серым на фиолетово-голубом градиенте.
{
  assertTrue(/\.bud-hero \.bh-foot\{[^}]*color:#fff/.test(html),
    'TASK_024: .bud-hero .bh-foot задаёт color:#fff (переопределяет общий .bh-foot{color:var(--muted2)})');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
