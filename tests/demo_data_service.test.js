// tests/demo_data_service.test.js — юнит-тесты для js/services/demo_data_service.js и
// js/services/category_taxonomy_service.js (TASK_016).
// Запуск: node tests/demo_data_service.test.js
const fs = require('fs');
const path = require('path');
global.window = global;
require('../js/services/category_taxonomy_service.js');
require('../js/services/demo_data_service.js');
require('../js/services/tx_meta_service.js');
require('../js/database/store.js');
require('../js/services/export_service.js');
const CT = AF.Services.CategoryTaxonomy;
const DD = AF.Services.DemoData;
const TM = AF.Services.TxMeta;

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}

// Множество валидных id подкатегорий — тот же формат, что строит seedCategories() (index.html).
function allSubcatIds() {
  const set = new Set();
  CT.CATS.expense.concat(CT.CATS.income).forEach(c => {
    (c.subs || []).forEach((_, i) => set.add(DD.subId(c.id, i)));
  });
  return set;
}
const VALID_SUBCAT_IDS = allSubcatIds();

// ============ §1 — EXPENSE_SPEC ссылается только на существующие category/subcategory id ============

{
  DD.EXPENSE_SPEC.forEach(([cat, subIndex], i) => {
    assertTrue(CT.categoryExists(cat), `EXPENSE_SPEC[${i}]: category "${cat}" существует в таксономии`);
    if (subIndex != null) {
      assertTrue(CT.subcategoryExists(cat, subIndex), `EXPENSE_SPEC[${i}]: subIndex ${subIndex} существует внутри "${cat}"`);
    }
  });
}

// ============ §2 — build() возвращает только валидные ссылки ============

{
  const accs = ['acc1', 'acc2'];
  const tx = DD.build(accs, new Date(2026, 6, 27));
  assertTrue(tx.length > 0, 'build() возвращает непустой массив операций');
  assertTrue(tx.every(t => t.type !== 'transfer'), 'демо-данные не содержат операций-переводов');

  tx.forEach((t, i) => {
    assertTrue(CT.categoryExists(t.cat), `tx[${i}]: cat "${t.cat}" существует в таксономии (type=${t.type})`);
    if (t.subcategoryId != null) {
      assertTrue(VALID_SUBCAT_IDS.has(t.subcategoryId), `tx[${i}]: subcategoryId "${t.subcategoryId}" существует`);
    }
  });

  // Эмуляция catById() (index.html) — фолбэк «Другое ❓» не должен наступать
  // ни для одной демо-операции (это сама суть исправляемого дефекта).
  const cats = CT.CATS.expense.concat(CT.CATS.income);
  const catByIdFallback = id => cats.find(c => c.id === id) || { name: 'Другое', emoji: '❓' };
  tx.forEach((t, i) => {
    const c = catByIdFallback(t.cat);
    assertTrue(c.emoji !== '❓', `tx[${i}]: категория "${t.cat}" не приводит к фолбэку «Другое ❓»`);
  });
}

// ============ §3 — демо-данные уже нормализованы (schema v3) ============

{
  const accs = ['acc1'];
  const tx = DD.build(accs, new Date(2026, 6, 27));
  tx.forEach((t, i) => {
    const before = JSON.stringify({ payee: t.payee, tags: t.tags, location: t.location });
    const clone = JSON.parse(JSON.stringify(t));
    TM.normalizeTx(clone);
    const after = JSON.stringify({ payee: clone.payee, tags: clone.tags, location: clone.location });
    assertEqual(after, before, `tx[${i}]: normalizeTx не меняет payee/tags/location — уже нормализованы (schema v3)`);
  });
}

// ============ §4 — совместимость с migrate() (полный путь через AF.Store) ============

{
  const S = AF.Store;
  const st = S.defaults();
  st.accounts = [{ id: 'acc1', name: 'Наличные', type: 'cash', currency: '€', isArchived: false }];
  st.tx = DD.build(['acc1'], new Date(2026, 6, 27));
  S.migrate(st);
  assertEqual(st.schemaVersion, 3, 'migrate(demo-tx) поднимает schemaVersion до 3');
  assertTrue(st.tx.length > 0, 'migrate сохраняет все демо-операции');
}

