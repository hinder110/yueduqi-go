const CACHE_STATIC = 'yueduqi-static-v1';
const CACHE_CONTENT = 'yueduqi-content-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_CONTENT)
          .map((k) => caches.delete(k))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 章节正文 API — 缓存优先
  if (url.pathname.includes('/api/') && url.pathname.endsWith('/content')) {
    event.respondWith(
      caches.open(CACHE_CONTENT).then((cache) =>
        cache.match(event.request).then((cached) => {
          const network = fetch(event.request).then((res) => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          });
          return cached ?? network;
        })
      )
    );
    return;
  }

  // 其他资源 — 网络优先，失败时回退缓存
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
