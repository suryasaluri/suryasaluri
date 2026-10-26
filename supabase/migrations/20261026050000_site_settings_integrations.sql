-- SAN Connect — site settings (landing page config) and marketing integrations.

-- ============================================================= SITE SETTINGS (singleton)
CREATE TYPE public.hero_animation AS ENUM ('aurora', 'grid_pulse', 'particles', 'none');

CREATE TABLE public.site_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  hero_animation public.hero_animation NOT NULL DEFAULT 'aurora',
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = true)
);
INSERT INTO public.site_settings (id, hero_animation) VALUES (true, 'aurora');

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site settings public read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "site settings admin write" ON public.site_settings
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================= MARKETING INTEGRATIONS
CREATE TYPE public.integration_platform AS ENUM (
  'youtube', 'google_analytics', 'instagram', 'tiktok', 'facebook_meta'
);

CREATE TABLE public.integrations (
  platform public.integration_platform PRIMARY KEY,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  account_handle TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations staff read" ON public.integrations FOR SELECT USING (public.is_staff());
CREATE POLICY "integrations admin write" ON public.integrations
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "integrations admin update" ON public.integrations
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "integrations admin delete" ON public.integrations
  FOR DELETE USING (public.is_admin());

INSERT INTO public.integrations (platform, is_connected) VALUES
  ('youtube', false),
  ('google_analytics', false),
  ('instagram', false),
  ('tiktok', false),
  ('facebook_meta', false);
