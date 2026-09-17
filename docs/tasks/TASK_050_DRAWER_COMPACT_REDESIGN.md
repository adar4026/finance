# TASK_050 — Боковая шторка: компактный премиальный редизайн (iOS / Apple Wallet)

**Статус:** DONE (опубликовано)

## Контекст

Боковая шторка (`#drawerOverlay`, TASK_017 «Premium Navigation Drawer»)
сейчас выглядит как отдельная тяжёлая страница: большая градиентная
карточка профиля (`.drawer-head` — фиолетово-голубой градиент, тень,
стекло), крупные разноцветные квадратные плитки под иконками пунктов
(`.dr-ic` с inline `--ic:#3b82f6/#34c759/#ff3b30/...` — «радуга»), плоский
серый фон `var(--home-bg)`, не совпадающий с immersive-фоном Главной
(TASK_047/048). По утверждённому визуальному направлению шторка должна
ощущаться частью приложения: компактно, премиально, спокойно, в стиле
iOS / Apple Wallet.

Уточнение по блоку «Общий баланс» (`#drawerBalance`, перенесён в шторку
в `TASK_049`): пользователь подтвердил — блок **остаётся** в шторке
(между профилем и «Планирование»), только переоформляется компактно в
новом стиле; `#fcVal`/`#fcChg`/`#fcEye`, `renderFinanceCard()`,
`updateFcEye()` не трогаются. Карточка «Общий капитал» со спарклайном
(старый вариант TASK_017) **не возвращается**.

## Цель

Редизайн **существующей** шторки (не новый экран, не изменение
архитектуры): компактная строка профиля вместо баннера, тонкие
графитовые line-icons вместо цветных плиток, общий мягкий фон как на
Главной, деликатное стекло, больше воздуха без лишней высоты, спокойный
центрированный footer. Вся функциональность, пункты, маршруты,
обработчики и данные сохраняются 1:1.

## Границы работы

Разрешено:

- `index.html` — только CSS-правила блока «Боковая выезжающая панель
  (drawer)» (`.drawer*`, `.dh-*`, `.dr-*`, `.drawer-balance` scoped-
  overrides) и разметка внутри `#drawerOverlay` (`<div class="drawer">`
  … `</div>`): визуальная структура, SVG-иконки, вспомогательные
  классы/атрибуты. JS-обработчики пунктов не меняются; допускается
  только косметическая привязка существующего обработчика `#drTheme`
  к новому элементу, если функция смены темы переезжает в header
  (при этом `#drTheme`/`#drThemeLbl` остаются в DOM и продолжают
  работать).
- `sw.js` — версия кэша.
- `tests/*.test.js` — обновление статических инвариантов, которые
  сверяют буквальную разметку шторки (`tests/home_balance_drawer.test.js`,
  `tests/profile_screen.test.js`, `tests/security_screen.test.js`), и
  новый тест инвариантов редизайна.
- Документация: этот TASK-файл, `docs/PROJECT_STATUS.md`,
  `docs/ROADMAP.md`, `CHANGELOG.md`.

Запрещено:

- Нижняя навигация (`.nav`, центральная `+`), операции, счета, бюджеты,
  аналитика, импорт/экспорт, IndexedDB/`AF.Store`, PWA-логика (`sw.js`
  кроме версии, `manifest.json`).
- Любая бизнес-логика: `openDrawer()`/`closeDrawer()` (кроме
  необходимого минимума для новой кнопки темы — см. выше),
  `renderFinanceCard()`, `updateFcEye()`, `toggleTheme()`,
  `themeLabel()`, `notifications()`, `renderReleaseInfo()`,
  `AF.AppInfo`, обработчики `#drCats/#drGoals/#drCalendar/#drRecur/
  #drHealth/#drStats/#drNotif/#drExport/#drMore`, `drGo()`.
- Маршруты и состав пунктов меню: все 10 пунктов и 3 группы
  («Планирование», «Аналитика», «Приложение») остаются с теми же id,
  подписями и порядком.
- Экран «Профиль» (`#profOverlay`, `.prof-*`) и «Безопасность»
  (`.secp-*`) — у них собственные классы, не зависят от `.drawer-*`.
