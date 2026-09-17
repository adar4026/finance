// core/app_info.js — единый источник версии и сведений о релизе.
// Flutter → core/app_info.dart (или pubspec.yaml version). Правило Part 4: одна точка правды.
// Меняем ТОЛЬКО здесь — UI (ReleaseInfo в footer шторки) читает значения автоматически.
//
// Политика версий (см. AGENTS.md → «Версии и релизы»):
//   PATCH 1.0.1 — небольшое исправление;
//   MINOR 1.1.0 — заметный редизайн или новая пользовательская возможность;
//   MAJOR 2.0.0 — большое изменение, ломающее совместимость или структуру.
// Перед каждым production-релизом: обновить `version` и `releasedAt` здесь,
// поднять cache version в sw.js (это ДРУГАЯ сущность — не выводится из версии
// приложения и наоборот), записать релиз в CHANGELOG.md.
window.AF = window.AF || {};
AF.AppInfo = {
  name: 'A-Lex Finance',
  version: '1.1.0',        // semantic version — MAJOR.MINOR.PATCH
  releasedAt: '2026-09-17', // фиксированная дата релиза, ISO YYYY-MM-DD (не дата устройства)
  // Зарезервировано под будущий экран «Что нового». Когда появится —
  // ReleaseInfo станет тапабельным без правок вёрстки (см. renderReleaseInfo).
  releaseNotes: null, // напр.: { '1.1.0': ['Компактная шторка'] }

  // Русские названия месяцев (именительный падеж) для displayReleaseDate().
  MONTHS_RU: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],

  // «v1.1.0» — версия для отображения.
  displayVersion() { return 'v' + this.version; },

  // «сентябрь 2026» — месяц и год релиза по-русски. Разбор строки YYYY-MM-DD
  // без объекта Date: часовой пояс, локаль и текущая дата устройства не
  // участвуют. Если releasedAt не в ожидаемом формате — возвращается как есть.
  displayReleaseDate() {
    const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(String(this.releasedAt || ''));
    if (!m) return String(this.releasedAt || '');
    const month = this.MONTHS_RU[Number(m[2]) - 1];
    return month ? month + ' ' + m[1] : String(this.releasedAt);
  },
};
