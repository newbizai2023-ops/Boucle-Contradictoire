# Boucle Contradictoire

**Boucle Contradictoire** est une application web Node.js qui orchestre une rédaction suivie d’une contre-analyse indépendante à l’aide de modèles accessibles via OpenRouter.

L’objectif est de ne pas accepter directement la première réponse d’un modèle. Une seconde IA joue le rôle d’auditeur, cherche les erreurs et exige une nouvelle version tant que les critères de qualité ne sont pas atteints.

---

## Principe général

L’application utilise deux rôles distincts :

- **le rédacteur**, chargé de produire puis de corriger le document ;
- **l’auditeur contradictoire**, chargé de contrôler les faits, les sources, les dates, les calculs, les unités et les conclusions.

Les modèles sont configurables dans l’interface. Ils ne sont pas codés en dur : il suffit d’indiquer leurs identifiants OpenRouter.

Exemple de séquence :

```text
Demande utilisateur
        │
        ▼
Modèle rédacteur
        │
        ▼
Version initiale du document
        │
        ▼
Modèle auditeur
        │
        ├── document validé ───────────────► résultat final
        │
        └── anomalies détectées
                    │
                    ▼
             Modèle rédacteur
                    │
                    ▼
             Version corrigée
                    │
                    └──────────────► nouvel audit
```

---

## Fonctionnement complet

### 1. Saisie de la demande

L’utilisateur renseigne dans l’interface :

- la demande ou le sujet à traiter ;
- l’identifiant OpenRouter du modèle rédacteur ;
- l’identifiant OpenRouter du modèle auditeur ;
- le nombre maximal de cycles ;
- le score minimal attendu ;
- éventuellement une clé OpenRouter temporaire si aucune clé n’est configurée côté serveur.

La demande doit contenir au moins 20 caractères.

### 2. Vérification de l’état du serveur

Au chargement, le navigateur appelle :

```text
GET /api/health
```

Cette route indique :

- si le serveur fonctionne ;
- si `OPENROUTER_API_KEY` est configurée ;
- si `FIRECRAWL_API_KEY` est configurée.

L’interface affiche alors l’un des états suivants :

- **Serveur prêt** ;
- **Clé serveur absente** ;
- **Serveur indisponible**.

La présence d’une clé Firecrawl est actuellement affichée par l’API de santé, mais Firecrawl n’est pas encore appelé par le moteur de traitement.

### 3. Création de la première version

Le backend envoie la demande au modèle rédacteur via :

```text
POST https://openrouter.ai/api/v1/chat/completions
```

Le prompt système impose notamment au rédacteur de :

- distinguer les faits vérifiés, hypothèses, estimations et recommandations ;
- citer des sources identifiables ;
- ne jamais inventer un tarif, une fonctionnalité ou une source ;
- écrire « Je ne peux pas confirmer cette information » lorsqu’une donnée ne peut pas être vérifiée.

La réponse devient la **version initiale** du document.

### 4. Audit contradictoire

La version obtenue est envoyée au modèle auditeur avec la demande initiale.

L’auditeur doit contrôler :

- les faits ;
- les sources ;
- les dates ;
- les calculs ;
- les unités ;
- les conclusions ;
- la cohérence globale du document.

Il doit répondre uniquement en JSON avec la structure suivante :

```json
{
  "score_global": 88,
  "decision": "correction requise",
  "resume": "Le document est globalement cohérent mais comporte plusieurs points non vérifiés.",
  "anomalies": [
    {
      "gravite": "elevee",
      "probleme": "Le tarif indiqué ne possède pas de source vérifiable.",
      "correction_attendue": "Ajouter une source officielle ou signaler l’incertitude."
    }
  ],
  "nouveau_cycle_requis": true
}
```

Le serveur tente d’abord de lire directement le JSON. Si le modèle ajoute accidentellement du texte autour du JSON, le backend recherche le premier bloc JSON exploitable.

### 5. Décision de validation

Le document est validé lorsque les trois conditions suivantes sont réunies :

1. le score est supérieur ou égal au score minimal demandé ;
2. aucune anomalie de gravité `critique` ou `elevee` ne subsiste ;
3. l’auditeur ne demande pas explicitement un nouveau cycle.

Dans ce cas :

```text
status = validated
```

et la raison d’arrêt est :

```text
Critères de qualité atteints.
```

### 6. Correction du document

Si le document n’est pas validé, l’audit complet est transmis au modèle rédacteur.

Le rédacteur reçoit :

- la demande initiale ;
- la version courante du document ;
- toutes les anomalies détectées ;
- les corrections attendues.

Il produit alors une nouvelle version complète, qui remplace la version précédente et repart dans un nouveau cycle d’audit.

### 7. Arrêt de la boucle

La boucle s’arrête dans deux cas :

#### Validation

