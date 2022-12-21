self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', (e) => {
  const isTarget =
        e.request.url.startsWith('http') &&
        (e.request.url.includes('recording') ||
         e.request.url.includes('lyra-benchmark'));
  if(!isTarget) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request).then((response) => {
      if (response.status === 0) {
        return response;
      }

      // SharedArrayBuffer 用に COEP と COOP を設定する
      const headers = new Headers(response.headers);
      headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      headers.set("Cross-Origin-Opener-Policy", "same-origin");

      // Chrome でローカルの http で実行する場合に必要
      headers.set("Content-Security-Policy", "treat-as-public-address");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    })
  );
});
