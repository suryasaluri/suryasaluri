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
Two processes: the web app and the find-service microservice. Both need the *same*
Supabase project.

### 0. Get a Supabase project
1. Create a free project at [supabase.com](https://supabase.com) (or use an existing one).
2. In the dashboard: **SQL Editor** → open each file in `supabase/migrations/` **in
   filename order** (they're timestamped) → paste the contents → Run. (If you use the
   [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
   instead: `supabase link --project-ref <your-project-ref>` then `supabase db push`.)
3. In **Settings → API** you'll find:
   - **Project URL** → `VITE_SUPABASE_URL` / `SUPABASE_URL` below
   - **`anon` `public` key** → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **`service_role` `secret` key** → `SUPABASE_SERVICE_ROLE_KEY` (find-service only —
     never put this one in the web app's `.env`, it bypasses row-level security)
   - The project ref in the URL (`https://<ref>.supabase.co`) → `VITE_SUPABASE_PROJECT_ID`

### Web app
1. Install a JavaScript runtime (Bun or Node 20+).
2. `bun install` (or `npm install`)
3. Create a `.env` in the repo root with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   - `LOVABLE_API_KEY` — optional. This is specific to Lovable's AI gateway; without it
     everything works except the NEXUS AI copilot chat bubble (`/api/chat` will return
     a 500). Skip it unless you have a Lovable Cloud account.
   - `VITE_FIND_SERVICE_URL` (default `http://localhost:4001` if omitted)
4. `bun run dev` and open the printed local address (typically `http://localhost:8080`).
5. Sign up with any email/password on the `/auth` page — the `handle_new_user` trigger
   in the first migration auto-creates your organization and profile row.

### Find microservice (run alongside the web app, in a second terminal)
1. `cd services/find-service && bun install`
2. Create a `.env` in `services/find-service/` with:
   - `SUPABASE_URL` — same project URL as the web app
   - `SUPABASE_SERVICE_ROLE_KEY` — the service-role secret from step 0 above
   - `PORT` (default `4001`)
   - `CORS_ORIGIN` — the web app's origin, must match exactly (default
     `http://localhost:8080`)
3. `bun run dev`

Once both are running, sign in, then `/app/find` should load the discovery UI for
real — scans, the Add Source dialog, and the source list all talk to this service.

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
