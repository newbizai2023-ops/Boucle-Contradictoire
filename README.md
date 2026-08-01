# Boucle Contradictoire

Application web Node.js qui orchestre trois familles de modèles via OpenRouter afin de produire un document, le soumettre à une contre-analyse structurée, le corriger, puis faire trancher un troisième modèle indépendant.

## Principe général

La boucle repose sur trois rôles volontairement séparés :

1. **Claude rédige et corrige** le document.
2. **GPT audite** les faits, les calculs, les sources et la logique.
3. **Grok arbitre** la version finale et décide si elle peut être livrée.

Cette séparation limite le risque qu’un même modèle valide sa propre production. Elle ne garantit toutefois pas l’exactitude absolue : les trois modèles peuvent partager des erreurs, des données obsolètes ou des biais similaires. Les résultats importants doivent rester vérifiés par un humain et, lorsque nécessaire, par des sources primaires.

## Modèles utilisés par défaut

Les champs restent modifiables dans l’interface. Les valeurs par défaut utilisent les alias `latest` d’OpenRouter :

| Rôle | Modèle OpenRouter | Fonction dans la boucle |
|---|---|---|
| Rédacteur | `~anthropic/claude-opus-latest` | Produit la première version et applique les corrections |
| Auditeur | `~openai/gpt-latest` | Réalise la contre-analyse structurée à chaque cycle |
| Arbitre | `~x-ai/grok-latest` | Rend le verdict final après lecture du document et des audits |

Les alias `latest` redirigent automatiquement vers le modèle le plus récent de la famille concernée. Ce choix évite de modifier le code à chaque changement de version, mais peut aussi introduire une évolution de comportement ou de prix sans changement du dépôt. Pour un environnement strictement reproductible, remplacez les alias par des identifiants de versions figées.

Références OpenRouter :

- Claude Opus Latest : https://openrouter.ai/~anthropic/claude-opus-latest
- OpenAI GPT Latest : https://openrouter.ai/~openai/gpt-latest
- Grok Latest : https://openrouter.ai/~x-ai/grok-latest

## Pourquoi Claude comme rédacteur

Claude Opus est utilisé pour la production et la réécriture parce que ce rôle nécessite principalement :

- une rédaction longue et cohérente ;
- une bonne conservation du contexte entre plusieurs cycles ;
- la capacité à réorganiser un document sans perdre son intention initiale ;
- une application disciplinée des corrections demandées ;
- une distinction explicite entre faits, hypothèses, estimations et recommandations.

Le prompt du rédacteur lui interdit d’inventer une source, un tarif ou une fonctionnalité. Lorsqu’une information ne peut pas être confirmée, il doit écrire exactement :

> Je ne peux pas confirmer cette information

Claude n’est pas choisi comme auditeur de son propre texte afin d’éviter une auto-validation trop complaisante et la répétition des mêmes angles morts.

## Pourquoi GPT comme auditeur contradictoire

GPT est utilisé comme auditeur parce que ce rôle demande un comportement différent de celui du rédacteur :

- décomposer les affirmations du document ;
- contrôler les dates, les unités et les calculs ;
- détecter les contradictions internes ;
- identifier les sources manquantes ou insuffisantes ;
- distinguer les erreurs critiques des réserves mineures ;
- retourner une réponse JSON stable et exploitable par le programme.

À chaque cycle, GPT reçoit la demande initiale et la version courante du document. Il retourne notamment :

```json
{
  "score_global": 86,
  "decision": "REVISION_REQUISE",
  "resume": "Le document est globalement cohérent, mais deux hypothèses budgétaires ne sont pas sourcées.",
  "anomalies": [
    {
      "gravite": "elevee",
      "probleme": "Le prix utilisé n'est pas attribué à une source vérifiable.",
      "correction_attendue": "Ajouter une source primaire datée ou présenter la valeur comme une hypothèse."
    }
  ],
  "nouveau_cycle_requis": true
}
```

Le score de GPT sert à piloter la boucle, mais il ne constitue pas à lui seul la décision finale.

