// tests/release_info.test.js — TASK_051: единый источник версии и даты релиза
// (js/core/app_info.js) и footer боковой шторки «A-Lex Finance · v1.1.0» /
// «Обновлено: сентябрь 2026». Проверяет: версия и дата берутся только из
// AF.AppInfo; дата не зависит от Date/часового пояса/локали устройства;
// реальный renderReleaseInfo() из index.html выводит две ожидаемые строки;
// нет старых литералов («Version 1.0.0», «June 2026») и дубликатов версии/
// месяца в HTML/CSS/тестах; footer читаем в light/dark; структура шторки
// TASK_050 не изменена; sw.js — новый cache version, не связанный с semver.
// Запуск: node tests/release_info.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appInfoSrc = fs.readFileSync(path.join(root, 'js/core/app_info.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}

// Загрузка app_info.js в изолированный контекст (без глобального Date, если нужно).
function loadAppInfo(extraGlobals) {
  const ctx = { window: {} };
  ctx.window = ctx; // window.AF = ... → ctx.AF
  Object.assign(ctx, extraGlobals || {});
  vm.createContext(ctx);
  vm.runInContext(appInfoSrc, ctx);
  return ctx.AF.AppInfo;
}

// ============ §1 — единственный источник: поля и helper'ы ============
const info = loadAppInfo();
{
  assertEqual(info.name, 'A-Lex Finance', 'AppInfo.name');
  assertEqual(info.version, '1.1.0', 'AppInfo.version — semantic version 1.1.0 (редизайн шторки TASK_050 = MINOR)');
  assertEqual(info.releasedAt, '2026-09-17', 'AppInfo.releasedAt — фиксированная ISO-дата релиза');
  assertTrue(/^\d+\.\d+\.\d+$/.test(info.version), 'version — строго MAJOR.MINOR.PATCH');
  assertTrue(/^\d{4}-\d{2}-\d{2}$/.test(info.releasedAt), 'releasedAt — строго YYYY-MM-DD');
  assertTrue(!('releaseDate' in info), 'старое неиспользуемое поле releaseDate убрано (нет второго источника даты)');
  assertEqual(info.displayVersion(), 'v1.1.0', 'displayVersion() → v1.1.0');
  assertEqual(info.displayReleaseDate(), 'сентябрь 2026', 'displayReleaseDate() → сентябрь 2026');
  assertEqual(info.releaseNotes, null, 'releaseNotes — резерв под «Что нового», как было');
  // единственное определение AF.AppInfo во всём проекте
  const jsFiles = [];
  (function walk(d) { fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.js$/.test(f)) jsFiles.push(p); }); })(path.join(root, 'js'));
  const defs = jsFiles.filter(f => /AF\.AppInfo\s*=/.test(fs.readFileSync(f, 'utf8')));
  assertEqual(defs.map(f => path.relative(root, f)), ['js/core/app_info.js'], 'AF.AppInfo определён ровно в одном файле');
  assertTrue(!/AF\.AppInfo\s*=/.test(html) && !/AppInfo\.version\s*=/.test(html), 'index.html не переопределяет AF.AppInfo/version');
}

// ============ §2 — дата не зависит от даты/часового пояса/локали устройства ============
{
  // Date «сломан» намеренно: любое обращение к нему бросит — результат не меняется
  const noDate = loadAppInfo({ Date: function () { throw new Error('Date must not be used'); }, Intl: undefined });
  assertEqual(noDate.displayReleaseDate(), 'сентябрь 2026', 'displayReleaseDate() не использует Date/Intl');
  assertEqual(noDate.displayVersion(), 'v1.1.0', 'displayVersion() не использует Date');
  // источник не парсится через Date — иначе 31-е/переход месяца в TZ<0 дали бы другой месяц
  assertTrue(!/new Date|Date\.|toLocale|Intl\./.test(appInfoSrc), 'app_info.js: нет new Date / Date.* / toLocale* / Intl.*');
  // другие даты — верный русский месяц в именительном падеже, включая граничные дни
  const cases = [['2027-01-05', 'январь 2027'], ['2026-12-31', 'декабрь 2026'], ['2026-03-01', 'март 2026'],
    ['2026-05-15', 'май 2026'], ['2026-06-30', 'июнь 2026'], ['2026-11-30', 'ноябрь 2026'], ['2030-08-01', 'август 2030']];
  cases.forEach(([iso, label]) => {
    const i = loadAppInfo(); i.releasedAt = iso;
    assertEqual(i.displayReleaseDate(), label, `displayReleaseDate(${iso}) → ${label}`);
  });
  // некорректный формат — возвращается как есть, без исключения
  ['', '2026', 'сентябрь', '2026-13-01', null].forEach(bad => {
    const i = loadAppInfo(); i.releasedAt = bad;
    let out, threw = false; try { out = i.displayReleaseDate(); } catch (e) { threw = true; }
    assertTrue(!threw && typeof out === 'string', `displayReleaseDate(${JSON.stringify(bad)}) — строка без исключения`);
  });
  assertEqual(info.MONTHS_RU.length, 12, '12 русских месяцев');
  assertTrue(info.MONTHS_RU.every(m => /^[а-я]+$/.test(m)), 'месяцы — строчными, именительный падеж');
}

