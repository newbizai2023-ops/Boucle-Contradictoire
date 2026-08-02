const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');
let changes = 0;

function replaceOnce(before, after) {
  if (source.includes(before)) {
    source = source.replace(before, after);
    changes += 1;
  }
}

// Le compte de contournement de développement doit exister en base afin que
// les exécutions puissent être conservées malgré la clé étrangère runs.user_id.
if (!source.includes('dev-bypass-local')) {
  replaceOnce(
    '}\n\nconst writerSystem',
    '  await pool.query(`INSERT INTO users (id,google_id,email,name) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,updated_at=NOW()`, ["00000000-0000-0000-0000-000000000001", "dev-bypass-local", "dev@local", "Développeur"]);\n}\n\nconst writerSystem'
  );
}

// Ne plus exclure le compte DEV_BYPASS_AUTH de la persistance PostgreSQL.
replaceOnce(
  'async function saveRun(userId,result,request,task,models){if(!pool||userId==="00000000-0000-0000-0000-000000000001")return;',
  'async function saveRun(userId,result,request,task,models){if(!pool)return;'
);

// Dès qu'une base est disponible, l'historique et le dashboard doivent la lire,
// y compris pour le compte de développement. La mémoire reste un repli local.
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

// Le formulaire multipart transmet uniquement l'état de Firecrawl.
replaceOnce(
  'attachments,autoModel:req.body.autoModel!=="false",maxCycles:',
  'attachments,autoModel:req.body.autoModel!=="false",firecrawl:req.body.firecrawl!=="false",maxCycles:'
);

fs.writeFileSync(serverPath, source, 'utf8');
console.log(`Persistance historique / contrôle Firecrawl appliqués : ${changes}`);
