// tests/drawer_balance_inline.test.js — TASK_052: боковая шторка, «Общий баланс»
// без отдельной карточки. Проверяет: у #drawerBalance нет собственного фона/
// рамки/тени/скругления/blur (карточный вид убран); блок расположен между
// #drawerHead и первой группой «Планирование»; #fcVal/#fcChg/#fcEye встречаются
// в документе ровно по одному разу; глаз в шторке имеет тап-зону ≥44×44 px без
// круглой плашки; метка «Общий баланс» не uppercase и не слишком жирная; сумма
// крупная и полужирная; строка изменения сохраняет .pos/.neg (доход/расход);
// текст читаем в light/dark; структура остальной шторки (TASK_050/051) не
// изменилась; sw.js — новый cache version.
// Запуск: node tests/drawer_balance_inline.test.js

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

// ============ §1 — карточка убрана: #drawerBalance без фона/рамки/тени/скругления/blur ============
{
  const balanceRule = (balanceCss.match(/\.drawer-balance\{[^}]*\}/) || [''])[0];
  assertTrue(!!balanceRule, '.drawer-balance{...} правило найдено');
  ['background:', 'border:', 'box-shadow:', 'border-radius:', 'backdrop-filter:', '-webkit-backdrop-filter:'].forEach(prop => {
    assertTrue(!balanceRule.includes(prop), `.drawer-balance: без "${prop}" (карточный вид убран)`);
  });
  assertTrue(!/\.drawer-balance\{[^}]*var\(--hero-glass\)/.test(balanceCss), '.drawer-balance: старое стекло --hero-glass убрано');
  assertTrue(!/\.drawer-balance\{[^}]*var\(--card\)/.test(balanceCss), '.drawer-balance: старый белый --card не возвращён');
  assertTrue(!/\.drawer-balance\{[^}]*var\(--tx-card-shadow\)/.test(balanceCss), '.drawer-balance: тень карточки убрана');
  assertTrue(/\.drawer-balance\{[^}]*text-align:left/.test(balanceCss), '.drawer-balance: текст выровнен влево (как раньше)');
}

// ============ §2 — расположение: между профилем и «Планирование» ============
{
  const headIdx = drawerHtml.indexOf('id="drawerHead"');
  const balIdx = drawerHtml.indexOf('id="drawerBalance"');
  const firstGroupIdx = drawerHtml.indexOf('class="drawer-group"');
  assertTrue(headIdx > -1 && balIdx > headIdx && firstGroupIdx > balIdx,
    '#drawerBalance расположен между #drawerHead и первой группой меню');
  assertTrue(!/Общий капитал/.test(drawerHtml) && !/sparkline/i.test(drawerHtml),
    'Карточка «Общий капитал»/спарклайн не возвращены на Главную/шторку');
}

// ============ §3 — единственность id: без дубликатов ============
{
  ['fcVal', 'fcChg', 'fcEye'].forEach(id => {
    const count = (html.match(new RegExp(`id="${id}"`, 'g')) || []).length;
    assertEqual(count, 1, `#${id} встречается в документе ровно один раз (не дублирован)`);
  });
  const balBlockMatch = drawerHtml.match(/<div class="drawer-balance" id="drawerBalance">([\s\S]*?)<\/div>\s*<\/div>/);
  assertTrue(!!balBlockMatch, '#drawerBalance: внутренняя разметка найдена');
  if (balBlockMatch) {
    assertTrue(balBlockMatch[1].includes('id="fcVal"') && balBlockMatch[1].includes('id="fcChg"') && balBlockMatch[1].includes('id="fcEye"'),
      '#drawerBalance содержит #fcVal/#fcChg/#fcEye внутри себя');
    assertTrue(!/drawer-row|drawer-card/.test(balBlockMatch[1]), '#drawerBalance не переиспользует .drawer-row/.drawer-card (это не пункт меню и не карточка группы)');
  }
}

// ============ §4 — глаз: тап-зона ≥44×44, без круглой плашки ============
{
  // TASK_052: скоуп-оверрайд .drawer-balance .fc-eye убран — глаз наследует базовый .fc-eye,
  // тот же 44×44, что на Главной/Счетах (единый компонент, не уменьшенная копия).
  assertTrue(!/\.drawer-balance \.fc-eye\{/.test(drawerCss), '.drawer-balance .fc-eye: собственного оверрайда нет (наследует базовый .fc-eye)');
  const baseFcEye = (html.match(/(?<!\.drawer-balance |\.hero-balance |\.acc-hero )\.fc-eye\{[^}]*\}/) || [''])[0];
  assertTrue(/width:44px;height:44px/.test(baseFcEye), 'Базовый .fc-eye: тап-зона 44×44 px');
  assertTrue(/border:none/.test(baseFcEye) && /background:none/.test(baseFcEye),
    'Базовый .fc-eye: без рамки и фона (не круглая плашка)');
  assertTrue(/border-radius:12px/.test(baseFcEye), 'Базовый .fc-eye: скругление на активном состоянии умеренное (не капсула-плашка)');
}

