
-- Find v2: schema & relationship intelligence for a known connection
-- (Oracle-first). Additive only — discovery_scans is left in place, unused,
-- rather than dropped.

-- data_sources is reused as "known connections": add the Oracle-specific
-- connection params we now persist (never the password).
ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS service_name TEXT;

-- One row per schema-crawl run against a connection.
CREATE TABLE public.schema_crawls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  tables_found INTEGER DEFAULT 0,
  views_found INTEGER DEFAULT 0,
  status_fields JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schema_crawls TO authenticated;
GRANT ALL ON public.schema_crawls TO service_role;
ALTER TABLE public.schema_crawls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.schema_crawls FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

-- The normalized schema itself — one row per table/view, upserted on re-crawl.
CREATE TABLE public.schema_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  name TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  primary_key JSONB NOT NULL DEFAULT '[]'::jsonb,
  foreign_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  row_estimate BIGINT,
  sensitivity_labels JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX schema_objects_unique_object ON public.schema_objects (data_source_id, object_type, name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schema_objects TO authenticated;
GRANT ALL ON public.schema_objects TO service_role;
ALTER TABLE public.schema_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.schema_objects FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

-- Generated technical + (optional AI) functional documentation snapshots.
CREATE TABLE public.documentation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  technical_markdown TEXT NOT NULL,
  functional_markdown TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentation_snapshots TO authenticated;
GRANT ALL ON public.documentation_snapshots TO service_role;
ALTER TABLE public.documentation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.documentation_snapshots FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));
