const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const appPath = path.join(root, 'public', 'app.js');
const stylesPath = path.join(root, 'public', 'styles.css');
let app = fs.readFileSync(appPath, 'utf8');
let styles = fs.readFileSync(stylesPath, 'utf8');
let changes = 0;

function replaceOnce(text, before, after) {
  if (!text.includes(before)) return text;
  changes += 1;
  return text.replace(before, after);
}

app = replaceOnce(
  app,
  "function renderSelectedFiles(){ const files=[...$('#files').files]; $('#fileList').innerHTML=files.map(file=>`<span class=\"file-chip\">${esc(file.name)} · ${(file.size/1024/1024).toFixed(2)} Mo</span>`).join(''); }",
  `function renderSelectedFiles(){
  const files=[...$('#files').files];
  $('#fileList').innerHTML=files.map((file,index)=>\`<span class="file-chip"><span class="file-chip-label">\${esc(file.name)} · \${(file.size/1024/1024).toFixed(2)} Mo</span><button type="button" class="file-remove" data-file-index="\${index}" aria-label="Supprimer \${esc(file.name)}" title="Supprimer ce document">×</button></span>\`).join('');
  $('#fileList').setAttribute('aria-label', files.length ? \`\${files.length} document\${files.length>1?'s':''} sélectionné\${files.length>1?'s':''}\` : 'Aucun document sélectionné');
}
function removeSelectedFile(index){
  const input=$('#files');
  const transfer=new DataTransfer();
  [...input.files].forEach((file,fileIndex)=>{ if(fileIndex!==index) transfer.items.add(file); });
  input.files=transfer.files;
  renderSelectedFiles();
}
$('#fileList').addEventListener('click',event=>{
  const button=event.target.closest('.file-remove');
  if(!button) return;
  removeSelectedFile(Number(button.dataset.fileIndex));
});`
);

app = replaceOnce(
  app,
  "function addTimeline(text,type='progress'){ const li=document.createElement('li'); li.className=`feed-item ${type}`; const time=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); li.innerHTML=`<span class=\"feed-marker\" aria-hidden=\"true\"></span><div><time>${esc(time)}</time><p>${esc(text)}</p></div>`; $('#timeline').append(li); li.scrollIntoView({block:'nearest'}); }",
  `function scrollFeedToLatest(feed){
  requestAnimationFrame(()=>{
    feed.scrollTo({top:feed.scrollHeight,behavior:'smooth'});
  });
}
function addTimeline(text,type='progress'){
  const feed=$('#timeline');
  const li=document.createElement('li');
  li.className=\`feed-item \${type}\`;
  const time=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  li.innerHTML=\`<span class="feed-marker" aria-hidden="true"></span><div><time>\${esc(time)}</time><p>\${esc(text)}</p></div>\`;
  feed.append(li);
  scrollFeedToLatest(feed);
}`
);

app = replaceOnce(
  app,
  "function addAnalysis(data){ const article=document.createElement('article'); article.className=`analysis-entry ${data.category||'general'}`; const time=new Date(data.at||Date.now()).toLocaleTimeString(); article.innerHTML=`<div><span>${esc(data.category||'analyse')}</span><time>${esc(time)}</time></div><p>${esc(data.message||'')}</p>${data.details?`<details><summary>Détails</summary><pre>${esc(JSON.stringify(data.details,null,2))}</pre></details>`:''}`; $('#analysisFeed').append(article); article.scrollIntoView({block:'nearest'}); }",
  `function addAnalysis(data){
  const feed=$('#analysisFeed');
  const article=document.createElement('article');
  article.className=\`analysis-entry \${data.category||'general'}\`;
  const time=new Date(data.at||Date.now()).toLocaleTimeString();
  article.innerHTML=\`<div><span>\${esc(data.category||'analyse')}</span><time>\${esc(time)}</time></div><p>\${esc(data.message||'')}</p>\${data.details?\`<details><summary>Détails</summary><pre>\${esc(JSON.stringify(data.details,null,2))}</pre></details>\`:''}\`;
  feed.append(article);
  scrollFeedToLatest(feed);
}`
);

const css = `.file-chip{display:inline-flex;align-items:center;gap:7px;padding:4px 5px 4px 10px}.file-chip-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px}.file-remove{display:grid;place-items:center;width:25px;height:25px;padding:0;border-radius:50%;background:transparent;color:var(--muted);font-size:1.1rem;line-height:1}.file-remove:hover,.file-remove:focus-visible{background:color-mix(in srgb,var(--danger) 18%,transparent);color:#fff;outline:2px solid color-mix(in srgb,var(--danger) 45%,transparent)}.activity-feed,.analysis-feed{scroll-behavior:smooth;overscroll-behavior:contain;scrollbar-gutter:stable}.activity-feed{min-height:90px}@media(max-width:650px){.file-chip{max-width:100%}.file-chip-label{max-width:calc(100vw - 115px)}.activity-feed{max-height:330px}}`;
if (!styles.includes('.file-remove{')) {
  styles += css;
  changes += 1;
}

fs.writeFileSync(appPath, app, 'utf8');
fs.writeFileSync(stylesPath, styles, 'utf8');
console.log(`Suppression des fichiers et défilement du fil appliqués : ${changes}`);
