const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const packagePath = path.join(root, 'package.json');
const release = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
let source = fs.readFileSync(serverPath, 'utf8');
let changes = 0;

function replaceOnce(before, after) {
  if (source.includes(before)) {
    source = source.replace(before, after);
    changes += 1;
  }
}

// Dépendances d'upload et d'extraction documentaire.
replaceOnce(
  'import { v4 as uuidv4 } from "uuid";',
  'import { v4 as uuidv4 } from "uuid";\nimport multer from "multer";\nimport mammoth from "mammoth";\nimport pdfParse from "pdf-parse";'
);

// L'auditeur et l'arbitre reçoivent déjà le dossier de preuves Firecrawl.
replaceOnce('json:true,web:true});const audit=parseJson', 'json:true,web:false});const audit=parseJson');
replaceOnce('json:true,web:true});const arbitration=parseJson', 'json:true,web:false});const arbitration=parseJson');

// Diagnostic OpenRouter détaillé, sans exposer la clé.
const errorBefore = 'const payload=await response.json().catch(()=>({})); if(!response.ok) throw new Error(payload?.error?.message||`Erreur OpenRouter ${response.status}`); const message=';
const errorAfter = `const payload=await response.json().catch(()=>({})); if(!response.ok) {\n    const provider = payload?.error?.metadata?.provider_name || payload?.provider || "inconnu";\n    const raw = payload?.error?.metadata?.raw || payload?.error?.metadata?.body || "";\n    console.error("OpenRouter request failed", { status: response.status, model, provider, message: payload?.error?.message, raw: String(raw).slice(0, 1200) });\n    throw new Error(\`OpenRouter \${response.status} — modèle \${model} — fournisseur \${provider} : \${payload?.error?.message || "erreur non documentée"}\`);\n  } const message=`;
replaceOnce(errorBefore, errorAfter);

// Upload ciblé : 5 fichiers, 10 Mo chacun, mémoire uniquement.
if (!source.includes('const documentUpload = multer(')) {
  const marker = 'async function executeJob(job,user,body)';
  const helpers = `const allowedDocumentExtensions = new Set([".txt", ".md", ".csv", ".json", ".pdf", ".docx", ".xlsx"]);\nconst documentUpload = multer({\n  storage: multer.memoryStorage(),\n  limits: { fileSize: 10 * 1024 * 1024, files: 5, fields: 12, parts: 20 },\n  fileFilter: (_req, file, callback) => {\n    const extension = path.extname(file.originalname || "").toLowerCase();\n    callback(allowedDocumentExtensions.has(extension) ? null : new Error(\`Type de fichier non pris en charge : \${extension || file.mimetype}\`), allowedDocumentExtensions.has(extension));\n  }\n});\nfunction handleDocumentUploads(req, res, next) {\n  documentUpload.array("files", 5)(req, res, error => {\n    if (!error) return next();\n    const message = error.code === "LIMIT_FILE_SIZE" ? "Un fichier dépasse la limite de 10 Mo." : error.code === "LIMIT_FILE_COUNT" ? "Maximum 5 fichiers par analyse." : error.message;\n    return res.status(400).json({ error: message });\n  });\n}\nasync function extractUploadedDocument(file) {\n  const extension = path.extname(file.originalname || "").toLowerCase();\n  let text = "";\n  if ([".txt", ".md", ".csv"].includes(extension)) text = file.buffer.toString("utf8");\n  else if (extension === ".json") {\n    const value = JSON.parse(file.buffer.toString("utf8"));\n    text = JSON.stringify(value, null, 2);\n  } else if (extension === ".pdf") {\n    const parsed = await pdfParse(file.buffer);\n    text = parsed.text || "";\n  } else if (extension === ".docx") {\n    const parsed = await mammoth.extractRawText({ buffer: file.buffer });\n    text = parsed.value || "";\n  } else if (extension === ".xlsx") {\n    const workbook = new ExcelJS.Workbook();\n    await workbook.xlsx.load(file.buffer);\n    const lines = [];\n    workbook.eachSheet(sheet => {\n      lines.push(\`# Feuille : \${sheet.name}\`);\n      sheet.eachRow(row => lines.push(row.values.slice(1).map(value => typeof value === "object" ? JSON.stringify(value) : String(value ?? "")).join(" | ")));\n    });\n    text = lines.join("\\n");\n  }\n  text = String(text).replace(/\\u0000/g, "").trim();\n  if (!text) throw new Error(\`Aucun texte exploitable extrait de \${file.originalname}.\`);\n  const truncated = text.length > 60000;\n  return { name: file.originalname, type: extension.slice(1), size: file.size, characters: Math.min(text.length, 60000), truncated, text: text.slice(0, 60000) };\n}\nasync function extractUploadedDocuments(files = []) {\n  const documents = [];\n  for (const file of files) documents.push(await extractUploadedDocument(file));\n  return documents;\n}\n\n`;
  if (source.includes(marker)) {
    source = source.replace(marker, helpers + marker);
    changes += 1;
  }
}

