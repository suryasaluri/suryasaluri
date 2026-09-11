# SAN Connect — Source Code

A centralized real estate sales and operations platform for a land plot & flat
development company — a Customer Portal and an internal Admin/Operations Dashboard,
unified around a shared property inventory (Plots and Flats).

## What's inside

- `src/` — the web app: Customer Portal routes (`portal.*`), Admin Dashboard routes
  (`admin.*`), shared UI, styling tokens
- `supabase/` — database migrations:
  - `20260911000001_san_connect_schema.sql` — enums, tables, row-level security,
    the signup trigger, and storage buckets
  - `20260911000002_san_connect_seed.sql` — demo data: 3 projects, 15 plots + 10
    flats, 6 customers spanning the full lead → sold lifecycle, with payments,
    installment plans, documents and multi-stage approvals
- config files — package manifest, build config, TypeScript, linting, formatting

Not included: installed packages (`node_modules`), build output, and the environment
files containing project keys/secrets.

## Running it locally

### 0. Get a Supabase project

1. Create a free project at [supabase.com](https://supabase.com) (or use an existing one).
2. In the dashboard: **SQL Editor** → open each file in `supabase/migrations/` **in
   filename order** (they're timestamped) → paste the contents → Run. (If you use the
   [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
   instead: `supabase link --project-ref <your-project-ref>` then `supabase db push`.)
3. In **Settings → API** you'll find:
   - **Project URL** → `VITE_SUPABASE_URL` / `SUPABASE_URL` below
   - **`anon` `public` key** → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - The project ref in the URL (`https://<ref>.supabase.co`) → `VITE_SUPABASE_PROJECT_ID`

### Web app

1. Install a JavaScript runtime (Bun or Node 20+).
2. `bun install` (or `npm install`)
3. Create a `.env` in the repo root with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
4. `bun run dev` and open the printed local address (typically `http://localhost:8080`).
5. Sign in on the `/auth` page. Every seeded account uses the password
   `SanConnect@123` — expand "Demo logins" on the sign-in page for the full list, or:
   - `admin@sanconnect.demo` — Admin (sees everything + Reports)
   - `sales1@sanconnect.demo` — Sales (Inventory, Leads/CRM, Tasks)
   - `finance@sanconnect.demo` — Finance (Payments)
   - `legal@sanconnect.demo` — Legal (Documents, Approvals)
   - `customer1@sanconnect.demo` — Customer with a booked plot and an overdue installment
   - `customer2@sanconnect.demo` — Customer with two fully sold, possession-complete properties
   - `customer4@sanconnect.demo` — Customer with a booked flat and a rejected document
   - New customer sign-ups (via "Create account") get an instant Customer Portal account.

## Notes

- `src/routeTree.gen.ts` is generated automatically — do not edit it by hand.
- All colours and styling live as tokens in `src/styles.css`.
- Customer document uploads go to the private `documents` Supabase Storage bucket;
  seeded demo documents instead point at a public sample PDF so "View" works without
  any storage setup.
