# PROJECT_STATUS — A-Lex Finance

**Обновлено:** 2026-07-26

## Состояние приложения

`STABLE`

## Baseline

- Создан: [`docs/PROJECT_BASELINE.md`](PROJECT_BASELINE.md) (2026-07-25).
- Стабильный коммит **кода приложения**: `126943afd479d29d8e9fe6815c67c305f2b89739` (`126943a`).
  Подтверждено раздачей `sw.js` с `CACHE = 'finance-v138'` на
  https://adar4026.github.io/finance/.
- Опубликованная версия проверена напрямую (production `sw.js`).

## Последняя завершённая задача

- **Задача:** [`TASK_010_ROOT_SAFE_AREA_EDGE_TO_EDGE_FIX`](tasks/TASK_010_ROOT_SAFE_AREA_EDGE_TO_EDGE_FIX.md)
- **Статус:** `DONE`
- Ранее завершённые задачи: [`TASK_009_HOME_SCROLL_AREA_BG_UNDER_NAV`](tasks/TASK_009_HOME_SCROLL_AREA_BG_UNDER_NAV.md),
  [`TASK_008_REVERT_FIXED_BODY_KEEP_NAV_POSITION`](tasks/TASK_008_REVERT_FIXED_BODY_KEEP_NAV_POSITION.md),
  [`TASK_007_FIXED_BODY_DVH_WHITE_LINE_FIX`](tasks/TASK_007_FIXED_BODY_DVH_WHITE_LINE_FIX.md),
  [`TASK_006_FIXED_HEADER_SCROLL_ISOLATION`](tasks/TASK_006_FIXED_HEADER_SCROLL_ISOLATION.md),
  [`TASK_005_MONTH_SWITCH_CIRCLE_ARROWS`](tasks/TASK_005_MONTH_SWITCH_CIRCLE_ARROWS.md),
  [`TASK_004_HOME_TX_LIST_IOS_LIGHT`](tasks/TASK_004_HOME_TX_LIST_IOS_LIGHT.md),
  [`TASK_003A_HOME_PERIOD_SYNC_AND_GLASS_SEGMENT`](tasks/TASK_003A_HOME_PERIOD_SYNC_AND_GLASS_SEGMENT.md),
  [`TASK_003_MAIN_FINANCE_CARD`](tasks/TASK_003_MAIN_FINANCE_CARD.md),
  [`TASK_002_LIQUID_GLASS_TAB_INDICATOR`](tasks/TASK_002_LIQUID_GLASS_TAB_INDICATOR.md),
  [`TASK_001_HOME_NAVIGATION`](tasks/TASK_001_HOME_NAVIGATION.md) — `DONE`.

## Активная задача

Нет. `TASK_002A` (полноценный визуально заметный Liquid Glass) остаётся
отложенной, следующая задача не начата.

## Следующие этапы

Следующая задача не определена и не начата.

## Изменение кода приложения после baseline

