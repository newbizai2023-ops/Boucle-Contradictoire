const fs = require('node:fs');
const path = require('node:path');

const serverPath = path.join(__dirname, '..', 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');
const opusModel = '~anthropic/claude-opus-latest';
const sonnetModel = '~anthropic/claude-sonnet-latest';
const occurrences = source.split(opusModel).length - 1;

if (occurrences > 0) {
  source = source.replaceAll(opusModel, sonnetModel);
  fs.writeFileSync(serverPath, source, 'utf8');
}

console.log(`Mode économique de test : ${occurrences} référence(s) Opus remplacée(s) par Sonnet.`);
