// Network-first strategy: always try network, fall back to cache only when offline.
// This ensures users always see the latest build when they're online and still
// get an offline experience if they lose connectivity.
const CACHE = 'carbonchip-bi-v5-plupload';
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/icon-192.png', '/icon-512.png',
  '/src/styles.css',
  '/src/data.jsx', '/src/ui.jsx', '/src/charts.jsx', '/src/quickentry.jsx', '/src/plimport.jsx', '/src/app.jsx',
  '/src/tabs/dashboard.jsx', '/src/tabs/operations.jsx', '/src/tabs/sales.jsx',
  '/src/tabs/finance.jsx', '/src/tabs/fleet.jsx', '/src/tabs/forecast.jsx', '/src/tabs/admin.jsx',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req)
      .then(res => {
        // Update cache in the background for same-origin successful responses
        if (res && res.ok && new URL(req.url).origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
  );
});
