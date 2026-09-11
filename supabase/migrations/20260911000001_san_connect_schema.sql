-- SAN Connect — core schema: enums, tables, RLS, triggers, storage.
-- Replaces the previous (Nexus Command) domain tables entirely.

DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.extraction_jobs CASCADE;
DROP TABLE IF EXISTS public.load_destinations CASCADE;
DROP TABLE IF EXISTS public.transformation_policies CASCADE;
DROP TABLE IF EXISTS public.discovery_scans CASCADE;
DROP TABLE IF EXISTS public.data_sources CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ============================================================= ENUMS
CREATE TYPE public.user_role AS ENUM ('customer', 'sales', 'finance', 'legal', 'admin');
CREATE TYPE public.property_type AS ENUM ('plot', 'flat');
CREATE TYPE public.project_type_mix AS ENUM ('plots', 'flats', 'both');
CREATE TYPE public.property_status AS ENUM ('available', 'blocked', 'sold');
CREATE TYPE public.facing_direction AS ENUM ('east', 'west', 'north', 'south');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'site_visit', 'booked', 'sold');
CREATE TYPE public.payment_status AS ENUM ('paid', 'pending', 'overdue');
CREATE TYPE public.payment_mode AS ENUM ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'other');
CREATE TYPE public.document_type AS ENUM ('sale_agreement', 'title_deed', 'approval_certificate', 'id_proof', 'occupancy_certificate', 'kyc', 'other');
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE public.approval_stage AS ENUM ('booking', 'legal_verification', 'finance_clearance', 'registration', 'possession');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.site_visit_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE public.commission_status AS ENUM ('pending', 'paid');

-- ============================================================= PROFILES (staff + customer identity)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'customer',
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================= PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  layout_image_url TEXT,
  type_mix public.project_type_mix NOT NULL DEFAULT 'both',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================= CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  assigned_sales_owner UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_source TEXT,
  lead_status public.lead_status NOT NULL DEFAULT 'new',
  kyc_status public.verification_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================= PROPERTIES (shared Plot/Flat model)
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  property_type public.property_type NOT NULL,
  code TEXT NOT NULL,
  price NUMERIC(14, 2) NOT NULL,
  status public.property_status NOT NULL DEFAULT 'available',
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  cover_image_url TEXT,
  -- Plot-specific
  size_sqyd NUMERIC(10, 2),
  facing public.facing_direction,
  is_corner BOOLEAN,
  road_width_ft NUMERIC(6, 2),
  -- Flat-specific
  tower TEXT,
  floor_number INTEGER,
  bhk TEXT,
  carpet_area_sqft NUMERIC(10, 2),
  builtup_area_sqft NUMERIC(10, 2),
  parking_slots INTEGER DEFAULT 0,
  amenities TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, code)
);
CREATE INDEX properties_project_idx ON public.properties(project_id);
CREATE INDEX properties_customer_idx ON public.properties(customer_id);
CREATE INDEX properties_status_idx ON public.properties(status);
CREATE INDEX properties_type_idx ON public.properties(property_type);

-- ============================================================= INSTALLMENT PLANS + INSTALLMENTS
CREATE TABLE public.installment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  total_amount NUMERIC(14, 2) NOT NULL,
  num_installments INTEGER NOT NULL,
  start_date DATE NOT NULL DEFAULT current_date,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  penalty_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 2,
  penalty_grace_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.installment_plans(id) ON DELETE CASCADE,
  seq_no INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, seq_no)
);
CREATE INDEX installments_plan_idx ON public.installments(plan_id);

-- ============================================================= PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  installment_id UUID REFERENCES public.installments(id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL,
  due_date DATE,
  paid_date DATE,
  status public.payment_status NOT NULL DEFAULT 'pending',
  payment_mode public.payment_mode,
  receipt_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_customer_idx ON public.payments(customer_id);
CREATE INDEX payments_property_idx ON public.payments(property_id);

-- ============================================================= DOCUMENTS
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  doc_type public.document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_status public.verification_status NOT NULL DEFAULT 'pending',
  verifier_notes TEXT,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ
);
CREATE INDEX documents_customer_idx ON public.documents(customer_id);

-- ============================================================= APPROVALS
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  stage public.approval_stage NOT NULL,
  status public.approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, property_id, stage)
);
CREATE INDEX approvals_customer_idx ON public.approvals(customer_id);

-- ============================================================= SITE VISITS
CREATE TABLE public.site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  assigned_staff UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.site_visit_status NOT NULL DEFAULT 'scheduled',
  outcome_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX site_visits_customer_idx ON public.site_visits(customer_id);

-- ============================================================= NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_customer_idx ON public.notifications(customer_id);

-- ============================================================= LEAD NOTES (CRM)
CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lead_notes_customer_idx ON public.lead_notes(customer_id);

