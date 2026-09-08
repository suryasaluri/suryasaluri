
-- Phase 1 (Find) advanced capabilities: richer source metadata + scan history.

ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sensitivity_labels JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS credential_label TEXT,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Discovery scans (one row per scan run, for history + auditability)
CREATE TABLE public.discovery_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL,
  target TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  sources_found INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_scans TO authenticated;
GRANT ALL ON public.discovery_scans TO service_role;
ALTER TABLE public.discovery_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.discovery_scans FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));
