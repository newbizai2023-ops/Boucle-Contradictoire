const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const appPath = path.join(root, 'public', 'app.js');
const indexPath = path.join(root, 'public', 'index.html');
let source = fs.readFileSync(serverPath, 'utf8');
let changes = 0;

function replaceOnce(before, after) {
  if (source.includes(before)) {
    source = source.replace(before, after);
    changes += 1;
  }
}

function patchFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [before, after] of replacements) {
    if (content.includes(before)) {
      content = content.replace(before, after);
      changes += 1;
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

// Le compte de contournement de développement doit exister en base afin que
// les exécutions puissent être conservées malgré la clé étrangère runs.user_id.
if (!source.includes('dev-bypass-local')) {
  replaceOnce(
    '}\n\nconst writerSystem',
    '  await pool.query(`INSERT INTO users (id,google_id,email,name) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,updated_at=NOW()`, ["00000000-0000-0000-0000-000000000001", "dev-bypass-local", "dev@local", "Développeur"]);\n}\n\nconst writerSystem'
  );
}

replaceOnce(
  'async function saveRun(userId,result,request,task,models){if(!pool||userId==="00000000-0000-0000-0000-000000000001")return;',
  'async function saveRun(userId,result,request,task,models){if(!pool)return;'
);
replaceOnce(
  'if(!pool||req.effectiveUser.id.startsWith("00000000"))return res.json({runs:[...jobs.values()]',
  'if(!pool)return res.json({runs:[...jobs.values()]'
);
replaceOnce(
  'if(!pool||req.effectiveUser.id.startsWith("00000000")){const runs=[...jobs.values()]',
  'if(!pool){const runs=[...jobs.values()]'
);

// Firecrawl est optionnel par exécution. La recherche Web OpenRouter reste toujours active.
replaceOnce(
  'const minScore=Math.min(100,Math.max(50,Number(body.minScore||90)));const result=',
  'const minScore=Math.min(100,Math.max(50,Number(body.minScore||90)));const firecrawlEnabled=body.firecrawl!==false;const result='
);
replaceOnce(
  'sources:[],analysisLog:[],totalCost:0,status:"running"',
  'sources:[],analysisLog:[],firecrawlEnabled,webSearchEnabled:true,totalCost:0,status:"running"'
);
replaceOnce(
  'const verified=await verifySources(document,result.calls,process.env.FIRECRAWL_API_KEY,job);',
  'const verified=firecrawlEnabled?await verifySources(document,result.calls,process.env.FIRECRAWL_API_KEY,job):annotationSources(result.calls).map(source=>({...source,accessible:null,reason:"Vérification Firecrawl désactivée",sourceClass:sourceClass(source.url)}));'
);
replaceOnce(
  'attachments,autoModel:req.body.autoModel!=="false",maxCycles:',
  'attachments,autoModel:req.body.autoModel!=="false",firecrawl:req.body.firecrawl!=="false",maxCycles:'
);

fs.writeFileSync(serverPath, source, 'utf8');

patchFile(indexPath, [
  ['<input id="webSearch" type="checkbox" checked> Recherche Web et vérification des sources via Firecrawl', '<input id="firecrawl" type="checkbox" checked> Vérification approfondie des sources via Firecrawl'],
  ['<small id="webSearchHelp">Active la recherche Web du rédacteur et le contrôle des pages citées par Firecrawl.</small>', '<small id="firecrawlHelp">La recherche Web OpenRouter reste toujours active. Ce bouton contrôle uniquement l’extraction et la vérification des pages par Firecrawl.</small>']
]);

patchFile(appPath, [
  ["$('#webSearch').checked = false;", "$('#firecrawl').checked = false;"],
  ["$('#webSearch').disabled = true;", "$('#firecrawl').disabled = true;"],
  ["$('#webSearchHelp').textContent = 'Firecrawl n’est pas configuré sur le serveur : la recherche Web est désactivée.';", "$('#firecrawlHelp').textContent = 'Firecrawl n’est pas configuré sur le serveur. La recherche Web OpenRouter reste active, mais la vérification approfondie est indisponible.';"],
  ["formData.append('webSearch',String($('#webSearch').checked));", "formData.append('firecrawl',String($('#firecrawl').checked));"],
  ["'<p>Recherche Web désactivée ou aucune source détectée.</p>'", "'<p>Aucune source structurée détectée par OpenRouter.</p>'"]
]);

// Sur mobile, EventSource peut être interrompu lorsque le navigateur passe en
// arrière-plan. On conserve l'identifiant du traitement et on laisse le
// navigateur se reconnecter au lieu de fermer définitivement le flux.
patchFile(appPath, [
  [
    'let currentRunId = null;',
    "let currentRunId = localStorage.getItem('currentRunId');\nlet currentEventSource = null;"
  ],
  [
    "const [historyResult, dashboardResult] = await Promise.allSettled([loadHistory(), loadDashboard()]);",
    "const [historyResult, dashboardResult] = await Promise.allSettled([loadHistory(), loadDashboard()]);\n  if (currentRunId) { $('#empty').hidden=true; $('#results').hidden=true; $('#progressPanel').hidden=false; $('#analysisPanel').hidden=false; setProgress(1,'Reconnexion au traitement…'); watchJob(currentRunId); }"
  ],
  [
    "const { id } = await json('/api/jobs',{method:'POST',body:formData}); currentRunId=id; watchJob(id);",
    "const { id } = await json('/api/jobs',{method:'POST',body:formData}); currentRunId=id; localStorage.setItem('currentRunId',id); watchJob(id);"
  ],
  [
    "function watchJob(id) {\n  const es = new EventSource(`/api/jobs/${id}/events`);",
    "function watchJob(id) {\n  if (currentEventSource) currentEventSource.close();\n  const es = new EventSource(`/api/jobs/${id}/events`);\n  currentEventSource = es;"
  ],
  [
    "es.addEventListener('complete', e=>{ es.close(); const d=JSON.parse(e.data); renderResult(d.result); setProgress(100,'Terminé'); resetButton(); loadHistory().catch(showError); loadDashboard().catch(showError); });",
    "es.addEventListener('complete', e=>{ es.close(); currentEventSource=null; localStorage.removeItem('currentRunId'); const d=JSON.parse(e.data); renderResult(d.result); setProgress(100,'Terminé'); resetButton(); loadHistory().catch(showError); loadDashboard().catch(showError); });"
  ],
  [
    "es.addEventListener('error', e=>{ if(e.data){ const d=JSON.parse(e.data); showError(new Error(d.message)); addAnalysis({category:'error',message:d.message}); } es.close(); resetButton(); });",
    "es.addEventListener('error', e=>{ if(e.data){ const d=JSON.parse(e.data); showError(new Error(d.message)); addAnalysis({category:'error',message:d.message}); es.close(); currentEventSource=null; localStorage.removeItem('currentRunId'); resetButton(); } else { setProgress(Number($('#progressBar').style.width.replace('%',''))||1,'Connexion interrompue, reprise automatique…'); } });"
  ],
  [
    "$('#refreshHistory').onclick=()=>Promise.allSettled([loadHistory(),loadDashboard()]);",
    "$('#refreshHistory').onclick=()=>Promise.allSettled([loadHistory(),loadDashboard()]);\ndocument.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ loadHistory().catch(()=>{}); loadDashboard().catch(()=>{}); if(currentRunId && (!currentEventSource || currentEventSource.readyState===EventSource.CLOSED)) watchJob(currentRunId); } });\nwindow.addEventListener('online',()=>{ if(currentRunId && (!currentEventSource || currentEventSource.readyState===EventSource.CLOSED)) watchJob(currentRunId); });"
  ]
]);

console.log(`Persistance historique / contrôle Firecrawl / reprise mobile appliqués : ${changes}`);
