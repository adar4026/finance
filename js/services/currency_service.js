// services/currency_service.js — парсинг/форматирование/конвертация валют.
// Flutter → services/currency_service.dart
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Currency = {
  SYM: { EUR:'€', USD:'$', RUB:'₽', GBP:'£', KZT:'₸', UAH:'₴', PLN:'zł' },

  // "1.234,56 €" | "-1,234.56" | "2000" -> Number (NaN если не число)
  parse(s) {
    s = String(s).replace(/[^\d,.\-]/g, '').trim();
    if (!s || s === '-') return NaN;
    const hasC = s.includes(','), hasD = s.includes('.');
    if (hasC && hasD) {
      s = (s.lastIndexOf(',') > s.lastIndexOf('.'))
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
    } else if (hasC) {
      const p = s.split(',');
      s = (p.length === 2 && p[1].length <= 2) ? p[0] + '.' + p[1] : s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  },

  // Number -> "€1 234,56" (символ валюты по коду)
  format(n, cur) {
    cur = cur || '€';
    const v = Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    const sym = this.SYM[cur];
    return sym ? sym + v : (cur.length <= 2 ? cur + v : v + ' ' + cur);
  },

  convert(amount, exchangeRate) { return amount * exchangeRate; },
};
