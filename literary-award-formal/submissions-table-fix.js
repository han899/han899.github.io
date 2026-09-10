'use strict';
(function(){
 const U='https://ppdrsoltvqiqnbnlimbb.supabase.co',K='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
 if(!window.supabase?.createClient)return;
 const sb=window.supabase.createClient(U,K,{auth:{persistSession:true,storage:sessionStorage,autoRefreshToken:true,detectSessionInUrl:true}});
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pid=()=>((location.hash||'').match(/^#project\/([^/]+)/)||[])[1]||'';
 const onSubmissions=()=>/\/submissions$/.test(location.hash||'');
 let cacheProject='',cache=new Map(),loading=false,running=false;
 async function getData(){const p=pid();if(!p)return new Map();if(cacheProject===p&&cache.size)return cache;if(loading)return cache;loading=true;try{const {data,error}=await sb.from('submissions').select('anonymous_code,status,exclusion_code,exclusion_reason,superseded_by').eq('project_id',p);if(!error){cacheProject=p;cache=new Map((data||[]).map(x=>[String(x.anonymous_code||'').trim(),x]));}}finally{loading=false}return cache}
 async function fix(){
   if(running||!onSubmissions())return;running=true;
   try{
     const sec=[...document.querySelectorAll('.section')].find(s=>s.querySelector('h2')?.textContent.trim()==='作品管理');if(!sec)return;
     const table=sec.querySelector('.table-wrap table');if(!table)return;
     const map=await getData();
     let heads=[...table.querySelectorAll('thead th')],statusIndex=heads.findIndex(h=>h.textContent.trim()==='狀態');if(statusIndex<0)return;
     let reasonIndex=heads.findIndex(h=>h.textContent.trim()==='剔除原因');
     if(reasonIndex<0){const th=document.createElement('th');th.textContent='剔除原因';th.setAttribute('data-core-exclusion','1');heads[statusIndex].after(th);}
     heads=[...table.querySelectorAll('thead th')];
     const codeIndex=heads.findIndex(h=>h.textContent.trim()==='編號'),stIndex=heads.findIndex(h=>h.textContent.trim()==='狀態'),rsIndex=heads.findIndex(h=>h.textContent.trim()==='剔除原因');
     [...table.querySelectorAll('tbody tr')].forEach(tr=>{
       let cells=[...tr.children];const code=(cells[codeIndex]?.textContent||'').trim(),x=map.get(code);
       if(cells.length<heads.length){const td=document.createElement('td');td.setAttribute('data-core-exclusion','1');cells[stIndex]?.after(td);cells=[...tr.children];}
       const td=cells[rsIndex];if(!td)return;
       if(x?.status==='excluded'){
         const type=x.exclusion_code==='DUPLICATE_OLD'?'重複投稿－舊件':x.exclusion_code==='TEXT_LIMIT'?'文字字數超過':'剔除';
         const html=`<div style="min-width:220px;max-width:360px;white-space:normal;line-height:1.45"><b>${type}</b><br><span>${esc(x.exclusion_reason||'未填寫原因')}</span></div>`;
         if(td.innerHTML!==html)td.innerHTML=html;
       }else if(td.textContent!=='—')td.textContent='—';
     });
   }finally{running=false}
 }
 const obs=new MutationObserver(()=>{if(!onSubmissions())return;clearTimeout(window.__coreReasonTimer);window.__coreReasonTimer=setTimeout(fix,100)});obs.observe(document.body,{childList:true,subtree:true});
 addEventListener('hashchange',()=>{cacheProject='';cache=new Map();setTimeout(fix,160)});
 setTimeout(fix,350);
})();