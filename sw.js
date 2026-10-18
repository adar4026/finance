// Service worker — офлайн-кэш приложения
const CACHE = 'finance-v200';
// TASK_061: версия скриптов = номер кэша. index.html подключает локальные
// скрипты как js/…?v=200, precache кладёт их под теми же URL — HTML всегда
// получает «свой» JS (и онлайн, и офлайн), HTTP-кэш GitHub Pages (max-age=600)
// не может смешать новый HTML со старым JS или наоборот.
const V = CACHE.replace('finance-v', '');
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './js/core/result.js',
  './js/core/ids.js',
  './js/core/app_info.js',
  './js/database/store.js',
  './js/services/currency_service.js',
  './js/services/account_service.js',
  './js/services/tx_form_service.js',
  './js/services/tx_meta_service.js',
  './js/services/period_service.js',
  './js/services/place_breakdown_service.js',
  './js/services/finance_card_service.js',
  './js/services/analytics_service.js',
  './js/services/budget_service.js',
  './js/services/goal_service.js',
  './js/services/forecast_service.js',
  './js/services/recurring_service.js',
  './js/services/health_score_service.js',
  './js/services/xlsx_writer_service.js',
  './js/services/export_service.js',
  './js/services/backup_service.js',
  './js/services/csv_parser_service.js',
  './js/services/import_source_service.js',
  './js/services/import_mapping_service.js',
  './js/services/import_service.js',
  './js/services/category_taxonomy_service.js',
  './js/services/demo_data_service.js',
  './js/services/search_service.js',
  './js/services/haptics_service.js',
  './js/services/amount_input_service.js',
  './js/services/tx_time_service.js',
  './js/services/security_service.js',
  './js/ui/hero_canvas.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

const precacheUrl = a => (/^\.\/js\/.+\.js$/.test(a) ? a + '?v=' + V : a);

// cache:'reload' — мимо HTTP-кэша браузера: в новый кэш попадают файлы именно
// этой версии, а не копии, закэшированные до деплоя (иначе офлайн-набор мог быть смешанным)
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(a => new Request(precacheUrl(a), { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: онлайн — всегда свежая версия (обновляем кэш), офлайн — из кэша.
// Страница (навигация) — с перепроверкой (no-cache), чтобы после деплоя не
// открывался HTML из HTTP-кэша; в кэш кладутся только успешные ответы.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let netReq = req;
  if (req.mode === 'navigate') { try { netReq = new Request(req, { cache: 'no-cache' }); } catch (_) { netReq = req; } }
  e.respondWith(
    fetch(netReq).then(resp => {
      if (resp && resp.ok && (resp.type === 'basic' || resp.type === 'cors')) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return resp;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : r)))
  );
});
