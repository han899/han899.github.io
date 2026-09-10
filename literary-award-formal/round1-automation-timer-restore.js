'use strict';
(function(){
  if(window.__nativeRound1SetInterval){
    window.setInterval=window.__nativeRound1SetInterval;
    delete window.__nativeRound1SetInterval;
  }
})();