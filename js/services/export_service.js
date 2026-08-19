// services/export_service.js — экспорт CSV / Excel(.xls) / PDF-отчёт. Flutter → services/export_service.dart
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Export = {
  _accName(state, id) { const a = (state.accounts || []).find(x => x.id === id); return a ? a.name : ''; },
  _catName(state, id) { const c = (state.cats || []).find(x => x.id === id); return c ? c.name : ''; },
  _subName(state, id) { const s = (state.subcats || []).find(x => x.id === id); return s ? s.name : ''; },
  _fmt(n) { return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 }); },

  toJSON(state) { return JSON.stringify(state, null, 2); },

  // Метаданные операции (TASK_015). Читаются защитно, без обращения к
  // AF.Services.TxMeta: export_service.js — отдельный файл и может приехать
  // с CDN раньше/позже остальных (инвариант совместимости TASK_015 §0, С4).
  _payee(t) { return typeof t.payee === 'string' ? t.payee : ''; },
  _tags(t) { return Array.isArray(t.tags) ? t.tags.join(', ') : ''; },
  _place(t) { return typeof t.location === 'string' ? t.location : ''; },
  // Иерархия «Категория / Подкатегория» в одной колонке — формат Money Flow,
  // который импорт уже умеет разбирать (resolveCatSub в index.html).
  _catPath(state, t) {
    const c = this._catName(state, t.cat), s = this._subName(state, t.subcategoryId);
    return c && s ? c + ' / ' + s : (c || s);
  },

  // CSV (формат Money Flow — с переводами, совместим с импортом; категории по имени)
  //
  // TASK_015 (ОВ-3): исправлено соответствие колонок. Раньше позиция 5,
  // подписанная «Контрагент», содержала ПОДКАТЕГОРИЮ — число значений
  // совпадало с числом заголовков, поэтому рассинхронизация ничем не
  // ловилась. Подкатегория переехала в колонку «Категория» (через ' / '),
  // позиция 5 отдана payee. Порядок и содержимое полей зафиксированы
  // regression-тестом tests/export_service.test.js.
  csv(txList, state) {
    const head = ['Дата','Счёт','Сумма','Валюта','Категория','Контрагент','Перевод: Счёт','Перевод: Сумма','Перевод: Валюта','Метки','Место','Примечание'];
    const esc = v => { v = (v == null ? '' : String(v)); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const cur = state.currency || '€';
    const rows = txList.map(t => {
      if (t.type === 'transfer') return [t.date, this._accName(state, t.from), -t.amount, cur, '', this._payee(t), this._accName(state, t.to), (t.toAmount != null ? t.toAmount : t.amount), cur, this._tags(t), this._place(t), t.note || ''];
      const amt = t.type === 'income' ? t.amount : -t.amount;
      const acc = state.accounts.find(a => a.id === t.account);
      return [t.date, this._accName(state, t.account), amt, (acc && acc.currency) || cur, this._catPath(state, t), this._payee(t), '', '', '', this._tags(t), this._place(t), t.note || ''];
    });
    return [head, ...rows].map(r => r.map(esc).join(',')).join('\n');
  },

  // Excel — HTML-таблица (Excel/Numbers открывают как .xls)
  xlsHtml(txList, state, label) {
    const typeName = { income: 'Доход', expense: 'Расход', transfer: 'Перевод' };
    const rows = txList.map(t => {
      const isT = t.type === 'transfer';
      const cat = isT ? '' : this._catName(state, t.cat);
      const sub = isT ? '' : this._subName(state, t.subcategoryId);
      const acc = isT ? (this._accName(state, t.from) + ' → ' + this._accName(state, t.to)) : this._accName(state, t.account);
      const sign = t.type === 'income' ? '' : (t.type === 'expense' ? '-' : '');
      const e = s => String(s == null ? '' : s).replace(/</g, '&lt;');
      return `<tr><td>${t.date}</td><td>${typeName[t.type]}</td><td>${cat}</td><td>${sub}</td><td>${acc}</td><td>${sign}${this._fmt(t.amount)}</td><td>${(state.currency||'€')}</td><td>${e(t.note)}</td><td>${e(this._payee(t))}</td><td>${e(this._tags(t))}</td><td>${e(this._place(t))}</td></tr>`;
    }).join('');
    return `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>
      <th>Дата</th><th>Тип</th><th>Категория</th><th>Подкатегория</th><th>Счёт</th><th>Сумма</th><th>Валюта</th><th>Комментарий</th><th>Контрагент</th><th>Метки</th><th>Место</th>
      </tr></thead><tbody>${rows}</tbody></table></body></html>`;
  },

  // ===== Excel (.xlsx) — TASK_038 =====
  // xlsHtml() выше остаётся как есть: это HTML-таблица с расширением .xls,
  // на неё ссылается regression-тест TASK_015 и её формат больше не меняем.
  // Экран экспорта пользуется парой xlsxColumns()/xlsxRows(): данные здесь
  // типизированы (дата — датой, сумма — числом), поэтому в готовом файле
  // работают сортировка, фильтр и суммирование, чего HTML-таблица не давала.
  //
  // Знак суммы — тот же, что в CSV: расход отрицательный, доход
  // положительный, перевод показывается со стороны счёта-источника. Иначе
  // сумма столбца в Excel не сошлась бы с итогом приложения.
  XLSX_COLUMNS: [
    { title: 'Дата',         type: 'date',  width: 12, key: 'date' },
    { title: 'Тип',          type: 'text',  width: 10, key: 'type' },
    { title: 'Сумма',        type: 'money', width: 13, key: 'amount' },
    { title: 'Валюта',       type: 'text',  width: 8,  key: 'currency' },
    { title: 'Счёт',         type: 'text',  width: 18, key: 'account' },
    { title: 'Категория',    type: 'text',  width: 18, key: 'category' },
    { title: 'Подкатегория', type: 'text',  width: 18, key: 'subcategory' },
    { title: 'Контрагент',   type: 'text',  width: 18, key: 'payee' },
    { title: 'Метки',        type: 'text',  width: 16, key: 'tags' },
    { title: 'Место',        type: 'text',  width: 16, key: 'location' },
    { title: 'Примечание',   type: 'text',  width: 26, key: 'note' },
  ],

  xlsxColumns() { return this.XLSX_COLUMNS.slice(); },

  xlsxRows(txList, state) {
    const TYPE = { income: 'Доход', expense: 'Расход', transfer: 'Перевод' };
    const baseCur = state.currency || '€';
    return (txList || []).map(t => {
      if (t.type === 'transfer') {
        return [t.date, TYPE.transfer, -Math.abs(t.amount), baseCur,
          this._accName(state, t.from) + ' → ' + this._accName(state, t.to),
          '', '', this._payee(t), this._tags(t), this._place(t), t.note || ''];
      }
      const acc = (state.accounts || []).find(a => a.id === t.account);
      const amt = t.type === 'income' ? Math.abs(t.amount) : -Math.abs(t.amount);
      return [t.date, TYPE[t.type] || t.type, amt, (acc && acc.currency) || baseCur,
        this._accName(state, t.account), this._catName(state, t.cat), this._subName(state, t.subcategoryId),
        this._payee(t), this._tags(t), this._place(t), t.note || ''];
    });
  },

  // Готовый файл .xlsx (Uint8Array). Сервис писателя может не приехать при
  // рассинхронизации CDN — тот же инвариант совместимости, что у TxMeta в
  // TASK_015: тогда возвращаем null, а экран честно говорит, что формат
  // недоступен, вместо падения обработчика кнопки.
  xlsx(txList, state, label) {
    const X = (window.AF && AF.Services && AF.Services.Xlsx);
    if (!X || typeof X.build !== 'function') return null;
    return X.build({
      sheetName: (label ? String(label).slice(0, 28) : 'Операции'),
      columns: this.xlsxColumns(),
      rows: this.xlsxRows(txList, state),
    });
  },

  // PDF-отчёт (печать через window.print)
  reportHTML(state, txList, label) {
    const cur = state.currency || '€';
    const inc = txList.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = txList.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const byCat = {}; txList.filter(t => t.type === 'expense').forEach(t => byCat[t.cat] = (byCat[t.cat] || 0) + t.amount);
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const f = n => cur + this._fmt(n);
    const rowsHtml = txList.slice().sort((a, b) => b.date.localeCompare(a.date)).map(t => {
      const isT = t.type === 'transfer';
      const name = isT ? ('Перевод: ' + this._accName(state, t.from) + ' → ' + this._accName(state, t.to)) : this._catName(state, t.cat);
      const col = t.type === 'income' ? '#1aa179' : (t.type === 'expense' ? '#e23b48' : '#6b7180');
      const sign = t.type === 'income' ? '+' : (t.type === 'expense' ? '−' : '');
      return `<tr><td>${t.date}</td><td>${name}${t.note ? ' · ' + t.note : ''}</td><td style="text-align:right;color:${col};white-space:nowrap">${sign}${f(t.amount)}</td></tr>`;
    }).join('');
    const topHtml = top.map(([id, v]) => `<tr><td>${this._catName(state, id)}</td><td style="text-align:right">${f(v)}</td><td style="text-align:right;color:#888">${Math.round(v / (exp || 1) * 100)}%</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Alex Finance — отчёт</title>
      <style>body{font-family:-apple-system,Arial,sans-serif;color:#16181f;padding:24px;max-width:760px;margin:0 auto}
      h1{font-size:22px;margin:0 0 2px}.sub{color:#6b7180;font-size:13px;margin-bottom:20px}
      .cards{display:flex;gap:12px;margin-bottom:22px}.card{flex:1;border:1px solid #e6eaf2;border-radius:10px;padding:12px 14px}
      .card .l{font-size:12px;color:#6b7180}.card .v{font-size:20px;font-weight:700;margin-top:4px}
      h2{font-size:15px;margin:22px 0 8px}table{width:100%;border-collapse:collapse;font-size:13px}
      th{text-align:left;color:#6b7180;font-weight:600;border-bottom:2px solid #e6eaf2;padding:6px 4px}
      td{padding:6px 4px;border-bottom:1px solid #f0f1f5}@media print{body{padding:0}}</style></head><body>
      <h1>💰 Alex Finance</h1><div class="sub">Финансовый отчёт · ${label} · сформировано ${new Date().toLocaleDateString('ru-RU')}</div>
      <div class="cards">
        <div class="card"><div class="l">Доходы</div><div class="v" style="color:#1aa179">+${f(inc)}</div></div>
        <div class="card"><div class="l">Расходы</div><div class="v" style="color:#e23b48">−${f(exp)}</div></div>
        <div class="card"><div class="l">Результат</div><div class="v">${inc - exp >= 0 ? '+' : '−'}${f(Math.abs(inc - exp))}</div></div>
      </div>
      ${top.length ? `<h2>Топ категорий расходов</h2><table><tbody>${topHtml}</tbody></table>` : ''}
      <h2>Операции (${txList.length})</h2><table><thead><tr><th>Дата</th><th>Категория</th><th style="text-align:right">Сумма</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      </body></html>`;
  },
};
