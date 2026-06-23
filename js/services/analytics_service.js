// services/analytics_service.js — доходы/расходы/поток/категории.
// Flutter → services/analytics_service.dart
// Part 3: переводы исключены из income/expense/cashflow, но входят в историю счёта/капитал.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Analytics = {
  // сумма операции в базовой валюте (если передан state); иначе сырое t.amount
  _amt(t, state) {
    if (!state) return t.amount;
    const a = state.accounts.find(x => x.id === t.account);
    const cur = a ? (a.currency || state.currency) : state.currency;
    return AF.Services.Currency.toBase(state, t.amount, cur);
  },
  income(txList, state)  { return txList.filter(t => t.type === 'income').reduce((s, t) => s + this._amt(t, state), 0); },
  expense(txList, state) { return txList.filter(t => t.type === 'expense').reduce((s, t) => s + this._amt(t, state), 0); },
  cashFlow(txList, state){ return this.income(txList, state) - this.expense(txList, state); },

  // {categoryId: sum} для заданного типа (в базовой валюте, если передан state)
  byCategory(txList, type, state) {
    const m = {};
    txList.filter(t => t.type === type).forEach(t => { m[t.cat] = (m[t.cat] || 0) + this._amt(t, state); });
    return m;
  },

  // Топ категорий по сумме (по типу, с долей %)
  topCategories(txList, type, limit, state) {
    const m = this.byCategory(txList, type || 'expense', state);
    const total = Object.values(m).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, limit || 5)
      .map(([cat, amount]) => ({ cat, amount, share: amount / total * 100 }));
  },

  // Сравнение двух наборов (этот период / прошлый)
  compare(curList, prevList, state) {
    const ci = this.income(curList, state), pi = this.income(prevList, state);
    const ce = this.expense(curList, state), pe = this.expense(prevList, state);
    const pct = (c, p) => p ? (c - p) / Math.abs(p) * 100 : 0;
    return { income:{cur:ci,prev:pi,deltaPct:pct(ci,pi)}, expense:{cur:ce,prev:pe,deltaPct:pct(ce,pe)} };
  },
};
