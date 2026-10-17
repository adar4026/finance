// tests/pwa_cache.test.js — согласованность версий PWA (TASK_061).
// GitHub Pages отдаёт все файлы с Cache-Control: max-age=600, а перезагрузка
// перепроверяет только HTML (подресурсы — из HTTP-кэша). Без версий в URL
// новый HTML мог получить старый JS (и упасть) или наоборот. Проверяется:
//  1. каждый локальный <script> в index.html — js/…?v=N, N = номер кэша
//     sw.js (finance-vN); каждый такой файл есть в ASSETS и на диске;
//  2. sw.js в эмуляции: install кладёт в новый кэш именно версионные URL и
//     идёт мимо HTTP-кэша (cache:'reload'); activate удаляет старые кэши;
//     fetch — навигация с перепроверкой (no-cache), в кэш только успешные
//     ответы, офлайн — версия из кэша (HTML и JS одной версии), неизвестная
//     навигация офлайн → index.html.
// Запуск: node tests/pwa_cache.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swSrc = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) { if (cond) passed++; else { failed++; console.error(`FAIL: ${msg}`); } }

const ver = (swSrc.match(/const CACHE = 'finance-v(\d+)'/) || [])[1];
const assets = [...swSrc.matchAll(/^\s*'(\.\/[^']*)'/gm)].map(m => m[1]);

