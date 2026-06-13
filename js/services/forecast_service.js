// services/forecast_service.js — прогноз баланса и повторы напоминаний.
// Flutter → services/forecast_service.dart
// Part 3: Forecast = Current Balance + Future Income − Future Expenses (из reminders/recurring).
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Forecast = {
  _advance(d, rt) {
    const n = new Date(d);
    if (rt === 'daily') n.setDate(n.getDate() + 1);
    else if (rt === 'weekly') n.setDate(n.getDate() + 7);
    else if (rt === 'monthly') n.setMonth(n.getMonth() + 1);
    else if (rt === 'yearly') n.setFullYear(n.getFullYear() + 1);
    return n;
  },
  // даты срабатываний напоминания в [from, to]
  occurrencesBetween(reminder, from, to) {
    const out = []; const rt = reminder.repeatType || 'none';
    let d = new Date(reminder.dueDate); if (isNaN(d)) return out;
    let g = 0;
    if (rt !== 'none') while (d < from && g++ < 4000) d = this._advance(d, rt);
    g = 0;
    while (d <= to && g++ < 4000) { if (d >= from) out.push(new Date(d)); if (rt === 'none') break; d = this._advance(d, rt); }
    return out;
  },
  // ближайшее срабатывание >= ref (для повторяющихся); для none — сам dueDate
  nextOccurrence(reminder, ref) {
    const rt = reminder.repeatType || 'none';
    let d = new Date(reminder.dueDate); if (isNaN(d)) return null;
    if (rt === 'none') return d;
    let g = 0; while (d < ref && g++ < 4000) d = this._advance(d, rt);
    return d;
  },
  // прогноз капитала через N дней
  balanceForecast(state, days) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const until = new Date(now.getTime() + days * 86400000); until.setHours(23, 59, 59, 999);
    let delta = 0;
    (state.reminders || []).filter(r => r.isActive !== false).forEach(r => {
      this.occurrencesBetween(r, now, until).forEach(() => { delta += (r.type === 'income' ? r.amount : -r.amount); });
    });
    return AF.Services.Account.totalCapital(state) + delta;
  },
};
