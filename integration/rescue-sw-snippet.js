// ============================================================
// PWA 逃生模块 (rescue module)
// 用法:把这段代码 append 到主项目的 service-worker.js 末尾
// 或在 SW 入口 importScripts('/rescue-sw-snippet.js')
// ============================================================

(function () {
  'use strict';

  // ========== 配置区 ==========

  // 部署在第三方稳定域上的逃生页 URL
  // 推荐:GitHub Pages / Cloudflare Pages / Vercel
  var RESCUE_URL = 'https://YOUR-USERNAME.github.io/pwa-rescue/rescue.html';

  // 本地缓存名,改版本号即可强制刷新
  var RESCUE_CACHE = 'pwa-rescue-v1';

  // 最终兜底域名(rescue.html 都拉不到时用)
  var HARDCODED_FALLBACK = 'https://b.com';

  // ============================

  // 安装阶段:把逃生页拉下来缓存住
  self.addEventListener('install', function (event) {
    event.waitUntil(
      caches.open(RESCUE_CACHE).then(function (cache) {
        return fetch(RESCUE_URL, { mode: 'no-cors', cache: 'no-store' })
          .then(function (res) { return cache.put(RESCUE_URL, res); })
          ['catch'](function () { /* 首次拉不到也别阻塞 SW 安装 */ });
      })
    );
    if (typeof self.skipWaiting === 'function') self.skipWaiting();
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
  });

  // 关键:导航请求(打开页面)失败时,返回逃生页
  // 只接管 navigate 类型,不影响 API 和静态资源
  self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.mode !== 'navigate') return;

    event.respondWith(
      fetch(req).catch(function () {
        // 网络失败 = 主域可能被封,启用逃生
        return caches.open(RESCUE_CACHE).then(function (cache) {
          return cache.match(RESCUE_URL).then(function (cached) {
            if (cached) return cached;

            // 极端情况:逃生页也没缓存到,内联兜底
            var html = ''
              + '<!doctype html><html><head><meta charset="utf-8">'
              + '<title>Loading...</title></head><body>'
              + '<script>'
              + 'location.replace(' + JSON.stringify(HARDCODED_FALLBACK)
              + ' + location.search + location.hash);'
              + '<\/script>'
              + '</body></html>';
            return new Response(html, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          });
        });
      })
    );
  });

  // 接收主线程消息:刷新逃生页
  // 主线程在每次 PWA 启动时发送 'refresh-rescue' 即可
  self.addEventListener('message', function (event) {
    if (event.data === 'refresh-rescue') {
      caches.open(RESCUE_CACHE).then(function (cache) {
        fetch(RESCUE_URL, { mode: 'no-cors', cache: 'no-store' })
          .then(function (res) { return cache.put(RESCUE_URL, res); })
          ['catch'](function () {});
      });
    }
  });
})();
