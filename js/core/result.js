// core/result.js — Result type (Success | Failure). Flutter → core/errors/result.dart
// Правило Part 4: ни одной "тихой" ошибки — операции возвращают Ok/Err.
window.AF = window.AF || {};
AF.Result = {
  ok(value)  { return { ok: true,  value }; },
  err(error) { return { ok: false, error }; },
};
