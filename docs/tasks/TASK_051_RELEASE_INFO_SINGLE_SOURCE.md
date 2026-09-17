# TASK_051 — Единый источник версии и даты релиза в footer шторки (v1.1.0)

**Статус:** DONE (опубликовано)

## Контекст

После `TASK_050` footer боковой шторки (`#drawerRelease`) выводит
«A-Lex Finance · Version 1.0.0» из `AF.AppInfo` (`js/core/app_info.js`):
`name`, `version: '1.0.0'`, `releaseDate: 'June 2026'` (строка на
английском, нигде не выводится). Версия приложения не обновлялась с
релиза 1.0.0 (июнь 2026), хотя с тех пор опубликовано ~50 задач
(`CHANGELOG.md` → `[Unreleased] — Version 1.1.0`). Нужен единый
механизм: версия и дата релиза меняются в одном месте, footer шторки
показывает их по-русски, тесты защищают от дубликатов.

## Цель

Внизу шторки — актуальная информация о релизе в виде:

```text
A-Lex Finance · v1.1.0
Обновлено: сентябрь 2026
```

Первое обновление: semantic version `1.1.0`, дата релиза `2026-09-17`
(опубликованный редизайн шторки `TASK_050`), отображаемая дата
«сентябрь 2026». Дата — фиксированная дата релиза, не дата устройства:
часовой пояс, язык телефона и день открытия приложения не влияют.

## Границы работы

Разрешено:

- `js/core/app_info.js` — расширить единственный источник: `version`,
  `releasedAt` (ISO `YYYY-MM-DD`), helper'ы отображения
  (`displayVersion()`, `displayReleaseDate()`); убрать неиспользуемое
  `releaseDate: 'June 2026'`.
- `index.html` — только `renderReleaseInfo()` (формирует footer из
  `AF.AppInfo`) и CSS `.drawer-footer` / `.rel-*` (две строки).
- `sw.js` — версия кэша `finance-v182` → `finance-v183`.
- Тесты: новый `tests/release_info.test.js`; обновление инварианта
  `renderReleaseInfo()` в `tests/drawer_redesign.test.js`; замена
  fixture-строк `'1.0.0'` в `tests/backup_service.test.js` /
  `tests/export_import_screen.test.js` на нейтральное значение (они
  проверяют passthrough опции `appVersion`, не версию приложения).
- Документация: этот TASK-файл, `AGENTS.md` (политика версий и
  чек-лист релиза), `CHANGELOG.md` (`[1.1.0] — 2026-09-17`),
  `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`.

Запрещено:

- Структура шторки из `TASK_050` (профиль, кнопка темы, баланс, группы,
  иконки), `openDrawer()`/`closeDrawer()`, обработчики пунктов.
- Нижняя навигация, `+`, операции, счета, бюджеты, аналитика,
  import/export, `AF.Store`/IndexedDB, маршруты, бизнес-логика,
  `manifest.json`, логика `sw.js` (только версия кэша).
- Второй источник версии где бы то ни было; вывод semantic version из
  номера кэша SW.
- `.claude/launch.json`, удалённый `icon.svg`, `.DS_Store` и другие
  несвязанные изменения рабочего дерева.
- Новые зависимости, debug-код.

## Требования

1. `AF.AppInfo` — единственное место правок: `name`, `version` (semver),
   `releasedAt` (ISO-дата), `releaseNotes` (резерв, как было);
   `displayVersion()` → `v1.1.0`; `displayReleaseDate()` →
   `сентябрь 2026` — разбор строки `YYYY-MM-DD` без `Date`/часового
   пояса/локали устройства, русские названия месяцев в именительном
   падеже; при некорректном `releasedAt` — возвращается сырая строка.
2. `renderReleaseInfo()` формирует footer только из `AF.AppInfo`:
   первая строка `A-Lex Finance · v1.1.0`, вторая — `Обновлено:
   сентябрь 2026`. Литералов версии/месяца/«Version» в HTML/CSS/тестах
   нет.
3. Footer: компактный, центрированный, второстепенный; цвет —
   `var(--muted)` (читаем в обеих темах, контраст ≥ 3:1 к фону шторки
   `--hero-bottom`); `margin-top:auto` (pinned при коротком контенте,
   в прокрутке на маленьких экранах); ничего другого в шторке не
   меняется.
4. Политика версий в `AGENTS.md`: `PATCH` (`1.0.1`) — небольшое
   исправление; `MINOR` (`1.1.0`) — заметный редизайн или новая
   пользовательская возможность; `MAJOR` (`2.0.0`) — большое изменение,
   ломающее совместимость или основную структуру. Чек-лист каждого
   production-релиза: обязательная строка «обновить `version` и
   `releasedAt` в `js/core/app_info.js`» + поднять cache version в
   `sw.js` + запись в `CHANGELOG.md`.
