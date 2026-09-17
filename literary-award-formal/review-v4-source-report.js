'use strict';
(function(){
const R=window.RF4;if(!R)return;const {sb,s}=R;
const BUCKET='project-source-reports';
const EDGE='https://ppdrsoltvqiqnbnlimbb.supabase.co/functions/v1/import-competition-cors';
const APIKEY='sb_publishable_Ev2C5000djbQq4wLDUKh9A_oF3H3WBd';
const state={batch:null,blob:null,book:null,sheetIndex:0,search:'',sorts:[],hidden:new Set(),freezeCols:1,widths:{},jumpRow:''};
const isPlatformAdmin=()=>s.profile?.platform_role==='platform_admin'||s.role==='platform_admin';
const fmtBytes=n=>{n=Number(n||0);if(!n)return'—';const u=['B','KB','MB','GB'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return`${n.toFixed(i?1:0)} ${u[i]}`};
const safeName=n=>String(n||'report.xlsx').replace(/[\\/\0]/g,'_').replace(/\s+/g,' ').trim().slice(0,160)||'report.xlsx';
const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
async function sha256(file){return hex(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))}
async function loadXlsx(){if(window.XLSX)return;await new Promise((ok,no)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';sc.onload=ok;sc.onerror=()=>no(new Error('Excel 檢視元件載入失敗'));document.head.appendChild(sc)});if(!window.XLSX)throw new Error('Excel 檢視元件載入失敗')}
async function listBatches(){const {data,error}=await sb.from('import_batches').select('id,original_filename,row_count,formal_count,pending_count,excluded_count,uploaded_at,sha256,source_storage_path,source_size_bytes,source_mime_type,source_saved_at').eq('project_id',s.project.id).order('uploaded_at',{ascending:false});if(error)throw error;return data||[]}
async function archiveAndImport(file,msg){
 const mime=file.type||'application/octet-stream',hash=await sha256(file),path=`${s.project.id}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
 msg.innerHTML='<div class="note">步驟 1/3：正在安全封存原始檔…</div>';
 const {error:upErr}=await sb.storage.from(BUCKET).upload(path,file,{contentType:mime,upsert:false,cacheControl:'3600'});if(upErr)throw new Error('原始報表封存失敗：'+upErr.message);
 try{
  msg.innerHTML='<div class="note">步驟 2/3：正在解析並匯入競賽資料…</div>';
  const fd=new FormData();fd.append('projectId',s.project.id);fd.append('file',file);const {data:{session}}=await sb.auth.getSession();
  const res=await fetch(EDGE,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:APIKEY},body:fd});const out=await res.json().catch(()=>({}));if(!res.ok)throw new Error(out.error||'匯入失敗');
  msg.innerHTML='<div class="note">步驟 3/3：正在綁定原始檔與匯入紀錄…</div>';
  let {error:attachErr}=await sb.rpc('attach_original_import_report',{p_project:s.project.id,p_filename:file.name,p_sha256:hash,p_storage_path:path,p_size_bytes:file.size,p_mime_type:mime});
  if(attachErr){const retry=await sb.rpc('attach_original_import_report',{p_project:s.project.id,p_filename:file.name,p_sha256:null,p_storage_path:path,p_size_bytes:file.size,p_mime_type:mime});attachErr=retry.error}
  if(attachErr)throw new Error('資料已匯入，但原始檔與匯入紀錄綁定失敗：'+attachErr.message);
  return out;
 }catch(e){
  if(String(e.message||'').startsWith('匯入失敗'))await sb.storage.from(BUCKET).remove([path]).catch(()=>{});
  throw e;
 }
}
async function backfillBatch(batch){
 if(!isPlatformAdmin())return R.toast('僅限平台系統管理員補存原始報表');
 const input=document.createElement('input');input.type='file';input.accept='.xlsx,.xls,.csv';input.style.display='none';document.body.appendChild(input);
 input.onchange=async()=>{const file=input.files?.[0];input.remove();if(!file)return;try{
  R.toast('正在驗證原始檔 SHA-256…');const hash=await sha256(file);if(batch.sha256&&hash.toLowerCase()!==String(batch.sha256).toLowerCase())throw new Error('SHA-256 不符：你選到的不是這次匯入所使用的原始檔');
  const mime=file.type||'application/octet-stream',path=`${s.project.id}/${Date.now()}-legacy-${crypto.randomUUID()}-${safeName(file.name)}`;
  const {error:upErr}=await sb.storage.from(BUCKET).upload(path,file,{contentType:mime,upsert:false,cacheControl:'3600'});if(upErr)throw new Error('補存上傳失敗：'+upErr.message);
  const {error:linkErr}=await sb.rpc('backfill_original_import_report',{p_project:s.project.id,p_batch:batch.id,p_sha256:hash,p_storage_path:path,p_size_bytes:file.size,p_mime_type:mime});
  if(linkErr){await sb.storage.from(BUCKET).remove([path]).catch(()=>{});throw new Error(linkErr.message)}
  R.toast('原始報表補存完成');state.batch=null;state.blob=null;state.book=null;R.pages.sourceReports();
 }catch(e){R.toast(e.message||String(e))}};
 document.body.appendChild(input);input.click();
}
R.pages.import=async function(){
 if(!['platform_admin','project_admin','staff'].includes(s.role))return R.setMain('<section class="section"><div class="empty">你沒有作品匯入權限。</div></section>');
 const batches=await listBatches();
 const rows=batches.map(x=>`<tr><td>${R.fmt(x.uploaded_at)}</td><td><b>${R.esc(x.original_filename)}</b><br><span class="rf4-subtle">SHA-256：${R.esc(x.sha256||'未記錄')}</span></td><td>${x.row_count}</td><td>${x.formal_count}</td><td>${x.pending_count}</td><td>${x.excluded_count}</td><td>${x.source_storage_path?R.badge('原始檔已封存','good'):R.badge('原始檔未留存','warn')}</td>${isPlatformAdmin()?`<td>${x.source_storage_path?`<button class="btn" data-open-source="${x.id}">檢視</button> <button class="btn" data-download-source="${x.id}">下載原檔</button>`:`<button class="btn" data-backfill-source="${x.id}">補存原始檔</button>`}</td>`:''}</tr>`).join('');
 R.setMain(`<section class="section"><h2>作品匯入</h2><p class="muted">上傳後會先把原始 Excel／CSV 完整封存到私有儲存空間，再進行解析與初篩。原始檔只有平台系統管理員可以檢視或下載。</p><form id="rf4ImportForm"><label class="label">完整原始報名 Excel / CSV</label><input class="input" id="rf4ImportFile" type="file" accept=".xlsx,.xls,.csv" required><button class="btn primary" style="margin-top:14px">封存原檔並執行匯入</button></form><div id="rf4ImportMsg"></div></section><section class="section"><div class="row" style="justify-content:space-between"><div><h3 style="margin:0">匯入紀錄</h3><div class="muted tiny">舊批次若顯示「原始檔未留存」，代表當時版本尚未啟用原始檔封存。</div></div>${isPlatformAdmin()?'<button class="btn" id="rf4GoSourceReports">開啟原始報表中心</button>':''}</div>${batches.length?`<div class="table-wrap"><table><thead><tr><th>時間</th><th>原始檔</th><th>總筆數</th><th>正式</th><th>待確認</th><th>剔除</th><th>原始檔</th>${isPlatformAdmin()?'<th>系統管理員操作</th>':''}</tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">尚未匯入。</div>'}</section>`);
 document.getElementById('rf4ImportForm').onsubmit=async e=>{e.preventDefault();const file=document.getElementById('rf4ImportFile').files[0],msg=document.getElementById('rf4ImportMsg');if(!file)return;if(file.size>50*1024*1024)return msg.innerHTML='<div class="danger-note">原始檔超過 50MB，請確認檔案內容。</div>';const btn=e.submitter||e.target.querySelector('button');btn.disabled=true;try{const out=await archiveAndImport(file,msg);msg.innerHTML=`<div class="rf4-banner good"><b>匯入與原始檔封存完成。</b><br>共 ${Number(out.total||0)} 筆；正式 ${Number(out.formal||0)}、待確認 ${Number(out.pending||0)}、剔除 ${Number(out.excluded||0)}。</div>`;setTimeout(()=>R.pages.import(),700)}catch(err){msg.innerHTML=`<div class="danger-note"><b>匯入未完成</b><br>${R.esc(err.message||String(err))}</div>`;btn.disabled=false}};
 document.getElementById('rf4GoSourceReports')?.addEventListener('click',()=>location.hash=`#project/${s.project.id}/sourceReports`);
 document.querySelectorAll('[data-open-source]').forEach(b=>b.onclick=()=>{location.hash=`#project/${s.project.id}/sourceReports`;sessionStorage.setItem('rf4OpenSourceBatch',b.dataset.openSource)});
 document.querySelectorAll('[data-download-source]').forEach(b=>b.onclick=()=>downloadBatch(batches.find(x=>x.id===b.dataset.downloadSource)));
 document.querySelectorAll('[data-backfill-source]').forEach(b=>b.onclick=()=>backfillBatch(batches.find(x=>x.id===b.dataset.backfillSource)));
};
async function getBlob(batch){if(state.batch?.id===batch.id&&state.blob)return state.blob;const {data,error}=await sb.storage.from(BUCKET).download(batch.source_storage_path);if(error)throw error;state.batch=batch;state.blob=data;return data}
async function downloadBatch(batch){try{if(!isPlatformAdmin())throw new Error('僅限平台系統管理員下載原始報表');if(!batch?.source_storage_path)throw new Error('這個舊批次沒有保存原始檔');const blob=await getBlob(batch),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=batch.original_filename||'original-report.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}catch(e){R.toast(e.message||String(e))}}
function colLabel(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
function cmp(a,b){const na=Number(String(a).replace(/,/g,'')),nb=Number(String(b).replace(/,/g,''));if(String(a).trim()!==''&&String(b).trim()!==''&&Number.isFinite(na)&&Number.isFinite(nb))return na-nb;return String(a??'').localeCompare(String(b??''),'zh-Hant',{numeric:true,sensitivity:'base'})}
function currentRows(){
 if(!state.book)return{headers:[],rows:[],sheetName:''};const name=state.book.SheetNames[state.sheetIndex],ws=state.book.Sheets[name],matrix=window.XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});const headers=(matrix[0]||[]).map((v,i)=>String(v||colLabel(i)));let rows=matrix.slice(1).map((cells,i)=>({cells,sourceRow:i+2}));
 if(state.search){const q=state.search.toLocaleLowerCase('zh-Hant');rows=rows.filter(r=>r.cells.some(v=>String(v??'').toLocaleLowerCase('zh-Hant').includes(q)))}
 if(state.sorts.length)rows.sort((a,b)=>{for(const srt of state.sorts){const c=cmp(a.cells[srt.col],b.cells[srt.col]);if(c)return srt.dir==='asc'?c:-c}return a.sourceRow-b.sourceRow});
 return{headers,rows,sheetName:name};
}
function frozenLeft(col,visible){let left=48;for(const c of visible){if(c===col)break;if(c<state.freezeCols)left+=Number(state.widths[c]||180)}return left}
function renderViewer(){
 const host=document.getElementById('rf4SourceViewer');if(!host||!state.book)return;const {headers,rows,sheetName}=currentRows(),visible=headers.map((_,i)=>i).filter(i=>!state.hidden.has(i));
 const tabs=state.book.SheetNames.map((n,i)=>`<button class="btn ${i===state.sheetIndex?'primary':''}" data-sheet="${i}">${R.esc(n)}</button>`).join('');
 const sortText=state.sorts.length?state.sorts.map((x,i)=>`${i+1}. ${R.esc(headers[x.col]||colLabel(x.col))} ${x.dir==='asc'?'↑':'↓'}`).join('　'):'尚未排序（點欄名排序；Shift＋點擊可加入多重排序）';
 const colChecks=headers.map((h,i)=>`<label><input type="checkbox" data-col-toggle="${i}" ${state.hidden.has(i)?'':'checked'}> ${R.esc(h||colLabel(i))}</label>`).join('');
 const th=visible.map(i=>{const srt=state.sorts.findIndex(x=>x.col===i),mark=srt>=0?`${srt+1}${state.sorts[srt].dir==='asc'?'↑':'↓'}`:'';const frozen=i<state.freezeCols,left=frozen?frozenLeft(i,visible):0;return`<th data-sort-col="${i}" data-col="${i}" style="width:${Number(state.widths[i]||180)}px;min-width:${Number(state.widths[i]||180)}px;${frozen?`left:${left}px`:''}" class="${frozen?'rf-source-frozen-col':''}"><span class="rf-source-col-letter">${colLabel(i)}</span><span>${R.esc(headers[i]||'未命名欄位')}</span>${mark?`<b class="rf-source-sort-mark">${mark}</b>`:''}<i class="rf-source-resize" data-resize-col="${i}"></i></th>`}).join('');
 const body=rows.map(r=>`<tr data-source-row="${r.sourceRow}"><td class="rf-source-rownum">${r.sourceRow}</td>${visible.map(i=>{const frozen=i<state.freezeCols,left=frozen?frozenLeft(i,visible):0;return`<td data-col="${i}" style="width:${Number(state.widths[i]||180)}px;min-width:${Number(state.widths[i]||180)}px;${frozen?`left:${left}px`:''}" class="${frozen?'rf-source-frozen-col':''}">${R.esc(r.cells[i]??'')}</td>`}).join('')}</tr>`).join('');
 host.innerHTML=`<div class="rf-source-workbook-head"><div><b>${R.esc(state.batch.original_filename)}</b><div class="muted tiny">${R.esc(sheetName)}｜顯示 ${rows.length} / ${Math.max((window.XLSX.utils.sheet_to_json(state.book.Sheets[sheetName],{header:1,raw:false,defval:''}).length-1),0)} 筆</div></div><div class="rf4-actions"><button class="btn" id="rf4DownloadOriginal">下載原始 Excel</button><button class="btn" id="rf4CloseViewer">回到報表清單</button></div></div><div class="rf-source-sheet-tabs">${tabs}</div><div class="rf-source-toolbar"><input class="input" id="rf4SourceSearch" placeholder="搜尋整份工作表…" value="${R.esc(state.search)}"><button class="btn" id="rf4ClearSearch">清除搜尋</button><label>凍結欄位 <select class="select" id="rf4FreezeCols">${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${state.freezeCols===n?'selected':''}>${n}</option>`).join('')}</select></label><label>跳到原始列 <input class="input" id="rf4JumpRow" type="number" min="2" value="${R.esc(state.jumpRow)}" placeholder="例如 120"></label><button class="btn" id="rf4JumpBtn">跳轉</button><details class="rf-source-columns"><summary class="btn">欄位顯示</summary><div class="rf-source-column-menu"><div class="rf4-actions"><button class="btn" id="rf4ShowAllCols">全部顯示</button><button class="btn" id="rf4ResetWidths">重設欄寬</button></div>${colChecks}</div></details></div><div class="rf-source-sortline">${sortText}<button class="btn" id="rf4ClearSort" ${state.sorts.length?'':'disabled'}>清除排序</button></div><div class="rf-source-grid-wrap" id="rf4SourceGridWrap"><table class="rf-source-grid"><thead><tr><th class="rf-source-corner">列</th>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
 bindViewer();
}
function bindViewer(){
 document.querySelectorAll('[data-sheet]').forEach(b=>b.onclick=()=>{state.sheetIndex=Number(b.dataset.sheet);state.search='';state.sorts=[];state.hidden=new Set();state.jumpRow='';renderViewer()});
 const search=document.getElementById('rf4SourceSearch');let timer;search.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{state.search=search.value;renderViewer()},180)};
 document.getElementById('rf4ClearSearch').onclick=()=>{state.search='';renderViewer()};
 document.getElementById('rf4FreezeCols').onchange=e=>{state.freezeCols=Number(e.target.value);renderViewer()};
 document.getElementById('rf4ClearSort').onclick=()=>{state.sorts=[];renderViewer()};
 document.getElementById('rf4ShowAllCols').onclick=()=>{state.hidden=new Set();renderViewer()};
 document.getElementById('rf4ResetWidths').onclick=()=>{state.widths={};renderViewer()};
 document.querySelectorAll('[data-col-toggle]').forEach(x=>x.onchange=()=>{const c=Number(x.dataset.colToggle);x.checked?state.hidden.delete(c):state.hidden.add(c);renderViewer()});
 document.querySelectorAll('[data-sort-col]').forEach(h=>h.onclick=e=>{if(e.target.closest('[data-resize-col]'))return;const c=Number(h.dataset.sortCol),idx=state.sorts.findIndex(x=>x.col===c),shift=e.shiftKey;if(!shift)state.sorts=idx>=0?[state.sorts[idx]]:[];let i=state.sorts.findIndex(x=>x.col===c);if(i<0)state.sorts.push({col:c,dir:'asc'});else if(state.sorts[i].dir==='asc')state.sorts[i].dir='desc';else state.sorts.splice(i,1);renderViewer()});
 document.getElementById('rf4JumpBtn').onclick=()=>{const n=Number(document.getElementById('rf4JumpRow').value);state.jumpRow=Number.isFinite(n)?String(n):'';const tr=document.querySelector(`tr[data-source-row="${n}"]`);if(tr){tr.scrollIntoView({block:'center'});tr.classList.add('rf-source-highlight');setTimeout(()=>tr.classList.remove('rf-source-highlight'),1800)}else R.toast('目前篩選結果中找不到這一列')};
 document.getElementById('rf4DownloadOriginal').onclick=()=>downloadBatch(state.batch);
 document.getElementById('rf4CloseViewer').onclick=()=>{state.batch=null;state.blob=null;state.book=null;R.pages.sourceReports()};
 document.querySelectorAll('[data-resize-col]').forEach(handle=>handle.onpointerdown=e=>{e.preventDefault();e.stopPropagation();const c=Number(handle.dataset.resizeCol),start=e.clientX,startW=Number(state.widths[c]||180);handle.setPointerCapture?.(e.pointerId);const move=ev=>{const w=Math.max(80,Math.min(700,startW+ev.clientX-start));document.querySelectorAll(`[data-col="${c}"]`).forEach(el=>{el.style.width=w+'px';el.style.minWidth=w+'px'});state.widths[c]=w};const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);renderViewer()};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up)});
}
async function openBatch(batch){
 if(!isPlatformAdmin())return R.toast('僅限平台系統管理員檢視原始報表');if(!batch.source_storage_path)return R.toast('這個舊批次沒有保存原始檔');const host=document.getElementById('rf4SourceViewer');if(host)host.innerHTML='<div class="empty">正在載入原始 Excel…</div>';
 try{await loadXlsx();const blob=await getBlob(batch),buf=await blob.arrayBuffer();state.book=window.XLSX.read(buf,{type:'array',cellDates:false,cellText:true});state.sheetIndex=0;state.search='';state.sorts=[];state.hidden=new Set();state.freezeCols=1;state.widths={};state.jumpRow='';renderViewer()}catch(e){if(host)host.innerHTML=`<div class="danger-note"><b>原始報表開啟失敗</b><br>${R.esc(e.message||String(e))}</div>`}
}
R.pages.sourceReports=async function(){
 if(!isPlatformAdmin())return R.setMain('<section class="section"><div class="danger-note"><b>僅限平台系統管理員</b><br>原始報表含有報名者個人資料，因此專案管理員、工作人員與評審均不得檢視或下載。</div></section>');
 const {data:allowed,error:allowErr}=await sb.rpc('can_view_original_reports',{p_project:s.project.id});if(allowErr||allowed!==true)return R.setMain('<section class="section"><div class="danger-note">原始報表存取權限驗證失敗。</div></section>');
 const batches=await listBatches();
 R.setMain(`<section class="section"><div class="row" style="justify-content:space-between"><div><h2>原始專案報表</h2><p class="muted">僅平台系統管理員可使用。這裡保存每次匯入時的原始 Excel／CSV，可線上檢視或下載原檔。</p></div>${R.badge('SYSTEM ADMIN ONLY','bad')}</div>${batches.length?`<div class="table-wrap"><table><thead><tr><th>匯入時間</th><th>原始檔名</th><th>檔案大小</th><th>筆數</th><th>封存狀態</th><th>操作</th></tr></thead><tbody>${batches.map(x=>`<tr><td>${R.fmt(x.uploaded_at)}</td><td><b>${R.esc(x.original_filename)}</b><br><span class="rf4-subtle">${R.esc(x.sha256||'無 SHA-256')}</span></td><td>${fmtBytes(x.source_size_bytes)}</td><td>${x.row_count}</td><td>${x.source_storage_path?R.badge('可檢視／下載','good'):R.badge('舊版未留存','warn')}</td><td>${x.source_storage_path?`<button class="btn primary" data-view-batch="${x.id}">開啟 Excel 檢視</button> <button class="btn" data-download-batch="${x.id}">下載原檔</button>`:`<button class="btn" data-backfill-batch="${x.id}">補存原始檔</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">目前沒有匯入紀錄。</div>'}</section><section class="section rf-source-viewer-section"><div id="rf4SourceViewer"><div class="empty">請從上方選擇一個已封存的原始報表。</div></div></section>`);
 document.querySelectorAll('[data-view-batch]').forEach(b=>b.onclick=()=>openBatch(batches.find(x=>x.id===b.dataset.viewBatch)));
 document.querySelectorAll('[data-download-batch]').forEach(b=>b.onclick=()=>downloadBatch(batches.find(x=>x.id===b.dataset.downloadBatch)));
 document.querySelectorAll('[data-backfill-batch]').forEach(b=>b.onclick=()=>backfillBatch(batches.find(x=>x.id===b.dataset.backfillBatch)));
 const wanted=sessionStorage.getItem('rf4OpenSourceBatch');if(wanted){sessionStorage.removeItem('rf4OpenSourceBatch');const batch=batches.find(x=>x.id===wanted);if(batch)setTimeout(()=>openBatch(batch),0)}
};
})();
