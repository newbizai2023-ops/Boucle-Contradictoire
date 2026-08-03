const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'public', 'index.html');
const appPath = path.join(root, 'public', 'app.js');
const stylePath = path.join(root, 'public', 'styles.css');
let changes = 0;

function updateFile(filePath, transform) {
  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after, 'utf8');
    changes += 1;
  }
}

updateFile(indexPath, html => {
  if (html.includes('id="temporaryKeys"')) return html;
  const start = html.indexOf('      <div class="form-section">\n        <div class="section-heading"><span class="step-number">3</span><div><h2>Clés API</h2>');
  if (start < 0) throw new Error('Section des clés API introuvable dans public/index.html');
  const endMarker = '      </div>\n\n      <button id="submitButton"';
  const end = html.indexOf(endMarker, start);
  if (end < 0) throw new Error('Fin de la section des clés API introuvable');
  const replacement = `      <div class="form-section api-configuration">\n        <div class="section-heading"><span class="step-number">3</span><div><h2>Services API</h2><p>Les clés configurées dans Render restent secrètes et ne sont jamais affichées.</p></div></div>\n        <div class="api-service-grid" aria-live="polite">\n          <article class="api-service-card"><div><strong>OpenRouter</strong><small>Modèles et recherche Web</small></div><span id="openrouterServerStatus" class="service-status checking">Vérification…</span></article>\n          <article class="api-service-card"><div><strong>Firecrawl</strong><small>Contrôle approfondi des sources</small></div><span id="firecrawlServerStatus" class="service-status checking">Vérification…</span></article>\n        </div>\n        <details id="temporaryKeys" class="advanced-settings">\n          <summary>Utiliser exceptionnellement des clés temporaires</summary>\n          <p>Ces valeurs remplacent les clés Render uniquement pour cette analyse. Elles ne sont ni enregistrées dans l’historique ni affichées après l’envoi.</p>\n          <div class="grid api-key-grid">\n            <div class="field"><label for="apiKey">Clé OpenRouter temporaire</label><div class="input-status"><input id="apiKey" type="password" autocomplete="new-password" spellcheck="false" placeholder="sk-or-v1-…" aria-describedby="apiKeyHelp"><span id="apiKeyIcon" aria-hidden="true"></span></div><small id="apiKeyHelp">Laisse vide pour utiliser la clé configurée dans Render.</small></div>\n            <div class="field"><label for="firecrawlApiKey">Clé Firecrawl temporaire</label><div class="input-status"><input id="firecrawlApiKey" type="password" autocomplete="new-password" spellcheck="false" placeholder="fc-…" aria-describedby="firecrawlKeyHelp"><span id="firecrawlKeyIcon" aria-hidden="true"></span></div><small id="firecrawlKeyHelp">Laisse vide pour utiliser la clé configurée dans Render.</small></div>\n          </div>\n        </details>\n      </div>\n\n`;
  return html.slice(0, start) + replacement + html.slice(end + '      </div>\n\n'.length);
});

updateFile(appPath, js => {
  if (js.includes('function renderServerApiStatus')) return js;
  const anchor = 'async function init() {';
  if (!js.includes(anchor)) throw new Error('Fonction init introuvable dans public/app.js');
  const helper = `function renderServerApiStatus(health) {\n  const items = [\n    ['#openrouterServerStatus', Boolean(health.hasOpenRouterKey)],\n    ['#firecrawlServerStatus', Boolean(health.hasFirecrawlKey)]\n  ];\n  for (const [selector, configured] of items) {\n    const node = $(selector);\n    if (!node) continue;\n    node.textContent = configured ? 'Configurée sur Render' : 'Non configurée';\n    node.className = \`service-status \${configured ? 'configured' : 'missing'}\`;\n  }\n  const details = $('#temporaryKeys');\n  if (details && (!health.hasOpenRouterKey || !health.hasFirecrawlKey)) details.open = true;\n}\n\n`;
  js = js.replace(anchor, helper + anchor);
  const healthAnchor = '  healthState = health;';
  if (!js.includes(healthAnchor)) throw new Error('Affectation healthState introuvable');
  return js.replace(healthAnchor, `${healthAnchor}\n  renderServerApiStatus(health);`);
});

updateFile(stylePath, css => {
  if (css.includes('.api-service-grid{')) return css;
  return css + `.api-service-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:8px 0 12px}.api-service-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025)}.api-service-card strong{display:block}.api-service-card small{margin-top:3px}.service-status{flex:0 0 auto;border-radius:999px;padding:7px 10px;font-size:.72rem;font-weight:850;border:1px solid var(--line)}.service-status.configured{color:var(--success);border-color:color-mix(in srgb,var(--success) 45%,var(--line));background:color-mix(in srgb,var(--success) 9%,transparent)}.service-status.missing{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,var(--line));background:color-mix(in srgb,var(--warn) 8%,transparent)}.service-status.checking{color:var(--muted)}.advanced-settings{margin-top:10px;border:1px solid var(--line);border-radius:14px;background:var(--panel-soft);overflow:hidden}.advanced-settings summary{cursor:pointer;padding:13px 14px;font-weight:800;color:var(--text)}.advanced-settings[open] summary{border-bottom:1px solid var(--line)}.advanced-settings>p,.advanced-settings>.api-key-grid{margin-left:14px;margin-right:14px}.advanced-settings>.api-key-grid{margin-bottom:14px}@media(max-width:650px){.api-service-grid{grid-template-columns:1fr}.api-service-card{align-items:flex-start}.service-status{white-space:nowrap}}`;
});

console.log(`Présentation sécurisée des clés API appliquée : ${changes} fichier(s) modifié(s).`);
