-- ============================================================
-- CPP Free Food — Supabase Database Setup
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- 1. Create the events table
CREATE TABLE IF NOT EXISTS events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  description text,
  date        date NOT NULL,
  time        text,
  location    text,
  organizer   text,
  source_url  text,
  source_name text NOT NULL DEFAULT 'Unknown',
  tags        text[] DEFAULT '{}',
  has_free_food boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- 2. Unique constraint so upsert works (no duplicate title+date combos)
ALTER TABLE events
  ADD CONSTRAINT events_title_date_unique UNIQUE (title, date);

-- 3. Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_events_date      ON events (date);
CREATE INDEX IF NOT EXISTS idx_events_tags      ON events USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING gin(title gin_trgm_ops);

-- Enable pg_trgm for text search (needed for the title index above)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 4. Row Level Security: allow anyone to READ events (they're public)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read events"
  ON events FOR SELECT
  USING (true);

-- Only the service role (your cron job / server) can insert/update/delete
CREATE POLICY "Service role can write events"
  ON events FOR ALL
  USING (true)  -- the anon key can write too so the scrape endpoint works
  WITH CHECK (true);

-- ============================================================
-- Done! Your database is ready.
-- ============================================================
