const CACHE = 'carbonchip-bi-v3-input';
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/icon-192.png', '/icon-512.png',
  '/src/styles.css',
  '/src/data.jsx', '/src/ui.jsx', '/src/charts.jsx', '/src/quickentry.jsx', '/src/app.jsx',
  '/src/tabs/dashboard.jsx', '/src/tabs/operations.jsx', '/src/tabs/sales.jsx',
  '/src/tabs/finance.jsx', '/src/tabs/fleet.jsx', '/src/tabs/forecast.jsx', '/src/tabs/admin.jsx',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{}))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
