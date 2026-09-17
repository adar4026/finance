# TASK_054 — Главная: WebGL-фон hero «жидкая ткань» (перенос из Lexcar)

**Статус:** DONE (опубликовано)

## Контекст

В проекте Lexcar (`/Users/MacPro/Projects/LexCar`, коммит `8a6b74d`
«Home hero: experimental WebGL liquid-fabric background with CSS fallback»)
реализован и проверен на iPhone WebGL-фон hero: один `<canvas>`, fragment
shader с тремя height-field «складками» (2D simplex noise + синусоидальный
displacement), pseudo-normal через конечные разности, diffuse + specular
(светлая кромка) + мягкая тень к глубокому цвету, DPR ≤ 1.5, ~30 fps,
`low-power` context, пауза при `document.hidden`/вне viewport,
`prefers-reduced-motion`, fallback на CSS, защита от потери контекста,
плавный fade-in canvas. Референс: `LexCar/src/components/HeroCanvas.js`
(316 строк) + `LexCar/src/index.css` (`.hero-canvas`).

В A-Lex Finance hero Главной (`TASK_047`/`TASK_048`) рисует общий слой
`.finance-ambient#financeAmbient` (первый ребёнок `.app`, `position:absolute;
inset:0`, `display:block` только при активном `.screen.immersive`), внутри —
4 `.ambient-blob` (radial-gradient, compositor-only transform-анимация) и
`.ambient-fade` (переход к `--hero-bottom` в пределах `--hero-h:460px`).
Приложение — чистые HTML/CSS/JS без React и без сборки.

## Цель

Перенести в Finance технически тот же WebGL-подход, что в Lexcar (не
«похожий», а тот же шейдер/математика/lifecycle), заменив только:

- палитру — фирменная violet / purple / lavender гамма Finance
  (`--accent`, `--accent2`, `--cap-grad`), а не teal/ice Lexcar;
- интеграцию — в существующий слой `.finance-ambient` Finance без React
  (IIFE-модуль `AF.HeroCanvas`), с палитрой из CSS-токенов темы и живым
  обновлением при смене `data-theme`.

## Границы работы

Разрешено:

- Новый файл `js/ui/hero_canvas.js` — модуль `AF.HeroCanvas` (WebGL
  renderer, lifecycle, чтение палитры из токенов).
- `index.html`: новые токены `--hero-gl-*` (light/dark), CSS `.hero-canvas`
  (+ гашение CSS-blob/fade при активном canvas), `<canvas>` первым ребёнком
  `.finance-ambient`, `<script src="js/ui/hero_canvas.js">`, один вызов
  `AF.HeroCanvas.mount(...)` в блоке «Старт».
- `sw.js` — новый asset в `ASSETS`, cache version `finance-v185` →
  `finance-v186`.
- Новый тест `tests/home_hero_webgl.test.js`.
- Документация: этот TASK-файл; после подтверждения —
  `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `CHANGELOG.md`.

Запрещено:

- Анимировать/сдвигать UI поверх фона: header, поиск, переключатели периода,
  month-switch, показатели, шкалу, карточки записей — никаких
  parallax/transform.
- Менять структуру hero/Главной, существующие брендовые токены
  (`--accent`, `--hero-*` TASK_047), CSS-fallback (blob'ы/fade остаются как
  есть и показываются, когда WebGL не активен).
- Внешние WebGL-библиотеки, новые зависимости, сборка.
- Жёсткий отказ от WebGL по `navigator.deviceMemory` /
  `hardwareConcurrency` (в Lexcar есть — в Finance намеренно не переносится,
  см. постановку п. 14).
- `.claude/launch.json`, удалённый `icon.svg`, `.DS_Store` и любые
  несвязанные изменения рабочего дерева.
- Коммит/пуш до явного подтверждения пользователя.

## Требования

1. Один WebGL `<canvas>` (`#heroCanvas`), fullscreen triangle, fragment
   shader Lexcar 1-в-1 (simplex noise, `fold()`, `layer()` с finite
   differences, diffuse/specular/deep shadow, три слоя с собственными
   `dir`/`seed`/`alpha`, нижний fade `smoothstep(0.58, 1.0, uv.y)`).
2. Canvas — `position:absolute; top:0; left:0; width:100%;
   height:var(--hero-h)`; покрывает только hero, `pointer-events:none`,
   за UI (z-index слоя `.finance-ambient` = 0), не создаёт overflow.
3. Палитра — из CSS-токенов `--hero-gl-top/bot/c1/c2/c3/deep/alpha/light`
   (light + dark), читается `getComputedStyle` и передаётся в uniforms;
   при смене `data-theme` (MutationObserver) — uniforms обновляются без
   перезагрузки и без пересоздания контекста.
