// services/tx_meta_service.js — чистая логика метаданных операции (TASK_015).
// Flutter → services/tx_meta_service.dart
//
// Три необязательных поля операции: payee (получатель/магазин), tags (метки),
// location (место — только текст, без GPS/геолокации). Здесь собраны ВСЕ
// правила их нормализации: один источник правды для формы, миграции, поиска
// и импорта, покрытый Node-тестом без DOM.
//
// Не обращается к DOM, localStorage и другим сервисам. Загрузка файла не
// имеет побочных эффектов — это требование инварианта совместимости
// (TASK_015 §0, сценарий С3: новый сервис может приехать к старому
// index.html, который его не вызывает).
//
// Принцип «пусто = ключа нет»: normalizeTx удаляет ключ, если после
// нормализации значение пустое. Старая операция и новая с пустым полем
// становятся структурно идентичны (TASK_015 §6.2).
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.TxMeta = {
  MAX_PAYEE: 80,
  MAX_TAGS: 10,
  MAX_TAG: 24,
  MAX_LOCATION: 120,
  MAX_SUGGESTIONS: 5,

  // Общая нормализация текста: схлопывание любых пробелов/переносов в один
  // пробел, trim, обрезка по code points (не по .length — иначе суррогатная
  // пара эмодзи разрезается пополам и получается «сломанный» символ).
  _text(v, max) {
    if (typeof v !== 'string') return '';
    const s = v.replace(/\s+/g, ' ').trim();
    if (!s) return '';
    const cp = Array.from(s);
    return cp.length <= max ? s : cp.slice(0, max).join('');
  },

  normalizePayee(v) { return this._text(v, this.MAX_PAYEE); },

  normalizeLocation(v) { return this._text(v, this.MAX_LOCATION); },

  // '#' — только элемент отображения, в данных не хранится (TASK_015 §6.4),
  // иначе '#еда' и 'еда' стали бы разными значениями.
  normalizeTag(v) {
    if (typeof v !== 'string') return '';
    const s = v.replace(/\s+/g, ' ').trim().replace(/^#+/, '').trim();
    if (!s) return '';
    const cp = Array.from(s);
    return cp.length <= this.MAX_TAG ? s : cp.slice(0, this.MAX_TAG).join('');
  },

  // Принимает массив или строку с разделителями (',', ';', перевод строки) —
  // строковая форма нужна импорту CSV и полю ввода формы. Пробел
  // разделителем НЕ является: теги могут быть многословными.
  // Дедупликация регистронезависимая, остаётся первое вхождение.
  normalizeTags(v) {
    let raw;
    if (Array.isArray(v)) raw = v;
    else if (typeof v === 'string') raw = v.split(/[,;\n]/);
    else return [];
    const out = [], seen = Object.create(null);
    for (let i = 0; i < raw.length; i++) {
      const t = this.normalizeTag(raw[i]);
      if (!t) continue;
      const k = t.toLocaleLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      out.push(t);
      if (out.length >= this.MAX_TAGS) break;
    }
    return out;
  },

  // Мутирует операцию на месте (как остальные шаги AF.Store.migrate).
  // Идемпотентна: повторный вызов над нормализованными данными их не меняет.
  normalizeTx(t) {
    if (!t || typeof t !== 'object') return t;
    const p = this.normalizePayee(t.payee);
    if (p) t.payee = p; else delete t.payee;
    const g = this.normalizeTags(t.tags);
    if (g.length) t.tags = g; else delete t.tags;
    const l = this.normalizeLocation(t.location);
    if (l) t.location = l; else delete t.location;
    return t;
  },

  // Добавка к корпусу поиска (index.html → txSearchText). Приведение к
  // нижнему регистру делает вызывающая сторона — как для остальных полей.
  metaSearchText(t) {
    if (!t || typeof t !== 'object') return '';
    const parts = [];
    if (t.payee) parts.push(t.payee);
    if (Array.isArray(t.tags) && t.tags.length) parts.push(t.tags.join(' '));
    if (t.location) parts.push(t.location);
    return parts.join(' ');
  },

  // Подсказки получателя вычисляются из существующих операций — отдельной
  // таблицы/справочника нет и не создаётся (TASK_015 §10.4).
  // Группировка регистронезависимая, показывается САМОЕ ЧАСТОЕ написание
  // (при равенстве — первое встреченное). Сортировка: сначала по частоте,
  // затем по свежести последней операции.
  // Вызывающая сторона подставляет значение ТОЛЬКО по явному выбору
  // пользователя — автозамены введённого текста не происходит.
  payeeSuggestions(txList, query, limit) {
    const q = this._text(query, this.MAX_PAYEE).toLocaleLowerCase();
    if (!q || !Array.isArray(txList)) return [];
    const max = (typeof limit === 'number' && limit > 0) ? limit : this.MAX_SUGGESTIONS;
    const groups = Object.create(null), order = [];
    for (let i = 0; i < txList.length; i++) {
      const t = txList[i];
      if (!t || typeof t !== 'object') continue;
      const p = this.normalizePayee(t.payee);
      if (!p) continue;
      const key = p.toLocaleLowerCase();
      if (key.indexOf(q) === -1) continue;
      let g = groups[key];
      if (!g) { g = groups[key] = { count: 0, last: '', variants: Object.create(null), vOrder: [] }; order.push(key); }
      g.count++;
      const d = (typeof t.date === 'string') ? t.date.slice(0, 10) : '';
      if (d > g.last) g.last = d;
      if (g.variants[p] === undefined) { g.variants[p] = 0; g.vOrder.push(p); }
      g.variants[p]++;
    }
    const list = order.map(key => {
      const g = groups[key];
      let best = g.vOrder[0], bestN = -1;
      for (let i = 0; i < g.vOrder.length; i++) {
        const v = g.vOrder[i];
        if (g.variants[v] > bestN) { bestN = g.variants[v]; best = v; }
      }
      return { value: best, count: g.count, last: g.last };
    });
    list.sort((a, b) =>
      (b.count - a.count) ||
      (a.last < b.last ? 1 : a.last > b.last ? -1 : 0) ||
      a.value.localeCompare(b.value));
    return list.slice(0, max).map(x => x.value);
  },
};