5. Semantic version и cache version SW — разные сущности: приложение
   `v1.1.0`, `sw.js` `finance-v182` → `finance-v183`.
6. `CHANGELOG.md`: раздел `[Unreleased] — Version 1.1.0` закрывается как
   `[1.1.0] — 2026-09-17`, сверху — новый пустой `[Unreleased]`.

## Критерии готовности / план проверок

1. Все `tests/*.test.js` — 0 failed; новый `tests/release_info.test.js`
   подтверждает: версия/дата из единственного объекта; вывод
   `A-Lex Finance · v1.1.0` и `Обновлено: сентябрь 2026` (реальный
   `renderReleaseInfo()` из `index.html`, выполненный на фейковом DOM);
   независимость от `Date`/TZ (глобальный `Date` подменён —
   результат тот же; другие `releasedAt` → верный месяц); контраст
   footer в light/dark ≥ 3:1; отсутствие `Version 1.0.0`, `1.0.0`,
   `June 2026`, литералов версии/месяца в `index.html`/тестах; `sw.js`
   `finance-v183`, `app_info.js` в ASSETS; структура шторки `TASK_050`
   не изменена.
2. Preview 320/390/430, light/dark: две строки footer, без overflow,
   footer не перекрывает пункты (последний элемент потока, без
   `position:absolute`), pinned на 430, в прокрутке на 320/390.
3. Функционально: пункты, тема, профиль, баланс, backdrop/Escape — как в
   `TASK_050`.
4. Production после деплоя: `sw.js` отдаёт `finance-v183`; на
   https://adar4026.github.io/finance/ в шторке видны `v1.1.0` и
   «сентябрь 2026»; единственный кэш `finance-v183`; консоль без новых
   ошибок.

## Результат

### Что реализовано

- **`js/core/app_info.js`** — единственный источник: `name`,
  `version: '1.1.0'`, `releasedAt: '2026-09-17'`, `releaseNotes` (резерв,
  как было), `MONTHS_RU`, `displayVersion()` → `v1.1.0`,
  `displayReleaseDate()` → `сентябрь 2026`. Разбор `YYYY-MM-DD` регулярным
  выражением без `Date`/`Intl`/`toLocale*` — часовой пояс, язык и текущая
  дата устройства не участвуют; некорректная строка возвращается как
  есть. Неиспользуемое `releaseDate: 'June 2026'` убрано. В шапке файла —
  краткая политика версий и напоминание чек-листа.
