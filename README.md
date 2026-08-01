# Boucle Contradictoire

Application web Node.js qui orchestre une boucle de rédaction et de contre-analyse via OpenRouter :

1. un modèle rédacteur produit une première version ;
2. un modèle auditeur contrôle les faits, sources, calculs et conclusions ;
3. le rédacteur corrige la réponse ;
4. la boucle continue jusqu’au score cible ou au nombre maximal de cycles.

## Sécurité

Aucune clé API réelle n’est stockée dans le dépôt. Les secrets doivent être enregistrés dans les variables d’environnement de Render :

```text
OPENROUTER_API_KEY
FIRECRAWL_API_KEY
APP_URL
```

Le fichier `.env.example` contient uniquement les noms de variables.

## Lancer localement

```bash
npm install
export OPENROUTER_API_KEY="votre-cle"
npm start
```

Puis ouvrir `http://localhost:3000`.

## Déploiement Render

Le dépôt contient un fichier `render.yaml` compatible avec Render Blueprint :

- Runtime : Node.js
- Région : Frankfurt
- Plan proposé : Starter
- Build : `npm install`
- Start : `npm start`
- Health check : `/api/health`

Après création du service, ajoutez les clés réelles directement dans Render et jamais dans GitHub.

## Structure

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
└── .gitignore
```

## État de Firecrawl

La variable `FIRECRAWL_API_KEY` est préparée pour le déploiement, mais l’intégration de récupération des pages web n’est pas encore activée dans cette première version publiée.
