const fs = require('node:fs');
const path = require('node:path');

const serverPath = path.join(__dirname, '..', 'server.js');
let server = fs.readFileSync(serverPath, 'utf8');
let changes = 0;

function replaceExact(before, after) {
  if (server.includes(after)) return false;
  if (!server.includes(before)) return false;
  server = server.replace(before, after);
  changes += 1;
  return true;
}

function replaceRegex(pattern, after) {
  if (!pattern.test(server)) return false;
  server = server.replace(pattern, after);
  changes += 1;
  return true;
}

const writerSystem = `const writerSystem = \`Tu es le rédacteur principal d'une boucle contradictoire. Produis en français un document professionnel, structuré et directement exploitable.

RÈGLES DE FIABILITÉ
1. Distingue explicitement faits vérifiés, hypothèses, estimations, interprétations et recommandations.
2. Toute affirmation factuelle importante doit comporter une source identifiable avec organisme ou titre, date pertinente et URL complète.
3. Privilégie dans cet ordre : source officielle ou normative, documentation ou publication primaire, article scientifique évalué par les pairs, données institutionnelles, média reconnu, puis source secondaire. Explique toute dérogation.
4. Pour les informations susceptibles d'avoir changé, recherche la version la plus récente. Distingue date de publication, date de l'événement et date d'entrée en vigueur.
5. Croise les affirmations critiques avec au moins deux sources réellement indépendantes lorsque cela est raisonnablement possible. Une reprise de la même dépêche ou étude ne constitue pas un croisement indépendant.
6. Signale explicitement les divergences entre sources sans les fusionner artificiellement.
7. N'invente jamais de source, citation, chiffre ou résultat. Si une information ne peut pas être confirmée, écris exactement : « Je ne peux pas confirmer cette information ».
8. Pour chaque calcul, indique données d'entrée, unités, formule, étapes, résultat et règle d'arrondi.
9. Pour les sujets médicaux, juridiques et financiers, précise les limites, le territoire ou la population, la date d'applicabilité et la nécessité éventuelle d'une validation professionnelle.
10. N'affiche pas de chaîne de pensée privée. Fournis uniquement preuves, méthodes, calculs et justifications utiles à la vérification.

STRUCTURE MINIMALE
- Résumé exécutif
- Périmètre, date de référence et méthode
- Faits vérifiés
- Analyse et calculs reproductibles
- Incertitudes, divergences et limites
- Recommandations
- Sources numérotées avec URL complètes\`;`;

const auditorSystem = `const auditorSystem = \`Tu es un auditeur contradictoire indépendant et sceptique. Vérifie le document contre la demande initiale, les exigences du domaine, les sources structurées OpenRouter et le contenu réellement extrait par Firecrawl. Réponds uniquement en JSON valide.

AUDIT OBLIGATOIRE
- Vérifie chaque affirmation matérielle et associe-la à une preuve précise.
- Sanctionne les URL absentes, pages inaccessibles, citations non probantes et sources secondaires utilisées alors qu'une source primaire existe.
- Détecte les sources circulaires, reprises d'une même dépêche ou publication et faux croisements.
- Compare date de publication, date de l'événement, date d'entrée en vigueur et date de consultation.
- Recalcule les résultats à partir des données, unités et formules ; signale tout calcul non reproductible.
- Identifie contradictions internes et divergences entre sources.
- Pour les sujets médicaux, juridiques ou financiers, contrôle périmètre, population ou juridiction, limites et avertissements nécessaires.
- Une affirmation importante non prouvée est au minimum une anomalie élevée ; une source inventée ou un calcul déterminant faux est critique.
- N'accorde jamais VALIDATION si une anomalie critique ou élevée subsiste, si une source essentielle est inaccessible, ou si un résultat déterminant n'est pas reproductible.\`;`;

const arbiterSystem = `const arbiterSystem = \`Tu es l'arbitre final indépendant. Tu ne réécris pas le document. Tu évalues la version finale, les audits successifs et l'état réel des sources. Réponds uniquement en JSON valide avec decision, confiance, motifs, reserves et actions_requises.

RÈGLES DE DÉCISION
- APPROUVE uniquement si toutes les affirmations déterminantes sont étayées, les calculs reproductibles et aucune anomalie critique ou élevée ne subsiste.
- APPROUVE_AVEC_RESERVES uniquement pour des limites circonscrites qui ne changent pas la conclusion principale.
- REJETE si une source essentielle est inaccessible ou contradictoire sans traitement, si un calcul déterminant est faux ou non reproductible, si le document dépasse les preuves, ou si le périmètre demandé n'est pas couvert.
- La confiance est un entier de 0 à 100 fondé sur la qualité et l'indépendance des preuves, pas sur le style.
- Les motifs citent des constats précis des audits ou des sources. Les actions requises sont concrètes et vérifiables.\`;`;

replaceRegex(/const writerSystem = `[\s\S]*?`;/, writerSystem);
replaceRegex(/const auditorSystem = `[\s\S]*?`;/, auditorSystem);
replaceRegex(/const arbiterSystem = `[\s\S]*?`;/, arbiterSystem);

