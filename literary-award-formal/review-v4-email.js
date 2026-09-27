'use strict';
(function(){
const R=window.RF4;if(!R)return;const {sb,s}=R;
const APIKEY='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
const ENDPOINT='https://ppdrsoltvqiqnbnlimbb.supabase.co/functions/v1/send-project-email';
let recipients=[],service={configured:false},templates=[],settings={};

const isSystemAdmin=()=>s.profile?.platform_role==='platform_admin'||s.role==='platform_admin';
const v=id=>document.getElementById(id)?.value||'';
const escCsv=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
const fmtStatus=x=>({drafted:'Gmail 草稿',scheduled:'已排程',completed:'已寄出',partial:'部分失敗',failed:'失敗',cancelled:'已取消',test:'測試'}[x]||x||'—');
function randomSecret(){const a=new Uint8Array(32);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function edge(payload){
 const {data:{session}}=await sb.auth.getSession();
 const r=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify({...payload,project_id:s.project.id})});
 const out=await r.json().catch(()=>({}));if(!r.ok)throw new Error(out.error||'Gmail 操作失敗');return out;
}
async function serviceStatus(){
 try{service=await edge({action:'status'});service.configured=true}
 catch(e){service={configured:false,error:e.message}}
 return service;
}
function varsFor(x){return{name:x.recipient_name||'',student_name:x.recipient_name||'',group_name:x.group_name||'',title:x.title||'',final_position:x.final_position||'',award_name:x.award_name||'',anonymous_code:x.anonymous_code||'',project_name:s.project.name||''}}
function selected(){return [...document.querySelectorAll('[data-mail-recipient]:checked')].map(x=>recipients[Number(x.dataset.mailRecipient)]).filter(Boolean)}

async function previewRecipients(){
 const btn=document.getElementById('rfMailPreviewBtn');btn.disabled=true;btn.textContent='載入中…';
 const {data,error}=await sb.rpc('get_email_recipient_preview',{p_project:s.project.id,p_audience:v('rfMailAudience'),p_group:v('rfMailGroup')||null,p_contact_field:v('rfMailContact')});
 btn.disabled=false;btn.textContent='載入／更新收件名單';
 if(error)return R.toast(error.message);recipients=data||[];renderRecipients();
}
function renderRecipients(){
 const host=document.getElementById('rfMailRecipients');if(!host)return;
 if(!recipients.length){host.innerHTML='<div class="empty">目前沒有符合條件且具有效 Email 的收件人。</div>';return}
 host.innerHTML='<div class="rf-mail-recipient-head"><div><b>實際收件人 '+recipients.length+' 位</b><div class="muted tiny">建立草稿、排程或正式寄送前都可以逐筆取消。</div></div><div class="rf4-actions"><button class="btn" id="rfMailAll">全選</button><button class="btn" id="rfMailNone">全不選</button><button class="btn" id="rfMailCsv">下載收件人 CSV</button></div></div><div class="table-wrap"><table><thead><tr><th>使用</th><th>姓名</th><th>Email</th><th>組別</th><th>作品／身分</th><th>最終結果</th></tr></thead><tbody>'+recipients.map((x,i)=>'<tr><td><input type="checkbox" checked data-mail-recipient="'+i+'"></td><td>'+R.esc(x.recipient_name||'—')+'</td><td>'+R.esc(x.recipient_email)+'</td><td>'+R.esc(x.group_name||'—')+'</td><td>'+R.esc(x.title||x.recipient_type||'—')+'</td><td>'+R.esc(x.award_name?x.award_name+'（#'+x.final_position+'）':'—')+'</td></tr>').join('')+'</tbody></table></div>';
 document.getElementById('rfMailAll').onclick=()=>document.querySelectorAll('[data-mail-recipient]').forEach(x=>x.checked=true);
 document.getElementById('rfMailNone').onclick=()=>document.querySelectorAll('[data-mail-recipient]').forEach(x=>x.checked=false);
 document.getElementById('rfMailCsv').onclick=()=>{const lines=[['姓名','Email','組別','作品','最終名次','獎項'].map(escCsv).join(',')].concat(selected().map(x=>[x.recipient_name,x.recipient_email,x.group_name,x.title,x.final_position,x.award_name].map(escCsv).join(',')));const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(s.project.name||'競賽')+'_寄信名單.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
}
async function saveSettings(){
 const {error}=await sb.from('project_email_settings').upsert({project_id:s.project.id,sender_name:v('rfMailSenderName').trim()||null,reply_to:v('rfMailReplyTo').trim()||null,updated_by:s.user.id,updated_at:new Date().toISOString()},{onConflict:'project_id'});
 if(error)return R.toast(error.message);R.toast('寄件顯示設定已儲存');
}
async function saveTemplate(){
 const name=prompt('請輸入這個郵件範本名稱：','得獎通知');if(!name)return;
 const subject=v('rfMailSubject').trim(),body=v('rfMailBody').trim();if(!subject||!body)return R.toast('請先輸入主旨與內容');
 const {error}=await sb.from('email_templates').insert({project_id:s.project.id,name,audience_type:v('rfMailAudience'),subject_template:subject,body_template:body,created_by:s.user.id});
 if(error)return R.toast(error.message);R.toast('範本已儲存');await R.pages.emailCenter();
}
function applyTemplate(t){document.getElementById('rfMailSubject').value=t.subject_template||'';document.getElementById('rfMailBody').value=t.body_template||'';document.getElementById('rfMailAudience').value=t.audience_type||'winners'}

async function saveGmailConfig(){
 const url=v('rfGmailWebApp').trim(),secret=v('rfGmailSecret').trim();if(!url||!secret)return R.toast('請填入 Apps Script Web App 網址與連線金鑰');
 const btn=document.getElementById('rfGmailSave');btn.disabled=true;btn.textContent='儲存並測試中…';
 try{
   const {error}=await sb.rpc('set_gmail_integration',{p_project:s.project.id,p_web_app_url:url,p_shared_secret:secret});if(error)throw error;
   const st=await serviceStatus();if(!st.configured)throw new Error(st.error||'尚未連線');
   R.toast('Gmail 串接成功：'+(st.gmail_address||'已授權帳號'));await R.pages.emailCenter();
 }catch(e){R.toast(e.message||String(e));btn.disabled=false;btn.textContent='儲存並測試 Gmail'}
}
async function clearGmail(){
 if(!confirm('確定移除這個專案的 Gmail 串接嗎？\n\n已經存在 Gmail 裡的草稿不會被刪除。'))return;
 const {error}=await sb.rpc('clear_gmail_integration',{p_project:s.project.id});if(error)return R.toast(error.message);R.toast('已移除 Gmail 串接');await R.pages.emailCenter();
}
async function copyScript(){
 try{const r=await fetch('./gmail-apps-script.gs?v=20260927c');const t=await r.text();await navigator.clipboard.writeText(t);R.toast('Apps Script 程式碼已複製')}catch{window.open('./gmail-apps-script.gs?v=20260927c','_blank')}
}
function genKey(){const x=document.getElementById('rfGmailSecret');x.value=randomSecret();x.type='text';x.focus();x.select()}
async function copyKey(){const x=v('rfGmailSecret');if(!x)return R.toast('請先產生連線金鑰');await navigator.clipboard.writeText(x);R.toast('連線金鑰已複製')}

async function runMail(mode,test=false){
 if(!service.configured)return R.toast('請先完成 Gmail 串接');
 let list=selected();if(!list.length)return R.toast('請至少勾選一位收件人');
 const subject=v('rfMailSubject').trim(),body=v('rfMailBody').trim();if(!subject||!body)return R.toast('請先輸入郵件主旨與內容');
 let scheduledFor=null;
 if(mode==='schedule'){
   const raw=v('rfMailScheduleAt');if(!raw)return R.toast('請選擇排程寄送時間');
   const d=new Date(raw);if(!Number.isFinite(d.getTime())||d.getTime()<=Date.now())return R.toast('排程時間必須晚於現在');
   scheduledFor=d.toISOString();
 }
 if(test){
   const mail=prompt('測試信要寄到哪個 Email？',s.profile?.email||'');if(!mail)return;
   list=[{...list[0],recipient_email:mail,recipient_name:s.profile?.display_name||'系統管理員'}];
 }
 if(mode==='sendNow'&&!test&&Number.isFinite(Number(service.remaining_daily_quota))&&list.length>Number(service.remaining_daily_quota))return R.toast('目前 Gmail 今日剩餘寄信額度只有 '+service.remaining_daily_quota+' 位，請縮小收件人或改用草稿／之後排程');
 const label=test?'寄送測試信':mode==='createDraft'?'建立 Gmail 草稿':mode==='schedule'?'建立排程':'立即寄出';
 if(!test&&!confirm('確定要「'+label+'」給 '+list.length+' 位收件人嗎？\n\n請先確認收件名單與郵件內容。'))return;
 const buttonId=test?'rfMailTest':mode==='createDraft'?'rfMailDraft':mode==='schedule'?'rfMailSchedule':'rfMailSend';
 const btn=document.getElementById(buttonId);btn.disabled=true;btn.textContent='處理中…';
 try{
   let ok=0,fail=0;
   for(let i=0;i<list.length;i+=100){
     const part=list.slice(i,i+100).map(x=>({email:x.recipient_email,name:x.recipient_name,type:x.recipient_type,submission_id:x.submission_id,variables:varsFor(x)}));
     const out=await edge({action:mode,audience_type:v('rfMailAudience'),group_name:v('rfMailGroup')||null,contact_field:v('rfMailContact'),subject_template:subject,body_template:body,sender_name:v('rfMailSenderName').trim(),reply_to:v('rfMailReplyTo').trim(),test_mode:test,scheduled_for:scheduledFor,recipients:part});
     (out.results||[]).forEach(x=>x.ok?ok++:fail++);
     if(out.remaining_daily_quota!==undefined)service.remaining_daily_quota=out.remaining_daily_quota;
   }
   R.toast(label+'完成：成功 '+ok+(fail?'、失敗 '+fail:''));await R.pages.emailCenter();
 }catch(e){R.toast(e.message||String(e));btn.disabled=false;btn.textContent=label}
}
async function loadSchedules(){
 const host=document.getElementById('rfMailSchedules');if(!host||!service.configured)return;
 host.innerHTML='<div class="muted">正在同步 Gmail 排程…</div>';
 try{
  const out=await edge({action:'scheduled'}),pending=out.pending||[],history=out.history||[];
  host.innerHTML=(pending.length?'<div class="table-wrap"><table><thead><tr><th>寄送時間</th><th>收件人</th><th>狀態</th><th>操作</th></tr></thead><tbody>'+pending.map(x=>'<tr><td>'+R.fmt(x.send_at)+'</td><td>'+R.esc(x.to||'')+'</td><td>'+R.badge('等待寄送','warn')+'</td><td><button class="btn" data-cancel-schedule="'+R.esc(x.id)+'">取消排程</button></td></tr>').join('')+'</tbody></table></div>':'<div class="empty">目前沒有等待寄送的 Gmail 排程。</div>')+
  (history.length?'<details class="rf-mail-history-detail"><summary>最近排程結果 '+history.length+' 筆</summary><div class="table-wrap"><table><thead><tr><th>收件人</th><th>狀態</th><th>時間</th></tr></thead><tbody>'+history.slice(0,50).map(x=>'<tr><td>'+R.esc(x.to||'')+'</td><td>'+R.esc(x.status||'')+'</td><td>'+R.esc(x.sent_at||x.failed_at||x.cancelled_at||'')+'</td></tr>').join('')+'</tbody></table></div></details>':'');
  document.querySelectorAll('[data-cancel-schedule]').forEach(b=>b.onclick=async()=>{if(!confirm('取消這封排程嗎？\n\nGmail 草稿會保留，方便之後人工處理。'))return;try{await edge({action:'cancel',schedule_ids:[b.dataset.cancelSchedule],delete_drafts:false});R.toast('排程已取消，Gmail 草稿已保留');loadSchedules()}catch(e){R.toast(e.message||String(e))}});
 }catch(e){host.innerHTML='<div class="danger-note">'+R.esc(e.message||String(e))+'</div>'}
}

R.pages.emailCenter=async function(){
 if(!isSystemAdmin())return R.setMain('<section class="section"><div class="danger-note">僅限平台系統管理員使用郵件中心。</div></section>');
 const [gmailRes,settingsRes,templatesRes,batchesRes]=await Promise.all([
   sb.rpc('get_gmail_integration_status',{p_project:s.project.id}),
   sb.from('project_email_settings').select('*').eq('project_id',s.project.id).maybeSingle(),
   sb.from('email_templates').select('*').eq('project_id',s.project.id).eq('is_active',true).order('updated_at',{ascending:false}),
   sb.from('email_batches').select('*').eq('project_id',s.project.id).order('created_at',{ascending:false}).limit(30)
 ]);
 const gmailCfg=Array.isArray(gmailRes.data)?gmailRes.data[0]:gmailRes.data;settings=settingsRes.data||{};templates=templatesRes.data||[];const batches=batchesRes.data||[];
 await serviceStatus();
 const connected=service.configured;
 const gmailBanner=connected?'<div class="rf4-banner good"><b>Gmail 已連線</b><br>帳號：'+R.esc(service.gmail_address||gmailCfg?.gmail_address||'已授權')+'　｜　今日剩餘寄信額度：約 '+R.esc(service.remaining_daily_quota??'—')+' 位　｜　Apps Script 時區：'+R.esc(service.timezone||'—')+'</div>':'<div class="rf4-banner warn"><b>尚未完成 Gmail 免費串接</b><br>完成下方一次性設定後，就可以直接建立 Gmail 草稿、立即寄出與排程寄送。'+(service.error?'<br><span class="tiny">'+R.esc(service.error)+'</span>':'')+'</div>';
 const setup='<section class="section"><h3>Gmail 免費串接設定</h3><p class="muted">使用你自己的 Gmail＋Google Apps Script，不需要付費 Email API。Apps Script 會以你授權的 Gmail 帳號建立草稿與寄信。</p><ol class="rf-gmail-steps"><li>按「複製 Apps Script 程式碼」，到 <b>script.google.com</b> 建立新專案並貼上。</li><li>按「產生連線金鑰」，把同一串金鑰貼到程式最上方 <code>BRIDGE_SECRET</code>。</li><li>在 Apps Script 執行 <code>authorizeOnce()</code> 一次，完成 Gmail 授權。</li><li>部署 → New deployment → Web app；Execute as 選 <b>Me</b>，Who has access 選 <b>Anyone</b>。</li><li>把最後的 <code>/exec</code> 網址貼回下面，儲存並測試。</li></ol><div class="rf4-actions"><button class="btn" id="rfGmailCopyScript">複製 Apps Script 程式碼</button><a class="btn" href="./gmail-apps-script.gs?v=20260927c" target="_blank">開啟程式碼</a><button class="btn" id="rfGmailGenerate">產生連線金鑰</button><button class="btn" id="rfGmailCopyKey">複製金鑰</button></div><label class="label">Apps Script Web App 網址（/exec）</label><input class="input" id="rfGmailWebApp" placeholder="https://script.google.com/macros/s/.../exec" value="'+R.esc(gmailCfg?.web_app_url||'')+'"><label class="label">連線金鑰</label><input class="input" id="rfGmailSecret" type="password" autocomplete="new-password" placeholder="至少 32 個字元；必須與 Apps Script 內完全相同"><div class="rf4-actions" style="margin-top:12px"><button class="btn primary" id="rfGmailSave">儲存並測試 Gmail</button>'+(gmailCfg?'<button class="btn danger" id="rfGmailClear">移除串接</button>':'')+'</div></section>';
 const tplOptions='<option value="">選擇已存範本…</option>'+templates.map((t,i)=>'<option value="'+i+'">'+R.esc(t.name)+'</option>').join('');
 const history=batches.length?'<div class="table-wrap"><table><thead><tr><th>時間</th><th>操作</th><th>對象</th><th>組別</th><th>封數</th><th>排程時間</th><th>狀態</th></tr></thead><tbody>'+batches.map(x=>'<tr><td>'+R.fmt(x.created_at)+'</td><td>'+R.esc(x.provider==='gmail_apps_script'?'Gmail':'Email')+'</td><td>'+R.esc(x.audience_type)+'</td><td>'+R.esc(x.group_name||'全部')+'</td><td>'+x.recipient_count+'</td><td>'+R.esc(x.scheduled_for?R.fmt(x.scheduled_for):'—')+'</td><td>'+R.esc(fmtStatus(x.status))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">尚無郵件操作紀錄。</div>';
 R.setMain('<section class="section"><div class="rf-final-title"><div><div class="badge purple">系統管理員專用</div><h2>Gmail 郵件中心</h2><p class="muted">收件人與名次直接來自競賽資料。可先建立真正的 Gmail 草稿，再決定立即寄送或指定時間自動寄出。</p></div></div>'+gmailBanner+'</section>'+setup+
 '<section class="section"><h3>寄件顯示設定</h3><div class="split"><div><label class="label">寄件顯示名稱</label><input class="input" id="rfMailSenderName" value="'+R.esc(settings.sender_name||s.project.name||'')+'"></div><div><label class="label">回覆信箱 Reply-To</label><input class="input" id="rfMailReplyTo" type="email" value="'+R.esc(settings.reply_to||'')+'"></div></div><button class="btn" id="rfMailSaveSettings" style="margin-top:12px">儲存顯示設定</button></section>'+
 '<section class="section"><h3>1. 選擇收件人</h3><div class="filters"><select class="select" id="rfMailAudience"><option value="winners">最終得獎者</option><option value="finalists">第二輪入圍者</option><option value="all_formal">所有正式投稿者</option><option value="judges">目前啟用中的評審</option></select><select class="select" id="rfMailGroup"><option value="">全部組別</option><option>小學組</option><option>國中組</option><option>高中職組</option></select><select class="select" id="rfMailContact"><option value="auto">自動選擇聯絡信箱</option><option value="submission_email">報名 Email</option><option value="parent_email">家長 Email</option><option value="student_email">學生 Email</option><option value="adviser_email">指導老師 Email</option></select><button class="btn primary" id="rfMailPreviewBtn">載入／更新收件名單</button></div><div id="rfMailRecipients" style="margin-top:14px"><div class="empty">先選擇寄送對象，再載入實際收件名單。</div></div></section>'+
 '<section class="section"><h3>2. 編輯郵件</h3><div class="row" style="gap:8px;flex-wrap:wrap"><select class="select" id="rfMailTemplate">'+tplOptions+'</select><button class="btn" id="rfMailSaveTemplate">另存為範本</button></div><div class="rf-mail-vars"><b>可用變數：</b> {{project_name}}、{{name}}、{{student_name}}、{{group_name}}、{{title}}、{{final_position}}、{{award_name}}、{{anonymous_code}}</div><label class="label">郵件主旨</label><input class="input" id="rfMailSubject" placeholder="例如：{{project_name}}－{{award_name}}通知"><label class="label">郵件內容</label><textarea class="input rf-mail-body" id="rfMailBody" rows="12" placeholder="您好 {{student_name}}：&#10;&#10;恭喜您的作品「{{title}}」…"></textarea></section>'+
 '<section class="section"><h3>3. Gmail 操作</h3><p class="muted">「建立草稿」不會寄出；「排程寄出」也會先建立 Gmail 草稿，排程時間到之前仍可直接在 Gmail 修改。</p><div class="rf-mail-actions-grid"><button class="btn" id="rfMailDraft" '+(connected?'':'disabled')+'>建立 Gmail 草稿</button><button class="btn" id="rfMailTest" '+(connected?'':'disabled')+'>寄送測試信</button><button class="btn primary" id="rfMailSend" '+(connected?'':'disabled')+'>立即寄出</button><div class="rf-mail-schedule-box"><input class="input" id="rfMailScheduleAt" type="datetime-local"><button class="btn primary" id="rfMailSchedule" '+(connected?'':'disabled')+'>排程寄出</button></div></div></section>'+
 '<section class="section"><div class="row" style="justify-content:space-between;align-items:center"><div><h3 style="margin:0">Gmail 待寄排程</h3><div class="muted tiny">系統會向 Gmail Apps Script 同步真正仍在等待的排程。</div></div><button class="btn" id="rfMailRefreshSchedule" '+(connected?'':'disabled')+'>重新同步</button></div><div id="rfMailSchedules" style="margin-top:12px">'+(connected?'<div class="muted">正在同步…</div>':'<div class="empty">完成 Gmail 串接後即可查看排程。</div>')+'</div></section>'+
 '<section class="section"><h3>系統操作紀錄</h3>'+history+'</section>');

 document.getElementById('rfGmailCopyScript').onclick=copyScript;document.getElementById('rfGmailGenerate').onclick=genKey;document.getElementById('rfGmailCopyKey').onclick=copyKey;document.getElementById('rfGmailSave').onclick=saveGmailConfig;document.getElementById('rfGmailClear')?.addEventListener('click',clearGmail);
 document.getElementById('rfMailSaveSettings').onclick=saveSettings;document.getElementById('rfMailPreviewBtn').onclick=previewRecipients;document.getElementById('rfMailSaveTemplate').onclick=saveTemplate;document.getElementById('rfMailTemplate').onchange=e=>{const t=templates[Number(e.target.value)];if(t)applyTemplate(t)};
 document.getElementById('rfMailDraft').onclick=()=>runMail('createDraft');document.getElementById('rfMailTest').onclick=()=>runMail('sendNow',true);document.getElementById('rfMailSend').onclick=()=>runMail('sendNow');document.getElementById('rfMailSchedule').onclick=()=>runMail('schedule');document.getElementById('rfMailRefreshSchedule').onclick=loadSchedules;
 recipients=[];if(connected)loadSchedules();
};
})();