4. DPR cap 1.5, ~30 fps throttle, `powerPreference:'low-power'`, один draw
   на кадр, без аллокаций в кадре, без чтения layout в кадре; resize только
   при реальном изменении CSS-размера или DPR (`ResizeObserver`).
5. Пауза RAF при `document.hidden` и когда hero вне viewport
   (`IntersectionObserver`); при возврате — продолжение без второго loop
   и без скачка времени (время шейдера накапливается только по
   отрисованным кадрам, delta clamp).
6. `prefers-reduced-motion: reduce` — WebGL не запускается (и
   останавливается при изменении media query на лету); остаётся
   CSS-fallback.
7. `webglcontextlost` → `preventDefault`, стоп loop, снятие класса
   `hero-canvas--on` (CSS-fallback снова виден); `webglcontextrestored` →
   реинициализация программы/буфера/uniforms и продолжение. Пустой/чёрный
   canvas не показывается никогда (canvas прозрачен до первого кадра).
8. Fallback: нет WebGL / shader compile-link failure / runtime exception /
   reduced motion / context lost → canvas остаётся `opacity:0`, CSS-фон
   Finance (TASK_047) продолжает работать без изменений.
9. При успешном старте: первый кадр синхронно, затем класс
   `hero-canvas--on` → fade-in 0.9s; CSS-blob'ы и `.ambient-fade` гаснут
   тем же 0.9s и уходят из композитинга (`visibility:hidden`, `animation:
   none`).
10. Cleanup (`AF.HeroCanvas.destroy()`): cancel RAF, disconnect IO/RO/MO,
    remove listeners, delete program/buffer/shaders; `loseContext()`
    намеренно не вызывается (подход Lexcar).

## Критерии готовности

- Все `tests/*.test.js` — 0 failed (включая новый).
- Preview 320/375/390/430 px, light/dark: `scrollWidth === clientWidth`,
  canvas ровно `--hero-h` высотой, UI не сдвинут, текст читаем.
- Смена темы обновляет палитру без перезагрузки; scrolling; hero вне/в
  viewport; `document.hidden`; context loss (`WEBGL_lose_context`);
  reduced motion; fallback без WebGL.
- Прирост JS измерен и указан.

## План проверок

1. `for f in tests/*.test.js; do node "$f"; done` — итог passed/failed.
2. Preview `finance-local` (python http.server): скрин на 390 px, замеры
   overflow/размеров canvas, консоль без ошибок.
3. Симуляция: `WEBGL_lose_context.loseContext()/restoreContext()`,
   `matchMedia` reduced-motion (эмуляция), переключение темы через
   `toggleTheme()`, переход на не-immersive экран и обратно.

## Фактический результат

**Реализовано 2026-09-17, подтверждено пользователем, закоммичено и
опубликовано.**

### Изменённые файлы

- `js/ui/hero_canvas.js` — **новый**, 17 382 байт (6 576 gzip), без
  зависимостей и `import`/`require`. Модуль `AF.HeroCanvas`
  (`mount(canvas)`, `destroy()`, `isActive()`, `readPalette()`); VERT/FRAG
  шейдеры — побайтно (без комментариев) те же, что в
  `LexCar/src/components/HeroCanvas.js` (проверяется тестом).
- `index.html` (+37 строк): токены `--hero-gl-*` в `:root` и
  `[data-theme="dark"]`; CSS `.hero-canvas` / `.hero-canvas--on` /
  гашение `~ .ambient-blob, ~ .ambient-fade`; `<canvas id="heroCanvas">`
  первым ребёнком `.finance-ambient`; `<script src="js/ui/hero_canvas.js">`;
  `AF.HeroCanvas.mount($('#heroCanvas'))` в блоке «Старт».
- `sw.js` — `finance-v185` → `finance-v186`, `./js/ui/hero_canvas.js` в
  `ASSETS`.
- `tests/home_hero_webgl.test.js` — **новый**, 99 проверок.
- `tests/home_hero_screen.test.js` — одно утверждение TASK_047
  («без видео/WebGL/JS-цикла») скорректировано: WebGL теперь осознанно
  допущен в отдельном модуле; запрет на `<video>` и inline-loop в
  `index.html` сохранён.

### Отличия от Lexcar (намеренные)

- Без React: IIFE-модуль, cleanup — `destroy()`; StrictMode-проблема
  неактуальна, но подход «не вызывать `loseContext()`» сохранён — повторный
  `mount()` на том же canvas/контексте проверен (reduced-motion off).
- Палитра — не константы в JS, а CSS-токены темы (`--hero-gl-c1:
  var(--accent)`, `--hero-gl-bot: var(--hero-bottom)` и т.д.), читаются
  `getComputedStyle`; `MutationObserver` на `data-theme` обновляет uniforms
  без пересоздания контекста и без перезагрузки.
- Убрана эвристика `isLowEndDevice()` (`deviceMemory`/`hardwareConcurrency`)
  по постановке п. 14 — критерий только успешное создание контекста и сборка
  шейдера.