-- ============================================================= TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.task_status NOT NULL DEFAULT 'todo',
  due_date DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_assigned_idx ON public.tasks(assigned_to);

-- ============================================================= COMMISSIONS
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 1,
  amount NUMERIC(14, 2) NOT NULL,
  status public.commission_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX commissions_staff_idx ON public.commissions(sales_staff_id);

-- ============================================================= HELPER FUNCTIONS (security definer, avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_role() IN ('sales', 'finance', 'legal', 'admin') $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_role() = 'admin' $$;

CREATE OR REPLACE FUNCTION public.has_role(r public.user_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_role() = r $$;

CREATE OR REPLACE FUNCTION public.owns_customer(cust_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.customers WHERE id = cust_id AND user_id = auth.uid()) $$;

-- ============================================================= GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================================= RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- profiles: everyone can read (needed for name lookups/joins), self or admin can write
CREATE POLICY "profiles read all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles admin all" ON public.profiles FOR DELETE USING (public.is_admin());

-- projects: public read for browsing (even anon, for marketing pages); staff write
CREATE POLICY "projects public read" ON public.projects FOR SELECT USING (true);
CREATE POLICY "projects staff write" ON public.projects FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "projects staff update" ON public.projects FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "projects admin delete" ON public.projects FOR DELETE USING (public.is_admin());

-- properties: public read; staff write
CREATE POLICY "properties public read" ON public.properties FOR SELECT USING (true);
CREATE POLICY "properties staff insert" ON public.properties FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "properties staff update" ON public.properties FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "properties admin delete" ON public.properties FOR DELETE USING (public.is_admin());

-- customers: own row, or staff (read+update), admin (all incl insert/delete)
CREATE POLICY "customers own read" ON public.customers FOR SELECT USING (user_id = auth.uid() OR public.is_staff());
CREATE POLICY "customers own update" ON public.customers FOR UPDATE USING (user_id = auth.uid() OR public.is_staff()) WITH CHECK (user_id = auth.uid() OR public.is_staff());
CREATE POLICY "customers staff insert" ON public.customers FOR INSERT WITH CHECK (public.is_staff() OR user_id = auth.uid());
CREATE POLICY "customers admin delete" ON public.customers FOR DELETE USING (public.is_admin());

-- installment_plans / installments: own customer or finance/admin
CREATE POLICY "plans read" ON public.installment_plans FOR SELECT USING (public.owns_customer(customer_id) OR public.is_staff());
CREATE POLICY "plans write" ON public.installment_plans FOR INSERT WITH CHECK (public.has_role('finance') OR public.is_admin());
CREATE POLICY "plans update" ON public.installment_plans FOR UPDATE USING (public.has_role('finance') OR public.is_admin()) WITH CHECK (public.has_role('finance') OR public.is_admin());
CREATE POLICY "plans delete" ON public.installment_plans FOR DELETE USING (public.is_admin());

CREATE POLICY "installments read" ON public.installments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.installment_plans p WHERE p.id = plan_id AND (public.owns_customer(p.customer_id) OR public.is_staff()))
);
CREATE POLICY "installments write" ON public.installments FOR INSERT WITH CHECK (public.has_role('finance') OR public.is_admin());
CREATE POLICY "installments update" ON public.installments FOR UPDATE USING (public.has_role('finance') OR public.is_admin()) WITH CHECK (public.has_role('finance') OR public.is_admin());
CREATE POLICY "installments delete" ON public.installments FOR DELETE USING (public.is_admin());

-- payments: own or staff read; finance/admin write
CREATE POLICY "payments read" ON public.payments FOR SELECT USING (public.owns_customer(customer_id) OR public.is_staff());
CREATE POLICY "payments write" ON public.payments FOR INSERT WITH CHECK (public.has_role('finance') OR public.is_admin());
CREATE POLICY "payments update" ON public.payments FOR UPDATE USING (public.has_role('finance') OR public.is_admin()) WITH CHECK (public.has_role('finance') OR public.is_admin());
CREATE POLICY "payments delete" ON public.payments FOR DELETE USING (public.is_admin());

-- documents: own customer can read+upload; legal/admin verify; staff read all
CREATE POLICY "documents read" ON public.documents FOR SELECT USING (public.owns_customer(customer_id) OR public.is_staff());
CREATE POLICY "documents insert" ON public.documents FOR INSERT WITH CHECK (public.owns_customer(customer_id) OR public.is_staff());
CREATE POLICY "documents update" ON public.documents FOR UPDATE USING (public.has_role('legal') OR public.is_admin() OR public.owns_customer(customer_id)) WITH CHECK (public.has_role('legal') OR public.is_admin() OR public.owns_customer(customer_id));
CREATE POLICY "documents delete" ON public.documents FOR DELETE USING (public.is_admin() OR public.owns_customer(customer_id));

