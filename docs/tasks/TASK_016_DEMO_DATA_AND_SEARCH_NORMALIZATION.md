# TASK_016 — Demo Data and Search Normalization Fixes

- **Номер:** TASK_016
- **Название:** Demo Data and Search Normalization Fixes
- **Статус:** DONE
- **Создан:** 2026-07-27
- **Реализация начата:** 2026-07-27
- **Реализация завершена:** 2026-07-27 (534 passed, 0 failed по всем 7 файлам
  тестов; проверено в браузере — светлая/тёмная тема, мобильный viewport,
  консоль без ошибок)

---

## 1. Контекст

После `TASK_015` (`fbea614`, `finance-v157`, `SCHEMA_VERSION=3`, 258/258
тестов) в `docs/PROJECT_STATUS.md` и в самом TASK-файле `TASK_015`
(§«Известные ограничения», ОВ-4) зафиксированы два independent дефекта,
намеренно отложенные как отдельная задача:

1. `loadDemo()` ссылается на несуществующие id категорий/подкатегорий —
   демо-операции отображаются как «Другое ❓».
2. В поиске операций нет нормализации Unicode-диакритики — `Gijón` не
   находится по `gijon`.

Оба дефекта существовали до `TASK_015` и не связаны друг с другом —
объединены в одну задачу по решению пользователя (два небольших
независимых исправления).

## 2. Два найденных дефекта и их причина

### Дефект 1 — `loadDemo()` использует несуществующие category/subcategory id

Причина: `loadDemo()` (`index.html`) писался/правился до того, как
актуальная таксономия `CATS` (`index.html`, ныне
`AF.Services.CategoryTaxonomy.CATS`) была переработана — id в
`loadDemo()` (`realty`, `income_main`, `products`, `prius`, `flat`,
`clothes`, `beauty`, `tech`, `subscriptions`) и в `state.budgets`/
`state.reminders` не были обновлены вслед за таксономией. `catById(id)`
не находит такие id и возвращает fallback `{name:'Другое',emoji:'❓'}`
(`index.html`, рядом с `CATS`), поэтому все демо-операции выглядели как
«Другое ❓».

### Дефект 2 — поиск не нормализует диакритику

Причина: `txSearchText()`/`runSearch()` (`index.html`) приводят текст
только к нижнему регистру (`.toLowerCase()`), без Unicode-нормализации.
`Gijón`.toLowerCase() остаётся `gijón` — сравнение с пользовательским
запросом `gijon` (без диакритики) не совпадает по подстроке.

## 3. Границы (см. также промпт пользователя, раздел «Границы TASK_016»)

**Включено:** исправление demo category/subcategory id, тесты на
валидность demo-данных, Unicode NFD-нормализация поиска (запрос и
индексируемый текст), поиск по полям TASK_015 (`payee`/`tags`/
`location`), тесты, документация, bump кэша `sw.js`.

**Не включено:** транслитерация кириллицы, fuzzy search, исправление
опечаток, ranking/relevance, подсветка совпадений, новые UI-фильтры,
отдельный экран поиска, изменение модели данных, изменение
`SCHEMA_VERSION`, изменения reminders (кроме category id), новые
категории, редизайн, GPS, изменения TASK_015 UI, рефакторинг всей
поисковой системы.

`SCHEMA_VERSION` остаётся `3`.

## 4. Таблица соответствия demo category/subcategory id

| Было (не существует) | Существует? | Стало (существующий id) | Подкатегория | Операция |
|---|---|---|---|---|
| `realty` (income) | нет | `rent` | `s_rent_0` (Аренда жилья) | Арендный доход через агентство «Inmo Digital» |
| `income_main` (income) | нет | `salary` | — | Основной ежемесячный доход |
| `products` (expense) | нет | `food` | `s_food_0` (Супермаркет) | Продукты, Mercadona |
| `prius` (expense, idx4 — вне диапазона) | нет | `transport` | `s_transport_0` (Топливо) | АЗС Repsol |
| `flat` (expense) | нет | `home` | `s_home_0` (Аренда) | Аренда жилья |
| `health` (expense, idx2 семантически неверен) | да (категория), нет (подходящий индекс) | `health` | `s_health_0` (Аптека) | Farmacia Uría — аптека |
| `clothes` (expense) | нет | `shopping` | `s_shopping_0` (Одежда) | Покупка одежды |
| `beauty` (expense) | нет | `care` | `s_care_1` (Косметика) | Уход/косметика |
| `tech` (expense) | нет | `shopping` | `s_shopping_2` (Электроника) | MediaMarkt — электроника |
| `subscriptions` (expense) | нет | `subs` | — | Подписка |
| `home` (expense, idx1 — семантически неверен: Mercadona/`дом` под «Ипотека») | да (id), но неверно по смыслу | `shopping` | `s_shopping_3` (Для дома) | Товары для дома, Mercadona |
| `flat` (reminder ×2: «Comunidad», IBI) | нет | `home` (Comunidad) / `taxes` (IBI — имущественный налог) | — | Коммунальные платежи / ежегодный налог на недвижимость |
| `subscriptions` (reminder) | нет | `subs` | — | Напоминание о подписке |
| `income_main` (reminder) | нет | `salary` | — | Напоминание о доходе |

