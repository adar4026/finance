// services/account_service.js — капитал, баланс, распределение.
// Flutter → services/account_service.dart
// Бизнес-правила Part 3: баланс = старт + операции (+переводы); капитал = сумма АКТИВНЫХ счетов; переводы капитал не меняют.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Account = {
  // Баланс счёта на дату endDate (или на текущий момент, если не задан)
  balance(state, accId, endDate) {
    const a = state.accounts.find(x => x.id === accId);
    let b = a ? (a.start || 0) : 0;
    state.tx.forEach(t => {
      if (endDate && new Date(t.date) > endDate) return;
      if (t.type === 'transfer') {
        if (t.from === accId) b -= t.amount;
        if (t.to === accId)   b += (t.toAmount != null ? t.toAmount : t.amount);
      } else if (t.account === accId) {
        b += (t.type === 'income' ? t.amount : -t.amount);
      }
    });
    return b;
  },

  // Активные счета (не в архиве)
  active(state) { return state.accounts.filter(a => !a.isArchived); },

  // Общий капитал = сумма балансов активных счетов, приведённых к базовой валюте
  totalCapital(state, endDate) {
    const C = AF.Services.Currency;
    return this.active(state).reduce((s, a) =>
      s + C.toBase(state, this.balance(state, a.id, endDate), a.currency || state.currency), 0);
  },

  // Распределение капитала по счетам с долей (%); доля считается по базовой валюте
  distribution(state) {
    const C = AF.Services.Currency;
    const items = this.active(state).map(a => {
      const balance = this.balance(state, a.id);
      return { account: a, balance, base: C.toBase(state, balance, a.currency || state.currency) };
    });
    const total = items.reduce((s, i) => s + Math.max(0, i.base), 0) || 1;
    return items.map(i => ({ ...i, share: Math.max(0, i.base) / total * 100 }));
  },

  share(state, accId) {
    const d = this.distribution(state).find(i => i.account.id === accId);
    return d ? d.share : 0;
  },
};
