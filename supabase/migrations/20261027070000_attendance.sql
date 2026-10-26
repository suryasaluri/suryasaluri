-- SAN Connect — team attendance: staff self-check-in/out, admin audit and a
-- payroll-ready monthly export.

CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'half_day', 'leave', 'holiday');

CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT current_date,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, date)
);
CREATE INDEX attendance_records_profile_idx ON public.attendance_records(profile_id);
CREATE INDEX attendance_records_date_idx ON public.attendance_records(date);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance self/admin read" ON public.attendance_records
  FOR SELECT USING ((profile_id = auth.uid() AND public.is_staff()) OR public.is_admin());
CREATE POLICY "attendance self/admin insert" ON public.attendance_records
  FOR INSERT WITH CHECK ((profile_id = auth.uid() AND public.is_staff()) OR public.is_admin());
CREATE POLICY "attendance self/admin update" ON public.attendance_records
  FOR UPDATE USING ((profile_id = auth.uid() AND public.is_staff()) OR public.is_admin())
  WITH CHECK ((profile_id = auth.uid() AND public.is_staff()) OR public.is_admin());
CREATE POLICY "attendance admin delete" ON public.attendance_records
  FOR DELETE USING (public.is_admin());

-- ============================================================= SEED: ~3 weeks of history for the demo staff accounts
DO $$
DECLARE
  v_profile RECORD;
  v_day DATE;
  v_roll INTEGER;
BEGIN
  FOR v_profile IN
    SELECT id FROM public.profiles
    WHERE email IN ('admin@sanconnect.demo', 'sales1@sanconnect.demo', 'sales2@sanconnect.demo', 'finance@sanconnect.demo', 'legal@sanconnect.demo')
  LOOP
    v_day := current_date - interval '21 days';
    WHILE v_day < current_date LOOP
      -- Skip weekends.
      IF EXTRACT(ISODOW FROM v_day) < 6 THEN
        v_roll := (abs(hashtext(v_profile.id::text || v_day::text)) % 20);
        INSERT INTO public.attendance_records (profile_id, date, check_in, check_out, status)
        VALUES (
          v_profile.id,
          v_day,
          CASE WHEN v_roll < 17 THEN v_day + time '09:00' + (make_interval(mins => (abs(hashtext(v_profile.id::text || v_day::text || 'in')) % 40))) ELSE NULL END,
          CASE WHEN v_roll < 15 THEN v_day + time '18:00' + (make_interval(mins => (abs(hashtext(v_profile.id::text || v_day::text || 'out')) % 45))) ELSE NULL END,
          CASE
            WHEN v_roll < 15 THEN 'present'
            WHEN v_roll < 17 THEN 'half_day'
            WHEN v_roll < 19 THEN 'leave'
            ELSE 'absent'
          END::public.attendance_status
        )
        ON CONFLICT (profile_id, date) DO NOTHING;
      END IF;
      v_day := v_day + 1;
    END LOOP;
  END LOOP;
END $$;
