'use strict';
(function(){
  const app=document.getElementById('app');
  const sources=[
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js'
  ];
  function show(message,detail=''){
    if(!app)return;
    app.innerHTML=`<main class="login"><div class="login-card"><div class="badge">系統啟動檢查</div><h1>${message}</h1>${detail?`<p class="muted">${detail}</p>`:''}<button class="btn primary" id="retryBoot" style="width:100%;margin-top:16px">重新載入</button></div></main>`;
    const b=document.getElementById('retryBoot');if(b)b.onclick=()=>location.reload();
  }
  function load(src,timeout=12000){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      let done=false;
      const timer=setTimeout(()=>{if(done)return;done=true;s.remove();reject(new Error('載入逾時'))},timeout);
      s.src=src;s.async=true;s.crossOrigin='anonymous';
      s.onload=()=>{if(done)return;done=true;clearTimeout(timer);resolve()};
      s.onerror=()=>{if(done)return;done=true;clearTimeout(timer);s.remove();reject(new Error('載入失敗'))};
      document.head.appendChild(s);
    });
  }
  async function loadLocal(src){
    await load(src,12000);
  }
  async function start(){
    let ok=false;
    for(const src of sources){
      try{
        await load(src);
        if(window.supabase&&typeof window.supabase.createClient==='function'){ok=true;break}
      }catch(e){}
    }
    if(!ok){show('系統元件載入失敗','請確認網路連線後重新載入；若仍無法開啟，系統會由管理端檢查 CDN 連線。');return}
    try{
      await loadLocal('./security-adapter.js?v=20260908b');
      await loadLocal('./app.js?v=20260908b');
      setTimeout(()=>{
        const t=(app?.textContent||'').trim();
        if(t==='系統載入中…'||t==='系統載入中...')show('系統啟動逾時','後端連線未能在預期時間內完成，請重新載入。');
      },15000);
    }catch(e){
      console.error(e);
      show('系統程式載入失敗','請重新載入；若問題持續，請回報此畫面。');
    }
  }
  start();
})();