'use strict';
(function(){
 const U='https://ppdrsoltvqiqnbnlimbb.supabase.co',K='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
 if(!window.supabase?.createClient)return;
 const sb=window.supabase.createClient(U,K,{auth:{persistSession:true,storage:sessionStorage,autoRefreshToken:true,detectSessionInUrl:true}});
 let pid='',map=new Map(),busy=false;
 const project=()=>((location.hash||'').match(/^#project\/([^/]+)/)||[])[1]||'';
 async function load(){const p=project();if(!p||busy)return;if(p===pid&&map.size)return;busy=true;try{const {data,error}=await sb.from('submissions').select('anonymous_code,status,exclusion_code,exclusion_reason,exclusion_details,superseded_by').eq('project_id',p);if(!error){pid=p;map=new Map((data||[]).map(x=>[x.anonymous_code,x]));}}finally{busy=false}}
 async function enhance(){await load();const sec=[...document.querySelectorAll('.section')].find(s=>s.querySelector('h2')?.textContent.trim()==='作品管理');if(!sec)return;const t=sec.querySelector('table');if(!t)return;const hs=[...t.querySelectorAll('thead th')];const si=hs.findIndex(h=>h.textContent.trim()==='狀態');if(si<0)return;if(!hs.some(h=>h.textContent.trim()==='剔除原因')){const h=document.createElement('th');h.textContent='剔除原因';hs[si].after(h)}
 [...t.querySelectorAll('tbody tr')].forEach(tr=>{if(tr.querySelector('[data-exclusion-reason]'))return;const cs=[...tr.children],code=cs[0]?.textContent.trim(),x=map.get(code),statusCell=cs[si];if(!statusCell)return;const td=document.createElement('td');td.dataset.exclusionReason='1';if(x?.status==='excluded'){td.innerHTML='<div style="min-width:230px;white-space:normal;line-height:1.55"><b>'+(x.exclusion_code==='DUPLICATE_OLD'?'重複投稿－舊件':x.exclusion_code==='TEXT_LIMIT'?'文字字數超過':'剔除')+'</b><br><span style="font-size:.88em">'+escapeHtml(x.exclusion_reason||'未填寫原因')+'</span></div>'}else td.textContent='—';statusCell.after(td)});
 }
 const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const o=new MutationObserver(()=>{clearTimeout(window.__exTimer);window.__exTimer=setTimeout(enhance,60)});o.observe(document.documentElement,{childList:true,subtree:true});
 addEventListener('hashchange',()=>{pid='';map=new Map();setTimeout(enhance,100)});setTimeout(enhance,250);
})();