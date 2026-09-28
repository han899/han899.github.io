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
async function openWork(id){
 if(!isSystemAdmin())return R.toast('僅限專案管理員檢視作品全文');
 const {data,error}=await sb.rpc('get_admin_review_work',{p_project:s.project.id,p_submission:id});
 if(error)return R.toast(error.message);
 const x=Array.isArray(data)?data[0]:data;if(!x)return R.toast('找不到可檢視的正式作品');
 const text=[
   '組別：'+(x.group_name||''),
   '匿名編號：'+(x.anonymous_code||''),
   '類別：'+(x.category||''),
   '作品名稱：'+(x.title||''),
   '字數：'+(x.char_count??'—'),
   '',
   x.body||''
 ].join('\n');
 const md=R.modal('<div class="rf-admin-work-head"><div><div class="rf4-statusline">'+R.badge(x.group_name||'')+R.badge(x.anonymous_code||'')+R.badge(x.category||'')+'</div><h2>'+R.esc(x.title||'未命名作品')+'</h2><div class="muted">字數 '+R.esc(x.char_count??'—')+'｜句號 '+R.esc(x.period_count??'—')+'｜標點 '+R.esc(x.punctuation_count??'—')+'</div></div><div class="rf4-actions"><button class="btn" id="rfAdminWorkDownload">下載此作品 TXT</button><button class="btn" id="rfAdminWorkClose">關閉</button></div></div><article class="rf-final-work-body">'+R.esc(x.body||'').replace(/\n/g,'<br>')+'</article>');
 md.querySelector('#rfAdminWorkClose').onclick=R.closeModal;
 md.querySelector('#rfAdminWorkDownload').onclick=()=>saveBlob(new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'}),safeName(x.group_name)+'_'+safeName(x.anonymous_code)+'_'+safeName(x.title)+'.txt');
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