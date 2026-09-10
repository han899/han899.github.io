'use strict';
(function(){
  const Native=window.setInterval;
  if(!Native)return;
  window.__nativeRound1SetInterval=Native;
  window.setInterval=function(fn,delay,...args){
    if(Number(delay)===3000)return 0;
    return Native(fn,delay,...args);
  };
})();