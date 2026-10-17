// services/forecast_service.js — прогноз баланса и повторы напоминаний.
// Flutter → services/forecast_service.dart
// Part 3: Forecast = Current Balance + Future Income − Future Expenses (из reminders/recurring).
//
// TASK_061: даты — локальные календарные дни. Раньше dueDate разбирался как
// new Date('YYYY-MM-DD') (UTC-полночь: западнее UTC это предыдущий день), а
// повтор считался накопительным setMonth(+1): платёж 31-го «уплывал»
// (31 янв → 3 мар → 3 апр …), 29 фев ежегодно → 1 мар навсегда. Теперь k-й
// повтор считается от исходной даты с зажимом на последний день месяца:
// 31 янв → 28/29 фев → 31 мар → 30 апр …
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Forecast = {
  // 'YYYY-MM-DD' (или Date) → локальная полночь; null для мусора
  parseDate(v) {
    if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
    const m = String(v == null ? '' : v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(v);
    return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  },
  // локальная дата → 'YYYY-MM-DD' (не toISOString: тот даёт UTC-день)
  toIso(d) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },
  // k-й повтор (k ≥ 0) от исходной даты anchor
  occurrence(anchor, rt, k) {
    const y = anchor.getFullYear(), m = anchor.getMonth(), day = anchor.getDate();
    if (rt === 'daily') return new Date(y, m, day + k);
    if (rt === 'weekly') return new Date(y, m, day + 7 * k);
    let ty = y, tm = m;
    if (rt === 'monthly') tm = m + k;
    else if (rt === 'yearly') ty = y + k;
    else return new Date(y, m, day);
    const last = new Date(ty, tm + 1, 0).getDate();
    return new Date(ty, tm, Math.min(day, last));
  },
  // наименьший k ≥ 0, у которого повтор ≥ ref (оценка с запасом, затем дошагивание)
  indexFrom(anchor, rt, ref) {
    if (!(ref > anchor)) return 0;
    let k = 0;
    if (rt === 'daily' || rt === 'weekly') k = Math.floor(Math.floor((ref - anchor) / 86400000) / (rt === 'weekly' ? 7 : 1)) - 1;
    else if (rt === 'monthly') k = (ref.getFullYear() - anchor.getFullYear()) * 12 + ref.getMonth() - anchor.getMonth() - 1;
    else if (rt === 'yearly') k = ref.getFullYear() - anchor.getFullYear() - 1;
    else return 0;
    k = Math.max(0, k);
    let g = 0; while (this.occurrence(anchor, rt, k) < ref && g++ < 4000) k++;
    return k;
  },
  // даты срабатываний напоминания в [from, to]
  occurrencesBetween(reminder, from, to) {
    const out = []; const rt = reminder.repeatType || 'none';
    const a = this.parseDate(reminder.dueDate); if (!a) return out;
    if (rt === 'none') { if (a >= from && a <= to) out.push(a); return out; }
    let k = this.indexFrom(a, rt, from), g = 0;
    for (let d = this.occurrence(a, rt, k); d <= to && g++ < 4000; d = this.occurrence(a, rt, ++k)) out.push(d);
    return out;
  },
  // ближайшее срабатывание >= ref (для повторяющихся); для none — сам dueDate
  nextOccurrence(reminder, ref) {
    const rt = reminder.repeatType || 'none';
    const a = this.parseDate(reminder.dueDate); if (!a) return null;
    if (rt === 'none') return a;
    return this.occurrence(a, rt, this.indexFrom(a, rt, ref));
  },
  // последнее срабатывание строго до ref (null — если его не было)
  previousOccurrence(reminder, ref) {
    const rt = reminder.repeatType || 'none';
    const a = this.parseDate(reminder.dueDate); if (!a) return null;
    if (rt === 'none') return a < ref ? a : null;
    const k = this.indexFrom(a, rt, ref);
    return k > 0 ? this.occurrence(a, rt, k - 1) : null;
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