// ============ §5 — метка: обычный регистр, не слишком жирная ============
{
  assertTrue(/\.drawer-balance \.hb-label\{[^}]*text-transform:none/.test(balanceCss),
    'Метка «Общий баланс»: обычный регистр (не uppercase, как в старой карточке)');
  const weightMatch = balanceCss.match(/\.drawer-balance \.hb-label\{[^}]*font-weight:(\d+)/);
  assertTrue(!!weightMatch && Number(weightMatch[1]) <= 500, 'Метка «Общий баланс»: умеренный вес (≤500, не жирная)');
  assertTrue(/\.drawer-balance \.hb-label\{[^}]*color:var\(--muted\)/.test(balanceCss), 'Метка «Общий баланс»: приглушённый цвет через токен');
  assertTrue(drawerHtml.includes('<span class="hb-label">Общий баланс</span>'), 'Разметка метки не изменилась (обычный регистр текста в HTML)');
}

// ============ §6 — сумма: крупная, полужирная, tabular-nums (наследуется) ============
{
  const valMatch = balanceCss.match(/\.drawer-balance \.hb-val\{[^}]*font-size:(\d+)px[^}]*font-weight:(\d+)/);
  assertTrue(!!valMatch, '.drawer-balance .hb-val: font-size/font-weight заданы');
  if (valMatch) {
    assertTrue(Number(valMatch[1]) >= 26, `Сумма: крупный размер (${valMatch[1]}px ≥ 26px)`);
    assertTrue(Number(valMatch[2]) >= 700, `Сумма: полужирная (${valMatch[2]} ≥ 700)`);
  }
  // font-variant-numeric:tabular-nums объявлен в базовом .hb-val — оверрайд его не отменяет
  assertTrue(/\.hb-val\{[^}]*font-variant-numeric:tabular-nums/.test(html), 'Базовый .hb-val: tabular-nums (наследуется суммой в шторке)');
  assertTrue(!/\.drawer-balance \.hb-val\{[^}]*font-variant-numeric:normal/.test(balanceCss), 'Оверрайд не отключает tabular-nums');
}

// ============ §7 — строка изменения: .pos/.neg сохранены, компактная ============
{
  assertTrue(/\.fc-chg\.pos\{color:var\(--income\)\}/.test(html) && /\.fc-chg\.neg\{color:var\(--expense\)\}/.test(html),
    'Семантика знака изменения (.pos/.neg → --income/--expense) не изменена');
  assertTrue(/\$\('#fcVal'\)\.textContent=num\(capChg\.endCapital\);/.test(html), 'renderFinanceCard(): #fcVal заполняется как раньше');
  assertTrue(/chgEl\.className='fc-chg'\+\(capChg\.change>eps\?' pos':capChg\.change<-eps\?' neg':''\);/.test(html),
    'renderFinanceCard(): класс .pos/.neg для #fcChg вычисляется как раньше');
  assertTrue(/sign=capChg\.change>eps\?'\+':\(capChg\.change<-eps\?'−':''\)/.test(html), 'Знак изменения — «−» (правильный минус), не изменён');
}

