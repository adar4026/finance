# PROJECT_STATUS — A-Lex Finance

**Обновлено:** 2026-07-25

## Состояние приложения

`STABLE`

## Baseline

- Создан: [`docs/PROJECT_BASELINE.md`](PROJECT_BASELINE.md) (2026-07-25).
- Стабильный коммит **кода приложения**: `126943afd479d29d8e9fe6815c67c305f2b89739` (`126943a`).
  Подтверждено раздачей `sw.js` с `CACHE = 'finance-v138'` на
  https://adar4026.github.io/finance/.
- Опубликованная версия проверена напрямую (production `sw.js`).

## Последняя завершённая задача

- **Задача:** [`TASK_002_LIQUID_GLASS_TAB_INDICATOR`](tasks/TASK_002_LIQUID_GLASS_TAB_INDICATOR.md)
- **Статус:** `DONE`
- Ранее завершённая задача: [`TASK_001_HOME_NAVIGATION`](tasks/TASK_001_HOME_NAVIGATION.md) — `DONE`.

## Активная задача

Нет.

## Следующие этапы

1. `TASK_003_MAIN_FINANCE_CARD` — статус `PLANNED`.

Реализация `TASK_003` не начиналась и не будет начата без отдельного
TASK-файла.

## Изменение кода приложения после baseline

`TASK_002` добавила в нижнюю навигацию Liquid Glass индикатор активной
вкладки (только `index.html`, только `.nav`/`.nav-indicator`) поверх
baseline-коммита `126943a`. Раздел «Baseline» выше описывает состояние
**до** TASK-системы и не переписывается под каждую задачу (см.
[`AGENTS.md`](../AGENTS.md), п. 6) — актуальный HEAD-коммит с учётом
`TASK_002` фиксируется в самом
[`docs/tasks/TASK_002_LIQUID_GLASS_TAB_INDICATOR.md`](tasks/TASK_002_LIQUID_GLASS_TAB_INDICATOR.md).

---

**Важно:** документационные коммиты (включая фиксацию TASK-системы и
baseline) создаются отдельно от изменений кода приложения — за исключением
`feat(TASK_XXX)`-коммитов, которые по формату AGENTS.md намеренно включают
и код, и обновление собственного TASK-файла/CHANGELOG в одном коммите.
