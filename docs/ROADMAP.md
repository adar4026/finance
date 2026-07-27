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
13. **TASK_011_STANDALONE_BOTTOM_STRIP_DIAGNOSIS** — `DONE`. Доказала, что
    `TASK_006`–`TASK_010` правили не тот слой: настоящая причина —
    `apple-mobile-web-app-status-bar-style: black-translucent`, из-за
    которого standalone-вьюпорт был короче физического экрана ровно на
    высоту статус-бара (на устройстве пользователя `812 → 759`, разница
    `53px` = `inset-top`). Диагностировано временной debug-сборкой
    (контрастные фоны слоёв + панель живых замеров) на реальном iPhone,
    сборка полностью удалена после получения данных. Исправлено сменой
    стиля статус-бара на `default`. См.
    [`docs/tasks/TASK_011_STANDALONE_BOTTOM_STRIP_DIAGNOSIS.md`](tasks/TASK_011_STANDALONE_BOTTOM_STRIP_DIAGNOSIS.md).
14. **TASK_012_APP_ICON_PRODUCTION_ASSET** — `DONE`. Из предоставленного
    пользователем референса (`IMG_2662.jpg`, 602×619) сгенерирован
    production-качества набор иконок без изменения дизайна/композиции:
    цвет приведён к sRGB, кадр дополнен до квадрата (без обрезки), рендер
    в `icon-512.png`/`icon-192.png`/`apple-touch-icon.png`/
    `favicon-32.png`. `manifest.json` правок не потребовал; версия кэша
    `sw.js` поднята `finance-v152` → `finance-v153`. См.
    [`docs/tasks/TASK_012_APP_ICON_PRODUCTION_ASSET.md`](tasks/TASK_012_APP_ICON_PRODUCTION_ASSET.md).
15. **TASK_013_FULLSCREEN_ADD_TRANSACTION** — `DONE`. Промежуточная шторка
    «Добавить» (Расход/Доход/Перевод/Чек) убрана; кнопка «+» открывает
    полноэкранную страницу создания операции (тип «Расход» по умолчанию,
    переключатель типов внутри страницы, без закрытия/переоткрытия).
    Форма (общая для добавления и редактирования) переоформлена в
    существующий в проекте паттерн полноэкранной страницы; функция чека
    сохранена внутри формы расхода/дохода. Системный back/свайп
    назад/программное закрытие — через `history.pushState`/`popstate`.
    Новый чистый сервис `js/services/tx_form_service.js` покрыт
    Node-тестом. Версия кэша `sw.js` поднята `finance-v153` →
    `finance-v154`. См.
    [`docs/tasks/TASK_013_FULLSCREEN_ADD_TRANSACTION.md`](tasks/TASK_013_FULLSCREEN_ADD_TRANSACTION.md).
16. **TASK_014_TX_PAGE_PREMIUM_REDESIGN** — `DONE`. Премиальный редизайн
    полноэкранной страницы операции (только внешний вид и UX). Сначала
    подготовлены три дизайн-концепции со статическими прототипами
    (Apple Minimal / Apple Liquid Finance / Premium Banking) и сравнительный
    отчёт; пользователь выбрал гибрид — каркас «Liquid Finance» (фон
    `--home-bg` + едва заметное холодное свечение, стекло только на
    закреплённых шапке и футере, перемещающийся стеклянный индикатор
    сегмента) со структурой «Apple Minimal» (непрозрачные карточки, сумма
    основным цветом текста, окрашен только знак). `.sheet` разделена на
    закреплённую шапку, прокручиваемое тело и закреплённый футер с основной
    кнопкой; поля сгруппированы в три карточки; нативные `select`/`date`
    сохранены прозрачным слоем поверх строк; добавлены локальные токены
    `--tx-*` в обеих темах (глобальные `--expense`/`--income`/`--accent` не
    тронуты). Бизнес-логика, модель операции и история `TASK_013` не
    изменены. Версия кэша `sw.js` поднята `finance-v154` → `finance-v155`
    (`01ec96a`), затем `finance-v155` → **`finance-v156`** follow-up-коммитом
    `6f82f2e` (полная окраска суммы по типу операции) — `finance-v156` и
    является фактической опубликованной версией задачи. Проверена
    пользователем на реальном iPhone и принята как стабильная. См.
    [`docs/tasks/TASK_014_TX_PAGE_PREMIUM_REDESIGN.md`](tasks/TASK_014_TX_PAGE_PREMIUM_REDESIGN.md).
