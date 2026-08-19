// services/backup_service.js — резервные копии (.afb). Flutter → services/backup_service.dart
//
// `.afb` — ПОЛНАЯ копия приложения, а не выгрузка операций: в payload лежит
// весь объект состояния целиком (операции, счета, группы счетов, категории,
// подкатегории, бюджеты, цели, напоминания, история финздоровья, настройки,
// курсы валют, тема, профиль, порядок и свёрнутость групп, защитный код).
// Отдельных пользовательских сущностей вне state в приложении нет.
//
// TASK_038 — что изменилось:
//   было: {app:'Alex Finance', schemaVersion, createdAt, data} и единственная
//         проверка при чтении — Array.isArray(data.tx). Битый, чужой или
//         обрезанный файл отличался от годного только по этому признаку, а
//         версия приложения и целостность содержимого не проверялись вовсе.
//   стало: явный конверт с идентификатором формата, версиями (backup/schema/
//         app), временем, счётчиками и контрольной суммой + отдельная
//         функция inspect(), которая разбирает файл и возвращает сведения
//         ДЛЯ ПОКАЗА пользователю, ничего не восстанавливая.
//
// Обратная совместимость обязательна и проверяется тестами: старые копии
// ({app,data}), «голый» state и конверт v2 читаются одинаково успешно.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Backup = {
  FILE_EXT: 'afb',
  FORMAT: 'alex-finance-backup',
  BACKUP_VERSION: 2,          // версия КОНВЕРТА (не схемы данных)
  MAX_BYTES: 40 * 1024 * 1024,

  ERROR: {
    NOT_JSON: 'NOT_JSON',
    NOT_BACKUP: 'NOT_BACKUP',
    TOO_LARGE: 'TOO_LARGE',
    EMPTY: 'EMPTY',
    CHECKSUM_MISMATCH: 'CHECKSUM_MISMATCH',
    FUTURE_BACKUP: 'FUTURE_BACKUP',
    FUTURE_SCHEMA: 'FUTURE_SCHEMA',
    BROKEN_SCHEMA: 'BROKEN_SCHEMA',
  },

  // ---- Контрольная сумма ---------------------------------------------
  // FNV-1a 32 бита по КАНОНИЧЕСКОМУ представлению payload (ключи объектов
  // отсортированы). Канонизация обязательна: JSON.parse не гарантирует
  // порядок ключей, и сумма, посчитанная по «как получилось», разошлась бы
  // сама с собой при первом же чтении. Задача суммы — поймать обрезанный
  // при выгрузке или испорченный при передаче файл, а не защита от подделки,
  // поэтому криптостойкий алгоритм здесь не нужен.
  canonical(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(x => this.canonical(x)).join(',') + ']';
    const keys = Object.keys(v).filter(k => v[k] !== undefined).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + this.canonical(v[k])).join(',') + '}';
  },

  checksum(data) {
    const s = this.canonical(data);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i) & 0xff;
      if (s.charCodeAt(i) > 0xff) h ^= (s.charCodeAt(i) >> 8) & 0xff;
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  },

  counts(data) {
    const d = data || {};
    const len = k => Array.isArray(d[k]) ? d[k].length : 0;
    return {
      tx: len('tx'),
      accounts: len('accounts'),
      categories: len('cats'),
      subcategories: len('subcats'),
      goals: len('goals'),
      reminders: len('reminders'),
      budgets: d.budgets ? Object.keys(d.budgets).length : 0,
    };
  },

  // ---- Создание -------------------------------------------------------
  create(state, opts) {
    const o = opts || {};
    const data = state || {};
    const appVersion = o.appVersion || (window.AF && AF.AppInfo && AF.AppInfo.version) || '';
    const payload = {
      format: this.FORMAT,
      app: 'Alex Finance',                 // ключ старого формата — не убираем
      appVersion,
      backupVersion: this.BACKUP_VERSION,
      schemaVersion: data.schemaVersion || (AF.Store && AF.Store.SCHEMA_VERSION) || 3,
      createdAt: o.createdAt || Date.now(),
      counts: this.counts(data),
      checksum: { algo: 'fnv1a32', value: this.checksum(data) },
      data,
    };
    return JSON.stringify(payload, null, 2);
  },

  // ---- Чтение и проверка ---------------------------------------------
  // Возвращает Result:
  //   Ok({ data, info })   — файл разобран; data ещё НЕ применена к базе
  //   Err({ code, message })
  //
  // Порядок проверок — от самых грубых к тонким, чтобы сообщение было по
  // существу: сначала «это вообще не JSON», потом «это не копия», и только
  // затем содержательные проверки версий и целостности.
  inspect(text) {
    const E = this.ERROR;
    const raw = String(text == null ? '' : text);
    if (!raw.trim()) return AF.Result.err({ code: E.EMPTY, message: 'Файл пустой.' });
    if (raw.length > this.MAX_BYTES) {
      return AF.Result.err({ code: E.TOO_LARGE, message: 'Файл слишком большой для резервной копии.' });
    }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { return AF.Result.err({ code: E.NOT_JSON, message: 'Файл повреждён: это не резервная копия A-Lex Finance.' }); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return AF.Result.err({ code: E.NOT_BACKUP, message: 'Файл не похож на резервную копию.' });
    }

    const hasEnvelope = !!(parsed.data && typeof parsed.data === 'object');
    const data = hasEnvelope ? parsed.data : parsed;      // допускаем «голый» state
    if (!data || typeof data !== 'object' || !Array.isArray(data.tx)) {
      return AF.Result.err({ code: E.NOT_BACKUP, message: 'Файл не похож на резервную копию: в нём нет операций.' });
    }
    if (!Array.isArray(data.accounts)) {
      return AF.Result.err({ code: E.BROKEN_SCHEMA, message: 'Резервная копия повреждена: в ней нет списка счетов.' });
    }

    const backupVersion = Number(parsed.backupVersion) || 1;
    if (backupVersion > this.BACKUP_VERSION) {
      return AF.Result.err({
        code: E.FUTURE_BACKUP,
        message: 'Копия создана более новой версией приложения (формат ' + backupVersion +
                 '). Обновите приложение — иначе часть данных будет потеряна.',
      });
    }
    const schemaVersion = Number(parsed.schemaVersion || data.schemaVersion) || 1;
    const appSchema = (AF.Store && AF.Store.SCHEMA_VERSION) || 3;
    if (schemaVersion > appSchema) {
      return AF.Result.err({
        code: E.FUTURE_SCHEMA,
        message: 'Копия сделана на более новой схеме данных (версия ' + schemaVersion + ', приложение понимает ' +
                 appSchema + '). Обновите приложение перед восстановлением.',
      });
    }

    // Контрольная сумма есть только у конверта v2. Её несовпадение означает,
    // что файл изменился после создания, — восстанавливать такую копию
    // нельзя: часть операций может быть обрезана незаметно для глаза.
    const warnings = [];
    if (parsed.checksum && parsed.checksum.value) {
      if (parsed.checksum.algo !== 'fnv1a32') {
        warnings.push('Контрольная сумма неизвестного типа — целостность не проверена.');
      } else if (this.checksum(data) !== String(parsed.checksum.value)) {
        return AF.Result.err({
          code: E.CHECKSUM_MISMATCH,
          message: 'Резервная копия повреждена: контрольная сумма не совпадает. Восстановление отменено.',
        });
      }
    } else {
      warnings.push('Старый формат копии — без контрольной суммы.');
    }

    const info = {
      legacy: backupVersion < this.BACKUP_VERSION,
      format: parsed.format || (parsed.app ? 'legacy' : 'bare-state'),
      backupVersion, schemaVersion,
      appVersion: parsed.appVersion || '',
      createdAt: Number(parsed.createdAt) || null,
      counts: this.counts(data),
      declaredCounts: parsed.counts || null,
      checksumChecked: !!(parsed.checksum && parsed.checksum.value),
      warnings,
    };
    return AF.Result.ok({ data, info });
  },

  // Приведение содержимого копии к текущей схеме. Отдельный шаг — чтобы
  // экран превью показывал сведения ДО миграции, а сама миграция выполнялась
  // ровно один раз, перед записью.
  migrateBackup(data) {
    if (!AF.Store || typeof AF.Store.migrate !== 'function') {
      return AF.Result.err({ code: 'NO_STORE', message: 'Хранилище недоступно.' });
    }
    try {
      return AF.Result.ok(AF.Store.migrate(Object.assign(AF.Store.defaults(), data)));
    } catch (e) {
      return AF.Result.err({ code: this.ERROR.BROKEN_SCHEMA, message: 'Не удалось привести копию к текущей схеме данных.' });
    }
  },

  // Совместимость: прежний контракт Ok(restoredState) | Err(message-строка).
  // Им продолжает пользоваться существующий код импорта JSON.
  restore(text) {
    const res = this.inspect(text);
    if (!res.ok) return AF.Result.err(res.error.message || 'Не удалось прочитать файл резервной копии');
    const mig = this.migrateBackup(res.value.data);
    if (!mig.ok) return AF.Result.err(mig.error.message);
    return AF.Result.ok(mig.value);
  },
};
