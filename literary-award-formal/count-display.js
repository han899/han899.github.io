'use strict';
(function(){
  const SUPABASE_URL='https://ppdrsoltvqiqnbnlimbb.supabase.co';
  const SUPABASE_KEY='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
  if(!window.supabase?.createClient)return;
  const sbCount=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,storage:window.sessionStorage,autoRefreshToken:true,detectSessionInUrl:true}});
  let cacheProject='',cache=new Map(),loading=false,running=false;
  const projectId=()=>{const m=(location.hash||'').match(/^#project\/([^/]+)/);return m?m[1]:''};
  const onSubmissions=()=>/\/submissions$/.test(location.hash||'');
  async function loadCounts(){
    const pid=projectId();if(!pid)return;
    if(cacheProject===pid&&cache.size)return;
    if(loading)return;loading=true;
    try{
      const {data,error}=await sbCount.from('submissions').select('anonymous_code,char_count,punctuation_count,period_count').eq('project_id',pid);
      if(!error){cacheProject=pid;cache=new Map((data||[]).map(x=>[x.anonymous_code,x]));}
    }finally{loading=false}
  }
  async function enhance(){
    if(running||!onSubmissions())return;running=true;
    try{
      await loadCounts();
      const section=[...document.querySelectorAll('.section')].find(s=>s.querySelector('h2')?.textContent.trim()==='作品管理');
      if(section){
        const table=section.querySelector('table');
        if(table){
          const ths=[...table.querySelectorAll('thead th')];
          const idx=ths.findIndex(th=>['字數','文字字數'].includes(th.textContent.trim()));
          if(idx>=0){
            if(ths[idx].textContent.trim()!=='文字字數')ths[idx].textContent='文字字數';
            if(![...table.querySelectorAll('thead th')].some(th=>th.textContent.trim()==='標點符號')){
              const p=document.createElement('th');p.textContent='標點符號';ths[idx].after(p);
              const q=document.createElement('th');q.textContent='句號';p.after(q);
            }
            [...table.querySelectorAll('tbody tr')].forEach(tr=>{
              const cells=[...tr.children],code=cells[0]?.textContent.trim(),c=cache.get(code);if(!c)return;
              const current=[...tr.children],textCell=current[idx];
              if(textCell&&textCell.textContent!==String(c.char_count??0))textCell.textContent=String(c.char_count??0);
              if(!tr.querySelector('[data-punctuation-count]')){
                const pc=document.createElement('td');pc.dataset.punctuationCount='1';pc.textContent=String(c.punctuation_count??0);textCell.after(pc);
                const period=document.createElement('td');period.dataset.periodCount='1';period.textContent=String(c.period_count??0);pc.after(period);
              }
            });
          }
        }
      }
      const modal=document.getElementById('modal');
      if(modal){
        const paras=[...modal.querySelectorAll('p')],codeText=paras[0]?.textContent||'',code=[...cache.keys()].find(k=>codeText.includes(k)),c=cache.get(code),stat=paras.find(p=>/^字數：|^文字字數：/.test(p.textContent.trim()));
        const next=c?`文字字數：${c.char_count??0}｜標點符號：${c.punctuation_count??0}｜句號：${c.period_count??0}`:'';
        if(c&&stat&&stat.textContent!==next)stat.textContent=next;
      }
    }finally{running=false}
  }
  const obs=new MutationObserver(()=>{if(!onSubmissions())return;clearTimeout(window.__countEnhanceTimer);window.__countEnhanceTimer=setTimeout(enhance,80)});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>{cache=new Map();cacheProject='';setTimeout(enhance,120)});
  setTimeout(enhance,250);
})();
