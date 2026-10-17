-- ============================================================
-- CPP Free Food - Supabase schema / migration
--
-- Safe to run:
--   - on a brand-new Supabase project
--   - on the original CPP Free Food database
--   - multiple times without duplicate-object errors
-- ============================================================


-- ------------------------------------------------------------
-- 1. Extensions
-- ------------------------------------------------------------

-- Used for the trigram title-search index below.
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ------------------------------------------------------------
-- 2. Events table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text NOT NULL,
  description      text,
  date             date NOT NULL,
  time             text,
  location         text,
  organizer        text,

  source_url       text,
  source_name      text NOT NULL DEFAULT 'Unknown',
  source_event_id  text,

  tags             text[] DEFAULT '{}',

  has_free_food    boolean NOT NULL DEFAULT true,
  food_evidence    text,
  food_confidence  real NOT NULL DEFAULT 1,
  rsvp_required    boolean,

  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  last_seen_at     timestamptz DEFAULT now()
);


-- ------------------------------------------------------------
-- 3. Migrate databases created with the old version
-- ------------------------------------------------------------

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS source_event_id text;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS food_evidence text;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS food_confidence real NOT NULL DEFAULT 1;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS rsvp_required boolean;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();


-- ------------------------------------------------------------
-- 4. Make sure food_confidence stays between 0 and 1
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_food_confidence_check'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_food_confidence_check
      CHECK (
        food_confidence >= 0
        AND food_confidence <= 1
      );
  END IF;
END
$$;


-- ------------------------------------------------------------
-- 5. Unique event rule
--
-- An event with the same title on the same date is treated as
-- the same event. This is used by the scraper's UPSERT logic.
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_title_date_unique'
      AND conrelid = 'events'::regclass
  ) THEN

    ALTER TABLE events
      ADD CONSTRAINT events_title_date_unique
      UNIQUE (title, date);

  END IF;
END
$$;


-- ------------------------------------------------------------
-- 6. Indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_events_date
  ON events (date);

CREATE INDEX IF NOT EXISTS idx_events_tags
  ON events USING gin(tags);

CREATE INDEX IF NOT EXISTS idx_events_title_trgm
  ON events USING gin(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_events_last_seen
  ON events (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_source_event_id
  ON events (source_event_id);


-- ------------------------------------------------------------
-- 7. Row Level Security
-- ------------------------------------------------------------

ALTER TABLE events ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 8. Public read access
--
-- Anyone visiting the website is allowed to READ events.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can read events"
  ON events;

CREATE POLICY "Anyone can read events"
  ON events
  FOR SELECT
  USING (true);


-- ------------------------------------------------------------
-- 9. Remove old insecure write policy
--
-- The original version allowed the public anon key to write.
-- We do NOT want that anymore.
--
-- Server API routes use SUPABASE_SERVICE_ROLE_KEY instead.
-- The service role bypasses RLS automatically.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Service role can write events"
  ON events;


-- ------------------------------------------------------------
-- Done
-- ------------------------------------------------------------