// tests/backup_service.test.js — резервные копии .afb (TASK_038).
// Запуск: node tests/backup_service.test.js
//
// Ключевые инварианты:
//   1. старые копии ({app,data}) и «голый» state читаются по-прежнему —
//      обратная совместимость важнее любого нового поля конверта;
//   2. повреждённый файл НЕ восстанавливается (контрольная сумма);
//   3. копия из более новой версии отклоняется с понятным сообщением,
//      а не «восстанавливается» с молчаливой потерей полей;
//   4. inspect() ничего не восстанавливает — только читает.
global.window = global;
['../js/core/result.js', '../js/core/ids.js', '../js/core/app_info.js',
 '../js/database/store.js', '../js/services/backup_service.js'].forEach(f => require(f));
const B = AF.Services.Backup;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) { if (cond) passed++; else { failed++; console.error(`FAIL: ${msg}`); } }

function sample() {
  return {
    schemaVersion: 3, currency: '€', theme: 'dark', profileName: 'Alex',
    tx: [
      { id: 't1', type: 'expense', amount: 12.5, date: '2024-02-01', account: 'a1', cat: 'c1', payee: 'Lidl' },
      { id: 't2', type: 'transfer', amount: 100, toAmount: 100, date: '2024-02-03', from: 'a1', to: 'a2' },
    ],
    accounts: [{ id: 'a1', name: 'ING', currency: '€' }, { id: 'a2', name: 'Наличные', currency: '€' }],
    accountGroups: [{ id: 'ag1', name: 'Основные' }],
    cats: [{ id: 'c1', name: 'Продукты', type: 'expense' }],
    subcats: [{ id: 's1', categoryId: 'c1', name: 'Супермаркеты' }],
    budgets: { c1: 400 },
    goals: [{ id: 'gl1', name: 'Отпуск', targetAmount: 1000 }],
    reminders: [{ id: 'r1', title: 'Аренда' }],
    healthHistory: [{ date: '2024-02-01', score: 71 }],
    rates: { $: 1.08 }, settings: { security: { lockDelay: 60 } },
    groupCollapsed: { ag1: true }, hideAmounts: false, pinHash: 'abc', taxonomyVersion: 2,
    importBatches: [], lastBackup: 1700000000000,
  };
}

// ============ 1. Конверт ============
{
  const st = sample();
  const file = B.create(st, { appVersion: '1.0.0', createdAt: 1700000000001 });
  const p = JSON.parse(file);
  assertEqual(p.format, 'alex-finance-backup', 'В конверте есть идентификатор формата');
  assertEqual(p.app, 'Alex Finance', 'Ключ старого формата app сохранён для совместимости');
  assertEqual(p.backupVersion, 2, 'Версия конверта');
  assertEqual(p.schemaVersion, 3, 'Версия схемы данных');
  assertEqual(p.appVersion, '1.0.0', 'Версия приложения');
  assertEqual(p.createdAt, 1700000000001, 'Время создания');
  assertEqual(p.checksum.algo, 'fnv1a32', 'Алгоритм контрольной суммы указан');
  assertTrue(/^[0-9a-f]{8}$/.test(p.checksum.value), 'Контрольная сумма — 8 hex-символов');
  assertEqual(p.counts.tx, 2, 'В конверте перечислены счётчики: операции');
  assertEqual(p.counts.accounts, 2, 'В конверте перечислены счётчики: счета');
}

// ============ 2. Полнота копии ============
{
  const st = sample();
  const back = JSON.parse(B.create(st)).data;
  // .afb — полная копия приложения: все пользовательские сущности состояния
  ['tx', 'accounts', 'accountGroups', 'cats', 'subcats', 'budgets', 'goals', 'reminders',
   'healthHistory', 'rates', 'settings', 'groupCollapsed', 'theme', 'currency', 'profileName',
   'hideAmounts', 'pinHash', 'taxonomyVersion', 'importBatches', 'lastBackup'].forEach(k => {
    assertEqual(JSON.stringify(back[k]), JSON.stringify(st[k]), 'Копия содержит ' + k);
  });
  assertEqual(Object.keys(back).sort(), Object.keys(st).sort(), 'В копии нет ни одного потерянного ключа состояния');
}

// ============ 3. Контрольная сумма ============
{
  const st = sample();
  const file = B.create(st);
  assertTrue(B.inspect(file).ok, 'Целая копия проходит проверку');
  assertEqual(B.inspect(file).value.info.checksumChecked, true, 'Целостность проверена');

  const broken = file.replace('"amount": 12.5', '"amount": 125');
  assertTrue(broken !== file, 'Подготовлен повреждённый файл');
  const res = B.inspect(broken);
  assertEqual(res.ok, false, 'Повреждённая копия отклонена');
  assertEqual(res.error.code, B.ERROR.CHECKSUM_MISMATCH, 'Код ошибки — несовпадение контрольной суммы');

  // Порядок ключей не влияет на сумму (канонизация). JSON.parse не обещает
  // сохранять порядок, и сумма «по как получилось» разошлась бы сама с собой.
  const src = JSON.parse(file).data;
  const reordered = {};
  Object.keys(src).reverse().forEach(k => { reordered[k] = src[k]; });
  assertEqual(Object.keys(reordered), Object.keys(src).reverse(), 'Подготовлен объект с обратным порядком ключей');
  assertEqual(B.checksum(reordered), B.checksum(src), 'Контрольная сумма не зависит от порядка ключей');

  // Обрезанный файл
  assertEqual(B.inspect(file.slice(0, file.length / 2)).error.code, B.ERROR.NOT_JSON, 'Обрезанный файл — не JSON');
}

