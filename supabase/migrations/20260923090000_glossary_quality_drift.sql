-- Nexus Data Intelligence: business glossary + schema drift tracking,
-- layered on top of the existing schema/domain/documentation intelligence.
-- Additive only, same pattern as every prior Find migration.

-- AI-generated business glossary for a connection's latest crawled schema:
-- per-column plain-English terms (with derived-field flags) plus
-- cross-table synonym groups — the "logic" layer the product's tagline
-- names, kept as its own regenerable snapshot the same way domain
-- classification is, rather than folded into documentation_snapshots.
CREATE TABLE public.glossary_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  synonym_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.glossary_snapshots TO authenticated;
GRANT ALL ON public.glossary_snapshots TO service_role;
ALTER TABLE public.glossary_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.glossary_snapshots FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

-- A lightweight table-name/column-name snapshot captured at the moment each
-- crawl completes, so the *next* crawl can diff against it and report drift
-- (tables/columns added, removed, or changed) without needing full
-- historical versions of schema_objects, which only ever holds the latest
-- state (upserted on every re-crawl).
ALTER TABLE public.schema_crawls
  ADD COLUMN IF NOT EXISTS table_summary JSONB NOT NULL DEFAULT '[]'::jsonb;
