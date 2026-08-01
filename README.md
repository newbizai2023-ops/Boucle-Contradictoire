# Boucle Contradictoire

Application web Node.js qui orchestre une étude multi-modèles avec recherche web, contrôle strict des sources, corrections successives, arbitrage indépendant, historique PostgreSQL, exports et tableau de bord de consommation.

## Déploiement actuel

L’application est publiée sur Render dans le workspace associé au compte `newbizai2023@gmail.com`.

- **Application** : <https://boucle-contradictoire.onrender.com>
- **Service Render** : `boucle-contradictoire`
- **Région** : Frankfurt
- **Runtime** : Node.js 22
- **Plan actuel** : Free
- **Dépôt GitHub** : `newbizai2023-ops/Boucle-Contradictoire`
- **Branche** : `main`
- **Auto-déploiement** : activé à chaque commit sur `main`
- **Base PostgreSQL** : `boucle-contradictoire-db`
- **Version PostgreSQL** : 18
- **Région PostgreSQL** : Frankfurt

Le premier build Render a réussi. L’application reste toutefois en configuration de préproduction tant que les secrets et la connexion PostgreSQL ne sont pas tous renseignés.

### Configuration Render restant à effectuer

Dans **Render → boucle-contradictoire → Environment**, définir :

```text
OPENROUTER_API_KEY=
FIRECRAWL_API_KEY=
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=
APP_URL=https://boucle-contradictoire.onrender.com
NODE_ENV=production
DEV_BYPASS_AUTH=false
```

`DATABASE_URL` doit utiliser la connexion interne de la base `boucle-contradictoire-db`. Les clés réelles ne doivent jamais être ajoutées au dépôt GitHub.

Pour tester temporairement l’interface sans Google OAuth, il est possible d’utiliser :

```text
DEV_BYPASS_AUTH=true
```

Cette option doit être désactivée avant toute ouverture à des utilisateurs réels.

### Google OAuth

Créer un client OAuth Google de type **Web application** et déclarer l’URI de redirection exacte :

```text
https://boucle-contradictoire.onrender.com/auth/google/callback
```

Une fois `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` configurés dans Render, définir :

```text
DEV_BYPASS_AUTH=false
```

## Fonctionnement complet

```text
Utilisateur authentifié par Google
        ↓
Classification automatique de la tâche
        ↓
Sélection automatique des modèles
        ↓
Claude rédige avec OpenRouter Web Search
        ↓
Firecrawl ouvre et extrait les URL citées
        ↓
GPT audite les faits, sources, calculs et la couverture
        ↓
Claude corrige les anomalies
        ↓
Nouveaux cycles d’audit et de correction
        ↓
Grok rend un arbitrage final indépendant
        ↓
Enregistrement PostgreSQL
        ↓
Dashboard, historique et exports
```

La progression est diffusée en temps réel avec **Server-Sent Events** : sélection des modèles, rédaction, contrôle des sources, audit, correction et arbitrage.

## Modèles utilisés

| Rôle | Modèle par défaut | Justification |
|---|---|---|
| Rédacteur complexe | `~anthropic/claude-opus-latest` | Cohérence des documents longs, suivi d’instructions complexes et corrections multi-étapes. |
| Rédacteur général | `~anthropic/claude-sonnet-latest` | Réduction du coût et de la latence pour les demandes générales ou récentes. |
| Auditeur complexe | `openai/gpt-5.6-sol` | Audit JSON strict, vérification logique, recalcul et scoring détaillé. |
| Auditeur général | `~openai/gpt-latest` | Audit polyvalent avec sélection automatique de la version courante. |
| Arbitre | `~x-ai/grok-latest` | Troisième fournisseur chargé de trancher sans réécrire le document. |

Les alias `~...-latest` évitent de figer l’application sur une version rapidement obsolète. Les modèles peuvent aussi être imposés manuellement.

## Sélection automatique selon la tâche

L’application classe la demande avant le premier appel :

- `technical` : code, API, architecture, bugs, GitHub ;
- `financial` : coûts, budget, ROI, FinOps, facturation ;
- `legal` : loi, contrat, conformité, réglementation ;
- `current_research` : actualité, annonce, veille ou information récente ;
- `general_analysis` : autre étude ou document.

Les tâches techniques, financières et juridiques utilisent les modèles les plus puissants. Les tâches générales utilisent une configuration plus économique.

## Recherche web OpenRouter

Les appels peuvent activer l’outil :

```json
{
  "tools": [
    {
      "type": "openrouter:web_search",
      "engine": "auto",
      "search_context_size": "high",
      "max_total_results": 10
    }
  ]
}
```

Les citations structurées renvoyées par OpenRouter sont ajoutées au dossier de preuve transmis à l’auditeur.

## Firecrawl

Après chaque rédaction ou correction, l’application collecte les URL citées et contrôle jusqu’à dix pages avec :

```text
POST https://api.firecrawl.dev/v2/scrape
```

Firecrawl extrait le contenu principal au format Markdown. Une page inaccessible, bloquée ou sans contenu exploitable n’est jamais considérée comme vérifiée.

## Vérification stricte des sources

Le contrôle porte notamment sur :

- la présence d’une URL réelle ;
- l’accessibilité de la page ;
- la concordance entre la source et l’affirmation ;
- la fraîcheur de l’information ;
- la préférence pour les sources primaires ;
- la reproductibilité des calculs ;
- l’absence de citations inventées.

La classification des domaines reste une heuristique et ne remplace pas une revue humaine.

## Scores détaillés

Chaque audit retourne un score global et six scores sur 100 :

