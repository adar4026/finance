# TASK_058 — Главная: WebGL-hero — единая шёлковая поверхность по финальной реализации LexCar

**Статус:** DONE (закоммичено; публикация — см. раздел Git)

## Контекст

`TASK_054` перенесла в Finance WebGL-фон hero из LexCar
(`LexCar/src/components/HeroCanvas.js`, коммит `8a6b74d`) 1-в-1: шейдер
`fold()`/`layer()` (три height-field «складки» одной непрерывной поверхности,
псевдонормаль, diffuse/specular/тень) + lifecycle. `TASK_055` заменила
шейдер на «отдельные шёлковые волны» (`waveShape()`/`relief()`: каждая
волна — отдельная форма с гребнем и впадиной, ползущая поперёк экрана).

Пользователь (2026-09-19): Hero должен быть «как финальная реализация
LexCar» — единая объёмная поверхность (жидкий шёлк/сатин), плавные
переливы света, мягкие углубления/выпуклости, очень медленное движение;
**без** заметных отдельных волн, полос, ribbons, резких границ; перенести
механику LexCar 1:1, адаптировав только цвета под Finance.

Проверка LexCar: `HeroCanvas.js` имеет единственный коммит `8a6b74d`,
рабочее дерево (`HEAD b2e5423`) идентично — это и есть финальная
реализация. Контейнер `.home-ambient` (`App.js:246-254`), CSS
`.hero-canvas` (`index.css:450-467`).

## Цель

Вернуть в `js/ui/hero_canvas.js` фрагментный шейдер LexCar (`fold` /
`layer`, три слоя, свет `L=(-0.45,0.75,0.55)`, specular `pow 12`, band,
нижний fade) **побайтно**, сохранив JS-обвязку `TASK_054` (она шире LexCar:
restore контекста, палитра из CSS-токенов с живым обновлением, накопление
времени без скачка). Палитру `--hero-gl-*` привести к фирменной
violet/lavender гамме Finance под этот шейдер.

## Границы работы

Разрешено:

- `js/ui/hero_canvas.js` — GLSL `FRAG` (возврат к LexCar), комментарии
  шапки, `FALLBACK_PALETTE`.
- `index.html` — только значения токенов `--hero-gl-*` (light/dark) и их
  комментарии.
- `sw.js` — cache version `finance-v189` → `finance-v190`.
- `tests/home_hero_webgl.test.js` — §5 (проверки шейдера): вместо проверок
  `waveShape/relief` — побайтное сравнение `FRAG` с LexCar (если репозиторий
  рядом) + структурные проверки `fold`/`layer`.
