// services/amount_input_service.js — правила ввода суммы в нативном поле (TASK_043).
// Flutter → services/amount_input_service.dart (TextInputFormatter)
//
// Чистые функции без DOM. Поле суммы — <input type="text" inputmode="decimal">:
// системная клавиатура iOS даёт цифры и разделитель (запятую или точку в
// зависимости от региона), аппаратная — что угодно. Здесь — единые правила:
//  - в интерфейсе разделитель — запятая; точка принимается и заменяется;
//  - не более одной запятой и не более двух цифр после неё;
//  - промежуточное состояние «45,» допустимо (поле не «ломается» при наборе);
//  - в модель (aExpr) всегда уходит каноническая строка с точкой ('45.52'),
//    пустое/неполное значение → '0' — никаких NaN ниже по цепочке.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.AmountInput = {
  MAX_INT_DIGITS: 12, // защита от абсурдно длинного ввода; расчёты в приложении — 2 знака

  // Что показывать в поле после каждого события input: только цифры и одна
  // запятая, ≤2 знака после неё, без ведущих нулей («007» → «7», «0,5» остаётся).
  sanitize(raw) {
    let s = (raw === null || raw === undefined) ? '' : String(raw);
    s = s.replace(/[.٫‚]/g, ',').replace(/[^\d,]/g, '');
    const i = s.indexOf(',');
    let int = i === -1 ? s : s.slice(0, i);
    let frac = i === -1 ? null : s.slice(i + 1).replace(/,/g, '').slice(0, 2);
    int = int.replace(/^0+(?=\d)/, '').slice(0, this.MAX_INT_DIGITS);
    if (frac === null) return int;
    if (int === '') int = '0';
    return int + ',' + frac;
  },

  // Каноническая строка для модели/aExpr: '45,5' → '45.5', '45,' → '45',
  // '' / ',' → '0'. Всегда парсится parseFloat без NaN.
  toExpr(display) {
    const s = this.sanitize(display);
    if (s === '') return '0';
    const [int, frac] = s.split(',');
    const f = (frac || '').replace(/0+$/, '');
    const n = (int || '0') + (f ? '.' + f : '');
    return n === '' ? '0' : n;
  },

  // Число из отображаемой строки (0 для пустого/неполного значения).
  toNumber(display) {
    const n = parseFloat(this.toExpr(display));
    return isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
  },

  // Завершение ввода (blur / «Готово»): '45,5' → '45,50', '45,' → '45',
  // ',5' → '0,50', '' → '0', '100' → '100' (целые — без принудительных ,00).
  normalize(display) {
    return this.fromNumber(this.toNumber(display));
  },

  // Отображаемая строка из числа (загрузка сохранённой операции, результат
  // калькулятора): 45.5 → '45,50', 100 → '100', 0/NaN → '0'.
  fromNumber(n) {
    const v = (typeof n === 'number' && isFinite(n)) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
    if (v <= 0) return '0';
    const s = v.toFixed(2);               // '45.50'
    const [int, frac] = s.split('.');
    return frac === '00' ? int : int + ',' + frac;
  },

  // Отображение вне фокуса: как fromNumber, но с разрядными группами в
  // формате приложения (ru-RU: «12 500,50»). При фокусе поле переводится в
  // fromNumber/sanitize-вид без пробелов — редактируется чистое число.
  display(n) {
    const v = (typeof n === 'number' && isFinite(n)) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
    if (v <= 0) return '0';
    const hasFrac = Math.round(v * 100) % 100 !== 0;
    try {
      return v.toLocaleString('ru-RU', { minimumFractionDigits: hasFrac ? 2 : 0, maximumFractionDigits: 2 });
    } catch (e) { return this.fromNumber(v); }
  },

  // Есть ли что показывать как «сумма > 0» (для знака/цвета во время набора).
  isPositive(display) {
    return this.toNumber(display) > 0;
  },
};