```text
status = validated
```

Les critères de qualité sont atteints.

#### Nombre maximal de cycles atteint

```text
status = max_cycles
```

Le document final est tout de même retourné, mais il ne doit pas être considéré comme pleinement validé.

Le nombre maximal de cycles est limité côté serveur à cinq afin d’éviter une consommation incontrôlée.

---

## Résultats affichés

À la fin de l’exécution, l’interface affiche :

- le statut final ;
- le dernier score obtenu ;
- le nombre total d’appels aux modèles ;
- le coût total remonté par OpenRouter ;
- le document final ;
- le détail de chaque audit ;
- les anomalies et corrections attendues ;
- les tokens d’entrée et de sortie de chaque appel ;
- le coût de chaque appel ;
- le modèle réellement utilisé.

Un bouton permet de copier le document final dans le presse-papiers.

---

## Calcul des coûts

L’application additionne la propriété `usage.cost` renvoyée par OpenRouter pour chaque appel :

- rédaction initiale ;
- audits ;
- corrections.

Le coût affiché dépend donc :

- du modèle choisi ;
- de la taille de la demande ;
- de la longueur du document ;
- du nombre d’anomalies ;
- du nombre de cycles ;
- de la tarification appliquée par OpenRouter et le fournisseur du modèle.

Si un fournisseur ne retourne pas la propriété `usage.cost`, le coût affiché pour cet appel peut être nul ou incomplet.

L’application ne bloque pas encore automatiquement une exécution sur la base d’un budget maximal.

---

## Architecture technique

```text
Navigateur
   │
   ├── HTML / CSS / JavaScript statique
   │
   ├── GET /api/health
   │
   └── POST /api/review
             │
             ▼
       Serveur Express
             │
             ├── validation des paramètres
             ├── orchestration des cycles
             ├── calcul des coûts
             └── appels OpenRouter
                       │
                       ▼
                 Modèles IA
```

### Frontend

Le frontend se trouve dans `public/` :

- `index.html` : structure de l’interface ;
- `styles.css` : affichage responsive ;
- `app.js` : appels API, affichage des résultats et copie du document.

### Backend

Le backend se trouve dans `server.js`.

Il assure :

- la validation des identifiants de modèles ;
- la récupération de la clé OpenRouter ;
- l’appel aux modèles ;
- le traitement du JSON de l’auditeur ;
- l’orchestration des cycles ;
- le calcul du coût ;
- la gestion des erreurs ;
- l’exposition du frontend statique.

Le serveur écoute sur :

```text
0.0.0.0:$PORT
```

ce qui le rend compatible avec Render et les plateformes de conteneurs.

---

## Routes API

### `GET /api/health`

Exemple de réponse :

```json
{
  "ok": true,
  "hasOpenRouterKey": true,
  "hasFirecrawlKey": false
}
```

Aucune clé n’est retournée par cette route. Seule leur présence est indiquée.

### `POST /api/review`

Exemple de requête :

```json
{
  "request": "Rédige une analyse comparant deux solutions techniques.",
  "claudeModel": "anthropic/claude-sonnet-4",
  "auditorModel": "openai/gpt-5",
  "maxCycles": 3,
  "minScore": 90
}
```

Exemple simplifié de réponse :

```json
{
  "status": "validated",
  "stopReason": "Critères de qualité atteints.",
  "finalDocument": "...",
  "versions": [],
  "audits": [],
  "calls": [],
  "totalCost": 0.0321
}
```

---

## Sécurité et gestion des secrets

Aucune clé API réelle ne doit être enregistrée dans GitHub.

Les secrets doivent être définis dans les variables d’environnement du serveur :

```text
OPENROUTER_API_KEY
FIRECRAWL_API_KEY
APP_URL
PORT
```

Le dépôt contient uniquement un fichier `.env.example` sans valeur sensible.

Le `.gitignore` exclut notamment :

```text
.env
.env.*
```

### Priorité de la clé OpenRouter

Le serveur utilise :

1. `OPENROUTER_API_KEY` côté serveur si elle existe ;
2. sinon la clé saisie temporairement dans l’interface.

La saisie d’une clé dans le navigateur est prévue uniquement pour les tests. Pour un déploiement public, il faut utiliser une clé serveur et ajouter une authentification.

### Recommandations avant mise en production

Ajouter au minimum :

- authentification des utilisateurs ;
- limitation du nombre de requêtes ;
- quotas par utilisateur ;
- plafond budgétaire ;
- journalisation contrôlée ;
- protection contre les abus ;
- validation renforcée des entrées ;
- politique de conservation des données ;
- masquage des données sensibles dans les logs.

---

## Confidentialité OpenRouter

Les appels utilisent l’API OpenRouter. La confidentialité réelle dépend :