- Глобальные токены `:root`/`[data-theme="dark"]` (не переопределять,
  только использовать); `.finance-ambient` Главной.
- Несвязанные изменения рабочего дерева: `.claude/launch.json`
  (изменён другой сессией), удалённый `icon.svg`, `.DS_Store` — в
  коммит не включать.
- Новые зависимости, новые разделы, новые маршруты, изменение
  структуры данных.

## Требования

1. **Панель.** Открытие/закрытие (backdrop, кнопка, Escape), Safe Area
   и ширина `86%`/`max-width:360px` сохраняются. Backdrop — текущий
   мягкий blur + затемнение/масштабирование `.app`/`.nav`. Фон самой
   шторки — тот же мягкий голубовато-лиловый переливающийся фон, что
   на Главной: через существующие токены immersive-сцены (`--hero-top`,
   `--hero-bottom`, `--hero-glow`, `--hero-b1…b4`), без хардкода; в
   тёмной теме — те же токены дают тёмную адаптацию. Деликатный
   glass-эффект (лёгкая полупрозрачность/blur) без тяжёлого стекла и
   избыточных теней. Крупные скругления панели (`0 28px 28px 0`)
   остаются; геометрия viewport, fixed-элементов и безопасных зон не
   меняется.
2. **Компактный профиль.** Градиентная карточка `.drawer-head` убирается.
   Вместо неё одна компактная строка: круглый аватар 48–52 px
   (`#drawerAvatar`), рядом имя `#drawerName` полужирным, ниже
   «Личный профиль» приглушённым, справа тонкий светло-серый chevron.
   Строка остаётся `<button id="drawerHead">` и ведёт в профиль
   (`closeDrawer();openProfile()` — обработчик не меняется). Без
   баннера, крупного градиента, большой тени и декоративного текста.
   Действие смены темы — небольшая круглая кнопка с иконкой солнца/луны
   справа в header: это **тот же** `#drTheme` (и `#drThemeLbl` — подпись
   состояния, визуально скрытая для a11y), переехавший из группы
   «Приложение»; обработчик `toggleTheme()` + обновление подписи и
   `openDrawer()` не меняются. Инвариант «4 пункта в группе
   „Приложение“» из `tests/profile_screen.test.js` (TASK_021)
   обновляется на 3 пункта / 2 разделителя.
3. **Общий баланс** (`#drawerBalance`) — остаётся на прежнем месте,
   переоформляется в спокойную полупрозрачную карточку в едином стиле с
   группами (тот же радиус/фон/hairline), без крупного акцента; разметка
   `#fcVal`/`#fcChg`/`#fcEye` и подпись «Общий баланс» не меняются.
4. **Списки.** Все 10 пунктов и 3 группы сохраняются с теми же id,
   подписями, порядком и обработчиками. Каждая группа — одна компактная
   полупрозрачно-белая карточка со скруглением 20–24 px; тонкие
   разделители, начинающиеся после области иконки; небольшие
   приглушённые uppercase-заголовки групп без огромного letter-spacing;
   высота строки 56–60 px; правые chevrons тонкие светло-серые
   (`var(--muted2)`). Бейдж уведомлений `#drNotifBadge` сохраняется и
   показывается только при реальном значении (логика `openDrawer()` уже
   это делает — не меняется).
5. **Иконки.** Единый набор тонких line-icons (SF/Lucide-style), одинаковый
   размер и `stroke-width`, графитовый цвет через токен (`var(--text)` с
   пониженной непрозрачностью или `var(--muted)`), без цветных плиток
   `--ic:*` за иконками. Цвет допустим только для бейджа/активного
   состояния/важного статуса.
6. **Нижняя часть.** Карточка «Общий капитал» не возвращается. Footer
   `#drawerRelease` (название + версия из `AF.AppInfo`) сохраняется:
   спокойный, центрированный, визуально второстепенный; pinned к низу
   при коротком контенте (`margin-top:auto`) и уходит в прокрутку на
   маленьких экранах. `renderReleaseInfo()` не меняется.
7. Без хардкода цветов там, где есть токены; без debug-кода, заглушек и
   console errors. Тёмная тема — через существующие токены.
8. `sw.js` `finance-v181` → `finance-v182`.