// ============ 4. Обратная совместимость ============
{
  const st = sample();
  // старый формат TASK_026 и раньше
  const legacy = JSON.stringify({ app: 'Alex Finance', schemaVersion: 2, createdAt: 1600000000000, data: st });
  const r1 = B.inspect(legacy);
  assertTrue(r1.ok, 'Старая копия {app,data} читается');
  assertEqual(r1.value.info.legacy, true, 'Старая копия помечена как legacy');
  assertEqual(r1.value.info.backupVersion, 1, 'Версия конверта старой копии = 1');
  assertEqual(r1.value.info.counts.tx, 2, 'Счётчики старой копии посчитаны по содержимому');
  assertTrue(r1.value.info.warnings.length > 0, 'Пользователь предупреждён об отсутствии контрольной суммы');
  assertTrue(B.restore(legacy).ok, 'Старая копия восстанавливается');

  // «голый» state без конверта
  const bare = JSON.stringify(st);
  assertTrue(B.inspect(bare).ok, '«Голый» state читается как копия');
  assertEqual(B.inspect(bare).value.info.format, 'bare-state', 'Формат «голого» state опознан');
  assertTrue(B.restore(bare).ok, '«Голый» state восстанавливается');

  // восстановление старой схемы проходит через migrate
  const old = JSON.parse(JSON.stringify(st));
  delete old.schemaVersion; delete old.importBatches; delete old.settings;
  const restored = B.restore(JSON.stringify({ app: 'Alex Finance', data: old }));
  assertTrue(restored.ok, 'Копия старой схемы восстанавливается');
  assertEqual(restored.value.schemaVersion, AF.Store.SCHEMA_VERSION, 'Схема приведена к текущей версии');
  assertTrue(Array.isArray(restored.value.importBatches), 'Отсутствовавший ключ importBatches нормализован');
  assertEqual(restored.value.tx.length, 2, 'Операции старой копии не потеряны');
}

// ============ 5. Несовместимые и битые файлы ============
{
  const st = sample();
  assertEqual(B.inspect('').error.code, B.ERROR.EMPTY, 'Пустой файл');
  assertEqual(B.inspect('   ').error.code, B.ERROR.EMPTY, 'Файл из пробелов');
  assertEqual(B.inspect('не json').error.code, B.ERROR.NOT_JSON, 'Не JSON');
  assertEqual(B.inspect('{"a":1,}').error.code, B.ERROR.NOT_JSON, 'Битый JSON');
  assertEqual(B.inspect('[1,2,3]').error.code, B.ERROR.NOT_BACKUP, 'Массив — не копия');
  assertEqual(B.inspect('{"hello":"world"}').error.code, B.ERROR.NOT_BACKUP, 'Чужой JSON — не копия');
  assertEqual(B.inspect(JSON.stringify({ data: { tx: [] } })).error.code, B.ERROR.BROKEN_SCHEMA, 'Копия без счетов — повреждённая схема');

  const future = JSON.stringify({ format: B.FORMAT, backupVersion: 99, schemaVersion: 3, data: st });
  assertEqual(B.inspect(future).error.code, B.ERROR.FUTURE_BACKUP, 'Копия с новым форматом конверта отклонена');
  assertTrue(B.inspect(future).error.message.indexOf('Обновите') > 0, 'Сообщение подсказывает обновить приложение');

  const futureSchema = JSON.stringify({ format: B.FORMAT, backupVersion: 2, schemaVersion: 99, data: st });
  assertEqual(B.inspect(futureSchema).error.code, B.ERROR.FUTURE_SCHEMA, 'Копия с новой схемой данных отклонена');

  assertEqual(B.restore('не json').ok, false, 'restore() отклоняет мусор');
  assertTrue(typeof B.restore('не json').error === 'string', 'restore() сохраняет прежний контракт ошибки-строки');
}

// ============ 6. inspect() ничего не меняет ============
{
  const st = sample();
  const file = B.create(st);
  const before = JSON.stringify(st);
  const res = B.inspect(file);
  assertEqual(JSON.stringify(st), before, 'inspect() не трогает текущее состояние');
  assertTrue(res.value.data !== st, 'inspect() возвращает содержимое файла, а не текущее состояние');
  assertEqual(res.value.info.counts.tx, 2, 'Счётчики из файла');
  // миграция — отдельный шаг, выполняется только перед записью
  const mig = B.migrateBackup(res.value.data);
  assertTrue(mig.ok, 'migrateBackup() приводит копию к текущей схеме');
  assertEqual(mig.value.tx.length, 2, 'После миграции операции на месте');
}

// ============ 7. Круговой рейс ============
{
  const st = sample();
  const restored = B.restore(B.create(st));
  assertTrue(restored.ok, 'create → restore проходит');
  ['tx', 'accounts', 'cats', 'subcats', 'goals', 'reminders', 'accountGroups'].forEach(k => {
    assertEqual(restored.value[k].length, st[k].length, 'Круговой рейс сохраняет количество: ' + k);
  });
  assertEqual(restored.value.budgets, st.budgets, 'Круговой рейс сохраняет бюджеты');
  assertEqual(restored.value.rates, st.rates, 'Круговой рейс сохраняет курсы валют');
  assertEqual(restored.value.settings.security.lockDelay, 60, 'Круговой рейс сохраняет настройки безопасности');
  assertEqual(restored.value.tx[1].type, 'transfer', 'Круговой рейс сохраняет переводы');
  assertEqual(restored.value.theme, 'dark', 'Круговой рейс сохраняет тему');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
