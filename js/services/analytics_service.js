// services/analytics_service.js — доходы/расходы/поток/категории.
// Flutter → services/analytics_service.dart
// Part 3: переводы исключены из income/expense/cashflow, но входят в историю счёта/капитал.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Analytics = {
  income(txList)  { return txList.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0); },
  expense(txList) { return txList.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0); },
  cashFlow(txList){ return this.income(txList) - this.expense(txList); },

  // {categoryId: sum} для заданного типа
  byCategory(txList, type) {
    const m = {};
    txList.filter(t => t.type === type).forEach(t => { m[t.cat] = (m[t.cat] || 0) + t.amount; });
    return m;
  },

  // Сравнение двух наборов (этот период / прошлый)
  compare(curList, prevList) {
    const ci = this.income(curList), pi = this.income(prevList);
    const ce = this.expense(curList), pe = this.expense(prevList);
    const pct = (c, p) => p ? (c - p) / Math.abs(p) * 100 : 0;
    return { income:{cur:ci,prev:pi,deltaPct:pct(ci,pi)}, expense:{cur:ce,prev:pe,deltaPct:pct(ce,pe)} };
  },
};
