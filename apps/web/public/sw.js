// Normal Node/Docker builds do not enable offline caching. If this origin
// previously served a static PWA, retire its worker after the old tabs close.
// The static-export build replaces this file with the generated offline worker.
// No forced takeover or reload: allow existing editors to finish their work.
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("cadverix-offline-")).map((name) => caches.delete(name)));
    await self.registration.unregister();
  })());
});
