# find-service

Standalone microservice for the **Find** phase of Nexus Command's FETLA pipeline.

Find no longer discovers unknown data sources. Given a database your team has
**already chosen to expose** — connection details supplied up front — it crawls the
schema, derives the relationship graph from foreign keys, flags likely status/enum
columns, and generates technical (+ optional AI functional) documentation. It's a
plain HTTP/JSON API — the Nexus Command web app is one client of it, but any system
(an ERP, a CRM, a script, another internal tool) can call it directly.

Scope today is **Oracle / Oracle Fusion** only, architected so another database type
is a new connector module + one registry line, not a rewrite (`src/connectors/registry.ts`).

## Running

```
bun install
bun run dev     # bun run --watch src/index.ts
```

Environment variables:

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `SUPABASE_URL` | yes | — | Same Supabase project as the web app |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | — | Service-role key — bypasses RLS. Server-only secret. |
| `PORT` | no | `4001` | |
| `CORS_ORIGIN` | no | `http://localhost:8080` | Comma-separated list of allowed origins |
| `ANTHROPIC_API_KEY` | no | — | Enables the AI functional-narrative half of generated documentation. Omit it and the service still returns the deterministic technical doc. |

No secrets are ever persisted to the database — connection rows keep host/port/service
name/username and a masked `credential_label`, never the password. Every re-test or
crawl is handed fresh credentials by the caller.

## Auth

Every route except `GET /connectors` and `POST /connectors/:id/test` requires
`Authorization: Bearer <supabase access token>`. The service verifies the token via
`supabase.auth.getUser()`, then resolves `org_id` itself from the `organizations` table
(never trusts a client-supplied org id).

## API

- `GET /health` — liveness.
- `GET /connectors` — the connector catalog (just Oracle today). Public.
- `POST /connectors/:id/test` — dry-run a connection with raw fields (`{ fields }`)
  before registering anything. Public.
- `GET /connections` / `POST /connections` — list / register a known connection.
  Registering tests it synchronously and sets `status` (`connected` / `auth_required`
  / `unreachable`) from the real result.
- `POST /connections/:id/test` — re-test with freshly supplied credentials.
- `DELETE /connections/:id`.
- `POST /connections/:id/crawl` — kicks off schema introspection, returns `{ id }`
  immediately. `GET /crawls/:id/stream` — Server-Sent Events: `table_found` (per
  table/view), `completed`, or `error`. Same bearer auth as everything else — since
  the browser's native `EventSource` can't send headers, the frontend reads this via
  `fetch` + `ReadableStream` instead (see `src/lib/findApiClient.ts` in the web app).
  `GET /connections/:id/crawls` — crawl history.
- `GET /connections/:id/schema` — the latest crawl's tables/views/columns/keys, the
  relationship graph (derived from foreign keys, not stored separately), and detected
  status/enum fields.
- `GET /connections/:id/documentation` — generates on first request, then serves the
  stored snapshot. `POST /connections/:id/documentation/regenerate` — forces a new one.

## Oracle connector

`src/connectors/oracle/` — uses `oracledb` in **Thin mode** (pure JavaScript, no
Oracle Instant Client install) to connect and query the standard data dictionary
(`USER_TABLES`/`USER_VIEWS`, `USER_TAB_COLUMNS`, `USER_CONSTRAINTS`+`USER_CONS_COLUMNS`
for primary/foreign/check constraints). `src/schema/statusFields.ts` parses CHECK
constraint text for enum-like columns (e.g. `STATUS IN ('ACTIVE','SOLD')`); a name
heuristic (`status|state|flag`) catches the rest. `src/sensitivity.ts` flags likely
PII/PHI/PCI columns by name.

## Documentation generation

`src/docs/technicalDoc.ts` renders deterministic Markdown from the normalized schema —
no external dependency, always available. `src/docs/functionalDoc.ts` additionally
calls the Claude API for a business-relationship narrative when `ANTHROPIC_API_KEY`
is set; it returns `null` gracefully otherwise.

## Tests

`bun test` covers the Oracle row-mapping logic (`introspect.ts`, against a mocked
query executor — no live database needed), the CHECK-constraint parsing
(`statusFields.ts`), and the Markdown generator (`technicalDoc.ts`).
