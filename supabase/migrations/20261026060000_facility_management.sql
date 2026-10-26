-- SAN Connect — Facility Management module (post-possession building/society
-- management: residents, assets with predictive health, maintenance tickets
-- and recurring bills). A separate module sharing auth + the sales customer
-- and property tables, but residents are NOT required to have come through
-- the sales pipeline — a complex can onboard residents independently.

-- ============================================================= ENUMS
CREATE TYPE public.resident_relation AS ENUM ('owner', 'tenant');
CREATE TYPE public.asset_category AS ENUM ('lift', 'generator', 'pump', 'fire_safety', 'security_system', 'other');
CREATE TYPE public.ticket_category AS ENUM ('plumbing', 'electrical', 'civil', 'security', 'housekeeping', 'other');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.bill_type AS ENUM ('monthly_maintenance', 'sinking_fund', 'special_assessment');

-- ============================================================= COMPLEXES
CREATE TABLE public.complexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  total_units INTEGER NOT NULL DEFAULT 0,
  amenities TEXT[] DEFAULT '{}',
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================= RESIDENTS
-- Not required to have a sales customer_id/property_id — a complex can
-- onboard residents who never bought through this platform's sales flow.
CREATE TABLE public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  relation public.resident_relation NOT NULL DEFAULT 'owner',
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  move_in_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (complex_id, unit_number)
);
CREATE INDEX residents_complex_idx ON public.residents(complex_id);
CREATE INDEX residents_customer_idx ON public.residents(customer_id);

-- ============================================================= ASSETS (predictive health computed client-side from these fields)
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category public.asset_category NOT NULL,
  install_date DATE NOT NULL,
  expected_life_years NUMERIC(5, 1) NOT NULL,
  service_interval_months INTEGER NOT NULL,
  last_service_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX assets_complex_idx ON public.assets(complex_id);

-- ============================================================= MAINTENANCE TICKETS
CREATE TABLE public.maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  category public.ticket_category NOT NULL,
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  status public.ticket_status NOT NULL DEFAULT 'open',
  assigned_vendor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX maintenance_tickets_complex_idx ON public.maintenance_tickets(complex_id);
CREATE INDEX maintenance_tickets_customer_idx ON public.maintenance_tickets(customer_id);

-- ============================================================= MAINTENANCE BILLS
CREATE TABLE public.maintenance_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  bill_type public.bill_type NOT NULL DEFAULT 'monthly_maintenance',
  period DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status public.payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX maintenance_bills_complex_idx ON public.maintenance_bills(complex_id);
CREATE INDEX maintenance_bills_customer_idx ON public.maintenance_bills(customer_id);

-- ============================================================= RLS
ALTER TABLE public.complexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_bills ENABLE ROW LEVEL SECURITY;

-- Complexes: any signed-in resident or staff member can read (needed to show
-- "my society" info); only staff can manage.
CREATE POLICY "complexes read" ON public.complexes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "complexes staff write" ON public.complexes FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "complexes staff update" ON public.complexes FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "complexes admin delete" ON public.complexes FOR DELETE USING (public.is_admin());

-- Residents: staff see all; a resident can see their own row if linked to
-- their own customer_id.
CREATE POLICY "residents read" ON public.residents FOR SELECT USING (
  public.is_staff() OR (customer_id IS NOT NULL AND public.owns_customer(customer_id))
);
CREATE POLICY "residents staff write" ON public.residents FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "residents staff update" ON public.residents FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "residents staff delete" ON public.residents FOR DELETE USING (public.is_admin());

-- Assets: internal only (predictive health is a facility-manager concern).
CREATE POLICY "assets staff read" ON public.assets FOR SELECT USING (public.is_staff());
CREATE POLICY "assets staff insert" ON public.assets FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "assets staff update" ON public.assets FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "assets admin delete" ON public.assets FOR DELETE USING (public.is_admin());

-- Tickets: a resident sees/raises their own; staff see and manage all.
CREATE POLICY "tickets read" ON public.maintenance_tickets FOR SELECT USING (
  public.is_staff() OR (customer_id IS NOT NULL AND public.owns_customer(customer_id))
);
CREATE POLICY "tickets resident insert" ON public.maintenance_tickets FOR INSERT WITH CHECK (
  public.is_staff() OR (customer_id IS NOT NULL AND public.owns_customer(customer_id))
);
CREATE POLICY "tickets staff update" ON public.maintenance_tickets FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "tickets admin delete" ON public.maintenance_tickets FOR DELETE USING (public.is_admin());

-- Bills: a resident sees (and can mark paid) their own; staff see and manage all.
CREATE POLICY "bills read" ON public.maintenance_bills FOR SELECT USING (
  public.is_staff() OR (customer_id IS NOT NULL AND public.owns_customer(customer_id))
);
CREATE POLICY "bills resident update" ON public.maintenance_bills FOR UPDATE USING (
  public.is_staff() OR (customer_id IS NOT NULL AND public.owns_customer(customer_id))
) WITH CHECK (
  public.is_staff() OR (customer_id IS NOT NULL AND public.owns_customer(customer_id))
);
CREATE POLICY "bills staff insert" ON public.maintenance_bills FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "bills admin delete" ON public.maintenance_bills FOR DELETE USING (public.is_admin());

-- ============================================================= SEED: Sanview Heights graduates into FM
DO $$
DECLARE
  v_proj_heights UUID;
  v_complex UUID;
  v_cust_meera UUID;
  v_prop_meera UUID;
  v_resident_meera UUID;
  v_resident_a204 UUID;
  v_resident_b502 UUID;
  v_lift UUID;
  v_genset UUID;