// Ajout des documents extraits au contexte transmis aux modèles.
replaceOnce(
  'const request=String(body.request||"").trim();if(request.length<20)throw new Error("La demande doit contenir au moins 20 caractères.");',
  'const baseRequest=String(body.request||"").trim();const attachments=Array.isArray(body.attachments)?body.attachments:[];if(baseRequest.length<20&&!attachments.length)throw new Error("La demande doit contenir au moins 20 caractères ou inclure un document.");const attachmentContext=attachments.map((document,index)=>`DOCUMENT ${index+1} — ${document.name}${document.truncated?" (extrait limité à 60 000 caractères)":""}:\\n${document.text}`).join("\\n\\n");const request=attachmentContext?`${baseRequest}\\n\\nDOCUMENTS FOURNIS PAR L’UTILISATEUR :\\n${attachmentContext}`:baseRequest;'
);
replaceOnce(
  'const result={id:job.id,request,taskType:task,models,versions:[],audits:[],calls:[],sources:[],totalCost:0,status:"running",createdAt:new Date().toISOString()};',
  'const result={id:job.id,request:baseRequest,attachments:attachments.map(({name,type,size,characters,truncated})=>({name,type,size,characters,truncated})),taskType:task,models,versions:[],audits:[],calls:[],sources:[],analysisLog:[],totalCost:0,status:"running",createdAt:new Date().toISOString()};'
);
replaceOnce(
  'emit(job,"models",{message:"Modèles sélectionnés",task,models});emit(job,"progress",{step:"draft",percent:8,message:"Rédaction initiale avec recherche web"});',
  'emit(job,"models",{message:"Modèles sélectionnés",task,models});emit(job,"insight",{category:"strategy",message:`Tâche classée « ${task} ». Claude rédige, GPT audite et Grok arbitre.`,details:{models}});if(attachments.length)emit(job,"insight",{category:"documents",message:`${attachments.length} document(s) extrait(s) et ajouté(s) au contexte.`,details:{files:result.attachments}});emit(job,"progress",{step:"draft",percent:8,message:"Rédaction initiale avec recherche web"});'
);
replaceOnce(
  'result.totalCost+=first.usage.cost;\n  for(let cycle=1;',
  'result.totalCost+=first.usage.cost;emit(job,"insight",{category:"draft",message:`Le rédacteur a produit une première version de ${document.length.toLocaleString("fr-FR")} caractères.`,details:{model:first.model,citations:first.annotations?.length||0}});\n  for(let cycle=1;'
);
replaceOnce(
  'result.sources=verified;emit(job,"progress",{step:"audit"',
  'result.sources=verified;emit(job,"insight",{category:"sources",message:`Sources contrôlées : ${verified.filter(source=>source.accessible).length} accessibles, ${verified.filter(source=>!source.accessible).length} non vérifiées.`,details:{total:verified.length}});emit(job,"progress",{step:"audit"'
);
replaceOnce(
  'emit(job,"audit",{cycle,score:audit.score_global,scores:audit.scores,anomalies:audit.anomalies?.length||0});',
  'emit(job,"audit",{cycle,score:audit.score_global,scores:audit.scores,anomalies:audit.anomalies?.length||0});emit(job,"insight",{category:"audit",message:`Cycle ${cycle} : score ${audit.score_global}/100, ${audit.anomalies?.length||0} anomalie(s). ${audit.resume||""}`,details:{scores:audit.scores,decision:audit.decision}});'
);
replaceOnce(
  'result.arbitration=arbitration;result.finalDocument=document;',
  'result.arbitration=arbitration;emit(job,"insight",{category:"arbitration",message:`Arbitrage Grok : ${arbitration.decision} avec une confiance de ${arbitration.confiance??"—"}/100.`,details:{motifs:arbitration.motifs,reserves:arbitration.reserves}});result.finalDocument=document;'
);

// Remplacement de la route JSON par une route multipart ciblée.
const routeStart = source.indexOf('app.post("/api/jobs"');
const routeEnd = source.indexOf('app.get("/api/jobs/:id/events"', routeStart);
if (routeStart !== -1 && routeEnd !== -1 && !source.slice(routeStart, routeEnd).includes('handleDocumentUploads')) {
  const route = `app.post("/api/jobs",requireAuth,handleDocumentUploads,async(req,res)=>{try{const attachments=await extractUploadedDocuments(req.files||[]);const body={...req.body,attachments,autoModel:req.body.autoModel!=="false",maxCycles:Number(req.body.maxCycles||3),minScore:Number(req.body.minScore||90)};const id=uuidv4();const job={id,userId:req.effectiveUser.id,events:[],clients:new Set(),status:"queued",result:null};jobs.set(id,job);res.status(202).json({id,attachments:attachments.map(({name,type,size,characters,truncated})=>({name,type,size,characters,truncated}))});executeJob(job,req.effectiveUser,body).catch(error=>{job.status="error";job.error=error.message;console.error("Job failed",{jobId:id,message:error.message,stack:error.stack});emit(job,"error",{message:error.message});});}catch(error){console.error("Document upload failed",{message:error.message});res.status(400).json({error:error.message});}});\n`;
  source = source.slice(0, routeStart) + route + source.slice(routeEnd);
  changes += 1;
}

// Numéro de release exposé par /api/health.
const releasePattern = /res\.json\(\{ok:true,(?:release:"[^"]+",)?database,/;
if (releasePattern.test(source)) {
  source = source.replace(releasePattern, `res.json({ok:true,release:"${release}",database,`);
  changes += 1;
}

fs.writeFileSync(serverPath, source, 'utf8');
console.log(`Correctifs d'exécution appliqués : ${changes} · release ${release}`);