| Catégorie | Objet |
|---|---|
| `exactitude_factuelle` | conformité des affirmations aux preuves ; |
| `qualite_sources` | accessibilité, autorité et pertinence ; |
| `calculs` | unités, formules et reproductibilité ; |
| `couverture` | réponse à toutes les dimensions demandées ; |
| `coherence` | absence de contradiction interne ; |
| `actualite` | fraîcheur des données et cohérence des dates. |

Les anomalies sont classées en `critique`, `elevee`, `moyenne` ou `faible`. Une anomalie critique ou élevée empêche la validation automatique.

## Prompts des modèles

Les prompts sont définis dans `server.js` et versionnés avec le code.

### Claude — rédacteur

```text
Tu es le rédacteur principal. Produis un document professionnel, structuré et directement exploitable. Sépare faits vérifiés, hypothèses, estimations et recommandations. Utilise les outils web lorsque les informations peuvent avoir changé. Toute affirmation factuelle importante doit être associée à une source identifiable. N'invente jamais de source. Si une information n'est pas confirmable, écris exactement : « Je ne peux pas confirmer cette information ».
```

### Claude — correcteur

```text
Corrige intégralement le document en tenant compte de l’audit contradictoire.

DEMANDE INITIALE :
{demande_utilisateur}

DOCUMENT ACTUEL :
{document_courant}

AUDIT STRUCTURÉ :
{audit_json}

SOURCES VÉRIFIÉES :
{sources_firecrawl_json}

Corrige toutes les anomalies critiques et élevées, conserve les informations exactes et produis le document complet corrigé.
```

### GPT — auditeur

```text
Tu es un auditeur contradictoire indépendant. Vérifie le document contre la demande, le dossier de sources et les résultats de vérification Firecrawl. Réponds uniquement en JSON. Sois sévère avec les sources inaccessibles, secondaires lorsque des sources primaires existent, citations sans URL, dates incohérentes, calculs non reproductibles et affirmations non étayées.
```

Le format attendu contient notamment :

```json
{
  "score_global": 0,
  "scores": {
    "exactitude_factuelle": 0,
    "qualite_sources": 0,
    "calculs": 0,
    "couverture": 0,
    "coherence": 0,
    "actualite": 0
  },
  "decision": "CORRIGER|VALIDER",
  "anomalies": [],
  "sources_non_verifiees": [],
  "nouveau_cycle_requis": true
}
```

### Grok — arbitre

```text
Tu es l'arbitre final indépendant. Tu ne réécris pas le document. Tu tranches entre la version finale et les audits en privilégiant les preuves vérifiables. Réponds uniquement en JSON avec decision, confiance, motifs, reserves et actions_requises.
```

Format attendu :

```json
{
  "decision": "APPROUVE|APPROUVE_AVEC_RESERVES|REJETE",
  "confiance": 0,
  "motifs": [],
  "reserves": [],
  "actions_requises": []
}
```

## Authentification et sessions

L’authentification utilise Google OAuth 2.0 avec Passport. Les sessions utilisent des cookies `httpOnly`, `sameSite=lax` et `secure` en production. Les sessions peuvent être stockées dans PostgreSQL.

## Historique PostgreSQL

Chaque exécution conserve :

- la demande ;
- le type de tâche ;
- les modèles utilisés ;
- les versions successives ;
- les audits ;
- les sources vérifiées ;
- l’arbitrage ;
- les coûts et tokens ;
- le document final ;
- le statut et la date.

Tables principales : `users`, `runs` et `session`.

## Exports

Les exécutions terminées peuvent être exportées en :

- Markdown ;
- PDF ;
- Word `.docx` ;
- Excel `.xlsx`.

Routes :

```text
GET /api/runs/:id/export/md
GET /api/runs/:id/export/pdf
GET /api/runs/:id/export/docx
GET /api/runs/:id/export/xlsx
```

## Streaming SSE

```text
POST /api/jobs
GET  /api/jobs/:id/events
```

Événements diffusés : `models`, `progress`, `source`, `audit`, `complete` et `error`.

## Tableau de bord de consommation

Le dashboard agrège sur 90 jours :

- nombre d’exécutions ;
- nombre de validations ;
- coût total ;
- tokens d’entrée et de sortie ;
- nombre d’appels ;
- coût par modèle.

Les coûts sont issus du champ `usage.cost` renvoyé par OpenRouter et doivent être rapprochés de la facture fournisseur.

## API

| Route | Fonction |
|---|---|
| `GET /api/health` | état des connexions ; |
| `GET /api/me` | utilisateur connecté ; |
| `POST /api/jobs` | création d’une boucle ; |
| `GET /api/jobs/:id/events` | progression SSE ; |
| `GET /api/history` | historique personnel ; |
| `GET /api/dashboard` | consommation agrégée ; |
| `GET /api/runs/:id/export/:format` | export. |

## Installation locale

```bash
npm install
cp .env.example .env
npm start
```

Pour un test local sans OAuth :

```text
DEV_BYPASS_AUTH=true
```

## Sécurité

- aucune clé réelle dans GitHub ;
- secrets stockés uniquement dans Render ;
- `.env` ignoré par Git ;
- cookies sécurisés en production ;
- aucune tentative de contournement des pages protégées ou payantes ;
- les résultats sensibles doivent être revus humainement.

## Limites connues

- Les tâches SSE actives sont conservées en mémoire : une seule instance applicative est recommandée dans cette version.
- Une coupure du processus interrompt une boucle en cours.
- Le plan Render Free peut mettre le service en veille.
- La base PostgreSQL Free peut être temporaire selon les conditions du compte Render.
- Firecrawl ne garantit pas l’accès aux pages protégées ou bloquées.
- Les scores produits par les modèles ne constituent pas une certification.
- Le build signale actuellement deux vulnérabilités npm de sévérité modérée à analyser avant un usage de production.
