// services/health_score_service.js — финансовое здоровье. Flutter → services/health_score_service.dart
// Part 3 веса: Savings 30% · Budgets 25% · Goals 20% · Discipline 15% · CashFlow 10%. Итог 0–100.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Health = {
  WEIGHTS: { savings: 0.30, budgets: 0.25, goals: 0.20, discipline: 0.15, cashFlow: 0.10 },

  calculate(state) {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const monthTx = state.tx.filter(t => { const d = new Date(t.date); return d >= from && d <= to; });
    const A = AF.Services.Analytics;
    const income = A.income(monthTx), expense = A.expense(monthTx);

    // Savings: доля сбережений от дохода (0..100)
    const savingsRate = income > 0 ? (income - expense) / income * 100 : 0;
    const savings = clamp(savingsRate * 2);                 // 50% сбережений = 100 баллов

    // Budgets: насколько в рамках лимитов
    const budgets = budgetScore(state, from, to);

    // Goals: средний прогресс активных целей (или 100, если целей нет)
    const goals = goalScore(state);

    // Discipline: положительный поток + наличие операций
    const discipline = clamp((expense <= income ? 70 : 30) + Math.min(30, monthTx.length));

    // CashFlow: положительный денежный поток
    const cashFlow = income + expense ? clamp((income - expense) / (income || 1) * 100 + 50) : 50;

    const w = this.WEIGHTS;
    const total = Math.round(savings*w.savings + budgets*w.budgets + goals*w.goals + discipline*w.discipline + cashFlow*w.cashFlow);
    return {
      totalScore: clamp(total),
      savingsScore: Math.round(savings), budgetScore: Math.round(budgets),
      goalsScore: Math.round(goals), disciplineScore: Math.round(discipline), cashFlowScore: Math.round(cashFlow),
      level: this.level(total), calculatedAt: Date.now(),
    };
  },

  level(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Average';
    if (score >= 40) return 'Needs Attention';
    return 'Critical';
  },
};
function clamp(n) { return Math.max(0, Math.min(100, n)); }
function budgetScore(state, from, to) {
  const ids = Object.keys(state.budgets || {});
  if (!ids.length) return 70;
  let sum = 0;
  ids.forEach(id => {
    const st = AF.Services.Budget.status(AF.Services.Budget.spent(state, id, from, to), state.budgets[id]);
    sum += st.level === 'critical' ? 30 : st.level === 'warning' ? 70 : 100;
  });
  return sum / ids.length;
}
function goalScore(state) {
  const active = (state.goals || []).filter(g => g.status !== 'paused');
  if (!active.length) return 100;
  return active.reduce((s, g) => s + AF.Services.Goal.progress(g), 0) / active.length;
}