`TASK_002` добавила в нижнюю навигацию Liquid Glass индикатор активной
вкладки (только `index.html`, только `.nav`/`.nav-indicator`) поверх
baseline-коммита `126943a`. `TASK_003` заменила главную финансовую карточку
на Главной (`#scrRecords`) — белая карточка, переключатель месяца,
двухлинейный график, приватный режим — новый файл
`js/services/finance_card_service.js`, версия кэша `sw.js` поднята до
`finance-v139` (позже `finance-v141` в рамках доработок той же задачи).
`TASK_003A` устранила рассинхронизацию между общим переключателем
День/Неделя/Месяц/Год/Период и финансовой карточкой (карточка использовала
изолированное состояние `cardMonth`, теперь удалённое, — карточка работает
от общего `period`/`anchor`), вернула и обобщила график карточки на все
пять режимов, заменила сплошную сиреневую заливку активной вкладки на
стеклянный индикатор (токены `TASK_002`). Новый файл
`js/services/period_service.js` (`AF.Services.Period`), версия кэша `sw.js`
поднята до `finance-v142` (позже `finance-v144` в рамках доработок той же
задачи — см. её TASK-файл). `TASK_004` переоформила список операций на
Главной (`#recentList`) в светлом минималистичном стиле iOS: белые
карточки-дни на нейтральном сером фоне экрана (уже существовавший
`var(--home-bg)`), тонкий разделитель строки от края аватарки, название
операции полужирным сверху и доп. информация мельче под ним, счёт с
аватаркой мелким серым над суммой, сумма красная/зелёная/нейтральная по
типу — без цветной заливки всей строки. Новые изолированные функции
`homeGroupedTxHtml()`/`homeTxRow()` и CSS-классы `.home-*` в `index.html`
— не затрагивают общие `groupedTxHtml()`/`txRow()`/`.tx`/`.daycard`,
используемые экранами «Все операции», категория, счёт, бюджет. Финансовая
карточка (`TASK_003`/`TASK_003A`) не изменена. Версия кэша `sw.js` поднята
до `finance-v145`. `TASK_005` заменила плоские текстовые стрелки `‹`/`›`
переключателя месяца финансовой карточки (`#fcMonthPrev`/`#fcMonthNext`)
на векторный SVG-шеврон (по референс-скриншоту пользователя, стиль
стандартной кнопки «Назад» iOS); первая итерация добавляла круглую обводку
вокруг шеврона, но по дополнительной правке пользователя круг/фон/обводка
убраны — остался только сам шеврон: активная стрелка окрашена
существующим токеном «системного синего» `var(--nav-blue)` (тот же, что у
активной вкладки нижней навигации), отключённая — `var(--muted2)` с
пониженной прозрачностью; disabled/visibility/aria-label-логика и
обработчики клика не изменены. Версия кэша `sw.js` поднята до
`finance-v146` (первая итерация), затем `finance-v147` вместе с
`TASK_006` (упрощение шеврона попало в тот же `index.html` перед
публикацией). `TASK_006` устранила баг iOS/PWA, при котором
верхняя шапка (`#topbar`) сдвигалась вниз вместе с контентом при
overscroll/rubber-band: `html`/`body` теперь зафиксированы
(`position:fixed`, не скроллятся вообще), `.app` — нескроллящаяся
flex-рамка на весь экран, а прокручивается только новый внутренний
контейнер `.scroll-area` (`#subhead` + все `.screen`), физически
расположенный ниже шапки — она не может сдвинуться при rubber-band внутри
него ни при каких обстоятельствах. Обновлены: слушатель
`#topbar.scrolled` (теперь по `#scrollArea.scrollTop`, было
`window.scrollY`) и автопрокрутка при drag-and-drop счетов/категорий
(теперь `#scrollArea`, было `document.scrollingElement`). Версия кэша
`sw.js` поднята до `finance-v147`. `TASK_007` устранила замеченную
пользователем на реальном iPhone/PWA белую линию внизу экрана —
последствие `TASK_006`: `html`/`body` получили `height:100%` без фона на
`html`, а на iOS layout-viewport (`100%`/`100vh`) не всегда совпадает с
реальной видимой областью при показе/скрытии панели Safari, из-за чего
зафиксированный `body` мог не дотягиваться до низа экрана, обнажая белый
фон `html` по умолчанию. Исправлено: `height:100vh;height:100dvh` (вместо
`100%`) на `html`/`body` — `dvh` отслеживает реальную видимую область
живьём; плюс `background:var(--bg)` на `html` как подстраховка на случай
остаточного зазора (теперь в цвет темы, а не белый). Фикс `TASK_006`
(неподвижная шапка) не затронут. Версия кэша `sw.js` поднята до
`finance-v148`. `TASK_008` откатила именно `position:fixed`+`dvh` на
`body` из `TASK_007` — на реальном iPhone это дало **более широкую** белую
полосу: у зафиксированного `body` расчётная высота оказалась меньше
фактической видимой области, из-за чего нижняя навигация (`.nav`,
CSS которой не менялась ни разу с `TASK_004` — подтверждено `git diff`)
визуально «поднялась» над своим обычным местом. Поскольку весь реальный
скролл уже изолирован внутри `.scroll-area` (`TASK_006`), у `body` в
принципе нет лишнего содержимого для прокрутки — обычного
`overflow:hidden` без `position:fixed`/`dvh` достаточно, чтобы rubber-band
не возникал, и одновременно `.nav` снова корректно прилегает к истинному
нижнему краю экрана через `env(safe-area-inset-bottom)`, как было исходно.
`background:var(--bg)` на `html` оставлен как безобидная подстраховка.
Версия кэша `sw.js` поднята до `finance-v149`. `TASK_009` нашла настоящую
причину «белого зазора под навигацией», которую `TASK_007`/`TASK_008` не
устранили (они чинили не тот слой — высоту `html`/`body`, а не цвет
фона): у `.scroll-area` никогда не было своего фона, а резерв под
плавающую `.nav` — это `padding-bottom` именно на `.scroll-area`
(`TASK_006`), лежащий вне собственного бокса `#scrRecords{background:
var(--home-bg)}` (`TASK_003`) — там просвечивал прозрачный `.app` → белый
`body`. Добавлено CSS-правило `.scroll-area:has(>#scrRecords.active)
{background:var(--home-bg)}` — чистый CSS, без изменений JS/логики
экранов (реагирует на существующий класс `.active`, переключаемый уже
существующей `showScreen()`); фон `.scroll-area` (включая её
`padding-bottom`, т.е. зону под навигацией и `env(safe-area-inset-bottom)`)
теперь совпадает с фоном экрана Главной, пока она активна, и остаётся
прозрачным (как раньше) на остальных экранах. Версия кэша `sw.js`
поднята до `finance-v150`. `TASK_010` нашла настоящий корень «белой
полосы под всем приложением», которую `TASK_009` не устраняла (та чинила
фон только внутри `#scrollArea`, а полоса была снаружи, ниже всей
`.app`): `TASK_006`/`TASK_007` задавали `body` `position:fixed;inset:0`
**одновременно** с явной `height` (`100%`/`100vh`/`100dvh`) — явная
`height` конфликтует с расчётом от `inset:0` и может оказаться короче
реальной safe-area-покрытой области экрана, обрезая `body` раньше
истинного нижнего края; `TASK_008` убрала `fixed` целиком, что тоже не
гарантирует растяжение под `env(safe-area-inset-bottom)`. Проверено:
`<meta name="viewport">` с `viewport-fit=cover` присутствовал с самого
начала, не был потерян/переопределён ни на одном этапе. Исправлено:
`body` — `position:fixed;inset:0` **без** явной `width`/`height` — высота
вычисляется браузером из привязки к четырём истинным краям вьюпорта
(гарантированно включает safe-area при `viewport-fit=cover`), а не из
потенциально короткого явного значения; `.app{height:100%}` наследует
эту корректную высоту. Версия кэша `sw.js` поднята до `finance-v151`.
Раздел «Baseline» выше описывает состояние **до** TASK-системы и не
переписывается под каждую задачу (см. [`AGENTS.md`](../AGENTS.md), п. 6) —
подробности каждой задачи фиксируются в её собственном TASK-файле
([`TASK_002`](tasks/TASK_002_LIQUID_GLASS_TAB_INDICATOR.md),
[`TASK_003`](tasks/TASK_003_MAIN_FINANCE_CARD.md),
[`TASK_003A`](tasks/TASK_003A_HOME_PERIOD_SYNC_AND_GLASS_SEGMENT.md),
[`TASK_004`](tasks/TASK_004_HOME_TX_LIST_IOS_LIGHT.md),
[`TASK_005`](tasks/TASK_005_MONTH_SWITCH_CIRCLE_ARROWS.md),
[`TASK_006`](tasks/TASK_006_FIXED_HEADER_SCROLL_ISOLATION.md),
[`TASK_007`](tasks/TASK_007_FIXED_BODY_DVH_WHITE_LINE_FIX.md),
[`TASK_008`](tasks/TASK_008_REVERT_FIXED_BODY_KEEP_NAV_POSITION.md),
[`TASK_009`](tasks/TASK_009_HOME_SCROLL_AREA_BG_UNDER_NAV.md),
[`TASK_010`](tasks/TASK_010_ROOT_SAFE_AREA_EDGE_TO_EDGE_FIX.md)).

---

**Важно:** документационные коммиты (включая фиксацию TASK-системы и
baseline) создаются отдельно от изменений кода приложения — за исключением
`feat(TASK_XXX)`-коммитов, которые по формату AGENTS.md намеренно включают
и код, и обновление собственного TASK-файла/CHANGELOG в одном коммите.
