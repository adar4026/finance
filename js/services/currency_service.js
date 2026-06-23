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

  // ===== Конвертация между валютами (база — евро) =====
  // Курсы: сколько единиц валюты за 1 €. Редактируются пользователем (state.rates), иначе дефолт.
  DEFAULT_RATES: { '€':1, '$':1.08, '₽':100, '£':0.85, '₸':500, '₴':44 },
  _NORM: { EUR:'€', USD:'$', RUB:'₽', GBP:'£', KZT:'₸', UAH:'₴', 'US$':'$' },
  // привести код/символ валюты к символу-ключу
  norm(c) { return this._NORM[c] || c; },
  // единиц валюты c за 1 €
  perEur(state, c) {
    const k = this.norm(c);
    if (k === '€') return 1;
    return (state && state.rates && state.rates[k]) || this.DEFAULT_RATES[k] || 1;
  },
  // сумма amount в валюте from → в валюту to (через € как опору)
  conv(state, amount, from, to) {
    if (this.norm(from) === this.norm(to)) return Math.round(amount * 100) / 100;
    const eur = amount / this.perEur(state, from);
    return Math.round(eur * this.perEur(state, to) * 100) / 100;
  },
  // сумма amount в валюте cur → в базовую валюту (state.currency, по умолчанию €)
  toBase(state, amount, cur) {
    return this.conv(state, amount, cur, (state && state.currency) || '€');
  },
};
