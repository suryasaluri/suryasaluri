
-- LLM resource-usage tracking + a per-org cap on output tokens per AI
-- request. Every Claude call in find-service (domain classification,
-- glossary, functional documentation, copilot, NL report parsing) already
-- returns response.usage — this captures it per call so it can be shown to
-- users, and adds a settings row the org can use to cap max_tokens on every
-- future call (a cap only ever tightens the per-feature default, never
-- raises it — see src/ai/maxTokensCap.ts).

CREATE TABLE public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE CASCADE,
  session_id TEXT,
  feature TEXT NOT NULL, -- 'domain_classification' | 'glossary' | 'functional_documentation' | 'copilot' | 'report_nl_parse'
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  max_output_tokens_requested INTEGER NOT NULL,
  max_output_tokens_cap_applied INTEGER, -- null when the org has no cap set (feature default was used as-is)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_events_org_created_idx ON public.ai_usage_events (org_id, created_at);
CREATE INDEX ai_usage_events_org_session_idx ON public.ai_usage_events (org_id, session_id);
CREATE INDEX ai_usage_events_org_feature_idx ON public.ai_usage_events (org_id, feature);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.ai_usage_events FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

-- One row per org. max_output_tokens = null means "no cap — use each
-- feature's own tuned default". When set, it can only lower a feature's
-- default ceiling, never raise it (enforced in application code).
CREATE TABLE public.org_ai_settings (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  max_output_tokens INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_ai_settings TO authenticated;
GRANT ALL ON public.org_ai_settings TO service_role;
ALTER TABLE public.org_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.org_ai_settings FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));
