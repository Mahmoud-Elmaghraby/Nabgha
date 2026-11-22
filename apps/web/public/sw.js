const CACHE_NAME = 'nabgha-v2-' + self.registration.scope;
const STATIC_ASSETS = ['/', '/index.html', '/offline.html', '/Logo-icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/storage/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
  // الصفحات: الشبكة الأول، ولو السيرفر مش متاح نعرض صفحة "مفيش اتصال"
  // (بدل ما نعرض واجهة فاضية بتفشل في تحميل بياناتها).
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match('/offline.html').then((r) => r || caches.match('/index.html'))
    )
  );
});
