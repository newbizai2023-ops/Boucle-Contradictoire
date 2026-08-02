const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const appPath = path.join(root, 'public', 'app.js');
const indexPath = path.join(root, 'public', 'index.html');
let server = fs.readFileSync(serverPath, 'utf8');
let app = fs.readFileSync(appPath, 'utf8');
let index = fs.readFileSync(indexPath, 'utf8');
let changes = 0;

function replaceOnce(text, before, after) {
  if (text.includes(before)) {
    changes += 1;
    return text.replace(before, after);
  }
  return text;
}

// Les deux clés utilisables par une exécution sont saisissables depuis la home.
// Elles sont transmises uniquement avec la requête et ne sont jamais persistées.
index = replaceOnce(
  index,
  '<details id="keyDetails"><summary>Clé OpenRouter de test</summary><label for="apiKey">Clé temporaire</label><input id="apiKey" type="password" autocomplete="off" placeholder="sk-or-v1-…"><small>Non enregistrée. En production, utilise la variable secrète Render.</small></details>',
  '<details id="keyDetails"><summary>Clés API temporaires</summary><div class="grid"><div><label for="apiKey">Clé OpenRouter</label><input id="apiKey" type="password" autocomplete="new-password" spellcheck="false" placeholder="sk-or-v1-…"><small>Utilisée seulement pour cette analyse si aucune clé serveur n’est configurée.</small></div><div><label for="firecrawlApiKey">Clé Firecrawl</label><input id="firecrawlApiKey" type="password" autocomplete="new-password" spellcheck="false" placeholder="fc-…"><small>Utilisée seulement pour cette analyse si aucune clé serveur n’est configurée.</small></div></div><p class="analysis-notice">Ces clés restent dans la mémoire de la page, ne sont ni enregistrées dans l’historique ni stockées en base. Les secrets Google OAuth restent exclusivement dans Render.</p></details>'
);

app = replaceOnce(
  app,
  "  formData.append('apiKey',$('#apiKey').value.trim());",
  "  formData.append('apiKey',$('#apiKey').value.trim());\n  formData.append('firecrawlApiKey',$('#firecrawlApiKey').value.trim());"
);

// Une clé Firecrawl peut désormais être fournie depuis la page : ne pas bloquer
// le contrôle lorsque la variable Render est absente.
app = replaceOnce(
  app,
  "    $('#webSearch').checked = false;\n    $('#webSearch').disabled = true;\n    $('#webSearchHelp').textContent = 'Firecrawl n’est pas configuré sur le serveur : la recherche Web est désactivée.';",
  "    $('#webSearch').checked = true;\n    $('#webSearch').disabled = false;\n    $('#webSearchHelp').textContent = 'Aucune clé Firecrawl serveur détectée. Saisis une clé temporaire ci-dessous pour activer la vérification approfondie. La recherche Web OpenRouter reste disponible.';"
);

// Utiliser d'abord les secrets Render, puis les clés temporaires de la requête.
server = replaceOnce(
  server,
  'async function executeJob(job,user,body){const apiKey=process.env.OPENROUTER_API_KEY||body.apiKey;',
  'async function executeJob(job,user,body){const apiKey=process.env.OPENROUTER_API_KEY||String(body.apiKey||"").trim();const firecrawlApiKey=process.env.FIRECRAWL_API_KEY||String(body.firecrawlApiKey||"").trim();'
);
server = replaceOnce(
  server,
  'await verifySources(document,result.calls,process.env.FIRECRAWL_API_KEY,job)',
  'await verifySources(document,result.calls,firecrawlApiKey,job)'
);
server = replaceOnce(
  server,
  'apiKey:req.body.apiKey,',
  'apiKey:req.body.apiKey,firecrawlApiKey:req.body.firecrawlApiKey,'
);

fs.writeFileSync(serverPath, server, 'utf8');
fs.writeFileSync(appPath, app, 'utf8');
fs.writeFileSync(indexPath, index, 'utf8');
console.log(`Champs de clés API ajoutés sur la home : ${changes}`);
