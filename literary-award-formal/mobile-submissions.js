'use strict';
(function(){
  const U='https://ppdrsoltvqiqnbnlimbb.supabase.co',K='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
  if(!window.supabase?.createClient)return;
  const sb=window.supabase.createClient(U,K,{auth:{persistSession:true,storage:sessionStorage,autoRefreshToken:true,detectSessionInUrl:true}});
  const isMobile=()=>matchMedia('(max-width:700px)').matches;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pid=()=>((location.hash||'').match(/^#project\/([^/]+)/)||[])[1]||'';
  let busy=false,lastKey='';
  async function enhance(){
    if(!isMobile()||busy)return;
    const section=[...document.querySelectorAll('.section')].find(s=>s.querySelector('h2')?.textContent.trim()==='作品管理');
    if(!section)return;
    const wrap=section.querySelector('.table-wrap'),table=wrap?.querySelector('table');if(!table)return;
    const p=pid();if(!p)return;busy=true;
    try{
      const {data,error}=await sb.from('submissions').select('id,anonymous_code,group_name,category,title,char_count,punctuation_count,period_count,status,exclusion_code,exclusion_reason,submission_private(student_name)').eq('project_id',p);
      if(error)return;
      const byCode=new Map((data||[]).map(x=>[x.anonymous_code,x]));
      const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());const ci=headers.indexOf('編號'),ai=headers.indexOf('操作');
      const rows=[...table.querySelectorAll('tbody tr')];const visibleCodes=rows.map(r=>(r.children[ci]?.textContent||'').trim()).filter(Boolean);
      const key=p+'|'+visibleCodes.join(',')+'|'+(data||[]).map(x=>x.updated_at||'').join(',');
      if(lastKey===key&&section.querySelector('.mobile-work-list'))return;lastKey=key;
      section.querySelector('.mobile-work-list')?.remove();
      const list=document.createElement('div');list.className='mobile-work-list';
      rows.forEach(tr=>{
        const code=(tr.children[ci]?.textContent||'').trim(),x=byCode.get(code);if(!x)return;
        const priv=Array.isArray(x.submission_private)?x.submission_private[0]:x.submission_private;
        const status=x.status==='excluded'?'剔除':x.status==='pending_review'?'待確認':'正式評分';
        const card=document.createElement('article');card.className='mobile-work-card';
        card.innerHTML=`<div class="mwc-head"><div><div class="mwc-name">${esc(priv?.student_name||'未填姓名')}</div><div class="mwc-code">${esc(x.anonymous_code)}</div></div><span class="badge ${x.status==='excluded'?'bad':x.status==='pending_review'?'warn':'good'}">${status}</span></div><div class="mwc-title">${esc(x.title||'未填作品名稱')}</div><div class="mwc-meta"><span>${esc(x.group_name||'—')}</span><span>${esc(x.category||'—')}</span></div><div class="mwc-stats"><div><b>${x.char_count??0}</b><small>文字字數</small></div><div><b>${x.punctuation_count??0}</b><small>標點符號</small></div><div><b>${x.period_count??0}</b><small>句號</small></div></div>${x.status==='excluded'?`<div class="mwc-reason"><b>${x.exclusion_code==='DUPLICATE_OLD'?'重複投稿－舊件':x.exclusion_code==='TEXT_LIMIT'?'文字字數超過':'剔除原因'}</b><div>${esc(x.exclusion_reason||'未填寫原因')}</div></div>`:''}<div class="mwc-actions"></div>`;
        const oldBtn=ai>=0?tr.children[ai]?.querySelector('button'):null;if(oldBtn){const b=oldBtn.cloneNode(true);b.onclick=()=>oldBtn.click();card.querySelector('.mwc-actions').appendChild(b)}
        list.appendChild(card);
      });
      wrap.style.display='none';wrap.after(list);
    }finally{busy=false}
  }
  const obs=new MutationObserver(()=>{clearTimeout(window.__mobileWorkTimer);window.__mobileWorkTimer=setTimeout(enhance,120)});obs.observe(document.body,{childList:true,subtree:true});
  addEventListener('hashchange',()=>{lastKey='';setTimeout(enhance,180)});setTimeout(enhance,400);
})();