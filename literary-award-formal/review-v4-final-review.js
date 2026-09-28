'use strict';
(function(){
const R=window.RF4;if(!R)return;const {sb,s}=R;
const GROUPS=['小學組','國中組','高中職組'];
let dirty=false,sortable=null;

const isSystemAdmin=()=>['platform_admin','project_admin'].includes(s.role);
const gRoute=()=>{const r=R.route();return GROUPS.includes(r?.group)?r.group:(GROUPS.includes(s.group)?s.group:GROUPS[0])};
const gotoGroup=g=>location.hash='#project/'+s.project.id+'/finalReview/'+encodeURIComponent(g);

async function loadSortable(){
 if(window.Sortable)return true;
 await new Promise((ok,no)=>{const x=document.createElement('script');x.src='https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js';x.onload=ok;x.onerror=no;document.head.appendChild(x)});
 return !!window.Sortable;
}
async function loadXlsx(){
 if(window.XLSX)return true;
 await new Promise((ok,no)=>{const x=document.createElement('script');x.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';x.onload=ok;x.onerror=no;document.head.appendChild(x)});
 return !!window.XLSX;
}
function awardBadge(name){return name?R.badge(name,name==='第一名'?'good':name==='佳作'?'':'purple'):''}
function renumber(){
 document.querySelectorAll('.rf-final-card').forEach((c,i)=>{
   const n=c.querySelector('.rf-final-position');if(n)n.textContent=String(i+1);
 });
 dirty=true;
 const save=document.getElementById('rfFinalSave');if(save){save.disabled=false;save.textContent='儲存目前排序 *'}
 const confirmBtn=document.getElementById('rfFinalConfirm');if(confirmBtn)confirmBtn.disabled=true;
}
function openWork(row){
 const m=R.modal('<div class="rf-final-modal-head"><div><div class="badge">'+R.esc(row.group_name||gRoute())+'</div><h2>'+R.esc(row.title||'未命名作品')+'</h2><div class="muted">'+R.esc(row.anonymous_code||'')+'｜原第二輪名次 '+R.esc(row.base_overall_rank)+'｜名次加總 '+R.esc(row.rank_sum??'—')+'｜總分 '+R.esc(row.score_sum??'—')+'</div></div><button class="btn" id="rfFinalClose">關閉</button></div><article class="rf-final-work-body">'+R.esc(row.body||'').replace(/\n/g,'<br>')+'</article>');
 m.querySelector('#rfFinalClose').onclick=R.closeModal;
}
async function fetchRows(group){
 let {data,error}=await sb.rpc('get_final_review_rows',{p_project:s.project.id,p_group:group});
 if(error)throw error;
 if((data||[]).length)return data;
 const {data:rc}=await sb.from('result_confirmations').select('project_id').eq('project_id',s.project.id).eq('group_name',group).maybeSingle();
 if(!rc)return [];
 const init=await sb.rpc('initialize_final_review',{p_project:s.project.id,p_group:group,p_reset:false});
 if(init.error)throw init.error;
 const q=await sb.rpc('get_final_review_rows',{p_project:s.project.id,p_group:group});
 if(q.error)throw q.error;return q.data||[];
}
async function saveOrder(group){
 const ids=[...document.querySelectorAll('.rf-final-card')].map(x=>x.dataset.id);
 if(!ids.length)return;
 const b=document.getElementById('rfFinalSave');b.disabled=true;b.textContent='儲存中…';
 const {error}=await sb.rpc('set_final_review_order',{p_project:s.project.id,p_group:group,p_order:ids});
 if(error){R.toast(error.message);b.disabled=false;return}
 dirty=false;R.toast('最終評比排序已儲存');await R.pages.finalReview();
}
async function confirmFinal(group){
 if(dirty)return R.toast('請先儲存目前排序');
 if(!confirm('確定要確認「'+group+'」最終名次嗎？\n\n確認後，得獎名單會依這份最終排序同步更新。'))return;
 const b=document.getElementById('rfFinalConfirm');b.disabled=true;b.textContent='確認中…';
 const {data,error}=await sb.rpc('confirm_final_review',{p_project:s.project.id,p_group:group});
 if(error){R.toast(error.message);b.disabled=false;b.textContent='確認最終名次';return}
 R.toast('已確認 '+group+' 最終名次，共 '+data+' 份作品');await R.pages.finalReview();
}
async function resetOrder(group){
 if(!confirm('要把「'+group+'」全部重設回第二輪原始排序嗎？\n\n目前尚未確認的拖拉調整會被覆蓋。'))return;
 const {error}=await sb.rpc('initialize_final_review',{p_project:s.project.id,p_group:group,p_reset:true});
 if(error)return R.toast(error.message);
 dirty=false;R.toast('已重設為第二輪原始排序');await R.pages.finalReview();
}
async function exportWorkbook(){
 const btn=document.getElementById('rfFinalExport');btn.disabled=true;btn.textContent='產生 Excel…';
 try{
  const {data,error}=await sb.rpc('get_final_review_export',{p_project:s.project.id});
  if(error)throw error;if(!data?.length)throw new Error('目前沒有已確認的最終評比可匯出');
  if(!(await loadXlsx()))throw new Error('Excel 元件載入失敗');
  const rows=data.map(x=>({
   '組別':x.group_name,'最終名次':x.final_position,'獎項':x.award_name||'',
   '第二輪預設排序':x.base_position,'第二輪原始名次':x.base_overall_rank,
   '評審名次加總':x.rank_sum,'評審總分加總':x.score_sum,'評審平均分':x.score_average,
   '匿名編號':x.anonymous_code,'類別':x.category,'學生姓名':x.student_name,'學校':x.school,'班級':x.class_name,
   '作品名稱':x.title,'作品內容':x.body,'出版社':x.publisher,'科目一':x.subject_1,'科目二':x.subject_2,
   '報名Email':x.submission_email,'學生電話':x.student_phone,'學生Email':x.student_email,
   '家長姓名':x.parent_name,'家長電話':x.parent_phone,'家長Email':x.parent_email,
   '指導老師':x.adviser_name,'指導老師電話':x.adviser_phone,'指導老師Email':x.adviser_email,
   '投稿字數':x.char_count,'句號數':x.period_count,'標點數':x.punctuation_count,'電子報意願':x.newsletter_opt_in,'著作授權同意':x.copyright_consent,'原創聲明':x.originality_declaration,'最終確認內容':x.final_confirmation,'人工審查備註':x.manual_review_note,'來源原始檔':x.source_filename,'投稿時間':x.submitted_at?new Date(x.submitted_at).toLocaleString('zh-TW',{hour12:false}):''
  }));
  const wb=XLSX.utils.book_new();
  const make=(name,list)=>{
    const ws=XLSX.utils.json_to_sheet(list);ws['!autofilter']={ref:ws['!ref']||'A1:A1'};
    ws['!cols']=Object.keys(list[0]||{}).map(k=>({wch:Math.min(Math.max(k.length+4,12),k==='作品內容'?70:26)}));
    XLSX.utils.book_append_sheet(wb,ws,name);
  };
  make('完整最終名單',rows);
  make('公告與得獎名單',rows.filter(x=>x['獎項']).map(x=>({
    '組別':x['組別'],'獎項':x['獎項'],'最終名次':x['最終名次'],'學生姓名':x['學生姓名'],
    '學校':x['學校'],'班級':x['班級'],'作品名稱':x['作品名稱']
  })));
  GROUPS.forEach(g=>{const list=rows.filter(x=>x['組別']===g);if(list.length)make(g,list)});
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  const file=(s.project.name||'競賽')+'_最終評比總名單_'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'.xlsx';
  XLSX.writeFile(wb,file);
 }catch(e){R.toast(e.message||String(e))}
 finally{btn.disabled=false;btn.textContent='匯出完整 Excel 總名單'}
}

R.pages.finalReview=async function(){
 if(!isSystemAdmin())return R.setMain('<section class="section"><div class="danger-note">僅限專案管理員進入最終審查評比。</div></section>');
 const group=gRoute();s.group=group;dirty=false;
 const {data:round2Confirm}=await sb.from('result_confirmations').select('confirmed_at').eq('project_id',s.project.id).eq('group_name',group).maybeSingle();
 let rows=[],loadError='';
 try{rows=await fetchRows(group)}catch(e){loadError=e.message||String(e)}
 const confirmed=!!rows.find(x=>x.confirmed);
 const confirmedAt=rows.find(x=>x.confirmed)?.confirmed_at;
 const tabs=GROUPS.map(g=>'<button class="btn '+(g===group?'primary':'')+'" data-final-group="'+R.esc(g)+'">'+R.esc(g)+'</button>').join('');
 const cards=rows.map(r=>'<article class="rf-final-card" data-id="'+r.submission_id+'"><div class="rf-final-drag" title="拖拉調整名次">⋮⋮</div><div class="rf-final-rankbox"><span>最終</span><strong>#<i class="rf-final-position">'+r.final_position+'</i></strong></div><div class="rf-final-card-main"><div class="rf4-statusline">'+awardBadge(r.award_name)+R.badge(r.anonymous_code||'')+R.badge(r.category||'')+'</div><h3>'+R.esc(r.title||'未命名作品')+'</h3><div class="rf-final-metrics"><span>第二輪預設排序 <b>#'+r.base_position+'</b></span><span>原始名次 <b>'+r.base_overall_rank+'</b></span><span>名次加總 <b>'+R.esc(r.rank_sum??'—')+'</b></span><span>總分 <b>'+R.esc(r.score_sum??'—')+'</b></span></div></div><button class="btn rf-final-open">閱讀全文</button></article>').join('');
 R.setMain('<section class="section"><div class="rf-final-title"><div><div class="badge purple">專案管理員專用</div><h2>最終審查評比</h2><p class="muted">以第二輪正式排名為預設順序。拖拉卡片可微調最終名次；第二輪原始排名與分數永遠保留，不會被覆蓋。</p></div><button class="btn primary" id="rfFinalExport">匯出完整 Excel 總名單</button></div><div class="filters rf4-group-tabs">'+tabs+'</div>'+(window.RF4AdminWorks?.downloadButtons?.('final_ranked',group)||'')+'</section>'+
 '<section class="section">'+
 (!round2Confirm?'<div class="rf4-banner warn"><b>'+R.esc(group)+' 第二輪尚未正式確認。</b><br>請先到「第二輪成績」確認排名，之後才能進行最終審查。</div>':'')+
 (loadError?'<div class="danger-note">'+R.esc(loadError)+'</div>':'')+
 (confirmed?'<div class="rf4-banner good"><b>此組最終名次已確認</b><br>確認時間：'+R.fmt(confirmedAt)+'。若重新拖拉並儲存，系統會撤回確認並要求再次確認。</div>':'<div class="rf4-banner"><b>目前為最終審查草稿</b><br>調整後先儲存排序，再按「確認最終名次」。</div>')+
 (rows.length?'<div class="rf-final-toolbar"><div><b>'+R.esc(group)+'</b>｜共 '+rows.length+' 份第二輪評比作品</div><div class="rf4-actions"><button class="btn" id="rfFinalReset">重設為第二輪排名</button><button class="btn" id="rfFinalSave" disabled>排序已儲存</button><button class="btn primary" id="rfFinalConfirm" '+(confirmed?'disabled':'')+'>確認最終名次</button></div></div><div class="rf-final-list" id="rfFinalList">'+cards+'</div>':'<div class="empty">目前沒有可進行最終審查的作品。</div>')+
 '</section>');
 document.querySelectorAll('[data-final-group]').forEach(b=>b.onclick=()=>gotoGroup(b.dataset.finalGroup));
 document.getElementById('rfFinalExport').onclick=exportWorkbook;
 window.RF4AdminWorks?.bindDownloads?.();
 if(!rows.length)return;
 const byId=new Map(rows.map(x=>[x.submission_id,x]));
 document.querySelectorAll('.rf-final-open').forEach(b=>b.onclick=e=>{e.stopPropagation();openWork(byId.get(b.closest('.rf-final-card').dataset.id))});
 document.querySelectorAll('.rf-final-card').forEach(c=>c.onclick=e=>{if(e.target.closest('button,.rf-final-drag'))return;openWork(byId.get(c.dataset.id))});
 document.getElementById('rfFinalReset').onclick=()=>resetOrder(group);
 document.getElementById('rfFinalSave').onclick=()=>saveOrder(group);
 document.getElementById('rfFinalConfirm').onclick=()=>confirmFinal(group);
 if(await loadSortable()){
   sortable?.destroy?.();
   sortable=Sortable.create(document.getElementById('rfFinalList'),{animation:120,handle:'.rf-final-drag',ghostClass:'rf-final-ghost',onEnd:renumber});
 }
};
})();