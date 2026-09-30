// services/place_breakdown_service.js — детализация категории по местам трат (TASK_060).
// Flutter → services/place_breakdown_service.dart
//
// «Место / магазин» — существующее необязательное поле операции `payee`
// (TASK_015): свободный текст, уже хранится, попадает в backup/export/import.
// Нового поля нет. Ключ места операции:
//   1) payee, если заполнен;
//   2) иначе — имя структурной подкатегории (subcategoryId → state.subcats),
//      чтобы прежние подкатегории оставались видимыми в статистике;
//   3) иначе — NONE («Без подкатегории»).
// Ключ регистронезависимый («Mercadona» ≡ «mercadona ») — payee и
// подкатегория с одинаковым именем сливаются в одну строку.
//
// Чистые функции: не обращаются к DOM, localStorage и state. Сумма операции
// в базовой валюте и имя подкатегории приходят колбэками от вызывающей
// стороны (index.html → txBase / subcatById) — те же правила валюты, что в
// остальной аналитике. Загрузка файла без побочных эффектов (инвариант
// совместимости TASK_015 §0).
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.PlaceBreakdown = {
  NONE: '',                      // ключ строки «Без подкатегории»
  NONE_LABEL: 'Без подкатегории',
  REST_LABEL: 'Остальные',
  MAX_SEGMENTS: 8,               // больше — 7 крупнейших + «Остальные»
  MAX_SUGGESTIONS: 8,
  // Различимые, но спокойные цвета: средняя насыщенность читается и на
  // светлой, и на тёмной карточке. Нейтральные — для «Без подкатегории»
  // и свёрнутого хвоста, чтобы они не спорили с настоящими местами.
  PALETTE: ['#5b7cfa', '#2fb383', '#f2a33a', '#e2667f', '#8e6cf0', '#2fb4c9', '#f08a4b', '#a3b93c'],
  NONE_COLOR: '#9aa3b2',
  REST_COLOR: '#c3c9d4',

  // Та же нормализация, что у payee (TxMeta): схлопывание пробелов, trim.
  _text(v) {
    if (typeof v !== 'string') return '';
    return v.replace(/\s+/g, ' ').trim();
  },

  // Имя места операции (как показывать) — '' если места нет.
  placeName(t, subName) {
    if (!t || typeof t !== 'object') return '';
    const p = this._text(t.payee);
    if (p) return p;
    if (t.subcategoryId && typeof subName === 'function') {
      const s = this._text(subName(t.subcategoryId));
      if (s) return s;
    }
    return '';
  },

  // Ключ места операции: регистронезависимое имя либо NONE.
  placeKey(t, subName) {
    const n = this.placeName(t, subName);
    return n ? n.toLocaleLowerCase() : this.NONE;
  },

  // Операции категории нужного типа (по умолчанию — только расходы).
  // Доходы и переводы в расход не попадают никогда.
  _inCat(t, catId, type) {
    return !!t && typeof t === 'object' && t.type === (type || 'expense') && t.cat === catId;
  },

  // Детализация одной категории по местам.
  //   txList   — операции УЖЕ отфильтрованные по периоду;
  //   opts     — { type='expense', amountOf(t)→число, subName(id)→строка }.
  // Возврат: { total, count, rows:[{key,label,amount,count,share,isNone}] }
  // rows отсортированы по сумме ↓ (при равенстве — по числу операций ↓,
  // затем по имени). total = сумма строк, поэтому инвариант
  // «Σ строк = сумма категории» выполняется точно, без погрешности порядка
  // сложения.
  breakdown(txList, catId, opts) {
    const o = opts || {};
    const type = o.type || 'expense';
    const amountOf = typeof o.amountOf === 'function' ? o.amountOf : (t => +t.amount || 0);
    const groups = Object.create(null), order = [];
    let count = 0;
    (Array.isArray(txList) ? txList : []).forEach(t => {
      if (!this._inCat(t, catId, type)) return;
      const name = this.placeName(t, o.subName);
      const key = name ? name.toLocaleLowerCase() : this.NONE;
      let g = groups[key];
      if (!g) {
        g = groups[key] = { key, amount: 0, count: 0, variants: Object.create(null), vOrder: [] };
        order.push(key);
      }
      g.amount += amountOf(t);
      g.count++;
      count++;
      if (name) {
        if (g.variants[name] === undefined) { g.variants[name] = 0; g.vOrder.push(name); }
        g.variants[name]++;
      }
    });
    const rows = order.map(key => {
      const g = groups[key];
      let label = this.NONE_LABEL;
      if (key !== this.NONE) {
        // самое частое написание; при равенстве — первое встреченное
        let best = g.vOrder[0], bestN = -1;
        g.vOrder.forEach(v => { if (g.variants[v] > bestN) { bestN = g.variants[v]; best = v; } });
        label = best;
      }
      return { key, label, amount: g.amount, count: g.count, share: 0, isNone: key === this.NONE };
    });
    rows.sort((a, b) => (b.amount - a.amount) || (b.count - a.count) || a.label.localeCompare(b.label, 'ru'));
    const total = rows.reduce((s, r) => s + r.amount, 0);
    rows.forEach(r => { r.share = total > 0 ? r.amount / total * 100 : 0; });
    return { total, count, rows };
  },

  // Сегменты кольца + цвет каждой строки (мутирует rows: row.color).
  // До MAX_SEGMENTS строк — сегмент на строку; больше — MAX_SEGMENTS−1
  // крупнейших + один «Остальные» (строки хвоста получают его цвет).
  // «Без подкатегории» всегда нейтрального цвета и цвет палитры не занимает.
  segments(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const max = this.MAX_SEGMENTS;
    const head = list.length > max ? list.slice(0, max - 1) : list.slice();
    const tail = list.length > max ? list.slice(max - 1) : [];
    let pi = 0;
    const segs = head.map(r => {
      r.color = r.isNone ? this.NONE_COLOR : this.PALETTE[pi++ % this.PALETTE.length];
      return { label: r.label, amount: r.amount, color: r.color, keys: [r.key] };
    });
    if (tail.length) {
      tail.forEach(r => { r.color = this.REST_COLOR; });
      segs.push({
        label: this.REST_LABEL,
        amount: tail.reduce((s, r) => s + r.amount, 0),
        color: this.REST_COLOR,
        keys: tail.map(r => r.key),
        isRest: true,
      });
    }
    return segs;
  },

  // Операции одного места внутри категории (для экрана операций).
  // key === NONE → только операции категории без места.
  // key === null/undefined → все операции категории.
  filter(txList, catId, key, opts) {
    const o = opts || {};
    const type = o.type || 'expense';
    return (Array.isArray(txList) ? txList : []).filter(t => {
      if (!this._inCat(t, catId, type)) return false;
      if (key === null || key === undefined) return true;
      return this.placeKey(t, o.subName) === key;
    });
  },

  // Подсказки мест для формы: payee, ранее использованные В ЭТОЙ категории
  // и этом типе (Mercadona из «Продуктов» не попадёт в «Авто»). Только
  // payee — подкатегории показываются своей полосой чипов. Сортировка по
  // частоте ↓, затем по свежести ↓; показывается самое частое написание.
  //   opts: { type='expense', limit, excludeId } — excludeId исключает
  //   редактируемую операцию, чтобы её же значение не «подсказывало» себя.
  suggestions(txList, catId, opts) {
    const o = opts || {};
    const type = o.type || 'expense';
    const limit = (typeof o.limit === 'number' && o.limit > 0) ? o.limit : this.MAX_SUGGESTIONS;
    const groups = Object.create(null), order = [];
    (Array.isArray(txList) ? txList : []).forEach(t => {
      if (!this._inCat(t, catId, type)) return;
      if (o.excludeId != null && t.id === o.excludeId) return;
      const p = this._text(t.payee);
      if (!p) return;
      const key = p.toLocaleLowerCase();
      let g = groups[key];
      if (!g) { g = groups[key] = { count: 0, last: '', variants: Object.create(null), vOrder: [] }; order.push(key); }
      g.count++;
      const d = (typeof t.date === 'string' ? t.date.slice(0, 10) : '') + ' ' + (typeof t.time === 'string' ? t.time : '');
      if (d > g.last) g.last = d;
      if (g.variants[p] === undefined) { g.variants[p] = 0; g.vOrder.push(p); }
      g.variants[p]++;
    });
    const list = order.map(key => {
      const g = groups[key];
      let best = g.vOrder[0], bestN = -1;
      g.vOrder.forEach(v => { if (g.variants[v] > bestN) { bestN = g.variants[v]; best = v; } });
      return { value: best, count: g.count, last: g.last };
    });
    list.sort((a, b) =>
      (b.count - a.count) ||
      (a.last < b.last ? 1 : a.last > b.last ? -1 : 0) ||
      a.value.localeCompare(b.value, 'ru'));
    return list.slice(0, limit).map(x => x.value);
  },

  // Изменение к прошлому периоду без бессмысленного «∞%».
  // → { kind:'none' }            — нет данных в обоих периодах;
  //   { kind:'new' }             — в прошлом периоде было 0, сейчас > 0;
  //   { kind:'pct', pct, up }    — обычное относительное изменение.
  change(cur, prev) {
    const c = +cur || 0, p = +prev || 0;
    if (p <= 0.005) return c > 0.005 ? { kind: 'new' } : { kind: 'none' };
    const pct = (c - p) / p * 100;
    return { kind: 'pct', pct: Math.abs(pct), up: pct >= 0 };
  },
};
