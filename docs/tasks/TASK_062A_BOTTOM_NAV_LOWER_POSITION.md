# TASK_062A — Нижняя навигация: опустить капсулу ближе к краю

**Статус:** DONE (опубликовано)

## Контекст

Корректирующая задача к `TASK_062` (не занимает номер `TASK_063`). После
публикации v2.3.0 пользователь проверил на iPhone: капсула стоит высоко.
Причина — `bottom:max(6px,env(safe-area-inset-bottom))`: на iPhone с
home-indicator (safe area ≈34px) капсула поднята на всю safe area. В референсе
(и в нативном tab bar iOS 26) капсула заходит в safe area и стоит ≈20px от
нижнего края, над home-indicator.

## Цель

Опустить капсулу и кнопку «＋» на ≈14px внутрь safe area, не задевая
home-indicator.

## Границы работы

Разрешено: `bottom` у `.nav` и `.nav-add` (через общий токен `--nav-bottom`)
в `index.html`; `tests/bottom_nav_glass_drag.test.js`; версия/кэш; документация.

Запрещено: JS, разметка, вкладки, материал стекла, `.scroll-area` padding,
прочие экраны.

## Требования

1. `--nav-bottom: max(6px, calc(env(safe-area-inset-bottom) - 14px))` —
   iPhone с safe area 34px → 20px от края; без safe area — 6px, как раньше.
2. `.nav{bottom:var(--nav-bottom)}`; «＋» — `calc(var(--nav-bottom) + var(--navh) + 12px)`.
3. Резерв контента под панель не уменьшается (контент не перекрывается).

## Критерии готовности

Тесты 0 failed; превью 320/390 без регрессий; на эмуляции safe area 34px
капсула на 20px от края.

## Фактический результат

**Реализовано 2026-10-17.** Релиз v2.3.1, `sw.js` `finance-v195`.

- `index.html`: токен `--nav-bottom: max(6px, calc(env(safe-area-inset-bottom) - 14px))`;
  `.nav{bottom:var(--nav-bottom)}`, `.nav-add` — `calc(var(--nav-bottom) + var(--navh) + 12px)`.
- Тесты: все 41 файл, 0 failed (`bottom_nav_glass_drag` 194 проверки).
- Превью 390px с эмуляцией safe area 34px: капсула 20px от края (было 34),
  над нарисованным home-indicator, «＋» на 12px выше капсулы, overflow нет.
  Реальный iPhone — проверяет пользователь.
- Коммит реализации: `f546c67` — `feat(TASK_062A)`.

- Документация: `2337eea` — `docs(TASK_062A)`.

### Проверка production (2026-10-17)

- `sw.js` отдаёт `finance-v195`, `index.html` — 32 скрипта `?v=195` и
  `--nav-bottom`, `app_info.js` — `2.3.1`.
- Переход с установленной v2.3.0 (браузерное превью): первый заход ещё
  обслужил старый SW, параллельно установился `finance-v195`; после
  перезагрузки — один кэш `finance-v195`, `app_info.js?v=195`, v2.3.1;
  консоль без ошибок.
