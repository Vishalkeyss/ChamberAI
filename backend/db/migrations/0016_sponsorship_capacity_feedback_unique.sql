-- Migration 0016: Prompt 04.4 sponsorship tier capacity + Prompt 04.5 one review per attendee
-- Approved 2026-10-08 (OD-032, OD-035). Canonical docs updated: DB_tables_reference.md §5.4 / §5.6, DB_schema.dbml.

-- 04.4 §6.1: tier capacity. max_sponsors NULL = unlimited.
ALTER TABLE event_sponsorship_tiers ADD COLUMN max_sponsors INTEGER;
-- Number of sponsors currently holding a spot in this tier (maintained atomically by the API).
ALTER TABLE event_sponsorship_tiers ADD COLUMN sponsors_count INTEGER NOT NULL DEFAULT 0;

UPDATE event_sponsorship_tiers
SET sponsors_count = (
  SELECT COUNT(*) FROM event_sponsors s
  WHERE s.tier_id = event_sponsorship_tiers.id AND s.chamber_id = event_sponsorship_tiers.chamber_id
);

-- 04.4 §6.2
CREATE INDEX IF NOT EXISTS idx_event_sponsors_event ON event_sponsors(event_id, status);

-- 04.5 §6.1 / §7.2: UNIQUE(event_id, user_id) — duplicate reviews rejected with 409.
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_feedback_event_user ON event_feedback(event_id, user_id);
