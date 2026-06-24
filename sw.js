const CACHE_NAME = 'mahiru-music-v1';
const ASSETS = [
  './',
  './index.html',
  './music/list.json',
  './img/lihui.png',
  './img/changpian.jpg'
];

// 安装阶段：把上面列出的本地网页、皮肤、唱片图死死缓存住
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// 拦截阶段：除了音频大文件走网络，网页和图片断网也能秒开
self.addEventListener('fetch', e => {
  if (e.request.url.includes('music') || e.request.url.includes('163.com') || e.request.url.includes('supabase')) {
      return; // 动态音频流不硬缓存，防止塞爆浏览器磁盘
  }
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});