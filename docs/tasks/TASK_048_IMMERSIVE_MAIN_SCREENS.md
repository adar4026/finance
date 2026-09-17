# TASK_048 — Аналитика / Счета / Бюджеты: единая immersive UI-система Главной

**Статус:** DONE (commit + push в `main`, после визуального подтверждения пользователя)

## Контекст

`TASK_047` перевела Главную в цельный immersive-hero на fluid-фоне
(`.finance-ambient`, прозрачный header, сегмент периода без карточки,
крупные стрелки, баланс без карточки). Аналитика, Счета и Бюджеты остались
в старой системе: белые карточки `.periods`/`#navrow`, сиреневые
`.capital`-карточки капитала/бюджета, плоский фон `--main-bg-grad`,
белый topbar с поиском на всю ширину — рядом с новой Главной они выглядят
как другое приложение.

## Цель

Home / Analytics / Accounts / Budgets — одна визуальная система: общий
ambient-фон, один стиль сегмента периода, один month-switch, ключевые
показатели (общий капитал, остаток бюджета, donut аналитики) прямо на
фоне, минимум крупных белых summary-карточек. Бизнес-логика, данные,
графики, обработчики, period logic — без изменений.

## Границы работы

Разрешено: CSS/разметка четырёх основных экранов в `index.html` (класс
`immersive` у экранов, scope-селекторы, `#navrow` → компонент
`.month-switch`, `.capital`-блок Счетов → `.hero-balance`, `.ana-hero`,
`.bud-hero` на фоне), одна строка JS в `renderBudgets()` (имя класса
контейнера `#budgetTotal`), `sw.js` (версия кэша), тесты, документация.

Запрещено: финансовые расчёты, storage, категории, импорт/экспорт,
Chart.js-графики и их данные, обработчики, `AF.Services.*`, `shiftPeriod`/
`periodRange`/`showScreen`, нижняя навигация, экраны вне четырёх основных
(Профиль/Настройки/overlays — `.navrow`/`.periods`/`.capital`/`.panel`
глобальные правила не меняются), карточки сущностей (счета, бюджетные
категории, панели графиков ниже hero).

## Требования

1. Ambient: один слой `.finance-ambient` в `.app`; видимость —
   `.app:has(.screen.immersive.active)` (Home, Charts, Accounts, Budgets).
   Экраны и `.scroll-area` под ними — `transparent`. Токены/анимация/dark/
   reduced-motion — переиспользуются из `TASK_047`, без дублирования.
2. Topbar/поиск/кнопка графиков, `.subhead`, `.periods` + `#periodsIndicator`
   — те же правила, scope расширен с `#scrRecords` на `.immersive`.
3. `#navrow` — тот же компонент, что `#fcMonthSwitch`: `.month-switch`,
   `.m-arrow` 44×44 с SVG-шевроном 30px, `.m-label`; ids `#prevP/#nextP/
   #periodLabel` и обработчики сохранены; общие правила immersive
   month-switch — одно место для обоих переключателей.
4. Аналитика: сегмент + donut — без карточки (`.ana-hero`), легенда и
   остальные `.panel` — карточки.
5. Счета: `.capital.cap-simple` → `.hero-balance` («Общий капитал 👁 ·
   EUR / крупная сумма»); `#accTotalCapital/#capEye2/#accCapCur` сохранены.
6. Бюджеты: `#budgetTotal` — `.hero-balance.bud-hero` без карточки:
   label, badge-стекло, крупный остаток, прогресс, «Потрачено/Лимит»;
   `#navrow` — общий month-switch; карточки категорий не тронуты.
7. Responsive 320–430 без горизонтального скролла; dark theme; safe-area;
   sticky `.scrolled` стекло — как на Главной.

## Критерии готовности / план проверок

- Тесты: новый `tests/immersive_screens.test.js`; актуализация эталонов
  старого дизайна в `budgets_screen`/`category_tx_screen`/
  `home_hero_screen`; все `tests/*.test.js` — 0 failed.
- Preview 390 (+320/430, dark): скриншоты Analytics/Accounts/Budgets; Home
  — без регрессий; `scrollWidth === clientWidth`.
- Функционально: период/месяц переключаются на Аналитике и Бюджетах,
  аналитика пересчитывается, значения Счетов не ломаются, add/edit/delete
  открываются, overlays поверх фона.

## Результат (локальная реализация, ожидает подтверждения пользователя)

### Что реализовано

- **Общий scope `.screen.immersive`** у `#scrRecords/#scrCharts/#scrAccounts/
  #scrBudgets`; все правила TASK_047 (`.finance-ambient{display:block}`,
  прозрачный `.topbar:not(.scrolled)`, компактный стеклянный `#searchTop`,
  стеклянный `#anaTop`, `.subhead`, `.periods` без карточки + capsule на
  `#periodsIndicator`) переведены с `.app:has(#scrRecords.active)` на
  `.app:has(.immersive.active)` — один набор правил, без per-screen копий.
  `#scrRecords,#scrCharts,#scrAccounts,#scrBudgets{background:transparent}`
  и `.scroll-area:has(>.immersive.active){background:transparent}`; старые
  `#scrCharts/#scrAccounts/#scrBudgets{background:var(--main-bg-grad)}` и их
  `.scroll-area:has(...)` удалены (`--main-bg-grad` остаётся токеном
  `.catx-page`). Токены/анимация/dark/reduced-motion — те же, не
  дублируются.
