# TASK_059 — Ребрендинг PWA в LexMoney, новая иконка, подготовка к переименованию папки

**Статус:** DONE (опубликовано)

## Контекст

Пользователь (2026-09-20): приложение переименовывается в **LexMoney**.
Прежние пользовательские названия — «Финансы» (title / manifest /
`apple-mobile-web-app-title`), «A-Lex Finance» (footer шторки,
резервные копии, WebAuthn rp.name, экран «Безопасность»), «Alex Finance»
(HTML-отчёт экспорта). Новый мастер-файл иконки — `Lexmoney.png` в корне
(1254×1254, PNG, RGB, коричневый кошелёк на скруглённой подложке);
должен называться строго `lexmoney.png`.

Production: GitHub Pages `https://adar4026.github.io/finance/`,
репозиторий `adar4026/finance` — **не меняются** (deployment path и имя
репозитория — отдельное решение). Локальная папка `Projects/Finance` —
**не переименовывается** в этой задаче; нужно лишь проверить, безопасно ли
это сделать позже.

## Цель

1. Везде, где название приложения видно пользователю, — `LexMoney`
   (title, manifest name/short_name, Apple/PWA meta, footer шторки,
   тексты backup/import/security/export).
2. Иконки `apple-touch-icon.png` (180), `favicon-32.png` (32),
   `icon-192.png` (192), `icon-512.png` (512) — из `lexmoney.png` без
   изменения дизайна, рамок, полей, растяжения.
3. `sw.js` — cache version `finance-v190` → `finance-v191`; precache
   содержит актуальные иконки, без ссылок на неиспользуемые изображения.
4. Классификация всех оставшихся совпадений `Finance` / `A-Lex Finance` /
   `/Finance/` / `Projects/Finance` / `finance` по категориям
   (пользовательское название / локальный путь / deployment path / имя
   репозитория / внутренний технический идентификатор).
5. Вывод о безопасности переименования локальной папки.

## Границы работы

Разрешено:

- `index.html` — `<title>`, Apple/PWA meta, пользовательские строки с
  названием приложения (footer настроек, backup/import, rp.name,
  security-note).
- `manifest.json` — `name`, `short_name`, `description`, `icons`.
- `js/core/app_info.js` — `name`.
- `js/services/backup_service.js`, `js/services/export_service.js`,
  `js/services/import_source_service.js` — только пользовательские строки
  (не форматы/ключи/идентификаторы).
- `sw.js` — cache version, список `ASSETS`.
- Иконки: `apple-touch-icon.png`, `favicon-32.png`, `icon-192.png`,
  `icon-512.png`; переименование `Lexmoney.png` → `lexmoney.png`.
