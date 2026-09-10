'use strict';
(function(){
  if(!window.MutationObserver||window.__twoRoundNativeMO)return;
  const NativeMO=window.MutationObserver;
  window.__twoRoundNativeMO=NativeMO;
  function page(){
    const p=(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);
    return p[0]==='project'&&p[1]?(p[2]||'overview'):'';
  }
  function alreadyMounted(){
    const m=document.querySelector('.main');
    if(!m)return false;
    const p=page();
    if(p==='people')return !!m.querySelector('#invite2');
    const h=[...m.querySelectorAll('h2')].map(x=>x.textContent.trim());
    if(p==='round1')return h.includes('第一輪審查');
    if(p==='round1admin')return h.includes('第一輪結果與第二輪入選');
    if(p==='round2')return h.includes('第二輪評分');
    if(p==='results')return h.includes('第二輪成績與排名');
    return false;
  }
  window.MutationObserver=class extends NativeMO{
    constructor(callback){
      super((records,observer)=>{
        if(alreadyMounted())return;
        callback(records,observer);
      });
    }
  };
})();