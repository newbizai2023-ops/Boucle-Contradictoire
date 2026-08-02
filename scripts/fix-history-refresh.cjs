const fs = require('node:fs');
const path = require('node:path');

const appPath = path.join(__dirname, '..', 'public', 'app.js');
let source = fs.readFileSync(appPath, 'utf8');
let changes = 0;

function replaceOnce(before, after) {
  if (source.includes(before)) {
    source = source.replace(before, after);
    changes += 1;
  }
}

if (!source.includes("const HISTORY_CACHE_KEY = 'boucleHistoryCache'")) {
  replaceOnce(
    'let currentEventSource = null;',
    "let currentEventSource = null;\nconst HISTORY_CACHE_KEY = 'boucleHistoryCache';\nfunction readHistoryCache(){ try { return JSON.parse(localStorage.getItem(HISTORY_CACHE_KEY) || '[]'); } catch { return []; } }\nfunction writeHistoryCache(runs){ try { localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify((runs || []).slice(0,100))); } catch {} }\nfunction rememberRun(run){ const cached=readHistoryCache(); const merged=[run,...cached.filter(item=>item.id!==run.id)]; writeHistoryCache(merged); }\nfunction historyRows(runs){ return runs.length?`<div class=\"table-wrap\"><table><thead><tr><th>Date</th><th>Demande</th><th>Type</th><th>Statut</th><th>Coût</th></tr></thead><tbody>${runs.map(r=>`<tr><td>${new Date(r.created_at||r.createdAt||Date.now()).toLocaleString()}</td><td>${esc((r.request||'').slice(0,90))}</td><td>${esc(r.task_type||r.taskType||'')}</td><td>${esc(r.status)}</td><td>$${Number(r.total_cost||r.totalCost||0).toFixed(4)}</td></tr>`).join('')}</tbody></table></div>`:'<p>Aucun historique.</p>'; }"
  );
}

replaceOnce(
  "const { id } = await json('/api/jobs',{method:'POST',body:formData}); currentRunId=id; localStorage.setItem('currentRunId',id); watchJob(id);",
  "const { id } = await json('/api/jobs',{method:'POST',body:formData}); currentRunId=id; localStorage.setItem('currentRunId',id); rememberRun({id,request:$('#request').value,taskType:'',status:'running',totalCost:0,createdAt:new Date().toISOString()}); $('#history').innerHTML=historyRows(readHistoryCache()); watchJob(id);"
);

replaceOnce(
  "es.addEventListener('complete', e=>{ es.close(); currentEventSource=null; localStorage.removeItem('currentRunId'); const d=JSON.parse(e.data); renderResult(d.result); setProgress(100,'Terminé'); resetButton(); loadHistory().catch(showError); loadDashboard().catch(showError); });",
  "es.addEventListener('complete', e=>{ es.close(); currentEventSource=null; localStorage.removeItem('currentRunId'); const d=JSON.parse(e.data); rememberRun({id:d.result.id,request:d.result.request,taskType:d.result.taskType,status:d.result.status,totalCost:d.result.totalCost,createdAt:d.result.createdAt}); renderResult(d.result); setProgress(100,'Terminé'); resetButton(); loadHistory().catch(showError); loadDashboard().catch(showError); });"
);

replaceOnce(
  "async function loadHistory(){ const {runs}=await json('/api/history'); $('#history').innerHTML=runs.length?`<div class=\"table-wrap\"><table><thead><tr><th>Date</th><th>Demande</th><th>Type</th><th>Statut</th><th>Coût</th></tr></thead><tbody>${runs.map(r=>`<tr><td>${new Date(r.created_at||r.createdAt||Date.now()).toLocaleString()}</td><td>${esc((r.request||'').slice(0,90))}</td><td>${esc(r.task_type||r.taskType||'')}</td><td>${esc(r.status)}</td><td>$${Number(r.total_cost||r.totalCost||0).toFixed(4)}</td></tr>`).join('')}</tbody></table></div>`:'<p>Aucun historique.</p>'; }",
  "async function loadHistory(){ const cached=readHistoryCache(); if(cached.length) $('#history').innerHTML=historyRows(cached); const {runs}=await json('/api/history'); const merged=[...(runs||[]),...cached.filter(c=>!(runs||[]).some(r=>r.id===c.id))].sort((a,b)=>new Date(b.created_at||b.createdAt||0)-new Date(a.created_at||a.createdAt||0)); writeHistoryCache(merged); $('#history').innerHTML=historyRows(merged); }"
);

fs.writeFileSync(appPath, source, 'utf8');
console.log(`Historique persistant après actualisation : ${changes}`);
