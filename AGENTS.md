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
- Keep Excel parsing and validation in a browser-safe student module; preserve supplied bib strings so formatted leading zeros are retained.
- Keep the roster in the app's database behind a signed-in account, with row-level security scoped to the owner, so it survives reloads and stays invisible to anonymous visitors; a new import replaces the previous roster in a single atomic database call.
- Generate PDFs on demand in the browser with a dynamically imported PDF library and canvas-rendered bibs so Unicode names remain printable.
- Header navigation is a shared component; Results tab exports a 2-sheet Excel (raw arrivals, per-class ranking keeping global position) client-side. Races and finishes are stored per owner (RLS) with start/end timestamps so the chrono survives reloads; elapsed time is derived from started_at, and finishes record position + elapsed ms with the bib entered afterwards.
- Results PDF generation stays browser-side with dynamic jsPDF and canvas-rendered Unicode tables; interleave independently paginated arrivals on odd pages and class rankings on even pages for long-edge duplex printing, and keep score calculation in the browser-safe results module.
- Offline support lives in `src/lib/offline.ts`: the last roster/races/finishes snapshot is cached per account in localStorage; offline writes are appended to a `pending` op queue replayed in order by `useOfflineSync` when the network returns. A row already in the queue must never be written directly (the server doesn't know it yet) — always check `isPendingRow` and queue instead. `public/sw.js` is a network-first runtime cache for the app shell only; server-function and database requests are never cached.
