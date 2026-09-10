'use strict';
(function(){
  function routePage(){const p=(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);return p[2]||''}
  function hideRowFor(el){const row=el?.closest('.row');if(row)row.style.display='none'}
  function wire(form,edit=false){if(!form||form.dataset.singleRound==='1')return;form.dataset.singleRound='1';
    const r1=form.elements.r1,r2=form.elements.r2,role=form.elements.role;if(!r1||!r2||!role)return;
    hideRowFor(r1);
    const labels=[...form.querySelectorAll('.label')];const roundLabel=labels.find(x=>x.textContent.trim()==='審查輪次'||x.textContent.trim()==='輪次');
    const wrap=document.createElement('div');wrap.className='single-round-picker';wrap.innerHTML='<label class="label">指定審查輪次</label><select class="select" data-round-choice required><option value="">請選擇</option><option value="1">第一輪審查</option><option value="2">第二輪評分</option></select><p class="muted tiny">每位評審一次只指定一個審查輪次；需要更換時可由管理員編輯。</p>';
    (roundLabel||r1.closest('.row'))?.before(wrap);if(roundLabel)roundLabel.style.display='none';
    const sel=wrap.querySelector('[data-round-choice]');
    if(r1.checked&&!r2.checked)sel.value='1';else if(r2.checked&&!r1.checked)sel.value='2';else if(!edit){sel.value='1';r1.checked=true;r2.checked=false}
    const d1=form.elements.d1,d2=form.elements.d2;const block1=d1?.closest('.split')||d1?.parentElement, block2=d2?.closest('.split')||d2?.parentElement;
    function sync(){const judge=role.value==='judge',v=sel.value;if(judge){r1.checked=v==='1';r2.checked=v==='2'}else{r1.checked=false;r2.checked=false}wrap.style.display=judge?'block':'none';if(d1){d1.disabled=!judge||v!=='1';d1.closest('div').style.display=judge&&v==='1'?'block':'none'}if(d2){d2.disabled=!judge||v!=='2';d2.closest('div').style.display=judge&&v==='2'?'block':'none'};const sp=d1?.closest('.split');if(sp)sp.style.gridTemplateColumns='1fr'}
    sel.addEventListener('change',sync);role.addEventListener('change',()=>{if(role.value==='judge'&&!sel.value)sel.value='1';sync()});sync();
    form.addEventListener('submit',e=>{if(role.value==='judge'&&!sel.value){e.preventDefault();e.stopImmediatePropagation();sel.focus();sel.reportValidity()}},true);
  }
  function enhance(){if(routePage()!=='people')return;wire(document.getElementById('invite2'),false);wire(document.getElementById('em2'),true)}
  addEventListener('hashchange',()=>setTimeout(enhance,200));setInterval(enhance,350);setTimeout(enhance,300);
})();