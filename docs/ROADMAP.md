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
   в круглые кнопки с тонкой обводкой и SVG-шевроном (референс — круглая
   кнопка «Назад» iOS); поведение/обработчики не изменены. См.
   [`docs/tasks/TASK_005_MONTH_SWITCH_CIRCLE_ARROWS.md`](tasks/TASK_005_MONTH_SWITCH_CIRCLE_ARROWS.md).

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
