// tests/import_service.test.js — импорт CSV: определение источника, сопоставление
// колонок/счетов/категорий, дубликаты, переводы, валидация и атомарность (TASK_038).
// Запуск: node tests/import_service.test.js
//
// Главные инварианты, ради которых написан файл:
//   1. повторный импорт того же файла не создаёт ни одной новой операции;
//   2. похожие, но реально разные операции не считаются дубликатами;
//   3. перевод остаётся ОДНОЙ записью type:'transfer' и не превращается
//      в пару доход/расход (двойной учёт);
//   4. ошибка разбора, валидации или записи оставляет базу без изменений.
global.window = global;
['../js/core/result.js', '../js/core/ids.js', '../js/services/currency_service.js',
 '../js/services/tx_meta_service.js', '../js/services/csv_parser_service.js',
 '../js/services/import_source_service.js', '../js/services/import_mapping_service.js',
 '../js/services/import_service.js'].forEach(f => require(f));

const CSV = AF.Services.CsvParser, SRC = AF.Services.ImportSource,
      MAP = AF.Services.ImportMapping, IMP = AF.Services.Import;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) { if (cond) passed++; else { failed++; console.error(`FAIL: ${msg}`); } }

const MF_HEAD = 'Дата,Счёт,Сумма,Валюта,Категория,Контрагент,Перевод: Счёт,Перевод: Сумма,Перевод: Валюта,Метки,Место,Примечание';

function baseState() {
  return {
    schemaVersion: 3, currency: '€',
    accounts: [{ id: 'a_ing', name: 'ING', currency: '€' }, { id: 'a_cash', name: 'Наличные', currency: '€' }],
    cats: [{ id: 'c_food', name: 'Продукты', type: 'expense' }, { id: 'c_sal', name: 'Зарплата', type: 'income' }],
    subcats: [], tx: [], budgets: {}, goals: [], reminders: [], healthHistory: [], importBatches: [], settings: {},
  };
}

// Полный путь «текст → план», как его проходит мастер импорта.
function planFor(text, state, opts) {
  const parsed = CSV.parse(text);
  if (!parsed.ok) return { parseError: parsed.error };
  const p = parsed.value;
  const mapping = (opts && opts.mapping) || SRC.autoMap(p.header).map;
  const accountPlan = MAP.buildAccountPlan(IMP.collectAccountNames(p.body, mapping), state.accounts);
  const categoryPlan = MAP.buildCategoryPlan(IMP.collectCategoryEntries(p.body, mapping), state.cats);
  if (opts && opts.tweak) opts.tweak({ accountPlan, categoryPlan });
  return {
    parsed: p, mapping, accountPlan, categoryPlan,
    plan: IMP.buildPlan({ body: p.body, mapping, state, accountPlan, categoryPlan,
      skipDuplicates: !(opts && opts.skipDuplicates === false) }),
  };
}

// ============ 1. Определение источника ============
{
  // Наш собственный CSV-экспорт пишет ровно формат Money Flow (12 колонок в
  // утверждённом порядке), поэтому точное совпадение подписывается как
  // «A-Lex Finance» — это более точный ответ для того же файла.
  const own = SRC.detect(MF_HEAD.split(','));
  assertEqual(own.name, 'A-Lex Finance', 'Точное совпадение с собственным экспортом распознано как A-Lex Finance');
  const mf = SRC.detect(['Дата', 'Время', 'Счёт', 'Сумма', 'Валюта', 'Категория', 'Перевод: Счёт', 'Перевод: Сумма']);
  assertEqual(mf.name, 'Money Flow', 'Вариант Money Flow с другим набором колонок распознан как Money Flow');
  const en = SRC.detect(['Date','Account','Amount','Currency','Category','Payee','Transfer: Account','Transfer: Amount','Note']);
  assertEqual(en.name, 'Money Flow', 'Английские заголовки Money Flow тоже распознаны');
  const unknown = SRC.detect(['когда','сколько','зачем']);
  assertEqual(unknown.name, 'CSV', 'Неизвестный источник подписан как CSV');
}

