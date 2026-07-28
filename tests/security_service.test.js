// tests/security_service.test.js — юнит-тесты для js/services/security_service.js (TASK_023).
// Проверяются именно правила, от которых зависит РЕАЛЬНАЯ безопасность экрана:
//  1. нормализация настроек (в т.ч. через restore/импорт — единственная точка);
//  2. инвариант «биометрия невозможна без защитного кода»;
//  3. решение о блокировке по настройке «Запрашивать» (включая fail-secure).
// Запуск: node tests/security_service.test.js
global.window = global;
require('../js/services/security_service.js');
const S = AF.Services.Security;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

const MIN = 60000;

// ============ 1. Список вариантов «Запрашивать» ============
{
  assertTrue(Array.isArray(S.LOCK_DELAYS) && S.LOCK_DELAYS.length >= 2, 'LOCK_DELAYS — непустой список');
  assertEqual(S.LOCK_DELAYS[0], { value: 0, label: 'Сразу' }, 'Первый вариант — «Сразу» (0 мс), как требует постановка');
  assertTrue(S.LOCK_DELAYS.every(d => typeof d.value === 'number' && d.value >= 0), 'Все задержки — неотрицательные числа');
  assertTrue(S.LOCK_DELAYS.every(d => typeof d.label === 'string' && d.label.length > 0), 'У каждого варианта есть подпись');
  const vals = S.LOCK_DELAYS.map(d => d.value);
  assertEqual(vals.length, new Set(vals).size, 'Значения задержек не повторяются');
  assertEqual(vals.slice().sort((a, b) => a - b), vals, 'Варианты идут по возрастанию');
  assertTrue(S.LOCK_DELAYS.every(d => S.isKnownDelay(d.value)), 'isKnownDelay() распознаёт все варианты списка');
  assertTrue(!S.isKnownDelay(777), 'isKnownDelay() отвергает произвольное значение');
  assertTrue(!S.isKnownDelay('0'), 'isKnownDelay() отвергает строку');
}

// ============ 2. lockDelayLabel ============
{
  assertEqual(S.lockDelayLabel(0), 'Сразу', 'Подпись для 0 — «Сразу»');
  assertEqual(S.lockDelayLabel(5 * MIN), S.LOCK_DELAYS.find(d => d.value === 5 * MIN).label, 'Подпись для 5 минут берётся из списка');
  assertEqual(S.lockDelayLabel(999), 'Сразу', 'Неизвестное значение подписывается как «Сразу» (безопасный дефолт)');
  assertEqual(S.lockDelayLabel(undefined), 'Сразу', 'undefined подписывается как «Сразу»');
}

// ============ 3. defaults ============
{
  assertEqual(S.defaults(), { lockDelay: 0, biometric: false, bioCredId: null, lastActiveAt: null },
    'Безопасные значения по умолчанию: код спрашивается сразу, биометрия выключена');
  const a = S.defaults(); a.lockDelay = 999;
  assertEqual(S.defaults().lockDelay, 0, 'defaults() возвращает новый объект (не общий мутируемый)');
}

// ============ 4. normalize: чистое состояние ============
{
  const st = {};
  const sec = S.normalize(st);
  assertEqual(sec, S.defaults(), 'Пустое состояние → значения по умолчанию');
  assertTrue(st.settings && st.settings.security === sec, 'normalize() кладёт блок в state.settings.security');
}
{
  const st = { settings: null };
  S.normalize(st);
  assertTrue(!!st.settings && typeof st.settings === 'object', 'settings=null восстанавливается в объект');
}
{
  assertEqual(S.normalize(null), S.defaults(), 'normalize(null) не падает и возвращает дефолты');
  assertEqual(S.normalize(undefined), S.defaults(), 'normalize(undefined) не падает');
}

// ============ 5. normalize: lockDelay ============
{
  const st = { settings: { security: { lockDelay: 5 * MIN } } };
  assertEqual(S.normalize(st).lockDelay, 5 * MIN, 'Известная задержка сохраняется');
}
{
  const st = { settings: { security: { lockDelay: 123456 } } };
  assertEqual(S.normalize(st).lockDelay, 0, 'Неизвестная задержка сбрасывается к «Сразу» (безопаснее)');
}
{
  const st = { settings: { security: { lockDelay: '60000' } } };
  assertEqual(S.normalize(st).lockDelay, 0, 'Задержка-строка отвергается');
}

