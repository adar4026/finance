// services/budget_service.js — прогресс, алёрты, рекомендации.
// Flutter → services/budget_service.dart
// Part 3: Warning ≥ 80%, Critical ≥ 100%.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Budget = {
  // Потрачено по категории за период [from,to]
  spent(state, categoryId, from, to) {
    return state.tx.filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && t.cat === categoryId && d >= from && d <= to;
    }).reduce((s, t) => s + t.amount, 0);
  },

  // Статус бюджета: pct + уровень
  status(spent, limit) {
    const pct = limit ? spent / limit * 100 : 0;
    let level = 'ok';
    if (limit && spent >= limit) level = 'critical';
    else if (limit && spent >= limit * 0.8) level = 'warning';
    return { pct: Math.min(100, pct), rawPct: pct, level, remaining: limit - spent, over: Math.max(0, spent - limit) };
  },

  // Рекомендация по лимиту (простая эвристика: средние траты за 3 мес + 10%)
  recommend(state, categoryId) {
    const now = new Date(); let total = 0, months = 3;
    for (let i = 1; i <= months; i++) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      total += this.spent(state, categoryId, from, to);
    }
    const avg = total / months;
    return Math.round(avg * 1.1);
  },
};
