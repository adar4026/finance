// services/tx_time_service.js — время операции и порядок внутри дня (TASK_044).
// Flutter → services/tx_time_service.dart
//
// Операция хранит дату как 'YYYY-MM-DD' (tx.date) и — с TASK_044 —
// необязательное время как 'HH:MM' (tx.time, локальное время устройства,
// без секунд и таймзоны). Здесь собраны ВСЕ правила: нормализация значения,
// текущие локальные дата/время для новой операции и компаратор порядка
// операций внутри одного дня. Один источник правды для формы, миграции и
// всех списков, сгруппированных по дням, покрытый Node-тестом без DOM.
//
// Не обращается к DOM, localStorage и другим сервисам. Загрузка файла не
// имеет побочных эффектов (инвариант совместимости TASK_015 §0).
//
// Принцип «пусто = ключа нет» (как payee/tags/location): невалидное или
// пустое время не хранится — normalizeTx удаляет ключ. Старой операции
// время НЕ подставляется: отсутствие ключа — штатное состояние.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.TxTime = {
  // 'HH:MM' | 'H:MM' | 'HH:MM:SS' → 'HH:MM'; всё остальное → ''.
  normalize(v) {
    if (typeof v !== 'string') return '';
    const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*$/.exec(v);
    if (!m) return '';
    const h = Number(m[1]), mi = Number(m[2]);
    if (!(h >= 0 && h <= 23 && mi >= 0 && mi <= 59)) return '';
    return String(h).padStart(2, '0') + ':' + m[2];
  },

  // Минуты от полуночи (0..1439) для сравнения; -1 — времени нет.
  minutes(v) {
    const s = this.normalize(v);
    if (!s) return -1;
    return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  },

  // Локальные дата/время устройства. Не toISOString(): он даёт UTC, и около
  // полуночи дата и время новой операции разъехались бы на сутки.
  localDate(d) {
    const x = d instanceof Date ? d : new Date();
    if (isNaN(x.getTime())) return '';
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  },
  localTime(d) {
    const x = d instanceof Date ? d : new Date();
    if (isNaN(x.getTime())) return '';
    return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
  },

  // Мутирует операцию на месте (как остальные шаги AF.Store.migrate).
  // Идемпотентна. Ничего, кроме ключа time, не трогает.
  normalizeTx(t) {
    if (!t || typeof t !== 'object') return t;
    const s = this.normalize(t.time);
    if (s) t.time = s; else delete t.time;
    return t;
  },

  // Метка создания из id — резервный порядок для операций без времени.
  // До TASK_026 id = Date.now() (число); с TASK_026 — 't' + Date.now() в
  // base36 + '-…'. Неразбираемый id → 0 (дальше решает позиция в массиве).
  idStamp(id) {
    if (typeof id === 'number') return isFinite(id) ? id : 0;
    if (typeof id !== 'string') return 0;
    if (/^\d+$/.test(id)) return Number(id);
    const m = /^t([0-9a-z]+)-/.exec(id);
    if (m) { const n = parseInt(m[1], 36); return isFinite(n) ? n : 0; }
    return 0;
  },

  // Порядок внутри одного дня (новые сверху):
  //  1) по времени по убыванию;
  //  2) запись со временем выше записи без времени;
  //  3) без времени — по метке создания из id по убыванию;
  //  4) 0 — вызывающая сторона (sortDay) решает по позиции в массиве.
  compareInDay(a, b) {
    const ta = this.minutes(a && a.time), tb = this.minutes(b && b.time);
    if (ta !== tb) return tb - ta;
    const sa = this.idStamp(a && a.id), sb = this.idStamp(b && b.id);
    if (sa !== sb) return sb - sa;
    return 0;
  },

  // Дни по убыванию, внутри дня — compareInDay.
  compare(a, b) {
    const da = String((a && a.date) || '').slice(0, 10), db = String((b && b.date) || '').slice(0, 10);
    if (da !== db) return da < db ? 1 : -1;
    return this.compareInDay(a, b);
  },

  // Полностью детерминированная сортировка: при равенстве компаратора выше
  // тот, кто позже в исходном массиве (позже добавлен). Не зависит от
  // стабильности Array.prototype.sort. Возвращает новый массив.
  sortDay(items) {
    if (!Array.isArray(items)) return [];
    return items.map((t, i) => ({ t, i }))
      .sort((x, y) => this.compareInDay(x.t, y.t) || (y.i - x.i))
      .map(x => x.t);
  },

  // То же для списка за несколько дней (дни по убыванию).
  sortAll(items) {
    if (!Array.isArray(items)) return [];
    return items.map((t, i) => ({ t, i }))
      .sort((x, y) => this.compare(x.t, y.t) || (y.i - x.i))
      .map(x => x.t);
  },
};
