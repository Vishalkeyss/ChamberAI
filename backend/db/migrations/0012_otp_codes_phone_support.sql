-- Migration: 0012_otp_codes_phone_support.sql
-- Purpose: Make otp_codes.email nullable to support phone-only OTP delivery.
--          SQLite does not support ALTER COLUMN, so we recreate the table.
-- Reference: database/DB_tables_reference.md §2.8 otp_codes

-- Step 1: Rename existing table
ALTER TABLE otp_codes RENAME TO otp_codes_old;

-- Step 2: Recreate with email nullable and phone indexed
CREATE TABLE otp_codes (
  id TEXT PRIMARY KEY,
  chamber_id TEXT REFERENCES platform_chambers(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  portal TEXT NOT NULL CHECK(portal IN ('member', 'chamber_admin', 'super_admin', 'public')),
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  is_verified INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- At least one of email or phone must be set (enforced at application layer)
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Step 3: Copy existing rows
INSERT INTO otp_codes SELECT * FROM otp_codes_old;

-- Step 4: Drop old table
DROP TABLE otp_codes_old;

-- Step 5: Recreate indexes (email-based lookup + phone-based lookup)
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_lookup ON otp_codes(email, portal, is_verified, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_lookup ON otp_codes(phone, portal, is_verified, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_codes_chamber_id ON otp_codes(chamber_id);