// ============ §5 — совместимость с экспортом CSV ============

{
  const accs = [{ id: 'acc1', name: 'Наличные', type: 'cash', currency: '€', isArchived: false }];
  const cats = CT.CATS.expense.concat(CT.CATS.income).map(c => ({ id: c.id, name: c.name, type: CT.CATS.expense.includes(c) ? 'expense' : 'income' }));
  const subcats = [];
  CT.CATS.expense.concat(CT.CATS.income).forEach(c => (c.subs || []).forEach((nm, i) => subcats.push({ id: DD.subId(c.id, i), categoryId: c.id, name: nm })));
  const state = { accounts: accs, cats, subcats, currency: '€' };
  const tx = DD.build(['acc1'], new Date(2026, 6, 27));
  let csv;
  try { csv = AF.Services.Export.csv(tx, state); }
  catch (e) { failed++; console.error('FAIL: AF.Services.Export.csv(demo-tx) не должен бросать исключение: ' + e.message); }
  if (csv !== undefined) {
    passed++;
    const lines = csv.split('\n');
    assertEqual(lines.length, tx.length + 1, 'CSV содержит заголовок + строку на каждую демо-операцию');
    // Колонка «Категория» (индекс 4) не должна быть пустой ни для одной операции —
    // подтверждает, что cat/subcategoryId резолвятся в реальные имена.
    const dataLines = lines.slice(1);
    dataLines.forEach((line, i) => {
      const cols = line.split(',');
      assertTrue(cols[4] && cols[4].length > 0, `CSV-строка ${i}: колонка «Категория» не пустая`);
    });
  }
}

// ============ §6 — payee/tags/location валидны (не теряются при нормализации) ============

{
  const tx = DD.build(['acc1'], new Date(2026, 6, 27));
  const withMeta = tx.filter(t => t.payee || (t.tags && t.tags.length) || t.location);
  assertTrue(withMeta.length > 0, 'часть демо-операций заполнена метаданными payee/tags/location');
  withMeta.forEach((t, i) => {
    if (t.payee) assertEqual(TM.normalizePayee(t.payee), t.payee, `withMeta[${i}]: payee уже нормализован`);
    if (t.tags) assertEqual(TM.normalizeTags(t.tags), t.tags, `withMeta[${i}]: tags уже нормализованы`);
    if (t.location) assertEqual(TM.normalizeLocation(t.location), t.location, `withMeta[${i}]: location уже нормализовано`);
  });
}

// ============ §7 — статическая проверка budgets/reminders в index.html ============
// loadDemo() в index.html не вынесена целиком (budgets/reminders — короткие
// объектные литералы, вынесение не оправдано архитектурно), поэтому здесь —
// точечная regex-проверка id категорий именно в теле loadDemo(), без разбора
// остального index.html.

{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/function loadDemo\(\)\{[\s\S]*?\n\}/);
  assertTrue(!!m, 'loadDemo() найдена в index.html');
  if (m) {
    const body = m[0];
    const budgetsMatch = body.match(/state\.budgets=\{([^}]*)\}/);
    assertTrue(!!budgetsMatch, 'state.budgets найден внутри loadDemo()');
    if (budgetsMatch) {
      const keys = budgetsMatch[1].split(',').map(kv => kv.split(':')[0].trim()).filter(Boolean);
      keys.forEach(k => assertTrue(CT.categoryExists(k), `loadDemo() state.budgets: категория "${k}" существует`));
    }
    const catIds = [...body.matchAll(/categoryId:'([^']+)'/g)].map(x => x[1]);
    assertTrue(catIds.length > 0, 'loadDemo() содержит categoryId в reminders');
    catIds.forEach(id => assertTrue(CT.categoryExists(id), `loadDemo() reminders: categoryId "${id}" существует`));
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