// ============ 6. normalize: инвариант «биометрия только с защитным кодом» ============
{
  const st = { pinHash: 'h', settings: { security: { biometric: true, bioCredId: 'abc' } } };
  const sec = S.normalize(st);
  assertTrue(sec.biometric === true && sec.bioCredId === 'abc', 'Код + ключ + флаг → биометрия включена');
}
{
  const st = { settings: { security: { biometric: true, bioCredId: 'abc' } } }; // кода нет
  const sec = S.normalize(st);
  assertTrue(sec.biometric === false && sec.bioCredId === null,
    'Без защитного кода биометрия гасится, ключ удаляется (не переживает restore/импорт/правку localStorage)');
}
{
  const st = { pinHash: 'h', settings: { security: { biometric: true } } }; // ключа нет
  assertEqual(S.normalize(st).biometric, false, 'Флаг биометрии без сохранённого ключа не считается включённым');
}
{
  const st = { pinHash: 'h', settings: { security: { biometric: 'yes', bioCredId: 'abc' } } };
  assertEqual(S.normalize(st).biometric, false, 'biometric принимается только как строгий true');
}
{
  const st = { pinHash: 'h', settings: { security: { biometric: true, bioCredId: '' } } };
  assertTrue(S.normalize(st).bioCredId === null, 'Пустая строка ключа приводится к null');
}

// ============ 7. normalize: lastActiveAt ============
{
  const st = { pinHash: 'h', settings: { security: { lastActiveAt: 1700000000000 } } };
  assertEqual(S.normalize(st).lastActiveAt, 1700000000000, 'Корректная отметка времени сохраняется');
}
[0, -5, NaN, Infinity, '123', null, {}].forEach(bad => {
  const st = { pinHash: 'h', settings: { security: { lastActiveAt: bad } } };
  assertEqual(S.normalize(st).lastActiveAt, null, `Некорректная отметка времени (${String(bad)}) → null (блокируем)`);
});

// ============ 8. normalize: идемпотентность и невмешательство ============
{
  const st = { pinHash: 'h', settings: { security: { lockDelay: 15 * MIN, biometric: true, bioCredId: 'k', lastActiveAt: 111 } } };
  const a = JSON.stringify(S.normalize(st));
  const b = JSON.stringify(S.normalize(st));
  const c = JSON.stringify(S.normalize(st));
  assertTrue(a === b && b === c, 'normalize() идемпотентна (повторный вызов ничего не меняет)');
}
{
  const st = { pinHash: 'hash-value', theme: 'dark', currency: '€', hideAmounts: true,
    settings: { notifEnabled: true, someOther: { a: 1 } } };
  S.normalize(st);
  assertEqual(st.pinHash, 'hash-value', 'normalize() не трогает state.pinHash');
  assertEqual(st.settings.notifEnabled, true, 'normalize() не трогает чужие ключи settings');
  assertEqual(st.settings.someOther, { a: 1 }, 'normalize() не трогает вложенные чужие настройки');
  assertEqual(st.hideAmounts, true, 'normalize() не трогает hideAmounts');
  assertEqual(st.theme, 'dark', 'normalize() не трогает тему');
}
{
  // Мусор вместо блока настроек не должен ронять приложение
  [null, 'x', 42, [], undefined].forEach(bad => {
    const st = { settings: { security: bad } };
    assertEqual(S.normalize(st), S.defaults(), `Мусор вместо блока настроек (${JSON.stringify(bad)}) → дефолты`);
  });
}

// ============ 9. read ============
{
  assertEqual(S.read({}), S.defaults(), 'read() без блока настроек возвращает дефолты');
  assertEqual(S.read(null), S.defaults(), 'read(null) не падает');
  const st = { settings: { security: { lockDelay: MIN } } };
  assertEqual(S.read(st).lockDelay, MIN, 'read() возвращает сохранённый блок как есть');
}

// ============ 10. applyPasscodeOff ============
{
  const out = S.applyPasscodeOff({ lockDelay: 5 * MIN, biometric: true, bioCredId: 'k', lastActiveAt: 5 });
  assertEqual(out.biometric, false, 'Снятие защитного кода гасит биометрию');
  assertEqual(out.bioCredId, null, 'Снятие защитного кода удаляет сохранённый ключ');
  assertEqual(out.lockDelay, 5 * MIN, 'Настройка «Запрашивать» при этом сохраняется');
  assertEqual(S.applyPasscodeOff(undefined), Object.assign(S.defaults(), { biometric: false, bioCredId: null }),
    'applyPasscodeOff() без аргумента не падает');
}
{
  const src = { lockDelay: 0, biometric: true, bioCredId: 'k', lastActiveAt: null };
  S.applyPasscodeOff(src);
  assertEqual(src.biometric, true, 'applyPasscodeOff() не мутирует переданный объект (возвращает новый)');
}

