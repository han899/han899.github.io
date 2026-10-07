'use strict';
(function(){
const M={};
const ANALYSIS_VERSION=2;
const state={rows:[],submissions:[],catalog:[],search:'',group:'',publisher:'',filter:'all'};
const uniq=a=>[...new Set((a||[]).map(x=>String(x||'').trim()).filter(Boolean))];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const splitList=s=>uniq(String(s||'').split(/[；;、,，\n]+/).map(x=>x.trim()));
const genericSubjects=new Set(['國文','國文科','國語','國語科','國語文','自然','自然科學','生物','英文','生活','語文領域','生命教育','科普閱讀','國語課本','第二類','cc']);
function normalizeLesson(v){
 let s=String(v||'').normalize('NFKC').trim().replace(/[《》〈〉「」『』<>]/g,'').replace(/^[：:：\-–—_\s]+|[：:：\-–—_\s]+$/g,'');
 s=s.replace(/^課文\s*/,'').replace(/^第[一二三四五六七八九十0-9]+課\s*/,'').trim();
 if(/再見[，,\s]*西沙/.test(s))s='再見，西莎';
 if(s==='再見西莎')s='再見，西莎';
 if(s==='安南小熊回家')s='南安小熊回家';
 return s.slice(0,60);
}
function lessonKey(v){
 return normalizeLesson(v).replace(/臺/g,'台').replace(/[\s、，,。．·:：;；_\-–—()（）【】]/g,'').toLowerCase();
}
function detectPublishers(raw){
 const t=String(raw||'').replace(/臺/g,'台').trim(),out=[];
 const add=x=>{if(!out.includes(x))out.push(x)};
 if(/翰林/.test(t))add('翰林');
 if(/康軒/.test(t))add('康軒');
 if(/南一/.test(t))add('南一');
 if(/龍騰/.test(t))add('龍騰');
 if(/三民/.test(t))add('三民');
 if(/東大/.test(t))add('東大');
 if(/幼獅/.test(t))add('幼獅');
 if(/新經典/.test(t))add('新經典');
 if(/童心幼教/.test(t))add('童心幼教');
 if(/窩窩/.test(t))add('窩窩');
 if(/教育部國民及學前教育署|國教署/.test(t))add('教育部國教署');
 if(out.length)return out;
 if(!t||/^(?:1|cc|我|不確定|不知道|無|沒有|none|n\/a)$/i.test(t))return [];
 let clean=t.replace(/^台北市[：:]?/,'').replace(/(?:出版事業股份有限公司|文教事業股份有限公司|書局企業股份有限公司|文化事業有限公司|圖書股份有限公司|文教事業有限公司|文化事業|出版社|出版|書局|文教集團|文教事業|文教|版)$/g,'').trim();
 if(clean&&clean.length<=16&&!/[、,.，。／/（）()]/.test(clean))add(clean);
 return out;
}
function addEvidence(map,name,source,excerpt,score=1){
 name=normalizeLesson(name);if(!name||name.length<2||genericSubjects.has(name)||/^第?[一二三四五六七八九十0-9]+課$/.test(name))return;
 if(/[。！？!?]/.test(name)||name.length>32)return;
 const bad=/^(?:我的|我們|動物|課文|文章|心得|閱讀|國文|國語|自然|英文|生活|這篇課文|這篇課文後|這篇課文時|讓我明白|最讓我難忘|責任|內容|這裡)$/;
 if(bad.test(name))return;
 const cur=map.get(name)||{name,score:0,evidence:[]};cur.score+=score;
 if(cur.evidence.length<4)cur.evidence.push({source,excerpt:String(excerpt||'').trim().slice(0,180)});
 map.set(name,cur);
}
function quoted(text,source,map,score=2){
 const s=String(text||'');let m;
 const regs=[/[〈《「『<]([^〉》」』>\n]{2,45})[〉》」』>]/g,/<<([^>\n]{2,45})>>/g];
 for(const re of regs)while((m=re.exec(s)))addEvidence(map,m[1],source,s.slice(Math.max(0,m.index-35),Math.min(s.length,re.lastIndex+35)),score);
}
function subjectCandidates(text,source,map){
 const s=String(text||'').trim();if(!s||genericSubjects.has(s))return;quoted(s,source,map,5);
 let m;
 if((m=s.match(/[_－—-]\s*([^_－—-]{2,40})$/)))addEvidence(map,m[1],source,s,5);
 if((m=s.match(/第[一二三四五六七八九十0-9]+課\s*([^\s]{2,40})/)))addEvidence(map,m[1],source,s,7);
 if((m=s.match(/[（(]([^）)]{2,40})[）)]/)))addEvidence(map,m[1],source,s,4);
 if((m=s.match(/(?:國文|國語|自然|英文|生物|生活)(?:科|課本|課文)?\s*[:：]?\s*([^\d\s][^\n]{1,35})$/))&&!genericSubjects.has(m[1].trim()))addEvidence(map,m[1],source,s,4);
}
function extractCandidates(r){
 const map=new Map(),raw=String(r.publisher||'');
 quoted(raw,'出版社欄',map,7);
 let m=raw.match(/[）)]\s*([^\n]{2,45})$/);
 if(m&&/[翰林康軒南一龍騰三民東大]|學年度|第.+課/.test(raw.slice(0,m.index+1)))addEvidence(map,m[1],'出版社欄',raw,9);
 subjectCandidates(r.subject_1,'科目欄 1',map);subjectCandidates(r.subject_2,'科目欄 2',map);
 quoted(r.title,'作品標題',map,3);
 const title=String(r.title||'');
 if((m=title.match(/讀[《〈「]?([^》〉」]{2,25})[》〉」]?(?:有感|心得|閱讀心得)/)))addEvidence(map,m[1],'作品標題',title,5);
 if((m=title.match(/^(.{2,25})閱讀心得$/)))addEvidence(map,m[1],'作品標題',title,5);
 const body=String(r.body||'');quoted(body,'作品內文',map,2);
 const keyRegs=[/(?:課文|選文|讀到|讀了|讀完|讀過)[「『《〈<]?([^」』》〉>，。；;\n]{2,28})/g];
 for(const re of keyRegs)while((m=re.exec(body)))addEvidence(map,m[1],'作品內文',body.slice(Math.max(0,m.index-28),Math.min(body.length,re.lastIndex+28)),3);
 return [...map.values()].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'zh-Hant')).slice(0,12);
}
function catalogTerms(item){
 return uniq([item.canonical_title,...(item.aliases||[])]).map(t=>({raw:t,key:lessonKey(t)})).filter(x=>x.key);
}
function escapeRegExp(v){return String(v).replace(/[.*+?^$()|[\]\\{}]/g,'\\$&')}
function verifyCatalogLessons(r,candidates,publishers){
 const fields=[
  {name:'出版社欄',text:String(r.publisher||''),strong:true},
  {name:'科目欄 1',text:String(r.subject_1||''),strong:true},
  {name:'科目欄 2',text:String(r.subject_2||''),strong:true},
  {name:'作品標題',text:String(r.title||''),strong:false},
  {name:'作品內文',text:String(r.body||''),strong:false}
 ];
 const verified=[],seen=new Set();
 for(const item of state.catalog){
  const terms=catalogTerms(item);let hit=null;
  for(const f of fields){
   const fk=lessonKey(f.text);
   for(const t of terms){
    if(!t.key)continue;
    const short=t.key.length<=2;let ok=fk.includes(t.key);
    if(ok&&short&&!f.strong){
      const rr=escapeRegExp(t.raw),raw=f.text;
      ok=new RegExp('[〈《「『]\\s*'+rr+'\\s*[〉》」』]').test(raw)
        ||new RegExp('(?:課文|第.{0,4}課|讀到|讀了|讀過).{0,8}'+rr).test(raw);
    }
    if(ok){hit={field:f.name,term:t.raw,excerpt:f.text.slice(0,220)};break}
   }
   if(hit)break;
  }
  if(!hit)continue;
  const required=item.publishers||[];
  const publisherMatch=!required.length||required.some(p=>publishers.includes(p));
  const generic=lessonKey(item.canonical_title).length<=2;
  if(generic&&!publisherMatch&&hit.field==='作品內文')continue;
  if(seen.has(item.canonical_title))continue;seen.add(item.canonical_title);
  verified.push({
   title:item.canonical_title,status:'verified',publisher_match:publisherMatch,
   source_label:item.source_label||'',source_url:item.source_url||'',
   grade_semester:item.grade_semester||'',lesson_label:item.lesson_label||'',
   matched_field:hit.field,matched_term:hit.term,excerpt:hit.excerpt
  });
 }
 const matchedKeys=new Set();
 for(const item of state.catalog){
   if(!verified.some(v=>v.title===item.canonical_title))continue;
   for(const t of catalogTerms(item))matchedKeys.add(t.key);
 }
 return{verified,candidates:candidates.filter(x=>!matchedKeys.has(lessonKey(x.name))).slice(0,6)};
}
function autoRecord(r){
 const publishers=detectPublishers(r.publisher),rawCandidates=extractCandidates(r),v=verifyCatalogLessons(r,rawCandidates,publishers);
 return{
  publishers,
  lesson_names:v.verified.map(x=>x.title),
  lesson_evidence:v.verified.map(x=>({name:x.title,source:x.matched_field,excerpt:x.excerpt})),
  lesson_candidates:v.candidates.map(x=>x.name),
  lesson_verification:v.verified
 };
}
function needsReview(x){
 return !!(x.lesson_candidates||[]).length&&!((x.lesson_names||[]).length);
}
async function loadCatalog(ctx){
 const {data,error}=await ctx.sb.from('lesson_reference_catalog').select('*').eq('active',true).order('canonical_title');
 if(error)throw error;state.catalog=data||[];
}
async function ensureRows(ctx,force=false){
 const {sb,S}=ctx;
 const {data:subs,error}=await sb.from('submissions').select('id,anonymous_code,group_name,category,publisher,subject_1,subject_2,title,body,status,exclusion_code,exclusion_reason').eq('project_id',S.project.id).order('submitted_at');
 if(error)throw error;
 const {data:reviews,error:re}=await sb.from('publisher_reference_reviews').select('*').eq('project_id',S.project.id);
 if(re)throw re;
 const byId=new Map((reviews||[]).map(x=>[x.submission_id,x])),up=[];
 for(const r of subs||[]){
   const old=byId.get(r.id);
   if(old?.review_status==='reviewed')continue;
   if(old&&!force&&Number(old.analysis_version)===ANALYSIS_VERSION)continue;
   const a=autoRecord(r);
   up.push({
    project_id:S.project.id,submission_id:r.id,publishers:a.publishers,
    lesson_names:a.lesson_names,lesson_evidence:a.lesson_evidence,
    lesson_candidates:a.lesson_candidates,lesson_verification:a.lesson_verification,
    analysis_version:ANALYSIS_VERSION,
    included:old?.included??true,excluded_reason:old?.excluded_reason||null,
    review_status:'auto',notes:old?.notes||null,updated_by:S.user.id,updated_at:new Date().toISOString()
   });
 }
 for(let i=0;i<up.length;i+=100){const {error:e}=await sb.from('publisher_reference_reviews').upsert(up.slice(i,i+100),{onConflict:'project_id,submission_id'});if(e)throw e}
 state.submissions=subs||[];
 return up.length;
}
async function loadRows(ctx){
 const {sb,S}=ctx;
 const [{data:subs,error:se},{data:reviews,error:re}]=await Promise.all([
   sb.from('submissions').select('id,anonymous_code,group_name,category,publisher,subject_1,subject_2,title,body,status,exclusion_code,exclusion_reason').eq('project_id',S.project.id).order('submitted_at'),
   sb.from('publisher_reference_reviews').select('*').eq('project_id',S.project.id)
 ]);
 if(se)throw se;if(re)throw re;
 const rm=new Map((reviews||[]).map(x=>[x.submission_id,x]));
 state.submissions=subs||[];
 state.rows=(subs||[]).map(s=>({...s,...(rm.get(s.id)||{publishers:[],lesson_names:[],lesson_evidence:[],lesson_candidates:[],lesson_verification:[],included:true,review_status:'auto',analysis_version:ANALYSIS_VERSION})}));
 return state.rows;
}
function summarize(rows){
 const pubs=new Map(),lessons=new Map();
 for(const r of rows){
   for(const p of r.publishers||[]){
     if(!pubs.has(p))pubs.set(p,{publisher:p,total:0,included:0,excluded:0,lessons:new Set()});
     const x=pubs.get(p);x.total++;r.included?x.included++:x.excluded++;
     if(r.included)for(const l of r.lesson_names||[]){x.lessons.add(l);const k=p+'\u0001'+l;lessons.set(k,{publisher:p,lesson:l,count:(lessons.get(k)?.count||0)+1})}
   }
 }
 return{
   pubs:[...pubs.values()].sort((a,b)=>b.included-a.included||b.total-a.total||a.publisher.localeCompare(b.publisher,'zh-Hant')),
   lessons:[...lessons.values()].sort((a,b)=>b.count-a.count||a.publisher.localeCompare(b.publisher,'zh-Hant')||a.lesson.localeCompare(b.lesson,'zh-Hant'))
 };
}
function filteredRows(){
 let a=[...state.rows];
 if(state.search){const q=state.search.toLowerCase();a=a.filter(r=>[r.anonymous_code,r.title,r.publisher,r.subject_1,r.subject_2,...(r.publishers||[]),...(r.lesson_names||[])].some(v=>String(v||'').toLowerCase().includes(q)))}
 if(state.group)a=a.filter(r=>r.group_name===state.group);
 if(state.publisher)a=a.filter(r=>(r.publishers||[]).includes(state.publisher));
 if(state.filter==='included')a=a.filter(r=>r.included);
 if(state.filter==='excluded')a=a.filter(r=>!r.included);
 if(state.filter==='review')a=a.filter(needsReview);
 return a;
}
function evidenceHtml(r){
 const e=Array.isArray(r.lesson_evidence)?r.lesson_evidence:[];
 if(!e.length)return '<span class="muted tiny">未找到明確課文線索</span>';
 return e.slice(0,3).map(x=>'<div class="publisher-evidence"><b>'+esc(x.name||'')+'</b><span>'+esc(x.source||'')+'</span><small>'+esc(x.excerpt||'')+'</small></div>').join('');
}
function publisherOptions(rows){
 return uniq(rows.flatMap(r=>r.publishers||[])).sort((a,b)=>a.localeCompare(b,'zh-Hant'));
}
function renderPage(ctx){
 const {shell}=ctx,rows=state.rows,summary=summarize(rows),shown=filteredRows(),pubOpts=publisherOptions(rows);
 const withPub=rows.filter(r=>String(r.publisher||'').trim()).length,included=rows.filter(r=>r.included).length,review=rows.filter(needsReview).length;
 const summaryRows=summary.pubs.map(x=>'<tr><td><b>'+esc(x.publisher)+'</b></td><td>'+x.total+'</td><td><b>'+x.included+'</b></td><td>'+x.excluded+'</td><td>'+x.lessons.size+'</td><td class="publisher-lessons">'+esc([...x.lessons].join('、')||'—')+'</td></tr>').join('');
 const cards=shown.map(r=>{
   const pub=(r.publishers||[]).map(x=>'<span class="badge">'+esc(x)+'</span>').join(' ')||'<span class="badge warn">未辨識</span>';
   const lessons=(r.lesson_names||[]).map(x=>'<span class="badge purple">'+esc(x)+'</span>').join(' ')||'<span class="muted">尚未辨識</span>';
   const warning=needsReview(r)?'<span class="badge warn">待確認</span>':r.review_status==='reviewed'?'<span class="badge good">已人工確認</span>':'<span class="badge">自動辨識</span>';
   return '<article class="publisher-review-card '+(r.included?'':'is-excluded')+'" data-pub-row="'+esc(r.id)+'"><div class="publisher-card-head"><div><div class="row">'+warning+' '+(r.included?'<span class="badge good">納入統計</span>':'<span class="badge bad">已排除</span>')+'</div><h4>'+esc(r.anonymous_code||'')+'｜'+esc(r.title||'（無作品名稱）')+'</h4><div class="muted tiny">'+esc(r.group_name||'')+'｜'+esc(r.category||'')+(r.status&&r.status!=='formal'?'｜作品狀態：'+esc(r.status):'')+'</div></div><div class="rf4-actions"><button class="btn" data-pub-edit="'+esc(r.id)+'">編輯辨識</button><button class="btn '+(r.included?'danger':'primary')+'" data-pub-toggle="'+esc(r.id)+'">'+(r.included?'排除不記錄':'恢復納入')+'</button></div></div>'+
   '<div class="publisher-review-grid"><div><label>原始出版社填答</label><div class="publisher-raw">'+esc(r.publisher||'—')+'</div></div><div><label>統一後出版社</label><div>'+pub+'</div></div><div><label>辨識課文名稱</label><div>'+lessons+'</div></div><div><label>科目欄</label><div>'+esc([r.subject_1,r.subject_2].filter(Boolean).join('｜')||'—')+'</div></div></div>'+
   '<details class="publisher-evidence-wrap"><summary>查看辨識依據與作品內容</summary>'+evidenceHtml(r)+'<div class="publisher-body">'+esc(r.body||'')+'</div></details>'+
   (!r.included&&r.excluded_reason?'<div class="danger-note tiny">排除原因：'+esc(r.excluded_reason)+'</div>':'')+'</article>';
 }).join('');
 shell('<section class="section"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:14px"><div><div class="badge purple">管理員統計工具</div><h2>出版社／引用課文統計</h2><p class="muted">自動合併出版社簡稱／全稱，並從出版社欄、科目欄、作品標題與內文辨識引用課文。此頁的排除只影響統計，不會變更投稿、評審或得獎狀態。</p></div><div class="rf4-actions"><button class="btn" id="pubReanalyze">重新分析未人工確認</button><button class="btn primary" id="pubExport">下載統計 Excel</button></div></div>'+
 '<div class="publisher-kpis"><div><b>'+rows.length+'</b><span>投稿筆數</span></div><div><b>'+withPub+'</b><span>有填出版社</span></div><div><b>'+included+'</b><span>目前納入統計</span></div><div><b>'+review+'</b><span>待人工確認</span></div></div></section>'+
 '<section class="section"><h3>出版社統計</h3><p class="muted tiny">「辨識筆數」含目前排除項目；「納入引用篇數」才是正式統計數。若一篇同時提到多家出版社，每家各計 1 篇。</p>'+(summary.pubs.length?'<div class="table-wrap"><table><thead><tr><th>出版社</th><th>辨識筆數</th><th>納入引用篇數</th><th>排除篇數</th><th>課文種類</th><th>辨識到的課文</th></tr></thead><tbody>'+summaryRows+'</tbody></table></div>':'<div class="empty">目前尚未辨識到出版社。</div>')+'</section>'+
 '<section class="section"><div class="publisher-filterbar"><input class="input" id="pubSearch" placeholder="搜尋編號、作品、出版社、課文…" value="'+esc(state.search)+'"><select class="select" id="pubGroup"><option value="">全部組別</option>'+['小學組','國中組','高中職組'].map(g=>'<option '+(state.group===g?'selected':'')+'>'+g+'</option>').join('')+'</select><select class="select" id="pubPublisher"><option value="">全部出版社</option>'+pubOpts.map(p=>'<option '+(state.publisher===p?'selected':'')+'>'+esc(p)+'</option>').join('')+'</select><select class="select" id="pubFilter"><option value="all" '+(state.filter==='all'?'selected':'')+'>全部項目</option><option value="included" '+(state.filter==='included'?'selected':'')+'>只看納入</option><option value="excluded" '+(state.filter==='excluded'?'selected':'')+'>只看排除</option><option value="review" '+(state.filter==='review'?'selected':'')+'>只看待確認</option></select></div><div class="row" style="justify-content:space-between"><h3>逐篇檢核</h3><span class="muted">顯示 '+shown.length+' / '+rows.length+' 篇</span></div><div class="publisher-review-list">'+(cards||'<div class="empty">目前篩選條件沒有資料。</div>')+'</div></section>');
 bind(ctx);
}
function openEditor(ctx,r){
 const d=document.createElement('dialog');d.className='publisher-dialog';
 d.innerHTML='<form method="dialog" class="publisher-dialog-card"><h3>編輯出版社／課文辨識</h3><div class="muted tiny">'+esc(r.anonymous_code||'')+'｜'+esc(r.title||'')+'</div><label class="label">統一後出版社（多家請用「；」分隔）</label><input class="input" id="pubEditPublishers" value="'+esc((r.publishers||[]).join('；'))+'"><label class="label">引用課文名稱（多篇請用「；」分隔）</label><textarea class="input" id="pubEditLessons" rows="4">'+esc((r.lesson_names||[]).join('；'))+'</textarea><label class="label">備註</label><textarea class="input" id="pubEditNotes" rows="3">'+esc(r.notes||'')+'</textarea><div class="rf4-actions" style="margin-top:14px"><button type="button" class="btn primary" id="pubEditSave">儲存</button><button type="button" class="btn" id="pubEditAuto">恢復自動辨識</button><button class="btn">取消</button></div></form>';
 document.body.appendChild(d);d.addEventListener('close',()=>d.remove());d.showModal();
 d.querySelector('#pubEditSave').onclick=async()=>{
   const publishers=splitList(d.querySelector('#pubEditPublishers').value),lesson_names=splitList(d.querySelector('#pubEditLessons').value),notes=d.querySelector('#pubEditNotes').value.trim();
   const {error}=await ctx.sb.from('publisher_reference_reviews').update({publishers,lesson_names,notes:notes||null,review_status:'reviewed',updated_by:ctx.S.user.id,updated_at:new Date().toISOString()}).eq('project_id',ctx.S.project.id).eq('submission_id',r.id);
   if(error)return ctx.toast(error.message);await ctx.audit('人工修正出版社／課文辨識','publisher_reference_review',r.id,{publishers,lesson_names});d.close();await loadRows(ctx);renderPage(ctx);
 };
 d.querySelector('#pubEditAuto').onclick=async()=>{
   const a=autoRecord(r),{error}=await ctx.sb.from('publisher_reference_reviews').update({publishers:a.publishers,lesson_names:a.lesson_names,lesson_evidence:a.lesson_evidence,review_status:'auto',notes:null,updated_by:ctx.S.user.id,updated_at:new Date().toISOString()}).eq('project_id',ctx.S.project.id).eq('submission_id',r.id);
   if(error)return ctx.toast(error.message);d.close();await loadRows(ctx);renderPage(ctx);
 };
}
async function exportExcel(ctx){
 try{
   if(!(await ctx.loadXlsx()))throw new Error('Excel 元件載入失敗');
   const summary=summarize(state.rows);
   const wb=XLSX.utils.book_new(),append=(name,list)=>{const ws=XLSX.utils.json_to_sheet(list);ws['!autofilter']={ref:ws['!ref']||'A1:A1'};ws['!cols']=Object.keys(list[0]||{}).map(k=>({wch:/作品內容|辨識依據|引用課文/.test(k)?55:Math.min(Math.max(k.length+5,12),28)}));XLSX.utils.book_append_sheet(wb,ws,name)};
   append('出版社統計',summary.pubs.map(x=>({'出版社':x.publisher,'辨識筆數':x.total,'納入引用篇數':x.included,'排除篇數':x.excluded,'引用課文種類數':x.lessons.size,'引用課文':[...x.lessons].join('、')})));
   append('課文引用統計',summary.lessons.map(x=>({'出版社':x.publisher,'課文名稱':x.lesson,'納入引用篇數':x.count})));
   append('逐篇檢核',state.rows.map(r=>({'納入統計':r.included?'是':'否','排除原因':r.excluded_reason||'','組別':r.group_name||'','匿名編號':r.anonymous_code||'','作品名稱':r.title||'','原始出版社填答':r.publisher||'','統一後出版社':(r.publishers||[]).join('；'),'辨識課文名稱':(r.lesson_names||[]).join('；'),'辨識狀態':needsReview(r)?'待確認':r.review_status==='reviewed'?'人工確認':'自動辨識','科目欄1':r.subject_1||'','科目欄2':r.subject_2||'','備註':r.notes||'','作品內容':r.body||''})));
   const d=new Date(),p=n=>String(n).padStart(2,'0'),file=(ctx.S.project.name||'競賽')+'_出版社與引用課文統計_'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'.xlsx';
   XLSX.writeFile(wb,file);ctx.toast('出版社與引用課文統計已下載');await ctx.audit('下載出版社與引用課文統計','publisher_reference_export','',{rows:state.rows.length});
 }catch(e){ctx.toast(e.message||String(e))}
}
function bind(ctx){
 let timer;const search=document.getElementById('pubSearch');if(search)search.oninput=()=>{clearTimeout(timer);const value=search.value;timer=setTimeout(()=>{state.search=value;renderPage(ctx);const next=document.getElementById('pubSearch');if(next){next.focus();next.setSelectionRange(next.value.length,next.value.length)}},180)};
 const group=document.getElementById('pubGroup');if(group)group.onchange=()=>{state.group=group.value;renderPage(ctx)};
 const pub=document.getElementById('pubPublisher');if(pub)pub.onchange=()=>{state.publisher=pub.value;renderPage(ctx)};
 const filter=document.getElementById('pubFilter');if(filter)filter.onchange=()=>{state.filter=filter.value;renderPage(ctx)};
 document.querySelectorAll('[data-pub-edit]').forEach(b=>b.onclick=()=>{const r=state.rows.find(x=>x.id===b.dataset.pubEdit);if(r)openEditor(ctx,r)});
 document.querySelectorAll('[data-pub-toggle]').forEach(b=>b.onclick=async()=>{const r=state.rows.find(x=>x.id===b.dataset.pubToggle);if(!r)return;let reason=null;if(r.included){reason=prompt('可填寫排除原因（可留白）：','');if(reason===null)return}const next=!r.included,{error}=await ctx.sb.from('publisher_reference_reviews').update({included:next,excluded_reason:next?null:(reason||null),updated_by:ctx.S.user.id,updated_at:new Date().toISOString()}).eq('project_id',ctx.S.project.id).eq('submission_id',r.id);if(error)return ctx.toast(error.message);await ctx.audit(next?'恢復出版社／課文統計':'排除出版社／課文統計','publisher_reference_review',r.id,{reason});await loadRows(ctx);renderPage(ctx)});
 const re=document.getElementById('pubReanalyze');if(re)re.onclick=async()=>{if(!confirm('確定重新分析所有尚未人工確認的項目嗎？\n\n已人工修改的內容不會被覆蓋。'))return;re.disabled=true;try{const n=await ensureRows(ctx,true);await loadRows(ctx);ctx.toast('已重新分析 '+n+' 筆');renderPage(ctx)}catch(e){ctx.toast(e.message||String(e));re.disabled=false}};
 const ex=document.getElementById('pubExport');if(ex)ex.onclick=()=>exportExcel(ctx);
}
M.render=async function(ctx){
 if(!['platform_admin','project_admin'].includes(ctx.S.role))return ctx.shell('<section class="section"><div class="danger-note">僅限平台／專案管理員使用出版社與引用課文統計。</div></section>');
 ctx.shell('<section class="section"><div class="empty">正在整理出版社名稱並掃描引用課文…</div></section>');
 try{await ensureRows(ctx,false);await loadRows(ctx);renderPage(ctx)}catch(e){ctx.shell('<section class="section"><div class="danger-note"><b>出版社／課文統計載入失敗</b><br>'+esc(e.message||String(e))+'</div></section>')}
};
window.PublisherStats=M;
})();