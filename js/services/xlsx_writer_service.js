// services/xlsx_writer_service.js — минимальный писатель настоящего .xlsx (OOXML).
// Flutter → services/xlsx_writer_service.dart (пакет excel).
//
// TASK_038. Раньше «Excel-экспорт» отдавал HTML-таблицу с расширением .xls:
// Excel открывал её через legacy-импортёр и показывал предупреждение о
// несовпадении формата, а числа и даты приезжали текстом. Здесь собирается
// настоящая книга .xlsx: числа числами, даты — датами с форматом dd.mm.yyyy,
// поэтому в файле сразу работают суммирование, сортировка и фильтр.
//
// Внешних зависимостей нет и быть не может (проект — статические файлы без
// сборки), поэтому ZIP пишется вручную. Метод хранения — «store» (без
// сжатия): deflate потребовал бы собственной реализации ради экономии места,
// которая на выгрузке операций не нужна. Метод 0 полностью легален по
// спецификации ZIP и открывается всеми читателями.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Xlsx = (function () {

  // ---- CRC32 (обязательное поле заголовка ZIP) -----------------------
  const CRC_TABLE = (function () {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = -1;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const out = []; const s = unescape(encodeURIComponent(str));
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return new Uint8Array(out);
  }

  // ---- ZIP (метод store) ---------------------------------------------
  function zip(files) {
    const chunks = [], central = [];
    let offset = 0;
    files.forEach(f => {
      const name = utf8(f.name);
      const data = (f.data instanceof Uint8Array) ? f.data : utf8(String(f.data));
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);        // сигнатура локального заголовка
      lv.setUint16(4, 20, true);                // версия, необходимая для распаковки
      lv.setUint16(6, 0x0800, true);            // флаг: имена файлов в UTF-8
      lv.setUint16(8, 0, true);                 // метод 0 — без сжатия
      lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true);  // время/дата (фиксированные)
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);      // «сжатый» размер равен исходному
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      local.set(name, 30);
      chunks.push(local, data);

      const cen = new Uint8Array(46 + name.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);           // смещение локального заголовка
      cen.set(name, 46);
      central.push(cen);
      offset += local.length + data.length;
    });
    const centralSize = central.reduce((s, c) => s + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    const all = chunks.concat(central, [end]);
    const total = all.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    all.forEach(c => { out.set(c, p); p += c.length; });
    return out;
  }

  // ---- XML -----------------------------------------------------------
  // Управляющие символы (кроме табуляции и переводов строки) недопустимы в
  // XML 1.0: один такой символ в примечании пользователя сделал бы всю книгу
  // нечитаемой. Отбор идёт по коду символа, а не регулярным выражением с
  // диапазоном управляющих символов, — такой литерал сам по себе нечитаем.
  function stripControl(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 32 || c === 9 || c === 10 || c === 13) out += s.charAt(i);
    }
    return out;
  }

  function esc(v) {
    return stripControl(String(v == null ? '' : v))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function colName(i) {
    let s = '', n = i + 1;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  // Дата → серийный номер Excel (эпоха 1899-12-30, отсюда +25569 к Unix-дням).
  // Считаем по календарным полям через Date.UTC, а не по локальным
  // миллисекундам: часовой пояс и переход на летнее время иначе сдвигают
  // дату на сутки — та же ловушка, что H-5 в TASK_025.
  function dateSerial(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 + 25569;
  }

  const STYLE = { DEFAULT: 0, HEADER: 1, DATE: 2, MONEY: 3 };

  // columns: [{ title, type:'text'|'number'|'date'|'money', width }]
  // rows:    [[значение, ...], ...]
  function build(opts) {
    const o = opts || {};
    const columns = o.columns || [];
    const rows = o.rows || [];
    const sheetName = (esc(o.sheetName || 'Операции').slice(0, 31)) || 'Sheet1';

    const cols = columns.map((c, i) =>
      '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.width || 14) + '" customWidth="1"/>').join('');

    const headerCells = columns.map((c, i) =>
      '<c r="' + colName(i) + '1" s="' + STYLE.HEADER + '" t="inlineStr"><is><t xml:space="preserve">' + esc(c.title) + '</t></is></c>').join('');

    function textCell(ref, v) {
      return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
    }

    const bodyRows = rows.map((r, ri) => {
      const n = ri + 2;
      const cells = columns.map((c, ci) => {
        const ref = colName(ci) + n;
        const v = r[ci];
        if (v == null || v === '') return '';
        if (c.type === 'date') {
          const s = dateSerial(v);
          return (s == null) ? textCell(ref, v) : '<c r="' + ref + '" s="' + STYLE.DATE + '"><v>' + s + '</v></c>';
        }
        if (c.type === 'number' || c.type === 'money') {
          const num = Number(v);
          if (!isFinite(num)) return textCell(ref, v);
          return '<c r="' + ref + '" s="' + (c.type === 'money' ? STYLE.MONEY : STYLE.DEFAULT) + '"><v>' + num + '</v></c>';
        }
        return textCell(ref, v);
      }).join('');
      return '<row r="' + n + '">' + cells + '</row>';
    }).join('');

    const lastRef = colName(Math.max(columns.length - 1, 0)) + (rows.length + 1);
    const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:' + lastRef + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/><cols>' + cols + '</cols>' +
      '<sheetData><row r="1">' + headerCells + '</row>' + bodyRows + '</sheetData>' +
      '<autoFilter ref="A1:' + lastRef + '"/></worksheet>';

    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';

    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';

    const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="' + sheetName + '" sheetId="1" r:id="rId1"/></sheets></workbook>';

    const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';

    // numFmtId 164 — dd.mm.yyyy, 165 — денежный с двумя знаками.
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEFEFF6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

    return zip([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rels },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
      { name: 'xl/styles.xml', data: styles },
      { name: 'xl/worksheets/sheet1.xml', data: sheet },
    ]);
  }

  return {
    build, zip, crc32, utf8, colName, dateSerial, stripControl, STYLE,
    MIME: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
})();
