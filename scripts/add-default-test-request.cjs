const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

const defaultRequest = `Analyse la question suivante :

**Une entreprise de 100 salariés a-t-elle intérêt à remplacer tous les ordinateurs portables tous les trois ans plutôt que tous les cinq ans ?**

Présente :

- les avantages et les inconvénients des deux stratégies ;

- les impacts financiers, opérationnels, environnementaux et de sécurité ;

- les hypothèses utilisées ;

- une recommandation finale argumentée.

Vérifie les informations importantes à l’aide de sources récentes et fiables. Indique clairement les points qui ne peuvent pas être confirmés.`;

const escapedRequest = defaultRequest
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const textareaPattern = /<textarea id="request"([^>]*)>[\s\S]*?<\/textarea>/;

if (!textareaPattern.test(html)) {
  throw new Error('Le champ « Demande à traiter » est introuvable dans public/index.html.');
}

const updated = html.replace(
  textareaPattern,
  `<textarea id="request"$1>${escapedRequest}</textarea>`
);

if (updated !== html) {
  fs.writeFileSync(indexPath, updated, 'utf8');
  console.log('Prompt de test ajouté par défaut au champ « Demande à traiter ».');
} else {
  console.log('Prompt de test déjà présent dans le champ « Demande à traiter ».');
}