- Тесты: обновить ожидания названия; новый `tests/rebrand_lexmoney.test.js`.
- Документация: этот TASK-файл; заголовки живых документов (`CLAUDE.md`,
  `AGENTS.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `CHANGELOG.md`).

Запрещено:

- Функциональность приложения, бизнес-логика, storage, маршрутизация.
- Внутренние идентификаторы: cache key prefix `finance-v`, ключи
  localStorage, `finance_card_service.js`, CSS-классы, `id: 'alexfinance'`
  источника импорта, ключ `app: 'Alex Finance'` формата резервной копии
  (совместимость со старыми копиями), `rp.id`.
- «Money Flow» — это стороннее приложение (источник импорта), не бренд.
- GitHub Pages URL `/finance/`, имя репозитория `adar4026/finance`,
  `origin`.
- Локальная папка `Projects/Finance` — не переименовывать.
- Посторонние незакоммиченные изменения: `.claude/launch.json`,
  удалённый `icon.svg`, `.DS_Store`.
- Дизайн иконки: без рамок, полей, фона, текста, теней.

## Требования

1. `index.html`: `<title>LexMoney</title>`,
   `<meta name="apple-mobile-web-app-title" content="LexMoney">`,
   `<link rel="apple-touch-icon" href="apple-touch-icon.png">`.
2. `manifest.json`: `"name": "LexMoney"`, `"short_name": "LexMoney"`,
   icons `icon-192.png` (192x192) и `icon-512.png` (512x512), `image/png`.
3. Иконки — квадратные, точных размеров, из `lexmoney.png`, качественное
   уменьшение (Lanczos).
4. `sw.js`: `finance-v191`; precache включает `icon-192.png`,
   `icon-512.png`, `apple-touch-icon.png`, `manifest.json`.
5. Все `tests/*.test.js` — 0 failed; новый тест проверяет title, meta,
   manifest name/short_name, ссылки на иконки и реальные размеры PNG.

## Критерии готовности

- Тесты 0 failed; размеры иконок подтверждены чтением PNG-заголовков.
- Один чистый коммит только с файлами задачи; push в `origin/main`.
- Production: title `LexMoney`, manifest `LexMoney`, иконки 200,
  `sw.js` → `finance-v191`.
- В этом файле — таблица классификации старых совпадений и вывод о
  переименовании папки.

## План проверок

1. `node tests/rebrand_lexmoney.test.js` + полный прогон `tests/*.test.js`.
2. `python3` (Pillow) — фактические размеры и отсутствие alpha-полей.
3. `git status` / `git diff` перед коммитом — только файлы задачи.
4. `curl` production после деплоя: `index.html`, `manifest.json`, `sw.js`,
   четыре PNG.

---

## Результат

### Что реализовано

- `index.html`: `<title>LexMoney</title>`;
  `<meta name="apple-mobile-web-app-title" content="LexMoney">`; footer
  экрана настроек «LexMoney» (было «Финансы · в стиле Alex Finance»);
  подписи резервных копий (`description:'LexMoney backup'`, «Резервная
  копия LexMoney»); WebAuthn `rp:{name:'LexMoney'}` (`rp.id` не
  задавался и не задаётся); примечание о виджетах на экране
  «Безопасность»; префиксы скачиваемых файлов `alex_finance_*` →
  `lexmoney_*` (`.csv`, `.xlsx`, `_backup_*.afb`, `_safety_*.afb`),
  `finance-YYYY-MM-DD.json` → `lexmoney-YYYY-MM-DD.json`. Ссылки
  `<link rel="apple-touch-icon" href="apple-touch-icon.png">` и
  `<link rel="icon" href="favicon-32.png">` — без изменений (уже верные).
- `manifest.json`: `"name": "LexMoney"`, `"short_name": "LexMoney"`,
  `description` «LexMoney — личный учёт доходов и расходов с графиками»;
  `icons` — `icon-192.png` 192x192 и `icon-512.png` 512x512 (`any` +
  `maskable`), `image/png`; `start_url`/`scope`/`display` не тронуты.
- `js/core/app_info.js`: `name: 'LexMoney'` → footer шторки
  «LexMoney · v1.1.0».
- `js/services/backup_service.js`: сообщение «…не резервная копия
  LexMoney.»; ключ формата `app: 'Alex Finance'` **сохранён** (иначе
  сломается совместимость со старыми `.afb`).
- `js/services/export_service.js`: HTML-отчёт — `<title>LexMoney —
  отчёт</title>`, `<h1>💰 LexMoney</h1>`.
- `js/services/import_source_service.js`: видимое имя источника
  `'LexMoney'`, `id: 'alexfinance'` сохранён.
- Иконки: `Lexmoney.png` → `lexmoney.png` (untracked, двухшаговый `mv`
  на регистронезависимой APFS; `git ls-files` второго варианта регистра
  не содержит). Из него (1254×1254 RGB, без ICC) Pillow 11.3 (`arch
  -x86_64 python3`): square crop = весь кадр (уже квадрат), `LANCZOS` →
  `apple-touch-icon.png` 180×180, `favicon-32.png` 32×32, `icon-192.png`
  192×192, `icon-512.png` 512×512; все RGB (colorType 2), без alpha,
  без рамок/полей/фона/текста. Визуально проверены 180 и 32 (кошелёк
  читаем, застёжка и карта различимы на 32).
- `sw.js`: `finance-v190` → `finance-v191`; `ASSETS`: добавлен
  `./favicon-32.png`, убран `./wave-card.jpg` (нигде не используется с
  `TASK_003`; файл на диске оставлен). `activate` по-прежнему удаляет все
  кэши ≠ `CACHE` — прежние иконки/manifest из кэша не отдаются.
- Тесты: `tests/release_info.test.js` (ожидания `LexMoney`),
  `tests/security_screen.test.js`, `tests/import_service.test.js`,
  `tests/export_import_screen.test.js` (`lexmoney_safety_`); новый
  `tests/rebrand_lexmoney.test.js` — 98 проверок (title, Apple/PWA meta,
  manifest name/short_name/icons, ссылки на иконки, реальные размеры PNG
  по IHDR, мастер-файл строчными, precache/cache version, отсутствие
  старых названий вне комментариев, сохранённые внутренние
  идентификаторы).
- Документация: заголовки `CLAUDE.md`, `AGENTS.md`,
  `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `CHANGELOG.md`;
  исторические TASK-файлы и `PROJECT_BASELINE.md` не переписывались.

### Классификация оставшихся совпадений

| Совпадение | Где | Категория | Решение |
|---|---|---|---|
| «Финансы» (title/meta/manifest) | `index.html`, `manifest.json` | Пользовательское название | Заменено на `LexMoney` |
| «A-Lex Finance» / «Alex Finance» (UI, backup, отчёт, импорт, security, rp.name) | `index.html`, `app_info.js`, `backup_service.js`, `export_service.js`, `import_source_service.js`, тесты | Пользовательское название | Заменено на `LexMoney` |
| `alex_finance_*` / `finance-*.json` (имена скачиваемых файлов) | `index.html` | Пользовательское название | `lexmoney_*` / `lexmoney-*` |
| `app: 'Alex Finance'` (ключ формата `.afb`) | `backup_service.js`, `tests/backup_service.test.js` | Внутренний технический идентификатор | Оставлен (совместимость старых копий) |
| `id: 'alexfinance'` (источник импорта) | `import_source_service.js` | Внутренний технический идентификатор | Оставлен, видимое `name` → `LexMoney` |
| `CACHE = 'finance-vNNN'` | `sw.js`, 14 тестов | Внутренний технический идентификатор | Оставлен, версия поднята до `v191` |
| `KEY = 'finance_app'` (localStorage) | `js/database/store.js` | Внутренний технический идентификатор | Оставлен (смена = потеря данных) |
| `finance_card_service.js`, `AF.Services.FinanceCard`, `renderFinanceCard()`, `.finance-*` CSS | `js/`, `index.html`, тесты | Внутренний технический идентификатор | Оставлены |
| `/* Alex Finance Design Tokens */`, «палитра Finance», «Liquid Finance» | комментарии `index.html`, `hero_canvas.js`, тесты | Внутренний (комментарии) | Оставлены |
| «Money Flow» | `import_source_service.js`, `export_service.js`, тесты | Стороннее приложение (источник импорта) | Оставлено — не бренд |
| `https://adar4026.github.io/finance/` | `docs/`, `.claude/settings.local.json` | Deployment path | Не менять без отдельного решения |
| `https://github.com/adar4026/finance.git` (`origin`) | `.git/config`, `CLAUDE.md` | Имя репозитория | Не менять без отдельного решения |
| `/Users/MacPro/Projects/Finance` (3 записи `finance-local*`) | `.claude/launch.json` (незакоммиченный локальный конфиг) | Локальный путь | Не тронут в этой задаче; после переименования папки поправить `--directory` |
| `/Users/AlexT/Projects/Finance`, `/Users/AlexT/Projects 1/finance` | `.claude/launch.json`, `.claude/settings.local.json` | Локальный путь (устаревший, другая машина) | Уже нерабочие; не влияют на приложение |
| `/Users/MacPro/Projects/LexCar` | `docs/tasks/TASK_054_*.md` | Локальный путь (соседний проект, справочно) | Оставлен |
| «A-Lex Finance» в исторических TASK-файлах, `PROJECT_BASELINE.md`, старых записях `CHANGELOG.md` | `docs/` | Историческая документация | Не переписывается |

### Проверка зависимости от абсолютного пути папки

Проверены: `.claude/` (launch.json, settings.local.json), IDE-конфиги
(`.vscode`/`.idea` — нет), shell-скрипты (нет), `package.json` (нет),
тесты (все через `__dirname`/`path.join`), CI/CD (`.github` — нет; GitHub
Pages собирается из `main` `/`), Git hooks (нет), `.git/config` (только
`origin`), symlinks (нет), документация (пути только справочные).

**Вывод: локальную папку `Finance` можно безопасно переименовать в
`LexMoney` после закрытия Claude Code.** Порядок: закрыть Claude Code →
переименовать папку локально → открыть проект заново из новой папки.
GitHub Pages URL и имя репозитория при этом не меняются. После
переименования: (1) поправить `--directory` в записях `finance-local*`
локального `.claude/launch.json` (иначе превью не запустится); (2) Claude
Code заведёт новый проект по новому пути — история сессий и `memory/`
из `~/.claude/projects/-Users-MacPro-Projects-Finance/` автоматически не
переносятся (при необходимости скопировать вручную).

### Проверки

- `node tests/rebrand_lexmoney.test.js` — 98 passed, 0 failed.
- Полный прогон `tests/*.test.js` (36 файлов): **2887 passed, 0 failed**
  (до задачи — 2788 в 35 файлах).
- Размеры PNG подтверждены Pillow, `file(1)` и IHDR-тестом: 180×180,
  32×32, 192×192, 512×512.
- Preview `finance-local` (Chrome): `document.title === 'LexMoney'`,
  `apple-mobile-web-app-title === 'LexMoney'`, manifest name/short_name
  `LexMoney`, `createImageBitmap` четырёх иконок — точные размеры, SW
  зарегистрирован, `caches.keys()` → только `finance-v191`, footer
  шторки «LexMoney · v1.1.0 / Обновлено: сентябрь 2026», Главная/записи/
  навигация — как прежде; ошибок приложения в консоли нет (только
  CORS-шум `cloudflareinsights` от CDN chart.js на localhost — был и до
  задачи).
- Функциональность приложения не менялась: diff `index.html` — 12 строк
  (только строки/имена файлов), сервисы — только строковые литералы.

### Известные ограничения

- На iPhone старое имя/иконка могут остаться в кэше экрана «Домой»: после
  деплоя удалить старую иконку и добавить сайт на экран заново.
- `wave-card.jpg`, `IMG_2662.jpg`, `IMG_4615.jpg` остаются в репозитории
  как неиспользуемые исторические файлы (не удалялись вслепую — отдельное
  решение).

### Git / публикация

_(заполняется после коммита и деплоя)_
