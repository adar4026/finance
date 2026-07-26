# ROADMAP — A-Lex Finance

## Последовательность

1. **PROJECT_BASELINE** — зафиксировано состояние приложения до введения
   TASK-системы. См. [`docs/PROJECT_BASELINE.md`](PROJECT_BASELINE.md).
2. **TASK_001_HOME_NAVIGATION** — `DONE`.
   См. [`docs/tasks/TASK_001_HOME_NAVIGATION.md`](tasks/TASK_001_HOME_NAVIGATION.md).
3. **TASK_002_LIQUID_GLASS_TAB_INDICATOR** — `DONE`.
   См. [`docs/tasks/TASK_002_LIQUID_GLASS_TAB_INDICATOR.md`](tasks/TASK_002_LIQUID_GLASS_TAB_INDICATOR.md).
4. **TASK_003_MAIN_FINANCE_CARD** — `DONE`.
   См. [`docs/tasks/TASK_003_MAIN_FINANCE_CARD.md`](tasks/TASK_003_MAIN_FINANCE_CARD.md).
5. **TASK_003A_HOME_PERIOD_SYNC_AND_GLASS_SEGMENT** — `DONE`. Корректирующая
   задача к `TASK_003` (синхронизация переключателя периода с финансовой
   карточкой, стеклянный индикатор) — не занимает номер `TASK_004`. См.
   [`docs/tasks/TASK_003A_HOME_PERIOD_SYNC_AND_GLASS_SEGMENT.md`](tasks/TASK_003A_HOME_PERIOD_SYNC_AND_GLASS_SEGMENT.md).
6. **TASK_004_HOME_TX_LIST_IOS_LIGHT** — `DONE`. Редизайн блока записей на
   Главной (`#recentList`) в светлом минималистичном стиле iOS — белые
   карточки-дни на сером фоне, тонкий разделитель от аватарки, без цветной
   заливки строк; только визуальные изменения, данные/сортировка/
   обработчики/расчёты не тронуты. См.
   [`docs/tasks/TASK_004_HOME_TX_LIST_IOS_LIGHT.md`](tasks/TASK_004_HOME_TX_LIST_IOS_LIGHT.md).
7. **TASK_005_MONTH_SWITCH_CIRCLE_ARROWS** — `DONE`. Стрелки переключателя
   месяца финансовой карточки (`#fcMonthPrev`/`#fcMonthNext`) переоформлены
   в SVG-шеврон (референс — шеврон «Назад» iOS); первая итерация — круглая
   кнопка с обводкой, по доработке упрощена до чистого шеврона без
   круга/фона/обводки (активная стрелка — системный синий `var(--nav-blue)`,
   отключённая — светло-серая `var(--muted2)` с пониженной прозрачностью);
   поведение/обработчики не изменены. См.
   [`docs/tasks/TASK_005_MONTH_SWITCH_CIRCLE_ARROWS.md`](tasks/TASK_005_MONTH_SWITCH_CIRCLE_ARROWS.md).
8. **TASK_006_FIXED_HEADER_SCROLL_ISOLATION** — `DONE`. Исправлен баг iOS/
   PWA: верхняя шапка сдвигалась вниз при overscroll/rubber-band.
   `html`/`body` зафиксированы и не скроллятся, прокручивается только
   новый внутренний контейнер `.scroll-area`; шапка физически вне него.
   См.
   [`docs/tasks/TASK_006_FIXED_HEADER_SCROLL_ISOLATION.md`](tasks/TASK_006_FIXED_HEADER_SCROLL_ISOLATION.md).
9. **TASK_007_FIXED_BODY_DVH_WHITE_LINE_FIX** — `DONE`. Устранена белая
   линия внизу экрана на iPhone/PWA (следствие `TASK_006`) — `100%` →
   `100dvh` на `html`/`body` + фон на `html` для подстраховки; фикс
   неподвижной шапки не затронут. См.
   [`docs/tasks/TASK_007_FIXED_BODY_DVH_WHITE_LINE_FIX.md`](tasks/TASK_007_FIXED_BODY_DVH_WHITE_LINE_FIX.md).
10. **TASK_008_REVERT_FIXED_BODY_KEEP_NAV_POSITION** — `DONE`. Откачен
    `position:fixed`+`dvh` на `body` из `TASK_007` — на реальном iPhone он
    давал более широкую белую полосу и поднимал нижнюю навигацию над её
    обычным местом. `body` вернулась к обычному потоку
    (`overflow:hidden`, без `position:fixed`) — этого достаточно, т.к.
    весь реальный скролл уже изолирован в `.scroll-area` (`TASK_006`);
    `.nav` снова прилегает к истинному нижнему краю через
    `env(safe-area-inset-bottom)`, как было исходно. См.
    [`docs/tasks/TASK_008_REVERT_FIXED_BODY_KEEP_NAV_POSITION.md`](tasks/TASK_008_REVERT_FIXED_BODY_KEEP_NAV_POSITION.md).
11. **TASK_009_HOME_SCROLL_AREA_BG_UNDER_NAV** — `DONE`. Нашла настоящую
    причину «белого зазора под навигацией» на Главной (не устранённую
    `TASK_007`/`TASK_008`): резерв под плавающую `.nav` — это
    `padding-bottom` на `.scroll-area`, у которой никогда не было своего
    фона, вне бокса `#scrRecords{background:var(--home-bg)}`. Добавлено
    чистое CSS-правило `.scroll-area:has(>#scrRecords.active){background:
    var(--home-bg)}` — без изменений JS/логики экранов. См.
    [`docs/tasks/TASK_009_HOME_SCROLL_AREA_BG_UNDER_NAV.md`](tasks/TASK_009_HOME_SCROLL_AREA_BG_UNDER_NAV.md).
12. **TASK_010_ROOT_SAFE_AREA_EDGE_TO_EDGE_FIX** — `DONE`. Нашла настоящую
    причину «белой полосы под всем приложением» (не устранённую
    `TASK_009`, которая чинила только фон внутри `#scrollArea`):
    `TASK_006`/`TASK_007` задавали `body` `position:fixed;inset:0`
    одновременно с явной `height` — конфликтующая комбинация могла
    обрезать `body` короче реальной safe-area-покрытой области экрана;
    `TASK_008` убрала `fixed` совсем, что тоже не гарантирует растяжение.
    `viewport-fit=cover` в `<meta viewport>` был на месте всё это время
    (не терялся). Исправлено: `body` — `position:fixed;inset:0` без
    явной `width`/`height`, высота вычисляется из привязки к четырём
    истинным краям вьюпорта. См.
    [`docs/tasks/TASK_010_ROOT_SAFE_AREA_EDGE_TO_EDGE_FIX.md`](tasks/TASK_010_ROOT_SAFE_AREA_EDGE_TO_EDGE_FIX.md).

## Пояснения

- `TASK_001` является первой задачей в новой системе документации, а **не**
  первой реализованной функцией приложения — приложение существовало и
  развивалось до появления TASK-файлов (см.
  [`docs/PROJECT_BASELINE.md`](PROJECT_BASELINE.md) и `CHANGELOG.md`).
- Приложенные референсы финансового интерфейса (Liquid Glass, редизайн
  финансовых экранов) относятся к будущим задачам (`TASK_002`, `TASK_003` и
  далее) и **сейчас не реализуются**.
- Перед началом каждого следующего этапа должен быть создан подробный
  TASK-файл в `docs/tasks/` с целью, границами, требованиями, критериями
  готовности и планом проверок — см. [`AGENTS.md`](../AGENTS.md).
- Нумерация продолжается последовательно: `TASK_002`, `TASK_003` и далее.
