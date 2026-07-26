// services/finance_card_service.js — чистые расчёты для главной финансовой карточки (TASK_003, обобщено TASK_003A).
// Flutter → services/finance_card_service.dart
// Не обращается к DOM/localStorage напрямую — только к переданному state, явному диапазону
// {from,to} и внешним callback'ам (totalCapitalFn/txBaseFn), поэтому полностью юнит-тестируем
// без браузера. TASK_003A: раньше работал только с календарным месяцем (cardMonth) — теперь
// принимает произвольный диапазон, вычисленный AF.Services.Period (единый источник периода
// для Дня/Недели/Месяца/Года/Периода на Главной).
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.FinanceCard = {
  // Операции диапазона [from,to] без переводов между собственными счетами
  // (type==='transfer' — не доход/расход, исключается самой моделью данных).
  txInRange(state, from, to) {
    return (state.tx || []).filter(t => {
      if (t.type !== 'income' && t.type !== 'expense') return false;
      const d = new Date(t.date);
      return d >= from && d <= to;
    });
  },

  // Доходы/расходы/поток за диапазон. txBaseFn(t) -> сумма операции в базовой валюте.
  totals(state, from, to, txBaseFn) {
    const list = this.txInRange(state, from, to);
    const incomeList = list.filter(t => t.type === 'income');
    const expenseList = list.filter(t => t.type === 'expense');
    const income = incomeList.reduce((s, t) => s + txBaseFn(t), 0);
    const expense = expenseList.reduce((s, t) => s + txBaseFn(t), 0);
    return {
      income, expense, flow: income - expense,
      incomeCount: incomeList.length, expenseCount: expenseList.length,
    };
  },

  // Капитал на конец диапазона; для диапазона, содержащего текущий момент, — капитал на данный момент.
  capitalAtRangeEnd(state, from, to, now, totalCapitalFn) {
    now = now || new Date();
    const end = to < now ? to : now;
    return totalCapitalFn(state, end);
  },

  // Изменение капитала за диапазон = капитал(конец диапазона) - капитал(момент перед началом диапазона).
  // Совпадает с (доходы-расходы), т.к. переводы между своими счетами капитал не меняют.
  capitalChange(state, from, to, now, totalCapitalFn) {
    const startCapital = totalCapitalFn(state, new Date(from.getTime() - 1));
    const endCapital = this.capitalAtRangeEnd(state, from, to, now, totalCapitalFn);
    const change = endCapital - startCapital;
    const pct = Math.abs(startCapital) > 0.5 ? (change / Math.abs(startCapital)) * 100 : null;
    return { change, pct, startCapital, endCapital };
  },

  // Детализация графика по активному режиму (раздел 9 постановки TASK_003A):
  // День — по часам (простое читаемое решение по времени внутри одного дня);
  // Неделя/Месяц — по дням; Год — по месяцам;
  // Период — по дням для короткого диапазона (≤62 дня), иначе по месяцам (разумная агрегация).
  granularityFor(period, from, to) {
    if (period === 'day') return 'hour';
    if (period === 'week' || period === 'month') return 'day';
    if (period === 'year') return 'month';
    const days = Math.round((to - from) / 86400000) + 1;
    return days <= 62 ? 'day' : 'month';
  },

  // Сетка бакетов [from,to] с постоянным шагом granularity ('hour'|'day'|'month').
  gridBuckets(from, to, granularity) {
    const buckets = [];
    if (granularity === 'hour') {
      const dayStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      for (let h = 0; h < 24; h++) {
        const bf = new Date(dayStart); bf.setHours(h, 0, 0, 0);
        const bt = new Date(dayStart); bt.setHours(h, 59, 59, 999);
        buckets.push({ from: bf, to: bt, label: bf });
      }
    } else if (granularity === 'day') {
      const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
      while (cursor <= end) {
        const bf = new Date(cursor); bf.setHours(0, 0, 0, 0);
        const bt = new Date(cursor); bt.setHours(23, 59, 59, 999);
        buckets.push({ from: bf, to: bt, label: bf });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else { // month
      let y = from.getFullYear(), m = from.getMonth();
      const endY = to.getFullYear(), endM = to.getMonth();
      while (y < endY || (y === endY && m <= endM)) {
        const bf = new Date(y, m, 1, 0, 0, 0, 0);
        const bt = new Date(y, m + 1, 0, 23, 59, 59, 999);
        buckets.push({ from: bf, to: bt, label: bf });
        m++; if (m > 11) { m = 0; y++; }
      }
    }
    return buckets;
  },

  // Накопительные ряды доходов/расходов по бакетам диапазона.
  // Бакет без операций продолжает накопленное значение предыдущего (не сбрасывается в 0),
  // включая ещё не наступившие бакеты текущего (незавершённого) диапазона — они просто
  // остаются плоскими на последнем достигнутом значении, конечная точка совпадает с totals().
  cumulativeSeries(state, from, to, granularity, txBaseFn) {
    const buckets = this.gridBuckets(from, to, granularity);
    const incByBucket = new Array(buckets.length).fill(0);
    const expByBucket = new Array(buckets.length).fill(0);
    const bucketIndex = d => {
      if (granularity === 'hour') return d.getHours();
      if (granularity === 'day') return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);
      return (d.getFullYear() - from.getFullYear()) * 12 + (d.getMonth() - from.getMonth());
    };
    this.txInRange(state, from, to).forEach(t => {
      const idx = Math.max(0, Math.min(buckets.length - 1, bucketIndex(new Date(t.date))));
      const v = txBaseFn(t);
      if (t.type === 'income') incByBucket[idx] += v; else expByBucket[idx] += v;
    });
    const out = [];
    let incCum = 0, expCum = 0;
    for (let i = 0; i < buckets.length; i++) {
      incCum += incByBucket[i]; expCum += expByBucket[i];
      out.push({
        from: buckets[i].from, to: buckets[i].to, label: buckets[i].label,
        income: Math.round(incCum * 100) / 100, expense: Math.round(expCum * 100) / 100,
      });
    }
    return out;
  },
};
