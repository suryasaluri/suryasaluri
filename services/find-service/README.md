# find-service

Standalone microservice for the **Find** phase of Nexus Command's FETLA pipeline.

Find no longer discovers unknown data sources. Given a database your team has
**already chosen to expose** — connection details supplied up front — it crawls the
schema, derives the relationship graph from foreign keys, flags likely status/enum
columns, classifies the business domain, and generates technical (+ optional AI
functional) documentation. On top of that it suggests and safely runs reports —
schema-validated SQL, never a raw LLM output, with dry-run cost estimation, hard
caps, and a result cache in front of every query. It's a plain HTTP/JSON API — the
Nexus Command web app is one client of it, but any system (an ERP, a CRM, a script,
another internal tool) can call it directly. Every action is recorded to
`audit_logs` and surfaced back as a usage report (`GET /usage`), split by org-wide
total and the caller's own session.

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
| `ANTHROPIC_API_KEY` | no | — | Enables the AI functional-narrative half of generated documentation, domain classification, and natural-language report requests. Omit it and the deterministic technical doc + suggested (template) reports still work. |
| `REPORT_MAX_COST` | no | `10000` | Dry-run optimizer-cost cap (abstract Oracle units) — a report query estimated above this is rejected before it runs. |
| `REPORT_MAX_CARDINALITY` | no | `1000000` | Dry-run estimated-row-count cap, checked alongside `REPORT_MAX_COST`. |

No secrets are ever persisted to the database — connection rows keep host/port/service
name/username and a masked `credential_label`, never the password. Every re-test or
crawl is handed fresh credentials by the caller.

## Auth

Every route except `GET /connectors` and `POST /connectors/:id/test` requires
`Authorization: Bearer <supabase access token>`. The service verifies the token via
`supabase.auth.getUser()`, then resolves `org_id` itself from the `organizations` table
(never trusts a client-supplied org id). An optional `X-Session-Id` header (a
per-browser-tab id the frontend generates) is recorded alongside every audit log
entry, purely for the usage report's total-vs-session split — it plays no role in
authorization.

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
- `GET /connections/:id/domain` — the latest domain classification (generates on
  first request); `{ unavailable: true, reason }` when no `ANTHROPIC_API_KEY` is set
  or there's no crawled schema yet. `POST /connections/:id/domain/regenerate` — forces
  a new one.
- `GET /connections/:id/reports/suggestions` — heuristic report templates from the
  latest crawl (no AI, instant). `POST /connections/:id/reports/run` —
  `{ templateId, fields, filterValues }`, runs a suggested template.
  `POST /connections/:id/reports/custom` — `{ text, fields }`, drafts a spec from
  natural language via Claude then runs it through the same validation as a
  template. All three return one of three shapes: `{status:"validation_error",
  errors}` (schema-checked, nothing ran), `{status:"blocked", sql, estimate}`
  (dry-run over the cost cap, nothing ran), or `{status:"success", sql, estimate,
  cached, rows}`.
- `GET /usage` — `{ total, session, sessionId }`, each an aggregation of this org's
  `audit_logs` by action — `total` org-wide, `session` filtered to the caller's
  `X-Session-Id`.

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
(`statusFields.ts`), the Markdown generator (`technicalDoc.ts`), the report-template
heuristics (`suggest.ts`), spec validation and safe SQL generation (`spec.ts` —
including that a filter value never gets inlined into the SQL text), and the report
result cache (`cache.ts`).
