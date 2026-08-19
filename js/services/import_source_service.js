// services/import_source_service.js — определение источника CSV и автоматическое
// сопоставление колонок (column mapping). Flutter → services/import_source_service.dart
//
// TASK_038. Раньше сопоставление жило внутри importCSV() как набор
// find(['date','дата',...]) по подстроке. Три проблемы этого подхода:
//   1. «Перевод: Счёт» содержит «счёт» и мог быть выбран как основной счёт —
//      лечилось отдельным костылём isTrans() в каждом вызове;
//   2. результат сопоставления никак не показывался пользователю: если
//      колонку угадали неверно, узнать это было негде;
//   3. не различались уверенное и предположительное совпадение, поэтому
//      исправить выбор вручную было нельзя.
// Здесь сопоставление — данные (какая колонка, насколько уверенно), которые
// UI показывает и разрешает переопределить.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.ImportSource = (function () {

  // Поля модели A-Lex Finance, которые умеет заполнять импорт.
  // required — без них импорт невозможен в принципе.
  const FIELDS = [
    { id: 'date',     label: 'Дата',              required: true },
    { id: 'amount',   label: 'Сумма',             required: true },
    { id: 'account',  label: 'Счёт',              required: false },
    { id: 'currency', label: 'Валюта',            required: false },
    { id: 'category', label: 'Категория',         required: false },
    { id: 'payee',    label: 'Контрагент',        required: false },
    { id: 'type',     label: 'Тип операции',      required: false },
    { id: 'tAccount', label: 'Перевод: счёт',     required: false },
    { id: 'tAmount',  label: 'Перевод: сумма',    required: false },
    { id: 'tCurrency',label: 'Перевод: валюта',   required: false },
    { id: 'tags',     label: 'Метки',             required: false },
    { id: 'location', label: 'Место',             required: false },
    { id: 'note',     label: 'Примечание',        required: false },
    { id: 'income',   label: 'Доход (отд. колонка)',  required: false },
    { id: 'expense',  label: 'Расход (отд. колонка)', required: false },
  ];

  // Точные названия (нормализованные) и подстроки-подсказки.
  // Локали: ru / en / es / de — Money Flow меняет заголовки вместе с языком
  // приложения, поэтому один русский вариант хардкодить нельзя.
  const RULES = {
    date:      { exact: ['дата','date','fecha','datum','дата операции','дата и время','date/time'], like: ['дата','date','fecha','datum'] },
    amount:    { exact: ['сумма','amount','importe','monto','betrag','cantidad','value','сумма операции'], like: ['сумма','amount','importe','monto','betrag'] },
    account:   { exact: ['счёт','счет','account','cuenta','konto','wallet','кошелёк','кошелек','карта'], like: ['счёт','счет','account','cuenta','konto','wallet'] },
    currency:  { exact: ['валюта','currency','moneda','divisa','währung','wahrung'], like: ['валюта','currency','moneda','divisa'] },
    category:  { exact: ['категория','category','categoria','categoría','kategorie','rubrica'], like: ['категор','categor','kategor','rubric'] },
    payee:     { exact: ['контрагент','payee','counterparty','beneficiary','получатель','плательщик','merchant','payer'], like: ['контрагент','payee','counterparty','beneficiar','merchant'] },
    type:      { exact: ['тип','type','tipo','art','тип операции','kind','flow'], like: ['тип','type','tipo'] },
    tags:      { exact: ['метки','теги','tags','labels','etiquetas','schlagworte'], like: ['метк','тег','tag','label','etiqueta'] },
    location:  { exact: ['место','location','place','lugar','ort'], like: ['место','locat','place','lugar'] },
    note:      { exact: ['примечание','заметка','комментарий','note','notes','nota','comment','description','descripción','descripcion','memo','notiz'], like: ['примеч','коммент','заметк','note','nota','comment','descrip','memo'] },
    income:    { exact: ['доход','income','ingreso','einnahme','credit','приход','поступление'], like: ['доход','income','ingreso','einnahme'] },
    expense:   { exact: ['расход','expense','gasto','ausgabe','debit','списание'], like: ['расход','expense','gasto','ausgabe'] },
    tAccount:  { exact: [], like: ['счёт','счет','account','cuenta','konto','wallet'], transfer: true },
    tAmount:   { exact: [], like: ['сумма','amount','importe','monto','betrag'], transfer: true },
    tCurrency: { exact: [], like: ['валюта','currency','moneda','divisa'], transfer: true },
  };

  // Признак «эта колонка относится к переводу». Money Flow пишет
  // «Перевод: Счёт» / «Transfer: Account»; встречается и «To account».
  const TRANSFER_RE = /(перевод|transfer|трансфер|übertrag|ubertrag|traspaso)/;

  function norm(h) {
    return String(h == null ? '' : h)
      .replace(/^﻿/, '')
      .toLowerCase()
      .replace(/[«»"'()\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isTransferHeader(h) { return TRANSFER_RE.test(norm(h)); }

  // Часть заголовка после «Перевод:» — по ней различаются счёт/сумма/валюта.
  function transferTail(h) {
    const n = norm(h);
    const m = n.match(/^(?:[^:]*)[:\-–]\s*(.+)$/);
    return m ? m[1] : n.replace(TRANSFER_RE, ' ').replace(/\s+/g, ' ').trim();
  }

  // Сопоставление колонок.
  // Возвращает { map: {field: index|-1}, confidence: {field: 'high'|'low'},
  //              unmapped: [индексы колонок, которым не нашлось поля] }
  //
  // Порядок важен: сначала разбираются transfer-колонки, потом основные, и
  // основные никогда не смотрят на колонки, помеченные как transfer. Именно
  // из-за обратного порядка прежний код был вынужден дублировать проверку
  // isTrans() в каждом findMain().
  function autoMap(header) {
    const heads = (header || []).map(norm);
    const isT = heads.map(h => TRANSFER_RE.test(h));
    const used = new Set();
    const map = {}, confidence = {};
    FIELDS.forEach(f => { map[f.id] = -1; });

    function claim(field, idx, level) {
      if (idx < 0 || used.has(idx)) return false;
      map[field] = idx; confidence[field] = level; used.add(idx);
      return true;
    }

    // 1) transfer-поля
    ['tAccount', 'tAmount', 'tCurrency'].forEach(field => {
      const like = RULES[field].like;
      let idx = heads.findIndex((h, i) => isT[i] && !used.has(i) && like.some(l => transferTail(header[i]) === l));
      if (claim(field, idx, 'high')) return;
      idx = heads.findIndex((h, i) => isT[i] && !used.has(i) && like.some(l => transferTail(header[i]).indexOf(l) >= 0));
      claim(field, idx, 'high');
    });

    // 2) основные поля — точное совпадение
    FIELDS.forEach(f => {
      const rule = RULES[f.id];
      if (!rule || rule.transfer || map[f.id] >= 0) return;
      const idx = heads.findIndex((h, i) => !isT[i] && !used.has(i) && rule.exact.indexOf(h) >= 0);
      claim(f.id, idx, 'high');
    });

    // 3) основные поля — совпадение по подстроке (менее уверенно)
    FIELDS.forEach(f => {
      const rule = RULES[f.id];
      if (!rule || rule.transfer || map[f.id] >= 0) return;
      const idx = heads.findIndex((h, i) => !isT[i] && !used.has(i) && rule.like.some(l => h.indexOf(l) >= 0));
      claim(f.id, idx, 'low');
    });

    const unmapped = [];
    heads.forEach((h, i) => { if (!used.has(i) && h) unmapped.push(i); });
    return { map, confidence, unmapped };
  }

  // Определение источника — по «отпечатку» набора заголовков.
  // Money Flow узнаётся по паре «Перевод: Сумма» + «Перевод: Счёт» рядом с
  // основными колонками; наш собственный экспорт — по полному совпадению
  // 12 колонок export_service.csv().
  const AF_CSV_HEAD = ['дата','счёт','сумма','валюта','категория','контрагент','перевод: счёт','перевод: сумма','перевод: валюта','метки','место','примечание'];

  function detect(header) {
    const heads = (header || []).map(norm);
    if (heads.length === AF_CSV_HEAD.length && AF_CSV_HEAD.every((h, i) => heads[i] === h)) {
      return { id: 'alexfinance', name: 'A-Lex Finance', confident: true };
    }
    const hasTransferPair = heads.filter(h => TRANSFER_RE.test(h)).length >= 2;
    const m = autoMap(header).map;
    if (hasTransferPair && m.date >= 0 && m.amount >= 0 && m.account >= 0) {
      return { id: 'moneyflow', name: 'Money Flow', confident: true };
    }
    return { id: 'csv', name: 'CSV', confident: false };
  }

  return { FIELDS, RULES, norm, autoMap, detect, isTransferHeader, transferTail, AF_CSV_HEAD };
})();