// ============ 2. Сопоставление колонок ============
{
  const m = SRC.autoMap(MF_HEAD.split(',')).map;
  assertEqual(m.date, 0, 'Колонка даты найдена');
  assertEqual(m.account, 1, 'Колонка счёта найдена');
  assertEqual(m.amount, 2, 'Колонка суммы найдена');
  assertEqual(m.tAccount, 6, 'Колонка «Перевод: Счёт» отдана переводу, а не основному счёту');
  assertEqual(m.tAmount, 7, 'Колонка «Перевод: Сумма» отдана переводу, а не основной сумме');
  assertEqual(m.note, 11, 'Колонка примечания найдена');

  // Неизвестные колонки не мешают и перечисляются отдельно
  const withJunk = SRC.autoMap(['Дата', 'Сумма', 'Идентификатор банка', 'Хэш']);
  assertEqual(withJunk.map.date, 0, 'Неизвестные колонки не сбивают распознавание даты');
  assertEqual(withJunk.unmapped, [2, 3], 'Нераспознанные колонки перечислены');
  assertEqual(withJunk.map.category, -1, 'Отсутствующее поле помечено как -1, а не угадано');

  // Английская локаль
  const en = SRC.autoMap(['Date', 'Account', 'Amount', 'Category', 'Note']).map;
  assertEqual([en.date, en.account, en.amount, en.category, en.note], [0, 1, 2, 3, 4], 'Английские заголовки сопоставлены');
}

// ============ 3. Сопоставление счетов ============
{
  const st = baseState();
  const r = planFor(MF_HEAD + '\n01.02.2024,ING,-10,EUR,Продукты,,,,,,,\n02.02.2024,Revolut,-20,EUR,Продукты,,,,,,,', st);
  assertEqual(r.plan.counts.newAccounts, 1, 'Существующий счёт переиспользован, создан только один новый');
  assertEqual(r.plan.newAccounts[0].name, 'Revolut', 'Новый счёт — именно отсутствующий');
  assertEqual(r.plan.items[0].tx.account, 'a_ing', 'Операция привязана к существующему счёту ING');

  // Регистр и лишние пробелы не создают дубля счёта
  const r2 = planFor(MF_HEAD + '\n01.02.2024,  ing  ,-10,EUR,Продукты,,,,,,,', baseState());
  assertEqual(r2.plan.counts.newAccounts, 0, 'Регистр и пробелы в имени счёта не создают дубликат');
  assertEqual(r2.plan.items[0].tx.account, 'a_ing', 'Счёт подобран нормализованным сравнением');

  // Явный выбор пользователя «создать новый» уважается
  const r3 = planFor(MF_HEAD + '\n01.02.2024,ING,-10,EUR,Продукты,,,,,,,', baseState(), {
    tweak: ({ accountPlan }) => { accountPlan[0].action = 'create'; accountPlan[0].targetId = null; },
  });
  assertEqual(r3.plan.counts.newAccounts, 1, 'Выбор пользователя «создать новый счёт» выполняется');
}

