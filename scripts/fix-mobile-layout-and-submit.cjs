const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const appPath = path.join(root, 'public', 'app.js');
const stylePath = path.join(root, 'public', 'styles.css');
let changes = 0;

function update(filePath, transform) {
  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after, 'utf8');
    changes += 1;
  }
}

update(appPath, source => {
  if (!source.includes('function isChecked(selector)')) {
    const anchor = "const esc = value => String(value ?? '').replace";
    const index = source.indexOf(anchor);
    if (index < 0) throw new Error('Point d’insertion JavaScript introuvable');
    const lineEnd = source.indexOf('\n', index);
    source = source.slice(0, lineEnd + 1) +
      "function isChecked(selector) { return Boolean($(selector)?.checked); }\n" +
      source.slice(lineEnd + 1);
  }

  // Couvre toutes les lectures directes restantes, même ajoutées par un script antérieur.
  source = source.replace(/\$\((['\"])#([^'\"]+)\1\)\.checked/g, (_match, quote, id) => `isChecked('#${id}')`);

  // Normalise également les formes déjà protégées afin d’éviter les régressions.
  source = source
    .replace(/Boolean\(\$\((['\"])#([^'\"]+)\1\)\?\.checked\)/g, (_match, quote, id) => `isChecked('#${id}')`)
    .replace("if (!enabled) toggle.checked = false;", "if (!enabled && toggle) toggle.checked = false;")
    .replace("toggle.disabled = !enabled;", "if (toggle) toggle.disabled = !enabled;");

  if (/\$\((['\"])#[^'\"]+\1\)\.checked/.test(source)) {
    throw new Error('Une lecture directe de .checked subsiste dans public/app.js');
  }
  return source;
});

update(stylePath, css => {
  const marker = '/* mobile-layout-v2 */';
  if (css.includes(marker)) return css;
  return css + `\n${marker}\n@media(max-width:1200px){
  header,main,footer{width:min(100% - 24px,900px)}
  main{grid-template-columns:minmax(0,1fr);gap:14px}
  .form-panel{position:static;top:auto}
  .results-panel{min-height:420px}
  .full{grid-column:auto}
  .api-service-grid{grid-template-columns:1fr}
  .api-service-card{min-width:0;align-items:flex-start;flex-wrap:wrap}
  .api-service-card>div{min-width:0;flex:1 1 180px}
  .service-status{max-width:100%;white-space:normal;text-align:center}
}
@media(max-width:720px){
  header,main,footer{width:calc(100% - 16px)}
  body>header{padding:18px 0 14px}
  h1{font-size:2rem}
  .panel{padding:14px;border-radius:16px}
  .grid,.metrics,.source-grid,.compact-grid{grid-template-columns:minmax(0,1fr)}
  .grid>div:last-child:nth-child(3){grid-column:auto}
  textarea{min-height:230px}
  .option-card{padding:12px}
  .section-title{align-items:flex-start;flex-wrap:wrap}
  .results-panel{min-height:360px}
  .empty{min-height:300px}
  .api-service-card{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
  .service-status{justify-self:start}
  table{min-width:620px}
}
`;
});

console.log(`Correction mobile et soumission appliquée : ${changes} fichier(s) modifié(s).`);
