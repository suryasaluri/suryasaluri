-- SAN Connect — WhatsApp opt-in, bank loan applications, and plot/flat geo location.

-- ============================================================= WHATSAPP OPT-IN
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false;

-- ============================================================= GEO LOCATION
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

-- Backfill existing seed properties with a realistic point near their
-- project's locality, nudged slightly per property so pins don't overlap.
WITH base AS (
  SELECT p.id AS project_id,
    CASE p.location
      WHEN 'Devanahalli, Bengaluru' THEN 13.2437
      WHEN 'Whitefield, Bengaluru' THEN 12.9698
      WHEN 'Sarjapur Road, Bengaluru' THEN 12.9010
      ELSE 12.9716
    END AS base_lat,
    CASE p.location
      WHEN 'Devanahalli, Bengaluru' THEN 77.7175
      WHEN 'Whitefield, Bengaluru' THEN 77.7500
      WHEN 'Sarjapur Road, Bengaluru' THEN 77.6870
      ELSE 77.5946
    END AS base_lng
  FROM public.projects p
),
ranked AS (
  SELECT pr.id, b.base_lat, b.base_lng,
    row_number() OVER (PARTITION BY pr.project_id ORDER BY pr.code) AS rn
  FROM public.properties pr
  JOIN base b ON b.project_id = pr.project_id
)
UPDATE public.properties pr
SET
  latitude = ranked.base_lat + (ranked.rn * 0.0014),
  longitude = ranked.base_lng + (ranked.rn * 0.0011)
FROM ranked
WHERE pr.id = ranked.id
  AND pr.latitude IS NULL;

-- ============================================================= BANK LOAN APPLICATIONS
CREATE TYPE public.loan_status AS ENUM ('submitted', 'under_review', 'approved', 'rejected');

CREATE TABLE public.loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  requested_amount NUMERIC(14, 2) NOT NULL,
  status public.loan_status NOT NULL DEFAULT 'submitted',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX loan_applications_customer_idx ON public.loan_applications(customer_id);

ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loan applications read" ON public.loan_applications
  FOR SELECT USING (public.owns_customer(customer_id) OR public.is_staff());
CREATE POLICY "loan applications insert" ON public.loan_applications
  FOR INSERT WITH CHECK (public.owns_customer(customer_id) OR public.is_staff());
CREATE POLICY "loan applications update" ON public.loan_applications
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "loan applications delete" ON public.loan_applications
  FOR DELETE USING (public.is_admin());