// ============ 4. Сопоставление категорий ============
{
  const st = baseState();
  const r = planFor(MF_HEAD + '\n01.02.2024,ING,-10,EUR,Groceries,,,,,,,\n02.02.2024,ING,-10,EUR,Хобби,,,,,,,', st);
  assertEqual(r.plan.items[0].tx.cat, 'c_food', 'Groceries сопоставлена с существующей категорией «Продукты»');
  assertEqual(r.plan.counts.newCategories, 1, 'Создана ровно одна новая категория');
  assertEqual(r.plan.newCategories[0].name, 'Хобби', 'Новая категория — «Хобби»');

  // Доход и расход с одинаковым именем — разные категории
  const r2 = planFor(MF_HEAD + '\n01.02.2024,ING,-10,EUR,Проценты,,,,,,,\n02.02.2024,ING,10,EUR,Проценты,,,,,,,', baseState());
  assertEqual(r2.plan.counts.newCategories, 2, 'Одноимённые доходная и расходная категории не склеиваются');
  assertEqual(r2.plan.newCategories.map(c => c.type).sort(), ['expense', 'income'], 'У новых категорий проставлен тип');

  // Иерархия «Категория / Подкатегория» из нашего же экспорта
  const r3 = planFor(MF_HEAD + '\n01.02.2024,ING,-10,EUR,Продукты / Супермаркеты,,,,,,,', baseState());
  assertEqual(r3.plan.items[0].tx.cat, 'c_food', 'Round-trip: категория из пути распознана, а не создана заново');
  assertEqual(r3.plan.counts.newSubcategories, 1, 'Round-trip: создана подкатегория, а не категория с именем «Продукты / Супермаркеты»');
  assertEqual(r3.plan.newSubcategories[0].name, 'Супермаркеты', 'Имя подкатегории разобрано');

  // Пустая категория не создаёт мусорных сущностей на каждую строку
  const r4 = planFor(MF_HEAD + '\n01.02.2024,ING,-10,EUR,,,,,,,,\n02.02.2024,ING,-11,EUR,,,,,,,,', baseState());
  assertEqual(r4.plan.counts.newCategories, 1, 'Строки без категории собираются в одну категорию по умолчанию');
}

// ============ 5. Переводы ============
{
  const st = baseState();
  const r = planFor(MF_HEAD + '\n03.02.2024,ING,-100,EUR,,,Наличные,100,EUR,,,снятие', st);
  assertEqual(r.plan.counts.toImport, 1, 'Перевод — ОДНА запись, а не пара доход/расход');
  const t = r.plan.items[0].tx;
  assertEqual(t.type, 'transfer', 'Тип операции — перевод');
  assertEqual(t.from, 'a_ing', 'Источник перевода — счёт со знаком минус');
  assertEqual(t.to, 'a_cash', 'Получатель перевода — счёт из колонки перевода');
  assertEqual(t.amount, 100, 'Сумма списания');
  assertEqual(t.toAmount, 100, 'Сумма зачисления');
  assertTrue(t.cat === undefined, 'У перевода нет категории — иначе он попал бы в расходы по категории');

  // Двойного учёта нет: сумма доходов и расходов в плане не изменилась
  const inc = r.plan.items.filter(i => i.tx.type === 'income').length;
  const exp = r.plan.items.filter(i => i.tx.type === 'expense').length;
  assertEqual([inc, exp], [0, 0], 'Перевод не создал ни дохода, ни расхода');

  // Мультивалютный перевод сохраняет обе суммы
  const r2 = planFor(MF_HEAD + '\n03.02.2024,ING,-100,EUR,,,Dollar,108,USD,,,', baseState());
  assertEqual(r2.plan.items[0].tx.amount, 100, 'Мультивалютный перевод: сумма списания');
  assertEqual(r2.plan.items[0].tx.toAmount, 108, 'Мультивалютный перевод: сумма зачисления в другой валюте');
  assertEqual(r2.plan.newAccounts[0].currency, '$', 'Новый счёт получил валюту из колонки перевода');

  // Перевод на тот же счёт — проблемная строка, а не операция
  const r3 = planFor(MF_HEAD + '\n03.02.2024,ING,-100,EUR,,,ING,100,EUR,,,', baseState());
  assertEqual(r3.plan.counts.toImport, 0, 'Перевод на тот же счёт не импортируется');
  assertEqual(r3.plan.problems[0].reason, IMP.PROBLEM.SAME_ACCOUNT, 'Причина проблемы названа');
}

