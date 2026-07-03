// RC3: PWAオフラインキャッシュは一旦無効化。
// 万一このファイルが古いブラウザ側の登録から実行されても、
// 即座に自身を登録解除し、作成済みキャッシュを破棄する（キルスイッチ）。
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
      const registration = await self.registration.unregister();
      const clientsList = await self.clients.matchAll({ type: "window" });
      clientsList.forEach((client) => client.navigate(client.url));
      return registration;
    })()
  );
});