- Документация: этот TASK-файл; после подтверждения —
  `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `CHANGELOG.md`.

Запрещено:

- JS-обвязка модуля (`mount/destroy/start`, resize, RAF/throttle, IO/MO/RO,
  `visibilitychange`, context lost/restore, reduced-motion, fallback,
  `DPR_CAP`, `TARGET_FPS`, uniforms API).
- Разметка/CSS `.hero-canvas`, `.finance-ambient`, CSS-fallback TASK_047
  (blob'ы остаются fallback'ом и, как раньше, гасятся при активном canvas —
  конкурирующих эффектов нет), брендовые токены (`--accent`, `--hero-*`
  TASK_047), UI поверх фона, нижняя навигация, экраны, бизнес-логика,
  storage, маршрутизация.
- Новые зависимости, второй canvas/проход, CSS-имитация эффекта.
- `.claude/launch.json`, удалённый `icon.svg`, `.DS_Store`.
- Коммит/пуш до явного подтверждения пользователя.

## Требования

1. `FRAG` в `hero_canvas.js` побайтно равен `FRAG` в
   `LexCar/src/components/HeroCanvas.js` (`8a6b74d`); `VERT` и simplex
   noise — как были (уже совпадают).
2. Палитра — только через `--hero-gl-*`: базовый тёмный/светлый тон
   (`top`/`bot`), основной accent (`c1 = --accent`), lavender (`c2`),
   светлый highlight (`c3`), deep shadow-tone (`deep`); `alpha`/`light` —
   под характер «мягкие переливы без белых пятен».
3. Всё остальное (DPR cap, 30 fps, low-power, пауза hidden/вне viewport,
   restore, reduced motion, fallback, cleanup) — без изменений.
4. Никаких overflow/скачков layout: canvas по-прежнему
   `height:var(--hero-h)`, `pointer-events:none`.

## Критерии готовности

- Все `tests/*.test.js` — 0 failed.
- `node --check js/ui/hero_canvas.js`; в preview — шейдер собран
  (`AF.HeroCanvas.isActive() === true`), консоль без WebGL-ошибок.
- Preview 320/390/430 px, light/dark: `scrollWidth === clientWidth`,
  canvas ровно `--hero-h`, текст показателей читаем.
- Lifecycle: hidden → visible, экран «Ещё» и назад, context lost/restore,
  reduced motion — как в `TASK_054` (обвязка не менялась).

## План проверок

1. `for f in tests/*.test.js; do node "$f"; done`.
2. Preview `finance-local`, скриншоты 390 px light/dark, 320/430.
3. Через `javascript_tool`: `isActive()`, размеры canvas, overflow,
   `getShaderParameter` косвенно (класс `hero-canvas--on`), RAF-счётчик при
   `document.hidden` эмуляции, `WEBGL_lose_context`.

## Фактический результат

**Реализовано 2026-09-19, подтверждено пользователем 2026-09-20, закоммичено.**

### Изменённые файлы

- `js/ui/hero_canvas.js` — GLSL `FRAG` заменён на `FRAG` LexCar
  (`fold()`/`layer()`/`main()`, 3 546 символов) **побайтно**
  (`tpl(src,'FRAG') === tpl(lex,'FRAG')` — проверяется тестом); шапка
  модуля дополнена (TASK_058); `FALLBACK_PALETTE` приведён к новым
  токенам (`top` #dad3fa, `c3` #efebff, `alpha .46 .40 .48`,
  `light .45`). JS-обвязка (`mount/destroy/start`, resize, RAF, IO/MO/RO,
  restore, reduced-motion, fallback), `VERT`, simplex noise, uniforms API —
  без изменений.
- `index.html` — только значения токенов `--hero-gl-*`: light
  `top #c9bff9 → #d9d1fb`, `c3 #e9e3ff → #efebff`, `alpha .44 .40 .36 →
  .46 .40 .48` (как LexCar light), `light .62 → .45` (LexCar .75 — ниже,
  чтобы белая specular-кромка не давала пятен); dark `c3 #b8abf2 →
  #cfc6ff`, `alpha .34 .26 .16 → .34 .24 .16`, `light .30 → .22` (как
  LexCar dark). `c1 = --accent`, `c2` lavender/`--accent2`, `deep`,
  `bot = --hero-bottom` — прежние.
- `sw.js` — `finance-v189` → `finance-v190`.
- `tests/home_hero_webgl.test.js` — §5 переписана: структурные проверки
  `fold`/`layer` (дрейф `p − dir·t·0.05`, синусоида + шум, `e = 0.035`,
  свет `L = (-0.45, 0.75, 0.55)`, `pow 12`, band, тень → `u_deep`,
  `u_light`), три слоя с направлениями LexCar, нижний fade, отсутствие
  `waveShape/relief/rot/streak` в шейдере, uniforms API; при доступном
  `../LexCar` — побайтное сравнение `VERT` и `FRAG`. §7: fallback alpha.
- `tests/bottom_nav_glass_drag.test.js` — проверка cache version
  `=== v189` → `≥ v189` (иначе ломалась бы при каждом bump).
- Этот TASK-файл.

### Что перенесено из LexCar 1:1 и что отличается

- 1:1: `FRAG` целиком (геометрия одной непрерывной поверхности: три
  height-field складки `fold`, псевдонормаль через конечные разности,
  diffuse/specular/тень, band-маска, нижний fade), `VERT`, simplex noise,
  DPR cap 1.5, ~30 fps, `low-power`, один fullscreen triangle и один draw,
  пауза `document.hidden` / вне viewport, reduced-motion, context lost,
  синхронный первый кадр + fade-in 0.9 s, гашение CSS-fallback.
- Отличается только палитрой: 8 токенов `--hero-gl-*` (light/dark) —
  violet `--accent`, lavender, молочно-лавандовый highlight, deep purple,
  `alpha`/`light`.
- Расширения TASK_054 сверх LexCar сохранены (restore контекста, палитра
  из токенов с живым обновлением по `data-theme`, накопление времени
  шейдера без скачка после фона, resize с учётом DPR). Эвристика
  `isLowEndDevice()` LexCar по-прежнему не переносится (решение TASK_054).

### Проверки

- `tests/*.test.js` (35 файлов): **2788 passed, 0 failed** (в TASK_057 —
  2803: новая §5 короче прежних проверок «отдельных волн» TASK_055).
- `node --check js/ui/hero_canvas.js` — ok. Сборки в проекте нет.
- Preview `finance-local` (Chrome, Browser pane; SW/кэш прошлых сессий
  сброшены), `sw.js` отдаёт `finance-v190`:
  - шейдер собран: `AF.HeroCanvas.isActive() === true`, класс
    `hero-canvas--on`; в консоли нет предупреждений `HeroCanvas`/WebGL
    (единственные ошибки — CORS сторонней аналитики
    `cloudflareinsights`, к приложению/WebGL не относятся);
  - 320 / 390 / 430 px: `scrollWidth === clientWidth` у `html` и
    `#scrollArea`; canvas `clientHeight` = 460 = `--hero-h`, backing
    480×690 / 585×690 / 645×690 (DPR 2 → cap 1.5); desktop (колонка 560 px):
    canvas 560×460, backing 840×690, без overflow; `pointer-events:none`;
  - визуально (390 px, три кадра с интервалом 8 с, light + dark): единая
    поверхность с мягкими складками и переливами света, без отдельных
    гребней/полос/ribbons, без белых пятен; текст показателей читаем;
  - смена темы `toggleTheme()` → палитра обновилась на месте (light .45 ↔
    .22), контекст не пересоздаётся;
  - lifecycle (счётчик RAF за 600 мс, rAF эмулирован через setTimeout,
    т.к. Browser pane троттлит фоновый rAF до ~1/с): Главная 35 →
    `document.hidden` 0 → visible 35 → экран «Ещё» (слой `display:none`,
    IO) 0 → назад 35 (canvas 390×460 восстановлен) → два подряд
    visibilitychange 35 (один loop) → `destroy()` 0 (класс снят) →
    повторный `mount()` 35;
  - `WEBGL_lose_context.loseContext()` → `isActive() false`, класс снят,
    RAF 0 (виден CSS-fallback); `restoreContext()` → класс вернулся,
    RAF идёт, контекст живой;
  - `prefers-reduced-motion` (эмуляция `matchMedia` при `mount()`) →
    `mount() === false`, canvas прозрачен, CSS-blob'ы анимируются
    (`hero-drift-1`); обычный `mount()` → `true`, blob'ы
    `animation:none`.
- Не проверялось на реальном iPhone (нет устройства в сессии); параметры
  производительности — те же, что у LexCar и TASK_054.

### Известные ограничения

- CSS-fallback (blob'ы TASK_047) остаётся в голубой гамме `--hero-b1..4`
  (эти токены используются и в боковой шторке — перекраска вышла бы за
  границы задачи; решение TASK_054 сохранено). Виден только без WebGL /
  при reduced motion / при потере контекста.
- Semantic version приложения не менялась (`1.1.0`); изменение записано в
  `CHANGELOG.md` → `[Unreleased]`, как TASK_056/057.

### Git

- Реализация: `8ad605b` (`feat(TASK_058): restore LexCar final liquid-silk hero shader with Finance palette`).
- Документация: `docs(TASK_058): …`.
- Публикация: не выполнялась.