// ============ 6. Дубликаты ============
{
  const st = baseState();
  const file = MF_HEAD +
    '\n01.02.2024,ING,-12.50,EUR,Продукты,Lidl,,,,,,кофе' +
    '\n02.02.2024,ING,-30,EUR,Продукты,,,,,,,' +
    '\n03.02.2024,ING,-100,EUR,,,Наличные,100,EUR,,,снятие';
  const first = planFor(file, st);
  assertEqual(first.plan.counts.toImport, 3, 'Первый импорт: три операции');
  assertEqual(first.plan.counts.duplicates, 0, 'Первый импорт: дубликатов нет');

  const applied = IMP.apply(st, first.plan, { source: 'Money Flow' });
  assertTrue(applied.ok, 'Первый импорт применён');
  const st2 = applied.value;

  const second = planFor(file, st2);
  assertEqual(second.plan.counts.toImport, 0, 'Повторный импорт того же файла не добавляет НИ ОДНОЙ операции');
  assertEqual(second.plan.counts.duplicates, 3, 'Все три строки распознаны как дубликаты');
  assertEqual(second.plan.counts.newAccounts, 0, 'Повторный импорт не создаёт счета заново');
  assertEqual(second.plan.counts.newCategories, 0, 'Повторный импорт не создаёт категории заново');

  // Похожие, но разные операции дубликатами не считаются
  const similar = planFor(MF_HEAD +
    '\n01.02.2024,ING,-12.51,EUR,Продукты,Lidl,,,,,,кофе' +   // другая сумма
    '\n01.02.2024,ING,-12.50,EUR,Продукты,Aldi,,,,,,кофе' +   // другой контрагент
    '\n01.03.2024,ING,-12.50,EUR,Продукты,Lidl,,,,,,кофе' +   // другая дата
    '\n01.02.2024,Наличные,-12.50,EUR,Продукты,Lidl,,,,,,кофе', st2); // другой счёт
  assertEqual(similar.plan.counts.toImport, 4, 'Похожие, но реально разные операции импортируются все');
  assertEqual(similar.plan.counts.duplicates, 0, 'Ни одна из них не принята за дубликат');

  // Два одинаковых кофе в одном файле — обе операции настоящие
  const twins = planFor(MF_HEAD +
    '\n05.02.2024,ING,-2.50,EUR,Продукты,,,,,,,' +
    '\n05.02.2024,ING,-2.50,EUR,Продукты,,,,,,,', st2);
  assertEqual(twins.plan.counts.toImport, 2, 'Две одинаковые строки в одном файле — две операции (мультимножество, а не Set)');

  // ...но после их импорта повтор того же файла уже полностью дубликатный
  const afterTwins = IMP.apply(st2, twins.plan, {});
  const twinsAgain = planFor(MF_HEAD +
    '\n05.02.2024,ING,-2.50,EUR,Продукты,,,,,,,' +
    '\n05.02.2024,ING,-2.50,EUR,Продукты,,,,,,,', afterTwins.value);
  assertEqual(twinsAgain.plan.counts.duplicates, 2, 'Обе одинаковые операции найдены как дубликаты при повторе');

  // Перевод сравнивается вместе со счётом-получателем
  const st3 = afterTwins.value;
  const otherTarget = planFor(MF_HEAD + '\n03.02.2024,ING,-100,EUR,,,Revolut,100,EUR,,,снятие', st3);
  assertEqual(otherTarget.plan.counts.duplicates, 0, 'Перевод той же суммы на ДРУГОЙ счёт — не дубликат');

  // Выключенный пропуск дубликатов
  const noSkip = planFor(file, st3, { skipDuplicates: false });
  assertTrue(noSkip.plan.counts.toImport >= 3, 'При отключённом пропуске дубликаты импортируются');
}

