const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
let server = fs.readFileSync(serverPath, 'utf8');
let changes = 0;

function replaceOnce(text, before, after) {
  if (text.includes(before)) {
    changes += 1;
    return text.replace(before, after);
  }
  return text;
}

// Les champs et leur validation sont désormais définis directement dans
// public/index.html et public/app.js. Ce script ne doit plus modifier l’UI :
// cela évite de réactiver ou cocher Firecrawl avec une clé au format invalide.

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
console.log(`Support des clés API temporaires vérifié : ${changes}`);
