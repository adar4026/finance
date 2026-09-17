# TASK_052 — Шторка: убрать карточку «Общий баланс», сделать inline-блоком под профилем

**Статус:** DONE (опубликовано)

## Контекст

После `TASK_050`/`TASK_051` блок «Общий баланс» (`#drawerBalance`) в боковой
шторке — отдельная стеклянная карточка: `background:var(--hero-glass)`,
`border:1px solid var(--hero-glass-border)`, `box-shadow:var(--tx-card-shadow)`,
`border-radius:22px`, `backdrop-filter:blur(14px)` (см. `index.html:1889-1899`).
Пользователь хочет убрать этот второй «прямоугольник» под профилем и
превратить баланс в лёгкий текстовый блок прямо на фоне шторки — часть
header-зоны, а не отдельная плитка.

## Цель

Сразу под `#drawerHead` — inline-блок без фона/рамки/тени/скругления/blur,
на общем immersive-фоне шторки:

```text
Общий баланс                                      [глаз]
€64 583,63
−€821,65 (−1,3 %) за месяц
```

- «Общий баланс» — небольшой приглушённый текст, не жирный (без uppercase
  card-эффекта, обычным регистром — «Общий баланс», не «ОБЩИЙ БАЛАНС»).
- Кнопка глаза справа в той же строке: без круглой плашки, зона нажатия
  ≥44×44 px (используется существующий базовый `.fc-eye` 44×44 — тот же,
  что на Главной/Счетах, без уменьшенного скоуп-оверрайда шторки).
- Сумма — крупная, полужирная, `tabular-nums` (уже даёт базовый `.hb-val`).
- Изменение за месяц — компактной строкой ниже, сохраняет `.fc-chg.pos`/
  `.fc-chg.neg` (зелёный/красный из тех же токенов `--income`/`--expense`).
- Небольшой, аккуратный отступ до заголовка «ПЛАНИРОВАНИЕ» — без ощущения
  пустой карточки.

## Границы работы

Разрешено:

- `index.html` — только CSS-правила `.drawer-balance` и вложенных
  scoped-overrides (`.drawer-balance .hb-head/.hb-label/.fc-eye/.hb-val/
  .fc-chg`). Разметка `#drawerBalance`/`#fcVal`/`#fcChg`/`#fcEye` —
  структура (`<div class="hb-head">…</div><div id="fcVal">…</div><div
  id="fcChg">…</div>`) не меняется, только правится, если того требует
  чисто визуальная адаптация (без изменения набора/порядка элементов и id).
- `sw.js` — версия кэша (следующая по счёту после `finance-v183`).
- `tests/*.test.js` — обновление инвариантов, которые сверяют CSS/вид
  `#drawerBalance` (`tests/drawer_redesign.test.js`), и новый тест
  `tests/drawer_balance_inline.test.js`.
- Документация: этот TASK-файл, `docs/PROJECT_STATUS.md`,
  `docs/ROADMAP.md`, `CHANGELOG.md`.

Запрещено:

- `renderFinanceCard()`, `updateFcEye()`, расчёт баланса/изменения
  (`AF.Services.FinanceCard`, `AF.Services.Account.totalCapital`,
  `AF.Services.Period`) — семантика и данные не меняются.
- Обработчик `#fcEye` (`state.hideAmounts=!state.hideAmounts;save();
  render();updateEye();updateFcEye();`), privacy-режим (`maskAmt`).
- Дублирование id `#fcVal`/`#fcChg`/`#fcEye` — они остаются единственными
  элементами с этими id, как и раньше.
- Возврат карточки баланса на Главную (`#scrRecords`).
- Профиль (`#drawerHead`, `.dh-*`), кнопка темы (`#drTheme`), группы
  меню и их пункты, footer (`#drawerRelease`), backdrop, Escape, жесты,
  ширина/open-close-логика шторки — из `TASK_050`/`TASK_051`, не трогаем.
- Нижняя навигация, `+`, операции, счета, бюджеты, аналитика,
  import/export, `AF.Store`/IndexedDB, маршруты, `manifest.json`, логика
  `sw.js` (кроме версии кэша).