## Критерии готовности / план проверок

1. Все `tests/*.test.js` — 0 failed (обновлённые инварианты + новый
   тест `tests/drawer_redesign.test.js`).
2. Preview на 320 / 390 / 430 px, светлая и тёмная тема: компактный
   профиль, три группы с графитовыми иконками, баланс, footer; фон
   шторки совпадает по палитре с Главной.
3. Открытие по аватару, закрытие по backdrop/пункту/Escape, Safe Area,
   скролл внутри шторки, отсутствие горизонтального overflow и layout
   shift основного экрана.
4. Переход по каждому из 10 пунктов и возврат назад; профиль по строке
   header; смена темы (кнопка в header и пункт `#drTheme`) — оба
   переключают через `toggleTheme()` и синхронно обновляют подпись;
   бейдж уведомлений при наличии уведомлений; `#fcEye` в шторке.
5. PWA: `manifest.json` не изменён, `sw.js` регистрируется, после
   обновления остаётся единственный кэш `finance-v182`, offline-раздача
   `index.html` из кэша.
6. Документация обновлена; чистый commit только файлов задачи; push в
   `main`; деплой GitHub Pages `success`; production отдаёт `finance-v182`.

## Результат

### Что реализовано

- **Панель (`.drawer`).** Плоский `var(--home-bg)` заменён сценой Главной
  на токенах TASK_047: белое свечение `--hero-glow` сверху, вертикальный
  переход `--hero-top` → `--hero-bottom`, статичные пятна `--hero-b2`/
  `--hero-b3` внизу и два мягко дрейфующих blob'а (`.drawer::before`/
  `::after` на `--hero-b1`/`--hero-b4`, локальный `@keyframes drawerDrift`,
  compositor-only `transform`, отключается в `prefers-reduced-motion`).
  Тень панели — `var(--nav-shadow)` вместо тяжёлой хардкод-тени.
  Ширина `86%`/`max-width:360px`, скругления `0 28px 28px 0`, backdrop
  (`.overlay.drawer-ov` blur + затемнение, `body.drawer-open` blur/scale
  основного экрана), `drawerSlide` — без изменений. `.drawer-scroll`
  получил `position:relative;z-index:1` (над blob'ами) и
  `overflow-x:hidden`.
- **Компактный профиль.** Градиентная карточка `.drawer-head` (градиент
  `#a79cf7→#8fb0f6→#8fdde3`, тень, стекло, `padding:18px`) заменена
  строкой `.drawer-top` → `<button class="drawer-head" id="drawerHead">`
  без фона: аватар 50 px (`#drawerAvatar`, тонкое кольцо
  `--hero-glass-border`), `#drawerName` 17px/700, «Личный профиль» 13px
  `--muted`, тонкий chevron `--muted2`. Обработчик
  `closeDrawer();openProfile()` не менялся.
- **Кнопка темы в header.** `#drTheme` переехал из группы «Приложение» в
  `.drawer-top` круглой стеклянной кнопкой `.dh-theme` 38 px с иконками
  солнца/луны (видимая иконка следует за фактической темой через
  `[data-theme="dark"]` — CSS, без JS). `#drThemeLbl` сохранён внутри
  кнопки визуально скрытым (`.dh-theme-lbl`), поэтому `openDrawer()` и
  обработчик `#drTheme` (`toggleTheme()` + подпись) работают без правок;
  цикл light → dark → system сохранён.
- **Общий баланс (`#drawerBalance`).** Остался между профилем и
  «Планирование» (по решению пользователя); `var(--card)` + хардкод-тень
  заменены той же стеклянной карточкой, что у групп (`--hero-glass`,
  `--hero-glass-border`, `--tx-card-shadow`, радиус 22px), выравнивание
  влево, метка uppercase `--muted`, сумма 26px/700. Разметка
  `#fcVal`/`#fcChg`/`#fcEye` и `renderFinanceCard()`/`updateFcEye()` не
  тронуты.
- **Группы и строки.** Три группы (Планирование / Аналитика /
  Приложение) с теми же 9 пунктами (10-й — тема — в header), id,
  подписями, порядком и обработчиками. `.drawer-card`: стекло
  `--hero-glass` + `--hero-glass-border`, радиус 22px, `--tx-card-shadow`,
  `backdrop-filter:blur(14px)`. `.drawer-row`: `min-height:56px`,
  `padding:8px 16px`, `gap:14px`, 16.5px/600. Заголовки групп 12px/600
  `--muted`, `letter-spacing:.03em`. Разделители `--hero-sep` (opacity
  .45) с `margin-left:60px` (после области иконки) — отдельный
  dark-override больше не нужен. Chevrons `--muted2`, `stroke-width:1.8`.
  Бейдж `#drNotifBadge` — единственный цветной элемент (`--expense`),
  логика показа в `openDrawer()` не менялась.
- **Иконки.** Все 9 пунктов — единый набор Lucide-style line-icons
  (viewBox 24, 22px, `stroke-width:1.8`, `stroke:currentColor`, цвет
  `var(--text)` c `opacity:.78` — графит в светлой, светлый в тёмной),
  цветные плитки `.dr-ic{background:var(--ic)}` и inline `--ic:#…` убраны;
  `fill="#fff"` в иконке темы больше нет.
- **Footer.** `#drawerRelease` — одна центрированная строка
  «A-Lex Finance · Version 1.0.0» 11.5px `--muted2` (через CSS
  `display:inline` + `::before` разделитель; `renderReleaseInfo()` не
  менялся), `margin-top:auto` — pinned к низу при коротком контенте,
  уходит в прокрутку на маленьких экранах, `safe-area-inset-bottom`
  сохранён.
- **Узкие экраны.** `@media (max-width:359px)`: аватар 46px, кнопка темы
  36px, боковые отступы 12px, строки 15px с `gap:10px`, иконки 21px —
  чтобы «Регулярные платежи» и «Финансовое здоровье» не обрезались на
  320 px.
- `sw.js`: `finance-v181` → `finance-v182`.
- **Тесты.** Новый `tests/drawer_redesign.test.js` (81 проверка: строка
  профиля и отсутствие баннера, кнопка темы/`#drThemeLbl`/CSS-переключение
  иконки, неизменность обработчиков всех пунктов и `openDrawer()`/
  `closeDrawer()`/`renderReleaseInfo()`, 3 группы / 9 пунктов / 6
  разделителей в прежнем порядке, отсутствие `--ic:`/`fill="#`, единый
  `.dr-ic`, фон/стекло/разделители на токенах, отсутствие hex/rgba в CSS
  шторки (кроме `#fff` бейджа и pre-existing backdrop), баланс на месте,
  footer, safe area, media-query 359px, версия кэша).
  `tests/profile_screen.test.js`: инвариант группы «Приложение» 4/3 →
  3/2 с пояснением.

### Изменённые файлы

- `index.html` — CSS-блок шторки (`.drawer*`, `.dh-*`, `.dr-*`,
  `@keyframes drawerDrift`, media 359px), scoped-overrides
  `.drawer-balance`, разметка `#drawerOverlay`.
- `sw.js` — версия кэша.
- `tests/drawer_redesign.test.js` — новый.
- `tests/profile_screen.test.js` — обновлён инвариант группы «Приложение».
- `docs/tasks/TASK_050_DRAWER_COMPACT_REDESIGN.md`,
  `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `CHANGELOG.md`.

### Проверки

- **Тесты:** все `tests/*.test.js` — **2260 passed, 0 failed** (было
  2179: 2179 без регрессий + 81 новых).
- **Preview** (локальный сервер `finance-local`, порт 8912, демо-данные
  `loadDemo()`; скриншоты — headless Chrome в чистом временном профиле
  `--user-data-dir=mkdtemp` + `--use-mock-keychain` +
  `--password-store=basic`, без основного профиля/Keychain):
  - 390×844 light/dark, 430×932 dark, 320×568 light — компактная строка
    профиля с кнопкой темы, баланс, три стеклянные группы с графитовыми
    иконками, footer; фон шторки — та же голубая сцена, что на Главной,
    в тёмной теме — тёмная адаптация через те же токены.
  - 430×932: контент помещается (`scrollHeight == clientHeight`),
    footer pinned к низу. 390×844: контент 851 px — footer уходит на
    7 px в прокрутку (на реальном iPhone c safe-area он в прокрутке в
    любом случае). 320×568: прокрутка, все подписи без обрезки
    (`scrollWidth == clientWidth` у каждой `.dr-lbl`).
  - Горизонтальный overflow отсутствует (`document.documentElement.
    scrollWidth == innerWidth`, `.drawer-scroll` scrollWidth == clientWidth
    на всех трёх ширинах); layout shift `.topbar`/`.nav` после
    открытия/закрытия — нет (`getBoundingClientRect` идентичен).
  - Функционально (JS-прогон в preview): каждый из 9 пунктов открывает
    свой экран/overlay и закрывает шторку (`#drCats`→`#catMgrOverlay`,
    `#drGoals`→`#goalsOverlay`, `#drCalendar`→`#calOverlay`,
    `#drRecur`→`#recurOverlay`, `#drHealth`→`#healthOverlay`,
    `#drStats`→`#statsOverlay`, `#drNotif`→`#notifOverlay`,
    `#drExport`→`#exportOverlay`, `#drMore`→`#scrMore`), возврат назад —
    ок; `#drawerHead` → `#profOverlay`; кнопка темы в header: light →
    dark → system → light, `data-theme` и `#drThemeLbl` («Светлая тема»/
    «Тёмная тема»/«Системная тема») синхронны, шторка остаётся открытой;
    `#fcEye`: `€4 130` → `€∗∗∗∗` → `€4 130`; бейдж «3» при 3
    уведомлениях (`display:flex`), скрыт при 0; backdrop-клик и Escape
    закрывают шторку и снимают `body.drawer-open`.
  - PWA (localhost): SW `activated` на верном scope, после перезагрузки
    единственный кэш `["finance-v182"]` (старый вычищен), `index.html` в
    кэше (46 записей — offline-раздача network-first с fallback),
    `manifest.json` не менялся (`display: standalone`).
  - Консоль: ошибок приложения нет. Единственные ошибки на localhost —
    CORS-запросы pre-existing Cloudflare-beacon (`static.cloudflareinsights.
    com`, строка ~7443 `index.html`), не связаны с задачей и не
    воспроизводятся на production-домене.

### Публикация

- Коммит реализации: `feat(TASK_050): компактный премиальный редизайн
  боковой шторки` — **`964a3fd`**. В коммит вошли только 8 файлов задачи
  (`index.html`, `sw.js`, `tests/drawer_redesign.test.js`,
  `tests/profile_screen.test.js`, TASK-файл, `docs/PROJECT_STATUS.md`,
  `docs/ROADMAP.md`, `CHANGELOG.md`); посторонние изменения рабочего
  дерева (`.claude/launch.json`, удалённый `icon.svg`, `.DS_Store`) не
  включены.
- Push в `origin/main`: `83a1b01..964a3fd`.
- Деплой: GitHub Actions «pages build and deployment» (run
  `35194813002`) — `completed`/`success` для `964a3fd`. Production
  https://adar4026.github.io/finance/ отдаёт `sw.js` с
  `CACHE = 'finance-v182'`.
- **Production-проверка** (браузер, 390×844, чистая сессия без локальных
  данных): шторка в новом виде — компактная строка профиля без фона
  (`background-image: none` у `#drawerHead`), кнопка темы в header,
  9 строк меню с прозрачными `.dr-ic` (без плиток), стеклянные группы,
  «Общий баланс» `€0`, footer «A-Lex Finance · Version 1.0.0»; бейдж
  уведомлений скрыт при 0; цикл темы light → dark → system → light;
  SW `activated` на scope `/finance/`, после перезагрузки единственный
  кэш `["finance-v182"]` (старый `finance-v181` вычищен); консоль без
  ошибок; горизонтального overflow нет.

### Известные ограничения

- Реальная проверка на физическом iPhone (Safari standalone PWA) не
  выполнялась — только эмуляция viewport/`prefers-color-scheme` и
  проверка SW/manifest в браузере.
- Смена темы теперь без текстовой подписи в списке: состояние видно по
  иконке (солнце/луна — фактическая тема), «Системная тема» — только в
  скрытой a11y-подписи/`aria`.
