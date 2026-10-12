-- Migration 0017: Prompt 05.2 (Direct Messaging) + Prompt 05.3 (B2B Referrals)
-- Approved 2026-10-08 (OD-055). Canonical docs updated: DB_tables_reference.md §7.1, DB_schema.dbml.

-- 05.3 §6.1: deal value recorded when the recipient marks a referral converted.
ALTER TABLE referrals ADD COLUMN converted_value REAL;

-- 05.3 §6.1
CREATE INDEX IF NOT EXISTS idx_referrals_chamber_businesses ON referrals(chamber_id, from_business_id, to_business_id, status);

-- 05.2 §6.1
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(chamber_id, sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(chamber_id, recipient_id, is_read);
