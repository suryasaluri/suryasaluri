# Nexus Command — Source Code

FETLA platform (Find · Extract · Transform · Load · Analyze) with the NEXUS AI copilot.

## What's inside
- `src/` — the web app: pages, app shell, AI copilot, charts, styling tokens
- `services/find-service/` — standalone microservice for the Find phase (data source
  discovery/onboarding). Its own `package.json`; a real HTTP API any system (ERP, CRM,
  scripts, other internal tools) can call, not just this frontend. See
  `services/find-service/README.md`.
- `supabase/` — database migrations (tables, row-level security, grants, signup trigger)
- config files — package manifest, build config, TypeScript, linting, formatting

Not included: installed packages (`node_modules`), build output, and the environment
files containing project keys/secrets.

## Running it locally
Two processes: the web app and the find-service microservice.

**Web app:**
1. Install a JavaScript runtime (Bun or Node 20+).
2. `bun install` (or `npm install`)
3. Create a `.env` with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   - `LOVABLE_API_KEY` (server-side, for the AI copilot)
   - `VITE_FIND_SERVICE_URL` (default `http://localhost:4001` if omitted)
4. Apply everything in `supabase/migrations/` to your database, in filename order.
5. `bun run dev` and open the printed local address.

**Find microservice** (run alongside the web app):
1. `cd services/find-service && bun install`
2. Create a `.env` (or export) with:
   - `SUPABASE_URL` — same project as the web app
   - `SUPABASE_SERVICE_ROLE_KEY` — service-role key (server-only secret, never the anon key)
   - `PORT` (default `4001`)
   - `CORS_ORIGIN` — the web app's origin (default `http://localhost:8080`)
3. `bun run dev`

The frontend authenticates to the service by forwarding the user's Supabase access
token as a bearer token — no separate login needed. `GET /connectors` and
`POST /connectors/:id/test` are intentionally public (no auth), so other systems can
query the catalog or dry-run a connection without a Nexus Command session.

Ten of the twenty connectors (Stripe, HubSpot, Zendesk, Databricks, AWS S3/Kinesis,
Google Cloud Storage/BigQuery, Azure Blob, Salesforce) make real HTTP/SDK/OAuth calls
to the actual vendor APIs when given real credentials. The other ten (the raw-TCP
databases, Snowflake/Redshift, Kafka, Workday) are simulated behind the same interface.

## Notes
- `src/routeTree.gen.ts` is generated automatically — do not edit it by hand.
- All colours and styling live as tokens in `src/styles.css`.
