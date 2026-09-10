'use strict';
(function(){
 const Native=window.MutationObserver;if(!Native)return;window.__nativeReviewMutationObserver=Native;
 window.MutationObserver=class extends Native{constructor(cb){super((mutations,obs)=>{const relevant=mutations.filter(m=>{const el=m.target?.nodeType===1?m.target:m.target?.parentElement;return !(el?.closest?.('.nav,.mobile-nav'))});if(relevant.length)cb(relevant,obs)})}};
})();