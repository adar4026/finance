// Service worker — офлайн-кэш приложения
const CACHE = 'finance-v170';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './wave-card.jpg',
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
  './js/services/finance_card_service.js',
  './js/services/analytics_service.js',
  './js/services/budget_service.js',
  './js/services/goal_service.js',
  './js/services/forecast_service.js',
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
  './js/services/security_service.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: онлайн — всегда свежая версия (обновляем кэш), офлайн — из кэша
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
