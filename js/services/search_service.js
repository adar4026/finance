// services/search_service.js — нормализация текста для полнотекстового поиска (TASK_016).
// Flutter → services/search_service.dart
//
// Убирает Unicode-диакритику (NFD-декомпозиция + удаление combining marks) и
// приводит к нижнему регистру, чтобы «Gijón» находился по «gijon» и
// наоборот. НЕ транслитерирует (кириллица остаётся кириллицей, «Овьедо» не
// совпадает с «Oviedo») и не исправляет опечатки — только Unicode-
// нормализация диакритики. Без Unicode property escapes (\p{Diacritic}) —
// избегается риск несовместимости со старым iOS Safari. Безопасно
// деградирует до lowercase+trim без диакритик-нормализации, если
// String.prototype.normalize недоступен — без падения.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Search = {
  normalizeSearchText(value) {
    let s = (value === null || value === undefined) ? '' : String(value);
    if (typeof s.normalize === 'function') {
      try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
      catch (e) { /* оставить как есть при сбое normalize — не падаем */ }
    }
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  },
};
