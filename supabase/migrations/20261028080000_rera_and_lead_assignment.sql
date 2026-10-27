-- SAN Connect — RERA compliance disclosure on projects, and automatic
-- load-balanced assignment of new leads to sales staff.

-- ============================================================= RERA
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS rera_number TEXT,
  ADD COLUMN IF NOT EXISTS rera_registered_at DATE;

UPDATE public.projects SET rera_number = 'PRM/KA/RERA/1251/308/PR/180923/006259', rera_registered_at = '2023-09-18'
  WHERE name = 'Sanview Meadows';
UPDATE public.projects SET rera_number = 'PRM/KA/RERA/1251/309/PR/210224/006512', rera_registered_at = '2024-02-21'
  WHERE name = 'Sanview Heights';
UPDATE public.projects SET rera_number = 'PRM/KA/RERA/1251/310/PR/150524/006798', rera_registered_at = '2024-05-15'
  WHERE name = 'Sanview Residency';

-- ============================================================= AUTO-ASSIGN NEW LEADS
-- Picks the sales rep with the fewest currently-active (not yet sold) leads,
-- so new leads load-balance across the team instead of piling on one rep.
-- SECURITY DEFINER is required: a self-registering customer's own RLS on
-- `customers` only lets them see their own row, not the counts needed here.
CREATE OR REPLACE FUNCTION public.auto_assign_sales_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF NEW.assigned_sales_owner IS NULL THEN
    SELECT p.id INTO v_owner
    FROM public.profiles p
    LEFT JOIN public.customers c
      ON c.assigned_sales_owner = p.id AND c.lead_status <> 'sold'
    WHERE p.role = 'sales'
    GROUP BY p.id
    ORDER BY count(c.id) ASC, p.id
    LIMIT 1;
    NEW.assigned_sales_owner := v_owner;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_sales_owner ON public.customers;
CREATE TRIGGER trg_auto_assign_sales_owner
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_sales_owner();
