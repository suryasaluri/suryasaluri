# find-service

Standalone microservice for the **Find** phase of Nexus Command's FETLA pipeline.

Your database has the data. Nexus gives it back the logic — that's the whole product,
and this service is where it's reconstructed. Find no longer discovers unknown data
sources. Given a database your team has **already chosen to expose** — connection
details supplied up front — it crawls the schema, derives the relationship graph from
foreign keys, flags likely status/enum columns, classifies the business domain,
reconstructs a business glossary (plain-English term per column, derived-field
detection, cross-table naming normalization), flags reference-shaped columns with no
declared foreign key, and generates technical (+ optional AI functional) documentation.
A grounded AI copilot answers questions about the schema/glossary/documentation
directly — never inventing a number — and both documentation and glossary can be
downloaded as Markdown or PDF. On top of that it suggests and safely runs reports —
schema-validated SQL, never a raw LLM output, with dry-run cost estimation, hard
caps, and a result cache in front of every query. Re-crawling a connection flags
schema drift against the previous crawl, so the reconstructed logic doesn't silently
go stale. It's a plain HTTP/JSON API — the Nexus Command web app is one client of it,
but any system (an ERP, a CRM, a script, another internal tool) can call it directly.
Every action is recorded to `audit_logs` and surfaced back as a usage report
(`GET /usage`), split by org-wide total and the caller's own session.

None of this is tuned to one industry or one company's schema — domain
classification, the glossary, and the naming-consistency signals are all inferred
fresh from whatever schema is crawled, not pattern-matched against a known one.

Two connectors exist today: **Oracle / Oracle Fusion** (a live database) and **file
upload** (`.csv`/`.xlsx` — a zero-setup way to try Nexus against a real export before
anyone hands over credentials at all). Both implement the same interface
(`src/connectors/types.ts`), so a third database type is a new connector module + one
registry line, not a rewrite (`src/connectors/registry.ts`).

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
| `ANTHROPIC_API_KEY` | no | — | Enables the AI functional-narrative half of generated documentation, domain classification, the business glossary, the copilot, and natural-language report requests. Omit it and the deterministic technical doc, naming/referential signals, and suggested (template) reports still work. |
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
  relationship graph (derived from foreign keys, not stored separately), detected
  status/enum fields, unconstrained-reference signals (`unconstrainedReferences`, no
  AI, always on), and `drift` — added/removed tables and changed columns versus the
  *previous* completed crawl, or `null` when there's nothing to report.
- `GET /connections/:id/documentation` — generates on first request, then serves the
  stored snapshot, plus `stale: boolean` (true when the schema's been re-crawled since
  this snapshot was generated). `POST /connections/:id/documentation/regenerate` —
  forces a new one. The functional narrative's Markdown ends with a "## Sources"
  section — every table/column/constraint the narrative actually cited, validated
  against the real schema (a hallucinated ref is dropped, never shown as real).
- `GET /connections/:id/domain` — the latest domain classification (generates on
  first request); `{ unavailable: true, reason }` when no `ANTHROPIC_API_KEY` is set
  or there's no crawled schema yet. `POST /connections/:id/domain/regenerate` — forces
  a new one.
- `GET /connections/:id/glossary` — the business glossary: `terms` (one per
  business-meaningful column — a short term, a plain-English definition, and an
  `isDerived`/`derivationLogic` flag for computed values), `synonym_groups`
  (columns across different tables that mean the same thing under different names),
  and `stale: boolean` (same convention as documentation). Same generate-on-first-
  request / `{ unavailable, reason }` convention as domain.
  `POST /connections/:id/glossary/regenerate`.
- `POST /connections/:id/copilot/ask` — `{ question }` → `{ answer, citations }`.
  Answers strictly from the crawled schema, glossary, and documentation already on
  file — it never runs a query or states a specific data value, and tells the caller
  to use `/reports/custom` instead when the question actually needs a real number.
  Every citation is a table/table.column/constraint ref validated against the real
  schema before being returned — the same "click a citation, land at something real"
  guarantee a grounded codebase-wiki answer gives, just at schema granularity instead
  of a source line. `{ unavailable, reason }` under the same convention when no
  `ANTHROPIC_API_KEY` is set.
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

## File connector