// ============ 7. Проблемные строки и валюты ============
{
  const r = planFor(MF_HEAD +
    '\nне дата,ING,-10,EUR,Продукты,,,,,,,' +
    '\n01.02.2024,ING,абв,EUR,Продукты,,,,,,,' +
    '\n01.02.2024,ING,0,EUR,Продукты,,,,,,,' +
    '\n01.02.2024,ING,-10,XYZ,Продукты,,,,,,,' +
    '\n31.02.2024,ING,-10,EUR,Продукты,,,,,,,', baseState());
  assertEqual(r.plan.counts.problems, 4, 'Битая дата, битая сумма, ноль и 31 февраля отбракованы');
  assertEqual(r.plan.counts.toImport, 1, 'Строка с неизвестной валютой импортируется');
  assertEqual(r.plan.counts.warnings, 1, 'Неизвестная валюта отмечена предупреждением, а не молча подменена');
  assertEqual(r.plan.items[0].tx.currency, '€', 'При неизвестной валюте берётся базовая валюта');
  assertTrue(r.plan.problems.every(p => !!p.reason), 'У каждой проблемной строки названа причина');
  assertTrue(r.plan.problems.every(p => p.row >= 2), 'Номер строки учитывает заголовок');
}

// ============ 8. Даты ============
{
  assertEqual(IMP.parseDate('01.02.2024'), '2024-02-01', 'ДД.ММ.ГГГГ');
  assertEqual(IMP.parseDate('2024-02-01'), '2024-02-01', 'ГГГГ-ММ-ДД');
  assertEqual(IMP.parseDate('2024-02-01 15:33'), '2024-02-01', 'Дата со временем');
  assertEqual(IMP.parseDate('01/13/2024'), '2024-13-01' === '2024-13-01' ? '2024-01-13' : null, 'Явный US-порядок распознан по месяцу > 12');
  assertEqual(IMP.parseDate('01.02.24'), '2024-02-01', 'Двузначный год');
  assertEqual(IMP.parseDate('1 фев 2024'), '2024-02-01', 'Русское название месяца');
  assertEqual(IMP.parseDate('31.02.2024'), null, '31 февраля — не дата');
  assertEqual(IMP.parseDate(''), null, 'Пустая дата');
  assertEqual(IMP.parseDate('мусор'), null, 'Нераспознаваемая дата');
  // Локальная дата не сдвигается часовым поясом
  assertEqual(IMP.parseDate('2024-01-01'), '2024-01-01', 'Первое января не уезжает на 31 декабря');
}

