// services/backup_service.js — резервные копии (.afb). Flutter → services/backup_service.dart
// Backup содержит accounts/transactions/budgets/goals/reminders (+ остальное состояние).
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Backup = {
  FILE_EXT: 'afb',

  create(state) {
    const payload = { app: 'Alex Finance', schemaVersion: state.schemaVersion || 2, createdAt: Date.now(), data: state };
    return JSON.stringify(payload);
  },

  // Возвращает Result: Ok(restoredState) | Err(message)
  restore(text) {
    try {
      const parsed = JSON.parse(text);
      const data = parsed && parsed.data ? parsed.data : parsed; // допускаем и «голый» state
      if (!data || !Array.isArray(data.tx)) return AF.Result.err('Файл не похож на резервную копию');
      return AF.Result.ok(AF.Store.migrate(Object.assign(AF.Store.defaults(), data)));
    } catch (e) {
      return AF.Result.err('Не удалось прочитать файл резервной копии');
    }
  },
};
