-- =============================================================================
-- motonui — Travel Features Migration
-- Migration: 0002_travel_features.sql
-- Adds: carrier/booking details to legs, payment deadlines to accommodations,
--       reminders table for email alerts.
-- =============================================================================

-- legs: travel company, booking reference, PNR, boarding pass, check-in opening
ALTER TABLE legs
  ADD COLUMN IF NOT EXISTS carrier          TEXT,
  ADD COLUMN IF NOT EXISTS booking_ref      TEXT,
  ADD COLUMN IF NOT EXISTS pnr              TEXT,
  ADD COLUMN IF NOT EXISTS boarding_pass_url TEXT,
  ADD COLUMN IF NOT EXISTS checkin_opens_at TIMESTAMPTZ;

-- accommodations: payment and cancellation deadlines
ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS payment_deadline      DATE,
  ADD COLUMN IF NOT EXISTS cancellation_deadline DATE;

-- reminders: scheduled email alerts for deadlines and check-ins
CREATE TABLE IF NOT EXISTS reminders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('leg', 'accommodation')),
  entity_id    UUID NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('flight_checkin', 'payment_deadline', 'cancellation_deadline')),
  remind_at    TIMESTAMPTZ NOT NULL,
  sent_at      TIMESTAMPTZ,
  title        TEXT NOT NULL,
  message      TEXT
);

CREATE INDEX IF NOT EXISTS idx_reminders_unsent
  ON reminders(remind_at)
  WHERE sent_at IS NULL;
