// ============================================================
// PWA 逃生模块 - 主线程片段
// 用法:把这段代码加到主项目的 index.html <script> 里
// 推荐位置:在 navigator.serviceWorker.register 之后
// ============================================================

(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  // 等 SW 控制当前页面后,通知它刷新逃生页缓存
  function notifyRefresh() {
    if (navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage('refresh-rescue');
      } catch (e) {}
    }
  }

  // 已激活的情况(老 PWA)
  if (navigator.serviceWorker.controller) {
    notifyRefresh();
  }

  // 新注册的情况:等 ready 后通知
  navigator.serviceWorker.ready.then(function () {
    setTimeout(notifyRefresh, 1000);
  });
})();
