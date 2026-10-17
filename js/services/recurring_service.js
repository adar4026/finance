// services/recurring_service.js — регулярные платежи (TASK_061).
// Flutter → services/recurring_service.dart
//
// Регулярный платёж = повторяющееся напоминание state.reminders[]
// (repeatType ≠ 'none'). Это ЗАПЛАНИРОВАННОЕ обязательство, а не операция:
// сервис ничего не пишет в state и не влияет на баланс. Операции по нему
// создаёт только авто-проводка (processAutoPost, флаг autoPost) — здесь лишь
// чистый расчёт её дат и защита от повторной проводки.
//
// Деньги — в целых центах: годовой эквивалент = центы × число повторов в
// году (целое), месячный = годовой / 12 с одним округлением в конце.
// Пауза — существующее поле isActive:false (новых полей нет).
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Recurring = {
  // повторов в году; еженедельно — 52 недели, ежедневно — 365 дней
  PER_YEAR: { daily: 365, weekly: 52, monthly: 12, yearly: 1 },
  LABEL: { daily: 'Ежедневно', weekly: 'Еженедельно', monthly: 'Ежемесячно', yearly: 'Ежегодно' },

  isRecurring(r) { return !!r && Object.prototype.hasOwnProperty.call(this.PER_YEAR, r.repeatType); },
  isPaused(r) { return !!r && r.isActive === false; },
  isExpense(r) { return !!r && r.type !== 'income'; },

  // число → целые центы (суммы хранятся с 2 знаками, round снимает хвост float)
  toCents(n) { const v = Number(n); return isFinite(v) && v > 0 ? Math.round(v * 100) : 0; },

  // годовой эквивалент одного платежа в центах (toBaseCents — сумма в базовой валюте)
  yearlyCents(r, toBaseCents) {
    const f = this.PER_YEAR[r && r.repeatType]; if (!f) return 0;
    return (toBaseCents ? toBaseCents(r) : this.toCents(r.amount)) * f;
  },

  // Карточка «Ежемесячные расходы»: только активные повторяющиеся расходы
  summary(reminders, toBaseCents) {
    const list = (reminders || []).filter(r => this.isRecurring(r));
    const active = list.filter(r => !this.isPaused(r) && this.isExpense(r));
    const yearlyCents = active.reduce((s, r) => s + this.yearlyCents(r, toBaseCents), 0);
    const monthlyCents = Math.round(yearlyCents / 12);
    return {
      count: active.length,
      yearlyCents, monthlyCents,
      yearly: yearlyCents / 100, monthly: monthlyCents / 100,
      pausedCount: list.filter(r => this.isPaused(r)).length,
      incomeCount: list.filter(r => !this.isPaused(r) && !this.isExpense(r)).length,
    };
  },

  // Строки экрана: следующая дата ≥ today (хранилище не меняется)
  items(reminders, today, toBaseCents) {
    const F = AF.Services.Forecast;
    const ref = F.parseDate(today || new Date());
    return (reminders || []).filter(r => this.isRecurring(r)).map(r => {
      const date = F.nextOccurrence(r, ref);
      return { r, date, iso: date ? F.toIso(date) : '', baseCents: toBaseCents ? toBaseCents(r) : this.toCents(r.amount) };
    }).filter(x => x.date);
  },

  // Стабильная сортировка: 'date' — ближайшие первыми, 'amount' — крупные первыми;
  // при равенстве — дата, название (ru), id
  sort(items, mode) {
    const byTitle = (a, b) => String(a.r.title || '').localeCompare(String(b.r.title || ''), 'ru', { sensitivity: 'base' })
      || String(a.r.id).localeCompare(String(b.r.id));
    const byDate = (a, b) => (a.date - b.date) || byTitle(a, b);
    const cmp = mode === 'amount' ? (a, b) => (b.baseCents - a.baseCents) || byDate(a, b) : byDate;
    return items.map((x, i) => ({ x, i })).sort((p, q) => cmp(p.x, q.x) || (p.i - q.i)).map(p => p.x);
  },

  // «Сегодня» / «Завтра» / «16 окт.» / «16 окт. 2027 г.»
  dateLabel(date, today) {
    const F = AF.Services.Forecast, t = F.parseDate(today || new Date()), d = F.parseDate(date);
    if (!d) return '';
    const diff = Math.round((d - t) / 86400000);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Завтра';
    const o = { day: 'numeric', month: 'short' };
    if (d.getFullYear() !== t.getFullYear()) o.year = 'numeric';
    return d.toLocaleDateString('ru-RU', o);
  },

  // «1 активный платёж» / «2 активных платежа» / «5 активных платежей»
  countLabel(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' активный платёж';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' активных платежа';
    return n + ' активных платежей';
  },

  // один повтор на календарный период: месяц / год; неделя и день — сама дата
  samePeriod(rt, isoA, isoB) {
    if (!isoA || !isoB) return false;
    if (rt === 'monthly') return isoA.slice(0, 7) === isoB.slice(0, 7);
    if (rt === 'yearly') return isoA.slice(0, 4) === isoB.slice(0, 4);
    return isoA.slice(0, 10) === isoB.slice(0, 10);
  },

  // ---- Переход со старого формата lastPosted (до TASK_061) ----
  // Старый код считал повторы от new Date(dueDate) (UTC-полночь) накопительным
  // setDate/setMonth/setFullYear в локальном времени и писал дату через
  // toISOString(). Поэтому его lastPosted — «старая» дата k-го повтора: летом
  // для платежа, созданного зимой (UTC+1/+2), на день раньше настоящей; у 29–31
  // числа — «уплывшая» (31 янв → 3 мар …). Новый код пишет локальную дату
  // нового k-го повтора и помечает это lastPostedV:2.
  LAST_POSTED_V: 2,
  _legacyAdvance(d, rt) {
    const n = new Date(d);
    if (rt === 'daily') n.setDate(n.getDate() + 1);
    else if (rt === 'weekly') n.setDate(n.getDate() + 7);
    else if (rt === 'monthly') n.setMonth(n.getMonth() + 1);
    else if (rt === 'yearly') n.setFullYear(n.getFullYear() + 1);
    return n;
  },
  // индекс k старого повтора, чья старая дата = lastPosted (последний при
  // совпадении — на переходе DST старый код давал одну дату двум повторам);
  // −1 — не найден (lastPosted уже нового формата или дата платежа менялась)
  legacyPostedIndex(r) {
    if (!r || !r.lastPosted || r.lastPostedV === this.LAST_POSTED_V || !this.isRecurring(r)) return -1;
    const lp = String(r.lastPosted).slice(0, 10);
    let d = new Date(r.dueDate); if (isNaN(d)) return -1;
    let found = -1;
    for (let k = 0; k < 40000; k++) {
      const iso = d.toISOString().slice(0, 10);
      if (iso === lp) found = k; else if (iso > lp) break;
      d = this._legacyAdvance(d, r.repeatType);
    }
    return found;
  },
  // lastPosted в новом формате: старая дата k-го повтора → новая дата k-го
  // повтора («проведено k+1 повторов»), иначе — как есть
  effectiveLastPosted(r) {
    if (!r || !r.lastPosted) return null;
    const k = this.legacyPostedIndex(r);
    if (k < 0) return String(r.lastPosted).slice(0, 10);
    const F = AF.Services.Forecast;
    return F.toIso(F.occurrence(F.parseDate(r.dueDate), r.repeatType, k));
  },
  // Поля для однократного перевода lastPosted в новый формат (null — не нужно)
  normalizePatch(r) {
    if (!r || !r.lastPosted || r.lastPostedV === this.LAST_POSTED_V) return null;
    return { lastPosted: this.effectiveLastPosted(r), lastPostedV: this.LAST_POSTED_V };
  },

  // Даты ('YYYY-MM-DD'), которые авто-проводка должна провести к концу дня now.
  // Защита от дублей: строго после lastPosted (в новом формате, см. выше) и не
  // в том же месяце/году, что lastPosted (правка даты после проводки) — не
  // более одной авто-операции за период; ежедневные/еженедельные — по дате.
  autoPostDates(r, now) {
    if (!r || this.isPaused(r) || !r.autoPost || !this.isRecurring(r)) return [];
    const F = AF.Services.Forecast;
    const last = this.effectiveLastPosted(r);
    let from = F.parseDate(last || r.dueDate); if (!from) return [];
    if (last) from = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
    const n = now || new Date();
    const to = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999);
    return F.occurrencesBetween(r, from, to).map(d => F.toIso(d))
      .filter(iso => !(last && this.samePeriod(r.repeatType, last, iso)));
  },

  // Поля для приостановки / возобновления. При возобновлении пропущенные за
  // паузу повторы не проводятся задним числом: lastPosted сдвигается на
  // последний повтор до сегодняшнего дня (сегодняшний и будущие — проведутся).
  pausePatch() { return { isActive: false }; },
  resumePatch(r, today) {
    const patch = { isActive: true };
    if (!r || !r.autoPost || !this.isRecurring(r)) return patch;
    const F = AF.Services.Forecast;
    const prev = F.previousOccurrence(r, F.parseDate(today || new Date()));
    const last = this.effectiveLastPosted(r);
    if (prev) {
      const iso = F.toIso(prev);
      if (!last || last < iso) { patch.lastPosted = iso; patch.lastPostedV = this.LAST_POSTED_V; }
    }
    return patch;
  },
};
