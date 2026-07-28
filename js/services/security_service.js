// services/security_service.js — чистые правила экрана «Безопасность» (TASK_023).
// Flutter → services/security_service.dart. UI не хранит эти правила у себя,
// а спрашивает сервис; здесь нет ни одного обращения к DOM, localStorage,
// crypto или WebAuthn — только данные внутрь, решение наружу.
//
// Что здесь ЕСТЬ (реальные, влияющие на поведение настройки):
//   lockDelay  — через сколько неактивности снова требовать защитный код;
//   biometric  — включена ли биометрическая разблокировка (WebAuthn);
//   bioCredId  — идентификатор платформенного ключа (не секрет: без самого
//                устройства и прохождения Face ID/Touch ID он бесполезен);
//   lastActiveAt — отметка ухода приложения в фон, основа lockDelay.
//
// Чего здесь НЕТ и быть не должно: настройки доступа виджетов. Виджетов у
// PWA нет (в manifest.json нет поля widgets, обмена данными нет), и хранить
// флаг, который ни на что не влияет, значило бы заявить пользователю
// несуществующую защиту. Экран показывает честное disabled-состояние.
window.AF = window.AF || {};
AF.Services = AF.Services || {};
AF.Services.Security = (function () {

  // Варианты «Запрашивать» — единственный источник правды и для выбора в UI,
  // и для нормализации сохранённого значения.
  const LOCK_DELAYS = [
    { value: 0,       label: 'Сразу' },
    { value: 60000,   label: 'Через 1 минуту' },
    { value: 300000,  label: 'Через 5 минут' },
    { value: 900000,  label: 'Через 15 минут' },
    { value: 3600000, label: 'Через 1 час' },
  ];

  function defaults() {
    return { lockDelay: 0, biometric: false, bioCredId: null, lastActiveAt: null };
  }

  function isKnownDelay(v) {
    return LOCK_DELAYS.some(d => d.value === v);
  }

  function lockDelayLabel(v) {
    const d = LOCK_DELAYS.find(x => x.value === v);
    return d ? d.label : LOCK_DELAYS[0].label;
  }

  // Нормализация настроек безопасности внутри state.
  // Идемпотентна, ничего не удаляет за пределами своего блока и не трогает
  // state.pinHash — он остаётся там же, где был до TASK_023.
  //
  // Ключевой инвариант зависимостей: биометрия НЕ может быть включена без
  // защитного кода. Он проверяется именно здесь, а не только в обработчике
  // клика, чтобы состояние не могло «выжить» ни через restore .afb, ни через
  // импорт JSON, ни через ручную правку localStorage.
  function normalize(state) {
    if (!state || typeof state !== 'object') return defaults();
    state.settings = state.settings || {};
    const src = (state.settings.security && typeof state.settings.security === 'object')
      ? state.settings.security : {};
    const sec = defaults();

    if (typeof src.lockDelay === 'number' && isKnownDelay(src.lockDelay)) sec.lockDelay = src.lockDelay;
    if (typeof src.bioCredId === 'string' && src.bioCredId) sec.bioCredId = src.bioCredId;
    sec.biometric = src.biometric === true && !!sec.bioCredId;
    if (typeof src.lastActiveAt === 'number' && isFinite(src.lastActiveAt) && src.lastActiveAt > 0) {
      sec.lastActiveAt = src.lastActiveAt;
    }
    if (!state.pinHash) { sec.biometric = false; sec.bioCredId = null; }

    state.settings.security = sec;
    return sec;
  }

  function read(state) {
    const s = state && state.settings && state.settings.security;
    return (s && typeof s === 'object') ? s : defaults();
  }

  // Отключение защитного кода обязано гасить биометрию: без кода у неё нет
  // запасного пути входа, и оставлять её «активной» — ровно та фальшивая
  // безопасность, которой быть не должно.
  function applyPasscodeOff(sec) {
    const out = Object.assign(defaults(), sec || {});
    out.biometric = false;
    out.bioCredId = null;
    return out;
  }

  // Можно ли вообще включать биометрию: нужен и защитный код (запасной путь),
  // и реально доступный платформенный аутентификатор.
  function canEnableBiometric(hasPasscode, available) {
    return !!hasPasscode && available === true;
  }

  function setLockDelay(sec, value) {
    const out = Object.assign(defaults(), sec || {});
    out.lockDelay = isKnownDelay(value) ? value : 0;
    return out;
  }

  // Нужно ли требовать код прямо сейчас.
  //  - кода нет               → никогда;
  //  - отметки времени нет    → да (fail-secure: холодный старт или выгрузка);
  //  - прошло >= lockDelay    → да.
  // now/lastActiveAt передаются снаружи — функция остаётся чистой и тестируемой.
  function shouldLock(state, now) {
    if (!state || !state.pinHash) return false;
    const sec = read(state);
    const last = sec.lastActiveAt;
    if (typeof last !== 'number' || !isFinite(last) || last <= 0) return true;
    const delay = isKnownDelay(sec.lockDelay) ? sec.lockDelay : 0;
    const elapsed = now - last;
    if (!isFinite(elapsed) || elapsed < 0) return true; // часы устройства сдвинулись назад — блокируем
    return elapsed >= delay;
  }

  return {
    LOCK_DELAYS, defaults, normalize, read, isKnownDelay, lockDelayLabel,
    applyPasscodeOff, canEnableBiometric, setLockDelay, shouldLock,
  };
})();
