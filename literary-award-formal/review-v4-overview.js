'use strict';
(function(){
const R=window.RF4;if(!R)return;const {sb,s}=R;
const GROUPS=['小學組','國中組','高中職組'];
const pct=(a,b)=>b>0?Math.max(0,Math.min(100,Math.round((Number(a)||0)/(Number(b)||1)*100))):0;
const link=(page,group='')=>'#project/'+s.project.id+'/'+page+(group?'/'+encodeURIComponent(group):'');
const progress=(done,total,cls='')=>'<div class="rf-overview-progress '+cls+'"><span style="width:'+pct(done,total)+'%"></span></div>';
const statusFor=g=>{
 if(g.final_confirmed)return{label:'最終審查完成',cls:'good'};
 if(g.r2_confirmed)return{label:'待最終審查',cls:'purple'};
 if(g.r2_required>0&&g.r2_submitted>=g.r2_required&&g.ranked>0)return{label:'第二輪待確認',cls:'warn'};
 if(g.finalists>0)return{label:'第二輪評分中',cls:''};
 if(g.r1_required>0&&g.r1_submitted>=g.r1_required)return{label:'第一輪完成',cls:'good'};
 if(g.formal>0)return{label:'第一輪進行中',cls:''};
 return{label:'準備中',cls:''};
};
const alertsFor=g=>{
 const a=[];
 if(g.pending>0)a.push({t:g.pending+' 份作品待人工確認',p:'submissions'});
 if(g.formal>0&&g.r1_required===0)a.push({t:'尚未指派第一輪採計評審',p:'people'});
 else if(g.r1_required>0&&g.r1_submitted<g.r1_required)a.push({t:'第一輪尚有 '+(g.r1_required-g.r1_submitted)+' 位評審未正式送出',p:'round1admin'});
 if(g.finalists>0&&g.r2_required===0)a.push({t:'已有入圍作品，但尚未指派第二輪採計評審',p:'people'});
 else if(g.r2_required>0&&g.r2_submitted<g.r2_required)a.push({t:'第二輪尚有 '+(g.r2_required-g.r2_submitted)+' 位評審未正式送出',p:'results'});
 else if(g.r2_required>0&&g.r2_submitted>=g.r2_required&&!g.r2_confirmed)a.push({t:'第二輪評審皆已送出，等待管理員確認排名',p:'results'});
 if(g.r2_confirmed&&!g.final_confirmed)a.push({t:'第二輪已確認，等待最終審查評比',p:'finalReview'});
 return a;
};

async function judgeOverview(){
 const [{data:as},{data:r1},{data:r2},{data:r1sent},{data:r2sent}]=await Promise.all([
  sb.from('judge_assignments').select('*').eq('project_id',s.project.id).eq('judge_user_id',s.user.id),
  sb.from('round1_judge_progress_view').select('*').eq('project_id',s.project.id).eq('judge_user_id',s.user.id),
  sb.from('round2_progress_view').select('*').eq('project_id',s.project.id).eq('judge_user_id',s.user.id),
  sb.from('round1_judge_submissions').select('group_name,submitted_at').eq('project_id',s.project.id).eq('judge_user_id',s.user.id),
  sb.from('round2_judge_submissions').select('group_name,submitted_at').eq('project_id',s.project.id).eq('judge_user_id',s.user.id)
 ]);
 const amap=new Map((as||[]).map(x=>[x.group_name,x])),r1m=new Map((r1||[]).map(x=>[x.group_name,x])),r2m=new Map((r2||[]).map(x=>[x.group_name,x]));
 const r1s=new Set((r1sent||[]).map(x=>x.group_name)),r2s=new Set((r2sent||[]).map(x=>x.group_name));
 const groups=R.sortGroups((as||[]).filter(x=>x.round1_enabled||x.round2_enabled).map(x=>x.group_name));
 const cards=groups.map(g=>{
   const a=amap.get(g)||{},x1=r1m.get(g)||{},x2=r2m.get(g)||{};
   const r1html=a.round1_enabled?'<div class="rf-overview-stage"><div class="rf-overview-stage-head"><b>第一輪</b>'+R.badge(r1s.has(g)?'已正式送出':(Number(x1.viewed_works||0)===Number(x1.total_works||0)&&Number(x1.total_works||0)>0?'可送出':'進行中'),r1s.has(g)?'good':'')+'</div><div class="rf-overview-stage-value">'+Number(x1.viewed_works||0)+' / '+Number(x1.total_works||0)+' <span>已閱讀</span></div>'+progress(x1.viewed_works,x1.total_works)+'</div>':'';
   const r2html=a.round2_enabled?'<div class="rf-overview-stage"><div class="rf-overview-stage-head"><b>第二輪</b>'+R.badge(r2s.has(g)?'已正式送出':'進行中',r2s.has(g)?'good':'')+'</div><div class="rf-overview-stage-value">'+Number(x2.completed_scores||0)+' / '+Number(x2.total_finalists||0)+' <span>已評分</span></div>'+progress(x2.completed_scores,x2.total_finalists)+'</div>':'';
   return '<article class="rf-overview-group-card"><div class="rf-overview-group-head"><div><h3>'+R.esc(g)+'</h3><div class="muted tiny">只顯示你被指派的審查任務</div></div></div>'+r1html+r2html+'<div class="rf-overview-actions">'+(a.round1_enabled?'<a class="btn" href="'+link('round1',g)+'">進入第一輪</a>':'')+(a.round2_enabled?'<a class="btn primary" href="'+link('round2',g)+'">進入第二輪</a>':'')+'</div></article>';
 }).join('');
 R.setMain('<section class="section"><div class="rf-overview-title"><div><h2>我的評審工作總覽</h2><p class="muted">快速確認各組、各輪目前完成進度。</p></div></div><div class="rf-overview-groups">'+(cards||'<div class="empty">目前沒有被指派的評審任務。</div>')+'</div></section>');
}

async function staffOverview(){
 const {data:rows,error}=await sb.from('submissions').select('group_name,status,exclusion_code,exclusion_reason').eq('project_id',s.project.id);
 if(error)throw error;
 const groups=GROUPS.map(g=>{
   const l=(rows||[]).filter(x=>x.group_name===g),formal=l.filter(x=>x.status==='formal'&&!x.exclusion_code&&!String(x.exclusion_reason||'').trim()).length,excluded=l.length-formal;
   return{group_name:g,total:l.length,formal,excluded};
 });
 R.setMain('<section class="section"><h2>專案總覽</h2><p class="muted">目前作品件數概況。</p><div class="rf-overview-groups">'+groups.map(g=>'<article class="rf-overview-group-card"><h3>'+g.group_name+'</h3><div class="rf-overview-mini-grid"><div><span>全部</span><b>'+g.total+'</b></div><div><span>正式</span><b>'+g.formal+'</b></div><div><span>剔除</span><b>'+g.excluded+'</b></div></div><div class="rf-overview-actions"><a class="btn primary" href="'+link('submissions')+'">作品管理</a></div></article>').join('')+'</div></section>');
}

const renderProjectOverview=async function(){
 if(s.role==='judge')return judgeOverview();
 if(s.role==='staff')return staffOverview();
 if(!R.isAdmin())return staffOverview();

 const request=sb.rpc('get_project_overview_dashboard',{p_project:s.project.id});
 const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('總覽資料連線逾時，請重新載入總覽。')),6000));
 const {data,error}=await Promise.race([request,timeout]);
 if(error)throw error;
 const d=data||{},groups=Array.isArray(d.groups)?d.groups:[],judges=Array.isArray(d.judges)?d.judges:[],t=d.totals||{};
 const alerts=groups.flatMap(g=>alertsFor(g).map(a=>({...a,group:g.group_name})));
 const r1Done=groups.reduce((n,g)=>n+Number(g.r1_submitted||0),0),r1Req=groups.reduce((n,g)=>n+Number(g.r1_required||0),0);
 const r2Done=groups.reduce((n,g)=>n+Number(g.r2_submitted||0),0),r2Req=groups.reduce((n,g)=>n+Number(g.r2_required||0),0);

 const kpis=[
  ['全部投稿',t.total_submissions||0,'本專案原始投稿總數'],
  ['正式作品',t.formal_submissions||0,'已通過初篩、可進評審'],
  ['已剔除',t.excluded_submissions||0,'不進入任何評審流程'],
  ['第二輪入圍',t.finalists||0,'目前有效入圍作品'],
  ['第一輪評審',r1Done+'/'+r1Req,'目前啟用且採計的正式送出進度'],
  ['第二輪評審',r2Done+'/'+r2Req,'目前啟用且採計的正式送出進度']
 ].map(x=>'<div class="rf-overview-kpi"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>').join('');

 const groupCards=groups.map(g=>{
  const st=statusFor(g),r1p=pct(g.r1_submitted,g.r1_required),r2p=pct(g.r2_submitted,g.r2_required);
  return '<article class="rf-overview-group-card">'+
   '<div class="rf-overview-group-head"><div><h3>'+R.esc(g.group_name)+'</h3><div class="muted tiny">投稿 '+g.total+' 份</div></div>'+R.badge(st.label,st.cls)+'</div>'+
   '<div class="rf-overview-mini-grid"><div><span>正式作品</span><b>'+g.formal+'</b></div><div><span>剔除</span><b>'+g.excluded+'</b></div><div><span>第二輪入圍</span><b>'+g.finalists+'</b></div></div>'+
   '<div class="rf-overview-stage"><div class="rf-overview-stage-head"><b>第一輪評審</b><span>'+g.r1_submitted+' / '+g.r1_required+' 位已送出</span></div>'+progress(g.r1_submitted,g.r1_required,r1p===100?'done':'')+'<div class="muted tiny">有票作品 '+g.positive_votes+' 份｜正式入圍 '+g.finalists+' 份</div></div>'+
   '<div class="rf-overview-stage"><div class="rf-overview-stage-head"><b>第二輪評審</b><span>'+g.r2_submitted+' / '+g.r2_required+' 位已送出</span></div>'+progress(g.r2_submitted,g.r2_required,r2p===100?'done':'')+'<div class="muted tiny">排名作品 '+g.ranked+' 份｜'+(g.r2_confirmed?'第二輪已確認':'第二輪未確認')+'</div></div>'+
   '<div class="rf-overview-final-row"><span>最終審查</span>'+(g.final_confirmed?R.badge('已確認','good'):R.badge('未確認'))+'<span class="muted tiny">得獎 '+g.awards+' 筆</span></div>'+
   '<div class="rf-overview-actions"><a class="btn" href="'+link('round1admin',g.group_name)+'">第一輪結果</a><a class="btn" href="'+link('results',g.group_name)+'">第二輪成績</a><a class="btn primary" href="'+link('finalReview',g.group_name)+'">最終審查</a></div>'+
  '</article>';
 }).join('');

 const alertHtml=alerts.length?'<section class="section"><div class="rf-overview-section-head"><div><h3>目前待處理</h3><p class="muted">依現況自動整理，完成後會從這裡消失。</p></div><span class="badge warn">'+alerts.length+' 項</span></div><div class="rf-overview-alerts">'+alerts.map(a=>'<a class="rf-overview-alert" href="'+link(a.p,a.p==='submissions'||a.p==='people'?'':a.group)+'"><b>'+R.esc(a.group)+'</b><span>'+R.esc(a.t)+'</span><i>前往處理 →</i></a>').join('')+'</div></section>':'<section class="section"><div class="rf4-banner good"><b>目前沒有需要立即處理的評審流程提醒。</b></div></section>';

 const activeJudges=judges.filter(j=>j.is_active&&j.results_included),hiddenJudges=judges.length-activeJudges.length;
 const judgeRows=activeJudges.map(j=>{
   const active=j.is_active&&j.results_included;
   const r1=j.round1_enabled?(j.r1_submitted?R.badge('已正式送出','good'):'<span><b>'+j.r1_viewed+'/'+j.r1_total+'</b> 已閱讀</span>'):'—';
   const r2=j.round2_enabled?(j.r2_submitted?R.badge('已正式送出','good'):'<span><b>'+j.r2_completed+'/'+j.r2_total+'</b> 已評分</span>'):'—';
   return '<tr><td>'+R.esc(j.group_name)+'</td><td><b>'+R.esc(j.display_name||j.email||'未命名評審')+'</b><br><span class="muted tiny">'+R.esc(j.email||'')+'</span></td><td>'+(j.is_active?R.badge(j.results_included?'啟用／採計':'啟用／不採計',j.results_included?'good':'warn'):R.badge('已停用',active?'':'bad'))+'</td><td>'+r1+'</td><td>'+r2+'</td></tr>';
 }).join('');

 R.setMain(
  '<section class="section"><div class="rf-overview-title"><div><div class="badge purple">管理儀表板</div><h2>專案總覽</h2><p class="muted">一頁掌握作品、第一輪、第二輪與最終審查的目前狀態。</p></div><div class="muted tiny">更新時間 '+R.fmt(d.generated_at)+'</div></div><div class="rf-overview-kpis">'+kpis+'</div></section>'+
  '<section class="section"><div class="rf-overview-section-head"><div><h3>各組評審進度</h3><p class="muted">固定依小學組 → 國中組 → 高中職組排列。</p></div><div class="rf4-actions"><a class="btn" href="'+link('people')+'">成員與權限</a><a class="btn" href="'+link('submissions')+'">作品管理</a></div></div><div class="rf-overview-groups">'+groupCards+'</div></section>'+
  alertHtml+
  '<section class="section"><div class="rf-overview-section-head"><div><h3>評審工作狀態</h3><p class="muted">只列目前啟用且採計的正式評審。'+(hiddenJudges>0?'另有 '+hiddenJudges+' 筆停用／不採計的歷史指派未列在此表。':'')+'</p></div><a class="btn" href="'+link('people')+'">管理評審</a></div>'+(judgeRows?'<div class="table-wrap"><table class="rf-overview-judge-table"><thead><tr><th>組別</th><th>評審</th><th>採計狀態</th><th>第一輪</th><th>第二輪</th></tr></thead><tbody>'+judgeRows+'</tbody></table></div>':'<div class="empty">目前尚未指派評審。</div>')+'</section>'
 );
};
R.overviewPage=renderProjectOverview;
R.pages.overview=renderProjectOverview;
})();