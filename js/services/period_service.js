// services/period_service.js — единый источник расчёта диапазона «День/Неделя/Месяц/Год/Период» (TASK_003A).
// Flutter → services/period_service.dart
// Чистые функции: не обращаются к DOM/localStorage. Извлечены из ранее инлайновых
// periodRange()/periodLabel()/shiftPeriod() в index.html — поведение для Аналитики/Бюджетов
// не изменилось, index.html теперь делегирует расчёт сюда вместо дублирования логики.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Period = {
  // Границы недели — понедельник 00:00 → воскресенье 23:59:59.999, локальное время.
  weekBounds(day) {
    const d = new Date(day); d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7;
    const from = new Date(d); from.setDate(d.getDate() - dow);
    const to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23, 59, 59, 999);
    return { from, to };
  },
  dayBounds(day) {
    const from = new Date(day); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setHours(23, 59, 59, 999);
    return { from, to };
  },
  monthBounds(day) {
    return {
      from: new Date(day.getFullYear(), day.getMonth(), 1, 0, 0, 0, 0),
      to: new Date(day.getFullYear(), day.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  },
  yearBounds(day) {
    return {
      from: new Date(day.getFullYear(), 0, 1, 0, 0, 0, 0),
      to: new Date(day.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  },

  // {from,to} для активного period/anchor. Для 'custom' — существующий выбор пользователя
  // (customFrom/customTo), либо безопасный дефолт (начало текущего месяца → сейчас), если
  // пользователь ещё не выбирал диапазон — то же поведение, что было в исходном periodRange().
  range(period, anchor, customFrom, customTo) {
    const a = new Date(anchor); a.setHours(0, 0, 0, 0);
    if (period === 'day') return this.dayBounds(a);
    if (period === 'week') return this.weekBounds(a);
    if (period === 'month') return this.monthBounds(a);
    if (period === 'year') return this.yearBounds(a);
    if (period === 'custom') {
      const from = customFrom ? new Date(customFrom) : new Date(a.getFullYear(), a.getMonth(), 1);
      from.setHours(0, 0, 0, 0);
      const to = customTo ? new Date(customTo) : new Date();
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    return { from: new Date(2000, 0, 1), to: new Date(2999, 0, 1) };
  },

  // Новый anchor после сдвига на dir (−1/+1) в единицах активного period. 'custom' не сдвигается
  // (существующий UX — произвольный диапазон меняется только через выбор дат, не стрелками).
  shiftAnchor(period, anchor, dir) {
    const a = new Date(anchor);
    if (period === 'day') a.setDate(a.getDate() + dir);
    else if (period === 'week') a.setDate(a.getDate() + 7 * dir);
    else if (period === 'month') a.setMonth(a.getMonth() + dir);
    else if (period === 'year') a.setFullYear(a.getFullYear() + dir);
    return a;
  },

  // true, если candidateAnchor целиком описывает будущий (ещё не наступивший) диапазон.
  // Используется для запрета навигации вперёд относительно текущего момента.
  isFutureRange(period, candidateAnchor, now) {
    if (period === 'custom') return false; // произвольный диапазон стрелками не двигается
    now = now || new Date();
    const { from } = this.range(period, candidateAnchor);
    return from.getTime() > now.getTime();
  },

  // Человекочитаемая подпись диапазона — тот же формат, что использовался в общем navrow
  // для День/Неделя/Месяц/Год/Период (раздел 8 постановки TASK_003A).
  label(period, anchor, customFrom, customTo) {
    const a = anchor;
    if (period === 'day') return a.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    if (period === 'week') {
      const { from, to } = this.weekBounds(a);
      return from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' – ' + to.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
    if (period === 'month') return a.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    if (period === 'year') return String(a.getFullYear());
    if (period === 'custom') {
      const { from, to } = this.range(period, anchor, customFrom, customTo);
      if (from.getFullYear() <= 2000) return 'Всё время';
      return from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' – ' + to.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return 'Все операции';
  },
};
