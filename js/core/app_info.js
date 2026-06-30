// core/app_info.js — единый источник версии и сведений о релизе.
// Flutter → core/app_info.dart (или pubspec.yaml version). Правило Part 4: одна точка правды.
// Меняем ТОЛЬКО здесь — UI (ReleaseInfo) читает значения автоматически.
window.AF = window.AF || {};
AF.AppInfo = {
  name: 'A-Lex Finance',
  version: '1.0.0',
  releaseDate: 'June 2026',
  // Зарезервировано под будущий экран «Что нового». Когда появится —
  // ReleaseInfo станет тапабельным без правок вёрстки (см. renderReleaseInfo).
  releaseNotes: null, // напр.: { '1.0.0': ['Первый публичный релиз'] }
};
