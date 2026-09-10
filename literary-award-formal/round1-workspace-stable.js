'use strict';
(function(){
const U='https://ppdrsoltvqiqnbnlimbb.supabase.co',K='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
if(!window.supabase?.createClient)return;
const sb=window.supabase.createClient(U,K,{auth:{persistSession:true,storage:sessionStorage,autoRefreshToken:true,detectSessionInUrl:true}});
let working=false,queued=false;
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),3200)}
function projectId(){return((location.hash||'').match(/^#project\/([^/]+)/)||[])[1]||''}
function enhance(){
  const root=document.getElementById('judgeWorkspace');
  if(!root||!root.querySelector('.jw-top .badge')?.textContent.includes('第一輪審查'))return;
  const control=root.querySelector('.jw-controls');if(!control)return;
  const desired='第一輪不打分數，也不限制入圍數量。請看完全部作品後，把你真正喜歡、認為值得入圍的作品選起來，再正式送出。';
  const note=[...control.querySelectorAll('.note')].find(x=>x.textContent.includes('第一輪不打分數'));
  if(note&&note.textContent!==desired)note.textContent=desired;
  const stats=[...control.querySelectorAll('.jw-statline b')];
  const readText=stats.find(x=>x.textContent.includes('本組閱讀'))?.textContent||'';
  const selectedEl=stats.find(x=>x.textContent.includes('已選'));
  const read=readText.match(/(\d+)\s*\/\s*(\d+)/),sel=(selectedEl?.textContent||'').match(/(\d+)/);
  if(!read||!sel)return;
  const viewed=Number(read[1]),total=Number(read[2]),selected=Number(sel[1]);
  const selectedText=`已選 ${selected} 份`;
  if(selectedEl&&selectedEl.textContent!==selectedText)selectedEl.textContent=selectedText;
  const yes=root.querySelector('[data-r1-yes]');if(yes&&yes.disabled)yes.disabled=false;
  const locked=control.textContent.includes('唯讀狀態')||control.textContent.includes('期限已於');
  const old=root.querySelector('[data-r1-submit]');
  if(old&&viewed===total){
    old.disabled=false;
    const txt=`正式送出本組第一輪結果（目前 ${selected} 份）`;
    if(old.textContent!==txt)old.textContent=txt;
    return;
  }
  if(viewed===total&&!locked&&!root.querySelector('[data-r1-submit-stable]')){
    const b=document.createElement('button');b.className='btn good jw-next';b.style.marginTop='12px';b.dataset.r1SubmitStable='1';b.textContent=`正式送出本組第一輪結果（目前 ${selected} 份）`;
    b.onclick=async()=>{if(working)return;const g=root.querySelector('.jw-meta .badge.purple')?.textContent.trim();if(!g)return toast('無法判斷目前組別');if(!confirm(`確定正式送出 ${g} 第一輪結果？目前選入 ${selected} 份，送出後不能再修改。`))return;working=true;const {error}=await sb.rpc('submit_round1_group',{p_project:projectId(),p_group:g});working=false;if(error)return toast(error.message);toast('第一輪結果已正式送出');setTimeout(()=>location.reload(),350)};
    control.querySelector('.muted.tiny')?.before(b);
  }
}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}
const ob=new MutationObserver(ms=>{if(ms.some(m=>m.target?.closest?.('#judgeWorkspace')||[...m.addedNodes].some(n=>n.nodeType===1&&(n.id==='judgeWorkspace'||n.querySelector?.('#judgeWorkspace')))))queue()});
ob.observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#judgeWorkspace'))setTimeout(queue,0)},true);
setTimeout(queue,450);
})();