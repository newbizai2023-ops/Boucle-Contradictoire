const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
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

update(serverPath, source => {
  if (source.includes('function extractMessageText(message)')) return source;
  const start = source.indexOf('async function callOpenRouter(');
  const end = source.indexOf('\nfunction parseJson(', start);
  if (start < 0 || end < 0) throw new Error('Fonction callOpenRouter introuvable.');

  const replacement = `function extractMessageText(message) {
  const content = message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map(part => typeof part === "string" ? part : part?.text || part?.content || "").join("\\n").trim();
  if (content && typeof content === "object") return String(content.text || content.content || "").trim();
  return "";
}
async function requestOpenRouter({apiKey,model,system,user,json=false,web=true}) {
  const body={model,messages:[{role:"system",content:system},{role:"user",content:user}],temperature:.1,max_tokens:7000,provider:{allow_fallbacks:true,data_collection:"deny"}};
  if(json) body.response_format={type:"json_object"};
  if(web) body.tools=[{type:"openrouter:web_search",parameters:{engine:"auto",search_context_size:"high",max_total_results:10}}];
  console.info(\`[openrouter] appel modèle=\${model} web=\${web}\`);
  const response=await fetch(OPENROUTER_URL,{method:"POST",headers:{Authorization:\`Bearer \${apiKey}\`,"Content-Type":"application/json","HTTP-Referer":APP_URL,"X-OpenRouter-Title":"Boucle Contradictoire"},body:JSON.stringify(body),signal:AbortSignal.timeout(240000)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){console.error(\`[openrouter] HTTP \${response.status}: \${payload?.error?.message || "erreur sans détail"}\`);throw new Error(payload?.error?.message||\`Erreur OpenRouter \${response.status}\`);}
  const message=payload?.choices?.[0]?.message;
  return {content:extractMessageText(message),annotations:message?.annotations||[],model:payload.model||model,provider:payload.provider||null,usage:usageOf(payload.usage),finishReason:payload?.choices?.[0]?.finish_reason||null};
}
async function callOpenRouter(args) {
  const primary=await requestOpenRouter(args);
  if(primary.content) return primary;
  console.warn(\`[openrouter] réponse vide modèle=\${args.model} web=\${args.web}; nouvel essai sans recherche web\`);
  const retry=await requestOpenRouter({...args,web:false});
  if(retry.content) return retry;
  if(String(args.model).includes("moonshotai/kimi")) {
    const fallback="~anthropic/claude-sonnet-latest";
    console.warn(\`[openrouter] bascule de \${args.model} vers \${fallback} après deux réponses vides\`);
    const alternative=await requestOpenRouter({...args,model:fallback,web:args.web});
    if(alternative.content) return {...alternative,fallbackFrom:args.model};
  }
  throw new Error(\`Réponse vide du modèle \${args.model} après nouvel essai.\`);
}`;
  return source.slice(0, start) + replacement + source.slice(end);
});

update(stylePath, css => {
  if (css.includes('/* timeline-mobile-fix */')) return css;
  return css + `\n/* timeline-mobile-fix */\n.activity-feed{overflow-x:hidden}.feed-item{min-width:0}.feed-item>div{min-width:0}.feed-item time{display:block;margin-bottom:3px}.feed-item p{overflow-wrap:anywhere;word-break:break-word}.feed-item.error>div{border:1px solid color-mix(in srgb,var(--danger) 42%,var(--line));background:color-mix(in srgb,var(--danger) 14%,transparent);border-radius:14px;padding:12px}.feed-item.error{padding-bottom:14px}@media(max-width:650px){.activity-feed{max-height:none}.feed-item{grid-template-columns:14px minmax(0,1fr);gap:9px}.feed-marker{width:13px;height:13px}.feed-item:not(:last-child)::before{left:6px}.feed-item p{font-size:.88rem;line-height:1.45}.feed-item.error>div{padding:11px}.current-step{font-size:1rem}}\n`;
});

const finalServer = fs.readFileSync(serverPath, 'utf8');
if (!finalServer.includes('fallbackFrom:args.model')) throw new Error('La stratégie de repli modèle n’a pas été appliquée.');
console.log(`Réponses modèles vides et fil mobile corrigés : ${changes} fichier(s) modifié(s).`);
