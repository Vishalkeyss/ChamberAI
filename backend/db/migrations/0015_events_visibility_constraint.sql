-- Migration 0015: Update events visibility check constraint
-- Aligns events table with Prompt 04.1 Section 6.1 and DB_schema.dbml
-- Supported visibility: 'public', 'members_only', 'staff_only', 'unlisted'

PRAGMA foreign_keys=OFF;

CREATE TABLE events_dg_tmp (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'members_only', 'staff_only', 'unlisted')),
  event_date TEXT NOT NULL,
  event_end_date TEXT,
  is_all_day INTEGER NOT NULL DEFAULT 0,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_rule_json TEXT,
  parent_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  city TEXT,
  venue TEXT,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  table_arrangement TEXT,
  num_tables INTEGER,
  max_capacity INTEGER,
  registration_fee REAL NOT NULL DEFAULT 0.0,
  non_member_fee REAL,
  is_paid INTEGER NOT NULL DEFAULT 0,
  allow_non_member_registration INTEGER NOT NULL DEFAULT 1,
  promote_facebook INTEGER NOT NULL DEFAULT 0,
  promote_meetup INTEGER NOT NULL DEFAULT 0,
  promote_eventbrite INTEGER NOT NULL DEFAULT 0,
  google_calendar_link TEXT,
  photos_json TEXT,
  video_url TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'cancelled', 'completed')),
  registered_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

INSERT INTO events_dg_tmp SELECT * FROM events;

DROP TABLE events;

ALTER TABLE events_dg_tmp RENAME TO events;

CREATE INDEX IF NOT EXISTS idx_events_chamber_id ON events(chamber_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_chapter ON events(chapter_id);

PRAGMA foreign_keys=ON;
