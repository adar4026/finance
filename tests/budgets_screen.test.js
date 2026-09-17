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
// TASK_047/048: инвариант тот же — один фон на четыре экрана — но теперь его
// рисует общий слой .finance-ambient (.app:has(.immersive.active)), а сами
// экраны и .scroll-area под ними прозрачны; «Бюджеты» — в том же списке.
{
  assertTrue(/<div class="screen immersive" id="scrBudgets">/.test(html), 'index.html: #scrBudgets помечен .immersive (общий ambient-фон четырёх экранов)');
  assertTrue(/#scrRecords,#scrCharts,#scrAccounts,#scrBudgets\{background:transparent\}/.test(html),
    'index.html: #scrBudgets прозрачен вместе с #scrRecords/#scrCharts/#scrAccounts (фон рисует .finance-ambient)');
  assertTrue(/\.scroll-area:has\(>\.immersive\.active\)\{background:transparent\}/.test(html),
    'index.html: зона под нижней навигацией на «Бюджетах» покрыта тем же слоем (.scroll-area прозрачна над .finance-ambient)');
  assertTrue(/\.app:has\(\.immersive\.active\) \.finance-ambient\{display:block\}/.test(html),
    'index.html: .finance-ambient показывается для любого .immersive-экрана, в т.ч. «Бюджетов»');
}

// ============ §2 — герой «Осталось в бюджете» = тот же компонент, что «Счета»/Главная ============
// TASK_048: сиреневые .capital-карточки на «Счетах» и «Бюджетах» заменены общим
// компонентом .hero-balance (баланс Главной, TASK_047) — без фона/рамки/тени, прямо
// на ambient-слое. Инвариант «один и тот же компонент, не похожий клон» сохранён.
{
  assertTrue(!/#scrAccounts \.capital\{/.test(html), 'index.html: правила #scrAccounts .capital удалены (карточка капитала больше не сиреневая)');
  assertTrue(!/#scrBudgets \.capital\{/.test(html), 'index.html: правила #scrBudgets .capital удалены');
  assertTrue(/<div class="hero-balance acc-hero">/.test(html), 'index.html: «Общий капитал» на «Счетах» — компонент .hero-balance');
  assertTrue(/bt\.className='hero-balance bud-hero'/.test(html),
    'renderBudgets(): герой бюджета получает общий .hero-balance (тот же компонент, что баланс Главной и капитал «Счетов»), не .capital');
  assertTrue(/\.hero-balance\{text-align:center;padding:[^}]*\}/.test(html) && !/\.hero-balance\{[^}]*(background|border|box-shadow)/.test(html),
    'index.html: .hero-balance без фона/рамки/тени — не карточка');
  assertTrue(/\.bud-hero \.bh-fill\{height:100%;background:var\(--nav-blue\)/.test(html), 'index.html: прогресс бюджета — существующий --nav-blue, не новый цвет');
  assertTrue(/\.bud-hero \.bh-badge\{[^}]*background:var\(--hero-capsule\)/.test(html), 'index.html: badge «% использовано» — та же стеклянная capsule, что активный пункт сегмента');
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

// ============ §8 — «Потрачено/Лимит» в герое — читаемый контраст ============
// TASK_024 требовала явный color на .bud-hero .bh-foot (иначе побеждал общий
// .bh-foot{color:var(--muted2)}). TASK_048: герой больше не на сиреневом
// градиенте, а на светлом/тёмном ambient-фоне — явный цвет остаётся, но это
// токен --muted (тема-зависимый), а не захардкоженный белый.
{
  assertTrue(/\.bud-hero \.bh-foot\{[^}]*color:var\(--muted\)/.test(html),
    'TASK_024/048: .bud-hero .bh-foot задаёт явный color:var(--muted) (переопределяет общий .bh-foot{color:var(--muted2)}, читаем в обеих темах)');
  assertTrue(!/\.bud-hero \.bh-foot\{[^}]*color:#fff/.test(html), 'index.html: .bud-hero .bh-foot больше не белый (не на градиенте)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
