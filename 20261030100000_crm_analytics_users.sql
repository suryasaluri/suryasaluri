-- SAN Connect — CRM-grade lead management (call logs, deal restrictions,
-- follow-up timing) and a website/social analytics data source for the
-- expanded Reports and Website & Marketing pages. The analytics tables hold
-- synthetic-but-plausible daily snapshots, since no real GA/social API is
-- connected in this demo — same "demo-mode" approach used elsewhere in the
-- app (e.g. attendance seed history, the keyless AI agent).

-- ============================================================= CRM: deal timing & restrictions
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stage_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage_lock_reason TEXT;

-- ============================================================= CALL LOGS
CREATE TYPE public.call_direction AS ENUM ('outbound', 'inbound');
CREATE TYPE public.call_outcome AS ENUM ('connected', 'no_answer', 'voicemail', 'busy', 'wrong_number');

CREATE TABLE public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  direction public.call_direction NOT NULL DEFAULT 'outbound',
  outcome public.call_outcome NOT NULL DEFAULT 'connected',
  duration_minutes INTEGER,
  notes TEXT,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX call_logs_customer_idx ON public.call_logs(customer_id);
CREATE INDEX call_logs_called_at_idx ON public.call_logs(called_at);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_logs staff read" ON public.call_logs FOR SELECT USING (public.is_staff());
CREATE POLICY "call_logs staff insert" ON public.call_logs FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "call_logs staff update" ON public.call_logs FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "call_logs admin delete" ON public.call_logs FOR DELETE USING (public.is_admin());

-- ============================================================= WEBSITE ANALYTICS (synthetic daily snapshot)
CREATE TYPE public.traffic_source AS ENUM ('organic', 'paid', 'social', 'referral', 'direct');

CREATE TABLE public.website_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  sessions INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  page_views INTEGER NOT NULL DEFAULT 0,
  avg_session_seconds INTEGER NOT NULL DEFAULT 0,
  bounce_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  leads_generated INTEGER NOT NULL DEFAULT 0,
  top_source public.traffic_source NOT NULL DEFAULT 'organic',
  seo_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX website_metrics_date_idx ON public.website_metrics(date);

ALTER TABLE public.website_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "website_metrics staff read" ON public.website_metrics FOR SELECT USING (public.is_staff());
CREATE POLICY "website_metrics admin insert" ON public.website_metrics FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "website_metrics admin update" ON public.website_metrics FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "website_metrics admin delete" ON public.website_metrics FOR DELETE USING (public.is_admin());

-- ============================================================= SOCIAL ENGAGEMENT (synthetic daily snapshot per platform)
CREATE TABLE public.social_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform public.integration_platform NOT NULL,
  date DATE NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  engagement_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, date)
);
CREATE INDEX social_engagement_date_idx ON public.social_engagement(date);

ALTER TABLE public.social_engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_engagement staff read" ON public.social_engagement FOR SELECT USING (public.is_staff());
CREATE POLICY "social_engagement admin insert" ON public.social_engagement FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "social_engagement admin update" ON public.social_engagement FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "social_engagement admin delete" ON public.social_engagement FOR DELETE USING (public.is_admin());

-- ============================================================= SEED: ~90 days of website analytics
-- Deterministic (hashtext-seeded, not random()) so re-running this file is
-- idempotent-safe and every environment sees the same demo numbers.
INSERT INTO public.website_metrics
  (date, sessions, unique_visitors, page_views, avg_session_seconds, bounce_rate_pct, leads_generated, top_source, seo_score)
SELECT
  s.d::date,
  s.sessions,
  round(s.sessions * 0.78)::int,
  round(s.sessions * (2.1 + (abs(hashtext(s.d::text || 'pv')) % 10) / 10.0))::int,
  95 + (abs(hashtext(s.d::text || 'avg')) % 60),
  round((38 + (abs(hashtext(s.d::text || 'bounce')) % 15))::numeric, 2),
  greatest(1, round(s.sessions * (0.02 + (abs(hashtext(s.d::text || 'lead')) % 4) / 100.0)))::int,
  (ARRAY['organic', 'organic', 'organic', 'paid', 'social', 'referral', 'direct']::public.traffic_source[])
    [1 + (abs(hashtext(s.d::text || 'src')) % 7)],
  least(94, greatest(40, 56 + round((s.idx / 89.0) * 28) + ((abs(hashtext(s.d::text || 'seo')) % 7) - 3)))::int
FROM (
  SELECT
    d,
    row_number() OVER (ORDER BY d) - 1 AS idx,
    greatest(
      45,
      round(
        (170 + (row_number() OVER (ORDER BY d) - 1) * 2.3)
        * (CASE WHEN extract(isodow FROM d) IN (6, 7) THEN 0.62 ELSE 1.0 END)
      ) + ((abs(hashtext(d::text || 'jit')) % 44) - 22)
    ) AS sessions
  FROM generate_series(current_date - interval '89 days', current_date, interval '1 day') AS g(d)
) s
ON CONFLICT (date) DO NOTHING;

