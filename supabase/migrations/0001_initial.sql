-- =============================================================================
-- motonui — Initial Database Schema
-- Migration: 0001_initial.sql
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLES
-- =============================================================================

-- trips: a travel trip belonging to up to 2 members
CREATE TABLE trips (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title         TEXT NOT NULL,
  destination   TEXT NOT NULL,
  cover_image   TEXT,
  start_date    DATE,
  end_date      DATE,
  status        TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  description   TEXT,
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- trip_members: join table — max 2 members per trip
CREATE TABLE trip_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  UNIQUE(trip_id, user_id)
);

-- days: each calendar day of a trip
CREATE TABLE days (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  title      TEXT,
  notes      TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- legs: a movement/transport within a day
CREATE TABLE legs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id       UUID REFERENCES days(id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other')),
  from_name    TEXT NOT NULL,
  to_name      TEXT NOT NULL,
  from_lat     DOUBLE PRECISION,
  from_lng     DOUBLE PRECISION,
  to_lat       DOUBLE PRECISION,
  to_lng       DOUBLE PRECISION,
  departure_at TIMESTAMPTZ,
  arrival_at   TIMESTAMPTZ,
  duration_min INT,
  cost         NUMERIC(12, 2),
  currency     TEXT DEFAULT 'EUR',
  notes        TEXT,
  sort_order   INT NOT NULL DEFAULT 0
);

-- accommodations: lodging per stay
CREATE TABLE accommodations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id       UUID REFERENCES days(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  address      TEXT,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  check_in     DATE,
  check_out    DATE,
  cost         NUMERIC(12, 2),
  currency     TEXT DEFAULT 'EUR',
  booking_ref  TEXT,
  notes        TEXT,
  url          TEXT
);

-- expenses: individual expense entries
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id       UUID REFERENCES days(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,
  amount       NUMERIC(12, 2) NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'EUR',
  amount_eur   NUMERIC(12, 2),               -- denormalized EUR equivalent
  category     TEXT NOT NULL CHECK (category IN ('food', 'transport', 'accommodation', 'activity', 'shopping', 'other')),
  paid_by      UUID NOT NULL REFERENCES auth.users(id),
  split        BOOLEAN NOT NULL DEFAULT TRUE,
  date         DATE,
  notes        TEXT
);

-- posts: travel blog posts
CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id         UUID REFERENCES trips(id) ON DELETE SET NULL,
  author_id       UUID NOT NULL REFERENCES auth.users(id),
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  content_json    JSONB,                      -- Tiptap doc JSON
  cover_image     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at    TIMESTAMPTZ,
  reading_time    INT,                        -- estimated minutes
  seo_title       TEXT,
  seo_description TEXT,
  og_description  TEXT
);

-- media: photos and videos uploaded per trip
CREATE TABLE media (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id        UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id         UUID REFERENCES days(id) ON DELETE SET NULL,
  uploaded_by    UUID NOT NULL REFERENCES auth.users(id),
  url            TEXT NOT NULL,              -- original file public URL
  thumbnail_url  TEXT,                       -- 400×400 thumb
  width          INT,
  height         INT,
  size           BIGINT,
  mime_type      TEXT,
  caption        TEXT,
  tags           TEXT[],
  taken_at       TIMESTAMPTZ,               -- from EXIF
  gps_lat        DOUBLE PRECISION,          -- from EXIF
  gps_lng        DOUBLE PRECISION,          -- from EXIF
  camera         TEXT,                      -- from EXIF
  sort_order     INT NOT NULL DEFAULT 0
);

-- instagram_exports: generated export jobs
CREATE TABLE instagram_exports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  type        TEXT NOT NULL CHECK (type IN ('carousel', 'story', 'reel')),
  media_ids   UUID[] NOT NULL,
  template    TEXT,
  options     JSONB,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  zip_url     TEXT,                          -- signed URL to exported ZIP
  expires_at  TIMESTAMPTZ,
  caption     TEXT,
  hashtags    TEXT[]
);

