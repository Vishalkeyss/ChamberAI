-- Migration 0020: Prompt 05.6 Chamber Mentorship Program
-- Approved 2026-10-09 (OD-090 … OD-104). DB columns / statuses from 0007 stay canonical (OD-090):
-- profile status active | paused | inactive, mentorship status pending | confirmed | rejected | cancelled | completed.

-- §5 / §9.3: mentor may give a reason when declining.
ALTER TABLE mentorship ADD COLUMN decline_reason TEXT;

-- §6 spec indexes (adapted to the DB columns).
CREATE INDEX IF NOT EXISTS idx_mentorship_profiles_chamber_status ON mentorship_profiles(chamber_id, status);
CREATE INDEX IF NOT EXISTS idx_mentorship_users ON mentorship(chamber_id, mentor_id, mentee_id, status);

-- §7 rule 2: at most one pending or active request per mentor / mentee pair (race-safe guard).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentorship_open_pair ON mentorship(chamber_id, mentor_id, mentee_id)
  WHERE status IN ('pending', 'confirmed');
