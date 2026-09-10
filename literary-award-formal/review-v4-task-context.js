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
R.pages.overview=async function(){
 if(R.s.role!=='judge'){
  document.documentElement.classList.remove('review-v4-pending');document.documentElement.classList.add('review-v4-ready');return;
 }
 const [{data:as,error:ae},{data:r1,error:e1},{data:r2,error:e2}]=await Promise.all([
  R.sb.from('judge_assignments').select('*').eq('project_id',R.s.project.id).eq('judge_user_id',R.s.user.id),
  R.sb.from('round1_judge_view').select('id,group_name').eq('project_id',R.s.project.id),
  R.sb.from('round2_judge_view').select('id,group_name').eq('project_id',R.s.project.id)
 ]);
 if(ae||e1||e2)return R.setMain(`<section class="section"><div class="danger-note">${R.esc((ae||e1||e2)?.message||'評審任務載入失敗')}</div></section>`);
 const c1=g=>(r1||[]).filter(x=>x.group_name===g).length,c2=g=>(r2||[]).filter(x=>x.group_name===g).length;
 R.setMain(`<section class="section"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2>我的評審任務</h2><p class="muted">這裡會明確列出你被指派的組別與輪次。匿名作品編號只是識別碼，不代表組別或審查階段。</p></div>${R.badge('以管理員指派權限為準','purple')}</div>${(as||[]).length?`<div class="grid cards">${as.map(a=>{const d1=R.deadline(a.round1_deadline),d2=R.deadline(a.round2_deadline);return`<article class="card rf4-task-card"><h3>${R.esc(a.group_name)}</h3>${a.round1_enabled?`<div class="rf4-task-row"><div><b>第一輪｜入圍初選</b><div class="muted tiny">不打分數，挑選喜歡且值得入圍的作品</div><div>目前可審：<b>${c1(a.group_name)}</b> 份　${R.badge(d1.label,d1.cls)}</div></div><button class="btn primary" data-task="round1" data-group="${R.esc(a.group_name)}">進入第一輪</button></div>`:''}${a.round2_enabled?`<div class="rf4-task-row"><div><b>第二輪｜正式評分</b><div class="muted tiny">依評分標準逐篇給分，最後整組正式送出</div><div>目前可評：<b>${c2(a.group_name)}</b> 份　${R.badge(d2.label,d2.cls)}</div></div><button class="btn primary" data-task="round2" data-group="${R.esc(a.group_name)}">進入第二輪</button></div>`:''}</article>`}).join('')}</div>`:'<div class="empty">目前尚未被指派任何評審組別或輪次，請聯絡專案管理員。</div>'}</section>`);
 document.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>{R.s.group=b.dataset.group;location.hash=`#project/${R.s.project.id}/${b.dataset.task}`});
};
})();