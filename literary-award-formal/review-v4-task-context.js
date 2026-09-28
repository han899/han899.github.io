'use strict';
(function(){
const R=window.RF4;if(!R)return;const baseSet=R.setMain;
R.setMain=html=>{
 const r=R.route();
 if(R.s.role==='judge'&&r&&(r.page==='round1'||r.page==='round2')){
  const isR1=r.page==='round1',group=R.s.group||'目前組別';
  const title=isR1?`${group}｜第一輪入圍初選`:`${group}｜第二輪正式評分`;
  const help=isR1?'本輪不打分數：請閱讀作品並選出你認為值得入圍的作品，正式送出前都可調整。':'本輪需要評分：請依評分標準逐篇評分；整組正式送出前都可反覆修改。';
  html=`<section class="rf4-task-context"><div>${R.badge('你的評審任務','purple')}<h2>${R.esc(title)}</h2><p>${R.esc(help)}</p><p class="muted tiny">作品匿名編號只用於識別；請以此處顯示的「組別＋輪次」為審查依據。</p></div></section>${html}`;
 }
 return baseSet(html);
};
// 專案總覽由 review-v4-overview.js 單一負責。
 // 這個模組只補強評審 round1/round2 的任務脈絡，不再覆寫 R.pages.overview。

setTimeout(R.schedule,0);
})();