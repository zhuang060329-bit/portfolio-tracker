// 極簡 service worker：只做兩件事 —
// 1) 讓 Android 端滿足 PWA 可安裝條件
// 2) 導航請求斷線時給離線頁
// 刻意不快取任何資產或資料：金融數字寧可載入失敗，不可顯示過期值。
const CACHE = "sw-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/offline.html"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match("/offline.html")),
  );
});
