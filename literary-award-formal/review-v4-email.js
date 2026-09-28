'use strict';
(function(){
const R=window.RF4;if(!R)return;const {sb,s}=R;
const APIKEY='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
const ENDPOINT='https://ppdrsoltvqiqnbnlimbb.supabase.co/functions/v1/send-project-email';
let recipients=[],service={configured:false},integration=null,scheduledJobs=[];

const isSystemAdmin=()=>s.profile?.platform_role==='platform_admin'||s.role==='platform_admin';
const v=id=>document.getElementById(id)?.value||'';
const escCsv=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
const fmtStatus=x=>({draft:'Gmail 草稿',drafted:'已建立草稿',scheduled:'已排程',sending:'寄送中',completed:'已寄出',partial:'部分完成',failed:'失敗',test:'測試',cancelled:'已取消'}[x]||x||'—');
const hexSecret=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');

async function getIntegration(){
 const {data,error}=await sb.rpc('get_gmail_integration_status',{p_project:s.project.id});
 if(error)return null;
 return Array.isArray(data)?(data[0]||null):data;
}
async function serviceStatus(){
 try{
  const {data:{session}}=await sb.auth.getSession();
  const r=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify({action:'status',project_id:s.project.id})});
  const out=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(out.error||'Gmail 狀態讀取失敗');
  service=out;return out;
 }catch(e){service={configured:false,error:e.message};return service}
}
async function callProvider(payload){
 const {data:{session}}=await sb.auth.getSession();
 const r=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify({...payload,project_id:s.project.id})});
 const out=await r.json().catch(()=>({}));if(!r.ok)throw new Error(out.error||'Gmail 操作失敗');return out;
}
function varsFor(x){return{
 name:x.recipient_name||'',student_name:x.recipient_name||'',group_name:x.group_name||'',title:x.title||'',
 final_position:x.final_position||'',award_name:x.award_name||'',anonymous_code:x.anonymous_code||''
}}
function selected(){return [...document.querySelectorAll('[data-mail-recipient]:checked')].map(x=>recipients[Number(x.dataset.mailRecipient)]).filter(Boolean)}

async function saveGmailIntegration(){
 const url=v('rfGmailWebApp').trim(),secret=v('rfGmailSecret').trim(),msg=document.getElementById('rfGmailSetupMsg'),btn=document.getElementById('rfGmailSave');
 if(!url||!secret){msg.innerHTML='<div class="danger-note">請填入 Apps Script Web App 網址與同一組連線密鑰。</div>';return}
 btn.disabled=true;btn.textContent='儲存並測試中…';
 const {error}=await sb.rpc('set_gmail_integration',{p_project:s.project.id,p_web_app_url:url,p_shared_secret:secret});
 if(error){msg.innerHTML='<div class="danger-note">'+R.esc(error.message)+'</div>';btn.disabled=false;btn.textContent='儲存並測試連線';return}
 const st=await serviceStatus();
 if(st.configured){
   msg.innerHTML='<div class="rf4-banner good"><b>Gmail 連線成功</b><br>'+R.esc(st.gmail_address||'已授權 Gmail')+'｜今日剩餘寄送額度 '+R.esc(st.remaining_daily_quota??'—')+'</div>';
   setTimeout(()=>R.pages.emailCenter(),700);
 }else{
   msg.innerHTML='<div class="danger-note"><b>設定已保存，但 Gmail 測試尚未成功。</b><br>'+R.esc(st.error||'請確認 Apps Script 部署、權限與連線密鑰。')+'</div>';
   btn.disabled=false;btn.textContent='儲存並測試連線';
 }
}
async function disconnectGmail(){
 if(!confirm('確定解除這個專案的 Gmail 串接嗎？\n\n已建立在 Gmail 裡的草稿與已送出的郵件不會被刪除。'))return;
 const {error}=await sb.rpc('clear_gmail_integration',{p_project:s.project.id});
 if(error)return R.toast(error.message);R.toast('Gmail 串接已解除');await R.pages.emailCenter();
}
async function copyBridge(){
 try{
  const r=await fetch('./gmail-appscript-bridge.gs?v=20260928a',{cache:'no-store'});const t=await r.text();
  await navigator.clipboard.writeText(t);R.toast('Apps Script 程式碼已複製');
 }catch(e){R.toast('無法自動複製，請使用「下載 Apps Script 程式碼」')}
}
function genSecret(){
 const x=document.getElementById('rfGmailSecret');x.value=hexSecret();x.focus();x.select();
 navigator.clipboard?.writeText(x.value).then(()=>R.toast('已產生並複製連線密鑰')).catch(()=>R.toast('已產生連線密鑰'));
}

