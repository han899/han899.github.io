'use strict';
(function(){
 const U='https://ppdrsoltvqiqnbnlimbb.supabase.co',K='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
 if(!window.supabase?.createClient)return;
 const sb=window.supabase.createClient(U,K,{auth:{persistSession:true,storage:sessionStorage,autoRefreshToken:true,detectSessionInUrl:true}});
 let pid='',map=new Map(),busy=false;
 const project=()=>((location.hash||'').match(/^#project\/([^/]+)/)||[])[1]||'';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function load(force=false){const p=project();if(!p||busy)return;if(!force&&p===pid&&map.size)return;busy=true;try{const {data,error}=await sb.from('submissions').select('anonymous_code,status,exclusion_code,exclusion_reason,exclusion_details').eq('project_id',p);if(!error){pid=p;map=new Map((data||[]).map(x=>[x.anonymous_code,x]));}}finally{busy=false}}
 function reasonHTML(x){if(!x||x.status!=='excluded')return '—';const title=x.exclusion_code==='DUPLICATE_OLD'?'重複投稿－舊件':x.exclusion_code==='TEXT_LIMIT'?'文字字數超過':'剔除';return `<div class="exclusion-cell"><b>${esc(title)}</b><div>${esc(x.exclusion_reason||'未填寫原因')}</div></div>`}
 async function enhance(){await load();const sec=[...document.querySelectorAll('.section')].find(s=>s.querySelector('h2')?.textContent.trim()==='作品管理');if(!sec)return;const t=sec.querySelector('table');if(!t)return;
   const hs=[...t.querySelectorAll('thead th')];let ri=hs.findIndex(h=>h.textContent.trim()==='剔除原因');const ai=hs.findIndex(h=>h.textContent.trim()==='操作');
   if(ri<0){const h=document.createElement('th');h.textContent='剔除原因';h.dataset.exclusionHeader='1';if(ai>=0)hs[ai].before(h);else t.querySelector('thead tr').appendChild(h);ri=[...t.querySelectorAll('thead th')].findIndex(h=>h.textContent.trim()==='剔除原因');}
   [...t.querySelectorAll('tbody tr')].forEach(tr=>{const headers=[...t.querySelectorAll('thead th')].map(h=>h.textContent.trim());const codeIndex=headers.indexOf('編號');const reasonIndex=headers.indexOf('剔除原因');const cells=[...tr.children];const code=(cells[codeIndex]?.textContent||'').trim();let td=tr.querySelector('[data-exclusion-reason]');if(!td){td=document.createElement('td');td.dataset.exclusionReason='1';const actionIndex=headers.indexOf('操作');const actionCell=actionIndex>=0?tr.children[actionIndex-1]:null;if(actionCell)actionCell.before(td);else tr.appendChild(td);}td.innerHTML=reasonHTML(map.get(code));});
   t.classList.add('has-exclusion-column');
 }
 const o=new MutationObserver(()=>{clearTimeout(window.__exTimer);window.__exTimer=setTimeout(enhance,80)});o.observe(document.documentElement,{childList:true,subtree:true});
 addEventListener('hashchange',()=>{pid='';map=new Map();setTimeout(()=>load(true).then(enhance),120)});setTimeout(enhance,300);setInterval(()=>{if((location.hash||'').includes('/submissions'))enhance()},1500);
})();