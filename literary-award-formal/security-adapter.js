'use strict';
(function(){
  const originalCreate=window.supabase.createClient.bind(window.supabase);
  window.supabase.createClient=function(url,key,options){
    const client=originalCreate(url,key,options);
    const originalRpc=client.rpc.bind(client);
    client.rpc=async function(fn,args,opts){
      if(fn==='claim_initial_platform_admin' || fn==='accept_project_invitation'){
        const {data:{session}}=await client.auth.getSession();
        if(!session)return {data:null,error:{message:'尚未登入。'}};
        const endpoint=fn==='claim_initial_platform_admin'?'claim-platform-admin':'accept-project-invitation';
        const body=fn==='claim_initial_platform_admin'?{secret_hash:args?.p_secret_hash||'',display_name:args?.p_display_name||''}:{token:args?.p_token||''};
        try{
          const res=await window.fetch(`${url}/functions/v1/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':key},body:JSON.stringify(body)});
          const out=await res.json().catch(()=>({error:'後端回應格式錯誤。'}));
          if(!res.ok)return {data:null,error:{message:out.error||'操作失敗。'}};
          return {data:fn==='accept_project_invitation'?out.project_id:true,error:null};
        }catch(e){return {data:null,error:{message:'無法連線至安全後端。'}}}
      }
      return originalRpc(fn,args,opts);
    };
    return client;
  };
  const originalFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    let target=input;
    if(typeof input==='string'&&input.includes('/functions/v1/import-competition')&&!input.includes('import-competition-cors'))target=input.replace('/functions/v1/import-competition','/functions/v1/import-competition-cors');
    return originalFetch(target,init);
  };
})();