// ============ §1 — версии скриптов ============
{
  assertTrue(!!ver, 'sw.js: CACHE = finance-vN');
  const local = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
  assertTrue(local.length >= 30, `index.html: найдены локальные скрипты (${local.length})`);
  const bad = local.filter(s => !new RegExp('^js\\/[\\w/.-]+\\.js\\?v=' + ver + '$').test(s));
  assertTrue(bad.length === 0, `Все локальные скрипты подключены с ?v=${ver} (= cache version)` + (bad.length ? ': ' + bad.join(', ') : ''));
  local.forEach(s => {
    const file = s.replace(/\?v=\d+$/, '');
    assertTrue(assets.includes('./' + file), `${file} — в ASSETS sw.js (офлайн)`);
    assertTrue(fs.existsSync(path.join(root, file)), `${file} существует`);
  });
  assertTrue(!/<script src="js\/[^"?]+\.js"/.test(html), 'Нет локальных скриптов без версии');
  const jsAssets = assets.filter(a => /^\.\/js\/.+\.js$/.test(a));
  jsAssets.forEach(a => assertTrue(local.some(s => './' + s.replace(/\?v=\d+$/, '') === a), `ASSETS ${a} подключён в index.html`));
  assertTrue(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js@4\.4\.1\//.test(html), 'Chart.js — фиксированная версия в URL CDN');
}

// ============ §2 — sw.js в эмуляции ============
function makeEnv({ online }) {
  const stores = new Map();                  // cacheName → Map(url → body)
  const listeners = {};
  const fetchLog = [];
  const ORIGIN = 'https://adar4026.github.io';
  const abs = u => new URL(u, ORIGIN + '/finance/sw.js').href;
  class Req {
    constructor(input, init = {}) {
      const src = input instanceof Req ? input : null;
      this.url = src ? src.url : abs(input);
      this.method = (init.method || (src && src.method) || 'GET');
      this.mode = src ? (Object.keys(init).length && src.mode === 'navigate' ? 'same-origin' : src.mode) : (init.mode || 'cors');
      this.cache = init.cache || (src ? src.cache : 'default');
    }
  }
  class Resp {
    constructor(body, status = 200, type = 'basic') { this.body = body; this.status = status; this.ok = status >= 200 && status < 300; this.type = type; }
    clone() { return new Resp(this.body, this.status, this.type); }
  }
  const server = url => {
    const u = new URL(url);
    if (u.pathname.endsWith('/missing.js')) return new Resp('404', 404);
    return new Resp('v' + ver + ':' + u.pathname + u.search);
  };
  const keyOf = r => (typeof r === 'string' ? abs(r) : r.url);
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name);
      return {
        async addAll(reqs) { for (const r of reqs) { const resp = await sandbox.fetch(r); if (!resp.ok) throw new Error('addAll ' + r.url); m.set(keyOf(r), resp.body); } },
        async put(r, resp) { m.set(keyOf(r), resp.body); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(r) { const k = keyOf(r); for (const m of stores.values()) if (m.has(k)) return new Resp(m.get(k)); return undefined; },
  };
  const sandbox = {
    self: null, caches, Request: Req, URL,
    fetch: async (r) => { const req = r instanceof Req ? r : new Req(r); fetchLog.push(req); if (!online.value) throw new TypeError('offline'); return server(req.url); },
    console,
  };
  sandbox.self = {
    location: { origin: ORIGIN },
    addEventListener: (t, fn) => { listeners[t] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(swSrc, sandbox);
  return { sandbox, listeners, stores, fetchLog, Req, abs };
}
async function dispatch(env, type, extra = {}) {
  let p = null, resp = null;
  const ev = Object.assign({ waitUntil: x => { p = x; }, respondWith: x => { resp = x; } }, extra);
  env.listeners[type](ev);
  if (p) await p;
  return resp ? await resp : undefined;
}

(async () => {
  const online = { value: true };
  const env = makeEnv({ online });
  // старый кэш прошлой версии должен исчезнуть на activate
  (await env.sandbox.caches.open('finance-v192')).put('./index.html', { body: 'OLD' });

  await dispatch(env, 'install');
  const installReqs = env.fetchLog.slice();
  assertTrue(installReqs.length === assets.length + 1, `install: ${installReqs.length} запросов = ASSETS (+ CDN)`);
  assertTrue(installReqs.every(r => r.cache === 'reload'), "install: все запросы мимо HTTP-кэша (cache:'reload')");
  const cache = env.stores.get('finance-v' + ver);
  assertTrue(!!cache, `install: создан кэш finance-v${ver}`);
  const jsKeys = [...cache.keys()].filter(k => /\/js\/.+\.js/.test(k));
  assertTrue(jsKeys.length > 0 && jsKeys.every(k => k.endsWith('.js?v=' + ver)), `install: скрипты лежат под URL ?v=${ver} — как в index.html`);
  assertTrue(cache.has(env.abs('./index.html')) && cache.has(env.abs('./')), 'install: index.html и ./ в кэше');

  await dispatch(env, 'activate');
  assertTrue(!env.stores.has('finance-v192'), 'activate: старый кэш удалён');
  assertTrue(env.stores.has('finance-v' + ver), 'activate: новый кэш на месте');

  // онлайн: навигация с перепроверкой, скрипт по версии
  env.fetchLog.length = 0;
  const navReq = new env.Req('./index.html'); navReq.mode = 'navigate';
  const navResp = await dispatch(env, 'fetch', { request: navReq });
  assertTrue(navResp && navResp.ok, 'online: навигация отдаёт страницу');
  assertTrue(env.fetchLog[0] && env.fetchLog[0].cache === 'no-cache', "online: навигация — cache:'no-cache' (HTML не из HTTP-кэша)");
  const jsReq = new env.Req('./js/services/recurring_service.js?v=' + ver);
  const jsResp = await dispatch(env, 'fetch', { request: jsReq });
  assertTrue(jsResp && jsResp.body.includes('recurring_service.js?v=' + ver), 'online: скрипт по версионному URL — из сети');
  // ошибки не кэшируются
  await dispatch(env, 'fetch', { request: new env.Req('./js/missing.js') });
  await new Promise(r => setTimeout(r, 0));
  assertTrue(!cache.has(env.abs('./js/missing.js')), 'online: ответ 404 не попадает в кэш');
  // POST не перехватывается
  let responded = false;
  env.listeners.fetch({ request: new env.Req('./x', { method: 'POST' }), respondWith: () => { responded = true; } });
  assertTrue(!responded, 'POST не перехватывается');

  // офлайн: HTML и JS одной версии из кэша
  online.value = false;
  const offNav = new env.Req('./index.html'); offNav.mode = 'navigate';
  const offHtml = await dispatch(env, 'fetch', { request: offNav });
  assertTrue(offHtml && offHtml.body === 'v' + ver + ':/finance/index.html', 'offline: index.html из кэша этой версии');
  const offJs = await dispatch(env, 'fetch', { request: new env.Req('./js/services/forecast_service.js?v=' + ver) });
  assertTrue(offJs && offJs.body === 'v' + ver + ':/finance/js/services/forecast_service.js?v=' + ver, 'offline: скрипт той же версии из кэша');
  const offOld = await dispatch(env, 'fetch', { request: new env.Req('./js/services/forecast_service.js') });
  assertTrue(!offOld, 'offline: старый URL без версии не подменяется (нет смешения версий)');
  const offStart = new env.Req('./index.html?source=pwa'); offStart.mode = 'navigate';
  const offStartResp = await dispatch(env, 'fetch', { request: offStart });
  assertTrue(offStartResp && offStartResp.body === 'v' + ver + ':/finance/index.html', 'offline: неизвестная навигация → index.html');

  console.log(`\npwa_cache.test.js: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e); console.log(`\npwa_cache.test.js: ${passed} passed, ${failed + 1} failed`); process.exitCode = 1; });
