// services/finance_card_service.js — чистые расчёты для главной финансовой карточки (TASK_003).
// Flutter → services/finance_card_service.dart
// Не обращается к DOM/localStorage напрямую — только к переданному state и внешним callback'ам
// (totalCapitalFn/txBaseFn), поэтому полностью юнит-тестируем без браузера.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.FinanceCard = {
  // Границы календарного месяца по ЛОКАЛЬНОМУ времени (не UTC).
  monthBounds(monthDate) {
    const y = monthDate.getFullYear(), m = monthDate.getMonth();
    return {
      from: new Date(y, m, 1, 0, 0, 0, 0),
      to: new Date(y, m + 1, 0, 23, 59, 59, 999),
    };
  },

  // Первое число месяца, сдвинутого на n месяцев от monthDate (n может быть отрицательным).
  addMonths(monthDate, n) {
    return new Date(monthDate.getFullYear(), monthDate.getMonth() + n, 1);
  },

  // true, если monthDate позже текущего календарного месяца now (локально)
  isFutureMonth(monthDate, now) {
    now = now || new Date();
    const a = monthDate.getFullYear() * 12 + monthDate.getMonth();
    const b = now.getFullYear() * 12 + now.getMonth();
    return a > b;
  },

  isSameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  },

  // Операции месяца без переводов между собственными счетами (type==='transfer' — не доход/расход).
  txForMonth(state, monthDate) {
    const { from, to } = this.monthBounds(monthDate);
    return (state.tx || []).filter(t => {
      if (t.type !== 'income' && t.type !== 'expense') return false;
      const d = new Date(t.date);
      return d >= from && d <= to;
    });
  },

  // Доходы/расходы/поток за месяц. txBaseFn(t) -> сумма операции в базовой валюте.
  totals(state, monthDate, txBaseFn) {
    const list = this.txForMonth(state, monthDate);
    const incomeList = list.filter(t => t.type === 'income');
    const expenseList = list.filter(t => t.type === 'expense');
    const income = incomeList.reduce((s, t) => s + txBaseFn(t), 0);
    const expense = expenseList.reduce((s, t) => s + txBaseFn(t), 0);
    return {
      income, expense, flow: income - expense,
      incomeCount: incomeList.length, expenseCount: expenseList.length,
    };
  },

  // Капитал на конец месяца; для текущего (незавершённого) месяца — капитал на данный момент.
  capitalAtMonthEnd(state, monthDate, now, totalCapitalFn) {
    now = now || new Date();
    const { to } = this.monthBounds(monthDate);
    const end = to < now ? to : now;
    return totalCapitalFn(state, end);
  },

  // Изменение капитала за месяц = капитал(конец месяца) - капитал(момент перед началом месяца).
  // Совпадает с (доходы-расходы), т.к. переводы между своими счетами капитал не меняют.
  capitalChange(state, monthDate, now, totalCapitalFn) {
    const { from } = this.monthBounds(monthDate);
    const startCapital = totalCapitalFn(state, new Date(from.getTime() - 1));
    const endCapital = this.capitalAtMonthEnd(state, monthDate, now, totalCapitalFn);
    const change = endCapital - startCapital;
    const pct = Math.abs(startCapital) > 0.5 ? (change / Math.abs(startCapital)) * 100 : null;
    return { change, pct, startCapital, endCapital };
  },
};