- **`index.html` → `renderReleaseInfo()`** формирует footer только из
  `AF.AppInfo`: `<div class="rel-name">A-Lex Finance · v1.1.0</div>` +
  `<div class="rel-date">Обновлено: сентябрь 2026</div>`. Добавлена
  защита от рассинхрона кэша (новый `index.html` + старый `app_info.js`
  без helper'ов — реально воспроизведено в preview через HTTP-кэш): без
  неё `TypeError` на старте срывал бы `showScreen()`/`secMaybeLock()`,
  которые идут сразу после вызова. Хук `releaseNotes → tappable`
  сохранён.
- **CSS `.drawer-footer`** — цвет `--muted` вместо `--muted2` (контраст к
  `--hero-bottom`: 4.3:1 light, 5.6:1 dark), `line-height:1.35`,
  `.rel-name{font-weight:600}`, `.rel-date{margin-top:1px;opacity:.85}`;
  старое однострочное `.rel-ver::before "·"` убрано (разделитель теперь
  в тексте). Кегль 11.5px, центрирование, `margin-top:auto`, safe-area —
  без изменений; остальная шторка `TASK_050` не тронута.
- **`sw.js`** `finance-v182` → `finance-v183`.
- **`AGENTS.md`** — новый раздел 7 «Версии и релизы»: единственный
  источник, политика PATCH/MINOR/MAJOR, различие semver и cache version,
  обязательный чек-лист релиза (п. 1 — обновить `version` и `releasedAt`
  в `app_info.js`). **`CHANGELOG.md`** — `[Unreleased] — Version 1.1.0`
  закрыт как `[1.1.0] — 2026-09-17` (всё с `TASK_001` по `TASK_051`),
  новый пустой `[Unreleased]`, ссылки сравнения обновлены.
- **Тесты.** Новый `tests/release_info.test.js` (99 проверок, см. план).
  `tests/drawer_redesign.test.js`: инвариант `renderReleaseInfo()`
  обновлён под новый footer, проверка cache version ослаблена до формата
  `finance-vNNN` (точное значение — в тесте актуальной задачи).
  `tests/backup_service.test.js` / `tests/export_import_screen.test.js`:
  fixture `'1.0.0'` → `'0.0.0-test'` (проверяют passthrough явной опции
  `appVersion`, к версии приложения отношения не имеют).

### Изменённые файлы

- `js/core/app_info.js`, `index.html` (только `renderReleaseInfo()` и
  CSS `.drawer-footer`/`.rel-*`), `sw.js`.
- `tests/release_info.test.js` (новый), `tests/drawer_redesign.test.js`,
  `tests/backup_service.test.js`, `tests/export_import_screen.test.js`.
- `AGENTS.md`, `CHANGELOG.md`, `docs/PROJECT_STATUS.md`,
  `docs/ROADMAP.md`, этот TASK-файл.

### Проверки

- **Тесты:** все `tests/*.test.js` — **2361 passed, 0 failed** (было
  2260: без регрессий + 99 новых + 2 в обновлённых инвариантах).
- **Preview** (`finance-local`, порт 8912, демо-данные; скриншоты —
  headless Chrome в чистом временном профиле, `--use-mock-keychain`):
  - Footer: `A-Lex Finance · v1.1.0` / `Обновлено: сентябрь 2026`,
    цвет `rgb(107,113,128)` (`--muted`) — читаем в light и dark.
  - 320×568: `scrollH 866 / clientH 568` (прокрутка), `scrollW ==
    clientW == 275`, `document.scrollWidth == 320`, `.rel-name`
    235 px < 275 px — без переноса; footer не перекрывает последнюю
    карточку. 390×844: `scrollH 866` (прокрутка на 22 px), footer.top ==
    lastCard.bottom (в потоке, без перекрытия). 430×932: `scrollH ==
    clientH == 932`, footer pinned к низу (`bottom == 932`).
  - Функционально: 9 пунктов открывают свои экраны и закрывают шторку,
    `#drawerHead` → профиль, тема system → light → … (подпись и
    `data-theme` синхронны), `#fcEye` `€4 130 → €∗∗∗∗`, backdrop и Escape
    закрывают — без изменений относительно `TASK_050`.
  - Консоль: без ошибок на актуальной сборке. Единственная ошибка за
    сессию — `a.displayVersion is not a function` при загрузке нового
    `index.html` со **старым** `app_info.js` из HTTP-кэша до добавления
    защиты; после защиты воспроизведение невозможно (покрыто тестом).
  - PWA: единственный кэш `finance-v183`, `manifest.json` не менялся.

### Публикация

- Коммит реализации: `feat(TASK_051): единый источник версии и даты
  релиза, footer шторки v1.1.0` — **`652460f`**. В коммит вошли только
  12 файлов задачи (`js/core/app_info.js`, `index.html`, `sw.js`,
  `tests/release_info.test.js`, `tests/drawer_redesign.test.js`,
  `tests/backup_service.test.js`, `tests/export_import_screen.test.js`,
  `AGENTS.md`, `CHANGELOG.md`, `docs/PROJECT_STATUS.md`,
  `docs/ROADMAP.md`, TASK-файл); `.claude/launch.json`, удалённый
  `icon.svg`, `.DS_Store` не включены.
- Push в `origin/main`: `b2b2963..652460f`.
- Деплой: GitHub Actions «pages build and deployment» (run
  `35196503468`) — `completed`/`success` для `652460f`.
- **Production-проверка** (https://adar4026.github.io/finance/, браузер
  390×844, чистая сессия): `sw.js` отдаёт `CACHE = 'finance-v183'`;
  `js/core/app_info.js` отдаёт `version: '1.1.0'`, `releasedAt:
  '2026-09-17'`; `AF.AppInfo.displayVersion()` → `v1.1.0`,
  `displayReleaseDate()` → `сентябрь 2026`; footer шторки —
  «A-Lex Finance · v1.1.0» / «Обновлено: сентябрь 2026» (скриншот);
  SW `activated` на scope `/finance/`, единственный кэш
  `["finance-v183"]` — старый `finance-v182` вычищен; 9 пунктов шторки
  на месте; горизонтального overflow нет; консоль без ошибок.

### Известные ограничения

- HTTP-кэш GitHub Pages (`Cache-Control: max-age=600`) может до 10 минут
  после деплоя отдавать старый `app_info.js` рядом с новым `index.html`
  (pre-existing поведение network-first SW для всех файлов проекта) —
  footer в этом окне покажет `v1.0.0` без строки даты, приложение
  стартует нормально; после истечения окна/следующего открытия — `v1.1.0`.
- Реальная проверка на физическом iPhone не выполнялась.