-- approvals: own read; stage-relevant staff (or admin) write
CREATE POLICY "approvals read" ON public.approvals FOR SELECT USING (public.owns_customer(customer_id) OR public.is_staff());
CREATE POLICY "approvals insert" ON public.approvals FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "approvals update" ON public.approvals FOR UPDATE USING (
  public.is_admin()
  OR (stage = 'booking' AND public.has_role('sales'))
  OR (stage = 'legal_verification' AND public.has_role('legal'))
  OR (stage = 'finance_clearance' AND public.has_role('finance'))
  OR (stage IN ('registration', 'possession') AND public.has_role('legal'))
) WITH CHECK (
  public.is_admin()
  OR (stage = 'booking' AND public.has_role('sales'))
  OR (stage = 'legal_verification' AND public.has_role('legal'))
  OR (stage = 'finance_clearance' AND public.has_role('finance'))
  OR (stage IN ('registration', 'possession') AND public.has_role('legal'))
);
CREATE POLICY "approvals delete" ON public.approvals FOR DELETE USING (public.is_admin());

-- site_visits: own read; sales/admin manage; other staff read
CREATE POLICY "site_visits read" ON public.site_visits FOR SELECT USING (public.owns_customer(customer_id) OR public.is_staff());
CREATE POLICY "site_visits insert" ON public.site_visits FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "site_visits update" ON public.site_visits FOR UPDATE USING (public.has_role('sales') OR public.is_admin()) WITH CHECK (public.has_role('sales') OR public.is_admin());
CREATE POLICY "site_visits delete" ON public.site_visits FOR DELETE USING (public.has_role('sales') OR public.is_admin());

-- notifications: own read/update; staff create
CREATE POLICY "notifications read" ON public.notifications FOR SELECT USING (public.owns_customer(customer_id) OR public.is_staff());
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "notifications update" ON public.notifications FOR UPDATE USING (public.owns_customer(customer_id) OR public.is_staff()) WITH CHECK (public.owns_customer(customer_id) OR public.is_staff());
CREATE POLICY "notifications delete" ON public.notifications FOR DELETE USING (public.is_admin());

-- lead_notes: internal CRM notes are staff-only to read/write, except a customer may log
-- their own portal actions (Express Interest / Book Now) as a system note (author_id null)
CREATE POLICY "lead_notes staff read" ON public.lead_notes FOR SELECT USING (public.is_staff());
CREATE POLICY "lead_notes staff insert" ON public.lead_notes FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "lead_notes customer self insert" ON public.lead_notes FOR INSERT WITH CHECK (author_id IS NULL AND public.owns_customer(customer_id));
CREATE POLICY "lead_notes staff delete" ON public.lead_notes FOR DELETE USING (public.is_admin());

-- tasks: staff only
CREATE POLICY "tasks staff read" ON public.tasks FOR SELECT USING (public.is_staff());
CREATE POLICY "tasks staff insert" ON public.tasks FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "tasks staff update" ON public.tasks FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "tasks staff delete" ON public.tasks FOR DELETE USING (public.is_admin());

-- commissions: sales staff sees own; admin sees/manages all
CREATE POLICY "commissions read" ON public.commissions FOR SELECT USING (sales_staff_id = auth.uid() OR public.is_admin());
CREATE POLICY "commissions insert" ON public.commissions FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "commissions update" ON public.commissions FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "commissions delete" ON public.commissions FOR DELETE USING (public.is_admin());

-- ============================================================= SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  signup_role public.user_role;
BEGIN
  signup_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'customer');

  INSERT INTO public.profiles (id, role, full_name, email, phone)
  VALUES (
    NEW.id, signup_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  IF signup_role = 'customer' THEN
    INSERT INTO public.customers (user_id, name, email, phone, referral_source)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      COALESCE(NEW.raw_user_meta_data->>'referral_source', 'Website signup')
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================= STORAGE
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true), ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "property images public read" ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
CREATE POLICY "property images staff write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-images' AND public.is_staff());
CREATE POLICY "property images staff update" ON storage.objects FOR UPDATE USING (bucket_id = 'property-images' AND public.is_staff());
CREATE POLICY "property images staff delete" ON storage.objects FOR DELETE USING (bucket_id = 'property-images' AND public.is_staff());

CREATE POLICY "documents owner read" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND (public.is_staff() OR (storage.foldername(name))[1] = auth.uid()::text)
);
CREATE POLICY "documents owner write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND (public.is_staff() OR (storage.foldername(name))[1] = auth.uid()::text)
);
CREATE POLICY "documents owner delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'documents' AND (public.is_staff() OR (storage.foldername(name))[1] = auth.uid()::text)
);
