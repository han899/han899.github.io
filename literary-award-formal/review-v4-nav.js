'use strict';
(function(){
const R=window.RF4;if(!R)return;
const GROUPS=['小學組','國中組','高中職組'];
let signature='';
function ensureRoot(){
 let root=document.getElementById('rf4GlobalNav');
 if(!root){root=document.createElement('div');root.id='rf4GlobalNav';root.className='rf4-global-nav';root.setAttribute('aria-label','競賽功能導覽');root.innerHTML='<div class="rf4-global-nav-loading">載入功能選單…</div>';document.body.appendChild(root)}
 document.body.classList.add('rf4-global-nav-active');
 return root;
}
function routeTo(page,group=''){
 const pid=R.s.project?.id||R.route()?.pid;if(!pid)return;
 const suffix=group?`/${encodeURIComponent(group)}`:'';
 location.hash=page==='overview'?`#project/${pid}`:`#project/${pid}/${page}${suffix}`;
}
function btn(page,label,group='',sub=''){
 return `<button type="button" class="rf4-global-nav-btn" data-rf4-nav-page="${R.esc(page)}" data-rf4-nav-group="${R.esc(group)}"><span>${R.esc(label)}</span>${sub?`<small>${R.esc(sub)}</small>`:''}</button>`;
}
function generalItems(role){
 const admin=['platform_admin','project_admin'].includes(role),staff=role==='staff';
 let h='<div class="rf4-nav-section"><div class="rf4-nav-section-title">專案</div>';
 h+=btn('overview','專案總覽');
 if(admin||staff)h+=btn('import','作品匯入')+btn('submissions','作品管理');
 if(admin)h+=btn('people','成員與權限');
 h+='</div>';
 return h;
}
function adminReview(){
 return `<div class="rf4-nav-section rf4-review-map"><div class="rf4-nav-section-title">評審流程</div>${GROUPS.map(g=>`<div class="rf4-nav-group"><div class="rf4-nav-group-title">${R.esc(g)}</div>${btn('round1admin','第一輪結果',g,'初選票數與晉級')}${btn('results','第二輪成績',g,'評分、排名與確認')}</div>`).join('')}</div>`;
}
function judgeReview(assignments){
 const byGroup=new Map(assignments.map(a=>[a.group_name,a]));
 const rows=GROUPS.filter(g=>byGroup.has(g)).map(g=>{const a=byGroup.get(g),parts=[];if(a.round1_enabled)parts.push(btn('round1','第一輪｜入圍初選',g,'快速審查'));if(a.round2_enabled)parts.push(btn('round2','第二輪｜正式評分',g,'快速評分'));return`<div class="rf4-nav-group"><div class="rf4-nav-group-title">${R.esc(g)}</div>${parts.join('')}</div>`}).join('');
 return `<div class="rf4-nav-section rf4-review-map"><div class="rf4-nav-section-title">我的評審任務</div>${rows||'<div class="rf4-nav-empty">目前沒有被指派的評審任務</div>'}</div>`;
}
function adminTail(){return `<div class="rf4-nav-section"><div class="rf4-nav-section-title">結果與系統</div>${btn('awards','得獎名單')}${btn('settings','專案設定')}${btn('audit','操作紀錄')}</div>`}
function render(role,assignments){
 const root=ensureRoot();
 let html='<div class="rf4-global-nav-inner">';
 html+=generalItems(role);
 if(role==='judge')html+=judgeReview(assignments);
 else if(['platform_admin','project_admin'].includes(role))html+=adminReview()+adminTail();
 html+='</div>';
 root.innerHTML=html;
 root.querySelectorAll('[data-rf4-nav-page]').forEach(b=>b.onclick=()=>routeTo(b.dataset.rf4NavPage,b.dataset.rf4NavGroup||''));
 markActive();
}
function markActive(){
 const root=document.getElementById('rf4GlobalNav');if(!root)return;
 const r=R.route(),page=r?.page||'overview',group=r?.group||R.s.group||'';
 root.querySelectorAll('[data-rf4-nav-page]').forEach(b=>{
  const bp=b.dataset.rf4NavPage,bg=b.dataset.rf4NavGroup||'';
  const active=bp===page&&(!bg||bg===group);
  b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');
 });
}
async function sync(){
 const r=R.route();if(!r||!R.s.project){hide();return}
 const role=R.s.role||'';
 const assignments=role==='judge'?await R.assignments():[];
 const sig=JSON.stringify({pid:R.s.project.id,role,assignments:assignments.map(a=>[a.group_name,!!a.round1_enabled,!!a.round2_enabled])});
 if(sig!==signature){signature=sig;render(role,assignments)}else{ensureRoot();markActive()}
}
function hide(){const root=document.getElementById('rf4GlobalNav');if(root)root.hidden=true;document.body.classList.remove('rf4-global-nav-active')}
function show(){const root=ensureRoot();root.hidden=false}
window.RF4StableNav={sync,markActive,hide,show};
ensureRoot();
addEventListener('hashchange',()=>requestAnimationFrame(()=>{const r=R.route();if(!r)return hide();show();markActive()}));
})();
