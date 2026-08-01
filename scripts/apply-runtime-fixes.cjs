const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const packagePath = path.join(root, 'package.json');
const release = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
let source = fs.readFileSync(serverPath, 'utf8');
let changes = 0;

// L'auditeur reçoit déjà le dossier de sources vérifiées par Firecrawl.
// La combinaison tools + réponse JSON stricte provoque des erreurs chez certains endpoints.
const auditBefore = 'json:true,web:true});const audit=parseJson';
const auditAfter = 'json:true,web:false});const audit=parseJson';
if (source.includes(auditBefore)) {
  source = source.replaceAll(auditBefore, auditAfter);
  changes += 1;
}

// L'arbitre doit également répondre en JSON strict à partir des preuves déjà collectées.
const arbitrationBefore = 'json:true,web:true});const arbitration=parseJson';
const arbitrationAfter = 'json:true,web:false});const arbitration=parseJson';
if (source.includes(arbitrationBefore)) {
  source = source.replaceAll(arbitrationBefore, arbitrationAfter);
  changes += 1;
}

// Remplace le message générique par un diagnostic exploitable, sans exposer la clé API.
const errorBefore = 'const payload=await response.json().catch(()=>({})); if(!response.ok) throw new Error(payload?.error?.message||`Erreur OpenRouter ${response.status}`); const message=';
const errorAfter = `const payload=await response.json().catch(()=>({})); if(!response.ok) {\n    const provider = payload?.error?.metadata?.provider_name || payload?.provider || "inconnu";\n    const raw = payload?.error?.metadata?.raw || payload?.error?.metadata?.body || "";\n    console.error("OpenRouter request failed", { status: response.status, model, provider, message: payload?.error?.message, raw: String(raw).slice(0, 1200) });\n    throw new Error(\`OpenRouter \${response.status} — modèle \${model} — fournisseur \${provider} : \${payload?.error?.message || "erreur non documentée"}\`);\n  } const message=`;
if (source.includes(errorBefore)) {
  source = source.replace(errorBefore, errorAfter);
  changes += 1;
}

// Le numéro de release est lu dans package.json et exposé par /api/health.
const releasePattern = /res\.json\(\{ok:true,(?:release:"[^"]+",)?database,/;
const releaseReplacement = `res.json({ok:true,release:"${release}",database,`;
if (releasePattern.test(source)) {
  source = source.replace(releasePattern, releaseReplacement);
  changes += 1;
}

fs.writeFileSync(serverPath, source, 'utf8');
console.log(`Correctifs d'exécution appliqués : ${changes} · release ${release}`);
