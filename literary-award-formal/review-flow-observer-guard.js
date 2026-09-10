'use strict';
(function(){
  const Native=window.MutationObserver;
  if(!Native)return;
  window.__nativeReviewMutationObserver=Native;
  // review-flow-v3 已有初始執行與 hashchange 事件，不需要再監看整個 DOM。
  // 這裡暫時提供 no-op observer，避免內容或導覽列每次變動都重跑整個權限 UI。
  window.MutationObserver=class {
    constructor(){ }
    observe(){ }
    disconnect(){ }
    takeRecords(){ return []; }
  };
})();