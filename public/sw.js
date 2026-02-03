const CACHE_NAME = 'lotgo-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/common.css',
  './css/auth.css',
  './css/lobby.css',
  './css/online.css',
  './css/profile.css',
  './css/shop.css',
  './css/singlegame.css',
  './js/app.js',
  './js/firebase-config.js',
  './js/lang.js',
  './js/singlegame.js',
  './js/shop.js',
  './js/profile.js',
  './js/online-lobby.js',
  './js/online-game.js',
  './images/logo.png',
  './images/coin-icon.png',
  './images/default-user.png'
];

// 설치 시 캐시 저장
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 요청 시 캐시에서 반환 (오프라인 대응)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 캐시에 있으면 반환, 없으면 네트워크 요청
      return response || fetch(event.request);
    })
  );
});

// 업데이트 시 구버전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});
