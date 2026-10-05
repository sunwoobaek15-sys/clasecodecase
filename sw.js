/* SAVE CITY — 오프라인 지원 (네트워크 우선, 실패하면 저장된 파일 사용) */
const CACHE = 'savecity-v2';
const FONT_CACHE = 'savecity-fonts-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-192.png',
  './js/util.js',
  './js/data.js',
  './js/engine.js',
  './js/rank-rules.js',
  './js/storage.js',
  './js/audio.js',
  './js/render-city.js',
  './js/ui.js',
  './js/view.js',
  './js/app.js',
  './js/ranking.js',
  './js/screens/home.js',
  './js/screens/save.js',
  './js/screens/city.js',
  './js/screens/shop.js',
  './js/screens/history.js',
  './js/screens/achievements.js',
  './js/screens/stats.js',
  './js/screens/settings.js',
  './js/screens/profile.js',
  './js/screens/ranking.js',
  './js/screens/admin.js',
  './js/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});
