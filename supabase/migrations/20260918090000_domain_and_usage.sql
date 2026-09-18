
-- Merged direction: AI domain classification + safe reporting, layered on top
-- of the Oracle schema/relationship intelligence already in place. Additive
-- only, same pattern as every prior Find migration.

-- Usage tracking needs a total-vs-session split (home page usage report).
-- session_id is a per-browser-tab id the frontend generates and sends as
-- X-Session-Id; it is never used for authorization, only for this breakdown.
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS session_id TEXT;
CREATE INDEX IF NOT EXISTS audit_logs_org_action_idx ON public.audit_logs (org_id, action, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_org_session_idx ON public.audit_logs (org_id, session_id);

-- AI-inferred domain (e.g. "real_estate") for a connection's latest crawled
-- schema, with a per-table breakdown so a mixed schema (domain tables +
-- system/audit tables) doesn't get forced under one label.
CREATE TABLE public.domain_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  rationale TEXT NOT NULL,
  table_domains JSONB NOT NULL DEFAULT '{}'::jsonb,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.domain_classifications TO authenticated;
GRANT ALL ON public.domain_classifications TO service_role;
ALTER TABLE public.domain_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.domain_classifications FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));
