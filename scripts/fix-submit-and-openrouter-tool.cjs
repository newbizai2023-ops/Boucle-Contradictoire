const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const appPath = path.join(root, 'public', 'app.js');
let changes = 0;

function patch(filePath, transform) {
  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after, 'utf8');
    changes += 1;
  }
}

patch(serverPath, source => {
  source = source.replace(
    'if(web) body.tools=[{type:"openrouter:web_search",engine:"auto",search_context_size:"high",max_total_results:10}];',
    'if(web) body.tools=[{type:"openrouter:web_search",parameters:{engine:"auto",search_context_size:"high",max_total_results:10}}];'
  );

  if (!source.includes('[job] création')) {
    source = source.replace(
      'app.post("/api/jobs",requireAuth,',
      'app.post("/api/jobs",requireAuth,'
    );
    source = source.replace(
      'const id=uuidv4();const job=',
      'const id=uuidv4();console.info(`[job] création ${id} utilisateur=${req.effectiveUser?.id || "inconnu"} openrouter=${Boolean(process.env.OPENROUTER_API_KEY)} firecrawl=${Boolean(process.env.FIRECRAWL_API_KEY)}`);const job='
    );
    source = source.replace(
      'executeJob(job,req.effectiveUser,req.body).catch(error=>{job.status="error";',
      'executeJob(job,req.effectiveUser,req.body).catch(error=>{console.error(`[job] échec ${id}: ${error.message}`);job.status="error";'
    );
  }

  if (!source.includes('[openrouter] appel')) {
    source = source.replace(
      'const response=await fetch(OPENROUTER_URL,',
      'console.info(`[openrouter] appel modèle=${model} web=${web}`);const response=await fetch(OPENROUTER_URL,'
    );
    source = source.replace(
      'const payload=await response.json().catch(()=>({})); if(!response.ok) throw new Error(',
      'const payload=await response.json().catch(()=>({})); if(!response.ok){console.error(`[openrouter] HTTP ${response.status}: ${payload?.error?.message || "erreur sans détail"}`);throw new Error('
    );
    source = source.replace(
      'payload?.error?.message||`Erreur OpenRouter ${response.status}`); const message=',
      'payload?.error?.message||`Erreur OpenRouter ${response.status}`);} const message='
    );
  }

  return source;
});

patch(appPath, source => {
  if (!source.includes('Analyse demandée au serveur')) {
    source = source.replace(
      "  $('#submitButton').disabled = true; $('#submitButton').textContent='Initialisation…';",
      "  $('#submitButton').disabled = true; $('#submitButton').textContent='Initialisation…';\n  $('#empty').hidden=true; $('#progressPanel').hidden=false; $('#analysisPanel').hidden=false; $('#timeline').innerHTML=''; $('#analysisFeed').innerHTML=''; addTimeline('Analyse demandée au serveur', 'start'); setProgress(1,'Envoi de la demande…');"
    );
    source = source.replace(
      "    $('#empty').hidden=true; $('#results').hidden=true; $('#progressPanel').hidden=false; $('#analysisPanel').hidden=false; $('#timeline').innerHTML=''; $('#analysisFeed').innerHTML='';\n    addTimeline('Tâche créée', 'start'); setProgress(1,'Initialisation de l’analyse'); watchJob(id);",
      "    $('#results').hidden=true; addTimeline('Tâche créée', 'start'); setProgress(2,'Initialisation de l’analyse'); watchJob(id);"
    );
    source = source.replace(
      "  } catch(error) { showError(error); resetButton(); }",
      "  } catch(error) { addTimeline(`Échec du lancement : ${error.message}`, 'error'); showError(error); resetButton(); }"
    );
  }

  if (!source.includes('window.addEventListener(\'unhandledrejection\'')) {
    source += "\nwindow.addEventListener('unhandledrejection', event => { const message = event.reason?.message || String(event.reason || 'Erreur JavaScript inconnue'); console.error('[interface] promesse rejetée', event.reason); showError(new Error(message)); resetButton(); });\nwindow.addEventListener('error', event => { if (!event.error) return; console.error('[interface] erreur', event.error); showError(new Error(event.error.message || 'Erreur JavaScript')); resetButton(); });\n";
  }
  return source;
});

const finalServer = fs.readFileSync(serverPath, 'utf8');
if (!finalServer.includes('parameters:{engine:"auto"')) throw new Error('La correction OpenRouter Web Search n’a pas été appliquée.');

console.log(`Lancement et diagnostic OpenRouter corrigés : ${changes} fichier(s) modifié(s).`);
