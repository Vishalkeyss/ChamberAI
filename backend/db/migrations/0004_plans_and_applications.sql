-- Migration: 0004_plans_and_applications.sql
-- Module 4: Membership Plans & Applications (3 tables)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 4.1 membership_plans
CREATE TABLE IF NOT EXISTS membership_plans (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  accent_color TEXT,
  price REAL NOT NULL DEFAULT 0.0,
  pricing_basis TEXT DEFAULT 'flat' CHECK(pricing_basis IN ('flat', 'by_employee_count', 'by_annual_revenue')),
  pricing_tiers_json TEXT,
  billing_frequency TEXT DEFAULT 'annual' CHECK(billing_frequency IN ('monthly', 'annual', 'one_time')),
  is_popular INTEGER NOT NULL DEFAULT 0,
  features_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  active_members_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_membership_plans_chamber_id ON membership_plans(chamber_id);
CREATE INDEX IF NOT EXISTS idx_membership_plans_is_active ON membership_plans(is_active);

-- 4.2 membership_benefit_usage
CREATE TABLE IF NOT EXISTS membership_benefit_usage (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  membership_id TEXT NOT NULL REFERENCES chamber_memberships(id) ON DELETE CASCADE,
  benefit_key TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(membership_id, benefit_key, period_start)
);
CREATE INDEX IF NOT EXISTS idx_benefit_usage_chamber ON membership_benefit_usage(chamber_id);
CREATE INDEX IF NOT EXISTS idx_benefit_usage_membership ON membership_benefit_usage(membership_id);

-- 4.3 applications
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  business_phone TEXT,
  business_name TEXT NOT NULL,
  business_details_json TEXT,
  plan_id TEXT REFERENCES membership_plans(id) ON DELETE SET NULL,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  admin_notes TEXT,
  kanban_stage TEXT DEFAULT 'pending',
  tracking_code TEXT NOT NULL UNIQUE,
  converted_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_applications_chamber_id ON applications(chamber_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_tracking_code ON applications(tracking_code);
