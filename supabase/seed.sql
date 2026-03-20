-- Supabase local development seed data for motonui
-- Run with: make db-seed

-- ─── Test Users ───────────────────────────────────────────────────────────────
-- Ensure a test user exists in auth.users for seeding related data
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'test@example.com',
    '$2a$10$7RmszB.O2L8JmO18HCHtheE11M64m.d9b/x3HpkP0V9Uf3Z6E6Z.W', -- password123
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test User"}',
    NOW(),
    NOW(),
    'authenticated',
    '',
    '',
    '',
    ''
)
ON CONFLICT (id) DO UPDATE SET 
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- Insert a test trip for development
WITH test_trip AS (
  INSERT INTO trips (id, title, destination, start_date, end_date, description, status, owner_id)
  VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Giappone primavera 2024',
    'Tokyo, Kyoto, Osaka — Giappone',
    '2024-03-20',
    '2024-04-05',
    'Il nostro viaggio in Giappone durante la stagione dei ciliegi. Indimenticabile.',
    'completed',
    '00000000-0000-0000-0000-000000000001' -- placeholder user_id
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
-- Insert sample days
INSERT INTO days (trip_id, date, title, sort_order)
SELECT
  '11111111-1111-1111-1111-111111111111',
  day_date,
  day_title,
  day_order
FROM (VALUES
  ('2024-03-20'::date, 'Arrivo a Tokyo', 1),
  ('2024-03-21'::date, 'Shinjuku e Harajuku', 2),
  ('2024-03-22'::date, 'Asakusa e Ueno', 3),
  ('2024-03-25'::date, 'Kyoto — Fushimi Inari', 4),
  ('2024-03-27'::date, 'Osaka e Namba', 5)
) AS t(day_date, day_title, day_order)
ON CONFLICT DO NOTHING;

-- Sample exchange rates (EUR base)
INSERT INTO currency_rates (base_currency, rates, fetched_at)
VALUES (
  'EUR',
  '{
    "EUR": 1.0,
    "USD": 1.08,
    "GBP": 0.86,
    "JPY": 162.5,
    "CHF": 0.97,
    "CAD": 1.47,
    "AUD": 1.65,
    "SEK": 11.4,
    "NOK": 11.6,
    "DKK": 7.46
  }'::jsonb,
  NOW()
)
ON CONFLICT DO NOTHING;

-- Sample destination cache
INSERT INTO destination_cache (destination, briefing, fetched_at)
VALUES (
  'tokyo, giappone_it',
  '{
    "summary": "Tokyo è una metropoli che fonde tradizione millenaria e modernità futuristica. Uno dei posti più sicuri e affascinanti al mondo per i viaggiatori di coppia.",
    "bestTimeToVisit": "Primavera (marzo-aprile) per i ciliegi, autunno (ottobre-novembre) per i colori.",
    "mustSee": ["Shibuya Crossing", "Tempio Senso-ji a Asakusa", "Quartiere di Shinjuku", "Mercato del pesce di Tsukiji", "Akihabara Electric Town"],
    "localTips": ["Comprate una IC Card (Suica/Pasmo) all''aeroporto", "Usate il treno locale anziché i taxi", "Prenotate i ristoranti ramen più famosi con anticipo", "Portate cash — molti posti non accettano carte"],
    "currencyTip": "Lo Yen (JPY) è ancora preferito al contante; prelevate in posta o presso 7-Eleven ATM.",
    "languageTip": "Pochissimi giapponesi parlano inglese. Google Translate con la fotocamera vi salverà la vita."
  }'::jsonb,
  NOW()
)
ON CONFLICT (destination) DO NOTHING;
