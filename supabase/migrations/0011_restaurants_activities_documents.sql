-- =============================================================================
-- motonui — Restaurants, Activities, Documents Migration
-- Migration: 0011_restaurants_activities_documents.sql
-- Adds: restaurants table, activities table, documents table,
--       extended reminder types for new entities.
-- =============================================================================

-- restaurants: dining reservations per trip
CREATE TABLE IF NOT EXISTS restaurants (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id           UUID REFERENCES days(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  cuisine_type     TEXT,
  address          TEXT,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  date             DATE,
  time             TIME,
  covers           INT DEFAULT 2,
  cost             NUMERIC(12, 2),
  currency         TEXT DEFAULT 'EUR',
  booking_ref      TEXT,
  confirmation_url TEXT,
  phone            TEXT,
  notes            TEXT,
  sort_order       INT NOT NULL DEFAULT 0
);

-- activities: tours, museums, excursions, shows, sports
CREATE TABLE IF NOT EXISTS activities (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id           UUID REFERENCES days(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'tour' CHECK (type IN ('museum', 'tour', 'excursion', 'show', 'sport', 'other')),
  address          TEXT,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  date             DATE,
  time             TIME,
  duration_min     INT,
  cost             NUMERIC(12, 2),
  currency         TEXT DEFAULT 'EUR',
  booking_ref      TEXT,
  ticket_url       TEXT,
  notes            TEXT,
  sort_order       INT NOT NULL DEFAULT 0
);

-- documents: travel wallet — boarding passes, vouchers, tickets, etc.
CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  uploaded_by      UUID NOT NULL REFERENCES auth.users(id),
  entity_type      TEXT CHECK (entity_type IN ('leg', 'accommodation', 'restaurant', 'activity', 'trip')),
  entity_id        UUID,
  type             TEXT NOT NULL CHECK (type IN (
    'boarding_pass', 'hotel_voucher', 'ticket',
    'reservation_confirmation', 'insurance', 'visa', 'other'
  )),
  title            TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  file_type        TEXT NOT NULL DEFAULT 'image' CHECK (file_type IN ('pdf', 'image')),
  valid_from       DATE,
  valid_until      DATE,
  barcode_data     TEXT,
  notes            TEXT
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_restaurants_trip_id ON restaurants(trip_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_day_id ON restaurants(day_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_date ON restaurants(date);

CREATE INDEX IF NOT EXISTS idx_activities_trip_id ON activities(trip_id);
CREATE INDEX IF NOT EXISTS idx_activities_day_id ON activities(day_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);

CREATE INDEX IF NOT EXISTS idx_documents_trip_id ON documents(trip_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['restaurants','activities','documents'] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      t
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents   ENABLE ROW LEVEL SECURITY;

-- restaurants: trip members only
CREATE POLICY "restaurants_select" ON restaurants FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "restaurants_insert" ON restaurants FOR INSERT WITH CHECK (is_trip_member(trip_id));
CREATE POLICY "restaurants_update" ON restaurants FOR UPDATE USING (is_trip_member(trip_id));
CREATE POLICY "restaurants_delete" ON restaurants FOR DELETE USING (is_trip_member(trip_id));

-- activities: trip members only
CREATE POLICY "activities_select" ON activities FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "activities_insert" ON activities FOR INSERT WITH CHECK (is_trip_member(trip_id));
CREATE POLICY "activities_update" ON activities FOR UPDATE USING (is_trip_member(trip_id));
CREATE POLICY "activities_delete" ON activities FOR DELETE USING (is_trip_member(trip_id));

-- documents: trip members only
CREATE POLICY "documents_select" ON documents FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "documents_insert" ON documents FOR INSERT WITH CHECK (is_trip_member(trip_id));
CREATE POLICY "documents_update" ON documents FOR UPDATE USING (is_trip_member(trip_id));
CREATE POLICY "documents_delete" ON documents FOR DELETE USING (is_trip_member(trip_id));

-- =============================================================================
-- EXTEND REMINDERS — add new entity types and reminder types
-- =============================================================================

-- Drop and re-create constraints to allow new values
ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_entity_type_check;
ALTER TABLE reminders ADD CONSTRAINT reminders_entity_type_check
  CHECK (entity_type IN ('leg', 'accommodation', 'restaurant', 'activity'));

ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_type_check;
ALTER TABLE reminders ADD CONSTRAINT reminders_type_check
  CHECK (type IN (
    'flight_checkin', 'payment_deadline', 'cancellation_deadline',
    'restaurant_reservation', 'activity_ticket',
    'visa_expiry', 'insurance_expiry', 'custom'
  ));