// ============ §3 — renderReleaseInfo() из index.html формирует footer только из AF.AppInfo ============
{
  const fnMatch = html.match(/function renderReleaseInfo\(\)\{[\s\S]*?\n\}/);
  assertTrue(!!fnMatch, 'renderReleaseInfo() найдена в index.html');
  const fnSrc = fnMatch ? fnMatch[0] : '';
  assertTrue(/a\.displayVersion\(\)/.test(fnSrc) && /a\.displayReleaseDate\(\)/.test(fnSrc) && /a\.name/.test(fnSrc),
    'renderReleaseInfo(): использует name/displayVersion()/displayReleaseDate() из AF.AppInfo');
  assertTrue(!/\d+\.\d+\.\d+/.test(fnSrc) && !/Version /.test(fnSrc) && !/20\d\d/.test(fnSrc),
    'renderReleaseInfo(): без литералов версии/года/«Version»');
  // выполняем реальную функцию на фейковом DOM
  const el = { innerHTML: '', classList: { add() {} }, onclick: null };
  const ctx = { AF: { AppInfo: info }, $: sel => (sel === '#drawerRelease' ? el : null), openWhatsNew: undefined };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nrenderReleaseInfo();', ctx);
  const lines = [...el.innerHTML.matchAll(/<div class="([\w-]+)">([^<]*)<\/div>/g)].map(m => [m[1], m[2]]);
  assertEqual(lines, [['rel-name', 'A-Lex Finance · v1.1.0'], ['rel-date', 'Обновлено: сентябрь 2026']],
    'Footer: ровно две строки — «A-Lex Finance · v1.1.0» и «Обновлено: сентябрь 2026»');
  // при другой версии/дате в AppInfo footer меняется сам — без правок index.html
  const el2 = { innerHTML: '', classList: { add() {} } };
  const other = loadAppInfo(); other.version = '1.2.3'; other.releasedAt = '2027-02-10';
  const ctx2 = { AF: { AppInfo: other }, $: () => el2 };
  vm.createContext(ctx2); vm.runInContext(fnSrc + '\nrenderReleaseInfo();', ctx2);
  assertTrue(el2.innerHTML.includes('A-Lex Finance · v1.2.3') && el2.innerHTML.includes('Обновлено: февраль 2027'),
    'Footer следует за AF.AppInfo (единственное место правок)');
  assertTrue(/renderReleaseInfo\(\); \/\/ блок версии в drawer/.test(html), 'renderReleaseInfo() по-прежнему вызывается при старте');
  // рассинхрон кэша: старый app_info.js (без helper'ов) + новый index.html — не бросает, старт не прерывается
  const el3 = { innerHTML: '', classList: { add() {} } };
  const legacy = { name: 'A-Lex Finance', version: '0.9.0', releaseNotes: null };
  const ctx3 = { AF: { AppInfo: legacy }, $: () => el3 };
  vm.createContext(ctx3);
  let threw = false; try { vm.runInContext(fnSrc + '\nrenderReleaseInfo();', ctx3); } catch (e) { threw = true; }
  assertTrue(!threw && el3.innerHTML.includes('A-Lex Finance · v0.9.0') && !/Обновлено/.test(el3.innerHTML),
    'renderReleaseInfo() устойчив к старому AppInfo без helper\'ов (деградация без исключения)');
  assertTrue(/renderReleaseInfo\(\);[^\n]*\nshowScreen\('scrRecords'\);/.test(html),
    'renderReleaseInfo() вызывается до showScreen()/secMaybeLock() — исключение здесь сорвало бы старт, поэтому защита обязательна');
}