// ============ §8 — privacy mode (#fcEye) не менялся ============
{
  assertTrue(/\$\('#fcEye'\)\.onclick=\(\)=>\{state\.hideAmounts=!state\.hideAmounts;save\(\);render\(\);updateEye\(\);updateFcEye\(\);\};/.test(html),
    'Обработчик #fcEye не изменён');
  assertTrue(/function updateFcEye\(\)\{const e=\$\('#fcEye'\);if\(!e\)return;e\.textContent=state\.hideAmounts\?'🙈':'👁';/.test(html),
    'updateFcEye() не изменена');
  assertTrue(/chgEl\.textContent=maskAmt\(state\.currency\)\+' '\+suf;/.test(html), 'Маскировка суммы изменения (maskAmt) не изменена');
}

// ============ §9 — light/dark: только существующие токены, читаемость ============
{
  const balanceRule = (balanceCss.match(/\.drawer-balance\{[^}]*\}/) || [''])[0];
  const scopedRules = balanceCss.match(/\.drawer-balance [^{]+\{[^}]*\}/g) || [];
  const allBalanceCss = balanceRule + scopedRules.join('');
  const hexes = (allBalanceCss.match(/#[0-9a-fA-F]{3,8}\b/g) || []);
  assertEqual(hexes, [], '.drawer-balance и вложенные правила: без хардкода hex-цветов');
  assertTrue(!/rgba\(/.test(allBalanceCss), '.drawer-balance и вложенные правила: без хардкода rgba');
  // только существующие семантические/шторочные токены
  const usedTokens = [...allBalanceCss.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1]);
  const allowedTokens = new Set(['--muted', '--text', '--income', '--expense']);
  usedTokens.forEach(t => assertTrue(allowedTokens.has(t), `.drawer-balance: токен ${t} — из существующего семантического набора`));
  assertTrue(usedTokens.includes('--muted'), 'Метка использует приглушённый токен --muted');
  // контраст --muted / --text к фону низа шторки (--hero-bottom) в обеих темах ≥ 3:1 (текст) / ≥4.5:1 (мелкий)
  const lightBlock = html.slice(html.indexOf(':root, [data-theme="light"]{'), html.indexOf('[data-theme="dark"]{'));
  const darkBlock = html.slice(html.indexOf('[data-theme="dark"]{'), html.indexOf('</style>'));
  const tok = (block, name) => (block.match(new RegExp('--' + name + ':([^;]+);')) || [])[1];
  const resolve = (block, v, depth) => { const m = v && v.match(/^var\(--([\w-]+)\)$/); return m && depth < 5 ? resolve(block, tok(block, m[1]), depth + 1) : v; };
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  [['light', lightBlock], ['dark', darkBlock]].forEach(([theme, blk]) => {
    const bg = resolve(blk, tok(blk, 'hero-bottom'), 0);
    const mutedFg = resolve(blk, tok(blk, 'muted'), 0);
    const textFg = resolve(blk, tok(blk, 'text'), 0);
    if (/^#[0-9a-f]{6}$/i.test(bg) && /^#[0-9a-f]{6}$/i.test(mutedFg)) {
      assertTrue(contrast(mutedFg, bg) >= 3, `${theme}: метка --muted на фоне шторки контраст ${contrast(mutedFg, bg).toFixed(2)}:1 ≥ 3:1`);
    }
    if (/^#[0-9a-f]{6}$/i.test(bg) && /^#[0-9a-f]{6}$/i.test(textFg)) {
      assertTrue(contrast(textFg, bg) >= 4.5, `${theme}: сумма --text на фоне шторки контраст ${contrast(textFg, bg).toFixed(2)}:1 ≥ 4.5:1`);
    }
  });
}

// ============ §10 — отступ до «Планирование»: аккуратный, без «пустой карточки» ============
{
  const balanceMargin = balanceCss.match(/\.drawer-balance\{margin:([^;]+);/);
  assertTrue(!!balanceMargin, '.drawer-balance: margin задан');
  if (balanceMargin) {
    const parts = balanceMargin[1].trim().split(/\s+/);
    const bottomMargin = parseInt(parts[2] || parts[0], 10);
    assertTrue(bottomMargin >= 0 && bottomMargin <= 14, `.drawer-balance: нижний отступ ${bottomMargin}px — компактный (0–14px)`);
  }
  assertTrue(/\.drawer-group\{margin:12px 16px 0/.test(drawerCss), '.drawer-group: верхний отступ групп не менялся (12px)');
}

// ============ §11 — остальная шторка (TASK_050/051) не изменилась ============
{
  const rows = [...drawerHtml.matchAll(/<button class="drawer-row" id="(\w+)">/g)].map(m => m[1]);
  assertEqual(rows, ['drCats', 'drGoals', 'drCalendar', 'drRecur', 'drHealth', 'drStats', 'drNotif', 'drExport', 'drMore'],
    'Все 9 пунктов меню на месте, в прежнем порядке');
  assertEqual((drawerHtml.match(/<div class="drawer-group-title">/g) || []).length, 3, 'Три группы меню сохранены');
  ['id="drawerHead"', 'id="drTheme"', 'id="drThemeLbl"', 'id="drNotifBadge"', 'id="drawerRelease"'].forEach(s =>
    assertTrue(drawerHtml.includes(s), `Шторка: ${s} на месте`));
  assertTrue(/function openDrawer\(\)\{\n  \$\('#drawerAvatar'\)/.test(html) && /function closeDrawer\(\)\{\$\('#drawerOverlay'\)\.classList\.remove\('show'\);document\.body\.classList\.remove\('drawer-open'\);\}/.test(html),
    'openDrawer()/closeDrawer() не изменены');
  assertTrue(/\$\('#drawerOverlay'\)\.onclick=e=>\{if\(e\.target\.id==='drawerOverlay'\)closeDrawer\(\);\};/.test(html), 'Backdrop-клик закрывает шторку (не изменён)');
  assertTrue(/\.drawer\{position:relative;width:86%;max-width:360px;height:100%/.test(drawerCss), 'Панель: ширина 86%/360px сохранена');
  assertTrue(/border-radius:0 28px 28px 0/.test(drawerCss), 'Панель: крупные скругления сохранены');
}

// ============ §12 — sw.js: cache version — новая, отдельная от semver ============
// TASK_053: точная версия ослаблена до формата/порога (та же схема, что между TASK_050→051) —
// последующие точечные задачи поднимают её дальше без изменений в этом файле.
{
  assertTrue(/const CACHE = 'finance-v(\d+)';/.test(sw) && parseInt(sw.match(/finance-v(\d+)/)[1], 10) >= 184, 'sw.js: cache version ≥ finance-v184 (был v183 — PWA получит новый вид баланса)');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
