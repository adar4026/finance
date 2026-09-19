# TASK_056 — Нижняя навигация: floating glass capsule, glass pill с drag-жестом, вкладка «Записи» и отдельная кнопка «＋»

**Статус:** DONE (опубликовано)

## Контекст

Утверждённый финальный подход нижней навигации LexCar
(`LexCar/src/components/BottomNav.js`, `src/index.css`, коммит `57fe0df`):
прозрачная стеклянная капсула, одна подложка активного пункта (pill),
которая переезжает между равными колонками через `transform`, drag-жест на
Pointer Events с пружинным прилипанием и CSS-имитация «живого стекла» на
pill во время удержания/drag. Нужно перенести его в Finance, адаптировав к
текущей структуре (vanilla JS, `index.html`), палитре (синий акцент
навигации `--nav-blue`, отдельный от фирменного `--accent`) и логике
экранов.

Текущее состояние Finance (до задачи):

- `.nav` — белая карточка (`background:var(--card)`, `border:var(--line)`),
  flex из 4 вкладок + центральная `.addbtn` (синий круг «＋» с подписью).
- Активная подложка `.nav-indicator` позиционируется JS по
  `getBoundingClientRect` активной кнопки (`moveNavIndicator()`, TASK_002)
  с WAAPI-анимацией.
- «Добавить» — `$('#addBtn').onclick=()=>openSheet(null)`.
- Список операций Главной (`renderRecent()` → `homeGroupedTxHtml()`)
  показывает все операции выбранного периода; overlay «Все операции»
  (`#allTxOverlay`/`openAllTx()`) нигде не вызывается (мёртвый код).

## Цель

1. Пять вкладок внутри стеклянной капсулы: Главная · Аналитика · **Записи**
   · Счета · Бюджеты («Записи» — по центру, вместо прежней кнопки «＋»).
2. Новый экран «Записи» (`#scrJournal`) — полный журнал всех операций в
   хронологическом порядке на существующем рендере строк Главной.
3. Отдельная небольшая floating glass-кнопка «＋» справа над капсулой —
   то же действие `openSheet(null)`.
4. Капсула — настоящее прозрачное стекло (backdrop-filter + `@supports`
   fallback), light/dark через токены.
5. Active pill — лёгкая стеклянная линза на акценте `--nav-blue`,
   поддерживает все пять вкладок.
6. Drag-жест по капсуле (Pointer Events, `setPointerCapture`, rAF,
   `translate3d`), порог 8 px, прилипание с пружиной, preview ближайшей
   вкладки, переход через существующий `showScreen()`.
7. CSS-имитация блика/преломления на pill только во время touch/drag
   (`::before`/`::after`, `--glint-x/--glint-y`, `--drag-dir/--drag-v`).

## Границы работы

Разрешено:

- `index.html`: разметка `.nav` + новая `#addBtn` вне капсулы; новый экран
  `#scrJournal`; CSS-блок нижней навигации и новые токены `--nav-*`;
  `moveNavIndicator()` → CSS-driven; новый модуль drag `navDrag`;
  `showScreen()` — только добавление `scrJournal` в список экранов без
  периода; `render()` — вызов `renderJournal()`.
- `sw.js` — cache version `finance-v187` → `finance-v188`.
- Тесты: новый `tests/bottom_nav_glass_drag.test.js`; в
  `tests/immersive_screens.test.js` — счётчик immersive-экранов 4 → 5.
