'use strict';
(function(){
  const app=document.getElementById('app');
  const sources=[
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js'
  ];
  function show(message,detail=''){
    if(!app)return;
    app.innerHTML=`<main class="login"><div class="login-card"><div class="badge">系統啟動檢查</div><h1>${message}</h1>${detail?`<p class="muted">${detail}</p>`:''}<button class="btn primary" id="retryBoot" style="width:100%;margin-top:16px">重新載入</button><a class="btn" href="./" style="display:block;text-align:center;margin-top:10px">返回登入頁</a></div></main>`;
    const b=document.getElementById('retryBoot');if(b)b.onclick=()=>location.reload();
  }
  function load(src,timeout=12000){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');let done=false;
      const timer=setTimeout(()=>{if(done)return;done=true;s.remove();reject(new Error('載入逾時'))},timeout);
      s.src=src;s.async=true;s.crossOrigin='anonymous';
      s.onload=()=>{if(done)return;done=true;clearTimeout(timer);resolve()};
      s.onerror=()=>{if(done)return;done=true;clearTimeout(timer);s.remove();reject(new Error('載入失敗'))};
      document.head.appendChild(s);
    });
  }
  async function start(){
    let ok=false;
    for(const src of sources){try{await load(src);if(window.supabase&&typeof window.supabase.createClient==='function'){ok=true;break}}catch(e){}}
    if(!ok){show('系統元件載入失敗','兩個備援來源皆無法載入，請確認網路後重新載入。');return}
    try{
      await load('./security-adapter.js?v=20260908c');
      await load('./app.js?v=20260908c');
      setTimeout(()=>{
        const t=(app?.textContent||'').trim();
        if(t.includes('載入中'))show('管理後台啟動逾時','後台程式沒有完成啟動。請返回登入頁或重新載入。');
      },12000);
    }catch(e){console.error(e);show('管理後台程式載入失敗','請重新載入；若問題持續，系統管理端可依此錯誤繼續檢查。')}
  }
  start();
})();