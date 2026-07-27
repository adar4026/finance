// services/tx_form_service.js — чистая логика полноэкранной формы операции (TASK_013).
// Flutter → services/tx_form_service.dart
// Не обращается к DOM/localStorage. Выделено из index.html, чтобы тип по
// умолчанию, видимость полей по типу и заголовок страницы были покрыты
// Node-тестом без DOM — index.html делегирует расчёт сюда вместо
// повторения условий isT==='transfer' в каждом обработчике.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.TxForm = {
  TYPES: ['expense', 'income', 'transfer'],
  DEFAULT_TYPE: 'expense',

  isValidType(t) {
    return this.TYPES.indexOf(t) !== -1;
  },

  // Какие блоки формы видны для данного типа операции (раздел 8 постановки
  // TASK_013 — «форма показывает только соответствующие типу поля»).
  // Расход/Доход используют одинаковый набор полей (категория/подкатегория/
  // счёт/чек/расписание), Перевод — отдельную пару счетов вместо категории.
  visibilityFor(type) {
    const isTransfer = type === 'transfer';
    return {
      transRow: isTransfer,
      transDisplay: isTransfer,
      amountDisplay: !isTransfer,
      catBlock: !isTransfer,
      subcatBlock: !isTransfer,
      receiptBlock: !isTransfer,
      scheduleBlock: !isTransfer,
      accField: !isTransfer,
    };
  },

  // Заголовок в шапке полноэкранной страницы.
  titleFor(isEdit) {
    return isEdit ? 'Редактировать операцию' : 'Новая операция';
  },
};