- **`#navrow` → компонент `.month-switch`** (тот же, что `#fcMonthSwitch`):
  `.m-arrow` с SVG-шевроном, `.m-label`; ids `#prevP/#nextP/#periodLabel`
  и обработчики не менялись. Базовое правило `.month-switch` стало единым
  источником (44×44, шеврон 30px, `--text`, `gap:6px`), Home-only override
  `#scrRecords .month-switch` удалён. Капитализация подписи —
  `#navrow .m-label::first-letter` (раньше `capitalize` давал «Сентябрь
  2026 Г.»). Глобальный `.navrow` (overlay «Операции по категории») не
  тронут.
- **Аналитика**: первая панель → `.panel.ana-top` без фона/рамки/тени
  (сегмент `#anaCatSeg` — тот же `.periods`-стиль capsule, donut на фоне);
  легенда `.catlist2` — карточка. Остальные `.panel` (Сравнение, Доходы и
  расходы, Динамика капитала) — как были. Класс назван `.ana-top`, т.к.
  `.ana-hero` уже существует (старый сиреневый hero с `color:#fff`).
- **Счета**: `.capital.cap-simple` → `.hero-balance.acc-hero` («Общий
  капитал 👁» / крупная сумма / `EUR`); ids `#capEye2/#accTotalCapital/
  #accCapCur` сохранены, `renderAccountsScreen()` не менялась. Правило
  `#scrAccounts .capital` удалено как мёртвое.
- **Бюджеты**: `renderBudgets()` — единственная правка JS: `bt.className=
  'hero-balance bud-hero'` (было `'capital bud-hero'`). `.bud-hero .bh-*`
  переписаны под фон: label `--muted`, badge — `--hero-capsule`, `.bh-val`
  `clamp(34px,11vw,46px)`, прогресс `--hero-sep`/`--nav-blue`, foot
  `--muted`. `#scrBudgets .capital` удалено. `#navrow` на Бюджетах —
  общий month-switch.
- `sw.js`: `finance-v179` → `finance-v180`.

### Файлы

- `index.html` — разметка (класс `immersive`, `#navrow`, Счета hero,
  `.ana-top`), CSS (scope, `.month-switch`, `.bud-hero`, `.acc-hero`,
  `.ana-top`, фоны), 1 строка JS в `renderBudgets()`.
- `sw.js` — версия кэша.
- `tests/immersive_screens.test.js` — новый (72 проверки).
- `tests/home_hero_screen.test.js` — scope `.immersive`, общий
  `.month-switch`, версия ≥179 (101 → 100).
- `tests/budgets_screen.test.js` — §1 (общий слой вместо токена), §2
  (`.hero-balance` вместо `.capital`-градиента), §8 (`color:var(--muted)`
  вместо `#fff`) (36 → 38).
- `tests/category_tx_screen.test.js` — эталон токена: определение
  `--main-bg-grad` в `:root`.
- `tests/analytics_screen.test.js` — regex экрана с классом `immersive`.
- `docs/tasks/TASK_048_IMMERSIVE_MAIN_SCREENS.md`, `docs/PROJECT_STATUS.md`
  (строка активной задачи).

### Проверки

- Тесты: **2143 passed, 0 failed** (+73 к 2070: +72 новый, +2 budgets,
  −1 home_hero).
- Preview (`localhost:8913`, demo-данные), 390×844 — скриншоты Analytics/
  Accounts/Budgets: header, сегмент, «‹ Сентябрь 2026 г. ›», hero-показатель,
  контент, нижняя навигация. Home — без визуальных изменений (баланс
  отличается только из-за перегенерации демо-данных на новую дату).
- 320×568 и 430×932: `scrollWidth === clientWidth` на всех четырёх
  экранах; на 320 badge «60% использовано» переносится под label (flex-wrap).
- Dark theme: Бюджеты и Счета проверены — общий тёмный вариант слоя,
  текст читаем. Прокрутка Аналитики: topbar — стекло `.scrolled`.
- Функционально (JS в preview): Аналитика — День/Неделя/Месяц/Год меняют
  подпись, donut (€42 / €377 / €950 / €2 844) и подсказку «6 …»; `‹` →
  Август (€897), `›` → Сентябрь; Расходы/Доходы (€950 / €2 259). Бюджеты —
  `‹` → август 2026 (€262), `›` → сентябрь (€295), 4 карточки, `.periods`
  скрыт. Счета — €3 998 / EUR, глаз скрывает/показывает (`€∗∗∗∗`/🙈),
  subhead скрыт. «+ Добавить бюджет» и «+ Счёт» открывают overlays поверх
  фона.
- Консоль — только сторонний cloudflareinsights CORS (не связан).

### Известные ограничения / на решение пользователя

- Сегмент «Расходы / Доходы» на Аналитике получил тот же прозрачный стиль,
  что период-контрол (тот же класс `.periods`) — если нужен видимый трек
  для 2-позиционного переключателя, можно добавить scoped-правило.
- Топбар на «Настройках» (`#scrMore`) — прежний белый вид (не immersive).
- Не проверено на реальном iPhone (standalone PWA).

### Git

- Пользователь подтвердил результат по скриншотам в чате — commit/push разрешены.
- Коммит реализации: `feat(TASK_048): …` — хэш ниже после коммита.
- Коммит документации: `docs(TASK_048): record commit hash in task file` — хэш ниже после коммита.
- Push: `origin/main`.
