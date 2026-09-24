# Nexus Command — Source Code

FETLA platform (Find · Extract · Transform · Load · Analyze) with the NEXUS AI copilot.

## What's inside
- `src/` — the web app: pages, app shell, AI copilot, charts, styling tokens
- `services/find-service/` — standalone microservice for the Find phase: schema &
  relationship intelligence for a database your team already knows (Oracle-first).
  Its own `package.json`; a real HTTP API any system (ERP, CRM, scripts, other
  internal tools) can call, not just this frontend. See `services/find-service/README.md`.
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
   - `ANTHROPIC_API_KEY` — optional, enables the AI functional-narrative half of
     generated documentation, domain classification, the business glossary, the
     schema copilot, and natural-language report requests. The deterministic
     technical doc (including its naming/referential signals), schema drift
     detection, and suggested (template) reports all work without it.
   - `REPORT_MAX_COST` / `REPORT_MAX_CARDINALITY` — optional, the dry-run thresholds a
     generated report query is checked against before it's allowed to run (defaults
     `10000` / `1000000`). See "Reports & cost controls" below.
3. `bun run dev`

Once both are running, sign in, then `/app/find` should load for real — register an
Oracle connection (host, port, service name, username, password), or add a `.csv`/
`.xlsx` file connection to try Nexus with no live database at all, crawl its schema,
and browse the Schema / Relationships / Status fields / Glossary / Domain / Copilot /
Reports / Documentation tabs, all talking to this service. The home page (`/app`) shows a
"Platform activity" usage report card — click it for total-usage-vs-this-session
breakdowns, sourced from the service's own audit log.

The frontend authenticates to the service by forwarding the user's Supabase access
token as a bearer token — no separate login needed — plus a per-tab `X-Session-Id`
header the usage report uses for its "this session" split. `GET /connectors` and
`POST /connectors/:id/test` are intentionally public (no auth), so other systems can
query the catalog or dry-run a connection without a Nexus Command session.

