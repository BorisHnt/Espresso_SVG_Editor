const CACHE = "espresso-svg-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./main.js",
  "./styles/main.css",
  "./core/eventBus.js",
  "./core/state.js",
  "./core/history.js",
  "./engine/svgEngine.js",
  "./engine/selection.js",
  "./engine/pathEditor.js",
  "./engine/transform.js",
  "./engine/snapping.js",
  "./ui/tools.js",
  "./ui/icons.js",
  "./ui/canvasSettings.js",
  "./ui/layers.js",
  "./ui/properties.js",
  "./ui/codeEditor.js",
  "./exporters/index.js",
  "./importers/index.js",
  "./optimizer/optimizer.js",
  "./optimizer/worker.js",
  "./animation/index.js",
  "./utils/xml.js",
  "./assets/tabler-sprite.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    }),
  );
});
