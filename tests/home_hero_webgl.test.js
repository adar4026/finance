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
  assertTrue(/const CACHE = 'finance-v(\d+)';/.test(sw) && parseInt(sw.match(/finance-v(\d+)/)[1], 10) >= 186, 'sw.js: cache version ≥ finance-v186');
}

// ============ §5 — модуль: шейдер (TASK_054 инфраструктура Lexcar + TASK_055 look «шёлковые волны») ============
{
  assertTrue(/const DPR_CAP = 1\.5;/.test(src), 'DPR cap 1.5');
  assertTrue(/const TARGET_FPS = 30;/.test(src), '~30 fps throttle');
  assertTrue(/powerPreference: 'low-power'/.test(src), 'low-power context');
  assertTrue(/new Float32Array\(\[-1, -1, 3, -1, -1, 3\]\)/.test(src), 'один fullscreen triangle');
  assertTrue(/gl\.drawArrays\(gl\.TRIANGLES, 0, 3\)/.test(src), 'один draw на кадр');
  assertTrue(/float snoise\(vec2 v\)/.test(src), '2D simplex noise');
  // TASK_055: геометрия — каждая волна отдельная крупная форма (гребень + впадина), свет от рельефа
  assertTrue(/mat2 rot\(float a\)/.test(src), 'поворот в систему координат волны (rot)');
  assertTrue(/float waveShape\(vec2 p, float t, float ang, float speed, float per, float w0, float seed\)/.test(src), 'waveShape(ang, speed, per, w0, seed) — у каждой волны своё направление/скорость/интервал/ширина/фаза');
  const wb = (src.match(/float waveShape\([^{]*\{([\s\S]*?)\n\}/) || [])[1] || '';
  assertTrue(/float y = q\.y - t \* speed;/.test(wb), 'волна ползёт поперёк (y − t·speed): входит с края, проходит, уходит');
  assertTrue(/float c = 0\.30 \* sin\(q\.x \* 0\.9[^;]*\+ 0\.42 \* snoise\(/s.test(wb.replace(/\n\s*/g, ' ')), 'кривизна центр-линии: дуга sin + шумовое отклонение (эволюционируют по t)');
  assertTrue(/float w = w0 \* \(1\.0 \+ 0\.40 \* snoise\(/.test(wb), 'ширина меняется вдоль гребня');
  assertTrue(/sin\(3\.14159 \* \(y - c\) \/ per\) \/ w;/.test(wb), 'поперечное расстояние периодизировано гладко (sin-warp, без шва)');
  assertTrue(/float crest  = exp\(-pow\(abs\(d\), 1\.5\)\);/.test(wb), 'ГРЕБЕНЬ: заострённый exp(−|d|^1.5)');
  assertTrue(/float valley = exp\(-\(d - 1\.6\) \* \(d - 1\.6\) \* 0\.9\);/.test(wb) && /return crest - 0\.55 \* valley;/.test(wb), 'ВПАДИНА на одном склоне гребня (асимметричный профиль)');
  // суммарный рельеф → одно освещение (волны взаимодействуют)
  assertTrue(/float relief\(vec2 p, float t, out float h1, out float h2, out float h3\)/.test(src), 'relief(): суммарный height field трёх волн');
  const waves = src.match(/h\d = ([\d.]+) \* waveShape\(p, t, (-?[\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), (\d\.\d)\);/g) || [];
  assertEqual(waves.length, 3, 'три волны (две доминирующие + вторичная)');
  const W = waves.map(l => l.match(/h\d = ([\d.]+) \* waveShape\(p, t, (-?[\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), (\d\.\d)\)/).slice(1).map(Number));
  const amps = W.map(x => x[0]).sort((a, b) => b - a);
  assertTrue(amps[0] >= 0.85 && amps[1] >= 0.85 && amps[2] <= 0.5, 'амплитуды: две доминирующие (≥0.85) и одна вторичная (≤0.5)');
  const angs = W.map(x => x[1]);
  assertTrue(Math.max(...angs) - Math.min(...angs) <= 0.6 && new Set(angs).size === 3, 'базовое направление согласовано (разброс ≤ 0.6 рад), но у каждой свой угол');
  ['скорость', 'интервал', 'ширина', 'seed'].forEach((n, i) => assertEqual(new Set(W.map(x => x[i + 2])).size, 3, `у каждой волны свой параметр: ${n}`));
  assertTrue(W.every(x => x[2] <= 0.08), 'все скорости медленные (≤ 0.08 ед/с)');
  assertTrue(W.every(x => x[4] >= 0.12 && x[4] <= 0.26), 'ширины волн 0.12–0.26 ед. (≈30–55 % ширины hero), не мелкие полоски');
  // освещение от формы
  assertTrue(/float H  = relief\(p, t, h1, h2, h3\);/.test(src) && /float Hx = relief\(p \+ vec2\(e, 0\.0\)/.test(src) && /float Hy = relief\(p \+ vec2\(0\.0, e\)/.test(src), 'нормаль — конечные разности суммарного рельефа (один расчёт света на все волны)');
  assertTrue(/normalize\(vec3\(-\(Hx - H\) \/ e \* 0\.50, -\(Hy - H\) \/ e \* 0\.50, 1\.0\)\)/.test(src), 'сила нормали 0.50 — рельеф читается');
  assertTrue(/float lit    = clamp\(diff - L\.z/.test(src) && /float shadow = clamp\(L\.z - diff/.test(src), 'освещённый/теневой склон относительно плоскости (плоский фон не тонируется)');
  assertTrue(/float valley = smoothstep\(0\.0, -0\.40, H\);/.test(src), 'затемнение во впадине');
  assertTrue(/float rim    = pow\(1\.0 - N\.z, 1\.3\)/.test(src), 'световая кромка вдоль крутых склонов');
  assertTrue(/float spec   = pow\(clamp\(dot\(N, Hv\), 0\.0, 1\.0\), 8\.0\);/.test(src), 'highlight гребня — широкий (pow 8 < 12 Lexcar)');
  assertTrue(/mix\(col, u_c3, \(spec \* 0\.9 \+ rim \* 0\.35\) \* u_light\)/.test(src), 'highlight/кромка окрашены в u_c3 (молочная лаванда), не белый');
  assertTrue(!/vec3\(1\.0\) \* spec/.test(src) && !/streak/.test(src), 'нет белого specular и нет streak-полосок');
  assertTrue(/mix\(col, u_deep, shadow \* 0\.65 \+ valley \* 0\.25\)/.test(src), 'тень: теневой склон + ложбина → u_deep');
  // окраска — по гребню каждой волны
  ['h1, 0.0, 1.0) * u_alpha.x', 'h2, 0.0, 1.0) * u_alpha.y', 'h3, 0.0, 1.0) * u_alpha.z'].forEach((f, i) =>
    assertTrue(src.includes(`clamp(${f})`), `окраска волны ${i + 1} по её гребню (u_c${i + 1} × alpha)`));
  assertTrue(/mix\(col, u_bot, smoothstep\(0\.58, 1\.0, uv\.y\)\)/.test(src), 'нижний fade к u_bot (читаемость показателей, мягкий переход)');
  // uniforms API не изменился — JS-обвязка TASK_054 (applyPalette/readPalette) та же
  ['u_res', 'u_t', 'u_top', 'u_bot', 'u_c1', 'u_c2', 'u_c3', 'u_deep', 'u_alpha', 'u_light']
    .forEach(u => assertTrue(new RegExp('uniform[^;]*\\b' + u + '\\b').test(src), `uniform ${u} на месте`));
  // инфраструктура (VERT, noise, обвязка) — прежняя Lexcar, если репозиторий доступен рядом
  if (fs.existsSync(lexcarPath)) {
    const lex = fs.readFileSync(lexcarPath, 'utf8');
    const vert = s => { const m = s.match(/const VERT = `([\s\S]*?)`;/); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };
    assertEqual(vert(src), vert(lex), 'VERT-шейдер совпадает с Lexcar');
    const noise = s => { const m = s.match(/float snoise\(vec2 v\) \{[\s\S]*?\n\}/); return m ? m[0].replace(/\s+/g, ' ') : null; };
    assertEqual(noise(src), noise(lex), 'simplex noise совпадает с Lexcar');
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
  assertEqual(pal2.alpha, [0.44, 0.40, 0.36], 'readPalette: пустой alpha → fallback');
}

console.log(`home_hero_webgl: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