`src/connectors/file/` — a zero-setup way to try Nexus against a real export (a sales
extract, a vendor-config workbook) before wiring up live database credentials, or to
test the pipeline in an environment with no reachable database at all. Two files
(`file1`/`file2` in the connector's fields, the second optional) are combined into one
schema per crawl; a `.csv` becomes one table named after the file, a `.xlsx` workbook
becomes one table per sheet (a sheet whose first row has fewer than 2 non-empty cells
— a "Read Me" cover sheet, say — is skipped as non-tabular). Column types are guessed
from sampled values into the same Oracle-style tokens (`NUMBER`/`DATE`/`VARCHAR2`) the
rest of the pipeline already pattern-matches on, so a file-sourced schema runs through
domain classification, the glossary, report suggestions, and the unconstrained-
reference heuristic identically to a crawled database's. Parsing is capped at 5,000
rows per file (`MAX_ROWS` in `csv.ts`) and the service's Fastify instance raises its
body limit to 25MB to fit a realistic upload's base64 payload. Nothing is persisted
server-side beyond the derived schema — like a database password, the file itself is
supplied fresh by the caller on every crawl, never stored.

Tested in `test/fileConnector.test.ts` against real files: a trimmed extract of an
Oracle Fusion sales export and an actual multi-sheet vendor-config workbook (both
supplied for that purpose) — not synthetic fixtures.

## Documentation generation

`src/docs/technicalDoc.ts` renders deterministic Markdown from the normalized schema —
no external dependency, always available — including a "Naming & referential signals"
section from `src/quality/dataQuality.ts`. `src/docs/functionalDoc.ts` additionally
calls the Claude API for a business-relationship narrative when `ANTHROPIC_API_KEY`
is set; it returns `null` gracefully otherwise. `src/docs/glossary.ts` follows the
same convention for the business glossary.

## Data quality & drift signals

`src/quality/dataQuality.ts` — schema-only, no AI, no live query: flags columns
shaped like a foreign key (`*_id`, not the table's own primary key) that aren't
backed by a declared `FOREIGN KEY` constraint, where a table matching the implied
name actually exists in the schema (a real, common failure mode — an unconstrained
reference left behind by a bad delete/import). `src/schema/drift.ts` — a lightweight
table/column-name snapshot is captured on every completed crawl
(`schema_crawls.table_summary`) and diffed against the previous one, so re-crawling a
connection surfaces what changed without needing full historical versions of
`schema_objects` (which only ever holds the latest state).

## Copilot

`src/copilot/ask.ts` — grounded Q&A over the schema, glossary, and documentation
already on file. Deliberately separate from the guarded report pipeline
(`nlParse.ts` + `spec.ts`), which is the only code path allowed to draft SQL: the
copilot never runs a query or states a specific data value as fact. Every answer is
generated via Claude tool-use as `{ answer, citations }` and `src/citations.ts` drops
any citation ref that doesn't literally exist in the schema before it's returned —
the same "never trust the draft directly" discipline `nlParse.ts` applies to a
drafted report spec. `src/docs/functionalDoc.ts` uses the same tool + validator for
the functional narrative's "## Sources" section.

## MCP server

`src/mcp/server.ts` (`bun run mcp`) exposes three read-only tools over the Model
Context Protocol — `ask_schema`, `read_glossary`, `read_relationships` — so another
AI tool (a coding agent working on the customer's own codebase, Claude Desktop, etc.)
can query a connection's schema intelligence directly, the same role a codebase
wiki's MCP server plays for source code, just grounded in a database's schema instead
of its files. It's a thin proxy (`src/mcp/client.ts`) over find-service's own HTTP
API — `ask_schema` calls the same guarded `/copilot/ask` endpoint the web app uses, so
an external agent gets the identical trust guarantee (no invented data values) a human
using the Find UI gets. Needs `FIND_API_TOKEN` (a Supabase access token for the org
it should act as) and optionally `FIND_SERVICE_URL` (default `http://localhost:4001`).
`src/mcp/client.ts`'s functions take an injected `fetchImpl`, so they're unit-tested
with a mocked fetch rather than a live server.

## Tests

`bun test` covers the Oracle row-mapping logic (`introspect.ts`, against a mocked
query executor — no live database needed), the CHECK-constraint parsing
(`statusFields.ts`), the Markdown generator (`technicalDoc.ts`), the report-template
heuristics (`suggest.ts`), spec validation and safe SQL generation (`spec.ts` —
including that a filter value never gets inlined into the SQL text), the report
result cache (`cache.ts`), the unconstrained-reference heuristic
(`dataQuality.ts`), the schema-drift diff (`drift.ts`), the citation validator
(`citations.ts`), the MCP client/server (`mcp.test.ts`, against a mocked fetch), and
the file connector (`fileConnector.test.ts`, against the real uploaded CSV/XLSX
fixtures in `test/fixtures/` — not synthetic ones). The Claude-calling modules
(`classifier.ts`, `functionalDoc.ts`, `glossary.ts`, `copilot/ask.ts`) have no unit
tests of their own — each returns `null` deterministically without
`ANTHROPIC_API_KEY`, which is the only branch testable without a live call.
