// services/demo_data_service.js — построение демонстрационных операций (TASK_016).
// Flutter → services/demo_data_service.dart
//
// Чистая функция: не читает/не пишет state, localStorage, DOM, не вызывает
// другие AF.Services. До TASK_016 loadDemo() (index.html) ссылалась на
// несуществующие id категорий/подкатегорий (realty, income_main, products,
// prius, flat, clothes, beauty, tech, subscriptions) — все демо-операции
// отображались как «Другое ❓» (catById() не находил категорию). Здесь
// используются только id, реально сидируемые seedCategories() из
// AF.Services.CategoryTaxonomy.CATS (проверено tests/demo_data_service.test.js).
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.DemoData = {
  // id подкатегории — тот же формат, что использует seedCategories() (index.html).
  subId(catId, i) { return 's_' + catId + '_' + i; },

  // Спецификация ежемесячных расходных демо-операций: [categoryId, subIndex|null,
  // minAmount, maxAmount, payee|null, tags|null, location|null].
  EXPENSE_SPEC: [
    ['food', 0, 280, 420, 'Mercadona', ['еда'], 'Oviedo'],
    ['transport', 0, 60, 140, 'Repsol', ['авто'], null],
    ['home', 0, 90, 150, null, ['жильё'], null],
    ['health', 0, 20, 120, 'Farmacia Uría', null, 'Oviedo'],
    ['shopping', 0, 40, 160, null, null, null],
    ['care', 1, 20, 60, null, null, null],
    ['shopping', 2, 30, 300, 'MediaMarkt', ['техника'], 'Gijón'],
    ['subs', null, 10, 40, null, null, null],
    ['shopping', 3, 20, 90, 'Mercadona', ['дом'], null],
  ],

  // Строит демо-операции за 3 месяца (текущий + 2 предыдущих), как исходная loadDemo().
  // accountIds — id счетов пользователя (state.accounts.map(a=>a.id)); today — точка отсчёта (по умолчанию — сейчас).
  build(accountIds, today) {
    today = today || new Date();
    const accs = (Array.isArray(accountIds) && accountIds.length) ? accountIds : [undefined];
    const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
    const dstr = (base, day) => new Date(base.getFullYear(), base.getMonth(), day).toISOString().slice(0, 10);
    const tx = [];
    for (let m = 0; m < 3; m++) {
      const base = new Date(today.getFullYear(), today.getMonth() - m, 1);
      // доход: аренда через агентство (Inmo Digital) + основной ежемесячный доход
      tx.push({ id: Date.now() + Math.random(), type: 'income', amount: rnd(1800, 2200), cat: 'rent', subcategoryId: this.subId('rent', 0), account: accs[0], date: dstr(base, 5), note: 'Inmo Digital', payee: 'Inmo Digital', tags: ['работа'] });
      tx.push({ id: Date.now() + Math.random(), type: 'income', amount: rnd(150, 400), cat: 'salary', account: accs[1] || accs[0], date: dstr(base, 18), note: '' });
      this.EXPENSE_SPEC.forEach((e, i) => {
        const [cat, subIndex, min, max, payee, tags, location] = e;
        const t = { id: Date.now() + Math.random() + i, type: 'expense', amount: rnd(min, max), cat, subcategoryId: subIndex != null ? this.subId(cat, subIndex) : null, account: accs[i % accs.length], date: dstr(base, 3 + i * 3), note: '' };
        if (payee) t.payee = payee;
        if (tags && tags.length) t.tags = tags;
        if (location) t.location = location;
        tx.push(t);
      });
    }
    return tx;
  },
};
