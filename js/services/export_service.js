// services/export_service.js — экспорт CSV/JSON (PDF/Excel — позже). Flutter → services/export_service.dart
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Export = {
  toJSON(state) { return JSON.stringify(state, null, 2); },

  // CSV в формате, совместимом с импортом Money Flow
  toCSV(state) {
    const head = ['Дата','Счёт','Сумма','Валюта','Категория','Контрагент','Перевод: Счёт','Перевод: Сумма','Перевод: Валюта','Метки','Место','Примечание'];
    const accName = id => (state.accounts.find(a => a.id === id) || {}).name || '';
    const esc = v => { v = (v == null ? '' : String(v)); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const rows = state.tx.map(t => {
      if (t.type === 'transfer') {
        return [t.date, accName(t.from), -t.amount, '', '', '', accName(t.to), (t.toAmount != null ? t.toAmount : t.amount), '', '', '', t.note || ''];
      }
      const amt = t.type === 'income' ? t.amount : -t.amount;
      return [t.date, accName(t.account), amt, '', t.cat || '', '', '', '', '', '', '', t.note || ''];
    });
    return [head, ...rows].map(r => r.map(esc).join(',')).join('\n');
  },
};
