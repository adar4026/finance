// services/export_service.js — экспорт CSV / Excel(.xls) / PDF-отчёт. Flutter → services/export_service.dart
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Export = {
  _accName(state, id) { const a = (state.accounts || []).find(x => x.id === id); return a ? a.name : ''; },
  _catName(state, id) { const c = (state.cats || []).find(x => x.id === id); return c ? c.name : ''; },
  _subName(state, id) { const s = (state.subcats || []).find(x => x.id === id); return s ? s.name : ''; },
  _fmt(n) { return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 }); },

  toJSON(state) { return JSON.stringify(state, null, 2); },

  // CSV (формат Money Flow — с переводами, совместим с импортом; категории по имени)
  csv(txList, state) {
    const head = ['Дата','Счёт','Сумма','Валюта','Категория','Контрагент','Перевод: Счёт','Перевод: Сумма','Перевод: Валюта','Метки','Место','Примечание'];
    const esc = v => { v = (v == null ? '' : String(v)); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const cur = state.currency || '€';
    const rows = txList.map(t => {
      if (t.type === 'transfer') return [t.date, this._accName(state, t.from), -t.amount, cur, '', '', this._accName(state, t.to), (t.toAmount != null ? t.toAmount : t.amount), cur, '', '', t.note || ''];
      const amt = t.type === 'income' ? t.amount : -t.amount;
      const acc = state.accounts.find(a => a.id === t.account);
      return [t.date, this._accName(state, t.account), amt, (acc && acc.currency) || cur, this._catName(state, t.cat), this._subName(state, t.subcategoryId), '', '', '', '', '', t.note || ''];
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
      return `<tr><td>${t.date}</td><td>${typeName[t.type]}</td><td>${cat}</td><td>${sub}</td><td>${acc}</td><td>${sign}${this._fmt(t.amount)}</td><td>${(state.currency||'€')}</td><td>${(t.note||'').replace(/</g,'&lt;')}</td></tr>`;
    }).join('');
    return `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>
      <th>Дата</th><th>Тип</th><th>Категория</th><th>Подкатегория</th><th>Счёт</th><th>Сумма</th><th>Валюта</th><th>Комментарий</th>
      </tr></thead><tbody>${rows}</tbody></table></body></html>`;
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
