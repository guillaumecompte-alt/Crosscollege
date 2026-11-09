<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- **100 % local (RGPD)** : aucune base de données, aucun compte, aucun appel réseau vers un tiers. Ne pas réintroduire Supabase, Lovable Cloud, l'authentification, ni de polices/scripts chargés depuis un CDN externe (les polices viennent de `@fontsource`).
- Toutes les données (liste d'élèves, courses, arrivées) vivent dans le navigateur via `src/lib/local-store.ts` (une seule clé localStorage `cross-college:data:v1`, lue avec `useLocalData()` / `useSyncExternalStore`). Elles restent sur l'ordinateur utilisé ; vider les données du site les efface.
- Au premier chargement, l'ancienne copie hors-ligne (`cross-offline:*`) est récupérée puis les clés de l'ancien système (`cross-offline:*`, `sb-*`) sont supprimées.
- Keep Excel parsing and validation in a browser-safe student module; preserve supplied bib strings so formatted leading zeros are retained. A new import replaces the previous roster.
- Generate PDFs on demand in the browser with a dynamically imported PDF library and canvas-rendered bibs so Unicode names remain printable.
- Header navigation is a shared component; Results tab exports a 2-sheet Excel (raw arrivals, per-class ranking keeping global position) client-side. Races store start/end timestamps so the chrono survives reloads; elapsed time is derived from started_at, and finishes record position + elapsed ms with the bib entered afterwards.
- Results PDF generation stays browser-side with dynamic jsPDF and canvas-rendered Unicode tables; interleave independently paginated arrivals on odd pages and class rankings on even pages for long-edge duplex printing, and keep score calculation in the browser-safe results module.
- `public/sw.js` is a network-first runtime cache for the app shell only, so the app opens without network.