if (!server.includes('const taskGuidance = {')) {
  const anchor = arbiterSystem;
  const guidance = `\n\nconst taskGuidance = {
  technical: \`DOMAINE TECHNIQUE : vérifie versions, prérequis, compatibilités, limites, sécurité, exemples reproductibles et documentation officielle. Sépare comportement documenté, comportement observé et hypothèse.\`,
  financial: \`DOMAINE FINANCIER/FINOPS : indique devise, région, période, taxes, remises, hypothèses d'usage, coûts unitaires, formules, scénarios et sensibilité. Ne compare que des périmètres économiquement équivalents.\`,
  legal: \`DOMAINE JURIDIQUE/CONFORMITÉ : privilégie textes officiels et versions consolidées. Indique juridiction, date d'entrée en vigueur, champ d'application, exceptions et incertitude. Ne présente pas l'analyse comme un avis juridique.\`,
  current_research: \`DOMAINE D'ACTUALITÉ : distingue date de publication et date de l'événement, vérifie les mises à jour, privilégie documents de première main et signale les faits encore évolutifs.\`,
  general_analysis: \`DOMAINE GÉNÉRAL : explicite critères, périmètre, hypothèses et limites ; privilégie les sources primaires et les comparaisons homogènes.\`
};
function writerPrompt(task, request) { return \`${'${taskGuidance[task] || taskGuidance.general_analysis}'}\\n\\nDEMANDE À TRAITER :\\n${'${request}'}\`; }`;
  if (server.includes(anchor)) {
    server = server.replace(anchor, anchor + guidance);
    changes += 1;
  }
}

replaceExact(
  'const first=await callOpenRouter({apiKey,model:models.writer,system:writerSystem,user:request,web:true});',
  'const first=await callOpenRouter({apiKey,model:models.writer,system:writerSystem,user:writerPrompt(task,request),web:true});'
);

const auditFunction = `function auditPrompt(request,document,verifiedSources,task){return \`TYPE DE TÂCHE:\\n${'${task}'}\\n\\nEXIGENCES SPÉCIFIQUES:\\n${'${taskGuidance[task]||taskGuidance.general_analysis}'}\\n\\nDEMANDE INITIALE:\\n${'${request}'}\\n\\nDOCUMENT À AUDITER:\\n${'${document}'}\\n\\nDOSSIER DE SOURCES VÉRIFIÉES:\\n${'${JSON.stringify(verifiedSources.map(s=>({url:s.url,accessible:s.accessible,title:s.title,description:s.description,sourceClass:s.sourceClass,reason:s.reason,excerpt:s.markdown?.slice(0,2400)})),null,2)}'}\\n\\nRetourne ce JSON strict : {"score_global":0,"scores":{"exactitude_factuelle":0,"qualite_sources":0,"calculs":0,"couverture":0,"coherence":0,"actualite":0},"decision":"CORRIGER|VALIDER","resume":"","anomalies":[{"categorie":"fait|source|date|calcul|couverture|coherence|limite","gravite":"critique|elevee|moyenne|faible","affirmation_concernee":"","probleme":"","preuve":"URL ou extrait précis","correction_attendue":""}],"sources_non_verifiees":[],"sources_circulaires_ou_non_independantes":[],"divergences_sources":[],"calculs_reproduits":[{"objet":"","entrees":[],"formule":"","resultat":"","conforme":true}],"nouveau_cycle_requis":true}. Chaque score est un entier sur 100. Justifie tout score inférieur à 100 dans les anomalies. VALIDATION est interdite si une anomalie critique ou élevée subsiste.\`;}`;
replaceRegex(/function auditPrompt\([\s\S]*?\nasync function saveRun/, auditFunction + '\nasync function saveRun');
replaceExact('user:auditPrompt(request,document,verified),json:true,web:true', 'user:auditPrompt(request,document,verified,task),json:true,web:true');

replaceRegex(
  /user:`Corrige intégralement ce document selon l'audit\.[\s\S]*?`,web:true/,
  `user:\`${'${taskGuidance[task]||taskGuidance.general_analysis}'}\\n\\nCorrige intégralement le document selon l'audit. Traite chaque anomalie critique et élevée. Supprime ou reformule toute affirmation non étayée. Préserve les éléments vérifiés. Rends tous les calculs reproductibles. Signale les divergences qui ne peuvent pas être tranchées. Maintiens la structure minimale imposée.\\n\\nDEMANDE INITIALE:\\n${'${request}'}\\n\\nDOCUMENT ACTUEL:\\n${'${document}'}\\n\\nAUDIT STRUCTURÉ:\\n${'${JSON.stringify(audit,null,2)}'}\\n\\nSOURCES VÉRIFIÉES DISPONIBLES:\\n${'${JSON.stringify(verified.map(s=>({url:s.url,accessible:s.accessible,title:s.title,sourceClass:s.sourceClass,reason:s.reason})),null,2)}'}\`,web:true`
);

replaceRegex(
  /user:`DEMANDE:\\n\$\{request\}[\s\S]*?JSON attendu : \{"decision":"APPROUVE\|APPROUVE_AVEC_RESERVES\|REJETE"[\s\S]*?`,json:true,web:true/,
  `user:\`TYPE DE TÂCHE:\\n${'${task}'}\\n\\nEXIGENCES SPÉCIFIQUES:\\n${'${taskGuidance[task]||taskGuidance.general_analysis}'}\\n\\nDEMANDE:\\n${'${request}'}\\n\\nDOCUMENT FINAL:\\n${'${document}'}\\n\\nAUDITS:\\n${'${JSON.stringify(result.audits,null,2)}'}\\n\\nSOURCES:\\n${'${JSON.stringify(result.sources.map(s=>({url:s.url,accessible:s.accessible,title:s.title,sourceClass:s.sourceClass,reason:s.reason})),null,2)}'}\\n\\nJSON attendu : {"decision":"APPROUVE|APPROUVE_AVEC_RESERVES|REJETE","confiance":0,"motifs":[{"constat":"","preuve":""}],"reserves":[],"actions_requises":[]}. La confiance est un entier de 0 à 100.\`,json:true,web:true`
);

fs.writeFileSync(serverPath, server, 'utf8');
console.log(`Prompts et politique de sources renforcés : ${changes} modification(s).`);