- Документация: этот TASK-файл; после подтверждения —
  `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `CHANGELOG.md`.

Запрещено:

- Изменять экраны Главная/Аналитика/Счета/Бюджеты, их логику, данные,
  расчёты, формы, header/hero, карточки, графики, типографику.
- Менять существующие темы, `--nav-glass-*` (их использует
  `.periods-indicator`), `--accent`, цвета LexCar.
- Фреймворки, библиотеки, Canvas/WebGL/SVG-фильтры для навигации.
- Менять `openSheet()`, `renderRecent()`, `homeGroupedTxHtml()`.
- Commit / push / deploy до отдельного подтверждения.

## Требования

См. постановку пользователя (разделы 1–7 + уточнение «пятая вкладка
Записи»). Ключевое:

- Капсула: `background` прозрачный rgba, `-webkit-backdrop-filter` +
  `backdrop-filter: blur() saturate()`, тонкий контур, верхний блик, мягкая
  тень; без `opacity` на всей панели; `@supports not (backdrop-filter)` →
  плотный fallback.
- Pill: лёгкая заливка на `--nav-blue`, тонкая граница, внутренний блик,
  мягкая тень; не меняет размеры капсулы.
- Drag: порог 8 px по X, вертикальное движение — не drag; геометрия
  читается на `pointerdown` (не на каждом `pointermove`); pill в границах
  капсулы; `will-change` только в drag; reduced motion — без пружины,
  растяжения и блика; кнопка «＋» вне капсулы не участвует в drag.
- Записи: все операции (`state.tx`), сортировка `AF.Services.TxTime.sortAll`,
  строки `homeGroupedTxHtml()` (полный текст без обрезки), tap → `openSheet(id)`.
- Пять компактных вкладок без обрезания/overflow на 320/375/390/430 px.

## Критерии готовности

- Все `tests/*.test.js` — 0 failed.
- Preview 320/375/390/430 px, light/dark, экраны Главная/Аналитика/Записи/
  Счета/Бюджеты: нет overflow, tap по всем пяти вкладкам, «＋» открывает
  форму, drag в обе стороны, pill в границах, консоль без ошибок.
- Без `backdrop-filter` (эмуляция) панель читаема.

## План проверок

1. `for f in tests/*.test.js; do node "$f"; done`.
2. Preview (`finance-local`) на четырёх ширинах × 2 темы × 5 экранов.
3. Pointer-эмуляция drag в preview (PointerEvent dispatch) + визуальная
   проверка скриншотами.
4. Production-проверка: сборки нет (статический GitHub Pages) — проверка
   `sw.js` cache version и отсутствия ошибок консоли на локальном сервере.

## Фактический результат

**Реализовано 2026-09-19.** Тесты: **2782 passed, 0 failed** (было 2609;
+172 новый `tests/bottom_nav_glass_drag.test.js`, +1 скорректированное
утверждение в `tests/immersive_screens.test.js`).

### Git

- Реализация: `04f3972` — `feat(TASK_056): floating glass bottom nav — draggable glass pill, «Записи» tab, separate «＋» button`.
- Документация: `1bf5d53` — `docs(TASK_056): task file, status, roadmap, changelog`.
- Push: `2ce750f..1bf5d53` → `origin/main`.

### Production-проверка (2026-09-19)

https://adar4026.github.io/finance/ после деплоя GitHub Pages: `sw.js`
отдаёт `finance-v188`, в браузере единственный кэш `finance-v188` (старый
вычищен), в DOM пять вкладок `scrRecords/scrCharts/scrJournal/scrAccounts/
scrBudgets`, `#addBtn` вне `.nav`, `backdrop-filter: blur(10px)
saturate(1.5)` на капсуле применён, консоль без ошибок.

### Изменённые файлы

- `index.html` — токены `--nav-*` (light/dark), CSS-блок нижней навигации,
  разметка `.nav` (5 вкладок) + `.nav-add#addBtn`, экран `#scrJournal`,
  `moveNavIndicator()` (CSS-driven), новый модуль `navDrag`,
  `renderJournal()`, правки `showScreen()`/`render()`.
- `sw.js` — `finance-v187` → `finance-v188`.
- `tests/bottom_nav_glass_drag.test.js` — новый (172 проверки: разметка,
  токены, стекло/fallback, pill/live-слои/reduced motion, кнопка «＋», JS
  drag, экран «Записи», sw.js + юнит-эмуляция жеста navDrag в `vm`).
- `tests/immersive_screens.test.js` — immersive-экранов 4 → 5.
- Этот TASK-файл; `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`,
  `CHANGELOG.md`.

### Токены

Использованы существующие: `--navh`, `--nav-shadow` (тень капсулы),
`--nav-blue` / `--nav-blue-soft` (акцент активной/preview-вкладки и тон
pill), `--nav-glass-border` / `--nav-glass-shadow` (граница, внутренний блик
и мягкая тень pill — TASK_002; `--nav-glass-bg` не тронут, его использует
`.periods-indicator`), `--text`, `--line`. Добавлены (light и dark
отдельно): `--nav-bg` (light `rgba(255,255,255,.14)`, dark
`rgba(24,27,36,.44)`), `--nav-bg-solid` (fallback), `--nav-border`,
`--nav-highlight`, `--nav-blur` (10px / 16px), `--nav-saturate` (150%),
`--nav-pill-bg` (лёгкий белый градиент поверх `--nav-blue-soft`),
`--nav-glint`, `--nav-pill-edge-light`, `--nav-pill-edge-dark`,
`--nav-add-bg`, `--nav-add-bg-solid`, `--nav-add-border`,
`--nav-add-shadow`. Цвета LexCar не перенесены (проверяется тестом).

### Капсула: прозрачное стекло и Safari fallback

`.nav` — `position:fixed`, `left/right:16px; margin:0 auto; max-width:500px`
(вместо `left:50%; translateX(-50%)`: дробный transform под backdrop-filter
размывал текст в Safari, а `body.drawer-open .nav{transform:scale(.98)}`
теперь масштабирует капсулу вокруг центра, а не сдвигает её), `display:grid`
на `repeat(var(--nav-count,5),1fr)`, `padding:7px`, `background:var(--nav-bg)`,
`border:1px solid var(--nav-border)`, `box-shadow:var(--nav-shadow), inset 0
1px 0 var(--nav-highlight)`, `-webkit-backdrop-filter` + `backdrop-filter:
blur(var(--nav-blur)) saturate(var(--nav-saturate))`, `overflow:hidden`,
`touch-action:pan-y`. Прозрачность только в `background` — `opacity` на
панели нет, иконки/подписи/badge непрозрачны. `@supports not
((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px)))` →
`.nav{background:var(--nav-bg-solid)}` (light `.94` белый, dark `.96`
графит) и `.nav-add{background:var(--nav-add-bg-solid)}`. Safe area
(`bottom:max(6px,env(safe-area-inset-bottom))`), `--navh:76px` и
`padding-bottom` `.scroll-area` не менялись.

### Pill

`.nav-indicator` — `top/bottom/left:7px`, `width:calc((100% - 14px)/5)`,
`transform:translate3d(calc(var(--nav-index)*100%),0,0)`, `transition
transform .24s cubic-bezier(.32,.72,0,1)`; `background:var(--nav-pill-bg)`,
`border:var(--nav-glass-border)`, `box-shadow:var(--nav-glass-shadow)`, без
собственного `backdrop-filter` (второй blur в Safari лишний — стекло даёт
капсула). `moveNavIndicator(instant)` только пишет `--nav-index` на `.nav`
(геометрию не измеряет); `showScreen()` дополнительно ставит
`aria-current="page"` активной вкладке. `.preview` — мягкое
предварительное active-состояние (тот же `--nav-blue`).

### Drag и исключение кнопки «＋»

`navDrag` (IIFE, `index.html` рядом с `moveNavIndicator`): `pointerdown` /
`pointermove` / `pointerup` / `pointercancel` на `.nav` (+ `pointerup` /
`pointercancel` на `window` — если палец ушёл с капсулы до порога).
На `pointerdown` один раз читается `getBoundingClientRect()` капсулы →
`pillW`, `maxX`, `baseX`; `pointermove` layout не читает. До `|dx| < 8px` —
ничего (tap кнопок работает по прежним `onclick`); `|dy| > |dx|` — не drag
(вертикальный pan остаётся браузеру через `touch-action:pan-y`). После
порога: `setPointerCapture` на `.nav` (только с этого момента — до порога
capture не ставится, поэтому обычный click кнопок не перенаправляется),
`.nav.dragging` (`will-change:transform` только здесь), положение через
`requestAnimationFrame` → `transform:translate3d(x,0,0) scaleX(1+.05·v)`,
`x` зажат в `[0, maxX]`, ближайшая вкладка получает `.preview`. На
`pointerup` — `.snap` (0.38s overshoot-bezier) к `round(x/pillW)`, затем
inline-стили снимаются и положение возвращается CSS (`--nav-index`);
`showScreen()` вызывается только если вкладка другая. `pointercancel` —
возврат к текущей. Click после drag глотается capture-фазным guard на
`.nav` (`s.moved`, снимается через 400 мс — Enter/клик с клавиатуры не
страдают). Кнопка «＋» — отдельный элемент `.nav-add#addBtn` вне `.nav`
(`z-index:31`, `right` = край капсулы, `bottom` = капсула + 12px): её
события до обработчиков капсулы не доходят, а pointer capture на `.nav` во
время drag не даёт ей получить click при проходе пальца над ней; действие
`openSheet(null)` и id прежние.

### Имитация блика / преломления

Только на pill и только в `.live` (удержание на pill или drag; при
reduced motion не включается): `::before` — `radial-gradient(28px 24px at
var(--glint-x) var(--glint-y), var(--nav-glint), transparent 72%)` — мягкий
блик под пальцем (координаты пишет rAF-кадр); `::after` — `linear-gradient
(90deg, edge-dark → transparent → edge-light)` с `scaleX(var(--drag-dir))`
— передний край светлее, задний едва темнее, `opacity:var(--drag-v)`
(сглаженная скорость); `.live{filter:saturate(1+.12v) brightness(1+.03v)}`
— едва заметное «оживление» стекла; `scaleX` до +5 % по скорости. На
отпускании `--drag-v→0`, классы снимаются, слои гаснут за .22s. Оба слоя
`pointer-events:none`, в покое `opacity:0`, постоянной анимации нет; Canvas /
WebGL / SVG-фильтров нет. `prefers-reduced-motion` — слои `display:none`,
`filter:none`, snap `.2s ease`, растяжение 1.

### Экран «Записи»

`#scrJournal` (`.screen.immersive`, прозрачен над `.finance-ambient`):
заголовок «Все записи · N операций» + `#journalList`.
`renderJournal()` — `AF.Services.TxTime.sortAll(state.tx)` (все операции,
без фильтра периода; дни по убыванию, внутри дня — время по убыванию) →
`homeGroupedTxHtml()` (те же `.home-tx`, полный текст без обрезки,
TASK_046) → `openSheet(id)` по tap. Вызывается из `render()` рядом с
`updateHome()`, строит список только пока экран активен. Переключатель
периода на «Записях» скрыт (`noPeriod`). Главная (`renderRecent()`) не
изменена — остаётся обзором операций выбранного периода. Иконка —
line-icon журнала (rect + три строки) в стиле остальных.

### Проверки

- Тесты: `for f in tests/*.test.js; do node "$f"; done` — **2782 passed,
  0 failed**.
- Preview (`finance-local`, Chromium): 320×700, 375×700, 390×844, 430×800 —
  пять подписей без обрезки (`scrollWidth ≤ clientWidth` у каждой `.lb`),
  колонки равные (320: 54.4px ×5), горизонтального overflow нет
  (`scrollWidth === innerWidth`); на 430 правый край «＋» = правый край
  капсулы (414px), зазор 12px, размер 48×48.
- Экраны Главная / Аналитика / Записи / Счета / Бюджеты, light и dark:
  капсула прозрачна (сквозь неё видны карточки дня и donut Аналитики),
  pill читаема, «＋» нейтральна.
- Жест (синтетические PointerEvent + реальный `left_click_drag`): drag
  вправо Записи→Бюджеты и Главная→Счета, влево Бюджеты→Главная и
  Счета→Аналитика; зажим у левой/правой границы; сдвиг 5–6px — tap, экран
  не меняется; вертикальное движение — drag не начинается;
  `pointercancel` — возврат; отпускание на текущей вкладке — без
  `showScreen`; click после drag глотается, следующий проходит; после
  пружины inline transform снят, `will-change:auto`.
- «＋»: click → `#overlay.show`, «Новая операция»; drag, начатый на «＋»,
  не переключает экран и не открывает форму.
- Fallback: `@supports`-правило присутствует; эмуляция плотного фона —
  капсула читаема.
- Консоль: без ошибок приложения (единственные записи — CORS
  `cloudflareinsights` beacon на localhost, существующий и не относящийся
  к задаче).
- Production: сборки в проекте нет (статический GitHub Pages);
  локальный сервер отдаёт `sw.js` с `finance-v188`; деплой не выполнялся
  (по условию задачи).

### Известные ограничения / допущения

- Вертикальный scroll, начатый на капсуле, и раньше не прокручивал
  контент (`.nav` — fixed-сосед `.scroll-area`, не её потомок); задача
  этого не меняла и не ухудшила: `touch-action:pan-y` оставляет
  вертикальный pan браузеру, drag стартует только по горизонтали.
- Главная намеренно не ограничена «последними N» — её список остался
  прежним (все операции выбранного периода), чтобы не менять
  существующую функциональность; полный журнал без периода — «Записи».
- Версия приложения `AF.AppInfo` не поднята (новая вкладка = MINOR по
  политике; сделать при релизе вместе с `CHANGELOG`).
- Проверка на реальном iPhone/Safari (backdrop-filter, touch pointer
  capture) — после публикации.