// ============ 9. Атомарность ============
{
  // Ошибка разбора → плана нет → база не тронута
  const st = baseState();
  const bad = planFor('', st);
  assertTrue(!!bad.parseError, 'Пустой файл: разбор завершается ошибкой');
  assertEqual(st.tx.length, 0, 'Ошибка разбора: ни одной операции не добавлено');
  assertEqual(st.accounts.length, 2, 'Ошибка разбора: счета не созданы');
  assertEqual(st.cats.length, 2, 'Ошибка разбора: категории не созданы');

  // Построение плана НИЧЕГО не меняет в исходном состоянии
  const st2 = baseState();
  const before = JSON.stringify(st2);
  planFor(MF_HEAD + '\n01.02.2024,Новый счёт,-10,EUR,Новая категория,,,,,,,', st2);
  assertEqual(JSON.stringify(st2), before, 'buildPlan не меняет состояние: ни операций, ни счетов, ни категорий');

  // Провал валидации → apply не возвращает состояния
  const st3 = baseState();
  const good = planFor(MF_HEAD + '\n01.02.2024,ING,-10,EUR,Продукты,,,,,,,', st3);
  const brokenPlan = JSON.parse(JSON.stringify(good.plan));
  brokenPlan.items[0].tx.account = 'нет такого счёта';
  const res = IMP.apply(st3, brokenPlan, {});
  assertEqual(res.ok, false, 'Валидация ловит ссылку на несуществующий счёт');
  assertEqual(res.error.code, 'VALIDATION_FAILED', 'Код ошибки валидации');
  assertEqual(st3.tx.length, 0, 'Провал валидации: база не изменена');
  assertTrue(res.error.message.indexOf('не изменены') > 0, 'Сообщение говорит, что данные не изменены');

  const brokenAmt = JSON.parse(JSON.stringify(good.plan));
  brokenAmt.items[0].tx.amount = NaN;
  assertEqual(IMP.apply(st3, brokenAmt, {}).ok, false, 'Валидация ловит нечисловую сумму');

  const dupId = JSON.parse(JSON.stringify(good.plan));
  dupId.items[0].tx.id = 'занятый';
  const st4 = baseState(); st4.tx.push({ id: 'занятый', type: 'expense', amount: 1, date: '2024-01-01', account: 'a_ing', cat: 'c_food' });
  assertEqual(IMP.apply(st4, dupId, {}).ok, false, 'Валидация ловит повторяющийся id операции');
  assertEqual(st4.tx.length, 1, 'Повторный id: база не изменена');

  // Успешный apply возвращает НОВОЕ состояние, исходное не трогает
  const st5 = baseState();
  const ok = planFor(MF_HEAD + '\n01.02.2024,ING,-10,EUR,Продукты,,,,,,,', st5);
  const applied = IMP.apply(st5, ok.plan, { source: 'Money Flow', fileName: 'test.csv' });
  assertTrue(applied.ok, 'Корректный план применяется');
  assertEqual(st5.tx.length, 0, 'apply() не мутирует исходное состояние — откат это и обеспечивает');
  assertEqual(applied.value.tx.length, 1, 'В новом состоянии появилась операция');
  assertEqual(applied.value.importBatches.length, 1, 'Записан журнал импорта');
  assertEqual(applied.value.importBatches[0].source, 'Money Flow', 'В журнале сохранён источник');
  assertEqual(applied.value.tx[0].importBatchId, ok.plan.batchId, 'Операция помечена идентификатором импорта');

  // Пустой план не применяется
  const empty = IMP.apply(baseState(), { batchId: 'x', items: [], problems: [], warnings: [], duplicates: 0,
    newAccounts: [], newCategories: [], newSubcategories: [] }, {});
  assertEqual(empty.ok, false, 'Пустой план не применяется');
  assertEqual(empty.error.code, 'NOTHING_TO_IMPORT', 'Код «нечего импортировать»');
}

// ============ 10. Отмена импорта ============
{
  const st = baseState();
  const r = planFor(MF_HEAD +
    '\n01.02.2024,Revolut,-10,EUR,Хобби,,,,,,,' +
    '\n02.02.2024,ING,-20,EUR,Продукты,,,,,,,', st);
  const applied = IMP.apply(st, r.plan, {});
  const after = applied.value;
  assertEqual([after.tx.length, after.accounts.length, after.cats.length], [2, 3, 3], 'После импорта: 2 операции, новый счёт и новая категория');

  const undone = IMP.undo(after, r.plan.batchId);
  assertTrue(undone.ok, 'Отмена импорта выполнена');
  assertEqual(undone.value.state.tx.length, 0, 'Отмена удалила импортированные операции');
  assertEqual(undone.value.state.accounts.length, 2, 'Отмена удалила созданный импортом счёт');
  assertEqual(undone.value.state.cats.length, 2, 'Отмена удалила созданную импортом категорию');
  assertEqual(undone.value.state.importBatches.length, 0, 'Запись журнала импорта убрана');
  assertEqual(undone.value.removedTx, 2, 'Отмена сообщает, сколько операций удалено');

  // Чужие операции отмена не трогает, а созданные импортом сущности,
  // на которые они ссылаются, сохраняются
  const mixed = JSON.parse(JSON.stringify(after));
  const importedAcc = mixed.accounts.find(a => a.importBatchId === r.plan.batchId).id;
  const importedCat = mixed.cats.find(c => c.importBatchId === r.plan.batchId).id;
  mixed.tx.push({ id: 'моя', type: 'expense', amount: 5, date: '2024-03-01', account: importedAcc, cat: importedCat });
  const undone2 = IMP.undo(mixed, r.plan.batchId);
  assertEqual(undone2.value.state.tx.length, 1, 'Собственная операция пользователя не удалена');
  assertEqual(undone2.value.state.tx[0].id, 'моя', 'Уцелела именно она');
  assertTrue(!!undone2.value.state.accounts.find(a => a.id === importedAcc), 'Счёт сохранён — на него ссылается операция пользователя');
  assertTrue(!!undone2.value.state.cats.find(c => c.id === importedCat), 'Категория сохранена — на неё ссылается операция пользователя');

  assertEqual(IMP.undo(after, null).ok, false, 'Отмена без идентификатора отклоняется');
  assertEqual(IMP.undo(after, 'нет такого').value.removedTx, 0, 'Отмена несуществующего импорта ничего не удаляет');
}

