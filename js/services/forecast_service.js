// services/forecast_service.js — прогноз баланса. Flutter → services/forecast_service.dart
// Part 3: Forecast = Current Balance + Future Income − Future Expenses (из reminders/recurring).
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Forecast = {
  // Прогноз капитала через N дней на основе активных напоминаний
  balanceForecast(state, days) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 86400000);
    let future = 0;
    (state.reminders || []).filter(r => r.isActive).forEach(r => {
      this._occurrences(r, now, until).forEach(() => {
        future += (r.amount >= 0 ? r.amount : r.amount); // знак суммы задаёт доход/расход
      });
    });
    return AF.Services.Account.totalCapital(state) + future;
  },

  // Список дат повторов напоминания в интервале
  _occurrences(reminder, from, to) {
    const out = []; let d = new Date(reminder.dueDate);
    const step = { daily:1, weekly:7, monthly:30, yearly:365, none:0 }[reminder.repeatType || 'none'];
    if (d >= from && d <= to) out.push(new Date(d));
    if (!step) return out;
    let guard = 0;
    while (guard++ < 400) {
      if (reminder.repeatType === 'monthly') d.setMonth(d.getMonth() + 1);
      else if (reminder.repeatType === 'yearly') d.setFullYear(d.getFullYear() + 1);
      else d = new Date(d.getTime() + step * 86400000);
      if (d > to) break;
      if (d >= from) out.push(new Date(d));
    }
    return out;
  },
};
