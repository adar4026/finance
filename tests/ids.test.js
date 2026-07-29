// tests/ids.test.js — юнит-тесты генератора идентификаторов (TASK_026, M-8).
// Запуск: node tests/ids.test.js
//
// Проверяется то, из-за чего заводилась правка: до TASK_026 сосуществовали
// три схемы генерации, две сущности могли получить один id в пределах одной
// миллисекунды, а разные типы сущностей делили префикс 'g'.
global.window = global;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// Загружаем сервис при доступном crypto (штатное окружение браузера).
require('../js/core/ids.js');
const Ids = AF.Ids;

// ============ 1. Уникальность ============
{
  const ids = [];
  for (let i = 0; i < 5000; i++) ids.push(Ids.newId('t'));
  assertEqual(new Set(ids).size, ids.length, '5000 id подряд — все уникальны');
  assertTrue(ids.every(id => typeof id === 'string' && id.length > 0), 'Все id — непустые строки');
  assertTrue(ids.every(id => id.indexOf('t') === 0), 'Префикс сохраняется');

  // ключевой сценарий M-8: несколько сущностей в одну миллисекунду
  const realNow = Date.now;
  Date.now = () => 1770000000000;             // время «застыло»
  const same = [];
  for (let i = 0; i < 1000; i++) same.push(Ids.newId('t'));
  Date.now = realNow;
  assertEqual(new Set(same).size, same.length, '1000 id, созданных в ОДНУ миллисекунду, уникальны');
}

// ============ 2. Разные типы сущностей не сталкиваются ============
{
  assertTrue(Ids.PREFIX.goal !== Ids.PREFIX.accountGroup,
    'Цель и группа счетов имеют разные префиксы (раньше обе начинались с g)');
  const vals = Object.keys(Ids.PREFIX).map(k => Ids.PREFIX[k]);
  assertEqual(vals.length, new Set(vals).size, 'Все префиксы типов различны');

  const state = { tx: [], accounts: [], accountGroups: [], cats: [], subcats: [], goals: [], reminders: [] };
  const made = [Ids.forTx(state), Ids.forAccount(state), Ids.forAccountGroup(state),
    Ids.forCategory(state), Ids.forSubcategory(state), Ids.forGoal(state), Ids.forReminder(state)];
  assertEqual(new Set(made).size, made.length, 'По одному id каждого типа — все различны');
}

// ============ 3. unique(): нет коллизии внутри коллекции ============
{
  // Коллекция «уже занимает» всё, что предложит генератор, кроме одного варианта.
  const collection = [{ id: 'x1' }, { id: 'x2' }];
  const id = Ids.unique('t', collection);
  assertTrue(id !== 'x1' && id !== 'x2', 'unique() не возвращает занятый id (массив сущностей)');

  assertTrue(Ids.unique('t', ['a', 'b']) !== 'a', 'unique() принимает массив самих id');
  assertTrue(Ids.unique('t', new Set(['a'])) !== 'a', 'unique() принимает Set');
  assertTrue(typeof Ids.unique('t', { a: 1 }) === 'string', 'unique() принимает объект-словарь');

  // предикат: первые два предложения объявляем занятыми
  let n = 0;
  const taken = () => (++n <= 2);
  const got = Ids.unique('t', taken);
  assertTrue(typeof got === 'string' && n === 3, 'unique() повторяет генерацию, пока id занят (предикат)');

  // патологический случай: занято всё → всё равно возвращается непустой id
  const always = Ids.unique('t', () => true);
  assertTrue(typeof always === 'string' && always.length > 10, 'При «всё занято» unique() возвращает запасной UUID-id');

  const state = { tx: [{ id: 'q' }] };
  const forTx = Ids.forTx(state);
  assertTrue(forTx !== 'q', 'forTx() учитывает существующие операции');
  assertTrue(Ids.forTx({}) && Ids.forTx(null), 'Генераторы устойчивы к пустому/отсутствующему состоянию');
}

// ============ 4. uuid() и fallback без crypto.randomUUID ============
{
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assertTrue(re.test(Ids.uuid()), 'uuid() при доступном crypto.randomUUID даёт корректный UUID v4');

  // окружение БЕЗ randomUUID, но с getRandomValues
  const realCrypto = global.crypto;
  const gv = realCrypto && realCrypto.getRandomValues ? realCrypto.getRandomValues.bind(realCrypto) : null;
  Object.defineProperty(global, 'crypto', { value: { getRandomValues: gv }, configurable: true, writable: true });
  delete require.cache[require.resolve('../js/core/ids.js')];
  require('../js/core/ids.js');
  const noUuid = AF.Ids;
  assertTrue(re.test(noUuid.uuid()), 'Fallback UUID корректен без crypto.randomUUID()');
  const set = new Set(); for (let i = 0; i < 2000; i++) set.add(noUuid.newId('t'));
  assertEqual(set.size, 2000, 'newId() без crypto.randomUUID() по-прежнему уникален');

  // окружение вообще без crypto (старый Safari, http-контекст)
  Object.defineProperty(global, 'crypto', { value: undefined, configurable: true, writable: true });
  delete require.cache[require.resolve('../js/core/ids.js')];
  require('../js/core/ids.js');
  const noCrypto = AF.Ids;
  assertTrue(re.test(noCrypto.uuid()), 'Fallback UUID корректен вообще без crypto');
  const set2 = new Set(); for (let i = 0; i < 2000; i++) set2.add(noCrypto.newId('a'));
  assertEqual(set2.size, 2000, 'newId() работает вообще без crypto');
  assertTrue(typeof noCrypto.unique('c', []) === 'string', 'unique() работает вообще без crypto');

  Object.defineProperty(global, 'crypto', { value: realCrypto, configurable: true, writable: true });
  delete require.cache[require.resolve('../js/core/ids.js')];
  require('../js/core/ids.js');
}

// ============ 5. Форма id пригодна для существующих сравнений ============
{
  // index.html сравнивает id нестрого (t.id != editId), потому что значение
  // приходит из dataset строкой. Проверяем, что новый формат этому не вредит
  // и что старые числовые id пользователя продолжают сравниваться как раньше
  // (массовая миграция id в TASK_026 намеренно не делается).
  const id = AF.Ids.newId('t');
  assertTrue(id == String(id), 'Строковый id корректно сравнивается со своим представлением из dataset');
  assertTrue(!/[^A-Za-z0-9_-]/.test(id), 'id состоит только из безопасных символов (годится для data-атрибутов и CSS-селекторов)');
  const legacyNumeric = 1753000000000;
  assertTrue(legacyNumeric == String(legacyNumeric), 'Старые числовые id продолжают сравниваться нестрого, как раньше');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