// ============ 11. Отпечаток операции ============
{
  const t = { type: 'expense', date: '2024-02-01', amount: 12.5, currency: '€', account: 'a1', cat: 'c1', payee: 'Lidl' };
  assertEqual(IMP.fingerprint(t), IMP.fingerprint(Object.assign({}, t)), 'Одинаковые операции дают одинаковый отпечаток');
  assertTrue(IMP.fingerprint(t) !== IMP.fingerprint(Object.assign({}, t, { amount: 12.51 })), 'Сумма входит в отпечаток');
  assertTrue(IMP.fingerprint(t) !== IMP.fingerprint(Object.assign({}, t, { account: 'a2' })), 'Счёт входит в отпечаток');
  assertTrue(IMP.fingerprint(t) !== IMP.fingerprint(Object.assign({}, t, { cat: 'c2' })), 'Категория входит в отпечаток');
  assertTrue(IMP.fingerprint(t) !== IMP.fingerprint(Object.assign({}, t, { payee: 'Aldi' })), 'Контрагент входит в отпечаток');
  assertTrue(IMP.fingerprint(t) !== IMP.fingerprint(Object.assign({}, t, { date: '2024-02-02' })), 'Дата входит в отпечаток');
  assertEqual(IMP.fingerprint(Object.assign({}, t, { payee: '  LIDL ' })), IMP.fingerprint(t), 'Регистр и пробелы контрагента не создают ложного различия');
  const tr = { type: 'transfer', date: '2024-02-01', amount: 100, toAmount: 100, from: 'a1', to: 'a2' };
  assertTrue(IMP.fingerprint(tr) !== IMP.fingerprint(Object.assign({}, tr, { to: 'a3' })), 'Счёт-получатель входит в отпечаток перевода');
}

// ============ 12. Разделитель «;» и колонки доход/расход ============
{
  const st = baseState();
  const text = 'Дата;Счёт;Доход;Расход;Категория\n01.02.2024;ING;;12,50;Продукты\n02.02.2024;ING;1000;;Зарплата';
  const parsed = CSV.parse(text);
  const mapping = SRC.autoMap(parsed.value.header).map;
  const plan = IMP.buildPlan({ body: parsed.value.body, mapping, state: st,
    accountPlan: MAP.buildAccountPlan(IMP.collectAccountNames(parsed.value.body, mapping), st.accounts),
    categoryPlan: MAP.buildCategoryPlan(IMP.collectCategoryEntries(parsed.value.body, mapping), st.cats) });
  assertEqual(plan.counts.toImport, 2, 'Файл с раздельными колонками дохода и расхода импортируется');
  assertEqual(plan.items[0].tx.type, 'expense', 'Колонка «Расход» даёт расход');
  assertEqual(plan.items[0].tx.amount, 12.5, 'Запятая как десятичный разделитель разобрана');
  assertEqual(plan.items[1].tx.type, 'income', 'Колонка «Доход» даёт доход');
  assertEqual(plan.items[1].tx.cat, 'c_sal', 'Доходная категория подобрана среди доходных');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