`state.budgets` обновлён вслед за категориями: `{food, transport, subs,
care}` вместо `{products, prius, subscriptions, beauty}` (те же лимиты).

Суммы, даты, счета, payee/tags/location и общий смысл операций не
менялись — менялись только id категории/подкатегории на существующие
семантически близкие.

## 5. Архитектура

### 5.1. Категории/demo — три новых чистых сервиса

- **`js/services/category_taxonomy_service.js`** (`AF.Services.
  CategoryTaxonomy`) — таксономия `CATS`, вынесенная из ранее инлайновой
  константы в `index.html` (значения не изменены, только перемещены).
  Единый источник правды, по которому `seedCategories()` в `index.html`
  сидирует `state.cats`/`state.subcats`, и по которому тест проверяет
  demo-данные — без дублирования таксономии в тесте.
- **`js/services/demo_data_service.js`** (`AF.Services.DemoData`) —
  чистая функция `build(accountIds, today)`, возвращающая массив
  демо-операций. Извлечена из ранее инлайновой части `loadDemo()`
  (только генерация `tx`; `budgets`/`goals`/`reminders`/
  `healthHistory` остались в `index.html` — короткие объектные
  литералы, не требующие вынесения). Не обращается к DOM/localStorage.
- **`index.html`** — `loadDemo()` теперь вызывает
  `AF.Services.DemoData.build(...)`, с защитным фолбэком (см. §7), и
  правит id в `state.budgets`/`state.reminders` напрямую.

Извлечение таксономии/demo-генерации в сервисы — тот же паттерн, что
уже использован в проекте для `period_service.js`/`tx_form_service.js`
(вынесение ранее инлайновой логики `index.html` без изменения
поведения).

### 5.2. Поиск — новый сервис `search_service.js`

Рассмотрены три варианта размещения `normalizeSearchText`:

1. `tx_meta_service.js` — отклонён: этот сервис специально ограничен
   нормализацией метаданных операции (`payee`/`tags`/`location`), а
   диакритик-нормализация нужна для ВСЕГО поискового корпуса
   (категории, счета, суммы, `note`) и для пользовательского запроса —
   более широкая, самостоятельная ответственность.
2. Локально в `index.html` — отклонён: функция не связана с DOM/
   состоянием, легко тестируется в изоляции (как остальные сервисы
   проекта), и локальное размещение не даёт Node-тесту без DOM
   проверить её напрямую без хрупкого парсинга `index.html`.
3. **Новый небольшой сервис `js/services/search_service.js`
   (`AF.Services.Search`) — выбран.** Единственная чистая функция
   `normalizeSearchText(value)`, без побочных эффектов, тестируется как
   остальные сервисы проекта.

`index.html` обращается к сервису только через хелпер `searchNorm()`
(тот же паттерн, что `txMeta()` из `TASK_015`) — используется в двух
точках: `txSearchText()` (индексируемый текст операции) и `runSearch()`
(термы пользовательского запроса, но НЕ отображаемый текст запроса —
см. §6, пункт «не меняй отображаемые данные»).

## 6. Unicode-правила

`normalizeSearchText(value)`:

1. `null`/`undefined` → `''`; прочие не-строки — `String(value)`.
2. Если `String.prototype.normalize` доступен — `normalize('NFD')` +
   удаление combining marks (`/[̀-ͯ]/g`) в `try/catch`
   (защита от неожиданных исключений движка).
3. `toLowerCase()`.
4. Схлопывание повторных пробелов, `trim()`.

Без Unicode property escapes (`\p{Diacritic}`) — избегается риск
несовместимости со старым iOS Safari.

Подтверждено соответствие требованиям:

- `ñ`/`ü` и т.п. декомпозируются NFD в базовую букву + combining mark →
  combining mark удаляется → `España` ≡ `espana`, `über` ≡ `uber`.
- Кириллица НЕ транслитерируется — `Овьедо` не совпадает с `Oviedo`
  (разные кодовые точки, `normalize('NFD')` их не путает).