// ============ §4 — нет старых литералов и дубликатов версии/месяца ============
{
  assertTrue(!/Version 1\.0\.0/.test(html), 'index.html: старого текста «Version 1.0.0» нет');
  const htmlNoComments = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  assertTrue(!/1\.0\.0/.test(htmlNoComments) && !/1\.1\.0/.test(htmlNoComments), 'index.html: нет литералов версии приложения (вне комментариев)');
  assertTrue(!/June 2026/.test(html) && !/June 2026/.test(appInfoSrc), '«June 2026» нигде не осталось');
  assertTrue(!/сентябрь 2026/.test(htmlNoComments), 'index.html: месяц релиза не захардкожен (вне комментариев)');
  assertTrue(!/Обновлено:/.test(html.replace(/function renderReleaseInfo\(\)\{[\s\S]*?\n\}/, '').replace(/\/\*[\s\S]*?\*\//g, '')),
    'index.html: «Обновлено:» только внутри renderReleaseInfo() (не в разметке/CSS)');
  // тесты: ни один не хардкодит версию приложения как ожидание, кроме этого файла (единственная точка сверки)
  const tests = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f !== path.basename(__filename));
  tests.forEach(f => {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
    assertTrue(!/Version 1\.0\.0/.test(src) && !/'1\.0\.0'/.test(src) && !/'1\.1\.0'/.test(src) && !/June 2026/.test(src) && !/сентябрь 2026/.test(src),
      `tests/${f}: без литералов версии приложения/месяца релиза`);
  });
}

// ============ §5 — footer: две строки, читаемость в light/dark, pinned, без перекрытия ============
{
  const css = (html.match(/\.drawer-footer\{[^}]*\}/) || [''])[0];
  assertTrue(/margin-top:auto/.test(css) && /text-align:center/.test(css), 'Footer: pinned к низу (margin-top:auto), центрирован');
  assertTrue(!/position:(absolute|fixed)/.test(css), 'Footer: в потоке (не absolute/fixed) — не может перекрыть пункты меню');
  assertTrue(/env\(safe-area-inset-bottom\)/.test(css), 'Footer: safe-area снизу сохранена');
  assertTrue(/font-size:11\.5px/.test(css), 'Footer: компактный кегль (второстепенный)');
  assertTrue(/color:var\(--muted\)/.test(css), 'Footer: цвет через токен --muted (адаптация light/dark)');
  assertTrue(/\.drawer-footer \.rel-name\{/.test(html) && /\.drawer-footer \.rel-date\{/.test(html), 'Footer: стили двух строк');
  assertTrue(!/\.drawer-footer \.rel-ver\b/.test(html), 'Footer: старый .rel-ver (одна строка «·» через ::before) убран');
  // контраст --muted к фону низа шторки (--hero-bottom) в обеих темах ≥ 3:1
  const lightBlock = html.slice(html.indexOf(':root, [data-theme="light"]{'), html.indexOf('[data-theme="dark"]{'));
  const darkBlock = html.slice(html.indexOf('[data-theme="dark"]{'), html.indexOf('</style>'));
  const tok = (block, name) => (block.match(new RegExp('--' + name + ':([^;]+);')) || [])[1];
  const resolve = (block, v, depth) => { const m = v && v.match(/^var\(--([\w-]+)\)$/); return m && depth < 5 ? resolve(block, tok(block, m[1]), depth + 1) : v; };
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const lFg = resolve(lightBlock, tok(lightBlock, 'muted'), 0), lBg = resolve(lightBlock, tok(lightBlock, 'hero-bottom'), 0);
  const dFg = resolve(darkBlock, tok(darkBlock, 'muted'), 0), dBg = resolve(darkBlock, tok(darkBlock, 'hero-bottom'), 0);
  assertTrue(/^#[0-9a-f]{6}$/i.test(lFg) && /^#[0-9a-f]{6}$/i.test(lBg), `light: токены --muted/--hero-bottom разрешились (${lFg} / ${lBg})`);
  assertTrue(/^#[0-9a-f]{6}$/i.test(dFg) && /^#[0-9a-f]{6}$/i.test(dBg), `dark: токены --muted/--hero-bottom разрешились (${dFg} / ${dBg})`);
  if (/^#/.test(lFg) && /^#/.test(lBg)) assertTrue(contrast(lFg, lBg) >= 3, `light: контраст footer ${contrast(lFg, lBg).toFixed(2)}:1 ≥ 3:1`);
  if (/^#/.test(dFg) && /^#/.test(dBg)) assertTrue(contrast(dFg, dBg) >= 3, `dark: контраст footer ${contrast(dFg, dBg).toFixed(2)}:1 ≥ 3:1`);
  // footer — последний элемент .drawer-scroll
  const drawerHtml = html.slice(html.indexOf('<div class="overlay drawer-ov" id="drawerOverlay">'), html.indexOf('<!-- Безопасность'));
  assertTrue(/<div class="drawer-footer" id="drawerRelease"><\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*$/.test(drawerHtml.trimEnd() + '\n'),
    'Footer: последний элемент .drawer-scroll (после всех групп)');
}

// ============ §6 — структура шторки TASK_050 не изменена ============
{
  const drawerHtml = html.slice(html.indexOf('<div class="overlay drawer-ov" id="drawerOverlay">'), html.indexOf('<!-- Безопасность'));
  const rows = [...drawerHtml.matchAll(/<button class="drawer-row" id="(\w+)">/g)].map(m => m[1]);
  assertEqual(rows, ['drCats', 'drGoals', 'drCalendar', 'drRecur', 'drHealth', 'drStats', 'drNotif', 'drExport', 'drMore'], 'Пункты шторки без изменений');
  ['id="drawerHead"', 'id="drTheme"', 'id="drThemeLbl"', 'id="drawerBalance"', 'id="fcVal"', 'id="fcChg"', 'id="fcEye"', 'id="drNotifBadge"'].forEach(s =>
    assertTrue(drawerHtml.includes(s), `Шторка: ${s} на месте`));
  assertEqual((drawerHtml.match(/<div class="drawer-group-title">/g) || []).length, 3, 'Три группы');
  assertTrue(/function openDrawer\(\)\{\n  \$\('#drawerAvatar'\)/.test(html) && /function closeDrawer\(\)\{\$\('#drawerOverlay'\)\.classList\.remove\('show'\);document\.body\.classList\.remove\('drawer-open'\);\}/.test(html),
    'openDrawer()/closeDrawer() не изменены');
  assertTrue(/\$\('#drTheme'\)\.onclick=\(\)=>\{toggleTheme\(\);/.test(html) && /\$\('#drawerHead'\)\.onclick=\(\)=>\{closeDrawer\(\);openProfile\(\);\}/.test(html),
    'Обработчики темы/профиля не изменены');
  assertTrue(/\$\('#fcVal'\)\.textContent=num\(capChg\.endCapital\);/.test(html), 'renderFinanceCard(): баланс как раньше');
  assertTrue(/if\(a\.releaseNotes\)\{ el\.classList\.add\('tappable'\); el\.onclick=\(\)=>openWhatsNew&&openWhatsNew\(\); \}/.test(html),
    'Хук «Что нового» (releaseNotes → tappable) сохранён');
}

// ============ §7 — sw.js: cache version — отдельная сущность ============
{
  assertTrue(/const CACHE = 'finance-v183';/.test(sw), 'sw.js: cache version finance-v183 (был v182 — PWA получит новый footer)');
  assertTrue(!/AppInfo|1\.1\.0/.test(sw), 'sw.js: cache version не выводится из semantic version');
  assertTrue(/'\.\/js\/core\/app_info\.js'/.test(sw), 'sw.js: app_info.js в списке кэшируемых ASSETS');
  assertTrue(!/finance-v1\d\d|CACHE/.test(appInfoSrc), 'app_info.js: не ссылается на cache version SW');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