- Время шейдера накапливается по отрисованным кадрам с clamp delta
  (`min(dt, 3·frame)`) — после `document.hidden`/фона ткань продолжает с
  того же места (в Lexcar `t = now - start`, возможен скачок формы).
- `webglcontextrestored` — реинициализация программы/буфера/uniforms и
  продолжение с того же `t` (в Lexcar restore не обрабатывается).
- `resize()` учитывает и DPR (перенос окна между дисплеями), пропускает
  `display:none` (0×0) состояние слоя на не-immersive экранах.
- Canvas — `height:var(--hero-h)`, не `inset:0`; сам слой
  `.finance-ambient` (fixed за контентом, `inset:0` в `.app`) не менялся —
  это архитектура TASK_047, контент прокручивается поверх, как и раньше с
  CSS-blob'ами. Слой общий для Главной/Аналитики/Счетов/Бюджетов
  (TASK_048) — WebGL-фон, как и blob'ы, виден на всех четырёх.

### Shader layers / palette / performance

| Слой | dir | seed | tint | alpha (light / dark) |
|---|---|---|---|---|
| 1 primary fold | (1.0, −0.35) | 0 | `--hero-gl-c1` = `--accent` #6d5df6 | .46 / .34 |
| 2 secondary fold | (−0.85, 0.30) | 1 | `--hero-gl-c2` #b5abf9 / `--accent2` | .40 / .24 |
| 3 highlight | (0.55, 0.85) | 2 | `--hero-gl-c3` #f4f1ff / #cfc6ff | .52 / .16 |

- base: `--hero-gl-top` #e6e1fb / #161331 → `--hero-gl-bot` =
  `--hero-bottom`; deep/shadow `--hero-gl-deep` #4a3ac0 / #1c1646;
  specular `--hero-gl-light` .75 / .22; нижний fade `smoothstep(.58, 1)`.
- DPR cap 1.5 (390 px → 585×690 backing при DPR 2), throttle 30 fps
  (замер: ~25 draw/с при 120 Гц RAF — каждый 5-й кадр), `low-power`, один
  fullscreen triangle, один `drawArrays` на кадр, без аллокаций/layout в
  кадре.

### Проверки

- `tests/*.test.js` (34 файла): **2578 passed, 0 failed** (было 2478).
- `node --check js/ui/hero_canvas.js` — ok. Сборки в проекте нет.
- Preview `finance-local` (Chrome, Browser pane), light + dark:
  - 320 / 375 / 390 / 430 px: `scrollWidth === clientWidth` у `html`,
    `.app`, `#scrollArea`; canvas `clientHeight` = 460 = `--hero-h`,
    backing 480×690 / 563×690 / 585×690 / 645×690; UI не сдвинут; текст
    показателей читаем во всех фазах (нижний fade к `--hero-bottom`).
  - Первый кадр синхронный → `hero-canvas--on` → fade-in 0.9s; blob'ы и
    `.ambient-fade` → `visibility:hidden`, без flash.
  - Смена темы `toggleTheme()` → палитра обновилась на месте.
  - Прокрутка: слой fixed за контентом, `.topbar.scrolled` стекло — как в
    TASK_047.
  - Lifecycle (счётчик RAF за 700 мс): Главная 85 → экран «Ещё»
    (`display:none`, IO) 0 → назад 84 (один loop, размер восстановлен) →
    `document.hidden=true` 0 → visible 85.
  - `WEBGL_lose_context.loseContext()` → класс снят, RAF 0, виден CSS-
    fallback; `restoreContext()` → класс вернулся, RAF 84, контекст живой.
  - `getContext → null` (WebGL недоступен) → `mount()` = false, класс не
    ставится; `prefers-reduced-motion: reduce` → `mount()` = false, контекст
    не запрашивается; повторный `mount()` → активен.
- Не проверялось на реальном iPhone (нет устройства в сессии) —
  параметры производительности те же, что проверены в Lexcar.

### Известные ограничения

- CSS-fallback (TASK_047) остаётся голубым/cyan: при кроссфейде 0.9s на
  старте цвет плавно переходит из голубого в фиолетовый; в fallback-режиме
  (нет WebGL / reduced motion) пользователь видит прежний голубой hero.
  Перекраска fallback в violet — отдельное решение, не в этой задаче.
- Старый Service Worker на localhost отдавал закэшированный
  `finance_card_service.js` без `ratio()` (артефакт прошлых сессий preview,
  не кода) — устранено сбросом SW/кэша; на production неактуально благодаря
  cache version.

### Git

- Реализация: `98f26ed` (`feat(TASK_054): …`), `37a2392..98f26ed`.
- Документация: следующий коммит `docs(TASK_054): …`.
- Публикация: push в `main` (GitHub Pages); production проверка —
  `sw.js` отдаёт `finance-v186` (см. ниже).
