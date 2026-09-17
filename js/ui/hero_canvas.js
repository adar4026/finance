// ui/hero_canvas.js — WebGL-фон hero Главной: «жидкая ткань / satin waves» (TASK_054).
// Перенос проверенной реализации Lexcar (LexCar/src/components/HeroCanvas.js,
// коммит 8a6b74d) без React: тот же шейдер, та же математика, тот же lifecycle;
// другая только палитра — фирменная violet/purple/lavender гамма Finance,
// которая приходит из CSS-токенов темы (--hero-gl-*), а не зашита в код.
//
// Один canvas строго в границах hero (высота var(--hero-h)) внутри слоя
// .finance-ambient. Фрагментный шейдер строит три height-field «складки»
// (низкочастотный simplex noise + синусоидальный displacement), считает
// псевдонормаль через конечные разности и освещает её: diffuse даёт объём,
// specular — светлую кромку складки, обратная сторона уходит в мягкую тень к
// глубокому пурпурному. Время непрерывное — видимого шва цикла нет.
//
// Производительность (PWA на iPhone): DPR ≤ 1.5, ~30 fps, один draw на кадр,
// low-power контекст, пауза при document.hidden и когда hero вне viewport.
// Если WebGL недоступен, шейдер не собрался, включён prefers-reduced-motion
// или контекст потерян — canvas остаётся прозрачным и виден CSS-fallback
// (blob'ы TASK_047). UI поверх фона не анимируется.
window.AF = window.AF || {};
AF.HeroCanvas = (function () {
  'use strict';

  const DPR_CAP = 1.5;
  const TARGET_FPS = 30;
  const FRAME_MS = 1000 / TARGET_FPS;
  const ON_CLASS = 'hero-canvas--on';

  // палитра — из токенов темы (:root / [data-theme="dark"]), см. index.html
  const TOKENS = ['top', 'bot', 'c1', 'c2', 'c3', 'deep'];
  const FALLBACK_PALETTE = {
    top: [0.894, 0.878, 0.980], bot: [0.933, 0.949, 0.973],
    c1: [0.427, 0.365, 0.965], c2: [0.710, 0.671, 0.976],
    c3: [0.957, 0.945, 1.000], deep: [0.290, 0.227, 0.749],
    alpha: [0.46, 0.40, 0.52], light: 0.75,
  };

  const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

  const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform vec2  u_res;
uniform float u_t;
uniform vec3  u_top, u_bot, u_c1, u_c2, u_c3, u_deep;
uniform vec3  u_alpha;
uniform float u_light;

// 2D simplex noise (Ashima Arts / Ian McEwan, MIT)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// height field одной складки: крупная синусоида, изогнутая низкочастотным шумом.
// dir — направление дрейфа (складка входит с одного края и уходит с другого),
// seed — своя фаза/форма у каждого слоя.
float fold(vec2 p, float t, vec2 dir, float seed) {
  vec2 q = p - dir * t * 0.05;
  float n1 = snoise(vec2(q.x * 0.75 + seed * 11.0, q.y * 1.05 + t * 0.03 + seed));
  float n2 = snoise(vec2(q.x * 1.3 - t * 0.02 + seed * 3.0, q.y * 1.4 + seed * 5.0));
  float w  = sin(q.x * 1.5 + q.y * 1.1 + n1 * 1.9 + t * 0.14 + seed * 2.0);
  return w * 0.58 + n1 * 0.45 + n2 * 0.06;
}

// один слой ткани: band — где складка видна, N — псевдонормаль поверхности
vec3 layer(vec3 col, vec2 p, float t, vec2 dir, float seed, vec3 tint, float alpha) {
  const float e = 0.035;
  float h  = fold(p, t, dir, seed);
  float hx = fold(p + vec2(e, 0.0), t, dir, seed);
  float hy = fold(p + vec2(0.0, e), t, dir, seed);
  vec3 N = normalize(vec3(-(hx - h) / e * 0.30, -(hy - h) / e * 0.30, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.75, 0.55));      // свет сверху-слева
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = clamp(dot(N, L), 0.0, 1.0);
  float spec = pow(clamp(dot(N, H), 0.0, 1.0), 12.0);
  float band = smoothstep(-0.35, 0.45, h) * (1.0 - smoothstep(0.55, 1.25, h));
  vec3 shaded = tint * (0.82 + 0.28 * diff);          // объём
  shaded = mix(shaded, u_deep, (1.0 - diff) * 0.26);  // мягкая тень на обратной стороне
  shaded += vec3(1.0) * spec * u_light;               // светлая кромка складки
  return mix(col, shaded, band * alpha);
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);   // y сверху вниз, как в CSS
  float aspect = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 1.15;
  float t = u_t;

  vec3 col = mix(u_top, u_bot, uv.y);
  col = layer(col, p, t, vec2( 1.0, -0.35), 0.0, u_c1, u_alpha.x);  // violet: слева-снизу вправо-вверх
  col = layer(col, p, t, vec2(-0.85, 0.30), 1.0, u_c2, u_alpha.y);  // lavender: справа влево
  col = layer(col, p, t, vec2( 0.55, 0.85), 2.0, u_c3, u_alpha.z);  // lilac white: через центр

  // плавно уходим в фон страницы к нижнему краю hero — без резкой линии;
  // заодно облегчаем зону показателей (низ hero) для читаемости
  col = mix(col, u_bot, smoothstep(0.58, 1.0, uv.y));
  gl_FragColor = vec4(col, 1.0);
}`;

  function reducedMotionQuery() {
    return (typeof window !== 'undefined' && window.matchMedia)
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  }

  // ---- палитра из CSS-токенов ----
  function parseColor(str) {
    const s = String(str || '').trim();
    let m = s.match(/^#([0-9a-f]{3})$/i);
    if (m) return m[1].split('').map(ch => parseInt(ch + ch, 16) / 255);
    m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
    m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
    return null;
  }
  function parseFloats(str, n) {
    const arr = String(str || '').trim().split(/[\s,]+/).map(Number);
    if (arr.length < n || arr.some(v => !isFinite(v))) return null;
    return arr.slice(0, n);
  }
  function readPalette() {
    const pal = {};
    let cs = null;
    try { cs = getComputedStyle(document.documentElement); } catch (e) { cs = null; }
    const get = (k) => (cs ? cs.getPropertyValue('--hero-gl-' + k) : '');
    TOKENS.forEach(k => { pal[k] = parseColor(get(k)) || FALLBACK_PALETTE[k]; });
    pal.alpha = parseFloats(get('alpha'), 3) || FALLBACK_PALETTE.alpha;
    const light = parseFloats(get('light'), 1);
    pal.light = light ? light[0] : FALLBACK_PALETTE.light;
    return pal;
  }

  // ---- WebGL ----
  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('HeroCanvas shader:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  // программа + fullscreen triangle + uniforms; вызывается при старте и после
  // восстановления контекста (ресурсы GPU после restore теряются полностью)
  function buildProgram(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); return null; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('HeroCanvas link:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
      return null;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const u = (n) => gl.getUniformLocation(prog, n);
    return {
      prog, vs, fs, buf,
      uRes: u('u_res'), uT: u('u_t'),
      uTop: u('u_top'), uBot: u('u_bot'), uC1: u('u_c1'), uC2: u('u_c2'),
      uC3: u('u_c3'), uDeep: u('u_deep'), uAlpha: u('u_alpha'), uLight: u('u_light'),
    };
  }
  function applyPalette(gl, P, pal) {
    gl.uniform3fv(P.uTop, pal.top);
    gl.uniform3fv(P.uBot, pal.bot);
    gl.uniform3fv(P.uC1, pal.c1);
    gl.uniform3fv(P.uC2, pal.c2);
    gl.uniform3fv(P.uC3, pal.c3);
    gl.uniform3fv(P.uDeep, pal.deep);
    gl.uniform3fv(P.uAlpha, pal.alpha);
    gl.uniform1f(P.uLight, pal.light);
  }
  function freeProgram(gl, P) {
    if (!P) return;
    try {
      gl.deleteBuffer(P.buf);
      gl.deleteProgram(P.prog);
      gl.deleteShader(P.vs);
      gl.deleteShader(P.fs);
    } catch (e) { /* контекст уже потерян — ресурсы освобождены драйвером */ }
  }

  // ---- экземпляр ----
  let inst = null;

  function start(canvas) {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
    if (!gl || gl.isContextLost()) return null;

    let P = buildProgram(gl);
    if (!P) return null;
    applyPalette(gl, P, readPalette());

    // размер только при реальном изменении CSS-размера или DPR — не в кадре
    let w = 0, h = 0, dpr = 0;
    const resize = () => {
      const cw = Math.round(canvas.clientWidth);
      const ch = Math.round(canvas.clientHeight);
      const d = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      if (cw < 2 || ch < 2) return;            // display:none (не-immersive экран) — ждём
      if (cw === w && ch === h && d === dpr) return;
      w = cw; h = ch; dpr = d;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(P.uRes, canvas.width, canvas.height);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);

    // рисуем только пока вкладка видна и hero в viewport. Время шейдера
    // накапливается по отрисованным кадрам с clamp'ом delta — после возврата
    // из фона ткань продолжает с того же места, а не прыгает вперёд.
    let raf = 0;
    let running = false;
    let visible = !document.hidden;
    let inView = true;
    let lost = false;
    let last = 0;
    let t = 0;
    const frame = (now) => {
      raf = 0;
      if (!running || lost) return;
      if (now - last >= FRAME_MS) {
        t += Math.min(now - last, FRAME_MS * 3) / 1000;
        last = now;
        gl.uniform1f(P.uT, t);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      raf = requestAnimationFrame(frame);
    };
    const sync = () => {
      const shouldRun = visible && inView && !lost;
      if (shouldRun && !running) {
        running = true;
        last = performance.now();
        if (!raf) raf = requestAnimationFrame(frame);
      } else if (!shouldRun && running) {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      }
    };
    const onVisibility = () => { visible = !document.hidden; sync(); };
    document.addEventListener('visibilitychange', onVisibility);
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
        inView = entries.some(en => en.isIntersecting);
        sync();
      }, { threshold: 0 })
      : null;
    if (io) io.observe(canvas);

    // палитра следует за темой без перезагрузки (applyTheme() пишет data-theme)
    const mo = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => {
        if (lost) return;
        applyPalette(gl, P, readPalette());
        if (!running) { gl.uniform1f(P.uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      })
      : null;
    if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // потеря контекста: гасим canvas (CSS-fallback снова виден); при
    // восстановлении собираем программу заново и продолжаем с того же t
    const onLost = (e) => {
      e.preventDefault();
      lost = true;
      sync();
      canvas.classList.remove(ON_CLASS);
    };
    const onRestored = () => {
      P = buildProgram(gl);
      if (!P) return;                          // остаёмся на CSS-fallback
      applyPalette(gl, P, readPalette());
      w = 0; h = 0; dpr = 0; resize();
      gl.uniform1f(P.uT, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      lost = false;
      canvas.classList.add(ON_CLASS);
      sync();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    // первый кадр синхронно, чтобы не было пустого canvas до fade-in
    gl.uniform1f(P.uT, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add(ON_CLASS);
    sync();

    return {
      gl,
      stop() {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        document.removeEventListener('visibilitychange', onVisibility);
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestored);
        if (io) io.disconnect();
        if (mo) mo.disconnect();
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        // контекст намеренно не теряем (loseContext) — canvas остаётся в DOM и
        // может быть запущен повторно (reduced-motion off) на том же контексте
        freeProgram(gl, P);
        P = null;
        canvas.classList.remove(ON_CLASS);
      },
    };
  }

  // Публичный API: mount(canvas) — один раз при старте приложения. Возвращает
  // true, если WebGL-слой активен; false — остался CSS-fallback.
  function mount(canvas) {
    if (!canvas || inst) return !!(inst && inst.run);
    const mq = reducedMotionQuery();
    inst = { canvas, run: null, mq, onMq: null };
    const tryStart = () => {
      if (inst.run || (mq && mq.matches)) return;
      try { inst.run = start(canvas); }
      catch (e) { console.warn('HeroCanvas:', e); inst.run = null; }
    };
    const tryStop = () => { if (inst.run) { inst.run.stop(); inst.run = null; } };
    if (mq) {
      inst.onMq = () => { if (mq.matches) tryStop(); else tryStart(); };
      if (mq.addEventListener) mq.addEventListener('change', inst.onMq);
      else if (mq.addListener) mq.addListener(inst.onMq);
    }
    tryStart();
    return !!inst.run;
  }
  function destroy() {
    if (!inst) return;
    if (inst.run) inst.run.stop();
    if (inst.mq && inst.onMq) {
      if (inst.mq.removeEventListener) inst.mq.removeEventListener('change', inst.onMq);
      else if (inst.mq.removeListener) inst.mq.removeListener(inst.onMq);
    }
    inst = null;
  }
  // true — WebGL-слой запущен и виден (при потерянном контексте — false: показан CSS-fallback)
  function isActive() { return !!(inst && inst.run && inst.canvas.classList.contains(ON_CLASS)); }

  return { mount, destroy, isActive, readPalette, DPR_CAP, TARGET_FPS };
})();