async function previewRecipients(){
 const btn=document.getElementById('rfMailPreviewBtn');btn.disabled=true;btn.textContent='載入中…';
 const audience=v('rfMailAudience'),group=v('rfMailGroup')||null,contact=v('rfMailContact');
 const {data,error}=await sb.rpc('get_email_recipient_preview',{p_project:s.project.id,p_audience:audience,p_group:group,p_contact_field:contact});
 btn.disabled=false;btn.textContent='載入／更新收件名單';
 if(error)return R.toast(error.message);recipients=data||[];renderRecipients();
}
function renderRecipients(){
 const host=document.getElementById('rfMailRecipients');if(!host)return;
 if(!recipients.length){host.innerHTML='<div class="empty">目前沒有符合條件且具有效 Email 的收件人。</div>';return}
 host.innerHTML='<div class="rf-mail-recipient-head"><div><b>實際收件人 '+recipients.length+' 位</b><div class="muted tiny">建立草稿、排程或正式寄送前都可以逐一取消勾選。</div></div><div class="rf4-actions"><button class="btn" id="rfMailAll">全選</button><button class="btn" id="rfMailNone">全不選</button><button class="btn" id="rfMailCsv">下載收件人 CSV</button></div></div><div class="table-wrap"><table><thead><tr><th>使用</th><th>姓名</th><th>Email</th><th>組別</th><th>作品／身分</th><th>最終結果</th></tr></thead><tbody>'+recipients.map((x,i)=>'<tr><td><input type="checkbox" checked data-mail-recipient="'+i+'"></td><td>'+R.esc(x.recipient_name||'—')+'</td><td>'+R.esc(x.recipient_email)+'</td><td>'+R.esc(x.group_name||'—')+'</td><td>'+R.esc(x.title||x.recipient_type||'—')+'</td><td>'+R.esc(x.award_name?x.award_name+'（#'+x.final_position+'）':'—')+'</td></tr>').join('')+'</tbody></table></div>';
 document.getElementById('rfMailAll').onclick=()=>document.querySelectorAll('[data-mail-recipient]').forEach(x=>x.checked=true);
 document.getElementById('rfMailNone').onclick=()=>document.querySelectorAll('[data-mail-recipient]').forEach(x=>x.checked=false);
 document.getElementById('rfMailCsv').onclick=()=>{
  const lines=[['姓名','Email','組別','作品','最終名次','獎項'].map(escCsv).join(',')].concat(selected().map(x=>[x.recipient_name,x.recipient_email,x.group_name,x.title,x.final_position,x.award_name].map(escCsv).join(',')));
  const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(s.project.name||'競賽')+'_寄信名單.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
}
async function saveSettings(){
 const sender=v('rfMailSenderName').trim(),reply=v('rfMailReplyTo').trim();
 const {error}=await sb.from('project_email_settings').upsert({project_id:s.project.id,sender_name:sender||null,reply_to:reply||null,updated_by:s.user.id,updated_at:new Date().toISOString()},{onConflict:'project_id'});
 if(error)return R.toast(error.message);R.toast('郵件設定已儲存');
}
async function saveTemplate(){
 const name=prompt('請輸入這個郵件範本名稱：','得獎通知');if(!name)return;
 const subject=v('rfMailSubject').trim(),body=v('rfMailBody').trim();if(!subject||!body)return R.toast('請先輸入主旨與內容');
 const {error}=await sb.from('email_templates').insert({project_id:s.project.id,name,audience_type:v('rfMailAudience'),subject_template:subject,body_template:body,created_by:s.user.id});
 if(error)return R.toast(error.message);R.toast('範本已儲存');await R.pages.emailCenter();
}
function operationRecipients(testMode){
 const list=selected();if(!list.length)throw new Error('請至少勾選一位收件人');
 if(!testMode)return list;
 const mail=prompt('測試信要寄到哪個 Email？',s.profile?.email||'');if(!mail)throw new Error('已取消測試信');
 const sample=list[0];
 return [{...sample,recipient_email:mail,recipient_name:s.profile?.display_name||'系統管理員'}];
}
async function perform(mode,testMode=false){
 if(!service.configured)throw new Error('Gmail 尚未連線，請先完成上方免費 Gmail 串接');
 const subject=v('rfMailSubject').trim(),body=v('rfMailBody').trim();if(!subject||!body)throw new Error('請輸入郵件主旨與內容');
 const sender=v('rfMailSenderName').trim(),reply=v('rfMailReplyTo').trim();
 const list=operationRecipients(testMode);
 let scheduledFor=null;
 if(mode==='schedule'){
   const raw=v('rfMailScheduleAt');if(!raw)throw new Error('請選擇排程日期與時間');
   const dt=new Date(raw);if(!Number.isFinite(dt.getTime())||dt.getTime()<=Date.now()+15000)throw new Error('排程時間必須晚於目前時間');
   scheduledFor=dt.toISOString();
 }
 if(mode==='sendNow'&&!testMode&&Number.isFinite(Number(service.remaining_daily_quota))&&list.length>Number(service.remaining_daily_quota)){
   throw new Error('目前 Gmail Apps Script 剩餘寄送額度只有 '+service.remaining_daily_quota+' 位，但你選了 '+list.length+' 位。請改用「排程寄出」或減少本次收件人。');
 }
 if(mode==='sendNow'&&!testMode&&!confirm('確定要立即寄出 '+list.length+' 封 Gmail 嗎？\n\n寄出後無法由系統收回，請先確認名單、主旨與內容。'))throw new Error('已取消寄送');
 if(mode==='schedule'&&!confirm('確定排程 '+list.length+' 封 Gmail 於\n'+new Date(scheduledFor).toLocaleString('zh-TW')+'？\n\n系統會先建立 Gmail 草稿，到時間再寄出。'))throw new Error('已取消排程');

 const buttonId=mode==='createDraft'?'rfMailDraft':mode==='schedule'?'rfMailSchedule':testMode?'rfMailTest':'rfMailSend';
 const btn=document.getElementById(buttonId);if(btn){btn.disabled=true;btn.dataset.old=btn.textContent;btn.textContent='處理中…'}
 try{
   let ok=0,fail=0;
   for(let i=0;i<list.length;i+=50){
     const chunk=list.slice(i,i+50).map(x=>({email:x.recipient_email,name:x.recipient_name,type:x.recipient_type,submission_id:x.submission_id,variables:varsFor(x)}));
     const out=await callProvider({
       action:mode, audience_type:v('rfMailAudience'),group_name:v('rfMailGroup')||null,contact_field:v('rfMailContact'),
       subject_template:subject,body_template:body,sender_name:sender,reply_to:reply,
       test_mode:testMode,scheduled_for:scheduledFor,recipients:chunk
     });
     ok+=Number(out.success_count??(out.results||[]).filter(x=>x.ok).length);
     fail+=Number(out.failed_count??(out.results||[]).filter(x=>!x.ok).length);
     if(out.remaining_daily_quota!==undefined)service.remaining_daily_quota=out.remaining_daily_quota;
   }
   const label=mode==='createDraft'?'Gmail 草稿':mode==='schedule'?'Gmail 排程':testMode?'測試信':'Gmail 寄送';
   R.toast(label+'完成：成功 '+ok+'、失敗 '+fail);
   await R.pages.emailCenter();
 }finally{
   if(btn){btn.disabled=false;btn.textContent=btn.dataset.old||btn.textContent}
 }
}
async function loadScheduled(){
 if(!service.configured)return;
 try{
  const out=await callProvider({action:'scheduled'});scheduledJobs=out.jobs||[];
  if(out.remaining_daily_quota!==undefined)service.remaining_daily_quota=out.remaining_daily_quota;
  renderScheduled();
 }catch(e){
  const h=document.getElementById('rfMailScheduled');if(h)h.innerHTML='<div class="danger-note">'+R.esc(e.message||String(e))+'</div>';
 }
}
function renderScheduled(){
 const host=document.getElementById('rfMailScheduled');if(!host)return;
 const active=scheduledJobs.filter(x=>x.status==='scheduled');
 const recent=scheduledJobs.filter(x=>x.status!=='scheduled').slice(0,20);
 const rows=arr=>arr.map(x=>'<tr><td>'+R.esc(x.to||'—')+'</td><td>'+R.esc(x.subject||'—')+'</td><td>'+R.esc(x.scheduled_for?new Date(x.scheduled_for).toLocaleString('zh-TW'):'—')+'</td><td>'+R.esc(fmtStatus(x.status))+'</td><td>'+(x.status==='scheduled'?'<button class="btn" data-cancel-schedule="'+R.esc(x.schedule_id)+'">取消排程，保留草稿</button>':'—')+'</td></tr>').join('');
 host.innerHTML='<div class="rf-mail-recipient-head"><div><b>待寄排程 '+active.length+' 封</b><div class="muted tiny">排程寄送會先建立 Gmail 草稿；取消排程預設保留草稿。</div></div><button class="btn" id="rfMailRefreshSchedule">重新整理 Gmail 狀態</button></div>'+
 (active.length?'<div class="table-wrap"><table><thead><tr><th>收件人</th><th>主旨</th><th>預定時間</th><th>狀態</th><th>操作</th></tr></thead><tbody>'+rows(active)+'</tbody></table></div>':'<div class="empty">目前沒有待寄排程。</div>')+
 (recent.length?'<details class="rf-mail-recent"><summary>最近完成／取消／失敗的 Gmail 排程</summary><div class="table-wrap"><table><thead><tr><th>收件人</th><th>主旨</th><th>原排程時間</th><th>狀態</th><th></th></tr></thead><tbody>'+rows(recent)+'</tbody></table></div></details>':'');
 document.getElementById('rfMailRefreshSchedule').onclick=loadScheduled;
 document.querySelectorAll('[data-cancel-schedule]').forEach(b=>b.onclick=async()=>{
   if(!confirm('取消這封排程嗎？\n\nGmail 草稿會保留，之後仍可以在 Gmail 裡修改或手動寄出。'))return;
   try{await callProvider({action:'cancel',schedule_ids:[b.dataset.cancelSchedule],delete_drafts:false});R.toast('排程已取消，Gmail 草稿已保留');await loadScheduled()}catch(e){R.toast(e.message||String(e))}
 });
}
function applyTemplate(t){
 document.getElementById('rfMailSubject').value=t.subject_template||'';
 document.getElementById('rfMailBody').value=t.body_template||'';
 document.getElementById('rfMailAudience').value=t.audience_type||'winners';
}

R.pages.emailCenter=async function(){
 if(!isSystemAdmin())return R.setMain('<section class="section"><div class="danger-note">僅限平台系統管理員使用郵件中心。</div></section>');
 integration=await getIntegration();
 if(integration?.configured)await serviceStatus();else service={configured:false};
 const [settingsRes,templatesRes,batchesRes]=await Promise.all([
   sb.from('project_email_settings').select('*').eq('project_id',s.project.id).maybeSingle(),
   sb.from('email_templates').select('*').eq('project_id',s.project.id).eq('is_active',true).order('updated_at',{ascending:false}),
   sb.from('email_batches').select('*').eq('project_id',s.project.id).order('created_at',{ascending:false}).limit(30)
 ]);
 const settings=settingsRes.data||{},templates=templatesRes.data||[],batches=batchesRes.data||[];
 const connected=!!service.configured;
 const statusHtml=connected
 ?'<div class="rf4-banner good"><b>Gmail 免費串接已連線</b><br>帳號：'+R.esc(service.gmail_address||integration?.gmail_address||'已授權 Gmail')+'　｜　時區：'+R.esc(service.timezone||'—')+'　｜　今日剩餘寄送額度：<b>'+R.esc(service.remaining_daily_quota??'—')+'</b>　｜　待寄排程：'+R.esc(service.scheduled_count??'0')+'</div>'
 :'<div class="rf4-banner warn"><b>Gmail 尚未完成連線</b><br>使用 Google Apps Script 免費串接，不需要提供 Gmail 密碼，也不需要購買第三方寄信 API。</div>';
 const tplOptions='<option value="">選擇已存範本…</option>'+templates.map((t,i)=>'<option value="'+i+'">'+R.esc(t.name)+'</option>').join('');
 const history=batches.length?'<div class="table-wrap"><table><thead><tr><th>時間</th><th>模式</th><th>對象</th><th>組別</th><th>封數</th><th>狀態</th><th>排程時間</th></tr></thead><tbody>'+batches.map(x=>'<tr><td>'+R.fmt(x.created_at)+'</td><td>'+R.esc(x.provider==='gmail_apps_script'?'Gmail':'—')+'</td><td>'+R.esc(x.audience_type)+'</td><td>'+R.esc(x.group_name||'全部')+'</td><td>'+x.recipient_count+'</td><td>'+R.esc(fmtStatus(x.status))+'</td><td>'+R.esc(x.scheduled_for?new Date(x.scheduled_for).toLocaleString('zh-TW'):'—')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">尚無寄送紀錄。</div>';

 R.setMain('<section class="section"><div class="rf-final-title"><div><div class="badge purple">系統管理員專用</div><h2>郵件中心｜Gmail 免費串接</h2><p class="muted">直接使用自己的 Gmail 建立草稿、立即寄出或排程寄出。所有操作保留在 Gmail 與系統紀錄中。</p></div></div>'+statusHtml+'</section>'+
 '<section class="section rf-gmail-setup"><details '+(connected?'':'open')+'><summary><b>Gmail 免費串接設定</b> <span class="muted">（第一次設定才需要）</span></summary><div class="rf-gmail-steps"><ol><li>到 <a href="https://script.google.com/" target="_blank" rel="noopener">Google Apps Script</a> 建立新專案。</li><li>把本系統提供的 <code>gmail-appscript-bridge.gs</code> 貼入 <code>Code.gs</code>。</li><li>Apps Script「專案設定 → 指令碼屬性」新增 <code>BRIDGE_SECRET</code>，值要和下方連線密鑰完全相同。</li><li>在 Apps Script 手動執行一次 <code>authorizeGmailBridge()</code> 並授權 Gmail。</li><li>部署為「網頁應用程式」：執行身分選「我」，存取權限選「任何人」。</li><li>把部署後以 <code>/exec</code> 結尾的網址貼回下方，儲存並測試。</li></ol><div class="rf4-actions"><button class="btn" id="rfGmailCopyCode">複製 Apps Script 程式碼</button><a class="btn" href="./gmail-appscript-bridge.gs?v=20260928a" download>下載 Apps Script 程式碼</a><a class="btn" href="./GMAIL_FREE_SETUP.md?v=20260928a" target="_blank">完整設定說明</a></div></div><div class="split" style="margin-top:14px"><div><label class="label">Apps Script Web App URL</label><input class="input" id="rfGmailWebApp" placeholder="https://script.google.com/macros/s/.../exec"><div class="muted tiny">'+(integration?.configured?'目前已設定：'+R.esc(integration.web_app_url||'已隱藏'):'尚未設定')+'</div></div><div><label class="label">連線密鑰（不是 Gmail 密碼）</label><div class="rf-gmail-secret-row"><input class="input" id="rfGmailSecret" type="password" autocomplete="new-password" placeholder="產生或貼上至少 32 字元的隨機密鑰"><button class="btn" id="rfGmailGenerate">產生並複製</button></div><div class="muted tiny">已儲存的密鑰不會再回傳到瀏覽器。</div></div></div><div class="rf4-actions" style="margin-top:12px"><button class="btn primary" id="rfGmailSave">儲存並測試連線</button>'+(integration?.configured?'<button class="btn danger" id="rfGmailDisconnect">解除 Gmail 串接</button>':'')+'</div><div id="rfGmailSetupMsg"></div></details></section>'+
 '<section class="section"><h3>寄件設定</h3><div class="split"><div><label class="label">寄件顯示名稱</label><input class="input" id="rfMailSenderName" value="'+R.esc(settings.sender_name||s.project.name||'')+'"></div><div><label class="label">回覆信箱 Reply-To</label><input class="input" id="rfMailReplyTo" type="email" value="'+R.esc(settings.reply_to||'')+'"></div></div><button class="btn" id="rfMailSaveSettings" style="margin-top:12px">儲存寄件設定</button></section>'+
 '<section class="section"><h3>1. 選擇收件人</h3><div class="filters"><select class="select" id="rfMailAudience"><option value="winners">最終得獎者</option><option value="finalists">第二輪入圍者</option><option value="all_formal">所有正式投稿者</option><option value="judges">目前啟用中的評審</option></select><select class="select" id="rfMailGroup"><option value="">全部組別</option><option>小學組</option><option>國中組</option><option>高中職組</option></select><select class="select" id="rfMailContact"><option value="auto">自動選擇聯絡信箱</option><option value="submission_email">報名 Email</option><option value="parent_email">家長 Email</option><option value="student_email">學生 Email</option><option value="adviser_email">指導老師 Email</option></select><button class="btn primary" id="rfMailPreviewBtn">載入／更新收件名單</button></div><div id="rfMailRecipients" style="margin-top:14px"><div class="empty">先選擇寄送對象，再載入實際收件名單。</div></div></section>'+
 '<section class="section"><h3>2. 編輯郵件</h3><div class="row" style="gap:8px;flex-wrap:wrap"><select class="select" id="rfMailTemplate">'+tplOptions+'</select><button class="btn" id="rfMailSaveTemplate">另存為範本</button></div><div class="rf-mail-vars"><b>可用變數：</b> {{project_name}}、{{name}}、{{student_name}}、{{group_name}}、{{title}}、{{final_position}}、{{award_name}}、{{anonymous_code}}</div><label class="label">郵件主旨</label><input class="input" id="rfMailSubject" placeholder="例如：{{project_name}}－{{award_name}}通知"><label class="label">郵件內容</label><textarea class="input rf-mail-body" id="rfMailBody" rows="12" placeholder="您好 {{student_name}}：&#10;&#10;恭喜您的作品「{{title}}」…"></textarea></section>'+
 '<section class="section"><h3>3. 草稿、排程與寄送</h3><div class="rf-mail-operation-grid"><div class="rf-mail-op"><b>先存 Gmail 草稿</b><p class="muted tiny">不寄出、不消耗寄送額度，可直接到 Gmail 草稿匣再次檢查。</p><button class="btn" id="rfMailDraft" '+(connected?'':'disabled')+'>建立 Gmail 草稿</button></div><div class="rf-mail-op"><b>排程寄出</b><p class="muted tiny">先建立 Gmail 草稿，到指定時間由 Apps Script 背景寄出。</p><input class="input" id="rfMailScheduleAt" type="datetime-local"><button class="btn primary" id="rfMailSchedule" '+(connected?'':'disabled')+'>建立排程</button></div><div class="rf-mail-op"><b>立即寄出</b><p class="muted tiny">正式寄出前會再次確認；收件人數不能超過目前剩餘免費額度。</p><div class="rf4-actions"><button class="btn" id="rfMailTest" '+(connected?'':'disabled')+'>寄送測試信</button><button class="btn primary" id="rfMailSend" '+(connected?'':'disabled')+'>立即正式寄出</button></div></div></div><div class="rf4-banner" style="margin-top:12px">一般 Gmail 的 Apps Script 每日收件人額度通常較低；大量信件建議使用排程，系統會保留尚未寄出的 Gmail 草稿。</div></section>'+
 '<section class="section"><h3>Gmail 排程</h3><div id="rfMailScheduled">'+(connected?'<div class="empty">正在讀取 Gmail 排程…</div>':'<div class="empty">完成 Gmail 串接後才會顯示排程。</div>')+'</div></section>'+
 '<section class="section"><h3>系統寄信紀錄</h3>'+history+'</section>');

 document.getElementById('rfGmailCopyCode').onclick=copyBridge;
 document.getElementById('rfGmailGenerate').onclick=genSecret;
 document.getElementById('rfGmailSave').onclick=saveGmailIntegration;
 document.getElementById('rfGmailDisconnect')?.addEventListener('click',disconnectGmail);
 document.getElementById('rfMailSaveSettings').onclick=saveSettings;
 document.getElementById('rfMailPreviewBtn').onclick=previewRecipients;
 document.getElementById('rfMailSaveTemplate').onclick=saveTemplate;
 document.getElementById('rfMailDraft').onclick=()=>perform('createDraft').catch(e=>R.toast(e.message||String(e)));
 document.getElementById('rfMailSchedule').onclick=()=>perform('schedule').catch(e=>R.toast(e.message||String(e)));
 document.getElementById('rfMailTest').onclick=()=>perform('sendNow',true).catch(e=>R.toast(e.message||String(e)));
 document.getElementById('rfMailSend').onclick=()=>perform('sendNow',false).catch(e=>R.toast(e.message||String(e)));
 document.getElementById('rfMailTemplate').onchange=e=>{const t=templates[Number(e.target.value)];if(t)applyTemplate(t)};
 recipients=[];scheduledJobs=[];
 if(connected)loadScheduled();
};
})();