BEGIN
  SELECT id INTO v_proj_heights FROM public.projects WHERE name = 'Sanview Heights' LIMIT 1;
  IF v_proj_heights IS NULL THEN RETURN; END IF;

  INSERT INTO public.complexes (project_id, name, address, total_units, amenities)
  VALUES (v_proj_heights, 'Sanview Heights Owners'' Association', 'Whitefield, Bengaluru', 60,
    ARRAY['Clubhouse', 'Swimming Pool', 'Gym', 'Children Play Area', '24x7 Security'])
  RETURNING id INTO v_complex;

  SELECT c.id, p.id INTO v_cust_meera, v_prop_meera
  FROM public.customers c
  JOIN public.properties p ON p.customer_id = c.id AND p.code = 'SVH-A-302'
  WHERE c.name = 'Meera Pillai'
  LIMIT 1;

  INSERT INTO public.residents (complex_id, unit_number, name, email, phone, relation, customer_id, property_id, move_in_date)
  VALUES (v_complex, 'A-302', 'Meera Pillai', 'customer2@sanconnect.demo', '9998800002', 'owner', v_cust_meera, v_prop_meera, current_date - interval '10 months')
  RETURNING id INTO v_resident_meera;

  INSERT INTO public.residents (complex_id, unit_number, name, relation, move_in_date)
  VALUES (v_complex, 'A-204', 'Rohan Desai', 'owner', current_date - interval '2 years')
  RETURNING id INTO v_resident_a204;

  INSERT INTO public.residents (complex_id, unit_number, name, relation, move_in_date)
  VALUES (v_complex, 'B-502', 'Fatima Sheikh', 'tenant', current_date - interval '5 months')
  RETURNING id INTO v_resident_b502;

  -- Assets spanning a healthy, a watch, and a critical predictive-health reading.
  INSERT INTO public.assets (complex_id, name, category, install_date, expected_life_years, service_interval_months, last_service_date)
  VALUES
    (v_complex, 'Tower A Passenger Lift', 'lift', current_date - interval '2 years', 20, 3, current_date - interval '1 month')
    RETURNING id INTO v_lift;
  INSERT INTO public.assets (complex_id, name, category, install_date, expected_life_years, service_interval_months, last_service_date)
  VALUES
    (v_complex, 'Tower B Passenger Lift', 'lift', current_date - interval '9 years', 20, 3, current_date - interval '5 months'),
    (v_complex, 'DG Set 125kVA', 'generator', current_date - interval '7 years', 15, 6, current_date - interval '2 months'),
    (v_complex, 'Domestic Water Pump', 'pump', current_date - interval '11 years', 12, 2, current_date - interval '9 months'),
    (v_complex, 'Fire Hydrant System', 'fire_safety', current_date - interval '4 years', 15, 6, current_date - interval '1 month'),
    (v_complex, 'CCTV & Access Control', 'security_system', current_date - interval '3 years', 8, 4, current_date - interval '2 months');

  SELECT id INTO v_genset FROM public.assets WHERE complex_id = v_complex AND name = 'DG Set 125kVA';

  -- Tickets
  INSERT INTO public.maintenance_tickets (complex_id, resident_id, customer_id, category, priority, title, description, status, assigned_vendor, resolved_at)
  VALUES
    (v_complex, v_resident_meera, v_cust_meera, 'plumbing', 'medium', 'Kitchen tap leaking', 'Slow drip from the kitchen mixer tap, worsening over the week.', 'open', NULL, NULL),
    (v_complex, v_resident_a204, NULL, 'electrical', 'high', 'Flickering lights in living room', 'Lights flicker intermittently, suspect loose wiring.', 'in_progress', 'BrightSpark Electricals', NULL),
    (v_complex, v_resident_b502, NULL, 'housekeeping', 'low', 'Corridor not cleaned', 'Common corridor on 5th floor missed for two days.', 'resolved', 'CleanPro Facility Services', now() - interval '3 days'),
    (v_complex, NULL, NULL, 'security', 'urgent', 'Main gate boom barrier stuck', 'Boom barrier at the main entrance is stuck in the down position.', 'open', NULL, NULL),
    (v_complex, v_resident_meera, v_cust_meera, 'civil', 'low', 'Hairline crack in balcony wall', 'Small cosmetic crack noticed after the last rains.', 'closed', 'Apex Civil Contractors', now() - interval '20 days');

  -- Bills: a few months per resident, one overdue to drive the collections demo.
  INSERT INTO public.maintenance_bills (complex_id, resident_id, customer_id, bill_type, period, amount, due_date, paid_date, status)
  VALUES
    (v_complex, v_resident_meera, v_cust_meera, 'monthly_maintenance', date_trunc('month', current_date), 4500, current_date + 5, NULL, 'pending'),
    (v_complex, v_resident_meera, v_cust_meera, 'monthly_maintenance', date_trunc('month', current_date - interval '1 month'), 4500, current_date - interval '25 days', current_date - interval '28 days', 'paid'),
    (v_complex, v_resident_meera, v_cust_meera, 'sinking_fund', date_trunc('month', current_date), 1200, current_date + 5, NULL, 'pending'),
    (v_complex, v_resident_a204, NULL, 'monthly_maintenance', date_trunc('month', current_date - interval '1 month'), 4500, current_date - interval '20 days', NULL, 'overdue'),
    (v_complex, v_resident_a204, NULL, 'monthly_maintenance', date_trunc('month', current_date), 4500, current_date + 5, NULL, 'pending'),
    (v_complex, v_resident_b502, NULL, 'monthly_maintenance', date_trunc('month', current_date), 5200, current_date + 5, NULL, 'pending'),
    (v_complex, v_resident_b502, NULL, 'special_assessment', date_trunc('month', current_date - interval '2 months'), 8000, current_date - interval '50 days', current_date - interval '45 days', 'paid');
END $$;