-- ============================================================= SEED: ~90 days of social engagement, 4 platforms
INSERT INTO public.social_engagement (platform, date, followers, impressions, engagement_rate_pct, clicks)
SELECT
  x.platform,
  x.d::date,
  greatest(0, round(x.base_followers + x.idx * x.growth_rate) + ((abs(hashtext(x.platform::text || x.d::text || 'f')) % 30) - 15))::int,
  round((x.base_followers + x.idx * x.growth_rate) * (0.08 + (abs(hashtext(x.platform::text || x.d::text || 'i')) % 10) / 100.0))::int,
  round((1.5 + (abs(hashtext(x.platform::text || x.d::text || 'e')) % 400) / 100.0)::numeric, 2),
  round((x.base_followers + x.idx * x.growth_rate) * (0.01 + (abs(hashtext(x.platform::text || x.d::text || 'c')) % 3) / 100.0))::int
FROM (
  SELECT
    p.platform, p.base_followers, p.growth_rate, g.d,
    row_number() OVER (PARTITION BY p.platform ORDER BY g.d) - 1 AS idx
  FROM (VALUES
    ('instagram'::public.integration_platform, 2400, 9.5),
    ('youtube'::public.integration_platform, 890, 4.2),
    ('facebook_meta'::public.integration_platform, 3600, 3.1),
    ('tiktok'::public.integration_platform, 1250, 14.0)
  ) AS p(platform, base_followers, growth_rate)
  CROSS JOIN generate_series(current_date - interval '89 days', current_date, interval '1 day') AS g(d)
) x
ON CONFLICT (platform, date) DO NOTHING;

-- ============================================================= SEED: a few call logs, follow-ups, and one locked deal
-- for the original demo customers, so the CRM detail views aren't empty.
DO $$
DECLARE
  v_sales1 UUID; v_sales2 UUID;
  v_arjun UUID; v_meera UUID; v_vikram UUID; v_divya UUID; v_rahul UUID; v_sanjay UUID;
BEGIN
  SELECT id INTO v_sales1 FROM public.profiles WHERE email = 'sales1@sanconnect.demo';
  SELECT id INTO v_sales2 FROM public.profiles WHERE email = 'sales2@sanconnect.demo';
  SELECT id INTO v_arjun FROM public.customers WHERE email = 'customer1@sanconnect.demo';
  SELECT id INTO v_meera FROM public.customers WHERE email = 'customer2@sanconnect.demo';
  SELECT id INTO v_vikram FROM public.customers WHERE email = 'customer3@sanconnect.demo';
  SELECT id INTO v_divya FROM public.customers WHERE email = 'customer4@sanconnect.demo';
  SELECT id INTO v_rahul FROM public.customers WHERE email = 'customer5@sanconnect.demo';
  SELECT id INTO v_sanjay FROM public.customers WHERE email = 'customer6@sanconnect.demo';

  IF v_arjun IS NOT NULL THEN
    INSERT INTO public.call_logs (customer_id, staff_id, direction, outcome, duration_minutes, notes, called_at) VALUES
      (v_arjun, v_sales1, 'outbound', 'connected', 6, 'Confirmed installment schedule, customer happy with progress.', now() - interval '9 days'),
      (v_arjun, v_sales1, 'outbound', 'voicemail', NULL, 'Left a message about the upcoming due date.', now() - interval '3 days');
  END IF;
  IF v_meera IS NOT NULL THEN
    INSERT INTO public.call_logs (customer_id, staff_id, direction, outcome, duration_minutes, notes, called_at) VALUES
      (v_meera, v_sales2, 'inbound', 'connected', 11, 'Asked about possession date and society handover timeline.', now() - interval '12 days');
  END IF;
  IF v_vikram IS NOT NULL THEN
    INSERT INTO public.call_logs (customer_id, staff_id, direction, outcome, duration_minutes, notes, called_at) VALUES
      (v_vikram, v_sales1, 'outbound', 'connected', 4, 'Scheduled a site visit for this weekend.', now() - interval '2 days'),
      (v_vikram, v_sales1, 'outbound', 'no_answer', NULL, NULL, now() - interval '6 days');
    UPDATE public.customers SET follow_up_at = now() + interval '2 days' WHERE id = v_vikram;
  END IF;
  IF v_divya IS NOT NULL THEN
    INSERT INTO public.call_logs (customer_id, staff_id, direction, outcome, duration_minutes, notes, called_at) VALUES
      (v_divya, v_sales2, 'outbound', 'connected', 8, 'Discussed the rejected KYC document — requested a clearer scan.', now() - interval '4 days');
    UPDATE public.customers
    SET stage_locked = true, stage_lock_reason = 'KYC document rejected — on hold until a valid ID proof is re-uploaded.'
    WHERE id = v_divya;
  END IF;
  IF v_rahul IS NOT NULL THEN
    UPDATE public.customers SET follow_up_at = now() + interval '5 days' WHERE id = v_rahul;
  END IF;
  IF v_sanjay IS NOT NULL THEN
    INSERT INTO public.call_logs (customer_id, staff_id, direction, outcome, duration_minutes, notes, called_at) VALUES
      (v_sanjay, v_sales2, 'outbound', 'busy', NULL, NULL, now() - interval '1 days');
    UPDATE public.customers SET follow_up_at = now() + interval '1 day' WHERE id = v_sanjay;
  END IF;
END $$;
