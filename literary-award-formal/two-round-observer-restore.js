'use strict';
(function(){
  if(window.__twoRoundNativeMO){
    window.MutationObserver=window.__twoRoundNativeMO;
    try{delete window.__twoRoundNativeMO}catch(e){window.__twoRoundNativeMO=null}
  }
})();