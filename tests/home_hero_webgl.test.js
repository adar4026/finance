// tests/home_hero_webgl.test.js — TASK_054: WebGL-фон hero «жидкая ткань» (перенос
// реализации Lexcar с палитрой Finance). Статические проверки по исходникам
// index.html / js/ui/hero_canvas.js / sw.js (тот же приём, что
// tests/home_hero_screen.test.js) + юнит-тесты чистых частей модуля в
// эмулированном окружении без WebGL (fallback-путь).
// Запуск: node tests/home_hero_webgl.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const src = fs.readFileSync(path.join(root, 'js', 'ui', 'hero_canvas.js'), 'utf8');
const lexcarPath = path.join(root, '..', 'LexCar', 'src', 'components', 'HeroCanvas.js');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function ruleBody(selector) {
  const re = new RegExp(selector.replace(/[.#()>:\[\]="~-]/g, c => '\\' + c) + '\\{([^}]*)\\}');
  const m = html.match(re);
  return m ? m[1] : null;
}
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const lightBlock = css.slice(css.indexOf(':root, [data-theme="light"]{'), css.indexOf('[data-theme="dark"]{'));
const darkBlock = css.slice(css.indexOf('[data-theme="dark"]{'), css.indexOf('[data-theme="dark"]{') + 6000);

// ============ §1 — разметка: один canvas строго внутри hero-слоя ============
{
  const ambM = html.match(/<div class="finance-ambient" id="financeAmbient" aria-hidden="true">([\s\S]*?)<\/div>/);
  assertTrue(!!ambM, 'слой .finance-ambient на месте (TASK_047 не сломан)');
  const inner = ambM ? ambM[1] : '';
  assertEqual((inner.match(/<canvas /g) || []).length, 1, 'ровно один <canvas> в .finance-ambient');
  assertTrue(/<canvas class="hero-canvas" id="heroCanvas" aria-hidden="true"><\/canvas>/.test(inner), 'canvas: класс .hero-canvas, id #heroCanvas, aria-hidden');
  const canvasIdx = inner.indexOf('<canvas'), blobIdx = inner.indexOf('class="ambient-blob');
  assertTrue(canvasIdx > -1 && canvasIdx < blobIdx, 'canvas — первый ребёнок слоя (за blob\'ами; CSS-fallback поверх, пока canvas прозрачен)');
  assertEqual((inner.match(/class="ambient-blob blob-\d"/g) || []).length, 4, 'CSS-fallback: все 4 blob-слоя сохранены');
  assertTrue(/class="ambient-fade"/.test(inner), 'CSS-fallback: .ambient-fade сохранён');
  assertEqual((html.match(/id="heroCanvas"/g) || []).length, 1, 'id #heroCanvas уникален');
}

// ============ §2 — CSS: canvas покрывает только hero, за UI, без overflow ============
{
  const c = ruleBody('.hero-canvas');
  assertTrue(!!c, 'правило .hero-canvas есть');
  assertTrue(/position:absolute/.test(c), '.hero-canvas — position:absolute внутри слоя');
  assertTrue(/height:var\(--hero-h\)/.test(c), '.hero-canvas — высота ровно var(--hero-h) (hero), не inset:0 на всю страницу');
  assertTrue(!/inset:0/.test(c), '.hero-canvas — без inset:0 (ошибка Lexcar .home-ambient не повторяется)');
  assertTrue(/width:100%/.test(c) && /left:0/.test(c) && /top:0/.test(c), '.hero-canvas — top:0;left:0;width:100%');
  assertTrue(/pointer-events:none/.test(c), '.hero-canvas — pointer-events:none');
  assertTrue(/opacity:0/.test(c) && /transition:opacity \.9s ease/.test(c), '.hero-canvas — прозрачен до активации, fade-in 0.9s (как Lexcar)');
  assertEqual(ruleBody('.hero-canvas--on'), 'opacity:1', '.hero-canvas--on — opacity:1');
  const off = ruleBody('.hero-canvas--on ~ .ambient-blob,\n  .hero-canvas--on ~ .ambient-fade');
  assertTrue(!!off, 'при активном canvas CSS-blob\'ы и .ambient-fade гаснут одним правилом');
  assertTrue(/animation:none/.test(off) && /visibility:hidden/.test(off) && /opacity:0/.test(off), 'гашение: animation:none + opacity:0 + visibility:hidden (уходят из композитинга)');
  assertTrue(/transition:opacity \.9s ease,visibility 0s linear \.9s/.test(off), 'гашение синхронно fade-in canvas (0.9s), без flash');
  // слой .finance-ambient и его z-index/overflow не тронуты
  const amb = ruleBody('.finance-ambient');
  assertTrue(/z-index:0/.test(amb) && /overflow:hidden/.test(amb) && /pointer-events:none/.test(amb), '.finance-ambient: z-index:0, overflow:hidden, pointer-events:none — как в TASK_047');
  // UI поверх не анимируется: никаких новых transform/parallax на hero-контенте
  assertTrue(!/\.hero-balance\{[^}]*transform/.test(css) && !/\.topbar\{[^}]*transform/.test(css), 'UI (topbar/hero-balance) без transform/parallax');
}

// ============ §3 — токены палитры: light + dark, из брендовых цветов Finance ============
{
  const keys = ['top', 'bot', 'c1', 'c2', 'c3', 'deep', 'alpha', 'light'];
  keys.forEach(k => {
    assertTrue(new RegExp('--hero-gl-' + k + ':').test(lightBlock), `light: токен --hero-gl-${k} задан`);
    assertTrue(new RegExp('--hero-gl-' + k + ':').test(darkBlock), `dark: токен --hero-gl-${k} задан`);
  });
  assertTrue(/--hero-gl-c1:var\(--accent\)/.test(lightBlock) && /--hero-gl-c1:var\(--accent\)/.test(darkBlock), 'primary fold = фирменный --accent (violet), не хардкод');
  assertTrue(/--hero-gl-bot:var\(--hero-bottom\)/.test(lightBlock) && /--hero-gl-bot:var\(--hero-bottom\)/.test(darkBlock), 'низ сцены = --hero-bottom (шов с фоном списка невозможен)');
  assertTrue(/--hero-gl-c2:var\(--accent2\)/.test(darkBlock), 'dark: secondary fold = --accent2');
  assertTrue(/--hero-gl-c2:#b5abf9/.test(lightBlock), 'light: secondary fold = lavender #b5abf9 (конец --cap-grad)');
  // брендовые токены и CSS-fallback TASK_047 не изменены
  assertTrue(/--accent:#6d5df6; --accent2:#8b7cf8;/.test(lightBlock), '--accent/--accent2 не тронуты');
  assertTrue(/--hero-b1:rgba\(96,165,250,\.72\)/.test(lightBlock) && /--hero-top:#dbeafe/.test(lightBlock), 'токены CSS-fallback --hero-* (TASK_047) не тронуты');
  // ни одного teal/ice-цвета Lexcar
  ['#d9ecf4', '#eaf4f7', '#0f181b', '#efe7d8'].forEach(hex => assertTrue(!css.includes(hex), `палитра Lexcar (${hex}) не скопирована`));
}

// ============ §4 — подключение и запуск ============
{
  assertTrue(/<script src="js\/ui\/hero_canvas\.js"><\/script>/.test(html), 'js/ui/hero_canvas.js подключён');
  assertTrue(html.indexOf('js/ui/hero_canvas.js') < html.indexOf('<script>\n'), 'модуль подключён до основного inline-скрипта');
  assertEqual((html.match(/AF\.HeroCanvas\.mount\(\$\('#heroCanvas'\)\)/g) || []).length, 1, 'ровно один вызов AF.HeroCanvas.mount(#heroCanvas) в блоке «Старт»');
  const startIdx = html.indexOf('/* ============ Старт ============ */');
  assertTrue(startIdx > -1 && html.indexOf('AF.HeroCanvas.mount') > startIdx, 'mount — в блоке «Старт», после load()/showScreen()');
  assertTrue(!/<script[^>]*src="https?:\/\/[^"]*(three|pixi|regl|ogl|twgl)/i.test(html), 'без внешних WebGL-библиотек');
  assertTrue(/'\.\/js\/ui\/hero_canvas\.js'/.test(sw), 'sw.js: новый файл в ASSETS');
  assertTrue(/const CACHE = 'finance-v186';/.test(sw), 'sw.js: cache version поднят до finance-v186');
}

// ============ §5 — модуль: шейдер и настройки 1-в-1 с Lexcar ============
{
  assertTrue(/const DPR_CAP = 1\.5;/.test(src), 'DPR cap 1.5');
  assertTrue(/const TARGET_FPS = 30;/.test(src), '~30 fps throttle');
  assertTrue(/powerPreference: 'low-power'/.test(src), 'low-power context');
  assertTrue(/new Float32Array\(\[-1, -1, 3, -1, -1, 3\]\)/.test(src), 'один fullscreen triangle');
  assertTrue(/gl\.drawArrays\(gl\.TRIANGLES, 0, 3\)/.test(src), 'один draw на кадр');
  assertTrue(/float snoise\(vec2 v\)/.test(src), '2D simplex noise');
  assertTrue(/float fold\(vec2 p, float t, vec2 dir, float seed\)/.test(src), 'height-field fold(dir, seed)');
  assertTrue(/vec3 layer\(vec3 col, vec2 p, float t, vec2 dir, float seed, vec3 tint, float alpha\)/.test(src), 'слой layer() с pseudo-normal');
  assertTrue(/normalize\(vec3\(-\(hx - h\) \/ e \* 0\.30, -\(hy - h\) \/ e \* 0\.30, 1\.0\)\)/.test(src), 'псевдонормаль через конечные разности');
  assertTrue(/float diff = clamp\(dot\(N, L\)/.test(src) && /float spec = pow\(clamp\(dot\(N, H\)/.test(src), 'diffuse + specular');
  assertTrue(/mix\(shaded, u_deep, \(1\.0 - diff\) \* 0\.26\)/.test(src), 'мягкая тень к u_deep');
  assertTrue(/shaded \+= vec3\(1\.0\) \* spec \* u_light/.test(src), 'светлая кромка складки (u_light)');
  // три слоя с разными dir/seed
  const layers = src.match(/col = layer\(col, p, t, vec2\(([^)]*)\), (\d\.\d), (u_c\d), (u_alpha\.[xyz])\)/g) || [];
  assertEqual(layers.length, 3, 'три слоя ткани');
  const dirs = layers.map(l => l.match(/vec2\(([^)]*)\)/)[1].replace(/\s/g, ''));
  assertEqual(dirs, ['1.0,-0.35', '-0.85,0.30', '0.55,0.85'], 'направления дрейфа — как в Lexcar, не синхронизированы');
  assertEqual(layers.map(l => l.match(/\), (\d\.\d), /)[1]), ['0.0', '1.0', '2.0'], 'у каждого слоя свой seed');
  assertTrue(/mix\(col, u_bot, smoothstep\(0\.58, 1\.0, uv\.y\)\)/.test(src), 'нижний fade к u_bot (читаемость показателей, мягкий переход)');
  // прямое сравнение с Lexcar, если репозиторий доступен рядом
  if (fs.existsSync(lexcarPath)) {
    const lex = fs.readFileSync(lexcarPath, 'utf8');
    const frag = s => { const m = s.match(/const FRAG = `([\s\S]*?)`;/); return m ? m[1].replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim() : null; };
    assertEqual(frag(src), frag(lex), 'FRAG-шейдер побайтно (без комментариев) совпадает с Lexcar HeroCanvas.js');
    const vert = s => { const m = s.match(/const VERT = `([\s\S]*?)`;/); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };
    assertEqual(vert(src), vert(lex), 'VERT-шейдер совпадает с Lexcar');
  }
}

// ============ §6 — модуль: lifecycle и fallback ============
{
  assertTrue(/prefers-reduced-motion: reduce/.test(src), 'учитывает prefers-reduced-motion');
  assertTrue(/new IntersectionObserver\(/.test(src), 'IntersectionObserver — пауза вне viewport');
  assertTrue(/document\.hidden/.test(src) && /'visibilitychange'/.test(src), 'пауза при document.hidden');
  assertTrue(/new ResizeObserver\(resize\)/.test(src), 'resize через ResizeObserver, не в кадре');
  assertTrue(/if \(cw === w && ch === h && d === dpr\) return;/.test(src), 'resize только при реальном изменении размера/DPR');
  assertTrue(/'webglcontextlost'/.test(src) && /e\.preventDefault\(\)/.test(src), 'webglcontextlost + preventDefault');
  assertTrue(/'webglcontextrestored'/.test(src), 'webglcontextrestored — реинициализация');
  assertTrue(/t \+= Math\.min\(now - last, FRAME_MS \* 3\) \/ 1000;/.test(src), 'время накапливается по кадрам с clamp delta — без скачка после фона');
  assertTrue(/attributeFilter: \['data-theme'\]/.test(src), 'палитра обновляется по смене data-theme (MutationObserver)');
  assertTrue(!/loseContext\(\)/.test(src), 'loseContext() в cleanup не вызывается (подход Lexcar)');
  assertTrue(!/deviceMemory/.test(src) && !/hardwareConcurrency/.test(src), 'нет жёсткого отказа по deviceMemory/hardwareConcurrency');
  assertTrue(/cancelAnimationFrame\(raf\)/.test(src) && /io\.disconnect\(\)/.test(src) && /mo\.disconnect\(\)/.test(src) && /ro\.disconnect\(\)/.test(src), 'cleanup: RAF + IO + MO + RO');
  assertTrue(/catch \(e\) \{ console\.warn\('HeroCanvas:', e\); inst\.run = null; \}/.test(src), 'runtime-исключение → fallback, не падение приложения');
}

// ============ §7 — юнит: модуль в окружении без WebGL (fallback) и парсер палитры ============
{
  const classes = new Set();
  const canvas = {
    getContext: () => null,
    classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
    clientWidth: 390, clientHeight: 460,
  };
  const styles = {
    '--hero-gl-top': ' #e6e1fb', '--hero-gl-bot': '#eef2f8', '--hero-gl-c1': '#6d5df6',
    '--hero-gl-c2': 'rgb(181, 171, 249)', '--hero-gl-c3': '#fff', '--hero-gl-deep': '#4a3ac0',
    '--hero-gl-alpha': '.46 .40 .52', '--hero-gl-light': '.75',
  };
  const ctx = {
    window: null, document: { documentElement: {}, hidden: false, addEventListener() {}, removeEventListener() {} },
    getComputedStyle: () => ({ getPropertyValue: k => styles[k] || '' }),
    console, performance: { now: () => 0 },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  };
  ctx.window = ctx; ctx.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const HC = ctx.AF.HeroCanvas;
  assertTrue(!!HC && typeof HC.mount === 'function', 'AF.HeroCanvas.mount доступен');
  assertEqual(HC.DPR_CAP, 1.5, 'экспортирован DPR_CAP');
  assertEqual(HC.mount(canvas), false, 'без WebGL mount() → false (CSS-fallback)');
  assertEqual(HC.isActive(), false, 'без WebGL isActive() → false');
  assertTrue(!classes.has('hero-canvas--on'), 'без WebGL класс hero-canvas--on не ставится (canvas прозрачен)');
  HC.destroy();
  // reduced motion → не запускается даже при наличии WebGL
  let ctxCalls = 0;
  const canvasGL = Object.assign({}, canvas, { getContext: () => { ctxCalls++; return null; } });
  ctx.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  assertEqual(HC.mount(canvasGL), false, 'reduced motion: mount() → false');
  assertEqual(ctxCalls, 0, 'reduced motion: WebGL-контекст даже не запрашивается');
  HC.destroy();
  // палитра из токенов
  const pal = HC.readPalette();
  assertEqual(pal.c1.map(v => Math.round(v * 255)), [109, 93, 246], 'readPalette: #6d5df6 → RGB 0..1');
  assertEqual(pal.c2.map(v => Math.round(v * 255)), [181, 171, 249], 'readPalette: rgb(...) парсится');
  assertEqual(pal.c3, [1, 1, 1], 'readPalette: короткий #fff парсится');
  assertEqual(pal.top.map(v => Math.round(v * 255)), [230, 225, 251], 'readPalette: пробелы вокруг значения игнорируются');
  assertEqual(pal.alpha, [0.46, 0.4, 0.52], 'readPalette: alpha — три числа');
  assertEqual(pal.light, 0.75, 'readPalette: light — число');
  styles['--hero-gl-deep'] = 'oops'; styles['--hero-gl-alpha'] = '';
  const pal2 = HC.readPalette();
  assertEqual(pal2.deep.map(v => Math.round(v * 255)), [74, 58, 191], 'readPalette: невалидный токен → встроенный fallback-цвет');
  assertEqual(pal2.alpha, [0.46, 0.40, 0.52], 'readPalette: пустой alpha → fallback');
}

console.log(`home_hero_webgl: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
