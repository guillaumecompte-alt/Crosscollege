# Notes pour les agents

- Déploiement : Cloudflare Workers, Worker `crosscollege` (nom fixé dans `nitro.config.ts`). `bun run build` puis `wrangler deploy`.
- Avant de pousser : `bun run lint`, `bun run test`, `bun run build`.

## Application architecture

- **100 % local (RGPD)** : aucune base de données, aucun compte, aucun appel réseau vers un tiers. Ne pas réintroduire de base de données distante (Supabase…), Lovable, l'authentification, ni de polices/scripts chargés depuis un CDN externe (les polices viennent de `@fontsource`).
- Toutes les données (liste d'élèves, courses, arrivées) vivent dans le navigateur via `src/lib/local-store.ts` (une seule clé localStorage `cross-college:data:v1`, lue avec `useLocalData()` / `useSyncExternalStore`). Elles restent sur l'ordinateur utilisé ; vider les données du site les efface.
- Au premier chargement, l'ancienne copie hors-ligne (`cross-offline:*`) est récupérée puis les clés de l'ancien système (`cross-offline:*`, `sb-*`) sont supprimées.
- Keep Excel parsing and validation in a browser-safe student module; preserve supplied bib strings so formatted leading zeros are retained. A new import replaces the previous roster.
- Generate PDFs on demand in the browser with a dynamically imported PDF library and canvas-rendered bibs so Unicode names remain printable.
- Header navigation is a shared component; Results tab exports a 2-sheet Excel (raw arrivals, per-class ranking keeping global position) client-side. Races store start/end timestamps so the chrono survives reloads; elapsed time is derived from started_at, and finishes record position + elapsed ms with the bib entered afterwards.
- Results PDF generation stays browser-side with dynamic jsPDF and canvas-rendered Unicode tables; interleave independently paginated arrivals on odd pages and class rankings on even pages for long-edge duplex printing, and keep score calculation in the browser-safe results module.
- `public/sw.js` is a network-first runtime cache for the app shell only, so the app opens without network.
- Saisie groupée (onglet Course) : un dossard par ligne, associé dans l'ordre aux arrivées (`src/lib/bulk-bibs.ts`, logique pure testée). Les lignes en trop créent des arrivées **sans temps** (`elapsed_ms: null`, affiché « — » ; la vitesse reste vide). « ? » ou « - » = coureur non identifié.
- Mode d'emploi intégré : route `/aide` (lien dans l'en-tête et « Comment ça marche ? » sur chaque onglet). Le tenir à jour quand une fonctionnalité change.
- Sauvegarde / restauration : bouton « Sauvegarde » dans l'en-tête (`src/components/backup-dialog.tsx`). Fichier JSON `{ app: "cross-college", format: 1, exportedAt, data }` construit et vérifié par `src/lib/backup.ts` (validation stricte avant de remplacer quoi que ce soit). Si le format de `LocalData` change, incrémenter `format` et gérer l'ancien. Le navigateur est prié de ne pas évincer les données (`navigator.storage.persist()`).
