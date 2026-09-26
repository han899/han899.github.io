'use strict';
(function(){
const R=window.RF4;if(!R)return;const {sb,s}=R;
const APIKEY='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
const ENDPOINT='https://ppdrsoltvqiqnbnlimbb.supabase.co/functions/v1/send-project-email';
const GROUPS=['','小學組','國中組','高中職組'];
let recipients=[],service={configured:false,provider:'尚未連接'};

const isSystemAdmin=()=>s.profile?.platform_role==='platform_admin'||s.role==='platform_admin';
const v=id=>document.getElementById(id)?.value||'';
const escCsv=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
async function serviceStatus(){
 try{
  const {data:{session}}=await sb.auth.getSession();
  const r=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify({action:'status'})});
  service=await r.json();if(!r.ok)throw new Error(service.error||'服務狀態讀取失敗');return service;
 }catch(e){service={configured:false,provider:'尚未連接',error:e.message};return service}
}
async function callSend(payload){
 const {data:{session}}=await sb.auth.getSession();
 const r=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const out=await r.json().catch(()=>({}));if(!r.ok)throw new Error(out.error||'寄送失敗');return out;
}
function varsFor(x){return{
 name:x.recipient_name||'',student_name:x.recipient_name||'',group_name:x.group_name||'',title:x.title||'',
 final_position:x.final_position||'',award_name:x.award_name||'',anonymous_code:x.anonymous_code||''
}}
function selected(){
 return [...document.querySelectorAll('[data-mail-recipient]:checked')].map(x=>recipients[Number(x.dataset.mailRecipient)]).filter(Boolean)
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
 host.innerHTML='<div class="rf-mail-recipient-head"><div><b>實際收件人 '+recipients.length+' 位</b><div class="muted tiny">正式寄送前可逐一取消勾選。</div></div><div class="rf4-actions"><button class="btn" id="rfMailAll">全選</button><button class="btn" id="rfMailNone">全不選</button><button class="btn" id="rfMailCsv">下載收件人 CSV</button></div></div><div class="table-wrap"><table><thead><tr><th>寄送</th><th>姓名</th><th>Email</th><th>組別</th><th>作品／身分</th><th>最終結果</th></tr></thead><tbody>'+recipients.map((x,i)=>'<tr><td><input type="checkbox" checked data-mail-recipient="'+i+'"></td><td>'+R.esc(x.recipient_name||'—')+'</td><td>'+R.esc(x.recipient_email)+'</td><td>'+R.esc(x.group_name||'—')+'</td><td>'+R.esc(x.title||x.recipient_type||'—')+'</td><td>'+R.esc(x.award_name?x.award_name+'（#'+x.final_position+'）':'—')+'</td></tr>').join('')+'</tbody></table></div>';
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
async function send(testMode){
 if(!service.configured)return R.toast('寄信服務尚未安全連線，目前不會送出郵件');
 const list=selected();if(!list.length)return R.toast('請至少勾選一位收件人');
 const subject=v('rfMailSubject').trim(),body=v('rfMailBody').trim();if(!subject||!body)return R.toast('請輸入郵件主旨與內容');
 let payloadList=list;
 if(testMode){
   const mail=prompt('測試信要寄到哪個 Email？',s.profile?.email||'');if(!mail)return;
   const sample=list[0];payloadList=[{...sample,recipient_email:mail,recipient_name:s.profile?.display_name||'系統管理員'}];
 }else if(!confirm('確定正式寄出 '+list.length+' 封郵件嗎？\n\n請確認收件人、主旨與內容都已核對完成。'))return;
 const btn=document.getElementById(testMode?'rfMailTest':'rfMailSend');btn.disabled=true;btn.textContent=testMode?'寄送測試中…':'正式寄送中…';
 try{
   let sent=0,failed=0;
   for(let i=0;i<payloadList.length;i+=50){
    const chunk=payloadList.slice(i,i+50).map(x=>({email:x.recipient_email,name:x.recipient_name,type:x.recipient_type,submission_id:x.submission_id,variables:varsFor(x)}));
    const out=await callSend({action:'send',project_id:s.project.id,audience_type:v('rfMailAudience'),group_name:v('rfMailGroup')||null,contact_field:v('rfMailContact'),subject_template:subject,body_template:body,test_mode:testMode,recipients:chunk});
    sent+=Number(out.sent||0);failed+=Number(out.failed||0);
   }
   R.toast((testMode?'測試信':'正式郵件')+'完成：成功 '+sent+'、失敗 '+failed);await R.pages.emailCenter();
 }catch(e){R.toast(e.message||String(e))}
 finally{btn.disabled=false;btn.textContent=testMode?'寄送測試信':'正式寄出'}
}
function applyTemplate(t){
 document.getElementById('rfMailSubject').value=t.subject_template||'';
 document.getElementById('rfMailBody').value=t.body_template||'';
 document.getElementById('rfMailAudience').value=t.audience_type||'custom';
}
R.pages.emailCenter=async function(){
 if(!isSystemAdmin())return R.setMain('<section class="section"><div class="danger-note">僅限平台系統管理員使用郵件中心。</div></section>');
 const [statusRes,settingsRes,templatesRes,batchesRes]=await Promise.all([
   serviceStatus(),
   sb.from('project_email_settings').select('*').eq('project_id',s.project.id).maybeSingle(),
   sb.from('email_templates').select('*').eq('project_id',s.project.id).eq('is_active',true).order('updated_at',{ascending:false}),
   sb.from('email_batches').select('*').eq('project_id',s.project.id).order('created_at',{ascending:false}).limit(20)
 ]);
 const settings=settingsRes.data||{},templates=templatesRes.data||[],batches=batchesRes.data||[];
 const serviceHtml=statusRes.configured?'<div class="rf4-banner good"><b>寄信服務已連線</b><br>供應商：'+R.esc(statusRes.provider||'Email Provider')+'</div>':'<div class="rf4-banner warn"><b>寄信服務尚未安全連線</b><br>目前可以完成收件名單、範本、預覽與設定，但正式寄送會被鎖住，不會假裝寄信成功。</div>';
 const tplOptions='<option value="">選擇已存範本…</option>'+templates.map((t,i)=>'<option value="'+i+'">'+R.esc(t.name)+'</option>').join('');
 const history=batches.length?'<div class="table-wrap"><table><thead><tr><th>時間</th><th>對象</th><th>組別</th><th>封數</th><th>狀態</th><th>測試</th></tr></thead><tbody>'+batches.map(x=>'<tr><td>'+R.fmt(x.created_at)+'</td><td>'+R.esc(x.audience_type)+'</td><td>'+R.esc(x.group_name||'全部')+'</td><td>'+x.recipient_count+'</td><td>'+R.esc(x.status)+'</td><td>'+(x.test_mode?'是':'否')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">尚無寄送紀錄。</div>';
 R.setMain('<section class="section"><div class="rf-final-title"><div><div class="badge purple">系統管理員專用</div><h2>郵件中心</h2><p class="muted">從競賽資料直接建立收件名單；正式寄出前先預覽、可逐筆取消、也可先寄測試信。</p></div></div>'+serviceHtml+'</section>'+
 '<section class="section"><h3>寄件設定</h3><div class="split"><div><label class="label">寄件顯示名稱</label><input class="input" id="rfMailSenderName" value="'+R.esc(settings.sender_name||s.project.name||'')+'"></div><div><label class="label">回覆信箱 Reply-To</label><input class="input" id="rfMailReplyTo" type="email" value="'+R.esc(settings.reply_to||'')+'"></div></div><button class="btn" id="rfMailSaveSettings" style="margin-top:12px">儲存設定</button></section>'+
 '<section class="section"><h3>1. 選擇收件人</h3><div class="filters"><select class="select" id="rfMailAudience"><option value="winners">最終得獎者</option><option value="finalists">第二輪入圍者</option><option value="all_formal">所有正式投稿者</option><option value="judges">目前啟用中的評審</option></select><select class="select" id="rfMailGroup"><option value="">全部組別</option><option>小學組</option><option>國中組</option><option>高中職組</option></select><select class="select" id="rfMailContact"><option value="auto">自動選擇聯絡信箱</option><option value="submission_email">報名 Email</option><option value="parent_email">家長 Email</option><option value="student_email">學生 Email</option><option value="adviser_email">指導老師 Email</option></select><button class="btn primary" id="rfMailPreviewBtn">載入／更新收件名單</button></div><div id="rfMailRecipients" style="margin-top:14px"><div class="empty">先選擇寄送對象，再載入實際收件名單。</div></div></section>'+
 '<section class="section"><h3>2. 編輯郵件</h3><div class="row" style="gap:8px;flex-wrap:wrap"><select class="select" id="rfMailTemplate">'+tplOptions+'</select><button class="btn" id="rfMailSaveTemplate">另存為範本</button></div><div class="rf-mail-vars"><b>可用變數：</b> {{project_name}}、{{name}}、{{student_name}}、{{group_name}}、{{title}}、{{final_position}}、{{award_name}}、{{anonymous_code}}</div><label class="label">郵件主旨</label><input class="input" id="rfMailSubject" placeholder="例如：{{project_name}}－{{award_name}}通知"><label class="label">郵件內容</label><textarea class="input rf-mail-body" id="rfMailBody" rows="12" placeholder="您好 {{student_name}}：&#10;&#10;恭喜您的作品「{{title}}」…"></textarea><div class="rf4-actions" style="margin-top:12px"><button class="btn" id="rfMailTest" '+(service.configured?'':'disabled')+'>寄送測試信</button><button class="btn primary" id="rfMailSend" '+(service.configured?'':'disabled')+'>正式寄出</button></div></section>'+
 '<section class="section"><h3>寄送紀錄</h3>'+history+'</section>');
 document.getElementById('rfMailSaveSettings').onclick=saveSettings;
 document.getElementById('rfMailPreviewBtn').onclick=previewRecipients;
 document.getElementById('rfMailSaveTemplate').onclick=saveTemplate;
 document.getElementById('rfMailTest').onclick=()=>send(true);
 document.getElementById('rfMailSend').onclick=()=>send(false);
 document.getElementById('rfMailTemplate').onchange=e=>{const t=templates[Number(e.target.value)];if(t)applyTemplate(t)};
 recipients=[];
};
})();