- `.claude/launch.json`, удалённый `icon.svg`, `.DS_Store` и другие
  несвязанные изменения рабочего дерева.
- Новые зависимости, хардкод новых цветов (только существующие токены
  шторки/hero-фона и семантические `--income`/`--expense`/`--muted`/
  `--text`), debug-код.

## Требования

1. `.drawer-balance` — без `background`, `border`, `box-shadow`,
   `border-radius`, `backdrop-filter`. Только `margin`/`text-align:left`
   (и, по желанию, лёгкая анимация появления, как у других блоков
   шторки — не создаёт эффекта карточки).
2. Метка «Общий баланс» (`.drawer-balance .hb-label`) — обычный регистр
   (не uppercase), умеренный вес (≤500), приглушённый цвет `var(--muted)`.
3. Кнопка глаза (`.drawer-balance .fc-eye`) — использует базовые размеры
   `.fc-eye` (44×44 px реальной зоны нажатия), без круглого фона/плашки
   (наследует `border:none;background:none` из базового правила); допустим
   лёгкий `opacity` для спокойного вида.
4. Сумма (`.drawer-balance .hb-val`) — крупнее текущих 26px, полужирная
   (`font-weight:800`, как в базовом `.hb-val`), `tabular-nums` уже
   наследуется из базового правила, без явного `text-shadow`.
5. Строка изменения (`.drawer-balance .fc-chg`) — компактная, наследует
   `.pos`/`.neg` цвета без изменений в CSS-правилах для этих классов.
6. Отступ между `#drawerBalance` и первым заголовком группы
   («ПЛАНИРОВАНИЕ») — сопоставим с текущим зазором между группами
   (`.drawer-group{margin-top:12px}`), не создаёт впечатления пустого
   места.
7. На 320/390/430 px: без горизонтального overflow, без обрезки текста
   изменения, без layout shift остальной шторки.
8. Light/dark: текст остаётся контрастным (используются только
   существующие токены — `--muted`, `--text`, `--income`, `--expense`).
9. `sw.js`: поднять cache version на следующую после `finance-v183`.

## Критерии готовности / план проверок

1. Все `tests/*.test.js` — 0 failed. Новый тест подтверждает: у
   `#drawerBalance` нет `background`/`border`/`box-shadow`/
   `backdrop-filter`/`border-radius` (карточного вида); блок расположен
   между `#drawerHead` и первой группой «Планирование»; `#fcVal`/
   `#fcChg`/`#fcEye` встречаются в документе ровно по одному разу;
   `.fc-eye` в шторке имеет реальную зону нажатия ≥44×44 px; структура
   шторки (9 пунктов, 3 группы, профиль, тема, footer) не изменилась.
2. Preview 320/390/430, light/dark: инспекция `#drawerBalance` —
   `getComputedStyle` подтверждает прозрачный фон и отсутствие рамки/тени;
   значения `#fcVal`/`#fcChg` реальные (демо-данные), privacy-режим
   (`#fcEye`) скрывает/показывает; нет горизонтального overflow
   (`document.documentElement.scrollWidth === innerWidth`).
3. Функционально: все 9 пунктов меню, профиль, тема, backdrop, Escape —
   как до изменения (регрессия по существующим тестам `TASK_050`/`051`).
4. Production после деплоя: новая версия кэша, визуально баланс без
   карточки на https://adar4026.github.io/finance/, консоль без ошибок.

## Результат

### Что реализовано

- **`index.html` → CSS `.drawer-balance`.** Удалены `background:var(
  --hero-glass)`, `border:1px solid var(--hero-glass-border)`,
  `box-shadow:var(--tx-card-shadow)`, `border-radius:22px`,
  `backdrop-filter:blur(14px)`/`-webkit-backdrop-filter` — карточный вид
  из `TASK_050` убран полностью. Блок теперь только
  `margin:4px 16px 8px;text-align:left` + прежняя лёгкая fade-in
  анимация (не создаёт эффекта карточки, просто плавное появление, как
  у остальных блоков шторки).
