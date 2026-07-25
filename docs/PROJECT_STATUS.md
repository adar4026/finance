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

- **Задача:** [`TASK_003_MAIN_FINANCE_CARD`](tasks/TASK_003_MAIN_FINANCE_CARD.md)
- **Статус:** `DONE`
- Ранее завершённые задачи: [`TASK_002_LIQUID_GLASS_TAB_INDICATOR`](tasks/TASK_002_LIQUID_GLASS_TAB_INDICATOR.md),
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
`finance-v139`. Раздел «Baseline» выше описывает состояние **до**
TASK-системы и не переписывается под каждую задачу (см.
[`AGENTS.md`](../AGENTS.md), п. 6) — подробности каждой задачи фиксируются в
её собственном TASK-файле
([`TASK_002`](tasks/TASK_002_LIQUID_GLASS_TAB_INDICATOR.md),
[`TASK_003`](tasks/TASK_003_MAIN_FINANCE_CARD.md)).

---

**Важно:** документационные коммиты (включая фиксацию TASK-системы и
baseline) создаются отдельно от изменений кода приложения — за исключением
`feat(TASK_XXX)`-коммитов, которые по формату AGENTS.md намеренно включают
и код, и обновление собственного TASK-файла/CHANGELOG в одном коммите.
