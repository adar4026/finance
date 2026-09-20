// tests/rebrand_lexmoney.test.js — TASK_059: ребрендинг PWA в «LexMoney».
// Проверяет: <title> и Apple/PWA meta в index.html; name/short_name/icons в
// manifest.json; ссылки на иконки; реальные размеры PNG (IHDR) — 180/32/192/
// 512; мастер-файл lexmoney.png (строчными, квадратный); sw.js — cache
// version ≥ finance-v191, актуальные иконки в precache, нет мёртвых
// изображений; старые пользовательские названия («Финансы» как имя
// приложения, «A-Lex Finance», «Alex Finance») не видны пользователю;
// внутренние идентификаторы (cache prefix, ключ формата резервной копии,
// id источника импорта) намеренно НЕ переименованы.
// Запуск: node tests/rebrand_lexmoney.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
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

// Размер PNG из заголовка IHDR (байты 16..23) — без внешних зависимостей.
function pngSize(file) {
  const buf = fs.readFileSync(path.join(root, file));
  const sig = buf.slice(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), colorType: buf[25] };
}

// ============ §1 — index.html: title и Apple/PWA meta ============
{
  assertTrue(/<title>LexMoney<\/title>/.test(html), '<title>LexMoney</title>');
  assertEqual((html.match(/<title>/g) || []).length, 1, 'ровно один <title>');
  assertTrue(/<meta name="apple-mobile-web-app-title" content="LexMoney">/.test(html),
    'apple-mobile-web-app-title = LexMoney (имя на экране «Домой» iPhone)');
  assertTrue(/<meta name="apple-mobile-web-app-capable" content="yes">/.test(html), 'apple-mobile-web-app-capable сохранён');
  assertTrue(/<meta name="mobile-web-app-capable" content="yes">/.test(html), 'mobile-web-app-capable сохранён');
  assertTrue(/<link rel="manifest" href="manifest.json">/.test(html), 'ссылка на manifest.json сохранена');
  assertTrue(/<link rel="apple-touch-icon" href="apple-touch-icon.png">/.test(html), '<link rel="apple-touch-icon" href="apple-touch-icon.png">');
  assertTrue(/<link rel="icon" href="favicon-32.png" sizes="32x32">/.test(html), '<link rel="icon"> → favicon-32.png');
  const head = html.slice(0, html.indexOf('</head>'));
  assertTrue(!/Финансы|A-Lex Finance|Alex Finance|Money Flow/.test(head.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')),
    '<head>: старых названий (Финансы / A-Lex Finance / Money Flow) нет вне комментариев');
  assertTrue(!/<meta name="application-name"/.test(html) || /<meta name="application-name" content="LexMoney">/.test(html),
    'application-name (если есть) = LexMoney');
}

// ============ §2 — manifest.json ============
{
  assertEqual(manifest.name, 'LexMoney', 'manifest.name = LexMoney');
  assertEqual(manifest.short_name, 'LexMoney', 'manifest.short_name = LexMoney');
  assertTrue(/LexMoney/.test(manifest.description || '') && !/Финансы|A-Lex/.test(manifest.description || ''),
    'manifest.description упоминает LexMoney и не содержит старого названия');
  assertEqual(manifest.start_url, './index.html', 'start_url не изменён');
  assertEqual(manifest.scope, './', 'scope не изменён (deployment path GitHub Pages не трогаем)');
  assertEqual(manifest.display, 'standalone', 'display standalone сохранён');
  const icons = manifest.icons || [];
  const i192 = icons.find(i => i.src === 'icon-192.png');
  const i512 = icons.find(i => i.src === 'icon-512.png' && i.purpose !== 'maskable');
  assertTrue(!!i192 && i192.sizes === '192x192' && i192.type === 'image/png', 'manifest.icons: icon-192.png 192x192 image/png');
  assertTrue(!!i512 && i512.sizes === '512x512' && i512.type === 'image/png', 'manifest.icons: icon-512.png 512x512 image/png');
  assertTrue(icons.every(i => /^icon-(192|512)\.png$/.test(i.src)), 'manifest.icons: только icon-192.png / icon-512.png (нет ссылок на старые изображения)');
  icons.forEach(i => assertTrue(fs.existsSync(path.join(root, i.src)), `manifest.icons: файл ${i.src} существует`));
}

// ============ §3 — иконки: мастер-файл и реальные размеры PNG ============
{
  const rootFiles = fs.readdirSync(root);
  assertTrue(rootFiles.includes('lexmoney.png'), 'мастер-файл lexmoney.png (строго строчными) в корне');
  assertTrue(!rootFiles.some(f => /^lexmoney\.png$/i.test(f) && f !== 'lexmoney.png'), 'нет второго файла LexMoney.PNG / Lexmoney.png с другим регистром');
  const master = pngSize('lexmoney.png');
  assertTrue(!!master && master.w === master.h && master.w >= 512, `lexmoney.png — квадратный PNG ≥ 512px (${master && master.w}×${master && master.h})`);
  const expected = { 'apple-touch-icon.png': 180, 'favicon-32.png': 32, 'icon-192.png': 192, 'icon-512.png': 512 };
  Object.entries(expected).forEach(([file, size]) => {
    const s = pngSize(file);
    assertTrue(!!s, `${file} — валидный PNG`);
    if (s) {
      assertEqual([s.w, s.h], [size, size], `${file} — ровно ${size}×${size}`);
      assertTrue(s.colorType === 2 || s.colorType === 6, `${file} — truecolor PNG (без палитры/индексации)`);
    }
  });
  // apple-touch-icon.png: iOS сам скругляет углы — файл квадратный, без alpha-полей
  const at = pngSize('apple-touch-icon.png');
  assertTrue(!!at && at.colorType === 2, 'apple-touch-icon.png — RGB без alpha (iOS не любит прозрачные touch-icon)');
}

// ============ §4 — sw.js: cache version и precache ============
{
  const m = sw.match(/const CACHE = 'finance-v(\d+)';/);
  assertTrue(!!m && parseInt(m[1], 10) >= 191, 'sw.js: cache version ≥ finance-v191 (PWA получит новые иконки и manifest)');
  assertTrue(/const CACHE = 'finance-v\d+';/.test(sw), 'sw.js: cache key prefix «finance-v» сохранён (внутренний идентификатор, не бренд)');
  ['./manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon-32.png', './index.html', './']
    .forEach(a => assertTrue(sw.includes(`'${a}'`), `sw.js ASSETS: ${a} в precache`));
  assertTrue(!/wave-card\.jpg/.test(sw), 'sw.js ASSETS: мёртвый wave-card.jpg (не используется с TASK_003) убран из precache');
  assertTrue(!/icon\.svg|IMG_\d+\.jpg|lexmoney\.png/.test(sw), 'sw.js ASSETS: нет icon.svg / IMG_*.jpg / мастер-файла lexmoney.png');
  // все precache-файлы (локальные) реально существуют — иначе addAll упадёт и SW не установится
  const assets = [...sw.matchAll(/'(\.\/[^']+)'/g)].map(x => x[1]).filter(a => a !== './');
  assets.forEach(a => assertTrue(fs.existsSync(path.join(root, a)), `sw.js ASSETS: ${a} существует`));
  assertTrue(/keys\.filter\(k => k !== CACHE\)\.map\(k => caches\.delete\(k\)\)/.test(sw), 'sw.js activate: старые кэши удаляются — прежние иконки/manifest не отдаются');
}

// ============ §5 — AppInfo.name и пользовательские строки ============
{
  const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(appInfoSrc, ctx);
  assertEqual(ctx.AF.AppInfo.name, 'LexMoney', 'AF.AppInfo.name = LexMoney (footer шторки «LexMoney · vX.Y.Z»)');
  const htmlNoComments = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  assertTrue(!/A-Lex Finance|Alex Finance/.test(htmlNoComments), 'index.html: «A-Lex Finance» / «Alex Finance» не осталось вне комментариев');
  assertTrue(/Резервная копия LexMoney/.test(html) && /description:'LexMoney backup'/.test(html), 'backup: подписи LexMoney');
  assertTrue(/rp:\{name:'LexMoney'\}/.test(html), 'WebAuthn rp.name = LexMoney');
  assertTrue(/Веб-версия LexMoney не передаёт/.test(html), 'Безопасность: примечание о виджетах — LexMoney');
  assertTrue(/'lexmoney_backup_'\+stamp\(\)/.test(html) && /'lexmoney_safety_'\+stamp\(\)/.test(html) && /'lexmoney_'\+stamp\(\)\+'\.csv'/.test(html)
    && /'lexmoney_'\+stamp\(\)\+'\.xlsx'/.test(html) && /a\.download='lexmoney-'/.test(html), 'имена скачиваемых файлов — lexmoney_* / lexmoney-*');
  assertTrue(!/alex_finance_/.test(html), 'index.html: старого префикса alex_finance_ нет');
  const exportSrc = fs.readFileSync(path.join(root, 'js/services/export_service.js'), 'utf8');
  assertTrue(/<title>LexMoney — отчёт<\/title>/.test(exportSrc) && /<h1>💰 LexMoney<\/h1>/.test(exportSrc), 'HTML-отчёт экспорта — LexMoney');
  const backupSrc = fs.readFileSync(path.join(root, 'js/services/backup_service.js'), 'utf8');
  assertTrue(/это не резервная копия LexMoney\./.test(backupSrc), 'backup_service: сообщение об ошибке — LexMoney');
  assertTrue(/app: 'Alex Finance',/.test(backupSrc), 'backup_service: ключ формата app: \'Alex Finance\' сохранён (совместимость старых копий — не бренд)');
  const importSrc = fs.readFileSync(path.join(root, 'js/services/import_source_service.js'), 'utf8');
  assertTrue(/id: 'alexfinance', name: 'LexMoney'/.test(importSrc), 'import_source: id alexfinance сохранён, видимое имя — LexMoney');
  // «Money Flow» — стороннее приложение (источник импорта), не переименовывается
  assertTrue(/name: 'Money Flow'/.test(importSrc), 'import_source: Money Flow — сторонний источник, оставлен');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
