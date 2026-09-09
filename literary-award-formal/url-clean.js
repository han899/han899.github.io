'use strict';
(function(){
  try{
    const u=new URL(location.href);
    const cleanParams=new URLSearchParams();
    const invite=u.searchParams.get('invite');
    if(invite) cleanParams.set('invite',invite);
    const search=cleanParams.toString();
    const clean=u.pathname+(search?'?'+search:'')+u.hash;
    const current=u.pathname+u.search+u.hash;
    if(clean!==current) history.replaceState(history.state,'',clean);
  }catch(e){}
})();