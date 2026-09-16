// services/haptics_service.js — тактильный отклик (TASK_042).
// Flutter → services/haptics_service.dart (HapticFeedback.lightImpact / .mediumImpact)
//
// Два механизма, в порядке приоритета:
//  1. navigator.vibrate — Android/Chrome. На iOS/WebKit отсутствует (Vibration
//     API там не реализован), поэтому один этот путь на iPhone молчит.
//  2. «switch»-приём для iOS 18+: WebKit воспроизводит системный haptic
//     Taptic Engine при переключении нативного контрола
//     <input type="checkbox" switch>. Программный label.click() на связанном
//     <label> переключает контрол и вызывает тот же лёгкий щелчок, что у
//     системного переключателя. Это побочный эффект нативного контрола, а не
//     публичный API — Apple может изменить поведение; на iOS ≤ 17 и на
//     десктопе приём тихо ничего не делает. Разрешений, сети и задержек нет.
//
// Отклик никогда не бросает исключений — в любой среде без DOM/vibrate это
// безопасный no-op. Сервис не подключается к клавишам сам: точки вызова
// (pointerdown на клавишах, успешное сохранение) — в index.html.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.Haptics = (function () {
  function create(env) {
    env = env || {};
    const nav = ('navigator' in env) ? env.navigator : (typeof navigator !== 'undefined' ? navigator : null);
    const doc = ('document' in env) ? env.document : (typeof document !== 'undefined' ? document : null);
    const timer = ('setTimeout' in env) ? env.setTimeout : (typeof setTimeout === 'function' ? setTimeout : null);
    const SUCCESS_GAP_MS = 110; // пауза между двумя импульсами success-отклика

    function vibrate(pattern) {
      try {
        if (nav && typeof nav.vibrate === 'function') { nav.vibrate(pattern); return true; }
      } catch (e) { /* отклик не должен ронять ввод */ }
      return false;
    }

    // Один импульс через переключение скрытого нативного switch (iOS 18+).
    function switchPulse() {
      if (!doc || typeof doc.createElement !== 'function' || !doc.head) return false;
      try {
        const label = doc.createElement('label');
        label.setAttribute('aria-hidden', 'true');
        label.style.display = 'none';
        const input = doc.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        label.appendChild(input);
        doc.head.appendChild(label);
        label.click();
        doc.head.removeChild(label);
        return true;
      } catch (e) { return false; }
    }

    return {
      /** Лёгкий щелчок на касание клавиши. Возвращает использованный механизм. */
      tap() {
        if (vibrate(8)) return 'vibrate';
        if (switchPulse()) return 'switch';
        return 'none';
      },
      /** Чуть более выраженный отклик успешного действия — два импульса. */
      success() {
        if (vibrate([12, 70, 12])) return 'vibrate';
        if (switchPulse()) {
          if (timer) timer(switchPulse, SUCCESS_GAP_MS);
          return 'switch';
        }
        return 'none';
      },
    };
  }

  const api = create();
  api.create = create; // фабрика для тестов / изолированных окружений
  return api;
})();
