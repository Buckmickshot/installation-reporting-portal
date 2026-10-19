-- Demo/reference data for local development. NOT for production.
-- Users are created by dev/local-supabase/seed-users.sh (needs the Auth API).

-- Sample Activity 6 product registry rows (fictional brands — replace with the
-- real ESC Activity 6 product register export before going live).
insert into snapshot.activity_6_registry
  ("Product Category No.", "Brand", "Model", "Product Type", "Product Configuration", "Product Unit Mount", "Heating Capacity (kW)", "Cooling Capacity (kW)")
values
  ('6A',     'Demo Air',   'DA-25RC',   'Reverse cycle', 'Single split', 'Wall',    3.2, 2.5),
  ('6A',     'Demo Air',   'DA-35RC',   'Reverse cycle', 'Single split', 'Wall',    4.0, 3.5),
  ('6A',     'Demo Air',   'DA-50RC',   'Reverse cycle', 'Single split', 'Wall',    6.0, 5.0),
  ('6A',     'Coolwave',   'CW-71W',    'Reverse cycle', 'Single split', 'Wall',    8.0, 7.1),
  ('6B(i)',  'Coolwave',   'CW-MS3-80', 'Reverse cycle', 'Multi split',  'Wall',    9.4, 8.0),
  ('6C',     'Ductline',   'DL-125D',   'Reverse cycle', 'Ducted',       'Ceiling', 14.0, 12.5),
  ('6C',     'Ductline',   'DL-160D',   'Reverse cycle', 'Ducted',       'Ceiling', 18.0, 16.0),
  ('6E(i)',  'Floorline',  'FL-35F',    'Reverse cycle', 'Single split', 'Floor',   4.5, 3.5)
on conflict do nothing;