## Pourquoi Grok comme arbitre

Grok intervient uniquement après la boucle Claude–GPT. Il constitue un troisième regard provenant d’une autre famille de modèles et d’un autre fournisseur.

Son rôle n’est pas de réécrire le document ni de refaire mécaniquement le dernier audit. Il doit :

- examiner la demande initiale ;
- lire la version finale ;
- tenir compte de l’historique complet des audits ;
- vérifier si les corrections répondent réellement aux anomalies ;
- repérer un éventuel compromis artificiel entre le rédacteur et l’auditeur ;
- rendre une décision claire de livraison.

Grok retourne un JSON de ce type :

```json
{
  "decision": "APPROUVE_AVEC_RESERVES",
  "score_final": 92,
  "justification": "Les erreurs critiques ont été corrigées et les hypothèses restantes sont correctement signalées.",
  "reserves": [
    "Le prix fournisseur doit être revérifié avant engagement contractuel."
  ],
  "action_recommandee": "Le document peut être transmis avec la réserve indiquée."
}
```

Les décisions possibles sont :

- `APPROUVE` ;
- `APPROUVE_AVEC_RESERVES` ;
- `REJETE`.

La décision de Grok produit respectivement les statuts applicatifs :

- `validated` ;
- `validated_with_reservations` ;
- `rejected_by_arbiter`.

## Déroulement complet d’une exécution

### 1. Saisie

L’utilisateur renseigne :

- la demande à traiter ;
- le modèle Claude ;
- le modèle GPT ;
- le modèle Grok ;
- le nombre maximal de cycles, entre 1 et 5 ;
- le score cible de l’auditeur, entre 50 et 100.

### 2. Première rédaction

Claude reçoit la demande et produit la version initiale. L’application enregistre :

- le contenu ;
- le modèle réellement routé par OpenRouter ;
- le fournisseur ;
- les tokens d’entrée et de sortie ;
- le coût retourné par OpenRouter.

### 3. Audit GPT

GPT audite la version courante et retourne un objet JSON. L’application contrôle :

- le score global ;
- la présence d’anomalies critiques ou élevées ;
- la valeur de `nouveau_cycle_requis`.

### 4. Correction Claude

Une nouvelle correction est demandée lorsque :

- le score est inférieur au seuil ;
- une anomalie critique ou élevée subsiste ;
- GPT demande explicitement un nouveau cycle.

Claude reçoit le document, la demande initiale et l’audit complet. La nouvelle version remplace la précédente pour le cycle suivant.

### 5. Sortie de la boucle Claude–GPT

La boucle s’arrête lorsque :

- le score cible est atteint sans anomalie grave et sans demande de nouveau cycle ; ou
- le nombre maximal de cycles est atteint.

Dans les deux cas, le document passe obligatoirement à Grok. Atteindre le score cible ne vaut donc pas validation finale.

### 6. Arbitrage Grok

Grok reçoit :

- la demande initiale ;
- le document final ;
- tous les audits GPT.

Il rend la décision finale, le score final, une justification, les réserves éventuelles et l’action recommandée.

### 7. Affichage des résultats

L’interface affiche quatre onglets :

- **Document final** ;
- **Audits** ;
- **Arbitrage Grok** ;
- **Usage**.

Le tableau d’usage détaille chaque appel : rédaction, audit, correction et arbitrage.

## Architecture

```text
Navigateur
   │
   ├── public/index.html
   ├── public/app.js
   └── public/styles.css
   │
   ▼
Serveur Express — server.js
   │
   ├── POST /api/review
   ├── GET  /api/health
   │
   ▼
OpenRouter
   ├── Claude Opus Latest — rédaction/correction
   ├── GPT Latest — audit contradictoire
   └── Grok Latest — arbitrage final
```

## API

### `GET /api/health`

Retourne l’état du serveur sans révéler les secrets :

```json
{
  "ok": true,
  "hasOpenRouterKey": true,
  "hasFirecrawlKey": false
}
```

### `POST /api/review`

Exemple de requête :

