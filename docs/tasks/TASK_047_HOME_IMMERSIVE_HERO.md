# TASK_047 — Главная: цельный immersive-hero вместо карточек (fluid background)

**Статус:** DONE (commit + push в `main`, после визуального подтверждения пользователя)

## Контекст

Верхняя часть Главной (`#scrRecords`) состоит из нескольких белых карточек:
белая капсула `.periods`, белая карточка `.fincard#finCard` (баланс + три
плитки Доходы/Расходы/Поток), карточки списка. Референс пользователя —
immersive banking UI (Revolut): цельная верхняя сцена, мягкий
переливающийся фон, крупный баланс, лёгкая навигация без контейнеров.

## Цель

Home воспринимается как единый premium financial dashboard: header
(аватар · компактный поиск · графики) → сегмент периода → «‹ Период ›» →
крупный «Общий баланс» → Доходы / Расходы / Поток → «Записи» → список.
Верхняя зона — на спокойном анимированном fluid-фоне из палитры приложения
(голубой/синий), без крупных белых карточек. Вся финансовая бизнес-логика
и данные — без изменений.

## Границы работы

Разрешено: CSS/разметка Главной в `index.html` (topbar-стили в scope
Главной через `:has(#scrRecords.active)`, `.periods`/`.month-switch`/
финансовый блок Home, новый декоративный слой `.finance-ambient`),
`sw.js` (версия кэша), новый статический тест, правка эталонной ссылки в
двух существующих тестах (`budgets_screen`, `category_tx_screen`),
документация.

Запрещено: бизнес-логика (`renderFinanceCard()`, `AF.Services.*`,
`shiftPeriod`, `periodRange`, `openSearch`, `showScreen`), схема данных/
localStorage, список операций (`renderRecent`/`homeGroupedTxHtml`/
`.home-*`), нижняя навигация `.nav`, другие экраны (`.fincard` остаётся
для `#catTxOverlay`, `.periods` на Аналитике — без изменений вида),
видео/WebGL/canvas/JS-анимации.

## Требования

1. Header: `(аватар 44) [🔍 Поиск — компактная капсула по центру] (📊)`,
   без общего контейнера, на фоне сцены; `#searchTop` → `openSearch`,
   `#anaTop` → `showScreen('scrCharts')` (существующие обработчики).
2. Сегмент периода — без белой карточки; активный пункт — лёгкая
   полупрозрачная capsule (тот же `#periodsIndicator`).
3. `‹ Период ›` — стрелки крупнее (шеврон ~28–30px, touch ≥44×44), без
   карточки; `#fcMonthPrev/Next` — существующая логика.
4. Баланс — без карточки/капсулы, label мелкий, сумма крупная (главный
   акцент); `#fcChg` — мелкая строка; `#fcEye` сохраняется.
5. Доходы/Расходы/Поток — `grid 3×1fr`, тонкие вертикальные разделители,
   без плиток; те же `id` (`#fcInc/#fcExp/#fcFlow`), значения из
   `renderFinanceCard()`.
6. Fluid-фон: `.finance-ambient` (aria-hidden, pointer-events:none) — 4
   blob'а на `radial-gradient`, анимируются только `transform`/`opacity`
   (`translate3d`/`scale`), длительности 16/21/25/30s, `will-change`
   только на blob'ах; внизу плавный fade к базовому фону Home.
7. `prefers-reduced-motion: reduce` — анимация выключена, слои остаются.
8. Dark theme — свой вариант (темнее, менее яркий).
9. Safe-area: header учитывает `env(safe-area-inset-top)` (как сейчас).
10. Responsive 320–430: сегмент и три показателя в одну строку, без
    горизонтального скролла (`scrollWidth === clientWidth`).
11. Z-index: ambient (0) < scroll-area/контент (1) < topbar (20) < nav
    (30) < overlays (60+).

## Критерии готовности / план проверок

- Тесты: новый `tests/home_hero_screen.test.js`; все `tests/*.test.js` —
  0 failed.
- Preview 320/390/430 (+ dark): скриншот Главной с header, поиском,
  графиками, сегментом, месяцем со стрелками, балансом, тремя
  показателями, началом списка и нижней навигацией; `scrollWidth ===
  clientWidth`.
- Функционально: поиск, графики, все пять режимов периода, стрелки
  назад/вперёд, пересчёт доходов/расходов/потока, список соответствует
  периоду.

## Результат (локальная реализация, ожидает подтверждения пользователя)

### Что реализовано

- **`.finance-ambient`** — первый ребёнок `.app` (за sticky `.topbar`, за
  `.scroll-area`), `position:absolute;inset:0;z-index:0;pointer-events:none`,
  `aria-hidden`; виден только при `.app:has(#scrRecords.active)`. База —
  вертикальный градиент `--hero-top → --hero-bottom` (до `--hero-h:460px`) +
  статичное белое свечение; 4 blob'а на `radial-gradient` (без
  `filter:blur`), анимируются только `transform` (`translate3d`+`scale`,
  `ease-in-out infinite alternate`, 21/25/30/16s); `.ambient-fade` — плавный
  переход в базовый фон. `prefers-reduced-motion` — `animation:none`, слои
  остаются. Фон фиксирован — список прокручивается поверх сцены (как в
  референсе); `.scroll-area` получила `position:relative;z-index:1`.