Find connects to a database your team already knows and exposes — it no longer scans
for unknown sources. Two connectors exist today: Oracle / Oracle Fusion (real
connectivity via `oracledb`'s Thin mode — no Oracle Instant Client needed) and a file
upload (`.csv`/`.xlsx`, for trying Nexus against a real export before wiring up
credentials, or in an environment with no reachable database). Both are architected
the same way, so a third database type is a new connector module away, not a rewrite.

#### Domain classification

Once a connection has a crawled schema, the **Domain** tab classifies it — a
business-domain label (e.g. `real_estate`) with a confidence score and a rationale,
plus a per-table tag (`real_estate:core` vs `system`) so generic tables like an audit
log don't get forced under the main label or offered up as report candidates.
Requires `ANTHROPIC_API_KEY`; without it the tab explains that plainly rather than
failing. Nothing about this classification is hard-coded to real estate or any other
industry — it's inferred fresh from whatever schema gets crawled.

#### Business glossary

The **Glossary** tab reconstructs the layer that normally only lives in tribal
knowledge: a plain-English term and definition for each business-meaningful column,
a flag (with the formula) for columns whose value is derived rather than stored, and
synonym groups linking differently-named columns across tables that mean the same
thing (e.g. a denormalized `orders.total_qty` and `order_items.quantity`). It also
surfaces the schema-only, AI-free "unconstrained reference" signal — an `*_id`
column with no declared foreign key, where a table matching the implied name exists
anyway. Requires `ANTHROPIC_API_KEY` for the AI-generated half (terms + synonym
groups); the unconstrained-reference signal works without it. Downloadable as
Markdown or PDF, both generated client-side.

#### Copilot

The **Copilot** tab (labelled "Ask Nexus" in the UI — distinct from the site-wide
NEXUS AI chat bubble mentioned above) answers questions about a connection's schema,
glossary, and documentation, grounded strictly in what's actually been crawled and
generated. It deliberately never runs a query or states a specific data value as
fact — for anything that needs a real number, it points at the Reports tab, which is
the only code path allowed to draft SQL. Every answer carries **citations** — a
"Sources" row of clickable chips, each a real `table` or `table.column` the answer
relied on (validated against the schema before being shown; a hallucinated ref is
dropped rather than displayed as if it were grounded) — clicking one jumps to the
Schema tab and expands that table, the same "click a citation, land at the source"
behavior a grounded codebase-wiki answer gives. The functional narrative in the
Documentation tab gets the same treatment, ending in a "## Sources" section. The same
tab also has one-click downloads (Markdown/PDF) for the latest documentation and
glossary, so a report or write-up can be pulled without switching tabs.

#### Relationship diagram

The **Relationships** tab opens with a visual ER-style diagram — every table as a
node, every foreign key as an arrow — above the existing text list, laid out
deterministically (tables with more relationships placed first, no external graph-
layout library) and scrollable for a schema with many tables. A gold dot flags a
table with at least one sensitive (PII/PHI/PCI) column; clicking a table jumps to its
entry in the Schema tab.

#### Schema drift

Re-crawling a connection compares the new schema against the *previous* completed
crawl (a lightweight table/column-name snapshot kept on each `schema_crawls` row) and
surfaces what changed — tables or columns added/removed — as a banner on the
connection's detail view. Independently, the Documentation and Glossary tabs each
show a **"Stale"** badge whenever their snapshot predates the latest crawl, so a
schema that moved doesn't get documented against silently — regenerate either from
the same tab. (A credential-storing background poller that re-crawls on a timer was
deliberately not built: Nexus never persists a database password or file content past
the request that used it, and auto re-indexing would require holding one on hand
between crawls. The safe equivalent is this staleness signal plus a customer's own CI
calling `POST /connections/:id/crawl` right after a deploy, with fresh credentials
each time.)

#### MCP server

`services/find-service` also ships an MCP (Model Context Protocol) server
(`cd services/find-service && bun run mcp`) exposing `ask_schema`, `read_glossary`,
and `read_relationships` as tools — so another AI tool (a coding agent working on a
customer's own codebase, Claude Desktop, etc.) can query a connection's schema
intelligence directly, not just a human in this web app. It needs `FIND_API_TOKEN` (a
Supabase access token) and talks to this same find-service instance over HTTP, so the
external agent gets the identical guarded behavior — `ask_schema` never invents a
data value, same as the web app's Copilot tab. See
`services/find-service/README.md` for details.

#### Reports & cost controls

The **Reports** tab suggests report templates from the schema alone (no AI needed —
joins from foreign keys, group-by candidates from string columns, aggregations from
numeric ones), and a natural-language box drafts a report from a request like "active
properties by city" via Claude, which is then validated against the real schema
exactly like a suggested template — an LLM's output is never trusted directly into
SQL. Three cost controls apply to every report run, suggested or custom:

1. **Dry-run first** — the built SQL is `EXPLAIN PLAN`'d before it runs; a query whose
   estimated cost/cardinality exceeds `REPORT_MAX_COST`/`REPORT_MAX_CARDINALITY` is
   rejected before it's ever executed.
2. **Hard caps** — the row cap is inlined into the SQL itself (`FETCH FIRST n ROWS
   ONLY`) and the connection's `callTimeout` is set, so a runaway query can't outrun
   either cap.
3. **24h result cache** — an exact-match repeat query (same SQL + bind values) is
   served from an in-memory cache instead of re-hitting Oracle.

(This is Oracle's own mechanical equivalent of the `jobs.query dryRun` /
`maximumBytesBilled` / query-cache trio BigQuery exposes natively — Oracle has no
per-byte billing, so the caps are expressed in the optimizer's own cost/cardinality
units instead of bytes.)

## Notes
- `src/routeTree.gen.ts` is generated automatically — do not edit it by hand.
- All colours and styling live as tokens in `src/styles.css`.
