# find-service

Standalone microservice for the **Find** phase of Nexus Command's FETLA pipeline
(data source discovery + onboarding). It's a plain HTTP/JSON API — the Nexus Command
web app is one client of it, but any system (an ERP, a CRM, a script, another internal
tool) can call it directly.

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

No secrets are ever persisted to the database — only a masked display string
(`credential_label`) is stored per source.

## Auth

Every route except `GET /connectors` and `POST /connectors/:id/test` requires
`Authorization: Bearer <supabase access token>`. The service verifies the token via
`supabase.auth.getUser()`, then resolves `org_id` itself from the `organizations` table
(never trusts a client-supplied org id).

## API

- `GET /health` — liveness.
- `GET /connectors` — the connector catalog (id, label, category, field specs,
  `integration: "real" | "simulated"`). Public.
- `POST /connectors/:id/test` — dry-run a connection with raw fields (`{ fields }`)
  before a source exists. Public.
- `GET /sources` / `POST /sources` — list / manually onboard a source. Creating one
  runs the connector's real or simulated test synchronously and sets `status` from
  the result (`open` / `auth_required` / `blocked`).
- `POST /sources/:id/{connect,authenticate,firewall-request,disconnect}` — lifecycle
  transitions, each logged to `audit_logs`.
- `DELETE /sources/:id`, `POST /sources/bulk` (`{ ids, action: "connect"|"delete" }`).
- `GET /sources/:id/schema` — deterministic mock schema preview.
- `GET /sources/:id/audit` — that source's audit trail.
- `POST /scans` — kicks off a (simulated) discovery scan, returns `{ id }` immediately.
- `GET /scans/:id/stream` — Server-Sent Events: `found` (per candidate), `completed`,
  or `error`. Requires the same bearer auth as everything else — since the browser's
  native `EventSource` can't send headers, the frontend reads this via `fetch` +
  `ReadableStream` instead (see `src/lib/findApiClient.ts` in the web app).
- `GET /scans` — recent scan history.

## Connectors

Split by protocol shape — anything reachable over plain HTTPS with a token/key/OAuth
grant is genuinely wired; anything needing a raw TCP database protocol or heavy
enterprise SSO is simulated behind the identical `ConnectorModule` interface
(`src/connectors/types.ts`), ready to swap in a real driver later.

- **Real**: Stripe, HubSpot, Zendesk, Databricks (bearer/basic REST) · AWS S3, Kinesis
  (AWS SDK) · Google Cloud Storage, BigQuery (service-account JWT → OAuth2) · Azure
  Blob (SAS-token REST) · Salesforce (OAuth2 password grant).
- **Simulated**: PostgreSQL, MySQL, MariaDB, SQL Server, Oracle, MongoDB, Snowflake,
  Redshift, Kafka, Workday.

## Tests

`bun test` runs unit tests against the connector "shapes" with a mocked `fetch`/AWS
client — no live network calls, no real credentials needed.
