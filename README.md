# Cross du collège

Application web pour organiser le cross du collège : import de la liste des élèves, impression des dossards, chronométrage le jour J et classements par classe.

**100 % locale (RGPD)** : aucune base de données, aucun compte, aucune donnée envoyée sur internet. La liste d’élèves, les courses et les arrivées sont enregistrées uniquement dans le navigateur de l’ordinateur utilisé.

## Fonctionnalités

1. **Import Liste** : import d’un fichier Excel (N° dossard, Nom, Prénom, Sexe, Classe) avec contrôle des erreurs, recherche et filtre par classe, dossards PDF (2 ou 4 par page A4).
2. **Course** : plusieurs courses, chrono qui survit au rechargement de la page, un clic par arrivée, saisie du dossard ensuite.
3. **Résultats** : classement par classe (somme des 10 meilleures places, le plus petit score gagne), export Excel (arrivées + par classe) et PDF recto-verso.

## À savoir

- Les données restent sur **un seul navigateur, sur un seul ordinateur** : il faut faire toute l’organisation sur le même poste.
- Vider les données du site dans le navigateur efface la liste et les résultats.
- Après un premier chargement, l’application s’ouvre aussi sans connexion.

## Développement

Prérequis : [Bun](https://bun.sh).

```sh
bun install
bun run dev      # http://localhost:5173
bun run test     # tests unitaires
bun run lint
bun run build    # build pour Cloudflare Workers dans .output/
```

## Déploiement (Cloudflare Workers)

Le site est servi par le Worker `crosscollege` (domaine `crosscollege.outilotheque.fr`). Le nom du Worker est fixé dans `nitro.config.ts`.

- **Automatique (recommandé)** : dans Cloudflare, Worker `crosscollege` → _Settings → Builds → Connect_, dépôt `Crosscollege`, branche `main`.
  - Build command : `bun run build`
  - Deploy command : `npx wrangler deploy`
- **Manuel** : `bun run deploy` (demande une connexion `npx wrangler login`).

## Stack

TanStack Start (React 19, SSR) · Vite · Tailwind CSS · Nitro (preset `cloudflare-module`) · xlsx / exceljs / jsPDF côté navigateur · polices auto-hébergées (`@fontsource`).

## Organisation du code

| Fichier                  | Rôle                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `src/lib/local-store.ts` | Stockage local (localStorage) des élèves, courses et arrivées |
| `src/lib/students.ts`    | Lecture et validation du fichier Excel                        |
| `src/lib/bib-pdf.ts`     | PDF des dossards                                              |
| `src/lib/results.ts`     | Classement des classes, format des temps                      |
| `src/lib/results-pdf.ts` | PDF recto-verso des résultats                                 |
| `src/routes/`            | Les trois onglets (`index`, `course`, `resultats`)            |
| `public/sw.js`           | Cache hors-ligne de l’application (pas des données)           |
