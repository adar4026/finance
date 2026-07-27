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
  // TASK_015: метаданные операции. «Получатель» скрыт для перевода — перевод
  // выполняется между собственными счетами, роль адресата уже выполняет поле
  // «На счёт», и вторая строка с тем же смыслом создаёт неоднозначность.
  // Метки и место осмысленны для всех трёх типов и видимы всегда.
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
      payeeRow: !isTransfer,
      tagsRow: true,
      locationRow: true,
    };
  },

  // Заголовок в шапке полноэкранной страницы.
  titleFor(isEdit) {
    return isEdit ? 'Редактировать операцию' : 'Новая операция';
  },

  // Подпись основной кнопки — по типу операции (TASK_014, п. 7.8).
  saveLabelFor(type) {
    if (type === 'income') return 'Сохранить доход';
    if (type === 'transfer') return 'Сохранить перевод';
    return 'Сохранить расход';
  },

  // Человекочитаемая дата для строки «Дата» (TASK_014, п. 7.6).
  // Обе даты — 'YYYY-MM-DD' (тот же формат, что хранит #fDate и tx.date).
  // Сравнение строковое, поэтому не зависит от таймзоны и от времени суток;
  // время не показывается — в модели операции его нет.
  dateLabel(iso, todayIso) {
    if (!iso) return '';
    const day = String(iso).slice(0, 10);
    const today = String(todayIso || '').slice(0, 10);
    if (today) {
      if (day === today) return 'Сегодня';
      if (day === this.shiftIsoDay(today, -1)) return 'Вчера';
      if (day === this.shiftIsoDay(today, 1)) return 'Завтра';
    }
    const parts = day.split('-');
    if (parts.length !== 3) return day;
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const mi = Number(parts[1]) - 1;
    if (!(mi >= 0 && mi < 12)) return day;
    const label = Number(parts[2]) + ' ' + months[mi];
    // год показываем только если он отличается от текущего
    return (today && parts[0] === today.slice(0, 4)) ? label : label + ' ' + parts[0];
  },

  // Сдвиг даты 'YYYY-MM-DD' на n дней. UTC — чтобы переход через
  // летнее/зимнее время не сдвигал результат на сутки.
  shiftIsoDay(iso, n) {
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
    if (isNaN(d.getTime())) return '';
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  },
};