- **Header на Главной** (scope `.app:has(#scrRecords.active)`): `.topbar`
  прозрачен (при прокрутке — прежнее стекло `.scrolled`), `#searchTop` —
  компактная стеклянная капсула `min(54%,208px)` по центру, `#anaTop` —
  стеклянный круг. Обработчики (`openSearch`, `showScreen('scrCharts')`)
  не менялись. На других экранах `.topbar`/`.hdr-search` — как раньше.
- **Сегмент периода** на Главной: `.periods` без фона/рамки, активный пункт
  — полупрозрачная capsule на том же `#periodsIndicator`
  (`--hero-capsule`), текст активного — `--text` 700.
- **`‹ Период ›`**: `#scrRecords .month-switch .m-arrow` 44×44, шеврон 30px,
  цвет `--text`; disabled — `--muted2`.
- **Баланс**: `.fincard#finCard` → `.hero-balance#finCard` без карточки:
  `.hb-label` 14px + `#fcEye`, `#fcVal.hb-val` `clamp(34px,11vw,46px)`/800,
  `#fcChg` 13px. **Доходы/Расходы/Поток** — `.hb-stats` `grid
  repeat(3,1fr)`, тонкие разделители `--hero-sep`, значения сохраняют класс
  `.ci2-v` (renderFinanceCard() переписывает `className` у `#fcFlow`),
  счётчики операций — мелкая строка `.hb-s`.
- Заголовок **«Записи»** (`.home-list-head`) перед `#recentList`; список
  (`renderRecent`/`homeGroupedTxHtml`/`.home-*`) не изменён.
- Токены `--hero-*` в светлой и тёмной теме (`:root` / `[data-theme="dark"]`);
  `--hero-b4` = `--nav-blue` (#4f7df0). `#scrRecords` и
  `.scroll-area:has(>#scrRecords.active)` — `transparent` (фон рисует слой;
  `#scrCharts/#scrAccounts/#scrBudgets` — прежний `--main-bg-grad`).
- `sw.js`: `finance-v178` → `finance-v179`.

### Файлы

- `index.html` — разметка (слой `.finance-ambient`, блок `.hero-balance`,
  заголовок «Записи»), токены `--hero-*`, CSS-блок TASK_047.
- `sw.js` — версия кэша.
- `tests/home_hero_screen.test.js` — новый (101 проверка).
- `tests/budgets_screen.test.js`, `tests/category_tx_screen.test.js` —
  эталон токена фона переведён с `#scrRecords` на `#scrCharts` (Главная
  теперь прозрачна над слоем).
- `docs/tasks/TASK_047_HOME_IMMERSIVE_HERO.md`, `docs/PROJECT_STATUS.md`
  (строка активной задачи).

### Проверки

- Тесты: **2070 passed, 0 failed** (+101).
- Preview (`http://localhost:8913`, demo-данные `loadDemo()`), 390×844:
  header/поиск/графики/сегмент/месяц со стрелками/баланс/три показателя/
  «Записи»/нижняя навигация — на одном экране; список начинается на
  ~386px, первая операция ~451px.
- 320×568, 430×932, 390×844: `scrollWidth === clientWidth` (document и
  `.scroll-area`); сегмент и три показателя в одну строку.
- Dark theme — свой вариант фона, текст читаем. Аналитика — topbar/периоды
  без изменений (белые, как раньше).
- Функционально (JS в preview): День/Неделя/Месяц/Год — подпись,
  доходы/расходы/поток/список пересчитываются (месяц: +€2 259 / −€950 /
  +€1 309, 11 строк; неделя: +€246 / −€377 / −€131, 4 строки; год: 33
  строки; день: 0 строк + пустое состояние); «‹» → Август 2026 (баланс
  €2 689, `›` активна), «›» → Сентябрь (`›` снова disabled); «Период»
  открывает `#rangeOverlay` поверх сцены; поиск открывает `#searchOverlay`;
  кнопка графиков → `scrCharts`; drawer — поверх hero.
- Анимация: computed `animation-name` hero-drift-1..4, длительности
  21/25/30/16s, transform меняется; `.finance-ambient` z-index 0,
  pointer-events none; `.scroll-area` z-index 1; `.topbar` z-index 20,
  фон прозрачный на Главной. Консоль — только сторонний
  cloudflareinsights CORS (не связан).

### Известные ограничения / на решение пользователя

- Компактный поиск и прозрачный header — только на Главной (на других
  экранах прежний вид); при переключении вкладок ширина капсулы поиска
  меняется (с transition). Можно сделать глобально по запросу.
- Фон под списком Главной — `--hero-bottom` (#eef2f8, холодный
  светло-серый), а не мятный `--main-bg-bottom` других экранов — чтобы
  голубая сцена переходила в согласованный тон.
- Не проверено на реальном iPhone (standalone PWA, Dynamic Island) —
  только эмуляция viewport в preview.

### Git

- Пользователь подтвердил результат по скриншоту в чате — commit/push разрешены.
- Коммит реализации: `feat(TASK_047): …` — хэш ниже после коммита.
- Коммит документации: `docs(TASK_047): record commit hash in task file` — хэш ниже после коммита.
- Push: `origin/main`.