// ============ 11. canEnableBiometric ============
{
  assertEqual(S.canEnableBiometric(true, true), true, 'Есть код и доступен аутентификатор → можно включать');
  assertEqual(S.canEnableBiometric(false, true), false, 'Нет кода → включать нельзя');
  assertEqual(S.canEnableBiometric(true, false), false, 'Аутентификатор недоступен → включать нельзя (никакой имитации)');
  assertEqual(S.canEnableBiometric(true, null), false, 'Доступность ещё не выяснена → включать нельзя');
  assertEqual(S.canEnableBiometric(true, undefined), false, 'undefined-доступность → включать нельзя');
}

// ============ 12. setLockDelay ============
{
  assertEqual(S.setLockDelay({ lockDelay: 0 }, 15 * MIN).lockDelay, 15 * MIN, 'Известное значение устанавливается');
  assertEqual(S.setLockDelay({ lockDelay: MIN }, 42).lockDelay, 0, 'Неизвестное значение → «Сразу»');
  const src = { lockDelay: 0, biometric: false, bioCredId: null, lastActiveAt: 7 };
  const out = S.setLockDelay(src, MIN);
  assertEqual(src.lockDelay, 0, 'setLockDelay() не мутирует исходный объект');
  assertEqual(out.lastActiveAt, 7, 'setLockDelay() сохраняет остальные поля');
}

// ============ 13. shouldLock — сердце настройки «Запрашивать» ============
{
  assertEqual(S.shouldLock({}, 1000), false, 'Без защитного кода блокировка не нужна никогда');
  assertEqual(S.shouldLock({ settings: { security: { lockDelay: 0 } } }, 1000), false, 'Без кода — даже при lockDelay=0');
  assertEqual(S.shouldLock(null, 1000), false, 'shouldLock(null) не падает');
}
{
  const st = { pinHash: 'h', settings: { security: { lockDelay: 0, lastActiveAt: null } } };
  assertEqual(S.shouldLock(st, 1000), true, 'Нет отметки активности (холодный старт/выгрузка) → блокируем (fail-secure)');
}
{
  const st = { pinHash: 'h', settings: { security: { lockDelay: 0, lastActiveAt: 1000 } } };
  assertEqual(S.shouldLock(st, 1000), true, '«Сразу»: блокируем даже при нулевом простое');
  assertEqual(S.shouldLock(st, 1001), true, '«Сразу»: блокируем при любом простое');
}
{
  const st = { pinHash: 'h', settings: { security: { lockDelay: 5 * MIN, lastActiveAt: 1000000 } } };
  assertEqual(S.shouldLock(st, 1000000), false, '5 минут: сразу после сворачивания не блокируем');
  assertEqual(S.shouldLock(st, 1000000 + MIN), false, '5 минут: через 1 минуту не блокируем');
  assertEqual(S.shouldLock(st, 1000000 + 5 * MIN - 1), false, '5 минут: за миллисекунду до порога не блокируем');
  assertEqual(S.shouldLock(st, 1000000 + 5 * MIN), true, '5 минут: ровно на пороге блокируем');
  assertEqual(S.shouldLock(st, 1000000 + 6 * MIN), true, '5 минут: после порога блокируем');
}
{
  const st = { pinHash: 'h', settings: { security: { lockDelay: 60 * MIN, lastActiveAt: 1000000 } } };
  assertEqual(S.shouldLock(st, 1000000 + 59 * MIN), false, '1 час: через 59 минут не блокируем');
  assertEqual(S.shouldLock(st, 1000000 + 60 * MIN), true, '1 час: через 60 минут блокируем');
}
{
  const st = { pinHash: 'h', settings: { security: { lockDelay: 99999, lastActiveAt: 1000 } } };
  assertEqual(S.shouldLock(st, 1000), true, 'Неизвестная задержка трактуется как «Сразу», а не как «никогда»');
}
{
  const st = { pinHash: 'h', settings: { security: { lockDelay: 60 * MIN, lastActiveAt: 5000000 } } };
  assertEqual(S.shouldLock(st, 1000), true, 'Часы устройства сдвинуты назад → блокируем, а не «отрицательный простой»');
}
{
  const st = { pinHash: 'h' }; // блок настроек отсутствует вовсе
  assertEqual(S.shouldLock(st, 1000), true, 'Есть код, настроек нет → блокируем (прежнее поведение приложения)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