- **Метка «Общий баланс».** `text-transform:uppercase;letter-spacing:
  .03em;font-weight:600` → `text-transform:none;letter-spacing:0;
  font-weight:500` — обычный регистр текста (как в примере задачи), не
  жирная, приглушённый цвет `var(--muted)` не менялся.
- **Кнопка глаза (`#fcEye`).** Скоуп-оверрайд `.drawer-balance .fc-eye`
  (уменьшавший тап-зону до 32×32 px) удалён целиком — глаз теперь
  наследует базовое правило `.fc-eye{width:44px;height:44px;border:
  none;background:none;...}`, тот же компонент, что на Главной/Счетах.
  Тап-зона ровно 44×44 px (подтверждено `getBoundingClientRect()` в
  preview), без круглой плашки — фон появляется только на активном
  нажатии (`.fc-eye:active{background:var(--card2)}`, как и раньше во
  всём приложении).
- **Сумма (`#fcVal`).** `font-size:26px;font-weight:700` →
  `font-size:29px;font-weight:800` — крупнее и более полужирная,
  главный акцент блока; `tabular-nums` и `white-space:nowrap;overflow:
  hidden;text-overflow:ellipsis` наследуются из базового `.hb-val`
  (безопасная защита от overflow на всё же реальные суммы не
  срабатывает — подтверждено в preview на 320 px с примером из задачи
  `€64 583,63`, `scrollWidth === clientWidth`).
- **Строка изменения (`#fcChg`).** `font-size:12px` → `12.5px`,
  остальное не менялось; `.fc-chg.pos`/`.fc-chg.neg` → `var(--income)`/
  `var(--expense)` — семантика цвета не тронута (проверено на примере
  `−€821,65 (−1,3 %) за месяц`, отображается красным).
- **Разметка** `#drawerBalance`/`#fcVal`/`#fcChg`/`#fcEye` — не
  менялась ни на один элемент; только уточняющий комментарий над
  блоком (TASK_052 не переносит/не дублирует эти id).
- **`renderFinanceCard()`/`updateFcEye()`/расчёты** — не тронуты (0
  изменений в JS-логике), подтверждено новым тестом посимвольным
  сравнением ключевых строк функции.
- **`sw.js`** `finance-v183` → `finance-v184`.
- **Тесты.** Новый `tests/drawer_balance_inline.test.js` (68 проверок:
  отсутствие фона/рамки/тени/скругления/blur у `.drawer-balance`;
  позиция между `#drawerHead` и «Планирование»; единственность `#fcVal`/
  `#fcChg`/`#fcEye`; тап-зона глаза 44×44 без плашки; регистр/вес метки;
  размер/вес суммы и наследование tabular-nums; сохранённая семантика
  `.pos`/`.neg`; неизменность обработчика и `updateFcEye()`/`maskAmt`;
  только существующие токены (`--muted`/`--text`/`--income`/
  `--expense`) без хардкода hex/rgba; контраст текста к фону шторки в
  light/dark (≥3:1 метка, ≥4.5:1 сумма); компактный нижний отступ
  (0–14px); остальная структура шторки `TASK_050`/`051` не изменилась;
  `sw.js`). `tests/drawer_redesign.test.js` §5: две устаревшие
  ассерции про стеклянную карточку баланса заменены одной — «без
  собственного фона» (со ссылкой на `TASK_052`). `tests/
  release_info.test.js`: точная проверка `finance-v183` ослаблена до
  формата `finance-vNNN` (по той же схеме, что уже применялась между
  `TASK_050`→`051`).

### Изменённые файлы

- `index.html` — только CSS `.drawer-balance` и вложенные scoped-
  overrides, плюс один уточняющий HTML-комментарий (без изменения
  разметки/id).
- `sw.js` — версия кэша.
- `tests/drawer_balance_inline.test.js` (новый), `tests/
  drawer_redesign.test.js`, `tests/release_info.test.js`.
