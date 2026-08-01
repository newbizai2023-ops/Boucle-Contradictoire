# Boucle Contradictoire

Application web Node.js qui orchestre une étude multi-modèles avec recherche web, contrôle des sources, corrections successives et arbitrage indépendant.

## Fonctionnement complet

```text
Utilisateur authentifié par Google
        ↓
Classification automatique de la tâche
        ↓
Sélection des modèles
        ↓
Claude rédige avec OpenRouter Web Search
        ↓
Firecrawl ouvre et extrait les URL citées
        ↓
GPT audite les faits, sources, calculs et la couverture
        ↓
Claude corrige selon les anomalies
        ↓
Nouveaux cycles d’audit et de correction
        ↓
Grok rend un arbitrage final indépendant
        ↓
Enregistrement PostgreSQL, dashboard et exports
```

La progression est diffusée au navigateur en temps réel avec **Server-Sent Events (SSE)** : sélection des modèles, rédaction, vérification des sources, audits, corrections et arbitrage.

## Modèles et justification

| Rôle | Modèle par défaut | Justification |
|---|---|---|
| Rédacteur complexe | `~anthropic/claude-opus-latest` | Suit la dernière version de Claude Opus. Ce rôle privilégie la cohérence des documents longs, le suivi d’instructions et les corrections multi-étapes. |
| Rédacteur général ou recherche récente | `~anthropic/claude-sonnet-latest` | Réduit le coût et la latence pour les demandes générales tout en conservant de bonnes capacités de synthèse et d’utilisation d’outils. |
| Auditeur | `openai/gpt-5.6-sol` ou `~openai/gpt-latest` | Produit un audit JSON strict, recalcule, recherche les contradictions et attribue des scores détaillés. Sol est utilisé pour les tâches techniques, financières ou juridiques complexes. |
| Arbitre | `~x-ai/grok-latest` | Apporte un troisième fournisseur et une décision indépendante. Il ne réécrit pas le document : il approuve, approuve avec réserves ou rejette. |

Les alias `~...-latest` évitent de figer l’application sur une version rapidement obsolète. Les modèles peuvent également être imposés manuellement dans l’interface.

## Sélection automatique selon la tâche

L’application classe la demande avant le premier appel :

- **technical** : code, architecture, API, bugs, GitHub ;
- **financial** : coûts, budget, ROI, FinOps, facturation ;
- **legal** : loi, contrat, conformité, réglementation ;
- **current_research** : actualité, annonce, veille, information récente ;
- **general_analysis** : autre étude ou document.

Les tâches à risque ou à raisonnement complexe utilisent Claude Opus et GPT-5.6 Sol. Les tâches générales utilisent des alias plus économiques. Grok reste l’arbitre final.

## Recherche web OpenRouter

Chaque rôle peut utiliser le serveur d’outils :

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

Le modèle décide quand rechercher. OpenRouter utilise la recherche native du fournisseur lorsqu’elle est disponible et peut basculer vers un moteur compatible. Les annotations `url_citation` sont récupérées par l’application et ajoutées au dossier de preuve.

Documentation : <https://openrouter.ai/docs/guides/features/server-tools/web-search>

## Intégration réelle de Firecrawl

Après chaque rédaction ou correction, l’application collecte les URL citées dans le document et les citations structurées renvoyées par OpenRouter. Jusqu’à dix URL uniques sont contrôlées avec :

```text
POST https://api.firecrawl.dev/v2/scrape
```

Firecrawl récupère le contenu principal au format Markdown avec suppression des images Base64, blocage des publicités et `zeroDataRetention: true`. Le rapport transmis à GPT contient l’accessibilité, le titre, le statut, la classe de source et un extrait. Une source inaccessible n’est jamais considérée comme vérifiée.

Documentation : <https://docs.firecrawl.dev/api-reference/endpoint/scrape>

## Vérification stricte des sources

Le contrôle combine :

- présence d’une URL réelle pour les affirmations importantes ;
- accessibilité et extraction par Firecrawl ;
- classification indicative de la source : officielle, documentation primaire, média reconnu ou autre ;
- comparaison du contenu extrait avec l’affirmation auditée.

L’auditeur pénalise les sources inaccessibles, les sources secondaires lorsqu’une source primaire est attendue, les dates incohérentes, les calculs non reproductibles, les affirmations non étayées et les citations inventées ou sans URL.

Cette classification est une heuristique et ne remplace pas une validation humaine.

## Scores détaillés

Chaque audit retourne un score global et six scores sur 100 :

| Catégorie | Objet |
|---|---|
| `exactitude_factuelle` | conformité des affirmations aux preuves ; |
| `qualite_sources` | accessibilité, autorité et pertinence des sources ; |
| `calculs` | unités, formules et reproductibilité ; |
| `couverture` | réponse à toutes les dimensions demandées ; |
| `coherence` | absence de contradiction interne ; |
| `actualite` | fraîcheur des données et cohérence des dates. |

