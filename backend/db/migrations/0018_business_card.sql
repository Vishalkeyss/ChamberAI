-- Migration 0018: Prompt 05.4 QR Digital Business Card & vCard
-- Approved 2026-10-08 (OD-069, OD-070). Canonical docs updated: DB_tables_reference.md §2.1, DB_schema.dbml.

-- Public share token for /card/:token. Random (not a readable ID), never changed once set.
ALTER TABLE users ADD COLUMN card_token TEXT;
-- Card accent colour; NULL = the chamber's brand primary_color (OD-069, no hardcoded default).
ALTER TABLE users ADD COLUMN card_theme_color TEXT;
ALTER TABLE users ADD COLUMN card_views_count INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_card_token ON users(card_token);

-- OD-070: backfill existing users (new users get one lazily on first card load).
UPDATE users SET card_token = 'crd_' || lower(hex(randomblob(12))) WHERE card_token IS NULL;
