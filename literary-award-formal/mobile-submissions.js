'use strict';
(function(){
  const isMobile=()=>window.matchMedia('(max-width:700px)').matches;
  function enhance(){
    if(!isMobile())return;
    const section=[...document.querySelectorAll('.section')].find(s=>s.querySelector('h2')?.textContent.trim()==='作品管理');
    if(!section)return;
    const wrap=section.querySelector('.table-wrap');
    const table=wrap?.querySelector('table');
    if(!table||section.querySelector('.mobile-work-list'))return;
    const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
    const idx=n=>headers.findIndex(h=>h===n);
    const indexes={code:idx('編號'),name:idx('姓名'),group:idx('組別'),cat:idx('類別'),title:idx('作品'),text:idx('文字字數')>=0?idx('文字字數'):idx('字數'),punct:idx('標點符號'),period:idx('句號'),status:idx('狀態'),reason:idx('剔除原因'),action:idx('操作')};
    const list=document.createElement('div');list.className='mobile-work-list';
    [...table.querySelectorAll('tbody tr')].forEach(tr=>{
      const c=[...tr.children];
      const text=i=>i>=0?(c[i]?.textContent||'').trim():'';
      const status=text(indexes.status);
      const reason=text(indexes.reason);
      const card=document.createElement('article');card.className='mobile-work-card';
      card.innerHTML=`<div class="mwc-head"><div><div class="mwc-name">${esc(text(indexes.name)||'未填姓名')}</div><div class="mwc-code">${esc(text(indexes.code))}</div></div><span class="badge ${status==='剔除'?'bad':status==='待確認'?'warn':'good'}">${esc(status||'—')}</span></div><div class="mwc-title">${esc(text(indexes.title)||'未填作品名稱')}</div><div class="mwc-meta"><span>${esc(text(indexes.group)||'—')}</span><span>${esc(text(indexes.cat)||'—')}</span></div><div class="mwc-stats"><div><b>${esc(text(indexes.text)||'0')}</b><small>文字字數</small></div><div><b>${esc(text(indexes.punct)||'0')}</b><small>標點符號</small></div><div><b>${esc(text(indexes.period)||'0')}</b><small>句號</small></div></div>${status==='剔除'?`<div class="mwc-reason"><b>剔除原因</b><div>${esc(reason||'未填寫原因')}</div></div>`:''}<div class="mwc-actions"></div>`;
      const oldBtn=indexes.action>=0?c[indexes.action]?.querySelector('button'):null;
      if(oldBtn){const b=oldBtn.cloneNode(true);b.onclick=()=>oldBtn.click();card.querySelector('.mwc-actions').appendChild(b)}
      list.appendChild(card);
    });
    wrap.style.display='none';wrap.after(list);
  }
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const obs=new MutationObserver(()=>{clearTimeout(window.__mobileWorkTimer);window.__mobileWorkTimer=setTimeout(enhance,80)});obs.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('resize',()=>location.reload());addEventListener('hashchange',()=>setTimeout(enhance,120));setTimeout(enhance,350);
})();