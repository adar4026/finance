// services/csv_parser_service.js — чтение CSV: кодировка, разделитель, кавычки, строки.
// Flutter → services/csv_parser_service.dart (csv package).
//
// TASK_038. Выделено из importCSV() в index.html, где разбор был смешан с
// созданием счетов и категорий. Здесь — только текст → таблица, без единого
// обращения к state, DOM и localStorage.
//
// Что закрывается по сравнению с прежним разбором:
//   1. Кодировка. FileReader.readAsText() всегда читал UTF-8, и экспорт в
//      windows-1251 (обычный для банков и Money Flow на Windows) молча
//      превращался в «кракозябры», которые уходили в имена категорий.
//   2. Разделитель определялся по первой непустой строке — запятая внутри
//      закавыченного заголовка перевешивала настоящий разделитель. Теперь
//      кандидаты проверяются полным разбором нескольких строк, и побеждает
//      тот, который даёт стабильное число колонок.
//   3. Строки-продолжения. Перевод строки внутри кавычек — часть значения,
//      а не конец записи (примечания с многострочным текстом).
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.CsvParser = (function () {
  const DELIMITERS = [',', ';', '\t', '|'];
  const MAX_BYTES = 15 * 1024 * 1024;   // 15 МБ — выше этого файл не читаем

  // ---- Кодировка -----------------------------------------------------
  // UTF-8 проверяется строгим декодером: если байты не UTF-8, TextDecoder
  // с {fatal:true} бросает, и это единственный надёжный признак. Дальше —
  // windows-1251 (кириллица) как самый частый вариант «не UTF-8» файла.
  // Никакой эвристики «на глаз» по частотам символов: ошибка здесь
  // необратимо портит имена категорий и счетов.
  function decodeBytes(bytes) {
    const u8 = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes || []);
    if (u8.length > MAX_BYTES) {
      return AF.Result.err({ code: 'FILE_TOO_LARGE', message: 'Файл слишком большой — до 15 МБ.' });
    }
    if (!u8.length) {
      return AF.Result.err({ code: 'EMPTY_FILE', message: 'Файл пустой.' });
    }
    // BOM UTF-16 — такие файлы отдаёт «Сохранить как» в Excel
    if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) return decodeWith(u8.subarray(2), 'utf-16le', 'UTF-16LE');
    if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) return decodeWith(u8.subarray(2), 'utf-16be', 'UTF-16BE');
    const utf8 = tryDecode(u8, 'utf-8', true);
    if (utf8 !== null) return AF.Result.ok({ text: stripBom(utf8), encoding: 'UTF-8' });
    const cp1251 = tryDecode(u8, 'windows-1251', false);
    if (cp1251 !== null) return AF.Result.ok({ text: stripBom(cp1251), encoding: 'windows-1251' });
    return AF.Result.err({ code: 'UNKNOWN_ENCODING', message: 'Не удалось определить кодировку файла. Сохраните CSV в UTF-8.' });
  }

  function decodeWith(u8, label, name) {
    const t = tryDecode(u8, label, false);
    if (t === null) return AF.Result.err({ code: 'UNKNOWN_ENCODING', message: 'Не удалось определить кодировку файла. Сохраните CSV в UTF-8.' });
    return AF.Result.ok({ text: stripBom(t), encoding: name });
  }

  function tryDecode(u8, label, fatal) {
    try {
      const D = (typeof TextDecoder !== 'undefined') ? TextDecoder : null;
      if (!D) return fatal ? null : latin1(u8);       // окружение без TextDecoder
      return new D(label, { fatal: !!fatal }).decode(u8);
    } catch (e) { return null; }
  }

  function latin1(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; }
  function stripBom(t) { return t.charAt(0) === '﻿' ? t.slice(1) : t; }

  // ---- Разбор --------------------------------------------------------
  // Один проход конечным автоматом. Кавычки по RFC 4180: "" внутри поля —
  // экранированная кавычка, перевод строки внутри кавычек — часть значения.
  function parseWith(text, delim, limitRows) {
    const rows = [];
    let row = [], fld = '', q = false, quotedField = false;
    const push = () => { row.push(quotedField ? fld : fld.trim()); fld = ''; quotedField = false; };
    const endRow = () => { push(); rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { fld += '"'; i++; } else q = false; }
        else fld += ch;
        continue;
      }
      if (ch === '"') { q = true; quotedField = true; continue; }
      if (ch === delim) { push(); continue; }
      if (ch === '\n') { endRow(); if (limitRows && rows.length >= limitRows) return rows; continue; }
      if (ch === '\r') continue;
      fld += ch;
    }
    if (fld.length || row.length) endRow();
    return rows;
  }

  // Непустая строка — та, где есть хоть одно непустое значение. Пустые
  // строки в CSV встречаются постоянно (хвост файла, разделители блоков)
  // и не должны ни считаться операциями, ни ломать выбор разделителя.
  function isBlank(r) { return !r || !r.some(x => String(x).trim() !== ''); }

  // Выбор разделителя: пробуем каждый кандидат полным разбором первых
  // строк и берём тот, у которого больше колонок при стабильной ширине.
  // «Стабильность» важнее количества: файл с одной колонкой и запятыми в
  // тексте не должен выиграть у настоящего ';'.
  function detectDelimiter(text) {
    let best = ',', bestScore = -1;
    DELIMITERS.forEach(d => {
      const rows = parseWith(text, d, 12).filter(r => !isBlank(r));
      if (!rows.length) return;
      const widths = rows.map(r => r.length);
      const head = widths[0];
      if (head < 2) return;
      const stable = widths.filter(w => w === head).length / widths.length;
      const score = head * (0.4 + 0.6 * stable);
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }

  // Полный разбор. Возвращает Result:
  //   Ok({ rows, header, body, delimiter, totalRows, blankRows })
  //   Err({ code, message })
  function parse(text, opts) {
    const o = opts || {};
    if (typeof text !== 'string') return AF.Result.err({ code: 'EMPTY_FILE', message: 'Файл пустой.' });
    const src = stripBom(text);
    if (!src.trim()) return AF.Result.err({ code: 'EMPTY_FILE', message: 'Файл пустой.' });
    const delimiter = o.delimiter || detectDelimiter(src);
    const all = parseWith(src, delimiter);
    const blankRows = all.filter(isBlank).length;
    const rows = all.filter(r => !isBlank(r));
    if (!rows.length) return AF.Result.err({ code: 'EMPTY_FILE', message: 'В файле нет ни одной строки с данными.' });
    if (rows.length < 2) return AF.Result.err({ code: 'NO_DATA_ROWS', message: 'В файле только заголовок — операций нет.' });
    return AF.Result.ok({
      rows,
      header: rows[0].map(h => String(h == null ? '' : h).trim()),
      body: rows.slice(1),
      delimiter, blankRows, totalRows: rows.length - 1,
    });
  }

  // Чтение из байтов: кодировка + разбор одной операцией.
  function parseBytes(bytes, opts) {
    const dec = decodeBytes(bytes);
    if (!dec.ok) return dec;
    const res = parse(dec.value.text, opts);
    if (!res.ok) return res;
    res.value.encoding = dec.value.encoding;
    return res;
  }

  return { DELIMITERS, MAX_BYTES, decodeBytes, detectDelimiter, parse, parseBytes, _parseWith: parseWith, _isBlank: isBlank };
})();
