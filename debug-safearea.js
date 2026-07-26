/* ВРЕМЕННЫЙ ДИАГНОСТИЧЕСКИЙ МОДУЛЬ (standalone PWA / safe-area).
   НЕ ЧАСТЬ ПРИЛОЖЕНИЯ. Подключается одной строкой в index.html и удаляется
   вместе с ней сразу после снятия замеров на реальном iPhone.

   Задача: определить, какой именно корневой слой перестаёт покрывать экран
   перед белой/чёрной полосой внизу в режиме display-mode: standalone.

   Контрастные фоны корневых слоёв (виден тот слой, который в этой точке
   оказался верхним из покрывающих):
     ПУРПУРНЫЙ  — покрывает только html      → body не достаёт до низа
     САЛАТОВЫЙ  — покрывает body             → .app не достаёт
     ГОЛУБОЙ    — покрывает .app             → #scrollArea не достаёт
     ОРАНЖЕВЫЙ  — покрывает #scrollArea      → полоса не связана с этими слоями
*/
(function () {
  var BUILD = 'debug-1';

  // ---- 1. Контрастные фоны корневых слоёв -------------------------------
  var css = document.createElement('style');
  css.textContent =
    'html{background:#ff00ff !important}' +
    'body{background:#7CFC00 !important}' +
    '.app{background:#00e5ff !important}' +
    '.scroll-area,.scroll-area:has(>#scrRecords.active){background:#ff9800 !important}' +
    '.nav{outline:2px solid #ff0000 !important}' +
    /* контент делаем полупрозрачным, чтобы слои просвечивали */
    '.screen{opacity:.35 !important}' +
    '#dbgPanel{position:fixed;left:0;right:0;top:0;z-index:2147483647;' +
    'background:rgba(0,0,0,.88);color:#00ff6a;font:11px/1.35 ui-monospace,Menlo,monospace;' +
    'padding:calc(env(safe-area-inset-top) + 4px) 8px 8px;white-space:pre;' +
    'max-height:62vh;overflow:auto;-webkit-user-select:text;user-select:text}' +
    '#dbgPanel b{color:#fff}' +
    '#dbgPanel .warn{color:#ff5252}' +
    /* линейки: где по расчётам должен быть низ и граница safe-area */
    '.dbg-rule{position:fixed;left:0;right:0;height:0;z-index:2147483646;pointer-events:none}' +
    '.dbg-rule::after{content:attr(data-l);position:absolute;right:2px;bottom:1px;' +
    'font:9px ui-monospace,monospace;color:#fff;background:#000;padding:0 3px}';
  document.head.appendChild(css);

  // ---- 2. Зонд для чтения реальных значений env(safe-area-inset-*) -------
  var probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:0;' +
    'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);' +
    'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)';
  document.body.appendChild(probe);

  var panel = document.createElement('div');
  panel.id = 'dbgPanel';
  document.body.appendChild(panel);
  // тап по панели — свернуть/развернуть, чтобы посмотреть само приложение
  var collapsed = false;
  panel.addEventListener('click', function () {
    collapsed = !collapsed;
    panel.style.maxHeight = collapsed ? '18px' : '62vh';
  });

  function rule(id, color) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'dbg-rule';
      document.body.appendChild(el);
    }
    el.style.borderTop = '2px dashed ' + color;
    return el;
  }

  function bottomOf(sel) {
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return null;
    return Math.round(el.getBoundingClientRect().bottom);
  }

  function px(v) { return Math.round(parseFloat(v) || 0); }

  function update() {
    var cs = getComputedStyle(probe);
    var insetTop = px(cs.paddingTop);
    var insetBottom = px(cs.paddingBottom);

    var vv = window.visualViewport;
    var ih = window.innerHeight;
    var dch = document.documentElement.clientHeight;

    var bHtml = bottomOf(document.documentElement);
    var bBody = bottomOf(document.body);
    var bApp = bottomOf('.app');
    var bScroll = bottomOf('#scrollArea');
    var bNav = bottomOf('.nav');

    var standalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;

    // линейки на предполагаемых границах
    var r1 = rule('dbgRuleIH', '#ffffff');
    r1.style.top = ih + 'px';
    r1.setAttribute('data-l', 'innerHeight ' + ih);

    var r2 = rule('dbgRuleCH', '#00b0ff');
    r2.style.top = dch + 'px';
    r2.setAttribute('data-l', 'clientHeight ' + dch);

    var r3 = rule('dbgRuleSafe', '#ff1744');
    r3.style.top = (ih - insetBottom) + 'px';
    r3.setAttribute('data-l', 'ih-inset ' + (ih - insetBottom));

    // кто «не достаёт» — то и есть виновник
    function flag(name, val) {
      if (val === null) return name + ': —\n';
      var d = ih - val;
      var mark = Math.abs(d) > 1 ? '   <<< НЕ ДОСТАЁТ ' + d + 'px' : '';
      return name + ': ' + val + mark + '\n';
    }

    panel.innerHTML =
      '<b>BUILD ' + BUILD + '  ' + (standalone ? 'STANDALONE' : 'BROWSER') + '</b>\n' +
      'navigator.standalone: ' + window.navigator.standalone + '\n' +
      'theme(data-theme): ' + document.documentElement.getAttribute('data-theme') + '\n' +
      '\n<b>ВЫСОТЫ</b>\n' +
      'window.innerHeight:      ' + ih + '\n' +
      'docEl.clientHeight:      ' + dch + (dch !== ih ? '   <<< != innerHeight (' + (ih - dch) + ')' : '') + '\n' +
      'visualViewport.height:   ' + (vv ? Math.round(vv.height) : '—') +
        (vv && Math.abs(vv.height - ih) > 1 ? '   <<< != innerHeight' : '') + '\n' +
      'visualViewport.offsetTop:' + (vv ? Math.round(vv.offsetTop) : '—') + '\n' +
      'screen.height:           ' + screen.height + '  dpr ' + window.devicePixelRatio + '\n' +
      '\n<b>SAFE-AREA (реальные env)</b>\n' +
      'inset-top:    ' + insetTop + '\n' +
      'inset-bottom: ' + insetBottom + (insetBottom === 0 ? '   <<< 0 (cover не применён?)' : '') + '\n' +
      '\n<b>НИЖНИЕ ГРАНИЦЫ (bottom, отн. вьюпорта)</b>\n' +
      flag('html      ', bHtml) +
      flag('body      ', bBody) +
      flag('.app      ', bApp) +
      flag('#scrollArea', bScroll) +
      '.nav      : ' + bNav + '  (ожидается ' + (ih - Math.max(6, insetBottom)) + ')\n' +
      '\n<b>ФОНЫ</b>\n' +
      'html: ' + getComputedStyle(document.documentElement).backgroundColor + '\n' +
      'body: ' + getComputedStyle(document.body).backgroundColor + '\n' +
      '\n(тап по панели — свернуть)';
  }

  update();
  addEventListener('resize', update);
  addEventListener('orientationchange', update);
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', update);
    visualViewport.addEventListener('scroll', update);
  }
  setInterval(update, 1000);
})();
