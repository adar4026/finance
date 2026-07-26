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
};
