const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const appPath = path.join(root, 'public', 'app.js');
let changes = 0;

let server = fs.readFileSync(serverPath, 'utf8');
let app = fs.readFileSync(appPath, 'utf8');

// L'absence volontaire de contrôle Firecrawl ne doit pas être traitée comme
// un échec d'accessibilité ni provoquer mécaniquement une mauvaise note.
const auditMarker = 'Chaque score est sur 100.';
const auditRule = ' RÈGLE DE NOTATION DES SOURCES : accessible=true signifie contrôlée et accessible ; accessible=false signifie contrôle tenté mais en échec ; accessible=null signifie source trouvée par OpenRouter mais non contrôlée parce que Firecrawl est désactivé. Une source accessible=null ne doit jamais être qualifiée d’inaccessible ou d’échec Firecrawl et la désactivation volontaire de Firecrawl ne doit pas, à elle seule, diminuer la note. Évalue néanmoins la traçabilité des URL, la qualité des domaines et l’appui réel des affirmations.';
if (server.includes(auditMarker) && !server.includes('accessible=null signifie source trouvée')) {
  server = server.replace(auditMarker, auditMarker + auditRule);
  changes += 1;
}

// Résumé de contrôle : distinguer les quatre états au lieu de regrouper les
// sources non contrôlées avec les véritables erreurs techniques.
server = server.replace(
  /Sources contrôlées\s*:\s*\$\{[^`]+?non vérifiées\.?/g,
  'Sources : ${verified.filter(s=>s.accessible===true).length} accessibles, ${verified.filter(s=>s.accessible===false).length} inaccessibles, ${verified.filter(s=>s.accessible===null).length} non contrôlées, ${verified.filter(s=>s.accessible===false && /HTTP|timeout|fetch|Firecrawl|clé|API/i.test(String(s.reason||""))).length} erreurs de contrôle.'
);

// Affichage détaillé : état explicite, sans classe d'erreur pour les sources
// simplement non contrôlées.
const renderSourcesPattern = /function renderSources\(sources\)\{[\s\S]*?\}\nfunction renderUsage/;
if (renderSourcesPattern.test(app)) {
  app = app.replace(renderSourcesPattern, `function sourceState(source){
  if(source.accessible===true)return{key:'accessible',label:'Accessible',detail:'Page extraite et contrôlée par Firecrawl',css:'ok'};
  if(source.accessible===null)return{key:'unchecked',label:'Non contrôlée',detail:source.reason||'Contrôle Firecrawl désactivé',css:'unchecked'};
  const technical=/HTTP|timeout|fetch|Firecrawl|clé|API|quota|rate/i.test(String(source.reason||''));
  return technical?{key:'error',label:'Erreur de contrôle',detail:source.reason||'Erreur Firecrawl',css:'warn'}:{key:'inaccessible',label:'Inaccessible',detail:source.reason||'La page n’a pas pu être extraite',css:'bad'};
}
function renderSources(sources){
  if(!sources.length)return '<p>Aucune source structurée détectée par OpenRouter.</p>';
  const states=sources.map(sourceState);
  const count=key=>states.filter(state=>state.key===key).length;
  const summary=\`<div class="source-summary"><span>Accessibles : <b>\${count('accessible')}</b></span><span>Inaccessibles : <b>\${count('inaccessible')}</b></span><span>Non contrôlées : <b>\${count('unchecked')}</b></span><span>Erreurs de contrôle : <b>\${count('error')}</b></span></div>\`;
  const cards=sources.map((source,index)=>{const state=states[index];return \`<article class="source \${state.css}"><div><b>\${esc(source.title||source.url)}</b><span class="source-status \${state.css}">\${state.label}</span></div><a href="\${esc(source.url)}" target="_blank" rel="noopener">\${esc(source.url)}</a><p>\${esc(state.detail)}</p><small>\${esc(source.sourceClass)}</small></article>\`;}).join('');
  return summary+\`<div class="source-grid">\${cards}</div>\`;
}
function renderUsage`);
  changes += 1;
}

fs.writeFileSync(serverPath, server, 'utf8');
fs.writeFileSync(appPath, app, 'utf8');
console.log(\`Statuts de vérification des sources corrigés : \${changes}\`);
