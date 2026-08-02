const $ = s => document.querySelector(s);
let currentRunId = null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
async function json(url, options) { const r = await fetch(url, options); const d = await r.json().catch(()=>({})); if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`); return d; }
async function init() {
  const [me, health] = await Promise.all([json('/api/me'), json('/api/health')]);
  $('#health').textContent = health.ok ? `Serveur prêt${health.database?' · DB':''}${health.hasFirecrawlKey?' · Firecrawl':''}` : 'Serveur indisponible';
  $('#health').className = `badge ${health.ok?'ok':'warn'}`;
  if (!me.user) {
    $('#auth').innerHTML = me.googleConfigured ? '<a class="login" href="/auth/google">Se connecter avec Google</a>' : '<span class="badge warn">OAuth Google non configuré</span>';
    return;
  }
  $('#auth').innerHTML = `<span>${esc(me.user.name || me.user.email)}</span> <button id="logout" class="secondary">Déconnexion</button>`;
  $('#logout').onclick = async()=>{ await json('/auth/logout',{method:'POST'}); location.reload(); };
  $('#app').hidden = false;
  $('#keyDetails').open = !health.hasOpenRouterKey;
  if (!health.hasFirecrawlKey) {
    $('#webSearch').checked = false;
    $('#webSearch').disabled = true;
    $('#webSearchHelp').textContent = 'Firecrawl n’est pas configuré sur le serveur : la recherche Web est désactivée.';
  }
  const [historyResult, dashboardResult] = await Promise.allSettled([loadHistory(), loadDashboard()]);
  if (historyResult.status === 'rejected') $('#history').innerHTML = `<p class="error">Historique indisponible : ${esc(historyResult.reason.message)}</p>`;
  if (dashboardResult.status === 'rejected') $('#dashboard').innerHTML = `<p class="error">Tableau de bord indisponible : ${esc(dashboardResult.reason.message)}</p>`;
}
$('#autoModel').addEventListener('change', e => $('#models').classList.toggle('disabled', e.target.checked));
$('#files').addEventListener('change', renderSelectedFiles);
function renderSelectedFiles(){
  const files=[...$('#files').files];
  $('#fileList').innerHTML=files.map(file=>`<span class="file-chip">${esc(file.name)} · ${(file.size/1024/1024).toFixed(2)} Mo</span>`).join('');
}
$('#reviewForm').addEventListener('submit', async event => {
  event.preventDefault(); $('#error').hidden = true; $('#submitButton').disabled = true; $('#submitButton').textContent='Initialisation…';
  const formData = new FormData();
  formData.append('request',$('#request').value);
  formData.append('autoModel',String($('#autoModel').checked));
  formData.append('webSearch',String($('#webSearch').checked));
  formData.append('writerModel',$('#writerModel').value.trim());
  formData.append('auditorModel',$('#auditorModel').value.trim());
  formData.append('arbiterModel',$('#arbiterModel').value.trim());
  formData.append('maxCycles',$('#maxCycles').value);
  formData.append('minScore',$('#minScore').value);
  formData.append('apiKey',$('#apiKey').value.trim());
  [...$('#files').files].forEach(file=>formData.append('files',file));
  try {
    const { id } = await json('/api/jobs',{method:'POST',body:formData}); currentRunId=id; watchJob(id);
    $('#empty').hidden=true; $('#results').hidden=true; $('#progressPanel').hidden=false; $('#analysisPanel').hidden=false; $('#timeline').innerHTML=''; $('#analysisFeed').innerHTML=''; setProgress(1,'Tâche créée');
  } catch(error) { showError(error); resetButton(); }
});
function watchJob(id) {
  const es = new EventSource(`/api/jobs/${id}/events`);
  const add = e => { const d=JSON.parse(e.data); addTimeline(d.message || d.type); if (d.percent) setProgress(d.percent,d.message); };
  ['progress','models','source','audit'].forEach(type=>es.addEventListener(type,add));
  es.addEventListener('insight', e=>{ const d=JSON.parse(e.data); addAnalysis(d); });
  es.addEventListener('complete', e=>{ es.close(); const d=JSON.parse(e.data); renderResult(d.result); setProgress(100,'Terminé'); resetButton(); loadHistory().catch(showError); loadDashboard().catch(showError); });
  es.addEventListener('error', e=>{ if(e.data){ const d=JSON.parse(e.data); showError(new Error(d.message)); addAnalysis({category:'error',message:d.message}); } es.close(); resetButton(); });
}
function setProgress(p,t){ $('#progressBar').style.width=`${Math.min(100,p)}%`; $('#progressText').textContent=t||''; }
function addTimeline(text){ const li=document.createElement('li'); li.textContent=text; $('#timeline').append(li); }
function addAnalysis(data){
  const article=document.createElement('article'); article.className=`analysis-entry ${data.category||'general'}`;
  const time=new Date(data.at||Date.now()).toLocaleTimeString();
  article.innerHTML=`<div><span>${esc(data.category||'analyse')}</span><time>${esc(time)}</time></div><p>${esc(data.message||'')}</p>${data.details?`<details><summary>Détails</summary><pre>${esc(JSON.stringify(data.details,null,2))}</pre></details>`:''}`;
  $('#analysisFeed').append(article); article.scrollIntoView({block:'nearest'});
}
function resetButton(){ $('#submitButton').disabled=false; $('#submitButton').textContent='Lancer la boucle'; }
function showError(error){ $('#error').textContent=error.message; $('#error').hidden=false; }
function renderResult(data){
  $('#progressPanel').hidden=true; $('#results').hidden=false; currentRunId=data.id;
  $('#status').textContent=data.status; const last=data.audits?.at(-1); $('#score').textContent=last?.score_global??'—'; $('#calls').textContent=data.calls?.length||0; $('#cost').textContent=`$${Number(data.totalCost||0).toFixed(4)}`; $('#finalDocument').textContent=data.finalDocument||'';
  $('#arbitration').innerHTML=`<h3>Arbitrage Grok</h3><pre>${esc(JSON.stringify(data.arbitration,null,2))}</pre>`;
  $('#audits').innerHTML=(data.audits||[]).map(a=>`<article class="audit-card"><h3>Cycle ${a.cycle} — ${a.score_global}/100</h3><p>${esc(a.resume||'')}</p>${(a.anomalies||[]).map(x=>`<div class="issue ${esc(x.gravite)}"><b>${esc(x.categorie)} · ${esc(x.gravite)}</b><p>${esc(x.probleme)}</p><small>${esc(x.correction_attendue)}</small></div>`).join('')}</article>`).join('');
  $('#scores').innerHTML=renderScores(data.audits||[]); $('#sources').innerHTML=renderSources(data.sources||[]); $('#usage').innerHTML=renderUsage(data.calls||[]);
  document.querySelectorAll('[data-export]').forEach(a=>{ a.href=`/api/runs/${data.id}/export/${a.dataset.export}`; });
}
function renderScores(audits){ const keys=['exactitude_factuelle','qualite_sources','calculs','couverture','coherence','actualite']; return `<div class="table-wrap"><table><thead><tr><th>Cycle</th><th>Global</th>${keys.map(k=>`<th>${k.replaceAll('_',' ')}</th>`).join('')}</tr></thead><tbody>${audits.map(a=>`<tr><td>${a.cycle}</td><td>${a.score_global}</td>${keys.map(k=>`<td>${a.scores?.[k]??'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function renderSources(sources){ return sources.length?`<div class="source-grid">${sources.map(s=>`<article class="source ${s.accessible?'ok':'bad'}"><b>${esc(s.title||s.url)}</b><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a><p>${s.accessible?'Accessible et extraite par Firecrawl':`Non vérifiée : ${esc(s.reason)}`}</p><small>${esc(s.sourceClass)}</small></article>`).join('')}</div>`:'<p>Recherche Web désactivée ou aucune source détectée.</p>'; }
function renderUsage(calls){ return `<div class="table-wrap"><table><thead><tr><th>Rôle</th><th>Modèle</th><th>Entrée</th><th>Sortie</th><th>Coût</th></tr></thead><tbody>${calls.map(c=>`<tr><td>${esc(c.role)}</td><td>${esc(c.model)}</td><td>${c.usage?.prompt_tokens||0}</td><td>${c.usage?.completion_tokens||0}</td><td>$${Number(c.usage?.cost||0).toFixed(4)}</td></tr>`).join('')}</tbody></table></div>`; }
async function loadHistory(){ const {runs}=await json('/api/history'); $('#history').innerHTML=runs.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Demande</th><th>Type</th><th>Statut</th><th>Coût</th></tr></thead><tbody>${runs.map(r=>`<tr><td>${new Date(r.created_at||r.createdAt||Date.now()).toLocaleString()}</td><td>${esc((r.request||'').slice(0,90))}</td><td>${esc(r.task_type||r.taskType||'')}</td><td>${esc(r.status)}</td><td>$${Number(r.total_cost||r.totalCost||0).toFixed(4)}</td></tr>`).join('')}</tbody></table></div>`:'<p>Aucun historique.</p>'; }
async function loadDashboard(){ const d=await json('/api/dashboard'); $('#dashboard').innerHTML=`<div class="metrics"><article><span>Exécutions</span><strong>${d.totals.runs}</strong></article><article><span>Validées</span><strong>${d.totals.validated}</strong></article><article><span>Coût total</span><strong>$${Number(d.totals.cost).toFixed(4)}</strong></article><article><span>Tokens</span><strong>${(d.totals.promptTokens+d.totals.completionTokens).toLocaleString()}</strong></article></div>${renderUsage(d.byModel.map(m=>({role:`${m.calls} appels`,model:m.model,usage:{prompt_tokens:m.promptTokens,completion_tokens:m.completionTokens,cost:m.cost}})))}`; }
$('#refreshHistory').onclick=()=>Promise.allSettled([loadHistory(),loadDashboard()]);
$('#copy').onclick=()=>navigator.clipboard.writeText($('#finalDocument').textContent);
document.querySelectorAll('.tab').forEach(tab=>tab.onclick=()=>{ document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===tab)); document.querySelectorAll('.tab-panel').forEach(x=>x.classList.toggle('active',x.id===tab.dataset.tab)); });
init().catch(showError);
