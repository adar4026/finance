// tests/drawer_redesign.test.js — TASK_050: компактный редизайн боковой шторки
// (#drawerOverlay): компактная строка профиля вместо градиентного баннера,
// кнопка темы в header, графитовые line-icons без цветных плиток, фон/стекло
// на токенах immersive-сцены Главной, footer pinned к низу. Статические
// проверки по index.html/sw.js — тот же приём, что tests/home_balance_drawer.test.js.
// Запуск: node tests/drawer_redesign.test.js

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function block(startRe, endMarker, label) {
  const m = html.match(startRe);
  assertTrue(!!m, `${label}: блок найден в index.html`);
  if (!m) return '';
  const from = m.index;
  const end = html.indexOf(endMarker, from + m[0].length);
  assertTrue(end > from, `${label}: конец блока найден`);
  return end > from ? html.slice(from, end) : '';
}

const drawerHtml = block(/<div class="overlay drawer-ov" id="drawerOverlay">/, '<!-- Безопасность', 'Разметка шторки (#drawerOverlay)');
const drawerCss = block(/\/\* ===== Боковая выезжающая панель \(drawer\)/, '.sheet{background:var(--bg)', 'CSS шторки');
const balanceCss = block(/\.drawer-balance\{/, '/* Заголовок секции списка */', 'CSS .drawer-balance');

// ============ §1 — компактный профиль вместо баннера ============
{
  assertTrue(/<div class="drawer-top">/.test(drawerHtml), 'Шторка: верхняя строка .drawer-top присутствует');
  const top = drawerHtml.slice(drawerHtml.indexOf('<div class="drawer-top">'), drawerHtml.indexOf('id="drawerBalance"'));
  assertTrue(/<button class="drawer-head" id="drawerHead">/.test(top), 'Профиль: #drawerHead — кнопка внутри .drawer-top');
  ['id="drawerAvatar"', 'id="drawerName"', 'class="dh-sub">Личный профиль<', 'class="dh-chev"'].forEach(s => {
    assertTrue(top.includes(s), `Профиль: элемент ${s} сохранён`);
  });
  assertTrue(!/linear-gradient\(135deg,#a79cf7/.test(drawerCss), 'Профиль: градиентный баннер .drawer-head убран из CSS');
  assertTrue(/\.drawer-head\{[^}]*background:none/.test(drawerCss), 'Профиль: .drawer-head без фона (компактная строка)');
  assertTrue(/\.drawer-head \.avatar\{width:50px;height:50px/.test(drawerCss), 'Профиль: аватар 50px (в диапазоне 48–52)');
  assertTrue(/\.drawer-head \.dh-name\{font-size:17px;font-weight:700/.test(drawerCss), 'Профиль: имя полужирным');
  assertTrue(/\.drawer-head \.dh-sub\{[^}]*color:var\(--muted\)/.test(drawerCss), 'Профиль: подпись приглушённым токеном');
  assertTrue(/\.dh-chev\{[^}]*stroke:var\(--muted2\)/.test(drawerCss), 'Профиль: chevron светло-серый токен');
  assertTrue(/\$\('#drawerHead'\)\.onclick=\(\)=>\{closeDrawer\(\);openProfile\(\);\}/.test(html), 'Профиль: обработчик #drawerHead не изменён (closeDrawer + openProfile)');
}

// ============ §2 — кнопка темы в header (тот же #drTheme/#drThemeLbl) ============
{
  assertTrue(/<button class="dh-theme" id="drTheme" type="button">/.test(drawerHtml), 'Тема: #drTheme — круглая кнопка .dh-theme в header');
  const themeBtn = drawerHtml.match(/<button class="dh-theme" id="drTheme"[\s\S]*?<\/button>/);
  assertTrue(!!themeBtn, 'Тема: разметка кнопки найдена');
  if (themeBtn) {
    assertTrue(/class="ic-sun"/.test(themeBtn[0]) && /class="ic-moon"/.test(themeBtn[0]), 'Тема: иконки солнца и луны');
    assertTrue(/<span class="dh-theme-lbl" id="drThemeLbl">/.test(themeBtn[0]), 'Тема: #drThemeLbl сохранён (визуально скрытая подпись для openDrawer()/a11y)');
  }
  assertEqual((drawerHtml.match(/id="drTheme"/g) || []).length, 1, 'Тема: #drTheme ровно один в шторке');
  assertEqual((drawerHtml.match(/id="drThemeLbl"/g) || []).length, 1, 'Тема: #drThemeLbl ровно один в шторке');
  assertTrue(/\.dh-theme \.ic-moon\{display:none\}/.test(drawerCss) && /\[data-theme="dark"\] \.dh-theme \.ic-sun\{display:none\}/.test(drawerCss),
    'Тема: иконка следует за data-theme через CSS (без JS)');
  assertTrue(/\$\('#drTheme'\)\.onclick=\(\)=>\{toggleTheme\(\);\$\('#drThemeLbl'\)\.textContent=themeLabel\(\)\.replace\(\/\^\\S\+\\s\/,''\);\};/.test(html),
    'Тема: обработчик #drTheme не изменён (toggleTheme + подпись)');
  assertTrue(/\$\('#drThemeLbl'\)\.textContent=themeLabel\(\)\.replace\(\/\^\\S\+\\s\/,''\);\n  const n=notifications\(\)\.length,b=\$\('#drNotifBadge'\);/.test(html),
    'openDrawer(): подпись темы и бейдж заполняются как раньше');
  assertTrue(!/drThemeIc/.test(html), 'Тема: висячих обращений к удалённому #drThemeIc нет');
}

// ============ §3 — группы, пункты, обработчики ============
{
  const titles = [...drawerHtml.matchAll(/<div class="drawer-group-title">([^<]+)<\/div>/g)].map(m => m[1]);
  assertEqual(titles, ['Планирование', 'Аналитика', 'Приложение'], 'Группы: три группы в прежнем порядке');
  const rows = [...drawerHtml.matchAll(/<button class="drawer-row" id="(\w+)">/g)].map(m => m[1]);
  assertEqual(rows, ['drCats', 'drGoals', 'drCalendar', 'drRecur', 'drHealth', 'drStats', 'drNotif', 'drExport', 'drMore'],
    'Пункты: 9 строк меню в прежнем порядке (тема — в header)');
  const labels = [...drawerHtml.matchAll(/<span class="dr-lbl">([^<]+)<\/span>/g)].map(m => m[1]);
  assertEqual(labels, ['Категории', 'Цели', 'Календарь', 'Регулярные платежи', 'Финансовое здоровье', 'Статистика', 'Уведомления', 'Экспорт и копии', 'Все настройки'],
    'Пункты: подписи не изменены');
  assertEqual((drawerHtml.match(/class="drawer-card"/g) || []).length, 3, 'Группы: по одной карточке на группу');
  assertEqual((drawerHtml.match(/class="drawer-sep"/g) || []).length, 6, 'Разделители: 3 + 1 + 2 = 6 между строками');
  [
    ["$('#drNotif').onclick=drGo(openNotif);"],
    ["$('#drCats').onclick=drGo(openCatMgr);"],
    ["$('#drGoals').onclick=drGo(openGoals);"],
    ["$('#drCalendar').onclick=drGo(openCalendar);"],
    ["$('#drRecur').onclick=drGo(openRecurring);"],
    ["$('#drHealth').onclick=drGo(openHealth);"],
    ["$('#drStats').onclick=drGo(openStats);"],
    ["$('#drExport').onclick=drGo(openExport);"],
    ["$('#drMore').onclick=()=>{closeDrawer();showScreen('scrMore');};"],
    ['const drGo=fn=>()=>{closeDrawer();fn();};'],
  ].forEach(([line]) => assertTrue(html.includes(line), `Обработчик не изменён: ${line}`));
  assertTrue(/id="drNotifBadge"/.test(drawerHtml), 'Бейдж уведомлений #drNotifBadge сохранён');
  assertTrue(/if\(n\)\{b\.textContent=n>9\?'9\+':n;b\.style\.display='flex';\}else b\.style\.display='none';/.test(html),
    'Бейдж показывается только при реальном значении (логика openDrawer() не менялась)');
  assertTrue(/\.drawer-row\{[^}]*min-height:56px/.test(drawerCss), 'Строки: высота 56px');
  assertTrue(/\.drawer-card\{[^}]*border-radius:22px/.test(drawerCss), 'Карточка группы: скругление 22px');
  assertTrue(/\.drawer-sep\{[^}]*margin-left:60px/.test(drawerCss), 'Разделитель начинается после области иконки');
}

// ============ §4 — иконки: тонкий графитовый контур, без цветных плиток ============
{
  assertTrue(!/--ic:/.test(drawerHtml), 'Иконки: inline-цветов плиток (--ic:*) в шторке больше нет');
  assertTrue(!/fill="#/.test(drawerHtml), 'Иконки: заливок с хардкодом цвета в шторке нет');
  const icons = drawerHtml.match(/<span class="dr-ic"><svg viewBox="0 0 24 24" aria-hidden="true">/g) || [];
  assertEqual(icons.length, 9, 'Иконки: у каждого из 9 пунктов единый контейнер .dr-ic и viewBox 24');
  assertTrue(/\.dr-ic\{[^}]*color:var\(--text\)/.test(drawerCss), 'Иконки: цвет через токен --text (графит)');
  assertTrue(!/\.dr-ic\{[^}]*background:var\(--ic/.test(drawerCss), 'Иконки: цветной фон плитки убран из .dr-ic');
  assertTrue(/\.dr-ic svg\{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1\.8/.test(drawerCss),
    'Иконки: единый размер и stroke-width');
  assertTrue(/\.dr-badge\{[^}]*background:var\(--expense\)/.test(drawerCss), 'Бейдж — единственный цветной акцент, через токен');
}

// ============ §5 — фон/стекло на токенах Главной, тёмная тема ============
{
  const drawerRule = (drawerCss.match(/\.drawer\{[^}]*\}/) || [''])[0];
  assertTrue(/var\(--hero-top\)/.test(drawerRule) && /var\(--hero-bottom\)/.test(drawerRule) && /var\(--hero-glow\)/.test(drawerRule),
    'Фон шторки: сцена Главной через токены --hero-*');
  assertTrue(!/background:var\(--home-bg\)/.test(drawerRule), 'Фон шторки: плоский --home-bg заменён сценой');
  assertTrue(/\.drawer::before\{[^}]*var\(--hero-b1\)/.test(drawerCss) && /\.drawer::after\{[^}]*var\(--hero-b4\)/.test(drawerCss),
    'Фон шторки: мягкие blob\'ы на токенах --hero-b*');
  assertTrue(/@media \(prefers-reduced-motion:reduce\)\{\.drawer::before,\.drawer::after\{animation:none/.test(drawerCss),
    'Фон шторки: prefers-reduced-motion отключает дрейф');
  assertTrue(/\.drawer-card\{background:var\(--hero-glass\);border:1px solid var\(--hero-glass-border\)/.test(drawerCss),
    'Карточки: лёгкое стекло на токенах --hero-glass');
  // TASK_052 убрал карточный вид «Общего баланса» (был на этих же токенах --hero-glass) —
  // теперь это inline-текст на общем фоне шторки; подробная проверка — tests/drawer_balance_inline.test.js.
  assertTrue(!/\.drawer-balance\{[^}]*background:/.test(balanceCss), 'Баланс: без собственного фона (не карточка, TASK_052)');
  assertTrue(/\.drawer-sep\{[^}]*background:var\(--hero-sep\)/.test(drawerCss), 'Разделители: токен --hero-sep (обе темы)');
  // хардкод цветов: допускается только #fff текста бейджа и pre-existing backdrop .drawer-ov
  const cssNoBackdrop = drawerCss.replace(/\.overlay\.drawer-ov\{[^}]*\}/, '');
  const hexes = (cssNoBackdrop.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter(h => h.toLowerCase() !== '#fff');
  assertEqual(hexes, [], 'CSS шторки: без хардкода hex-цветов (кроме #fff текста бейджа)');
  assertTrue(!/rgba\(/.test(cssNoBackdrop), 'CSS шторки: без хардкода rgba (тени/границы — через токены)');
  assertTrue(!/\[data-theme="dark"\] \.drawer-sep/.test(drawerCss), 'Тёмная тема: отдельный override разделителя не нужен (токен)');
}

// ============ §6 — баланс на месте, footer, safe area, узкие экраны ============
{
  const headIdx = drawerHtml.indexOf('id="drawerHead"');
  const balIdx = drawerHtml.indexOf('id="drawerBalance"');
  const firstGroupIdx = drawerHtml.indexOf('class="drawer-group"');
  assertTrue(headIdx > -1 && balIdx > headIdx && firstGroupIdx > balIdx, 'Баланс: #drawerBalance между профилем и первой группой');
  assertTrue(!/Общий капитал/.test(drawerHtml) && !/sparkline/i.test(drawerHtml), 'Карточка «Общий капитал»/спарклайн не возвращены');
  assertTrue(/<div class="drawer-footer" id="drawerRelease"><\/div>\s*<\/div>\s*<\/div>\s*<\/div>/.test(drawerHtml),
    'Footer: #drawerRelease — последний элемент .drawer-scroll');
  assertTrue(/\.drawer-footer\{margin-top:auto;text-align:center;[^}]*env\(safe-area-inset-bottom\)/.test(drawerCss),
    'Footer: pinned к низу (margin-top:auto), центрирован, учитывает safe-area');
  assertTrue(/\.drawer-footer \.rel-name\{/.test(drawerCss) && /\.drawer-footer \.rel-date\{/.test(drawerCss), 'Footer: строка названия/версии и строка даты (TASK_051)');
  // TASK_051: footer — две строки только из AF.AppInfo (подробно — tests/release_info.test.js)
  assertTrue(/function renderReleaseInfo\(\)\{\n  const a=AF\.AppInfo,el=\$\('#drawerRelease'\);if\(!el\|\|!a\)return;[\s\S]{0,700}?el\.innerHTML=`<div class="rel-name">\$\{a\.name\} · \$\{ver\}<\/div>`\n    \+\(date\?`<div class="rel-date">Обновлено: \$\{date\}<\/div>`:''\);/.test(html),
    'renderReleaseInfo() формирует footer только из AF.AppInfo');
  assertTrue(/\.drawer-top\{[^}]*margin:max\(14px,env\(safe-area-inset-top\)\)/.test(drawerCss), 'Safe Area: верхний отступ как раньше');
  assertTrue(/\.drawer\{position:relative;width:86%;max-width:360px;height:100%/.test(drawerCss), 'Панель: ширина 86% / 360px сохранена');
  assertTrue(/border-radius:0 28px 28px 0/.test(drawerCss), 'Панель: крупные скругления сохранены');
  assertTrue(/body\.drawer-open \.app,body\.drawer-open \.nav\{filter:blur\(6px\) brightness\(\.92\);transform:scale\(\.98\)\}/.test(drawerCss),
    'Backdrop: blur/затемнение/масштаб основного экрана не изменены');
  assertTrue(/\.drawer-scroll\{[^}]*overflow-x:hidden/.test(drawerCss), 'Скролл: горизонтальный overflow внутри шторки исключён');
  assertTrue(/@media \(max-width:359px\)\{\n    \.drawer-top/.test(drawerCss), 'Узкие экраны (320): компактнее строки/отступы');
  assertTrue(/function openDrawer\(\)\{\n  \$\('#drawerAvatar'\)\.style\.cssText=avatarStyle\(\);/.test(html) && /function closeDrawer\(\)\{\$\('#drawerOverlay'\)\.classList\.remove\('show'\);document\.body\.classList\.remove\('drawer-open'\);\}/.test(html),
    'openDrawer()/closeDrawer() не изменены');
}

// ============ §7 — sw.js ============
{
  // TASK_050 поднял кэш до v182; последующие задачи поднимают дальше — проверяем только формат
  // (точное значение — в тесте актуальной задачи, см. tests/release_info.test.js)
  assertTrue(/const CACHE = 'finance-v\d+';/.test(sw), 'sw.js: версия кэша в формате finance-vNNN');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
