'use strict';
(function(){
 function clean(){document.querySelectorAll('[data-nav="judging"]').forEach(b=>b.remove());const h=(location.hash||'');if(/#project\/[^/]+\/judging$/.test(h)){location.replace(location.href.replace(/\/judging$/,'/round2'));}}
 const ob=new MutationObserver(()=>{clearTimeout(window.__roundNavClean);window.__roundNavClean=setTimeout(clean,60)});ob.observe(document.body,{childList:true,subtree:true});addEventListener('hashchange',clean);setTimeout(clean,300);
})();