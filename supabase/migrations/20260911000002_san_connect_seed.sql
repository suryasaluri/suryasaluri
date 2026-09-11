-- SAN Connect — demo seed data.
-- 3 projects, 15 plots + 10 flats, 6 customers spanning the full lead → sold
-- lifecycle, with payments, installment schedules, documents and approvals
-- that tell a visible story across different customers.
--
-- Demo login password for every seeded account: SanConnect@123

-- helper to create a confirmed auth user + matching identity, return its id (dropped at the end of this file)
CREATE OR REPLACE FUNCTION public._seed_new_user(p_email TEXT, p_full_name TEXT, p_role TEXT, p_phone TEXT) RETURNS UUID
LANGUAGE plpgsql AS $fn$
DECLARE
  v_instance UUID := '00000000-0000-0000-0000-000000000000';
  v_id UUID;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user
  ) VALUES (
    v_instance, gen_random_uuid(), 'authenticated', 'authenticated', p_email,
    crypt('SanConnect@123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'role', p_role, 'phone', p_phone, 'referral_source', 'Website signup'),
    now(), now(), '', '', '', '', false
  ) RETURNING id INTO v_id;

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_id, jsonb_build_object('sub', v_id::text, 'email', p_email), 'email', v_id::text, now(), now(), now());

  RETURN v_id;
END;
$fn$;

DO $$
DECLARE
  v_admin UUID; v_sales1 UUID; v_sales2 UUID; v_finance UUID; v_legal UUID;
  v_u_arjun UUID; v_u_meera UUID; v_u_divya UUID; v_u_vikram UUID; v_u_rahul UUID; v_u_sanjay UUID;

  v_proj1 UUID; v_proj2 UUID; v_proj3 UUID;

  v_prop_arjun UUID; v_prop_meera_flat UUID; v_prop_meera_plot UUID; v_prop_divya UUID;

  v_cust_arjun UUID; v_cust_meera UUID; v_cust_divya UUID; v_cust_vikram UUID; v_cust_rahul UUID; v_cust_sanjay UUID;

  v_plan_arjun UUID; v_plan_divya UUID; v_plan_meera UUID;