- `ß` не преобразуется в `ss` — не декомпозируется NFD (не составной
  символ), остаётся как есть; зафиксировано как **не-цель** (см. §3).
- Составные Unicode-последовательности (буква + отдельный combining
  mark, например `Café`) и предкомпонованные эквиваленты (`Café`)
  после `normalize('NFD')` сходятся к одному результату.
- Отображаемые данные (сама операция, `q` в подсказке «Ничего не
  найдено по запросу «…»») не меняются — нормализация применяется
  только к копии текста, используемой для сравнения.

## 7. Безопасная деградация

- `AF.Services.Search.normalizeSearchText` при отсутствии
  `String.prototype.normalize` возвращает `lowercase + trim +
  схлопнутые пробелы` без диакритик-нормализации — не падает.
- `index.html` обращается к сервису только через `searchNorm()`; при
  отсутствии сервиса (несинхронный CDN/GitHub Pages деплой) —
  `lowercase + trim` без диакритики, тоже не падает.
- `AF.Services.CategoryTaxonomy` отсутствует → `const CATS` в
  `index.html` получает пустой фолбэк (`{expense:[],income:[]}`) вместо
  падения при старте — категории будут пустыми, но приложение не
  крашится.
- `AF.Services.DemoData` отсутствует → `loadDemo()` показывает
  `toast()` об ошибке вместо падения.
- Старый `index.html` с новым `js/` — новые сервисы просто не
  вызываются никем, ноль побочных эффектов при загрузке (как
  `tx_meta_service.js` в `TASK_015`).
- Новый `index.html` со старым `js/` (без трёх новых файлов) —
  см. фолбэки выше.

## 8. Тестовая стратегия

- `tests/demo_data_service.test.js` — Node-тест без DOM:
  - все `category id`, используемые `AF.Services.DemoData.build(...)`,
    существуют в `AF.Services.CategoryTaxonomy.CATS`;
  - все `subcategoryId`, где заданы, существуют внутри своей категории;
  - ни одна демо-операция не ссылается на несуществующую категорию
    (эмуляция `catById` — fallback «Другое» не наступает);
  - демо-данные проходят `AF.Services.TxMeta.normalizeTx` без
    изменений (уже нормализованы — совместимость со schema v3);
  - `payee`/`tags`/`location` валидны (проходят
    `normalizePayee`/`normalizeTags`/`normalizeLocation` без потерь);
  - демо-операции успешно проходят `AF.Services.Export.csv(...)` без
    исключений и с непустой колонкой «Категория» для каждой операции
    (совместимость с поиском проверяется отдельно, см. ниже, — общий
    текстовый корпус строится из тех же `cat`/`subcategoryId`, что
    проверены выше).
- `tests/search_service.test.js` — Node-тест без DOM:
  - испанские примеры (`Gijón`↔`gijon`, `León`↔`leon`, `Málaga`↔
    `malaga`, `José`↔`jose`, `España`↔`espana`, `pingüino`↔`pinguino`);
  - составной Unicode (`Café` ↔ `cafe`);
  - кириллица (`Овьедо` находится по `овьедо`, НЕ находится по
    `oviedo`);
  - метаданные TASK_015 (`payee`/`tags`/`location`/`note` без
    диакритики);
  - AND-семантика составного запроса (`mercadona gijon` находит,
    `mercadona oviedo` — нет) — через прямую проверку
    `normalizeSearchText` на подстроки, без необходимости грузить
    `index.html`;
  - безопасность: `null`, `undefined`, число, пустая строка, строка из
    пробелов, эмодзи;
  - фолбэк без `String.prototype.normalize` — временное удаление
    метода в тесте с гарантированным восстановлением.

## 9. Риски

- Расширение поиска на нормализованный текст теоретически может
  находить операции, которые раньше не находились (диакритик-
  нечувствительность) — это ожидаемое и требуемое поведение задачи, не
  регрессия.
- Смена id категорий в demo budgets/reminders — затрагивает только
  данные, создаваемые `loadDemo()` заново при каждом вызове (не
  затрагивает существующие пользовательские данные).
- Вынесение `CATS` в отдельный файл увеличивает (на один файл) список
  зависимостей, обязательных для старта приложения — смягчено фолбэком
  на пустую таксономию вместо падения (см. §7).

## 10. Реализация

### 10.1. Новые файлы

- `js/services/category_taxonomy_service.js` — `AF.Services.CategoryTaxonomy.CATS` (перенос без изменений) + `categoryExists`/`subcategoryExists`.
- `js/services/demo_data_service.js` — `AF.Services.DemoData.build(accountIds, today)`, `EXPENSE_SPEC`, `subId`.
- `js/services/search_service.js` — `AF.Services.Search.normalizeSearchText(value)`.
- `tests/demo_data_service.test.js` — 239 проверок.
- `tests/search_service.test.js` — 37 проверок.
- `docs/tasks/TASK_016_DEMO_DATA_AND_SEARCH_NORMALIZATION.md` — этот файл.

