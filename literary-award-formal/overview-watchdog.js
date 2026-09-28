'use strict';
(function(){
const isOverview=()=>{const p=(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);return p[0]==='project'&&!!p[1]&&!p[2]};
const projectId=()=>{const p=(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);return p[0]==='project'?p[1]||'':''};
let timer=0,running=false;
async function rescue(){
 if(running||!isOverview())return;
 const loading=document.querySelector('.rf-overview-loading');if(!loading)return;
 running=true;
 const R=window.RF4,pid=projectId();
 try{
   if(!R?.overviewPage)throw new Error('新版總覽模組沒有載入完成');
   if(!R.s?.project||R.s.project.id!==pid){
     const ok=await R.context(pid);
     if(!ok)throw new Error('無法取得目前專案與帳號權限');
   }
   await R.overviewPage();
   window.RF4StableNav?.sync?.();
 }catch(e){
   console.error('overview watchdog rescue failed',e);
   const main=document.querySelector('.main');
   if(main&&document.querySelector('.rf-overview-loading')){
     main.innerHTML='<section class="section"><div class="danger-note"><b>專案總覽載入失敗</b><br>'+String(e?.message||e).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</div><div class="rf4-actions"><button class="btn primary" id="rfOverviewWatchRetry">重新載入總覽</button><button class="btn" id="rfOverviewFullReload">重新整理整個後台</button></div></section>';
     document.getElementById('rfOverviewWatchRetry')?.addEventListener('click',()=>{running=false;schedule(0)});
     document.getElementById('rfOverviewFullReload')?.addEventListener('click',()=>location.reload());
   }
 }finally{running=false}
}
function schedule(ms=4000){clearTimeout(timer);if(isOverview())timer=setTimeout(rescue,ms)}
addEventListener('hashchange',()=>schedule(4000));
schedule(4000);
})();