BEGIN
  -- ===================================================== STAFF USERS
  v_admin   := public._seed_new_user('admin@sanconnect.demo',   'Priya Sharma',  'admin',   '9876500001');
  v_sales1  := public._seed_new_user('sales1@sanconnect.demo',  'Rohan Mehta',   'sales',   '9876500002');
  v_sales2  := public._seed_new_user('sales2@sanconnect.demo',  'Ananya Verma',  'sales',   '9876500003');
  v_finance := public._seed_new_user('finance@sanconnect.demo', 'Karthik Iyer',  'finance', '9876500004');
  v_legal   := public._seed_new_user('legal@sanconnect.demo',   'Sneha Reddy',   'legal',   '9876500005');

  -- ===================================================== CUSTOMER USERS (trigger auto-creates customers rows)
  v_u_arjun  := public._seed_new_user('customer1@sanconnect.demo', 'Arjun Nair',      'customer', '9998800001');
  v_u_meera  := public._seed_new_user('customer2@sanconnect.demo', 'Meera Pillai',    'customer', '9998800002');
  v_u_vikram := public._seed_new_user('customer3@sanconnect.demo', 'Vikram Rao',      'customer', '9998800003');
  v_u_divya  := public._seed_new_user('customer4@sanconnect.demo', 'Divya Krishnan',  'customer', '9998800004');
  v_u_rahul  := public._seed_new_user('customer5@sanconnect.demo', 'Rahul Bhatt',     'customer', '9998800005');
  v_u_sanjay := public._seed_new_user('customer6@sanconnect.demo', 'Sanjay Gupta',    'customer', '9998800006');

  SELECT id INTO v_cust_arjun  FROM public.customers WHERE user_id = v_u_arjun;
  SELECT id INTO v_cust_meera  FROM public.customers WHERE user_id = v_u_meera;
  SELECT id INTO v_cust_vikram FROM public.customers WHERE user_id = v_u_vikram;
  SELECT id INTO v_cust_divya  FROM public.customers WHERE user_id = v_u_divya;
  SELECT id INTO v_cust_rahul  FROM public.customers WHERE user_id = v_u_rahul;
  SELECT id INTO v_cust_sanjay FROM public.customers WHERE user_id = v_u_sanjay;

  UPDATE public.customers SET assigned_sales_owner = v_sales1, lead_status = 'booked', kyc_status = 'verified', referral_source = 'Newspaper Ad' WHERE id = v_cust_arjun;
  UPDATE public.customers SET assigned_sales_owner = v_sales2, lead_status = 'sold', kyc_status = 'verified', referral_source = 'Referral — existing customer' WHERE id = v_cust_meera;
  UPDATE public.customers SET assigned_sales_owner = v_sales1, lead_status = 'site_visit', kyc_status = 'pending', referral_source = 'Instagram Ad' WHERE id = v_cust_vikram;
  UPDATE public.customers SET assigned_sales_owner = v_sales2, lead_status = 'booked', kyc_status = 'pending', referral_source = 'Google Search' WHERE id = v_cust_divya;
  UPDATE public.customers SET assigned_sales_owner = v_sales2, lead_status = 'new', kyc_status = 'pending', referral_source = 'Facebook Ads' WHERE id = v_cust_rahul;
  UPDATE public.customers SET assigned_sales_owner = v_sales1, lead_status = 'contacted', kyc_status = 'pending', referral_source = 'Walk-in' WHERE id = v_cust_sanjay;

  -- ===================================================== PROJECTS
  INSERT INTO public.projects (id, name, location, description, cover_image_url, type_mix)
  VALUES (gen_random_uuid(), 'Sanview Meadows', 'Devanahalli, Bengaluru',
    'Gated plotted development close to the airport corridor with wide roads, avenue plantation and a landscaped clubhouse zone. DTCP approved layout.',
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=60', 'plots')
  RETURNING id INTO v_proj1;

  INSERT INTO public.projects (id, name, location, description, cover_image_url, type_mix)
  VALUES (gen_random_uuid(), 'Sanview Heights', 'Whitefield, Bengaluru',
    'High-rise premium apartments with full amenity deck — clubhouse, pool, gym and 24x7 security, walking distance to the tech corridor.',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=60', 'flats')
  RETURNING id INTO v_proj2;

  INSERT INTO public.projects (id, name, location, description, cover_image_url, type_mix)
  VALUES (gen_random_uuid(), 'Sanview Residency', 'Sarjapur Road, Bengaluru',
    'A mixed-use township offering both independent plots and mid-rise apartments around a shared central park and retail street.',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=60', 'both')
  RETURNING id INTO v_proj3;

  -- ===================================================== PROPERTIES — Sanview Meadows (9 plots)
  INSERT INTO public.properties (project_id, property_type, code, price, status, cover_image_url, size_sqyd, facing, is_corner, road_width_ft)
  VALUES
    (v_proj1, 'plot', 'SVM-P-001', 2450000, 'available', 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=60', 1200, 'east',  false, 30),
    (v_proj1, 'plot', 'SVM-P-002', 2850000, 'available', 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=60', 1400, 'north', true,  40),
    (v_proj1, 'plot', 'SVM-P-003', 2200000, 'available', 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?auto=format&fit=crop&w=800&q=60', 1100, 'west',  false, 30),
    (v_proj1, 'plot', 'SVM-P-005', 3600000, 'available', 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=60', 1800, 'south', false, 40),
    (v_proj1, 'plot', 'SVM-P-006', 4200000, 'blocked',   'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?auto=format&fit=crop&w=800&q=60', 2100, 'east',  true,  60),
    (v_proj1, 'plot', 'SVM-P-008', 2650000, 'available', 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=60', 1300, 'north', false, 30),
    (v_proj1, 'plot', 'SVM-P-009', 3050000, 'available', 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?auto=format&fit=crop&w=800&q=60', 1550, 'east',  false, 40);

  INSERT INTO public.properties (project_id, property_type, code, price, status, cover_image_url, size_sqyd, facing, is_corner, road_width_ft, customer_id)
  VALUES (v_proj1, 'plot', 'SVM-P-004', 3200000, 'blocked', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=60', 1600, 'east', true, 40, v_cust_arjun)
  RETURNING id INTO v_prop_arjun;

  INSERT INTO public.properties (project_id, property_type, code, price, status, cover_image_url, size_sqyd, facing, is_corner, road_width_ft, customer_id)
  VALUES (v_proj1, 'plot', 'SVM-P-007', 2900000, 'sold', 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=60', 1450, 'north', false, 30, v_cust_meera)
  RETURNING id INTO v_prop_meera_plot;

  -- ===================================================== PROPERTIES — Sanview Heights (7 flats)
  INSERT INTO public.properties (project_id, property_type, code, price, status, cover_image_url, tower, floor_number, bhk, carpet_area_sqft, builtup_area_sqft, parking_slots, amenities)
  VALUES
    (v_proj2, 'flat', 'SVH-A-101', 4200000, 'available', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=60', 'Tower A', 1, '2BHK', 950, 1180, 1, ARRAY['Clubhouse','Swimming Pool','Gym','24x7 Security']),
    (v_proj2, 'flat', 'SVH-A-204', 5100000, 'available', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=60', 'Tower A', 2, '3BHK', 1180, 1420, 2, ARRAY['Clubhouse','Swimming Pool','Gym','Children Play Area','24x7 Security']),
    (v_proj2, 'flat', 'SVH-A-307', 5350000, 'blocked',   'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=60', 'Tower A', 3, '3BHK', 1200, 1450, 2, ARRAY['Clubhouse','Swimming Pool','Gym','24x7 Security']),
    (v_proj2, 'flat', 'SVH-B-502', 6100000, 'available', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=60', 'Tower B', 5, '3BHK', 1350, 1600, 2, ARRAY['Clubhouse','Swimming Pool','Gym','Children Play Area','24x7 Security','Jogging Track']),
    (v_proj2, 'flat', 'SVH-B-608', 7200000, 'available', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=60', 'Tower B', 6, '4BHK', 1650, 1980, 2, ARRAY['Clubhouse','Swimming Pool','Gym','Children Play Area','24x7 Security','Jogging Track']),
    (v_proj2, 'flat', 'SVH-B-901', 4900000, 'available', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=60', 'Tower B', 9, '2BHK', 1020, 1250, 1, ARRAY['Clubhouse','Swimming Pool','Gym','24x7 Security']);

  INSERT INTO public.properties (project_id, property_type, code, price, status, cover_image_url, tower, floor_number, bhk, carpet_area_sqft, builtup_area_sqft, parking_slots, amenities, customer_id)
  VALUES (v_proj2, 'flat', 'SVH-A-302', 6800000, 'sold', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=60', 'Tower A', 3, '3BHK', 1280, 1540, 2, ARRAY['Clubhouse','Swimming Pool','Gym','Children Play Area','24x7 Security'], v_cust_meera)
  RETURNING id INTO v_prop_meera_flat;

  -- ===================================================== PROPERTIES — Sanview Residency (6 plots + 3 flats)
  INSERT INTO public.properties (project_id, property_type, code, price, status, cover_image_url, size_sqyd, facing, is_corner, road_width_ft)
  VALUES
    (v_proj3, 'plot', 'SVR-P-001', 2750000, 'available', 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?auto=format&fit=crop&w=800&q=60', 1350, 'south', false, 30),
    (v_proj3, 'plot', 'SVR-P-002', 3400000, 'available', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=60', 1700, 'east',  true,  40),
    (v_proj3, 'plot', 'SVR-P-003', 2500000, 'sold',      'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=60', 1250, 'west',  false, 30),
    (v_proj3, 'plot', 'SVR-P-004', 3900000, 'available', 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?auto=format&fit=crop&w=800&q=60', 1950, 'north', false, 40),
    (v_proj3, 'plot', 'SVR-P-005', 2950000, 'available', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=60', 1500, 'east',  false, 30),
    (v_proj3, 'plot', 'SVR-P-006', 4500000, 'available', 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=60', 2250, 'south', true,  60);

  INSERT INTO public.properties (project_id, property_type, code, price, status, cover_image_url, tower, floor_number, bhk, carpet_area_sqft, builtup_area_sqft, parking_slots, amenities)
  VALUES
    (v_proj3, 'flat', 'SVR-F-101', 4600000, 'available', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=60', 'Tower 1', 1, '2BHK', 1000, 1220, 1, ARRAY['Central Park View','Gym','24x7 Security']),
    (v_proj3, 'flat', 'SVR-F-103', 5800000, 'available', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=60', 'Tower 1', 3, '3BHK', 1300, 1560, 2, ARRAY['Central Park View','Gym','Swimming Pool','24x7 Security']);

  INSERT INTO public.properties (project_id, property_type, code, price, status, cover_image_url, tower, floor_number, bhk, carpet_area_sqft, builtup_area_sqft, parking_slots, amenities, customer_id)
  VALUES (v_proj3, 'flat', 'SVR-F-105', 5400000, 'blocked', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=60', 'Tower 1', 5, '3BHK', 1220, 1470, 2, ARRAY['Central Park View','Gym','Swimming Pool','24x7 Security'], v_cust_divya)
  RETURNING id INTO v_prop_divya;

  -- ===================================================== INSTALLMENT PLANS + INSTALLMENTS
  -- Arjun: booked 5 months ago, 8 monthly installments, one currently overdue
  INSERT INTO public.installment_plans (id, property_id, customer_id, total_amount, num_installments, start_date, frequency, penalty_rate_percent, penalty_grace_days)
  VALUES (gen_random_uuid(), v_prop_arjun, v_cust_arjun, 3200000, 8, (current_date - interval '5 months')::date, 'monthly', 2, 7)
  RETURNING id INTO v_plan_arjun;

  INSERT INTO public.installments (plan_id, seq_no, due_date, amount, status)
  SELECT v_plan_arjun, gs, ((current_date - interval '5 months') + ((gs - 1) * interval '1 month'))::date, 400000,
    (CASE WHEN gs <= 4 THEN 'paid' WHEN gs = 5 THEN 'overdue' ELSE 'pending' END)::public.payment_status
  FROM generate_series(1, 8) gs;

  -- Divya: booked 3 months ago, 12 monthly installments, currently overdue on installment 3
  INSERT INTO public.installment_plans (id, property_id, customer_id, total_amount, num_installments, start_date, frequency, penalty_rate_percent, penalty_grace_days)
  VALUES (gen_random_uuid(), v_prop_divya, v_cust_divya, 5400000, 12, (current_date - interval '3 months')::date, 'monthly', 2.5, 5)
  RETURNING id INTO v_plan_divya;

  INSERT INTO public.installments (plan_id, seq_no, due_date, amount, status)
  SELECT v_plan_divya, gs, ((current_date - interval '3 months') + ((gs - 1) * interval '1 month'))::date, 450000,
    (CASE WHEN gs <= 2 THEN 'paid' WHEN gs = 3 THEN 'overdue' ELSE 'pending' END)::public.payment_status
  FROM generate_series(1, 12) gs;

  -- Meera's flat: fully paid off, 10 monthly installments all settled
  INSERT INTO public.installment_plans (id, property_id, customer_id, total_amount, num_installments, start_date, frequency, penalty_rate_percent, penalty_grace_days)
  VALUES (gen_random_uuid(), v_prop_meera_flat, v_cust_meera, 6800000, 10, (current_date - interval '11 months')::date, 'monthly', 2, 7)
  RETURNING id INTO v_plan_meera;

  INSERT INTO public.installments (plan_id, seq_no, due_date, amount, status)
  SELECT v_plan_meera, gs, ((current_date - interval '11 months') + ((gs - 1) * interval '1 month'))::date, 680000, 'paid'::public.payment_status
  FROM generate_series(1, 10) gs;

  -- ===================================================== PAYMENTS (mirrors each installment)
  INSERT INTO public.payments (customer_id, property_id, installment_id, amount, due_date, paid_date, status, payment_mode, receipt_reference, created_by)
  SELECT v_cust_arjun, v_prop_arjun, i.id, i.amount, i.due_date,
    CASE WHEN i.status = 'paid' THEN (i.due_date - 2) ELSE NULL END,
    i.status,
    CASE WHEN i.status = 'paid' THEN 'bank_transfer'::public.payment_mode ELSE NULL END,
    CASE WHEN i.status = 'paid' THEN 'RCPT-ARJ-' || i.seq_no::text ELSE NULL END,
    v_finance
  FROM public.installments i WHERE i.plan_id = v_plan_arjun;

  INSERT INTO public.payments (customer_id, property_id, installment_id, amount, due_date, paid_date, status, payment_mode, receipt_reference, created_by)
  SELECT v_cust_divya, v_prop_divya, i.id, i.amount, i.due_date,
    CASE WHEN i.status = 'paid' THEN (i.due_date - 1) ELSE NULL END,
    i.status,
    CASE WHEN i.status = 'paid' THEN 'upi'::public.payment_mode ELSE NULL END,
    CASE WHEN i.status = 'paid' THEN 'RCPT-DIV-' || i.seq_no::text ELSE NULL END,
    v_finance
  FROM public.installments i WHERE i.plan_id = v_plan_divya;

  INSERT INTO public.payments (customer_id, property_id, installment_id, amount, due_date, paid_date, status, payment_mode, receipt_reference, created_by)
  SELECT v_cust_meera, v_prop_meera_flat, i.id, i.amount, i.due_date, (i.due_date - 3), 'paid'::public.payment_status, 'cheque'::public.payment_mode, 'RCPT-MEE-F-' || i.seq_no::text, v_finance
  FROM public.installments i WHERE i.plan_id = v_plan_meera;

  -- Meera's plot: paid in full as a single lump-sum payment (no installment plan)
  INSERT INTO public.payments (customer_id, property_id, amount, due_date, paid_date, status, payment_mode, receipt_reference, created_by)
  VALUES (v_cust_meera, v_prop_meera_plot, 2900000, (current_date - interval '7 months')::date, (current_date - interval '7 months')::date, 'paid', 'bank_transfer', 'RCPT-MEE-P-001', v_finance);

  -- ===================================================== DOCUMENTS
  INSERT INTO public.documents (customer_id, property_id, doc_type, file_name, file_url, uploaded_by, verification_status, verifier_notes, verified_by, verified_at)
  VALUES
    (v_cust_arjun, v_prop_arjun, 'id_proof',       'arjun-aadhaar.pdf',        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', v_u_arjun, 'verified', 'Matches KYC records.', v_legal, now() - interval '4 months'),
    (v_cust_arjun, v_prop_arjun, 'sale_agreement', 'arjun-sale-agreement.pdf', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', v_sales1,  'verified', 'Signed and countersigned.', v_legal, now() - interval '4 months'),
    (v_cust_arjun, v_prop_arjun, 'title_deed',     'arjun-title-deed.pdf',     'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', v_legal,   'pending',  NULL, NULL, NULL),

    (v_cust_meera, v_prop_meera_flat, 'id_proof',              'meera-pan.pdf',              'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', v_u_meera, 'verified', 'Verified against PAN database.', v_legal, now() - interval '10 months'),
    (v_cust_meera, v_prop_meera_flat, 'sale_agreement',        'meera-sale-agreement.pdf',   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', v_sales2,  'verified', 'Registered copy on file.', v_legal, now() - interval '9 months'),
    (v_cust_meera, v_prop_meera_flat, 'occupancy_certificate', 'meera-occupancy-cert.pdf',   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', v_legal,   'verified', 'OC issued by BBMP.', v_legal, now() - interval '1 month'),
    (v_cust_meera, v_prop_meera_plot, 'title_deed',            'meera-plot-title-deed.pdf',  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', v_legal,   'verified', 'Clear title confirmed.', v_legal, now() - interval '6 months'),

    (v_cust_divya, v_prop_divya, 'id_proof',       'divya-passport.pdf',        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', v_u_divya, 'verified', 'Passport copy clear.', v_legal, now() - interval '2 months'),
    (v_cust_divya, v_prop_divya, 'sale_agreement', 'divya-sale-agreement.pdf',  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', v_u_divya, 'rejected', 'Signature mismatch versus ID proof — please re-upload a signed copy.', v_legal, now() - interval '3 weeks'),
    (v_cust_divya, v_prop_divya, 'sale_agreement', 'divya-sale-agreement-v2.pdf','https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', v_u_divya, 'pending', NULL, NULL, NULL);

  -- ===================================================== APPROVALS (multi-stage board)
  INSERT INTO public.approvals (customer_id, property_id, stage, status, approved_by, approved_at, comments) VALUES
    (v_cust_arjun, v_prop_arjun, 'booking',            'approved', v_sales1, now() - interval '5 months', 'Booking confirmed, token received.'),
    (v_cust_arjun, v_prop_arjun, 'legal_verification', 'approved', v_legal,  now() - interval '4 months', 'Title verified clean.'),
    (v_cust_arjun, v_prop_arjun, 'finance_clearance',  'pending',  NULL,     NULL, 'Awaiting installment 5 (overdue) before clearance.'),
    (v_cust_arjun, v_prop_arjun, 'registration',       'pending',  NULL,     NULL, NULL),
    (v_cust_arjun, v_prop_arjun, 'possession',         'pending',  NULL,     NULL, NULL),

    (v_cust_meera, v_prop_meera_flat, 'booking',            'approved', v_sales2, now() - interval '11 months', 'Booking confirmed.'),
    (v_cust_meera, v_prop_meera_flat, 'legal_verification', 'approved', v_legal,  now() - interval '10 months', 'All documents in order.'),
    (v_cust_meera, v_prop_meera_flat, 'finance_clearance',  'approved', v_finance,now() - interval '2 months',  'Full payment received.'),
    (v_cust_meera, v_prop_meera_flat, 'registration',       'approved', v_legal,  now() - interval '6 weeks',   'Registered at Sub-Registrar office.'),
    (v_cust_meera, v_prop_meera_flat, 'possession',         'approved', v_admin,  now() - interval '3 weeks',   'Keys handed over.'),

    (v_cust_meera, v_prop_meera_plot, 'booking',            'approved', v_sales2, now() - interval '7 months', 'Booking confirmed.'),
    (v_cust_meera, v_prop_meera_plot, 'legal_verification', 'approved', v_legal,  now() - interval '7 months', 'Clear title.'),
    (v_cust_meera, v_prop_meera_plot, 'finance_clearance',  'approved', v_finance,now() - interval '7 months', 'Paid in full.'),
    (v_cust_meera, v_prop_meera_plot, 'registration',       'approved', v_legal,  now() - interval '6 months', 'Registered.'),
    (v_cust_meera, v_prop_meera_plot, 'possession',         'approved', v_admin,  now() - interval '6 months', 'Handed over.'),

    (v_cust_divya, v_prop_divya, 'booking',            'approved', v_sales2, now() - interval '3 months', 'Booking confirmed, token received.'),
    (v_cust_divya, v_prop_divya, 'legal_verification', 'rejected', v_legal,  now() - interval '3 weeks',  'Sale agreement rejected — signature mismatch, awaiting re-submission.'),
    (v_cust_divya, v_prop_divya, 'finance_clearance',  'pending',  NULL,     NULL, 'Installment 3 is overdue.'),
    (v_cust_divya, v_prop_divya, 'registration',       'pending',  NULL,     NULL, NULL),
    (v_cust_divya, v_prop_divya, 'possession',         'pending',  NULL,     NULL, NULL);

  -- ===================================================== SITE VISITS
  INSERT INTO public.site_visits (customer_id, project_id, property_id, scheduled_date, assigned_staff, status, outcome_notes) VALUES
    (v_cust_arjun,  v_proj1, v_prop_arjun,      now() - interval '5 months' - interval '1 week', v_sales1, 'completed', 'Liked the corner plot facing east — proceeded straight to booking.'),
    (v_cust_meera,  v_proj2, v_prop_meera_flat, now() - interval '11 months' - interval '1 week', v_sales2, 'completed', 'Loved the clubhouse amenities, decided on Tower A.'),
    (v_cust_divya,  v_proj3, v_prop_divya,      now() - interval '3 months' - interval '4 days',  v_sales2, 'completed', 'Preferred the park-facing unit, booked on the spot.'),
    (v_cust_vikram, v_proj3, NULL,              now() + interval '3 days', v_sales1, 'scheduled', NULL),
    (v_cust_sanjay, v_proj1, NULL,              now() - interval '2 days', v_sales1, 'no_show', 'Customer did not show up, follow-up call scheduled.');

  -- ===================================================== NOTIFICATIONS
  INSERT INTO public.notifications (customer_id, title, message, type, is_read) VALUES
    (v_cust_arjun, 'Installment overdue', 'Installment #5 of ₹4,00,000 for plot SVM-P-004 was due recently. Please make payment to avoid penalty.', 'payment', false),
    (v_cust_arjun, 'Document verified', 'Your sale agreement for SVM-P-004 has been verified by our legal team.', 'document', true),
    (v_cust_divya, 'Document rejected', 'Your sale agreement upload was rejected — signature mismatch. Please re-upload a signed copy.', 'document', false),
    (v_cust_divya, 'Installment overdue', 'Installment #3 of ₹4,50,000 for SVR-F-105 is overdue. A late penalty may apply.', 'payment', false),
    (v_cust_meera, 'Possession handed over', 'Congratulations! Possession of SVH-A-302 has been formally handed over.', 'status', true),
    (v_cust_vikram, 'Site visit scheduled', 'Your site visit to Sanview Residency is confirmed for the upcoming week.', 'site_visit', false),
    (v_cust_sanjay, 'We missed you', 'Your scheduled site visit was marked as a no-show. Our sales team will reach out to reschedule.', 'site_visit', false);

  -- ===================================================== LEAD NOTES (internal CRM)
  INSERT INTO public.lead_notes (customer_id, author_id, note) VALUES
    (v_cust_vikram, v_sales1, 'Interested in 3BHK flats around 55-60L budget, prefers park-facing units.'),
    (v_cust_sanjay, v_sales1, 'Walk-in enquiry for plots in Sanview Meadows, comparing with two competitor projects.'),
    (v_cust_sanjay, v_sales1, 'Missed scheduled site visit — reschedule call planned for this week.'),
    (v_cust_rahul, v_sales2, 'Inbound Facebook lead, requested brochure for Sanview Heights, awaiting first call.');

  -- ===================================================== TASKS
  INSERT INTO public.tasks (title, description, project_id, customer_id, assigned_to, status, due_date, created_by) VALUES
    ('Follow up with Sanjay Gupta', 'Reschedule missed site visit and share Sanview Meadows brochure.', v_proj1, v_cust_sanjay, v_sales1, 'todo', current_date + 2, v_admin),
    ('Call Rahul Bhatt', 'First outreach call for the Facebook Ads lead.', v_proj2, v_cust_rahul, v_sales2, 'todo', current_date + 1, v_admin),
    ('Review re-submitted sale agreement', 'Verify Divya Krishnan''s newly uploaded sale agreement for SVR-F-105.', v_proj3, v_cust_divya, v_legal, 'in_progress', current_date + 1, v_admin),
    ('Chase overdue installment', 'Follow up with Arjun Nair on the overdue installment for SVM-P-004.', v_proj1, v_cust_arjun, v_finance, 'in_progress', current_date, v_admin),
    ('Prepare registration paperwork', 'Draft registration documents ahead of Meera Pillai''s possession handover.', v_proj2, v_cust_meera, v_legal, 'done', current_date - 25, v_admin);

  -- ===================================================== COMMISSIONS
  INSERT INTO public.commissions (sales_staff_id, customer_id, property_id, rate_percent, amount, status) VALUES
    (v_sales1, v_cust_arjun, v_prop_arjun, 1.5, 48000, 'pending'),
    (v_sales2, v_cust_meera, v_prop_meera_flat, 1.5, 102000, 'paid'),
    (v_sales2, v_cust_meera, v_prop_meera_plot, 1.5, 43500, 'paid'),
    (v_sales2, v_cust_divya, v_prop_divya, 1.5, 81000, 'pending');

END $$;

DROP FUNCTION public._seed_new_user(TEXT, TEXT, TEXT, TEXT);
