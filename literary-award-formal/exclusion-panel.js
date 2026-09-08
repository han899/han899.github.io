'use strict';
(function(){
  const SUPABASE_URL='https://ppdrsoltvqiqnbnlimbb.supabase.co';
  const SUPABASE_KEY='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,storage:window.sessionStorage,autoRefreshToken:true,detectSessionInUrl:true}});
  function projectId(){const p=(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);return p[0]==='project'&&p[1]?p[1]:null}
  function onSubmissionPage(){const p=(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);return p[0]==='project'&&p[2]==='submissions'}
  function label(code){return code==='TEXT_LIMIT'?'文字字數超過':code==='DUPLICATE_OLD'?'重複投稿－舊件':code||'其他'}
  async function render(){
    if(!onSubmissionPage())return;
    const pid=projectId();if(!pid)return;
    await new Promise(r=>setTimeout(r,450));
    const main=document.querySelector('.main');if(!main)return;
    document.getElementById('exclusionPanel')?.remove();
    const {data,error}=await client.from('submissions').select('id,anonymous_code,group_name,title,char_count,punctuation_count,period_count,exclusion_code,exclusion_reason,exclusion_details,submitted_at,submission_private(student_name)').eq('project_id',pid).eq('status','excluded').order('group_name').order('anonymous_code');
    const section=document.createElement('section');section.className='section';section.id='exclusionPanel';
    if(error){section.innerHTML=`<h2>剔除清單與原因</h2><div class="danger-note">${esc(error.message)}</div>`;main.appendChild(section);return}
    const rows=data||[];
    const textLimit=rows.filter(x=>x.exclusion_code==='TEXT_LIMIT').length,dups=rows.filter(x=>x.exclusion_code==='DUPLICATE_OLD').length;
    section.innerHTML=`<div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><h2>剔除清單與原因</h2><p class="muted">所有剔除作品都保留完整原因；重複投稿舊件會標明投稿次序與保留的最新稿。</p></div><div class="row"><span class="badge bad">剔除 ${rows.length}</span><span class="badge warn">文字超限 ${textLimit}</span><span class="badge">重複舊件 ${dups}</span></div></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>編號</th><th>姓名</th><th>組別</th><th>作品</th><th>文字字數</th><th>標點</th><th>剔除類型</th><th>完整原因</th><th>保留最新稿</th></tr></thead><tbody>${rows.map(x=>{const p=Array.isArray(x.submission_private)?x.submission_private[0]:x.submission_private;const d=x.exclusion_details||{};return`<tr><td>${esc(x.anonymous_code)}</td><td>${esc(p?.student_name||'')}</td><td>${esc(x.group_name)}</td><td>${esc(x.title)}</td><td>${x.char_count??0}</td><td>${x.punctuation_count??0}</td><td><span class="badge ${x.exclusion_code==='TEXT_LIMIT'?'warn':'bad'}">${esc(label(x.exclusion_code))}</span></td><td style="min-width:320px">${esc(x.exclusion_reason||'—')}</td><td>${x.exclusion_code==='DUPLICATE_OLD'?`第 ${esc(d.attempt_total||'—')} 次／${esc(d.kept_anonymous_code||'—')}`:'—'}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">目前沒有剔除作品。</div>'}`;
    main.appendChild(section);
  }
  window.addEventListener('hashchange',render);
  const observer=new MutationObserver(()=>{if(onSubmissionPage()&&!document.getElementById('exclusionPanel'))render()});observer.observe(document.body,{childList:true,subtree:true});
  render();
})();