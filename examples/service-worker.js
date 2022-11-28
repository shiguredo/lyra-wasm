self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', (e) => {
  if(!e.request.url.startsWith('http')){
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request).then((response) => {
      const headers = new Headers(response.headers);

      if (e.request.url.endsWith('/') || e.request.url.endsWith('/index.html')) {
        // SharedArrayBuffer 用に COEP と COOP を設定する
        headers.set("Cross-Origin-Embedder-Policy", "require-corp");
        headers.set("Cross-Origin-Opener-Policy", "same-origin");
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    })
  );
});
