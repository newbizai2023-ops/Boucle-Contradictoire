const fs = require('node:fs');
const path = require('node:path');

const appPath = path.join(__dirname, '..', 'public', 'app.js');
let source = fs.readFileSync(appPath, 'utf8');
const before = source;

source = source
  .replace("if ($('#webSearch').checked && !['valid','server'].includes(fireStatus))", "if (Boolean($('#webSearch')?.checked) && !['valid','server'].includes(fireStatus))")
  .replace("formData.append('autoModel',String($('#autoModel').checked));", "formData.append('autoModel',String(Boolean($('#autoModel')?.checked)));" )
  .replace("formData.append('webSearch',String($('#webSearch').checked));", "formData.append('webSearch',String(Boolean($('#webSearch')?.checked)));" )
  .replace("$('#autoModel').addEventListener('change', e => $('#models').classList.toggle('disabled', e.target.checked));", "$('#autoModel')?.addEventListener('change', e => $('#models')?.classList.toggle('disabled', Boolean(e.target?.checked)));" );

if (!source.includes("Boolean($('#autoModel')?.checked)")) {
  throw new Error('La sécurisation de autoModel n’a pas été appliquée.');
}
if (!source.includes("Boolean($('#webSearch')?.checked)")) {
  throw new Error('La sécurisation de webSearch n’a pas été appliquée.');
}

if (source !== before) fs.writeFileSync(appPath, source, 'utf8');
console.log(`Soumission protégée contre les éléments absents : ${source === before ? 0 : 1} fichier modifié.`);
