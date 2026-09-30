-- Migration: 0002_identity_and_roles.sql
-- Module 2: Core Identity & Profiles (8 D1 tables + system roles seed)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 2.6 roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  scope_type TEXT CHECK(scope_type IN ('chamber', 'chapter', 'group')),
  permissions_json TEXT,
  is_system_role INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES platform_super_admins(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- Seed System Roles
INSERT OR IGNORE INTO roles (id, name, display_name, description, scope_type, is_system_role) VALUES
  ('super_admin', 'super_admin', 'Platform Super Admin', 'Global administration across all chambers', NULL, 1),
  ('full_admin', 'full_admin', 'Chamber Full Administrator', 'Unrestricted administrative access to chamber', 'chamber', 1),
  ('billing_admin', 'billing_admin', 'Chamber Billing Administrator', 'Access restricted to billing, invoicing, and plans', 'chamber', 1),
  ('chapter_admin', 'chapter_admin', 'Chapter Administrator', 'Scoped administrative access to assigned chapter', 'chapter', 1),
  ('group_admin', 'group_admin', 'Group / Committee Admin', 'Scoped access to assigned community group', 'group', 1),
  ('member', 'member', 'Active Chamber Member', 'Standard authenticated member portal access', 'chamber', 1);

-- 2.1 users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  member_verification_token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  phone TEXT,
  name TEXT,
  avatar_url TEXT,
  highest_role TEXT DEFAULT 'member' CHECK(highest_role IN ('member', 'billing_admin', 'group_admin', 'chapter_admin', 'full_admin', 'super_admin')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('active', 'pending', 'expired', 'suspended')),
  primary_chapter_id TEXT,
  points_balance INTEGER NOT NULL DEFAULT 0,
  profile_completion_pct INTEGER NOT NULL DEFAULT 0,
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK(preferred_language IN ('en', 'es', 'fr', 'zh', 'vi', 'ko')),
  preferred_theme TEXT NOT NULL DEFAULT 'system' CHECK(preferred_theme IN ('light', 'dark', 'system')),
  ai_credits_used INTEGER NOT NULL DEFAULT 0,
  ai_credits_limit INTEGER NOT NULL DEFAULT 5,
  personal_api_key_encrypted TEXT,
  personal_api_provider TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(chamber_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_chamber_id ON users(chamber_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(member_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_highest_role ON users(highest_role);

-- 2.2 admin_profiles
CREATE TABLE IF NOT EXISTS admin_profiles (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  job_title TEXT,
  department TEXT,
  work_phone TEXT,
  mobile_phone TEXT,
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  bio TEXT,
  email_signature TEXT,
  notify_new_application INTEGER NOT NULL DEFAULT 1,
  notify_payment_received INTEGER NOT NULL DEFAULT 1,
  notify_event_registration INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_chamber_id ON admin_profiles(chamber_id);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_user_id ON admin_profiles(user_id);

-- 2.3 business_profiles
CREATE TABLE IF NOT EXISTS business_profiles (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_logo_url TEXT,
  tagline TEXT,
  description TEXT,
  industry TEXT,
  business_phone TEXT,
  business_email TEXT,
  website TEXT,
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  social_links_json TEXT,
  skills_json TEXT,
  interests_json TEXT,
  locations_json TEXT,
  related_organizations_json TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_business_profiles_chamber_id ON business_profiles(chamber_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_industry ON business_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_business_profiles_city ON business_profiles(city);

-- 2.4 business_members
CREATE TABLE IF NOT EXISTS business_members (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'events_networking' CHECK(access_level IN ('full_access', 'billing_only', 'events_networking', 'business_development')),
  is_primary_contact INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending', 'removed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(business_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_business_members_chamber_id ON business_members(chamber_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business_id ON business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_user_id ON business_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_members_primary_contact ON business_members(business_id) WHERE is_primary_contact = 1;

-- 2.5 chamber_memberships
CREATE TABLE IF NOT EXISTS chamber_memberships (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  member_id_display TEXT NOT NULL,
  plan_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('active', 'pending', 'expired', 'suspended')),
  plan_start_date TEXT,
  plan_end_date TEXT,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(chamber_id, member_id_display)
);
CREATE INDEX IF NOT EXISTS idx_chamber_memberships_chamber_id ON chamber_memberships(chamber_id);
CREATE INDEX IF NOT EXISTS idx_chamber_memberships_business_id ON chamber_memberships(business_id);
CREATE INDEX IF NOT EXISTS idx_chamber_memberships_status ON chamber_memberships(status);

-- 2.7 user_role_assignments
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('chamber', 'chapter', 'group')),
  scope_id TEXT NOT NULL,
  granted_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, role_id, scope_type, scope_id)
);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_chamber ON user_role_assignments(chamber_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_scope ON user_role_assignments(scope_type, scope_id);

-- 2.8 otp_codes (D1 SQL table for atomic counters & consistency)
CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  chamber_id TEXT REFERENCES platform_chambers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  portal TEXT NOT NULL CHECK(portal IN ('member', 'chamber_admin', 'super_admin', 'public')),
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  is_verified INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_lookup ON otp_codes(email, portal, is_verified, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_codes_chamber_id ON otp_codes(chamber_id);
