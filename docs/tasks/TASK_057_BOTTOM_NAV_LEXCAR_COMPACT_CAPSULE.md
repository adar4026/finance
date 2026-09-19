# TASK_057 — Нижняя навигация: компактная капсула 64px и материал по финальной системе LexCar

**Статус:** DONE (опубликовано)

## Контекст

`TASK_056` перенесла подход LexCar по состоянию на коммит `57fe0df` (drag
pill, живое стекло). После него LexCar дорабатывался ещё двумя коммитами,
которые пользователь считает финальной системой:

- `e387441` — усиленная активная вкладка (заливка pill 0.18 / dark 0.30,
  более глубокий акцент, ярче контур/свечение, подпись 700, штрих иконки
  2.4); capture только при старте drag (в Finance уже так).
- `b2e5423` — компактная капсула: высота 76 → **64px** (pill 48px),
  подписи 11px/600 у всех вкладок (активная 700), зазор иконка–подпись 3px,
  чуть темнее неактивный цвет в light.

Плюс материал финального LexCar: капсула `border-radius:32px` (при 64px —
полностью скруглённые торцы), pill `border-radius:999px`, почти прозрачное
стекло (light: заливка `.03`, blur `2px`, saturate 130%, заметный тонкий
контур `rgba(25,25,35,.42)`; dark: `rgba(30,30,36,.42)`, blur 16px).

Пользователь: «сделай тачбар как на LexCar — уже и более закруглённые края;
и нижнюю вкладку тоже».

## Цель

Привести капсулу, pill, подписи/иконки и кнопку «＋» к финальной системе
LexCar на палитре Finance (синий акцент навигации), не меняя механику
drag/blika `TASK_056`.

## Границы работы

Разрешено: токены `--nav-*` и `--navh` в `index.html`; CSS-блок нижней
навигации (`.nav`, `.nav button`, `.nav-indicator`, `.nav-add`); `sw.js`
cache version; `tests/bottom_nav_glass_drag.test.js` (ожидания значений);
документация.

Запрещено: JS `navDrag` / `moveNavIndicator` / `showScreen`, разметка
вкладок, экраны, цвета LexCar (фиолетовый акцент), `--nav-glass-*`
(`.periods-indicator`), safe-area-логика `bottom`.

## Требования

1. `--navh: 64px`; `.nav{border-radius:32px;padding:7px}` → pill 48px,
   `border-radius:999px`.
2. Стекло: light `--nav-bg: rgba(255,255,255,.03)`, `--nav-border:
   rgba(22,24,31,.42)`, `--nav-blur: 2px`, `--nav-saturate: 130%`;
   dark `rgba(30,30,36,.42)` / `rgba(255,255,255,.16)` / 16px / 150%.
3. Pill: заливка на акценте `.18` (dark `.30`), `--nav-pill-border`
   (`rgba(255,255,255,.36)` / `.18`), `--nav-pill-shadow` (inset блик +
   мягкое синее свечение).
4. Вкладки: подписи 11px/600, активная 700; иконка 22px, активная
   `stroke-width:2.4`; gap 3px; неактивный цвет `--nav-muted`
   (light `#4f5a68`, dark `--muted`); активный `--nav-active`
   (light `--nav-blue2` — глубже на прозрачном стекле, dark `--nav-blue`);
   ≤340px — подпись 10px.
5. «＋» — тот же материал/контур, что капсула; `bottom` следует `--navh`.
6. Всё остальное (`.scroll-area` padding, safe area, drag, live-эффекты,
   reduced motion, fallback) — без изменений по логике.

## Критерии готовности

- Тесты 0 failed; preview 320/375/390/430, light/dark: подписи не
  обрезаны, overflow нет, tap/drag работают; консоль без ошибок.

## Фактический результат

**Реализовано 2026-09-19.** Тесты: **2803 passed, 0 failed** (было 2782;
`tests/bottom_nav_glass_drag.test.js` 172 → 193 проверок). Коммит
реализации: `ad572fb` — `feat(TASK_057)`.

### Изменения

- `index.html`:
  - `--navh: 76px → 64px`; `.nav{border-radius:32px}` (при 64px — полностью
    скруглённые торцы), pill `border-radius:999px` (48px).
  - Токены light: `--nav-bg rgba(255,255,255,.03)`, `--nav-border
    rgba(22,24,31,.42)`, `--nav-highlight .10`, `--nav-blur 2px`,
    `--nav-saturate 130%`; новые `--nav-muted #4f5a68`, `--nav-active
    var(--nav-blue2)`, `--nav-pill-bg rgba(79,125,240,.18)`,
    `--nav-pill-border rgba(255,255,255,.36)`, `--nav-pill-shadow inset 0 1px 0
    rgba(255,255,255,.30), 0 3px 12px rgba(79,125,240,.14)`; «＋»:
    `--nav-add-bg .10`, `--nav-add-border .42`.
  - Токены dark: `--nav-bg rgba(30,30,36,.42)`, `--nav-border .16`, blur 16px,
    `--nav-muted var(--muted)`, `--nav-active var(--nav-blue)`, pill
    `rgba(91,139,255,.30)` / border `.18` / shadow `inset .16, 0 3px 12px
    rgba(91,139,255,.20)`; «＋» — как капсула.
  - `.nav button`: `color:var(--nav-muted)`, `gap:3px`, `font-size:11px;
    font-weight:600; letter-spacing:0`, `border-radius:999px`, иконка 22px;
    `.on .lb{font-weight:700}`, `.on .ic svg{stroke-width:2.4}`; активная/
    preview/focus — `--nav-active`. `@media (max-width:340px)` — `left/right
    12px`, подпись 9.5px, padding 1px («Аналитика» на 320px без обрезки).
  - `.nav-indicator`: `border:var(--nav-pill-border)`, `box-shadow:
    var(--nav-pill-shadow)` (вместо `--nav-glass-*` TASK_002, которые остаются
    у `.periods-indicator`).
- `sw.js` — `finance-v188` → `finance-v189`.
- `tests/bottom_nav_glass_drag.test.js` — ожидания токенов/радиусов/
  типографики обновлены под TASK_057 (+21 проверка).
- JS (`navDrag`, `moveNavIndicator`, `showScreen`), разметка, экраны,
  `.scroll-area` padding (следует `--navh` автоматически: 90px при 0 safe
  area), safe-area-логика — не менялись.

### Проверки

- `node tests/*.test.js` — 2803 passed, 0 failed.
- Preview 320/375/390/430 (light), 320 и 390 dark: капсула 64px, radius
  32px, pill 48px; подписи без обрезки на всех ширинах (320: 9.5px), overflow
  нет; «＋» на 12px выше капсулы; сквозь капсулу видны карточки и текст
  (near-clear стекло LexCar); drag Главная→Счета и tap «Записи» работают;
  новых ошибок консоли нет.
