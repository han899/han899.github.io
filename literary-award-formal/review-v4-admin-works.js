'use strict';
(function(){
const R=window.RF4;if(!R)return;const {sb,s}=R;
const STAGES={
 round1_selected:{label:'第一輪入選作品',folder:'第一輪入選作品'},
 round2_ranked:{label:'第二輪排名作品',folder:'第二輪排名作品'},
 final_ranked:{label:'最終排名作品',folder:'最終排名作品'}
};
const isSystemAdmin=()=>['platform_admin','project_admin'].includes(s.role);

function safeName(v,max=80){
 let x=String(v??'').normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/\s+/g,' ').trim();
 x=x.replace(/[. ]+$/g,'');if(!x)x='未命名';return x.slice(0,max);
}
function pad(n){return String(Number(n)||0).padStart(3,'0')}
function csvCell(v){return '"'+String(v??'').replace(/"/g,'""').replace(/\r?\n/g,' ')+'"'}
function saveBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function loadZip(){
 if(window.JSZip)return window.JSZip;
 await new Promise((ok,no)=>{const x=document.createElement('script');x.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';x.onload=ok;x.onerror=()=>no(new Error('ZIP 元件載入失敗'));document.head.appendChild(x)});
 return window.JSZip;
}
function judgeLabel(member,uid){
 const p=member?.profiles||{};
 return p.display_name||p.email||uid||'評審';
}
function reviewFlowBadge(member){
 if(!member)return R.badge('評審資料未連結','warn');
 if(member.is_active===false&&member.results_included===true)return R.badge('停用但保留採計','warn');
 if(member.is_active===false)return R.badge('停用／不採計','bad');
 return member.results_included===true?R.badge('正式採計','good'):R.badge('不採計／留存','warn');
}
async function loadReviewBundle(id,group){
 const [membersQ,assignQ,r1Q,r1SentQ,scoresQ,r2SentQ,ranksQ]=await Promise.all([
  sb.from('project_members').select('user_id,role,is_active,results_included,profiles(display_name,email)').eq('project_id',s.project.id),
  sb.from('judge_assignments').select('*').eq('project_id',s.project.id).eq('group_name',group),
  sb.from('round1_reviews').select('*').eq('project_id',s.project.id).eq('submission_id',id),
  sb.from('round1_judge_submissions').select('*').eq('project_id',s.project.id).eq('group_name',group),
  sb.from('scores').select('*').eq('project_id',s.project.id).eq('submission_id',id),
  sb.from('round2_judge_submissions').select('*').eq('project_id',s.project.id).eq('group_name',group),
  sb.from('score_ranking_view').select('*').eq('project_id',s.project.id).eq('submission_id',id)
 ]);
 const failed=[membersQ,assignQ,r1Q,r1SentQ,scoresQ,r2SentQ,ranksQ].find(q=>q.error);
 if(failed?.error)throw failed.error;
 const members=membersQ.data||[],assignments=assignQ.data||[],r1=r1Q.data||[],scores=scoresQ.data||[],ranks=ranksQ.data||[];
 const mm=new Map(members.map(x=>[x.user_id,x])),am=new Map(assignments.map(x=>[x.judge_user_id,x])),r1m=new Map(r1.map(x=>[x.judge_user_id,x])),sm=new Map(scores.map(x=>[x.judge_user_id,x])),rankm=new Map(ranks.map(x=>[x.judge_user_id,x]));
 const r1Sent=new Map((r1SentQ.data||[]).map(x=>[x.judge_user_id,x])),r2Sent=new Map((r2SentQ.data||[]).map(x=>[x.judge_user_id,x]));
 const ids=new Set();
 assignments.forEach(a=>{if(a.round1_enabled||a.round2_enabled)ids.add(a.judge_user_id)});
 r1.forEach(x=>ids.add(x.judge_user_id));scores.forEach(x=>ids.add(x.judge_user_id));
 const judges=[...ids].map(uid=>({
  uid,member:mm.get(uid),assignment:am.get(uid),r1:r1m.get(uid),r1Submitted:r1Sent.get(uid),r2:sm.get(uid),r2Submitted:r2Sent.get(uid),rank:rankm.get(uid)
 })).sort((a,b)=>judgeLabel(a.member,a.uid).localeCompare(judgeLabel(b.member,b.uid),'zh-Hant'));
 return{judges};
}
function renderScoreItems(score){
 if(!score)return '<div class="rf-admin-empty-inline">尚未留下第二輪評分。</div>';
 const rules=Array.isArray(s.project.scoring_rules)?s.project.scoring_rules:[],vals=(score.score_values&&typeof score.score_values==='object')?score.score_values:{},used=new Set();
 const items=[];
 rules.forEach(c=>{
  used.add(c.code);
  items.push('<div class="rf-admin-score-item"><span>'+R.esc(c.label||c.code)+'</span><b>'+R.esc(vals[c.code]??'—')+' / '+R.esc(Number(c.max)||0)+'</b></div>');
 });
 Object.keys(vals).filter(k=>!used.has(k)).forEach(k=>items.push('<div class="rf-admin-score-item"><span>'+R.esc(k)+'</span><b>'+R.esc(vals[k]??'—')+'</b></div>'));
 return items.length?'<div class="rf-admin-score-grid">'+items.join('')+'</div>':'<div class="rf-admin-empty-inline">此評分沒有分項資料。</div>';
}
function renderReviewBundle(bundle){
 const judges=bundle?.judges||[];
 if(!judges.length)return '<div class="rf-admin-review-empty">目前沒有這篇作品的評審紀錄。</div>';
 const selected=judges.filter(j=>j.r1?.selected===true).length,scored=judges.filter(j=>j.r2).length,comments=judges.filter(j=>String(j.r2?.comment||'').trim()).length;
 const summary='<div class="rf-admin-review-summary"><div><span>相關評審</span><b>'+judges.length+'</b></div><div><span>第一輪入選票</span><b>'+selected+'</b></div><div><span>第二輪已有評分</span><b>'+scored+'</b></div><div><span>有文字評語</span><b>'+comments+'</b></div></div>';
 const cards=judges.map(j=>{
  const a=j.assignment||{},m=j.member||{},name=judgeLabel(m,j.uid),r1=j.r1,r2=j.r2;
  const roundTags=(a.round1_enabled||r1?R.badge('第一輪'):'')+(a.round2_enabled||r2?R.badge('第二輪','purple'):'');
  const r1Html=(a.round1_enabled||r1)?'<section class="rf-admin-review-round"><div class="rf-admin-round-head"><b>第一輪評比</b>'+(j.r1Submitted?R.badge('已正式送出','good'):R.badge('尚未正式送出','warn'))+'</div>'+(r1?'<div class="rf-admin-kv-grid"><div><span>閱讀狀態</span><b>'+(r1.viewed_at?'已閱讀':'未閱讀')+'</b></div><div><span>入選判定</span><b>'+(r1.selected?'✓ 選入':'未選入')+'</b></div><div><span>閱讀紀錄</span><b>'+R.esc(r1.viewed_at?R.fmt(r1.viewed_at):'—')+'</b></div><div><span>整組送出</span><b>'+R.esc(j.r1Submitted?.submitted_at?R.fmt(j.r1Submitted.submitted_at):'—')+'</b></div></div>':'<div class="rf-admin-empty-inline">此評審尚未留下第一輪紀錄。</div>')+'<p class="muted tiny rf-admin-round-note">第一輪現行流程採「閱讀＋選入／不選入」，沒有文字評語欄位。</p></section>':'';
  const r2Html=(a.round2_enabled||r2)?'<section class="rf-admin-review-round"><div class="rf-admin-round-head"><b>第二輪評比</b>'+(j.r2Submitted?R.badge('已正式送出','good'):r2?R.badge('已儲存／未正式送出','warn'):R.badge('尚未評分','warn'))+'</div>'+renderScoreItems(r2)+'<div class="rf-admin-r2-total"><span>總分</span><strong>'+R.esc(r2?.total_score??'—')+'</strong><span>個人正式名次</span><strong>'+(j.rank?.judge_rank?'第 '+R.esc(j.rank.judge_rank)+' 名':'—')+'</strong></div><div class="rf-admin-comment"><div class="muted tiny">評審評語</div><p>'+R.esc(String(r2?.comment||'').trim()||'未填評語').replace(/\n/g,'<br>')+'</p></div><div class="muted tiny rf-admin-review-time">最後更新：'+R.esc(r2?.updated_at?R.fmt(r2.updated_at):'—')+'｜整組送出：'+R.esc(j.r2Submitted?.submitted_at?R.fmt(j.r2Submitted.submitted_at):'—')+'</div></section>':'';
  return '<details class="rf-admin-review-card" open data-rf-review-card="'+R.esc(j.uid)+'"><summary><div><strong>'+R.esc(name)+'</strong><div class="rf4-statusline">'+reviewFlowBadge(m)+roundTags+'</div></div><div class="rf-admin-review-card-score">'+(r2?'<span>第二輪</span><b>'+R.esc(r2.total_score??'—')+'</b>':'<span>第二輪</span><b>—</b>')+'</div></summary><div class="rf-admin-review-card-body">'+r1Html+r2Html+'</div></details>';
 }).join('');
 return summary+'<div class="rf-admin-review-toolbar"><div><h3>所有評審評比內容</h3><p class="muted tiny">依評審分卡呈現，第一輪與第二輪分開，方便交叉比較。</p></div><div class="rf4-actions"><button class="btn" data-rf-review-toggle="1">全部展開</button><button class="btn" data-rf-review-toggle="0">全部收合</button></div></div>'+cards;
}
function bindReviewControls(root){
 root.querySelectorAll('[data-rf-review-toggle]').forEach(b=>b.onclick=()=>root.querySelectorAll('.rf-admin-review-card').forEach(d=>d.open=b.dataset.rfReviewToggle==='1'));
}
async function openWork(id,opts={}){
 if(!isSystemAdmin())return R.toast('僅限系統管理員與專案管理員檢視作品與評審內容');
 const md=R.modal('<div class="rf-admin-review-loading"><b>正在載入作品與完整評審紀錄…</b><div class="muted tiny">請稍候，系統正在整合第一輪、第二輪與評語內容。</div></div>');
 const modal=md.querySelector('.modal');modal?.classList.add('rf-admin-review-modal');
 const {data,error}=await sb.rpc('get_admin_review_work',{p_project:s.project.id,p_submission:id});
 if(error){
  modal.innerHTML='<div class="danger-note">'+R.esc(error.message)+'</div><button class="btn" id="rfAdminWorkClose">關閉</button>';
  modal.querySelector('#rfAdminWorkClose').onclick=R.closeModal;return;
 }
 const x=Array.isArray(data)?data[0]:data;
 if(!x){
  modal.innerHTML='<div class="danger-note">找不到可檢視的正式作品。</div><button class="btn" id="rfAdminWorkClose">關閉</button>';
  modal.querySelector('#rfAdminWorkClose').onclick=R.closeModal;return;
 }
 let reviewHtml='';
 try{reviewHtml=renderReviewBundle(await loadReviewBundle(id,x.group_name))}
 catch(e){reviewHtml='<div class="danger-note"><b>評審紀錄載入失敗</b><br>'+R.esc(e?.message||String(e))+'</div>'}
 const finalRow=opts?.finalRow;
 const finalMeta=finalRow?'<div class="rf-admin-final-meta"><span>目前最終排序 <b>#'+R.esc(finalRow.final_position??'—')+'</b></span><span>第二輪原始名次 <b>#'+R.esc(finalRow.base_overall_rank??'—')+'</b></span><span>名次加總 <b>'+R.esc(finalRow.rank_sum??'—')+'</b></span><span>總分加總 <b>'+R.esc(finalRow.score_sum??'—')+'</b></span><span>平均分 <b>'+R.esc(finalRow.score_average==null?'—':Number(finalRow.score_average).toFixed(2))+'</b></span></div>':'';
 const text=['組別：'+(x.group_name||''),'匿名編號：'+(x.anonymous_code||''),'類別：'+(x.category||''),'作品名稱：'+(x.title||''),'字數：'+(x.char_count??'—'),'',x.body||''].join('\n');
 modal.innerHTML='<div class="rf-admin-work-head"><div><div class="rf4-statusline">'+R.badge(x.group_name||'')+R.badge(x.anonymous_code||'')+R.badge(x.category||'')+'</div><h2>'+R.esc(x.title||'未命名作品')+'</h2><div class="muted">字數 '+R.esc(x.char_count??'—')+'｜句號 '+R.esc(x.period_count??'—')+'｜標點 '+R.esc(x.punctuation_count??'—')+'</div>'+finalMeta+'</div><div class="rf4-actions"><button class="btn" id="rfAdminWorkDownload">下載此作品 TXT</button><button class="btn" id="rfAdminWorkClose">關閉</button></div></div><div class="rf-admin-review-layout"><section class="rf-admin-reading-pane"><div class="rf-admin-pane-title"><b>作品全文</b><span class="muted tiny">獨立閱讀區</span></div><article class="rf-final-work-body">'+R.esc(x.body||'').replace(/\n/g,'<br>')+'</article></section><aside class="rf-admin-review-pane">'+reviewHtml+'</aside></div>';
 modal.querySelector('#rfAdminWorkClose').onclick=R.closeModal;
 modal.querySelector('#rfAdminWorkDownload').onclick=()=>saveBlob(new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'}),safeName(x.group_name)+'_'+safeName(x.anonymous_code)+'_'+safeName(x.title)+'.txt');
 bindReviewControls(modal);
}
async function downloadStage(stage,group=null,button=null){
 if(!isSystemAdmin())return R.toast('僅限專案管理員批次下載作品');
 const meta=STAGES[stage];if(!meta)return R.toast('未知的下載階段');
 const old=button?.textContent;if(button){button.disabled=true;button.textContent='整理作品中…'}
 try{
  const {data,error}=await sb.rpc('get_admin_stage_download_rows',{p_project:s.project.id,p_stage:stage,p_group:group||null});
  if(error)throw error;const rows=data||[];
  if(!rows.length)throw new Error(group?group+'目前沒有可下載的'+meta.label:'目前沒有可下載的'+meta.label);
  const JSZip=await loadZip(),zip=new JSZip();
  const root=zip.folder(safeName(s.project.name||'競賽')+'_'+meta.folder);
  const header=['組別','順序／名次','匿名編號','類別','作品名稱','第一輪票數','名次加總','總分加總','平均分','獎項'];
  const csv=[header.map(csvCell).join(',')];

  for(const x of rows){
    const rank=x.stage_rank||('');
    csv.push([x.group_name,rank,x.anonymous_code,x.category,x.title,x.selection_votes,x.rank_sum,x.score_sum,x.score_average,x.award_name].map(csvCell).join(','));
    const folder=root.folder(safeName(x.group_name||'未分組'));
    const filename=pad(x.stage_position)+'_'+safeName(x.anonymous_code||'無編號',30)+'_'+safeName(x.title||'未命名',70)+'.txt';
    const head=[
      meta.label,
      '組別：'+(x.group_name||''),
      '順序／名次：'+rank,
      '匿名編號：'+(x.anonymous_code||''),
      '類別：'+(x.category||''),
      '作品名稱：'+(x.title||'')
    ];
    if(stage==='round1_selected')head.push('第一輪有效票數：'+(x.selection_votes??'—'));
    if(stage!=='round1_selected'){
      head.push('評審名次加總：'+(x.rank_sum??'—'));
      head.push('評審總分加總：'+(x.score_sum??'—'));
      head.push('評審平均分：'+(x.score_average??'—'));
    }
    if(x.award_name)head.push('獎項：'+x.award_name);
    head.push('','────────────────────────','',x.body||'');
    folder.file(filename,'\ufeff'+head.join('\n'));
  }
  root.file('作品索引.csv','\ufeff'+csv.join('\r\n'));
  root.file('README.txt','\ufeff'+[
    '競賽：'+(s.project.name||''),
    '內容：'+meta.label,
    '組別：'+(group||'全部組別'),
    '作品數：'+rows.length,
    '產生時間：'+new Date().toLocaleString('zh-TW'),
    '',
    '注意：作品檔採匿名格式，不含學生姓名、電話、Email 等個人資料。',
    '完整個資與最終行政名單請使用系統的「匯出完整 Excel 總名單」。',
    stage==='round1_selected'?'第一輪檔名前的數字為下載整理順序，不代表正式名次。':''
  ].filter(Boolean).join('\n'));
  if(button)button.textContent='壓縮下載中…';
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  const suffix=group?'_'+safeName(group):'_全部組別';
  saveBlob(blob,safeName(s.project.name||'競賽')+'_'+meta.folder+suffix+'.zip');
  R.toast('已整理 '+rows.length+' 份'+meta.label);
 }catch(e){R.toast(e.message||String(e))}
 finally{if(button){button.disabled=false;button.textContent=old||'批次下載'}}
}
function downloadButtons(stage,group,opts={}){
 if(!isSystemAdmin())return '';
 const meta=STAGES[stage],showAll=opts.showAll!==false;
 return '<div class="rf-admin-download-actions"><span class="muted tiny">專案管理員專用</span><button class="btn" data-rf-admin-download="'+stage+'" data-rf-admin-group="'+R.esc(group||'')+'">下載'+R.esc(group||'本組')+' '+meta.label+' ZIP</button>'+(showAll?'<button class="btn" data-rf-admin-download="'+stage+'" data-rf-admin-group="">下載全部組別 '+meta.label+' ZIP</button>':'')+'</div>';
}
function bindDownloads(root=document){
 root.querySelectorAll?.('[data-rf-admin-download]').forEach(b=>{b.onclick=()=>downloadStage(b.dataset.rfAdminDownload,b.dataset.rfAdminGroup||null,b)});
 root.querySelectorAll?.('[data-rf-admin-work]').forEach(b=>{b.onclick=e=>{e.preventDefault();e.stopPropagation();openWork(b.dataset.rfAdminWork)}});
}
window.RF4AdminWorks={openWork,downloadStage,downloadButtons,bindDownloads,isSystemAdmin};
})();