### 10.2. Изменённые файлы

- `index.html`:
  - `const CATS` — заменена на ссылку на `AF.Services.CategoryTaxonomy.CATS` с фолбэком на пустую таксономию;
  - `loadDemo()` — генерация `tx` делегирована `AF.Services.DemoData.build()`; `state.budgets`/`state.reminders` переведены на существующие id категорий (см. §4); защитная проверка наличия сервиса с `toast()` вместо падения;
  - добавлен хелпер `searchNorm()` (тот же паттерн, что `txMeta()`);
  - `txSearchText()` — финальный `.toLowerCase()` заменён на `searchNorm(...)`;
  - `runSearch()` — термы запроса построены из `searchNorm(q)` вместо `q` напрямую; отображаемый `q` не тронут;
  - добавлены три новых `<script src="js/services/...">`.
- `sw.js` — `CACHE`: `finance-v157` → `finance-v158`; добавлены `category_taxonomy_service.js`, `demo_data_service.js`, `search_service.js` в `ASSETS`.

`SCHEMA_VERSION` не менялся (остаётся `3`). Модель операции и UI TASK_015 не затронуты.

## 11. Результаты тестов

Полный прогон всех 7 файлов (`node tests/*.test.js`):

| Файл | Результат |
|---|---|
| `demo_data_service.test.js` (новый) | 239 passed, 0 failed |
| `export_service.test.js` | 56 passed, 0 failed |
| `finance_card_service.test.js` | 37 passed, 0 failed |
| `period_service.test.js` | 30 passed, 0 failed |
| `search_service.test.js` (новый) | 37 passed, 0 failed |
| `tx_form_service.test.js` | 39 passed, 0 failed |
| `tx_meta_service.test.js` | 96 passed, 0 failed |
| **Итого** | **534 passed, 0 failed** |

`git diff --check` — чисто, конфликтов и пробельных ошибок нет.

## 12. Браузерная проверка (локально, `file://index.html`)

- Консоль без ошибок при старте и на всех дальнейших шагах.
- `AF.Services.DemoData.build(...)` через `loadDemo()` (с программным подтверждением `confirm`, т.к. headless-браузер не показывает нативный диалог) — 33 операции, `catById(cat).emoji !== '❓'` для всех, `state.budgets`/`state.reminders` используют только существующие id.
- Главный экран: демо-операции отображаются с настоящими категориями («Покупки · Для дома», «Подписки» и т.д.), фолбэка «Другое ❓» нет ни у одной операции.
- Поиск `gijon` (без диакритики) находит все 3 операции MediaMarkt (`location: 'Gijón'`).
- Поиск `oviedo` (без диакритики) находит все 6 операций с `location: 'Oviedo'` (Farmacia Uría, Mercadona) за все 3 месяца.
- Кириллица (`овьедо`) не находит латинские `Oviedo` — транслитерации нет, поведение по спецификации.
- Безопасная деградация проверена искусственным удалением сервисов в рантайме:
  - без `AF.Services.Search` — `runSearch()` не падает, деградирует к точному (без диакритики) сравнению;
  - без `AF.Services.DemoData` — `loadDemo()` не падает, показывает `toast()`.
- Тёмная тема + мобильный viewport (375×812) — рендер корректен, результаты поиска не меняются.
- Production (`https://adar4026.github.io/finance/`) не проверялся в рамках этой сессии — деплой и проверка `finance-v158` на живом сайте выполняются пользователем после push (см. §12 инструкции пользователя; production-проверка не была явно запрошена как часть этой сессии).

## 13. Известные ограничения

- `state.budgets`/`state.reminders` внутри `loadDemo()` остались короткими объектными литералами в `index.html` (не вынесены в сервис — не оправдано архитектурно для нескольких пар ключ-значение). Их id проверяются точечным regex-тестом по исходному тексту `index.html` (`tests/demo_data_service.test.js`, §7), а не через чистый сервис — минимальный, но не «настоящий» юнит-тест этой части.
- Транслитерация кириллицы (`Овьедо` ↔ `Oviedo`) сознательно не реализована — зафиксировано в границах TASK_016 как не-цель.
- `ß` не приводится к `ss` — не-цель (см. §3, §6).
- Продакшен-проверка `finance-v158` на GitHub Pages не выполнена в рамках этой сессии (см. §12).
