// services/import_service.js — план импорта CSV: строки → операции, дубликаты,
// валидация, атомарное применение. Flutter → services/import_service.dart
//
// TASK_038. Ключевое отличие от прежнего importCSV(): здесь НИЧЕГО не пишется
// ни в state, ни в хранилище. Прежний код создавал счета и категории прямо в
// цикле разбора (ensureAcc/ensureCat пушили в state.accounts/state.cats), то
// есть база менялась ещё до того, как пользователь увидел хоть одну цифру, а
// целостность держалась исключительно на откате из TASK_026.
//
// Контракт:
//   buildPlan(...)  → чистый план: что будет добавлено и почему (ничего не меняет)
//   validate(plan)  → проверка плана до записи
//   apply(state,pl) → НОВОЕ состояние (клон + добавления); запись делает UI
//                     через AF.Store.save() — единственная точка записи в проекте
//   undo(state,id)  → НОВОЕ состояние без сущностей конкретного импорта
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Import = (function () {
  const MAX_ROWS = 50000;                  // выше этого файл не импортируем
  const EMOJI_POOL = ['🏷️','🧾','🍔','🚗','🏠','🛍️','💊','🎮','📄','☕','✈️','📚','🐾','💼','🎁','📈','🔑','🎵','👕','⛽'];
  const COLOR_POOL = ['#ff6b6b','#ffa94d','#ffd43b','#da77f2','#9775fa','#4dabf7','#3bc9db','#69db7c','#a9e34b','#f783ac'];
  const ACC_EMOJI = '💳';

  const PROBLEM = {
    NO_DATE: 'Не удалось разобрать дату',
    NO_AMOUNT: 'Сумма не распознана',
    ZERO_AMOUNT: 'Нулевая сумма',
    NO_TRANSFER_AMOUNT: 'Перевод без суммы',
    SAME_ACCOUNT: 'Перевод на тот же счёт',
    TOO_MANY: 'Строка за пределом лимита файла',
  };

  // ---- Дата ----------------------------------------------------------
  // Локальная дата 'YYYY-MM-DD' без Date.parse и без toISOString: и то и
  // другое даёт сдвиг на сутки при разборе 'YYYY-MM-DD' как UTC (H-5 из
  // TASK_025). Здесь дата собирается из разобранных чисел напрямую.
  function pad2(n) { return String(n).padStart(2, '0'); }
  const MONTHS_RU = ['янв','фев','мар','апр','ма','июн','июл','авг','сен','окт','ноя','дек'];

  function parseDate(raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    let m;
    // ISO / 2024-02-01 / 2024.02.01 (+ необязательное время)
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return mk(+m[1], +m[2], +m[3]);
    // 01.02.2024 / 01/02/2024 / 1-2-2024 — день первым (формат Money Flow ru/eu)
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) {
      let d = +m[1], mo = +m[2];
      if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }   // очевидный US-порядок
      return mk(+m[3], mo, d);
    }
    // 01.02.24 — двузначный год
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/))) {
      let d = +m[1], mo = +m[2];
      if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }
      return mk(2000 + (+m[3]), mo, d);
    }
    // 1 фев 2024 / 1 февраля 2024
    if ((m = s.match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i))) {
      const idx = MONTHS_RU.findIndex(p => m[2].toLowerCase().indexOf(p) === 0);
      if (idx >= 0) return mk(+m[3], idx + 1, +m[1]);
    }
    return null;
  }

  function mk(y, mo, d) {
    if (!(y >= 1900 && y <= 2999) || !(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31)) return null;
    // 31 февраля — не дата: проверяем реальным календарём (локальный конструктор)
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return y + '-' + pad2(mo) + '-' + pad2(d);
  }

  // ---- Сумма и валюта ------------------------------------------------
  function parseAmount(raw) {
    const C = (AF.Services && AF.Services.Currency);
    if (C && typeof C.parse === 'function') return C.parse(raw);
    const n = parseFloat(String(raw).replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? NaN : n;
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  // Валюта приводится к символу теми же правилами, что и весь проект.
  // Незнакомая валюта не отбрасывает строку — операция импортируется в
  // валюте счёта, но строка помечается предупреждением: молча подставить
  // чужую валюту к сумме нельзя, это искажает капитал.
  function normCurrency(raw, fallback) {
    const C = (AF.Services && AF.Services.Currency);
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return { cur: fallback, known: true };
    const n = C ? C.norm(s.toUpperCase()) : s;
    if (C && (C.DEFAULT_RATES[n] || C.SYM[s.toUpperCase()])) return { cur: n, known: true };
    if (C && C.DEFAULT_RATES[s]) return { cur: s, known: true };
    return { cur: fallback, known: false, raw: s };
  }

  // ---- Тип операции --------------------------------------------------
  const INCOME_RE = /(доход|приход|income|ingres|deposit|credit|einnahme|поступл)/i;
  const EXPENSE_RE = /(расход|списан|expense|gasto|withdraw|debit|ausgabe)/i;

  // ---- Отпечаток операции (детектор дубликатов) ----------------------
  // Одного поля мало: сумма повторяется, дата повторяется, категория
  // повторяется. Отпечаток собирается из всего, что делает операцию
  // операцией, — и для перевода включает счёт-получателя, иначе два
  // перевода одной суммы в один день на разные счета склеились бы в один.
  function normText(v) {
    const M = (AF.Services && AF.Services.ImportMapping);
    if (M && typeof M.normalizeName === 'function') return M.normalizeName(v);
    return String(v == null ? '' : v).toLowerCase().trim();
  }

  function fingerprint(t) {
    const amt = round2(Math.abs(Number(t.amount) || 0)).toFixed(2);
    if (t.type === 'transfer') {
      const to = round2(Math.abs(Number(t.toAmount != null ? t.toAmount : t.amount) || 0)).toFixed(2);
      return ['transfer', t.date, amt, to, String(t.from || ''), String(t.to || '')].join('|');
    }
    return [
      t.type, t.date, amt,
      String(t.currency || ''), String(t.account || ''), String(t.cat || ''),
      normText(t.payee || ''), normText(t.note || ''),
    ].join('|');
  }

  // Мультимножество отпечатков существующих операций. Именно мультимножество,
  // а не Set: две реально разные, но одинаково выглядящие операции (два кофе
  // по 2.50 в один день) должны импортироваться обе. Дубликатом считается
  // только та строка, для которой в базе уже есть НЕИЗРАСХОДОВАННЫЙ двойник.
  function existingFingerprints(txList) {
    const m = new Map();
    (txList || []).forEach(t => {
      const f = fingerprint(t);
      m.set(f, (m.get(f) || 0) + 1);
    });
    return m;
  }

  // ---- Построение плана ----------------------------------------------
  // body        — строки без заголовка
  // mapping     — { field: columnIndex } из ImportSource.autoMap (или из UI)
  // accountPlan / categoryPlan — решения пользователя (use / create)
  // Возвращает план; state НЕ изменяется ни на одном шаге.
  function buildPlan(opts) {
    const o = opts || {};
    const state = o.state || {};
    const body = o.body || [];
    const map = o.mapping || {};
    const skipDuplicates = o.skipDuplicates !== false;
    const baseCur = state.currency || '€';
    const batchId = o.batchId || ('imp' + Date.now().toString(36));

    const accounts = (state.accounts || []).slice();
    const cats = (state.cats || []).slice();
    const subcats = (state.subcats || []).slice();

    const M = AF.Services.ImportMapping;
    const accDecision = new Map();
    (o.accountPlan || []).forEach(p => accDecision.set(p.key, p));
    const catDecision = new Map();
    (o.categoryPlan || []).forEach(p => catDecision.set(p.key, p));

    // id для новых сущностей выдаются заранее и проверяются против уже
    // существующих И против выданных в этой же пачке (TASK_026, M-8).
    const usedAcc = new Set(accounts.map(a => String(a.id)));
    const usedCat = new Set(cats.map(c => String(c.id)));
    const usedSub = new Set(subcats.map(s => String(s.id)));
    const usedTx = new Set((state.tx || []).map(t => String(t.id)));
    const newAccounts = [], newCategories = [], newSubcategories = [];
    const accResolved = new Map();       // ключ имени → id
    const catResolved = new Map();
    const subResolved = new Map();

    function nextId(prefix, used) {
      const id = AF.Ids.unique(prefix, used);
      used.add(id); return id;
    }

    // Счёт по внешнему имени. Пустое имя → счёт по умолчанию (первый в базе):
    // операция без счёта всё равно должна куда-то попасть, иначе теряется
    // сумма, а это хуже, чем неточный счёт.
    function resolveAccount(rawName, currency) {
      const name = String(rawName == null ? '' : rawName).trim();
      const key = M.planKeyForAccount(name);
      if (!key) return accounts.length ? accounts[0].id : null;
      if (accResolved.has(key)) return accResolved.get(key);
      const decision = accDecision.get(key);
      if (decision && decision.action === 'use' && decision.targetId) {
        accResolved.set(key, decision.targetId); return decision.targetId;
      }
      if (!decision) {
        const m = M.matchAccount(name, accounts);
        if (m.match) { accResolved.set(key, m.match.id); return m.match.id; }
      }
      const id = nextId(AF.Ids.PREFIX.account, usedAcc);
      newAccounts.push({
        id, name, emoji: ACC_EMOJI, type: 'bank', start: 0, isArchived: false,
        color: COLOR_POOL[(accounts.length + newAccounts.length) % COLOR_POOL.length],
        currency: currency || baseCur, importBatchId: batchId, createdAt: Date.now(),
      });
      accResolved.set(key, id);
      return id;
    }

    // Категория по внешнему имени с учётом иерархии «Категория / Подкатегория»
    // (формат нашего же экспорта — round-trip не должен создавать категорию
    // с буквальным именем «Продукты / Супермаркеты»).
    function resolveCategory(rawName, type) {
      const raw = String(rawName == null ? '' : rawName).trim();
      const sep = raw.indexOf(' / ');
      const catName = sep < 0 ? raw : raw.slice(0, sep).trim();
      const subName = sep < 0 ? '' : raw.slice(sep + 3).trim();
      const catId = resolveCategoryLeaf(catName || raw, type);
      if (!subName || !catId) return { cat: catId, sub: null };
      const skey = catId + '|' + M.normalizeName(subName);
      if (subResolved.has(skey)) return { cat: catId, sub: subResolved.get(skey) };
      const exists = M.matchSubcategory(subName, subcats, catId);
      if (exists.match) { subResolved.set(skey, exists.match.id); return { cat: catId, sub: exists.match.id }; }
      const id = nextId(AF.Ids.PREFIX.subcategory, usedSub);
      newSubcategories.push({ id, categoryId: catId, name: subName, createdAt: Date.now(), importBatchId: batchId });
      subResolved.set(skey, id);
      return { cat: catId, sub: id };
    }

    function resolveCategoryLeaf(name, type) {
      const clean = String(name == null ? '' : name).trim() || (type === 'income' ? 'Доход' : 'Другое');
      const key = M.planKeyForCategory(clean, type);
      if (catResolved.has(key)) return catResolved.get(key);
      const decision = catDecision.get(key);
      if (decision && decision.action === 'use' && decision.targetId) {
        catResolved.set(key, decision.targetId); return decision.targetId;
      }
      if (!decision) {
        const m = M.matchCategory(clean, cats, type);
        if (m.match) { catResolved.set(key, m.match.id); return m.match.id; }
      }
      const id = nextId(AF.Ids.PREFIX.category, usedCat);
      const n = cats.length + newCategories.length;
      newCategories.push({
        id, name: clean, type,
        emoji: EMOJI_POOL[n % EMOJI_POOL.length],
        color: COLOR_POOL[n % COLOR_POOL.length],
        importBatchId: batchId, createdAt: Date.now(),
      });
      catResolved.set(key, id);
      return id;
    }

    const cell = (r, field) => {
      const i = map[field];
      if (i == null || i < 0 || i >= r.length) return '';
      return String(r[i] == null ? '' : r[i]).trim();
    };

    const items = [], problems = [], warnings = [];
    const seenExisting = existingFingerprints(state.tx);
    const batchSeen = new Map();
    let duplicates = 0;

    for (let k = 0; k < body.length; k++) {
      const r = body[k];
      const rowNo = k + 2;                                  // с учётом строки заголовка
      if (items.length >= MAX_ROWS) { problems.push({ row: rowNo, reason: PROBLEM.TOO_MANY }); continue; }

      const date = parseDate(cell(r, 'date'));
      if (!date) { problems.push({ row: rowNo, reason: PROBLEM.NO_DATE, raw: cell(r, 'date') }); continue; }

      const note = cell(r, 'note');
      const payee = cell(r, 'payee');
      const tags = cell(r, 'tags');
      const location = cell(r, 'location');
      const rowCurRes = normCurrency(cell(r, 'currency'), baseCur);
      if (!rowCurRes.known) warnings.push({ row: rowNo, reason: 'Неизвестная валюта «' + rowCurRes.raw + '» — взята ' + rowCurRes.cur });
      const rowCur = rowCurRes.cur;
      const mainRaw = cell(r, 'amount');
      const mainAmt = mainRaw === '' ? NaN : parseAmount(mainRaw);
      const tAccName = cell(r, 'tAccount');
      const tAmtRaw = cell(r, 'tAmount');

      // ===== Перевод между счетами =====
      // Модель переводов проекта: ОДНА операция type:'transfer' с from/to и
      // amount/toAmount. Двух записей (расход + доход) не создаётся — иначе
      // перевод удвоил бы обороты в аналитике и бюджетах.
      if (tAccName && tAmtRaw !== '') {
        const tAmt = parseAmount(tAmtRaw);
        const tCurRes = normCurrency(cell(r, 'tCurrency'), rowCur);
        const mainName = cell(r, 'account');
        let from, fromAmt, fromCur, to, toAmt, toCur;
        if (!isNaN(mainAmt) && mainAmt < 0) {
          from = mainName; fromAmt = -mainAmt; fromCur = rowCur;
          to = tAccName; toAmt = Math.abs(tAmt); toCur = tCurRes.cur;
        } else {
          from = tAccName; fromAmt = Math.abs(tAmt); fromCur = tCurRes.cur;
          to = mainName; toAmt = Math.abs(mainAmt); toCur = rowCur;
        }
        if (!(fromAmt > 0) && !(toAmt > 0)) { problems.push({ row: rowNo, reason: PROBLEM.NO_TRANSFER_AMOUNT }); continue; }
        if (!(fromAmt > 0)) fromAmt = toAmt;
        if (!(toAmt > 0)) toAmt = fromAmt;
        const fromId = resolveAccount(from, fromCur);
        const toId = resolveAccount(to, toCur);
        if (fromId && toId && fromId === toId) { problems.push({ row: rowNo, reason: PROBLEM.SAME_ACCOUNT }); continue; }
        const tx = { id: null, type: 'transfer', from: fromId, to: toId, date,
          amount: round2(fromAmt), toAmount: round2(toAmt) };
        if (note) tx.note = note;
        applyMeta(tx, payee, tags, location);
        pushItem(tx, rowNo);
        continue;
      }

      // ===== Доход / расход =====
      let amount, type;
      if (mainRaw !== '' && !isNaN(mainAmt)) {
        const tv = cell(r, 'type');
        if (tv) type = INCOME_RE.test(tv) ? 'income' : EXPENSE_RE.test(tv) ? 'expense' : (mainAmt < 0 ? 'expense' : 'income');
        else type = mainAmt < 0 ? 'expense' : 'income';
        amount = Math.abs(mainAmt);
      } else {
        // раздельные колонки «Доход» / «Расход»
        const incRaw = cell(r, 'income'), expRaw = cell(r, 'expense');
        const inc = incRaw === '' ? NaN : parseAmount(incRaw);
        const exp = expRaw === '' ? NaN : parseAmount(expRaw);
        if (!isNaN(exp) && Math.abs(exp) > 0) { type = 'expense'; amount = Math.abs(exp); }
        else if (!isNaN(inc) && Math.abs(inc) > 0) { type = 'income'; amount = Math.abs(inc); }
        else { problems.push({ row: rowNo, reason: mainRaw === '' ? PROBLEM.NO_AMOUNT : PROBLEM.NO_AMOUNT, raw: mainRaw }); continue; }
      }
      if (!(amount > 0)) { problems.push({ row: rowNo, reason: PROBLEM.ZERO_AMOUNT, raw: mainRaw }); continue; }

      const rc = resolveCategory(cell(r, 'category'), type);
      const tx = { id: null, type, amount: round2(amount), cat: rc.cat, date, currency: rowCur,
        account: resolveAccount(cell(r, 'account'), rowCur) };
      if (rc.sub) tx.subcategoryId = rc.sub;
      if (note) tx.note = note;
      applyMeta(tx, payee, tags, location);
      pushItem(tx, rowNo);
    }

    function pushItem(tx, rowNo) {
      const f = fingerprint(tx);
      const left = seenExisting.get(f) || 0;
      const usedInBatch = batchSeen.get(f) || 0;
      if (skipDuplicates && left > usedInBatch) {
        batchSeen.set(f, usedInBatch + 1);
        duplicates++;
        return;
      }
      batchSeen.set(f, usedInBatch + 1);
      tx.id = nextId(AF.Ids.PREFIX.tx, usedTx);
      tx.importBatchId = batchId;
      tx.createdAt = Date.now();
      items.push({ tx, row: rowNo });
    }

    // Метаданные операции (TASK_015): пусто = ключа нет.
    function applyMeta(tx, payee, tags, location) {
      const TM = (AF.Services && AF.Services.TxMeta);
      if (TM && typeof TM.normalizeTx === 'function') {
        if (payee) tx.payee = payee;
        if (tags) tx.tags = tags;
        if (location) tx.location = location;
        TM.normalizeTx(tx);
        return tx;
      }
      if (payee) tx.payee = String(payee).trim();
      if (tags) tx.tags = String(tags).split(/[,;]/).map(s => s.trim()).filter(Boolean);
      if (location) tx.location = String(location).trim();
      return tx;
    }

    const dates = items.map(i => i.tx.date).sort();
    return {
      batchId,
      items, problems, warnings, duplicates,
      newAccounts, newCategories, newSubcategories,
      counts: {
        rows: body.length,
        toImport: items.length,
        duplicates,
        problems: problems.length,
        warnings: warnings.length,
        newAccounts: newAccounts.length,
        newCategories: newCategories.length,
        newSubcategories: newSubcategories.length,
        transfers: items.filter(i => i.tx.type === 'transfer').length,
      },
      dateFrom: dates[0] || null,
      dateTo: dates[dates.length - 1] || null,
    };
  }

  // ---- Валидация плана ----------------------------------------------
  // Выполняется ДО записи. Любая найденная проблема означает, что импорт не
  // состоится целиком: частично импортированное состояние недопустимо.
  function validate(plan, state) {
    if (!plan || !Array.isArray(plan.items)) return AF.Result.err({ code: 'BAD_PLAN', message: 'Импорт не подготовлен.' });
    if (!plan.items.length) return AF.Result.err({ code: 'NOTHING_TO_IMPORT', message: 'Нет операций для импорта.' });
    const accIds = new Set(((state && state.accounts) || []).map(a => String(a.id)));
    plan.newAccounts.forEach(a => accIds.add(String(a.id)));
    const catIds = new Set(((state && state.cats) || []).map(c => String(c.id)));
    plan.newCategories.forEach(c => catIds.add(String(c.id)));
    const subIds = new Set(((state && state.subcats) || []).map(s => String(s.id)));
    plan.newSubcategories.forEach(s => subIds.add(String(s.id)));
    const txIds = new Set(((state && state.tx) || []).map(t => String(t.id)));

    for (let i = 0; i < plan.items.length; i++) {
      const t = plan.items[i].tx;
      const where = 'строка ' + plan.items[i].row;
      if (!t.id) return bad('Операция без идентификатора (' + where + ')');
      if (txIds.has(String(t.id))) return bad('Повторяющийся идентификатор операции (' + where + ')');
      txIds.add(String(t.id));
      if (!t.date || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return bad('Некорректная дата (' + where + ')');
      if (!isFinite(t.amount) || !(t.amount > 0)) return bad('Некорректная сумма (' + where + ')');
      if (t.type === 'transfer') {
        if (!accIds.has(String(t.from)) || !accIds.has(String(t.to))) return bad('Перевод ссылается на несуществующий счёт (' + where + ')');
        if (t.from === t.to) return bad('Перевод на тот же счёт (' + where + ')');
        if (!isFinite(t.toAmount) || !(t.toAmount > 0)) return bad('Некорректная сумма перевода (' + where + ')');
      } else {
        if (t.type !== 'income' && t.type !== 'expense') return bad('Неизвестный тип операции (' + where + ')');
        if (!accIds.has(String(t.account))) return bad('Операция ссылается на несуществующий счёт (' + where + ')');
        if (!catIds.has(String(t.cat))) return bad('Операция ссылается на несуществующую категорию (' + where + ')');
        if (t.subcategoryId && !subIds.has(String(t.subcategoryId))) return bad('Операция ссылается на несуществующую подкатегорию (' + where + ')');
      }
    }
    return AF.Result.ok(true);
    function bad(msg) { return AF.Result.err({ code: 'VALIDATION_FAILED', message: 'Импорт остановлен: ' + msg + '. Данные не изменены.' }); }
  }

  // ---- Применение ----------------------------------------------------
  // Возвращает НОВОЕ состояние. Исходный state не меняется ни на байт —
  // именно это делает импорт откатываемым: при отказе записи достаточно
  // выбросить результат, в памяти по-прежнему прежняя база.
  function apply(state, plan, meta) {
    const v = validate(plan, state);
    if (!v.ok) return v;
    let next;
    try { next = JSON.parse(JSON.stringify(state)); }
    catch (e) { return AF.Result.err({ code: 'CLONE_FAILED', message: 'Не удалось подготовить данные к импорту.' }); }
    next.accounts = (next.accounts || []).concat(plan.newAccounts);
    next.cats = (next.cats || []).concat(plan.newCategories);
    next.subcats = (next.subcats || []).concat(plan.newSubcategories);
    next.tx = (next.tx || []).concat(plan.items.map(i => i.tx));
    next.importBatches = (next.importBatches || []).concat([{
      id: plan.batchId,
      createdAt: Date.now(),
      source: (meta && meta.source) || 'CSV',
      fileName: (meta && meta.fileName) || '',
      counts: {
        tx: plan.items.length,
        accounts: plan.newAccounts.length,
        categories: plan.newCategories.length,
        subcategories: plan.newSubcategories.length,
        duplicates: plan.duplicates,
        problems: plan.problems.length,
      },
    }]);
    return AF.Result.ok(next);
  }

  // ---- Отмена импорта -------------------------------------------------
  // Удаляются только сущности, созданные этим импортом. Счёт или категория
  // сохраняются, если на них успели сослаться посторонние операции: молча
  // оборвать ссылку у операции пользователя нельзя.
  function undo(state, batchId) {
    if (!batchId) return AF.Result.err({ code: 'NO_BATCH', message: 'Нечего отменять.' });
    let next;
    try { next = JSON.parse(JSON.stringify(state)); }
    catch (e) { return AF.Result.err({ code: 'CLONE_FAILED', message: 'Не удалось подготовить отмену импорта.' }); }
    const before = (next.tx || []).length;
    next.tx = (next.tx || []).filter(t => t.importBatchId !== batchId);
    const removedTx = before - next.tx.length;

    const accUsed = new Set();
    next.tx.forEach(t => { if (t.account) accUsed.add(String(t.account)); if (t.from) accUsed.add(String(t.from)); if (t.to) accUsed.add(String(t.to)); });
    next.accounts = (next.accounts || []).filter(a => a.importBatchId !== batchId || accUsed.has(String(a.id)));

    const catUsed = new Set(); const subUsed = new Set();
    next.tx.forEach(t => { if (t.cat) catUsed.add(String(t.cat)); if (t.subcategoryId) subUsed.add(String(t.subcategoryId)); });
    const removedCats = [];
    next.cats = (next.cats || []).filter(c => {
      const keep = c.importBatchId !== batchId || catUsed.has(String(c.id));
      if (!keep) removedCats.push(String(c.id));
      return keep;
    });
    const keptCatIds = new Set(next.cats.map(c => String(c.id)));
    next.subcats = (next.subcats || []).filter(s =>
      (s.importBatchId !== batchId || subUsed.has(String(s.id))) && keptCatIds.has(String(s.categoryId)));
    // бюджет удалённой категории иначе остался бы «висеть» на несуществующем id
    removedCats.forEach(id => { if (next.budgets) delete next.budgets[id]; });
    next.importBatches = (next.importBatches || []).filter(b => b.id !== batchId);
    // счёт мог остаться единственным — база без счетов невалидна
    if (!next.accounts.length) return AF.Result.err({ code: 'UNDO_UNSAFE', message: 'Отмена оставила бы приложение без счетов.' });
    return AF.Result.ok({ state: next, removedTx });
  }

  // ---- Сводка по файлу (экран анализа) -------------------------------
  function analyze(body, mapping, state) {
    const map = mapping || {};
    const cell = (r, field) => {
      const i = map[field];
      if (i == null || i < 0 || i >= r.length) return '';
      return String(r[i] == null ? '' : r[i]).trim();
    };
    const dates = [], currencies = new Set(), accountNames = new Set(), categoryNames = new Set();
    let parsable = 0, badDates = 0;
    (body || []).forEach(r => {
      const d = parseDate(cell(r, 'date'));
      if (d) { dates.push(d); parsable++; } else badDates++;
      const c = cell(r, 'currency'); if (c) currencies.add(c.toUpperCase());
      const a = cell(r, 'account'); if (a) accountNames.add(a);
      const ta = cell(r, 'tAccount'); if (ta) accountNames.add(ta);
      const cat = cell(r, 'category');
      if (cat) categoryNames.add(cat.indexOf(' / ') > 0 ? cat.slice(0, cat.indexOf(' / ')).trim() : cat);
    });
    dates.sort();
    return {
      rows: (body || []).length,
      parsableRows: parsable,
      badDates,
      dateFrom: dates[0] || null,
      dateTo: dates[dates.length - 1] || null,
      currencies: Array.from(currencies),
      accounts: Array.from(accountNames),
      categories: Array.from(categoryNames),
    };
  }

  // Список пар «имя категории → тип» для плана категорий: тип определяется
  // так же, как при разборе строки, иначе доходная категория из файла
  // подставится к расходной с тем же именем.
  function collectCategoryEntries(body, mapping) {
    const map = mapping || {};
    const cell = (r, field) => {
      const i = map[field];
      if (i == null || i < 0 || i >= r.length) return '';
      return String(r[i] == null ? '' : r[i]).trim();
    };
    const out = [];
    (body || []).forEach(r => {
      if (cell(r, 'tAccount') && cell(r, 'tAmount') !== '') return;    // перевод — без категории
      const raw = cell(r, 'category');
      if (!raw) return;
      const name = raw.indexOf(' / ') > 0 ? raw.slice(0, raw.indexOf(' / ')).trim() : raw;
      const amtRaw = cell(r, 'amount');
      const amt = amtRaw === '' ? NaN : parseAmount(amtRaw);
      const tv = cell(r, 'type');
      let type;
      if (tv) type = INCOME_RE.test(tv) ? 'income' : EXPENSE_RE.test(tv) ? 'expense' : (amt < 0 ? 'expense' : 'income');
      else if (!isNaN(amt)) type = amt < 0 ? 'expense' : 'income';
      else type = cell(r, 'income') !== '' ? 'income' : 'expense';
      out.push({ name, type });
    });
    return out;
  }

  function collectAccountNames(body, mapping) {
    const map = mapping || {};
    const out = [];
    (body || []).forEach(r => {
      ['account', 'tAccount'].forEach(f => {
        const i = map[f];
        if (i == null || i < 0 || i >= r.length) return;
        const v = String(r[i] == null ? '' : r[i]).trim();
        if (v) out.push(v);
      });
    });
    return out;
  }

  return {
    MAX_ROWS, PROBLEM,
    parseDate, parseAmount, normCurrency, fingerprint, existingFingerprints,
    analyze, collectAccountNames, collectCategoryEntries,
    buildPlan, validate, apply, undo,
  };
})();