17. **TASK_015_ADVANCED_TRANSACTION_METADATA** — `DONE`. Расширение
    модели операции тремя необязательными метаданными: `payee`
    (получатель/магазин), `tags` (метки), `location` (место — только
    текст, без GPS/геолокации/карт). Задача отложена из `TASK_014`
    (п. 7.5), где отклонена как выходящая за границы визуального
    редизайна. Планируется: новый чистый сервис
    `js/services/tx_meta_service.js` с правилами нормализации,
    `SCHEMA_VERSION` 2 → 3 и нормализация в `AF.Store.migrate()` как
    единой точке всех путей входа данных, три поля в форме,
    автоподстановка получателя из существующих операций (без отдельного
    справочника), поиск по новым полям, исправление найденной ошибки
    соответствия колонок CSV-экспорта (подкатегория попадала в колонку
    «Контрагент») с обязательным regression-тестом, заполнение
    `Контрагент`/`Метки`/`Место` и раскладка при импорте вместо склейки
    в `note`, `payee` во вторичной строке списков операций (теги и
    место в списках не показываются). Обязательное требование — полная
    обратная совместимость старых данных, backup-файлов и отката версии.
    **План утверждён пользователем 2026-07-27**, все спорные решения
    закрыты; **реализация выполнена, проверена в браузере и
    подтверждена пользователем 2026-07-27**. Дополнительно реализована
    автоподстановка получателя и зафиксирован блокирующий инвариант
    совместимости (§0): ни один рассинхронизированный набор файлов
    GitHub Pages/Fastly не должен ронять приложение — все обращения к
    новому сервису идут через хелпер `txMeta()` с fallback-нормализацией,
    `migrate()` проверяет наличие сервиса, `export_service.js` от него не
    зависит; проверено искусственным удалением сервиса в рантайме.
    Версия кэша `sw.js` поднята `finance-v156` → `finance-v157`. Тесты:
    258 passed в 5 файлах (было 101 в 3). Ручная проверка на реальном
    iPhone не выполнялась в этой сессии — рекомендуется пользователю
    после деплоя (см. TASK-файл, план проверки). Отложены как отдельные
    будущие задачи: нормализация диакритики в поиске и перенос
    метаданных в схему `reminders`. Отдельно обнаружено вне границ
    задачи и не исправлено: `loadDemo()` ссылается на несуществующие id
    категорий, из-за чего демо-операции отображаются как «Другое» —
    расхождение существовало до `TASK_015`. См.
    [`docs/tasks/TASK_015_ADVANCED_TRANSACTION_METADATA.md`](tasks/TASK_015_ADVANCED_TRANSACTION_METADATA.md).

18. **TASK_016_DEMO_DATA_AND_SEARCH_NORMALIZATION** — `DONE`. Два
    небольших независимых исправления, отложенных как известные
    ограничения `TASK_015` (ОВ-4 и отдельно зафиксированный
    `loadDemo()`-дефект): (1) `loadDemo()` ссылалась на несуществующие id
    категорий/подкатегорий (`realty`, `income_main`, `products`, `prius`,
    `flat`, `clothes`, `beauty`, `tech`, `subscriptions`) — все
    демо-операции отображались как «Другое ❓»; исправлено переносом на
    существующие семантически близкие id (таблица соответствия — в
    TASK-файле), таксономия и генерация demo-операций вынесены в новые
    чистые сервисы `js/services/category_taxonomy_service.js`/
    `js/services/demo_data_service.js`. (2) Поиск не нормализовал
    Unicode-диакритику (`Gijón` не находился по `gijon`); новый чистый
    `js/services/search_service.js` (`AF.Services.Search.
    normalizeSearchText`, NFD-декомпозиция + удаление combining marks)
    применён к обеим сторонам сравнения в `txSearchText()`/`runSearch()`
    без изменения отображаемых данных, без транслитерации кириллицы. Все
    три новых сервиса безопасно деградируют при отсутствии (проверено
    искусственным удалением в рантайме, тот же принцип, что `TxMeta` в
    `TASK_015`). `SCHEMA_VERSION` не менялся (остаётся 3). Версия кэша
    `sw.js` поднята `finance-v157` → `finance-v158`. Тесты: 534 passed в
    7 файлах (было 258 в 5). См.
    [`docs/tasks/TASK_016_DEMO_DATA_AND_SEARCH_NORMALIZATION.md`](tasks/TASK_016_DEMO_DATA_AND_SEARCH_NORMALIZATION.md).