- du modèle choisi ;
- du fournisseur sélectionné par OpenRouter ;
- des paramètres de routage ;
- des politiques de conservation du fournisseur.

Cette version ne force pas encore les options OpenRouter suivantes :

- `data_collection: deny` ;
- `zdr: true` ;
- une liste fermée de fournisseurs ;
- l’interdiction des fallbacks.

Ces options devront être ajoutées si l’application traite des données confidentielles.

---

## Firecrawl et accès web

La variable suivante est déjà prévue :

```text
FIRECRAWL_API_KEY
```

Cependant, dans la version actuellement publiée :

- Firecrawl n’est pas encore appelé par `server.js` ;
- les URL présentes dans une demande ne sont pas automatiquement récupérées ;
- l’application ne garantit donc pas qu’une source a réellement été consultée ;
- les capacités de recherche dépendent du modèle et du fournisseur sélectionnés.

Une prochaine version pourra :

1. extraire les URL de la demande et du document ;
2. récupérer les pages avec Firecrawl ;
3. transmettre leur contenu à l’auditeur ;
4. distinguer les sources accessibles, inaccessibles et non vérifiées ;
5. conserver la clé Firecrawl exclusivement côté serveur.

L’application ne doit pas être utilisée pour contourner des paywalls, des mécanismes d’authentification ou des protections anti-bot sans autorisation.

---

## Installation locale

### Prérequis

- Node.js 18 ou plus récent ;
- npm ;
- une clé OpenRouter valide ;
- des crédits disponibles sur OpenRouter.

### Installation

```bash
npm install
```

### Configuration Linux ou macOS

```bash
export OPENROUTER_API_KEY="votre-cle-openrouter"
export FIRECRAWL_API_KEY="votre-cle-firecrawl"
export APP_URL="http://localhost:3000"
export PORT="3000"
npm start
```

### Configuration PowerShell

```powershell
$env:OPENROUTER_API_KEY="votre-cle-openrouter"
$env:FIRECRAWL_API_KEY="votre-cle-firecrawl"
$env:APP_URL="http://localhost:3000"
$env:PORT="3000"
npm start
```

Ouvrir ensuite :

```text
http://localhost:3000
```

---

## Déploiement sur Render

Le dépôt contient un fichier `render.yaml` utilisable comme Blueprint Render.

Configuration prévue :

- **type** : Web Service ;
- **runtime** : Node.js ;
- **région** : Frankfurt ;
- **plan proposé** : Starter ;
- **commande de build** : `npm install` ;
- **commande de démarrage** : `npm start` ;
- **health check** : `/api/health`.

Après la création du service, ajouter dans Render :

```text
OPENROUTER_API_KEY=<secret>
FIRECRAWL_API_KEY=<secret>
APP_URL=https://adresse-du-service.onrender.com
```

Ne jamais écrire ces valeurs dans GitHub, dans le README ou dans `.env.example`.

---

## Docker

Le dépôt contient également un `Dockerfile`.

Exemple :

```bash
docker build -t boucle-contradictoire .
docker run --rm -p 3000:3000 \
  -e OPENROUTER_API_KEY="votre-cle" \
  -e APP_URL="http://localhost:3000" \
  boucle-contradictoire
```

---

## Structure du dépôt

```text
Boucle-Contradictoire/
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

---

## Limites actuelles

La version actuelle constitue un socle fonctionnel, mais présente encore les limites suivantes :

- pas d’authentification ;
- pas de comptes utilisateurs ;
- pas de base de données ;
- pas d’historique persistant ;
- appels non streamés ;
- pas d’annulation d’une boucle en cours ;
- pas de plafond budgétaire automatique ;
- pas de recherche web garantie ;
- Firecrawl non encore intégré au traitement ;
- pas de troisième arbitre tel que Grok ;
- pas de reprise automatique après une erreur réseau ;
- pas de limitation de débit ;
- maximum de cinq cycles ;
- résultat dépendant fortement des modèles sélectionnés.

---

## Évolutions prévues

Les extensions envisagées sont :

- intégration réelle de Firecrawl ;
- recherche web OpenRouter ;
- ajout d’un arbitre final optionnel ;
- budget maximal par exécution ;
- authentification ;
- historique en base de données ;
- export Markdown et JSON ;
- streaming de la progression ;
- sélection automatique du modèle selon la tâche ;
- vérification plus stricte des sources ;
- score détaillé par catégorie ;
- tableaux de bord de consommation.

---

## Avertissement

Un score élevé attribué par un modèle ne constitue pas une preuve de véracité. La boucle contradictoire réduit certains risques d’erreur, mais deux modèles peuvent partager les mêmes biais, utiliser des informations obsolètes ou valider mutuellement une affirmation incorrecte.

Pour les décisions juridiques, financières, médicales, de cybersécurité ou d’architecture critique, une validation humaine et des sources primaires restent indispensables.
