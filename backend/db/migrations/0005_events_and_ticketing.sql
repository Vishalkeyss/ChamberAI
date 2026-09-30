-- Migration: 0005_events_and_ticketing.sql
-- Module 5: Events & Ticketing (7 tables)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 5.1 events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'staff_only')),
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
CREATE INDEX IF NOT EXISTS idx_events_chamber_id ON events(chamber_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_chapter ON events(chapter_id);

-- 5.2 event_ticket_types
CREATE TABLE IF NOT EXISTS event_ticket_types (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0.0,
  description TEXT,
  allow_pay_later INTEGER NOT NULL DEFAULT 0,
  qty_limit INTEGER,
  qty_sold INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ticket_types_chamber ON event_ticket_types(chamber_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON event_ticket_types(event_id);

-- 5.3 event_promo_codes
CREATE TABLE IF NOT EXISTS event_promo_codes (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'flat')),
  discount_value REAL NOT NULL,
  points_discount_points INTEGER,
  points_discount_pct REAL,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, code)
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_chamber ON event_promo_codes(chamber_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_event ON event_promo_codes(event_id);

-- 5.4 event_sponsorship_tiers
CREATE TABLE IF NOT EXISTS event_sponsorship_tiers (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  amount REAL NOT NULL,
  benefits TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sponsorship_tiers_chamber ON event_sponsorship_tiers(chamber_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_tiers_event ON event_sponsorship_tiers(event_id);

-- 5.5 event_registrations
CREATE TABLE IF NOT EXISTS event_registrations (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ticket_type_id TEXT REFERENCES event_ticket_types(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  registration_type TEXT NOT NULL DEFAULT 'member' CHECK(registration_type IN ('member', 'non_member', 'guest')),
  promo_code_id TEXT REFERENCES event_promo_codes(id) ON DELETE SET NULL,
  amount_paid REAL NOT NULL DEFAULT 0.0,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  payment_status TEXT DEFAULT 'paid' CHECK(payment_status IN ('paid', 'unpaid', 'refunded', 'pay_later')),
  payment_method_id TEXT,
  check_in_status TEXT DEFAULT 'not_checked_in' CHECK(check_in_status IN ('not_checked_in', 'checked_in')),
  checked_in_at TEXT,
  is_waitlisted INTEGER NOT NULL DEFAULT 0,
  waitlist_position INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_reg_chamber ON event_registrations(chamber_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_user ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_check_in ON event_registrations(check_in_status);

-- 5.6 event_feedback
CREATE TABLE IF NOT EXISTS event_feedback (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  star_rating INTEGER NOT NULL CHECK(star_rating BETWEEN 1 AND 5),
  liked_most TEXT,
  would_attend_again INTEGER NOT NULL DEFAULT 1,
  suggestions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_feedback_chamber ON event_feedback(chamber_id);
CREATE INDEX IF NOT EXISTS idx_event_feedback_event ON event_feedback(event_id);

-- 5.7 event_sponsors
CREATE TABLE IF NOT EXISTS event_sponsors (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  business_id TEXT REFERENCES business_profiles(id) ON DELETE SET NULL,
  sponsor_name TEXT NOT NULL,
  sponsor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  tier_id TEXT REFERENCES event_sponsorship_tiers(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0.0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('paid', 'pending', 'overdue')),
  payment_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_sponsors_chamber ON event_sponsors(chamber_id);
CREATE INDEX IF NOT EXISTS idx_event_sponsors_event ON event_sponsors(event_id);
