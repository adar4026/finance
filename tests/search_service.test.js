// tests/search_service.test.js — юнит-тесты для js/services/search_service.js (TASK_016).
// Запуск: node tests/search_service.test.js
global.window = global;
require('../js/services/search_service.js');
require('../js/services/tx_meta_service.js');
const N = AF.Services.Search.normalizeSearchText;
const TM = AF.Services.TxMeta;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// ============ §1 — испанские примеры ============

[
  ['Gijón', 'gijon'],
  ['León', 'leon'],
  ['Málaga', 'malaga'],
  ['José', 'jose'],
  ['España', 'espana'],
  ['pingüino', 'pinguino'],
].forEach(([withDiacritics, plain]) => {
  assertEqual(N(withDiacritics), N(plain), `"${withDiacritics}" и "${plain}" нормализуются к одному значению`);
  assertEqual(N(withDiacritics), plain.toLowerCase(), `"${withDiacritics}" нормализуется в "${plain.toLowerCase()}"`);
});

// über → uber (немецкий умлаут — тот же механизм NFD)
assertEqual(N('über'), 'uber', '"über" нормализуется в "uber"');

// ============ §2 — составной Unicode (буква + отдельный combining mark) ============

{
  const composed = 'Café';                 // é как единый code point (NFC)
  const decomposed = 'Café';         // e + U+0301 (combining acute accent) — то же визуально
  assertEqual(N(composed), 'cafe', 'предкомпонованное "Café" → "cafe"');
  assertEqual(N(decomposed), 'cafe', 'декомпонованное "Cafe\\u0301" → "cafe"');
  assertEqual(N(composed), N(decomposed), 'composed и decomposed формы сходятся к одному значению');
  assertEqual(N(composed), N('cafe'), '"Café" находится по запросу "cafe"');
}

// ============ §3 — кириллица (без транслитерации) ============

{
  assertEqual(N('Овьедо'), 'овьедо', '"Овьедо" нормализуется только регистром (кириллица не трогается диакритикой)');
  assertTrue(N('Овьедо') !== N('oviedo'), '"Овьедо" НЕ совпадает с "oviedo" — транслитерации нет (не цель TASK_016)');
}

// ============ §4 — метаданные TASK_015 без диакритики ============

{
  assertEqual(N('José Market'), 'jose market', 'payee "José Market" → "jose market"');
  assertEqual(N('café'), 'cafe', 'tag "café" → "cafe"');
  assertEqual(N('Gijón'), 'gijon', 'location "Gijón" → "gijon"');
  assertEqual(N('reunión'), 'reunion', 'note "reunión" → "reunion"');
}

// ============ §5 — AND-семантика составного запроса (проверка через подстроки) ============

{
  const corpus = N('Mercadona Gijón comida'); // как выглядел бы txSearchText() для операции
  const termsMatch = (q) => q.split(/\s+/).every(term => corpus.includes(N(term)));
  assertTrue(termsMatch('mercadona gijon'), '"mercadona gijon" (без диакритики) находит операцию с "Gijón"');
  assertTrue(!termsMatch('mercadona oviedo'), '"mercadona oviedo" не находит операцию без "Oviedo"');
}

// ============ §6 — безопасность ============

assertEqual(N(null), '', 'null → пустая строка, без падения');
assertEqual(N(undefined), '', 'undefined → пустая строка, без падения');
assertEqual(N(150), '150', 'число → строка');
assertEqual(N(''), '', 'пустая строка → пустая строка');
assertEqual(N('   '), '', 'строка из одних пробелов → пустая строка после trim');
assertEqual(N('🎉 café 🎉'), '🎉 cafe 🎉', 'эмодзи проходят как есть, диакритика внутри строки снимается');

// ---- фолбэк без String.prototype.normalize (старый браузер) ----
{
  const orig = String.prototype.normalize;
  try {
    // eslint-disable-next-line no-extend-native
    String.prototype.normalize = undefined;
    let threw = false, result;
    try { result = N('Gijón'); } catch (e) { threw = true; }
    assertTrue(!threw, 'normalizeSearchText не падает без String.prototype.normalize');
    assertEqual(result, 'gijón', 'без normalize() — деградация до lowercase+trim (диакритика остаётся)');
  } finally {
    String.prototype.normalize = orig;
  }
}
assertEqual(typeof ''.normalize, 'function', 'String.prototype.normalize восстановлен после теста фолбэка');

// ============ §7 — пробелы: схлопывание и trim ============

assertEqual(N('  Mercadona   Gijón  '), 'mercadona gijon', 'повторные пробелы схлопываются, края обрезаны');

// ============ §8 — не меняет фактическое написание (только сравнение) ============
// normalizeSearchText сама по себе не пишет в объект операции — это гарантирует
// её чистота (нет побочных эффектов, нет мутации аргумента).
{
  const original = 'Gijón';
  N(original);
  assertEqual(original, 'Gijón', 'normalizeSearchText не мутирует переданную строку (строки в JS неизменяемы, но фиксируем контракт)');
}

// ============ §9 — согласованность с TxMeta для metaSearchText ============

{
  const t = { payee: 'José Market', tags: ['café'], location: 'Gijón' };
  TM.normalizeTx(t);
  const meta = TM.metaSearchText(t);
  assertEqual(N(meta), 'jose market cafe gijon', 'metaSearchText(payee+tags+location) нормализуется без диакритики целиком');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