19. **TASK_017_PREMIUM_NAVIGATION_DRAWER** — `DONE`. Полная визуальная
    переработка бокового меню (Navigation Drawer) в стиле «Apple Wallet /
    Liquid Glass» по референсу пользователя — только CSS/разметка/JS-
    рендеринг `#drawerOverlay`/`.drawer`, без изменений архитектуры,
    навигации и бизнес-логики. Header — карточка-«кошелёк» (градиент,
    скругление 24px, glass, единая кнопка → профиль); пункты меню — три
    карточки-группы («Планирование»/«Аналитика»/«Приложение») вместо
    одного списка; emoji заменены на 11 цветных SVG-иконок в едином
    stroke-based стиле; badge уведомлений — новый изолированный класс
    `.dr-badge` (общий `.prof-badge` профиля не тронут); тонкие
    разделители; компактный footer без даты релиза. Главный экран и
    нижняя навигация позади drawer при открытии/закрытии затемняются,
    размываются и слегка уменьшаются в масштабе через `body.drawer-open`.
    Анимации — slide/fade/последовательное появление карточек, короткие.
    Карточка общего капитала сохранена (существующая функция) и визуально
    подстроена под новый стиль. Версия кэша `sw.js` поднята
    `finance-v158` → `finance-v159`. Тесты: 534 passed, 0 failed (без
    изменений — сервисы/логика не затронуты). Опубликовано коммитом
    `28e736f`, production проверен (`finance-v159` отдаётся, drawer,
    обе темы, переходы на экраны, отсутствие остаточных blur/scale и
    console errors). Реальная проверка на iPhone Safari/PWA не
    выполнена — инструмент iOS-симулятора вернул ошибку в этой сессии,
    остаётся единственным открытым пунктом. См.
    [`docs/tasks/TASK_017_PREMIUM_NAVIGATION_DRAWER.md`](tasks/TASK_017_PREMIUM_NAVIGATION_DRAWER.md).
20. **TASK_017A_DRAWER_REMOVE_CAPITAL_CARD** — `DONE`. Небольшой
    corrective follow-up к `TASK_017` (не занимает номер `TASK_018`):
    карточка «Общий капитал» (баланс + спарклайн) полностью убрана из
    drawer по правке пользователя — разметка, CSS (в скоупе
    `.drawer-cap`, общие `.dc-l`/`.dc-v` донат-диаграмм не затронуты) и
    функция `renderDrawerCap()` удалены. Footer автоматически подтянулся
    к последней группе меню (`margin-top:auto`), без разрыва. Остальной
    дизайн `TASK_017` не изменён; `totalCapital()` (Главная, экран
    «Счета») не затронута. Версия кэша `sw.js` поднята `finance-v159` →
    `finance-v160`. Тесты: 534 passed, 0 failed. См.
    [`docs/tasks/TASK_017A_DRAWER_REMOVE_CAPITAL_CARD.md`](tasks/TASK_017A_DRAWER_REMOVE_CAPITAL_CARD.md).
21. **TASK_018_CATEGORIES_APPLE_REDESIGN** — `DONE`. Полный
    Apple-редизайн экрана «Категории» (`#catMgrOverlay`) под стиль
    Главной: фон `var(--home-bg)`, карточки с минимальной тенью
    (`var(--fincard-shadow)`) и увеличенным радиусом, переключатель
    Расходы/Доходы переведён на тот же компонент `.periods`/
    `.periods-indicator` (синее Liquid Glass), что и переключатель
    периода Главной (новая `moveCatMgrSegIndicator()`). Drag & drop
    доработан: spring-подъём карточки, FLIP-анимация соседних карточек
    (`flipCatRows()`), второй haptic после успешного отпускания,
    современная SVG grip-иконка ручки (увеличивается/темнеет при
    захвате). Кнопка закрытия уже была унифицирована (`.iconbtn`) —
    изменений не потребовалось. Попутно найден и исправлен смежный баг:
    `commitCatOrder()` вызывала `.map()` на `NodeList` (`$$()` не
    оборачивает в массив), из-за чего reorder категорий падал с
    `TypeError` при любом отпускании карточки и не работал вообще —
    исправлено на `[...$$(...)].map(...)`. Структура данных/бизнес-
    логика категорий и подкатегорий не изменены. Версия кэша `sw.js`
    поднята `finance-v160` → `finance-v161`. Тесты: 534 passed, 0 failed.
    Проверено в браузере реальным трастованным drag, светлая/тёмная
    тема, консоль без ошибок. См.
    [`docs/tasks/TASK_018_CATEGORIES_APPLE_REDESIGN.md`](tasks/TASK_018_CATEGORIES_APPLE_REDESIGN.md).

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