- `docs/tasks/TASK_052_DRAWER_BALANCE_INLINE.md` (этот файл),
  `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `CHANGELOG.md`.

### Проверки

- **Тесты:** все `tests/*.test.js` — **2429 passed, 0 failed** (было
  2361: без регрессий + 68 новых).
- **Preview** (`http://localhost:8912/`, демо-данные `loadDemo()`;
  скриншоты — headless Chrome в чистом временном профиле,
  `--use-mock-keychain --password-store=basic`):
  - `getComputedStyle(#drawerBalance)`: `background-color:
    rgba(0,0,0,0)`, `border-style:none`, `box-shadow:none`,
    `border-radius:0px` — карточка полностью убрана.
  - Тап-зона `#fcEye`: `getBoundingClientRect()` → `44×44` px точно.
  - 390×844 light/dark, 320×568 light, 430×932 dark — визуально: баланс
    — часть header-зоны, без прямоугольника, аккуратный отступ до
    «ПЛАНИРОВАНИЕ», без пустоты. Пример из задачи (`€64 583,63` /
    `−€821,65 (−1,3 %) за месяц`) воспроизведён на 320/430 px — красный
    цвет минуса, `scrollWidth === clientWidth` у суммы и строки
    изменения (без обрезки/переноса/горизонтального scroll),
    `document.documentElement.scrollWidth === innerWidth` (без
    overflow).
  - Privacy mode: `€3 851` → `€∗∗∗∗` (сумма) и `+€1 354 (+54.2%) за
    месяц` → `€∗∗∗∗ за месяц` (изменение) → обратно — как раньше.
  - Функционально: все 9 пунктов шторки открывают свои экраны и
    закрывают шторку, `#drawerHead` → профиль, тема light→dark→light
    (иконка/подпись синхронны), backdrop-клик и Escape закрывают
    шторку — без регрессий.
  - Консоль: без ошибок приложения (единственные — pre-existing CORS
    Cloudflare-beacon на `localhost`, не проявляются на production).

### Публикация

- Коммит: `feat(TASK_052): убрать карточку «Общий баланс» в шторке,
  сделать inline-блоком` — **`bc1b8ea`**. В коммит вошли только 9
  файлов задачи (`index.html`, `sw.js`, `tests/
  drawer_balance_inline.test.js`, `tests/drawer_redesign.test.js`,
  `tests/release_info.test.js`, TASK-файл, `docs/PROJECT_STATUS.md`,
  `docs/ROADMAP.md`, `CHANGELOG.md`); `.claude/launch.json`, удалённый
  `icon.svg`, `.DS_Store` не включены.
- Push в `origin/main`: `a7fc678..bc1b8ea`.
- Деплой: GitHub Actions «pages build and deployment» (run
  `35198195992`) — `completed`/`success` для `bc1b8ea`.
- **Production-проверка** (https://adar4026.github.io/finance/, браузер
  390×844, чистая сессия без локальных данных, HTTP-кэш сброшен): `sw.js`
  отдаёт `CACHE = 'finance-v184'`; единственный кэш `["finance-v184"]`
  (старый `finance-v183` вычищен); SW `activated` на scope `/finance/`;
  `getComputedStyle(#drawerBalance)` → `background-color:
  rgba(0,0,0,0)`, `border-style: none`, `box-shadow: none`,
  `border-radius: 0px` — карточка отсутствует; тап-зона `#fcEye` — 44×44
  px; 9 пунктов меню на месте; `#fcVal`/`#fcChg` корректно показывают
  `€0`/`€0 за месяц` на чистых данных (расчёт не сломан); footer
  `A-Lex Finance · v1.1.0` / `Обновлено: сентябрь 2026` не затронут;
  горизонтального overflow нет; консоль без ошибок.

### Известные ограничения

- Версия приложения (`AF.AppInfo.version`) не менялась — задача не
  требовала пользовательского обновления `app_info.js` (только CSS
  боковой шторки), поэтому изменение зафиксировано в `CHANGELOG.md` под
  `[Unreleased]`, а не как новый `[X.Y.Z]`-релиз; версия/дата релиза
  будут обновлены при следующем осознанном bump'е согласно политике из
  `AGENTS.md` (раздел 7).
- Реальная проверка на физическом iPhone не выполнялась.