```json
{
  "request": "Prépare une comparaison technique et économique...",
  "claudeModel": "~anthropic/claude-opus-latest",
  "auditorModel": "~openai/gpt-latest",
  "arbiterModel": "~x-ai/grok-latest",
  "maxCycles": 3,
  "minScore": 90
}
```

## Coûts

Chaque exécution comprend au minimum :

1. un appel Claude de rédaction ;
2. un appel GPT d’audit ;
3. un appel Grok d’arbitrage.

Chaque cycle supplémentaire ajoute généralement :

- un appel Claude de correction ;
- un appel GPT de nouvel audit.

Le coût total affiché correspond à la somme des valeurs `usage.cost` retournées par OpenRouter. Il dépend des modèles effectivement routés, du volume de texte, du nombre de cycles et des tarifs OpenRouter au moment de l’exécution.

L’utilisation d’alias `latest` signifie que les prix peuvent évoluer. Pour maîtriser strictement le budget, utilisez des versions figées et ajoutez un plafond applicatif avant production.

## Sécurité

Aucune clé API réelle n’est stockée dans le dépôt.

Les secrets doivent être définis dans Render ou dans l’environnement local :

```text
OPENROUTER_API_KEY
FIRECRAWL_API_KEY
APP_URL
PORT
```

Le fichier `.env.example` contient uniquement les noms des variables. Les fichiers `.env` sont exclus par `.gitignore`.

La saisie temporaire d’une clé dans l’interface est uniquement destinée aux tests. Pour une exposition publique, utilisez exclusivement une clé côté serveur et ajoutez :

- authentification ;
- limitation de débit ;
- quotas par utilisateur ;
- protection CSRF ;
- journalisation sans secrets ;
- plafond de coût ;
- contrôle d’accès au service.

## Lancer localement

```bash
npm install
export OPENROUTER_API_KEY="votre-cle"
export APP_URL="http://localhost:3000"
npm start
```

Puis ouvrir :

```text
http://localhost:3000
```

## Déploiement Render

Le dépôt contient un fichier `render.yaml` :

- Runtime : Node.js ;
- Région : Frankfurt ;
- Build : `npm install` ;
- Start : `npm start` ;
- Health check : `/api/health`.

Après création du service, ajoutez les clés dans les variables secrètes Render, jamais dans GitHub.

## Docker

```bash
docker build -t boucle-contradictoire .
docker run --rm -p 3000:3000 \
  -e OPENROUTER_API_KEY="votre-cle" \
  -e APP_URL="http://localhost:3000" \
  boucle-contradictoire
```

## Structure du dépôt

```text
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── server.js
├── package.json
├── Dockerfile
├── render.yaml
├── .env.example
├── .gitignore
└── README.md
```

## État de Firecrawl

La variable `FIRECRAWL_API_KEY` est préparée, mais la récupération des pages web par Firecrawl n’est pas encore activée dans la version actuelle. Les modèles peuvent donc analyser les sources fournies dans le texte, mais l’application ne garantit pas encore qu’elle a téléchargé et vérifié chaque URL citée.

## Limites importantes

- Un consensus entre trois modèles ne constitue pas une preuve.
- Les modèles peuvent utiliser des connaissances obsolètes.
- Une URL citée peut être inaccessible ou ne pas soutenir l’affirmation associée.
- Le format JSON dépend du respect des instructions par le modèle et du support de l’endpoint routé.
- Les alias `latest` améliorent la maintenance mais réduisent la reproductibilité.
- L’application ne dispose pas encore de base de données, de comptes utilisateurs ou d’historique serveur persistant.
- Les appels sont non streamés et peuvent durer plusieurs minutes.

## Évolutions prévues

- intégration Firecrawl pour récupérer les sources accessibles ;
- recherche web OpenRouter ;
- plafond de coût avant et pendant la boucle ;
- authentification ;
- persistance des analyses ;
- export Markdown et JSON ;
- tests automatisés ;
- versionnement explicite des modèles ;
- possibilité d’exiger une validation humaine après le verdict de Grok.