-- currency_rates: cached exchange rates (refreshed every 24h)
CREATE TABLE currency_rates (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  base_currency  TEXT NOT NULL DEFAULT 'EUR',
  rates          JSONB NOT NULL,             -- { "USD": 1.08, "GBP": 0.86, ... }
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ai_usage: rate limiting AI calls per user per day
CREATE TABLE ai_usage (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  call_type  TEXT NOT NULL,                 -- 'blog', 'seo', 'caption', 'destination', 'category'
  tokens     INT,
  UNIQUE(user_id, date, call_type)
);

-- destination_cache: cached AI destination briefings (30 days)
CREATE TABLE destination_cache (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  destination TEXT NOT NULL UNIQUE,
  briefing    JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- trips
CREATE INDEX idx_trips_owner_id ON trips(owner_id);
CREATE INDEX idx_trips_status ON trips(status);

-- trip_members
CREATE INDEX idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user_id ON trip_members(user_id);

-- days
CREATE INDEX idx_days_trip_id ON days(trip_id);
CREATE INDEX idx_days_date ON days(date);

-- legs
CREATE INDEX idx_legs_trip_id ON legs(trip_id);
CREATE INDEX idx_legs_day_id ON legs(day_id);

-- accommodations
CREATE INDEX idx_accommodations_trip_id ON accommodations(trip_id);
CREATE INDEX idx_accommodations_day_id ON accommodations(day_id);

-- expenses
CREATE INDEX idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX idx_expenses_day_id ON expenses(day_id);
CREATE INDEX idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date ON expenses(date);

-- posts
CREATE INDEX idx_posts_trip_id ON posts(trip_id);
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_slug ON posts(slug);

-- media
CREATE INDEX idx_media_trip_id ON media(trip_id);
CREATE INDEX idx_media_day_id ON media(day_id);
CREATE INDEX idx_media_uploaded_by ON media(uploaded_by);

-- instagram_exports
CREATE INDEX idx_instagram_exports_trip_id ON instagram_exports(trip_id);
CREATE INDEX idx_instagram_exports_status ON instagram_exports(status);
CREATE INDEX idx_instagram_exports_expires_at ON instagram_exports(expires_at);

-- ai_usage
CREATE INDEX idx_ai_usage_user_date ON ai_usage(user_id, date);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['trips','days','legs','accommodations','expenses','posts','media','instagram_exports'] LOOP
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

ALTER TABLE trips             ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE days              ENABLE ROW LEVEL SECURITY;
ALTER TABLE legs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE media             ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage          ENABLE ROW LEVEL SECURITY;
ALTER TABLE destination_cache ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member of a given trip?
CREATE OR REPLACE FUNCTION is_trip_member(trip_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_members.trip_id = $1
      AND trip_members.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- trips: member can view/edit; owner can delete
CREATE POLICY "trips_select" ON trips FOR SELECT USING (is_trip_member(id));
CREATE POLICY "trips_insert" ON trips FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "trips_update" ON trips FOR UPDATE USING (is_trip_member(id));
CREATE POLICY "trips_delete" ON trips FOR DELETE USING (owner_id = auth.uid());

-- trip_members
CREATE POLICY "trip_members_select" ON trip_members FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "trip_members_insert" ON trip_members FOR INSERT WITH CHECK (is_trip_member(trip_id) OR user_id = auth.uid());
CREATE POLICY "trip_members_delete" ON trip_members FOR DELETE USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.owner_id = auth.uid())
);

-- days, legs, accommodations: any trip member
CREATE POLICY "days_select"   ON days           FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "days_insert"   ON days           FOR INSERT WITH CHECK (is_trip_member(trip_id));
CREATE POLICY "days_update"   ON days           FOR UPDATE USING (is_trip_member(trip_id));
CREATE POLICY "days_delete"   ON days           FOR DELETE USING (is_trip_member(trip_id));

CREATE POLICY "legs_select"   ON legs           FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "legs_insert"   ON legs           FOR INSERT WITH CHECK (is_trip_member(trip_id));
CREATE POLICY "legs_update"   ON legs           FOR UPDATE USING (is_trip_member(trip_id));
CREATE POLICY "legs_delete"   ON legs           FOR DELETE USING (is_trip_member(trip_id));

CREATE POLICY "accom_select"  ON accommodations FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "accom_insert"  ON accommodations FOR INSERT WITH CHECK (is_trip_member(trip_id));
CREATE POLICY "accom_update"  ON accommodations FOR UPDATE USING (is_trip_member(trip_id));
CREATE POLICY "accom_delete"  ON accommodations FOR DELETE USING (is_trip_member(trip_id));

CREATE POLICY "expenses_select" ON expenses     FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "expenses_insert" ON expenses     FOR INSERT WITH CHECK (is_trip_member(trip_id));
CREATE POLICY "expenses_update" ON expenses     FOR UPDATE USING (is_trip_member(trip_id));
CREATE POLICY "expenses_delete" ON expenses     FOR DELETE USING (is_trip_member(trip_id));

CREATE POLICY "media_select"  ON media          FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "media_insert"  ON media          FOR INSERT WITH CHECK (is_trip_member(trip_id));
CREATE POLICY "media_update"  ON media          FOR UPDATE USING (is_trip_member(trip_id));
CREATE POLICY "media_delete"  ON media          FOR DELETE USING (is_trip_member(trip_id));

CREATE POLICY "ig_exports_select" ON instagram_exports FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "ig_exports_insert" ON instagram_exports FOR INSERT WITH CHECK (is_trip_member(trip_id));
CREATE POLICY "ig_exports_update" ON instagram_exports FOR UPDATE USING (is_trip_member(trip_id));

-- posts: any trip member can CRUD; published posts are publicly readable
CREATE POLICY "posts_select_member"    ON posts FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "posts_select_published" ON posts FOR SELECT USING (status = 'published');
CREATE POLICY "posts_insert"           ON posts FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "posts_update"           ON posts FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "posts_delete"           ON posts FOR DELETE USING (author_id = auth.uid());

-- currency_rates: any authenticated user can read; only service role writes
CREATE POLICY "currency_rates_select" ON currency_rates FOR SELECT USING (auth.role() = 'authenticated');

-- ai_usage: own rows only
CREATE POLICY "ai_usage_select" ON ai_usage FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ai_usage_insert" ON ai_usage FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_usage_update" ON ai_usage FOR UPDATE USING (user_id = auth.uid());

-- destination_cache: any authenticated user can read; service role writes
CREATE POLICY "dest_cache_select" ON destination_cache FOR SELECT USING (auth.role() = 'authenticated');
