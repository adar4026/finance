// services/health_score_service.js — финансовое здоровье (0–100). Flutter → services/health_score_service.dart
// Веса (Part 3): Накопления 30 · Бюджеты 25 · Цели 20 · Дисциплина 15 · Поток 10.
// Компоненты без данных исключаются, веса пере-нормируются (важно для новых пользователей).
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.HealthScore = {
  STATUS(t) {
    if (t >= 90) return ['Отлично', '#22c55e'];
    if (t >= 75) return ['Хорошо', '#22c55e'];
    if (t >= 60) return ['Средне', '#f59e0b'];
    if (t >= 40) return ['Внимание', '#f59e0b'];
    return ['Критично', '#ef4444'];
  },
  _mr(ref) { const d = ref || new Date(); return { from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59) }; },
  _sum(state, type, from, to) { return (state.tx || []).filter(t => t.type === type && new Date(t.date) >= from && new Date(t.date) <= to).reduce((s, t) => s + t.amount, 0); },
  _catSpent(state, cat, from, to) { return (state.tx || []).filter(t => t.type === 'expense' && t.cat === cat && new Date(t.date) >= from && new Date(t.date) <= to).reduce((s, t) => s + t.amount, 0); },
  calculate(state) {
    const now = new Date(), { from, to } = this._mr(now);
    const income = this._sum(state, 'income', from, to), expense = this._sum(state, 'expense', from, to);
    const txCount = (state.tx || []).filter(t => t.type !== 'transfer').length;
    const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
    const comps = [];
    if (income > 0) comps.push({ key: 'savings', name: 'Накопления', weight: 30, available: true, score: clamp((income - expense) / income / 0.2 * 100), detail: 'Норма сбережений ' + Math.round((income - expense) / income * 100) + '% от дохода' });
    else comps.push({ key: 'savings', name: 'Накопления', weight: 30, available: false, detail: 'Нет данных о доходах за месяц' });

    const bIds = Object.keys(state.budgets || {}).filter(c => (+state.budgets[c] || 0) > 0);
    if (bIds.length) { let lim = 0, over = 0; bIds.forEach(c => { const l = +state.budgets[c], sp = this._catSpent(state, c, from, to); lim += l; over += Math.max(0, sp - l); }); comps.push({ key: 'budgets', name: 'Бюджеты', weight: 25, available: true, score: clamp(100 - over / lim * 100), detail: over > 0 ? ('Превышения лимитов на ' + Math.round(over)) : 'Все категории в пределах лимитов' }); }
    else comps.push({ key: 'budgets', name: 'Бюджеты', weight: 25, available: false, detail: 'Бюджеты не заданы' });

    const goals = state.goals || [];
    if (goals.length) { const avg = goals.reduce((s, g) => s + Math.min(100, g.savedAmount / g.targetAmount * 100), 0) / goals.length; comps.push({ key: 'goals', name: 'Цели', weight: 20, available: true, score: clamp(avg), detail: 'Средний прогресс по ' + goals.length + ' цел.' }); }
    else comps.push({ key: 'goals', name: 'Цели', weight: 20, available: false, detail: 'Целей пока нет' });

    let mWith = 0, mData = 0;
    for (let i = 0; i < 3; i++) { const r = this._mr(new Date(now.getFullYear(), now.getMonth() - i, 1)); const inc = this._sum(state, 'income', r.from, r.to), exp = this._sum(state, 'expense', r.from, r.to); if (inc > 0 || exp > 0) { mData++; if (inc >= exp) mWith++; } }
    if (mData > 0) comps.push({ key: 'discipline', name: 'Дисциплина', weight: 15, available: true, score: clamp(mWith / mData * 100), detail: mWith + ' из ' + mData + ' мес. без перерасхода' });
    else comps.push({ key: 'discipline', name: 'Дисциплина', weight: 15, available: false, detail: 'Недостаточно истории' });

    if (income > 0) comps.push({ key: 'cashflow', name: 'Денежный поток', weight: 10, available: true, score: clamp(50 + (income - expense) / income * 100), detail: 'Поток за месяц ' + (income - expense >= 0 ? '+' : '−') + Math.round(Math.abs(income - expense)) });
    else comps.push({ key: 'cashflow', name: 'Денежный поток', weight: 10, available: false, detail: 'Нет данных о доходах' });

    const avail = comps.filter(c => c.available);
    const hasEnoughData = avail.length > 0 && txCount >= 5;
    let total = 0;
    if (avail.length) { const w = avail.reduce((s, c) => s + c.weight, 0); total = Math.round(avail.reduce((s, c) => s + c.weight * c.score, 0) / w); }
    const [status, color] = this.STATUS(total);
    return { total, status, color, hasEnoughData, components: comps };
  },
  recommendations(res) {
    const m = {}; res.components.forEach(c => m[c.key] = c); const out = [];
    if (m.savings.available && m.savings.score < 60) out.push({ ic: '💰', t: 'Откладывайте хотя бы 10% дохода' });
    if (!m.budgets.available) out.push({ ic: '📊', t: 'Задайте лимиты по категориям' });
    else if (m.budgets.score < 70) out.push({ ic: '⚠️', t: 'Есть превышения бюджета — скорректируйте лимиты' });
    if (!m.goals.available) out.push({ ic: '🎯', t: 'Поставьте финансовую цель' });
    else if (m.goals.score < 60) out.push({ ic: '🎯', t: 'Цели отстают — пополните накопления' });
    if (m.cashflow.available && m.cashflow.score < 50) out.push({ ic: '📉', t: 'Расходы превышают доходы в этом месяце' });
    if (!out.length) out.push({ ic: '✅', t: 'Отличная работа — так держать!' });
    return out.slice(0, 3);
  },
};