Les anomalies sont classées en `critique`, `elevee`, `moyenne` ou `faible`. Une anomalie critique ou élevée empêche la validation automatique.

## Arbitrage Grok

Après le dernier audit, Grok reçoit la demande initiale, le document final, tous les audits et l’état des sources vérifiées. Il retourne :

```json
{
  "decision": "APPROUVE | APPROUVE_AVEC_RESERVES | REJETE",
  "confiance": 0,
  "motifs": [],
  "reserves": [],
  "actions_requises": []
}
```

Un consensus entre modèles ne constitue pas une preuve. Les décisions importantes restent soumises à une revue humaine.

## Authentification Google

L’application utilise OAuth 2.0 avec Passport. Il faut créer un client OAuth « Web application » dans Google Cloud et déclarer l’URI de redirection :

```text
https://VOTRE-DOMAINE/auth/google/callback
```

Variables nécessaires :

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SESSION_SECRET
APP_URL
```

Les sessions sont stockées dans PostgreSQL et utilisent des cookies `httpOnly`, `sameSite=lax` et `secure` en production. `DEV_BYPASS_AUTH=true` existe uniquement pour le développement local.

## Historique PostgreSQL

Chaque exécution est associée à l’utilisateur Google et conserve la demande, le type de tâche, les modèles réellement utilisés, les versions, les audits, les sources vérifiées, l’arbitrage, le document final, les tokens, le coût, le statut et la date.

Tables principales : `users`, `runs` et `session`. L’utilisateur ne peut consulter et exporter que ses propres exécutions.

## Exports

Une exécution terminée peut être exportée en :

- **Markdown** : document et arbitrage ;
- **PDF** : document final et arbitrage ;
- **Word `.docx`** : document éditable ;
- **Excel `.xlsx`** : synthèse, scores par cycle et consommation détaillée.

Routes :

```text
GET /api/runs/:id/export/md
GET /api/runs/:id/export/pdf
GET /api/runs/:id/export/docx
GET /api/runs/:id/export/xlsx
```

## Streaming de la progression

`POST /api/jobs` crée une tâche et renvoie un identifiant. Le navigateur ouvre ensuite :

```text
GET /api/jobs/:id/events
```

Cette route SSE diffuse les événements `models`, `progress`, `source`, `audit`, `complete` et `error`.

## Tableau de bord de consommation

Le tableau de bord agrège sur 90 jours : nombre d’exécutions, nombre de validations, coût total, tokens d’entrée et de sortie, nombre d’appels et coût par modèle.

Les coûts proviennent du champ `usage.cost` renvoyé par OpenRouter. Ils doivent être rapprochés de la facturation fournisseur pour un contrôle financier définitif.

## API

| Route | Fonction |
|---|---|
| `GET /api/health` | état OpenRouter, Firecrawl, Google et PostgreSQL ; |
| `GET /api/me` | utilisateur connecté ; |
| `POST /api/jobs` | création d’une boucle ; |
| `GET /api/jobs/:id/events` | progression SSE ; |
| `GET /api/history` | historique personnel ; |
| `GET /api/dashboard` | consommation agrégée ; |
| `GET /api/runs/:id/export/:format` | export. |

## Configuration

```text
OPENROUTER_API_KEY=
FIRECRAWL_API_KEY=
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=
APP_URL=http://localhost:3000
PORT=3000
DEV_BYPASS_AUTH=false
```

Aucun secret réel ne doit être commité. `.env` est ignoré par Git.

## Installation locale

```bash
npm install
cp .env.example .env
npm start
```

Pour un test sans OAuth ni PostgreSQL :

```text
DEV_BYPASS_AUTH=true
```

L’historique reste alors limité à la mémoire du processus et disparaît au redémarrage.

## Déploiement Render

`render.yaml` crée un Web Service Node.js Starter à Frankfurt et une base Render PostgreSQL à Frankfurt. Il injecte automatiquement `DATABASE_URL` et configure le health check `/api/health`.

Après création du Blueprint, renseigner manuellement les secrets OpenRouter, Firecrawl et Google ainsi que l’URL publique dans `APP_URL`.

## Limites connues

- Les tâches SSE actives sont conservées en mémoire : une seule instance applicative est recommandée dans cette version.
- Une coupure du processus interrompt une boucle en cours, mais les exécutions terminées restent en base.
- Firecrawl ne garantit pas l’accès aux pages protégées, payantes ou bloquées. L’application ne contourne aucun contrôle d’accès.
- Les classifications de domaines et les scores sont des aides, pas des certifications.
- Les exports PDF et Word privilégient la robustesse ; la mise en page reste volontairement simple.
