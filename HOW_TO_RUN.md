# Nexus Command — Source Code

FETLA platform (Find · Extract · Transform · Load · Analyze) with the NEXUS AI copilot.

## What's inside
- `src/` — the whole application: pages, app shell, AI copilot, charts, styling tokens
- `supabase/` — database migrations (tables, row-level security, grants, signup trigger)
- config files — package manifest, build config, TypeScript, linting, formatting

Not included: installed packages (`node_modules`), build output, and the environment
file containing project keys.

## Running it locally
1. Install a JavaScript runtime (Bun or Node 20+).
2. `bun install` (or `npm install`)
3. Create a `.env` with your backend project values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   - `LOVABLE_API_KEY` (server-side, for the AI copilot)
4. Apply everything in `supabase/migrations/` to your database, in filename order.
5. `bun run dev` and open the printed local address.

## Notes
- `src/routeTree.gen.ts` is generated automatically — do not edit it by hand.
- All colours and styling live as tokens in `src/styles.css`.
