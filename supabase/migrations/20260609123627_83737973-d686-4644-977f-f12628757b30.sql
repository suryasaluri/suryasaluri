
-- Organizations (one per user for v1)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages org" ON public.organizations FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self profile" ON public.profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Data sources (discovered)
CREATE TABLE public.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  host TEXT,
  port INTEGER,
  status TEXT NOT NULL DEFAULT 'discovered',
  connector_type TEXT,
  table_count INTEGER DEFAULT 0,
  row_count BIGINT DEFAULT 0,
  difficulty_score INTEGER DEFAULT 1,
  schema_metadata JSONB DEFAULT '{}'::jsonb,
  last_discovery TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_sources TO authenticated;
GRANT ALL ON public.data_sources TO service_role;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.data_sources FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

-- Extraction jobs
CREATE TABLE public.extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'incremental',
  schedule TEXT NOT NULL DEFAULT '0 2 * * *',
  tables_selected JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'idle',
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  rows_extracted BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extraction_jobs TO authenticated;
GRANT ALL ON public.extraction_jobs TO service_role;
ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.extraction_jobs FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

-- Transformation policies
CREATE TABLE public.transformation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template TEXT,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transformation_policies TO authenticated;
GRANT ALL ON public.transformation_policies TO service_role;
ALTER TABLE public.transformation_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.transformation_policies FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

-- Load destinations
CREATE TABLE public.load_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dest_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  load_strategy TEXT NOT NULL DEFAULT 'upsert',
  schedule TEXT NOT NULL DEFAULT '0 */6 * * *',
  status TEXT NOT NULL DEFAULT 'active',
  last_load TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.load_destinations TO authenticated;
GRANT ALL ON public.load_destinations TO service_role;
ALTER TABLE public.load_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members" ON public.load_destinations FOR ALL
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read" ON public.audit_logs FOR SELECT
  USING (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));
CREATE POLICY "org members insert" ON public.audit_logs FOR INSERT
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid()));

-- Auto-create org + profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  INSERT INTO public.organizations (owner_id, name, industry)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'org_name', 'My Organization'), 'general')
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, org_id, full_name)
  VALUES (NEW.id, new_org_id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
